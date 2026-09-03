// 합성 픽스처 생성
//   fixtures/exif6.jpg  — 저장 픽셀 400x240 + EXIF Orientation=6.
//                         "올바로 표시하면 240x400" 이어야 하므로 EXIF 반영 여부의 리트머스.
//   외부 의존을 줄이려고 베이스 JPEG 는 ImageKit 공개 데모에서 받는다(네트워크 필요).
//   네트워크가 없으면 기존 fixtures/exif6.jpg 를 그대로 쓰면 된다(저장소에 커밋되어 있음).
const https = require('https');
const fs = require('fs');
const path = require('path');
const { jpegSize } = require('./lib/common');

const SRC = 'https://ik.imagekit.io/demo/img/default-image.jpg?tr=w-400,h-240,c-force';
const OUT = path.join(__dirname, 'fixtures/exif6.jpg');

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, (r) => {
        const c = [];
        r.on('data', (d) => c.push(d));
        r.on('end', () => res(Buffer.concat(c)));
      })
      .on('error', rej);
  });
}

/** APP1(Exif) 세그먼트 — IFD0 에 Orientation(0x0112) 하나만 담는다. */
function exifApp1(orientation) {
  const tiff = Buffer.concat([
    Buffer.from('4D4D002A00000008', 'hex'), // 'MM'(big endian), 42, IFD0 offset=8
    Buffer.from('0001', 'hex'), // 엔트리 1개
    Buffer.from('0112', 'hex'), // tag: Orientation
    Buffer.from('0003', 'hex'), // type: SHORT
    Buffer.from('00000001', 'hex'), // count: 1
    Buffer.from([0x00, orientation, 0x00, 0x00]), // value(4바이트 좌측정렬)
    Buffer.from('00000000', 'hex'), // next IFD 없음
  ]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xe1]), len, payload]);
}

/** 기존 APP1(Exif) 를 제거하고 새 APP1 을 SOI 직후에 넣는다. */
function injectExif(jpeg, orientation) {
  if (!(jpeg[0] === 0xff && jpeg[1] === 0xd8)) throw new Error('JPEG 가 아닙니다.');
  let i = 2;
  const keep = [];
  while (i < jpeg.length) {
    if (jpeg[i] !== 0xff) break;
    const marker = jpeg[i + 1];
    if (marker === 0xda) break; // SOS 이후는 압축 스트림
    const segLen = jpeg.readUInt16BE(i + 2);
    if (marker !== 0xe1) keep.push(jpeg.slice(i, i + 2 + segLen));
    i += 2 + segLen;
  }
  return Buffer.concat([Buffer.from([0xff, 0xd8]), exifApp1(orientation), ...keep, jpeg.slice(i)]);
}

function readOrientation(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) break;
    const m = b[i + 1];
    if (m === 0xda) break;
    const len = b.readUInt16BE(i + 2);
    if (m === 0xe1 && b.slice(i + 4, i + 10).toString('binary') === 'Exif\0\0') {
      const t = i + 10;
      const count = b.readUInt16BE(t + 8);
      for (let e = 0; e < count; e++) {
        const off = t + 10 + e * 12;
        if (b.readUInt16BE(off) === 0x0112) return b.readUInt16BE(off + 8);
      }
    }
    i += 2 + len;
  }
  return null;
}

(async () => {
  const base = await get(SRC);
  const out = injectExif(base, 6);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('베이스 JPEG 치수      :', JSON.stringify(jpegSize(base)));
  console.log('생성                  :', OUT, `(${out.length}B)`);
  console.log('저장 픽셀 치수(SOF)   :', JSON.stringify(jpegSize(out)));
  console.log('EXIF Orientation 되읽기:', readOrientation(out));
  console.log('기대                  : EXIF 반영 시 240x400 으로 디코딩');
})().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});

module.exports = { injectExif, readOrientation };
