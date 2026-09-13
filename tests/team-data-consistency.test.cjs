'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const S=require('../studio/scouting-store.js');
const DEFAULT_KEY='cs_team_match_private_v1',SCHEDULE='process_coach_v1',MATCH='cs_team_matches_v1',META='ps_sync_meta',OWNER='ps_cache_owner_v1';
const MAXLEN=1500000;
const clone=x=>JSON.parse(JSON.stringify(x));
const raw=x=>JSON.stringify(x);
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
function fn(name){return section(sync,'function '+name+'(','\nfunction ');}
const code=[
  sync.match(/^var BLOB_KEYS=.*$/m)[0],
  fn('cacheOwner'),fn('dataUnlocked'),
  section(sync,'var matchReadyPending=','/* 이 키가 지금 몇 항목인지'),
  fn('isIdpPrivateKey'),fn('isIdpPubKey'),
  section(sync,'function idpJson(','var MERGE_NOTE='),
  fn('outboxOwner'),fn('outboxScope'),fn('outboxMark'),fn('outboxMarkForOwner'),fn('currentValueForKey'),fn('outboxMarkRows'),fn('outboxAckSynced'),
  fn('holdList'),fn('holdSetList'),fn('holdUnlist'),fn('holdClear'),
  section(sync,'function holdConflictContext(','/* 올리기 직전 검사.'),
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

// Actual syncNowCore, IDP merge, outbox ACK, kvWrite and kvPushRows run in a VM. Only storage,
// HTTP and unrelated channels are mocked. PATCH checks the URL cupd, and missing
// row POST honors ignore-duplicates; a CAS miss must never alter the server map.
function harness(opt={}){
  const KEY=opt.key||DEFAULT_KEY;
  let queue=[];const pending=()=>queue.filter(x=>x.uid===session.uid&&x.wid===active).length;
  const local=new Map(),idb=new Map(),server=opt.sharedServer||new Map(),base=new Map(),requests=[],errors=[],acks=[],hooks={},notices=[];
  let session={uid:opt.uid||'coach-a'},active=opt.wid||'team-a';
  const state={role:opt.role||'executive',teamRole:opt.teamRole||'owner',team:opt.team!==false};
  local.set(OWNER,raw({v:1,uid:session.uid,wid:active,nonce:'first'}));local.set('ps_active_ws',active);
  if(!opt.sharedServer&&opt.server!==null)server.set(KEY,{workspace_id:active,k:KEY,v:opt.server===undefined?raw({v:1,entries:{}}):opt.server,cupd:opt.cupd||1});
  if(opt.mirror!=null)local.set(KEY,opt.mirror);if(opt.idb!=null)idb.set(KEY,opt.idb);
  local.set(META,raw({h:{},c:{},n:{},r:{},last:0}));
  local.set('cs_perms_v1',raw({defaultRole:state.role,members:{[session.uid]:{role:state.role,scopes:opt.scopes||['team']}}}));
  const c=vm.createContext({
    Promise,console:{warn(){}},Date,navigator:{onLine:true},setTimeout:()=>0,clearTimeout(){},
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},location:{origin:'https://synthetic.test'},
    localStorage:{getItem(k){if(hooks.localRead)hooks.localRead(k);return local.has(k)?local.get(k):null;},setItem(k,v){if(hooks.localWrite)hooks.localWrite(k,String(v));local.set(k,String(v));},removeItem:k=>local.delete(k),key:i=>[...local.keys()][i]||null,get length(){return local.size;}},
    storage:{async get(k){if(hooks.idbRead)await hooks.idbRead(k);return idb.has(k)?{value:idb.get(k)}:null;},async set(k,v){if(hooks.idbWrite)await hooks.idbWrite(k,v);idb.set(k,v);},
      async replaceIfValue(k,old,value){if(hooks.idbWrite)await hooks.idbWrite(k,value);if(hooks.idbReplace)await hooks.idbReplace(k,old,value);if((idb.has(k)?idb.get(k):null)!==old)return false;if(value==null)idb.delete(k);else idb.set(k,value);return true;}},
    PSStorage:{async sharedReady(k){if(hooks.sharedReady)await hooks.sharedReady(k);}},editMirrorCommit:Promise.resolve(),PSScoutStore:S,
    OWNERKEY:OWNER,MKEY:META,MATCH_KEY:MATCH,SCHEDULE_KEY:SCHEDULE,KEYS:opt.dynamic?[]:[KEY],PERSONAL:{},MERGE_KEYS:{[SCHEDULE]:1},MERGE_LIST:{},
    ITEMS_ACTIVE:false,COPIES_OFF:true,PLAYER_BLIND:[],HOLD_LIST:'ps_hold_list_v1',HOLD_MAX:12,MAXLEN,SKIPKEY:'skip',TOMBKEY:'tomb',IDP_PRIV_PREFIX:'cs_idp_v1_',IDP_PUB_PREFIX:'cs_idp_pub_v1_',rosterSyncMark:null,
    busy:false,busyDog:0,signOutEpoch:0,dataReady:true,localSwitchToken:'',kvWho:true,KV_PULL_CHUNK:20,
    getSess:()=>session,activeWs:()=>active,activeWsObj:()=>({kind:state.team?'team':'personal',role:state.teamRole}),isTeamWs:()=>state.team,
    workspaceSwitchGuardRead:()=>null,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>'',
    itemsWriteFlush:async()=>{},syncBasePrimeAll:async()=>{},syncBaseGet:k=>base.get(k)||null,syncBaseSet(k,v){if(v==null)base.delete(k);else base.set(k,v);},syncBaseReady:async()=>{},
    ensureToken:async()=>'synthetic',permsPrime:async()=>{},permsRaw:()=>state.role==='missing'?null:raw({defaultRole:state.role,members:{[session.uid]:{role:state.role,scopes:opt.scopes||['team']}}}),
    kvPreload:async()=>Object.fromEntries(idb),idbBacked:k=>k===KEY&&!opt.localOnly,
    scheduleHeld:()=>false,scheduleWriteAllowed:()=>true,scheduleStructureRepair(){},
    syncMaxLen:()=>MAXLEN,psCount:v=>{try{return JSON.parse(v).players.length;}catch{return 0;}},isItemKey:()=>false,
    importApproved:()=>false,importApprovalGet:()=>null,importApprovalClear(){},pushHold:()=>!!opt.hold,
    rescueStash(){},rescuePrepared:()=>true,conflictNote(){},syncDiagnostic:(stage,e)=>errors.push({stage,message:String(e),code:e.psCode}),
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
    async outboxTxn(change){if(hooks.outbox)await hooks.outbox();queue=await change(clone(queue));return clone(queue);},outboxFail:async()=>{},
    pendingInfo:()=>({count:pending()}),visiblePendingInfo:()=>({count:pending()}),skippedList:()=>[],personalReviewList:()=>[],
    itemsResolveConflicts:async()=>{},itemsLostFlush(){},syncLibrary:async()=>({}),syncPersonal:async()=>0,
    syncIdpBaseSet:async(k,v)=>base.set(k,v),syncIdpBaseCompact:async()=>{},syncBaseHas:k=>base.has(k),
    setStatus:t=>notices.push(t),renderUI(){},onApplied(){},rtConnect(){},clearSyncRetry(){},
    rejectedMatchRetry:()=>null,classifySyncError:e=>({code:e.psCode||'sync_unexpected',stage:e.psStage||'test'}),syncReasonText:x=>x,scheduleSyncRetry(){},
    usagePing(){},whoRemember(){},namesRefresh(){},pushLog(){},pruneConflictCopies(){},staffEditNotice(){},cacheWaitEnd(){},chip(){},keyLabel:k=>k,
    PSPerms:{role:()=>state.role,canEdit:()=>state.role==='admin'||state.role==='executive'},
    personalWid:()=>'',writeVersion(){},scheduleTokenValid:()=>true,
  });
  c.window=c;c.parent={postMessage(){}};vm.runInContext(code,c,{filename:'actual team data consistency contract'});
  return {c,local,idb,server,base,requests,errors,acks,hooks,notices,state,
    get queue(){return clone(queue);},mark:()=>c.outboxMark(active,KEY,c.hash(opt.localOnly?local.get(KEY):idb.get(KEY)),'fixture'),
    run:()=>c.syncNowCore('test'),ready:()=>c.keyReady(KEY,active),
    baseline(value,cupd=1){const m=c.meta();m.h[KEY]=c.hash(value);m.c[KEY]=cupd;c.setMeta(m);base.set(KEY,value);},
    switch(uid='coach-b',wid='team-b',nonce='next'){session={uid};active=wid;local.set('ps_active_ws',wid);local.set(OWNER,raw({v:1,uid,wid,nonce}));},
  };
}

const pushed=h=>h.requests.filter(r=>r.stage.startsWith('kv_push')&&!r.stage.endsWith('_verify'));
const privateBase=raw({v:1,entries:{'match-a':{good:'base A'},'match-b':{good:'base B'}}});
const changed=(base,id,text)=>{const d=JSON.parse(base);d.entries[id].good=text;return raw(d);};
async function succeeds(h){const r=await h.run();assert.equal(r.error,undefined,JSON.stringify({result:r,errors:h.errors}));return r;}

test('team write loses a server race without overwriting the other coach or confirming local data',async()=>{
  const local=changed(privateBase,'match-b','coach B review'),other=changed(privateBase,'match-a','coach A review');
  const h=harness({server:privateBase,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  h.hooks.fetch=(stage)=>{if(stage.startsWith('kv_push')&&!stage.endsWith('_verify'))h.server.set(DEFAULT_KEY,{workspace_id:'team-a',k:DEFAULT_KEY,v:other,cupd:2});};
  await h.run();assert.equal(h.server.get(DEFAULT_KEY).v,other);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.queue.length,1);assert.equal(h.c.meta().h[DEFAULT_KEY],h.c.hash(privateBase));
});

test('an HTTP 403 on a team record leaves local edits pending and last-confirmed metadata unchanged',async()=>{
  const local=changed(privateBase,'match-b','unsent review');const h=harness({server:privateBase,mirror:local,idb:local,deny:true});h.baseline(privateBase);await h.mark();
  const r=await h.run();assert.equal(h.server.get(DEFAULT_KEY).v,privateBase);assert.equal(h.queue.length,1);assert.equal(h.c.meta().h[DEFAULT_KEY],h.c.hash(privateBase));assert.ok(r.error||r.pending||r.held?.length||r.deferred?.length);assert.doesNotMatch(h.notices.at(-1),/^팀과 같아요/);
});

test('client permission denial does not confirm an unsent team record',async()=>{
  const local=changed(privateBase,'match-b','unsent review');const h=harness({server:privateBase,mirror:local,idb:local,role:'staff',teamRole:'member',scopes:[]});h.baseline(privateBase);await h.mark();
  await h.run();assert.equal(pushed(h).length,0);assert.equal(h.server.get(DEFAULT_KEY).v,privateBase);assert.equal(h.queue.length,1);assert.equal(h.c.meta().h[DEFAULT_KEY],h.c.hash(privateBase));
});

test('two known divergent coach edits keep the local review available for an explicit decision',async()=>{
  const local=changed(privateBase,'match-b','coach B review'),other=changed(privateBase,'match-a','coach A review');const h=harness({server:other,cupd:2,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  await h.run();assert.equal(h.server.get(DEFAULT_KEY).v,other);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.idb.get(DEFAULT_KEY),local);assert.equal(h.queue.length,1);assert.equal(h.c.meta().h[DEFAULT_KEY],h.c.hash(privateBase));
});

test('ordinary successful team edits use version-constrained PATCH and acknowledge the exact local value',async()=>{
  const local=changed(privateBase,'match-b','coach review');const h=harness({server:privateBase,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  await succeeds(h);assert.equal(h.server.get(DEFAULT_KEY).v,local);assert.equal(h.queue.length,0);assert.equal(pushed(h)[0].options.method,'PATCH');assert.match(pushed(h)[0].url,/cupd=eq\.1/);
});

test('new team records use insert-only writes so a racing create is preserved',async()=>{
  const local=changed(privateBase,'match-b','coach B review'),other=changed(privateBase,'match-a','coach A review');const h=harness({server:null,mirror:local,idb:local});await h.mark();
  h.hooks.fetch=stage=>{if(stage.startsWith('kv_push'))h.server.set(DEFAULT_KEY,{workspace_id:'team-a',k:DEFAULT_KEY,v:other,cupd:2});};
  await h.run();assert.equal(h.server.get(DEFAULT_KEY).v,other);assert.equal(h.queue.length,1);assert.match(pushed(h)[0].options.headers.Prefer,/ignore-duplicates/);
});

function conflicting(){
  const local=changed(privateBase,'match-b','coach B review'),other=changed(privateBase,'match-a','coach A review');
  const h=harness({server:other,cupd:2,mirror:local,idb:local});h.baseline(privateBase);return {h,local,other};
}
function shown(h){return h.c.holdConflictView(h.c.holdList()[0]);}

for(const mine of [true,false])test(`explicit ${mine?'local':'server'} team choice is applied only after rechecking the exact pair`,async()=>{
  const {h,local,other}=conflicting();await h.mark();await succeeds(h);assert.equal(h.c.holdList().length,1);
  const rec=shown(h);assert.equal(h.local.get('ps_hold_list_v1').includes('coach B review'),false,'review metadata does not duplicate private bodies');
  assert.equal((await h.c.holdConflictChoose(DEFAULT_KEY,mine,rec)).pending,true);assert.equal(h.server.get(DEFAULT_KEY).v,other);assert.equal(h.local.get(DEFAULT_KEY),local);
  await succeeds(h);const expected=mine?local:other;assert.equal(h.server.get(DEFAULT_KEY).v,expected);assert.equal(h.local.get(DEFAULT_KEY),expected);assert.equal(h.idb.get(DEFAULT_KEY),expected);assert.equal(h.queue.length,0);assert.equal(h.c.holdList().length,0);
});

for(const mine of [true,false])test(`new remote version cancels a prior ${mine?'local':'server'} team choice`,async()=>{
  const {h,local}=conflicting();await h.mark();await succeeds(h);await h.c.holdConflictChoose(DEFAULT_KEY,mine,shown(h));
  const newer=changed(privateBase,'match-a','coach A later review');h.server.set(DEFAULT_KEY,{workspace_id:'team-a',k:DEFAULT_KEY,v:newer,cupd:3});
  await succeeds(h);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.server.get(DEFAULT_KEY).v,newer);assert.equal(h.queue.length,1);assert.equal(h.c.holdList()[0].choice,undefined);
});

test('new local input invalidates an open team decision instead of authorizing that newer input',async()=>{
  const {h}=conflicting();await succeeds(h);const old=shown(h),later=changed(privateBase,'match-b','later local draft');h.local.set(DEFAULT_KEY,later);h.idb.set(DEFAULT_KEY,later);
  assert.equal(await h.c.holdConflictChoose(DEFAULT_KEY,true,old),false);await succeeds(h);assert.equal(h.local.get(DEFAULT_KEY),later);assert.equal(h.c.holdList()[0].choice,undefined);
});

for(const change of ['account','team','generation'])test(`a team decision opened before ${change} change cannot be used afterward`,async()=>{
  const {h}=conflicting();await succeeds(h);const old=shown(h);
  h.switch(change==='account'?'coach-b':'coach-a',change==='team'?'team-b':'team-a','changed');
  assert.equal(await h.c.holdConflictChoose(DEFAULT_KEY,true,old),false);
});

test('a server-choice local write failure keeps the unsent original and choice pending',async()=>{
  const {h,local}=conflicting();await h.mark();await succeeds(h);await h.c.holdConflictChoose(DEFAULT_KEY,false,shown(h));
  h.hooks.idbWrite=()=>{throw Error('synthetic disk failure');};const result=await h.run();
  assert.ok(result.error);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.idb.get(DEFAULT_KEY),local);assert.equal(h.c.holdList().length,1);assert.equal(h.queue.length,1);
});

test('offline reconnect preserves a competing review instead of treating the server document as a restore',async()=>{
  const {h,local,other}=conflicting();await h.mark();h.c.navigator.onLine=false;
  assert.equal((await h.run()).offline,1);assert.equal(h.requests.length,0);assert.equal(h.queue.length,1);
  h.c.navigator.onLine=true;await succeeds(h);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.server.get(DEFAULT_KEY).v,other);assert.equal(h.queue.length,1);assert.equal(h.c.holdList()[0].kind,'conflict');
});

test('a lost success response is recovered from the same server body without another write',async()=>{
  const local=changed(privateBase,'match-b','saved but response lost');const h=harness({server:local,cupd:2,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  await succeeds(h);assert.equal(pushed(h).length,0);assert.equal(h.queue.length,0);assert.equal(h.c.meta().c[DEFAULT_KEY],2);assert.equal(h.c.holdList().length,0);
});

test('a stale clock still produces a strictly newer server version and records that version',async()=>{
  const local=changed(privateBase,'match-b','same millisecond edit');const h=harness({server:privateBase,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  h.c.Date=class extends Date{static now(){return 1;}};await succeeds(h);
  assert.equal(h.server.get(DEFAULT_KEY).cupd,2);assert.equal(h.c.meta().c[DEFAULT_KEY],2);assert.equal(h.queue.length,0);
});

test('owner change during outbox value verification cannot clear the previous owner pending item',async()=>{
  const local=changed(privateBase,'match-b','old owner edit');const h=harness({server:privateBase,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  h.hooks.idbRead=()=>h.switch();const result=await h.run();
  assert.equal(result.code,'sync_workspace_changed');assert.equal(h.queue.length,1);assert.equal(h.queue[0].uid,'coach-a');assert.equal(h.c.rosterSyncMark,null);
});

test('same-field concurrent edits remain separate until the coach chooses a whole document',async()=>{
  const local=changed(privateBase,'match-a','coach B same field'),other=changed(privateBase,'match-a','coach A same field');const h=harness({server:other,cupd:2,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  await succeeds(h);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.server.get(DEFAULT_KEY).v,other);assert.equal(h.c.holdList().length,1);assert.equal(h.queue.length,1);
});

test('partial multi-key acceptance never confirms the denied key and can resume afterward',async()=>{
  const key2='cs_team_notice_v1',local=changed(privateBase,'match-b','edited'),opt={server:privateBase,mirror:local,idb:local};const h=harness(opt);h.baseline(privateBase);await h.mark();
  h.c.KEYS.push(key2);h.server.set(key2,{workspace_id:'team-a',k:key2,v:'old notice',cupd:1});h.local.set(key2,'new notice');
  const m=h.c.meta();m.h[key2]=h.c.hash('old notice');m.c[key2]=1;h.c.setMeta(m);await h.c.outboxMark('team-a',key2,h.c.hash('new notice'),'fixture');
  let calls=0;h.hooks.fetch=stage=>{if(stage==='kv_push_cas'&&++calls===2)opt.deny=true;};
  assert.ok((await h.run()).error);assert.equal(h.server.get(DEFAULT_KEY).v,local);assert.equal(h.server.get(key2).v,'old notice');assert.equal(h.queue.length,2);assert.equal(h.c.meta().h[key2],h.c.hash('old notice'));
  opt.deny=false;delete h.hooks.fetch;await succeeds(h);assert.equal(h.server.get(key2).v,'new notice');assert.equal(h.queue.length,0);
});

test('different matches in the shared match document are preserved separately after competing edits',async()=>{
  const base=raw({v:1,matches:[{id:'fixture-match-a',date:'2026-09-13',review:{summary:'base A'}},{id:'fixture-match-b',date:'2026-09-14',review:{summary:'base B'}}]});
  const a=JSON.parse(base),b=JSON.parse(base);a.matches[0].review.summary='coach A review';b.matches[1].review.summary='coach B review';
  const h=harness({key:MATCH,server:raw(a),cupd:2,mirror:raw(b),idb:raw(b)});h.baseline(base);await h.mark();
  await succeeds(h);assert.equal(h.local.get(MATCH),raw(b));assert.equal(h.server.get(MATCH).v,raw(a));assert.equal(h.queue.length,1);assert.equal(h.c.holdList()[0].k,MATCH);assert.equal(h.ready(),false);
});

for(const options of [{rejectAck:true},{casZero:true}])test(`a 2xx response without matching server confirmation stays pending: ${Object.keys(options)[0]}`,async()=>{
  const local=changed(privateBase,'match-b','unconfirmed draft'),h=harness({server:privateBase,mirror:local,idb:local,...options});h.baseline(privateBase);await h.mark();
  const result=await h.run();assert.ok(result.error);assert.equal(h.server.get(DEFAULT_KEY).v,privateBase);assert.equal(h.local.get(DEFAULT_KEY),local);assert.equal(h.c.meta().h[DEFAULT_KEY],h.c.hash(privateBase));assert.equal(h.queue.length,1);
});

test('real data-review UI identifies both versions and the whole-document replacement scope',async()=>{
  const {h}=conflicting();await succeeds(h);const modals=[];
  Object.assign(h.c,{esc:String,keyLabel:k=>k,psModal:opts=>{modals.push(opts);return {close(){}};},HIST_KEYS:[],holdLocal:async k=>h.local.get(k),rescueList:()=>[],conflictList:()=>[]});
  vm.runInContext([fn('dataReviewList'),fn('dataReviewApply'),fn('dataReviewOpen')].join('\n'),h.c);h.c.dataReviewOpen();
  const body=modals.at(-1).body;assert.match(body,/이 기기 확인/);assert.match(body,/서버 판본/);assert.match(body,/문서 전체/);assert.match(body,/다른 경기·선수/);assert.match(body,/이 기기 <b>.*개<\/b> · 팀/);
});

test('owner change during pending-queue preparation cannot attribute old content to the new account',async()=>{
  const local=changed(privateBase,'match-b','old coach draft'),h=harness({server:privateBase,mirror:local,idb:local});h.baseline(privateBase);await h.mark();
  h.hooks.outbox=()=>h.switch();const result=await h.run();
  assert.equal(result.code,'sync_workspace_changed');assert.equal(pushed(h).length,0);assert.equal(h.queue.length,1);assert.equal(h.queue[0].uid,'coach-a');assert.equal(h.queue[0].wid,'team-a');
});
