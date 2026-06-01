const express = require('express');
const mongoose = require('mongoose');
const VillageDiary = require('../models/VillageDiary');
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용 (home.js와 동일 패턴)
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
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

// PUT /api/village-diary - 마을일기 오버라이드 저장 (관리자만)
//   req.body = 오버라이드 객체 { [programId]: DiaryCardData[] } (raw).
//   싱글톤 upsert 후 저장된 data 반환.
//   findOneAndUpdate 는 pre('save') 를 발화하지 않으므로 updatedAt 을 $set 으로 명시한다.
router.put('/', auth, adminOnly, async (req, res) => {
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
