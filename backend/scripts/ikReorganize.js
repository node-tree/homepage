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
const ikTransfer = require('../lib/ikTransfer');

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

/**
 * --resume: 이전 report.json 에서 **이미 완료된 항목을 계획에서 통째로 제외**한다.
 *   예전에는 실행 직전에만 걸러서, 이미 옮겨진 원본이 존재검사에 걸려
 *   "문제 있는 항목 N건 → 중단" 으로 재개 자체가 막혔다(실측 결함).
 *   완료 항목의 dbBatchId 는 함께 물려받아 이후 롤백에서 DB 단계를 되돌릴 수 있게 한다.
 */
function filterResume(rows, report) {
  const doneMap = new Map();
  for (const r of (report && report.results) || []) {
    if (r.ok) doneMap.set(`${r.kind}:${r.from}`, r);
  }
  const remaining = [];
  const skipped = [];
  for (const row of rows) {
    const prev = doneMap.get(`${row.kind}:${row.from}`);
    if (prev) {
      skipped.push({
        ...row,
        prevDbBatchId: prev.dbBatchId ?? null,
        prevNewFileId: prev.newFileId ?? null,
      });
    }
    else remaining.push(row);
  }
  return { remaining, skipped };
}

/**
 * --rollback 계획: 실제로 수행된 항목을 역순으로, 파일/DB 단계를 분리해 준비한다.
 *   dbBatchId 가 null 이면 "DB 참조가 0건이라 되돌릴 것이 없음" 이지 실패가 아니다.
 */
function planRollback(report) {
  const done = ((report && report.results) || []).filter((r) => r.ok);
  return done
    .slice()
    .reverse()
    .map((r) => ({
      kind: r.kind,
      from: r.to, // 역방향
      to: r.from,
      // 되돌릴 파일의 fileId. 이게 없으면 listFiles(검색 인덱스) 로 찾아야 해서
      // 방금 옮긴 직후에는 404 가 난다(실측: "원본을 찾지 못했습니다").
      fileId: r.newFileId ?? null,
      dbBatchId: r.dbBatchId ?? null,
      wasSkipped: !!r.skipped,
    }));
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

/**
 * 존재 확인에 재시도를 건다.
 *   존재 검사는 listFiles(검색 인덱스) 기반인데, 방금 업로드/삭제한 직후에는 반영이 늦어
 *   멀쩡한 파일을 "원본 없음" 으로 오판한다(실측). 매핑에는 fileId 가 없어 getFileDetails 를
 *   쓸 수 없으므로, 못 찾으면 간격을 두고 총 10초 이상 다시 확인한다.
 *   반환: { exists, attempts }
 */
async function existsWithRetry(ik, row, tries = 3, waitMs = 5000) {
  for (let i = 1; i <= tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await existsOnImageKit(ik, row);
    if (ok) return { exists: true, attempts: i };
    if (i < tries) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return { exists: false, attempts: tries };
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

async function moveOne(ik, row, ctx = {}) {
  if (row.kind === 'file') {
    // ⚠️ 무료 플랜은 files/move 가 항상 실패한다(Versions Limit Exceeded, Limit:0).
    //    → 복제 방식(ikTransfer)으로 옮긴다. DB 참조 갱신까지 이 안에서 처리된다.
    const destFolder = row.to.slice(0, row.to.lastIndexOf('/')) || '/';
    const fromName = row.from.slice(row.from.lastIndexOf('/') + 1);
    const toName = row.to.slice(row.to.lastIndexOf('/') + 1);
    const r = await ikTransfer.transferFile({
      ik,
      db: ctx.db || null,
      sourceFilePath: row.from,
      // 알고 있으면 fileId 로 바로 찾는다(목록 인덱스 지연 회피).
      fileId: row.fileId || null,
      destinationFolder: destFolder,
      mode: 'move',
      updateRefs: !!ctx.db,
      actor: 'cli:ikReorganize',
    });
    // 이름까지 바뀌는 경우 복제 후 rename(무료 플랜에서도 rename 은 동작).
    if (fromName !== toName) {
      await ik.renameFile({ filePath: r.destinationPath, newFileName: toName });
      if (ctx.db) {
        const renamed = destFolder === '/' ? `/${toName}` : `${destFolder}/${toName}`;
        await ikRefsDb.applyMappings(
          ctx.db,
          [{ from: r.destinationPath, to: renamed, kind: 'file' }],
          { actor: 'cli:ikReorganize' }
        );
      }
    }
    return { jobId: null, jobCompleted: true, transfer: r };
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
  const parsed = parseTsv(text);
  const errors = parsed.errors;
  let rows = parsed.rows;
  const outDir = opts.out || path.dirname(path.resolve(opts.file));

  // --resume 은 계획을 세우기 전에 적용해야 한다(이미 옮긴 원본을 존재검사에 넣지 않기 위해).
  let resumeSkipped = [];
  if (opts.resume) {
    const prevReport = JSON.parse(fs.readFileSync(opts.resume, 'utf8'));
    const f = filterResume(rows, prevReport);
    rows = f.remaining;
    resumeSkipped = f.skipped;
    console.log(`재개: 이전 보고서에서 완료된 ${resumeSkipped.length}건은 건너뜁니다.`);
    resumeSkipped.forEach((r) => console.log(`  건너뜀  ${r.kind} ${r.from} → ${r.to}`));
    console.log('');
  }
  // 지정한 출력 폴더가 없으면 만든다(없으면 plan/report 저장에서 ENOENT).
  fs.mkdirSync(outDir, { recursive: true });

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
    if (resumeSkipped.length) {
      console.log('재개할 남은 항목이 없습니다 — 모두 완료된 상태입니다.');
      writeReport(outDir, resumeSkipped.map((r) => ({ ...r, ok: true, skipped: true, dbBatchId: r.prevDbBatchId })), []);
      process.exit(0);
    }
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
        const ex = await existsWithRetry(ik, row);
        entry.exists = ex.exists;
        entry.existsAttempts = ex.attempts;
        if (ex.attempts > 1) {
          console.log(
            `    (목록 인덱스 지연) ${row.from} — ${ex.attempts}회 재시도 후 ${ex.exists ? '발견' : '미발견'}`
          );
        }
        if (!entry.exists) {
          entry.issues.push('ImageKit 에서 원본을 찾지 못함(목록 인덱스 재시도 후에도)');
        }
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

  if (!opts.yes) {
    const ok = await confirm(`\n${plan.length}건을 실제로 이동하고 DB 참조 ${totalDb}건을 갱신합니다. 진행할까요? (y/N) `);
    if (!ok) {
      console.log('취소했습니다.');
      await cleanup(db);
      return;
    }
  }

  // 재개로 건너뛴 항목도 보고서에는 남긴다(롤백 계획이 이어지도록 dbBatchId 포함).
  const results = resumeSkipped.map((r) => ({
    kind: r.kind, from: r.from, to: r.to, line: r.line,
    ok: true, skipped: true,
    newFileId: r.prevNewFileId ?? null,
    dbBatchId: r.prevDbBatchId ?? null,
  }));
  let idx = 0;
  for (const row of plan) {
    idx += 1;
    const prefix = `[${idx}/${plan.length}]`;
    process.stdout.write(`${prefix} ${row.kind} ${row.from} → ${row.to} … `);
    try {
      const mv = await moveOne(ik, row, { db });
      let refs = { updated: false, skipped: true };
      if (mv.transfer) {
        // 파일 항목은 ikTransfer 안에서 이미 참조를 갱신했다(중복 적용 금지).
        refs = mv.transfer.refs || { updated: false, skipped: true };
      } else if (db) {
        const mapping = [{ from: row.from, to: row.to, kind: row.kind }];
        refs = await ikRefsDb.applyMappings(db, mapping, { actor: 'cli:ikReorganize' });
      }
      const n = refs.refsUpdated ? Object.values(refs.refsUpdated).reduce((a, b) => a + b, 0) : 0;
      // 참조가 0건이면 로그 배치가 만들어지지 않는다 → dbBatchId 를 null 로 기록해야
      // 롤백에서 "되돌릴 로그가 없습니다" 를 실패로 오인하지 않는다(실측 결함).
      const dbBatchId = refs.documents > 0 && refs.batchId ? refs.batchId : null;
      console.log(`OK (DB ${n}건, batch ${dbBatchId || '해당 없음'})`);
      results.push({
        ...row, ok: true, jobId: mv.jobId,
        // 롤백에서 이 파일을 fileId 로 되찾기 위해 반드시 남긴다.
        newFileId: (mv.transfer && mv.transfer.newFileId) || null,
        dbBatchId, dbDocuments: refs.documents || 0, refsUpdated: refs.refsUpdated || {},
      });
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
  // 건너뛴(재개) 항목을 실행 건수에 합산하면 "2/1건" 같은 엉뚱한 요약이 나온다 — 분리해 센다.
  const executedOk = results.filter((r) => r.ok && !r.skipped).length;
  const skippedN = results.filter((r) => r.skipped).length;
  console.log(
    `\n완료: ${executedOk}/${plan.length}건 실행` +
      (skippedN ? ` · 건너뜀 ${skippedN}건(이전 실행에서 완료)` : '') +
      ` · DB 참조 ${totalUpdated}건 갱신`
  );
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
  const items = planRollback(report);
  if (items.length === 0) {
    console.log('되돌릴 항목이 없습니다.');
    return;
  }
  const ik = makeImageKit();
  const db = opts.useDb ? await connectDb() : null;

  console.log(`역순으로 ${items.length}건을 되돌립니다.\n`);
  let okCount = 0;
  const failures = [];

  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    process.stdout.write(`[${i + 1}/${items.length}] ${r.from} → ${r.to} … `);

    // 순서가 중요하다: **파일 복원을 먼저** 하고, 성공했을 때만 DB 를 되돌린다.
    //   DB 를 먼저 되돌리고 파일 복원이 실패하면 "DB 는 옛 경로 · 파일은 새 경로" 로
    //   불일치가 남는다(실측 사고). 파일이 안 돌아왔으면 DB 도 건드리지 않는 편이 안전하다.
    let fileState = 'skip';
    let fileErr = null;
    if (ik) {
      try {
        await moveOne(ik, r, { db: null });
        fileState = 'ok';
      } catch (e) {
        fileState = 'fail';
        fileErr = e.message;
      }
    }

    let dbState = 'n/a';
    let dbErr = null;
    if (fileState !== 'ok') {
      // 파일이 제자리로 안 갔으면 DB 는 그대로 둔다(불일치 방지).
      dbState = r.dbBatchId ? 'blocked' : 'n/a';
    } else if (!r.dbBatchId) {
      dbState = 'n/a'; // 갱신된 참조가 없었음 → 되돌릴 것도 없음(실패 아님)
    } else if (!db) {
      dbState = 'skip';
    } else {
      try {
        const rb = await ikRefsDb.rollback(db, { batchId: r.dbBatchId });
        dbState = `ok(${rb.entries}건)`;
      } catch (e) {
        // 이미 롤백된 배치(404)는 사실상 되돌아간 상태다 — 실패로 세지 않는다.
        if (e.status === 404) dbState = '이미 롤백됨';
        else {
          dbState = 'fail';
          dbErr = e.message;
        }
      }
    }

    const failed = fileState === 'fail' || dbState === 'fail';
    const label = {
      ok: '파일 복원 OK',
      fail: `파일 복원 실패(${fileErr})`,
      skip: '파일 복원 건너뜀(ImageKit 키 없음)',
    }[fileState];
    const dbLabel =
      dbState === 'n/a'
        ? 'DB 롤백 해당 없음(갱신된 참조 0건)'
        : dbState === 'blocked'
        ? 'DB 롤백 보류(파일 복원이 안 돼 불일치 방지 — DB 는 그대로 둠)'
        : dbState === 'skip'
        ? 'DB 롤백 건너뜀(--no-db)'
        : dbState === 'fail'
        ? `DB 롤백 실패(${dbErr})`
        : `DB 롤백 ${dbState}`;
    console.log(`${failed ? '실패' : 'OK'} — ${label} · ${dbLabel}`);
    if (r.wasSkipped && !r.dbBatchId) {
      console.log('    ↳ 이 항목은 이전 실행에서 처리된 건이라 DB 배치 정보가 없을 수 있습니다(이전 report 확인).');
    }
    if (failed) failures.push({ ...r, fileErr, dbErr });
    else okCount += 1;
  }

  console.log(`\n되돌리기 완료: ${okCount}/${items.length}`);
  if (failures.length) {
    console.log('실패 항목:');
    failures.forEach((f) => console.log(`  ${f.from} → ${f.to} — ${f.fileErr || f.dbErr}`));
  }
  await cleanup(db);
}

async function cleanup(db) {
  if (db) await mongoose.disconnect().catch(() => {});
}

// 스크립트로 실행할 때만 main 을 돌린다(단위 테스트에서 require 가능하도록).
if (require.main === module) {
  main().catch((e) => {
    console.error('오류:', e.message);
    process.exit(1);
  });
}

module.exports = { parseTsv, filterResume, planRollback, looksLikeFile };
