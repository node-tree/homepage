// EXIF Orientation=6 검증 — 저장 픽셀 400x240 + Orientation 6 인 JPEG 를
// 편집 파이프라인에 태워 "원본 240x400 으로 인식되는지"(= EXIF 반영) 실측한다.
// 동시에 재업로드 FormData 필드도 캡처한다.
const { resolvePlaywright, installAdminSession, imgSize, jpegSize, parseMultipart, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
const fs = require('fs');
const OUT = PATHS.shots;
const EXIF6 = fs.readFileSync(`${__dirname}/fixtures/exif6.jpg`);



(async () => {
  console.log('테스트 파일: exif6.jpg — 저장 픽셀', JSON.stringify(jpegSize(EXIF6)), '+ EXIF Orientation=6');
  const br = await chromium.launch();
  const report = {};
  for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const msgs = []; const captured = { upload: null, purge: null };
    await installAdminSession(ctx);
    const page = await ctx.newPage();
    page.on('console', (m) => msgs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => msgs.push({ type: 'pageerror', text: String(e) }));

    // 모든 ImageKit 이미지 요청 → EXIF6 JPEG
    await page.route('**ik.imagekit.io/**', (r) =>
      r.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: EXIF6 })
    );
    await page.route('**/upload.imagekit.io/**', async (route) => {
      const req = route.request();
      const ct = req.headers()['content-type'] || '';
      const bm = ct.match(/boundary=(.+)$/);
      const parsed = bm ? parseMultipart(req.postDataBuffer(), bm[1]) : null;
      captured.upload = {
        fields: parsed ? parsed.fields : null,
        fileName: parsed ? parsed.fileName : null,
        bytes: parsed && parsed.file ? parsed.file.length : 0,
        dims: parsed && parsed.file ? imgSize(parsed.file) : null,
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fileId: 's', name: 'x', url: 'https://ik.imagekit.io/gc3jtyt9o/uploads/x.jpg', filePath: '/uploads/x.jpg' }) });
    });
    page.on('request', (r) => { if (r.url().includes('/api/imagekit/purge')) captured.purge = r.url(); });

    await page.goto(APP, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    await page.locator('.mt-label', { hasText: 'uploads' }).first().click().catch(() => {});
    await page.waitForTimeout(1400);
    await page.locator('.ma-thumb-btn').first().click();
    await page.waitForTimeout(1200);
    await page.locator('.ma-drawer-tabs .ma-edit-tab', { hasText: '편집' }).click();
    await page.waitForTimeout(400);
    await page.locator('.ma-edit > .ma-edit-tabs .ma-edit-tab', { hasText: '파괴 · 원본 교체' }).click();
    await page.waitForTimeout(2200);

    const srcRead = await page.locator('.ma-edit-size dd').first().innerText();
    const identityOut = await page.locator('.ma-edit-size dd').nth(1).innerText();
    const prev0 = await page.locator('.ma-edit-body .ma-edit-preview img').evaluate((i) => ({ nw: i.naturalWidth, nh: i.naturalHeight }));
    await page.screenshot({ path: `${OUT}/edit-${label}-6-exif.png` });

    // 90° 회전 → EXIF 반영 기준(240x400)에서 400x240 이 되어야 한다
    await page.locator('.ma-btn', { hasText: '오른쪽 90°' }).click();
    await page.waitForTimeout(1300);
    const rotOut = await page.locator('.ma-edit-size dd').nth(1).innerText();
    const prev90 = await page.locator('.ma-edit-body .ma-edit-preview img').evaluate((i) => ({ nw: i.naturalWidth, nh: i.naturalHeight }));
    await page.screenshot({ path: `${OUT}/edit-${label}-7-exif-rot.png` });

    await page.locator('.ma-btn', { hasText: '원본 교체 저장' }).click();
    await page.waitForTimeout(300);
    await page.locator('.ma-btn', { hasText: '덮어쓰기 확인' }).click();
    await page.waitForTimeout(2800);
    const notice = await page.locator('.ma-notice').innerText().catch(() => '(없음)');

    report[label] = { srcRead, identityOut, prev0, rotOut, prev90, captured, notice, errs: msgs.filter((m) => ['error', 'pageerror'].includes(m.type)) };
    await ctx.close();
  }
  await br.close();

  for (const [k, v] of Object.entries(report)) {
    console.log(`\n════════ ${k} ════════`);
    console.log('  패널이 읽은 원본 치수 :', v.srcRead, '  ← EXIF 반영이면 240 × 400');
    console.log('  무변환 결과           :', v.identityOut);
    console.log('  무변환 미리보기 blob  :', `${v.prev0.nw}x${v.prev0.nh}`);
    console.log('  90° 회전 결과         :', v.rotOut, '  ← 240x400 기준이면 400 × 240');
    console.log('  회전 미리보기 blob    :', `${v.prev90.nw}x${v.prev90.nh}`);
    console.log('  업로드 FormData       :', JSON.stringify(v.captured.upload && v.captured.upload.fields));
    console.log('  업로드 filename       :', v.captured.upload && v.captured.upload.fileName);
    console.log('  업로드 바이트 치수    :', JSON.stringify(v.captured.upload && v.captured.upload.dims), `(${v.captured.upload && v.captured.upload.bytes}B)`);
    console.log('  purge 호출            :', v.captured.purge || '(없음)');
    console.log('  완료 알림             :', String(v.notice).replace(/\n/g, ' '));
    console.log('  console error         :', v.errs.length);
    v.errs.forEach((e) => console.log('    -', e.text.split('\n')[0].slice(0, 150)));
    const exifOk = v.srcRead.replace(/\s/g, '').startsWith('240×400');
    console.log(`  판정: EXIF orientation 6 반영 → ${exifOk ? 'PASS' : 'FAIL'}`);
  }
})();
