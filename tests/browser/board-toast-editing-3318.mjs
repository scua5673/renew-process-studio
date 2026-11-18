import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.318 — 훈련 편집(body.editing)에서 도구 옵션 띠(#ps-df-opts)가 열린 채 알림이 뜨면 알림은 띠 위의 한 줄이다(합성 팀 fixture 에서만).
// 사용자 11/18 «구역 설정하는데 이렇게 떠»: 편집은 알림을 위쪽(top:16px!important)에 두고 board-popups 는 띠 위로 올리려 bottom 을 인라인 !important 로
// 적어 위 · 아래가 함께 고정 → 알림이 운동장을 덮는 632px 상자가 됐다. 이제 올릴 땐 top:auto 도 같이 적고, 띠가 닫히면 둘 다 처음 값으로.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-toast-editing-3318 '+s);};
try{
  const {page}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof toast==='function'&&window.__boardReady&&window.__boardRestoreDone&&window.__psDockFloat&&window.__psPopups&&document.querySelector('.ps-df-group'),null,{timeout:30000});
  await page.waitForTimeout(600);
  const measure=(editing)=>f.evaluate(async(editing)=>{
    document.body.classList.toggle('editing',editing);
    const G=(window.PSDockFloat||{}).GROUPS||[];const g=G.find(x=>x.tools&&x.tools.indexOf('rect')>=0);
    const o=document.getElementById('ps-df-opts');if(!o.classList.contains('on'))document.querySelector('.ps-df-group[data-df-group="'+g.key+'"]').click();
    await new Promise(r=>setTimeout(r,250));
    toast('끌어서 구역(채워진 박스)을 그리세요');await new Promise(r=>setTimeout(r,350));
    const t=document.getElementById('cs-ftoast');const tr=t.getBoundingClientRect(),or=o.getBoundingClientRect();
    return {on:o.classList.contains('on'),optsTop:Math.round(or.top),top:Math.round(tr.top),bottom:Math.round(tr.bottom),h:Math.round(tr.height),inlineTop:t.style.top,vh:innerHeight};
  },editing);
  const close=()=>f.evaluate(async()=>{document.body.classList.remove('editing');window.__psDockFloat.hide();await new Promise(r=>setTimeout(r,120));const t=document.getElementById('cs-ftoast');return {top:t.style.top,bottom:t.style.bottom,on:document.getElementById('ps-df-opts').classList.contains('on')};});

  step('editing');
  const e=await measure(true);
  assert.equal(e.on,true,'도구 옵션 띠가 열렸다');
  assert.ok(e.h<80,'알림은 한 줄(632px 상자가 아니다): '+JSON.stringify(e));
  assert.ok(e.bottom<=e.optsTop&&e.optsTop-e.bottom<=24,'알림은 띠 바로 위: '+JSON.stringify(e));
  assert.equal(e.inlineTop,'auto','올릴 땐 top:auto 인라인');

  step('board');
  await page.waitForTimeout(2000);
  const b=await measure(false);
  assert.ok(b.h<80&&b.bottom<=b.optsTop,'작업 보드에서도 띠 위 한 줄: '+JSON.stringify(b));

  step('closed');
  const c=await close();
  assert.deepEqual([c.on,c.top],[false,''],'띠가 닫히면 top 은 처음 값(없음)으로: '+JSON.stringify(c));
  console.log(JSON.stringify({test:'board-toast-editing-3318',engine,size,passed:true,editing:e,board:b,closed:c}));
}catch(e){console.error('board-toast-editing-3318 failed at '+cur);console.error(e);process.exitCode=1;}
finally{try{for(const b of Object.values(browsers))await b.close();}catch(_){}try{await fx.close();}catch(_){}}
