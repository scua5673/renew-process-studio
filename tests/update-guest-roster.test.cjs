const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sync=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8');
const code=sync.slice(sync.indexOf('function itemsWriteFlush(background){'),sync.indexOf('function itemsWriteConfirmAbsent('));
function fixture(overrides={}){
 const c={Promise,_itemsJobSequence:0,_itemsPending:null,_itemsWritingN:0,getSess:()=>null,localStorage:{getItem:()=>null},itemsStaleAPI:()=>({foreground:()=>Promise.reject(new Error('owner not ready'))}),...overrides};
 vm.createContext(c);vm.runInContext(code,c);return c;
}
test('only the never-edited, fully signed-out roster has nothing to flush',async()=>{
 assert.equal(await fixture().itemsWriteFlush(),true);
 for(const overrides of [{_itemsJobSequence:1},{_itemsPending:{}},{_itemsWritingN:1},{getSess:()=>({uid:'coach'})},{localStorage:{getItem:k=>k==='ps_cache_owner_v1'?'old-owner':null}},{localStorage:{getItem:k=>k==='ps_active_ws'?'team':null}}]){
   await assert.rejects(fixture(overrides).itemsWriteFlush(),/owner not ready/);
 }
});
