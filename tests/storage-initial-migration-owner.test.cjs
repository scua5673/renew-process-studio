'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=section('  function idbReplaceIfValue(','  function idbKeys(')+'\n'+section('  var MIGRATE=','  var migrated=');
const KEY='cs_drill_lib_v1',A='[{"id":"A-original"}]',B='[{"id":"B-new"}]',tick=()=>new Promise(r=>setImmediate(r));
function gate(){let release;return {promise:new Promise(r=>release=r),release:()=>release()};}
function harness(options={}){
  const local=new Map([[KEY,A],['ps_sync_session','{"uid":"coach"}'],['ps_active_ws','A'],['ps_cache_owner_v1','{"uid":"coach","wid":"A","nonce":"one"}']]),disk=new Map(options.existing===undefined?[]:[[KEY,options.existing]]),hooks=options.hooks||{},writes=[],removed=[],diagnostics=[];let reads=0,transactions=0;
  if(options.guest)for(const k of ['ps_sync_session','ps_active_ws','ps_cache_owner_v1'])local.delete(k);
  const db={transaction(){transactions++;let aborted=false;const pending=[];const t={objectStore:()=>({get(k){const r={};setImmediate(async()=>{try{if(hooks.atomicRead)await hooks.atomicRead();r.result=disk.get(k);r.onsuccess();if(!aborted){for(const fn of pending)fn();if(t.oncomplete)t.oncomplete();}}catch(e){t.error=e;if(t.onerror)t.onerror();}});return r;},put(v,k){pending.push(()=>{disk.set(k,v);writes.push(k);});},delete(k){pending.push(()=>disk.delete(k));}}),abort(){aborted=true;setImmediate(()=>{if(t.onabort)t.onabort();});}};return t;}};
  const c={Promise,JSON,Error,STORE:'kv',localStorage:{getItem:k=>local.get(k)??null,removeItem(k){removed.push(k);local.delete(k);}},diagnostic:(s,e)=>diagnostics.push({s,name:e.name}),
    async open(){if(hooks.open)await hooks.open();return db;},async idbGet(k){const value=disk.get(k),n=++reads;if(hooks.read)await hooks.read(n);return value;}};
  vm.createContext(c);vm.runInContext(code,c);return {c,local,disk,hooks,writes,removed,diagnostics,transactions:()=>transactions};
}
function switchTeam(h){h.local.set('ps_active_ws','B');h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"B","nonce":"two"}');h.local.set(KEY,B);h.disk.set(KEY,B);}
for(const empty of [undefined,null,'','[]','{}','null'])test('normal initial migration safely replaces verified empty IDB '+String(empty),async()=>{
  const h=harness({existing:empty});await h.c.fixedMigrated;assert.equal(h.disk.get(KEY),A);assert.equal(h.local.has(KEY),false);assert.deepEqual(h.writes,[KEY]);assert.deepEqual(h.removed,[KEY]);
});
test('stable local-only initial migration remains supported and nonempty IDB remains untouched',async()=>{
  const guest=harness({guest:true});await guest.c.fixedMigrated;assert.equal(guest.disk.get(KEY),A);
  const existing=harness({existing:B});await existing.c.fixedMigrated;assert.equal(existing.disk.get(KEY),B);assert.equal(existing.local.get(KEY),A);assert.deepEqual(existing.writes,[]);assert.deepEqual(existing.removed,[]);
});
for(const stage of ['read','open','atomicRead'])test('team changes during '+stage+' cannot enqueue an old put or remove the new local source',async()=>{
  const g=gate(),h=harness({hooks:{[stage]:()=>g.promise}});await tick();switchTeam(h);g.release();await h.c.fixedMigrated;
  assert.equal(h.disk.get(KEY),B);assert.equal(h.local.get(KEY),B);assert.deepEqual(h.writes,[]);assert.deepEqual(h.removed,[]);assert.equal(h.diagnostics[0].name,'StorageOwnerChangedError');
});
for(const field of ['ps_cache_owner_v1','ps_ws_switch_epoch_v1','ps_ws_switch_guard_v1'])test('same-owner ABA or switch invalidates queued initial migration via '+field,async()=>{
  const g=gate(),h=harness({hooks:{atomicRead:()=>g.promise}});await tick();h.local.set(field,field==='ps_cache_owner_v1'?'{"uid":"coach","wid":"A","nonce":"two"}':'two');g.release();await h.c.fixedMigrated;
  assert.equal(h.disk.has(KEY),false);assert.equal(h.local.get(KEY),A);assert.deepEqual(h.writes,[]);assert.deepEqual(h.removed,[]);
});
test('another tab filling IDB after the first empty read wins the atomic preimage check',async()=>{
  const g=gate(),h=harness({hooks:{atomicRead:()=>g.promise}});await tick();h.disk.set(KEY,B);g.release();await h.c.fixedMigrated;
  assert.equal(h.disk.get(KEY),B);assert.equal(h.local.get(KEY),A);assert.deepEqual(h.writes,[]);assert.deepEqual(h.removed,[]);
});
test('later local edits after put verification begins cannot be removed as obsolete copies',async()=>{
  const g=gate(),h=harness({hooks:{read:n=>n===2?g.promise:undefined}});while(!h.writes.length)await tick();h.local.set(KEY,B);g.release();await h.c.fixedMigrated;
  assert.equal(h.disk.get(KEY),A);assert.equal(h.local.get(KEY),B);assert.deepEqual(h.removed,[]);
});
test('the existing three-argument atomic replace API still handles exact values and absence',async()=>{
  const h=harness({existing:B});await h.c.fixedMigrated;assert.equal(await h.c.idbReplaceIfValue(KEY,A,'wrong'),false);assert.equal(await h.c.idbReplaceIfValue(KEY,B,A),true);
  assert.equal(await h.c.idbReplaceIfValue('absent',null,B),true);assert.equal(h.disk.get('absent'),B);assert.equal(await h.c.idbReplaceIfValue('absent',B,null),true);assert.equal(h.disk.has('absent'),false);
});
test('auxiliary baseline migration accepts a stable source and preserves conflicting IDB originals',async()=>{
  const h=harness(),key='ps_sync_base_A_process_coach_v1';await h.c.fixedMigrated;h.local.set(key,A);assert.equal(await h.c.migrateAuxKey(key),true);assert.equal(h.disk.get(key),A);assert.equal(h.local.has(key),false);
  h.local.set(key,B);assert.equal(await h.c.migrateAuxKey(key),false);assert.equal(h.disk.get(key),A);assert.equal(h.local.get(key),B);
});
for(const stage of ['read','atomicRead'])test('auxiliary baseline '+stage+' delay cannot overwrite or remove a new owner source',async()=>{
  const h=harness(),key='ps_sync_base_A_process_coach_v1';await h.c.fixedMigrated;h.writes.length=0;h.removed.length=0;h.local.set(key,A);
  const g=gate();h.hooks[stage]=()=>g.promise;const pending=h.c.migrateAuxKey(key);await tick();switchTeam(h);h.local.set(key,B);h.disk.set(key,B);g.release();assert.equal(await pending,false);
  assert.equal(h.disk.get(key),B);assert.equal(h.local.get(key),B);assert.deepEqual(h.writes,[]);assert.deepEqual(h.removed,[]);
});
test('an equal auxiliary IDB snapshot cannot remove a local baseline edited while its read waits',async()=>{
  const h=harness(),key='ps_sync_base_A_process_coach_v1';await h.c.fixedMigrated;h.removed.length=0;h.local.set(key,A);h.disk.set(key,A);
  const g=gate();h.hooks.read=()=>g.promise;const pending=h.c.migrateAuxKey(key);h.local.set(key,B);g.release();assert.equal(await pending,false);assert.equal(h.local.get(key),B);assert.deepEqual(h.removed,[]);
});
