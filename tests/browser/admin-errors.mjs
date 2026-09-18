import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results',engine,'admin-errors');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(root,'admin.html'),'utf8'),apiOrigin=html.match(/url:"(https:\/\/[^\"]+)"/)[1];
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',created_at=new Date(Date.now()-60000).toISOString();
const fixtures=[['sync_storage','storage','legacy and IndexedDB values differ'],['sync_storage','storage',"Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing."],['sync_local_changed','storage_source_changed','shared source or owner changed']];
const rows=Array.from({length:1251},(_,i)=>{const [error_code,stage,msg]=fixtures[i%3];return {id:1251-i,error_code,event_name:'sync_failed',status:'error',feature:'sync',device:'tablet',app_version:'test',user_id:uid,created_at,meta:{stage,msg}};});
let browser;
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),calls=[],errors=[];
 await context.addInitScript(({uid})=>localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'synthetic-at',rt:'synthetic-rt',exp:Date.now()+86400000})),{uid});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===base)return route.continue();if(url.origin!==apiOrigin)return route.abort();
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  const send=data=>route.fulfill({status:200,headers,body:JSON.stringify(data)});
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  if(url.pathname.endsWith('/ps_whoami'))return send([{uid,is_admin:true}]);
  if(/\/ps_admin_users(?:_v2)?$/.test(url.pathname))return send([{user_id:uid,name:'가상 관리자',email:'admin@example.invalid'}]);
  if(url.pathname==='/rest/v1/ps_events'&&url.searchParams.get('status')==='eq.error'&&url.searchParams.get('select')?.startsWith('id,')){
   calls.push(url.search);const cursor=(url.searchParams.get('or')||'').match(/id\.lt\.(\d+)/);return send(rows.filter(r=>r.id<(cursor?+cursor[1]:Infinity)).slice(0,Math.min(200,+url.searchParams.get('limit'))));
  }
  return send([]);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/admin.html');await page.locator('[data-admin-tab="errors"]').click();
 await page.waitForFunction(()=>document.querySelector('#errSummary')?.textContent.includes('1,251'));
 assert.equal(calls.length,8);assert.match(await page.locator('#errGroups').innerText(),/저장 기준 사본 충돌/);assert.match(await page.locator('#errGroups').innerText(),/기기 저장소 연결 종료/);assert.match(await page.locator('#errGroups').innerText(),/변경된 작업 재확인/);
 assert.equal(await page.locator('#errGroups thead th').count(),10);assert.equal(await page.locator('#errGroups tbody tr').count(),3);assert.equal(await page.locator('#errGroups tbody tr').first().locator('td').count(),10);
 assert.equal(await page.locator('#errGroups .err-pill').filter({hasText:'sync_storage'}).count(),2);assert.equal(await page.locator('#errGroups .err-pill').filter({hasText:'sync_local_changed'}).count(),1);
 await page.locator('#errSearch').fill('storage_source_changed');assert.equal(await page.locator('#errGroups tbody tr').count(),1);assert.match(await page.locator('#errSummary').innerText(),/417/);
 await page.locator('#errSearch').fill('');await page.locator('#errDays').selectOption('30');await page.waitForFunction(()=>document.querySelector('#errSummary')?.textContent.includes('1,251'));assert.equal(calls.length,16);
 await page.screenshot({path:path.join(out,'errors.png')});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({engine,rows:1251,groups:3,pagesPerLoad:8,errors,fixture:'Synthetic errors only; all external endpoints intercepted.'},null,2));console.log(JSON.stringify({engine,rows:1251,passed:true}));await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
