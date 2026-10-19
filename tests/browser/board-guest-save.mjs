import assert from 'node:assert/strict';
import {startFixture,openApp,guestReady,signIn,ready,A} from '../fixtures/team-app.mjs';
// 3.112 — 로그인하지 않은 기기의 작전판은 이 기기에 저장한다(3.008 f196326 을 옮김). 2.827(코치별 개인 작업 보드)부터 저장 자리가
// 계정(uid)에 묶여, 로그인하지 않은 «저장»은 갈 곳이 없었다 — 알림만 뜨고 새로고침하면 그림이 사라졌다(약관 «로그인 없이 쓰면 기기에만 저장»).
//  ① 로그인하지 않은 기기: 손대면 «저장 ●» · «저장» → 기기 칸(ps_board_guest_v1) · 새로고침해도 그대로 · 서버로는 아무것도 가지 않는다
//  ② 게스트가 그대로 게스트인 신호(셸의 저장소 변경 · 인증 알림)에는 저장 안 한 그림을 비우지 않는다 · 닫기 경고
//  ③ 그 기기에서 로그인했는데 계정 보드가 비어 있으면 그 보드를 연다 — 서버로 바로 보내지 않고 «저장»을 누르면 계정에 들어가며 기기 칸을 비운다
//  ④ 계정 보드에 이미 무엇이 있으면 기기 칸의 보드를 열지 않고 그 칸도 건드리지 않는다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const SLOT='ps_board_guest_v1';
const P=(n,x)=>({id:'g'+n,team:'blue',num:String(n),x,y:300});
const boardFrame=async page=>{
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  /* 부팅 복원이 끝난 뒤(3.101 — 게스트는 계정 보드가 없으니 __boardRestoreDone 이 기기 칸 읽기까지 기다린다) */
  await f.waitForFunction(()=>window.__boardReady===true&&window.__boardRestoreDone===true,null,{timeout:45000});
  return f;
};
const nums=f=>f.evaluate(()=>state.players.map(p=>p.num));
const slotNums=f=>f.evaluate(async k=>{const r=await window.storage.get(k);if(!r)return null;return JSON.parse(JSON.parse(r.value).raw).snap.players.map(p=>p.num);},SLOT);
const kvWrites=()=>fx.calls.filter(c=>c.m!=='GET'&&/ps_kv|ps_library/.test(c.p)).length+fx.writes.length;
try{
  // ── ① 로그인하지 않은 기기 ──
  const {page,logs}=await openApp(fx,size,{browsers,guest:true});
  let bf=await boardFrame(page);
  await bf.evaluate(P=>{pushUndo();loadSnap({players:P,equipment:[],drawings:[],ball:null,pitchN:1});renderTokens();boardSaveLive();},[P(9,500),P(10,600)]);
  const touched=await bf.evaluate(()=>({dirty:_boardManualDirty,label:(document.getElementById('boardManualSave')||{}).textContent||''}));
  const writes0=kvWrites();
  const saved=await bf.evaluate(()=>window.__boardSaveOne());   /* 저장 단추와 같은 길(3.077) */
  const hint=await bf.evaluate(()=>(document.getElementById('hint')||{}).textContent||'');
  await page.reload({waitUntil:'domcontentloaded'});
  await guestReady(page);
  bf=await boardFrame(page);
  assert.deepEqual(await nums(bf),['9','10'],`로그인하지 않은 기기에서 «저장»한 판이 새로고침 뒤에도 그대로 (저장 결과 ${saved} · 알림 «${hint}»)`);
  assert.equal(saved,true,'«저장»이 이 기기에 들어간다');
  assert.match(hint,/이 기기에 저장됨/,'보관함 로그인 안내가 아니라 저장됐다는 알림');
  assert.equal(touched.dirty,true,'게스트 편집도 «변경됨»');
  if(size==='desktop')assert.equal(touched.label,'저장 ●','손대면 저장 단추에 점');
  assert.deepEqual(await slotNums(bf),['9','10'],'기기 칸에 그 판');
  assert.equal(await bf.evaluate(()=>window.__psBoardGuest.active()),true,'로그인하지 않은 기기는 게스트 보드');
  assert.equal(await bf.evaluate(()=>_boardManualDirty||boardManualChanged()),false,'불러온 판은 «변경»이 아니다');

  // ── ② 저장 안 한 그림 + 게스트가 그대로인 신호 ──
  await bf.evaluate(P=>{pushUndo();state.players.push(P);renderTokens();boardSaveLive();},P(11,700));
  await bf.evaluate(()=>{window.dispatchEvent(new StorageEvent('storage',{key:'ps_active_ws'}));window.dispatchEvent(new StorageEvent('storage',{key:'ps_sync_session'}));});
  await page.evaluate(()=>document.getElementById('fBoard').contentWindow.postMessage({source:'process-studio',type:'ps-auth-state',unlocked:false},location.origin));
  await page.waitForTimeout(700);
  assert.deepEqual(await nums(bf),['9','10','11'],'게스트가 그대로면 판을 비우지 않는다');
  assert.equal(await bf.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true,'저장 안 한 그림은 닫기 경고');
  assert.equal(await bf.evaluate(()=>window.__boardSaveExplicit()),true,'다시 «저장»');
  assert.deepEqual(await slotNums(bf),['9','10','11']);
  assert.equal(kvWrites(),writes0,'게스트 보드는 서버로 가지 않는다');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'페이지 오류 없음(게스트)');

  // ── ③ 같은 기기에서 로그인 — 계정 보드가 비어 있다 ──
  await signIn(page);   /* 앱을 떠났다가(OAuth) 로그인한 채 돌아온다 */
  bf=await boardFrame(page);
  await bf.waitForFunction(()=>_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psBoardGuest.adopted(),null,{timeout:30000});
  assert.equal(await bf.evaluate(()=>window.__psBoardGuest.active()),false,'로그인한 기기는 게스트가 아니다');
  assert.deepEqual(await nums(bf),['9','10','11'],'비어 있는 계정 보드에 이 기기의 보드를 연다');
  assert.equal(await bf.evaluate(()=>_boardManualDirty&&boardManualChanged()),true,'«저장 ●» — 사용자가 저장할 때까지');
  assert.equal(await bf.evaluate(()=>!document.getElementById('boardDraftBar')),true,'로그인 첫 부팅의 새로 열기(onApplied boot) 뒤에도 «되살리기» 띠 없이 바로 연다');
  assert.equal(fx.writes.filter(w=>/board/i.test(String(w.k))).length,0,'열기만 하고 서버로 바로 보내지 않는다: '+JSON.stringify(fx.writes.map(w=>[w.m,w.wid,w.k])));
  const mark=fx.writes.length;
  assert.equal(await bf.evaluate(()=>window.__boardSaveExplicit()),true,'계정에 저장');
  await bf.waitForFunction(async k=>!(await window.storage.get(k)),SLOT,{timeout:10000});
  const sent=fx.writes.slice(mark).filter(w=>/board/i.test(String(w.k)));
  assert.ok(sent.length>=1,'계정 보드에 저장했다: '+JSON.stringify(fx.writes.slice(mark).map(w=>[w.m,w.wid,w.k])));
  assert.deepEqual([...String(sent[sent.length-1].v).matchAll(/\\?"num\\?":\\?"(\d+)\\?"/g)].map(m=>m[1]),['9','10','11'],'계정에 들어간 판이 그 보드다');
  assert.equal(await bf.evaluate(()=>_boardManualDirty||window.__psBoardGuest.adopted()),false,'저장했으니 깨끗하다');

  // ── ④ 계정 보드가 있으면 기기 칸을 건드리지 않는다 ──
  await bf.evaluate(async({k,P})=>{await window.storage.set(k,JSON.stringify({v:1,at:Date.now(),raw:JSON.stringify({snap:{players:P,equipment:[],drawings:[],ball:null,pitchN:1},view:'board'})}));},{k:SLOT,P:[P(4,300)]});
  await page.reload({waitUntil:'domcontentloaded'});
  await ready(page);
  bf=await boardFrame(page);
  await bf.waitForFunction(()=>_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.waitForTimeout(800);
  assert.deepEqual(await nums(bf),['9','10','11'],'계정 보드가 그대로 열린다');
  assert.equal(await bf.evaluate(()=>window.__psBoardGuest.adopted()||_boardManualDirty),false,'기기 칸의 보드로 바꾸지 않는다');
  assert.deepEqual(await slotNums(bf),['4'],'기기 칸은 그대로');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,owner:A,cases:['guest-dirty-mark','guest-save-device','guest-reload-restores','guest-stays-guest-keeps-draft','guest-close-warning','guest-never-hits-server','login-adopts-into-empty-account','adopt-not-sent-until-save','adopted-save-clears-device-slot','account-with-board-ignores-slot']}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
