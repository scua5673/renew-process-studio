import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={},checks=[];
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers});
  await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&typeof window.__applyPitchN==='function');
  await f.evaluate(()=>{autoOrient=false;__setTilt(true);__setBoardOrient('h');__setPitchSpec('u12');__setPitchN(3);applyView();__applyPitchN(3);});
  await page.waitForTimeout(350);
  const probe=await f.evaluate(()=>{
    const g=document.querySelector('#ps-multipitch [data-pitch-rect]'),r=g.getAttribute('data-pitch-rect').split(',').map(Number);
    const boxes=[...g.children].filter(e=>e.tagName==='rect'),circle=g.querySelector('circle');
    return {boxRatio:+boxes[1]?.getAttribute('height')/r[3],circleRatio:+circle?.getAttribute('r')/r[2]};
  });
  await f.evaluate(()=>document.querySelector('#lineSeg [data-ln="off"]').click());await page.waitForTimeout(250);
  const hidden=await f.evaluate(()=>({lines:state.lines,marks:document.querySelectorAll('#ps-multipitch circle,#ps-multipitch ellipse').length}));
  const grids={};
  for(const type of ['off','lanes','grid','zone20','thirds','fthird','grid15']){
    await f.evaluate(type=>document.querySelector('#gridSeg [data-g="'+type+'"]').click(),type);await page.waitForTimeout(100);
    grids[type]=await f.evaluate(()=>[...document.querySelector('#ps-multipitch [data-pitch-rect]').querySelectorAll('[stroke-dasharray]')].length);
  }
  const baseline={probe,hidden,grids};fs.writeFileSync(path.join(OUT,'initial-probe.json'),JSON.stringify(baseline,null,2));
  if(process.env.PS_PITCH_PROBE==='1'){console.log(JSON.stringify(baseline));}
  else{
    assert.ok(Math.abs(probe.boxRatio-12.5/65)<1e-6,'8-a-side penalty area follows the selected specification');
    assert.ok(Math.abs(probe.circleRatio-7/48)<1e-6,'8-a-side center circle follows the selected specification');
    assert.equal(hidden.marks,0,'line visibility applies to every pitch');
    assert.deepEqual(grids,{off:0,lanes:4,grid:8,zone20:11,thirds:2,fthird:2,grid15:6});
  }
  if(process.env.PS_PITCH_PROBE!=='1'){
    await f.evaluate(()=>{__psToggleBoardSettings('toggle');});
    await f.locator('#cmd-board-settings-pitch-tab').click();
    for(const n of [1,2,3,4,5,6]){
      await f.locator('#cmdPitchNSeg [data-n="'+n+'"]').click();
      assert.equal(await f.evaluate(()=>__getPitchN()),n);
      assert.equal(await f.locator('#cmdPitchNSeg .on').getAttribute('data-n'),String(n));
    }
    for(const type of ['off','lanes','grid','zone20','thirds','grid15']){
      await f.locator('#zonePreset [data-ps="full|'+type+'"]').click();
      assert.equal(await f.evaluate(()=>__getGridType()),type);
      assert.equal(await f.locator('#zonePreset button.on').count(),1);
      assert.equal(await f.evaluate(()=>document.querySelector('#ps-multipitch [data-pitch-rect]').querySelectorAll('[stroke-dasharray]').length),grids[type]);
    }
    await f.evaluate(()=>__psToggleBoardSettings('force-close'));
    for(const spec of ['fifa','u12','futsal'])for(const n of [1,2,3,4,5,6])for(const orientation of ['h','v']){
      await f.evaluate(({spec,n,orientation})=>{__setPitchSpec(spec);document.querySelector('#lineSeg [data-ln="on"]').click();document.querySelector('#gridSeg [data-g="off"]').click();__setBoardOrient(orientation);__setPitchN(n);applyView();__applyPitchN(n);tiltGoalsSync();},{spec,n,orientation});
      await page.waitForTimeout(100);
      const data=await f.evaluate(()=>{
        const sp=__getPitchSpec(),rs=__psPitchRects||[],geo=__tiltGoalsGeo();
        const cards=[...document.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>{
          const r=g.getAttribute('data-pitch-rect').split(',').map(Number),c=g.querySelector('circle,ellipse');
          return {r,cc:+c.getAttribute(c.tagName==='ellipse'?'rx':'r')/r[2],goals:g.querySelectorAll('.ps-pitch-goal').length};
        });
        const footprints=geo.goals.map(g=>{const ps=[g.a,g.b,g.a.map((v,i)=>v+g.n[i]*g.d),g.b.map((v,i)=>v+g.n[i]*g.d)];return [Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))];});
        return {sp,cards,footprints,goals:geo.goals.length,fronts:document.querySelectorAll('#tiltGoals .goal-front').length,finite:geo.goals.every(g=>[...g.a,...g.b,g.h,g.d].every(Number.isFinite)),single:document.getElementById('lineLayer')?.style.display};
      });
      assert.equal(data.cards.length,n===1?0:n);assert.equal(data.goals,n*2);assert.equal(data.fronts,n*2);assert.ok(data.finite);
      for(let i=0;i<data.footprints.length;i++)for(let j=i+1;j<data.footprints.length;j++){
        const a=data.footprints[i],b=data.footprints[j];
        assert.ok(Math.min(a[2],b[2])-Math.max(a[0],b[0])<=1e-6||Math.min(a[3],b[3])-Math.max(a[1],b[1])<=1e-6,'3D goal footprints must not intersect: '+JSON.stringify({spec,n,orientation,i,j,a,b}));
      }
      for(const card of data.cards){assert.equal(card.goals,2);assert.ok(Math.abs(card.r[2]/card.r[3]-data.sp.wid/data.sp.len)<1e-6);assert.ok(Math.abs(card.cc-data.sp.cc/data.sp.wid)<1e-6);}
      assert.equal(data.single,n===1?'':'none');checks.push({spec,n,orientation});
    }
    for(const n of [1,3,6])for(const color of ['#fafafa','#102040','#dddddd']){
      await f.evaluate(({n,color})=>{__setPitchN(n);applyView();__applyPitchN(n);__applyPitch('custom',color);},{n,color});
      const paints=await f.evaluate(()=>({expected:getCss('--pline').trim(),actual:[...document.querySelectorAll(state.pitchN>1?'#ps-multipitch [data-pitch-rect] > circle':'#lineLayer > circle')].map(c=>c.getAttribute('stroke')==='none'?c.getAttribute('fill'):c.getAttribute('stroke')||c.getAttribute('fill'))}));
      assert.ok(paints.actual.length>0);assert.ok(paints.actual.every(c=>c===paints.expected),'custom color contrast refreshes without changing theme key');
    }
    await f.evaluate(()=>{document.querySelector('#lineSeg [data-ln="off"]').click();});
    assert.equal(await f.evaluate(()=>__tiltGoalsGeo().goals.length),0);
    assert.equal(await f.evaluate(()=>new DOMParser().parseFromString(boardImageXML().xml,'image/svg+xml').querySelectorAll('#ps-multipitch circle,#ps-multipitch .ps-pitch-goal').length),0);
    const hiddenSnap=await f.evaluate(()=>captureSnap());
    await f.evaluate(()=>document.querySelector('#lineSeg [data-ln="on"]').click());
    await f.evaluate(s=>loadSnap(s),hiddenSnap);
    assert.equal(await f.evaluate(()=>document.querySelectorAll('#ps-multipitch circle').length),0);
    await f.evaluate(()=>document.querySelector('#lineSeg [data-ln="on"]').click());
    // Saved board, undo and exports preserve the same settings and rendering.
    const saved=await f.evaluate(()=>captureSnap());
    await f.evaluate(()=>{__setPitchN(1);applyView();__applyPitchN(1);});
    await f.evaluate(s=>loadSnap(s),saved);await page.waitForTimeout(200);
    assert.equal(await f.evaluate(()=>document.querySelectorAll('#ps-multipitch [data-pitch-rect]').length),6);
    assert.equal(await f.evaluate(()=>new DOMParser().parseFromString(boardImageXML().xml,'image/svg+xml').querySelectorAll('#ps-multipitch [data-pitch-rect]').length),6);
    // A count edit is reversible, and changing to the blank grid clears old courts.
    await f.evaluate(()=>{__setPitchN(2);__applyPitchN(2);undoLast();});
    assert.equal(await f.evaluate(()=>__getPitchN()),6);
    assert.equal(await f.evaluate(()=>document.querySelectorAll('#ps-multipitch [data-pitch-rect]').length),6);
    await f.evaluate(()=>__setPitchSpec('grid30'));await page.waitForTimeout(200);
    assert.equal(await f.evaluate(()=>__getPitchN()),1);
    assert.equal(await f.evaluate(()=>document.querySelectorAll('#lineLayer,#ps-multipitch').length),0);
    await f.evaluate(()=>{__setPitchSpec('u12');__applyPitch('real');__setPitchN(5);__setBoardOrient('h');applyView();__applyPitchN(5);__tiltFit();});await page.waitForTimeout(300);
    await f.evaluate(()=>{__psToggleBoardSettings('force-close');document.activeElement?.blur();});
    await page.mouse.move(10,10);
    await page.screenshot({path:path.join(SHOTS,'five-pitches-3d.png')});
    assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
    fs.writeFileSync(path.join(OUT,'matrix.json'),JSON.stringify(checks,null,2));
    console.log(JSON.stringify({engine,test:'board-settings-pitches',passed:true,cases:checks.length}));
  }
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
