// 운영 DB 읽기 전용 검증: buildRefIndex 결과가 독립 스캔(refs.json)과 일치하는지 대조한다.
//   실행: node _workspace/09_media/harness/verify-refs-index.js [refs.json 경로]
//   ⚠️ 읽기 전용 — 쓰기 호출 없음.
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const { MongoClient } = require(path.join(ROOT, 'backend/node_modules/mongodb'));
const { buildRefIndex, findRefs } = require(path.join(ROOT, 'backend/lib/ikRefsDb'));
const { canonPath } = require(path.join(ROOT, 'backend/lib/ikRefs'));

// 리드가 만든 독립 스캔 결과(refs.json)와 교차 검증한다. 경로는 인자로 넘길 수 있다.
const LEAD = process.argv[2] || null;

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  const t0 = Date.now();
  const idx = await buildRefIndex(db);
  const ms = Date.now() - t0;
  console.log(`내 인덱스: 컬렉션 ${idx.stats.collections} · 문서 ${idx.stats.docs} · 참조 ${idx.stats.refs} · 고유경로 ${idx.stats.uniquePaths}  (${ms}ms)`);

  if (!LEAD) {
    console.log('\n(교차 검증 생략 — 비교할 refs.json 경로를 인자로 넘기면 대조한다)');
    await c.close();
    return;
  }
  const lead = require(LEAD);
  const leadPaths = new Set(lead.map((r) => canonPath(r.path)));
  console.log(`리드 스캔  : 참조 ${lead.length} · 고유경로(canonical 재계산) ${leadPaths.size}`);

  // 교차 검증
  const mine = new Set(idx.byPath.keys());
  const missing = [...leadPaths].filter((p) => !mine.has(p));
  const extra = [...mine].filter((p) => !leadPaths.has(p));
  console.log(`\n리드에는 있는데 내가 못 찾은 경로: ${missing.length}`);
  missing.slice(0, 10).forEach((p) => console.log('   -', p));
  console.log(`내가 더 찾은 경로: ${extra.length}`);
  extra.slice(0, 10).forEach((p) => console.log('   +', p));

  // 컬렉션.필드 분포 비교
  const mineFields = {};
  for (const [, list] of idx.byPath) {
    for (const r of list) {
      const k = `${r.collection}.${r.field.replace(/\[\d+\]/g, '[]')}`;
      mineFields[k] = (mineFields[k] || 0) + 1;
    }
  }
  const leadFields = {};
  for (const r of lead) {
    const k = `${r.collection}.${r.field.replace(/\[\d+\]/g, '[]')}`;
    leadFields[k] = (leadFields[k] || 0) + 1;
  }
  const allKeys = new Set([...Object.keys(mineFields), ...Object.keys(leadFields)]);
  const diffs = [...allKeys].filter((k) => (mineFields[k] || 0) !== (leadFields[k] || 0));
  console.log(`\ncollection.field 분포 불일치: ${diffs.length}`);
  diffs.forEach((k) => console.log(`   ${k}: 내 ${mineFields[k] || 0} vs 리드 ${leadFields[k] || 0}`));

  // findRefs 로 331 경로 전부 조회 — 하나도 0건이 아니어야 한다
  const allPaths = [...leadPaths];
  const res = await findRefs(db, allPaths, { kinds: Object.fromEntries(allPaths.map((p) => [p, 'file'])) });
  const zero = res.filter((r) => r.count === 0);
  const total = res.reduce((s, r) => s + r.count, 0);
  console.log(`\nfindRefs(file) 로 ${allPaths.length}개 경로 조회 → 매칭 총 ${total}건, 0건인 경로 ${zero.length}개`);
  zero.slice(0, 10).forEach((r) => console.log('   0건:', r.path));

  // 폴더 단위 조회 샘플
  const folderSample = ['/mcwjd/생산소/포스터', '/mcwjd/workshop', '/mcwjd'];
  for (const f of folderSample) {
    const [r] = await findRefs(db, [f], { kinds: { [f]: 'folder' } });
    console.log(`폴더 ${f} → ${r.count}건`, JSON.stringify(r.byCollection));
  }

  await c.close();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
