'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function fn(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,name);return source.slice(a,b);}
const names=['rpcContext','rpcCurrent','rpc','createTeam','joinTeam','createInvite','createRoleInvite','regenRoleInvite','membersOf','leaveTeam','renameWorkspace','removeMember','permsCacheSet','permsRaw','permsPrime','scoutWriteAllowed','scheduleWriteAllowed'];
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function response(v,ok=true){return {ok,status:ok?200:500,text:async()=>JSON.stringify(v),json:async()=>v};}
function harness(){
 let session={uid:'A',at:'token-A',email:'A@example.invalid'},wid='team-A',epoch='epoch-1',guard='',unlocked=true;
 const local=new Map([['ps_cache_owner_v1','seal-A']]),hooks={},requests=[],effects=[],rows=[{id:'team-A',kind:'team',role:'owner',name:'Original'}];
 const c={Promise,Error,JSON,Date,String,Object,Array,encodeURIComponent,signOutEpoch:0,OWNERKEY:'ps_cache_owner_v1',BASE:'https://synthetic.invalid',
  getSess:()=>session,activeWs:()=>wid,activeWsObj:()=>({id:wid,kind:'team',role:'member'}),dataUnlocked:()=>unlocked,isTeamWs:()=>true,
  workspaceSwitchEpochRaw:()=>epoch,workspaceSwitchGuardRaw:()=>guard,dataLockError:()=>Object.assign(new Error('stale owner'),{psDataLocked:true}),
  localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
  storage:{get:()=>hooks.get?hooks.get():Promise.resolve(null)},PSStorage:{sharedReady:()=>hooks.ready?hooks.ready():Promise.resolve()},
  ensureToken:()=>hooks.token?hooks.token():Promise.resolve(session?.at),hj:at=>({Authorization:'Bearer '+at}),syncDiagnostic(){},
  fetch(url,opts){requests.push({url,opts});return hooks.fetch?hooks.fetch(url,opts):Promise.resolve(response(url.includes('/rpc/')?'new-team':[{id:'team-A'}]));},
  pushMyName:async w=>{effects.push(['name',w,session.uid]);if(hooks.name)return hooks.name();},
  loadWorkspaces:async()=>{effects.push(['load',session.uid]);if(hooks.load)return hooks.load();},
  switchWorkspace:async w=>{effects.push(['switch',w,session.uid]);},wsList:()=>rows,setWsList:r=>effects.push(['list',JSON.parse(JSON.stringify(r))]),renderUI:()=>effects.push(['render'])};
 c.window=c;c.syncFetch=(phase,url,opts)=>c.fetch(url,opts);vm.createContext(c);vm.runInContext('var __permsRaw=null,__permsOwner=null,__permsGeneration=0,__permsPrimeSequence=0;\n'+names.map(fn).join('\n'),c);
 return {c,hooks,requests,effects,local,rows,change(mode){if(mode==='account')session={uid:'B',at:'token-B',email:'B@example.invalid'};else if(mode==='logout')session=null;else if(mode==='team')wid='team-B';else if(mode==='epoch')epoch='epoch-2';else if(mode==='seal')local.set('ps_cache_owner_v1','seal-new');else if(mode==='guard')guard='switch-started';else if(mode==='A-B-A')c.signOutEpoch++;else if(mode==='token')session={...session,at:'token-A-refreshed'};else if(mode==='locked')unlocked=false;}};
}
const locked=e=>e.psDataLocked===true;
for(const name of ['createTeam','joinTeam','leaveTeam','createRoleInvite','regenRoleInvite'])test(name+' cannot send an earlier account intent after the shared-write barrier',async()=>{
 const h=harness(),g=deferred();h.hooks.ready=()=>g.promise;const pending=h.c[name]('A-intent','player');await tick();h.change('account');g.resolve();await assert.rejects(pending,locked);assert.equal(h.requests.length,0);assert.deepEqual(h.effects,[]);
});
for(const change of ['account','team','epoch','seal','guard','logout','A-B-A'])test('RPC rejects a late response after '+change,async()=>{
 const h=harness(),g=deferred();h.hooks.fetch=()=>g.promise;const pending=h.c.rpc('synthetic',{});await tick();h.change(change);g.resolve(response('A-value'));await assert.rejects(pending,locked);assert.equal(h.requests.length,1);
});
test('RPC keeps same-account token rotation and a normal response working',async()=>{
 const h=harness(),g=deferred();h.hooks.ready=()=>g.promise;const pending=h.c.rpc('synthetic',{value:3});h.change('token');g.resolve();assert.equal(await pending,'new-team');assert.equal(h.requests[0].opts.headers.Authorization,'Bearer token-A-refreshed');
});
test('a caller-supplied workspace guard still cannot cross accounts',async()=>{
 const h=harness(),g=deferred();h.hooks.token=()=>g.promise;const pending=h.c.rpc('synthetic',{},()=>{});await tick();h.change('account');g.resolve('token-B');await assert.rejects(pending,locked);assert.equal(h.requests.length,0);
});
for(const name of ['createInvite','membersOf'])test(name+' fallback cannot retry under another account',async()=>{
 const h=harness(),g=deferred();h.hooks.fetch=()=>g.promise;const pending=h.c[name]('team-A');await tick();h.change('account');g.resolve(response('old failure',false));await assert.rejects(pending,locked);assert.equal(h.requests.length,1);
});
test('same-owner legacy RPC fallback remains available',async()=>{
 const h=harness();h.hooks.fetch=()=>Promise.resolve(h.requests.length===1?response(null,false):response('legacy-value'));assert.equal(await h.c.createInvite('team-A'),'legacy-value');assert.equal(h.requests.length,2);
});
for(const name of ['createTeam','joinTeam']){
 test(name+' drops old response without name/bootstrap/switch side effects',async()=>{
  const h=harness(),g=deferred();h.hooks.fetch=()=>g.promise;const pending=h.c[name]('A-intent');await tick();h.change('account');g.resolve(response('A-created-team'));await assert.rejects(pending,locked);assert.deepEqual(h.effects,[]);
 });
 test(name+' stops after account changes during name or bootstrap follow-up',async()=>{
  for(const stage of ['name','load']){const h=harness(),g=deferred();h.hooks[stage]=()=>g.promise;const pending=h.c[name]('A-intent');await tick();h.change('account');g.resolve();await assert.rejects(pending,locked);assert.equal(h.effects.some(x=>x[0]==='switch'),false);}
 });
 test(name+' preserves the successful same-owner flow',async()=>{
  const h=harness();await h.c[name]('A-intent');assert.deepEqual(h.effects,[['name','new-team','A'],['load','A'],['switch','new-team','A']]);
 });
}
for(const name of ['renameWorkspace','removeMember']){
 test(name+' does not use a new account token or deliver a stale mutation response',async()=>{
  for(const stage of ['token','fetch']){const h=harness(),g=deferred();h.hooks[stage]=()=>g.promise;const pending=h.c[name]('team-A','new-value');await tick();h.change('account');g.resolve(stage==='token'?'token-B':response([{id:'team-A'}]));await assert.rejects(pending,locked);assert.equal(h.requests.length,stage==='token'?0:1);assert.deepEqual(h.effects,[]);}
 });
 test(name+' preserves the successful same-owner mutation',async()=>{const h=harness();await h.c[name]('team-A','new-value');assert.equal(h.requests.length,1);if(name==='renameWorkspace')assert.equal(h.rows[0].name,'new-value');});
}
for(const mode of ['account','team','epoch','seal','locked'])test('late permissions prime cannot populate a different/locked '+mode+' cache',async()=>{
 const h=harness(),g=deferred();h.hooks.get=()=>g.promise;const pending=h.c.permsPrime();h.change(mode);g.resolve({value:JSON.stringify({defaultRole:'admin',marker:'old A'})});await pending;assert.equal(h.local.has('cs_perms_v1'),false);assert.equal(h.c.permsRaw(),null);assert.equal(h.c.scoutWriteAllowed(),false);
});
test('permissions memory fallback is bound to the account, team and cache seal',()=>{
 for(const mode of ['account','team','epoch','seal','A-B-A']){const h=harness();h.local.set('cs_perms_v1',JSON.stringify({defaultRole:'admin'}));assert.equal(h.c.scoutWriteAllowed(),true);h.local.delete('cs_perms_v1');h.change(mode);assert.equal(h.c.permsRaw(),null);assert.equal(h.c.scoutWriteAllowed(),false);assert.equal(h.c.scheduleWriteAllowed(),false);}
});
test('same-owner permission prime and mirror-unavailable fallback still grant the actual role',async()=>{
 const h=harness(),raw=JSON.stringify({defaultRole:'admin'});h.hooks.get=async()=>({value:raw});await h.c.permsPrime();assert.equal(h.local.get('cs_perms_v1'),raw);h.local.delete('cs_perms_v1');assert.equal(h.c.permsRaw(),raw);assert.equal(h.c.scoutWriteAllowed(),true);h.change('token');assert.equal(h.c.scheduleWriteAllowed(),true);
});
test('late same-owner prime cannot restore an older role after the latest mirror becomes unavailable',async()=>{
 const h=harness(),g=deferred(),old=JSON.stringify({defaultRole:'admin'}),latest=JSON.stringify({defaultRole:'player'});h.hooks.get=()=>g.promise;const pending=h.c.permsPrime();h.local.set('cs_perms_v1',latest);assert.equal(h.c.scoutWriteAllowed(),false);h.local.delete('cs_perms_v1');g.resolve({value:old});await pending;assert.equal(h.c.permsRaw(),latest);assert.equal(h.local.has('cs_perms_v1'),false);assert.equal(h.c.scoutWriteAllowed(),false);
});
test('late prime does not replace a newer mirror even when it has not yet been read',async()=>{
 const h=harness(),g=deferred(),latest=JSON.stringify({defaultRole:'player'});h.hooks.get=()=>g.promise;const pending=h.c.permsPrime();h.local.set('cs_perms_v1',latest);g.resolve({value:JSON.stringify({defaultRole:'admin'})});await pending;assert.equal(h.c.permsRaw(),latest);assert.equal(h.c.scheduleWriteAllowed(),false);
});
test('overlapping same-owner primes keep the first confirmed newer permission result',async()=>{
 const h=harness(),first=deferred(),second=deferred();let n=0;h.hooks.get=()=>++n===1?first.promise:second.promise;const old=h.c.permsPrime(),newer=h.c.permsPrime();const latest=JSON.stringify({defaultRole:'player'});second.resolve({value:latest});await newer;first.resolve({value:JSON.stringify({defaultRole:'admin'})});await old;assert.equal(h.c.permsRaw(),latest);assert.equal(h.c.scoutWriteAllowed(),false);
});
test('overlapping permission primes also preserve the newest read when old response arrives first',async()=>{
 const h=harness(),first=deferred(),second=deferred();let n=0;h.hooks.get=()=>++n===1?first.promise:second.promise;const old=h.c.permsPrime(),newer=h.c.permsPrime();first.resolve({value:JSON.stringify({defaultRole:'admin'})});await old;assert.equal(h.local.has('cs_perms_v1'),false);const latest=JSON.stringify({defaultRole:'player'});second.resolve({value:latest});await newer;assert.equal(h.c.permsRaw(),latest);assert.equal(h.c.scoutWriteAllowed(),false);
});
