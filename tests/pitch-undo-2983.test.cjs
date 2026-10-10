const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.983 — 운동장 개수·피치(색)도 ⌘Z 한 걸음.
   전에는 이 둘만 되돌리기 기록이 없어, ⌘Z 가 그 앞의 편집까지 함께 되돌렸다(2.982 가 범위·확대 쪽·규격·방향과 나란히 모든 장면에 걸면서 드러난 차이). */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }

test('the pitch count records an undo step only when the number really changes',()=>{
  const log={undo:0};
  const c=vm.createContext({state:{pitchN:1},window:{},pushUndo:()=>{log.undo++;},__rescaleGrass:()=>{},boardSaveLive:()=>{},_viewScenesMatch:()=>({n:0,total:0}),_viewScenesToast:r=>r});
  vm.runInContext(cut('window.__setPitchN=function(n){','window.__getPitchView='),c);
  c.window.__setPitchN(1);assert.equal(log.undo,0,'same number → nothing to undo');
  c.window.__setPitchN(3);assert.equal(log.undo,1);assert.equal(c.state.pitchN,3);
  c.window.__setPitchN(3);assert.equal(log.undo,1);
  c.window.__setPitchN(0);assert.equal(c.state.pitchN,1,'anything that is not a count means one pitch');assert.equal(log.undo,2);
  assert.ok(cut('window.__setPitchN=function(n){','window.__getPitchView=').indexOf('pushUndo()')<cut('window.__setPitchN=function(n){','window.__getPitchView=').indexOf('state.pitchN=_nn'),'the record is taken before the change');
});

test('one drag of the colour picker is one undo step',()=>{
  const log={undo:0};let timer=null;
  const c=vm.createContext({pushUndo:()=>{log.undo++;},setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{}});
  vm.runInContext(cut('var _viewUndoT=null;','/* 색상 고르개는 끄는 동안 input 이 줄줄이 온다')+';this.once=_viewUndoOnce;',c);
  c.once();c.once();c.once();
  assert.equal(log.undo,1,'the inputs of one drag share a step');
  timer();c.once();
  assert.equal(log.undo,2,'after a pause the next drag is a new step');
});

test('picking a pitch is an undo step for a person — a click made by the program records nothing',()=>{
  assert.match(src,/if\(\(e\.isTrusted\|\|window\.__psUserClick\)&&!b\.classList\.contains\("on"\)\)\{try\{pushUndo\(\);\}catch\(_\)\{\}\}\n\s*\[\.\.\._sg\.children\]\.forEach\(x=>x\.classList\.remove\("on"\)\);/,'recorded before the buttons are repainted, and only when the pitch really changes');
  assert.match(src,/function applyCustom\(color, _silent\)\{\n\s*if\(!_silent\)\{try\{_viewUndoOnce\(\);\}catch\(_\)\{\}\}/,'the colour picker records before it paints; restoring a saved colour (silent) records nothing');
});
