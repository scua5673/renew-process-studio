import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
// 3.117 — 오류 제보 5a574320 «경기 준비 포메이션이 11v11 만 — 유소년 8v8 도». 상대 포메이션 고르개에 «8인제» 묶음(2-3-2 · 3-3-1 · 3-2-2 · 2-4-1),
// «상대 배치»는 8명(번호 1~8), «배치 N/◻»는 선발 인원(없으면 고른 상대 포메이션 인원). 경기 준비 · 상대 분석 둘 다.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/match-formats-8-'+engine;fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
 if(pathname==='/fixture.html'){res.setHeader('Content-Type',mime['.html']);res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}</style><iframe src="/studio/scout.html"></iframe>');return;}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const context=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await context.addInitScript(()=>{
  if(!localStorage.getItem('fmt-seed')){
   localStorage.setItem('fmt-seed','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid:'qa-coach',at:'synthetic'}));localStorage.setItem('ps_active_ws','qa-team');
   localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid:'qa-coach',wid:'qa-team',nonce:'test'}));
   localStorage.setItem('ps_ws_list',JSON.stringify([{id:'qa-team',kind:'team',name:'가상 팀',role:'owner'}]));
   localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{'qa-coach':{role:'executive'}}}));localStorage.setItem('cs_lang','ko');
  }
  window.PSItems={active:()=>false};window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')),dataUnlocked:()=>true,rosterReady:()=>true,keyReady:()=>true};
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/fixture.html');const f=page.frames().find(f=>f.url().includes('scout.html'));assert.ok(f);
 await f.waitForFunction(()=>typeof matchLoad==='function'&&window.PSStorage&&typeof scoutBootPending!=='undefined'&&!scoutBootPending&&!!window.PSMatchFormats);
 const open=async(tab)=>f.evaluate(async(tab)=>{
  await PSStorage.sharedReady();
  const P=(id,name,num,posId)=>({id,name,num,type:'ours',manual:true,grp:'A팀',posId,status:'ok'});
  const roster={attrs:[],positions:[{id:'gk',name:'GK',targets:{}},{id:'cb',name:'CB',targets:{}},{id:'cm',name:'CM',targets:{}},{id:'st',name:'ST',targets:{}}],
   players:[P('p1','골키퍼','1','gk'),P('p2','수비 둘','2','cb'),P('p3','수비 셋','3','cb'),P('p4','미드 넷','4','cm'),P('p5','미드 다섯','5','cm'),P('p6','미드 여섯','6','cm'),P('p7','공격 일곱','7','st'),P('p8','공격 여덟','8','st')],
   meta:{tbCards:['gk','cb','cm','st'],tbXY:{gk:{x:14,y:50},cb:{x:29,y:50},cm:{x:59,y:50},st:{x:89,y:50}},grpBase:['A팀']}};
  const m=matchBlank();m.id='qa-match';m.opponent='가상 유소년';m.date='2026-10-25';m.squad={start:[],res:[]};
  data=roster;scoutStore.set('scout_tool_v1',roster);scoutStore.set('cs_team_matches_v1',{version:1,matches:[m]});await scoutStore.ready();
  await scPrepare();load();data=roster;matchState=null;matchLoad();setView('match');matchOpen('qa-match');matchTab=tab;matchStage=tab;renderMatch();
 },tab);

 // 1) 경기 준비(02)의 옛 경기 보드(#mb2Card)는 지금 숨어 있다(경기 보드는 작전판 미팅) — 같은 표 · 같은 고르개로 바꿔 두었는지만 본다
 await open('prep');await f.waitForSelector('#mb2FormOp optgroup',{state:'attached'});await page.waitForTimeout(300);
 const sel=await f.evaluate(()=>[...document.querySelectorAll('#mb2FormOp optgroup')].map(g=>g.label+':'+[...g.children].map(o=>o.value).join(',')));
 assert.deepEqual(sel,['11인제:gk4,442,4231,433,343,352','8인제:232,331,322,241'],JSON.stringify(sel));
 assert.equal(await f.evaluate(()=>document.getElementById('mb2FormOp').value),'442','처음 고른 값은 그대로 4-4-2');
 const prep=await f.evaluate(()=>{const s=document.getElementById('mb2FormOp');s.value='232';s.dispatchEvent(new Event('change'));mb2FillOp(matchGet());
  return {opp:mb2Cur(matchGet()).opp.map(t=>t.num+':'+t.pos+(t.gk?'*':'')),cnt:document.getElementById('mb2CntUs').parentNode.textContent.replace(/\s+/g,' ').trim()};});
 assert.deepEqual(prep.opp,['1:GK*','2:CB','3:CB','4:LM','5:CM','6:RM','7:ST','8:ST'],JSON.stringify(prep));
 assert.match(prep.cnt,/^배치 0\/8 · 상대 8$/,JSON.stringify(prep));

 // 2) 상대 분석(01) — 지금 화면에서 포메이션을 고르는 곳. 고르개 · 상대 배치 · 배치 N/◻
 await open('opp');await f.waitForSelector('#obFormOp optgroup',{state:'attached'});await page.waitForTimeout(300);
 assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#obFormOp optgroup')].map(g=>g.label+':'+g.children.length)),['11인제:6','8인제:4']);
 assert.equal(await f.evaluate(()=>document.getElementById('obFormOp').value),'442','처음 고른 값은 그대로 4-4-2');
 const den=()=>f.evaluate(()=>document.getElementById('obCntUs').parentNode.textContent.replace(/\s+/g,' ').trim());
 assert.match(await den(),/^배치 0\/11 · 상대 0$/,'선발이 없고 11인제면 /11');
 await f.selectOption('#obFormOp','232');await page.waitForTimeout(100);
 assert.match(await den(),/^배치 0\/8 · 상대 0$/,'8인제를 고르면 /8');
 await f.click('#obFillOp');await page.waitForTimeout(200);
 const ob=await f.evaluate(()=>obFrame(matchGet()).opp.map(t=>t.num+':'+t.pos+(t.gk?'*':'')));
 assert.deepEqual(ob,['1:GK*','2:CB','3:CB','4:LM','5:CM','6:RM','7:ST','8:ST'],JSON.stringify(ob));
 assert.match(await den(),/^배치 0\/8 · 상대 8$/);
 for(const [k,n] of [['331','1:GK,2:CB,3:CB,4:CB,5:LM,6:CM,7:RM,8:ST'],['322','1:GK,2:CB,3:CB,4:CB,5:LCM,6:RCM,7:ST,8:ST'],['241','1:GK,2:CB,3:CB,4:LM,5:LCM,6:RCM,7:RM,8:ST']]){
  await f.selectOption('#obFormOp',k);await f.click('#obFillOp');await page.waitForTimeout(120);
  assert.equal((await f.evaluate(()=>obFrame(matchGet()).opp.map(t=>t.num+':'+t.pos))).join(','),n,k);
 }
 // 상대 토큰은 상대 쪽 반(x>50) 안에서 서로 겹치지 않는다
 const pts=await f.evaluate(()=>obFrame(matchGet()).opp.map(t=>[t.x,t.y]));
 assert.ok(pts.every(p=>p[0]>=34&&p[0]<=97&&p[1]>=4&&p[1]<=96),JSON.stringify(pts));
 assert.equal(new Set(pts.map(p=>p.join(','))).size,8);
 // 선발 8명을 고르면 분모는 선발 인원 — 11인제로 돌려도
 await f.evaluate(()=>{const m=matchGet();m.squad={start:['p1','p2','p3','p4','p5','p6','p7','p8'],res:[]};matchSquadMirrorLegacy(m);obCounts(m);});
 await f.selectOption('#obFormOp','433');await page.waitForTimeout(100);
 assert.match(await den(),/^배치 0\/8 /,'선발 8명이면 /8');
 // 11인제는 예전 그대로
 await f.click('#obFillOp');await page.waitForTimeout(120);
 assert.equal(await f.evaluate(()=>obFrame(matchGet()).opp.length),11);
 await f.selectOption('#obFormOp','232');await f.click('#obFillOp');await page.waitForTimeout(200);
 await f.evaluate(()=>document.getElementById('obCard').scrollIntoView({block:'start'}));await page.waitForTimeout(200);
 await page.screenshot({path:path.join(out,'opp-8.png')});
 assert.deepEqual(errors,[],'페이지 오류 없음');
 console.log(JSON.stringify({ok:true,engine}));
}finally{ await browser?.close().catch(()=>{}); server.close(); }
