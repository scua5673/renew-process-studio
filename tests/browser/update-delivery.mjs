import assert from 'node:assert/strict';
import {startFixture,openApp,guestReady} from '../fixtures/team-app.mjs';
const fx=await startFixture(),browsers={};
try {
  const {page}=await openApp(fx,process.env.PS_BROWSER_ENGINE==='webkit'?'ipad':'desktop',{browsers,guest:true});
  await guestReady(page);
  const flush=()=>page.evaluate(async()=>{try{await psFlushAllPendingReady();return {ready:true};}catch(e){return {ready:false,frame:e.psFrame,code:e.psCode};}});
  assert.deepEqual(await flush(),{ready:true},'untouched guest must not wait for a nonexistent roster owner');
  let board=await (await page.waitForSelector('#fBoard')).contentFrame();
  await board.waitForFunction(()=>window.__boardRestoreDone===true);
  await board.evaluate(()=>{pushUndo();loadSnap({players:[{id:'guest-update',team:'blue',num:'77',x:500,y:300}],equipment:[],drawings:[],ball:null,pitchN:1});renderTokens();boardSaveLive();window.originalUpdateSet=storage.set;storage.set=async()=>{throw Error('synthetic disk failure');};});
  const failed=await flush();assert.equal(failed.ready,false);assert.equal(failed.frame,'fBoard');assert.equal(failed.code,'board_guest_pending');
  assert.deepEqual(await board.evaluate(()=>state.players.map(p=>p.num)),['77']);
  await board.evaluate(()=>{storage.set=window.originalUpdateSet;});
  await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===page.mainFrame()}),page.evaluate(()=>{psAutoReloadWhenSafe(true);__psForceReload(true);})]);
  await guestReady(page);board=await (await page.waitForSelector('#fBoard')).contentFrame();await board.waitForFunction(()=>window.__boardRestoreDone===true);
  assert.deepEqual(await board.evaluate(()=>state.players.map(p=>p.num)),['77'],'update barrier saves and restores guest work');
  assert.equal(fx.writes.length,0,'guest work never goes to the server');
  console.log(JSON.stringify({passed:true,engine:process.env.PS_BROWSER_ENGINE||'chromium',cases:['untouched-guest','guest-save-failure-preserves-work','retry-saves-before-reload','guest-restore']}));
} finally {for(const b of Object.values(browsers))await b.close();await fx.close();}
