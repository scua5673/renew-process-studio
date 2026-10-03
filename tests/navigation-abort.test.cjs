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

/* 2026-10-02 — 길 B: 내려가는 문서가 새로 시작해 네트워크에 나가지 않은 요청(request·requestfailed 0).
   main CI 를 멈춘 gamemodel-anim(ps_sync_report_put, 잘린 모양)이 이것이었다. */
const B='http://127.0.0.1:33535',RU=B+'/rest/v1/rpc/ps_sync_report_put';
const TRUNC=u=>u.replace(/^https?:\//,'')+' due to access control checks.';   // Playwright 가 첫 콜론에서 자른 모양
const navReq=(url,frame)=>({url:()=>url,isNavigationRequest:()=>true,frame:()=>frame,failure:()=>null});
const subReq=url=>({url:()=>url,isNavigationRequest:()=>false,frame:()=>null,failure:()=>null});
function reloadStarted(p,frame){p.emit('request',navReq(B+'/studio/app.html',frame));}
test('B: a same-origin fetch refused while the document unloads is marked (truncated form)',()=>{
  const p=fakePage(),logs=[],main={};const n=track(p,logs);
  reloadStarted(p,main);
  logs.push({type:'pageerror',at:Date.now(),text:TRUNC(RU)});n.reclassify();
  assert.equal(logs[0].type,'pageerror-navabort');assert.equal(logs[0].navabortPath,'B');
  p.emit('framenavigated',main);
  assert.equal(logs[0].type,'pageerror-navabort','커밋 뒤에도 그대로');
  assert.equal(n.isAbort(MSG(RU),Date.now()),true,'온전한 모양도');
});
test('B: the error may arrive just after the commit, but not long after',()=>{
  const p=fakePage(),main={};const n=track(p,null);
  reloadStarted(p,main);p.emit('framenavigated',main);
  assert.equal(n.isAbort(TRUNC(RU),Date.now()+1000),true,'커밋 1초 뒤');
  assert.equal(n.isAbort(TRUNC(RU),Date.now()+5000),false,'커밋 5초 뒤는 이동과 무관');
});
test('B: outside any navigation window it stays an error',()=>{
  const p=fakePage(),main={};const n=track(p,null);
  const before=Date.now()-1;reloadStarted(p,main);
  assert.equal(n.isAbort(TRUNC(RU),before-3000),false,'이동 전');
  const p2=fakePage(),n2=track(p2,null);p2.emit('request',subReq(B+'/studio/app.html'));
  assert.equal(n2.isAbort(TRUNC(RU),Date.now()),false,'이동 요청이 아니면 구간이 없다');
  assert.equal(typeof n2.judge(TRUNC(RU),Date.now()).why,'string','남는 오류에는 이유가 붙는다');
});
test('B: a cross-origin URL is never treated as a navigation trace',()=>{
  const p=fakePage(),main={};const n=track(p,null);reloadStarted(p,main);
  assert.equal(n.isAbort(MSG('http://localhost:9/rest/v1/rpc/ps_sync_report_put'),Date.now()),false,'다른 출처는 CORS 일 수 있다');
  assert.equal(n.isAbort(TRUNC('https://api.example.invalid/x'),Date.now()),false);
});
test('B: a request that actually went out is judged by path A only',()=>{
  const p=fakePage(),main={};const n=track(p,null);reloadStarted(p,main);
  const r=subReq(RU);p.emit('request',r);
  assert.equal(n.isAbort(TRUNC(RU),Date.now()),false,'나가 있던 요청은 B 로 안 본다');
  p.emit('requestfailed',{...r,failure:()=>({errorText:'Load request cancelled'})});
  assert.equal(n.isAbort(TRUNC(RU),Date.now()),true,'취소로 끝나면 A');
});
test('a real CORS failure is never hidden, by either path, even mid-navigation',()=>{
  for(const text of ['Preflight response is not successful. Status code: 403','Request header field Content-Type is not allowed by Access-Control-Allow-Headers.','Origin http://127.0.0.1:1 is not allowed by Access-Control-Allow-Origin. Status code: 200']){
    const p=fakePage(),logs=[],main={};const n=track(p,logs);reloadStarted(p,main);
    logs.push({type:'pageerror',at:Date.now(),text:TRUNC(RU)});n.reclassify();
    assert.equal(logs[0].type,'pageerror-navabort','실패 문장이 오기 전에는 B');
    p.emit('requestfailed',req(RU,text));p.emit('framenavigated',main);
    assert.equal(logs[0].type,'pageerror',text+' — 뒤에 온 CORS 실패가 판정을 되돌린다');
    assert.match(logs[0].navabortWhy,/CORS/);
  }
});
test('B: a cross-origin API the test itself fulfils counts only when declared (apiOrigins)',()=>{
  const API='https://synthetic-auth.invalid',AU=API+'/auth/v1/user',main={};
  const p=fakePage(),n=track(p,null,{apiOrigins:[API]});reloadStarted(p,main);
  assert.equal(n.isAbort(TRUNC(AU),Date.now()),true,'밝힌 출처(잘린 모양)');
  assert.equal(n.isAbort(MSG(AU),Date.now()),true,'밝힌 출처(온전한 모양)');
  assert.equal(n.isAbort(MSG('https://other.invalid/auth/v1/user'),Date.now()),false,'밝히지 않은 출처');
  const p2=fakePage(),n2=track(p2,null);reloadStarted(p2,main);
  assert.equal(n2.isAbort(TRUNC(AU),Date.now()),false,'선언이 없으면 다른 출처는 오류');
  p.emit('requestfailed',req(AU,'Preflight response is not successful. Status code: 403'));
  assert.equal(n.isAbort(TRUNC(AU),Date.now()),false,'밝힌 출처라도 CORS 실패가 있으면 오류');
});
