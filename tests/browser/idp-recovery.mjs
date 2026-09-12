import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/idp-recovery');
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));}catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`,UID='fixture-recovery-player',WID='fixture-recovery-team',KEY='cs_idp_v1_'+UID;
const TODAY=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fixture={v:1,profile:{name:'가상 복구 선수',pos:'CM'},selfEval:{levels:{}},trainings:[],log:{[TODAY]:{memo:'처음 기록'}},
  vision:{statement:'함께 기회를 만드는 선수',reason:'동료를 돕기 위해',behaviors:[{id:'behavior-stable',text:'받기 전에 주변을 확인한다'}],focusId:'behavior-stable',revision:'vision-original',updatedAt:100,history:[]}};
async function context(browser,spec,locked=false){
  const c=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:!!spec.mobile,hasTouch:!!spec.mobile,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  await c.addInitScript(({uid,wid,key,fixture,locked})=>{
    if(!localStorage.getItem('fixture-recovery-seeded')){
      localStorage.setItem('fixture-recovery-seeded','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-token',rt:'fixture-refresh'}));localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'member',name:'가상 복구 팀'}]));localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));
      localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[uid]:{role:'player'}}}));localStorage.setItem(key,JSON.stringify(fixture));
    }
    window.fixtureLocked=locked;window.fixtureRejectWrites=false;
    const real=localStorage,set=real.setItem.bind(real),proxy=new Proxy(real,{get(target,property){if(property==='setItem')return function(k,v){if(window.fixtureRejectWrites&&(k===key||String(k).startsWith('ps_idp_edit_recovery_v1:')))throw new DOMException('synthetic quota','QuotaExceededError');return set(k,v);};const v=Reflect.get(target,property,target);return typeof v==='function'?v.bind(target):v;}});
    Object.defineProperty(window,'localStorage',{configurable:true,value:proxy});
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>!fixtureLocked,keyReady:()=>!fixtureLocked,syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){}};
  },{uid:UID,wid:WID,key:KEY,fixture,locked});return c;
}
async function ready(page){await page.waitForFunction(()=>window.PSIDPRecovery&&document.querySelector('#wrap')?.children.length>0);}
async function tab(page,layer){await page.locator(`#layers button[data-l="${layer}"]`).click();}
async function editDirection(page){await tab(page,'goal');await page.locator('[data-vs-edit]').click();await page.waitForFunction(()=>document.activeElement?.id==='vsStatement');}
async function today(page){await tab(page,'cal');await page.locator('#calSeg [data-v="day"]').click();await page.locator('#calToday').click();await page.locator('#dayMemo').waitFor({state:'visible'});}
async function read(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
async function records(page){return page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ps_idp_edit_recovery_v1:')).map(k=>({key:k,...JSON.parse(localStorage.getItem(k))})));}
async function waitPending(page){await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('ps_idp_edit_recovery_v1:')&&JSON.parse(localStorage.getItem(k)).pending));}
async function choose(page,value){for(const radio of await page.locator(`[data-idr-choice][value="${value}"]`).all())await radio.check();}
async function conflict(page,mine='내가 쓴 장면',remote='다른 창에서 쓴 장면'){
  await today(page);await page.evaluate(({key,date,mine,remote})=>{const el=document.getElementById('dayMemo');el.value=mine;el.dispatchEvent(new Event('input',{bubbles:true}));const doc=JSON.parse(localStorage.getItem(key));doc.log[date]={memo:remote};doc.profile.remote='같이 보존할 최신 프로필';localStorage.setItem(key,JSON.stringify(doc));},{key:KEY,date:TODAY,mine,remote});
  await page.locator('.idr-panel').waitFor({state:'visible'});
}
async function capture(page,spec,name){
  const el=page.locator('#idpRecovery');const geometry=await el.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,height:r.height};});
  assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1);assert.ok(geometry.scrollWidth<=geometry.clientWidth+1);
  const first=page.locator('.idr-notice b').first();await first.scrollIntoViewIfNeeded();assert.equal(await first.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),true,'recovery title is not covered by the fixed navigation');
  await page.screenshot({path:path.join(out,spec.name+'-'+name+'.png'),animations:'disabled'});return geometry;
}
async function run(page,spec){const cases=[],layouts={};
  await conflict(page);assert.match(await page.locator('.idr-panel').innerText(),/내가 쓴 장면/);assert.match(await page.locator('.idr-panel').innerText(),/다른 창에서 쓴 장면/);
  assert.equal((await read(page)).log[TODAY].memo,'다른 창에서 쓴 장면');assert.equal(await page.locator('#wrap').evaluate(el=>el.inert),true);cases.push('actual-daily-input-conflict-preserves-both');
  layouts.conflict=await capture(page,spec,'daily-conflict');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.locator('[data-idr-open]').click();assert.match(await page.locator('.idr-panel').innerText(),/내가 쓴 장면/);cases.push('pending-draft-survives-reload');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.locator('[data-idr-open]').click();assert.match(await page.locator('.idr-panel').innerText(),/내가 쓴 장면/);assert.equal((await read(page)).log[TODAY].memo,'다른 창에서 쓴 장면');cases.push('unresolved-draft-survives-repeated-reload-without-pagehide-clearing');
  await choose(page,'mine');await page.evaluate(({key,date})=>{const d=JSON.parse(localStorage.getItem(key));d.log[date].memo='비교 후 다시 바뀐 장면';d.log['2001-01-01']={memo:'다른 날짜 기록 유지'};localStorage.setItem(key,JSON.stringify(d));},{key:KEY,date:TODAY});
  await page.locator('[data-idr-apply]').click();assert.equal((await read(page)).log[TODAY].memo,'비교 후 다시 바뀐 장면');assert.equal(await page.locator('[data-idr-choice]:checked').count(),0);cases.push('source-change-requires-new-comparison');
  await choose(page,'mine');await page.locator('[data-idr-apply]').click();let saved=await read(page);assert.equal(saved.log[TODAY].memo,'내가 쓴 장면');assert.equal(saved.log['2001-01-01'].memo,'다른 날짜 기록 유지');assert.equal(saved.profile.remote,'같이 보존할 최신 프로필');
  let rec=(await records(page))[0];assert.ok(!rec.pending&&rec.resolved);assert.ok(JSON.stringify(rec.resolved).includes('비교 후 다시 바뀐 장면'));assert.ok(JSON.stringify(rec.resolved).includes('내가 쓴 장면'));cases.push('selected-patch-preserves-unrelated-latest-and-resolution-backup');
  await page.locator('.idr-history summary').click();await page.waitForTimeout(900);assert.equal(await page.locator('.idr-history').getAttribute('open'),'');assert.match(await page.locator('.idr-history').innerText(),/비교 후 다시 바뀐 장면/);await page.locator('.idr-history summary').click();cases.push('last-recovery-is-readable-and-stays-open-across-readiness-check');
  await today(page);await page.locator('#dayMemo').fill('충돌 없이 저장한 장면');await page.waitForFunction(({key,date})=>JSON.parse(localStorage.getItem(key)).log[date]?.memo==='충돌 없이 저장한 장면',{key:KEY,date:TODAY});assert.equal((await records(page)).some(r=>r.pending),false);cases.push('normal-confirmed-save-clears-pending');
  await page.evaluate(()=>{const el=document.getElementById('dayMemo'),before=el.value;el.value='잠깐 바꾼 내용';el.dispatchEvent(new Event('input',{bubbles:true}));el.value=before;el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(300);assert.equal((await records(page)).some(r=>r.pending),false);cases.push('reverted-edit-does-not-leave-stale-draft');
  await editDirection(page);await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));d.profile.remote='방향 편집 중 들어온 프로필';localStorage.setItem(key,JSON.stringify(d));},KEY);await page.locator('[data-vs-cancel]').click();
  await conflict(page,'취소 뒤 내 일지','취소 뒤 원격 일지');assert.equal(await page.locator('.idr-row').count(),1,'adopted remote profile is not recategorized as my edit');await choose(page,'mine');await page.locator('[data-idr-apply]').click();cases.push('vision-cancel-resets-base-without-claiming-remote-profile-as-own-edit');
  await editDirection(page);await page.locator('#vsStatement').fill('새로 쓰다 멈춘 내 방향');await page.locator('[data-vs-beh="0"]').fill('패스 뒤 도울 공간으로 움직인다');await waitPending(page);
  assert.equal(await page.locator('#wrap').evaluate(el=>el.inert),false,'a completed earlier recovery does not lock the next direction draft');assert.equal(await page.locator('[data-vs-beh="0"]').inputValue(),'패스 뒤 도울 공간으로 움직인다');assert.equal((await records(page))[0].pending.ops.find(op=>op.path[0]==='vision').after.value.behaviors[0].text,'패스 뒤 도울 공간으로 움직인다');
  assert.equal((await read(page)).vision.revision,'vision-original');await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.locator('[data-idr-open]').click();assert.match(await page.locator('.idr-panel').innerText(),/새로 쓰다 멈춘 내 방향/);cases.push('vision-draft-reload-keeps-original-uncommitted');
  await page.locator('[data-idr-resume]').click();assert.equal(await page.locator('#vsStatement').inputValue(),'새로 쓰다 멈춘 내 방향');assert.equal(await page.locator('[data-vs-beh="0"]').inputValue(),'패스 뒤 도울 공간으로 움직인다');await page.locator('[data-vs-save]').click();await page.locator('#dayMemo').waitFor({state:'visible'});saved=await read(page);assert.equal(saved.vision.behaviors[0].id,'behavior-stable');assert.equal(saved.vision.behaviors[0].text,'패스 뒤 도울 공간으로 움직인다');assert.notEqual(saved.vision.revision,'vision-original');assert.equal(saved.vision.history.at(-1).revision,'vision-original');assert.equal((await records(page)).some(r=>r.pending),false);cases.push('vision-resume-keeps-action-text-id-and-revision-history');
  await editDirection(page);await page.locator('#vsStatement').fill('충돌 뒤 내가 고른 방향');
  await page.evaluate(key=>{const d=JSON.parse(localStorage.getItem(key));d.vision.statement='다른 기기에서 고른 방향';d.vision.revision='remote-vision';d.log['2002-02-02']={memo:'방향과 무관한 최신 일지'};localStorage.setItem(key,JSON.stringify(d));},KEY);
  await page.locator('[data-vs-save]').click();await page.locator('.idr-panel').waitFor({state:'visible'});layouts.vision=await capture(page,spec,'vision-conflict');await choose(page,'mine');await page.locator('[data-idr-apply]').click();saved=await read(page);
  assert.equal(saved.vision.statement,'충돌 뒤 내가 고른 방향');assert.notEqual(saved.vision.revision,'remote-vision');assert.equal(saved.vision.history.at(-1).revision,'remote-vision');assert.equal(saved.log['2002-02-02'].memo,'방향과 무관한 최신 일지');cases.push('vision-conflict-explicit-resolution-preserves-latest-history');
  await conflict(page,'잠금 전 내 입력','잠금 전 최신 내용');const keys=(await records(page)).map(r=>r.key);await page.evaluate(()=>{fixtureLocked=true;window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:false}}));});
  assert.equal(await page.locator('#idpRecovery').isVisible(),false);assert.equal(await page.locator('#wrap').innerText(),'');assert.equal((await records(page)).some(r=>r.pending),true);cases.push('lock-hides-private-recovery-immediately-without-dropping-draft');
  await page.evaluate(()=>{fixtureLocked=false;window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:true}}));});await page.locator('[data-idr-open]').click();assert.match(await page.locator('.idr-panel').innerText(),/잠금 전 내 입력/);
  await choose(page,'latest');await page.locator('[data-idr-apply]').click();assert.equal((await read(page)).log[TODAY].memo,'잠금 전 최신 내용');cases.push('explicit-latest-choice-keeps-draft-in-last-recovery-record');
  await today(page);await page.evaluate(()=>{fixtureRejectWrites=true;const el=document.getElementById('dayMemo');el.value='저장소 실패 중 화면에 보관할 입력';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('.idr-panel').waitFor({state:'visible'});assert.match(await page.locator('#idpRecovery').innerText(),/저장하지 못|화면에/);
  await page.evaluate(()=>{fixtureLocked=true;window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:false}}));fixtureRejectWrites=false;fixtureLocked=false;window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:true}}));});await page.locator('[data-idr-open]').click();assert.match(await page.locator('.idr-panel').innerText(),/저장소 실패 중 화면에 보관할 입력/);await choose(page,'mine');await page.locator('[data-idr-apply]').click();assert.equal((await read(page)).log[TODAY].memo,'저장소 실패 중 화면에 보관할 입력');cases.push('storage-failure-ram-draft-survives-lock-unlock-and-retry');
  await conflict(page,'손상 원문 앞의 내 입력','손상 전 최신');await page.evaluate(key=>localStorage.setItem(key,'{broken document'),KEY);await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.locator('[data-idr-open]').click();assert.equal(await page.locator('[data-idr-apply]').isDisabled(),true);assert.match(await page.locator('.idr-panel').innerText(),/손상 원문 앞의 내 입력/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),'{broken document');cases.push('malformed-latest-remains-untouched-and-draft-readable');
  await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key:KEY,fixture});await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.locator('[data-idr-open]').click();await choose(page,'latest');await page.locator('[data-idr-apply]').click();
  await conflict(page,'계정 변경 전 내 입력','계정 변경 전 최신 내용');await page.evaluate(()=>{localStorage.setItem('ps_sync_session',JSON.stringify({uid:'other-fixture',at:'fixture-token',rt:'fixture-refresh'}));window.dispatchEvent(new StorageEvent('storage',{key:'ps_sync_session'}));});assert.equal(await page.locator('#idpRecovery').isVisible(),false);assert.equal(await page.locator('#wrap').innerText(),'');assert.deepEqual((await records(page)).map(r=>r.key),keys);cases.push('account-change-does-not-expose-or-move-original-draft');
  return {cases,layouts};
}
let browser;const results=[];try{
  const type=process.env.PS_BROWSER_ENGINE==='webkit'?webkit:chromium;browser=await type.launch({headless:true,...(type===chromium&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [{name:'375-phone',width:375,height:812,mobile:true},{name:'393-phone',width:393,height:852,mobile:true},{name:'768-tablet',width:768,height:900},{name:'1280-desktop',width:1280,height:900}]){
    const c=await context(browser,spec),page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||String(e)));
    await page.goto(base+'/studio/idp.html?fixture=recovery',{waitUntil:'domcontentloaded'});await ready(page);const result=await run(page,spec);assert.deepEqual(errors,[]);results.push({viewport:spec.name,...result,errors});await c.close();
    const locked=await context(browser,spec,true),lockedPage=await locked.newPage();lockedPage.on('pageerror',e=>errors.push(String(e)));await lockedPage.goto(base+'/studio/idp.html?fixture=initial-lock',{waitUntil:'domcontentloaded'});await lockedPage.waitForFunction(()=>window.PSIDPRecovery);
    assert.equal(await lockedPage.locator('#wrap').innerText(),'');await lockedPage.evaluate(()=>{fixtureLocked=false;window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:true}}));});await ready(lockedPage);await today(lockedPage);assert.equal(await lockedPage.locator('#dayMemo').inputValue(),'처음 기록');result.cases.push('initially-locked-page-opens-for-same-owner-after-unlock');assert.deepEqual(errors,[]);await locked.close();
  }
  const report={ok:true,build,engine:process.env.PS_BROWSER_ENGINE||'chromium',date:TODAY,method:'Actual unmodified IDP input and button handlers in isolated local browser profiles; synthetic accounts only and all remote requests blocked.',cases:results.reduce((n,r)=>n+r.cases.length,0),results};fs.writeFileSync(path.join(out,'idp-recovery-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,build,cases:report.cases,viewports:results.length,output:out},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
