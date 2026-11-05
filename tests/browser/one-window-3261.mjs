import assert from 'node:assert/strict';
import {startFixture,openApp,ready} from '../fixtures/team-app.mjs';
// 3.261 — 한 기기 한 창(합성 팀 fixture). 같은 브라우저 문맥(= 같은 기기 저장소)에 앱 창을 둘 띄운다:
//  · 새로 연 창(B)이 잠금을 가져가고, 먼저 있던 창(A)은 안내 화면으로 — 동기화를 싣지 않는다
//  · A 가 물러나도 팀 사본이 남는다(닫기 정리 wipeTeamCacheSoft 는 15초 넘게 산 창에서 서버와 같은 사본을 지운다 — 우리 새로고침 표시로 건너뛴다)
//  · 안내 화면의 «이 창에서 계속하기» → A 가 다시 쥐고 B 가 물러난다
//  · 숨은 채 열린 창(H)은 뺏지 않고 스스로 물러난다
//  · 쥔 창을 닫으면 안내 화면의 창이 저절로 다시 연다
//  · 쥔 창을 새로고침해도 덮개 없이 그대로(옛 문서가 새 문서를 만지지 않는다)
//  · 서버 기록 window_elsewhere
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('one-window-3261 '+s);};
const errs=[];const watch=(p,n)=>p.on('pageerror',e=>{if(!/ResizeObserver loop/.test(e.message))errs.push(n+': '+e.message);});
const TEAM=/^(scout_tool_v1|cs_team_v1|process_coach_v1|cs_squad_v1|cs_team_attrs_v1|cs_perms_v1)$/;
const teamKeys=p=>p.evaluate(re=>Object.keys(localStorage).filter(k=>new RegExp(re).test(k)).sort(),TEAM.source);
const mode=p=>p.evaluate(()=>window.__psOneWindow&&window.__psOneWindow.mode);
try{
  const {context,page:A,logs}=await openApp(fx,size,{browsers});
  step('a-held');
  await A.waitForFunction(()=>window.__psOneWindow&&window.__psOneWindow.mode==='held',null,{timeout:15000});
  /* A 가 15초 넘게 살아야 닫기 정리가 «지워도 되는» 창이 된다 — 그래야 정리를 건너뛰는지 본다 */
  await A.waitForFunction(()=>performance.now()>16500,null,{timeout:30000});
  const before=await teamKeys(A);assert.ok(before.length>=3,'팀 사본 '+before.join(','));

  step('b-opens');
  const B=await context.newPage();B.setDefaultTimeout(45000);watch(B,'B');
  await B.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await A.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await ready(B);
  assert.equal(await mode(B),'held');
  assert.deepEqual(await teamKeys(B),before,'물러난 창이 팀 사본을 지우지 않는다');
  assert.equal(await A.locator('#ewTitle').textContent(),'다른 창에서 이어서 쓰고 있어요');
  assert.equal(await A.evaluate(()=>typeof window.PSSync),'undefined','안내 화면은 동기화를 싣지 않는다');
  assert.equal(await A.evaluate(()=>sessionStorage.getItem('ps_elsewhere_back')),'app.html');
  const box=await A.locator('.ew').boundingBox(),vw=A.viewportSize().width;
  assert.ok(box&&box.x>=16&&box.x+box.width<=vw-16,'안내 카드가 화면 안 '+JSON.stringify(box));

  step('a-takes-back');
  await A.locator('#ewHere').click();
  await A.waitForURL(/\/studio\/app\.html$/,{timeout:15000});
  await B.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await ready(A);
  assert.equal(await mode(A),'held');
  assert.deepEqual(await teamKeys(A),before,'되돌아와도 팀 사본 그대로');

  step('hidden-boot');
  const H=await context.newPage();watch(H,'H');
  await H.addInitScript(()=>{
    Object.defineProperty(Document.prototype,'hidden',{configurable:true,get(){return true;}});
    Object.defineProperty(Document.prototype,'visibilityState',{configurable:true,get(){return 'hidden';}});
  });
  await H.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await H.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await H.waitForTimeout(3600);   /* 안내 화면의 3초 확인이 한 번 지나도 숨은 창은 다시 열지 않는다 */
  assert.match(H.url(),/elsewhere\.html$/);
  assert.match(A.url(),/\/studio\/app\.html$/);assert.equal(await mode(A),'held','숨은 창은 뺏지 않는다');
  await H.close();

  step('auto-return');
  await A.close();
  await B.waitForURL(/\/studio\/app\.html$/,{timeout:20000});
  await ready(B);
  assert.equal(await mode(B),'held');

  step('reload');
  /* 같은 탭 새로고침 — 새 문서가 잠금을 가져가고 «뺏김»은 떠나는 옛 문서가 받는다. 옛 문서가 새 문서를 덮거나 보내면 안 된다(#770 첫 CI) */
  await B.reload({waitUntil:'domcontentloaded'});await ready(B);await B.waitForTimeout(3000);
  assert.match(B.url(),/\/studio\/app\.html$/);assert.equal(await mode(B),'held');
  assert.equal(await B.locator('#psElsewhereCover').count(),0,'새로고침한 창에 덮개가 없다');

  step('event');
  const t0=Date.now();let ev=[];
  while(Date.now()-t0<15000){ev=fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='window_elsewhere');if(ev.length>=2)break;await B.waitForTimeout(500);}
  assert.ok(ev.length>=2,'window_elsewhere '+ev.length);
  assert.ok(ev.every(r=>r.error_code==='stolen'&&/^(ok|none|timeout|fail:)/.test(r.meta.stage)),JSON.stringify(ev.map(r=>[r.error_code,r.meta])));

  step('errors');
  for(const l of logs)if(l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text))errs.push('A: '+l.text);
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('one-window-3261 ok',engine,size);
}catch(e){console.error('one-window-3261 실패 단계:',cur);throw e;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
