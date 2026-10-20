import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
// 3.118 — 경기 인원(사용자 «경기 준비하면서 처음에 8v8 인지 11v11 을 설정할 수 있게»). 경기 머리의 «11 대 11 · 8 대 8» →
// 상대 포메이션 고르개는 그 묶음만 · «우리 팀» · «배치 N/8» · «＋ 새 미팅» 재료에 fmt · 정하지 않은 다음 경기는 앞 경기의 인원.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/match-fmt-3118-'+engine;fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
 if(pathname==='/fixture.html'){res.setHeader('Content-Type',mime['.html']);res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}</style><iframe src="/studio/scout.html"></iframe><script>window.__posts=[];addEventListener("message",e=>{try{if(e.data&&e.data.type==="meetingFromMatch")window.__posts.push(JSON.parse(JSON.stringify(e.data)));}catch(_){}});</script>');return;}
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
  const m2=matchBlank();m2.id='qa-next';m2.opponent='다음 상대';m2.date='2026-11-01';m2.squad={start:[],res:[]};
  if(!window.__seeded){window.__seeded=1;data=roster;scoutStore.set('scout_tool_v1',roster);scoutStore.set('cs_team_matches_v1',{version:1,matches:[m,m2]});await scoutStore.ready();}
  if(!window.__loaded){window.__loaded=1;await scPrepare();load();data=roster;matchState=null;}matchLoad();setView('match');matchOpen(window.__openId||'qa-match');matchTab=tab;matchStage=tab;renderMatch();
 },tab);


 const segState=()=>f.evaluate(()=>{const el=document.getElementById('matchFmtSeg');return el?{on:[...el.querySelectorAll('button.on')].map(b=>b.textContent),dis:[...el.querySelectorAll('button')].every(b=>b.disabled),vis:!!el.offsetParent,box:(r=>[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)])(el.getBoundingClientRect())}:null;});
 const groups=sel=>f.evaluate(sel=>[...document.querySelectorAll(sel+' optgroup')].map(g=>g.label+':'+[...g.children].map(o=>o.value).join(',')).concat([document.querySelector(sel).value]),sel);
 const den=()=>f.evaluate(()=>document.getElementById('obCntUs').parentNode.textContent.replace(/\s+/g,' ').trim());

 // 1) 처음 — 정하지 않은 경기는 11 대 11 · 머리 제목 옆에 보인다
 await open('prep');await f.waitForSelector('#matchFmtSeg',{state:'attached'});await page.waitForTimeout(300);
 let s=await segState();assert.deepEqual(s.on,['11 대 11'],JSON.stringify(s));assert.equal(s.vis,true);assert.equal(s.dis,false,'코치는 고를 수 있다');
 await page.screenshot({path:path.join(out,'1-prep-11.png')});
 assert.equal(await f.evaluate(()=>matchGet().fmt),undefined,'보기만으로는 쓰지 않는다');

 // 2) 8 대 8 을 누르면 경기 문서에 남고, 상대 분석의 고르개 · «우리 팀» · 분모가 따라온다
 await f.click('#matchFmtSeg button[data-fmt="8"]');await page.waitForTimeout(250);
 assert.equal(await f.evaluate(()=>matchGet().fmt),'8');
 assert.deepEqual((await segState()).on,['8 대 8']);
 await page.screenshot({path:path.join(out,'2-prep-8.png')});
 await open('opp');await f.waitForSelector('#obFormOp optgroup',{state:'attached'});await page.waitForTimeout(300);
 assert.deepEqual((await segState()).on,['8 대 8'],'다시 열어도 8 대 8');
 assert.deepEqual(await groups('#obFormOp'),['8인제:232,331,322,241','232'],'8인제 묶음만 · 2-3-2 부터');
 assert.equal(await f.evaluate(()=>document.getElementById('obFillUs').textContent.trim()),'우리 팀','카드가 11장일 수 있어 «우리 8»이라 쓰지 않는다');
 assert.match(await den(),/^배치 0\/8 · 상대 0$/);
 await f.click('#obFillOp');await page.waitForTimeout(200);
 assert.deepEqual(await f.evaluate(()=>obFrame(matchGet()).opp.map(t=>t.num+':'+t.pos)),['1:GK','2:CB','3:CB','4:LM','5:CM','6:RM','7:ST','8:ST']);
 await f.selectOption('#obFormOp','331');await page.waitForTimeout(100);assert.equal(await f.evaluate(()=>document.getElementById('obFormOp').value),'331');
 await f.evaluate(()=>document.getElementById('obCard').scrollIntoView({block:'start'}));await page.waitForTimeout(200);
 await page.screenshot({path:path.join(out,'3-opp-8.png')});

 // 3) «＋ 새 미팅» 재료에 fmt:'8'
 await open('prep');await page.waitForTimeout(300);
 await f.evaluate(()=>{window.matchCanLeaveWork=()=>true;window.mmCanLib=()=>true;});
 await f.evaluate(()=>mmCreateNow(matchGet()));await page.waitForTimeout(200);
 const posts=await page.evaluate(()=>window.__posts);
 assert.equal(posts.length,1,JSON.stringify(posts).slice(0,300));assert.equal(posts[0].payload.fmt,'8');assert.equal(posts[0].payload.template,true);

 // 4) 다음 경기(정하지 않음)는 앞 경기의 인원 — 8 대 8 로 보이되 쓰지는 않는다
 await f.evaluate(()=>{window.__openId='qa-next';});await open('opp');await page.waitForTimeout(300);
 assert.equal(await f.evaluate(()=>matchGet().id),'qa-next');
 assert.deepEqual((await segState()).on,['8 대 8'],'앞 경기에서 고른 인원');assert.equal(await f.evaluate(()=>matchGet().fmt),undefined);
 assert.deepEqual((await groups('#obFormOp')).slice(0,1),['8인제:232,331,322,241'],'고르개 값은 화면에 남는다(예전처럼) — 묶음만 8인제');
 // 11 대 11 로 돌리면 예전 그대로
 await f.click('#matchFmtSeg button[data-fmt="11"]');await page.waitForTimeout(250);
 assert.equal(await f.evaluate(()=>matchGet().fmt),'11');
 assert.deepEqual(await groups('#obFormOp'),['11인제:gk4,442,4231,433,343,352','442']);
 assert.equal(await f.evaluate(()=>document.getElementById('obFillUs').textContent.trim()),'우리 11');
 assert.match(await den(),/^배치 0\/11 /);
 await f.click('#obFillOp');await page.waitForTimeout(150);assert.equal(await f.evaluate(()=>obFrame(matchGet()).opp.length),11);

 // 5) 선수(편집 못 함)는 보기만
 await f.evaluate(()=>{window.matchCanEdit=()=>false;renderMatch();});await page.waitForTimeout(150);
 assert.equal((await segState()).dis,true,'편집 못 하면 단추가 잠긴다');
 await f.evaluate(()=>{const b=document.querySelector('#matchFmtSeg button[data-fmt="8"]');b.disabled=false;b.click();});await page.waitForTimeout(100);
 assert.equal(await f.evaluate(()=>matchGet().fmt),'11','잠긴 경기에서는 바뀌지 않는다');

 // 6) 폰 폭에서도 머리 안에 들어간다
 await page.setViewportSize({width:393,height:860});await f.evaluate(()=>{window.matchCanEdit=()=>true;window.__openId='qa-match';});await open('prep');await page.waitForTimeout(400);
 s=await segState();assert.equal(s.vis,true);assert.ok(s.box[0]>=0&&s.box[0]+s.box[2]<=393,JSON.stringify(s));
 assert.equal(await f.evaluate(()=>document.scrollingElement.scrollWidth<=document.scrollingElement.clientWidth+1),true,'가로 넘침 없음');
 await page.screenshot({path:path.join(out,'4-phone.png')});
 assert.deepEqual(errors,[],'페이지 오류 없음');
 console.log(JSON.stringify({ok:true,engine}));
}finally{ await browser?.close().catch(()=>{}); server.close(); }
