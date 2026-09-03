// backend/routes/imagekit.js 를 "실제 파일 그대로" 마운트하는 최소 하네스.
//   목적: 인증 가드 · 입력 검증 · 라우팅 · 오류 매핑을 실제로 호출해 관찰한다.
//   ImageKit 키는 로컬 .env 에 비어 있으므로(IMAGEKIT_PUBLIC_KEY/PRIVATE_KEY = 빈 값)
//   두 가지 모드로 돌린다:
//     MODE=nokeys  → 키 없음. 503 가드 동작 확인.
//     MODE=dummy   → 더미 키. SDK 초기화 → 입력 검증 경로까지 도달(실제 ImageKit 호출은
//                    상류 401 로 실패하며, 그 오류 매핑과 키 비노출을 확인한다).
const path = require('path');
const BACKEND = path.resolve(__dirname, '../../../backend');
const express = require(path.join(BACKEND, 'node_modules/express'));

process.env.JWT_SECRET = 'harness-test-secret-not-a-real-secret';
if (process.env.MODE === 'dummy') {
  process.env.IMAGEKIT_PUBLIC_KEY = 'public_dummy_for_harness';
  process.env.IMAGEKIT_PRIVATE_KEY = 'private_dummy_for_harness';
  process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/harness';
} else {
  delete process.env.IMAGEKIT_PUBLIC_KEY;
  delete process.env.IMAGEKIT_PRIVATE_KEY;
  delete process.env.IMAGEKIT_URL_ENDPOINT;
}

const router = require(path.join(BACKEND, 'routes/imagekit.js'));
const app = express();
app.use('/api/imagekit', express.json({ limit: '100kb' }), router);
const port = Number(process.env.PORT || 8123);
app.listen(port, () => console.log(`harness(${process.env.MODE}) listening on ${port}`));
