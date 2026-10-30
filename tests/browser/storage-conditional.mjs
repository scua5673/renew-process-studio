import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),engine=process.env.PS_BROWSER_ENGINE||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/storage.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(root,'studio/storage.js')));return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Synthetic conditional storage</title><script src="/storage.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>typeof window.storage?.setIfValues==='function');
 const result=await page.evaluate(async()=>{
  const cases=[],key='qa-conditional-body',missing='qa-conditional-absent',body='{"synthetic":"B"}',changed='{"synthetic":"C"}';
  const expect=(ok,message)=>{if(!ok)throw new Error(message);},read=async k=>(await storage.peek(k))?.value??null;
  const record=name=>cases.push(name),ownerError=()=>Object.assign(new Error('synthetic owner change'),{name:'StorageOwnerChangedError'});
  let serial=0;const marker=()=>`qa-conditional-marker-${++serial}`;
  async function rejects(work,name){let error;try{await work;}catch(e){error=e;}expect(error&&(!name||error.name===name),'expected rejection '+name);return error;}
  await storage.set(key,body);
  let target=marker(),completed=false;
  const transaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name==='ps-store'&&args[1]==='readwrite')tx.addEventListener('complete',()=>{completed=true;});return tx;};
  try{expect(await storage.setIfValues(target,null,'{"resolution":1}',{[key]:body,[missing]:null},()=>true)===true,'matching conditions commit');expect(completed,'receipt waits for actual transaction completion');}
  finally{IDBDatabase.prototype.transaction=transaction;}
  expect(await read(target)==='{"resolution":1}'&&await read(key)===body&&await read(missing)===null,'only the marker was written');record('all exact conditions and missing keys commit one marker after transaction completion');
  expect(await storage.setIfValues(target,null,'wrong',{[key]:body},()=>true)===false,'target mismatch returns false');expect(await read(target)==='{"resolution":1}','target preimage is retained');record('target mismatch preserves existing marker');
  target=marker();expect(await storage.setIfValues(target,null,'wrong',{[key]:changed},()=>true)===false,'body mismatch returns false');expect(await read(target)===null&&await read(key)===body,'mismatch writes nothing');record('changed pinned body prevents marker');
  const prepared=await read(key);await storage.set(key,changed);target=marker();expect(await storage.setIfValues(target,null,'wrong',{[key]:prepared},()=>true)===false,'prepare B then C is rejected');expect(await read(target)===null&&await read(key)===changed,'C survives unchanged');record('prepare B then later C never resolves B');
  target=marker();const checks={[key]:changed},pending=storage.setIfValues(target,null,'captured',checks,()=>true);checks[key]='mutated by caller';expect(await pending===true&&await read(target)==='captured','conditions were captured at invocation');record('caller mutation cannot replace captured conditions');
  target=marker();await rejects(storage.setIfValues(target,null,'wrong',{[key]:changed},()=>{throw ownerError();}),'StorageOwnerChangedError');expect(await read(target)===null,'stale owner inserts nothing');
  await rejects(storage.setIfValues(target,null,'wrong',{[key]:changed},()=>false),'StorageOwnerChangedError');record('throwing and false owner guards reject');
  const put=IDBObjectStore.prototype.put;
  target=marker();let wrote=false;
  IDBObjectStore.prototype.put=function(value,k){if(k===target)wrote=true;return put.apply(this,arguments);};
  try{await rejects(storage.setIfValues(target,null,'must abort',{[key]:changed},()=>{if(wrote)throw ownerError();}),'StorageOwnerChangedError');}
  finally{IDBObjectStore.prototype.put=put;}
  expect(wrote&&await read(target)===null&&await read(key)===changed,'owner rejection during readback aborts marker write');record('owner change after put aborts the same transaction');
  target=marker();IDBObjectStore.prototype.put=function(value,k){if(k===target)throw new DOMException('Synthetic marker quota','QuotaExceededError');return put.apply(this,arguments);};
  try{await rejects(storage.setIfValues(target,null,'quota',{[key]:changed},()=>true),'QuotaExceededError');}
  finally{IDBObjectStore.prototype.put=put;}
  expect(await read(target)===null&&await read(key)===changed,'IO rejection leaves sources unchanged');record('actual request-path IO failure rejects without marker');
  target=marker();IDBObjectStore.prototype.put=function(value,k){return put.call(this,k===target?'synthetic corrupt readback':value,k);};
  try{await rejects(storage.setIfValues(target,null,'exact expected marker',{[key]:changed},()=>true),'StorageVerificationError');}
  finally{IDBObjectStore.prototype.put=put;}
  expect(await read(target)===null,'wrong readback aborts even the substituted marker');record('exact readback mismatch aborts marker transaction');
  let accessorCalls=0;const accessor={};Object.defineProperty(accessor,key,{enumerable:true,get(){accessorCalls++;return changed;}});
  const hidden={};Object.defineProperty(hidden,key,{value:changed});
  const symbol={[Symbol('synthetic')]:changed};
  for(const bad of [null,[],Object.create({inherited:changed}),accessor,hidden,symbol,JSON.parse('{"__proto__":null}'),{constructor:null},{prototype:null},{[key]:{} }])await rejects(storage.setIfValues(marker(),null,'bad',bad,()=>true),'TypeError');
  expect(accessorCalls===0,'validation must not evaluate an accessor');
  target=marker();await rejects(storage.setIfValues(target,null,'bad',{[target]:null},()=>true),'TypeError');
  await rejects(storage.setIfValues('__proto__',null,'bad',{},()=>true),'TypeError');
  await rejects(storage.setIfValues(marker(),undefined,'bad',{},()=>true),'TypeError');
  await rejects(storage.setIfValues(marker(),null,null,{},()=>true),'TypeError');
  await rejects(storage.setIfValues(marker(),null,'bad',{},undefined),'TypeError');record('malformed descriptors, prototypes, values and duplicate target fail closed');
  const empty=Object.create(null);target=marker();expect(await storage.setIfValues(target,null,'null-prototype checks',empty,()=>true)===true,'null-prototype dictionary is accepted');record('null-prototype check dictionaries are supported');
  expect(await read(key)===changed&&await read(missing)===null,'all checked bodies remain unchanged');
  return {cases,sourceUntouched:true};
 });
 assert.equal(result.cases.length,11);assert.equal(result.sourceUntouched,true);console.log(JSON.stringify({engine,...result}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
