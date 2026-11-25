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
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/injury-report-3378'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
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
/* 3.378 — 가용인원 › 부상 리포트: 셋째 탭 · 팀 한 장(지금 부상 · 재활 / 이 기간 복귀 / 부위별) · 이름 → 개인 한 장 · A4(2480×3508) 그림 · 저장.
   새 저장 칸 없이 상태 기록 · 부상 기록만 읽는다. 고치기 전 코드는 첫 단계(탭 없음)에서 떨어진다. */
async function open(frame){
  await frame.evaluate(async()=>{await PSStorage.sharedReady();await scPrepare();load();await scoutStore.ready(true);
    const T='2026-09-15',set=(id,o)=>Object.assign(data.players.find(p=>p.id===id),o);
    data.meta.teamName='프로세스FC';
    data.meta.statusRuns={p1:[{s:'ok',from:'2026-09-02',to:T}],
      p2:[{s:'injury',from:'2026-09-02',to:T}],
      p3:[{s:'injury',from:'2026-09-02',to:'2026-09-08'},{s:'rehab',from:'2026-09-09',to:T}],
      p4:[{s:'ok',from:'2026-09-02',to:'2026-09-04'},{s:'injury',from:'2026-09-05',to:'2026-09-10'},{s:'ok',from:'2026-09-11',to:T}],
      p5:[{s:'ok',from:'2026-09-02',to:'2026-09-13'},{s:'injury',from:'2026-09-14',to:T}]};
    data.meta.injuryInfo={p2:{'2026-09-02':{at:1,part:'발목',side:'L',when:'match',n:'착지하다 꺾임 <b>반깁스</b>'}},p3:{'2026-09-02':{at:1,part:'햄스트링',side:'R',when:'train',n:'슈팅하다 당김'}},p4:{'2026-09-05':{at:1,part:'종아리'}}};
    set('p2',{status:'injury',statusUntil:'2026-09-20'});set('p3',{status:'rehab'});set('p4',{status:'ok'});set('p5',{status:'injury'});
    save();availRange=14;availDay=null;availMode='days';availInjPlayer=null;setView('avail');});
  await frame.locator('#avDailyCard [data-av-st="p4"]').waitFor();
}
async function look(frame){return frame.evaluate(()=>{const q=s=>[...document.querySelectorAll(s)],t=e=>e.textContent.replace(/\s+/g,' ').trim(),root=document.getElementById('avInjReport');
  const btn=document.querySelector('[data-ir-out="image"]'),r=btn.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return {tab:t(document.querySelector('.av-subnav .on')),kpi:q('.ir-kpi dd').map(t),now:q('.ir-now tbody tr').map(tr=>t(tr)),nowIds:q('.ir-now [data-ir-player]').map(b=>b.dataset.irPlayer),back:q('.ir-back tbody tr').map(t),parts:q('.ir-parts li').map(t),
    over:document.documentElement.scrollWidth-document.documentElement.clientWidth,inRoot:root.scrollWidth-root.clientWidth,btn:[Math.round(r.width),Math.round(r.height)],hit:!!(hit&&hit.closest('[data-ir-out="image"]')),
    season:!!document.querySelector('[data-av-range="season"]'),xss:window.fixtureXss||(window.parent&&window.parent.fixtureXss)||0,html:root.innerHTML.includes('<b>반깁스</b>')};});}
async function sheets(frame){return frame.evaluate(()=>{const o=irCanvases(tmOurs(),stAddDays(stYmd(),-13),stYmd());return {name:o.name,list:o.list.map(c=>{const g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let ink=0,red=0;for(let i=0;i<d.length;i+=4*97){if(d[i]<200||d[i+1]<200||d[i+2]<200)ink++;if(d[i]>170&&d[i+1]<100&&d[i+2]<100)red++;}return {w:c.width,h:c.height,ink,red,url:c.toDataURL('image/png')};})};});}
let browser;const results=[];
try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1280,768,393]){
    const context=await makeContext(browser,width),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
    await page.goto(base+'/fixture-attendance.html');
    const frame=await ready(page);page.setDefaultTimeout(20000);
    await frame.evaluate(async({seed,schedule,UID,WID})=>{
      await PSStorage.sharedReady();data=JSON.parse(JSON.stringify(seed));scoutStore.set('scout_tool_v1',data);await scoutStore.ready();
      await psSaveSharedAsync('process_coach_v1',JSON.stringify(schedule));await PSStorage.sharedVerified('process_coach_v1',JSON.stringify(schedule));
      const seal=localStorage.getItem('ps_cache_owner_v1');localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:{w:WID,u:UID,o:seal,present:true},cs_scout_targets_v1:{w:WID,u:UID,o:seal,present:false}}}));
    },{seed:fixture,schedule,UID,WID});
    await open(frame);
    // ① 셋째 탭 → 팀 리포트
    await frame.locator('[data-av-mode="injury"]').click();await frame.locator('#avInjReport').waitFor();
    let a=await look(frame);
    assert.equal(a.tab,'부상 리포트');assert.deepEqual(a.kpi,['2','1','1','1'],'부상 · 재활 · 7일 안 · 복귀');
    assert.deepEqual(a.nowIds,['p2','p3','p5'],'오래된 부상부터');
    assert.match(a.now[0],/부상.*발목.*왼쪽.*9\/2 · 14일째.*경기 중.*9\/20.*착지하다 꺾임/);assert.match(a.now[1],/재활.*햄스트링.*오른쪽.*9\/2 · 14일째.*훈련 중.*모름/);assert.match(a.now[2],/부상.*부위 적기.*9\/14 · 2일째/);
    assert.equal(a.back.length,1);assert.match(a.back[0],/가상 정상.*종아리.*9\/5 – 9\/10.*6일/);
    assert.equal(a.parts.length,4);assert.match(a.parts[a.parts.length-1],/부위 미정/);
    assert.equal(a.xss,0,'이름 · 메모는 글자로');assert.equal(a.html,false);
    assert.ok(a.over<=0&&a.inRoot<=1,'가로 넘침 '+a.over+' / '+a.inRoot+' @'+width);assert.ok(a.btn[1]>=36&&a.hit,'저장 단추 '+a.btn+' hit '+a.hit);assert.equal(a.season,true,'시즌 기간');
    await page.screenshot({path:path.join(out,engine+'-'+width+'-team.png'),fullPage:false});
    // ② A4 그림 — 2480×3508 한 장, 글자와 빨강(부상)이 실린다
    let s=await sheets(frame);
    assert.equal(s.list.length,1);assert.deepEqual([s.list[0].w,s.list[0].h],[2480,3508]);assert.ok(s.list[0].ink>300,'ink '+s.list[0].ink);assert.ok(s.list[0].red>0,'부상 색');assert.match(s.name,/^프로세스FC 부상 리포트 2026-09-15$/);
    if(width===1280)fs.writeFileSync(path.join(out,engine+'-a4-team.png'),Buffer.from(s.list[0].url.split(',')[1],'base64'));
    if(width===1280){const [dl]=await Promise.all([page.waitForEvent('download',{timeout:20000}),frame.locator('[data-ir-out="image"]').click()]);assert.equal(dl.suggestedFilename().normalize('NFC'),'프로세스FC 부상 리포트 2026-09-15.png');}
    // ③ 이름 → 개인 한 장 → 팀으로
    await frame.locator('.ir-now [data-ir-player="p3"]').click();await frame.locator('.ir-one').waitFor();
    const one=await frame.evaluate(()=>{const q=s=>[...document.querySelectorAll(s)],t=e=>e.textContent.replace(/\s+/g,' ').trim();return {name:t(document.querySelector('.ir-who .ir-t')),eps:q('.ir-ep').length,head:t(document.querySelector('.ir-ep-h')),facts:q('.ir-ep .ir-facts div').map(t),bar:q('.ir-ep .ir-bar i').map(i=>i.className+':'+Math.round(i.getBoundingClientRect().width)),memo:t(document.querySelector('.ir-p')),over:document.documentElement.scrollWidth-document.documentElement.clientWidth};});
    assert.equal(one.name,'가상 재활');assert.equal(one.eps,1);assert.match(one.head,/햄스트링 · 오른쪽.*진행 중/);
    assert.deepEqual(one.facts,['다친 날9/2 · 훈련 중','지금재활 7일째','복귀 예상모름','빠진 훈련 · 경기'+one.facts[3].replace('빠진 훈련 · 경기','')]);assert.match(one.facts[3],/\d+ · \d+$/);
    assert.equal(one.bar.length,2);assert.ok(one.bar.every(b=>+b.split(':')[1]>20),one.bar.join());assert.equal(one.memo,'슈팅하다 당김');assert.ok(one.over<=0,'개인 가로 넘침 @'+width);
    await page.screenshot({path:path.join(out,engine+'-'+width+'-player.png')});
    s=await sheets(frame);assert.equal(s.list.length,1);assert.match(s.name,/^가상 재활 부상 리포트/);assert.deepEqual([s.list[0].w,s.list[0].h],[2480,3508]);
    if(width===1280)fs.writeFileSync(path.join(out,engine+'-a4-player.png'),Buffer.from(s.list[0].url.split(',')[1],'base64'));
    await frame.locator('.ir-back-btn').click();await frame.locator('.ir-now').waitFor();
    // ④ «부위 적기» → 부상 기록 시트(원래 길) → 리포트에 바로
    await frame.locator('.ir-now [data-inj-edit="p5"]').click();await frame.locator('#stInjOv').waitFor();
    await frame.locator('#stInjOv .inj-c[data-f="part"] [data-v="무릎"]').click();await frame.locator('#stInjOv [data-inj-ok]').click();await frame.locator('#stInjOv').waitFor({state:'detached'});
    a=await look(frame);assert.equal(a.tab,'부상 리포트','저장 뒤에도 같은 탭');assert.match(a.now[2],/무릎/);assert.ok(!a.parts.some(x=>/부위 미정/.test(x)));
    // ⑤ 다른 탭에 갔다 와도 날짜별 · 누적은 그대로
    await frame.locator('[data-av-mode="players"]').click();await frame.locator('.av-total-table').waitFor();
    await frame.locator('[data-av-mode="days"]').click();await frame.locator('#avDailyCard').waitFor();
    assert.deepEqual(errors,[],'page errors');
    results.push({engine,width,passed:true});console.log(JSON.stringify(results[results.length-1]));
    await context.close();
  }
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();server.close();}
