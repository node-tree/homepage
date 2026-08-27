#!/usr/bin/env node
/**
 * routes.js — 기존 발행 URL 회귀 점검.
 *   각 경로를 실제로 열어 ① 최종 URL(리다이렉트 결과) ② <title> ③ 첫 표제 ④ 콘솔 error 를 본다.
 *   node _workspace/08_restyle/routes.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const BASE = process.env.NT_BASE || 'http://localhost:3000';

const PATHS = [
  '/',
  '/about',
  '/work',
  '/work?post=6969e0c950e7b0f6a31e83fa',
  '/work/6969e0c950e7b0f6a31e83fa',
  '/work/research/6969e0c950e7b0f6a31e83fa',
  '/commons',
  '/commons?post=6858a45ca793089c746ee8cb',
  '/commons/6858a45ca793089c746ee8cb',
  '/cv',
  '/contact',
  '/index',
  '/works-v5',
  '/about-v5',
  '/legacy',
  '/ocean',
  '/iso',
  '/guestbook',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (url) =>
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
      const m = JSON.parse(raw.toString());
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      } else if (m.method) this.handlers.forEach((h) => h(m));
    });
  }
  on(fn) {
    this.handlers.push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
}

(async () => {
  const dir = fs.mkdtempSync('/tmp/ntroutes-');
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${dir}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});

  let target = null;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(250);
    try {
      target = (await getJson(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page');
    } catch (e) {
      /* wait */
    }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on('open', r));
  const cdp = new Cdp(ws);
  let errs = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      const t = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (!/Future Flag/.test(t)) errs.push(t.slice(0, 120));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 120));
    }
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const rows = [];
  for (const p of PATHS) {
    errs = [];
    await cdp.send('Page.navigate', { url: BASE + p });
    await sleep(4200);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(() => ({
        url: location.pathname + location.search + location.hash,
        title: document.title,
        head: (document.querySelector('.nt .pagehead h1, .nt .detail .title, h1, .page-title') || {}).innerText || '',
        nt: !!document.querySelector('.nt'),
        len: document.body.innerText.length
      }))()`,
      returnByValue: true,
    });
    rows.push({ req: p, ...r.result.value, errors: errs.slice(0, 3) });
    console.log(
      `${p}  →  ${r.result.value.url}  | v5:${r.result.value.nt ? 'Y' : 'n'} | ${JSON.stringify(
        (r.result.value.head || '').slice(0, 30),
      )} | text ${r.result.value.len} | err ${errs.length ? JSON.stringify(errs) : 0}`,
    );
  }
  fs.writeFileSync(`${__dirname}/routes.json`, JSON.stringify(rows, null, 2));
  ws.close();
  chrome.kill();
  await sleep(300);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
