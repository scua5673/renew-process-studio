import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Full application with isolated fake accounts and a per-workspace fixture server.
// No provider login, production database, or user browser profile is contacted.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/oauth-same-document',engine);
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const publicKey=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_SYNC=\{url:"[^"]+",anonKey:"([^"]+)"/)[1];
const configuredAuth=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_SYNC=\{url:"([^"]+)"/)[1],fixtureAuth='https://synthetic-auth.invalid';
fs.mkdirSync(out,{recursive:true});
const base='https://account-team-fixture.invalid';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const privateAKey='cs_idp_v1_'+A,privateARaw=JSON.stringify({v:1,log:{'2026-09-14':{memo:'SYNTHETIC private account A record'}},imgNotes:[]});
const WA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',WB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',WC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const teams=[{id:WA,kind:'team',name:'가상 빨강 팀',role:'owner',owner_id:A},{id:WB,kind:'personal',name:'가상 파랑 공간',role:'owner',owner_id:A}];
const bTeams=[{id:WC,kind:'personal',name:'가상 초록 계정',role:'owner',owner_id:B}];
const players=(wid)=>[{id:wid+'-player',name:wid===WA?'가상 빨강 선수':wid===WB?'가상 파랑 선수':'가상 초록 선수',grp:'A',type:'ours',posId:'pos_CB',levels:{},profile:{}}];
const db=new Map(),writes=[],errors=[],errorDetails=[],results=[],calls=[],diagnostics=[],unauthorized=[],telemetry=[],attemptedRequests=[],blockedRequests=[],failedRequests=[];
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
// WebKit rejects even route.fulfill navigation when its transport is offline.
// Its fallback proxy accepts loopback connections only and destroys every one;
// it has no forwarding code or outbound socket, and no proxy bypass is enabled.
let rejectProxy=null,rejectedProxyConnections=0;
if(engine==='webkit'){
  rejectProxy=net.createServer(socket=>{rejectedProxyConnections++;socket.destroy();});
  await new Promise((resolve,reject)=>{rejectProxy.once('error',reject);rejectProxy.listen(0,'127.0.0.1',resolve);});
}
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}),...(rejectProxy?{proxy:{server:'http://127.0.0.1:'+rejectProxy.address().port}}:{})});
let context,page,profiler;
try{
  context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',timezoneId:'Asia/Seoul',offline:!rejectProxy});
  // The app sees online because its fixture responses are fulfilled locally.
  // Transport is offline (Chromium) or restricted to the rejecting proxy
  // (WebKit); neither mode can contact the real authentication/data service.
  await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true}));
  context.on('request',req=>{const u=new URL(req.url());attemptedRequests.push({method:req.method(),origin:u.origin,path:u.pathname});});
  context.on('requestfailed',req=>{const u=new URL(req.url());failedRequests.push({origin:u.origin,path:u.pathname,error:req.failure()?.errorText});});
  await context.addInitScript(({A,WA,teams,base})=>{
    if(location.origin!==base)return;
    if(localStorage.getItem('switch_fixture_seeded'))return;
    localStorage.setItem('switch_fixture_seeded','1');
    localStorage.setItem('ps_sync_session',JSON.stringify({uid:A,at:'fixture-access-A',rt:'fixture-refresh-A',exp:Date.now()+3600000,email:'a@example.invalid'}));
    localStorage.setItem('ps_active_ws',WA);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:A,wid:WA}));
    localStorage.setItem('ps_ws_list',JSON.stringify(teams));
  },{A,WA,teams,base});
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===base){
      if(url.pathname==='/__fixture__/seed.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic storage seed</title>'});
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      const ext=path.extname(file),bytes=fs.readFileSync(file),body=['.html','.js'].includes(ext)?bytes.toString('utf8').split(configuredAuth).join(fixtureAuth):bytes;
      return route.fulfill({body,contentType:mime[ext]||'application/octet-stream'});
    }
    if(url.origin!==fixtureAuth||(!url.pathname.startsWith('/rest/v1/')&&!url.pathname.startsWith('/auth/v1/'))){blockedRequests.push({origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':req.headers().origin||base,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'authorization,apikey,content-type,prefer','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Credentials':'true'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    const authorization=req.headers().authorization,uid=authorization==='Bearer fixture-access-A'?A:authorization==='Bearer fixture-access-B'?B:null;
    // The public community feed deliberately uses the configured publishable key, never a user identity.
    if(!uid&&req.method()==='GET'&&url.pathname==='/rest/v1/ps_community'&&authorization==='Bearer '+publicKey&&req.headers().apikey===publicKey)return route.fulfill({status:200,headers,body:'[]'});
    // storage.js submits error telemetry anonymously. Capture it locally without assigning an account.
    if(!uid&&req.method()==='POST'&&url.pathname==='/rest/v1/ps_err'&&authorization==='Bearer '+publicKey&&req.headers().apikey===publicKey){telemetry.push(...req.postDataJSON());return route.fulfill({status:201,headers,body:''});}
    if(!uid){unauthorized.push({method:req.method(),path:url.pathname});return route.fulfill({status:401,headers,body:'{"error":"unknown synthetic bearer"}'});}
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
  });
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);errorDetails.push({at:Date.now(),message:e.message,stack:e.stack});});
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')diagnostics.push({at:Date.now(),type:m.type(),text:m.text()});});
  async function ready(wid,uid){
    await bounded(page.waitForFunction(({wid,uid})=>window.PSSync&&PSSync.dataUnlocked()&&PSSync.activeWs()===wid&&PSSync.session()?.uid===uid&&PSSync.rosterReady(wid),{wid,uid}),'account ready '+wid,35000);
    await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
    await page.waitForFunction(()=>{try{const frame=document.querySelector('#fScout');return frame?.contentWindow?.scoutBootPending===false;}catch(_){return false;}});
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
    if(uid===A){
      // Initial A is deliberately seeded in both stores to prove B removes both.
      // On a fresh A return, private IDP's canonical store is localStorage; an
      // absent optional legacy IDB copy is valid and any present copy must match.
      const copies=results.length===0?Object.values(state.privateA):[state.privateA.local,...(state.privateA.idb===null?[]:[state.privateA.idb])];
      for(const raw of copies)assert.equal(JSON.parse(raw).log['2026-09-14'].memo,'SYNTHETIC private account A record','account A private record remains exact');
    }
    else assert.deepEqual(state.privateA,{local:null,idb:null},'the previously verified private record is absent after account B login');
    assert.equal(await page.locator('#psWsModal').count(),0,'normal completed entry opens no modal');
    results.push({uid,wid,rosterIsolated:true,permissionsDocumentIsolated:true,privateRecord:uid===A?(results.length===0?'A record verified in both stores':'A own record restored; any optional IDB copy matches'):'A record absent from both stores'});
    console.log(JSON.stringify({stage:'ready',scenario:results.length,wid}));
  }
  await page.goto(base+'/__fixture__/seed.html');
  await page.evaluate(async({privateAKey,privateARaw})=>{
    localStorage.setItem(privateAKey,privateARaw);
    await new Promise((resolve,reject)=>{const request=indexedDB.open('ps-store',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,t=db.transaction('kv','readwrite');t.objectStore('kv').put(privateARaw,privateAKey);t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};});
  },{privateAKey,privateARaw});
  await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});await ready(WA,A);
  const before=await page.evaluate(()=>({uid:PSSync.session()?.uid,at:PSSync.session()?.at,unlocked:PSSync.dataUnlocked()}));
  await page.evaluate(()=>{window.__beforeCallbackDocument='same-document-sentinel';window.__hashEvents=0;window.addEventListener('hashchange',()=>window.__hashEvents++);});
  await page.goto(base+'/studio/app.html#access_token=fixture-access-B&refresh_token=fixture-refresh-B&expires_in=3600&token_type=bearer');
  await ready(WC,B);
  const after=await page.evaluate(()=>({uid:PSSync.session()?.uid,at:PSSync.session()?.at,unlocked:PSSync.dataUnlocked(),sameDocument:window.__beforeCallbackDocument==='same-document-sentinel',fragmentContainsToken:location.hash.includes('access_token=')}));
  assert.equal(after.sameDocument,false);assert.equal(after.uid,B);assert.equal(after.fragmentContainsToken,false);
  const bUserLookups=calls.filter(c=>c.path==='/auth/v1/user'&&c.uid===B).length;
  assert.ok(bUserLookups>0);
  // An incomplete callback preserves B's credentials but must not reopen its
  // data until the user explicitly chooses to continue with that account.
  await page.evaluate(()=>{location.hash='#access_token=synthetic-incomplete';});
  await page.locator('#psDataLock [data-ps-previous]').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>PSSync.dataUnlocked()),false);
  assert.equal(await page.evaluate(()=>PSSync.session()?.uid),B);
  await page.screenshot({path:path.join(out,'incomplete-callback-card.png')});
  await page.locator('#psDataLock [data-ps-previous]').click();
  await ready(WC,B);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await page.evaluate(()=>location.hash),'');
  assert.equal(await page.locator('#psDataLock [data-ps-previous]').count(),0);

  // History/BFCache-style restoration may present a callback without a new
  // document or hashchange. Invoke the actual registered pageshow handler.
  const persistedLock=await page.evaluate(()=>{
    window.__beforeRestoredCallback='old-B-document';
    history.replaceState(null,'',location.pathname+'#access_token=fixture-access-A&refresh_token=fixture-refresh-A&expires_in=3600');
    window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    return {unlocked:PSSync.dataUnlocked(),uid:PSSync.session()?.uid};
  });
  assert.deepEqual(persistedLock,{unlocked:false,uid:''});
  await ready(WB,A); // A is a fresh login again; its personal workspace is the documented default.
  const restored=await page.evaluate(()=>({uid:PSSync.session()?.uid,unlocked:PSSync.dataUnlocked(),sameDocument:window.__beforeRestoredCallback==='old-B-document',fragmentContainsToken:location.hash.includes('access_token=')}));
  assert.equal(restored.uid,A);assert.equal(restored.sameDocument,false);assert.equal(restored.fragmentContainsToken,false);
  for(const write of writes){
    assert.ok(write.uid===B?write.wid===WC:[WA,WB].includes(write.wid),'callback writes remain in their authenticated workspace');
    if(write.k==='scout_tool_v1'&&write.v)assert.deepEqual(JSON.parse(write.v).players.map(p=>p.id),players(write.wid).map(p=>p.id),'roster writes keep the source workspace IDs');
    if(write.k.startsWith('sq:'))assert.equal(write.k,'sq:'+players(write.wid)[0].id,'item writes keep the source workspace ID');
    if(write.k.startsWith('cs_idp_v1_'))assert.equal(write.k,'cs_idp_v1_'+write.uid,'private IDP writes remain with their authenticated owner');
  }
  await page.screenshot({path:path.join(out,'same-document-callback-fixed.png')});
  assert.deepEqual(unauthorized,[]);
  assert.deepEqual(errors.filter(e=>!e.startsWith('ResizeObserver loop')),[]);
  const authDataRequests=attemptedRequests.filter(r=>/^\/(rest|auth)\/v1\//.test(r.path));
  assert.ok(authDataRequests.length>0);assert.ok(authDataRequests.every(r=>r.origin===fixtureAuth),'auth/data requests never target a production origin');
  assert.ok(attemptedRequests.every(r=>r.origin!==configuredAuth),'the production auth origin is never requested');
  fs.writeFileSync(path.join(out,'same-document-callback-fixed.json'),JSON.stringify({passed:true,syntheticOnly:true,engine,before,after,bUserLookups,persistedLock,restored,results,writeCount:writes.length,writesIsolated:true,unauthorized,errors,errorDetails,network:{transport:rejectProxy?'rejecting-loopback-proxy':'offline',appConnectivity:'online signal for locally fulfilled fixtures',proxyBypass:false,rejectedProxyConnections,authDataHosts:[...new Set(authDataRequests.map(r=>r.origin))],attemptedRequests,blockedRequests,failedRequests}},null,2));
  console.log(JSON.stringify({passed:true,engine,scenarios:results.length,hashCallback:true,persistedCallback:true,explicitPreviousAccount:true}));
}catch(e){
  if(profiler){const profile=await bounded(profiler.send('Profiler.stop'),'profile stop',3000).catch(()=>null);if(profile)fs.writeFileSync(path.join(out,'failure-profile.json'),JSON.stringify(profile));}
  const state=await Promise.race([page?.evaluate(async({privateAKey})=>({url:location.href,logoutResult:window.__fixtureLogoutResult,switchResult:window.__fixtureSwitchResult,sync:window.PSSync?.state(),active:window.PSSync?.activeWs(),session:window.PSSync?.session()?.uid,owner:localStorage.getItem('ps_cache_owner_v1'),guard:localStorage.getItem('ps_ws_switch_guard_v1'),meta:localStorage.getItem('ps_sync_meta'),diag:await window.PSSync?.diag(),privateA:{local:localStorage.getItem(privateAKey),idb:(await window.storage?.get(privateAKey))?.value??null}}),{privateAKey}).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve({unresponsive:true}),2000))]);
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,state,errors,errorDetails,diagnostics,unauthorized,telemetry,results,writes,calls,network:{transport:rejectProxy?'rejecting-loopback-proxy':'offline',rejectedProxyConnections,attemptedRequests,blockedRequests,failedRequests}},null,2));
  await page?.screenshot({path:path.join(out,'failure.png'),timeout:2000}).catch(()=>{});throw e;
}finally{await context?.close();await browser.close();if(rejectProxy)await new Promise(resolve=>rejectProxy.close(resolve));}
