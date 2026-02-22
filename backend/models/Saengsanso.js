const mongoose = require('mongoose');

// ─── 전시 (sso_exhibitions) ───
const exhibitionSchema = new mongoose.Schema({
  year: { type: String, required: true },
  date: { type: String, required: true },
  title: { type: String, required: true },
  venue: { type: String, default: '' },
  note: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_exhibitions' });

// ─── 프로젝트 (sso_projects) ───
const projectSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['EXHIBITION', 'SOUNDSCAPE', 'COLLABORATION', 'RESIDENCY', 'WORKSHOP & COMMUNITY']
  },
  date: { type: String, required: true },
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_projects' });

// ─── 뉴스 (sso_news) ───
const newsSchema = new mongoose.Schema({
  date: { type: String, required: true },
  title: { type: String, required: true },
  source: { type: String, default: '' },
  category: {
    type: String,
    required: true,
    enum: ['notice', 'press']
  },
  url: { type: String, default: '' },
  content: { type: String, default: '' },
  images: { type: String, default: '' }, // 쉼표 구분 이미지 URL
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_news' });

// ─── 아카이브 (sso_archives) ───
const archiveSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: { type: String, required: true },
  bg: { type: String, default: '' },
  image: { type: String, default: '' },
  video: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_archives' });

// ─── 슬라이드 (sso_slides) ───
const slideSchema = new mongoose.Schema({
  caption: { type: String, default: '' },
  bg: { type: String, default: '' },
  image: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_slides' });

// ─── ABOUT 텍스트 (sso_about) — 단일 문서 ───
const aboutSchema = new mongoose.Schema({
  description: {
    type: String,
    default: '생산소는\n지역 리서치를 기반으로 활동하는 뉴미디어 아티스트 듀오 노드 트리의 작업 과정에서,\n적정한 규모의 도시에 대한 질문을 바탕으로\n마을에서 어떻게 관계를 맺고 어떤 태도로 실천되는지를 기록하는 공간입니다.\n마을에서 마음을 나누며, 감각과 이야기를 축적하고 있습니다'
  },
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'sso_about' });

module.exports = {
  SaengsansoExhibition: mongoose.model('SaengsansoExhibition', exhibitionSchema),
  SaengsansoProject: mongoose.model('SaengsansoProject', projectSchema),
  SaengsansoNews: mongoose.model('SaengsansoNews', newsSchema),
  SaengsansoArchive: mongoose.model('SaengsansoArchive', archiveSchema),
  SaengsansoSlide: mongoose.model('SaengsansoSlide', slideSchema),
  SaengsansoAbout: mongoose.model('SaengsansoAbout', aboutSchema),
};
