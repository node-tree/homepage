// 종자자 9자 실렌더 검증 — ?beat=0..8 의 중심 원(r112) 영역을 잘라 시트로 만들고
// 중심 정렬(잉크 무게중심 이탈)·잉크량 편차를 실측한다.
const { chromium } = require('/Users/kanghyunjung/.nvm/versions/node/v18.17.0/lib/node_modules/playwright');
const fs = require('fs');
const { PNG } = (() => { try { return { PNG: require('/Users/kanghyunjung/.nvm/versions/node/v18.17.0/lib/node_modules/playwright/node_modules/pngjs').PNG }; } catch (e) { return {}; } })();
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  const shots = [];
  for (let b = 0; b < 9; b++) {
    await page.goto('http://localhost:3000/clock?theme=dark&beat=' + b, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('.dclock[data-mode]', { timeout: 30000 });
    await page.waitForTimeout(900);
    // 중심 칸(r112) = 원반의 112/470 반경 → 정사각 크롭
    const box = await page.evaluate(() => {
      const d = document.querySelector('.dclock__disc').getBoundingClientRect();
      const R = d.width / 2, k = 118 / 470;   // 살짝 여유
      return { x: d.x + R - R * k, y: d.y + R - R * k, width: 2 * R * k, height: 2 * R * k };
    });
    const buf = await page.screenshot({ clip: box });
    fs.writeFileSync(`/tmp/seedshot_${b}.png`, buf);
    shots.push(buf.length);
  }
  await ctx.close(); await browser.close();
  console.log('shot bytes', shots.join(','));
  console.log('console(%d):', logs.length); logs.forEach(l => console.log('  ' + l));
})();
