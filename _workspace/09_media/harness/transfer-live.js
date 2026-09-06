// 복제 방식 이동/복사 실측 — 전부 /_ik-test/ 안에서만 수행하고 마지막에 폴더째 삭제한다.
//   운영의 다른 폴더에는 접근하지 않는다(경로 상수 TEST 고정, 목록 조회도 TEST 하위만).
//
//   DB 결합 검증은 임시 컬렉션 imagekit_ref_test 에 한정한다(only 인자로 못박음).
//
//   ⚠️ 업로드 직후에는 ImageKit 목록(검색 인덱스)이 아직 반영되지 않는다.
//      경로로만 원본을 찾게 하면 404 가 나서 "다른 이유로 실패"하고, 느슨한 assertion 이
//      그걸 통과로 오탐한다(실제로 그렇게 허위 PASS 가 났다).
//      → 업로드 응답의 fileId 를 그대로 넘긴다. 경로 해석 경로를 검증할 때만
//        waitIndexed() 로 인덱스 반영을 기다린 뒤 호출한다.
//
//   실행: node _workspace/09_media/harness/transfer-live.js
const path = require('path');
const fs = require('fs');
const https = require('https');

const ROOT = path.resolve(__dirname, '../../..');
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const ImageKit = require(path.join(ROOT, 'backend/node_modules/imagekit'));
const { MongoClient } = require(path.join(ROOT, 'backend/node_modules/mongodb'));
const ikTransfer = require(path.join(ROOT, 'backend/lib/ikTransfer'));
const ikRefsDb = require(path.join(ROOT, 'backend/lib/ikRefsDb'));

const EP = process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, '');
const ik = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: EP,
});
const TEST = '/_ik-test';
const TESTCOL = ikRefsDb.TEST_COLLECTION;
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/exif6.jpg'));

let fails = 0;
function check(label, cond, detail = '') {
  if (cond) console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
  else {
    fails += 1;
    console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}
const head = (u) =>
  new Promise((r) =>
    https.get(u, (s) => {
      const c = [];
      s.on('data', (d) => c.push(d));
      s.on('end', () => r({ status: s.statusCode, len: Buffer.concat(c).length }));
    }).on('error', () => r({ status: 0, len: 0 }))
  );
const enc = (p) => EP + p.split('/').map(encodeURIComponent).join('/');

/** fileId 로 실제 존재 확인 — CDN 캐시의 영향을 받지 않는 권위 있는 확인. */
async function existsById(fileId) {
  try {
    await ik.getFileDetails(fileId);
    return true;
  } catch (e) {
    if (/not\s*found|does\s*not\s*exist|no\s*such/i.test(e.message || '') || e?.$ResponseMetadata?.statusCode === 404) return false;
    throw e;
  }
}

/** 목록은 검색 인덱스라 반영이 늦다 — 기대값이 나올 때까지 잠깐 재시도. */
async function listRetry(folder, expect, tries = 6, waitMs = 1500) {
  let rows = [];
  for (let i = 0; i < tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    rows = await ik.listFiles({ path: folder, type: 'file', limit: 100 }).catch(() => []);
    if (rows.length === expect) return rows;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return rows;
}

/** 업로드한 파일이 목록(검색 인덱스)에 나타날 때까지 대기 — 경로 해석 경로 검증용 */
async function waitIndexed(filePath, tries = 10, waitMs = 1500) {
  const parent = filePath.slice(0, filePath.lastIndexOf('/')) || '/';
  for (let i = 0; i < tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await ik.listFiles({ path: parent, type: 'file', limit: 100 }).catch(() => []);
    if (rows.some((f) => f.filePath === filePath)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return false;
}

/**
 * 같은 그림이지만 **바이트 크기가 다른** JPEG 를 만든다.
 *   SOI 직후에 COM(주석, 0xFFFE) 세그먼트를 끼운다 — 디코더는 무시하므로 해상도는 그대로고
 *   파일 크기만 늘어난다. CDN 스테일 재현에 필요한 "같은 경로 · 다른 크기" 를 만들기 위함.
 */
function withComment(buf, padBytes) {
  const len = padBytes + 2;
  const seg = Buffer.concat([
    Buffer.from([0xff, 0xfe, (len >> 8) & 0xff, len & 0xff]),
    Buffer.alloc(padBytes, 0x20),
  ]);
  return Buffer.concat([buf.slice(0, 2), seg, buf.slice(2)]);
}

async function upload(name, folder) {
  return ik.upload({ file: FIXTURE, fileName: name, folder, useUniqueFileName: false });
}

(async () => {
  const mc = new MongoClient(process.env.MONGODB_URI);
  await mc.connect();
  const db = mc.db();
  console.log(`대상: ${TEST} (ImageKit) · ${TESTCOL} (DB 임시)\n`);

  // ── 0) 무료 플랜 제약 재확인 ───────────────────────────────────
  console.log('[0] 무료 플랜 move/copy API 제약 재확인');
  const base = await upload('base.jpg', `${TEST}/src`);
  try {
    await ik.moveFile({ sourceFilePath: base.filePath, destinationPath: `${TEST}/dst` });
    check('moveFile 이 실패해야 한다', false, '성공해버림');
  } catch (e) {
    check('moveFile → Versions Limit Exceeded', /Versions Limit Exceeded/i.test(e.message), e.message);
  }
  try {
    await ik.copyFile({ sourceFilePath: base.filePath, destinationPath: `${TEST}/dst` });
    check('copyFile 이 실패해야 한다', false, '성공해버림');
  } catch (e) {
    check('copyFile → Versions Limit Exceeded', /Versions Limit Exceeded/i.test(e.message), e.message);
  }

  // ── 1) move (참조 없음) ────────────────────────────────────────
  console.log('\n[1] transferFile move — 참조 없음 (경로 해석 경로: 인덱스 반영 대기 후)');
  check('업로드 파일이 목록에 반영됨', await waitIndexed(base.filePath));
  const m = await ikTransfer.transferFile({
    ik, db, sourceFilePath: base.filePath, destinationFolder: `${TEST}/dst`,
    mode: 'move', updateRefs: true, actor: 'harness', only: [TESTCOL],
  });
  console.log('   결과:', JSON.stringify({ dst: m.destinationPath, verified: m.verified, refs: m.refs.refsUpdated, del: m.originalDeleted }));
  check('새 경로가 기대와 일치', m.destinationPath === `${TEST}/dst/base.jpg`, m.destinationPath);
  check('크기 보존', m.verified.size === m.verified.sourceSize, `${m.verified.sourceSize} → ${m.verified.size}`);
  check('해상도 보존', m.verified.width === m.verified.sourceWidth && m.verified.height === m.verified.sourceHeight,
    `${m.verified.sourceWidth}x${m.verified.sourceHeight} → ${m.verified.width}x${m.verified.height}`);
  check('원본 삭제됨', m.originalDeleted === true);
  const newUrl = await head(`${enc(m.destinationPath)}?tr=orig-true`);
  check('새 URL 200', newUrl.status === 200, `${newUrl.status} ${newUrl.len}B`);
  // 옛 URL 은 CDN 캐시 때문에 한동안 200 을 낼 수 있다 → 권위 있는 API 로 확인한다.
  check('옛 fileId 가 ImageKit 에서 삭제됨', (await existsById(base.fileId)) === false);
  const oldUrl = await head(`${enc(base.filePath)}?tr=orig-true`);
  console.log(`   (참고) 옛 URL HTTP=${oldUrl.status} — 200 이면 CDN 캐시 잔존, purge 대상`);

  // ── 2) copy ────────────────────────────────────────────────────
  console.log('\n[2] transferFile copy — 원본 유지');
  const c = await ikTransfer.transferFile({
    ik, db, sourceFilePath: m.destinationPath, fileId: m.newFileId,
    destinationFolder: `${TEST}/copy`, mode: 'copy', actor: 'harness', only: [TESTCOL],
  });
  const srcStill = await head(`${enc(m.destinationPath)}?tr=orig-true`);
  const cpUrl = await head(`${enc(c.destinationPath)}?tr=orig-true`);
  check('복사본 200', cpUrl.status === 200, `${cpUrl.status} ${cpUrl.len}B`);
  check('원본도 그대로 200', srcStill.status === 200);
  check('복사는 참조 갱신 안 함', c.refs.skipped === true);

  // ── 3) 동명 충돌 409 ───────────────────────────────────────────
  console.log('\n[3] 동명 충돌');
  try {
    await ikTransfer.transferFile({
      ik, db, sourceFilePath: m.destinationPath, fileId: m.newFileId,
      destinationFolder: `${TEST}/copy`, mode: 'copy', actor: 'harness', only: [TESTCOL],
    });
    check('409 를 던져야 한다', false, '성공해버림');
  } catch (e) {
    // 메시지까지 정확히 맞춰야 한다 — 임의 에러를 통과로 세면 안 된다.
    check('동명 대상 → 409 (메시지 일치)',
      e.status === 409 && /대상에 같은 이름의 파일이 이미 있습니다/.test(e.message),
      `status ${e.status}: ${e.message}`);
  }

  // ── 4) 한글 NFC / NFD ──────────────────────────────────────────
  console.log('\n[4] 한글 파일명 NFC/NFD');
  const nfc = '사진'.normalize('NFC');
  const nfd = '사진'.normalize('NFD');
  const uNfc = await upload(`${nfc}.jpg`, `${TEST}/kor`);
  const uNfd = await upload(`${nfd}2.jpg`, `${TEST}/kor`);
  check('NFD 업로드가 NFD 로 보관됨', uNfd.filePath === `${TEST}/kor/${nfd}2.jpg`, JSON.stringify(uNfd.filePath));
  for (const [label, u] of [['NFC', uNfc], ['NFD', uNfd]]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ikTransfer.transferFile({
      ik, db, sourceFilePath: u.filePath, fileId: u.fileId,
      destinationFolder: `${TEST}/kor2`, mode: 'move', updateRefs: true, actor: 'harness', only: [TESTCOL],
    });
    // eslint-disable-next-line no-await-in-loop
    const ok = await head(`${enc(r.destinationPath)}?tr=orig-true`);
    check(`${label} 이동 후 새 URL 200`, ok.status === 200, `${r.destinationPath} → ${ok.status}`);
    check(`${label} 파일명 형태 보존`, r.destinationPath.endsWith(u.name), JSON.stringify(r.destinationPath));
  }

  // ── 5) bulk 3개 ────────────────────────────────────────────────
  console.log('\n[5] 일괄 이동 3개');
  const bulkSrc = [];
  for (const n of ['b1.jpg', 'b2.jpg', 'b3.jpg']) {
    // eslint-disable-next-line no-await-in-loop
    bulkSrc.push(await upload(n, `${TEST}/bulk`));
  }
  let okCount = 0;
  for (const b of bulkSrc) {
    // eslint-disable-next-line no-await-in-loop
    const r = await ikTransfer.transferFile({
      ik, db, sourceFilePath: b.filePath, fileId: b.fileId,
      destinationFolder: `${TEST}/bulk2`, mode: 'move', updateRefs: true, actor: 'harness', only: [TESTCOL],
    });
    if (r.originalDeleted && r.verified.size === b.size) okCount += 1;
  }
  check('3건 모두 이동·검증 통과', okCount === 3, `${okCount}/3`);
  const left = await listRetry(`${TEST}/bulk`, 0);
  check('원본 폴더가 비었음(목록 인덱스 반영 후)', left.length === 0, `남은 ${left.length}건 ${JSON.stringify(left.map((f) => f.name))}`);
  const aliveIds = [];
  for (const b of bulkSrc) if (await existsById(b.fileId)) aliveIds.push(b.name);
  check('원본 fileId 3건 모두 삭제됨', aliveIds.length === 0, `살아있음: ${JSON.stringify(aliveIds)}`);

  // ── 6) DB 참조 결합 ────────────────────────────────────────────
  console.log('\n[6] DB 참조 갱신 결합');
  const refSrc = await upload('withref.jpg', `${TEST}/refsrc`);
  await db.collection(TESTCOL).deleteMany({});
  await db.collection(TESTCOL).insertOne({
    _id: 'xfer-doc',
    contents: `<img src="${EP}${refSrc.filePath}">`,
    thumb: `${EP}${refSrc.filePath}?tr=w-300`,
  });
  const rMove = await ikTransfer.transferFile({
    ik, db, sourceFilePath: refSrc.filePath, fileId: refSrc.fileId,
    destinationFolder: `${TEST}/refdst`, mode: 'move', updateRefs: true, actor: 'harness', only: [TESTCOL],
  });
  const doc = await db.collection(TESTCOL).findOne({ _id: 'xfer-doc' });
  check('DB 참조 2건 갱신', (rMove.refs.refsUpdated || {})[TESTCOL] === 2, JSON.stringify(rMove.refs.refsUpdated));
  check('contents 가 새 경로', doc.contents.includes(`${EP}${TEST}/refdst/withref.jpg`), doc.contents);
  check('쿼리 보존', doc.thumb === `${EP}${TEST}/refdst/withref.jpg?tr=w-300`, doc.thumb);

  // ── 7) DB 실패 주입 → 보상 ─────────────────────────────────────
  console.log('\n[7] DB 갱신 실패 주입 → 원본 유지 + 새 파일 삭제');
  const failSrc = await upload('failcase.jpg', `${TEST}/failsrc`);
  let thrown = null;
  let injected = false;
  try {
    await ikTransfer.transferFile({
      ik, db, sourceFilePath: failSrc.filePath, fileId: failSrc.fileId, // ← 인덱스 지연 회피
      destinationFolder: `${TEST}/faildst`,
      mode: 'move', updateRefs: true, actor: 'harness', only: [TESTCOL],
      onRefsUpdate: async () => { injected = true; throw new Error('의도적 실패 주입'); },
    });
  } catch (e) { thrown = e; }
  // "아무 에러나 났으면 통과" 는 오탐의 원인이었다 — 주입한 실패가 실제로 실행됐고
  // 기대한 메시지/상태/보상 표시가 모두 맞아야 통과로 센다.
  check('주입한 DB 실패가 실제로 호출됨', injected === true);
  check('보상 경로 진입(500 + 기대 메시지 + compensated)',
    !!thrown && thrown.status === 500 && thrown.compensated === true &&
      /DB 참조 갱신 실패로 이동을 취소했습니다/.test(thrown.message) &&
      /의도적 실패 주입/.test(thrown.message),
    thrown ? `status=${thrown.status} compensated=${thrown.compensated} msg=${thrown.message}` : '(에러 없음)');
  check('원본 fileId 가 살아 있음', (await existsById(failSrc.fileId)) === true);
  const faildst = await listRetry(`${TEST}/faildst`, 0);
  check('대상 폴더에 새 파일이 남지 않음', faildst.length === 0, `남은 ${faildst.length}건`);
  const newGone = await head(`${enc(`${TEST}/faildst/failcase.jpg`)}?tr=orig-true`);
  console.log(`   (참고) 되돌린 새 URL HTTP=${newGone.status} — 200 이면 CDN 캐시 잔존`);

  // ── 8) CDN 스테일 재현 ─────────────────────────────────────
  //   같은 경로에 A → 삭제 → B(다른 크기). CDN 에는 A 의 바이트가 남아 있다.
  //   캐시버스터 없이 ?tr=orig-true 만 붙이면 A 가 오고, transferFile 은
  //   "원본 크기가 메타데이터와 다릅니다" 로 실패한다(리드 실측 2026-09-06).
  console.log('\n[8] CDN 스테일(같은 경로 재업로드) — 캐시버스터로 회피하는지');
  const stalePath = `${TEST}/stale/p.jpg`;
  const A = await upload('p.jpg', `${TEST}/stale`);
  const aUrl = `${enc(stalePath)}?tr=orig-true`;
  const dlLen = (u) =>
    new Promise((r) =>
      https.get(u, (s2) => { const c = []; s2.on('data', (d) => c.push(d)); s2.on('end', () => r(Buffer.concat(c).length)); })
    );
  const aGot = await dlLen(aUrl);
  check('A 다운로드로 CDN 캐시를 채움', aGot === A.size, `${aGot} vs ${A.size}`);

  await ik.deleteFile(A.fileId);
  const B = await ik.upload({
    file: withComment(FIXTURE, 4096), fileName: 'p.jpg', folder: `${TEST}/stale`, useUniqueFileName: false,
  });
  check('B 는 A 와 크기가 다름', B.size !== A.size, `A=${A.size} B=${B.size}`);

  const staleGot = await dlLen(aUrl);
  console.log(`   (관찰) 캐시버스터 없는 ?tr=orig-true → ${staleGot}B   (A=${A.size} / B=${B.size})`);
  console.log(`   → CDN 스테일 ${staleGot === A.size ? '재현됨' : '이번엔 재현 안 됨(캐시 만료)'}`);
  const bustGot = await dlLen(`${aUrl}&ik-cb=${B.fileId}-${Date.now()}`);
  check('캐시버스터를 붙이면 B 가 온다', bustGot === B.size, `${bustGot} vs ${B.size}`);

  const sMove = await ikTransfer.transferFile({
    ik, db, sourceFilePath: B.filePath, fileId: B.fileId,
    destinationFolder: `${TEST}/stale2`, mode: 'move', updateRefs: true, actor: 'harness', only: [TESTCOL],
  });
  check('스테일 상황에서도 이동 성공', !!sMove.destinationPath, sMove.destinationPath);
  check('복제된 크기가 B 와 일치(A 가 아님)', sMove.verified.size === B.size,
    `옮긴 크기=${sMove.verified.size} / A=${A.size} / B=${B.size}`);
  check('해상도 보존', sMove.verified.width === B.width && sMove.verified.height === B.height,
    `${B.width}x${B.height} → ${sMove.verified.width}x${sMove.verified.height}`);


  // ── 정리 ───────────────────────────────────────────────────────
  console.log('\n[정리]');
  await ik.deleteFolder(TEST).catch((e) => console.log('  폴더 삭제 오류:', e.message));
  // 목록은 검색 인덱스라 삭제 반영이 몇 초 늦다 → 재시도로 확인.
  let after = [];
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line no-await-in-loop
    after = await ik.listFiles({ path: TEST, type: 'all', limit: 100 }).catch(() => []);
    if (after.length === 0) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 2000));
  }
  check(`${TEST} 삭제됨`, after.length === 0, `남은 ${after.length}건 ${JSON.stringify(after.map((f) => f.filePath || f.folderPath))}`);
  await db.collection(TESTCOL).drop().catch(() => {});
  const delLogs = await db.collection(ikRefsDb.LOG_COLLECTION).deleteMany({ actor: 'harness' });
  console.log(`  ${TESTCOL} drop, 하네스 로그 ${delLogs.deletedCount}건 삭제`);
  await mc.close();

  console.log(`\n결과: 실패 ${fails}건`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
