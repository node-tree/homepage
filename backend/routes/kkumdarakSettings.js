const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const KkumdarakSettings = require('../models/KkumdarakSettings');

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용 (villageDiary.js 와 동일 패턴)
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// ── 꿈다락 전용 인증 ────────────────────────────────────────────────
// 사이트 관리자(auth/adminOnly, role:'admin')와 완전히 분리된 꿈다락 편집 전용 인증.
//   마을일기(villageDiary.js)와 동일한 scope:'kkumdarak' 토큰을 그대로 쓴다
//   (로그인/비밀번호는 POST /api/village-diary/login 단일 진입점을 공유).
//   코드베이스 관례상 미들웨어를 라우트 파일마다 인라인 복제한다(공통 모듈로 추출하지 않음).
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

// GET /api/kkumdarak-settings - 공개 페이지 설정 조회 (공개)
//   data = { programs: { [programName]: { applyUrl?, closed? } } } 를 그대로 반환(없으면 {}).
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    const doc = await KkumdarakSettings.findOne();

    res.json({
      success: true,
      data: doc ? doc.data : {}
    });
  } catch (error) {
    console.error('KkumdarakSettings 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '꿈다락 설정 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/kkumdarak-settings - 공개 페이지 설정 저장 (꿈다락 편집 인증 전용)
//   req.body = 설정 객체 { programs: {...} } (raw). 싱글톤 upsert 후 저장된 data 반환.
//   findOneAndUpdate 는 pre('save') 를 발화하지 않으므로 updatedAt 을 $set 으로 명시한다.
router.put('/', requireKkumdarakAuth, async (req, res) => {
  try {
    await ensureDBConnection();

    const settingsData = req.body || {};

    const doc = await KkumdarakSettings.findOneAndUpdate(
      {},
      { $set: { data: settingsData, updatedAt: Date.now() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('KkumdarakSettings 저장 완료:', doc._id);

    res.json({
      success: true,
      message: '꿈다락 설정이 성공적으로 저장되었습니다.',
      data: doc.data
    });
  } catch (error) {
    console.error('KkumdarakSettings 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '꿈다락 설정 저장에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
