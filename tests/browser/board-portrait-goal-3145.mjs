import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';

// c254ba8f: the pitch fits its SVG, but the floating view controls cover its top goal.
// Measure actual rectangles and hit targets in the synthetic app, including resize and view changes.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
  await page.setViewportSize({width:1470,height:885});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await(await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&typeof window.__setBoardOrient==='function');
  await page.waitForTimeout(1200);
  const measure=(frame=f)=>frame.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const goals=[...document.querySelectorAll('.pitch-goal')].map(rect);
    const bars=[...document.querySelectorAll('#boardPageStrip .tb-g,#ehDoor')].map(rect).filter(r=>r.width&&r.height);
    const hits=goals.map(r=>{const e=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return !!e&&!!e.closest('#boardPageStrip,#ehDoor');});
    return {goals,bars,hits,svg:rect(svg),orientation:state.orientation,vb:svg.getAttribute('viewBox')};
  });
  const clear=(m,label)=>{
    assert.equal(m.orientation,'v');assert.equal(m.goals.length,2);
    for(const g of m.goals){
      assert.ok(g.top>=m.svg.top-1&&g.bottom<=m.svg.bottom+1,label+' goal is inside SVG '+JSON.stringify(m));
      for(const b of m.bars)assert.ok(g.right<=b.left||g.left>=b.right||g.bottom<=b.top||g.top>=b.bottom+4,label+' goal is not covered by toolbar '+JSON.stringify(m));
    }
    assert.deepEqual(m.hits,[false,false],label+' goal hit targets do not land on toolbar');
  };
  const results=[];
  for(const width of [1470,1280,768,393,375]){
    await page.setViewportSize({width,height:width<768?812:885});
    await f.evaluate(()=>window.__setBoardOrient('v'));
    await page.waitForTimeout(650);
    let m=await measure();clear(m,String(width));results.push({width,topGoal:Math.min(...m.goals.map(g=>g.top)),toolbarBottom:Math.max(0,...m.bars.map(b=>b.bottom))});
    await page.screenshot({path:path.join(SHOTS,`portrait-goal-${engine}-${width}.png`)});
    await f.evaluate(()=>{state.spFlip=true;applyView();});
    clear(await measure(),width+' reversed');
    await f.evaluate(()=>{state.spFlip=false;applyView();});
  }
  await page.setViewportSize({width:1470,height:885});
  await page.waitForTimeout(650);
  const flat=await measure();clear(flat,'restored width');
  if(engine==='chromium'){
    await f.locator('#boardPageStrip [data-v="3d"]').click();
    await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
    await page.waitForTimeout(350);
    await f.locator('#boardPageStrip [data-v="flat"]').click();
    await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'));
    await page.waitForTimeout(350);
    const back=await measure();clear(back,'3D to flat');assert.equal(back.vb,flat.vb,'switching views does not accumulate inset');
  }
  await f.evaluate(()=>window.__setBoardOrient('h'));
  await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>window.PSTopBar.topInset(svg,'h')),0,'horizontal pitch keeps its existing fit');
  await f.evaluate(()=>{state.players=[{id:9001,team:'blue',num:7,x:300,y:300}];renderTokens();window.__setBoardOrient('v');});
  await page.waitForTimeout(500);
  const occupied=await measure();clear(occupied,'board with players');
  assert.ok(Math.min(...occupied.goals.map(g=>g.top))<Math.min(...flat.goals.map(g=>g.top))-20,'hidden formation door no longer reserves space');
  if(engine==='webkit'){
    const {page:phone}=await openApp(fx,'phone',{browsers});
    await phone.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const pf=await(await phone.waitForSelector('#fBoard')).contentFrame();
    await pf.waitForFunction(()=>window.__boardReady&&typeof window.__setBoardOrient==='function');
    for(const width of [375,393]){
      await phone.setViewportSize({width,height:812});
      await pf.evaluate(()=>window.__setBoardOrient('v'));
      await phone.waitForTimeout(650);
      clear(await measure(pf),'phone context '+width);
      await phone.screenshot({path:path.join(SHOTS,`portrait-goal-phone-${width}.png`)});
    }
    await phone.close();
  }
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,test:'board-portrait-goal-3145',passed:true,results}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
