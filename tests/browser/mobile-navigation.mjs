import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES,OUT,SHOTS,WP} from '../fixtures/team-app.mjs';

// Exercise the real shell against synthetic data, with every external request blocked.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.phone.engine=engine;
SIZES.phone.ctx={...SIZES.phone.ctx,viewport:{width:390,height:844},deviceScaleFactor:1};
const fx=await startFixture(),browsers={},results=[];
const expected=['보드','보관함','커뮤니티','팀 운영','학습','더보기'];
let app;
async function bar(page){
  return page.locator('#appSeg button').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>{
    const r=e.getBoundingClientRect(),s=e.querySelector('span');
    return {label:s.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,labelFits:s.scrollWidth<=s.clientWidth+1};
  }));
}
async function verifyBar(page,label){
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,page.viewportSize());
  const buttons=await bar(page),size=page.viewportSize();
  assert.deepEqual(buttons.map(b=>b.label),expected,label+' destinations and keyboard order');
  for(const b of buttons){
    assert.ok(b.width>=44&&b.height>=44,label+' touch target '+JSON.stringify(b));
    assert.ok(b.labelFits,label+' complete label '+b.label);
    assert.ok(b.x>=0&&b.x+b.width<=size.width+1&&b.y>size.height-110&&b.y+b.height<=size.height,label+' bottom placement '+JSON.stringify(b));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' no horizontal overflow');
  results.push({label,buttons});
}
try{
  app=await openApp(fx,'phone',{browsers,phoneStart:true,dark:engine==='webkit'});
  const {page,logs}=app;
  assert.equal(app.browser.browserType().name(),engine);
  const nav=key=>page.locator('#appSeg '+key);
  const team=page.locator('#appSeg [data-team-hub]'),more=nav('#psMoreBtn');
  for(const width of [320,390,430,767]){
    await page.setViewportSize({width,height:844});
    await team.click();
    await page.waitForFunction(()=>document.body.classList.contains('ps-team-open'));
    await verifyBar(page,'team-'+width);
    const row=await page.locator('#teamBottom').evaluate(e=>({y:e.getBoundingClientRect().y,height:e.getBoundingClientRect().height,position:getComputedStyle(e).position}));
    assert.equal(row.position,'static','team destinations sit above content');
    assert.ok(row.y<180&&row.height>=44,'team row remains near top '+JSON.stringify(row));
    await page.locator('#teamBottom [data-tb="players"]').click();
    await verifyBar(page,'players-'+width);
    await nav('[data-app="community"]').click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='community'&&!document.body.classList.contains('ps-team-open'));
    await verifyBar(page,'community-'+width);
    if(width===390){await page.waitForTimeout(1000);await page.screenshot({path:path.join(SHOTS,'community.png')});}
  }
  await page.setViewportSize({width:390,height:844});
  for(const [selector,appName] of [['#psTrainBtn','design'],['[data-app="learning"]','learning'],['[data-app="board"]:not([data-train])','board']]){
    await nav(selector).click();
    await page.waitForFunction(name=>document.body.dataset.psApp===name,appName);
    assert.equal(await nav(selector).getAttribute('aria-current'),'page',appName+' selection');
    await verifyBar(page,appName);
  }
  await team.click();
  await page.locator('#teamBottom [data-tb="more"]').click();
  assert.equal(await page.locator('#teamMoreSheet').isVisible(),true);
  await more.click();
  assert.equal(await page.locator('#teamMoreSheet').isVisible(),false,'only one menu is open');
  assert.equal(await page.locator('#appMoreSheet').isVisible(),true,'global more works inside team');
  await page.locator('#teamBottom [data-tb="training"]').click();
  assert.equal(await page.locator('#appMoreSheet').isVisible(),false,'team navigation closes global more');
  await more.click();
  await page.locator('#appMoreSheet [data-am-nav="idp"]').click();
  await page.waitForFunction(()=>document.body.dataset.psApp==='idp');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('ps-team-open')),true,'coach IDP retains the team route');
  assert.equal(await team.getAttribute('aria-current'),'page');
  await verifyBar(page,'team-idp');
  await team.click();
  await page.waitForTimeout(1000);
  await page.screenshot({path:path.join(SHOTS,'team.png')});

  // Breakpoint changes restore original desktop order, including global IDP.
  await page.setViewportSize({width:1100,height:820});
  await page.waitForFunction(()=>!document.body.classList.contains('ps-mobile-six'));
  assert.deepEqual((await bar(page)).map(b=>b.label),['보드','보관함','팀 운영','IDP','커뮤니티','학습']);
  assert.equal(await page.locator('#teamBottom').isVisible(),false);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.body.classList.contains('ps-mobile-six'));
  await verifyBar(page,'return-to-phone');

  // Dedicated player IDP keeps its existing shell and can return to the standard one.
  await page.evaluate(()=>document.body.classList.add('ps-player-idp-only'));
  await page.waitForFunction(()=>!document.body.classList.contains('ps-mobile-six'));
  assert.equal(await page.locator('#appSeg').isVisible(),false);
  await page.evaluate(()=>document.body.classList.remove('ps-player-idp-only'));
  await page.waitForFunction(()=>document.body.classList.contains('ps-mobile-six'));
  await verifyBar(page,'return-from-player-shell');

  // Personal IDP is represented by More; team IDP above must not be bypassed.
  await page.evaluate(wid=>localStorage.setItem('ps_active_ws',wid),WP);
  await page.reload();
  await page.waitForFunction(wid=>window.PSSync&&PSSync.activeWs()===wid&&!document.body.classList.contains('ps-booting'),WP);
  await more.click();await page.locator('#appMoreSheet [data-am-nav="idp"]').click();
  await page.waitForFunction(()=>document.body.dataset.psApp==='idp'&&!document.body.classList.contains('ps-team-open'));
  assert.equal(await more.getAttribute('aria-current'),'page');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'no runtime errors');

  const guest=await openApp(fx,'phone',{browsers,guest:true,phoneStart:true});
  await guest.page.locator('#appSeg [data-app="community"]').click();
  await guest.page.waitForFunction(()=>document.body.dataset.psApp==='community');
  await verifyBar(guest.page,'guest-community');
  assert.equal(await guest.page.evaluate(()=>window.PSSync.session()),null,'community remains available without signing in');
  fs.writeFileSync(path.join(OUT,'mobile-navigation.json'),JSON.stringify({engine,passed:true,results},null,2));
  console.log(JSON.stringify({engine,passed:true,checks:results.length}));
}catch(error){
  if(app){await app.page.screenshot({path:path.join(SHOTS,'failure.png')}).catch(()=>{});const geometry=await app.page.evaluate(()=>({innerWidth,innerHeight,viewport:visualViewport&&{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},overflow:[...document.body.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth}).slice(0,15).map(e=>({tag:e.tagName,id:e.id,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))}));fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({error:String(error),geometry,logs:app.logs,results},null,2));}
  throw error;
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
