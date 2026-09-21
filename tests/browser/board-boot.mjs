import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
const boot=app.slice(app.indexOf('    var bootFinished=false;'),app.indexOf('    var hints='));
const reload=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('/* ⚠ 2.395'))+app.slice(app.indexOf('function psUpdateStatus('),app.indexOf('</script>',app.indexOf('function psUpdateStatus(')));
const css=app.split('\n').filter(line=>line.trim().startsWith('#loading.ps-boot-screen')&&(line.includes('span')||line.includes('button'))).join('\n');
const html=`<!doctype html><meta charset="utf-8"><style>${css}\nbody.ps-booting iframe{visibility:hidden}#loading.ps-boot-done{display:none}</style><body class="ps-booting"><div id="loading" class="ps-boot-screen"><span id="psBootMessage">불러오는 중…</span><button id="psBootRetry">다시 열기</button></div><iframe id="board" src="/board"></iframe><script>var fBoard=document.getElementById('board'),loading=document.getElementById('loading');${reload}\n${boot}\nwindow.__psShellBootReady=true;window.psFlushAllPendingReady=()=>Promise.reject(Error('fixture write failure'));</script>`;
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 let release;const gate=new Promise(r=>release=r);
 await context.route('**/*',async route=>{
  if(new URL(route.request().url()).pathname==='/board'){
   await gate;await route.fulfill({contentType:'text/html',body:'<!doctype html><textarea id="draft">보존할 작성 내용</textarea><button id="ready" onclick="window.__boardReadySent=true">복원 완료</button>'});
  }else await route.fulfill({contentType:'text/html',body:html});
 });
 const page=await context.newPage();let mainNavigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())mainNavigations++;});
 await page.goto('https://board-boot.invalid/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('loading').classList.contains('ps-boot-slow'));
 assert.equal(await page.locator('#board').isVisible(),false);
 assert.equal(await page.locator('#psBootMessage').isVisible(),true);
 assert.equal(await page.locator('#psBootRetry').isVisible(),true);
 release();await page.frameLocator('#board').locator('#draft').waitFor({state:'attached'});
 // A loaded frame is not a restored board. Missing postMessage is recovered only from the real flag.
 await page.waitForTimeout(700);assert.equal(await page.locator('#board').isVisible(),false);
 await page.locator('#psBootRetry').click();
 await page.waitForFunction(()=>document.getElementById('psBootMessage').textContent.includes('확인하지 못해'));
 assert.equal(await page.locator('#psBootRetry').isEnabled(),true);
 assert.equal(mainNavigations,1);assert.equal(await page.frameLocator('#board').locator('#draft').inputValue(),'보존할 작성 내용');
 await page.frameLocator('#board').locator('#ready').evaluate(el=>el.click());
 await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
 assert.equal(await page.locator('#board').isVisible(),true);
 assert.equal(await page.locator('#loading').isVisible(),false);
 console.log(JSON.stringify({engine,passed:true,cases:['slow-frame-hidden-after-five-seconds','loaded-frame-waits-for-restore','failed-save-prevents-reload','draft-preserved','ready-flag-recovers-lost-message']}));await context.close();
}finally{await browser.close();}
