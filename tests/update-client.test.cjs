const test=require('node:test'),assert=require('node:assert/strict');
const {create,newer,reason}=require('../studio/update-client.js');
function fixture(){
  const events={},docEvents={},swEvents={},regEvents={},records=[],timers=[];
  let active='4.001',published='4.001',registerFailure=false,updateFailure=false,fetchFailure=false,checks=0,registrations=0,reloads=0,uid='coach';
  const worker={postMessage(d,ports){ports[0].postMessage({release:'process-'+active});}};
  const reg={addEventListener:(n,f)=>regEvents[n]=f,update:async()=>{checks++;if(updateFailure)throw Error('offline');}};
  class Channel {constructor(){this.port1={close(){}};this.port2={close(){},postMessage:d=>this.port1.onmessage({data:d})};}}
  const w={PS_BUILD:'4.001',document:{hidden:false,addEventListener:(n,f)=>docEvents[n]=f},MessageChannel:Channel,AbortController,
    navigator:{onLine:true,serviceWorker:{controller:worker,addEventListener:(n,f)=>swEvents[n]=f,register:async(url,opts)=>{registrations++;assert.equal(opts.updateViaCache,'none');if(registerFailure)throw Error('offline');return reg;}}},
    PSSync:{session:()=>uid?{uid}:null,event:(name,opts)=>records.push({name,...opts})},
    setTimeout,clearTimeout,setInterval:f=>timers.push(f),addEventListener:(n,f)=>events[n]=f,
    fetch:async()=>{if(fetchFailure)throw Error('network');return {ok:true,json:async()=>({release:'process-'+published})};},psAutoReloadWhenSafe:()=>reloads++};
  const api=create(w);
  return {api,w,events,docEvents,swEvents,records,regEvents,reg,worker,set(o){if(o.active)active=o.active;if(o.published)published=o.published;if('registerFailure'in o)registerFailure=o.registerFailure;if('updateFailure'in o)updateFailure=o.updateFailure;if('fetchFailure'in o)fetchFailure=o.fetchFailure;if('uid'in o)uid=o.uid;},get checks(){return checks;},get registrations(){return registrations;},get reloads(){return reloads;}};
}
test('installed current version does not reload; published alone never permits reload',async()=>{
 const f=fixture();await f.api.start();assert.equal(f.reloads,0);f.set({published:'4.003'});await f.api.check(true);assert.equal(f.reloads,0);assert.ok(f.records.some(e=>e.name==='update_available'));
 f.set({active:'4.003'});await f.api.reconcile();assert.equal(f.reloads,1);
});
test('resume reconciles an already active newer worker even if controllerchange was missed',async()=>{
 const f=fixture();await f.api.start();f.set({active:'4.002'});f.events.pageshow();await new Promise(r=>setImmediate(r));assert.equal(f.reloads,1);
});
test('registration and connection failures are diagnosed, deduplicated and retried',async()=>{
 const f=fixture();f.set({registerFailure:true,fetchFailure:true});await f.api.start();assert.equal(f.reloads,0);assert.deepEqual(f.records.map(r=>r.error_code),['worker_registration','manifest_check']);
 await f.api.check(true);assert.equal(f.records.length,2);f.set({registerFailure:false,fetchFailure:false,active:'4.002'});await f.api.check(true);assert.equal(f.registrations,3);assert.equal(f.reloads,1);
 f.set({updateFailure:true});await f.api.check(true);assert.ok(f.records.some(r=>r.error_code==='worker_check'));
});
test('only the controlling worker can send an update hint; guests are not attributed to later login',async()=>{
 const f=fixture();await f.api.start();f.set({active:'4.002',uid:''});f.swEvents.message({source:{},data:{type:'ps-update-available'}});assert.equal(f.reloads,0);await f.api.reconcile();assert.equal(f.records.length,0);
 f.set({uid:'coach-b'});f.api.record('deferred','flush_fail:fBoard:board_guest_pending');assert.equal(f.records.length,1);assert.equal(f.records[0].meta.reason,'flush_fail:fBoard:board_guest_pending');
});
test('versions compare numeric components and user guidance identifies the blocked screen',()=>{
 assert.equal(newer('4.010','4.009'),true);assert.equal(newer('4.001','4.001'),false);assert.equal(newer('bad','4.001'),false);
 assert.match(reason('flush_fail:fScout:store_ready'),/팀 운영·경기/);assert.match(reason('flush_timeout:fBoard'),/작전판/);
});
test('a newer published release never impersonates the release already downloaded for saving',async()=>{
 const f=fixture();f.set({active:'4.002',published:'4.003'});await f.api.start();f.api.record('deferred','flush_fail:fBoard:disk');
 assert.equal(f.records.find(r=>r.name==='update_available').meta.to,'4.003');assert.equal(f.records.find(r=>r.name==='update_deferred').meta.to,'4.002');assert.equal(f.api.context().to,'4.002');
});
