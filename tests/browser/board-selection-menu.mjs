import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startFixture,openApp,SIZES,ready} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
try{for(const size of ['desktop','ipad','phone']){
 const {page,context,logs}=await openApp(fx,size,{browsers,tilt3d:false});
 async function board(){await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());const f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psSelectionMenu);return f;}
 let f=await board();
 if(size==='phone'){assert.equal(await f.evaluate(()=>psPhoneBoardReadOnly()),true);assert.equal(await f.locator('.sel-ctl').isVisible(),false);await context.close();continue;}
 for(const name of ['board-training-checks','board-selection-checks'])await f.addScriptTag({path:fileURLToPath(new URL('../fixtures/'+name+'.js',import.meta.url))});
 const results=await f.evaluate(()=>PSSelectionChecks.run());console.log(JSON.stringify({engine,size,results}));assert.deepEqual(results.filter(r=>!r.pass),[]);
 await f.evaluate(()=>{selectItem('player',state.players[0]);__selPanelOpen(true);});
 await f.locator('#nameInput').fill('저장 후 메뉴');await f.locator('#numInput').fill('17');await f.locator('#numInput').press('Tab');
 await f.locator('.ps-sm-more summary').click();await f.locator('.ps-in-foot [data-foot="R"]').click();
 assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);f=await board();
 await f.waitForFunction(()=>state.players[0]?.name==='저장 후 메뉴');
 assert.deepEqual(await f.evaluate(()=>({num:String(state.players[0].num),foot:state.players[0].foot})),{num:'17',foot:'R'});
 assert.equal(await f.locator('.sel-ctl').isVisible(),false,'opening a saved board does not display an empty menu');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);await context.close();
}}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
