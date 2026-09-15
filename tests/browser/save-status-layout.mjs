import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Real shell and status renderer with synthetic state fixtures. Every external
// request is mocked or blocked. No production data is read or modified.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||'/private/tmp/process-save-status-layout';
const measureOnly=process.env.PS_LAYOUT_MEASURE_ONLY==='1',baseline=process.env.PS_LAYOUT_BASELINE;
const frozen=new Map(['studio/app.html','studio/support.css'].map(p=>[path.join(root,p),baseline?execFileSync('git',['show',baseline+':'+p],{cwd:root}):fs.readFileSync(path.join(root,p))]));
fs.mkdirSync(out,{recursive:true});
const UID='99999999-9999-4999-8999-999999999999',WID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',PWID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const workspaces=[{id:WID,kind:'team',name:'가상 테스트 팀',role:'owner',owner_id:UID},{id:PWID,kind:'personal',name:'가상 개인 작업',role:'owner',owner_id:UID}];
// Deliberately omit staffEdit and the old notice-seen flag, exercising the old
// automatic migration notice trigger rather than suppressing it in the fixture.
const perms=JSON.stringify({members:{[UID]:{role:'admin'}},defaultRole:'player'});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  try{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep))throw 0;
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(frozen.get(file)||fs.readFileSync(file));
  }catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,results=[];
let browser;
try{
  browser=await pw.chromium.launch({headless:true,executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const spec of [{width:1280,height:900,mobile:false},{width:768,height:900,mobile:false},{width:393,height:852,mobile:true}])for(const serverName of ['가상 테스트 코치']){
    const label=spec.width+'-'+(serverName?'server-name':'no-name'),calls=[],blocked=[],errors=[];
    if(process.env.PS_TEST_LABEL&&process.env.PS_TEST_LABEL!==label)continue;
    const db=new Map([[WID+'|cs_perms_v1',{workspace_id:WID,k:'cs_perms_v1',v:perms,cupd:1,updated_by:UID}]]);
    const library=new Map();
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:spec.mobile,hasTouch:spec.mobile,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    await context.addInitScript(({UID,WID,workspaces,perms})=>{
      if(!localStorage.getItem('quiet_fixture_seeded')){
        localStorage.setItem('ps_sync_session',JSON.stringify({uid:UID,at:'synthetic-at',rt:'synthetic-rt',exp:Date.now()+3600000,email:'fixture@example.invalid'}));
        localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid:UID,wid:WID}));localStorage.setItem('ps_active_ws',WID);
        localStorage.setItem('ps_ws_list',JSON.stringify(workspaces));localStorage.setItem('cs_perms_v1',perms);localStorage.setItem('quiet_fixture_seeded','1');
      }
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
      else if(url.pathname==='/rest/v1/ps_library'){
        if(req.method()==='POST'){
          const rows=req.postDataJSON();body=(Array.isArray(rows)?rows:[rows]).map(row=>{library.set(row.lib_id,row);return row;});
        }else body=[...library.values()];
      }
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
    const report={width:spec.width,phases:[],errors};results.push(report);
    try{
      await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked()&&localStorage.getItem('ps_last_pull_at'));
      await page.waitForFunction(()=>!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
      const frame=await page.locator('#fBoard').contentFrame();
      await frame.locator('#sessionView').waitFor({state:'attached'});
      await page.waitForTimeout(2800);
      await page.evaluate(()=>{
        window.__fixtureSaveState={kind:'ok',at:100,n:0,review:0};
        PSSync.state=()=>window.__fixtureSaveState;
        PSSync.syncNow=async()=>({pending:1});
        window.__psShowApp('design');
      });
      await frame.locator('#sessionView').waitFor({state:'visible'});
      await frame.locator('#drillFiles').evaluate(async(_,uid)=>{
        const sn=captureSnap();sn.players=[];sn.equipment=[];sn.drawings=[];sn.ball=null;
        const thumb='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#edf2ef"/></svg>';
        await libWrite(Array.from({length:60},(_,i)=>({libId:'layout-fixture-'+i,type:'board',name:'가상 보관 자료 '+String(i+1).padStart(2,'0'),createdBy:uid,author:'가상 테스트 코치',savedAt:i+1,thumb,snap:sn})));
        libTouch();setView('session');
      },UID);
      await frame.locator('.vcard').nth(30).waitFor({state:'attached'});
      await page.waitForTimeout(700);
      const states=[
        ['off',{kind:'off'}],['busy',{kind:'busy',n:1}],['ok',{kind:'ok',at:100,n:0}],
        ['pending',{kind:'pending',n:1}],['bad',{kind:'bad',reason:'sync_storage',n:1}],
        ['archived',{kind:'ok',at:200,n:0,archivedCount:2}],['busy-again',{kind:'busy',n:1}],
        ['ok-again',{kind:'ok',at:300,n:0}],['off-again',{kind:'off'}]
      ];
      async function state(s){
        await page.evaluate(s=>{window.__fixtureSaveState=s;dispatchEvent(new Event('ps-sync-state'));},s);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.waitForTimeout(120);
      }
      async function geometry(){
        return page.evaluate(()=>{
          const box=e=>{const r=e.getBoundingClientRect();return {top:r.top,height:r.height};};
          const f=document.getElementById('fBoard'),doc=f.contentDocument,scroller=doc.querySelector('#sessionView .sess-wrap'),anchor=doc.querySelectorAll('.vcard')[10],strip=document.getElementById('psSyncStrip');
          return {main:box(document.querySelector('.frames')),frame:box(f),scrollBox:box(scroller),scrollTop:scroller.scrollTop,anchor:box(anchor),documentScroll:document.scrollingElement.scrollTop,childDocumentScroll:doc.scrollingElement.scrollTop,strip:{...box(strip),display:getComputedStyle(strip).display,position:getComputedStyle(strip).position,text:strip.innerText},banner:box(document.getElementById('psReleaseNotes'))};
        });
      }
      for(const editor of [false,true])for(const shown of [true,false]){
        // This is the shell's existing editor-mode class, intentionally applied
        // over the same scrollable list so geometry remains directly comparable.
        await page.evaluate(editor=>document.body.classList.toggle('ps-editor-open',editor),editor);
        if(shown){
          await page.evaluate(()=>{localStorage.removeItem('ps_release_notes_hidden_v1');document.getElementById('psReleaseNotes').__psReleaseNotes.refresh();});
          assert.equal(await page.locator('#psReleaseNotes').isVisible(),true);
        }else{
          await page.locator('#psReleaseNotes').getByRole('button',{name:'일주일간 안 보기',exact:true}).click();
          assert.equal(await page.locator('#psReleaseNotes').isVisible(),false);
        }
        await state(states[0][1]);
        const scrolled=await frame.locator('#sessionView .sess-wrap').evaluate(el=>{el.scrollTop=500;return {top:el.scrollTop,range:el.scrollHeight-el.clientHeight};});
        assert.ok(scrolled.top>100&&scrolled.range>600,'Actual vault list must be genuinely scrollable');
        const initial=await geometry(),phase={bannerShown:shown,editorMarker:editor,initial,transitions:[]};report.phases.push(phase);
        for(const [name,s] of states){
          await state(s);const g=await geometry(),delta={};
          for(const k of ['main','frame','scrollBox','anchor'])for(const axis of ['top','height'])delta[k+'.'+axis]=g[k][axis]-initial[k][axis];
          delta.scrollTop=g.scrollTop-initial.scrollTop;delta.documentScroll=g.documentScroll-initial.documentScroll;delta.childDocumentScroll=g.childDocumentScroll-initial.childDocumentScroll;
          const moved=Object.entries(delta).filter(([,v])=>Math.abs(v)>.5);
          phase.transitions.push({name,geometry:g,delta,moved});
          assert.equal(await page.locator('#psWsModal').count(),0,'A status transition must not open a modal');
          if(!measureOnly)assert.deepEqual(moved,[],`${spec.width}px, banner ${shown}, ${name}: status changed list geometry/scroll`);
          if(editor)assert.equal(await page.locator('#psSyncStrip').isVisible(),false,'Editor mode keeps status hidden');
          if(['ok','bad','archived'].includes(name))await page.screenshot({path:path.join(out,spec.width+'-'+(editor?'editor-':'')+(shown?'banner':'no-banner')+'-'+name+'.png')});
        }
      }
      assert.deepEqual(errors.filter(e=>!/^ResizeObserver loop/.test(e)),[]);
      report.passed=true;console.log(JSON.stringify({width:report.width,phases:report.phases.map(p=>({bannerShown:p.bannerShown,editorMarker:p.editorMarker,transitions:p.transitions.map(t=>({name:t.name,stripHeight:t.geometry.strip.height,moved:t.moved}))}))}));
    }catch(e){report.passed=false;report.error=e.stack;await page.screenshot({path:path.join(out,spec.width+'-failure.png')}).catch(()=>{});}
    finally{fs.writeFileSync(path.join(out,spec.width+'-network.json'),JSON.stringify({calls,blocked,errors},null,2));await context.close();}
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
const verification={passed:results.length>0&&results.every(r=>r.passed),measureOnly,baseline:baseline||'working-tree',engine:'chromium',network:'Actual app with all external requests mocked or blocked; synthetic vault records only.',results};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(verification,null,2));if(!verification.passed)process.exitCode=1;
