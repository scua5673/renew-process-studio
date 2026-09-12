import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/first-work');
const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));}catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=`http://127.0.0.1:${server.address().port}`;
const states={
  guest:{uid:'',wid:'',kind:'',role:'admin',edit:true,ready:false},
  personal:{uid:'fixture-a',wid:'personal-a',kind:'personal',role:'admin',edit:true,ready:true},
  coach:{uid:'fixture-a',wid:'team-a',kind:'team',role:'executive',edit:true,ready:true},
  staff:{uid:'fixture-a',wid:'team-a',kind:'team',role:'staff',edit:false,ready:true},
  player:{uid:'fixture-a',wid:'team-a',kind:'team',role:'player',edit:false,ready:true},
  locked:{uid:'fixture-a',wid:'team-a',kind:'team',role:'executive',edit:true,ready:false}
};
async function setState(page,state,open=true){
  await page.evaluate(state=>{window.fixtureFirstState=state;},state);
  if(open){
    // Let the existing player-only shell apply its own role navigation before measuring the guide click.
    await page.waitForFunction(player=>document.body.classList.contains('ps-player-idp-only')===player,state.role==='player');
    await page.evaluate(()=>document.getElementById('guideOpen').click());
    await page.locator('#guideOv').waitFor({state:'visible'});
  }
}
async function ids(page){return page.locator('#psFirstWork button').evaluateAll(buttons=>buttons.map(b=>b.dataset.firstWork));}
async function clickTask(page,id,route,app){
  const before=await page.evaluate(()=>fixtureMenuClicks.length);
  await page.locator(`#psFirstWork button[data-first-work="${id}"]`).click();
  await page.locator('#guideOv').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(n=>fixtureMenuClicks.slice(n),before),[route]);
  if(app)assert.equal(await page.locator('body').getAttribute('data-ps-app'),app);
}
let browser;const results=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [{name:'375-phone',width:375,height:812,mobile:true,touch:true},{name:'393-phone',width:393,height:852,mobile:true,touch:true},{name:'768-tablet',width:768,height:900,touch:true},{name:'1280-desktop',width:1280,height:900}]){
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:!!spec.mobile,hasTouch:!!spec.touch,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
    const page=await context.newPage(),errors=[],cases=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+'/studio/app.html'+(spec.mobile?'?layout=mobile':''),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.PSFirstWork&&window.PSSync&&window.PSPerms&&document.querySelector('#psAcctWrap .acct-btn'));
    assert.equal(await page.locator('#guideOv').isVisible(),false,'no automatic onboarding');
    // In-memory context fixtures only. No session, team, IDP or schedule data is seeded.
    // The actual shipped shell/menu click handlers remain installed.
    await page.evaluate(()=>{
      window.fixtureMenuClicks=[];
      window.fixtureFirstState={uid:'',wid:'',kind:'',role:'admin',edit:true,ready:false};
      PSSync.session=()=>fixtureFirstState.uid?{uid:fixtureFirstState.uid}:null;
      PSSync.activeWsObj=()=>fixtureFirstState.wid?{id:fixtureFirstState.wid,kind:fixtureFirstState.kind}:null;
      PSSync.activeWs=()=>fixtureFirstState.wid;
      PSSync.dataUnlocked=()=>fixtureFirstState.ready;
      PSPerms.role=()=>fixtureFirstState.role;
      PSPerms.canEdit=section=>section==='schedule'&&fixtureFirstState.edit;
      document.addEventListener('click',e=>{
        const button=e.target.closest('button');if(!button)return;
        for(const [route,selector] of Object.entries(PSFirstWork.routes))if(button.matches(selector)){fixtureMenuClicks.push(route);break;}
      },true);
    });
    await setState(page,states.guest);
    assert.deepEqual(await ids(page),['board','setup','login']);
    const languages=[];
    for(const lang of ['ko','ja','en','zh','es','pt']){
      await page.locator(`#gdLangs button[data-l="${lang}"]`).click();
      const layout=await page.locator('#psFirstWork').evaluate(el=>({lang:el.lang,text:el.innerText,overflow:el.scrollWidth>el.clientWidth+1,buttons:[...el.querySelectorAll('button')].map(b=>b.textContent),lists:el.querySelectorAll('ol').length}));
      assert.equal(layout.lang,lang);assert.equal(layout.overflow,false);assert.equal(layout.lists,3);assert.equal(layout.buttons.length,3);assert.ok(layout.text.length>200);
      languages.push(lang);
    }
    await page.locator('#gdLangs button[data-l="ko"]').click();
    await page.screenshot({path:path.join(out,spec.name+'-guest.png')});
    await clickTask(page,'board','board','board');cases.push('guest-board');
    await setState(page,states.guest);await clickTask(page,'setup','account');
    assert.equal(await page.locator('#psAcctWrap .acct-pop').evaluate(el=>el.classList.contains('on')),true,'account menu stays open after relayed CTA');
    await page.locator('#psAcctWrap .acct-btn').click();cases.push('guest-account-no-team-route');
    await setState(page,states.personal);await clickTask(page,'player','idp','idp');cases.push('personal-idp-not-squad');
    await setState(page,states.coach);assert.equal((await ids(page))[0],'coach');
    assert.equal(await page.locator('.ps-fw-context').innerText(),'현재 공간 · 일정 편집 가능');
    await page.screenshot({path:path.join(out,spec.name+'-coach.png')});
    await clickTask(page,'coach','schedule','process');
    assert.equal(await page.locator('#teamNav button[data-team-key="training"]').evaluate(el=>el.classList.contains('on')),true);cases.push('coach-schedule');
    await setState(page,states.staff);assert.equal((await ids(page))[0],'observer');assert.equal((await ids(page)).includes('coach'),false);
    assert.equal(await page.locator('.ps-fw-context').innerText(),'현재 공간 · 일정 읽기 전용');
    await clickTask(page,'observer','schedule','process');cases.push('staff-read-only-schedule');
    await setState(page,states.player);assert.deepEqual(await ids(page),['player','observer']);
    assert.equal(await page.locator('.ps-fw-context').innerText(),'현재 공간 · 선수');
    await page.screenshot({path:path.join(out,spec.name+'-player.png')});
    await clickTask(page,'player','idp','idp');
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('ps-team-open')),false,'personal IDP leaves team squad navigation');cases.push('player-personal-idp');
    await setState(page,states.locked);assert.deepEqual(await ids(page),['lockedCard']);
    await clickTask(page,'lockedCard','account');
    await page.screenshot({path:path.join(out,spec.name+'-locked-account.png')});
    const lockedAccount=await page.locator('#psAcctWrap .acct-pop').evaluate(el=>{
      const button=el.querySelector('button'),r=button.getBoundingClientRect(),lock=document.getElementById('psDataLock');
      return {open:el.classList.contains('on'),hit:button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),
        appbarZ:getComputedStyle(document.querySelector('.appbar')).zIndex,dataLockVisible:!!lock&&getComputedStyle(lock).display!=='none',dataLockZ:lock&&getComputedStyle(lock).zIndex};
    });
    assert.equal(lockedAccount.open&&lockedAccount.hit,true,'the account menu remains reachable above the data lock after closing help');
    assert.equal(lockedAccount.dataLockVisible,true,'the underlying data lock remains in place');
    await page.locator('#psAcctWrap .acct-btn').click();cases.push('locked-account-only');
    for(const [name,next] of [['permission',states.staff],['account',{...states.coach,uid:'fixture-b'}],['team',{...states.coach,wid:'team-b'}],['logout',states.guest]]){
      await setState(page,states.coach);const before=await page.evaluate(()=>fixtureMenuClicks.length);
      await setState(page,next,false);await page.locator('#psFirstWork button[data-first-work="coach"]').click();
      assert.equal(await page.locator('#guideOv').isVisible(),true);
      assert.equal(await page.evaluate(()=>fixtureMenuClicks.length),before);
      assert.ok((await page.locator('.ps-fw-message').innerText()).length>10);cases.push('stale-'+name+'-blocked');
    }
    await page.evaluate(()=>document.querySelector('#guideOv .gd-panel').scrollTop=500);
    await page.keyboard.press('Escape');await setState(page,states.guest);
    assert.equal(await page.locator('#guideOv .gd-panel').evaluate(el=>el.scrollTop),0);cases.push('reopen-at-first-task');
    assert.deepEqual(errors,[]);
    results.push({viewport:spec.name,languages,cases,lockedAccount,pageErrors:errors});await context.close();
  }
  fs.writeFileSync(path.join(out,'first-work-results.json'),JSON.stringify({ok:true,build,method:'Isolated local Chrome. In-memory auth/permission fixtures; actual shell/menu handlers. Non-local requests blocked; no real accounts or team data.',results},null,2));
  console.log(JSON.stringify({ok:true,output:out,viewports:results.length,cases:results.reduce((n,r)=>n+r.cases.length,0),languages:6},null,2));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
