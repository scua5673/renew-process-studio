'use strict';
/* 3.255 — 3.253 은 아직 안 올라간 마지막 판과 같은 선수를 새 묶음에 다시 쓰지 않는다. 그때 돌려주는 영수증의 이전 판 기록은
   예전(3.252 까지) 새 묶음이 적던 기록과 같아야 한다 — 선수 행 쓰기가 이 기록을 «이 기기가 쓴 판»으로 받아들인다(sync.js itemsWritePreimage).
   예전 묶음 모양은 3.253 시험의 legacyStage 와 같은 규칙(이전 기록 + 마지막 판, 같은 것은 한 번). */
const test=require('node:test'),assert=require('node:assert/strict');
const {create,prefix}=require('../studio/roster-outbox.js');
const owner={uid:'coach:a',wid:'team:b'},PFX=prefix+encodeURIComponent(owner.uid)+':'+encodeURIComponent(owner.wid)+':';
const p=(id,name,more={})=>({id,name,type:'ours',memo:'원문 '+id,...more});
function storage(){
  const map=new Map();
  return {map,get length(){return map.size;},key(i){return [...map.keys()][i]??null;},getItem(k){return map.has(k)?map.get(k):null;},setItem(k,v){map.set(k,String(v));},removeItem(k){map.delete(k);}};
}
const batches=ls=>[...ls.map.keys()].filter(k=>k.startsWith(PFX+'b:'));
function legacyHistory(row){const seen=new Set(),out=[];for(const x of (row.history||[]).concat(row.player?[row.player]:[])){const raw=JSON.stringify(x);if(!seen.has(raw)){seen.add(raw);out.push(JSON.parse(raw));}}return out;}

test('a re-saved unchanged player carries the history the old full re-write recorded',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner});
  const base=p('a','A0'),roster=[p('a','A1')];
  const first=box.stage({players:roster,basePlayers:[base],changedIds:['a'],deletedIds:[]});
  assert.deepEqual(first.rows[0].history,[]);
  const keys=batches(ls),raw=keys.map(k=>ls.getItem(k));
  const again=box.stage({players:roster,basePlayers:[base],changedIds:['a'],deletedIds:[]});
  assert.deepEqual(batches(ls),keys,'still no new batch');assert.deepEqual(keys.map(k=>ls.getItem(k)),raw,'stored batch untouched');
  assert.deepEqual(again.rows[0].history,legacyHistory(first.rows[0]),'same history as a fresh batch row would have');
  assert.deepEqual(again.rows[0].history,[p('a','A1')]);
  assert.deepEqual(again.rows[0].base,base);assert.deepEqual(again.rows[0].player,p('a','A1'));
  assert.deepEqual(again.rows[0].sources,first.rows[0].sources,'ack identity is the pending source');
  /* the stored state (read) is unchanged — only the receipt for this save carries the extra version */
  assert.deepEqual(box.read().rows[0].history,[]);
  assert.equal(box.ack(again),1);assert.equal(box.pending(),false);
});

test('mixed save: the reused player gets its own version in history, the edited one is written as before',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner});
  box.stage({players:[p('a','A1'),p('b','B1')],basePlayers:[p('a','A0'),p('b','B0')],changedIds:['a','b'],deletedIds:[]});
  const second=box.stage({players:[p('a','A2'),p('b','B1')],basePlayers:[],changedIds:['a','b'],deletedIds:[]});
  assert.deepEqual(second.rows.map(r=>r.id),['a','b']);
  assert.deepEqual(second.rows[0].history,[p('a','A1')],'written row: previous version');
  assert.deepEqual(second.rows[1].history,[p('b','B1')],'reused row: its own pending version');
  const third=box.stage({players:[p('a','A2'),p('b','B1')],basePlayers:[],changedIds:['a','b'],deletedIds:[]});
  assert.equal(batches(ls).length,2,'nothing new to write');
  assert.deepEqual(third.rows[0].history,[p('a','A1'),p('a','A2')]);
  assert.deepEqual(third.rows[1].history,[p('b','B1')]);
  assert.equal(box.ack(third),2);assert.equal(box.pending(),false);assert.equal(batches(ls).length,0);
});

test('a reused deleted row keeps its history as is',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner});
  const first=box.stage({players:[],basePlayers:[p('x','X')],changedIds:[],deletedIds:['x']});
  const again=box.stage({players:[],basePlayers:[p('x','X')],changedIds:[],deletedIds:['x']});
  assert.equal(again.rows[0].deleted,true);assert.deepEqual(again.rows[0].history,first.rows[0].history);
});
