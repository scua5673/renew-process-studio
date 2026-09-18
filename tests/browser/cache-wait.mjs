import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results',engine,'cache-wait');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
// Execute the production cache-wait UI in an isolated shell. The full account/team
// suite separately checks the independent data lock and per-document readiness.
const code=source.slice(source.indexOf('function cacheWipedFlag(){'),source.indexOf('function purgeCopies(){'));
const duration=source.match(/var CACHE_WAIT_MS=(\d+)/)[1];
const server=http.createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html'}).end(`<!doctype html><html lang="ko"><meta charset="utf-8"><body style="margin:0"><div class="frames" style="position:relative;height:90vh;background:#f5f6f8"><button id="open" style="position:absolute;bottom:40px;left:40px" onclick="this.textContent='자료 열림'">확인된 자료 열기</button><div id="psDataLock" hidden>계정 확인 잠금</div></div><script>
var CACHE_WIPE=true,CACHE_FLAG='synthetic-wiped',CACHE_WAIT_MS=${duration},cacheWaitTimer=null;
function getSess(){return {uid:'synthetic'};}function setStatus(){}function renderUI(){}function syncDiagnostic(stage,e){throw e;}
function syncNow(){return new Promise(function(){});}
${code}
</script></body></html>`));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await context.newPage(),other=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await other.goto(base);
 await page.evaluate(()=>{localStorage.setItem(CACHE_FLAG,'1');cacheWaitStart();});
 assert.match(await page.locator('#psCacheWait').innerText(),/팀에서 받는 중/);
 await other.evaluate(()=>localStorage.removeItem(CACHE_FLAG));await page.bringToFront();
 await page.getByText('팀 자료 수신이 지연되고 있어요').waitFor({timeout:8000});
 await page.locator('#open').click({timeout:5000});assert.equal(await page.locator('#open').innerText(),'자료 열림');
 assert.equal(await page.locator('#psDataLock').count(),1);
 await page.getByRole('button',{name:'다시 시도'}).click();
 assert.match(await page.locator('#psCacheWait').innerText(),/팀에서 받는 중/);
 await page.getByText('팀 자료 수신이 지연되고 있어요').waitFor({timeout:8000});
 await page.setViewportSize({width:375,height:812});await page.locator('#open').click({timeout:5000});
 assert.ok(await page.locator('#psCacheWait').evaluate(el=>el.scrollWidth<=document.documentElement.clientWidth));
 await page.screenshot({path:path.join(out,'slow-receipt-mobile.png')});
 await page.evaluate(()=>cacheWaitEnd(true));assert.equal(await page.locator('#psCacheWait').count(),0);
 assert.equal(await page.locator('#psDataLock').count(),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,multiTabTimeout:true,retryTimeout:true,clickThrough:true,mobile:true,errors,passed:true}));await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
