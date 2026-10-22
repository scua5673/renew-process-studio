'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {write}=require('../studio/sync-mirror.js');
function fixture(){
  const f={idb:'remote',mirrorRaw:'base',owner:true,hook:()=>{}};
  f.options={key:'scout_tool_v1',value:'remote',before:'base',mirrorBefore:'base',current:()=>f.owner,
    mirror:{getItem:()=>f.mirrorRaw,setItem(){throw Object.assign(Error('quota'),{name:'QuotaExceededError'});}},
    storage:{async replaceIfValue(k,expected,value,current){await f.hook();current();if(f.idb!==expected)return false;f.idb=value;return true;}}};
  return f;
}
test('quota rollback restores the exact previous IDB without claiming success',async()=>{
  const f=fixture();await assert.rejects(write(f.options),{psCode:'sync_storage'});assert.equal(f.idb,'base');assert.equal(f.mirrorRaw,'base');
});
for(const target of ['idb','mirrorRaw','owner'])test('rollback preserves a newer '+target+' at the transaction boundary',async()=>{
  const f=fixture();f.hook=()=>{f[target]=target==='owner'?false:'newer';};
  await assert.rejects(write(f.options),{psCode:'sync_storage'});
  assert.equal(f.idb,target==='idb'?'newer':'remote');assert.equal(f.mirrorRaw,target==='mirrorRaw'?'newer':'base');
});
test('failed rollback stays unconfirmed and retains both surviving copies',async()=>{
  const f=fixture();f.hook=()=>{throw Error('IDB unavailable');};
  await assert.rejects(write(f.options),{psCode:'sync_storage'});assert.equal(f.idb,'remote');assert.equal(f.mirrorRaw,'base');
});
test('exact mirror write completes normally',async()=>{
  const f=fixture();f.options.mirror.setItem=(_k,v)=>{f.mirrorRaw=v;};
  assert.deepEqual(await write(f.options),{stale:false});assert.equal(f.idb,f.mirrorRaw);
});
