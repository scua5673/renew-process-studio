import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,WT,OUT,SIZES} from '../fixtures/team-app.mjs';

// 3.284 — 보관된 선수 행(journal items-stale-device + 기기 묶음 영수증)이 «새 판 적용 · 화면 떠나기 전 저장 확인»(scout.html psFlushPendingReady →
// app.html psFlushAllPendingReady)을 영영 막던 길(운영 기록 flush_fail:fScout:store_ready.sync_local_changed:sq:<id> 46건 · update_deferred 6분마다).
// 실제 PSItems/PSSync + IDB CAS + 실제 기기 묶음. 보관된 행은 items-stale-round-block 과 같은 방법으로 만든다(제품 보호 장치를 흉내 내지 않는다).
// 고치기 전(3.281): 다시 올린 행이 teamSaves 에 «실패»로 남고(재시도 폐쇄가 before() 에서 매번 fenced), psHasPending 이 참(묶음 미ACK) → match_pending_left.
// 고친 뒤: 그 행은 {held:true} 로 끝나 저장 확인이 통과하고, 동기화 상태는 여전히 held(«저장됨» 아님) · 보관 1건 원문 그대로 · 알약 없음 ·
// 사람이 «현재 기기 사본 유지»를 고르면 예전처럼 풀린다. 아직 보관되지 않은 새 입력은 예전처럼 막는다(보관만으로 풀린다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
SIZES.itemsHeld={...SIZES.desktop,engine};
const PID='vp01',KEY='sq:'+PID;
const fx=await startFixture(),browsers={};
const save=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2)+'\n');
const schedule=fx.db.get(WT+'|process_coach_v1'),seed=JSON.parse(schedule.v);
for(const [week,days] of Object.entries(seed.weeks))for(const [i,day] of days.entries())if(day.board?.sched==='경기')day.mid='items-held-'+week+'-'+i;
schedule.v=JSON.stringify(seed);
let page,context,team,logs=[];const proof={engine,synthetic:true,steps:[]};
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
async function openTeam(){
  await page.locator('[data-team-hub="1"]:visible').click();
  await page.locator('[data-team-key="players"][data-tn-grp="squad"]:visible').click();
  team=await (await page.waitForSelector('#fScout')).contentFrame();
  await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof rosterSaveRows==='function'&&typeof rosterOutbox==='function');
}
/* 행 추적기가 멈출 때까지(저장 중이 아님) 기다린 뒤 선수단 화면 · 셸의 상태를 한 번에 읽는다 */
async function settled(){
  await team.waitForFunction(()=>!teamSaves.hasPending()||teamSaves.hasFailed('sq:vp01'));
  return team.evaluate(async()=>{
    let flush;try{flush={ok:await psFlushPendingReady()};}catch(e){flush={ok:false,code:e.psCode||'',message:String(e&&e.message||'')};}
    let shell;try{shell={ok:await parent.psFlushAllPendingReady()};}catch(e){shell={ok:false,code:e.psCode||'',frame:e.psFrame||'',message:String(e&&e.message||'')};}
    return {failed:teamSaves.hasFailed('sq:vp01'),pending:psHasPending(),outbox:rosterOutbox().pending(),flush,shell,team:PSSaveState.get('team'),
      pill:document.getElementById('psSaveFailed')?.textContent||null,sync:parent.PSSync.state(),row:(await parent.storage.get('sq:vp01'))?.value??null};
  });
}
try{
  ({page,context,logs}=await openApp(fx,'itemsHeld',{browsers}));
  assert.equal(context.browser().browserType().name(),engine);
  await openTeam();
  await page.waitForFunction(()=>window.PSSync?.dataUnlocked()&&window.PSItems?.active()&&PSSync.state().kind==='ok'&&!PSSync.pending().count);
  const baseline=await poll(()=>page.evaluate(async()=>{const item=(await storage.get('sq:vp01'))?.value??null;if(!item||PSSync.state().kind!=='ok'||PSSync.pending().count)return false;return {item};}),'normal initial sync');
  // 1) 실제 옛 입력 CAS 실패(items-stale-round-block 과 같은 방법): 대기열 쓰기가 원문을 읽은 뒤 다른 쓰기가 같은 행을 바꾼다
  const queued=await page.evaluate(async({key,baselineItem})=>{
    const original=storage.get;let finishRead;const readDone=new Promise(resolve=>{finishRead=resolve;});let capture=false;
    storage.get=function(k){const observe=capture&&k===key,work=original.apply(this,arguments);return observe?Promise.resolve(work).then(v=>{finishRead(v?.value??null);return v;}):work;};
    try{
      const doc=JSON.parse(localStorage.getItem('scout_tool_v1')),edited=JSON.parse(JSON.stringify(doc.players)),p=edited.find(p=>p.id==='vp01');p.memo='SYNTHETIC QUEUED A';
      const scout=document.getElementById('fScout').contentWindow;
      const receipt=scout.rosterOutbox().stage({players:edited,basePlayers:doc.players,changedIds:['vp01'],deletedIds:[]});
      capture=true;window.__heldQueued=PSItems.write(edited,{intent:receipt});capture=false;
      const preimage=await readDone;if(preimage!==baselineItem)throw Error('Queued job did not capture actual baseline');
      const other=JSON.parse(preimage);other.memo='SYNTHETIC OTHER WRITER B';const otherRaw=JSON.stringify(other);
      const changed=await storage.replaceIfValue(key,preimage,otherRaw);
      return {changed,otherRaw,receipt,basePlayers:doc.players};
    }finally{capture=false;storage.get=original;}
  },{key:KEY,baselineItem:baseline.item});
  assert.equal(queued.changed,true);
  const first=await page.evaluate(async()=>{try{await PSItems.flush();return {ok:true};}catch(e){return {ok:false,code:e.psCode,stage:e.psStage};}});
  assert.equal(first.ok,false);assert.equal(first.stage,'items_write_stale_job');
  // 2) 배경 회차가 그 입력을 기기에 보관한다(items-stale-device 1건) → 앞(foreground) flush 는 items_stale_review
  for(let n=1;n<=2;n++)await page.evaluate(n=>PSSync.syncNow('items-held-round-'+n),n);
  const kept=await poll(async()=>{const k=(await archives()).filter(r=>r.doc.reason==='items-stale-device');return k.length===1?k:false;},'stale row archived once');
  assert.equal(await page.evaluate(async()=>{try{await PSItems.flush();return '';}catch(e){return e.psStage;}}),'items_stale_review');
  // 3) 실제 기기처럼 실패한 행 저장이 다시 올라간다(부팅 때 rosterResumeRows 가 하는 일). 보관(journal + 기기 묶음 영수증)에 있는 행은 held — 실패가 아니다
  assert.equal(await team.evaluate(receipt=>rosterSaveRows([],{},receipt),queued.receipt),true);
  const held=await settled();proof.steps.push({step:'held-row',...held});save('held-row.json',held);
  assert.equal(held.failed,false,'보관된 행은 teamSaves 에 «실패»로 남지 않는다');
  assert.equal(held.pending,false,'보관된 영수증은 «올릴 차례의 변경»이 아니다(psHasPending)');
  assert.equal(held.outbox,true,'기기 묶음 영수증은 그대로(ACK 하지 않는다 — 보관 확인 뒤 settle)');
  assert.deepEqual(held.flush,{ok:true},'새 판 적용 · 화면 떠나기 전 저장 확인이 보관된 행에 막히지 않는다');
  assert.deepEqual(held.shell,{ok:true},'셸의 모든 화면 저장 확인(psFlushAllPendingReady)도 통과');
  assert.notEqual(held.sync.kind,'ok','동기화 상태는 여전히 held(«저장됨» 아님)');
  assert.equal(held.pill,null,'«저장되지 않았습니다 · 앱을 닫으면 사라집니다» 알약은 뜨지 않는다');
  assert.equal(held.row,queued.otherRaw,'다른 쓰기(B)를 덮지 않는다');
  assert.equal((await archives()).find(r=>r.key===kept[0].key).raw,kept[0].raw,'보관 1건 원문 그대로');
  // 배경 회차가 더 돌아도 같은 요청을 또 보관하지 않는다(다시 올린 행은 sync.js 작업을 만들지 않는다)
  for(let n=3;n<=4;n++)await page.evaluate(n=>PSSync.syncNow('items-held-round-'+n),n);
  const afterRounds=(await archives()).filter(r=>r.doc.reason==='items-stale-device');
  proof.steps.push({step:'rounds-after-held',archives:afterRounds.length});
  assert.equal(afterRounds.length,1,'보관된 행을 다시 올려도 보관이 늘지 않는다');
  // 4) 아직 보관되지 않은 새 입력(같은 선수의 새 묶음)은 예전처럼 막는다 — 보관(배경 회차)이 끝난 뒤에야 풀린다. 그동안 알약은 «일부 변경 보관»
  const second=await page.evaluate(({basePlayers})=>{
    const edited=JSON.parse(JSON.stringify(basePlayers)),p=edited.find(p=>p.id==='vp01');p.memo='SYNTHETIC QUEUED A2';
    const scout=document.getElementById('fScout').contentWindow;
    const receipt=scout.rosterOutbox().stage({players:edited,basePlayers:basePlayers,changedIds:['vp01'],deletedIds:[]});
    return {receipt,accepted:scout.rosterSaveRows(edited,{changedIds:['vp01'],deletedIds:[],basePlayers:basePlayers},receipt)};
  },{basePlayers:queued.basePlayers});
  assert.equal(second.accepted,true);
  await team.waitForFunction(()=>teamSaves.hasFailed('sq:vp01'));
  const blocked=await team.evaluate(async()=>{let flush;try{flush={ok:await psFlushPendingReady()};}catch(e){flush={ok:false,code:e.psCode||''};}
    return {flush,pending:psHasPending(),pill:document.getElementById('psSaveFailed')?.textContent||null};});
  proof.steps.push({step:'new-input-blocked',...blocked});save('new-input-blocked.json',blocked);
  assert.equal(blocked.flush.ok,false,'보관되지 않은 새 입력은 저장 확인을 막는다');assert.match(blocked.flush.code,/^store_ready\.sync_local_changed:sq:vp01/);
  assert.equal(blocked.pending,true);
  assert.ok(blocked.pill&&blocked.pill.includes('일부 변경 보관')&&blocked.pill.includes('앱 설정 › 데이터 › 보관된 변경'),'알약은 «일부 변경 보관 — 앱 설정 › 데이터 › 보관된 변경»: '+blocked.pill);
  assert.ok(!blocked.pill.includes('앱을 닫으면'),blocked.pill);
  for(let n=5;n<=6;n++)await page.evaluate(n=>PSSync.syncNow('items-held-round-'+n),n);
  const two=await poll(async()=>{const k=(await archives()).filter(r=>r.doc.reason==='items-stale-device');return k.length===2?k:false;},'new input archived as its own review');
  const released=await settled();proof.steps.push({step:'new-input-held',...released});
  assert.equal(released.failed,false);assert.equal(released.pending,false);assert.deepEqual(released.flush,{ok:true});assert.equal(released.pill,null,'보관이 끝나면 알약이 내려간다');
  assert.equal(released.row,queued.otherRaw);
  // 5) 새로고침 — 부팅의 rosterResumeRows 가 다시 올려도 held, 저장 확인 통과, 보관 2건 그대로
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PSSync?.dataUnlocked()&&window.PSItems?.active());
  await openTeam();
  await page.evaluate(()=>PSSync.syncNow('items-held-after-reload'));
  const reloaded=await settled();proof.steps.push({step:'reload',...reloaded});save('reload.json',reloaded);
  assert.equal(reloaded.failed,false);assert.equal(reloaded.pending,false);assert.deepEqual(reloaded.flush,{ok:true});assert.deepEqual(reloaded.shell,{ok:true});assert.equal(reloaded.pill,null);assert.notEqual(reloaded.sync.kind,'ok');
  assert.equal((await archives()).filter(r=>r.doc.reason==='items-stale-device').length,2,'새로고침 뒤에도 보관이 늘지 않는다');
  for(const r of two)assert.equal((await archives()).find(x=>x.key===r.key)?.raw,r.raw);
  // 6) 사람이 «현재 기기 사본 유지»를 고르면(보관마다 한 번) 예전처럼 풀린다 — 영수증 settle · 묶음 비움 · 저장 확인 통과 · 동기화 «저장됨»
  await page.evaluate(()=>PSAutosaveRecovery.open());const dialog=page.locator('#psAutosaveRecoveryDialog');
  for(const r of two){
    await dialog.locator('[data-psar-id="'+r.doc.id+'"]').click();await dialog.locator('[data-psar-action="prepare-items"]').click();
    await dialog.locator('[data-psar-action="resolve-items"]').waitFor();await dialog.locator('[data-psar-action="resolve-items"]').click();
    await dialog.getByText('현재 기기 사본을 유지하고 이 입력의 보류를 해제했습니다. 보관된 원문은 그대로 남아 있습니다.',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.evaluate(()=>PSAutosaveRecovery.open());
  }
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();
  const resolved=await settled();proof.steps.push({step:'resolved',...resolved});save('resolved.json',resolved);
  assert.equal(resolved.failed,false);assert.equal(resolved.pending,false);assert.equal(resolved.outbox,false,'고른 뒤 영수증은 settle 되어 묶음이 빈다');assert.deepEqual(resolved.flush,{ok:true});assert.equal(resolved.row,queued.otherRaw);
  await page.evaluate(()=>PSSync.syncNow('items-held-resolved'));
  await poll(()=>page.evaluate(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count),'sync returns to ok after explicit choices');
  for(const r of two)assert.equal((await archives()).find(x=>x.key===r.key)?.raw,r.raw,'보관 원문은 그대로');
  await page.screenshot({path:path.join(OUT,engine+'-items-stale-held.png'),animations:'disabled'});
  const pageErrors=logs.filter(x=>x.type==='pageerror');assert.deepEqual(pageErrors,[]);
  proof.passed=true;save('results.json',proof);console.log(JSON.stringify({passed:true,engine,output:OUT}));
}catch(error){
  proof.error={name:error.name,message:error.message,stack:error.stack};proof.logs=logs;
  if(team)proof.teamFailure=await team.evaluate(()=>({scopes:PSSaveState.snapshot().scopes,pending:psHasPending(),failed:teamSaves.hasFailed('sq:vp01'),outbox:(()=>{try{return rosterOutbox().pending();}catch(e){return String(e);}})(),pill:document.getElementById('psSaveFailed')?.textContent||null})).catch(e=>({error:e.message}));
  if(page)proof.failureArchives=await archives().catch(e=>({error:e.message}));
  save('failure.json',proof);if(page)await page.screenshot({path:path.join(OUT,engine+'-failure.png')}).catch(()=>{});throw error;
}finally{if(context)await context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();}
