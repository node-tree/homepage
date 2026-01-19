const express = require('express');
const mongoose = require('mongoose');
const { HumanHeader } = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// DB 연결 확인 함수
const ensureDBConnection = async () => {
  // 이미 연결되어 있으면 바로 반환
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  // 연결 중이라면 연결 완료될 때까지 대기
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

  // 연결되지 않았다면 새로 연결 시도
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

// GET /api/human/header - 상단 제목/부제목 조회
router.get('/header', async (req, res) => {
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

// PUT /api/human/header - 상단 제목/부제목 수정
router.put('/header', auth, async (req, res) => {
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