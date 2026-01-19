const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');
const HumanHeader = require('../models/User').HumanHeader;

const router = express.Router();

// DB 연결 확인 함수
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2) {
    console.log('⏳ MongoDB 연결 중... 대기');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MongoDB 연결 대기 타임아웃'));
      }, 10000);

      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      mongoose.connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    return true;
  }

  if (mongoose.connection.readyState === 0) {
    console.log('🔄 MongoDB 연결 시도...');

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    const options = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 0,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      bufferCommands: false,
      family: 4,
      heartbeatFrequencyMS: 30000,
    };

    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.includes('retryWrites')) {
      const separator = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${separator}retryWrites=true&w=majority`;
    }

    await mongoose.connect(mongoUri, options);
    console.log('✅ MongoDB 연결 성공');
  }

  return true;
};

// 인메모리 테스트 사용자 (MongoDB 연결 실패 시 사용)
let testUsers = [
  {
    id: "test-user-1",
    username: "admin",
    email: "admin@test.com",
    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
    role: "admin"
  }
];

// 고정 JWT 시크릿 (Vercel 서버리스 인스턴스 간 일관성 보장)
const JWT_SECRET = '[REDACTED-JWT-SECRET]';

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '모든 필드를 입력해주세요.'
      });
    }

    // MongoDB 연결 시도
    try {
      await ensureDBConnection();
    } catch (dbError) {
      console.error('MongoDB 연결 실패:', dbError.message);
    }

    if (mongoose.connection.readyState !== 1) {
      // MongoDB 연결 실패 시 인메모리 테스트 시스템 사용
      const existingUser = testUsers.find(u => u.email === email || u.username === username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '이미 존재하는 사용자입니다.'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        id: `test-user-${Date.now()}`,
        username,
        email,
        password: hashedPassword,
        role: "user"
      };
      
      testUsers.push(newUser);

      const token = jwt.sign(
        { userId: newUser.id, username: newUser.username, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: '회원가입이 완료되었습니다. (테스트 모드)',
        token,
        user: { 
          id: newUser.id,
          username: newUser.username, 
          email: newUser.email, 
          role: newUser.role 
        }
      });
    }

    // MongoDB 연결이 정상인 경우 기존 로직 사용
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 사용자입니다.'
      });
    }

    // User 모델에서 비밀번호 해싱이 자동으로 처리됩니다
    const user = new User({
      username,
      email,
      password // User 모델의 pre('save') 미들웨어에서 해싱됨
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      token,
      user: { 
        id: user._id,
        username: user.username, 
        email: user.email, 
        role: user.role 
      }
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원가입에 실패했습니다.',
      error: error.message
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: '이메일/사용자명과 비밀번호를 입력해주세요.'
      });
    }

    // MongoDB 연결 시도
    console.log('🔍 로그인 시도 - MongoDB 연결 상태:', mongoose.connection.readyState);
    console.log('🔍 로그인 정보:', { emailOrUsername, passwordLength: password.length });

    try {
      await ensureDBConnection();
    } catch (dbError) {
      console.error('MongoDB 연결 실패:', dbError.message);
    }

    if (mongoose.connection.readyState !== 1) {
      // MongoDB 연결 실패 시 인메모리 테스트 시스템 사용
      const user = testUsers.find(u => 
        u.email === emailOrUsername || u.username === emailOrUsername
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '사용자를 찾을 수 없습니다. (테스트 모드: admin/password 사용)'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '비밀번호가 잘못되었습니다.'
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        message: '로그인 성공! (테스트 모드)',
        token,
        user: { 
          id: user.id,
          username: user.username, 
          email: user.email, 
          role: user.role 
        }
      });
    }

    // MongoDB 연결이 정상인 경우 기존 로직 사용
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // User 모델의 comparePassword 메서드 사용
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '비밀번호가 잘못되었습니다.'
      });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '로그인 성공!',
      token,
      user: { 
        id: user._id,
        username: user.username, 
        email: user.email, 
        role: user.role 
      }
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인에 실패했습니다.',
      error: error.message
    });
  }
});

// 토큰 검증
router.get('/verify', auth, async (req, res) => {
  try {
    // MongoDB 연결 시도
    try {
      await ensureDBConnection();
    } catch (dbError) {
      console.error('MongoDB 연결 실패:', dbError.message);
    }

    if (mongoose.connection.readyState !== 1) {
      // MongoDB 연결 실패 시 req.user 정보만 반환 (미들웨어에서 검증됨)
      return res.json({
        success: true,
        user: req.user,
        note: "테스트 모드"
      });
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(500).json({
      success: false,
      message: '토큰 검증에 실패했습니다.'
    });
  }
});

// 관리자 사용자 생성 (초기 설정용)
router.post('/create-admin', async (req, res) => {
  try {
    await ensureDBConnection();

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB 연결이 필요합니다.'
      });
    }

    // 이미 사용자가 있는지 확인
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 사용자가 존재합니다. 보안상 관리자 생성을 거부합니다.'
      });
    }

    // 관리자 사용자 생성
    const adminUser = new User({
      username: 'mcwjd',
      email: 'admin@nodetree.kr',
      password: 'Mc@@152615', // User 모델에서 자동으로 해싱됨
      role: 'admin'
    });

    await adminUser.save();

    const token = jwt.sign(
      { userId: adminUser._id, username: adminUser.username, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '관리자 계정이 생성되었습니다.',
      token,
      user: { 
        id: adminUser._id,
        username: adminUser.username, 
        email: adminUser.email, 
        role: adminUser.role 
      }
    });

  } catch (error) {
    console.error('관리자 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '관리자 생성에 실패했습니다.',
      error: error.message
    });
  }
});

// 관리자 비밀번호 재설정 (디버그용)
router.post('/reset-admin-password', async (req, res) => {
  try {
    await ensureDBConnection();

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB 연결이 필요합니다.'
      });
    }

    // mcwjd 사용자 찾기
    const user = await User.findOne({ username: 'mcwjd' });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'mcwjd 사용자를 찾을 수 없습니다.'
      });
    }

    // 새 비밀번호 설정 (User 모델의 pre('save') 미들웨어가 자동으로 해싱)
    user.password = 'Mc@@152615';
    await user.save();

    res.json({
      success: true,
      message: 'mcwjd 사용자의 비밀번호가 Mc@@152615로 재설정되었습니다.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 재설정에 실패했습니다.',
      error: error.message
    });
  }
});

// 로그아웃
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: '로그아웃되었습니다.'
  });
});

// GET /human/header - 상단 제목/부제목 조회
router.get('/human/header', async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await HumanHeader.findOne({});
    if (!header) {
      header = new HumanHeader({ title: 'ART NETWORK', subtitle: '예술의 장을 구성하는 여러 지점들-‘누구와 함께’, ‘무엇이 연결되는가’' });
      await header.save();
    }
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 조회 실패', error: e.message });
  }
});

// PUT /human/header - 상단 제목/부제목 수정
router.put('/human/header', require('../middleware/auth'), async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await HumanHeader.findOne({});
    if (!header) {
      header = new HumanHeader({});
    }
    if (req.body.title !== undefined) header.title = req.body.title;
    if (req.body.subtitle !== undefined) header.subtitle = req.body.subtitle;
    await header.save();
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 수정 실패', error: e.message });
  }
});

module.exports = router; 