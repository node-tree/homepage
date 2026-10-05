#!/usr/bin/env node
'use strict';

// Default: read + full BSON-preserving backup + dry-run. Only --apply enables writes.
// API content maps to DB contents; Filed's actual collection is workshop.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const dotenv = require('dotenv');
const { EJSON } = mongoose.mongo.BSON;
const ROOT = path.join(os.homedir(), 'Desktop/etx/web/nodetreeHome/_workspace/12_text_layout');
const COLLECTIONS = ['work', 'workshop', 'about', 'work_header', 'filed_header'];
const FIELDS = ['title', 'yearStart', 'yearEnd', 'status', 'venue', 'city', 'medium', 'summary', 'lede', 'artistNote', 'quote', 'credits', 'audience', 'partners'];
const MEDIA = 'img,iframe,video,audio,object,embed,picture,source,track,svg,canvas';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const encode = (value) => EJSON.stringify(value, null, 2, { relaxed: false });
const decode = (text) => EJSON.parse(text, { relaxed: false });
const equal = (a, b) => encode(a) === encode(b);
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const idOf = (doc) => String(doc._id);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
let stage = 'arguments';
function fail(code) { const error = new Error(code); error.safeCode = code; throw error; }
function safeDiagnostic(error) {
  const codes = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'EROFS', 'ENOSPC', 'EEXIST']);
  const names = new Set(['MongoServerSelectionError', 'MongoNetworkError', 'MongoParseError', 'MongoServerError', 'MongooseServerSelectionError', 'SyntaxError', 'TypeError']);
  let code = 'UNCLASSIFIED';
  for (let current = error, depth = 0; current && depth < 4; current = current.cause, depth++) {
    if (codes.has(current.code)) { code = current.code; break; }
    if (code === 'UNCLASSIFIED' && names.has(current.name)) code = current.name;
  }
  return { stage, reason: error.safeCode || 'OPERATION_FAILED_DETAILS_REDACTED', category: code };
}

function options(argv) {
  const result = { apply: false, overlay: path.join(ROOT, 'claude/samples/overlay.json'), 'env-file': path.resolve(__dirname, '../.env'), restore: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') result.apply = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--allow-public-image-url') result.allowPublicImageUrl = true;
    else if (arg === '--diagnose-secret-collisions') result.diagnose = true;
    else if (arg === '--help') result.help = true;
    else if (arg === '--overlay' || arg === '--restore' || arg === '--env-file') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail('ARGUMENT_VALUE_REQUIRED');
      result[arg.slice(2)] = path.resolve(argv[++i]);
    } else fail('UNKNOWN_ARGUMENT');
  }
  if (result.apply && result.dryRun) fail('CONFLICTING_MODE_FLAGS');
  if (result.apply && result.diagnose) fail('CONFLICTING_MODE_FLAGS');
  return result;
}

function media(html) {
  if (typeof html !== 'string') fail('BODY_NOT_STRING');
  const $ = cheerio.load(html, { xml: { xmlMode: false, decodeEntities: false, withStartIndices: true, withEndIndices: true } }, false);
  const nodes = $(MEDIA).toArray();
  const roots = nodes.filter(node => !$(node).parents(MEDIA).length);
  const chunks = roots.map(node => {
    if (node.startIndex == null || node.endIndex == null) fail('MEDIA_SOURCE_RANGE_MISSING');
    return html.slice(node.startIndex, node.endIndex + 1);
  });
  // Attributes and nested media order are compared too, not merely totals.
  const signature = nodes.map(node => ({ tag: node.name, attrs: node.attribs }));
  return { count: nodes.length, chunks, signature };
}

function replaceBody(original, replacement) {
  const before = media(original);
  if (media(replacement).count) fail('OVERLAY_MEDIA_NOT_ALLOWED');
  const html = replacement + (before.chunks.length ? '\n' + before.chunks.join('\n') : '');
  const after = media(html);
  if (before.count !== after.count || !equal(before.signature, after.signature)) fail('MEDIA_PRESERVATION_FAILED');
  return { html, before: before.count, after: after.count, lengthBefore: original.length, lengthAfter: html.length };
}

function planDocument(collection, original, patch, bodyFields) {
  const changes = {};
  const bodies = [];
  for (const field of FIELDS) if (own(patch, field) && !equal(original[field], patch[field])) changes[field] = patch[field];
  for (const [field, replacement] of bodyFields) {
    const result = replaceBody(original[field] || '', replacement);
    bodies.push({ field, ...result });
    if (original[field] !== result.html) changes[field] = result.html;
  }
  return { collection, id: idOf(original), title: patch.title || original.title || '', original, changes, bodies, status: 'READY', reason: '' };
}

function buildPlan(snapshot, overlay) {
  const rows = [];
  for (const kind of ['work', 'filed']) {
    const collection = kind === 'filed' ? 'workshop' : 'work';
    if (!overlay[kind] || typeof overlay[kind] !== 'object' || Array.isArray(overlay[kind])) fail('INVALID_OVERLAY_GROUP');
    for (const [id, patch] of Object.entries(overlay[kind])) {
      try {
        if (!/^[a-f\d]{24}$/i.test(id)) fail('INVALID_DOCUMENT_ID');
        const original = snapshot[collection].find(doc => idOf(doc) === id);
        if (!original) fail('DOCUMENT_NOT_FOUND');
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('INVALID_PATCH');
        const bodies = [];
        if (own(patch, 'content')) {
          bodies.push(['contents', patch.content]);
          // Preserve each legacy field's media separately; never duplicate images between fields.
          if (original.htmlContent) bodies.push(['htmlContent', patch.content]);
        }
        const row = planDocument(collection, original, patch, bodies);
        const Model = require(collection === 'work' ? '../models/Work' : '../models/Filed');
        if (new Model({ ...original, ...row.changes }).validateSync()) fail('SCHEMA_VALIDATION_FAILED');
        rows.push(row);
      } catch (error) {
        rows.push({ collection, id, title: '', changes: {}, bodies: [], status: 'SKIP', reason: error.safeCode || 'INVALID_DOCUMENT' });
      }
    }
  }
  for (const kind of ['work', 'filed']) {
    if (!overlay.headers || !own(overlay.headers, kind)) continue;
    const collection = kind + '_header';
    const docs = snapshot[collection];
    const subtitle = overlay.headers[kind].subtitle;
    if (docs.length !== 1 || typeof subtitle !== 'string') {
      rows.push({ collection, id: '-', changes: {}, bodies: [], status: 'SKIP', reason: 'HEADER_NOT_UNIQUE_OR_INVALID' });
    } else {
      rows.push({ collection, id: idOf(docs[0]), original: docs[0], changes: docs[0].subtitle === subtitle ? {} : { subtitle }, bodies: [], status: 'READY', reason: '' });
    }
  }
  if (overlay.about && own(overlay.about, 'htmlContent')) {
    const active = snapshot.about.filter(doc => doc.isActive === true);
    try {
      if (active.length !== 1) fail('ACTIVE_ABOUT_NOT_UNIQUE');
      rows.push(planDocument('about', active[0], {}, [['htmlContent', overlay.about.htmlContent]]));
    } catch (error) {
      rows.push({ collection: 'about', id: '-', changes: {}, bodies: [], status: 'SKIP', reason: error.safeCode || 'INVALID_ABOUT' });
    }
  }
  return rows;
}

function secretGuard(values) {
  const secrets = values.filter(value => typeof value === 'string' && value.length >= 6);
  return text => {
    if (secrets.some(secret => text.includes(secret))) fail('SECRET_VALUE_IN_OUTPUT_BLOCKED');
    return text;
  };
}
// Read-only diagnostic: return environment KEY names and structural paths only.
// Never include a document ID/title, matched text, URI, or environment value.
function findSecretCollisions(snapshot, env) {
  const entries = Object.entries(env).filter(([, value]) => typeof value === 'string' && value.length >= 6);
  const collisions = [];
  function visit(value, fieldPath) {
    if (typeof value === 'string') {
      for (const [environmentKey, secret] of entries) if (value.includes(secret)) collisions.push({ environmentKey, fieldPath });
    } else if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, `${fieldPath}[${index}]`));
    else if (value && typeof value === 'object' && !value._bsontype && !(value instanceof Date)) {
      for (const [key, entry] of Object.entries(value)) visit(entry, fieldPath ? `${fieldPath}.${key}` : key);
    }
  }
  visit(snapshot, '');
  return collisions;
}
// Opt-in only: an approved DB backup may retain its existing public image URLs.
// Console/report output still checks every environment value. Credentials stay blocked.
function backupGuard(env, allowPublicImageUrl = false) {
  return secretGuard(Object.entries(env)
    .filter(([key]) => !(allowPublicImageUrl && key === 'IMAGEKIT_URL_ENDPOINT'))
    .map(([, value]) => value));
}
function writePrivate(file, text, guard) {
  fs.writeFileSync(file, guard(text), { flag: 'wx', mode: 0o600 });
}
async function readSnapshot(db, session) {
  const snapshot = {};
  for (const name of COLLECTIONS) snapshot[name] = await db.collection(name).find({}, { session, promoteLongs: false, promoteValues: false }).toArray();
  return snapshot;
}
function saveBackup(snapshot, guard) {
  const dir = path.join(ROOT, 'db-backup-' + stamp());
  fs.mkdirSync(dir, { recursive: false, mode: 0o700 });
  const manifest = { format: 'nodetree-text-standard-ejson-v1', createdAt: new Date().toISOString(), collections: {} };
  for (const name of COLLECTIONS) {
    const text = encode(snapshot[name]);
    writePrivate(path.join(dir, name + '.json'), text, guard);
    manifest.collections[name] = { count: snapshot[name].length, sha256: hash(text) };
  }
  writePrivate(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), guard);
  return dir;
}
function loadBackup(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'nodetree-text-standard-ejson-v1') fail('INVALID_BACKUP_FORMAT');
  const snapshot = {};
  for (const name of COLLECTIONS) {
    const text = fs.readFileSync(path.join(dir, name + '.json'), 'utf8');
    const entry = manifest.collections[name];
    if (!entry || hash(text) !== entry.sha256) fail('BACKUP_CHECKSUM_MISMATCH');
    const docs = decode(text);
    if (!Array.isArray(docs) || docs.length !== entry.count || docs.some(doc => !doc._id) || new Set(docs.map(idOf)).size !== docs.length) fail('INVALID_BACKUP_DOCUMENTS');
    snapshot[name] = docs;
  }
  return snapshot;
}
function restorePlan(current, target) {
  return COLLECTIONS.map(collection => ({ collection, id: '*', changes: { fullCollectionRestore: true }, bodies: [], status: 'READY', reason: `현재 ${current[collection].length}건 → 원본 ${target[collection].length}건 (백업 이후 추가 문서 삭제 포함)` }));
}
function report(rows, { mode, backup }) {
  const escaped = value => String(value || '').replace(/[|\r\n]/g, ' ');
  const skipped = rows.filter(row => row.status === 'SKIP' || row.status === 'FAILED').length;
  const posts = rows.filter(row => ['work', 'workshop'].includes(row.collection));
  return [`# DB ${mode} · ${new Date().toISOString()}`, '', `- 백업: ${backup}`, `- 대상: 글 ${posts.length}건 / 전체 ${rows.length}건`, `- 미디어 검증 통과: ${rows.filter(row => row.bodies.length && !['SKIP', 'FAILED'].includes(row.status)).length}건`, `- 건너뜀/실패: ${skipped}건`, '- filed API → workshop 컬렉션; API content → contents. htmlContent는 별도 필드별 미디어 보존.', '- 본문 길이는 HTML 문자열 문자 수. 미디어는 중첩 source/track/picture를 포함하며 속성과 순서도 비교.', '', '| 컬렉션 | ID | 변경 필드 | 본문 길이 before→after | 미디어 before→after | 상태 | 사유 |', '|---|---|---|---|---|---|---|', ...rows.map(row => `| ${row.collection} | ${escaped(row.id)} | ${Object.keys(row.changes).join(', ') || '없음'} | ${row.bodies.map(body => `${body.field}: ${body.lengthBefore}→${body.lengthAfter}`).join('; ')} | ${row.bodies.map(body => `${body.field}: ${body.before}→${body.after}`).join('; ')} | ${row.status} | ${escaped(row.reason)} |`), ''].join('\n');
}

async function run(argv) {
  const args = options(argv);
  if (args.help) {
    console.log('node scripts/apply-text-standard-20261006.js [--dry-run] [--overlay <파일>] [--env-file <backend/.env>]\nnode scripts/apply-text-standard-20261006.js --restore <백업폴더> [--dry-run] [--env-file <backend/.env>]\n쓰기 모드는 명시적인 --apply만 허용. 기본은 백업 + dry-run. 이번 작업에서는 --apply 금지. 공개 이미지 주소의 백업 보존을 승인받은 경우에만 --allow-public-image-url 사용.');
    return;
  }
  // Parse directly, never log dotenv's values; do not inherit a pulled/injected URI.
  stage = 'read-env-file';
  const env = dotenv.parse(fs.readFileSync(args['env-file']));
  const uri = env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) fail('MONGODB_URI_MISSING_OR_INVALID');
  const guard = secretGuard(Object.values(env));
  stage = 'read-overlay-or-restore';
  const overlay = args.restore ? null : JSON.parse(fs.readFileSync(args.overlay, 'utf8'));
  const target = args.restore ? loadBackup(args.restore) : null;
  stage = 'connect-db';
  const connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000, autoIndex: false, autoCreate: false, monitorCommands: false });
  let session;
  try {
    await connection.asPromise();
    const db = connection.db;
    stage = 'read-snapshot';
    session = await connection.startSession();
    // A read-only snapshot transaction avoids cross-collection backup inconsistency.
    session.startTransaction({ readConcern: { level: 'snapshot' } });
    const current = await readSnapshot(db, session);
    await session.abortTransaction();
    if (args.diagnose) {
      console.log(JSON.stringify({ mode: 'read-only-secret-collision-diagnostic', collisions: findSecretCollisions(current, env) }));
      return;
    }
    stage = 'write-local-backup';
    const backup = saveBackup(current, backupGuard(env, args.allowPublicImageUrl));
    stage = 'build-plan';
    const rows = target ? restorePlan(current, target) : buildPlan(current, overlay);
    const mode = args.apply ? (target ? 'restore-apply' : 'apply') : (target ? 'restore-dry-run' : 'dry-run');
    const reportPath = path.join(ROOT, 'claude', `db-${mode === 'dry-run' ? 'dryrun' : mode}-${stamp()}.md`);
    if (args.apply) {
      stage = 'apply-transaction';
      // One transaction, optimistic original-document comparison, then verification.
      session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      try {
        if (target) {
          const latest = await readSnapshot(db, session);
          for (const name of COLLECTIONS) {
            const sorted = docs => [...docs].sort((a, b) => idOf(a).localeCompare(idOf(b)));
            if (!equal(sorted(current[name]), sorted(latest[name]))) fail('CONCURRENT_COLLECTION_CHANGE');
            await db.collection(name).deleteMany({}, { session });
            if (target[name].length) await db.collection(name).insertMany(target[name], { session });
            const after = await db.collection(name).find({}, { session, promoteLongs: false, promoteValues: false }).toArray();
            if (!equal(sorted(after), sorted(target[name]))) fail('RESTORE_VERIFICATION_FAILED');
          }
        } else {
          for (const row of rows.filter(row => row.status === 'READY')) {
            const collection = db.collection(row.collection);
            const original = await collection.findOne({ _id: row.original._id }, { session, promoteValues: false, promoteLongs: false });
            if (!equal(original, row.original)) fail('CONCURRENT_DOCUMENT_CHANGE');
            if (Object.keys(row.changes).length) await collection.updateOne({ _id: row.original._id }, { $set: row.changes }, { session });
            const after = await collection.findOne({ _id: row.original._id }, { session, promoteValues: false, promoteLongs: false });
            if (!equal(after, { ...row.original, ...row.changes })) fail('WRITE_VERIFICATION_FAILED');
          }
        }
        await session.commitTransaction();
        for (const row of rows) if (row.status === 'READY') row.status = 'VERIFIED';
      } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        for (const row of rows) if (row.status === 'READY') { row.status = 'FAILED'; row.reason = error.safeCode || 'TRANSACTION_FAILED'; }
      }
    }
    stage = 'write-local-report';
    writePrivate(reportPath, report(rows, { mode, backup }), guard);
    console.log(guard(JSON.stringify({ mode, backup, report: reportPath, targets: rows.length, posts: rows.filter(row => ['work', 'workshop'].includes(row.collection)).length, mediaPassed: rows.filter(row => row.bodies.length && !['SKIP', 'FAILED'].includes(row.status)).length, skipped: rows.filter(row => row.status === 'SKIP').length, failed: rows.filter(row => row.status === 'FAILED').length })));
    if (rows.some(row => ['SKIP', 'FAILED'].includes(row.status))) process.exitCode = 2;
  } finally {
    if (session) await session.endSession();
    await connection.close();
  }
}

if (require.main === module) run(process.argv.slice(2)).catch(error => {
  // Do not expose raw driver errors, stack traces, URIs, hostnames or dotenv values.
  console.error('DB 작업 중단: ' + JSON.stringify(safeDiagnostic(error)));
  process.exitCode = 1;
});
module.exports = { options, media, replaceBody, buildPlan, restorePlan, encode, decode, saveBackup, loadBackup, secretGuard, backupGuard, findSecretCollisions, safeDiagnostic, report, run };
