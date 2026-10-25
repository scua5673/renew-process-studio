import assert from 'node:assert/strict';
import {startFixture,openApp,WT,WP,A,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
const H='a'.repeat(24),photo='data:image/png;base64,'+'Q'.repeat(720),item={libId:'original',type:'board',name:'현재 자료',folder:'',tags:[],savedAt:10,editedAt:10,createdBy:A,snap:{players:[]},pages:[{name:'첫 장'},{name:'둘째 장'}]};
const row={workspace_id:WT,lib_id:item.libId,type:'board',name:item.name,folder:'',tags:[],pin:false,item,saved_at:10,deleted_at:null,owner_id:A,private:true};
fx.lib.set(WT+'|'+item.libId,structuredClone(row));fx.blobs.set(WT+'|'+H,{workspace_id:WT,h:H,v:photo});
fx.libraryHistory.set('1',{id:1,workspace_id:WT,lib_id:item.libId,owner_id:A,snapshot:{...structuredClone(row),name:'과거 원문',item:{...structuredClone(item),name:'과거 원문',photo:'psblob:'+H,snap:{players:[{id:'retained'}]}}},kind:'conflict',created_at:new Date().toISOString()});
const original=JSON.stringify(fx.lib.get(WT+'|original'));
async function requireBlobRequest(p){let timer;try{await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('scoped cache must request an authorized source')),8000);})]);}finally{clearTimeout(timer);}}
async function cacheTransition(page,context){
 const digest='b'.repeat(24),other='22222222-2222-4222-8222-222222222222';let entered,release,delayed=true,blobRequests=0;
 await context.route('**/rest/v1/ps_blob?**',async route=>{if(!decodeURIComponent(route.request().url()).includes(digest))return route.continue();blobRequests++;if(delayed){entered?.();await new Promise(r=>release=r);}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(delayed?[{h:digest,v:JSON.stringify(photo).slice(1,-1)}]:[])});});
 const old=await page.evaluate(async({digest,photo})=>{await storage.set('ps_blob:'+digest,JSON.stringify(photo).slice(1,-1));return {session:localStorage.getItem('ps_sync_session'),owner:localStorage.getItem('ps_cache_owner_v1'),wid:localStorage.getItem('ps_active_ws')};},{digest,photo});
 for(const [uid,wid] of [[other,WT],[A,WP]]){
  const wait=new Promise(r=>entered=r);await page.evaluate(({digest,WT})=>{window.__cacheResult=null;const raw=JSON.stringify({meta:{emblem:'',emblemRef:digest},players:[]});PSSync.historyApply('scout_tool_v1',raw,{expectedWid:WT,deferSync:true}).then(ok=>window.__cacheResult={ok},()=>window.__cacheResult={ok:false,rejected:true});},{digest,WT});await requireBlobRequest(wait);
  await page.evaluate(({uid,wid})=>{const s=JSON.parse(localStorage.getItem('ps_sync_session'));s.uid=uid;localStorage.setItem('ps_sync_session',JSON.stringify(s));localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));},{uid,wid});release();await page.waitForFunction(()=>window.__cacheResult);
  const result=await page.evaluate(async({uid,wid,digest,A,WT})=>({result:window.__cacheResult,oldScoped:await storage.get('ps_blob:'+A+':'+WT+':'+digest),newScoped:await storage.get('ps_blob:'+uid+':'+wid+':'+digest),legacy:await storage.get('ps_blob:'+digest)}),{uid,wid,digest,A,WT});assert.equal(result.result.ok,false);assert.equal(result.oldScoped,null);assert.equal(result.newScoped,null);assert.equal(result.legacy.value,JSON.stringify(photo).slice(1,-1));
  await page.evaluate(old=>{localStorage.setItem('ps_sync_session',old.session);localStorage.setItem('ps_active_ws',old.wid);localStorage.setItem('ps_cache_owner_v1',old.owner);},old);
 }
 delayed=false;await page.evaluate(({other})=>{const s=JSON.parse(localStorage.getItem('ps_sync_session'));s.uid=other;localStorage.setItem('ps_sync_session',JSON.stringify(s));localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:other,wid:localStorage.getItem('ps_active_ws')}));},{other});
 const beforeRequests=blobRequests;const unseen=await page.evaluate(async({digest,WT})=>{const raw=JSON.stringify({meta:{emblem:'',emblemRef:digest},players:[]});const before=(await storage.get('scout_tool_v1')).value;const ok=await PSSync.historyApply('scout_tool_v1',raw,{expectedWid:WT,deferSync:true});return {ok,before,after:(await storage.get('scout_tool_v1')).value};},{digest,WT});assert.equal(blobRequests-beforeRequests,1,'new account must request authorized source instead of using legacy cache');assert.equal(unseen.ok,false,'missing photo cannot report a complete restore');assert.equal(unseen.after,unseen.before,'missing media preserves the exact current body');assert.equal(unseen.after.includes(photo),false,'new account cannot receive the old cached image');
 await page.evaluate(old=>{localStorage.setItem('ps_sync_session',old.session);localStorage.setItem('ps_active_ws',old.wid);localStorage.setItem('ps_cache_owner_v1',old.owner);},old);
 console.log(JSON.stringify({engine,cacheAccountTeamDelay:true,lateWriteDiscarded:true,legacyPreserved:true,newAccountLegacyInvisible:true}));
}

try{for(const width of (process.env.PS_WIDTH?[+process.env.PS_WIDTH]:[375,393,768,1280])){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:850};const {page,context,logs}=await openApp(fx,size,{browsers,dark:width===393});
 const f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&typeof renderDrillFiles==='function');
 await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());
 await f.locator('#psLibraryRecoveryOpen').click();const dialog=page.getByRole('dialog',{name:'내 보관함 복구'});await dialog.waitFor();await dialog.getByText('과거 원문',{exact:true}).waitFor();
 const layout=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return {left:r.left,right:r.right,width:innerWidth,bg:cs.backgroundColor,fg:cs.color};});assert.ok(layout.left>=0&&layout.right<=layout.width+1,JSON.stringify(layout));assert.notEqual(layout.bg,layout.fg);
 await dialog.getByRole('button',{name:'새 자료로 복구'}).click();await dialog.getByRole('button',{name:'복구됨'}).waitFor();
 const copies=[...fx.lib.values()].filter(r=>r.lib_id!=='original'&&r.workspace_id===WT);assert.equal(copies.length,fx.restoreRequests.size);const restored=copies.at(-1);assert.equal(restored.private,true);assert.equal(restored.folder,'');assert.equal(restored.item.photo,'psblob:'+H);assert.deepEqual(restored.item.pages,item.pages);assert.deepEqual(restored.item.snap,{players:[{id:'retained'}]});assert.equal(JSON.stringify(fx.lib.get(WT+'|original')),original);
 await page.waitForFunction(async id=>{const d=await document.getElementById('fBoard').contentWindow.libGet();return d.some(x=>x.libId===id&&x.photo?.startsWith('data:image/'));},restored.lib_id);
 if(process.env.PS_EVIDENCE_DIR)await page.screenshot({path:process.env.PS_EVIDENCE_DIR+'/library-recovery-'+engine+'-'+width+'.png'});
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await f.locator('#psLibraryRecoveryOpen').evaluate(el=>el===el.ownerDocument.activeElement),true);
 if(width===1280)await cacheTransition(page,context);
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,width,privateCopy:true,originalPreserved:true,pages:2,photoHydrated:true,dialogFits:true,keyboardReturn:true,layout}));await context.close();
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
