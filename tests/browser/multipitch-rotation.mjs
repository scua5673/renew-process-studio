import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={},results=[];
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
  await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof window.__applyPitchN==='function'&&typeof window.__setBoardOrient==='function');
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded);
  await f.evaluate(()=>{autoOrient=false;window.__setBoardOrient('h');window.__setPitchN(2);applyView();window.__applyPitchN(2);});
  const read=()=>f.evaluate(()=>{
    const svg=document.getElementById('board'),world=document.getElementById('world'),m=world.getCTM(),v=svg.viewBox.baseVal;
    const rects=[...document.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>{
      const [x,y,w,h]=g.getAttribute('data-pitch-rect').split(',').map(Number),r=g.getBoundingClientRect();
      const c=g.querySelector('circle'),cr=c?.getBoundingClientRect();
      return {x,y,w,h,screen:{x:r.x,y:r.y,w:r.width,h:r.height},circle:cr?{w:cr.width,h:cr.height}:null};
    });
    const vr=svg.getBoundingClientRect();
    return {orientation:state.orientation,flip:state.spFlip,spec:state.pitchSpec||'fifa',base:window.__baseVB,rects,svg:{x:vr.x,y:vr.y,w:vr.width,h:vr.height},view:[v.x,v.y,v.width,v.height],matrix:[m.a,m.b,m.c,m.d,m.e,m.f]};
  });

  const bounds=q=>q.rects.map(({x,y,w,h})=>[x,y,w,h].map(v=>+v.toFixed(4)));
  const settle=async n=>{try{await f.waitForFunction(n=>document.querySelectorAll('#ps-multipitch [data-pitch-rect]').length===n,n);}catch(e){console.error(JSON.stringify(await f.evaluate(()=>({n:state.pitchN,ready:window.__boardReady,restored:window.__boardRestoreDone,rects:document.querySelectorAll('#ps-multipitch [data-pitch-rect]').length,view:window.__csView}))));throw e;}await page.waitForTimeout(180);};
  const check=(q,n,ratio)=>{
    assert.equal(q.rects.length,n);
    for(const r of q.rects){
      assert.ok(Math.abs(r.w/r.h-ratio)<.00001,'pitch ratio '+JSON.stringify(q));
      const a=r.screen,b=q.svg;
      assert.ok(a.x>=b.x-2&&a.y>=b.y-2&&a.x+a.w<=b.x+b.w+2&&a.y+a.h<=b.y+b.h+2,'whole pitch and goals fit the viewport '+JSON.stringify(q));
    }
  };
  // Actual settings buttons reproduce the report, including the asynchronous shell redraw.
  await f.evaluate(()=>window.__psToggleBoardSettings('toggle'));
  await f.locator('#cmd-board-settings-pitch-tab').click();
  await f.locator('#cmdPitchNSeg button[data-n="2"]').click();await settle(2);
  const first=await read();check(first,2,68/105);
  await f.locator('#cmdOrientSeg button[data-o="v"]').click();
  await settle(2);
  const vertical=await read();check(vertical,2,68/105);assert.deepEqual(bounds(vertical),bounds(first));
  await f.locator('#cmd-board-settings-rot .seg').nth(1).locator('button').click();await settle(2);
  const rotated=await read();check(rotated,2,68/105);assert.deepEqual(bounds(rotated),bounds(first));
  await f.evaluate(()=>window.__psToggleBoardSettings('close'));
  // Every supported count, pitch specification and quarter-turn at phone/tablet/desktop widths.
  for(const width of [375,768,1280]){
    await page.setViewportSize({width,height:900});
    for(const [spec,ratio] of [['fifa',68/105],['u12',48/65],['futsal',.5]])for(const n of [2,3,4,5,6]){
      await f.evaluate(({spec,n})=>{window.__setBoardOrient('h');window.__setPitchSpec(spec);window.__setPitchN(n);applyView();window.__applyPitchN(n);},{spec,n});
      await settle(n);const base=await read();check(base,n,ratio);
      for(let turn=0;turn<4;turn++){
        await f.evaluate(()=>window.__rotateHalf());await settle(n);
        const q=await read();check(q,n,ratio);assert.deepEqual(bounds(q),bounds(base),'rotation keeps world layout');
        results.push({width,spec,n,turn,base:q.base,rects:bounds(q)});
      }
    }
  }
  // Drawing and player coordinates survive a full turn and reload of a saved board.
  await page.setViewportSize({width:1280,height:900});
  await f.evaluate(()=>{window.__setBoardOrient('h');window.__setPitchSpec('fifa');window.__setPitchN(2);applyView();window.__applyPitchN(2);state.players=[{id:9001,team:'blue',num:'1',x:300,y:300}];state.equipment=[{id:9100,team:'cone',x:350,y:400}];state.drawings=[{type:'pass',pts:[{x:300,y:300},{x:400,y:400}],color:'#fff'}];renderTokens();renderDrawings();});
  const data=()=>f.evaluate(()=>JSON.stringify([state.players,state.equipment,state.drawings]));const before=await data();
  for(let i=0;i<4;i++){await f.evaluate(()=>window.__rotateHalf());await settle(2);}assert.equal(await data(),before);
  const saved=await f.evaluate(()=>captureSnap());
  await f.evaluate(()=>{window.__setPitchN(1);window.__applyPitchN(1);});await settle(0);
  await f.evaluate(s=>loadSnap(s),saved);await settle(2);assert.equal(await data(),before);check(await read(),2,68/105);
  // The export uses the same fitted rectangles.
  const exported=await f.evaluate(()=>{const o=boardImageXML(),d=new DOMParser().parseFromString(o.xml,'image/svg+xml');return [...d.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>g.getAttribute('data-pitch-rect').split(',').map(v=>+Number(v).toFixed(4)));});
  assert.deepEqual(exported,bounds(await read()));
  await f.evaluate(()=>window.__setBoardOrient('v'));await settle(2);
  await page.screenshot({path:path.join(SHOTS,'two-pitches-vertical.png')});
  fs.writeFileSync(path.join(OUT,'geometry.json'),JSON.stringify(results,null,2));
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,test:'multipitch-rotation',passed:true,cases:results.length,actualSettings:true,reload:true,export:true}));

}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
