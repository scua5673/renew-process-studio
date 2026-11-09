import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixture,openApp,SHOTS,OUT,WT,A,ready} from '../fixtures/team-app.mjs';

// A failed match mirror write must return only this round's candidate IDB
// write to its exact previous body. Retry through the native sync/readiness/
// save barriers, then reopen a real form edit. Pre-existing unproven splits
// remain a manual-review case; this test does not authorize choosing a copy.
// Only the synthetic loopback fixture is used; its context blocks all external
// HTTP requests and websockets. No production account, database or session.
const KEY='cs_team_matches_v1',MID='mt_qa_mirror_recovery';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'supported fixture browser');
const size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
assert.equal(size,engine==='webkit'?'ipad':'desktop','exercise the requested browser engine');
const fx=await startFixture(),browsers={};
const report={test:'match-mirror-quota-recovery',engine,size,steps:[]};
let page,scout,logs=[],blocked=[],stage='seed';
const describe=raw=>({raw,length:raw==null?0:raw.length,sha256:raw==null?null:createHash('sha256').update(raw).digest('hex')});
const row=()=>fx.db.get(WT+'|'+KEY);
const serverMatch={id:MID,competition:'가상 거울 복구 리그',opponent:'가상 거울 복구 FC',date:'',time:'15:00',venue:'가상 구장',homeAway:'home',
  formation:'4-3-3',captainId:'',squad:{start:[],res:[]},attack:'가상 원래 공격 원문',defense:'가상 보존 수비 원문',attackTransition:'가상 공격 전환',
  defenseTransition:'가상 수비 전환',briefing:'가상 OLD 서버 확인본',prepPublished:false,fifaMode:'simple',fifaPlans:[],kind:'official',
  scoreUs:'',scoreThem:'',resultSummary:'',execution:0,reviewGood:'',reviewImprove:'',trainingAction:'',idpAction:'',reviewPublished:false,
  boardLinks:[],createdAt:1700000000000,updatedAt:1700000000000};
const oldRaw=JSON.stringify({version:1,matches:[serverMatch]});
fx.db.set(WT+'|'+KEY,{workspace_id:WT,k:KEY,v:oldRaw,cupd:1000,updated_by:A});
// Keep this document independent of schedule-generated matches. These are
// synthetic fixture rows, not changes to the shared fixture implementation.
const sched=fx.db.get(WT+'|process_coach_v1'),schedule=JSON.parse(sched.v);
for(const days of Object.values(schedule.weeks))for(const day of days){
  if(day.board?.sched==='경기'){delete day.board;delete day.match;delete day.mid;day.rest=true;}
}
sched.v=JSON.stringify(schedule);
const next=JSON.parse(oldRaw);
Object.assign(next.matches[0],{briefing:'가상 NEW 서버 원문 — 이전 확인본과 다른 내용',attack:'가상 NEW 공격 원문',oppAttack:'가상 서버 상대 공격 원문',updatedAt:1700000001000});
const newRaw=JSON.stringify(next),input='가상 quota 복구 뒤 실제 입력\n다시 열어도 남는 두 번째 줄';
const init={fn:()=>{
  const native=Storage.prototype.setItem;
  window.__qaMatchMirrorQuota={count:0,lastRaw:null};
  Storage.prototype.setItem=function(key,value){
    if(key==='cs_team_matches_v1'&&this===window.localStorage&&localStorage.getItem('qa_quota_match_mirror')==='1'){
      window.__qaMatchMirrorQuota.count++;
      window.__qaMatchMirrorQuota.lastRaw=String(value);
      throw new DOMException('The quota has been exceeded.','QuotaExceededError');
    }
    return native.call(this,key,value);
  };
}};
const read=async()=>page.evaluate(async key=>{
  const idb=(await window.storage.peek(key))?.value??null;
  return {idb,mirror:localStorage.getItem(key),confirmedIdb:PSSync.confirmedValue(key,idb),
    ready:PSSync.keyReady(key),pending:PSSync.pending(),state:PSSync.state(),
    meta:JSON.parse(localStorage.getItem('ps_sync_meta')||'null'),outbox:localStorage.getItem('ps_sync_outbox_v1'),quota:window.__qaMatchMirrorQuota};
},KEY);
const capture=async name=>{
  const actual=await read();
  const entry={name,observedAt:new Date().toISOString(),...actual,server:row().v};
  for(const key of ['idb','mirror','server'])entry[key]=describe(entry[key]);
  report.steps.push(entry);
  await page.screenshot({path:path.join(SHOTS,`match-mirror-quota-${engine}-${name}.png`)});
  return actual;
};
const exact=async(expected,timeout=30000)=>{
  await page.waitForFunction(async({key,expected})=>{
    const rec=await window.storage.peek(key);
    return rec?.value===expected&&localStorage.getItem(key)===expected&&PSSync.keyReady(key);
  },{key:KEY,expected},{timeout,polling:250});
};
const sync=reason=>page.evaluate(reason=>PSSync.syncNow(reason),reason);
const openMatch=async()=>{
  // Reload readiness and the visible navigation precede a real card click.
  // Calling matchOpen while the shell was still sending its initial view could
  // immediately send this synthetic interaction back to the list.
  await ready(page);
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator('#teamNav [data-team-key="match"]:visible, #teamBottom [data-tb="match"]:visible').first().click();
  scout=await (await page.waitForSelector('#fScout')).contentFrame();
  await scout.evaluate(key=>PSStorage.sharedReady(key),KEY);
  await scout.locator('.mr-hit[data-mid="'+MID+'"]').click();
};
try{
  stage='confirmed-old';
  ({page,logs,blocked}=await openApp(fx,size,{browsers,init}));
  await exact(oldRaw);
  await openMatch();
  await scout.waitForFunction(()=>!matchDocPending()&&matchCanEdit()&&!psHasPending());
  // Opening scout for the first time also queues its normal roster/default
  // migrations. Finish those through the real barrier before creating a
  // second device's server edit; a match-ready flag alone does not flush them.
  await scout.evaluate(()=>psFlushPendingReady());
  await sync('qa-match-mirror-bootstrap-settle');
  await page.waitForFunction(()=>PSSync.pending().count===0,null,{timeout:30000,polling:250});
  await exact(oldRaw);
  assert.equal(row().v,oldRaw,'native startup preserves the complete OLD body');
  const before=await capture('1-confirmed-old');
  assert.equal(before.pending.count,0);
  assert.equal(before.quota.count,0);

  stage='quota-first-pull';fx.setStep(stage);
  await page.evaluate(()=>localStorage.setItem('qa_quota_match_mirror','1'));
  row().v=newRaw;row().cupd=Math.max(Date.now(),row().cupd+1);
  await sync('qa-match-mirror-quota-first');
  await page.waitForFunction(key=>!PSSync.keyReady(key)&&window.__qaMatchMirrorQuota.count>0,KEY,{timeout:30000,polling:250});
  const failed=await capture('2-quota-preserved');
  assert.equal(failed.idb,oldRaw,'failed mirror pull returns only its own IDB candidate to the exact previous original');
  assert.equal(failed.mirror,oldRaw,'quota retains the complete previously confirmed mirror');
  assert.equal(failed.ready,false,'the old mirror cannot receive match readiness for server NEW');
  assert.equal(failed.quota.lastRaw,newRaw,'only a real match mirror write was rejected');
  assert.equal(row().v,newRaw,'the failed mirror pull never pushes OLD over server NEW');
  await scout.evaluate(()=>renderMatch());
  assert.deepEqual(await scout.evaluate(()=>({pending:matchDocPending(),edit:matchCanEdit(),disabled:document.querySelector('[data-match-field="oppAttack"]').disabled})),
    {pending:true,edit:false,disabled:true},'the native match screen remains read-only while its mirror is stale');

  stage='quota-retry-preserved-original';fx.setStep(stage);
  // A second native round must try the server pull again after rollback. The
  // prior quota failure must neither mark OLD ready nor strand a partial NEW.
  await sync('qa-match-mirror-quota-retry');
  const retried=await capture('3-quota-retry');
  assert.ok(retried.quota.count>failed.quota.count,'another native pull actually retries the match mirror write');
  assert.equal(retried.idb,oldRaw,'quota retry returns its IDB candidate to the exact OLD original');
  assert.equal(retried.mirror,oldRaw,'quota retry preserves exact OLD mirror');
  assert.equal(retried.ready,false);
  assert.equal(row().v,newRaw,'quota retry preserves the entire server original');
  assert.equal(fx.writes.filter(w=>w.k===KEY).length,0,'recovering a downloaded mirror never writes a competing match body to the server');

  stage='quota-released';fx.setStep(stage);
  await page.evaluate(()=>localStorage.setItem('qa_quota_match_mirror','0'));
  await sync('qa-match-mirror-quota-released');
  await exact(newRaw);
  const recovered=await capture('4-recovered');
  assert.equal(recovered.idb,row().v,'recovered IDB is the full server raw');
  assert.equal(recovered.mirror,row().v,'the native retry automatically repairs the OLD mirror');
  assert.equal(recovered.ready,true);
  assert.notEqual(recovered.state.kind,'error','successful mirror recovery clears the quota failure');
  assert.equal(row().v,newRaw,'mirror recovery preserves every server byte');
  assert.equal(fx.writes.filter(w=>w.k===KEY).length,0);

  stage='real-form-save';fx.setStep(stage);
  await scout.evaluate(()=>__matchRefresh());
  await scout.evaluate(mid=>matchOpen(mid),MID);
  await scout.click('[data-match-step="opp"]');
  await scout.waitForFunction(()=>!matchDocPending()&&matchCanEdit()&&!document.querySelector('[data-match-field="oppAttack"]').disabled);
  await scout.locator('[data-match-field="oppAttack"]').fill(input);
  await scout.click('#matchSaveBtn');
  await scout.waitForFunction(()=>matchNav==='list'&&!matchSaveTimer&&!scoutStore.hasPending()&&!psHasPending(),null,{timeout:30000});
  // Save invokes the unmodified psFlushPendingReady barrier. Confirm the exact
  // real server ACK as well, without replacing readiness or flushing functions.
  await sync('qa-match-mirror-real-input-saved');
  let saved;
  for(let n=0;n<60;n++){
    saved=await read();
    if(saved.idb===row().v&&saved.mirror===row().v&&saved.ready&&saved.pending.count===0&&JSON.parse(row().v).matches.find(m=>m.id===MID)?.oppAttack===input)break;
    await page.waitForTimeout(250);
  }
  const savedDoc=JSON.parse(row().v),savedMatch=savedDoc.matches.find(m=>m.id===MID);
  assert.equal(savedMatch.oppAttack,input,'real textarea input receives a server ACK');
  for(const [key,value] of Object.entries(next.matches[0]))if(!['oppAttack','updatedAt'].includes(key))assert.deepEqual(savedMatch[key],value,'saving preserves server field '+key);
  assert.equal(saved.idb,row().v);assert.equal(saved.mirror,row().v);assert.equal(saved.ready,true);assert.equal(saved.pending.count,0);
  assert.ok(fx.writes.some(w=>w.k===KEY&&w.v===row().v),'the real match save reaches the fake server');
  await capture('5-saved');

  stage='reload-reopen';fx.setStep(stage);
  const savedRaw=row().v;
  await page.reload({waitUntil:'domcontentloaded'});
  await exact(savedRaw);
  await openMatch();
  await scout.click('[data-match-step="opp"]');
  await scout.waitForFunction(expected=>!matchDocPending()&&matchCanEdit()&&document.querySelector('[data-match-field="oppAttack"]').value===expected,input,{timeout:30000});
  assert.equal(row().v,savedRaw,'reopening preserves the complete saved raw');
  await capture('6-reopened');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[],'no unhandled application error');
  report.passed=true;
  console.log(JSON.stringify({test:report.test,engine,size,passed:true,quotaAttempts:retried.quota.count,matchWrites:fx.writes.filter(w=>w.k===KEY).length,report:path.join(OUT,`match-mirror-quota-${engine}.json`)}));
}catch(error){
  report.passed=false;report.failure={stage,message:error.message,stack:error.stack};
  if(page)try{await capture('failure');}catch(diagnosticError){report.diagnosticError=diagnosticError.message;}
  console.error('[match-mirror-quota-recovery] '+stage);
  throw error;
}finally{
  report.isolation={origin:fx.base,syntheticWorkspace:WT,externalRequestsBlocked:blocked};
  report.writes=fx.writes;report.recentLogs=logs.slice(-80);
  fs.writeFileSync(path.join(OUT,`match-mirror-quota-${engine}.json`),JSON.stringify(report,null,2),{mode:0o600});
  for(const browser of Object.values(browsers))await browser.close().catch(()=>{});
  await fx.close();
}
