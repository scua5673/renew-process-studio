'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',S='cccccccc-cccc-4ccc-8ccc-cccccccccccc',W='11111111-1111-4111-8111-111111111111',W2='22222222-2222-4222-8222-222222222222';
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const code=section('function syncObservationContext(','function syncObservationRoundDone(')+section('function reportSharedView(','\nwindow.PSSync={');
const tick=()=>new Promise(r=>setImmediate(r));
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
  const state={uid:A,wid:W,seal:'generation-a',token:'token-a',unlocked:true,guard:false,switchSeal:'',switchEpoch:'one',visible:true};
  const requests=[],timers=new Map(),hooks={},writes=[];let timerId=0,tokenCalls=0;
  const payload={p_workspace_id:W,p_subject_user_id:S,p_view_kind:'player_matches'};
  const c=vm.createContext({Promise,JSON,Error,String,AbortController,window:{PSStorage:{sharedReady(){throw Error('must not enter ordinary write barrier');}}},
    localStorage:{getItem(){if(hooks.read)hooks.read();return state.seal;},setItem(...args){writes.push(args);throw Error('application write forbidden');}},
    OWNERKEY:'owner',signOutEpoch:0,getSess:()=>state.uid?{uid:state.uid,at:state.token}:null,
    activeWs:()=>state.wid,cacheOwner:()=>({uid:state.uid,wid:state.wid}),dataUnlocked:()=>state.unlocked,
    workspaceSwitchGuardRead:()=>state.guard,workspaceSwitchGuardRaw:()=>state.switchSeal,workspaceSwitchEpochRaw:()=>state.switchEpoch,
    ensureToken(){tokenCalls++;return hooks.token?hooks.token():Promise.resolve(state.token);},hj:at=>({Authorization:'Bearer '+at}),BASE:'https://synthetic.invalid',
    setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    fetch(url,options){requests.push({url,options,body:JSON.parse(options.body)});return hooks.fetch?hooks.fetch():Promise.resolve({ok:true,status:200,text:async()=>JSON.stringify({user_id:A,workspace_id:W,subject_user_id:S,view_kind:'player_matches'})});}});
  vm.runInContext(code,c);
  return {c,state,requests,timers,hooks,writes,payload,get tokenCalls(){return tokenCalls;},report(body=payload,callback=()=>state.visible){return c.reportSharedView(body,callback);}};
}
test('actual adapter posts only the RPC allowlist and authenticated header without normal storage writes',async()=>{
  const h=harness();assert.equal(await h.report({...h.payload,raw:'private text',match_id:'private-match',version:55,actor:A,token:'do not send'}),true);
  assert.equal(h.requests.length,1);assert.deepEqual(h.requests[0].body,h.payload);assert.equal(h.requests[0].url,'https://synthetic.invalid/rest/v1/rpc/ps_shared_view_put');
  assert.equal(h.requests[0].options.headers.Authorization,'Bearer token-a');assert.equal(h.timers.size,0);assert.deepEqual(h.writes,[]);
});
for(const [name,body,callback] of [
  ['no payload',null,()=>true],['different workspace',{p_workspace_id:W2,p_subject_user_id:S,p_view_kind:'player_matches'},()=>true],
  ['invalid subject',{p_workspace_id:W,p_subject_user_id:'not-a-uuid',p_view_kind:'player_matches'},()=>true],
  ['own subject',{p_workspace_id:W,p_subject_user_id:A,p_view_kind:'player_matches'},()=>true],
  ['different kind',{p_workspace_id:W,p_subject_user_id:S,p_view_kind:'diary'},()=>true],
  ['no visibility callback',{p_workspace_id:W,p_subject_user_id:S,p_view_kind:'player_matches'},null]
])test(name+' is rejected before requesting authentication',async()=>{
  const h=harness();assert.equal(await h.report(body,callback),false);assert.equal(h.requests.length,0);assert.equal(h.tokenCalls,0);
});
for(const [name,change] of [
  ['uid',h=>h.state.uid=B],['workspace',h=>h.state.wid=W2],['owner seal',h=>h.state.seal='generation-b'],
  ['owner ABA epoch',h=>h.c.signOutEpoch++],['workspace switch seal',h=>h.state.switchSeal='new'],['workspace switch epoch',h=>h.state.switchEpoch='two'],
  ['workspace switching',h=>h.state.guard=true],['locked',h=>h.state.unlocked=false],['logout',h=>h.state.uid=''],
  ['token rotated',h=>h.state.token='token-b'],['view hidden',h=>h.state.visible=false]
])test(name+' changing during token wait prevents transmission',async()=>{
  const h=harness(),g=gate();h.hooks.token=()=>g.promise;const run=h.report();await tick();change(h);g.resolve('token-a');
  assert.equal(await run,false);assert.equal(h.requests.length,0);assert.equal(h.timers.size,0);assert.deepEqual(h.writes,[]);
});
for(const value of [false,null,undefined,1,'true'])test('visibility must return literal true: '+String(value),async()=>{
  const h=harness();assert.equal(await h.report(h.payload,()=>value),false);assert.equal(h.requests.length,0);assert.equal(h.tokenCalls,0);
});
test('visibility exception is isolated and no request is issued',async()=>{
  const h=harness();assert.equal(await h.report(h.payload,()=>{throw Error('detached iframe');}),false);assert.equal(h.requests.length,0);
});
test('visibility changing in final pre-POST callback prevents transmission and clears timeout',async()=>{
  const h=harness();let calls=0;assert.equal(await h.report(h.payload,()=>++calls<3),false);assert.equal(calls,3);assert.equal(h.requests.length,0);assert.equal(h.timers.size,0);
});
for(const [name,change] of [['uid',h=>h.state.uid=B],['wid',h=>h.state.wid=W2],['seal',h=>h.state.seal='changed'],['visibility',h=>h.state.visible=false]])test(name+' changing while HTTP is pending cannot acknowledge the old view',async()=>{
  const h=harness(),g=gate();h.hooks.fetch=()=>g.promise;const run=h.report();await tick();assert.equal(h.requests.length,1);change(h);
  g.resolve({ok:true,status:200,text:async()=> '{}'});assert.equal(await run,false);assert.equal(h.timers.size,0);assert.equal(h.requests[0].body.p_workspace_id,W);
});
for(const failure of ['http403','http500','missingRPC','network','body-read','token-throw','no-token','callback-after-post'])test(failure+' stays non-blocking and reports no success',async()=>{
  const h=harness();
  if(failure==='token-throw')h.hooks.token=()=>{throw Error('auth error');};
  else if(failure==='no-token')h.hooks.token=()=>Promise.resolve(null);
  else if(failure==='network')h.hooks.fetch=()=>Promise.reject(Error('network'));
  else if(failure==='body-read')h.hooks.fetch=async()=>({ok:true,text:async()=>{throw Error('read error');}});
  else if(failure==='callback-after-post')h.hooks.fetch=async()=>({ok:true,text:async()=>{h.state.visible=false;return '{}';}});
  else h.hooks.fetch=async()=>({ok:false,status:failure==='http403'?403:failure==='http500'?500:404,text:async()=>JSON.stringify({code:'PGRST202',message:'private backend explanation'})});
  assert.equal(await h.report(),false);assert.equal(h.timers.size,0);assert.deepEqual(h.writes,[]);
});
test('caller payload mutation during auth wait cannot switch subject or add content',async()=>{
  const h=harness(),g=gate(),body={...h.payload};h.hooks.token=()=>g.promise;const run=h.report(body);await tick();
  body.p_subject_user_id=B;body.p_workspace_id=W2;body.content='private';g.resolve('token-a');assert.equal(await run,true);
  assert.deepEqual(h.requests[0].body,h.payload);
});
test('owner storage exception produces false rather than healthy-looking success',async()=>{
  const h=harness();h.hooks.read=()=>{throw Error('storage denied');};assert.equal(await h.report(),false);assert.equal(h.requests.length,0);
});
