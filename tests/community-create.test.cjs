'use strict';
/* 2.924 — 커뮤니티 «올리기» = 두 갈래(보관함에서 고르기 / 새로 만들기).
   새로 만들기 → 셸이 일정과 같은 새 훈련 편집기를 열고, 저장하면 커뮤니티로 돌아와
   보관함 쓰기가 끝난 신호(captureSaved)를 받은 뒤 그 훈련을 고른 채 올리기 창(openUpload + libId)을 연다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
const app=read('app.html'),comm=read('community.html'),board=read('board.html');

function shellRelay(){
  const a=app.indexOf('    var commCreatePending=false,commCreateT=null;'),b=app.indexOf('    /* 2.746',a);
  assert.ok(a>0&&b>a,'셸 도우미 구간');
  const sent=[],shown=[],timers=[];
  const fComm={contentDocument:{readyState:'complete'},contentWindow:{postMessage:m=>sent.push(m)},addEventListener(){}};
  const ctx=vm.createContext({fComm,showApp:x=>shown.push(x),currentTeamKey:'squad',
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].fn=null;}});
  vm.runInContext(app.slice(a,b)+';this.api={back:commCreateBack,send:commSendUpload,pending:()=>commCreatePending,setPending:v=>{commCreatePending=v;}};',ctx);
  const flush=()=>{while(timers.length){const t=timers.shift();if(t.fn)t.fn();}};
  return {api:ctx.api,get sent(){return JSON.parse(JSON.stringify(sent));},shown,ctx,flush,timers};   /* vm 안 객체는 원형이 달라 JSON 으로 견준다 */
}

test('저장하고 돌아오면 커뮤니티를 보여 주고, 저장 신호가 오면 그 훈련을 고른 올리기 창',()=>{
  const s=shellRelay();
  s.api.back(true);
  assert.deepEqual(s.shown,['community']);assert.equal(s.ctx.currentTeamKey,'');assert.equal(s.api.pending(),true);
  /* captureSaved 처리: 셸 본문과 같은 순서 — 대기 해제 → 타이머 지움 → 올리기 창 */
  assert.match(app,/d\.type==='captureSaved'\)\{\s*if\(commCreatePending\)\{ commCreatePending=false; if\(commCreateT\)\{clearTimeout\(commCreateT\);commCreateT=null;\} commSendUpload\(d\.libId\|\|null\); \}/);
  s.api.setPending(false);s.api.send('Lnew1');
  s.flush();
  assert.deepEqual(s.sent,[{type:'openUpload',libId:'Lnew1'}],'8초 대체 타이머는 이미 대기가 풀려 아무것도 안 보낸다');
});
test('저장 신호가 끝내 오지 않으면 8초 뒤 고르지 않은 올리기 창 하나',()=>{
  const s=shellRelay();s.api.back(true);
  assert.equal(s.timers.some(t=>t.ms===8000),true);
  s.flush();
  assert.deepEqual(s.sent,[{type:'openUpload',libId:null}]);assert.equal(s.api.pending(),false);
});
test('취소하면 커뮤니티로만 — 올리기 창을 열지 않는다',()=>{
  const s=shellRelay();s.api.back(false);s.flush();
  assert.deepEqual(s.shown,['community']);assert.deepEqual(s.sent,[]);assert.equal(s.api.pending(),false);
});
test('셸: 커뮤니티 프레임이 보낸 요청만 받고, 결과는 일정(boardResult)으로 새지 않는다',()=>{
  assert.match(app,/d\.source==='community' && d\.type==='openDrillEditor' && fComm && e\.source===fComm\.contentWindow\)\{[\s\S]{0,200}captureReq='community';/);
  assert.match(app,/__psPreselectPhases=null; fBoard\.contentWindow\.__openScheduleDrill/,'일정 보강 추천의 국면 미리 고르기가 새지 않게');
  assert.match(app,/d\.type==='capture'\)\{\s*if\(captureReq==='community'\)\{ commCreateBack\(true\); return; \}/);
  assert.match(app,/d\.type==='captureCancel'\)\{\s*if\(captureReq==='community'\)\{ commCreateBack\(false\); return; \}/);
});
test('작전판: 새 훈련 저장이 보관함 번호를 돌려주고, 쓰기가 끝난 뒤 captureSaved 로 알린다',async()=>{
  const i=board.indexOf('async function saveToLib(d){'),j=board.indexOf('\n',board.indexOf('return copy.libId;}',i));
  const lib=[];let writes=0;
  const ctx=vm.createContext({psVaultRequireLogin:()=>true,libGet:async()=>lib,dc:x=>JSON.parse(JSON.stringify(x)),stampCreator(){},
    libWrite:async()=>{writes++;},libTouch(){},renderLibDock(){},toast(){},Date,Math});
  vm.runInContext(board.slice(i,j)+';this.saveToLib=saveToLib;',ctx);
  const id=await ctx.saveToLib({name:'4v2 론도'});
  assert.match(id,/^L/);assert.equal(lib[0].libId,id);assert.equal(writes,1);
  ctx.psVaultRequireLogin=()=>false;
  assert.equal(await vm.runInContext('saveToLib({name:"x"})',ctx),false,'로그인 전에는 저장도 번호도 없다');
  assert.match(board,/_schedSavePr=saveToLib\(_nd\);_schedND=_nd;/);
  assert.match(board,/Promise\.resolve\(_schedSavePr\)\.then\(function\(lid\)\{ if\(lid\)\{ try\{parent\.postMessage\(\{source:'board',type:'captureSaved',libId:lid\},'\*'\);/);
});
test('커뮤니티: 앱 안에서만 두 갈래 — 단독 페이지는 예전처럼 바로 올리기 창',()=>{
  assert.match(comm,/var IN_SHELL=\(window\.parent!==window\);/);
  assert.match(comm,/\$\('upBtn'\)\.onclick=function\(e\)\{ if\(!IN_SHELL\)\{openUpload\(\);return;\}/);
  assert.match(comm,/id="upFromLib"[\s\S]{0,400}보관함에서 고르기/);
  assert.match(comm,/id="upNew"[\s\S]{0,400}새로 만들기/);
  const fn=comm.slice(comm.indexOf('function communityCreateNew(){'),comm.indexOf('$(\'upBtn\').setAttribute(\'aria-haspopup\''));
  assert.match(fn,/if\(!communityLibraryRequireUnlocked\(true\)\)return;/,'로그인·자료 준비 전에는 편집기를 열지 않는다');
  assert.match(fn,/postMessage\(\{source:'community',type:'openDrillEditor'\},'\*'\)/);
});
test('커뮤니티: 빈 보관함과 «훈련 선택» 줄에도 만들기 문 — 막다른 길 없음',()=>{
  assert.match(comm,/<button class="btn primary" id="upNewEmpty">＋ 새로 만들기<\/button>/);
  assert.match(comm,/if\(\$\('upNewEmpty'\)\)\$\('upNewEmpty'\)\.onclick=communityCreateNew;/);
  assert.match(comm,/id="upNewInline">＋ 새로 만들기<\/button>/);
  assert.doesNotMatch(comm,/<label>훈련 선택<\/label>/,'라벨 안 버튼은 라벨 글자 클릭에도 눌린다 — div 줄로');
});
