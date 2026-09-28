import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.903 — 폰 저장 띠(목업 ⑤): 운동장 밑 «상태 · 배치 · 보관함 · 저장». 새 보드는 «저장됨», 손대면 «변경됨».
// 선택 시트·포메이션 카드가 열리면 띠가 숨고, 애니메이션 막대가 켜지면 운동장이 띠 위로 올라간다.
// 데스크톱은 띠 없이 예전 버튼 그대로. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__psSaveBarVis);
  await page.waitForTimeout(1500);
  const st=()=>f.evaluate(()=>{const b=document.getElementById('psSaveBar'),r=b.getBoundingClientRect(),d=id=>{const e=document.getElementById(id);return e?getComputedStyle(e).display:'-';};
    return {shown:getComputedStyle(b).display!=='none',top:r.top,text:b.querySelector('.sb-tx').textContent,manual:d('boardManualSave'),vault:d('vaultSave'),
      label:(document.getElementById('boardManualSave')||{}).textContent};});
  const fresh=await st();
  assert.equal(fresh.label,'저장','손대지 않은 보드는 «변경됨»이 아니다');
  await f.evaluate(()=>{pushUndo();state.players.push({id:'sb1',team:'red',num:'9',x:400,y:300});renderTokens();});
  const edited=await st();
  assert.equal(edited.label,'저장 · 변경됨','손대면 «변경됨»');
  if(size==='desktop'){
    assert.equal(fresh.shown,false,'데스크톱에는 띠가 없다');
    assert.notEqual(fresh.manual,'none');assert.notEqual(fresh.vault,'none');
  }else{
    assert.equal(fresh.shown,true);assert.equal(fresh.text,'저장됨');
    assert.equal(fresh.manual,'none','떠 있던 저장 버튼은 폰에서 숨는다');assert.equal(fresh.vault,'none');
    assert.equal(edited.text,'변경됨 · 저장 안 함');
    const svgBottom=await f.evaluate(()=>document.querySelector('svg#board').getBoundingClientRect().bottom);
    assert.ok(fresh.top>=svgBottom-1,'띠가 운동장을 가리지 않는다');
    // 애니메이션 쪽이 무대 여백을 지워도(훈련→작전판 복귀 등) 띠가 운동장을 가리지 않는다
    await f.evaluate(()=>{window.__animFitPad();});await page.waitForTimeout(300);
    const afterFit=await f.evaluate(()=>({svg:document.querySelector('svg#board').getBoundingClientRect().bottom,bar:document.getElementById('psSaveBar').getBoundingClientRect().top}));
    assert.ok(afterFit.bar>=afterFit.svg-1,'여백 초기화 뒤에도 가리지 않는다 '+JSON.stringify(afterFit));
    await f.evaluate(()=>{selectItem('player',state.players[state.players.length-1]);try{positionSelCtl();}catch(_){}});
    await page.waitForTimeout(200);
    assert.equal((await st()).shown,false,'선택 시트가 열리면 숨는다');
    await f.evaluate(()=>deselect());await page.waitForTimeout(200);
    assert.equal((await st()).shown,true);
    // 저장 버튼은 원래 저장 경로를 탄다
    let clicked=await f.evaluate(()=>new Promise(r=>{const o=document.getElementById('boardManualSave');const h=()=>{o.removeEventListener('click',h,true);r(true);};o.addEventListener('click',h,true);document.querySelector('#psSaveBar .sb-save').click();setTimeout(()=>r(false),500);}));
    assert.equal(clicked,true,'띠의 저장 = 원래 저장 버튼');
    // 애니메이션 막대: 운동장 선이 띠 위에 있다
    await f.evaluate(()=>{ensureAnimMode(true);try{renderAnimFrames();}catch(_){}});await page.waitForTimeout(700);
    const anim=await f.evaluate(()=>{const b=document.getElementById('psSaveBar').getBoundingClientRect(),a=document.getElementById('animBar').getBoundingClientRect();
      const lines=document.getElementById('lineLayer')||document.getElementById('world');const lr=lines.getBoundingClientRect();return {barTop:b.top,barBottom:b.bottom,animTop:a.top,pitchBottom:lr.bottom};});
    assert.ok(anim.barBottom<=anim.animTop+1,'띠는 애니메이션 막대 위');
    assert.ok(anim.pitchBottom<=anim.barTop+2,'운동장 선이 띠에 가리지 않는다 '+JSON.stringify(anim));
    // 재생 중에는 숨는다
    await f.evaluate(()=>{document.getElementById('animAdd').click();state.players[0].x+=80;renderTokens();playAnim();});await page.waitForTimeout(300);
    assert.equal((await st()).shown,false,'재생 중에는 숨는다');
    await f.evaluate(()=>stopAnim());await page.waitForTimeout(300);
    assert.equal((await st()).shown,true,'재생이 끝나면 돌아온다');
    await f.evaluate(()=>document.getElementById('animBar').classList.remove('on'));await page.waitForTimeout(200);
    // 배치: 포메이션 카드가 열리고 띠는 숨고 «배치» 버튼이 카드 안에 보인다
    await f.evaluate(()=>document.querySelector('#psSaveBar .sb-form').click());await page.waitForTimeout(300);
    // 선수가 있으면 먼저 확인 창(폰에는 되돌리기 버튼이 없다) — «확인»을 눌러야 카드가 열린다
    const asked=await f.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='확인'&&x.getBoundingClientRect().width>0);if(b){b.click();return true;}return false;});
    assert.equal(asked,true,'선수가 있으면 배치 전에 묻는다');await page.waitForTimeout(500);
    assert.equal((await st()).shown,false,'포메이션 카드가 열리면 숨는다');
    const go=await f.evaluate(()=>{const g=document.getElementById('ehGo').getBoundingClientRect(),h=document.getElementById('emptyHint').getBoundingClientRect();return {gb:g.bottom,hb:h.bottom,gh:g.height};});
    assert.ok(go.gh>0&&go.gb<=go.hb+1,'«배치»가 카드 아래에 보인다 '+JSON.stringify(go));
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,fresh,edited}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
