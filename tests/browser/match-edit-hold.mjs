import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.135 — 제보 0ce6d0cc «경기준비 글씨 넣는 상자에 글씨가 안넣어집니다»: 경기 문서가 «팀 자료 확인 중»(matchDocPending)이면 글 칸에 쓴 글이
// 저장되지 않고 다음 그리기에 사라졌다 · 그 뒤엔 칸이 잠겼다. 이제 글 칸은 열어 두고 받아 둔다(match-edit-hold.js) — 확인이 끝나면 저장.
// 합성 팀 fixture 에서만 돈다(확인 중은 matchDocPending 을 바꿔 흉내낸다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||'desktop';
const fx=await startFixture(),browsers={};
let cur='';
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchLoad==='function'&&window.__psMatchHold&&window.matchSetFields&&window.matchSetFields.__psHold&&(matchLoad().matches||[]).length>0,null,{timeout:30000});
  await sf.evaluate(()=>{const m=matchLoad().matches[0];setView('match');matchOpen(m.id);matchTab='prep';matchStage='prep';renderMatch();});
  await page.waitForTimeout(1000);
  const st=()=>sf.evaluate(()=>{const sh=document.querySelector('.match-shell'),ta=document.querySelector('[data-match-field="attack"]'),m=matchGet();return {ro:sh.classList.contains('readonly'),hold:sh.classList.contains('ps-hold'),pending:matchDocPending(),disabled:ta.disabled,pe:getComputedStyle(ta).pointerEvents,val:ta.value,saved:m.attack||'',state:(document.getElementById('matchSavedState')||{}).textContent,held:JSON.stringify(window.__psMatchHold.hold)};});
  const focusEnd=()=>sf.evaluate(()=>{const ta=document.querySelector('[data-match-field="attack"]');ta.scrollIntoView();ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);});

  cur='healthy';
  await focusEnd();await page.keyboard.type('하프라인 압박');await page.waitForTimeout(500);
  let s=await st();
  assert.equal(s.saved,'하프라인 압박','보통 때는 경기 화면이 바로 저장');assert.equal(s.hold,false);

  cur='pending';
  await sf.evaluate(()=>{window.__origPending=window.matchDocPending;window.matchDocPending=function(){return true;};renderMatch();});
  await page.waitForTimeout(600);
  s=await st();
  assert.equal(s.ro,true,'확인 중은 보기 전용 틀');assert.equal(s.hold,true,'막힌 까닭이 확인 중뿐 — ps-hold');
  assert.equal(s.disabled,false,'글 칸은 열려 있다');assert.equal(s.pe,'auto','눌러진다');
  await focusEnd();await page.keyboard.type(' → 되찾으면 측면');await page.waitForTimeout(400);
  s=await st();
  assert.equal(s.val,'하프라인 압박 → 되찾으면 측면');assert.equal(s.saved,'하프라인 압박','아직 문서에는 안 넣는다');
  assert.match(s.held,/되찾으면 측면/,'받아 둔다 '+s.held);assert.match(s.state,/확인되면 저장돼요/,'상태 줄 '+s.state);
  await sf.evaluate(()=>renderMatch());await page.waitForTimeout(600);
  s=await st();
  assert.equal(s.val,'하프라인 압박 → 되찾으면 측면','다시 그려도 쓴 글이 남는다');assert.equal(s.disabled,false);
  await page.screenshot({path:path.join(SHOTS,`match-edit-hold-${engine}-${size}-pending.png`)});

  cur='ready';
  await sf.evaluate(()=>{window.matchDocPending=window.__origPending;});
  await sf.waitForFunction(()=>(matchGet().attack||'')==='하프라인 압박 → 되찾으면 측면',null,{timeout:5000});
  await page.waitForTimeout(900);
  s=await st();
  assert.equal(s.saved,'하프라인 압박 → 되찾으면 측면','확인이 끝나면 저장');assert.equal(s.held,'{}','받아 둔 것은 비운다');assert.equal(s.hold,false);assert.equal(s.ro,false);
  assert.ok(/자동 저장|저장 중/.test(s.state),'상태 줄 '+s.state);

  cur='player';   // 선수 역할은 예전처럼 잠긴다(글 칸을 열지 않는다)
  await sf.evaluate(()=>{window.__origRole=window.matchRole;window.matchRole=function(){return 'player';};window.matchDocPending=function(){return true;};renderMatch();});
  await page.waitForTimeout(600);
  s=await st();
  assert.equal(s.hold,false);assert.equal(s.disabled,true,'선수는 잠긴 채');
  await sf.evaluate(()=>{window.matchRole=window.__origRole;window.matchDocPending=window.__origPending;renderMatch();});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'오류 없음');
  console.log('match-edit-hold ok');
}catch(e){ console.error('match-edit-hold failed at',cur); throw e; }
finally{ for(const b of Object.values(browsers))await b.close(); await fx.close(); }
