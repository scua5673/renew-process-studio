import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
const code=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('/* ⚠ 2.395'))+app.slice(app.indexOf('function psUpdateStatus('),app.indexOf('</script>',app.indexOf('function psUpdateStatus(')));
const html=`<!doctype html><meta charset="utf-8"><textarea id="draft"></textarea><div id="updBanner" style="display:none"><span id="updMessage">새 판이 있어요</span><button id="updNow">다시 열기</button><button id="updLater">나중에</button></div><button id="retry">자동 저장 재확인</button><script>${code}\nwindow.psFlushAllPendingReady=()=>Promise.reject(Error('fixture storage failure'));document.getElementById('draft').focus();psAutoReloadWhenSafe();psShowUpdBand();document.getElementById('retry').onclick=()=>window.__psForceReload();</script>`;
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
 const page=await context.newPage();await page.goto('https://update-notice.invalid/');
 await page.locator('#draft').fill('보존할 작성 내용');await page.locator('#updNow').click();
 await page.waitForFunction(()=>document.getElementById('updMessage').textContent.includes('확인하지 못해'));
 assert.equal(await page.locator('#updNow').isEnabled(),true);assert.equal(await page.locator('#draft').inputValue(),'보존할 작성 내용');
 await page.locator('#updLater').click();assert.equal(await page.locator('#updBanner').isVisible(),false);
 for(let i=0;i<3;i++){await page.locator('#retry').click();await page.waitForFunction(()=>!window.__psReloading);assert.equal(await page.locator('#updBanner').isVisible(),false);}
 assert.equal(await page.locator('#draft').inputValue(),'보존할 작성 내용');
 console.log(JSON.stringify({engine,passed:true,cases:['manual-failure-explained','later-survives-repeated-failures','draft-preserved']}));await context.close();
}finally{await browser.close();}
