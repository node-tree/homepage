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
app.get('/api/debug', async (req, res) => {
  try {
    // 컬렉션 데이터 직접 확인
    const Work = require('./models/Work');
    const Filed = require('./models/Filed');
    
    let workCount = 0;
    let filedCount = 0;
    let workSample = null;
    let filedSample = null;
    let errorDetails = null;

    try {
      workCount = await Work.countDocuments();
      workSample = await Work.findOne().limit(1);
      filedCount = await Filed.countDocuments();
      filedSample = await Filed.findOne().limit(1);
    } catch (dbError) {
      errorDetails = dbError.message;
    }

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
      collections: {
        work: {
          count: workCount,
          sample: workSample ? {
            id: workSample._id,
            title: workSample.title,
            hasContents: !!workSample.contents
          } : null
        },
        filed: {
          count: filedCount,
          sample: filedSample ? {
            id: filedSample._id,
            title: filedSample.title,
            hasContents: !!filedSample.contents
          } : null
        }
      },
      dbError: errorDetails,
      allEnvVars: Object.keys(process.env).filter(key => 
        key.includes('MONGO') || key.includes('JWT') || key.includes('PORT')
      )
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug route failed',
      message: error.message,
      environment: process.env.NODE_ENV || 'development',
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// 테스트 데이터 생성 라우트 (개발용)
app.post('/api/debug/create-test-data', async (req, res) => {
  try {
    const Work = require('./models/Work');
    const Filed = require('./models/Filed');

    // 테스트 Work 데이터 생성
    const testWork = new Work({
      title: '테스트 프로젝트',
      contents: '이것은 MongoDB에서 실제로 가져온 테스트 데이터입니다.',
      thumbnail: null
    });

    // 테스트 Filed 데이터 생성
    const testFiled = new Filed({
      title: '테스트 기록',
      contents: '이것은 MongoDB Filed 컬렉션의 테스트 데이터입니다.',
      thumbnail: null
    });

    const savedWork = await testWork.save();
    const savedFiled = await testFiled.save();

    res.json({
      success: true,
      message: '테스트 데이터가 성공적으로 생성되었습니다.',
      data: {
        work: {
          id: savedWork._id,
          title: savedWork.title
        },
        filed: {
          id: savedFiled._id,
          title: savedFiled.title
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '테스트 데이터 생성 실패',
      error: error.message
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`브라우저에서 http://localhost:${PORT} 에 접속해보세요.`);
}); 