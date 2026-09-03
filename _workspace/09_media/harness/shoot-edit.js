// 이미지 편집(범위 D) 실렌더 검증
//   ① 비파괴 탭: 변환 URL 문자열이 옵션대로 만들어지는지 + 미리보기 img 가 실제 로드되는지
//   ② 파괴 탭: 회전 90° → 결과 치수 스왑 실측(미리보기 img 의 naturalWidth/Height)
//              → 원본 교체 저장 시 ImageKit 업로드 요청을 가로채 multipart 필드와
//                업로드된 바이트의 실제 픽셀 치수를 검사 → purge 호출 확인
const { resolvePlaywright, installAdminSession, imgSize, jpegSize, parseMultipart, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
const OUT = PATHS.shots;

// 아주 단순한 multipart 파서(검증용)

// 로컬 스텁의 비정방 PNG 를 한 번 받아 둔다(이 바이트로 ImageKit 호스트 응답을 대체).
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
  console.log('테스트 원본 PNG 치수:', PNG.readUInt32BE(16) + 'x' + PNG.readUInt32BE(20), `(${PNG.length}B)`);
  const br = await chromium.launch();
  const report = {};
  for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const msgs = [];
    const captured = { upload: null, purge: null };
    await installAdminSession(ctx);
    const page = await ctx.newPage();
    page.on('console', (m) => msgs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => msgs.push({ type: 'pageerror', text: String(e) }));

    // ImageKit 업로드 가로채기 — 실계정이 없으므로 요청 내용만 검사하고 성공 응답을 흉내낸다.
    await page.route('**/upload.imagekit.io/**', async (route) => {
      const req = route.request();
      const buf = req.postDataBuffer();
      const ct = req.headers()['content-type'] || '';
      const bm = ct.match(/boundary=(.+)$/);
      const parsed = bm ? parseMultipart(buf, bm[1]) : null;
      captured.upload = {
        fields: parsed ? parsed.fields : null,
        fileName: parsed ? parsed.fileName : null,
        fileBytes: parsed && parsed.file ? parsed.file.length : 0,
        fileDims: parsed && parsed.file ? imgSize(parsed.file) : null,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fileId: 'stub', name: parsed ? parsed.fileName : 'x',
          url: 'http://localhost:8000/thumb/2.png', filePath: '/uploads/x.png',
        }),
      });
    });
    // ImageKit 이미지 호스트 → 로컬 비정방 PNG(400x240) 로 응답(실계정 없이 실픽셀 검증).
    await page.route('**ik.imagekit.io/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: PNG,
      });
    });
    page.on('request', (r) => { if (r.url().includes('/api/imagekit/purge')) captured.purge = r.url(); });

    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.locator('.mt-label', { hasText: 'uploads' }).first().click().catch(() => {});
    await page.waitForTimeout(1500);

    // 상세 열기 → 편집 탭
    await page.locator('.ma-thumb-btn').first().click();
    await page.waitForTimeout(1500);
    await page.locator('.ma-drawer-tabs .ma-edit-tab', { hasText: '편집' }).click();
    await page.waitForTimeout(600);

    // ── ① 비파괴 ──
    await page.locator('.ma-edit-row', { hasText: '회전' }).locator('.ma-btn', { hasText: '90°' }).first().click();
    await page.locator('.ma-edit-row', { hasText: '반전' }).locator('.ma-btn', { hasText: '좌우' }).first().click();
    await page.locator('.ma-edit-row', { hasText: '가로폭' }).locator('.ma-btn', { hasText: '800' }).first().click();
    await page.waitForTimeout(700);
    const trText = await page.locator('.ma-edit-tr').innerText();
    const trPreview = await page.locator('.ma-edit-body .ma-edit-preview img').evaluate((i) => ({
      src: i.getAttribute('src'), nw: i.naturalWidth, nh: i.naturalHeight, complete: i.complete,
    }));
    await page.screenshot({ path: `${OUT}/edit-${label}-1-url.png` });

    // ── ② 파괴 ──
    await page.locator('.ma-edit > .ma-edit-tabs .ma-edit-tab', { hasText: '파괴 · 원본 교체' }).click();
    await page.waitForTimeout(2000);
    const srcText = await page.locator('.ma-edit-size dd').first().innerText();
    await page.locator('.ma-btn', { hasText: '오른쪽 90°' }).click();
    await page.waitForTimeout(1200);
    const outText = await page.locator('.ma-edit-size dd').nth(1).innerText();
    const pxPreview = await page.locator('.ma-edit-body .ma-edit-preview img').evaluate((i) => ({
      nw: i.naturalWidth, nh: i.naturalHeight,
    }));
    await page.screenshot({ path: `${OUT}/edit-${label}-2-pixel.png` });

    // 크롭 UI
    await page.locator('.ma-btn', { hasText: '크롭 시작' }).click();
    await page.waitForTimeout(500);
    const box = await page.locator('.ma-crop-stage').boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(900);
    }
    const cropOut = await page.locator('.ma-edit-size dd').nth(1).innerText();
    const cropRectStyle = await page.locator('.ma-crop-rect').getAttribute('style');
    // 비율 고정(16:9) 확인
    await page.locator('.ma-edit-row', { hasText: '크롭' }).locator('.ma-btn', { hasText: '16:9' }).click();
    await page.waitForTimeout(1000);
    const ratioOut = await page.locator('.ma-edit-size dd').nth(1).innerText();
    await page.screenshot({ path: `${OUT}/edit-${label}-3-crop.png` });
    await page.locator('.ma-btn', { hasText: '크롭 끝내기' }).click();
    await page.waitForTimeout(1200);

    // 저장(원본 교체) → 확인
    await page.locator('.ma-btn', { hasText: '원본 교체 저장' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/edit-${label}-4-confirm.png` });
    await page.locator('.ma-btn', { hasText: '덮어쓰기 확인' }).click();
    await page.waitForTimeout(3000);
    const notice = await page.locator('.ma-notice').innerText().catch(() => '(없음)');
    await page.screenshot({ path: `${OUT}/edit-${label}-5-saved.png`, fullPage: false });

    const errs = msgs.filter((m) => ['error', 'pageerror'].includes(m.type));
    report[label] = { trText, trPreview, srcText, outText, pxPreview, cropOut, cropRectStyle, ratioOut, captured, notice, errs };
    await ctx.close();
  }
  await br.close();

  for (const [k, v] of Object.entries(report)) {
    console.log(`\n════════ ${k} ════════`);
    console.log('① 비파괴 tr 문자열 :', v.trText);
    console.log('   미리보기 src     :', v.trPreview.src);
    console.log('   미리보기 실측    :', `${v.trPreview.nw}x${v.trPreview.nh} (loaded=${v.trPreview.complete})`);
    console.log('② 파괴 원본        :', v.srcText);
    console.log('   90° 회전 후 결과 :', v.outText);
    console.log('   미리보기 blob 실측:', `${v.pxPreview.nw}x${v.pxPreview.nh}`);
    console.log('   크롭 사각형      :', v.cropRectStyle);
    console.log('   크롭 후 결과     :', v.cropOut);
    console.log('   16:9 고정 후 결과:', v.ratioOut);
    console.log('   업로드 multipart :', JSON.stringify(v.captured.upload && v.captured.upload.fields));
    console.log('   업로드 파일명    :', v.captured.upload && v.captured.upload.fileName);
    console.log('   업로드 바이트 치수:', JSON.stringify(v.captured.upload && v.captured.upload.fileDims), `(${v.captured.upload && v.captured.upload.fileBytes}B)`);
    console.log('   purge 호출       :', v.captured.purge || '(없음)');
    console.log('   완료 알림        :', v.notice);
    console.log('   console error    :', v.errs.length);
    v.errs.forEach((e) => console.log('     -', e.text.split('\n')[0].slice(0, 160)));
  }
})();
