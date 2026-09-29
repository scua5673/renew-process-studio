import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/* 2.908 — 요청 «IDP 목표를 코치도 선수도 써줄 수 있게» · «선수가 루틴 썼을 때 코치에게 보이게».
   코치는 선수 문서(cs_idp_v1_<uid>)에 쓰지 않는다 — 제안은 코치 공개 문서(cs_idp_pub_v1_<uid>.goals[])로,
   선수가 «내 목표로»를 눌러 자기 12주 목표로 가져간다. 선수 루틴(rtDay)은 코치 «이야기»에 «루틴»으로 보인다.
   합성 팀 fixture 에서만 돈다(실계정·실서버 없음). */
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'supported browser engine');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/idp-coach-goals');
fs.mkdirSync(out,{recursive:true});
const COACH='fixture-goal-coach',WID='fixture-goal-team',A='fixture-goal-a';
const players=[{id:'p-a',name:'가상 선수 A',num:'8',posId:'cm',levels:{},profile:{},meetings:[]}];
const positions=[{id:'cm',name:'CM',req:{},role:{}}];
const at=Date.parse('2026-09-09T14:00:00+09:00');
const docA={v:1,profile:{name:'가상 선수 A'},selfEval:{levels:{}},trainings:[{title:'가상 개인 슈팅',days:['수'],time:'19:00',items:[]}],log:{},
  rtDay:{0:[{t:'07:00',s:'가상 아침 러닝'}],2:[{t:'06:30',s:'가상 스트레칭'}]},rtAt:at,
  qgoal:{start:'2026-09-07',theme:'전진',goals:[{id:'g1',t:'가상 기존 목표',sc:{}}],at}};
const documents={
  ['cs_idp_v1_'+A]:docA,
  scout_tool_v1:{players,positions},
  cs_perms_v1:{v:1,defaultRole:'player',members:{[COACH]:{role:'executive'},[A]:{role:'player',playerId:'p-a'}}}
};
const GOAL='가상 코치 제안 · 볼 받기 전 어깨 너머 두 번 보기';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  let file;
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(pathname==='/fixture-idp-team.html'){
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}iframe{display:block}</style><script>window.addEventListener("message",function(e){var f=document.getElementById("fixtureIDP"),d=e.data||{};if(!f||e.source!==f.contentWindow||e.origin!==location.origin)return;if(d.source==="idp"&&d.type==="teamEvalList")f.contentWindow.postMessage(Object.assign({source:"app",type:"teamEvalListAck",requestId:d.requestId,ok:true,editable:true,groups:[],ex:{}},JSON.parse(localStorage.getItem("scout_tool_v1"))),location.origin);});</script><iframe id="fixtureIDP" src="/studio/idp.html?fixture=coach-goals"></iframe>');
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
    if(!localStorage.getItem('fixture-coach-goals-seeded')){
      localStorage.setItem('fixture-coach-goals-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-not-a-real-token'}));
      localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner',name:'가상 목표 확인 팀'}]));
      localStorage.setItem('cs_lang','ko');
      if(!documents['cs_idp_v1_'+uid])localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify({v:1,profile:{name:'가상 코치'},selfEval:{levels:{}},trainings:[],log:{}}));
      for(const [key,doc] of Object.entries(documents))localStorage.setItem(key,JSON.stringify(doc));
    }
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>true,keyReady:()=>true,syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){},displayName:()=>'가상 코치'};
  },{uid,wid:WID,documents:seedDocs});
  return context;
}
const raw=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
const result={engine,cases:[],errors:[]};let browser;
try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  /* ── 1) 코치: 선수 A 의 IDP 목표 탭에서 목표 제안 · 이야기에 루틴 ── */
  let pub=null;
  {
    const context=await newContext(browser,COACH,documents),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-09-13T14:00:00+09:00'));
    await page.goto(base+'/fixture-idp-team.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('fixtureIDP')?.contentWindow.document.getElementById('wrap')?.children.length>0);
    const frame=page.frame({url:/\/studio\/idp\.html\?fixture=coach-goals$/});assert.ok(frame,'IDP iframe mounted');
    await page.evaluate(()=>document.getElementById('fixtureIDP').contentWindow.postMessage({type:'openSquad'},location.origin));
    await frame.locator('.sq-scope').waitFor({state:'visible'});
    await frame.locator('.sq-scope button').filter({hasText:/^선수$/}).click();
    await frame.locator('[data-sqe-p="p-a"]').click();
    await frame.locator('.sqe-modes [data-sqe-mode="story"]').click();
    await frame.locator('[data-sqst-f="rt"]').waitFor({state:'visible'});
    await frame.locator('[data-sqst-f="rt"]').click();
    const story=await frame.locator('.sqth').innerText();
    for(const x of ['루틴','가상 아침 러닝','가상 스트레칭','가상 개인 슈팅'])assert.ok(story.includes(x),'routine in coach story: '+x);
    result.cases.push('coach-story-shows-player-routine');
    /* 선수 앱 그대로 보기 → 목표 탭 */
    await frame.evaluate(()=>{ const b=document.querySelector('[data-sqst-f="all"]'); if(b)b.click(); });
    const go=frame.locator('.st-origin[data-st-go="goal"]').first();
    await go.click();
    await frame.locator('#layers [data-l="goal"].on').waitFor({state:'visible'});
    await frame.locator('.cg-card').waitFor({state:'visible'});
    assert.ok((await frame.locator('.cg-card').innerText()).includes('코치가 제안하는 목표'));
    const before=await raw(page,'cs_idp_v1_'+A);
    await frame.locator('[data-cg-in]').fill(GOAL);
    await frame.locator('[data-cg-due]').fill('2026-10-31');
    await frame.locator('[data-cg-add]').click();
    await page.waitForFunction(k=>{const r=JSON.parse(localStorage.getItem(k)||'null');return r&&Array.isArray(r.goals)&&r.goals.length===1;},'cs_idp_pub_v1_'+A);
    pub=await raw(page,'cs_idp_pub_v1_'+A);
    assert.equal(pub.goals[0].t,GOAL);assert.equal(pub.goals[0].due,'2026-10-31');assert.equal(pub.goals[0].by,'가상 코치');
    assert.deepEqual(await raw(page,'cs_idp_v1_'+A),before,'coach never writes the player document');
    assert.ok((await frame.locator('.cg-card').innerText()).includes(GOAL));
    await page.screenshot({path:path.join(out,engine+'-coach-goal.png')});
    result.cases.push('coach-proposes-goal-into-pub-mirror-only');
    await context.close();
  }
  /* ── 2) 선수: 목표 탭에 코치 목표 → «내 목표로» ── */
  {
    const docs=Object.assign({},documents,{['cs_idp_pub_v1_'+A]:pub});
    docs.cs_perms_v1={v:1,defaultRole:'player',members:{[COACH]:{role:'executive'},[A]:{role:'player',playerId:'p-a'}}};
    delete docs.scout_tool_v1;   /* 선수 기기는 팀 문서를 못 받는다 */
    const context=await newContext(browser,A,docs),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-09-13T14:00:00+09:00'));
    await page.goto(base+'/studio/idp.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('wrap')?.children.length>0);
    await page.locator('#layers [data-l="goal"]').click();
    await page.locator('.cg-card').waitFor({state:'visible'});
    const card=await page.locator('.cg-card').innerText();
    assert.ok(card.includes('코치가 적은 목표')&&card.includes(GOAL)&&card.includes('10/31까지'),'player sees the coach goal');
    assert.equal(await page.locator('[data-cg-in]').count(),0,'player cannot write into the coach proposal list');
    await page.locator('[data-cg-adopt]').click();
    await page.waitForFunction(k=>{const d=JSON.parse(localStorage.getItem(k)||'null');return d&&d.qgoal&&d.qgoal.goals.some(g=>g.fromCoach);},'cs_idp_v1_'+A);
    const d=await raw(page,'cs_idp_v1_'+A);
    const g=d.qgoal.goals.find(x=>x.fromCoach);
    assert.equal(g.t,GOAL);assert.equal(g.owner,'both');assert.equal(g.due,'2026-10-31');
    assert.ok(d.qgoal.goals.some(x=>x.t==='가상 기존 목표'),'existing goal kept');
    assert.ok((await page.locator('.cg-card').innerText()).includes('내 목표 ✓'));
    await page.locator('#layers [data-l="goal"]').click();
    assert.equal(await page.locator('[data-cg-adopt]').count(),0,'adopt only once');
    await page.screenshot({path:path.join(out,engine+'-player-adopt.png')});
    result.cases.push('player-adopts-coach-goal-into-own-12-week-goals');
    await context.close();
  }
  assert.deepEqual(result.errors.filter(e=>!/ResizeObserver loop/.test(e)),[],'no page errors');
  result.ok=true;
}catch(e){result.ok=false;result.error=e.stack;}
finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;}
