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
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/idp-story-dedup');
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


const MEMO='동일 문장도 날짜가 다르면 각각 보존',LONG='긴 답변 원문 '.repeat(40).trim(),STRENGTH='압박을 받는 좁은 공간에서도 동료에게 정확하게 패스할 방향을 찾아낸다';
const log={};for(let n=0;n<46;n++){const date=new Date('2026-09-12T12:00:00+09:00');date.setDate(date.getDate()-n);log[date.toISOString().slice(0,10)]={t:'team',memo:n<2?MEMO:'가상 일지 '+n,body:4,sleepq:4,rpe:6};}
log['2025-01-01']={t:'rest',memo:'84일 이전 기록 보존'};log['2026-09-13']={t:'rehab',body:2,sleepq:2,rpe:3,visionEvidence:{id:'old',text:'당시 방향 원문',revision:'old'}};
Object.assign(documents['cs_idp_v1_'+A],{log,answers:{q1:{t:LONG,at}},selfEval:{levels:{d_pass:3},strengths:STRENGTH+'\n짧은 장점',improve:'빠르게 수비로 돌아온다',at,hist:[{d:'2026-09-09',o:3,c:{기술:3},v:{d_pass:3},s:''}]},vision:{statement:'함께 전진하는 선수',behaviors:[{id:'v1',text:'공 받기 전 두 번 확인'}],focusId:'v1',revision:'current',updatedAt:at},qgoal:{start:'2026-09-07',theme:'전진',goals:[{id:'g1',t:'공 받기 전 두 번 확인',sc:{'2026-09-07':3}}],at},weekly:{'2026-09-07':{good:'가상 주간 회고',better:'가상 다음 주 회고'}},talk:[{id:'a-talk',text:'가상 한 마디 A',at}]});
documents['cs_idp_pub_v1_'+A]={reviews:[{id:'r1',at:'2026-09-09',by:'가상 코치',weeks:6,strengths:['공간을 읽는다'],develop:['전환'],goals:[{t:'가상 리뷰 목표',owner:'player',due:'2026-10-01'}],note:'가상 성장 리뷰',link:'https://example.invalid/fixture-video',nextAt:'2026-10-21'}],qmeet:[{id:'qm1',ts:Date.parse('2026-09-10T10:00:00+09:00'),at:'2026-09-10',by:'가상 코치',q:'가을',strengths:'가상 면담 강점',outside:'가상 축구 밖 대화',nextArea:'가상 다음 영역',promise:'가상 다음 분기 약속',firstFocus:'가상 첫 초점',focuses:['가상 이전 초점']}],reacts:{'day:2026-09-12':{h:1,t:'한 번만 보일 코치 답글',tAt:Date.parse('2026-09-13T14:00:00+09:00'),by:'가상 코치'},'vision:current':{t:'한 번만 보일 방향 제안',at:Date.parse('2026-09-13T13:00:00+09:00'),by:'가상 코치'},'wk:2026-09-07':{t:'한 번만 보일 주간 답글',at:Date.parse('2026-09-13T11:00:00+09:00'),by:'가상 코치'},'day:2024-01-01':{t:'원래 일지가 없는 답글',at:Date.parse('2026-09-11T13:00:00+09:00'),by:'가상 코치'}}};
documents.scout_tool_v1.meta={prompts:[{id:'q1',q:'가상 긴 답변 질문',open:true,by:'가상 코치',at}]};
protectedKeys.push('cs_idp_pub_v1_'+A);
async function showPlayer(frame,pid){await selectPlayer(frame,pid);await frame.locator('.sqe-modes [data-sqe-mode="story"]').click();}
async function allStory(frame){const more=frame.locator('[data-st-more]');if(await more.count())await more.click();}
async function raw(page,key){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function waitRaw(page,key,path,value){await page.waitForFunction(({key,path,value})=>{let v=JSON.parse(localStorage.getItem(key));for(const p of path)v=v?.[p];return v===value;},{key,path,value});}
function occurrences(text,part){return text.split(part).length-1;}
const result={build,cases:[],errors:[]};let browser;
try{
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 for(const spec of [{name:'desktop',width:1280,height:1000},{name:'phone',width:375,height:812,touch:true,mobile:true}]){
  const context=await newContext(browser,spec),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(e.message));
  const frame=await openSquad(page);await showPlayer(frame,'p-a');
  const before=await snapshot(page);
  assert.equal(await frame.locator('.st-list').count(),1);assert.equal(await frame.locator('.sqst').count(),0);
  assert.ok(await frame.locator('[data-st-more]').count());await allStory(frame);
  let text=await frame.locator('.sqth').innerText();
  assert.equal(occurrences(text,MEMO),2);assert.equal(occurrences(text,'한 번만 보일 코치 답글'),1);assert.equal(occurrences(text,'한 번만 보일 방향 제안'),1);
  for(const x of ['84일 이전 기록 보존','당시 방향 원문','한 줄은 안 적었어요','가상 면담 강점','가상 축구 밖 대화','가상 첫 초점','원래 일지가 없는 답글','3/5단계',STRENGTH])assert.ok(text.includes(x),x+' preserved');
  const ordering=await frame.locator('[data-story-ts]').evaluateAll(els=>els.map(e=>+e.dataset.storyTs));assert.ok(ordering.every((v,i)=>i===0||ordering[i-1]>=v));
  const identities=await frame.locator('[data-story-id]').evaluateAll(els=>els.map(e=>e.dataset.storyId));assert.equal(new Set(identities).size,identities.length);assert.equal(identities.filter(k=>k==='record:ev:ev').length,1);assert.equal(identities.filter(k=>k.startsWith('self:')).length,0);assert.ok(text.includes('평균'));assert.ok(text.includes('9/7~9/13'));
  await frame.locator('[data-sqst-f="qa"]').click();assert.equal(await frame.locator('.st-msg').count(),1);assert.equal((await frame.locator('.sqth').innerText()).includes(LONG),false);
  await frame.locator('[data-sqst-more="q1"]').click();assert.ok((await frame.locator('.sqth').innerText()).includes(LONG));
  await frame.locator('.sqe-modes [data-sqe-mode="pqa"]').click();assert.ok((await frame.locator('.pqa').innerText()).includes(LONG));assert.ok(!(await frame.locator('.pqa').innerText()).includes('A4'));
  await frame.locator('.sqe-modes [data-sqe-mode="story"]').click();await frame.locator('[data-sqst-f="all"]').click();await allStory(frame);
  assert.deepEqual(await snapshot(page),before,'reading did not write source records');
  const row=()=>frame.locator('.sqrx[data-sqrx-key="day:2026-09-12"]');
  await row().locator('[data-sqrx-like]').click();await waitRaw(page,'cs_idp_pub_v1_'+A,['reacts','day:2026-09-12','h'],0);
  await row().locator('[data-sqrx-open]').click();await row().locator('[data-sqrx-in]').fill('수정한 코치 답글');await row().locator('[data-sqrx-save]').click();await waitRaw(page,'cs_idp_pub_v1_'+A,['reacts','day:2026-09-12','t'],'수정한 코치 답글');
  assert.equal(occurrences(await frame.locator('.sqth').innerText(),'수정한 코치 답글'),1);
  await row().locator('[data-sqrx-open]').click();await row().locator('[data-sqrx-in]').fill('조합 중인 한글 답글');
  await row().locator('[data-sqrx-in]').dispatchEvent('keydown',{key:'Enter',keyCode:229,isComposing:true});
  assert.equal((await raw(page,'cs_idp_pub_v1_'+A)).reacts['day:2026-09-12'].t,'수정한 코치 답글');
  await row().locator('[data-sqrx-in]').press('Enter');await waitRaw(page,'cs_idp_pub_v1_'+A,['reacts','day:2026-09-12','t'],'조합 중인 한글 답글');
  await row().locator('[data-sqrx-open]').click();await row().locator('[data-sqrx-in]').fill('초점 이동으로 저장한 답글');await row().locator('[data-sqrx-in]').evaluate(el=>el.blur());
  await waitRaw(page,'cs_idp_pub_v1_'+A,['reacts','day:2026-09-12','t'],'초점 이동으로 저장한 답글');await row().locator('[data-sqrx-in]').waitFor({state:'detached'});
  await row().locator('[data-sqrx-open]').click();await row().locator('[data-sqrx-in]').fill('실패 후 남아야 할 초안');
  await frame.evaluate(key=>{window.fixtureStorage=localStorage;Object.defineProperty(window,'localStorage',{configurable:true,value:new Proxy(window.fixtureStorage,{get(target,prop){if(prop==='setItem')return function(k,v){if(k===key)throw new DOMException('fixture quota','QuotaExceededError');return target.setItem(k,v);};const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;}})});},'cs_idp_pub_v1_'+A);
  await row().locator('[data-sqrx-save]').click();assert.equal((await raw(page,'cs_idp_pub_v1_'+A)).reacts['day:2026-09-12'].t,'초점 이동으로 저장한 답글');assert.equal(await row().locator('[data-sqrx-in]').inputValue(),'실패 후 남아야 할 초안');
  await frame.evaluate(()=>{Object.defineProperty(window,'localStorage',{configurable:true,value:window.fixtureStorage});delete window.fixtureStorage;});
  await row().locator('[data-sqrx-save]').click();await waitRaw(page,'cs_idp_pub_v1_'+A,['reacts','day:2026-09-12','t'],'실패 후 남아야 할 초안');
  const lockedBefore=await raw(page,'cs_idp_pub_v1_'+A);
  await page.evaluate(()=>{PSSync.dataUnlocked=()=>false;});await row().locator('[data-sqrx-like]').click();assert.deepEqual(await raw(page,'cs_idp_pub_v1_'+A),lockedBefore);
  await page.evaluate(()=>{PSSync.dataUnlocked=()=>true;});
  await row().locator('[data-sqrx-open]').click();await row().locator('[data-sqrx-in]').fill('');await row().locator('[data-sqrx-save]').click();await waitRaw(page,'cs_idp_pub_v1_'+A,['reacts','day:2026-09-12'],undefined);
  assert.deepEqual((await raw(page,'cs_idp_v1_'+A)),documents['cs_idp_v1_'+A]);assert.deepEqual((await raw(page,'cs_idp_v1_'+B)),documents['cs_idp_v1_'+B]);
  // Stale target: relink to a second account without re-rendering. The existing node must refuse writes.
  const pubBefore=await raw(page,'cs_idp_pub_v1_'+A);
  await page.evaluate(({uid,pid})=>{const pm=JSON.parse(localStorage.getItem('cs_perms_v1'));pm.members[uid]={role:'player',playerId:pid};localStorage.setItem('cs_perms_v1',JSON.stringify(pm));},{uid:'fixture-ambiguous',pid:'p-a'});
  await row().locator('[data-sqrx-like]').click();assert.deepEqual(await raw(page,'cs_idp_pub_v1_'+A),pubBefore);
  await page.evaluate(pm=>localStorage.setItem('cs_perms_v1',JSON.stringify(pm)),documents.cs_perms_v1);
  await showPlayer(frame,'p-b');text=await frame.locator('.sqth').innerText();assert.ok(text.includes(GOOD_B));assert.ok(!text.includes(MEMO));assert.equal(await frame.locator('[data-st-more]').count(),0);
  await showPlayer(frame,'p-empty');assert.equal(await frame.locator('[data-st-send]').count(),1);await frame.locator('[data-st-in]').fill('빈 이야기에서 첫 코치 한 마디');await frame.locator('[data-st-send]').click();assert.ok((await frame.locator('.sqth').innerText()).includes('빈 이야기에서 첫 코치 한 마디'));
  await showPlayer(frame,'p-unlinked');assert.equal(await frame.locator('[data-st-send]').count(),0);assert.equal(await frame.locator('.sqth').getAttribute('data-story-state'),'unlinked');
  await showPlayer(frame,'p-a');await allStory(frame);await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'story-'+spec.name+'.png')});await frame.locator('[data-story-id="record:log:2026-09-13"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'story-records-'+spec.name+'.png')});
  const layout=await frame.locator('.sqth').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(layout.scroll<=layout.client+1,'story fits width');
  if(spec.name==='desktop'){await frame.locator('[data-sqe-mode="meet"]').click();assert.equal(await frame.locator('.sqmt-l .st-list').count(),1);assert.equal(await frame.locator('.sqmt-l .sqst').count(),0);await page.screenshot({path:path.join(out,'story-meeting.png')});}
  result.cases.push(spec.name+': source identity, old/status-only logs, full answers, filters, reactions, IME/Enter/blur, failed-save draft, locked/stale target, match-only/empty/unlinked, responsive single stream');
  await context.close();
 }
 // Personal ownership and the actions moved out of the old profile timeline.
 const context=await newContext(browser,{width:1280,height:1000});
 await context.addInitScript(({uid,wid})=>{localStorage.setItem('ps_sync_session',JSON.stringify({uid}));localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'player',name:'가상 팀'}]));},{uid:A,wid:WID});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(base+'/fixture-idp-team.html');await page.waitForFunction(()=>document.getElementById('fixtureIDP')?.contentWindow.document.getElementById('wrap')?.children.length);
 await page.evaluate(()=>document.getElementById('fixtureIDP').contentWindow.postMessage({type:'openPersonal'},location.origin));
 const frame=page.frame({url:/\/studio\/idp\.html\?fixture=player-matches$/});
 async function tab(name){await frame.locator('#layers [data-l="'+name+'"]').click({force:true});}
 await tab('profile');assert.equal(await frame.locator('.th-card').count(),0);assert.equal(await frame.locator('.rv-card').count(),1);
 await tab('story');await allStory(frame);assert.equal(occurrences(await frame.locator('.st-card').innerText(),'한 번만 보일 주간 답글'),1);assert.ok((await frame.locator('.st-card').innerText()).includes('가상 첫 초점'));
 await frame.locator('[data-th-reply="r1"]').click();await frame.locator('[data-th-reply-in="r1"]').fill('이야기에서 선수 답하기');await frame.locator('[data-th-reply-save="r1"]').click();await waitRaw(page,'cs_idp_v1_'+A,['rvReplies','r1','text'],'이야기에서 선수 답하기');
 await frame.locator('[data-th-qstart="qm1"]').click();await frame.locator('.ps-confirm-overlay button').filter({hasText:'확인'}).click();await waitRaw(page,'cs_idp_v1_'+A,['qgoal','fromMeet'],'qm1');
 const after=await raw(page,'cs_idp_v1_'+A);assert.equal(after.qgoal.goals[0].t,'가상 다음 분기 약속');assert.equal(after.qgoalHist[0].goals[0].t,'공 받기 전 두 번 확인');assert.ok(Object.values(after.focusByWk).some(f=>f.text==='가상 첫 초점'));
 assert.equal(await frame.locator('[data-th-qstart="qm1"]').count(),0);assert.ok((await frame.locator('.st-card').innerText()).includes('이 약속으로 분기를 시작했어요'));
 await tab('goal');assert.equal(await frame.locator('.vs-goal b').count(),0);assert.equal(await frame.locator('.gf-seg').isVisible(),false);
 await frame.locator('[data-wp-open]').click();const long=frame.locator('[data-ws-add]').filter({hasText:STRENGTH});assert.equal(await long.count(),1);await long.click();assert.equal(await frame.locator('#wsIn').inputValue(),STRENGTH);assert.equal(await frame.locator('#wsSave').isDisabled(),true);
 assert.equal((await raw(page,'cs_idp_v1_'+A)).weapon,undefined);await frame.locator('#wsIn').fill('압박 속 패스 방향 찾기');await frame.locator('#wsSave').click();await waitRaw(page,'cs_idp_v1_'+A,['weapon','picks','0','t'],'압박 속 패스 방향 찾기');assert.equal((await raw(page,'cs_idp_v1_'+A)).selfEval.strengths,STRENGTH+'\n짧은 장점');
 await frame.locator('#wsClose').click();await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'personal-goal.png')});
 await page.setViewportSize({width:375,height:812});assert.equal(await frame.locator('.gf-seg').isVisible(),true);await frame.locator('[data-gf="routine"]').click();assert.equal(await frame.locator('body').getAttribute('data-idp-layer'),'routine');
 await page.setViewportSize({width:1280,height:1000});await frame.waitForFunction(()=>document.querySelector('#layers [data-l="routine"]')?.getAttribute('aria-current')==='page');assert.equal(await frame.locator('#layers [data-l="routine"]').getAttribute('aria-current'),'page');
 await tab('story');await allStory(frame);await frame.locator('[data-st-go="qa:q1"]').click();assert.equal(await frame.locator('[data-qa-ans="q1"]').inputValue(),LONG);assert.equal((await frame.locator('.qa-count').innerText()).includes('A4'),false);
 assert.deepEqual(await raw(page,'cs_idp_v1_'+B),documents['cs_idp_v1_'+B]);assert.deepEqual(await raw(page,'cs_idp_pub_v1_'+A),documents['cs_idp_pub_v1_'+A]);
 result.cases.push('personal: profile timeline removed, review reply and next-quarter action preserved, long strength explicitly shortened without changing source, responsive navigation and original QA route');
 await context.close();assert.deepEqual(result.errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
