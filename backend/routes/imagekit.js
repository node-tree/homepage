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
const axios = require('axios');
const mongoose = require('mongoose');
const ImageKit = require('imagekit');

const ikRefs = require('../lib/ikRefs');
const ikRefsDb = require('../lib/ikRefsDb');

const router = express.Router();

// ImageKit REST 베이스 — SDK 미지원 엔드포인트(폴더 이름변경)만 직접 호출한다.
const IK_API_BASE = 'https://api.imagekit.io/v1';

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
//   예외: /refs* 는 ImageKit 을 전혀 호출하지 않고 자체 DB 만 읽고 쓴다.
//   키가 비어 있어도 "어디서 참조 중인지" 조회와 롤백은 동작해야 하므로 통과시킨다.
const REFS_ONLY = /^\/refs(\/|$)/;
router.use((req, res, next) => {
  if (!imagekit && !REFS_ONLY.test(req.path)) {
    return res.status(503).json({
      success: false,
      message: 'ImageKit 환경변수가 서버에 설정되지 않았습니다.',
    });
  }
  next();
});

// ═══ 공용 유틸 ═══════════════════════════════════════════════════
//   경로 검증·정규화와 오류 전달을 한 곳에 모은다. 모든 파괴적 라우트(이동·이름변경·
//   삭제)는 여기를 통과한 경로만 ImageKit 으로 보낸다.

// 경로 정규화: 항상 '/' 시작, 중복 슬래시 합치기, 끝 슬래시 제거(루트 제외).
//   거부: 빈 값 · '..' · 역슬래시 · 제어문자 · 1024자 초과 · (allowRoot 아니면) 루트.
//   반환: { path } 또는 { error }
function normFolderPath(raw, { allowRoot = false } = {}) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return { error: '경로가 비어 있습니다.' };
  if (s.includes('..')) return { error: '경로에 .. 는 사용할 수 없습니다.' };
  if (s.includes('\\')) return { error: '경로에 역슬래시(\\)는 사용할 수 없습니다.' };
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(s)) return { error: '경로에 제어문자는 사용할 수 없습니다.' };
  if (s.length > 1024) return { error: '경로가 너무 깁니다.' };
  let out = s.startsWith('/') ? s : `/${s}`;
  out = out.replace(/\/+/g, '/');
  if (out.length > 1) out = out.replace(/\/+$/, '');
  if (out === '/' && !allowRoot) {
    return { error: '루트(/) 경로에는 이 작업을 수행할 수 없습니다.' };
  }
  return { path: out };
}

// 파일 경로 — 폴더 규칙과 동일하되 루트 불가.
function normFilePath(raw) {
  const r = normFolderPath(raw);
  if (r.error) return r;
  return r;
}

// 이름(폴더명/파일명) 검증 — 경로 구분자·'..'·제어문자 차단.
function checkName(raw, label) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return { error: `${label}을(를) 입력해주세요.` };
  // eslint-disable-next-line no-control-regex
  if (/[\\/]/.test(s) || s.includes('..') || /[\x00-\x1f]/.test(s)) {
    return { error: `${label}에 / \\ .. 또는 제어문자는 사용할 수 없습니다.` };
  }
  if (s.length > 255) return { error: `${label}이(가) 너무 깁니다.` };
  return { name: s };
}

// ImageKit 오류 메시지를 그대로 전달하되, 만에 하나라도 키가 섞이지 않게 마스킹한다.
function safeMessage(error) {
  let msg = (error && (error.message || error.help)) || '';
  msg = String(msg);
  for (const secret of [PRIVATE_KEY, PUBLIC_KEY]) {
    if (secret && secret.length > 8) msg = msg.split(secret).join('***');
  }
  return msg;
}

// ImageKit SDK/REST 오류 → HTTP 응답. 상태코드는 ImageKit 응답을 최대한 존중한다.
function sendIkError(res, error, fallback) {
  const msg = safeMessage(error);
  const upstream =
    (error && error.$ResponseMetadata && error.$ResponseMetadata.statusCode) ||
    (error && error.response && error.response.status) ||
    null;
  let status = 500;
  if (upstream && upstream >= 400 && upstream < 600) status = upstream === 401 || upstream === 403 ? 502 : upstream;
  else if (/not\s*found|no\s*such|does\s*not\s*exist/i.test(msg)) status = 404;
  else if (/invalid|already exists|not allowed|character|missing/i.test(msg)) status = 400;
  console.error(`ImageKit 오류(${fallback}):`, msg);
  return res.status(status).json({ success: false, message: msg || fallback });
}

// listFiles sort 화이트리스트 — 임의 문자열을 그대로 넘기지 않는다.
const SORT_WHITELIST = new Set([
  'ASC_NAME', 'DESC_NAME',
  'ASC_CREATED', 'DESC_CREATED',
  'ASC_UPDATED', 'DESC_UPDATED',
  'ASC_SIZE', 'DESC_SIZE',
  'ASC_HEIGHT', 'DESC_HEIGHT',
  'ASC_WIDTH', 'DESC_WIDTH',
]);
function pickSort(raw, fallback = 'DESC_CREATED') {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return SORT_WHITELIST.has(s) ? s : fallback;
}

// SDK 미지원 엔드포인트용 Basic 인증 헤더(private key). 응답에 절대 싣지 않는다.
function ikBasicAuthHeader() {
  return `Basic ${Buffer.from(`${PRIVATE_KEY}:`).toString('base64')}`;
}

// ═══ DB 참조 자동 치환 ═══════════════════════════════════════════
//   ImageKit 은 경로 기반 URL 이라 이동/이름변경 즉시 기존 URL 이 죽는다.
//   자체 DB(356건 실측)에 그 URL 이 문자열로 박혀 있으므로 함께 갱신해야 글이 안 깨진다.

/** mongoose 연결에서 native Db 를 얻는다. 연결이 없으면 null. */
function getDb() {
  return mongoose.connection && mongoose.connection.readyState === 1
    ? mongoose.connection.db
    : null;
}

function actorOf(req) {
  if (req.user) return `admin:${req.user.username || req.user.id || 'unknown'}`;
  if (req.kkumdarak) return 'kkumdarak';
  return 'unknown';
}

/**
 * ImageKit 이동이 성공한 뒤 DB 참조를 갱신한다.
 *   · updateRefs 가 false 면 건너뛴다(응답에 skipped 표시).
 *   · DB 미연결이면 실패로 보고하되 이동 자체는 성공으로 둔다(호출측이 판단).
 *   반환: { updated, skipped?, error?, batchId, refsUpdated, documents, failures }
 */
async function updateRefsAfterMove(req, mappings) {
  if (req.body?.updateRefs === false) {
    return { updated: false, skipped: true, reason: 'updateRefs=false 로 요청됨' };
  }
  const db = getDb();
  if (!db) {
    return { updated: false, error: 'DB 에 연결되어 있지 않아 참조를 갱신하지 못했습니다.' };
  }
  const r = await ikRefsDb.applyMappings(db, mappings, { actor: actorOf(req) });
  return {
    updated: true,
    batchId: r.batchId,
    refsUpdated: r.refsUpdated,
    documents: r.documents,
    failures: r.failures,
  };
}

/**
 * ImageKit 이동은 됐는데 DB 치환이 터진 경우의 보상 이동(되돌리기).
 *   revert 는 실제 ImageKit 호출을 수행하는 함수. 실패해도 예외를 밖으로 던지지 않는다.
 */
/**
 * 폴더 이동/이름변경(bulkJob) 완료 대기.
 *   DB 참조를 고치기 전에 실제 파일 이동이 끝났는지 확인하기 위함.
 *   타임아웃이면 false — 호출측이 "작업은 진행 중" 임을 응답에 담는다.
 */
async function waitForBulkJob(jobId, timeoutMs = 20000, intervalMs = 1200) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const job = await imagekit.getBulkJobStatus(jobId);
      if (String(job?.status || '').toLowerCase() === 'completed') return true;
    } catch {
      /* 폴링 실패는 무시하고 재시도 — 작업 자체는 ImageKit 에서 계속 진행된다. */
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function compensate(revert) {
  try {
    await revert();
    return { compensated: true };
  } catch (e) {
    return { compensated: false, compensateError: safeMessage(e) };
  }
}

// 소스 하드코딩 참조 목록(빌드 시점 grep 결과). 없으면 빈 값으로 동작.
let CODE_REFS = { total: 0, byPath: {}, byFile: {}, generatedAt: null };
try {
  // eslint-disable-next-line global-require
  CODE_REFS = require('../data/ikCodeRefs.json');
} catch {
  console.warn('⚠️ backend/data/ikCodeRefs.json 없음 — 코드 참조 안내가 비활성화됩니다. `node backend/scripts/scanCodeRefs.js` 로 생성하세요.');
}

/** 경로(파일/폴더)에 걸리는 코드 하드코딩 참조 */
function codeRefsFor(canon, kind) {
  const out = [];
  for (const [p, list] of Object.entries(CODE_REFS.byPath || {})) {
    const hit = kind === 'file' ? p === canon : p === canon || p.startsWith(`${canon}/`);
    if (hit) out.push(...list.map((l) => ({ ...l, path: p })));
  }
  return out;
}

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

// GET /api/imagekit/list?path=&searchQuery=&skip=&limit=&sort=
//   미디어 라이브러리 브라우징.
//   · ImageKit GET /v1/files/ 의 type 기본값은 'file' 이라 폴더가 빠진다.
//     폴더 탐색을 위해 검색이 아닐 때는 type:'all' 로 폴더+파일을 함께 받는다.
//     검색(searchQuery) 중에는 파일명 검색 의미를 보존하기 위해 type 미지정(파일만).
//     — ImageKit 문서: searchQuery 가 있으면 type/name/tags 파라미터는 무시된다.
//   · 폴더 항목은 { type:'folder', folderId, name, folderPath } 형태로 url/size 가 없다.
//     프론트는 type 으로 분기해 방어적으로 처리한다.
//   · sort 는 화이트리스트(ASC_NAME/DESC_CREATED/ASC_SIZE…)만 허용. 기본 DESC_CREATED.
//   · path 를 생략하면 라이브러리 전체가 검색 대상 → 프론트의 "전역 검색".
router.get('/list', async (req, res) => {
  try {
    const { path = '', searchQuery = '', skip = '0', limit = '40', sort = '' } = req.query;

    const options = {
      skip: Math.max(0, parseInt(skip, 10) || 0),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 40)),
      sort: pickSort(sort),
    };
    if (path) {
      const p = normFolderPath(path, { allowRoot: true });
      if (p.error) return res.status(400).json({ success: false, message: p.error });
      if (p.path !== '/') options.path = p.path;
    }
    if (searchQuery) {
      options.searchQuery = searchQuery; // 파일명 검색 — 파일만(type 무시됨)
    } else {
      options.type = 'all'; // 폴더 탐색 — 폴더 + 파일 함께 반환
    }

    const files = await imagekit.listFiles(options);
    res.json({ success: true, files });
  } catch (error) {
    return sendIkError(res, error, '파일 목록 조회 실패');
  }
});

// GET /api/imagekit/folders?path=&all=1
//   폴더 전용 목록 — 사이드 트리의 지연 로드/경로 자동완성 소스.
//   · 기본: path 의 하위 폴더. path 생략/루트면 최상위.
//   · all=1: path 없이 조회해 라이브러리 폴더를 한 번에 받는다(자동완성·폴더 검색용).
//     ImageKit 응답 범위가 최상위로 한정될 수 있으므로 프론트는 트리 지연 로드 결과와
//     합집합으로 다룬다(어느 쪽이든 동작하도록 방어).
//   · 파일은 제외(type:'folder') → 페이로드가 작아 트리 확장이 가볍다.
router.get('/folders', async (req, res) => {
  try {
    const { path = '', all = '' } = req.query;
    const options = { type: 'folder', limit: 1000, sort: 'ASC_NAME' };
    if (all !== '1' && path) {
      const p = normFolderPath(path, { allowRoot: true });
      if (p.error) return res.status(400).json({ success: false, message: p.error });
      if (p.path !== '/') options.path = p.path;
    }
    const rows = await imagekit.listFiles(options);
    const folders = (rows || [])
      .filter((f) => f && (f.folderPath || f.type === 'folder'))
      .map((f) => ({
        folderId: f.folderId,
        name: f.name,
        folderPath: f.folderPath,
        type: 'folder',
      }));
    res.json({ success: true, folders });
  } catch (error) {
    return sendIkError(res, error, '폴더 목록 조회 실패');
  }
});

// GET /api/imagekit/file/:fileId — 파일 상세(크기·해상도·태그·경로·버전 등).
//   상세 패널에서 1건씩 호출. 목록 응답에 없는 tags/updatedAt/mime 을 채운다.
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!fileId) return res.status(400).json({ success: false, message: 'fileId 가 필요합니다.' });
    const file = await imagekit.getFileDetails(fileId);
    res.json({ success: true, file });
  } catch (error) {
    return sendIkError(res, error, '파일 상세 조회 실패');
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

// ═══ DB/코드 참조 조회 · 롤백 ════════════════════════════════════

// POST /api/imagekit/refs  { paths: [], kinds?: {path:'file'|'folder'} }
//   이동/이름변경 전에 "이 경로를 참조하는 곳이 몇 군데인가"를 보여주기 위한 조회.
//   · DB: 전 컬렉션 재귀 스캔 인덱스(60초 캐시)에서 조회. 폴더면 하위까지 합산.
//   · 코드: 빌드 시점 grep 결과(ikCodeRefs.json) — 자동 치환 불가, 수동 안내용.
router.post('/refs', async (req, res) => {
  const paths = Array.isArray(req.body?.paths) ? req.body.paths.filter((p) => typeof p === 'string') : [];
  if (paths.length === 0) {
    return res.status(400).json({ success: false, message: '조회할 경로가 필요합니다.' });
  }
  if (paths.length > 200) {
    return res.status(400).json({ success: false, message: '한 번에 최대 200개까지 조회할 수 있습니다.' });
  }
  const kinds = req.body?.kinds && typeof req.body.kinds === 'object' ? req.body.kinds : {};
  const db = getDb();
  if (!db) {
    return res.status(503).json({ success: false, message: 'DB 에 연결되어 있지 않습니다.' });
  }
  try {
    const rows = await ikRefsDb.findRefs(db, paths, { kinds, force: req.body?.force === true });
    const items = rows.map((r) => {
      const code = codeRefsFor(r.path, r.kind === 'folder' ? 'folder' : 'file');
      return {
        path: r.path,
        kind: r.kind,
        db: { count: r.count, byCollection: r.byCollection, refs: r.refs.slice(0, 200) },
        code: { count: code.length, refs: code.slice(0, 50) },
      };
    });
    const totalDb = items.reduce((s, i) => s + i.db.count, 0);
    const totalCode = items.reduce((s, i) => s + i.code.count, 0);
    res.json({
      success: true,
      items,
      totalDb,
      totalCode,
      codeRefsGeneratedAt: CODE_REFS.generatedAt || null,
    });
  } catch (error) {
    console.error('ImageKit refs 조회 오류:', error.message);
    res.status(500).json({ success: false, message: '참조 조회에 실패했습니다.' });
  }
});

// GET /api/imagekit/refs/logs?limit=&batchId= — 치환 로그 목록(롤백 대상 확인)
router.get('/refs/logs', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, message: 'DB 에 연결되어 있지 않습니다.' });
  try {
    const logs = await ikRefsDb.listLogs(db, {
      limit: parseInt(req.query.limit, 10) || 50,
      batchId: req.query.batchId,
    });
    res.json({ success: true, logs });
  } catch (error) {
    console.error('ImageKit refs 로그 조회 오류:', error.message);
    res.status(500).json({ success: false, message: '로그 조회에 실패했습니다.' });
  }
});

// POST /api/imagekit/refs/rollback  { logId } 또는 { batchId }
//   치환 전 원본 문서를 그대로 복원한다. ImageKit 파일 자체는 되돌리지 않는다(안내 문구 참고).
router.post('/refs/rollback', async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ success: false, message: 'DB 에 연결되어 있지 않습니다.' });
  const { logId, batchId } = req.body || {};
  if (!logId && !batchId) {
    return res.status(400).json({ success: false, message: 'logId 또는 batchId 가 필요합니다.' });
  }
  try {
    const r = await ikRefsDb.rollback(db, { logId, batchId });
    res.json({
      success: true,
      message: `${r.entries}건의 문서를 치환 이전 상태로 복원했습니다.`,
      ...r,
      note: 'DB 참조만 복원했습니다. ImageKit 파일 위치는 그대로이므로 필요하면 파일도 되돌려야 합니다.',
    });
  } catch (error) {
    const status = error.status || 500;
    console.error('ImageKit refs 롤백 오류:', error.message);
    res.status(status).json({ success: false, message: error.message || '롤백에 실패했습니다.' });
  }
});

// ═══ 이동 · 이름변경 · 일괄 작업 ═════════════════════════════════
//   ⚠️ 이동/이름변경은 ImageKit 의 URL(경로 기반)을 즉시 바꾼다. 기존 URL 을 참조하는
//      게시물은 깨질 수 있으므로 프론트에서 경고를 반드시 노출한다.
//   모든 라우트는 상단 requireImagekitAccess + imagekit 가드를 그대로 상속받는다.

// POST /api/imagekit/file/move  { sourceFilePath, destinationPath }
//   ImageKit POST /v1/files/move. destinationPath 는 "폴더" 경로다.
router.post('/file/move', async (req, res) => {
  const src = normFilePath(req.body?.sourceFilePath);
  if (src.error) return res.status(400).json({ success: false, message: `원본 ${src.error}` });
  const dst = normFolderPath(req.body?.destinationPath, { allowRoot: true });
  if (dst.error) return res.status(400).json({ success: false, message: `대상 ${dst.error}` });

  const srcParent = src.path.slice(0, src.path.lastIndexOf('/')) || '/';
  if (srcParent === dst.path) {
    return res.status(400).json({ success: false, message: '이미 같은 폴더에 있는 파일입니다.' });
  }
  try {
    await imagekit.moveFile({ sourceFilePath: src.path, destinationPath: dst.path });
    // ImageKit 이동 성공 → DB 참조 갱신. 실패 시 파일을 원위치로 되돌린다(보상).
    const mappings = [ikRefs.fileMoveMapping(src.path, dst.path)];
    let refs;
    try {
      refs = await updateRefsAfterMove(req, mappings);
    } catch (dbErr) {
      const comp = await compensate(() =>
        imagekit.moveFile({ sourceFilePath: mappings[0].to, destinationPath: srcParent })
      );
      return res.status(500).json({
        success: false,
        message: `파일은 이동했지만 DB 참조 갱신에 실패했습니다: ${safeMessage(dbErr)}`,
        ...comp,
      });
    }
    res.json({
      success: true,
      message: '이동되었습니다.',
      sourceFilePath: src.path,
      destinationPath: dst.path,
      refs,
    });
  } catch (error) {
    return sendIkError(res, error, '파일 이동 실패');
  }
});

// POST /api/imagekit/file/copy  { sourceFilePath, destinationPath, includeVersions? }
//   ImageKit POST /v1/files/copy. 원본은 남는다(용량 증가에 유의).
router.post('/file/copy', async (req, res) => {
  const src = normFilePath(req.body?.sourceFilePath);
  if (src.error) return res.status(400).json({ success: false, message: `원본 ${src.error}` });
  const dst = normFolderPath(req.body?.destinationPath, { allowRoot: true });
  if (dst.error) return res.status(400).json({ success: false, message: `대상 ${dst.error}` });
  try {
    await imagekit.copyFile({
      sourceFilePath: src.path,
      destinationPath: dst.path,
      includeFileVersions: req.body?.includeVersions === true,
    });
    res.json({ success: true, message: '복사되었습니다.', sourceFilePath: src.path, destinationPath: dst.path });
  } catch (error) {
    return sendIkError(res, error, '파일 복사 실패');
  }
});

// PUT /api/imagekit/file/rename  { filePath, newFileName, purgeCache? }
//   ImageKit PUT /v1/files/rename. 모든 버전의 이름이 바뀌고 기존 URL 은 즉시 무효화된다.
//   purgeCache:true 면 CDN 캐시 퍼지 요청까지 발행(purgeRequestId 반환).
router.put('/file/rename', async (req, res) => {
  const src = normFilePath(req.body?.filePath);
  if (src.error) return res.status(400).json({ success: false, message: `원본 ${src.error}` });
  const nm = checkName(req.body?.newFileName, '새 파일 이름');
  if (nm.error) return res.status(400).json({ success: false, message: nm.error });

  const currentName = src.path.slice(src.path.lastIndexOf('/') + 1);
  if (currentName === nm.name) {
    return res.status(400).json({ success: false, message: '기존 이름과 동일합니다.' });
  }
  try {
    const result = await imagekit.renameFile({
      filePath: src.path,
      newFileName: nm.name,
      purgeCache: req.body?.purgeCache === true,
    });
    const mappings = [ikRefs.fileRenameMapping(src.path, nm.name)];
    let refs;
    try {
      refs = await updateRefsAfterMove(req, mappings);
    } catch (dbErr) {
      const comp = await compensate(() =>
        imagekit.renameFile({ filePath: mappings[0].to, newFileName: currentName })
      );
      return res.status(500).json({
        success: false,
        message: `이름은 변경했지만 DB 참조 갱신에 실패했습니다: ${safeMessage(dbErr)}`,
        ...comp,
      });
    }
    res.json({
      success: true,
      message: '이름이 변경되었습니다.',
      newFileName: nm.name,
      purgeRequestId: (result && result.purgeRequestId) || undefined,
      refs,
    });
  } catch (error) {
    return sendIkError(res, error, '파일 이름 변경 실패');
  }
});

// POST /api/imagekit/files/bulk-delete  { fileIds: [] }
//   ImageKit POST /v1/files/batch/deleteByFileIds. 한 번에 최대 100개.
router.post('/files/bulk-delete', async (req, res) => {
  const ids = Array.isArray(req.body?.fileIds) ? req.body.fileIds.filter((v) => typeof v === 'string' && v.trim()) : [];
  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: '삭제할 파일을 선택해주세요.' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ success: false, message: '한 번에 최대 100개까지 삭제할 수 있습니다.' });
  }
  try {
    const result = await imagekit.bulkDeleteFiles(ids);
    res.json({
      success: true,
      message: `${ids.length}개를 삭제했습니다.`,
      successfullyDeletedFileIds: (result && result.successfullyDeletedFileIds) || ids,
    });
  } catch (error) {
    // 일부 fileId 가 없을 때 ImageKit 은 missingFileIds 를 함께 준다 — 그대로 전달.
    const missing = (error && error.missingFileIds) || undefined;
    const msg = safeMessage(error);
    console.error('ImageKit bulkDeleteFiles 오류:', msg);
    return res.status(400).json({ success: false, message: msg || '일괄 삭제 실패', missingFileIds: missing });
  }
});

// POST /api/imagekit/files/bulk-move  { sourceFilePaths: [], destinationPath }
//   ImageKit 에는 일괄 이동 API 가 없다 → 서버에서 순차 moveFile 하고 항목별 결과를 모아
//   한 번의 응답으로 돌려준다(프론트가 N번 왕복하지 않도록. Render 콜드스타트 고려).
//   부분 성공을 허용하며 실패 항목은 results[].error 로 전달한다.
router.post('/files/bulk-move', async (req, res) => {
  const rawPaths = Array.isArray(req.body?.sourceFilePaths) ? req.body.sourceFilePaths : [];
  if (rawPaths.length === 0) {
    return res.status(400).json({ success: false, message: '이동할 파일을 선택해주세요.' });
  }
  if (rawPaths.length > 100) {
    return res.status(400).json({ success: false, message: '한 번에 최대 100개까지 이동할 수 있습니다.' });
  }
  const dst = normFolderPath(req.body?.destinationPath, { allowRoot: true });
  if (dst.error) return res.status(400).json({ success: false, message: `대상 ${dst.error}` });

  const results = [];
  for (const raw of rawPaths) {
    const src = normFilePath(raw);
    if (src.error) {
      results.push({ sourceFilePath: String(raw), ok: false, error: src.error });
      continue;
    }
    try {
      await imagekit.moveFile({ sourceFilePath: src.path, destinationPath: dst.path });
      results.push({ sourceFilePath: src.path, ok: true });
    } catch (error) {
      results.push({ sourceFilePath: src.path, ok: false, error: safeMessage(error) || '이동 실패' });
    }
  }
  const moved = results.filter((r) => r.ok).length;
  const firstError = results.find((r) => !r.ok)?.error;

  // 실제로 옮겨진 파일만 매핑에 넣는다(실패한 건 URL 이 그대로이므로 치환하면 안 된다).
  let refs = { updated: false, reason: '이동된 파일이 없습니다.' };
  if (moved > 0) {
    const mappings = results
      .filter((r) => r.ok)
      .map((r) => ikRefs.fileMoveMapping(r.sourceFilePath, dst.path));
    try {
      refs = await updateRefsAfterMove(req, mappings);
    } catch (dbErr) {
      refs = { updated: false, error: safeMessage(dbErr) };
    }
  }

  res.json({
    success: moved > 0,
    // 전부 실패했으면 프론트가 그대로 오류로 띄우므로 사유를 메시지에 담는다.
    message: moved === 0 ? `이동 실패: ${firstError || '알 수 없는 오류'}` : `${moved}/${results.length}개 이동 완료`,
    destinationPath: dst.path,
    results,
    refs,
  });
});

// POST /api/imagekit/folder/move  { sourceFolderPath, destinationPath }
//   ImageKit POST /v1/bulkJobs/moveFolder — 비동기. jobId 를 돌려주면
//   프론트가 GET /bulk-job/:jobId 로 완료를 확인한다.
//   · 자기 자신/자기 하위로 이동 금지(무한 중첩 방지).
router.post('/folder/move', async (req, res) => {
  const src = normFolderPath(req.body?.sourceFolderPath);
  if (src.error) return res.status(400).json({ success: false, message: `원본 ${src.error}` });
  const dst = normFolderPath(req.body?.destinationPath, { allowRoot: true });
  if (dst.error) return res.status(400).json({ success: false, message: `대상 ${dst.error}` });

  if (dst.path === src.path || dst.path.startsWith(`${src.path}/`)) {
    return res.status(400).json({ success: false, message: '폴더를 자기 자신이나 하위 폴더로 이동할 수 없습니다.' });
  }
  const srcParent = src.path.slice(0, src.path.lastIndexOf('/')) || '/';
  if (srcParent === dst.path) {
    return res.status(400).json({ success: false, message: '이미 해당 위치에 있는 폴더입니다.' });
  }
  try {
    const result = await imagekit.moveFolder({ sourceFolderPath: src.path, destinationPath: dst.path });
    const jobId = (result && result.jobId) || null;
    // 비동기 작업이라 완료를 기다렸다가 DB 를 고쳐야 한다.
    // 시간 내 완료를 못 봐도 참조는 갱신하되(작업은 서버에서 계속 진행) 그 사실을 알린다.
    const jobCompleted = jobId ? await waitForBulkJob(jobId) : true;
    const mappings = [ikRefs.folderMoveMapping(src.path, dst.path)];
    let refs;
    try {
      refs = await updateRefsAfterMove(req, mappings);
    } catch (dbErr) {
      refs = { updated: false, error: safeMessage(dbErr) };
    }
    res.json({
      success: true,
      message: '폴더 이동을 시작했습니다.',
      jobId,
      jobCompleted,
      sourceFolderPath: src.path,
      destinationPath: dst.path,
      refs,
    });
  } catch (error) {
    return sendIkError(res, error, '폴더 이동 실패');
  }
});

// POST /api/imagekit/folder/rename  { folderPath, newFolderName, purgeCache? }
//   ImageKit POST /v1/bulkJobs/renameFolder — 설치된 SDK(v6)에 메서드가 없어 REST 직접 호출.
//   private key 는 Basic 인증 헤더로만 쓰이고 응답에는 절대 싣지 않는다.
router.post('/folder/rename', async (req, res) => {
  const src = normFolderPath(req.body?.folderPath);
  if (src.error) return res.status(400).json({ success: false, message: `원본 ${src.error}` });
  const nm = checkName(req.body?.newFolderName, '새 폴더 이름');
  if (nm.error) return res.status(400).json({ success: false, message: nm.error });

  const currentName = src.path.slice(src.path.lastIndexOf('/') + 1);
  if (currentName === nm.name) {
    return res.status(400).json({ success: false, message: '기존 이름과 동일합니다.' });
  }
  try {
    const { data } = await axios.post(
      `${IK_API_BASE}/bulkJobs/renameFolder`,
      {
        folderPath: src.path,
        newFolderName: nm.name,
        purgeCache: req.body?.purgeCache === true,
      },
      {
        headers: { Authorization: ikBasicAuthHeader(), 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );
    const jobId = (data && data.jobId) || null;
    const jobCompleted = jobId ? await waitForBulkJob(jobId) : true;
    const mappings = [ikRefs.folderRenameMapping(src.path, nm.name)];
    let refs;
    try {
      refs = await updateRefsAfterMove(req, mappings);
    } catch (dbErr) {
      refs = { updated: false, error: safeMessage(dbErr) };
    }
    res.json({
      success: true,
      message: '폴더 이름 변경을 시작했습니다.',
      jobId,
      jobCompleted,
      folderPath: src.path,
      newFolderName: nm.name,
      refs,
    });
  } catch (error) {
    // axios 오류는 ImageKit 본문 메시지를 우선 노출한다(키는 마스킹).
    const upstreamMsg = error?.response?.data?.message || error?.response?.data?.help;
    if (upstreamMsg) {
      const status = error.response.status;
      console.error('ImageKit renameFolder 오류:', safeMessage({ message: upstreamMsg }));
      return res
        .status(status === 401 || status === 403 ? 502 : status)
        .json({ success: false, message: safeMessage({ message: upstreamMsg }) });
    }
    return sendIkError(res, error, '폴더 이름 변경 실패');
  }
});

// ═══ CDN 캐시 퍼지 ═══════════════════════════════════════════════
//   원본 덮어쓰기(overwriteFile) 후에는 URL 이 그대로라 CDN/브라우저가 옛 이미지를
//   계속 내보낸다 → 퍼지를 명시적으로 요청한다.
//
// POST /api/imagekit/purge  { url }
//   ImageKit POST /v1/files/purge. url 은 반드시 이 계정의 urlEndpoint 하위여야 한다
//   (남의 URL·임의 호스트 퍼지 요청 차단).
router.post('/purge', async (req, res) => {
  const raw = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!raw) {
    return res.status(400).json({ success: false, message: '퍼지할 URL 이 필요합니다.' });
  }
  if (!/^https:\/\//i.test(raw)) {
    return res.status(400).json({ success: false, message: 'https URL 만 퍼지할 수 있습니다.' });
  }
  // 쿼리(?tr=…)는 떼고 원본 경로만 퍼지한다 — 변환본은 원본 퍼지에 따라 갱신된다.
  const base = raw.split('?')[0].split('#')[0];
  const endpoint = String(URL_ENDPOINT || '').replace(/\/+$/, '');
  if (!endpoint || !base.startsWith(`${endpoint}/`)) {
    return res.status(400).json({
      success: false,
      message: '이 계정의 ImageKit URL 만 퍼지할 수 있습니다.',
    });
  }
  try {
    const result = await imagekit.purgeCache(base);
    res.json({
      success: true,
      message: 'CDN 캐시 퍼지를 요청했습니다.',
      requestId: (result && result.requestId) || null,
      url: base,
    });
  } catch (error) {
    return sendIkError(res, error, 'CDN 캐시 퍼지 실패');
  }
});

// GET /api/imagekit/purge/:requestId — 퍼지 진행 상태.
router.get('/purge/:requestId', async (req, res) => {
  const { requestId } = req.params;
  if (!requestId || !/^[A-Za-z0-9_-]{1,64}$/.test(requestId)) {
    return res.status(400).json({ success: false, message: '유효하지 않은 requestId 입니다.' });
  }
  try {
    const status = await imagekit.getPurgeCacheStatus(requestId);
    res.json({ success: true, status });
  } catch (error) {
    return sendIkError(res, error, '퍼지 상태 조회 실패');
  }
});

// GET /api/imagekit/bulk-job/:jobId — moveFolder/renameFolder 진행 상태 폴링.
//   응답: { status: 'Pending' | 'Completed', ... } (ImageKit 원문 그대로 전달)
router.get('/bulk-job/:jobId', async (req, res) => {
  const { jobId } = req.params;
  if (!jobId || !/^[A-Za-z0-9_-]{1,64}$/.test(jobId)) {
    return res.status(400).json({ success: false, message: '유효하지 않은 jobId 입니다.' });
  }
  try {
    const job = await imagekit.getBulkJobStatus(jobId);
    res.json({ success: true, job });
  } catch (error) {
    return sendIkError(res, error, '작업 상태 조회 실패');
  }
});

module.exports = router;
