'use strict';
/* 3.298 — 보관함 작전판 기기 초안(board-vault-draft.js)의 «연 그대로의 모습(base)» 잡기.
   느린 기기에서 항목 열기(__vaultHydrating)가 650ms 를 넘으면 기준을 못 잡았고, 첫 손질의 쓰기가 기준만 잡고 끝나
   손질이 하나뿐이면 초안이 영영 안 적혔다(CI 웹킷 vault-board-draft «고치던 초안» 시간 초과). 가짜 창 · 가짜 타이머로 돌린다. */
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../studio/board-vault-draft.js');
const OWNER={uid:'synthetic-coach',wid:'synthetic-team',seal:'s'};
function fakeWindow(){
  const timers=[];let now=0,seq=0;
  const el=()=>({id:'',style:{},textContent:'',innerHTML:'',parentNode:null,setAttribute(){},querySelector(){return {textContent:'',onclick:null};}});
  const w={
    location:{search:''},URLSearchParams:class{get(){return null;}},
    __cls:new Set(),__x:1,
    document:{body:{classList:{contains:n=>w.__cls.has(n)},appendChild(){}},head:{appendChild(){}},
      getElementById:id=>id==='vCreateTitle'?{textContent:'가상 작전판'}:null,createElement:el,addEventListener(){}},
    setTimeout(fn,ms){const t={id:++seq,fn,at:now+ms};timers.push(t);return t.id;},
    clearTimeout(id){const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);},
    setInterval(){return 0;},clearInterval(){},addEventListener(){},toast(){},
    localStorage:{m:new Map(),getItem(k){return this.m.has(k)?this.m.get(k):null;},setItem(k,v){this.m.set(k,String(v));},removeItem(k){this.m.delete(k);}},
    storage:{m:new Map(),writes:[],async set(k,v){this.writes.push({k,v,at:now});this.m.set(k,v);},async get(k){return this.m.has(k)?{value:this.m.get(k)}:null;},async del(k){this.m.delete(k);}},
    vaultBoardOwner:()=>OWNER,vaultBoardBegin(){return 1;},vaultBoardRestore(){w._vaultBoardContext=null;},pushUndo(){},
    captureSnap:()=>({players:[{id:1,x:w.__x}]}),__vaultEditSig:()=>'sig:'+w.__x,libGet:async()=>[],
    _vaultBoardContext:null,__vaultEdit:false,__vaultHydrating:false,__vaultPending:null,__curVaultId:null,__vaultManualDirty:false,__boardRestoreDone:false
  };
  const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
  w.tick=async ms=>{const end=now+ms;for(;;){timers.sort((a,b)=>a.at-b.at);const t=timers[0];if(!t||t.at>end)break;timers.shift();now=t.at;t.fn();await flush();}now=end;await flush();};
  w.now=()=>now;w.flush=flush;
  return w;
}
const ctx=()=>({owner:{uid:OWNER.uid,wid:OWNER.wid,seal:OWNER.seal}});
function openForEdit(w,libId){w._vaultBoardContext=ctx();w.__vaultEdit=true;w.__curVaultId=libId;w.__vaultPending=null;w.__cls.add('vcreating');w.vaultBoardBegin();}

test('느린 열기: 650ms 에 아직 불러오는 중이면 기준을 잡을 수 있을 때까지 다시 보고, 첫 손질 하나로 초안이 적힌다',async()=>{
  const w=fakeWindow(),api=D.install(w);assert.ok(api);
  w.__vaultHydrating=true;openForEdit(w,'V1');
  await w.tick(650);assert.equal(api.state().base,undefined,'불러오는 중엔 기준을 잡지 않는다');
  w.__vaultHydrating=false;                                   // 열기가 650ms 뒤에야 끝났다
  await w.tick(300);assert.equal(typeof api.state().base,'string','열기가 끝나면 기준이 잡힌다');
  assert.equal(w.storage.writes.length,0,'기준만 잡고 초안은 적지 않는다');
  w.__x=2;w.__vaultManualDirty=true;w.pushUndo();              // 손질 하나
  await w.tick(800);
  assert.equal(w.storage.writes.length,1,'첫 손질이 초안으로 적힌다');
  const rec=D.parse(w.storage.writes[0].v,OWNER);assert.equal(rec.libId,'V1');assert.equal(rec.doc.snap.players[0].x,2);
  assert.equal(w.storage.writes[0].k,D.key(OWNER));
});

test('열기가 늦게 끝난 직후의 저장 길(flush): 편집기가 «변경 있음»이면 기준이 그때 잡혀도 초안을 적는다',async()=>{
  const w=fakeWindow(),api=D.install(w);
  w.__vaultHydrating=true;openForEdit(w,'V1');
  await w.tick(100);w.__vaultHydrating=false;w.__x=3;w.__vaultManualDirty=true;   // 기준을 잡기 전에 손대고 바로 탭을 닫는다
  assert.equal(api.flush(),true);await w.flush();
  assert.equal(w.storage.writes.length,1);assert.equal(D.parse(w.storage.writes[0].v,OWNER).doc.snap.players[0].x,3);
});

test('새 작전판은 예전처럼: 기준이 잡힌 뒤 연 그대로면 적지 않고, 달라져야 적는다',async()=>{
  const w=fakeWindow(),api=D.install(w);
  w._vaultBoardContext=ctx();w.__vaultEdit=true;w.__vaultPending={name:'새 작전판'};w.__cls.add('vcreating');w.vaultBoardBegin();
  await w.tick(700);assert.equal(typeof api.state().base,'string');assert.equal(w.storage.writes.length,0);
  w.pushUndo();await w.tick(800);assert.equal(w.storage.writes.length,0,'연 그대로의 모습이면 초안이 아니다');
  w.__x=4;w.pushUndo();await w.tick(800);assert.equal(w.storage.writes.length,1);assert.equal(D.parse(w.storage.writes[0].v,OWNER).libId,null);
});

test('되살린 판(base=null)은 예전처럼 650ms 에 한 번 적는다 — 저장하고 나가면 그 초안에 libId 가 붙어 낡은 것으로 걷힌다',async()=>{
  const w=fakeWindow();
  const draft=D.make(OWNER,{snap:{players:[{id:1,x:5}]},frames:[{snap:{players:[{id:1,x:5}]}},{snap:{players:[{id:1,x:6}]}}],pages:null},{},1000);
  w.storage.m.set(D.key(OWNER),draft);w.__boardRestoreDone=true;
  w.__vaultNewBoard=function(){w._vaultBoardContext=ctx();w.__vaultPending={name:'되살림'};w.__vaultEdit=true;w.__cls.add('vcreating');w.vaultBoardBegin();};   /* 실제 vaultBoardBegin 처럼 맥락을 먼저 두고 돌아온다 */
  const api=D.install(w);await w.flush();await w.flush();
  assert.equal(api.state().offered,true,'부팅 뒤 초안을 띠로 묻는다');
  assert.equal(api.restore(),true);
  await w.tick(450);assert.equal(api.state().base,null,'되살린 판은 기준 없이 바로 적는 길');
  await w.tick(250);                                           // 650ms — 예전의 한 번 쓰기
  assert.equal(w.storage.writes.length,1,'650ms 에 초안을 적는다(기준이 null 이어도 멈추지 않는다)');
  assert.ok(api.state().last,'last 가 있어야 저장 뒤 libId 를 덧쓸 수 있다');
  // «저장하기»로 보관함에 담고 나간다 → 초안에 libId 가 붙는다
  w.__curVaultId='V9';w.__vaultPending=null;w.__vaultManualDirty=false;w.vaultBoardRestore();await w.flush();
  const lastWrite=w.storage.writes[w.storage.writes.length-1];assert.equal(D.parse(lastWrite.v,OWNER).libId,'V9');
});
