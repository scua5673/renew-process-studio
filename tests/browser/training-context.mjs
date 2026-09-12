import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/training-context');
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));}catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
const UID='fixture-context-coach',WID='fixture-context-team';
const iso=d=>d.toISOString().slice(0,10),add=(date,days)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monday=new Date(today+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
const anchor=iso(monday),DATES={past:add(anchor,-6),current:add(anchor,1),next:add(anchor,8)};
const WEEKS={past:-1,current:0,next:1};
function fixture(){
  const weeks={};for(const w of [-1,0,1]){
    weeks[w]=['월','화','수','목','금','토','일'].map((d,i)=>({d,n:i+1,rest:true,trainings:[]}));
    weeks[w][1]={d:'화',n:2,rest:false,trainings:[
      {slot:'fixture-a',time:'17:00',grp:'A팀',players:2,load:{rpe:4},blocks:[]},
      {slot:'fixture-b',time:'17:00',grp:['B팀'],players:2,load:{rpe:5},blocks:[]}
    ],board:{sched:'훈련',theme:'',trains:['A조 훈련','B조 훈련'],trainSlot:['fixture-a','fixture-b'],trainData:[{minutes:20,sets:3},{minutes:30,sets:2}]}};
  }
  const roster={players:[],positions:[{id:'pos-cm',name:'CM'}],meta:{grpBase:['A팀','B팀','C팀']}};
  const members={[UID]:{role:'executive'}},docs={},pubs={};
  for(const [pid,grp,rpe] of [['a1','A팀',6],['a2','A팀',8],['b1','B팀',4],['b2','B팀',10]]){
    const uid='fixture-'+pid;roster.players.push({id:pid,name:'선수 '+pid.toUpperCase(),grp,posId:'pos-cm',num:pid==='a1'?7:8,type:'ours'});members[uid]={role:'player',playerId:pid};
    const focusByWk={};for(const [name,date] of Object.entries(DATES))focusByWk[add(date,-1)]={wk:add(date,-1),text:`${name.toUpperCase()}-FOCUS-${pid}`,from:'me',at:Date.now()};
    docs[uid]={v:1,focusByWk,focus:focusByWk[anchor],log:{[DATES.current]:{t:'team',rpe,memo:'가상 참여 기록'},[add(DATES.current,1)]:{t:'rest',rpe:9}}};
    pubs[uid]={reviews:[
      {at:add(DATES.past,-2),goals:[{t:'OLDER-COACH-'+pid}]},
      {at:DATES.past,goals:[{t:'SAME-DAY-FIRST-'+pid}]},
      {at:DATES.past,goals:[{t:'SAME-DAY-LAST-'+pid,cat:'O.1',dec:'가상 의사결정'}]},
      {at:add(DATES.past,1),goals:[{t:'AFTER-PAST-'+pid}]},
      {at:add(DATES.current,-1),goals:[{t:'CURRENT-COACH-'+pid}]},
      {at:add(DATES.next,-1),goals:[{t:'NEXT-COACH-'+pid}]},
      {at:add(DATES.next,1),goals:[{t:'AFTER-NEXT-'+pid}]}
    ]};
  }
  roster.players.push({id:'c-unlinked',name:'연결 전 선수',grp:'C팀',type:'ours'});
  return {schedule:{version:1,anchorMonday:anchor,scheduleRev:1,weeks},roster,permissions:{v:1,defaultRole:'player',members},docs,pubs,deletedPlayers:{}};
}
function edgeFixture(){
  const f=fixture();
  const extras=[['invalid',{t:'team',rpe:'7junk'}],['range',{t:'team',rpe:11}],['zero',{t:'team',rpe:0}],['rest',{t:'rest',rpe:9}],['injury',{t:'injury',rpe:10}],['missing',{memo:'NOTE-ONLY-ZERO-RESPONSES'}],['ambiguous',{t:'team',rpe:10}],['deleted',{t:'team',rpe:10}],['target',{t:'team',rpe:10}],['unlinked',{t:'team',rpe:10}]];
  extras.forEach(([pid,log])=>{
    f.roster.players.push({id:pid,name:'EXCLUDE-'+pid,grp:'A팀',type:pid==='target'?'target':'ours'});
    const uid='fixture-'+pid;if(pid!=='unlinked')f.permissions.members[uid]={role:'player',playerId:pid};
    f.docs[uid]={v:1,focusByWk:{[anchor]:{wk:anchor,text:'EXCLUDE-FOCUS-'+pid}},log:{[DATES.current]:log}};
    f.pubs[uid]={reviews:[]};
  });
  f.permissions.members['fixture-ambiguous-second']={role:'player',playerId:'ambiguous'};
  f.docs['fixture-ambiguous-second']={v:1,log:{[DATES.current]:{t:'team',rpe:10}}};
  f.deletedPlayers.deleted=Date.now();
  return f;
}
async function makeContext(browser,spec,role='executive',locked=false){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:!!spec.mobile,hasTouch:!!spec.touch,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await context.addInitScript(({uid,wid,role,locked,initial})=>{
    if(!localStorage.getItem('fixture-context-seeded')){
      localStorage.setItem('fixture-context-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-access-token',rt:'fixture-refresh-token'}));
      localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:role==='executive'?'owner':'member',name:'가상 검증 팀'}]));
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));
      localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[uid]:{role}}}));
      localStorage.setItem('cs_wkmode','ses');localStorage.setItem('cs_lang','ko');
      initial.permissions.members[uid]={role};
      localStorage.setItem('process_coach_v1',JSON.stringify(initial.schedule));
      localStorage.setItem('scout_tool_v1',JSON.stringify(initial.roster));
      localStorage.setItem('cs_perms_v1',JSON.stringify(initial.permissions));
      localStorage.setItem('cs_player_del_v1',JSON.stringify(initial.deletedPlayers));
      for(const [id,doc] of Object.entries(initial.docs))localStorage.setItem('cs_idp_v1_'+id,JSON.stringify(doc));
      for(const [id,doc] of Object.entries(initial.pubs))localStorage.setItem('cs_idp_pub_v1_'+id,JSON.stringify(doc));
    }
    window.fixtureLocked=locked;
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')||'null'),
      activeWs:()=>localStorage.getItem('ps_active_ws'),activeWsObj:()=>JSON.parse(localStorage.getItem('ps_ws_list')||'[]').find(w=>w.id===localStorage.getItem('ps_active_ws')),
      dataUnlocked:()=>!window.fixtureLocked,keyReady:()=>!window.fixtureLocked,syncNow:()=>Promise.resolve({fixture:true}),act(){},ping(){}};
  },{uid:UID,wid:WID,role,locked,initial:fixture()});
  return context;
}
async function ready(page){
  await page.waitForFunction(()=>window.PSSessionFocus&&window.PSDailyEffort&&window.PSStorage&&window.PSPerms&&typeof loadState==='function'&&typeof wksFillRender==='function');
  await page.evaluate(()=>PSStorage.sharedReady());
}
async function seed(page,f,role='executive'){
  await page.evaluate(({f,uid,role})=>{
    if(curSession)cancelSession();else closeSheet();
    f.permissions.members[uid]={role};
    localStorage.setItem('scout_tool_v1',JSON.stringify(f.roster));localStorage.setItem('cs_perms_v1',JSON.stringify(f.permissions));
    localStorage.setItem('cs_player_del_v1',JSON.stringify(f.deletedPlayers));
    for(const [uid,doc] of Object.entries(f.docs))localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify(doc));
    for(const [uid,doc] of Object.entries(f.pubs))localStorage.setItem('cs_idp_pub_v1_'+uid,JSON.stringify(doc));
    const raw=JSON.stringify(f.schedule);localStorage.setItem('process_coach_v1',raw);loadState({raw});
    wk=0;dayIdx=1;week=weeksMap[wk];go('schedule');setWkMode('ses');focusScheduleDate(0,1);syncViews(false);
  },{f,uid:UID,role});
}
async function focus(page,period='current'){
  await page.evaluate(w=>{if(curSession)cancelSession();else closeSheet();focusScheduleDate(w,1);wk=w;week=weeksMap[w];dayIdx=1;syncViews(false);},WEEKS[period]);
}
async function openFocus(page,period='current',slot='fixture-a',legacy=false){
  await focus(page,period);
  await page.evaluate(({slot,legacy})=>{if(legacy)openSession(1,slot==='fixture-b'?1:0);else wksFill(1,slot);},{slot,legacy});
  const detail=page.locator('#sheet details.session-focus-reference');
  await detail.waitFor({state:'visible'});
  assert.equal(await detail.count(),1,'the reference card is a details disclosure');
  assert.equal(await detail.getAttribute('open'),null,'personal references start folded');
  await detail.locator('summary').click();
  return detail;
}
async function capture(page,spec,name,selector){
  const element=page.locator(selector);await element.scrollIntoViewIfNeeded();
  const layout=await element.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth};});
  assert.ok(layout.left>=-1&&layout.right<=layout.width+1,`${spec.name} ${name}: fits viewport`);
  assert.ok(layout.scrollWidth<=layout.clientWidth+1,`${spec.name} ${name}: no horizontal overflow`);
  await page.screenshot({path:path.join(out,`${spec.name}-${name}.png`),animations:'disabled'});return layout;
}
async function review(page,group=''){
  await focus(page,'current');await page.evaluate(()=>go('review'));
  await page.locator('#trainingEffortCard').waitFor({state:'visible'});
  await page.locator('#effortGroup').selectOption(group);
  return page.locator('#trainingEffortCard');
}
async function adminScenario(page,spec){
  const cases=[],layouts={};const baseFixture=fixture();await seed(page,baseFixture);
  const journalsBefore=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>/^cs_idp_(?:pub_)?v1_/.test(k)).sort().map(k=>[k,localStorage.getItem(k)])));
  let card=await openFocus(page,'past');let text=await card.innerText();
  assert.ok(text.includes(DATES.past)&&text.includes('PAST-FOCUS-a1')&&text.includes('SAME-DAY-LAST-a1'));
  for(const wrong of ['CURRENT-FOCUS','NEXT-FOCUS','SAME-DAY-FIRST','AFTER-PAST','AFTER-NEXT','PAST-FOCUS-b'])assert.ok(!text.includes(wrong),wrong+' must not leak into past A session');
  layouts.past=await capture(page,spec,'past-a-focus','#sheet details.session-focus-reference');cases.push('modern-past-date-group-history');
  card=await openFocus(page,'next');text=await card.innerText();assert.ok(text.includes(DATES.next)&&text.includes('NEXT-FOCUS-a1')&&text.includes('NEXT-COACH-a1'));assert.ok(!text.includes('AFTER-NEXT'));cases.push('modern-next-week');
  card=await openFocus(page,'past','fixture-b',true);text=await card.innerText();assert.ok(text.includes('PAST-FOCUS-b1')&&!text.includes('PAST-FOCUS-a1'));cases.push('legacy-date-group-context');
  card=await openFocus(page,'next','fixture-b',true);text=await card.innerText();assert.ok(text.includes('NEXT-FOCUS-b1')&&text.includes('NEXT-COACH-b1')&&!text.includes('AFTER-NEXT'));cases.push('legacy-next-week-context');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>/^cs_idp_(?:pub_)?v1_/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))),journalsBefore,'opening and expanding references never rewrites journals or reviews');
  const inherited=fixture();inherited.schedule.weeks[0][1].grp='B팀';inherited.schedule.weeks[0][1].trainings[0].grp=[];await seed(page,inherited);
  card=await openFocus(page);text=await card.innerText();assert.ok(text.includes('CURRENT-FOCUS-b1')&&!text.includes('CURRENT-FOCUS-a1'));cases.push('empty-session-array-inherits-day-group');
  inherited.schedule.weeks[0][1].trainings[0].grp='';await seed(page,inherited);
  card=await openFocus(page);text=await card.innerText();assert.ok(text.includes('CURRENT-FOCUS-b1')&&!text.includes('CURRENT-FOCUS-a1'));cases.push('empty-session-string-inherits-day-group');
  const common=fixture();common.schedule.weeks[0][1].trainings[0].grp=[];await seed(page,common);
  card=await openFocus(page);text=await card.innerText();assert.ok(text.includes('CURRENT-FOCUS-a1')&&text.includes('CURRENT-FOCUS-b1'));assert.match(text,/출석|참가/);cases.push('common-does-not-claim-exact-attendance');
  await seed(page,baseFixture);let rows=await review(page,'A팀');text=await rows.innerText();
  assert.match(text,/7\.0\s*\/\s*10/);assert.match(text,/응답\s*2\s*\/\s*연결\s*2/);assert.ok(!/840|420|300/.test(text));
  const plan=await page.evaluate(()=>({minutes:reviewStats().mins,load:reviewStats().load,perDay:reviewStats().perDay[1].load}));
  assert.deepEqual(plan,{minutes:120,load:540,perDay:540},'original planned time/load stays unchanged '+JSON.stringify(await page.evaluate(()=>({wk,day:week[1]}))));
  assert.match(await page.locator('#lbars').innerText(),/540/,'the actual planned-load chart shows 540');
  assert.equal(await page.locator('#statMin').innerText(),'120');
  layouts.effort=await capture(page,spec,'effort-a','#trainingEffortCard');cases.push('independent-rpe-no-minute-multiplication');
  rows=await review(page,'B팀');assert.match(await rows.innerText(),/7\.0\s*\/\s*10/);cases.push('independent-effort-group-selection');
  await page.evaluate(date=>{const key='cs_idp_v1_fixture-b1',doc=JSON.parse(localStorage.getItem(key));doc.log[date].rpe=10;localStorage.setItem(key,JSON.stringify(doc));window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(doc)}));},DATES.current);
  assert.equal(await page.locator('#effortGroup').inputValue(),'B팀','another frame diary update keeps the chosen group');
  assert.match(await page.locator('#dailyEffortRows').innerText(),/10\.0\s*\/\s*10/);assert.match(await page.locator('#lbars').innerText(),/540/);cases.push('diary-update-retains-group-and-planned-chart');
  rows=await review(page,'C팀');assert.match(await rows.innerText(),/연결된 선수가 없습니다/);assert.equal(await rows.locator('.daily-effort-main').count(),0);cases.push('zero-linked-responses');
  await seed(page,edgeFixture());card=await openFocus(page);text=await card.innerText();
  for(const pid of ['deleted','target','unlinked','ambiguous'])assert.ok(!text.includes('EXCLUDE-FOCUS-'+pid)&&!text.includes('EXCLUDE-'+pid),pid+' has no private focus reference');
  assert.ok(text.includes('CURRENT-FOCUS-a1'));cases.push('focus-excludes-deleted-target-unlinked-ambiguous-identities');
  rows=await review(page,'A팀');text=await rows.innerText();assert.match(text,/7\.0\s*\/\s*10/);assert.match(text,/휴식|부상/);assert.match(text,/잘못|범위/);assert.match(text,/연결 확인/);cases.push('invalid-off-zero-unlinked-deleted-target-ambiguous-excluded');
  const noResponse=fixture();for(const doc of Object.values(noResponse.docs))doc.log[DATES.current]={memo:'NOTE-ONLY-ZERO-RESPONSES'};
  await seed(page,noResponse);rows=await review(page,'A팀');text=await rows.innerText();assert.match(text,/응답 0 \/ 연결 2/);assert.equal(await rows.locator('.daily-effort-main b[aria-label="확인된 강도 없음"]').count(),7);assert.ok(!/0\.0\s*\/\s*10/.test(text));cases.push('note-only-is-missing-not-zero');
  await seed(page,baseFixture);await review(page,'A팀');await openFocus(page,'current');
  const cleared=await page.evaluate(()=>{window.fixtureLocked=true;window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:false}}));return {references:document.querySelectorAll('.session-focus-reference').length,effort:document.getElementById('trainingEffortCard').textContent,display:getComputedStyle(document.getElementById('trainingEffortCard')).display};});
  assert.deepEqual(cleared,{references:0,effort:'',display:'none'},'auth lock clears protected text synchronously');
  await page.evaluate(()=>{wksFillRender(false);renderDailyEffort();});
  assert.equal(await page.locator('.session-focus-reference').count(),0);assert.equal(await page.locator('#trainingEffortCard').textContent(),'');cases.push('live-lock-clears-references-and-effort-synchronously');
  return {cases,layouts,plan};
}
async function staffScenario(page,spec){
  await seed(page,fixture(),'staff');
  assert.deepEqual(await page.evaluate(()=>({role:PSPerms.role(),edit:PSPerms.canEdit('schedule')})),{role:'staff',edit:false});
  await review(page,'A팀');const select=page.locator('#effortGroup');
  assert.equal(await select.isEnabled(),true,'staff can use the read-only cohort filter');
  await select.scrollIntoViewIfNeeded();
  const state=await select.evaluate(el=>{const r=el.getBoundingClientRect();return {pointerEvents:getComputedStyle(el).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===el};});
  assert.deepEqual(state,{pointerEvents:'auto',hit:true},'staff filter is reachable by a real pointer');
  await select.selectOption('B팀');assert.equal(await select.inputValue(),'B팀');
  assert.match(await page.locator('#dailyEffortRows').innerText(),/7\.0\s*\/\s*10/);
  const layout=await capture(page,spec,'staff-effort-b','#trainingEffortCard');
  assert.deepEqual(await page.evaluate(()=>({minutes:reviewStats().mins,load:reviewStats().load})),{minutes:120,load:540});
  return {state,layout};
}
async function protectedScenario(page,role){
  assert.ok((await page.evaluate(()=>localStorage.getItem('cs_idp_v1_fixture-a1'))).includes('CURRENT-FOCUS-a1'),'the privacy fixture contains records before access is checked');
  await page.evaluate(()=>{
    const raw=localStorage.getItem('process_coach_v1');loadState({raw});wk=0;dayIdx=1;week=weeksMap[0];
    go('review');__fillDi=1;__fillSlot='fixture-a';wksFillRender(false);openSession(1,0);
  });
  assert.equal(await page.locator('#sheet .sfocus').count(),0,'protected session context is not rendered');
  assert.equal(await page.locator('#trainingEffortCard').isVisible(),false,'protected effort card stays hidden');
  assert.ok(!(await page.locator('body').innerText()).includes('FOCUS-a1'),'private focus text is absent');
}
let browser;const results=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [{name:'375-phone',width:375,height:812,mobile:true,touch:true},{name:'393-phone',width:393,height:852,mobile:true,touch:true},{name:'768-tablet',width:768,height:900,touch:true},{name:'1280-desktop',width:1280,height:900}]){
    const context=await makeContext(browser,spec),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+'/studio/process.html?fixture=training-context',{waitUntil:'domcontentloaded'});await ready(page);
    const result=await adminScenario(page,spec);assert.deepEqual(errors,[]);await context.close();
    const staffContext=await makeContext(browser,spec,'staff'),staffPage=await staffContext.newPage();
    staffPage.on('pageerror',e=>errors.push(String(e)));
    await staffPage.goto(base+'/studio/process.html?fixture=training-context',{waitUntil:'domcontentloaded'});await ready(staffPage);
    result.staff=await staffScenario(staffPage,spec);result.cases.push('staff-readonly-filter-real-pointer');await staffContext.close();
    for(const [name,role,locked] of [['player','player',false],['locked','executive',true]]){
      const c=await makeContext(browser,spec,role,locked),p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(base+'/studio/process.html?fixture=training-context',{waitUntil:'domcontentloaded'});await ready(p);await protectedScenario(p,role);result.cases.push(name+'-no-private-context');await c.close();
    }
    assert.deepEqual(errors,[]);
    results.push({viewport:spec.name,...result,pageErrors:errors});
  }
  fs.writeFileSync(path.join(out,'training-context-results.json'),JSON.stringify({ok:true,build,dates:DATES,method:'Isolated local Chrome with synthetic accounts, records and tokens. All non-local requests blocked. Actual process UI functions and real PSPerms.',results},null,2));
  console.log(JSON.stringify({ok:true,build,output:out,viewports:results.length,cases:results.reduce((n,r)=>n+r.cases.length,0)},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
