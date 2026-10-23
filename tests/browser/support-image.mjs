import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),{PGlite}=require('@electric-sql/pglite');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/support-image');fs.mkdirSync(out,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium',origin='https://support-image-fixture.invalid',api='https://support-image-api.invalid';
const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',V='33333333-3333-4333-8333-333333333333';
const db=new PGlite();let queue=Promise.resolve(),beforeFailure=false,lostAck=false,unavailable=false;
await db.exec(fs.readFileSync(path.join(root,'migrations/20260915_support_reports.local-fixture.sql'),'utf8'));
for(const uid of [U,A,V])await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into public.ps_admins values($1)',[A]);
for(const f of ['20260915_support_reports.sql','20261023_support_images.sql'])await db.exec(fs.readFileSync(path.join(root,'migrations',f),'utf8'));
const signatures={ps_support_list:[['p_limit','integer'],['p_before','jsonb']],ps_support_get:[['p_report_id','uuid']],ps_support_get_with_image:[['p_report_id','uuid']],ps_support_image_get:[['p_report_id','uuid']],ps_support_create:[['p_id','uuid'],['p_title','text'],['p_body','text'],['p_diagnostics','jsonb']],ps_support_create_image:[['p_id','uuid'],['p_title','text'],['p_body','text'],['p_diagnostics','jsonb'],['p_image','text']]};
const requests=[],blocked=[];
async function rpc(uid,name,body){const args=signatures[name];if(!args)throw {code:'PGRST202'};await db.exec('BEGIN');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,role:'authenticated'})]);await db.exec('SET LOCAL ROLE authenticated');const values=args.map(([n,t])=>body[n]==null?null:t==='jsonb'?JSON.stringify(body[n]):body[n]);const r=(await db.query('select public.'+name+'('+args.map(([,t],i)=>'$'+(i+1)+'::'+t).join(',')+') v',values)).rows[0].v;await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
try{
 for(const width of [375,393,768,1280]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.protocol==='blob:'||url.protocol==='data:')return route.continue();
   if(url.origin===origin){
    if(url.pathname==='/app'||url.pathname==='/admin'){
     const admin=url.pathname==='/admin';
     return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/studio/support.css"><link rel="stylesheet" href="/studio/support-image.css"><link rel="stylesheet" href="/studio/admin-support.css"><style>:root{--bar:#fff;--bar2:#f4f6f9;--txt:#20242b;--dim:#646a73;--line:#e3e6ea;--blue:#3a6df0}body{margin:0;font:14px system-ui;background:#edf0f5}button{font:inherit}main{padding:20px}body.ps-modal-open{overflow:hidden}</style></head><body><main><button id="psSupportOpen">오류 제보</button><div id="adminHost"></div></main><script src="/studio/support-image.js"></script><script src="/studio/support.js"></script><script src="/studio/admin-support.js"></script><script>
      window.fixtureUid='${admin?A:U}';window.PS_SYNC={url:'${api}',anonKey:'SYNTHETIC_PUBLIC_KEY'};window.PSSync={session:()=>({uid:fixtureUid,at:fixtureUid}),dataUnlocked:()=>true};window.PSSupportDiagnostics={snapshot:()=>({}),format:()=>''};
      window.fixtureRPC=async(name,body)=>{const r=await fetch('${api}/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+fixtureUid},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Object.assign(new Error('fixture RPC'),value,{status:r.status});return value;};
      ${admin?"window.fixtureAdmin=PSAdminSupport.create({window,host:document.getElementById('adminHost'),rpc:fixtureRPC,context:()=>({uid:fixtureUid,epoch:fixtureUid,ready:true})});fixtureAdmin.load();":"PSSupport.mount({window});"}
      </script></body></html>`});
    }
    const file=path.join(root,url.pathname);if(url.pathname.startsWith('/studio/')&&fs.existsSync(file))return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(file)});return route.fulfill({status:404,body:''});
   }
   if(url.origin!==api){blocked.push(url.origin+url.pathname);return route.abort();}
   const name=url.pathname.split('/').at(-1),body=req.postDataJSON(),uid=(req.headers().authorization||'').replace('Bearer ','');requests.push({uid,name,body});
   if(unavailable&&name==='ps_support_create_image')return route.fulfill({status:404,json:{code:'PGRST202'}});
   if(name==='ps_support_create_image'&&beforeFailure){beforeFailure=false;return route.fulfill({status:503,json:{code:'synthetic_failure'}});}
   try{const job=queue.then(()=>rpc(uid,name,body));queue=job.catch(()=>{});const value=await job;if(name==='ps_support_create_image'&&lostAck){lostAck=false;return route.abort('failed');}return route.fulfill({json:value});}catch(e){return route.fulfill({status:e.code==='PT404'?404:e.code==='PT409'?409:e.code==='PT429'?429:e.code==='42501'?403:400,json:{code:e.code}});}
  });
  await page.goto(origin+'/app');await page.locator('#psSupportOpen').click();const dialog=page.locator('#psSupportDialog');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=1350;const x=c.getContext('2d');x.fillStyle='#eef2f8';x.fillRect(0,0,c.width,c.height);x.fillStyle='#1d3557';x.fillRect(100,100,2200,1150);x.fillStyle='#fff';x.font='bold 92px sans-serif';x.fillText('PROCESS STUDIO',200,380);x.font='56px sans-serif';x.fillText('SYNTHETIC ERROR SCREEN',200,570);x.fillStyle='#7ab4ff';x.fillRect(200,740,1400,120);return c.toDataURL('image/png').split(',')[1];});
  const file={name:'report-screen.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
  await dialog.locator('[name=title]').fill('이미지 첨부 '+width);await dialog.locator('[name=body]').fill('작성한 글과 이미지가 함께 유지되는지 확인합니다.');
  await dialog.locator('[name=supportImage]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="window.fixtureXss=1"/>')});await page.waitForFunction(()=>document.querySelector('.support-status')?.textContent.includes('정지 이미지'));
  assert.equal(await dialog.locator('[name=body]').inputValue(),'작성한 글과 이미지가 함께 유지되는지 확인합니다.');
  await dialog.locator('[name=supportImage]').setInputFiles(file);await dialog.locator('.support-image-preview img').waitFor().catch(async e=>{console.error(await dialog.innerText());await page.screenshot({path:path.join(out,'failure-'+width+'-'+engine+'.png')});throw e;});await page.waitForFunction(()=>!__psSupportController.pendingUnsafe());
  assert.ok(await dialog.locator('.support-image-preview img').evaluate(i=>i.naturalWidth<=2048&&i.naturalWidth>0));
  await dialog.getByRole('button',{name:'첨부 이미지 삭제',exact:true}).click();assert.equal(await dialog.locator('.support-image-preview img').count(),0);
  if(width===375){
   await page.evaluate(()=>{window.savedPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='drafts')throw new DOMException('Synthetic quota','QuotaExceededError');return savedPut.apply(this,args);};});
   await dialog.locator('[name=supportImage]').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('.support-status')?.textContent.includes('현재 창에만'));
   assert.equal(await page.evaluate(()=>__psSupportController.pendingUnsafe()),true);await dialog.getByRole('button',{name:'오류 제보 닫기',exact:true}).click();await page.locator('#psSupportOpen').click();assert.equal(await dialog.locator('.support-image-preview img').count(),1,'failed IDB write retains memory image on reopen');
   await page.evaluate(()=>{IDBObjectStore.prototype.put=savedPut;});
  }
  await dialog.locator('[name=supportImage]').setInputFiles(file);await page.waitForFunction(()=>!__psSupportController.pendingUnsafe());
  const draft=await page.evaluate(u=>JSON.parse(localStorage.getItem('ps_support_draft_v1:'+u)),U);assert.ok(draft.imageId&&draft.imageHash);assert.ok(JSON.stringify(draft).length<10000,'image bytes never go in localStorage');
  const metrics=await dialog.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));assert.ok(metrics.scroll<=metrics.client+1&&metrics.left>=0&&metrics.right<=width+1,JSON.stringify(metrics));
  await page.screenshot({path:path.join(out,'compose-'+width+'-'+engine+'.png')});
  beforeFailure=true;lostAck=true;const start=requests.length;
  await dialog.getByRole('button',{name:'제보 등록',exact:true}).click();await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).waitFor();assert.equal(await dialog.locator('.support-image-preview img').count(),1);assert.equal(await dialog.locator('.support-report').count(),0);
  await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.support-status')?.textContent.includes('접수 결과를 확인하지 못했습니다'));
  await page.reload();await page.locator('#psSupportOpen').click();await dialog.locator('.support-image-preview img').waitFor().catch(async e=>{console.error(await dialog.innerText());await page.screenshot({path:path.join(out,'failure-'+width+'-'+engine+'.png')});throw e;});await page.waitForFunction(()=>!__psSupportController.pendingUnsafe());
  await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).click();await dialog.locator('.support-report').waitFor();
  const creates=requests.slice(start).filter(r=>r.name==='ps_support_create_image');assert.equal(creates.length,3);assert.deepEqual(creates[0].body,creates[1].body);assert.deepEqual(creates[1].body,creates[2].body);
  const reportId=creates[0].body.p_id;assert.ok(Buffer.from(creates[0].body.p_image,'base64').length<=524288);assert.equal(crypto.createHash('sha256').update(Buffer.from(creates[0].body.p_image,'base64')).digest('hex'),draft.imageHash);
  assert.equal((await db.query('select count(*)::int n from public.ps_support_reports where id=$1',[reportId])).rows[0].n,1);
  assert.equal(await dialog.locator('.support-image-view img').count(),0,'image is fetched only when requested');await dialog.getByRole('button',{name:'첨부 이미지 보기',exact:true}).click();await dialog.locator('.support-image-view img').waitFor();await dialog.locator('.support-image-view img').click();assert.equal(await dialog.locator('.support-image-view.is-expanded').count(),1);await dialog.locator('.support-image-view img').click();
  assert.equal(await page.evaluate(u=>localStorage.getItem('ps_support_draft_v1:'+u),U),null);
  await page.goto(origin+'/admin');await page.locator('[data-adm-report="'+reportId+'"]').click();await page.getByRole('button',{name:'첨부 이미지 보기',exact:true}).click();await page.locator('.admSupport .support-image-view img').waitFor();assert.ok(await page.locator('.admSupport .support-image-view img').evaluate(i=>i.naturalWidth>0));
  await page.screenshot({path:path.join(out,'admin-'+width+'-'+engine+'.png')});
  await page.evaluate(v=>{fixtureUid=v;window.dispatchEvent(new Event('ps-auth-state'));},V);await page.waitForFunction(()=>!document.querySelector('.admSupport .support-image-view img'));const denied=await page.evaluate(async id=>{try{await fixtureRPC('ps_support_image_get',{p_report_id:id});return false;}catch(e){return e.status===404;}},reportId);assert.equal(denied,true,'another account cannot retrieve an image');
  if(width===375){
   await page.goto(origin+'/app');await page.locator('#psSupportOpen').click();
   await dialog.locator('[name=title]').fill('이미지 기능 준비 중 복구');await dialog.locator('[name=body]').fill('서버가 준비되지 않아도 원문을 보관합니다.');
   await dialog.locator('[name=supportImage]').setInputFiles(file);await page.waitForFunction(()=>!__psSupportController.pendingUnsafe());unavailable=true;
   await dialog.getByRole('button',{name:'제보 등록',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.support-status')?.textContent.includes('이미지 첨부를 아직'));
   assert.equal(await dialog.locator('.support-image-preview img').count(),1);assert.equal(await dialog.locator('[name=body]').inputValue(),'서버가 준비되지 않아도 원문을 보관합니다.');
   await dialog.getByRole('button',{name:'첨부 이미지 삭제',exact:true}).click();await dialog.getByRole('button',{name:'제보 등록',exact:true}).click();await dialog.locator('.support-report').waitFor();unavailable=false;
   assert.equal(await dialog.locator('.support-image-view').count(),0,'explicit image removal can still submit text-only');
   await page.reload();await page.locator('#psSupportOpen').click();await dialog.locator('[name=title]').fill('이미지 초안 소실 후 접수 확인');await dialog.locator('[name=body]').fill('서버 접수는 됐지만 응답과 기기 이미지가 사라진 경우');
   await dialog.locator('[name=supportImage]').setInputFiles(file);await page.waitForFunction(()=>!__psSupportController.pendingUnsafe());lostAck=true;
   await dialog.getByRole('button',{name:'제보 등록',exact:true}).click();await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).waitFor();
   await page.evaluate(async uid=>{const store=PSSupportImage.createStore(window),img=await store.get(uid);await store.remove(uid,img.id);},U);
   await page.reload();await page.locator('#psSupportOpen').click();await page.waitForFunction(()=>document.querySelector('.support-status')?.textContent.includes('임시 이미지를 읽지'));
   await dialog.getByRole('button',{name:'접수 다시 확인',exact:true}).click();await dialog.locator('.support-report').waitFor();assert.equal(await page.evaluate(u=>localStorage.getItem('ps_support_draft_v1:'+u),U),null,'server metadata confirms an already accepted image without a local blob');
   await page.reload();await page.locator('#psSupportOpen').click();
   await page.evaluate(()=>{const real=PSSupportImage.prepare;PSSupportImage.prepare=(file,w)=>new Promise(resolve=>{window.finishPrepare=()=>resolve(real(file,w));});});
   await dialog.locator('[name=supportImage]').setInputFiles(file);await page.waitForFunction(()=>typeof finishPrepare==='function');
   await page.evaluate(v=>{fixtureUid=v;window.dispatchEvent(new Event('ps-auth-state'));finishPrepare();},V);await page.waitForTimeout(500);assert.equal(await dialog.locator('.support-image-preview img').count(),0,'late preparation never enters the new account');
   assert.equal(await page.evaluate(v=>localStorage.getItem('ps_support_draft_v1:'+v),V),null);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log(JSON.stringify({engine,width,passed:true,compressed:true,sqlPrivate:true,failedSendRetained:true,lostAckReloadRetry:true,adminView:true}));await context.close();
 }
}finally{await browser.close();await db.close();}
