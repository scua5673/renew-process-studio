const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8');
const code=source.slice(source.indexOf('function libLoad(){'),source.indexOf('function libSave('));
function harness(){
 let rev='first',release,parsed=0;
 const result=new Promise(r=>release=r),raw='[{"libId":"fixture","name":"old body"}]';
 const c=vm.createContext({Promise,Array,JSON:{parse(v){parsed++;return JSON.parse(v);}},LIBKEY:'vault',localStorage:{getItem:k=>k==='cs_lib_rev'?rev:raw},window:{storage:{get:()=>result}},syncIssue:(code,stage,message)=>Object.assign(new Error(message),{psCode:code,psStage:stage})});
 vm.runInContext(code,c);return {c,raw,release,edit(){rev='second';},get parsed(){return parsed;}};
}
test('a changed revision while IndexedDB resolves cannot label the old body as new',async()=>{
 const h=harness(),p=h.c.libLoad();h.edit();h.release({value:h.raw});
 await assert.rejects(p,e=>e.psCode==='sync_local_changed');assert.equal(h.parsed,0,'do not parse a stale large snapshot');
});
test('stable revision keeps exact body and accepts an empty vault',async()=>{
 const h=harness(),p=h.c.libLoad();h.release({value:h.raw});const s=await p;
 assert.equal(s.raw,h.raw);assert.equal(s.rev,'first');assert.equal(s.list[0].name,'old body');
 const e=harness(),q=e.c.libLoad();e.release(null);assert.equal((await q).list.length,0);
});
