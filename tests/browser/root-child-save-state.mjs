import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {startFixture,openApp,SIZES,WT,OUT,SHOTS,root} from '../fixtures/team-app.mjs';

// Actual shell, child schedule/board, local write barriers and sync. Every API
// and storage fault belongs to the synthetic loopback fixture. The explicit
// stale root-state override is presentation fault injection, never a fake ACK.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';assert.ok(['chromium','webkit'].includes(engine));
SIZES.saveStatus={engine,ctx:{viewport:{width:1280,height:900},deviceScaleFactor:1,hasTouch:engine==='webkit'}};
const KEY='process_coach_v1',browsers={},hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const result={engine,physicalDevice:false,source:Object.fromEntries(['studio/app.html','studio/autosave-status.js','studio/storage.js','studio/sync.js','studio/sync-confirmation.js','studio/process.html','studio/board-draft.js','studio/board.html'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),cases:[],responsive:[],passed:false};
const write=()=>fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(result,null,2)+'\n');
async function until(fn,label,ms=35000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label);}
const init={arg:{traceResize:process.env.PS_TRACE_RESIZE==='1'},fn:({traceResize})=>{
 window.__saveStatusViewportAt=Date.now();window.addEventListener('resize',()=>{window.__saveStatusViewportAt=Date.now();});
 window.__saveStatusLayoutErrors=[];
 if(traceResize&&window.ResizeObserver){const Native=window.ResizeObserver;window.__saveStatusRecentRO=[];
  window.ResizeObserver=class extends Native{constructor(callback){const meta={stack:new Error().stack,targets:[],calls:0};super((entries,observer)=>{meta.calls++;window.__saveStatusRecentRO.push({stack:meta.stack,targets:meta.targets,calls:meta.calls,entries:entries.map(e=>({target:e.target.id||e.target.tagName,width:e.contentRect.width,height:e.contentRect.height}))});if(window.__saveStatusRecentRO.length>12)window.__saveStatusRecentRO.shift();return callback(entries,observer);});this.__saveStatusRO=meta;}observe(target,options){this.__saveStatusRO.targets.push(target.id||target.tagName);return super.observe(target,options);}};
 }
 window.addEventListener('error',e=>{if(e.message==='ResizeObserver loop completed with undelivered notifications.')window.__saveStatusLayoutErrors.push({path:location.pathname,message:e.message,at:Date.now(),width:innerWidth,height:innerHeight,observers:window.__saveStatusRecentRO||[]});});
 // Read-only, test-only protocol tracing. The original methods and their
 // return values stay in control; no receipt or server version is fabricated.
 let confirmation;Object.defineProperty(window,'PSSyncConfirmation',{configurable:true,get:()=>confirmation,set:api=>{
  if(window.top!==window){confirmation=api;return;}
  confirmation={...api,create(d){const proof=api.create(d);let active=null,lastConfirmed;
   window.__saveStatusProofTrace=[];
   window.__saveStatusProofDebug=(key,raw)=>{const m=d.meta();return {candidateEquals:active?.candidate?.raw===raw,candidateVersion:active?.candidate?.version,metaVersion:m.c?.[key],hashEquals:!!m.h&&m.h[key]===d.hash(raw),busy:d.busy(),state:d.state(),ownerCurrent:!!active&&JSON.stringify(active.owner)===JSON.stringify(d.context())};};
   function summary(raw){try{return {length:raw?.length??null,rev:JSON.parse(raw).scheduleRev};}catch{return {length:raw?.length??null};}}
   for(const name of ['begin','edited','observe','ack','finish','confirmedValue']){const original=proof[name];proof[name]=function(...args){
    const value=original.apply(this,args);if(name==='begin')active=value;
    if(name==='edited'&&args[0]!=='process_coach_v1')return value;
    if(name==='observe'&&!(args[3]||[]).includes('process_coach_v1'))return value;
    if(name==='confirmedValue'&&value===lastConfirmed)return value;
    if(name==='confirmedValue')lastConfirmed=value;
    const r=name==='begin'?value:(args[0]&&typeof args[0]==='object'?args[0]:active),candidate=r?.candidate;
    const row={name,seq:r?.seq,invalid:r?.invalid,ownerCurrent:!!r&&JSON.stringify(r.owner)===JSON.stringify(d.context()),candidate:candidate?{version:candidate.version,...summary(candidate.raw)}:null};
    if(name==='ack'){row.requests=(args[1]||[]).filter(x=>x.k==='process_coach_v1').map(x=>({cupd:x.cupd,cas:x._casCupd,missing:x._casMissing,...summary(x.v)}));row.responses=(args[2]||[]).map(xs=>(xs||[]).filter(x=>x.k==='process_coach_v1').map(x=>({cupd:x.cupd,...summary(x.v)})));}
    if(name==='finish'){const x=args[1]||{};row.result={error:x.error,pending:x.pending,held:x.held?.length,skipped:x.skipped?.length,deferred:x.deferred?.length};}
    if(name==='confirmedValue')row.confirmed=value;
    window.__saveStatusProofTrace.push(row);if(window.__saveStatusProofTrace.length>80)window.__saveStatusProofTrace.shift();return value;
   };}return proof;}};
 }});
 const set=Storage.prototype.setItem,put=IDBObjectStore.prototype.put;
 Storage.prototype.setItem=function(k,v){if(this===localStorage&&k==='process_coach_v1'&&localStorage.getItem('qa_save_status_fault')==='both')throw new DOMException('Synthetic small-store quota','QuotaExceededError');return set.apply(this,arguments);};
 IDBObjectStore.prototype.put=function(v,k){if(k==='process_coach_v1'&&this.name==='kv'&&this.transaction.db.name==='ps-store'&&localStorage.getItem('qa_save_status_fault')==='both')throw new DOMException('Synthetic durable-store quota','QuotaExceededError');return put.apply(this,arguments);};
}};
const fx=await startFixture();let page,context,logs=[];
try{
 // Eliminate unrelated first-open match-ID maintenance without hiding saves.
 const initial=JSON.parse(fx.db.get(WT+'|'+KEY).v);
 for(const [w,days] of Object.entries(initial.weeks))for(const [i,d] of days.entries())if(d.board?.sched==='경기')d.mid='save-status-'+w+'-'+i;
 fx.db.get(WT+'|'+KEY).v=JSON.stringify(initial);
 ({page,context,logs}=await openApp(fx,'saveStatus',{browsers,init,phoneStart:true}));page.setDefaultTimeout(20000);
 const tx=page.locator('#psSyncStripTx');
 async function record(name,details={},captured=null){const current=captured||await page.evaluate(()=>({view:window.__psAutosaveView?.(),engine:PSSync.state(),root:PSSaveState.snapshot()}));result.cases.push({name,...details,...current,passed:true});write();console.log(JSON.stringify({engine,case:name,passed:true}));}
 async function shots(label,text){
  for(const width of [375,768,1280]){await page.evaluate(()=>{window.__saveStatusRequestedViewportAt=Date.now();});await page.setViewportSize({width,height:900});await page.waitForFunction(expected=>document.getElementById('psSyncStripTx').textContent===expected,text);
   await page.waitForFunction(async()=>{
    if(Date.now()-Math.max(window.__saveStatusViewportAt||0,window.__saveStatusRequestedViewportAt||0)<220)return false;
    function geometry(){return JSON.stringify([innerWidth,document.body.className,...Array.from(document.querySelectorAll('.frames,.frames>iframe')).filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return [e.id,r.x,r.y,r.width,r.height,e.clientWidth];})]);}
    const before=geometry();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);return before===geometry();
   });
   const box=await page.locator('#psSyncStrip').boundingBox();assert.ok(box&&box.height<=26&&box.x>=0&&box.x+box.width<=width+1);
   result.responsive.push({label,width,geometry:await page.evaluate(()=>({viewport:innerWidth,classes:document.body.className,frames:Array.from(document.querySelectorAll('.frames>iframe')).filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect(),stage=e.contentDocument?.getElementById('stage')?.getBoundingClientRect();return {id:e.id,width:r.width,height:r.height,logical:e.clientWidth,stage:stage&&{width:stage.width,height:stage.height}};})}))});
   await page.screenshot({path:path.join(SHOTS,engine+'-'+width+'-'+label+'.png')});}
 }
 const nav=page.locator('#teamNav [data-team-key="training"]:visible, #teamBottom [data-tb="training"]:visible').first();
 if(!await nav.isVisible())await page.locator('#appSeg [data-team-hub]:visible').click();await nav.click();
 const frame=await(await page.waitForSelector('#fProcess')).contentFrame();
 await frame.waitForFunction(()=>typeof weeksMap==='object'&&window.PSSchedule&&PSSchedule.raw());
 if(!await frame.locator('#weekView').isVisible())await frame.locator('#vtoggle [data-v="week"]').click();await frame.locator('#weekView').waitFor({state:'visible'});
 await until(async()=>await page.evaluate(()=>PSSync.state().kind==='ok'&&PSSync.pending().count===0),'normal fixture bootstrap');
 const slot=await frame.evaluate(()=>Object.values(weeksMap).flatMap(ds=>ds.flatMap(d=>d.trainings||[])).find(t=>t.note==='가상 훈련 화').slot);
 const original=fx.db.get(WT+'|'+KEY).v,note='SYNTHETIC CHILD SAVE STATUS';
 await page.evaluate(()=>localStorage.setItem('qa_save_status_fault','both'));
 await frame.locator('.wks-fill[onclick*="'+slot+'"]').click();await frame.locator('#wfNote').fill(note);await frame.locator('#wfNote').press('Tab');await frame.locator('#sheet .wf-x').click();
 await frame.waitForFunction(()=>PSSaveState.get('schedule')==='failed'&&psHasPending());
 assert.equal(fx.db.get(WT+'|'+KEY).v,original);
 await page.evaluate(()=>{window.__savedActualSyncState=PSSync.state;PSSync.state=()=>({kind:'ok',at:Date.now()+100000,n:0,review:0});window.__psRefreshPushState();});
 await page.waitForFunction(()=>document.getElementById('psSyncStripTx').textContent==='기기에 저장하지 못했어요');
 assert.equal(await page.evaluate(()=>__psAutosaveView().complete),false);
 await shots('actual-local-failure','기기에 저장하지 못했어요');await record('real child quota failure overrides stale root ok',{originalServerHash:hash(original)});
 await page.evaluate(()=>{PSSync.state=window.__savedActualSyncState;delete window.__savedActualSyncState;localStorage.removeItem('qa_save_status_fault');});
 await frame.evaluate(()=>saveNow());await frame.evaluate(()=>psFlushPendingReady());
 await until(async()=>fx.db.get(WT+'|'+KEY).v.includes(note)&&await page.evaluate(()=>PSSync.state().kind==='ok'&&PSSync.pending().count===0),'actual recovered edit and fixture server write');
 // Exercise the normal edit/CAS ACK; never bump the server version or seed a
 // receipt merely to obtain a reassuring label.
 await page.evaluate(()=>PSSync.syncNow('synthetic-normal-cas-confirmation'));
 await until(async()=>await frame.evaluate(key=>{const raw=localStorage.getItem(key);return typeof raw==='string'&&PSSaveState.get('schedule')==='saved'&&!psHasPending()&&parent.PSSync.confirmedValue(key,raw)===true;},KEY),'actual normal-CAS exact schedule ACK');
 await page.evaluate(()=>window.dispatchEvent(new Event('ps-sync-state')));
 const scheduleSaved=await frame.evaluate(async key=>{const local=localStorage.getItem(key),durable=(await storage.peek(key))?.value??null;return {local,durable,state:PSSaveState.get('schedule'),pending:psHasPending(),confirmed:parent.PSSync.confirmedValue(key,local)};},KEY),localRaw=scheduleSaved.local,serverRaw=fx.db.get(WT+'|'+KEY).v;
 assert.equal(localRaw,scheduleSaved.durable);assert.equal(localRaw,serverRaw);assert.equal(scheduleSaved.state,'saved');assert.equal(scheduleSaved.pending,false);assert.equal(scheduleSaved.confirmed,true);
 const scheduleScope={state:scheduleSaved.state,pending:scheduleSaved.pending,confirmed:scheduleSaved.confirmed,localHash:hash(localRaw),idbHash:hash(scheduleSaved.durable),serverHash:hash(serverRaw)};
 const team=page.frames().find(f=>/\/studio\/scout\.html/.test(f.url()));assert.ok(team,'The real team-navigation frame remains loaded');
 const teamScope=await team.evaluate(async()=>{const key='scout_tool_v1',raw=localStorage.getItem(key),disk=(await storage.peek(key))?.value??null;return {state:PSSaveState.get('team'),pending:psHasPending(),exactLocal:raw!==null&&raw===disk,unsupportedReceipt:parent.PSSync.confirmedValue(key,raw)};});
 assert.deepEqual(teamScope,{state:'saved',pending:false,exactLocal:true,unsupportedReceipt:false});
 await page.waitForFunction(()=>__psAutosaveView().text==='기기에 저장됨');assert.equal(await page.evaluate(()=>__psAutosaveView().complete),false);
 await shots('exact-schedule-ack-conservative-root','기기에 저장됨');await record('exact schedule ACK coexists with conservative root for unsupported live team scope',{scheduleScope,teamScope});
 await page.evaluate(()=>window.__psShowApp('board'));
 const board=await(await page.waitForSelector('#fBoard')).contentFrame();
 await board.waitForFunction(()=>window.__psBoardDraft&&_boardPrivateLoaded&&!__boardRestoring&&typeof renderTokens==='function');
 await board.evaluate(()=>{pushUndo();state.players.push({id:'save-status-device-draft',team:'red',num:'88',x:420,y:320});renderTokens();});
 await board.waitForFunction(()=>{const s=__psBoardDraft.snapshot();return s.needed&&s.unsaved&&s.localDurable&&!s.pending&&!s.failed;});
 await page.waitForFunction(()=>__psAutosaveView().text==='보드 초안 · 기기에 저장됨');
 assert.equal(await page.evaluate(()=>__psAutosaveView().complete),false);assert.equal(await board.evaluate(()=>__psBoardDraft.snapshot().serverConfirmed),false);
 await shots('device-only-board-draft','보드 초안 · 기기에 저장됨');
 const draftProof=await page.waitForFunction(()=>{const b=document.getElementById('fBoard').contentWindow.__psBoardDraft.snapshot(),view=__psAutosaveView();if(!b.needed||!b.unsaved||!b.localDurable||b.pending||b.failed||view.text!=='보드 초안 · 기기에 저장됨')return false;return {view,engine:PSSync.state(),root:PSSaveState.snapshot(),draftScope:{needed:b.needed,unsaved:b.unsaved,localDurable:b.localDurable,pending:b.pending,failed:b.failed,serverConfirmed:b.serverConfirmed}};});
 const capturedDraft=await draftProof.jsonValue();await draftProof.dispose();assert.equal(capturedDraft.draftScope.serverConfirmed,false);assert.equal(capturedDraft.view.complete,false);
 await record('unsaved board draft is durable locally without a server claim',{},capturedDraft);
 // A real, current-origin child uses the actual PSSaveState API. Its frame is
 // removed and replaced; late events from the detached document cannot linger.
 await context.route('**/__save_state_child*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><script src="/studio/storage.js"></script><title>Synthetic save-state child</title>'}));
 await page.evaluate(()=>{const f=document.createElement('iframe');f.id='saveStateChild';f.src='/__save_state_child';f.hidden=true;document.body.appendChild(f);});
 let child=await(await page.waitForSelector('#saveStateChild',{state:'attached'})).contentFrame();await child.waitForFunction(()=>!!window.PSSaveState?.snapshot);
 await child.evaluate(()=>PSSaveState.fail('synthetic-child',new Error('Synthetic document failure')));
 await page.waitForFunction(()=>__psAutosaveView().text==='기기에 저장하지 못했어요');
 await page.evaluate(()=>{window.__detachedSaveStateChild=document.getElementById('saveStateChild').contentWindow;document.getElementById('saveStateChild').remove();});
 await page.waitForFunction(()=>__psAutosaveView().text==='보드 초안 · 기기에 저장됨');
 await record('removed child failure no longer overrides the live board draft');
 await page.evaluate(()=>{const f=document.createElement('iframe');f.id='saveStateChild';f.src='/__save_state_child?replacement=1';f.hidden=true;document.body.appendChild(f);});
 child=await(await page.waitForSelector('#saveStateChild',{state:'attached'})).contentFrame();await child.waitForFunction(()=>!!window.PSSaveState?.snapshot);
 await page.waitForFunction(()=>__psAutosaveView().text==='보드 초안 · 기기에 저장됨');await record('replacement document does not inherit the removed child failure');
 await child.evaluate(()=>PSSaveState.fail('synthetic-child',new Error('Synthetic old-owner failure')));
 await page.waitForFunction(()=>__psAutosaveView().text==='기기에 저장하지 못했어요');
 await page.evaluate(()=>{localStorage.setItem('ps_ws_switch_epoch_v1','synthetic-new-owner-epoch');window.__psRefreshPushState();});
 await page.waitForFunction(()=>__psAutosaveView().complete===false&&__psAutosaveView().text!=='기기에 저장하지 못했어요');
 assert.equal(await page.evaluate(()=>__psAutosaveView().complete),false);
 await child.evaluate(()=>window.dispatchEvent(new CustomEvent('ps-save-state',{detail:{scope:'synthetic-child',state:'saved',owner:'stale-synthetic-owner'}})));
 assert.equal(await page.evaluate(()=>__psAutosaveView().complete),false);assert.notEqual(await tx.innerText(),'서버 저장 확인');await record('new owner excludes old child failure and rejects stale success until reload');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);result.passed=true;console.log(JSON.stringify({engine,cases:result.cases.length,passed:true,physicalDevice:false}));
}catch(error){result.error={name:error.name,message:error.message,stack:error.stack};result.logs=logs.slice(-35);
 if(page){result.diagnostics={server:{hash:hash(fx.db.get(WT+'|'+KEY).v),length:fx.db.get(WT+'|'+KEY).v.length,rev:JSON.parse(fx.db.get(WT+'|'+KEY).v).scheduleRev,cupd:fx.db.get(WT+'|'+KEY).cupd},frames:[]};
  for(const f of page.frames())if(/\/studio\/[^/]+\.html/.test(f.url()))result.diagnostics.frames.push(await f.evaluate(async key=>{
   const raw=localStorage.getItem(key),durable=(await window.storage?.peek?.(key))?.value??null,S=window.PSSync||parent.PSSync;
   async function describe(value){let parsed;try{parsed=JSON.parse(value);}catch{}const digest=value===null?null:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');return {hash:digest,length:value?.length??null,rev:parsed?.scheduleRev,editedAt:parsed?.editedAt};}
   const state=window.PSSaveState?.snapshot?.(),documents=[];
   if(state?.scopes?.team)for(const k of ['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1','cs_team_matches_v1']){const local=localStorage.getItem(k),disk=(await window.storage?.peek?.(k))?.value??null;documents.push({key:k,local:await describe(local),durable:await describe(disk),equal:local===disk,confirmedLocal:S?.confirmedValue?.(k,local)});}
   return {path:location.pathname,key,local:await describe(raw),durable:await describe(durable),equal:raw===durable,confirmedLocal:S?.confirmedValue?.(key,raw),confirmedDurable:S?.confirmedValue?.(key,durable),proofDebug:window.__saveStatusProofDebug?.(key,raw),state,pending:window.psHasPending?.(),board:window.__psBoardDraft?.snapshot?.(),documents,view:window.__psAutosaveView?.(),trace:window.__saveStatusProofTrace,layoutErrors:window.__saveStatusLayoutErrors};
  },KEY).catch(e=>({error:e.message})));
  await page.screenshot({path:path.join(SHOTS,engine+'-failure.png')}).catch(()=>{});
 }throw error;}
finally{write();if(context)await context.close();for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
