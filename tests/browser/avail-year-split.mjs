import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// 3.283 — 가용인원 조별 보기의 «학년 나누기» · 선수 추가 시트 · 선수 편집 창의 조 · 학년.
// Actual scout iframe + actual shared storage, in a fresh browser profile (availability.mjs 의 틀).
// Every external request is blocked. Only synthetic players and dates exist.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/avail-year-split'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
fs.mkdirSync(out,{recursive:true});
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const UID='fixture-year-coach',WID='fixture-year-team',TODAY='2026-09-15',KEY='scout_tool_v1';
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
    {id:'p1',name:'가상 강민',num:'1',grp:'A팀',schoolYear:'1',posId:'fixture-gk',status:'ok'},
    {id:'p2',name:'가상 부상 <img src=x onerror="window.fixtureXss=1">',num:'2',grp:'A팀',schoolYear:'1',posId:'fixture-cm',status:'injury'},
    {id:'p3',name:'가상 재활',num:'3',grp:'B팀',schoolYear:'2',posId:'fixture-cm',status:'rehab'},
    {id:'p4',name:'가상 정상',num:'4',grp:'B팀',posId:'fixture-cm',status:'ok'},
    {id:'p5',name:'가상 신규',num:'5',grp:'A팀',schoolYear:'2',posId:'fixture-cm',status:'ok'},
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
let browser;const results=[];
try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1280,768,393]){
    const context=await makeContext(browser,width),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/fixture-attendance.html');let frame=await ready(page);
    await frame.evaluate(async({fixture,schedule,UID,WID})=>{
      await PSStorage.sharedReady();data=JSON.parse(JSON.stringify(fixture));scoutStore.set('scout_tool_v1',data);await scoutStore.ready();
      await psSaveSharedAsync('process_coach_v1',JSON.stringify(schedule));await PSStorage.sharedVerified('process_coach_v1',JSON.stringify(schedule));
      const seal=localStorage.getItem('ps_cache_owner_v1');localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:{w:WID,u:UID,o:seal,present:true},cs_scout_targets_v1:{w:WID,u:UID,o:seal,present:false}}}));
      await scPrepare();load();await scoutStore.ready(true);availRange=14;availDay=null;setView('avail');
    },{fixture,schedule,UID,WID});
    await frame.locator('[data-av-date="2026-09-11"]').waitFor();
    // 토글은 조별 보기에만 · 처음은 꺼짐 · 켜면 조마다 학년 줄(학년을 적은 선수가 있는 조만)
    const tog='[data-av-ysplit]';
    assert.equal(await frame.locator('#avDailyCard '+tog).count(),1);assert.equal(await frame.locator('#avDailyCard '+tog).getAttribute('aria-pressed'),'false');
    assert.equal(await frame.locator('#avDailyCard .av-ysub').count(),0);
    await frame.locator('#avDailyCard '+tog).click();await frame.locator('#avDailyCard .av-ysub').first().waitFor();
    const subs=()=>frame.evaluate(()=>[...document.querySelectorAll('#avDailyCard .av-ysub')].map(e=>e.textContent.replace(/\s+/g,' ').trim()));
    // A팀: p1(1학년 · 정상) p2(1학년 · 부상) p5(2학년 · 정상) · B팀: p3(2학년 · 재활 — 쉼 상자) p4(학년 없음 · 정상)
    assert.deepEqual(await subs(),['1학년 가능 1 / 2명','2학년 가능 1 / 1명','학년 미지정 가능 1 / 1명'],'데스크톱 · 폰 같은 셈(이 명단은 모두 기록돼 있다)');
    const tags=await frame.evaluate(()=>[...document.querySelectorAll('#avDailyCard .av-yr')].map(e=>[e.closest('.av-pl').querySelector('[data-av-st]').dataset.avSt,e.textContent,getComputedStyle(e).display]));
    assert.deepEqual(tags.filter(t=>t[2]!=='none').map(t=>t[0]+':'+t[1]).sort(),['p2:1학년','p3:2학년'],'학년 줄 아래가 아닌 쉼 선수만 자리 옆 학년');
    assert.ok(tags.some(t=>t[0]==='p5'&&t[2]==='none'),'학년 줄 아래 행의 꼬리표는 숨긴다');
    await page.screenshot({path:path.join(out,width+'-year-split-days.png'),fullPage:true});
    await frame.locator('#avDailyCard [data-av-view=pos]').click();await frame.locator('#avDailyCard [data-av-view=pos].on').waitFor();
    assert.equal(await frame.locator('#availRoot '+tog).count(),0,'포지션별에는 단추가 없다');assert.equal(await frame.locator('#avDailyCard .av-ysub').count(),0);
    await frame.locator('#avDailyCard [data-av-view=grp]').click();await frame.locator('#avDailyCard .av-ysub').first().waitFor();assert.equal((await subs()).length,3);
    // 새로고침 뒤에도 켜진 채(이 기기 기억)
    await page.reload();frame=await ready(page);await frame.evaluate(()=>{availRange=14;setView('avail');});
    await frame.locator('#avDailyCard .av-ysub').first().waitFor();assert.equal(await frame.locator('#avDailyCard '+tog).getAttribute('aria-pressed'),'true');
    // 선수별 누적 표도 같은 단추 — 조 줄 아래 학년 줄
    await frame.locator('[data-av-mode=players]').click();await frame.locator('[data-av-player-total=p1]').waitFor();
    const rows=await frame.evaluate(()=>[...document.querySelectorAll('#availRoot .av-total-table tbody tr')].map(tr=>tr.classList.contains('av-table-group')?'G:'+tr.textContent.trim():tr.classList.contains('av-table-year')?'Y:'+tr.textContent.replace(/\s+/g,' ').trim():'P:'+tr.querySelector('[data-av-player-total]').dataset.avPlayerTotal));
    assert.deepEqual(rows,['G:A팀','Y:1학년 2명','P:p1','P:p2','Y:2학년 1명','P:p5','G:B팀','Y:2학년 1명','P:p3','Y:학년 미지정 1명','P:p4']);
    await page.screenshot({path:path.join(out,width+'-year-split-table.png'),fullPage:true});
    await frame.locator('#availRoot '+tog).click();await frame.waitForFunction(()=>!document.querySelector('#availRoot .av-table-year'));
    assert.equal(await frame.locator('#availRoot '+tog).getAttribute('aria-pressed'),'false');
    // 선수 추가 시트 — 조(표시 이름 · 저장은 키) · 학년
    await frame.evaluate(()=>{setView('team');window.__tmAddSheet();});
    const grpSel=frame.locator('select[data-k="grp"]');await grpSel.waitFor();
    assert.deepEqual(await grpSel.evaluate(s=>[...s.options].map(o=>o.value+'='+o.textContent)),['=없음','A팀=A팀','B팀=B팀','C팀=C팀'],'기본 조(C팀 포함) — 이름은 표시 이름, 값은 키');
    assert.equal(await frame.locator('[data-seg="schoolYear"] button').count(),4);
    await frame.locator('input[data-k="name"]').fill('가상 새 선수');await grpSel.selectOption('B팀');await frame.locator('[data-seg="schoolYear"] button[data-v="3"]').click();
    await page.screenshot({path:path.join(out,width+'-add-sheet.png')});
    await frame.locator('[data-act="ok"]').click();await frame.locator('select[data-k="grp"]').waitFor({state:'detached'});await flush(frame);
    assert.deepEqual(await frame.evaluate(()=>{const p=data.players.find(x=>x.name==='가상 새 선수');return p&&{grp:p.grp,y:p.schoolYear};}),{grp:'B팀',y:'3'});
    // 선수 편집 창 — «구분» 아래 조 · 학년 칩, 누르면 같은 저장 길
    await frame.evaluate(()=>openPlayer('p4'));await frame.locator('#plYearChips button').first().waitFor();
    const chips=id=>frame.evaluate(id=>[...document.querySelectorAll('#'+id+' button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')),id);
    assert.deepEqual(await chips('plGrpChips'),['없음','A팀','B팀*','C팀']);assert.deepEqual(await chips('plYearChips'),['미지정*','1학년','2학년','3학년']);
    assert.ok(await frame.evaluate(()=>{const f=document.getElementById('plTypeChips').closest('.field');return f.nextElementSibling.contains(document.getElementById('plGrpChips'))&&f.nextElementSibling.nextElementSibling.contains(document.getElementById('plYearChips'));}),'«구분» 바로 아래');
    await frame.locator('#plYearChips button',{hasText:'2학년'}).click();await flush(frame);
    assert.equal(await frame.evaluate(()=>data.players.find(x=>x.id==='p4').schoolYear),'2');assert.deepEqual(await chips('plYearChips'),['미지정','1학년','2학년*','3학년']);
    await frame.locator('#plGrpChips button',{hasText:'A팀'}).click();await flush(frame);
    assert.deepEqual(await frame.evaluate(()=>{const d=JSON.parse(localStorage.getItem('scout_tool_v1')),p=d.players.find(x=>x.id==='p4');return [p.grp,p.schoolYear];}),['A팀','2'],'기기 저장본에도 같은 값');
    await page.screenshot({path:path.join(out,width+'-edit-chips.png')});
    await frame.locator('#plYearChips button',{hasText:'미지정'}).click();await flush(frame);
    assert.equal(await frame.evaluate(()=>'schoolYear' in data.players.find(x=>x.id==='p4')),false,'미지정은 칸을 지운다');
    await frame.evaluate(()=>closePlayer());
    const geometry=await frame.locator('#availRoot').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,viewport:innerWidth,body:document.documentElement.scrollWidth}));
    assert.ok(geometry.body<=width+1,JSON.stringify(geometry));assert.deepEqual(errors,[]);
    results.push({engine,width,passed:true,yearSplit:true,addSheet:true,editChips:true,geometry});
    console.log(JSON.stringify({engine,width,passed:true}));await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'3.281 year split · add sheet · edit chips — local actual scout.html with synthetic players, dates and storage. All external requests blocked.',results},null,2));
}catch(error){
  for(const context of browser?.contexts()||[])for(const page of context.pages()){
    await page.screenshot({path:path.join(out,'failure-'+page.viewportSize().width+'.png')}).catch(()=>{});
    for(const frame of page.frames().filter(f=>/studio\/scout\.html/.test(f.url())))console.error(JSON.stringify(await frame.evaluate(()=>({model:typeof window.PSParticipation,perms:typeof window.PSPerms,render:typeof renderAvail,boot:typeof scoutBootPending==='undefined'?'missing':scoutBootPending,ready:document.readyState,body:document.body.innerText.slice(0,1500)}))));
  }
  throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
