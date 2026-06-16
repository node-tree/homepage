const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const VillageNews = require('../models/VillageNews');

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용 (villageDiary.js 와 동일 패턴)
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// ── 꿈다락 전용 인증 (villageDiary.js 미들웨어 복제) ───────────────────
// 로그인 엔드포인트는 신설하지 않는다 — 편집자는 기존 POST /api/village-diary/login 으로
// scope:'kkumdarak' 토큰을 받아 그대로 이 라우트에 사용한다(단일 꿈다락 인증 공유).
//   Authorization: Bearer <token> → jwt.verify → decoded.scope === 'kkumdarak' 확인.
//   JWT_SECRET 은 요청 시점에 읽는다(모듈 로드 시 부작용 회피).
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

// GET /api/village-news - 마을소식 편집 사본 조회 (공개)
//   data = { issues: { [issueId]: SerializedNewsIssue } } 를 그대로 반환(없으면 {}).
//   프론트의 mergeIssues 가 정적 NEWS_ISSUES 와 병합한다(같은 id 는 백엔드 우선).
//   Cache-Control 은 villageDiary 와 동일(엣지 캐시 활용 + 저장 직후 cdnBust 로 우회).
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    const doc = await VillageNews.findOne();

    res.json({
      success: true,
      data: doc ? doc.data : {}
    });
  } catch (error) {
    console.error('VillageNews 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '마을소식 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/village-news - 마을소식 편집 사본 저장 (꿈다락 편집 인증 전용)
//   req.body = { issues: { [issueId]: SerializedNewsIssue } } (raw, 통째 교체).
//   프론트가 read-merge-write 로 다른 호를 보존한 전체 객체를 보낸다.
//   싱글톤 upsert 후 저장된 data 반환.
//   findOneAndUpdate 는 pre('save') 를 발화하지 않으므로 updatedAt 을 $set 으로 명시한다.
router.put('/', requireKkumdarakAuth, async (req, res) => {
  try {
    await ensureDBConnection();

    const body = req.body || {};
    // issues 객체 + articles 배열만 화이트리스트로 추출(잡 키 유입 차단). 누락 시 빈 값.
    const issues = body.issues && typeof body.issues === 'object' ? body.issues : {};
    const articles = Array.isArray(body.articles) ? body.articles : [];
    const nextData = { issues, articles };

    const doc = await VillageNews.findOneAndUpdate(
      {},
      { $set: { data: nextData, updatedAt: Date.now() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('VillageNews 저장 완료:', doc._id, '호 수:', Object.keys(issues).length, '기사 수:', articles.length);

    res.json({
      success: true,
      message: '마을소식이 성공적으로 저장되었습니다.',
      data: doc.data
    });
  } catch (error) {
    console.error('VillageNews 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '마을소식 저장에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
