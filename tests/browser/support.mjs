import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/support');fs.mkdirSync(out,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const base='https://support-app-fixture.invalid',apiBase='https://support-api-fixture.invalid';
const existing='22222222-2222-4222-8222-222222222222',adminReply='33333333-3333-4333-8333-333333333333';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{
  for(const width of [1280,393]){
    const context=await browser.newContext({viewport:{width,height:852},serviceWorkers:'block'});
    let unavailable=false,delayGet=null,createFailures=1,replyFailures=1,createWrongAck=1,replyWrongAck=1;
    const blocked=[],requests=[],reports=new Map(),replies=new Map();
    const record={id:existing,title:'이전 문의 <img src=x onerror="window.fixtureXss=1">',body:'이전 문의 본문',created_at:'2026-09-15T01:00:00Z',diagnostics:{environment:{appVersion:'2.815'},logs:[]}};
    reports.set(existing,record);replies.set(existing,[{id:adminReply,report_id:existing,body:'운영자 답변 <svg onload="window.fixtureXss=2">',author_role:'admin',created_at:'2026-09-15T02:00:00Z'}]);
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===base){
        if(url.pathname==='/studio/app.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/studio/support.css"><style>:root{--bar:#fff;--bar2:#f4f6f9;--txt:#20242b;--dim:#646a73;--line:#e3e6ea;--blue:#3a6df0}body{margin:0;font:14px system-ui;background:#edf0f5}button{font:inherit}main{padding:20px}body.ps-modal-open{overflow:hidden}</style></head><body><div id="psReleaseNotes"></div><main><button id="psSupportOpen">오류 제보</button><button id="psSupportSettingsOpen">설정에서 오류 제보</button></main><script src="/studio/support-diagnostics.js"></script><script src="/studio/release-notes.js"></script><script src="/studio/support.js"></script><script>PSSupportDiagnostics.install(window);PSSupport.mount({window});window.fixtureRelease=PSReleaseNotes.mount({window,host:document.getElementById("psReleaseNotes")});</script></body></html>'});
        const allowed=['support.js','support.css','support-diagnostics.js','release-notes.js'];
        const file=url.pathname.split('/').at(-1);
        if(allowed.includes(file))return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(path.join(root,'studio',file))});
        return route.fulfill({status:404,body:''});
      }
      if(url.origin!==apiBase){blocked.push(url.origin+url.pathname);return route.abort();}
      const name=url.pathname.split('/').at(-1),body=request.postDataJSON();requests.push({name,body});
      function fulfill(value,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});}
      if(unavailable)return fulfill({code:'PGRST202'},404);
      if(name==='ps_support_list')return fulfill({reports:Array.from(reports.values()).map(r=>({...r,reply_count:(replies.get(r.id)||[]).length,is_own:true})),is_admin:false,next_cursor:null});
      if(name==='ps_support_get'){
        const value={report:reports.get(body.p_report_id),replies:replies.get(body.p_report_id)||[]};
        if(delayGet){const gate=delayGet;delayGet=null;gate.started();await gate.promise;}
        try{return await fulfill(value);}catch(_){return;}
      }
      if(name==='ps_support_create'){
        if(!reports.has(body.p_id)){reports.set(body.p_id,{id:body.p_id,title:body.p_title,body:body.p_body,diagnostics:body.p_diagnostics,created_at:'2026-09-15T03:00:00Z'});replies.set(body.p_id,[]);}
        if(createFailures-->0)return route.abort('failed');
        if(createWrongAck-->0)return fulfill({id:existing});
        return fulfill({id:body.p_id});
      }
      if(name==='ps_support_reply'){
        const list=replies.get(body.p_report_id)||[];
        let reply=list.find(r=>r.id===body.p_id);
        if(!reply){reply={id:body.p_id,report_id:body.p_report_id,body:body.p_body,author_role:'user',is_own:true,created_at:'2026-09-15T04:00:00Z'};list.push(reply);replies.set(body.p_report_id,list);}
        if(replyFailures-->0)return route.abort('failed');
        if(replyWrongAck-->0)return fulfill({...reply,report_id:existing});
        return fulfill(reply);
      }
      return fulfill({code:'PGRST202'},404);
    });
    await context.addInitScript(()=>{
      const payload=btoa(JSON.stringify({sub:'synthetic-coach',exp:Math.floor(Date.now()/1000)+3600}));
      window.fixtureSession={uid:'synthetic-coach',at:'header.'+payload+'.SYNTHETIC_SIGNATURE',rt:'PRIVATE_REFRESH_TOKEN'};
      window.fixtureReady=true;window.fixtureCopies=[];window.fixtureXss=0;
      window.PS_BUILD='2.815';window.PS_SYNC={url:'https://support-api-fixture.invalid',anonKey:'SYNTHETIC_PUBLIC_KEY'};
      window.PSSync={session:()=>window.fixtureSession,dataUnlocked:()=>window.fixtureReady};
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:'synthetic-coach',wid:'synthetic-team',nonce:'one'}));localStorage.setItem('ps_active_ws','synthetic-team');
      localStorage.setItem('ps_sync_session',JSON.stringify(window.fixtureSession));localStorage.setItem('scout_tool_v1','PRIVATE_PLAYER_DATA');
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.fixtureCopies.push(value);}}});
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/studio/app.html?token=PRIVATE_URL_TOKEN#PRIVATE_URL_HASH',{waitUntil:'load'});
    const dialog=page.locator('#psSupportDialog');
    await page.getByRole('button',{name:'일주일간 안 보기',exact:true}).click();
    assert.equal(await page.locator('#psReleaseNotes').isVisible(),false);
    const hidden=await page.evaluate(()=>JSON.parse(localStorage.getItem(PSReleaseNotes.STORAGE_KEY)));
    assert.equal(hidden.until-hidden.from,7*24*60*60*1000);
    await page.evaluate(()=>fixtureRelease.refresh([{id:'new-note',date:'2026-09-16',title:'새 안내',changes:['추가된 내용']},...PSReleaseNotes.entries()]));
    assert.equal(await page.locator('#psReleaseNotes').isVisible(),true);
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ps-sync-diagnostic',{detail:{stage:'personal-channel',error:{name:'StorageError',psCode:'sync_storage',message:'PRIVATE_RAW_ERROR',stack:'Error PRIVATE_STACK\n at x (https://support-app-fixture.invalid/studio/sync.js?token=PRIVATE_QUERY:123:4)'}}})));

    await page.locator('#psSupportOpen').click();assert.equal(await dialog.evaluate(el=>el.open),true);
    const title='모바일 로그인 오류 <img src=x onerror="window.fixtureXss=3">',body='구글 버튼을 눌렀습니다.\n실제 결과가 예상과 달랐습니다.';
    await dialog.locator('input[name=title]').fill('이전 저장 제목');await dialog.locator('textarea[name=body]').fill('이전 저장 내용');
    await page.evaluate(()=>{const original=Storage.prototype.setItem;window.fixtureStorageSetItem=original;Storage.prototype.setItem=function(key,value){if(/^ps_support_(?:draft|reply)_v1:/.test(key))throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,key,value);};});
    await dialog.locator('input[name=title]').fill(title);await dialog.locator('textarea[name=body]').fill(body);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ps_support_draft_v1:synthetic-coach')).title),'이전 저장 제목','A readable stale baseline simulates a failed newer write');
    assert.equal(await page.evaluate(()=>__psSupportController.pendingUnsafe()),true);
    assert.equal(await page.evaluate(()=>__psSupportController.flushReady().then(()=>false,e=>e.code==='support_draft_unsaved')),true);
    await dialog.getByRole('button',{name:'오류 제보 닫기',exact:true}).click();await page.locator('#psSupportOpen').click();
    assert.equal(await dialog.locator('input[name=title]').inputValue(),title);assert.equal(await dialog.locator('textarea[name=body]').inputValue(),body,'Failed local writes do not replace the in-memory draft with old disk content');
    await dialog.getByRole('button',{name:'제보·사용 환경·로그 전체 복사',exact:true}).click();
    let copied=await page.evaluate(()=>fixtureCopies.at(-1));
    for(const value of [title,body,'sync_storage','2.815'])assert.ok(copied.includes(value),value);
    for(const secret of ['PRIVATE_REFRESH_TOKEN','SYNTHETIC_SIGNATURE','PRIVATE_PLAYER_DATA','PRIVATE_RAW_ERROR','PRIVATE_STACK','PRIVATE_QUERY','PRIVATE_URL_TOKEN','PRIVATE_URL_HASH'])assert.ok(!copied.includes(secret),secret);
    await dialog.getByRole('button',{name:'제보 등록',exact:true}).click();
    await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).waitFor();
    assert.equal(await dialog.locator('input[name=title]').inputValue(),title);assert.equal(await dialog.locator('textarea[name=body]').inputValue(),body);
    assert.equal(await dialog.locator('.support-report').count(),0,'Uncertain response cannot show a completed report');
    await dialog.getByRole('button',{name:'오류 제보 닫기',exact:true}).click();await page.locator('#psSupportOpen').click();
    assert.equal(await dialog.locator('input[name=title]').inputValue(),title);assert.equal(await dialog.locator('textarea[name=body]').inputValue(),body);
    await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).waitFor();
    await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).click();
    await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).waitFor();
    assert.equal(await dialog.locator('.support-report').count(),0,'A successful HTTP response for a different report is not acknowledgement');
    assert.equal(await dialog.locator('textarea[name=body]').inputValue(),body);
    await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).click();
    await dialog.locator('.support-report').waitFor();
    const creates=requests.filter(x=>x.name==='ps_support_create');assert.equal(creates.length,3);assert.deepEqual(creates[0].body,creates[1].body);assert.deepEqual(creates[1].body,creates[2].body);assert.equal(reports.size,2,'An uncertain retry creates only one report');
    assert.match(await dialog.locator('.support-report').innerText(),/모바일 로그인 오류/);assert.equal(await dialog.locator('img,svg').count(),0);assert.equal(await page.evaluate(()=>fixtureXss),0);

    const replyText='추가 확인한 내용입니다. <img src=x onerror="window.fixtureXss=4">';
    await dialog.locator('textarea[name=reply]').fill(replyText);
    await dialog.getByRole('button',{name:'제보·답변·사용 환경·로그 전체 복사',exact:true}).click();
    copied=await page.evaluate(()=>fixtureCopies.at(-1));assert.ok(copied.includes(replyText));assert.match(copied,/작성 중인 답변 · 아직 저장되지 않음/);
    await dialog.getByRole('button',{name:'오류 제보 닫기',exact:true}).click();
    assert.equal(await dialog.evaluate(el=>el.open),false,'A draft reply does not force the user to publish it before closing');
    await page.locator('#psSupportSettingsOpen').click();
    await dialog.getByRole('button',{name:'내 제보와 답변',exact:true}).click();
    await dialog.locator('[data-report="'+creates[0].body.p_id+'"]').click();
    await dialog.locator('textarea[name=reply]').waitFor();assert.equal(await dialog.locator('textarea[name=reply]').inputValue(),replyText,'Reply draft returns only for its account/report');
    await dialog.getByRole('button',{name:'답변 등록',exact:true}).click();await dialog.getByRole('button',{name:'답변 저장 다시 확인',exact:true}).waitFor();
    assert.equal(await dialog.locator('textarea[name=reply]').inputValue(),replyText);assert.equal(await dialog.locator('.support-replies article').count(),0);
    await dialog.getByRole('button',{name:'답변 저장 다시 확인',exact:true}).click();
    await dialog.getByRole('button',{name:'답변 저장 다시 확인',exact:true}).waitFor();
    assert.equal(await dialog.locator('.support-replies article').count(),0,'Reply acknowledgement must match its report as well as its own ID');
    assert.equal(await dialog.locator('textarea[name=reply]').inputValue(),replyText);
    await dialog.getByRole('button',{name:'답변 저장 다시 확인',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#psSupportDialog .support-status')?.textContent.includes('답변을 저장했습니다'));
    const replyRequests=requests.filter(x=>x.name==='ps_support_reply');assert.equal(replyRequests.length,3);assert.deepEqual(replyRequests[0].body,replyRequests[1].body);assert.deepEqual(replyRequests[1].body,replyRequests[2].body);assert.equal(await dialog.locator('.support-replies article').count(),1);
    await dialog.getByRole('button',{name:'제보·답변·사용 환경·로그 전체 복사',exact:true}).click();copied=await page.evaluate(()=>fixtureCopies.at(-1));
    for(const value of [title,body,replyText,'sync_storage'])assert.ok(copied.includes(value));
    assert.equal(await dialog.locator('img,svg').count(),0);
    const dimensions=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,client:el.clientWidth,scroll:el.scrollWidth,viewport:innerWidth}));
    assert.ok(dimensions.left>=0&&dimensions.right<=width+1&&dimensions.scroll<=dimensions.client+1,JSON.stringify(dimensions));
    await page.screenshot({path:path.join(out,width+'-report-reply.png')});

    await dialog.getByRole('button',{name:'‹ 목록으로',exact:true}).click();await dialog.locator('[data-report="'+existing+'"]').click();await dialog.locator('.support-replies article').waitFor();
    assert.match(await dialog.locator('.support-replies').innerText(),/운영자 답변 <svg/);assert.equal(await dialog.locator('img,svg').count(),0);
    await dialog.getByRole('button',{name:'‹ 목록으로',exact:true}).click();await dialog.locator('[data-report="'+existing+'"]').waitFor();
    unavailable=true;await dialog.getByRole('button',{name:'새로고침',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#psSupportDialog .support-status')?.textContent.includes('아직 사용할 수 없습니다'));
    assert.equal(await dialog.getByText('아직 등록한 제보가 없습니다.',{exact:true}).count(),0,'Unavailable service never looks like an empty successful list');
    await page.screenshot({path:path.join(out,width+'-unavailable.png')});unavailable=false;
    await dialog.getByRole('button',{name:'새로고침',exact:true}).click();await dialog.locator('[data-report="'+existing+'"]').waitFor();
    let release,started;const startedPromise=new Promise(r=>{started=r;});delayGet={started,promise:new Promise(r=>{release=r;})};
    await dialog.locator('[data-report="'+existing+'"]').click();await startedPromise;
    const aborted=page.waitForEvent('requestfailed',{predicate:request=>request.url().endsWith('/ps_support_get')});
    await page.evaluate(()=>{fixtureSession={...fixtureSession,uid:'another-coach'};localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:'another-coach',wid:'new-team',nonce:'two'}));dispatchEvent(new StorageEvent('storage',{key:'ps_cache_owner_v1'}));});
    await aborted;release();await dialog.locator('input[name=title]').waitFor();assert.equal(await dialog.locator('input[name=title]').inputValue(),'');assert.equal(await dialog.locator('.support-report').count(),0);
    assert.ok(!(await dialog.innerText()).includes('이전 문의 본문'),'Late old-account response never renders');
    await dialog.locator('input[name=title]').fill('앞 계정에만 남길 초안');await dialog.locator('textarea[name=body]').fill('다른 계정으로 복사하면 안 되는 내용');
    const copiesBefore=await page.evaluate(()=>fixtureCopies.length);
    await page.evaluate(()=>{fixtureSession={...fixtureSession,uid:'third-coach'};localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:'third-coach',wid:'new-team',nonce:'three'}));});
    await dialog.getByRole('button',{name:'제보·사용 환경·로그 전체 복사',exact:true}).click();
    assert.equal(await page.evaluate(()=>fixtureCopies.length),copiesBefore,'A silent account change is checked before copying');
    assert.equal(await dialog.locator('input[name=title]').inputValue(),'');assert.equal(await dialog.locator('textarea[name=body]').inputValue(),'');
    await dialog.locator('input[name=title]').fill('A 계정 작성 중 제목');await dialog.locator('textarea[name=body]').fill('A 계정 작성 중 본문');
    const requestsBeforeImplicitSubmit=requests.length;
    const implicitRequests=await page.evaluate(async()=>{
      const oldForm=document.querySelector('#supportCompose'),targetDraft={title:'B 계정에 저장된 제목',body:'B 계정에 저장된 본문',attempt:null};
      fixtureStorageSetItem.call(localStorage,'ps_support_draft_v1:submit-target-coach',JSON.stringify(targetDraft));
      fixtureSession={...fixtureSession,uid:'submit-target-coach'};localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:'submit-target-coach',wid:'new-team',nonce:'implicit-submit'}));
      // Native requestSubmit runs form validation and submit without a button
      // click, covering keyboard/implicit submission past click-level guards.
      const original=window.fetch;let calls=0;window.fetch=function(...args){calls++;return original.apply(this,args);};
      try{oldForm.requestSubmit();await Promise.resolve();return calls;}finally{window.fetch=original;}
    });
    assert.equal(implicitRequests,0,'An old account form must not submit the newly restored account draft');
    assert.equal(requests.length,requestsBeforeImplicitSubmit);
    assert.equal(await dialog.locator('input[name=title]').inputValue(),'B 계정에 저장된 제목');assert.equal(await dialog.locator('textarea[name=body]').inputValue(),'B 계정에 저장된 본문');
    assert.equal(await dialog.getByRole('button',{name:'제보 등록',exact:true}).isEnabled(),true,'New account draft remains unsubmitted and editable');

    await page.evaluate(()=>{fixtureSession=null;fixtureReady=false;dispatchEvent(new CustomEvent('ps-auth-state',{detail:{unlocked:false}}));});
    await dialog.locator('input[name=title]').fill('로그인할 수 없어요');await dialog.locator('textarea[name=body]').fill('로그인 전 작성한 제보입니다.');
    assert.equal(await dialog.getByRole('button',{name:'제보 등록',exact:true}).isDisabled(),true);
    const requestCount=requests.length;await dialog.getByRole('button',{name:'제보·사용 환경·로그 전체 복사',exact:true}).click();
    copied=await page.evaluate(()=>fixtureCopies.at(-1));assert.ok(copied.includes('로그인 전 작성한 제보입니다.'));assert.equal(requests.length,requestCount);
    await page.screenshot({path:path.join(out,width+'-guest-copy.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.equal(await page.evaluate(()=>fixtureXss),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('scout_tool_v1')),'PRIVATE_PLAYER_DATA','Support never mutates player storage');
    assert.ok(requests.every(request=>['ps_support_list','ps_support_get','ps_support_create','ps_support_reply'].includes(request.name)));
    results.push({engine,width,passed:true,createRetrySameId:true,replyRetrySameId:true,wrongAcknowledgementRejected:true,draftCloseRestore:true,failedDraftStoragePreserved:true,unsafeReloadBlocked:true,unsavedReplyCopied:true,silentOwnerChangeClears:true,implicitSubmitOwnerGuard:true,unavailableNotEmpty:true,guestCopy:true,ownerChangeClears:true,noPrivateDiagnostics:true,noPlayerMutation:true,newNotesIgnoreHide:true,dimensions});
    console.log(JSON.stringify(results.at(-1)));await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Actual support/diagnostics/release modules in isolated browser fixtures; all RPC responses and accounts synthetic; external traffic blocked.',results},null,2));
}finally{await browser.close();}
