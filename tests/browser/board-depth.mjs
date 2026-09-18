import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/board-depth');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://board-depth-fixture.invalid';
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
const results=[];
try{for(const viewport of [{width:1280,height:900},{width:820,height:1180},{width:393,height:852}]){
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
      s.equipment=[{id:'cone-a',team:'cone',x:720,y:340},{id:'marker-a',team:'marker',x:780,y:470}];s.ball={id:'ball',team:'ball',x:570,y:350};s.drawings=[];loadSnap(s);state.tool='move';
    });
    for(const theme of ['navy','white','train'])for(const orientation of ['h','v']){
      await page.evaluate(({theme,orientation})=>{document.documentElement.dataset.pitch=theme;state.orientation=orientation;buildPitch();window.__setTilt(true);window.__tiltFit();}, {theme,orientation});
      const r=await page.evaluate(()=>{
        const before=JSON.stringify(captureSnap()),selected=state.players[0];selectItem('player',selected);
        const target=tokenLayer.querySelector('[data-id="depth-a"]');let saves=0,renders=0;
        const save=boardSaveLive,render=renderTokens;boardSaveLive=()=>saves++;renderTokens=()=>renders++;
        let thumb,exportXML;try{thumb=boardThumbSVG();exportXML=boardImageXML().xml;}finally{boardSaveLive=save;renderTokens=render;}
        const goal=document.querySelector('#tiltGoals .goal-front');
        return {unchanged:before===JSON.stringify(captureSnap()),sameNode:target===tokenLayer.querySelector('[data-id="depth-a"]'),sameSelection:sel.ref===selected,saves,renders,thumbHasDepth:thumb.includes('ps-depth-face'),thumbHasSelection:thumb.includes('ps-selring'),exportHasDepth:exportXML.includes('ps-depth-face'),exportHasSelection:exportXML.includes('ps-selring'),tokens:tokenLayer.querySelectorAll('.token[data-depth]').length,goalColor:getComputedStyle(goal).borderTopColor,goalVisible:goal.getBoundingClientRect().width>0};
      });
      assert.equal(r.unchanged,true);assert.equal(r.sameNode,true);assert.equal(r.sameSelection,true);assert.equal(r.saves,0);assert.equal(r.renders,0);
      assert.equal(r.exportHasDepth,false);assert.equal(r.exportHasSelection,false);assert.equal(r.thumbHasDepth,false);assert.equal(r.thumbHasSelection,false);assert.equal(r.tokens,5);assert.equal(r.goalVisible,true);
      assert.equal(r.goalColor,theme==='navy'?'rgb(255, 255, 255)':'rgb(48, 60, 76)');
      await page.evaluate(()=>{sel=null;multiSel=[];renderTokens();updateDelUI();});
      await page.screenshot({path:path.join(out,`${viewport.width}-${theme}-${orientation}.png`)});
      results.push({width:viewport.width,theme,orientation,...r});
    }
    const before=await page.evaluate(()=>({x:state.players[0].x,y:state.players[0].y}));
    const box=await page.locator('.token[data-id="depth-a"] .ps-depth-face').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/3);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/3+25,{steps:8});await page.mouse.up();
    const after=await page.evaluate(()=>({x:state.players[0].x,y:state.players[0].y}));assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>8,'raised face remains draggable');
    const variants=await page.evaluate(()=>{
      const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>');
      setTokShape('shirt');state.players[0].img=photo;state.players[1].color='#238c71';state.players[1].rot=90;state.players[1].scale=1.4;renderTokens();
      const p=tokenLayer.querySelector('[data-id="depth-a"]'),shirt=tokenLayer.querySelector('[data-id="depth-b"]');
      const before=JSON.stringify(captureSnap()),saved=boardImageXML().xml;
      const cone=state.equipment[0],g=tokenLayer.querySelector('[data-id="cone-a"]');cone.rot=90;g.setAttribute('transform',tokenTransform(cone));PSBoardDepth.update(g,cone);
      return {photo:p.querySelector('image').getAttribute('href')===photo,shirt:shirt.querySelector('.tok-c').tagName==='path',color:shirt.querySelector('.tok-c').getAttribute('fill'),face:shirt.querySelector('.ps-depth-face').getAttribute('transform'),exportPhoto:saved.includes('data:image/svg+xml'),rotatedCone:g.querySelector('.ps-depth-face').getAttribute('transform')};
    });
    assert.equal(variants.photo,true);assert.equal(variants.shirt,true);assert.equal(variants.color,'#238c71');assert.equal(variants.exportPhoto,true);assert.match(variants.face,/translate\(-13,/);assert.match(variants.rotatedCone,/translate\(-7,/);
    await page.evaluate(()=>__setTilt(false));assert.equal(await page.locator('.token[data-depth]').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,results},null,2));}
console.log(JSON.stringify({engine,cases:results.length,passed:true}));
