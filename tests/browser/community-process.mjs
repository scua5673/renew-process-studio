import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,root,SHOTS} from '../fixtures/team-app.mjs';

// The whole prepared letter catalog, local source text and native board/vault flow.
// All accounts are synthetic; the fixture blocks every production request.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'phone':'desktop');
const letter=n=>JSON.parse(fs.readFileSync(path.join(root,'studio/letters',String(n).padStart(2,'0')+'.json'),'utf8'));
const pack=JSON.parse(fs.readFileSync(path.join(root,'studio/packs/03.json'),'utf8')).drills[0];
const fx=await startFixture(),browsers={};
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  let indexDown=true,detailDown=true,lateResolve,lateDone,packResolve;
  const bodies=[],writes=[];
  await context.route('**/studio/letters/**',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop();bodies.push(name);
    if(name==='index.json'&&indexDown||name==='43.json'&&detailDown)return route.fulfill({status:503,body:'busy'});
    if(name==='42.json'){await new Promise(resolve=>lateResolve=resolve);await route.fallback();lateDone=true;return;}
    return route.fallback();
  });
  await context.route('**/studio/packs/46.json',async route=>{await new Promise(resolve=>packResolve=resolve);await route.fallback();});
  page.on('request',r=>{if(/ps_community|ps_comm_/.test(r.url())&&r.method()!=='GET')writes.push(r.method());});
  await page.evaluate(()=>window.__psShowApp('community'));
  let c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('#prSeg');await c.evaluate(()=>location.reload());
  c=await (await page.waitForSelector('#fComm')).contentFrame();
  await c.waitForSelector('[data-letter-retry]');
  indexDown=false;await c.click('[data-letter-retry]');await c.waitForSelector('.pl-row');
  const ids=()=>c.locator('.pl-row').evaluateAll(rows=>rows.map(x=>+x.dataset.letter));
  assert.deepEqual(await ids(),Array.from({length:46},(_,i)=>46-i));
  assert.equal(await c.locator('#prProcN').textContent(),'46');
  assert.equal(await c.locator('#txBar').isVisible(),false,'training age/topic filters must not hide letters');
  assert.equal(await c.locator('#commViewSeg').isVisible(),false,'the letter catalog has one clear list view');
  assert.ok(!bodies.some(x=>/^\d+\.json$/.test(x)),'opening the list does not load 46 full bodies');
  const geometry=await c.evaluate(()=>({vw:innerWidth,doc:document.documentElement.scrollWidth,rows:[...document.querySelectorAll('.pl-row')].map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
  assert.equal(geometry.doc,geometry.vw);assert.ok(geometry.rows.every(r=>r.left>=0&&r.right<=geometry.vw+1));
  const shot=n=>page.screenshot({path:path.join(SHOTS,`process-letters-${engine}-${size}-${n}.png`)});
  await shot('list');
  await c.selectOption('#plOrder','old');assert.equal((await ids())[0],1);
  await c.fill('#commSearch',letter(3).title);await c.waitForFunction(()=>document.querySelectorAll('.pl-row').length===1);
  assert.deepEqual(await ids(),[3]);await c.click('[data-letter="3"]');await c.waitForSelector('[data-letter-reader="3"]');
  assert.equal(await c.locator('.pl-title h1').textContent(),letter(3).title);
  assert.equal(await c.locator('.pl-section[id^="pl-piece-"]').count(),3);
  assert.equal(await c.locator('.pl-play').count(),3);
  for(const evidence of letter(3).training.why.evidence)assert.ok((await c.locator('.pl-why').textContent()).includes(evidence.text));
  assert.equal(await c.locator('.pl-title h1').evaluate(e=>document.activeElement===e),true,'reading begins at a focused title');
  await shot('article');
  await c.click('[data-letter-jump="pl-training"]');await c.waitForSelector('.pl-training');await shot('training');
  await c.click('[data-letter-play="3"][data-training="1"]');
  try{await c.waitForSelector('#cvMask.on',{timeout:20000});}catch(e){console.log('viewer diagnostics',await c.evaluate(()=>({toast:document.getElementById('toast').textContent,preview:getComputedStyle(document.getElementById('commPreview')).display,busy:document.querySelector('[data-letter-play="3"][data-training="1"]').getAttribute('aria-busy')})),logs.filter(x=>x.type==='pageerror'));throw e;}
  console.log('letters: native viewer opened');
  let v=await (await c.waitForSelector('#cvFrame')).contentFrame();
  await v.waitForFunction(name=>typeof anim!=='undefined'&&anim.frames.length>1&&(document.getElementById('epName')||{}).value===name,pack.trainings[1].name);
  assert.equal(await c.locator('#prCvTabs button[aria-pressed="true"] .pr-i').textContent(),'2');
  assert.equal(await v.evaluate(()=>editorReadOnly),true);
  await c.click('#prCvTabs button:first-child');v=await (await c.waitForSelector('#cvFrame')).contentFrame();
  await v.waitForFunction(name=>(document.getElementById('epName')||{}).value===name,pack.trainings[0].name);
  await c.click('#cvClose');await c.waitForFunction(()=>!document.getElementById('cvMask').classList.contains('on'));
  assert.equal(await c.locator('[data-letter-reader="3"]').count(),1,'closing the animation returns to the same letter');
  await c.click('[data-letter-play="3"][data-training="0"]');await c.waitForSelector('#cvMask.on');await c.waitForSelector('#cdCopy');
  console.log('letters: importing training');
  await c.click('#cdCopy');
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();await f.waitForSelector('#lpOk');
  assert.equal(await f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).filter(d=>d&&d.letter).length),0,'no import before the normal confirmation');
  await f.click('#lpOk');await f.waitForFunction(()=>!document.getElementById('lpOv'));
  let saved=[];for(let i=0;i<70&&!saved.length;i++){saved=await f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).filter(d=>d&&d.letter).map(d=>[d.letter.issue,d.trainings.length]));if(!saved.length)await page.waitForTimeout(100);}
  assert.deepEqual(saved,[[3,3]]);
  await page.evaluate(()=>window.__psShowApp('community'));await c.waitForSelector('[data-letter-reader="3"]');
  await c.locator('[data-letter-back]').first().click();await c.waitForSelector('.pl-row');assert.deepEqual(await ids(),[3],'the search is retained on return');
  await c.fill('#commSearch','__없는_문장__');await c.waitForSelector('[data-letter-clear]');await c.click('[data-letter-clear]');await c.waitForFunction(()=>document.querySelectorAll('.pl-row').length===46);
  await c.click('[data-letter="1"]');await c.waitForSelector('[data-letter-reader="1"]');assert.equal(await c.locator('.pl-play').count(),0);assert.match(await c.locator('#pl-training').textContent(),/연결된 훈련 세션이 없습니다/);
  await c.locator('[data-letter-back]').first().click();await c.click('[data-letter="46"]');await c.waitForSelector('[data-letter-reader="46"]');
  assert.ok((await c.locator('.pl-body').textContent()).includes(letter(46).pieces[2].title),'future-dated prepared text is readable in full');
  assert.equal(await c.locator('.pl-play').count(),3);
  const pendingPlay=c.locator('[data-letter-play="46"][data-training="0"]');await pendingPlay.click();
  for(let i=0;i<50&&!packResolve;i++)await page.waitForTimeout(100);assert.ok(packResolve);
  const detachedButton=await pendingPlay.elementHandle();await c.locator('[data-letter-back]').first().click();
  packResolve();await c.waitForFunction(button=>!button.hasAttribute('aria-busy'),detachedButton);
  assert.equal(await c.locator('#cvMask.on').count(),0,'a late training response cannot open after returning to the list');
  assert.equal(await c.locator('.pl-row').count(),46);
  await c.click('[data-letter="43"]');await c.waitForSelector('[data-letter-retry]');detailDown=false;await c.click('[data-letter-retry]');await c.waitForSelector('[data-letter-reader="43"]');
  await c.locator('[data-letter-back]').first().click();await c.click('[data-letter="42"]');
  for(let i=0;i<50&&!lateResolve;i++)await page.waitForTimeout(100);assert.ok(lateResolve);
  await c.click('#prTabCoach');lateResolve();for(let i=0;i<50&&!lateDone;i++)await page.waitForTimeout(100);
  assert.equal(await c.locator('.pl-reader').count(),0,'a late body cannot paint over the coach tab');
  assert.equal(await c.locator('body').evaluate(e=>e.classList.contains('pr-letters')),false);
  await c.click('#prTabProc');await c.waitForSelector('[data-letter-reader="42"]');
  await c.click('#prTabFifa');await c.waitForSelector('.fi-card');assert.equal(await c.locator('.pl-reader').count(),0);
  assert.equal(await c.locator('#txBar').isVisible(),true,'FIFA keeps its existing filters');
  assert.deepEqual(writes,[],'reading and importing letter packs never creates public community posts or counters');
  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,size,passed:true,letters:46,completeArticles:138,trainingSessions:45,imported:saved}));
}catch(e){console.error(e);throw e;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
