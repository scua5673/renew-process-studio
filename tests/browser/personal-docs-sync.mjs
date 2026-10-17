import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.080 — 학습 기록 · 개인 게임모델은 계정(내 개인 공간)에 저장된다. 기기 A 에서 공부하고 게임모델에 원칙을 담으면,
//          새 기기 B(빈 저장소)에서 같은 진도 · 같은 게임모델이 보인다. 팀 공간이 열려 있어도 개인 공간 키로만 쓴다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
const learnFrame=async page=>{ await page.evaluate(()=>window.__psShowApp('learning')); const f=await (await page.waitForSelector('#fLearning')).contentFrame(); await f.waitForFunction(()=>typeof save==='function'&&window.BOOKS&&BOOKS.studio); return f; };
try{
  const A=await openApp(fx,'desktop',{browsers});
  await A.page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  const owner=await A.page.evaluate(()=>PSSync.learn.owner());
  assert.ok(owner&&owner.wid&&owner.wid!==owner.active,'팀 공간이 열려 있어도 개인 공간에 쓴다');
  const la=await learnFrame(A.page);
  await la.evaluate(()=>{ S.done.SG1={hits:3}; S.ask['SG1:pre']='기기 A 의 답'; save(); });
  await A.page.waitForFunction(()=>true);
  for(let i=0;i<40&&!fx.writes.some(w=>w.k==='cs_learn_sync_v1'&&w.wid===owner.wid);i++)await A.page.waitForTimeout(250);
  assert.ok(fx.writes.some(w=>w.k==='cs_learn_sync_v1'&&w.wid===owner.wid),'학습 기록이 개인 공간 키로 올라간다');
  assert.ok(!fx.writes.some(w=>w.k==='cs_learn_sync_v1'&&w.wid===owner.active),'팀 공간에는 쓰지 않는다');
  await la.evaluate(()=>parent.postMessage({source:'learning',type:'gmAdd',momentKey:'do',text:'기기 A 에서 담은 원칙'},'*'));
  for(let i=0;i<60&&!fx.writes.some(w=>w.k==='cs_gamemodel_personal_v1'&&w.wid===owner.wid);i++)await A.page.waitForTimeout(250);
  const gw=fx.writes.filter(w=>w.k==='cs_gamemodel_personal_v1');
  assert.ok(gw.length&&gw.every(w=>w.wid===owner.wid),'개인 게임모델도 개인 공간 키로 올라간다');
  assert.match(gw[gw.length-1].v,/기기 A 에서 담은 원칙/);

  // 새 기기 B — 빈 저장소
  const B=await openApp(fx,'desktop',{browsers});
  await B.page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
  assert.equal(await B.page.evaluate(()=>localStorage.getItem('cs_gamemodel_personal_v1')),null,'B 는 처음엔 비어 있다');
  const lb=await learnFrame(B.page);
  await lb.waitForFunction(()=>S.done.SG1&&S.done.SG1.hits===3&&S.ask['SG1:pre']==='기기 A 의 답',null,{timeout:15000});
  // 학습의 «내 원칙으로 훈련 만들기»는 이 기기에 게임모델이 없어도 계정의 것을 읽어 보여 준다
  await lb.evaluate(()=>{ BOOK=BOOKS.studio; openSec('ST1'); bookState.step=2; render(); });
  await lb.waitForFunction(()=>{ render(); return [...document.querySelectorAll('[data-mkdrill]')].some(b=>b.textContent.includes('기기 A 에서 담은 원칙')); },null,{timeout:15000,polling:500});
  // B 에서 바로 원칙을 하나 더 담는다 — 받기 전이라도 계정의 판을 먼저 받고 그 위에 넣는다
  await lb.evaluate(()=>parent.postMessage({source:'learning',type:'gmAdd',momentKey:'at',text:'기기 B 에서 담은 원칙'},'*'));
  await B.page.waitForFunction(()=>{ try{ const t=JSON.stringify(JSON.parse(localStorage.getItem('cs_gamemodel_personal_v1')||'null')||{}); return t.includes('기기 A 에서 담은 원칙')&&t.includes('기기 B 에서 담은 원칙'); }catch(_){ return false; } },null,{timeout:15000});
  for(let i=0;i<40&&!/기기 B 에서 담은 원칙/.test((fx.writes.filter(w=>w.k==='cs_gamemodel_personal_v1').pop()||{}).v||'');i++)await B.page.waitForTimeout(250);
  const last=fx.writes.filter(w=>w.k==='cs_gamemodel_personal_v1').pop();
  assert.match(last.v,/기기 A 에서 담은 원칙/,'B 가 계정의 게임모델을 지우지 않았다');
  assert.match(last.v,/기기 B 에서 담은 원칙/,'B 에서 담은 것도 계정에 올라간다');
  for(const p of [A,B]){ const errs=p.logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],'페이지 오류 없음'); }
  console.log(JSON.stringify({engine,passed:true}));
}finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close(); }
