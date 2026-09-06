// CLI 롤백에서 **DB 배치가 실제로 존재하는 경우**를 검증한다.
//   cli-resume-live.js 는 참조 0건(dbBatchId=null) 경로를 다루므로, 여기서 반대편을 덮는다.
//
//   쓰기 범위
//     · ImageKit : /_ik-test/clidb 하위만 (finally 에서 /_ik-test 삭제)
//     · DB       : 임시 컬렉션 _ikcli_probe_tmp (finally 에서 drop)
//                  + imagekit_ref_log 중 **이 실행이 만든 batchId 만** 삭제
//                  ⚠️ actor 로 싹 지우면 운영 CLI 감사 로그까지 날아간다 — 절대 금지.
//   ⚠️ imagekit_ref_test 는 기본 스캔에서 제외되는 컬렉션이라 CLI 가 보지 못한다.
//      그래서 스캔 대상이 되는 별도 임시 컬렉션을 쓴다. 매핑 경로(/_ik-test/...)는
//      운영 문서 어디에도 없으므로 다른 컬렉션은 변경되지 않는다(0 hit → 쓰기 없음).
//
//   실행: node _workspace/09_media/harness/cli-dbrollback-live.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const ImageKit = require(path.join(ROOT, 'backend/node_modules/imagekit'));
const { MongoClient } = require(path.join(ROOT, 'backend/node_modules/mongodb'));
const ikRefsDb = require(path.join(ROOT, 'backend/lib/ikRefsDb'));

const EP = process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, '');
const ik = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: EP,
});
const F = fs.readFileSync(path.join(__dirname, 'fixtures/exif6.jpg'));
const CLI = path.join(ROOT, 'backend/scripts/ikReorganize.js');
const TESTCOL = '_ikcli_probe_tmp';
const B = '/_ik-test/clidb';

let fails = 0;
const check = (l, c, d = '') => {
  if (c) console.log(`  PASS  ${l}${d ? ' — ' + d : ''}`);
  else {
    fails += 1;
    console.log(`  FAIL  ${l}${d ? ' — ' + d : ''}`);
  }
};
const run = (a) => {
  try {
    return execFileSync('node', [CLI, ...a], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
};

/** 파일이 목록(검색 인덱스)에 나타날 때까지 대기 */
async function waitIndexed(folder, name, tries = 12, waitMs = 2000) {
  for (let i = 0; i < tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await ik.listFiles({ path: folder, type: 'file', limit: 50 }).catch(() => []);
    if (rows.some((f) => f.name === name)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return false;
}

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ikdb-'));
  let mc = null;
  const createdBatchIds = new Set(); // 이 실행이 만든 로그 배치만 정리한다

  try {
    await ik.deleteFolder(B).catch(() => {});
    const u = await ik.upload({ file: F, fileName: 'r.jpg', folder: `${B}/src`, useUniqueFileName: false });

    mc = new MongoClient(process.env.MONGODB_URI);
    await mc.connect();
    const db = mc.db();
    await db.collection(TESTCOL).deleteMany({});
    await db.collection(TESTCOL).insertOne({ _id: 'cli-doc', html: `<img src="${EP}${u.filePath}">` });

    // CLI 의 존재 검사는 listFiles 기반이라 반영을 충분히 기다린다.
    check('업로드가 목록 인덱스에 반영됨', await waitIndexed(`${B}/src`, 'r.jpg'));

    fs.writeFileSync(path.join(out, 'm.tsv'), `${B}/src/r.jpg\t${B}/dst/r.jpg\tfile\n`);

    // ── apply ────────────────────────────────────────────────
    const o1 = run([path.join(out, 'm.tsv'), '--apply', '--yes', '--out', out]);
    console.log(o1.split('\n').filter((l) => /^\[\d|완료:|인덱스 지연/.test(l)).map((l) => '    ' + l).join('\n'));
    const rep = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
    const row = rep.results[0];
    if (row && row.dbBatchId) createdBatchIds.add(row.dbBatchId);

    check('dbBatchId 가 기록됨(참조 1건)', !!row.dbBatchId, `dbBatchId=${row.dbBatchId} docs=${row.dbDocuments}`);
    check('newFileId 가 기록됨(롤백에서 fileId 로 되찾기 위해)', !!row.newFileId, `newFileId=${row.newFileId}`);
    const doc1 = await db.collection(TESTCOL).findOne({ _id: 'cli-doc' });
    check('DB 참조가 새 경로로 갱신', doc1.html.includes(`${B}/dst/r.jpg`), doc1.html);

    // ── rollback (인덱스 반영 전에 즉시 실행 — fileId 승계가 없으면 여기서 깨진다) ──
    const o2 = run(['--rollback', path.join(out, 'report.json')]);
    console.log(o2.split('\n').filter((l) => /^\[\d|되돌리기|실패 항목/.test(l)).map((l) => '    ' + l).join('\n'));
    check('파일 복원 성공(fileId 승계 확인)', /파일 복원 OK/.test(o2), (/파일 복원[^·\n]*/.exec(o2) || [''])[0]);
    check('DB 롤백이 실제로 복원됨', /DB 롤백 ok\(1건\)/.test(o2), (/DB 롤백 [^\n]*/.exec(o2) || [''])[0]);
    check('되돌리기 1/1', /되돌리기 완료: 1\/1/.test(o2), (/되돌리기 완료: .*/.exec(o2) || [''])[0]);

    const doc2 = await db.collection(TESTCOL).findOne({ _id: 'cli-doc' });
    check('DB 참조가 원래 경로로 복원', doc2.html.includes(`${B}/src/r.jpg`), doc2.html);

    // 파일과 DB 가 같은 곳을 가리키는지(불일치 없음)
    const backIndexed = await waitIndexed(`${B}/src`, 'r.jpg');
    check('파일도 원래 폴더에 있음(DB↔파일 일치)', backIndexed);
  } finally {
    // ── 정리: 실패·예외 여부와 무관하게 항상 수행 ───────────────
    console.log('\n[정리]');
    await ik.deleteFolder('/_ik-test').catch((e) => console.log('  ImageKit 삭제 오류:', e.message));
    if (mc) {
      const db = mc.db();
      await db.collection(TESTCOL).drop().catch(() => {});
      let removed = 0;
      for (const id of createdBatchIds) {
        // eslint-disable-next-line no-await-in-loop
        const r = await db.collection(ikRefsDb.LOG_COLLECTION).deleteMany({ batchId: id });
        removed += r.deletedCount;
      }
      console.log(`  ${TESTCOL} drop · 이 실행이 만든 로그 배치 ${createdBatchIds.size}개(${removed}건) 삭제`);
      await mc.close().catch(() => {});
    }
    fs.rmSync(out, { recursive: true, force: true });
  }

  console.log(`\n결과: 실패 ${fails}건`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
