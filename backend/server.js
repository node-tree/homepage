const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 환경변수 로드
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// 보안 헤더
app.use(helmet());

// Rate Limiting — 전역: 15분당 100회
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

// 로그인 전용: 15분당 10회
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' }
});

// 연락처 전송: 1시간당 5회
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '메시지 전송이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

app.use(globalLimiter);

// CORS — 허용 도메인을 명시적으로 제한
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://nodetree.kr',
        'https://www.nodetree.kr',
        'https://saengsanso.com',
        'https://www.saengsanso.com',
        'https://nodetree-home.vercel.app'
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB 연결 (별도 모듈 — 순환 참조 방지 + 서버리스 연결 캐싱)
const connectDB = require('./db');

// 연결 상태 모니터링
mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB 연결됨');
});

mongoose.connection.on('disconnected', () => {
  console.log('🔴 MongoDB 연결 끊어짐');
});

mongoose.connection.on('error', (err) => {
  console.error('🔥 MongoDB 연결 오류:', err);
});

// 라우트
const authRoutes = require('./routes/auth');
const workRoutes = require('./routes/work');
const aboutRoutes = require('./routes/about');
const filedRoutes = require('./routes/filed');
const cvRouter = require('./routes/cv');
const humanRoutes = require('./routes/human');
const contactRoutes = require('./routes/contact');
const homeRoutes = require('./routes/home');
const guestbookRoutes = require('./routes/guestbook');
const saengsansoRoutes = require('./routes/saengsanso');
const teamEventRoutes = require('./routes/teamEvent');
const oceanRoutes = require('./routes/ocean');

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/contact/send', contactLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/work', workRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/filed', filedRoutes);
app.use('/api/cv', cvRouter);
app.use('/api/human', humanRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/guestbook', guestbookRoutes);
app.use('/api/saengsanso', saengsansoRoutes);
app.use('/api/team-event', teamEventRoutes);
app.use('/api/ocean', oceanRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '노드트리 홈페이지 백엔드 서버가 실행 중입니다.',
    status: 'ok'
  });
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    message: '요청한 엔드포인트를 찾을 수 없습니다.',
    path: req.originalUrl,
    method: req.method
  });
});

// 에러 핸들러
app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  res.status(500).json({
    message: '서버 내부 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? error.message : '내부 서버 오류'
  });
});

// 서버 시작
const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB 연결 완료');
  } catch (error) {
    console.log('초기 DB 연결 실패, 요청 시 재시도합니다.');
  }

  app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();

// Export for testing
module.exports = app;
module.exports.connectDB = connectDB; // Force redeploy Mon Jan 19 20:31:44 KST 2026
