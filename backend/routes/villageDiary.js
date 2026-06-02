const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const VillageDiary = require('../models/VillageDiary');

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용 (home.js와 동일 패턴)
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// ── 꿈다락 전용 인증 ────────────────────────────────────────────────
// 사이트 관리자(auth/adminOnly, role:'admin')와 완전히 분리된 꿈다락 편집 전용 인증.
//   단일 공유 비밀번호(KKUMDARAK_EDIT_PASSWORD)로 로그인 → scope:'kkumdarak' JWT 발급.
//   사이트 JWT 인프라(jsonwebtoken, JWT_SECRET)는 재사용하되 scope 로 격리한다.

// POST /api/village-diary/login - 꿈다락 편집 로그인
//   body { password } → 일치 시 scope:'kkumdarak' 토큰(7일) 발급.
//   브루트포스 완화: 미설정/불일치 메시지를 일반화한다.
router.post('/login', async (req, res) => {
  try {
    const expected = process.env.KKUMDARAK_EDIT_PASSWORD;
    if (!expected) {
      return res.status(500).json({ success: false, message: 'not configured' });
    }

    const { password } = req.body || {};

    if (typeof password !== 'string' || password !== expected) {
      // 일치/불일치 메시지를 동일하게 일반화 (열거 단서 차단)
      return res.status(401).json({ success: false, message: '인증에 실패했습니다.' });
    }

    const token = jwt.sign({ scope: 'kkumdarak' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token });
  } catch (error) {
    console.error('VillageDiary 로그인 오류:', error);
    return res.status(500).json({
      success: false,
      message: '로그인 처리 중 오류가 발생했습니다.',
    });
  }
});

// 꿈다락 scope 전용 인증 미들웨어 (사이트 adminOnly 재사용 금지)
//   Authorization: Bearer <token> → jwt.verify → decoded.scope === 'kkumdarak' 확인.
//   JWT_SECRET 은 요청 시점에 읽는다(모듈 로드 시 process.exit 부작용 회피).
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

// GET /api/village-diary - 마을일기 오버라이드 조회 (공개)
//   data = { [programId]: DiaryCardData[] } 를 그대로 반환(없으면 {}).
//   프론트의 mergePrograms 가 data[programId] 형태를 직접 소비한다.
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    const doc = await VillageDiary.findOne();

    res.json({
      success: true,
      data: doc ? doc.data : {}
    });
  } catch (error) {
    console.error('VillageDiary 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '마을일기 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/village-diary - 마을일기 오버라이드 저장 (꿈다락 편집 인증 전용)
//   req.body = 오버라이드 객체 { [programId]: DiaryCardData[] } (raw).
//   싱글톤 upsert 후 저장된 data 반환.
//   findOneAndUpdate 는 pre('save') 를 발화하지 않으므로 updatedAt 을 $set 으로 명시한다.
router.put('/', requireKkumdarakAuth, async (req, res) => {
  try {
    await ensureDBConnection();

    const overrideData = req.body || {};

    const doc = await VillageDiary.findOneAndUpdate(
      {},
      { $set: { data: overrideData, updatedAt: Date.now() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('VillageDiary 저장 완료:', doc._id);

    res.json({
      success: true,
      message: '마을일기가 성공적으로 저장되었습니다.',
      data: doc.data
    });
  } catch (error) {
    console.error('VillageDiary 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '마을일기 저장에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
