'use strict';
/* 2.947 — 업데이트 알림 자리: 위쪽 띠 둘(#updBanner «새 판이 있어요» · #psReleaseNotes «최근 업데이트») 대신 앱 설정 바로 위 한 칸.
   새 판 준비됨 «업데이트 ●»(psShowUpdBand 가 부른다) · 적용 뒤 7일 «새 기능» · 폰은 더보기 ● + 시트 맨 위 줄 · 선수 전용 폰만 예전 띠. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const RN=fs.readFileSync(path.join(__dirname,'../studio/release-notes.js'),'utf8');
function cut(a,b){const i=A.indexOf(a),j=A.indexOf(b,i);assert.ok(i>0&&j>i,a);return A.slice(i,j);}
test('새 판의 바뀐 것은 release-notes.js 를 실행하지 않고 첫 항목만 글자로 읽는다',()=>{
  const src=cut('  function parseFirst(txt){','  function fetchNext(){');
  const c=vm.createContext({});vm.runInContext(src+'\nthis.parseFirst=parseFirst;',c);
  const got=JSON.parse(JSON.stringify(c.parseFirst(RN)));
  const want=require('../studio/release-notes.js').entries()[0];
  assert.deepEqual(got,{id:want.id,date:want.date,title:want.title,changes:want.changes});
  assert.equal(c.parseFirst('nothing here'),null);
  assert.deepEqual(JSON.parse(JSON.stringify(c.parseFirst("var DEFAULT_ENTRIES=[{\n id:'x',date:'2026-10-07',title:'v9.9 · 선수\\'s 판',\n changes:['하나 \\'둘\\'','셋']\n },{"))),
    {id:'x',date:'2026-10-07',title:"v9.9 · 선수's 판",changes:["하나 '둘'",'셋']});
  assert.doesNotMatch(cut('  function fetchNext(){','  function entHtml('),/new Function|eval\(/,'새 판의 스크립트를 실행하지 않는다');
});
test('자리: 앱 설정(#gearWrap) 바로 위 · 레일 순서 9(설정 10) · 폰 머리줄에서는 숨김',()=>{
  const i=A.indexOf('<div class="ps-updwrap" id="psUpdWrap" hidden>'),g=A.indexOf('<div class="gear" id="gearWrap">');
  assert.ok(i>0&&g>i&&g-i<900,'앱 설정 바로 앞');
  assert.match(A,/\.appbar>\.ps-updwrap\{display:block;order:9;width:100%\}/);
  assert.match(A,/\.appbar>\.gear\{order:10;/);
  assert.match(A,/\.ps-updwrap\{display:none\}\n  @media \(min-width:768px\)/,'레일(≥768)에서만 보인다');
});
test('위쪽 띠 둘은 선수 전용 폰(body.ps-upd-band)에서만',()=>{
  assert.match(A,/body:not\(\.ps-upd-band\) #updBanner\{display:none!important\}/);
  assert.match(A,/body:not\(\.ps-upd-band\) #psReleaseNotes\{display:none!important\}/);
  assert.match(cut('(function(){\n  var SEEN=','window.__psUpdSurface='),/function band\(\)\{return !rail\(\)&&document\.body\.classList\.contains\('ps-player-idp-only'\);\}/);
});
test('psShowUpdBand 는 «나중에»·적용 중 가드보다 먼저 «업데이트» 칸을 켠다(칸은 «나중에» 뒤에도 남는다)',()=>{
  const f=cut('function psShowUpdBand(){','\n}\n');
  assert.ok(f.indexOf('__psUpdSurface.ready()')>0&&f.indexOf('__psUpdSurface.ready()')<f.indexOf('if(window.__psReloading||window.__psUpdateLater)return;'));
});
test('상태 문구·버튼은 팝오버·폰 줄([data-upd-msg]·[data-upd-now])에도 같이',()=>{
  const f=cut('function psUpdateStatus(message,busy){','\n/* 2.925');
  const el=(attrs)=>({textContent:'',hidden:true,disabled:false,getAttribute:k=>attrs[k]||null});
  const msgs=[el({}),el({})],btns=[el({'data-upd-label':'지금 적용'}),el({'data-upd-label':'적용'})];
  const document={getElementById:()=>null,querySelectorAll:q=>q==='[data-upd-msg]'?msgs:q==='[data-upd-now]'?btns:[],body:{classList:{contains:()=>false}}};
  const c=vm.createContext({document,window:{}});vm.runInContext(f+'\nthis.psUpdateStatus=psUpdateStatus;',c);
  c.psUpdateStatus('작성 내용을 기기에 저장한 뒤 새 버전으로 열고 있어요.',true);
  assert.equal(msgs[0].hidden,false);assert.match(msgs[1].textContent,/새 버전/);
  assert.equal(btns[0].disabled,true);assert.equal(btns[1].textContent,'저장 확인 중…');
  c.psUpdateStatus('저장 확인이 지연되어 업데이트를 보류했어요.',false);
  assert.equal(btns[0].disabled,false);assert.equal(btns[0].textContent,'지금 적용');assert.equal(btns[1].textContent,'적용');
  c.psUpdateStatus('',false);assert.equal(msgs[0].hidden,true);
});
test('«새 기능»은 안내 날짜로 오늘 포함 7일 — 본 것은 기기에만 기억해 점을 끈다',()=>{
  const src=cut('  function dayOf(e){','  function seen(){');
  const mk=(entries,now)=>{const RealDate=Date;class D extends RealDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
    const c=vm.createContext({PSReleaseNotes:{entries:()=>entries},window:{PSReleaseNotes:1},Date:D,DAY:86400000});
    vm.runInContext('function all(){return PSReleaseNotes.entries();}\n'+src+'\nthis.news=news;',c);return c.news().map(e=>e.id);};
  const E=[{id:'a',date:'2026-10-06'},{id:'b',date:'2026-10-01'},{id:'c',date:'2026-09-29'},{id:'d',date:'2026-09-20'}];
  assert.deepEqual(mk(E,new Date(2026,9,6,12).getTime()),['a','b'],'10/6 기준 9/30~10/6 — 9/29 는 8일째라 빠진다');
  assert.deepEqual(mk(E,new Date(2026,9,7,9).getTime()),['a','b'],'10/7 기준 10/1 은 7일째');
  assert.deepEqual(mk(E,new Date(2026,9,8,9).getTime()),['a'],'10/8 이면 10/1 은 빠진다');
  assert.deepEqual(mk(E,new Date(2026,9,13,9).getTime()),[],'10/13 이면 모두 지났다');
  assert.deepEqual(mk([{id:'z',date:'2026-12-31'}],new Date(2026,9,6).getTime()),[],'먼 미래 날짜(시계 틀림)는 띄우지 않는다');
  const body=cut('(function(){\n  var SEEN=','window.__psUpdSurface=');
  assert.match(body,/if\(md==='news'\)\{var n=news\(\);if\(n\[0\]\)markSeen\(n\[0\]\.id\);render\(\);\}/,'열면 본 것으로');
  assert.match(body,/dot=md==='ready'\|\|\(md==='news'&&!!first&&seen\(\)!==first\.id\)/);
});
test('폰: 더보기 두 시트 맨 위에 같은 줄 · 더보기 버튼 점',()=>{
  const row='<div class="ps-upd-row" data-upd-row hidden>';
  const app=A.indexOf('<div class="app-more" id="appMoreSheet"'),team=A.indexOf('<div class="team-more" id="teamMoreSheet"');
  assert.ok(A.indexOf(row,app)>app&&A.indexOf(row,app)<A.indexOf('data-am-row="board"',app),'앱 더보기: 보드 줄보다 위');
  assert.ok(A.indexOf(row,team)>team&&A.indexOf(row,team)<A.indexOf('<i>설정</i>',team),'팀 더보기: 설정 줄보다 위');
  assert.match(A,/body\.ps-upd-dot #psMoreBtn \.ps-updot,body\.ps-upd-dot #teamBottom \[data-tb="more"\] \.ps-updot\{display:block/);
});
