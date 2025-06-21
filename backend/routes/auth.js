const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

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

// JWT 비밀키 (환경변수로 관리)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

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

    // MongoDB 연결 상태 확인
    const mongoose = require('mongoose');
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
        process.env.JWT_SECRET,
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
      process.env.JWT_SECRET,
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

    // MongoDB 연결 상태 확인
    const mongoose = require('mongoose');
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
        process.env.JWT_SECRET,
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
      process.env.JWT_SECRET,
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
    // MongoDB 연결 상태 확인
    const mongoose = require('mongoose');
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
    // MongoDB 연결 상태 확인
    const mongoose = require('mongoose');
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

// 로그아웃
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: '로그아웃되었습니다.'
  });
});

module.exports = router; 