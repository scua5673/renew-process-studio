'use strict';
/* 2.912 — 브라우저 테스트의 WebKit «이동으로 끊긴 fetch» 흔적 판별(tests/fixtures/navigation-abort.mjs). 진짜 오류를 가리면 안 된다. */
const test=require('node:test'),assert=require('node:assert/strict');
function fakePage(){ const h={}; return {on:(ev,fn)=>{(h[ev]=h[ev]||[]).push(fn);},emit:(ev,x)=>(h[ev]||[]).forEach(f=>f(x))}; }
const req=(url,text)=>({url:()=>url,failure:()=>({errorText:text})});
const MSG=u=>'Fetch API cannot load '+u+' due to access control checks.';
const U='http://127.0.0.1:39287/rest/v1/ps_events';
let track,pageErrorEntry,LOG_TEXT_MAX;
test.before(async()=>{ ({trackNavigationAborts:track,pageErrorEntry,LOG_TEXT_MAX}=await import('./fixtures/navigation-abort.mjs')); });

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

/* 3.012 — team-app 은 기록 text 를 500자로 자른다. 선수단 키를 묶은 긴 ps_kv 주소는 «… due to access control checks.» 꼬리가 잘려
   판정에서 빠졌다(PR #374 WebKit board-settings-manual). 판정은 잘리지 않은 원문(raw)으로 한다. */
test('a long URL cut in the log text is still judged from the raw message',()=>{
  const p=fakePage(),logs=[],LU=B+'/rest/v1/ps_kv?workspace_id=eq.a&k=in.('+Array.from({length:16},(_,i)=>'%22sq%3Avp'+String(i+1).padStart(2,'0')+'%22').join('%2C')+')&select=k,v,cupd'+'&pad='+'x'.repeat(300);
  track(p,logs);p.emit('request',navReq(B+'/studio/app.html',{}));
  const entry=pageErrorEntry(TRUNC(LU));   // team-app 과 같은 항목(text 500자 · raw 원문)
  assert.ok(!/access control checks/.test(entry.text),'the fixture: the log text lost the tail');
  logs.push(entry);p.emit('framenavigated',{});
  assert.equal(logs[0].type,'pageerror-navabort');assert.equal(logs[0].navabortPath,'B');
  assert.ok(!('raw' in JSON.parse(JSON.stringify(logs[0]))),'raw stays out of the JSON log');
});

/* 승격 PR #368 CI(run 38190376575 · WebKit identity board-settings-manual)의 주소 모양 — ps_kv 를 키 20개로 읽는다(500자 넘음).
   온전한 모양(스킴 포함)·잘린 모양(스킴 없는 split) 둘 다, 길 A·B 둘 다 원문으로 판정한다. 가드(밝히지 않은 출처 · 같은 주소의
   CORS 실패 문장)는 긴 주소에서도 그대로이고, 원문(raw)이 없는 잘린 text 는 짐작하지 않는다 — 오류로 남는다. */
const KEYS20=['cs_scout_targets_v1','scout_tool_v1','cs_scout_matches_v1','cs_scoutdb_v1',...Array.from({length:16},(_,i)=>'sq:vp'+String(i+1).padStart(2,'0'))];
const KV=o=>o+'/rest/v1/ps_kv?workspace_id=eq.6f1c2a9e-4b7d-4c3e-9a51-0d2f8e7b6c43&k=in.('+KEYS20.map(k=>'%22'+encodeURIComponent(k)+'%22').join('%2C')+')&select=k,v,cupd';
const SHAPES={full:MSG,split:TRUNC};
test('long ps_kv URL (20 keys): both shapes lose the tail in the log text and are judged from the full sentence, by path A and B',()=>{
  const LU=KV(B);
  for(const [shape,f] of Object.entries(SHAPES)){
    const cut=pageErrorEntry(f(LU));
    assert.ok(f(LU).length>LOG_TEXT_MAX&&cut.text.length===LOG_TEXT_MAX,shape+': the sentence is longer than the log text');
    assert.ok(!/access control checks\.?$/.test(cut.text),shape+': the log text lost the tail');
    const p=fakePage(),logs=[],main={};track(p,logs);reloadStarted(p,main);
    logs.push(pageErrorEntry(f(LU)));p.emit('framenavigated',main);
    assert.equal(logs[0].type,'pageerror-navabort',shape+' B');assert.equal(logs[0].navabortPath,'B');
    const p2=fakePage(),logs2=[],n2=track(p2,logs2);
    logs2.push(pageErrorEntry(f(LU)));n2.reclassify();assert.equal(logs2[0].type,'pageerror',shape+': no evidence yet');
    p2.emit('requestfailed',req(LU,'Load request cancelled'));
    assert.equal(logs2[0].type,'pageerror-navabort',shape+' A');assert.equal(logs2[0].navabortPath,'A');
  }
});
test('long ps_kv URL: the guards hold — an undeclared origin and a real CORS failure stay errors, and a cut text without raw is never guessed',()=>{
  for(const [shape,f] of Object.entries(SHAPES)){
    const p=fakePage(),logs=[],main={};track(p,logs);reloadStarted(p,main);
    logs.push(pageErrorEntry(f(KV('http://localhost:9'))));p.emit('framenavigated',main);
    assert.equal(logs[0].type,'pageerror',shape+': an undeclared origin may be a real CORS rejection');assert.match(logs[0].navabortWhy,/"sameOrigin":false/);
    const p2=fakePage(),logs2=[],n2=track(p2,logs2);reloadStarted(p2,main);
    logs2.push(pageErrorEntry(f(KV(B))));n2.reclassify();assert.equal(logs2[0].type,'pageerror-navabort',shape+': B before the failure arrives');
    p2.emit('requestfailed',req(KV(B),'Origin http://127.0.0.1:1 is not allowed by Access-Control-Allow-Origin. Status code: 200'));p2.emit('framenavigated',main);
    assert.equal(logs2[0].type,'pageerror',shape+': a later CORS failure on the same URL reverts it');assert.match(logs2[0].navabortWhy,/CORS/);
    const p3=fakePage(),logs3=[];track(p3,logs3);reloadStarted(p3,main);
    logs3.push({type:'pageerror',at:Date.now(),text:f(KV(B)).slice(0,LOG_TEXT_MAX)});p3.emit('framenavigated',main);
    assert.equal(logs3[0].type,'pageerror',shape+': without raw the cut text does not match');assert.ok(!('navabortWhy' in logs3[0]));
  }
});

/* 3.012 — WebKit «Context is stopped»: 멈춘 문서의 비동기 호출 거절. 이동 구간 안에서만 흔적이다(PR #374 oauth-same-document). */
test('S: «Context is stopped» inside a navigation window is a teardown trace, outside it stays an error',()=>{
  const p=fakePage(),logs=[],n=track(p,logs);
  assert.equal(n.isAbort('Context is stopped',Date.now()),false,'no navigation yet');
  p.emit('request',navReq(B+'/studio/app.html',{}));
  assert.equal(n.isAbort('Context is stopped',Date.now()),true);
  assert.equal(n.isAbort('InvalidStateError: Context is stopped.',Date.now()),true);
  assert.equal(n.isAbort('Context is stopped because of X',Date.now()),false,'only the exact sentence');
  logs.push({type:'pageerror',at:Date.now(),text:'Context is stopped'});p.emit('framenavigated',{});
  assert.equal(logs[0].type,'pageerror-navabort');assert.equal(logs[0].navabortPath,'S');
  assert.equal(n.isAbort('Context is stopped',Date.now()+60000),false,'long after the commit');
});

/* 3.012 — 내려가는 프레임에서 스크립트가 못 들어오면 다음 인라인 스크립트가 WebKit «Can't find variable: X» 를 남긴다(oauth-same-document:
   PSScoutStore · PSTeamLibrary). WebKit 은 끊긴 받기에 requestfailed 를 늘 내지 않아 이동 구간만 본다. 크로미움 문장(«X is not defined»)은
   받지 않는다 — 진짜 ReferenceError 는 크로미움 잡이 잡는다. */
test('R: WebKit «Can\'t find variable» counts only inside a navigation window, never the Chromium sentence',()=>{
  const MSG="Can't find variable: PSTeamLibrary";
  const p=fakePage(),n=track(p,null);
  assert.equal(n.isAbort(MSG,Date.now()),false,'outside any navigation it stays an error');
  assert.match(n.judge(MSG,Date.now()).why,/inNavWindow/,'the reason is reported');
  p.emit('request',navReq(B+'/studio/app.html',{}));
  assert.equal(n.isAbort(MSG,Date.now()),true,'during a navigation, even without a reported script failure');
  assert.equal(n.isAbort('ReferenceError: Can\'t find variable: PSScoutStore',Date.now()),true);
  assert.equal(n.isAbort("Can't find variable: PSScoutStore.idOf",Date.now()),false,'only the exact sentence');
  assert.equal(n.isAbort('PSTeamLibrary is not defined',Date.now()),false,'the Chromium sentence is never a trace');
  assert.equal(n.isAbort('ReferenceError: PSTeamLibrary is not defined',Date.now()),false);
  assert.equal(n.isAbort(MSG,Date.now()+60000),false,'long after the navigation it stays an error');
});
