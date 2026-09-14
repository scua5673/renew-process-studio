'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const from=source.indexOf(a),to=source.indexOf(b,from+a.length);assert.ok(from>=0&&to>from,a);return source.slice(from,to);}
const fn=name=>section('function '+name+'(','\nfunction ');
const raw=JSON.stringify,tick=()=>new Promise(r=>setImmediate(r));
function deletion(){
  let uid='coach-a',wid='team-a',epoch='1';const local=new Map([['owner','seal-a']]),disk=new Map(),hooks={},syncs=[],downloads=[],blobs=[];
  const c={Promise,Date,JSON,Blob,ITEMP:'sq:',ITEMS_ACTIVE:true,ITEMS_HOLD:'hold',OWNERKEY:'owner',signOutEpoch:0,
    setTimeout:()=>0,clearTimeout(){},getSess:()=>({uid}),cacheOwner:()=>({uid,wid}),activeWs:()=>wid,dataUnlocked:()=>true,workspaceSwitchEpochRaw:()=>epoch,workspaceSwitchGuardRead:()=>null,
    localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){if(hooks.localWrite)hooks.localWrite(k,v);local.set(k,String(v));},removeItem:k=>local.delete(k)},
    storage:{async get(k){if(hooks.read)await hooks.read(k);return disk.has(k)?{value:disk.get(k)}:null;},async keys(){return [...disk.keys()];},async replaceIfValue(k,expected,value){
      if(hooks.write)await hooks.write(k,expected,value);if((disk.get(k)??null)!==expected)return false;if(value==null)disk.delete(k);else disk.set(k,value);if(hooks.after)await hooks.after(k,value);return true;
    }},itemsIdx:()=>JSON.parse(local.get('idx:'+wid)||'{}'),itemsIdxKey:()=>'idx:'+wid,itemsHoldList:()=>JSON.parse(local.get('hold')||'null'),itemsServerCheck:async()=>true,
    hash:s=>s??'',itemVal:raw,bigDrop:(b,a)=>b-a>=5,syncIssue:(code,stage,msg)=>Object.assign(new Error(msg),{psCode:code,psStage:stage}),syncDiagnostic(){},syncNow:reason=>{syncs.push({wid,reason});return Promise.resolve({error:'synthetic server refusal'});},
    URL:{createObjectURL(blob){blobs.push(blob);return 'blob:fixture';},revokeObjectURL(){}},document:{createElement(){return {click(){downloads.push({href:this.href,name:this.download});}};}}
  };c.window=c;vm.createContext(c);vm.runInContext(section('var _itemsT=null, _itemsPending=null','function itemsReadAll(')+'\n'+fn('itemsLostSnapshot')+'\n'+fn('itemsLostExport'),c);
  const players=['a','b','c'].map(id=>({id,name:'Player '+id}));players.forEach(p=>disk.set('sq:'+p.id,raw(p)));
  local.set('idx:team-a',raw(Object.fromEntries(players.map(p=>[p.id,raw(p)]))));
  local.set('hold',raw({at:1700000000000,ids:['a','b'],before:3,after:1,uid,wid,hashes:{a:disk.get('sq:a'),b:disk.get('sq:b')}}));
  return {c,local,disk,hooks,syncs,downloads,blobs,move(){uid='coach-b';wid='team-b';epoch='2';local.set('owner','seal-b');local.set('idx:team-b',raw({z:'NEW TEAM'}));}};
}
test('failed approved deletion retains its hold/index and can retry its own partial CAS writes',async()=>{
  const h=deletion(),before=h.local.get('idx:team-a'),hold=h.local.get('hold');h.hooks.write=k=>{if(k==='sq:b')throw Error('disk full');};
  await assert.rejects(h.c.itemsApproveDel(),/disk full/);assert.equal(h.local.get('idx:team-a'),before);assert.equal(h.local.get('hold'),hold);assert.equal(h.syncs.length,0);assert.ok(JSON.parse(h.disk.get('sq:a'))._del);
  await assert.rejects(h.c.itemsWriteFlush(),/disk full/);delete h.hooks.write;
  assert.equal(await h.c.itemsApproveDel(),2);assert.equal(h.local.has('hold'),false);assert.deepEqual(Object.keys(JSON.parse(h.local.get('idx:team-a'))),['c']);assert.equal(h.syncs.length,1);
});
test('index failure leaves the approved batch retryable without reinterpreting its tombstones',async()=>{
  const h=deletion();h.hooks.localWrite=k=>{if(k==='idx:team-a')throw Error('quota');};await assert.rejects(h.c.itemsApproveDel(),/quota/);assert.ok(h.local.has('hold'));
  delete h.hooks.localWrite;await h.c.itemsWriteFlush();assert.equal(h.local.has('hold'),false);assert.deepEqual(Object.keys(JSON.parse(h.local.get('idx:team-a'))),['c']);
});
test('reload after partial deletion resumes only tombstones from the same persisted hold',async()=>{
  const h=deletion();h.hooks.write=k=>{if(k==='sq:b')throw Error('disk full');};await assert.rejects(h.c.itemsApproveDel(),/disk full/);
  const tomb=h.disk.get('sq:a');assert.equal(JSON.parse(tomb)._del,JSON.parse(h.local.get('hold')).at);
  vm.runInContext('_itemsFailedJob=null;_itemsActiveJobs=[];_itemsWriteTail=Promise.resolve();',h.c);delete h.hooks.write;
  assert.equal(await h.c.itemsApproveDel(),2);assert.equal(h.disk.get('sq:a'),tomb);assert.equal(h.local.has('hold'),false);
  const other=deletion();other.disk.set('sq:a',raw({_del:1700000000001}));await assert.rejects(other.c.itemsApproveDel(),e=>e.psCode==='sync_local_changed');assert.ok(other.local.has('hold'));
});
test('deletion preparation is tracked by the roster flush barrier and rejects an owner change',async()=>{
  const h=deletion();let release;const gate=new Promise(r=>release=r);h.hooks.read=()=>gate;
  const pending=h.c.itemsApproveDel(),flushed=h.c.itemsWriteFlush();let settled=false;flushed.then(()=>settled=true);assert.equal(h.c.itemsWriteBusy(),true);await tick();assert.equal(settled,false);h.move();release();
  await assert.rejects(pending,e=>e.psCode==='sync_workspace_changed');await flushed;assert.equal(h.syncs.length,0);assert.equal(h.disk.get('sq:a').includes('_del'),false);assert.deepEqual(JSON.parse(h.local.get('idx:team-b')),{z:'NEW TEAM'});
});
test('late approved deletion cannot replace a new team row or index',async()=>{
  const h=deletion();let moved=false;h.hooks.after=(k,v)=>{if(!moved&&v){moved=true;h.move();h.disk.set(k,'NEW TEAM PLAYER');}};
  await assert.rejects(h.c.itemsApproveDel(),e=>e.psCode==='sync_workspace_changed');assert.equal(h.disk.get('sq:a'),'NEW TEAM PLAYER');assert.deepEqual(JSON.parse(h.local.get('idx:team-b')),{z:'NEW TEAM'});assert.equal(h.syncs.length,0);
});
test('approved deletion CAS refusal leaves a newer edit and its hold intact',async()=>{
  const h=deletion();h.hooks.write=k=>h.disk.set(k,'NEWER PLAYER EDIT');await assert.rejects(h.c.itemsApproveDel(),e=>e.psCode==='sync_local_changed');assert.equal(h.disk.get('sq:a'),'NEWER PLAYER EDIT');assert.ok(h.local.has('hold'));assert.equal(h.syncs.length,0);
});
test('stale delete dialog cannot approve changed hold or another account',async()=>{
  for(const move of [false,true]){const h=deletion(),intent=h.c.itemsDeleteIntent();if(move)h.move();else h.local.set('hold',raw({ids:['c']}));
    await assert.rejects(h.c.itemsApproveDel(intent),e=>e.psCode==='sync_workspace_changed');assert.equal(h.syncs.length,0);assert.equal([...h.disk.values()].some(v=>v.includes('_del')),false);}
});
test('a player edited after deletion was held requires fresh review',async()=>{
  const h=deletion();h.disk.set('sq:a','NEWER PLAYER');await assert.rejects(h.c.itemsApproveDel(),e=>e.psCode==='sync_local_changed');assert.ok(h.local.has('hold'));assert.equal(h.disk.get('sq:a'),'NEWER PLAYER');
});

// Reuse the shipped syncNowCore/HTTP CAS/local CAS harness without registering
// its tests; enable the dynamic roster-row channel rather than the shared key.
const harnessPath=path.join(__dirname,'team-data-consistency.test.cjs'),harnessSource=fs.readFileSync(harnessPath,'utf8'),box={require:createRequire(harnessPath),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(harnessSource.slice(0,harnessSource.indexOf('\nconst pushed='))+'\nmodule.exports={harness};',box,{filename:harnessPath});
const KEY='sq:a',BASE=raw({id:'a',name:'Player',note:'base'}),MINE=raw({id:'a',name:'Player',note:'mine'}),OTHER=raw({id:'a',name:'Player',note:'other'});
function conflict(opts={}){
  const h=box.module.exports.harness({key:KEY,dynamic:true,server:OTHER,cupd:2,idb:MINE,...opts});h.baseline(BASE);
  Object.assign(h.c,{ITEMS_ACTIVE:true,ITEMP:'sq:',_itemConflicts:[],itemsServerCheck:async()=>true,itemsPushAllowed:()=>true,isItemKey:k=>k.startsWith('sq:')});
  vm.runInContext(fn('itemsResolveConflicts'),h.c);
  const fetch=h.c.syncFetch;h.c.syncFetch=async(stage,...args)=>stage==='items_conflict'?{ok:true,json:async()=>[...h.server.values()]}:fetch(stage,...args);
  return h;
}
for(const chooseLocal of [true,false])test('roster conflict preserves both originals until exact '+(chooseLocal?'local':'server')+' choice',async()=>{
  const h=conflict();let result=await h.run();assert.equal(result.error,undefined);assert.ok(result.held.includes(KEY));assert.equal(h.idb.get(KEY),MINE);assert.equal(h.server.get(KEY).v,OTHER);assert.equal(h.queue.length,1);
  const shown=h.c.holdConflictView(h.c.holdList()[0]);assert.ok(await h.c.holdConflictChoose(KEY,chooseLocal,shown));result=await h.run();assert.equal(result.error,undefined);
  const expected=chooseLocal?MINE:OTHER;assert.equal(h.idb.get(KEY),expected);assert.equal(h.server.get(KEY).v,expected);assert.equal(h.queue.length,0);assert.equal(h.c.holdList().length,0);
});
test('conflict review quota failure preserves unsent IDB row and confirmed metadata',async()=>{
  const h=conflict();h.hooks.localWrite=k=>{if(k==='ps_hold_list_v1')throw Error('QuotaExceededError');};const before=raw(h.c.meta());await h.run();assert.equal(h.idb.get(KEY),MINE);assert.equal(h.server.get(KEY).v,OTHER);assert.equal(raw(h.c.meta()),before);assert.equal(h.requests.some(r=>r.stage.startsWith('kv_push')),false);
});
test('a roster CAS race records review without replacing the local row or acknowledging it',async()=>{
  const h=conflict({server:BASE,cupd:1});h.hooks.fetch=stage=>{if(stage.startsWith('kv_push'))h.server.set(KEY,{workspace_id:'team-a',k:KEY,v:OTHER,cupd:2});};
  const result=await h.run();assert.equal(result.code,'sync_conflict');assert.equal(h.idb.get(KEY),MINE);assert.equal(h.c.meta().h[KEY],h.c.hash(BASE));assert.equal(h.queue.length,1);assert.equal(h.c.holdList()[0].k,KEY);
});
test('changed remote/local versions invalidate a previously selected roster version',async()=>{
  for(const changeLocal of [false,true]){const h=conflict();await h.run();const shown=h.c.holdConflictView(h.c.holdList()[0]);await h.c.holdConflictChoose(KEY,true,shown);
    if(changeLocal)h.idb.set(KEY,raw({id:'a',name:'Player',note:'new local'}));else h.server.set(KEY,{workspace_id:'team-a',k:KEY,v:raw({id:'a',name:'Player',note:'new server'}),cupd:3});
    await h.run();assert.equal(h.c.holdList()[0].choice,undefined);assert.equal(h.requests.some(r=>r.stage.startsWith('kv_push')),false);assert.equal(h.queue.length,1);}
});
test('legacy conflict originals can be exported exactly without changing current roster',async()=>{
  const h=deletion(),legacy=raw([{k:KEY,at:1,mine:MINE,theirs:OTHER}]);h.local.set('ps_items_lost_v1',legacy);const snapshot=h.c.itemsLostSnapshot(),before=[...h.disk];
  assert.equal(snapshot.n,1);assert.equal(h.c.itemsLostExport(snapshot),true);assert.equal(await h.blobs[0].text(),legacy);assert.equal(h.downloads[0].name,'process-roster-conflict-copies.json');assert.deepEqual([...h.disk],before);assert.equal(h.local.get('ps_items_lost_v1'),legacy);
  h.move();assert.equal(h.c.itemsLostExport(snapshot),false);assert.equal(h.downloads.length,1);
});
