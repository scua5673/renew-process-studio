'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
const start=html.indexOf('var adminBoundUid='),end=html.indexOf('function openAdminUser(uid){',start);
assert.ok(start>0&&end>start);
const code=html.slice(start,end);
const bootStart=html.indexOf('(function boot(){',html.indexOf('/* ===== 부팅 ===== */'));
const boot=html.slice(bootStart,html.indexOf('function showDenied(uid){',bootStart));
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function session(uid=A,expired=false){return{uid,at:'synthetic-at-'+uid,rt:'synthetic-rt-'+uid,exp:expired?1:Date.now()+3600000,email:'synthetic@example.invalid'};}
function response(data,status=200){return{ok:status>=200&&status<300,status,json:async()=>data,text:async()=>JSON.stringify(data)};}
function harness(initial=session()){
 const local=new Map(initial?[['session',JSON.stringify(initial)]]:[]),listeners={},nodes={},requests=[],hooks={};let closeCount=0,reloads=0;
 function node(tag='div'){return{tag,children:[],className:'',textContent:'',classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);}},setAttribute(){},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];this.cleared=true;}};}
 for(const id of ['app','modalRoot','gateLogin','gateDenied','meChip'])nodes[id]=node();nodes.app.children.push('synthetic private administrator data');
 const doc={body:node('body'),visibilityState:'visible',getElementById:id=>nodes[id]||null,createElement:node,addEventListener(n,f){listeners[n]=f;}};
 const detail={close(){closeCount++;}};
 const win={PSAdminUserDetail:detail,addEventListener(n,f){listeners[n]=f;}};
 const c=vm.createContext({Promise,Error,Date,JSON,Object,String,Array,Number,document:doc,window:win,PSAdminUserDetail:detail,
   localStorage:{getItem:k=>local.get(k)||null,setItem(k,v){local.set(k,String(v));},removeItem(k){local.delete(k);}},
   SKEY:'session',CFG:{anonKey:'synthetic-public-key'},BASE:'https://synthetic.invalid',location:{reload(){reloads++;}},
   fetch(url,options){requests.push({url,options});return hooks.fetch?hooks.fetch(url,options):Promise.resolve(response([]));},
   show(id){nodes[id].shown=true;},showDenied(uid){nodes.gateDenied.shown=true;nodes.gateDenied.uid=uid;},
   $(id){return nodes[id];},reloadAll(){c.loaded=(c.loaded||0)+1;},WS:['private'],USERS:['private'],ALL_LIB:['private'],HOME:{private:true},WHOLOG:['private'],IDP_CACHE:{private:true},ERR:{},USE:{}});
 vm.runInContext(code,c);
 return{c,nodes,local,listeners,requests,hooks,doc,bind(uid=A){c.adminBoundUid=uid;},get session(){const raw=local.get('session');return raw?JSON.parse(raw):null;},get closed(){return closeCount;},get reloads(){return reloads;},change(s){if(s)local.set('session',JSON.stringify(s));else local.delete('session');listeners.storage({key:'session',newValue:JSON.stringify(s)});},boot(){vm.runInContext(boot,c);}};
}
test('parallel expired-token callers share one refresh and keep one consistent session',async()=>{
 const h=harness(session(A,true)),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;
 const runs=[h.c.ensureToken(),h.c.ensureToken(),h.c.ensureToken(),h.c.ensureToken()];await tick();assert.equal(h.requests.length,1);
 g.resolve(response({access_token:'new-synthetic-at',refresh_token:'new-synthetic-rt',expires_in:3600,user:{id:A}}));
 assert.deepEqual(await Promise.all(runs),Array(4).fill('new-synthetic-at'));assert.equal(h.session.uid,A);assert.equal(h.c.adminRefreshFlight,null);
});
for(const mode of ['network','server','invalid-json'])test('temporary refresh failure retains the shared login: '+mode,async()=>{
 const initial=session(A,true),h=harness(initial);h.bind();h.hooks.fetch=()=>mode==='network'?Promise.reject(Error('network')):mode==='server'?Promise.resolve(response({message:'busy'},503)):Promise.resolve({ok:true,status:200,json:async()=>{throw Error('json');}});
 await assert.rejects(h.c.ensureToken());assert.deepEqual(h.session,initial);assert.equal(h.c.adminSessionLocked,false);assert.equal(h.c.adminRefreshFlight,null);
});
test('definitive invalid refresh clears only its own unchanged session and locks private DOM',async()=>{
 const h=harness(session(A,true));h.bind();h.hooks.fetch=async()=>response({code:'refresh_token_not_found'},400);
 await assert.rejects(h.c.ensureToken());assert.equal(h.session,null);assert.equal(h.c.adminSessionLocked,true);assert.equal(h.nodes.app.cleared,true);assert.equal(h.closed,1);
});
test('late failed refresh cannot clear a newer account login',async()=>{
 const h=harness(session(A,true)),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;const run=h.c.ensureToken();await tick();h.change(session(B));g.resolve(response({code:'refresh_token_not_found'},400));await assert.rejects(run);assert.equal(h.session.uid,B);
});
test('late successful refresh cannot restore the previous account',async()=>{
 const h=harness(session(A,true)),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;const run=h.c.ensureToken();await tick();h.change(session(B));g.resolve(response({access_token:'new-a',refresh_token:'new-a-rt',user:{id:A}}));await assert.rejects(run);assert.equal(h.session.uid,B);
});
test('a token rotated in another tab is retained when an old refresh fails',async()=>{
 const h=harness(session(A,true)),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;const run=h.c.ensureToken();await tick();const newer={...session(A),at:'rotated-at',rt:'rotated-rt'};h.change(newer);g.resolve(response({code:'refresh_token_already_used'},400));await assert.rejects(run);assert.deepEqual(h.session,newer);assert.equal(h.c.adminSessionLocked,false);
});
test('account switch closes drawer and clears already-rendered administrative information',()=>{
 const h=harness();h.bind();h.change(session(B));assert.equal(h.c.adminSessionLocked,true);assert.equal(h.nodes.app.cleared,true);assert.equal(h.nodes.modalRoot.cleared,true);assert.equal(h.nodes.app.classList.values.has('hide'),true);assert.equal(h.closed,1);assert.equal(h.c.USERS.length,0);assert.equal(Object.keys(h.c.IDP_CACHE).length,0);assert.equal(h.doc.body.children.length,1);
});
test('an A to B to A switch remains locked and rejects an old request completion',async()=>{
 const h=harness(),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;const run=h.c.adminRequest('rpc/private',{method:'POST'});await tick();h.change(session(B));h.change(session(A));g.resolve(response({private:'old result'}));await assert.rejects(run,/session changed/);assert.equal(h.c.adminSessionLocked,true);
});
test('old administrator draft cannot be submitted under the new account',async()=>{
 const h=harness();h.bind();h.local.set('session',JSON.stringify(session(B)));await assert.rejects(h.c.rpc('ps_admin_followup_save',{note:'synthetic old draft'}));assert.equal(h.requests.length,0);assert.equal(h.c.adminSessionLocked,true);
});
test('legacy RPC responses also reject an account boundary',async()=>{
 const h=harness(),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;const run=h.c.rpc('ps_admin_users_v2');await tick();h.change(session(B));g.resolve(response([{user_id:A}]));await assert.rejects(run,/session changed/);
});
test('ordinary requests require bootstrap verification and cannot override the token',async()=>{
 const h=harness();await assert.rejects(h.c.adminRequest('ps_events'));assert.equal(h.requests.length,0);h.bind();await h.c.adminRequest('ps_events',{headers:{Authorization:'unrelated'}});assert.equal(h.requests[0].options.headers.Authorization,'Bearer '+h.session.at);
});
test('bootstrap rejects a whoami subject different from the stored session',async()=>{
 const h=harness();h.hooks.fetch=async()=>response([{uid:B,is_admin:true}]);h.boot();await tick();assert.equal(h.c.loaded,undefined);assert.equal(h.c.adminBoundUid,null);assert.equal(h.c.adminSessionLocked,true);
});
test('bootstrap binds a verified administrator and an OAuth session with no uid',async()=>{
 const h=harness({...session(),uid:''});h.hooks.fetch=async()=>response([{uid:A,is_admin:true,email:'synthetic@example.invalid'}]);h.boot();await tick();assert.equal(h.c.loaded,1);assert.equal(h.c.adminBoundUid,A);assert.equal(h.session.uid,A);assert.equal(h.nodes.app.shown,true);
});
test('a same-UID token refresh preserves a bound administrator request',async()=>{
 const h=harness(),g=deferred();h.bind();h.hooks.fetch=()=>g.promise;const run=h.c.adminRequest('ps_events');await tick();h.change({...session(),at:'rotated-at',rt:'rotated-rt'});g.resolve(response([]));await run;assert.equal(h.c.adminSessionLocked,false);
});
test('visibility resume locks a session switched while the admin page was suspended',()=>{
 const h=harness();h.bind();h.local.set('session',JSON.stringify(session(B)));h.listeners.visibilitychange();assert.equal(h.c.adminSessionLocked,true);
});
