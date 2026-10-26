import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {startFixture,openApp,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
const out=process.env.PS_TEST_OUTPUT||'test-results/roster-storage-failure-3144';
fs.mkdirSync(out,{recursive:true});
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex'),observations=[];
// Match the established root-child fixture setup: first-open match-ID
// maintenance is unrelated to this already-loaded roster pull failure.
const scheduleRow=fx.db.get(WT+'|process_coach_v1'),scheduleSeed=JSON.parse(scheduleRow.v);
for(const [w,days]of Object.entries(scheduleSeed.weeks))for(const [i,d]of days.entries())if(d.board?.sched==='경기')d.mid='save-status-'+w+'-'+i;
scheduleRow.v=JSON.stringify(scheduleSeed);
const setupProof={key:'process_coach_v1',value:scheduleRow.v,sha256:hash(scheduleRow.v),stableMatchIds:true};
fs.writeFileSync(path.join(out,'prestate.json'),JSON.stringify(setupProof,null,2));
let page,logs=[],team;
const init={fn:()=>{
  const native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    if(k==='scout_tool_v1'&&this===window.localStorage&&localStorage.getItem('qa_scout_quota')==='1')
      throw new DOMException('Synthetic storage quota','QuotaExceededError');
    return native.call(this,k,v);
  };
}};
try{
  ({page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,init}));
  await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count);
  // Exercise a real live roster scope in both layouts; a cold board-only shell
  // has no unsupported team scope and may truthfully show a different status.
  await page.locator('[data-team-hub="1"]:visible').click();
  await page.locator('[data-team-key="players"][data-tn-grp="squad"]:visible').click();
  team=await (await page.waitForSelector('#fScout')).contentFrame();
  await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof save==='function');
  await team.evaluate(()=>save({skipTargets:true,skipItems:true}));
  await team.evaluate(()=>psFlushPendingReady());
  await page.evaluate(()=>PSSync.syncNow('fixture-roster-scope-baseline'));
  await team.waitForFunction(()=>PSSaveState.get('team')==='saved'&&!psHasPending());
  await page.waitForFunction(async()=>PSSync.state().kind==='ok'&&!PSSync.pending().count&&localStorage.getItem('scout_tool_v1')===(await storage.peek('scout_tool_v1'))?.value);
  const old=await page.evaluate(()=>localStorage.getItem('scout_tool_v1'));
  const row=fx.db.get(WT+'|scout_tool_v1'),doc=JSON.parse(row.v);
  assert.equal(row.v,old,'the actual baseline roster save is acknowledged before fault injection');
  doc.meta.qaStorageDiagnostic='remote-v2';row.v=JSON.stringify(doc);row.cupd=Math.max(Date.now(),(+row.cupd||0)+1);
  await page.evaluate(()=>localStorage.setItem('qa_scout_quota','1'));
  const snapshot=()=>page.evaluate(async()=>{const failedScopes=[];
    for(const w of [window,...Array.from(document.querySelectorAll('iframe'),f=>f.contentWindow)])try{if(w.location.origin===location.origin)for(const [scope,state]of Object.entries(w.PSSaveState?.snapshot?.().scopes||{}))if(state==='failed')failedScopes.push({document:w.location.pathname,scope});}catch{}
    return {state:PSSync.state(),view:__psAutosaveView(),pending:PSSync.pending().count,ready:PSSync.rosterReady(PSSync.activeWs()),failedScopes,
      idb:(await storage.get('scout_tool_v1'))?.value,mirror:localStorage.getItem('scout_tool_v1')};});
  const scope=()=>team.evaluate(async()=>{const raw=localStorage.getItem('scout_tool_v1'),idb=(await storage.peek('scout_tool_v1'))?.value??null;return {state:PSSaveState.get('team'),pending:psHasPending(),exactLocal:raw!==null&&raw===idb,unsupportedReceipt:parent.PSSync.confirmedValue('scout_tool_v1',raw)};});
  const record=async(label,s)=>{observations.push({label,state:s.state,pending:s.pending,ready:s.ready,view:s.view,failedScopes:s.failedScopes,idbHash:hash(s.idb),mirrorHash:hash(s.mirror),serverHash:hash(row.v),teamScope:await scope()});};
  for(let i=0;i<2;i++){
    await page.evaluate(()=>PSSync.syncNow('qa-storage-failed'));
    await page.waitForFunction(()=>PSSync.state().reason==='sync_storage');
    // If a real quota notice was scheduled, observe its bounded decision before
    // retrying; clearing an already-reported local failure is part of this flow.
    await page.waitForFunction(()=>typeof window.PSStorage?.quotaState==='function'&&!PSStorage.quotaState().checking);
    await page.waitForFunction(()=>{const v=__psAutosaveView();return v.kind==='bad'&&!v.complete&&document.getElementById('psSyncStripTx').textContent===v.text;});
    const failed=await snapshot();
    assert.equal(failed.pending,0);assert.equal(failed.state.kind,'bad');assert.equal(failed.state.reason,'sync_storage');assert.equal(failed.view.complete,false);
    assert.equal(failed.view.action,'retry');assert.equal(failed.ready,false);
    assert.ok(['기기 저장을 확인해 주세요','기기에 저장하지 못했어요'].includes(failed.view.text),'the exact failure label reflects a sync storage failure or a real local failed scope');
    if(failed.view.text==='기기에 저장하지 못했어요')assert.ok(failed.failedScopes.length>0,'a local failure label must have a real current-document failed scope');
    assert.equal(failed.idb,old);assert.equal(failed.mirror,old);
    assert.match(row.v,/remote-v2/,'server update remains intact');
    await record('failed-'+(i+1),failed);
  }
  await page.screenshot({path:path.join(out,engine+'-storage-error.png')});
  await page.evaluate(()=>{localStorage.setItem('qa_scout_quota','0');return PSSync.syncNow('qa-storage-restored');});
  await page.waitForFunction(async()=>PSSync.state().kind==='ok'&&!PSSync.pending().count&&
    /remote-v2/.test(localStorage.getItem('scout_tool_v1'))&&localStorage.getItem('scout_tool_v1')===(await storage.get('scout_tool_v1'))?.value);
  await page.waitForFunction(()=>document.getElementById('psSyncStripTx').textContent==='기기에 저장됨');
  const recovered=await snapshot();assert.equal(recovered.view.complete,false);assert.equal(recovered.ready,true);
  assert.deepEqual(await scope(),{state:'saved',pending:false,exactLocal:true,unsupportedReceipt:false},'the current live team is locally durable; its multi-key scope has no supported exact server receipt');
  await record('recovered-local-only',recovered);
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  const result={engine,passed:true,setup:{scheduleSeedSha256:setupProof.sha256,stableMatchIds:true},failedPullPreservesBothCopies:true,zeroUploadsStillIncomplete:true,repeatedFailureNotAcknowledged:true,retryRestoresExactCopies:true,liveUnsupportedTeamLocalOnly:true,rootServerCompletionClaim:false,observations};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){
  const actual=page&&await page.evaluate(async()=>{const summarize=raw=>{try{return JSON.parse(raw||'[]').map(x=>({key:x.key,source:x.source,attempts:x.attempts}));}catch{return null;}};return {view:window.__psAutosaveView?.(),stripText:document.getElementById('psSyncStripTx')?.textContent,state:PSSync.state(),pending:PSSync.pending().count,rootScopes:PSSaveState.snapshot().scopes,outbox:{local:summarize(localStorage.getItem('ps_sync_outbox_v1')),idb:summarize((await storage.peek('ps_sync_outbox_v1'))?.value)}};}).catch(()=>null);
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({engine,error:error.message,actual,teamScope:team&&await team.evaluate(()=>({scopes:PSSaveState.snapshot().scopes,pending:psHasPending()})).catch(()=>null),observations,logs},null,2));
  if(page)await page.screenshot({path:path.join(out,engine+'-failure.png')}).catch(()=>{});throw error;
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
