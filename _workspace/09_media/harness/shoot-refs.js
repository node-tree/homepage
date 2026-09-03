// 이동/이름변경 모달의 "참조 안내" 스크린샷 — 참조 있음 / 참조 없음(안전) 두 경우.
//   실행: node _workspace/09_media/harness/shoot-refs.js
const fs = require('fs');
const http = require('http');
const { resolvePlaywright, installAdminSession, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
const OUT = PATHS.shots;

function png() {
  return new Promise((r) => http.get('http://localhost:8000/thumb/2.png', (s) => {
    const c = []; s.on('data', (d) => c.push(d)); s.on('end', () => r(Buffer.concat(c)));
  }));
}

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
      r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG })
    );

    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    if (label === 'mobile') await page.locator('.ma-tree-toggle').click().catch(() => {});
    await page.locator('.mt-label', { hasText: 'mcwjd' }).first().click().catch(() => {});
    await page.waitForTimeout(1500);

    // (1) 폴더 이동 — 참조 있음
    const folderMove = page.locator('.ma-folder-actions .ma-btn', { hasText: '이동' }).first();
    await folderMove.click();
    await page.waitForTimeout(1800);
    const refsText = await page.locator('.ma-refs').innerText().catch(() => '(없음)');
    await page.screenshot({ path: `${OUT}/refs-${label}-1-move-hasrefs.png` });
    await page.locator('.ma-modal-actions .ma-btn.ghost', { hasText: '취소' }).first().click();
    await page.waitForTimeout(700);

    // (2) 폴더 이름변경 — 참조 안내 + 경고
    const rename = page.locator('.ma-folder-actions .ma-btn', { hasText: '이름변경' }).first();
    await rename.click();
    await page.waitForTimeout(1800);
    const renameRefs = await page.locator('.ma-refs').innerText().catch(() => '(없음)');
    await page.screenshot({ path: `${OUT}/refs-${label}-2-rename.png` });
    await page.locator('.ma-modal-actions .ma-btn.ghost', { hasText: '취소' }).first().click();
    await page.waitForTimeout(700);

    // (3) 참조 없음(안전) — /uploads/2026 폴더로 이동해서 그 안 폴더를 대상으로
    await page.locator('input[aria-label="폴더 경로"]').fill('/uploads');
    await page.locator('input[aria-label="폴더 경로"]').press('Enter');
    await page.waitForTimeout(1600);
    const safeMove = page.locator('.ma-folder-actions .ma-btn', { hasText: '이동' }).first();
    await safeMove.click();
    await page.waitForTimeout(1800);
    const safeText = await page.locator('.ma-refs').innerText().catch(() => '(없음)');
    await page.screenshot({ path: `${OUT}/refs-${label}-3-safe.png` });
    await page.locator('.ma-modal-actions .ma-btn.ghost', { hasText: '취소' }).first().click();
    await page.waitForTimeout(500);

    const overflow = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    report[label] = { refsText, renameRefs, safeText, overflow, errs: msgs.filter((m) => ['error', 'pageerror'].includes(m.type)) };
    await ctx.close();
  }
  await br.close();

  for (const [k, v] of Object.entries(report)) {
    console.log(`\n════════ ${k} ════════`);
    console.log('[이동·참조 있음]\n' + v.refsText);
    console.log('\n[이름변경]\n' + v.renameRefs);
    console.log('\n[참조 없음]\n' + v.safeText);
    console.log(`\n가로 오버플로: ${v.overflow.s}/${v.overflow.c} → ${v.overflow.s > v.overflow.c ? 'OVERFLOW' : 'none'}`);
    console.log(`console error: ${v.errs.length}`);
    v.errs.forEach((e) => console.log('  -', e.text.split('\n')[0].slice(0, 150)));
  }
})();
