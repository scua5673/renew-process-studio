import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await(await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&!!document.querySelector('.tb-grip'));
  await page.waitForTimeout(1000);
  const bar=f.locator('#boardPageStrip>.tb-c'),grip=f.locator('.tb-grip');
  const before=await bar.boundingBox(),g=await grip.boundingBox();
  await page.mouse.move(g.x+g.width/2,g.y+g.height/2);
  await page.mouse.down();await page.mouse.move(g.x+g.width/2-130,g.y+g.height/2+210,{steps:12});await page.mouse.up();
  const after=await bar.boundingBox();assert.ok(after.y>before.y+180,'mouse drag moves toolbar down');
  assert.ok(after.x<before.x-100,'mouse drag moves toolbar sideways');
  await f.locator('[data-v="3d"]').click();
  await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
  await f.locator('[data-v="flat"]').click();
  await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'));
  assert.ok(Math.abs((await bar.boundingBox()).y-after.y)<3,'view switch keeps moved position');
  await f.evaluate(()=>{window.__psTopBar.unbuild();window.__psTopBar.build();});
  assert.ok(Math.abs((await bar.boundingBox()).y-after.y)<3,'rebuilding page controls keeps position');
  await grip.focus();await page.keyboard.press('ArrowDown');
  assert.ok((await bar.boundingBox()).y>after.y+5,'keyboard moves toolbar');
  await page.setViewportSize({width:800,height:600});await page.waitForTimeout(800);
  assert.ok(await f.evaluate(()=>{const b=document.querySelector('.tb-c').getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;}),'resize keeps toolbar reachable');
  await grip.focus();await page.keyboard.press('Home');
  assert.equal(await bar.evaluate(e=>e.classList.contains('tb-moved')),false,'Home restores original position');
  // Pointer capture uses the same handlers for a finger/pen; a cancel must stop movement.
  const touch=await grip.evaluate(e=>{
    const r=e.getBoundingClientRect(),fire=(name,x,y)=>e.dispatchEvent(new PointerEvent(name,{bubbles:true,pointerId:77,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y}));
    // Synthetic pointers cannot acquire native capture.
    e.setPointerCapture=()=>{};e.hasPointerCapture=()=>false;
    fire('pointerdown',r.x+10,r.y+10);fire('pointermove',r.x+20,r.y+110);
    const moved=e.parentElement.getBoundingClientRect().top;
    fire('pointercancel',r.x+20,r.y+110);fire('pointermove',r.x+20,r.y+210);
    return {moved:moved>r.y+70,stopped:e.parentElement.getBoundingClientRect().top===moved};
  });
  assert.deepEqual(touch,{moved:true,stopped:true});
  console.log(engine+': toolbar drag, view toggle, rebuild, resize, keyboard and touch cancellation passed');
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
