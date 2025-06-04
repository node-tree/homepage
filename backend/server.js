const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// 미들웨어
app.use(cors());
app.use(express.json());

// MongoDB 연결
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB 연결 성공: ${conn.connection.host}`);
    console.log(`데이터베이스: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    console.log('서버는 MongoDB 없이 계속 실행됩니다. 연결 문자열을 확인해주세요.');
  }
};

connectDB();

// 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/work', require('./routes/work'));
app.use('/api/filed', require('./routes/filed'));

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: '노드트리 홈페이지 백엔드 서버가 실행 중입니다.',
    mongoConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    database: mongoose.connection.name,
    endpoints: {
      auth: '/api/auth',
      work: '/api/work',
      filed: '/api/filed'
    }
  });
});

// 디버그 라우트 - MongoDB 연결 상태 확인
app.get('/api/debug', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
    mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    mongoConnectionState: mongoose.connection.readyState,
    mongoConnectionStates: {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    },
    databaseName: mongoose.connection.name,
    host: mongoose.connection.host,
    allEnvVars: Object.keys(process.env).filter(key => 
      key.includes('MONGO') || key.includes('JWT') || key.includes('PORT')
    )
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`브라우저에서 http://localhost:${PORT} 에 접속해보세요.`);
}); 