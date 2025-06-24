const express = require('express');
const mongoose = require('mongoose');
const CV = require('../models/CV');
const auth = require('../middleware/auth');

const router = express.Router();

const ensureDBConnection = async () => {
  if (mongoose.connection.readyState !== 1) {
    if (mongoose.connection.readyState === 0) {
      console.log('MongoDB 연결 시도...');
    }
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.includes('retryWrites')) {
      const separator = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${separator}retryWrites=true&w=majority`;
    }
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
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