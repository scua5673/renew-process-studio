import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// 2.996 — 오류 제보 fdc1f3d5: 팀 운영 › 게임모델 «보관함에서 가져오기» → 확인 → 팀 판이 보관함 내용으로 · 평가 기록 유지 · 되돌리기.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://gamemodel-fixture.invalid';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
async function open(role,query){
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.resolve(root,'.'+u.pathname);if(u.origin!==base)return route.abort();if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(f)});});
 await context.addInitScript(role=>{
  const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222';
  localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture'}));localStorage.setItem('ps_active_ws',wid);localStorage.setItem('ps_cache_owner_v1',JSON.stringify({uid,wid}));localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:role==='player'?'member':'owner'}]));localStorage.setItem('cs_perms_v1',JSON.stringify({members:{[uid]:{role}}}));
  if(!localStorage.getItem('gm-fixture-seeded')){
   localStorage.setItem('cs_gamemodel_v1',JSON.stringify({identity:'팀 정체성',moments:[{key:'old',name:'팀 국면',tag:'',phases:[{id:'t1',name:'팀 단계',principles:['팀 원칙']}]}],evals:[{at:'2026-09-01',s:{}}]}));
   localStorage.setItem('cs_gamemodel_personal_v1',JSON.stringify({identity:'보관함 정체성',moments:[{key:'ao',name:'공격 조직',tag:'IN POSS',phases:[{id:'v1',name:'빌드업',principles:['보관함 원칙']}]}]}));
  }
  localStorage.setItem('gm-fixture-seeded','1');
  window.PSSync={session:()=>({uid}),activeWs:()=>wid,dataUnlocked:()=>true,keyReady:()=>true};
 },role);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/studio/gamemodel.html'+(query||''));
 return {context,page,errors};
}
try{
 { const {context,page,errors}=await open('executive');
   const btn=page.locator('#btnGmFromVault');await btn.waitFor();
   assert.equal(await btn.evaluate(b=>b.parentElement.classList.contains('gm-topbar')&&b.nextElementSibling&&b.nextElementSibling.id==='btnPlayerPpt'),true,'상단 막대 «내보내기» 앞');
   await btn.click();
   const ok=page.getByRole('button',{name:'확인'});await ok.waitFor();await ok.click();
   await page.locator('#gmVaultUndo').waitFor();
   let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_v1')));
   assert.equal(saved.identity,'보관함 정체성');assert.deepEqual(saved.moments.map(m=>m.key),['ao']);
   assert.deepEqual(saved.evals,[{at:'2026-09-01',s:{}}],'팀 평가 기록은 남는다');
   assert.match(await page.locator('#moments').innerText(),/보관함 원칙|빌드업|공격 조직/);
   assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('cs_gamemodel_personal_v1'))).identity,'보관함 정체성','보관함 판은 그대로');
   await page.getByRole('button',{name:'되돌리기'}).click();
   saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_v1')));
   assert.equal(saved.identity,'팀 정체성');assert.deepEqual(saved.moments.map(m=>m.key),['old']);
   assert.equal(await page.locator('#gmVaultUndo').count(),0);
   // 취소하면 아무것도 바뀌지 않는다
   await btn.click();await page.getByRole('button',{name:'취소'}).click();
   assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('cs_gamemodel_v1')))).identity,'팀 정체성');
   assert.deepEqual(errors,[]);await context.close(); }
 { const {context,page,errors}=await open('executive','?scope=personal');   /* 보관함 화면에는 문이 없다 */
   await page.locator('#moments').waitFor({state:'attached'});await page.waitForTimeout(300);
   assert.equal(await page.locator('#btnGmFromVault').count(),0);
   assert.deepEqual(errors,[]);await context.close(); }
 { const {context,page,errors}=await open('player');   /* 보기 전용 */
   await page.locator('#moments').waitFor({state:'attached'});await page.waitForTimeout(300);
   assert.equal(await page.locator('#btnGmFromVault').isVisible().catch(()=>false),false);
   assert.deepEqual(errors,[]);await context.close(); }
 console.log(JSON.stringify({engine,passed:true,import:true,undo:true,cancel:true,personalHidden:true,viewOnlyHidden:true}));
}finally{await browser.close();}
