import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.141 — 작전판에서 뜨는 것들 정리(studio/board-popups.js): 선택 옆 패널은 밝은 카드 · «맨 뒤»는 «맨 앞»과 한 줄 ·
// 도형 메뉴가 열리면 옆 패널은 숨김 · 알림은 도구 옵션 띠를 가리지 않는다. 터치(WebKit · 아이패드)는 옆 패널이 없어 알림 자리만.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const SHOT=process.env.PS_SHOT_DIR||'';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&window.__psShapeMenu&&window.__psPopups&&window.__psSelectionMenu&&document.getElementById('backSelBtn'));
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner),null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1200);
  const box=await (await page.$('#fBoard')).boundingBox();
  const U=async(x,y)=>{const c=await f.evaluate(([x,y])=>{const s=document.getElementById('board'),m=document.getElementById('world').getScreenCTM(),p=s.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(m);return {x:q.x,y:q.y};},[x,y]);return {x:box.x+c.x,y:box.y+c.y};};
  await f.evaluate(()=>{try{stopAnim();}catch(_){}state.tool='move';state.players=[{id:801,team:'blue',num:'7',name:'김민준',pos:'RW',x:400,y:300},{id:802,team:'blue',num:'9',name:'이서준',pos:'ST',x:250,y:620}];state.equipment=[];
    state.drawings=[{type:'line',color:'#ffffff',pts:[{x:150,y:600},{x:450,y:600}]},{type:'rect',color:'#ff3b30',pts:[{x:300,y:200},{x:520,y:360}]},{type:'text',color:'#ffffff',pts:[{x:600,y:150}],text:'하이 프레스'}];
    sel=null;multiSel=[];renderTokens();renderDrawings();updateDelUI();});
  const panel=()=>f.evaluate(()=>{const p=document.querySelector('.sel-ctl');if(!p)return null;const cs=getComputedStyle(p),r=p.getBoundingClientRect();
    const row=id=>{const e=document.getElementById(id);if(!e||getComputedStyle(e).display==='none')return null;const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.width),Math.round(b.height)];};
    return {near:p.classList.contains('sel-near'),disp:cs.display,w:Math.round(r.width),radius:cs.borderRadius,bg:cs.backgroundColor,color:cs.color,front:row('frontSelBtn'),back:row('backSelBtn'),dup:row('dupSelBtn'),del:row('delSelBtn'),size:row('sizeCtl'),title:p.querySelector('.ps-in-nm').textContent};});
  const isTouch=size!=='desktop';

  if(!isTouch){
    // 1) 사각형을 왼쪽 클릭 → 옆 패널은 밝은 카드 · 복제 · 맨 앞 · 맨 뒤 한 줄 · 삭제 전폭
    step('near-panel');
    const r=await U(410,280);await page.mouse.click(r.x,r.y);await page.waitForTimeout(350);
    let p=await panel();
    assert.ok(p&&p.near&&p.disp!=='none','그림을 고르면 옆 패널');
    assert.ok(p.w>=274&&p.w<=286,'compact card width '+JSON.stringify(p));
    assert.equal(p.radius,'13px');assert.equal(p.bg,'rgb(255, 255, 255)');
    assert.ok(p.dup&&p.del[1]>=240,'duplicate and full width delete are directly accessible');
    assert.equal(p.title,'도형 편집');
    await f.locator('.ps-sm-more summary').click();
    assert.ok(await f.locator('#frontSelBtn').isVisible()&&await f.locator('#backSelBtn').isVisible(),'stacking is accessible in expanded settings');
    await f.locator('.ps-sm-more summary').click();
    if(SHOT)await page.screenshot({path:SHOT+'/popups-near-rect.png'});
    // 2) 도형 메뉴가 열리면 옆 패널은 숨고, 닫히면 다시
    step('menu-hides-panel');
    await page.mouse.click(r.x,r.y,{button:'right'});await page.waitForTimeout(300);
    assert.equal(await f.evaluate(()=>!!document.getElementById('psShapeMenu')),true);
    assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-shape-menu-on')),true);
    p=await panel();assert.equal(p.disp,'none','메뉴가 열린 동안 옆 패널은 숨긴다');
    assert.equal(await f.evaluate(()=>[...document.querySelectorAll('#psShapeMenu button[data-act]')].map(b=>b.dataset.act).join(',')),'reset,front,back,dup,lock,more,del','메뉴 단추 차례(이후 장면 리셋 포함)');
    if(SHOT)await page.screenshot({path:SHOT+'/popups-menu-only.png'});
    await page.keyboard.press('Escape');await page.waitForTimeout(250);
    p=await panel();assert.ok(p.disp!=='none'&&!(await f.evaluate(()=>document.body.classList.contains('ps-shape-menu-on'))),'닫히면 옆 패널이 돌아온다');
    // 3) 메뉴의 «고정» → 선택 패널의 고정 단추를 대신 누른다
    step('menu-lock');
    await page.mouse.click(r.x,r.y,{button:'right'});await page.waitForTimeout(250);
    await f.evaluate(()=>document.querySelector('#psShapeMenu button[data-act="lock"]').click());await page.waitForTimeout(200);
    assert.equal(await f.evaluate(()=>!!state.drawings[1].locked),true,'고정');
    await page.mouse.click(r.x,r.y,{button:'right'});await page.waitForTimeout(250);
    assert.equal(await f.evaluate(()=>document.querySelector('#psShapeMenu button[data-act="lock"]').textContent),'고정 해제');
    await f.evaluate(()=>document.querySelector('#psShapeMenu button[data-act="lock"]').click());await page.waitForTimeout(200);
    assert.equal(await f.evaluate(()=>!!state.drawings[1].locked),false,'고정 해제');
    // 4) 글(텍스트) 패널도 같은 카드 · 메뉴엔 «내용 수정»
    step('text');
    await f.evaluate(()=>{selectItem('drawing',state.drawings[2]);updateDelUI();});await page.waitForTimeout(300);
    p=await panel();assert.equal(p.title,'글자 편집');assert.ok(p.w>=274&&p.w<=286);assert.equal(p.bg,'rgb(255, 255, 255)');
    await f.evaluate(()=>window.__psShapeMenu.open(state.drawings[2],300,300));
    assert.equal(await f.evaluate(()=>[...document.querySelectorAll('#psShapeMenu button[data-act]')].map(b=>b.dataset.act).join(',')),'edit,position-all,reset,front,back,dup,lock,del','글은 굵기 없이 내용 수정 · 모든 장면 위치 적용 · 이후 장면 리셋 · 순서 · 복제 · 고정 · 삭제');
    assert.equal(await f.evaluate(()=>!!document.getElementById('psSmW')),false);
    await f.evaluate(()=>window.__psShapeMenu.close());
    // 5) 묶음 — 토글은 한 줄에 셋
    step('multi');
    await f.evaluate(()=>{sel=null;multiSel=[state.players[0],state.players[1]];updateDelUI();updateAlignBar();try{positionSelCtl();}catch(_){}});await page.waitForTimeout(350);
    const m=await f.evaluate(()=>{const g=id=>{const e=document.getElementById(id);if(!e||getComputedStyle(e).display==='none')return null;const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.width)];};return {title:getComputedStyle(document.querySelector('.sel-ctl'),'::before').content,photo:g('photoBtn'),vis:g('visBtn'),trail:g('trailBtn'),h:Math.round(document.querySelector('.sel-ctl').getBoundingClientRect().height)};});
    assert.equal(m.title,'"선택 2개"');
    assert.ok(m.photo&&m.vis&&m.trail&&m.photo[0]===m.vis[0]&&m.vis[0]===m.trail[0],'사진 · 시야 · 잔상이 한 줄 '+JSON.stringify(m));
    assert.ok(m.h<520,'묶음 패널이 한 열 604px 보다 짧다 '+m.h);
    if(SHOT)await page.screenshot({path:SHOT+'/popups-multi.png'});
    await f.evaluate(()=>{sel=null;multiSel=[];updateDelUI();});
  }

  // 6) 알림은 도구 옵션 띠를 가리지 않는다
  step('toast-strip');
  const geo=()=>f.evaluate(()=>{const t=document.getElementById('cs-ftoast'),o=document.getElementById('ps-df-opts');const tr=t?t.getBoundingClientRect():null,or=o&&getComputedStyle(o).display!=='none'?o.getBoundingClientRect():null;return {toast:tr&&[Math.round(tr.top),Math.round(tr.bottom)],opts:or&&[Math.round(or.top),Math.round(or.bottom)],bottom:t&&t.style.bottom};});
  await f.evaluate(()=>toast('띠 없을 때'));await page.waitForTimeout(150);
  const g0=await geo();assert.ok(g0.toast,'알림이 뜬다');
  await f.evaluate(()=>{const b=[...document.querySelectorAll('#floatBar button')].find(b=>/^화살표/.test(b.title||''));if(b)b.click();});await page.waitForTimeout(400);
  const hasStrip=await f.evaluate(()=>{const o=document.getElementById('ps-df-opts');return !!(o&&getComputedStyle(o).display!=='none');});
  if(hasStrip){
    await f.evaluate(()=>toast('화살표 띠가 열렸을 때'));await page.waitForTimeout(150);
    const g1=await geo();
    assert.ok(g1.opts&&g1.toast[1]<=g1.opts[0],'알림이 띠 위에 '+JSON.stringify(g1));
    if(SHOT)await page.screenshot({path:SHOT+'/popups-toast-strip.png'});
    await f.evaluate(()=>{const b=[...document.querySelectorAll('#floatBar button')].find(b=>/이동·선택/.test(b.title||''));if(b)b.click();state.tool='move';});await page.waitForTimeout(400);
    await f.evaluate(()=>toast('띠를 닫은 뒤'));await page.waitForTimeout(150);
    const g2=await geo();
    assert.ok(!g2.opts&&g2.toast[0]>g1.toast[0],'띠가 닫히면 알림은 다시 아래로 '+JSON.stringify([g1,g2]));
  } else console.log('도구 옵션 띠가 없는 배치 — 알림 자리 건너뜀',size);

  const errs=logs.filter(l=>l.type==='pageerror');
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('board-popups-3141 ok',engine,size);
}catch(e){console.error('실패 단계:',cur);throw e;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
