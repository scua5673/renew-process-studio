'use strict';
/* 3.080 — 코치 피드백 2차: 경기 이름 하나(리그·컵·친선) · 팀 IDP 제목 · 강도 1~10 과 뜻 · 대형을 고르면 바로 배치 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..','studio',f),'utf8');
const P=read('process.html'),S=read('scout.html'),B=read('board.html'),I=read('idp.html');
function fn(src,name){const a=src.indexOf('function '+name+'(');assert.ok(a>=0,name);let j=src.indexOf('{',a),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(a,j+1);}

test('schedule: one word per match kind, extra matches keep cup',()=>{
  const c={};vm.runInNewContext(fn(P,'mxExtraLabel')+fn(P,'mKindLb')+';this.L=mxExtraLabel;this.K=mKindLb;',c);
  assert.equal(c.K(c.L({kind:'cup'}).k),'컵');assert.equal(c.K(c.L({kind:'friendly'}).k),'친선');assert.equal(c.K(c.L({}).k),'리그');
  assert.equal(c.L({kind:'friendly'}).friendly,true);
  assert.ok(!/>경기 ▾</.test(P),'weekly kind button names the kind');assert.ok(!P.includes("'경기일 ▾'"));
  assert.ok(P.includes('data-mk="cup"'),'month popup offers cup');
  assert.ok(P.includes("day.match.kind=(matchKind==='friendly'||matchKind==='cup'||matchKind==='official')?matchKind:mMatchKind(day)"),'picking 경기 keeps an existing cup');
});

test('match list: 리그·컵·친선 badges, 공식전 totals, cup survives the schedule merge',()=>{
  const c={};vm.runInNewContext(fn(S,'matchKindLabel')+';this.f=matchKindLabel;',c);
  assert.equal(c.f({kind:'official'}),'리그');assert.equal(c.f({kind:'cup'}),'컵');assert.equal(c.f({kind:'friendly'}),'친선');assert.equal(c.f({}),'리그');
  assert.ok(S.includes('var MATCH_KIND_LABEL={official:"공식전",friendly:"친선"};'));
  assert.ok(S.includes("var _nk=_sk;"),'cup is kept on import');
  assert.ok(!/label:"정식경기"/.test(S),'no 정식경기 option left');
  assert.ok(!/'친선':'정식'/.test(I),'IDP match rows use the same words');
});

test('team IDP heading is «팀 IDP», not the squad tab name',()=>{
  assert.ok(I.includes('<div class="ps-ph sq-ph"><b>팀 IDP</b>'));assert.ok(!I.includes('<div class="ps-ph sq-ph"><b>선수단</b>'));
});

test('intensity: 1~10 with a meaning',()=>{
  const c={};vm.runInNewContext(fn(P,'rpeWord')+';this.f=rpeWord;',c);
  assert.equal([1,3,4,5,6,7,8,9,10].map(c.f).join(','),'회복,회복,저강도,저강도,중강도,중강도,고강도,고강도,최대');assert.equal(c.f(0),'');
  assert.ok(P.includes('[1,2,3,4,5,6,7,8,9,10].map(function(n){'));assert.ok(!P.includes('[2,3,4,5,6,7,8,9].map'));
  assert.ok(P.includes("['1','2','3','4','5','6','7','8','9','10']"));assert.equal((P.match(/class="wf-subph wf-rpe-key"/g)||[]).length,2);
});

test('board: picking a formation places it at once, «배치» does not re-place it',()=>{
  assert.ok(B.includes('if(row._applied!==_f){ applyFormationTo(_t,_f); row._applied=_f;'));
  assert.ok(B.includes('if(ourF&&rowOf("blue")._applied!==ourF)applyFormationTo("blue",ourF);'));
  assert.ok(B.includes('r._applied=""; });'),'reopening resets');
});

test('«다음 할 일» counts player journals still without a coach reply — facts only, quiet line',()=>{
  const ls={},today=new Date(2026,9,17);
  const set=(k,v)=>{ls[k]=JSON.stringify(v);};
  set('cs_idp_v1_u1',{log:{'2026-10-17':{memo:'다리가 무거웠다'}}});
  set('cs_idp_v1_u2',{log:{'2026-10-17':{sleepq:3}}});
  set('cs_idp_v1_u3',{log:{'2026-10-16':{memo:'어제 것'}}});
  set('cs_idp_pub_v1_u2',{reacts:{'day:2026-10-17':{h:1}}});
  const c={localStorage:{getItem:k=>ls[k]==null?null:ls[k]},IDP_PREFIX:'cs_idp_v1_',
    matchRole:()=>'executive',tmOurs:()=>[{id:'p1',name:'가'},{id:'p2',name:'나'},{id:'p3',name:'다'},{id:'p4',name:'라'}],
    tcUidByPlayerId:()=>({p1:'u1',p2:'u2',p3:'u3'}),
    plsPub:uid=>ls['cs_idp_pub_v1_'+uid]?JSON.parse(ls['cs_idp_pub_v1_'+uid]):null};
  vm.runInNewContext(fn(S,'tcYmd')+fn(S,'ckJournalWait')+';this.f=ckJournalWait;',c);
  assert.equal(JSON.stringify(c.f(today)),JSON.stringify({label:'오늘',wrote:2,wait:1}),'today: two wrote, one already ♥');
  delete ls['cs_idp_v1_u1'];delete ls['cs_idp_v1_u2'];
  assert.equal(JSON.stringify(c.f(today)),JSON.stringify({label:'어제',wrote:1,wait:1}),'nothing today → yesterday');
  c.matchRole=()=>'player';assert.equal(c.f(today),null,'players never see others\' counts');
  assert.ok(S.includes('return line("q",jw.label+" 선수 기록 "'),'quiet (q) line, no red badge');
  const a=S.indexOf('var jw=ckJournalWait(today)'),b=S.indexOf('if(c.quiet)return "";',a);assert.ok(a>0&&b>a,'shown on the quiet home too, after match work');
});
