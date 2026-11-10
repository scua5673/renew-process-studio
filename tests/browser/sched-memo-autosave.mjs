import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
// 세션 채우기 시트의 «메모» · «장소»는 칸을 벗어날 때만 저장됐다 — 적고 «완료» 없이 새로고침하면 기기에도 서버에도 남지 않았다(사용 점검).
// studio/schedule-fill-autosave.js: 치는 동안 0.6초 미뤄 원래 저장 길로 담고 psFlushPending · pagehide · visibilitychange 에서 바로 쓴다. 칸은 다시 그리지 않는다.
// 실제 탭 · 실제 키 입력(크로미움은 한글 조합을 CDP 로 — 마지막 글자는 조합 중인 채 둔다) → 1.2초 → 새로고침 → 기기 · 서버. 끊긴 동안 쓴 글은 다시 이어지면 올라간다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine==='chromium')SIZES.ipad.engine='chromium';
const fx=await startFixture(),browsers={},DI=1;
const serverTr=()=>JSON.parse(fx.db.get(WT+'|process_coach_v1').v).weeks[0][DI].trainings[0];
const until=async(fn,ms,label)=>{const t0=Date.now();for(;;){const v=await fn();if(v)return v;if(Date.now()-t0>ms)assert.fail(label);await new Promise(r=>setTimeout(r,250));}};
try{
  const {page,context,logs}=await openApp(fx,'ipad',{browsers});
  const openSched=async()=>{
    await page.locator('#appSeg [data-team-hub]').click();await page.locator('#teamNav [data-team-key="training"]').click();
    const f=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>typeof week!=='undefined'&&week&&week[1]&&week[1].trainings.length===1&&document.querySelectorAll('.wks-day').length===7&&window.__psFillAutosave,null,{timeout:30000});
    await page.waitForTimeout(500);return f;};
  const openMemo=async f=>{
    await f.locator('.wks-day').nth(DI).getByRole('button',{name:/세션 채우기/}).first().tap();
    const note=f.locator('#wfNote');await note.waitFor();await note.scrollIntoViewIfNeeded();await note.tap();
    await f.waitForFunction(()=>document.activeElement&&document.activeElement.id==='wfNote');
    await f.evaluate(()=>{const n=document.getElementById('wfNote');n.__same=1;n.setSelectionRange(n.value.length,n.value.length);});return note;};
  const model=f=>f.evaluate(di=>({note:week[di].trainings[0].note||'',place:week[di].trainings[0].place||'',val:document.getElementById('wfNote')?document.getElementById('wfNote').value:null,
    same:!!(document.getElementById('wfNote')&&document.getElementById('wfNote').__same),focus:document.activeElement&&document.activeElement.id,sheet:document.getElementById('scrim').classList.contains('show')}),DI);

  // ── ① 치고 1.2초 — «완료» · 칸 벗어나기 없이 모델 · 기기에 담긴다. 칸은 그대로(같은 요소 · 포커스 · 조합)
  let f=await openSched();await openMemo(f);
  const base=(await model(f)).note;   // 합성 팀의 «가상 훈련 화»
  await page.keyboard.type(' cones 12',{delay:20});
  let hangul='조끼';
  if(engine==='chromium'){
    const cdp=await context.newCDPSession(page);
    // 조 → (조합 끝) → 끼: 첫 글자는 조합을 거쳐 확정, 마지막 글자는 조합 중인 채로 둔다(한글 입력의 보통 상태)
    for(const part of ['ㅈ','조']){await cdp.send('Input.imeSetComposition',{selectionStart:part.length,selectionEnd:part.length,text:part});await page.waitForTimeout(40);}
    await cdp.send('Input.insertText',{text:'조'});
    for(const part of ['ㄲ','끼']){await cdp.send('Input.imeSetComposition',{selectionStart:part.length,selectionEnd:part.length,text:part});await page.waitForTimeout(40);}
    assert.equal(await f.evaluate(()=>document.getElementById('wfNote').value.slice(-2)),'조끼','조합 중인 글자가 칸에 있다');
  }else await page.keyboard.insertText(hangul);
  const want=base+' cones 12'+hangul;
  await page.waitForTimeout(1200);
  let m=await model(f);await page.screenshot({path:path.join(SHOTS,`sched-memo-autosave-${engine}-1-typing.png`)});
  assert.equal(m.val,want,'칸의 글 '+JSON.stringify(m));
  assert.equal(m.note,want,'치는 동안 모델에 담긴다(«완료» 없이) '+JSON.stringify(m));
  assert.deepEqual({same:m.same,focus:m.focus,sheet:m.sheet},{same:true,focus:'wfNote',sheet:true},'칸을 다시 그리지 않는다');
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('process_coach_v1'))).weeks[0][DI].trainings[0].note,want,'기기 저장본');
  // 조합이 이어진다: 저장이 지난 뒤에도 같은 조합에 글자를 더 칠 수 있다(끼 → 낌) — 다시 그렸다면 조합이 끊겨 «끼ㅁ»이 된다
  let want2=want;
  if(engine==='chromium'){
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.imeSetComposition',{selectionStart:1,selectionEnd:1,text:'낌'});await page.waitForTimeout(40);
    want2=want.slice(0,-1)+'낌';
    assert.equal(await f.evaluate(()=>document.getElementById('wfNote').value),want2,'조합이 끊기지 않았다');
    await page.waitForTimeout(900);
    assert.equal((await model(f)).note,want2);
  }
  // ── ② «완료» 없이 새로고침 → 기기 · 서버
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  f=await openSched();
  assert.equal((await model(f)).note,want2,'새로고침 뒤 기기에 남는다');
  await until(()=>serverTr().note===want2,30000,'서버에 올라간다 — 지금 '+JSON.stringify(serverTr().note));
  // ── ③ 끊긴 동안: 장소 + 메모 → 1.2초 → 기기엔 남고 서버는 아직 → 다시 이어지면 올라간다
  await openMemo(f);
  await context.setOffline(true);
  await page.keyboard.type(' / offline bibs',{delay:15});
  const place=f.locator('#wfPlace');await place.scrollIntoViewIfNeeded();await place.tap();await page.keyboard.type('Field B',{delay:15});
  await page.waitForTimeout(1200);
  const want3=want2+' / offline bibs';
  m=await model(f);assert.equal(m.note,want3);assert.equal(m.place,'Field B','장소도 치는 동안 담긴다');
  const local=JSON.parse(await page.evaluate(()=>localStorage.getItem('process_coach_v1'))).weeks[0][DI].trainings[0];
  assert.equal(local.note,want3);assert.equal(local.place,'Field B');
  assert.equal(serverTr().note,want2,'끊긴 동안 서버는 그대로');
  await context.setOffline(false);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  f=await openSched();m=await model(f);
  assert.equal(m.note,want3,'끊긴 동안 쓴 글이 새로고침 뒤 기기에 남는다');assert.equal(m.place,'Field B');
  await until(()=>serverTr().note===want3&&serverTr().place==='Field B',30000,'다시 이어지면 서버에 올라간다 — 지금 '+JSON.stringify(serverTr()));
  // ── ④ 숨는 순간(visibilitychange) — 0.6초를 기다리지 않고 바로
  await openMemo(f);await page.keyboard.type('!',{delay:10});
  await f.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));delete document.visibilityState;});
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('process_coach_v1'))).weeks[0][DI].trainings[0].note,want3+'!','숨는 순간 기기에 쓴다');
  // ⑤ 셸의 저장 창구(psFlushPending)도 칸의 글을 먼저 담는다
  await page.keyboard.type('?',{delay:10});await f.evaluate(()=>window.psFlushPending());
  assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('process_coach_v1'))).weeks[0][DI].trainings[0].note,want3+'!?');
  // ⑥ 0.6초가 되기 전에 새로고침(pagehide) — 그 글자도 남는다
  await page.keyboard.type('Z',{delay:10});
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  f=await openSched();assert.equal((await model(f)).note,want3+'!?Z','pagehide 에서 바로 쓴다');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true,note:want3,ime:engine==='chromium'?'cdp-composition':'insertText'}));
  await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
