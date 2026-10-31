import assert from 'node:assert/strict';
import {startFixture,openApp,WP,SIZES} from '../fixtures/team-app.mjs';
const fx=await startFixture(),browsers={},engine=process.env.PS_BROWSER_ENGINE||'chromium';
for(const s of Object.values(SIZES))s.engine=engine;
let release;
async function board(page){await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());return(await page.waitForSelector('#fBoard')).contentFrame();}
try{
 const seed=await openApp(fx,'desktop',{browsers});let f=await board(seed.page);
 await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&_boardPrivateBase);
 await f.evaluate(()=>{pushUndo();state.players=[{id:701,team:'blue',num:7,name:'합성 복원 선수',x:500,y:300}];setTokShape('shirt');state.gridType='none';renderTokens();});
 assert.equal(await f.evaluate(()=>__boardSaveExplicit()),true);await seed.context.close();
 for(const width of (process.env.PS_WIDTHS||'375,393,768,1280').split(',').map(Number)){
  release=fx.holdKvPull(WP,'cs_private_board_v1');
  // Hold the actual private GET through shell/dock initialization, as on a slow cold start.
  const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:850};
  const start=fx.calls.length,opening=openApp(fx,size,{browsers,init:{fn:()=>{
   if(window!==top){
    if(!location.pathname.endsWith('/board.html'))return;let dirty=false;window.__coldDirtyTrace=[];
    Object.defineProperty(window,'_boardManualDirty',{configurable:true,get:()=>dirty,set:value=>{if(value&&!dirty)window.__coldDirtyTrace.push({ready:window.__boardReady,done:window.__boardRestoreDone,stack:new Error().stack});dirty=value;}});
    // Decode the real asset normally; hold only its production onload callback
    // until the private GET is pending, making the CI race deterministic.
    const NativeImage=Image;
    window.Image=function(...args){const image=new NativeImage(...args);let onload;
     Object.defineProperty(image,'onload',{configurable:true,get:()=>onload,set:fn=>{onload=fn;}});
     image.addEventListener('load',event=>{if(typeof onload!=='function')return;
      if(window.BALL_IMG&&image.src===new URL(BALL_IMG.white,location.href).href)window.__heldBallLoad=()=>onload.call(image,event);
      else onload.call(image,event);
     });return image;
    };window.Image.prototype=NativeImage.prototype;return;
   }
   // Enter the already-loaded board while its first server preimage is still pending.
   const timer=setInterval(()=>{const w=document.getElementById('fBoard')?.contentWindow;
    if(window.__psShowApp&&w?._boardPrivateLoaded&&!w.__boardRestoreDone&&w.document.readyState==='complete'&&w.__heldBallLoad){
     clearInterval(timer);const before=w._boardPrivateEditSeq;w.__heldBallLoad();
     window.__coldAssetRender={before,after:w._boardPrivateEditSeq,dirty:w._boardManualDirty};
     window.__psShowApp('board');window.__coldBoardEntry=true;
    }
   },25);
  }}}),deadline=Date.now()+30000;
  while(!fx.calls.slice(start).some(c=>c.m==='GET'&&c.p==='/rest/v1/ps_kv'&&decodeURIComponent(c.q||'').includes(WP)&&decodeURIComponent(c.q||'').includes('k=eq.cs_private_board_v1'))){if(Date.now()>deadline)throw Error('No private board GET');await new Promise(r=>setTimeout(r,25));}
  const timer=setTimeout(()=>{release?.();release=null;},6500);
  const {page,context}=await opening;await page.waitForFunction(()=>window.__coldBoardEntry===true);f=await board(page);
  const asset=await page.evaluate(()=>window.__coldAssetRender);assert.deepEqual(asset,{before:0,after:0,dirty:false},'decoded ball image never manufactures an edit while GET is pending');
  try{await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!(_boardPrivateRecord?_boardPrivateRecord.base:_boardPrivateBase)&&state.players.some(p=>p.id===701));}
  catch(error){console.error(JSON.stringify(await f.evaluate(()=>({engine:navigator.userAgent,ready:window.__boardReady,done:window.__boardRestoreDone,loaded:_boardPrivateLoaded,current:boardPrivateCurrent(_boardPrivateOwner),base:!!_boardPrivateBase,recordBase:!!_boardPrivateRecord?.base,pending:!!_boardPrivateRecord?.pending,generation:_boardPrivateGeneration,edit:_boardPrivateEditSeq,dirty:_boardManualDirty,user:_boardUserTouched,liveDirty:_bliveDirty,view:window.__csView,capLock:window.__capLock,players:state.players.map(p=>p.id),trace:window.__coldDirtyTrace}))));throw error;}
  clearTimeout(timer);release?.();release=null;
  const restored=await f.evaluate(()=>({name:state.players.find(p=>p.id===701).name,shape:tokShape,grid:state.gridType,baseHasPlayer:JSON.parse(_boardPrivateRecord.base.raw).snap.players.some(p=>p.id===701)}));
  assert.deepEqual(restored,{name:'합성 복원 선수',shape:'shirt',grid:'none',baseHasPlayer:true});
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true})),size!=='phone','restored phone boards remain read-only; iPad and desktop can save');
  console.log(JSON.stringify({engine,width,restored:true,lookPreserved:true,save:size!=='phone'}));await context.close();
 }
}finally{release?.();for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
