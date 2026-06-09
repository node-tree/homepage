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
router.get('/list', async (req, res) => {
  try {
    const { path = '', searchQuery = '', skip = '0', limit = '40' } = req.query;

    const options = {
      skip: Math.max(0, parseInt(skip, 10) || 0),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 40)),
      sort: 'DESC_CREATED',
    };
    if (path) options.path = path;
    if (searchQuery) options.searchQuery = searchQuery;

    const files = await imagekit.listFiles(options);
    res.json({ success: true, files });
  } catch (error) {
    console.error('ImageKit listFiles 오류:', error.message);
    res.status(500).json({ success: false, message: '파일 목록 조회 실패' });
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
