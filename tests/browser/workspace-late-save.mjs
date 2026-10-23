import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT,WP} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
const key='cs_meet_sit_v1',base=JSON.stringify({title:'confirmed'}),late=JSON.stringify({title:'late local edit'});
fx.db.set(WT+'|'+key,{workspace_id:WT,k:key,v:base,cupd:1000,updated_by:A});
try{
 const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
 await page.evaluate(()=>psFlushAllPendingReady());
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
