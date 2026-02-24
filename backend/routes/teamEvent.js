const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeamEvent = require('../models/TeamEvent');

// Vercel 서버리스 환경 DB 연결 보장
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;

  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MongoDB 연결 대기 타임아웃')), 10000);
      mongoose.connection.once('connected', () => { clearTimeout(timeout); resolve(); });
      mongoose.connection.once('error', (err) => { clearTimeout(timeout); reject(err); });
    });
    return true;
  }

  if (mongoose.connection.readyState === 0) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    const options = {
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 0,
      maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 10000,
      bufferCommands: false, family: 4, heartbeatFrequencyMS: 30000,
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

const TEAM_COLORS = [
  { name: 'RED',    hex: '#E53935' },
  { name: 'BLUE',   hex: '#1E88E5' },
  { name: 'GREEN',  hex: '#43A047' },
  { name: 'YELLOW', hex: '#FDD835' },
  { name: 'PURPLE', hex: '#8E24AA' },
  { name: 'ORANGE', hex: '#FB8C00' },
  { name: 'PINK',   hex: '#D81B60' },
  { name: 'CYAN',   hex: '#00ACC1' }
];

const TEAM_COUNT = 8;

// GET /api/team-event/session - 현재 세션 정보 (공개)
router.get('/session', async (req, res) => {
  try {
    await ensureDBConnection();
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
