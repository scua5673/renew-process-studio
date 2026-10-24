import assert from 'node:assert/strict';
import {startFixture,openApp,WT,A,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={},N=106,K=240;
for(const s of Object.values(SIZES))s.engine=engine;
const art=Array.from({length:K},(_,i)=>`<path d="M${i%40*25} ${Math.floor(i/40)*90}h20v70h-20z" fill="#3e964b"/>`).join('');
for(let i=0;i<N;i++){const item={libId:'thumb-fixture-'+i,type:'board',name:'프로세스FC 합성 보드 '+i,folder:'',tags:[],savedAt:Date.now()-i,createdBy:A,snap:{players:[],drawings:[]},thumb:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><title>rich-fixture-${i}</title>${art}</svg>`};fx.lib.set(WT+'|'+item.libId,{workspace_id:WT,lib_id:item.libId,type:item.type,name:item.name,folder:'',tags:[],pin:false,item,saved_at:item.savedAt,deleted_at:null,owner_id:A,private:true});}
const original=JSON.stringify([...fx.lib.values()].map(x=>x.item));
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
 // Exercise the original legacy renderer too: hiding its panel must not remove its ability to render when visible.
 const visible=await f.evaluate(async()=>{const dock=document.getElementById('libDock');dock.classList.remove('collapsed');dock.style.setProperty('display','flex','important');await renderLibDock();return {boxes:document.getElementById('dockStrip').getClientRects().length,cards:document.querySelectorAll('#dockStrip .ld-card').length,paths:document.querySelectorAll('#dockStrip svg path').length};});
 assert.ok(visible.boxes>0);assert.equal(visible.cards,N);assert.ok(visible.paths>=N*K);
 assert.equal(JSON.stringify([...fx.lib.values()].map(x=>x.item)),original,'browsing and rendering preserve all fixture server originals');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,width,items:N,hiddenSvgNodes:hidden.svgNodes,previewCalls:hidden.calls,distantPreview:true,visibleLegacy:true,sourcePreserved:true}));await context.close();
}}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
