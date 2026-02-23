const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const {
  SaengsansoExhibition,
  SaengsansoProject,
  SaengsansoNews,
  SaengsansoArchive,
  SaengsansoSlide,
  SaengsansoAbout,
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
  slides: SaengsansoSlide,
};

const SORT_FIELDS = {
  exhibitions: { sortOrder: 1, year: -1, _id: -1 },
  projects: { sortOrder: 1, _id: -1 },
  news: { sortOrder: 1, _id: -1 },
  archive: { sortOrder: 1, _id: -1 },
  slides: { sortOrder: 1, _id: 1 },
};

// ─── GET /api/saengsanso/all — 생산소 전체 데이터 통합 조회 ───
router.get('/all', async (req, res) => {
  try {
    await ensureDBConnection();

    const [exhibitions, projects, news, archive, slides, aboutDoc] = await Promise.all([
      SaengsansoExhibition.find().sort(SORT_FIELDS.exhibitions),
      SaengsansoProject.find().sort(SORT_FIELDS.projects),
      SaengsansoNews.find().sort(SORT_FIELDS.news),
      SaengsansoArchive.find().sort(SORT_FIELDS.archive),
      SaengsansoSlide.find().sort(SORT_FIELDS.slides),
      SaengsansoAbout.findOne({ isActive: true }),
    ]);

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({
      success: true,
      exhibitions: { success: true, data: exhibitions },
      projects: { success: true, data: projects },
      news: { success: true, data: news },
      archive: { success: true, data: archive },
      slides: { success: true, data: slides },
      about: { success: true, data: aboutDoc },
    });
  } catch (error) {
    console.error('SSO all 통합 조회 오류:', error);
    res.status(500).json({ success: false, message: '통합 데이터 조회에 실패했습니다.', error: error.message });
  }
});

// ─── 공통 CRUD 라우트 생성 ───
Object.entries(MODELS).forEach(([type, Model]) => {
  // GET — 목록 조회 (공개)
  router.get(`/${type}`, async (req, res) => {
    try {
      await ensureDBConnection();
      res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
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

// ─── ABOUT 텍스트 전용 라우트 (단일 문서) ───
const DEFAULT_ABOUT = '생산소는\n지역 리서치를 기반으로 활동하는 뉴미디어 아티스트 듀오 노드 트리의 작업 과정에서,\n적정한 규모의 도시에 대한 질문을 바탕으로\n마을에서 어떻게 관계를 맺고 어떤 태도로 실천되는지를 기록하는 공간입니다.\n마을에서 마음을 나누며, 감각과 이야기를 축적하고 있습니다';

router.get('/about-page', async (req, res) => {
  try {
    await ensureDBConnection();
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    let doc = await SaengsansoAbout.findOne({ isActive: true });
    if (!doc) {
      doc = await SaengsansoAbout.create({ description: DEFAULT_ABOUT });
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('SSO about 조회 오류:', error);
    res.status(500).json({ success: false, message: 'about 조회 실패', error: error.message });
  }
});

router.put('/about-page', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    const { description } = req.body;
    let doc = await SaengsansoAbout.findOne({ isActive: true });
    if (!doc) {
      doc = await SaengsansoAbout.create({ description: description || DEFAULT_ABOUT });
    } else {
      doc.description = description ?? doc.description;
      doc.updatedAt = new Date();
      await doc.save();
    }
    res.json({ success: true, data: doc, message: 'about 수정 완료' });
  } catch (error) {
    console.error('SSO about 수정 오류:', error);
    res.status(500).json({ success: false, message: 'about 수정 실패', error: error.message });
  }
});

// ─── 이미지 프록시 (CORS 우회) ───
router.get('/image-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'url 파라미터 필요' });
    const fetch = (await import('node-fetch')).default;
    const imgRes = await fetch(url, { timeout: 8000 });
    if (!imgRes.ok) return res.status(400).end();
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', imgRes.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    imgRes.body.pipe(res);
  } catch {
    res.status(500).end();
  }
});

module.exports = router;
