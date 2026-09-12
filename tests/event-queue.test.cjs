'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the shipped telemetry code; auth, localStorage and HTTP are fake.
// Never opens an app account or sends a request to a backend.
const source = fs.readFileSync(path.join(__dirname, '../studio/sync.js'), 'utf8');
const a = source.indexOf('var PINGKEY='), b = source.indexOf('/* ── 워크스페이스 상태', a);
assert.ok(a >= 0 && b > a);
const code = source.slice(a, b);
const turn = () => new Promise(resolve => setImmediate(resolve));
const copy = value => JSON.parse(JSON.stringify(value));
const ok = {ok:true,status:201};
function harness() {
  let session = {uid:'coach-a',at:'token-a'}, workspace = {id:'team-a'};
  const local = new Map(), requests = [], timers = [], hooks = {};
  const ctx = vm.createContext({
    Promise, Date, Math, JSON,
    window:{PS_BUILD:'test'}, navigator:{onLine:false,userAgent:'test'},
    localStorage:{getItem:k=>local.get(k)||null,setItem(k,v){if(hooks.write)hooks.write(k,v);local.set(k,v);}},
    getSess:()=>session,setSess:s=>{session=s;}, activeWsObj:()=>workspace,activeWs:()=>workspace.id, signOutEpoch:0,
    ensureToken:()=>hooks.token?hooks.token():Promise.resolve(session&&session.at),
    BASE:'https://test.invalid',hj:at=>({Authorization:'Bearer '+at}),syncDiagnostic(){},
    fetch(url,options){
      let resolve,reject;
      const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
      requests.push({url,headers:options.headers,rows:options.body?JSON.parse(options.body):null,resolve,reject});
      return promise;
    },
    setTimeout(fn,ms){timers.push({fn,ms});},
  });
  vm.runInContext(code,ctx);
  return {ctx,local,requests,timers,hooks,
    track(name,opts){ctx.eventTrack(name,opts);},
    queue:()=>copy(ctx.eventQueue()),
    switchUser(uid,at){session=uid?{uid,at}:null;},
    switchWorkspace(id){workspace={id};},
    async start(){ctx.navigator.onLine=true;const pending=ctx.flushEvents();await turn();return {pending};},
  };
}

test('ACK removes A but preserves B appended while A is in flight', async()=>{
  const h=harness();h.track('event_a');const {pending}=await h.start();
  h.track('event_b');assert.deepEqual(h.requests[0].rows.map(x=>x.event_name),['event_a']);
  h.requests[0].resolve(ok);await pending;
  assert.deepEqual(h.queue().map(x=>x.row.event_name),['event_b']);
  assert.equal(h.timers.length,1);
  h.timers.shift().fn();await turn();
  assert.deepEqual(h.requests[1].rows.map(x=>x.event_name),['event_b']);
  h.requests[1].resolve(ok);await turn();assert.equal(h.queue().length,0);
});

test('ACK only removes the 20 submitted entries when a queue already has 27', async()=>{
  const h=harness();for(let i=0;i<27;i++)h.track('event_'+i);
  const {pending}=await h.start();assert.equal(h.requests[0].rows.length,20);
  h.track('last');h.requests[0].resolve(ok);await pending;
  assert.deepEqual(h.queue().map(x=>x.row.event_name),[...Array.from({length:7},(_,i)=>'event_'+(i+20)),'last']);
});

test('queue cap trimming during an HTTP request does not make ACK delete newer entries', async()=>{
  const h=harness();h.track('old');const {pending}=await h.start();
  for(let i=0;i<55;i++)h.track('new_'+i);
  const expected=h.queue();assert.equal(expected.length,50);assert.equal(expected[0].row.event_name,'new_5');
  h.requests[0].resolve(ok);await pending;assert.deepEqual(h.queue(),expected);
});

test('identical event rows retain distinct local IDs and ACK only the submitted instance', async()=>{
  const h=harness();h.track('repeated');const {pending}=await h.start();
  h.track('repeated');let q=h.queue();q[1].row=copy(q[0].row);h.ctx.setEventQueue(q);
  assert.notEqual(q[0].id,q[1].id);h.requests[0].resolve(ok);await pending;
  assert.deepEqual(h.queue(),[q[1]]);
});

for(const failure of ['http','network','no-token','token-throw'])test('preserves queued events after '+failure,async()=>{
  const h=harness();h.track('first');
  if(failure==='no-token')h.hooks.token=()=>Promise.resolve(null);
  if(failure==='token-throw')h.hooks.token=()=>{throw new Error('auth unavailable');};
  const {pending}=await h.start();h.track('later');
  if(failure==='http')h.requests[0].resolve({ok:false,status:503});
  if(failure==='network')h.requests[0].reject(new Error('offline'));
  await pending;await turn();assert.deepEqual(h.queue().map(x=>x.row.event_name),['first','later']);
  assert.equal(h.ctx.eventFlushing,false);assert.equal(h.timers.length,0);
  delete h.hooks.token;const retry=h.ctx.flushEvents();await turn();
  h.requests.at(-1).resolve(ok);await retry;assert.deepEqual(h.queue(),[]);
});

test('logged-out and offline clients never request a token or send events',async()=>{
  const h=harness();h.track('queued');let tokenCalls=0;h.hooks.token=()=>{tokenCalls++;return Promise.resolve('token-a');};
  h.ctx.flushEvents();h.switchUser(null);h.ctx.navigator.onLine=true;h.ctx.flushEvents();h.track('logged_out');await turn();
  assert.equal(tokenCalls,0);assert.equal(h.requests.length,0);assert.equal(h.queue().length,1);
});

for(const change of ['new-user','logout','epoch','wrong-token'])test('auth wait aborts safely after '+change,async()=>{
  const h=harness();h.track('old_owner');let resolve;
  h.hooks.token=()=>new Promise(r=>{resolve=r;});const {pending}=await h.start();
  if(change==='new-user')h.switchUser('player-b','token-b');
  if(change==='logout')h.switchUser(null);
  if(change==='epoch')h.ctx.signOutEpoch++;
  resolve(change==='wrong-token'?'different-token':'token-a');await pending;
  assert.equal(h.requests.length,0);assert.equal(h.queue()[0].uid,'coach-a');assert.equal(h.ctx.eventFlushing,false);
});

test('a new account sends only its own rows and the original account can resume later',async()=>{
  const h=harness();h.track('a');h.switchUser('player-b','token-b');h.switchWorkspace('team-b');h.track('b');
  const {pending}=await h.start();assert.equal(h.requests[0].headers.Authorization,'Bearer token-b');
  assert.deepEqual(h.requests[0].rows.map(x=>[x.event_name,x.workspace_id]),[['b','team-b']]);
  h.requests[0].resolve(ok);await pending;assert.equal(h.queue()[0].uid,'coach-a');assert.equal(h.timers.length,0);
  h.switchUser('coach-a','token-a');const retry=h.ctx.flushEvents();await turn();
  assert.equal(h.requests[1].rows[0].event_name,'a');h.requests[1].resolve(ok);await retry;assert.equal(h.queue().length,0);
});

test('old account response never removes new account events recorded during its request',async()=>{
  const h=harness();h.track('a');const {pending}=await h.start();
  h.switchUser('player-b','token-b');h.ctx.signOutEpoch++;h.track('b');h.requests[0].resolve(ok);await pending;
  assert.deepEqual(h.queue().map(x=>[x.uid,x.row.event_name]),[['player-b','b']]);
});

test('new account first event resumes after the old account pending token is rejected',async()=>{
  const h=harness();h.track('a');let resolve;h.hooks.token=()=>new Promise(r=>{resolve=r;});const {pending}=await h.start();
  h.switchUser('player-b','token-b');h.track('b');resolve('token-a');await pending;
  assert.equal(h.requests.length,0);assert.equal(h.timers.length,1);
  delete h.hooks.token;h.timers.shift().fn();await turn();
  assert.deepEqual(h.requests[0].rows.map(x=>x.event_name),['b']);assert.equal(h.requests[0].headers.Authorization,'Bearer token-b');
  h.requests[0].resolve(ok);await turn();assert.deepEqual(h.queue().map(x=>x.row.event_name),['a']);
});

test('workspace changes preserve event-time workspace for the same account',async()=>{
  const h=harness();h.track('a');h.switchWorkspace('team-b');h.track('b');const {pending}=await h.start();
  assert.deepEqual(h.requests[0].rows.map(x=>x.workspace_id),['team-a','team-b']);h.requests[0].resolve(ok);await pending;
});

test('simultaneous flush calls issue one HTTP request',async()=>{
  const h=harness();h.track('a');const {pending}=await h.start();h.ctx.flushEvents();h.ctx.flushEvents();await turn();
  assert.equal(h.requests.length,1);h.requests[0].resolve(ok);await pending;
});

test('local ownership and ACK IDs are excluded from unchanged server event schema',async()=>{
  const h=harness();h.track('FIRST result!',{feature:'start',meta:{stage:'goal',count:1,done:true,diary:'private words',nested:{text:'private'},email:'private@test.invalid'}});
  const {pending}=await h.start();const row=h.requests[0].rows[0];
  assert.deepEqual(Object.keys(row).sort(),['app_version','created_at','device','error_code','event_name','feature','meta','status','workspace_id'].sort());
  assert.deepEqual(row.meta,{stage:'goal',count:1,done:true});assert.equal(row.event_name,'firstresult');
  assert.ok(!JSON.stringify(row).includes('private'));h.requests[0].resolve(ok);await pending;
});

test('unowned legacy queue is not attributed to the next logged-in account',async()=>{
  const h=harness();const legacy='[{"event_name":"legacy","workspace_id":"old_team"}]';h.local.set('ps_event_queue_v1',legacy);
  const {pending}=await h.start();await pending;assert.equal(h.requests.length,0);assert.equal(h.local.get('ps_event_queue_v1'),legacy);
});

for(const raw of ['{bad','{}','null','[{"id":"x","row":{"event_name":"unowned"}}]'])test('invalid queue cannot be uploaded: '+raw,async()=>{
  const h=harness();h.local.set('ps_event_queue_v2',raw);const {pending}=await h.start();await pending;
  assert.equal(h.requests.length,0);h.track('new');await turn();assert.equal(h.requests[0].rows[0].event_name,'new');h.requests[0].resolve(ok);await turn();
});

test('save/error throttles apply per account and still suppress same-account repeats',()=>{
  const h=harness();for(let i=0;i<2;i++){h.track('content_saved');h.track('sync_failed',{status:'error',error_code:'network'});}
  assert.equal(h.queue().length,2);h.switchUser('player-b','token-b');h.track('content_saved');h.track('sync_failed',{status:'error',error_code:'network'});
  assert.equal(h.queue().length,4);h.switchUser('coach-a','token-a');h.track('content_saved');assert.equal(h.queue().length,4);
});

test('action gap and daily cap do not hide a different account first success',()=>{
  const h=harness();h.ctx.usagePing=()=>{};h.ctx.actTrack('a_diary','idp');h.ctx.actTrack('a_diary','idp');assert.equal(h.queue().length,1);
  h.local.set('ps_act_cap:coach-a',JSON.stringify({d:new Date().toISOString().slice(0,10),n:300}));
  h.ctx.actTrack('a_goal','idp');assert.equal(h.queue().length,1);
  h.switchUser('player-b','token-b');h.ctx.actTrack('a_diary','idp');assert.equal(h.queue().length,2);
  h.switchUser('coach-a','token-a');h.ctx.actTrack('a_other','idp');assert.equal(h.queue().length,2);
});

test('daily usage pings are scoped to each account on a shared device',async()=>{
  const h=harness();h.ctx.usagePing('token-a','idp');h.requests[0].resolve(ok);await turn();
  h.ctx.usagePing('token-a','idp');assert.equal(h.requests.length,1);
  h.switchUser('player-b','token-b');h.ctx.usagePing('token-b','idp');
  assert.equal(h.requests.length,2);assert.equal(h.requests[1].rows[0].user_id,'player-b');
  h.requests[1].resolve(ok);await turn();h.switchUser('coach-a','token-a');h.ctx.usagePing('token-a','idp');assert.equal(h.requests.length,2);
});

test('late usage ACK writes only its original account daily marker',async()=>{
  const h=harness();h.ctx.usagePing('token-a','board');h.switchUser('player-b','token-b');h.requests[0].resolve(ok);await turn();
  assert.ok(h.local.has('ps_usage_pings:coach-a'));assert.ok(!h.local.has('ps_usage_pings:player-b'));
  h.ctx.usagePing('token-b','board');assert.equal(h.requests.length,2);h.requests[1].resolve(ok);await turn();
});

test('usage token wait cannot mix an old token with a new account UID',async()=>{
  const h=harness();let resolve;h.hooks.token=()=>new Promise(r=>{resolve=r;});h.ctx.usagePing(null,'idp');
  h.switchUser('player-b','token-b');resolve('token-a');await turn();assert.equal(h.requests.length,0);
});

test('late usage user lookup cannot overwrite a new login or post its data',async()=>{
  const h=harness();h.switchUser('','oauth-token');
  // An OAuth session exists before its UID has arrived.
  h.ctx.getSess=()=>session;let session={uid:'',at:'oauth-token'};
  h.ctx.setSess=s=>{session=s;};h.ctx.usagePing('oauth-token','app');assert.ok(h.requests[0].url.endsWith('/auth/v1/user'));
  session={uid:'player-b',at:'token-b'};h.requests[0].resolve({ok:true,json:async()=>({id:'coach-a',email:'old@test.invalid'})});await turn();
  assert.equal(session.uid,'player-b');assert.equal(h.requests.length,1);
});

test('current OAuth user lookup fills the UID and sends the original workspace ping',async()=>{
  const h=harness();let session={uid:'',at:'oauth-token'};h.ctx.getSess=()=>session;h.ctx.setSess=s=>{session=s;};
  h.ctx.usagePing('oauth-token','app');h.switchWorkspace('team-b');
  h.requests[0].resolve({ok:true,json:async()=>({id:'coach-a',email:'test@test.invalid'})});await turn();
  assert.equal(session.uid,'coach-a');assert.equal(h.requests[1].rows[0].workspace_id,'team-a');h.requests[1].resolve(ok);await turn();
});

test('safe metadata preserves allowed short codes and limits long messages without content fields',()=>{
  const h=harness();const meta=copy(h.ctx.safeEventMeta({stage:'first_success',source:'onboarding',msg:'x'.repeat(150),reason:'r'.repeat(90),body:'private'}));
  assert.equal(meta.stage,'first_success');assert.equal(meta.source,'onboarding');assert.equal(meta.msg.length,120);assert.equal(meta.reason.length,80);assert.ok(!Object.hasOwn(meta,'body'));
});

test('failed local queue append does not cause unqueued event to be acknowledged',async()=>{
  const h=harness();h.track('saved');h.hooks.write=()=>{throw new Error('storage quota');};h.track('not_persisted');
  delete h.hooks.write;const {pending}=await h.start();assert.deepEqual(h.requests[0].rows.map(x=>x.event_name),['saved']);
  h.requests[0].resolve(ok);await pending;assert.equal(h.queue().length,0);
});
