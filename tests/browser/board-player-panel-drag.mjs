import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';

// Only synthetic players and a loopback backend. Real pointer hit testing proves
// the formerly covered ball can be selected after moving the existing card.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps3175-evidence';
fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={},results=[];
let step='open';
try{
 for(const width of [1280,768,375,393]){
  if(process.env.PS_PANEL_WIDTH&&!process.env.PS_PANEL_WIDTH.split(',').map(Number).includes(width))continue;
  const touch=width<=768;
  SIZES.panel={engine,ctx:{...(width<600?SIZES.phone.ctx:touch?SIZES.ipad.ctx:{}),viewport:{width,height:860},deviceScaleFactor:1,hasTouch:touch,isMobile:touch}};
  const {page,context,logs}=await openApp(fx,'panel',{browsers});page.setDefaultTimeout(15000);
  let f;
  const mark=s=>{step=s;console.log(JSON.stringify({engine,width,step}));};
  try{
   if(width<600){await page.locator('#teamBottom [data-tb="more"]').click();await page.locator('#teamMoreSheet [data-tb-app="board"]').click();}
   else await page.locator('#appSeg button[data-app="board"]:not([data-train])').click();
   f=await (await page.waitForSelector('#fBoard')).contentFrame();
   await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.__psPlayerPanelDrag);
   await f.evaluate(()=>{
    stopAnim();state.tool='move';state.players=[{id:'panel-feedback-player',team:'blue',name:'가상 시선 선수',num:7,x:400,y:330},{id:'panel-second-player',team:'red',name:'다른 선수',num:9,x:200,y:440}];
    state.equipment=[];state.drawings=[];state.ball={id:'ball',x:650,y:330};sel=null;multiSel=[];renderTokens();renderDrawings();updateDelUI();
    window.__qaPanelPointers=[];for(const type of ['pointerdown','pointerup','click'])document.querySelector('.ps-in-x').addEventListener(type,e=>window.__qaPanelPointers.push({type:'close-'+type,pointerType:e.pointerType,trusted:e.isTrusted,x:e.clientX,y:e.clientY}),true);document.querySelector('.ps-in-hd').addEventListener('gotpointercapture',e=>window.__qaPanelPointers.push({type:e.type,pointerType:e.pointerType,trusted:e.isTrusted}));
   });
   const ctl=f.locator('.sel-ctl'),hd=f.locator('.ps-in-hd'),player=f.locator('#tokenLayer [data-id="panel-feedback-player"]');
   const geometry=()=>f.evaluate(()=>{
    const p=document.querySelector('.sel-ctl'),r=p.getBoundingClientRect(),v=window.visualViewport;
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scroll:p.scrollTop,view:{left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight}};
   });
   const stable=async()=>{await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
   // WebKit's mobile input protocol consumes visual-viewport points while its
   // frame bounding boxes use layout coordinates (iPad width=1100, scaled down).
   const screenPoint=async(x,y,finger=false)=>{
    if(engine!=='webkit'||!touch||!finger)return {x,y};
    const v=await page.evaluate(()=>({x:visualViewport.offsetLeft,y:visualViewport.offsetTop,s:visualViewport.scale}));
    return {x:(x-v.x)*v.s,y:(y-v.y)*v.s};
   };
   const click=async(loc,{finger=false,button='left'}={})=>{
    // Locator actions retry if the pitch replaces a token while fitting the view.
    if(engine==='webkit'){await loc.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'nearest'}));await stable();}
    else if(finger)await loc.tap({trial:true});else await loc.click({trial:true,button});
    assert.equal(await loc.evaluate(el=>{const r=el.getBoundingClientRect(),hit=el.ownerDocument.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}),true,'the actual element center is reachable');
    if(engine==='chromium'){if(finger)await loc.tap();else await loc.click({button});return;}
    const b=await loc.boundingBox(),p=await screenPoint(b.x+b.width/2,b.y+b.height/2,finger);
    if(finger)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y,{button});
   };
   const close=async options=>{await click(f.locator('.ps-in-x'),options);await ctl.waitFor({state:'hidden'});};
   if(width<600){
    mark('phone-context-sheet');await click(player.locator('.tok-c'),{finger:true});await stable();
    const phone=await f.evaluate(()=>({dock:document.body.classList.contains('ps-dock'),active:window.__psInspector.active(),headerHeight:document.querySelector('.ps-in-hd').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,dragHeight:document.querySelector('.sel-ctl').style.getPropertyValue('--ps-insp-drag-height')}));
    assert.equal(phone.dock,true);assert.equal(phone.active,false);assert.ok(phone.headerHeight>30);assert.ok(phone.overflow<=1);assert.equal(phone.dragHeight,'');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await close({finger:true});await stable();assert.equal(await ctl.isVisible(),false,'phone sheet closes without clearing selection');
    results.push({width,phoneDockPreserved:true,noHorizontalOverflow:true});continue;
   }
   const same=(a,b,label)=>assert.ok(Math.abs(a.left-b.left)<2&&Math.abs(a.top-b.top)<2,label+JSON.stringify({a,b}));
   const inside=p=>assert.ok(p.left>=p.view.left+6&&p.top>=p.view.top+6&&p.right<=p.view.left+p.view.width-6+2&&p.bottom<=p.view.top+p.view.height-6+2,'entire card stays in viewport '+JSON.stringify(p));
   const open=async()=>{await click(player.locator('.tok-c'),touch&&engine==='chromium'?{finger:true}:{button:'right'});await f.waitForFunction(()=>window.__psInspector.active()&&document.body.classList.contains('ps-insp-on'));await stable();};
   const mouseDrag=async(dx,dy)=>{await hd.scrollIntoViewIfNeeded();const b=await hd.boundingBox();assert.ok(b?.height);const start=await screenPoint(b.x+55,b.y+18),end=await screenPoint(b.x+55+dx,b.y+18+dy);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();await stable();};
   let cdp=null;
   const nativeTouch=async(x,y,dx,dy)=>{
    cdp??=await context.newCDPSession(page);
    const at=(a,b)=>[{x:a,y:b,id:1,radiusX:4,radiusY:4}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:at(x,y)});
    for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:at(x+dx*i/12,y+dy*i/12)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await stable();
   };
   mark('open-and-original-cover');
   if(touch&&engine==='webkit'){await click(player.locator('.tok-c'),{finger:true});await f.waitForFunction(()=>window.__psInspector.active());await close({finger:true});assert.equal(await f.evaluate(()=>window.__psInspector.active()),false);}
   await open();const initial=await geometry();
   assert.ok(await ctl.evaluate(p=>p.offsetWidth>=247&&p.offsetWidth<=289),'menu keeps its readable width inside a scaled board');
   assert.equal(await ctl.evaluate(p=>p.style.getPropertyValue('--ps-insp-drag-height')),'','untouched default card height');
   await click(f.locator('.ps-sm-more summary'));await stable();
   await click(f.locator('#lookBtn'),{finger:touch&&engine==='chromium'});
   const ball=await f.evaluate(()=>{
    const r=document.querySelector('.sel-ctl').getBoundingClientRect(),p=document.getElementById('board').createSVGPoint();p.x=r.left+80;p.y=r.top+110;
    const q=p.matrixTransform(document.getElementById('world').getScreenCTM().inverse());state.ball.x=q.x;state.ball.y=q.y;renderTokens();
    return {x:p.x,y:p.y,covered:!!document.elementFromPoint(p.x,p.y)?.closest('.sel-ctl')};
   });assert.equal(ball.covered,true,'default fixed card reproduces the report');
   await ctl.evaluate(p=>p.querySelector('.ps-sm-body').scrollTop=0);
   const positions=await f.evaluate(()=>JSON.stringify({players:state.players.map(p=>[p.id,p.x,p.y]),ball:[state.ball.x,state.ball.y]}));
   mark(touch&&engine==='chromium'?'native-touch-drag':'mouse-drag');
   if(touch&&engine==='chromium'){const b=await hd.boundingBox();await nativeTouch(b.x+55,b.y+18,-initial.left+24,60);}else await mouseDrag(-initial.left+24,60);
   const moved=await geometry();inside(moved);assert.ok(moved.left<initial.left-100,'header moves the existing panel');
   assert.equal(await f.evaluate(()=>JSON.stringify({players:state.players.map(p=>[p.id,p.x,p.y]),ball:[state.ball.x,state.ball.y]})),positions,'moving the card changes no board coordinates');
   await f.evaluate(()=>{updateDelUI();positionSelCtl();renderTokens();});await stable();same(await geometry(),moved,'ordinary board repaint preserves moved position');
   assert.equal(await f.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.sel-ctl'),ball),false,'ball is no longer covered');
   await page.mouse.move(600,840);await page.screenshot({path:path.join(out,`player-panel-after-${engine}-${width}.png`),animations:'disabled'});
   const fb=await page.locator('#fBoard').boundingBox();
   const bp=await screenPoint(fb.x+ball.x,fb.y+ball.y,touch);
   if(touch)await page.touchscreen.tap(bp.x,bp.y);else await page.mouse.click(bp.x,bp.y);
   assert.equal(await f.evaluate(()=>state.players[0].lookAt),'ball','real click/tap finishes sight selection');
   assert.equal(await f.evaluate(()=>_lookPick),null);
   mark('inputs-scroll-and-reopen');
   await open();same(await geometry(),moved,'sight selection retains the movable card position on reopening');
   await f.locator('#nameInput').fill('이동 후 선수');await f.locator('#numInput').fill('11');
   assert.equal(await f.evaluate(()=>state.players[0].name),'이동 후 선수');assert.equal(await f.evaluate(()=>String(state.players[0].num)),'11');
   same(await geometry(),moved,'editing fields retains panel position');
   mark('input-selection');
   if(touch&&engine==='chromium'){await click(f.locator('#nameInput'),{finger:true});await f.locator('#nameInput').press('ArrowLeft');}
   else{const inputBox=await f.locator('#nameInput').boundingBox(),a=await screenPoint(inputBox.x+15,inputBox.y+12),b=await screenPoint(inputBox.x+75,inputBox.y+12);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();}
   await stable();same(await geometry(),moved,'using text input is not a panel drag');
   mark('content-scroll');
   if(!await f.locator('.ps-sm-more').evaluate(e=>e.open))await click(f.locator('.ps-sm-more summary'));
   await click(f.locator('#colorTrig'),{finger:touch&&engine==='chromium'});await stable();
   assert.ok(await ctl.evaluate(p=>{const body=p.querySelector('.ps-sm-body');return body.scrollHeight>body.clientHeight;}),'expanded color choices create a real scrollable card');
   const cb=await ctl.boundingBox();await ctl.evaluate(p=>p.scrollTop=0);
   if(touch&&engine==='chromium')await nativeTouch(cb.x+cb.width/2,cb.y+cb.height-80,0,-160);
   else if(touch){
    // Mobile WebKit has no wheel/drag API. Focusing a lower control exercises
    // native focus scrolling; Chromium above exercises the actual touch pan.
    await f.locator('.ps-sm-extras button:visible').last().focus();
   }
   else{const p=await screenPoint(cb.x+cb.width/2,cb.y+cb.height-50);await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,300);}
   await f.waitForFunction(()=>document.querySelector('.ps-sm-body').scrollTop>0);
   same(await geometry(),moved,'contents scroll without dragging card');
   mark('close-reopen');await ctl.evaluate(p=>p.scrollTop=0);await close({finger:touch&&engine==='chromium'});
   assert.equal(await f.evaluate(()=>window.__psInspector.active()),false,'close button keeps original action');
   await open();same(await geometry(),moved,'reopening remembers position for this session');
   await close({finger:touch&&engine==='chromium'});
   await click(f.locator('#tokenLayer [data-id="panel-second-player"] .tok-c'),{button:'right'});await stable();
   same(await geometry(),moved,'another player uses the same movable card');
   mark('keyboard-clamp-resize-transform');
   const keyPositions=await f.evaluate(()=>JSON.stringify(state.players.map(p=>[p.id,p.x,p.y])));
   await hd.focus();await page.keyboard.press('ArrowRight');let key=await geometry();assert.ok(Math.abs(key.left-moved.left-8)<2,'arrow keys move header by 8px');
   await page.keyboard.press('Shift+ArrowDown');key=await geometry();assert.ok(Math.abs(key.top-moved.top-32)<2,'Shift moves 32px');
   await page.keyboard.press('Home');await stable();inside(await geometry());assert.equal(await ctl.evaluate(p=>p.style.getPropertyValue('--ps-insp-drag-height')),'','Home restores automatic placement next to the current selection');
   assert.equal(await f.evaluate(()=>JSON.stringify(state.players.map(p=>[p.id,p.x,p.y]))),keyPositions,'header arrow keys never move selected players');
   await mouseDrag(-2000,-2000);inside(await geometry());
   await mouseDrag(2400,2400);inside(await geometry());
   await page.setViewportSize({width:Math.min(width,900),height:620});await stable();await f.waitForTimeout(100);inside(await geometry());
   const beforeTransform=await geometry();
   await ctl.evaluate(p=>{p.parentElement.dataset.qaTransform=p.parentElement.style.transform;p.parentElement.style.transform='translate(17px, 11px) scale(.9)';p.parentElement.style.transformOrigin='0 0';window.__psInspector.paint();});await stable();
   same(await geometry(),beforeTransform,'viewport position survives a transformed fixed containing block');inside(await geometry());
   await mouseDrag(-100,-30);inside(await geometry());
   await ctl.evaluate(p=>{p.parentElement.style.transform=p.parentElement.dataset.qaTransform||'';p.parentElement.style.transformOrigin='';window.__psInspector.paint();});await stable();inside(await geometry());
   const pointers=await f.evaluate(()=>window.__qaPanelPointers);
   assert.ok(pointers.some(p=>p.trusted&&p.pointerType===(touch&&engine==='chromium'?'touch':'mouse')),'native pointer capture was exercised '+JSON.stringify(pointers));
   assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
   const result={width,defaultPreserved:true,drag:touch&&engine==='chromium'?'native-touch':'mouse',sightSelection:true,inputs:true,scroll:touch?(engine==='chromium'?'native-touch':'keyboard-focus'):'wheel',keyboard:true,clamp:true,transform:true,initial,moved};
   results.push(result);fs.writeFileSync(path.join(out,`player-panel-${engine}-${width}.json`),JSON.stringify(result,null,2));
  }catch(e){
   const state=f&&await f.evaluate(()=>{const p=document.querySelector('.sel-ctl'),r=p?.getBoundingClientRect();return {classes:document.body.className,selection:typeof sel!=='undefined'&&sel&&{type:sel.type,id:sel.ref?.id},mouse:typeof _ptrMouse!=='undefined'&&_ptrMouse,panelOpen:typeof selPanelOpen!=='undefined'&&selPanelOpen,panel:r&&{left:r.left,top:r.top,width:r.width,height:r.height,scroll:p.scrollTop,style:p.getAttribute('style')},pointers:window.__qaPanelPointers};}).catch(()=>null);
   console.error('panel-failure',JSON.stringify({step,state}));
   fs.writeFileSync(path.join(out,`player-panel-${engine}-${width}-failure.json`),JSON.stringify({step,error:e.message,state,logs},null,2));
   await page.screenshot({path:path.join(out,`player-panel-${engine}-${width}-failure.png`)}).catch(()=>{});throw e;
  }finally{await context.close();}
 }
 fs.writeFileSync(path.join(out,`player-panel-${engine}.json`),JSON.stringify({engine,passed:true,results},null,2));console.log(JSON.stringify({engine,passed:true,results}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
