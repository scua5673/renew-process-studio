import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://gamemodel-fixture.invalid';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.resolve(root,'.'+u.pathname);if(u.origin!==base)return route.abort();if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(f)});});
 await context.addInitScript(()=>{
  const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222';
  localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture'}));localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner'}]));localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role:'executive'}}}));
  if(!localStorage.getItem('gm-fixture-seeded'))localStorage.setItem('cs_gamemodel_v1',JSON.stringify({identity:'가상 팀',moments:[{key:'ao',name:'공격',tag:'IN POSS',main:'가상 원칙',phases:[{id:'phase',name:'전개',principles:['처음 내용']}]}]}));
  localStorage.setItem('gm-fixture-seeded','1');
  window.PSSync={session:()=>({uid}),activeWs:()=>wid,dataUnlocked:()=>true,keyReady:()=>true};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/studio/gamemodel.html');
 const input=page.locator('.prow textarea').first();await input.fill('입력 중인 원칙');
 await input.evaluate(el=>{window.fixtureInput=el;el.focus();el.setSelectionRange(3,3);el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'한'}));});
 await page.evaluate(()=>{const key='cs_gamemodel_v1',raw=localStorage.getItem(key);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));});
 assert.equal(await input.evaluate(el=>el===window.fixtureInput&&document.activeElement===el&&el.selectionStart===3),true,'save acknowledgement preserves the composing input and caret');
 assert.equal(await input.inputValue(),'입력 중인 원칙');
 await page.evaluate(()=>{const key='cs_gamemodel_v1',old=JSON.parse(localStorage.getItem(key));old.moments=[];dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(old)}));});
 assert.equal(await input.inputValue(),'입력 중인 원칙','stale queued event cannot reset the model');
 await input.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'한'})));
 await page.evaluate(()=>{const key='cs_gamemodel_v1',remote=JSON.parse(localStorage.getItem(key));remote.identity='다른 화면에서 수정';remote.moments[0].phases[0].principles[0]='다른 화면의 원칙';const raw=JSON.stringify(remote);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));});
 assert.equal(await page.locator('#identity').inputValue(),'다른 화면에서 수정');assert.equal(await input.inputValue(),'다른 화면의 원칙');
 await input.fill('계속 작성');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_v1')));assert.equal(saved.identity,'다른 화면에서 수정');assert.equal(saved.moments[0].phases[0].principles[0],'계속 작성');
 await page.evaluate(async()=>{await PSStorage.sharedReady('cs_gamemodel_v1');localStorage.removeItem('cs_gamemodel_v1');});
 await page.reload();await input.waitFor();assert.equal(await input.inputValue(),'계속 작성','missing localStorage mirror recovers the existing durable model before editing');
 assert.equal(await page.locator('#identity').inputValue(),'다른 화면에서 수정');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,passed:true,acknowledgement:true,staleEvent:true,remoteChanges:true}));await context.close();
}finally{await browser.close();}
