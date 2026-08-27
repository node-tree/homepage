// 검수: /clock 데스크톱·모바일 스크린샷 + 콘솔 로그 원문 + rAF fps + reduced-motion
const { chromium } = require('/Users/kanghyunjung/.nvm/versions/node/v18.17.0/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname;

async function shoot(browser, { name, width, height, dpr, reduced, url }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[requestfailed] ${r.url()} ${r.failure() && r.failure().errorText}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.dclock[data-mode="webgl2"], .dclock[data-mode="raster"], .dclock--error', { timeout: 30000 });
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const el = document.querySelector('.dclock');
    const disc = document.querySelector('.dclock__disc');
    const cv = document.querySelector('.dclock__gl');
    const r = disc.getBoundingClientRect();
    return {
      mode: el.getAttribute('data-mode'),
      beat: el.getAttribute('data-beat'),
      disc: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      canvas: [cv.width, cv.height],
      ocrBoxes: document.querySelectorAll('.dclock .ocr .ocr-g').length,
      nowBoxes: document.querySelectorAll('.dclock .ocr .now').length,
      redacted: document.querySelectorAll('.dclock .redacted rect').length,
      ticks: document.querySelectorAll('.dclock .ticks line').length,
      readbox: document.querySelector('.dclock__readbox').innerText.replace(/\n/g, ' | '),
      // 겹침 검사: 판독 블록 · 라벨 · 캡션이 원반 사각과 겹치는가
      overlap: (() => {
        const d = document.querySelector('.dclock__disc').getBoundingClientRect();
        const hit = (sel) => {
          const b = document.querySelector(sel).getBoundingClientRect();
          const ox = Math.max(0, Math.min(d.right, b.right) - Math.max(d.left, b.left));
          const oy = Math.max(0, Math.min(d.bottom, b.bottom) - Math.max(d.top, b.top));
          return Math.round(ox * oy);
        };
        return { readbox: hit('.dclock__readbox'), lab: hit('.dclock__lab'), cap: hit('.dclock__cap') };
      })(),
      webgl2: (() => { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); })(),
      handRead: document.querySelector('.dclock__svg--over g:nth-of-type(3)') && document.querySelectorAll('.dclock__svg--over > g')[2].getAttribute('transform'),
      lab: document.querySelector('.dclock__lab').innerText.replace(/\n/g, ' | '),
    };
  });
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(+(n * 1000 / (performance.now() - t0)).toFixed(1)); };
    requestAnimationFrame(f);
  }));
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  // 원반만 크롭
  const disc = await page.$('.dclock__disc');
  await disc.screenshot({ path: `${OUT}/${name}_disc.png` });
  await ctx.close();
  return { name, ...info, fps, logs, file };
}

(async () => {
  const browser = await chromium.launch({
    // headless chromium 은 기본적으로 GPU 가 없다 — SwiftShader 로 **WebGL2 경로 자체**를 검증한다
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const base = 'http://localhost:3000/clock';
  const B = process.env.BEAT ? '&beat=' + process.env.BEAT : '';
  const jobs = [
    { name: 'clock_tablet_dark', width: 1024, height: 900, dpr: 2, url: base + '?theme=dark' + (process.env.BEAT ? '&beat=' + process.env.BEAT : '') },
    { name: 'clock_desktop_dark', width: 1920, height: 1080, dpr: 2, url: base + '?theme=dark' + B },
    { name: 'clock_desktop_light', width: 1920, height: 1080, dpr: 2, url: base + '?theme=light' + B },
    { name: 'clock_mobile_dark', width: 390, height: 844, dpr: 2, url: base + '?theme=dark' + B },
    { name: 'clock_mobile_light', width: 390, height: 844, dpr: 2, url: base + '?theme=light' + B },
    { name: 'clock_reduced_dark', width: 1920, height: 1080, dpr: 2, reduced: true, url: base + '?theme=dark' + B },
  ];
  // beat.ts 왕복 검산 — ?beat=N 을 넣으면 컴포넌트가 같은 N 을 표시해야 한다
  const rt = [];
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    for (const n of [0, 1, 19, 842, 1514, 3028]) {
      await page.goto(base + '?theme=dark&beat=' + n, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForSelector('.dclock[data-mode]', { timeout: 30000 });
      const got = await page.getAttribute('.dclock', 'data-beat');
      rt.push({ want: n, got: Number(got), pass: Number(got) === n });
    }
    await ctx.close();
  }
  console.log('── beat.ts 왕복 검산 ──');
  rt.forEach(r => console.log('  beat=%d -> data-beat=%d  %s', r.want, r.got, r.pass ? 'PASS' : 'FAIL'));
  console.log('  %d/%d PASS', rt.filter(r => r.pass).length, rt.length);

  // 탭 비활성 → rAF 중단 · reduced-motion → 정지 프레임
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(base + '?theme=dark', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('.dclock[data-mode]', { timeout: 30000 });
    await page.waitForTimeout(400);
    const before = await page.getAttribute('.dclock', 'data-raf');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    const hidden = await page.getAttribute('.dclock', 'data-raf');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    const back = await page.getAttribute('.dclock', 'data-raf');
    console.log('── 탭 가시성 ── data-raf: 보임 %s → 숨김 %s → 복귀 %s  %s',
      before, hidden, back, (before === 'on' && hidden === 'off' && back === 'on') ? 'PASS' : 'FAIL');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + '?theme=dark', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('.dclock[data-mode]', { timeout: 30000 });
    await page.waitForTimeout(600);
    const el = await page.$('.dclock__disc');
    const a = await el.screenshot();
    await page.waitForTimeout(900);
    const b = await el.screenshot();
    const same = Buffer.compare(a, b) === 0;
    const raf = await page.getAttribute('.dclock', 'data-raf');
    console.log('── reduced-motion ── data-raf=%s · 0.9초 간격 두 프레임 동일=%s (%d B) %s',
      raf, same, a.length, (raf === 'reduced' && same) ? 'PASS' : 'FAIL');
    fs.writeFileSync(OUT + '/clock_reducedmotion_still.png', a);
    await ctx.close();
  }

  const out = [];
  for (const j of jobs) out.push(await shoot(browser, j));
  await browser.close();
  fs.writeFileSync(`${OUT}/verify-clock.json`, JSON.stringify(out, null, 2));
  for (const r of out) {
    console.log('════', r.name);
    console.log('  mode=%s webgl2=%s beat=%s fps=%s canvas=%s disc(x,y,w,h)=%s hand=%s', r.mode, r.webgl2, r.beat, r.fps, r.canvas.join('x'), r.disc.join(','), r.handRead);
    console.log('  ticks=%d redacted=%d ocrBoxes=%d nowBoxes=%d overlapPx(readbox/lab/cap)=%d/%d/%d', r.ticks, r.redacted, r.ocrBoxes, r.nowBoxes, r.overlap.readbox, r.overlap.lab, r.overlap.cap);
    console.log('  lab: ' + r.lab);
    console.log('  readbox: ' + r.readbox);
    console.log('  console(%d):', r.logs.length);
    r.logs.forEach(l => console.log('    ' + l));
  }
})();
