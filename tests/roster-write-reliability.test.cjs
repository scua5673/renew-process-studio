'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const start=source.indexOf('var _itemsT=null, _itemsPending=null'),end=source.indexOf('/* "정말 지운 게 맞습니다"',start);
function harness(){
  const local=new Map([['owner','seal-a']]),disk=new Map(),writes=[],timers=[],hooks={};let uid='coach-a',wid='team-a',epoch='1',ready=true;
  const context={Promise,setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},ITEMS_ACTIVE:true,ITEMP:'sq:',ITEMS_HOLD:'hold',OWNERKEY:'owner',signOutEpoch:0,
    getSess:()=>({uid}),cacheOwner:()=>({uid,wid}),dataUnlocked:()=>true,activeWs:()=>wid,workspaceSwitchEpochRaw:()=>epoch,workspaceSwitchGuardRead:()=>false,
    localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){local.set(k,String(v));}},syncIssue:(code,stage,msg)=>Object.assign(new Error(msg),{psCode:code,psStage:stage}),syncDiagnostic(){},
    hash:s=>s,itemVal:p=>JSON.stringify(p),itemsIdx:()=>JSON.parse(local.get('idx:'+wid)||'{}'),itemsIdxKey:()=>'idx:'+wid,bigDrop:(b,a)=>b-a>=5,
    itemsServerCheck:async()=>{if(hooks.ready)await hooks.ready();return ready;},
    storage:{async keys(){return [...disk.keys()];},async get(k){if(hooks.read)await hooks.read(k);return disk.has(k)?{value:disk.get(k)}:null;},async replaceIfValue(k,old,value){
      if(hooks.write)await hooks.write(k,old,value);if((disk.get(k)??null)!==old)return false;
      writes.push({k,value});if(value===null)disk.delete(k);else disk.set(k,value);if(hooks.after)await hooks.after(k,value);return true;
    }},
  };context.window=context;const c=vm.createContext(context);vm.runInContext(source.slice(start,end),c);
  return {c,local,disk,writes,hooks,timers,move(){uid='coach-b';wid='team-b';epoch='2';local.set('owner','seal-b');},unready(){ready=false;}};
}
const p=(id,name)=>({id,name});
test('strict roster write resolves only after durable rows and index are verified',async()=>{
  const h=harness();const result=await h.c.itemsWriteReady([p('a','Alpha'),p('b','Beta')]);
  assert.equal(result.wrote,2);assert.equal(h.disk.size,2);assert.equal(Object.keys(JSON.parse(h.local.get('idx:team-a'))).length,2);
});
test('failed row does not advance the roster index or report success',async()=>{
  const h=harness();h.hooks.write=k=>{if(k==='sq:b')throw new Error('disk full');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Alpha'),p('b','Beta')]),/disk full/);
  assert.equal(h.local.has('idx:team-a'),false);assert.equal(h.disk.has('sq:a'),true);
  delete h.hooks.write;await h.c.itemsWriteReady([p('a','Alpha'),p('b','Beta')]);assert.equal(h.disk.has('sq:b'),true);
});
test('CAS refusal preserves another tab edit and keeps index unconfirmed',async()=>{
  const h=harness();h.hooks.write=k=>h.disk.set(k,'NEWER_OTHER_TAB');
  await assert.rejects(h.c.itemsWriteReady([p('a','Alpha')]),e=>e.psCode==='sync_local_changed');
  assert.equal(h.disk.get('sq:a'),'NEWER_OTHER_TAB');assert.equal(h.local.has('idx:team-a'),false);
});
test('workspace change while checking server readiness never writes old players to the new team',async()=>{
  const h=harness();h.hooks.ready=()=>h.move();
  await assert.rejects(h.c.itemsWriteReady([p('a','Alpha')]),e=>e.psCode==='sync_workspace_changed');assert.equal(h.disk.size,0);
});
test('delayed write captures account and a copy of player input at request time',async()=>{
  const h=harness(),players=[p('a','Original')];const pending=h.c.itemsWrite(players);players[0].name='Mutated';
  await h.c.itemsWriteDrain();await pending;assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Original');
  const old=h.c.itemsWrite([p('b','Old team')]);h.move();await assert.rejects(h.c.itemsWriteDrain(),e=>e.psCode==='sync_workspace_changed');
  assert.equal(await old,null);assert.equal(h.disk.has('sq:b'),false);
});
test('owner changes during durable write removes only that exact stale row',async()=>{
  const h=harness();h.hooks.after=(_k,v)=>{if(v!==null)h.move();};
  await assert.rejects(h.c.itemsWriteReady([p('a','Alpha')]),e=>e.psCode==='sync_workspace_changed');
  assert.equal(h.disk.has('sq:a'),false);assert.equal(h.local.has('idx:team-b'),false);
});
test('cleanup cannot remove a newer value written by the new team',async()=>{
  const h=harness();h.hooks.after=(k,v)=>{if(v!==null){h.move();h.disk.set(k,'NEW_TEAM_VALUE');}};
  await assert.rejects(h.c.itemsWriteReady([p('a','Alpha')]),e=>e.psCode==='sync_workspace_changed');assert.equal(h.disk.get('sq:a'),'NEW_TEAM_VALUE');
});
test('unready backend and deliberate bulk deletion stay unconfirmed',async()=>{
  const h=harness();h.unready();await assert.rejects(h.c.itemsWriteReady([p('a','Alpha')]),e=>e.psCode==='sync_storage');assert.equal(h.disk.size,0);
  const h2=harness();h2.local.set('idx:team-a',JSON.stringify(Object.fromEntries(['a','b','c','d','e'].map(id=>[id,'old']))));
  await assert.rejects(h2.c.itemsWriteReady([]),e=>e.psCode==='sync_storage');assert.equal(h2.disk.size,0);assert.equal(JSON.parse(h2.local.get('hold')).ids.length,5);
});
test('candidate players cannot enter public roster rows',async()=>{
  const h=harness();await h.c.itemsWriteReady([{id:'secret',name:'Candidate',type:'target'},p('a','Alpha')]);assert.equal(h.disk.has('sq:secret'),false);assert.equal(h.disk.size,1);
});
test('duplicate identity aborts before any row mutation',async()=>{
  const h=harness();await assert.rejects(h.c.itemsWriteReady([p('a','Alpha'),p('a','Other')]),e=>e.psStage==='items_write_duplicate');assert.equal(h.disk.size,0);
});
test('normal save failure remains visible to the next synchronization flush and can recover',async()=>{
  const h=harness();h.hooks.write=()=>{throw new Error('disk unavailable');};
  const initial=h.c.itemsWrite([p('a','Alpha')]);await assert.rejects(h.c.itemsWriteDrain(),/disk unavailable/);assert.equal(await initial,null);
  await assert.rejects(h.c.itemsWriteFlush(),/disk unavailable/);assert.equal(h.local.has('idx:team-a'),false);
  delete h.hooks.write;await h.c.itemsWriteFlush();assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Alpha');
});

test('roster recovery requires current-session confirmation and unchanged roster/tombstones',()=>{
  const local=new Map([['owner','seal-a'],['scout_tool_v1','ROSTER'],['cs_player_del_v1','DELETIONS']]);
  let wid='team-a',uid='coach-a',holds=[],itemHold=[];
  const c=vm.createContext({getSess:()=>({uid}),cacheOwner:()=>({uid,wid}),dataUnlocked:()=>true,activeWs:()=>wid,
    OWNERKEY:'owner',busy:false,navigator:{onLine:true},lastIssue:null,_itemsPending:null,pendingInfo:()=>({count:0}),workspaceSwitchGuardRead:()=>false,holdList:()=>holds,itemsHoldList:()=>itemHold,
    localStorage:{getItem:k=>local.get(k)??null},meta:()=>({h:{scout_tool_v1:'ROSTER',cs_player_del_v1:'DELETIONS'}}),hash:s=>s??''});
  c.itemsWriteBusy=()=>!!c._itemsPending;
  vm.runInContext(source.slice(source.indexOf('var rosterSyncMark=null;'),source.indexOf('function keyReady(')),c);
  assert.equal(c.rosterReady(wid),false,'persisted meta alone is insufficient');
  c.rosterSyncMark={uid,wid,seal:'seal-a',at:100};assert.equal(c.rosterReady(wid),true);
  c.pendingInfo=()=>({count:1});assert.equal(c.rosterReady(wid),false);c.pendingInfo=()=>({count:0});
  c._itemsPending={};assert.equal(c.rosterReady(wid),false);c._itemsPending=null;
  local.set('cs_player_del_v1','NEW_DELETION');assert.equal(c.rosterReady(wid),false);local.set('cs_player_del_v1','DELETIONS');
  local.set('owner','new-nonce');assert.equal(c.rosterReady(wid),false);local.set('owner','seal-a');
  holds=[{k:'scout_tool_v1'}];assert.equal(c.rosterReady(wid),false);holds=[];
  itemHold={ids:['removed']};assert.equal(c.rosterReady(wid),false);itemHold=[];
  c.lastIssue={at:101};assert.equal(c.rosterReady(wid),false);c.lastIssue=null;
  c.busy=true;assert.equal(c.rosterReady(wid),false);c.busy=false;
  c.navigator.onLine=false;assert.equal(c.rosterReady(wid),false);c.navigator.onLine=true;
  wid='team-b';assert.equal(c.rosterReady(wid),false);
});

test('idle upload queue is labelled waiting, never an active transfer or completed sync',()=>{
  const c=vm.createContext({getSess:()=>({uid:'coach-a'}),activeWs:()=> 'team-a',visiblePendingInfo:()=>({count:2}),meta:()=>({}),
    holdList:()=>[],personalReviewList:()=>[],navigator:{onLine:true},personalIssue:null,lastIssue:null,busy:false});
  const a=source.indexOf('function syncState(){'),b=source.indexOf('function classifySyncError(',a);vm.runInContext(source.slice(a,b),c);
  assert.equal(c.syncState().kind,'pending');assert.equal(c.syncState().text,'전송 대기 · 2건');c.busy=true;assert.equal(c.syncState().kind,'busy');
});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function seed(h,players){
  const idx={};for(const player of players){const raw=JSON.stringify(player);h.disk.set('sq:'+player.id,raw);idx[player.id]=raw;}
  h.local.set('idx:team-a',JSON.stringify(idx));return players.map(player=>({id:player.id,raw:JSON.stringify(player)}));
}
test('delayed stale player job preserves another tab row on first flush and every retry',async()=>{
  const h=harness(),original=p('a','Original');seed(h,[original]);
  const result=h.c.itemsWrite([p('a','My change')]);await tick();
  const newer=JSON.stringify(p('a','Other tab change'));h.disk.set('sq:a',newer);
  await assert.rejects(h.c.itemsWriteDrain(),e=>e.psStage==='items_write_stale_job');assert.equal(await result,null);
  assert.equal(h.c.itemsWriteBusy(),true);
  await assert.rejects(h.c.itemsWriteFlush(),e=>e.psStage==='items_write_stale_job');
  assert.equal(h.disk.get('sq:a'),newer);assert.equal(h.writes.length,0);
  assert.equal(JSON.parse(h.local.get('idx:team-a')).a,JSON.stringify(original));
});
test('same-tab queued edits may follow only the proven successful predecessor writes',async()=>{
  const h=harness();seed(h,[p('a','Original')]);let release,started;
  const blocked=new Promise(r=>release=r),entered=new Promise(r=>started=r);let once=true;
  h.hooks.write=async()=>{if(once){once=false;started();await blocked;}};
  const first=h.c.itemsWriteReady([p('a','First edit')]);await entered;
  const second=h.c.itemsWriteReady([p('a','Second edit')]);await tick();assert.equal(h.c.itemsWriteBusy(),true);
  release();await first;await second;
  assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Second edit');assert.equal(h.c.itemsWriteBusy(),false);
});
test('same-tab predecessor cannot authorize a third-party value arriving before the next job',async()=>{
  const h=harness();seed(h,[p('a','Original')]);let release,started;
  const blocked=new Promise(r=>release=r),entered=new Promise(r=>started=r);let once=true;
  h.hooks.write=async()=>{if(once){once=false;started();await blocked;}};
  const first=h.c.itemsWriteReady([p('a','First edit')]);await entered;
  const second=h.c.itemsWriteReady([p('a','Second edit')]);await tick();
  h.hooks.after=()=>h.disk.set('sq:a',JSON.stringify(p('a','Other device')));release();
  await assert.rejects(first,e=>e.psStage==='items_write_verify');await assert.rejects(second,e=>e.psStage==='items_write_stale_job');
  assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Other device');
});
test('debounce coalesces latest input without leaving active or predecessor jobs behind',async()=>{
  const h=harness();const first=h.c.itemsWrite([p('a','First')]),second=h.c.itemsWrite([p('a','Latest')]);
  assert.equal(h.c._itemsActiveJobs.length,1);assert.equal(h.c._itemsPending.predecessors.length,0);assert.equal(h.c.itemsWriteBusy(),true);
  await h.c.itemsWriteDrain();await first;await second;
  assert.equal(h.writes.length,1);assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Latest');assert.equal(h.c._itemsActiveJobs.length,0);assert.equal(h.c.itemsWriteBusy(),false);
});
test('recovery exact snapshot permits preserved rows and explicitly absent restored IDs',async()=>{
  const h=harness(),a=p('a','Existing'),expectedRows=seed(h,[a]);
  const result=await h.c.itemsWriteReady([a,p('b','Restored')],{expectedRows});
  assert.equal(result.wrote,1);assert.equal(h.disk.get('sq:a'),expectedRows[0].raw);assert.equal(JSON.parse(h.disk.get('sq:b')).name,'Restored');
});
test('recovery snapshot rejects modified existing rows even when the main roster is unchanged',async()=>{
  const h=harness(),a=p('a','Existing'),expectedRows=seed(h,[a]);const newer=JSON.stringify(p('a','New SQ detail'));h.disk.set('sq:a',newer);
  await assert.rejects(h.c.itemsWriteReady([a,p('b','Restored')],{expectedRows}),e=>e.psStage==='items_write_snapshot');
  assert.equal(h.writes.length,0);assert.equal(h.disk.get('sq:a'),newer);assert.equal(h.disk.has('sq:b'),false);
});
test('recovery snapshot rejects both unrelated new rows and newly occupied restored IDs',async()=>{
  for(const id of ['unrelated','b']){
    const h=harness(),a=p('a','Existing'),expectedRows=seed(h,[a]);const newer=JSON.stringify(p(id,'Another writer'));h.disk.set('sq:'+id,newer);
    await assert.rejects(h.c.itemsWriteReady([a,p('b','Restored')],{expectedRows}),e=>e.psStage==='items_write_snapshot');
    assert.equal(h.writes.length,0);assert.equal(h.disk.get('sq:'+id),newer);
  }
});
test('recovery checks the whole SQ snapshot again after writes and keeps its index unconfirmed',async()=>{
  const h=harness(),a=p('a','Existing'),expectedRows=seed(h,[a]);const idx=h.local.get('idx:team-a');
  h.hooks.after=()=>h.disk.set('sq:late',JSON.stringify(p('late','Arrived during recovery')));
  await assert.rejects(h.c.itemsWriteReady([a,p('b','Restored')],{expectedRows}),e=>e.psStage==='items_write_snapshot');
  assert.equal(h.disk.has('sq:b'),true);assert.equal(h.disk.has('sq:late'),true);assert.equal(h.local.get('idx:team-a'),idx);
  await assert.rejects(h.c.itemsWriteFlush(),e=>e.psStage==='items_write_snapshot');assert.equal(h.c.itemsWriteBusy(),true);
});
test('recovery retries retain their snapshot while accepting their own confirmed partial writes',async()=>{
  const h=harness(),a=p('a','Existing'),expectedRows=seed(h,[a]);h.hooks.write=k=>{if(k==='sq:c')throw new Error('temporary IO');};
  await assert.rejects(h.c.itemsWriteReady([a,p('b','Restored B'),p('c','Restored C')],{expectedRows}),/temporary IO/);
  assert.equal(h.disk.has('sq:b'),true);assert.equal(h.disk.has('sq:c'),false);delete h.hooks.write;
  await h.c.itemsWriteFlush();assert.equal(h.disk.has('sq:c'),true);assert.equal(h.writes.filter(w=>w.k==='sq:b').length,1);assert.equal(h.c.itemsWriteBusy(),false);
});
test('missing write owner rejects before snapshot reads or active-job registration',async()=>{
  const h=harness();let reads=0;h.hooks.read=()=>reads++;h.c.dataUnlocked=()=>false;
  await assert.rejects(h.c.itemsWriteReady([p('a','Unowned')]),e=>e.psStage==='items_write_owner');
  assert.equal(reads,0);assert.equal(h.c._itemsActiveJobs.length,0);assert.equal(h.c.itemsWriteBusy(),false);
});
