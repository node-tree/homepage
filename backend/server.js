const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 환경변수 로드
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Vercel/Render 등 리버스 프록시 뒤에서 실행되므로 X-Forwarded-For 1홉만 신뢰.
// (express-rate-limit 의 IP 식별이 프록시 IP로 뭉치는 것을 방지. true 는 스푸핑 위험이라 사용하지 않는다.)
app.set('trust proxy', 1);

// ─── 보안 헤더 ───
// API 전용 서버이므로 helmet 기본값으로 충분(HTML 을 서빙하지 않아 CSP 기본값도 무해).
// 단, 이미지 프록시/업로드 응답이 타 오리진에서 로드될 수 있어 CORP 는 cross-origin 으로 완화.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── CORS ───
// 정확한 도메인만 허용(와일드카드 정규식 금지).
// 참고: 프로덕션·프리뷰 모두 프론트와 /api 가 동일 오리진(vercel.json rewrite)이라
//       프리뷰 도메인은 CORS 목록이 필요 없다.
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://nodetree.kr',
        'https://www.nodetree.kr',
        'https://saengsanso.com',
        'https://www.saengsanso.com',
        'https://isoartlab.com',
        'https://www.isoartlab.com',
        'https://nodetree-home.vercel.app'
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// ─── 요청 본문 크기 제한 ───
// 기본 100kb. HTML 본문을 다루는 콘텐츠 라우트는 1mb, base64 이미지를 받는
// 업로드/예산 라우트만 10mb. (라우터 마운트 시점에 개별 적용 — 전역 파서를
// 먼저 태우면 큰 본문이 100kb 에서 먼저 잘린다.)
const jsonSmall = express.json({ limit: '100kb' });
const jsonContent = express.json({ limit: '1mb' });
const jsonUpload = express.json({ limit: '10mb' });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rate limit ───
// 서버리스에서는 인스턴스별 메모리 스토어라 완벽하진 않지만
// 단일 인스턴스로 몰리는 브루트포스/스팸은 실질적으로 차단된다.
const makeAuthLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '문의 전송이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

const imageProxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '요청이 너무 많습니다.' }
});

app.use('/api/auth/login', makeAuthLimiter());
app.use('/api/auth/register', makeAuthLimiter());
app.use('/api/auth/create-admin', makeAuthLimiter());
app.use('/api/village-diary/login', makeAuthLimiter());
app.use('/api/contact/send', contactLimiter);
app.use('/api/saengsanso/image-proxy', imageProxyLimiter);

// MongoDB 연결 (별도 모듈 — 순환 참조 방지 + 서버리스 연결 캐싱)
const connectDB = require('./db');

// 인증 미들웨어 (디버그 라우트 보호용 — 민감정보 노출 방지)
const authMw = require('./middleware/auth');
const adminOnlyMw = authMw.adminOnly;

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
const calendarRoutes = require('./routes/calendar');
const villageDiaryRoutes = require('./routes/villageDiary');
const villageNewsRoutes = require('./routes/villageNews');
const kkumdarakBudgetRoutes = require('./routes/kkumdarakBudget');
const kkumdarakSettingsRoutes = require('./routes/kkumdarakSettings');
const imagekitRoutes = require('./routes/imagekit');
const aiRoutes = require('./routes/ai');

// 본문 파서는 라우터별로 명시 적용(위 jsonSmall/jsonContent/jsonUpload 참조)
app.use('/api/auth', jsonSmall, authRoutes);
app.use('/api/work', jsonContent, workRoutes);
app.use('/api/about', jsonContent, aboutRoutes);
app.use('/api/filed', jsonContent, filedRoutes);
app.use('/api/cv', jsonContent, cvRouter);
app.use('/api/human', jsonContent, humanRoutes);
app.use('/api/contact', jsonSmall, contactRoutes);
app.use('/api/home', jsonUpload, homeRoutes);              // 배경 이미지 base64
app.use('/api/guestbook', jsonSmall, guestbookRoutes);
app.use('/api/saengsanso', jsonUpload, saengsansoRoutes);  // 이미지 base64
app.use('/api/team-event', jsonSmall, teamEventRoutes);
app.use('/api/ocean', jsonSmall, oceanRoutes);
app.use('/api/calendar', jsonSmall, calendarRoutes);
app.use('/api/village-diary', jsonContent, villageDiaryRoutes);
app.use('/api/village-news', jsonContent, villageNewsRoutes);
app.use('/api/kkumdarak', jsonUpload, kkumdarakBudgetRoutes);  // 증빙 base64 + 서식 사진
app.use('/api/kkumdarak-settings', jsonContent, kkumdarakSettingsRoutes);
app.use('/api/imagekit', jsonSmall, imagekitRoutes);
app.use('/api/ai', jsonContent, aiRoutes);

// 그 외 경로(루트·디버그)는 기본 100kb
app.use(jsonSmall);

// 기본 라우트 — 헬스체크만. 내부 정보(DB명·환경·엔드포인트 목록) 노출 금지.
app.get('/', (req, res) => {
  res.json({ ok: true });
});

// 디버그 라우트 - MongoDB 연결 상태 확인
app.get('/api/debug', authMw, adminOnlyMw, async (req, res) => {
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
app.post('/api/debug/create-test-data', authMw, adminOnlyMw, async (req, res) => {
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

  // 본문 크기 초과 → 500 이 아니라 413 으로 정확히 알린다.
  if (error.type === 'entity.too.large' || error.status === 413) {
    return res.status(413).json({
      success: false,
      message: '요청 본문이 너무 큽니다.'
    });
  }

  // 잘못된 JSON 본문 → 400.
  if (error.type === 'entity.parse.failed' || (error.status === 400 && 'body' in error)) {
    return res.status(400).json({
      success: false,
      message: '요청 본문 형식이 올바르지 않습니다.'
    });
  }

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
