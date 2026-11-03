'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const harnessPath=path.join(__dirname,'workspace-transition-owner.test.cjs'),harnessSource=fs.readFileSync(harnessPath,'utf8');
const loader={require:createRequire(harnessPath),__dirname,module:{exports:{}},process,console,setTimeout,clearTimeout,setImmediate};
vm.runInNewContext(harnessSource.slice(0,harnessSource.indexOf("\ntest('"))+'\nmodule.exports={harness,deferred,tick};',loader,{filename:harnessPath});
const {harness,deferred,tick}=loader.module.exports;
function getter(h){
  const start=source.indexOf('var workspaceSourceSuspended='),end=source.indexOf('var WS_SWITCH_GUARD=',start);
  assert.ok(start>=0&&end>start);
  h.c.workspaceSwitchGuardRaw=()=>h.c.workspaceSwitchGuardRead()?.token||'';
  vm.runInContext(source.slice(start,end),h.c);
}
test('the actual transition closure proves only its owned source before wiping',async()=>{
  const h=harness(),gate=deferred();getter(h);let calls=0,proof;
  h.hooks.barrier=()=>{
    if(++calls===1){assert.equal(h.c.workspaceSourceSuspension(),null);return Promise.resolve({ready:1});}
    proof=h.c.workspaceSourceSuspension();return gate.promise;
  };
  const work=h.run();await tick();assert.ok(proof);
  assert.equal(proof.uid,'account-A');assert.equal(proof.wid,'team-A');assert.equal(proof.beforeSeal,'owner-A');assert.equal(proof.beforeEpoch,'');
  assert.notEqual(proof.seal,proof.beforeSeal);assert.notEqual(proof.epoch,proof.beforeEpoch);assert.ok(proof.guard);
  assert.equal(h.calls.deleted.length,0);assert.equal(h.calls.reloads,0);
  assert.equal(JSON.stringify(h.c.workspaceSourceSuspension()),JSON.stringify(proof));
  gate.resolve({ready:1});await work;assert.equal(h.c.workspaceSourceSuspension(),null,'target and completed transition cannot borrow the source proof');
});
for(const changed of ['account','source','seal','epoch','guard','auth generation','switch generation'])test('source suspension rejects an external '+changed+' change before any wipe',async()=>{
  const h=harness(),gate=deferred();getter(h);let calls=0;
  h.hooks.barrier=()=>++calls===1?Promise.resolve({ready:1}):gate.promise;
  const work=h.run();await tick();assert.ok(h.c.workspaceSourceSuspension());
  if(changed==='account')h.change();
  if(changed==='source')h.local.set('active','team-B');
  if(changed==='seal')h.local.set('owner','foreign source seal');
  if(changed==='epoch')h.c.workspaceSwitchEpochRaw=()=> 'foreign epoch';
  if(changed==='guard')h.c.workspaceSwitchGuardOwned=()=>false;
  if(changed==='auth generation')h.c.signOutEpoch++;
  if(changed==='switch generation')h.c.switchGen++;
  assert.equal(h.c.workspaceSourceSuspension(),null);assert.equal(h.calls.deleted.length,0);
  gate.resolve({ready:1});await work;assert.equal(h.calls.deleted.length,0);
});
