/* 3.302 — 작업 보드 초안의 두 사본(작은 저장소 · IndexedDB)이 서로 다른 채로 앱을 열면, 예전엔 손댈 때마다 «저장되지 않았습니다» 알약이 떴고
   («보드 저장»이나 «버리기» 전까지 영영 — 운영 기록: 아이패드 한 대가 나흘 동안, 새 판 적용도 그때마다 미뤄짐) 저장 확인(psFlushPendingReady)이 board_draft_storage:divergent 로 막혔다.
   이제 두 사본을 보관 키(…:kept:unsaved-split-<지문>)에 글자 그대로 옮긴 뒤 평소처럼 이어 쓴다. 치운 초안의 실패 알약도 남기지 않는다. 합성 팀 fixture 에서만 돈다. */
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};let stage='boot';
const ready=p=>p.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&w.__psBoardDraft;},null,{timeout:60000});
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  let f=null;
  const board=async()=>{await ready(page);await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());f=await (await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>(window.__csView||'board')==='board'&&!!document.getElementById('boardStage'),null,{timeout:20000});await page.waitForTimeout(900);};
  const edit=n=>f.evaluate(n=>{pushUndo();const u=n2u(.3+.05*n,.4);state.players.push({id:uid++,team:'blue',num:n,pos:'',x:u.x,y:u.y});renderTokens();},n);
  /* 초안이 가라앉을 때까지: 저장됨(또는 실패)으로 끝나고 대기 중인 타이머가 없다 */
  const settled=()=>f.waitForFunction(()=>{const s=PSSaveState.get('board-draft');return _boardDraftT===null&&(s==='saved'||s==='failed');},null,{timeout:20000});
  const snap=()=>f.evaluate(async()=>{const o=_boardPrivateOwner,k=boardDraftKey(o),v=await window.storage.get(k),keys=await window.storage.keys(boardPrivateKey(o)+':kept:unsaved-split-');
    const kept=[];for(const x of keys){const r=await window.storage.get(x);kept.push(r&&r.value);}
    const idb=(v&&v.value)||null;let raw=null;try{raw=JSON.parse(JSON.parse(idb).raw);}catch(_){}
    return {draft:PSSaveState.get('board-draft'),pill:!!document.getElementById('psSaveFailed'),bar:!!document.getElementById('boardDraftBar'),ls:localStorage.getItem(k),idb,kept,
      idbPlayers:raw&&raw.snap&&raw.snap.players?raw.snap.players.length:-1,players:state.players.length,pending:psHasPending()};});
  /* 지금 IDB 초안과 본문이 다르고 더 새로운 초안을 작은 저장소에 심는다 — 손댄 직후 앱을 바꿔 수명 주기 사본만 남고 탭이 정리된 모양 */
  const split=()=>f.evaluate(async()=>{const o=_boardPrivateOwner,k=boardDraftKey(o),v=await window.storage.get(k),r=JSON.parse(v.value),live=JSON.parse(r.raw);
    live.snap.players=live.snap.players.concat([{id:9001,team:'red',num:99,pos:'',x:300,y:300}]);
    const other=JSON.stringify({v:1,uid:r.uid,wid:r.wid,raw:JSON.stringify(live),at:r.at+5});localStorage.setItem(k,other);return {idb:v.value,ls:other,players:live.snap.players.length};});

  stage='first-draft';await board();await edit(1);await settled();
  let s=await snap();assert.equal(s.draft,'saved');assert.equal(s.ls,null);assert.ok(s.idb,'초안은 IDB 에');assert.deepEqual(s.kept,[]);

  stage='divergent-edit';const a=await split();await page.reload();await board();
  await f.waitForSelector('#boardDraftBar',{timeout:20000});
  s=await snap();assert.equal(s.ls,a.ls);assert.equal(s.idb,a.idb,'열기만 해서는 두 사본을 건드리지 않는다');assert.equal(s.pill,false);
  await edit(2);await settled();
  s=await snap();
  assert.equal(s.draft,'saved','갈린 두 사본이 있어도 손댄 것이 초안으로 저장된다(고치기 전: failed)');assert.equal(s.pill,false,'«저장되지 않았습니다» 알약 없음');
  assert.equal(s.kept.length,2);assert.ok(s.kept.includes(a.ls)&&s.kept.includes(a.idb),'두 사본은 보관 키에 글자 그대로');
  assert.equal(s.ls,null,'확인 뒤 작은 저장소 사본을 걷는다');assert.equal(s.idbPlayers,s.players,'IDB 초안 = 지금 판');
  assert.equal(await f.evaluate(()=>psFlushPendingReady().then(()=>'ok',e=>String(e&&e.psCode)+':'+String(e&&e.psWhy))),'ok','저장 확인(새 판 적용 · 화면 떠나기)이 막히지 않는다');
  assert.equal((await snap()).pending,false);
  await edit(3);await settled();s=await snap();assert.equal(s.draft,'saved');assert.equal(s.kept.length,2,'그 뒤 편집은 평소 길 — 보관이 늘지 않는다');

  stage='divergent-restore';const b=await split();await page.reload();await board();
  await f.waitForSelector('#boardDraftBar',{timeout:20000});
  await f.evaluate(()=>document.querySelector('#boardDraftBar .bd-keep').click());
  await f.waitForFunction(n=>state.players.length===n,b.players,{timeout:20000});await settled();
  s=await snap();assert.equal(s.draft,'saved','«되살리기» 뒤에도 초안이 저장된다');assert.equal(s.pill,false);assert.equal(s.idbPlayers,b.players);
  assert.ok(s.kept.includes(b.ls)&&s.kept.includes(b.idb));assert.equal(s.kept.length,4);
  await edit(4);await settled();s=await snap();assert.equal(s.draft,'saved');assert.equal(s.pill,false);assert.equal(s.kept.length,4);

  stage='archive-fails';const c=await split();await page.reload();await board();
  await f.waitForSelector('#boardDraftBar',{timeout:20000});
  await f.evaluate(()=>{const real=window.storage.replaceIfValue;window.__realCas=real;window.storage.replaceIfValue=function(k){if(String(k).indexOf(':kept:unsaved-split-')>=0)return Promise.reject(new Error('synthetic archive failure'));return real.apply(this,arguments);};});
  await edit(5);await settled();
  s=await snap();assert.equal(s.draft,'failed','보관하지 못하면 예전처럼 막는다');assert.equal(s.pill,true);assert.equal(s.ls,c.ls);assert.equal(s.idb,c.idb,'두 사본 그대로');
  assert.equal(await f.evaluate(()=>psFlushPendingReady().then(()=>'ok',e=>String(e&&e.psCode)+':'+String(e&&e.psWhy))),'board_draft_storage:divergent');
  await f.evaluate(()=>{window.storage.replaceIfValue=window.__realCas;});
  stage='save-clears-notice';
  assert.equal(await f.evaluate(()=>Promise.resolve(__boardSaveExplicit()).then(v=>v===true)),true,'«보드 저장»');
  await f.waitForFunction(()=>!document.getElementById('psSaveFailed')&&PSSaveState.get('board-draft')==='saved',null,{timeout:20000});
  s=await snap();assert.equal(s.ls,null);assert.equal(s.idb,null,'저장했으니 초안은 치운다');assert.equal(s.pill,false,'치운 초안의 실패 알약이 남지 않는다(고치기 전: 다음 편집까지 남음)');
  await edit(6);await settled();s=await snap();assert.equal(s.draft,'saved');assert.equal(s.pill,false);

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'작전판 오류 없음 '+JSON.stringify(errs));
  if(process.env.PS_SHOT_DIR)await page.screenshot({path:process.env.PS_SHOT_DIR+'/draft-divergent.png'});
  console.log(JSON.stringify({passed:true,engine,size,kept:s.kept.length}));
}catch(e){console.error('board-draft-divergent-3302 실패 단계: '+stage);console.error(e);process.exitCode=1;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}
