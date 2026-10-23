import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},fx=await startFixture();
try{
 const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
 await page.waitForTimeout(12000); // finish the scheduled initial cleanup
 const result=await page.evaluate(async()=>{
   const board=document.getElementById('fBoard').contentWindow;
   const lib=Array.from({length:106},(_,i)=>({libId:'qa'+i,type:'board',name:'Synthetic '+i,snap:{players:[]},overview:'x'.repeat(200000)}));
   await storage.set('cs_drill_lib_v1',JSON.stringify(lib));
   const owners=[window,board],counts=[0,0];
   owners.forEach((w,i)=>{const get=w.IDBObjectStore.prototype.get;w.IDBObjectStore.prototype.get=function(k){if(k==='cs_drill_lib_v1')counts[i]++;return get.apply(this,arguments);};});
   const original=(await storage.get('cs_drill_lib_v1')).value;counts.fill(0);
   const result=await Promise.all([PSStorage.optimize(),PSStorage.optimize(),board.PSStorage.optimize(),board.PSStorage.optimize()]);
   const reads=counts.slice();
   const after=(await storage.get('cs_drill_lib_v1')).value;
   return {reads,total:reads.reduce((a,b)=>a+b,0),bytes:original.length,same:original===after,freed:result.map(x=>x.freed)};
 });
 console.log(JSON.stringify({engine,result}));
 assert.equal(result.same,true,'all original vault bytes survive');
 assert.equal(result.total,1,'concurrent cleanup requests across frames must share one whole-vault read');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
 await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
