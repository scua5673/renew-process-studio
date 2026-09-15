import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),engine=process.env.PS_BROWSER_ENGINE||'chromium',baseline=process.env.PS_BASELINE==='1';
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/match-lineup-'+engine+(baseline?'-baseline':'');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 res.setHeader('Cache-Control','no-store');
 if(pathname==='/fixture.html'){res.setHeader('Content-Type',mime['.html']);res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}</style><script src="/studio/storage.js"></script><iframe src="/studio/scout.html?fixture=lineup"></iframe>');return;}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(baseline&&pathname==='/studio/scout.html'?execFileSync('git',['show','b73db519:studio/scout.html'],{maxBuffer:16e6}):fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;const results=[];
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 for(const width of (baseline?[1280,820]:[1280,820,390])){
  const result={width,engine,baseline,cases:[]};results.push(result);
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:true,isMobile:width<600,serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(()=>{
   if(!localStorage.getItem('lineup-seed')){
    localStorage.setItem('lineup-seed','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid:'qa-coach',at:'synthetic'}));localStorage.setItem('ps_active_ws','qa-team');
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
    const roster={attrs:[],positions:[{id:'gk',name:'GK',targets:{}},{id:'cm',name:'CM',targets:{}}],players:[{id:'qa-p1',name:'가상 선수 1',num:'1',type:'ours',manual:true,grp:'A팀',posId:'gk',status:'ok'},{id:'qa-p2',name:'가상 선수 2',num:'8',type:'ours',manual:true,grp:'A팀',posId:'cm',status:'ok'}],meta:{evalMode:'fifa'}};
    const m=matchBlank();m.id='qa-match';m.opponent='가상 상대';m.date='2026-09-16';m.sourceId='sched:qa-schedule';m.phaseBoards={list:[['atk','공격']],cur:'atk',boards:{atk:{us:[],opp:[]}}};
    data=roster;store.set('scout_tool_v1',roster);store.set('process_coach_v1',{version:1,anchorMonday:'2026-09-14',weeks:{'0':[{}, {},{mid:'qa-schedule',match:{opp:'가상 상대'},board:{sched:'경기'}},{},{},{},{}]}});store.set('cs_team_matches_v1',{version:1,matches:[m]});await store.ready();
    await scPrepare();load();data=roster;matchState=null;matchLoad();setView('match');matchOpen('qa-match');matchTab='prep';matchStage='prep';renderMatch();
   });
   await f.locator('#mb2Pitch').waitFor({state:'visible'});await page.waitForTimeout(400);
   async function coords(){return f.evaluate(()=>JSON.parse(JSON.stringify(mb2Cur(matchGet()).us)));}
   async function signal(){await page.evaluate(()=>localStorage.setItem('ps_sync_meta',JSON.stringify({qaAck:Date.now()})));await page.waitForTimeout(140);}
   async function drag(from,to,ack=false){await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:6});if(ack)await signal();await page.mouse.up();}
   async function center(loc){const r=await loc.boundingBox();assert.ok(r);return{x:r.x+r.width/2,y:r.y+r.height/2};}
   await f.locator('#mb2Pitch').scrollIntoViewIfNeeded();
   // Real mouse events from roster to pitch, then reacquire the same DOM token while an ACK arrives.
   const chip=f.locator('#mb2Tray .mb2-chip[data-pid="qa-p1"] i');await chip.scrollIntoViewIfNeeded();
   let pitch=await f.locator('#mb2Pitch').boundingBox();
   await drag(await center(chip),{x:pitch.x+pitch.width*.3,y:pitch.y+pitch.height*.5});
   await page.waitForTimeout(450);assert.equal((await coords()).length,1,'roster drop adds exactly one');
   await f.locator('#mb2Pitch .mlb-tok').click();await signal();
   result.selectionAfterAck=await f.locator('#mb2Pitch .mlb-tok.sel').count();
   if(!baseline)assert.equal(result.selectionAfterAck,1,'ACK preserves selected player');
   await f.locator('#mb2Pitch').scrollIntoViewIfNeeded();pitch=await f.locator('#mb2Pitch').boundingBox();
   await drag(await center(f.locator('#mb2Pitch .mlb-tok i')),{x:pitch.x+pitch.width*.6,y:pitch.y+pitch.height*.4},true);
   await page.waitForTimeout(650);let pos=(await coords())[0];assert.ok(Math.abs(pos.x-60)<1&&Math.abs(pos.y-40)<1,JSON.stringify(pos));
   result.cases.push('roster-drop','selection-through-ack','redrag-through-ack');
   // Touch cancellation must neither save the preview nor delete the token.
   const before=await coords();
   await f.evaluate(()=>{
    const d=document.querySelector('#mb2Pitch .mlb-tok'),r=d.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    d.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:41,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:41,pointerType:'touch',clientX:x+35,clientY:y+35}));
    window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:41,pointerType:'touch'}));
   });assert.deepEqual(await coords(),before);result.cases.push('touch-cancel-rollback');
   await f.locator('#mb2Orientation [data-orientation="portrait"]').click();
   assert.deepEqual(await coords(),before,'orientation is view only');
   await f.locator('#mb2Pitch').scrollIntoViewIfNeeded();pitch=await f.locator('#mb2Pitch').boundingBox();assert.ok(pitch.height>pitch.width);
   await drag(await center(f.locator('#mb2Pitch .mlb-tok i')),{x:pitch.x+pitch.width*.35,y:pitch.y+pitch.height*.3},true);
   await page.waitForTimeout(650);pos=(await coords())[0];assert.ok(Math.abs(pos.x-70)<1&&Math.abs(pos.y-35)<1,JSON.stringify(pos));
   result.cases.push('portrait-redrag-canonical-coordinates');
   // A second roster drop uses the inverse projection too (no duplicate first player).
   const second=f.locator('#mb2Tray .mb2-chip[data-pid="qa-p2"] i');await second.scrollIntoViewIfNeeded();pitch=await f.locator('#mb2Pitch').boundingBox();
   await drag(await center(second),{x:pitch.x+pitch.width*.65,y:pitch.y+pitch.height*.3},true);await page.waitForTimeout(650);
   const added=(await coords()).find(p=>p.pid==='qa-p2');assert.ok(added&&Math.abs(added.x-70)<1&&Math.abs(added.y-65)<1);assert.equal((await coords()).length,2);result.cases.push('portrait-roster-drop');
   if(engine==='chromium'){
    await f.locator('#mb2Pitch').scrollIntoViewIfNeeded();pitch=await f.locator('#mb2Pitch').boundingBox();const point=await center(f.locator('#mb2Pitch .mlb-tok i').first());
    const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pitch.x+pitch.width*.4,y:pitch.y+pitch.height*.4}]});await signal();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(650);const touched=(await coords())[0];assert.ok(Math.abs(touched.x-60)<1&&Math.abs(touched.y-40)<1,JSON.stringify(touched));await cdp.detach();result.cases.push('native-touch-redrag-through-ack');
   }
   await page.screenshot({path:path.join(out,width+'-portrait.png')});
   const saved=await coords();
   await f.locator('#mb2Meet').click();const full=await f.locator('#mb2Pitch').boundingBox();assert.ok(full.height>full.width);assert.deepEqual(await coords(),saved);await f.locator('#mb2FullExit').click();result.cases.push('portrait-full-view');
   await f.locator('#mb2Orientation [data-orientation="landscape"]').click();assert.deepEqual(await coords(),saved);
   const disk=await f.evaluate(async()=>{await store.ready();const record=await storage.get('cs_team_matches_v1');return JSON.parse(record.value).matches.find(m=>m.id==='qa-match').phaseBoards.boards.atk.us;});assert.deepEqual(disk,saved);result.cases.push('landscape-roundtrip','actual-idb-save');
   await page.screenshot({path:path.join(out,width+'-landscape.png')});
   assert.deepEqual(errors,[]);result.ok=true;
  }catch(e){result.ok=false;result.error=e.stack;await page.screenshot({path:path.join(out,width+'-failure.png')}).catch(()=>{});}
  console.log(JSON.stringify(result));await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(results.some(r=>!r.ok))process.exitCode=1;}
