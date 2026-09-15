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
        window.__fixtureRetries=0;window.__fixtureRecoveryOpens=0;
        PSSync.syncNow=async()=>{window.__fixtureRetries++;return new Promise(resolve=>{window.__fixtureRetryResolve=resolve;});};
        window.PSAutosaveRecovery={open:()=>{window.__fixtureRecoveryOpens++;}};
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
      async function footerGeometry(){
        return page.evaluate(()=>{
          const rect=(el,offset={left:0,top:0})=>{const r=el.getBoundingClientRect(),sx=offset.scaleX||1,sy=offset.scaleY||1;return {left:r.left*sx+offset.left,right:r.right*sx+offset.left,top:r.top*sy+offset.top,bottom:r.bottom*sy+offset.top,width:r.width*sx,height:r.height*sy};};
          const visible=el=>!!el&&el.checkVisibility({opacityProperty:true,visibilityProperty:true});
          const strip=document.getElementById('psSyncStrip'),tx=document.getElementById('psSyncStripTx'),btn=document.getElementById('psSyncStripBtn'),fr=document.getElementById('fBoard'),f=rect(fr),doc=fr.contentDocument,style=getComputedStyle(strip);
          // At tablet widths the shell scales its wider board iframe. Child
          // DOMRects are in that unscaled viewport, so convert both axes.
          const childOffset={left:f.left,top:f.top,scaleX:f.width/fr.clientWidth,scaleY:f.height/fr.clientHeight};
          const controls=['#dfNew','#vaultSave','#ps-command-dock','#ps-dock','#animBar'].map(selector=>{const el=doc.querySelector(selector);return visible(el)?{selector,rect:rect(el,childOffset)}:null;}).filter(Boolean);
          const navs=['#appSeg','#teamBottom'].map(selector=>{const el=document.querySelector(selector);return visible(el)&&rect(el).top>innerHeight/2?{selector,rect:rect(el)}:null;}).filter(Boolean);
          const b=rect(btn),hit=visible(btn)?document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2):null;
          return {strip:rect(strip),text:rect(tx),button:visible(btn)?{rect:b,disabled:btn.disabled,hit:hit===btn||btn.contains(hit),label:btn.textContent}:null,visible:visible(strip),main:rect(document.querySelector('.frames')),frame:f,controls,navs,viewport:{width:innerWidth,height:innerHeight},style:{position:style.position,fontSize:parseFloat(style.fontSize),fontWeight:style.fontWeight,color:style.color,textAlign:style.textAlign,justifyContent:style.justifyContent,pulse:getComputedStyle(strip.querySelector('i')).animationName},content:tx.textContent};
        });
      }
      function assertFooter(g,s,editor=false){
        if(measureOnly)return;
        const label=spec.width+'px '+s.kind+(editor?' editor':''),r=g.strip;
        assert.equal(r.height,24,label+' uses a stable 24px footer slot');
        assert.ok(r.left>=-.5&&r.right<=g.viewport.width+.5&&r.bottom<=g.viewport.height+.5,label+' is inside the viewport');
        assert.ok(g.main.bottom<=r.top+.5&&g.frame.bottom<=r.top+.5,label+' sits below the actual content and iframe');
        assert.ok(g.viewport.height-r.bottom<=80,label+' stays near the bottom edge');
        const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
        for(const n of g.navs){assert.ok(r.bottom<=n.rect.top+.5,label+' is above '+n.selector);assert.equal(overlap(r,n.rect),false,label+' avoids navigation');}
        for(const c of g.controls)assert.equal(overlap(r,c.rect),false,label+' avoids '+c.selector);
        const attention=s.kind==='bad'||s.kind==='held'||s.kind==='ask'||s.archivedCount>0;
        assert.equal(g.visible,s.kind!=='off'&&(!editor||attention),label+' has the expected visibility');
        if(!g.visible)return;
        const edge=g.button?g.button.rect.right:g.text.right;
        assert.ok(g.viewport.width-edge>=0&&g.viewport.width-edge<=24,label+' content is aligned at the right edge');
        if(g.button){assert.equal(g.button.hit,true,label+' action has an unobstructed hit target');assert.equal(g.button.disabled,false,label+' action remains enabled');}
        if(s.kind==='busy'||s.kind==='ok'&&!s.archivedCount){
          assert.ok(g.style.fontSize<=11.5&&Number(g.style.fontWeight)<=500,label+' stays small and quiet');
          const rgb=g.style.color.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
          assert.ok(rgb.length===3&&Math.max(...rgb)-Math.min(...rgb)<=30,label+' uses a neutral text color');
          assert.equal(g.style.pulse,'none',label+' does not flash');
        }
      }
      async function banner(shown){
        if(shown){
          await page.evaluate(()=>{localStorage.removeItem('ps_release_notes_hidden_v1');document.getElementById('psReleaseNotes').__psReleaseNotes.refresh();});
          assert.equal(await page.locator('#psReleaseNotes').isVisible(),true);
        }else{
          await page.locator('#psReleaseNotes').getByRole('button',{name:'일주일간 안 보기',exact:true}).click();
          assert.equal(await page.locator('#psReleaseNotes').isVisible(),false);
        }
      }
      for(const editor of [false,true])for(const shown of [true,false]){
        // This is the shell's existing editor-mode class, intentionally applied
        // over the same scrollable list so geometry remains directly comparable.
        await page.evaluate(editor=>document.body.classList.toggle('ps-editor-open',editor),editor);
        await banner(shown);
        await state(states[0][1]);
        const scrolled=await frame.locator('#sessionView .sess-wrap').evaluate(el=>{el.scrollTop=500;return {top:el.scrollTop,range:el.scrollHeight-el.clientHeight};});
        assert.ok(scrolled.top>100&&scrolled.range>600,'Actual vault list must be genuinely scrollable');
        const initial=await geometry(),phase={bannerShown:shown,editorMarker:editor,initial,transitions:[]};report.phases.push(phase);
        for(const [name,s] of states){
          await state(s);const g=await geometry(),footer=await footerGeometry(),delta={};
          for(const k of ['main','frame','scrollBox','anchor'])for(const axis of ['top','height'])delta[k+'.'+axis]=g[k][axis]-initial[k][axis];
          delta.scrollTop=g.scrollTop-initial.scrollTop;delta.documentScroll=g.documentScroll-initial.documentScroll;delta.childDocumentScroll=g.childDocumentScroll-initial.childDocumentScroll;
          const moved=Object.entries(delta).filter(([,v])=>Math.abs(v)>.5);
          phase.transitions.push({name,geometry:g,footer,delta,moved});
          assert.equal(await page.locator('#psWsModal').count(),0,'A status transition must not open a modal');
          if(!measureOnly)assert.deepEqual(moved,[],`${spec.width}px, banner ${shown}, ${name}: status changed list geometry/scroll`);
          assertFooter(footer,s,editor);
          if(['ok','bad','archived'].includes(name))await page.screenshot({path:path.join(out,spec.width+'-'+(editor?'editor-':'')+(shown?'banner':'no-banner')+'-'+name+'.png')});
        }
      }
      await page.evaluate(()=>document.body.classList.remove('ps-editor-open'));
      await banner(true);await state({kind:'bad',reason:'sync_storage',n:1});
      const actionBefore=await geometry();
      await page.locator('#psSyncStripBtn').focus();await page.locator('#psSyncStripBtn').press('Enter');
      await page.waitForFunction(()=>typeof window.__fixtureRetryResolve==='function');
      assert.equal(await page.evaluate(()=>window.__fixtureRetries),1,'Bottom retry uses the real autosave retry handler once');
      assert.equal(await page.locator('#psSyncStripTx').innerText(),'저장 중…');
      assert.equal(await page.locator('#psSyncStripBtn').isVisible(),false,'No duplicate retry action while saving');
      await page.evaluate(()=>{
        window.__fixtureSaveState={kind:'ok',at:Date.now(),n:0};
        window.__fixtureRetryResolve({saved:1});
      });
      await page.waitForFunction(()=>document.getElementById('psSyncStripTx').textContent==='저장됨');
      const actionAfter=await geometry();
      for(const k of ['main','frame','scrollBox','scrollTop','anchor'])assert.deepEqual(actionAfter[k],actionBefore[k],'Retry and ACK preserve '+k);
      await state({kind:'ok',at:Date.now()+1,n:0,archivedCount:2});
      assert.equal(await page.locator('#psSyncStripBtn').innerText(),'보관 내용');await page.locator('#psSyncStripBtn').click();
      assert.equal(await page.evaluate(()=>window.__fixtureRecoveryOpens),1,'Bottom recovery button reaches the existing advanced recovery action');
      report.actions={retry:1,confirmedAck:true,recovery:1};
      await page.evaluate(()=>window.__psShowApp('board'));
      await frame.locator('#boardView').waitFor({state:'visible'});await page.waitForTimeout(900);
      report.boardPhases=[];
      for(const shown of [true,false]){
        await banner(shown);await state(states[0][1]);
        const initial=await footerGeometry(),phase={bannerShown:shown,initial,transitions:[]};report.boardPhases.push(phase);
        for(const [name,s] of states){
          await state(s);const g=await footerGeometry();phase.transitions.push({name,geometry:g});
          if(!measureOnly){assert.deepEqual(g.main,initial.main,'Board container stays still: '+name);assert.deepEqual(g.frame,initial.frame,'Board iframe stays still: '+name);}
          assertFooter(g,s);
          if(['ok','bad'].includes(name))await page.screenshot({path:path.join(out,spec.width+'-board-'+(shown?'banner':'no-banner')+'-'+name+'.png')});
        }
      }
      if(spec.mobile){
        // Exercise the second real fixed navigation, whose height differs
        // from the normal application menu, without loading unrelated tools.
        await page.evaluate(()=>{document.body.classList.add('ps-team-open');document.getElementById('teamBottom').hidden=false;dispatchEvent(new Event('resize'));});
        await page.locator('#teamBottom').waitFor({state:'visible'});await page.waitForTimeout(250);
        await state({kind:'busy',n:1});const before=await footerGeometry();assertFooter(before,{kind:'busy',n:1});
        assert.ok(before.navs.some(n=>n.selector==='#teamBottom'),'Team navigation participates in the actual footer boundary');
        await state({kind:'bad',reason:'sync_storage',n:1});const after=await footerGeometry();assertFooter(after,{kind:'bad',reason:'sync_storage',n:1});
        assert.deepEqual(after.frame,before.frame,'Team navigation + save status changes do not move the board');
        report.teamNavigation={before,after};
        await page.screenshot({path:path.join(out,spec.width+'-team-nav-bad.png')});
      }
      assert.deepEqual(errors.filter(e=>!/^ResizeObserver loop/.test(e)),[]);
      report.passed=true;console.log(JSON.stringify({width:report.width,phases:report.phases.map(p=>({bannerShown:p.bannerShown,editorMarker:p.editorMarker,transitions:p.transitions.map(t=>({name:t.name,stripHeight:t.geometry.strip.height,moved:t.moved}))}))}));
    }catch(e){report.passed=false;report.error=e.stack;await page.screenshot({path:path.join(out,spec.width+'-failure.png')}).catch(()=>{});}
    finally{fs.writeFileSync(path.join(out,spec.width+'-network.json'),JSON.stringify({calls,blocked,errors},null,2));await context.close();}
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
const verification={passed:results.length>0&&results.every(r=>r.passed),measureOnly,baseline:baseline||'working-tree',engine:'chromium',network:'Actual app with all external requests mocked or blocked; synthetic vault records only.',results};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(verification,null,2));if(!verification.passed)process.exitCode=1;
