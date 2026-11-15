'use strict';
/* 3.292 — 보관된 선수 입력(보류)의 load 는 키 목록만 매번 읽고 본문은 id 마다 한 번만 읽는다.
   예전엔 load 마다 모든 기록을 두 번(list 가 본문을 다 읽고 · read 로 또) 읽어, 보류 896건의 «모두 해제»가 항목 하나에 1,800번 × 3 을 읽어 멈췄다. */
const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../studio/autosave-journal.js'),Q=require('../studio/sync-items-stale.js');
const raw=JSON.stringify,ROW='sq:p1',BASE=' {"id":"p1","name":"Synthetic","memo":"baseline"}\n',B=raw({id:'p1',name:'Synthetic',memo:'device B'}),PERMISSION=raw({role:'admin'});
function fixture(){
 let owner={uid:'synthetic-coach-c',wid:'synthetic-team-c',seal:'seal-c',epoch:'epoch-c',signout:0},permission=PERMISSION,uuid=0,at=1000;
 const context={uid:owner.uid,wid:owner.wid,seal:'autosave-seal-c',epoch:'epoch-c'},disk=new Map([[ROW,B]]),calls=[];
 const storage={
  async get(k){calls.push({method:'get',key:k});return disk.has(k)?{value:disk.get(k)}:null;},
  async set(k,v,current){calls.push({method:'set',key:k});if(current&&current()===false)throw Error('guard');disk.set(k,v);return true;},
  async keys(prefix){calls.push({method:'keys',prefix});return [...disk.keys()];},
  async replaceIfValue(k,before,value,current){if(current&&current()===false)throw Error('guard');if((disk.get(k)??null)!==before)return false;if(value===null)disk.delete(k);else disk.set(k,value);return true;},
  async setIfValues(k,expected,value,checks,current){if(current&&current()!==true)throw Error('guard');if((disk.get(k)??null)!==expected||Object.keys(checks).some(key=>(disk.get(key)??null)!==checks[key]))return false;disk.set(k,value);return true;}
 };
 const journal=J.create({storage,context:()=>context,hash:J.hash,randomUUID:()=>'00000000-0000-4000-8000-'+String(++uuid).padStart(12,'0'),now:()=>at++});
 const same=o=>!!o&&['uid','wid','seal','epoch','signout'].every(k=>o[k]===owner[k]);
 const deps={context:()=>context,journal:()=>journal,current:same,permission:()=>permission,storage,hash:J.hash,createJournal:J.create,journalPrefix:J.PREFIX};
 const job=i=>({players:[{id:'p1',name:'Synthetic',memo:'authored '+i}],owner:{...owner},at:50+i,sequence:i,expected:{p1:BASE},written:[],predecessors:[],patch:false,changedIds:[],deletedIds:[]});
 const stale=j=>Object.assign(Error('synthetic stale preimage'),{psCode:'sync_local_changed',psStage:'items_write_stale_job',psItemsJob:j,psItemId:'p1'});
 const api=Q.create(deps);
 const bodyReads=()=>calls.filter(c=>c.method==='get'&&c.key.indexOf(':archive:')>=0).length,keyLists=()=>calls.filter(c=>c.method==='keys').length;
 return {api,deps,journal,context,disk,calls,job,stale,bodyReads,keyLists,archives:()=>[...disk.keys()].filter(k=>k.indexOf(':archive:')>=0).length};
}
async function hold(h,n){for(let i=1;i<=n;i++){const j=h.job(i);await h.api.capture(j,h.stale(j));}}
test('a repeated load lists keys only — no archive body is read twice',async()=>{
 const h=fixture();await hold(h,30);assert.equal(h.api.count(),30);
 const before=h.bodyReads(),lists=h.keyLists();
 await h.api.load();await h.api.load();await h.api.before(h.job(99)).catch(()=>{});
 assert.equal(h.bodyReads(),before,'no body read on a repeated load');assert.ok(h.keyLists()>=lists+3,'but the key list is read every time');
 assert.equal(h.api.count(),30);assert.equal(h.api.fenced(ROW),true);
});
test('a record another client archived is picked up by the next load and only that body is read',async()=>{
 const h=fixture();await hold(h,10);await h.api.load();const other=Q.create(h.deps);const j=h.job(77);await other.capture(j,h.stale(j));
 const before=h.bodyReads();await h.api.load();
 assert.equal(h.api.count(),11);assert.equal(h.bodyReads()-before,1,'exactly the new body');
});
test('unrelated archives are read once and then skipped',async()=>{
 const h=fixture();await h.journal.archive(h.context,'cs_notes_v1','{"a":1}','{"a":2}',1,'team-conflict');await hold(h,3);
 const before=h.bodyReads();await h.api.load();await h.api.load();assert.equal(h.bodyReads(),before);assert.equal(h.api.count(),3);
});
test('a journal I/O failure on the key list still fails closed',async()=>{
 const h=fixture();await hold(h,3);const keys=h.deps.storage.keys;h.deps.storage.keys=async()=>{throw Error('synthetic key list failure');};
 await assert.rejects(h.api.load(),/synthetic key list failure/);h.deps.storage.keys=keys;await h.api.load();assert.equal(h.api.count(),3);
});
test('resolving every held row (the «모두 해제» path) reads bodies linearly, not quadratically, and retires all of them',async()=>{
 const h=fixture(),N=40;await hold(h,N);assert.equal(h.api.count(),N);
 const rows=(await h.journal.list(h.context)).filter(r=>r.reason==='items-stale-device');assert.equal(rows.length,N);
 const before=h.bodyReads(),archivesBefore=h.archives();
 for(const row of rows){
  const value=await h.journal.read(h.context,row.id);
  const prepared=await h.api.prepare(row,value,()=>true);if(prepared&&prepared.resolved)continue;
  const result=await h.api.resolve(row,value,prepared,()=>true);assert.equal(result.resolved,true);
 }
 const reads=h.bodyReads()-before;
 assert.ok(reads<=8*N+10,'bodies read while resolving '+N+' rows: '+reads+' (old code ≈ 6·N² = '+(6*N*N)+')');
 assert.equal(h.api.count(),0,'every hold retired');assert.equal(h.archives(),archivesBefore+N,'originals kept, one receipt per row');
 const fresh=Q.create(h.deps);await fresh.load();assert.equal(fresh.count(),0,'a fresh client reads the same receipts');
});
