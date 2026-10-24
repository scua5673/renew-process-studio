const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('studio/board.html','utf8'),i=html.indexOf('async function renderLibDock(){'),j=html.indexOf('\nasync function dockAddToSession(',i);assert.ok(i>0&&j>i);
function env({defer=false}={}){
 let boxes=0,reads=0,refresh=0,resolve;
 const strip={getClientRects:()=>Array(boxes).fill({}),innerHTML:'unchanged',appendChild:()=>{}};
 const ctx={document:{createElement:()=>({})},dockFilter:{},psVaultRenderReady:()=>true,renderDrillFiles:()=>refresh++,$:id=>id==='dockStrip'?strip:null,
  psVaultReadForRender:()=>{reads++;return defer?new Promise(r=>resolve=r):Promise.resolve(null);}};
 vm.createContext(ctx);vm.runInContext(html.slice(i,j),ctx);
 return {ctx,strip,setBoxes:n=>boxes=n,resolve:x=>resolve(x),counts:()=>({reads,refresh})};
}
test('hidden legacy dock avoids its read and thumbnails while refreshing the real vault list',async()=>{
 const e=env();await e.ctx.renderLibDock();assert.deepEqual(e.counts(),{reads:0,refresh:1});assert.equal(e.strip.innerHTML,'unchanged');
});
test('closing the dock during an asynchronous read cannot repopulate its hidden thumbnails',async()=>{
 const e=env({defer:true});e.setBoxes(1);const pending=e.ctx.renderLibDock();assert.deepEqual(e.counts(),{reads:1,refresh:1});e.setBoxes(0);e.resolve([]);await pending;assert.equal(e.strip.innerHTML,'unchanged');
});
