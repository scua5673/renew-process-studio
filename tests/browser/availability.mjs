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
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/availability'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
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
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,timezoneId:'Asia/Seoul',serviceWorkers:'block'});
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
async function flush(frame){await frame.evaluate(async()=>{await store.ready();if(window.PSStorage)await PSStorage.sharedReady();});}
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
  for(const width of [1280,393]){
    const context=await makeContext(browser,width),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/fixture-attendance.html');let frame=await ready(page);
    await frame.evaluate(async({fixture,schedule,UID,WID})=>{
      await PSStorage.sharedReady();data=JSON.parse(JSON.stringify(fixture));store.set('scout_tool_v1',data);await store.ready();
      await psSaveSharedAsync('process_coach_v1',JSON.stringify(schedule));await PSStorage.sharedVerified('process_coach_v1',JSON.stringify(schedule));
      const seal=localStorage.getItem('ps_cache_owner_v1');localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:{w:WID,u:UID,o:seal,present:true},cs_scout_targets_v1:{w:WID,u:UID,o:seal,present:false}}}));
      await scPrepare();load();await store.ready(true);availRange=14;availDay=null;setView('avail');
    },{fixture,schedule,UID,WID});
    await frame.locator('[data-av-date="2026-09-11"]').waitFor();assert.equal(await frame.locator('.av-stale').count(),0);
    const initialRuns=await frame.evaluate(()=>JSON.stringify(data.meta.statusRuns.p2));
    await page.screenshot({path:path.join(out,width+'-days.png')});
    const dateButton=frame.locator('[data-av-date="2026-09-11"]');await dateButton.focus();await dateButton.press('Enter');await frame.locator('#avDailyCard').waitFor();
    assert.match(await frame.locator('#avDailyCard').innerText(),/9월\s*11일|9\/11/);
    const untouched=await frame.evaluate(()=>localStorage.getItem('scout_tool_v1'));
    await frame.locator('[data-av-st=p2]').click();await frame.locator('.av-pick [data-k=rest]').click();await frame.locator('.av-pick [data-av-note]').fill('닫으면 저장되지 않는 초안');
    await frame.locator('.av-pick [data-av-cancel]').first().click();assert.equal(await frame.evaluate(()=>localStorage.getItem('scout_tool_v1')),untouched);
    const note='합성 과거 정정 메모 <img src=x onerror="window.fixtureXss=2">';await choose(frame,'p2','ok',note,path.join(out,width+'-past-date-editor.png'));
    assert.equal((await resolved(frame,'p2','2026-09-11')).s,'ok');assert.equal((await resolved(frame,'p2','2026-09-11')).note,note);
    for(const day of ['2026-09-10','2026-09-12',TODAY])assert.equal((await resolved(frame,'p2',day)).s,'injury');
    assert.equal(await frame.evaluate(()=>data.players.find(p=>p.id==='p2').status),'injury');assert.equal(await frame.evaluate(()=>JSON.stringify(data.meta.statusRuns.p2)),initialRuns,'A past correction does not rewrite the current injury run');
    await frame.locator('[data-av-mode=players]').click();await frame.locator('[data-av-player-total=p1]').waitFor();
    for(const [pid,name,expected] of [['p1','training',2],['p1','match',1],['p1','exercise',3],['p2','training',1],['p2','injury',13],['p3','rehab',14],['p4','training',2],['p4','match',0],['p5','unknown',1]])assert.equal(await metric(frame,pid,name),expected,pid+' '+name);
    assert.equal(await frame.locator('#availRoot img[onerror],#availRoot script').count(),0);assert.equal(await frame.evaluate(()=>fixtureXss),0);
    await page.screenshot({path:path.join(out,width+'-player-totals.png')});
    if(width<600){
      for(const metric of ['exercise','rest','injury','rehab','unknown']){
        const bounds=await frame.locator('[data-av-player-total=p1]').locator('xpath=ancestor::tr').locator('[data-av-stat="'+metric+'"]').boundingBox();
        assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width,metric+' must be visible without horizontal scrolling');
      }
    }
    await frame.locator('[data-av-player-total=p2]').click();await frame.locator('#avPlayerHistory').waitFor();assert.ok((await frame.locator('#avPlayerHistory').innerText()).includes(note));
    await frame.waitForFunction(()=>document.getElementById('avPlayerHistory').getBoundingClientRect().top<=100);
    await page.screenshot({path:path.join(out,width+'-player-history.png')});
    await page.reload();frame=await ready(page);await frame.evaluate(()=>{availRange=14;setView('avail');});
    assert.equal((await resolved(frame,'p2','2026-09-11')).s,'ok');assert.equal((await resolved(frame,'p2','2026-09-11')).note,note);
    await frame.locator('[data-av-mode=days]').click();await frame.locator('[data-av-day="0"]').count().then(async n=>{if(n)await frame.locator('[data-av-day="0"]').click();});
    await choose(frame,'p1','injury','오늘 부상 시작');assert.equal(await frame.evaluate(()=>data.players.find(p=>p.id==='p1').status),'injury');
    await frame.evaluate(()=>{localStorage.setItem('fixture-attendance-now','2026-09-20T12:00:00+09:00');availDay=null;renderAvail();});await flush(frame);
    for(const day of ['2026-09-18','2026-09-19','2026-09-20'])assert.equal((await resolved(frame,'p1',day)).s,'injury');
    await frame.evaluate(()=>{localStorage.setItem('fixture-attendance-now','2026-09-21T12:00:00+09:00');availDay=null;renderAvail();});await choose(frame,'p1','ok','정상 복귀');
    assert.equal((await resolved(frame,'p1','2026-09-20')).s,'injury');assert.equal((await resolved(frame,'p1','2026-09-21')).s,'ok');assert.equal(await frame.evaluate(()=>data.players.find(p=>p.id==='p1').status),'ok');
    const geometry=await frame.locator('#availRoot').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,viewport:innerWidth,body:document.documentElement.scrollWidth}));
    assert.ok(geometry.body<=width+1,JSON.stringify(geometry));assert.equal(await frame.locator('.av-stale').count(),0);
    await page.screenshot({path:path.join(out,width+'-date-editor.png')});assert.deepEqual(errors,[]);
    // A real save suspended at its first durable-store barrier must not continue
    // after an account/team owner seal changes, or revive the dismissed dialog.
    const beforeRace=await frame.evaluate(()=>({raw:localStorage.getItem('scout_tool_v1'),seal:localStorage.getItem('ps_cache_owner_v1')}));
    await frame.locator('[data-av-st=p1]').click();await frame.locator('.av-pick [data-k=rest]').click();
    await frame.locator('.av-pick [data-av-note]').fill('새 계정으로 넘어가면 저장하면 안 되는 합성 초안');
    await frame.evaluate(()=>{window.fixtureOriginalReady=store.ready;store.ready=function(...args){window.fixtureReadyEntered=true;return new Promise(resolve=>{window.fixtureReleaseReady=()=>resolve(fixtureOriginalReady.apply(store,args));});};});
    await frame.locator('.av-pick [data-av-save]').click();await frame.waitForFunction(()=>window.fixtureReadyEntered===true);
    await frame.evaluate(()=>{const seal=JSON.parse(localStorage.getItem('ps_cache_owner_v1'));seal.nonce='changed-during-await';localStorage.setItem('ps_cache_owner_v1',JSON.stringify(seal));});
    await frame.locator('.av-pick').waitFor({state:'hidden'});await frame.evaluate(()=>{store.ready=fixtureOriginalReady;fixtureReleaseReady();});
    await frame.waitForFunction(()=>!avSaving);assert.equal(await frame.evaluate(()=>localStorage.getItem('scout_tool_v1')),beforeRace.raw);assert.equal(await frame.locator('.av-pick').count(),0);
    assert.deepEqual(errors,[]);
    results.push({engine,width,passed:true,pastDayOnly:true,notePersisted:true,cancelDoesNotSave:true,dateKeyboardAccessible:true,groupScheduleTotals:true,injuryThroughWeekend:true,normalReturnClosesFuture:true,noStaleBanner:true,htmlEscaped:true,ownerChangeDuringSaveBlocked:true,geometry});
    console.log(JSON.stringify({engine,width,passed:true}));await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Local actual scout.html with synthetic players, dates and storage. All external requests blocked.',results},null,2));
}catch(error){
  for(const context of browser?.contexts()||[])for(const page of context.pages()){
    await page.screenshot({path:path.join(out,'failure-'+page.viewportSize().width+'.png')}).catch(()=>{});
    for(const frame of page.frames().filter(f=>/studio\/scout\.html/.test(f.url())))console.error(JSON.stringify(await frame.evaluate(()=>({model:typeof window.PSParticipation,perms:typeof window.PSPerms,render:typeof renderAvail,boot:typeof scoutBootPending==='undefined'?'missing':scoutBootPending,ready:document.readyState,body:document.body.innerText.slice(0,1500)}))));
  }
  throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
