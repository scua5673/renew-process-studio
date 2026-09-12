'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const focus=require('../studio/session-focus.js');

const DATE='2026-09-12',WEEK='2026-09-07';
function fixture(){
  return {date:DATE,session:{grp:'A팀',players:1},day:{grp:'B팀'},canRead:true,ready:true,
    roster:{players:[{id:'p1',name:'하나',num:0,posId:'cm',grp:'A팀'},{id:'p2',name:'둘',num:2,grp:'B팀'}],positions:[{id:'cm',name:'CM'}]},
    permissions:{members:{u1:{role:'player',playerId:'p1'},u2:{role:'player',playerId:'p2'}}},
    docsByUid:{u1:{focusByWk:{[WEEK]:{wk:WEEK,text:'한 번 보고 받기'}}},u2:{focusByWk:{[WEEK]:{text:'두 번째 움직임'}}}},
    pubsByUid:{u1:null,u2:null}};
}
function deepFreeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(deepFreeze);Object.freeze(v);}return v;}

test('exports a browser global without requiring storage or a DOM',()=>{
  const ctx=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio/session-focus.js'),'utf8'),ctx);
  assert.equal(typeof ctx.window.PSSessionFocus.build,'function');
  assert.equal(ctx.window.PSSessionFocus.monday(DATE),WEEK);
});
for(const [date,expected] of [[DATE,WEEK],['2026-09-13',WEEK],['2026-09-14','2026-09-14'],['2027-01-01','2026-12-28'],['2024-02-29','2024-02-26']]){
  test('calendar Monday is exact for '+date,()=>assert.equal(focus.monday(date),expected));
}
for(const date of ['',null,'2026-02-30','2026-13-01','2026-9-12','09/12/2026','2026-09-12T00:00:00Z','0000-01-01']){
  test('invalid session date does not fall back to today: '+date,()=>{
    const f=fixture();f.date=date;const r=focus.build(f);
    assert.equal(r.status,'invalid-date');assert.equal(r.rows.length,0);assert.equal(r.week,'');
  });
}
test('session groups override the day and deduplicate legacy string/array values',()=>{
  assert.deepEqual(focus.scope({grp:['A팀','B팀','A팀',' ']},{grp:'C팀'}),{kind:'groups',groups:['A팀','B팀'],source:'session',label:'A팀 · B팀'});
  assert.equal(focus.scope({grp:' A팀 '},{grp:'B팀'}).label,'A팀');
});
test('empty session group inherits the saved day; otherwise it remains team common',()=>{
  for(const grp of [undefined,'',[]]){
    assert.equal(focus.scope({grp},{grp:'B팀'}).source,'day');
    assert.deepEqual(focus.scope({grp},{}),{kind:'team',groups:[],source:'team',label:'팀 공통'});
  }
});
test('normal group selection matches the actual process schedGrpList reader',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
  const a=source.indexOf('function schedGrpList('),b=source.indexOf('\n}',a);assert.ok(a>=0&&b>a);
  const ctx=vm.createContext({dayGroup:'',schedDayGrp:()=>ctx.dayGroup});vm.runInContext(source.slice(a,b+2),ctx);
  for(const dayGroup of ['','B팀'])for(const grp of [undefined,'',[],['A팀'],'A팀',['A팀','C팀']]){
    ctx.dayGroup=dayGroup;
    assert.deepEqual(focus.scope({grp},{grp:dayGroup}).groups,Array.from(ctx.schedGrpList({grp},0)));
  }
});
test('malformed saved group does not silently widen to the whole team',()=>{
  for(const grp of [2,{},['A팀',2]])assert.equal(focus.scope({grp},{grp:'B팀'}).kind,'unknown');
  const f=fixture();f.session.grp={};const r=focus.build(f);
  assert.equal(r.status,'unknown-scope');assert.equal(r.rows.length,0);
});
test('one saved group only includes that group in the current roster',()=>{
  const r=focus.build(fixture());
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].playerId,'p1');assert.equal(r.rows[0].num,'0');assert.equal(r.rows[0].pos,'CM');
  assert.match(focus.render(r),/현재 선수단의 A팀 기준 · 실제 출석 명단은 별도/);
});
test('multiple saved groups form a union; a count is never a participant ID list',()=>{
  const f=fixture();f.session={grp:['A팀','B팀'],players:1};
  assert.equal(focus.build(f).rows.length,2);
  f.session={players:['p1']};f.day={};const r=focus.build(f);
  assert.equal(r.scope.kind,'team');assert.equal(r.rows.length,2);
  assert.ok(r.warnings.some(w=>w.code==='attendance-unknown'));
});
test('unknown player group is excluded instead of assumed to be the session group',()=>{
  const f=fixture();delete f.roster.players[0].grp;const r=focus.build(f);
  assert.equal(r.rows.length,0);assert.equal(r.status,'unavailable');
  assert.ok(r.warnings.some(w=>w.code==='player-group-unknown'));
});
test('scouting targets and deleted roster IDs never produce rows',()=>{
  const f=fixture();f.session.grp=['A팀','B팀'];f.roster.players[0].type='target';f.deletedPlayers={p2:123};
  assert.equal(focus.build(f).rows.length,0);
});
test('missing and duplicate player IDs are not linked by name, number or array position',()=>{
  const f=fixture();delete f.roster.players[0].id;
  assert.ok(focus.build(f).warnings.some(w=>w.code==='player-identity-unknown'));
  const g=fixture();g.roster.players.push({...g.roster.players[0],name:'다른 하나'});
  const r=focus.build(g);assert.equal(r.rows.length,0);assert.ok(r.warnings.some(w=>w.code==='player-identity-ambiguous'));
});
test('missing or ambiguous account links are reported without reading another account',()=>{
  const f=fixture();delete f.permissions.members.u1;
  assert.ok(focus.build(f).warnings.some(w=>w.code==='account-unlinked'));
  f.permissions.members.u3={playerId:'p1'};f.permissions.members.u4={playerId:'p1'};
  const r=focus.build(f);assert.equal(r.rows.length,0);assert.ok(r.warnings.some(w=>w.code==='account-ambiguous'));
});
test('matching is by exact player ID and group, never prefix or names',()=>{
  const f=fixture();f.permissions.members.u1.playerId='p10';f.roster.players[1].grp='A팀2';
  assert.equal(focus.build(f).rows.length,0);
});
test('past and future sessions use their explicit week rather than the system week',()=>{
  const f=fixture();f.docsByUid.u1.focusByWk['2026-08-31']={text:'지난주 행동'};
  f.docsByUid.u1.focus={wk:WEEK,text:'이번주 최신'};f.date='2026-09-02';
  assert.equal(focus.build(f).rows[0].weekly.text,'지난주 행동');
  f.date='2026-09-15';assert.equal(focus.build(f).rows.length,0);
  f.docsByUid.u1.focusByWk['2026-09-14']={text:'다음주 행동'};
  assert.equal(focus.build(f).rows[0].weekly.text,'다음주 행동');
});
test('exact focusByWk takes precedence and legacy focus requires the same Monday',()=>{
  const doc={focusByWk:{[WEEK]:{text:'주별 기록'}},focus:{wk:WEEK,text:'옛 현재 초점'}};
  assert.equal(focus.weekly(doc,DATE).text,'주별 기록');delete doc.focusByWk[WEEK];
  assert.equal(focus.weekly(doc,DATE).source,'focus');doc.focus.wk='2026-09-14';assert.equal(focus.weekly(doc,DATE),null);
});
test('an empty or conflicting exact-week record never resurrects legacy focus',()=>{
  for(const value of [null,{text:''},{wk:'2026-09-14',text:'잘못된 주'},{text:42}]){
    assert.equal(focus.weekly({focusByWk:{[WEEK]:value},focus:{wk:WEEK,text:'옛 초점'}},DATE),null);
  }
});
test('no fallback from current vision, quarterly goal, weekly reflection or coach proposal',()=>{
  assert.equal(focus.weekly({vision:{behaviors:[{text:'현재 방향'}]},qgoal:{goals:[{t:'분기 목표'}]},weekly:{[WEEK]:{good:'주간 회고'}},focus:{wk:'2026-09-14',text:'다음 주'}},DATE),null);
});
test('coach review selects the latest dated record no later than the session date',()=>{
  const pub={reviews:[{at:'2026-09-10',goals:[{t:'10일 참고'}]},{at:'2026-09-14',goals:[{t:'미래 금지'}]},{at:'2026-09-01',goals:[{t:'오래된 참고'}]},{at:'2026-09-12',goals:[{t:'당일 참고'}]}]};
  assert.equal(focus.review(pub,DATE).goals[0].text,'당일 참고');
  assert.equal(focus.review(pub,'2026-09-11').goals[0].text,'10일 참고');
  assert.equal(focus.review(pub,'2026-08-31'),null);
});
test('same-date reviews use append order without mutating the original list',()=>{
  const pub=deepFreeze({reviews:[{at:DATE,goals:[{t:'처음'}]},{at:DATE,goals:[{t:'나중'}]}]});
  assert.equal(focus.review(pub,DATE).goals[0].text,'나중');
});
test('latest dated review without goals does not revive older goals',()=>{
  assert.equal(focus.review({reviews:[{at:'2026-09-01',goals:[{t:'예전 목표'}]},{at:DATE,strengths:['강점']} ]},DATE),null);
});
test('undated, future and invalid reviews cannot win the reference selection',()=>{
  const pub={reviews:[{at:'2026-09-01',goals:[{t:'확인된 참고'}]},...['',undefined,'2026-02-30','9/11/26','2026-09-11T00:00:00',Infinity,-1,'2026-09-13'].map(at=>({at,goals:[{t:'제외'}]}))]};
  assert.equal(focus.review(pub,DATE).goals[0].text,'확인된 참고');
});
test('timestamp reviews normalize to the browser local date, including timezone boundaries',()=>{
  const modulePath=path.resolve(__dirname,'../studio/session-focus.js');
  const code='const f=require('+JSON.stringify(modulePath)+');console.log(JSON.stringify([f.reviewDate("2026-09-11T16:00:00Z"),f.reviewDate(1789142400000)]));';
  const ko=JSON.parse(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:'Asia/Seoul'},encoding:'utf8'}));
  const us=JSON.parse(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:'America/Los_Angeles'},encoding:'utf8'}));
  assert.equal(ko[0],'2026-09-12');assert.equal(us[0],'2026-09-11');
  assert.equal(ko[1],'2026-09-12');assert.equal(us[1],'2026-09-11');
});
test('out-of-range timestamps cannot be sorted as an ancient review',()=>{
  assert.equal(focus.reviewDate(253402387200000),'');
  assert.equal(focus.reviewDate(8640000000000000),'');
});
test('text-only coach goals remain visible but are explicitly reference records',()=>{
  const f=fixture();f.pubsByUid.u1={reviews:[{at:DATE,goals:[{t:'텍스트 목표만'}]}]};
  const html=focus.render(focus.build(f));
  assert.match(html,/코치 리뷰 참고 · 2026-09-12/);assert.match(html,/텍스트 목표만/);
  assert.match(html,/이 훈련에 적용됐는지는 확인되지 않습니다/);assert.doesNotMatch(html,/당시 목표|확정 목표/);
});
test('account and document readiness fail closed, including missing booleans',()=>{
  for(const change of [{canRead:false},{canRead:undefined},{ready:false},{ready:undefined},{permissions:null},{roster:null}]){
    const r=focus.build({...fixture(),...change});assert.equal(r.rows.length,0);
    assert.equal(r.status,change.canRead===false||('canRead' in change&&change.canRead===undefined)?'forbidden':'unavailable');
  }
  assert.equal(focus.render(focus.build({...fixture(),canRead:false})), '');
});
test('unknown document is not the same as verified absent data',()=>{
  const f=fixture();f.docsByUid={};const unknown=focus.build(f);
  assert.equal(unknown.status,'unavailable');assert.match(focus.render(unknown),/아직 확인하지 못했습니다/);
  f.docsByUid.u1=null;const absent=focus.build(f);
  assert.equal(absent.status,'empty');assert.equal(absent.warnings.length,0);
});
test('coach reference with an unread player document never claims that weekly focus is absent',()=>{
  const f=fixture();delete f.docsByUid.u1;f.pubsByUid.u1={reviews:[{at:DATE,goals:[{t:'코치 참고'}]}]};
  const r=focus.build(f),html=focus.render(r);
  assert.equal(r.rows[0].weeklyState,'unavailable');assert.match(html,/주간 초점을 아직 확인하지 못했습니다/);
  assert.doesNotMatch(html,/해당 주에 저장된 초점 없음/);
});
test('malformed fetched documents are unavailable rather than confirmed empty',()=>{
  const f=fixture();f.docsByUid.u1='bad JSON';f.pubsByUid.u1=undefined;
  assert.equal(focus.build(f).status,'unavailable');
});
test('all displayed values are escaped, including categories, names, scopes and warnings',()=>{
  const f=fixture(),attack='<img src=x onerror="bad()">\'&';
  f.session.grp=attack;f.roster.players[0].grp=attack;f.roster.players[0].name=attack;
  f.docsByUid.u1.focusByWk[WEEK].text=attack;f.pubsByUid.u1={reviews:[{at:DATE,goals:[{t:attack,cat:'c',dec:attack}]}]};
  const r=focus.build(f);r.warnings.push({code:'test',message:attack});const html=focus.render(r,{c:attack});
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('onerror="bad()"'));
  assert.match(html,/&lt;img/);assert.match(html,/&#39;&amp;/);
});
test('reading frozen input neither writes records nor returns mutable references to their text objects',()=>{
  const f=fixture();f.pubsByUid.u1={reviews:[{at:DATE,goals:[{t:'참고',cat:'O.1',dec:'관찰'}]}]};
  const before=JSON.stringify(f);deepFreeze(f);const r=focus.build(f);focus.render(r);
  r.rows[0].weekly.text='표시 객체';r.rows[0].coach.goals[0].text='표시 객체';r.scope.groups.push('C팀');
  assert.equal(JSON.stringify(f),before);
});
