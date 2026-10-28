import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {diagnosisPage} from '../fixtures/sync-diagnosis-page.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/sync-diagnosis');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  try{
    const pathname=new URL(req.url,'http://fixture').pathname;
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"connect-src 'self'; object-src 'none'");
    if(pathname==='/studio/__storage_preview.html'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(diagnosisPage(root));}
    const f=path.resolve(root,'.'+decodeURIComponent(pathname));if(!f.startsWith(root+path.sep))throw Error();
    res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
  }catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,results=[];let browser;
try{
  const engine=process.env.PS_BROWSER_ENGINE||'chromium';assert.ok(['chromium','webkit'].includes(engine));
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
  for(const spec of [{width:1280,height:900,mode:'light'},{width:393,height:852,mode:'light'},{width:393,height:852,mode:'dark'}]){
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
    await context.route('**/*',route=>{if(route.request().url().startsWith(base+'/'))return route.continue();blocked.push(route.request().url());return route.abort();});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/studio/__storage_preview.html?mode='+spec.mode);
    await page.locator('#psDiagSheet .pd-x').click();
    await page.locator('#fixture-run').click();
    await page.waitForFunction(()=>/^(PASS|FAIL|ERROR)/.test(document.getElementById('fixture-result').textContent),{},{timeout:20000});
    const result=await page.locator('#fixture-result').innerText();assert.match(result,/^PASS 15\b/);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    await page.screenshot({path:path.join(out,spec.width+'-'+spec.mode+'.png')});results.push({...spec,result});await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,results},null,2));console.log(JSON.stringify({engine,passed:results.length}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
