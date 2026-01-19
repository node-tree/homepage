const express = require('express');
const mongoose = require('mongoose');
const CV = require('../models/CV');
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

// GET /api/cv - CV 데이터 조회
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();
    let cvData = await CV.findOne({ isActive: true });
    if (!cvData) {
      cvData = new CV({ title: 'CV', subtitle: '', content: '', htmlContent: '' });
      await cvData.save();
    }
    res.json({ success: true, data: cvData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'CV 데이터 조회 오류', error: error.message });
  }
});

// PUT /api/cv - CV 데이터 수정(관리자만)
router.put('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    const { title, subtitle, content, htmlContent } = req.body;
    if (!title && !content && !subtitle && !htmlContent) {
      return res.status(400).json({ success: false, message: '수정할 내용을 입력하세요.' });
    }
    const updateData = { updatedAt: Date.now() };
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (content !== undefined) updateData.content = content;
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
    let cvData = await CV.findOne({ isActive: true });
    if (!cvData) {
      cvData = new CV({ title, subtitle, content, htmlContent });
      await cvData.save();
    } else {
      Object.assign(cvData, updateData);
      await cvData.save();
    }
    res.json({ success: true, data: cvData, message: 'CV가 성공적으로 저장되었습니다.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'CV 저장 오류', error: error.message });
  }
});

module.exports = router; 