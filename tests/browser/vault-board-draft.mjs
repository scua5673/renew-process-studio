/* 0976735a — 보관함에서 만들던 작전판(장면 여러 개)은 새로고침 · 탭 닫힘 · «나가기» 뒤에도 기기에 남아 되살릴 수 있다.
   고치기 전: «＋ 만들기 › 작전판»에서 장면을 만들고 새로고침하면 아무것도 남지 않았다(작업 보드 초안은 이 화면에서 막혀 있고
   보관함 작전판은 «저장하기» 전엔 어디에도 적지 않았다). 같은 화면에서 새 판 적용은 flush_fail:fBoard:board_draft_storage 로만 남았다. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,A,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-vault-board-draft';
fs.mkdirSync(out,{recursive:true});
const browsers={},fx=await startFixture();
SIZES.vd={engine,ctx:{viewport:{width:1280,height:860},deviceScaleFactor:1}};
const {page,logs}=await openApp(fx,'vd',{browsers});
async function board(){
  await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring&&!!w.__psVaultDraft;},null,{timeout:45000});
  return (await page.$('#fBoard')).contentFrame();
}
async function toVault(f){
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});await page.waitForTimeout(700);
}
async function newBoard(f){
  await toVault(f);
  await f.evaluate(()=>document.getElementById('dfNew').click());await f.waitForSelector('.vcc-item');
  await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
  await f.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending&&!!_vaultBoardContext,null,{timeout:10000});
  await page.waitForTimeout(900);   /* 연 그대로의 모습(기준)이 잡힌 뒤에 손댄다 */
}
/* 사람처럼: 선수 하나를 놓고, 옮길 때마다 «＋ 장면» */
async function scenes(f,xs){
  await f.evaluate(()=>{pushUndo();state.players=[{id:901,team:'blue',num:7,x:300,y:370}];renderTokens();});
  for(const x of xs){await f.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();},x);await page.waitForTimeout(220);}
}
const stored=f=>f.evaluate(async()=>{
  const o=vaultBoardOwner(),k=PSVaultDraft.key(o);let idb=null;try{idb=(await storage.peek(k))?.value??null;}catch(_){}
  const rec=PSVaultDraft.pick(localStorage.getItem(k),idb,o);
  return {key:k,ls:localStorage.getItem(k)!==null,idb:idb!==null,rec:rec&&{at:rec.at,libId:rec.libId,frames:(rec.doc.frames||[]).length,xs:(rec.doc.frames||[]).map(fr=>fr.snap.players[0]&&fr.snap.players[0].x),uid:rec.uid,wid:rec.wid}};
});
/* 비동기로 읽는 값은 waitForFunction(async…)이 곧바로 지나간다(CLAUDE.md 3.114) — 시험 쪽에서 돌려 읽는다 */
async function until(f,test,what){for(let i=0;i<60;i++){const s=await stored(f);if(test(s))return s;await page.waitForTimeout(250);}throw new Error('시간 초과: '+what+' '+JSON.stringify(await stored(f)));}
const gone=s=>!s.rec&&!s.ls&&!s.idb;
const live=f=>f.evaluate(()=>({frames:anim.frames.length,xs:anim.frames.map(fr=>fr.snap.players[0]&&fr.snap.players[0].x),vcreating:document.body.classList.contains('vcreating'),pending:!!window.__vaultPending,bar:!!document.getElementById('psVaultDraftBar'),barText:document.getElementById('psVaultDraftBar')?.querySelector('.vd-tx').textContent||''}));
const libWrites=()=>fx.writes.filter(w=>String(w.k||'').startsWith('ps_library:')).length;
try{
  let f=await board();
  assert.equal((await stored(f)).rec,null,'처음엔 초안이 없다');

  // 작업 보드에도 저장 안 한 손질이 있다(그 초안은 board-draft.js 가 맡는다 — 서로 건드리지 않는다)
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
  await f.evaluate(()=>{pushUndo();const sn=captureSnap();sn.players=[{id:'w1',name:'가',num:9,team:'blue',x:333,y:300}];loadSnap(sn);boardSaveLive();});
  const workKey=await f.evaluate(()=>boardDraftKey(_boardPrivateOwner));
  let work=null;for(let i=0;i<40&&!work;i++){work=await f.evaluate(async k=>(await storage.peek(k))?.value??null,workKey);if(!work)await page.waitForTimeout(250);}
  assert.ok(work,'작업 보드 초안이 먼저 기기에 있다');

  // ① 손대지 않고 열기만 한 새 작전판은 초안을 만들지 않는다
  await newBoard(f);await page.waitForTimeout(1200);
  assert.equal((await stored(f)).rec,null,'연 그대로면 적지 않는다');

  // ② 장면 넷을 만들면 0.8초 뒤 기기(IndexedDB)에 있다 — 보관함 · 서버는 그대로
  await scenes(f,[400,460,520]);
  let s=await until(f,s=>!!s.rec&&s.idb&&!s.ls,'초안이 큰 저장소에');
  assert.equal(s.rec.frames,4,'장면 넷이 초안에: '+JSON.stringify(s));assert.deepEqual(s.rec.xs,[400,460,520,520]);
  assert.equal(s.rec.uid,A);assert.equal(s.rec.libId,null);assert.equal(s.ls,false,'평소엔 큰 저장소에만');
  assert.equal(libWrites(),0,'보관함에는 쓰지 않는다');
  assert.equal(await f.evaluate(async k=>(await storage.peek(k))?.value??null,workKey),work,'작업 보드 초안은 건드리지 않는다');

  // ③ 이 화면에서 새 판 적용이 미뤄지는 까닭이 기록에 남는다(막는 것은 그대로)
  const why=await page.evaluate(()=>psFlushAllPendingReady().then(()=>null,e=>({code:e.psCode,frame:e.psFrame,why:e.psWhy})));
  assert.deepEqual(why,{code:'board_draft_storage',frame:'fBoard',why:'blocked:vault-edit'});
  assert.match(await page.evaluate(()=>PSUpdateClient.reason('flush_fail:fBoard:board_draft_storage:blocked:vault-edit')),/편집 중인 자료를 저장하거나 닫으면/);

  // ④ 0.8초를 기다리지 못한 마지막 손질도 탭이 닫힐 때 남는다
  await f.evaluate(()=>{pushUndo();state.players[0].x=580;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();});
  await f.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  s=await stored(f);assert.equal(s.rec.frames,5,'닫히는 순간의 판: '+JSON.stringify(s));

  // ⑤ 새로고침 — 띠가 묻고, «되살리기»가 새 작전판 만들기로 연다
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  f=await board();
  await f.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:20000});
  if(await page.evaluate(()=>document.body.dataset.psApp!=='board'))await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
  await f.waitForSelector('#psVaultDraftBar',{state:'visible',timeout:10000});
  await f.waitForSelector('#boardDraftBar',{state:'visible',timeout:10000});
  const tops=await f.evaluate(()=>['boardDraftBar','psVaultDraftBar'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)];}));
  assert.ok(tops[1][0]>=tops[0][1],'두 띠가 겹치지 않는다: '+JSON.stringify(tops));
  let v=await live(f);assert.match(v.barText,/보관함에서 만들던 작전판이 있어요 · 장면 5개/);assert.equal(v.frames<=1,true,'새로고침 뒤 판에는 없다(초안으로만)');
  await page.screenshot({path:path.join(out,`vault-board-draft-bar-${engine}.png`),animations:'disabled'});
  await f.locator('#psVaultDraftBar .vd-keep').click();
  await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&anim.frames.length===5,null,{timeout:10000});
  await page.waitForTimeout(700);
  v=await live(f);assert.deepEqual(v.xs,[400,460,520,580,580],'장면이 그대로: '+JSON.stringify(v));assert.equal(v.pending,true);assert.equal(v.bar,false);
  assert.equal(libWrites(),0,'되살리기는 보관함에 쓰지 않는다');
  await page.screenshot({path:path.join(out,`vault-board-draft-restored-${engine}.png`),animations:'disabled'});

  // ⑥ 되살린 판도 저장 전엔 초안이다 — 한 번 더 새로고침해도 남는다
  await page.waitForTimeout(1600);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);f=await board();
  await f.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:20000});
  s=await stored(f);assert.equal(s.rec.frames,5);

  // ⑦ «저장하기»로 보관함에 담고 나오면 초안은 낡은 것 — 띠가 뜨지 않는다
  if(await page.evaluate(()=>document.body.dataset.psApp!=='board'))await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
  await f.locator('#psVaultDraftBar .vd-keep').click();
  await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&anim.frames.length===5,null,{timeout:10000});await page.waitForTimeout(700);
  await f.evaluate(()=>document.getElementById('vCreateSave').click());await f.locator('#pssName').fill('가상 되살린 작전판');await f.locator('#pssOk').click();
  await f.waitForFunction(()=>!document.body.classList.contains('vcreating')&&!_vaultBoardContext,null,{timeout:15000});
  await until(f,gone,'저장한 뒤 초안이 걷힌다');assert.equal(await f.evaluate(()=>!!document.getElementById('psVaultDraftBar')),false);
  const saved=await f.evaluate(async()=>{const it=((await libGet())||[]).find(x=>x.name==='가상 되살린 작전판');return it&&{frames:(it.frames||[]).length};});
  assert.deepEqual(saved,{frames:5},'보관함에 장면 다섯이 담겼다');

  // ⑧ 새로 만들다 «나가기»(묻지 않고 닫힌다) — 초안이 남아 띠로 되돌릴 수 있고, «버리기»는 두 저장소에서 지운다
  await newBoard(f);await scenes(f,[410,470]);
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());
  await f.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:15000});
  s=await stored(f);assert.equal(s.rec.frames,3,'나가기 직전의 판: '+JSON.stringify(s));
  await f.evaluate(()=>document.querySelector('#psVaultDraftBar .vd-drop').click());
  await until(f,gone,'버리면 두 저장소에서 지운다');assert.equal(await f.evaluate(()=>!!document.getElementById('psVaultDraftBar')),false);

  // ⑧-2 보관함 자료 «편집»: 고친 뒤 «저장»하고 나오면 띠가 없고, 고치고 «버리고 나가기»를 고르면 초안도 버린다
  const openEdit=async()=>{
    await toVault(f);
    await f.evaluate(()=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('가상 되살린 작전판'));[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click();});
    await f.waitForFunction(()=>!!window.__vaultEdit&&!!_vaultBoardContext&&!!window.__curVaultId&&!window.__vaultHydrating,null,{timeout:15000});await page.waitForTimeout(1300);
  };
  const nudge=x=>f.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();autoSaveAnimFrame();window.__vaultAutoSaveSchedule();},x);
  await openEdit();await nudge(611);
  s=await until(f,s=>!!s.rec&&!!s.rec.libId,'편집 중인 자료의 초안');
  await f.evaluate(()=>document.getElementById('vCreateSaveOnly').click());
  await f.waitForFunction(()=>!window.__vaultManualDirty&&/저장됨/.test(document.getElementById('vCreateSub').textContent||''),null,{timeout:10000});
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());
  await f.waitForFunction(()=>!_vaultBoardContext,null,{timeout:10000});
  await until(f,gone,'저장하고 나오면 낡은 초안은 걷힌다');assert.equal(await f.evaluate(()=>!!document.getElementById('psVaultDraftBar')),false);
  await openEdit();await nudge(633);
  await until(f,s=>!!s.rec&&!!s.rec.libId,'다시 고친 초안');
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());
  await f.waitForSelector('[data-ps-ok="1"]');await page.waitForTimeout(300);
  await f.evaluate(()=>document.querySelector('[data-ps-ok="1"]').click());
  await f.waitForFunction(()=>!_vaultBoardContext,null,{timeout:10000});
  await until(f,gone,'버리고 나가면 초안도 버린다');await page.waitForTimeout(900);assert.equal(await f.evaluate(()=>!!document.getElementById('psVaultDraftBar')),false);
  // 고치다 새로고침하면(저장 안 함) 보관함 자료는 그대로이고 초안이 띠로 나온다
  await openEdit();await nudge(655);
  await until(f,s=>!!s.rec&&!!s.rec.libId,'고치던 초안');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);f=await board();
  await f.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:20000});
  assert.match(await f.evaluate(()=>document.querySelector('#psVaultDraftBar .vd-tx').textContent),/보관함에서 만들던 작전판이 있어요/);
  assert.equal(await f.evaluate(async()=>((await libGet())||[]).find(x=>x.name==='가상 되살린 작전판').snap.players[0].x),611,'보관함 자료는 저장한 그대로');
  await f.evaluate(()=>document.querySelector('#psVaultDraftBar .vd-drop').click());await until(f,gone,'버리기');

  // ⑨ 다른 계정 · 다른 팀의 초안은 묻지 않는다
  await f.evaluate(async()=>{const o=vaultBoardOwner(),k=PSVaultDraft.key(o);
    await storage.set(k,PSVaultDraft.make({uid:'22222222-2222-4222-8222-222222222222',wid:o.wid},{snap:{players:[]},frames:[{snap:{players:[]}},{snap:{players:[]}}]},{},Date.now()));
    await __psVaultDraft.refresh();});
  assert.equal(await f.evaluate(()=>!!document.getElementById('psVaultDraftBar')),false,'남의 초안은 띄우지 않는다');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true}));
}catch(e){
  await page.screenshot({path:path.join(out,`vault-board-draft-${engine}-failure.png`)}).catch(()=>{});
  console.error(JSON.stringify({logs:logs.filter(l=>l.type==='pageerror').slice(0,5)}));throw e;
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
