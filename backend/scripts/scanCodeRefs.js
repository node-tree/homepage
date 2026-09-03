// 소스코드에 하드코딩된 ImageKit URL 스캔 → backend/data/ikCodeRefs.json
//
//   왜 필요한가: DB 참조는 이동 시 자동 치환하지만, 소스에 박힌 URL 은 자동으로 못 고친다
//   (배포가 필요하고, 리뷰 없이 코드를 건드리면 안 된다).
//   → 이동 전에 "코드에도 N곳 있으니 수동으로 고쳐야 한다"고 관리자에게 알리기 위한 목록.
//
//   실행: node backend/scripts/scanCodeRefs.js
//   (소스가 바뀌면 다시 돌려 JSON 을 갱신한다)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, '../data/ikCodeRefs.json');
const SCAN_DIRS = ['src', 'public', 'api'];
const SKIP_DIRS = new Set(['node_modules', 'build', 'dist', '.git', '_workspace']);
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html', '.json', '.md']);

const HOST_RE = /https?:\/\/ik\.imagekit\.io\/([A-Za-z0-9_-]+)(\/[^\s"'`<>)\\]*)/g;

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (EXT.has(path.extname(e.name))) {
      // 테스트 픽스처의 URL 은 "수동으로 고쳐야 할 코드 참조"가 아니다 — 제외.
      if (/\.(test|spec)\.[jt]sx?$/.test(e.name)) continue;
      out.push(full);
    }
  }
}

function canon(p) {
  let s = p.split('#')[0].split('?')[0];
  try {
    s = decodeURIComponent(s);
  } catch {
    /* 원문 유지 */
  }
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/+/g, '/').replace(/(.)\/+$/, '$1');
}

function main() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);

  const refs = [];
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    if (text.indexOf('ik.imagekit.io') === -1) continue;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      HOST_RE.lastIndex = 0;
      let m;
      while ((m = HOST_RE.exec(line))) {
        refs.push({
          file: path.relative(ROOT, f),
          line: i + 1,
          account: m[1],
          path: canon(m[2]),
          url: m[0],
        });
      }
    });
  }

  const byFile = {};
  const byPath = {};
  for (const r of refs) {
    byFile[r.file] = (byFile[r.file] || 0) + 1;
    (byPath[r.path] = byPath[r.path] || []).push({ file: r.file, line: r.line });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    note: '소스 하드코딩 ImageKit URL. 이동/이름변경 시 자동 치환되지 않으므로 수동 수정이 필요하다.',
    total: refs.length,
    byFile,
    byPath,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

  console.log(`스캔 파일 ${files.length}개 → ImageKit URL ${refs.length}건`);
  Object.entries(byFile)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f}`));
  console.log(`고유 경로 ${Object.keys(byPath).length}개`);
  console.log(`저장: ${path.relative(ROOT, OUT)}`);
}

main();
