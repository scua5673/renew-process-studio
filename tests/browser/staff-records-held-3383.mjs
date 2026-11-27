import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,WT,A,OUT,SIZES} from '../fixtures/team-app.mjs';

// 3.383 — 스태프 코치 기기에 «선수 입력 보류»가 있을 때 그 기기에서 적은 부상 기록(사용자 11/27 «풋볼A 다른 코치가 부상리포트 만들고 있는데 팀운영에 적용이 안되는데»).
// 운영 기록: 보류가 하나라도 있으면 선수단 문서(scout_tool_v1)가 통째로 안 올라가 부상 부위 · 메모 · 기간이 그 기기에만 남았다(상태는 선수 줄로 올라가 «부상»만 보였다).
// 실제 PSItems/PSSync + IDB CAS. 보류는 items-stale-round-block · avail-held-row-3281 과 같은 방법으로 만든다(제품 보호 장치를 흉내 내지 않는다). 합성 팀 · 합성 서버만.
// 고치기 전(3.382): ① 단계에서 서버 injuryInfo 가 비어 떨어진다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
SIZES.staffRecords={...SIZES.desktop,engine};
const OTHER='99999999-9999-4999-8999-999999999999',DOC=WT+'|scout_tool_v1';
const fx=await startFixture({teamRole:'member'}),browsers={};
fx.db.set(WT+'|cs_perms_v1',{workspace_id:WT,k:'cs_perms_v1',v:JSON.stringify({members:{[A]:{role:'staff',scopes:['board','schedule','team','gamemodel','terms']}},defaultRole:'player'}),cupd:2000,updated_by:OTHER});
// 경기 칸의 mid 를 고정 — 첫 열기의 경기 id 정리가 이 시험과 무관하게(items-stale-round-block 과 같은 준비)
const schedule=fx.db.get(WT+'|process_coach_v1'),seed=JSON.parse(schedule.v);
for(const [week,days] of Object.entries(seed.weeks))for(const [i,day] of days.entries())if(day.board?.sched==='경기')day.mid='staff-records-'+week+'-'+i;
schedule.v=JSON.stringify(seed);
const save=(name,value)=>fs.writeFileSync(path.join(OUT,name),JSON.stringify(value,null,2)+'\n');
const server=()=>JSON.parse(fx.db.get(DOC).v);
/* 다른 기기(소유자)가 서버 문서를 고친 것처럼: 고친 뒤 판본을 올린다 */
function ownerEdit(fn){const row=fx.db.get(DOC),d=JSON.parse(row.v);fn(d);row.v=JSON.stringify(d);row.cupd=Date.now();row.updated_by=OTHER;return row.cupd;}
let page,context,team,logs=[];const proof={engine,synthetic:true,steps:[]};
async function poll(read,label,timeout=35000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const v=await read();if(v)return v;await new Promise(r=>setTimeout(r,100));}
  throw Error('Synthetic condition timed out: '+label);
}
async function rounds(n,label){for(let i=1;i<=n;i++)await page.evaluate(async label=>{const until=Date.now()+30000;while(PSSync.state().kind==='busy'){if(Date.now()>until)throw Error('sync stayed busy');await new Promise(r=>setTimeout(r,25));}return PSSync.syncNow(label);},label+'-'+i);}
/* 선수단 원문을 받은 요청 수 — 메타 조회(k,cupd)에는 키 이름이 없고, 원문 조회만 URL 에 키를 싣는다 */
const valuePulls=()=>page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/rest/v1/ps_kv')&&e.name.includes('scout_tool_v1')).length);
const localDoc=()=>team.evaluate(()=>JSON.parse(localStorage.getItem('scout_tool_v1')));
try{
  ({page,context,logs}=await openApp(fx,'staffRecords',{browsers}));
  assert.equal(context.browser().browserType().name(),engine);
  await page.locator('[data-team-hub="1"]:visible').click();
  await page.locator('[data-team-key="players"][data-tn-grp="squad"]:visible').click();
  team=await (await page.waitForSelector('#fScout')).contentFrame();
  await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof stInjInfoSet==='function'&&typeof rosterOutbox==='function');
  await page.waitForFunction(()=>window.PSSync?.dataUnlocked()&&window.PSItems?.active()&&PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:45000});
  assert.deepEqual(await team.evaluate(()=>({approve:tmCanApprove(),status:tmCanEditStatus()})),{approve:false,status:true},'스태프(팀 편집 권한) 계정');
  const today=await team.evaluate(()=>stYmd());
  // 0) 실제 옛 입력 CAS 실패 → 배경 회차가 그 선수(vp01)의 입력을 기기에 보관한다
  const baselineItem=await page.evaluate(async()=>(await storage.get('sq:vp01'))?.value??null);
  const queued=await page.evaluate(async({baselineItem})=>{
    const original=storage.get;let finishRead;const readDone=new Promise(r=>{finishRead=r;});let capture=false;
    storage.get=function(k){const observe=capture&&k==='sq:vp01',work=original.apply(this,arguments);return observe?Promise.resolve(work).then(v=>{finishRead(v?.value??null);return v;}):work;};
    try{
      const doc=JSON.parse(localStorage.getItem('scout_tool_v1')),edited=JSON.parse(JSON.stringify(doc.players)),p=edited.find(p=>p.id==='vp01');p.memo='SYNTHETIC HELD DEVICE VALUE';
      const scout=document.getElementById('fScout').contentWindow,receipt=scout.rosterOutbox().stage({players:edited,basePlayers:doc.players,changedIds:['vp01'],deletedIds:[]});
      capture=true;window.__staffQueued=PSItems.write(edited,{intent:receipt});capture=false;
      const pre=await readDone;if(pre!==baselineItem)throw Error('Queued job did not capture actual baseline');
      const other=JSON.parse(pre);other.memo='SYNTHETIC OTHER WRITER';return await storage.replaceIfValue('sq:vp01',pre,JSON.stringify(other));
    }finally{capture=false;storage.get=original;}
  },{baselineItem});
  assert.equal(queued,true);
  assert.equal(await page.evaluate(async()=>{try{await PSItems.flush();return 'ok';}catch(e){return e.psStage;}}),'items_write_stale_job');
  await rounds(2,'held');
  await poll(()=>page.evaluate(()=>PSSync.state().reason==='items_stale_review'),'stale row held');
  proof.steps.push('held');
  // ① 소유자 기기가 그날 기록을 하나 적은 뒤, 스태프가 vp03 을 «부상»으로 바꾸고 부위 · 메모를 적는다(시트의 «기록하기»와 같은 저장)
  ownerEdit(d=>{d.meta=d.meta||{};const pd=d.meta.participationDays=d.meta.participationDays||{};(pd[today]=pd[today]||{}).vp05={s:'out',kind:'train',at:Date.now(),n:'OWNER CELL'};});
  await team.evaluate(()=>{window.toast=()=>{};tmStatusApply(data.players.find(x=>x.id==='vp03'),'injury');});
  await team.waitForTimeout(300);
  await team.evaluate(()=>{document.getElementById('stInjOv')?.remove();const p=data.players.find(x=>x.id==='vp03'),e=stOpenEpisode(p);stInjInfoSet('vp03',e.from,{part:'무릎',side:'L',n:'STAFF NOTE'});save();});
  await rounds(3,'records');
  let s=server();
  assert.equal(s.meta?.injuryInfo?.vp03?.[today]?.part,'무릎','보류 중에도 스태프가 적은 부상 부위가 팀 문서에 올라간다');
  assert.equal(s.meta.injuryInfo.vp03[today].n,'STAFF NOTE');
  assert.equal(s.meta?.participationDays?.[today]?.vp05?.n,'OWNER CELL','소유자가 적은 그날 기록은 그대로');
  assert.ok(Array.isArray(s.meta?.statusRuns?.vp03)&&s.meta.statusRuns.vp03.some(r=>r.s==='injury'&&r.to>=today),'스태프 기기의 상태 기간도 이어 붙는다');
  assert.notEqual(s.players.find(p=>p.id==='vp01')?.memo,'SYNTHETIC HELD DEVICE VALUE','보류된 선수의 기기 값은 팀 문서에 실리지 않는다');
  assert.notEqual(JSON.parse(fx.db.get(WT+'|sq:vp01').v).memo,'SYNTHETIC HELD DEVICE VALUE','보류된 선수 줄도 올라가지 않는다');
  let local=await localDoc();
  assert.equal(local.meta?.participationDays?.[today]?.vp05?.n,'OWNER CELL','기기 사본에도 소유자 기록이 합쳐진다');
  assert.equal(local.players.find(p=>p.id==='vp01')?.memo,'SYNTHETIC HELD DEVICE VALUE','기기 사본의 보류된 선수 값은 그대로');
  assert.equal(await page.evaluate(()=>PSSync.state().reason),'items_stale_review','보류는 풀리지 않는다(사람이 고른다)');
  assert.ok(await valuePulls()>0,'원문 조회는 URL 에 키 이름을 싣는다(세는 방법 확인)');
  proof.steps.push('records-up');
  // ② 바뀐 게 없으면 회차가 더 돌아도 서버 원문을 다시 받지 않는다(보류가 며칠 가도 이그레스가 늘지 않게)
  await page.evaluate(()=>performance.setResourceTimingBufferSize(20000));
  const pulls=await valuePulls();await rounds(3,'idle');
  assert.equal(await valuePulls(),pulls,'기록 · 서버 판이 그대로면 선수단 원문을 다시 받지 않는다');
  proof.steps.push('no-refetch');
  // ③ 소유자가 기록 칸 밖의 칸(학교급)을 고친 뒤 스태프가 다른 선수 부상 기록을 적는다 → 기록은 올라가고, 학교급은 서버 것 그대로,
  //    기기는 «마지막으로 맞춘 서버 판»을 당기지 않는다(보류가 풀리면 통째 올리기 대신 «자료 확인»으로 — 소유자 변경을 덮지 않게)
  const seenBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('ps_sync_meta')||'{}').c?.scout_tool_v1??null);
  ownerEdit(d=>{d.meta=d.meta||{};d.meta.level='mid';});
  await team.evaluate(()=>{const p=data.players.find(x=>x.id==='vp07');tmStatusApply(p,'injury');});
  await team.waitForTimeout(300);
  await team.evaluate(()=>{document.getElementById('stInjOv')?.remove();const p=data.players.find(x=>x.id==='vp07'),e=stOpenEpisode(p);stInjInfoSet('vp07',e.from,{part:'발목',n:'STAFF SECOND'});save();});
  await rounds(3,'keep');
  s=server();
  assert.equal(s.meta?.injuryInfo?.vp07?.[today]?.part,'발목','두 번째 부상 기록도 올라간다');
  assert.equal(s.meta.level,'mid','소유자가 고친 칸은 그대로');
  assert.equal(s.meta.injuryInfo.vp03[today].part,'무릎');
  const seenAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('ps_sync_meta')||'{}').c?.scout_tool_v1??null);
  assert.equal(seenAfter,seenBefore,'기록 칸 밖이 다르면 «마지막으로 맞춘 서버 판»은 그대로');
  assert.notEqual(fx.db.get(DOC).cupd,seenAfter);
  local=await localDoc();
  assert.notEqual(local.meta?.level,'mid','기기 사본의 기록 칸 밖은 손대지 않는다(고르는 것은 «자료 확인»)');
  proof.steps.push('keep-base');
  // ④ 부상 리포트(가용인원)도 이 기기에서 두 기록을 그대로 읽는다
  const report=await team.evaluate(()=>{const ours=tmOurs(),m=irTeamModel(ours,stAddDays(stYmd(),-30),stYmd());return m.now.map(r=>({id:r.who.id,part:r.e&&r.e.part}));});
  assert.deepEqual(report.filter(r=>['vp03','vp07'].includes(r.id)).sort((a,b)=>a.id<b.id?-1:1),[{id:'vp03',part:'무릎'},{id:'vp07',part:'발목'}]);
  proof.steps.push('report');
  const errors=logs.filter(l=>l.type==='pageerror');assert.deepEqual(errors,[],'페이지 오류 없음');
  proof.passed=true;save('staff-records-held-3383.json',proof);console.log(JSON.stringify({passed:true,engine,steps:proof.steps}));
}catch(e){
  proof.error=String(e&&e.stack||e);try{proof.server=server().meta;}catch(_){ proof.server=null; }
  try{save('staff-records-held-3383-failure.json',proof);}catch(_){ /* 결과 파일을 못 써도 실패는 그대로 알린다 */ }
  console.error(e);process.exitCode=1;
}finally{
  try{await context?.close();}catch(_){ /* 닫기 실패는 결과와 무관 */ }
  for(const b of Object.values(browsers))try{await b.close();}catch(_){ /* 닫기 실패는 결과와 무관 */ }
  await fx.close();
}
