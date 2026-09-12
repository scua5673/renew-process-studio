'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const wrapper=fs.readFileSync(path.join(__dirname,'../studio/review-training-schedule.js'),'utf8');
const R=require('../studio/review-training.js');
const KEY='process_coach_v1',MATCH='cs_team_matches_v1',META='ps_sync_meta',OWNER='ps_cache_owner_v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const doc=(label='server')=>JSON.stringify({anchorMonday:'2026-09-07',weeks:{0:Array.from({length:7},(_,i)=>({trainings:i===1?[{id:label,title:label}]:[]}))}});
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
function fn(name){return section(sync,'function '+name+'(','\nfunction ');}
const code=[
  fn('cacheOwner'),fn('dataUnlocked'),
  section(sync,'var matchReadyPending=','/* 이 키가 지금 몇 항목인지'),
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

// Run the actual sync round, HTTP ACK/CAS, kvWrite and readiness functions.
// I/O, unrelated IDP/library channels and the UI are synthetic. No keyReady stub,
// live account, real browser store or network is involved.
function harness(opt={}){
  const local=new Map(),idb=new Map(),server=new Map(),base=new Map(),requests=[],errors=[],acks=[],hooks={},notices=[],nodes=new Map();
  let session={uid:'coach-a'},active='team-a',held=false;
  local.set(OWNER,JSON.stringify({v:1,uid:session.uid,wid:active,nonce:'first'}));
  local.set('ps_active_ws',active);
  if(opt.server!==null)server.set(KEY,{workspace_id:active,k:KEY,v:opt.server||doc(),cupd:opt.cupd||1});
  if(opt.mirror!==undefined&&opt.mirror!==null)local.set(KEY,opt.mirror);
  if(opt.idb!==undefined&&opt.idb!==null)idb.set(KEY,opt.idb);
  const empty={h:{},c:{},n:{},r:{},last:0};local.set(META,JSON.stringify(empty));
  const state={role:'executive',write:true};
  const classes=()=>{const s=new Set();return {add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)};};
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},dataset:{},value:'',classList:classes(),setAttribute(){},focus(){},querySelector(){return node('close');}});return nodes.get(id);};
  const c=vm.createContext({
    Promise,console:{warn(){}},Date,navigator:{onLine:true},setTimeout:()=>0,clearTimeout(){},
    document:{getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    addEventListener(){},location:{origin:'https://synthetic.test'},
    localStorage:{getItem(k){if(hooks.localRead)hooks.localRead(k);return local.has(k)?local.get(k):null;},
      setItem(k,v){if(hooks.localWrite)hooks.localWrite(k,String(v));local.set(k,String(v));},removeItem:k=>local.delete(k),key:i=>[...local.keys()][i]||null,get length(){return local.size;}},
    storage:{async get(k){if(hooks.idbRead)await hooks.idbRead(k);return idb.has(k)?{value:idb.get(k)}:null;},
      async set(k,v){if(hooks.idbWrite)await hooks.idbWrite(k,v);idb.set(k,v);},
      async replaceIfValue(k,old,value){if((idb.has(k)?idb.get(k):null)!==old)return false;if(value==null)idb.delete(k);else idb.set(k,value);return true;}},
    PSStorage:{async sharedReady(k){if(hooks.sharedReady)await hooks.sharedReady(k);}},editMirrorCommit:Promise.resolve(),
    OWNERKEY:OWNER,MKEY:META,MATCH_KEY:MATCH,SCHEDULE_KEY:KEY,KEYS:[KEY],PERSONAL:{},MERGE_KEYS:{[KEY]:1},MERGE_LIST:{},
    ITEMS_ACTIVE:false,COPIES_OFF:true,PLAYER_BLIND:[],MAXLEN:2e6,SKIPKEY:'skip',TOMBKEY:'tomb',IDP_PRIV_PREFIX:'cs_idp_v1_',
    busy:false,busyDog:0,signOutEpoch:0,dataReady:true,localSwitchToken:'',kvWho:true,KV_PULL_CHUNK:20,
    getSess:()=>session,activeWs:()=>active,activeWsObj:()=>({role:opt.teamRole||'owner'}),isTeamWs:()=>true,
    workspaceSwitchGuardRead:()=>null,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>'',
    syncBasePrimeAll:async()=>{},syncBaseGet:k=>base.get(k)||null,syncBaseSet(k,v){if(v==null)base.delete(k);else base.set(k,v);},syncBaseReady:async()=>{},
    ensureToken:async()=>'synthetic',permsPrime:async()=>{},permsRaw:()=>JSON.stringify({defaultRole:opt.role||'admin'}),
    kvPreload:async()=>Object.fromEntries(idb),idbBacked:k=>k===KEY,
    scheduleHeld:()=>held,scheduleWriteAllowed:()=>state.write,scheduleStructureRepair(){},
    syncMaxLen:()=>2e6,psCount:()=>1,isItemKey:()=>false,isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,
    importApproved:()=>false,importApprovalGet:()=>null,importApprovalClear(){},pushHold:()=>!!opt.hold,holdClear(){},
    rescueStash(){},syncDiagnostic:(stage,e)=>errors.push({stage,e}),
    BASE:'https://synthetic.invalid',hj:()=>({}),prefBuild:x=>x,KV_PUSH_BYTES:1e6,KV_PUSH_ROWS:15,
    kvInFilter:ks=>'k=in.('+ks.join(',')+')',BLOB_KEYS:{[KEY]:1},blobOff:false,
    schedStrip:async raw=>hooks.strip?hooks.strip(raw):{v:raw,blobs:[]},blobCacheSet:async()=>{},blobEnsure:async()=>true,
    PSSchedule:{mondayOf:()=>new Date(2026,8,7)},
    async syncFetch(stage,url,options={}){
      requests.push({stage,url,options});if(hooks.fetch)await hooks.fetch(stage,options);
      if(opt.httpError&&stage==='kv_meta')return response([],503);
      if(stage==='kv_meta')return response(opt.omitScheduleMeta?[]:[...server.values()].map(({k,cupd})=>({k,cupd})));
      if(stage==='kv_pull')return response(opt.missingFull?[]:[...server.values()]);
      if(stage.endsWith('_verify'))return response([...server.values()]);
      if(stage.startsWith('kv_push')){
        if(opt.deny)return response([],403);
        const rows=JSON.parse(options.body),list=Array.isArray(rows)?rows:[rows];
        if(opt.rejectAck)return response(list.map(r=>({workspace_id:r.workspace_id,k:r.k,cupd:0})));
        list.forEach(r=>server.set(r.k,clone(r)));
        return response(list.map(({workspace_id,k,cupd})=>({workspace_id,k,cupd})));
      }
      throw Error('unexpected I/O '+stage);
    },
    outboxMarkRows:async()=>{},outboxAckSynced:async(_w,m,skip)=>acks.push({m:clone(m),skip:clone(skip)}),outboxFail:async()=>{},
    pendingInfo:()=>({count:0}),visiblePendingInfo:()=>({count:0}),skippedList:()=>[],personalReviewList:()=>[],
    itemsResolveConflicts:async()=>{},itemsLostFlush(){},syncLibrary:async()=>{if(hooks.library)await hooks.library();return {};},syncPersonal:async()=>0,
    syncIdpBaseSet:async()=>{},syncIdpBaseCompact:async()=>{},syncBaseHas:()=>false,
    setStatus:t=>notices.push(t),renderUI(){},onApplied(){},rtConnect(){},clearSyncRetry(){},
    rejectedMatchRetry:()=>null,classifySyncError:e=>({code:e.psCode||'sync_unexpected',stage:e.psStage||'test'}),syncReasonText:x=>x,scheduleSyncRetry(){},
    usagePing(){},whoRemember(){},namesRefresh(){},pushLog(){},pruneConflictCopies(){},staffEditNotice(){},cacheWaitEnd(){},
    PSPerms:{role:()=>state.role,canEdit:()=>true},schedEditBlocked:()=>!state.write,PSReviewTraining:R,
    toast:t=>notices.push(t),weeksMap:{},__ANCHOR:new Date(2026,8,7),wk:0,curSession:null,
    schedGroups:()=>[],schedDefGrp:()=>'',__schedUpdateSignal(){},__schedDrainIncoming(){},
    offsetOfDate:d=>Math.round((d-new Date(2026,8,7))/864e5),blankWeek:()=>Array.from({length:7},()=>({trainings:[]})),
  });
  c.window=c;c.parent={PSSync:null,postMessage(){}};
  vm.runInContext(code,c,{filename:'actual sync readiness contract'});
  c.parent.PSSync={session:c.getSess,dataUnlocked:c.dataUnlocked,keyReady:c.keyReady};
  c.store={owner:()=>local.get(OWNER),get:k=>local.has(k)?JSON.parse(local.get(k)):null};
  c.matchSession=c.getSess;c.matchCurrent='match-a';
  vm.runInContext(section(scout,'function matchTrainingContext(','function matchTrainingRecentRows('),c);
  local.set(MATCH,JSON.stringify({matches:[{id:'match-a',date:'2026-09-05',opponent:'Away',reviewImprove:'improve'}]}));
  const m=c.meta();m.r[MATCH]={w:active,present:true};c.setMeta(m);
  vm.runInContext(wrapper,c);
  return {c,local,idb,server,base,requests,errors,acks,hooks,notices,nodes,state,
    run:()=>c.syncNowCore('test'),ready:()=>c.keyReady(KEY,active),read:()=>c.matchTrainingSchedule(),
    apply(){const raw=local.get(KEY)||'';c.__schedSavedRaw=raw;c.weeksMap=raw?JSON.parse(raw).weeks:{};},
    open:()=>c.PSReviewSchedule.open({matchId:'match-a'}),hold:x=>{held=x;},
    baseline(raw,cupd=1){const m=c.meta();m.h[KEY]=c.hash(raw);m.c[KEY]=cupd;c.setMeta(m);base.set(KEY,raw);},
    switch(uid='coach-b',wid='team-b',nonce='next'){session={uid};active=wid;local.set('ps_active_ws',wid);local.set(OWNER,JSON.stringify({v:1,uid,wid,nonce}));},
  };
}

test('actual sync readiness is false before server confirmation and opens both consumers after exact pull',async()=>{
  const h=harness();assert.equal(h.ready(),false);assert.equal(h.read(),null);assert.equal(h.open(),false);
  const result=await h.run();assert.equal(result.error,undefined,JSON.stringify(result));
  assert.equal(h.ready(),true);assert.equal(h.local.get(KEY),doc());assert.equal(h.idb.get(KEY),doc());
  assert.equal(h.read().weeks[0][1].trainings[0].title,'server');h.apply();assert.equal(h.open(),true);
});

test('same cupd/hash without a real schedule marker still requests full server data',async()=>{
  const raw=doc(),h=harness({mirror:raw,idb:raw});h.baseline(raw);
  assert.equal(h.c.keyReady(MATCH,'team-a'),true);assert.equal(h.ready(),false);
  assert.equal((await h.run()).error,undefined);assert.ok(h.requests.some(r=>r.stage==='kv_pull'));assert.equal(h.ready(),true);
});

for(const [name,options]of [['missing mirror',{idb:doc()}],['missing IDB',{mirror:doc()}],['split IDB',{mirror:doc(),idb:doc('stale')}]]){
  test(`repairs ${name} before readiness`,async()=>{const h=harness(options);h.baseline(doc());assert.equal((await h.run()).error,undefined);assert.equal(h.ready(),true);assert.equal(h.idb.get(KEY),doc());assert.equal(h.local.get(KEY),doc());});
}

test('verified server and both local stores absent allows a genuinely new schedule',async()=>{
  const h=harness({server:null});assert.equal(h.read(),null);assert.equal((await h.run()).error,undefined);
  assert.ok(h.requests.some(r=>r.stage==='kv_pull'&&r.url.includes(KEY)),'absence is checked with an explicit schedule-key query');
  assert.equal(h.ready(),true);assert.equal(h.c.meta().r[KEY].present,false);assert.deepEqual(clone(h.read()),{weeks:{}});h.apply();assert.equal(h.open(),true);
});

test('a row missing from the metadata list but present on explicit key lookup is pulled',async()=>{
  const h=harness({omitScheduleMeta:true});assert.equal((await h.run()).error,undefined);
  assert.equal(h.ready(),true);assert.equal(h.c.meta().r[KEY].present,true);assert.equal(h.local.get(KEY),doc());
  assert.equal(h.requests.some(r=>r.stage.startsWith('kv_push')),false);
});

for(const [name,opt]of [['network failure',{httpError:true}],['row omitted between metadata and full pull',{missingFull:true}],['bad JSON',{server:'{'}],['null weeks',{server:JSON.stringify({anchorMonday:'2026-09-07',weeks:null})}],['array weeks',{server:JSON.stringify({anchorMonday:'2026-09-07',weeks:[]})}],['rolled-over invalid anchor',{server:doc().replace('2026-09-07','2026-02-30')}]]){
  test(`${name} never becomes confirmed absence`,async()=>{const h=harness(opt);await h.run();assert.equal(h.ready(),false);assert.equal(h.read(),null);assert.equal(h.open(),false);});
}

test('ready remains closed while IDB is writing and until its exact mirror is verified',async()=>{
  const h=harness(),wait=gate();h.hooks.idbWrite=()=>wait.promise;
  const pending=h.run();await tick();assert.equal(h.ready(),false);assert.equal(h.read(),null);wait.resolve();await pending;assert.equal(h.ready(),true);
});

test('unreadable server document cannot acknowledge the existing schedule outbox',async()=>{
  const h=harness({server:'{',mirror:doc(),idb:doc()});h.baseline(doc());await h.run();
  assert.equal(h.ready(),false);assert.equal(h.local.get(KEY),doc());assert.equal(h.idb.get(KEY),doc());
  assert.equal(h.acks.length,1);assert.ok(h.acks[0].skip.includes(KEY));
});

test('a newer mirror edit during IDB write survives and cannot issue a ready marker',async()=>{
  const h=harness(),wait=gate();h.hooks.idbWrite=()=>wait.promise;
  const pending=h.run();await tick();h.local.set(KEY,doc('new input'));wait.resolve();await pending;
  assert.equal(h.local.get(KEY),doc('new input'));assert.equal(h.idb.get(KEY),doc('new input'));assert.equal(h.ready(),false);
});

for(const [name,change]of [['account and team',h=>h.switch()],['same owner ABA generation',h=>h.switch('coach-a','team-a','second')],['lock',h=>{h.c.dataReady=false;}]]){
  test(`owner change during exact verification: ${name}`,async()=>{
    const h=harness();h.hooks.sharedReady=k=>{if(k===KEY)change(h);};await h.run();assert.equal(h.ready(),false);assert.equal(h.read(),null);
  });
}

test('metadata persistence failure cannot emit a schedule ready marker',async()=>{
  const h=harness();h.hooks.localWrite=(k,v)=>{if(k===META&&JSON.parse(v).r[KEY])throw Error('quota');};await h.run();assert.equal(h.ready(),false);
});

test('new local schedule becomes ready only after actual server ACK',async()=>{
  const h=harness({server:null,mirror:doc('new'),idb:doc('new')}),wait=gate();h.hooks.fetch=stage=>stage==='kv_push'?wait.promise:undefined;
  const pending=h.run();await tick();assert.equal(h.ready(),false);wait.resolve();const result=await pending;
  assert.equal(result.error,undefined,JSON.stringify(result));assert.equal(h.ready(),true);assert.equal(h.server.get(KEY).v,h.local.get(KEY));
});

for(const [name,opt]of [['403 isolated denial',{deny:true}],['server returned old row',{rejectAck:true}],['local permission denial',{role:'staff',teamRole:'member'}]]){
  test(`${name} keeps schedule readiness and outbox ACK closed`,async()=>{
    const h=harness({server:null,mirror:doc('new'),idb:doc('new'),...opt});await h.run();assert.equal(h.ready(),false);assert.equal(h.c.meta().h[KEY],undefined);
    if(h.acks.length)assert.ok(h.acks.at(-1).skip.includes(KEY));
  });
}

test('ACK of the actual blob-transformed queued row verifies its original local document',async()=>{
  const h=harness({server:null,mirror:doc('image'),idb:doc('image')});
  h.hooks.strip=raw=>({v:raw.replaceAll('image','thumbRef'),blobs:[{h:'hash',v:'image'}]});
  assert.equal((await h.run()).error,undefined);assert.equal(h.ready(),true);assert.notEqual(h.server.get(KEY).v,h.local.get(KEY));
  assert.equal(h.idb.get(KEY),h.local.get(KEY));
});

test('an established ready baseline remains usable during a normal active editor hold',async()=>{
  const h=harness();await h.run();h.hold(true);h.local.set(KEY,doc('draft'));h.idb.set(KEY,doc('draft'));
  await h.run();assert.equal(h.ready(),true);assert.equal(h.read().weeks[0][1].trainings[0].title,'draft');
});

test('first verification is deferred while an editor is holding the schedule',async()=>{
  const h=harness({mirror:doc(),idb:doc()});h.hold(true);await h.run();assert.equal(h.ready(),false);assert.equal(h.open(),false);
});

test('newly ready mirror does not open a sheet over an unapplied frame model',async()=>{
  const h=harness();h.c.__schedSavedRaw='';h.c.weeksMap={0:[{trainings:[{id:'unsaved'}]}]};const before=JSON.stringify(h.c.weeksMap);
  await h.run();assert.equal(h.ready(),true);assert.equal(h.open(),false);assert.equal(JSON.stringify(h.c.weeksMap),before);assert.match(h.notices.at(-1),/화면에 반영/);
  h.apply();assert.equal(h.open(),true);
});

test('an existing editor is never replaced merely because the schedule is ready',async()=>{
  const h=harness();await h.run();h.apply();h.c.curSession={id:'editing'};assert.equal(h.open(),false);assert.equal(h.c.curSession.id,'editing');
});

test('missing API and legacy unscoped markers do not substitute for readiness',async()=>{
  const h=harness();await h.run();h.apply();h.c.parent.PSSync.keyReady=undefined;assert.equal(h.read(),null);assert.equal(h.open(),false);
});

test('changed owner nonce or corrupt mirror invalidates a previously confirmed marker',async()=>{
  const h=harness();await h.run();h.local.set(KEY,'{"weeks":[]}');assert.equal(h.ready(),false);
  h.local.set(KEY,doc());assert.equal(h.ready(),true);h.switch('coach-a','team-a','second');assert.equal(h.ready(),false);assert.equal(h.read(),null);
});

test('schedule-ready metadata events defer full match refresh while review input is focused',()=>{
  let handler,refreshed=0;
  const c=vm.createContext({document:{activeElement:{tagName:'TEXTAREA',value:'unsaved review'}},
    addEventListener:(_name,f)=>{handler=f;},matchDocPending:()=>false,__matchRefresh:()=>{refreshed++;}});c.window=c;
  vm.runInContext(section(scout,'window.addEventListener("storage",function(e){\n  if(e.key==="ps_sync_meta")',
    'document.addEventListener("focusout",function(){'),c);
  handler({key:META});assert.equal(refreshed,0);assert.equal(c.__matchStale,1);assert.equal(c.document.activeElement.value,'unsaved review');
  c.document.activeElement=null;handler({key:META});assert.equal(refreshed,1);
});
