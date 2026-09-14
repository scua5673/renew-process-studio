import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Actual admin.html and the application's support module share one synthetic
// RPC store. All external traffic is intercepted; no production data is read.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/admin-support');fs.mkdirSync(out,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const ADM='99999999-9999-4999-8999-999999999999',USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',EXTRA='33333333-3333-4333-8333-333333333333';
const adminSource=fs.readFileSync(path.join(root,'admin.html'),'utf8');
const apiOrigin=(adminSource.match(/url:"(https:\/\/[^\"]+)"/)||[])[1];assert.ok(apiOrigin,'Configured origin is used for interception only');
const build=(fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)||[])[1];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/support-app-fixture.html'){
    res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});
    res.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/studio/support.css"></head><body><button id="psSupportOpen">오류 제보</button><script>window.PS_BUILD='+JSON.stringify(build)+';window.PS_SYNC={url:'+JSON.stringify(apiOrigin)+',anonKey:"fixture-public"};window.PSSync={session:()=>({uid:'+JSON.stringify(USER)+',at:"fixture-reporter-access"}),dataUnlocked:()=>true};localStorage.setItem("ps_cache_owner_v1",JSON.stringify({uid:'+JSON.stringify(USER)+',wid:"fixture-team"}));</script><script src="/studio/support-diagnostics.js"></script><script src="/studio/support.js"></script><script>PSSupportDiagnostics.install(window);PSSupport.mount({window});</script></body></html>');return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,results=[];
let browser;
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
try{
  browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1280,393]){
    const reports=new Map(),replies=new Map(),calls=[],blocked=[],errors=[];
    let mode='normal',replyLost=1,replyWrong=1,delayed=null;
    reports.set(EXTRA,{id:EXTRA,title:'추가 제보 <img src=x onerror="window.fixtureXss=1">',body:'추가 제보',created_at:'2026-09-15T01:00:00Z',updated_at:'2026-09-15T01:00:00Z',status:'open',diagnostics:{environment:{appVersion:build},logs:[]}});replies.set(EXTRA,[]);
    const routeHandler=async route=>{
      const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.continue();
      if(url.origin!==apiOrigin){blocked.push(url.origin+url.pathname);return route.abort('blockedbyclient');}
      const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
      const name=url.pathname.startsWith('/rest/v1/rpc/')?url.pathname.split('/').at(-1):null,args=request.postDataJSON()||{};
      const admin=request.headers().authorization==='Bearer fixture-admin-access';calls.push({name,path:url.pathname,method:request.method(),args,admin});
      const send=(value,status=200)=>route.fulfill({status,headers,body:JSON.stringify(value)});
      if(name==='ps_whoami')return send([{uid:ADM,email:'admin@example.test',is_admin:true}]);
      if(name==='ps_admin_users_v2'||name==='ps_admin_users')return send([{user_id:USER,name:'합성 제보자',email:'reporter@example.test',workspace_ids:[]}]);
      if(name==='ps_support_list'){
        if(admin&&mode==='unavailable')return send({code:'PGRST202',message:'fixture RPC unavailable'},404);
        if(admin&&mode==='forbidden')return send({code:'42501',message:'fixture permission denied'},403);
        if(admin&&mode==='malformed')return send({is_admin:true,reports:[{id:'bad',title:'Malformed row'}],next_cursor:null});
        const rows=Array.from(reports.values()).map(r=>({id:r.id,title:r.title,status:r.status,created_at:r.created_at,updated_at:r.updated_at,is_own:!admin,reply_count:(replies.get(r.id)||[]).length,last_reply_at:null}));
        return send({reports:rows,next_cursor:null,is_admin:admin&&mode!=='not-admin'});
      }
      if(name==='ps_support_create'){
        assert.equal(admin,false,'Only the synthetic app reporter creates reports');
        if(!reports.has(args.p_id)){reports.set(args.p_id,{id:args.p_id,title:args.p_title,body:args.p_body,diagnostics:args.p_diagnostics,created_at:'2026-09-15T03:00:00Z',updated_at:'2026-09-15T03:00:00Z',status:'open'});replies.set(args.p_id,[]);}
        return send({id:args.p_id});
      }
      if(name==='ps_support_get'){
        const value={report:{...reports.get(args.p_report_id),is_own:!admin},replies:(replies.get(args.p_report_id)||[]).map(r=>({...r,is_own:admin?r.author_role==='admin':r.author_role!=='admin'}))};
        const gate=admin&&delayed;if(gate){delayed=null;gate.started.resolve();await gate.release.promise;}
        try{return await send(value);}catch(_){return;}finally{if(gate)gate.finished.resolve();}
      }
      if(name==='ps_support_reply'){
        assert.equal(admin,true,'This flow replies through the actual administrator page');
        if(mode==='reply-missing')return send({code:'PT404',message:'report_not_found'},404);
        const list=replies.get(args.p_report_id)||[];let reply=list.find(r=>r.id===args.p_id);
        if(!reply){reply={id:args.p_id,report_id:args.p_report_id,body:args.p_body.trim(),author_role:'admin',is_own:true,created_at:'2026-09-15T04:00:00Z'};list.push(reply);replies.set(args.p_report_id,list);}
        if(replyLost-->0)return route.abort('failed');
        if(replyWrong-->0)return send({...reply,report_id:EXTRA});
        return send(reply);
      }
      if(name||url.pathname==='/rest/v1/ps_events')return send([]);
      return send({message:'unexpected fixture endpoint'},404);
    };
    async function makeContext(admin){
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.route('**/*',routeHandler);
      await context.routeWebSocket('**/*',socket=>{blocked.push(socket.url());socket.close();});
      await context.addInitScript(({admin,ADM})=>{
        if(admin)localStorage.setItem('ps_sync_session',JSON.stringify({uid:ADM,at:'fixture-admin-access',rt:'PRIVATE_ADMIN_REFRESH',email:'admin@example.test',exp:Date.now()+86400000}));
        window.fixtureCopies=[];window.fixtureXss=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>fixtureCopies.push(text)}});
      },{admin,ADM});return context;
    }
    const appContext=await makeContext(false),app=await appContext.newPage();app.setDefaultTimeout(20000);app.on('pageerror',e=>errors.push(e.message));
    await app.goto(base+'/support-app-fixture.html',{waitUntil:'load'});
    await app.evaluate(()=>dispatchEvent(new CustomEvent('ps-sync-diagnostic',{detail:{stage:'personal-channel',error:{name:'StorageError',psCode:'sync_storage',message:'PRIVATE_RAW_ERROR'}}})));
    await app.locator('#psSupportOpen').click();
    const title='앱에서 보낸 로그인 오류 <img src=x onerror="window.fixtureXss=3">',body='구글 로그인을 선택한 뒤 문제가 생겼습니다.\n합성 제보입니다.';
    await app.locator('#supportCompose [name=title]').fill(title);await app.locator('#supportCompose [name=body]').fill(body);await app.locator('#supportCompose button[type=submit]').click();
    await app.locator('.support-report').waitFor();const reportId=calls.find(c=>c.name==='ps_support_create').args.p_id;
    await app.getByRole('button',{name:'오류 제보 닫기',exact:true}).click();

    const context=await makeContext(true),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/admin.html',{waitUntil:'domcontentloaded'});await page.locator('#app').waitFor({state:'visible'});
    await page.locator('[data-admin-tab="support"]').click();const view=page.locator('#viewSupport');
    await view.locator('[data-adm-report="'+reportId+'"]').waitFor();
    assert.equal(calls.filter(c=>c.admin&&c.name==='ps_support_get').length,0,'Opening the support list never automatically loads a private report body');
    assert.ok((await view.innerText()).includes(title));assert.equal(await view.locator('img[onerror],svg[onload],script').count(),0);assert.equal(await page.evaluate(()=>fixtureXss),0);
    await page.screenshot({path:path.join(out,width+'-admin-list.png')});
    await view.locator('[data-adm-report="'+reportId+'"]').click();const input=view.locator('textarea[name=reply]');await input.waitFor();
    await view.locator('.admSupportLogs summary').click();
    assert.ok((await view.innerText()).includes(body));assert.match(await view.innerText(),/sync_storage/);
    const replyText='관리자 답변입니다. 다시 확인해 주세요. <img src=x onerror="window.fixtureXss=4">';await input.fill(replyText);
    await view.locator('[data-adm-support=copy]').click();const copied=await page.evaluate(()=>fixtureCopies.at(-1));
    for(const value of [title,body,replyText,'sync_storage'])assert.ok(copied.includes(value),value);assert.match(copied,/작성 중인 답변/);
    for(const secret of ['fixture-admin-access','PRIVATE_ADMIN_REFRESH','PRIVATE_RAW_ERROR'])assert.ok(!copied.includes(secret),secret);
    await page.locator('[data-admin-tab="home"]').click();await page.locator('[data-admin-tab="support"]').click();await view.locator('[data-adm-report="'+reportId+'"]').click();await input.waitFor();
    assert.equal(await input.inputValue(),replyText,'Unsent reply survives leaving the administrator tab');
    const sendButton=view.locator('[data-adm-support=send]');await sendButton.click();
    await page.waitForFunction(()=>{const button=document.querySelector('#viewSupport [data-adm-support=send]');return button&&!button.disabled;});
    assert.equal(await input.inputValue(),replyText);assert.equal(await view.locator('.admSupportReply').count(),0,'Lost response is not a successful acknowledgement');
    await sendButton.click();await page.waitForFunction(()=>{const button=document.querySelector('#viewSupport [data-adm-support=send]');return button&&!button.disabled;});
    assert.equal(await input.inputValue(),replyText);assert.equal(await view.locator('.admSupportReply').count(),0,'Wrong report acknowledgement cannot publish success');
    await sendButton.click();await page.waitForFunction(()=>document.querySelector('#viewSupport textarea[name=reply]')?.value==='');
    assert.equal(await view.locator('.admSupportReply').count(),1);assert.equal((replies.get(reportId)||[]).length,1);
    const sent=calls.filter(c=>c.name==='ps_support_reply');assert.equal(sent.length,3);assert.deepEqual(sent[0].args,sent[1].args);assert.deepEqual(sent[1].args,sent[2].args);
    assert.equal(await view.locator('img[onerror],svg[onload],script').count(),0);assert.equal(await page.evaluate(()=>fixtureXss),0);
    const geometry=await view.evaluate(el=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,client:el.clientWidth,scroll:el.scrollWidth}));
    assert.ok(geometry.documentWidth<=width+1&&geometry.scroll<=geometry.client+1,JSON.stringify(geometry));await page.screenshot({path:path.join(out,width+'-admin-reply.png')});

    await app.locator('#psSupportOpen').click();await app.locator('[data-support=list]').click();await app.locator('[data-report="'+reportId+'"]').click();await app.locator('.support-replies article').waitFor();
    assert.ok((await app.locator('.support-replies').innerText()).includes(replyText));assert.match(await app.locator('.support-replies').innerText(),/운영자/);assert.equal(await app.locator('.support-replies article').count(),1);
    await app.screenshot({path:path.join(out,width+'-app-sees-admin-reply.png')});

    // The backend intentionally conceals inaccessible reports as PT404. A
    // stale local admin session must not leave the old report copyable.
    await view.locator('[data-adm-support=back]').click();await view.locator('[data-adm-report="'+EXTRA+'"]').click();await input.waitFor();
    await input.fill('권한 변경 전에 작성한 합성 초안');mode='reply-missing';await sendButton.click();
    await view.locator('[role=alert]').waitFor();
    assert.equal(await view.locator('[data-adm-report],textarea[name=reply],[data-adm-support=copy]').count(),0);
    assert.ok(!(await view.innerText()).includes(reports.get(EXTRA).title),'A server-denied report is removed from the page');
    assert.ok(await page.evaluate(({ADM,EXTRA})=>sessionStorage.getItem('ps_admin_support_reply_v1:'+ADM+':'+EXTRA)?.includes('권한 변경 전에 작성한 합성 초안'),{ADM,EXTRA}));
    mode='normal';await view.locator('[data-adm-support=refresh]').click();await view.locator('[data-adm-report="'+reportId+'"]').click();await input.waitFor();

    for(const failure of ['unavailable','forbidden','not-admin','malformed']){
      mode=failure;await view.locator('[data-adm-support=back]').click();await view.locator('[data-adm-support=refresh]').click();
      await page.waitForFunction(()=>!document.querySelector('#viewSupport [data-adm-report]')&&document.querySelector('#viewSupport')?.textContent.match(/사용|불러|설치|권한|관리자/));
      assert.equal(await view.locator('[data-adm-report]').count(),0);assert.equal(await view.locator('textarea[name=reply]').count(),0);
      assert.doesNotMatch(await view.innerText(),/아직[^.]*없습니다|등록된 제보가 없습니다|접수된 제보가 없습니다/,'A failed or unauthorized list is not an empty successful list');
      await page.screenshot({path:path.join(out,width+'-'+failure+'.png')});mode='normal';await view.locator('[data-adm-support=refresh]').click();await view.locator('[data-adm-report="'+reportId+'"]').click();await input.waitFor();
    }

    await view.locator('[data-adm-support=back]').click();await view.locator('[data-adm-report="'+reportId+'"]').waitFor();
    let gate={started:deferred(),release:deferred(),finished:deferred()};delayed=gate;
    await view.locator('[data-adm-report="'+reportId+'"]').click();await gate.started.promise;await page.locator('[data-admin-tab="home"]').click();gate.release.resolve();
    await gate.finished.promise;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await view.isVisible(),false);assert.equal(await view.locator('textarea[name=reply]').count(),0,'Late private detail never reopens a deactivated tab');
    await page.locator('[data-admin-tab="support"]').click();await view.locator('[data-adm-report="'+reportId+'"]').click();await input.waitFor();
    await input.fill('앞 관리자에게만 남는 미저장 답변');
    const replyCount=calls.filter(c=>c.name==='ps_support_reply').length;
    await page.evaluate(({OTHER,reportId})=>{
      const form=document.querySelector('#viewSupport form[data-adm-support-form=reply]');
      sessionStorage.setItem('ps_admin_support_reply_v1:'+OTHER+':'+reportId,JSON.stringify({body:'다음 관리자 저장 초안',attempt:null}));
      localStorage.setItem('ps_sync_session',JSON.stringify({uid:OTHER,at:'fixture-other-admin',rt:'PRIVATE_OTHER_REFRESH',exp:Date.now()+86400000}));
      form.requestSubmit();
    },{OTHER,reportId});
    await page.waitForFunction(()=>!document.querySelector('#viewSupport textarea[name=reply]'));assert.equal(calls.filter(c=>c.name==='ps_support_reply').length,replyCount,'A stale administrator form never sends another account draft');
    assert.ok(!(await view.textContent()).includes(body),'The module clears old report bodies as soon as its account guard fails');
    await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'ps_sync_session',newValue:localStorage.getItem('ps_sync_session')})));await page.locator('#adminSessionLock').waitFor();
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('#app').waitFor({state:'visible'});await page.locator('[data-admin-tab="support"]').click();await view.locator('[data-adm-report="'+reportId+'"]').waitFor();
    gate={started:deferred(),release:deferred(),finished:deferred()};delayed=gate;
    await view.locator('[data-adm-report="'+reportId+'"]').click();await gate.started.promise;
    await page.evaluate(OTHER=>{localStorage.setItem('ps_sync_session',JSON.stringify({uid:OTHER,at:'fixture-other-admin',rt:'PRIVATE_OTHER_REFRESH',exp:Date.now()+86400000}));dispatchEvent(new StorageEvent('storage',{key:'ps_sync_session'}));},OTHER);
    await page.locator('#adminSessionLock').waitFor();gate.release.resolve();await gate.finished.promise;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await view.locator('textarea[name=reply]').count(),0);assert.ok(!(await page.evaluate(()=>document.querySelector('#viewSupport')?.textContent||'')).includes(body),'A late prior-account response never restores a private report into the DOM');
    assert.deepEqual(errors,[]);assert.equal(await app.evaluate(()=>fixtureXss),0);assert.equal(await page.evaluate(()=>fixtureXss),0);
    results.push({engine,width,passed:true,appCreateToAdmin:true,adminReplyToApp:true,retrySameId:true,wrongAckRejected:true,unsavedCopy:true,tabDraftPreserved:true,inactiveLateReadBlocked:true,accountImplicitSubmitBlocked:true,accountLateReadBlocked:true,unavailableNotEmpty:true,deniedNotEmpty:true,htmlEscaped:true,geometry,blocked});
    console.log(JSON.stringify({engine,width,passed:true}));await context.close();await appContext.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Real admin.html and application support.js in separate synthetic accounts, sharing an intercepted in-memory RPC store. No production requests or data.',results},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
