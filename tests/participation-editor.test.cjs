'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../studio/participation.js');
const src=fs.readFileSync(require.resolve('../studio/scout.html'),'utf8');
const code=src.slice(src.indexOf('var avSaving=false;'),src.indexOf('function avDayLabel',src.indexOf('var avSaving=false;')));
function harness(){
  let today='2026-09-15',calls=0,writes=0,readyHook=null,failSave=false,failReady=false;
  const doc={attrs:[],positions:[],players:[{id:'p',name:'동명이인',status:'ok',grp:'A팀'},{id:'q',name:'동명이인',status:'ok',grp:'A팀'}],meta:{statusRuns:{p:[{s:'injury',from:'2026-09-10',to:'2026-09-12',n:'발목',custom:{keep:true}},{s:'ok',from:'2026-09-13',to:'2026-09-15'}],q:[{s:'ok',from:'2026-09-10',to:'2026-09-15'}]}}};
  const ls=new Map([['scout_tool_v1',JSON.stringify(doc)],['ps_sync_session',JSON.stringify({uid:'u'})],['ps_active_ws','team'],['ps_cache_owner_v1',JSON.stringify({uid:'u',wid:'team'})],['cs_perms_v1','permission-1']]);
  let role='admin',can=true;
  const c=vm.createContext({Promise,JSON,Date,Set,Error,PSParticipation:model,data:structuredClone(doc),scoutBootPending:false,scMainMigrationPending:false,KEY:'scout_tool_v1',
    window:{PSPerms:{role:()=>role,canEdit:()=>can}},localStorage:{getItem:k=>ls.get(k)??null},
    scoutAutomaticWriteAllowed:()=>can,psSync:()=>({dataUnlocked:()=>true}),isTargetPl:p=>p.type==='target',plGrpOf:p=>p.grp,plStatusOf:p=>p.status||'ok',
    stYmd:()=>today,stAddDays:(d,n)=>{const v=new Date(d+'T00:00:00Z');v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10);},
    avDayKind:d=>[0,6].includes(d.getDay())?'off':'train',renderTeam(){},renderTeamHome(){},
    store:{owner:()=>ls.get('ps_active_ws'),ready:async()=>{calls++;if(readyHook)await readyHook(calls);if(failReady&&calls===2)throw Error('IDB failed');}},
    save:opts=>{writes++;if(failSave)return false;ls.set('scout_tool_v1',JSON.stringify({...c.data,players:c.data.players.filter(p=>p.type!=='target')}));return true;}
  });
  vm.runInContext(code,c);return {c,ls,doc,get:()=>JSON.parse(ls.get('scout_tool_v1')),writes:()=>writes,today:d=>{today=d;},hook:f=>{readyHook=f;},deny:()=>{can=false;role='player';},failSave:()=>{failSave=true;},failReady:()=>{failReady=true;}};
}
test('past record preserves all status runs, notes, other player and current state',async()=>{
  const h=harness(),ctx=h.c.avEditContext('p','2026-09-11');await h.c.stSetAt('p','ok','2026-09-11',ctx,'참여 확인');
  const d=h.get();assert.deepEqual(d.meta.statusRuns,h.doc.meta.statusRuns);assert.deepEqual(d.players,h.doc.players);
  assert.equal(model.resolve(d.meta,'p','2026-09-11','train','ok','2026-09-15').s,'ok');
  assert.equal(model.resolve(d.meta,'p','2026-09-10','train','ok','2026-09-15').s,'injury');
  assert.equal(model.resolve(d.meta,'p','2026-09-12','train','ok','2026-09-15').s,'injury');
  assert.equal(d.meta.participationDays['2026-09-11'].q,undefined);
});
test('today injury carries through weekends and return closes it while preserving its note',async()=>{
  const h=harness();await h.c.stSetAt('p','injury','2026-09-15',h.c.avEditContext('p','2026-09-15'),'발목 관리');
  let d=h.get();assert.equal(d.players[0].status,'injury');assert.equal(model.resolve(d.meta,'p','2026-09-20','off','injury','2026-09-20').s,'injury');
  h.today('2026-09-21');await h.c.stSetAt('p','ok','2026-09-21',h.c.avEditContext('p','2026-09-21'),'복귀');d=h.get();
  assert.equal(model.resolve(d.meta,'p','2026-09-20','off','ok','2026-09-21').s,'injury');assert.equal(model.resolve(d.meta,'p','2026-09-21','train','ok','2026-09-21').s,'ok');
  const injury=d.meta.statusRuns.p.find(r=>r.from==='2026-09-15');assert.equal(injury.to,'2026-09-20');assert.equal(injury.n,'발목 관리');
});
for(const change of ['account','team','seal','epoch','permissions','role'])test('open editor cannot save after '+change+' changes',async()=>{
  const h=harness(),ctx=h.c.avEditContext('p','2026-09-11');
  if(change==='account')h.ls.set('ps_sync_session',JSON.stringify({uid:'other'}));
  if(change==='team')h.ls.set('ps_active_ws','other');if(change==='seal')h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:'u',wid:'team',generation:2}));
  if(change==='epoch')h.ls.set('ps_ws_switch_epoch_v1','2');if(change==='permissions')h.ls.set('cs_perms_v1','permission-2');if(change==='role')h.deny();
  await assert.rejects(h.c.stSetAt('p','ok','2026-09-11',ctx));assert.equal(h.writes(),0);
});
test('owner change while awaiting earlier writes blocks mutation',async()=>{
  const h=harness(),ctx=h.c.avEditContext('p','2026-09-11');h.hook(async n=>{if(n===1)h.ls.set('ps_ws_switch_epoch_v1','2');});
  await assert.rejects(h.c.stSetAt('p','ok','2026-09-11',ctx));assert.equal(h.writes(),0);
});
test('a different date and another player saved during wait remain intact',async()=>{
  const h=harness(),ctx=h.c.avEditContext('p','2026-09-11');h.hook(async n=>{if(n===1){let d=h.get();d.meta=model.record(d.meta,'q','2026-09-12','out','train',1,'2026-09-15','다른 기록');d.players[1].name='새 이름';h.ls.set('scout_tool_v1',JSON.stringify(d));}});
  await h.c.stSetAt('p','ok','2026-09-11',ctx);const d=h.get();assert.equal(d.players[1].name,'새 이름');assert.equal(d.meta.participationDays['2026-09-12'].q.s,'out');
});
test('same-cell change during wait requires a fresh view and sends no write',async()=>{
  const h=harness(),ctx=h.c.avEditContext('p','2026-09-11');h.hook(async n=>{if(n===1){const d=h.get();d.meta=model.record(d.meta,'p','2026-09-11','rest','train',1,'2026-09-15');h.ls.set('scout_tool_v1',JSON.stringify(d));}});
  await assert.rejects(h.c.stSetAt('p','ok','2026-09-11',ctx));assert.equal(h.writes(),0);
});
test('failed durable write rejects completion and retains submitted day in local mirror',async()=>{
  const h=harness();h.failReady();await assert.rejects(h.c.stSetAt('p','ok','2026-09-11',h.c.avEditContext('p','2026-09-11')));assert.equal(h.get().meta.participationDays['2026-09-11'].p.s,'ok');
});
test('save rejection does not claim completion or replace persisted records',async()=>{
  const h=harness();h.failSave();await assert.rejects(h.c.stSetAt('p','ok','2026-09-11',h.c.avEditContext('p','2026-09-11')));assert.deepEqual(h.get(),h.doc);
});
test('future or malformed date cannot create a record',async()=>{
  for(const day of ['2026-09-16','2026-02-30']){const h=harness();await assert.rejects(async()=>h.c.stSetAt('p','ok',day,h.c.avEditContext('p',day)));assert.equal(h.writes(),0);}
});

test('explicit current-state changes in other views update only the current direct cell',async()=>{
  const h=harness();h.c.window.PSParticipation=model;
  await h.c.stSetAt('p','injury','2026-09-15',h.c.avEditContext('p','2026-09-15'),'발목');
  const before=structuredClone(h.c.data.meta.statusRuns);
  h.c.data.meta=model.record(h.c.data.meta,'p','2026-09-11','rehab','train',1,'2026-09-15','과거 메모');
  h.c.avUpdateTodayRecord('p','ok');
  assert.equal(h.c.data.meta.participationDays['2026-09-15'].p.s,'ok');
  assert.equal(h.c.data.meta.participationDays['2026-09-15'].p.n,'발목');
  assert.equal(h.c.data.meta.participationDays['2026-09-11'].p.s,'rehab');
  assert.equal(h.c.data.meta.participationDays['2026-09-11'].p.n,'과거 메모');
  assert.deepEqual(JSON.parse(JSON.stringify(h.c.data.meta.statusRuns)),before);
});

function reasonEditor(h){
  const nodes={input:{value:'',disabled:false,focus(){}},ok:{disabled:false},error:{textContent:''},close:{}};
  const overlay={removed:false,innerHTML:'',addEventListener(){},remove(){this.removed=true;},querySelector(s){return ({'#stNoteInp':nodes.input,'#stNoteOk':nodes.ok,'#stNoteError':nodes.error,'.ts-x':nodes.close})[s];}};
  h.c.document={createElement:()=>overlay,body:{appendChild(){}}};
  h.c.PL_STATUS=[];h.c.ST_DOT={};h.c.esc=String;
  h.c.stRuns=()=>h.c.data.meta.statusRuns;
  h.c.stCurRun=pid=>h.c.data.meta.statusRuns[pid].at(-1);
  h.c.renderStatusView=()=>{};h.c.itemsRerender=()=>{};
  const begin=src.indexOf('function stNoteModal(pid){'),end=src.indexOf('function stGroupAdd(){',begin);
  assert.ok(begin>=0&&end>begin);vm.runInContext(src.slice(begin,end),h.c);
  h.c.stNoteModal('p');return {...nodes,overlay};
}
test('legacy availability reason editor saves through the same day record and preserves past notes',async()=>{
  const h=harness();await h.c.stSetAt('p','injury','2026-09-15',h.c.avEditContext('p','2026-09-15'),'원래 사유');
  const past=JSON.stringify(h.get().meta.statusRuns.p.slice(0,-1));
  const ui=reasonEditor(h);ui.input.value='오늘 변경 사유';await ui.ok.onclick();
  const d=h.get();assert.equal(d.players[0].status,'injury');
  assert.equal(d.meta.participationDays['2026-09-15'].p.n,'오늘 변경 사유');
  assert.equal(d.meta.statusRuns.p.at(-1).n,'오늘 변경 사유');
  assert.equal(JSON.stringify(d.meta.statusRuns.p.slice(0,-1)),past);assert.equal(ui.overlay.removed,true);
});
test('clearing an availability reason clears today in both views without erasing past notes',async()=>{
  const h=harness();await h.c.stSetAt('p','injury','2026-09-15',h.c.avEditContext('p','2026-09-15'),'오늘 사유');
  const ui=reasonEditor(h);ui.input.value='';await ui.ok.onclick();const d=h.get();
  assert.equal(d.meta.participationDays['2026-09-15'].p.n,'');assert.equal(d.meta.statusRuns.p.at(-1).n,undefined);
  assert.equal(d.meta.statusRuns.p[0].n,'발목');
});
test('failed reason save keeps the draft visible and never claims completion',async()=>{
  const h=harness();await h.c.stSetAt('p','injury','2026-09-15',h.c.avEditContext('p','2026-09-15'),'저장본');
  const before=h.get(),ui=reasonEditor(h);h.failSave();ui.input.value='미저장 초안';await ui.ok.onclick();
  assert.deepEqual(h.get(),before);assert.equal(ui.overlay.removed,false);assert.equal(ui.input.value,'미저장 초안');
  assert.equal(ui.input.disabled,false);assert.equal(ui.ok.disabled,false);assert.match(ui.error.textContent,/기록하지 못했습니다/);
});
test('reason dialog cannot write after the active team changes',async()=>{
  const h=harness();await h.c.stSetAt('p','injury','2026-09-15',h.c.avEditContext('p','2026-09-15'),'저장본');
  const ui=reasonEditor(h),writes=h.writes();h.ls.set('ps_active_ws','other');ui.input.value='이전 팀 초안';await ui.ok.onclick();
  assert.equal(h.writes(),writes);assert.equal(ui.overlay.removed,true);
});
