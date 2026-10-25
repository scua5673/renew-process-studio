'use strict';
/* 3.095 — 폰 설치 앱이 켜진 지 5초에 꺼짐(사용자 «핸드폰으로 웹앱으로 설치하면 자꾸 안돼»; 10/16~18 boot_after_crash 가 모두 아이폰 설치 앱).
   폰은 팀운영 › 오늘로 열리고 작전판은 숨은 채 부팅하는데, 숨은 보관함이 로그인 · 동기화 알림마다 다시 그리며 보관함 통째(그 팀 21MB)를
   10초에 24번 읽고 해석했다(크로미움 실측 0.9GB). 두 가지로 막는다:
   ① 같은 때 줄 선 그리기 읽기는 하나를 같이 쓴다(board.html psVaultRenderRead — 아직 시작 전이고 뒤에 다른 차례가 없을 때만).
   ② 작전판 틀이 숨어 있으면 그리기 읽기를 미루고 틀이 보일 때 한 번 그린다(studio/board-vault-lazy.js). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const board=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const Lazy=require('../studio/board-vault-lazy.js');
const slice=(a,b)=>{const i=board.indexOf(a);assert.ok(i>=0,a);const j=board.indexOf(b,i+a.length);assert.ok(j>i,b);return board.slice(i,j);};
function fnAt(src,start){const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ── ① 같이 쓰는 그리기 읽기 ── */
function ctx(){
  const st={raw:JSON.stringify([{libId:'A',name:'가'}]),reads:0,uid:'me',wid:'team',unlocked:true};
  const c={JSON,Promise,setTimeout,st,
    libGet:async()=>{st.reads++;const s=st.raw;await sleep(5);return JSON.parse(s);},
    libWrite:async l=>{const s=JSON.stringify(l);await sleep(10);st.raw=s;return true;},libTouch(){},
    psMyUid:()=>st.uid,psActiveWs:()=>({id:st.wid}),psVaultUnlocked:()=>st.unlocked,psVaultShowLock(){}};
  c.libSet=l=>c.libWrite(l).then(()=>c.libTouch());
  vm.createContext(c);
  vm.runInContext(slice('var _libTurnTail=Promise.resolve();','function psVaultOpenLogin(){')+fnAt(board,'async function psVaultReadForRender(){')+';this.libTurn=libTurn;this.read=psVaultReadForRender;',c);
  return c;
}
test('renders asked for at the same moment share one read of the whole vault',async()=>{
  const c=ctx();
  const got=await Promise.all([c.read(),c.read(),c.read(),c.read()]);
  assert.equal(c.st.reads,1,'네 번 그려도 보관함은 한 번 읽는다');
  got.forEach(l=>assert.deepEqual(l.map(d=>d.libId),['A']));
  await c.read();
  assert.equal(c.st.reads,2,'끝난 뒤의 그리기는 새로 읽는다');
});
test('a write queued in between is never skipped — the next render reads after it',async()=>{
  const c=ctx();
  const first=c.read();
  const write=c.libTurn(()=>c.libGet().then(l=>{l.push({libId:'B'});return c.libSet(l);}));
  const second=c.read();
  const [a,b]=await Promise.all([first,second,write]);
  assert.deepEqual(a.map(d=>d.libId),['A'],'앞 그리기는 쓰기 전 목록');
  assert.deepEqual(b.map(d=>d.libId),['A','B'],'쓰기 뒤에 부른 그리기는 쓰기가 끝난 목록 — 앞 읽기에 얹히지 않는다');
});
test('a read that already started is not joined (it may be older than the caller)',async()=>{
  const c=ctx();
  const first=c.read();await sleep(1);   /* 차례가 시작돼 libGet 중 */
  c.st.raw=JSON.stringify([{libId:'A'},{libId:'C'}]);   /* 다른 화면(셸 동기화)이 그 사이 저장 */
  const second=c.read();
  const [a,b]=await Promise.all([first,second]);
  assert.equal(c.st.reads,2);
  assert.deepEqual(b.map(d=>d.libId),['A','C']);
  assert.notEqual(a,b);
});

/* ── ② 숨은 작전판 ── */
function fakeWin({hidden=true,search='',drillOn=false}={}){
  const calls=[],timers=new Map();let tid=0,observers=[];
  const fe={hidden_:hidden,getClientRects(){return this.hidden_?[]:[{width:393,height:700}];}};
  class MO{constructor(cb){this.cb=cb;observers.push(this);}observe(){}disconnect(){this.off=true;}}
  const pdoc={body:{},defaultView:{MutationObserver:MO}};fe.ownerDocument=pdoc;
  const win={frameElement:fe,location:{search},calls,timers,observers,
    setInterval(f){tid++;timers.set(tid,f);return tid;},clearInterval(id){timers.delete(id);},setTimeout(f){f();return 0;},
    addEventListener(){},
    document:{getElementById(id){return id==='drillLib'?{classList:{contains:k=>k==='on'&&drillOn}}:null;}},
    renderDrillFiles(){calls.push('files');},renderLibDock(){calls.push('dock');},renderLib(){calls.push('lib');},renderLibTray(){calls.push('tray');}};
  return {win,fe};
}

// 실제 지연 모듈과 보드 읽기를 연결해 화면 전환 전후의 Promise 순서를 제어한다.
function lifecycle({target='frame'}={}){
  const c=ctx(),{win,fe}=fakeWin({hidden:false});
  const session={hidden_:false,getClientRects(){return this.hidden_?[]:[{}];}};
  const get=win.document.getElementById;
  win.document.getElementById=id=>id==='sessionView'?session:get(id);
  const api=Lazy.mount(win),painted=[],pending=[];
  c.__psVaultDefer=()=>win.__psVaultDefer();
  for(const name of ['renderDrillFiles','renderLibDock','renderLibTray'])win[name]=()=>{
    win.calls.push(name);
    const p=c.read().then(lib=>{if(lib)painted.push(lib);});pending.push(p);return p;
  };
  const visibility=on=>{(target==='frame'?fe:session).hidden_=!on;};
  return {c,win,api,painted,hide:()=>visibility(false),show:()=>visibility(true),
    async reopen(){visibility(true);api.flush();await Promise.all(pending);}};
}
function holdRead(c){
  let resolve,started;
  const called=new Promise(r=>started=r),normal=c.libGet;
  c.libGet=()=>{c.st.reads++;started();return new Promise(r=>resolve=r);};
  return {called,finish:lib=>resolve(lib),restore:()=>c.libGet=normal};
}
for(const target of ['frame','session'])test('a queued render does not start a whole-vault read after '+target+' closes, then reopens once',async()=>{
  const h=lifecycle({target});let release,entered;
  const blocked=new Promise(r=>entered=r);
  const prior=h.c.libTurn(()=>new Promise(r=>{release=r;entered();}));await blocked;
  const reads=[h.c.read(),h.c.read(),h.c.read()];h.hide();release();await prior;
  const values=await Promise.all(reads);
  assert.equal(h.c.st.reads,0,'닫힌 뒤 차례가 온 읽기는 저장소를 열지 않는다');
  values.forEach(value=>assert.equal(value,null));
  assert.equal(h.api.pending(),true,'다음 실제 보관함 진입 때 다시 그린다');
  assert.deepEqual(h.win.calls,[]);
  await h.reopen();
  assert.equal(h.c.st.reads,1,'다시 열 때 세 그리기는 최신 읽기 한 번을 공유한다');
  assert.deepEqual(h.win.calls,['renderDrillFiles','renderLibDock','renderLibTray']);
  assert.equal(h.painted.length,3);assert.equal(h.painted[0],h.painted[1]);assert.equal(h.painted[1],h.painted[2]);
  assert.deepEqual(h.painted[0].map(d=>d.libId),['A']);
  assert.equal(h.api.pending(),false);assert.equal(h.win.timers.size,0);
  h.api.flush();assert.equal(h.win.calls.length,3,'이미 처리한 재진입을 두 번 그리지 않는다');
});
for(const target of ['frame','session'])test('an in-flight render cannot paint after '+target+' closes, and reopening reads fresh data',async()=>{
  const h=lifecycle({target}),disk=holdRead(h.c);let paints=0;
  const pending=h.c.read().then(lib=>{if(lib)paints++;return lib;});await disk.called;
  h.hide();disk.finish([{libId:'stale'}]);
  assert.equal(await pending,null,'이미 읽기 시작했어도 닫힌 화면에 결과를 넘기지 않는다');
  assert.equal(paints,0);assert.equal(h.api.pending(),true);
  disk.restore();h.c.st.raw=JSON.stringify([{libId:'fresh'}]);await h.reopen();
  assert.equal(h.c.st.reads,2,'재진입은 폐기한 결과 대신 새 자료를 한 번 읽는다');
  assert.equal(h.painted.length,3);assert.deepEqual(h.painted[0].map(d=>d.libId),['fresh']);
  assert.equal(h.api.pending(),false);
});
for(const key of ['uid','wid'])test('a read from the previous '+key+' is discarded even when the vault is visible again',async()=>{
  const h=lifecycle(),disk=holdRead(h.c);
  const pending=h.c.read();await disk.called;
  h.hide();h.c.st[key]='other';h.show();disk.finish([{libId:'old-private-item'}]);
  assert.equal(await pending,null,'숨김 해제가 이전 주인의 자료를 허용하지 않는다');
  assert.equal(h.c.st.reads,1);assert.deepEqual(h.painted,[]);
});
test('frameHidden: no boxes means hidden (display:none on the frame or above); anything odd counts as shown',()=>{
  assert.equal(Lazy.frameHidden({getClientRects:()=>[]}),true);
  assert.equal(Lazy.frameHidden({getClientRects:()=>[{}]}),false);
  assert.equal(Lazy.frameHidden(null),false);
  assert.equal(Lazy.frameHidden({getClientRects(){throw new Error('x');}}),false,'모르면 예전처럼 그린다');
});
test('a hidden board skips the read and draws once when its frame becomes visible',()=>{
  const {win,fe}=fakeWin({hidden:true});
  const api=Lazy.mount(win);
  assert.equal(win.__psVaultDefer(),true,'숨어 있으면 미룬다');
  assert.equal(win.__psVaultDefer(),true);
  assert.equal(api.pending(),true);
  assert.equal(win.timers.size,1,'지켜보기는 하나');
  api.flush();assert.deepEqual(win.calls,[],'아직 숨어 있으면 그리지 않는다');
  fe.hidden_=false;
  win.observers[0].cb([]);   /* 셸이 틀의 display 를 바꿈 */
  assert.deepEqual(win.calls,['files','dock','tray'],'보이면 한 번 — 보관함 목록 · 도크 · 고르기 띠(열린 창만)');
  assert.equal(api.pending(),false);assert.equal(win.timers.size,0,'다 그리면 지켜보기를 멈춘다');assert.equal(win.observers[0].off,true);
  assert.equal(win.__psVaultDefer(),false,'보이는 작전판은 예전처럼 바로 그린다');
  [...win.timers.values()].forEach(f=>f());assert.deepEqual(win.calls,['files','dock','tray']);
});
test('the open library sheet is redrawn too; missing observers fall back to the 0.6 s check',()=>{
  const {win,fe}=fakeWin({hidden:true,drillOn:true});
  win.frameElement.ownerDocument.defaultView.MutationObserver=function(){throw new Error('no MO');};
  Lazy.mount(win);win.__psVaultDefer();
  assert.equal(win.timers.size,1);
  fe.hidden_=false;[...win.timers.values()][0]();
  assert.deepEqual(win.calls,['files','dock','lib','tray']);
});
test('outside the shell and on community side boards nothing changes',()=>{
  assert.equal(Lazy.mount({frameElement:null,location:{search:''}}),null);
  const {win}=fakeWin({hidden:true,search:'?community_view=1'});
  assert.equal(Lazy.mount(win),null);assert.equal(win.__psVaultDefer,undefined);
});
test('board.html asks before every render read and before the creator backfill; the module is in the offline core',()=>{
  assert.match(board,/<script src="board-actions\.js"><\/script><script src="board-vault-lazy\.js"><\/script>/);
  assert.match(fnAt(board,'function psVaultRenderRead(){'),/^function psVaultRenderRead\(\)\{if\(typeof __psVaultDefer==='function'&&__psVaultDefer\(\)\)return Promise\.resolve\(null\);/);
  assert.match(fnAt(board,'async function psVaultReadForRender(){'),/var lib=await psVaultRenderRead\(\);/);
  assert.match(fnAt(board,'function maybeBackfillCreators(){'),/if\(__bfWs===w\.id\|\|\(typeof __psVaultDefer==='function'&&__psVaultDefer\(\)\)\)return;[^\n]*__bfWs=w\.id;/,'미루면 작성자 채우기 표시(__bfWs)를 남기지 않는다 — 보일 때 다시 돈다');
  assert.ok(sw.includes("'/studio/board-vault-lazy.js'"),'sw.js CORE');
  assert.match(fs.readFileSync(path.join(root,'tests/browser/run-critical.mjs'),'utf8'),/'phone-boot-vault'/,'CI 브라우저 묶음에 — 폰은 숨은 작전판이 보관함을 읽지 않는지, 데스크톱은 그리기가 묶이는지 센다');
});

// 3.146: 첫 화면 라우팅 전의 보이는 보드와 태블릿 부팅도 닫힌 보관함을 읽지 않는다.
test('visible board defers its closed vault until the actual list opens',()=>{
  const {win}=fakeWin({hidden:false});
  const session={hidden_:true,getClientRects(){return this.hidden_?[]:[{}];}};
  const original=win.document.getElementById;
  win.document.getElementById=id=>id==='sessionView'?session:original(id);
  win.maybeBackfillCreators=()=>win.calls.push('creators');
  const api=Lazy.mount(win);
  assert.equal(win.__psVaultDefer(),true);
  win.observers[0].cb([]);
  assert.deepEqual(win.calls,[],'보드가 보여도 목록은 아직 필요 없다');
  session.hidden_=false;
  win.observers[0].cb([]);
  assert.deepEqual(win.calls,['files','dock','tray','creators']);
  assert.equal(api.pending(),false);
  assert.equal(win.__psVaultDefer(),false);
});
test('opening the library overlay also permits reads while the session view is closed',()=>{
  const {win}=fakeWin({hidden:false,drillOn:true});
  const original=win.document.getElementById;
  win.document.getElementById=id=>id==='sessionView'?{getClientRects:()=>[]}:original(id);
  Lazy.mount(win);
  assert.equal(win.__psVaultDefer(),false);
});
