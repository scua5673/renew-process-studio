import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/guidance');
const languages=['ko','ja','en','zh','es','pt'];
const links=[['guideOpen','quick','/guide/quick.html?lang=ko'],['fullGuideOpen','manual','/guide/index.html'],['teamGuideOpen','team','/guide/team.html'],['idpGuideOpen','idp','/start/how.html'],['loginGuideOpen','team-start','/start/index.html'],['installGuideOpen','player-start','/start/idp.html']];
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const requests=[];
const server=http.createServer((request,response)=>{
  let file;const url=new URL(request.url,'http://local');
  try{let pathname=decodeURIComponent(url.pathname);if(pathname.endsWith('/'))pathname+='index.html';file=path.resolve(root,'.'+pathname);}catch{response.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  try{const bytes=fs.readFileSync(file);requests.push({method:request.method,url:url.pathname,status:200});response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(bytes);}catch{requests.push({method:request.method,url:url.pathname,status:404});response.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
async function documentLayout(page){
  return page.evaluate(()=>({title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    badAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>{const id=decodeURIComponent(a.getAttribute('href').slice(1));return id&&!document.getElementById(id);}).map(a=>a.getAttribute('href'))}));
}
async function expectPanelFits(page,name){
  const result=await page.locator('#gearPop').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflow:getComputedStyle(el).overflowY};});
  assert.ok(result.left>=-1&&result.top>=-1&&result.right<=result.width+1&&result.bottom<=result.height+1,name+' '+JSON.stringify(result));
  assert.ok(['auto','scroll'].includes(result.overflow));return result;
}
async function quickChecks(page,spec){
  const results=[];
  for(const lang of languages){
    const response=await page.goto(base+'/guide/quick.html?lang='+lang+'#gd-'+lang+'4',{waitUntil:'load'});assert.equal(response.status(),200);
    const active=page.locator('article[data-lang]:not([hidden])');assert.equal(await active.count(),1);assert.equal(await active.getAttribute('data-lang'),lang);
    assert.equal(await page.locator('html').getAttribute('lang'),lang);assert.equal(await active.locator('section').count(),8);assert.ok((await active.innerText()).length>600);
    assert.equal(await page.locator('[data-language][aria-current=page]').getAttribute('data-language'),lang);assert.equal(await page.locator('#printGuide').isVisible(),true);
    const layout=await documentLayout(page);assert.deepEqual(layout.badAnchors,[]);assert.ok(layout.scrollWidth<=layout.width+1,spec.name+' '+lang+' '+JSON.stringify(layout));
    await page.reload({waitUntil:'load'});assert.equal(new URL(page.url()).hash,'#gd-'+lang+'4');assert.equal(await active.getAttribute('data-lang'),lang);
    const toc=active.locator('.toc a').first();await toc.click();await page.waitForURL(url=>url.hash==='#gd-'+lang+'0');
    const access=await page.evaluate(()=>({storage:window.fixtureGuideStorage.slice(),fetch:window.fixtureGuideFetch.slice(),session:localStorage.getItem('ps_sync_session')}));
    assert.deepEqual(access.storage,[],'quick guide does not read or write app storage');assert.deepEqual(access.fetch,[],'quick guide does not call an API');assert.equal(access.session,null);
    // Restore the top after anchor navigation for a representative full-page entry screenshot.
    await page.goto(base+'/guide/quick.html?lang='+lang,{waitUntil:'load'});
    if(lang==='ko'||lang==='en')await page.screenshot({path:path.join(out,spec.name+'-quick-'+lang+'.png')});
    results.push({lang,...layout,reloadAndToc:true,noStorageOrApi:true});
  }
  await page.goto(base+'/guide/quick.html?lang=ko#gd-ko4');
  await page.locator('[data-language=en]').click();await page.waitForURL('**/quick.html?lang=en#gd-en4');
  assert.equal(await page.locator('article:not([hidden])').getAttribute('data-lang'),'en');
  await page.goBack({waitUntil:'load'});assert.equal(new URL(page.url()).hash,'#gd-ko4');assert.equal(await page.locator('article:not([hidden])').getAttribute('data-lang'),'ko');
  await page.locator('.site-header [data-ui=full]').click();await page.waitForURL(base+'/guide/');assert.ok((await page.locator('body').innerText()).length>1000);
  await page.goBack({waitUntil:'load'});assert.equal(new URL(page.url()).hash,'#gd-ko4');
  await page.goto(base+'/guide/quick.html?lang=unknown');assert.equal(await page.locator('html').getAttribute('lang'),'ko');
  return results;
}
let browser;const results=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [{name:'375-phone',width:375,height:812,touch:true,mobile:true},{name:'768-landscape',width:768,height:600,touch:true},{name:'1280-desktop',width:1280,height:900}]){
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.mobile,serviceWorkers:'block',timezoneId:'Asia/Seoul',reducedMotion:'reduce'}),errors=[];
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
    await context.routeWebSocket('**/*',socket=>socket.close());
    context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);});
    await context.addInitScript(()=>{
      if(location.pathname!=='/guide/quick.html')return;
      window.fixtureGuideStorage=[];window.fixtureGuideFetch=[];
      for(const key of ['getItem','setItem','removeItem','clear']){const original=Storage.prototype[key];Storage.prototype[key]=function(...args){fixtureGuideStorage.push({method:key,key:args[0]??null});return original.apply(this,args);};}
      const original=window.fetch;window.fetch=function(...args){fixtureGuideFetch.push(String(args[0]));return original.apply(this,args);};
    });
    const page=await context.newPage();await page.goto(base+'/studio/app.html'+(spec.mobile?'?layout=mobile':''),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(expected=>window.PS_BUILD===expected&&document.querySelector('#gearPop.gp-tabbed [data-gp-go=help]'),build);
    assert.equal(await page.locator('#guideOv').count(),0,'obsolete guide overlay is removed');
    assert.equal(await page.evaluate(()=>localStorage.getItem('ps_sync_session')),null,'no account needed to read help');
    await page.locator('#gearBtn').click();await page.locator('#gearPop.on').waitFor();
    await page.locator('[data-gp-go=general]').click();for(const [id] of links)assert.equal(await page.locator('#'+id).isVisible(),false,'help is not duplicated in general settings');
    await page.locator('[data-gp-go=general]').focus();await page.keyboard.press('End');
    assert.equal(await page.locator('#gearPop').getAttribute('data-gp-on'),'help');assert.equal(await page.locator('[data-gp-go=help]').getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home');assert.equal(await page.locator('#gearPop').getAttribute('data-gp-on'),'device');
    await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#gearPop').getAttribute('data-gp-on'),'help');
    const panel=await expectPanelFits(page,spec.name),parentUrl=page.url(),documents=[];
    assert.equal(await page.locator('#gearPop .gp-help-link:visible').count(),6);
    await page.screenshot({path:path.join(out,spec.name+'-help-tab.png')});
    for(const [id,name,url] of links){
      const link=page.locator('#'+id);assert.equal(await link.evaluate(el=>el.tagName),'A');assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);assert.equal(new URL(await link.getAttribute('href'),base).href,base+url);
      await link.scrollIntoViewIfNeeded();const accessible=await link.evaluate(el=>{const r=el.getBoundingClientRect(),p=document.getElementById('gearPop').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:r.top>=p.top&&r.bottom<=p.bottom&&r.bottom<=innerHeight,hit:el===hit||el.contains(hit)};});assert.deepEqual(accessible,{visible:true,hit:true});
      const [child]=await Promise.all([page.waitForEvent('popup'),link.click()]);await child.waitForLoadState('load');assert.equal(child.url(),base+url);assert.equal(page.url(),parentUrl);assert.equal(await child.evaluate(()=>window.opener===null),true);
      assert.equal(await page.locator('#guideOv').count(),0);const layout=await documentLayout(child);assert.deepEqual(layout.badAnchors,[]);assert.ok(layout.scrollWidth<=layout.width+1,name+' '+spec.name+' '+JSON.stringify(layout));
      assert.ok(requests.some(r=>r.method==='GET'&&r.url===new URL(base+url).pathname&&r.status===200));
      await child.screenshot({path:path.join(out,spec.name+'-'+name+'.png')});documents.push({name,url,...layout,newTab:true});await child.close();await expectPanelFits(page,spec.name);
    }
    await page.screenshot({path:path.join(out,spec.name+'-help-tab-bottom.png')});
    // The shell uses the current app language when creating the native quick-guide URL.
    await page.locator('[data-gp-go=general]').click();await page.locator('#langSw [data-lang=pt]').click();await page.locator('[data-gp-go=help]').click();assert.equal(await page.locator('#guideOpen').getAttribute('href'),'/guide/quick.html?lang=pt');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#gearPop').isVisible(),false);assert.equal(page.url(),parentUrl);
    const quick=await context.newPage(),languageResults=await quickChecks(quick,spec);await quick.close();
    assert.deepEqual(errors,[],'no uncaught JavaScript errors');results.push({viewport:spec.name,panel,documents,languages:languageResults,keyboardTabs:true,generalHasNoHelp:true,pageErrors:errors});
    console.log(JSON.stringify({viewport:spec.name,passed:true,documents:documents.length,languages:languageResults.length}));await context.close();
  }
  fs.writeFileSync(path.join(out,'guidance-results.json'),JSON.stringify({ok:true,build,method:'Actual local app and six public documents. Fresh browser profiles, no accounts or team data; every non-local request blocked.',results},null,2));
}catch(error){
  for(const context of browser?.contexts()||[])for(const page of context.pages())await page.screenshot({path:path.join(out,'failure-'+page.viewportSize().width+'-'+(page.url().includes('/studio/')?'app':'document')+'.png')}).catch(()=>{});
  throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
