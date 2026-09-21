import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://team-library.invalid';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.resolve(root,'.'+u.pathname);if(u.origin!==base||!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.abort();return route.fulfill({contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'text/css',body:fs.readFileSync(f)});});
 await context.addInitScript(()=>{const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222';localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture'}));localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));window.PSSync={dataUnlocked:()=>true};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/studio/analysis.html');
 await page.getByRole('button',{name:'＋ 팀 등록',exact:true}).click();await page.locator('#teamName').fill('가상 등록팀');await page.getByRole('button',{name:'＋ 선수 추가',exact:true}).click();await page.getByLabel('선수 이름 1',{exact:true}).fill('가상 선수');await page.getByLabel('등번호 1',{exact:true}).fill('7');await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('기기에 저장했습니다.'));
 const saved=await page.evaluate(async()=>{const k='cs_analysis_team_library_v1';return {local:localStorage.getItem(k),durable:(await storage.get(k)).value,pending:psHasPending()};});assert.equal(saved.local,saved.durable);assert.equal(saved.pending,false);
 await page.evaluate(()=>localStorage.removeItem('cs_analysis_team_library_v1'));await page.reload();await page.getByRole('button',{name:'가상 등록팀 선수 1명'}).click();assert.equal(await page.getByLabel('선수 이름 1',{exact:true}).inputValue(),'가상 선수');
 await page.locator('#teamName').fill('저장 실패 후 재시도');await page.evaluate(()=>{window.savedWriter=psSaveSharedAsync;window.psSaveSharedAsync=()=>Promise.reject(Error('fixture disk failure'));});await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('입력 내용은 유지'));
 assert.equal(await page.locator('#teamName').inputValue(),'저장 실패 후 재시도');assert.equal(await page.evaluate(()=>psHasPending()),true);assert.equal(await page.evaluate(()=>psFlushPendingReady().then(()=>false,()=>true)),true);
 await page.evaluate(()=>window.psSaveSharedAsync=window.savedWriter);await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('기기에 저장했습니다.'));assert.equal(await page.evaluate(()=>psHasPending()),false);
 await page.locator('#teamName').fill('오래된 입력');await page.evaluate(()=>{const k='cs_analysis_team_library_v1',a=JSON.parse(localStorage.getItem(k));a[0].name='다른 화면의 최신 이름';localStorage.setItem(k,JSON.stringify(a));});await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('다른 화면'));assert.equal(await page.locator('#teamName').inputValue(),'오래된 입력');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_analysis_team_library_v1'))[0].name),'다른 화면의 최신 이름');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,passed:true,cases:['registration-durable-roundtrip','missing-mirror-recovery','failed-save-draft-retained','retry','stale-edit-protection']}));await context.close();
}finally{await browser.close();}
