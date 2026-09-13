'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../studio/roster-recovery.js');
const c={uid:'coach-a',wid:'team-a'},now=Date.now(),copy=x=>JSON.parse(JSON.stringify(x));
const p=(id,extra={})=>({id,name:id,posId:'pos_CB',levels:{a:0},memo:'original',...extra});
const doc=players=>({attrs:[],positions:[{id:'pos_CB',name:'CB'}],players,meta:{teamName:'Synthetic'}});
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};
const keep=(players=[p('lost')])=>R.capture(null,doc(players),c,now);
test('archives are separated by both account and workspace; unscoped legacy is rejected',()=>{
  assert.notEqual(R.key(c),R.key({...c,uid:'coach-b'}));assert.notEqual(R.key(c),R.key({...c,wid:'team-b'}));
  const a=keep();assert.throws(()=>R.archive(a,{...c,wid:'team-b'}));assert.throws(()=>R.archive({lost:{at:now,p:p('lost')}},c));
});
test('only persisted team players are kept, with exact fields and independent objects',()=>{
  const source=frozen(doc([p('ours'),p('private',{type:'target'}),p('blank',{name:''})]));
  const a=R.capture(null,source,c,now);assert.deepEqual(Object.keys(a.entries),['ours']);assert.deepEqual(a.entries.ours.p,source.players[0]);
  a.entries.ours.p.memo='changed';assert.equal(source.players[0].memo,'original');
});
test('deleted players and SQ tombstones stay identifiable but cannot be restored',()=>{
  const a=keep([p('doc-deleted'),p('item-deleted'),p('lost')]),cur=doc([]);
  const rows=R.rows(a,cur,{'doc-deleted':now},[{id:'item-deleted',p:{_del:now}}],c,now);
  assert.equal(rows.find(x=>x.id==='lost').status,'missing');assert.equal(rows.filter(x=>x.status==='deleted').length,2);
  for(const id of ['doc-deleted','item-deleted'])assert.throws(()=>R.plan(a,cur,{'doc-deleted':now},[{id:'item-deleted',p:{_del:now}}],c,[id],now));
});
test('same ID already in main as player or target, or in SQ, is never duplicated',()=>{
  const a=keep([p('current'),p('became-target'),p('only-sq')]);
  const rows=R.rows(a,doc([p('current'),p('became-target',{type:'target'})]),{},[{id:'only-sq',p:p('only-sq')}],c,now);
  assert.deepEqual(rows.map(x=>[x.id,x.status]),[['only-sq','current-item']]);
  assert.throws(()=>R.plan(a,doc([]),{},[{id:'only-sq',p:p('only-sq')}],c,['only-sq'],now));
});
test('a restore appends only explicit IDs and preserves current records, metadata, scores and source',()=>{
  const a=frozen(keep([p('lost',{profile:{note:'<img onerror=x>'},num:0}),p('other')])),cur=frozen(doc([p('current',{memo:'new coach input'})]));
  const out=R.plan(a,cur,{},[],c,['lost'],now);
  assert.deepEqual(out.doc.players[0],cur.players[0]);assert.deepEqual(out.doc.meta,cur.meta);assert.deepEqual(out.doc.players[1],a.entries.lost.p);assert.equal(cur.players.length,1);
  assert.throws(()=>R.plan(a,cur,{},[],c,['lost','lost'],now));assert.throws(()=>R.plan(a,cur,{},[],c,['unknown'],now));
});
test('retention and invalid documents fail closed without modifying archived originals',()=>{
  const a=keep();assert.equal(R.rows(a,doc([]),{},[],c,now+31*86400000).length,0);assert.deepEqual(a,keep());
  for(const bad of ['{','[]','null','{"x":"y"}'])assert.throws(()=>R.rows(a,doc([]),bad,[],c,now));
  assert.throws(()=>R.main(doc([p('same'),p('same')])));assert.throws(()=>R.rows(a,doc([]),{},null,c,now));
  const malformed=copy(a);malformed.entries.lost.p.id='wrong';assert.throws(()=>R.archive(malformed,c));
});
test('repeat confirmed loads do not rewrite timestamps and prototype-like IDs are data only',()=>{
  const a=keep(),b=R.capture(a,doc([p('lost')]),c,now+100);assert.deepEqual(a,b);
  const special=R.capture(null,doc([p('__proto__')]),c,now);assert.equal(Object.hasOwn(special.entries,'__proto__'),true);
  assert.equal(R.plan(special,doc([]),{},[],c,['__proto__'],now).doc.players[0].id,'__proto__');assert.equal({}.name,undefined);
});
test('snapshot comparison detects every stale owner or source boundary',()=>{
  const a={owner:'a',raw:'r',deleted:'d',itemsRaw:'i',keep:'k'};assert.equal(R.sameSnapshot(a,copy(a)),true);
  for(const field of Object.keys(a))assert.equal(R.sameSnapshot(a,{...a,[field]:'changed'}),false);
});
const source=fs.readFileSync(require.resolve('../studio/scout.html'),'utf8');
const integration=source.slice(source.indexOf('var rosterRecoveryBusy=false'),source.indexOf('\nfunction save(){'));
function harness(){
  const state={ready:true,failSet:false,failItems:false,failMirror:false,failSync:false,writes:[],success:0,readOnly:false,role:'executive',onSync:null,onItems:null};
  const values=new Map(Object.entries({ps_sync_session:JSON.stringify({uid:c.uid}),ps_active_ws:c.wid,ps_cache_owner_v1:JSON.stringify(c),ps_ws_list:JSON.stringify([{id:c.wid,kind:'team'}]),cs_perms_v1:JSON.stringify({rosterEdit:'staff'}),scout_tool_v1:JSON.stringify(doc([p('current')])),cs_player_del_v1:'{}',[R.key(c)]:JSON.stringify(keep())}));
  const items=new Map([['sq:current',JSON.stringify(p('current'))]]);
  const localStorage={getItem:k=>values.get(k)??null,setItem(k,v){state.writes.push(k);values.set(k,String(v));}};
  const storage={keys:()=>Promise.resolve([...items.keys()]),get:k=>Promise.resolve(items.has(k)?{value:items.get(k)}:null)};
  const pi={writeReady:async (players,options)=>{if(state.onItems)state.onItems();if(state.failItems)throw Error('items write failed');
    assert.ok(Array.isArray(options.expectedRows));const expected=new Map(options.expectedRows.map(r=>['sq:'+r.id,r.raw]));
    if(expected.size!==items.size||[...items].some(([k,v])=>expected.get(k)!==v))throw Error('SQ preimage changed');
    players.forEach(p=>items.set('sq:'+p.id,JSON.stringify(p)));return {n:players.length,wrote:players.length};}};
  const ctx={console,Promise,Set,Map,JSON,Date,Number,Error,PSRosterRecovery:R,localStorage,storage,
    KEY:'scout_tool_v1',PDKEY:'cs_player_del_v1',PS_BUILD:'2.791',itemsPI:()=>pi,itemsRerender(){},load(){state.success++;},posAbbr:x=>x,plStatusOf:p=>p.status||'ok',$:()=>null,
    store:{hasPending:()=>false,hasFailed:()=>false,set(k,v){if(state.failSet)return false;localStorage.setItem(k,JSON.stringify(v));return true;},ready:()=>Promise.resolve(true)},
    PSPerms:{role:()=>state.role,canEdit:()=>!state.readOnly},
    PSStorage:{sharedReady:()=>state.failMirror?Promise.reject(Error('IDB failed')):Promise.resolve(),sharedVerified:()=>Promise.resolve(true)},
    psSaveShared(k,raw){localStorage.setItem(k,raw);return true;},
    PSSync:{dataUnlocked:()=>state.ready,rosterReady:()=>state.ready&&!state.failSync,syncNow:async()=>{if(state.onSync)state.onSync();return state.failSync?{offline:1}:{pushed:0,applied:0};}}
  };ctx.window=ctx;ctx.parent=ctx;vm.createContext(ctx);vm.runInContext(integration,ctx);return {ctx,state,values,items};
}
test('real recovery pipeline confirms local, SQ, public mirror and sync before success',async()=>{
  const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true),n=await h.ctx.rosterRestoreMissing(['lost'],s);
  assert.equal(n,1);assert.equal(h.state.success,1);assert.equal(JSON.parse(h.values.get('scout_tool_v1')).players.length,2);assert.ok(h.items.has('sq:lost'));
  assert.ok(!h.state.writes.includes('cs_scout_targets_v1'));assert.ok(!JSON.parse(h.values.get(R.key(c))).pendingRestore);
  assert.equal(JSON.parse(h.values.get('cs_squad_v1')).players.length,2);
});
test('real pipeline rejects main write, SQ write, mirror IDB and unconfirmed server failures without success',async()=>{
  for(const failure of ['failSet','failItems','failMirror']){const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true);h.state[failure]=true;
    await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s));assert.equal(h.state.success,0);assert.ok(JSON.parse(h.values.get(R.key(c))).pendingRestore);assert.equal(JSON.parse(h.values.get(R.key(c))).entries.lost.p.memo,'original');}
  const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true);h.state.onItems=()=>{h.state.failSync=true;};await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s));assert.equal(h.state.success,0);
});
test('fresh snapshot and identity checks reject stale preview, permission changes and owner changes',async()=>{
  for(const kind of ['main','tomb','owner','permission']){const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true);h.state.writes.length=0;
    if(kind==='main')h.values.set('scout_tool_v1',JSON.stringify(doc([p('current',{memo:'newer'})])));
    if(kind==='tomb')h.values.set('cs_player_del_v1',JSON.stringify({lost:now}));
    if(kind==='owner')h.values.set('ps_cache_owner_v1',JSON.stringify({...c,nonce:'new'}));
    if(kind==='permission')h.state.readOnly=true;
    await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s));assert.equal(h.state.success,0);assert.deepEqual(h.state.writes,[]);}
  const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true);h.state.onItems=()=>h.values.set('ps_active_ws','other-team');await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s));assert.equal(h.state.success,0);
});
test('player role, locked session, absent API and malformed SQ never inspect or restore archives',async()=>{
  for(const type of ['player','locked','api','sq']){const h=harness();if(type==='player')h.state.role='player';if(type==='locked')h.state.ready=false;if(type==='api')delete h.ctx.PSSync.rosterReady;if(type==='sq')h.items.set('sq:broken','{');
    await assert.rejects(async()=>h.ctx.rosterRecoverySnapshot(false));assert.equal(h.state.writes.length,0);}
});
test('interrupted recovery can finish without duplicating the restored player or changing a newer record',async()=>{
  const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true);h.state.failMirror=true;await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s));h.state.failMirror=false;
  const m=JSON.parse(h.values.get('scout_tool_v1'));m.players.find(p=>p.id==='lost').memo='new local input';h.values.set('scout_tool_v1',JSON.stringify(m));
  h.items.set('sq:lost',JSON.stringify(m.players.find(p=>p.id==='lost')));
  const next=await h.ctx.rosterRecoverySnapshot(true);assert.equal(await h.ctx.rosterRecoveryRetry(next),1);const after=JSON.parse(h.values.get('scout_tool_v1'));
  assert.equal(after.players.filter(p=>p.id==='lost').length,1);assert.equal(after.players.find(p=>p.id==='lost').memo,'new local input');
});
test('legacy archive is preserved; read-only confirmed capture excludes private candidates',()=>{
  const h=harness(),legacy=JSON.stringify({foreign:{at:now,p:p('foreign',{type:'target'})}});h.values.set('ps_roster_keep_v1',legacy);h.ctx.rosterKeepSave();assert.equal(h.values.get('ps_roster_keep_v1'),legacy);
  assert.ok(!JSON.parse(h.values.get(R.key(c))).entries.foreign);assert.ok(!source.includes('지금 되돌릴까요?'));assert.ok(!source.includes('rosterMissAck'));
});
test('ordinary save stops immediately when the main document is not accepted',()=>{
  const code=source.slice(source.indexOf('function save(){'),source.indexOf('\nfunction attr(id)'));
  const writes=[],context={data:doc([p('current')]),scMainMigrationPending:false,evalMode:()=> 'fifa',evalSetId:()=> 'standard',KEY:'scout_tool_v1',TKEY:'cs_scout_targets_v1',
    isTargetPl:p=>p.type==='target',canSeeTargets:()=>true,store:{set(k){writes.push(k);return false;}},localStorage:{setItem(k){writes.push(k);}},PSItems:{write(){writes.push('items');}},rosterKeepSave(){writes.push('keep');}};
  context.window=context;context.parent=context;vm.createContext(context);vm.runInContext(code,context);
  assert.equal(context.save(),false);assert.deepEqual(writes,['scout_tool_v1']);
});
test('ordinary store.ready waits for the strict item flush and propagates its failure',async()=>{
  const code=source.slice(source.indexOf('const mem={};'),source.indexOf('const KEY="scout_tool_v1";'));
  let release,failed=false,called=0;const wait=new Promise(r=>release=r);
  const context={Promise,localStorage:{getItem:()=>null},itemsPI:()=>({flush(){called++;return wait.then(()=>{if(failed)throw Error('SQ commit failed');return true;});}}),
    PSSaveState:{createTracker:()=>({ready:()=>Promise.resolve(true)})}};
  context.window=context;vm.createContext(context);vm.runInContext(code+'\nwindow.actualStore=store;',context);
  let done=false;const pending=context.actualStore.ready().then(()=>{done=true;});await new Promise(setImmediate);assert.equal(called,1);assert.equal(done,false);release();await pending;assert.equal(done,true);
  failed=true;await assert.rejects(()=>context.actualStore.ready(),/SQ commit failed/);
});
test('bootstrap saves only team data while unreceived private candidates retain their source',()=>{
  const code=source.slice(source.indexOf('function save(){'),source.indexOf('\nfunction attr(id)'));
  const writes=[],d=doc([p('current'),p('private',{type:'target'})]);let candidateFails=false;
  const context={data:d,scMainMigrationPending:false,evalMode:()=> 'fifa',evalSetId:()=> 'standard',KEY:'scout_tool_v1',TKEY:'cs_scout_targets_v1',
    isTargetPl:p=>p.type==='target',canSeeTargets:()=>true,store:{set(k,v){writes.push([k,copy(v)]);return !(k==='cs_scout_targets_v1'&&candidateFails);}},localStorage:{setItem(k,v){writes.push([k,v]);}},PSItems:{write(){writes.push(['items']);}},rosterKeepSave(){},posAbbr:x=>x,plStatusOf:()=> 'ok'};
  context.window=context;context.parent=context;vm.createContext(context);vm.runInContext(code,context);
  assert.equal(context.save({skipTargets:true}),true);assert.equal(writes.some(x=>x[0]==='cs_scout_targets_v1'),false);assert.equal(d.players[1].id,'private');
  writes.length=0;candidateFails=true;assert.equal(context.save(),false);assert.equal(writes.find(x=>x[0]==='scout_tool_v1')[1].players.length,1);assert.ok(writes.some(x=>x[0]==='items'));
  writes.length=0;context.scMainMigrationPending=true;assert.equal(context.save({skipTargets:true}),false);assert.equal(writes.length,0);
});
test('unfinished restore retains its original entry beyond ordinary retention',()=>{
  const a=keep();a.pendingRestore={ids:['lost'],at:now};const after=R.capture(a,doc([]),c,now+31*86400000);
  assert.equal(R.archive(after,c).entries.lost.p.memo,'original');assert.deepEqual(after.pendingRestore,a.pendingRestore);
  assert.equal(R.plan(after,doc([]),{},[],c,['lost'],now+31*86400000).doc.players[0].id,'lost');
});
test('full-roster recovery cannot delete an SQ-only player or overwrite a disagreeing SQ record',async()=>{
  for(const mode of ['sq-only','changed','deleted']){const h=harness();if(mode==='sq-only')h.items.set('sq:other',JSON.stringify(p('other')));if(mode==='changed')h.items.set('sq:current',JSON.stringify(p('current',{memo:'other coach'})));if(mode==='deleted')h.items.set('sq:current',JSON.stringify({_del:now}));
    const s=await h.ctx.rosterRecoverySnapshot(true),raw=h.values.get('scout_tool_v1');h.state.writes.length=0;
    await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s),/선수별 명단/);assert.equal(h.values.get('scout_tool_v1'),raw);assert.deepEqual(h.state.writes,[]);}
  const reordered=Object.fromEntries(Object.entries(p('same')).reverse());assert.equal(R.assertAligned(doc([p('same')]),{},[{id:'same',p:reordered}]),true);
});
test('writeReady receives the preview preimage and rejects a later SQ update even before main changes',async()=>{
  const h=harness(),s=await h.ctx.rosterRecoverySnapshot(true);h.state.onItems=()=>h.items.set('sq:current',JSON.stringify(p('current',{memo:'other coach after preview'})));
  await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s),/SQ preimage changed/);assert.equal(JSON.parse(h.items.get('sq:current')).memo,'other coach after preview');assert.equal(h.state.success,0);assert.ok(JSON.parse(h.values.get(R.key(c))).pendingRestore);
});
test('a failed recovery keeps its journal until retry completes, including initial main rejection',async()=>{
  const h=harness();h.values.set(R.key(c),JSON.stringify(keep([p('lost'),p('other')])));
  const s=await h.ctx.rosterRecoverySnapshot(true);h.state.failSet=true;await assert.rejects(()=>h.ctx.rosterRestoreMissing(['lost'],s));h.state.failSet=false;
  const next=await h.ctx.rosterRecoverySnapshot(true);await assert.rejects(()=>h.ctx.rosterRestoreMissing(['other'],next),/끝나지 않은 복구/);
  assert.deepEqual(JSON.parse(h.values.get(R.key(c))).pendingRestore.ids,['lost']);assert.equal(JSON.parse(h.values.get('scout_tool_v1')).players.length,1);
  assert.equal(await h.ctx.rosterRecoveryRetry(next),1);assert.deepEqual(JSON.parse(h.values.get('scout_tool_v1')).players.map(p=>p.id),['current','lost']);
  assert.equal(JSON.parse(h.values.get(R.key(c))).pendingRestore,undefined);
});
