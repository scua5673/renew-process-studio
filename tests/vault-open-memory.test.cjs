'use strict';
/* 큰 보관함의 «통째 읽기» 줄이기(제보 de2e508c 조사 — 82개 20MB, 맥 크롬 탭 종료). 보관함은 목록 한 덩어리라 읽기 한 번이 렌더러 메모리를 100~140MB 잠깐 올린다.
   ① 작전판: 읽는 중인 목록을 같이 쓴다(board-vault-lazy.js share — 열기 3번 → 2번, 저장 뒤 다시 그리기 2번 → 1번) ② 일정: 사본에서 장면 본문을 내려놓고(40MB → 12MB),
   숨은 동안의 다시 읽기는 보일 때로 미룬다(schedule-lib-slim.js) ③ 선수 변경 묶음 훑기: 키 n 개에 n² 칸을 쓰던 것(roster-pending.js). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Lazy=require('../studio/board-vault-lazy.js'),Sched=require('../studio/schedule-lib-slim.js');
const Outbox=require('../studio/roster-outbox.js'),Pending=require('../studio/roster-pending.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));

function board({hidden=false}={}){
  const ls=new Map([['cs_lib_rev','1']]),gates=[];let who={uid:'u1',wid:'w1'},unlocked=true;
  const win={reads:0,writes:0,_libTurnTail:{},__psVaultDefer:()=>hidden,localStorage:{getItem:k=>ls.has(k)?ls.get(k):null},
    psMyUid:()=>who.uid,psActiveWs:()=>({id:who.wid}),psVaultUnlocked:()=>unlocked,
    psVaultRenderRead(){if(hidden)return Promise.resolve(null);win.reads++;win._libTurnTail={};let res,rej;const p=new Promise((a,b)=>{res=a;rej=b;});gates.push({res,rej});return p;},
    libWrite(){win.writes++;return Promise.resolve(true);},psVaultAuthChanged(x){win.auths=(win.auths||0)+1;return 'auth:'+x;}};
  return {win,ls,api:Lazy.share(win),done:(v=[{libId:'a'}])=>{gates.shift().res(v);return tick();},fail:()=>{gates.shift().rej(new Error('x'));return tick();},
    hide:v=>{hidden=v;},who:v=>{who=v;},lock:v=>{unlocked=!v;}};
}

test('renders that arrive while a whole-vault read is running share it; a finished read is never reused',async()=>{
  const h=board(),w=h.win;
  const a=w.psVaultRenderRead(),b=w.psVaultRenderRead(),c=w.psVaultRenderRead();   // setView 그리기 · lazy flush · 저장 뒤 다시 그리기 — 읽는 중
  assert.equal(a,b);assert.equal(a,c,'the same promise');assert.equal(w.reads,1,'three render requests, one read');
  await h.done();assert.deepEqual(await c,[{libId:'a'}]);
  const d=w.psVaultRenderRead();assert.notEqual(d,a,'once it has finished the next render reads again (3.146: a read that ended while hidden is discarded)');
  assert.equal(w.reads,2);await h.done();
  assert.deepEqual(h.api.stats,{reads:2,shared:2});
});

test('anything that may have changed the vault while reading forces a fresh read',async()=>{
  const fresh=async(change,why)=>{const h=board(),w=h.win;const a=w.psVaultRenderRead();await change(h,w);const b=w.psVaultRenderRead();
    assert.notEqual(b,a,why);assert.equal(w.reads,2,why);};
  await fresh((h,w)=>w.libWrite([]),'this board wrote the vault');
  await fresh(h=>h.ls.set('cs_lib_rev','2'),'the change signal moved (sync libSave · schedule · playbook · this board\'s libSet)');
  await fresh((h,w)=>{w._libTurnTail={};},'another vault turn was queued — a render must read after it (2.995)');
  await fresh(h=>h.who({uid:'u1',wid:'w2'}),'team switched');
  await fresh(h=>h.who({uid:'u2',wid:'w1'}),'account switched');
  await fresh(h=>h.lock(true),'vault locked');
  await fresh((h,w)=>w.psVaultAuthChanged(),'a login/ready notice — the owner may have changed (3.176 counts that read separately)');
});

test('failed and hidden reads are never shared; writes and auth notices are passed through untouched',async()=>{
  let h=board(),w=h.win,a=w.psVaultRenderRead();a.catch(()=>{});await h.fail();assert.notEqual(w.psVaultRenderRead(),a,'a rejected read');
  h=board();w=h.win;a=w.psVaultRenderRead();h.hide(true);
  assert.equal(await w.psVaultRenderRead(),null,'a hidden board does not join a running read (3.095)');
  h.hide(false);assert.notEqual(w.psVaultRenderRead(),a,'and reads fresh when shown');
  h=board();w=h.win;assert.equal(await w.libWrite([1]),true);assert.equal(w.writes,1);
  assert.equal(w.psVaultAuthChanged('x'),'auth:x');assert.equal(w.auths,1);
  assert.equal(Lazy.share(w),null,'installed once');assert.equal(Lazy.share({}),null,'outside the board: nothing');
});

test('the board loads the share after its own functions exist, and every signal it relies on is still there',()=>{
  const lazy=read('studio/board-vault-lazy.js'),B=read('studio/board.html');
  assert.match(lazy,/addEventListener\('DOMContentLoaded', function \(\) \{ try \{ window\.__psVaultShare = share\(window\)/);
  assert.match(B,/\nvar _libTurnTail=Promise\.resolve\(\);\nfunction libTurn\(task\)\{var run=_libTurnTail\.then/,'_libTurnTail is a window property (var) replaced by every vault turn');
  assert.match(B,/\nfunction libWrite\(lib\)\{/,'libWrite is a global function — every vault write of this board goes through it');
  assert.equal((B.match(/boardStore\.set\(LIB_KEY/g)||[]).length,1,'no vault write that bypasses libWrite');
  assert.match(B,/function libSet\(lib\)\{return libWrite\(lib\)\.then\(function\(\)\{libTouch\(\);\}\);\}/,'libSet leaves the change signal');
  assert.match(B,/\nfunction psVaultAuthChanged\(\)\{/,'the auth notice handler is a global function');
  assert.match(read('studio/sync.js'),/localStorage\.setItem\('cs_lib_rev',rev\)/,'sync libSave leaves the change signal');
});

test('schedule copy drops per-page scene lists only, and nothing the schedule reads',()=>{
  const item=()=>({libId:'a',name:'n',thumb:'<svg/>',snap:{players:[1]},frames:[{snap:{}},{snap:{}}],trainings:[{name:'t',frames:[{},{}]}],drills:[{name:'d'}],
    pages:[{name:'p1',thumb:'<svg/>',snap:{players:[2]},anim:{frames:[{snap:{},thumb:'x'.repeat(70000)}]}},{name:'p2',snap:{}},null]});
  const list=[item(),{libId:'b',name:'plain'},null,{libId:'c',pages:'odd'}],out=Sched.slim(list);
  assert.equal(out,list,'in place');
  const want=item();want.pages.forEach(p=>{if(p)delete p.anim;});
  assert.deepEqual(list[0],want);assert.equal('anim' in list[0].pages[0],false);
  assert.deepEqual(list.slice(1),[{libId:'b',name:'plain'},null,{libId:'c',pages:'odd'}]);
  assert.equal(Sched.slim(null),null);assert.equal(Sched.slim('x'),'x');
  const P=read('studio/process.html');
  assert.equal(/\.anim\b/.test(P),false,'process.html never reads pages[].anim — if this changes, schedule-lib-slim.js must keep it');
  assert.equal((P.match(/psLibSlim\(/g)||[]).length,3,'all three places that fill __psLibCache');
  assert.match(P,/let __psLibCache=\[\];var psLibSlim=window\.psLibSlim\|\|Object;/,'a missing module leaves the list whole');
  assert.match(P,/<script src="storage\.js"><\/script><script src="schedule-lib-slim\.js"><\/script>/);
  assert.ok(read('sw.js').includes("'/studio/schedule-lib-slim.js'"),'precached');
});

test('a hidden schedule frame postpones the whole-vault refresh until it is shown',async()=>{
  let rects=[],calls=0,observed=0;const timers=[];
  const fe={getClientRects:()=>rects,ownerDocument:null};
  const pwin={MutationObserver:function(fn){this.observe=()=>{observed++;};this.disconnect=()=>{};pwin.fire=fn;}};
  fe.ownerDocument={defaultView:pwin,body:{}};
  const win={frameElement:fe,psLibraryRefresh(){calls++;return Promise.resolve(true);},setInterval(f){timers.push(f);return timers.length;},clearInterval(){},setTimeout(f){f();},addEventListener(){}};
  const api=Sched.deferHidden(win);
  assert.equal(await win.psLibraryRefresh(),false,'hidden: not read');assert.equal(calls,0);assert.equal(api.pending(),true);assert.ok(observed>=2,'watches the frame and the shell');
  await win.psLibraryRefresh();assert.equal(calls,0,'several changes while hidden are still one pending refresh');
  timers[0]();assert.equal(calls,0,'still hidden');
  rects=[{}];pwin.fire();assert.equal(calls,1,'shown: one refresh');assert.equal(api.pending(),false);
  pwin.fire();timers[0]();assert.equal(calls,1,'only once');
  assert.equal(await win.psLibraryRefresh(),true,'a visible schedule refreshes at once, as before');assert.equal(calls,2);
  assert.equal(Sched.deferHidden(win),null,'installed once');
  assert.equal(Sched.deferHidden({psLibraryRefresh(){}}),null,'outside the shell: unchanged');
});

test('scanning the roster outbox touches each localStorage key a few times, not n times',async()=>{
  const ls=new Map([['scout_tool_v1','{"players":[]}'],['cs_player_del_v1','{}']]);for(let i=0;i<300;i++)ls.set('ps_blob:'+i,'x');
  let keyCalls=0;
  const local={get length(){return ls.size;},key:i=>{keyCalls++;return [...ls.keys()][i]??null;},getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v)),removeItem:k=>ls.delete(k)};
  const idb=new Map(),storage={conditionalGuardVersion:1,async keys(p){return [...idb.keys()].filter(k=>k.startsWith(p));},async peek(k){return idb.has(k)?{value:idb.get(k)}:null;},async setIfValues(){return true;},async delIfValue(){return true;}};
  const who={uid:'coach-a',wid:'team-a'},b=Pending.create({outbox:Outbox,local,storage,owner:()=>who,stamp:()=>'s1',editable:()=>true,suspended:()=>null});
  await b.prepare();keyCalls=0;
  assert.equal(b.pending(),false);
  const perScan=keyCalls;
  assert.ok(perScan>0&&perScan<=302*6,'one pending() check reads '+perScan+' keys for 302 stored — it was 302 × 302 × 4 before');
  /* 묶음이 있어도 같은 답 — 구출 원문이 없으면 작은 저장소 그대로 */
  const receipt=b.stage({players:[{id:'p1',name:'n',type:'ours'}],basePlayers:[],changedIds:['p1'],deletedIds:[]});
  assert.equal(b.pending(),true);assert.equal(b.ack(receipt),1);assert.equal(b.pending(),false);
});
