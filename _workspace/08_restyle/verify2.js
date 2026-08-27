#!/usr/bin/env node
/**
 * verify2.js — iteration 2 blocker 재검증 리그(CDP 직접 구동, 의존성은 ws 하나).
 *
 *   node _workspace/08_restyle/verify2.js
 *
 * ① 모바일 390 넘침: /contact·/about 의 innerWidth vs scrollWidth (+ SOCIAL 블록 크롭)
 * ② 레거시 편집기 도달: 인증을 CDP 로 주입(테스트 계정 없음 — UI 도달만 확인)한 뒤
 *    /legacy/work 진입 → 편집 버튼 DOM 존재 → 레거시 내비 'ART WORK' 클릭 → URL 유지
 * ③ 회귀: 5페이지 + /legacy 콘솔 error/pageerror 수집(필터 없이 원문)
 * 산출: _workspace/08_restyle/shots2/*.png · verify2.json
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, 'shots2');
const PORT = 9345;
const base = process.env.NT_BASE || 'http://localhost:3000';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.handlers.forEach((h) => h(msg));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(fn) {
    this.handlers.push(fn);
  }
}

// exp 가 먼 미래인 서명 없는 JWT — AuthContext 는 exp 만 로컬 판정하므로 UI 상태가 켜진다.
function fakeJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 'verify', exp })}.verify-only`;
}

(async () => {
  const userDir = fs.mkdtempSync('/tmp/ntv2-');
  const chrome = spawn(CHROME, [
    '--headless=new',
    // 헤드리스에서 three.js(레거시 홈 파티클)가 WebGL 컨텍스트를 못 만들면
    // Canvas 가 던진 예외로 React 트리 전체가 언마운트돼 화면이 빈다 → 소프트웨어 GL 강제.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});

  let target = null;
  for (let i = 0; i < 60 && !target; i += 1) {
    await sleep(250);
    try {
      const list = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
      target = list.find((t) => t.type === 'page');
    } catch (e) {
      /* 아직 */
    }
  }
  if (!target) throw new Error('CDP 연결 실패');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((r) => ws.on('open', r));
  const cdp = new Cdp(ws);

  const reqUrl = new Map();
  let bucket = { console: [], pageErrors: [], failedRequests: [] };
  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const { type, args: a } = msg.params;
      if (type === 'error' || type === 'warning' || type === 'assert') {
        bucket.console.push({ type, text: a.map((x) => x.value ?? x.description ?? x.type).join(' ') });
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      bucket.pageErrors.push(d.exception?.description || d.text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      bucket.console.push({ type: 'log.error', text: msg.params.entry.text, url: msg.params.entry.url });
    }
    if (msg.method === 'Network.requestWillBeSent') {
      reqUrl.set(msg.params.requestId, msg.params.request.url);
    }
    if (msg.method === 'Network.loadingFailed') {
      bucket.failedRequests.push({
        type: msg.params.type,
        error: msg.params.errorText,
        url: reqUrl.get(msg.params.requestId) || null,
      });
    }
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');

  const evalJs = async (expression, awaitPromise = false) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const setViewport = (width, height, mobile) =>
    cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
  const go = async (p, wait = 4000) => {
    await cdp.send('Page.navigate', { url: base + p });
    await sleep(wait);
  };
  const shot = async (name, clip) => {
    const s = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(s.data, 'base64'));
    return path.join(OUT, `${name}.png`);
  };

  const report = { base, overflow: {}, legacy: {}, regression: {} };

  // ── ① 390 모바일 넘침 ─────────────────────────────────────────────
  await setViewport(390, 900, true);
  for (const p of ['/contact', '/about']) {
    bucket = { console: [], pageErrors: [], failedRequests: [] };
    await go(p);
    const m = await evalJs(`(() => ({
      innerWidth: innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      headerWidth: (document.querySelector('.nt header')||{getBoundingClientRect:()=>({width:null})}).getBoundingClientRect().width,
      widest: Array.from(document.querySelectorAll('.nt *')).map(e => { const r = e.getBoundingClientRect(); return { right: Math.round(r.right), tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0,40), txt: (e.textContent||'').trim().slice(0,40) }; }).filter(o => o.right > innerWidth + 0.5).slice(0, 6)
    }))()`);
    report.overflow[p] = { ...m, console: bucket.console, pageErrors: bucket.pageErrors };
    // 값 칸(SOCIAL·CONTACT 블록) 크롭 — 이웃 블록·푸터까지
    const box = await evalJs(`(() => {
      const b = document.querySelector('.nt .rgt') || document.querySelector('.nt main');
      if (!b) return null; const r = b.getBoundingClientRect();
      return { x: 0, y: Math.max(0, r.top + scrollY - 20), width: 390, height: Math.min(1400, r.height + 240) };
    })()`);
    await shot(`ovf${p.replace(/\//g, '-')}-390`, box || undefined);
  }

  // ── ② 레거시 편집기 도달 ──────────────────────────────────────────
  await setViewport(1440, 900, false);
  await go('/legacy', 3000);
  await evalJs(
    `(() => { localStorage.setItem('auth_token', ${JSON.stringify(fakeJwt())});
      localStorage.setItem('auth_user', JSON.stringify({ id:'verify', username:'검증', email:'verify@local', role:'admin' }));
      return localStorage.getItem('auth_user'); })()`
  );

  // 로그인 상태의 v5 페이지 — AdminLine 이 페이지별 /legacy/<page> 를 가리키는가
  report.legacy.adminLinks = {};
  for (const p of ['/about', '/work', '/commons', '/cv', '/contact']) {
    await go(p, 5000);
    report.legacy.adminLinks[p] = await evalJs(
      `(() => ({ adminLines: document.querySelectorAll('.adminline').length,
        hrefs: Array.from(document.querySelectorAll('.adminline a')).map(a => a.getAttribute('href')) }))()`
    );
  }

  bucket = { console: [], pageErrors: [], failedRequests: [] };
  await go('/legacy/work', 6000);
  const legacyWork = await evalJs(`(() => {
    const txt = document.body.innerText;
    const btns = Array.from(document.querySelectorAll('button')).map(b => (b.innerText||b.title||'').trim()).filter(Boolean);
    return {
      url: location.pathname,
      hasV5: !!document.querySelector('.nt'),
      hasLegacyApp: !!document.querySelector('.App'),
      heading: (document.querySelector('h1,h2') || {}).innerText || null,
      buttons: btns,
      write: btns.some(t => t.includes('새 글 작성')),
      order: btns.some(t => t.includes('순서 편집')),
      edit: btns.some(t => t.includes('수정')),
      del: btns.some(t => t.includes('삭제')),
      loggedInUi: txt.includes('로그아웃'),
      navLabels: Array.from(document.querySelectorAll('.nav-node .nav-label')).map(e => e.innerText.trim()),
      activeNav: (document.querySelector('.nav-node.active .nav-label') || {}).innerText || null
    };
  })()`);
  report.legacy.work = { ...legacyWork, console: bucket.console, pageErrors: bucket.pageErrors };
  report.legacy.workShot = await shot('legacy-work-desktop');

  // 레거시 내비 'ART WORK' 클릭 → /legacy/work 유지(빠져나가지 않는다)
  await go('/legacy/cv', 4500);
  const beforeClick = await evalJs(`location.pathname`);
  await evalJs(`(() => {
    const n = Array.from(document.querySelectorAll('.nav-node')).find(e => e.innerText.trim() === 'ART WORK');
    if (!n) return 'no-node'; n.click(); return 'clicked';
  })()`);
  await sleep(3500);
  const afterClick = await evalJs(`(() => ({
    url: location.pathname,
    hasV5: !!document.querySelector('.nt'),
    hasLegacyApp: !!document.querySelector('.App'),
    active: (document.querySelector('.nav-node.active .nav-label')||{}).innerText || null,
    write: Array.from(document.querySelectorAll('button')).some(b => (b.innerText||'').includes('새 글 작성'))
  }))()`);
  report.legacy.navClick = { from: beforeClick, ...afterClick };
  report.legacy.navClickShot = await shot('legacy-navclick-desktop');

  // 6경로 전부: /legacy/<page> 가 그 페이지의 레거시 화면으로 들어가는가
  report.legacy.pages = {};
  for (const p of ['', 'about', 'work', 'commons', 'cv', 'contact']) {
    await go(`/legacy${p ? `/${p}` : ''}`, 5000);
    report.legacy.pages[p || '(root)'] = await evalJs(`(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => (b.innerText||b.title||'').trim());
      return {
        url: location.pathname,
        active: (document.querySelector('.nav-node.active .nav-label')||{}).innerText || null,
        h1: (document.querySelector('h1,h2')||{}).innerText || null,
        editAffordance: btns.filter(t => /새 글 작성|순서 편집|편집|수정|저장/.test(t)),
        hasV5: !!document.querySelector('.nt')
      };
    })()`);
  }

  // 글 상세: 수정·삭제 버튼(레거시 CRUD)
  await go('/legacy/work', 6000);
  await evalJs(`(() => { const c = document.querySelector('.post-grid-item'); if (!c) return 'none'; c.click(); return 'clicked'; })()`);
  await sleep(3000);
  report.legacy.detail = await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('.post-actions button, button')).map(b => (b.innerText||'').trim());
    return { url: location.pathname, title: (document.querySelector('.post-title')||{}).innerText || null,
      edit: btns.includes('수정'), del: btns.includes('삭제'), btns: btns.slice(0, 10) };
  })()`);
  report.legacy.detailShot = await shot('legacy-work-detail-desktop');

  // 모바일 레거시(햄버거 존재 확인)
  await setViewport(390, 900, true);
  await go('/legacy/work', 5000);
  report.legacy.mobile = await evalJs(`(() => ({
    url: location.pathname,
    innerWidth, scrollWidth: document.body.scrollWidth,
    write: Array.from(document.querySelectorAll('button')).some(b => (b.innerText||'').includes('새 글 작성'))
  }))()`);
  report.legacy.mobileShot = await shot('legacy-work-mobile');

  // /legacy(접두어 없음) = HOME
  await setViewport(1440, 900, false);
  await go('/legacy', 4500);
  report.legacy.root = await evalJs(
    `(() => ({ url: location.pathname, active: (document.querySelector('.nav-node.active .nav-label')||{}).innerText || null, hasCanvas: !!document.querySelector('canvas') }))()`
  );

  // 비로그인: AdminLine 미표시
  await evalJs(`(() => { localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user'); return 1; })()`);
  await go('/work', 5000);
  report.legacy.anonAdminLine = await evalJs(
    `(() => ({ adminLines: document.querySelectorAll('.adminline').length, legacyLinks: Array.from(document.querySelectorAll('a[href^="/legacy"]')).map(a=>a.getAttribute('href')) }))()`
  );

  // ── ③ 회귀: 5페이지 + /legacy 콘솔 ────────────────────────────────
  for (const p of ['/', '/about', '/work', '/commons', '/cv', '/contact', '/legacy']) {
    bucket = { console: [], pageErrors: [], failedRequests: [] };
    await go(p, 5000);
    const errs = bucket.console.filter((c) => c.type === 'error' || c.type === 'log.error');
    report.regression[p] = {
      errors: errs,
      errorCount: errs.length,
      warnings: bucket.console.filter((c) => c.type === 'warning').map((c) => c.text.slice(0, 120)),
      pageErrors: bucket.pageErrors,
      failedRequests: bucket.failedRequests,
    };
  }

  fs.writeFileSync(path.join(OUT, '..', 'verify2.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  ws.close();
  chrome.kill();
  await sleep(300);
  fs.rmSync(userDir, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
