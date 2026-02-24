/**
 * 빌드 시 MongoDB에서 생산소 데이터를 가져와 FALLBACK 파일을 자동 생성
 * - Vercel 빌드 시 prebuild 단계에서 실행
 * - DB 연결 실패 시 기존 fallback 파일 유지 (빌드 중단 없음)
 */
const path = require('path');
const fs = require('fs');

async function generateFallback() {
  const OUTPUT = path.join(__dirname, '..', 'src', 'data', 'saengsansoFallback.ts');

  let mongoose;
  try {
    mongoose = require('mongoose');
  } catch {
    // 프론트엔드 빌드 환경에서 mongoose가 없을 수 있음
    const { execSync } = require('child_process');
    console.log('[fallback] mongoose 설치 중...');
    execSync('npm install mongoose --no-save', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    mongoose = require('mongoose');
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.log('[fallback] MONGODB_URI 없음 — 기존 fallback 유지');
    return;
  }

  try {
    console.log('[fallback] MongoDB 연결 중...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      family: 4,
    });

    // 스키마 정의 (모델 파일 의존 없이 독립 실행)
    const exhSchema = new mongoose.Schema({}, { strict: false, collection: 'sso_exhibitions' });
    const prjSchema = new mongoose.Schema({}, { strict: false, collection: 'sso_projects' });
    const nwsSchema = new mongoose.Schema({}, { strict: false, collection: 'sso_news' });
    const arcSchema = new mongoose.Schema({}, { strict: false, collection: 'sso_archives' });
    const sldSchema = new mongoose.Schema({}, { strict: false, collection: 'sso_slides' });

    const Exh = mongoose.models.FBExh || mongoose.model('FBExh', exhSchema);
    const Prj = mongoose.models.FBPrj || mongoose.model('FBPrj', prjSchema);
    const Nws = mongoose.models.FBNws || mongoose.model('FBNws', nwsSchema);
    const Arc = mongoose.models.FBArc || mongoose.model('FBArc', arcSchema);
    const Sld = mongoose.models.FBSld || mongoose.model('FBSld', sldSchema);

    console.log('[fallback] 데이터 조회 중...');
    const [exhibitions, projects, news, archive, slides] = await Promise.all([
      Exh.find().sort({ sortOrder: 1, year: -1, _id: -1 }).lean(),
      Prj.find().sort({ sortOrder: 1, _id: -1 }).lean(),
      Nws.find().sort({ sortOrder: 1, _id: -1 }).lean(),
      Arc.find().sort({ sortOrder: 1, _id: -1 }).lean(),
      Sld.find().sort({ sortOrder: 1, _id: 1 }).lean(),
    ]);

    function pick(obj, fields) {
      const r = {};
      for (const f of fields) if (obj[f] !== undefined) r[f] = obj[f];
      return r;
    }

    const exh = exhibitions.map(e => pick(e, ['year', 'date', 'title', 'venue', 'note']));
    const prj = projects.map(p => pick(p, ['category', 'date', 'title', 'detail']));
    const nws = news.map(n => pick(n, ['date', 'title', 'source', 'category', 'url', 'content', 'images']));
    const arc = archive.map(a => pick(a, ['title', 'year', 'bg', 'image', 'video']));
    const sld = slides.map(s => ({
      _id: s._id.toString().slice(-4),
      ...pick(s, ['bg', 'caption', 'image']),
    }));

    const ts = `// 자동 생성 파일 — scripts/generate-fallback.js
// 생성 시각: ${new Date().toISOString()}
// 수동 편집 금지: 빌드 시 DB에서 자동 갱신됨

export const FALLBACK_EXHIBITIONS = ${JSON.stringify(exh, null, 2)};

export const FALLBACK_PROJECTS = ${JSON.stringify(prj, null, 2)};

export const FALLBACK_NEWS: any[] = ${JSON.stringify(nws, null, 2)};

export const FALLBACK_ARCHIVES = ${JSON.stringify(arc, null, 2)};

export const FALLBACK_SLIDES = ${JSON.stringify(sld, null, 2)};
`;

    fs.writeFileSync(OUTPUT, ts, 'utf8');
    console.log(`[fallback] 생성 완료 — ${exh.length}개 전시, ${prj.length}개 프로젝트, ${nws.length}개 뉴스, ${arc.length}개 아카이브, ${sld.length}개 슬라이드`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('[fallback] DB 조회 실패 — 기존 fallback 유지:', err.message);
    try { await mongoose.disconnect(); } catch {}
  }
}

generateFallback();
