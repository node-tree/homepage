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
