'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const R=require('../studio/review-training.js');
const root=path.join(__dirname,'../studio');
const source=fs.readFileSync(path.join(root,'review-training-schedule.js'),'utf8');
const sync=fs.readFileSync(path.join(root,'sync.js'),'utf8');
const storage=fs.readFileSync(path.join(root,'storage.js'),'utf8');
const KEY='process_coach_v1',ORIGIN='https://process.test';
const clone=x=>JSON.parse(JSON.stringify(x));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function section(text,a,b){const start=text.indexOf(a),end=text.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,`actual code: ${a}`);return text.slice(start,end);}
function baseTask(overrides={}){return Object.assign(R.newTask({id:'task-existing',matchId:'match-1',matchDate:'2026-09-05',opponent:'Away',sourceKey:'reviewImprove',action:'공을 받기 전에 주변을 확인한다',grp:['A'],now:100}),overrides);}
function blankWeek(){return Array.from({length:7},()=>({trainings:[]}));}
function decode(s){return String(s).replace(/&(amp|lt|gt|quot|#39);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[x]));}
function classes(){const set=new Set();return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)};}

// Execute the complete production wrapper. Only browser surfaces and storage I/O
// are fakes; ownership uses the real sync dataUnlocked predicate, including its
// cache uid/workspace check. No account, network or IndexedDB is accessed.
function harness(options={}){
  const state={session:{uid:'user-1'},cacheOwner:{uid:'user-1',wid:'team-1'},role:'executive',blocked:false,teamEdit:true,saveAccepted:true,unreadyKeys:[],
    saveCount:0,verified:[],posted:[],toasts:[],focused:[],...options.state};
  const local=new Map([['ps_active_ws','team-1'],['ps_sync_session',JSON.stringify({uid:'user-1'})]]);
  const matches={matches:[{id:'match-1',date:'2026-09-05',opponent:'Away',reviewImprove:'공을 받기 전에 주변을 확인한다',reviewGood:'private source body'}]};
  local.set('cs_team_matches_v1',JSON.stringify(matches));
  const weeks={0:blankWeek()};
  if(options.task)weeks[0][2].reviewActions=[clone(options.task)];
  const nodes=new Map();
  function node(id){return {id,value:'',textContent:'',disabled:false,dataset:{},style:{},classList:classes(),setAttribute(){},focus(){}};}
  const sheet=node('sheet'),scrim=node('scrim');nodes.set('sheet',sheet);nodes.set('scrim',scrim);
  let closeButton=null;
  Object.defineProperty(sheet,'innerHTML',{set(html){
    for(const id of [...nodes.keys()])if(id.startsWith('rt'))nodes.delete(id);
    closeButton=node('close');
    for(const m of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
      const el=node(m[3]);el.disabled=/\bdisabled\b/.test(m[2]);
      const value=/\bvalue="([^"]*)"/.exec(m[2]);if(value)el.value=decode(value[1]);
      if(m[1]==='textarea')el.value=decode(html.slice(m.index+m[0].length).split('</textarea>')[0]);
      if(m[1]==='select'){
        const body=html.slice(m.index+m[0].length).split('</select>')[0];
        const values=[...body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)];
        const selected=values.find(v=>/\bselected\b/.test(v[1]))||values[0];
        if(selected){const val=/\bvalue="([^"]*)"/.exec(selected[1]);el.value=decode(val?val[1]:selected[2]);}
      }
      nodes.set(el.id,el);
    }
  }});
  sheet.querySelector=selector=>selector==='[data-rt-close]'?closeButton:null;
  const listeners={window:{},document:{}};
  const add=(scope,name,cb)=>(listeners[scope][name]||(listeners[scope][name]=[])).push(cb);
  const emit=(scope,name,event)=>(listeners[scope][name]||[]).forEach(fn=>fn(event));
  const document={getElementById:id=>nodes.get(id)||null,querySelector:()=>null,addEventListener:(n,cb)=>add('document',n,cb)};
  const parent={PSSync:null,postMessage:(message,origin)=>state.posted.push({message:clone(message),origin})};
  const fixedNow=new Date(2026,8,7,12).getTime();
  class ClockDate extends Date{constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return fixedNow;}}
  const c=vm.createContext({
    Date:ClockDate,Promise,console,document,parent,location:{origin:ORIGIN},PSReviewTraining:R,
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
    weeksMap:weeks,__ANCHOR:new Date(2026,8,7),wk:0,__schedGrp:'',curSession:null,
    dataReady:true,getSess:()=>state.session,cacheOwner:()=>state.cacheOwner,activeWs:()=>local.get('ps_active_ws')||'',
    PSPerms:{role:()=>state.role,canEdit:()=>state.teamEdit},schedEditBlocked:()=>state.blocked,
    offsetOfDate:d=>Math.round((d-new Date(2026,8,7))/864e5),dateOf:n=>new Date(2026,8,7+n),
    blankWeek,schedGroups:()=>['A','B'],schedDefGrp:()=>'',schedGrpWithCommon:()=>true,
    schedSetGrp:g=>{c.__schedGrp=g;},go(){},focusScheduleDate:(w,di)=>state.focused.push({w,di}),renderWeek(){},renderDay(){},
    __schedUpdateSignal(){},__schedDrainIncoming(){},toast:t=>state.toasts.push(t),
    addEventListener:(n,cb)=>add('window',n,cb),
    save(){state.saveCount++;if(!state.saveAccepted)return false;local.set(KEY,JSON.stringify({anchorMonday:'2026-09-07',weeks}));return true;},
    PSStorage:{sharedReady:()=>options.ready?options.ready.promise:Promise.resolve(),sharedVerified:(key,raw)=>{
      state.verified.push({key,raw});return options.verify?options.verify(key,raw):Promise.resolve();
    }},
  });
  c.window=c;
  vm.runInContext(section(sync,'function dataUnlocked(){','\nfunction setDataReady('),c,{filename:'sync.js real owner predicate'});
  vm.runInContext(section(storage,'  function hasMatch(day){','\n  var seq='),c,{filename:'storage.js real match predicate'});
  c.PSSchedule={hasMatch:c.hasMatch};
  parent.PSSync={session:()=>state.session,dataUnlocked:c.dataUnlocked,activeWs:c.activeWs,
    keyReady:(key,wid)=>wid===local.get('ps_active_ws')&&!state.unreadyKeys.includes(key)};
  local.set(KEY,JSON.stringify({anchorMonday:'2026-09-07',weeks}));
  vm.runInContext(source,c,{filename:'review-training-schedule.js'});
  const h={c,state,local,weeks,nodes,parent,emit,api:c.PSReviewSchedule,
    node:id=>nodes.get(id),closeClick:()=>closeButton.onclick({type:'click'}),
    open(request={matchId:'match-1'}){return c.PSReviewSchedule.open(request);},
    form(values={}){for(const [id,value]of Object.entries({rtAction:'공을 받기 전에 주변을 확인한다',rtDate:'2026-09-09',rtGroup:'A',...values}))nodes.get(id).value=value;},
    tasks:()=>R.list({anchorMonday:'2026-09-07',weeks}),
    message(data={},event={}){emit('window','message',{origin:ORIGIN,source:parent,data:{source:'app',type:'reviewTrainingOpen',uid:'user-1',wid:'team-1',matchId:'match-1',requestId:'request-1',...data},...event});},
    setMatch(change){const data=JSON.parse(local.get('cs_team_matches_v1'));change(data);local.set('cs_team_matches_v1',JSON.stringify(data));},
    shown:()=>scrim.classList.contains('show'),saved:()=>state.posted.filter(x=>x.message.type==='reviewTrainingSaved'),
  };
  return h;
}

test('successful creation uses the exact schedule verification before any saved relay',async()=>{
  const ready=deferred(),h=harness({ready});assert.equal(h.open(),true);h.form();h.api.commit();
  assert.equal(h.state.saveCount,1);assert.equal(h.saved().length,0);assert.equal(h.shown(),true);
  ready.resolve();await settle();
  assert.equal(h.saved().length,1);assert.equal(h.shown(),false);assert.equal(h.tasks().length,1);
  const t=h.tasks()[0].task;assert.equal(t.matchId,'match-1');assert.equal(t.status,'planned');assert.equal(t.action,'공을 받기 전에 주변을 확인한다');
  assert.equal(h.state.verified[0].key,KEY);assert.equal(h.state.verified[0].raw,h.local.get(KEY));
  assert.equal(h.local.get(KEY).includes('private source body'),false);
  assert.equal(h.saved()[0].origin,ORIGIN);assert.equal(h.saved()[0].message.uid,'user-1');
});

for(const [name,change]of [
  ['missing session',h=>{h.state.session=null;}],['missing sync API',h=>{h.parent.PSSync=null;}],
  ['not yet ready',h=>{h.c.dataReady=false;}],['cache owned by another account',h=>{h.state.cacheOwner.uid='other';}],
  ['schedule not confirmed ready',h=>{h.state.unreadyKeys=[KEY];}],
  ['matches not confirmed ready',h=>{h.state.unreadyKeys=['cs_team_matches_v1'];}],
  ['cache owned by another team',h=>{h.state.cacheOwner.wid='other';}],
  ['player role',h=>{h.state.role='player';}],['schedule write blocked',h=>{h.state.blocked=true;}],
  ['match write blocked',h=>{h.state.teamEdit=false;}],
  ['assigned to another staff member',h=>{h.state.role='staff';h.local.set('cs_assign_v1',JSON.stringify({match:{'match-1':'other'}}));}],
])test(`creation does not open with ${name}`,()=>{
  const h=harness();change(h);assert.equal(h.open(),false);assert.equal(h.state.saveCount,0);assert.equal(h.tasks().length,0);
});

test('stale local login text cannot replace a missing API session',()=>{
  const h=harness();h.state.session=null;assert.ok(h.local.get('ps_sync_session'));h.message();assert.equal(h.shown(),false);
});

test('missing match is rejected without creating a schedule cell',()=>{
  const h=harness();h.setMatch(d=>{d.matches=[];});assert.equal(h.open(),false);assert.equal(h.tasks().length,0);
});

for(const [name,change]of [
  ['account switched',h=>{h.state.session={uid:'user-2'};h.state.cacheOwner={uid:'user-2',wid:'team-1'};}],
  ['team switched',h=>{h.local.set('ps_active_ws','team-2');h.state.cacheOwner.wid='team-2';}],
  ['permission removed',h=>{h.state.blocked=true;}],
  ['match removed',h=>h.setMatch(d=>{d.matches=[];})],
  ['review source changed',h=>h.setMatch(d=>{d.matches[0].reviewImprove='새 개선점';})],
  ['match date changed',h=>h.setMatch(d=>{d.matches[0].date='2026-09-06';})],
  ['assigned to another coach',h=>{h.state.role='staff';h.local.set('cs_assign_v1',JSON.stringify({match:{'match-1':'other'}}));}],
])test(`open draft refuses to save after ${name}`,()=>{
  const h=harness();assert.equal(h.open(),true);h.form();change(h);h.api.commit();
  assert.equal(h.state.saveCount,0);assert.equal(h.tasks().length,0);assert.notEqual(h.node('rtError').textContent,'');
});

for(const date of ['2026-09-04','2026-09-05','2026-02-30','not-a-date'])test(`invalid next-training date ${date} cannot save`,()=>{
  const h=harness();h.open();h.form({rtDate:date});h.api.commit();assert.equal(h.state.saveCount,0);assert.equal(h.tasks().length,0);
});

for(const [name,day]of [
  ['off',{off:true}],['board off',{board:{sched:'OFF'}}],['match',{match:{opp:'Away'}}],
  ['board match',{board:{sched:'경기'}}],['legacy board type',{board:{type:'경기'}}],['legacy board kind',{board:{kind:'match'}}],
])test(`${name} day cannot receive a new training task`,()=>{
  const h=harness();Object.assign(h.weeks[0][2],day);h.open();h.form();h.api.commit();
  assert.equal(h.state.saveCount,0);assert.equal(h.tasks().length,0);
});

test('duplicate clicks during persistence create and save only one task',async()=>{
  const ready=deferred(),h=harness({ready});h.open();h.form();h.node('rtSave').onclick();h.node('rtSave').onclick();h.api.commit();
  assert.equal(h.tasks().length,1);assert.equal(h.state.saveCount,1);ready.resolve();await settle();assert.equal(h.saved().length,1);
});

test('new task input remains locked throughout both persistence checks',async()=>{
  const ready=deferred(),verify=deferred(),h=harness({ready,verify:()=>verify.promise});h.open();h.form();h.api.commit();
  const fields=['rtSource','rtCopy','rtAction','rtDate','rtGroup'];
  for(const id of fields)assert.equal(h.node(id).disabled,true,id);
  ready.resolve();await settle();assert.equal(h.shown(),true);
  for(const id of fields)assert.equal(h.node(id).disabled,true,id);
  verify.resolve();await settle();assert.equal(h.saved().length,1);assert.equal(h.shown(),false);
});

test('failed result save unlocks its inputs, retains date and groups, and retries the same task',async()=>{
  let fail=true;const h=harness({task:baseTask({grp:['A','B']}),verify:()=>fail?Promise.reject(new Error('IDB failure')):Promise.resolve()});
  h.open({taskId:'task-existing'});h.node('rtStatus').value='done';h.node('rtObservation').value='주변을 확인한 장면';h.api.commit();
  for(const id of ['rtAction','rtGroup','rtStatus','rtObservation'])assert.equal(h.node(id).disabled,true,id);
  await settle();assert.equal(h.shown(),true);assert.equal(h.saved().length,0);
  for(const id of ['rtAction','rtGroup','rtStatus','rtObservation'])assert.equal(h.node(id).disabled,false,id);
  assert.equal(h.node('rtDate').disabled,true);assert.equal(h.node('rtObservation').value,'주변을 확인한 장면');
  fail=false;h.node('rtObservation').value='재확인한 장면';h.api.commit();await settle();
  assert.equal(h.tasks().length,1);assert.equal(h.tasks()[0].task.id,'task-existing');assert.equal(h.tasks()[0].task.observation,'재확인한 장면');
  assert.deepEqual(h.tasks()[0].task.grp,['A','B']);assert.equal(h.saved().length,1);
});

test('permission loss during failed persistence does not unlock editable fields',async()=>{
  const ready=deferred(),h=harness({ready,task:baseTask()});h.open({taskId:'task-existing'});h.node('rtStatus').value='done';h.api.commit();
  h.state.blocked=true;ready.reject(new Error('IDB failure'));await settle();
  for(const id of ['rtAction','rtGroup','rtStatus','rtObservation','rtSave'])assert.equal(h.node(id).disabled,true,id);
  assert.equal(h.saved().length,0);
});

test('retrying a failed new task saves its original identity exactly once',async()=>{
  const h=harness({state:{saveAccepted:false}});h.open();h.form();h.api.commit();await settle();
  const id=h.tasks()[0].task.id;h.state.saveAccepted=true;h.api.commit();await settle();
  assert.equal(h.tasks().length,1);assert.equal(h.tasks()[0].task.id,id);assert.equal(h.saved().length,1);
});

test('malformed existing action collection is preserved without a save attempt',()=>{
  const h=harness();h.weeks[0][2].reviewActions={unexpected:'preserve'};h.open();h.form();h.api.commit();
  assert.equal(h.state.saveCount,0);assert.deepEqual(h.weeks[0][2].reviewActions,{unexpected:'preserve'});
});

test('an invalid result state cannot replace a previously valid task',()=>{
  const h=harness({task:baseTask()});h.open({taskId:'task-existing'});h.node('rtStatus').value='invalid';h.api.commit();
  assert.equal(h.state.saveCount,0);assert.equal(h.tasks()[0].task.status,'planned');
});

test('equivalent existing task reopens without adding or saving a duplicate',()=>{
  const h=harness({task:baseTask()});h.open();h.form();h.api.commit();
  assert.equal(h.tasks().length,1);assert.equal(h.state.saveCount,0);assert.equal(h.shown(),true);assert.ok(h.node('rtStatus'));
});

test('task updates preserve multiple target groups unless changed explicitly',async()=>{
  const h=harness({task:baseTask({grp:['A','B']})});h.open({taskId:'task-existing'});
  assert.equal(h.node('rtGroup').value,'__keep_groups__');h.node('rtStatus').value='done';h.node('rtObservation').value='주변을 확인한 장면이 늘었다';h.api.commit();await settle();
  assert.deepEqual(h.tasks()[0].task.grp,['A','B']);assert.equal(h.tasks()[0].task.observation,'주변을 확인한 장면이 늘었다');assert.equal(h.saved().length,1);
});

test('a concurrently changed existing task is retained and never overwritten',()=>{
  const h=harness({task:baseTask()});h.open({taskId:'task-existing'});h.node('rtObservation').value='local observation';
  h.weeks[0][2].reviewActions[0].observation='newer observation';h.api.commit();
  assert.equal(h.state.saveCount,0);assert.equal(h.tasks()[0].task.observation,'newer observation');assert.equal(h.shown(),true);
});

test('read-only players can inspect existing tasks but cannot save them',()=>{
  const h=harness({task:baseTask(),state:{role:'player'}});assert.equal(h.open({taskId:'task-existing'}),true);
  assert.equal(h.node('rtSave'),undefined);assert.equal(h.node('rtAction').disabled,true);h.api.commit();assert.equal(h.state.saveCount,0);
});

for(const [name,options]of [
  ['synchronous rejection',()=>({state:{saveAccepted:false}})],
  ['sharedReady rejection',()=>({ready:{promise:Promise.reject(new Error('IDB failure'))}})],
  ['exact sharedVerified rejection',()=>({verify:()=>Promise.reject(new Error('different IDB value'))})],
])test(`${name} keeps input open and sends no saved relay`,async()=>{
  const h=harness(options());h.open();h.form();h.api.commit();await settle();
  assert.equal(h.saved().length,0);assert.equal(h.shown(),true);assert.equal(h.node('rtAction').value,'공을 받기 전에 주변을 확인한다');
  assert.match(h.node('rtError').textContent,/확인하지 못/);assert.equal(h.node('rtSave').disabled,false);
});

test('a stored snapshot missing the exact accepted task cannot acknowledge success',async()=>{
  const ready=deferred(),h=harness({ready});h.open();h.form();h.api.commit();h.local.set(KEY,JSON.stringify({anchorMonday:'2026-09-07',weeks:{0:blankWeek()}}));
  ready.resolve();await settle();assert.equal(h.saved().length,0);assert.equal(h.shown(),true);assert.match(h.node('rtError').textContent,/확인하지 못/);
});

test('late save completion after account change cannot announce or navigate success',async()=>{
  const ready=deferred(),h=harness({ready});h.open();h.form();h.api.commit();
  h.state.session={uid:'user-2'};h.state.cacheOwner={uid:'user-2',wid:'team-1'};ready.resolve();await settle();
  assert.equal(h.saved().length,0);assert.equal(h.state.focused.length,0);assert.equal(h.state.verified.length,0);
});

test('account change during exact verification also suppresses late success',async()=>{
  const verification=deferred(),h=harness({verify:()=>verification.promise});h.open();h.form();h.api.commit();await settle();
  assert.equal(h.state.verified.length,1);h.state.session={uid:'user-2'};h.state.cacheOwner={uid:'user-2',wid:'team-1'};
  h.emit('window','storage',{key:'ps_sync_session'});assert.equal(h.shown(),false);verification.resolve();await settle();
  assert.equal(h.saved().length,0);assert.equal(h.state.focused.length,0);
});

test('close click event does not bypass the busy save guard',async()=>{
  const ready=deferred(),h=harness({ready});h.open();h.form();h.api.commit();h.closeClick();
  assert.equal(h.shown(),true);assert.match(h.node('rtError').textContent,/확인하는 중/);ready.resolve();await settle();
});

test('back to match cannot navigate away while task verification is pending',async()=>{
  const ready=deferred(),h=harness({ready,task:baseTask()});h.open({taskId:'task-existing'});h.node('rtStatus').value='done';h.api.commit();h.node('rtBack').onclick();
  assert.equal(h.shown(),true);assert.equal(h.state.posted.filter(x=>x.message.type==='reviewTrainingBack').length,0);
  ready.resolve();await settle();
});

test('back to match requires unsaved observations to be saved first',()=>{
  const h=harness({task:baseTask()});h.open({taskId:'task-existing'});h.node('rtObservation').value='unsaved';h.node('rtBack').onclick();
  assert.equal(h.shown(),true);assert.equal(h.state.posted.length,0);assert.match(h.node('rtError').textContent,/먼저 저장/);
});

for(const [name,data,event]of [
  ['foreign origin',{}, {origin:'https://other.test'}],['different frame',{}, {source:{}}],
  ['wrong declared source',{source:'scout'},{}],['wrong account',{uid:'other'},{}],['wrong workspace',{wid:'other'},{}],
  ['missing account',{uid:''},{}],['missing request id',{requestId:''},{}],
])test(`message from ${name} cannot open an editor`,()=>{
  const h=harness();h.message(data,event);assert.equal(h.shown(),false);assert.equal(h.state.saveCount,0);
});

test('replayed request id opens at most once, while a fresh request remains usable',()=>{
  const h=harness();h.message();assert.equal(h.shown(),true);h.api.close();h.message();assert.equal(h.shown(),false);
  h.message({requestId:'request-2'});assert.equal(h.shown(),true);assert.equal(h.state.saveCount,0);
});
