const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeamEvent = require('../models/TeamEvent');

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// 기존 잘못된 visitorId unique 인덱스 삭제 (1회성 마이그레이션)
let indexFixed = false;
const fixIndex = async () => {
  if (indexFixed) return;
  try {
    const collection = mongoose.connection.collection('teamevents');
    const indexes = await collection.indexes();
    const badIndex = indexes.find(idx => idx.key && idx.key.visitorId && !idx.key.sessionId && idx.unique);
    if (badIndex) {
      await collection.dropIndex(badIndex.name);
      console.log('✅ visitorId unique 인덱스 삭제 완료');
    }
    indexFixed = true;
  } catch (err) {
    // 인덱스가 없거나 이미 삭제된 경우 무시
    indexFixed = true;
  }
};

const TEAM_COLORS = [
  { name: 'RED',    nameKo: '석류빛',    hex: '#E53935' },
  { name: 'BLUE',   nameKo: '쪽빛',     hex: '#1E88E5' },
  { name: 'GREEN',  nameKo: '풀빛',     hex: '#43A047' },
  { name: 'YELLOW', nameKo: '유자빛',    hex: '#FDD835' },
  { name: 'PURPLE', nameKo: '제비꽃빛',  hex: '#8E24AA' },
  { name: 'ORANGE', nameKo: '귤빛',     hex: '#FB8C00' },
  { name: 'PINK',   nameKo: '복숭아빛',  hex: '#D81B60' },
  { name: 'CYAN',   nameKo: '옥빛',     hex: '#00ACC1' }
];

const TEAM_COUNT = 8;

// GET /api/team-event/session - 현재 세션 정보 (공개)
router.get('/session', async (req, res) => {
  try {
    await ensureDBConnection();
    await fixIndex();
    const latestSession = await TeamEvent.findOne().sort({ createdAt: -1 });
    if (!latestSession) {
      return res.json({ success: true, active: false });
    }
    res.json({
      success: true,
      active: true,
      sessionId: latestSession.sessionId
    });
  } catch (error) {
    console.error('세션 조회 오류:', error);
    res.status(500).json({ success: false, message: '세션 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/team-event/color/:visitorId - 방문자의 팀 색상 조회/배정
router.get('/color/:visitorId', async (req, res) => {
  try {
    await ensureDBConnection();
    const { visitorId } = req.params;

    const latestSession = await TeamEvent.findOne().sort({ createdAt: -1 });
    const currentSessionId = latestSession ? latestSession.sessionId : null;

    if (!currentSessionId) {
      return res.json({ success: true, assigned: false, message: '아직 이벤트가 시작되지 않았습니다.' });
    }

    // 이미 배정된 색상이 있는지 확인
    const existing = await TeamEvent.findOne({ visitorId, sessionId: currentSessionId });
    if (existing) {
      return res.json({
        success: true,
        assigned: true,
        teamIndex: existing.teamIndex,
        color: TEAM_COLORS[existing.teamIndex]
      });
    }

    // 새로 배정: 가장 인원이 적은 팀에 배정
    const counts = await TeamEvent.aggregate([
      { $match: { sessionId: currentSessionId, visitorId: { $not: /^__session_/ } } },
      { $group: { _id: '$teamIndex', count: { $sum: 1 } } }
    ]);

    const countMap = new Map();
    counts.forEach(c => countMap.set(c._id, c.count));

    let minCount = Infinity;
    const candidates = [];
    for (let i = 0; i < TEAM_COUNT; i++) {
      const c = countMap.get(i) || 0;
      if (c < minCount) {
        minCount = c;
        candidates.length = 0;
        candidates.push(i);
      } else if (c === minCount) {
        candidates.push(i);
      }
    }

    const teamIndex = candidates[Math.floor(Math.random() * candidates.length)];

    const assignment = new TeamEvent({
      visitorId,
      teamIndex,
      sessionId: currentSessionId
    });
    await assignment.save();

    res.json({
      success: true,
      assigned: true,
      teamIndex,
      color: TEAM_COLORS[teamIndex]
    });
  } catch (error) {
    console.error('팀 배정 오류:', error);
    res.status(500).json({ success: false, message: '팀 배정 중 오류가 발생했습니다.' });
  }
});

// POST /api/team-event/start - 이벤트 시작/리셋 (새 세션 생성)
router.post('/start', async (req, res) => {
  try {
    await ensureDBConnection();

    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const marker = new TeamEvent({
      visitorId: `__session_${sessionId}__`,
      teamIndex: 0,
      sessionId
    });
    await marker.save();

    res.json({
      success: true,
      sessionId,
      message: '이벤트가 시작되었습니다.'
    });
  } catch (error) {
    console.error('이벤트 시작 오류:', error);
    res.status(500).json({ success: false, message: '이벤트 시작 중 오류가 발생했습니다.' });
  }
});

// GET /api/team-event/stats - 팀별 통계
router.get('/stats', async (req, res) => {
  try {
    await ensureDBConnection();
    const latestSession = await TeamEvent.findOne().sort({ createdAt: -1 });
    if (!latestSession) {
      return res.json({ success: true, stats: [], total: 0, sessionId: null });
    }

    const currentSessionId = latestSession.sessionId;

    const counts = await TeamEvent.aggregate([
      { $match: { sessionId: currentSessionId, visitorId: { $not: /^__session_/ } } },
      { $group: { _id: '$teamIndex', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const stats = TEAM_COLORS.map((color, i) => {
      const found = counts.find(c => c._id === i);
      return {
        teamIndex: i,
        color,
        count: found ? found.count : 0
      };
    });

    const total = stats.reduce((sum, s) => sum + s.count, 0);

    res.json({
      success: true,
      stats,
      total,
      sessionId: currentSessionId
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ success: false, message: '통계 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
