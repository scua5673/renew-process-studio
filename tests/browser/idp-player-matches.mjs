import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'supported browser engine');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/idp-player-matches');
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out,{recursive:true});
const UID='fixture-match-coach',WID='fixture-match-team',A='fixture-match-a',B='fixture-match-b',EMPTY='fixture-match-empty';
const GOOD_A='가상 A 선수만의 리뷰 · 받기 전에 공간 확인';
const GOOD_B='가상 B 선수만의 리뷰 · 골문 앞 크로스 처리';
const OLD_A='팀 경기 목록에서 사라져도 남아야 하는 가상 A의 이전 기록';
const TEAM_PRIVATE='이 탭에 섞이면 안 되는 팀 전체 코치 메모';
const HTML_TEXT='가상 문장 <img data-fixture-injected="yes">은 문자로 표시';
const players=[
  {id:'p-a',name:'가상 선수 A',num:'8',posId:'cm',levels:{},profile:{},meetings:[]},
  {id:'p-b',name:'가상 선수 B',num:'1',posId:'gk',levels:{},profile:{},meetings:[]},
  {id:'p-empty',name:'가상 빈 기록 선수',num:'19',posId:'cm',levels:{},profile:{},meetings:[]},
  {id:'p-unlinked',name:'가상 미연결 선수',num:'21',posId:'cm',levels:{},profile:{},meetings:[]}
];
const positions=[{id:'cm',name:'CM',req:{},role:{}},{id:'gk',name:'GK',req:{},role:{}}];
const at=Date.parse('2026-09-09T14:00:00+09:00');
const blank=name=>({v:1,profile:{name},selfEval:{levels:{}},trainings:[],log:{}});
const documents={
  ['cs_idp_v1_'+A]:{...blank('가상 선수 A'),matchSelf:{
    'current-match':{good:GOOD_A,better:HTML_TEXT,tried:'가상 A의 빠른 패스 시도',score:4,pos:'CM',roleAtk:'가상 A의 공격 임무 · 넓게 받기',roleDef:'가상 A의 수비 임무 · 안쪽 차단',apps:'start',mins:45,at},
    'removed-old-match':{good:OLD_A,better:'가상 A의 이전 다음 행동',score:8,pos:'RB',apps:'sub',mins:0,at:Date.parse('2025-12-20T16:00:00+09:00')}
  }},
  ['cs_idp_v1_'+B]:{...blank('가상 선수 B'),matchSelf:{
    'current-match':{good:GOOD_B,better:'가상 B의 다음에는 크게 소리내기',tried:'가상 B의 빠른 배급 시도',score:3,pos:'GK',roleAtk:'가상 B의 공격 임무 · 빠른 배급',roleDef:'가상 B의 수비 임무 · 크로스 처리',apps:'sub',mins:18,at}
  }},
  ['cs_idp_v1_'+EMPTY]:blank('가상 빈 기록 선수'),
  cs_team_matches_v1:{v:1,matches:[{id:'current-match',date:'2026-09-09',opponent:'가상 상대 U15',scoreUs:'0',scoreThem:'2',reviewPublished:false,reviewGood:TEAM_PRIVATE}]},
  scout_tool_v1:{players,positions},
  cs_perms_v1:{v:1,defaultRole:'player',members:{[UID]:{role:'executive'},[A]:{role:'player',playerId:'p-a'},[B]:{role:'player',playerId:'p-b'},[EMPTY]:{role:'player',playerId:'p-empty'}}}
};
const protectedKeys=Object.keys(documents);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  let file;
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(pathname==='/fixture-idp-team.html'){
      response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}iframe{display:block}</style><script>window.fixtureMessages=[];window.addEventListener("message",function(e){var f=document.getElementById("fixtureIDP"),d=e.data||{};if(!f||e.source!==f.contentWindow||e.origin!==location.origin)return;fixtureMessages.push(d);if(d.source==="idp"&&d.type==="teamEvalList")f.contentWindow.postMessage(Object.assign({source:"app",type:"teamEvalListAck",requestId:d.requestId,ok:true,editable:true,groups:[],ex:{}},JSON.parse(localStorage.getItem("scout_tool_v1"))),location.origin);});</script><iframe id="fixtureIDP" src="/studio/idp.html?fixture=player-matches"></iframe>');
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

async function newContext(browser,spec){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.mobile,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await context.addInitScript(({uid,wid,documents})=>{
    if(!localStorage.getItem('fixture-player-matches-seeded')){
      localStorage.setItem('fixture-player-matches-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-not-a-real-token'}));
      localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner',name:'가상 경기 확인 팀'}]));
      localStorage.setItem('cs_lang','ko');
      localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify({v:1,profile:{name:'가상 코치'},selfEval:{levels:{}},trainings:[],log:{}}));
      for(const [key,doc] of Object.entries(documents))localStorage.setItem(key,JSON.stringify(doc));
    }
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>true,keyReady:()=>true,syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){}};
  },{uid:UID,wid:WID,documents});
  return context;
}
async function snapshot(page){return page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),protectedKeys);}
async function openSquad(page){
  await page.goto(base+'/fixture-idp-team.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('fixtureIDP')?.contentWindow.document.getElementById('wrap')?.children.length>0);
  const frame=page.frame({url:/\/studio\/idp\.html\?fixture=player-matches$/});
  assert.ok(frame,'actual IDP iframe is mounted');
  await page.evaluate(()=>document.getElementById('fixtureIDP').contentWindow.postMessage({type:'openSquad'},location.origin));
  await frame.locator('.sq-scope').waitFor({state:'visible'});
  await frame.locator('.sq-scope button').filter({hasText:/^선수$/}).click();
  return frame;
}
async function selectPlayer(frame,pid){
  const back=frame.locator('[data-sqe-back]');
  if(await back.count())await back.click();
  await frame.locator(`[data-sqe-p="${pid}"]`).click();
  await frame.locator('.sqe-modes [data-sqe-mode="matches"]').click();
  await frame.locator('.sqe-modes [data-sqe-mode="matches"].on').waitFor({state:'visible'});
}
async function assertReadonly(frame){
  assert.equal(await frame.locator('.sqm input,.sqm textarea,.sqm select,.sqm [contenteditable="true"]').count(),0,'player match records expose no editing controls');
}
async function capture(page,frame,spec,name){
  const layout=await frame.locator('.sqm').evaluate(el=>{const r=el.getBoundingClientRect();return {width:innerWidth,left:r.left,right:r.right,scroll:el.scrollWidth,client:el.clientWidth};});
  assert.ok(layout.left>=-1&&layout.right<=layout.width+1&&layout.scroll<=layout.client+1,'match records fit horizontally');
  await page.screenshot({path:path.join(out,`${spec.name}-${name}.png`),animations:'disabled'});
  return layout;
}

const results=[];let browser;
try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [{name:'375-phone',width:375,height:812,touch:true,mobile:true},{name:'768-tablet',width:768,height:820,touch:true},{name:'1280-desktop',width:1280,height:900}]){
    const result={viewport:spec.name,cases:[],pageErrors:[]};results.push(result);
    const context=await newContext(browser,spec),page=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',error=>result.pageErrors.push(error.stack||String(error)));
    try{
      const frame=await openSquad(page),before=await snapshot(page);
      await selectPlayer(frame,'p-a');
      let text=await frame.locator('.sqm').innerText();
      assert.equal(await frame.locator('.sqm').getAttribute('data-sqm-state'),'ready');
      assert.equal(await frame.locator('.sqm-record[data-sqm-id="removed-old-match"]').count(),1);
      assert.match(await frame.locator('.sqm-record[data-sqm-id="removed-old-match"]').innerText(),/0\s*분/,'an explicit zero-minute appearance is not dropped');
      for(const marker of [GOOD_A,OLD_A,HTML_TEXT,'가상 A의 공격 임무','가상 A의 수비 임무','CM','RB','45'])assert.ok(text.includes(marker),`A record includes ${marker}`);
      assert.ok(!text.includes(GOOD_B)&&!text.includes(TEAM_PRIVATE),'A view excludes other player and team review text');
      assert.equal(await frame.locator('[data-fixture-injected]').count(),0,'review text is escaped');
      await assertReadonly(frame);result.layout=await capture(page,frame,spec,'player-a');
      result.cases.push('real-team-tab-shows-selected-player-review-roles-appearance','orphan-match-record-retained-and-text-escaped');

      await frame.locator('[data-sqe-next="p-b"]').click();
      await frame.locator('.sqe-modes [data-sqe-mode="matches"].on').waitFor({state:'visible'});
      text=await frame.locator('.sqm').innerText();
      assert.ok(text.includes(GOOD_B)&&text.includes('GK')&&text.includes('18'),'next player shows B review and role');
      assert.ok(!text.includes(GOOD_A)&&!text.includes(OLD_A),'next player does not retain A text');
      await assertReadonly(frame);await capture(page,frame,spec,'player-b');
      result.cases.push('next-player-keeps-match-tab-without-mixing-records');

      await frame.locator('.sq-scope [data-sqe-mode="qa"]').click();
      await frame.locator('.sq-scope button').filter({hasText:/^선수$/}).click();
      await frame.locator('.sqe-modes [data-sqe-mode="matches"].on').waitFor({state:'visible'});
      assert.ok((await frame.locator('.sqm').innerText()).includes(GOOD_B),'return from team scope retains selected player and matches tab');
      result.cases.push('team-scope-return-retains-match-tab');

      await selectPlayer(frame,'p-empty');
      text=await frame.locator('.sqm').innerText();
      assert.equal(await frame.locator('.sqm').getAttribute('data-sqm-state'),'empty');
      assert.ok(!text.includes(GOOD_A)&&!text.includes(GOOD_B)&&!text.includes(OLD_A),'empty player inherits no other records');
      assert.match(text,/아직|없|기록/);await assertReadonly(frame);await capture(page,frame,spec,'empty');
      await selectPlayer(frame,'p-unlinked');
      text=await frame.locator('.sqm').innerText();assert.match(text,/연결/);
      assert.equal(await frame.locator('.sqm').getAttribute('data-sqm-state'),'unlinked');
      assert.ok(!text.includes(GOOD_A)&&!text.includes(GOOD_B),'unlinked player inherits no other records');
      await assertReadonly(frame);await capture(page,frame,spec,'unlinked');
      result.cases.push('empty-and-unlinked-players-show-own-empty-state');
      await selectPlayer(frame,'p-a');
      assert.ok((await frame.locator('.sqm').innerText()).includes(OLD_A),'returning to A restores the prior orphan record');
      if(spec.width===1280){
        const key='cs_idp_v1_'+A,original=before[key],perms=before.cs_perms_v1;
        await page.evaluate(key=>localStorage.removeItem(key),key);
        await frame.locator('.sqm[data-sqm-state="pending"]').waitFor({state:'visible'});
        assert.ok(!(await frame.locator('.sqm').innerText()).includes(GOOD_A),'missing document does not leave stale player text');
        await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:original});
        await frame.locator('.sqm[data-sqm-state="ready"]').waitFor({state:'visible'});
        await page.evaluate(()=>{const doc=JSON.parse(localStorage.getItem('cs_perms_v1'));doc.members['fixture-duplicate']={role:'player',playerId:'p-a'};localStorage.setItem('cs_perms_v1',JSON.stringify(doc));});
        await frame.locator('.sqm[data-sqm-state="ambiguous"]').waitFor({state:'visible'});
        assert.ok(!(await frame.locator('.sqm').innerText()).includes(GOOD_A),'ambiguous account mapping does not pick an arbitrary document');
        await page.evaluate(raw=>localStorage.setItem('cs_perms_v1',raw),perms);
        await frame.locator('.sqm[data-sqm-state="ready"]').waitFor({state:'visible'});
        const refreshed='가상 동기화로 새로 도착한 A의 경기 리뷰';
        await page.evaluate(({key,refreshed})=>{const doc=JSON.parse(localStorage.getItem(key));doc.matchSelf['current-match'].good=refreshed;localStorage.setItem(key,JSON.stringify(doc));},{key,refreshed});
        await frame.locator('.sqm-field p').filter({hasText:refreshed}).waitFor({state:'visible'});
        assert.equal(await frame.locator('.sqe-modes [data-sqe-mode="matches"].on').count(),1,'live refresh retains the match tab');
        assert.ok(!(await frame.locator('.sqm').innerText()).includes(GOOD_B),'live refresh does not switch player');
        await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:original});
        await frame.locator('.sqm-field p').filter({hasText:GOOD_A}).waitFor({state:'visible'});
        result.cases.push('missing-document-and-ambiguous-link-clear-stale-data','storage-update-refreshes-selected-player-without-tab-change');
      }
      assert.deepEqual(await snapshot(page),before,'browsing never rewrites player documents, team matches or links');
      const writes=await page.evaluate(()=>fixtureMessages.filter(d=>d.source==='idp'&&/^teamEval/.test(d.type)&&d.type!=='teamEvalList'));
      assert.deepEqual(writes,[],'read-only tab sends no team evaluation mutation');
      assert.deepEqual(result.pageErrors,[],'no uncaught page errors');result.cases.push('read-only-browsing-keeps-all-source-documents-unchanged');result.ok=true;
    }catch(error){result.ok=false;result.error=error.stack||String(error);
      result.failureState=await page.evaluate(()=>document.getElementById('fixtureIDP')?.contentWindow.document.getElementById('wrap')?.innerText?.slice(0,12000)).catch(()=>null);
      await page.screenshot({path:path.join(out,`${spec.name}-failure.png`),animations:'disabled'}).catch(()=>{});
    }finally{await context.close();}
  }
}finally{
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  const report={ok:results.length===3&&results.every(r=>r.ok),build,engine,method:'Actual IDP iframe; synthetic coach, four players and local teamEvalList message fixture; every non-local request blocked; no production data.',results};
  fs.writeFileSync(path.join(out,'idp-player-matches-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,output:out,results:results.map(({viewport,ok,cases,error})=>({viewport,ok,cases,error}))},null,2));
  if(!report.ok)process.exitCode=1;
}
