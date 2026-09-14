'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../studio/support.js');
const diagnostics=require('../studio/support-diagnostics.js');
const ID='11111111-1111-4111-8111-111111111111';
const REPORT='22222222-2222-4222-8222-222222222222';
const ready={uid:'synthetic-coach',token:'SYNTHETIC_ACCESS_TOKEN',ready:true,fence:'owner-one'};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
function defer(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness(fetcher){
  let context={...ready};const requests=[],timers=new Set();
  const window={AbortController,setTimeout(fn){timers.add(fn);return fn;},clearTimeout(fn){timers.delete(fn);}};
  const client=api.createClient({window,context:()=>context,config:()=>({url:'https://support-fixture.invalid',anonKey:'SYNTHETIC_PUBLIC_KEY'}),fetch:(url,options)=>{requests.push({url,...options,body:JSON.parse(options.body)});return fetcher?fetcher(url,options):Promise.resolve(response({reports:[]}));}});
  return {client,requests,timers,setContext(value){context=value;}};
}

test('a locked or missing identity sends no support request',async()=>{
  for(const context of [null,{...ready,ready:false},{...ready,uid:''},{...ready,token:''}]){
    const h=harness();h.setContext(context);await assert.rejects(h.client.list(),{code:'support_auth'});assert.equal(h.requests.length,0);
  }
});

test('owner change before the request microtask prevents even a first request',async()=>{
  const h=harness(),pending=h.client.list();h.setContext({...ready,uid:'another-coach',fence:'owner-two'});
  await assert.rejects(pending,{code:'support_owner_changed'});assert.equal(h.requests.length,0);assert.equal(h.timers.size,0);
});

for(const phase of ['fetch','response body'])test(`owner change during delayed ${phase} rejects the old account result`,async()=>{
  const gate=defer(),h=harness(()=>phase==='fetch'?gate.promise:Promise.resolve({ok:true,status:200,json:()=>gate.promise}));
  const pending=h.client.list();await new Promise(resolve=>setImmediate(resolve));
  h.setContext({...ready,fence:'new-team'});gate.resolve(phase==='fetch'?response({reports:[{id:REPORT,title:'old account'}]}):{reports:[{id:REPORT,title:'old account'}]});
  await assert.rejects(pending,{code:'support_owner_changed'});assert.equal(h.timers.size,0);
});

test('invalidate aborts in-flight work and excludes a late successful response',async()=>{
  const gate=defer(),h=harness(()=>gate.promise),pending=h.client.get(REPORT);await new Promise(resolve=>setImmediate(resolve));
  h.client.invalidate();assert.equal(h.requests[0].signal.aborted,true);gate.resolve(response({report:{id:REPORT},replies:[]}));
  await assert.rejects(pending,{code:'support_owner_changed'});assert.equal(h.timers.size,0);
});

test('retry submits the same client-generated identity and body after an uncertain response',async()=>{
  let count=0;const h=harness(()=>++count===1?Promise.reject(Error('connection lost after commit')):Promise.resolve(response({id:ID})));
  const attempt={p_id:ID,p_title:'synthetic title',p_body:'synthetic body',p_diagnostics:{logs:[]}};
  await assert.rejects(h.client.create(attempt),{code:'support_network'});
  assert.deepEqual(await h.client.create(attempt),{id:ID});assert.deepEqual(h.requests[0].body,h.requests[1].body);
  assert.equal(h.requests[1].headers.Authorization,'Bearer SYNTHETIC_ACCESS_TOKEN');
  assert.equal(JSON.stringify(h.requests[1].body).includes('SYNTHETIC_ACCESS_TOKEN'),false);assert.equal(h.timers.size,0);
});

for(const [status,body,code] of [[400,{},'support_invalid'],[422,{},'support_invalid'],[401,{},'support_auth'],[403,{},'support_auth'],[404,{},'support_missing'],[409,{},'support_conflict'],[404,{code:'PGRST202'},'support_unavailable'],[500,{code:'42883'},'support_unavailable'],[500,{},'support_failed']]){
  test(`RPC ${status}/${body.code||'generic'} keeps an explicit failure state`,async()=>{
    const h=harness(()=>Promise.resolve(response(body,status)));await assert.rejects(h.client.list(),{code});assert.equal(h.timers.size,0);
  });
}

test('invalid report identifiers and missing service configuration never send requests',async()=>{
  const h=harness();await assert.rejects(h.client.get('another user?token=secret'),{code:'support_invalid'});assert.equal(h.requests.length,0);
  const client=api.createClient({window:{},context:()=>ready,config:()=>null,fetch:()=>assert.fail('No request for unavailable configuration')});
  await assert.rejects(client.list(),{code:'support_unavailable'});
});

test('expired authentication is not considered usable and sends no support request',async()=>{
  const payload=Buffer.from(JSON.stringify({sub:'synthetic-coach',exp:1})).toString('base64url');
  const window={PSSync:{session:()=>({uid:'synthetic-coach',at:'header.'+payload+'.signature'}),dataUnlocked:()=>true},localStorage:{getItem:()=>null},atob:value=>Buffer.from(value,'base64').toString('binary')};
  const context=api.readContext(window);assert.equal(context.ready,false);assert.equal(context.token,'');
  const client=api.createClient({window,config:()=>({url:'https://support-fixture.invalid',anonKey:'SYNTHETIC_PUBLIC_KEY'}),fetch:()=>assert.fail('Expired authentication cannot send a request')});
  await assert.rejects(client.list(),{code:'support_auth'});
});

test('copy includes typed report, replies and safe diagnostic fields without session or raw error content',()=>{
  const report={title:'로그인 버튼 확인',body:'구글 버튼을 눌렀습니다.',replies:[{author_role:'admin',created_at:'2026-09-15',body:'수정 내용을 확인해 주세요.'},{author_role:'user',body:'다시 확인했습니다.'}]};
  const detail={capturedAt:'2026-09-15T01:00:00Z',environment:{appVersion:'2.814',browser:'Chrome 140',os:'macOS',online:true,path:'/studio/app.html',token:'PRIVATE_DIAGNOSTIC_TOKEN'},logs:[{kind:'sync',name:'StorageError',code:'sync_storage',stage:'personal-channel',source:'/studio/sync.js',line:100,column:3,message:'PRIVATE_RAW_ERROR',stack:'PRIVATE_STACK',token:'PRIVATE_LOG_TOKEN'}],session:{at:'PRIVATE_ACCESS_TOKEN'}};
  const text=api.copyText(report,detail,diagnostics.format);
  for(const included of [report.title,report.body,...report.replies.map(r=>r.body),'sync_storage','/studio/sync.js:100:3','2.814'])assert.ok(text.includes(included),included);
  for(const secret of ['PRIVATE_DIAGNOSTIC_TOKEN','PRIVATE_RAW_ERROR','PRIVATE_STACK','PRIVATE_LOG_TOKEN','PRIVATE_ACCESS_TOKEN'])assert.ok(!text.includes(secret),secret);
});
