import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
// 3.039 — 첫 사용 입구(피드백 UX-2 · UX-3 · DS-11).
// ① 팀 코치(임원 · 코칭스태프)가 사이드바 «IDP»를 누르면 팀 IDP(선수단)로 — 코치 본인의 선수용 일지가 아니라
// ② 연결된 선수가 0명이면 «오늘»이 빈 화면 대신 안내 + «선수 초대하기» · «선수 평가 시작»(누르면 «선수» 탭)
// ③ 폰의 빈 작전판에 «폰에서는 보기만» 안내 — 판이 채워지면 사라지고, «보관함 열기»는 보관함으로, «닫기»는 이 기기에서 다시 안 뜬다
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.phone.engine=engine;   /* 폰 화면도 이 잡의 엔진으로 */
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  step('sidebar-idp');
  { const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers}); await page.waitForTimeout(2500);
    assert.ok(['executive','staff'].includes(await page.evaluate(()=>PSPerms.role())),'fixture 계정은 팀 코치');
    await page.evaluate(()=>document.querySelector('#appSeg button[data-scope="global"][data-app="idp"]').click());
    const f=await (await page.$('#fIdp')).contentFrame();
    await f.waitForFunction(()=>!!document.querySelector('.sq-ph'),null,{timeout:20000});
    const st=await page.evaluate(()=>({app:document.body.getAttribute('data-ps-app'),team:document.body.classList.contains('ps-team-open'),on:[...document.querySelectorAll('.teamnav button.on')].map(b=>b.dataset.teamKey)}));
    assert.deepEqual(st,{app:'idp',team:true,on:['idp']},'팀 운영 › IDP');
    assert.equal(await f.evaluate(()=>/오늘 훈련에 참여했나요/.test(document.body.innerText)),false,'선수용 일지가 아니다');

    step('today-empty');
    await f.waitForFunction(()=>!!document.querySelector('.sq-empty-today b'),null,{timeout:20000}).catch(()=>{});   /* .sq-ph 뒤에 그려진다 — 웹킷은 한 박자 늦을 때가 있다 */
    const em=await f.evaluate(()=>{ const c=document.querySelector('.sq-empty-today'); return c?{t:c.querySelector('b').textContent,inv:!!c.querySelector('[data-sq-invite]'),ev:!!c.querySelector('[data-sqe-mode="eval"]')}:null; });
    assert.deepEqual(em,{t:'아직 IDP를 쓰는 선수가 없어요',inv:true,ev:true},'연결된 선수 0명 — 안내와 두 단추');
    await f.evaluate(()=>document.querySelector('.sq-empty-today [data-sqe-mode="eval"]').click());
    await f.waitForFunction(()=>[...document.querySelectorAll('.sq-sc.on')].some(b=>b.textContent==='선수'));
    const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(pe,[],JSON.stringify(pe.slice(0,3)));
    await context.close(); }

  step('phone-hint');
  { const {page,logs}=await openApp(fx,'phone',{browsers}); await page.waitForTimeout(2500);
    await page.evaluate(()=>{ const b=document.querySelector('#appSeg [data-app="board"]:not([data-train])'); if(b)b.click(); });
    const bf=await (await page.waitForSelector('#fBoard')).contentFrame();
    await bf.waitForFunction(()=>typeof renderTokens==='function'&&document.body.classList.contains('ps-phone-work'));
    await bf.evaluate(()=>{ state.players=[];state.equipment=[];state.drawings=[];renderTokens(); });
    await bf.waitForSelector('#psPhoneBoardNotice',{timeout:8000});
    assert.match(await bf.locator('#psPhoneBoardNotice').innerText(),/보드 수정은 아이패드나 컴퓨터에서 가능합니다/);
    await bf.evaluate(()=>{ state.players=[{id:1,team:'blue',num:'7',x:300,y:300}];renderTokens(); });
    assert.equal(await bf.locator('#psPhoneBoardNotice').isVisible(),true,'the notice also stays on a populated board');
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());
    await bf.waitForFunction(()=>document.getElementById('psPhoneBoardNotice').hidden);
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    await bf.waitForSelector('#psPhoneBoardNotice',{timeout:8000});
    await bf.evaluate(()=>localStorage.setItem('ps_phone_board_hint_v1','1'));
    await page.waitForTimeout(1100);
    assert.equal(await bf.locator('#psPhoneBoardNotice').isVisible(),true,'the old dismissed empty-board hint cannot hide the new notice');
    const pe=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(pe,[],JSON.stringify(pe.slice(0,3))); }   /* 웹킷이 내는 무해한 경고(다른 시험과 같은 거름) */
  console.log(JSON.stringify({engine,test:'coach-idp-entry',ok:true}));
}catch(e){ console.error('[coach-idp-entry] step='+cur); throw e; }
finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close?.(); }
