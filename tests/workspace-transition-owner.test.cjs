'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(process.env.PS_SYNC_SOURCE_FILE||path.join(__dirname,'../studio/sync.js'),'utf8');
const start=source.indexOf('function switchWorkspaceCore('),end=source.indexOf('function createTeam(',start);
assert.ok(start>=0&&end>start);
const code=source.slice(start,end);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function harness(){
  const local=new Map([['active','team-A'],['owner','owner-A'],['meta','original-A-meta'],['roster','A roster'],['schedule','A schedule']]);
  const idb=new Map([['roster','A roster']]),hooks={},calls={deleted:[],reloads:0,frames:0,modals:[],statuses:[]};
  let session={uid:'account-A'},owner={uid:'account-A',wid:'team-A'},guard='',epoch='',serial=0;
  const frame={set src(value){calls.frames++;}},timers=new Map();let timer=0;
  const c=vm.createContext({Promise,Error,JSON,Math,Date,Object,String,Array,Number,
    switching:false,switchingAt:0,switchGen:0,signOutEpoch:0,WS_HOLD_REVIEW_SEQ:0,switchWiping:false,externalSwitchFrozen:false,
    MKEY:'meta',OWNERKEY:'owner',RLKEY:'reload',MATCH_KEY:'match',CONTENT:['roster','schedule'],SWITCH_META_KEEP:{},PERSONAL:{},UNREACHABLE:{},matchReadyPending:false,
    localStorage:{get length(){return local.size;},key:i=>[...local.keys()][i],getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
    sessionStorage:{removeItem(){}},document:{querySelectorAll:()=>[frame]},location:{reload(){calls.reloads++;}},
    window:{storage:{del(k,current){if(hooks.del)return hooks.del(k,current);if(current)current();calls.deleted.push(k);idb.delete(k);return Promise.resolve();}}},
    getSess:()=>session,activeWs:()=>local.get('active'),cacheOwner:()=>owner,
    setCacheOwner(uid,wid){owner={uid,wid};local.set('owner','owner-'+(++serial));return true;},
    setActiveWs(wid){local.set('active',wid);if(hooks.setActive)hooks.setActive(wid);return true;},
    dataUnlocked:()=>!!session&&owner.uid===session.uid&&owner.wid===local.get('active'),
    setDataReady(on,uid,wid){if(on)c.setCacheOwner(uid,wid);return on;},dataLockError:()=>new Error('locked'),
    workspaceSwitchGuardStart(){guard='guard-'+(++serial);epoch=guard;return guard;},workspaceSwitchGuardOwned:t=>!!guard&&t===guard,
    workspaceSwitchGuardClear(t){if(t===guard)guard='';},workspaceSwitchEpochRaw:()=>epoch,
    scheduleHeld:()=>hooks.held?hooks.held():false,scheduleEditActive:false,
    workspaceSwitchWriteBarrier:()=>hooks.barrier?hooks.barrier():Promise.resolve({ready:1}),
    stashSnapshot:()=>Promise.resolve(),idbSwitchKeys:()=>Promise.resolve([...idb.keys()]),
    workspacePubLocalKeys:()=>[],verifyWorkspacePubCleared:()=>Promise.resolve(),
    wsList:()=>[{id:'team-A',name:'A'},{id:'team-B',name:'B'}],
    showSwitchOverlay(){},hideSwitchOverlay(){},setStatus:s=>calls.statuses.push(s),chip(){},recSwitchFail(){},syncDiagnostic(){},markSelfReload(){},
    setTimeout(fn,ms){const id=++timer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    sleep:ms=>ms===350&&hooks.beforeWipe?hooks.beforeWipe():ms===300&&hooks.holdWait?hooks.holdWait():Promise.resolve(),
    withTimeout(p,ms){if(ms===12000&&hooks.wipeTimeout){p.catch(()=>{});return Promise.resolve({__timeout:1});}return Promise.resolve(p).then(v=>v,()=>({__timeout:1,err:1}));},
    forceSync:()=>hooks.sync?hooks.sync():Promise.resolve({}),forceSyncPostSwitch:()=>hooks.postsync?hooks.postsync():Promise.resolve({}),
    workspaceBlockingPendingKeys:()=>Promise.resolve([]),holdList:()=>[],outboxRead:()=>Promise.resolve([]),
    isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,keyLabel:k=>k,
    ensureToken:()=>Promise.resolve('synthetic-token'),hj:()=>({}),BASE:'https://synthetic.invalid',fetch:()=>hooks.reasons?hooks.reasons():Promise.resolve({ok:true,json:async()=>[]}),
    esc:x=>String(x),psModal:x=>calls.modals.push(x)
  });
  vm.runInContext(code,c);
  function change({uid='account-B',wid='team-C',authEpoch=true}={}){session={uid};owner={uid,wid};local.set('active',wid);local.set('owner','changed-'+(++serial));local.set('meta','new meta');local.set('roster','new roster');local.set('schedule','new schedule');idb.set('roster','new roster');if(authEpoch)c.signOutEpoch++;}
  return {c,local,idb,hooks,calls,timers,change,run:()=>c.switchWorkspaceCore('team-B'),snapshot:()=>JSON.stringify([...local])};
}
test('ordinary workspace switch still saves and opens the selected team',async()=>{
  const h=harness();await h.run();assert.equal(h.local.get('active'),'team-B');assert.equal(h.c.cacheOwner().uid,'account-A');assert.equal(h.calls.reloads,1);assert.deepEqual(h.calls.deleted,['roster']);
});
test('pending source writes finish before the transition rotates its ownership markers',async()=>{
  const h=harness(),gate=deferred(),seal=h.local.get('owner'),epoch=h.c.workspaceSwitchEpochRaw();let passes=0;
  h.hooks.barrier=()=>++passes===1?gate.promise.then(()=>{assert.equal(h.local.get('owner'),seal);assert.equal(h.c.workspaceSwitchEpochRaw(),epoch);return {ready:1};}):Promise.resolve({ready:1});
  const pending=h.run();await tick();assert.equal(h.local.get('owner'),seal);gate.resolve();await pending;
  assert.equal(h.local.get('active'),'team-B');assert.equal(h.calls.reloads,1);
});
test('a team outside the current account list cannot clear its local documents',async()=>{
  const h=harness(),before=h.snapshot();const result=await h.c.switchWorkspaceCore('unknown-team');
  assert.equal(result.unknownWorkspace,1);assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.deleted,[]);
});
test('an account change during the schedule-save grace period cancels the earlier choice',async()=>{
  const h=harness(),gate=deferred();let held=true;h.hooks.held=()=>held;h.hooks.holdWait=()=>gate.promise;
  const pending=h.run();await tick();h.change({wid:'team-A'});const before=h.snapshot();held=false;gate.resolve();await pending;
  assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.deleted,[]);assert.equal(h.calls.frames,0);
});
test('the schedule-save grace period still resumes for the same account and team',async()=>{
  const h=harness(),gate=deferred();let held=true;h.hooks.held=()=>held;h.hooks.holdWait=()=>gate.promise;
  const pending=h.run();await tick();held=false;gate.resolve();await pending;assert.equal(h.local.get('active'),'team-B');assert.equal(h.calls.reloads,1);
});
for(const at of ['first-barrier','before-wipe'])test('a changed account cannot be wiped by an earlier switch at '+at,async()=>{
  const h=harness(),gate=deferred();if(at==='first-barrier')h.hooks.barrier=()=>gate.promise;else h.hooks.beforeWipe=()=>gate.promise;
  const pending=h.run();await tick();h.change();const before=h.snapshot();gate.resolve({ready:1});await pending;
  assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.deleted,[]);assert.equal(h.idb.get('roster'),'new roster');
});
test('same-account A-B-A login invalidates a switch waiting to wipe',async()=>{
  const h=harness(),gate=deferred();h.hooks.beforeWipe=()=>gate.promise;const pending=h.run();await tick();h.change({uid:'account-A',wid:'team-A'});const before=h.snapshot();gate.resolve();await pending;
  assert.equal(h.snapshot(),before);assert.equal(h.idb.get('roster'),'new roster');assert.deepEqual(h.calls.deleted,[]);
});
test('timed-out old IndexedDB deletion cannot erase newly loaded data',async()=>{
  const h=harness(),gate=deferred();h.hooks.wipeTimeout=true;
  h.hooks.del=(k,current)=>gate.promise.then(()=>{if(current)current();h.idb.delete(k);h.calls.deleted.push(k);});
  await h.run();h.idb.set('roster','reloaded A roster');gate.resolve();await tick();
  assert.equal(h.idb.get('roster'),'reloaded A roster');assert.deepEqual(h.calls.deleted,[]);
});
test('an account change while an IndexedDB delete waits prevents that delete and old marker rollback',async()=>{
  const h=harness(),gate=deferred();h.hooks.del=(k,current)=>gate.promise.then(()=>{if(current)current();h.idb.delete(k);h.calls.deleted.push(k);});
  const pending=h.run();await tick();h.change();const before=h.snapshot();gate.resolve();await pending;
  assert.equal(h.snapshot(),before);assert.equal(h.idb.get('roster'),'new roster');assert.deepEqual(h.calls.deleted,[]);
});
test('an account change during destination marker writes cannot attach it to the previous team',async()=>{
  const h=harness();let before;
  h.hooks.setActive=wid=>{if(wid==='team-B'){h.change();before=h.snapshot();}};
  await h.run();assert.equal(h.snapshot(),before);assert.equal(h.c.cacheOwner().uid,'account-B');assert.equal(h.local.get('active'),'team-C');
});
test('late rejected-save details cannot open a confirmation for another account',async()=>{
  const h=harness(),gate=deferred();h.hooks.sync=()=>Promise.resolve({error:'rejected',code:'sync_server_rejected',rejectedKeys:['roster']});h.hooks.reasons=()=>gate.promise;
  await h.run();h.change();gate.resolve({ok:true,json:async()=>[{k:'roster',reason:'old team details'}]});await tick();assert.deepEqual(h.calls.modals,[]);
});
test('postswitch completion cannot announce or reload a newer account as the old target',async()=>{
  const h=harness(),gate=deferred();h.hooks.postsync=()=>gate.promise;const pending=h.run();await tick();h.change();const before=h.snapshot();gate.resolve({});await pending;
  assert.equal(h.snapshot(),before);assert.equal(h.local.has('ps_ws_switched_v1'),false);
});

// Run the shipped timeout helper on a virtual clock, including the real
// transition's outer watchdog. A slow but successful save must still reach
// the original owner checks and confirmed-data gate before any wipe.
function timedHarness(from='personal-A'){
  const h=harness(),jobs=new Map();let now=0,serial=0;
  h.local.set('active',from);h.c.setCacheOwner('account-A',from);
  h.c.wsList=()=>[{id:from,kind:from==='personal-A'?'personal':'team',name:'Source'},{id:'team-B',kind:'team',name:'Destination'}];
  h.local.set('cs_private_board_v1','personal working board');
  h.c.setTimeout=(fn,ms)=>{const id=++serial;jobs.set(id,{fn,at:now+ms});return id;};
  h.c.clearTimeout=id=>jobs.delete(id);
  h.c.Date=class extends Date{static now(){return 1700000000000+now;}};
  vm.runInContext(source.slice(source.indexOf('function withTimeout(p,ms)'),source.indexOf('/* busy면 스킵')),h.c);
  return Object.assign(h,{
    contentSnapshot(){return JSON.stringify([...h.local].filter(([k])=>k!=='owner'));},
    later(ms,value){return new Promise(resolve=>h.c.setTimeout(()=>resolve(value),ms));},
    async advance(ms){
      const until=now+ms;
      for(;;){
        const entry=[...jobs].filter(([,j])=>j.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
        if(!entry)break;
        now=entry[1].at;jobs.delete(entry[0]);entry[1].fn();await tick();
      }
      now=until;await tick();
    }
  });
}
for(const from of ['personal-A','team-A'])for(const delay of [18000,32000])test(from+' confirmed save after '+delay+'ms can open the selected team',async()=>{
  const h=timedHarness(from);h.hooks.sync=()=>h.later(delay,{saved:1});
  const pending=h.run();await tick();await h.advance(15000);
  assert.equal(h.local.get('active'),from);assert.deepEqual(h.calls.deleted,[],'No deletion while save is unconfirmed');
  await h.advance(delay-15000);await pending;
  assert.equal(h.local.get('active'),'team-B');assert.equal(h.calls.reloads,1);
  assert.equal(h.local.get('cs_private_board_v1'),'personal working board');
});
test('an unconfirmed save still times out without deleting source data; its late response cannot switch',async()=>{
  const h=timedHarness();h.hooks.sync=()=>h.later(50000,{saved:1});const before=h.contentSnapshot();
  const pending=h.run();await tick();await h.advance(41000);const result=await pending;
  assert.equal(result.cancelled,1);assert.equal(h.contentSnapshot(),before);assert.deepEqual(h.calls.deleted,[]);assert.equal(h.calls.frames,0);
  assert.equal(h.c.cacheOwner().uid,'account-A');assert.equal(h.c.cacheOwner().wid,'personal-A');
  await h.advance(20000);assert.equal(h.contentSnapshot(),before);assert.equal(h.calls.reloads,0);
});
test('a changed account during extended confirmation wait never receives the old transition',async()=>{
  const h=timedHarness();h.hooks.sync=()=>h.later(20000,{saved:1});const pending=h.run();await tick();await h.advance(16000);
  h.change();const before=h.snapshot();await h.advance(5000);await pending;
  assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.deleted,[]);assert.equal(h.calls.frames,0);
});
test('slow confirmation that returns a storage error still keeps the source intact',async()=>{
  const h=timedHarness();h.hooks.sync=()=>h.later(18000,{error:'disk failure',code:'sync_storage'});const before=h.contentSnapshot();
  const pending=h.run();await tick();await h.advance(18000);const result=await pending;
  assert.equal(result.cancelled,1);assert.equal(h.contentSnapshot(),before);assert.deepEqual(h.calls.deleted,[]);assert.equal(h.calls.frames,0);
  assert.equal(h.c.cacheOwner().uid,'account-A');assert.equal(h.c.cacheOwner().wid,'personal-A');
});
