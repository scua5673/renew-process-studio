import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.332 — 주간 «이번 주 요약»의 강도 막대: 요일 축 → 경기를 넣으면 MD 축. 화면 값만 바꿔 본다(저장하지 않는다). PS_SIZE=phone|ipad|desktop
const size=process.env.PS_SIZE||'desktop';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine==='chromium'){SIZES.ipad.engine='chromium';SIZES.phone.engine='chromium';}
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,size,{browsers});
  const phone=size==='phone',hit=l=>size==='desktop'?l.click():l.tap();
  await hit(page.locator('#appSeg [data-team-hub]').first());
  await hit(page.locator(phone?'#teamBottom [data-tb="training"]':'#teamNav [data-team-key="training"]').first());
  const f=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof week!=='undefined'&&week&&week.length===7&&window.PSWeekIntensity&&document.getElementById('wkiHost'),null,{timeout:30000});
  if(phone)await f.locator('#psPhBar .sg button[data-sv="week"]').click();   /* 폰은 월간으로 열린다 */
  await f.waitForFunction(()=>document.querySelector('#vtoggle div[data-v="week"]').classList.contains('on')&&document.getElementById('wkiHost').getBoundingClientRect().width>0,null,{timeout:15000});
  await page.waitForTimeout(600);
  const read=()=>f.evaluate(()=>{const h=document.getElementById('wkiHost'),card=h.closest('.sumcard').getBoundingClientRect(),r=e=>e.getBoundingClientRect();
    const cols=[...h.querySelectorAll('.wki-col')];
    return {n:cols.length,sub:document.getElementById('wkiSub').textContent,after:h.previousElementSibling.previousElementSibling.id,
      md:cols.map(c=>(c.querySelector('.wki-md')||{textContent:null}).textContent),val:cols.map(c=>(c.querySelector('.wki-v')||{textContent:''}).textContent),
      barH:cols.map(c=>Math.round(([...c.querySelectorAll('.wki-bar')].map(b=>r(b).height)[0]||0))),plotH:Math.round(r(h.querySelector('.wki-bars')).height),
      vAbove:cols.every(c=>{const v=c.querySelector('.wki-v'),b=c.querySelector('.wki-bar');return !v||!b||r(v).bottom<=r(b).top+3;}),
      inside:[...h.querySelectorAll('.wki-col,.wki-md,.wki-d,.wki-cap,.wki-stat,.wki-leg')].every(e=>r(e).left>=card.left-0.5&&r(e).right<=card.right+0.5),
      overlap:cols.some((c,i)=>i&&['.wki-md','.wki-d','.wki-cap'].some(q=>{const a=cols[i-1].querySelector(q),b=c.querySelector(q);return a&&b&&a.textContent.trim()&&b.textContent.trim()&&r(a).right>r(b).left+0.5;})),
      scroll:document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,w:innerWidth,stat:(h.querySelector('.wki-stat')||{textContent:''}).textContent};});
  // ① 경기 없는 주 — 요일 축
  await f.evaluate(()=>{week.forEach(d=>{delete d.match;if(d.board&&d.board.sched==='경기')d.board.sched='';d.md='';d.mdManual=false;});
    const mk=(i,rpe)=>{const d=week[i];d.board=d.board||{};d.board.sched='훈련';d.off=false;if(!d.trainings.length)d.trainings.push({time:'17:00',blocks:[{dur:60}]});d.trainings[0].load={rpe};};
    mk(0,10);mk(1,6);mk(2,8);[3,4].forEach(i=>{week[i].trainings=[];week[i].board=Object.assign(week[i].board||{},{sched:'훈련'});});
    [5,6].forEach(i=>{week[i].trainings=[];week[i].off=true;week[i].board=Object.assign(week[i].board||{},{sched:'OFF'});});renderMix();});
  const a=await read();
  assert.equal(a.n,7);assert.ok(a.plotH>=72,'막대 칸이 보인다 '+a.plotH);assert.equal(a.after,'mixLegend','«주제 배분» 범례 바로 뒤');assert.equal(a.sub,'세션 RPE');
  assert.deepEqual(a.md,Array(7).fill(null));assert.deepEqual(a.val,['10','6','8','','','','']);
  assert.deepEqual(a.barH,[a.plotH,Math.round(a.plotH*.6),Math.round(a.plotH*.8),0,0,0,0].map(Math.round),JSON.stringify(a));
  assert.ok(a.vAbove&&a.inside&&!a.overlap&&a.scroll,size+' 요일 축 '+JSON.stringify(a));assert.match(a.stat,/8\.0/);
  await f.evaluate(()=>document.getElementById('wkiHost').scrollIntoView({block:'center'}));await page.waitForTimeout(300);await page.screenshot({path:path.join(SHOTS,`week-intensity-${engine}-${size}-1-days.png`)});
  // ② 토요일 경기 — MD 축
  await f.evaluate(()=>{week[5].off=false;week[5].board.sched='경기';week[5].match={time:'15:00',opp:'프로세스FC'};
    ['MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1'].forEach((m,i)=>{week[i].md=m;});renderMix();});
  const b=await read();
  assert.equal(b.sub,'세션 RPE · 경기 기준(MD)');assert.deepEqual(b.md,['MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD+1']);
  assert.equal(b.val[5],'9');assert.equal(b.barH[5],Math.round(b.plotH*.9));
  assert.ok(b.vAbove&&b.inside&&!b.overlap&&b.scroll,size+' MD 축 '+JSON.stringify(b));
  await page.screenshot({path:path.join(SHOTS,`week-intensity-${engine}-${size}-2-md.png`)});
  console.log(JSON.stringify({passed:true,size,engine,w:a.w,plotH:a.plotH}));
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}
