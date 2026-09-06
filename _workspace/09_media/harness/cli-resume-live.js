// CLI --apply → (충돌로 중단) → --resume → --rollback 실계정 재현
//   리드가 보고한 결함 2건의 회귀 방지용. 전부 /_ik-test/cli 안에서만 수행하고 마지막에 삭제한다.
//
//   시나리오
//     src/a.jpg, src/b.jpg 를 dst 로 이동. dst/b.jpg 를 미리 두어 [2/2]에서 충돌시킨다.
//     → apply: a 성공, b 실패로 중단(정상)
//     → dst/b.jpg 삭제 후 resume: a 는 "건너뜀", b 만 재시도해 성공해야 한다
//     → rollback: 파일이 src 로 돌아가고, DB 참조 0건인 항목도 "실패"로 세지 않아야 한다
//
//   실행: node _workspace/09_media/harness/cli-resume-live.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env') });
const ImageKit = require(path.join(ROOT, 'backend/node_modules/imagekit'));

const EP = process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, '');
const ik = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: EP,
});
const BASE = '/_ik-test/cli';
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures/exif6.jpg'));
const CLI = path.join(ROOT, 'backend/scripts/ikReorganize.js');

let fails = 0;
function check(label, cond, detail = '') {
  if (cond) console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`);
  else {
    fails += 1;
    console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function run(args) {
  try {
    return execFileSync('node', [CLI, ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // 중단(exit 1)도 정상 시나리오의 일부다 — 출력은 그대로 돌려준다.
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
}

const up = (name, folder) => ik.upload({ file: FIXTURE, fileName: name, folder, useUniqueFileName: false });

/** 목록(검색 인덱스) 반영을 기다린다 */
async function names(folder, expect = null, tries = 8, waitMs = 1500) {
  let rows = [];
  for (let i = 0; i < tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    rows = await ik.listFiles({ path: folder, type: 'file', limit: 100 }).catch(() => []);
    const got = rows.map((f) => f.name).sort();
    if (expect === null || JSON.stringify(got) === JSON.stringify([...expect].sort())) return got;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return rows.map((f) => f.name).sort();
}

(async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikcli-'));
  const tsv = path.join(outDir, 'map.tsv');
  fs.writeFileSync(tsv, `${BASE}/src/a.jpg\t${BASE}/dst/a.jpg\tfile\n${BASE}/src/b.jpg\t${BASE}/dst/b.jpg\tfile\n`);
  console.log(`작업 폴더: ${BASE} · 출력: ${outDir}\n`);

  await ik.deleteFolder(BASE).catch(() => {});
  await up('a.jpg', `${BASE}/src`);
  await up('b.jpg', `${BASE}/src`);
  await up('b.jpg', `${BASE}/dst`); // 일부러 충돌시킨다
  await names(`${BASE}/src`, ['a.jpg', 'b.jpg']);
  await names(`${BASE}/dst`, ['b.jpg']);

  // ── 1) apply → 충돌로 중단 ─────────────────────────────────
  console.log('[1] --apply (dst/b.jpg 충돌로 중단되어야 함)');
  const out1 = run([tsv, '--apply', '--yes', '--out', outDir]);
  console.log(out1.split('\n').filter((l) => /^\[\d|중단|완료:|보고서:/.test(l)).map((l) => '    ' + l).join('\n'));
  const reportPath = path.join(outDir, 'report.json');
  check('report.json 생성', fs.existsSync(reportPath));
  const rep1 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  check('a 성공 / b 실패로 기록', rep1.results.length === 2 && rep1.results[0].ok && !rep1.results[1].ok,
    JSON.stringify(rep1.results.map((r) => ({ from: r.from, ok: r.ok }))));
  check('성공 항목에 dbBatchId 필드 존재(참조 0건이면 null)', 'dbBatchId' in rep1.results[0],
    `dbBatchId=${JSON.stringify(rep1.results[0].dbBatchId)}`);
  check('src 에는 b.jpg 만 남음', JSON.stringify(await names(`${BASE}/src`, ['b.jpg'])) === JSON.stringify(['b.jpg']));

  // ── 2) 충돌 제거 후 resume ─────────────────────────────────
  console.log('\n[2] dst/b.jpg 삭제 후 --resume');
  const dstRows = await ik.listFiles({ path: `${BASE}/dst`, type: 'file', limit: 50 });
  const clash = dstRows.find((f) => f.name === 'b.jpg');
  if (clash) await ik.deleteFile(clash.fileId);
  await names(`${BASE}/dst`, ['a.jpg']);

  const out2 = run([tsv, '--resume', reportPath, '--yes', '--out', outDir]);
  console.log(out2.split('\n').filter((l) => /재개:|건너뜀|^\[\d|중단|완료:/.test(l)).map((l) => '    ' + l).join('\n'));
  check('중단되지 않음(예전 결함: "문제 있는 항목" 으로 거부)', !/중단:/.test(out2), /중단:.*/.exec(out2)?.[0] || '');
  check('a 를 건너뜀으로 표시', /건너뜀\s+file\s+.*a\.jpg/.test(out2));
  check('b 만 실행', /\[1\/1\][^\n]*b\.jpg/.test(out2));
  check('resume 요약이 실행/건너뜀을 분리 표기', /완료: 1\/1건 실행 · 건너뜀 1건/.test(out2),
    /완료: .*/.exec(out2)?.[0] || '');
  const srcAfter = await names(`${BASE}/src`, []);
  const dstAfter = await names(`${BASE}/dst`, ['a.jpg', 'b.jpg']);
  check('src 비고 dst 에 a,b 모두', srcAfter.length === 0 && JSON.stringify(dstAfter) === JSON.stringify(['a.jpg', 'b.jpg']),
    `src=${JSON.stringify(srcAfter)} dst=${JSON.stringify(dstAfter)}`);

  // ── 3) rollback ────────────────────────────────────────────
  console.log('\n[3] --rollback');
  const rep2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  check('보고서에 건너뛴 a 와 실행한 b 가 모두 기록', rep2.results.length === 2,
    JSON.stringify(rep2.results.map((r) => ({ from: r.from, ok: r.ok, skipped: !!r.skipped }))));

  const out3 = run(['--rollback', reportPath]);
  console.log(out3.split('\n').filter((l) => /^\[\d|되돌리기|실패 항목|↳/.test(l)).map((l) => '    ' + l).join('\n'));
  check('DB 롤백을 "해당 없음" 으로 처리(실패로 세지 않음)', /DB 롤백 해당 없음/.test(out3));
  check('되돌리기 2/2 성공(예전 결함: 0/1 오보고)', /되돌리기 완료: 2\/2/.test(out3),
    /되돌리기 완료: .*/.exec(out3)?.[0] || '');
  const srcBack = await names(`${BASE}/src`, ['a.jpg', 'b.jpg']);
  const dstBack = await names(`${BASE}/dst`, []);
  check('파일이 src 로 복원됨', JSON.stringify(srcBack) === JSON.stringify(['a.jpg', 'b.jpg']) && dstBack.length === 0,
    `src=${JSON.stringify(srcBack)} dst=${JSON.stringify(dstBack)}`);

  // ── 정리 ───────────────────────────────────────────────────
  console.log('\n[정리]');
  await ik.deleteFolder('/_ik-test').catch((e) => console.log('  삭제 오류:', e.message));
  let left = [];
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line no-await-in-loop
    left = await ik.listFiles({ path: '/_ik-test', type: 'all', limit: 50 }).catch(() => []);
    if (!left.length) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 2000));
  }
  check('/_ik-test 삭제됨', left.length === 0, `남은 ${left.length}건`);
  fs.rmSync(outDir, { recursive: true, force: true });

  console.log(`\n결과: 실패 ${fails}건`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
