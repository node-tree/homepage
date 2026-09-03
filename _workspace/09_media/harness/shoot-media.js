// /admin/media 실렌더 관찰 — 데스크톱(1440) / 모바일(390) + 콘솔 에러 수집.
//   admin 세션은 localStorage 로 주입(AuthContext 가 auth_token/auth_user 만 본다).
const { resolvePlaywright, installAdminSession, imgSize, jpegSize, parseMultipart, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
const fs = require('fs');
const OUT = PATHS.shots;

// 로컬 검증 전용 더미 JWT(서명 검증 없이 exp 만 읽는 클라이언트 가드용).


// 스텁이 실제와 같은 ImageKit URL 을 주므로, 그 호스트를 로컬 PNG 로 가로챈다.
function fetchPng() {
  const http = require('http');
  return new Promise((res, rej) => {
    http.get('http://localhost:8000/thumb/2.png', (r) => {
      const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
    }).on('error', rej);
  });
}
let PNG = null;

(async () => {
  PNG = await fetchPng();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = {};

  for (const [label, vp] of Object.entries({
    desktop: { width: 1440, height: 1000 },
    mobile: { width: 390, height: 844 },
  })) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const msgs = [];
    await installAdminSession(ctx);
    const page = await ctx.newPage();
    await page.route('**ik.imagekit.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
    page.on('console', (m) => msgs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => msgs.push({ type: 'pageerror', text: String(e) }));
    page.on('requestfailed', (r) =>
      msgs.push({ type: 'requestfailed', text: `${r.url()} ${r.failure()?.errorText || ''}` })
    );

    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // 1) 기본 화면
    await page.screenshot({ path: `${OUT}/media-${label}-1-browse.png`, fullPage: true });

    // 모바일은 트리가 접혀 있다 → 토글 열어 확인
    if (label === 'mobile') {
      const t = page.locator('.ma-tree-toggle');
      if (await t.count()) {
        await t.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/media-${label}-2-tree.png`, fullPage: true });
        await t.click();
        await page.waitForTimeout(400);
      }
    }

    // 2) 폴더 진입(트리에서 uploads)
    const treeItem = page.locator('.mt-label', { hasText: 'uploads' }).first();
    if (await treeItem.count()) {
      if (label === 'mobile') await page.locator('.ma-tree-toggle').click();
      await page.waitForTimeout(400);
      await treeItem.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/media-${label}-3-folder.png`, fullPage: true });
    }

    // 3) 다중 선택 → 도구막대
    const boxes = page.locator('.ma-select input');
    const n = await boxes.count();
    for (let i = 0; i < Math.min(3, n); i++) await boxes.nth(i).check();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/media-${label}-4-select.png`, fullPage: true });

    // 4) 이동 모달(폴더 트리 재사용 + URL 경고)
    const moveBtn = page.locator('.ma-selbar .ma-btn', { hasText: '이동' }).first();
    if (await moveBtn.count()) {
      await moveBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/media-${label}-5-move-modal.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 5) 상세 드로어
    const thumb = page.locator('.ma-thumb-btn').first();
    if (await thumb.count()) {
      await thumb.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/media-${label}-6-detail.png` });
      await page.keyboard.press('Escape');
      await page.locator('.ma-drawer-x').click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }

    // 6) 전역 검색
    await page.locator('.ma-global-toggle input').check().catch(() => {});
    await page.locator('input[aria-label="파일명 검색"]').fill('signal');
    await page.locator('input[aria-label="파일명 검색"]').press('Enter');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/media-${label}-7-global-search.png`, fullPage: true });

    // 가로 스크롤(레이아웃 깨짐) 검사
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    report[label] = { console: msgs, overflow };
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/console-report.json`, JSON.stringify(report, null, 2));
  for (const [k, v] of Object.entries(report)) {
    const errs = v.console.filter((m) => ['error', 'pageerror', 'requestfailed'].includes(m.type));
    const warns = v.console.filter((m) => m.type === 'warning');
    console.log(`\n=== ${k} ===`);
    console.log(`  가로 오버플로: scrollW=${v.overflow.scrollW} clientW=${v.overflow.clientW} → ${v.overflow.scrollW > v.overflow.clientW ? 'OVERFLOW!' : 'none'}`);
    console.log(`  error/pageerror/requestfailed: ${errs.length}`);
    errs.forEach((e) => console.log(`    [${e.type}] ${e.text}`));
    console.log(`  warning: ${warns.length}`);
    warns.forEach((e) => console.log(`    [warn] ${e.text.slice(0, 200)}`));
  }
})();
