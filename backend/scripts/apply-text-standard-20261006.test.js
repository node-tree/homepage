'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { options, media, replaceBody, buildPlan, restorePlan, encode, decode, loadBackup, secretGuard, backupGuard, findSecretCollisions, safeDiagnostic } = require('./apply-text-standard-20261006');
const { BSON } = require('mongoose').mongo;
const id = new BSON.ObjectId('6858a73c30320a31b4fbf7ab');
const empty = () => ({ work: [], workshop: [], about: [], work_header: [], filed_header: [] });

test('default and restore are read-only; only exact --apply enables writes', () => {
  assert.equal(options([]).apply, false);
  assert.equal(options(['--restore', '/tmp/backup']).apply, false);
  assert.equal(options(['--dry-run']).apply, false);
  assert.equal(options(['--apply']).apply, true);
  assert.throws(() => options(['--apply=true']), /UNKNOWN_ARGUMENT/);
  assert.throws(() => options(['--apply', '--dry-run']), /CONFLICTING/);
  assert.throws(() => options(['--restore']), /VALUE_REQUIRED/);
});

test('nested media retains exact raw attributes, children, count and source order', () => {
  const original = `<p>old<img src='a.jpg' data-x="1"></p><p>old text</p><picture><source srcset="a.webp 1x, b.webp 2x"><img src="b.jpg"></picture><iframe src="https://video.invalid/a?x=1&amp;y=2" allowfullscreen></iframe><video poster="p.jpg"><source src="v.mp4"><track src="t.vtt"></video><object data="x.pdf"><embed src="fallback.pdf"></object><audio controls src="s.mp3"></audio>`;
  const result = replaceBody(original, '<p>new text</p>');
  assert.equal(result.before, 11);
  assert.equal(result.after, 11);
  assert.deepEqual(media(result.html).signature, media(original).signature);
  assert.deepEqual(media(result.html).chunks, media(original).chunks);
  assert.ok(!result.html.includes('old text'));
  assert.ok(result.html.includes("<img src='a.jpg' data-x=\"1\">"));
  assert.equal(media(result.html).chunks.length, 6);
});

test('duplicate images retain multiplicity; repeated run is idempotent', () => {
  const result = replaceBody('<img src="same"><img src="same">', '<p>new</p>');
  assert.equal(result.after, 2);
  assert.equal(replaceBody(result.html, '<p>new</p>').html, result.html);
});

test('replacement cannot introduce media or wrong body types', () => {
  assert.throws(() => replaceBody('<img src="a">', '<p>new<img src="b"></p>'), /OVERLAY_MEDIA/);
  assert.throws(() => replaceBody('', undefined), /BODY_NOT_STRING/);
});

test('legacy fields and actual workshop collection preserve omitted values and own media', () => {
  const snapshot = empty();
  snapshot.workshop = [{ _id: id, title: 'Old', contents: '<p>old</p><img src="a">', htmlContent: '<img src="b"><p>legacy</p>', venue: 'keep' }];
  const rows = buildPlan(snapshot, { work: {}, filed: { [String(id)]: { summary: 'new', content: '<p>new</p>', yearEnd: '' } } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'READY');
  assert.equal(rows[0].collection, 'workshop');
  assert.equal(rows[0].changes.contents, '<p>new</p>\n<img src="a">');
  assert.equal(rows[0].changes.htmlContent, '<p>new</p>\n<img src="b">');
  assert.equal(rows[0].changes.yearEnd, '');
  assert.equal(Object.hasOwn(rows[0].changes, 'venue'), false);
  assert.equal(Object.hasOwn(rows[0].changes, 'title'), false);
});

test('one missing or unsafe document is skipped while valid entries remain planned', () => {
  const snapshot = empty();
  snapshot.work = [{ _id: id, title: 'Work', contents: 'old' }];
  const rows = buildPlan(snapshot, { work: { [String(id)]: { content: '<p>new</p>' }, '6858a73c30320a31b4fbf7ac': { content: 'x' } }, filed: {} });
  assert.deepEqual(rows.map(row => row.status), ['READY', 'SKIP']);
  assert.equal(rows[1].reason, 'DOCUMENT_NOT_FOUND');
  assert.equal(Object.hasOwn(rows[0].changes, 'htmlContent'), false);
});

test('about requires a unique active document and keeps representative media', () => {
  const snapshot = empty();
  snapshot.about = [{ _id: id, isActive: true, htmlContent: '<p>old</p><img src="portrait">', content: 'untouched' }];
  snapshot.work_header = [{ _id: id, title: 'WORK', subtitle: 'old' }];
  const rows = buildPlan(snapshot, { work: {}, filed: {}, headers: { work: { title: 'ignored', subtitle: 'new subtitle' } }, about: { htmlContent: '<p class="about-lead">new</p>' } });
  assert.deepEqual(rows[0].changes, { subtitle: 'new subtitle' });
  assert.equal(rows[1].changes.htmlContent, '<p class="about-lead">new</p>\n<img src="portrait">');
  assert.equal(Object.hasOwn(rows[1].changes, 'content'), false);
  snapshot.about.push({ _id: new BSON.ObjectId(), isActive: true });
  assert.equal(buildPlan(snapshot, { work: {}, filed: {}, about: { htmlContent: 'x' } })[0].status, 'SKIP');
});

test('canonical EJSON preserves BSON types, dates, binary and ObjectId', () => {
  const original = [{ _id: id, createdAt: new Date('2026-10-06T00:00:00Z'), i: new BSON.Int32(12), d: new BSON.Double(12.5), l: BSON.Long.fromString('9007199254740999'), bin: new BSON.Binary(Buffer.from('test')) }];
  assert.equal(encode(decode(encode(original))), encode(original));
  assert.equal(decode(encode(original))[0].i._bsontype, 'Int32');
});

test('secret output is blocked without revealing any supplied secret', () => {
  const guard = secretGuard(['mongodb+srv://private-user:private-password@private-host/db', 'another-secret']);
  assert.equal(guard('safe report'), 'safe report');
  assert.throws(() => guard('another-secret'), error => error.message === 'SECRET_VALUE_IN_OUTPUT_BLOCKED');
});

test('restore plan describes entire collections and never mutates snapshots', () => {
  const current = empty(); const target = empty();
  current.work = [{ _id: id, contents: 'current' }];
  const before = encode(current);
  const rows = restorePlan(current, target);
  assert.equal(rows.length, 5);
  assert.match(rows[0].reason, /현재 1건 → 원본 0건/);
  assert.equal(encode(current), before);
});

test('restore refuses a tampered full-collection backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodetree-backup-test-'));
  try {
    const snapshot = empty();
    snapshot.work = [{ _id: id, contents: 'original', n: new BSON.Int32(1) }];
    const manifest = { format: 'nodetree-text-standard-ejson-v1', collections: {} };
    for (const [name, docs] of Object.entries(snapshot)) {
      const text = encode(docs);
      fs.writeFileSync(path.join(dir, name + '.json'), text);
      manifest.collections[name] = { count: docs.length, sha256: crypto.createHash('sha256').update(text).digest('hex') };
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    assert.equal(encode(loadBackup(dir)), encode(snapshot));
    fs.appendFileSync(path.join(dir, 'work.json'), '\n');
    assert.throws(() => loadBackup(dir), /BACKUP_CHECKSUM_MISMATCH/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('invalid model enum skips document without exposing validation content', () => {
  const snapshot = empty();
  snapshot.work = [{ _id: id, title: 'Work', contents: 'old' }];
  const rows = buildPlan(snapshot, { work: { [String(id)]: { status: 'private-invalid-value' } }, filed: {} });
  assert.equal(rows[0].status, 'SKIP');
  assert.equal(rows[0].reason, 'SCHEMA_VALIDATION_FAILED');
  assert.ok(!JSON.stringify(rows).includes('private-invalid-value'));
});

test('failure diagnostics expose only phase and whitelisted error classes', () => {
  const error = new Error('mongodb+srv://private-user:private-password@private-host/db');
  error.name = 'MongoServerSelectionError';
  error.cause = { code: 'EPERM', message: 'private-password' };
  assert.equal(safeDiagnostic(error).category, 'EPERM');
  assert.ok(!JSON.stringify(safeDiagnostic(error)).includes('private'));
  error.name = 'secret-error-name';
  error.cause.code = 'secret-error-code';
  assert.equal(safeDiagnostic(error).category, 'UNCLASSIFIED');
});

test('read-only collision diagnostics expose keys and field paths, never matched text', () => {
  const collisions = findSecretCollisions({ work: [{ title: 'fake-secret', contents: '<p>fake-secret</p>' }] }, { SOME_KEY: 'fake-secret' });
  assert.deepEqual(collisions, [{ environmentKey: 'SOME_KEY', fieldPath: 'work[0].title' }, { environmentKey: 'SOME_KEY', fieldPath: 'work[0].contents' }]);
  assert.ok(!JSON.stringify(collisions).includes('fake-secret'));
  assert.equal(options(['--diagnose-secret-collisions']).apply, false);
  assert.throws(() => options(['--diagnose-secret-collisions', '--apply']), /CONFLICTING/);
});

test('public image backup exception requires opt-in and never allows credentials', () => {
  const env = { IMAGEKIT_URL_ENDPOINT: 'https://public.invalid/images', MONGODB_URI: 'mongodb://private.invalid/db', IMAGEKIT_PRIVATE_KEY: 'private-test-key' };
  assert.throws(() => backupGuard(env)(env.IMAGEKIT_URL_ENDPOINT), /SECRET_VALUE/);
  assert.equal(backupGuard(env, true)(env.IMAGEKIT_URL_ENDPOINT), env.IMAGEKIT_URL_ENDPOINT);
  assert.throws(() => backupGuard(env, true)(env.MONGODB_URI), /SECRET_VALUE/);
  assert.throws(() => backupGuard(env, true)(env.IMAGEKIT_PRIVATE_KEY), /SECRET_VALUE/);
  assert.throws(() => secretGuard(Object.values(env))(env.IMAGEKIT_URL_ENDPOINT), /SECRET_VALUE/);
});
