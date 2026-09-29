'use strict';
/* 2.912 — 브라우저 테스트의 WebKit «이동으로 끊긴 fetch» 흔적 판별(tests/fixtures/navigation-abort.mjs). 진짜 오류를 가리면 안 된다. */
const test=require('node:test'),assert=require('node:assert/strict');
function fakePage(){ const h={}; return {on:(ev,fn)=>{(h[ev]=h[ev]||[]).push(fn);},emit:(ev,x)=>(h[ev]||[]).forEach(f=>f(x))}; }
const req=(url,text)=>({url:()=>url,failure:()=>({errorText:text})});
const MSG=u=>'Fetch API cannot load '+u+' due to access control checks.';
const U='http://127.0.0.1:39287/rest/v1/ps_events';
let track;
test.before(async()=>{ ({trackNavigationAborts:track}=await import('./fixtures/navigation-abort.mjs')); });

test('fetch cut by a navigation is marked, not dropped',()=>{
  const p=fakePage(),logs=[];const n=track(p,logs);
  logs.push({type:'pageerror',at:Date.now(),text:MSG(U)});
  p.emit('requestfailed',req(U,'The network connection was lost.'));p.emit('framenavigated',{});
  assert.equal(logs[0].type,'pageerror-navabort');assert.equal(logs.length,1,'기록은 남는다');
  assert.equal(n.isAbort(MSG(U),Date.now()),true);
});
test('a cancelled request is an abort even without a navigation event',()=>{
  const p=fakePage(),n=track(p,null);p.emit('requestfailed',req(U,'cancelled'));
  assert.equal(n.isAbort(MSG(U),Date.now()),true);
});
test('a real CORS rejection is never hidden',()=>{
  const p=fakePage(),n=track(p,null);p.emit('requestfailed',req(U,'Origin http://127.0.0.1:1 is not allowed by Access-Control-Allow-Origin.'));p.emit('framenavigated',{});
  assert.equal(n.isAbort(MSG(U),Date.now()),false);
});
test('same message with no failed request, another URL, or no navigation stays an error',()=>{
  const p=fakePage(),n=track(p,null);
  assert.equal(n.isAbort(MSG(U),Date.now()),false,'요청 실패 기록 없음');
  p.emit('requestfailed',req(U+'x','Load failed'));p.emit('framenavigated',{});
  assert.equal(n.isAbort(MSG(U),Date.now()),false,'다른 주소');
  const p2=fakePage(),n2=track(p2,null);p2.emit('requestfailed',req(U,'Load failed'));
  assert.equal(n2.isAbort(MSG(U),Date.now()),false,'이동과 무관한 실패');
  assert.equal(n2.isAbort('TypeError: x is undefined',Date.now()),false,'다른 오류');
});
