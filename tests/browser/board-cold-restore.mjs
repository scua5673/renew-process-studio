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
 for(const width of [375,393,768,1280]){
  release=fx.holdKvPull(WP);
  // Hold the actual private GET through shell/dock initialization, as on a slow cold start.
  const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:850};
  const start=fx.calls.length,opening=openApp(fx,size,{browsers}),deadline=Date.now()+30000;
  while(!fx.calls.slice(start).some(c=>c.m==='GET'&&c.p==='/rest/v1/ps_kv'&&decodeURIComponent(c.q||'').includes(WP))){if(Date.now()>deadline)throw Error('No private board GET');await new Promise(r=>setTimeout(r,25));}
  const timer=setTimeout(()=>{release?.();release=null;},6500);
  const {page,context}=await opening;f=await board(page);
  await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!(_boardPrivateRecord?_boardPrivateRecord.base:_boardPrivateBase)&&state.players.some(p=>p.id===701));
  clearTimeout(timer);release?.();release=null;
  const restored=await f.evaluate(()=>({name:state.players.find(p=>p.id===701).name,shape:tokShape,grid:state.gridType,baseHasPlayer:JSON.parse(_boardPrivateRecord.base.raw).snap.players.some(p=>p.id===701)}));
  assert.deepEqual(restored,{name:'합성 복원 선수',shape:'shirt',grid:'none',baseHasPlayer:true});
  assert.equal(await f.evaluate(()=>__boardSaveExplicit()),true,'restored server preimage permits an exact save');
  console.log(JSON.stringify({engine,width,restored:true,lookPreserved:true,save:true}));await context.close();
 }
}finally{release?.();for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
