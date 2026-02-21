const express = require('express');
const mongoose = require('mongoose');
const HomeSettings = require('../models/HomeSettings');
const auth = require('../middleware/auth');

const router = express.Router();

// DB 연결 확인 함수
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2) {
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
  }

  return true;
};

// GET /api/home - 홈 설정 조회
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();

    let homeData = await HomeSettings.findOne({ isActive: true });

    // 데이터가 없으면 기본 데이터 생성
    if (!homeData) {
      homeData = new HomeSettings({
        title: 'Node Tree',
        subtitle: '서사 교차점의 기록',
        titlePosition: 'bottom-left'
      });
      await homeData.save();
      console.log('기본 Home 설정 생성 완료');
    }

    res.json({
      success: true,
      data: homeData
    });
  } catch (error) {
    console.error('Home 설정 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Home 설정 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/home - 홈 설정 수정 (관리자만)
router.put('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { title, subtitle, titlePosition, backgroundImage } = req.body;

    const updateData = {
      updatedAt: Date.now()
    };

    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (titlePosition) updateData.titlePosition = titlePosition;
    if (backgroundImage !== undefined) updateData.backgroundImage = backgroundImage;

    let homeData = await HomeSettings.findOne({ isActive: true });

    if (!homeData) {
      homeData = new HomeSettings({
        title: title || 'Node Tree',
        subtitle: subtitle || '서사 교차점의 기록',
        titlePosition: titlePosition || 'bottom-left'
      });
      await homeData.save();
    } else {
      Object.assign(homeData, updateData);
      await homeData.save();
    }

    console.log('Home 설정 수정 완료:', homeData._id);

    res.json({
      success: true,
      message: 'Home 설정이 성공적으로 수정되었습니다.',
      data: homeData
    });

  } catch (error) {
    console.error('Home 설정 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Home 설정 수정에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
