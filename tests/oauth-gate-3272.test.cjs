'use strict';
/* 3.272 — 로그인 콜백 문지기(studio/oauth-gate.js): 이 브라우저가 시작하지 않은 `#access_token=…` 는 저장하지 않는다(login CSRF).
   ① 모듈 규칙(시작 표식 · 한 번만 · 10분 · 다른 계정) ② sync.js consumeHash · signIn · linkIdentity 와 admin.html 이 실제로 그 문을 지난다
   ③ 잘라 낸 consumeHash 를 돌려 «표식 없는 콜백은 지금 세션을 건드리지 않는다»를 본다. 합성 값만. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const gateSource=read('studio/oauth-gate.js'),sync=read('studio/sync.js'),admin=read('admin.html'),app=read('studio/app.html'),sw=read('sw.js');
const {mount,KEY,TTL}=require('../studio/oauth-gate.js');

function fakeWindow({session=null,hash='#access_token=evil-at&refresh_token=evil-rt&expires_in=3600',noSession=false}={}){
  const mk=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m};};
  const ls=mk(),ss=mk();if(session)ls.setItem('ps_sync_session',JSON.stringify(session));
  const location={pathname:'/studio/app.html',search:'?join=FIXJOIN1',hash};
  const win={localStorage:ls,location,history:{replaceState(_a,_b,url){location.hash='';location.last=url;}},setTimeout(){},document:null};
  if(!noSession)win.sessionStorage=ss;else Object.defineProperty(win,'sessionStorage',{get(){throw new Error('denied');}});
  return {win,ls,ss,location};
}

test('a callback is accepted once after this browser started the sign-in',()=>{
  const f=fakeWindow(),g=mount(f.win);
  assert.equal(g.take(),false,'no marker — refused');assert.equal(g.last(),'none');
  assert.equal(f.location.hash,'','the token fragment is removed from the address');
  assert.equal(f.location.last,'/studio/app.html?join=FIXJOIN1','the invite query survives the cleanup');
  assert.equal(g.begin('kakao'),true);
  assert.ok(f.ss.getItem(KEY)&&f.ls.getItem(KEY),'marker in both stores');
  assert.equal(f.ss.getItem('ps_oauth_provider'),'kakao','the provider hint is still written for sync.js');
  assert.equal(g.take(),true);assert.equal(g.last(),'ok');
  assert.equal(f.ss.getItem(KEY),null);assert.equal(f.ls.getItem(KEY),null,'consumed');
  assert.equal(g.take(),false,'a second callback needs a new sign-in');
});

test('installed app: the callback window has no sessionStorage marker — the short-lived localStorage one is enough',()=>{
  const f=fakeWindow();mount(f.win).begin('google');f.ss.removeItem(KEY);
  assert.equal(mount(f.win).take(),true);
  const blocked=fakeWindow({noSession:true}),g=mount(blocked.win);
  assert.equal(g.begin('google'),true,'sessionStorage denied — localStorage still records the start');
  assert.equal(g.take(),true);
});

test('stale, future-dated and malformed markers are refused',()=>{
  for(const [mark,why] of [[{t:Date.now()-TTL-1000,from:''},'stale'],[{t:Date.now()+60000,from:''},'stale'],['{"t":"now"}','none'],['not json','none'],[null,'none']]){
    const f=fakeWindow();if(mark)f.ls.setItem(KEY,typeof mark==='string'?mark:JSON.stringify(mark));
    const g=mount(f.win);assert.equal(g.take(),false,JSON.stringify(mark));assert.equal(g.last(),why);assert.equal(f.ls.getItem(KEY),null);
  }
  const fresh=fakeWindow();fresh.ls.setItem(KEY,JSON.stringify({t:Date.now()-TTL+5000,from:''}));assert.equal(mount(fresh.win).take(),true,'just inside ten minutes');
});

test('a different account that signed in meanwhile is never replaced silently',()=>{
  const f=fakeWindow({session:{uid:'coach-A',at:'a',rt:'a'}}),g=mount(f.win);
  g.begin('google');                                         /* A 가 스스로 계정 바꾸기를 눌렀다 */
  assert.equal(g.take(),true,'the same signed-in account started it');
  const h=fakeWindow(),gh=mount(h.win);gh.begin('google');   /* 로그아웃 상태에서 시작 */
  h.ls.setItem('ps_sync_session',JSON.stringify({uid:'coach-B',at:'b',rt:'b'}));   /* 그 사이 다른 창에서 B 가 로그인 */
  assert.equal(gh.take(),false);assert.equal(gh.last(),'other-user');
  const o=fakeWindow({session:{uid:'coach-A',at:'a',rt:'a'}}),go=mount(o.win);go.begin('google');o.ls.removeItem('ps_sync_session');
  assert.equal(go.take(),true,'the session expiring while at the provider does not block the new sign-in');
});

test('the refusal is announced without markup from the address',()=>{
  const made=[];const el=tag=>({tag,style:{},dataset:{},attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.children.push(c);},remove(){}});
  const f=fakeWindow({hash:'#access_token=<img src=x onerror=alert(1)>&refresh_token=r'});
  f.win.document={body:{appendChild:n=>made.push(n)},getElementById:()=>null,createElement:el,addEventListener(){}};
  assert.equal(mount(f.win).take(),false);
  assert.equal(made.length,1);assert.equal(made[0].id,'psOAuthRefused');assert.equal(made[0].attrs.role,'alert');
  assert.match(made[0].children[0].textContent,/이 브라우저에서 시작하지 않은 로그인/);
  assert.ok(!/innerHTML/.test(gateSource),'the notice is built with textContent only');
});

test('sync.js and admin.html pass every stored callback through the gate',()=>{
  const body=sync.slice(sync.indexOf('function consumeHash('),sync.indexOf('function oauthCallbackPending('));
  const gate=body.indexOf('PSOAuthGate.take()'),store=body.indexOf('setSess({at:p.access_token');
  assert.ok(gate>0&&store>gate,'consumeHash asks the gate before it stores the tokens');
  assert.ok(body.indexOf('signOutEpoch++',gate)>gate&&body.slice(0,gate).indexOf('signOutEpoch++')<0,'a refused callback does not invalidate the running session');
  const signIn=sync.slice(sync.indexOf('function signIn('),sync.indexOf('function linkIdentity('));
  assert.match(signIn,/PSOAuthGate\.begin\(provider,w\)[\s\S]*w\.location\.href=BASE\+'\/auth\/v1\/authorize/,'signIn marks the start before leaving');
  const link=sync.slice(sync.indexOf('function linkIdentity('),sync.indexOf('function signOut('));
  assert.match(link,/PSOAuthGate\.begin\([^)]*\)[^;]*;[^\n]*w\.location\.href=j\.url/,'identity linking also returns through the callback');
  const adminHash=admin.slice(admin.indexOf('function consumeHash('),admin.indexOf('function consumeHash(')+900);
  assert.ok(adminHash.indexOf('PSOAuthGate.take()')>0&&adminHash.indexOf('PSOAuthGate.take()')<adminHash.indexOf('setSess('),'admin consumeHash asks the gate first');
  assert.match(admin.slice(admin.indexOf('function signIn(p)'),admin.indexOf('function signOut()')),/PSOAuthGate\.begin\(p\)/,'admin signIn marks the start');
});

test('the gate is loaded before the code that reads the callback, and is shipped',()=>{
  assert.ok(app.indexOf('<script src="oauth-gate.js"></script>')>0&&app.indexOf('<script src="oauth-gate.js"></script>')<app.indexOf('<script src="sync.js'),'app.html loads the gate before sync.js');
  assert.ok(admin.indexOf('src="studio/oauth-gate.js"')>0&&admin.indexOf('src="studio/oauth-gate.js"')<admin.indexOf('function consumeHash('),'admin.html loads the gate before its inline script');
  assert.ok(sw.includes("'/studio/oauth-gate.js'"),'service worker precache');
  assert.ok(read('tests/browser/run-critical.mjs').includes("'oauth-callback-gate'"),'browser test is in a CI suite');
  assert.match(read('studio/storage-keys.js'),/\['ps_oauth_pending_v1','device','ls','session','oauth-gate\.js'\]/);
});

/* 실제 consumeHash(잘라 낸 원문)를 문지기와 함께 돌린다 */
function section(a,b){const i=sync.indexOf(a),j=sync.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return sync.slice(i,j);}
function harness({session=null,gate=true}={}){
  const f=fakeWindow({session});let current=session?{...session}:null;const writes=[],issues=[];
  const win=f.win;win.top=win;if(gate)win.PSOAuthGate=mount(win);
  const c=vm.createContext({Date,String,Number,JSON,Error,decodeURIComponent,window:win,location:f.location,history:win.history,localStorage:f.ls,sessionStorage:f.ss,
    PSOAuthGate:win.PSOAuthGate,BASE:'https://synthetic-auth.invalid',signOutEpoch:0,oauthCallbackIssue:null,
    getSess:()=>current?{...current}:null,setSess(s){current=s?{...s}:null;writes.push(s);},setDataReady(){},setStatus(){},chip(){},renderDataLock(){},dataUnlocked:()=>!!current,syncDiagnostic(){},
    sessionIdentitySnapshot:s=>s?{at:s.at,rt:s.rt,uid:s.uid||''}:null,sessionPendingProvider:()=>'',dataLockError:()=>new Error('lock'),hj:()=>({}),fetch:()=>Promise.resolve({ok:false})});
  vm.runInContext(section('function consumeHash(','function oauthCallbackContinue(')+'\nfunction oauthCallbackSetIssue(m){oauthIssues.push(m);}',Object.assign(c,{oauthIssues:issues}));
  return {c,f,writes,issues,get session(){return current;}};
}
test('consumeHash: an unsolicited token link leaves the signed-in coach exactly as they were',()=>{
  const coach={uid:'coach-A',at:'coach-at',rt:'coach-rt',exp:Date.now()+3600000,email:'a@example.invalid'};
  const h=harness({session:coach});
  assert.equal(h.c.consumeHash(),false);
  assert.deepEqual(h.writes,[],'nothing is stored');assert.deepEqual(h.session,coach);
  assert.equal(h.c.signOutEpoch,0,'running lookups of the real session stay valid');
  assert.equal(h.f.location.hash,'','the attacker tokens are gone from the address');
  const guest=harness();assert.equal(guest.c.consumeHash(),false);assert.equal(guest.session,null,'a logged-out device is not signed in either');
});
test('consumeHash: the callback of a sign-in started here is stored as before',()=>{
  const h=harness();h.f.win.PSOAuthGate.begin('google');
  assert.equal(h.c.consumeHash({deferIdentity:true}),true);
  assert.equal(h.session.at,'evil-at');assert.equal(h.c.signOutEpoch,1);
  const legacy=harness({gate:false});assert.equal(legacy.c.consumeHash({deferIdentity:true}),true,'without the module the app still signs in (never locked out by a missing file)');
});
test('sync.js stays inside its byte budget',()=>{assert.ok(Buffer.byteLength(sync)<=832*1024,'sync.js '+Buffer.byteLength(sync));});
