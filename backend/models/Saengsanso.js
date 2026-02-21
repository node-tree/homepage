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
    enum: ['SOUNDSCAPE', 'RESIDENCY', 'WORKSHOP & COMMUNITY', 'AWARD']
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
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_news' });

// ─── 아카이브 (sso_archives) ───
const archiveSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: { type: String, required: true },
  bg: { type: String, default: '' },
  image: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'sso_archives' });

module.exports = {
  SaengsansoExhibition: mongoose.model('SaengsansoExhibition', exhibitionSchema),
  SaengsansoProject: mongoose.model('SaengsansoProject', projectSchema),
  SaengsansoNews: mongoose.model('SaengsansoNews', newsSchema),
  SaengsansoArchive: mongoose.model('SaengsansoArchive', archiveSchema),
};
