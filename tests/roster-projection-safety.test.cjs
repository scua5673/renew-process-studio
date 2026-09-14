'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const raw=JSON.stringify,copy=x=>JSON.parse(raw(x)),MAIN='scout_tool_v1',PD='cs_player_del_v1';
function section(source,a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return source.slice(x,y);}
const fn=(source,name)=>section(source,'function '+name+'(','\nfunction ');
const harnessPath=path.join(__dirname,'team-data-consistency.test.cjs'),harnessSource=fs.readFileSync(harnessPath,'utf8'),box={require:createRequire(harnessPath),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(harnessSource.slice(0,harnessSource.indexOf('\nconst pushed='))+'\nmodule.exports={harness};',box);
const p=(id,name='Synthetic player',grp='A')=>({id,name,grp,type:'ours'}),doc=players=>({attrs:[],positions:[],meta:{evalMode:'fifa'},_items:{build:'2.808'},players:copy(players)});
function fixture(players){
  const h=box.module.exports.harness({key:'sq:fixture',dynamic:true,server:null}),c=h.c,saves=[];
  Object.assign(c,{ITEMS_ACTIVE:true,ITEMP:'sq:',ITEMS_HOLD:'ps_items_hold_v1',ITEMS_IDX:'ps_items_idx_v1',_itemConflicts:[],KEYS:[MAIN,PD],KEY:MAIN,PDKEY:PD,TKEY:'cs_scout_targets_v1',PS_BUILD:'2.809',scMainMigrationPending:false,
    itemsServerCheck:async()=>true,itemsPushAllowed:()=>true,isItemKey:k=>k.startsWith('sq:'),idbBacked:k=>k.startsWith('sq:'),data:doc(players),
    store:{get:k=>JSON.parse(h.local.get(k)||'null'),set(k,v){h.local.set(k,raw(v));saves.push({k,v:copy(v)});return true;}},
    evalMode:()=>'fifa',evalSetId:()=>'standard',canSeeTargets:()=>false,rosterKeepSave(){},posAbbr:x=>x,plStatusOf:p=>p.status||'ok',psAct(){}});
  c.storage.keys=async()=>[...h.idb.keys()];
  vm.runInContext(section(sync,'var _itemsT=null, _itemsPending=null','function itemsHoldOpen(')+'\n'+['itemsIdxKey','itemsIdx','itemVal','bigDrop','itemsReadAll','itemsResolveConflicts'].map(n=>fn(sync,n)).join('\n'),c);
  c.PSItems={active:()=>true,readAll:c.itemsReadAll,write:c.itemsWrite};c.parent.PSItems=c.PSItems;c.parent.PS_BUILD='2.809';
  vm.runInContext(['isTargetPl','plTombs','plTombAdd','plTombApply','itemsPI','itemsApply','save'].map(n=>fn(scout,n)).join('\n'),c);
  function seedMain(){h.local.set(MAIN,raw(c.data));h.local.set(PD,'{}');for(const k of [MAIN,PD])h.server.set(k,{workspace_id:'team-a',k,v:h.local.get(k),cupd:10});}
  seedMain();const m=c.meta(),idx={};for(const player of players){const k='sq:'+player.id,v=raw(player);h.idb.set(k,v);h.server.set(k,{workspace_id:'team-a',k,v,cupd:10});m.h[k]=c.hash(v);m.c[k]=10;idx[player.id]=c.hash(v);}
  for(const k of [MAIN,PD]){m.h[k]=c.hash(h.local.get(k));m.c[k]=10;}c.setMeta(m);h.local.set('ps_items_idx_v1:team-a',raw(idx));
  const fetch=c.syncFetch;c.syncFetch=async(stage,...args)=>stage==='items_conflict'?{ok:true,json:async()=>[...h.server.values()]}:fetch(stage,...args);
  return Object.assign(h,{saves,main:()=>JSON.parse(h.local.get(MAIN)),serverPlayers:()=>[...h.server.keys()].filter(k=>k.startsWith('sq:')),async round(){const result=await h.run();assert.equal(result.error,undefined,raw(h.errors));await c.itemsApply('sync');return result;}});
}
test('69 local rows cannot promote 25 old identities into a confirmed roster of 44 over boot and two sync/save rounds',async()=>{
  const players=Array.from({length:44},(_,i)=>p('active-'+i,'Synthetic '+i,i<26?'A':'B')),h=fixture(players),orphans=[];
  for(let i=0;i<25;i++){const key='sq:old-'+i,v=raw(p('old-'+i,'Synthetic '+i,''));h.idb.set(key,v);orphans.push([key,v]);}
  const priorMeta=h.c.meta();for(const [k,v]of orphans){priorMeta.h[k]=h.c.hash(v);priorMeta.c[k]=1;}h.c.setMeta(priorMeta); // stale persisted confirmation is insufficient
  assert.equal(await h.c.itemsApply('boot'),false);assert.equal(h.c.data.players.length,44);
  await h.round();h.c.save();await h.round();assert.equal(h.c.data.players.length,44);assert.equal(h.main().players.length,44);assert.equal(h.serverPlayers().length,44);
  for(const [k,v]of orphans)assert.equal(h.idb.get(k),v);assert.equal(h.c.holdList().length,0);assert.equal(h.c.data.players.filter(x=>!x.grp).length,0);
});
test('a new player confirmed on another device is included without merging equal names',async()=>{
  const h=fixture([p('a','Same name')]),remote=p('new','Same name','B');h.server.set('sq:new',{workspace_id:'team-a',k:'sq:new',v:raw(remote),cupd:11});
  await h.round();assert.deepEqual(Array.from(h.c.data.players,x=>x.id),['a','new']);assert.equal(h.c.data.players[1].grp,'B');assert.equal(h.c._itemsPending,null,'projection save does not enqueue row writes');
  await h.round();assert.equal(h.serverPlayers().length,2);assert.equal(JSON.parse(h.server.get(MAIN).v).players.length,2);
});
test('an actual direct addition remains visible during its pending write and creates the new server row',async()=>{
  const h=fixture([p('a','Same name')]);h.c.data.players.push(p('new','Same name','B'));h.c.save();assert.equal(await h.c.itemsApply('pending'),false);assert.equal(h.c.data.players.length,2);
  await h.round();await h.round();assert.equal(h.server.get('sq:new').v,raw(p('new','Same name','B')));assert.equal(h.main().players.length,2);assert.equal(h.serverPlayers().length,2);
});
test('legacy deletion records filter the assembled roster and prevent a missing server live-row insert',async()=>{
  const h=fixture([p('a'),p('deleted','Deleted player','')]),original=h.idb.get('sq:deleted');h.server.delete('sq:deleted');h.local.set(PD,raw({deleted:20}));
  assert.equal(await h.c.itemsApply('boot'),true);assert.deepEqual(Array.from(h.c.data.players,x=>x.id),['a']);assert.equal(h.c._itemsPending,null);assert.equal(h.idb.get('sq:deleted'),original);
  await h.round();await h.round();assert.equal(h.server.has('sq:deleted'),false);assert.equal(h.main().players.length,1);assert.equal(h.idb.get('sq:deleted'),original);
});
test('two actual sync and projection saves retain a deleted/live conflict original and its review',async()=>{
  const h=fixture([p('a'),p('held','Held player','')]),base=h.idb.get('sq:held'),mine=raw({...JSON.parse(base),memo:'unsent note'}),tomb=raw({_del:20});
  h.idb.set('sq:held',mine);h.server.set('sq:held',{workspace_id:'team-a',k:'sq:held',v:tomb,cupd:11});h.local.set(PD,raw({held:20}));
  await h.round();assert.deepEqual(Array.from(h.c.data.players,x=>x.id),['a']);assert.equal(h.c.holdList().some(x=>x.k==='sq:held'),true);assert.equal(h.idb.get('sq:held'),mine);
  h.c.save();await h.round();assert.equal(h.c.holdList().some(x=>x.k==='sq:held'),true);assert.equal(h.idb.get('sq:held'),mine);assert.equal(h.server.get('sq:held').v,tomb);assert.equal(h.main().players.length,1);
});
test('an unresolved ungrouped row cannot replace the current roster group or enter as a new player',async()=>{
  const h=fixture([p('a','Player','A')]),base=h.idb.get('sq:a'),mine=raw(p('a','Player','')),server=raw({...p('a','Player','B'),memo:'remote edit'});h.idb.set('sq:a',mine);h.server.set('sq:a',{workspace_id:'team-a',k:'sq:a',v:server,cupd:11});
  assert.equal(await h.c.itemsApply('boot'),false);assert.equal(h.c.data.players[0].grp,'A');await h.round();assert.equal(h.c.data.players[0].grp,'A');h.c.save();await h.round();assert.equal(h.idb.get('sq:a'),mine);assert.equal(h.c.meta().h['sq:a'],h.c.hash(base));assert.equal(h.c.holdList().length,1);
});
test('row projection begun for an old account cannot finish after an owner change',async()=>{
  const h=fixture([p('a')]);let release;const gate=new Promise(r=>release=r);h.hooks.idbRead=()=>gate;const pending=h.c.itemsReadAll();await Promise.resolve();h.switch();release();assert.equal(await pending,null);
});
test('a known-deleted live row cannot PATCH its already-confirmed server tombstone',async()=>{
  const h=fixture([p('a')]),key='sq:deleted',mine=raw(p('deleted','Deleted player','')),tomb=raw({_del:20});h.idb.set(key,mine);h.server.set(key,{workspace_id:'team-a',k:key,v:tomb,cupd:10});h.local.set(PD,raw({deleted:20}));
  const m=h.c.meta();m.h[key]=h.c.hash(tomb);m.c[key]=10;h.c.setMeta(m);
  await h.round();await h.round();assert.equal(h.server.get(key).v,tomb);assert.equal(h.idb.get(key),mine);assert.equal(h.c.holdList().some(x=>x.k===key),true);assert.equal(h.main().players.length,1);
  const shown=h.c.holdConflictView(h.c.holdList().find(x=>x.k===key));assert.ok(await h.c.holdConflictChoose(key,false,shown));await h.round();assert.equal(h.idb.get(key),tomb);assert.equal(h.c.holdList().some(x=>x.k===key),false);
});
test('first observation of an already-cached confirmed remote player signals projection after exact metadata',async()=>{
  const h=fixture([p('a')]),extra=p('remote','Remote player','B'),key='sq:remote',v=raw(extra);h.idb.set(key,v);h.server.set(key,{workspace_id:'team-a',k:key,v,cupd:10});const m=h.c.meta();m.h[key]=h.c.hash(v);m.c[key]=10;h.c.setMeta(m);
  assert.equal(await h.c.itemsApply('boot'),false);const revisions=[];h.hooks.localWrite=k=>{if(k==='ps_items_rev')revisions.push(h.c.meta().c[key]);};
  await h.round();assert.deepEqual(revisions,[10]);assert.equal(h.c.data.players.length,2);assert.equal(h.c.data.players[1].grp,'B');
});
for(const local of [true,false])test('deleted-row '+(local?'local':'server')+' choice remains pending while roster backend writes are closed',async()=>{
  const h=fixture([p('a')]),key='sq:deleted',mine=raw(p('deleted')),tomb=raw({_del:20});h.idb.set(key,mine);h.server.set(key,{workspace_id:'team-a',k:key,v:tomb,cupd:10});h.local.set(PD,raw({deleted:20}));const m=h.c.meta();m.h[key]=h.c.hash(tomb);m.c[key]=10;h.c.setMeta(m);
  await h.round();const shown=h.c.holdConflictView(h.c.holdList().find(x=>x.k===key));assert.ok(await h.c.holdConflictChoose(key,local,shown));const start=h.requests.length;
  h.c.itemsPushAllowed=()=>false;await h.round();assert.equal(h.idb.get(key),mine);assert.equal(h.server.get(key).v,tomb);assert.equal(h.c.holdList().find(x=>x.k===key).choice,local?'local':'server');
  assert.equal(h.requests.slice(start).some(r=>r.stage.startsWith('kv_push')&&r.url.includes('sq%3Adeleted')),false);
});
for(const origin of ['profile','team row'])test(origin+' confirmed deletion removes the same unindexed ID after roster reorder and two real sync rounds',async()=>{
  const players=Array.from({length:69},(_,i)=>p('synthetic-'+i,'Synthetic '+i,i<44?'A':'')),h=fixture(players),id='synthetic-44',key='sq:'+id;
  const idx=JSON.parse(h.local.get('ps_items_idx_v1:team-a'));for(let i=44;i<69;i++)delete idx['synthetic-'+i];h.local.set('ps_items_idx_v1:team-a',raw(idx));
  let confirmed;const button={};Object.assign(h.c,{$:()=>button,psConfirm:(_text,fn)=>confirmed=fn,closePlayer(){},renderTeam(){},toast(){},pl:h.c.data.players.find(x=>x.id===id),gi:44,del:button});
  const handler=origin==='profile'?section(scout,'  if($("plDelete"))$("plDelete").onclick=()=>{','  $("plName").value'):section(scout,'    del.onclick=()=>{psConfirm((pl.name||"이 선수")+" 삭제? 평가 기록도 함께 삭제됩니다.",()=>{','    const acts=');
  vm.runInContext(handler,h.c);button.onclick();assert.equal(typeof confirmed,'function');
  // The modal captured an old object/index. A sync replaced and reordered the list meanwhile.
  h.c.data.players=copy(h.c.data.players).reverse();confirmed();assert.equal(h.c.data.players.length,68);assert.equal(h.c.data.players.some(x=>x.id===id),false);assert.ok(JSON.parse(h.local.get(PD))[id]);
  h.c.save();await h.round();await h.round();assert.equal(h.main().players.length,68);assert.equal(JSON.parse(h.server.get(MAIN).v).players.length,68);assert.ok(JSON.parse(h.idb.get(key))._del);assert.ok(JSON.parse(h.server.get(key).v)._del);
  const remaining=[...h.server.values()].filter(x=>x.k.startsWith('sq:')&&!JSON.parse(x.v)._del);assert.equal(remaining.length,68);assert.equal(h.c.holdList().length,0);
});
test('failed deletion-record save leaves the profile and roster intact before any item request',()=>{
  const h=fixture([p('a')]),button={};let confirmed;Object.assign(h.c,{$:()=>button,psConfirm:(_text,fn)=>confirmed=fn,pl:h.c.data.players[0]});
  vm.runInContext(section(scout,'  if($("plDelete"))$("plDelete").onclick=()=>{','  $("plName").value'),h.c);h.c.store.set=(k)=>k!==PD;button.onclick();confirmed();
  assert.equal(h.c.data.players.length,1);assert.equal(h.c._itemsActiveJobs.length,0);assert.equal(h.c.itemsWriteBusy(),false);
});
