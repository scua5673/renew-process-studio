import assert from 'node:assert/strict';
import {startFixture,openApp,visibleFrameId} from '../fixtures/team-app.mjs';
// 3.080 — 고리: 학습 «내 게임모델에 담기» → 개인 게임모델(보관함 › 게임모델) → «이 단계로 훈련 만들기» → 훈련 설계(제목 · 국면 · 코칭 포인트)
//          → 게임모델 단계의 «보관함 훈련 n개». 팀 게임모델은 건드리지 않는다. 작전판 편집이 되는 화면(데스크톱)에서만.
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  const teamBefore=await page.evaluate(()=>localStorage.getItem('cs_gamemodel_v1'));
  await page.evaluate(()=>window.__psShowApp('learning'));
  const lf=await (await page.waitForSelector('#fLearning')).contentFrame();
  await lf.waitForSelector('#p-toc');
  await lf.waitForFunction(()=>window.BOOKS&&BOOKS.studio);
  await lf.evaluate(()=>{ BOOK=BOOKS.studio; openSec('SG2'); bookState.step=2; render(); });
  await lf.waitForSelector('[data-keep]');
  await lf.fill('#keepT','공을 잃으면 가까운 둘이 즉시 압박한다');
  await lf.click('[data-keep]');
  await page.waitForFunction(()=>{ try{ const m=JSON.parse(localStorage.getItem('cs_gamemodel_personal_v1')||'null'); return JSON.stringify(m&&m.moments||[]).includes('가까운 둘이 즉시 압박'); }catch(_){ return false; } },null,{timeout:15000});
  assert.equal(await visibleFrameId(page),'fGameModel','담으면 내 게임모델이 열린다');
  assert.equal(await page.evaluate(()=>localStorage.getItem('cs_gamemodel_v1')),teamBefore,'팀 게임모델은 그대로');
  const gm=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_personal_v1')).moments.map(m=>[m.key,m.phases[0].principles]));
  assert.deepEqual(gm,[['dt',['공을 잃으면 가까운 둘이 즉시 압박한다']]]);
  // 같은 요청이 여러 번 와도 한 줄
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_personal_v1')).moments[0].phases[0].principles.length),1);

  const gf=await (await page.$('#fGameModel')).contentFrame();
  await gf.waitForSelector('.gm-mkdrill-b');
  await gf.click('.gm-mkdrill-b');
  const bf=await (await page.waitForSelector('#fBoard')).contentFrame();
  await bf.waitForFunction(()=>document.getElementById('editorModal')&&document.getElementById('editorModal').classList.contains('on'),null,{timeout:15000});
  const ed=await bf.evaluate(()=>({name:editorDraft.name,coaching:editorDraft.coaching,ph:editorDraft.gmPhases,on:[...document.querySelectorAll('.ep-ph.on')].map(b=>b.getAttribute('data-ph'))}));
  assert.equal(ed.name,'공을 잃으면 가까운 둘이 즉시 압박한다');
  assert.equal(ed.coaching,'공을 잃으면 가까운 둘이 즉시 압박한다');
  assert.deepEqual(ed.ph,['std_dt_1'],'편집기의 표준 국면 칩으로 고른다');
  assert.deepEqual(ed.on,['std_dt_1']);

  // 보관함에 그 국면 훈련이 있으면 게임모델 단계에 수가 보인다(표준 id 도 같은 이름 단계로 센다)
  await gf.evaluate(async()=>{ const cur=await window.storage.get('cs_drill_lib_v1'); const lib=JSON.parse((cur&&cur.value)||'[]'); lib.push({id:'loop-x',name:'고리',type:'train',gmPhases:['std_dt_1']}); await window.storage.set('cs_drill_lib_v1',JSON.stringify(lib)); });
  await page.evaluate(()=>fGameModel.contentWindow.postMessage({source:'app',type:'gmAddPrinciple',momentKey:'dt',text:'두 번째 원칙',req:'loop-2'},'*'));
  await gf.waitForFunction(()=>[...document.querySelectorAll('.gm-mkdrill-n')].some(e=>e.textContent==='보관함 훈련 1개'),null,{timeout:10000});

  // 학습 3장: 내 원칙으로 훈련 만들기 목록
  await page.evaluate(()=>window.__psShowApp('learning'));
  await lf.evaluate(()=>{ BOOK=BOOKS.studio; openSec('ST1'); bookState.step=2; render(); });
  const picks=await lf.$$eval('[data-mkdrill]',x=>x.map(b=>b.textContent));
  assert.ok(picks.some(t=>t.includes('가까운 둘이 즉시 압박')),'내 원칙이 고르개에 보인다');

  // 3.080 — 진행판(학습 첫 화면): 국면 1/4 · 원칙 단계 1곳 중 1곳(보관함 훈련 기준)
  await lf.evaluate(()=>{ S.role='coach'; go('toc'); });
  await lf.waitForFunction(()=>{ render(); const t=(document.querySelector('.loopbox')||{}).textContent||''; return t.includes('국면 1/4')&&t.includes('1곳 중 1곳'); },null,{timeout:10000,polling:500});
  assert.match(await lf.$eval('.lp-next',e=>e.textContent),/아직 약속이 없는 국면: 공격 조직 · 수비 조직 · 수비 → 공격 전환/);

  // 3.080 — 게임모델 단계 → 커뮤니티(같은 세부 국면으로 걸러서)
  await page.evaluate(()=>{ currentTeamKey=''; window.__psShowApp('gamemodel'); });
  await gf.waitForSelector('.gm-comm-b');
  await gf.click('.gm-comm-b');
  const cf=await (await page.waitForSelector('#fComm')).contentFrame();
  await cf.waitForFunction(()=>window.PSCommTax&&PSCommTax.state().sub==='std_dt_1'&&PSCommTax.state().topic==='trd',null,{timeout:15000});
  assert.equal(await visibleFrameId(page),'fComm');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({passed:true}));
}finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close(); }
