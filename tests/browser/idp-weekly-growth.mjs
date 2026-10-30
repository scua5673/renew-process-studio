import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/* Synthetic accounts only; external requests are blocked. */
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'supported browser engine');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/idp-weekly-growth');
fs.mkdirSync(out,{recursive:true});
const COACH='fixture-weekly-coach',WID='fixture-weekly-team',A='fixture-weekly-a',B='fixture-weekly-b';
const players=[{id:'p-a',name:'가상 선수 A',num:'8',posId:'cm',levels:{},profile:{},meetings:[]},{id:'p-b',name:'가상 선수 B',num:'11',posId:'cm',levels:{},profile:{},meetings:[]}];
const positions=[{id:'cm',name:'CM',req:{},role:{}}];
const TODAY='2026-10-29',WEEK='2026-10-26',ACTION='볼 받기 전에 뒤쪽 압박 확인하기';
const docA={v:1,profile:{name:'가상 선수 A'},selfEval:{levels:{}},trainings:[{id:'t-a',title:'방향 전환 후 패스',days:['목'],time:'17:30'}],
  vision:{statement:'주변을 읽고 전진을 돕는 미드필더',behaviors:[{id:'scan',text:ACTION}],focusId:'scan',revision:'vision-a'},
  focusByWk:{[WEEK]:{text:ACTION}},log:{'2026-10-27':{memo:'받기 전에 돌아보니 뒤에 수비가 있었다.',try:1},'2026-10-29':{memo:'첫 터치 전에 왼쪽 공간을 확인했다.',try:2}}};
const documents={
  ['cs_idp_v1_'+A]:docA,['cs_idp_v1_'+B]:{v:1,profile:{name:'가상 선수 B'},log:{}},
  ['cs_idp_pub_v1_'+A]:{reviews:[{id:'review-a',at:'2026-09-25',nextAt:'2026-11-06'}],reacts:{'day:2026-10-29':{h:1,hBy:'가상 이전 코치',hAt:1}}},
  process_coach_v1:{v:1,weeks:{'0':[{}, {}, {}, {trainings:[{time:'15:00',aims:'중앙에서 압박 벗어나기',place:'운동장'}]}, {}, {}, {}]}},
  scout_tool_v1:{players,positions},
  cs_perms_v1:{v:1,defaultRole:'player',members:{[COACH]:{role:'executive'},[A]:{role:'player',playerId:'p-a'},[B]:{role:'player',playerId:'p-b'}}}
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  let file;
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(pathname==='/fixture-idp-team.html'){
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}iframe{display:block}</style><script>window.addEventListener("message",function(e){var f=document.getElementById("fixtureIDP"),d=e.data||{};if(!f||e.source!==f.contentWindow||e.origin!==location.origin)return;if(d.source==="idp"&&d.type==="teamEvalList")f.contentWindow.postMessage(Object.assign({source:"app",type:"teamEvalListAck",requestId:d.requestId,ok:true,editable:true,groups:[],ex:{}},JSON.parse(localStorage.getItem("scout_tool_v1"))),location.origin);});</script><iframe id="fixtureIDP" src="/studio/idp.html?fixture=weekly-growth"></iframe>');
      return;
    }
    file=path.resolve(root,'.'+pathname);
  }catch{response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  try{response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(fs.readFileSync(file));}
  catch{response.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;

async function newContext(browser,uid,seedDocs){
  const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await context.addInitScript(({uid,wid,documents})=>{
    if(!localStorage.getItem('fixture-weekly-growth-seeded')){
      localStorage.setItem('fixture-weekly-growth-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-not-a-real-token'}));
      localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner',name:'가상 목표 확인 팀'}]));
      localStorage.setItem('cs_lang','ko');
      if(!documents['cs_idp_v1_'+uid])localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify({v:1,profile:{name:'가상 코치'},selfEval:{levels:{}},trainings:[],log:{}}));
      for(const [key,doc] of Object.entries(documents))localStorage.setItem(key,JSON.stringify(doc));
    }
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>true,keyReady:k=>['process_coach_v1','scout_tool_v1'].includes(k),syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){},displayName:()=>'가상 코치'};
  },{uid,wid:WID,documents:seedDocs});
  return context;
}
const raw=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
const result={engine,cases:[],errors:[]};let browser;
async function open(uid,seed){
  const context=await newContext(browser,uid,seed),page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>{if(!/ResizeObserver loop/.test(e.message))result.errors.push(e.message);});
  await page.clock.setFixedTime(new Date(TODAY+'T14:00:00+09:00'));
  await page.goto(base+'/fixture-idp-team.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('fixtureIDP')?.contentWindow.document.getElementById('wrap')?.children.length>0);
  const frame=page.frame({url:/\/studio\/idp\.html\?fixture=weekly-growth$/});assert.ok(frame);
  await page.evaluate(coach=>document.getElementById('fixtureIDP').contentWindow.postMessage(coach?{type:'openSquad'}:{type:'openPersonal',layer:'home'},location.origin),uid===COACH);
  await frame.locator('.wg-root').waitFor();return {context,page,frame};
}
try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  const privateKey='cs_idp_v1_'+A,pubKey='cs_idp_pub_v1_'+A;
  let playerDoc,coachPub;
  {
    let {context,page,frame}=await open(A,documents);
    assert.match(await frame.locator('.wg-focus').innerText(),new RegExp(ACTION));
    assert.match(await frame.locator('.wg-schedule').innerText(),/중앙에서 압박 벗어나기/,'real team schedule');
    await frame.locator('.wg-personal summary').click();assert.match(await frame.locator('.wg-personal').innerText(),/방향 전환 후 패스/);await frame.locator('.wg-personal summary').click();
    assert.equal(await frame.locator('[data-wg-attempt="1"]').getAttribute('aria-pressed'),'true');
    assert.equal((await raw(page,privateKey)).log[TODAY].try,2,'reading preserves legacy continue value');
    await frame.locator('[data-wg-attempt="none"]').click();
    let lg=(await raw(page,privateKey)).log[TODAY];assert.equal(lg.try,undefined);assert.equal(lg.tryOpportunity,false);
    await frame.locator('[data-wg-attempt="1"]').click();
    lg=(await raw(page,privateKey)).log[TODAY];assert.equal(lg.try,1);assert.equal(lg.tryOpportunity,undefined);assert.equal(lg.visionEvidence.text,ACTION);
    await frame.locator('#wg-scene').fill('패스가 오기 전에 어깨 너머를 보고 빈 공간으로 첫 터치했다.');
    await frame.locator('[data-wg-save="memo"]').click();
    await frame.locator('#wg-next').fill('다음 훈련에서는 패스가 출발할 때 한 번 더 확인하기.');
    await frame.locator('[data-wg-save="next"]').click();
    playerDoc=await raw(page,privateKey);assert.ok(playerDoc.log[TODAY].next);assert.equal(playerDoc.log['2026-10-27'].memo,docA.log['2026-10-27'].memo);
    await page.reload();await page.frameLocator('#fixtureIDP').locator('#wg-scene').waitFor();frame=page.frame({url:/\/studio\/idp\.html\?fixture=weekly-growth$/});assert.equal(await frame.locator('#wg-scene').inputValue(),playerDoc.log[TODAY].memo);
    await page.screenshot({path:path.join(out,'player-desktop.png'),fullPage:true});
    await page.setViewportSize({width:375,height:900});
    assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'player no horizontal overflow');
    await page.screenshot({path:path.join(out,'player-mobile.png'),fullPage:true});
    await frame.evaluate(()=>document.body.classList.add('fmdark'));await page.waitForTimeout(400);
    await page.screenshot({path:path.join(out,'player-dark.png'),fullPage:true});
    await frame.locator('[data-wg-go="cal"]').click();await frame.locator('#dayMemo').waitFor();
    assert.equal(await frame.locator('#dayMemo').inputValue(),playerDoc.log[TODAY].memo,'same diary content');
    result.cases.push('player-save-reload-diary-and-layout');await context.close();
  }
  {
    const seed={...documents,[privateKey]:playerDoc};const {context,page,frame}=await open(COACH,seed);
    await frame.locator('#wg-question').waitFor();
    assert.equal(await frame.locator('[data-wg-root]').count(),1);
    await frame.locator('.wg-legacy>summary').click();await frame.locator('[data-sqw="1"]').click();
    assert.equal(await frame.locator('.wg-legacy').evaluate(el=>el.open),true,'legacy week view remains open across renders');
    await frame.locator('.wg-legacy>summary').click();
    const before=await raw(page,privateKey);
    await frame.locator('#wg-question').fill('그때 뒤쪽 수비와 빈 공간 중 무엇이 먼저 보였어?');
    await frame.locator('#wg-check').fill('2026-10-31');
    await frame.locator('[data-wg-player="p-b"]').click();assert.equal(await frame.locator('#wg-question').count(),0,'no imaginary scene for empty player');
    await frame.locator('[data-wg-player="p-a"]').click();assert.match(await frame.locator('#wg-question').inputValue(),/무엇이 먼저/,'draft is scoped to player');
    await frame.locator('[data-wg-send]').click();coachPub=await raw(page,pubKey);
    assert.equal(coachPub.reacts['day:'+TODAY].nextAt,'2026-10-31');assert.equal(coachPub.reacts['day:'+TODAY].h,1,'preserve like');
    assert.deepEqual(await raw(page,privateKey),before,'coach never writes player private IDP');
    await frame.evaluate(()=>document.querySelector('.stage').scrollTop=0);await page.screenshot({path:path.join(out,'coach-desktop.png')});
    await page.setViewportSize({width:375,height:900});assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'coach no horizontal overflow');
    await frame.locator('#wg-question').fill('휴대폰에서 이어 쓰는 질문');
    await frame.getByRole('combobox',{name:'성장 카드를 볼 선수'}).selectOption('p-b');
    assert.equal(await frame.locator('#wg-question').count(),0,'phone selects the player without a scene');
    await frame.getByRole('combobox',{name:'성장 카드를 볼 선수'}).selectOption('p-a');
    assert.equal(await frame.locator('#wg-question').inputValue(),'휴대폰에서 이어 쓰는 질문','phone picker preserves each player draft');
    assert.equal(await frame.getByRole('combobox',{name:'성장 카드를 볼 선수'}).evaluate(e=>e===document.activeElement),true,'selection keeps keyboard focus');
    await frame.evaluate(()=>document.querySelector('.stage').scrollTop=0);
    await page.screenshot({path:path.join(out,'coach-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:1000});
    // A concurrent coach changes this reply while the composer is focused.
    await frame.locator('#wg-question').fill('내가 쓰던 질문');
    await page.evaluate(({key,day})=>{const d=JSON.parse(localStorage.getItem(key));d.reacts['day:'+day].t='다른 코치의 최신 질문';localStorage.setItem(key,JSON.stringify(d));},{key:pubKey,day:TODAY});
    await frame.locator('[data-wg-send]').click();assert.equal((await raw(page,pubKey)).reacts['day:'+TODAY].t,'다른 코치의 최신 질문');assert.equal(await frame.locator('#wg-question').inputValue(),'내가 쓰던 질문');
    await frame.locator('[data-wg-player="p-b"]').click();await frame.locator('[data-wg-player="p-a"]').click();
    assert.equal(await frame.locator('[data-wg-send]').isDisabled(),true);
    await frame.locator('[data-wg-reload]').click();assert.equal(await frame.locator('#wg-question').inputValue(),'다른 코치의 최신 질문');
    // Storage failure does not clear a submitted draft or report success.
    await frame.locator('#wg-question').fill('저장 실패에도 남을 질문');
    await frame.evaluate(key=>{window.fixtureStorage=localStorage;Object.defineProperty(window,'localStorage',{configurable:true,value:new Proxy(window.fixtureStorage,{get(target,prop){if(prop==='setItem')return function(k,v){if(k===key)throw new Error('fixture quota');return target.setItem(k,v);};const v=target[prop];return typeof v==='function'?v.bind(target):v;}})});},pubKey);
    await frame.locator('[data-wg-send]').click();assert.equal(await frame.locator('#wg-question').inputValue(),'저장 실패에도 남을 질문');assert.match(await frame.locator('.wg-status').innerText(),/확인하지 못/);
    await frame.evaluate(()=>{Object.defineProperty(window,'localStorage',{configurable:true,value:window.fixtureStorage});});
    // Invalid public data must not be replaced with a fresh empty document.
    const validPub=await raw(page,pubKey);
    await frame.evaluate(key=>{localStorage.setItem(key,'[]');document.querySelector('[data-wg-send]').click();},pubKey);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),pubKey),'[]');
    await frame.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:pubKey,value:validPub});
    // A changed cache owner makes old callbacks unusable.
    const beforeSeal=await raw(page,pubKey);
    await page.evaluate(()=>localStorage.setItem('ps_cache_owner_v1','{"v":1,"uid":"another","wid":"another"}'));
    await frame.locator('[data-wg-send]').click();assert.deepEqual(await raw(page,pubKey),beforeSeal);
    result.cases.push('coach-question-private-preservation-draft-stale-quota-owner');await context.close();
  }
  {
    const {context,frame}=await open(A,{...documents,[privateKey]:playerDoc,[pubKey]:coachPub});
    assert.match(await frame.locator('.wg-question blockquote').innerText(),/무엇이 먼저/);assert.match(await frame.locator('.wg-question').innerText(),/10.31/);
    result.cases.push('player-receives-scene-question');await context.close();
  }
  {
    const {context,page,frame}=await open(A,{...documents,[privateKey]:{...docA,log:{}}});
    await frame.locator('[data-wg-attempt="none"]').click();
    assert.deepEqual((await raw(page,privateKey)).log[TODAY],{tryOpportunity:false},'no-opportunity-only day is retained');
    await frame.locator('[data-wg-go="cal"]').click();await frame.locator('[data-td-try="1"]').click();
    await page.waitForTimeout(350);assert.equal((await raw(page,privateKey)).log[TODAY].tryOpportunity,undefined,'legacy diary action clears no-opportunity flag');
    result.cases.push('empty-day-no-opportunity-and-legacy-diary');await context.close();
  }
  assert.deepEqual(result.errors,[]);console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
