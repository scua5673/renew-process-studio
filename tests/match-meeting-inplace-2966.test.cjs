'use strict';
/* 2.966 — 경기 준비 안에서 미팅을 바로 만들고 고친다.
   «＋ 새 미팅» = 시트 없이 한 번에(기본 9장 + 선발 11) · 편집기는 보관함 것 하나를 팀 탭 아래에 · «완료» = 경기 준비의 같은 자리. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
const board=read('board.html'),scout=read('scout.html'),app=read('app.html');
function fnAt(src,start){ const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1); }

test('«＋ 새 미팅»은 시트를 거치지 않고 바로 만든다 — 선발 명단이 있으면 선발 11 이 BEST 11 자리', ()=>{
  const sent=[];
  const ctx=vm.createContext({JSON,Math,Date,sent,toast:m=>sent.push({toast:m}),mmVS:{}});
  vm.runInContext([
    'var can=true,leave=true,team=true;',
    'function mmCanLib(){return can;} function matchCanLeaveWork(){return leave;} function mmIsTeamWs(){return team;}',
    'function mmRefOf(m){return {mid:String(m.id),opp:String(m.opponent||"")};}',
    'function mmPost(msg){sent.push(msg);}',
    'var XI=null; function matchMeetParts(m){ return [{key:"cover",label:"표지",ok:true,detail:"",slides:[{title:"vs A"}]},{key:"xi",label:"선발 11",ok:!!XI,detail:"",slides:XI?[XI]:[]},{key:"plan",label:"게임플랜",ok:false,detail:"",slides:[]}]; }',
    fnAt(scout,'function mmPartsLite(parts)'),'var mmCreateAt=0;',fnAt(scout,'function mmCreateNow(m)'),
    'this.go=function(m){mmCreateAt=0;mmCreateNow(m);}; this.goRaw=function(m){mmCreateNow(m);}; this.set=function(k,v){ if(k==="xi")XI=v; if(k==="can")can=v; if(k==="team")team=v; };'
  ].join('\n'),ctx);
  ctx.go({id:'m1',opponent:'송도FC'});
  let p=sent.pop();
  assert.equal(p.type,'meetingFromMatch');assert.equal(p.inplace,true,'경기 준비 안에서 연다');
  assert.equal(p.payload.name,'송도FC전 미팅');assert.equal(p.payload.template,true,'기본 9장');
  assert.equal(p.payload.skipBest,false);assert.equal(p.payload.slides.length,0,'선발 명단이 없으면 기본 9장만');
  assert.equal(p.payload.shared,true,'팀 공간이면 팀 공유');
  assert.deepEqual(JSON.parse(JSON.stringify(p.payload.parts.map(x=>x.key))),['cover','xi','plan'],'«경기 자료 넣기» 재료를 같이 보낸다(기본 9장 표식은 빼고)');
  assert.ok(ctx.mmVS.m1.wantAfter>0,'돌아오면 새 미팅을 띄운다');
  ctx.set('xi',{title:'선발 11 · 4-3-3',us:[{x:1,y:2}]});
  ctx.go({id:'m1',opponent:''});p=sent.pop();
  assert.equal(p.payload.skipBest,true,'선발 11 을 넣으면 BEST 11 은 뺀다');assert.equal(p.payload.slides.length,1);assert.equal(p.payload.name,'상대전 미팅');
  ctx.goRaw({id:'m1',opponent:'B'});assert.equal(sent.length,0,'2.5초 안에 다시 눌러도 둘이 생기지 않는다');
  ctx.set('can',false);ctx.go({id:'m1'});assert.ok(sent.pop().toast,'권한이 없으면 말한다');
  assert.match(scout,/if\(b\.hasAttribute\("data-mm-new"\)\)\{ mmCreateNow\(cur\); return; \}/,'«＋ 새 미팅» 버튼이 시트 대신 바로 만들기');
  assert.match(fnAt(scout,'function mmOpen(libId,show)'),/inplace:true,parts:/,'편집·슬라이드쇼도 경기 준비 안에서');
});

test('셸 — 경기 준비 안 편집은 팀 화면으로 친다, 다른 곳으로 가면 내려놓는다', ()=>{
  const sa=fnAt(app,'function showApp(app)');
  assert.match(sa,/\(app==='design'&&document\.body\.classList\.contains\('ps-match-edit'\)\)/,'팀 머리·팀 탭이 남는다');
  assert.match(sa,/if\(app==='design'&&!document\.body\.classList\.contains\('ps-match-edit'\)\)\{try\{var _vw0/,'보관함 목록으로 갈아끼우지 않는다');
  assert.ok(sa.indexOf("ps-match-edit")<sa.indexOf('closeTransientUI(app)'),'맨 앞에서 표식 정리');
  assert.match(sa,/type:'matchEditEnd'/,'다른 화면으로 가면 편집기에 알린다');
  const en=fnAt(app,'function psMatchEditEnter()');
  assert.match(en,/currentTeamKey=currentTeamKey\|\|'match'/);assert.match(en,/window\.__psMatchEditing=true; try\{ showApp\('design'\); \}finally\{ window\.__psMatchEditing=false; \}/);
  const dn=fnAt(app,'function psMatchEditDone(d)');
  assert.match(dn,/if\(!was&&!d\.force\)return;/,'이미 다른 화면이면 끌고 오지 않는다');
  assert.match(dn,/showApp\('scout'\)/,'경기 화면을 그대로 다시 보인다(setView 하지 않음 — 스크롤·열린 경기 유지)');
  assert.doesNotMatch(dn,/setView|openMatchAt|teamHub/);
  assert.match(app,/body\.ps-match-edit \.team-bottom,body\.ps-match-edit \.team-more\{display:none!important\}/,'폰은 팀 하단 탭을 접는다');
});

test('보관함 편집기 — 경기 준비 안이면 닫기가 경기 준비로 돌아간다, 보관함 목록으로 가지 않는다', ()=>{
  const close=fnAt(board,'function doViewClose()');
  const i=close.indexOf('_toMatch=meetMatchInplaceNow()'),j=close.indexOf("type:'goApp',app:'design'");
  assert.ok(i>0&&i<j,'보관함으로 가는 길보다 먼저 본다');
  assert.match(close,/meetMatchDonePost\(_fm,false\); return; \}/);
  assert.match(close,/window\.__vaultAutoSaveFlush&&window\.__vaultAutoSaveFlush\(\)/,'자동 저장을 마무리하고 닫는다');
  const bar=fnAt(board,'function matchBarSync(inp,fm)');
  assert.match(bar,/cb\.textContent=window\.__vaultReadOnly\?"닫기":\(manual\?"나가기":"완료"\)/,'미팅은 «완료», 작전판은 저장 버튼이 따로');
  assert.match(fnAt(board,'function hideCreateBar()'),/classList\.remove\("vc-match"\)/);
  const fm=fnAt(board,'window.__meetingFromMatch=function(p)');
  assert.match(fm,/inplace:_inp,parts:Array\.isArray\(p\.parts\)\?p\.parts:null,name:item\.name/);
  assert.equal((fm.match(/_fail\(\)/g)||[]).length,4,'실패(로그인·자료 없음·쓰기 실패)하면 경기 준비로 돌려보낸다');
});

test('«경기 자료 넣기» — 고른 재료를 지금 미팅 뒤에 붙이고, 맨 위 문구·방향을 이어받는다', ()=>{
  const added=[];let went=null,saved=0;
  const slides=[{pdfOrientation:'portrait',pageBrand:'프로세스FC',textStyles:{brand:{size:20}},snap:{},thumb:'t',title:'BEST 11',points:[]}];
  const ctx=vm.createContext({JSON,Math,window:{__meet:{frames:()=>slides,go:(i)=>{went=i;}},__meetCap:()=>({orientation:'v'}),__snapToThumb:()=>'<svg/>',__vaultAutoSaveSchedule:()=>{saved++;}},toast:()=>{}});
  vm.runInContext('function curType(){return "meeting";} function meetBaseSnap(){return {orientation:"h",players:[]};} function meetSnapFromPct(base,sp){ return {snap:Object.assign({},base,{n:(sp.us||[]).length}),skipped:sp.bad||0}; }'
    +fnAt(board,'function meetInsertSlides(src)')+';this.ins=meetInsertSlides;',ctx);
  ctx.ins([{title:'vs 송도',points:['10/10 토',' ','홈'],us:[]},{title:'게임플랜',points:[],us:[{},{}],bad:1}]);
  assert.equal(slides.length,3);assert.equal(went,1,'넣은 첫 장으로 간다');assert.equal(saved,1,'보관함에 자동 저장');
  assert.equal(slides[1].pageBrand,'프로세스FC','맨 위 문구는 모든 장에(2.960)');assert.equal(slides[1].pdfOrientation,'portrait');
  assert.equal(slides[1].snap.orientation,'v','미팅 방향을 따른다(2.932)');assert.deepEqual(JSON.parse(JSON.stringify(slides[1].points)),['10/10 토','홈']);assert.equal(slides[2].snap.n,2);
});
