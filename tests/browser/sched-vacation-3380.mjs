import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.380 — 일정 종류 «휴가»(제보 9f762d66 · 목업 A안). 합성 팀에서: 빈 날 «일정 ＋» → 종류 칩에 «휴가»(OFF 다음) → 팀 공통 휴가 →
// 주간 카드 «휴가 ▾» · 빗금 · 요약 «휴식»에 세고 «휴가 1» · 다시 열면 «휴가» 칩이 켜짐 · 월간 칸 «휴가» · 새로고침 뒤에도 → OFF 로 바꾸면 표식이 걷힘 →
// 다른 빈 날에 A팀만 휴가(조 줄 «A팀 · 휴가»). 저장본은 OFF + 표식(day.vac · day.vacGrp). 실제 서버는 건드리지 않는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
if(engine==='chromium'){SIZES.ipad.engine='chromium';SIZES.phone.engine='chromium';}
const fx=await startFixture(),browsers={};
const out={engine,size,passed:false,steps:[]};
try{
  const {page}=await openApp(fx,size,{browsers}),phone=size==='phone',touch=size!=='desktop';
  const hit=l=>touch?l.tap():l.click();
  await page.waitForTimeout(2500);
  const open=async()=>{
    await page.evaluate(ph=>{document.querySelector('#appSeg [data-team-hub]').click();const b=document.querySelector(ph?'#teamBottom [data-tb="training"]':'#teamNav [data-team-key="training"]');if(b)b.click();},phone);
    const f=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>typeof week!=='undefined'&&week&&week.length===7&&typeof wksFill==='function'&&window.PSVac&&window.__psVacMounted&&document.querySelectorAll('.wks-day').length===7,null,{timeout:30000});
    return f;};
  let pf=await open();
  const view=async v=>{await pf.evaluate(({v,ph})=>{const lab={week:'주간',month:'월간'}[v];
      const b=ph?document.querySelector('#psPhBar .sg button[data-sv="'+v+'"]'):[...document.querySelectorAll('*')].find(x=>x.children.length===0&&x.textContent.trim()===lab&&x.offsetParent);if(b)b.click();},{v,ph:phone});await page.waitForTimeout(700);};
  await view('week');
  // 비어 있는 날 둘(오늘 · 훈련 · 경기 날이 아닌)
  const free=await pf.evaluate(()=>week.map((d,i)=>({i,busy:!!((d.trainings||[]).length||d.match||d.off||(d.board&&d.board.sched)||d.groupKinds)})).filter(x=>!x.busy).map(x=>x.i));
  assert.ok(free.length>=2,'빈 날 둘 '+JSON.stringify(free));
  const D1=free[0],D2=free[1],sheet=pf.locator('#sheet');
  const sum=()=>pf.evaluate(()=>{const c=[...document.querySelectorAll('#sumStrip > *')].map(e=>e.innerText.replace(/\s+/g,' ').trim());return c.find(t=>/휴식/.test(t))||'';});
  const card=di=>pf.evaluate(di=>{const d=week[di],el=document.querySelectorAll('.wks-day')[di],k=el.querySelector('.wks-kbtn'),r=k?k.getBoundingClientRect():null,cs=getComputedStyle(el);
    return {off:!!d.off,sched:(d.board||{}).sched||'',vac:d.vac,vg:d.vacGrp||null,gk:d.groupKinds||null,isVac:el.classList.contains('is-vac'),isOff:el.classList.contains('is-off'),kbtn:k?k.textContent.trim():'',kh:r?Math.round(r.height):0,
      hatch:/repeating-linear-gradient/.test(cs.backgroundImage),add:/세션 추가/.test(el.innerText),text:el.innerText.replace(/\n+/g,' | '),over:document.documentElement.scrollWidth-innerWidth};},di);
  const before=await sum();
  // 1) 종류 칩 — OFF 다음에 «휴가»
  await pf.evaluate(di=>wkbdPick(di,'sched'),D1);
  await sheet.locator('.fp',{hasText:'OFF'}).waitFor();
  const chips=await pf.evaluate(()=>[...document.querySelectorAll('#sheet .fp')].map(b=>b.textContent.trim()));
  assert.deepEqual(chips.slice(-3),['훈련','OFF','휴가'],'종류 칩 '+JSON.stringify(chips));
  if(SHOTS)await page.screenshot({path:path.join(SHOTS,'sched-vacation-pick-'+engine+'-'+size+'.png')});
  // 2) 팀 공통 휴가
  await hit(sheet.getByRole('button',{name:'팀 공통',exact:true}));
  await hit(sheet.locator('.fp',{hasText:'휴가'}));
  await pf.waitForFunction(di=>week[di].vac===true,D1,{timeout:10000});
  await pf.evaluate(()=>{if(document.getElementById('scrim').classList.contains('show'))closeSheet();});
  await page.waitForTimeout(500);
  if(phone)await view('week');   // 폰은 고른 뒤 월간으로 돌아와 있을 수 있다
  const c1=await card(D1);out.c1=c1;
  assert.deepEqual({off:c1.off,sched:c1.sched,vac:c1.vac,isVac:c1.isVac,isOff:c1.isOff,kbtn:c1.kbtn},{off:true,sched:'OFF',vac:true,isVac:true,isOff:true,kbtn:'휴가 ▾'},JSON.stringify(c1));
  assert.ok(c1.hatch,'빗금 바탕');assert.equal(c1.add,false,'휴가 날에는 세션 추가 자리가 없다');assert.ok(c1.over<=0,'가로 넘침 없음');assert.ok(c1.kh>=24,'이름표 높이 '+c1.kh);
  const s1=await sum();out.sum=[before,s1];
  assert.equal(parseInt(s1,10),(parseInt(before,10)||0)+1,'휴식에 센다 '+before+' → '+s1);assert.match(s1,/휴가 1/);
  if(SHOTS){await pf.evaluate(di=>document.querySelectorAll('.wks-day')[di].scrollIntoView({block:'center'}),D1);await page.waitForTimeout(300);await page.screenshot({path:path.join(SHOTS,'sched-vacation-week-'+engine+'-'+size+'.png')});}
  out.steps.push('whole');
  // 3) 다시 열면 «휴가» 칩이 켜져 있다(OFF 는 꺼짐)
  await pf.evaluate(di=>wkbdPick(di,'sched'),D1);
  await sheet.locator('.fp',{hasText:'휴가'}).waitFor();
  const on=await pf.evaluate(()=>[...document.querySelectorAll('#sheet .fp.on')].map(b=>b.textContent.trim()).filter(t=>/^(훈련|OFF|휴가)$/.test(t)));
  assert.deepEqual(on,['휴가']);
  await pf.evaluate(()=>closeSheet());
  // 4) 월간 칸
  await view('month');
  const cells=await pf.evaluate(()=>[...document.querySelectorAll('.mcell.is-vac')].map(c=>({t:c.innerText.replace(/\s+/g,' ').trim(),hatch:/repeating-linear-gradient/.test(getComputedStyle(c).backgroundImage),off:c.classList.contains('off')})));
  assert.equal(cells.length,1,JSON.stringify(cells));assert.match(cells[0].t,/휴가$/);assert.ok(cells[0].hatch&&cells[0].off);
  if(SHOTS)await page.screenshot({path:path.join(SHOTS,'sched-vacation-month-'+engine+'-'+size+'.png')});
  out.steps.push('month');
  // 5) 새로고침 뒤에도 — 기기 사본에 OFF + 표식
  await page.waitForTimeout(1500);
  await page.reload();await page.waitForTimeout(2500);
  pf=await open();await view('week');
  const c2=await card(D1);
  assert.deepEqual({off:c2.off,vac:c2.vac,kbtn:c2.kbtn},{off:true,vac:true,kbtn:'휴가 ▾'},'새로고침 뒤 '+JSON.stringify(c2));
  out.steps.push('reload');
  // 6) OFF 로 바꾸면 표식이 걷힌다
  await pf.evaluate(di=>wkbdPick(di,'sched'),D1);
  await hit(pf.locator('#sheet .fp',{hasText:'OFF'}));
  await pf.waitForFunction(di=>!('vac' in week[di])&&week[di].off===true,D1,{timeout:10000});
  await pf.evaluate(()=>{if(document.getElementById('scrim').classList.contains('show'))closeSheet();});
  await page.waitForTimeout(500);
  if(phone)await view('week');
  const c3=await card(D1);
  assert.deepEqual({isVac:c3.isVac,kbtn:c3.kbtn,hatch:c3.hatch},{isVac:false,kbtn:'OFF ▾',hatch:false},JSON.stringify(c3));
  assert.doesNotMatch(await sum(),/휴가/);
  out.steps.push('to-off');
  // 7) 다른 빈 날 — A팀만 휴가(창은 첫 조를 고른 채 열린다)
  await pf.evaluate(di=>wkbdPick(di,'sched'),D2);
  await pf.locator('#sheet .fp',{hasText:'휴가'}).waitFor();
  const g=await pf.evaluate(()=>(typeof __fillGroups!=='undefined'&&__fillGroups[0])||'');
  assert.ok(g,'고른 조가 있다');
  await hit(pf.locator('#sheet .fp',{hasText:'휴가'}));
  await pf.waitForFunction(({di,g})=>!!(week[di].vacGrp&&week[di].vacGrp[g]===1),{di:D2,g},{timeout:10000});
  await pf.evaluate(()=>{if(document.getElementById('scrim').classList.contains('show'))closeSheet();});
  await page.waitForTimeout(500);
  if(phone)await view('week');
  const c4=await card(D2);out.c4=c4;
  assert.equal(c4.gk[g],'OFF');assert.equal('vac' in (await pf.evaluate(di=>week[di],D2)),false,'하루 전체 표식은 없다');
  assert.match(c4.text,/ · 휴가/,'조 줄 '+c4.text);
  assert.equal(await pf.evaluate(()=>PSVac.err),'');
  out.steps.push('group');
  out.passed=true;
  console.log(JSON.stringify(out));
}catch(e){
  console.error('[sched-vacation-3380] failure',JSON.stringify(out));console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
