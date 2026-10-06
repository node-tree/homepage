const {chromium}=require('/Users/kanghyunjung/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const fs=require('fs'),assert=require('assert');
const out='_home/mobile-menu/output/playwright';
let browser; const report=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
 const routes=[['home','/'],['work','/work'],['detail','/work/6969e0c950e7b0f6a31e83fa']];
 async function ready(p,path){await p.goto('http://127.0.0.1:3601'+path);await p.locator('.menu-button').waitFor({state:'attached'});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(900);}
 async function metrics(p){return p.evaluate(()=>{
  const h=document.querySelector('header.menu-wrap'),w=document.querySelector('.ntwalker'),r=e=>e.getBoundingClientRect(),wr=r(w);
  const visible=getComputedStyle(w).visibility==='visible'&&getComputedStyle(w).display!=='none';
  const obstacles=[...h.querySelectorAll('.brand a,.menu-button,.nav a,.clock > *,.auth a,.auth button')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&r(e).width);
  const collisions=visible?obstacles.filter(e=>{const a=r(e);return wr.left<a.right&&wr.right>a.left&&wr.top<a.bottom&&wr.bottom>a.top}).map(e=>e.className||e.textContent):[];
  return {headerHeight:r(h).height,overflow:document.documentElement.scrollWidth-innerWidth,button:{width:r(h.querySelector('.menu-button')).width,height:r(h.querySelector('.menu-button')).height},walkerVisible:visible,collisions,lane:[w.dataset.laneMin,w.dataset.laneMax],focus:document.activeElement.className,locked:document.body.style.position==='fixed',panelBackground:getComputedStyle(document.querySelector('.menu-panel')).backgroundColor};
 });}
 async function closed(p){await p.waitForTimeout(200);assert.equal(await p.locator('.menu-button').getAttribute('aria-expanded'),'false');assert.equal(await p.evaluate(()=>document.activeElement.className),'menu-button');assert.equal(await p.evaluate(()=>document.body.style.position),'');}
 for(const width of [390,320])for(const [name,path] of routes){
  const p=await browser.newPage({viewport:{width,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  await ready(p,path);const before=await metrics(p);assert.equal(before.headerHeight,64);assert.equal(before.overflow,0);assert(before.button.width>=44&&before.button.height>=44);assert.equal(before.collisions.length,0);
  assert.equal(await p.locator('#nt-menu-panel').getAttribute('inert'),'');
  await p.screenshot({path:`${out}/${width}-${name}-closed.png`});
  // Sample the moving ruler across time, not just one captured frame.
  for(let i=0;i<12;i++){await p.waitForTimeout(100);assert.equal((await metrics(p)).collisions.length,0);}
  await p.locator('.menu-button').click();await p.waitForTimeout(200);const opened=await metrics(p);
  assert.equal(await p.locator('.menu-button').getAttribute('aria-expanded'),'true');assert.equal(opened.focus,'menu-close');assert(opened.locked);assert(await p.locator('main').evaluate(e=>e.hasAttribute('inert')));assert(!opened.walkerVisible);assert.equal(opened.overflow,0);
  assert.equal(await p.locator('.nav a').count(),7);assert.equal(await p.locator('.nav a[aria-current="page"]').count(),1);
  const linkRects=await p.locator('.nav a').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,left:e.getBoundingClientRect().left})));
  assert(linkRects.every((r,i)=>r.height>=44&&(!i||r.top>=linkRects[i-1].top+linkRects[i-1].height)));
  await p.screenshot({path:`${out}/${width}-${name}-open.png`});
  await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'LOGIN');
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.className),'menu-close');
  for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.querySelector('#nt-menu-panel').contains(document.activeElement)));}
  await p.keyboard.press('Escape');await closed(p);
  await p.locator('.menu-button').click();await p.locator('.menu-close').click();await closed(p);
  await p.locator('.menu-button').click();await p.waitForTimeout(180);const panel=await p.locator('.menu-panel').boundingBox();await p.mouse.click(5,panel.y+panel.height+15);await closed(p);
  await p.evaluate(()=>window.scrollTo(0,400));const y=await p.evaluate(()=>scrollY);await p.locator('.menu-button').click();await p.mouse.wheel(0,400);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>document.body.style.top),`-${y}px`);await p.keyboard.press('Escape');await closed(p);assert.equal(await p.evaluate(()=>scrollY),y);
  await p.locator('.menu-button').click();await p.locator('.nav a[href="'+(name==='work'?'/':'/work')+'"]').click();await p.waitForTimeout(700);await closed(p);assert.equal(await p.evaluate(()=>document.querySelector('main').hasAttribute('inert')),false);
  report.push({width,page:name,before,opened,interaction:'open, X, Escape, outside tap, tab cycle, scroll restore, route close/focus: passed',errors});assert.equal(errors.length,0);await p.close();
 }
 // Desktop header: wrapper must not change the existing grid geometry.
 for(const [name,path] of routes){const p=await browser.newPage({viewport:{width:1440,height:900}});await ready(p,path);const measure=()=>p.locator('header').evaluate(h=>[h,...h.querySelectorAll('.brand,.nav,.nav a,.clock,.auth')].map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()})));const actual=await measure();assert.equal(actual[0].rect.height,56);await p.screenshot({path:`${out}/1440-${name}.png`});
  await p.evaluate(()=>{const panel=document.querySelector('.menu-panel');panel.replaceWith(...panel.children);document.querySelectorAll('.menu-button,.menu-close,.menu-backdrop').forEach(e=>e.remove());});assert.deepEqual(await measure(),actual);report.push({width:1440,page:name,desktopGridUnchanged:true});await p.close();}
 // Existing detail PDF and sticky layout, after the menu has been opened and closed.
 for(const width of [320,390,1440]){const p=await browser.newPage({viewport:{width,height:900}});await ready(p,routes[2][1]);if(width<768){await p.locator('.menu-button').click();await p.keyboard.press('Escape');}
  const sticky=await p.locator('.photo-essay').evaluate(e=>({header:getComputedStyle(e).getPropertyValue('--photo-header-bottom'),offset:e.querySelector('.photo-prose')?parseFloat(getComputedStyle(e.querySelector('.photo-prose')).getPropertyValue('--photo-header-bottom'))+24:null,prose:e.querySelector('.photo-prose')?getComputedStyle(e.querySelector('.photo-prose')).position:'mobile-flow'}));
  if(width>=768){assert.equal(parseFloat(sticky.header),56);assert.equal(sticky.offset,80);assert.equal(sticky.prose,'sticky');}
  await p.getByRole('button',{name:'펼쳐 보기'}).click();await p.locator('.pdf-dialog[open]').waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('.pdf-leaf img')].every(e=>e.complete&&e.naturalWidth>0));await p.getByRole('button',{name:'다음 쪽',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('.pdf-leaf img')].every(e=>e.complete&&e.naturalWidth>0));await p.waitForTimeout(100);await p.screenshot({path:`${out}/${width}-pdf.png`});await p.keyboard.press('Escape');assert.equal(await p.locator('.pdf-dialog[open]').count(),0);assert.equal(await p.evaluate(()=>document.activeElement.textContent.trim()),'펼쳐 보기 ↗');report.push({width,pdf:'open/render/next page/Escape/focus: passed',sticky});await p.close();}
 // Rotation across the breakpoint and reduced motion.
 const p=await browser.newPage({viewport:{width:390,height:600},reducedMotion:'reduce'});await ready(p,'/work');await p.locator('.menu-button').click();assert.equal(await p.locator('.menu-panel').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>document.body.style.position),'');assert.equal(await p.locator('.menu-panel').getAttribute('inert'),null);await p.setViewportSize({width:390,height:600});await p.waitForTimeout(100);assert.equal(await p.locator('.menu-button').getAttribute('aria-expanded'),'false');report.push({resizeAndReducedMotion:true});await p.close();
 fs.writeFileSync('_home/mobile-menu/verification.json',JSON.stringify(report,null,2));console.log(`PASS: ${report.length} scenarios, ${out}`);await browser.close();
})().catch(async e=>{fs.writeFileSync('_home/mobile-menu/verification-partial.json',JSON.stringify(report,null,2));console.error(e);await browser?.close();process.exit(1)});
