import assert from 'node:assert/strict';
import {startFixture,openApp,WT,WP} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},fx=await startFixture();
const init={fn:()=>{
 const set=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){
   const mode=localStorage.getItem('qa_guard_quota'),key=localStorage.getItem('qa_guard_key')||'ps_ws_switch_guard_v1';
   if(this===window.localStorage&&k===key&&(mode==='always'||(mode==='duplicate'&&localStorage.getItem('cs_notes_v1')!==null))){
     window.__qaGuardFailures=(window.__qaGuardFailures||0)+1;
     set.call(sessionStorage,'qa_guard_failures',String(window.__qaGuardFailures));
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
  // Initial roster migration adds default criteria/position labels. Every original
  // player field must survive; the legacy envelope need not stay byte-identical.
  const before=JSON.parse(fx.db.get(WT+'|scout_tool_v1').v).players;
  function rosterIntact(){
   const after=JSON.parse(fx.db.get(WT+'|scout_tool_v1').v).players;
   assert.equal(after.length,before.length);
   for(const player of before){const found=after.find(p=>p.id===player.id);assert.ok(found);for(const key of Object.keys(player))assert.deepEqual(found[key],player[key],player.id+' '+key);}
  }
  if(mode==='always'){
   const stopped=await page.evaluate(async wid=>await PSSync.switchWorkspace(wid),WP);
   assert.equal(stopped.reason,'preswitch storage');
   const state=await page.evaluate(async()=>({ws:PSSync.activeWs(),raw:(await storage.get('cs_notes_v1')).value,
    guard:localStorage.getItem('ps_ws_switch_guard_v1'),failures:window.__qaGuardFailures,probe:window.__qaGuardProbe,
    last:localStorage.getItem('ps_last_switch_err')}));
   assert.equal(state.ws,WT);assert.equal(state.guard,null);assert.equal(state.raw,raw);assert.equal(state.probe,true,'no misleading reload');
   assert.equal(state.failures,2,'only one cleanup retry');assert.match(state.last,/preswitch storage/);
   rosterIntact();
   await page.evaluate(()=>localStorage.removeItem('qa_guard_quota'));
  }
  await page.evaluate(wid=>{PSSync.switchWorkspace(wid);},WP);
  await page.waitForFunction(wid=>window.PSSync&&PSSync.activeWs()===wid&&PSSync.dataUnlocked(),WP,{timeout:45000}).catch(async error=>{
   console.error(JSON.stringify({engine,mode,diagnostic:await page.evaluate(()=>({ws:PSSync.activeWs(),state:PSSync.state(),last:localStorage.getItem('ps_last_switch_err'),guard:localStorage.getItem('ps_ws_switch_guard_v1'),notes:localStorage.getItem('cs_notes_v1')!==null,failures:window.__qaGuardFailures,flush:window.__psFlushErrors})),logs:logs.slice(-12)}));throw error;
  });
  rosterIntact();
  assert.equal(await page.evaluate(()=>Number(sessionStorage.getItem('qa_guard_failures'))),mode==='duplicate'?1:2,'quota injection must actually run');
  assert.equal(fx.db.get(WP+'|cs_notes_v1').v,raw,'personal notes saved exactly in their own workspace');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,mode,passed:true}));
  await context.close();
 }
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
