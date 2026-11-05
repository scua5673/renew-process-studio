import assert from 'node:assert/strict';
import {startFixture,openApp,ready,A,WT,WP} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
const key='cs_meet_sit_v1',base=JSON.stringify({title:'confirmed'}),late=JSON.stringify({title:'late local edit'});
fx.db.set(WT+'|'+key,{workspace_id:WT,k:key,v:base,cupd:1000,updated_by:A});
try{
 const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
 /* 11/5 — 가짜 «대기 목록 읽기 실패»는 앱이 조용해진 뒤에만 켠다. 부팅 중 프레임 storage 이벤트가 그 사이에 오면
    부모의 거울 · outbox 꼬리(sync.js editMirrorCommit · editOutboxCommit)가 그 실패를 받아 일부러 rejection 으로 남고(전환 장벽 fail-closed),
    다음 전환이 시험하려는 «마지막 저장 확인 중 늦은 편집»에 닿기 전에 «barrier failed mirror»로 멈췄다(25번 중 1번꼴, 늦은 편집은 쓰이지도 않음). */
 const tails=()=>page.evaluate(()=>Promise.allSettled([window.editMirrorCommit,window.editOutboxCommit]).then(r=>r.map(x=>x.status)));
 await ready(page);
 await page.evaluate(()=>psFlushAllPendingReady());
 assert.deepEqual(await tails(),['fulfilled','fulfilled'],'parent edit tails are settled before the synthetic failure');
 await page.evaluate(()=>{
  const get=storage.get.bind(storage);
  window.qaQueueReadFailure=true;
  storage.get=function(k){if(k==='ps_sync_outbox_v1'&&window.qaQueueReadFailure)return Promise.reject(new Error('Synthetic queue read failure'));return get(k);};
 });
 const unread=await page.evaluate(async wid=>await PSSync.switchWorkspace(wid),WP);
 assert.equal(unread?.cancelled,1,'unread queue cannot authorize a wipe');
 assert.equal(await page.evaluate(()=>PSSync.activeWs()),WT);
 assert.equal(await page.evaluate(async key=>(await storage.get(key)).value,key),base);
 await page.evaluate(()=>{window.qaQueueReadFailure=false;});
 assert.deepEqual(await tails(),['fulfilled','fulfilled'],'the synthetic queue failure did not leak into a background edit tail');

 await page.evaluate(({key,late})=>{
  const flush=window.psFlushAllPendingReady;let calls=0;
  window.psFlushAllPendingReady=async function(...args){
   const result=await flush.apply(this,args);
   if(++calls===2){
    // A delayed frame write completes during the final local-save barrier,
    // after the preceding server round has already acknowledged the old body.
    await storage.set(key,late);localStorage.setItem(key,late);
    window.dispatchEvent(new StorageEvent('storage',{key,oldValue:null,newValue:late,storageArea:localStorage}));
   }
   return result;
  };
 },{key,late});
 const stopped=await page.evaluate(async wid=>await PSSync.switchWorkspace(wid),WP).catch(e=>({navigation:e.message}));
 await page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked());
 const state=await page.evaluate(async key=>({ws:PSSync.activeWs(),raw:(await storage.get(key))?.value,guard:localStorage.getItem('ps_ws_switch_guard_v1')}),key);
 console.log(JSON.stringify({engine,stopped,state,server:fx.db.get(WT+'|'+key)?.v}));
 assert.equal(state.ws,WT,'unconfirmed late local change must prevent source deletion');
 assert.equal(state.raw,late);assert.equal(state.guard,null);assert.equal(stopped?.cancelled,1);
 assert.equal(fx.db.get(WT+'|'+key).v,base,'first server confirmation preceded the edit');
 await page.evaluate(wid=>{PSSync.switchWorkspace(wid);},WP);
 await page.waitForFunction(wid=>window.PSSync&&PSSync.activeWs()===wid&&PSSync.dataUnlocked(),WP,{timeout:45000});
 assert.equal(fx.db.get(WT+'|'+key).v,late,'retry confirms exact new contents in the source team');
 assert.equal(fx.db.has(WP+'|'+key),false,'team contents never migrate to the destination');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,passed:true,cases:['unread-queue-retained','late-write-retained','cancel-releases-guard','retry-confirms-source','destination-isolated']}));
 await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
