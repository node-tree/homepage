// 폴백 검증 — WebGL 을 끈 브라우저에서 3× 래스터 스프라이트 경로가 도는가
const { chromium } = require('/Users/kanghyunjung/.nvm/versions/node/v18.17.0/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await page.goto('http://localhost:3000/clock?theme=dark&beat=210', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.dclock[data-mode]', { timeout: 30000 });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => ({
    mode: document.querySelector('.dclock').dataset.mode,
    webgl2: (() => { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); })(),
    beat: document.querySelector('.dclock').dataset.beat,
  }));
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(+(n * 1000 / (performance.now() - t0)).toFixed(1)); };
    requestAnimationFrame(f);
  }));
  await page.screenshot({ path: __dirname + '/clock_fallback_raster.png' });
  await (await page.$('.dclock__disc')).screenshot({ path: __dirname + '/clock_fallback_raster_disc.png' });
  console.log('폴백:', JSON.stringify(info), 'fps=', fps);
  console.log('console(%d):', logs.length); logs.forEach(l => console.log('  ' + l));
  await browser.close();
})();
