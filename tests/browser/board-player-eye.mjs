import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {startFixture,openApp,SIZES,pw,SHOTS,OUT} from '../fixtures/team-app.mjs';

// Synthetic account only. All non-loopback requests are blocked by the fixture.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={},results=[];
const modes=process.env.PS_EYE_SIZES?.split(',')||['desktop','ipad','phone'];
async function seed(f){
  await f.evaluate(()=>{
    const snap=captureSnap();snap.pitchSpec='fifa';snap.orientation='h';
    snap.players=[
      {id:'eye6',num:6,name:'중앙 미드필더',pos:'DM',team:'blue',x:440,y:370,dir:0},
      {id:'eye8',num:8,name:'중앙 지원',pos:'CM',team:'blue',x:550,y:310,dir:20},
      {id:'eye9',num:9,name:'전방 공격수',pos:'CF',team:'blue',x:680,y:405,dir:165},
      {id:'eye7',num:7,name:'측면 지원',pos:'RW',team:'blue',x:580,y:530,dir:-20},
      {id:'eye4',num:4,name:'수비수',pos:'CB',team:'red',x:630,y:360,dir:180},
      {id:'eye5',num:5,name:'수비수',pos:'CB',team:'red',x:715,y:450,dir:180},
      {id:'eye1',num:1,name:'골키퍼',pos:'GK',team:'red',x:1010,y:370,dir:180}
    ];
    snap.ball={x:475,y:380};snap.equipment=[{id:'eyeCone',team:'cone',x:570,y:430}];
    snap.drawings=[{type:'pass',pts:[{x:475,y:380},{x:680,y:405}],color:'#e1bc63',lw:1}];
    snap.teamColors={blue:'#25568b',red:'#bc6458'};snap.gkColors={red:'#b99c43'};
    const next=JSON.parse(JSON.stringify(snap));next.players[0].x=500;next.players[1].x=600;next.players[1].y=330;next.ball={x:660,y:405};
    const last=JSON.parse(JSON.stringify(next));last.players=last.players.filter(p=>p.id!=='eye6');
    __animLoad([{snap,dur:2,moveSpeed:1,cap:'중앙에서 전방 살피기',curves:{eye8:{mx:10,my:-10}}},{snap:next,dur:1,moveSpeed:.5,cap:'전진 패스와 지원'},{snap:last,cap:'선수 변경'}]);
    // An unsaved edit must remain untouched, including the saved scene it differs from.
    state.players[0].x=450;sel={type:'player',ref:state.players[0]};renderTokens();updateDelUI();
  });
  await f.waitForFunction(()=>!window.__animExport&&!_boardDraftT);
}
async function original(f){return f.evaluate(()=>JSON.stringify({snap:captureSnap(),frames:anim.frames,active:animActive,selection:sel&&sel.ref.id}));}
async function controlsClear(f,touch){
  const boxes=await f.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
    return {w:innerWidth,h:innerHeight,canvas:rect('peCanvas'),buttons:['peLeft','peFront','peRight'].map(rect)};
  });
  assert.ok(boxes.canvas.h>60,JSON.stringify(boxes));
  for(const b of boxes.buttons){
    assert.ok(b.y>=boxes.canvas.bottom-1,'look controls never cover the pitch '+JSON.stringify(boxes));
    assert.ok(b.x>=0&&b.right<=boxes.w+1&&b.bottom<=boxes.h+1,JSON.stringify(boxes));
    if(touch)assert.ok(b.h>=44&&b.w>=44,'touch targets remain at least 44px '+JSON.stringify(b));
  }
}
async function touchChecks(page,context,f,size){
  const stable=()=>f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  async function tapPoint(x,y){
    if(engine==='webkit'){
      const v=await page.evaluate(()=>({x:visualViewport.offsetLeft,y:visualViewport.offsetTop,s:visualViewport.scale}));
      x=(x-v.x)*v.s;y=(y-v.y)*v.s;
    }
    await page.touchscreen.tap(x,y);await stable();
  }
  async function tap(id){const r=await f.locator('#'+id).boundingBox();await tapPoint(r.x+r.width/2,r.y+r.height/2);}
  await tap('peFront');await tap('peRight');
  assert.equal(await f.locator('#psEyeDialog').getAttribute('data-head'),'30','native touch activates look controls');
  await tap('peCompare');
  const target=await f.evaluate(()=>{
    const c=document.getElementById('peMap'),w=c.clientWidth,h=c.clientHeight,pad=w>260?22:13,p=state.players.find(p=>p.id==='eye1'),pr=PR(),unit=mppNow(),s=Math.min((w-2*pad)/(pr.PW/unit),(h-2*pad)/(pr.PH/unit));
    return {x:w/2+(p.x-pr.CX)/unit*s,y:h/2+(p.y-pr.CY)/unit*s};
  });
  const map=await f.locator('#peMap').boundingBox();await tapPoint(map.x+target.x,map.y+target.y);
  assert.equal(await f.locator('#psEyeDialog').getAttribute('data-player'),'eye1','native map tap changes the viewing player');
  await f.locator('#pePlayer').selectOption('eye6');await tap('peEyeOnly');
  if(engine==='chromium'){
    const cdp=await context.newCDPSession(page),r=await f.locator('#peCanvas').boundingBox(),x=r.x+r.width*.35,y=r.y+r.height*.4;
    await f.evaluate(()=>{window.__eyeTouches=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.getElementById('peCanvas').addEventListener(name,e=>__eyeTouches.push({event:e.type,id:e.pointerId,primary:e.isPrimary,x:e.clientX,type:e.pointerType,trusted:e.isTrusted}));});
    const point=(id,dx=0,dy=0)=>({id,x:x+dx,y:y+dy,radiusX:4,radiusY:4});
    const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    await send('touchStart',[point(1)]);
    await send('touchStart',[point(1),point(2,45,15)]);
    await send('touchMove',[point(1),point(2,65,15)]);await stable();
    assert.equal(await f.locator('#psEyeDialog').getAttribute('data-head'),'0','second finger does not take over the camera');
    await send('touchEnd',[point(2,65,15)]);
    await send('touchMove',[point(1,80)]);await stable();
    assert.equal(await f.locator('#psEyeDialog').getAttribute('data-head'),'-20','first finger retains drag ownership '+JSON.stringify(await f.evaluate(()=>__eyeTouches)));
    assert.equal(await f.locator('#psEyeDialog').getAttribute('data-body'),'0');
    await send('touchCancel',[]);await tap('peFront');
    await send('touchStart',[point(3)]);await send('touchMove',[point(3,40)]);await send('touchEnd',[]);await stable();
    assert.equal(await f.locator('#psEyeDialog').getAttribute('data-head'),'-10','a new drag works after touch cancellation');
    assert.ok((await f.evaluate(()=>__eyeTouches)).every(e=>e.type==='touch'&&e.trusted),'browser-generated touch events, not synthetic dispatchEvent');
    await cdp.detach();await tap('peFront');
  }
  await page.setViewportSize(size==='ipad'?{width:820,height:1100}:{width:812,height:375});await page.waitForTimeout(250);await stable();await controlsClear(f,true);
  await page.screenshot({path:path.join(SHOTS,'player-eye-rotated-'+size+'-'+engine+'.png')});
  await page.setViewportSize(SIZES[size].ctx.viewport);await page.waitForTimeout(250);await stable();await controlsClear(f,true);
}
try{
  browsers[engine]=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath(),args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}:{})});
  for(const size of modes){
    SIZES[size].engine=engine;
    const {page,context,logs}=await openApp(fx,size,{browsers,dark:size==='ipad'});
    try{
      console.log('player-eye',engine,size,'board');
      await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
      const f=await (await page.waitForSelector('#fBoard')).contentFrame();
      await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&window.PSPlayerEye);
      await seed(f);
      assert.equal(await f.evaluate(()=>!!window.THREE),false,'ordinary board does not load the 3D engine');
      const before=await original(f);
      async function enter(){
        // Phone token/settings editors are unavailable. Keep testing the read-only POV API independently.
        if(size==='phone'){await f.evaluate(()=>PSPlayerEye.open());return;}
        const bar=f.locator('#boardPageStrip [data-player-eye-entry]');
        if(await bar.isVisible()){await bar.click();return;}
        const selected=f.locator('#psEyeSelected');
        if(await selected.count()){
          if(!await f.locator('.sel-ctl').isVisible())await f.locator('#tokenLayer [data-id="eye6"]').click({button:'right'});
          if(!await f.locator('.ps-sm-more').evaluate(e=>e.open))await f.locator('.ps-sm-more summary').click();
          if(await selected.isVisible()){await selected.click();return;}
        }
        await f.evaluate(()=>{__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('view');});
        await f.locator('[data-player-eye-entry]').filter({visible:true}).first().click();
      }
      // Use the same top-bar entry people use. Narrow layouts also expose the setting entry.
      await enter();
      await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.ready);
      const status=await f.locator('#psEyeDialog').getAttribute('data-ready');
      if(status==='error'&&engine==='webkit'){
        assert.match(await f.locator('.pe-message').innerText(),/3D 화면/);
        await f.locator('#peClose').click();assert.equal(await original(f),before);
        results.push({size,engine,fallback:'WebGL unavailable'});continue;
      }
      assert.equal(status,'true',await f.locator('.pe-message').innerText());
      assert.equal(await f.locator('#pePlayer').inputValue(),'eye6');
      await f.locator('#peRight').click();
      assert.equal(await f.locator('#psEyeDialog').getAttribute('data-head'),'30');
      assert.equal(await f.locator('#psEyeDialog').getAttribute('data-body'),'0');
      await f.locator('#peFront').click();
      assert.equal(await f.locator('#psEyeDialog').getAttribute('data-head'),'0');
      await f.locator('#peCompare').click();
      await page.waitForTimeout(450);
      const bounds=await f.evaluate(()=>{
        const d=document.getElementById('psEyeDialog');return {w:innerWidth,h:innerHeight,overflow:d.scrollWidth-d.clientWidth,parts:['peClose','pePlayer','peCompare','pePlay','peCanvas','peMap'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};})};
      });
      assert.ok(bounds.overflow<=1,JSON.stringify(bounds));
      assert.ok(bounds.parts.every(r=>r.x>=-1&&r.y>=-1&&r.right<=bounds.w+1&&r.bottom<=bounds.h+1&&r.w>0&&r.h>0),JSON.stringify(bounds));
      await page.screenshot({path:path.join(SHOTS,'player-eye-compare-'+size+'-'+engine+'.png')});
      await f.locator('#peEyeOnly').click();await page.waitForTimeout(350);
      await page.screenshot({path:path.join(SHOTS,'player-eye-'+size+'-'+engine+'.png')});
      await controlsClear(f,size!=='desktop');
      if(size!=='desktop'){await touchChecks(page,context,f,size);assert.equal(await original(f),before,'touch and rotation leave board data unchanged');}
      if(size==='desktop'){
        // Actual keyboard events must never reach board deletion / page / scene shortcuts.
        await f.locator('#peFront').focus();
        for(const key of ['Delete','Backspace','KeyN','Shift+KeyN','Control+KeyZ','Meta+KeyZ','ArrowRight']){
          await page.keyboard.press(key);
          await f.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
          assert.equal(await original(f),before,key+' leaves the app and board intact');
        }
        assert.equal(await original(f),before,'modal shortcuts leave board data and scenes unchanged');
        await f.locator('#peTrack').click();assert.equal(await f.locator('#peTrack').getAttribute('aria-pressed'),'true');
        const box=await f.locator('#peCanvas').boundingBox();
        await page.mouse.move(box.x+box.width*.5,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.65,{steps:5});await page.mouse.up();
        // Drag rendering is coalesced to RAF; wait for the visible control state,
        // rather than assuming the final native mouse event also painted a frame.
        await f.waitForFunction(()=>document.getElementById('peTrack').getAttribute('aria-pressed')==='false');
        assert.equal(await f.locator('#peTrack').getAttribute('aria-pressed'),'false','dragging takes over from ball tracking');
        await f.locator('#peFront').click();
        await f.locator('#pePlayer').selectOption('eye8');assert.equal(await f.locator('#psEyeDialog').getAttribute('data-player'),'eye8');
        await f.locator('#peScene').selectOption('1');assert.equal(await f.locator('#psEyeDialog').getAttribute('data-scene'),'1');
        await f.locator('#peScene').selectOption('0');await f.locator('#pePlay').click();await page.waitForTimeout(450);await f.locator('#pePlay').click();
        assert.ok(Number(await f.locator('#psEyeDialog').getAttribute('data-time'))>0);
        await f.locator('#peScene').selectOption('0');await f.locator('#pePlayer').selectOption('eye6');await f.locator('#peScene').selectOption('2');
        assert.match(await f.locator('.pe-message').innerText(),/선택한 선수가 없/);
        await f.locator('#pePlayer').selectOption('eye8');assert.equal(await f.locator('.pe-message').isVisible(),false);
        await f.locator('.pe-settings summary').click();await f.locator('#peHeight').fill('1.4');await f.locator('#peFov').fill('70');
        assert.equal(await f.locator('#peHeightValue').innerText(),'1.40m');await f.locator('.pe-settings summary').click();
      }
      // Quality and stadium are viewer-local; their controls remain reachable on touch layouts.
      await f.locator('.pe-settings summary').click();
      await f.locator('#peQuality').selectOption('light');
      assert.equal(await f.locator('#psEyeDialog').getAttribute('data-quality'),'light');
      assert.equal(await f.locator('#peQualityValue').innerText(),'경량');
      const lightPixels=await f.evaluate(()=>{const c=document.getElementById('peCanvas');return c.width*c.height;});
      assert.ok(lightPixels<=600000,'drawing resolution obeys the light budget');
      await f.locator('#peStadium').uncheck();assert.equal(await f.locator('#psEyeDialog').getAttribute('data-stadium'),'false');
      await f.locator('#peStadium').check();
      await f.locator('#peQuality').selectOption('full');assert.equal(await f.locator('#psEyeDialog').getAttribute('data-quality'),'full');
      await f.locator('#peQuality').selectOption('auto');assert.equal(await f.locator('#psEyeDialog').getAttribute('data-quality-mode'),'auto');
      await f.locator('.pe-settings summary').click();
      await f.locator('#peClose').click();assert.equal(await original(f),before,'viewer close restores the identical untouched board');
      // Resource lifecycle and keyboard escape; repeated opening must not leave overlays behind.
      for(let i=0;i<2;i++){await enter();await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.ready==='true');await page.keyboard.press('Escape');assert.equal(await f.locator('#psEyeDialog').count(),0);}
      assert.equal(await original(f),before);
      if(size==='desktop'){
        // Deterministic pressure verifies the playback-to-policy wiring without claiming device FPS.
        await f.evaluate(()=>{window.__eyeQualityCreate=PSPlayerEyeQuality.create;window.__eyeQualitySamples=0;PSPlayerEyeQuality.create=function(){const q=__eyeQualityCreate(),observe=q.observe;q.observe=function(){__eyeQualitySamples++;return observe(35,80);};return q;};});
        await enter();await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.ready==='true');
        await f.locator('#pePlayer').selectOption('eye8');await f.locator('#peSpeed').selectOption('.5');await f.locator('#pePlay').click();
        await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.quality==='light');
        assert.ok(await f.evaluate(()=>__eyeQualitySamples>=24),'only sustained playback triggers automatic simplification');
        assert.equal(await f.locator('#psEyeDialog').getAttribute('data-quality-mode'),'auto');
        assert.equal(await f.locator('#psEyeDialog').getAttribute('data-player'),'eye8');
        await f.locator('#peClose').click();await f.evaluate(()=>{PSPlayerEyeQuality.create=__eyeQualityCreate;delete window.__eyeQualityCreate;});
        assert.equal(await original(f),before,'automatic simplification leaves all original data unchanged');
        await f.evaluate(()=>{window.__eyeTestPitchN=state.pitchN;state.pitchN=2;});
        await enter();assert.equal(await f.locator('#psEyeDialog').count(),0,'multiple pitch scales are not shown as a false one-pitch view');
        await f.evaluate(()=>{state.pitchN=window.__eyeTestPitchN;delete window.__eyeTestPitchN;});
        await enter();await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.ready==='true');
        await f.evaluate(()=>document.getElementById('peCanvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
        assert.equal(await f.locator('#psEyeDialog').getAttribute('data-ready'),'error');
        assert.equal(await f.locator('#pePlay').isDisabled(),true);
        await f.locator('#peClose').click();assert.equal(await original(f),before,'GPU loss has a safe exit');
        await f.evaluate(()=>{window.__eyeTestRenderer=THREE.WebGLRenderer;THREE.WebGLRenderer=function(){throw new Error('Synthetic unavailable GPU');};});
        await enter();await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.ready==='error');
        await f.locator('#peClose').click();
        await f.evaluate(()=>{THREE.WebGLRenderer=window.__eyeTestRenderer;delete window.__eyeTestRenderer;});
        assert.equal(await original(f),before,'unsupported hardware leaves the board available');
        await enter();await f.waitForFunction(()=>document.getElementById('psEyeDialog')?.dataset.ready==='true');
        await page.evaluate(()=>document.getElementById('fBoard').contentWindow.postMessage({source:'process-studio',type:'ps-auth-state',unlocked:false},location.origin));
        await f.waitForFunction(()=>!document.getElementById('psEyeDialog'));
        assert.equal(await original(f),before,'authentication lock closes the copied viewer');
      }
      const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[],JSON.stringify(errors));
      results.push({size,engine,bounds,errors});
    }finally{await context.close();}
  }
  fs.writeFileSync(path.join(OUT,'player-eye-results.json'),JSON.stringify(results,null,2));
  console.log('board-player-eye ok',JSON.stringify(results.map(({size,engine,fallback})=>({size,engine,fallback}))));
}finally{for(const browser of Object.values(browsers))await browser.close();await fx.close();}
