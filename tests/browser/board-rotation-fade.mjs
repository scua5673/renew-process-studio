import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS,SIZES} from '../fixtures/team-app.mjs';
// d154e50b: old duplicate scenes acquire independent drawing identities on load/rotation.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
try{for(const width of (process.env.PS_WIDTHS||'375,393,768,1280').split(',').map(Number)){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:900};SIZES[size].ctx.screen={width,height:900};
 const {page,context}=await openApp(fx,size,{browsers,tilt3d:false});
 async function board(){
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await(await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!(_boardPrivateRecord?_boardPrivateRecord.base:_boardPrivateBase));return f;
 }
 let f=await board();let checked=0;
 for(const legacy of [false,true]){
  await f.evaluate(legacy=>{
   __setTilt(false);boardShowDefault();state.tool='move';state.orientation='h';state.spFlip=false;state.halfSide='L';applyView();
   state.drawings=[{type:'rectline',color:'#fe0',pts:[{x:200,y:200},{x:300,y:300}]},{type:'line',color:'#fff',pts:[{x:240,y:310},{x:440,y:400}]},{type:'text',text:'프로세스FC',size:30,color:'#fff',pts:[{x:420,y:180}]}];
   renderDrawings();anim.frames=[];animActive=-1;document.getElementById('animAdd').click();duplicateAnimFrame(0);
   if(legacy){const old=captureSnap();old.drawings.forEach(d=>delete d._sceneId);anim.frames=[{snap:dc(old),dur:1},{snap:dc(old),dur:1}];animActive=0;loadSnap(anim.frames[0].snap);renderAnimFrames();}
  },legacy);
  for(let turns=0;turns<4;turns++){
   if(turns)await f.evaluate(()=>window.__rotateHalf());
   const row=await f.evaluate(()=>{
    const a=anim.frames[0].snap,b=anim.frames[1].snap,previous=window.__capLock,playing=animPlaying,saved=JSON.stringify(anim.frames);window.__capLock=1;animPlaying=true;
    try{
     const samples=[0,.25,.5,.75,1].map(u=>{renderInterp(a,b,u);return {u,count:state.drawings.length,opacity:[...drawLayer.children].map(g=>+(g.getAttribute('opacity')??1))};});
     const doc=new DOMParser().parseFromString(boardImageXML().xml,'image/svg+xml');
     return {rotation:window.__getRotDeg(),samples,unchanged:saved===JSON.stringify(anim.frames),text:[...doc.querySelectorAll('text')].some(t=>t.textContent==='프로세스FC'),xmlValid:!doc.querySelector('parsererror')};
    }finally{animPlaying=playing;loadSnap(anim.frames[animActive].snap);window.__capLock=previous;}
   });
   assert.equal(row.unchanged,true);assert.equal(row.text,true);assert.equal(row.xmlValid,true);
   for(const sample of row.samples){assert.equal(sample.count,3,JSON.stringify({engine,width,legacy,...row}));assert.equal(sample.opacity.length,3);assert.ok(sample.opacity.every(o=>o===1),JSON.stringify({engine,width,legacy,...row}));checked++;}
  }
 }
 const changed=await f.evaluate(()=>{const a=anim.frames[0].snap,b=dc(a);b.drawings[0].color='#f00';return _interpDrawings(a.drawings,b.drawings,.5).map(d=>d._fade??1);});assert.ok(changed.includes(0));assert.ok(changed.some(o=>o>0&&o<1));
 assert.equal(await f.evaluate(()=>__boardSaveExplicit()),true);
 await page.reload();await ready(page);f=await board();await f.waitForFunction(()=>anim.frames.length===2&&state.drawings.some(d=>d.text==='프로세스FC'));
 assert.equal(await f.evaluate(()=>_interpDrawings(anim.frames[0].snap.drawings,anim.frames[1].snap.drawings,.5).length),3,'saved and reloaded duplicate drawings remain visible');
 if(width===375||width===1280)await page.screenshot({path:path.join(SHOTS,engine+'-'+width+'-rotation-fade.png')});
 console.log(JSON.stringify({engine,width,angles:[0,90,180,270],legacyAndNew:true,samples:checked,uninterrupted:true,realChangesFade:true,reload:true,export:true}));await context.close();
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
