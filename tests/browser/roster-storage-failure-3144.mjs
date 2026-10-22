import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
const out=process.env.PS_TEST_OUTPUT||'test-results/roster-storage-failure-3144';
fs.mkdirSync(out,{recursive:true});
const init={fn:()=>{
  const native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    if(k==='scout_tool_v1'&&this===window.localStorage&&localStorage.getItem('qa_scout_quota')==='1')
      throw new DOMException('Synthetic storage quota','QuotaExceededError');
    return native.call(this,k,v);
  };
}};
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,init});
  await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count);
  const old=await page.evaluate(()=>localStorage.getItem('scout_tool_v1'));
  const row=fx.db.get(WT+'|scout_tool_v1'),doc=JSON.parse(row.v);
  doc.meta.qaStorageDiagnostic='remote-v2';row.v=JSON.stringify(doc);row.cupd=Math.max(Date.now(),(+row.cupd||0)+1);
  await page.evaluate(()=>localStorage.setItem('qa_scout_quota','1'));
  const snapshot=()=>page.evaluate(async()=>({state:PSSync.state(),view:PSAutosaveStatus.view(PSSync.state()),
    pending:PSSync.pending().count,ready:PSSync.rosterReady(PSSync.activeWs()),
    idb:(await storage.get('scout_tool_v1'))?.value,mirror:localStorage.getItem('scout_tool_v1')}));
  for(let i=0;i<2;i++){
    await page.evaluate(()=>PSSync.syncNow('qa-storage-failed'));
    await page.waitForFunction(()=>PSSync.state().reason==='sync_storage');
    await page.waitForFunction(()=>document.getElementById('psSyncStripTx').textContent==='기기 저장을 확인해 주세요');
    const failed=await snapshot();
    assert.equal(failed.pending,0);assert.equal(failed.state.kind,'bad');assert.equal(failed.view.complete,false);
    assert.equal(failed.view.action,'retry');assert.equal(failed.ready,false);
    assert.equal(failed.idb,old);assert.equal(failed.mirror,old);
    assert.match(row.v,/remote-v2/,'server update remains intact');
  }
  await page.screenshot({path:path.join(out,engine+'-storage-error.png')});
  await page.evaluate(()=>{localStorage.setItem('qa_scout_quota','0');return PSSync.syncNow('qa-storage-restored');});
  await page.waitForFunction(async()=>PSSync.state().kind==='ok'&&!PSSync.pending().count&&
    /remote-v2/.test(localStorage.getItem('scout_tool_v1'))&&localStorage.getItem('scout_tool_v1')===(await storage.get('scout_tool_v1'))?.value);
  await page.waitForFunction(()=>document.getElementById('psSyncStripTx').textContent==='저장됨');
  const recovered=await snapshot();assert.equal(recovered.view.complete,true);assert.equal(recovered.ready,true);
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  const result={engine,failedPullPreservesBothCopies:true,zeroUploadsStillIncomplete:true,repeatedFailureNotAcknowledged:true,retryRestoresExactCopiesAndCompletion:true};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
