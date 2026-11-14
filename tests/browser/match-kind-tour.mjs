import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
// 3.287 — 경기 종류 «대회»(제보 39338d23 · 7f00f3c9, 사용자 11/14 «대회는 정식»): 주간 일정의 종류 칩 → 시트 → «대회»를 실제로 눌러
// 저장본 · 서버 문서(kind 'tour') · 칩 이름 · 월간 칸(색 · 이름) · 경기 목록(이름 · 공식전 전적) · 경기 정보 창(구분 넷 · «대회 이름»)을 본다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const size=process.env.PS_SIZE||'ipad';
if(engine==='chromium'){SIZES.ipad.engine='chromium';SIZES.phone.engine='chromium';}
const fx=await startFixture(),browsers={},DI=5;
const serverDay=()=>JSON.parse(fx.db.get(WT+'|process_coach_v1').v).weeks[0][DI];
try{
  const {page,logs}=await openApp(fx,size,{browsers}),phone=size==='phone',touch=size!=='desktop';
  const hit=l=>touch?l.tap():l.click();
  const press=sel=>hit(page.locator(sel).first());
  const go=key=>press(phone?'#teamBottom [data-tb="'+key+'"]':'#teamNav [data-team-key="'+key+'"]');
  await press('#appSeg [data-team-hub]');
  await go('training');
  const f=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof week!=='undefined'&&week&&week.length===7&&document.querySelectorAll('.wks-day').length===7&&window.PSMatchKind,null,{timeout:30000});
  await page.waitForTimeout(600);
  // 종류 칩 → 시트: 리그 · 컵 · 대회 · 친선 · 훈련 · OFF
  /* 폰 주간은 한 날씩 넘겨 보여 준다 — 그 날 칩의 원래 onclick(wkbdPick)을 부른다. 아이패드 · 데스크톱은 실제로 누른다 */
  if(phone)await f.evaluate(di=>document.querySelectorAll('.wks-day')[di].querySelector('.wks-kbtn').click(),DI);
  else await hit(f.locator('.wks-day').nth(DI).locator('.wks-kbtn'));
  const sheet=f.locator('#sheet');await sheet.locator('#wfSec-kind').waitFor();
  const names=await sheet.locator('#wfSec-kind .fmtpick button').allInnerTexts();
  assert.deepEqual(names.map(s=>s.trim()),['리그','컵','대회','친선','훈련','OFF'],'종류 단추 '+JSON.stringify(names));
  await page.waitForTimeout(700);
  const kindRow=await f.evaluate(()=>{const bs=[...document.querySelectorAll('#wfSec-kind .fmtpick button')].map(b=>b.getBoundingClientRect());return {rows:new Set(bs.map(r=>Math.round(r.top))).size,right:Math.max(...bs.map(r=>r.right)),vw:innerWidth};});
  assert.ok(kindRow.right<=kindRow.vw,'종류 단추가 화면 안 '+JSON.stringify(kindRow));
  await page.screenshot({path:path.join(SHOTS,`match-kind-tour-${size}-1-sheet.png`)});
  await hit(sheet.locator('#wfSec-kind').getByRole('button',{name:'대회',exact:true}));
  await f.waitForFunction(di=>week[di].match&&week[di].match.kind==='tour'&&dayBoard(week[di]).sched==='경기',DI);
  await page.waitForTimeout(400);
  await f.evaluate(()=>{try{closeSheet();}catch(_){}});
  await page.waitForTimeout(300);
  const chip=(await f.evaluate(di=>document.querySelectorAll('.wks-day')[di].querySelector('.wks-kbtn').textContent,DI)).trim();
  assert.equal(chip,'대회 ▾','주간 칩');
  await page.screenshot({path:path.join(SHOTS,`match-kind-tour-${size}-2-week.png`)});
  // 서버 문서도 tour
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(500);
  assert.equal(serverDay().match.kind,'tour','서버 일정');
  // 월간: 칸 면 · 배지
  if(phone)await f.evaluate(()=>document.querySelector('#vtoggle div[data-v="month"]').click());else await hit(f.locator('#vtoggle div[data-v="month"]'));
  await f.waitForFunction(()=>document.querySelector('#monthGrid .mcell.m.tour .mkind.k-tour'),null,{timeout:15000});
  const month=await f.evaluate(()=>{const c=document.querySelector('#monthGrid .mcell.m.tour'),b=c.querySelector('.mkind.k-tour'),cs=getComputedStyle(b),cc=getComputedStyle(c);
    return {badge:b.textContent.trim(),bg:cs.backgroundColor,fg:cs.color,cell:cc.backgroundColor,top:cc.borderTopColor};});
  assert.equal(month.badge,'대회');assert.equal(month.bg,'rgb(14, 116, 144)','배지 색 '+JSON.stringify(month));
  assert.notEqual(month.cell,'rgba(0, 0, 0, 0)','칸 면');
  await page.screenshot({path:path.join(SHOTS,`match-kind-tour-${size}-3-month.png`)});
  // 월간 팝업의 종류도 넷
  await hit(f.locator('#monthGrid .mcell.m.tour').first());
  await f.locator('.mpop .mp-kind').waitFor();
  const pop=await f.evaluate(()=>[...document.querySelectorAll('.mpop .mp-kind button')].map(b=>b.dataset.mk+':'+b.textContent.trim()+(b.classList.contains('on')?'*':'')));
  assert.deepEqual(pop,['official:리그','cup:컵','tour:대회*','friendly:친선'],'월간 팝업 '+JSON.stringify(pop));
  await page.waitForTimeout(300);
  const popBox=await f.evaluate(()=>{const r=document.querySelector('.mpop').getBoundingClientRect(),b=[...document.querySelectorAll('.mpop .mp-kind button')].map(x=>x.getBoundingClientRect());return {left:r.left,right:r.right,vw:innerWidth,last:b[b.length-1].right};});
  assert.ok(popBox.left>=0&&popBox.right<=popBox.vw&&popBox.last<=popBox.vw,'월간 팝업이 화면 안(토요일 칸 — 오른쪽 끝) '+JSON.stringify(popBox));
  await page.screenshot({path:path.join(SHOTS,`match-kind-tour-${size}-4-month-pop.png`)});
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  // 경기 목록: 일정에서 온 경기가 «대회» · 공식전으로 센다
  await go('match');
  const s=await (await page.waitForSelector('#fScout',{state:'attached'})).contentFrame();
  await s.waitForFunction(()=>{try{return (matchLoad().matches||[]).some(m=>m.kind==='tour');}catch(_){return false;}},null,{timeout:30000});
  await page.waitForTimeout(800);
  const list=await s.evaluate(()=>{const m=(matchLoad().matches||[]).find(x=>x.kind==='tour');return {id:m.id,label:matchKindLabel(m),of:matchKindOf(m),
    shown:[...document.querySelectorAll('.mr-kind')].map(e=>e.textContent.trim())};});
  assert.equal(list.label,'대회');assert.equal(list.of,'official','공식전 전적');
  assert.ok(list.shown.includes('대회'),'목록에 대회 '+JSON.stringify(list.shown));
  await page.screenshot({path:path.join(SHOTS,`match-kind-tour-${size}-5-matches.png`)});
  // 경기 정보 창: 구분 넷(대회 골라짐) · «대회 이름»
  await s.evaluate(id=>matchEditOne(id),list.id);
  await page.waitForTimeout(500);
  const form=await s.evaluate(()=>{const t=document.body.innerText;const seg=[...document.querySelectorAll('button')].filter(b=>['리그','컵','대회','친선'].includes(b.textContent.trim())&&b.closest('[class*="form"],[id*="form"],[class*="sheet"],[role="dialog"]'));
    return {seg:seg.map(b=>b.textContent.trim()+(/\bon\b|active|sel/.test(b.className)||b.getAttribute('aria-pressed')==='true'?'*':'')),name:/대회 이름/.test(t)};});
  assert.ok(form.name,'대회 이름 칸');
  await page.screenshot({path:path.join(SHOTS,`match-kind-tour-${size}-6-match-form.png`)});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true,names,kindRow,chip,month,pop,popBox,list:{label:list.label,of:list.of},form}));
  await page.context().close();
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
