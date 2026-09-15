'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function section(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const popup=section(source,'function tmPosPopup(','\n/* 스카우트 피치 자리 클릭'),
  handler=section(popup,"  p.querySelector('.tmpop-list').addEventListener('click',", "  p.querySelector('.tmpop-list').addEventListener('input',");
function fixtureFrom(name){
  const file=path.join(__dirname,name),code=fs.readFileSync(file,'utf8'),box={require:createRequire(file),__dirname,module:{exports:{}},console,URL,setImmediate,setTimeout,clearTimeout,Buffer};
  vm.runInNewContext(code.slice(0,code.indexOf("\ntest('"))+'\nmodule.exports={fixture};',box,{filename:file});
  return box.module.exports.fixture;
}
// The existing fixtures execute the actual SQ writer/sync and durable outbox.
// Only this popup's DOM and confirmation UI are substituted here.
const liveFixture=fixtureFrom('roster-projection-safety.test.cjs'),durableFixture=fixtureFrom('roster-save-coordination.test.cjs');
const raw=JSON.stringify,copy=v=>JSON.parse(raw(v)),PD='cs_player_del_v1',MAIN='scout_tool_v1';
const player=(id)=>({id,name:'Same name',posId:'cb',type:'ours',grp:'A',memo:'Original '+id});
function mount(h){
  let click,confirmed,closed=false;const notices=[],list={innerHTML:'',addEventListener(type,fn){if(type==='click')click=fn;}},p={querySelector:()=>list};
  Object.assign(h.c,{p,__tmpop:p,popupOwner:h.c.teamSaveOwner(),po:{id:'cb'},rowsHtml:()=>'',
    redrawTeamPitch(){},renderTeam(){},closeTmPop(){closed=true;h.c.__tmpop=null;},psConfirm(_message,fn){assert.equal(closed,true,'the position popup closes before the confirmation opens');confirmed=fn;},toast:m=>notices.push(m)});
  vm.runInContext(handler,h.c,{filename:'actual team-position deletion handler'});
  return {notices,click(id){confirmed=null;click({target:{closest:()=>({getAttribute:()=>id})}});},
    confirm(){assert.equal(typeof confirmed,'function');confirmed();},hasConfirmation:()=>typeof confirmed==='function'};
}
test('position popup deletion persists the exact tombstone and SQ deletion, without touching same-name players or candidates',async()=>{
  const h=liveFixture([player('keep'),player('remove')]),candidate={...player('private'),type:'target',memo:'Private candidate original'};
  h.c.data.players.push(copy(candidate));h.c.canSeeTargets=()=>true;
  h.local.set(h.c.TKEY,raw({v:1,players:[candidate]}));const candidateRaw=h.local.get(h.c.TKEY),otherRaw=h.idb.get('sq:keep'),calls=[],write=h.c.PSItems.writeReady;
  h.c.PSItems.writeReady=(players,options)=>{calls.push(copy(options));return write(players,options);};
  const ui=mount(h);ui.click('remove');assert.equal(h.c.data.players.length,3,'no deletion before confirmation');
  h.c.data.players.reverse();ui.confirm();await h.c.itemsWriteFlush();
  assert.ok(JSON.parse(h.local.get(PD)).remove);assert.deepEqual(calls.map(x=>x.deletedIds),[['remove']]);
  assert.deepEqual(calls[0].changedIds,[]);assert.equal(h.local.get(h.c.TKEY),candidateRaw);
  assert.equal(h.idb.get('sq:keep'),otherRaw);assert.ok(JSON.parse(h.idb.get('sq:remove'))._del);
  await h.round();await h.round();assert.ok(JSON.parse(h.server.get('sq:remove').v)._del);
  assert.deepEqual(Array.from(h.main().players,p=>p.id),['keep']);assert.equal(h.local.get(h.c.TKEY),candidateRaw);
  assert.equal(ui.notices.length,0,'no premature saved-success notice');
});
test('failed deletion-record write leaves the visible and saved roster intact and starts no SQ request',()=>{
  const h=liveFixture([player('keep'),player('remove')]),before=h.local.get(MAIN),ui=mount(h),set=h.c.store.set;
  h.c.store.set=(k,v)=>k===PD?false:set(k,v);ui.click('remove');ui.confirm();
  assert.deepEqual(Array.from(h.c.data.players,p=>p.id),['keep','remove']);assert.equal(h.local.get(MAIN),before);
  assert.equal(h.c._itemsActiveJobs.length,0);assert.equal(h.c.rosterOutbox().pending(),false);
});
test('cancelled confirmation writes neither a tombstone nor a pending deletion',()=>{
  const h=liveFixture([player('remove')]),ui=mount(h),before=h.local.get(MAIN);ui.click('remove');
  assert.equal(ui.hasConfirmation(),true);assert.equal(h.local.get(PD),'{}');assert.equal(h.local.get(MAIN),before);assert.equal(h.c.rosterOutbox().pending(),false);
});
for(const race of ['owner','permission','player changed'])test('confirmation refuses deletion after '+race,()=>{
  const h=liveFixture([player('remove')]),ui=mount(h),before=h.local.get(MAIN);ui.click('remove');
  if(race==='owner')h.local.set('ps_ws_switch_epoch_v1','new-workspace-epoch');
  if(race==='permission')h.c.PSPerms.canEdit=()=>false;
  if(race==='player changed')h.c.data.players[0].memo='A newer edit';
  const visible=raw(h.c.data.players);ui.confirm();
  assert.equal(raw(h.c.data.players),visible);assert.equal(h.local.get(PD),'{}');assert.equal(h.local.get(MAIN),before);assert.equal(h.c._itemsActiveJobs.length,0);
});
test('a stale popup and an out-of-scope candidate cannot open a deletion confirmation',()=>{
  const h=liveFixture([player('keep')]),ui=mount(h);h.c.data.players.push({...player('private'),type:'target'});
  for(const id of ['private','missing']){ui.click(id);assert.equal(ui.hasConfirmation(),false);}
  h.local.set('ps_ws_switch_epoch_v1','changed');ui.click('keep');assert.equal(ui.hasConfirmation(),false);assert.equal(h.local.get(PD),'{}');
});
test('failed SQ deletion remains in the durable outbox and retries after reload with the original player base',async()=>{
  const first=durableFixture({privateCandidate:true});
  vm.runInContext(section(source,'function plTombs(','function plTombApply('),first.c);
  first.rowState.failure=true;const ui=mount(first);ui.click('p1');ui.confirm();await assert.rejects(first.ready(),/SQ durability/);
  const pending=first.c.rosterOutbox().read();assert.equal(pending.rows.length,1);assert.equal(pending.rows[0].id,'p1');assert.equal(pending.rows[0].deleted,true);
  assert.deepEqual(copy(pending.rows[0].base),copy(first.initial.players[0]));
  const saved=first.persisted();saved.values=saved.values.map(([k,v])=>[k,k===MAIN?raw(first.initial):v]);
  const second=durableFixture({persisted:saved});assert.equal(second.resume(),true);await second.ready();
  assert.deepEqual(Array.from(second.main().players,p=>p.id),['p2']);assert.deepEqual(copy(second.rowCalls[0].options.deletedIds),['p1']);
  assert.deepEqual(copy(second.rowCalls[0].options.basePlayers),[copy(first.initial.players[0])]);assert.equal(second.values.get('cs_scout_targets_v1'),first.privateRaw);
});
