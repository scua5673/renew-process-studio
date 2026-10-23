import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={},id='revision-fixture';
const item={libId:id,type:'board',name:'프로세스FC 원래 자료',savedAt:1000,editedAt:1000,snap:{players:[]}};
fx.lib.set(WT+'|'+id,{workspace_id:WT,lib_id:id,type:'board',name:item.name,item,saved_at:1000,updated_at:new Date(1000).toISOString(),deleted_at:null,private:false,owner_id:A});
try{
 const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
 await page.evaluate(()=>psFlushAllPendingReady());
 const raw=await page.evaluate(async()=>(await storage.get('cs_drill_lib_v1')).value);
 assert.equal(JSON.parse(raw).find(i=>i.libId===id).name,item.name);
 // Change only the probe timestamp: force one unchanged server comparison.
 fx.lib.get(WT+'|'+id).updated_at=new Date().toISOString();
 await page.evaluate(id=>{
  const get=storage.get.bind(storage);let fired=false;
  storage.get=async function(k){
   const row=await get(k);
   if(k==='cs_drill_lib_v1'&&!fired){
    fired=true;const list=JSON.parse(row.value),it=list.find(i=>i.libId===id);
    it.name='프로세스FC 새 편집';it.editedAt=Date.now();
    await storage.set(k,JSON.stringify(list));localStorage.setItem('cs_lib_rev',String(Date.now()+1));
    window.qaLibraryRace=true;
   }
   return row;
  };
 },id);
 const stopped=await page.evaluate(()=>PSSync.syncNow('fixture-library-race'));
 assert.equal(await page.evaluate(()=>window.qaLibraryRace),true,'read race was exercised');
 assert.equal(stopped.code,'sync_local_changed','stale body must not acknowledge the new revision');
 assert.equal(fx.lib.get(WT+'|'+id).item.name,item.name,'first round cannot upload the stale body');
 await page.evaluate(()=>PSSync.syncNow('fixture-library-retry'));
 await page.waitForFunction(()=>PSSync.state().kind!=='busy');
 assert.equal(fx.lib.get(WT+'|'+id).item.name,'프로세스FC 새 편집','retry must send the actual new body');
 assert.equal(JSON.parse(await page.evaluate(async()=>(await storage.get('cs_drill_lib_v1')).value)).find(i=>i.libId===id).name,'프로세스FC 새 편집');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,passed:true,cases:['stale-snapshot-rejected','new-body-preserved','retry-uploads-new-revision']}));
 await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
