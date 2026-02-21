const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const {
  SaengsansoExhibition,
  SaengsansoProject,
  SaengsansoNews,
  SaengsansoArchive,
} = require('../models/Saengsanso');

// DB 연결 확인 (work.js 패턴 복제)
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
      const sep = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${sep}retryWrites=true&w=majority`;
    }
    await mongoose.connect(mongoUri, options);
  }
  return true;
};

// ─── 모델 매핑 ───
const MODELS = {
  exhibitions: SaengsansoExhibition,
  projects: SaengsansoProject,
  news: SaengsansoNews,
  archive: SaengsansoArchive,
};

const SORT_FIELDS = {
  exhibitions: { sortOrder: 1, year: -1, _id: -1 },
  projects: { sortOrder: 1, _id: -1 },
  news: { sortOrder: 1, _id: -1 },
  archive: { sortOrder: 1, _id: -1 },
};

// ─── 공통 CRUD 라우트 생성 ───
Object.entries(MODELS).forEach(([type, Model]) => {
  // GET — 목록 조회 (공개)
  router.get(`/${type}`, async (req, res) => {
    try {
      await ensureDBConnection();
      const items = await Model.find().sort(SORT_FIELDS[type]);
      res.json({ success: true, data: items });
    } catch (error) {
      console.error(`SSO ${type} 조회 오류:`, error);
      res.status(500).json({ success: false, message: `${type} 조회 실패`, error: error.message });
    }
  });

  // POST — 추가 (auth)
  router.post(`/${type}`, auth, async (req, res) => {
    try {
      await ensureDBConnection();
      const item = new Model(req.body);
      const saved = await item.save();
      res.json({ success: true, data: saved, message: '추가 완료' });
    } catch (error) {
      console.error(`SSO ${type} 추가 오류:`, error);
      res.status(500).json({ success: false, message: `${type} 추가 실패`, error: error.message });
    }
  });

  // PUT reorder — 순서 변경 (auth)
  router.put(`/${type}/reorder`, auth, async (req, res) => {
    try {
      await ensureDBConnection();
      const { orders } = req.body;
      if (!orders || !Array.isArray(orders)) {
        return res.status(400).json({ success: false, message: '순서 데이터가 필요합니다.' });
      }
      await Promise.all(orders.map(o => Model.findByIdAndUpdate(o.id, { sortOrder: o.sortOrder })));
      res.json({ success: true, message: '순서 변경 완료' });
    } catch (error) {
      console.error(`SSO ${type} 순서 변경 오류:`, error);
      res.status(500).json({ success: false, message: `${type} 순서 변경 실패`, error: error.message });
    }
  });

  // PUT :id — 수정 (auth)
  router.put(`/${type}/:id`, auth, async (req, res) => {
    try {
      await ensureDBConnection();
      const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updated) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
      res.json({ success: true, data: updated, message: '수정 완료' });
    } catch (error) {
      console.error(`SSO ${type} 수정 오류:`, error);
      res.status(500).json({ success: false, message: `${type} 수정 실패`, error: error.message });
    }
  });

  // DELETE :id — 삭제 (auth)
  router.delete(`/${type}/:id`, auth, async (req, res) => {
    try {
      await ensureDBConnection();
      const deleted = await Model.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다.' });
      res.json({ success: true, data: deleted, message: '삭제 완료' });
    } catch (error) {
      console.error(`SSO ${type} 삭제 오류:`, error);
      res.status(500).json({ success: false, message: `${type} 삭제 실패`, error: error.message });
    }
  });
});

module.exports = router;
