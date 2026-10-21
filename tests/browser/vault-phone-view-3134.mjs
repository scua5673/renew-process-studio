import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.134 — 폰으로 보는 보관함 작전판(board-vault-browse.js mountPhone). 사용자 피드백 «폰에서 작전판 보기 — 운동장이 가로로 작게 나와
// 번호가 안 보임». 폰 폭의 보기 전용 작전판: 세로 · 선수 1.6배 · 막대 한 줄(페이지 띠가 보인다) · 판 왼쪽 위 «▶ 재생». 컴퓨터는 그대로.
// 합성 팀 fixture 의 예시 작전판(«4-3-3 — 공격 형태와 수비 블록» — 두 페이지, 첫 페이지 장면 셋)으로 본다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine==='chromium')SIZES.phone.engine='chromium';   // Chromium 잡도 폰 크기로(WebKit 잡은 아이폰 그대로)
const NAME='4-3-3 — 공격 형태와 수비 블록';
const fx=await startFixture(),browsers={};

async function openView(page,f){
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),NAME,{timeout:30000});
  await page.waitForTimeout(1500);   // 예시 담기(vxSeedRun)가 끝난 목록에서
  await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));
    const b=[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='보기');(b||c.querySelector('.vc-nm')||c).click();},NAME);
  await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&window.__vaultReadOnly===true&&anim.frames.length>=2,null,{timeout:15000});
  await page.waitForTimeout(700);
}
try{
  // 1) 폰
  {
    const {page,logs}=await openApp(fx,'phone',{browsers,examples:true});
    const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&window.__psVaultPhoneApi&&window.__psVaultPhoneApi.hooked(),null,{timeout:30000});
    const work0=await f.evaluate(()=>state.orientation);
    await openView(page,f);
    await f.waitForFunction(()=>document.body.classList.contains('ps-vv-phone')&&state.orientation==='v',null,{timeout:5000});
    const v=await f.evaluate(()=>{
      const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
      const tok=[...document.querySelectorAll('#tokenLayer [data-id]')].map(g=>g.querySelector('.tok-c')).filter(Boolean).map(c=>c.getBoundingClientRect().width);
      const tabs=[...document.querySelectorAll('#boardPageStrip .bp-tab')].filter(t=>t.getBoundingClientRect().width>0);
      const tabTop=tabs.map(t=>{const r=t.getBoundingClientRect();const e=document.elementFromPoint(r.left+Math.min(20,r.width/2),r.top+r.height/2);return !!(e&&t.contains(e));});
      const p=document.getElementById('psVvPlay');
      return {tok:Math.min(...tok),bar:R(document.getElementById('vCreateBar')).h,tabs:tabs.length,tabTop,play:getComputedStyle(p).display,label:p.textContent,
        board:R(document.getElementById('board'))};});
    await page.screenshot({path:path.join(SHOTS,`vault-phone-view-3134-${engine}-1-view.png`)});
    assert.ok(v.tok>=12,'선수가 읽히는 크기 '+JSON.stringify(v));
    assert.ok(v.bar<=70,'막대 한 줄 '+v.bar);
    assert.ok(v.tabs>=2&&v.tabTop.every(Boolean),'페이지 띠가 막대에 가리지 않는다 '+JSON.stringify(v.tabTop));
    assert.notEqual(v.play,'none','«▶ 재생»');assert.match(v.label,/재생 · 장면 3/);
    assert.ok(v.board.h>v.board.w,'세로 판 '+JSON.stringify(v.board));

    // 재생 — 판은 세로 그대로, 장면 자막은 단추에 가리지 않는다
    await f.click('#psVvPlay');
    await f.waitForFunction(()=>animPlaying===true,null,{timeout:5000});
    let worst=null;
    for(let i=0;i<12;i++){
      const s=await f.evaluate(()=>{const p=document.getElementById('psVvPlay').getBoundingClientRect(),c=document.getElementById('animCapBar');
        let hit=false;if(c&&c.textContent.trim()&&getComputedStyle(c).display!=='none'){const r=c.getBoundingClientRect();hit=r.width>0&&!(r.right<=p.left||r.left>=p.right||r.bottom<=p.top||r.top>=p.bottom);}
        return {o:state.orientation,hit,label:document.getElementById('psVvPlay').textContent,playing:animPlaying};});
      if(s.o!=='v'||s.hit)worst=s;
      if(i===3)await page.screenshot({path:path.join(SHOTS,`vault-phone-view-3134-${engine}-2-play.png`)});
      if(!s.playing)break;
      if(i===1)assert.match(s.label,/멈춤/);
      await page.waitForTimeout(300);
    }
    assert.equal(worst,null,'재생 중에도 세로 · 자막을 가리지 않는다 '+JSON.stringify(worst));
    await f.waitForFunction(()=>animPlaying===false,null,{timeout:20000});

    // 닫으면 걷히고 작업 보드는 그대로
    await f.click('#vCreateCancel');
    await f.waitForFunction(()=>!document.body.classList.contains('vcreating'),null,{timeout:10000});
    await page.waitForTimeout(500);
    const after=await f.evaluate(()=>({phone:document.body.classList.contains('ps-vv-phone'),play:getComputedStyle(document.getElementById('psVvPlay')).display,o:state.orientation}));
    assert.equal(after.phone,false);assert.equal(after.play,'none');assert.equal(after.o,work0,'작업 보드 방향 그대로');
    const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
    console.log(JSON.stringify({engine,size:'phone',v,after}));
    await page.context().close();
  }
  // 2) 컴퓨터(Chromium 잡) — 저장된 방향 그대로, 단추 없음
  if(engine==='chromium'){
    const {page,logs}=await openApp(fx,'desktop',{browsers,examples:true});
    await page.waitForTimeout(1200);
    const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
    await f.waitForFunction(()=>window.__boardReady&&window.__psVaultPhoneApi&&window.__psVaultPhoneApi.hooked(),null,{timeout:30000});
    await openView(page,f);
    const d=await f.evaluate(()=>({o:state.orientation,phone:document.body.classList.contains('ps-vv-phone'),play:getComputedStyle(document.getElementById('psVvPlay')).display,tok:window.commViewTok()}));
    assert.deepEqual(d,{o:'h',phone:false,play:'none',tok:0},'컴퓨터는 그대로 '+JSON.stringify(d));
    const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
    console.log(JSON.stringify({engine,size:'desktop',d}));
  }
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
