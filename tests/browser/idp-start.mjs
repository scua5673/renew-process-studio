import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/idp-start');
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname));}
  catch{response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  try{response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(fs.readFileSync(file));}
  catch{response.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
const UID='fixture-idp-player',WID='fixture-idp-team',KEY='cs_idp_v1_'+UID;
const TODAY='2026-09-12',NEXT='2026-09-13';
const STATEMENT='동료와 함께 기회를 만드는 선수';
const ACTION='공이 오기 전에 어깨 너머 공간을 확인한다';
const NEXT_ACTION='패스한 뒤 동료를 도울 공간으로 움직인다';
const MEMO='작은 경기에서 공을 받기 전에 뒤를 보고 빈 동료에게 패스했다.';

async function newContext(browser,spec){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,
    isMobile:!!spec.mobile,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  // A fresh context and a fake session are used throughout. No real profile,
  // authentication service or remote origin is accessed.
  await context.addInitScript(({uid,wid})=>{
    if(!localStorage.getItem('fixture-idp-seeded')){
      localStorage.setItem('fixture-idp-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-not-a-real-token'}));
      localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'member',name:'가상 선수 팀'}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[uid]:{role:'player'}}}));
      localStorage.setItem('cs_lang','ko');
      localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify({v:1,profile:{name:'가상 선수',pos:'CM'},
        selfEval:{levels:{},strengths:'',improve:'',seasonGoal:''},trainings:[],log:{}}));
    }
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>true,
      keyReady:()=>true,syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){}};
  },{uid:UID,wid:WID});
  return context;
}
async function ready(page){
  await page.locator('#layers button[data-l="goal"]').waitFor({state:'visible'});
  await page.waitForFunction(()=>!!window.PSIDPEvidence&&document.getElementById('wrap')?.children.length>0);
}
async function tab(page,layer){
  await page.locator(`#layers button[data-l="${layer}"]`).click();
  await page.locator(`#layers button[data-l="${layer}"].on`).waitFor({state:'visible'});
}
async function today(page){
  await tab(page,'cal');
  await page.locator('#calSeg [data-v="day"]').click();
  await page.locator('#calToday').click();
}
async function read(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),KEY);}
async function saved(page,expect){
  await page.waitForFunction(({key,expect})=>{
    const doc=JSON.parse(localStorage.getItem(key)||'null');
    if(!doc)return false;
    if(expect.action&&doc.vision?.behaviors?.[0]?.text!==expect.action)return false;
    if(expect.try!==undefined&&doc.log?.[expect.date]?.try!==expect.try)return false;
    if(expect.memo&&doc.log?.[expect.date]?.memo!==expect.memo)return false;
    return true;
  },{key:KEY,expect});
  return read(page);
}
async function capture(page,spec,name,selector){
  await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState!=='running'||animation.effect?.getComputedTiming().iterations===Infinity));
  if(selector)await page.locator(selector).first().scrollIntoViewIfNeeded();
  const layout=await page.evaluate(selector=>{
    const element=document.querySelector(selector||'#wrap'),r=element.getBoundingClientRect();
    return {width:innerWidth,left:r.left,right:r.right,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth};
  },selector);
  assert.ok(layout.left>=-1&&layout.right<=layout.width+1,`${spec.name} ${name} fits horizontally`);
  assert.ok(layout.scrollWidth<=layout.clientWidth+1,`${spec.name} ${name} does not overflow horizontally`);
  await page.screenshot({path:path.join(out,`${spec.name}-${name}.png`),animations:'disabled'});
  return layout;
}
async function startAndWrite(page,spec,result){
  await today(page);await page.locator('#calPrev').click(); // prove saving resets an old calendar date
  await tab(page,'goal');
  assert.equal(await page.locator('.idp-start-more').getAttribute('open'),null);
  result.emptyLayout=await capture(page,spec,'empty-goal','.vs-card');
  const initial=await read(page);
  await page.locator('[data-vs-edit]').click();
  await page.locator('#vsStatement').fill(STATEMENT);
  await page.locator('[data-vs-beh="0"]').fill(ACTION);
  assert.equal(await page.locator('[data-vs-beh="1"]').isVisible(),false);
  assert.equal(await page.locator('#vsReason').isVisible(),false);
  assert.equal(await page.locator('[data-vs-save]').count(),1);
  result.startLayout=await capture(page,spec,'one-action-start','.vs-card');
  await page.locator('[data-vs-cancel]').click();
  assert.deepEqual(await read(page),initial,'cancel does not persist the starter draft');
  result.cases.push('single-action-start-and-cancel');

  await page.locator('[data-vs-edit]').click();
  await page.locator('#vsStatement').fill(STATEMENT);
  await page.locator('[data-vs-beh="0"]').fill(ACTION);
  await page.evaluate(key=>{
    window.fixtureStorageDescriptor=Object.getOwnPropertyDescriptor(window,'localStorage');
    window.fixtureFailureCount=0;const real=window.localStorage;
    const blocked=new Proxy(real,{get(target,property){
      if(property==='setItem')return function(k,value){if(k===key){fixtureFailureCount++;throw new DOMException('fixture quota','QuotaExceededError');}return real.setItem(k,value);};
      const value=Reflect.get(target,property,target);return typeof value==='function'?value.bind(target):value;
    }});
    Object.defineProperty(window,'localStorage',{configurable:true,value:blocked});
  },KEY);
  await page.locator('[data-vs-save]').click();
  assert.ok(await page.evaluate(()=>fixtureFailureCount>0),'the failure fixture reached the actual local write');
  assert.equal(await page.locator('#vsStatement').inputValue(),STATEMENT);
  assert.equal(await page.locator('.vs-card.editing').isVisible(),true);
  assert.deepEqual(await read(page),initial,'failed write does not alter the document');
  await page.evaluate(()=>{Object.defineProperty(window,'localStorage',fixtureStorageDescriptor);});
  result.cases.push('failed-save-keeps-draft-and-position');
  await page.locator('[data-vs-save]').click();
  await page.locator('#dayMemo').waitFor({state:'visible'});
  assert.equal(await page.locator('#calSeg [data-v="day"]').getAttribute('class'),'on');
  let doc=await saved(page,{action:ACTION});
  assert.equal(doc.vision.behaviors.length,1);assert.equal(doc.qgoal,undefined);assert.equal(doc.focusByWk,undefined);
  result.cases.push('saved-action-opens-today-without-new-goal');

  assert.equal(await page.locator('[data-td-try]').count(),3);
  assert.equal(await page.locator('#dayMemo').count(),1);
  assert.equal(await page.locator('.idp-day-question').count(),1);
  assert.equal(await page.locator('.idp-day-direction').getAttribute('open'),null);
  await page.locator('[data-td-try="1"]').click();
  await page.locator('#dayMemo').fill(MEMO);
  doc=await saved(page,{date:TODAY,try:1,memo:MEMO});
  assert.deepEqual(doc.log[TODAY].visionEvidence,{id:doc.vision.behaviors[0].id,text:ACTION,revision:doc.vision.revision});
  result.todayLayout=await capture(page,spec,'today-one-question','.ol-sec:not(.ol-wrapsec)');
  result.cases.push('single-daily-question-saves-try-memo-and-snapshot');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page);
  assert.equal(await page.locator('#dayMemo').inputValue(),MEMO);
  assert.match(await page.locator('[data-td-try="1"]').getAttribute('class'),/\bon\b/);
  assert.deepEqual((await read(page)).log[TODAY],doc.log[TODAY]);
  result.cases.push('daily-auto-save-survives-reload');
  return doc;
}
async function historyAndWeek(page,spec,result,first){
  await tab(page,'goal');await page.locator('[data-vs-edit]').click();
  await page.locator('[data-vs-beh="0"]').fill(NEXT_ACTION);
  await page.locator('[data-vs-save]').click();
  await page.locator('#dayMemo').waitFor({state:'visible'});
  let doc=await saved(page,{action:NEXT_ACTION});
  assert.equal(doc.vision.behaviors[0].id,first.vision.behaviors[0].id,'editing preserves behavior identity');
  assert.notEqual(doc.vision.revision,first.vision.revision);
  assert.equal(doc.vision.history.at(-1).revision,first.vision.revision);
  assert.deepEqual(doc.log[TODAY].visionEvidence,first.log[TODAY].visionEvidence);
  await page.locator('[data-td-try="2"]').click();
  doc=await saved(page,{date:TODAY,try:2});
  assert.deepEqual(doc.log[TODAY].visionEvidence,first.log[TODAY].visionEvidence,'changing try does not rewrite an earlier snapshot');
  assert.equal(await page.locator('.idp-day-evidence .ide-action').innerText(),ACTION);
  assert.equal(await page.locator('.ol-sen').last().innerText(),NEXT_ACTION);
  result.cases.push('direction-edit-and-try-change-preserve-old-evidence');

  await page.clock.setFixedTime(NEXT+'T12:00:00+09:00');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page);
  const weekly=page.locator('.ol-wrapsec .idp-evidence-week');
  await weekly.locator('summary').click();
  assert.ok((await weekly.innerText()).includes(ACTION));assert.ok((await weekly.innerText()).includes(MEMO));
  assert.ok((await weekly.innerText()).includes(STATEMENT));
  result.weeklyLayout=await capture(page,spec,'weekly-scenes','.ol-wrapsec .idp-evidence-week');
  result.cases.push('weekly-reflection-reads-saved-scene-and-direction');
  await page.locator('#calPrev').click();
  assert.equal(await page.locator('#wrap .idp-evidence .ide-action').first().innerText(),ACTION);
  assert.equal(await page.locator('#dayMemo').inputValue(),MEMO);
  result.pastLayout=await capture(page,spec,'past-day-evidence','#wrap .idp-evidence');
  await page.locator('#calSeg [data-v="week"]').click();
  const row=page.locator(`[data-wkgo="${TODAY}"]`);
  assert.ok((await row.innerText()).includes(ACTION));assert.ok((await row.innerText()).includes(MEMO));
  result.cases.push('past-day-and-calendar-week-show-original-evidence');

  // This last fixture removes the current direction only: a historical snapshot
  // must remain readable even when its source direction/history is unavailable.
  await page.evaluate(key=>{const doc=JSON.parse(localStorage.getItem(key));delete doc.vision;localStorage.setItem(key,JSON.stringify(doc));},KEY);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page);
  await page.locator('#calPrev').click();
  assert.equal(await page.locator('#wrap .idp-evidence .ide-action').first().innerText(),ACTION);
  assert.equal((await read(page)).vision,undefined);
  result.cases.push('history-evidence-survives-missing-current-direction');
}

const results=[];let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [
    {name:'375-phone',width:375,height:812,touch:true,mobile:true},
    {name:'393-phone',width:393,height:852,touch:true,mobile:true},
    {name:'768-tablet',width:768,height:820,touch:true},
    {name:'1280-desktop',width:1280,height:900}
  ]){
    const result={viewport:spec.name,cases:[],pageErrors:[]};results.push(result);
    const context=await newContext(browser,spec),page=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',error=>result.pageErrors.push(error.stack||String(error)));
    try{
      await page.clock.setFixedTime(TODAY+'T12:00:00+09:00');
      await page.goto(base+'/studio/idp.html?fixture=first-action',{waitUntil:'domcontentloaded'});await ready(page);
      const first=await startAndWrite(page,spec,result);await historyAndWeek(page,spec,result,first);
      assert.deepEqual(result.pageErrors,[],'no uncaught application errors');result.ok=true;
    }catch(error){result.ok=false;result.error=error.stack||String(error);
      result.failureState=await page.evaluate(()=>({url:location.pathname,text:document.getElementById('wrap')?.innerText?.slice(0,10000)})).catch(()=>null);
      await page.screenshot({path:path.join(out,`${spec.name}-failure.png`),animations:'disabled'}).catch(()=>{});
    }finally{await context.close();}
  }
  const report={ok:results.every(result=>result.ok),build,method:'Fresh local Chrome contexts; synthetic player; all remote requests blocked; real IDP DOM and local persistence',results};
  fs.writeFileSync(path.join(out,'idp-start-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,output:out,results:results.map(({viewport,ok,cases,error})=>({viewport,ok,cases,error}))},null,2));
  if(!report.ok)process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
