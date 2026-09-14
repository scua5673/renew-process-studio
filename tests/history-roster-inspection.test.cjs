'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=section('function holdConflictContext(){','function holdConflictSame(')+section('function histLoad(','function histRestore(');
const player=(id,extra={})=>({id,name:'선수 '+id,grp:'A',levels:{skill:3},memo:'현재 메모',...extra});
const doc=players=>JSON.stringify({attrs:[],positions:[],players,meta:{teamName:'합성 팀'}});
const plain=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
  const state={uid:'coach-a',wid:'team-a',seal:'owner-a',epoch:'switch-1',switchSeal:'',ready:true,role:'executive',wsRole:'owner',kind:'team'};
  const values=new Map([['scout_tool_v1',doc([player('a'),player('b')])],['cs_player_del_v1','{}'],['cs_perms_v1',JSON.stringify({members:{linked:{playerId:'b'}}})]]);
  const items=new Map([['sq:a',JSON.stringify(player('a'))],['sq:b',JSON.stringify(player('b'))]]),events=new Map(),timers=new Set(),calls={reads:[],writes:0,keys:0,rpc:0},hooks={};
  const noWrite=()=>{calls.writes++;throw Error('read-only inspection attempted a write');};
  const win={PSPerms:{role:()=>state.role},storage:{keys(){calls.keys++;return hooks.keys?hooks.keys():Promise.resolve([...items.keys()]);},get(k){calls.reads.push(k);return hooks.get?hooks.get(k):Promise.resolve(items.has(k)?{value:items.get(k)}:null);},set:noWrite,del:noWrite},
    addEventListener(k,f){if(!events.has(k))events.set(k,new Set());events.get(k).add(f);},removeEventListener(k,f){events.get(k)?.delete(f);}};
  const c=vm.createContext({window:win,Promise,JSON,Date,Set,Map,Object,Number,String,Error,
    OWNERKEY:'owner',WSKEY:'active',WLKEY:'workspaces',SKEY:'session',WS_SWITCH_GUARD:'guard',WS_SWITCH_EPOCH:'epoch',signOutEpoch:0,externalSwitchFrozen:false,
    localStorage:{getItem(k){calls.reads.push(k);return k==='owner'?state.seal:values.get(k)??null;},setItem:noWrite,removeItem:noWrite},
    getSess:()=>state.uid?{uid:state.uid}:null,activeWs:()=>state.wid,activeWsObj:()=>({id:state.wid,kind:state.kind,role:state.wsRole}),dataUnlocked:()=>state.ready,
    workspaceSwitchGuardRaw:()=>state.switchSeal,workspaceSwitchEpochRaw:()=>state.epoch,workspaceSwitchGuardRead:()=>state.switchSeal?{}:null,
    sessionStorageOwnerChanged(e){return JSON.parse(e.oldValue||'null')?.uid!==JSON.parse(e.newValue||'null')?.uid;},
    setInterval(f){timers.add(f);return f;},clearInterval(f){timers.delete(f);},
    rpc(name,args,current){calls.rpc++;current?.();return hooks.rpc?hooks.rpc():Promise.resolve([]);}});
  vm.runInContext(code,c);
  const emit=(type,extra={})=>{for(const f of [...(events.get(type)||[])])f({type,...extra});};
  return {c,state,values,items,calls,hooks,events,timers,emit,ctx:()=>c.histRosterContext()};
}
function host(){const area={value:'private raw'},h={isConnected:true,textContent:'private table',querySelectorAll:()=>[area]};return {h,area};}
test('44 baseline IDs retain their latest 69-player records; only 25 exact new IDs are separated',async()=>{
  const h=harness(),base=doc(Array.from({length:44},(_,i)=>player('p'+i,{memo:'지난 메모'}))),cur=doc(Array.from({length:69},(_,i)=>player('p'+i,{grp:i<26?'A':i<44?'B':''})));
  h.values.set('scout_tool_v1',cur);h.items.clear();JSON.parse(cur).players.forEach(p=>h.items.set('sq:'+p.id,JSON.stringify(p)));
  const before=JSON.stringify([...h.values]),itemBefore=JSON.stringify([...h.items]);
  const snap=plain(await h.c.histRosterSnapshot({v:base,at:'2026-09-14T11:56:28Z'},h.ctx(),()=>{}));
  assert.deepEqual([snap.comparison.currentCount,snap.comparison.baselineCount,snap.comparison.commonIds.length,snap.comparison.extraIds.length,snap.comparison.missingIds.length],[69,44,44,25,0]);
  assert.equal(snap.comparison.baselineIsSubset,true);assert.equal(snap.comparison.rows.filter(r=>r.changed).length,44);
  assert.equal(snap.raw.scout_tool_v1,cur);assert.equal(snap.raw.baseline_scout_tool_v1,base);assert.equal(snap.raw.cs_player_del_v1,'{}');assert.equal(snap.items.length,69);
  assert.deepEqual(snap.comparison.outsideBaseline,JSON.parse(cur).players.slice(44));
  assert.equal(JSON.stringify([...h.values]),before);assert.equal(JSON.stringify([...h.items]),itemBefore);assert.equal(h.calls.writes,0);
});
test('names and groups never merge IDs; prototype-like IDs remain ordinary exact identities',()=>{
  const h=harness(),same={name:'같은 이름',grp:'A'},out=plain(h.c.histRosterCompare(doc([player('new',same),player('__proto__',same)]),doc([player('old',same),player('__proto__',same)]),'{"members":{}}','{}',[]));
  assert.deepEqual(out.commonIds,['__proto__']);assert.deepEqual(out.extraIds,['new']);assert.deepEqual(out.missingIds,['old']);assert.equal(out.baselineIsSubset,false);assert.equal({}.name,undefined);
});
test('account links use exact playerId and backup excludes permission/private/session documents',async()=>{
  const h=harness();h.values.set('cs_perms_v1',JSON.stringify({members:{one:{playerId:'b',secret:'do not export'},two:{playerId:'b-other'},three:{playerId:7}}}));
  h.values.set('cs_idp_v1_secret','PRIVATE-IDP');h.values.set('session','PRIVATE-TOKEN');h.items.set('psimg_private','PRIVATE-IMAGE');
  const out=plain(await h.c.histRosterSnapshot({v:doc([player('a')])},h.ctx(),()=>{}));
  assert.equal(out.comparison.rows.find(r=>r.id==='b').linkedAccounts,1);assert.deepEqual(out.comparison.rows.find(r=>r.id==='b').records,['메모','평가값']);
  const raw=JSON.stringify(out);for(const secret of ['PRIVATE-IDP','PRIVATE-TOKEN','PRIVATE-IMAGE','do not export','cs_perms_v1'])assert.ok(!raw.includes(secret),secret);
  assert.ok(!h.calls.reads.some(k=>k==='session'||k.startsWith('cs_idp_v1_')||k==='psimg_private'));
});
test('malformed, blank and duplicate before/after IDs stop comparison without changing originals',()=>{
  const h=harness(),good=doc([player('a')]);
  const invalid=['null','{}','{',doc([player('a'),player('a')]),doc([player('')]),doc([player(' padded ')]),doc([{id:7,name:'numeric'}])];
  for(const raw of invalid)for(const which of ['current','baseline'])assert.throws(()=>h.c.histRosterCompare(which==='current'?raw:good,which==='baseline'?raw:good,'{}','{}',[]));
  assert.equal(h.calls.writes,0);
});
test('malformed item rows and delete records cannot be presented as a verified backup',()=>{
  const h=harness(),good=doc([player('a')]);
  for(const rows of [null,[{k:'sq:a',raw:JSON.stringify(player('b'))}],[{k:'sq:a',raw:'null'}],[{k:'sq:a',raw:'{"_del":"bad"}'}],[{k:'sq:a',raw:JSON.stringify(player('a'))},{k:'sq:a',raw:JSON.stringify(player('a'))}]])assert.throws(()=>h.c.histRosterCompare(good,good,'{}','{}',rows));
  for(const deleted of ['[]','{"a":0}','{"a":"bad"}'])assert.throws(()=>h.c.histRosterCompare(good,good,'{}',deleted,[]));
});
for(const boundary of ['account','workspace','logout','seal','epoch','auth-generation','switch','lock','role','workspace-role','permissions'])test('in-flight raw reads reject after '+boundary,async()=>{
  const h=harness(),gate=deferred(),ctx=h.ctx();h.hooks.keys=()=>gate.promise;
  const pending=h.c.histRosterSnapshot({v:doc([player('a')])},ctx,()=>{});await Promise.resolve();
  if(boundary==='account')h.state.uid='coach-b';if(boundary==='workspace')h.state.wid='team-b';if(boundary==='logout')h.state.uid='';if(boundary==='seal')h.state.seal='new-seal';if(boundary==='epoch')h.state.epoch='switch-2';if(boundary==='auth-generation')h.c.signOutEpoch++;if(boundary==='switch')h.state.switchSeal='switching';if(boundary==='lock')h.state.ready=false;if(boundary==='role')h.state.role='player';if(boundary==='workspace-role')h.state.wsRole='member';if(boundary==='permissions')h.values.set('cs_perms_v1','{}');
  gate.resolve([...h.items.keys()]);await assert.rejects(pending);assert.equal(h.calls.writes,0);
});
test('partial IDB read failure and a changed second snapshot are errors, not partial successful backups',async()=>{
  for(const fail of ['get','missing','changed-item','changed-local']){
    const h=harness();h.hooks.get=k=>k==='sq:b'&&fail==='get'?Promise.reject(Error('read failed')):Promise.resolve(k==='sq:b'&&fail==='missing'?null:{value:h.items.get(k)});
    if(fail.startsWith('changed'))h.hooks.keys=()=>{if(h.calls.keys===2){if(fail==='changed-item')h.items.set('sq:b',JSON.stringify(player('b',{memo:'new concurrent change'})));else h.values.set('scout_tool_v1',doc([player('c')]));}return Promise.resolve([...h.items.keys()]);};
    await assert.rejects(h.c.histRosterSnapshot({v:doc([player('a')])},h.ctx(),()=>{}));assert.equal(h.calls.writes,0);
  }
});
test('late history RPC replies cannot become visible after owner changes',async()=>{
  const h=harness(),gate=deferred(),dom=host(),view=h.c.histReadView(dom.h,h.ctx());h.hooks.rpc=()=>gate.promise;
  const pending=h.c.histLoad('scout_tool_v1',view.require);h.state.uid='coach-b';gate.resolve([{v:doc([player('private-old')])}]);
  assert.equal(await pending,null);assert.equal(dom.area.value,'');assert.equal(dom.h.textContent,'');assert.equal(view.current(),false);assert.equal(h.timers.size,0);
});
for(const event of ['auth','workspace','permissions','workspace-role','queued-account-roundtrip','fallback','detached'])test('completed DOM raw and rows are cleared on '+event,()=>{
  const h=harness(),dom=host(),view=h.c.histReadView(dom.h,h.ctx());assert.equal(view.current(),true);
  if(event==='auth')h.emit('ps-auth-state',{detail:{unlocked:false}});
  if(event==='workspace')h.emit('storage',{key:'active',oldValue:'team-a',newValue:'team-b'});
  if(event==='permissions')h.emit('storage',{key:'cs_perms_v1',oldValue:'old',newValue:'new'});
  if(event==='workspace-role')h.emit('storage',{key:'workspaces',oldValue:'owner',newValue:'member'});
  if(event==='queued-account-roundtrip')h.emit('storage',{key:'session',oldValue:'{"uid":"coach-a"}',newValue:'{"uid":"coach-b"}'});
  if(event==='fallback'){h.state.seal='new-seal';for(const f of [...h.timers])f();}
  if(event==='detached'){dom.h.isConnected=false;for(const f of [...h.timers])f();}
  assert.equal(view.current(),false);assert.equal(dom.area.value,'');assert.equal(dom.h.textContent,'');assert.equal(h.timers.size,0);assert.ok([...h.events.values()].every(set=>set.size===0));
});
test('same-user token rotation keeps a current read-only view available',()=>{
  const h=harness(),dom=host(),view=h.c.histReadView(dom.h,h.ctx());
  h.emit('storage',{key:'session',oldValue:'{"uid":"coach-a","at":"old"}',newValue:'{"uid":"coach-a","at":"new"}'});
  assert.equal(view.current(),true);assert.equal(dom.area.value,'private raw');view.stop();
});
test('players and unknown roles cannot create a history inspection context',()=>{
  const h=harness();for(const role of ['player','',undefined]){h.state.role=role;assert.equal(h.ctx(),null);}h.state.role='executive';h.state.kind='personal';assert.equal(h.ctx(),null);
});
