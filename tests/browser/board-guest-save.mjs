import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,pw,root,A,WP} from '../fixtures/team-app.mjs';
// 3.008 — 로그인 전 작전판은 이 기기에 저장한다(2.827 부터 «저장»이 갈 곳이 없었다 — 새로고침하면 사라짐).
//  ① 로그아웃 상태: «저장» → 기기 칸(ps_board_guest_v1) · 새로고침해도 그대로 · 서버로는 아무것도 가지 않는다
//  ② 게스트가 그대로 게스트인 신호(다른 탭의 저장소 변경)에는 저장 안 한 그림을 비우지 않는다
//  ③ 로그인했는데 계정 보드가 비어 있으면 그 보드를 연다 — 서버로 바로 보내지 않고 «저장»을 누르면 계정에 들어가며 기기 칸을 비운다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const P=(n,x)=>({id:n,team:'blue',num:String(n),x,y:300});
const boardFrame=async page=>{ const h=await page.waitForSelector('#fBoard'); const f=await h.contentFrame(); await f.waitForFunction(()=>window.__boardReady===true,null,{timeout:45000}); return f; };
try{
  // ── ① · ② 로그아웃 기기 ──
  const browser=browsers[engine]=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',locale:'ko-KR'});
  await context.routeWebSocket('**/*',s=>s.close());
  const base=fx.base;
  await context.route(u=>!(u.origin===base&&(u.pathname.startsWith('/rest/v1/')||u.pathname.startsWith('/auth/v1/'))),async route=>{
    const url=new URL(route.request().url());if(url.origin!==base)return route.abort('blockedbyclient');
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
    let content=fs.readFileSync(file);
    if(url.pathname==='/studio/app.html')content=Buffer.from(content.toString().replace(/(window\.PS_SYNC=\{url:")[^"]+("[,}])/,(_,a,b)=>a+base+b));
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json'}[path.extname(file)]||'application/octet-stream';
    return route.fulfill({body:content,contentType:type});
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
  page.on('dialog',d=>(d.type()==='beforeunload'?d.accept():d.dismiss()).catch(()=>{}));
  await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  let bf=await boardFrame(page);
  await bf.waitForFunction(()=>_boardGuestLoaded===true);
  assert.equal(await bf.evaluate(()=>boardGuestActive()),true,'로그아웃 기기는 게스트 보드');
  await bf.evaluate(P=>{loadSnap({players:P,equipment:[],drawings:[],ball:null,pitchN:1});renderTokens();boardSaveLive();},[P(9,500),P(10,600)]);
  assert.equal(await bf.evaluate(()=>_boardManualDirty),true,'게스트 편집도 «변경됨»');
  const writesBefore=fx.writes.length;
  assert.equal(await bf.evaluate(()=>window.__boardSaveExplicit()),true,'«저장»이 이 기기에 들어간다');
  const stored=await bf.evaluate(async()=>{const r=await window.storage.get('ps_board_guest_v1');const o=JSON.parse(r.value);return JSON.parse(o.raw).snap.players.map(p=>p.num);});
  assert.deepEqual(stored,['9','10']);
  assert.equal(await bf.evaluate(()=>_boardManualDirty),false);
  await page.reload({waitUntil:'domcontentloaded'});
  bf=await boardFrame(page);
  await bf.waitForFunction(()=>_boardGuestLoaded===true);
  assert.deepEqual(await bf.evaluate(()=>state.players.map(p=>p.num)),['9','10'],'새로고침해도 그대로');
  // ② 저장 안 한 그림 + 게스트 그대로인 신호
  await bf.evaluate(P=>{state.players.push(P);renderTokens();boardSaveLive();},P(11,700));
  await bf.evaluate(()=>{window.dispatchEvent(new StorageEvent('storage',{key:'ps_active_ws'}));});
  await page.waitForTimeout(600);
  assert.deepEqual(await bf.evaluate(()=>state.players.map(p=>p.num)),['9','10','11'],'게스트가 그대로면 판을 비우지 않는다');
  assert.equal(fx.writes.length,writesBefore,'게스트 보드는 서버로 가지 않는다');
  assert.deepEqual(errors.filter(t=>!/ResizeObserver loop/.test(t)),[],'페이지 오류 없음');
  await context.close();

  // ── ③ 로그인한 기기 — 계정 보드가 비어 있으면 이 기기의 게스트 보드를 연다 ──
  const {page:p2,logs}=await openApp(fx,size,{browsers});
  const b2=await boardFrame(p2);
  await b2.waitForFunction(()=>_boardPrivateLoaded===true);
  assert.equal(await b2.evaluate(()=>boardGuestActive()),false,'로그인한 기기는 게스트가 아니다');
  await b2.evaluate(async P=>{await window.storage.set('ps_board_guest_v1',JSON.stringify({v:1,at:Date.now(),raw:JSON.stringify({snap:{players:P,equipment:[],drawings:[],ball:null,pitchN:1},view:'board'})}));},[P(7,450),P(8,520),P(4,300)]);
  await b2.evaluate(()=>{_boardManualDirty=false;_bliveDirty=false;});
  await b2.evaluate(()=>restoreLiveBoard());
  assert.deepEqual(await b2.evaluate(()=>state.players.map(p=>p.num)),['7','8','4'],'비어 있는 계정 보드에 이 기기의 보드를 연다');
  assert.equal(await b2.evaluate(()=>_boardManualDirty&&_boardGuestAdopted),true,'«변경됨» — 서버로 바로 보내지 않는다');
  const mark=fx.writes.length;
  assert.equal(await b2.evaluate(()=>window.__boardSaveExplicit()),true);
  await b2.waitForFunction(async()=>!(await window.storage.get('ps_board_guest_v1')),null,{timeout:10000});
  const sent=fx.writes.slice(mark).filter(w=>w.wid===WP&&/board/i.test(String(w.k)));
  assert.ok(sent.length>=1,'계정(개인 공간)에 저장했다: '+JSON.stringify(fx.writes.slice(mark).map(w=>[w.m,w.wid,w.k])));
  assert.deepEqual([...String(sent[sent.length-1].v).matchAll(/\\?"num\\?":\\?"(\d+)\\?"/g)].map(m=>m[1]),['7','8','4'],'계정에 들어간 판이 그 보드다');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,cases:['guest-save-device','guest-reload-restores','guest-stays-guest-keeps-draft','guest-never-hits-server','login-adopts-into-empty-account','adopted-save-clears-device-slot'],owner:A}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
