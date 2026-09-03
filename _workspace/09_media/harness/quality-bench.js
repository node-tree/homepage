// JPEG_QUALITY 결정 근거 실측
//   원본 교체 편집은 캔버스로 재인코딩한다. 품질값에 따라 결과 용량이 얼마나 달라지는지
//   "같은 입력 · 같은 파이프라인(회전 90°)" 으로 브라우저에서 직접 측정한다.
//   → 0.9 는 원본 대비 폭증(무료 3GB 한도 잠식)해서 채택하지 않았다는 근거를 남긴다.
//
//   실행: node _workspace/09_media/harness/quality-bench.js
//   (dev 서버·스텁 API 불필요 — about:blank 에서 캔버스만 사용)
const fs = require('fs');
const path = require('path');
const { resolvePlaywright, imgSize } = require('./lib/common');

const FIXTURE = path.join(__dirname, 'fixtures/exif6.jpg');
const OUT = path.join(__dirname, 'quality-bench.log');

(async () => {
  const { chromium } = resolvePlaywright();
  const bytes = fs.readFileSync(FIXTURE);
  const src = imgSize(bytes);
  const b64 = bytes.toString('base64');

  const br = await chromium.launch();
  const page = await (await br.newContext()).newPage();
  await page.goto('about:blank');

  const rows = await page.evaluate(
    async ({ b64, qualities }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/jpeg' });
      // 앱과 동일하게 EXIF 반영 디코딩
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });

      const out = [];
      for (const q of qualities) {
        // 앱의 applyEdits 와 동일한 변환: 90° 회전
        const canvas = document.createElement('canvas');
        canvas.width = bmp.height;
        canvas.height = bmp.width;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, -bmp.width / 2, -bmp.height / 2, bmp.width, bmp.height);
        const b = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
        out.push({ q, size: b.size, type: b.type, w: canvas.width, h: canvas.height });
      }
      return { decoded: { w: bmp.width, h: bmp.height }, out };
    },
    { b64, qualities: [1.0, 0.95, 0.9, 0.85, 0.82, 0.8, 0.7] }
  );
  await br.close();

  const lines = [];
  const log = (s) => {
    lines.push(s);
    console.log(s);
  };
  log(`입력 파일        : ${path.relative(process.cwd(), FIXTURE)}`);
  log(`저장 픽셀(SOF)   : ${src.w}x${src.h}  (원본 ${bytes.length}B)`);
  log(`EXIF 반영 디코딩 : ${rows.decoded.w}x${rows.decoded.h}`);
  log(`변환             : 90° 회전 → 출력 ${rows.out[0].w}x${rows.out[0].h}`);
  log('');
  log('quality   출력 바이트    원본 대비');
  log('----------------------------------------');
  for (const r of rows.out) {
    const ratio = (r.size / bytes.length).toFixed(2);
    const mark = r.q === 0.82 ? '   ← 채택(업로드 정책과 동일)' : '';
    log(`${String(r.q).padEnd(9)} ${String(r.size).padStart(9)}B   ${String(ratio).padStart(5)}x${mark}`);
  }
  log('');
  const q9 = rows.out.find((r) => r.q === 0.9);
  const q82 = rows.out.find((r) => r.q === 0.82);
  log(`결론: 0.9 → ${q9.size}B, 0.82 → ${q82.size}B (${(q9.size / q82.size).toFixed(2)}배 차이).`);
  log('      원본을 "교체"하는 동작이라 용량 증가가 무료 3GB 한도를 직접 갉아먹는다.');
  log('      업로드 파이프라인(utils/imageResize.ts)과 같은 0.82 로 통일했다.');
  log(`측정 시각: ${new Date().toISOString()}`);
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`\n로그 저장: ${OUT}`);
})().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
