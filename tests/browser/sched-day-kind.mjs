import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
// 한 팀을 OFF 로 돌린 날은 어디서나 OFF(코치로 일정을 돌려 보다 찾음): 일정 칸 «A팀 · OFF» 위의 종류 칩이 «훈련 ▾», 요약 «계획만 1일»,
// 팀 «오늘» «팀 훈련 17:00», 주간 PDF «훈련 · 세부 미정»이었다. 하루의 종류는 PSSchedule.dayKind 한 규칙으로 읽는다 — 저장본은 그대로.
// 합성 팀의 화요일(A팀 17:00 세션)에서 종류 칩 → 시트 → «OFF»를 실제로 눌러 그 상태를 만든다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine==='chromium')SIZES.ipad.engine='chromium';
const fx=await startFixture(),browsers={},DI=1;
const serverDay=()=>JSON.parse(fx.db.get(WT+'|process_coach_v1').v).weeks[0][DI];
try{
  const {page,logs}=await openApp(fx,'ipad',{browsers});
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator('#teamNav [data-team-key="training"]').click();
  const f=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof week!=='undefined'&&week&&week[1]&&week[1].trainings.length===1&&document.querySelectorAll('.wks-day').length===7&&window.PSSchedDayKind,null,{timeout:30000});
  await page.waitForTimeout(600);
  const cell=()=>f.evaluate(di=>{const c=document.querySelectorAll('.wks-day')[di];return {chip:c.querySelector('.wks-kbtn').textContent.trim(),off:c.classList.contains('is-off'),text:c.innerText.replace(/\s+/g,' '),cards:c.querySelectorAll('.wks-card,.wks-ses').length};},DI);
  const before=await cell();assert.equal(before.chip,'훈련 ▾');assert.match(before.text,/17:00/);
  /* 합성 팀은 «오늘»에 훈련이 없으면 하나 넣는다(team-app.mjs) — 세션 수가 요일마다 달라 화요일에만 통과했다(11/11 수요일 CI 에서 떨어짐). OFF 전 수에서 하나 준 것을 본다. */
  const sesBefore=await f.evaluate(()=>weekSummaryCount(week).ses);
  // 종류 칩 → 시트(처음엔 첫 조 A팀이 골라져 있다) → OFF
  await f.locator('.wks-day').nth(DI).locator('.wks-kbtn').tap();
  const sheet=f.locator('#sheet');await sheet.locator('#wfSec-kind').waitFor();
  await sheet.locator('#wfSec-kind').getByRole('button',{name:'OFF',exact:true}).tap();
  await f.waitForFunction(di=>week[di].groupKinds&&week[di].groupKinds['A팀']==='OFF',DI);
  await page.waitForTimeout(500);
  // 저장본: 조별 OFF 만 적힌다 — 하루의 «훈련» · 세션은 그대로(되돌리면 다시 보인다)
  const raw=await f.evaluate(di=>({sched:week[di].board.sched,off:!!week[di].off,n:week[di].trainings.length,gk:week[di].groupKinds}),DI);
  assert.deepEqual(raw,{sched:'훈련',off:false,n:1,gk:{'A팀':'OFF'}});
  // ① 일정 칸: 종류 칩도 OFF
  const after=await cell();await page.screenshot({path:path.join(SHOTS,`sched-day-kind-${engine}-1-week.png`)});
  assert.equal(after.chip,'OFF ▾','종류 칩 '+JSON.stringify(after));assert.equal(after.off,true);assert.match(after.text,/A팀 · OFF/);assert.doesNotMatch(after.text,/17:00/);
  // ② 요약: «계획만» 없음 · 휴식 1
  const sum=await f.evaluate(()=>{const c=weekSummaryCount(week);return {plan:c.plan||0,off:c.off,ses:c.ses,text:document.body.innerText.includes('계획만')};});
  assert.deepEqual(sum,{plan:0,off:1,ses:sesBefore-1,text:false},'요약 '+JSON.stringify(sum));
  // ③ 주간 PDF(깔끔하게 · 자세히 같은 문서) · 일간 PDF: 그 날은 휴식
  const print=await f.evaluate(di=>{const col=k=>{const d=new DOMParser().parseFromString(__buildPrintDoc(k),'text/html');return [...d.querySelectorAll('.pwb-col')].map(c=>c.textContent.replace(/\s+/g,' '))[di];};
    const sIdx=dayIdx;dayIdx=di;let dayDoc='';try{dayDoc=new DOMParser().parseFromString(__buildPrintDoc('day'),'text/html').querySelector('.pdaybody').textContent.replace(/\s+/g,' ');}finally{dayIdx=sIdx;}
    return {weekboard:col('weekboard'),week:col('week'),day:dayDoc};},DI);
  for(const k of ['weekboard','week']){assert.match(print[k],/OFF/,k+' '+print[k]);assert.doesNotMatch(print[k],/세부 미정|17:00/,k+' '+print[k]);}
  assert.match(print.day,/휴식/);assert.doesNotMatch(print.day,/17:00|세부 미정/,'일간 PDF '+print.day);
  // ④ 팀 «오늘»: 그 날은 팀 훈련 없음
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:20000}).catch(()=>{});
  await page.locator('#teamNav [data-team-key="today"]').first().click();
  const s=await (await page.waitForSelector('#fScout',{state:'attached'})).contentFrame();
  await s.waitForFunction(di=>{try{const d=PSSchedule.view('').weeks[0][di];return d&&d.off===true&&d.board.sched==='OFF';}catch(_){return false;}},DI,{timeout:30000});
  const off=await s.evaluate(di=>{const today=(new Date().getDay()+6)%7,o=di-today;return {o,ses:(()=>{const r=ckSession(o);return {kind:r.kind,title:r.title,time:r.time};})()};},DI);
  assert.equal(off.ses.kind,'off','«오늘» 카드 '+JSON.stringify(off));assert.equal(off.ses.time,'');assert.doesNotMatch(off.ses.title,/팀 훈련$/);
  const tab=s.locator('[aria-label^="화 "],[title^="화 "]').first();await tab.waitFor({state:'visible',timeout:20000});
  const tabText=await tab.innerText();assert.match(tabText,/OFF/,'이번 주 띠 '+tabText);assert.doesNotMatch(tabText,/17:00|팀 훈련/);
  await tab.tap();await page.waitForTimeout(700);await page.screenshot({path:path.join(SHOTS,`sched-day-kind-${engine}-2-hub.png`)});
  const hub=await s.evaluate(()=>document.body.innerText);
  assert.match(hub,/팀 훈련 없음/);
  // 서버로 간 문서도 조별 OFF 만 — 하루를 OFF 로 고쳐 쓰지 않는다
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:20000}).catch(()=>{});
  const srv=serverDay();assert.equal(srv.board.sched,'훈련');assert.equal(srv.trainings.length,1);assert.deepEqual(srv.groupKinds,{'A팀':'OFF'});assert.ok(!srv.off);
  // 되돌리면(그 조를 훈련으로) 세션이 그대로 돌아온다
  await page.locator('#teamNav [data-team-key="training"]').click();
  await f.evaluate(di=>wksSetGroupKind(di,'A팀','훈련'),DI);await page.waitForTimeout(400);
  const back=await cell();assert.equal(back.chip,'훈련 ▾');assert.match(back.text,/17:00/);
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true,after,sum,print,hub:off.ses}));
  await page.context().close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
