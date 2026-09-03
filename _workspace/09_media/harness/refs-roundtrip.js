// DB 참조 치환 왕복 검증 (치환 → 확인 → 롤백 → 원상복구 확인)
//
//   ⚠️ 쓰기 범위: 운영 DB 의 `imagekit_ref_test`(임시) + `imagekit_ref_log`(감사 로그) 두 개뿐.
//      다른 컬렉션에는 절대 쓰지 않는다 — applyMappings 에 only:[TEST_COLLECTION] 을 넘겨
//      스캔·쓰기 대상을 그 컬렉션으로 못박는다. 종료 시 임시 컬렉션을 drop 한다.
//      (로컬 mongod / mongodb-memory-server 가 없어 이 방식을 택했다. README 참고.)
//
//   실행: node _workspace/09_media/harness/refs-roundtrip.js
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const { MongoClient } = require(path.join(ROOT, 'backend/node_modules/mongodb'));
const ikRefsDb = require(path.join(ROOT, 'backend/lib/ikRefsDb'));
const { fileMoveMapping, folderRenameMapping } = require(path.join(ROOT, 'backend/lib/ikRefs'));

const EP = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/gc3jtyt9o';
const TEST = ikRefsDb.TEST_COLLECTION;

// 운영 데이터의 까다로운 형태를 그대로 흉내낸 픽스처
function fixtures() {
  const nfd = '다'.normalize('NFD');
  return [
    {
      _id: 'doc-html',
      title: 'HTML 본문',
      contents:
        `<p>앞</p><img src="${EP}/_ikreftest/old/1.jpg" alt="a">` +
        `<img src='${EP}/_ikreftest/old/deep/2.png?tr=w-800'>` +
        `<a href="${EP}/_ikreftest/older/3.jpg">건드리면 안 됨</a>`,
    },
    {
      _id: 'doc-nested',
      thumbnail: `${EP}/_ikreftest/old/t.jpg?updatedAt=1781308372946`,
      imageLayout: [{ src: `${EP}/_ikreftest/old/a.jpg` }, { src: `${EP}/keepme/b.jpg` }],
      data: {
        'signal-map': { photos: [`${EP}/_ikreftest/old/p1.jpg`, `${EP}/_ikreftest/old/p2.jpg`] },
        members: { k: { character: `${EP}/_ikreftest/old/m.png` } },
      },
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      num: 7,
    },
    {
      _id: 'doc-encoded',
      // 퍼센트 인코딩 + NFD 자모 분리 — 운영 DB 에 실제로 존재하는 형태
      raw: `${EP}/_ikreftest/한글/사진.jpg`,
      encoded: `${EP}/_ikreftest/${encodeURIComponent('한글')}/${encodeURIComponent('사진')}.jpg`,
      nfd: `${EP}/_ikreftest/${encodeURIComponent(nfd)}/x.jpg`,
    },
    { _id: 'doc-untouched', note: '참조 없음', url: 'https://example.com/a.jpg' },
  ];
}

/** 순서 무관 비교를 위해 _id 키 객체로 변환(Date 등은 JSON 직렬화로 정규화) */
function keyById(docs) {
  const out = {};
  for (const d of docs) out[d._id] = JSON.parse(JSON.stringify(d));
  return out;
}

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${label}\n        ${e.message}`);
  }
}

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const col = db.collection(TEST);

  console.log(`쓰기 대상: ${TEST} (임시) + ${ikRefsDb.LOG_COLLECTION} (로그) — 그 외 컬렉션 쓰기 없음\n`);

  await col.deleteMany({});
  const before = fixtures();
  await col.insertMany(before.map((d) => ({ ...d })));
  console.log(`픽스처 ${before.length}건 삽입`);

  // ── 1) 폴더 이름변경 매핑 적용 ──────────────────────────────
  const mappings = [folderRenameMapping('/_ikreftest/old', 'renamed')];
  console.log(`\n[1] 매핑 적용: ${JSON.stringify(mappings)}`);

  const dry = await ikRefsDb.applyMappings(db, mappings, { dryRun: true, only: [TEST], includeTest: true });
  console.log(`    dry-run  → 문서 ${dry.documents}건 / 참조 ${JSON.stringify(dry.refsUpdated)}`);
  const dryDocs = await col.find({}).toArray();
  check('dry-run 은 DB 를 바꾸지 않는다', () => assert.deepEqual(keyById(dryDocs), keyById(before)));

  const applied = await ikRefsDb.applyMappings(db, mappings, { only: [TEST], includeTest: true, actor: 'harness' });
  console.log(`    apply    → 문서 ${applied.documents}건 / 참조 ${JSON.stringify(applied.refsUpdated)} / batch ${applied.batchId}`);
  check('dry-run 과 apply 의 건수가 일치', () => assert.equal(dry.refsUpdated[TEST], applied.refsUpdated[TEST]));
  check('실패 0건', () => assert.equal(applied.failures.length, 0));

  const after = await col.find({}).sort({ _id: 1 }).toArray();
  const byId = Object.fromEntries(after.map((d) => [d._id, d]));

  check('HTML: img src 2건 치환', () => {
    assert.ok(byId['doc-html'].contents.includes(`${EP}/_ikreftest/renamed/1.jpg`));
    assert.ok(byId['doc-html'].contents.includes(`${EP}/_ikreftest/renamed/deep/2.png?tr=w-800`), '쿼리 보존');
  });
  check('HTML: /older 접두사 오매칭 없음', () =>
    assert.ok(byId['doc-html'].contents.includes(`${EP}/_ikreftest/older/3.jpg`))
  );
  check('HTML: 주변 마크업 보존', () => assert.ok(byId['doc-html'].contents.includes('alt="a"')));
  check('중첩: thumbnail(?updatedAt 보존)', () =>
    assert.equal(byId['doc-nested'].thumbnail, `${EP}/_ikreftest/renamed/t.jpg?updatedAt=1781308372946`)
  );
  check('중첩: 배열 원소', () => {
    assert.equal(byId['doc-nested'].imageLayout[0].src, `${EP}/_ikreftest/renamed/a.jpg`);
    assert.equal(byId['doc-nested'].imageLayout[1].src, `${EP}/keepme/b.jpg`, '무관 경로 불변');
  });
  check('중첩: 임의 키 아래 배열(photos)', () =>
    assert.deepEqual(byId['doc-nested'].data['signal-map'].photos, [
      `${EP}/_ikreftest/renamed/p1.jpg`,
      `${EP}/_ikreftest/renamed/p2.jpg`,
    ])
  );
  check('중첩: 설정 트리(members.k.character)', () =>
    assert.equal(byId['doc-nested'].data.members.k.character, `${EP}/_ikreftest/renamed/m.png`)
  );
  check('Date/숫자 타입 보존', () => {
    assert.ok(byId['doc-nested'].updatedAt instanceof Date);
    assert.equal(byId['doc-nested'].updatedAt.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(byId['doc-nested'].num, 7);
  });
  check('참조 없는 문서는 그대로', () => {
    assert.equal(byId['doc-untouched'].url, 'https://example.com/a.jpg');
    assert.equal(byId['doc-untouched'].note, '참조 없음');
  });

  // ── 2) 인코딩/NFD 매핑 ──────────────────────────────────────
  console.log('\n[2] 한글 인코딩·NFD 매핑');
  const encMap = [
    { from: '/_ikreftest/한글', to: '/_ikreftest/한글이동', kind: 'folder' },
    { from: `/_ikreftest/다`, to: '/_ikreftest/다이동', kind: 'folder' },
  ];
  const encApplied = await ikRefsDb.applyMappings(db, encMap, { only: [TEST], includeTest: true, actor: 'harness' });
  console.log(`    apply → 참조 ${JSON.stringify(encApplied.refsUpdated)}`);
  const enc = await col.findOne({ _id: 'doc-encoded' });
  check('원문 한글 경로 치환(원문 스타일 유지)', () =>
    assert.equal(enc.raw, `${EP}/_ikreftest/한글이동/사진.jpg`)
  );
  check('퍼센트 인코딩 경로 치환(인코딩 스타일 유지)', () => {
    assert.ok(/%/.test(enc.encoded), '인코딩 형태 유지');
    assert.equal(decodeURIComponent(enc.encoded), `${EP}/_ikreftest/한글이동/사진.jpg`);
  });
  check('NFD 인코딩 경로도 NFC 매핑에 걸린다', () =>
    assert.equal(decodeURIComponent(enc.nfd).normalize('NFC'), `${EP}/_ikreftest/다이동/x.jpg`)
  );

  // ── 3) 롤백 ─────────────────────────────────────────────────
  console.log('\n[3] 롤백(배치 단위, 최신 배치부터)');
  const r2 = await ikRefsDb.rollback(db, { batchId: encApplied.batchId });
  const r1 = await ikRefsDb.rollback(db, { batchId: applied.batchId });
  console.log(`    복원 ${JSON.stringify(r2.restored)} + ${JSON.stringify(r1.restored)}`);
  const restored = await col.find({}).toArray();
  // 문서 순서는 의미가 없다 — _id 로 키를 잡아 내용만 비교한다.
  check('롤백 후 모든 문서가 원본과 동일', () => assert.deepEqual(keyById(restored), keyById(before)));
  check('롤백 실패 0건', () => assert.equal(r1.failures.length + r2.failures.length, 0));

  const again = await ikRefsDb.rollback(db, { batchId: applied.batchId }).catch((e) => e);
  check('이미 롤백된 배치는 404', () => assert.equal(again.status, 404));

  // ── 4) findRefs 가 임시 컬렉션을 기본 스캔에서 제외하는지 ──
  console.log('\n[4] 기본 스캔은 임시 컬렉션을 제외한다');
  const names = await ikRefsDb.listScannableCollections(db);
  check(`목록에 ${TEST} 없음`, () => assert.ok(!names.includes(TEST)));
  check(`목록에 ${ikRefsDb.LOG_COLLECTION} 없음`, () => assert.ok(!names.includes(ikRefsDb.LOG_COLLECTION)));

  // ── 정리 ────────────────────────────────────────────────────
  await col.drop().catch(() => {});
  const delLogs = await db.collection(ikRefsDb.LOG_COLLECTION).deleteMany({ actor: 'harness' });
  console.log(`\n정리: ${TEST} drop, 하네스 로그 ${delLogs.deletedCount}건 삭제`);
  await c.close();

  console.log(`\n결과: 실패 ${failures}건`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
