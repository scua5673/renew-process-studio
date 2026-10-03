import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.903 — 폰 저장 띠(목업 ⑤)였다. 2.939 — 사용자 «폰에서는 배치·보관함·보드 저장은 안 보이게»: 폰에는 띠도 저장 버튼도 없다.
// 데스크톱은 띠 없이 예전 버튼 그대로(«보드 저장», 손대면 «보드 저장 ●»). 합성 팀 fixture 에서만 돈다.
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
  assert.equal(fresh.label,'보드 저장','손대지 않은 보드는 «변경됨»이 아니다 (2.907 — «저장» → «보드 저장»)');
  await f.evaluate(()=>{pushUndo();state.players.push({id:'sb1',team:'red',num:'9',x:400,y:300});renderTokens();});
  const edited=await st();
  assert.equal(edited.label,'보드 저장 ●','손대면 변경 점');
  if(size==='desktop'){
    assert.equal(fresh.shown,false,'데스크톱에는 띠가 없다');
    assert.notEqual(fresh.manual,'none');assert.notEqual(fresh.vault,'none');
  }else{
    // 2.939 — 폰에는 띠도, 원래 떠 있던 저장·보관함 버튼도 보이지 않는다(사용자 «배치·보관함·보드 저장은 안 보이게»)
    assert.equal(fresh.shown,false,'폰에는 저장 띠가 없다');assert.equal(edited.shown,false,'손대도 띠가 나오지 않는다');
    assert.equal(fresh.manual,'none','떠 있던 보드 저장 버튼도 숨는다');assert.equal(fresh.vault,'none','보관함 저장 버튼도 숨는다');
    const visible=await f.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0&&getComputedStyle(b).visibility!=='hidden'&&/^(배치|보관함|보드 저장)/.test(b.textContent.trim())).map(b=>b.textContent.trim()));
    assert.deepEqual(visible,[],'«배치·보관함·보드 저장» 이름의 버튼이 화면에 없다');
    // 띠가 없으니 애니메이션 막대가 켜져도 띠 몫(58px)을 따로 비우지 않는다
    await f.evaluate(()=>{ensureAnimMode(true);try{renderAnimFrames();}catch(_){}});await page.waitForTimeout(700);
    const anim=await f.evaluate(()=>{const a=document.getElementById('animBar').getBoundingClientRect(),lines=document.getElementById('lineLayer')||document.getElementById('world');
      return {shown:getComputedStyle(document.getElementById('psSaveBar')).display!=='none',animTop:a.top,pitchBottom:lines.getBoundingClientRect().bottom};});
    assert.equal(anim.shown,false);assert.ok(anim.pitchBottom<=anim.animTop+2,'운동장 선이 애니메이션 막대에 가리지 않는다 '+JSON.stringify(anim));
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,fresh,edited}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
