#!/usr/bin/env node
/**
 * shoot.js — v5 재조판 검증 리그(CDP 직접 구동, 의존성은 저장소의 ws 하나뿐).
 *
 *   node _workspace/08_restyle/shoot.js <path> <slug> [--wait=ms]
 *
 * 하는 일
 *   ① 데스크톱 1920 · 모바일 390 두 벌 풀페이지 스크린샷
 *   ② console error/warning · pageerror · 실패한 네트워크 요청 수집(필터 없이 원문 저장)
 *   ③ 본문 텍스트 추출(.txt) — /legacy 렌더와 낱말 단위 diff 용
 *   ④ 고정 헤더(z-index 50) 가림 hit-test: 헤더 아래 첫 콘텐츠가 헤더에 먹히는지
 * 산출: _workspace/08_restyle/shots/<slug>-{desktop,mobile}.png · <slug>.json · <slug>-{d,m}.txt
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, 'shots');
const PORT = 9333;

const args = process.argv.slice(2);
const urlPath = args[0] || '/';
const slug = args[1] || 'page';
const waitMs = Number((args.find((a) => a.startsWith('--wait=')) || '--wait=3500').split('=')[1]);
const base = process.env.NT_BASE || 'http://localhost:3000';

fs.mkdirSync(OUT, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
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
}

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
  on(fn) {
    this.handlers.push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

(async () => {
  const userDir = fs.mkdtempSync('/tmp/ntshoot-');
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});

  let target = null;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(250);
    try {
      const list = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
      target = list.find((t) => t.type === 'page');
    } catch (e) {
      /* 아직 안 떴다 */
    }
  }
  if (!target) throw new Error('Chrome CDP 연결 실패');

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((r) => ws.on('open', r));
  const cdp = new Cdp(ws);

  const log = { url: base + urlPath, console: [], pageErrors: [], failedRequests: [] };
  cdp.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const { type, args: a } = msg.params;
      if (type === 'error' || type === 'warning' || type === 'assert') {
        log.console.push({ type, text: a.map((x) => x.value ?? x.description ?? x.type).join(' ') });
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      log.pageErrors.push(d.exception?.description || d.text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      log.console.push({ type: 'log.error', text: msg.params.entry.text, url: msg.params.entry.url });
    }
    if (msg.method === 'Network.loadingFailed') {
      log.failedRequests.push({ type: msg.params.type, error: msg.params.errorText });
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');

  async function shoot(name, width, height, mobile) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
    await cdp.send('Page.navigate', { url: base + urlPath });
    await sleep(waitMs);
    // lazy 이미지(loading="lazy")는 뷰포트에 들어와야 로드된다 — 한 번 훑고 위로 돌아온다.
    await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const step = innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
        return imgs.filter(i => !i.complete || i.naturalWidth === 0).length;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    await sleep(1200);
    const metrics = await cdp.send('Page.getLayoutMetrics');
    const full = Math.min(Math.ceil(metrics.cssContentSize.height), 30000);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: full, scale: 1 },
    });
    fs.writeFileSync(path.join(OUT, `${slug}-${name}.png`), Buffer.from(shot.data, 'base64'));

    const text = await cdp.send('Runtime.evaluate', {
      expression: `(() => document.body.innerText)()`,
      returnByValue: true,
    });
    fs.writeFileSync(path.join(OUT, `${slug}-${name}.txt`), text.result.value || '');

    // 고정 헤더 가림 hit-test — 헤더 높이 바로 아래 지점의 최상위 요소가 header 면 가려진 것.
    const hit = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const h = document.querySelector('.nt header');
        if (!h) return { header: false };
        const hb = h.getBoundingClientRect();
        const probes = [];
        for (const x of [0.15, 0.5, 0.85]) {
          const el = document.elementFromPoint(Math.round(innerWidth * x), Math.round(hb.bottom + 4));
          probes.push({ x, tag: el ? el.tagName.toLowerCase() : null, cls: el ? el.className.toString().slice(0, 60) : null, inHeader: el ? !!el.closest('header') : false });
        }
        // 본문 첫 요소가 헤더 아래에서 시작하는지
        const main = document.querySelector('.nt main');
        const mt = main ? main.getBoundingClientRect().top : null;
        return { header: true, headerHeight: hb.height, headerZ: getComputedStyle(h).zIndex, mainTop: mt, probes, covered: probes.some(p => p.inHeader) };
      })()`,
      returnByValue: true,
    });
    log[`hitTest_${name}`] = hit.result.value;
    log[`height_${name}`] = full;
  }

  await shoot('desktop', 1920, 1080, false);
  await shoot('mobile', 390, 844, true);

  fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ slug, url: log.url, console: log.console, pageErrors: log.pageErrors, failedRequests: log.failedRequests, hitDesktop: log.hitTest_desktop, hitMobile: log.hitTest_mobile, heights: [log.height_desktop, log.height_mobile] }, null, 2));

  ws.close();
  chrome.kill();
  await sleep(300);
  fs.rmSync(userDir, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
