// 검증 하네스 공용 유틸 — playwright 해석, 더미 세션, 이미지 치수 파서, multipart 파서.
const fs = require('fs');
const path = require('path');

// ── playwright 해석 ────────────────────────────────────────────
//   저장소에는 playwright 가 설치돼 있지 않다. 아래 순서로 찾는다.
//   1) 프로젝트 node_modules  2) npx 캐시(~/.npm/_npx/*)에서 "설치된 chromium 리비전과
//      맞는" 버전. 버전이 어긋나면 "Executable doesn't exist" 로 실패하므로 반드시 맞춘다.
function resolvePlaywright() {
  try {
    return require('playwright');
  } catch {
    /* 계속 */
  }
  const npxRoot = path.join(process.env.HOME, '.npm/_npx');
  const cacheRoot = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  let installed = [];
  try {
    installed = fs
      .readdirSync(cacheRoot)
      .filter((d) => /^chromium-\d+$/.test(d))
      .map((d) => d.split('-')[1]);
  } catch {
    /* 캐시 없음 */
  }
  let dirs = [];
  try {
    dirs = fs.readdirSync(npxRoot);
  } catch {
    throw new Error('playwright 를 찾을 수 없습니다. `npx playwright install chromium` 후 재시도하세요.');
  }
  const candidates = [];
  for (const d of dirs) {
    const pw = path.join(npxRoot, d, 'node_modules/playwright');
    const core = path.join(npxRoot, d, 'node_modules/playwright-core/browsers.json');
    if (!fs.existsSync(pw)) continue;
    let rev = null;
    try {
      const b = JSON.parse(fs.readFileSync(core, 'utf8'));
      rev = (b.browsers.find((x) => x.name === 'chromium') || {}).revision;
    } catch {
      /* 무시 */
    }
    candidates.push({ pw, rev });
  }
  const match = candidates.find((c) => c.rev && installed.includes(String(c.rev)));
  const pick = match || candidates[0];
  if (!pick) throw new Error('playwright 설치본을 찾지 못했습니다.');
  if (!match) {
    console.warn('⚠️ 설치된 chromium 리비전과 맞는 playwright 를 못 찾았습니다. 실행이 실패할 수 있습니다.');
  }
  return require(pick.pw);
}

// ── 로그인 우회 ────────────────────────────────────────────────
//   AuthContext 는 서버 검증 없이 localStorage 의 auth_token/auth_user 만 읽고
//   토큰의 exp 만 확인한다(isJwtExpired). 따라서 서명 없는 더미 JWT 로 admin 세션을
//   흉내낼 수 있다. 백엔드 호출은 스텁 API 가 받으므로 서명 검증이 일어나지 않는다.
//   ⚠️ 로컬 검증 전용. 운영 백엔드에는 통하지 않는다(JWT_SECRET 검증).
function dummyAdminJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 'local', role: 'admin', exp })}.localverify`;
}

async function installAdminSession(ctx) {
  await ctx.addInitScript(
    ([token]) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem(
        'auth_user',
        JSON.stringify({ id: 'local', username: 'local-admin', role: 'admin' })
      );
    },
    [dummyAdminJwt()]
  );
}

// ── 이미지 치수 파서(외부 의존 없이 헤더만 읽는다) ──────────────
function pngSize(b) {
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
function imgSize(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0xff && b[1] === 0xd8) return jpegSize(b);
  if (b.slice(1, 4).toString() === 'PNG') return pngSize(b);
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
    const fmt = b.slice(12, 16).toString();
    if (fmt === 'VP8X') return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (fmt === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

// ── multipart/form-data 파서(검증용 최소 구현) ─────────────────
function parseMultipart(buf, boundary) {
  const out = { fields: {}, file: null, fileName: null };
  const sep = Buffer.from(`--${boundary}`);
  let idx = 0;
  const parts = [];
  for (;;) {
    const s = buf.indexOf(sep, idx);
    if (s < 0) break;
    const e = buf.indexOf(sep, s + sep.length);
    if (e < 0) break;
    parts.push(buf.slice(s + sep.length, e));
    idx = e;
  }
  for (const part of parts) {
    const he = part.indexOf('\r\n\r\n');
    if (he < 0) continue;
    const head = part.slice(0, he).toString();
    const body = part.slice(he + 4, part.length - 2);
    const nm = head.match(/name="([^"]+)"/);
    if (!nm) continue;
    const fn = head.match(/filename="([^"]*)"/);
    if (fn) {
      out.file = body;
      out.fileName = fn[1];
    } else {
      out.fields[nm[1]] = body.toString();
    }
  }
  return out;
}

const PATHS = {
  root: path.resolve(__dirname, '../../../..'),
  fixtures: path.resolve(__dirname, '../fixtures'),
  shots: path.resolve(__dirname, '../../shots'),
};

const APP = 'http://localhost:3000/admin/media';

module.exports = {
  resolvePlaywright,
  dummyAdminJwt,
  installAdminSession,
  pngSize,
  jpegSize,
  imgSize,
  parseMultipart,
  PATHS,
  APP,
};
