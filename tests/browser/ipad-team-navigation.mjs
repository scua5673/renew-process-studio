import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),engine=process.env.PS_BROWSER_ENGINE||'webkit';
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/ipad-team-navigation',engine);
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/studio/sync.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end('/* synthetic local sync fixture */');return;}
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const ipadUA='Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const specs=[
  {name:'ipad-portrait',width:820,height:1180,mobile:true,ipad:true,ua:ipadUA},
  {name:'ipad-landscape',width:1180,height:820,mobile:true,ipad:true,ua:ipadUA},
  {name:'ipad-desktop-website',width:1024,height:768,mobile:true,ipad:true,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'},
  {name:'ipad-narrow-window',width:507,height:900,mobile:false,ipad:true,ua:ipadUA},
  {name:'iphone',width:393,height:852,mobile:true,ipad:false,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}
];
let browser;const results=[];
try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of specs){
    const result={name:spec.name,cases:[],errors:[]};results.push(result);
    // The shipped iPad shell uses a 1100px layout viewport. Keep WebKit touch input
    // in those layout pixels; Chromium also covers the physical viewport scaling.
    const viewport=engine==='webkit'&&spec.ipad&&spec.mobile?{width:1100,height:Math.round(spec.height*1100/spec.width)}:{width:spec.width,height:spec.height};
    const context=await browser.newContext({viewport,screen:spec.ipad?{width:820,height:1180}:{width:393,height:852},isMobile:spec.mobile,hasTouch:true,userAgent:spec.ua,serviceWorkers:'block'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    await context.addInitScript(()=>{
      Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});
      const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222';
      if(!localStorage.getItem('fixture-seeded')){
        localStorage.setItem('fixture-seeded','1');
        localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-only',rt:'fixture-only'}));
        localStorage.setItem('ps_active_ws',wid);
        localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'member',name:'가상 검증 팀'}]));
        localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid}));
        localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,members:{[uid]:{role:'executive'}}}));
        localStorage.setItem('cs_idp_v1_'+uid,JSON.stringify({v:1,profile:{name:'가상 코치'},selfEval:{levels:{}},trainings:[],log:{}}));
        // Deliberately no player documents or assessment attributes yet: the team entry must stay a team screen.
        localStorage.setItem('scout_tool_v1',JSON.stringify({players:[],positions:[]}));
      }
      window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')),activeWsObj:()=>JSON.parse(localStorage.getItem('ps_ws_list'))[0],activeWs:()=>wid,dataUnlocked:()=>true,keyReady:()=>true,event(){},act(){},ping(){},syncNow:()=>Promise.resolve(),displayName:()=> '가상 코치',on(){},isAdmin:()=>false};
    });
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>result.errors.push(e.message));
    try{
      await page.goto(base+'/studio/app.html');
      await page.waitForFunction(()=>window.PSPerms&&document.querySelector('#appSeg [data-team-hub]'));
      await page.locator('#appSeg [data-team-hub]').tap();
      await page.locator('body.ps-team-open').waitFor();
      const width=await page.evaluate(()=>innerWidth);result.logicalWidth=width;
      assert.equal(await page.locator('html').getAttribute('data-ps-device'),spec.ipad?'ipad':'phone');
      const direct=page.locator(width>600?'#teamNav [data-team-key="idp"]':'#teamBottom .tb-ipad-idp');
      if(spec.ipad){
        await direct.waitFor({state:'visible'});
        const geometry=await direct.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,hit:el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};});
        assert.ok(geometry.hit&&geometry.left>=0&&geometry.right<=geometry.width,'IDP is visible and tappable without opening more');
        await direct.tap();result.cases.push('team-IDP-directly-visible-and-tappable');
        if(width<=600){
          assert.equal(await page.locator('#teamBottom .tb-ipad-idp.on').count(),1);
          assert.equal(await page.locator('#teamBottom [data-tb="more"].on').count(),0);
        }
      }else{
        assert.equal(await page.locator('#teamBottom button:visible').count(),6,'phone keeps its existing six tabs');
        await page.locator('#teamBottom [data-tb="more"]').tap();await page.locator('#teamMoreSheet [data-tb="idp"]').tap();
        result.cases.push('phone-existing-more-route-kept');
      }
      const frame=await page.locator('#fIdp').elementHandle().then(e=>e.contentFrame());
      await frame.locator('body.idp-squad').waitFor({state:'visible'});
      await page.waitForTimeout(900);
      assert.equal(await frame.locator('body.idp-squad').count(),1,'empty or arriving roster cannot change team entry into personal IDP');
      assert.equal(await page.locator('body.ps-idp-phone').count(),0,'team IDP keeps its team layout');
      await page.screenshot({path:path.join(out,spec.name+'-team-idp.png')});
      result.cases.push('team-IDP-stays-on-team-screen-before-player-data-arrives');
      await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('cs_perms_v1'));p.members['11111111-1111-4111-8111-111111111111'].role='player';localStorage.setItem('cs_perms_v1',JSON.stringify(p));dispatchEvent(new CustomEvent('ps-sync-state'));});
      await page.locator('body.ps-player-idp-only').waitFor();
      assert.equal(await page.locator('#teamNav [data-team-key="idp"]').isVisible(),false,'actual player role keeps team IDP hidden');
      assert.equal(await page.locator('#teamBottom .tb-ipad-idp').isVisible(),false,'iPad shortcut does not override player restriction');
      await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('cs_perms_v1'));p.members['11111111-1111-4111-8111-111111111111'].role='staff';localStorage.setItem('cs_perms_v1',JSON.stringify(p));dispatchEvent(new CustomEvent('ps-auth-state'));});
      await page.waitForFunction(()=>!document.body.classList.contains('ps-player-idp-only'));
      await page.locator('#appSeg [data-team-hub]').tap();
      if(spec.ipad)await direct.waitFor({state:'visible'});
      result.cases.push('same-window-role-updates-refresh-menu-without-granting-player-access');
      assert.deepEqual(result.errors.filter(e=>!/^ResizeObserver loop/.test(e)),[],'no application runtime errors');result.ok=true;
    }catch(e){result.ok=false;result.error=e.stack;await page.screenshot({path:path.join(out,spec.name+'-failure.png')}).catch(()=>{});}
    finally{await context.close();}
  }
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  const report={ok:results.length===specs.length&&results.every(r=>r.ok),engine,method:'Actual app.html and IDP iframe, synthetic local coach/role data, sync network replaced by fixture and every external request blocked.',results};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}
