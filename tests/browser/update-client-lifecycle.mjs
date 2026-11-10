import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8'),client=fs.readFileSync(path.join(root,'studio/update-client.js'),'utf8'),app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
const barrier=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('function psFlushAllPending(){'))+app.slice(app.indexOf('function psUpdateStatus('),app.indexOf('</script>',app.indexOf('function psUpdateStatus(')));
let release='4.001',fail=false;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/sw.js'){res.setHeader('Content-Type','application/javascript');return res.end(worker.replace(/const CACHE = 'process-[^']+'/,`const CACHE = 'process-${release}'`).replace(/const CORE = \[[\s\S]*?\n\];/,"const CORE = ['/studio/app.html','/studio/update-client.js','/asset.js'];").replace(/const OPTIONAL = \[[\s\S]*?\n\];/,'const OPTIONAL = [];'));}
 if(u.pathname==='/sw-manifest.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({release:'process-'+release,files:{}}));}
 if(u.pathname==='/studio/update-client.js'){res.setHeader('Content-Type','application/javascript');return res.end(client);}
 if(u.pathname==='/asset.js'){res.setHeader('Content-Type','application/javascript');if(fail)res.statusCode=503;return res.end('/* asset */');}
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><textarea id="draft"></textarea><p id="version">${release}</p><div id="updBanner"><span id="updMessage"></span><button id="updNow">적용</button><button id="updLater">나중에</button></div><script>window.PS_BUILD='${release}';window.events=[];window.PSSync={session:()=>({uid:'synthetic-coach'}),event:(name,o)=>events.push({name,...o})};${barrier}
 document.getElementById('draft').value=localStorage.getItem('saved')||'';
 window.psFlushAllPendingReady=async()=>{if(window.saveFailure){var e=Error('disk');e.psFrame='fBoard';e.psCode='disk';throw e;}localStorage.setItem('saved',document.getElementById('draft').value);};</script><script src="/studio/update-client.js"></script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({locale:'ko-KR'}),page=await context.newPage();await page.goto(base+'/studio/app.html');
 await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.evaluate(()=>PSUpdateClient.reconcile());
 assert.equal(await page.locator('#version').textContent(),'4.001','first installation does not reload endlessly');
 await page.locator('#draft').fill('사라지면 안 되는 경기 메모');await page.evaluate(()=>window.saveFailure=true);
 release='4.002';await page.evaluate(()=>PSUpdateClient.check(true));await page.waitForFunction(()=>events.some(e=>e.name==='update_downloaded'));
 await page.locator('#updNow').click();await page.waitForFunction(()=>document.getElementById('updMessage').textContent.includes('작전판'));
 assert.equal(await page.locator('#version').textContent(),'4.001');assert.equal(await page.locator('#draft').inputValue(),'사라지면 안 되는 경기 메모');
 await page.evaluate(()=>{window.saveFailure=false;document.getElementById('draft').blur();});
 await Promise.all([page.waitForEvent('framenavigated',{predicate:f=>f===page.mainFrame()}),page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))]);
 await page.waitForFunction(()=>window.PS_BUILD==='4.002');assert.equal(await page.locator('#draft').inputValue(),'사라지면 안 되는 경기 메모');
 // A broken future install is not announced as downloaded and never reloads.
 release='4.003';fail=true;await page.evaluate(()=>PSUpdateClient.check(true));await page.waitForFunction(()=>events.some(e=>e.name==='update_install_failed'));
 assert.equal(await page.locator('#version').textContent(),'4.002');
 fail=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>window.PS_BUILD==='4.003');
 assert.equal(await page.locator('#draft').inputValue(),'사라지면 안 되는 경기 메모');
 console.log(JSON.stringify({engine,passed:true,cases:['first-install','failed-save-keeps-old-document','pageshow-reconciles','save-before-reload','failed-install-keeps-complete-version','online-retry']}));await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
