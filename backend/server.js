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

// MongoDB 연결 상태 추적 (서버리스 환경 최적화)
let cachedConnection = null;

// MongoDB 연결 함수 (서버리스 환경 최적화)
const connectDB = async () => {
  // 이미 연결이 있고 활성 상태라면 재사용
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('기존 MongoDB 연결 재사용');
    return cachedConnection;
  }

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    console.log('MongoDB 연결 시도 중...');
    console.log('환경:', process.env.NODE_ENV || 'development');
    console.log('Vercel 환경:', process.env.VERCEL ? 'YES' : 'NO');
    
    // 서버리스 환경에 최적화된 연결 옵션
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5초로 단축 (Vercel 함수 타임아웃 고려)
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1, // 최소 연결 유지
      maxIdleTimeMS: 30000, // 30초 후 유휴 연결 정리
      bufferMaxEntries: 0, // 버퍼링 비활성화
      bufferCommands: false, // 명령 버퍼링 비활성화
      heartbeatFrequencyMS: 10000, // 하트비트 주기
    };

    // 기존 연결이 있다면 정리
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Vercel 환경에서 더 안정적인 연결을 위한 URI 최적화
    let mongoUri = process.env.MONGODB_URI;
    
    // URI에 추가 파라미터가 없다면 추가
    if (!mongoUri.includes('maxPoolSize')) {
      const separator = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${separator}maxPoolSize=10&serverSelectionTimeoutMS=5000&socketTimeoutMS=45000&family=4`;
    }

    console.log('최적화된 MongoDB URI 길이:', mongoUri.length);
    console.log('연결 시도 중...');

    const conn = await mongoose.connect(mongoUri, options);
    
    cachedConnection = conn;
    console.log(`MongoDB 연결 성공: ${conn.connection.host}`);
    console.log(`데이터베이스: ${conn.connection.name}`);
    console.log(`연결 상태: ${mongoose.connection.readyState}`);
    
    return conn;
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    console.error('상세 에러:', error);
    cachedConnection = null;
    throw error; // 에러를 다시 던져서 호출하는 곳에서 처리하도록
  }
};

// 연결 상태 모니터링
mongoose.connection.on('connected', () => {
  console.log('MongoDB 연결됨');
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB 연결 끊어짐');
  cachedConnection = null;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB 연결 오류:', err);
  cachedConnection = null;
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
    vercel: process.env.VERCEL ? 'YES' : 'NO',
    endpoints: {
      auth: '/api/auth',
      work: '/api/work',
      filed: '/api/filed',
      debug: '/api/debug'
    }
  });
});

// 환경변수 테스트 라우트 (보안상 일부만 표시)
app.get('/api/env-test', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: {
      isVercel: !!process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV || 'NOT_SET',
      vercelUrl: process.env.VERCEL_URL || 'NOT_SET'
    },
    mongodb: {
      uriExists: !!process.env.MONGODB_URI,
      uriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
      uriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'NOT_SET',
      uriContainsAtlas: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('mongodb+srv') : false,
      uriContainsHomepage: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('homepage') : false
    },
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('MONGO') || key.includes('VERCEL') || key.includes('NODE_ENV')
    ).sort()
  });
});

// 디버그 라우트 - MongoDB 연결 상태 확인
app.get('/api/debug', async (req, res) => {
  try {
    console.log('디버그 라우트 호출됨');
    
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
      console.log('데이터베이스 쿼리 시작...');
      workCount = await Work.countDocuments();
      console.log('Work 문서 개수:', workCount);
      
      if (workCount > 0) {
        workSample = await Work.findOne().limit(1);
        console.log('Work 샘플 데이터 조회 완료');
      }
      
      filedCount = await Filed.countDocuments();
      console.log('Filed 문서 개수:', filedCount);
      
      if (filedCount > 0) {
        filedSample = await Filed.findOne().limit(1);
        console.log('Filed 샘플 데이터 조회 완료');
      }
    } catch (dbError) {
      console.error('데이터베이스 쿼리 오류:', dbError);
      errorDetails = dbError.message;
    }

    res.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version,
      vercelInfo: {
        isVercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV || 'NOT_SET',
        vercelUrl: process.env.VERCEL_URL || 'NOT_SET'
      },
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
      mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
      mongoUriPreview: process.env.MONGODB_URI ? 
        process.env.MONGODB_URI.substring(0, 50) + '...' : 'NOT_SET',
      mongoConnectionState: mongoose.connection.readyState,
      mongoConnectionStates: {
        0: 'disconnected',
        1: 'connected', 
        2: 'connecting',
        3: 'disconnecting'
      },
      databaseName: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      collections: {
        work: {
          count: workCount,
          sample: workSample ? {
            id: workSample._id,
            title: workSample.title,
            hasContents: !!workSample.contents,
            createdAt: workSample.createdAt
          } : null
        },
        workshop: {
          count: filedCount,
          sample: filedSample ? {
            id: filedSample._id,
            title: filedSample.title,
            hasContents: !!filedSample.contents,
            createdAt: filedSample.createdAt
          } : null
        }
      },
      dbError: errorDetails,
      connectionCache: cachedConnection ? 'CACHED' : 'NOT_CACHED'
    });
  } catch (error) {
    console.error('디버그 라우트 오류:', error);
    res.status(500).json({
      error: 'Debug route failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      environment: process.env.NODE_ENV || 'development',
      mongoConnectionState: mongoose.connection.readyState,
      timestamp: new Date().toISOString(),
      vercelInfo: {
        isVercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV || 'NOT_SET'
      },
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT_SET'
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

    const savedWork = await testWork.save();

    // 테스트 Filed 데이터 생성
    const testFiled = new Filed({
      title: '테스트 워크샵 ' + new Date().toLocaleString('ko-KR'),
      contents: '이것은 MongoDB에서 실제로 가져온 워크샵 테스트 데이터입니다.',
      thumbnail: null
    });

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
    console.error('테스트 데이터 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '테스트 데이터 생성에 실패했습니다.',
      error: error.message
    });
  }
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

// 서버 시작 (로컬 개발 환경에서만)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, async () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    try {
      await connectDB();
    } catch (error) {
      console.log('초기 DB 연결 실패, 요청 시 재시도합니다.');
    }
  });
}

// Vercel용 export
module.exports = app;
module.exports.connectDB = connectDB; 