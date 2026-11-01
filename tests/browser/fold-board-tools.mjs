import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES,ready} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
SIZES.fold={engine,ctx:{...SIZES.phone.ctx,viewport:{width:400,height:900},userAgent:'Mozilla/5.0 (Linux; Android 16; Fold) AppleWebKit/537.36 Chrome/156.0.0.0 Mobile Safari/537.36'}};
try{
 const {page,context,logs}=await openApp(fx,'fold',{browsers,tilt3d:false,init:{fn:()=>{
  Object.defineProperty(screen,'width',{get:()=>top.innerWidth>=600?1088:400});
  Object.defineProperty(screen,'height',{get:()=>top.innerWidth>=600?759:900});
 }}});
 await ready(page);await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
 let f=await(await page.waitForSelector('#fBoard')).contentFrame();
 await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded);
 assert.equal(await f.evaluate(()=>psPhoneBoardReadOnly()),true);
 // Unfold after the old dock boot timers have expired.
 await page.waitForTimeout(16500);
 await page.setViewportSize({width:1088,height:759});
 await f.waitForFunction(()=>!psPhoneBoardReadOnly()&&document.getElementById('ps-df-fold')?.offsetWidth>0);
 await f.evaluate(()=>{
  loadSnap({players:[{id:9901,team:'blue',num:7,x:400,y:300}],equipment:[],drawings:[],orientation:'h',pitchN:1});
  const snap=captureSnap();anim.frames=[0,1,2].map(i=>({snap:structuredClone(snap),dur:1}));animActive=0;renderAnimFrames();renderTokens();
 });
 const read=()=>f.evaluate(()=>JSON.stringify({players:state.players,equipment:state.equipment,drawings:state.drawings,frames:anim.frames.map(x=>x.snap),active:animActive}));
 const before=await read(),doc=await f.evaluateHandle(()=>document);
 await f.locator('#ps-df-equip').click();await f.locator('#ps-df-tray').waitFor({state:'visible'});
 // Equipment names are rendered by ::after from title, so innerText omits them.
 await f.locator('#ps-df-tray #railEquip .chip[title="콘"]').waitFor({state:'visible'});
 assert.equal(await f.locator('#ps-df-tray #railEquip .chip[title="빨강 마커"]').isVisible(),true);
 await f.getByRole('button',{name:'선수·훈련 도구 닫기',exact:true}).click();
 assert.equal(await f.locator('#ps-df-equip').getAttribute('aria-expanded'),'false');
 await f.locator('#ps-df-anim').click();assert.equal(await f.locator('#animBar').isVisible(),false);
 await f.locator('#ps-df-anim').click();assert.equal(await f.locator('#animBar').isVisible(),true);
 await f.locator('#ps-df-fold').click();assert.equal(await f.locator('#cmd-tool-row').isVisible(),false);
 await f.getByRole('button',{name:'도구 도크 펼치기',exact:true}).click();
 assert.equal(await read(),before,'panel visibility must not edit board content');
 const box=await f.locator('#tokenLayer [data-id="9901"] .tok-c').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+30,{steps:6});await page.mouse.up();
 const edited=await read();assert.notEqual(edited,before,'expanded phone permits an actual drag');
 await page.setViewportSize({width:400,height:900});
 await f.waitForFunction(()=>psPhoneBoardReadOnly());
 assert.equal(await f.locator('#ps-command-dock').isVisible(),false);
 assert.equal(await f.locator('#boardToolbar').isVisible(),false);
 assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),false);
 assert.equal(await read(),edited,'folding preserves unsaved work');
 await page.setViewportSize({width:759,height:1088});
 await f.waitForFunction(()=>!psPhoneBoardReadOnly()&&innerWidth>=768&&document.getElementById('ps-df-fold').offsetWidth>0);
 assert.equal(await f.evaluate(d=>d===document,doc),true,'display transitions must not reload the document');
 assert.equal(await read(),edited);
 const dock=await f.locator('#ps-command-dock').boundingBox(),nav=await page.locator('#appSeg').boundingBox();
 assert.ok(dock.y+dock.height<=nav.y+1,'expanded portrait tools stay above navigation');
 assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
 await page.reload();await ready(page);await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
 f=await(await page.waitForSelector('#fBoard')).contentFrame();
 await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&state.players.some(p=>p.id===9901));
 assert.equal(await read(),edited,'explicit save survives reopening');
 assert.deepEqual(logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text)),[]);
 console.log(JSON.stringify({engine,foldBoardTools:true}));await context.close();
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
