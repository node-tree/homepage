// ═══════════════════════════════════════════════════════════════
// ImageKit 관리자 라우트
//   · 읽기/업로드서명/폴더생성·삭제(DELETE /file, /folder) 모두 결합 인증 —
//     사이트 admin 또는 꿈다락 scope 토큰 허용. role:'user' 등 비권한 → 403.
//   · private key 는 서버에서만 사용. publicKey/urlEndpoint 는 공개값이므로
//     프론트 업로드(서명방식)에 필요해 /auth 응답에 함께 내려준다.
//   · 자체 DB 저장 없음 — ImageKit 미디어 라이브러리가 단일 소스.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const jwt = require('jsonwebtoken');
const ImageKit = require('imagekit');

const router = express.Router();

// 환경변수에서만 키 로드(하드코딩 금지). 누락 시 503 으로 명확히 안내.
const PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
const PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;

let imagekit = null;
if (PUBLIC_KEY && PRIVATE_KEY && URL_ENDPOINT) {
  imagekit = new ImageKit({
    publicKey: PUBLIC_KEY,
    privateKey: PRIVATE_KEY,
    urlEndpoint: URL_ENDPOINT,
  });
} else {
  console.warn(
    '⚠️ ImageKit 환경변수(IMAGEKIT_PUBLIC_KEY/IMAGEKIT_PRIVATE_KEY/IMAGEKIT_URL_ENDPOINT) 미설정 — /api/imagekit 비활성'
  );
}

// ── 결합 인증 ──────────────────────────────────────────────────
//   읽기(/list,/usage)·업로드 서명(/auth)·폴더 생성(/folder)은
//   "사이트 admin" 또는 "꿈다락 scope" 둘 중 하나면 허용한다(ai.js requireAnyAuth 와 동형).
//   파괴적 삭제(DELETE /file, /folder)도 동일한 결합 인증 뒤에서만 — admin 또는 꿈다락 편집자.
//   (편집툴/피커가 꿈다락 토큰으로 동작하므로 admin 전용으로 막지 않는다. 공개는 401 차단.)
//   토큰을 1회 검증해 req.user(사이트)/req.kkumdarak(꿈다락)에 실어 둔다.
const requireImagekitAccess = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, message: '접근 권한이 없습니다. 토큰이 필요합니다.' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return res.status(401).json({ success: false, message: '토큰이 제공되지 않았습니다.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.role === 'admin') {
      req.user = decoded; // 사이트 admin
      return next();
    }
    if (decoded && decoded.scope === 'kkumdarak') {
      req.kkumdarak = decoded; // 꿈다락 편집자
      return next();
    }
    // 로그인은 했으나 권한 없음(예: role:'user') → 403.
    return res.status(403).json({ success: false, message: '관리자 또는 꿈다락 편집 권한이 필요합니다.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
};

// 모든 라우트: 결합 인증(읽기·업로드·폴더생성·삭제 모두 admin 또는 꿈다락 편집자).
router.use(requireImagekitAccess);

// SDK 미초기화(환경변수 누락) 가드
router.use((req, res, next) => {
  if (!imagekit) {
    return res.status(503).json({
      success: false,
      message: 'ImageKit 환경변수가 서버에 설정되지 않았습니다.',
    });
  }
  next();
});

// GET /api/imagekit/auth
//   업로드 서명 파라미터(token, expire, signature) + 공개값(publicKey, urlEndpoint).
//   private key 는 절대 응답에 포함하지 않는다.
router.get('/auth', (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.json({
      success: true,
      ...authParams, // { token, expire, signature }
      publicKey: PUBLIC_KEY, // 공개값(프론트 업로드에 필요)
      urlEndpoint: URL_ENDPOINT, // 공개값
    });
  } catch (error) {
    console.error('ImageKit 인증 파라미터 생성 오류:', error.message);
    res.status(500).json({ success: false, message: '인증 파라미터 생성 실패' });
  }
});

// GET /api/imagekit/list?path=&searchQuery=&skip=&limit=
//   미디어 라이브러리 브라우징.
//   · ImageKit GET /v1/files/ 의 type 기본값은 'file' 이라 폴더가 빠진다.
//     폴더 탐색을 위해 검색이 아닐 때는 type:'all' 로 폴더+파일을 함께 받는다.
//     검색(searchQuery) 중에는 파일명 검색 의미를 보존하기 위해 type 미지정(파일만).
//   · 폴더 항목은 { type:'folder', folderId, name, folderPath } 형태로 url/size 가 없다.
//     프론트는 type 으로 분기해 방어적으로 처리한다.
router.get('/list', async (req, res) => {
  try {
    const { path = '', searchQuery = '', skip = '0', limit = '40' } = req.query;

    const options = {
      skip: Math.max(0, parseInt(skip, 10) || 0),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 40)),
      sort: 'DESC_CREATED',
    };
    if (path) options.path = path;
    if (searchQuery) {
      options.searchQuery = searchQuery; // 파일명 검색 — 파일만(type 미지정)
    } else {
      options.type = 'all'; // 폴더 탐색 — 폴더 + 파일 함께 반환
    }

    const files = await imagekit.listFiles(options);
    res.json({ success: true, files });
  } catch (error) {
    console.error('ImageKit listFiles 오류:', error.message);
    res.status(500).json({ success: false, message: '파일 목록 조회 실패' });
  }
});

// GET /api/imagekit/usage
//   라이브러리 사용 용량 합산. type:'file' 만(폴더/버전 제외) 페이지네이션으로 전부
//   순회하며 size 합산 → { totalBytes, fileCount }.
//   · 현재 버전 파일 합계 기준(file-version 미포함).
//   · 무료 한도 3GB 기준 퍼센트는 프론트에서 계산.
//   · ~983개 규모면 limit 1000 으로 보통 1~2 콜. 안전상 최대 콜 수를 제한한다.
router.get('/usage', async (req, res) => {
  try {
    const PAGE = 1000; // ImageKit listFiles limit 최대값
    const MAX_CALLS = 50; // 무한 루프 방지 가드(최대 5만 개)
    let totalBytes = 0;
    let fileCount = 0;
    let skip = 0;
    let calls = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = await imagekit.listFiles({
        type: 'file',
        limit: PAGE,
        skip,
        sort: 'DESC_CREATED',
      });
      calls += 1;
      for (const f of batch) {
        if (typeof f.size === 'number') totalBytes += f.size;
        fileCount += 1;
      }
      if (batch.length < PAGE || calls >= MAX_CALLS) break;
      skip += PAGE;
    }

    res.json({ success: true, totalBytes, fileCount });
  } catch (error) {
    console.error('ImageKit usage 집계 오류:', error.message);
    res.status(500).json({ success: false, message: '용량 조회 실패' });
  }
});

// DELETE /api/imagekit/file/:fileId
router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).json({ success: false, message: 'fileId 가 필요합니다.' });
    }
    await imagekit.deleteFile(fileId);
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch (error) {
    console.error('ImageKit deleteFile 오류:', error.message);
    res.status(500).json({ success: false, message: '파일 삭제 실패' });
  }
});

// DELETE /api/imagekit/folder — 폴더 삭제(안의 파일/하위폴더까지 모두 재귀 삭제).
//   · folderPath 는 body 로 받는다(경로에 슬래시가 있어 URL 파라미터로 받기 부적합).
//   · 결합 인증(requireImagekitAccess) 뒤 — 사이트 admin 또는 꿈다락 편집자. 공개는 401 로 차단.
//   · 루트('/') 삭제는 거부(라이브러리 전체 삭제 방지). 빈/경로조작 값도 거부.
//   · ImageKit deleteFolder 는 비어있지 않은 폴더도 내용물째 삭제한다(프론트에서 경고 필수).
router.delete('/folder', async (req, res) => {
  try {
    const raw = typeof req.body?.folderPath === 'string' ? req.body.folderPath.trim() : '';
    if (!raw) {
      return res.status(400).json({ success: false, message: 'folderPath 가 필요합니다.' });
    }
    if (raw.includes('..') || /[\x00-\x1f]/.test(raw)) {
      return res.status(400).json({ success: false, message: '폴더 경로에 .. 또는 제어문자는 사용할 수 없습니다.' });
    }
    let norm = raw.startsWith('/') ? raw : `/${raw}`;
    norm = norm.replace(/\/+/g, '/');
    if (norm.length > 1) norm = norm.replace(/\/+$/, '');
    if (norm === '/' || norm === '') {
      return res.status(400).json({ success: false, message: '루트 폴더는 삭제할 수 없습니다.' });
    }
    await imagekit.deleteFolder(norm);
    res.json({ success: true, message: '폴더가 삭제되었습니다.', folderPath: norm });
  } catch (error) {
    const msg = error?.message || '';
    console.error('ImageKit deleteFolder 오류:', msg);
    const notFound = /not\s*found|no\s*such|does\s*not\s*exist/i.test(msg);
    res.status(notFound ? 404 : 500).json({
      success: false,
      message: notFound ? '폴더를 찾을 수 없습니다(이미 삭제되었을 수 있습니다).' : '폴더 삭제에 실패했습니다.',
    });
  }
});

// POST /api/imagekit/folder
//   현재 경로(parentFolderPath) 아래에 새 폴더 생성.
//   · 폴더명 검증: 빈 값 거부, 슬래시(/)·역슬래시·'..' 등 경로조작 문자 거부.
//   · 한글/특수문자 등은 ImageKit 규칙에 맡기되, 실패 시 메시지를 그대로 전달.
//   · 결합 인증(requireImagekitAccess) + imagekit 가드를 적용받는다(꿈다락 편집자 허용).
router.post('/folder', async (req, res) => {
  try {
    const rawName = typeof req.body?.folderName === 'string' ? req.body.folderName.trim() : '';
    const parentFolderPath =
      typeof req.body?.parentFolderPath === 'string' && req.body.parentFolderPath.trim()
        ? req.body.parentFolderPath.trim()
        : '/';

    if (!rawName) {
      return res.status(400).json({ success: false, message: '폴더 이름을 입력해주세요.' });
    }
    // 경로조작/구분자 차단: 슬래시·역슬래시·'..'·제어문자.
    if (/[\\/]/.test(rawName) || rawName.includes('..') || /[\x00-\x1f]/.test(rawName)) {
      return res.status(400).json({
        success: false,
        message: '폴더 이름에 / \\ .. 또는 제어문자는 사용할 수 없습니다.',
      });
    }
    if (rawName.length > 255) {
      return res.status(400).json({ success: false, message: '폴더 이름이 너무 깁니다.' });
    }

    await imagekit.createFolder({ folderName: rawName, parentFolderPath });
    res.json({ success: true, message: '폴더가 생성되었습니다.', folderName: rawName, parentFolderPath });
  } catch (error) {
    const msg = error?.message || '';
    console.error('ImageKit createFolder 오류:', msg);
    // ImageKit 이름 규칙 위반 등은 400 으로, 그 외는 500.
    const isNameRule = /name|invalid|character|allowed/i.test(msg);
    res.status(isNameRule ? 400 : 500).json({
      success: false,
      message: isNameRule
        ? `폴더 생성 실패: ${msg}`
        : '폴더 생성에 실패했습니다. 이름 규칙(영문/숫자/-/_ 권장)을 확인해주세요.',
    });
  }
});

module.exports = router;
