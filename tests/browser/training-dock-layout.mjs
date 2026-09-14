import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',baseline=process.env.PS_TRAINING_BASELINE==='1';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/training-dock-layout',engine,baseline?'before':'after');fs.mkdirSync(out,{recursive:true});
const before=baseline?execFileSync('git',['show',(process.env.PS_TRAINING_BASE_REF||'9b49d8df7a5e14bee6f3d80c8ddfaf6109596908')+':studio/board.html'],{cwd:root,encoding:'utf8',maxBuffer:5e6}):null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(p==='/studio/sync.js'?'/* isolated PSSync fixture installed before page load */':p==='/studio/board.html'&&before?before:fs.readFileSync(f));}catch{res.writeHead(404).end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
const results=[];let browser;
const settle=page=>page.waitForTimeout(300);
async function inspect(frame){return frame.evaluate(()=>{
  const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
  const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,label:e.getAttribute('aria-label')||e.title||e.textContent.trim(),visible:visible(e),x:r.x,y:r.y,w:r.width,h:r.height,hit:hit?.closest('button')?.id||hit?.id||hit?.tagName||'',centerOwned:!!hit&&(e===hit||e.contains(hit)),display:getComputedStyle(e).display,parent:e.parentElement?.id};};
  const controls=[...document.querySelectorAll('#ps-command-dock button,#ps-command-dock select,#railEquip .chip')].filter(visible).map(box);
  const collisions=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j],x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(x>.5&&y>.5)collisions.push({a:a.id||a.label,b:b.id||b.label,w:x,h:y});}
  return {body:document.body.className,view:window.__csView,viewport:{width:innerWidth,height:innerHeight},save:box(document.getElementById('vaultSave')),editorSave:box(document.getElementById('editorDone')),settings:box(document.getElementById('viewBtn')),undo:box(document.getElementById('undoBtn')),redo:box(document.getElementById('redoBtn')),dock:box(document.getElementById('ps-command-dock')),controls,collisions};
});}
function check(g,editing){
  for(const c of [g.settings,g.undo,g.redo])assert.ok(c?.visible&&c.w>0&&c.h>0,c?.id+' visible');
  assert.deepEqual(g.collisions,[],'dock controls do not overlap');
  if(editing){assert.equal(g.save.visible,false,'working-board save hidden in training editor');assert.ok(g.editorSave.visible&&g.editorSave.centerOwned,'training save remains actionable');}
  else assert.ok(g.save.visible&&g.save.centerOwned,'working-board save restored');
}
async function enter(page,frame){
  // Existing shell route; all create/editor interactions use original DOM handlers.
  await page.evaluate(()=>document.querySelector('#appSeg [data-app=design]').click());
  await frame.locator('#dfNew').waitFor({state:'visible'});await frame.locator('#dfNew').click();
  await frame.locator('#vCreateChooser .vcc-item').filter({hasText:'훈련 설계'}).click();
  await frame.locator('body.editing #editorModal.on').waitFor();await settle(page);
}
async function history(frame){
  await frame.evaluate(()=>{state.players=[];renderTokens();undoStack=[];redoStack=[];pushUndo();state.players=[{id:'fixture-player',team:'A',num:7,name:'가상 선수',x:600,y:350}];renderTokens();});
  await frame.locator('#undoBtn').click();assert.equal(await frame.evaluate(()=>state.players.length),0);
  await frame.locator('#redoBtn').click();assert.equal(await frame.evaluate(()=>state.players.length),1);
}
try{
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
 for(const spec of [{width:1280,height:900},{width:1440,height:900},{width:1728,height:1117},{width:1024,height:768,touch:true}].filter(s=>!process.env.PS_TEST_WIDTHS||process.env.PS_TEST_WIDTHS.split(',').includes(String(s.width)))){
  const result={spec,baseline,states:[],errors:[]};results.push(result);
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},screen:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.touch,serviceWorkers:'block',...(spec.touch?{userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  await context.addInitScript(()=>{
    const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222';
    if(!localStorage.getItem('fixture-seeded')){localStorage.setItem('fixture-seeded','1');localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-only',rt:'fixture-only',exp:Date.now()+86400000}));localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner',name:'가상 팀'}]));localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[uid]:{role:'executive'}}}));localStorage.setItem('cs_lang','ko');localStorage.setItem('cs_theme','light');}
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')),activeWs:()=>wid,activeWsObj:()=>({id:wid,kind:'team',role:'owner',name:'가상 팀'}),dataUnlocked:()=>true,keyReady:()=>true,displayName:()=> '가상 코치',state:()=>({status:'ok'}),pendingInfo:()=>({count:0}),act(){},ping(){},event(){},syncNow:()=>Promise.resolve({})};
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>result.errors.push(e.message));
  try{
   await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
   const frame=await page.locator('#fBoard').elementHandle().then(e=>e.contentFrame());
   await frame.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window.__psPages&&document.getElementById('ps-command-dock'));
   await page.waitForTimeout(1400);await page.mouse.move(0,0);
   const initial=await inspect(frame);result.states.push({stage:'board',...initial});if(!baseline)check(initial,false);
   await enter(page,frame);await page.mouse.move(0,0);
   const edit=await inspect(frame);result.states.push({stage:'training',...edit});await page.screenshot({path:path.join(out,spec.width+'-training.png')});
   if(!baseline){
    check(edit,true);await history(frame);
    await frame.locator('#viewBtn').click();assert.ok(await frame.locator('#cmd-board-settings-pop').isVisible());await frame.locator('#cmd-board-settings-close').click();
    await frame.locator('#editorCancel').click();await frame.locator('#editorModal').waitFor({state:'hidden'});
    await page.evaluate(()=>document.querySelector('#appSeg [data-app=board]').click());await settle(page);
    const returned=await inspect(frame);result.states.push({stage:'returned',...returned});check(returned,false);await history(frame);
    await frame.locator('#viewBtn').click();assert.ok(await frame.locator('#cmd-board-settings-pop').isVisible());await frame.locator('#cmd-board-settings-close').click();
    // Original library-save handler opens its normal save sheet. Cancel instead
    // of writing a board; training's own save below writes only fake local data.
    await frame.locator('#vaultSave').click();await frame.locator('#pssName').waitFor({state:'visible'});await frame.locator('#pssCancel').click();
    await enter(page,frame);await frame.locator('#epNameTop').fill('가상 훈련 도크 검증');await frame.locator('#editorDone').click();
    await frame.waitForFunction(async()=>((await store.get('cs_drill_lib_v1'))||[]).some(d=>d.name==='가상 훈련 도크 검증'));
    await page.evaluate(()=>document.querySelector('#appSeg [data-app=board]').click());await settle(page);const saved=await inspect(frame);result.states.push({stage:'after-training-save',...saved});check(saved,false);
    await page.screenshot({path:path.join(out,spec.width+'-returned.png')});
   }
   const realErrors=result.errors.filter(e=>!/^ResizeObserver loop /.test(e));assert.deepEqual(realErrors,[]);result.ok=true;
  }catch(e){result.ok=false;result.error=e.stack;await page.screenshot({path:path.join(out,spec.width+'-failure.png')}).catch(()=>{});}
  await context.close();console.log(JSON.stringify({engine,width:spec.width,baseline,ok:result.ok,collisions:result.states.find(s=>s.stage==='training')?.collisions,error:result.error?.slice(0,1600)}));
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,baseline,method:'Real local app.html and board.html. Synthetic anonymous-local team fixture replaces sync.js only; all external requests blocked. Baseline board source pinned to9b49d8d.',results},null,2));if(results.some(r=>!r.ok))process.exitCode=1;}
