'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const code=section('function kvPushRows(', '/* ── 1.568 안전장치')+'\n'+section("var BOARD_LIVE_KEY='cs_private_board_v1';",'\nwindow.PSSync=');
const KEY='cs_private_board_v1',OLD='cs_board_live_v1';
const raw=(name)=>JSON.stringify({snap:{players:[{id:name,name}],drawings:[]},view:'board',boardPages:[{name}],_savedAt:1});
const copy=x=>JSON.parse(JSON.stringify(x));
function harness(options={}){
  const server=options.server||new Map(),requests=[],metaWrites=[];
  let uid='coach-a',wid='private-a',active='team-shared',seal='seal-a',epoch=0,switchEpoch='',switchSeal='',unlocked=true;
  const state={role:'owner',owner_id:'coach-a',kind:'personal'};
  const put=(w,k,v,cupd=1)=>server.set(w+'|'+k,{workspace_id:w,k,v,cupd});
  const ctx=vm.createContext({Promise,Number,Map,JSON,Object,String,Array,Date,encodeURIComponent,
    BASE:'https://server.invalid',PERSONAL_MAXLEN:12000000,KV_PUSH_BYTES:1500000,KV_PUSH_ROWS:15,_itemConflicts:[],
    personalContext:()=>unlocked?{uid,wid,active,seal,epoch,switchEpoch,switchSeal}:null,
    getSess:()=>({uid}),cacheOwner:()=>({uid,wid:active}),workspaceSwitchGuardRead:()=>switchSeal||null,
    wsList:()=>[{id:wid,...state}],hj:()=>({}),prefBuild:x=>x,blobPrepRows:async()=>{},
    syncIssue:(code,stage,message)=>Object.assign(new Error(message),{psCode:code,psStage:stage}),
    syncHttpError:(stage,status)=>Object.assign(new Error('HTTP '+status),{psStage:stage}),
    ensureToken:async()=>{if(options.onToken)await options.onToken(h);return 'synthetic';},
    kvInFilter:ks=>'k=in.('+ks.join(',')+')',holdClear(){},importApprovalClear(){},
    meta:()=>{throw new Error('Board must not touch team sync metadata');},setMetaExact:m=>metaWrites.push(m),
    async syncFetch(stage,url,init){
      const u=new URL(url),method=init.method||'GET';requests.push({stage,method,url});
      if(options.beforeRequest)await options.beforeRequest({h,stage,method});
      if(options.offline)throw new Error('offline');
      if(options.status)return {ok:false,status:options.status};
      let rows=[];
      if(method==='GET'){
        const w=u.searchParams.get('workspace_id').slice(3),filter=u.searchParams.get('k');
        const keys=filter.startsWith('eq.')?[filter.slice(3)]:filter.slice(4,-1).split(',');
        rows=keys.flatMap(k=>server.has(w+'|'+k)?[copy(server.get(w+'|'+k))]:[]);
      }else{
        const d=JSON.parse(init.body),w=method==='PATCH'?u.searchParams.get('workspace_id').slice(3):d.workspace_id,k=method==='PATCH'?u.searchParams.get('k').slice(3):d.k;
        const current=server.get(w+'|'+k),expected=method==='PATCH'?Number(u.searchParams.get('cupd').slice(3)):null;
        if((method==='PATCH'&&current?.cupd===expected)||(method==='POST'&&!current)){
          const saved={workspace_id:w,k,v:d.v,cupd:d.cupd};
          if(options.transform)options.transform(saved);server.set(w+'|'+k,saved);rows=[copy(saved)];
        }
        if(options.afterWrite)await options.afterWrite({h,w,k,rows});
      }
      if(options.alterResponse)rows=options.alterResponse(rows,{stage,method});
      if(options.afterResponse)await options.afterResponse({h,stage,method});
      return {ok:true,status:200,json:async()=>copy(rows),text:async()=>JSON.stringify(rows)};
    }
  });
  vm.runInContext(code,ctx);
  const h={ctx,state,server,requests,metaWrites,put,get:()=>ctx.boardLiveGet(),save:(v,base)=>ctx.boardLiveSave(v,{uid:base.uid,wid:base.wid,expected_raw:base.raw,expected_cupd:base.cupd}),
    move(changes){({uid,wid,active,seal,epoch,switchEpoch,switchSeal,unlocked}={uid,wid,active,seal,epoch,switchEpoch,switchSeal,unlocked,...changes});},owner:()=>copy(ctx.boardLiveContext())};
  return h;
}
test('coaches sharing a team only read and write their own private workspace',async()=>{
  const h=harness();h.put('team-shared',OLD,raw('other coach'),99);
  const base=await h.get();assert.equal(base.raw,null);assert.equal(base.wid,'private-a');
  const ack=await h.save(raw('A'),base);assert.equal(ack.raw,raw('A'));assert.ok(ack.cupd>0);
  h.move({uid:'coach-b',wid:'private-b',seal:'seal-b'});h.state.owner_id='coach-b';
  const b=await h.get();assert.equal(b.raw,null);await h.save(raw('B'),b);
  assert.equal(h.server.get('private-a|'+KEY).v,raw('A'));assert.equal(h.server.get('private-b|'+KEY).v,raw('B'));
  assert.equal(h.server.get('team-shared|'+OLD).v,raw('other coach'));assert.deepEqual(h.metaWrites,[]);
  assert.ok(h.requests.every(r=>!r.url.includes('workspace_id=eq.team-shared')));
});
test('same coach keeps the same personal board when switching teams',async()=>{
  const h=harness();h.put('private-a',KEY,raw('my board'),5);const a=await h.get();
  h.move({active:'team-b',seal:'new seal',switchEpoch:'new team'});const b=await h.get();assert.equal(a.raw,b.raw);assert.equal(a.wid,b.wid);
});
for(const variant of ['team','foreign owner','member','duplicate personal workspace'])test('refuses '+variant+' as private destination',async()=>{
  const h=harness();if(variant==='team')h.state.kind='team';else if(variant==='foreign owner')h.state.owner_id='other';else if(variant==='member')h.state.role='member';else h.ctx.wsList=()=>[{id:'private-a',kind:'personal',role:'owner'},{id:'private-a',kind:'personal',role:'owner'}];
  await assert.rejects(h.get());assert.equal(h.requests.length,0);
});
for(const mutation of [{uid:'other'},{active:'other team'},{seal:'new seal'},{epoch:1},{switchEpoch:'ABA'},{switchSeal:'transition'},{unlocked:false}])test('late read is rejected on ownership change '+JSON.stringify(mutation),async()=>{
  const h=harness({afterResponse:({h})=>h.move(mutation)});h.put('private-a',KEY,raw('A'));await assert.rejects(h.get(),e=>e.psCode==='sync_workspace_changed');
});
test('a failed request is not mistaken for an empty board',async()=>{
  for(const options of [{offline:true},{status:403},{status:500}])await assert.rejects(harness(options).get());
});
for(const response of ['duplicate','wrong workspace','wrong key','bad raw','bad version'])test('rejects malformed server '+response,async()=>{
  const h=harness({alterResponse:rows=>response==='duplicate'?rows.concat(rows):rows.map(r=>({...r,...(response==='wrong workspace'?{workspace_id:'team-shared'}:response==='wrong key'?{k:OLD}:response==='bad raw'?{v:'null'}:{cupd:true})}))});
  h.put('private-a',KEY,raw('A'));await assert.rejects(h.get());
});
test('save needs an explicit personal owner and exact original preimage',async()=>{
  const h=harness();await assert.rejects(h.ctx.boardLiveSave(raw('A')));await assert.rejects(h.ctx.boardLiveSave(raw('A'),{uid:'other',wid:'private-a',expected_raw:null,expected_cupd:null}));assert.equal(h.requests.length,0);
});
test('another device edit never becomes permission to overwrite it',async()=>{
  const h=harness();h.put('private-a',KEY,raw('base'),5);const base=await h.get();h.put('private-a',KEY,raw('device B'),6);
  await assert.rejects(h.save(raw('device A'),base),e=>e.psCode==='sync_conflict');assert.equal(h.server.get('private-a|'+KEY).v,raw('device B'));assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);
});
test('CAS rejects a write arriving between preflight and mutation',async()=>{
  const h=harness({beforeRequest:({h,method})=>{if(method==='PATCH')h.put('private-a',KEY,raw('race winner'),7);}});h.put('private-a',KEY,raw('base'),5);const base=await h.get();
  await assert.rejects(h.save(raw('my change'),base));assert.equal(h.server.get('private-a|'+KEY).v,raw('race winner'));
});
test('new board insert never overwrites a board created by another device',async()=>{
  const h=harness({beforeRequest:({h,method})=>{if(method==='POST')h.put('private-a',KEY,raw('first writer'),7);}}),base=await h.get();
  await assert.rejects(h.save(raw('second writer'),base));assert.equal(h.server.get('private-a|'+KEY).v,raw('first writer'));
});
test('lost response retry acknowledges the exact saved body without a second mutation',async()=>{
  let lose=true;const h=harness({afterWrite:()=>{if(lose){lose=false;throw new Error('reply lost');}}}),base=await h.get();
  await assert.rejects(h.save(raw('A'),base));const ack=await h.save(raw('A'),base);
  assert.equal(ack.raw,raw('A'));assert.equal(h.requests.filter(r=>r.method!=='GET').length,1);
});
test('server body transformation never marks the private board saved',async()=>{
  const h=harness({transform:s=>{s.v=raw('server refused');}}),base=await h.get();await assert.rejects(h.save(raw('A'),base));
});
test('late ACK after account switch is rejected',async()=>{
  const h=harness({afterWrite:({h})=>h.move({uid:'other',seal:'other'})}),base=await h.get();await assert.rejects(h.save(raw('A'),base),e=>e.psCode==='sync_workspace_changed');
});
test('legacy team live pings cannot trigger a private restore or regular team sync',()=>{
  const rt=section('function rtPing(',"try{ window.addEventListener('online'");let calls=0;
  const c=vm.createContext({Date,meta:()=>({}),clearTimeout(){calls++;},setTimeout(){calls++;},boardLiveGet(){calls++;},rtLast:0,rtHits:0});vm.runInContext(rt,c);c.rtPing({k:OLD,cupd:1});c.rtPing({k:KEY,cupd:1});assert.equal(calls,0);
});
