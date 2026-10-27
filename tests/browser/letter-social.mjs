import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildPublicLetters} from '../../scripts/build-public-letters.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const {setup,call}=require('../../migrations/20261028_letter_social.local-test.cjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/letter-social-'+engine),generated=path.join(out,'site');
fs.mkdirSync(out,{recursive:true});buildPublicLetters(generated);
const db=await setup(),requests=[],errors=[];let base,apiDown=false;
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,base).pathname;requests.push(pathname);
    if(pathname.startsWith('/rest/v1/rpc/ps_letter_')){
      if(apiDown){res.writeHead(503);res.end('{}');return;}
      let raw='';for await(const chunk of req)raw+=chunk;const p=JSON.parse(raw),name=pathname.split('/').pop();
      const args=name==='ps_letter_stats'?[p.p_visitor]:[p.p_issue,p.p_visitor,p.p_action,p.p_liked];
      const rows=await call(db,req.headers.authorization==='Bearer fixture-letter-account'?uid:null,name,args);
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(rows));return;
    }
    let relative=decodeURIComponent(pathname).replace(/^\//,'');if(relative.endsWith('/'))relative+='index.html';
    if(relative.split('/').includes('..'))throw Error('Invalid path');
    const file=path.join(relative.startsWith('studio/letter/')?generated:root,relative);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
    let content=fs.readFileSync(file);if(relative==='studio/letter-social.js')content=Buffer.from(content.toString().replace('https://jvtajoeptzfsdwizxejg.supabase.co',base));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
async function context(options={}){
  const c=await browser.newContext({viewport:{width:1280,height:900},...options});
  await c.route(u=>u.origin!==base,r=>r.abort());
  await c.addInitScript(()=>{
    Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async s=>{window.copied=s;}},configurable:true});
  });
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return {c,p};
}
try{
  const {c,p}=await context();await p.goto(base+'/studio/letter/03/');
  assert.equal(await p.locator('[data-letter-reader="3"]').count(),1);
  assert.equal(await p.locator('#pl-piece-0,#pl-piece-1,#pl-piece-2').count(),3);
  await p.waitForFunction(()=>document.querySelector('[data-letter-readers="3"]').textContent==='1');
  assert.equal(await p.locator('[data-letter-like="3"]').first().getAttribute('aria-pressed'),'false');
  await p.locator('[data-letter-like="3"]').first().click();
  await p.waitForFunction(()=>document.querySelectorAll('[data-letter-like="3"][aria-pressed="true"]').length===2);
  await p.reload();await p.waitForFunction(()=>document.querySelector('[data-letter-like="3"]').getAttribute('aria-pressed')==='true');
  await p.waitForTimeout(5500);assert.equal(await p.locator('[data-letter-readers="3"]').first().textContent(),'1','reload does not increase readership');
  await p.locator('[data-letter-like="3"]').first().click();
  await p.waitForFunction(()=>document.querySelector('[data-letter-likes="3"]').textContent==='0');
  await p.locator('[data-letter-share="3"]').first().click();
  await p.waitForFunction(()=>!!window.copied);assert.equal(await p.evaluate(()=>window.copied),base+'/studio/letter/03/');
  await p.evaluate(()=>{window.copied=null;Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('Cancelled','AbortError');},configurable:true});});
  await p.locator('[data-letter-share="3"]').first().click();assert.equal(await p.evaluate(()=>window.copied),null,'cancel does not unexpectedly copy');
  await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Denied');}},configurable:true});});
  await p.locator('[data-letter-share="3"]').first().click();await p.waitForSelector('#plShareDialog[open]');
  assert.equal(await p.getByLabel('공유할 레터 주소').inputValue(),base+'/studio/letter/03/');await p.getByRole('button',{name:'닫기',exact:true}).click();
  for(const width of [375,1100,1280]){
    await p.setViewportSize({width,height:900});await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no public reader horizontal overflow at '+width);
    await p.screenshot({path:path.join(out,'public-'+width+'.png')});
  }
  const {c:peer,p:peerPage}=await context();await peerPage.goto(base+'/studio/letter/03/');
  await peerPage.waitForFunction(()=>document.querySelector('[data-letter-readers="3"]').textContent==='2');
  assert.equal(await peerPage.locator('[data-letter-like="3"]').first().getAttribute('aria-pressed'),'false');
  await peer.close();
  // The same browser can sign in without counting its anonymous visit a second time.
  await p.evaluate(uid=>localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-letter-account'})),uid);
  await p.reload();await p.waitForTimeout(6000);assert.equal(await p.locator('[data-letter-readers="3"]').first().textContent(),'2');
  // Direct training deep links open the letter even when the previous community tab was Coach.
  await p.evaluate(()=>{localStorage.removeItem('ps_sync_session');localStorage.setItem('ps_comm_tab_v1','coach');});
  await p.goto(base+'/studio/community.html?letter=3&training=1');await p.waitForSelector('[data-letter-reader="3"]');
  await p.waitForSelector('#cvMask.on');
  await p.locator('#cvClose').click();
  assert.equal(await p.locator('#prTabProc').getAttribute('aria-pressed'),'true');
  await p.locator('[data-letter-back]').first().click();await p.waitForSelector('.pl-row');
  assert.equal(await p.locator('.pl-row').count(),46);
  await p.locator('#plOrder').selectOption('readers');
  await p.waitForFunction(()=>document.querySelector('.pl-row').dataset.letter==='3');
  await p.locator('[data-letter="3"]').click();await p.waitForSelector('[data-letter-reader="3"]');
  await p.screenshot({path:path.join(out,'community-reader.png')});
  // A counters outage must not prevent public reading or sharing, nor display fabricated zeros.
  apiDown=true;await p.goto(base+'/studio/letter/46/');await p.waitForSelector('.pl-social-status:not(:empty)');
  assert.equal(await p.locator('#pl-piece-2').count(),1);assert.equal(await p.locator('[data-letter-readers="46"]').first().textContent(),'—');
  assert.equal(await p.locator('[data-letter-like="46"]').first().isDisabled(),true);
  await p.locator('[data-letter-share="46"]').first().click();await p.waitForFunction(()=>!!window.copied);assert.equal(await p.evaluate(()=>window.copied),base+'/studio/letter/46/');
  apiDown=false;
  const {c:nojs,p:staticPage}=await context({javaScriptEnabled:false});
  for(const n of ['01','46']){await staticPage.goto(base+'/studio/letter/'+n+'/');assert.equal(await staticPage.locator('#pl-piece-2').count(),1);assert.equal(await staticPage.locator('h1').count(),1);}
  await nojs.close();await c.close();
  assert.deepEqual(errors,[],'no browser errors');assert.ok(!requests.some(r=>r.startsWith('/auth/')),'public letters never require an authentication exchange');
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,engine,widths:[375,1100,1280],publicPages:47,checks:['anonymous full reading','unique read','like/unlike','login merge','copy','cancel','manual link fallback','community integration','API outage','no-JavaScript body']},null,2));
  console.log('Letter browser checks passed: '+engine);
}finally{await browser.close();await new Promise(r=>server.close(r));await db.close();}
