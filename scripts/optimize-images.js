#!/usr/bin/env node
/**
 * optimize-images.js — non-destructive WebP conversion for public/ raster images.
 *
 * WHY: The site's <img> tags now carry width/height + loading="lazy" +
 * decoding="async" (CLS-safe, lazy). The remaining image win is serving WebP
 * instead of large PNG/JPG. This script generates a `.webp` sibling next to each
 * raster source WITHOUT touching the original, so you can wire up <picture>/srcset.
 *
 * IMPORTANT (state as of this perf pass): the files under public/images and
 * public/kkumdarak are placeholder stubs (a few bytes of ASCII text), NOT real
 * images. This script will SKIP non-image files and report them, so it is safe
 * to run now and will "just work" once real assets are dropped in.
 *
 * USAGE:
 *   node scripts/optimize-images.js              # convert all under public/
 *   node scripts/optimize-images.js public/images/works
 *   node scripts/optimize-images.js --quality 78
 *
 * BACKEND: prefers `sharp` (npm i -D sharp). Falls back to the `cwebp` CLI
 * (brew install webp). If neither is present it prints install instructions.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
let quality = 80;
const qi = args.indexOf('--quality');
if (qi !== -1) { quality = parseInt(args[qi + 1], 10) || 80; args.splice(qi, 2); }
const roots = args.length ? args : ['public'];

const RASTER = /\.(png|jpe?g)$/i;
const MAGIC = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  jpg: Buffer.from([0xff, 0xd8, 0xff]),
};

function isRealImage(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    return buf.slice(0, 4).equals(MAGIC.png) || buf.slice(0, 3).equals(MAGIC.jpg);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (RASTER.test(name)) out.push(full);
  }
  return out;
}

let backend = null;
try { require.resolve('sharp'); backend = 'sharp'; } catch { /* try cli */ }
if (!backend) {
  try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); backend = 'cwebp'; } catch { /* none */ }
}
if (!backend) {
  console.error('No WebP backend found.\n  Install ONE of:\n    npm i -D sharp        (recommended)\n    brew install webp     (provides the cwebp CLI)');
  process.exit(1);
}

const sharp = backend === 'sharp' ? require('sharp') : null;
let converted = 0, skippedStub = 0, savedBytes = 0;

async function convert(file) {
  const out = file.replace(RASTER, '.webp');
  if (!isRealImage(file)) {
    skippedStub++;
    console.log(`SKIP (not a real image / placeholder): ${file}`);
    return;
  }
  const before = fs.statSync(file).size;
  if (backend === 'sharp') {
    await sharp(file).webp({ quality }).toFile(out);
  } else {
    execFileSync('cwebp', ['-q', String(quality), file, '-o', out], { stdio: 'ignore' });
  }
  const after = fs.statSync(out).size;
  savedBytes += before - after;
  converted++;
  console.log(`OK  ${path.relative('.', file)} -> ${path.relative('.', out)}  ${before} -> ${after} bytes`);
}

(async () => {
  const files = roots.flatMap((r) => (fs.existsSync(r) ? walk(r) : []));
  console.log(`Backend: ${backend} | quality: ${quality} | candidates: ${files.length}\n`);
  for (const f of files) {
    try { await convert(f); } catch (e) { console.error(`FAIL ${f}: ${e.message}`); }
  }
  console.log(`\nDone. converted=${converted} skipped(stub)=${skippedStub} saved=${(savedBytes / 1024).toFixed(1)} kB`);
  if (skippedStub > 0) {
    console.log('Some files were placeholders — drop real images in and re-run.');
  }
})();
