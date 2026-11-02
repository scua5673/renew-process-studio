import assert from 'node:assert/strict';
import fs from 'node:fs';
const output=process.env.PS_TEST_OUTPUT||'test-results/board-training-edit';fs.mkdirSync(output,{recursive:true});
import {fileURLToPath} from 'node:url';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,tilt3d:false});
  async function board(){
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSBoardEdit);
    await page.waitForFunction(()=>document.body&&!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
    return f;
  }
  let f=await board();
  await f.addScriptTag({path:fileURLToPath(new URL('../fixtures/board-training-checks.js',import.meta.url))});
  const results=await f.evaluate(()=>PSBoardEditChecks.run());
  console.log(JSON.stringify(results));assert.deepEqual(results.filter(r=>!r.pass),[]);
  // Real mouse input goes through screen -> pitch conversion and pointer capture.
  async function at(x,y){return f.evaluate(({x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(world.getScreenCTM()),r=frameElement.getBoundingClientRect();return {x:r.left+q.x*r.width/innerWidth,y:r.top+q.y*r.height/innerHeight};},{x,y});}
  async function drag(from,to,mod){const a=await at(...from),b=await at(...to);if(mod)await page.keyboard.down(mod);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();if(mod)await page.keyboard.up(mod);}
  await f.evaluate(()=>{PSBoardEditChecks.seed();sel=null;multiSel=[];state.drawings=[];state.players=state.players.slice(0,1);state.equipment=[];state.players[0].x=400;state.players[0].y=300;window.__editGrid=5;localStorage.setItem('cs_drag_snap_v1','1');renderTokens();renderDrawings();updateDelUI();});
  await f.locator('#psEditToolsToggle').click();await f.locator('[data-free]').click();
  assert.equal(await f.locator('[data-free]').getAttribute('aria-pressed'),'true');
  await f.getByRole('button',{name:'배치 도구 닫기',exact:true}).click();
  await drag([400,300],[463,342]);
  const freeMove=await f.evaluate(()=>({x:state.players[0].x,y:state.players[0].y,snap:_dragSnapOn()}));
  // WebKit quantizes the scaled iframe's mouse coordinates. A snapped point
  // is over 17 pitch units away; allow only two units for physical pixel rounding.
  assert.equal(freeMove.snap,true);assert.ok(Math.hypot(freeMove.x-463,freeMove.y-342)<2,JSON.stringify(freeMove));
  await f.waitForFunction(()=>document.querySelector('[data-free]').getAttribute('aria-pressed')==='false');
  await f.evaluate(()=>undoLast());
  await drag([400,300],[463,342],'Alt');
  assert.equal(await f.evaluate(()=>state.players.length),2,'Alt drag still duplicates');
  assert.equal(await f.evaluate(()=>state.players.some(p=>p.x===400&&p.y===300)),true);
  await f.evaluate(()=>{undoLast();sel=null;multiSel=[];state.players=[];state.equipment=[];state.drawings=[];state.tool='line';document.body.dataset.tool='line';document.body.classList.add('drawmode');renderTokens();renderDrawings();updateDelUI();});
  // Native event modifiers must survive capture listeners even when permanent snapping is off.
  await f.evaluate(()=>localStorage.setItem('cs_drag_snap_v1','0'));
  await drag([303,263],[613,423],'Control');
  assert.equal(await f.evaluate(()=>{const q=PR(),step=M2U(5),d=state.drawings[0];return !!d&&d.pts.every(p=>Math.abs((p.x-q.L)/step-Math.round((p.x-q.L)/step))<.001&&Math.abs((p.y-q.T)/step-Math.round((p.y-q.T)/step))<.001);}),true,'Ctrl snaps new line points with the permanent setting off');
  await f.evaluate(()=>{undoLast();localStorage.setItem('cs_drag_snap_v1','1');});
  await drag([303,263],[613,423]);
  assert.equal(await f.evaluate(()=>state.drawings.length),1,'line created by real pointer');
  assert.equal(await f.evaluate(()=>{const q=PR(),step=M2U(5);return state.drawings[0].pts.every(p=>Math.abs((p.x-q.L)/step-Math.round((p.x-q.L)/step))<.001&&Math.abs((p.y-q.T)/step-Math.round((p.y-q.T)/step))<.001);}),true);
  const savedLine=await f.evaluate(()=>JSON.parse(JSON.stringify(state.drawings[0])));
  await f.evaluate(()=>{_activateMoveTool();selectItem('drawing',state.drawings[0]);});
  await drag([savedLine.pts[1].x,savedLine.pts[1].y],[673,473]);
  assert.equal(await f.evaluate(()=>{const q=PR(),p=state.drawings[0].pts[1],step=M2U(5);return Math.abs((p.x-q.L)/step-Math.round((p.x-q.L)/step))<.001;}),true);
  await f.evaluate(()=>undoLast());
  assert.deepEqual(await f.evaluate(()=>state.drawings[0].pts),savedLine.pts);
  await f.evaluate(()=>{state.tool='poly';document.body.dataset.tool='poly';document.body.classList.add('drawmode');sel=null;multiSel=[];updateDelUI();});
  for(const p of [[303,263],[613,273],[543,483]]){const q=await at(...p);await page.mouse.click(q.x,q.y);}
  await page.keyboard.press('Enter');
  assert.equal(await f.evaluate(()=>state.drawings.at(-1).type),'poly');
  assert.equal(await f.evaluate(()=>{const q=PR(),step=M2U(5);return state.drawings.at(-1).pts.every(p=>Math.abs((p.x-q.L)/step-Math.round((p.x-q.L)/step))<.001);}),true);
  assert.equal(await f.evaluate(()=>{const xml=boardImageXML().xml;return !xml.includes('psEditGrid')&&!xml.includes('snapGuide');}),true);

  const polyBefore=await f.evaluate(()=>JSON.parse(JSON.stringify(state.drawings.at(-1).pts)));
  await f.evaluate(()=>{_activateMoveTool();selectItem('drawing',state.drawings.at(-1));});
  await drag([polyBefore[1].x,polyBefore[1].y],[683,323]);
  assert.equal(await f.evaluate(()=>{const p=state.drawings.at(-1).pts[1],q=PR(),step=M2U(5);return Math.abs((p.x-q.L)/step-Math.round((p.x-q.L)/step))<.001&&Math.abs((p.y-q.T)/step-Math.round((p.y-q.T)/step))<.001;}),true);
  const polyAfter=await f.evaluate(()=>state.drawings.at(-1).pts);assert.notDeepEqual(polyAfter[1],polyBefore[1]);assert.deepEqual(polyAfter[0],polyBefore[0]);assert.deepEqual(polyAfter[2],polyBefore[2]);
  await f.evaluate(()=>undoLast());assert.deepEqual(await f.evaluate(()=>state.drawings.at(-1).pts),polyBefore,'polygon vertex edit is one undo');
  const snappedDrawings=await f.evaluate(()=>JSON.parse(JSON.stringify(state.drawings)));
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
  await page.reload({waitUntil:'domcontentloaded'});f=await board();
  assert.deepEqual(await f.evaluate(()=>state.drawings),snappedDrawings,'snapped line and polygon survive save/reopen');
  assert.equal(await f.locator('[data-free]').getAttribute('aria-pressed'),'false');
  await f.addScriptTag({path:fileURLToPath(new URL('../fixtures/board-training-checks.js',import.meta.url))});
  await f.evaluate(()=>{window.__snapInputs=[];window.__testBegin=beginDraw;window.__testMove=moveDraw;beginDraw=function(u){__snapInputs[0]={...u};return __testBegin(u);};moveDraw=function(u){__snapInputs[1]={...u};return __testMove(u);};});
  for(const orientation of ['h','v'])for(const flip of [false,true])for(const tilt of [false,true]){
    await f.evaluate(({orientation,flip,tilt})=>{__snapInputs=[];state.drawings=[];state.players=[];state.ball=null;state.orientation=orientation;state.spFlip=flip;__setTilt(tilt);applyView();state.tool='line';document.body.dataset.tool='line';document.body.classList.add('drawmode');renderTokens();renderDrawings();updateDelUI();},{orientation,flip,tilt});
    await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const coords=await f.evaluate(()=>{const r=svg.getBoundingClientRect(),host=frameElement.getBoundingClientRect(),g=PR(),step=M2U(5);return [.4,.6].map((v,i)=>{const x=r.left+r.width*v,y=r.top+r.height*(i?.6:.4),u=clientToUnit(x,y);return {screen:{x:host.left+x*host.width/innerWidth,y:host.top+y*host.height/innerHeight},pitch:{x:g.L+Math.round((u.x-g.L)/step)*step,y:g.T+Math.round((u.y-g.T)/step)*step}};});});
    await f.locator('#toolSeg [data-tool="line"]').evaluate(n=>n.click());
    await page.waitForFunction(p=>document.elementFromPoint(p.x,p.y)?.id==='fBoard',coords[0].screen);
    await page.mouse.move(coords[0].screen.x,coords[0].screen.y);await page.mouse.down();await page.mouse.move(coords[1].screen.x,coords[1].screen.y,{steps:4});await page.mouse.up();
    const pts=await f.evaluate(()=>state.drawings.at(-1)?.pts);
    if(!pts){await page.screenshot({path:output+'/projection-failure.png'});console.log(JSON.stringify(await f.evaluate(()=>({tool:state.tool,inputs:__snapInputs,draw:_draw,locked:state.boardLocked,ro:window.__vaultReadOnly,body:document.body.className,rect:svg.getBoundingClientRect().toJSON()}))));}
    assert.ok(pts&&pts.length===2,JSON.stringify({orientation,flip,tilt,pts}));
    // Deselecting on pointerdown may change board padding. Compare with the
    // pitch coordinates actually read for each event, rather than a prior CTM.
    const expected=await f.evaluate(()=>{const q=PR(),step=M2U(5);return __snapInputs.map(u=>({x:q.L+Math.round((u.x-q.L)/step)*step,y:q.T+Math.round((u.y-q.T)/step)*step}));});
    for(let i=0;i<2;i++)assert.ok(Math.hypot(pts[i].x-expected[i].x,pts[i].y-expected[i].y)<.1,JSON.stringify({orientation,flip,tilt,pts,expected}));
  }
  await f.evaluate(()=>{beginDraw=__testBegin;moveDraw=__testMove;delete window.__testBegin;delete window.__testMove;delete window.__snapInputs;__setTilt(false);state.orientation='h';state.spFlip=false;applyView();_activateMoveTool();});

  await f.evaluate(()=>PSBoardEditChecks.seed());
  await f.getByRole('button',{name:'배치 도구',exact:true}).click();
  await f.getByRole('button',{name:'훈련 조끼 주황',exact:true}).click();
  await f.getByLabel('편집 격자 간격',{exact:true}).selectOption('3');
  await f.getByLabel('격자·안내선에 맞추기',{exact:true}).check();
  await f.getByRole('button',{name:'배치 도구 닫기',exact:true}).click();
  await f.evaluate(()=>{const d=state.drawings[1];addText(d.pts[0],d);});
  await f.getByRole('button',{name:'아주 굵게',exact:true}).click();
  await f.getByRole('button',{name:'기울임',exact:true}).click();
  await f.getByLabel('텍스트 회전 각도',{exact:true}).fill('15');
  await f.getByRole('button',{name:'완료',exact:true}).click();
  for(const width of [375,393,768,1280]){
    await page.setViewportSize({width,height:900});
    await f.getByRole('button',{name:'배치 도구',exact:true}).click();
    const bounds=await f.locator('#psEditTools').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,overflow:el.scrollWidth-el.clientWidth};});
    assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1&&bounds.overflow<=1,JSON.stringify(bounds));
    const free=await f.locator('[data-free]').boundingBox();console.log(JSON.stringify({width,bounds,free}));assert.ok(free.height>=43.9,'free move touch target');
    await page.screenshot({path:output+'/layout-'+width+'.png'});
    await f.getByRole('button',{name:'배치 도구 닫기',exact:true}).click();
  }
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
  await page.reload({waitUntil:'domcontentloaded'});f=await board();
  assert.deepEqual(await f.evaluate(()=>({bibs:state.players.map(p=>p.bib),grid:window.__editGrid,text:PSBoardEdit.textStyle(state.drawings[1])})),{bibs:['#fb923c','#fb923c','#fb923c'],grid:3,text:{textWeight:400,textItalic:true,textAngle:15,textFont:'base'}});
  assert.equal(await f.locator('#tokenLayer .ps-bib').count(),3,'saved bibs are visible immediately after reload');
  const tablet=await openApp(fx,'ipad',{browsers,tilt3d:false});
  await tablet.page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const tf=await (await tablet.page.waitForSelector('#fBoard')).contentFrame();
  await tf.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSBoardEdit);
  await tf.addScriptTag({path:fileURLToPath(new URL('../fixtures/board-training-checks.js',import.meta.url))});
  const touchResults=await tf.evaluate(()=>PSBoardEditChecks.run());assert.deepEqual(touchResults.filter(r=>!r.pass),[]);console.log(JSON.stringify({tablet:touchResults}));
  assert.deepEqual(tablet.logs.filter(l=>l.type==='pageerror'),[]);
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
