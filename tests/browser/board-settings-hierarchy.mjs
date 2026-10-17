import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.036 — 사용자 «보드 설정 위계를 잘 만들어보자 — 메뉴들이 좀 안 맞게 막 들어간 것 같아» (추천안 승인).
// 네 탭 — 운동장 · 선수 표시 · 배치 | 내 화면. 탭 하나 = 저장 범위 하나(범위 칩). 옛 키(layout · keys)는 이어 주고, 옛 기억(v1)은 한 번 옮긴다.
// 배치: 포메이션 카드 하나 + «선발 11명» + 선수 불러오기 · 저장 팀 · 지우기·초기화. 새 나던 우리 팀/상대 팀 셀렉트 줄은 숨는다.
// 내 화면: 보드 보기 · (3D 일 때만) 3D 경기장 · 끌기 자석 · 새 보드 기본값 · 접힌 단축키. 훈련 격자는 피치=훈련일 때만, 3D 꾸밈은 그리드 판이 아닐 때만.
// 편집기: 범위 칩 «이 훈련에 저장», 규격 «그리드» · 선수 불러오기 · 새 보드가 숨고, 바탕=그리드면 운동장 줄 대신 안내.
// 합성 팀 fixture 에서만 돈다. 데스크톱 폭.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers,tilt3d:false});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof window.__psToggleBoardSettings==='function'&&!!document.getElementById('cmd-board-settings-pop')&&typeof openEditor==='function'&&window.__boardReady!==false,null,{timeout:30000});
  await page.waitForTimeout(800);
  const vis=sel=>f.evaluate(sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';},sel);
  const secs=()=>f.evaluate(()=>[...document.querySelectorAll('#cmd-board-settings-pop .bs-sec, #cmd-board-settings-pop .cmd-board-settings-danger>summary, #cmd-board-settings-pop details.bs-keys>summary, #cmd-board-settings-pop #emptyHint .eh-t')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(e=>e.textContent.trim()));
  const labels=()=>f.evaluate(()=>[...document.querySelectorAll('#cmd-board-settings-pop .menurow')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(e=>{const l=e.querySelector('.menulbl');return l?l.textContent.trim():'';}).filter(Boolean));
  const st=()=>f.evaluate(()=>{const p=document.getElementById('cmd-board-settings-pop');return {tab:p.getAttribute('data-bs-tab'),scope:p.querySelector('.cmd-board-settings-scope').textContent,tabs:[...p.querySelectorAll('.cmd-board-settings-tabs button')].map(b=>b.textContent),on:[...p.querySelectorAll('.cmd-board-settings-tabs button.on')].map(b=>b.textContent),mem:localStorage.getItem('ps_board_settings_tab_v2'),memEd:localStorage.getItem('ps_board_settings_tab_editor_v1')};});
  const sel=t=>f.evaluate(t=>document.getElementById('cmd-board-settings-pop').__psSelectTab(t),t);
  await f.evaluate(()=>window.__psToggleBoardSettings('open'));await page.waitForTimeout(400);
  let s=await st();
  assert.deepEqual(s.tabs,['운동장','선수 표시','배치','내 화면'],'네 탭');
  // ① 운동장 — 이 보드에 저장
  await sel('pitch');s=await st();assert.equal(s.scope,'이 보드에 저장');assert.deepEqual(s.on,['운동장']);assert.equal(s.mem,'pitch');
  let sc=await secs();assert.deepEqual(sc,['내 스타일','바탕','선·구역','범위·방향'],'운동장 묶음 '+JSON.stringify(sc));
  let lb=await labels();
  assert.ok(lb.includes('규격')&&lb.includes('피치')&&lb.includes('라인')&&lb.includes('전술 구역')&&lb.includes('운동장 방향'),'운동장 줄 '+JSON.stringify(lb));
  assert.ok(!lb.includes('훈련 격자'),'훈련 격자는 피치=훈련일 때만 '+JSON.stringify(lb));
  assert.ok(!lb.includes('카메라')&&!lb.includes('선수 모양')&&!lb.includes('끌기 자석'),'다른 탭 줄은 숨는다');
  await f.evaluate(()=>window.__applyPitch('train',null));await page.waitForTimeout(300);
  lb=await labels();assert.ok(lb.includes('훈련 격자'),'훈련 피치면 훈련 격자가 보인다 '+JSON.stringify(lb));
  await f.evaluate(()=>window.__applyPitch('',null));await page.waitForTimeout(300);
  /* 리뷰 — 패널의 피치 단추(사용자 경로)도 훈련 격자 줄을 따라 바꾼다 */
  await f.click('#cmd-board-settings-pop #pitchSeg button[data-p="train"]');await page.waitForTimeout(300);
  lb=await labels();assert.ok(lb.includes('훈련 격자'),'패널에서 «훈련»을 누르면 훈련 격자 줄 '+JSON.stringify(lb));
  await f.click('#cmd-board-settings-pop #pitchSeg button[data-p="navy"]');await page.waitForTimeout(300);
  lb=await labels();assert.ok(!lb.includes('훈련 격자'),'다른 피치로 돌아가면 숨는다');
  assert.ok(!lb.includes('확대 쪽'),'범위가 «전체»면 확대 쪽은 숨는다 '+JSON.stringify(lb));
  await page.screenshot({path:path.join(SHOTS,'board-settings-hierarchy-pitch-'+engine+'.png')});
  // ② 선수 표시 — 이 보드에 저장
  await sel('look');s=await st();assert.equal(s.scope,'이 보드에 저장');
  sc=await secs();assert.deepEqual(sc,['내 스타일','칩','이름표','분석'],'선수 표시 묶음 '+JSON.stringify(sc));
  lb=await labels();assert.deepEqual(lb,['선수 모양','입체 칩','크기','비율','실제 크기','칩 글자','이름표','이름표 크기','이름표 모양','분석 그래픽'],'선수 표시 줄 '+JSON.stringify(lb));
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#chip3dSeg button')].map(b=>b.textContent.trim())),['끄기','켜기'],'«평면»은 보드 보기에만');
  await page.screenshot({path:path.join(SHOTS,'board-settings-hierarchy-look-'+engine+'.png')});
  // ③ 배치 — 바로 적용 · 카드 하나 · 선발 11명 · 저장 팀 줄 · 지우기·초기화
  await sel('form');s=await st();assert.equal(s.scope,'바로 적용');
  assert.equal(await f.evaluate(()=>document.getElementById('emptyHint').parentNode.id),'cmd-board-settings-form','포메이션 카드가 탭 안에');
  assert.equal(await vis('#ehActs>#ehGo'),true,'[배치]');assert.equal(await vis('#ehActs>#loadSquadBtn'),true,'«선발 11명»이 [배치] 옆에 돌아왔다');
  assert.equal(await f.evaluate(()=>{const r=document.getElementById('formHome').closest('.menurow');return getComputedStyle(r).display;}),'none','새 나던 우리 팀 셀렉트 줄은 숨는다');
  sc=await secs();assert.ok(sc.includes('포메이션으로 시작')&&sc.includes('선수 불러오기')&&sc.includes('지우기·초기화'),'배치 묶음 '+JSON.stringify(sc));
  lb=await labels();assert.ok(lb.includes('선수단')&&lb.includes('저장 팀'),'배치 줄 '+JSON.stringify(lb));
  assert.ok(!lb.includes('기본값'),'새 보드 기본값은 내 화면으로');
  await page.screenshot({path:path.join(SHOTS,'board-settings-hierarchy-form-'+engine+'.png')});
  // ④ 내 화면 — 이 기기에만 · 3D 묶음은 3D 일 때만 · 접힌 단축키
  await sel('view');s=await st();assert.equal(s.scope,'이 기기에만');
  sc=await secs();assert.deepEqual(sc,['보기','편집','도크','새 보드','단축키'],'평면: 3D 경기장 묶음 없음 '+JSON.stringify(sc));
  lb=await labels();assert.deepEqual(lb,['보드 보기','끌기 자석','스타일','기본값'],'내 화면 줄 '+JSON.stringify(lb));
  assert.equal(await f.evaluate(()=>document.querySelector('#cmd-board-settings-pop details.bs-keys').open),false,'단축키는 접혀 있다');
  assert.equal(await vis('#cmd-board-settings-pop .cmd-board-settings-danger'),false,'지우기·초기화는 배치에만');
  await f.evaluate(()=>window.__setTilt(true));await page.waitForTimeout(600);
  sc=await secs();assert.deepEqual(sc,['보기','3D 경기장','편집','도크','새 보드','단축키'],'3D: 3D 경기장 묶음 '+JSON.stringify(sc));
  lb=await labels();assert.ok(lb.includes('카메라')&&lb.includes('꾸밈')&&lb.includes('분위기'),'3D 줄 '+JSON.stringify(lb));
  await page.screenshot({path:path.join(SHOTS,'board-settings-hierarchy-view-3d-'+engine+'.png')});
  await f.evaluate(()=>window.__setPitchSpec('grid30'));await page.waitForTimeout(500);
  lb=await labels();assert.ok(!lb.includes('꾸밈'),'그리드 판은 꾸밈이 효과가 없어 숨는다 '+JSON.stringify(lb));
  await f.evaluate(()=>{window.__setPitchSpec('fifa');window.__setTilt(false);});await page.waitForTimeout(400);
  // 옛 키 · 옛 기억
  await sel('keys');s=await st();assert.equal(s.tab,'view');assert.equal(await f.evaluate(()=>document.querySelector('#cmd-board-settings-pop details.bs-keys').open),true,'옛 «단축키» 탭 키는 내 화면 + 펼침');
  assert.ok(await f.evaluate(()=>document.querySelectorAll('#cmd-board-settings-pop details.bs-keys [data-key],#cmd-board-settings-pop details.bs-keys input,#cmd-board-settings-pop details.bs-keys button').length>0),'펼치면 단축키 편집기가 그려진다');
  await sel('layout');s=await st();assert.equal(s.tab,'form','옛 «선수» 탭 키는 배치');
  assert.equal(await f.evaluate(()=>{localStorage.removeItem('ps_board_settings_tab_v2');localStorage.setItem('ps_board_settings_tab_v1','view');return document.getElementById('cmd-board-settings-pop').__psSavedTab();}),'look','옛 «보기» 기억은 «선수 표시»로');
  await sel('pitch');
  // ⑤ 편집기 — 이 훈련에 저장 · 편집기 패널이 맡는 줄은 숨는다 · 그리드 판 안내
  await f.evaluate(()=>{try{window.__psToggleBoardSettings('force-close');}catch(_){}try{setView('session');}catch(_){}openEditor(null,'train');});
  await f.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(900);
  await f.evaluate(()=>window.__psToggleBoardSettings('open'));await page.waitForTimeout(400);await sel('pitch');
  s=await st();assert.equal(s.scope,'이 훈련에 저장');assert.equal(s.memEd,'pitch','편집기는 따로 기억');
  assert.equal(await vis('#pitchSpecSeg [data-spec="grid30"]'),false,'규격 «그리드»는 오른쪽 «바탕»이 맡는다');
  assert.equal(await vis('#bsBlankHint'),false);
  await sel('view');assert.equal(await vis('#bsEditorHint'),true,'«훈련 편집기는 평면으로 열려요»');
  lb=await labels();assert.ok(!lb.includes('기본값'),'편집기에 새 보드 기본값은 없다 '+JSON.stringify(lb));
  await sel('form');lb=await labels();assert.ok(!lb.includes('선수단')&&!lb.includes('저장 팀'),'편집기는 «선수단 올리기»가 맡는다 '+JSON.stringify(lb));
  await f.evaluate(()=>document.querySelector('#epSurface [data-sf="grid"]').click());await page.waitForTimeout(700);
  await f.evaluate(()=>window.__psToggleBoardSettings('open'));await page.waitForTimeout(400);   /* 바탕 단추 클릭은 패널 밖 클릭이라 패널이 닫힌다(2.561) — 다시 연다 */
  await sel('pitch');assert.equal(await vis('#bsBlankHint'),true,'그리드 판 안내');assert.equal(await vis('#pitchSpecRow'),false);assert.equal(await vis('#cmd-board-settings-pitchview'),false);
  lb=await labels();assert.ok(!lb.includes('피치')||true,'(피치 줄은 그리드 판에서도 바탕 색을 바꾼다)');
  await page.screenshot({path:path.join(SHOTS,'board-settings-hierarchy-editor-grid-'+engine+'.png')});
  await f.evaluate(()=>closeEditor(false));await f.waitForFunction(()=>!document.body.classList.contains('editing'));await page.waitForTimeout(800);
  s=await st();assert.equal(s.scope,'이 보드에 저장','작전판으로 돌아오면 범위 칩도');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
