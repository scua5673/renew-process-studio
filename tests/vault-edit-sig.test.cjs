'use strict';
/* 3.086 — 보관함 작전판 저장 지문(__vaultEditSig)에 장면 속도 · 유지 시간이 들어간다.
   빠지면 저장한 뒤 속도(«모든 장면» 포함)나 유지 시간만 바꿨을 때 지문이 같아 자동 저장이 건너뛰어졌다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const b=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const start=b.indexOf('window.__vaultEditSig=function(){'),end=b.indexOf('\n',start);
assert.ok(start>0&&end>start,'__vaultEditSig 를 찾지 못했다');
function sigOf(frames,active,hold){
  const c=vm.createContext({window:{},anim:{frames},animActive:active,animHold:hold,captureSnap:()=>({players:[{id:1,x:1,y:2}]}),JSON});
  vm.runInContext(b.slice(start,end),c);return c.window.__vaultEditSig();
}
const fr=()=>[{snap:{players:[]},dur:1},{snap:{players:[]},dur:1},{snap:{players:[]},dur:1}];
test('scene speed on any scene changes the signature',()=>{
  const a=fr(),base=sigOf(a,0,0.6);assert.ok(base);
  const b1=fr();b1[0].moveSpeed=2;assert.notEqual(sigOf(b1,0,0.6),base,'지금 장면 속도');
  const b2=fr();b2[2].moveSpeed=1.5;assert.notEqual(sigOf(b2,0,0.6),base,'다른 장면 속도');
  const all=fr();all.forEach(f=>f.moveSpeed=2);assert.notEqual(sigOf(all,1,0.6),base,'모든 장면 속도');
});
test('hold time changes the signature, nothing else does',()=>{
  assert.notEqual(sigOf(fr(),0,0.1),sigOf(fr(),0,0.6),'유지 시간');
  assert.equal(sigOf(fr(),0,0.6),sigOf(fr(),0,0.6),'같은 판이면 같은 지문');
});
