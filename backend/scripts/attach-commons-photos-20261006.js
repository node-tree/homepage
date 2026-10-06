#!/usr/bin/env node
'use strict';

// COMMONS(workshop 컬렉션) 글 본문 끝에 ImageKit 사진 <img>만 덧붙인다.
// 기본: 읽기 + 전체 백업 + dry-run. 쓰기는 --apply 만. 기존 본문은 한 글자도 바꾸지 않고(접두 일치 검증) 뒤에만 붙인다.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { EJSON } = mongoose.mongo.BSON;

const ROOT = path.join(os.homedir(), 'Desktop/etx/web/nodetreeHome/_workspace/14_commons_photos');
const ENDPOINT = 'https://ik.imagekit.io/gc3jtyt9o';
const encode = (value) => EJSON.stringify(value, null, 2, { relaxed: false });
const decode = (text) => EJSON.parse(text, { relaxed: false });
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fileOf = (src) => { try { return decodeURIComponent(String(src).split('?')[0]).split('/').slice(-2).join('/'); } catch { return String(src); } };

function options(argv) {
  const result = { apply: false, plan: path.join(ROOT, 'plan.json'), 'env-file': path.resolve(__dirname, '../.env'), restore: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') result.apply = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--plan' || arg === '--restore' || arg === '--env-file') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('ARGUMENT_VALUE_REQUIRED');
      result[arg.slice(2)] = path.resolve(argv[++i]);
    } else throw new Error('UNKNOWN_ARGUMENT: ' + arg);
  }
  if (result.apply && result.dryRun) throw new Error('CONFLICTING_MODE_FLAGS');
  return result;
}

// 같은 사진(폴더/파일명)이 이미 본문에 있으면 다시 붙이지 않는다.
function planOne(doc, item) {
  const original = typeof doc.contents === 'string' ? doc.contents : '';
  const present = new Set([...original.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => fileOf(m[1])));
  const thumb = doc.thumbnail ? fileOf(doc.thumbnail) : '';
  const add = item.photos.filter((name) => {
    const key = fileOf(`${item.folder}${name}`);
    return !present.has(key) && key !== thumb;
  });
  const tags = add.map((name) => `<img src="${ENDPOINT}${item.folder}${name}" alt="${esc(doc.title)}" style="height: auto; border-radius: 8px">`);
  const contents = tags.length ? original.replace(/\s*$/, '') + '\n' + tags.join('\n') : original;
  if (!contents.startsWith(original.replace(/\s*$/, ''))) throw new Error('PREFIX_MISMATCH');
  return { id: String(doc._id), title: doc.title, added: add.length, skipped: item.photos.length - add.length, before: original.length, after: contents.length, contents, original: doc };
}

async function run(argv) {
  const args = options(argv);
  const env = dotenv.parse(fs.readFileSync(args['env-file']));
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI || '')) throw new Error('MONGODB_URI_MISSING_OR_INVALID');
  const connection = mongoose.createConnection(env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, autoIndex: false, autoCreate: false });
  try {
    await connection.asPromise();
    const collection = connection.db.collection('workshop');
    const opts = { promoteLongs: false, promoteValues: false };
    const docs = await collection.find({}, opts).toArray();

    // 항상 전체 백업 먼저(복원 포함 모든 모드).
    const dir = path.join(ROOT, 'db-backup-' + stamp());
    fs.mkdirSync(dir, { recursive: false, mode: 0o700 });
    fs.writeFileSync(path.join(dir, 'workshop.json'), encode(docs), { flag: 'wx', mode: 0o600 });

    if (args.restore) {
      const target = decode(fs.readFileSync(path.join(args.restore, 'workshop.json'), 'utf8'));
      const rows = target.map((t) => ({ id: String(t._id), contents: t.contents }));
      console.log(JSON.stringify({ mode: args.apply ? 'restore-apply' : 'restore-dry-run', backup: dir, docs: rows.length }));
      if (args.apply) for (const t of target) await collection.updateOne({ _id: t._id }, { $set: { contents: t.contents } });
      return;
    }

    const plan = JSON.parse(fs.readFileSync(args.plan, 'utf8'));
    const rows = plan.map((item) => {
      const doc = docs.find((d) => String(d._id) === item.id);
      if (!doc) return { id: item.id, title: item.title, status: 'SKIP', reason: 'DOCUMENT_NOT_FOUND', added: 0 };
      return { ...planOne(doc, item), status: 'READY' };
    });
    if (args.apply) {
      for (const row of rows.filter((r) => r.status === 'READY' && r.added > 0)) {
        const now = await collection.findOne({ _id: row.original._id }, opts);
        if (encode(now) !== encode(row.original)) { row.status = 'FAILED'; row.reason = 'CONCURRENT_DOCUMENT_CHANGE'; continue; }
        await collection.updateOne({ _id: row.original._id }, { $set: { contents: row.contents } });
        const after = await collection.findOne({ _id: row.original._id }, opts);
        row.status = after.contents === row.contents ? 'VERIFIED' : 'FAILED';
        if (row.status === 'FAILED') row.reason = 'WRITE_VERIFICATION_FAILED';
      }
    }
    const lines = rows.map((r) => `${r.status}\t${r.title}\t+${r.added}\t(중복 ${r.skipped ?? 0})\t${r.before ?? ''}→${r.after ?? ''}${r.reason ? '\t' + r.reason : ''}`);
    console.log(JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', backup: dir, posts: rows.length, photos: rows.reduce((n, r) => n + r.added, 0), failed: rows.filter((r) => r.status === 'FAILED' || r.status === 'SKIP').length }));
    console.log(lines.join('\n'));
    if (rows.some((r) => r.status === 'FAILED' || r.status === 'SKIP')) process.exitCode = 2;
  } finally {
    await connection.close();
  }
}

if (require.main === module) run(process.argv.slice(2)).catch((error) => {
  console.error('DB 작업 중단: ' + (error.message || 'OPERATION_FAILED').replace(/mongodb(\+srv)?:\/\/\S+/g, '[REDACTED]'));
  process.exitCode = 1;
});
module.exports = { planOne, fileOf };
