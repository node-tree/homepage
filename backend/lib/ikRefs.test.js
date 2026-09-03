// ikRefs 순수 로직 단위 테스트
//   실행: node --test backend/lib/ikRefs.test.js
//   (백엔드에는 jest 가 없다. Node 18 내장 test runner 를 쓴다 — 새 의존성 없음.)
const test = require('node:test');
const assert = require('node:assert');

process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/gc3jtyt9o';
const EP = 'https://ik.imagekit.io/gc3jtyt9o';

const {
  canonPath,
  buildMapper,
  replaceInString,
  replaceDeep,
  scanDeep,
  fileMoveMapping,
  fileRenameMapping,
  folderMoveMapping,
  folderRenameMapping,
  invertMappings,
} = require('./ikRefs');

// ── canonPath ──────────────────────────────────────────────────
test('canonPath: 쿼리·해시 제거, 앞 슬래시 보장, 중복 슬래시 정리', () => {
  assert.equal(canonPath('/a/b.jpg?tr=w-300'), '/a/b.jpg');
  assert.equal(canonPath('/a/b.jpg#x'), '/a/b.jpg');
  assert.equal(canonPath('a/b.jpg'), '/a/b.jpg');
  assert.equal(canonPath('/a//b.jpg'), '/a/b.jpg');
  assert.equal(canonPath('/a/b/'), '/a/b');
});

test('canonPath: 퍼센트 인코딩과 원문 한글이 같은 값으로 정규화된다', () => {
  const raw = '/mcwjd/생산소/포스터/a.jpg';
  const enc = '/mcwjd/%EC%83%9D%EC%82%B0%EC%86%8C/%ED%8F%AC%EC%8A%A4%ED%84%B0/a.jpg';
  assert.equal(canonPath(raw), canonPath(enc));
});

test('canonPath: NFD(자모 분리) 인코딩도 NFC 로 통일된다', () => {
  // %E1%84%83%E1%85%A1 = 'ᄃ'+'ᅡ' (NFD) → NFC 로는 '다'
  const nfd = '/mcwjd/%E1%84%83%E1%85%A1%E1%84%8E%E1%85%A601.png';
  const nfc = '/mcwjd/단체01.png'; // 참고용(글자는 다르지만 아래는 실제 NFD→NFC 비교)
  assert.equal(canonPath(nfd), canonPath(decodeURIComponent(nfd).normalize('NFC')));
  assert.equal(canonPath('/a/다.png'), canonPath('/a/' + '다'.normalize('NFD') + '.png'));
  assert.ok(nfc.length > 0);
});

test('canonPath: 깨진 퍼센트 인코딩은 예외 없이 원문 유지', () => {
  assert.equal(canonPath('/a/100%.jpg'), '/a/100%.jpg');
});

// ── buildMapper ────────────────────────────────────────────────
test('mapper: 파일은 완전 일치만', () => {
  const map = buildMapper([{ from: '/a/b.jpg', to: '/c/b.jpg', kind: 'file' }]);
  assert.equal(map('/a/b.jpg'), '/c/b.jpg');
  assert.equal(map('/a/b.jpg.bak'), null);
  assert.equal(map('/a/bb.jpg'), null);
});

test('mapper: 폴더는 접두사 치환 — /older 를 오매칭하지 않는다(경계)', () => {
  const map = buildMapper([{ from: '/old', to: '/new', kind: 'folder' }]);
  assert.equal(map('/old'), '/new');
  assert.equal(map('/old/x.jpg'), '/new/x.jpg');
  assert.equal(map('/old/deep/y.png'), '/new/deep/y.png');
  assert.equal(map('/older'), null, '/older 는 매칭되면 안 된다');
  assert.equal(map('/older/x.jpg'), null, '/older/x.jpg 는 매칭되면 안 된다');
  assert.equal(map('/oldx'), null);
});

test('mapper: 중첩 폴더 매핑은 더 구체적인(긴) 규칙이 이긴다', () => {
  const map = buildMapper([
    { from: '/a', to: '/A', kind: 'folder' },
    { from: '/a/b', to: '/B', kind: 'folder' },
  ]);
  assert.equal(map('/a/b/c.jpg'), '/B/c.jpg');
  assert.equal(map('/a/z.jpg'), '/A/z.jpg');
});

test('mapper: from===to 이거나 루트면 무시', () => {
  const map = buildMapper([
    { from: '/a', to: '/a', kind: 'folder' },
    { from: '/', to: '/x', kind: 'folder' },
  ]);
  assert.equal(map('/a/1.jpg'), null);
});

// ── replaceInString ────────────────────────────────────────────
test('문자열: 기본 치환 + 무관한 문자열은 그대로', () => {
  const map = buildMapper([{ from: '/a/b.jpg', to: '/c/b.jpg', kind: 'file' }]);
  const r = replaceInString(`${EP}/a/b.jpg`, map, EP);
  assert.equal(r.out, `${EP}/c/b.jpg`);
  assert.equal(r.count, 1);

  const none = replaceInString('그냥 텍스트 https://example.com/a/b.jpg', map, EP);
  assert.equal(none.count, 0);
  assert.equal(none.out, '그냥 텍스트 https://example.com/a/b.jpg');
});

test('문자열: 다른 ImageKit 계정 URL 은 건드리지 않는다', () => {
  const map = buildMapper([{ from: '/a/b.jpg', to: '/c/b.jpg', kind: 'file' }]);
  const s = 'https://ik.imagekit.io/otheracct/a/b.jpg';
  assert.equal(replaceInString(s, map, EP).count, 0);
});

test('문자열: 쿼리(?tr=, ?updatedAt=)와 해시를 보존한다', () => {
  const map = buildMapper([{ from: '/a/b.jpg', to: '/c/b.jpg', kind: 'file' }]);
  assert.equal(
    replaceInString(`${EP}/a/b.jpg?tr=w-300,f-auto`, map, EP).out,
    `${EP}/c/b.jpg?tr=w-300,f-auto`
  );
  assert.equal(
    replaceInString(`${EP}/a/b.jpg?updatedAt=1781308372946`, map, EP).out,
    `${EP}/c/b.jpg?updatedAt=1781308372946`
  );
  assert.equal(replaceInString(`${EP}/a/b.jpg#frag`, map, EP).out, `${EP}/c/b.jpg#frag`);
});

test('문자열: HTML 본문 안 여러 img src 를 모두 치환하고 따옴표에서 정확히 끊는다', () => {
  const map = buildMapper([{ from: '/old', to: '/new', kind: 'folder' }]);
  const html =
    `<p>앞</p><img src="${EP}/old/1.jpg" alt="a"/>` +
    `<figure><img src='${EP}/old/deep/2.png?tr=w-800'></figure>` +
    `<a href="${EP}/older/3.jpg">건드리면 안 됨</a>`;
  const r = replaceInString(html, map, EP);
  assert.equal(r.count, 2);
  assert.ok(r.out.includes(`src="${EP}/new/1.jpg"`));
  assert.ok(r.out.includes(`src='${EP}/new/deep/2.png?tr=w-800'`));
  assert.ok(r.out.includes(`${EP}/older/3.jpg`), '/older 는 그대로여야 한다');
  assert.ok(r.out.includes('alt="a"'));
});

test('문자열: 한글 원문 경로는 원문 스타일로, 인코딩 경로는 인코딩 스타일로 유지', () => {
  const map = buildMapper([
    { from: '/mcwjd/생산소/포스터', to: '/archive/포스터', kind: 'folder' },
  ]);
  // 원문(비인코딩) 저장값
  const raw = `${EP}/mcwjd/생산소/포스터/a.jpg`;
  assert.equal(replaceInString(raw, map, EP).out, `${EP}/archive/포스터/a.jpg`);

  // 퍼센트 인코딩 저장값 → 인코딩된 결과로
  const enc = `${EP}/mcwjd/%EC%83%9D%EC%82%B0%EC%86%8C/%ED%8F%AC%EC%8A%A4%ED%84%B0/a.jpg`;
  const r = replaceInString(enc, map, EP);
  assert.equal(r.count, 1);
  assert.ok(/%ED%8F%AC%EC%8A%A4%ED%84%B0/.test(r.out), '결과도 인코딩 형태여야 한다');
  assert.equal(decodeURIComponent(r.out), `${EP}/archive/포스터/a.jpg`);
});

test('문자열: NFD 로 인코딩된 저장값도 NFC 매핑으로 치환된다', () => {
  const nfdName = '다'.normalize('NFD'); // 'ᄃ'+'ᅡ'
  const stored = `${EP}/mcwjd/${encodeURIComponent(nfdName)}/a.jpg`;
  const map = buildMapper([{ from: '/mcwjd/다', to: '/archive/다', kind: 'folder' }]);
  const r = replaceInString(stored, map, EP);
  assert.equal(r.count, 1, 'NFD 저장값이 NFC 매핑에 걸려야 한다');
  assert.equal(decodeURIComponent(r.out), `${EP}/archive/다/a.jpg`);
});

// ── replaceDeep ────────────────────────────────────────────────
test('문서: 중첩 객체·배열·HTML 을 모두 훑는다', () => {
  const map = buildMapper([{ from: '/old', to: '/new', kind: 'folder' }]);
  const doc = {
    _id: 'x',
    thumbnail: `${EP}/old/t.jpg`,
    contents: `<img src="${EP}/old/c.jpg">`,
    imageLayout: [{ src: `${EP}/old/1.jpg` }, { src: `${EP}/keep/2.jpg` }],
    data: {
      'signal-map': { photos: [`${EP}/old/p1.jpg`, `${EP}/old/p2.jpg`] },
      members: { a: { character: `${EP}/old/m.png` } },
    },
    updatedAt: new Date('2026-01-01'),
    count: 3,
    flag: true,
    nothing: null,
  };
  const r = replaceDeep(doc, map, EP);
  assert.equal(r.count, 6);
  assert.equal(r.value.thumbnail, `${EP}/new/t.jpg`);
  assert.equal(r.value.contents, `<img src="${EP}/new/c.jpg">`);
  assert.equal(r.value.imageLayout[0].src, `${EP}/new/1.jpg`);
  assert.equal(r.value.imageLayout[1].src, `${EP}/keep/2.jpg`, '무관한 경로는 불변');
  assert.deepEqual(r.value.data['signal-map'].photos, [`${EP}/new/p1.jpg`, `${EP}/new/p2.jpg`]);
  assert.equal(r.value.data.members.a.character, `${EP}/new/m.png`);
  assert.ok(r.value.updatedAt instanceof Date, 'Date 는 그대로 Date');
  assert.equal(r.value.updatedAt.getTime(), doc.updatedAt.getTime());
  assert.equal(r.value.count, 3);
  assert.equal(r.value.flag, true);
  assert.equal(r.value.nothing, null);
});

test('문서: 변경이 없으면 원본 객체 참조를 그대로 돌려준다(불필요한 쓰기 방지)', () => {
  const map = buildMapper([{ from: '/nope', to: '/nah', kind: 'folder' }]);
  const doc = { a: `${EP}/keep/1.jpg`, b: { c: ['x', 1, null] } };
  const r = replaceDeep(doc, map, EP);
  assert.equal(r.count, 0);
  assert.strictEqual(r.value, doc, '동일 참조여야 한다');
});

test('문서: Buffer·ObjectId 유사 객체는 내려가지 않는다', () => {
  const map = buildMapper([{ from: '/old', to: '/new', kind: 'folder' }]);
  const oid = { _bsontype: 'ObjectId', id: Buffer.from('abcdefghijkl') };
  const doc = { oid, buf: Buffer.from(`${EP}/old/x.jpg`), s: `${EP}/old/y.jpg` };
  const r = replaceDeep(doc, map, EP);
  assert.equal(r.count, 1);
  assert.strictEqual(r.value.oid, oid);
  assert.ok(Buffer.isBuffer(r.value.buf));
  assert.equal(r.value.s, `${EP}/new/y.jpg`);
});

// ── scanDeep ───────────────────────────────────────────────────
test('scanDeep: 필드 경로와 canonical path 를 수집한다', () => {
  const doc = {
    thumbnail: `${EP}/a/1.jpg`,
    layout: [{ src: `${EP}/a/2.jpg?tr=w-300` }],
    deep: { k: { photos: [`${EP}/%ED%8F%AC%EC%8A%A4%ED%84%B0/3.jpg`] } },
  };
  const out = [];
  scanDeep(doc, (r) => out.push(r), EP);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((o) => o.field).sort(),
    ['deep.k.photos[0]', 'layout[0].src', 'thumbnail']
  );
  assert.ok(out.some((o) => o.path === '/a/2.jpg'), '쿼리는 제거된 canonical');
  assert.ok(out.some((o) => o.path === '/포스터/3.jpg'), '인코딩은 디코딩된 canonical');
});

// ── 매핑 생성 헬퍼 ─────────────────────────────────────────────
test('헬퍼: 파일 이동/이름변경, 폴더 이동/이름변경 매핑', () => {
  assert.deepEqual(fileMoveMapping('/a/b.jpg', '/c'), { from: '/a/b.jpg', to: '/c/b.jpg', kind: 'file' });
  assert.deepEqual(fileMoveMapping('/a/b.jpg', '/'), { from: '/a/b.jpg', to: '/b.jpg', kind: 'file' });
  assert.deepEqual(fileRenameMapping('/a/b.jpg', 'z.jpg'), { from: '/a/b.jpg', to: '/a/z.jpg', kind: 'file' });
  assert.deepEqual(folderMoveMapping('/a/b', '/c'), { from: '/a/b', to: '/c/b', kind: 'folder' });
  assert.deepEqual(folderRenameMapping('/a/b', 'z'), { from: '/a/b', to: '/a/z', kind: 'folder' });
});

test('invertMappings: 보상 이동/롤백용 역매핑', () => {
  const m = [{ from: '/a', to: '/b', kind: 'folder' }];
  assert.deepEqual(invertMappings(m), [{ from: '/b', to: '/a', kind: 'folder' }]);
});

test('왕복: 치환 후 역매핑으로 원상복구된다', () => {
  const mappings = [{ from: '/mcwjd/생산소', to: '/archive/생산소', kind: 'folder' }];
  const doc = {
    contents: `<img src="${EP}/mcwjd/생산소/포스터/a.jpg"><img src="${EP}/mcwjd/생산소/b.png?tr=w-800">`,
    keep: `${EP}/other/c.jpg`,
  };
  const fwd = replaceDeep(doc, buildMapper(mappings), EP);
  assert.equal(fwd.count, 2);
  const back = replaceDeep(fwd.value, buildMapper(invertMappings(mappings)), EP);
  assert.deepEqual(back.value, doc);
});
