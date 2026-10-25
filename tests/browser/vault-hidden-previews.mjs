import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,WT,A,SIZES,OUT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={},N=106,K=240;
for(const s of Object.values(SIZES))s.engine=engine;
const art=Array.from({length:K},(_,i)=>`<path d="M${i%40*25} ${Math.floor(i/40)*90}h20v70h-20z" fill="#3e964b"/>`).join('');
for(let i=0;i<N;i++){const item={libId:'thumb-fixture-'+i,type:'board',name:'프로세스FC 합성 보드 '+i,folder:'',tags:[],savedAt:Date.now()-i,createdBy:A,snap:{players:[],drawings:[]},thumb:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><title>rich-fixture-${i}</title>${art}</svg>`};fx.lib.set(WT+'|'+item.libId,{workspace_id:WT,lib_id:item.libId,type:item.type,name:item.name,folder:'',tags:[],pin:false,item,saved_at:item.savedAt,deleted_at:null,owner_id:A,private:true});}
const original=JSON.stringify([...fx.lib.values()].map(x=>x.item));
async function hiddenReadLifecycle(f){return f.evaluate(async()=>{
 const fr=window.frameElement,box=document.getElementById('drillFiles'),originalGet=libGet,originalTurn=libTurn,display=fr.style.display;
 const itemIds=()=>Array.from(box.querySelectorAll('.vx-items .vcard'),el=>el.__libId).sort().join('|'),sourceIds=itemIds(),trace=[];
 let reads=0,completed=0,hold=null,started=false,release=null,capture=null,active=null,sequence=0,phase='setup',seeded=false;
 const controlled={name:'controlled-three',reads:0},authRefresh={name:'seeded-auth',reads:0};
 const record=(event,extra={})=>trace.push({event,phase,ms:performance.now(),hidden:fr.getClientRects().length===0,...extra});
 // Scope belongs to the enqueueing producer. libGet is counted at its physical
 // entry, before any await; an auth event after that entry needs a fresh job.
 libTurn=function(task){const scope=capture,job={id:++sequence,scope:scope?.name||'unrelated',stack:new Error().stack};record('queue',job);
  return originalTurn(function(){const prior=active;active={scope,job};record('start',job);try{return task();}finally{active=prior;}});};
 const wait=async check=>{const until=Date.now()+8000;while(!check()){if(Date.now()>until)throw Error('vault lifecycle timeout');await new Promise(r=>setTimeout(r,20));}};
 libGet=async function(){reads++;const job=active?.job;if(active?.scope)active.scope.reads++;record('physical-read',{reads,job,stack:new Error().stack});
  if(active?.scope===controlled&&!seeded){seeded=true;queueMicrotask(()=>{record('seed-auth-state');capture=authRefresh;try{window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:true}}));}finally{capture=null;}});}
  const data=await originalGet.apply(this,arguments);if(hold){started=true;await hold;}completed++;record('read-complete',{job});return data;};
 function mark(name){phase=name;box.__vxSig=null;box.querySelector('.vault-explorer').dataset.asyncProbe=name;}
 const kept=name=>!!box.querySelector('[data-async-probe="'+name+'"]');
 async function reopen(name){phase=name+'-reopen';const before=completed;fr.style.display=display;await wait(()=>!kept(name));await _libTurnTail;
  return {freshCompletedRead:completed>before,items:box.querySelectorAll('.vx-items .vcard').length,sourceUnchanged:itemIds()===sourceIds};}
 try{
  // A read queued while visible must be reconsidered when its turn actually starts.
  // A visible startup read can still be ahead of this probe in libTurn. Count
  // only after the barrier is entered, rather than attributing setup work to
  // the subsequent hidden render. Seed that case so it is exercised locally.
  libTurn(()=>libGet());
  let entered=false;libTurn(()=>new Promise(r=>{release=r;entered=true;}));await wait(()=>entered);reads=0;
  mark('queued');const queued=renderDrillFiles();fr.style.display='none';release();await queued;
  const q={hidden:fr.getClientRects().length===0,reads,kept:kept('queued')};const queuedReopen=await reopen('queued');q.reopenReads=reads;
  // A completed disk read must not replace the DOM after navigation has hidden its frame.
  reads=0;started=false;hold=new Promise(r=>release=r);mark('inflight');const pending=renderDrillFiles();await wait(()=>started);
  fr.style.display='none';hold=null;release();await pending;
  const late={hidden:fr.getClientRects().length===0,reads,kept:kept('inflight')};const inflightReopen=await reopen('inflight');late.reopenReads=reads;
  // The same queued path still renders when visible, with all three callers sharing one read.
  // Enqueue all three inside the running barrier, before it returns. This avoids
  // a timer gap where an unrelated request could own an already queued read.
  entered=false;let visible;libTurn(function(){reads=0;mark('visible');capture=controlled;
   try{visible=Promise.all([renderDrillFiles(),renderDrillFiles(),renderDrillFiles()]);}finally{capture=null;}
   record('controlled-queued',{physicalReads:controlled.reads});entered=true;
  });await wait(()=>entered);await visible;await _libTurnTail;
  return {queued:q,queuedReopen,inflight:late,inflightReopen,allVisibleReads:reads,trace,visible:{reads:controlled.reads,authReads:authRefresh.reads,rendered:!kept('visible'),items:box.querySelectorAll('.vx-items .vcard').length,sourceUnchanged:itemIds()===sourceIds}};
 }finally{window.__qaVaultLifecycleTrace=trace;libGet=originalGet;libTurn=originalTurn;fr.style.display=display;}
});}
try{for(const width of [375,393,768,1280]){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:850};
 const {page,context,logs}=await openApp(fx,size,{browsers});let f,lifecycle;
 try{
 f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&typeof renderDrillFiles==='function');
 await f.evaluate(()=>{window.__thumbProbeCalls=0;const svg=PSSafe.svg;PSSafe.svg=function(s){if(String(s).includes('rich-fixture-'))window.__thumbProbeCalls++;return svg.apply(this,arguments);};});
 await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());await f.waitForFunction(n=>document.getElementById('dfCount')?.textContent.trim()===n+'개',N);
 await f.waitForFunction(()=>document.querySelector('.vx-preview-thumb svg path'));
 const hidden=await f.evaluate(()=>({calls:window.__thumbProbeCalls,hidden:document.getElementById('dockStrip').getClientRects().length===0,svgNodes:document.querySelectorAll('#dockStrip svg *').length,names:document.getElementById('drillFiles').textContent}));
 assert.equal(hidden.hidden,true);assert.equal(hidden.svgNodes,0,'an invisible legacy panel never allocates the 106 SVG trees');assert.ok(hidden.calls>0&&hidden.calls<6,'only the actual selected preview is sanitized: '+hidden.calls);
 for(let i=0;i<N;i++)assert.ok(hidden.names.includes('프로세스FC 합성 보드 '+i),'main list still contains every source item');
 await f.getByText('프로세스FC 합성 보드 105',{exact:true}).first().click();
 await f.waitForFunction(()=>document.querySelector('.vx-preview-thumb title')?.textContent==='rich-fixture-105');
 assert.equal(await f.locator('.vx-preview-thumb svg path').count(),K,'selecting a distant item still renders its full preview');
 lifecycle=await hiddenReadLifecycle(f);
 // Reopening can also trigger a focus/auth refresh on Linux WebKit. Its extra
 // visible read is valid; the deferred path must perform none while hidden and
 // must read afresh on return. The explicit three-caller probe below separately
 // verifies read coalescing without counting unrelated visibility events.
 const {reopenReads:queuedReopen,...queuedHidden}=lifecycle.queued;
 assert.deepEqual(queuedHidden,{hidden:true,reads:0,kept:true},'closing before the queued read starts defers all work');
 assert.ok(queuedReopen>queuedHidden.reads,'reopening performs the deferred read');
 assert.deepEqual(lifecycle.queuedReopen,{freshCompletedRead:true,items:N,sourceUnchanged:true},'queued reopening completes a fresh read and restores every source item');
 const {reopenReads:inflightReopen,...inflightHidden}=lifecycle.inflight;
 assert.deepEqual(inflightHidden,{hidden:true,reads:1,kept:true},'closing during a read discards its result');
 assert.ok(inflightReopen>inflightHidden.reads,'reopening reads afresh after discarding the hidden result');
 assert.deepEqual(lifecycle.inflightReopen,{freshCompletedRead:true,items:N,sourceUnchanged:true},'in-flight reopening completes a fresh read and restores every source item');
 assert.equal(lifecycle.trace.find(e=>e.event==='controlled-queued')?.physicalReads,0,'the three controlled requests are queued before any physical read starts');
 assert.deepEqual(lifecycle.visible,{reads:1,authReads:1,rendered:true,items:N,sourceUnchanged:true},'three controlled renders share exactly one physical read; the independent auth cohort reads once and every source item remains');
 if(process.env.PS_EVIDENCE_DIR)await page.screenshot({path:process.env.PS_EVIDENCE_DIR+'/vault-hidden-lifecycle-'+engine+'-'+width+'.png'});
 // Exercise the original legacy renderer too: hiding its panel must not remove its ability to render when visible.
 const visible=await f.evaluate(async()=>{const dock=document.getElementById('libDock');dock.classList.remove('collapsed');dock.style.setProperty('display','flex','important');await renderLibDock();return {boxes:document.getElementById('dockStrip').getClientRects().length,cards:document.querySelectorAll('#dockStrip .ld-card').length,paths:document.querySelectorAll('#dockStrip svg path').length};});
 assert.ok(visible.boxes>0);assert.equal(visible.cards,N);assert.ok(visible.paths>=N*K);
 assert.equal(JSON.stringify([...fx.lib.values()].map(x=>x.item)),original,'browsing and rendering preserve all fixture server originals');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 fs.writeFileSync(path.join(OUT,`vault-hidden-lifecycle-${engine}-${width}.json`),JSON.stringify({engine,width,lifecycle,sourcePreserved:true},null,2));
 const {trace,...summary}=lifecycle;console.log(JSON.stringify({engine,width,items:N,hiddenSvgNodes:hidden.svgNodes,previewCalls:hidden.calls,distantPreview:true,lifecycle:summary,visibleLegacy:true,sourcePreserved:true}));
 }catch(error){
  const trace=lifecycle?.trace||await f?.evaluate(()=>window.__qaVaultLifecycleTrace||[]).catch(()=>[]);
  fs.writeFileSync(path.join(OUT,`vault-hidden-lifecycle-${engine}-${width}-failure.json`),JSON.stringify({engine,width,error:error.stack,lifecycle,trace,logs,sourcePreserved:JSON.stringify([...fx.lib.values()].map(x=>x.item))===original},null,2));
  await page.screenshot({path:path.join(OUT,`vault-hidden-lifecycle-${engine}-${width}-failure.png`)}).catch(()=>{});throw error;
 }finally{await context.close();}
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
