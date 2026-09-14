import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Real shell and status renderer with synthetic state fixtures. Every external
// request is mocked or blocked. No production data is read or modified.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/process-autosave-status-browser';
fs.mkdirSync(out,{recursive:true});
const UID='99999999-9999-4999-8999-999999999999',WID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',PWID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const workspaces=[{id:WID,kind:'team',name:'가상 테스트 팀',role:'owner',owner_id:UID},{id:PWID,kind:'personal',name:'가상 개인 작업',role:'owner',owner_id:UID}];
// Deliberately omit staffEdit and the old notice-seen flag, exercising the old
// automatic migration notice trigger rather than suppressing it in the fixture.
const perms=JSON.stringify({members:{[UID]:{role:'admin'}},defaultRole:'player'});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  try{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep))throw 0;
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
  }catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,results=[];
let browser;
try{
  browser=await pw.chromium.launch({headless:true,executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const spec of [{width:393,height:852,mobile:true},{width:1280,height:900,mobile:false}])for(const serverName of ['가상 테스트 코치']){
    const label=spec.width+'-'+(serverName?'server-name':'no-name'),calls=[],blocked=[],errors=[];
    if(process.env.PS_TEST_LABEL&&process.env.PS_TEST_LABEL!==label)continue;
    const db=new Map([[WID+'|cs_perms_v1',{workspace_id:WID,k:'cs_perms_v1',v:perms,cupd:1,updated_by:UID}]]);
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:spec.mobile,hasTouch:spec.mobile,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    await context.addInitScript(({UID,WID,workspaces,perms})=>{
      if(!localStorage.getItem('quiet_fixture_seeded')){
        localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-at',rt:'synthetic-rt',exp:Date.now()+3600000,email:'fixture@example.invalid'}));
        localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));localStorage.setItem('ps_active_ws',WID);
        localStorage.setItem('ps_ws_list',JSON.stringify(workspaces));localStorage.setItem('cs_perms_v1',perms);localStorage.setItem('quiet_fixture_seeded','1');
      }
      window.__quietEntryEvents=[];
      const seen=new Set();
      function record(kind,text){const key=kind+'|'+text;if(seen.has(key))return;seen.add(key);window.__quietEntryEvents.push({kind,text});}
      function surfaceVisible(){
        try{let owner=window;while(owner!==owner.top){const frame=owner.frameElement;if(!frame||!frame.checkVisibility({opacityProperty:true,visibilityProperty:true}))return false;owner=owner.parent;}return true;}catch{return false;}
      }
      const check=()=>{
        // The shell intentionally constructs/measures board controls inside a
        // visibility:hidden iframe before revealing it. That is not a popup.
        if(!surfaceVisible())return;
        const modal=document.querySelector('#psWsModal');if(modal)record('modal',modal.innerText||modal.textContent||'');
        for(const dialog of document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]')){
          const style=getComputedStyle(dialog),rect=dialog.getBoundingClientRect();
          if(!dialog.closest('[aria-hidden="true"]')&&dialog.checkVisibility({opacityProperty:true,visibilityProperty:true})&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width&&rect.height&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight)record('dialog',dialog.id+': '+(dialog.innerText||dialog.textContent||''));
        }
        if(document.querySelector('#psAcctWrap .acct-pop.on'))record('account','account opened');
        for(const node of document.querySelectorAll('#psSyncChip,#hint,#cs-ftoast,#toast,.toast')){
          const text=node.textContent||'';
          if(node.id==='cs-ftoast'&&node.getAttribute('aria-hidden')==='false'&&text)record('automatic-toast',text);
          else if(/팀 자료는 임원만 편집합니다|설정 메뉴에 포메이션·그리드·명단·저장이 있어요|팀 색·패턴 변경: 팀칩을 한 번 더 탭하세요/.test(text))record('legacy-notice',text);
        }
      };
      new MutationObserver(check).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
      setInterval(check,50); // Also see parent-frame reveal without child mutations.
    },{UID,WID,workspaces,perms});
    await context.routeWebSocket('**/*',socket=>{blocked.push({path:socket.url(),resource:'websocket'});socket.close();});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
      if(!url.pathname.startsWith('/rest/v1/')&&!url.pathname.startsWith('/auth/v1/')){blocked.push({path:url.pathname,resource:req.resourceType()});return route.abort('blockedbyclient');}
      calls.push({path:url.pathname,method:req.method()});let body=[];
      if(url.pathname==='/auth/v1/user')body={id:UID,email:'fixture@example.invalid'};
      else if(url.pathname.endsWith('/ps_bootstrap'))body=workspaces;
      else if(url.pathname.endsWith('/ps_members_of_v2')||url.pathname.endsWith('/ps_members_of'))body=[{user_id:UID,name:serverName,email:'fixture@example.invalid',role:'owner'}];
      else if(url.pathname.endsWith('/ps_key_scope'))body='team';
      else if(url.pathname==='/rest/v1/ps_kv'){
        const wid=(url.searchParams.get('workspace_id')||'eq.'+WID).slice(3),keyFilter=url.searchParams.get('k');
        const matches=row=>row.workspace_id===wid&&(!keyFilter||keyFilter==='eq.'+row.k||(keyFilter.startsWith('in.(')&&keyFilter.slice(4,-1).split(',').map(k=>k.replace(/^"|"$/g,'')).includes(row.k)));
        if(req.method()==='GET')body=[...db.values()].filter(matches);
        else if(req.method()==='POST'){
          const posted=req.postDataJSON();body=(Array.isArray(posted)?posted:[posted]).map(row=>{db.set(row.workspace_id+'|'+row.k,{...row});return row;});
        }else if(req.method()==='PATCH'){
          const patch=req.postDataJSON(),expected=url.searchParams.get('cupd');body=[];
          for(const row of db.values())if(matches(row)&&(!expected||expected==='eq.'+row.cupd)){Object.assign(row,patch);body.push(row);}
        }
      }
      await route.fulfill({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(body)});
    });
    const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked()&&localStorage.getItem('ps_last_pull_at'));
      await page.waitForFunction(()=>!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
      await page.waitForTimeout(2800); // Allow the real entry splash animation to finish.
      const bootEvents=[];for(const frame of page.frames())bootEvents.push(...await frame.evaluate(()=>window.__quietEntryEvents||[]));
      assert.deepEqual(bootEvents,[],'Real initial boot shows no transient modal, account menu or legacy notice');
      await page.evaluate(()=>{
        window.__realAutosaveRecovery=window.PSAutosaveRecovery;
        window.__fixtureSaveState={kind:'ok',at:100,n:0,review:0,archivedCount:0};window.__fixtureRetries=0;window.__fixtureChoices=0;window.__fixtureRecovery=0;
        PSSync.state=()=>window.__fixtureSaveState;
        PSSync.syncNow=async()=>{window.__fixtureRetries++;return {pending:1};};
        PSDataReview.open=()=>window.__fixtureChoices++;
        window.PSAutosaveRecovery={open:()=>window.__fixtureRecovery++};
        PSSync.undo.list=()=>[{k:'scout_tool_v1',before:44,after:42,at:Date.now()}];
        PSSync.merge.notes=()=>[{id:'fixture-note',by:'가상 코치',ymd:'2026-09-15',path:'w1.1.match',mine:'가상 기록'}];
      });
      const cases=[
        ['confirmed',{kind:'ok',at:100,n:0,review:0},'저장됨'],
        ['saving',{kind:'busy',n:1,review:0},'저장 중…'],
        ['offline',{kind:'bad',reason:'sync_offline',n:1,review:0},'오프라인 · 저장 대기'],
        ['preserved',{kind:'ask',n:0,review:27},'일부 변경 보관'],
        ['archived',{kind:'ok',at:200,n:0,review:0,archivedCount:27},'일부 변경 별도 보관']
      ];
      for(const [label,state,text] of cases){
        await page.evaluate(state=>{window.__fixtureSaveState=state;window.dispatchEvent(new Event('ps-sync-state'));},state);
        assert.equal(await page.locator('#psSyncStripTx').innerText(),text);
        assert.equal(await page.locator('#psWsModal').count(),0,'Status changes never open a dialog');
        assert.equal(await page.locator('#psUndoBar').isVisible(),false,'Undo recovery stays inside advanced settings');
        assert.equal(await page.locator('#psMergeBar').isVisible(),false,'Merge recovery stays inside advanced settings');
        const strip=await page.locator('#psSyncStrip').boundingBox();assert.ok(strip&&strip.height<=26,'All states use a compact indicator');
        assert.doesNotMatch(await page.locator('#psSyncStrip').innerText(),/27|내용 선택|문서 전체/);
        const overlapsRelease=await page.evaluate(()=>{const a=document.querySelector('#psSyncStrip').getBoundingClientRect();return Array.from(document.querySelectorAll('#psReleaseNotes button')).some(button=>{const b=button.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;});});
        assert.equal(overlapsRelease,false,'A compact state never overlays update controls');
        await page.screenshot({path:path.join(out,spec.width+'-'+label+'.png')});
      }
      await page.locator('#psSyncStripBtn').click();assert.equal(await page.evaluate(()=>window.__fixtureRecovery),1);
      assert.equal(await page.evaluate(()=>window.__fixtureChoices),0);
      await page.locator('#gearBtn').click();await page.locator('#gearPop [data-gp-go="data"]').click();
      assert.equal(await page.locator('#psPushState').innerText(),'일부 변경 별도 보관');
      assert.equal(await page.locator('#psRecoveryOpen').isVisible(),false);
      assert.equal(await page.locator('#gearPop [data-gp-go="data"]').getAttribute('data-dot'),'1');
      await page.locator('#gearPop .gp-grp-adv').click();
      await page.locator('#psAutosaveRecoveryOpen').waitFor({state:'visible'});
      await page.locator('#psUndoDo').waitFor({state:'visible'});await page.locator('#psMergeMine').waitFor({state:'visible'});
      assert.equal(await page.locator('#psRecoveryNotes').getAttribute('data-gp-adv'),'1');
      await page.screenshot({path:path.join(out,spec.width+'-advanced-recovery.png')});
      await page.locator('#psAutosaveRecoveryOpen').click();assert.equal(await page.evaluate(()=>window.__fixtureRecovery),2);
      await page.evaluate(()=>{window.__fixtureSaveState={kind:'ask',n:0,review:27};window.dispatchEvent(new Event('ps-sync-state'));});
      await page.locator('#psPushNow').click();
      await page.waitForFunction(()=>!document.querySelector('#psPushNow').disabled);
      assert.equal(await page.evaluate(()=>window.__fixtureRetries),1);assert.equal(await page.evaluate(()=>window.__fixtureChoices),0);
      assert.equal(await page.locator('#psWsModal').count(),0);
      await page.evaluate(()=>{window.__fixtureSaveState={kind:'ok',at:500,n:0,review:0};window.dispatchEvent(new Event('ps-sync-state'));});
      assert.equal(await page.locator('#psPushState').innerText(),'저장됨');
      assert.equal(await page.locator('#gearPop [data-gp-go="data"]').getAttribute('data-dot'),'0','A confirmed status clears the dot despite the fixed button label');
      // Real recovery component: exact originals are read only on demand.
      const recoveryRow={id:'11111111-1111-4111-8111-111111111111',k:'sq:fixture-player',at:100,cupd:2,reason:'conflict',localHash:'l',remoteHash:'r',wid:'synthetic-team'};
      const originals={metadata:recoveryRow,localRaw:'  {"name":"</textarea><img src=x onerror=window.psarXss=1>","v":"한글"}\r\n\u0000',remoteRaw:'\n { "name": "서버 원문" } \t'};
      await page.evaluate(({row,originals})=>{
        window.__recoveryOwner='fixture-owner';window.__recoveryReads=0;window.__recoveryReadMode='normal';window.__recoveryCopies=[];
        Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>{window.__recoveryCopies.push(text);if(window.__recoveryCopyMode==='wait')return new Promise((_,reject)=>{window.__recoveryCopyReject=reject;});return Promise.resolve();}}});
        window.__recoveryUI=PSAutosaveRecoveryUI.create({context:()=>window.__recoveryOwner,list:async()=>[row],read:async()=>{window.__recoveryReads++;if(window.__recoveryReadMode==='wait')return new Promise(resolve=>{window.__recoveryReadResolve=resolve;});return originals;},label:()=>'<img src=x onerror=window.psarXss=2> 보관된 선수'});
      },{row:recoveryRow,originals});
      assert.equal(await page.locator('#psAutosaveRecoveryDialog').count(),0,'Constructing recovery never opens it');
      await page.evaluate(()=>window.__recoveryUI.open());
      assert.equal(await page.evaluate(()=>window.__recoveryReads),0,'Opening reads metadata only');
      await page.locator('[data-psar-id]').click();await page.locator('[data-psar-action="copy"]').waitFor({state:'visible'});
      assert.equal(await page.getByLabel('이 기기의 변경 원문',{exact:true}).inputValue(),originals.localRaw.replace(/\r\n?/g,'\n'),'Textarea display uses browser line endings; export below must remain exact');
      assert.equal(await page.getByLabel('당시 서버 원문',{exact:true}).inputValue(),originals.remoteRaw.replace(/\r\n?/g,'\n'));
      assert.equal(await page.evaluate(()=>window.psarXss),undefined);
      await page.locator('[data-psar-action="copy"]').click();
      const copied=JSON.parse(await page.evaluate(()=>window.__recoveryCopies.at(-1)));assert.equal(copied.localRaw,originals.localRaw);assert.equal(copied.remoteRaw,originals.remoteRaw);
      const downloading=page.waitForEvent('download');await page.locator('[data-psar-action="download"]').click();const downloaded=await downloading;
      const artifactPath=path.join(out,spec.width+'-originals.json');await downloaded.saveAs(artifactPath);const saved=JSON.parse(fs.readFileSync(artifactPath,'utf8'));assert.equal(saved.localRaw,originals.localRaw);assert.equal(saved.remoteRaw,originals.remoteRaw);
      await page.screenshot({path:path.join(out,spec.width+'-exact-recovery.png')});
      await page.evaluate(()=>{window.__recoveryCopyMode='wait';});await page.locator('[data-psar-action="copy"]').click();
      await page.evaluate(()=>{window.__recoveryOwner='changed-owner';window.dispatchEvent(new Event('ps-sync-state'));window.__recoveryCopyReject(new Error('fixture clipboard rejected'));});
      assert.equal(await page.locator('#psAutosaveRecoveryDialog').count(),0,'Owner change removes originals and late clipboard fallback');
      await page.evaluate(()=>{window.__recoveryOwner='fixture-owner';window.__recoveryReadMode='wait';return window.__recoveryUI.open();});
      await page.locator('[data-psar-id]').click();await page.waitForFunction(()=>typeof window.__recoveryReadResolve==='function');
      await page.evaluate(originals=>{window.__recoveryOwner='changed-owner';window.dispatchEvent(new Event('ps-sync-state'));window.__recoveryReadResolve(originals);},originals);
      assert.equal(await page.locator('#psAutosaveRecoveryDialog').count(),0,'Late original read never reopens a revoked view');
      // The shell button also uses the real sync.js bridge and IndexedDB journal.
      const realArchive=await page.evaluate(async({UID,WID,originals})=>{
        window.__recoveryUI.destroy();window.PSAutosaveRecovery=window.__realAutosaveRecovery;
        if(!window.PSAutosaveRecovery||!PSAutosaveRecovery.open)throw new Error('Actual recovery bridge missing');
        const ctx={uid:UID,wid:WID,seal:'synthetic-journal-fixture',epoch:0};
        const journal=PSAutoSaveJournal.create({storage:window.storage,context:()=>ctx});
        const row=await journal.archive(ctx,'sq:fixture-player',originals.localRaw,originals.remoteRaw,2,'conflict');
        window.__fixtureSaveState={kind:'ok',at:600,n:0,review:0,archivedCount:1};window.dispatchEvent(new Event('ps-sync-state'));
        document.querySelector('#gearPop').classList.remove('on');
        return row;
      },{UID,WID,originals});
      await page.locator('#psSyncStripBtn').click();await page.locator('[data-psar-id="'+realArchive.id+'"]').waitFor({state:'visible'});
      assert.equal(await page.locator('#psAutosaveRecoveryDialog textarea').count(),0,'The actual bridge starts with metadata only');
      await page.locator('[data-psar-id="'+realArchive.id+'"]').click();await page.locator('[data-psar-action="copy"]').waitFor({state:'visible'});
      await page.evaluate(()=>{window.__recoveryCopyMode='normal';});await page.locator('[data-psar-action="copy"]').click();
      const realCopied=JSON.parse(await page.evaluate(()=>window.__recoveryCopies.at(-1)));assert.equal(realCopied.localRaw,originals.localRaw);assert.equal(realCopied.remoteRaw,originals.remoteRaw);assert.equal(realCopied.metadata.wid,WID);
      await page.screenshot({path:path.join(out,spec.width+'-real-bridge-recovery.png')});
      await page.evaluate(()=>{localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:'changed-synthetic-owner',wid:'changed-synthetic-team'}));window.dispatchEvent(new Event('ps-sync-state'));});
      assert.equal(await page.locator('#psAutosaveRecoveryDialog').count(),0,'The real ownership fence revokes the open recovery view');
      const runtimeErrors=errors.filter(e=>!/^ResizeObserver loop (completed with undelivered notifications\.|limit exceeded)$/.test(e));
      assert.deepEqual(runtimeErrors,[],'No runtime errors');
      results.push({width:spec.width,compactStates:cases.length,noBootPopup:true,noAutomaticDialog:true,advancedRecovery:true,noDocumentChoices:true,exactOriginalExport:true,recoveryOwnerGuard:true,realRecoveryBridge:true,passed:true});
      console.log(JSON.stringify(results.at(-1)));
    }catch(e){await page.screenshot({path:path.join(out,spec.width+'-failure.png')}).catch(()=>{});throw e;}
    finally{fs.writeFileSync(path.join(out,spec.width+'-network.json'),JSON.stringify({calls,blocked,errors},null,2));await context.close();}
  }
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,engine:'chromium',network:'All external requests mocked or blocked. Synthetic accounts and status fixtures only.',results},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
