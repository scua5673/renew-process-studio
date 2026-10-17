'use strict';
/* 3.079 — 코치 피드백 2차: 경기 이름 하나(리그·컵·친선) · 팀 IDP 제목 · 강도 1~10 과 뜻 · 대형을 고르면 바로 배치 */
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
