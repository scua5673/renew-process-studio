// 3.090 — 작전판 보관함 읽기 줄이기(studio/board-vault-reads.js). 아이폰 «문제가 반복적으로 발생»: 숨은 작전판이 부팅 중 보관함 전체(36MB 팀)를
// 26번 읽어 메모리가 넘쳤다. ① 같은 계정 · 팀이면 «로그인 상태» 알림에 다시 그리지 않고 ② 같이 들어온 그리기 읽기는 한 번만 읽고
// ③ 숨은 작전판은 보일 때 그린다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../studio/board-vault-reads.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));

function fakeWin({hidden=false,frame=true}={}){
  const listeners={win:{},doc:{}},n={read:0,auth:0,lock:0,ready:0,files:0,dock:0,lib:0,sel:0};
  const add=(m)=>(t,f)=>{(m[t]=m[t]||[]).push(f);},rem=(m)=>(t,f)=>{m[t]=(m[t]||[]).filter(x=>x!==f);};
  const state={unlocked:true,uid:'u1',wid:'w1',rev:'1'};
  let observer=null;
  class MO{constructor(cb){this.cb=cb;observer=this;}observe(){this.on=true;}disconnect(){this.on=false;}}
  const fe=frame?{style:{display:hidden?'none':'block'}}:null;
  const win={
    _libTurnTail:Promise.resolve(),
    frameElement:fe,MutationObserver:MO,
    localStorage:{getItem:k=>k==='cs_lib_rev'?state.rev:null},
    document:{readyState:'loading',getElementById:()=>null,addEventListener:add(listeners.doc),removeEventListener:rem(listeners.doc)},
    addEventListener:add(listeners.win),removeEventListener:rem(listeners.win),
    psMyUid:()=>state.uid,psActiveWs:()=>({id:state.wid}),psVaultUnlocked:()=>state.unlocked,
    psVaultHideLock(){},vaultBoardCheckOwner(){},
    renderDrillFiles(){n.files++;},renderLibDock(){n.dock++;},renderLib(){n.lib++;},updateLibSelBar(){n.sel++;}
  };
  // 작전판 모양: 그리기 읽기는 차례(libTurn)를 하나 연다 — 꼬리가 바뀐다
  win.libTurn=task=>{const run=win._libTurnTail.then(task);win._libTurnTail=run.then(()=>{},()=>{});return run;};
  win.psVaultReadForRender=async function(){n.read++;const lib=await win.libTurn(()=>new Promise(r=>setTimeout(()=>r([{libId:'A'}]),5)));return lib;};
  win.psVaultAuthChanged=function(){n.auth++;if(state.unlocked){win.psVaultRenderReady()&&(n.files++,n.dock++);}else win.psVaultShowLock();};
  win.psVaultShowLock=function(){n.lock++;};
  win.psVaultRenderReady=function(){n.ready++;return state.unlocked;};
  // 작전판이 함수 그대로 건 귀
  for(const t of ['pageshow','focus'])win.addEventListener(t,win.psVaultAuthChanged);
  win.document.addEventListener('DOMContentLoaded',win.psVaultAuthChanged);
  const fire=(m,t,e)=>{for(const f of (listeners[m][t]||[]).slice())f.call(win,e||{});};
  return {win,n,state,listeners,fire,show(){fe.style.display='block';observer&&observer.on&&observer.cb([]);},observer:()=>observer};
}

test('share: reads that arrive together get one read; a new turn, another key or a finished read start a new one',async()=>{
  const share=R.createShare();let tail=1,starts=0;
  const start=()=>{const k=++starts;tail++;return new Promise(r=>setTimeout(()=>r('lib'+k),5));};
  const a=share('k',()=>tail,start),b=share('k',()=>tail,start);
  assert.equal(a,b);assert.equal(starts,1);
  tail++;   // 그 사이 다른 차례(쓰기)가 열렸다 — 그 뒤 읽기는 쓰기 뒤의 목록을 봐야 한다
  const c=share('k',()=>tail,start);assert.notEqual(c,a);assert.equal(starts,2);
  const d=share('other',()=>tail,start);assert.notEqual(d,c);assert.equal(starts,3);
  assert.equal(await a,'lib1');await c;await d;
  const e=share('other',()=>tail,start);assert.equal(starts,4,'a finished read is never handed out');await e;
});
test('share: a failed read reaches every caller, and the next read starts fresh',async()=>{
  const share=R.createShare();let starts=0;
  const start=()=>{starts++;return Promise.reject(new Error('disk read failed'));};
  const a=share('k',()=>0,start),b=share('k',()=>0,start);
  await assert.rejects(a,/disk read failed/);await assert.rejects(b,/disk read failed/);
  await tick();await assert.rejects(share('k',()=>0,start),/disk read failed/);assert.equal(starts,2);
});

test('auth: repeated «login state» notices for the same account and team draw the vault once',()=>{
  const f=fakeWin();assert.equal(R.install(f.win),true);
  for(let i=0;i<6;i++)f.win.psVaultAuthChanged();
  assert.equal(f.n.auth,1);assert.equal(f.n.files,1);
  f.fire('win','focus');f.fire('win','pageshow',{persisted:false});
  assert.equal(f.n.auth,1,'focus and a plain pageshow use the gated handler');
  f.state.wid='w2';f.win.psVaultAuthChanged();assert.equal(f.n.auth,2,'another team draws again');
  f.state.uid='u2';f.win.psVaultAuthChanged();assert.equal(f.n.auth,3,'another account draws again');
  f.fire('win','pageshow',{persisted:true});assert.equal(f.n.auth,4,'back from the page cache — storage notices were missed, draw again');
});
test('auth: a lock is never skipped, and the next unlock draws again',()=>{
  const f=fakeWin();R.install(f.win);
  f.win.psVaultAuthChanged();assert.equal(f.n.auth,1);
  f.state.unlocked=false;f.win.psVaultAuthChanged();f.win.psVaultAuthChanged();
  assert.equal(f.n.auth,3);assert.equal(f.n.lock,2);
  f.state.unlocked=true;f.win.psVaultAuthChanged();assert.equal(f.n.auth,4,'same account after a lock draws again');
  f.win.psVaultShowLock();f.win.psVaultAuthChanged();assert.equal(f.n.auth,5,'a lock shown from anywhere also forgets the drawn state');
});
test('auth: the board DOMContentLoaded handler is swapped while the page is still loading',()=>{
  const f=fakeWin();R.install(f.win);
  f.fire('doc','DOMContentLoaded');f.fire('doc','DOMContentLoaded');
  assert.equal(f.n.auth,1);
});

test('render read: renderDrillFiles + renderLibDock (+ its renderDrillFiles) at the same time read the vault once',async()=>{
  const f=fakeWin();R.install(f.win);
  const ps=[f.win.psVaultReadForRender(),f.win.psVaultReadForRender(),f.win.psVaultReadForRender()];
  assert.equal(f.n.read,1);
  const got=await Promise.all(ps);assert.deepEqual(got[0],[{libId:'A'}]);assert.equal(got[0],got[2]);
  await f.win.psVaultReadForRender();assert.equal(f.n.read,2,'after it finished, a new read');
});
test('render read: a write turn in between, a new vault revision or another account is never served the old list',async()=>{
  const f=fakeWin();R.install(f.win);
  const a=f.win.psVaultReadForRender();
  f.win.libTurn(()=>Promise.resolve('write'));   // 보관함 쓰기 차례
  const b=f.win.psVaultReadForRender();assert.equal(f.n.read,2);
  f.state.rev='2';const c=f.win.psVaultReadForRender();assert.equal(f.n.read,3);
  f.state.uid='u9';const d=f.win.psVaultReadForRender();assert.equal(f.n.read,4);
  await Promise.all([a,b,c,d]);
});
test('render read: without the board turn tail it does not share',async()=>{
  const f=fakeWin();delete f.win._libTurnTail;f.win.libTurn=t=>Promise.resolve().then(t);R.install(f.win);
  await Promise.all([f.win.psVaultReadForRender(),f.win.psVaultReadForRender()]);assert.equal(f.n.read,2);
});

test('hidden board: vault drawing waits until the shell shows the board, then draws once',()=>{
  const f=fakeWin({hidden:true});R.install(f.win);
  assert.equal(f.win.psVaultRenderReady(),false);assert.equal(f.win.psVaultRenderReady(),false);
  assert.equal(f.n.ready,0,'nothing read or locked while hidden');
  f.show();
  assert.deepEqual([f.n.files,f.n.dock,f.n.sel],[1,1,1]);
  assert.equal(f.win.psVaultRenderReady(),true);assert.equal(f.n.ready,1);
  f.show();assert.equal(f.n.files,1,'shown again — no second deferred draw');
});
test('hidden board: style changes that keep it hidden do not draw',()=>{
  const f=fakeWin({hidden:true});R.install(f.win);
  f.win.psVaultRenderReady();f.observer().cb([]);
  assert.equal(f.n.files,0);
});
test('a visible board, or a board with no frame / no MutationObserver, draws right away as before',()=>{
  for(const opt of [{hidden:false},{frame:false}]){
    const f=fakeWin(opt);R.install(f.win);assert.equal(f.win.psVaultRenderReady(),true);assert.equal(f.n.ready,1);
  }
  const g=fakeWin({hidden:true});g.win.MutationObserver=undefined;R.install(g.win);
  assert.equal(g.win.psVaultRenderReady(),true);assert.equal(g.n.ready,1);
});
test('install is once, and refuses a page without the board vault functions',()=>{
  const f=fakeWin();assert.equal(R.install(f.win),true);assert.equal(R.install(f.win),false);
  assert.equal(R.install({}),false);
});

test('the board loads the module before its own script and installs it before init()',()=>{
  const b=read('studio/board.html');
  const tag=b.indexOf('<script src="board-vault-reads.js"></script>'),main=b.indexOf('<script>\n"use strict";');
  assert.ok(tag>0&&main>tag,'module tag before the board script');
  const inst=b.indexOf('PSVaultReads.install(window)'),init=b.indexOf('\ninit();\n');
  assert.ok(inst>main&&init>inst,'installed inside the board script, before init() draws the dock');
  assert.match(read('sw.js'),/'\/studio\/board-vault-reads\.js'/,'cached with the app (sw.js CORE)');
});
test('board init reads the vault only when there is an edit recovery copy to merge',()=>{
  const b=read('studio/board.html');
  assert.match(b,/if\(localStorage\.getItem\(VAULT_REC_KEY\)\)libGet\(\)\.then\(function\(L\)\{\}\)/);
  assert.doesNotMatch(b,/\n  try\{libGet\(\)\.then\(function\(L\)\{\}\)/);
});
