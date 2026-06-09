// ═══════════════════════════════════════════════════════════════
// ImageKit 관리자 라우트
//   · 모든 엔드포인트는 auth + adminOnly 미들웨어 뒤 = admin 계정만 접근 가능.
//     (공개 /api/auth/register 로 자가가입한 role:'user' 는 차단 — 403.)
//   · private key 는 서버에서만 사용. publicKey/urlEndpoint 는 공개값이므로
//     프론트 업로드(서명방식)에 필요해 /auth 응답에 함께 내려준다.
//   · 자체 DB 저장 없음 — ImageKit 미디어 라이브러리가 단일 소스.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const ImageKit = require('imagekit');
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

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

// 1) 로그인 필수(JWT 검증)
router.use(auth);
// 2) admin 권한 필수(role !== 'admin' → 403). 일반 user 의 업로드/조회/삭제 차단.
router.use(adminOnly);

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

module.exports = router;
