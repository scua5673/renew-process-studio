'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const intensity=require('../studio/training-intensity.js');
const weather=require('../studio/weather-request.js');
const names=require('../studio/idp-profile-name.js');
const dismiss=require('../studio/popover-dismiss.js');
const matchHome=require('../studio/match-home.js');
function actual(file,name,context){
  const source=fs.readFileSync(path.join(__dirname,'../studio',file),'utf8');
  const start=new RegExp('(?:^|\\n)([ \\t]*)function '+name+'\\(').exec(source);assert.ok(start,name);
  const from=start.index+(source[start.index]==='\n'?1:0),lineEnd=source.indexOf('\n',from);
  const end=source.slice(from,lineEnd).trimEnd().endsWith('}')?lineEnd:source.indexOf('\n'+start[1]+'}',lineEnd)+start[1].length+2;
  return vm.runInNewContext(source.slice(from,end)+';'+name,{PSIntensity:intensity,console,...context});
}
test('planned RPE uses the same boundaries in session, annual, coach and player views',()=>{
  const readers=[actual('process.html','rpeWord'),actual('process.html','yearQuickRpeLabel')];
  const coach=actual('scout.html','teamPlannedLoadText'),player=actual('idp.html','teamTrainingLoadText');
  for(const [value,label] of [[1,'회복'],[3,'회복'],[4,'저강도'],[5,'저강도'],[6,'중강도'],[7,'중강도'],[8,'고강도'],[9,'고강도'],[10,'최대']]){
    for(const reader of readers)assert.equal(reader(value),label);
    assert.equal(coach(value),'RPE '+value+' · '+label);assert.equal(player(value),coach(value));
  }
  for(const v of [null,0,-1,11,NaN,Infinity,'bad'])assert.equal(intensity.text(v),'');
  assert.equal(intensity.band(5),'저');assert.equal(intensity.band(7),'중');assert.equal(intensity.band(8),'고');
});
test('old positive attempts and yes/no attempts never acquire an invented count',()=>{
  const d={log:{'2026-11-02':{try:1},'2026-11-03':{try:2},'2026-11-04':{tryOpportunity:false}}};
  const before=JSON.stringify(d),ymd=d=>d.toISOString().slice(0,10),addDays=(d,n)=>new Date(+d+n*86400000);
  const props=actual('idp.html','olAutoProps',{ymd,addDays})(d,'2026-11-02','공 받기 전 확인');
  assert.match(props.ra,/시도한 날 2일/);assert.doesNotMatch(props.ra,/1~2번/);assert.equal(JSON.stringify(d),before);
});
test('past matches without results are unrecorded, never automatically completed',()=>{
  const date='2026-11-02',status=actual('scout.html','matchStatusOf',{matchYmd:()=>date,matchPhaseReviewHas:()=>false,matchStepFill:()=>({n:1,t:1})});
  assert.equal(status({date:'2026-11-01',scoreUs:'',scoreThem:''}),'unrecorded');
  assert.equal(status({date:'2026-11-01'}),'unrecorded');
  assert.equal(status({date,scoreUs:'',scoreThem:''}),'prep');
  assert.equal(status({date:'2026-11-03',scoreUs:'',scoreThem:''}),'prep');
  assert.equal(status({date,scoreUs:0,scoreThem:0}),'played');
  assert.equal(status({date:'2026-11-01',reviewPublished:true}),'review');
});
test('profile fallback is exact, public, read-only and never replaces a personal name',()=>{
  const perms={members:{a:{playerId:'p1'},b:{playerId:'p2'}}},roster=[{id:'p1',name:'프로세스 선수'},{id:'p2',name:'동명이인'}],profile={};
  const before=JSON.stringify([perms,roster,profile]);
  assert.equal(names.resolve(profile,'a',perms,roster),'프로세스 선수');
  assert.equal(names.resolve({name:'직접 적은 이름'},'a',perms,roster),'직접 적은 이름');
  assert.equal(names.resolve(profile,'missing',perms,roster),'');
  assert.equal(names.resolve(profile,'a',perms,[roster[1]]),'');
  assert.equal(names.resolve(profile,'a',{members:{a:{playerId:'p1'},b:{playerId:'p1'}}},roster),'');
  assert.equal(names.resolve(profile,'a',perms,[roster[0],roster[0]]),'');
  assert.equal(JSON.stringify([perms,roster,profile]),before);
});
test('a scored match today is past in both the player list and detail, while future preparation stays upcoming',()=>{
  const mtScore=actual('idp.html','mtScore');
  const upcoming=actual('idp.html','mtUpcoming',{mtScore,mtTodayYmd:()=> '2026-11-02'});
  assert.equal(upcoming({date:'2026-11-02',scoreUs:'2',scoreThem:'1'}),false);
  assert.equal(upcoming({date:'2026-11-02',scoreUs:0,scoreThem:0}),false);
  assert.equal(upcoming({date:'2026-11-02',reviewPublished:true}),false);
  assert.equal(upcoming({date:'2026-11-01'}),false);
  assert.equal(upcoming({date:'2026-11-02'}),true);
  assert.equal(upcoming({date:'2026-11-07',prepPublished:true,briefing:'경기 준비'}),true);
});
test('player schedule reads never create matches or attempt writes, before or after server confirmation',()=>{
  for(const ready of [true,false])for(const stored of [null,{version:1,matches:[{id:'coach-match'}]}]){
    let writes=0,merges=0;
    const load=actual('scout.html','matchLoad',{matchState:null,MATCH_KEY:'matches',matchRole:()=> 'player',matchDocPending:()=> !ready,matchCurrent:'',
      scoutStore:{get:()=>stored,set:()=>writes++},matchMergeSchedule:()=>{merges++;return true;},matchPruneDeadShells:()=>{throw Error('read only');}});
    assert.deepEqual(JSON.parse(JSON.stringify(load())),stored||{version:1,matches:[]});assert.equal(writes,0);assert.equal(merges,0);
  }
});
test('match role uses shell permissions before the embedded permissions script has loaded',()=>{
  const role=actual('scout.html','matchRole',{window:{parent:{PSPerms:{role:()=> 'player'}}}});
  assert.equal(role(),'player');
});
test('weather deduplicates in-flight calls, backs off failures, and recovers without a timer',async()=>{
  let now=0,calls=0,finish;const gate=weather.create(()=>now);
  const request=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const first=gate.run('here',request),second=gate.run('here',request);await Promise.resolve();assert.equal(calls,1);finish('sun');assert.equal(await first,'sun');assert.equal(await second,'sun');
  const failed=()=>{calls++;throw Error('offline');};
  await assert.rejects(gate.run('here',failed),/offline/);
  for(let i=0;i<18;i++)await assert.rejects(gate.run('here',failed),/offline/);
  assert.equal(calls,2);now=30000;await assert.rejects(gate.run('here',failed));assert.equal(calls,3);
  now=89999;await assert.rejects(gate.run('here',failed));assert.equal(calls,3);
  now=90000;assert.equal(await gate.run('here',()=>{calls++;return 'recovered';}),'recovered');assert.equal(calls,4);
  assert.equal(await gate.run('elsewhere',()=> 'new location'),'new location');
});
test('popover closes from nested frames and Escape, including reloaded documents without duplicate listeners',()=>{
  function target(){const listeners={};return {listeners,addEventListener(k,f){(listeners[k]||=[]).push(f);},emit(k,e={}){for(const f of listeners[k]||[])f(e);},querySelectorAll(){return this.frames||[];}};}
  const outer=target(),child=target(),nested=target(),frame=target(),subframe=target();frame.contentDocument=child;subframe.contentDocument=nested;outer.frames=[frame];child.frames=[subframe];let closed=0;
  const scan=dismiss.watch(outer,()=>closed++);scan();child.emit('pointerdown');nested.emit('pointerdown');outer.emit('keydown',{key:'Escape'});assert.equal(closed,3);
  child.emit('keydown',{key:'a'});assert.equal(closed,3);assert.equal(child.listeners.pointerdown.length,1);
  const replacement=target();frame.contentDocument=replacement;frame.emit('load');replacement.emit('pointerdown');assert.equal(closed,4);
});
test('coach today reads the exact match result and opens that match review, including 0:0 and partial scores',()=>{
  const date='2026-11-02',record={id:'today',date,opponent:'결과 입력 상대',scoreUs:2,scoreThem:1};
  const wrong={id:'other',date,opponent:'다른 상대',scoreUs:0,scoreThem:4},rows=[wrong,record];
  const status=actual('scout.html','matchStatusOf',{matchYmd:()=>date,matchPhaseReviewHas:()=>false});
  const session=actual('scout.html','ckSession',{window:{__twCtx:{id:'today',diff:0}},PSMatchHome:matchHome,
    matchLoad:()=>({matches:rows}),matchYmd:()=>date,matchStatusOf:status,teamHomeDayAt:()=>({date:new Date(date+'T12:00:00')}),
    teamBoardSession:()=>null,teamSessionPlannedLoad:()=>'',scheduleSourceId:()=>'',scheduleMid:()=>''});
  const before=JSON.stringify(rows),s=session(0);
  assert.equal(s.title,'경기 · vs 결과 입력 상대');assert.equal(s.sub,'2 : 1 · 결과 입력됨');assert.equal(s.matchId,'today');
  assert.equal(s.matchView.label,'경기 리뷰 열기');assert.equal(s.matchView.stage,'review');
  record.scoreUs=0;record.scoreThem=0;assert.equal(session(0).sub,'0 : 0 · 결과 입력됨');
  record.scoreThem='';assert.equal(session(0).sub,'0 : — · 결과 입력됨');
  record.scoreUs='';assert.equal(session(0).matchView.label,'경기 준비 열기');
  record.scoreUs=2;record.scoreThem=1;assert.equal(JSON.stringify(rows),before);
  const calls=[];const open=actual('scout.html','ckOpenHomeMatch',{matchLoad:()=>({matches:rows}),matchOpen:id=>{calls.push(id);return true;},setView:v=>calls.push(v)});
  open(s.matchId,s.matchView.stage);assert.deepEqual(calls,['today','review']);
  open('deleted','review');assert.deepEqual(calls,['today','review']);
  const blocked=actual('scout.html','ckOpenHomeMatch',{matchLoad:()=>({matches:rows}),matchOpen:()=>false,setView:v=>calls.push(v)});
  blocked('today','review');assert.deepEqual(calls,['today','review']);
});
test('home match identity never guesses from date or opponent, and reports review states without inventing a score',()=>{
  const date='2026-11-02',first={id:'a',sourceId:'sched:a',date},second={id:'b',sourceId:'sched:b',date},rows=[first,second];
  assert.equal(matchHome.resolve(rows,{date,sourceId:'sched:b'}),second);
  for(const target of [{date},{date,id:'missing',sourceId:'sched:a'},{date:'2026-11-01',id:'a'},{date,sourceId:'missing'}])assert.equal(matchHome.resolve(rows,target),null);
  assert.equal(matchHome.resolve([first,first],{date,id:'a'}),null);
  assert.deepEqual(matchHome.describe({},'unrecorded'),{sub:'지난 경기 · 결과 미입력',stage:'review',label:'결과·리뷰 입력'});
  assert.equal(matchHome.describe({},'reviewing').sub,'리뷰 작성 중');
  assert.equal(matchHome.describe({},'review').sub,'리뷰 기록됨');
  assert.equal(matchHome.describe({},'prep').label,'경기 준비 열기');
});
