import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.138 — 도형 오른쪽 클릭 메뉴 · «맨 뒤» 단추(studio/board-shape-menu.js, 제보 0a1f6e9d 박수빈).
// 마우스: 선 · 사각형을 오른쪽 클릭 → 굵기 · 투명도 · 맨 앞 · 맨 뒤 · 삭제. 터치(WebKit · 아이패드): 선택 패널의 «맨 뒤» · 메뉴 API.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const SHOT=process.env.PS_SHOT_DIR||'';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&window.__psShapeMenu&&document.getElementById('backSelBtn'));
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner),null,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1200);
  const box=await (await page.$('#fBoard')).boundingBox();
  const U=async(x,y)=>{const c=await f.evaluate(([x,y])=>{const s=document.getElementById('board'),m=document.getElementById('world').getScreenCTM(),p=s.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(m);return {x:q.x,y:q.y};},[x,y]);return {x:box.x+c.x,y:box.y+c.y};};
  const reset=()=>f.evaluate(()=>{try{stopAnim();}catch(_){}state.tool='move';state.players=[];state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();updateDelUI();});
  const seed=()=>f.evaluate(()=>{state.drawings=[{type:'line',color:'#ffffff',pts:[{x:150,y:600},{x:450,y:600}]},{type:'rect',color:'#ff3b30',pts:[{x:300,y:200},{x:520,y:360}]}];sel=null;multiSel=[];renderDrawings();updateDelUI();});
  const menuOpen=()=>f.evaluate(()=>!!document.getElementById('psShapeMenu'));
  const order=()=>f.evaluate(()=>state.drawings.map(d=>d.type));
  const slide=(id,v)=>f.evaluate(([id,v])=>{const r=document.getElementById(id);r.value=String(v);r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}));return r.value;},[id,v]);
  const isTouch=size!=='desktop';
  await reset();await seed();

  if(!isTouch){
    // 1) 사각형 안을 오른쪽 클릭 → 메뉴 · 고름 · 안 움직임
    step('right-click-rect');
    const r=await U(410,280);
    await page.mouse.click(r.x,r.y,{button:'right'});await page.waitForTimeout(300);
    assert.equal(await menuOpen(),true,'오른쪽 클릭이면 도형 메뉴');
    assert.equal(await f.evaluate(()=>sel&&sel.type==='drawing'&&sel.ref===state.drawings[1]),true,'그 도형을 고른다');
    assert.deepEqual(await f.evaluate(()=>state.drawings[1].pts),[{x:300,y:200},{x:520,y:360}],'오른쪽 클릭은 끌지 않는다');
    assert.match(await f.evaluate(()=>document.querySelector('#psShapeMenu .sm-head').textContent),/사각형/);
    assert.deepEqual(await f.evaluate(()=>[document.getElementById('psSmW').value,document.getElementById('psSmO').value]),['1','1'],'지금 값으로 시작');
    if(SHOT)await page.screenshot({path:SHOT+'/shape-menu-rect.png'});
    // 2) 굵기 · 투명도 — 그 도형에만, 새로 그릴 기본값은 그대로, 되돌리기 한 번
    step('sliders');
    const lw0=await f.evaluate(()=>[state.drawLw,state.drawOp]);
    await slide('psSmW',2.5);await page.waitForTimeout(120);
    assert.equal(await f.evaluate(()=>state.drawings[1].lw),2.5);
    assert.equal(await f.evaluate(()=>document.getElementById('psSmWv').textContent),'2.5');
    await slide('psSmO',0.5);await page.waitForTimeout(120);
    assert.equal(await f.evaluate(()=>state.drawings[1].op),0.5);
    assert.equal(await f.evaluate(()=>document.getElementById('psSmOv').textContent),'50%');
    assert.equal(await f.evaluate(()=>state.drawings[0].lw),undefined,'다른 도형은 그대로');
    assert.deepEqual(await f.evaluate(()=>[state.drawLw,state.drawOp]),lw0,'새로 그릴 기본값(선 스타일 팝오버)은 안 바꾼다');
    if(SHOT)await page.screenshot({path:SHOT+'/shape-menu-sliders.png'});
    assert.equal(await menuOpen(),true,'슬라이더를 움직여도 메뉴는 열려 있다');
    await page.keyboard.press('Escape');await page.waitForTimeout(150);
    assert.equal(await menuOpen(),false,'Esc 로 닫힌다');
    await f.evaluate(()=>undoLast());await page.waitForTimeout(150);
    assert.deepEqual(await f.evaluate(()=>[state.drawings[1].lw||1,state.drawings[1].op==null?1:state.drawings[1].op]),[1,1],'⌘Z 한 번에 굵기 · 투명도가 함께 돌아온다');
    // 3) 맨 뒤 · 맨 앞
    step('z-order');
    await page.mouse.click(r.x,r.y,{button:'right'});await page.waitForTimeout(250);
    await f.evaluate(()=>document.querySelector('#psShapeMenu button[data-act="back"]').click());await page.waitForTimeout(200);
    assert.deepEqual(await order(),['rect','line'],'«맨 뒤» — 사각형이 선 아래로');
    assert.equal(await menuOpen(),false,'순서를 바꾸면 메뉴가 닫힌다');
    const r2=await U(410,280);
    await page.mouse.click(r2.x,r2.y,{button:'right'});await page.waitForTimeout(250);
    assert.equal(await menuOpen(),true);
    await f.evaluate(()=>document.querySelector('#psShapeMenu button[data-act="front"]').click());await page.waitForTimeout(200);
    assert.deepEqual(await order(),['line','rect'],'«맨 앞» — 다시 위로');
    // 4) 선을 오른쪽 클릭 → 굵기가 그려진 선에 바로
    step('line');
    const l=await U(300,600);
    await page.mouse.click(l.x,l.y,{button:'right'});await page.waitForTimeout(250);
    assert.equal(await menuOpen(),true,'선도 오른쪽 클릭 메뉴');
    assert.match(await f.evaluate(()=>document.querySelector('#psShapeMenu .sm-head').textContent),/^선/);
    assert.equal(await f.evaluate(()=>sel&&sel.ref===state.drawings[0]),true);
    await slide('psSmW',2);await page.waitForTimeout(150);
    assert.equal(await f.evaluate(()=>state.drawings[0].lw),2);
    assert.equal(await f.evaluate(()=>{const g=document.querySelector('#drawLayer > g');return [...g.querySelectorAll('path,line')].some(p=>+p.getAttribute('stroke-width')===9);}),true,'그려진 선 굵기 4.5×2');
    await page.keyboard.press('Escape');
    // 5) 빈 곳 오른쪽 클릭은 메뉴 없음 · 왼쪽 클릭은 메뉴 없이 고르기만
    step('empty');
    const e=await U(60,60);
    await page.mouse.click(e.x,e.y,{button:'right'});await page.waitForTimeout(200);
    assert.equal(await menuOpen(),false,'빈 곳은 메뉴 없음');
    await page.mouse.click(r2.x,r2.y);await page.waitForTimeout(250);
    assert.equal(await menuOpen(),false,'왼쪽 클릭은 메뉴를 열지 않는다');
    assert.equal(await f.evaluate(()=>sel&&sel.ref===state.drawings[1]),true,'왼쪽 클릭은 고르기');
    // 6) 선택 패널의 «맨 뒤»
    step('back-button');
    assert.notEqual(await f.evaluate(()=>getComputedStyle(document.getElementById('backSelBtn')).display),'none','«맨 뒤» 단추가 «맨 앞» 옆에');
    assert.equal(await f.evaluate(()=>document.getElementById('backSelBtn').previousElementSibling.id),'frontSelBtn');
    await f.evaluate(()=>document.getElementById('backSelBtn').click());await page.waitForTimeout(200);
    assert.deepEqual(await order(),['rect','line'],'패널 «맨 뒤»');
    if(SHOT)await page.screenshot({path:SHOT+'/shape-menu-panel.png'});
    // 7) 묶음 — 둘을 골라 둔 채 하나를 오른쪽 클릭하면 둘 다
    step('multi');
    await f.evaluate(()=>{sel=null;multiSel=[state.drawings[0],state.drawings[1]];updateDelUI();});
    const r3=await U(410,280);
    await page.mouse.click(r3.x,r3.y,{button:'right'});await page.waitForTimeout(250);
    assert.match(await f.evaluate(()=>document.querySelector('#psShapeMenu .sm-head').textContent),/2개/,'묶음 2개');
    await slide('psSmO',0.6);await page.waitForTimeout(150);
    assert.deepEqual(await f.evaluate(()=>state.drawings.map(d=>d.op)),[0.6,0.6],'둘 다');
    // 8) 삭제
    step('delete');
    await f.evaluate(()=>document.querySelector('#psShapeMenu button[data-act="del"]').click());await page.waitForTimeout(200);
    assert.deepEqual(await order(),[],'묶음 삭제');
    await f.evaluate(()=>undoLast());await page.waitForTimeout(150);
    assert.equal(await f.evaluate(()=>state.drawings.length),2,'되돌리기');
  } else {
    // 손가락(아이패드)엔 오른쪽 클릭이 없다 — 선택 패널의 «맨 뒤»와 메뉴 API 만
    step('touch-back');
    await f.evaluate(()=>{selectItem('drawing',state.drawings[1]);updateDelUI();});
    await page.waitForTimeout(250);
    assert.equal(await f.evaluate(()=>document.getElementById('backSelBtn').style.display),await f.evaluate(()=>document.getElementById('frontSelBtn').style.display),'«맨 앞»과 같이 보인다');
    await f.evaluate(()=>document.getElementById('backSelBtn').click());await page.waitForTimeout(200);
    assert.deepEqual(await order(),['rect','line'],'패널 «맨 뒤»');
    step('touch-api');
    await f.evaluate(()=>window.__psShapeMenu.open(state.drawings[0],200,200));
    assert.equal(await menuOpen(),true);
    await slide('psSmW',1.5);await page.waitForTimeout(120);
    assert.equal(await f.evaluate(()=>state.drawings[0].lw),1.5);
    await f.evaluate(()=>window.__psShapeMenu.close());
    assert.equal(await menuOpen(),false);
  }

  const errs=logs.filter(l=>l.type==='pageerror');
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('shape-menu-3138 ok',engine,size);
}catch(e){console.error('실패 단계:',cur);throw e;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
