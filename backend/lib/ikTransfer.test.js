// ikTransfer 오케스트레이션 단위 테스트 — 네트워크·ImageKit 없이 가짜 SDK 로 검증한다.
//   실행: node --test backend/lib/ikTransfer.test.js
//
//   실제 ImageKit 왕복은 _workspace/09_media/harness/transfer-live.js 가 담당한다.
//   여기서는 "실패했을 때 무엇을 되돌리는가"처럼 실계정으로 재현하기 번거로운 분기를 굳힌다.
const test = require('node:test');
const assert = require('node:assert');

process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/gc3jtyt9o';
const { transferFile, encodePathForUrl } = require('./ikTransfer');

/** 가짜 ImageKit SDK */
function fakeIk({ files = [], uploadResult = null, uploadThrows = null, deleteThrows = null } = {}) {
  const calls = { uploads: [], deletes: [], lists: [] };
  return {
    calls,
    async getFileDetails(id) {
      const f = files.find((x) => x.fileId === id);
      if (!f) throw new Error('not found');
      return f;
    },
    async listFiles({ path }) {
      calls.lists.push(path);
      const p = path || '/';
      return files.filter((f) => f.filePath.slice(0, f.filePath.lastIndexOf('/')) === (p === '/' ? '' : p));
    },
    async upload(args) {
      calls.uploads.push(args);
      if (uploadThrows) throw new Error(uploadThrows);
      const folder = args.folder === '/' ? '' : args.folder;
      return (
        uploadResult || {
          fileId: 'new-id',
          name: args.fileName,
          filePath: `${folder}/${args.fileName}`,
          size: args.file.length,
          width: 400,
          height: 240,
        }
      );
    },
    async deleteFile(id) {
      calls.deletes.push(id);
      if (deleteThrows) throw new Error(deleteThrows);
    },
  };
}

const SRC = {
  fileId: 'src-id',
  name: 'a.jpg',
  filePath: '/old/a.jpg',
  size: 100,
  width: 400,
  height: 240,
  fileType: 'image',
};
const dl = async () => ({ buf: Buffer.alloc(100, 7) });

test('encodePathForUrl: 슬래시는 유지하고 세그먼트만 인코딩', () => {
  assert.equal(encodePathForUrl('/a/b c.jpg'), '/a/b%20c.jpg');
  assert.equal(encodePathForUrl('/한글/사진.jpg'), '/%ED%95%9C%EA%B8%80/%EC%82%AC%EC%A7%84.jpg');
});

test('move: 업로드 → 참조 갱신 → 원본 삭제 순서', async () => {
  const ik = fakeIk({ files: [SRC] });
  const order = [];
  const r = await transferFile({
    ik,
    db: {},
    sourceFilePath: '/old/a.jpg',
    destinationFolder: '/new',
    mode: 'move',
    downloadFn: dl,
    onRefsUpdate: async () => {
      order.push('refs');
      return { batchId: 'b1', documents: 1, refsUpdated: { work: 2 }, failures: [] };
    },
  });
  order.push('deleted:' + ik.calls.deletes.join(','));
  assert.equal(r.destinationPath, '/new/a.jpg');
  assert.equal(r.newFileId, 'new-id');
  assert.equal(r.originalDeleted, true);
  assert.deepEqual(r.refs.refsUpdated, { work: 2 });
  assert.deepEqual(order, ['refs', 'deleted:src-id'], '참조 갱신이 원본 삭제보다 먼저여야 한다');
  // 업로드는 덮어쓰기 금지 옵션으로 나가야 한다
  assert.equal(ik.calls.uploads[0].useUniqueFileName, false);
  assert.equal(ik.calls.uploads[0].overwriteFile, false);
});

test('copy: 참조 갱신도 원본 삭제도 하지 않는다', async () => {
  const ik = fakeIk({ files: [SRC] });
  const r = await transferFile({
    ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'copy', downloadFn: dl,
    onRefsUpdate: async () => { throw new Error('복사에서는 호출되면 안 된다'); },
  });
  assert.equal(r.mode, 'copy');
  assert.equal(r.originalDeleted, false);
  assert.equal(r.refs.skipped, true);
  assert.deepEqual(ik.calls.deletes, []);
});

test('대상에 동명 파일이 있으면 409 이고 업로드하지 않는다', async () => {
  const ik = fakeIk({
    files: [SRC, { fileId: 'other', name: 'a.jpg', filePath: '/new/a.jpg', size: 1, fileType: 'image' }],
  });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl }),
    (e) => e.status === 409 && /이미 있습니다/.test(e.message)
  );
  assert.equal(ik.calls.uploads.length, 0, '충돌이면 업로드 자체를 하지 않는다');
});

test('같은 폴더로 이동하면 400', async () => {
  const ik = fakeIk({ files: [SRC] });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/old', mode: 'move', downloadFn: dl }),
    (e) => e.status === 400
  );
});

test('원본 크기가 메타와 다르면 502 (업로드 안 함)', async () => {
  const ik = fakeIk({ files: [SRC] });
  const shortDl = async () => ({ buf: Buffer.alloc(50) }); // 메타는 100
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: shortDl }),
    (e) => e.status === 502 && /크기가 메타데이터와 다릅니다/.test(e.message)
  );
  assert.equal(ik.calls.uploads.length, 0);
});

test('복제 검증 실패(해상도 불일치) → 새 파일 삭제 후 502, 원본은 유지', async () => {
  const ik = fakeIk({
    files: [SRC],
    uploadResult: { fileId: 'new-id', name: 'a.jpg', filePath: '/new/a.jpg', size: 100, width: 399, height: 240 },
  });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl }),
    (e) => e.status === 502 && /해상도 불일치/.test(e.message)
  );
  assert.deepEqual(ik.calls.deletes, ['new-id'], '새 파일만 지우고 원본은 건드리지 않는다');
});

test('복제 검증 실패(크기 불일치) → 새 파일 삭제 후 502', async () => {
  const ik = fakeIk({
    files: [SRC],
    uploadResult: { fileId: 'new-id', name: 'a.jpg', filePath: '/new/a.jpg', size: 99, width: 400, height: 240 },
  });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl }),
    (e) => e.status === 502 && /크기 불일치/.test(e.message)
  );
  assert.deepEqual(ik.calls.deletes, ['new-id']);
});

test('DB 참조 갱신 실패 → 새 파일 삭제(보상), 원본 삭제 안 함', async () => {
  const ik = fakeIk({ files: [SRC] });
  await assert.rejects(
    () =>
      transferFile({
        ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl,
        onRefsUpdate: async () => { throw new Error('DB 터짐'); },
      }),
    (e) => e.status === 500 && e.compensated === true && /DB 터짐/.test(e.message)
  );
  assert.deepEqual(ik.calls.deletes, ['new-id'], '원본(src-id)은 지우면 안 된다');
});

test('updateRefs:true 인데 db 가 없으면 이동을 취소하고 새 파일을 지운다', async () => {
  const ik = fakeIk({ files: [SRC] });
  await assert.rejects(
    () => transferFile({ ik, db: null, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', updateRefs: true, downloadFn: dl }),
    (e) => e.status === 503
  );
  assert.deepEqual(ik.calls.deletes, ['new-id']);
});

test('원본 삭제 실패는 경고로 알리되 성공으로 처리(데이터 손실 없음)', async () => {
  const ik = fakeIk({ files: [SRC], deleteThrows: '삭제 권한 없음' });
  const r = await transferFile({
    ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl,
    onRefsUpdate: async () => ({ batchId: 'b', documents: 0, refsUpdated: {}, failures: [] }),
  });
  assert.equal(r.originalDeleted, false);
  assert.match(r.warning, /원본 삭제에 실패/);
});

test('NFD 파일명은 ImageKit 이 준 형태 그대로 대상 경로에 쓰인다', async () => {
  const nfd = '사진'.normalize('NFD');
  const src = { ...SRC, name: `${nfd}.jpg`, filePath: `/old/${nfd}.jpg` };
  const ik = fakeIk({ files: [src] });
  let mappingSeen = null;
  const r = await transferFile({
    ik, db: {}, sourceFilePath: `/old/${nfd}.jpg`, destinationFolder: '/new', mode: 'move', downloadFn: dl,
    onRefsUpdate: async (_db, mappings) => {
      mappingSeen = mappings;
      return { batchId: 'b', documents: 0, refsUpdated: {}, failures: [] };
    },
  });
  assert.equal(ik.calls.uploads[0].fileName, `${nfd}.jpg`, '업로드 파일명이 NFD 그대로');
  assert.equal(r.destinationPath, `/new/${nfd}.jpg`);
  assert.equal(mappingSeen[0].to, `/new/${nfd}.jpg`, 'DB 매핑 목적지도 NFD 유지');
  assert.notEqual(r.destinationPath, `/new/${'사진'.normalize('NFC')}.jpg`);
});

test('원본을 못 찾으면 404', async () => {
  const ik = fakeIk({ files: [] });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/missing.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl }),
    (e) => e.status === 404
  );
});

test('mode 가 잘못되면 400', async () => {
  const ik = fakeIk({ files: [SRC] });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'teleport', downloadFn: dl }),
    (e) => e.status === 400
  );
});

// ── 목록 인덱스 지연으로 인한 가짜 충돌 ─────────────────────────
//   listFiles 는 삭제된 파일을 몇 초간 계속 돌려준다. 그대로 믿으면
//   방금 비운 폴더로 되돌릴 때 409 가 나서 롤백이 실패한다(실측).
test('대상 목록에 유령 항목만 있으면 충돌이 아니다(getFileDetails 404)', async () => {
  const ghost = { fileId: 'ghost', name: 'a.jpg', filePath: '/new/a.jpg', size: 1, fileType: 'image' };
  const ik = fakeIk({ files: [SRC, ghost] });
  // 목록에는 남아 있지만 실제 조회는 404 인 상태를 만든다
  ik.getFileDetails = async (id) => {
    if (id === 'ghost') {
      const e = new Error('The requested asset does not exist.');
      e.$ResponseMetadata = { statusCode: 404 };
      throw e;
    }
    return SRC;
  };
  const r = await transferFile({
    ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl,
    onRefsUpdate: async () => ({ batchId: 'b', documents: 0, refsUpdated: {}, failures: [] }),
  });
  assert.equal(r.destinationPath, '/new/a.jpg', '유령 항목은 무시하고 진행해야 한다');
});

test('대상에 실제로 살아 있는 파일이면 여전히 409', async () => {
  const real = { fileId: 'real', name: 'a.jpg', filePath: '/new/a.jpg', size: 1, fileType: 'image' };
  const ik = fakeIk({ files: [SRC, real] });
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl }),
    (e) => e.status === 409
  );
});

test('존재 확인이 404 이외의 오류면 그대로 전파(조용히 덮어쓰지 않는다)', async () => {
  const ghost = { fileId: 'boom', name: 'a.jpg', filePath: '/new/a.jpg', size: 1, fileType: 'image' };
  const ik = fakeIk({ files: [SRC, ghost] });
  ik.getFileDetails = async () => { throw new Error('서버 오류'); };
  await assert.rejects(
    () => transferFile({ ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move', downloadFn: dl }),
    (e) => /서버 오류/.test(e.message)
  );
  assert.equal(ik.calls.uploads.length, 0);
});

// ── CDN 스테일 회피(캐시버스터) ─────────────────────────────────
//   실측 2026-09-06: 같은 경로에 A 삭제 → B 업로드 후 `?tr=orig-true` 만 붙이면
//   CDN 이 A 의 바이트를 계속 내준다. 파라미터를 빼면 최적화본(원본 아님)이 온다.
//   → 다운로드 URL 에 항상 고유 ik-cb 를 붙이고, 불일치 시 값만 바꿔 1회 재시도한다.
const { originalUrl } = require('./ikTransfer');

test('originalUrl: tr=orig-true 와 고유 ik-cb 를 함께 붙인다', () => {
  const u = originalUrl('https://ik.imagekit.io/acct/a/b.jpg', 'fid123', 0);
  assert.ok(u.includes('?tr=orig-true'), u);
  assert.ok(/[?&]ik-cb=/.test(u), u);
  assert.ok(u.includes('fid123'), u);
});

test('originalUrl: attempt 가 다르면 URL 이 반드시 달라진다(같은 ms 여도)', () => {
  const a0 = originalUrl('https://x/y.jpg', 'f', 0);
  const a1 = originalUrl('https://x/y.jpg', 'f', 1);
  assert.notEqual(a0, a1);
});

test('originalUrl: fileId 가 없어도 안전하다', () => {
  assert.ok(/ik-cb=nofid-/.test(originalUrl('https://x/y.jpg', null, 0)));
});

test('다운로드 URL 에 캐시버스터가 붙고, 무파라미터 재시도는 하지 않는다', async () => {
  const ik = fakeIk({ files: [SRC] });
  const urls = [];
  await transferFile({
    ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move',
    downloadFn: async (u) => { urls.push(u); return { buf: Buffer.alloc(100) }; },
    onRefsUpdate: async () => ({ batchId: 'b', documents: 0, refsUpdated: {}, failures: [] }),
  });
  assert.equal(urls.length, 1, '크기가 맞으면 1회만 받는다');
  assert.ok(/tr=orig-true/.test(urls[0]) && /ik-cb=/.test(urls[0]), urls[0]);
});

test('스테일로 크기가 어긋나면 캐시버스터를 바꿔 1회 재시도하고, 맞으면 진행한다', async () => {
  const ik = fakeIk({ files: [SRC] }); // 메타 size = 100
  const urls = [];
  let call = 0;
  const r = await transferFile({
    ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move',
    downloadFn: async (u) => {
      urls.push(u);
      call += 1;
      // 1회차: CDN 스테일(이전 파일 바이트) / 2회차: 진짜 원본
      return { buf: Buffer.alloc(call === 1 ? 55 : 100) };
    },
    onRefsUpdate: async () => ({ batchId: 'b', documents: 0, refsUpdated: {}, failures: [] }),
  });
  assert.equal(urls.length, 2);
  assert.notEqual(urls[0], urls[1], '재시도 URL 이 달라야 캐시를 우회한다');
  urls.forEach((u) => assert.ok(/tr=orig-true/.test(u), `무파라미터 재시도 금지: ${u}`));
  assert.equal(r.verified.size, 100);
});

test('재시도해도 크기가 어긋나면 502 (업로드하지 않는다)', async () => {
  const ik = fakeIk({ files: [SRC] });
  await assert.rejects(
    () =>
      transferFile({
        ik, db: {}, sourceFilePath: '/old/a.jpg', destinationFolder: '/new', mode: 'move',
        downloadFn: async () => ({ buf: Buffer.alloc(55) }),
      }),
    (e) => e.status === 502 && /원본 크기가 메타데이터와 다릅니다/.test(e.message)
  );
  assert.equal(ik.calls.uploads.length, 0);
});
