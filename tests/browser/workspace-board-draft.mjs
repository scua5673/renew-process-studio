import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SIZES,A,WT,WP} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps3169-evidence';
fs.mkdirSync(out,{recursive:true});
const browsers={},fx=await startFixture(),results=[];
const snap=x=>({players:[{id:'synthetic-switch-token',name:'가상 초안 선수',num:8,team:'blue',x,y:330}],equipment:[],drawings:[],ball:null,pitchN:1,orientation:'h'});
const frames=x=>[{snap:snap(x),dur:1},{snap:snap(x+20),dur:1}];
const pages=[{id:'synthetic-page-a',name:'가상 첫 페이지',snap:snap(450),anim:{frames:frames(450),active:0}},{id:'synthetic-page-b',name:'가상 둘째 페이지',snap:snap(650),anim:{frames:frames(650),active:0}}];
const baseline=JSON.stringify({snap:snap(450),view:'board',matchActive:false,meetSlides:[],animFrames:frames(450),animActive:0,boardPages:{idx:0,pages},boardLink:null,_savedAt:1000});
fx.db.set(WP+'|cs_private_board_v1',{workspace_id:WP,k:'cs_private_board_v1',v:baseline,cupd:1000,updated_by:A});
const normalized=raw=>{const o=JSON.parse(raw);delete o._savedAt;return o;};
// Applying an animation rebuilds thumbnails and materializes its inherited
// title/hold defaults. The stored recovery raw above remains byte-complete.
const restoredBody=raw=>JSON.parse(JSON.stringify(normalized(raw),(k,v)=>['thumb','__t','__tc','__hold'].includes(k)?undefined:v));
async function frame(page){const f=await (await page.$('#fBoard')).contentFrame();await f.waitForFunction(()=>typeof _boardPrivateLoaded!=='undefined'&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!window.__boardRestoring);return f;}
try{
 for(const [width,mode] of [[375,'immediate'],[393,'immediate'],[768,'immediate'],[1280,'immediate'],[1280,'quota-delay'],[1280,'both-fail'],[1280,'late-receipt'],[1280,'playback']]){
  if(process.env.PS_DRAFT_CASE&&process.env.PS_DRAFT_CASE!==width+'-'+mode)continue;
  console.log(JSON.stringify({engine,width,mode,stage:'open'}));
  SIZES.draft={engine,ctx:{viewport:{width,height:860},deviceScaleFactor:1}};
  const {page,context,logs}=await openApp(fx,'draft',{browsers});
  try{
   await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());let f=await frame(page);
   console.log(JSON.stringify({engine,width,mode,stage:'board-ready'}));
   await page.evaluate(()=>{
    window.addEventListener('ps-before-workspace-switch',function(){
      const w=document.getElementById('fBoard').contentWindow;
      sessionStorage.setItem('qa-board-at-guard',w.boardLiveCapture('board').raw);
    });
   });
   await f.evaluate(mode=>{
    const key=boardDraftKey(_boardPrivateOwner);window.__qaDraftKey=key;window.__qaDraftMode=mode;
    const set=Storage.prototype.setItem,get=storage.get.bind(storage),cas=storage.replaceIfValue.bind(storage);window.__qaDraftFaults=0;
    delete localStorage.setItem;
    Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key&&window.__qaDraftMode!=='off'&&(mode==='quota-delay'||mode==='both-fail')){window.__qaDraftFaults++;throw Object.assign(new Error('Synthetic draft quota'),{name:'QuotaExceededError'});}return set.call(this,k,v);};
    storage.get=function(k){if(k===key&&window.__qaDraftMode==='both-fail')return Promise.reject(new Error('Synthetic draft IDB failure'));return get(k);};
    storage.replaceIfValue=async function(k,b,v,guard){if(k===key&&window.__qaDraftMode==='quota-delay'){window.__qaDraftWaiting=true;await new Promise(resolve=>window.__qaDraftRelease=resolve);}return cas(k,b,v,guard);};
    const flush=psFlushPendingReady;
    window.psFlushPendingReady=function(){return flush().catch(e=>{let local=null;try{local=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}sessionStorage.setItem('qa-board-draft-failure',JSON.stringify({message:e.message,local:local?.raw,current:boardLiveCapture('board')?.raw,loaded:_boardPrivateLoaded,ownerCurrent:boardPrivateCurrent(_boardPrivateOwner)}));throw e;});};
   },mode);
   if(mode==='late-receipt')await page.evaluate(()=>{
    const flush=psFlushAllPendingReady;let calls=0;
    window.psFlushAllPendingReady=async function(...args){
     if(++calls===2){const w=document.getElementById('fBoard').contentWindow,k=w.__qaDraftKey;w.localStorage.removeItem(k);await w.storage.del(k);}
     return flush.apply(this,args);
    };
   });
   const origin=await page.evaluate(()=>performance.timeOrigin);
   const expected=await f.evaluate(({WP,mode})=>{
    const sn=captureSnap();sn.players[0].x=521;loadSnap(sn);_boardUserTouched=true;boardSaveLive();
    const raw=boardLiveCapture('board').raw;
    if(mode==='playback')playAnim();
    const shell=parent;shell.PSSync.switchWorkspace(WP).then(r=>{try{shell.__qaDraftResult=r;}catch(_){}});
    return raw;
   },{WP,mode});
   console.log(JSON.stringify({engine,width,mode,stage:'switch-started'}));
   if(mode==='quota-delay'){
    await f.waitForFunction(()=>window.__qaDraftWaiting);
    assert.ok(await f.evaluate(()=>window.__qaDraftFaults>0),'the quota fixture actually rejected localStorage writes');
    assert.equal(await page.evaluate(()=>PSSync.activeWs()),WT);assert.equal(await page.evaluate(()=>localStorage.getItem('ps_ws_switch_guard_v1')),null,'guard waits for actual draft durability');
    assert.equal(await f.evaluate(()=>_boardPrivateLoaded&&boardManualChanged()),true);
    await f.evaluate(()=>{window.__qaDraftMode='off';window.__qaDraftRelease();});
   }
   if(mode==='both-fail'||mode==='late-receipt'){
    await page.waitForFunction(()=>window.__qaDraftResult?.cancelled);
    assert.equal(await page.evaluate(()=>PSSync.activeWs()),WT);assert.equal(await f.evaluate(()=>captureSnap().players[0].x),521,'failed preservation retains the visible edit');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ps_ws_switch_guard_v1')),null);
    if(mode==='both-fail'){
     assert.ok(await f.evaluate(()=>window.__qaDraftFaults>0),'the failure fixture actually rejected localStorage writes');
     await f.evaluate(()=>{window.__qaDraftMode='off';});
     await page.evaluate(WP=>{window.__qaDraftResult=null;PSSync.switchWorkspace(WP).then(r=>window.__qaDraftResult=r);},WP);
    }else{
     results.push({width,mode,sourceRetained:true,lateReceiptVerified:true});continue;
    }
   }
   await page.waitForFunction(origin=>performance.timeOrigin!==origin||window.__qaDraftResult?.cancelled,origin,{timeout:45000});
   const cancelled=await page.evaluate(()=>window.__qaDraftResult?.cancelled?window.__qaDraftResult:null);if(cancelled)throw new Error('Unexpected draft barrier cancellation: '+JSON.stringify(cancelled));
   console.log(JSON.stringify({engine,width,mode,stage:'reloaded'}));
   await page.waitForFunction(WP=>window.PSSync&&PSSync.activeWs()===WP&&PSSync.dataUnlocked(),WP,{timeout:45000});
   f=await frame(page);await f.waitForFunction(()=>!!window.__boardDraftPending);
   const draft=await f.evaluate(()=>window.__boardDraftPending);
   const atGuard=await page.evaluate(()=>sessionStorage.getItem('qa-board-at-guard'));
   assert.deepEqual(normalized(draft.raw),normalized(atGuard),'reloaded full draft is the exact complete source before frame removal');
   assert.deepEqual(restoredBody(draft.raw),restoredBody(expected),'the edit and every page/frame survive any derived thumbnail refresh');
   await page.waitForFunction(()=>!document.body.classList.contains('ps-booting')&&![...document.body.children].some(el=>el.style.zIndex==='2147483646'));
   if(await page.evaluate(()=>document.body.dataset.psApp!=='board'||document.body.classList.contains('ps-team-open')))await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
   await f.waitForFunction(()=>boardPrivateCurrent(_boardPrivateOwner)&&_boardPrivateLoaded&&!boardDraftBusy());
   await f.evaluate(()=>{const restore=window.__boardDraftRestore;window.__boardDraftRestore=function(...args){const before={current:boardPrivateCurrent(_boardPrivateOwner),busy:boardDraftBusy(),dirty:boardManualChanged(),pending:!!window.__boardDraftPending};const result=restore.apply(this,args);window.__qaRestoreClick={before,result};return result;};});
   await f.locator('#boardDraftBar .bd-keep').click();
   const clicked=await f.evaluate(()=>({ok:window.__boardDraftPending===null&&boardManualChanged(),called:window.__qaRestoreClick||null,pending:!!window.__boardDraftPending,dirty:boardManualChanged(),current:boardPrivateCurrent(_boardPrivateOwner),owner:!!boardPrivateOwner(),busy:boardDraftBusy(),loaded:_boardPrivateLoaded,view:window.__csView,classes:document.body.className,x:captureSnap().players[0]?.x}));
   assert.equal(clicked.ok,true,'the visible recovery button restores unsaved work: '+JSON.stringify(clicked));
   const restored=await f.evaluate(()=>boardLiveCapture('board').raw);
   assert.deepEqual(restoredBody(restored),restoredBody(expected),'restoring the offered draft returns every page, frame and board field');
   assert.equal(fx.db.get(WP+'|cs_private_board_v1').v,baseline,'unsaved draft never overwrites the explicit server board');
   assert.equal(fx.writes.filter(w=>w.k==='cs_private_board_v1').length,0);
   if(width===375||width===1280&&mode==='immediate'){
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
    await page.screenshot({path:path.join(out,`board-draft-restored-${engine}-${width}.png`),animations:'disabled'});
   }
   assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
   results.push({width,mode,draftRetained:true,fullRestore:true,serverUnchanged:true});console.log(JSON.stringify({engine,width,mode,passed:true}));
  }catch(e){
   const state=await page.evaluate(()=>({active:window.PSSync?.activeWs(),sync:window.PSSync?.state(),guard:localStorage.getItem('ps_ws_switch_guard_v1'),lastSwitch:localStorage.getItem('ps_last_switch_err'),result:window.__qaDraftResult,booting:document.body.classList.contains('ps-booting'),board:(()=>{try{const w=document.getElementById('fBoard').contentWindow;return {loaded:w._boardPrivateLoaded,dirty:w.boardManualChanged?.(),ownerCurrent:w.boardPrivateCurrent?.(w._boardPrivateOwner),pending:w.psHasPending?.(),restoreClick:w.__qaRestoreClick};}catch(_){return null;}})()})).catch(()=>null);
   const draftFailure=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-board-draft-failure')||'null')).catch(()=>null);
   fs.writeFileSync(path.join(out,`workspace-board-draft-${engine}-failure.json`),JSON.stringify({width,mode,error:e.message,state,draftFailure,logs},null,2));
   await page.screenshot({path:path.join(out,`workspace-board-draft-${engine}-failure.png`)}).catch(()=>{});throw e;
  }finally{await context.close();}
 }
 fs.writeFileSync(path.join(out,`workspace-board-draft-${engine}.json`),JSON.stringify({engine,passed:true,results},null,2));
 console.log(JSON.stringify({engine,passed:true,results}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
