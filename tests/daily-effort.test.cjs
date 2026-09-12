'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const E=require('../studio/daily-effort.js');
const DATE='2026-09-14';
function data(){return {players:[{id:'p1',name:'One',grp:'A'},{id:'p2',name:'Two',grp:'A'},{id:'p3',name:'Three',grp:'B'}],members:{u1:{playerId:'p1'},u2:{playerId:'p2'},u3:{playerId:'p3'}},documents:{u1:{v:1,log:{[DATE]:{t:'team',rpe:4}}},u2:{v:1,log:{[DATE]:{t:'team',rpe:7}}},u3:{v:1,log:{[DATE]:{t:'team',rpe:10}}}},dates:[DATE]};}
function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
function harness(options={}){
  const d=options.data||data(),reads=[],local=new Map([['scout_tool_v1',JSON.stringify({players:d.players})],['cs_perms_v1',JSON.stringify({members:d.members})],...Object.entries(d.documents).map(([uid,doc])=>['cs_idp_v1_'+uid,JSON.stringify(doc)])]);
  let uid='coach',wid='team-a',role='staff',ready=true,kind='team';
  const win={localStorage:{getItem(k){reads.push(k);if(options.onRead)options.onRead(k,win);return local.get(k)||null;},setItem(){throw Error('must never write');},removeItem(){throw Error('must never delete');}}};
  win.PSSync={session:()=>uid?{uid,at:'fixture-at',rt:'fixture-rt'}:null,activeWs:()=>wid,activeWsObj:()=>({id:wid,kind}),dataUnlocked:()=>ready};win.PSPerms={role:()=>role};win.parent=win;
  return {win,reads,local,set(change){if('uid'in change)uid=change.uid;if('wid'in change)wid=change.wid;if('role'in change)role=change.role;if('ready'in change)ready=change.ready;if('kind'in change)kind=change.kind;}};
}

test('RPE accepts only integer 1–10 and canonical numeric strings',()=>{
  for(let n=1;n<=10;n++){assert.equal(E.rpe(n),n);assert.equal(E.rpe(String(n)),n);}
  assert.equal(E.rpe(' 7 '),7);
  for(const v of [null,undefined,'',0,-1,11,7.5,NaN,Infinity,true,false,'7abc','1e1','07','7.0','-2','1/10',[],{}])assert.equal(E.rpe(v),null,String(v));
});
test('date validation rejects rollover and timestamps',()=>{
  assert.equal(E.validDate('2024-02-29'),true);
  for(const v of ['2026-02-29','2026-04-31','0000-01-01','2026-9-14','2026-09-14T00:00:00Z',null])assert.equal(E.validDate(v),false);
});
test('date mean uses linked players once and selected group only',()=>{
  const d=data(),all=E.summarize(d),a=E.summarize({...d,group:'A'});
  assert.equal(all.days[0].mean,7);assert.equal(all.days[0].n,3);
  assert.equal(a.days[0].mean,5.5);assert.equal(a.days[0].n,2);assert.equal(a.linked,2);
  assert.equal(E.summarize({...d,group:'missing'}).linked,0);
});
test('missing report counts in denominator without becoming zero RPE',()=>{
  const d=data();delete d.documents.u2;delete d.documents.u3.log[DATE];const day=E.summarize(d).days[0];
  assert.equal(day.linked,3);assert.equal(day.n,1);assert.equal(day.mean,4);assert.equal(day.missing,1);assert.equal(day.unavailable,1);
});
test('no responses is null intensity, distinct from an observed low intensity',()=>{
  const d=data();d.documents={};const day=E.summarize(d).days[0];assert.equal(day.n,0);assert.equal(day.mean,null);
  const html=E.render(E.summarize(d));assert.ok(html.includes('확인된 강도 없음'));assert.ok(html.includes('응답 0 / 연결 3명'));assert.ok(html.includes('일지 자료 미확인 3명'));assert.ok(!html.includes('0 <small>/ 10'));
});
test('rest/injury stale RPE is excluded; invalid values cannot enter average',()=>{
  const d=data();d.documents.u1.log[DATE]={t:'rest',rpe:10};d.documents.u2.log[DATE]={t:'injury',rpe:8};d.documents.u3.log[DATE]={t:'team',rpe:'8bad'};
  const day=E.summarize(d).days[0];assert.equal(day.off,2);assert.equal(day.invalid,1);assert.equal(day.n,0);assert.equal(day.mean,null);
});
test('daily self reports distinguish team, other activity and unknown participation',()=>{
  const d=data();d.documents.u1.log[DATE]={t:'match',solo:true,rpe:7};d.documents.u2.log[DATE]={t:'rehab',rpe:3};d.documents.u3.log[DATE]={rpe:5};
  const day=E.summarize(d).days[0];assert.equal(day.n,3);assert.equal(day.team,1);assert.equal(day.other,1);assert.equal(day.unknown,1);assert.equal(day.mean,5);
  assert.ok(E.render(E.summarize(d)).includes('전체 세션 참여나 개인운동 제외를 뜻하지 않습니다'));
});
test('solo only and unknown types are never inferred as team participation',()=>{
  const d=data();d.documents.u1.log[DATE]={solo:true,rpe:4};d.documents.u2.log[DATE]={t:'partial',rpe:5};d.documents.u3.log[DATE]={t:'other',rpe:6};
  const day=E.summarize(d).days[0];assert.equal(day.team,0);assert.equal(day.other,1);assert.equal(day.unknown,2);
});
test('unlinked roster rows, targets and orphan member links do not inflate denominator',()=>{
  const d=data();d.players.push({id:'p4',name:'No account',grp:'A'},{id:'p5',name:'Target',type:'target',grp:'A'},{id:'p6',name:'',grp:'A'});
  d.members.u5={playerId:'p5'};d.members.u6={playerId:'p6'};d.members.orphan={playerId:'deleted'};
  assert.equal(E.summarize(d).linked,3);
});
test('duplicate roster row is counted once; two accounts for one player are flagged not averaged twice',()=>{
  const d=data();d.players.push({...d.players[0]});d.members.other={playerId:'p1'};d.documents.other={v:1,log:{[DATE]:{rpe:10}}};
  const day=E.summarize(d).days[0];assert.equal(day.linked,3);assert.equal(day.ambiguous,1);assert.equal(day.n,2);assert.equal(day.mean,8.5);
});
test('planned minutes, match minutes and fabricated actual participation fields do not change RPE',()=>{
  const d=data();const before=E.summarize(d);
  d.plannedMinutes=300;d.actualMinutes=5;d.sessions=[{min:300,load:10}];d.documents.u1.log[DATE].minutes=3;d.documents.u1.log[DATE].participation='partial';
  assert.deepEqual(E.summarize(d),before);assert.ok(!Object.hasOwn(before.days[0],'load'));assert.ok(!Object.hasOwn(before.days[0],'actualLoad'));
});
test('frozen source documents and roster remain unchanged',()=>{
  const d=freeze(data()),before=JSON.stringify(d);E.summarize(d);assert.equal(JSON.stringify(d),before);
});
test('malformed source rows and invalid dates fail closed without throwing',()=>{
  const d=data();d.documents.u1=[];d.documents.u2={v:1,log:[]};d.documents.u3={v:1,log:{[DATE]:[]}};d.dates=[DATE,DATE,'2026-02-31',null];
  const result=E.summarize(d);assert.equal(result.days.length,1);assert.equal(result.days[0].unavailable,3);assert.equal(result.days[0].missing,0);
  assert.deepEqual(E.summarize({players:{},members:[],documents:[],dates:[]}),{group:'',groups:[],linked:0,days:[]});
});
test('all allowed coaching roles can read shared diary RPE without content writes',()=>{
  for(const role of ['admin','executive','staff']){const h=harness();h.set({role});const result=E.read(h.win,[DATE],'A');assert.equal(result.days[0].mean,5.5);assert.deepEqual(h.reads,['scout_tool_v1','cs_perms_v1','cs_player_del_v1','cs_idp_v1_u1','cs_idp_v1_u2']);}
});
for(const change of [{role:'player'},{role:''},{role:'unknown'},{uid:''},{ready:false},{kind:'personal'}])test('unauthorized read does not even fetch private local keys: '+JSON.stringify(change),()=>{
  const h=harness();h.set(change);assert.equal(E.read(h.win,[DATE],''),null);assert.deepEqual(h.reads,[]);
});
test('embedded frame reads real parent auth and permissions',()=>{
  const h=harness(),frame={parent:h.win,localStorage:h.win.localStorage};assert.equal(E.read(frame,[DATE],'B').days[0].n,1);
});
test('account/team/readiness/role change during local reads discards the aggregate',()=>{
  for(const change of [{uid:'other'},{wid:'other'},{ready:false},{role:'player'}]){
    let h;h=harness({onRead(k){if(k==='cs_idp_v1_u1')h.set(change);}});assert.equal(E.read(h.win,[DATE],''),null);
  }
});
test('missing roster/perms cannot turn stale diary keys into respondents',()=>{
  for(const key of ['scout_tool_v1','cs_perms_v1']){const h=harness();h.local.delete(key);assert.equal(E.read(h.win,[DATE],''),null);assert.ok(!h.reads.some(k=>k.startsWith('cs_idp_v1_')));}
});
test('render escapes group and day labels; no private names or UID is emitted',()=>{
  const result=E.summarize({...data(),group:''});result.group='<script>bad</script>';
  const html=E.render(result,['<img src=x>']);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('One'));assert.ok(!html.includes('u1'));assert.ok(html.includes('RPE 1~10'));
});
test('group choices reflect current roster and selector preserves an empty selected group',()=>{
  const d=data();d.players.push({id:'target',name:'Target',grp:'Not current',type:'target'});
  assert.deepEqual(E.groups(d.players),['A','B']);
  const result=E.summarize({...d,group:'Old group'});assert.equal(result.linked,0);
  const html=E.render(result);assert.ok(html.includes('value="Old group" selected'));assert.ok(html.includes('계정이 연결된 선수가 없습니다'));
});
test('deleted-player tombstones exclude stale roster rows, linked counts and group choices',()=>{
  const d=data();d.tombstones={p1:1789200000000,p3:1789200000001};const result=E.summarize(d);
  assert.equal(result.linked,1);assert.equal(result.days[0].mean,7);assert.deepEqual(result.groups,['A']);
  const h=harness();h.local.set('cs_player_del_v1',JSON.stringify(d.tombstones));
  assert.equal(E.read(h.win,[DATE],'').linked,1);assert.ok(!h.reads.includes('cs_idp_v1_u1'));assert.ok(!h.reads.includes('cs_idp_v1_u3'));
});
test('duplicate player IDs across groups are ambiguous in either group, never whichever row comes first',()=>{
  const d=data();d.players.push({...d.players[0],grp:'B'});
  for(const group of ['','A','B']){const day=E.summarize({...d,group}).days[0];assert.equal(day.ambiguous,1);}
  assert.equal(E.summarize({...d,group:'A'}).days[0].mean,7);
  assert.equal(E.summarize({...d,group:'B'}).days[0].mean,10);
  const h=harness({data:d});E.read(h.win,[DATE],'A');assert.ok(!h.reads.includes('cs_idp_v1_u1'));
});
test('invalid or missing tokens fail before touching roster and diary data',()=>{
  for(const session of [{uid:'coach'},{uid:'coach',at:'x'},{uid:'coach',rt:'x'},{uid:'coach',at:true,rt:'x'},{uid:'coach',at:'',rt:'x'}]){
    const h=harness();h.win.PSSync.session=()=>session;assert.equal(E.read(h.win,[DATE],''),null);assert.deepEqual(h.reads,[]);
  }
});
test('unavailable/future-version diary is not reported as a confirmed nonresponse',()=>{
  const d=data();d.documents.u1={v:2,log:{[DATE]:{rpe:8}}};d.documents.u2=null;d.documents.u3={v:1,log:{}};
  const result=E.summarize(d),day=result.days[0];assert.equal(day.unavailable,2);assert.equal(day.missing,1);assert.equal(day.n,0);
  const html=E.render(result);assert.ok(html.includes('일지 자료 미확인 2명'));assert.ok(!html.includes('미응답 3명'));assert.ok(!html.includes('응답 없음'));
});
test('display keeps one decimal place and reads the shipped v1 diary schema',()=>{
  const d=data();
  assert.ok(E.render(E.summarize(d)).includes('7.0 <small>/ 10</small>'));
  assert.ok(E.render(E.summarize({...d,group:'A'})).includes('5.5 <small>/ 10</small>'));
  assert.equal(E.summarize(d).days[0].n,3);
});
test('versionless documents are unavailable, matching actual IDP load validation',()=>{
  const d=data();delete d.documents.u1.v;const day=E.summarize(d).days[0];assert.equal(day.n,2);assert.equal(day.unavailable,1);
});
test('browser global exposes the same read-only helper',()=>{
  const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync(require.resolve('../studio/daily-effort.js'),'utf8'),c);assert.equal(c.PSDailyEffort.rpe(8),8);
});
