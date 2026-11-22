import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Actual scout iframe + actual shared storage, in a fresh browser profile.
// Every external request is blocked. Only synthetic players and dates exist.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/avail-table-3308'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
fs.mkdirSync(out,{recursive:true});
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const UID='fixture-attendance-coach',WID='fixture-attendance-team',TODAY='2026-09-15',KEY='scout_tool_v1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://local');
  if(url.pathname==='/fixture-attendance.html'){
    response.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});
    response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}iframe{display:block}</style></head><body><script>window.PS_BUILD='+JSON.stringify(build)+';</script><script src="/studio/storage.js"></script><script src="/studio/scouting-store.js"></script><iframe id="fixtureScout" src="/studio/scout.html?fixture=attendance"></iframe></body></html>');return;
  }
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch(_){response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  try{response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(fs.readFileSync(file));}catch(_){response.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
const sync=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
function sourceFunction(name){const start=sync.indexOf('function '+name+'('),end=sync.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start,name);return sync.slice(start,end);}
const readiness=`var MATCH_KEY='cs_team_matches_v1',SCHEDULE_KEY='process_coach_v1',SCOUT_KEY='cs_scout_targets_v1',MKEY='ps_sync_meta',OWNERKEY='ps_cache_owner_v1';
var matchReadyPending=false,scheduleReadyPending=false,scoutReadyPending=false;
function getSess(){return JSON.parse(localStorage.getItem('ps_sync_session')||'null');}
function activeWs(){return localStorage.getItem('ps_active_ws');}
function dataUnlocked(){return true;}
function isTeamWs(){return true;}
function activeWsObj(){return JSON.parse(localStorage.getItem('ps_ws_list')||'[]').find(w=>w.id===activeWs());}
function permsRaw(){return localStorage.getItem('cs_perms_v1');}
${['meta','keyReady','scheduleReadyRaw','scoutWriteAllowed','scoutReadyRaw'].map(sourceFunction).join('\n')}
return keyReady;`;
const fixture={attrs:[],positions:[{id:'fixture-gk',name:'GK',targets:{}},{id:'fixture-cm',name:'CM',targets:{}}],
  players:[
    {id:'p1',name:'가상 강민',num:'1',grp:'A팀',posId:'fixture-gk',status:'ok'},
    {id:'p2',name:'가상 부상 <img src=x onerror="window.fixtureXss=1">',num:'2',grp:'A팀',posId:'fixture-cm',status:'injury'},
    {id:'p3',name:'가상 재활',num:'3',grp:'B팀',posId:'fixture-cm',status:'rehab'},
    {id:'p4',name:'가상 정상',num:'4',grp:'B팀',posId:'fixture-cm',status:'ok'},
    {id:'p5',name:'가상 신규',num:'5',grp:'A팀',posId:'fixture-cm',status:'ok'},
  ],meta:{evalMode:'fifa',statusRuns:{p1:[{s:'ok',from:'2026-09-02',to:TODAY}],p2:[{s:'injury',from:'2026-09-02',to:TODAY}],p3:[{s:'rehab',from:'2026-09-02',to:TODAY}],p4:[{s:'ok',from:'2026-09-02',to:TODAY}],p5:[{s:'ok',from:'2026-09-14',to:TODAY}]}}};
const train=()=>({board:{sched:'훈련',theme:'합성 훈련'}}),off=()=>({off:true,board:{sched:'OFF'}});
const aWeeks={'-1':[{}, {}, {}, {}, train(), off(), {}],'0':[train(), {match:{opponent:'가상 상대'},board:{sched:'경기'}}, {}, {}, {}, off(), off()]};
const bWeeks={'-1':[{}, {}, {}, train(), {}, off(), {}],'0':[train(), {}, {}, {}, {}, off(), off()]};
const schedule={v:1,anchorMonday:'2026-09-14',weeks:aWeeks,grpWeeks:{'A팀':aWeeks,'B팀':bWeeks}};
async function makeContext(browser,width){
  const context=await browser.newContext({locale:'ko-KR',viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.addInitScript(({UID,WID,readiness})=>{
    if(!localStorage.getItem('fixture-attendance-now'))localStorage.setItem('fixture-attendance-now','2026-09-15T12:00:00+09:00');
    const NativeDate=Date;class FixtureDate extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.parse(localStorage.getItem('fixture-attendance-now'))]));}static now(){return NativeDate.parse(localStorage.getItem('fixture-attendance-now'));}}
    window.Date=FixtureDate;window.fixtureXss=0;
    if(!localStorage.getItem('fixture-attendance-seeded')){
      localStorage.setItem('fixture-attendance-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-only'}));localStorage.setItem('ps_active_ws',WID);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid:UID,wid:WID,nonce:'synthetic'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'team',name:'가상 출석 테스트 팀',role:'owner'}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[UID]:{role:'executive',scopes:['team','schedule']}}}));
      localStorage.setItem('cs_lang','ko');localStorage.setItem('ps_sched_grp','');
      const seal=localStorage.getItem('ps_cache_owner_v1');localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:{w:WID,u:UID,o:seal,present:false},cs_scout_targets_v1:{w:WID,u:UID,o:seal,present:false}}}));
    }
    // This isolated server confirms an initially absent synthetic roster.
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),dataUnlocked:()=>true,rosterReady:()=>true,keyReady:new Function(readiness)()};
    window.PSItems={active:()=>false};
  },{UID,WID,readiness});
  return context;
}
async function ready(page){const frame=page.frame({url:/studio\/scout\.html/});await frame.waitForFunction(()=>typeof renderAvail==='function'&&window.PSParticipation&&window.PSPerms&&typeof scoutBootPending!=='undefined'&&!scoutBootPending);return frame;}
async function flush(frame){await frame.evaluate(async()=>{await scoutStore.ready();if(window.PSStorage)await PSStorage.sharedReady();});}
async function resolved(frame,pid,day){return frame.evaluate(({pid,day})=>{const p=data.players.find(x=>x.id===pid);return PSParticipation.resolve(data.meta,pid,day,avDayKind(new Date(day+'T00:00:00'),plGrpOf(p)),p.status,stYmd());},{pid,day});}
async function choose(frame,pid,state,note,screenshot){
  await frame.locator('[data-av-st="'+pid+'"]').click();await frame.locator('.av-pick [data-k="'+state+'"]').click();
  if(note!==undefined)await frame.locator('.av-pick [data-av-note]').fill(note);
  if(screenshot)await frame.page().screenshot({path:screenshot});
  await frame.locator('.av-pick [data-av-save]').click();await frame.locator('.av-pick').waitFor({state:'hidden'});await flush(frame);
}
async function metric(frame,pid,name){const row=frame.locator('[data-av-player-total="'+pid+'"]').locator('xpath=ancestor::tr');return Number((await row.locator('[data-av-stat="'+name+'"]').innerText()).replace(/[^\d.-]/g,''));}
/* 3.308 — 가용인원 › 날짜별 명단을 표로(avail-table.js): 조 묶음 줄 · 열 · 쉼 줄 자리 · 부상 칸 · 이름 앞 조 칩 → 조 고르개 → 저장 · 다시 그림.
   3.307 이름 → 프로필, 상태 칩 → 기록 창은 그대로. 고치기 전 코드(카드 격자)는 첫 단계(tables 1 · 표 머리)에서 떨어진다. */
let browser;const results=[];
try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1280,393]){
    const context=await makeContext(browser,width),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/fixture-attendance.html');let frame=await ready(page);
    await frame.evaluate(async({fixture,schedule,UID,WID})=>{
      await PSStorage.sharedReady();data=JSON.parse(JSON.stringify(fixture));scoutStore.set('scout_tool_v1',data);await scoutStore.ready();
      await psSaveSharedAsync('process_coach_v1',JSON.stringify(schedule));await PSStorage.sharedVerified('process_coach_v1',JSON.stringify(schedule));
      const seal=localStorage.getItem('ps_cache_owner_v1');localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:{w:WID,u:UID,o:seal,present:true},cs_scout_targets_v1:{w:WID,u:UID,o:seal,present:false}}}));
      await scPrepare();load();await scoutStore.ready(true);availRange=14;availDay=null;setView('avail');
    },{fixture,schedule,UID,WID});
    await frame.locator('[data-av-date="2026-09-11"]').waitFor();
    const phone=width<600;
    // ① 표 모양 — 데스크톱은 표 하나(조 줄 · 쉼은 제 조 아래 옅은 줄), 폰은 운동 / 참여 못 함 안에 조마다 표 · 세 열
    const shape=await frame.evaluate(()=>{const card=document.querySelector('#avDailyCard'),tables=[...card.querySelectorAll('table.av-day-table')];
      return {tables:tables.length,heads:tables.map(t=>[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim())),
        groups:[...card.querySelectorAll('tr.av-grp-row th, .av-grp .gh')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),
        rows:[...card.querySelectorAll('tr.av-pl')].map(tr=>tr.dataset.avPid+(tr.classList.contains('rest')?'*':'')),
        chips:[...card.querySelectorAll('[data-av-grp]')].map(b=>b.dataset.avGrp+':'+b.textContent.replace(/[\s⌄]+/g,'')).sort(),
        inj:[...card.querySelectorAll('tr.av-pl')].map(tr=>tr.dataset.avPid+':'+(tr.querySelector('.av-inj')||{textContent:''}).textContent.replace(/\s+/g,' ').trim()),
        notRow:[...card.querySelectorAll('tr.av-pl')].filter(tr=>getComputedStyle(tr).display!=='table-row').length,
        chipBox:(()=>{const b=card.querySelector('[data-av-grp="p1"]'),r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})()};});
    if(phone)assert.deepEqual({tables:shape.tables,heads:shape.heads[0],rows:shape.rows},{tables:4,heads:['이름','상태','부상 · 메모'],rows:['p1','p5','p4','p2*','p3*']},'phone: a table per group inside the two blocks, three columns, rest block last');
    else assert.deepEqual({tables:shape.tables,heads:shape.heads[0],rows:shape.rows},{tables:1,heads:['번호','조','이름','포지션','상태','부상','메모'],rows:['p1','p5','p2*','p4','p3*']},'desktop: one table, rest rows tinted in place under their group');
    assert.equal(shape.notRow,0,'옛 .av-pl grid 규칙이 tr 에 안 걸린다');
    assert.deepEqual(shape.chips,['p1:A팀','p2:A팀','p3:B팀','p4:B팀','p5:A팀'],'이름 앞 조 칩');
    assert.ok(shape.chipBox[1]>=22&&shape.chipBox[0]>=40,'조 칩이 눌릴 크기: '+shape.chipBox.join('×'));
    assert.match(shape.inj.find(x=>x.startsWith('p2:')),/^p2:부위 미정\s?\d+일째$/,'부상 선수 칸: 부위 미정 + 며칠째');
    assert.equal(shape.inj.find(x=>x.startsWith('p1:')),'p1:','가능 선수는 빈 칸');
    if(!phone)assert.match(shape.groups[0],/^A팀 가능 2 \/ 3명\s*필드 1 · GK 1$/,'조 줄 = 2.956 필드 · GK: '+shape.groups[0]);
    // ② 조 칩 → 조 고르개(선수단 표와 같은 목록) → B팀: save() → 기기 사본 · 표에서 자리 이동 · 조 머리 인원
    await frame.locator('#avDailyCard [data-av-grp="p1"]').click();await frame.locator('#psPickPop').waitFor();
    const items=await frame.evaluate(()=>[...document.querySelectorAll('#psPickPop button')].map(b=>b.textContent.trim()));
    assert.ok(items.includes('A팀')&&items.includes('B팀')&&items.includes('없음'),'조 고르개 목록: '+items.join(','));
    await frame.locator('#psPickPop button',{hasText:'B팀'}).click();
    await frame.waitForFunction(()=>!document.querySelector('#psPickPop')&&(document.querySelector('#avDailyCard [data-av-grp="p1"]')||{textContent:''}).textContent.includes('B팀'));
    const after=await frame.evaluate(async()=>{await scoutStore.ready();const raw=localStorage.getItem('scout_tool_v1');
      return {mem:data.players.find(p=>p.id==='p1').grp,ls:raw?JSON.parse(raw).players.find(p=>p.id==='p1').grp:null,
        rows:[...document.querySelectorAll('#avDailyCard tr.av-pl')].map(tr=>tr.dataset.avPid),
        groups:[...document.querySelectorAll('#avDailyCard tr.av-grp-row th, #avDailyCard .av-grp .gh')].map(e=>e.textContent.replace(/\s+/g,' ').trim())};});
    assert.equal(after.mem,'B팀');assert.equal(after.ls,'B팀','save() 를 지나 기기 사본에 적힌다');
    assert.deepEqual(after.rows,phone?['p5','p1','p4','p2','p3']:['p5','p2','p1','p4','p3'],'p1 이 B팀 묶음으로(GK 가 먼저)');
    assert.ok(after.groups.some(g=>/B팀 (가능 )?2 \/ 3명/.test(g)),'B팀 머리가 새 인원으로: '+after.groups.join(' | '));
    // ③ 되돌리기(A팀) — 같은 길
    await frame.locator('#avDailyCard [data-av-grp="p1"]').click();await frame.locator('#psPickPop').waitFor();await frame.locator('#psPickPop button',{hasText:'A팀'}).click();
    await frame.waitForFunction(()=>!document.querySelector('#psPickPop')&&(document.querySelector('#avDailyCard [data-av-grp="p1"]')||{textContent:''}).textContent.includes('A팀'));
    assert.equal(await frame.evaluate(()=>data.players.find(p=>p.id==='p1').grp),'A팀');
    // ③-2 3.363 포지션 칩 → 포지션 고르개(선수단 표와 같은 목록) → GK: save() → 기기 사본 · 칸 글자, 다시 CM 으로
    const posBox=await frame.evaluate(()=>{const b=document.querySelector('#avDailyCard [data-av-pos="p5"]'),r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {w:Math.round(r.width),h:Math.round(r.height),hit:!!(hit&&hit.closest('[data-av-pos="p5"]')),n:document.querySelectorAll('#avDailyCard [data-av-pos]').length,over:document.documentElement.scrollWidth-document.documentElement.clientWidth};});
    assert.ok(posBox.n===5&&posBox.h>=22&&posBox.w>=30&&posBox.hit,'포지션 칩이 줄마다 하나 · 눌릴 크기 · 가려지지 않음: '+JSON.stringify(posBox));
    assert.ok(posBox.over<=0,'가로 넘침 없음: '+posBox.over);
    await frame.locator('#avDailyCard [data-av-pos="p5"]').click();await frame.locator('#psPickPop').waitFor();
    const posItems=await frame.evaluate(()=>[...document.querySelectorAll('#psPickPop button')].map(b=>b.textContent.trim()));
    assert.ok(posItems.includes('GK')&&posItems.includes('CM')&&posItems[posItems.length-1]==='미지정','포지션 고르개 목록: '+posItems.join(','));
    await frame.locator('#psPickPop button',{hasText:/^GK$/}).click();
    await frame.waitForFunction(()=>!document.querySelector('#psPickPop')&&(document.querySelector('#avDailyCard [data-av-pos="p5"]')||{textContent:''}).textContent.includes('GK'));
    const posAfter=await frame.evaluate(async()=>{await scoutStore.ready();const raw=localStorage.getItem('scout_tool_v1'),p=data.players.find(x=>x.id==='p5');
      const gkId=data.positions.find(x=>x.name==='GK').id;return {mem:p.posId===gkId,name:p.posName,ls:raw?JSON.parse(raw).players.find(x=>x.id==='p5').posId===gkId:null,gk:document.querySelector('#avDailyCard [data-av-pos="p5"]').classList.contains('gk')};});
    assert.deepEqual(posAfter,{mem:true,name:'GK',ls:true,gk:true},'포지션이 save() 를 지나 기기 사본에 적힌다');
    await frame.locator('#avDailyCard [data-av-pos="p5"]').click();await frame.locator('#psPickPop').waitFor();await frame.locator('#psPickPop button',{hasText:'미지정'}).click();
    await frame.waitForFunction(()=>!document.querySelector('#psPickPop')&&data.players.find(x=>x.id==='p5').posId==='');
    assert.match(await frame.locator('#avDailyCard [data-av-pos="p5"]').innerText(),/^–/,'미지정이면 – 로 남아 다시 누를 수 있다');
    await frame.locator('#avDailyCard [data-av-pos="p5"]').click();await frame.locator('#psPickPop').waitFor();await frame.locator('#psPickPop button',{hasText:/^CM$/}).click();
    await frame.waitForFunction(()=>!document.querySelector('#psPickPop')&&data.players.find(x=>x.id==='p5').posName==='CM');
    // ④ 3.307 이름 → 프로필 · 상태 칩 → 기록 창(2.942)은 표 안에서도 그대로
    await frame.locator('#avDailyCard [data-av-player-edit="p1"]').click();await frame.locator('#plEditModal').waitFor({state:'visible'});
    assert.equal(await frame.locator('#plEditTitle').innerText(),'가상 강민');await frame.locator('#plClose').click();await frame.locator('#plEditModal').waitFor({state:'hidden'});
    await frame.locator('#avDailyCard [data-av-st="p1"]').click();await frame.locator('.av-pick').waitFor();await frame.locator('.av-pick [data-av-cancel]').first().click();await frame.locator('.av-pick').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(out,width+'-table.png'),fullPage:true});
    assert.deepEqual(errors,[],'page errors');
    results.push({engine,width,passed:true});console.log(JSON.stringify(results[results.length-1]));
    await context.close();
  }
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();server.close();}
