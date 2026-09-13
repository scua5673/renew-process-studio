'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const S=require('../studio/scouting-store.js');
const KEY='cs_scout_targets_v1',SCHEDULE='process_coach_v1',MATCH='cs_team_matches_v1',META='ps_sync_meta',OWNER='ps_cache_owner_v1';
const MAXLEN=1500000;
const clone=x=>JSON.parse(JSON.stringify(x));
const raw=x=>JSON.stringify(x);
function legacy(label='server'){
  return {v:1,players:[{id:'placement-a',type:'target',dbId:'person-a',name:'가상 후보',club:label,num:'7',foot:'R',grade:'A',profile:{height:'170'},memo:label+' observation',levels:{passing:4}}]};
}
function registry(label='canonical'){
  const d=S.reconcile(null,legacy(label));
  S.edit(d,'db:person-a','club',label,{at:10,id:'initial'});
  d.scoutRegistry.meta={pointSets:[{id:'questions-a',name:'가상 질문',qs:['시야를 확보하는가?']}]};
  d.scoutRegistry.candidates['db:person-a'].points={'questions-a:0':4};
  return d;
}
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
function fn(name){return section(sync,'function '+name+'(','\nfunction ');}
const code=[
  sync.match(/^var BLOB_KEYS=.*$/m)[0],
  fn('cacheOwner'),fn('dataUnlocked'),
  section(sync,'var matchReadyPending=','/* 이 키가 지금 몇 항목인지'),
  fn('holdList'),section(sync,'function holdConflictContext(','/* 올리기 직전 검사.'),
  fn('hash'),fn('nSet'),fn('syncIssue'),fn('syncHttpError'),fn('normalizeCoachDocument'),
  fn('scheduleRevOf'),fn('scheduleTokenNew'),fn('scheduleTokenValid'),fn('scheduleCommitRaw'),
  fn('kvMetaFetch'),fn('kvPullValues'),fn('blobPrepRows'),
  section(sync,'function kvPushRows(','/* ── 1.568 안전장치'),
  section(sync,'function kvWrite(','function libLoad('),
  section(sync,'function syncNowCore(','/* 서버 변경을 로컬에 반영한 뒤'),
].join('\n');
const response=(rows,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(rows),text:async()=>JSON.stringify(rows)});
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));

// Actual syncNowCore, readiness, kvWrite and kvPushRows run in a VM. Only storage,
// HTTP and unrelated channels are mocked. PATCH checks the URL cupd, and missing
// row POST honors ignore-duplicates; a CAS miss must never alter the server map.
function harness(opt={}){
  const local=new Map(),idb=new Map(),server=new Map(),base=new Map(),requests=[],errors=[],acks=[],hooks={},notices=[];
  let session={uid:'coach-a'},active='team-a';
  const state={role:opt.role||'executive',teamRole:opt.teamRole||'owner',team:opt.team!==false};
  local.set(OWNER,raw({v:1,uid:session.uid,wid:active,nonce:'first'}));local.set('ps_active_ws',active);
  if(opt.server!==null)server.set(KEY,{workspace_id:active,k:KEY,v:opt.server===undefined?raw(legacy()):opt.server,cupd:opt.cupd||1});
  if(opt.mirror!=null)local.set(KEY,opt.mirror);if(opt.idb!=null)idb.set(KEY,opt.idb);
  local.set(META,raw({h:{},c:{},n:{},r:{},last:0}));
  const c=vm.createContext({
    Promise,console:{warn(){}},Date,navigator:{onLine:true},setTimeout:()=>0,clearTimeout(){},
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},location:{origin:'https://synthetic.test'},
    localStorage:{getItem(k){if(hooks.localRead)hooks.localRead(k);return local.has(k)?local.get(k):null;},setItem(k,v){if(hooks.localWrite)hooks.localWrite(k,String(v));local.set(k,String(v));},removeItem:k=>local.delete(k),key:i=>[...local.keys()][i]||null,get length(){return local.size;}},
    storage:{async get(k){if(hooks.idbRead)await hooks.idbRead(k);return idb.has(k)?{value:idb.get(k)}:null;},async set(k,v){if(hooks.idbWrite)await hooks.idbWrite(k,v);idb.set(k,v);},
      async replaceIfValue(k,old,value){if(hooks.idbWrite)await hooks.idbWrite(k,value);if(hooks.idbReplace)await hooks.idbReplace(k,old,value);if((idb.has(k)?idb.get(k):null)!==old)return false;if(value==null)idb.delete(k);else idb.set(k,value);return true;}},
    PSStorage:{async sharedReady(k){if(hooks.sharedReady)await hooks.sharedReady(k);}},editMirrorCommit:Promise.resolve(),PSScoutStore:S,
    HOLD_LIST:'ps_hold_list_v1',OWNERKEY:OWNER,MKEY:META,MATCH_KEY:MATCH,SCHEDULE_KEY:SCHEDULE,KEYS:[KEY],PERSONAL:{},MERGE_KEYS:{[KEY]:1},MERGE_LIST:{},
    ITEMS_ACTIVE:false,COPIES_OFF:true,PLAYER_BLIND:[],MAXLEN,SKIPKEY:'skip',TOMBKEY:'tomb',IDP_PRIV_PREFIX:'cs_idp_v1_',
    busy:false,busyDog:0,signOutEpoch:0,dataReady:true,localSwitchToken:'',kvWho:true,KV_PULL_CHUNK:20,
    getSess:()=>session,activeWs:()=>active,activeWsObj:()=>({kind:state.team?'team':'personal',role:state.teamRole}),isTeamWs:()=>state.team,
    workspaceSwitchGuardRead:()=>null,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>'',
    itemsWriteFlush:async()=>{},syncBasePrimeAll:async()=>{},syncBaseGet:k=>base.get(k)||null,syncBaseSet(k,v){if(v==null)base.delete(k);else base.set(k,v);},syncBaseReady:async()=>{},
    ensureToken:async()=>'synthetic',permsPrime:async()=>{},permsRaw:()=>state.role==='missing'?null:raw({defaultRole:state.role,members:{[session.uid]:{role:state.role,scopes:['board','scout']}}}),
    kvPreload:async()=>Object.fromEntries(idb),idbBacked:k=>k===KEY,
    scheduleHeld:()=>false,scheduleWriteAllowed:()=>true,scheduleStructureRepair(){},
    syncMaxLen:()=>MAXLEN,psCount:v=>{try{return JSON.parse(v).players.length;}catch{return 0;}},isItemKey:()=>false,isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,
    importApproved:()=>false,importApprovalGet:()=>null,importApprovalClear(){},pushHold:()=>!!opt.hold,holdClear(){},
    rescueStash(){},syncDiagnostic:(stage,e)=>errors.push({stage,message:String(e),code:e.psCode}),
    BASE:'https://synthetic.invalid',hj:()=>({}),prefBuild:x=>x,KV_PUSH_BYTES:1e6,KV_PUSH_ROWS:15,
    kvInFilter:ks=>'k=in.('+ks.join(',')+')',blobOff:false,
    schedStrip:async value=>hooks.strip?hooks.strip(value):{v:value,blobs:[]},blobCacheSet:async()=>{},blobEnsure:async()=>true,
    PSSchedule:{mondayOf:()=>new Date(2026,8,7)},
    async syncFetch(stage,url,options={}){
      requests.push({stage,url,options});if(hooks.fetch)await hooks.fetch(stage,url,options);
      if(stage==='kv_meta')return opt.httpError?response([],503):response(opt.omitMeta?[]:[...server.values()].map(({k,cupd})=>({k,cupd})));
      if(stage==='kv_pull')return response(opt.missingFull?[]:opt.missingBody?[...server.values()].map(({k,cupd})=>({k,cupd})):[...server.values()]);
      if(stage.endsWith('_verify'))return response([...server.values()]);
      if(stage.startsWith('kv_push')){
        if(opt.deny)return response([],403);
        const parsed=JSON.parse(options.body),list=Array.isArray(parsed)?parsed:[parsed],u=new URL(url),out=[];
        for(const candidate of list){
          const k=options.method==='PATCH'?u.searchParams.get('k').slice(3):candidate.k;
          const old=server.get(k),workspace=options.method==='PATCH'?u.searchParams.get('workspace_id').slice(3):candidate.workspace_id;
          if(opt.casZero||(options.method==='PATCH'&&(!old||String(old.cupd)!==u.searchParams.get('cupd').slice(3)||old.workspace_id!==workspace)))continue;
          if(options.method==='POST'&&String(options.headers.Prefer).includes('ignore-duplicates')&&old)continue;
          const next={workspace_id:workspace,k,v:candidate.v,cupd:candidate.cupd};
          if(opt.rejectAck){out.push({workspace_id:workspace,k,cupd:0});continue;}
          server.set(k,clone(next));out.push({workspace_id:workspace,k,cupd:next.cupd});
        }
        return response(out);
      }
      throw Error('unexpected I/O '+stage);
    },
    outboxMarkRows:async()=>{if(hooks.outbox)await hooks.outbox();},outboxAckSynced:async(_w,m,skip)=>acks.push({m:clone(m),skip:clone(skip)}),outboxFail:async()=>{},
    pendingInfo:()=>({count:0}),visiblePendingInfo:()=>({count:0}),skippedList:()=>[],personalReviewList:()=>[],
    itemsResolveConflicts:async()=>{},itemsLostFlush(){},syncLibrary:async()=>({}),syncPersonal:async()=>0,
    syncIdpBaseSet:async()=>{},syncIdpBaseCompact:async()=>{},syncBaseHas:()=>false,
    setStatus:t=>notices.push(t),renderUI(){},onApplied(){},rtConnect(){},clearSyncRetry(){},
    rejectedMatchRetry:()=>null,classifySyncError:e=>({code:e.psCode||'sync_unexpected',stage:e.psStage||'test'}),syncReasonText:x=>x,scheduleSyncRetry(){},
    usagePing(){},whoRemember(){},namesRefresh(){},pushLog(){},pruneConflictCopies(){},staffEditNotice(){},cacheWaitEnd(){},chip(){},keyLabel:k=>k,
    PSPerms:{role:()=>state.role,canEdit:()=>state.role==='admin'||state.role==='executive'},
  });
  c.window=c;c.parent={postMessage(){}};vm.runInContext(code,c,{filename:'actual scouting sync contract'});
  return {c,local,idb,server,base,requests,errors,acks,hooks,notices,state,
    run:()=>c.syncNowCore('test'),ready:()=>c.keyReady(KEY,active),
    baseline(value,cupd=1){const m=c.meta();m.h[KEY]=c.hash(value);m.c[KEY]=cupd;c.setMeta(m);base.set(KEY,value);},
    switch(uid='coach-b',wid='team-b',nonce='next'){session={uid};active=wid;local.set('ps_active_ws',wid);local.set(OWNER,raw({v:1,uid,wid,nonce}));},
  };
}
const pushed=h=>h.requests.filter(r=>r.stage.startsWith('kv_push')&&!r.stage.endsWith('_verify'));
async function succeeds(h){const r=await h.run();assert.equal(r.error,undefined,JSON.stringify({result:r,errors:h.errors}));return r;}
function notAcked(h){if(h.acks.length)assert.ok(h.acks.at(-1).skip.includes(KEY),'unconfirmed scouting key must remain in outbox');}
function agrees(h){assert.equal(h.ready(),true);assert.equal(h.local.get(KEY),h.idb.get(KEY));assert.equal(h.server.get(KEY).v,h.local.get(KEY));}

test('exact legacy pull issues an owner-scoped marker without rewriting the document',async()=>{
  const value=raw(legacy()),h=harness();assert.equal(h.ready(),false);await succeeds(h);agrees(h);assert.equal(h.local.get(KEY),value);
  const r=h.c.meta().r[KEY];assert.equal(r.u,'coach-a');assert.equal(r.w,'team-a');assert.equal(r.o,h.local.get(OWNER));assert.equal(r.present,true);assert.equal(r.h,h.c.hash(value));assert.equal(pushed(h).length,0);
});

test('confirmed absence requires explicit full lookup and both local stores absent',async()=>{
  const h=harness({server:null});await succeeds(h);assert.equal(h.ready(),true);assert.equal(h.c.meta().r[KEY].present,false);
  assert.ok(h.requests.some(r=>r.stage==='kv_pull'&&r.url.includes(KEY)));assert.equal(h.local.has(KEY),false);assert.equal(h.idb.has(KEY),false);assert.equal(pushed(h).length,0);
});

test('metadata omission cannot hide an existing server scouting document',async()=>{
  const h=harness({omitMeta:true});await succeeds(h);agrees(h);assert.equal(h.c.meta().r[KEY].present,true);assert.equal(pushed(h).length,0);
});

for(const [name,opt]of [['missing mirror',{idb:raw(legacy())}],['missing IDB',{mirror:raw(legacy())}],['split stores',{mirror:raw(legacy()),idb:raw(legacy('stale'))}]]){
  test(`exact reconciliation repairs ${name} before readiness`,async()=>{const h=harness(opt);h.baseline(raw(legacy()));await succeeds(h);agrees(h);});
}

test('last-confirmed old mirror is repaired only when IDB exactly matches the server',async()=>{
  const old=raw(legacy('previous')),current=raw(legacy('current')),h=harness({server:current,cupd:2,mirror:old,idb:current});
  h.baseline(old);await succeeds(h);agrees(h);assert.equal(h.local.get(KEY),current);assert.equal(pushed(h).length,0);
});

for(const [name,mirror,idb]of [['unconfirmed mirror differs from server IDB',raw(legacy('draft mirror')),raw(legacy())],['both stores contain unconfirmed different values',raw(legacy('draft mirror')),raw(legacy('draft IDB'))],['old mirror and unconfirmed IDB',raw(legacy('previous')),raw(legacy('draft IDB'))]]){
  test(`ambiguous split is deferred with all sources preserved: ${name}`,async()=>{
    const server=raw(legacy()),h=harness({server,cupd:2,mirror,idb});h.baseline(raw(legacy('previous')));await h.run();
    assert.equal(h.ready(),false);assert.equal(h.local.get(KEY),mirror);assert.equal(h.idb.get(KEY),idb);assert.equal(h.server.get(KEY).v,server);assert.equal(pushed(h).length,0);notAcked(h);
  });
}

test('IDB changes after split repair planning cannot be overwritten by its old expected snapshot',async()=>{
  const server=raw(legacy()),newIdb=raw(legacy('new IDB input')),h=harness({server,mirror:server,idb:raw(legacy('old IDB'))});h.baseline(server);
  let changed=false;h.hooks.idbReplace=()=>{if(!changed){changed=true;h.idb.set(KEY,newIdb);}};
  await h.run();assert.ok(changed);assert.equal(h.idb.get(KEY),newIdb);assert.equal(h.local.get(KEY),server);assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);notAcked(h);
});

test('dirty local registry forces full server body even when cupd and remembered metadata match',async()=>{
  const b=registry(),l=clone(b);S.edit(l,'db:person-a','club','local edit',{at:20,id:'local'});
  const h=harness({server:raw(b),mirror:raw(l),idb:raw(l)});h.baseline(raw(b));await succeeds(h);agrees(h);
  assert.ok(h.requests.some(r=>r.stage==='kv_pull'));assert.ok(pushed(h).some(r=>r.options.method==='PATCH'&&r.url.includes('cupd=eq.1')));
  assert.equal(JSON.parse(h.server.get(KEY).v).scoutRegistry.candidates['db:person-a'].info.club,'local edit');
});

test('old client server update retains the registry, questions and prior candidate observations',async()=>{
  const b=registry(),old=legacy('old client');old.players[0].memo='old-client new observation';
  const h=harness({server:raw(old),cupd:2,mirror:raw(b),idb:raw(b)});h.baseline(raw(b));await succeeds(h);agrees(h);
  const d=JSON.parse(h.server.get(KEY).v),candidate=d.scoutRegistry.candidates['db:person-a'];
  assert.equal(candidate.info.club,'canonical');assert.equal(candidate.points['questions-a:0'],4);assert.equal(d.scoutRegistry.meta.pointSets[0].id,'questions-a');
  assert.equal(d.players[0].memo,'old-client new observation');assert.deepEqual(d.players[0].levels,{passing:4});
  assert.ok(candidate.variants.some(x=>x.field==='club'&&x.value==='old client'));
});

test('dirty old client local body cannot erase the server registry',async()=>{
  const b=legacy(),server=registry('server registry'),l=legacy('old client local');l.players[0].memo='local scouting observation';
  const h=harness({server:raw(server),cupd:2,mirror:raw(l),idb:raw(l)});h.baseline(raw(b));await succeeds(h);agrees(h);
  const d=JSON.parse(h.server.get(KEY).v);assert.equal(d.scoutRegistry.candidates['db:person-a'].info.club,'server registry');assert.equal(d.players[0].memo,'local scouting observation');assert.equal(d.scoutRegistry.meta.pointSets.length,1);
});

test('simultaneous registry edits preserve independent fields, scores and archive state',async()=>{
  const b=registry(),l=clone(b),s=clone(b);
  S.edit(l,'db:person-a','club','local club',{at:20,id:'local'});S.score(l,'db:person-a','questions-a:0',5,{at:21,id:'local-score'});
  S.edit(s,'db:person-a','foot','L',{at:22,id:'remote'});S.archive(s,'db:person-a',23,{at:23,id:'remote-archive'});
  const h=harness({server:raw(s),cupd:2,mirror:raw(l),idb:raw(l)});h.baseline(raw(b));await succeeds(h);agrees(h);
  const d=JSON.parse(h.server.get(KEY).v),c=d.scoutRegistry.candidates['db:person-a'];assert.equal(c.info.club,'local club');assert.equal(c.info.foot,'L');assert.equal(c.points['questions-a:0'],5);assert.equal(c.archivedAt,23);assert.equal(d.players[0]._scoutHidden,true);
});

test('CAS miss retains the newer server, leaves readiness closed, then merges on the next round',async()=>{
  const b=registry(),l=clone(b),newer=clone(b);S.edit(l,'db:person-a','club','local',{at:20,id:'local'});S.edit(newer,'db:person-a','foot','L',{at:30,id:'remote'});
  const h=harness({server:raw(b),mirror:raw(l),idb:raw(l)});h.baseline(raw(b));let raced=false;
  h.hooks.fetch=stage=>{if(stage==='kv_push_cas'&&!raced){raced=true;h.server.set(KEY,{workspace_id:'team-a',k:KEY,v:raw(newer),cupd:9});}};
  await h.run();assert.ok(raced);assert.equal(h.server.get(KEY).v,raw(newer));assert.equal(h.ready(),false);assert.equal(h.c.meta().h[KEY],h.c.hash(raw(b)));notAcked(h);
  await succeeds(h);agrees(h);const c=JSON.parse(h.server.get(KEY).v).scoutRegistry.candidates['db:person-a'];assert.equal(c.info.club,'local');assert.equal(c.info.foot,'L');
});

test('new row uses ignore-duplicates CAS and never overwrites a row created after absence lookup',async()=>{
  const l=raw(registry('new local')),remote=raw(registry('other device')),h=harness({server:null,mirror:l,idb:l});
  h.hooks.fetch=(stage,_url,options)=>{if(stage==='kv_push_cas'){assert.equal(options.method,'POST');assert.match(options.headers.Prefer,/ignore-duplicates/);h.server.set(KEY,{workspace_id:'team-a',k:KEY,v:remote,cupd:9});}};
  await h.run();assert.equal(h.server.get(KEY).v,remote);assert.equal(h.ready(),false);notAcked(h);
});

test('new local document cannot become ready before its actual HTTP ACK',async()=>{
  const value=raw(registry()),h=harness({server:null,mirror:value,idb:value}),wait=gate();
  h.hooks.fetch=stage=>stage==='kv_push_cas'?wait.promise:undefined;const pending=h.run();await tick();assert.equal(h.ready(),false);assert.equal(h.server.has(KEY),false);wait.resolve();assert.equal((await pending).error,undefined);agrees(h);
});

test('actual blob policy leaves candidate photo bytes unchanged through CAS and readiness',async()=>{
  const d=registry();d.scoutRegistry.candidates['db:person-a'].info.profile.photo='data:fixture-photo';const value=raw(d),h=harness({server:null,mirror:value,idb:value});
  let stripCalls=0;h.hooks.strip=v=>{stripCalls++;return {v:v.replaceAll('data:fixture-photo','blob:fixture-hash'),blobs:[{h:'fixture-hash',v:'data:fixture-photo'}]};};
  await succeeds(h);agrees(h);assert.equal(stripCalls,0);assert.equal(h.server.get(KEY).v,value);
});

for(const [name,change]of [['permission revoked',h=>{h.state.teamRole='member';h.state.role='staff';}],['new local input',h=>{const value=raw(registry('input during preparation'));h.local.set(KEY,value);h.idb.set(KEY,value);}],['owner changed',h=>h.switch()]]){
  test(`${name} during outbox preparation is checked again before the HTTP write`,async()=>{
    const b=raw(registry()),l=raw(registry('local')),h=harness({server:b,mirror:l,idb:l});h.baseline(b);let prepared=false;
    h.hooks.outbox=()=>{prepared=true;change(h);};await h.run();assert.ok(prepared);assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);assert.equal(h.server.get(KEY).v,b);
  });
}

for(const [name,opt]of [['HTTP failure',{httpError:true}],['full row disappeared',{missingFull:true}],['body absent from full row',{missingBody:true}],['broken JSON',{server:'{'}],['null document',{server:'null'}],['bad players shape',{server:'{"v":1,"players":{}}'}],['future document version',{server:raw({...legacy(),v:99})}],['future registry version',{server:raw({...registry(),scoutRegistry:{...registry().scoutRegistry,v:99}})}]]){
  test(`${name} is never confirmed absence and cannot overwrite valid local data`,async()=>{
    const value=raw(registry('safe local')),h=harness({mirror:value,idb:value,...opt});h.baseline(value);await h.run();assert.equal(h.ready(),false);assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);assert.equal(pushed(h).length,0);notAcked(h);
  });
}

for(const [name,opt]of [['server denied write',{deny:true}],['zero-row CAS',{casZero:true}],['server ACK is for an old row',{rejectAck:true}]]){
  test(`${name} cannot advance the baseline or acknowledge scouting changes`,async()=>{
    const b=raw(registry()),l=raw(registry('new local')),h=harness({server:b,mirror:l,idb:l,...opt});h.baseline(b);await h.run();assert.equal(h.ready(),false);assert.equal(h.server.get(KEY).v,b);assert.equal(h.c.meta().h[KEY],h.c.hash(b));notAcked(h);
  });
}

for(const [name,change]of [['missing helper',h=>{h.c.PSScoutStore=null;}],['missing validator',h=>{h.c.PSScoutStore={reconcile:S.reconcile};}],['invalid reconcile output',h=>{h.c.PSScoutStore={...S,reconcile:()=>({v:99,players:[]})};}]]){
  test(`${name} fails closed without replacing either valid source`,async()=>{
    const b=raw(registry()),l=raw(registry('local')),h=harness({server:b,mirror:l,idb:l});h.baseline(b);change(h);await h.run();assert.equal(h.ready(),false);assert.equal(h.local.get(KEY),l);assert.equal(h.idb.get(KEY),l);assert.equal(h.server.get(KEY).v,b);assert.equal(pushed(h).length,0);notAcked(h);
  });
}

test('oversized reconciliation is not pushed or acknowledged and keeps the local content',async()=>{
  const b=raw(registry()),l=registry('local');l.scoutRegistry.candidates['db:person-a'].info.profile.notes='x'.repeat(MAXLEN+1);
  const value=raw(l),h=harness({server:b,mirror:value,idb:value});h.baseline(b);await h.run();assert.equal(h.ready(),false);assert.equal(h.local.get(KEY),value);assert.equal(h.server.get(KEY).v,b);assert.equal(pushed(h).length,0);notAcked(h);
});

test('readiness stays closed throughout a slow IDB write',async()=>{
  const h=harness(),wait=gate();h.hooks.idbWrite=()=>wait.promise;const pending=h.run();await tick();assert.equal(h.ready(),false);wait.resolve();assert.equal((await pending).error,undefined);agrees(h);
});

test('new mirror input during IDB write survives in both stores and is not pushed stale',async()=>{
  const value=raw(registry('new input')),h=harness(),wait=gate();h.hooks.idbWrite=()=>wait.promise;
  const pending=h.run();await tick();h.local.set(KEY,value);wait.resolve();await pending;assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);notAcked(h);
});

for(const [name,change]of [['account and team',h=>h.switch()],['same owner new generation',h=>h.switch('coach-a','team-a','second')],['lock',h=>{h.c.dataReady=false;}],['permission revoked',h=>{h.state.teamRole='member';h.state.role='staff';}]]){
  test(`${name} during exact-store verification cannot issue readiness`,async()=>{
    const h=harness();h.hooks.sharedReady=k=>{if(k===KEY)change(h);};await h.run();assert.equal(h.ready(),false);notAcked(h);
  });
}

for(const idbAlreadyMoved of [false,true]){
  test(`late IDB write after owner switch preserves the new team (IDB already moved: ${idbAlreadyMoved})`,async()=>{
    const h=harness(),wait=gate(),next=raw(registry('new team'));let entered=false;h.hooks.idbWrite=()=>{entered=true;return wait.promise;};
    const pending=h.run();await tick();assert.ok(entered,'the old write is actually pending');h.switch();h.local.set(KEY,next);if(idbAlreadyMoved)h.idb.set(KEY,next);wait.resolve();await pending;
    assert.equal(h.local.get(KEY),next);assert.equal(h.idb.get(KEY),next);assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);
  });
}

test('permission revoked during local write prevents push and ready despite an unchanged owner',async()=>{
  const h=harness({server:raw(registry()),mirror:raw(legacy('local')),idb:raw(legacy('local'))}),wait=gate();h.hooks.idbWrite=()=>wait.promise;
  const pending=h.run();await tick();h.state.teamRole='member';h.state.role='staff';wait.resolve();await pending;assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);notAcked(h);
});

for(const [name,hook]of [['IDB read failure',h=>{h.hooks.idbRead=()=>{throw Error('IDB unavailable');};}],['IDB write failure',h=>{h.hooks.idbWrite=()=>{throw Error('IDB write rejected');};}],['mirror write failure',h=>{h.hooks.localWrite=k=>{if(k===KEY)throw Error('mirror quota');};}],['metadata write failure',h=>{h.hooks.localWrite=(k,value)=>{if(k===META&&JSON.parse(value).r[KEY])throw Error('metadata quota');};}],['exact IDB differs before commit',h=>{h.hooks.sharedReady=k=>{if(k===KEY)h.idb.set(KEY,raw(legacy('changed IDB')));};}]]){
  test(`${name} cannot issue a ready marker`,async()=>{const h=harness();hook(h);await h.run();assert.equal(h.ready(),false);notAcked(h);});
}

for(const role of ['staff','player','missing']){
  test(`${role} never gains executive scouting readiness or push even with scout scope`,async()=>{
    const value=raw(registry('local')),h=harness({server:null,mirror:value,idb:value,role,teamRole:'member'});await h.run();assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);assert.equal(h.c.meta().h[KEY],undefined);
  });
}

test('personal workspace cannot gain team-private scouting readiness',async()=>{const h=harness({team:false});await h.run();assert.equal(h.ready(),false);assert.equal(pushed(h).length,0);});

test('marker cannot be reused across uid, workspace, owner generation or malformed local data',async()=>{
  for(const change of [h=>h.switch('coach-b','team-a'),h=>h.switch('coach-a','team-b'),h=>h.switch('coach-a','team-a','new'),h=>h.local.set(KEY,'{"players":null}'),h=>h.local.delete(KEY)]){
    const h=harness();await succeeds(h);assert.equal(h.ready(),true);change(h);assert.equal(h.ready(),false);
  }
});

test('legacy unscoped marker and malformed presence cannot substitute for exact confirmation',()=>{
  const h=harness({mirror:raw(legacy()),idb:raw(legacy())}),m=h.c.meta();m.r[KEY]={w:'team-a',present:true};h.c.setMeta(m);assert.equal(h.ready(),false);
  m.r[KEY]={w:'team-a',u:'coach-a',o:h.local.get(OWNER),present:'yes'};h.c.setMeta(m);assert.equal(h.ready(),false);
});

test('ordinary valid local edits retain the prior owner confirmation until a sync write begins',async()=>{
  const h=harness();await succeeds(h);h.local.set(KEY,raw(legacy('draft')));h.idb.set(KEY,raw(legacy('draft')));assert.equal(h.ready(),true);
  h.c.scoutReadyInvalidate();assert.equal(h.ready(),false);const m=h.c.meta();m.r[KEY]={w:'team-a',u:'coach-a',o:h.local.get(OWNER),present:true};h.c.setMeta(m);assert.equal(h.c.meta().r[KEY],undefined);
});

test('confirmed absence permits a valid first local candidate draft before its next sync',async()=>{
  const h=harness({server:null});await succeeds(h);assert.equal(h.c.meta().r[KEY].present,false);
  h.local.set(KEY,raw(registry('first draft')));h.idb.set(KEY,raw(registry('first draft')));assert.equal(h.ready(),true);
});

test('direct kvWrite restore invalidates earlier confirmation before asynchronous storage starts',async()=>{
  const h=harness();await succeeds(h);assert.equal(h.ready(),true);const old=h.local.get(KEY),value=raw(legacy('restored')),wait=gate(),writes=[];
  h.hooks.idbWrite=()=>wait.promise;assert.equal(h.c.kvWrite(KEY,value,writes,old,{stale:false},()=>true),true);
  const readyDuringWrite=h.ready();wait.resolve();await Promise.all(writes);
  assert.equal(readyDuringWrite,false);assert.equal(h.ready(),false,'restored body requires a new server confirmation');
});

test('two devices adding different new candidates and placements retain both active records through actual sync',async()=>{
 const base=registry(),l=clone(base),r=clone(base);
 l.players.push({id:'local-new',type:'target',name:'local new',posId:'LW',memo:'local observation'});
 r.players.push({id:'remote-new',type:'target',name:'remote new',posId:'RW',memo:'remote observation'});
 const local=S.reconcile(base,l),remote=S.reconcile(base,r),h=harness({server:raw(remote),cupd:2,mirror:raw(local),idb:raw(local)});h.baseline(raw(base));await succeeds(h);agrees(h);
 const d=JSON.parse(h.server.get(KEY).v);for(const id of ['local-new','remote-new']){const p=d.players.find(p=>p.id===id);assert.ok(p);assert.equal(!!p._scoutHidden,false);assert.ok(d.scoutRegistry.candidates[S.idOf(p)]);}
 assert.equal(d.players.find(p=>p.id==='local-new').memo,'local observation');assert.equal(d.players.find(p=>p.id==='remote-new').memo,'remote observation');
 const stable=h.server.get(KEY).v;await succeeds(h);agrees(h);assert.equal(h.server.get(KEY).v,stable);
});

test('new candidate union still honors explicit remote hiding and archive while local adds another candidate',async()=>{
 const base=registry(),l=clone(base),r=clone(base);l.players.push({id:'local-new',type:'target',name:'local new',posId:'LW'});
 r.players[0]._scoutHidden=true;r.players[0]._scoutMove={at:35,id:'hide-remotely'};
 r.players.push({id:'remote-new',type:'target',name:'archived remotely',posId:'RW',memo:'preserved archive'});
 const local=S.reconcile(base,l),remote=S.reconcile(base,r);S.archive(remote,'target:remote-new',40,{at:40,id:'archive-new'});
 const h=harness({server:raw(remote),cupd:2,mirror:raw(local),idb:raw(local)});h.baseline(raw(base));await succeeds(h);agrees(h);
 const d=JSON.parse(h.server.get(KEY).v);assert.equal(d.players.find(p=>p.id==='placement-a')._scoutHidden,true);assert.equal(d.players.find(p=>p.id==='remote-new')._scoutHidden,true);assert.equal(d.players.find(p=>p.id==='remote-new').memo,'preserved archive');assert.equal(!!d.players.find(p=>p.id==='local-new')._scoutHidden,false);
});

function clientInSync(h){
 h.local.set('ps_sync_session',raw({uid:'coach-a'}));h.local.set('ps_ws_list',raw([{id:'team-a',kind:'team',role:'owner'}]));let wait=null;
 const w={localStorage:h.c.localStorage,PSPerms:h.c.PSPerms,PSSync:{dataUnlocked:h.c.dataUnlocked,keyReady:h.c.keyReady},storage:h.c.storage,
  PSStorage:{sharedReady:()=>wait?wait.promise:Promise.resolve(),sharedVerified:async(k,value)=>{if(h.idb.get(k)!==value||h.local.get(k)!==value)throw Error('different exact store');}},
  psSaveShared:(k,value)=>{h.local.set(k,value);h.idb.set(k,value);return true;}};w.parent=w;
 return {client:S.createClient(w),pause:()=>{wait=gate();return wait;}};
}
test('accepted client save finishes while actual sync temporarily closes ready, then new input resumes',async()=>{
 const h=harness();await succeeds(h);const f=clientInSync(h);await f.client.prepare();const d=clone(f.client.state.doc);S.edit(d,'db:person-a','club','normal concurrent save',{at:600,id:'edit'});
 const localWait=f.pause(),saved=f.client.save(d),cloudWait=gate();h.hooks.fetch=stage=>stage==='kv_push_cas'?cloudWait.promise:undefined;
 const syncing=h.run();await tick();assert.equal(h.ready(),false);assert.throws(()=>f.client.check(),'new input must stay blocked');localWait.resolve();await saved;assert.equal(f.client.state.verified,true,'durable local success does not fail on temporary keyReady');assert.throws(()=>f.client.save(clone(f.client.state.doc)),'no new write while ready is closed');
 cloudWait.resolve();await syncing;assert.equal(h.ready(),true);assert.equal(f.client.state.raw,h.local.get(KEY));assert.doesNotThrow(()=>f.client.check());
});
for(const [name,change]of [['owner generation',h=>h.switch('coach-a','team-a','new-generation')],['permission',h=>{h.state.teamRole='member';h.state.role='staff';}]]){
 test(`accepted client completion still rejects changed ${name} with an exact IDB value`,async()=>{
  const h=harness();await succeeds(h);const f=clientInSync(h);await f.client.prepare();const d=clone(f.client.state.doc);S.edit(d,'db:person-a','club','accepted draft',{at:610,id:'edit'});
  const wait=f.pause(),saved=assert.rejects(f.client.save(d));change(h);wait.resolve();await saved;assert.equal(f.client.state.verified,false);assert.throws(()=>f.client.check());assert.equal(h.local.get(KEY),h.idb.get(KEY));
 });
}
