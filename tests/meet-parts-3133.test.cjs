'use strict';
// 3.133 — 사용자 «보관함에서 미팅 자료 만들기 들어가면 상대분석과 경기준비 페이지를 따로 따로 만들어서 팀운영 경기 페이지에 붙힐수 있게».
// 자료 종류(보관함 태그) · 상대 분석 6장 틀 · 경기 화면의 칸 나누기. 화면 흐름은 tests/browser/match-meet-parts.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../studio/board-meet-form.js');
const P=require('../studio/match-meet-parts.js');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('종류 = 보관함 태그 이름 · 두 파일이 같은 이름',()=>{
  assert.deepEqual(F.KINDS,[['prep','경기 준비'],['opp','상대 분석']]);
  assert.deepEqual(F.KIND_TAG,{prep:'경기 준비',opp:'상대 분석'});
  assert.deepEqual(P.TAG,F.KIND_TAG);
});

test('상대 분석 6장은 경기 상대 분석의 국면 차례 · 메모 칸',()=>{
  const s=read('studio/scout.html');
  assert.match(s,/var MB2_STD_PHASES=\[\["atk","공격 시"\],\["def","수비 시"\],\["ta","수비→공격 전환"\],\["td","공격→수비 전환"\],\["set","세트피스"\]\];/,'경기 상대 분석의 국면');
  assert.deepEqual(F.OPP_TPL.map(e=>e.note),['sum','atk','def','ta','td','set']);
  assert.deepEqual(F.OPP_TPL.slice(1).map(e=>e.t),['상대 공격 시','상대 수비 시','상대 수비→공격','상대 공격→수비','상대 세트피스']);
  const n=P.oppNotes({oppConclusion:'결론 한 줄',oppStrengths:'a\nb',oppAttack:' 공격 1 \n\n공격 2',oppDefense:'',oppAttackTransition:'역습',oppDefenseTransition:'되찾기',oppSetPlay:'코너'});
  assert.deepEqual(n,{sum:['결론 — 결론 한 줄','강점 — a · b'],atk:['공격 1','공격 2'],def:[],ta:['역습'],td:['되찾기'],set:['코너']});
  // 경기 문서 칸 이름 = scout.html 의 상대 분석 칸
  ['oppConclusion','oppStrengths','oppWeaknesses','oppKeyPlayers','oppAttack','oppDefense','oppAttackTransition','oppDefenseTransition','oppSetPlay'].forEach(k=>assert.ok(s.includes('m.'+k),k));
});

test('상대 BEST — 우리 BEST 를 상대 포메이션으로 바꿔 운동장 가운데로 뒤집는다',()=>{
  const FORM={'433':[[.05,.5,1,'GK'],[.2,.2,2,'LB'],[.2,.4,3,'LCB'],[.2,.6,4,'RCB'],[.2,.8,5,'RB'],[.3,.5,6,'DM'],[.33,.3,7,'LCM'],[.33,.7,8,'RCM'],[.42,.2,9,'LW'],[.45,.5,10,'ST'],[.42,.8,11,'RW']],
    '442':[[.05,.5,1,'GK'],[.2,.2,2,'LB'],[.2,.4,3,'LCB'],[.2,.6,4,'RCB'],[.2,.8,5,'RB'],[.32,.2,6,'LM'],[.32,.4,7,'LCM'],[.32,.6,8,'RCM'],[.32,.8,9,'RM'],[.43,.4,10,'ST'],[.43,.6,11,'ST']]};
  const g={mpp:10,cx:555,cy:370},L=555-525,T=370-340,pt=(u,v)=>({x:L+u*1050,y:T+v*680});
  const best={pitchSpec:'fifa',players:FORM['433'].map((e,i)=>Object.assign({id:i+1,team:'blue',num:String(e[2]),pos:e[3]},pt(e[0],e[1]))),ball:null};
  const list=[{title:'BEST 11',raw:best,snap:best},{title:'미드블록',raw:best,snap:best},{title:'코너킥 수비',raw:best,snap:best}];
  const out=F.oppSlides(list,{us:'433',op:'433'},'11',g,FORM);
  assert.deepEqual(out.map(e=>e.title),['상대 BEST 11','상대 공격 시','상대 세트피스'],'없는 장은 건너뛴다');
  const red=out[0].snap.players;
  assert.ok(red.every(p=>p.team==='red'),'상대 팀만');assert.equal(red.length,11);
  const gk=red.find(p=>p.pos==='GK'),bgk=best.players.find(p=>p.pos==='GK');
  assert.equal(gk.x,2*g.cx-bgk.x,'가운데로 뒤집기(골키퍼 오른쪽)');assert.equal(gk.y,2*g.cy-bgk.y);
  assert.equal(out[0].snap.ball,null);
  assert.equal(best.players[0].team,'blue','원본 판은 그대로');
});

test('경기 화면은 태그로 칸을 나눈다 — 태그 없는 옛 자료는 경기 준비',()=>{
  const lib=[{libId:'a',type:'meeting',tags:['상대 분석']},{libId:'b',type:'meeting',tags:[]},{libId:'c',type:'board'},{libId:'d',type:'meeting',tags:['경기 준비','상대 분석']},{libId:'e',type:'drill',tags:['상대 분석']}];
  assert.deepEqual(P.filterLib(lib,'opp').map(d=>d.libId),['a','d','e'],'미팅 · 작전판이 아닌 것은 건드리지 않는다');
  assert.deepEqual(P.filterLib(lib,'prep').map(d=>d.libId),['b','c','e']);
  assert.equal(P.partOf({tags:['상대 분석']}),'opp');assert.equal(P.partOf({}),'prep');
});

test('board.html — 경기 미팅이 태그 · 장 메모를 받는다(두 곳만)',()=>{
  const b=read('studio/board.html');
  assert.ok(b.includes('slides:slides,tags:p.tags||[],savedAt:Date.now()};'),'자료 태그');
  assert.ok(b.includes('title:t.title,points:t.points||[]}); });'),'기본 장의 메모');
  const m=read('studio/board-meet-form.js');
  assert.match(m,/p\.tags = \[KIND_TAG\[kind\]\];/);assert.match(m,/var kind = p\.part === 'opp' \? 'opp' : 'prep';/);
  assert.match(m,/function tagPending\(kind\)/,'보관함 새 미팅 — 저장 창에 미리');
});

test('경기 화면 모듈은 scout.html 뒤에서 읽히고 앱이 오프라인에도 싣는다',()=>{
  const s=read('studio/scout.html');
  assert.ok(s.includes('<script src="perms.js"></script><script src="match-meet-parts.js"></script>'));
  assert.ok(s.indexOf('function mmPaint(')<s.indexOf('<script src="match-meet-parts.js">'),'감쌀 함수보다 뒤에서 읽는다');
  assert.ok(read('sw.js').includes("'/studio/match-meet-parts.js'"));
  ['mmPaint','mmCreateNow','mmLinkSheet','mmPost','matchRenderMeetings','mmLinkable','mmLoadLib','mmSheet','mmSlidesOf','mmMine','mmRefOf','mmCanLib','mmMyUid','mmIsTeamWs','mmDateLabel','matchCarryLines']
    .forEach(fn=>assert.match(s,new RegExp('\\nfunction '+fn+'\\('),fn+' 는 function 선언(window 속성)'));
  assert.match(s,/<section class="match-card match-card-wide mm-card" id="matchMeetCard" hidden>/);
  assert.match(s,/<div class="match-panel" id="matchOppPanel">\s*<div class="match-grid">/);
  assert.match(s,/let matchState=null,matchCurrent="",matchTab="prep",matchStage="prep"/,'matchStage 는 let 전역(이름으로 읽는다)');
});
