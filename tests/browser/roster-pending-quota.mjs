import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,WT} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-roster-pending-quota-browser';
fs.mkdirSync(out,{recursive:true});SIZES.desktop={...SIZES.desktop,engine};
const fx=await startFixture(),browsers={},name='합성 quota 신규 선수';
let app,snapshotBefore,snapshotAfter,snapshotReload;const observations=[];
try{
  app=await openApp(fx,'desktop',{browsers,init:{fn:()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k==='scout_tool_v1'&&localStorage.getItem('fixture_main_quota')==='1'){
        const top=window.top;top.fixtureRejectedMain=top.fixtureRejectedMain||[];top.fixtureRejectedMain.push({key:k,raw:String(v)});
        throw new DOMException('fixture roster main mirror quota','QuotaExceededError');
      }
      if(String(k).startsWith('ps_roster_pending_v1:')&&String(k).includes(':b:')&&localStorage.getItem('fixture_pending_quota')==='1'){
        const top=window.top;top.fixtureRejectedBatches=top.fixtureRejectedBatches||[];top.fixtureRejectedBatches.push({key:k,raw:String(v)});
        throw new DOMException('fixture first roster pending batch quota','QuotaExceededError');
      }
      return set.call(this,k,v);
    };
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(v,k){
      if(String(k).startsWith('ps_roster_pending_v1:')&&localStorage.getItem('fixture_pending_idb_fail')==='1'){
        const top=window.top;top.fixtureRejectedIDB=top.fixtureRejectedIDB||[];top.fixtureRejectedIDB.push({key:k,raw:String(v)});
        throw new DOMException('fixture roster pending IDB quota','QuotaExceededError');
      }
      return put.apply(this,arguments);
    };
  }}});
  const {page}=app;
  async function openPlayers(){
    await page.locator('#appSeg [data-team-hub]').click();await page.locator('#teamNav [data-team-key="players"]').click();
    const frame=await (await page.locator('#fScout').elementHandle()).contentFrame();
    await frame.waitForFunction(()=>typeof data!=='undefined'&&!scoutBootPending&&scoutDataLoaded&&data.players.some(p=>p.name==='가상 선수 1'));
    return frame;
  }
  let frame=await openPlayers();
  async function snapshot(label,target=name){
    const local=await frame.evaluate(async name=>{
      const prefix='ps_roster_pending_v1:',keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k?.startsWith(prefix));
      const durableKeys=(await storage.keys()).filter(k=>k.startsWith(prefix));
      const player=data.players.find(p=>p.name===name);
      let barrier;try{await psFlushPendingReady();barrier={ok:true};}catch(e){barrier={ok:false,code:e.psCode,message:String(e.message||e)};}
      return {player:player||null,main:localStorage.getItem(KEY),idb:(await storage.peek(KEY))?.value??null,
        playerRow:player?(await storage.peek('sq:'+player.id))?.value??null:null,
        pendingBatches:keys.map(key=>({key,raw:localStorage.getItem(key)})),durablePending:await Promise.all(durableKeys.map(async key=>({key,raw:(await storage.peek(key))?.value??null}))),
        pending:psHasPending(),rosterPending:rosterPendingRows(),failed:scoutStore.hasFailed(KEY),barrier};
    },target);
    const value={label,...local,rejected:await page.evaluate(()=>window.fixtureRejectedBatches||[]),rejectedIDB:await page.evaluate(()=>window.fixtureRejectedIDB||[]),rejectedMain:await page.evaluate(()=>window.fixtureRejectedMain||[]),serverMain:fx.db.get(WT+'|scout_tool_v1')?.v??null,
      serverPlayers:[...fx.db.values()].filter(r=>r.workspace_id===WT&&r.k.startsWith('sq:')).map(r=>({k:r.k,raw:r.v})),writes:fx.writes.slice()};
    observations.push(value);fs.writeFileSync(path.join(out,engine+'-observations.json'),JSON.stringify({engine,observations},null,2));return value;
  }
  async function addPlayer(n,num){await frame.locator('#tmAdd').click();await frame.locator('[data-k="name"]').fill(n);await frame.locator('[data-k="num"]').fill(num);await frame.locator('[data-act="ok"]').click();await frame.waitForFunction(n=>data.players.some(p=>p.name===n),n);}
  snapshotBefore=await snapshot('before-add');
  await frame.evaluate(()=>localStorage.setItem('fixture_pending_quota','1'));
  await addPlayer(name,'91');
  snapshotAfter=await snapshot('after-first-batch-quota');
  await page.screenshot({path:path.join(out,engine+'-after-add.png')});
  fs.writeFileSync(path.join(out,engine+'-before-reload.json'),JSON.stringify({engine,before:snapshotBefore,after:snapshotAfter},null,2));
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);frame=await openPlayers();
  snapshotReload=await snapshot('after-reload');
  await page.screenshot({path:path.join(out,engine+'-after-reload.png')});
  fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify({engine,before:snapshotBefore,after:snapshotAfter,reload:snapshotReload,logs:app.logs},null,2));
  assert.ok(snapshotAfter.rejected.length>0,'the real native batch writer reached the injected quota');
  assert.equal(snapshotAfter.barrier.ok,false,'failed storage must keep the update barrier closed');
  assert.ok(snapshotReload.player,'the newly added original must survive reopening after the first pending-batch quota');
  assert.deepEqual(snapshotReload.player,snapshotAfter.player,'reopening preserves the exact new player original');
  assert.equal(snapshotAfter.main,snapshotBefore.main);assert.equal(snapshotAfter.idb,snapshotBefore.idb);
  assert.equal(snapshotAfter.serverMain,snapshotBefore.serverMain,'rescue capture is not a normal roster/server save');
  assert.equal(snapshotAfter.durablePending.length,1);assert.equal(snapshotReload.rosterPending,true);
  await frame.evaluate(()=>localStorage.setItem('fixture_pending_quota','0'));
  await frame.evaluate(()=>psFlushPendingReady());
  const syncResult=await page.evaluate(()=>PSSync.syncNow('fixture-roster-pending-recovered'));
  fs.writeFileSync(path.join(out,engine+'-native-round.json'),JSON.stringify(syncResult,null,2));
  assert.equal(syncResult?.error,undefined,'a native sync failure is not treated as eventual success');
  const recovered=await snapshot('after-exact-promotion-and-native-save');
  assert.equal(recovered.barrier.ok,true);assert.equal(recovered.pending,false);assert.equal(recovered.durablePending.length,0);
  assert.ok(JSON.parse(recovered.main).players.some(p=>p.id===snapshotAfter.player.id));
  assert.equal(recovered.main,recovered.idb);
  assert.deepEqual(JSON.parse(recovered.playerRow),snapshotAfter.player,'the original native SQ writer confirms the exact device row');
  // New SQ keys enter sync's one-minute live-key inventory on a fresh scan.
  // Reopening below exercises that real boundary without changing its clock.
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);frame=await openPlayers();
  const again=await snapshot('after-completed-reload');assert.equal(again.player.id,snapshotAfter.player.id);assert.equal(again.rosterPending,false,'an IDB rescue cannot resurrect after native ACK cleanup');
  assert.ok(fx.db.has(WT+'|sq:'+snapshotAfter.player.id),'the native fresh scan confirms the row on the synthetic server');
  assert.equal(JSON.parse(fx.db.get(WT+'|sq:'+snapshotAfter.player.id).v).name,name);

  // Main confirmation and immutable native batch acknowledgement are separate.
  // This path keeps real PSItems enabled, unlike the main-only browser fixture.
  const mainName='합성 MAIN 사본 복구 선수';
  await frame.evaluate(()=>{
    const ws=psSync().activeWsObj();fixtureNativeResumeScope=JSON.stringify([teamSaveOwner(),ws&&ws.role||'']);
    localStorage.setItem('fixture_main_quota','1');
  });
  await addPlayer(mainName,'93');const mainRejected=await snapshot('main-quota-native-batch',mainName);
  assert.ok(mainRejected.rejectedMain.length>0);assert.equal(mainRejected.barrier.ok,false);
  assert.equal(mainRejected.rosterPending,true);assert.equal(mainRejected.playerRow,null);
  assert.ok(mainRejected.pendingBatches.some(x=>x.key.includes(':b:')));assert.equal(mainRejected.durablePending.length,0);
  assert.notEqual(mainRejected.main,mainRejected.idb);assert.ok(JSON.parse(mainRejected.idb).players.some(p=>p.id===mainRejected.player.id));
  const nativeBefore=mainRejected.pendingBatches,serverBefore=mainRejected.serverPlayers;
  await frame.evaluate(async()=>{
    fixtureConfirmSet=storage.set;fixtureConfirmWrites=0;
    storage.set=function(...args){fixtureConfirmWrites++;return fixtureConfirmSet(...args);};
    localStorage.setItem('fixture_main_quota','0');
    localStorage.setItem(KEY,JSON.stringify(mem[KEY]));
    await scoutStore.ready(true);
  });
  const mainConfirmed=await snapshot('main-exact-confirmed-native-still-pending',mainName);
  assert.equal(mainConfirmed.main,mainConfirmed.idb);assert.equal(mainConfirmed.failed,false);
  assert.equal(mainConfirmed.barrier.ok,false,'exact main does not release the native outbox barrier');
  assert.equal(mainConfirmed.pending,true);assert.equal(mainConfirmed.rosterPending,true);
  assert.deepEqual(mainConfirmed.pendingBatches,nativeBefore,'confirmation cannot write an ACK or remove the native batch');
  assert.equal(mainConfirmed.playerRow,null);assert.deepEqual(mainConfirmed.serverPlayers,serverBefore);
  assert.equal(await frame.evaluate(()=>fixtureConfirmWrites),0,'recovered main confirmation never replays the document write');
  let nativeResume;
  try{
    nativeResume=await frame.evaluate(async expected=>{
      storage.set=fixtureConfirmSet;
      function current(){
        const ws=psSync().activeWsObj();
        if(fixtureNativeResumeScope!==JSON.stringify([teamSaveOwner(),ws&&ws.role||''])||localStorage.getItem('ps_ws_switch_guard_v1')||!scoutAutomaticWriteAllowed())throw Error('native resume authority changed');
      }
      async function completed(){
        current();const box=rosterOutbox();
        if(!box.prepared()||box.hasRescue()||box.read().rows.length||psHasPending()||scoutStore.hasFailed(KEY))throw Error('native batch did not resume');
        const raw=localStorage.getItem(KEY),wanted=JSON.stringify(expected);
        if(typeof raw!=='string'||JSON.stringify(mem[KEY])!==raw||JSON.stringify(data.players.find(p=>p.id===expected.id))!==wanted||JSON.stringify(JSON.parse(raw).players.find(p=>p.id===expected.id))!==wanted)throw Error('native resume draft is not exact');
        const [main,sq]=await Promise.all([storage.peek(KEY),storage.peek('sq:'+expected.id)]);
        current();
        if(!box.prepared()||box.hasRescue()||box.read().rows.length||psHasPending()||localStorage.getItem(KEY)!==raw||JSON.stringify(mem[KEY])!==raw||main?.value!==raw||sq?.value!==wanted)throw Error('native resume durable confirmation changed');
      }
      current();const resumed=rosterResumeRows(true);
      // A natural heal/ACK may finish between the pending snapshot and this
      // call. Only an already exact, empty, unchanged scope may accept false.
      if(resumed===false)await completed();
      await psFlushPendingReady();
      if(resumed===false)await completed();
      return {resumed,alreadyComplete:resumed===false};
    },mainRejected.player);
  }catch(error){
    const scalar=await frame.evaluate(async expected=>{
      const box=rosterOutbox(),ws=psSync().activeWsObj();let rows=null;try{rows=box.read().rows.length;}catch(_){}
      const raw=localStorage.getItem(KEY),main=(await storage.peek(KEY))?.value??null,sq=(await storage.peek('sq:'+expected.id))?.value??null;
      return {ownerSame:fixtureNativeResumeScope===JSON.stringify([teamSaveOwner(),ws&&ws.role||'']),guard:!!localStorage.getItem('ps_ws_switch_guard_v1'),editable:scoutAutomaticWriteAllowed(),prepared:box.prepared(),rescue:box.hasRescue(),rows,pending:psHasPending(),failed:scoutStore.hasFailed(KEY),mainIdbExact:raw===main,sqExact:sq===JSON.stringify(expected)};
    },mainRejected.player).catch(e=>({observationError:e.name}));
    fs.writeFileSync(path.join(out,engine+'-resume-failure.json'),JSON.stringify({message:error.message,scalar},null,2));throw error;
  }
  fs.writeFileSync(path.join(out,engine+'-native-resume.json'),JSON.stringify(nativeResume,null,2));
  const nativeFinished=await snapshot('main-recovery-native-sq-confirmed',mainName);
  assert.equal(nativeFinished.barrier.ok,true);assert.equal(nativeFinished.rosterPending,false);
  assert.deepEqual(JSON.parse(nativeFinished.playerRow),mainRejected.player);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);frame=await openPlayers();
  const mainAgain=await snapshot('main-recovery-completed-reload',mainName);
  assert.equal(mainAgain.player.id,mainRejected.player.id);assert.equal(mainAgain.rosterPending,false);
  assert.ok(fx.db.has(WT+'|sq:'+mainRejected.player.id),'fresh native scan confirms the recovered-main player row on the synthetic server');
  assert.deepEqual(JSON.parse(fx.db.get(WT+'|sq:'+mainRejected.player.id).v),mainRejected.player);

  const bothName='합성 양쪽 실패 선수';await frame.evaluate(()=>{localStorage.setItem('fixture_pending_quota','1');localStorage.setItem('fixture_pending_idb_fail','1');});
  await addPlayer(bothName,'92');const both=await snapshot('both-stores-failed',bothName);
  assert.ok(both.player);assert.equal(both.barrier.ok,false);assert.equal(both.pending,true);assert.equal(both.failed,true);
  assert.equal(both.durablePending.length,0);assert.ok(both.rejectedIDB.length>0,'the actual IDB request rejected the original too');
  assert.equal(JSON.parse(both.main).players.some(p=>p.name===bothName),false);assert.equal(JSON.parse(both.idb).players.some(p=>p.name===bothName),false);
  assert.equal([...fx.db.values()].some(r=>r.k.startsWith('sq:')&&JSON.parse(r.v).name===bothName),false);
  assert.deepEqual(app.logs.filter(x=>x.type==='pageerror'),[],'no unrelated runtime error is hidden by the injected storage failures');
  console.log(JSON.stringify({engine,preservedAfterReload:true,quotaReached:true,updateBarrierClosed:true,nativeRecoveryVerified:true,noResurrection:true,bothStoreFailureNeverSaved:true,recoveredMainKeepsNativeBatchBarrier:true,recoveredMainNativeServerVerified:true}));
}finally{
  if(app)await app.context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();
}
