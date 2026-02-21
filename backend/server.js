const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// 환경변수 로드
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// 미들웨어
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://nodetree.kr',
        'https://www.nodetree.kr',
        'https://saengsanso.com',
        'https://www.saengsanso.com',
        'https://nodetree-home.vercel.app',
        'https://nodetree-home-git-main-your-username.vercel.app',
        /\.vercel\.app$/,
        /\.onrender\.com$/
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Vercel 서버리스 환경에 최적화된 MongoDB 연결
// 검색 결과에 따르면 연결 캐싱보다는 직접 연결이 더 안정적임
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    // 이미 연결되어 있다면 재사용
    if (mongoose.connection.readyState === 1) {
      console.log('✅ 기존 MongoDB 연결 재사용');
      return mongoose.connection;
    }

    // 연결 중이라면 대기
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ MongoDB 연결 중... 대기');
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', resolve);
      });
      return mongoose.connection;
    }

    console.log('🔄 새로운 MongoDB 연결 시도...');
    console.log('환경:', process.env.NODE_ENV || 'development');
    console.log('Vercel 환경:', process.env.VERCEL ? 'YES' : 'NO');
    
    // Vercel 서버리스 환경에 최적화된 연결 옵션
    const options = {
      // 타임아웃 설정 (Vercel 10초 제한 고려)
      serverSelectionTimeoutMS: 5000, // 5초로 단축
      connectTimeoutMS: 5000,
      socketTimeoutMS: 0, // 무제한 (0으로 설정)
      
      // 연결 풀 설정 (서버리스에 최적화)
      maxPoolSize: 5, // 동시 요청 처리 성능 향상
      minPoolSize: 0,
      maxIdleTimeMS: 10000, // 10초 후 연결 해제
      
      // 버퍼링 비활성화 (서버리스에서 권장) - bufferMaxEntries 제거
      bufferCommands: false,
      
      // 네트워크 설정
      family: 4, // IPv4 강제 사용
      heartbeatFrequencyMS: 30000, // 30초로 증가
    };

    // MongoDB URI 최적화 (필요한 파라미터만 추가)
    let mongoUri = process.env.MONGODB_URI;
    
    // 기본 파라미터가 없다면 추가
    if (!mongoUri.includes('retryWrites')) {
      const separator = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${separator}retryWrites=true&w=majority`;
    }

    console.log('MongoDB 연결 시도 중...');
    
    // 연결 시도
    await mongoose.connect(mongoUri, options);
    
    console.log(`✅ MongoDB 연결 성공: ${mongoose.connection.host}`);
    console.log(`📊 데이터베이스: ${mongoose.connection.name}`);
    console.log(`🔗 연결 상태: ${mongoose.connection.readyState}`);
    console.log(`⏱️ 연결 시간: ${new Date().toISOString()}`);
    
    return mongoose.connection;
  } catch (error) {
    console.error(`❌ MongoDB 연결 실패:`, error.message);
    
    // 특정 에러에 대한 상세 정보
    if (error.name === 'MongoServerSelectionError') {
      console.error('🔍 서버 선택 타임아웃 - MongoDB Atlas 설정을 확인하세요');
    } else if (error.name === 'MongoNetworkError') {
      console.error('🌐 네트워크 오류 - 연결 상태를 확인하세요');
    } else if (error.name === 'MongoParseError') {
      console.error('📝 URI 파싱 오류 - 연결 문자열을 확인하세요');
    }
    
    console.error('상세 에러:', error);
    throw error;
  }
};

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
    jwt: {
      envVarExists: !!process.env.JWT_SECRET,
      envVarLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
      usingHardcoded: 'nodetree-jwt-secret-2024-fixed-key'
    },
    mongodb: {
      uriExists: !!process.env.MONGODB_URI,
      uriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
      uriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'NOT_SET',
      uriContainsAtlas: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('mongodb+srv') : false,
      uriContainsHomepage: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('homepage') : false
    },
    allEnvKeys: Object.keys(process.env).filter(key =>
      key.includes('MONGO') || key.includes('VERCEL') || key.includes('NODE_ENV') || key.includes('JWT')
    ).sort()
  });
});

// 디버그 라우트 - MongoDB 연결 상태 확인
app.get('/api/debug', async (req, res) => {
  try {
    console.log('디버그 라우트 호출됨');
    
    // 기본 환경 정보
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      vercel: {
        isVercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV || 'NOT_SET',
        vercelUrl: process.env.VERCEL_URL || 'NOT_SET',
        region: process.env.VERCEL_REGION || 'NOT_SET'
      },
      mongodb: {
        uriExists: !!process.env.MONGODB_URI,
        uriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
        uriStart: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT_SET',
        uriContainsAtlas: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('mongodb+srv') : false,
        uriContainsHomepage: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('homepage') : false,
        connectionState: mongoose.connection.readyState,
        connectionStates: {
          0: 'disconnected',
          1: 'connected', 
          2: 'connecting',
          3: 'disconnecting'
        }
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // MongoDB 연결 시도
    let connectionResult = null;
    let workCount = 0;
    let filedCount = 0;
    let userCount = 0;
    let workSample = null;
    let filedSample = null;
    let userSample = null;
    let errorDetails = null;
    let collectionNames = [];
    let directUserCount = 0;

    try {
      console.log('MongoDB 연결 시도...');
      await connectDB();
      connectionResult = '✅ 연결 성공';
      
      // 컬렉션 데이터 직접 확인
      const Work = require('./models/Work');
      const Filed = require('./models/Filed');
      const User = require('./models/User');
      
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
      
      // Users 컬렉션 정보 추가
      userCount = await User.countDocuments();
      console.log('User 문서 개수:', userCount);
      
      if (userCount > 0) {
        userSample = await User.findOne().limit(1);
        console.log('User 샘플 데이터 조회 완료');
      }
      
      // 모든 컬렉션 목록 확인
      const collections = await mongoose.connection.db.listCollections().toArray();
      collectionNames = collections.map(col => col.name);
      console.log('MongoDB 컬렉션 목록:', collectionNames);
      
      // users 컬렉션 직접 확인
      try {
        directUserCount = await mongoose.connection.db.collection('users').countDocuments();
        console.log('users 컬렉션 직접 조회 결과:', directUserCount);
      } catch (err) {
        console.log('users 컬렉션 직접 조회 실패:', err.message);
      }
      
    } catch (error) {
      console.error('MongoDB 연결/쿼리 오류:', error);
      connectionResult = `❌ 연결 실패: ${error.message}`;
      errorDetails = {
        name: error.name,
        message: error.message,
        code: error.code,
        codeName: error.codeName,
        stack: error.stack?.split('\n').slice(0, 5) // 스택 트레이스 일부만
      };
      
      // 특정 에러 타입별 추가 정보
      if (error.name === 'MongoServerSelectionError') {
        errorDetails.possibleCauses = [
          '🔥 MongoDB Atlas IP 화이트리스트 설정 확인 필요',
          '🔥 Vercel은 동적 IP를 사용하므로 0.0.0.0/0 허용 필요',
          '🔥 MongoDB Atlas 네트워크 접근 설정에서 "모든 곳에서 접근 허용" 체크',
          '🔥 MongoDB 연결 문자열 확인',
          '🔥 데이터베이스 사용자 권한 확인'
        ];
        errorDetails.mongoAtlasGuide = 'https://www.mongodb.com/docs/atlas/security-whitelist/';
      }
    }

    // 응답 데이터 구성
    const response = {
      ...debugInfo,
      connection: {
        result: connectionResult,
        host: mongoose.connection.host || 'NOT_CONNECTED',
        database: mongoose.connection.name || 'NOT_CONNECTED',
        readyState: mongoose.connection.readyState
      },
      data: {
        workCount,
        filedCount,
        userCount: userCount || 0,
        workSample: workSample ? {
          id: workSample._id?.toString(),
          title: workSample.title,
          hasContent: !!workSample.contents
        } : null,
        filedSample: filedSample ? {
          id: filedSample._id?.toString(),
          title: filedSample.title,
          hasContent: !!filedSample.contents
        } : null,
        userSample: userSample ? {
          id: userSample._id?.toString(),
          username: userSample.username,
          email: userSample.email,
          role: userSample.role
        } : null
      },
      error: errorDetails,
      recommendations: process.env.VERCEL ? [
        '🔧 MongoDB Atlas에서 Network Access 설정 확인',
        '🔧 IP Access List에 0.0.0.0/0 추가 (모든 IP 허용)',
        '🔧 Database User 권한이 readWrite 이상인지 확인',
        '🔧 Vercel 환경변수 MONGODB_URI 설정 확인',
        '🔧 MongoDB 연결 문자열에 올바른 데이터베이스명 포함 확인'
      ] : [
        '🏠 로컬 환경에서는 MongoDB Atlas IP 화이트리스트에 현재 IP 추가',
        '🏠 .env.local 파일에 MONGODB_URI 설정 확인'
      ]
    };

    res.json(response);
  } catch (error) {
    console.error('디버그 라우트 오류:', error);
    res.status(500).json({
      error: '디버그 정보 수집 중 오류 발생',
      message: error.message,
      timestamp: new Date().toISOString()
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
