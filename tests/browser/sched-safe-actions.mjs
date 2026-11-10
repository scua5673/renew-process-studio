import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
// 일정의 «잃기 쉬운 동작» 셋(코치로 일정을 돌려 보다 찾음) — 아이패드 크기 · 실제 탭.
// (a) 세션 ×: 좁은 칸에서 × · 시각이 칸 밖으로 잘렸고(«A팀 · B팀» 날은 × 가 안 보였다), 지운 뒤 되돌릴 길이 화면 맨 아래 ⋯ 뿐이었다
//     → × 는 칸 안 · 누르는 자리 44px · 지운 직후 «세션을 지웠어요 · 되돌리기»(원래 되돌리기 기록) — studio/schedule-del-undo.js
// (b) «지난주 복사»가 이번 주에 이미 잡힌 경기(상대 · 시각)를 덮었다 → 경기 날은 그대로(process.html boardCopyPrev)
// (c) «안 올라간 변경 있음» 줄이 편집마다 제 줄을 차지했다 사라져 주간 판이 56px 오르내렸다 → 판이 안 움직인다 — studio/schedule-syncline-steady.js
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine==='chromium')SIZES.ipad.engine='chromium';
SIZES.ipad.ctx={...SIZES.ipad.ctx,viewport:{width:1180,height:820}};
const fx=await startFixture(),browsers={};
const server=()=>JSON.parse(fx.db.get(WT+'|process_coach_v1').v);
const until=async(fn,ms,label)=>{const t0=Date.now();for(;;){const v=await fn();if(v)return v;if(Date.now()-t0>ms)assert.fail(label);await new Promise(r=>setTimeout(r,250));}};
try{
  const {page,context,logs}=await openApp(fx,'ipad',{browsers});
  await page.locator('#appSeg [data-team-hub]').click();await page.locator('#teamNav [data-team-key="training"]').click();
  const f=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof week!=='undefined'&&week&&week[3]&&week[3].trainings.length===1&&document.querySelectorAll('.wks-day').length===7,null,{timeout:30000});
  await page.waitForTimeout(600);
  const shot=n=>page.screenshot({path:path.join(SHOTS,`sched-safe-actions-${engine}-${n}.png`)});
  const TH=3;   // 목요일 — «A팀 · B팀» 17:00 · 메모만 있는 세션(× 한 번에 지워진다)

  // ── (c) 먼저 자리를 잰다(아무 편집도 하기 전)
  const place=()=>f.evaluate(()=>{const r=e=>{const q=document.querySelector(e).getBoundingClientRect();return {t:Math.round(q.top),l:Math.round(q.left)};};const b=document.getElementById('schedSync');
    return {grid:r('.wks-day').t,grp:r('#schedGrp').l,toggle:r('#vtoggle').t,line:b.textContent.trim(),att:b.classList.contains('att'),steady:b.classList.contains('ps-ss-steady'),h:Math.round(b.getBoundingClientRect().height)};});
  const redraw=()=>f.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'ps_sync_meta'})));   // 그 줄은 동기화 메타가 바뀔 때 다시 그린다
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  await until(async()=>{await redraw();return !(await place()).att;},30000,'처음엔 손쓸 일이 없다 '+JSON.stringify(await place()));
  const p0=await place();

  // ── (a) × 는 칸 안에 · 44px
  const head=await f.evaluate(di=>{const day=document.querySelectorAll('.wks-day')[di],sh=day.querySelector('.wks-sh'),R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
    const d=R(day),x=sh.querySelector(':scope>.wks-x'),xr=R(x),tm=R(sh.querySelector(':scope>b')),cs=getComputedStyle(x);
    const at=(px,py)=>{const e=document.elementFromPoint(px,py);return !!e&&e===x;};const cy=xr.t+xr.h/2,cx=xr.l+xr.w/2;
    return {day:d,x:xr,time:tm,label:sh.querySelector('.wks-grp').textContent,fs:cs.fontSize,bg:cs.backgroundColor,coarse:matchMedia('(pointer:coarse)').matches,
      hit:{center:at(cx,cy),left:at(xr.r+4-44+2,cy),right:at(Math.min(xr.r+2,d.r-3),cy),up:at(cx,cy-21),down:at(cx,cy+21)},
      /* 44px 자리가 옆 단추(시각 · 조)를 덮지 않는다 */ timeOwn:(()=>{const e=document.elementFromPoint(tm.l+tm.w/2,tm.t+tm.h/2);return !!e&&e===sh.querySelector(':scope>b');})(),
      grpOwn:(()=>{const g=sh.querySelector('.wks-grp'),q=g.getBoundingClientRect(),e=document.elementFromPoint(q.right-3,q.top+q.height/2);return !!e&&(e===g||g.contains(e));})()};},TH);
  assert.equal(head.label,'A팀 · B팀');
  assert.ok(head.x.l>=head.day.l&&head.x.r<=head.day.r+.5,'× 가 칸 안에 있다 '+JSON.stringify({x:head.x,day:head.day}));
  assert.ok(head.time.l>=head.day.l&&head.time.r<=head.day.r+.5,'시각이 잘리지 않는다 '+JSON.stringify({time:head.time,day:head.day}));
  assert.ok(head.x.w<26&&head.fs==='14px','× 모양은 그대로 '+JSON.stringify(head.x));
  assert.equal(head.hit.center,true);assert.ok(head.timeOwn&&head.grpOwn,'누르는 자리가 시각 · 조 단추를 덮지 않는다');
  if(head.coarse)assert.deepEqual(head.hit,{center:true,left:true,right:true,up:true,down:true},'손가락 자리 44px '+JSON.stringify(head.hit));
  // 글자 밖(왼쪽 16px)을 눌러 지운다 → 알림 → 되돌리기
  const fr=await (await f.frameElement()).boundingBox();
  const before=await f.evaluate(di=>JSON.stringify(week[di].trainings),TH);
  await page.touchscreen.tap(fr.x+head.x.l+head.x.w/2-(head.coarse?16:0),fr.y+head.x.t+head.x.h/2);
  await f.waitForFunction(di=>week[di].trainings.length===0,TH,{timeout:5000});
  const toast=f.locator('#mpUndo');await toast.waitFor({state:'visible',timeout:3000});await shot('1-undo-toast');
  assert.match(await toast.innerText(),/세션을 지웠어요[\s\S]*되돌리기/);
  const ub=await toast.locator('button').boundingBox();if(head.coarse)assert.ok(ub.height>=44,'되돌리기 단추 높이 '+ub.height);
  await toast.locator('button').tap();
  await f.waitForFunction(di=>week[di].trainings.length===1,TH,{timeout:5000});
  assert.equal(await f.evaluate(di=>JSON.stringify(week[di].trainings),TH),before,'앱을 열고 처음 한 편집도 그대로 돌아온다');
  assert.equal(await toast.count(),0);
  await until(()=>JSON.stringify(server().weeks[0][TH].trainings)===before,30000,'서버에도 되돌아온 세션');
  // 내용이 있는 세션(확인 창) → «확인» 뒤에 알림, 되돌리면 칩까지
  await f.evaluate(di=>{const d=week[di],b=dayBoard(d),sl=d.trainings[0].slot;b.trains=['가상 론도'];b.trainSlot=[sl];b.trainData=[{minutes:10}];b.trainThemes=[''];save();syncViews();},TH);
  await page.waitForTimeout(400);
  const full=await f.evaluate(di=>JSON.stringify([week[di].trainings,dayBoard(week[di]).trains,dayBoard(week[di]).trainSlot]),TH);
  await f.locator('.wks-day').nth(TH).locator('.wks-sh>.wks-x').tap();
  const ok=f.getByRole('button',{name:'확인',exact:true});await ok.waitFor({state:'visible',timeout:3000});
  assert.equal(await f.evaluate(di=>week[di].trainings.length,TH),1,'확인 전에는 안 지워진다');assert.equal(await toast.count(),0,'확인 전에는 알림도 없다');
  await ok.tap();await f.waitForFunction(di=>week[di].trainings.length===0,TH);await toast.waitFor({state:'visible',timeout:3000});
  await toast.locator('button').tap();await f.waitForFunction(di=>week[di].trainings.length===1,TH);
  assert.equal(await f.evaluate(di=>JSON.stringify([week[di].trainings,dayBoard(week[di]).trains,dayBoard(week[di]).trainSlot]),TH),full);
  // 그 사이 다른 편집이 있었으면 엉뚱한 것을 되돌리지 않는다
  await f.locator('.wks-day').nth(TH).locator('.wks-sh>.wks-x').tap();await ok.tap();await toast.waitFor({state:'visible',timeout:3000});
  await f.evaluate(()=>{week[0].meeting='다른 편집';save();});await page.waitForTimeout(200);
  await toast.locator('button').tap();await page.waitForTimeout(400);
  assert.deepEqual(await f.evaluate(di=>({th:week[di].trainings.length,mon:week[0].meeting}),TH),{th:0,mon:'다른 편집'},'뒤의 편집을 되돌리지 않는다');
  assert.match(await f.evaluate(()=>(document.getElementById('psToast')||{}).textContent||''),/다른 편집이 있어요/);
  // 알림은 7초쯤 뒤 스스로 걷힌다
  await f.evaluate(()=>doUndo());await f.evaluate(()=>doUndo());await f.waitForFunction(di=>week[di].trainings.length===1,TH);
  await f.locator('.wks-day').nth(TH).locator('.wks-sh>.wks-x').tap();await ok.tap();await toast.waitFor({state:'visible',timeout:3000});const shown=Date.now();
  await toast.waitFor({state:'detached',timeout:10000});const life=Date.now()-shown;assert.ok(life>=5000&&life<=9500,'알림이 떠 있는 시간 '+life);
  await f.evaluate(()=>doUndo());await f.waitForFunction(di=>week[di].trainings.length===1,TH);

  // ── (c) 끊긴 동안 고치면 «안 올라간 변경 있음» — 판 · 조 고르개가 안 움직인다
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  await until(async()=>{await redraw();return !(await place()).att;},30000,'편집이 올라간 뒤엔 평소 줄');
  const p1=await place();assert.deepEqual({grid:p1.grid,grp:p1.grp},{grid:p0.grid,grp:p0.grp},'평소 자리 '+JSON.stringify([p0,p1]));
  await context.setOffline(true);
  await f.evaluate(()=>{week[0].meeting='끊긴 동안';save();});await page.waitForTimeout(500);
  await redraw();
  await f.waitForFunction(()=>/안 올라간 변경 있음/.test(document.getElementById('schedSync').textContent),null,{timeout:10000});
  const p2=await place();await shot('2-unpushed');
  assert.deepEqual({grid:p2.grid,grp:p2.grp,toggle:p2.toggle},{grid:p0.grid,grp:p0.grp,toggle:p0.toggle},'안 올라간 변경이 떠도 판이 안 움직인다 '+JSON.stringify([p0,p2]));
  assert.equal(p2.att,true,'본문은 예전처럼 «손쓸 일 있음»으로 그린다');assert.equal(p2.steady,true);
  const warn=await f.evaluate(()=>{const b=document.getElementById('schedSync'),w=b.querySelector('.ss-warn').getBoundingClientRect(),o=b.getBoundingClientRect(),n=document.getElementById('schedSyncNow').getBoundingClientRect();
    return {in:w.left>=o.left-1&&w.right<=n.left+1,btn:document.getElementById('schedSyncNow').textContent,bw:n.width,bh:n.height,inBox:n.right<=o.right+1};});
  assert.ok(warn.in&&warn.inBox,'경고 글과 단추가 다 보인다 '+JSON.stringify(warn));assert.equal(warn.btn,'지금 주고받기');
  await context.setOffline(false);
  await f.locator('#schedSyncNow').tap();
  await until(()=>server().weeks[0][0].meeting==='끊긴 동안',30000,'다시 이어지면 올라간다');
  await until(async()=>{await redraw();const p=await place();return !p.att&&!/✓|보류|실패/.test(p.line);},40000,'걷힌 뒤 평소 줄');
  const p3=await place();assert.deepEqual({grid:p3.grid,grp:p3.grp},{grid:p0.grid,grp:p0.grp},'걷힌 뒤에도 같은 자리 '+JSON.stringify([p0,p3]));

  // ── (b) 다음 주(토요일 «가상 원정 유나이티드» 11:00 경기가 이미 잡혀 있다)에서 «지난주 복사»
  await f.locator('button[onclick="gotoWeek(1)"]').tap();
  await f.waitForFunction(()=>wk===1&&week[5]&&week[5].board&&week[5].board.opp==='가상 원정 유나이티드');
  const sat=await f.evaluate(()=>JSON.stringify(week[5])),prevTue=await f.evaluate(()=>weeksMap[0][1].trainings[0].note);
  const copy=f.locator('button[onclick="boardCopyPrev()"]');await copy.scrollIntoViewIfNeeded();await copy.tap();
  const dlgOk=f.getByRole('button',{name:'확인',exact:true});await dlgOk.waitFor({state:'visible',timeout:3000});
  const ask=await f.evaluate(()=>[...document.querySelectorAll('body>div')].map(d=>d.textContent).find(t=>/지난주 일정/.test(t))||'');
  assert.match(ask,/이번 주에 잡힌 경기 1일은 그대로 두고 나머지 날만 덮어씀/,'확인 문장 '+ask);await shot('3-copy-confirm');
  await dlgOk.tap();
  await f.waitForFunction(n=>week[1].trainings[0]&&week[1].trainings[0].note===n,prevTue);
  assert.equal(await f.evaluate(()=>JSON.stringify(week[5])),sat,'이미 잡힌 경기 날은 한 글자도 안 바뀐다');
  assert.equal(await f.evaluate(()=>week[3].trainings[0].note),'가상 훈련 목','나머지 날은 지난주 그대로');
  await until(()=>{const s=server().weeks[1];return s[5].board.opp==='가상 원정 유나이티드'&&s[5].board.time==='11:00'&&s[1].trainings[0].note===prevTue;},30000,'서버의 다음 주 경기도 그대로');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true,head:{x:head.x,time:head.time,hit:head.hit},place:[p0,p2,p3],life,ask}));
  await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
