import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,WT,OUT,SIZES} from '../fixtures/team-app.mjs';

// 3.281 — 보관된 선수 행(sq:<id>)이 있는 기기에서 가용인원 기록(제보 e6fc5d26 · de2e508c · 사용자 11/11 «가용인원 체크도 잘 안 된다»).
// 실제 PSItems/PSSync + IDB CAS + 실제 가용인원 기록 창. 보관된 행은 items-stale-round-block 과 같은 방법으로 만든다(제품 보호 장치를 흉내 내지 않는다).
// 고치기 전(3.280): 기록 창이 «기기에 기록하는 중…»에 머물다 «기록하지 못했습니다. 입력은 남아 있습니다…» 한 문장 — 가용인원 쓰기 전 장벽(scoutStore.ready(true))이
// 보관된 행의 재시도·행 flush 까지 기다려서다. 고친 뒤: 통짜 문서만 기다려 기록이 되고, 보관은 그대로, 멈추면 까닭과 가는 길이 보인다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
SIZES.availHeld={...SIZES.desktop,engine};
const HELD='vp01',OTHER='vp03',QUOTA='vp05',KEY='sq:'+HELD,DOC='scout_tool_v1';
const HELD_PATH='앱 설정 › 데이터 › 보관된 변경 › «보관 내용 보기»',DIAG_PATH='앱 설정 › 데이터 › «진단 보기»';
const fx=await startFixture(),browsers={};
const save=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2)+'\n');
// 경기 칸의 mid 를 고정 — 첫 열기의 경기 id 정리가 이 시험과 무관하게(items-stale-round-block 과 같은 준비)
const schedule=fx.db.get(WT+'|process_coach_v1'),seed=JSON.parse(schedule.v);
for(const [week,days] of Object.entries(seed.weeks))for(const [i,day] of days.entries())if(day.board?.sched==='경기')day.mid='avail-held-'+week+'-'+i;
schedule.v=JSON.stringify(seed);
// 기기 저장 공간 부족 흉내(roster-storage-failure-3144 과 같은 방법): 표식이 있을 때만 scout_tool_v1 의 localStorage 쓰기가 한도 오류
const init={fn:()=>{
  const native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    if(k==='scout_tool_v1'&&this===window.localStorage&&localStorage.getItem('qa_scout_quota')==='1')throw new DOMException('Synthetic storage quota','QuotaExceededError');
    return native.call(this,k,v);
  };
}};
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
  await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof rosterSaveRows==='function'&&typeof rosterOutbox==='function'&&typeof stSetAt==='function');
}
/* 기록 창: 선수 단추 → 상태 → 메모 → «기록하기» → 닫히거나 오류 문장이 보일 때까지 */
async function record(pid,state,note){
  await team.locator('[data-av-st="'+pid+'"]').click();
  await team.locator('.av-pick [data-k="'+state+'"]').click();
  await team.locator('.av-pick [data-av-note]').fill(note);
  await team.locator('.av-pick [data-av-save]').click();
  await Promise.race([team.locator('.av-pick').waitFor({state:'hidden'}),team.locator('.av-pick [data-av-save-error].is-error').waitFor()]);
  await team.waitForFunction(()=>!avSaving);
  return team.evaluate(()=>{const pk=document.querySelector('.av-pick');return {open:!!pk&&pk.open,feedback:pk?pk.querySelector('[data-av-save-error]').textContent:'',note:pk?pk.querySelector('[data-av-note]').value:null,saveDisabled:pk?pk.querySelector('[data-av-save]').disabled:null};});
}
const recordOf=(pid,day)=>team.evaluate(({pid,day})=>{const d=JSON.parse(localStorage.getItem('scout_tool_v1'));return d.meta.participationDays?.[day||stYmd()]?.[pid]??null;},{pid,day});
try{
  ({page,context,logs}=await openApp(fx,'availHeld',{browsers,init}));
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
      capture=true;window.__availQueued=PSItems.write(edited,{intent:receipt});capture=false;
      const preimage=await readDone;if(preimage!==baselineItem)throw Error('Queued job did not capture actual baseline');
      const other=JSON.parse(preimage);other.memo='SYNTHETIC OTHER WRITER B';const otherRaw=JSON.stringify(other);
      const changed=await storage.replaceIfValue(key,preimage,otherRaw);
      return {changed,otherRaw,receipt};
    }finally{capture=false;storage.get=original;}
  },{key:KEY,baselineItem:baseline.item});
  assert.equal(queued.changed,true);
  const first=await page.evaluate(async()=>{try{await PSItems.flush();return {ok:true};}catch(e){return {ok:false,code:e.psCode,stage:e.psStage};}await __availQueued;});
  assert.equal(first.ok,false);assert.equal(first.stage,'items_write_stale_job');
  // 2) 배경 회차가 그 입력을 기기에 보관한다(items-stale-device 1건) → 앞(foreground) flush 는 items_stale_review
  for(let n=1;n<=2;n++)await page.evaluate(n=>PSSync.syncNow('avail-held-round-'+n),n);
  const kept=await poll(async()=>{const k=(await archives()).filter(r=>r.doc.reason==='items-stale-device');return k.length===1?k:false;},'stale row archived once');
  assert.equal(await page.evaluate(async()=>{try{await PSItems.flush();return '';}catch(e){return e.psStage;}}),'items_stale_review');
  // 3) 실제 기기처럼 실패한 행 저장이 다시 올라간 상태(부팅 때 rosterResumeRows 가 하는 일). 3.284 — 보관된 영수증 그대로면 held 로 끝나 막지 않으므로(items-stale-held),
  //    여기서는 그 선수의 **아직 보관되지 않은 새 입력**(새 묶음)을 올린다 — teamSaves 의 sq: 행은 실패로 남고 새 판 적용의 저장 확인은 막힌다(보관되기 전엔 예전 그대로)
  assert.equal(await team.evaluate(receipt=>rosterSaveRows([],{},receipt),queued.receipt),true);
  await team.waitForFunction(()=>!teamSaves.hasPending());
  assert.equal(await team.evaluate(()=>teamSaves.hasFailed('sq:vp01')),false,'보관된 영수증을 다시 올린 것은 실패가 아니다(3.284)');
  assert.equal(await page.evaluate(()=>{
    const doc=JSON.parse(localStorage.getItem('scout_tool_v1')),edited=JSON.parse(JSON.stringify(doc.players)),p=edited.find(p=>p.id==='vp01');p.memo='SYNTHETIC QUEUED A2';
    const scout=document.getElementById('fScout').contentWindow,receipt=scout.rosterOutbox().stage({players:edited,basePlayers:doc.players,changedIds:['vp01'],deletedIds:[]});
    return scout.rosterSaveRows(edited,{changedIds:['vp01'],deletedIds:[],basePlayers:doc.players},receipt);
  }),true);
  await team.waitForFunction(()=>teamSaves.hasFailed('sq:vp01'));
  const barrier=await team.evaluate(async()=>{try{await psFlushPendingReady();return {ok:true};}catch(e){return {ok:false,code:e.psCode,reason:typeof avSaveReason==='function'?avSaveReason(e):''};}});
  assert.equal(barrier.ok,false);assert.match(barrier.code,/^store_ready\.sync_local_changed:sq:vp01/,'운영 기록(flush_fail:fScout:store_ready.sync_local_changed:sq:<id>)과 같은 모양');
  proof.steps.push({step:'held-row',barrier,archive:kept[0].doc.id});
  // 4) ② 가용인원 — 다른 선수의 오늘 기록. 고치기 전엔 «기록하지 못했습니다…» 한 문장으로 멈췄다
  await page.locator('[data-team-key="avail"]:visible').click();
  await team.locator('[data-av-st="'+OTHER+'"]').waitFor();
  const other=await record(OTHER,'rest','합성 휴식 메모');
  proof.steps.push({step:'record-other',...other});save('record-other.json',other);
  assert.equal(other.open,false,'보관된 행이 다른 선수의 기록을 막지 않는다: '+other.feedback);
  const otherRec=await recordOf(OTHER);assert.equal(otherRec?.s,'rest');assert.equal(otherRec?.n,'합성 휴식 메모');
  assert.match(await team.locator('#availRoot').innerText(),/기기에 기록했습니다/);
  // ① 새 판 적용을 막은 그 오류를 기록 창이 받으면 까닭 · 선수 이름 · 보관된 변경으로 가는 길이 한 문장에(autosave-status reason)
  assert.equal(barrier.reason,'선수 가상 선수 1 · 앞선 입력을 이 기기에 보관해 두었습니다. 입력은 이 창에 남아 있습니다. '+HELD_PATH+'에서 남길 쪽을 고른 뒤 다시 기록해 주세요.');
  // 보관은 그대로: 행 원문은 다른 쓰기(B) · 보관 1건 원문 그대로 · 그 행의 실패 표시 · 동기화 상태는 «저장됨»이 아니다(보관 확인 대기)
  assert.equal(await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value),queued.otherRaw);
  assert.equal((await archives()).find(r=>r.key===kept[0].key).raw,kept[0].raw);
  assert.equal(await team.evaluate(()=>teamSaves.hasFailed('sq:vp01')),true);
  assert.notEqual(await page.evaluate(()=>PSSync.state().kind),'ok');
  // 5) ② 지난 날짜 기록(행을 쓰지 않는 길)과 보관된 선수 자신의 오늘 기록 — 통짜 문서에 남고, 그 선수의 행 변경은 기기 묶음(outbox)에 남는다
  const yesterday=await team.evaluate(()=>stAddDays(stYmd(),-1));
  await team.locator('[data-av-day="-1"]').click();await team.locator('[data-av-st="'+HELD+'"]').waitFor();
  const heldPast=await record(HELD,'out','합성 어제 불참');assert.equal(heldPast.open,false,heldPast.feedback);
  assert.equal((await recordOf(HELD,yesterday))?.s,'out');
  await team.locator('[data-av-day="0"]').click();await team.locator('[data-av-st="'+HELD+'"]').waitFor();
  const heldToday=await record(HELD,'rest','합성 오늘 휴식');assert.equal(heldToday.open,false,heldToday.feedback);
  assert.equal((await recordOf(HELD))?.s,'rest');
  const heldState=await team.evaluate(()=>({status:data.players.find(p=>p.id==='vp01').status,pending:rosterOutbox().pending(),failed:teamSaves.hasFailed('sq:vp01')}));
  assert.equal(heldState.status,'rest');assert.equal(heldState.pending,true,'그 선수의 행 변경은 기기 묶음에 남아 보관 확인 뒤 올라간다');
  assert.equal(await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value),queued.otherRaw,'보관된 행의 다른 쓰기(B)를 덮지 않는다');
  assert.equal((await archives()).find(r=>r.key===kept[0].key).raw,kept[0].raw);
  proof.steps.push({step:'record-held-player',heldPast,heldToday,heldState});
  // 6) ① 통짜 문서의 기기 저장이 막히면(저장 공간) 까닭과 진단 보기로 가는 길, 입력은 창에 남는다
  await team.evaluate(()=>localStorage.setItem('qa_scout_quota','1'));
  const full=await record(QUOTA,'rest','합성 저장 공간 메모');
  assert.equal(full.open,true);
  // 첫 시도의 오류는 stSetAt 자신의 문장(psCode 없음) — 저장 공간 표시(PSStorage.quotaState)가 벌써 섰으면 그 말로, 아직이면(WebKit) 예전 한 문장
  assert.match(full.feedback,/^(기기 저장 공간이 모자라 기록을 멈췄습니다\. 입력은 이 창에 남아 있습니다\. 앱 설정|기록하지 못했습니다\. 입력은 남아 있습니다\.)/,full.feedback);
  await team.evaluate(()=>localStorage.removeItem('qa_scout_quota'));
  // 표식을 지운 뒤 다시 «기록하기»: 앞선 통짜 문서 쓰기의 기기 확인(2.744 — 같은 원문만 재검증)이 남아 있어 그 자료 이름(psKey)과 진단 보기가 보인다
  await team.locator('.av-pick [data-av-save]').click();
  await team.locator('.av-pick [data-av-save-error].is-error').waitFor();await team.waitForFunction(()=>!avSaving);
  const again=await team.evaluate(()=>{const pk=document.querySelector('.av-pick');return {open:pk.open,feedback:pk.querySelector('[data-av-save-error]').textContent,note:pk.querySelector('[data-av-note]').value,saveDisabled:pk.querySelector('[data-av-save]').disabled};});
  proof.steps.push({step:'quota',full,again});save('quota.json',{full,again});
  assert.equal(again.open,true);assert.equal(again.note,'합성 저장 공간 메모','입력은 창에 남는다');assert.equal(again.saveDisabled,false);
  assert.match(again.feedback,/^선수단 자료 · (기기 저장 공간이 모자라 기록을 멈췄습니다\.|저장 내용이 바뀌어 다시 확인해야 합니다) 입력은 이 창에 남아 있습니다\. /,again.feedback);
  assert.ok(again.feedback.endsWith(DIAG_PATH+'에서 이유를 본 뒤 다시 기록해 주세요.'),again.feedback);
  await team.locator('.av-pick [data-av-cancel]').first().click();
  assert.equal(await recordOf(QUOTA),null,'막힌 기록은 남지 않는다');
  await page.screenshot({path:path.join(OUT,engine+'-avail-held-row.png'),animations:'disabled'});
  const pageErrors=logs.filter(x=>x.type==='pageerror');assert.deepEqual(pageErrors,[]);
  proof.passed=true;save('results.json',proof);console.log(JSON.stringify({passed:true,engine,output:OUT}));
}catch(error){
  proof.error={name:error.name,message:error.message,stack:error.stack};proof.logs=logs;
  if(team)proof.teamFailure=await team.evaluate(()=>({scopes:PSSaveState.snapshot().scopes,pending:psHasPending(),saving:typeof avSaving!=='undefined'?avSaving:null,pick:document.querySelector('.av-pick')?.querySelector('[data-av-save-error]')?.textContent||null})).catch(e=>({error:e.message}));
  save('failure.json',proof);if(page)await page.screenshot({path:path.join(OUT,engine+'-failure.png')}).catch(()=>{});throw error;
}finally{if(context)await context.close();for(const browser of Object.values(browsers))await browser.close();await fx.close();}
