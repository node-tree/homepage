// 복제 방식 이동/복사의 완료 알림 스크린샷 — 검증 결과·참조 갱신·부분 실패 표시.
//   실행: node _workspace/09_media/harness/shoot-xfer.js
const fs = require('fs');
const http = require('http');
const { resolvePlaywright, installAdminSession, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
const OUT = PATHS.shots;

const png = () => new Promise((r) => http.get('http://localhost:8000/thumb/2.png', (s) => {
  const c = []; s.on('data', (d) => c.push(d)); s.on('end', () => r(Buffer.concat(c)));
}));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const PNG = await png();
  const br = await chromium.launch();
  const report = {};

  for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const msgs = [];
    await installAdminSession(ctx);
    const page = await ctx.newPage();
    page.on('console', (m) => msgs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => msgs.push({ type: 'pageerror', text: String(e) }));
    await page.route('**ik.imagekit.io/**', (r) =>
      r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));

    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    if (label === 'mobile') await page.locator('.ma-tree-toggle').click().catch(() => {});
    await page.locator('.mt-label', { hasText: 'uploads' }).first().click().catch(() => {});
    await page.waitForTimeout(1600);

    // 3개 선택 → 이동
    const boxes = page.locator('.ma-select input');
    const n = Math.min(3, await boxes.count());
    for (let i = 0; i < n; i++) await boxes.nth(i).check();
    await page.waitForTimeout(300);
    await page.locator('.ma-selbar .ma-btn', { hasText: '이동' }).first().click();
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/xfer-${label}-1-move-modal.png` });
    await page.locator('.ma-modal-actions .ma-btn.primary').click();
    await page.waitForTimeout(2500);
    const moveNotice = await page.locator('.ma-notice').innerText().catch(() => '(없음)');
    await page.screenshot({ path: `${OUT}/xfer-${label}-2-move-done.png`, fullPage: false });

    // 복사 — 이동 후 목록이 다시 그려지며 선택이 초기화되므로,
    //   체크가 실제로 반영(도구막대 활성)될 때까지 기다린 뒤 누른다.
    await page.waitForTimeout(1200);
    await page.locator('.ma-select input').first().check();
    await page.waitForSelector('.ma-selbar.active', { timeout: 10000 });
    const copyBtn = page.locator('.ma-selbar .ma-btn', { hasText: '복사' }).first();
    await copyBtn.waitFor({ state: 'attached' });
    await page.waitForFunction(
      () => {
        const b = Array.from(document.querySelectorAll('.ma-selbar .ma-btn')).find((x) => x.textContent.trim() === '복사');
        return b && !b.disabled;
      },
      { timeout: 10000 }
    );
    await copyBtn.click();
    await page.waitForTimeout(1400);
    await page.locator('.ma-modal-actions .ma-btn.primary').click();
    await page.waitForTimeout(2500);
    const copyNotice = await page.locator('.ma-notice').innerText().catch(() => '(없음)');
    await page.screenshot({ path: `${OUT}/xfer-${label}-3-copy-done.png`, fullPage: false });

    const overflow = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    report[label] = { moveNotice, copyNotice, overflow, errs: msgs.filter((m) => ['error', 'pageerror'].includes(m.type)) };
    await ctx.close();
  }
  await br.close();

  for (const [k, v] of Object.entries(report)) {
    console.log(`\n════════ ${k} ════════`);
    console.log('[이동 완료 알림]\n' + v.moveNotice);
    console.log('\n[복사 완료 알림]\n' + v.copyNotice);
    console.log(`\n가로 오버플로: ${v.overflow.s}/${v.overflow.c} → ${v.overflow.s > v.overflow.c ? 'OVERFLOW' : 'none'}`);
    console.log(`console error: ${v.errs.length}`);
    v.errs.forEach((e) => console.log('  -', e.text.split('\n')[0].slice(0, 150)));
  }
})();
