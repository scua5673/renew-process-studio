const test=require('node:test'),assert=require('node:assert/strict'),{resetDrawings}=require('../studio/board-shape-menu.js');
const d=(id,x)=>({type:'rect',_sceneId:id,color:'#fff',pts:[{x,y:10},{x:x+30,y:40}]});
test('selected drawing resets only later matching drawings and preserves unrelated data',()=>{
 const now=d('a',100),other=d('b',300),frames=[{snap:{drawings:[d('a',0)],players:[{id:1}]}},{snap:{drawings:[now,other]},note:'active'},{snap:{drawings:[d('a',200),other],players:[{id:2}]},note:'later',thumb:'old'}];
 const before=JSON.stringify(frames),r=resetDrawings(frames,1,[now]);assert.equal(JSON.stringify(frames),before);assert.equal(r.frames[0],frames[0]);assert.equal(r.frames[1],frames[1]);assert.deepEqual(r.frames[2].snap.drawings,[now,other]);assert.deepEqual(r.frames[2].snap.players,[{id:2}]);assert.equal(r.frames[2].note,'later');assert.equal(r.frames[2].thumb,undefined);assert.notEqual(r.frames[2].snap.drawings[0],now);
});
test('one legacy shape can be matched but ambiguous legacy drawings are retained',()=>{
 const now=d('a',100),old=d(undefined,200),other=d(undefined,250),r=resetDrawings([{snap:{}},{snap:{drawings:[old]}},{snap:{drawings:[old,other]}}],0,[now]);assert.equal(r.changed,1);assert.equal(r.skipped,1);assert.deepEqual(r.frames[1].snap.drawings,[now]);assert.deepEqual(r.frames[2].snap.drawings,[old,other]);
});
