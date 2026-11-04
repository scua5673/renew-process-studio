'use strict';
/* 3.253 — «올라갈 차례인 선수 변경» 묶음이 작은 저장소를 채운 기기(제보 e6fc5d26 — 10MB 중 9.9MB).
   서버 저장이 막히면 기준이 안 바뀌어, 예전 판은 저장할 때마다 같은 선수들을 같은 내용으로 새 묶음에 다시 썼다.
   여기서는 그 예전 묶음을 글자 그대로 만들어(legacyStage) 새 판의 정리(prune) · 다시 쓰지 않기가
   ① 지금 상태 · 기준 판 · 이전 판 기록(집합) · 순서를 바꾸지 않는지 ② 가득 찬 저장소에서도 다시 저장 · 확인 표시를 쓰게 하는지 본다. */
const test=require('node:test'),assert=require('node:assert/strict');
const Outbox=require('../studio/roster-outbox.js'),Pending=require('../studio/roster-pending.js');
const {create,prefix}=Outbox;
const owner={uid:'coach:a',wid:'team:b'},PFX=prefix+encodeURIComponent(owner.uid)+':'+encodeURIComponent(owner.wid)+':';
const quota=()=>Object.assign(Error('synthetic localStorage quota'),{name:'QuotaExceededError'});
const p=(id,name,more={})=>({id,name,type:'ours',memo:'원문 '+id,...more});

function storage(){
  const map=new Map();let cap=Infinity;
  const bytes=()=>[...map].reduce((n,[k,v])=>n+k.length+v.length,0);
  return {map,bytes,limit(v){cap=v;},get length(){return map.size;},key(i){return [...map.keys()][i]??null;},getItem(k){return map.has(k)?map.get(k):null;},
    setItem(k,v){v=String(v);const next=bytes()-(map.has(k)?k.length+map.get(k).length:0)+k.length+v.length;if(next>cap)throw quota();map.set(k,v);},removeItem(k){map.delete(k);}};
}
const batches=ls=>[...ls.map.keys()].filter(k=>k.startsWith(PFX+'b:'));
const outboxBytes=ls=>[...ls.map].filter(([k])=>k.startsWith(PFX)).reduce((n,[k,v])=>n+k.length+v.length,0);
function dedupe(rows){const seen=new Set(),out=[];for(const r of rows){const raw=JSON.stringify(r);if(!seen.has(raw)){seen.add(raw);out.push(JSON.parse(raw));}}return out;}
/* 3.252 까지의 stage 가 같은 선수들을 다시 쓸 때 만들던 묶음 그대로(다시 쓰지 않기 · 정리 없음). */
let legacySeq=0;
function legacyStage(ls,box,players,ids){
  const pending=Object.fromEntries(box.read().rows.map(r=>[r.id,r]));
  const seq=Math.max(0,...batches(ls).map(k=>JSON.parse(ls.getItem(k)).seq))+1,t='legacy-'+String(++legacySeq).padStart(6,'0');
  const rows=ids.map((pid,i)=>({id:pid,base:pending[pid]?pending[pid].base:null,player:JSON.parse(JSON.stringify(players.find(x=>x.id===pid))),deleted:false,token:t+':'+i,
    history:pending[pid]?dedupe(pending[pid].history.concat(pending[pid].player?[pending[pid].player]:[])):[]}));
  ls.setItem(PFX+'b:'+t,JSON.stringify({v:1,kind:'batch',uid:owner.uid,wid:owner.wid,token:t,seq,rows}));
}
/* 새 선수를 한 명씩 더하면서 저장을 여러 번(서버 저장이 막혀 한 번도 확인되지 않음), 중간에 고친 선수도 있다. */
function bloat(ls,box,{players=12,repeats=6}={}){
  const roster=[];
  for(let k=1;k<=players;k++){
    roster.push(p('n'+k,'새 선수 '+k));
    for(let r=0;r<repeats;r++){
      if(r===2&&k%3===0){const i=roster.findIndex(x=>x.id==='n'+(k-1));roster[i]={...roster[i],num:String(k)};}
      legacyStage(ls,box,roster,roster.map(x=>x.id));
    }
  }
  return roster;
}
/* state() 의 결과 — 이전 판 기록은 순서 없이(서버 쓰기는 «이 기기가 쓴 판» 목록으로만 쓴다), 나머지는 글자 그대로 · 순서 그대로. */
function view(box){return box.read().rows.map(r=>({id:r.id,base:r.base,player:r.player,deleted:r.deleted,token:r.token,history:r.history.map(x=>JSON.stringify(x)).sort()}));}

test('pruning a legacy bloat keeps every pending player, baseline, history set and order — and frees most of the space',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner});bloat(ls,box);
  const before=view(box),size=outboxBytes(ls),count=batches(ls).length;
  assert.equal(count,72);assert.ok(size>100000,'the legacy outbox really grew '+size);
  const removed=box.prune();
  assert.ok(removed>=50,'removed '+removed+' of '+count);
  assert.deepEqual(view(box),before,'the merged pending state is unchanged');
  assert.deepEqual(view(create({storage:ls,owner:()=>owner})),before,'a reopened outbox reads the same state');
  assert.ok(outboxBytes(ls)<size*0.35,'space reclaimed '+size+' → '+outboxBytes(ls));
  assert.equal(box.prune(),0,'a second pass finds nothing more to remove');
});

test('saving the same pending roster again writes no new batch and returns the same pending receipt',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner});
  const roster=[p('a','A'),p('b','B')];
  const first=box.stage({players:roster,basePlayers:[],changedIds:['a','b'],deletedIds:[]}),keys=batches(ls),raw=keys.map(k=>ls.getItem(k));
  const again=box.stage({players:roster,basePlayers:[],changedIds:['a','b'],deletedIds:[]});
  assert.deepEqual(batches(ls),keys,'no new batch');assert.deepEqual(keys.map(k=>ls.getItem(k)),raw);
  assert.deepEqual(again.rows.map(r=>[r.id,r.token,r.sources.length]),first.rows.map(r=>[r.id,r.token,1]));
  /* one changed player: only that player gets a new row; the unchanged one keeps its pending sources */
  const edited=box.stage({players:[p('a','A2'),p('b','B')],basePlayers:[],changedIds:['a','b'],deletedIds:[]});
  assert.equal(batches(ls).length,2);assert.deepEqual(JSON.parse(ls.getItem(batches(ls).find(k=>!keys.includes(k)))).rows.map(r=>r.id),['a']);
  assert.deepEqual(edited.rows.map(r=>r.id),['a','b'],'receipt keeps the caller order');
  assert.equal(edited.rows[0].player.name,'A2');assert.equal(edited.rows[0].sources.length,2);assert.equal(edited.rows[1].sources.length,1);
  /* the same receipt still retires everything */
  assert.equal(box.ack(edited),2);assert.equal(box.pending(),false);assert.equal(batches(ls).length,0);
  /* deleting twice is also one batch */
  const del1=box.stage({players:[],basePlayers:[p('x','X')],changedIds:[],deletedIds:['x']});const n=batches(ls).length;
  box.stage({players:[],basePlayers:[p('x','X')],changedIds:[],deletedIds:['x']});assert.equal(batches(ls).length,n);assert.equal(del1.rows[0].deleted,true);
});

test('a full localStorage of legacy batches lets the next edit and its ACK through',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner}),roster=bloat(ls,box);
  ls.setItem('scout_tool_v1','{"players":[]}');ls.limit(ls.bytes());
  assert.throws(()=>ls.setItem('probe','x'),/quota/,'the device storage is full');
  const before=view(box),next=roster.concat(p('late','이번에 더한 선수'));
  const receipt=box.stage({players:next,basePlayers:[],changedIds:next.map(x=>x.id),deletedIds:[]});
  const after=view(box);
  assert.deepEqual(after.filter(r=>r.id!=='late'),before,'older pending players are unchanged');
  assert.equal(after.find(r=>r.id==='late').player.name,'이번에 더한 선수');
  assert.equal(box.ack(receipt),next.length,'the ACK marker fits after the reclaim');assert.equal(box.pending(),false);
  assert.equal(batches(ls).length,0);
});

test('rows that the latest row does not cover, retained settlements and protected keys are never removed',()=>{
  /* two tabs staged from the same pending state: neither later row carries the other's version */
  const ls=storage(),a=create({storage:ls,owner:()=>owner}),b=create({storage:ls,owner:()=>owner});
  a.stage({players:[p('x','X1')],basePlayers:[p('x','X0')],changedIds:['x'],deletedIds:[]});
  const ra=a.stage({players:[p('x','X2a')],basePlayers:[p('x','X1')],changedIds:['x'],deletedIds:[]});
  ls.removeItem(ra.keys[ra.keys.length-1]);const raw=JSON.stringify(ra);void raw;
  b.stage({players:[p('x','X2b')],basePlayers:[p('x','X1')],changedIds:['x'],deletedIds:[]});
  a.stage({players:[p('x','X2a')],basePlayers:[p('x','X1')],changedIds:['x'],deletedIds:[]});
  const before=view(a),keys=batches(ls).slice();a.prune();assert.deepEqual(view(a),before);
  /* settlement: retained batches stay even when a later row covers them */
  const s=storage(),box=create({storage:s,owner:()=>owner});
  const r1=box.stage({players:[p('y','Y1')],basePlayers:[p('y','Y0')],changedIds:['y'],deletedIds:[]});
  box.stage({players:[p('y','Y2')],basePlayers:[p('y','Y1')],changedIds:['y'],deletedIds:[]});
  const proof=box.settle(r1,()=>true);void proof;
  box.stage({players:[p('y','Y3')],basePlayers:[p('y','Y2')],changedIds:['y'],deletedIds:[]});
  const settledKeys=r1.keys.slice();box.prune();for(const k of settledKeys)assert.notEqual(s.getItem(k),null,'retained batch '+k);
  /* removable() false keeps the key */
  const t=storage(),guarded=create({storage:t,owner:()=>owner,removable:()=>false}),roster=bloat(t,guarded,{players:3,repeats:4});void roster;
  const n=batches(t).length;assert.equal(guarded.prune(),0);assert.equal(batches(t).length,n);
  /* durable() false on the latest row: nothing is pruned for that player */
  const u=storage(),unsure=create({storage:u,owner:()=>owner,durable:k=>k!==batches(u).slice(-1)[0]});bloat(u,unsure,{players:1,repeats:5});
  const m=batches(u).length;unsure.prune();assert.equal(batches(u).length,m);void keys;
});

/* roster-pending — 작은 저장소가 가득 차 새 묶음이 큰 저장소(IndexedDB)로 구출된 채 다시 연 기기. 되돌리기(promote) 전에
   사이 묶음을 지워 자리를 만들고, 구출 원문은 그대로 작은 저장소로 옮긴다. */
const MAIN='scout_tool_v1',TOMBS='cs_player_del_v1';
function bridgeFixture(){
  const ls=storage(),idb=new Map();ls.setItem(MAIN,'{"players":[]}');ls.setItem(TOMBS,'{}');
  const disk={conditionalGuardVersion:1,
    async keys(pfx){return [...idb.keys()].filter(k=>k.startsWith(pfx));},
    async peek(k){return idb.has(k)?{value:idb.get(k)}:null;},
    async setIfValues(k,expected,raw,checks,current){current();if((idb.get(k)??null)!==expected)return false;idb.set(k,raw);current();return true;},
    async delIfValue(k,raw,current){current();if(idb.get(k)!==raw)return false;idb.delete(k);return true;}};
  const options={outbox:Outbox,local:ls,storage:disk,owner:()=>owner,stamp:()=>'stamp-1',editable:()=>true};
  return {ls,idb,disk,options,bridge:()=>Pending.create(options)};
}
test('a reopened device with a full localStorage and an IndexedDB rescue reclaims space and promotes the rescue',async()=>{
  const f=bridgeFixture(),raw=create({storage:f.ls,owner:()=>owner}),roster=bloat(f.ls,raw);
  /* the rescue a previous session preserved: the newest edit, written as a native batch into IndexedDB only */
  const pending=Object.fromEntries(raw.read().rows.map(r=>[r.id,r])),seq=Math.max(...batches(f.ls).map(k=>JSON.parse(f.ls.getItem(k)).seq))+1;
  const latest=roster.concat(p('rescued','구출된 선수')),t='rescue-000001';
  const doc={v:1,kind:'batch',uid:owner.uid,wid:owner.wid,token:t,seq,rows:latest.map((x,i)=>({id:x.id,base:pending[x.id]?pending[x.id].base:null,player:x,deleted:false,token:t+':'+i,
    history:pending[x.id]?dedupe(pending[x.id].history.concat([pending[x.id].player])):[]}))};
  f.idb.set(PFX+'b:'+t,JSON.stringify(doc));
  f.ls.limit(f.ls.bytes());assert.throws(()=>f.ls.setItem(PFX+'b:probe','x'),/quota/);
  const box=f.bridge();await box.prepare();assert.equal(box.hasRescue(),true);
  const before=view(box),size=outboxBytes(f.ls);
  await box.promote();
  assert.equal(box.hasRescue(),false,'the rescue was moved into localStorage');assert.equal(f.idb.size,0);
  assert.equal(f.ls.getItem(PFX+'b:'+t),JSON.stringify(doc),'the exact rescued original');
  assert.deepEqual(view(box),before,'pending state unchanged by reclaim and promotion');
  assert.ok(outboxBytes(f.ls)<size,'space reclaimed before promotion');
  assert.equal(view(box).find(r=>r.id==='rescued').player.name,'구출된 선수');
  /* now the ACK fits and everything retires */
  const receipt=box.read();assert.equal(box.ack(receipt),latest.length);assert.equal(box.pending(),false);
});

test('a bridged stage on a full localStorage reclaims before capturing, so the new batch stays in localStorage',async()=>{
  const f=bridgeFixture(),raw=create({storage:f.ls,owner:()=>owner}),roster=bloat(f.ls,raw);
  f.ls.limit(f.ls.bytes());
  const box=f.bridge();await box.prepare();const before=view(box);
  const next=roster.concat(p('late','이번에 더한 선수'));
  const receipt=box.stage({players:next,basePlayers:[],changedIds:next.map(x=>x.id),deletedIds:[]});
  assert.equal(box.hasRescue(),false,'no IndexedDB rescue was needed');assert.equal(f.idb.size,0);
  assert.deepEqual(view(box).filter(r=>r.id!=='late'),before);
  assert.equal(box.ack(receipt),next.length);assert.equal(box.pending(),false);
});

test('reclaimAll prunes every owner namespace in the storage and reports bytes, leaving other keys alone',()=>{
  const ls=storage(),box=create({storage:ls,owner:()=>owner});bloat(ls,box,{players:4,repeats:5});
  const other={uid:'x:y',wid:'team/2'},otherBox=create({storage:ls,owner:()=>other});
  for(let i=0;i<4;i++)otherBox.stage({players:[p('o','O'+i)],basePlayers:[p('o','O')],changedIds:['o'],deletedIds:[]});
  ls.setItem('scout_tool_v1','{"players":[]}');
  const before=[view(box),view(otherBox)],main=ls.getItem('scout_tool_v1');
  const done=Outbox.reclaimAll(ls);
  assert.ok(done.removed>0);assert.ok(done.after<done.before,JSON.stringify(done));
  assert.deepEqual([view(box),view(otherBox)],before);assert.equal(ls.getItem('scout_tool_v1'),main);
  assert.deepEqual(Outbox.reclaimAll(storage()),{removed:0,before:0,after:0});
});
