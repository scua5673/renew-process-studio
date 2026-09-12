'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the shipped planner, personal sync, HTTP CAS, local CAS, metadata and
// outbox ACK functions. Only browser storage, auth, and server I/O are simulated.
// No browser account, external network, or third-party package is used.
const source = fs.readFileSync(path.join(__dirname, '../studio/sync.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Can extract ${start}`);
  return source.slice(a, b);
}
function fn(name) { return section(`function ${name}(`, '\nfunction '); }
const code = [
  fn('hash'),
  section('function meta()', 'function keyReady('),
  fn('syncIssue'), fn('syncHttpError'),
  fn('currentValueForKey'), fn('outboxMarkForOwner'),
  section('function outboxAckPersonal(', '/* 워크스페이스를 바꿀 때'),
  section('function kvPushRows(', '/* ── 1.568 안전장치'),
  section('function kvWrite(', 'function libLoad('),
  section('function personalWid()', '/* 1.504 — 충돌 사본 청소'),
  fn('visiblePendingInfo'), fn('syncCodeText'), fn('syncReasonText'), fn('syncState'),
  fn('dataReviewList'), fn('dataReviewApply'), fn('dataReviewOpen'),
].join('\n');
const copy = value => JSON.parse(JSON.stringify(value));
const K = 'cs_notes_v1';
const K2 = 'cs_note_papers_v1';
const LOCAL_ONLY = 'cs_analysis_role_v1';
const META = 'ps_sync_meta';
const REVIEW = 'ps_personal_review_v1';
const response = (rows, status = 200) => ({ok:status >= 200 && status < 300,status,json:async()=>copy(rows),text:async()=>JSON.stringify(rows)});

function harness(options = {}) {
  const team = options.team !== false;
  const keys = options.keys || [K];
  let session = {uid:'coach-a'}, active = team ? 'team-a' : 'personal-a', switchSeal = '', switchEpoch='';
  let unlocked = true, queue = [], queueTail = Promise.resolve();
  const local = new Map(), idb = new Map(), server = options.sharedServer || new Map(), requests = [], failures = [], modals = [], hooks = {};
  local.set('ps_cache_owner_v1', 'owner-a');
  for (const k of keys) {
    const raw = options.local === undefined ? 'PHONE_EDIT' : options.local;
    if (raw !== null) (k === LOCAL_ONLY ? local : idb).set(k, raw);
    if (!options.sharedServer && options.server !== null) server.set(k, {workspace_id:'personal-a',k,v:options.server === undefined?'BASE':options.server,cupd:options.cupd === undefined?1:options.cupd});
  }
  const ctx = vm.createContext({
    Promise, console, setTimeout, clearTimeout, isFinite,
    CustomEvent:class {constructor(type, options) {this.type=type;this.detail=options&&options.detail;}},
    navigator:{onLine:true},
    document:{querySelectorAll:()=>[],getElementById:()=>null},
    dispatchEvent(){},
    localStorage:{
      getItem(k){return local.has(k)?local.get(k):null;},
      setItem(k,v){if(hooks.localWrite)hooks.localWrite(k,v);local.set(k,String(v));},
      removeItem(k){local.delete(k);},
    },
    storage:{
      async get(k){if(hooks.localRead)await hooks.localRead(k);return idb.has(k)?{value:idb.get(k)}:null;},
      async set(k,v){idb.set(k,v);return true;},
      async replaceIfValue(k,expected,replacement){
        if(hooks.localReplace)await hooks.localReplace(k,expected,replacement);
        const before=idb.has(k)?idb.get(k):null;
        if(before!==expected)return false;
        if(replacement==null)idb.delete(k);else idb.set(k,replacement);
        if(hooks.afterLocalReplace)await hooks.afterLocalReplace(k,replacement);
        return true;
      },
      async delIfValue(k,value){if(idb.get(k)===value)idb.delete(k);},
    },
    getSess:()=>session,activeWs:()=>active,dataUnlocked:()=>unlocked,
    isTeamWs:()=>active.startsWith('team'),
    wsList:()=>options.workspaces||[{id:'personal-a',kind:'personal',owner_id:'coach-a'},{id:'team-a',kind:'team'}],
    workspaceSwitchGuardRaw:()=>switchSeal,workspaceSwitchEpochRaw:()=>switchEpoch,
    signOutEpoch:0,OWNERKEY:'ps_cache_owner_v1',MKEY:META,matchReadyPending:false,
    MATCH_KEY:'cs_team_matches_v1',SCHEDULE_KEY:'process_coach_v1',
    KEYS:keys,PERSONAL:Object.fromEntries(keys.map(k=>[k,1])),MAXLEN:1500000,
    idbBacked:k=>k!==LOCAL_ONLY,
    isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,
    outboxOwner:()=>session.uid,outboxScope:(uid,wid)=>`${uid}|${wid}`,
    async outboxTxn(change){
      queueTail=queueTail.catch(()=>{}).then(async()=>{
        const next=await change(copy(queue));
        if(hooks.outboxCommit)await hooks.outboxCommit();
        queue=copy(next);return copy(queue);
      });
      return queueTail;
    },
    pendingInfo(wid){const found=queue.filter(x=>x.uid===session.uid&&x.wid===wid);return {count:found.length,oldest:found.length?found[0].at:0};},
    async outboxFail(wid,info){failures.push({wid,...info});},
    syncDiagnostic(){},classifySyncError:e=>({code:e.psCode||'sync_network',stage:e.psStage||'test'}),
    importApproved:()=>false,importApprovalClear(){},holdClear(){},rescueStash(){},
    BASE:'https://test.invalid',hj:()=>({}),prefBuild:x=>x,KV_PUSH_BYTES:1000000,KV_PUSH_ROWS:15,
    async blobPrepRows(_token,rows){if(hooks.prepare)await hooks.prepare(rows);},
    kvInFilter:ks=>'k=in.('+ks.join(',')+')',
    async syncFetch(stage,url,opts){
      const u=new URL(url), method=opts.method||'GET';
      requests.push({stage,url,method,body:opts.body?JSON.parse(opts.body):null,headers:opts.headers});
      if(method==='GET'){
        const full=u.searchParams.get('select').includes('v');
        const filter=u.searchParams.get('k');
        const selected=filter&&filter.startsWith('in.(')?filter.slice(4,-1).split(','):keys;
        const rows=selected.flatMap(k=>server.has(k)?[copy(server.get(k))]:[]);
        const result=full?rows:rows.map(({k,cupd})=>({k,cupd}));
        if(hooks.readResponse)await hooks.readResponse(stage,result);
        return response(result);
      }
      if(hooks.beforeServerWrite)await hooks.beforeServerWrite(stage,opts);
      if(hooks.writeStatus)return response([],hooks.writeStatus);
      const body=JSON.parse(opts.body);
      let result=[];
      if(method==='PATCH'){
        const k=u.searchParams.get('k').slice(3), expected=u.searchParams.get('cupd').slice(3), before=server.get(k);
        if(before&&String(before.cupd)===expected){const saved={...before,...body};server.set(k,saved);result=[{workspace_id:saved.workspace_id,k,cupd:saved.cupd}];}
      }else{
        assert.equal(method,'POST');
        assert.match(opts.headers.Prefer,/resolution=ignore-duplicates/, 'all creates must reject existing rows');
        assert.equal(Array.isArray(body),false,'personal updates must never use unconditional bulk upsert');
        if(!server.has(body.k)){server.set(body.k,copy(body));result=[{workspace_id:body.workspace_id,k:body.k,cupd:body.cupd}];}
      }
      if(hooks.afterServerWrite)await hooks.afterServerWrite(result);
      return response(result);
    },
    holdList:()=>[],rescueList:()=>[],conflictList:()=>[],COPIES_OFF:true,
    busy:false,lastIssue:null,agoText:()=>'',rtConnected:()=>false,rtLast:0,rtHits:0,
    keyLabel:k=>k===K?'노트':k,esc:x=>String(x),psModal:opts=>{modals.push(opts);return {close(){}};},
    renderUI(){},renderDataLock(){},syncNow:async()=>{},itemsHoldList:()=>[],HIST_KEYS:[],ITEMS_ACTIVE:false,
  });
  ctx.window=ctx;
  vm.runInContext(code,ctx);
  const h={},c={};
  for(const k of keys){h[k]=ctx.hash(options.base===undefined?'BASE':options.base);c[k]=options.baseCupd===undefined?1:options.baseCupd;}
  local.set(META,JSON.stringify(team?{h:{teamKey:'keep'},c:{teamKey:9},p:{h,c},n:{},r:{},last:10}:{h,c,n:{},r:{},last:10}));
  return {
    c:ctx,local,idb,server,requests,failures,modals,hooks,
    get queue(){return copy(queue);},
    addPending(k=K,raw=options.local===undefined?'PHONE_EDIT':options.local){queue.push({id:`coach-a|personal-a|${k}`,uid:'coach-a',wid:'personal-a',key:k,hash:ctx.hash(raw),at:1});},
    channel(){const m=JSON.parse(local.get(META));return team?m.p:m;},
    reviews(){return ctx.personalReviewList();},
    writeLocal(k,raw){(k===LOCAL_ONLY?local:idb).set(k,raw);},
    setSession(value){session=value;},setActive(value){active=value;},setSwitch(value){switchSeal=value;},setSwitchEpoch(value){switchEpoch=value;},lock(){unlocked=false;},
    run(){return Promise.resolve().then(()=>ctx.syncPersonal('not-a-real-token',()=>true));},
  };
}

for(const team of [true,false]) {
  const where=team?'while viewing a team':'in the personal workspace';
  test(`dirty existing personal data uses version-constrained PATCH ${where}`,async()=>{
    const h=harness({team});h.addPending();await h.run();
    const writes=h.requests.filter(r=>r.method!=='GET');
    assert.equal(writes.length,1);assert.equal(writes[0].method,'PATCH');assert.match(writes[0].url,/cupd=eq\.1/);
    assert.equal(h.server.get(K).v,'PHONE_EDIT');assert.equal(h.channel().h[K],h.c.hash('PHONE_EDIT'));assert.equal(h.queue.length,0);
    if(team)assert.equal(JSON.parse(h.local.get(META)).h.teamKey,'keep');
  });
  test(`already changed server and local are preserved for explicit choice ${where}`,async()=>{
    const h=harness({team,server:'PC_EDIT',cupd:2});const before=copy(h.channel());await h.run();
    assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);
    assert.equal(h.idb.get(K),'PHONE_EDIT');assert.equal(h.server.get(K).v,'PC_EDIT');assert.deepEqual(h.channel(),before);
    assert.equal(h.reviews().length,1);assert.equal(h.queue.length,1);
    assert.equal(h.c.syncState().kind,'ask');assert.equal(h.c.syncState().n,1);
    assert.equal(h.local.get(REVIEW).includes('PHONE_EDIT'),false);assert.equal(h.local.get(REVIEW).includes('PC_EDIT'),false);
  });
}

test('new personal row uses ignore-duplicates and a racing create cannot overwrite the other device',async()=>{
  const h=harness({server:null,base:null,baseCupd:0});const before=copy(h.channel());
  h.hooks.prepare=()=>h.server.set(K,{workspace_id:'personal-a',k:K,v:'OTHER_DEVICE',cupd:2});
  await assert.rejects(h.run(),e=>e.psCode==='sync_conflict');
  assert.equal(h.server.get(K).v,'OTHER_DEVICE');assert.equal(h.idb.get(K),'PHONE_EDIT');assert.deepEqual(h.channel(),before);assert.equal(h.queue.length,1);
  delete h.hooks.prepare;await h.run();assert.equal(h.reviews().length,1);
});

test('a server edit after reading metadata fails CAS and retains the pending local version',async()=>{
  const h=harness();const before=copy(h.channel());
  h.hooks.prepare=()=>h.server.set(K,{workspace_id:'personal-a',k:K,v:'LATER_PC_EDIT',cupd:2});
  await assert.rejects(h.run(),e=>e.psCode==='sync_conflict');
  assert.equal(h.server.get(K).v,'LATER_PC_EDIT');assert.deepEqual(h.channel(),before);assert.equal(h.queue.length,1);
  assert.equal(h.c.syncState().kind,'bad');assert.match(h.c.syncState().text,/개인 자료/);
});

for(const keepMine of [true,false]) {
  test(`explicit ${keepMine?'local':'server'} choice applies only its reviewed pair and clears after confirmation`,async()=>{
    const h=harness({server:'PC_EDIT',cupd:2});await h.run();
    const shown=h.reviews()[0];const selected=await h.c.dataReviewApply('personal',K,keepMine,shown);
    assert.equal(selected.pending,true);assert.equal(h.idb.get(K),'PHONE_EDIT');assert.equal(h.server.get(K).v,'PC_EDIT');
    await h.run();
    const expected=keepMine?'PHONE_EDIT':'PC_EDIT';assert.equal(h.idb.get(K),expected);assert.equal(h.server.get(K).v,expected);
    assert.equal(h.reviews().length,0);assert.equal(h.queue.length,0);assert.equal(h.channel().h[K],h.c.hash(expected));
  });
  test(`new server content invalidates a previously chosen ${keepMine?'local':'server'} version`,async()=>{
    const h=harness({server:'PC_EDIT',cupd:2});await h.run();await h.c.personalReviewChoose(K,keepMine,h.reviews()[0]);
    h.server.set(K,{workspace_id:'personal-a',k:K,v:'PC_EDIT_LATER',cupd:3});await h.run();
    assert.equal(h.server.get(K).v,'PC_EDIT_LATER');assert.equal(h.idb.get(K),'PHONE_EDIT');assert.equal(h.reviews()[0].choice,undefined);assert.equal(h.queue.length,1);
  });
}

test('a stale dialog cannot authorize a newer local edit',async()=>{
  const h=harness({server:'PC_EDIT',cupd:2});await h.run();const shown=h.reviews()[0];h.writeLocal(K,'PHONE_EDIT_LATER');
  assert.equal(await h.c.personalReviewChoose(K,true,shown),false);
  await h.run();assert.equal(h.idb.get(K),'PHONE_EDIT_LATER');assert.equal(h.server.get(K).v,'PC_EDIT');assert.equal(h.reviews()[0].choice,undefined);
});

test('CAS loss after a local choice preserves the choice until the next server version is read',async()=>{
  const h=harness({server:'PC_EDIT',cupd:2});await h.run();await h.c.personalReviewChoose(K,true,h.reviews()[0]);
  h.hooks.prepare=()=>h.server.set(K,{workspace_id:'personal-a',k:K,v:'PC_EDIT_LATER',cupd:3});
  await assert.rejects(h.run(),e=>e.psCode==='sync_conflict');assert.equal(h.reviews().length,1);assert.equal(h.queue.length,1);
  delete h.hooks.prepare;await h.run();assert.equal(h.reviews()[0].choice,undefined);assert.equal(h.server.get(K).v,'PC_EDIT_LATER');
});

test('matching server raw after a lost response is acknowledged without another write',async()=>{
  const h=harness({server:'PHONE_EDIT',cupd:2});h.addPending();await h.run();
  assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);assert.equal(h.channel().c[K],2);assert.equal(h.queue.length,0);assert.equal(h.reviews().length,0);
});

test('an unchanged server body with a newer timestamp is not a content conflict',async()=>{
  const h=harness({server:'BASE',cupd:2});await h.run();
  const req=h.requests.find(r=>r.method==='PATCH');assert.ok(req);assert.match(req.url,/cupd=eq\.2/);assert.equal(h.reviews().length,0);
});

test('new local editing before push preparation completes is never acknowledged as saved',async()=>{
  const h=harness();h.hooks.prepare=()=>h.writeLocal(K,'PHONE_LATER');await h.run();
  assert.equal(h.idb.get(K),'PHONE_LATER');assert.equal(h.channel().h[K],h.c.hash('PHONE_EDIT'));assert.equal(h.queue.length,1);
});

test('new local input during a server pull defeats the real IndexedDB comparison write',async()=>{
  const h=harness({local:'BASE',server:'PC_EDIT',cupd:2});const before=copy(h.channel());
  h.hooks.localReplace=()=>h.writeLocal(K,'PHONE_LATER');
  await assert.rejects(h.run(),e=>e.psCode==='sync_local_changed');
  assert.equal(h.idb.get(K),'PHONE_LATER');assert.deepEqual(h.channel(),before);assert.equal(h.server.get(K).v,'PC_EDIT');
});

test('localStorage-only personal data also checks the exact value before a pull',async()=>{
  const h=harness({keys:[LOCAL_ONLY],local:'BASE',server:'PC_EDIT',cupd:2});const before=copy(h.channel());
  h.hooks.readResponse=stage=>{if(stage==='personal_pull')h.writeLocal(LOCAL_ONLY,'PHONE_LATER');};
  await assert.rejects(h.run(),e=>e.psCode==='sync_local_changed');assert.equal(h.local.get(LOCAL_ONLY),'PHONE_LATER');assert.deepEqual(h.channel(),before);
});

for(const phase of ['read','write']) {
  for(const change of ['account','team','switch','epoch','signout']) {
    test(`${change} change during ${phase} prevents metadata and outbox acknowledgement`,async()=>{
      const h=harness();h.addPending();const before=copy(h.channel());
      const act=()=>{if(change==='account')h.setSession({uid:'coach-b'});else if(change==='team')h.setActive('team-b');else if(change==='switch')h.setSwitch('switch-b');else if(change==='epoch')h.setSwitchEpoch('switch-b');else h.c.signOutEpoch++;};
      if(phase==='read')h.hooks.readResponse=act;else h.hooks.afterServerWrite=act;
      await assert.rejects(h.run(),e=>e.psCode==='sync_workspace_changed');
      assert.deepEqual(h.channel(),before);assert.equal(h.queue.length,1);assert.equal(h.c.personalIssue,null);
      if(phase==='read')assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);
    });
  }
}

test('a dialog from another account cannot authorize a personal write',async()=>{
  const h=harness({server:'PC_EDIT',cupd:2});await h.run();const shown=h.reviews()[0];h.setSession({uid:'coach-b'});
  assert.equal(h.reviews().length,0);assert.equal(await h.c.personalReviewChoose(K,true,shown),false);
});

test('a dialog opened before a team transition cannot authorize a personal write',async()=>{
  const h=harness({server:'PC_EDIT',cupd:2});await h.run();const shown=h.reviews()[0];h.setActive('team-b');
  assert.equal(await h.c.personalReviewChoose(K,true,shown),false);assert.equal(h.reviews()[0].choice,undefined);
});

test('a personal workspace explicitly owned by another account is never selected',async()=>{
  const h=harness({workspaces:[{id:'foreign-personal',kind:'personal',owner_id:'coach-b'}]});
  assert.equal(h.c.personalWid(),'');await h.run();assert.equal(h.requests.length,0);
});

test('missing full row in the metadata/body race never stores undefined or advances metadata',async()=>{
  const h=harness({local:'BASE',server:'PC_EDIT',cupd:2});const before=copy(h.channel());
  h.hooks.readResponse=(stage,rows)=>{if(stage==='personal_pull')rows.length=0;};
  await assert.rejects(h.run(),e=>e.psCode==='sync_confirm_missing');assert.equal(h.idb.get(K),'BASE');assert.deepEqual(h.channel(),before);
});

test('missing server cupd cannot fall through to an unconditional update',async()=>{
  const h=harness({cupd:null});await assert.rejects(h.run(),e=>e.psCode==='sync_confirm_missing');
  assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);assert.equal(h.server.get(K).v,'BASE');
});

test('server permission failure preserves old metadata, pending work and visible failure',async()=>{
  const h=harness();const before=copy(h.channel());h.hooks.writeStatus=403;
  await assert.rejects(h.run(),e=>e.psCode==='sync_permission');
  assert.deepEqual(h.channel(),before);assert.equal(h.queue.length,1);assert.equal(h.failures[0].wid,'personal-a');assert.equal(h.c.syncState().kind,'bad');
});

test('metadata write failure after server confirmation cannot clear the outbox',async()=>{
  const h=harness();const before=copy(h.channel());h.hooks.localWrite=k=>{if(k===META)throw new Error('quota');};
  await assert.rejects(h.run());assert.equal(h.server.get(K).v,'PHONE_EDIT');assert.deepEqual(h.channel(),before);assert.equal(h.queue.length,1);
  delete h.hooks.localWrite;await h.run();assert.equal(h.queue.length,0);assert.equal(h.server.get(K).v,'PHONE_EDIT');
});

test('failure to persist conflict review never turns into an upload or a clean status',async()=>{
  const h=harness({server:'PC_EDIT',cupd:2});const before=copy(h.channel());h.hooks.localWrite=k=>{if(k===REVIEW)throw new Error('quota');};
  await assert.rejects(h.run());assert.equal(h.requests.filter(r=>r.method!=='GET').length,0);assert.deepEqual(h.channel(),before);assert.equal(h.c.syncState().kind,'bad');
});

test('a conflicted key does not block a different personal key from saving',async()=>{
  const h=harness({keys:[K,K2]});h.server.set(K,{workspace_id:'personal-a',k:K,v:'PC_EDIT',cupd:2});await h.run();
  assert.equal(h.server.get(K).v,'PC_EDIT');assert.equal(h.server.get(K2).v,'PHONE_EDIT');assert.equal(h.reviews().length,1);assert.deepEqual(h.queue.map(x=>x.key),[K]);
});

test('partial server acceptance cannot acknowledge the rejected key or advance tentative metadata',async()=>{
  const h=harness({keys:[K,K2]});const before=copy(h.channel());let writes=0;
  h.hooks.beforeServerWrite=()=>{if(++writes===2)h.hooks.writeStatus=403;};
  await assert.rejects(h.run(),e=>e.psCode==='sync_permission');
  assert.equal(h.server.get(K).v,'PHONE_EDIT');assert.equal(h.server.get(K2).v,'BASE');assert.deepEqual(h.channel(),before);assert.equal(h.queue.length,2);
  delete h.hooks.beforeServerWrite;delete h.hooks.writeStatus;await h.run();
  assert.equal(h.queue.length,0);assert.equal(h.server.get(K2).v,'PHONE_EDIT');
});

test('oversized personal data reports failure instead of silently skipping and claiming success',async()=>{
  const h=harness({local:'x'.repeat(1500001)});await assert.rejects(h.run(),e=>e.psCode==='sync_personal_size');
  assert.equal(h.c.syncState().kind,'bad');assert.equal(h.server.get(K).v,'BASE');
});

test('existing data review shows private cloud wording and a real choice entry',async()=>{
  const h=harness({server:'PC_EDIT',cupd:2});await h.run();
  assert.equal(h.c.dataReviewList()[0].src,'personal');h.c.dataReviewOpen();
  const modal=h.modals.at(-1);assert.match(modal.body,/이 기기 것 올리기/);assert.match(modal.body,/다른 기기 것 받기/);assert.match(modal.body,/선택 전까지/);
});

test('main synchronization excludes personal payloads and delegates both workspace modes',()=>{
  const main=section('function syncNowCore(', '/* 서버 변경을 로컬에 반영한 뒤');
  assert.match(main,/if\(PERSONAL\[k\]\) return;/);
  assert.match(main,/syncPersonal\(at,roundWorkspaceCurrent\)/);
  assert.match(main,/ackSkipped=.*KEYS\.filter\(function\(k\)\{return PERSONAL\[k\];\}\)/);
});

// Two independent client storage/metadata/outboxes share one simulated server.
// This exercises the shipped sync code, not a physical phone or production RLS.
function sharedClients(){
  const sharedServer=new Map([[K,{workspace_id:'personal-a',k:K,v:'BASE',cupd:1}]]);
  return {server:sharedServer,pc:harness({local:'BASE',sharedServer}),phone:harness({local:'BASE',sharedServer})};
}
test('two isolated clients: a PC save reaches the unchanged phone after reconnect',async()=>{
  const {pc,phone,server}=sharedClients();pc.writeLocal(K,'PC_FIRST');pc.addPending(K,'PC_FIRST');
  await pc.run();assert.equal(server.get(K).v,'PC_FIRST');assert.equal(phone.idb.get(K),'BASE');
  await phone.run();assert.equal(phone.idb.get(K),'PC_FIRST');assert.equal(pc.queue.length,0);assert.equal(phone.queue.length,0);
});
test('two isolated clients: offline edits on both sides preserve both until an explicit choice',async()=>{
  const {pc,phone,server}=sharedClients();pc.writeLocal(K,'PC_OFFLINE');phone.writeLocal(K,'PHONE_OFFLINE');
  pc.addPending(K,'PC_OFFLINE');phone.addPending(K,'PHONE_OFFLINE');await pc.run();await phone.run();
  assert.equal(server.get(K).v,'PC_OFFLINE');assert.equal(phone.idb.get(K),'PHONE_OFFLINE');assert.equal(phone.reviews().length,1);
  assert.equal(phone.requests.filter(r=>r.method!=='GET').length,0);assert.equal(phone.queue.length,1);
  const pair=phone.reviews()[0];await phone.c.dataReviewApply('personal',K,false,pair);await phone.run();
  assert.equal(phone.idb.get(K),'PC_OFFLINE');assert.equal(phone.queue.length,0);assert.equal(server.get(K).v,'PC_OFFLINE');
});
test('two isolated clients: lost response after accepted upload retries without replacing a newer edit',async()=>{
  const {pc,phone,server}=sharedClients();phone.writeLocal(K,'PHONE_SENT');phone.addPending(K,'PHONE_SENT');
  phone.hooks.afterServerWrite=()=>{throw Error('simulated connection lost after server committed');};
  await assert.rejects(phone.run());assert.equal(server.get(K).v,'PHONE_SENT');assert.equal(phone.queue.length,1);
  await pc.run();pc.writeLocal(K,'PC_AFTER_PHONE');pc.addPending(K,'PC_AFTER_PHONE');await pc.run();
  delete phone.hooks.afterServerWrite;await phone.run();
  assert.equal(server.get(K).v,'PC_AFTER_PHONE');assert.equal(phone.idb.get(K),'PHONE_SENT');assert.equal(phone.reviews().length,1);
});
test('two isolated clients: stale recovery selection is rejected after a later PC revision',async()=>{
  const {pc,phone,server}=sharedClients();pc.writeLocal(K,'PC_ONE');await pc.run();phone.writeLocal(K,'PHONE_MINE');await phone.run();const shown=phone.reviews()[0];
  pc.writeLocal(K,'PC_TWO');await pc.run();await phone.c.dataReviewApply('personal',K,true,shown);await phone.run();
  assert.equal(server.get(K).v,'PC_TWO');assert.equal(phone.idb.get(K),'PHONE_MINE');assert.equal(phone.reviews().length,1);
  assert.equal(phone.requests.filter(r=>r.method!=='GET').length,0);
});
