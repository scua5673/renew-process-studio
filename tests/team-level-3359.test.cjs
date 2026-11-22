// 3.359 — 학교급(초 · 중 · 고 · 대 · 성인팀): 학년 수 · 졸업 학년 · 성인팀은 학년 없이 시즌만 · 미지정은 그대로(사용자 11/22)
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..'),A=require(path.join(root,'studio/team-audience.js')),S=require(path.join(root,'studio/roster-season.js'));
const J=x=>JSON.parse(JSON.stringify(x)),NOV=new Date(2026,10,22).getTime();
const P=(id,y)=>Object.assign({id,name:'선수'+id,manual:true},y===''?{}:{schoolYear:y});
test('학교급 표 — 두 파일이 같은 졸업 학년 · 고르지 않으면 3학년제',()=>{
  assert.deepEqual(J(A.LEVELS.map(l=>[l[0],l[2]])),[['elem',6],['mid',3],['high',3],['univ',4],['adult',0]]);
  for(const l of A.LEVELS){assert.equal(S.maxYear({level:l[0]}),l[2]);assert.equal(A.maxYear({level:l[0]}),l[2]);assert.equal(A.levelLabel({level:l[0]}),l[1]);}
  for(const m of [undefined,{},{level:''},{level:'x'},{level:'constructor'}]){assert.equal(A.maxYear(m),3);assert.equal(S.maxYear(m),3);assert.equal(A.level(m),'');}
  assert.deepEqual(J(A.yearList({level:'elem'})),['0','1','2','3','4','5','6']);assert.deepEqual(J(A.yearList({})),['0','1','2','3']);
  assert.deepEqual(J(A.yearList({level:'univ'})),['0','1','2','3','4']);assert.deepEqual(J(A.yearList({level:'adult'})),[]);
  assert.deepEqual(J(A.yearOpts({level:'mid'})),[['','미지정'],['0','신입생'],['1','1학년'],['2','2학년'],['3','3학년']]);
  assert.deepEqual(J(A.years(['6','4','7','x','0'])),['0','4','6'],'학년 값은 0~6');
});
test('넘기기 계획 — 졸업 학년은 학교급을 따르고 미지정은 그대로',()=>{
  const players=[P('a','6'),P('b','5'),P('c','3'),P('d','0'),P('e',''),P('f','4')];
  let pl=S.plan(players,{level:'elem',season:{cur:'2026'}},{now:NOV});
  assert.deepEqual(pl.grad,['a']);assert.deepEqual(J(pl.up),[{id:'b',from:'5',to:'6'},{id:'c',from:'3',to:'4'},{id:'d',from:'0',to:'1'},{id:'f',from:'4',to:'5'}]);assert.deepEqual(pl.stay,['e']);assert.equal(pl.max,6);
  pl=S.plan(players,{level:'univ',season:{cur:'2026'}},{now:NOV});
  assert.deepEqual(pl.grad,['a','b','f'],'대학 — 4학년 이상은 졸업');assert.deepEqual(J(pl.up.map(u=>u.id+u.to)),['c4','d1']);
  pl=S.plan(players,{season:{cur:'2026'}},{now:NOV});
  assert.deepEqual(pl.grad,['a','b','c','f'],'고르지 않은 팀 — 3학년 이상 졸업');assert.equal(pl.max,3);
  pl=S.plan(players,{level:'adult',season:{cur:'2026'}},{now:NOV});
  assert.deepEqual(pl.grad,[]);assert.deepEqual(pl.up,[]);assert.equal(pl.stay.length,6,'성인팀 — 모두 그대로');assert.equal(pl.by[''].length,6);assert.equal(pl.after,6);
});
test('넘기기 · 되돌리기 — 초등 6학년 졸업 · 성인팀은 시즌만',()=>{
  let doc={players:[P('a','6'),P('b','5'),P('e','')],meta:{level:'elem',season:{cur:'2026'}}};
  let undo=S.apply(doc,S.plan(doc.players,doc.meta,{now:NOV}),{now:NOV});assert.ok(undo);
  assert.equal(doc.meta.season.cur,'2027');assert.equal(doc.meta.level,'elem','학교급은 그대로');assert.ok(doc.players[0].grad);assert.equal(doc.players[1].schoolYear,'6');assert.equal('schoolYear' in doc.players[2],false);
  S.revert(doc,undo);assert.equal(doc.players[0].grad,undefined);assert.equal(doc.players[1].schoolYear,'5');assert.equal(doc.meta.season.cur,'2026');
  doc={players:[P('a','3'),P('b','')],meta:{level:'adult',season:{cur:'2026'}}};
  undo=S.apply(doc,S.plan(doc.players,doc.meta,{now:NOV}),{now:NOV});assert.ok(undo);
  assert.equal(doc.meta.season.cur,'2027');assert.equal(doc.players[0].grad,undefined);assert.equal(doc.players[0].schoolYear,'3','성인팀 — 적혀 있던 값은 건드리지 않는다');
});
test('예상 명단 — 미리 만든 시즌의 학년 셈도 학교급을 따른다',()=>{
  const players=[P('a','6'),P('b','5'),P('c','3'),P('e','')],f={cur:'2026',future:['2027','2028']};
  let pr=S.project(players,{level:'elem',season:f},'2027',NOV);
  assert.equal(pr.gone,1);assert.deepEqual(J(pr.rows.map(r=>[r.p.id,r.from,r.year])),[['b','5','6'],['c','3','4'],['e','','']]);
  pr=S.project(players,{level:'elem',season:f},'2028',NOV);assert.equal(pr.gone,2);
  pr=S.project(players,{season:f},'2027',NOV);assert.equal(pr.gone,3,'3학년제 — 3학년 이상은 그 전에 졸업');
  pr=S.project(players,{level:'adult',season:f},'2028',NOV);assert.equal(pr.gone,0);assert.deepEqual(J(pr.rows.map(r=>r.year)),['','','','']);
});
test('배선 — 학년 목록을 손으로 적은 자리가 남지 않았다',()=>{
  const read=f=>fs.readFileSync(path.join(root,'studio',f),'utf8');
  for(const f of ['player-workspace.js','schedule-audience.js','session-focus.js','idp.html'])assert.equal(/\^\[0-3\]\$|'0','1','2','3'\]/.test(read(f)),false,f);
  const pw=read('player-workspace.js');assert.ok(pw.includes("item('level','학교급'"));assert.ok(pw.includes('PSTeamAudience.yearOpts(source().meta)'));
  const ra=read('roster-audience.js');assert.ok(ra.includes('function tmYearOpts()'));assert.equal((ra.match(/TM_YEAR_OPTS/g)||[]).length,1,'옛 상수는 선언만 남는다');
});
