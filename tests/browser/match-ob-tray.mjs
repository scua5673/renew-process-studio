import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
// 2.974 — 상대 분석 «우리 팀» 트레이: 끌어다 놓는 선수 목록만(선발·리저브 줄·버튼 없음, 숨은 선발 명단을 안 바꿈) · «우리 11»은 선수단 작전판에서
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/match-ob-tray-'+engine;fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
 if(pathname==='/fixture.html'){res.setHeader('Content-Type',mime['.html']);res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}</style><iframe src="/studio/scout.html"></iframe>');return;}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;const results=[];
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 for(const width of [1280,820,390]){
  const result={width,engine,cases:[]};results.push(result);
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<600,isMobile:width<600,serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(()=>{
   if(!localStorage.getItem('ob-seed')){
    localStorage.setItem('ob-seed','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid:'qa-coach',at:'synthetic'}));localStorage.setItem('ps_active_ws','qa-team');
    localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid:'qa-coach',wid:'qa-team',nonce:'test'}));
    localStorage.setItem('ps_ws_list',JSON.stringify([{id:'qa-team',kind:'team',name:'가상 팀',role:'owner'}]));
    localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{'qa-coach':{role:'executive'}}}));localStorage.setItem('cs_lang','ko');
   }
   window.PSItems={active:()=>false};window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')),dataUnlocked:()=>true,rosterReady:()=>true,keyReady:()=>true};
  });
  const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(base+'/fixture.html');const f=page.frames().find(f=>f.url().includes('scout.html'));assert.ok(f);
   await f.waitForFunction(()=>typeof matchLoad==='function'&&window.PSStorage&&typeof scoutBootPending!=='undefined'&&!scoutBootPending);
   await f.evaluate(async()=>{
    await PSStorage.sharedReady();
    const P=(id,name,num,posId,grp,status)=>({id,name,num,type:'ours',manual:true,grp,posId,status:status||'ok'});
    const roster={attrs:[],positions:[{id:'gk',name:'GK',targets:{}},{id:'cb',name:'CB',targets:{}},{id:'cm',name:'CM',targets:{}},{id:'st',name:'ST',targets:{}}],
     players:[P('p1','골키퍼 하나','1','gk','A팀'),P('p2','센터백 둘','4','cb','A팀','injury'),P('p3','센터백 셋','5','cb','B팀'),P('p4','미드 넷','8','cm','B팀'),P('p5','공격 다섯','9','st','A팀')],
     meta:{tbCards:['gk','cb','cm','st'],tbXY:{gk:{x:14,y:50},cb:{x:29,y:50},cm:{x:59,y:50},st:{x:89,y:50}},grpBase:['A팀','B팀']}};
    const m=matchBlank();m.id='qa-match';m.opponent='가상 상대';m.date='2026-09-16';m.squad={start:['p4'],res:['p5']};
    data=roster;store.set('scout_tool_v1',roster);store.set('cs_team_matches_v1',{version:1,matches:[m]});await store.ready();
    await scPrepare();load();data=roster;matchState=null;matchLoad();setView('match');matchOpen('qa-match');matchTab='opp';matchStage='opp';renderMatch();
   });
   await f.locator('#obTray .mb2-chip').first().waitFor({state:'attached'});await page.waitForTimeout(300);
   const dom=await f.evaluate(()=>{const vis=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getClientRects().length>0;
    return {squad:vis(document.getElementById('obSquadTray')),mode:vis(document.getElementById('obSqMode')),dock:!!document.querySelector('#obTray .mb2-dropdock'),
     rows:[...document.querySelectorAll('#obTray .mb2-trow')].map(r=>r.dataset.row+':'+(r.dataset.grp||'')),chips:[...document.querySelectorAll('#obTray .mb2-chip')].map(c=>c.dataset.pid),
     stClass:document.querySelectorAll('#obTray .mb2-chip.st,#obTray .mb2-chip.rs').length,n:document.getElementById('obTrayN').textContent,
     over:document.documentElement.scrollWidth-document.documentElement.clientWidth};});
   assert.equal(dom.squad,false,'선발·리저브 줄이 안 보인다');assert.equal(dom.mode,false,'선발/리저브 버튼이 없다');assert.equal(dom.dock,false);
   assert.deepEqual(dom.rows,['none:A팀','none:B팀']);assert.equal(dom.chips.length,5);assert.equal(dom.stClass,0);assert.equal(dom.n,'5');
   assert.ok(dom.over<=1,'가로 넘침 '+dom.over);result.cases.push('player-list-only');
   // «우리 11» — 선수단 작전판 카드마다 오늘 뛸 수 있는 맨 위 선수, 숨은 선발 명단은 그대로
   await f.locator('#obFillUs').click();
   const fill=await f.evaluate(()=>({us:obFrame(matchGet()).us.map(t=>t.pid+'@'+t.x+','+t.y),sq:JSON.stringify(matchGet().squad)}));
   assert.deepEqual(fill.us,['p1@6,50','p3@18.4,50','p4@43.2,50','p5@68,50'],JSON.stringify(fill));
   assert.equal(fill.sq,JSON.stringify({start:['p4'],res:['p5']}));result.cases.push('fill-from-squad-board');
   assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#obTray .mb2-chip.used')].map(c=>c.dataset.pid).sort()),['p1','p3','p4','p5']);
   // 끌어다 놓기 — 운동장에 서고, 선발 명단은 그대로
   if(width>=768){
    await f.evaluate(()=>{const m=matchGet();obFrame(m).us=[];obDraw(m);obSave();document.getElementById('obCard').scrollIntoView({block:'start'});});await page.waitForTimeout(250);
    const chip=f.locator('#obTray .mb2-chip[data-pid="p2"] i'),pit=f.locator('#obPitch');
    const a=await chip.boundingBox(),b=await pit.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(a.x+30,a.y+10,{steps:4});await page.mouse.move(b.x+b.width*0.3,b.y+b.height*0.5,{steps:8});await page.mouse.up();
    await page.waitForTimeout(250);
    const after=await f.evaluate(()=>({us:obFrame(matchGet()).us.map(t=>t.pid),sq:JSON.stringify(matchGet().squad)}));
    assert.deepEqual(after.us,['p2'],JSON.stringify(after));assert.equal(after.sq,JSON.stringify({start:['p4'],res:['p5']}),'운동장에 놓아도 선발 명단은 그대로');
    result.cases.push('drag-to-pitch-keeps-squad');
   }
   await f.evaluate(()=>document.getElementById('obCard').scrollIntoView({block:'start'}));await page.waitForTimeout(200);
   await page.screenshot({path:path.join(out,width+'-ob.png')});
   assert.deepEqual(errors,[]);result.ok=true;
  }catch(e){result.ok=false;result.error=e.stack;await page.screenshot({path:path.join(out,width+'-failure.png')}).catch(()=>{});}
  console.log(JSON.stringify(result));await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));if(results.some(r=>!r.ok))process.exitCode=1;}
