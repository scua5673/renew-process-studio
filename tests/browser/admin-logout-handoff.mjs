import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'webkit';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/admin-logout-handoff',engine);fs.mkdirSync(out,{recursive:true});
const UID='99999999-9999-4999-8999-999999999999',WID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let f;try{f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+path.sep))throw 0;res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'}),calls=[];
 await context.addInitScript(({UID,WID})=>{
  if(!localStorage.getItem('ps_sync_session'))localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-at',rt:'synthetic-rt',exp:Date.now()+3600000,email:'fixture@example.invalid'}));
  if(!localStorage.getItem('ps_cache_owner_v1'))localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));
  localStorage.setItem('ps_active_ws',WID);localStorage.setItem('ps_ws_list',JSON.stringify([{id:WID,kind:'personal',name:'가상 작업',role:'owner'}]));
 },{UID,WID});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
  if(!url.pathname.startsWith('/rest/v1/')&&!url.pathname.startsWith('/auth/v1/'))return route.abort('blockedbyclient');
  calls.push({path:url.pathname,method:req.method()});let rows=[];
  if(url.pathname.endsWith('/ps_whoami'))rows=[{uid:UID,email:'fixture@example.invalid',is_admin:true}];
  if(url.pathname.endsWith('/ps_bootstrap'))rows=[{id:WID,kind:'personal',name:'가상 작업',role:'owner'}];
  await route.fulfill({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(rows)});
 });
 const app=await context.newPage();await app.goto(base+'/studio/app.html?account=logout&fixture=handoff',{waitUntil:'domcontentloaded'});
 await app.waitForFunction(()=>window.PSSync&&document.querySelector('#psAcctWrap .acct-pop.on'));
 await app.waitForFunction(()=>!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
 await app.locator('#psAcctWrap .acct-pop.on').waitFor({state:'visible'});
 assert.match(await app.locator('#psAcctWrap .acct-pop').innerText(),/로그아웃/);assert.equal(new URL(app.url()).searchParams.has('account'),false);
 assert.equal(await app.evaluate(()=>PSSync.session().uid),UID);assert.equal(calls.some(c=>c.path==='/auth/v1/logout'),false);
 await app.waitForFunction(()=>PSSync.dataUnlocked()&&localStorage.getItem('ps_last_pull_at'));
 // Background sync replaces account-menu nodes; scroll the currently resolved
 // node synchronously instead of holding it across an animation-frame wait.
 await app.locator('#psAcctWrap .acct-pop').getByRole('button',{name:'로그아웃',exact:true}).evaluate(el=>el.scrollIntoView({block:'nearest'}));
 await app.screenshot({path:path.join(out,'app-handoff.png')});await app.evaluate(()=>window.__psCloseAcctPop());
 const popupEvent=app.waitForEvent('popup');await app.evaluate(url=>window.open(url,'_blank'),base+'/admin.html');const admin=await popupEvent;
 await admin.locator('#app:not(.hide)').waitFor({state:'visible'});await admin.locator('#app header button').filter({hasText:'앱에서 로그아웃'}).click();
 await app.locator('#psAcctWrap .acct-pop.on').waitFor({state:'visible'});assert.match(await admin.locator('#adminSessionLock').innerText(),/아직 로그아웃되지/);
 assert.ok(admin.url().endsWith('/admin.html'));assert.equal(await app.evaluate(()=>PSSync.session().uid),UID);assert.equal(calls.some(c=>c.path==='/auth/v1/logout'),false);
 await admin.screenshot({path:path.join(out,'admin-handoff.png')});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,passed:true,queryConsumed:true,originalAppReused:true,noAutomaticLogout:true,network:'Every auth/data request fulfilled with synthetic fixtures; other external origins blocked.'},null,2));
 console.log(JSON.stringify({engine,passed:true,queryConsumed:true,originalAppReused:true,noAutomaticLogout:true}));await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
