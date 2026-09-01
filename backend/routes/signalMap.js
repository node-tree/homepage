// 마을의 신호 웹지도 콘텐츠 라우트 — kkumdarakSettings.js 패턴 1:1.
//   GET  /api/signal-map-content  공개(신호·장소 소개/소리 오버라이드)
//   PUT  /api/signal-map-content  꿈다락 편집 인증(scope:'kkumdarak', /api/village-diary/login 공유)
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const SignalMapContent = require('../models/SignalMapContent');

const router = express.Router();

const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// 코드베이스 관례: 인증 미들웨어는 라우트 파일마다 인라인 복제(공통 모듈 미추출)
const requireKkumdarakAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, message: '꿈다락 편집 인증이 필요합니다.' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return res.status(401).json({ success: false, message: '꿈다락 편집 인증이 필요합니다.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.scope !== 'kkumdarak') {
      return res.status(403).json({ success: false, message: '꿈다락 편집 권한이 없습니다.' });
    }
    req.kkumdarak = decoded;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ success: false, message: '유효하지 않은 꿈다락 인증입니다.' });
  }
};

router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    const doc = await SignalMapContent.findOne();
    res.json({ success: true, data: doc ? doc.data : {} });
  } catch (error) {
    console.error('SignalMapContent 조회 오류:', error);
    res.status(500).json({ success: false, message: '신호 콘텐츠 조회에 실패했습니다.', error: error.message });
  }
});

router.put('/', requireKkumdarakAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    const contentData = req.body || {};
    const doc = await SignalMapContent.findOneAndUpdate(
      {},
      { $set: { data: contentData, updatedAt: Date.now() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('SignalMapContent 저장 완료:', doc._id);
    res.json({ success: true, message: '신호 콘텐츠가 저장되었습니다.', data: doc.data });
  } catch (error) {
    console.error('SignalMapContent 저장 오류:', error);
    res.status(500).json({ success: false, message: '신호 콘텐츠 저장에 실패했습니다.', error: error.message });
  }
});

module.exports = router;
