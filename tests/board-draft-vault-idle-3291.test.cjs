'use strict';
/* 3.291 — 보관함 항목을 연 채(blocked:vault-edit) 저장할 게 없으면(c.idle) 작업 보드 초안의 기존 영수증을 읽어 확인하고 지나간다.
   쓰지 않고 · 캔버스를 담지 않고 · 영수증이 없거나 그 사이 편집 · 주인 · 저장소가 바뀌었으면 예전처럼 막는다. */
const test=require('node:test'),assert=require('node:assert/strict'),Draft=require('../studio/board-draft.js');
function fixture(){
 let owner={uid:'synthetic-idle',wid:'synthetic-personal',seal:'seal',active:'synthetic-team',epoch:1},seq=1,generation=1,needed=true,vault=false,idle=false,view='board',at=100,captures=0;
 let raw=JSON.stringify({view:'board',snap:{players:[{id:'synthetic',x:521}]}});
 const local=new Map(),idb=new Map(),writes=[],reads=[],states=[],key='ps_private_board_draft_v1:synthetic-idle:unsaved';
 const d={context:()=>({owner,seq,generation,view,current:true,paused:false,needed,blocked:vault||view!=='board',why:vault?'vault-edit':(view!=='board'?'view':''),idle:vault&&idle,borrowed:view!=='board'}),key:()=>key,now:()=>++at,
  capture(){captures++;assert.equal(vault||view!=='board',false,'보관함 항목을 연 동안 · 빌린 보기에서 판을 담지 않는다');return {raw};},
  local:{getItem:k=>local.get(k)??null,setItem(k,v){writes.push(['ls',k]);local.set(k,v);},removeItem(k){writes.push(['remove',k]);local.delete(k);}},
  storage:{async get(k){reads.push(['get',k]);return idb.has(k)?{value:idb.get(k)}:null;},async peek(k){reads.push(['peek',k]);return idb.has(k)?{value:idb.get(k)}:null;},
   async replaceIfValue(k,b,v,guard){guard();if((idb.get(k)??null)!==b)return false;writes.push(['idb',k]);idb.set(k,v);return true;}},
  async verifyIDB(k,v){reads.push(['verify',k]);assert.equal(idb.get(k),v);},state:(kind,e)=>states.push({kind,e})};
 const api=Draft.create(d);
 return {api,d,key,local,idb,writes,reads,states,captures:()=>captures,openVault(clean){view='board';vault=true;idle=!!clean;},borrow(){view='session';vault=false;idle=false;},dirty(){idle=false;},clean(){idle=true;},leaveVault(){vault=false;idle=false;},edit(){seq++;raw=raw.replace('521','999');},generation(){generation++;},owner(){owner={...owner,wid:'other'};},notNeeded(){needed=false;}};
}
const why=p=>p.then(()=>null,e=>e.psWhy);
test('idle vault edit passes on an exact existing receipt without writing or capturing',async()=>{
 const h=fixture();await h.api.ready();const record=h.idb.get(h.key);assert.ok(record);
 h.openVault(true);const writes=h.writes.length,captures=h.captures();
 await h.api.ready();
 assert.equal(h.writes.length,writes,'no new write');assert.equal(h.captures(),captures,'no capture');assert.equal(h.idb.get(h.key),record);
 assert.ok(h.reads.some(r=>r[0]==='peek'),'reads the stored receipt');assert.equal(h.api.snapshot().localDurable,true);assert.equal(h.api.snapshot().failed,false);
 assert.equal(h.api.pending(),false,'a confirmed idle receipt is not pending (shell frame_pending · status line)');assert.equal(h.api.snapshot().sourceSuspended,true);
 h.dirty();assert.equal(h.api.pending(),true,'editing the vault item again is pending');
});
test('entering the vault list interrupts the lifecycle verification, and the idle vault edit still passes on the stored record',async()=>{
 const h=fixture();await h.api.ready();
 const exit=h.api.write({lifecycle:true,exitTarget:'session'});exit.catch(()=>{});h.borrow();await exit.catch(()=>{});
 assert.equal(h.api.snapshot().localDurable,false,'the interrupted verification leaves the job not yet durable');
 h.openVault(true);const writes=h.writes.length,captures=h.captures();
 await h.api.ready();
 assert.equal(h.writes.length,writes);assert.equal(h.captures(),captures);assert.equal(h.api.snapshot().localDurable,true);assert.equal(h.api.snapshot().failed,false);
});
test('a dirty vault edit still blocks with the same reason the update notice understands',async()=>{
 const h=fixture();await h.api.ready();h.openVault(false);
 assert.equal(await why(h.api.ready()),'blocked:vault-edit');
 h.clean();await h.api.ready();h.dirty();assert.equal(await why(h.api.ready()),'blocked:vault-edit');
});
test('idle without any durable receipt still blocks',async()=>{
 const h=fixture();h.openVault(true);assert.equal(await why(h.api.ready()),'blocked:vault-edit');assert.equal(h.writes.length,0);assert.equal(h.captures(),0);
});
for(const kind of ['edit','generation','owner'])test('an idle receipt cannot survive '+kind,async()=>{
 const h=fixture();await h.api.ready();h.openVault(true);h[kind]();
 const writes=h.writes.length;assert.equal(await why(h.api.ready()),'blocked:vault-edit');assert.equal(h.writes.length,writes);
});
test('a receipt whose stored copy changed underneath is rejected, never rewritten',async()=>{
 const h=fixture();await h.api.ready();h.openVault(true);
 const foreign=JSON.stringify({v:1,uid:'synthetic-idle',wid:'synthetic-personal',raw:'{"synthetic":"foreign"}',at:999});h.idb.set(h.key,foreign);
 const writes=h.writes.length;await assert.rejects(h.api.ready(),e=>e.psConflict===true);assert.equal(h.idb.get(h.key),foreign);assert.equal(h.writes.length,writes);
});
test('nothing needed resolves regardless of the vault',async()=>{
 const h=fixture();h.notNeeded();h.openVault(false);assert.equal(await h.api.ready(),true);
});
test('back on the board after an idle pass, the ordinary full verification still works',async()=>{
 const h=fixture();await h.api.ready();h.openVault(true);await h.api.ready();h.leaveVault();await h.api.ready();assert.equal(h.api.pending(),false);
 h.edit();await h.api.ready();assert.equal(JSON.parse(JSON.parse(h.idb.get(h.key)).raw).snap.players[0].x,999);
});
