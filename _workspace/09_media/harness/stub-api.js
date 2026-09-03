// 프론트 실렌더 관찰용 로컬 API 스텁 (포트 8000 — dev 기본 REACT_APP_API_URL).
//   ⚠️ 저장소에 들어가지 않는 검증 전용 도구. 백엔드 라우트 검증은 harness.js 로 별도 수행했다.
//   로컬 ImageKit 키가 비어 있어 실데이터를 못 받으므로, UI 레이아웃/상호작용을 실제로
//   관찰하기 위한 최소 데이터 소스만 제공한다.
const http = require('http');
const zlib = require('zlib');

// ── 회색조 PNG 생성(외부 네트워크 의존 없이 썸네일을 실제로 그리기 위함) ──
function grayPng(w, h, level) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, level + ((x + y) % 24) - 12));
      raw[o++] = v;
      raw[o++] = v;
      raw[o++] = v;
    }
  }
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', zlib.deflateSync(raw)));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// ── 가짜 라이브러리 구조 ────────────────────────────────────────
const FOLDERS = [
  '/uploads', '/uploads/2026', '/uploads/2026/03', '/uploads/archive',
  '/mcwjd', '/mcwjd/work', '/mcwjd/village', '/mcwjd/village/signals',
  '/iso', '/iso/model', '/iso/board',
  '/kkumdarak', '/kkumdarak/diary',
  '/ocean',
];
const FILE_NAMES = [
  'yeokryu-still-0412.jpg', 'signal-tower-night.png', 'weaving-loom-detail.jpg',
  'tide-buoy-DT0005.png', 'workshop-hansando-03.jpg', 'field-recording-cover.png',
  'axunsan-miniature.jpg', 'board-layout-v7.png', 'village-map-overlay.jpg',
  'motor-driver-bench.png', 'led-matrix-calib.jpg', 'exhibition-wall-a.png',
];
function filesIn(path) {
  const seed = path.length;
  const count = path === '/' ? 6 : 9;
  const out = [];
  for (let i = 0; i < count; i++) {
    const name = FILE_NAMES[(seed + i) % FILE_NAMES.length];
    const dir = path === '/' ? '/uploads' : path;
    out.push({
      type: 'file',
      fileId: `f_${Buffer.from(dir + '|' + i + '|' + name).toString('hex')}`,
      name: `${i + 1}_${name}`,
      filePath: `${dir}/${i + 1}_${name}`,
      // 실제와 같은 ImageKit 호스트 URL — canTransform/ikUrl 경로를 그대로 태우기 위함.
      // (검증 스크립트가 이 호스트를 가로채 로컬 PNG 바이트로 응답한다.)
      url: `https://ik.imagekit.io/gc3jtyt9o${dir}/${i + 1}_${name}`,
      thumbnail: `https://ik.imagekit.io/gc3jtyt9o${dir}/${i + 1}_${name}`,
      fileType: 'image',
      size: 120000 + ((seed * 7919 + i * 104729) % 3400000),
      width: [1600, 2400, 1200, 2000][i % 4],
      height: [1067, 1600, 1600, 1333][i % 4],
      createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
      mime: 'image/jpeg',
      tags: i % 3 === 0 ? ['archive', '2026'] : null,
    });
  }
  return out;
}
function childFolders(path) {
  const p = path === '/' || !path ? '' : path.replace(/\/$/, '');
  return FOLDERS.filter((f) => {
    const parent = f.slice(0, f.lastIndexOf('/')) || '';
    return parent === p;
  }).map((f) => ({
    type: 'folder',
    folderId: `d_${Buffer.from(f).toString('hex')}`,
    name: f.slice(f.lastIndexOf('/') + 1),
    folderPath: f,
  }));
}

const json = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
  });
  res.end(JSON.stringify(obj));
};

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost:8000');
    if (req.method === 'OPTIONS') return json(res, 204, {});
    const m = u.pathname.match(/^\/thumb\/(\d+)\.png$/);
    if (m) {
      // 비정방(400x240) — 회전 시 가로세로 뒤바뀜을 실측하려면 정방이면 안 된다.
      const png = grayPng(400, 240, [60, 96, 130, 170, 205, 235][Number(m[1]) % 6]);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });
      return res.end(png);
    }
    const p = u.pathname.replace(/^\/api\/imagekit/, '');
    if (p === '/usage') return json(res, 200, { success: true, totalBytes: 1_284_000_000, fileCount: 983 });
    if (p === '/folders') {
      const all = u.searchParams.get('all') === '1';
      const path = u.searchParams.get('path') || '/';
      return json(res, 200, {
        success: true,
        folders: all
          ? FOLDERS.map((f) => ({ type: 'folder', folderId: `d_${f}`, name: f.slice(f.lastIndexOf('/') + 1), folderPath: f }))
          : childFolders(path),
      });
    }
    if (p === '/list') {
      const path = u.searchParams.get('path') || '/';
      const q = u.searchParams.get('searchQuery') || '';
      const skip = Number(u.searchParams.get('skip') || 0);
      const limit = Number(u.searchParams.get('limit') || 40);
      let items = [];
      if (q) {
        const term = (q.match(/%(.*?)%/) || [, ''])[1].toLowerCase();
        const scope = u.searchParams.has('path') ? [path] : FOLDERS;
        scope.forEach((f) => items.push(...filesIn(f)));
        items = items.filter((f) => f.name.toLowerCase().includes(term));
      } else {
        items = [...childFolders(path), ...filesIn(path)];
      }
      return json(res, 200, { success: true, files: items.slice(skip, skip + limit) });
    }
    const fm = p.match(/^\/file\/(.+)$/);
    if (fm && req.method === 'GET') {
      const all = FOLDERS.concat(['/']).flatMap((f) => filesIn(f));
      const file = all.find((f) => f.fileId === fm[1]) || all[0];
      return json(res, 200, { success: true, file });
    }
    if (p === '/purge' && req.method === 'POST') {
      let body='';req.on('data',d=>body+=d);
      return req.on('end',()=>json(res,200,{success:true,message:'stub purge',requestId:'stub-purge-req-1',url:JSON.parse(body||'{}').url}));
    }
    if (p === '/auth') return json(res, 200, { success: true, token: 't', expire: 0, signature: 's', publicKey: 'pk', urlEndpoint: 'https://ik.imagekit.io/gc3jtyt9o' });
    return json(res, 200, { success: true, message: 'stub ok' });
  })
  .listen(8000, () => console.log('stub api on 8000'));
