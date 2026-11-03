import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,WT} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-roster-e6fc5d26-browser';
fs.mkdirSync(out,{recursive:true});SIZES.desktop={...SIZES.desktop,engine};
const fx=await startFixture(),browsers={},name='합성 quota 신규 선수';
let app,snapshotBefore,snapshotAfter,snapshotReload;const observations=[];
try{
  app=await openApp(fx,'desktop',{browsers,init:{fn:()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
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
    const value={label,...local,rejected:await page.evaluate(()=>window.fixtureRejectedBatches||[]),rejectedIDB:await page.evaluate(()=>window.fixtureRejectedIDB||[]),serverMain:fx.db.get(WT+'|scout_tool_v1')?.v??null,
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
  const rounds=[];
  for(let round=0;round<4&&!fx.db.has(WT+'|sq:'+snapshotAfter.player.id);round++){
    await page.waitForFunction(()=>PSSync.state().kind!=='busy');
    const result=await page.evaluate(()=>PSSync.syncNow('fixture-roster-pending-recovered'));
    const observation=await snapshot('native-sync-round-'+round);rounds.push({round,result,playerRow:observation.playerRow,serverHasRow:fx.db.has(WT+'|sq:'+snapshotAfter.player.id),writes:observation.writes});
    fs.writeFileSync(path.join(out,engine+'-native-rounds.json'),JSON.stringify(rounds,null,2));
    assert.equal(result?.error,undefined,'a native sync failure is not treated as eventual success');
  }
  const recovered=await snapshot('after-exact-promotion-and-native-save');
  assert.equal(recovered.barrier.ok,true);assert.equal(recovered.pending,false);assert.equal(recovered.durablePending.length,0);
  assert.ok(JSON.parse(recovered.main).players.some(p=>p.id===snapshotAfter.player.id));
  assert.equal(recovered.main,recovered.idb);
  assert.ok(fx.db.has(WT+'|sq:'+snapshotAfter.player.id),'only the original native SQ path may confirm the row on the synthetic server');
  assert.equal(JSON.parse(fx.db.get(WT+'|sq:'+snapshotAfter.player.id).v).name,name);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);frame=await openPlayers();
  const again=await snapshot('after-completed-reload');assert.equal(again.player.id,snapshotAfter.player.id);assert.equal(again.rosterPending,false,'an IDB rescue cannot resurrect after native ACK cleanup');

  const bothName='합성 양쪽 실패 선수';await frame.evaluate(()=>{localStorage.setItem('fixture_pending_quota','1');localStorage.setItem('fixture_pending_idb_fail','1');});
  await addPlayer(bothName,'92');const both=await snapshot('both-stores-failed',bothName);
  assert.ok(both.player);assert.equal(both.barrier.ok,false);assert.equal(both.pending,true);assert.equal(both.failed,true);
  assert.equal(both.durablePending.length,0);assert.ok(both.rejectedIDB.length>0,'the actual IDB request rejected the original too');
  assert.equal(JSON.parse(both.main).players.some(p=>p.name===bothName),false);assert.equal(JSON.parse(both.idb).players.some(p=>p.name===bothName),false);
  assert.equal([...fx.db.values()].some(r=>r.k.startsWith('sq:')&&JSON.parse(r.v).name===bothName),false);
  assert.deepEqual(app.logs.filter(x=>x.type==='pageerror'),[],'no unrelated runtime error is hidden by the injected storage failures');
  console.log(JSON.stringify({engine,preservedAfterReload:true,quotaReached:true,updateBarrierClosed:true,nativeRecoveryVerified:true,noResurrection:true,bothStoreFailureNeverSaved:true}));
}finally{
  if(app)await app.context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();
}
