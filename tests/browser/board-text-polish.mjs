import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
const shots=process.env.PS_SHOT_DIR;
if(shots)fs.mkdirSync(shots,{recursive:true});
let step='boot';
try {
 for(const width of (process.env.PS_WIDTHS||'768,1280').split(',').map(Number)) {
  const size=width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:width<700?852:900};
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  let f=await (await page.waitForSelector('#fBoard')).contentFrame();
  const ready=()=>f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSBoardText);
  await ready();
  await f.evaluate(()=>{
   __setTilt(false);boardShowDefault();state.tool='move';state.boardLocked=false;state.orientation='h';
   state.players=[{id:'polish-a',team:'blue',num:8,name:'가상 선수',x:450,y:340}];state.equipment=[];state.ball=null;
   state.drawings=[{type:'text',text:'압박',size:30,color:'#ffffff',bg:'#12161e',w:240,pts:[{x:450,y:340}],locked:true},
    {type:'rect',color:'#ffffff',pts:[{x:50,y:50},{x:100,y:100}]}];
   anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();
  });
  await page.waitForTimeout(300);
  step=width+' front/back';
  const layer=await f.evaluate(()=>{
   const d=state.drawings[0];zOrderItems([d],true);renderTokens();
   const g=PSBoardText.node(d),m=world.getScreenCTM(),p=svg.createSVGPoint();p.x=450;p.y=340;const q=p.matrixTransform(m);
   return {front:!!d.front,above:!!(tokenLayer.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING),hit:g.contains(document.elementFromPoint(q.x,q.y)),bg:+g.querySelector('.ps-text-bg').getAttribute('width'),box:_textBox(d).boxW,slots:drawLayer.children.length};
  });
  assert.equal(layer.front,true);assert.equal(layer.above,true);assert.equal(layer.hit,true);assert.ok(layer.bg<layer.box/2);assert.equal(layer.slots,2);
  await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text');zOrderItems([d],false);});
  assert.equal(await f.evaluate(()=>!!state.drawings.find(d=>d.type==='text').front),false);
  await f.evaluate(()=>undoLast());
  assert.equal(await f.evaluate(()=>!!state.drawings.find(d=>d.type==='text').front),true);
  step=width+' locked double tap';await page.waitForTimeout(300);
  const pos=await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text'),m=world.getScreenCTM(),p=svg.createSVGPoint();p.x=d.pts[0].x;p.y=d.pts[0].y;const q=p.matrixTransform(m);return {x:q.x,y:q.y};});
  const frameBox=await page.locator('#fBoard').boundingBox();
  // iPad intentionally uses a 1100 CSS-pixel viewport. WebKit touch input uses visual pixels.
  const inputScale=engine==='webkit'&&width<1000?await page.evaluate(()=>visualViewport.scale):1;
  const tap={x:(frameBox.x+pos.x)*inputScale,y:(frameBox.y+pos.y)*inputScale};
  if(width<1000){await page.touchscreen.tap(tap.x,tap.y);await page.touchscreen.tap(tap.x,tap.y);}
  else await page.mouse.dblclick(frameBox.x+pos.x,frameBox.y+pos.y,{delay:80});
  await f.locator('.ps-text-inline-editor').waitFor({timeout:5000});
  const edit=await f.evaluate(()=>{const ed=document.querySelector('.ps-text-inline-editor'),r=ed.getBoundingClientRect(),d=state.drawings.find(d=>d.type==='text'),b=_textBox(d),m=world.getScreenCTM();return {w:r.width,h:r.height,expected:b.boxW*Math.hypot(m.a,m.b),left:r.left,right:r.right,view:innerWidth,hidden:PSBoardText.node(d).style.visibility};});
  assert.ok(edit.w<=Math.min(edit.expected+6,edit.view-8),'existing width: '+JSON.stringify(edit));
  assert.ok(edit.h<110,'no five-row enlargement: '+JSON.stringify(edit));assert.ok(edit.left>=0&&edit.right<=edit.view+1);assert.equal(edit.hidden,'hidden');
  await f.locator('.ps-text-inline-editor').fill('압박 유지');
  await f.getByLabel('텍스트 배경 불투명도',{exact:true}).evaluate(el=>{el.value='0.35';el.dispatchEvent(new Event('input',{bubbles:true}));});
  if(shots)await page.screenshot({path:shots+'/'+engine+'-'+width+'-editor.png'});
  await f.getByRole('button',{name:'완료',exact:true}).click();
  const saved=await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text'),g=PSBoardText.node(d);return {text:d.text,op:d.bgOp,locked:d.locked,front:d.front,alpha:g.querySelector('.ps-text-bg').getAttribute('fill-opacity'),visible:g.style.visibility,ink:g.querySelector('text').getAttribute('fill')};});
  assert.deepEqual(saved,{text:'압박 유지',op:.35,locked:true,front:true,alpha:'0.35',visible:'',ink:'#ffffff'});
  step=width+' cancel/undo/snapshot/export';
  await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text');addText(d.pts[0],d);});
  await f.locator('.ps-text-inline-editor').fill('취소할 내용');
  await f.getByLabel('텍스트 배경 불투명도',{exact:true}).evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await f.getByRole('button',{name:'취소',exact:true}).click();
  assert.deepEqual(await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text');return [d.text,d.bgOp];}),['압박 유지',.35]);
  await f.evaluate(()=>undoLast());
  assert.equal(await f.evaluate(()=>state.drawings.find(d=>d.type==='text').text),'압박');
  const ex=await f.evaluate(()=>{
   const d=state.drawings.find(d=>d.type==='text');d.text='압박 유지';d.bgOp=.35;d.front=true;
   const snap=JSON.parse(JSON.stringify(captureSnap()));loadSnap(snap);renderDrawings();
   const xml=boardImageXML().xml,thumb=boardThumbSVG();
   return {persist:state.drawings.find(d=>d.type==='text').bgOp,xml,thumb};
  });
  assert.equal(ex.persist,.35);assert.match(ex.xml,/fill-opacity="0.35"/);assert.match(ex.thumb,/압박 유지/);
  assert.ok(ex.xml.indexOf('id="textFrontLayer"')>ex.xml.indexOf('id="tokenLayer"'));
  if(width===1280){
   step='foreground group drag';
   const drag=await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text');d.locked=false;sel=null;multiSel=state.drawings.slice();renderDrawings();const p=svg.createSVGPoint();p.x=d.pts[0].x;p.y=d.pts[0].y;const q=p.matrixTransform(world.getScreenCTM());return {x:q.x,y:q.y,before:state.drawings.map(d=>d.pts[0].x)};});
   const fb=await page.locator('#fBoard').boundingBox();await page.mouse.move(fb.x+drag.x,fb.y+drag.y);await page.mouse.down();await page.mouse.move(fb.x+drag.x+30,fb.y+drag.y+15,{steps:6});await page.mouse.up();
   const moved=await f.evaluate(()=>state.drawings.map(d=>d.pts[0].x));assert.ok(moved.every((x,i)=>x>drag.before[i]+1),'foreground and companion move together');
   await f.evaluate(()=>{undoLast();const d=state.drawings.find(d=>d.type==='text');d.locked=true;sel=null;multiSel=[];renderDrawings();});
  }
  step=width+' depth emphasis';
  const hl=await f.evaluate(()=>{
   state.players[0].x=700;ensureAnimMode(true);document.getElementById('animAdd').click();anim.frames[animActive].hl=['polish-a'];
   __setTilt(true);renderTokens();_applyHl(['polish-a']);
   const g=tokenLayer.querySelector('[data-id="polish-a"]'),k=+g.getAttribute('data-depth-chip')||1;
   const out={k,r:+g.querySelector('.tok-hl-ring').getAttribute('r'),stroke:+g.querySelector('.tok-hl-ring').getAttribute('stroke-width')};
   window.__animExport3d=true;try{out.xml=boardImageXML().xml;}finally{window.__animExport3d=false;}
   return out;
  });
  assert.equal(hl.r,31*hl.k);assert.equal(hl.stroke,4*hl.k);assert.match(hl.xml,/tok-hl-ring/);
  if(shots)await page.screenshot({path:shots+'/'+engine+'-'+width+'-depth.png'});
  const flat=await f.evaluate(()=>{__setTilt(false);renderTokens();_applyHl(['polish-a']);const r=tokenLayer.querySelector('.tok-hl-ring');return [+r.getAttribute('r'),+r.getAttribute('stroke-width')];});
  assert.deepEqual(flat,[27,2.6]);
  if(width===1280){
   step='save and reload';
   assert.equal(await f.evaluate(()=>window.__boardSaveExplicit({quiet:true,noLink:true})),true);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])'));
   await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
   f=await (await page.waitForSelector('#fBoard')).contentFrame();await ready();
   const restored=await f.evaluate(()=>{const d=state.drawings.find(d=>d.type==='text');return d&&{text:d.text,op:d.bgOp,front:d.front,locked:d.locked,above:PSBoardText.node(d).parentNode.id};});
   assert.deepEqual(restored,{text:'압박 유지',op:.35,front:true,locked:true,above:'textFrontLayer'});
  }
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
  await page.context().close();
  console.log('board-text-polish ok',engine,width);
 }
} catch(e) {console.error('Failed:',step);throw e;} finally {for(const b of Object.values(browsers))await b.close();await fx.close();}
