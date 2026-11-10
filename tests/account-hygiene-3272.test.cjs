'use strict';
/* 3.272 — 같이 쓰는 기기. ① 다른 계정이 로그인할 때 IndexedDB 에 남던 세 묶음(ps_blob: · psimg_ · 자동 저장 기준본)을 치운다(studio/account-hygiene.js)
   — 못 올린 원문(archive)과 «서버 확인 없이 나간 계정»의 기준본은 지우지 않는다.
   ② 로그아웃한 기기에서 팀 화면을 주소로 바로 열어도 그리지 않는다(studio/data-lock-guard.js). 브라우저: logout-direct-pages · account-team-switch. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const hygiene=require('../studio/account-hygiene.js'),guard=require('../studio/data-lock-guard.js');
const sync=read('studio/sync.js'),sw=read('sw.js'),app=read('studio/app.html');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',W='team-1';
const J=(uid,kind,rest)=>'ps_autosave_journal_v1:'+encodeURIComponent(uid)+':'+encodeURIComponent(W)+':'+kind+':'+rest;
function device({local={},idb={},failDel=null}={}){
  const l=new Map(Object.entries(local)),d=new Map(Object.entries(idb)),deleted=[];
  const ls={get length(){return l.size;},key:i=>[...l.keys()][i]??null,getItem:k=>l.has(k)?l.get(k):null,setItem:(k,v)=>l.set(k,String(v)),removeItem:k=>l.delete(k)};
  const storage={keys:async()=>[...d.keys()],get:async k=>d.has(k)?{key:k,value:d.get(k)}:null,del:async k=>{if(failDel&&failDel(k))return false;deleted.push(k);d.delete(k);return true;}};
  return {l,d,deleted,api:hygiene.create({local:()=>ls,storage:()=>storage})};
}
const seed=()=>({
  'ps_blob:abc123':'data:image/png;base64,AAAA','ps_blob:def456':'data:image/png;base64,BBBB',
  psimg_orphan1:'data:image/jpeg;base64,/9j/1',psimg_draft9:'data:image/jpeg;base64,/9j/2',psimg_guest7:'data:image/jpeg;base64,/9j/3',psimg_journal5:'data:image/jpeg;base64,/9j/4',
  [J(A,'base','scout_tool_v1')]:'{"kind":"base","raw":"roster of A"}',[J(A,'captured','scout_tool_v1:h:3')]:'{"kind":"captured"}',
  [J(A,'archive','scout_tool_v1:x')]:'{"kind":"archive","raw":"unsent edit of A with psimg:psimg_journal5"}',
  [J(B,'base','scout_tool_v1')]:'{"kind":"base","raw":"roster of B"}',
  ['ps_private_board_draft_v1:'+A]:'{"raw":"… token photo psimg:psimg_draft9 …"}',cs_something_else:'left by a failed earlier wipe'
});

test('after a server-confirmed logout of A, B signing in clears A\'s blobs, baselines and unreferenced photos — and nothing else',async()=>{
  const x=device({local:{ps_sync_session:JSON.stringify({uid:B,at:'b',rt:'b'}),ps_board_guest_v1:'{"tokens":[{"photo":"psimg:psimg_guest7"}]}','ps_blob:old':'legacy small-store copy'},idb:seed()});
  assert.equal(x.api.clean(A),true);
  let ticks=0;const report=await x.api.sweep(()=>{ticks++;});
  assert.deepEqual(report,{blobs:2,journals:2,images:1,keptImages:3,clean:true});
  assert.deepEqual([...x.d.keys()].sort(),[J(A,'archive','scout_tool_v1:x'),J(B,'base','scout_tool_v1'),'cs_something_else','ps_private_board_draft_v1:'+A,'psimg_draft9','psimg_guest7','psimg_journal5'].sort());
  assert.ok(ticks>5,'the owner check runs between steps');
  assert.equal(x.l.has('ps_blob:old'),false);assert.equal(x.l.has(hygiene.MARK),false,'the marker is spent');
  assert.ok(x.l.has('ps_board_guest_v1')&&x.l.has('ps_sync_session'));
});
test('without the confirmed-logout marker only the re-downloadable blobs go — journals and photos stay for the account that may come back',async()=>{
  const x=device({local:{ps_sync_session:JSON.stringify({uid:B,at:'b',rt:'b'})},idb:seed()});
  const report=await x.api.sweep(()=>{});
  assert.deepEqual(report,{blobs:2,journals:0,images:0,keptImages:0,clean:false});
  for(const k of [J(A,'base','scout_tool_v1'),J(A,'captured','scout_tool_v1:h:3'),J(A,'archive','scout_tool_v1:x'),'psimg_orphan1'])assert.ok(x.d.has(k),k);
});
test('the unsent original (archive) is never removable, whatever the marker says',()=>{
  const {api}=device();
  for(const clean of ['',A])for(const me of ['',A,B]){
    assert.equal(api.removable(J(A,'archive','k:1'),clean,me),false);
    assert.equal(api.removable(J(A,'base','k'),clean,me),clean===A&&me!==A,'base clean='+clean+' me='+me);
    assert.equal(api.removable(J(B,'base','k'),clean,me),false,'another account\'s baseline');
    assert.equal(api.removable('ps_blob:x',clean,me),true);
    for(const k of ['psimg_x','cs_notes_v1','ps_autosave_journal_v1:broken','ps_autosave_journal_v1:%E0%A4%A:w:base:k',null,7])assert.equal(api.removable(k,clean,me),false,String(k));
  }
});
test('the marker belongs to one account: it is ignored for the account itself and dropped when that account is seen signed in again',async()=>{
  const x=device({local:{ps_sync_session:JSON.stringify({uid:A,at:'a',rt:'a'})},idb:seed()});
  x.api.clean(A);
  const report=await x.api.sweep(()=>{});assert.equal(report.clean,false,'A itself is signing in — its baselines are its own');
  assert.ok(x.d.has(J(A,'base','scout_tool_v1')));
  x.api.clean(A);x.api.boot();assert.equal(x.api.mark(),null);
  assert.equal(x.api.clean(''),false);
  const old=device({local:{[hygiene.MARK]:JSON.stringify({uid:A,at:Date.now()-200*24*3600*1000})}});assert.equal(old.api.mark(),null,'an ancient marker proves nothing');
});
test('what was chosen for deletion must be gone, or the wipe fails closed; a changed owner stops it',async()=>{
  const x=device({local:{ps_sync_session:JSON.stringify({uid:B,at:'b',rt:'b'})},idb:seed(),failDel:k=>k==='ps_blob:def456'});
  await assert.rejects(x.api.sweep(()=>{}),/wipe verification failed/);
  const y=device({local:{ps_sync_session:JSON.stringify({uid:B,at:'b',rt:'b'})},idb:seed()});let n=0;
  await assert.rejects(y.api.sweep(()=>{if(++n>2)throw new Error('owner changed');}),/owner changed/);
  assert.ok(y.d.has('ps_blob:abc123')||y.d.has('ps_blob:def456')||y.deleted.length<=2);
  const none=hygiene.create({local:()=>({length:0,key:()=>null,getItem:()=>null,setItem(){},removeItem(){}}),storage:()=>null});
  assert.deepEqual(await none.sweep(()=>{}),{blobs:0,journals:0,images:0,keptImages:0,clean:false},'no IndexedDB wrapper — nothing to do');
});
test('sync.js: the marker is written only by the gated logout, and the sweep ends the account wipe',()=>{
  const out=sync.slice(sync.indexOf('function signOut('),sync.indexOf('function consumeHash('));
  assert.match(out,/function finish\(gated\)\{/);
  assert.match(out,/try\{if\(gated\)PSAccountHygiene\.clean\(s\.uid\);\}catch\(_\)\{\}/);
  assert.equal((out.match(/finish\(1\)/g)||[]).length,1,'only the path that passed the pending-confirmation barrier');
  assert.ok(out.indexOf('finish(1)')>out.indexOf('logoutBlockingPendingKeys('),'after the barrier');
  assert.match(out,/if\(!dataUnlocked\(\)\)return Promise\.resolve\(finish\(\)\);/,'the locked-screen escape does not claim a confirmed logout');
  const wipe=sync.slice(sync.indexOf('function wipeAccountCache('),sync.indexOf('function wipeAccountCache(')+1100);
  assert.match(wipe,/verifyWorkspacePubCleared\(\);\}\)\.then\(function\(\)\{current\(\);return window\.PSAccountHygiene\?PSAccountHygiene\.sweep\(current\):1;\}\)/);
  const ws=sync.slice(sync.indexOf('function wipeWorkspaceCache('),sync.indexOf('function wipeAccountCache('));
  assert.ok(!ws.includes('PSAccountHygiene'),'a team switch of the same account keeps its photos and baselines');
  assert.ok(app.indexOf('<script src="account-hygiene.js"></script>')>0&&app.indexOf('<script src="account-hygiene.js"></script>')<app.indexOf('<script src="sync.js'));
  assert.ok(sw.includes("'/studio/account-hygiene.js'")&&sw.includes("'/studio/data-lock-guard.js'"));
  assert.ok(Buffer.byteLength(sync)<=832*1024,'sync.js '+Buffer.byteLength(sync));
});

/* ── 바로 연 화면의 잠금 ── */
const box=o=>({getItem:k=>k in o?o[k]:null});
test('data-lock-guard: signed out with account traces → locked; signed in or a first-time guest → open',()=>{
  const S=JSON.stringify({uid:A,at:'a',rt:'r'}),O=JSON.stringify({uid:A,wid:W});
  assert.equal(guard.state(box({ps_sync_session:S,ps_cache_owner_v1:O,ps_active_ws:W})),'');
  assert.equal(guard.state(box({ps_cache_owner_v1:O,ps_active_ws:W})),'signed-out');
  assert.equal(guard.state(box({ps_active_ws:W})),'signed-out');
  assert.equal(guard.state(box({ps_sync_session:JSON.stringify({uid:A,at:'only-access'}),ps_cache_owner_v1:O})),'','a session being refreshed (one token) is still a session — never lock on a doubt');
  assert.equal(guard.state(box({ps_sync_session:'null',ps_cache_owner_v1:O})),'signed-out');assert.equal(guard.state(box({ps_sync_session:'{}',ps_cache_owner_v1:O})),'signed-out');
  assert.equal(guard.state(box({ps_sync_session:'not json',ps_cache_owner_v1:O})),'signed-out');
  assert.equal(guard.state(box({})),'','no account ever used this device — guest board and pages stay open');
  assert.equal(guard.state(box({ps_sync_session:JSON.stringify({uid:B,at:'b',rt:'r'}),ps_cache_owner_v1:O})),'other-account');
  assert.equal(guard.state(box({ps_sync_session:JSON.stringify({uid:'',at:'b',rt:'r'}),ps_cache_owner_v1:O})),'','identity lookup in progress is left to the shell');
  assert.equal(guard.state({getItem(){throw new Error('denied');}}),'','unreadable storage never locks a page');
});
test('data-lock-guard: only a top-level page is blocked, loading stops, and the notice is plain text',()=>{
  const made=[];const el=tag=>({tag,children:[],attrs:{},classList:{add(c){this.c=c;}},setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.children.push(c);return c;}});
  const mk=(top,store)=>{let stopped=0;const html=el('html'),body=el('body'),head=el('head');
    const win={localStorage:box(store),stop(){stopped++;},setTimeout(){},document:{documentElement:html,head,body,getElementById:()=>null,createElement:el,addEventListener(){}}};win.top=top?win:{};
    return {win,body,html,get stopped(){return stopped;}};};
  const locked={ps_cache_owner_v1:JSON.stringify({uid:A,wid:W})};
  const a=mk(true,locked),ra=guard.run(a.win);
  assert.deepEqual([ra.locked,ra.why,a.stopped],[true,'signed-out',1]);
  const notice=a.body.children[0];assert.equal(notice.id,'psLockGuard');assert.equal(notice.attrs.role,'alert');
  assert.equal(notice.children[0].children[0].textContent,'로그인이 필요합니다');assert.equal(notice.children[0].children[3].href,'/studio/app.html');
  const b=mk(false,locked),rb=guard.run(b.win);assert.deepEqual([rb.locked,b.stopped,b.body.children.length],[false,0,0],'inside the shell the shell owns the lock');
  assert.ok(!/innerHTML|document\.write/.test(read('studio/data-lock-guard.js')));
});
test('every page that draws team data from device storage loads the guard before any other script',()=>{
  for(const f of ['scout','idp','process','board','note','gamemodel','scouting','playbook']){
    const html=read('studio/'+f+'.html'),at=html.indexOf('<script src="data-lock-guard.js"></script>');
    assert.ok(at>0,f+'.html loads the guard');assert.equal(html.indexOf('<script'),at,f+'.html: it is the first script');
  }
  assert.ok(read('tests/browser/run-critical.mjs').includes("'logout-direct-pages'"),'browser test is in a CI suite');
});
