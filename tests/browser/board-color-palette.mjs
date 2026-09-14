import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.PS_TEST_OUTPUT||'/private/tmp/process-board-palette';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-color-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
const MY='cs_my_cols_v1',custom='#6b7280';
const fixture='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style><iframe src="/studio/board.html?fixture=color-palette"></iframe>';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{for(const spec of [{name:'desktop',width:1280,height:900},{name:'phone',width:393,height:852,touch:true},{name:'phone-dock',width:393,height:852,touch:true,shellDock:true}]){
 const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:!!spec.touch,hasTouch:!!spec.touch,serviceWorkers:'block'});let page,frame;
 const errors=[];const result={viewport:spec.name};results.push(result);
 try{
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();if(u.pathname==='/fixture.html')return route.fulfill({contentType:'text/html',body:fixture});const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
  await context.addInitScript(({UID,WID})=>{
   if(!localStorage.getItem('palette_fixture_seeded')){localStorage.setItem('palette_fixture_seeded','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'fixture-only',rt:'fixture-only'}));localStorage.setItem('ps_active_ws',WID);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'team',role:'owner'}]));localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[UID]:{role:'executive'}},defaultRole:'player'}));localStorage.setItem('cs_lang','ko');}
   window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')),activeWs:()=>WID,activeWsObj:()=>({id:WID,kind:'team',role:'owner'}),dataUnlocked:()=>true,keyReady:()=>true,act(){},ping(){},event(){}};
  },{UID,WID});
  page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));
  async function ready(){frame=page.frame({url:/board.html\?fixture=color-palette/});await frame.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone);await page.waitForTimeout(1100);if(spec.shellDock)await frame.evaluate(()=>{document.body.classList.add('ps-dock','ps-phone-work');dispatchEvent(new Event('resize'));});}
  await page.goto(base+'/fixture.html');await ready();
  await frame.evaluate(()=>{boardShowDefault();const snap=captureSnap();snap.players=[{id:'color-a',team:'blue',num:8,name:'Synthetic A',x:450,y:300},{id:'color-b',team:'red',num:9,name:'Synthetic B',x:700,y:300}];snap.ball=null;snap.equipment=[];snap.drawings=[];loadSnap(snap);undoStack=[];redoStack=[];});
  const press=locator=>spec.touch?locator.tap():locator.click();
  async function open(id='color-a'){await press(frame.locator('.token[data-id="'+id+'"]'));if(!await frame.locator('#colorCtl.open').count())await press(frame.locator('#colorTrig'));await frame.locator('#colorPop').waitFor({state:'visible'});}
  // The extra sheet-layout fixture has the shell's CSS marker, not its injected toolbar.
  const undo=()=>spec.shellDock?frame.evaluate(()=>undoLast()):press(frame.locator('#undoBtn'));
  const colors=()=>frame.evaluate(()=>state.players.map(p=>p.color||null));
  await open();await press(frame.getByRole('button',{name:'회색',exact:true}));assert.deepEqual(await colors(),['#808080',null]);
  await press(frame.locator('#myColPin'));assert.equal(await frame.locator('#myDots [data-col="#808080"]').count(),1);
  await press(frame.locator('#myColPin'));assert.equal(await frame.locator('#myDots [data-col="#808080"]').count(),1,'duplicate pin is not duplicated');
  // Native OS color dialogs are outside browser automation; fill dispatches the input's real input/change handlers.
  await frame.locator('#equipColCustom').fill(custom);assert.deepEqual(await colors(),[custom,null]);assert.equal(await frame.locator('#myDots [data-col="'+custom+'"]').count(),1);
  await press(frame.locator('#colorPop > [data-col="#e23b3b"]'));await press(frame.locator('#myDots [data-col="'+custom+'"]'));assert.deepEqual(await colors(),[custom,null]);
  await undo();assert.deepEqual(await colors(),['#e23b3b',null],'saved color applies through undo');
  await open();await press(frame.locator('#myDots [data-col="'+custom+'"]'));
  await frame.evaluate(()=>{sel=null;multiSel=state.players.slice();renderTokens();updateDelUI();updateAlignBar();});
  if(!await frame.locator('#colorCtl.open').count())await press(frame.locator('#colorTrig'));await press(frame.locator('#myDots [data-col="'+custom+'"]'));assert.deepEqual(await colors(),[custom,custom],'both selected tokens use the saved color');
  await undo();assert.deepEqual(await colors(),[custom,null],'multi-color change is a single undo step');
  await open();await press(frame.locator('#myColEdit'));await page.screenshot({path:path.join(out,spec.name+'-edit.png')});const before=await colors();await press(frame.locator('#myDots [data-col="#808080"]'));assert.deepEqual(await colors(),before,'removing a fixed color never recolors players');assert.equal(await frame.locator('#myDots [data-col="#808080"]').count(),0);await press(frame.locator('#myColEdit'));
  const bounds=await frame.locator('#colorPop').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,background:getComputedStyle(el).backgroundColor,width:innerWidth,height:innerHeight,overflow:el.scrollWidth-el.clientWidth,dots:[...el.querySelectorAll('.cdot')].filter(d=>getComputedStyle(d).display!=='none').map(d=>{const b=d.getBoundingClientRect();return {width:b.width,height:b.height};})};});assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height,JSON.stringify(bounds));assert.ok(bounds.overflow<2,JSON.stringify(bounds));assert.ok(bounds.dots.every(d=>d.width===d.height&&d.width>=24),'color swatches remain square touch targets');
  await page.screenshot({path:path.join(out,spec.name+'-palette.png')});
  await frame.evaluate(()=>window.__boardFlushLive());await page.waitForTimeout(300);await page.reload();await ready();await open();
  assert.deepEqual(await frame.evaluate(MY=>JSON.parse(localStorage.getItem(MY)),MY),[custom]);assert.equal(await frame.locator('#myDots [data-col="'+custom+'"]').count(),1);assert.equal(await frame.locator('#myDots [data-col="#808080"]').count(),0);
  await press(frame.locator('#colorPop > [data-col="#e23b3b"]'));await press(frame.locator('#myDots [data-col="'+custom+'"]'));assert.equal((await colors())[0],custom);
  for(const hex of ['#112233','#223344','#334455','#445566','#556677'])await frame.locator('#equipColCustom').fill(hex);
  const fixed=await frame.evaluate(MY=>JSON.parse(localStorage.getItem(MY)),MY);assert.equal(fixed.length,6);assert.equal(fixed[0],custom);
  await frame.locator('#equipColCustom').fill('#667788');assert.deepEqual(await frame.evaluate(MY=>JSON.parse(localStorage.getItem(MY)),MY),fixed,'a full fixed palette never evicts an older saved color');
  const full=await frame.locator('#colorPop').boundingBox();assert.ok(full.x>=0&&full.x+full.width<=spec.width&&full.y>=0&&full.y+full.height<=spec.height,'full fixed palette remains within the viewport');
  await page.screenshot({path:path.join(out,spec.name+'-full-palette.png')});
  assert.deepEqual(errors.filter(e=>!e.includes('ResizeObserver loop')),[]);Object.assign(result,{passed:true,fullPalettePreservesPins:true,gray:true,add:true,deduplicated:true,reselect:true,remove:true,reload:true,multiUndo:true,bounds});
 }catch(e){Object.assign(result,{passed:false,error:e.stack,errors});await page?.screenshot({path:path.join(out,spec.name+'-failure.png')}).catch(()=>{});}
 finally{await context.close();}
}}
finally{await browser.close();}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,results},null,2));console.log(JSON.stringify({engine,results},null,2));assert.ok(results.every(r=>r.passed));
