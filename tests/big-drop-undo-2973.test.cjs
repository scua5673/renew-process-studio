'use strict';
// 2.973 — 크게 줄어든 팀 목록은 «올리고 되돌리기 바»(2.626)로 가야 한다. 기준본이 없는 키(일정·IDP 밖)는
// 서버가 안 바뀐 회차에 본문을 안 받아(2.599) 직전 판본이 없었고, 그래서 늘 보류 → 2.817 자동 재조정이
// 서버 옛 판으로 되돌렸다(보관함 폴더: 하위 폴더째 지우면 5→2 → 1.1초 뒤 원상복구).
// 실제 syncNowCore·pushHold·undoStash 가 VM 안에서 돈다. 저장소·HTTP 만 가짜다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const S=require('../studio/scouting-store.js');
const KEY='cs_vault_folders_v1',SCHEDULE='process_coach_v1',MATCH='cs_team_matches_v1',META='ps_sync_meta',OWNER='ps_cache_owner_v1';
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
  section(sync,'var UNDO_LIST=','function undoGet('),fn('rescueCount'),fn('psCountDeep'),fn('psDeepOf'),fn('psDeepOfKey'),fn('psCount'),
  fn('bigDrop'),fn('holdSetList'),fn('holdUnlist'),fn('holdClear'),fn('pushHold'),
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
    HOLD_LIST:'ps_hold_list_v1',HOLD_MAX:12,holdOpen(){},CustomEvent:function(){},dispatchEvent(){},OWNERKEY:OWNER,MKEY:META,MATCH_KEY:MATCH,SCHEDULE_KEY:SCHEDULE,KEYS:[KEY],PERSONAL:{},MERGE_KEYS:{},MERGE_LIST:{},
    ITEMS_ACTIVE:false,COPIES_OFF:true,PLAYER_BLIND:[],MAXLEN,SKIPKEY:'skip',TOMBKEY:'tomb',IDP_PRIV_PREFIX:'cs_idp_v1_',
    busy:false,busyDog:0,signOutEpoch:0,dataReady:true,localSwitchToken:'',kvWho:true,KV_PULL_CHUNK:20,
    getSess:()=>session,activeWs:()=>active,activeWsObj:()=>({kind:state.team?'team':'personal',role:state.teamRole}),isTeamWs:()=>state.team,
    workspaceSwitchGuardRead:()=>null,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>'',
    itemsWriteFlush:async()=>{},syncBasePrimeAll:async()=>{},syncBaseGet:k=>base.get(k)||null,syncBaseSet(k,v){if(v==null)base.delete(k);else base.set(k,v);},syncBaseReady:async()=>{},
    ensureToken:async()=>'synthetic',permsPrime:async()=>{},permsRaw:()=>state.role==='missing'?null:raw({defaultRole:state.role,members:{[session.uid]:{role:state.role,scopes:['board','scout']}}}),
    kvPreload:async()=>Object.fromEntries(idb),idbBacked:k=>k===KEY,
    scheduleHeld:()=>false,scheduleWriteAllowed:()=>true,scheduleStructureRepair(){},
    syncMaxLen:()=>MAXLEN,isItemKey:()=>false,isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,
    importApproved:()=>false,importApprovalGet:()=>null,importApprovalClear(){},
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
    baseline(value,cupd=1){const m=c.meta();m.h[KEY]=c.hash(value);m.c[KEY]=cupd;c.nSet(m,KEY,value);c.setMeta(m);},
    switch(uid='coach-b',wid='team-b',nonce='next'){session={uid};active=wid;local.set('ps_active_ws',wid);local.set(OWNER,raw({v:1,uid,wid,nonce}));},
  };
}
const pulled=h=>h.requests.filter(r=>r.stage==='kv_pull'&&decodeURIComponent(r.url).includes(KEY));
const pushed=h=>h.requests.filter(r=>r.stage.startsWith('kv_push')&&!r.stage.endsWith('_verify'));
const FIVE=['팀 공유','tactice','팀 공유/공격','팀 공유/공격/수비','팀 공유/공격/공격-수비'],TWO=['팀 공유','tactice'];
function setup(local){
  const before=raw(FIVE),h=harness({server:before,cupd:7,idb:local});h.baseline(before,7);return {h,before};
}
async function round(h){const r=await h.run();assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors}));return r;}
const undo=h=>JSON.parse(h.local.get('ps_undo_list_v1')||'[]');
const hold=h=>JSON.parse(h.local.get('ps_hold_list_v1')||'[]');

test('5→2 로 줄어든 목록은 서버 원문을 받아 올리고, 직전 팀 판본을 되돌리기 바에 남긴다(보류 아님)',async()=>{
  const {h,before}=setup(raw(TWO));await round(h);
  assert.equal(pulled(h).length,1,'큰 삭제가 있는 회차에는 본문을 받는다');
  assert.equal(pushed(h).length,1,'올린다');
  assert.equal(h.server.get(KEY).v,raw(TWO),'서버도 지운 채');
  assert.deepEqual(hold(h),[],'보류가 없어야 자동 재조정이 되돌리지 않는다');
  const u=undo(h);assert.equal(u.length,1);assert.equal(u[0].k,KEY);assert.equal(u[0].before,5);assert.equal(u[0].after,2);
  assert.equal(h.idb.get('ps_undo_'+KEY),before,'되돌리기 판본 = 직전 팀 원문');
});

test('사람이 확인한 그 값(승인 토큰)이면 되돌리기 바 없이 올린다',async()=>{
  const {h}=setup(raw(TWO));h.local.set('ps_push_ok_'+KEY,h.c.hash(raw(TWO)));await round(h);
  assert.equal(h.server.get(KEY).v,raw(TWO));assert.deepEqual(undo(h),[]);assert.deepEqual(hold(h),[]);
});

test('0 으로 비는 것은 예전대로 보류한다(2.626 예외)',async()=>{
  const {h,before}=setup(raw([]));await round(h);
  assert.equal(pushed(h).length,0,'빈 목록은 올리지 않는다');assert.equal(h.server.get(KEY).v,before);
  assert.deepEqual(hold(h).map(x=>x.k),[KEY]);assert.deepEqual(undo(h),[]);
});

test('조금 줄었거나(5→4) 그대로면 본문을 받지 않는다 — 이그레스 그대로',async()=>{
  for(const local of [raw(FIVE.slice(0,4)),raw(FIVE)]){
    const {h}=setup(local);await round(h);
    assert.equal(pulled(h).length,0,'본문 요청 없음 '+local);
  }
  const {h}=setup(raw(FIVE.slice(0,4)));await round(h);
  assert.equal(h.server.get(KEY).v,raw(FIVE.slice(0,4)),'작은 삭제는 원래대로 올라간다');assert.deepEqual(undo(h),[]);
});
