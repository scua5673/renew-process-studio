import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A} from '../fixtures/team-app.mjs';
/* 3.272 — 같이 쓰는 기기: 로그아웃한 뒤(자료는 «보내지 못한 변경을 잃지 않게» 기기에 남는다 — sync.js signOut) 팀 화면을 주소로 바로 열어도
   팀 자료(명단 · 평가 · 일정 · 경기 · 게임모델 · 노트)가 그려지지 않는다. 셸(app.html)은 잠금 화면을 덮지만, 속 화면은 저마다 localStorage 를 읽어 그렸다.
   studio/data-lock-guard.js 가 «세션 없음 + 이 기기에 계정 자료가 남아 있음»이면 화면을 그리기 전에 가린다. 로그인한 사용자 · 처음 온 손님(계정 흔적 없음)은 그대로.
   합성 팀 · 루프백 서버만 쓴다. */
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const PAGES=['scout.html','idp.html','process.html','board.html','note.html','gamemodel.html','scouting.html','playbook.html'];
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
const DATA=/가상 (?:선수|훈련|상대|원칙|정체성)/;
fx.db.set(WT+'|cs_gamemodel_v1',{workspace_id:WT,k:'cs_gamemodel_v1',v:JSON.stringify({identity:'가상 정체성 문장',moments:[{key:'ao',name:'공격',tag:'IN POSS',main:'가상 원칙 하나',phases:[{id:'ph1',name:'전개',principles:['가상 원칙 둘']}]}]}),cupd:1000,updated_by:A});
const look=async(context,file)=>{
  const tab=await context.newPage();const errors=[];tab.on('pageerror',e=>errors.push(e.message));
  await tab.goto(fx.base+'/studio/'+file,{waitUntil:'commit'});await tab.waitForTimeout(2600);   /* 잠긴 화면은 문서 읽기를 멈춘다(window.stop) — DOMContentLoaded 를 기다리지 않는다 */
  const out=await tab.evaluate(()=>({text:(document.body&&document.body.innerText||'').replace(/\s+/g,' '),guard:!!document.getElementById('psLockGuard'),hidden:document.documentElement.classList.contains('ps-lock-guard'),
    inputs:[...document.querySelectorAll('input,textarea')].map(e=>e.value).join(' ')}));
  await tab.close();return {...out,errors};
};
try{
  step('signed-in');
  const {page,context}=await openApp(fx,'desktop',{browsers});
  await page.waitForFunction(()=>{try{return /가상 선수 7/.test(localStorage.getItem('scout_tool_v1')||'');}catch(_){return false;}},null,{timeout:30000});
  await page.waitForTimeout(1500);
  const seenIn={};
  for(const f of ['scout.html','process.html','idp.html','gamemodel.html']){const r=await look(context,f);seenIn[f]=r;assert.equal(r.guard,false,f+': a signed-in user is not blocked');}
  for(const f of ['scout.html','process.html'])assert.match(seenIn[f].text+seenIn[f].inputs,DATA,f+': signed in, the team data is drawn when the page is opened directly');

  step('logout');
  const ok=await page.evaluate(()=>PSSync.signOut());assert.equal(ok,true,'logout completed (everything was confirmed on the server)');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ps_sync_session')),null);
  assert.ok(await page.evaluate(()=>!!localStorage.getItem('scout_tool_v1')),'the device copy is kept on logout (unsent changes must not be lost)');

  step('direct-pages-after-logout');
  const leaks=[];
  for(const f of PAGES){
    const r=await look(context,f),all=r.text+' '+r.inputs;
    if(DATA.test(all))leaks.push(f+' shows team data: '+all.match(/.{0,30}가상 (?:선수|훈련|상대|원칙|정체성).{0,30}/)[0]);
    assert.ok(r.guard,f+': the lock notice is shown');
    assert.match(r.text,/로그인이 필요합니다/,f+': the notice says to sign in');
    assert.deepEqual(r.errors.filter(e=>!/ResizeObserver/.test(e)),[],f+': no script error');
  }
  assert.deepEqual(leaks,[],'no team data on directly opened pages after logout');

  step('guest-device');
  /* 계정 흔적이 없는 기기(처음 온 손님)는 예전처럼 바로 쓴다 */
  const guest=await openApp(fx,'desktop',{browsers,guest:true});
  for(const f of ['board.html','process.html','note.html']){const r=await look(guest.context,f);assert.equal(r.guard,false,f+': a first-time guest is not blocked');}
  /* 다음 계정이 로그인했는데 기기 사본의 주인이 아직 앞 계정이면(셸이 비우기 전) 그 사본도 그리지 않는다 */
  step('other-account');
  const other=await openApp(fx,'desktop',{browsers});
  await other.page.evaluate(()=>{localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:'99999999-9999-4999-8999-999999999999',wid:'x'}));});
  const r2=await look(other.context,'process.html');assert.ok(r2.guard,'another account\'s cache is not drawn');assert.doesNotMatch(r2.text+r2.inputs,DATA);
  console.log(JSON.stringify({engine,test:'logout-direct-pages',ok:true,pages:PAGES}));
}catch(e){console.error('[logout-direct-pages] step='+cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
