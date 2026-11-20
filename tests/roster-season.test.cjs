'use strict';
/* 시즌별 선수단 — 졸업 표시 · 새 시즌 넘기기 · 되돌리기(셈만, studio/roster-season.js) */
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../studio/roster-season.js');
const NOV=new Date(2026,10,21).getTime(),FEB=new Date(2027,1,10).getTime(),AUG=new Date(2027,7,1).getTime();
function team(){return {meta:{teamName:'프로세스FC'},players:[
  {id:'a',name:'김하늘',num:'1',type:'ours',grp:'A',schoolYear:'1',posId:'gk',levels:{x:3}},
  {id:'b',name:'이도윤',num:'2',type:'ours',grp:'B',schoolYear:'2',posId:'rb'},
  {id:'c',name:'최서준',num:'5',type:'ours',grp:'B',schoolYear:'3',posId:'cb',evalSets:[{at:1}]},
  {id:'d',name:'한예준',num:'10',type:'ours',grp:'A',schoolYear:3,posId:'am'},
  {id:'e',name:'문건우',num:'6',type:'ours',grp:'A',schoolYear:'3',posId:'dm'},
  {id:'f',name:'학년 없음',num:'7',type:'ours',grp:'A',posId:'cm'},
  {id:'t',name:'후보',type:'target',schoolYear:'3'},
  {id:'g',name:'',type:'ours',schoolYear:'3'}]};}
const posOf=p=>String(p.posId||'').toUpperCase();

test('지금 시즌: 넘긴 적 없는 팀은 상반기면 지난해, 하반기면 그해 · 넘긴 팀은 적힌 값',()=>{
  assert.equal(S.current({},NOV),'2026');assert.equal(S.current({},FEB),'2026');assert.equal(S.current(undefined,AUG),'2027');
  assert.equal(S.current({season:{cur:'2031'}},NOV),'2031');assert.equal(S.current({season:{cur:'x'}},NOV),'2026');
});

test('계획: 3학년 졸업 · 2 · 1학년 진급 · 학년 없음 · 후보 · 이름 없는 줄은 그대로',()=>{
  const d=team(),p=S.plan(d.players,d.meta,{now:NOV});
  assert.equal(p.cur,'2026');assert.equal(p.next,'2027');assert.equal(p.total,6);
  assert.deepEqual(p.grad,['c','d','e']);assert.deepEqual(p.up,[{id:'a',from:'1',to:'2'},{id:'b',from:'2',to:'3'}]);
  assert.deepEqual(p.stay,['f']);assert.equal(p.after,3);
});

test('계획: 이름을 끈 선수 · 끈 학년은 그대로',()=>{
  const d=team();
  assert.deepEqual(S.plan(d.players,d.meta,{now:NOV,keep:['e']}).grad,['c','d']);
  const p=S.plan(d.players,d.meta,{now:NOV,years:{'2':false}});
  assert.deepEqual(p.up,[{id:'a',from:'1',to:'2'}]);assert.ok(p.stay.includes('b'));
});

test('넘기기: 졸업 표시 · 학년 · 시즌 · 그날 명단 줄 — 선수 객체와 평가는 그대로',()=>{
  const d=team(),p=S.plan(d.players,d.meta,{now:NOV,keep:['e']}),undo=S.apply(d,p,{now:NOV,posOf});
  assert.ok(undo);const by=Object.fromEntries(d.players.map(x=>[x.id,x]));
  assert.deepEqual(by.c.grad,{season:'2026',at:NOV});assert.deepEqual(by.c.evalSets,[{at:1}]);assert.equal(by.c.schoolYear,'3');
  assert.equal(by.e.grad,undefined);assert.equal(by.e.schoolYear,'3');
  assert.equal(by.a.schoolYear,'2');assert.equal(by.b.schoolYear,'3');assert.deepEqual(by.a.levels,{x:3});
  assert.equal(by.t.grad,undefined);assert.equal(d.players.length,8);
  assert.equal(d.meta.season.cur,'2027');assert.equal(d.meta.teamName,'프로세스FC');
  const snap=S.pastOf(d.meta,'2026');assert.equal(snap.rows.length,6);
  assert.deepEqual(snap.rows.find(r=>r.id==='c'),{id:'c',name:'최서준',num:'5',pos:'CB',grp:'B',year:'3',grad:1});
  assert.deepEqual(snap.rows.find(r=>r.id==='a'),{id:'a',name:'김하늘',num:'1',pos:'GK',grp:'A',year:'1'});
  assert.deepEqual(S.active(d.players).map(x=>x.id),['a','b','e','f','g']);assert.deepEqual(S.grads(d.players).map(x=>x.id),['c','d']);
});

test('되돌리기: 넘기기 전 명단 그대로 · 그 사이 손댄 값은 둔다',()=>{
  const d=team(),was=JSON.stringify(d),undo=S.apply(d,S.plan(d.players,d.meta,{now:NOV}),{now:NOV,posOf});
  assert.equal(S.revert(d,undo),5);const back=JSON.parse(JSON.stringify(d));back.players.find(x=>x.id==='d').schoolYear=3;
  assert.equal(JSON.stringify(back),was);
  const d2=team(),u2=S.apply(d2,S.plan(d2.players,d2.meta,{now:NOV}),{now:NOV});
  d2.players.find(x=>x.id==='a').schoolYear='1';delete d2.players.find(x=>x.id==='c').grad;
  assert.equal(S.revert(d2,u2),3);assert.equal(d2.players.find(x=>x.id==='a').schoolYear,'1');assert.equal(d2.meta.season,undefined);
});

test('넘기기: 계획이 낡았으면(이미 졸업 · 학년이 바뀜 · 선수가 없음) 아무것도 안 고친다',()=>{
  const d=team(),p=S.plan(d.players,d.meta,{now:NOV});d.players.find(x=>x.id==='b').schoolYear='1';
  const was=JSON.stringify(d);assert.equal(S.apply(d,p,{now:NOV}),null);assert.equal(JSON.stringify(d),was);
  const d2=team(),p2=S.plan(d2.players,d2.meta,{now:NOV});d2.players=d2.players.filter(x=>x.id!=='c');assert.equal(S.apply(d2,p2,{now:NOV}),null);
});

test('두 번 넘기면 지난 시즌이 둘 · 같은 시즌 줄은 하나 · 여덟 시즌까지',()=>{
  const d=team();S.apply(d,S.plan(d.players,d.meta,{now:NOV}),{now:NOV});
  const p=S.plan(d.players,d.meta,{now:FEB});assert.equal(p.cur,'2027');assert.deepEqual(p.grad,['b']);
  S.apply(d,p,{now:FEB});assert.deepEqual(S.past(d.meta).map(x=>x.id),['2026','2027']);assert.equal(d.meta.season.cur,'2028');
  for(let i=0;i<10;i++)S.apply(d,S.plan(d.players,d.meta,{}),{});
  assert.equal(S.past(d.meta).length,S.PAST_MAX);
});

test('손으로 졸업 · 현재 명단으로 · 시즌 고르개',()=>{
  const d=team();assert.deepEqual(S.graduate(d,['c','t','zz','c'],{now:NOV}),['c']);
  assert.equal(d.players.find(x=>x.id==='c').grad.season,'2026');
  let sc=S.scopes(d.players,d.meta,NOV);assert.deepEqual(sc.map(x=>[x.id,x.n]),[['cur',5],['grad',1]]);
  assert.deepEqual(S.restore(d,['c','a']),['c']);assert.equal(d.players.find(x=>x.id==='c').grad,undefined);
  S.apply(d,S.plan(d.players,d.meta,{now:NOV}),{now:NOV});sc=S.scopes(d.players,d.meta,NOV);
  assert.deepEqual(sc.map(x=>[x.id,x.label,x.n]),[['cur','2027 시즌',3],['past:2026','2026 시즌',6],['grad','졸업생 전체',3]]);
});
