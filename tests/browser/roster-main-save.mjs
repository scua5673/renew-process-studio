import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/roster-main-save');
const sync=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8'),app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
function section(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return src.slice(i,j);}
const syncHelpers=section(sync,'var IDBK=','/* 워크스페이스 전환 시')+section(sync,"var ITEMP='sq:';",'/* ── 권한 문서 읽기')+section(sync,'function idbRefreshLive(){','/* ══ 1.630 · kv 전송을');
const barriers=section(app,'function psFlushAllPendingReady(){','function psAutoReloadWhenSafe(){')+section(sync,'function flushWorkspaceFrames(){','function workspaceSwitchWriteBarrier(){');
const eventBody=section(sync,'    var seq=++edSeq,key=e.key,newValue=e.newValue;','\n  });\n  function recheckAuth(){');
const base='https://roster-main-save-fixture.invalid',uid='synthetic-main-coach',wid='synthetic-main-team';
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
fs.mkdirSync(out,{recursive:true});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
  if(url.pathname==='/parent.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><script src="/studio/storage.js"></script><div class="frames"><iframe id="fScout" src="/studio/scout.html" style="width:100%;height:800px"></iframe></div>'});
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});
 });
 await context.addInitScript(({uid,wid})=>{
  localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'synthetic-at',rt:'synthetic-rt'}));localStorage.setItem('ps_active_ws',wid);
  localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid,nonce:'synthetic'}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner'}]));
  localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role:'executive'}}}));localStorage.setItem('cs_scout_targets_v1','{"v":1,"players":[]}');
  window.PSSync={dataUnlocked:()=>true,keyReady:()=>true,rosterReady:()=>true,syncNow:async()=>({pushed:0,applied:0})};
  window.PSItems={active:()=>false,write(){},flush:async()=>true};
 },{uid,wid});
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/parent.html',{waitUntil:'domcontentloaded'});
 const frame=await (await page.locator('#fScout').elementHandle()).contentFrame();assert.ok(frame);await frame.waitForURL(base+'/studio/scout.html');await frame.waitForFunction(()=>window.PSStorage&&typeof store!=='undefined');
 await frame.evaluate(async()=>{await PSStorage.sharedReady();await psSaveSharedAsync(TKEY,localStorage.getItem(TKEY));await scPrepare();await store.ready(true);});
 await page.evaluate(({uid,wid})=>{
  Object.assign(window,{IDB_LIVE:{},_idbLiveAt:0,KEYS:['scout_tool_v1'],ITEMS_ACTIVE:false,PERSONAL:{},OWNERKEY:'ps_cache_owner_v1',LIBKEY:'library',TOMBKEY:'tomb',
   edSeq:0,edT:null,editMirrorCommit:Promise.resolve(),editOutboxCommit:Promise.resolve(),switchGen:0,switchWiping:false,externalSwitchFrozen:false,tabReadyUid:uid,tabReadyWid:wid,localSwitchToken:'',
   getSess:()=>JSON.parse(localStorage.getItem('ps_sync_session')),activeWs:()=>localStorage.getItem('ps_active_ws'),dataUnlocked:()=>true,isTeamWs:()=>true,personalWid:()=>'',
   workspaceSwitchGuardRaw:()=>'',workspaceSwitchGuardRead:()=>null,hash:raw=>raw,
   syncIssue:(code,stage,msg)=>Object.assign(Error(msg),{psCode:code,psStage:stage}),syncDiagnostic:(stage,e)=>fixtureDiagnostics.push({stage,message:e.message}),
   currentValueForKey:async k=>(await storage.get(k))?.value??null,outboxMarkForOwner:()=>true,syncNow:()=>{},sleep:ms=>new Promise(r=>setTimeout(r,ms)),fixtureDiagnostics:[],fixtureEvents:[]});
 },{uid,wid});
 await page.addScriptTag({content:syncHelpers+'\n'+barriers+'\nwindow.addEventListener("storage",function(e){if(e.key!=="scout_tool_v1")return;fixtureEvents.push(e.newValue);'+eventBody+'\n});'});
 await frame.evaluate(async()=>{
  data.players=Array.from({length:69},(_,i)=>({id:'p'+i,name:'Synthetic '+i,grp:i<26?'A':i<44?'B':'',type:'ours',posId:'pos_CB',levels:{},profile:{},memo:'current record '+i}));
  data.meta.evalMode='fifa';scMainMigrationPending=false;await psSaveSharedAsync(KEY,JSON.stringify(data));await psSaveSharedAsync(PDKEY,'{}');await store.ready(true);
 });
 await page.evaluate(()=>flushWorkspaceFrames());
 const before=await frame.evaluate(async()=>({main:JSON.parse(localStorage.getItem(KEY)).players.length,idb:JSON.parse((await storage.get(KEY)).value).players.length}));assert.deepEqual(before,{main:69,idb:69});

 // Hold both actual storage queues separately: the child write and the parent
 // storage-event tail. App/workspace barriers must wait for both.
 await page.evaluate(()=>{fixtureBarrierDone=false;fixtureMirrorGate=new Promise(r=>fixtureMirrorRelease=r);editMirrorCommit=fixtureMirrorGate;});
 await frame.evaluate(()=>{
  fixtureSet=storage.set;fixtureWriteStarted=false;fixtureSaveDone=false;
  fixtureWriteGate=new Promise(r=>fixtureWriteRelease=r);
  storage.set=function(k,v){if(k===KEY){fixtureWriteStarted=true;return fixtureWriteGate.then(()=>fixtureSet(k,v));}return fixtureSet(k,v);};
  plTombAdd('p68');data.players=data.players.filter(p=>p.id!=='p68');fixtureAccepted=save({skipTargets:true,skipItems:true});
  fixtureSavePromise=store.ready().then(()=>fixtureSaveDone=true);
 });
 await frame.waitForFunction(()=>fixtureWriteStarted);await page.waitForFunction(()=>fixtureEvents.some(raw=>JSON.parse(raw).players.length===68));
 await page.evaluate(()=>{fixtureBarrier=flushWorkspaceFrames().then(()=>fixtureBarrierDone=true);});
 let pending=await frame.evaluate(async()=>({accepted:fixtureAccepted,done:fixtureSaveDone,main:JSON.parse(localStorage.getItem(KEY)).players.length,idb:JSON.parse((await storage.get(KEY)).value).players.length}));
 assert.deepEqual(pending,{accepted:true,done:false,main:68,idb:69});assert.equal(await page.evaluate(()=>fixtureBarrierDone),false);
 await frame.evaluate(()=>fixtureWriteRelease());await frame.waitForFunction(()=>fixtureSaveDone);
 assert.equal(await page.evaluate(()=>fixtureBarrierDone),false,'parent event/outbox tail still blocks the barrier');
 await page.evaluate(()=>fixtureMirrorRelease());await page.evaluate(()=>fixtureBarrier);
 const durable=await page.evaluate(async()=>({preload:JSON.parse((await kvPreload()).scout_tool_v1).players.length,canonical:idbBacked('scout_tool_v1'),diagnostics:fixtureDiagnostics}));
 assert.equal(durable.preload,68);assert.equal(durable.canonical,true);assert.ok(!durable.diagnostics.some(d=>d.stage==='idbk-missing'&&d.message.includes('scout_tool_v1')));
 const exact=await frame.evaluate(async()=>localStorage.getItem(KEY)===(await storage.get(KEY)).value);assert.equal(exact,true);

 // With a durable-write failure, the existing save tracker and parent barrier
 // must refuse success even if another frame has mirrored the same local raw.
 await frame.evaluate(()=>{
  storage.set=function(k,v){if(k===KEY)return Promise.reject(Error('synthetic main IDB failure'));return fixtureSet(k,v);};
  data.players[0].memo='latest edit awaiting durable confirmation';fixtureAccepted=save({skipTargets:true,skipItems:true});
  fixtureFailed=store.ready().then(()=>false,()=>true);
 });
 assert.equal(await frame.evaluate(()=>fixtureFailed),true);
 assert.equal(await page.evaluate(()=>flushWorkspaceFrames().then(()=>false,()=>true)),true);
 assert.equal(await frame.evaluate(()=>store.hasFailed(KEY)),true);
 await frame.evaluate(async()=>{storage.set=fixtureSet;await store.ready(true);});await page.evaluate(()=>flushWorkspaceFrames());
 assert.equal(await frame.evaluate(async()=>localStorage.getItem(KEY)===(await storage.get(KEY)).value),true);
 assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).players[0].memo),'latest edit awaiting durable confirmation');
 assert.deepEqual(errors,[]);
 const result={engine,initialRoster:69,deletedRoster:68,mainAndIdbExact:true,childAndParentQueuesBothAwaited:true,syncReadsLatestDurableRoster:true,failedWriteBlocksParentBarrier:true,sameRawRetryVerified:true};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();
}finally{await browser.close();}
