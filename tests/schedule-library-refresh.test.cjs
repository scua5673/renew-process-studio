'use strict';
/* 2.934 — 오류 제보(10/1): «보관함에 훈련을 저장해 놓고 오늘 훈련 세션 › 보관함에서 선택하려고 하면 없음 · 껐다 켜면 바로 생김».
   일정 화면은 처음 한 번 읽은 보관함 목록을 계속 썼다. 보관함이 바뀌었다는 신호(cs_lib_rev)에 새로 읽는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const P=read('process.html'),B=read('board.html');

function page(lib){
  const listeners={},shelf=[];let resolveGet=null;
  const c=vm.createContext({JSON,Promise,__psLibEpoch:0,__psLibCache:[{libId:'old',name:'옛 훈련'}],
    psLibraryDataUnlocked:()=>true,renderDrillShelf(){shelf.push(c.__psLibCache.length);},
    addEventListener(n,fn){(listeners[n]||(listeners[n]=[])).push(fn);}});
  c.window=c;
  c.storage={get:()=>new Promise(r=>{resolveGet=()=>r({value:JSON.stringify(lib)});})};
  vm.runInContext(part(P,'var __psLibRefreshSeq=0, __psLibPending=null;','function psLibraryAuthChanged(forced){'),c);
  return {c,shelf,fire:key=>(listeners.storage||[]).forEach(fn=>fn({key})),resolve:()=>resolveGet&&resolveGet()};
}
const tick=()=>new Promise(r=>setImmediate(r));

test('a library change signal re-reads the library, keeping the old list until the new one lands',async()=>{
  const h=page([{libId:'old',name:'옛 훈련'},{libId:'new',name:'방금 저장한 훈련'}]);
  h.fire('unrelated');assert.equal(h.c.__psLibPending,null,'다른 키에는 반응하지 않는다');
  h.fire('cs_lib_rev');await tick();
  assert.ok(h.c.__psLibPending,'새로 읽는 중');
  assert.equal(h.c.__psLibCache.length,1,'읽는 동안 옛 목록을 비우지 않는다');
  h.resolve();await tick();await tick();
  assert.deepEqual(h.c.__psLibCache.map(d=>d.libId),['old','new'],'방금 저장한 훈련이 목록에 들어온다');
  assert.equal(h.c.__psLibPending,null);assert.deepEqual(h.shelf,[2]);
});
test('a stale read that finishes after the lock (epoch change) is discarded',async()=>{
  const h=page([{libId:'x'}]);
  h.fire('cs_lib_rev');await tick();h.c.__psLibEpoch++;h.resolve();await tick();await tick();
  assert.deepEqual(h.c.__psLibCache.map(d=>d.libId),['old']);assert.equal(h.c.__psLibPending,null);
});
test('the library picker waits for a running refresh, and every board library write leaves the signal',()=>{
  assert.match(part(P,'window.wkbdLibPick=function(di,li){','var all=libDrills();'),/if\(__psLibPending\)\{ var __pp=__psLibPending; __pp\.then\(function\(\)\{ wkbdLibPick\(di,li\); \}\); return; \}/);
  const writes=B.split('\n').filter(l=>/await libWrite\(/.test(l));
  assert.ok(writes.length>=6);
  writes.forEach(l=>{ if(/function libWrite/.test(l))return; const ok=/libTouch\(\)/.test(l)||/VAULT_REC|await libWrite\(lib\);$/.test(l.trim());
    assert.ok(ok,'libTouch 없는 보관함 쓰기: '+l.trim().slice(0,90)); });
});
