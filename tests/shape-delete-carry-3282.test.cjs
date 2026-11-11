// 3.282 — 제보 74e59fd4 «도형 삭제 기능»: 지운 그림은 이 장면부터 뒤 장면에서도 지운다(뒤에서 이미 없는 장면에서 멈춘다).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {removeDrawings}=require('../studio/board-shape-menu.js');
const d=(id,x)=>({type:'rect',_sceneId:id,color:'#fff',pts:[{x,y:10},{x:x+30,y:40}]});
const has=(r,id)=>r.frames.map(f=>(f.snap.drawings||[]).some(q=>q._sceneId===id)?1:0).join('');
test('deleted drawing is removed from the following scenes, earlier scenes untouched, copy-on-write',()=>{
  const a=d('a',100),b=d('b',300);
  const frames=[0,1,2,3,4].map(i=>({snap:{drawings:[d('a',100+i),d('b',300)],players:[{id:i}]},thumb:'t'+i,note:'n'+i}));
  frames[2]={snap:{drawings:[b]},thumb:'t2',note:'n2'};   // 지금 장면(2)은 판에서 이미 지워 담겼다
  const before=JSON.stringify(frames),r=removeDrawings(frames,2,[a]);
  assert.equal(JSON.stringify(frames),before,'원래 장면 목록은 고쳐 쓰지 않는다');
  assert.equal(has(r,'a'),'11000');assert.equal(has(r,'b'),'11111');
  assert.equal(r.changed,2);assert.equal(r.last,4);
  assert.equal(r.frames[0],frames[0]);assert.equal(r.frames[1],frames[1]);assert.equal(r.frames[2],frames[2]);
  assert.notEqual(r.frames[3],frames[3]);assert.equal(r.frames[3].thumb,undefined,'바뀐 장면의 썸네일은 다시 그린다');
  assert.equal(r.frames[3].note,'n3');assert.deepEqual(r.frames[3].snap.players,[{id:3}]);
});
test('a drawing moved in a later scene is still the same drawing',()=>{
  const r=removeDrawings([{snap:{drawings:[]}},{snap:{drawings:[d('a',900)]}}],0,[d('a',100)]);
  assert.equal(has(r,'a'),'00');
});
test('stops at the first later scene where the drawing is already absent',()=>{
  const frames=[{snap:{drawings:[]}},{snap:{drawings:[d('a',1)]}},{snap:{drawings:[]}},{snap:{drawings:[d('a',1)]}}];
  const r=removeDrawings(frames,0,[d('a',1)]);
  assert.equal(has(r,'a'),'0001');assert.equal(r.last,1);assert.equal(r.frames[3],frames[3]);
});
test('several drawings carry independently',()=>{
  const frames=[{snap:{drawings:[]}},{snap:{drawings:[d('a',1),d('b',2),d('c',3)]}},{snap:{drawings:[d('b',2),d('c',3)]}},{snap:{drawings:[d('a',1),d('b',2),d('c',3)]}}];
  const r=removeDrawings(frames,0,[d('a',1),d('b',2)]);
  assert.equal(has(r,'a'),'0001');assert.equal(has(r,'b'),'0000');assert.equal(has(r,'c'),'0111');assert.equal(r.last,3);
});
test('legacy drawings without ids: one clear match is removed, ambiguous ones are kept',()=>{
  const old=d(undefined,200),twin=d(undefined,250);
  const r=removeDrawings([{snap:{}},{snap:{drawings:[old]}},{snap:{drawings:[old,twin]}}],0,[d('a',100)]);
  assert.deepEqual(r.frames[1].snap.drawings,[]);assert.deepEqual(r.frames[2].snap.drawings,[old,twin]);assert.equal(r.skipped,1);
  const exact=removeDrawings([{snap:{}},{snap:{drawings:[old,twin]}}],0,[Object.assign({},old,{_sceneId:'z'})]);
  assert.deepEqual(exact.frames[1].snap.drawings,[twin],'모양이 같은 것이 여럿이면 내용까지 같은 하나만');
});
test('nothing after the last scene and nothing to do leaves frames as they are',()=>{
  const frames=[{snap:{drawings:[d('a',1)]}}],r=removeDrawings(frames,0,[d('a',1)]);
  assert.equal(r.changed,0);assert.equal(r.frames[0],frames[0]);assert.equal(r.last,0);
});
test('module wires both delete paths and leaves cut alone',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../studio/board-shape-menu.js'),'utf8');
  assert.match(src,/carryWrap\('removeDrawing'\); carryWrap\('deleteSelected'\)/);
  assert.match(src,/win\.tokClipCopy = function \(\) \{ cutting = true/);
  assert.match(src,/var mark = carryMark\(\);/);assert.match(src,/carryDone\(mark\);/);
});
