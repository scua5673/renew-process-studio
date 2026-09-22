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
    const m=matchBlank();m.id='qa-match';m.opponent='가상 상대';m.date='2026-09-16';m.sourceId='sched:qa-schedule';m.phaseBoards={list:[['atk','공격']],cur:'atk',boards:{atk:{us:[{pid:"qa-p1",num:"1",name:"가상 선수 1",x:20,y:50}],opp:[{num:"9",x:80,y:50}],drawings:[{type:"ball",x:50,y:50},{type:"arrow",x:35,y:45,x2:65,y2:60,color:"#ffffff"}]}}};
    data=roster;store.set('scout_tool_v1',roster);store.set('process_coach_v1',{version:1,anchorMonday:'2026-09-14',weeks:{'0':[{}, {},{mid:'qa-schedule',match:{opp:'가상 상대'},board:{sched:'경기'}},{},{},{},{}]}});store.set('cs_team_matches_v1',{version:1,matches:[m]});await store.ready();
    await scPrepare();load();data=roster;matchState=null;matchLoad();setView('match');matchOpen('qa-match');matchTab='prep';matchStage='prep';renderMatch();
   });
   await f.locator('#mb2Pitch').waitFor({state:'visible'});await page.waitForTimeout(400);
   const drawings=()=>f.evaluate(()=>JSON.parse(JSON.stringify(mb2Cur(matchGet()).drawings||[])));
   assert.equal(await f.locator('#mb2Dock').isVisible(),false);result.cases.push('drawing-toolbar-hidden');
   const source=await drawings();assert.equal(source.length,2);
   await f.getByLabel('페이지 복제',{exact:true}).click();assert.deepEqual(await drawings(),source);
   await f.locator('[data-ph="atk"]').click();assert.deepEqual(await drawings(),source);result.cases.push('existing-drawings-preserved-on-copy');
   assert.equal(await f.getByRole('button',{name:'이름 변경',exact:true}).count(),0);await f.getByLabel('페이지 이름 수정',{exact:true}).click();await f.getByRole('textbox',{name:/페이지 이름/}).fill('빌드업');await f.getByRole('button',{name:'저장',exact:true}).last().click();assert.equal(await f.locator('[data-ph="atk"]').innerText(),'빌드업');
   await f.locator('[data-orientation="portrait"]').click();assert.deepEqual(await drawings(),source);result.cases.push('existing-drawings-preserved-on-rotation');
   for(const orientation of ['landscape','portrait']){await f.locator('#mb2Export summary').click();const pending=page.waitForEvent('download');await f.locator('[data-pdf="'+orientation+'"]').click();const download=await pending;const dest=path.join(out,width+'-'+orientation+'.pdf');await download.saveAs(dest);const bytes=fs.readFileSync(dest);assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4');assert.ok(bytes.length>20000);assert.ok(bytes.includes(Buffer.from(orientation==='portrait'?'/MediaBox [0 0 595.28 841.89]':'/MediaBox [0 0 841.89 595.28]')));}
   result.cases.push('actual-pdf-downloads');
   await page.waitForTimeout(800);const saved=await drawings();const disk=await f.evaluate(async()=>{await store.ready();const record=await storage.get('cs_team_matches_v1');return JSON.parse(record.value).matches.find(m=>m.id==='qa-match').phaseBoards.boards.atk.drawings;});assert.deepEqual(disk,saved);result.cases.push('durable-idb');
   await page.screenshot({path:path.join(out,width+'-tools.png')});assert.deepEqual(errors,[]);result.ok=true;
  }catch(e){result.ok=false;result.error=e.stack;await page.screenshot({path:path.join(out,width+'-failure.png')}).catch(()=>{});}
  console.log(JSON.stringify(result));await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(results.some(r=>!r.ok))process.exitCode=1;}
