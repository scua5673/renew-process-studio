'use strict';
/* 3.057 — 아이패드 사파리에서 IndexedDB 열기가 성공도 오류도 없이 멈추면 보관함 · 동기화 · «진단»이 끝없이 기다렸다
   (풋볼A 아이패드 — «진단» 줄이 «확인 중…», 자동 저장 «기기 저장을 확인해 주세요»).
   열기를 기다리는 동안 indexedDB.databases() 로 깨우고, OPEN_TIMEOUT 안에 안 열리면 TimeoutError 로 끝낸 뒤 다음 요청이 새로 연다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8');
const code=source.slice(source.indexOf('  function open(){'),source.indexOf('  function idbKeys('));
function fixture(){
  const requests=[],timers=[],intervals=[],diag=[];let pokes=0;
  const c=vm.createContext({Promise,Error,DB:'test',VER:1,STORE:'kv',dbp:null,OPEN_TIMEOUT:10000,POKE_MS:150,
    indexedDB:{open(){const r={};requests.push(r);return r;},databases(){pokes++;return Promise.resolve([]);}},
    setTimeout(fn,ms){const t={fn,ms,on:true};timers.push(t);return t;},clearTimeout(t){if(t)t.on=false;},
    setInterval(fn,ms){const t={fn,ms,on:true};intervals.push(t);return t;},clearInterval(t){if(t)t.on=false;},
    isQuotaErr:()=>false,diagnostic(stage,e){diag.push([stage,e&&e.name]);}});
  vm.runInContext(code,c);
  function ready(){const r=requests.at(-1),db={close(){db.closed=true;},transaction(){const t={error:null,objectStore(){return {get(){const q={result:'v'};queueMicrotask(()=>t.oncomplete());return q;}};}};return t;}};r.result=db;r.onsuccess();return db;}
  return {c,requests,timers,intervals,diag,ready,get pokes(){return pokes;}};
}
test('a hung open times out with a named TimeoutError, is logged, and the next request opens fresh',async()=>{
  const h=fixture(),a=h.c.open();
  assert.equal(h.timers.length,1);assert.equal(h.timers[0].ms,10000);
  assert.equal(h.intervals.length,1,'기다리는 동안 databases() 로 깨운다');
  h.intervals[0].fn();h.intervals[0].fn();assert.equal(h.pokes,2);
  h.timers[0].fn();
  await assert.rejects(a,{name:'TimeoutError'});
  assert.deepEqual(h.diag,[['idb-open-timeout','TimeoutError']]);
  assert.equal(h.intervals[0].on,false,'멈추면 깨우기도 그친다');
  const late=h.requests[0];late.result={close(){late.closed=true;}};late.onsuccess();
  assert.equal(late.closed,true,'늦게 열린 연결은 닫는다');
  const b=h.c.open();assert.equal(h.requests.length,2,'다음 요청은 새로 연다');h.ready();await b;
});
test('a normal open clears its timer and poke so nothing fires later',async()=>{
  const h=fixture(),a=h.c.open();h.ready();await a;
  assert.equal(h.timers[0].on,false);assert.equal(h.intervals[0].on,false);assert.deepEqual(h.diag,[]);
});
test('a timed-out read is retried once on a fresh connection',async()=>{
  const h=fixture(),p=h.c.idbGet('k');
  await new Promise(r=>setImmediate(r));
  h.timers[0].fn();
  await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  assert.equal(h.requests.length,2,'읽기는 새 연결로 한 번 더');
  h.ready();assert.equal(await p,'v');
});
test('the timeout is wired in storage.js with the iPad note',()=>{
  assert.match(source,/OPEN_TIMEOUT=10000, POKE_MS=150;/);
  assert.match(source,/var e=new Error\('IndexedDB open timed out'\);e\.name='TimeoutError';/);
  assert.match(source,/function transientIdb\(e\)\{return !!\(e&&\/\^\(AbortError\|TimeoutError\|/,'TimeoutError 는 읽기를 한 번 더 하는 일시적 오류');
});
