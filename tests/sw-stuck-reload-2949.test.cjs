'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sw=fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8');
function setup(){
  const stores=new Map(),events={},clients=[],origin='https://fixture.invalid';
  const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {match:async k=>m.has(k)?m.get(k).clone():undefined,put:async(k,v)=>m.set(k,v)};}};
  const ctx={URL,Date,Response,caches,self:{location:{origin},addEventListener:(n,f)=>events[n]=f,clients:{matchAll:async()=>clients}}};
  vm.createContext(ctx);vm.runInContext(sw.match(/^const CACHE = '[^']+';/m)[0]+sw.slice(sw.indexOf('const CLIENT_CACHE'),sw.indexOf('function htmlRelease(url)'))+';this.api={stuckCheck,bindClient,CACHE};',ctx);
  function client(o={}){const c={id:String(clients.length),url:origin+'/studio/app.html',frameType:'top-level',visibilityState:'hidden',focused:false,messages:[],navigate(){throw Error('must never navigate without a document save receipt');},postMessage(m){this.messages.push(m);},...o};clients.push(c);return c;}
  return {api:ctx.api,client,events};
}
test('old visible and hidden clients receive a compatible ready hint, never a forced navigation',async()=>{
  const f=setup(),hidden=f.client(),visible=f.client({visibilityState:'visible',focused:true});
  for(const c of [hidden,visible])await f.api.bindClient(c.id,'process-1.001');
  for(const t of [1e12,1e12+10*60000,1e12+24*3600000])assert.equal(await f.api.stuckCheck(t),2);
  for(const c of [hidden,visible]){assert.equal(c.messages.length,6);assert.equal(c.messages[0].type,'ps-update-available');assert.equal(c.messages[1].type,'ps-sw-progress');assert.equal(c.messages[1].done,c.messages[1].total);}
});
test('current documents, unbound documents, frames and other pages are not notified',async()=>{
  const f=setup(),current=f.client(),none=f.client(),nested=f.client({frameType:'nested'}),admin=f.client({url:'https://fixture.invalid/admin.html'});
  await f.api.bindClient(current.id,f.api.CACHE);for(const c of [nested,admin])await f.api.bindClient(c.id,'process-1.001');
  assert.equal(await f.api.stuckCheck(1e12),0);for(const c of [current,none,nested,admin])assert.equal(c.messages.length,0);
});
test('notifications are bounded and worker queries return only the active release',async()=>{
  const f=setup(),c=f.client();await f.api.bindClient(c.id,'process-1.001');await f.api.stuckCheck(1e12);
  assert.equal(await f.api.stuckCheck(1e12+30000),0);
  const replies=[];f.events.message({data:{type:'ps-release-query'},ports:[{postMessage:x=>replies.push(x)}]});assert.deepEqual(JSON.parse(JSON.stringify(replies)),[{release:f.api.CACHE}]);
  f.events.message({data:{type:'unrelated'},ports:[{postMessage(){throw Error('unexpected');}}]});
});
