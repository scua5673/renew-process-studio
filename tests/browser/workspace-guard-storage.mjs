import assert from 'node:assert/strict';
import {startFixture,openApp,WT,WP} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},fx=await startFixture();
const init={fn:()=>{
 const set=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){
   const mode=localStorage.getItem('qa_guard_quota'),key=localStorage.getItem('qa_guard_key')||'ps_ws_switch_guard_v1';
   if(this===window.localStorage&&k===key&&(mode==='always'||(mode==='duplicate'&&localStorage.getItem('cs_notes_v1')!==null))){
     window.__qaGuardFailures=(window.__qaGuardFailures||0)+1;
     throw new DOMException('The quota has been exceeded.','QuotaExceededError');
   }
   return set.call(this,k,v);
 };
}};
try{
 for(const mode of ['duplicate','always']){
  const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,init});
  await page.evaluate(()=>psFlushAllPendingReady());
  const raw=JSON.stringify({notes:[{id:'qa-note',body:'synthetic note '.repeat(20000)}]});
  await page.evaluate(async({raw,mode})=>{
   await storage.set('cs_notes_v1',raw);localStorage.setItem('cs_notes_v1',raw);
   localStorage.setItem('qa_guard_key',mode==='always'?'ps_ws_switch_epoch_v1':'ps_ws_switch_guard_v1');
   localStorage.setItem('qa_guard_quota',mode);window.__qaGuardProbe=true;
  },{raw,mode});
  const before=fx.db.get(WT+'|scout_tool_v1').v;
  if(mode==='always'){
   const stopped=await page.evaluate(async wid=>await PSSync.switchWorkspace(wid),WP);
   assert.equal(stopped.reason,'preswitch storage');
   const state=await page.evaluate(async()=>({ws:PSSync.activeWs(),raw:(await storage.get('cs_notes_v1')).value,
    guard:localStorage.getItem('ps_ws_switch_guard_v1'),failures:window.__qaGuardFailures,probe:window.__qaGuardProbe,
    last:localStorage.getItem('ps_last_switch_err')}));
   assert.equal(state.ws,WT);assert.equal(state.guard,null);assert.equal(state.raw,raw);assert.equal(state.probe,true,'no misleading reload');
   assert.equal(state.failures,2,'only one cleanup retry');assert.match(state.last,/preswitch storage/);
   assert.equal(fx.db.get(WT+'|scout_tool_v1').v,before);
   await page.evaluate(()=>localStorage.removeItem('qa_guard_quota'));
  }
  await page.evaluate(wid=>{PSSync.switchWorkspace(wid);},WP);
  await page.waitForFunction(wid=>window.PSSync&&PSSync.activeWs()===wid&&PSSync.dataUnlocked(),WP,{timeout:45000});
  assert.equal(fx.db.get(WT+'|scout_tool_v1').v,before,'source roster stays intact');
  assert.equal(fx.db.get(WP+'|cs_notes_v1').v,raw,'personal notes saved exactly in their own workspace');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,mode,passed:true}));
  await context.close();
 }
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
