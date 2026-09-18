import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Full application with isolated fake accounts and a per-workspace fixture server.
// No provider login, production database, or user browser profile is contacted.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/account-team-switch',engine);
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const publicKey=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_SYNC=\{url:"[^"]+",anonKey:"([^"]+)"/)[1];
fs.mkdirSync(out,{recursive:true});
let base;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const privateAKey='cs_idp_v1_'+A,privateARaw=JSON.stringify({v:1,log:{'2026-09-14':{memo:'SYNTHETIC private account A record'}},imgNotes:[]});
const WA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',WB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',WC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const teams=[{id:WA,kind:'team',name:'가상 빨강 팀',role:'owner',owner_id:A},{id:WB,kind:'personal',name:'가상 파랑 공간',role:'owner',owner_id:A}];
const bTeams=[{id:WC,kind:'personal',name:'가상 초록 계정',role:'owner',owner_id:B}];
const players=(wid)=>[{id:wid+'-player',name:wid===WA?'가상 빨강 선수':wid===WB?'가상 파랑 선수':'가상 초록 선수',grp:'A',type:'ours',posId:'pos_CB',levels:{},profile:{}}];
const db=new Map(),writes=[],errors=[],results=[],calls=[],diagnostics=[],unauthorized=[],telemetry=[];
// All authenticated API calls use real loopback HTTP. On Linux, WebKit can
// report intercepted fetch cancellation during navigation as a native CORS
// pageerror. Preserve real fetch/abort behavior and all strict identity checks.
const reports=[];
async function handleFixtureApi(route){
    const req=route.request(),url=new URL(req.url());
    // Mirror authenticated API preflights explicitly: Authorization is not covered by '*'.
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':base,
      'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'authorization, apikey, content-type, prefer, x-client-info',
      'Vary':'Origin, Access-Control-Request-Headers'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    const authorization=req.headers().authorization,uid=authorization==='Bearer fixture-access-A'?A:authorization==='Bearer fixture-access-B'?B:null;
    // The public community feed deliberately uses the configured publishable key, never a user identity.
    if(!uid&&req.method()==='GET'&&url.pathname==='/rest/v1/ps_community'&&authorization==='Bearer '+publicKey&&req.headers().apikey===publicKey)return route.fulfill({status:200,headers,body:'[]'});
    // storage.js submits error telemetry anonymously. Capture it locally without assigning an account.
    if(!uid&&req.method()==='POST'&&url.pathname==='/rest/v1/ps_err'&&authorization==='Bearer '+publicKey&&req.headers().apikey===publicKey){telemetry.push(...req.postDataJSON());return route.fulfill({status:201,headers,body:''});}
    if(!uid){unauthorized.push({method:req.method(),path:url.pathname});return route.fulfill({status:401,headers,body:'{"error":"unknown synthetic bearer"}'});}
    if(url.pathname==='/rest/v1/rpc/ps_sync_report_put'){
      const report=req.postDataJSON();
      if(!report||(uid===B?report.p_workspace_id!==WC:![WA,WB].includes(report.p_workspace_id))){unauthorized.push({method:req.method(),path:url.pathname,uid});return route.fulfill({status:401,headers,body:'{}'});}
      reports.push({uid,wid:report.p_workspace_id});
    }
    calls.push({uid,method:req.method(),path:url.pathname,search:url.search});
    let body=[];
    if(url.pathname==='/auth/v1/user')body={id:uid,email:uid===B?'b@example.invalid':'a@example.invalid'};
    else if(url.pathname.endsWith('/ps_bootstrap'))body=uid===B?bTeams:teams;
    else if(url.pathname.endsWith('/ps_members_of_v2')||url.pathname.endsWith('/ps_members_of'))body=[{user_id:uid,name:'가상 코치',email:uid===B?'b@example.invalid':'a@example.invalid',role:'owner'}];
    else if(url.pathname.endsWith('/ps_key_scope'))body='team';
    else if(url.pathname==='/rest/v1/ps_kv'){
      const wid=(url.searchParams.get('workspace_id')||'eq.'+WA).slice(3),filter=url.searchParams.get('k');
      const matches=row=>row.workspace_id===wid&&(!filter||filter==='eq.'+row.k||(filter.startsWith('in.(')&&filter.slice(4,-1).split(',').map(k=>k.replace(/^"|"$/g,'')).includes(row.k)));
      if(req.method()==='GET'){
        if(!initialPullDelayed&&filter&&filter.includes('scout_tool_v1')){
          initialPullDelayed=true;
          // Scout prewarming starts at 1.6s. A slow first pull must never create an empty roster.
          await new Promise(resolve=>setTimeout(resolve,2400));
        }
        const cols=(url.searchParams.get('select')||'').split(',').filter(Boolean);
        body=[...db.values()].filter(matches).map(row=>cols.length?Object.fromEntries(cols.map(k=>[k,row[k]])):{...row});
      }
      else if(req.method()==='POST'){
        const posted=req.postDataJSON(),ignore=(req.headers().prefer||'').includes('resolution=ignore-duplicates');
        body=(Array.isArray(posted)?posted:[posted]).filter(row=>!(ignore&&db.has(row.workspace_id+'|'+row.k))).map(row=>{writes.push({uid,wid:row.workspace_id,k:row.k,v:row.v});db.set(row.workspace_id+'|'+row.k,{...row});return row;});
      }else if(req.method()==='PATCH'){
        const patch=req.postDataJSON(),expected=url.searchParams.get('cupd');body=[];
        for(const row of db.values())if(matches(row)&&(!expected||expected==='eq.'+row.cupd)){writes.push({uid,wid,k:row.k,v:patch.v});Object.assign(row,patch);body.push(row);}
      }
    }
    await route.fulfill({status:200,headers,body:JSON.stringify(body)});
}
const fixtureServer=http.createServer(async(req,res)=>{
  try{
    let raw='';for await(const chunk of req)raw+=chunk;
    const request={url:()=>base+req.url,method:()=>req.method,headers:()=>req.headers,postDataJSON:()=>raw?JSON.parse(raw):null};
    await handleFixtureApi({request:()=>request,fulfill:({status=200,headers={},body=''})=>{res.writeHead(status,headers);res.end(body);}});
  }catch(e){if(req.aborted)return;diagnostics.push({type:'fixture-server-error',text:e.message});res.writeHead(500);res.end('{}');}
});
await new Promise(resolve=>fixtureServer.listen(0,'127.0.0.1',resolve));
base='http://127.0.0.1:'+fixtureServer.address().port;
let initialPullDelayed=false;
for(const wid of [WA,WB,WC]){
  const uid=wid===WC?B:A;
  for(const [k,v] of [['scout_tool_v1',{attrs:[],positions:[{id:'pos_CB',name:'CB',targets:{}}],players:players(wid),meta:{evalMode:'fifa'},_items:{build}}],['cs_perms_v1',{members:{[uid]:{role:'executive'}},defaultRole:'player'}],['sq:'+players(wid)[0].id,players(wid)[0]]]){
    db.set(wid+'|'+k,{workspace_id:wid,k,v:JSON.stringify(v),cupd:1000,updated_by:uid});
  }
}
for(const wid of [WA,WB])db.set(wid+'|'+privateAKey,{workspace_id:wid,k:privateAKey,v:privateARaw,cupd:1000,updated_by:A});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
async function bounded(p,label,ms=30000){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
let context,page,profiler;
try{
  context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  await context.addInitScript(({A,WA,teams,base})=>{
    if(location.origin!==base)return;
    if(localStorage.getItem('switch_fixture_seeded'))return;
    localStorage.setItem('switch_fixture_seeded','1');
    localStorage.setItem('ps_sync_session',JSON.stringify({uid:A,at:'fixture-access-A',rt:'fixture-refresh-A',exp:Date.now()+3600000,email:'a@example.invalid'}));
    localStorage.setItem('ps_active_ws',WA);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:A,wid:WA}));
    localStorage.setItem('ps_ws_list',JSON.stringify(teams));
  },{A,WA,teams,base});
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.route(url=>!(url.origin===base&&(url.pathname.startsWith('/rest/v1/')||url.pathname.startsWith('/auth/v1/'))),async route=>{
    const req=route.request(),url=new URL(req.url());
    const isApi=url.pathname.startsWith('/rest/v1/')||url.pathname.startsWith('/auth/v1/');
    if(url.origin!==base)return route.abort('blockedbyclient');
    if(isApi)return route.continue();
    if(!isApi){
      if(url.pathname==='/__fixture__/seed.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic storage seed</title>'});
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      let content=fs.readFileSync(file);
      if(url.pathname==='/studio/app.html'){
        // Exercise real sync/auth against the isolated fixture, never a production API origin.
        const html=content.toString(),configured=html.replace(/(window\.PS_SYNC=\{url:")[^"]+("[,}])/,(_,a,b)=>a+base+b);
        assert.notEqual(configured,html,'fixture API configuration was applied');content=Buffer.from(configured);
      }
      return route.fulfill({body:content,contentType:mime[path.extname(file)]||'application/octet-stream'});
    }

  });
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);diagnostics.push({at:Date.now(),type:'pageerror',text:e.message,stack:e.stack});});
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')diagnostics.push({at:Date.now(),type:m.type(),text:m.text()});});
  async function ready(wid,uid){
    await bounded(page.waitForFunction(({wid,uid})=>window.PSSync&&PSSync.dataUnlocked()&&PSSync.activeWs()===wid&&PSSync.session()?.uid===uid&&PSSync.rosterReady(wid),{wid,uid}),'account ready '+wid,35000);
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    await page.waitForFunction(()=>{try{const frame=document.querySelector('#fScout');return frame?.contentWindow?.scoutBootPending===false;}catch(_){return false;}});
    // Roster readiness is narrower than initial page-save completion: attribute
    // normalization can still be queued in a child frame. Starting a normal
    // switch here races that save and correctly trips the preswitch barrier.
    // Wait on real pending/ACK state, never a fixed delay or ignored save error.
    await page.waitForFunction(()=>{
      const state=PSSync.state();
      if(state.kind!=='ok'||PSSync.pending().count)return false;
      return [...document.querySelectorAll('.frames iframe')].every(frame=>{
        try{const w=frame.contentWindow;return !w?.psHasPending||!w.psHasPending();}catch(_){return false;}
      });
    });
    await page.evaluate(async()=>{await psFlushAllPendingReady();await PSStorage.sharedReady();});
    // Initialization may normalize positions and enqueue a main save. Confirm that final version too.
    await page.waitForFunction(({wid,uid})=>PSSync.session()?.uid===uid&&PSSync.activeWs()===wid&&PSSync.rosterReady(wid),{wid,uid});
    const state=await page.evaluate(async({privateAKey})=>{
      await PSStorage.sharedReady();
      const raw=localStorage.getItem('scout_tool_v1'),stored=await storage.get('scout_tool_v1'),keys=await storage.keys();
      const privateStored=keys.includes(privateAKey)?await storage.get(privateAKey):null;
      return {ids:JSON.parse(raw||'{}').players?.map(p=>p.id)||[],idbIds:JSON.parse(stored?.value||'{}').players?.map(p=>p.id)||[],items:keys.filter(k=>k.startsWith('sq:')),privateIdpKeys:[...new Set([...keys,...Object.keys(localStorage)])].filter(k=>k.startsWith('cs_idp_v1_')),privateA:{local:localStorage.getItem(privateAKey),idb:privateStored?.value??null},owner:JSON.parse(localStorage.getItem('ps_cache_owner_v1')),perms:JSON.parse(localStorage.getItem('cs_perms_v1')||'{}')};
    },{privateAKey});
    fs.writeFileSync(path.join(out,'last-state.json'),JSON.stringify(state,null,2));
    assert.deepEqual(state.ids,players(wid).map(p=>p.id));assert.deepEqual(state.idbIds,state.ids);
    assert.deepEqual(state.items,['sq:'+players(wid)[0].id]);assert.equal(state.owner.uid,uid);assert.equal(state.owner.wid,wid);
    assert.deepEqual(Object.keys(state.perms.members||{}),[uid]);
    assert.ok(state.privateIdpKeys.every(k=>k==='cs_idp_v1_'+uid),'previous account private IDP is absent');
    if(uid===A){for(const raw of Object.values(state.privateA))assert.equal(JSON.parse(raw).log['2026-09-14'].memo,'SYNTHETIC private account A record','account A private record is present in both stores before switching accounts');}
    else assert.deepEqual(state.privateA,{local:null,idb:null},'the previously verified private record is absent after account B login');
    assert.equal(await page.locator('#psWsModal').count(),0,'normal completed entry opens no modal');
    results.push({uid,wid,rosterIsolated:true,permissionsDocumentIsolated:true,privateRecord:uid===A?'A record verified in both stores':'A record absent from both stores'});
    console.log(JSON.stringify({stage:'ready',scenario:results.length,wid}));
  }
  await page.goto(base+'/__fixture__/seed.html');
  await page.evaluate(async({privateAKey,privateARaw})=>{
    localStorage.setItem(privateAKey,privateARaw);
    await new Promise((resolve,reject)=>{const request=indexedDB.open('ps-store',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,t=db.transaction('kv','readwrite');t.objectStore('kv').put(privateARaw,privateAKey);t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};});
  },{privateAKey,privateARaw});
  await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});await ready(WA,A);
  for(const wid of [WB,WA]){
    await page.evaluate(wid=>{PSSync.switchWorkspace(wid).then(result=>{window.__fixtureSwitchResult=result;}).catch(e=>{window.__fixtureSwitchResult={error:e.message};});},wid);
    await ready(wid,A);
  }
  console.log(JSON.stringify({stage:'logout-start'}));
  await page.evaluate(()=>{window.__fixtureLogoutResult='pending';PSSync.signOut().then(result=>{window.__fixtureLogoutResult=result;}).catch(e=>{window.__fixtureLogoutResult={error:e.message};});});
  console.log(JSON.stringify({stage:'logout-requested'}));
  await page.waitForFunction(()=>window.PSSync&&!PSSync.session()&&!PSSync.dataUnlocked());
  console.log(JSON.stringify({stage:'logged-out'}));
  // OAuth returns from a provider document. A hash-only goto in the existing app is not a page load.
  await bounded(page.goto('about:blank'),'leave logged-out document',10000);
  console.log(JSON.stringify({stage:'provider-document'}));
  if(engine==='chromium'&&process.env.PS_PROFILE_LOGIN==='1'){
    profiler=await context.newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');
  }
  await bounded(page.goto(base+'/studio/app.html#access_token=fixture-access-B&refresh_token=fixture-refresh-B&expires_in=3600&token_type=bearer',{waitUntil:'domcontentloaded'}),'OAuth return document');
  console.log(JSON.stringify({stage:'OAuth-return'}));
  await ready(WC,B);
  await page.screenshot({path:path.join(out,'new-account.png')});
  await page.reload({waitUntil:'domcontentloaded'});await ready(WC,B);
  for(const write of writes){
    assert.ok(write.uid===B?write.wid===WC:[WA,WB].includes(write.wid),'writes use the intended account');
    if(write.k==='scout_tool_v1'&&write.v)assert.deepEqual(JSON.parse(write.v).players.map(p=>p.id),players(write.wid).map(p=>p.id),'roster writes stay in their source workspace');
    if(write.k.startsWith('sq:'))assert.equal(write.k,'sq:'+players(write.wid)[0].id,'item writes stay in their source workspace');
    if(write.k.startsWith('cs_idp_v1_'))assert.equal(write.k,'cs_idp_v1_'+write.uid,'private IDP writes stay with their account');
  }
  assert.ok(reports.length>0,'background reports reached the authenticated loopback server');
  assert.deepEqual(unauthorized,[],'all data and auth requests use an exact known synthetic bearer');
  assert.deepEqual(errors.filter(e=>!e.startsWith('ResizeObserver loop')),[]);
  // A failed book asset must expose recovery without discarding saved progress.
  const learning=await context.newPage(),learningErrors=[];
  learning.on('pageerror',e=>learningErrors.push(e.message));
  await learning.route('**/learn-mikl.js',route=>route.abort('failed'));
  await learning.goto(base+'/studio/learning.html',{waitUntil:'load'});
  await learning.locator('#retryLearning').waitFor();
  const savedLearning=await learning.evaluate(()=>localStorage.getItem(KEY));
  await learning.unroute('**/learn-mikl.js');
  await Promise.all([learning.waitForNavigation({waitUntil:'load'}),learning.locator('#retryLearning').click()]);
  assert.equal(await learning.locator('#retryLearning').count(),0);
  assert.equal(await learning.evaluate(()=>localStorage.getItem(KEY)),savedLearning);
  assert.deepEqual(learningErrors,[]);
  await learning.close();
  results.push({scenario:'learning-content-failure-recovery',passed:true});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,engine,results,writeCount:writes.length,telemetry,reports,network:'Auth/data API configured to the same isolated fixture origin; exact anonymous public-feed and telemetry endpoints mocked; all external HTTP and WebSocket requests blocked.'},null,2));
  console.log(JSON.stringify({passed:true,engine,scenarios:results.length,logout:true,otherAccountLogin:true,writeCount:writes.length}));
}catch(e){
  if(profiler){const profile=await bounded(profiler.send('Profiler.stop'),'profile stop',3000).catch(()=>null);if(profile)fs.writeFileSync(path.join(out,'failure-profile.json'),JSON.stringify(profile));}
  const state=await Promise.race([page?.evaluate(async({privateAKey})=>({url:location.href,logoutResult:window.__fixtureLogoutResult,switchResult:window.__fixtureSwitchResult,sync:window.PSSync?.state(),active:window.PSSync?.activeWs(),session:window.PSSync?.session()?.uid,owner:localStorage.getItem('ps_cache_owner_v1'),guard:localStorage.getItem('ps_ws_switch_guard_v1'),meta:localStorage.getItem('ps_sync_meta'),diag:await window.PSSync?.diag(),privateA:{local:localStorage.getItem(privateAKey),idb:(await window.storage?.get(privateAKey))?.value??null}}),{privateAKey}).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve({unresponsive:true}),2000))]);
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,state,errors,diagnostics,unauthorized,telemetry,results,writes,calls},null,2));
  await page?.screenshot({path:path.join(out,'failure.png'),timeout:2000}).catch(()=>{});throw e;
}finally{await context?.close();await browser.close();await new Promise(resolve=>fixtureServer.close(resolve));}
