import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,root} from '../fixtures/team-app.mjs';

// The real bundled catalogs in the real shell, using synthetic auth and a local API.
const out=process.env.PS_COMMUNITY_OUTPUT||path.join(root,'test-results/community-library');
fs.mkdirSync(out,{recursive:true});
const index=JSON.parse(fs.readFileSync(path.join(root,'studio/letters/index.json'),'utf8'));
const fx=await startFixture(),browsers={},report=[];
try{
  for(const mode of [{size:'desktop',width:1280,height:900,dark:true},{size:'ipad',width:1100,height:820,dark:false},{size:'phone',width:320,height:812,dark:false},{size:'phone',width:375,height:812,dark:false},{size:'phone',width:393,height:852,dark:true}]){
    const {page,context,logs}=await openApp(fx,mode.size,{dark:mode.dark,browsers});
    await page.setViewportSize({width:mode.width,height:mode.height});
    await page.locator('#appSeg button[data-app="community"]').click();
    const c=await (await page.waitForSelector('#fComm',{state:'attached'})).contentFrame();
    await c.waitForSelector('.pl-row');
    assert.equal(await c.locator('.pl-row').count(),index.issues.length,'every prepared letter is shown');
    const geometry=await c.evaluate(()=>{
      const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      const q=document.getElementById('commSearch'),st=getComputedStyle(q);
      return {vw:innerWidth,doc:document.documentElement.scrollWidth,grid:box('#grid'),card:box('.pl-row'),tabs:box('#prSeg'),search:box('#commSearch'),sourceButtons:[...document.querySelectorAll('#prSeg button')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,width:r.width,overflow:e.scrollWidth>e.clientWidth+1};}),title:box('#clTitle'),font:st.fontSize,columns:getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length};
    });
    assert.equal(geometry.doc,geometry.vw,'no horizontal document overflow');
    assert.ok(geometry.tabs.left>=0&&geometry.tabs.right<=geometry.vw+1,'source tabs fit');
    assert.ok(geometry.search.bottom<=geometry.tabs.top,'search precedes the five sources');
    assert.equal(geometry.sourceButtons.length,5);
    for(const button of geometry.sourceButtons)assert.ok(button.left>=0&&button.right<=geometry.vw&&button.width>=44&&button.height>=44&&!button.overflow,'every source remains readable and tappable: '+JSON.stringify(button));
    assert.ok(geometry.card.width>=280,'native training diagram remains readable');
    assert.equal(geometry.columns,1,'letters stay in a single reading list at every size');
    if(mode.size==='phone')assert.equal(geometry.font,'16px','phone input does not trigger Safari zoom');
    await page.screenshot({path:path.join(out,`${mode.size}-${mode.width}-${mode.dark?'dark':'light'}.png`)});
    await c.locator('#commSearch').fill('__없는_훈련_검증__');
    await c.waitForSelector('#grid .pl-status');
    assert.equal(await c.locator('.pl-row').count(),0,'search actually filters the catalog');
    await c.locator('#commSearch').fill('');
    await c.waitForSelector('.pl-row');
    assert.equal(await c.locator('.pl-row').count(),index.issues.length,'clearing search restores catalog');
    await c.locator('#plOrder').selectOption('old');
    assert.equal(await c.locator('.pl-row').first().getAttribute('data-letter'),'1');
    await c.locator('[data-letter="3"]').click();await c.waitForSelector('[data-letter-reader="3"]');
    assert.equal(await c.evaluate(()=>document.documentElement.scrollWidth),geometry.vw,'reader does not overflow');
    await page.screenshot({path:path.join(out,`reader-${mode.size}-${mode.width}-${mode.dark?'dark':'light'}.png`)});
    await c.locator('[data-letter-jump="pl-training"]').click();
    assert.equal(await c.locator('.pl-play').count(),3);
    await page.screenshot({path:path.join(out,`training-${mode.size}-${mode.width}-${mode.dark?'dark':'light'}.png`)});
    await c.locator('[data-letter-back]').first().click();await c.waitForSelector('[data-letter="3"] .pl-read');
    assert.equal(await c.locator('[data-letter="1"] .pl-read').count(),0);
    assert.equal(await c.evaluate(()=>document.documentElement.scrollWidth),geometry.vw,'read badges fit at every size');
    await page.screenshot({path:path.join(out,`read-${mode.size}-${mode.width}-${mode.dark?'dark':'light'}.png`)});
    await c.locator('#prTabCoach').click();
    await c.locator('#upBtn').click();
    await c.waitForSelector('#upMenu:not([hidden])');
    const menu=await c.locator('#upMenu').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,vw:innerWidth,vh:innerHeight};});
    assert.ok(menu.left>=0&&menu.right<=menu.vw&&menu.top>=0&&menu.bottom<=menu.vh,'sharing menu stays inside the viewport: '+JSON.stringify({mode,menu}));
    await c.locator('#upBtn').click();
    if(mode.size==='phone'){
      await c.locator('#prTabFifa').click();await c.locator('.fi-card').first().waitFor();
      assert.equal(await c.locator('#commTopics').evaluate(e=>e.open),false,'phone topic filters start collapsed');
      await c.locator('#commTopics summary').click();
      assert.equal(await c.locator('#txBar').isVisible(),true,'topic filters remain available');
      await c.locator('#commTopics summary').click();
      await c.locator('#prTabCoach').click();
      await c.locator('#commFiltBtn').click();await c.locator('#commFiltSheet:not([hidden])').waitFor();
      await c.locator('#commFiltSheet .ps-fsheet-x').click();
      await page.setViewportSize({width:1100,height:mode.height});
      await c.waitForFunction(()=>document.getElementById('commTopics').open);
      assert.equal(await c.locator('#commSearch').evaluate(e=>e.parentElement.classList.contains('top')),true,'search remains above sources after widening');
      assert.equal(await c.locator('#commTopics').evaluate(e=>e.open),true,'desktop topic controls reopen');
    }
    const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    assert.deepEqual(errors,[],'no page errors');
    report.push({...mode,...geometry,menu});
    await context.close();
  }
  fs.writeFileSync(path.join(out,'responsive-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,widths:report.map(r=>r.width),letters:index.issues.length,report}));
}catch(e){console.error(e);throw e;}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
