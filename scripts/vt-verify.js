/* 세로 표찰 실렌더 검증 — 1440 / 390 / 320.
   캡처 + 계측(bbox · 교차 · 헤더 가림 · 가로 넘침 · 콘솔 오류). */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/private/tmp/claude-501/-Users-kanghyunjung/0382b7e3-22a4-490e-a5a6-88fe971b399e/scratchpad/vertical-text';
const BASE = 'http://localhost:3001';
const PAGES = ['/', '/work', '/commons', '/cv', '/contact', '/about'];
const SIZES = [
  { name: 'desktop', w: 1440, h: 1000 },
  { name: 'mobile', w: 390, h: 844 },
  { name: 'w320', w: 320, h: 720 },
  { name: 'w1024', w: 1024, h: 800 },
  { name: 'w768', w: 768, h: 800 },
  { name: 'w1920', w: 1920, h: 1080 },
];

const rectsOverlap = (a, b) =>
  !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  let consoleErrors = [];

  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[${size.name}] ${m.text()}`);
    });
    page.on('pageerror', (e) => consoleErrors.push(`[${size.name}] PAGEERROR ${e.message}`));

    // 작품 상세 한 건 — 목록에서 첫 링크를 얻는다(기존 .metav 확인용)
    let detailPath = null;

    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      if (path === '/work' && !detailPath) {
        detailPath = await page.evaluate(() => {
          const a = document.querySelector('.nt .index .rows a[href^="/work/"]');
          return a ? new URL(a.href).pathname : null;
        });
      }
      const m = await measure(page, path, size);
      report.push(m);
      const slug = path === '/' ? 'home' : path.replace(/\//g, '-').replace(/^-/, '');
      await page.screenshot({ path: `${OUT}/${slug}-${size.name}.png`, fullPage: false });
      if (path !== '/') {
        await page.screenshot({ path: `${OUT}/${slug}-${size.name}-full.png`, fullPage: true });
      }
    }

    if (detailPath) {
      await page.goto(BASE + detailPath, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      report.push(await measure(page, detailPath, size));
      await page.screenshot({ path: `${OUT}/workdetail-${size.name}.png`, fullPage: false });
    }

    await ctx.close();
  }

  await browser.close();

  console.log('════════ 계측 ════════');
  for (const r of report) console.log(JSON.stringify(r));
  console.log('════════ 콘솔 오류 (' + consoleErrors.length + ') ════════');
  consoleErrors.forEach((e) => console.log(e));
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, consoleErrors }, null, 2));

  async function measure(page, path, size) {
    return page.evaluate(
      ({ path, size }) => {
        const r = (el) => {
          const b = el.getBoundingClientRect();
          return {
            left: +b.left.toFixed(1), top: +(b.top + window.scrollY).toFixed(1),
            right: +b.right.toFixed(1), bottom: +(b.bottom + window.scrollY).toFixed(1),
            w: +b.width.toFixed(1), h: +b.height.toFixed(1),
          };
        };
        const overlap = (a, b) =>
          !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);

        const sealEls = [...document.querySelectorAll('.nt .vseal, .nt .metav')];
        const seals = sealEls.map((el) => {
          const cs = getComputedStyle(el);
          return {
            cls: el.className,
            text: el.textContent.trim().slice(0, 40),
            writingMode: cs.writingMode,
            orientationMk: el.querySelector('.mk') ? getComputedStyle(el.querySelector('.mk')).textOrientation : null,
            box: r(el),
            visible: cs.display !== 'none' && el.getBoundingClientRect().width > 0,
          };
        });

        // 교차 검사 — 표찰 대 페이지의 주요 텍스트 블록
        const others = [...document.querySelectorAll(
          '.nt header, .nt .pagehead h1, .nt .pagehead .lab, .nt .pagehead .note, .nt footer > div, .nt .detail .txt, .nt .dclock__disc, .nt .dclock__lab, .nt .dclock__cap, .nt .dclock__readbox'
        )];
        const collisions = [];
        for (let si = 0; si < seals.length; si++) {
          const s = seals[si];
          if (!s.visible) continue;
          const sEl = sealEls[si];
          for (const o of others) {
            if (o === sEl || o.contains(sEl) || sEl.contains(o)) continue;
            const ob = r(o);
            if (ob.w === 0 || ob.h === 0) continue;
            if (overlap(s.box, ob)) {
              collisions.push({ seal: s.cls, with: o.className || o.tagName, obox: ob, sbox: s.box });
            }
          }
        }

        // 헤더 가림 — 표찰 중심점 hit-test
        const headerHits = [];
        for (const s of seals) {
          if (!s.visible) continue;
          const cx = (s.box.left + s.box.right) / 2;
          const cy = (s.box.top + s.box.bottom) / 2 - window.scrollY;
          if (cy < 0 || cy > window.innerHeight) continue;
          const hit = document.elementFromPoint(cx, cy);
          const inHeader = hit ? !!hit.closest('.nt header') : false;
          headerHits.push({ seal: s.cls, hit: hit ? hit.className || hit.tagName : null, inHeader });
        }

        return {
          path, vp: size.name,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          seals, collisions, headerHits,
        };
      },
      { path, size }
    );
  }
})();
