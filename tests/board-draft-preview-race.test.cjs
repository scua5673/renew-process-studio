'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Draft=require('../studio/board-draft.js'),source=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const start=source.indexOf('var __afWinRaf=0,__afIdle=0;'),end=source.indexOf('try{ var __afOnScroll=',start);
assert.ok(start>0&&end>start);const implementation=source.slice(start,end),tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function harness(){
 const frames=()=>Array.from({length:50},(_,i)=>({snap:{players:[{id:'synthetic-'+i,x:i}]},...(i===0?{thumb:'original first'}:{})}));
 const animation={frames:frames()},local=new Map(),idb=new Map(),idle=[],timers=[],cancelled=[],gate=deferred(),sharedGate=deferred(),owner={uid:'synthetic-preview-owner',wid:'synthetic-preview-personal'};let sharedWait=false,sharedChecks=0;
 const kids=Array.from({length:50},(_,i)=>{const aft={firstElementChild:null,innerHTML:'',querySelector:()=>null};return {querySelector:()=>aft,classList:{add(){},remove(){}},getBoundingClientRect:()=>({left:i*30,width:30})};});
 const box={children:kids,getBoundingClientRect:()=>({left:0,right:60})},w={PSBoardDraft:Draft,__qaAnim:animation,animActive:0,animPlaying:false,_afDragging:false,
  document:{getElementById:id=>id==='animFrames'?box:null,body:{classList:{contains:()=>false}},addEventListener(){}},
  thumbView:f=>f.thumb,psDragging:()=>false,__snapToThumb:()=> 'synthetic derived thumbnail',
  requestIdleCallback:cb=>(idle.push(cb),idle.length),cancelIdleCallback:id=>cancelled.push(id),
  setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout:id=>cancelled.push('timeout:'+id),
  _boardPrivateOwner:owner,_boardPrivateLoaded:true,_boardPrivateEditSeq:1,_boardPrivateGeneration:1,
  boardPrivateCurrent:()=>true,boardManualChanged:()=>true,boardDraftWriteNow(){},boardDraftKey:()=> 'synthetic-preview-draft',
  boardLiveCapture:()=>({raw:JSON.stringify({snap:{players:[{id:'synthetic-live',x:521}]},animFrames:animation.frames,boardPages:{pages:[{anim:{frames:animation.frames}}]}})}),restoreAnimBeforeCapture(){},
  localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},
  storage:{async get(k){return idb.has(k)?{value:idb.get(k)}:null;},async replaceIfValue(k,b,v,guard){guard();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;}},
  PSStorage:{async sharedReady(){sharedChecks++;if(sharedWait)await sharedGate.promise;return true;},async sharedVerified(k,raw){await gate.promise;assert.equal(idb.get(k),raw);}}
 };w.window=w;vm.createContext(w);vm.runInContext('const anim=__qaAnim;delete window.__qaAnim;'+implementation,w);assert.equal(w.anim,undefined);Draft.install(w);
 return {w,anim:animation,frames,idle,timers,cancelled,local,idb,gate,sharedGate,pauseShared(){sharedWait=true;},sharedChecks:()=>sharedChecks,raw:()=>w.boardLiveCapture().raw};
}
test('a held board receipt cancels old idle work and blocks new cache mutation of the captured body',async()=>{
 const h=harness();h.w.__afWindow();const old=h.idle[0];h.anim.frames[45].thumb='retain the full far-away original';const before=h.raw(),work=h.w.psFlushPendingReady();work.catch(()=>{});await tick();
 try{old();h.w.__afWindow();assert.equal(h.raw()===before,true,'neither canceled idle work nor fresh admission may change a held body');assert.equal(h.anim.frames[45].thumb,'retain the full far-away original');assert.equal(h.w.psHasPending(),true);}
 finally{h.gate.resolve();await work.catch(()=>{});}
 assert.equal(h.w.__psBoardDraft.snapshot().localDurable,true);assert.equal(h.w.psHasPending(),false);assert.equal(h.local.size,0);
});
test('a canceled idle callback cannot mutate the body after the exact receipt is released',async()=>{
 const h=harness();h.w.__afWindow();const old=h.idle[0],before=h.raw(),work=h.w.psFlushPendingReady();await tick();h.gate.resolve();await work;old();assert.equal(h.raw()===before,true);
});
test('an old thumbnail callback cannot write a replacement animation frame array',()=>{
 const h=harness();h.w.__afWindow();const old=h.idle[0];h.anim.frames=h.frames();old();assert.equal(h.anim.frames[1].thumb,undefined);
 h.w.__afWindow();assert.equal(h.idle.length,2,'expired own handle must permit fresh preview work');h.idle[1]();assert.equal(h.anim.frames[1].thumb,'synthetic derived thumbnail');
});
test('normal rendering can generate previews again after a completed exact receipt',async()=>{
 const h=harness(),work=h.w.psFlushPendingReady();await tick();h.gate.resolve();await work;h.w.__afWindow();assert.ok(h.idle.length);h.idle.at(-1)();assert.equal(h.anim.frames[1].thumb,'synthetic derived thumbnail');
});
test('an obsolete callback cannot clear a newer preview handle',async()=>{
 const h=harness();h.w.__afWindow();const old=h.idle[0],work=h.w.psFlushPendingReady();await tick();h.gate.resolve();await work;h.w.__afWindow();const handle=h.w.__afIdle;assert.ok(handle);old();assert.equal(h.w.__afIdle,handle);h.idle.at(-1)();assert.equal(h.anim.frames[1].thumb,'synthetic derived thumbnail');
});
test('the complete flush retains the body while final shared storage readiness is pending',async()=>{
 const h=harness();h.w.__afWindow();h.pauseShared();const before=h.raw(),work=h.w.psFlushPendingReady();await tick();h.gate.resolve();await tick();assert.equal(h.sharedChecks(),1);
 try{for(const callback of h.timers.splice(0))callback();h.w.__afWindow();h.idle.at(-1)();assert.equal(h.raw()===before,true,'the final storage barrier still owns the thumbnail hold');}
 finally{h.sharedGate.resolve();await work;}
 assert.equal(h.w.__psBoardDraft.snapshot().localDurable,true);
});
