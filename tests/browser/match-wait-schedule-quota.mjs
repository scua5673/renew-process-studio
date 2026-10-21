import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS,WT,A} from '../fixtures/team-app.mjs';
// 3.131 — 아이패드 «팀 경기 자료를 불러오는 중입니다»에서 멈춤(10/21, 풋볼A 운영자 아이패드).
// 그 기기는 일정 화면 사본(localStorage 거울 process_coach_v1)을 쓰면 늘 QuotaExceededError — 10/15 부터 58번 schedule_mirror_quota.
// 동기화는 «일정을 받은 회차에는 경기를 미룬다»(1.659)인데, 일정 회차가 거울 때문에 매번 실패 · 메타를 되돌려
// 다음 회차가 일정을 또 받고 경기를 또 미뤘다 → 경기 문서가 영영 안 내려와 경기 화면이 기다리기만 했다.
// 이제 IDB 정본이 서버 원문과 같으면 거울 실패로 회차를 실패시키지 않는다 — 낡은 거울은 걷고(화면은 IDB 를 읽는다, 3.062) 경기는 다음 회차에 받는다.
// 합성 팀 fixture 에서만 돈다. 거울 쓰기만 막는다(다른 키 · IDB 는 그대로).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
const day=new Date(Date.now()+3*86400000),ymd=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
const serverMatch={id:'mt_qa_server',competition:'가상 리그',opponent:'가상 서버 경기',date:ymd,time:'15:00',venue:'',homeAway:'',formation:'4-3-3',captainId:'',squad:{start:[],res:[]},
  attack:'',defense:'',attackTransition:'',defenseTransition:'',briefing:'',prepPublished:false,fifaMode:'simple',fifaPlans:[],kind:'official',scoreUs:'',scoreThem:'',resultSummary:'',execution:0,
  reviewGood:'',reviewImprove:'',trainingAction:'',idpAction:'',reviewPublished:false,boardLinks:[],createdAt:Date.now()-86400000,updatedAt:Date.now()-86400000};
fx.db.set(WT+'|cs_team_matches_v1',{workspace_id:WT,k:'cs_team_matches_v1',v:JSON.stringify({version:1,matches:[serverMatch]}),cupd:1000,updated_by:A});
const schedRow=()=>fx.db.get(WT+'|process_coach_v1');
const sched0=schedRow().v;
/* 모든 프레임에서 일정 거울 쓰기만 «저장 공간 초과»로 — 아이패드에서 실제로 받은 오류 이름 그대로. qa_quota_sched=0 이면 푼다 */
const init={fn:()=>{
  const native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    let on=true;try{on=window.localStorage.getItem('qa_quota_sched')!=='0';}catch(_){}
    if(on&&k==='process_coach_v1'&&this===window.localStorage)throw new DOMException('The quota has been exceeded.','QuotaExceededError');
    return native.call(this,k,v);
  };
}};
const shot=async(page,name)=>{try{await page.screenshot({path:path.join(SHOTS,'match-wait-quota-'+engine+'-'+name+'.png')});}catch(_){}};
try{
  const {page,logs}=await openApp(fx,size,{browsers,init});
  // 1) 처음 연 기기(팀 사본 없음) — 일정 거울은 못 쓴다. 경기 화면이 서버 경기를 보여야 한다
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchLoad==='function'&&typeof setView==='function');
  await sf.evaluate(()=>{try{setView('match');}catch(_){}});
  const landed=await sf.waitForFunction(()=>{
    try{matchState=null;}catch(_){}
    const api=parent.PSSync;
    return !!(api&&api.keyReady('cs_team_matches_v1')&&(matchLoad().matches||[]).some(m=>m.id==='mt_qa_server'));
  },null,{timeout:40000,polling:500}).then(()=>true,()=>false);
  await sf.evaluate(()=>{try{matchState=null;renderMatch();}catch(_){}});await page.waitForTimeout(400);
  const view1=await sf.evaluate(()=>{const e=document.getElementById('matchEmpty');return {empty:!!(e&&getComputedStyle(e).display!=='none'),text:e?e.innerText.replace(/\s+/g,' ').trim():'',
    matches:(matchLoad().matches||[]).map(m=>m.opponent),ready:parent.PSSync.keyReady('cs_team_matches_v1')};});
  const st1=await page.evaluate(()=>({state:PSSync.state(),pending:PSSync.pending().count,mirror:localStorage.getItem('process_coach_v1')}));
  await shot(page,'1-fresh');
  assert.ok(landed,'경기 문서가 내려와야 한다 — '+JSON.stringify({view1,st1}).slice(0,600));
  assert.equal(view1.empty,false,'«불러오는 중» 빈 화면이 아니다: '+view1.text);
  assert.ok(view1.matches.includes('가상 서버 경기'),JSON.stringify(view1.matches));
  assert.equal(st1.mirror,null,'못 쓰는 거울은 비워 둔다(화면은 IDB 정본)');
  assert.notEqual(st1.state.kind,'error',JSON.stringify(st1.state));
  // 일정 정본은 IDB — 경기 화면이 일정 칸에 경기 번호(mid)를 붙여 저장하면 그것도 IDB 로 가서 서버에 올라간다. 곧 서버와 같아진다
  let idb1=null;
  for(let i=0;i<60;i++){
    idb1=await page.evaluate(async()=>{const r=await window.storage.get('process_coach_v1');return r&&r.value;});
    if(idb1===schedRow().v&&await page.evaluate(()=>!PSSync.pending().count))break;
    await page.waitForTimeout(500);
  }
  assert.equal(idb1,schedRow().v,'IDB 정본 = 서버 원문(기기의 새 입력도 올라가 같아진다)');
  assert.equal(await page.evaluate(()=>PSSync.pending().count),0,'올릴 것이 남지 않는다');
  await sf.waitForFunction(()=>/가상 훈련 화/.test(PSSchedule.raw()||''),null,{timeout:10000});

  // 2) 거울이 써지던 기기가 다시 막힌 경우 — 거울은 옛 일정(v1)을 들고 있고 서버는 새 일정(v2)이 됐다
  await page.evaluate(()=>{localStorage.setItem('qa_quota_sched','0');PSSync.syncNow('qa-mirror-ok');});
  await page.waitForFunction(()=>localStorage.getItem('process_coach_v1')!=null&&PSSync.keyReady('process_coach_v1'),null,{timeout:30000});
  const mirrorV1=await page.evaluate(()=>localStorage.getItem('process_coach_v1'));
  assert.equal(mirrorV1,schedRow().v,'풀면 거울을 다시 쓴다');
  const doc2=JSON.parse(schedRow().v);doc2.weeks['0'][1].trainings[0].note='가상 새 일정 v2';doc2.editedAt=Date.now();
  const v2=JSON.stringify(doc2),row=schedRow();row.v=v2;row.cupd=2000;
  await page.evaluate(()=>{localStorage.setItem('qa_quota_sched','1');PSSync.syncNow('qa-server-v2');});
  await page.waitForFunction(async()=>{const r=await window.storage.get('process_coach_v1');return !!(r&&/가상 새 일정 v2/.test(r.value||''));},null,{timeout:30000,polling:500});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>PSSync.syncNow('qa-after-v2'));await page.waitForTimeout(2500);
  const st2=await page.evaluate(()=>({state:PSSync.state(),mirror:localStorage.getItem('process_coach_v1')}));
  assert.ok(st2.mirror===null||/가상 새 일정 v2/.test(st2.mirror),'옛 거울(v1)을 남기지 않는다');
  assert.match(schedRow().v,/가상 새 일정 v2/,'서버 일정은 v2 그대로 — 이 기기가 옛 거울을 올리지 않는다');
  assert.notEqual(st2.state.kind,'error',JSON.stringify(st2.state));
  await sf.waitForFunction(()=>/가상 새 일정 v2/.test(PSSchedule.raw()||''),null,{timeout:10000});
  await sf.evaluate(()=>{matchState=null;renderMatch();});
  assert.ok(await sf.evaluate(()=>(matchLoad().matches||[]).some(m=>m.id==='mt_qa_server')),'경기는 그대로 보인다');
  await shot(page,'2-stale-mirror');

  // 3) 이 기기가 올린 일정은 서버 일정 내용을 잃지 않는다(빈 일정 · 옛 일정을 올리지 않는다)
  const schedWrites=fx.writes.filter(w=>w.k==='process_coach_v1'&&w.v!=null);
  for(const w of schedWrites){assert.match(String(w.v),/가상 훈련 목/,'올린 일정에 서버 내용이 있다');}
  assert.equal(sched0.length>0,true);
  const bad=logs.filter(l=>l.type==='pageerror');
  assert.equal(bad.length,0,JSON.stringify(bad).slice(0,600));
  console.log('match-wait-schedule-quota OK',engine,size,JSON.stringify({view1,st1:{state:st1.state.kind,pending:st1.pending},st2:{state:st2.state.kind},schedWrites:schedWrites.length}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
