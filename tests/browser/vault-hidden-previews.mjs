import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={},N=106,K=240;
for(const s of Object.values(SIZES))s.engine=engine;
const art=Array.from({length:K},(_,i)=>`<path d="M${i%40*25} ${Math.floor(i/40)*90}h20v70h-20z" fill="#3e964b"/>`).join('');
for(let i=0;i<N;i++){const item={libId:'thumb-fixture-'+i,type:'board',name:'프로세스FC 합성 보드 '+i,folder:'',tags:[],savedAt:Date.now()-i,createdBy:A,snap:{players:[],drawings:[]},thumb:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><title>rich-fixture-${i}</title>${art}</svg>`};fx.lib.set(WT+'|'+item.libId,{workspace_id:WT,lib_id:item.libId,type:item.type,name:item.name,folder:'',tags:[],pin:false,item,saved_at:item.savedAt,deleted_at:null,owner_id:A,private:true});}
const original=JSON.stringify([...fx.lib.values()].map(x=>x.item));
async function hiddenReadLifecycle(f){return f.evaluate(async()=>{
 const fr=window.frameElement,box=document.getElementById('drillFiles'),originalGet=libGet,originalTurn=libTurn,display=fr.style.display;
 const itemIds=()=>Array.from(box.querySelectorAll('.vx-items .vcard'),el=>el.__libId).sort().join('|'),sourceIds=itemIds();
 let reads=0,freshReads=0,hold=null,started=false,release=null,capture=null,active=null;
 const wait=async check=>{const until=Date.now()+8000;while(!check()){if(Date.now()>until)throw Error('vault lifecycle timeout');await new Promise(r=>setTimeout(r,20));}};
 // Attribute physical reads to their queued request. A later auth message legitimately starts its own fresh read.
 libTurn=function(task){const scope=capture;return originalTurn(function(){const prior=active;active=scope;try{return task();}finally{active=prior;}});};
 libGet=async function(){reads++;if(active)active.reads++;const data=await originalGet.apply(this,arguments),gate=hold;if(gate){started=true;await gate;}if(!gate&&fr.getClientRects().length)freshReads++;return data;};
 function mark(name){box.__vxSig=null;box.querySelector('.vault-explorer').dataset.asyncProbe=name;}
 const kept=name=>!!box.querySelector('[data-async-probe="'+name+'"]');
 async function reopen(name){const before=freshReads;fr.style.display=display;await wait(()=>!kept(name));await _libTurnTail;return {freshRead:freshReads>before,rendered:!kept(name),items:box.querySelectorAll('.vx-items .vcard').length,sourceUnchanged:itemIds()===sourceIds};}
 try{
  // A read queued while visible must be reconsidered when its turn actually starts.
  let entered=false;libTurn(()=>new Promise(r=>{release=r;entered=true;}));await wait(()=>entered);
  mark('queued');const queued=renderDrillFiles();fr.style.display='none';release();await queued;
  const q={hidden:fr.getClientRects().length===0,reads,kept:kept('queued')};q.reopened=await reopen('queued');
  // A completed disk read must not replace the DOM after navigation has hidden its frame.
  reads=0;started=false;hold=new Promise(r=>release=r);mark('inflight');const pending=renderDrillFiles();await wait(()=>started);
  fr.style.display='none';hold=null;release();await pending;
  const late={hidden:fr.getClientRects().length===0,reads,kept:kept('inflight')};late.reopened=await reopen('inflight');
  // The same queued path still renders when visible, with all three callers sharing one read.
  reads=0;entered=false;libTurn(()=>new Promise(r=>{release=r;entered=true;}));await wait(()=>entered);
  mark('visible');const controlled={reads:0};capture=controlled;const visible=Promise.all([renderDrillFiles(),renderDrillFiles(),renderDrillFiles()]);capture=null;release();await visible;
  return {queued:q,inflight:late,visible:{reads:controlled.reads,rendered:!kept('visible'),items:box.querySelectorAll('.vx-items .vcard').length,sourceUnchanged:itemIds()===sourceIds}};
 }finally{libGet=originalGet;libTurn=originalTurn;fr.style.display=display;}
});}
try{for(const width of [375,393,768,1280]){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:850};
 const {page,context,logs}=await openApp(fx,size,{browsers});const f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&typeof renderDrillFiles==='function');
 await f.evaluate(()=>{window.__thumbProbeCalls=0;const svg=PSSafe.svg;PSSafe.svg=function(s){if(String(s).includes('rich-fixture-'))window.__thumbProbeCalls++;return svg.apply(this,arguments);};});
 await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());await f.waitForFunction(n=>document.getElementById('dfCount')?.textContent.trim()===n+'개',N);
 await f.waitForFunction(()=>document.querySelector('.vx-preview-thumb svg path'));
 const hidden=await f.evaluate(()=>({calls:window.__thumbProbeCalls,hidden:document.getElementById('dockStrip').getClientRects().length===0,svgNodes:document.querySelectorAll('#dockStrip svg *').length,names:document.getElementById('drillFiles').textContent}));
 assert.equal(hidden.hidden,true);assert.equal(hidden.svgNodes,0,'an invisible legacy panel never allocates the 106 SVG trees');assert.ok(hidden.calls>0&&hidden.calls<6,'only the actual selected preview is sanitized: '+hidden.calls);
 for(let i=0;i<N;i++)assert.ok(hidden.names.includes('프로세스FC 합성 보드 '+i),'main list still contains every source item');
 await f.getByText('프로세스FC 합성 보드 105',{exact:true}).first().click();
 await f.waitForFunction(()=>document.querySelector('.vx-preview-thumb title')?.textContent==='rich-fixture-105');
 assert.equal(await f.locator('.vx-preview-thumb svg path').count(),K,'selecting a distant item still renders its full preview');
 const lifecycle=await hiddenReadLifecycle(f);
 const reopened={freshRead:true,rendered:true,items:N,sourceUnchanged:true};
 assert.deepEqual(lifecycle.queued,{hidden:true,reads:0,kept:true,reopened},'closing before the queued read starts defers all work until reopening');
 assert.deepEqual(lifecycle.inflight,{hidden:true,reads:1,kept:true,reopened},'closing during a read discards its result and reopening reads afresh');
 assert.deepEqual(lifecycle.visible,{reads:1,rendered:true,items:N,sourceUnchanged:true},'the three controlled visible render requests share exactly one physical read and paint every source item');
 if(process.env.PS_EVIDENCE_DIR)await page.screenshot({path:process.env.PS_EVIDENCE_DIR+'/vault-hidden-lifecycle-'+engine+'-'+width+'.png'});
 // Exercise the original legacy renderer too: hiding its panel must not remove its ability to render when visible.
 const visible=await f.evaluate(async()=>{const dock=document.getElementById('libDock');dock.classList.remove('collapsed');dock.style.setProperty('display','flex','important');await renderLibDock();return {boxes:document.getElementById('dockStrip').getClientRects().length,cards:document.querySelectorAll('#dockStrip .ld-card').length,paths:document.querySelectorAll('#dockStrip svg path').length};});
 assert.ok(visible.boxes>0);assert.equal(visible.cards,N);assert.ok(visible.paths>=N*K);
 assert.equal(JSON.stringify([...fx.lib.values()].map(x=>x.item)),original,'browsing and rendering preserve all fixture server originals');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,width,items:N,hiddenSvgNodes:hidden.svgNodes,previewCalls:hidden.calls,distantPreview:true,lifecycle,visibleLegacy:true,sourcePreserved:true}));await context.close();
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
