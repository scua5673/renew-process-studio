import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
try{for(const size of ['desktop','ipad']){
 const {page,context,logs}=await openApp(fx,size,{browsers,tilt3d:false});
 async function board(){await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());const f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psPages);return f;}
 let f=await board();
 await f.evaluate(()=>{
  boardShowDefault();const base=captureSnap(),copy=o=>JSON.parse(JSON.stringify(o));
  base.players=[{id:101,team:'blue',num:7,name:'복사 선수',x:300,y:300,custom:{value:1}}];
  base.equipment=[{id:102,team:'cone',x:550,y:400,rot:30}];base.drawings=[];base.ball=null;
  const empty={...copy(base),players:[],equipment:[]};
  __psPages.restoreContext({pages:[{name:'원본',snap:base,thumb:''},{name:'대상',snap:empty,thumb:''}],idx:0});
  loadSnap(base);__animReset();state.tool='move';renderTokens();clearBoardHistory();
 });
 const press=async key=>{await f.locator('body').press(key);};
 await f.locator('.token[data-id="101"]').click();
 await f.locator('.token[data-id="102"]').click({modifiers:['Shift']});
 assert.equal(await f.evaluate(()=>multiSel.length),2);
 await press('Meta+c');
 await f.locator('#boardPageStrip .bp-tab').nth(1).click();
 await press('Meta+v');
 assert.deepEqual(await f.evaluate(()=>({p:state.players.length,e:state.equipment.length,name:state.players[0]?.name,rot:state.equipment[0]?.rot})),{p:1,e:1,name:'복사 선수',rot:30});
 await press('Meta+z');assert.equal(await f.evaluate(()=>state.players.length+state.equipment.length),0);
 await press('Meta+Shift+z');assert.equal(await f.evaluate(()=>state.players.length+state.equipment.length),2);
 await f.evaluate(()=>state.players[0].custom.value=9);
 await press('Control+v');
 assert.deepEqual(await f.evaluate(()=>state.players.map(p=>p.custom.value)),[9,1]);
 assert.equal(await f.evaluate(()=>new Set([...state.players,...state.equipment].map(o=>o.id)).size),4);
 await f.locator('#boardPageStrip .bp-tab').nth(0).click();
 assert.equal(await f.evaluate(()=>state.players.length),1,'source unchanged');
 await f.locator('#boardPageStrip .bp-tab').nth(1).click();
 assert.equal(await f.evaluate(()=>state.players.length),2,'target survives navigation');
 assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
 await f.evaluate(()=>{sel={type:'player',ref:state.players[0]};multiSel=[];window.dispatchEvent(new KeyboardEvent('keydown',{key:'ㅊ',code:'KeyC',metaKey:true,bubbles:true,cancelable:true}));});
 assert.equal(await f.evaluate(()=>_tokClip.length),1);
 await page.reload({waitUntil:'domcontentloaded'});f=await board();
 await f.waitForFunction(()=>state.players.length===2);
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
 console.log(JSON.stringify({engine,size,crossPage:true,undoRedo:true,independentCopies:true,savedReload:true}));
 await context.close();
}}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
