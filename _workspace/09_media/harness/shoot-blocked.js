// 미지원 확장자(.avif) 가 파괴 편집에서 차단되는지 확인.
//   목록/상세 응답의 파일명을 .avif 로 바꿔치기해 화이트리스트 가드를 실제 UI 에서 검증한다.
//   (예전 결함: 블랙리스트라 .avif 가 통과했고 JPEG 바이트로 원본을 덮어써 손상시켰다.)
//   실행: node _workspace/09_media/harness/shoot-blocked.js
const { resolvePlaywright, installAdminSession, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 } });
  await installAdminSession(ctx);
  const p = await ctx.newPage();
  // 목록의 첫 파일 이름을 .avif 로 바꿔 응답 → 파괴 편집이 차단되는지 확인
  await p.route('**/api/imagekit/list**', async (route) => {
    const res = await route.fetch();
    const j = await res.json();
    const f = (j.files || []).find((x) => x.url);
    if (f) { f.name = 'sample.avif'; f.filePath = '/uploads/sample.avif'; f.url = 'https://ik.imagekit.io/gc3jtyt9o/uploads/sample.avif'; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await p.route('**/api/imagekit/file/**', async (route) => {
    const res = await route.fetch();
    const j = await res.json();
    if (j.file) { j.file.name = 'sample.avif'; j.file.filePath = '/uploads/sample.avif'; j.file.url = 'https://ik.imagekit.io/gc3jtyt9o/uploads/sample.avif'; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await p.goto(APP, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.locator('.ma-thumb-btn').first().click();
  await p.waitForTimeout(1200);
  await p.locator('.ma-drawer-tabs .ma-edit-tab', { hasText: '편집' }).click();
  await p.waitForTimeout(400);
  await p.locator('.ma-edit > .ma-edit-tabs .ma-edit-tab', { hasText: '파괴 · 원본 교체' }).click();
  await p.waitForTimeout(1500);
  console.log('파괴 탭 차단 메시지:', (await p.locator('.ma-edit-body .ma-error').allInnerTexts()).join(' | '));
  console.log('저장 버튼 존재:', await p.locator('.ma-btn', { hasText: '원본 교체 저장' }).count());
  await p.screenshot({ path: `${PATHS.shots}/edit-desktop-8-avif-blocked.png` });
  await br.close();
})();
