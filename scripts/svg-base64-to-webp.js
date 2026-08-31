/**
 * base64-PNG 를 품은 <svg> 래퍼 → 무손실 WebP 변환기 (/iso 히어로 에셋 최적화)
 *
 * 배경(실측):
 *   public/kkumdarak 아래 .svg 244개 중 138개는 벡터가 아니라
 *   `<svg><image href="data:image/png;base64,…"/></svg>` 래퍼다.
 *   base64 는 원본 PNG 대비 +33% 이고, SVG 로 감싸면 브라우저·CDN 의
 *   이미지 최적화(WebP/AVIF 협상·리사이즈)가 전부 무력화된다.
 *
 * 하는 일:
 *   1. 래퍼에서 PNG 바이트를 그대로 뽑는다.
 *   2. cwebp -lossless 로 인코딩 → 같은 경로에 .webp 로 저장.
 *   3. 디코드 후 원본 PNG 와 RGBA 픽셀 동일성을 검증한다(무손실이므로 반드시 일치).
 *   원본 .svg 는 지우지 않는다(롤백·타 참조 안전).
 *
 * 사용: node scripts/svg-base64-to-webp.js [--check]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '../public/kkumdarak');
const CHECK_ONLY = process.argv.includes('--check');

/** `<svg>` 가 단일 `<image data:image/png;base64,…>` 래퍼일 때만 PNG 버퍼를 돌려준다. */
function extractWrappedPng(svg) {
  const m = svg.match(
    /^\s*<svg[^>]*>\s*<image\s+width="(\d+)"\s+height="(\d+)"\s+href="data:image\/png;base64,([A-Za-z0-9+/=]+)"\s*\/?>\s*(<\/image>)?\s*<\/svg>\s*$/
  );
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]), png: Buffer.from(m[3], 'base64') };
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.toLowerCase().endsWith('.svg')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
let converted = 0, skipped = 0, svgBytes = 0, webpBytes = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-webp-'));

for (const f of files) {
  const svg = fs.readFileSync(f, 'utf8');
  const ex = extractWrappedPng(svg);
  if (!ex) { skipped++; continue; }

  const outWebp = f.replace(/\.svg$/i, '.webp');
  const pngPath = path.join(tmp, 'in.png');
  fs.writeFileSync(pngPath, ex.png);

  if (!CHECK_ONLY) {
    execFileSync('cwebp', ['-quiet', '-lossless', '-exact', pngPath, '-o', outWebp]);
  }
  if (!fs.existsSync(outWebp)) { console.error('생성 실패:', outWebp); process.exitCode = 1; continue; }

  // 픽셀 동일성 검증 — WebP 를 다시 PNG 로 풀어 원본과 RGBA 비교.
  const backPath = path.join(tmp, 'back.png');
  execFileSync('dwebp', ['-quiet', outWebp, '-o', backPath]);
  const a = execFileSync('python3', ['-c', `
import sys
from PIL import Image
x=Image.open(sys.argv[1]).convert('RGBA'); y=Image.open(sys.argv[2]).convert('RGBA')
print('SAME' if (x.size==y.size and x.tobytes()==y.tobytes()) else 'DIFF')
`, pngPath, backPath]).toString().trim();
  if (a !== 'SAME') { console.error('픽셀 불일치:', f); process.exitCode = 1; continue; }

  svgBytes += Buffer.byteLength(svg);
  webpBytes += fs.statSync(outWebp).size;
  converted++;
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`변환 ${converted}개 · 건너뜀(진짜 벡터) ${skipped}개`);
console.log(`.svg 합계 ${(svgBytes / 1048576).toFixed(2)} MB → .webp 합계 ${(webpBytes / 1048576).toFixed(2)} MB ` +
  `(${(100 - (webpBytes / svgBytes) * 100).toFixed(1)}% 감소, 픽셀 동일 검증 통과)`);
