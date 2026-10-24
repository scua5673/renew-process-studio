import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES,WT,A} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
const key='cs_idp_v1_22222222-2222-4222-8222-222222222222',doc=text=>JSON.stringify({v:1,profile:{name:'가상 선수'},log:{today:{text}},imgNotes:[]});
const source=doc('선수가 작성한 최신 합성 글'),legacy=doc('과거 합성 IDB 사본'),old=doc('이전 합성 화면 사본');
fx.db.set(WT+'|'+key,{workspace_id:WT,k:key,v:source,cupd:1000,updated_by:A});
try{for(const width of [375,393,768,1280]){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:850};
 const {page,context,logs}=await openApp(fx,size,{browsers});
 const seeded=await page.evaluate(async({key,old,legacy})=>{
  await storage.set(key,legacy);localStorage.setItem(key,old);
  const now=Date.now.bind(Date);Date.now=()=>now()+120000;await PSSyncIDBCheck();
  return {mirror:localStorage.getItem(key),idb:(await storage.get(key))?.value};
 },{key,old,legacy});assert.deepEqual(seeded,{mirror:old,idb:legacy});
 await page.evaluate(()=>PSSync.syncNow('fixture-idp-cache-source'));
 await page.waitForFunction(({key,source})=>localStorage.getItem(key)===source,{key,source});
 await page.evaluate(()=>PSSync.syncNow('fixture-idp-cache-repeat'));
 assert.equal(await page.evaluate(async key=>(await storage.get(key))?.value,key),legacy,'legacy evidence retained');
 assert.equal(fx.db.get(WT+'|'+key).v,source);assert.equal(fx.writes.filter(w=>w.k===key).length,0,'foreign read cache never uploads');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,width,cacheUpdated:true,serverUnchanged:true,legacyRetained:true}));await context.close();
}}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
