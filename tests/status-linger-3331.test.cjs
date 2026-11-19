'use strict';
/* 3.331 — 일정에서 연 작전판 쇼 · 훈련 보기를 닫고 돌아오면 셸 상태 줄이 «기기 저장 확인 중… 다시 시도»(또는 «기기에 저장 중…»)에 머물던 것.
   까닭 둘: ① 셸 상태 계산(autosave-status observe)이 미팅 A4 미리보기 틀(#ksPagePreview — srcdoc)을 «아직 저장 상태를 알리지 않은 화면»(unknown)으로 셌다
   ② 보드에서 보관함 목록(setView('session'))으로 떠날 때 적은 lifecycle 초안의 영수증 확인(ready)을 아무도 부르지 않았다 — 사람이 탭을 누를 땐 셸 장벽이 부른다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {view,combine,observe}=require('../studio/autosave-status.js');
const {install}=require('../studio/board-draft.js');
const turn=()=>new Promise(r=>setImmediate(r));

/* ① 셸 상태 계산 — root-child-save-state 와 같은 가짜 창 */
function surface(name,owner,href){
  const frames=[],scopes={};const doc={name,querySelectorAll:()=>frames};
  const win={document:doc,location:{href:href||('https://fixture.test/'+name+'.html')},addEventListener(){},removeEventListener(){}};
  if(owner)win.PSSaveState={owner:()=>owner,snapshot:()=>({owner,scopes:{...scopes}})};
  return {win,doc,frames,scopes};
}
function frameOf(s,attrs){attrs=attrs||{};return {isConnected:true,contentWindow:s.win,getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs};}
test('a srcdoc preview frame inside the board is not an unknown app surface',()=>{
  const owner='coach/team/epoch',root=surface('app',owner),board=surface('board',owner);board.scopes['board-draft']='saved';
  root.frames.push(frameOf(board,{src:'board.html'}));
  const preview=surface('preview',null,'about:srcdoc');board.frames.push(frameOf(preview,{srcdoc:'<p>A4</p>'}));
  const m=observe(root.win,{owner:()=>owner,change(){}});
  const r=m.read();assert.equal(r.unknown,false,'미팅 A4 미리보기(srcdoc)는 세지 않는다');assert.equal(r.saved,true);
  assert.notEqual(combine(view({kind:'ok',at:1,n:0,review:0}),r).text,'기기 저장 확인 중…');
  m.dispose();
});
test('a srcdoc attribute alone is enough (before the frame navigates), and app frames without a save state still count',()=>{
  const owner='coach/team/epoch',root=surface('app',owner),board=surface('board',owner);
  root.frames.push(frameOf(board,{src:'board.html'}));
  board.frames.push(frameOf(surface('preview',null,'https://fixture.test/board.html'),{srcdoc:''}));
  const m=observe(root.win,{owner:()=>owner,change(){}});assert.equal(m.read().unknown,false);m.dispose();
  const root2=surface('app',owner);root2.frames.push(frameOf(surface('process',null),{src:'process.html'}));
  const m2=observe(root2.win,{owner:()=>owner,change(){}});assert.equal(m2.read().unknown,true,'저장 코드를 실은 앱 화면이 아직 상태를 안 알리면 예전처럼 모름');m2.dispose();
});

/* ② 작업 보드 초안 — board-draft-transition 과 같은 가짜 창. 원래 boardFlushLive 는 board.html 처럼 lifecycle 쓰기를 부른다 */
function boardWin(){
  const owner={uid:'synthetic-account-a',wid:'personal-a'},local=new Map(),idb=new Map(),timers=[];
  const raw=JSON.stringify({view:'board',snap:{players:[{id:'synthetic',x:321}]}});
  const w={_boardPrivateOwner:owner,_boardPrivateLoaded:true,_boardPrivateEditSeq:5,_boardPrivateGeneration:1,__csView:'board',
    document:{body:{classList:{contains:()=>false}}},boardDraftWriteNow(){},boardManualChanged:()=>true,boardPrivateCurrent:()=>true,
    boardLiveCapture:()=>({raw}),boardDraftKey:()=>'synthetic-draft',boardPrivateKey:()=>'synthetic-private',restoreAnimBeforeCapture(){},
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){local.set(k,v);},removeItem(k){local.delete(k);}},
    storage:{async get(k){return idb.has(k)?{value:idb.get(k)}:null;},async peek(k){return idb.has(k)?{value:idb.get(k)}:null;},
      async replaceIfValue(k,b,v,guard){guard();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;}},
    PSStorage:{sharedReady:async()=>true,async sharedVerified(k,v){assert.equal(idb.get(k),v);}}};
  w.boardFlushLive=function(){w.boardDraftWriteNow({lifecycle:true});return null;};
  install(w);
  /* setView('session') 의 차례: 보드 화면에서 flush → 화면을 보관함 목록으로 */
  w.leave=target=>{w.boardFlushLive(target);w.__csView='session';};
  w.run=async()=>{await turn();while(timers.length)timers.shift()();for(let i=0;i<6;i++)await turn();};
  return w;
}
test('leaving the board for the vault list confirms the lifecycle draft receipt without a shell barrier',async()=>{
  const w=boardWin();w.leave('session');await w.run();
  const s=w.__psBoardDraft.snapshot();
  assert.equal(w.__psBoardDraft.confirmWhy(),'ok');
  assert.equal(s.blocked,true,'보관함 목록은 빌린 화면');assert.equal(s.pending,false,'영수증이 확인되어 대기가 아니다');
  assert.equal(s.localDurable,true);assert.equal(s.sourceSuspended,true);assert.equal(w.psHasPending(),false);
});
test('a flush without a borrowed target (tab hidden · page closing) does not schedule the confirmation',async()=>{
  const w=boardWin();w.boardFlushLive();w.__csView='session';await w.run();
  assert.equal(w.__psBoardDraft.confirmWhy(),'','확인을 걸지 않는다');assert.equal(w.__psBoardDraft.pending(),true,'예전처럼 장벽이 올 때까지 대기 — 고치기 전 모습');
});
test('staying on the board, or nothing to save, schedules nothing to read',async()=>{
  const w=boardWin();w.boardFlushLive('board');await w.run();assert.equal(w.__psBoardDraft.confirmWhy(),'');
  const w2=boardWin();w2.boardManualChanged=()=>false;w2.leave('session');await w2.run();assert.equal(w2.__psBoardDraft.confirmWhy(),'skip');
});
