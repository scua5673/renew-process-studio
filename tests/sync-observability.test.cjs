'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const O=require('../studio/sync-observability.js');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',W='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const tick=()=>new Promise(r=>setImmediate(r)),copy=x=>JSON.parse(JSON.stringify(x));
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
  let time=1800000000000,serial=0,uuidSerial=0,identity={uid:A,wid:W,seal:'owner-a',epoch:0,switchSeal:'',switchEpoch:'1'};
  const local=new Map(),timers=new Map(),listeners={},requests=[],hooks={};
  const document={visibilityState:'visible',addEventListener(n,f){listeners[n]=f;},removeEventListener(n){delete listeners[n];}};
  const window={addEventListener(n,f){listeners[n]=f;},removeEventListener(n){delete listeners[n];}};
  const storage={getItem(k){if(hooks.read)hooks.read(k);return local.has(k)?local.get(k):null;},setItem(k,v){if(hooks.write)return hooks.write(k,v);local.set(k,String(v));}};
  let snapshot={pending_team:2,pending_personal:1,held:0,skipped:null,deferred:null,conflicts:0,oldest_pending_at:time-5000,last_round_ack_at:null,error_code:null,device_class:'tablet',app_version:'2.792',online:true,busy:false};
  const c=O.createClient({window,document,storage,crypto:{randomUUID:()=>++uuidSerial===1?A:B},now:()=>time,
    setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    context:()=>identity,snapshot:()=>hooks.snapshot?hooks.snapshot():snapshot,
    send(ctx,body){requests.push({ctx,body});return hooks.send?hooks.send(ctx,body):Promise.resolve(true);}});
  return {c,local,timers,listeners,requests,hooks,document,storage,get snapshot(){return snapshot;},get identity(){return identity;},
    context(c){identity=c;},time(t){time=t;},async fire(ms){const entry=[...timers].find(([,x])=>x.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();await tick();}};
}
test('payload allows only counts, fixed labels and timestamps, never original content',()=>{
  const x=O.fields({pending_team:-1,pending_personal:'2',held:3,skipped:Infinity,deferred:0,conflicts:4,
    oldest_pending_at:'invalid',last_round_ack_at:1800000000000,error_code:'token:secret',device_class:'iPad owned by user',app_version:'secret token',online:true,busy:false,raw:'private text',key:'cs_idp_v1_'+A,hash:'original hash'});
  assert.equal(x.pending_team,null);assert.equal(x.pending_personal,null);assert.equal(x.skipped,null);assert.equal(x.error_code,'sync_unexpected');
  assert.equal(x.device_class,'unknown');assert.equal(x.app_version,'unknown');assert.equal(x.last_round_ack_at,'2027-01-15T08:00:00.000Z');
  assert.ok(!('raw' in x)&&!('key' in x)&&!('hash' in x));assert.equal(O.fields({}),null);
  assert.equal(O.fields({online:true,busy:false,pending_team:100001}).pending_team,null);
});
test('persistent per-user device, per-workspace monotonic sequence, client uid excluded from RPC',async()=>{
  const h=harness();h.c.start();assert.equal(await h.c.flush(),true);
  const first=h.requests[0].body;assert.equal(first.p_workspace_id,W);assert.equal(first.p_report_seq,1800000000000000);assert.ok(!('uid' in first));
  h.time(1700000000000);await h.c.flush();assert.equal(h.requests[1].body.p_device_id,first.p_device_id);assert.equal(h.requests[1].body.p_report_seq,first.p_report_seq+1);
  h.identity.wid=P;await h.c.flush();assert.equal(h.requests[2].body.p_device_id,first.p_device_id);assert.equal(h.requests[2].body.p_workspace_id,P);
  h.identity.uid=B;await h.c.flush();assert.notEqual(h.requests[3].body.p_device_id,first.p_device_id);h.c.stop();
});
for(const mode of ['read-fails','write-fails','write-dropped','malformed-sequence','overflow-sequence'])test('unavailable durable identity/sequence prevents a report: '+mode,async()=>{
  const h=harness();h.local.set('ps_sync_report_device_v1:'+A,A);
  if(mode==='read-fails')h.hooks.read=()=>{throw Error('blocked');};
  if(mode==='write-fails')h.hooks.write=()=>{throw Error('quota');};
  if(mode==='write-dropped')h.hooks.write=()=>{};
  if(mode==='malformed-sequence')h.local.set('ps_sync_report_seq_v1:'+A+':'+A+':'+W,'bad');
  if(mode==='overflow-sequence')h.local.set('ps_sync_report_seq_v1:'+A+':'+A+':'+W,String(Number.MAX_SAFE_INTEGER));
  h.c.start();assert.equal(await h.c.flush(),false);assert.equal(h.requests.length,0);h.c.stop();
});
for(const change of ['uid','wid','seal','epoch','switchSeal','switchEpoch'])test('async snapshot cannot be relabelled after '+change+' changes',async()=>{
  const h=harness(),g=gate();h.hooks.snapshot=()=>g.promise;h.c.start();const run=h.c.flush();await tick();
  h.identity[change]=change==='uid'?B:change==='wid'?P:change==='epoch'?1:'changed';g.resolve(h.snapshot);
  assert.equal(await run,false);assert.equal(h.requests.length,0);assert.equal(h.local.size,0);h.c.stop();
});
test('in-flight owner switch discards completion and next report uses new owner only',async()=>{
  const h=harness(),g=gate();h.hooks.send=()=>g.promise;h.c.start();const first=h.c.flush();await tick();
  h.identity.uid=B;h.identity.seal='owner-b';h.c.poke();g.resolve(true);assert.equal(await first,false);
  delete h.hooks.send;await h.c.flush();assert.equal(h.requests.length,2);assert.equal(h.requests[0].ctx.uid,A);assert.equal(h.requests[1].ctx.uid,B);h.c.stop();
});
test('failed send retries only the latest snapshot and does not throw into callers',async()=>{
  const h=harness();h.hooks.send=()=>Promise.reject(Error('offline'));h.c.start();assert.equal(await h.c.flush(),false);
  h.snapshot.pending_team=7;delete h.hooks.send;await h.fire(30000);assert.equal(h.requests.length,2);assert.equal(h.requests[1].body.p_fields.pending_team,7);
  assert.ok(h.requests[1].body.p_report_seq>h.requests[0].body.p_report_seq);h.c.stop();
});
test('missing RPC disables reports for this page, not application state',async()=>{
  const h=harness();h.hooks.send=()=>Promise.reject({code:'PGRST202'});h.c.start();await h.c.flush();assert.equal(h.c.disabled(),true);
  delete h.hooks.send;h.c.poke();await h.c.flush();await h.fire(120000);assert.equal(h.requests.length,1);assert.equal(h.snapshot.pending_team,2);h.c.stop();
});
test('hidden/offline/locked views do not send; visible heartbeat samples current state',async()=>{
  const h=harness();h.c.start();h.document.visibilityState='hidden';assert.equal(await h.c.flush(),false);
  await h.fire(120000);assert.equal(h.requests.length,0);
  h.document.visibilityState='visible';h.snapshot.online=false;await h.c.flush();assert.equal(h.requests.length,0);
  h.snapshot.online=true;const ctx=copy(h.identity);h.context(null);await h.c.flush();assert.equal(h.requests.length,0);
  h.context(ctx);await h.fire(120000);await h.fire(1200);assert.equal(h.requests.length,1);h.c.stop();assert.equal(h.timers.size,0);
});
test('report storage events cannot make tabs ping-pong; application state changes debounce',async()=>{
  const h=harness();h.c.start();await h.c.flush();const initial=h.timers.size;
  h.listeners.storage({key:'ps_sync_report_seq_v1:'+A});h.listeners.storage({key:'ps_event_queue_v2'});assert.equal(h.timers.size,initial);
  for(let i=0;i<100;i++)h.listeners.storage({key:'ps_sync_pending_summary_v1'});
  assert.equal([...h.timers.values()].filter(x=>x.ms===1200).length,1);await h.fire(1200);assert.equal(h.requests.length,2);h.c.stop();
});

// Execute the actual sync adapter with synthetic auth, stores and HTTP.
const src=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const start=src.indexOf('/* Device observations are separate'),end=src.indexOf('\nwindow.PSSync={',start);assert.ok(start>0&&end>start);
function adapter(){
  const local=new Map(),requests=[],hooks={},listeners=new Map();let uid=A,wid=W,seal='owner-a',locked=false;
  const c=vm.createContext({Promise,Date,Number,JSON,Error,AbortController,setTimeout:()=>1,clearTimeout(){},window:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n);}},
    localStorage:{getItem(k){if(hooks.read)hooks.read(k);return k==='ps_cache_owner_v1'?seal:local.get(k)||null;}},
    navigator:{onLine:true},OWNERKEY:'ps_cache_owner_v1',HOLD_LIST:'holds',PERSONAL_REVIEW:'personal-review',PERSONAL:{note:1},
    signOutEpoch:0,busy:false,personalIssue:null,pendingSummary:{updatedAt:1,by:{[A+'|'+W]:{count:3,oldest:1000},[A+'|'+P]:{count:2,oldest:2000}}},
    getSess:()=>({uid,at:'token-'+uid}),activeWs:()=>wid,cacheOwner:()=>({uid,wid}),dataUnlocked:()=>!locked,
    workspaceSwitchGuardRead:()=>false,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>1,
    personalWid:()=>P,outboxScope:(u,w)=>u+'|'+w,eventDevice:()=> 'tablet',appVer:()=> '2.792',
    ensureToken:()=>hooks.token?hooks.token():Promise.resolve('token-'+uid),hj:at=>({Authorization:'Bearer '+at}),BASE:'https://synthetic.invalid',
    fetch(url,options){requests.push({url,options});return hooks.fetch?hooks.fetch():Promise.resolve({ok:true,text:async()=> 'true'});}});
  vm.runInContext(src.slice(start,end),c);
  return {c,local,requests,hooks,listeners,change(values){if(values.uid)uid=values.uid;if(values.wid)wid=values.wid;if(values.seal)seal=values.seal;if(values.locked!==undefined)locked=values.locked;},
    context:()=>c.syncObservationContext(),snapshot:()=>copy(c.syncObservationSnapshot(c.syncObservationContext()))};
}
test('adapter keeps team/personal counts separate and unconfirmed round values unknown',()=>{
  const h=adapter(),s=h.snapshot();assert.equal(s.pending_team,3);assert.equal(s.pending_personal,2);assert.equal(s.skipped,null);assert.equal(s.deferred,null);assert.equal(s.last_round_ack_at,null);
  h.c.pendingSummary={total:0,by:{}};assert.equal(h.snapshot().pending_team,null);
  h.c.pendingSummary={updatedAt:1,by:[]};assert.equal(h.snapshot().pending_team,null);
  h.change({wid:P});assert.equal(h.snapshot().pending_team,0);assert.equal(h.snapshot().pending_personal,null);
});
test('legacy unowned holds stay unknown, other users and workspaces are excluded',()=>{
  const h=adapter();h.local.set('holds',JSON.stringify([{k:'legacy'},{kind:'conflict',uid:A,wid:W},{kind:'conflict',uid:B,wid:W},{kind:'conflict',uid:A,wid:P}]));
  h.local.set('personal-review',JSON.stringify([{uid:A,wid:P,k:'note'},{uid:B,wid:P,k:'note'}]));
  assert.equal(h.snapshot().held,null);assert.equal(h.snapshot().conflicts,2);
  h.local.set('holds','broken');assert.equal(h.snapshot(),null);
});
test('round ACK can coexist with pending/held/skipped/personal error, never means all saved',()=>{
  const h=adapter(),owner=h.context();h.local.set('holds',JSON.stringify([{kind:'conflict',uid:A,wid:W}]));h.c.syncObservationRoundDone(owner,{held:['h'],skipped:['big'],deferred:['wait'],personalError:{code:'sync_network'}});
  const s=h.snapshot();assert.ok(s.last_round_ack_at>0);assert.equal(s.pending_team,3);assert.equal(s.held,1);assert.equal(s.skipped,1);assert.equal(s.error_code,'sync_network');
  h.local.set('holds','[]');assert.equal(h.snapshot().held,0);
  h.c.syncObservationRoundDone(owner,{error:'sync_timeout'});assert.equal(h.snapshot().last_round_ack_at,s.last_round_ack_at);assert.equal(h.snapshot().skipped,null);
  h.change({seal:'changed'});assert.equal(h.snapshot().last_round_ack_at,null);h.c.syncObservationRoundDone(owner,{held:[],skipped:[],deferred:[]});assert.equal(h.snapshot().last_round_ack_at,null);
});
test('storage failure or locked ownership yields no snapshot, not healthy zeros',()=>{
  const h=adapter();h.hooks.read=()=>{throw Error('storage');};assert.equal(h.snapshot(),null);delete h.hooks.read;
  h.change({locked:true});assert.equal(h.context(),null);assert.equal(h.snapshot(),null);
});
for(const change of ['uid','wid','seal','locked'])test('guarded transport rejects ownership change during token wait: '+change,async()=>{
  const h=adapter(),g=gate(),owner=h.context();h.hooks.token=()=>g.promise;const run=h.c.syncObservationSend(owner,{});await tick();
  h.change({[change]:change==='uid'?B:change==='wid'?P:change==='locked'?true:'changed'});g.resolve('token-'+A);
  await assert.rejects(run,/context changed/);assert.equal(h.requests.length,0);
});
test('transport validates owner after HTTP and detects missing RPC without reporting server text',async()=>{
  const h=adapter(),owner=h.context(),g=gate();h.hooks.fetch=()=>g.promise;const run=h.c.syncObservationSend(owner,{p_workspace_id:W});await tick();
  assert.match(h.requests[0].url,/rpc\/ps_sync_report_put$/);h.change({wid:P});g.resolve({ok:true,text:async()=> 'true'});await assert.rejects(run,/context changed/);
  h.change({wid:W});h.hooks.fetch=async()=>({ok:false,status:404,text:async()=>JSON.stringify({code:'PGRST202',message:'private backend detail'})});
  await assert.rejects(h.c.syncObservationSend(h.context(),{}),e=>e.code==='PGRST202'&&!e.message.includes('private'));
});

test('page exit cancels a pending report before token refresh can dispatch it',async()=>{
  const h=adapter(),g=gate();h.hooks.token=()=>g.promise;
  const pending=h.c.syncObservationSend(h.context(),{});await tick();
  h.listeners.get('pagehide')();g.resolve('token-'+A);
  await assert.rejects(pending,/context changed/);assert.equal(h.requests.length,0);assert.equal(h.listeners.size,0);
});
test('page exit aborts an in-flight report and removes its listener',async()=>{
  const h=adapter(),g=gate();h.hooks.fetch=()=>g.promise;
  const pending=h.c.syncObservationSend(h.context(),{});await tick();
  const signal=h.requests[0].options.signal;assert.equal(signal.aborted,false);
  h.listeners.get('pagehide')();assert.equal(signal.aborted,true);
  g.reject(Error('request aborted'));await assert.rejects(pending,/request aborted/);assert.equal(h.listeners.size,0);
  delete h.hooks.fetch;assert.equal(await h.c.syncObservationSend(h.context(),{}),true);assert.equal(h.listeners.size,0);
});

test('a departing page stops reports even before visibility changes, and resumes on return',async()=>{
  const h=harness();h.c.start();h.listeners.pagehide();
  assert.equal(h.document.visibilityState,'visible');assert.equal(await h.c.flush(),false);assert.equal(h.requests.length,0);
  h.listeners.pageshow();assert.equal(await h.c.flush(),true);assert.equal(h.requests.length,1);
  h.c.stop();assert.equal(h.listeners.pagehide,undefined);assert.equal(h.listeners.pageshow,undefined);
});
