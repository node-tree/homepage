#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// ikReorganize — ImageKit 대량 재정리 CLI
//
//   매핑 TSV(`old_path <TAB> new_path`)를 받아
//     ImageKit 파일/폴더 이동  →  DB 참조 치환  →  감사 로그
//   를 순차 수행한다. 기본은 dry-run 이며, 실제 변경은 --apply 를 명시해야 한다.
//
//   사용법
//     node backend/scripts/ikReorganize.js <mapping.tsv> [옵션]
//       --dry-run            (기본) 검사만. plan.json 출력
//       --apply              실제 실행. report.json 출력
//       --resume <report>    이전 report.json 에서 실패/미처리 지점부터 재개
//       --rollback <report>  report.json 의 작업을 역순으로 되돌린다
//       --out <dir>          결과 파일 위치(기본: 매핑 파일과 같은 폴더)
//       --no-db              DB 참조 치환을 건너뛴다(ImageKit 만 이동)
//       --yes                --apply 시 확인 프롬프트 생략
//
//   TSV 형식 (탭 구분, # 주석·빈 줄 허용)
//     /mcwjd/생산소/포스터      /archive/2026/포스터        ← 폴더(확장자 없음)로 자동 판별
//     /uploads/a.jpg           /archive/a.jpg              ← 파일
//     kind 를 3번째 열로 명시할 수도 있다: file | folder
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT, 'backend/.env') });

const mongoose = require('mongoose');
const ImageKit = require('imagekit');
const ikRefs = require('../lib/ikRefs');
const ikRefsDb = require('../lib/ikRefsDb');

// ── 인자 파싱 ──────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { mode: 'dry-run', file: null, out: null, useDb: true, yes: false, resume: null, rollback: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.mode = 'apply';
    else if (a === '--dry-run') o.mode = 'dry-run';
    else if (a === '--no-db') o.useDb = false;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--resume') { o.mode = 'apply'; o.resume = argv[++i]; }
    else if (a === '--rollback') { o.mode = 'rollback'; o.rollback = argv[++i]; }
    else if (a.startsWith('-')) throw new Error(`알 수 없는 옵션: ${a}`);
    else rest.push(a);
  }
  o.file = rest[0] || null;
  return o;
}

function looksLikeFile(p) {
  const base = p.slice(p.lastIndexOf('/') + 1);
  return /\.[A-Za-z0-9]{1,8}$/.test(base);
}

function parseTsv(text) {
  const rows = [];
  const errors = [];
  text.split('\n').forEach((line, i) => {
    const raw = line.replace(/\r$/, '');
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    const cols = raw.split('\t').map((c) => c.trim()).filter((c, idx) => idx < 3);
    if (cols.length < 2) {
      errors.push({ line: i + 1, error: '탭으로 구분된 2개 열(old, new)이 필요합니다.', raw });
      return;
    }
    const [from, to, kindRaw] = cols;
    const kind = kindRaw === 'file' || kindRaw === 'folder' ? kindRaw : looksLikeFile(from) ? 'file' : 'folder';
    const cf = ikRefs.canonPath(from);
    const ct = ikRefs.canonPath(to);
    if (!cf || cf === '/' || !ct || ct === '/') {
      errors.push({ line: i + 1, error: '루트(/) 또는 빈 경로는 사용할 수 없습니다.', raw });
      return;
    }
    if (cf === ct) {
      errors.push({ line: i + 1, error: '출발지와 목적지가 같습니다.', raw });
      return;
    }
    if (kind === 'folder' && (ct === cf || ct.startsWith(`${cf}/`))) {
      errors.push({ line: i + 1, error: '폴더를 자기 자신/하위로 옮길 수 없습니다.', raw });
      return;
    }
    rows.push({ line: i + 1, from: cf, to: ct, kind });
  });

  // 중복/충돌 검사 — 충돌 행은 계획에서 제외한다.
  //   (오류로 보고만 하고 rows 에 남겨두면 같은 원본을 두 번 옮기려 시도하고
  //    DB 참조 합계도 이중 계상된다.)
  const seen = new Map();
  const dests = new Map();
  const rejected = new Set();
  for (const r of rows) {
    if (seen.has(r.from)) {
      errors.push({ line: r.line, error: `출발지 중복(${seen.get(r.from)}행과 충돌)`, raw: r.from });
      rejected.add(r.line);
    } else seen.set(r.from, r.line);
  }
  for (const r of rows) {
    if (rejected.has(r.line)) continue;
    const key = `${r.kind}:${r.to}`;
    if (dests.has(key)) {
      errors.push({ line: r.line, error: `목적지 중복(${dests.get(key)}행과 충돌)`, raw: r.to });
      rejected.add(r.line);
    } else dests.set(key, r.line);
  }
  return { rows: rows.filter((r) => !rejected.has(r.line)), errors };
}

// ── ImageKit ───────────────────────────────────────────────────
function makeImageKit() {
  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) return null;
  return new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });
}

async function waitJob(ik, jobId, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const j = await ik.getBulkJobStatus(jobId);
      if (String(j?.status || '').toLowerCase() === 'completed') return true;
    } catch { /* 재시도 */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** 존재 확인: 파일은 filePath 검색, 폴더는 하위 목록 조회 */
async function existsOnImageKit(ik, row) {
  if (row.kind === 'file') {
    const parent = row.from.slice(0, row.from.lastIndexOf('/')) || '/';
    const name = row.from.slice(row.from.lastIndexOf('/') + 1);
    const list = await ik.listFiles({ path: parent === '/' ? undefined : parent, limit: 1000, type: 'file' });
    return list.some((f) => ikRefs.canonPath(f.filePath || '') === row.from) ||
      list.some((f) => (f.name || '') === name);
  }
  const list = await ik.listFiles({ path: row.from, limit: 1, type: 'all' });
  return Array.isArray(list);
}

async function moveOne(ik, row) {
  if (row.kind === 'file') {
    const destFolder = row.to.slice(0, row.to.lastIndexOf('/')) || '/';
    const fromName = row.from.slice(row.from.lastIndexOf('/') + 1);
    const toName = row.to.slice(row.to.lastIndexOf('/') + 1);
    const srcFolder = row.from.slice(0, row.from.lastIndexOf('/')) || '/';
    if (srcFolder !== destFolder) {
      await ik.moveFile({ sourceFilePath: row.from, destinationPath: destFolder });
    }
    if (fromName !== toName) {
      const afterMove = destFolder === '/' ? `/${fromName}` : `${destFolder}/${fromName}`;
      await ik.renameFile({ filePath: afterMove, newFileName: toName });
    }
    return { jobId: null, jobCompleted: true };
  }
  // 폴더: 부모가 바뀌면 move, 이름이 바뀌면 rename (둘 다면 move 후 rename)
  const srcParent = row.from.slice(0, row.from.lastIndexOf('/')) || '/';
  const dstParent = row.to.slice(0, row.to.lastIndexOf('/')) || '/';
  const fromName = row.from.slice(row.from.lastIndexOf('/') + 1);
  const toName = row.to.slice(row.to.lastIndexOf('/') + 1);
  let jobId = null;
  if (srcParent !== dstParent) {
    const r = await ik.moveFolder({ sourceFolderPath: row.from, destinationPath: dstParent });
    jobId = r?.jobId || null;
    if (jobId) await waitJob(ik, jobId);
  }
  if (fromName !== toName) {
    const axios = require('axios');
    const cur = dstParent === '/' ? `/${fromName}` : `${dstParent}/${fromName}`;
    const auth = `Basic ${Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}`;
    const { data } = await axios.post(
      'https://api.imagekit.io/v1/bulkJobs/renameFolder',
      { folderPath: cur, newFolderName: toName },
      { headers: { Authorization: auth, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    jobId = data?.jobId || jobId;
    if (data?.jobId) await waitJob(ik, data.jobId);
  }
  return { jobId, jobCompleted: true };
}

// ── 출력 ───────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
function table(rows, cols) {
  const widths = cols.map((c) => Math.max(c.title.length, ...rows.map((r) => String(c.get(r)).length)));
  console.log(cols.map((c, i) => pad(c.title, widths[i])).join('  '));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(cols.map((c, i) => pad(c.get(r), widths[i])).join('  '));
}

async function connectDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI 가 설정되지 않았습니다.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection.db;
}

function loadCodeRefs() {
  try {
    // eslint-disable-next-line global-require
    return require('../data/ikCodeRefs.json');
  } catch {
    return { total: 0, byPath: {} };
  }
}
function codeRefsFor(codeRefs, row) {
  const out = [];
  for (const [p, list] of Object.entries(codeRefs.byPath || {})) {
    const hit = row.kind === 'file' ? p === row.from : p === row.from || p.startsWith(`${row.from}/`);
    if (hit) out.push(...list.map((l) => `${l.file}:${l.line}`));
  }
  return out;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((r) => rl.question(question, r));
  rl.close();
  return /^(y|yes)$/i.test(ans.trim());
}

// ── 메인 ───────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.mode === 'rollback') return doRollback(opts);

  if (!opts.file) {
    console.error('매핑 TSV 파일 경로가 필요합니다.\n  예) node backend/scripts/ikReorganize.js mapping.tsv --dry-run');
    process.exit(2);
  }
  const text = fs.readFileSync(opts.file, 'utf8');
  const { rows, errors } = parseTsv(text);
  const outDir = opts.out || path.dirname(path.resolve(opts.file));

  console.log(`매핑 파일: ${opts.file}`);
  console.log(`유효 항목 ${rows.length}건 · 형식 오류 ${errors.length}건\n`);
  if (errors.length) {
    console.log('■ 형식 오류');
    table(errors, [
      { title: '행', get: (r) => r.line },
      { title: '내용', get: (r) => (r.raw || '').slice(0, 50) },
      { title: '사유', get: (r) => r.error },
    ]);
    console.log('');
  }
  if (rows.length === 0) {
    console.error('처리할 항목이 없습니다.');
    process.exit(errors.length ? 1 : 0);
  }

  const ik = makeImageKit();
  if (!ik) console.log('⚠️ ImageKit 키가 없어 존재 확인/이동을 건너뜁니다(DB 참조 집계만 수행).\n');

  const db = opts.useDb ? await connectDb() : null;
  const codeRefs = loadCodeRefs();

  // ── 검사 ────────────────────────────────────────────────────
  const plan = [];
  for (const row of rows) {
    const entry = { ...row, exists: null, dbRefs: 0, byCollection: {}, codeRefs: codeRefsFor(codeRefs, row), issues: [] };
    if (ik) {
      try {
        entry.exists = await existsOnImageKit(ik, row);
        if (!entry.exists) entry.issues.push('ImageKit 에서 원본을 찾지 못함');
      } catch (e) {
        entry.issues.push(`존재 확인 실패: ${e.message}`);
      }
    }
    if (db) {
      const [r] = await ikRefsDb.findRefs(db, [row.from], { kinds: { [row.from]: row.kind } });
      entry.dbRefs = r.count;
      entry.byCollection = r.byCollection;
    }
    plan.push(entry);
  }

  console.log('■ 계획');
  table(plan, [
    { title: '종류', get: (r) => r.kind },
    { title: 'old', get: (r) => r.from },
    { title: 'new', get: (r) => r.to },
    { title: '존재', get: (r) => (r.exists === null ? '-' : r.exists ? 'O' : 'X') },
    { title: 'DB참조', get: (r) => r.dbRefs },
    { title: '컬렉션', get: (r) => Object.entries(r.byCollection).map(([k, v]) => `${k}:${v}`).join(',') || '-' },
    { title: '코드참조', get: (r) => r.codeRefs.length },
    { title: '문제', get: (r) => r.issues.join('; ') || '-' },
  ]);

  const totalDb = plan.reduce((s, r) => s + r.dbRefs, 0);
  const totalCode = plan.reduce((s, r) => s + r.codeRefs.length, 0);
  console.log(`\n합계: 항목 ${plan.length} · DB 참조 ${totalDb} · 코드 참조 ${totalCode}`);
  if (totalCode) {
    console.log('\n■ 코드 참조(자동 치환 불가 — 수동 수정 후 배포 필요)');
    for (const r of plan) {
      if (r.codeRefs.length) console.log(`  ${r.from}\n    ${r.codeRefs.join('\n    ')}`);
    }
  }

  const blocking = plan.filter((r) => r.issues.length);
  if (opts.mode === 'dry-run') {
    const planPath = path.join(outDir, 'plan.json');
    fs.writeFileSync(planPath, JSON.stringify({ generatedAt: new Date().toISOString(), opts: { useDb: opts.useDb }, plan }, null, 2));
    console.log(`\ndry-run 완료 — 아무것도 변경하지 않았습니다.\n계획 저장: ${planPath}`);
    if (blocking.length) console.log(`⚠️ 문제 있는 항목 ${blocking.length}건 — --apply 전에 해결하세요.`);
    await cleanup(db);
    return;
  }

  // ── 실행 ────────────────────────────────────────────────────
  //   형식 오류가 하나라도 있으면 실행하지 않는다 — 매핑 파일을 먼저 고쳐야 한다.
  if (errors.length) {
    console.error(`\n중단: 매핑 파일에 형식/충돌 오류 ${errors.length}건이 있습니다. 수정 후 다시 실행하세요.`);
    await cleanup(db);
    process.exit(1);
  }
  if (blocking.length) {
    console.error(`\n중단: 문제 있는 항목 ${blocking.length}건. 해결 후 다시 실행하세요.`);
    await cleanup(db);
    process.exit(1);
  }
  if (!ik) {
    console.error('\n중단: ImageKit 키가 없어 --apply 를 수행할 수 없습니다.');
    await cleanup(db);
    process.exit(1);
  }

  let done = new Set();
  if (opts.resume) {
    const prev = JSON.parse(fs.readFileSync(opts.resume, 'utf8'));
    done = new Set((prev.results || []).filter((r) => r.ok).map((r) => `${r.kind}:${r.from}`));
    console.log(`\n재개: 이미 완료된 ${done.size}건은 건너뜁니다.`);
  }

  if (!opts.yes) {
    const ok = await confirm(`\n${plan.length}건을 실제로 이동하고 DB 참조 ${totalDb}건을 갱신합니다. 진행할까요? (y/N) `);
    if (!ok) {
      console.log('취소했습니다.');
      await cleanup(db);
      return;
    }
  }

  const results = [];
  let idx = 0;
  for (const row of plan) {
    idx += 1;
    const key = `${row.kind}:${row.from}`;
    const prefix = `[${idx}/${plan.length}]`;
    if (done.has(key)) {
      console.log(`${prefix} 건너뜀(완료됨) ${row.from}`);
      results.push({ ...row, ok: true, skipped: true });
      continue;
    }
    process.stdout.write(`${prefix} ${row.kind} ${row.from} → ${row.to} … `);
    try {
      const mv = await moveOne(ik, row);
      let refs = { updated: false, skipped: true };
      if (db) {
        const mapping = [{ from: row.from, to: row.to, kind: row.kind }];
        refs = await ikRefsDb.applyMappings(db, mapping, { actor: 'cli:ikReorganize' });
      }
      const n = refs.refsUpdated ? Object.values(refs.refsUpdated).reduce((a, b) => a + b, 0) : 0;
      console.log(`OK (DB ${n}건, batch ${refs.batchId || '-'})`);
      results.push({ ...row, ok: true, jobId: mv.jobId, batchId: refs.batchId || null, refsUpdated: refs.refsUpdated || {} });
    } catch (e) {
      console.log(`실패: ${e.message}`);
      results.push({ ...row, ok: false, error: e.message });
      const report = writeReport(outDir, results, plan);
      console.error(`\n중단했습니다. 여기까지의 결과: ${report}`);
      console.error(`문제 해결 후 재개: node backend/scripts/ikReorganize.js ${opts.file} --resume ${report}`);
      await cleanup(db);
      process.exit(1);
    }
  }

  const report = writeReport(outDir, results, plan);
  const totalUpdated = results.reduce(
    (s, r) => s + Object.values(r.refsUpdated || {}).reduce((a, b) => a + b, 0),
    0
  );
  console.log(`\n완료: ${results.filter((r) => r.ok).length}/${plan.length}건 · DB 참조 ${totalUpdated}건 갱신`);
  console.log(`보고서: ${report}`);
  console.log(`되돌리기: node backend/scripts/ikReorganize.js --rollback ${report}`);
  await cleanup(db);
}

function writeReport(outDir, results, plan) {
  const p = path.join(outDir, 'report.json');
  fs.writeFileSync(p, JSON.stringify({ generatedAt: new Date().toISOString(), plan, results }, null, 2));
  return p;
}

async function doRollback(opts) {
  const report = JSON.parse(fs.readFileSync(opts.rollback, 'utf8'));
  const done = (report.results || []).filter((r) => r.ok && !r.skipped);
  if (done.length === 0) {
    console.log('되돌릴 항목이 없습니다.');
    return;
  }
  const ik = makeImageKit();
  const db = opts.useDb ? await connectDb() : null;

  console.log(`역순으로 ${done.length}건을 되돌립니다.\n`);
  let okCount = 0;
  for (let i = done.length - 1; i >= 0; i--) {
    const r = done[i];
    const rev = { kind: r.kind, from: r.to, to: r.from };
    process.stdout.write(`[${done.length - i}/${done.length}] ${rev.from} → ${rev.to} … `);
    try {
      if (ik) await moveOne(ik, rev);
      if (db && r.batchId) await ikRefsDb.rollback(db, { batchId: r.batchId });
      console.log('OK');
      okCount += 1;
    } catch (e) {
      console.log(`실패: ${e.message}`);
    }
  }
  console.log(`\n되돌리기 완료: ${okCount}/${done.length}`);
  await cleanup(db);
}

async function cleanup(db) {
  if (db) await mongoose.disconnect().catch(() => {});
}

main().catch((e) => {
  console.error('오류:', e.message);
  process.exit(1);
});
