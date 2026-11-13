import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {startFixture,openApp,WT,OUT,root,SIZES,build} from '../fixtures/team-app.mjs';

// 3.281 — items-stale-round-block 의 앞부분(실제 보류 만들기)을 그대로 쓰고, 푸는 길만 «한 번에»로.
// Actual PSItems/PSSync + IDB CAS + existing recovery dialog. The API and all
// data are isolated fixtures; no product guard, storage result, or failure is mocked.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
SIZES.itemsStale={...SIZES.desktop,engine};
const KEY='sq:vp01',SCHEDULE='process_coach_v1',CARRIERS=['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1'];
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const files=['studio/sync.js','studio/sync-items-stale.js','studio/storage.js','studio/scout.html','studio/roster-outbox.js','studio/autosave-journal.js','studio/autosave-recovery.js','studio/app.html','sw.js','studio/autosave-runtime.js','studio/autosave-merge.js','studio/support-diagnostics.js','tests/fixtures/team-app.mjs','tests/fixtures/navigation-abort.mjs','tests/browser/items-stale-round-block.mjs'];
const source=()=>Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
const beforeSource=source(),browsers={},fx=await startFixture();
const save=(name,value)=>fs.writeFileSync(path.join(OUT,'bulk-'+name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
const proof={v:2,sha:process.env.GITHUB_SHA||process.env.PS_TEST_COMMIT||null,exactCommitClaim:!!(process.env.GITHUB_SHA||process.env.PS_TEST_COMMIT),build,baselineSha:'8a42d0f4d0927eaef048d245d2f92fd4c11bd314',engine,physicalDevice:false,synthetic:true,productGuardsMocked:false,browserExecutions:1,automaticRetries:0,source:beforeSource,observations:[],passed:false};
let page,context,team,logs=[];
const schedule=fx.db.get(WT+'|'+SCHEDULE),seed=JSON.parse(schedule.v);
for(const [week,days]of Object.entries(seed.weeks))for(const [i,day]of days.entries())if(day.board?.sched==='경기')day.mid='items-stale-'+week+'-'+i;
schedule.v=JSON.stringify(seed);
async function poll(read,label,timeout=35000){
 const end=Date.now()+timeout;
 while(Date.now()<end){const v=await read();if(v)return v;await new Promise(r=>setTimeout(r,100));}
 throw Error('Synthetic condition timed out: '+label);
}
async function archives(){return page.evaluate(async()=>{
 const keys=(await storage.keys()).filter(k=>k.startsWith(PSAutoSaveJournal.PREFIX)),rows=[];
 for(const key of keys){const raw=(await storage.get(key))?.value;let doc;try{doc=JSON.parse(raw);}catch{}if(doc?.kind==='archive'&&['items-stale-device','items-stale-resolved'].includes(doc.reason))rows.push({key,raw,doc});}
 return rows;
});}
async function syncWhenIdle(reason){
 return page.evaluate(async reason=>{const until=Date.now()+30000;while(PSSync.state().kind==='busy'){if(Date.now()>until)throw Error('Actual sync did not leave busy');await new Promise(r=>setTimeout(r,25));}return PSSync.syncNow(reason);},reason);
}
async function openTeam(){
 await page.locator('[data-team-hub="1"]:visible').click();
 await page.locator('[data-team-key="players"][data-tn-grp="squad"]:visible').click();
 team=await (await page.waitForSelector('#fScout')).contentFrame();
 await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof rosterSaveRows==='function'&&typeof rosterOutbox==='function');
}
try{
 assert.equal(fs.existsSync(path.join(OUT,'results.json')),false,'immutable output required');
 assert.equal(fs.existsSync(path.join(OUT,'failure.json')),false,'failed output must not be overwritten');
 ({page,context,logs}=await openApp(fx,'itemsStale',{browsers}));
 assert.equal(context.browser().browserType().name(),engine,'the requested actual browser must execute');
 const countEvents=()=>{if(window!==top)return;window.__itemsStateEvents=0;window.addEventListener('ps-sync-state',()=>__itemsStateEvents++);};await context.addInitScript(countEvents);await page.evaluate(countEvents);
 await openTeam();
 await page.waitForFunction(()=>window.PSSync?.dataUnlocked()&&window.PSItems?.active()&&PSSync.state().kind==='ok'&&!PSSync.pending().count);
 const baseline=await poll(()=>page.evaluate(async()=>{
  const item=(await storage.get('sq:vp01'))?.value??null,main=localStorage.getItem('scout_tool_v1'),scheduled=(await storage.get('process_coach_v1'))?.value??null;
  if(!item||!main||!scheduled||PSSync.state().kind!=='ok'||PSSync.pending().count)return false;
  return {item,main,scheduled,owner:JSON.stringify([PSSync.session()?.uid,PSSync.activeWs(),localStorage.getItem('ps_cache_owner_v1'),localStorage.getItem('ps_ws_switch_epoch_v1')||''])};
 }),'normal real initial sync');
 proof.baseline={itemHash:hash(baseline.item),mainHash:hash(baseline.main),scheduleHash:hash(baseline.scheduled),ownerHash:hash(baseline.owner)};save('baseline.json',proof.baseline);
 const queued=await page.evaluate(async({key,baselineItem})=>{
  const original=storage.get;let finishRead;const readDone=new Promise(resolve=>{finishRead=resolve;});let capture=false,readCount=0;
  window.__itemsStaleDiagnostics=[];
  window.addEventListener('ps-sync-diagnostic',e=>__itemsStaleDiagnostics.push({stage:e.detail?.stage,code:e.detail?.code,name:e.detail?.name}));
  storage.get=function(k){const observe=capture&&k===key,work=original.apply(this,arguments);return observe?Promise.resolve(work).then(v=>{readCount++;finishRead(v?.value??null);return v;}):work;};
  try{
   const doc=JSON.parse(localStorage.getItem('scout_tool_v1')),edited=JSON.parse(JSON.stringify(doc.players)),p=edited.find(p=>p.id==='vp01');if(!p)throw Error('Synthetic target absent');p.memo='SYNTHETIC QUEUED A';
   const scout=document.getElementById('fScout').contentWindow;
   // Persist actual immutable intent before the ordinary queued write, exactly
   // as the live roster save coordinator does. The receipt remains byte exact.
   const receipt=scout.rosterOutbox().stage({players:edited,basePlayers:doc.players,changedIds:['vp01'],deletedIds:[]});
   window.__itemsStaleReceipt=receipt;
   capture=true;window.__itemsStaleQueued=PSItems.write(edited,{intent:receipt});capture=false;
   const actualPreimage=await readDone;if(actualPreimage!==baselineItem)throw Error('Queued job did not capture actual baseline');
   const other=JSON.parse(actualPreimage);other.memo='SYNTHETIC OTHER WRITER B';const otherRaw=JSON.stringify(other);
   const changed=await storage.replaceIfValue(key,actualPreimage,otherRaw),stored=(await original.call(storage,key))?.value??null;
   return {readCount,actualPreimage,otherRaw,changed,stored,receipt,queuedMemo:p.memo};
  }finally{capture=false;storage.get=original;}
 },{key:KEY,baselineItem:baseline.item});
 proof.queued={readCount:queued.readCount,expectedHash:hash(queued.actualPreimage),otherWriterHash:hash(queued.otherRaw),actualCAS:queued.changed,otherStoredHash:hash(queued.stored),intent:queued.receipt};
 assert.equal(queued.changed,true);assert.equal(queued.stored,queued.otherRaw);
 const first=await page.evaluate(async()=>{let failure;try{await PSItems.flush();failure={ok:true};}catch(e){failure={ok:false,code:e.psCode,stage:e.psStage,message:e.message};}return {failure,queuedResult:await __itemsStaleQueued,raw:(await storage.get('sq:vp01'))?.value??null,diagnostics:__itemsStaleDiagnostics.slice()};});
 save('first-protected-write.json',first);assert.equal(first.failure.ok,false);assert.equal(first.failure.code,'sync_local_changed');assert.equal(first.failure.stage,'items_write_stale_job');assert.equal(first.queuedResult,null);assert.equal(first.raw,queued.otherRaw);
 const remote=JSON.parse(schedule.v),training=Object.values(remote.weeks).flatMap(days=>days.flatMap(d=>d.trainings||[]))[0];assert.ok(training);training.note='SYNTHETIC UNRELATED REMOTE UPDATE';remote.scheduleRev=(remote.scheduleRev||0)+1;schedule.v=JSON.stringify(remote);schedule.cupd=Math.max(Date.now(),schedule.cupd+1);
 let lastDiagCount;
 for(let n=1;n<=2;n++){
  fx.setStep('no-input-round-'+n);const callStart=fx.calls.length,writeStart=fx.writes.length;
  const round=await page.evaluate(async n=>{const result=await PSSync.syncNow('synthetic-items-stale-no-input-'+n);return {result,state:PSSync.state(),pending:PSSync.pending().count,rosterReady:PSSync.rosterReady(PSSync.activeWs()),raw:(await storage.get('sq:vp01'))?.value??null,scheduled:(await storage.get('process_coach_v1'))?.value??null,owner:JSON.stringify([PSSync.session()?.uid,PSSync.activeWs(),localStorage.getItem('ps_cache_owner_v1'),localStorage.getItem('ps_ws_switch_epoch_v1')||'']),diagnostics:__itemsStaleDiagnostics.slice()};},n);
  const kvReads=fx.calls.slice(callStart).filter(c=>c.m==='GET'&&(/\/ps_kv$/.test(c.p)||/ps_kv_meta/.test(c.p))).map(c=>({method:c.m,path:c.p})),writes=fx.writes.slice(writeStart).map(w=>({method:w.m,key:w.k}));
  const observation={label:'no-input-round-'+n,...round,kvReads,writes};proof.observations.push(observation);save('round-'+n+'.json',observation);
  assert.equal(round.result.error,undefined);assert.equal(round.raw,queued.otherRaw);assert.equal(round.owner,baseline.owner);assert.ok(round.scheduled.includes('SYNTHETIC UNRELATED REMOTE UPDATE'));assert.ok(kvReads.length>0);assert.ok(round.pending>=1);assert.notEqual(round.state.kind,'ok');assert.equal(round.rosterReady,false);
  for(const k of [KEY,...CARRIERS])assert.ok(round.result.held?.includes(k),'held '+k);
  assert.ok(writes.every(w=>w.key!==KEY&&!CARRIERS.includes(w.key)),'quarantined row and carrier are never uploaded or ACKed');
  const staleCount=round.diagnostics.filter(x=>x.stage==='items-write'&&x.code==='sync_local_changed').length;
  if(n===2)assert.equal(staleCount,lastDiagCount,'unchanged idle round must not retry the same stale job');lastDiagCount=staleCount;
 }
 const kept=(await archives()).filter(r=>r.doc.reason==='items-stale-device');assert.equal(kept.length,1);const original=kept[0],payload=JSON.parse(original.doc.localRaw),comparison=JSON.parse(original.doc.remoteRaw);
 assert.equal(payload.authored.vp01,JSON.stringify({...JSON.parse(baseline.item),memo:'SYNTHETIC QUEUED A'}));assert.equal(payload.expected.vp01,baseline.item);assert.equal(comparison.provenance,'device-idb');assert.equal(comparison.values.vp01,queued.otherRaw);assert.deepEqual(payload.intent,queued.receipt);
 assert.equal(await page.evaluate(async()=>{try{await PSItems.flush();return false;}catch(e){return e.psStage==='items_stale_review';}}),true);
 assert.equal(await page.evaluate(async()=>(await PSItems.readAll()).pending),true,'row projection remains blocked while held');
 // Mount the actual failed scout retry closure. Its fresh request carries the
 // same durable A sources; the UI choice must settle this cached path as well.
 const mounted=await team.evaluate(receipt=>{const accepted=rosterSaveRows([],{},receipt);return {accepted};},queued.receipt);assert.equal(mounted.accepted,true);
 /* 3.285 — 보관(journal + 기기 묶음 영수증)에 있는 행을 다시 올리면 «실패»가 아니라 held 로 끝난다(items-stale-held): 영수증은 ACK 되지 않고 상태는 여전히 확인 대기 */
 await team.waitForFunction(()=>!teamSaves.hasPending());
 assert.equal(await team.evaluate(()=>teamSaves.hasFailed('sq:vp01')),false,'보관된 영수증을 다시 올린 것은 실패가 아니다(3.285)');
 assert.equal(await team.evaluate(()=>rosterOutbox().pending()),true,'영수증은 그대로(고른 뒤 settle)');
 await page.screenshot({path:path.join(OUT,engine+'-stale-job-review.png'),animations:'disabled'});
 /* 3.281 — 한 번에 풀기: 알림 띠 «지금 정리» → «보관된 변경» 창의 «모두 해제». 항목마다 원래 확인 길을 지나고, 지금 기기 사본은 그대로 · 원문도 그대로. */
 const nudge=page.locator('#psStaleNudge');await nudge.waitFor({state:'visible',timeout:20000});
 assert.match(await nudge.locator('.sn-t').innerText(),/선수 입력 \d+건이 확인을 기다려요/);
 await page.screenshot({path:path.join(OUT,engine+'-bulk-1-nudge.png'),animations:'disabled'});
 await nudge.locator('.sn-go').click();
 const dialog=page.locator('#psAutosaveRecoveryDialog');const all=dialog.locator('[data-psar-action="resolve-all-items"]');await all.waitFor();
 assert.match(await all.innerText(),/선수 입력 보류 \d+건 모두 해제/);
 await page.screenshot({path:path.join(OUT,engine+'-bulk-2-dialog.png'),animations:'disabled'});
 await all.click();await dialog.getByText(/보류 \d+건을 모두 해제했습니다/).waitFor({timeout:30000});
 await page.screenshot({path:path.join(OUT,engine+'-bulk-3-done.png'),animations:'disabled'});
 assert.ok((await archives()).filter(r=>r.doc.reason==='items-stale-resolved').length>=1,'해제 표식이 남는다');
 assert.equal((await archives()).find(r=>r.key===original.key).raw,original.raw,'보관된 원문은 그대로');
 assert.equal(await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value),queued.otherRaw,'지금 기기 사본을 유지');
 /* 배경 회차가 이미 걸려 있던 재시도를 새 보류로 보관할 수 있다 — 남았으면 같은 단추로 다시 */
 for(let i=0;i<5;i++){
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.waitForTimeout(800);
  if(await page.evaluate(()=>PSSync.state().reason!=='items_stale_review'))break;
  await page.evaluate(()=>PSAutosaveRecovery.open());const again=dialog.locator('[data-psar-action="resolve-all-items"]');
  await dialog.locator('.psar-status').waitFor();await page.waitForTimeout(500);
  if(await again.count()){await again.click();await dialog.getByText(/보류 \d+건을/).waitFor({timeout:30000});}
 }
 await poll(()=>page.evaluate(()=>PSSync.state().reason!=='items_stale_review'),'보류 상태가 풀린다');
 await poll(()=>page.evaluate(()=>{const n=document.getElementById('psStaleNudge');return !n||n.hidden;}),'띠가 걷힌다');
 assert.equal(await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value),queued.otherRaw,'끝난 뒤에도 기기 사본 그대로');
 assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
 console.log(JSON.stringify({passed:true,engine,build,bulk:true}));
}catch(error){
 proof.error={name:error.name,message:error.message,stack:error.stack};proof.syntheticServer={current:fx.db.get(WT+'|'+KEY),calls:fx.calls,writes:fx.writes};proof.sourceAfter=source();proof.logs=logs;if(page)proof.failureArchives=await archives().catch(e=>({error:e.message}));
 if(page)proof.failureState=await page.evaluate(async()=>({state:window.PSSync?.state(),pending:window.PSSync?.pending(),raw:(await window.storage?.get('sq:vp01'))?.value,main:localStorage.getItem('scout_tool_v1'),outbox:Object.entries(localStorage).filter(([k])=>k.startsWith('ps_roster_pending')),ui:document.getElementById('psAutosaveRecoveryDialog')?.textContent})).catch(e=>({error:e.message}));
 if(team)proof.teamFailure=await team.evaluate(()=>({scopes:PSSaveState.snapshot().scopes,pending:psHasPending(),scoutBootPending,scoutReadOnlyLoad,dataMemo:data.players.find(p=>p.id==='vp01')?.memo})).catch(e=>({error:e.message}));
 save('failure.json',proof);if(page)await page.screenshot({path:path.join(OUT,engine+'-failure.png')}).catch(()=>{});throw error;
}finally{if(context)await context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();}
