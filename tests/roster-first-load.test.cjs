'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const S=require('../studio/scouting-store.js');
const KEY='scout_tool_v1',SCHEDULE='process_coach_v1',MATCH='cs_team_matches_v1',META='ps_sync_meta',OWNER='ps_cache_owner_v1';
const MAXLEN=1500000;
const clone=x=>JSON.parse(JSON.stringify(x));
const raw=x=>JSON.stringify(x);
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

// Main roster uses the actual syncNowCore, readiness, kvWrite and kvPushRows. Only storage,
// HTTP and unrelated channels are mocked. PATCH checks the URL cupd, and missing
// row POST honors ignore-duplicates; a CAS miss must never alter the server map.
function harness(opt={}){
  const local=new Map(),idb=new Map(),server=new Map(),base=new Map(),requests=[],errors=[],acks=[],hooks={},notices=[];
  let session={uid:'coach-a'},active='team-a';
  const state={role:opt.role||'executive',teamRole:opt.teamRole||'owner',team:opt.team!==false};
  local.set(OWNER,raw({v:1,uid:session.uid,wid:active,nonce:'first'}));local.set('ps_active_ws',active);
  if(opt.server!=null)server.set(KEY,{workspace_id:active,k:KEY,v:opt.server,cupd:opt.cupd||1});
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
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const scoutCode=[
  section(scout,'function scoutBootAllowed(){','function init(){'),
  section(scout,'var scoutReadOnlyLoad=','/* 계정·팀을 확인한 기기 보관본만'),
  section(scout,'function save(){','function attr('),
].join('\n');
function roster(){return {attrs:[],positions:[],players:[{id:'synthetic-p1',name:'Synthetic retained',levels:{passing:5},memo:'latest note',records:[{at:17,value:'preserve'}]}],meta:{teamName:'Synthetic',evalMode:'fifa'}};}
function mountScout(h){
  const writes=[],timers=[];let generated=0;
  h.local.set('ps_sync_session','{"uid":"coach-a"}');
  Object.assign(h.c,{
    KEY,TKEY:'cs_scout_targets_v1',data:{attrs:[],positions:[],players:[],meta:{}},scoutBootPending:true,scMainMigrationPending:false,
    itemsWriteBusy:()=>false,itemsHoldList:()=>({ids:[]}),psSync:()=>h.c,
    store:{get(k){const value=h.local.get(k);return value==null?null:JSON.parse(value);},set(k,value){const valueRaw=raw(value);writes.push({k,value:valueRaw});h.local.set(k,valueRaw);h.idb.set(k,valueRaw);return true;}},
    setTimeout(fn){timers.push(fn);return timers.length;},
    init(){h.initCount=(h.initCount||0)+1;h.c.load();if(h.c.scoutAutomaticWriteAllowed())h.c.save({skipTargets:true});},
    fifaAttrs:()=>[],fifaCats:()=>[],DEFAULT_POS:[],DEFAULT_CATS:[],TM_POS:[],
    uid:prefix=>prefix+'-synthetic-'+(++generated),posAbbr:x=>x,tmNorm:x=>x,
    cloneAttrs:clone,refreshCats(){},loadTargets:()=>[],isTargetPl:p=>!!(p&&p.type==='target'),canSeeTargets:()=>false,
    plTombApply:ps=>ps,rosterKeepSave(){},rosterRecoveryMenu(){},evalMode:()=>h.c.data.meta.evalMode||'fifa',evalSetId:()=> 'fifa',
    rememberTeamSet(){},plStatusOf:()=>'',
  });
  vm.runInContext(scoutCode,h.c,{filename:'actual scout first load and save'});
  return Object.assign(h,{draftWrites:writes,bootTimers:timers});
}

test('a slow first pull cannot initialize or save a blank model; actual load adopts all latest player fields',async()=>{
  const expected=roster(),value=raw(expected),h=mountScout(harness({server:value})),g=gate();
  h.hooks.fetch=stage=>stage==='kv_pull'?g.promise:undefined;
  const pending=h.run();await tick();
  h.c.scoutBoot();assert.equal(h.initCount,undefined);assert.equal(h.c.load(),false);assert.equal(h.c.save(),false);
  assert.equal(h.draftWrites.length,0);assert.equal(h.c.data.players.length,0);assert.equal(h.local.has(KEY),false);assert.equal(h.idb.has(KEY),false);
  g.resolve();const result=await pending;assert.equal(result.error,undefined,JSON.stringify(h.errors));
  assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);
  h.c.scoutBoot();assert.equal(h.initCount,1);assert.equal(h.c.scoutBootPending,false);
  assert.deepEqual(clone(h.c.data.players),expected.players);
  assert.deepEqual(JSON.parse(h.local.get(KEY)).players,expected.players);
  assert.deepEqual(JSON.parse(h.idb.get(KEY)).players,expected.players);
  assert.equal(h.server.get(KEY).v,value);assert.equal(pushed(h).length,0);
});

test('a fresh main mirror cannot trigger storage-event load or bootstrap normalization before its first confirmation',async()=>{
  const value=raw(roster()),h=mountScout(harness({server:value})),g=gate();
  h.hooks.outbox=()=>g.promise;
  const pending=h.run();await tick();assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);
  assert.equal(h.c.meta().h[KEY],undefined);assert.equal(h.c.rosterReady('team-a'),false);
  assert.equal(h.c.scoutBootAllowed(),false);assert.equal(h.c.load(),false);h.c.scoutBoot();
  assert.equal(h.initCount,undefined);assert.equal(h.draftWrites.length,0);
  g.resolve();const result=await pending;assert.equal(result.error,undefined,JSON.stringify(h.errors));
  h.c.scoutBoot();assert.equal(h.initCount,1);assert.deepEqual(clone(h.c.data.players),roster().players);
  assert.equal(h.server.get(KEY).v,value);assert.equal(pushed(h).length,0);
});

test('a valid dirty cache with an existing owner-scoped baseline remains editable before reconnect confirmation',()=>{
  const value=raw(roster()),changed=roster();changed.players[0].memo='SYNTHETIC unsent edit';const edited=raw(changed);
  const h=mountScout(harness({server:value,mirror:edited,idb:edited}));h.baseline(value);
  assert.equal(h.c.rosterReady('team-a'),false);assert.equal(h.c.scoutBootAllowed(),true);
  // Storage events cannot call load until the one bootstrap owns initialization.
  assert.equal(h.c.load(),false);h.c.scoutBoot();assert.equal(h.initCount,1);
  assert.equal(h.c.data.players[0].memo,changed.players[0].memo);assert.equal(h.requests.length,0);
});

test('a new tab repairs an absent main mirror when IDB and unchanged server already agree, with no server write',async()=>{
  const expected=roster(),value=raw(expected),h=mountScout(harness({server:value,idb:value}));h.baseline(value);
  assert.equal(h.c.scoutBootAllowed(),false);h.c.scoutBoot();assert.equal(h.draftWrites.length,0);
  await succeeds(h);assert.ok(h.requests.some(r=>r.stage==='kv_pull'));
  assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);assert.equal(pushed(h).length,0);
  h.c.scoutBoot();assert.deepEqual(clone(h.c.data.players),expected.players);assert.equal(h.server.get(KEY).v,value);
});

test('a confirmed absent server roster permits the first empty document and a subsequent real player save',async()=>{
  const h=mountScout(harness({server:null}));assert.equal(h.c.scoutBootAllowed(),false);
  await succeeds(h);assert.equal(h.c.rosterReady('team-a'),true);assert.equal(h.c.scoutBootAllowed(),true);
  h.c.scoutBoot();assert.equal(h.initCount,1);assert.deepEqual(JSON.parse(h.local.get(KEY)).players,[]);
  const player=roster().players[0];h.c.data.players.push(player);assert.equal(h.c.save(),true);
  assert.deepEqual(JSON.parse(h.idb.get(KEY)).players,[player]);assert.equal(h.server.size,0);
});

test('a local guest still creates and edits a new roster without a server confirmation',()=>{
  const h=mountScout(harness({server:null}));for(const key of ['ps_sync_session','ps_active_ws',OWNER])h.local.delete(key);
  assert.equal(h.c.scoutBootAllowed(),true);h.c.scoutBoot();assert.equal(h.initCount,1);
  h.c.data.players.push(roster().players[0]);assert.equal(h.c.save(),true);
  assert.deepEqual(JSON.parse(h.local.get(KEY)).players,roster().players);assert.equal(h.requests.length,0);
});

test('an existing owner-scoped cached roster remains usable offline',()=>{
  const value=raw(roster()),h=mountScout(harness({server:value,mirror:value,idb:value}));h.c.navigator.onLine=false;
  assert.equal(h.c.scoutBootAllowed(),true);h.c.scoutBoot();assert.equal(h.initCount,1);
  assert.deepEqual(clone(h.c.data.players),roster().players);assert.equal(h.requests.length,0);
});

test('malformed existing main content never becomes permission to create a blank document',async()=>{
  for(const value of ['{broken','null',raw({attrs:[],positions:[],players:{}})]){
    const h=mountScout(harness({server:null,mirror:value}));await succeeds(h);
    assert.equal(h.c.scoutBootAllowed(),false);h.c.scoutBoot();assert.equal(h.c.load(),false);assert.equal(h.c.save(),false);
    assert.equal(h.initCount,undefined);assert.equal(h.draftWrites.length,0);assert.equal(h.local.get(KEY),value);
  }
});

test('a quota failure while creating the mandatory main mirror leaves initialization closed and server intact',async()=>{
  const value=raw(roster()),h=mountScout(harness({server:value}));
  h.hooks.localWrite=k=>{if(k===KEY)throw Error('synthetic quota');};
  const result=await h.run();assert.ok(result.error);
  assert.equal(h.idb.get(KEY),value);assert.equal(h.local.has(KEY),false);assert.equal(h.c.rosterReady('team-a'),false);
  h.c.scoutBoot();assert.equal(h.initCount,undefined);assert.equal(h.c.save(),false);assert.equal(h.draftWrites.length,0);
  assert.equal(h.server.get(KEY).v,value);assert.equal(pushed(h).length,0);
});

test('failed main IDB persistence cannot expose a mirror or start a draft',async()=>{
  const value=raw(roster()),h=mountScout(harness({server:value}));h.hooks.idbWrite=()=>{throw Error('synthetic disk');};
  const result=await h.run();assert.ok(result.error);assert.equal(h.local.has(KEY),false);assert.equal(h.idb.has(KEY),false);
  assert.equal(h.c.rosterReady('team-a'),false);h.c.scoutBoot();assert.equal(h.initCount,undefined);assert.equal(h.draftWrites.length,0);
  assert.equal(h.server.get(KEY).v,value);assert.equal(pushed(h).length,0);
});

test('cached content never opens the bootstrap across a cache owner mismatch or active switch',()=>{
  for(const mode of ['owner','switch']){
    const value=raw(roster()),h=mountScout(harness({server:value,mirror:value,idb:value}));
    if(mode==='owner')h.local.set(OWNER,raw({uid:'coach-b',wid:'team-a'}));else h.local.set('ps_ws_switch_guard_v1','{"phase":"wipe"}');
    assert.equal(h.c.scoutBootAllowed(),false);h.c.scoutBoot();assert.equal(h.c.load(),false);assert.equal(h.c.save(),false);
    assert.equal(h.initCount,undefined);assert.equal(h.draftWrites.length,0);assert.equal(h.local.get(KEY),value);
  }
});

function readOnlyScout(h){
  const storage=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8'),perms=fs.readFileSync(path.join(__dirname,'../studio/perms.js'),'utf8'),classes=new Set(),toasts=[];
  Object.assign(h.c,{
    document:{body:{classList:{add:x=>classes.add(x),contains:x=>classes.has(x)}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt.detail;}},dispatchEvent(){},clearInterval(){},setInterval:()=>0,
    toast:message=>toasts.push(message),canEdit:()=>false,sess:()=>({uid:'coach-a'}),perms:()=>({defaultRole:'player'}),label:()=>'',banner(){},hideControls(){},
    syncedKey:k=>['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1'].includes(k),PSPerms:{canEdit:()=>false},
    afterMigrate:fn=>Promise.resolve().then(fn),idbGet:k=>Promise.resolve(h.idb.get(k)),PSStorageDiagnostic(){},renderAttrs(){},renderForms(){},
  });
  vm.runInContext([
    section(storage,'/* PROCESS STUDIO — 저장 상태(PSSaveState)','/* PROCESS STUDIO — 일정 기준선'),
    section(storage,'  function migrationOwner(','  function migrationCurrent('),
    section(storage,'  var sharedWrites={},sharedLatest={};','  /* v369 — 팀 전환 전체 백업'),
    'window.PSStorage={sharedReady:sharedReady,sharedVerified:sharedVerified};',
    section(scout,'const mem={};','const KEY='),
    section(scout,'function setEvalMode(','// 기본 속성 없음'),
    section(perms,'  function gate(section, opts){','  window.PSPerms='),
    'window.actualStore=store;',
  ].join('\n'),h.c);
  h.c.gate('team');return Object.assign(h,{toasts});
}

test('a delayed read-only bootstrap displays the loaded roster without any attempted save, failure state or popup',async()=>{
  const value=raw(roster()),h=readOnlyScout(mountScout(harness({server:value})));
  h.c.scoutBoot();assert.equal(h.initCount,undefined);
  // The parent pull writes outside the read-only child wrapper; storage events
  // share these bytes, then the child's original delayed bootstrap resumes.
  h.local.set(KEY,value);h.idb.set(KEY,value);await succeeds(h);h.c.scoutBoot();await tick();
  assert.equal(h.initCount,1);assert.deepEqual(clone(h.c.data.players),roster().players);
  assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);assert.deepEqual(h.toasts,[]);
  assert.equal(h.c.PSSaveState.get('team'),'idle');assert.equal(h.c.scoutReadOnlyLoad,false);
  assert.match(scout,/if\(scoutAutomaticWriteAllowed\(\)\)save\(\{skipTargets:true\}\)/,'actual init checks permission before its automatic save');
});

test('read-only legacy normalization keeps its in-memory display changes and preserves the original without writes',async()=>{
  const legacy=roster();legacy.meta.evalMode='team';legacy.attrs=[{id:'legacy',cat:'tech',name:'Old field'}];
  legacy.positions=[{id:'legacy-position',name:'GK'}];legacy.players[0].posId='legacy-position';const value=raw(legacy);
  const h=readOnlyScout(mountScout(harness({server:value,mirror:value,idb:value})));h.baseline(value);
  h.c.fifaAttrs=()=>[{id:'current',cat:'tech',name:'Current field'}];
  h.c.PS_EVAL_STD={id:'standard',isLegacyAttrs:()=>true,migrateLevels:()=>({current:3}),items:[{id:'additional',cat:'tech',name:'Added field'}]};
  h.c.scoutBoot();await tick();
  assert.equal(h.c.data.meta.evalMode,'fifa');assert.equal(h.c.data.players[0].posId,'pos_GK');
  assert.equal(h.c.data.players[0].levels.current,3);assert.ok(h.c.data.attrs.some(a=>a.id==='additional'));
  assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);assert.deepEqual(h.toasts,[]);
  assert.equal(h.c.PSSaveState.get('team'),'idle');assert.equal(h.c.scoutReadOnlyLoad,false);
});

test('read-only confirmed row projection updates the visible player without an automatic save',async()=>{
  const original=roster(),value=raw(original),h=readOnlyScout(mountScout(harness({server:value,mirror:value,idb:value})));h.baseline(value);h.c.scoutBoot();
  const updated={...original.players[0],memo:'new server note'},row='sq:'+updated.id;
  h.c.PSItems={active:()=>true,readAll:async()=>({rows:[row],players:[updated],held:{},confirmed:{[row]:true},tombs:{}})};
  vm.runInContext(section(scout,'function itemsPI(){','function itemsRerender(){'),h.c);
  assert.equal(await h.c.itemsApply('boot'),true);await tick();assert.equal(h.c.data.players[0].memo,'new server note');
  assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);assert.deepEqual(h.toasts,[]);assert.equal(h.c.PSSaveState.get('team'),'idle');
});

test('an actual user save after read-only initialization still returns failure and preserves the original',async()=>{
  const value=raw(roster()),h=readOnlyScout(mountScout(harness({server:value,mirror:value,idb:value})));h.baseline(value);h.c.scoutBoot();await tick();
  h.c.data.players[0].memo='attempted user change';assert.equal(h.c.save(),false);
  await assert.rejects(h.c.actualStore.ready());assert.equal(h.c.PSSaveState.get('team'),'failed');
  assert.equal(h.local.get(KEY),value);assert.equal(h.idb.get(KEY),value);
});
