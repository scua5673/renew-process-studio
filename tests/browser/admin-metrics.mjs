import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results',engine,'admin-metrics');fs.mkdirSync(out,{recursive:true});
const apiOrigin=fs.readFileSync(path.join(root,'admin.html'),'utf8').match(/url:"(https:\/\/[^"]+)"/)[1];
const A='99999999-9999-4999-8999-999999999999',U='11111111-1111-4111-8111-111111111111',W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',at=new Date(Date.now()-60000).toISOString();
const people=[{user_id:A,account_name:'관리자',email:'admin@example.test',teams:[]},{user_id:U,member_name:'김코치',email:'coach@example.test',teams:[{workspace_id:W,name:'프로세스FC',kind:'team',owner:true}]}];
const workspaces=[{id:W,name:'프로세스FC',kind:'team',last_kv:at,member_count:1}];
const library=[{workspace_id:W,lib_id:'one',type:'board',name:'가상 작전판',updated_at:at},{workspace_id:W,lib_id:'two',type:'train',name:'가상 훈련',updated_at:at},{workspace_id:W,lib_id:'deleted',name:'삭제된 가상 노트',deleted_at:123,updated_at:at}];
const owners=library.map(r=>({workspace_id:W,lib_id:r.lib_id,owner_id:U,owner_name:'김코치'}));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let browser;const results=[];
try{
 browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 for(const width of [375,393,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],calls=[];let failWorkspace=false,failMembers=false,failContent=false,eventCount=1251;
  await context.addInitScript(({A})=>localStorage.setItem('ps_sync_session',JSON.stringify({uid:A,at:'synthetic-at',rt:'synthetic-rt',exp:Date.now()+86400000})),{A});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();if(url.origin!==apiOrigin)return route.abort();
   const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
   const send=(data,status=200)=>route.fulfill({status,headers,body:JSON.stringify(data)});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   const name=url.pathname.startsWith('/rest/v1/rpc/')?url.pathname.split('/').pop():null,args=req.postDataJSON()||{};calls.push({name,query:url.search});
   const rows=data=>{const offset=+(url.searchParams.get('offset')||0),limit=Math.min(200,+(url.searchParams.get('limit')||1000));return send(data.slice(offset,offset+limit));};
   if(name){
    if(name==='ps_whoami')return send([{uid:A,is_admin:true}]);
    if(name==='ps_admin_workspaces'||name==='ps_admin_users')return send({message:'unavailable legacy query'},503);
    if(name==='ps_admin_activity_ws')return failWorkspace?send({message:'workspace read unavailable'},503):rows(workspaces);
    if(name==='ps_admin_people'||name==='ps_admin_content_owners'){assert.equal(url.search,'','scalar JSON response must not receive row filters');return send(name==='ps_admin_people'?people:owners);}
    if(name==='ps_admin_library')return args.p_wid&&failContent?send({message:'content unavailable'},503):rows(library);
    if(name==='ps_admin_members')return failMembers?send({message:'members unavailable'},503):send([{user_id:U,email:'coach@example.test',role:'owner'}]);
    if(name==='ps_admin_idp_users')return rows([{user_id:U,email:'coach@example.test',idp_last:at,teams:'프로세스FC'}]);
    if(name==='ps_admin_incidents')return send({since_days:26,goal_days:56});
    if(name==='ps_admin_followups_list'||name==='ps_admin_sync_reports_list')return send([]);
    return send([]);
   }
   if(url.pathname==='/rest/v1/ps_events'&&!url.searchParams.has('status')&&!url.searchParams.has('event_name')&&!url.searchParams.has('user_id')){
    const m=(url.searchParams.get('or')||'').match(/id\.lt\.(\d+)/),before=m?+m[1]:Infinity,limit=Math.min(200,+url.searchParams.get('limit'));
    return send(Array.from({length:eventCount},(_,i)=>({id:eventCount-i,event_name:'a_diary',feature:'idp',user_id:U,created_at:at,device:'tablet',app_version:'test',status:'ok'})).filter(r=>r.id<before).slice(0,limit));
   }
   return send([]);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/admin.html');await page.locator('#wsList .wscard').waitFor();
  const home=await page.locator('#viewHome').evaluate(e=>{const hub=e.querySelector('#adminHub').getBoundingClientRect(),ops=e.querySelector('.admin-ops').getBoundingClientRect();return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,hubHeight:hub.height,opsHeight:ops.height,gap:ops.top-hub.bottom};});
  assert.ok(home.scroll<=home.width+1,JSON.stringify(home));assert.ok(home.hubHeight>80&&home.opsHeight>80&&home.gap>=-1,JSON.stringify(home));
  await page.screenshot({path:path.join(out,'home-'+width+'.png')});
  await page.locator('[data-admin-tab="ws"]').click();assert.match(await page.locator('#stats').innerText(),/2[\s\S]*계정[\s\S]*1[\s\S]*공간[\s\S]*1[\s\S]*팀[\s\S]*2[\s\S]*콘텐츠/);
  await page.locator('#wsList .wscard').click();await page.locator('.ws-hero').waitFor();assert.match(await page.locator('#wsDetail').innerText(),/김코치|coach@example/);
  failMembers=true;failContent=true;await page.locator('#wsList .wscard').click();await page.waitForFunction(()=>document.querySelector('#wsDetail')?.textContent.includes('정보만 불러오지 못했습니다'));
  assert.equal(await page.locator('.ws-kpi b').filter({hasText:'확인 못 함'}).count(),4);await page.screenshot({path:path.join(out,'partial-'+width+'.png')});
  await page.locator('[data-admin-tab="users"]').click();assert.match(await page.locator('#usersTable').innerText(),/김코치/);
  await page.locator('[data-admin-tab="use"]').click();await page.waitForFunction(()=>document.querySelector('#useActs')?.textContent.includes('1,251개 이벤트'));
  eventCount=1252;await page.getByRole('button',{name:'↻ 새로고침',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#useActs')?.textContent.includes('1,252개 이벤트'));
  failWorkspace=true;await page.locator('[data-admin-tab="ws"]').click();await page.getByRole('button',{name:'↻ 새로고침',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wsList')?.textContent.includes('팀 정보를 불러오지 못했습니다'));
  assert.match(await page.locator('#stats').innerText(),/확인 못 함[\s\S]*공간/);assert.match(await page.locator('#adminDataStatus').innerText(),/팀 목록/);
  await page.locator('[data-admin-tab="home"]').click();await page.locator('[data-hub-issue="source:workspaces"]').waitFor();
  assert.equal(calls.some(c=>c.name==='ps_admin_workspaces'),false,'broken legacy workspace query is not retried');assert.deepEqual(errors,[]);
  results.push({width,home,usageRows:1252,partialFailureUnknown:true,peopleFallback:true,errors});await context.close();
 }
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({engine,syntheticOnly:true,results},null,2));console.log(JSON.stringify({engine,passed:true,widths:results.map(r=>r.width)}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
