// ImageKitPicker(리팩터 대상) 실렌더 관찰 — /work/new 의 "대표 도판 고르기" 피커.
const { resolvePlaywright, installAdminSession, imgSize, jpegSize, parseMultipart, PATHS, APP } = require('./lib/common');
const { chromium } = resolvePlaywright();
const OUT = PATHS.shots;

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
  const br = await chromium.launch();
  for (const [label, vp] of Object.entries({desktop:{width:1440,height:1000}, mobile:{width:390,height:844}})) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const msgs=[];
    await installAdminSession(ctx);
    const p = await ctx.newPage();
    await p.route('**ik.imagekit.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
    p.on('console', m=>msgs.push({type:m.type(),text:m.text()}));
    p.on('pageerror', e=>msgs.push({type:'pageerror',text:String(e)}));
    await p.goto('http://localhost:3000/work/new', { waitUntil:'networkidle' });
    await p.waitForTimeout(2500);
    // 피커를 여는 버튼 탐색
    const cands = ['대표 도판','이미지 선택','도판','이미지'];
    let opened=false;
    for (const c of cands) {
      const btn = p.locator(`button:has-text("${c}")`).first();
      if (await btn.count()) { await btn.click().catch(()=>{}); await p.waitForTimeout(1500); if (await p.locator('.ikp-modal').count()) { opened=true; break; } }
    }
    console.log(`[${label}] picker opened: ${opened}`);
    if (opened) {
      await p.screenshot({ path: `${OUT}/picker-${label}-1.png` });
      // 폴더 진입 → 목록 갱신되는지(공용 훅 경로) 확인
      const fol = p.locator('.ikp-folder').first();
      if (await fol.count()) { await fol.click(); await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}/picker-${label}-2-folder.png` }); }
      const cnt = await p.locator('.ikp-card').count();
      console.log(`  폴더 진입 후 파일 카드 수: ${cnt}`);
      // 검색
      await p.locator('.ikp-controls input[type="text"]').first().fill('signal');
      await p.locator('.ikp-controls input[type="text"]').first().press('Enter');
      await p.waitForTimeout(1500);
      console.log(`  검색 후 카드 수: ${await p.locator('.ikp-card').count()}`);
      await p.screenshot({ path: `${OUT}/picker-${label}-3-search.png` });
    } else {
      await p.screenshot({ path: `${OUT}/picker-${label}-0-page.png`, fullPage:true });
    }
    const errs = msgs.filter(m=>['error','pageerror'].includes(m.type));
    console.log(`  error/pageerror: ${errs.length}`);
    [...new Set(errs.map(e=>e.text.split('\n')[0].slice(0,160)))].forEach(t=>console.log('   -',t));
    await ctx.close();
  }
  await br.close();
})();
