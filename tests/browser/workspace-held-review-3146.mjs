import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT,WP} from '../fixtures/team-app.mjs';
// A valid document beyond the automatic merge limit needs an explicit choice.
// Real sync/hold/transition/UI code, isolated loopback transport and fresh storage.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={},key='cs_meet_sit_v1';
const base=JSON.stringify({title:'base',values:[]}),local=JSON.stringify({title:'local edit',values:[]});
const remote=JSON.stringify({title:'server edit',values:Array(100001).fill(1)});
fx.db.set(WT+'|'+key,{workspace_id:WT,k:key,v:base,cupd:1000,updated_by:A});
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  await page.evaluate(()=>psFlushAllPendingReady());
  const release=fx.holdKvPull(WT);
  await page.evaluate(async({key,local})=>{await storage.set(key,local);}, {key,local});
  fx.db.set(WT+'|'+key,{workspace_id:WT,k:key,v:remote,cupd:2000,updated_by:A});
  release();
  const stopped=await page.evaluate(async wid=>await PSSync.switchWorkspace(wid),WP);
  assert.equal(stopped?.cancelled,1);
  await page.getByText('저장할 내용 선택',{exact:true}).waitFor({timeout:5000});
  const state=await page.evaluate(async({key,WT})=>({active:PSSync.activeWs(),local:(await storage.get(key)).value,guard:localStorage.getItem('ps_ws_switch_guard_v1'),stash:JSON.parse((await storage.get('ps_ws_stash_'+WT)).value).data[key]}),{key,WT});
  assert.equal(state.active,WT);assert.equal(state.local,local);assert.equal(state.stash,local);assert.equal(state.guard,null);
  assert.equal(fx.db.get(WT+'|'+key).v,remote,'before the choice neither original is overwritten');
  await page.locator('[data-dr][data-keep="0"]').click();
  await page.waitForFunction(()=>!PSSync.hold.list().length,null,{timeout:45000});
  assert.equal(await page.evaluate(async key=>(await storage.get(key)).value,key),remote);
  assert.equal(await page.evaluate(()=>PSSync.activeWs()),WT,'choice alone does not switch teams');
  await page.evaluate(wid=>{PSSync.switchWorkspace(wid);},WP);
  await page.waitForFunction(wid=>window.PSSync&&PSSync.activeWs()===wid&&PSSync.dataUnlocked(),WP,{timeout:45000});
  assert.equal(fx.db.get(WT+'|'+key).v,remote);
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,passed:true,cases:['held-switch-preserves-both-originals','review-after-guard-release','exact-server-choice','confirmed-switch']}));
  await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
