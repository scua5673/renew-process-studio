/* 3.291 — 보관함 작전판을 연 채:
   ① 저장할 게 없으면(열기만 · 저장 직후) 새 판 적용 장벽(psFlushAllPendingReady)이 작업 보드 초안의 기존 영수증으로 지나간다
   ② 저장 안 한 변경이 있으면 예전처럼 flush_fail … blocked:vault-edit (안내문 «저장하거나 닫으면»이 맞는 말이 된다)
   ③ 이름을 바꾼 적 있는 자료(editedAt 이 서버 기준과 같음)의 내용 저장이 팀 서버에 올라간다 — 고치기 전엔 savedAt 만 올라
      sync.js 가 «편집 시각이 그대로인 지문 차이 = 계산 방식 변경»으로 보고 올리지 않았다. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||path.join(process.cwd(),'test-results/vault-edit-update-3291',engine);fs.mkdirSync(out,{recursive:true});
const browsers={},fx=await startFixture();SIZES.veu={engine,ctx:{viewport:{width:1280,height:860},deviceScaleFactor:1}};
const {page}=await openApp(fx,'veu',{browsers});
async function board(){await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring;},null,{timeout:45000});return (await page.$('#fBoard')).contentFrame();}
async function toVault(f){await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});await page.waitForTimeout(700);}
const flush=()=>page.evaluate(()=>psFlushAllPendingReady().then(()=>({ok:true}),e=>({ok:false,code:e&&e.psCode,frame:e&&e.psFrame,why:e&&e.psWhy})));
const st=f=>f.evaluate(()=>({csView:window.__csView,vaultEdit:!!window.__vaultEdit,curId:window.__curVaultId||null,pending:!!window.__vaultPending,dirty:!!window.__vaultManualDirty,idle:!!(window.__psVaultIdle&&window.__psVaultIdle()),sub:document.getElementById('vCreateSub')?.textContent||'',players:state.players.length,draft:window.__psBoardDraft&&window.__psBoardDraft.snapshot()}));
const libPosts=id=>fx.writes.filter(w=>w.m==='POST'&&w.k==='ps_library:'+id);
async function waitPost(id,test,what){for(let i=0;i<120;i++){const p=libPosts(id).filter(w=>{try{return test(JSON.parse(w.v||'null'));}catch(_){return false;}});if(p.length)return p[p.length-1];if(i%8===0)await page.evaluate(()=>{try{PSSync.syncNow('test-3291');}catch(_){}});await page.waitForTimeout(250);}throw new Error('시간 초과: '+what+' posts='+JSON.stringify(libPosts(id).map(w=>{try{const it=JSON.parse(w.v);return {n:it.name,p:(it.snap&&it.snap.players||[]).length,e:it.editedAt,s:it.savedAt};}catch(_){return w.k;}})));}
const shot=n=>page.screenshot({path:path.join(out,n+'.png'),animations:'disabled'});
const R={engine};
try{
 let f=await board();
 /* 작업 보드에 저장 안 한 손질(초안이 필요해지는 상태 — 실사용과 같다) */
 await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
 await f.evaluate(()=>{pushUndo();const sn=captureSnap();sn.players=[{id:'w1',name:'가',num:9,team:'blue',x:333,y:300}];loadSnap(sn);boardSaveLive();});
 {const workKey=await f.evaluate(()=>boardDraftKey(_boardPrivateOwner));let work=null;for(let i=0;i<40&&!work;i++){work=await f.evaluate(async k=>(await storage.peek(k))?.value??null,workKey);if(!work)await page.waitForTimeout(250);}assert.ok(work,'작업 보드 초안이 기기에 있다');}
 R.boardFlush=await flush();assert.equal(R.boardFlush.ok,true,'작업 보드에서는 장벽을 지난다');
 /* 새 작전판 저장 */
 await toVault(f);await f.evaluate(()=>document.getElementById('dfNew').click());await f.waitForSelector('.vcc-item');
 await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
 await f.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending&&!!_vaultBoardContext,null,{timeout:10000});await page.waitForTimeout(900);
 await f.evaluate(()=>{pushUndo();state.players=[{id:901,team:'blue',num:7,x:400,y:370}];renderTokens();boardSaveLive();});await page.waitForTimeout(400);
 R.newPendingFlush=await flush();assert.equal(R.newPendingFlush.why,'blocked:vault-edit','저장 안 한 새 항목은 막는다');
 await f.evaluate(()=>document.getElementById('vCreateSave').click());await f.waitForSelector('#pssOk',{timeout:10000});await f.evaluate(()=>document.getElementById('pssOk').click());
 await f.waitForFunction(()=>window.__csView==='session'&&!window.__vaultEdit,null,{timeout:15000});await page.waitForTimeout(800);
 const id=await f.evaluate(async()=>{const l=await libGet();const it=l.find(x=>x.type==='board');return it&&it.libId;});assert.ok(id,'보관함에 작전판이 있다');
 await waitPost(id,it=>it&&it.name&&(it.snap&&it.snap.players||[]).length===1,'새 항목이 서버에 올라간다');
 /* 이름 바꾸기(vaultRenameItem 과 같은 쓰기: editedAt=savedAt=지금) → 서버에 */
 const T0=await f.evaluate(id=>libTurn(()=>libGet().then(lib=>{const it=lib.find(x=>x.libId===id);it.name='이름 바꾼 작전판';it.editedAt=it.savedAt=Date.now();return libWrite(lib).then(()=>{libTouch();return it.editedAt;});})),id);
 await waitPost(id,it=>it&&it.name==='이름 바꾼 작전판','이름이 서버에 올라간다');
 await page.waitForTimeout(1500);   /* 회차 메타(rec.s)가 그 시각으로 앉는다 */
 /* 목록에서 «편집» — 열기만 한 상태는 한가하다 */
 await f.waitForSelector('.vc-act.edit',{timeout:15000});await f.evaluate(()=>document.querySelector('.vc-act.edit').click());
 await f.waitForFunction(()=>window.__vaultEdit&&window.__curVaultId&&window.__csView==='board'&&!window.__vaultHydrating,null,{timeout:15000});await page.waitForTimeout(1500);
 R.opened=await st(f);R.openedFlush=await flush();await shot('1-opened');
 assert.equal(R.opened.idle,true,'연 그대로면 한가하다: '+JSON.stringify(R.opened));
 assert.equal(R.openedFlush.ok,true,'연 그대로면 새 판 적용 장벽을 지난다: '+JSON.stringify(R.openedFlush));
 /* 손대면 막는다 */
 await f.evaluate(()=>{pushUndo();state.players.push({id:902,team:'blue',num:8,x:600,y:370});renderTokens();boardSaveLive();});await page.waitForTimeout(1500);
 R.edited=await st(f);R.editedFlush=await flush();await shot('2-edited');
 assert.equal(R.edited.dirty,true);assert.equal(R.edited.idle,false);assert.equal(R.editedFlush.why,'blocked:vault-edit','저장 안 한 변경은 막는다');
 R.notice=await page.evaluate(()=>PSUpdateClient.reason('flush_fail:fBoard:board_draft_storage:blocked:vault-edit'));assert.match(R.notice,/저장하거나 닫으면/);
 /* «저장»(나가지 않음) → 한가해지고 장벽을 지난다 · 내용이 새 editedAt 으로 서버에 올라간다 */
 const T1=Date.now();await f.evaluate(()=>document.getElementById('vCreateSaveOnly').click());
 await f.waitForFunction(()=>!window.__vaultManualDirty&&/저장됨/.test(document.getElementById('vCreateSub')?.textContent||''),null,{timeout:15000});await page.waitForTimeout(600);
 R.saved=await st(f);R.savedFlush=await flush();await shot('3-saved');
 assert.equal(R.saved.idle,true,'저장 뒤엔 한가하다: '+JSON.stringify(R.saved));assert.equal(R.savedFlush.ok,true,'저장 뒤엔 장벽을 지난다: '+JSON.stringify(R.savedFlush));
 const posted=await waitPost(id,it=>it&&(it.snap&&it.snap.players||[]).length===2,'고친 내용이 서버에 올라간다(고치기 전 코드: savedAt 만 올라 안 올라감)');
 const item=JSON.parse(posted.v);R.posted={name:item.name,players:item.snap.players.length,editedAt:item.editedAt,savedAt:item.savedAt,T0};
 assert.ok(item.editedAt>=T1&&item.editedAt>T0,'저장이 editedAt 을 새로 찍는다: '+JSON.stringify(R.posted));assert.equal(item.name,'이름 바꾼 작전판');
 R.passed=true;console.log(JSON.stringify(R,null,1));
}catch(e){R.passed=false;console.log(JSON.stringify(R,null,1));console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
