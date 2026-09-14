import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Real app/board/sync entry in isolated synthetic team accounts. Every external
// request is fulfilled with a fixture or blocked, including realtime sockets.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/process-quiet-entry-browser';
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
  for(const spec of [{width:393,height:852,mobile:true},{width:1280,height:900,mobile:false}])for(const serverName of ['', '가상 테스트 코치']){
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
      for(const phase of ['open','reload']){
        const previousPull=phase==='reload'?await page.evaluate(()=>localStorage.getItem('ps_last_pull_at')):null;
        if(phase==='open')await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(previous=>window.PSSync&&PSSync.dataUnlocked()&&localStorage.getItem('ps_last_pull_at')&&localStorage.getItem('ps_last_pull_at')!==previous,previousPull);
        await page.waitForFunction(()=>!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
        await page.waitForFunction(()=>{try{return document.querySelector('#fBoard')?.contentDocument?.querySelector('#hint');}catch{return false;}});
        // renderUI schedules name hydration after 600 ms. Observe beyond that
        // timer and the board's boot hint without clicking or hiding anything.
        await page.waitForTimeout(2800);
        if(serverName)assert.equal(await page.evaluate(()=>localStorage.getItem('ps_display_name')),serverName,'server name hydrates silently');
        else assert.equal(await page.evaluate(()=>localStorage.getItem('ps_display_name')),null,'missing name stays optional');
        assert.equal(await page.locator('#psWsModal').count(),0,'ordinary entry opens no modal');
        assert.equal(await page.locator('#psAcctWrap .acct-pop.on').count(),0,'ordinary entry leaves account menu closed');
        const automatic=[];for(const frame of page.frames())automatic.push(...await frame.evaluate(()=>window.__quietEntryEvents||[]));
        assert.deepEqual(automatic,[],'no transient automatic name/account/legacy notice UI');
        await page.screenshot({path:path.join(out,label+'-'+phase+'.png')});
      }
      const release=page.locator('#psReleaseNotes');await release.waitFor({state:'visible'});
      assert.match(await release.innerText(),/최근 업데이트/);
      const releaseStatusOverlap=await page.evaluate(()=>{
        const status=document.querySelector('#psSyncStrip');if(!status||!status.checkVisibility())return false;
        const a=status.getBoundingClientRect();return Array.from(document.querySelectorAll('#psReleaseNotes button')).some(button=>{
          const b=button.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
        });
      });
      assert.equal(releaseStatusOverlap,false,'The synchronization status must not overlay release notice actions');
      await page.screenshot({path:path.join(out,label+'-release-support-entry.png')});
      if(spec.mobile){
        await page.locator('#gearBtn').tap();await page.locator('#gearPop [data-gp-go="general"]').click();
        await page.locator('#psSupportSettingsOpen').waitFor({state:'visible'});await page.locator('#psSupportSettingsOpen').click();
      }else{
        const gear=await page.locator('#gearBtn').boundingBox(),support=await page.locator('#psSupportOpen').boundingBox();
        assert.ok(gear&&support&&support.y>=gear.y+gear.height,'Desktop support entry sits below app settings');
        await page.locator('#psSupportOpen').click();
      }
      const supportDialog=page.locator('#psSupportDialog');await supportDialog.waitFor({state:'visible'});
      assert.equal(await supportDialog.evaluate(el=>el.open),true);assert.match(await supportDialog.innerText(),/제보 작성/);
      await page.screenshot({path:path.join(out,label+'-support-dialog.png')});
      await supportDialog.getByRole('button',{name:'오류 제보 닫기',exact:true}).click();assert.equal(await supportDialog.evaluate(el=>el.open),false);
      await release.getByRole('button',{name:'일주일간 안 보기',exact:true}).click();assert.equal(await release.isVisible(),false);
      const releaseHide=await page.evaluate(()=>JSON.parse(localStorage.getItem(PSReleaseNotes.STORAGE_KEY)));
      assert.equal(releaseHide.until-releaseHide.from,7*24*60*60*1000,'Real shell saves a seven-day release notice hide');
      const acct=page.locator('#psAcctWrap .acct-btn');if(spec.mobile)await acct.tap();else await acct.click();
      const nameButton=page.locator('#psAcctWrap .acct-pop.on button').filter({hasText:serverName?'표시 이름: '+serverName:'표시 이름 설정'});
      await nameButton.click();await page.locator('#psWsModal').waitFor({state:'visible'});assert.match(await page.locator('#psWsModal').innerText(),/표시 이름/);
      assert.equal(await page.locator('#psWsModal input').inputValue(),serverName,'manual name editor retains hydrated name');
      await page.screenshot({path:path.join(out,label+'-manual-name.png')});
      assert.ok(calls.some(c=>c.path.endsWith('/ps_members_of_v2')),'real server-name hydration path ran');
      const runtimeErrors=errors.filter(e=>!/^ResizeObserver loop (completed with undelivered notifications\.|limit exceeded)$/.test(e));
      assert.deepEqual(runtimeErrors,[],'no JavaScript runtime errors');
      results.push({viewport:spec,serverName:!!serverName,open:true,reload:true,manualNameEditor:true,silentHydration:!!serverName,releaseBanner:true,releaseNoStatusOverlap:true,releaseSevenDayHide:true,supportEntry:true,passed:true});
      console.log(JSON.stringify({label,passed:true}));
    }catch(e){await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw e;}
    finally{fs.writeFileSync(path.join(out,label+'-network.json'),JSON.stringify({calls,blocked,errors},null,2));await context.close();}
  }
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,engine:'chromium',network:'All external auth/data requests mocked; other network and realtime sockets blocked. Synthetic accounts only.',results},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
