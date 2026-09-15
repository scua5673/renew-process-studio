import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/storage.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(root,'studio/storage.js')));return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Synthetic storage fixture</title><script src="/storage.js"></script>'+(req.url==='/'?'<iframe src="/frame"></iframe>':''));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 const page=await browser.newPage(),errors=[];page.on('console',msg=>{if(msg.text().includes('StorageVerificationError'))errors.push(msg.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.storage&&window.frames[0]?.storage);
 const result=await page.evaluate(async()=>{
  const key='process_coach_v1',values=Array.from({length:100},(_,i)=>JSON.stringify({synthetic:i}));
  const settled=await Promise.allSettled(values.map(v=>storage.set(key,v)));
  const last=(await storage.get(key)).value;
  const across=await Promise.allSettled(Array.from({length:100},(_,i)=>(i%2?window.frames[0]:window).storage.set('scout_tool_v1',JSON.stringify({synthetic:i}))));
  const shared=(await storage.get('scout_tool_v1')).value;
  let rejected=false;try{await storage.set(key,'must-not-write',()=>{throw Object.assign(Error('changed'),{name:'StorageOwnerChangedError'});});}catch(e){rejected=e.name==='StorageOwnerChangedError';}
  return {commits:settled.filter(x=>x.status==='fulfilled').length,last,acrossFrames:across.filter(x=>x.status==='fulfilled').length,shared:JSON.parse(shared),rejected,after:(await storage.get(key)).value};
 });
 assert.equal(result.commits,100);assert.equal(result.last,JSON.stringify({synthetic:99}));assert.equal(result.acrossFrames,100);
 assert.ok(Number.isInteger(result.shared.synthetic));assert.equal(result.rejected,true);assert.equal(result.after,result.last);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,verifiedCommits:200,crossFrameCommits:100,staleOwnerRejected:true,verificationErrors:errors.length}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
