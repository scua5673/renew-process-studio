import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/service-worker');
fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync(path.join(root,'sw.js'),'utf8');
let release='1.0',fail=false,unreachable=false;
const server=http.createServer((req,res)=>{
 if(unreachable){req.socket.destroy();return;}
 const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/sw.js'){
  res.setHeader('Content-Type','application/javascript');
  return res.end(original.replace(/const CACHE = 'process-[^']+'/,`const CACHE = 'process-${release}'`).replace(/const CORE = \[[\s\S]*?\n\];/,"const CORE = ['/studio/app.html','/studio/board.html','/studio/asset.js'];").replace(/const OPTIONAL = \[[\s\S]*?\n\];/,'const OPTIONAL = [];'));
 }
 if(fail&&u.pathname==='/studio/asset.js'){res.writeHead(503);return res.end('unavailable');}
 if(u.pathname.endsWith('.js')){res.setHeader('Content-Type','application/javascript');return res.end(`window.fixtureAsset='${release}';`);}
 res.setHeader('Content-Type','text/html');
 res.end(`<!doctype html><title>Release ${release}</title><p id="version">${release}</p><textarea id="draft"></textarea><script>window.fixtureRelease='${release}';</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext(),old=await context.newPage();
 await old.goto(base+'/studio/app.html');
 await old.evaluate(async()=>{await caches.open('unrelated-app-cache');await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await old.reload();await old.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await old.locator('#draft').fill('unsaved synthetic work');
 const readAsset=p=>p.evaluate(async()=>{const r=await fetch('/studio/asset.js');return r.text();});
 assert.match(await readAsset(old),/1\.0/);
 release='2.0';
 await old.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await new Promise(async(resolve,reject)=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});try{await r.update();}catch(e){reject(e);}});});
 assert.equal(await old.locator('#draft').inputValue(),'unsaved synthetic work');
 assert.match(await readAsset(old),/1\.0/,'open editor keeps its own static assets after activation');
 assert.equal(await old.evaluate(()=>fetch('/studio/uncached-lazy.js').then(r=>r.status)),409,'uncached code cannot mix releases');
 await old.evaluate(()=>{const f=document.createElement('iframe');f.src='/studio/board.html?v=1.0';document.body.appendChild(f);});
 const frame=old.frameLocator('iframe');await frame.locator('#version').waitFor();assert.equal(await frame.locator('#version').textContent(),'1.0','late iframe stays on old shell release');
 const fresh=await context.newPage();await fresh.goto(base+'/studio/app.html');assert.equal(await fresh.locator('#version').textContent(),'2.0');assert.match(await readAsset(fresh),/2\.0/);
 const cacheNames=await fresh.evaluate(()=>caches.keys());assert.ok(cacheNames.includes('unrelated-app-cache'));assert.ok(cacheNames.includes('process-1.0'));
 release='3.0';fail=true;
 await fresh.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await new Promise(async(resolve,reject)=>{r.addEventListener('updatefound',()=>{const w=r.installing;w.addEventListener('statechange',()=>{if(w.state==='redundant')resolve();if(w.state==='activated')reject(Error('incomplete worker activated'));});},{once:true});await r.update();});});
 assert.match(await readAsset(fresh),/2\.0/,'failed install keeps the last complete release');
 // WebKit's protocol offline toggle fails navigations before SW dispatch. A dead
 // origin exercises its real offline cache path; an uncached probe must fail.
 unreachable=true;if(engine==='chromium')await context.setOffline(true);
 assert.equal(await fresh.evaluate(()=>fetch('/uncached-offline-probe').then(()=>false,()=>true)),true);
 await fresh.reload();assert.equal(await fresh.locator('#version').textContent(),'2.0','offline reload uses complete cached shell');assert.match(await readAsset(old),/1\.0/);
 unreachable=false;if(engine==='chromium')await context.setOffline(false);await old.reload();assert.equal(await old.locator('#version').textContent(),'2.0','safe reload moves old tab to current release');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,passed:true,cases:['open-editor-version-pinned','late-iframe-pinned','new-document-upgrades','unrelated-cache-preserved','incomplete-install-rejected','offline-reload','safe-reload-upgrades']},null,2));
 console.log(engine+': service worker update passed');await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
