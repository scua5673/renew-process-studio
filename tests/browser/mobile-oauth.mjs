import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Real app.html and sync.js, fresh anonymous browser storage. Authorize requests
// are fulfilled locally before any provider redirect; no login or team fixture.
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'webkit';
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/mobile-oauth',engine);
const source=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
const build=source.match(/window\.PS_BUILD='([^']+)'/)?.[1];
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));}catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
const phoneUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const padUA='Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const results=[];let browser;

async function geometry(button){
  return button.evaluate(el=>{
    const r=el.getBoundingClientRect(),v=window.visualViewport;
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {text:el.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,scale:v?.scale||1,
      visibleCenter:!!hit&&(hit===el||el.contains(hit)),logicalViewport:innerWidth,physicalWidth:r.width*(v?.scale||1),physicalHeight:r.height*(v?.scale||1)};
  });
}

async function touch(page,button){
  await button.waitFor({state:'visible'});
  await button.tap();return 'locator.tap';
}

try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  // WebKit iPad locator coordinates are not a verified device substitute.
  // Keep it an explicit diagnostic opt-in: PS_TEST_WIDTHS=820. The supported
  // default matrix is Chromium 393/507/820 and WebKit 393/507 (15 provider taps).
  for(const spec of [{width:393,height:852,device:'phone'},{width:507,height:900,device:'phone'},{width:820,height:1180,device:'ipad'}].filter(s=>process.env.PS_TEST_WIDTHS?process.env.PS_TEST_WIDTHS.split(',').includes(String(s.width)):!(engine==='webkit'&&s.device==='ipad'))){
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},screen:{width:spec.width,height:spec.height},isMobile:true,hasTouch:true,deviceScaleFactor:2,userAgent:spec.device==='ipad'?padUA:phoneUA,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    const intercepted=[],blocked=[],errors=[];
    // Intercept before the first page opens: even an unexpected auth/provider URL
    // is blocked. A valid authorize URL gets an inert fixture page, never a 302.
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===base)return route.continue();
      if(url.pathname==='/auth/v1/authorize'&&request.isNavigationRequest()){
        intercepted.push({origin:url.origin,path:url.pathname,provider:url.searchParams.get('provider'),prompt:url.searchParams.get('prompt'),redirectTo:url.searchParams.get('redirect_to'),mainFrame:request.frame()===request.frame().page().mainFrame()});
        return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><meta name="viewport" content="width=device-width"><title>Intercepted OAuth fixture</title><p id="oauth-intercepted">Fixture intercepted authorize. No provider request sent.</p>'});
      }
      blocked.push({origin:url.origin,path:url.pathname,resource:request.resourceType()});return route.abort('blockedbyclient');
    });
    const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    for(const scenario of [{surface:'lock',provider:'google'},{surface:'lock',provider:'kakao'},{surface:'account',provider:'google'}]){
      const label=spec.width+'-'+scenario.surface+'-'+scenario.provider;
      try{
        await page.goto(base+'/studio/app.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.PSSync&&document.querySelector('#psAcctWrap .acct-btn'));
        assert.equal(await page.evaluate(()=>PSSync.session()),null,'fixture remains signed out');
        let button;
        if(scenario.surface==='lock'){
          await touch(page,page.locator('#appSeg button[data-app="idp"]'));
          button=page.locator('#psDataLock [data-ps-login="'+scenario.provider+'"]');
        }else{
          await touch(page,page.locator('#psAcctWrap .acct-btn'));
          button=page.locator('#psAcctWrap .acct-pop.on').getByRole('button',{name:'Google로 계속',exact:true});
        }
        await button.waitFor({state:'visible'});
        const rect=await geometry(button);assert.ok(rect.width>0&&rect.height>0&&rect.visibleCenter,'real touch center belongs to selected provider button');
        const expectedOrigin=await page.evaluate(()=>new URL(PS_SYNC.url).origin);
        await page.screenshot({path:path.join(out,label+'.png')});
        const before=intercepted.length;
        const touchMethod=await touch(page,button);await page.locator('#oauth-intercepted').waitFor();
        assert.equal(intercepted.length,before+1,'one touch produces exactly one authorize navigation');
        const auth=intercepted[before];assert.equal(auth.origin,expectedOrigin);assert.equal(auth.provider,scenario.provider);assert.equal(auth.redirectTo,base+'/studio/app.html');assert.equal(auth.mainFrame,true);assert.equal(auth.prompt,scenario.provider==='google'?'select_account':null);
        results.push({engine,viewport:spec,...scenario,touchMethod,rect,authorize:auth,screenshot:label+'.png',passed:true});
        console.log(JSON.stringify({engine,width:spec.width,...scenario,provider:auth.provider,prompt:auth.prompt,passed:true}));
      }catch(e){await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw e;}
    }
    assert.equal(blocked.some(r=>r.origin==='https://accounts.google.com'||r.origin==='https://kauth.kakao.com'),false,'provider endpoints never requested');
    const layoutWarnings=errors.filter(e=>/^ResizeObserver loop (completed with undelivered notifications\.|limit exceeded)$/.test(e));
    const runtimeErrors=errors.filter(e=>!layoutWarnings.includes(e));
    fs.writeFileSync(path.join(out,'network-'+spec.width+'.json'),JSON.stringify({runtimeErrors,layoutWarnings,blocked,authorize:intercepted},null,2));
    assert.deepEqual(runtimeErrors,[],'no JavaScript runtime errors; browser ResizeObserver delivery warnings are recorded separately');
    await context.close();
  }
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({ok:true,build,engine,method:'Real local app.html + full sync.js in fresh anonymous contexts; actual touch taps. Supabase authorize fulfilled with inert fixture before provider redirect, every other external request blocked. No real accounts, login callbacks, or team data.',results},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
