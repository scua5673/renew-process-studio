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
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/avail-absent-keep'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
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
/* 불참은 바꿀 때까지 — 가용인원 표에서 «불참»으로 바꾼 선수는 날짜가 바뀐 뒤에도 «불참»이고, 다른 상태로 바꾸면 거기서 끝난다.
   휴식은 예전처럼 하루, statusUntil 이 붙은 옛 불참(이 판 전에 누른 것)도 예전처럼 하루. 고치기 전 코드는 «다음 날에도 불참»에서 떨어진다. */
const NOW='fixture-attendance-now';
async function open(frame){
  await frame.evaluate(async()=>{await PSStorage.sharedReady();await scPrepare();load();await scoutStore.ready(true);availRange=14;availDay=null;setView('avail');});
  await frame.locator('#avDailyCard [data-av-st="p4"]').waitFor();
}
async function row(frame,pid){return frame.evaluate(pid=>{const p=data.players.find(x=>x.id===pid),b=document.querySelector('#avDailyCard [data-av-st="'+pid+'"]'),tr=b.closest('tr'),_s=b.scrollIntoView({block:'center'}),r=b.getBoundingClientRect(),ij=tr.querySelector('.c-ij'),ir=ij.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return {mem:p.status,until:p.statusUntil||'',now:plStatusOf(p),chip:b.textContent.replace(/[\s⌄]+/g,''),inj:ij.textContent.replace(/\s+/g,' ').trim(),rest:tr.classList.contains('rest'),
    box:[Math.round(r.width),Math.round(r.height)],hit:!!(hit&&hit.closest('[data-av-st="'+pid+'"]')),injIn:ir.left>=0&&ir.right<=innerWidth+1,over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    runs:((data.meta.statusRuns||{})[pid]||[]).map(x=>x.s+':'+x.from+'~'+x.to)};},pid);}
async function tomorrow(page,iso){await page.evaluate(({NOW,iso})=>localStorage.setItem(NOW,iso),{NOW,iso});await page.reload();const frame=await ready(page);await open(frame);return frame;}
let browser;const results=[];
try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1280,768,393]){
    const context=await makeContext(browser,width),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/fixture-attendance.html');let frame=await ready(page);
    const seed=JSON.parse(JSON.stringify(fixture));
    seed.players.push({id:'p6',name:'가상 옛불참',num:'6',grp:'B팀',posId:'fixture-cm',status:'out',statusUntil:TODAY});   // 이 판 전에 누른 불참(하루짜리)
    seed.meta.statusRuns.p6=[{s:'ok',from:'2026-09-02',to:'2026-09-14'},{s:'out',from:TODAY,to:TODAY}];
    await frame.evaluate(async({seed,schedule,UID,WID})=>{
      await PSStorage.sharedReady();data=JSON.parse(JSON.stringify(seed));scoutStore.set('scout_tool_v1',data);await scoutStore.ready();
      await psSaveSharedAsync('process_coach_v1',JSON.stringify(schedule));await PSStorage.sharedVerified('process_coach_v1',JSON.stringify(schedule));
      const seal=localStorage.getItem('ps_cache_owner_v1');localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:{w:WID,u:UID,o:seal,present:true},cs_scout_targets_v1:{w:WID,u:UID,o:seal,present:false}}}));
    },{seed,schedule,UID,WID});
    await open(frame);
    // ① 오늘(9/15) p4 를 불참 · p5 를 휴식으로
    await choose(frame,'p4','out');await choose(frame,'p5','rest');
    let a=await row(frame,'p4'),b=await row(frame,'p5');
    assert.deepEqual({mem:a.mem,until:a.until,chip:a.chip,inj:a.inj},{mem:'out',until:'',chip:'불참',inj:''},'불참은 날짜 없이 적힌다 · 첫날은 며칠째 없음: '+JSON.stringify(a));
    assert.deepEqual({mem:b.mem,until:b.until},{mem:'rest',until:TODAY},'휴식은 오늘만');
    // ② 다음 날(9/16) — 불참은 그대로, 휴식 · 옛 불참은 가능으로
    frame=await tomorrow(page,'2026-09-16T12:00:00+09:00');
    a=await row(frame,'p4');b=await row(frame,'p5');const c=await row(frame,'p6');
    assert.deepEqual({mem:a.mem,now:a.now,chip:a.chip,inj:a.inj,rest:a.rest},{mem:'out',now:'out',chip:'불참',inj:'2일째',rest:true},'다음 날에도 불참 · 2일째: '+JSON.stringify(a));
    assert.equal((await resolved(frame,'p4','2026-09-16')).s,'out');
    assert.deepEqual({now:b.now,chip:b.chip},{now:'ok',chip:'가능'},'휴식은 하루');
    assert.deepEqual({now:c.now,chip:c.chip},{now:'ok',chip:'가능'},'날짜가 붙은 옛 불참은 예전처럼 하루');
    assert.ok(a.hit&&a.box[1]>=22&&a.injIn&&a.over<=0,'상태 칩이 눌리고 며칠째 칸이 화면 안 · 가로 넘침 없음: '+JSON.stringify(a));
    // ②-2 날짜 밑 조별 요약 표(세 폭) — 이어진 불참이 B팀 «불참» 칸에 · 화면 안 · 잘린 칸 없음
    const gs=await frame.evaluate(()=>{const t=document.querySelector('#avDailyCard table.av-gsum'),r=t.getBoundingClientRect();window.scrollTo(0,0);t.scrollIntoView({block:'center'});
      return {b:[...t.querySelectorAll('tbody tr')].map(x=>[...x.children].map(c=>c.textContent.replace(/\s+/g,' ').trim()).join('|')).find(x=>x.startsWith('B팀')),inside:r.left>=0&&r.right<=innerWidth+1,
        clipped:[...t.querySelectorAll('th,td')].filter(c=>c.scrollWidth>c.clientWidth+1).length,over:document.documentElement.scrollWidth-document.documentElement.clientWidth};});
    assert.deepEqual(gs,{b:'B팀필드 1 · GK 0|1/ 3|1|0|1|0',inside:true,clipped:0,over:0},'요약 표: '+JSON.stringify(gs));
    await page.screenshot({path:path.join(out,width+'-next-day.png'),fullPage:true});
    // ②-3 3.373 · 3.374 — 조 안 차례: 가능 → 재활 → 부상 → 불참 → 휴식(휴식은 맨 뒤). A팀 한 조에 다섯 상태를 다 만들어 줄 차례를 본다
    await frame.evaluate(()=>{const set=(id,o)=>Object.assign(data.players.find(p=>p.id===id),o);set('p3',{grp:'A팀'});set('p4',{grp:'A팀'});set('p6',{grp:'A팀',status:'rest',statusUntil:stYmd()});save();renderAvail();});
    await frame.locator('#avDailyCard [data-av-st="p6"]').waitFor();
    const ord=await frame.evaluate(()=>{const grp=id=>data.players.find(p=>p.id===id).grp;
      return [...document.querySelectorAll('#avDailyCard tr.av-pl')].filter(tr=>grp(tr.dataset.avPid)==='A팀').map(tr=>tr.querySelector('[data-av-st]').textContent.replace(/[\s⌄]+/g,''));});
    const rank=['가능','재활','부상','불참','휴식'],seq=ord.filter((s,i)=>s!==ord[i-1]);
    assert.deepEqual(seq,rank,'A팀 줄 차례: '+ord.join(','));
    assert.deepEqual(ord.map(s=>rank.indexOf(s)),ord.map(s=>rank.indexOf(s)).slice().sort((a,b)=>a-b),'차례가 뒤섞이지 않는다: '+ord.join(','));
    await frame.evaluate(()=>{const set=(id,o)=>Object.assign(data.players.find(p=>p.id===id),o);set('p3',{grp:'B팀'});set('p4',{grp:'B팀'});const p=set('p6',{grp:'B팀',status:'ok'});delete p.statusUntil;save();renderAvail();});
    await frame.locator('#avDailyCard [data-av-st="p6"]').waitFor();
    // ③ 그다음 날(9/17)에도 불참 → «가능»으로 바꾸면 거기서 끝난다 · 지난 이틀은 불참 그대로
    frame=await tomorrow(page,'2026-09-17T12:00:00+09:00');
    a=await row(frame,'p4');assert.deepEqual({now:a.now,inj:a.inj},{now:'out',inj:'3일째'},'사흘째도 불참');
    await choose(frame,'p4','ok');a=await row(frame,'p4');
    assert.deepEqual({mem:a.mem,chip:a.chip,inj:a.inj},{mem:'ok',chip:'가능',inj:''},'바꾸면 끝');
    assert.deepEqual(a.runs.slice(-2),['out:2026-09-15~2026-09-16','ok:2026-09-17~2026-09-17'],'기록: '+a.runs.join(','));
    assert.equal((await resolved(frame,'p4','2026-09-16')).s,'out','지난 날 기록은 그대로');
    frame=await tomorrow(page,'2026-09-18T12:00:00+09:00');
    assert.equal((await row(frame,'p4')).now,'ok','다음 날에도 가능');
    assert.deepEqual(errors,[],'page errors');
    results.push({engine,width,passed:true});console.log(JSON.stringify(results[results.length-1]));
    await context.close();
  }
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();server.close();}
