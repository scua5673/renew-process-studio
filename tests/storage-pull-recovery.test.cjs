'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {write}=require('../studio/sync-mirror.js'),source=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8');
function part(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function fixture(){
 const key='scout_tool_v1',raw='exact-remote-v2',local=new Map([['ps_sync_session','{"uid":"fixture-user"}'],['ps_active_ws','fixture-team'],['ps_cache_owner_v1','fixture-seal'],[key,'exact-old']]),disk=new Map([[key,raw]]),events=[];
 const f={key,raw,local,disk,events,scope:'failed',owner:true,readHook:null,reads:0};
 const node={removed:false,remove(){this.removed=true;}};
 const c=vm.createContext({Promise,Object,String,JSON,Date,console:{warn(){}},
  localStorage:{getItem:k=>local.get(k)??null},migrationOwner:()=> 'fixture-owner',afterMigrate:fn=>Promise.resolve().then(fn),
  idbGet:async k=>{f.reads++;if(f.readHook)await f.readHook(k);return disk.get(k);},
  document:{getElementById:id=>id==='psStorageFull'&&!node.removed?node:null},banner(){},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  dispatchEvent:e=>{events.push(e);if(e.type==='ps-storage-recovered')f.scope='saved';},storage:{}});c.window=c;
 vm.runInContext(part('  var warned=false,','  /* localStorage.setItem을 감싼다')+'\n'+part('  var sharedWrites={},sharedLatest={};','  /* 큰 보조 사본 전용 API.'),c);
 f.c=c;f.node=node;f.warn=(k=key,value=raw)=>c.warnFull(k,value);
 f.options={key,value:raw,before:'exact-old',mirrorBefore:'exact-old',current:()=>f.owner,
  mirror:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)},storage:{},
  recover:(k,value,current)=>c.sharedPullRecovered(k,value,current)};
 return f;
}
test('a guarded exact roster pull retires only its own prior quota receipt',async()=>{
 const f=fixture();f.warn();await write(f.options);
 assert.equal(f.local.get(f.key),f.raw);assert.equal(f.disk.get(f.key),f.raw);
 assert.equal(f.node.removed,true);assert.equal(f.scope,'saved');assert.ok(f.reads>0,'recovery reads the actual IDB body');
 assert.equal(f.events.filter(e=>e.type==='ps-storage-recovered').length,1);
});
test('recovering a roster pull does not clear another failed document',async()=>{
 const f=fixture();f.warn();f.warn('other_document','other-original');await write(f.options);
 assert.equal(f.node.removed,false);assert.equal(f.scope,'failed');assert.equal(f.events.filter(e=>e.type==='ps-storage-recovered').length,0);
});
test('a different newer failed body cannot be acknowledged by an older pulled value',async()=>{
 const f=fixture();f.warn(f.key,'newer-memory-edit');await write(f.options);
 assert.equal(f.node.removed,false);assert.equal(f.scope,'failed');assert.equal(f.disk.get(f.key),f.raw);
});
test('a failed pull with no original body proof remains unconfirmed',async()=>{
 const f=fixture();f.c.warnFull(f.key);await write(f.options);
 assert.equal(f.node.removed,false);assert.equal(f.scope,'failed');
});
for(const changed of ['uid','workspace','seal','epoch','switch','mirror','durable','failure','same-body-failure','author'])test('pull recovery preserves the warning after changed '+changed,async()=>{
 const f=fixture();f.warn();f.readHook=()=>{
  if(changed==='uid')f.local.set('ps_sync_session','{"uid":"other-user"}');
  if(changed==='workspace')f.local.set('ps_active_ws','other-team');
  if(changed==='seal')f.local.set('ps_cache_owner_v1','other-seal');
  if(changed==='epoch')f.local.set('ps_ws_switch_epoch_v1','next-epoch');
  if(changed==='switch')f.local.set('ps_ws_switch_guard_v1','new-switch-guard');
  if(changed==='mirror')f.local.set(f.key,'newer-screen-edit');
  if(changed==='durable')f.disk.set(f.key,'newer-durable-edit');
  if(changed==='failure')f.warn(f.key,'newer-failed-edit');
  if(changed==='same-body-failure')f.warn(f.key,f.raw);
  if(changed==='author')f.owner=false;
 };
 await assert.rejects(write(f.options));assert.equal(f.node.removed,false);assert.equal(f.scope,'failed');
 if(changed==='mirror')assert.equal(f.local.get(f.key),'newer-screen-edit');
 if(changed==='durable')assert.equal(f.disk.get(f.key),'newer-durable-edit');
});
test('an old owner or a missing author guard never retires its warning',async()=>{
 for(const changed of ['owner','guard']){
  const f=fixture();f.warn();f.options.mirror.setItem=(k,v)=>{f.local.set(k,v);if(changed==='owner')f.owner=false;};
  if(changed==='guard')f.options.recover=(k,value)=>f.c.sharedPullRecovered(k,value);
  await write(f.options).catch(()=>{});assert.equal(f.node.removed,false);assert.equal(f.scope,'failed');
 }
});
