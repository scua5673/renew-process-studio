import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {startFixture,openApp,WT,OUT,root,SIZES,build} from '../fixtures/team-app.mjs';

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
const save=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
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
 await team.waitForFunction(()=>teamSaves.hasFailed('sq:vp01'));
 await page.screenshot({path:path.join(OUT,engine+'-stale-job-review.png'),animations:'disabled'});
 await page.evaluate(()=>PSAutosaveRecovery.open());const dialog=page.locator('#psAutosaveRecoveryDialog');await dialog.locator('[data-psar-id="'+original.doc.id+'"]').click();
 await dialog.locator('textarea[aria-label="보관된 선수 입력"]').waitFor();assert.equal(await dialog.locator('textarea[aria-label="보관된 선수 입력"]').inputValue(),original.doc.localRaw);assert.equal(await dialog.locator('textarea[aria-label="당시 기기의 다른 사본"]').inputValue(),original.doc.remoteRaw);
 await dialog.locator('[data-psar-action="prepare-items"]').click();await dialog.locator('textarea[aria-label="지금 유지할 기기 사본"]').waitFor();assert.equal(JSON.parse(await dialog.locator('textarea[aria-label="지금 유지할 기기 사본"]').inputValue()).values.vp01,queued.otherRaw);
 await dialog.getByRole('button',{name:'취소',exact:true}).click();assert.equal((await archives()).filter(r=>r.doc.reason==='items-stale-resolved').length,0);assert.equal((await archives()).find(r=>r.key===original.key).raw,original.raw);assert.equal(await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value),queued.otherRaw);
 await dialog.locator('[data-psar-action="prepare-items"]').click();await dialog.locator('[data-psar-action="resolve-items"]').waitFor();await dialog.locator('[data-psar-action="resolve-items"]').click();
 await dialog.getByText('현재 기기 사본을 유지하고 이 입력의 보류를 해제했습니다. 보관된 원문은 그대로 남아 있습니다.',{exact:true}).waitFor();
 const markers=(await archives()).filter(r=>r.doc.reason==='items-stale-resolved');assert.equal(markers.length,1);const choice=JSON.parse(markers[0].doc.localRaw),settled=choice.settlement;
 // A real background round may archive the already-mounted failed retry as a
 // second immutable request while the first row's UI is open. Every such row
 // needs its own actual explicit choice; one choice never clears a new hold.
 const reviewed=[original],settlements=[settled];
 for(let i=0;i<4;i++){
  const all=await archives(),done=new Set(all.filter(r=>r.doc.reason==='items-stale-resolved').map(r=>JSON.parse(r.doc.localRaw).archiveId)),next=all.find(r=>r.doc.reason==='items-stale-device'&&!done.has(r.doc.id));
  if(!next)break;
  assert.deepEqual(JSON.parse(next.doc.localRaw).intent,queued.receipt,'only the same actual mounted A source is reviewed here');
  assert.equal(JSON.parse(next.doc.localRaw).authored.vp01,payload.authored.vp01);
  reviewed.push(next);await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.evaluate(()=>PSAutosaveRecovery.open());
  await dialog.locator('[data-psar-id="'+next.doc.id+'"]').click();await dialog.locator('[data-psar-action="prepare-items"]').click();await dialog.locator('[data-psar-action="resolve-items"]').waitFor();
  assert.equal(JSON.parse(await dialog.locator('textarea[aria-label="지금 유지할 기기 사본"]').inputValue()).values.vp01,queued.otherRaw);
  await dialog.locator('[data-psar-action="resolve-items"]').click();await dialog.getByText('현재 기기 사본을 유지하고 이 입력의 보류를 해제했습니다. 보관된 원문은 그대로 남아 있습니다.',{exact:true}).waitFor();
  const marker=(await archives()).find(r=>r.doc.reason==='items-stale-resolved'&&JSON.parse(r.doc.localRaw).archiveId===next.doc.id);assert.ok(marker);settlements.push(JSON.parse(marker.doc.localRaw).settlement);
 }
 proof.explicitReviewedArchives=reviewed.map(r=>({id:r.doc.id,sha256:hash(r.raw)}));
 assert.equal((await archives()).find(r=>r.key===original.key).raw,original.raw);assert.equal(await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value),queued.otherRaw);
 const mountedRetry=await team.evaluate(async()=>{const before=(await parent.storage.get('sq:vp01'))?.value;const result=await psFlushPendingReady();return {result,failed:teamSaves.hasFailed('sq:vp01'),raw:(await parent.storage.get('sq:vp01'))?.value,before,pending:rosterOutbox().pending()};});
 assert.equal(mountedRetry.result,true);assert.equal(mountedRetry.failed,false);assert.equal(mountedRetry.raw,queued.otherRaw);assert.equal(mountedRetry.pending,false);proof.mountedRetry={...mountedRetry,rawHash:hash(mountedRetry.raw)};save('resolved.json',{original,choice,mountedRetry});
 await dialog.getByRole('button',{name:'닫기',exact:true}).click();
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PSSync?.dataUnlocked()&&window.PSItems?.active());
 await page.evaluate(()=>{window.__itemsWriteReadyCalls=[];const native=PSItems.writeReady;PSItems.writeReady=function(players,opts){__itemsWriteReadyCalls.push({players:JSON.parse(JSON.stringify(players)),intent:opts?.intent??null});return native.apply(this,arguments);};});
 await openTeam();
 const resumed=await team.evaluate(()=>({resumed:rosterResumeRows(true),pending:rosterOutbox().pending()}));assert.equal(resumed.resumed,false);assert.equal(resumed.pending,false);
 const reloadFlush=await page.evaluate(async()=>{await PSItems.flush();return {state:PSSync.state(),pending:PSSync.pending().count,calls:__itemsWriteReadyCalls};});assert.ok(reloadFlush.calls.every(c=>!c.players.some(p=>p.id==='vp01'&&p.memo==='SYNTHETIC QUEUED A')),'settled durable A must never replay through mounted scout resume');
 const chosenUpload=await syncWhenIdle('synthetic-resolved-current-device');proof.reload={resumed,flush:reloadFlush,chosenUpload};save('reload-current-device.json',proof.reload);
 await poll(async()=>fx.db.get(WT+'|'+KEY)?.v===queued.otherRaw,'chosen B actual server ACK');
 // A direct storage CAS deliberately emits no ps_items_rev. Observe the actual
 // accepted server version and let the ordinary ps_items_rev event project it.
 const chosenReadback=await syncWhenIdle('synthetic-resolved-server-readback');proof.reload.chosenReadback=chosenReadback;
 assert.equal(chosenReadback.skip,undefined);assert.equal(chosenReadback.error,undefined);
 const confirmed=await poll(async()=>{const r=await page.evaluate(()=>PSItems.readAll());return r&&!r.pending&&r.confirmed[KEY]===1&&r.players.find(p=>p.id==='vp01')?.memo==='SYNTHETIC OTHER WRITER B'?r:false;},'actual confirmed B projection receipt settles');assert.equal(confirmed.pending,false);assert.equal(confirmed.confirmed[KEY],1);assert.equal(confirmed.players.find(p=>p.id==='vp01').memo,'SYNTHETIC OTHER WRITER B');
 proof.reload.currentDeviceServerHash=hash(fx.db.get(WT+'|'+KEY).v);proof.reload.currentDeviceConfirmed=true;
 proof.reload.beforeProjection=await page.evaluate(()=>({rev:localStorage.getItem('ps_items_rev'),mainMemo:JSON.parse(localStorage.getItem('scout_tool_v1')||'null')?.players?.find(p=>p.id==='vp01')?.memo??null,state:PSSync.state()}));
 proof.reload.childBeforeProjection=await team.evaluate(()=>({memo:data.players.find(p=>p.id==='vp01')?.memo??null,bootPending:scoutBootPending,loaded:scoutDataLoaded}));
 save('reload-after-ack.json',proof.reload);
 await poll(()=>page.evaluate(async()=>{const raw=(await storage.get('sq:vp01'))?.value,main=JSON.parse(localStorage.getItem('scout_tool_v1')||'null');return raw&&JSON.parse(raw).memo==='SYNTHETIC OTHER WRITER B'&&main?.players?.find(p=>p.id==='vp01')?.memo==='SYNTHETIC OTHER WRITER B';}),'chosen B actual guarded projection after ACK');
 assert.equal((await archives()).find(r=>r.key===original.key).raw,original.raw);
 const newInput=await team.evaluate(()=>{const p=data.players.find(p=>p.id==='vp01');if(!p)throw Error('Synthetic new-input player absent');p.memo='SYNTHETIC NEW C';return save({skipTargets:true});});assert.equal(newInput,true);
 await team.evaluate(()=>psFlushPendingReady());proof.newInputSync=await syncWhenIdle('synthetic-new-c');
 const completed=await poll(async()=>{const actual=await page.evaluate(async()=>({raw:(await storage.get('sq:vp01'))?.value,main:localStorage.getItem('scout_tool_v1'),state:PSSync.state(),pending:PSSync.pending().count})),server=fx.db.get(WT+'|'+KEY)?.v;if(!actual.raw||JSON.parse(actual.raw).memo!=='SYNTHETIC NEW C'||server!==actual.raw||actual.pending)return false;return {...actual,server};},'real new C IDB and server receipt');
 // A real focused DOM field must retain its input while a confirmed row arrives.
 // The ordinary focusout listener must apply the row after the user blurs it.
 await team.evaluate(()=>{const box=document.createElement('div');box.id='items-stale-focus-fixture';box.style.cssText='position:fixed;bottom:20px;left:150px;z-index:999999;background:white;padding:8px;display:flex;gap:8px';const input=document.createElement('input');input.id='items-stale-focus-input';input.setAttribute('aria-label','Synthetic projection focus');const done=document.createElement('button');done.id='items-stale-focus-done';done.textContent='Synthetic focus done';box.append(input,done);document.body.appendChild(box);});
 await team.locator('#items-stale-focus-input').fill('SYNTHETIC FOCUS TEXT MUST SURVIVE');
 const remoteTyping=fx.db.get(WT+'|'+KEY),incoming=JSON.parse(remoteTyping.v);incoming.memo='SYNTHETIC REMOTE D WHILE TYPING';remoteTyping.v=JSON.stringify(incoming);remoteTyping.cupd=Math.max(Date.now(),remoteTyping.cupd+1);
 const typingSync=await syncWhenIdle('synthetic-confirmed-row-while-typing');assert.equal(typingSync.error,undefined);assert.equal(typingSync.skip,undefined);
 await poll(()=>page.evaluate(async()=>JSON.parse((await storage.get('sq:vp01'))?.value||'null')?.memo==='SYNTHETIC REMOTE D WHILE TYPING'),'real D row pull');
 const typed=await team.evaluate(()=>({value:document.getElementById('items-stale-focus-input').value,focused:document.activeElement?.id,memo:data.players.find(p=>p.id==='vp01')?.memo,stale:window.__teamStale||0}));
 assert.equal(typed.value,'SYNTHETIC FOCUS TEXT MUST SURVIVE');assert.equal(typed.focused,'items-stale-focus-input');assert.equal(typed.memo,'SYNTHETIC NEW C','the focused frame must defer its projection');assert.ok(typed.stale>0);
 await team.locator('#items-stale-focus-done').click();
 await poll(()=>team.evaluate(()=>data.players.find(p=>p.id==='vp01')?.memo==='SYNTHETIC REMOTE D WHILE TYPING'&&JSON.parse(localStorage.getItem('scout_tool_v1')||'null')?.players?.find(p=>p.id==='vp01')?.memo==='SYNTHETIC REMOTE D WHILE TYPING'),'actual blur resumes confirmed projection');
 proof.typingProjection={typed,after:await team.evaluate(()=>({value:document.getElementById('items-stale-focus-input').value,memo:data.players.find(p=>p.id==='vp01')?.memo,stale:window.__teamStale||0})),actualBlur:true,internalApplyInvoked:false};
 await team.evaluate(()=>document.getElementById('items-stale-focus-fixture').remove());
 await team.evaluate(()=>psFlushPendingReady());proof.finalProjectionSync=await syncWhenIdle('synthetic-projected-copies-final');assert.equal(proof.finalProjectionSync.error,undefined);
 const retained=await page.evaluate(proofs=>proofs.every(proof=>proof.batches.concat([{key:proof.key,raw:proof.raw}]).every(x=>localStorage.getItem(x.key)===x.raw)),settlements);assert.equal(retained,true,'normal C ACK cleanup must retain both original durable A batch and settlement proof');assert.equal((await archives()).find(r=>r.key===original.key).raw,original.raw);
 assert.equal(await team.evaluate(()=>rosterOutbox().pending()),false);assert.equal((await archives()).filter(r=>r.doc.reason==='items-stale-device').length,reviewed.length,'no cached or reloaded A re-quarantine');for(const r of reviewed)assert.equal((await archives()).find(x=>x.key===r.key)?.raw,r.raw);
 await poll(()=>page.evaluate(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count),'normal final completion before bounded observer check');
 const stableEvents=await page.evaluate(()=>window.__itemsStateEvents||0);await page.waitForTimeout(100);const nextEvents=await page.evaluate(()=>window.__itemsStateEvents||0);assert.ok(nextEvents-stableEvents<=3,'unchanged native state notifications must settle, never a hot loop');proof.eventBound={windowMs:100,before:stableEvents,after:nextEvents,delta:nextEvents-stableEvents};
 const afterSource=source();assert.deepEqual(afterSource,beforeSource);const pageErrors=logs.filter(x=>x.type==='pageerror');assert.deepEqual(pageErrors,[]);await page.screenshot({path:path.join(OUT,engine+'-review-resolved-new-c.png'),animations:'disabled'});
 Object.assign(proof,{sourceAfter:afterSource,sourceUnchanged:true,realIDBCAS:true,firstStaleProtected:true,unrelatedPullContinues:true,quarantineTruthyPending:true,unchangedJobRetryStopped:true,originalArchivePreserved:true,uiCancelPreservesHold:true,explicitCurrentDeviceChoice:true,mountedRetryNoReplay:true,reloadScoutResumeNoReplay:true,retainedOriginalIntent:true,newSemanticCNormalSave:true,completed:{itemHash:hash(completed.raw),serverHash:hash(completed.server),mainHash:hash(completed.main),pending:completed.pending,state:completed.state},physicalCloseClaim:false,actualProductionCauseClaim:false,pageErrors,passed:true});
 save('results.json',proof);console.log(JSON.stringify({passed:true,engine,build,synthetic:true,sourceUnchanged:true,output:OUT}));
}catch(error){
 proof.error={name:error.name,message:error.message,stack:error.stack};proof.syntheticServer={current:fx.db.get(WT+'|'+KEY),calls:fx.calls,writes:fx.writes};proof.sourceAfter=source();proof.logs=logs;if(page)proof.failureArchives=await archives().catch(e=>({error:e.message}));
 if(page)proof.failureState=await page.evaluate(async()=>({state:window.PSSync?.state(),pending:window.PSSync?.pending(),raw:(await window.storage?.get('sq:vp01'))?.value,main:localStorage.getItem('scout_tool_v1'),outbox:Object.entries(localStorage).filter(([k])=>k.startsWith('ps_roster_pending')),ui:document.getElementById('psAutosaveRecoveryDialog')?.textContent})).catch(e=>({error:e.message}));
 if(team)proof.teamFailure=await team.evaluate(()=>({scopes:PSSaveState.snapshot().scopes,pending:psHasPending(),scoutBootPending,scoutReadOnlyLoad,dataMemo:data.players.find(p=>p.id==='vp01')?.memo})).catch(e=>({error:e.message}));
 save('failure.json',proof);if(page)await page.screenshot({path:path.join(OUT,engine+'-failure.png')}).catch(()=>{});throw error;
}finally{if(context)await context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();}
