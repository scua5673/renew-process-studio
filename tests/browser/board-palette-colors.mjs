import assert from 'node:assert/strict';import path from 'node:path';
import {startFixture,openApp,ready,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 9af3a112: content swatches must retain their colors inside the shared sizebox container.
const fx=await startFixture(),browsers={},engine=process.env.PS_BROWSER_ENGINE||'chromium';for(const s of Object.values(SIZES))s.engine=engine;
SIZES.compactDesktop={engine,ctx:{viewport:{width:375,height:900},deviceScaleFactor:1,hasTouch:false}};
try{for(const width of (process.env.PS_WIDTHS||'375,393,768,1280').split(',').map(Number)){
 const size=width<700?'compactDesktop':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:900};SIZES[size].ctx.screen={width,height:900};
 const {page,context}=await openApp(fx,size,{browsers,tilt3d:false});
 async function board(){await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());const f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!(_boardPrivateRecord?_boardPrivateRecord.base:_boardPrivateBase));return f;}
 let f=await board();
 await f.evaluate(()=>{__setTilt(false);boardShowDefault();const snap=captureSnap();snap.players=Array.from({length:6},(_,i)=>({id:101+i,num:i+1,name:'프로세스FC '+(i+1),team:'blue',x:250+i*75,y:250+(i%2)*100}));snap.ball=null;snap.drawings=[];loadSnap(snap);});
 async function open(multi){await f.evaluate(multi=>{multiSel=multi?state.players.slice():[];sel=multi?null:{type:'player',ref:state.players[0]};window.__selPanelOpen(true);renderTokens();updateDelUI();updateAlignBar();},multi);if(!await f.locator('.ps-sm-more').evaluate(e=>e.open))await f.locator('.ps-sm-more summary').click();if(!await f.locator('#colorPop').isVisible())await f.locator('#colorTrig').click();await f.locator('#colorPop').waitFor({state:'visible'});}
 async function swatches(){return f.evaluate(()=>[...document.querySelectorAll('#colorPop button[data-col]')].map(b=>{let hex=b.dataset.col.slice(1);if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));return {col:b.dataset.col,expected:'rgb('+rgb.join(', ')+')',actual:getComputedStyle(b).backgroundColor};}));}
 let checked=0;
 for(const dark of [false,true])for(const multi of [false,true]){
  await f.evaluate(dark=>document.body.classList.toggle('fmdark',dark),dark);await open(multi);
  const colors=await swatches();assert.ok(colors.length>=11);for(const c of colors)assert.equal(c.actual,c.expected,JSON.stringify({engine,width,dark,multi,...c}));checked+=colors.length;
  if(width>=1000){await f.locator('#colorPop [data-col="#e23b3b"]').first().hover();for(const c of await swatches())assert.equal(c.actual,c.expected,'hover preserves '+c.col);}
  const before=await f.evaluate(()=>state.players.map(p=>p.color||null));await f.locator('#colorPop [data-col="#e23b3b"]').first().click();
  const after=await f.evaluate(()=>state.players.map(p=>p.color||null));assert.equal(after[0],'#e23b3b');if(multi)assert.ok(after.every(c=>c==='#e23b3b'));else assert.deepEqual(after.slice(1),before.slice(1));
  await f.evaluate(()=>undoLast());assert.deepEqual(await f.evaluate(()=>state.players.map(p=>p.color||null)),before);
 }
 await f.evaluate(()=>document.body.classList.remove('fmdark'));await open(true);await f.locator('#colorPop [data-col="#2f6df0"]').first().click();await open(true);await f.locator('#myColPin').click();
 assert.equal(await f.locator('#myDots [data-col="#2f6df0"]').count(),1);for(const c of await swatches())assert.equal(c.actual,c.expected,'pinned color '+c.col);
 if(width===375||width===1280)await page.screenshot({path:path.join(SHOTS,engine+'-'+width+'-palette-colors.png')});
 assert.equal(await f.evaluate(()=>__boardSaveExplicit()),true);await page.reload();await ready(page);f=await board();await f.waitForFunction(()=>state.players.length===6&&state.players.every(p=>p.color==='#2f6df0'));
 await open(true);assert.equal(await f.locator('#myDots [data-col="#2f6df0"]').count(),1);for(const c of await swatches())assert.equal(c.actual,c.expected,'reloaded swatch '+c.col);
 console.log(JSON.stringify({engine,width,lightAndDark:true,singleAndSix:true,checked,hover:width>=1000,selection:true,undo:true,pin:true,reload:true}));await context.close();
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
