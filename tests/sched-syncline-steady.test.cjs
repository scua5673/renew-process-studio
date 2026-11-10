'use strict';
// «서버 일정» 줄이 편집마다 주간 판을 밀지 않게(studio/schedule-syncline-steady.js) — 까닭이 «안 올라간 변경»뿐이면 제 줄을 차지하지 않는다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../studio/schedule-syncline-steady.js');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
const UP='이 기기에 서버로 안 올라간 변경 있음';
test('steady(): 안 올라간 변경뿐일 때만 — 다른 손쓸 일 · 결과 문구 · 평소 줄은 아니다',()=>{
  const s=(text,warns,att=true)=>api.steady({att,text,warns});
  assert.equal(s('팀 가상 FC · 서버 일정 · 방금 판 받음 · '+UP+'지금 주고받기',[UP]),true);
  assert.equal(s('서버 일정 · 3분 전 받음 · '+UP+'⟳',[UP]),true,'폰의 짧은 꼴');
  assert.equal(s('팀 X · 서버 일정 · 방금 판 받음 · A팀 조 일정만 보는 중 · '+UP,['A팀 조 일정만 보는 중',UP]),true,'조 보기 안내는 손쓸 일이 아니다');
  assert.equal(s('서버 일정 · 방금 받음⟳',[],false),false,'평소 줄');
  assert.equal(s('팀 X · 서버 일정 · 방금 판 받음 · A팀 조 일정만 보는 중',['A팀 조 일정만 보는 중']),false);
  assert.equal(s('내 작업 · 서버 일정 · 방금 판 받음 · 지금 개인 일정을 보는 중 — 팀 X 일정은 … · '+UP,['지금 개인 일정을 보는 중 — 팀 X 일정은 워크스페이스를 팀으로 전환해야 보여요',UP]),false,'개인 공간 경고');
  assert.equal(s('팀 X · 서버 일정 · 방금 판 받음 · 저장 공간이 부족해 … · '+UP,['저장 공간이 부족해 사본을 못 바꿔요 — 앱 설정 › 기기 › 안전 정리',UP]),false);
  assert.equal(s('팀 X · 아직 서버 일정을 받지 못했어요 — 컴퓨터와 같은 계정·같은 팀인지 확인해요',[]),false);
  assert.equal(s('서버에 새 판이 없어요 — 일정을 만든 컴퓨터에서 이 줄에 "안 올라간 변경 있음"이 떠 있는지 확인해요',[]),false,'단추를 누른 뒤의 결과 문구');
  assert.equal(api.steady(null),false);
});
test('본문의 문구가 이 판정과 같은 글자다(본문이 바뀌면 여기서 떨어진다)',()=>{
  assert.ok(P.includes("' · <b class=\"ss-warn\">이 기기에 서버로 안 올라간 변경 있음</b>'"));assert.ok(P.includes("' 조 일정만 보는 중</b>'"));assert.ok(P.includes("'서버 일정 · '+ago(c)+(compact?' 받음':' 판 받음')"));
  assert.ok(P.includes("try{ box.classList.toggle('att',att); }catch(_){}"));
});
test('CSS: 넓은 화면에서 평소 줄과 같은 자리 · 같은 폭 — 제 줄(100%)을 차지하지 않는다',()=>{
  assert.match(api.CSS,/@media \(min-width:901px\)\{\n[^\n]*>#schedSync:not\(\.att\),[^\n]*>#schedSync\.att\.ps-ss-steady\{flex:0 0 320px;order:-1;/);
  assert.match(api.CSS,/#schedSync\.att\.ps-ss-steady:not\(#_\)>span\{flex:0 1 auto;min-width:0;display:flex;justify-content:flex-end;overflow:hidden;white-space:nowrap\}/);
});
test('mount: 내용이 바뀔 때만 보고(childList) 클래스는 다를 때만 바꾼다 — 감시가 제 변경에 다시 돌지 않는다',()=>{
  let watched=null,cb=null,toggles=0;const cls=new Set(['att']);
  const box={classList:{contains:c=>cls.has(c),toggle(c,on){toggles++;on?cls.add(c):cls.delete(c);}},textContent:'팀 X · 서버 일정 · 방금 판 받음 · '+UP,querySelectorAll:()=>[{textContent:UP}]};
  const W={document:{getElementById:id=>id==='schedSync'?box:null,createElement:()=>({}),head:{appendChild(){}}},MutationObserver:function(f){cb=f;this.observe=(el,o)=>{watched=o;};}};
  assert.equal(api.mount(W),true);assert.deepEqual(watched,{childList:true});assert.equal(cls.has('ps-ss-steady'),true);assert.equal(toggles,1);
  cb();cb();assert.equal(toggles,1);
  cls.delete('att');box.textContent='서버 일정 · 방금 받음';box.querySelectorAll=()=>[];cb();assert.equal(cls.has('ps-ss-steady'),false);assert.equal(toggles,2);
  assert.equal(api.mount(W),false,'두 번 달지 않는다');
});
test('process.html 본문 뒤에 싣고 sw.js CORE 에 있다',()=>{
  assert.ok(P.indexOf('<script src="schedule-syncline-steady.js"')>P.indexOf('id="schedSync"'));
  assert.ok(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').includes("'/studio/schedule-syncline-steady.js'"));
});
