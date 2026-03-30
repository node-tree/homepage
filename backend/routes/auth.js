const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');
const HumanHeader = require('../models/User').HumanHeader;

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// JWT 시크릿 (환경변수에서 로드)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

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

    // MongoDB 연결
    await ensureDBConnection();

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // MongoDB 연결
    await ensureDBConnection();

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 토큰 검증
router.get('/verify', auth, async (req, res) => {
  try {
    await ensureDBConnection();

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

    // 요청에서 관리자 정보 받기
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'username, email, password 필드가 필요합니다.'
      });
    }

    const adminUser = new User({
      username,
      email,
      password,
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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