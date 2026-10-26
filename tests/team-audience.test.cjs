const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../studio/team-audience.js');
test('renaming only replaces display labels and preserves every key and linked record',()=>{
  const roster={meta:{grpBase:['A팀','B팀','1학년'],formation:'4-4-2'},players:[{id:'p1',grp:'A팀',schoolYear:'2',grade:'A',memo:'원문'}]};
  const schedule={grpWeeks:{'A팀':{0:[{trainings:[{slot:'legacy'}]}]}},weeks:{0:[{grp:'A팀',groupKinds:{'A팀':'OFF','B팀':'훈련'},trainings:[{slot:'s1',grp:['A팀','B팀'],schoolYears:['1','2'],note:'그대로',blocks:[{id:'b1',dur:20}]}],board:{trainSlot:['s1'],trains:['전환'],trainData:[{id:'d1',minutes:20}]}}]}};
  const old=JSON.stringify({players:roster.players,schedule}),meta=JSON.stringify(roster.meta);
  roster.meta=A.rename(roster.meta,{'A팀':'1군','B팀':'2군'},A.keys(roster));
  assert.equal(JSON.stringify({players:roster.players,schedule}),old);assert.equal(A.label('A팀',roster.meta),'1군');assert.deepEqual(roster.meta.grpBase,['A팀','B팀','1학년']);assert.equal(roster.meta.formation,'4-4-2');assert.notEqual(JSON.stringify(roster.meta),meta);
  assert.ok(A.playerMatch(roster.players[0],schedule.weeks[0][0].trainings[0]));
  roster.meta=A.rename(roster.meta,{'A팀':'A팀'},A.keys(roster));assert.equal(A.label('A팀',roster.meta),'A팀');assert.equal(JSON.stringify({players:roster.players,schedule}),old);
});
test('blank, duplicate and long names fail without partially editing metadata',()=>{
  const meta={grpBase:['A팀','B팀'],grpLabels:{'A팀':'1군'}};const before=JSON.stringify(meta);
  for(const changes of [{'A팀':' '},{'A팀':'B팀'},{'A팀':'x'.repeat(41)}])assert.throws(()=>A.rename(meta,changes,meta.grpBase));
  assert.equal(JSON.stringify(meta),before);
});
test('renaming names with HTML, apostrophes or object-property keys keeps identity separate',()=>{
  const changes=Object.fromEntries([['__proto__','한 팀'],['constructor',"코치의 <A> '팀"]]);
  const meta=A.rename({},changes,['__proto__','constructor']);assert.equal(A.label('__proto__',meta),'한 팀');assert.equal(A.label('constructor',meta),"코치의 <A> '팀");assert.equal({}.polluted,undefined);
});
test('teams are OR, years are OR, and the two dimensions intersect',()=>{
  const session={grp:['A팀','B팀'],schoolYears:['1','2']};
  for(const grp of ['A팀','B팀','C팀'])for(const schoolYear of ['1','2','3',''])assert.equal(A.playerMatch({grp,schoolYear},session),grp!=='C팀'&&['1','2'].includes(schoolYear));
  assert.equal(A.playerMatch({grp:'B팀',schoolYear:'3'},{grp:['A팀']}),false);
  assert.equal(A.playerMatch({grp:'A팀',grade:'1'},session),false,'evaluation grade must never become a school year');
  assert.equal(A.playerMatch({grp:'A팀',grade:'A'},{grp:['A팀']}),true,'missing years keeps old all-year meaning');
});
test('year view is a read-only copy and keeps parallel program arrays attached to the same slot',()=>{
  const day={trainings:[{slot:'s1',grp:['A팀'],schoolYears:['1']},{slot:'s2',grp:['A팀'],schoolYears:['2']},{slot:'s3',grp:['B팀']}],board:{sched:'훈련',theme:'전환',trains:['1학년 훈련','2학년 훈련','공통 훈련'],trainSlot:['s1','s2','s3'],trainData:[{id:'d1'},{id:'d2'},{id:'d3'}],warms:['준비'],warmSlot:['s2'],warmsData:[{minutes:5}]}};
  const before=JSON.stringify(day),view=A.yearDay(day,['1']);assert.deepEqual(view.trainings.map(t=>t.slot),['s1','s3']);assert.deepEqual(view.board.trains,['1학년 훈련','공통 훈련']);assert.deepEqual(view.board.trainData,[{id:'d1'},{id:'d3'}]);assert.deepEqual(view.board.warms,[]);assert.deepEqual(view.board.warmSlot,[]);assert.equal(JSON.stringify(day),before);assert.equal(A.yearDay(day,[]),day);
});
test('legacy grade-named groups remain unchanged and are explicitly distinguishable',()=>{
  const doc={meta:{grpBase:['A팀','B팀','1학년']},players:[{grp:'1학년'},{grp:'D팀'}]},before=JSON.stringify(doc);
  assert.deepEqual(A.keys(doc),['A팀','B팀','1학년','D팀']);assert.equal(A.legacy('1학년',doc.meta),true);assert.equal(A.yearMatch({grp:'1학년'},['3']),true,'do not reinterpret a legacy group as a new year constraint');assert.equal(JSON.stringify(doc),before);
});
test('renaming never reclassifies an existing team or a legacy grade group',()=>{assert.equal(A.legacy('A팀',{grpLabels:{'A팀':'1학년'}}),false);assert.equal(A.legacy('1학년',{grpLabels:{'1학년':'주니어'}}),true);});
test('two-device merge preserves renamed labels, independent roster changes and grade-scoped sessions',()=>{const {plan}=require('../studio/autosave-merge.js'),raw=JSON.stringify;const base={meta:{grpBase:['A팀','B팀'],grpLabels:{'A팀':'A팀','B팀':'B팀'},color:'blue'},players:[{id:'p1',grp:'A팀',schoolYear:'1',memo:''}]},local=structuredClone(base),remote=structuredClone(base);local.meta=A.rename(local.meta,{'A팀':'1군'},local.meta.grpBase);remote.players[0].memo='다른 코치 메모';remote.players[0].schoolYear='2';const merged=JSON.parse(plan({key:'scout_tool_v1',base:raw(base),local:raw(local),remote:raw(remote)}).raw);assert.equal(merged.meta.grpLabels['A팀'],'1군');assert.equal(merged.players[0].memo,'다른 코치 메모');assert.equal(merged.players[0].schoolYear,'2');assert.equal(merged.players[0].grp,'A팀');});
