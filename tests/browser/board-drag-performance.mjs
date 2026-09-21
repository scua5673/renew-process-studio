import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-drag-performance');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-depth-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
const results=[];
try{for(const view of ['flat','depth'])for(const viewport of [{width:1280,height:900},{width:820,height:1180},{width:393,height:852}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),errors=[];
  try{
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
      const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'});
    });
    await context.addInitScript(({UID,WID})=>{
      localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'fixture',rt:'fixture'}));
      localStorage.setItem('ps_active_ws',WID);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'personal',role:'owner',owner_id:UID}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[UID]:{role:'executive'}},defaultRole:'player'}));
      window.PSSync={session:()=>({uid:UID}),activeWs:()=>WID,activeWsObj:()=>({id:WID,kind:'personal',role:'owner',owner_id:UID}),dataUnlocked:()=>true,keyReady:()=>true,act(){},ping(){},event(){}};
    },{UID,WID});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+'/studio/board.html?fixture=depth');
    await page.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);
    await page.evaluate(()=>{
      boardShowDefault();const s=captureSnap();s.players=[{id:'depth-a',team:'blue',num:8,name:'A',x:450,y:340},{id:'depth-b',team:'red',num:9,name:'B',x:620,y:470}];
      s.equipment=Object.keys(EQUIP_LABEL).filter(team=>team!=='ball').map(team=>({id:'equip-'+team,team,x:720,y:340}));s.ball={id:'ball',team:'ball',x:570,y:350};s.drawings=[];loadSnap(s);state.tool='move';
    });
    await page.evaluate(()=>{
      const s=captureSnap();for(let i=2;i<22;i++)s.players.push({id:'depth-'+i,team:i%2?'blue':'red',num:i+1,x:180+(i%8)*100,y:180+Math.floor(i/8)*180});loadSnap(s);
    });
    const targets=await page.evaluate(()=>['depth-a','ball',...state.equipment.map(p=>String(p.id))]);
    for(const orientation of ['h','v']){
      await page.evaluate(({orientation,view})=>{state.orientation=orientation;buildPitch();__setTilt(view==='depth');if(view==='depth')__tiltFit();},{orientation,view});
      // Rebuilding the pitch while depth stays enabled used to remove all four
      // anchors. Re-enabling depth here would mask that real navigation path.
      if(view==='depth')await page.evaluate(()=>{
        buildPitch();renderTokens();
        if(world.querySelectorAll('[id^="bcM"]').length!==4)throw Error('pitch rebuild lost projection anchors');
        bcSetCam(false,true);
        if(world.querySelectorAll('[id^="bcM"]').length!==4)throw Error('camera off lost depth anchors');
        exitMatch();
        if(world.querySelectorAll('[id^="bcM"]').length!==4)throw Error('match exit lost depth anchors');
        world.querySelector('#bcM0').remove();bcAddLight();
        if(world.querySelectorAll('[id^="bcM"]').length!==4)throw Error('existing light prevented anchor repair');
      });
      // Let the normal fit/resize callbacks settle before measuring a fixed projection.
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      // Independent rendered-point oracle: never compute expected movement with
      // clientToUnit, since that would accept the same broken projection twice.
      for(const target of ['depth-a','ball']){
        const tracking=await page.evaluate(({target})=>{
          sel=null;multiSel=[];state.tool='move';renderTokens();
          const p=tokenItems().find(it=>String(it.o.id)===target).o;
          const initial={x:p.x,y:p.y},g=tokenLayer.querySelector('[data-id="'+target+'"]');
          const probe=el('circle',{cx:5,cy:-8,r:.001,fill:'none','pointer-events':'none'});g.appendChild(probe);
          const point=()=>{const r=probe.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
          const start=point(),expected={x:start.x+12,y:start.y+14};
          const fire=(type,q)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:91,pointerType:'mouse',buttons:type==='pointerup'?0:1,clientX:q.x,clientY:q.y}));
          fire('pointerdown',start);fire('pointermove',expected);fire('pointerup',expected);
          const actual=point(),anchors=world.querySelectorAll('[id^="bcM"]').length;
          probe.remove();p.x=initial.x;p.y=initial.y;renderTokens();
          return {actual,expected,anchors};
        },{target});
        if(view==='depth')assert.equal(tracking.anchors,4,'pitch rebuild must retain perspective anchors');
        assert.ok(Math.hypot(tracking.actual.x-tracking.expected.x,tracking.actual.y-tracking.expected.y)<.5,JSON.stringify({view,orientation,target,tracking}));
      }
      for(const target of targets)for(const finish of ['frame','frame-layout','release','cancel']){
        const metrics=await page.evaluate(async ({finish,target})=>{
          sel=null;multiSel=[];state.tool='move';renderTokens();clearBoardHistory();
          const p=tokenItems().find(it=>String(it.o.id)===target).o,g=tokenLayer.querySelector('[data-id="'+target+'"]'),face=g.querySelector('.ps-depth-face'),mesh=g.querySelector('.ps-equipment-mesh');
          const start={x:p.x,y:p.y},b=g.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
          // Layout can change between input and its RAF (including normal tilt
          // fitting). Verify against the projection actually used at each end,
          // not a future move projected with the pointerdown geometry.
          const samples=[],toUnitOriginal=clientToUnit;
          clientToUnit=function(cx,cy){const unit=toUnitOriginal(cx,cy);samples.push({cx,cy,x:unit.x,y:unit.y});return unit;};
          const fire=(type,x,y)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:42,pointerType:'mouse',buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
          let transforms=0,solves=0,reads=0,ctmReads=0;const attr=g.setAttribute,solve=_bcSolveH,ctm=drawLayer.getScreenCTM;
          drawLayer.getScreenCTM=function(){ctmReads++;return ctm.call(this);};
          g.setAttribute=function(k,v){if(k==='transform')transforms++;return attr.call(this,k,v);};
          _bcSolveH=function(...a){solves++;return solve(...a);};
          const markers=[0,1,2,3].map(i=>world.querySelector('#bcM'+i)).filter(Boolean),rects=markers.map(m=>m.getBoundingClientRect);
          markers.forEach((m,i)=>m.getBoundingClientRect=function(){reads++;return rects[i].call(this);});
          fire('pointerdown',x,y);transforms=0;solves=0;reads=0;ctmReads=0;
          for(let i=1;i<=120;i++)fire('pointermove',x+i/4,y+i/6);
          const stage=document.getElementById('boardStage'),stageTransform=stage.style.transform;
          if(finish==='frame-layout')stage.style.transform='translateX(6px)';
          if(finish.startsWith('frame'))await new Promise(requestAnimationFrame);
          // A release/cancel in the same task must flush the latest sample before undo/save.
          const beforeEnd={transforms,solves,reads};fire(finish==='cancel'?'pointercancel':'pointerup',x+30,y+20);
          const afterEnd=transforms;
          await new Promise(requestAnimationFrame);
          const a=samples[0],z=samples.at(-1),expected={x:start.x+z.x-a.x,y:start.y+z.y-a.y};
          const result={moves:120,beforeEnd,transforms,solves,reads,ctmReads,afterEnd,expected,samples,lastInput:{x:x+30,y:y+20},actual:{x:p.x,y:p.y},undo:undoStack.length,sameFace:face===g.querySelector('.ps-depth-face'),sameMesh:mesh===g.querySelector('.ps-equipment-mesh'),dragging:document.body.classList.contains('token-drag')};
          clientToUnit=toUnitOriginal;drawLayer.getScreenCTM=ctm;stage.style.transform=stageTransform;
          g.setAttribute=attr;_bcSolveH=solve;markers.forEach((m,i)=>m.getBoundingClientRect=rects[i]);
          undoLast();const restored=tokenItems().find(it=>String(it.o.id)===target).o;result.undoPosition={x:restored.x,y:restored.y};result.start=start;return result;
        },{finish,target});
        assert.equal(metrics.transforms,1);assert.equal(metrics.afterEnd,1);assert.ok(metrics.solves<=1);assert.equal(metrics.reads,view==='depth'?4:0);assert.equal(metrics.ctmReads,view==='flat'?1:0);
        results.push({view,target,width:viewport.width,orientation,finish,...metrics});
        assert.equal(metrics.beforeEnd.transforms,finish.startsWith('frame')?1:0);
        assert.equal(metrics.samples.length,2,'only grab and the latest movement are projected');
        assert.equal(metrics.samples[1].cx,metrics.lastInput.x);assert.equal(metrics.samples[1].cy,metrics.lastInput.y);
        if(finish==='frame-layout'&&view==='depth')assert.equal(metrics.solves,1,'a layout change invalidates the cached projection');
        assert.ok(Math.abs(metrics.actual.x-metrics.expected.x)<1e-5);assert.ok(Math.abs(metrics.actual.y-metrics.expected.y)<1e-5);
        assert.deepEqual(metrics.undoPosition,metrics.start);assert.equal(metrics.undo,1);assert.equal(metrics.sameFace,true);assert.equal(metrics.sameMesh,true);assert.equal(metrics.dragging,false);
      }
      const group=await page.evaluate(()=>{
        state.tool='move';sel=null;state.players[2].locked=true;multiSel=[state.players[0],state.ball,state.equipment[0],state.players[2]];const selected=multiSel.slice(),ids=selected.map(p=>String(p.id));renderTokens();clearBoardHistory();
        const p=state.players[0],g=tokenLayer.querySelector('[data-id="depth-a"]'),b=g.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
        const before=selected.map(p=>({x:p.x,y:p.y}));
        const fire=(type,x,y)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:45,pointerType:'mouse',buttons:1,clientX:x,clientY:y,shiftKey:true}));
        fire('pointerdown',x,y);for(let i=1;i<=60;i++)fire('pointermove',x+i/2,y+i/12);fire('pointerup',x+30,y+5);
        const delta=selected.map((p,i)=>({x:p.x-before[i].x,y:p.y-before[i].y})),undo=undoStack.length;
        undoLast();const restored=ids.map(id=>{const p=tokenItems().find(it=>String(it.o.id)===id).o;return {x:p.x,y:p.y};});state.players[2].locked=false;multiSel=[];renderTokens();return {delta,before,restored,undo};
      });
      assert.ok(Math.abs(group.delta[0].x-group.delta[1].x)<1e-7);assert.ok(Math.abs(group.delta[0].y-group.delta[1].y)<1e-7);assert.ok(Math.abs(group.delta[0].x-group.delta[2].x)<1e-7);assert.ok(Math.abs(group.delta[0].y-group.delta[2].y)<1e-7);assert.deepEqual(group.delta[3],{x:0,y:0});assert.ok(Math.hypot(group.delta[0].x,group.delta[0].y)>5);
      assert.ok(group.delta[0].x===0||group.delta[0].y===0);assert.deepEqual(group.restored,group.before);assert.equal(group.undo,1);
    }
    // Keep the 22-player stress checks above. Isolate the trusted drag target here:
    // phone hit circles intentionally overlap nearby players on the small pitch.
    await page.evaluate(()=>{state.players=state.players.slice(0,2);state.equipment=[];renderTokens();});
    // Actual trusted mouse events still move the raised face through pointer capture.
    const before=await page.evaluate(()=>({x:state.players[0].x,y:state.players[0].y}));
    const box=await page.locator('.token[data-id="depth-a"]'+(view==='depth'?' .ps-depth-face':'')).boundingBox();
    assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.token')?.getAttribute('data-id'),{x:box.x+box.width/2,y:box.y+box.height/3}),'depth-a');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/3);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/3+25,{steps:10});await page.mouse.up();
    const after=await page.evaluate(()=>({x:state.players[0].x,y:state.players[0].y}));assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>8);
    const touch=await page.evaluate(async()=>{
      sel=null;multiSel=[];renderTokens();clearBoardHistory();document.body.classList.add('ps-ipad-work');
      const p=state.players[0],start={x:p.x,y:p.y},g=tokenLayer.querySelector('[data-id="depth-a"]'),b=g.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
      const fire=(type,dx,dy)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:61,pointerType:'touch',buttons:1,clientX:x+dx,clientY:y+dy}));
      fire('pointerdown',0,0);await new Promise(r=>setTimeout(r,320));
      for(let i=1;i<=40;i++)fire('pointermove',i/2,i/3);fire('pointerup',20,40/3);
      const r={distance:Math.hypot(p.x-start.x,p.y-start.y),undo:undoStack.length};document.body.classList.remove('ps-ipad-work');return r;
    });
    assert.ok(touch.distance>8);assert.equal(touch.undo,1);
    const drawing=await page.evaluate(()=>{
      sel=null;multiSel=[];state.tool='free';renderTokens();
      const g=tokenLayer.querySelector('[data-id="depth-a"]'),b=g.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
      const fire=(type,dx,dy)=>g.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:62,pointerType:'mouse',buttons:1,clientX:x+dx,clientY:y+dy}));
      let moves=0;const orig=moveDraw;moveDraw=function(...a){moves++;return orig(...a);};
      fire('pointerdown',0,0);for(let i=1;i<=40;i++)fire('pointermove',i/2,i/3);const points=_draw.pts.length;fire('pointerup',20,40/3);moveDraw=orig;state.tool='move';return {moves,points};
    });
    assert.deepEqual(drawing,{moves:40,points:41});
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'drag-metrics.json'),JSON.stringify({engine,results},null,2));}
console.log(JSON.stringify({engine,cases:results.length,movesPerFrame:120,transformsPerFrame:1,passed:true}));
