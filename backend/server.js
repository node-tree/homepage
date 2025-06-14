const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Vercel 환경에서는 dotenv를 다르게 처리
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 8000;

// 미들웨어
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://nodetree-home.vercel.app', 
        'https://nodetree-home-git-main-your-username.vercel.app',
        /\.vercel\.app$/
      ] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// MongoDB 연결 상태 추적
let isConnected = false;

// MongoDB 연결
const connectDB = async () => {
  if (isConnected) {
    console.log('MongoDB 이미 연결됨');
    return;
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    console.log('MongoDB 연결 시도 중...');
    console.log('URI 길이:', process.env.MONGODB_URI.length);
    console.log('URI 시작 부분:', process.env.MONGODB_URI.substring(0, 30) + '...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10초 타임아웃
      socketTimeoutMS: 45000, // 45초 소켓 타임아웃
      maxPoolSize: 10, // 최대 연결 풀 크기
      bufferMaxEntries: 0, // 버퍼링 비활성화
    });
    
    isConnected = true;
    console.log(`MongoDB 연결 성공: ${conn.connection.host}`);
    console.log(`데이터베이스: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    console.error('전체 에러:', error);
    console.log('서버는 MongoDB 없이 계속 실행됩니다. 연결 문자열을 확인해주세요.');
    isConnected = false;
  }
};

// 연결 상태 모니터링
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('MongoDB 연결됨');
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('MongoDB 연결 끊어짐');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB 연결 오류:', err);
  isConnected = false;
});

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
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      work: '/api/work',
      filed: '/api/filed',
      debug: '/api/debug'
    }
  });
});

// 디버그 라우트 - MongoDB 연결 상태 확인
app.get('/api/debug', async (req, res) => {
  try {
    // MongoDB 연결 시도
    await connectDB();
    
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
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version,
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
      mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
      mongoUriPreview: process.env.MONGODB_URI ? 
        process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT_SET',
      mongoConnectionState: mongoose.connection.readyState,
      mongoConnectionStates: {
        0: 'disconnected',
        1: 'connected', 
        2: 'connecting',
        3: 'disconnecting'
      },
      isConnected: isConnected,
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
        workshop: {
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
        key.includes('MONGO') || key.includes('JWT') || key.includes('PORT') || key.includes('NODE_ENV') || key.includes('VERCEL')
      ),
      vercelEnv: {
        VERCEL: process.env.VERCEL || 'NOT_SET',
        VERCEL_ENV: process.env.VERCEL_ENV || 'NOT_SET',
        VERCEL_URL: process.env.VERCEL_URL || 'NOT_SET'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug route failed',
      message: error.message,
      stack: error.stack,
      environment: process.env.NODE_ENV || 'development',
      mongoConnectionState: mongoose.connection.readyState,
      timestamp: new Date().toISOString(),
      allEnvVars: Object.keys(process.env).filter(key => 
        key.includes('MONGO') || key.includes('JWT') || key.includes('PORT') || key.includes('NODE_ENV') || key.includes('VERCEL')
      )
    });
  }
});

// 테스트 데이터 생성 라우트 (개발용)
app.post('/api/debug/create-test-data', async (req, res) => {
  try {
    await connectDB();
    
    const Work = require('./models/Work');
    const Filed = require('./models/Filed');

    // 테스트 Work 데이터 생성
    const testWork = new Work({
      title: '테스트 프로젝트 ' + new Date().toLocaleString('ko-KR'),
      contents: '이것은 MongoDB에서 실제로 가져온 테스트 데이터입니다.',
      thumbnail: null
    });

    // 테스트 Filed 데이터 생성
    const testFiled = new Filed({
      title: '테스트 기록 ' + new Date().toLocaleString('ko-KR'),
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

// Vercel 서버리스 환경에서는 연결을 미리 시도
connectDB();

// 서버 시작 (로컬 개발용)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`브라우저에서 http://localhost:${PORT} 에 접속해보세요.`);
  });
}

// Vercel용 export
module.exports = app; 