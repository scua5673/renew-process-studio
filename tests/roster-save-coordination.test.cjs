'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function section(a,b){const i=scout.indexOf(a),j=scout.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return scout.slice(i,j);}
const fn=name=>section('function '+name+'(','\nfunction ');
const coordinator=section('/* 2.825 — roster save coordinator.','\nfunction save(){');
const behavior=coordinator+'\n'+fn('save')+'\n'+fn('itemsPI')+'\n'+fn('itemsApply');
// Reuse the actual PSSaveState, shared-write queue and scout store, without
// registering that file's tests. The SQ patch writer is an explicit boundary:
// its own CAS/preimage contract is covered by roster-write-reliability tests.
const harnessPath=path.join(__dirname,'roster-main-durability.test.cjs'),harnessSource=fs.readFileSync(harnessPath,'utf8');
const box={require:createRequire(harnessPath),__dirname,module:{exports:{}},console,setTimeout,clearTimeout,setImmediate};
vm.runInNewContext(harnessSource.slice(0,harnessSource.indexOf("\ntest('"))+'\nmodule.exports={harness,deferred,tick};',box,{filename:harnessPath});
const {harness:durable,deferred,tick}=box.module.exports;
const MAIN='scout_tool_v1',MIRROR='cs_squad_v1',ATTRS='cs_team_attrs_v1',TARGET='cs_scout_targets_v1',DELETED='cs_player_del_v1';
const Outbox=require('../studio/roster-outbox.js');
const raw=JSON.stringify,copy=v=>JSON.parse(raw(v));
function original(){return {attrs:[{id:'passing',cat:'tech',name:'Passing',q:'Team question'}],positions:[{id:'cb',name:'CB',req:{passing:3}}],players:[
  {id:'p1',name:'Same name',num:'1',posId:'cb',grp:'A',status:'ok',levels:{passing:0},memo:'original one'},
  {id:'p2',name:'Same name',num:'2',posId:'cb',grp:'B',status:'injury',levels:{passing:4},memo:'original two'}
],meta:{evalMode:'fifa',activeEvalSetId:'kept-set',teamName:'Synthetic team',statusRuns:{p2:[{s:'injury',from:'2026-09-10',to:'2026-09-15'}]},participationDays:{'2026-09-11':{p2:{s:'ok',kind:'train',at:1,n:'retained past note'}}}},_items:{build:'2.824',n:2}};}
function fixture({privateCandidate=false,persisted=null}={}){
  const h=durable(),c=h.c,rowCalls=[],rowWrites=[],rowJobs=[],rowState={failure:false,rejectBeforeEnqueue:false,gate:null,active:true},state={edit:true,keep:0},localWrites=[];
  if(persisted){h.values.clear();h.disk.clear();for(const [k,v] of persisted.values)h.values.set(k,v);for(const [k,v] of persisted.disk)h.disk.set(k,v);}
  const initial=persisted?JSON.parse(h.values.get(MAIN)):original();
  if(!persisted){h.values.set(MAIN,raw(initial));h.disk.set(MAIN,raw(initial));h.values.set(DELETED,'{}');h.values.set('cs_perms_v1',raw({members:{'coach-a':{role:'executive'}}}));}
  const candidate={id:'private',type:'target',name:'Private candidate',memo:'Do not publish',levels:{passing:1},_scoutRef:{id:'sensitive'}};
  const privateRaw=raw({v:1,players:[candidate],scoutRegistry:{retained:true}});if(!persisted){h.values.set(TARGET,privateRaw);h.disk.set(TARGET,privateRaw);}
  const set=c.localStorage.setItem;c.localStorage.setItem=(k,v)=>{localWrites.push({k,v});return set(k,v);};
  c.localStorage.removeItem=k=>h.values.delete(k);c.localStorage.key=i=>[...h.values.keys()][i]??null;Object.defineProperty(c.localStorage,'length',{get:()=>h.values.size});
  Object.assign(c,{KEY:MAIN,TKEY:TARGET,PDKEY:DELETED,data:copy(initial),scoutBootPending:false,scoutReadOnlyLoad:false,scMainMigrationPending:false,
    PS_BUILD:'2.825',PSPerms:{role:()=>state.edit?'executive':'player',canEdit:()=>state.edit},
    PSSync:{dataUnlocked:()=>true},PSRosterOutbox:Outbox,isTargetPl:p=>p?.type==='target',canSeeTargets:()=>true,scoutAutomaticWriteAllowed:()=>state.edit,
    evalMode:()=>c.data.meta.evalMode,evalSetId:()=> 'current-set',rememberTeamSet(){throw Error('Unexpected team-set activation');},
    posAbbr:x=>x,plStatusOf:p=>p.status||'ok',plTombApply:players=>{const tombs=JSON.parse(h.values.get(DELETED)||'{}');return players.filter(p=>!tombs[p.id]);},
    rosterKeepSave:()=>state.keep++,psAct(){},
    scSaveTargetDoc(v){h.values.set(TARGET,raw(v));h.disk.set(TARGET,raw(v));localWrites.push({k:TARGET,v:raw(v)});return true;},
  });
  if(privateCandidate)c.data.players.push(copy(candidate));
  async function deliver(job){
    if(rowState.gate)await rowState.gate.promise;
    if(rowState.failure)throw Error('synthetic SQ durability failure');
    if(job.owner!==c.teamSaveOwner())throw Error('synthetic SQ owner changed');
    if(!job.done){for(const id of job.options.changedIds||[]){const p=job.players.find(p=>p.id===id);if(p){h.disk.set('sq:'+id,raw(p));rowWrites.push(id);}}job.done=true;}
    return {n:job.players.length,wrote:(job.options.changedIds||[]).length};
  }
  c.PSItems={patchVersion:1,active:()=>rowState.active,readAll:async()=>null,
    writeReady(players,options){if(rowState.rejectBeforeEnqueue)throw Error('synthetic SQ rejected before enqueue');const job={players:copy(players),options:copy(options||{}),owner:c.teamSaveOwner(),done:false};rowCalls.push(job);rowJobs.push(job);return deliver(job);},
    async flush(){for(const job of rowJobs)if(!job.done)await deliver(job);return true;}
  };c.parent=c;
  vm.runInContext(behavior,c,{filename:'actual roster save coordinator and projection'});
  c.rosterRemember(initial.players);
  return Object.assign(h,{c,initial,candidate,privateRaw,rowCalls,rowWrites,rowState,state,localWrites,
    save:options=>c.save({skipTargets:true,...options}),ready:retry=>h.store.ready(retry),
    persisted:()=>({values:[...h.values],disk:[...h.disk]}),
    // These are the reload boundary operations inside actual load(); rendering
    // and unrelated evaluation migrations are outside this coordinator fixture.
    resume(){c.data.players=c.rosterOutbox().overlay(c.data.players);c.rosterRemember(c.data.players);return c.rosterResumeRows();},
    main:()=>JSON.parse(h.values.get(MAIN)),mirror:()=>JSON.parse(h.values.get(MIRROR)),
    project(players){c.PSItems.readAll=async()=>({rows:players.map(p=>'sq:'+p.id),players:copy(players),confirmed:Object.fromEntries(players.map(p=>['sq:'+p.id,true])),held:{},tombs:{}});return c.itemsApply('test');}
  });
}
function changed(h){return h.rowCalls.flatMap(job=>job.options.changedIds||[]);}

test('metadata-only save preserves detailed records and does not enqueue unchanged player rows',async()=>{
  const h=fixture();h.c.data.meta.teamName='Renamed synthetic team';h.c.data.meta.participationDays['2026-09-11'].p2.n='Corrected note';
  assert.equal(h.save(),true);await h.ready();assert.deepEqual(changed(h),[]);assert.deepEqual(h.rowWrites,[]);
  assert.equal(h.main().meta.participationDays['2026-09-11'].p2.n,'Corrected note');assert.deepEqual(h.main().meta.statusRuns,h.initial.meta.statusRuns);assert.equal(h.mirror().name,'Renamed synthetic team');
  assert.equal(h.values.get(MAIN),h.disk.get(MAIN));assert.equal(h.values.get(MIRROR),h.disk.get(MIRROR));
});

test('a player edit sends only its stable ID and never publishes candidate fields',async()=>{
  const h=fixture({privateCandidate:true});h.c.data.players[0].memo='New original note';h.c.data.players[0]._scoutRef={secret:true};
  assert.equal(h.save(),true);await h.ready();assert.deepEqual(changed(h),['p1']);assert.deepEqual(h.rowWrites,['p1']);
  assert.deepEqual(h.main().players.map(p=>p.id),['p1','p2']);assert.deepEqual(h.mirror().players.map(p=>p.id),['p1','p2']);
  assert.equal(h.rowCalls[0].players.some(p=>p.type==='target'||p._scoutRef),false);assert.equal(h.values.get(TARGET),h.privateRaw);
  assert.deepEqual(h.rowCalls[0].options.basePlayers,[h.initial.players[0]]);
  assert.equal(h.main().players[0].levels.passing,0);assert.equal(h.c.data.players.find(p=>p.id==='private').memo,h.candidate.memo);
});

test('new and deleted IDs remain explicit even when players share the same name',async()=>{
  const h=fixture();h.c.data.players=h.c.data.players.filter(p=>p.id!=='p2');h.c.data.players.push({...copy(h.initial.players[0]),id:'p3'});
  assert.equal(h.save({deletedIds:['p2']}),true);await h.ready();assert.deepEqual(changed(h),['p3']);assert.deepEqual(h.rowCalls[0].options.deletedIds,['p2']);assert.deepEqual(h.main().players.map(p=>p.id),['p1','p3']);
});

test('naming an empty new-player draft creates its first row with an absent CAS base',async()=>{
  const h=fixture(),draft={id:'new-player',name:'',num:'3',posId:'cb',grp:'A',status:'ok',levels:{passing:0},memo:'note entered before name'};
  h.c.data.players.push(draft);assert.equal(h.save(),true);await h.ready();assert.deepEqual(h.rowCalls,[]);assert.equal(h.c.rosterPendingRows(),false);assert.equal(h.main().players.find(p=>p.id===draft.id).memo,draft.memo);
  draft.name='   ';assert.equal(h.save(),true);await h.ready();assert.deepEqual(h.rowCalls,[]);
  const gate=deferred();h.rowState.gate=gate;draft.name='Named new player';assert.equal(h.save(),true);
  assert.deepEqual(changed(h),['new-player']);assert.deepEqual(h.rowCalls[0].options.basePlayers,[]);assert.equal(h.c.rosterOutbox().read().rows[0].base,null);
  gate.resolve();await h.ready();assert.equal(h.c.rosterPendingRows(),false);assert.equal(JSON.parse(h.disk.get('sq:new-player')).name,'Named new player');assert.equal(JSON.parse(h.disk.get('sq:new-player')).levels.passing,0);
});

test('a second edit compares with the accepted snapshot instead of resending earlier changes',async()=>{
  const h=fixture();h.c.data.players[0].memo='first change';h.save();await h.ready();h.c.data.players[1].memo='second change';h.save();await h.ready();
  assert.deepEqual(h.rowCalls.map(job=>job.options.changedIds),[['p1'],['p2']]);
});

test('main rejection stops candidate, item and public mirror mutations',()=>{
  const h=fixture({privateCandidate:true}),before=h.values.get(MAIN),set=h.store.set;h.store.set=(k,v)=>k===MAIN?false:set(k,v);
  h.c.data.players[0].memo='rejected';assert.equal(h.c.save(),false);assert.equal(h.values.get(MAIN),before);assert.deepEqual(h.rowCalls,[]);assert.deepEqual(h.localWrites.filter(x=>!x.k.startsWith(Outbox.prefix)),[]);assert.equal(h.values.get(TARGET),h.privateRaw);assert.equal(h.c.rosterPendingRows(),true);
});

test('duplicate player identity is rejected before overwriting the persisted main roster',()=>{
  const h=fixture(),before=h.values.get(MAIN);h.c.data.players.push({...copy(h.initial.players[0]),memo:'conflicting duplicate'});
  let accepted,error;try{accepted=h.save();}catch(e){error=e;}
  assert.ok(error||accepted===false);assert.equal(h.values.get(MAIN),before);assert.deepEqual(h.rowCalls,[]);assert.deepEqual(h.localWrites,[]);
});

test('mirror IndexedDB failure is part of the same strict ready barrier and exact retry',async()=>{
  const h=fixture();h.hooks.set=k=>{if(k===MIRROR)throw Error('synthetic mirror failure');};h.save();
  await assert.rejects(h.ready(),/mirror failure/);assert.equal(h.c.PSSaveState.get('team'),'failed');assert.equal(h.store.hasFailed(MIRROR),true);
  delete h.hooks.set;await h.ready(true);assert.equal(h.values.get(MIRROR),h.disk.get(MIRROR));assert.equal(h.c.PSSaveState.get('team'),'saved');
});

test('public attributes storage rejection cannot be reported as a complete roster save',async()=>{
  const h=fixture(),set=h.c.localStorage.setItem;h.c.localStorage.setItem=(k,v)=>{if(k===ATTRS)throw Error('synthetic attributes quota');return set(k,v);};
  assert.equal(h.save(),false);await assert.rejects(h.ready());assert.equal(h.c.PSSaveState.get('team'),'failed');assert.equal(h.values.has(ATTRS),false);
});

test('durable main and mirrors are still saving until the changed player row finishes',async()=>{
  const h=fixture(),gate=deferred();h.rowState.gate=gate;h.c.data.players[0].memo='waiting row';assert.equal(h.save(),true);
  let completed=false;const ready=h.ready().then(()=>{completed=true;});await tick();assert.equal(completed,false);assert.equal(h.c.PSSaveState.get('team'),'saving');
  gate.resolve();await ready;assert.equal(h.c.PSSaveState.get('team'),'saved');assert.equal(JSON.parse(h.disk.get('sq:p1')).memo,'waiting row');
});

test('row failure remains failed after main durability and recovers through strict row retry',async()=>{
  const h=fixture();h.rowState.failure=true;h.c.data.players[0].memo='row retry';h.save();await assert.rejects(h.ready(),/SQ durability/);
  assert.equal(h.values.get(MAIN),h.disk.get(MAIN));assert.equal(h.c.PSSaveState.get('team'),'failed');
  h.rowState.failure=false;await h.ready(true);assert.equal(JSON.parse(h.disk.get('sq:p1')).memo,'row retry');assert.equal(h.c.PSSaveState.get('team'),'saved');
});

test('row-disabled mode still durably saves the main document and public mirror',async()=>{
  const h=fixture();h.rowState.active=false;h.c.data.players[0].memo='local mode';h.save();await h.ready();assert.deepEqual(h.rowCalls,[]);assert.equal(h.values.get(MAIN),h.disk.get(MAIN));assert.equal(h.values.get(MIRROR),h.disk.get(MIRROR));
});

test('confirmed projection persists main and mirror without metadata activation, candidate write or row feedback',async()=>{
  const h=fixture({privateCandidate:true}),beforeMeta=raw(h.c.data.meta),players=copy(h.initial.players);players[0].memo='confirmed remote';
  assert.equal(await h.project(players),true);await h.ready();assert.equal(h.main().players[0].memo,'confirmed remote');assert.equal(raw(h.c.data.meta),beforeMeta);assert.equal(raw(h.main().meta),beforeMeta);
  assert.deepEqual(h.rowCalls,[]);assert.equal(h.values.get(TARGET),h.privateRaw);assert.equal(h.state.keep,0);assert.ok(h.c.data.players.some(p=>p.id==='private'));
});

for(const race of ['owner','draft','main','deletion'])test('projection rejects '+race+' changes while row data is loading',async()=>{
  const h=fixture(),gate=deferred(),players=copy(h.initial.players);players[0].memo='stale remote';h.c.PSItems.readAll=()=>gate.promise;const pending=h.c.itemsApply('delayed');
  if(race==='owner'){h.values.set('ps_sync_session','{"uid":"coach-b"}');h.values.set('ps_active_ws','team-b');h.values.set('ps_cache_owner_v1','{"uid":"coach-b","wid":"team-b"}');}
  if(race==='draft')h.c.data.players[0].memo='new typed edit';
  if(race==='main'){const newer=copy(h.initial);newer.players[0].memo='new stored edit';h.values.set(MAIN,raw(newer));}
  if(race==='deletion')h.values.set(DELETED,'{"p1":42}');
  const dataBefore=raw(h.c.data),mainBefore=h.values.get(MAIN),calls=h.calls.length;
  gate.resolve({rows:['sq:p1','sq:p2'],players,confirmed:{'sq:p1':true,'sq:p2':true},held:{},tombs:{}});
  assert.equal(await pending,false);assert.equal(raw(h.c.data),dataBefore);assert.equal(h.values.get(MAIN),mainBefore);assert.equal(h.calls.length,calls);assert.deepEqual(h.rowCalls,[]);
});

test('read-only projection changes only the visible model and never starts save work',async()=>{
  const h=fixture(),players=copy(h.initial.players);h.state.edit=false;players[0].memo='latest readonly';
  const before=h.values.get(MAIN);assert.equal(await h.project(players),true);await h.ready();assert.equal(h.c.data.players[0].memo,'latest readonly');assert.equal(h.values.get(MAIN),before);assert.deepEqual(h.rowCalls,[]);assert.deepEqual(h.localWrites,[]);assert.equal(h.c.PSSaveState.get('team'),'idle');
});

test('a rejected row enqueue cannot be ACKed by a successful empty flush',async()=>{
  const h=fixture();h.rowState.rejectBeforeEnqueue=true;h.c.data.players[0].memo='durable rejected intent';
  assert.equal(h.save(),false);await assert.rejects(h.ready(),/before enqueue/);assert.deepEqual(h.rowCalls,[]);assert.equal(h.c.rosterPendingRows(),true);
  await assert.rejects(h.ready(true),/before enqueue/);assert.equal(h.c.rosterPendingRows(),true);assert.equal(h.disk.has('sq:p1'),false);
  h.rowState.rejectBeforeEnqueue=false;await h.ready(true);assert.equal(h.c.rosterPendingRows(),false);assert.equal(JSON.parse(h.disk.get('sq:p1')).memo,'durable rejected intent');assert.deepEqual(h.rowCalls[0].options.basePlayers,[h.initial.players[0]]);
});

test('reload retains an uncommitted row and its original base even after main is refreshed from the server',async()=>{
  const first=fixture();first.rowState.failure=true;first.c.data.players[0].memo='must survive reload';first.save();await assert.rejects(first.ready(),/SQ durability/);
  assert.equal(first.c.rosterPendingRows(),true);const persisted=first.persisted();
  // The parent can receive a server compatibility snapshot before the child
  // reloads; the owner-scoped pending row remains the user's latest edit.
  persisted.values=persisted.values.map(([k,v])=>[k,k===MAIN?raw(first.initial):v]);persisted.disk=persisted.disk.map(([k,v])=>[k,k===MAIN?raw(first.initial):v]);
  const second=fixture({persisted}),gate=deferred();second.rowState.gate=gate;assert.equal(second.resume(),true);await tick();
  assert.equal(second.c.data.players[0].memo,'must survive reload');assert.equal(second.main().players[0].memo,'must survive reload');assert.equal(second.c.rosterPendingRows(),true);assert.deepEqual(changed(second),['p1']);assert.deepEqual(second.rowCalls[0].options.basePlayers,[first.initial.players[0]]);
  const remote=copy(first.initial.players);remote[1].memo='independent confirmed edit';assert.equal(await second.project(remote),true);
  assert.equal(second.main().players[0].memo,'must survive reload');assert.equal(second.main().players[1].memo,'independent confirmed edit');assert.equal(second.c.rosterPendingRows(),true);
  gate.resolve();await second.ready();assert.equal(second.c.rosterPendingRows(),false);assert.equal(JSON.parse(second.disk.get('sq:p1')).memo,'must survive reload');assert.equal(second.disk.has('sq:p2'),false);assert.equal(second.values.get(MAIN),second.disk.get(MAIN));
});

test('reload replays only the newest pending row while keeping the original CAS base',async()=>{
  const first=fixture();first.rowState.failure=true;first.c.data.players[0].memo='first unsent';first.save();await assert.rejects(first.ready());
  const partial=copy(first.rowCalls[0].players[0]);first.disk.set('sq:p1',raw(partial));
  first.c.data.players[0].memo='second unsent';first.save();await assert.rejects(first.ready());
  const second=fixture({persisted:first.persisted()});assert.equal(second.resume(),true);await second.ready();
  assert.equal(second.rowCalls.length,1);assert.equal(second.rowCalls[0].players[0].memo,'second unsent');assert.deepEqual(second.rowCalls[0].options.basePlayers,[first.initial.players[0]]);assert.deepEqual(second.rowCalls[0].options.baseHistory,[{id:'p1',players:[partial]}]);assert.equal(second.c.rosterPendingRows(),false);assert.equal(JSON.parse(second.disk.get('sq:p1')).memo,'second unsent');
});

test('a late row completion cannot acknowledge the previous owner pending edit',async()=>{
  const h=fixture(),gate=deferred(),owner=h.values.get('ps_sync_session');h.rowState.gate=gate;h.c.data.players[0].memo='owner A edit';h.save();
  h.values.set('ps_sync_session','{"uid":"coach-b"}');gate.resolve();await tick();await tick();
  assert.equal(h.disk.has('sq:p1'),false);h.values.set('ps_sync_session',owner);assert.equal(h.c.rosterPendingRows(),true);assert.equal(h.c.rosterOutbox().read().rows[0].player.memo,'owner A edit');
});

test('outbox quota failure stops the main save before an unretained row can be published',async()=>{
  const h=fixture(),before=h.values.get(MAIN),set=h.c.localStorage.setItem;h.c.localStorage.setItem=(k,v)=>{if(k.startsWith(Outbox.prefix))throw Error('synthetic intent quota');return set(k,v);};
  h.c.data.players[0].memo='unretained';assert.equal(h.save(),false);await assert.rejects(h.ready(),/intent quota/);assert.equal(h.values.get(MAIN),before);assert.deepEqual(h.rowCalls,[]);assert.equal(h.values.has(MIRROR),false);
});

test('an old parent API never receives a partial roster and its retained intent resumes after an updated reload',async()=>{
  for(const capability of [undefined,0,'1']){
    const h=fixture();if(capability===undefined)delete h.c.PSItems.patchVersion;else h.c.PSItems.patchVersion=capability;
    h.c.data.players[0].memo='retained for the updated app';assert.equal(h.save(),false);await assert.rejects(h.ready());
    assert.deepEqual(h.rowCalls,[]);assert.deepEqual(h.rowWrites,[]);assert.equal(h.c.rosterPendingRows(),true);assert.deepEqual(h.main().players.map(p=>p.id),['p1','p2']);
    // Retrying the captured incompatible API cannot turn an empty flush into
    // success. A fresh compatible application resumes the durable intent.
    h.c.PSItems.patchVersion=1;await assert.rejects(h.ready(true));assert.deepEqual(h.rowCalls,[]);assert.equal(h.c.rosterPendingRows(),true);
    const updated=fixture({persisted:h.persisted()});assert.equal(updated.resume(),true);await updated.ready();assert.deepEqual(changed(updated),['p1']);assert.equal(updated.c.rosterPendingRows(),false);assert.equal(JSON.parse(updated.disk.get('sq:p1')).memo,'retained for the updated app');assert.deepEqual(updated.main().players.map(p=>p.id),['p1','p2']);
  }
});
