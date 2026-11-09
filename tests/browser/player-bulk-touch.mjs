import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,OUT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={},results=[];
SIZES.phone.engine=engine;SIZES.ipad.engine=engine;SIZES.desktop.engine=engine;
try{
 for(const [size,width] of [['phone',375],['phone',393],['ipad',768],['desktop',1280]]){
  if(process.env.PS_TOUCH_WIDTH&&+process.env.PS_TOUCH_WIDTH!==width)continue;
  console.log('checking',engine,size,width);
  SIZES[size].ctx.viewport={width,height:size==='phone'?812:820};
  const {page,context,logs}=await openApp(fx,size,{browsers});await ready(page);
  const players=async()=>{await page.locator('#appSeg [data-team-hub]').click();const mobile=page.locator('#teamBottom [data-tb="players"]');await (await mobile.isVisible()?mobile:page.locator('#teamNav [data-team-key="players"]')).click();return (await page.locator('#fScout').elementHandle()).contentFrame();};
  let f=await players();
  if(size==='phone'){
    await f.locator('#pwTeam .pw-table tbody tr').first().waitFor();
    assert.equal(await f.locator('#pwTeam [data-pw-view=list]').getAttribute('aria-pressed'),'true');
    const first=await f.locator('#pwTeam .pw-name').first().boundingBox();assert.ok(first.y<590,'first player reachable '+first.y);
    const summary=f.locator('.pw-team-summary');assert.equal(await summary.getAttribute('open'),null);
    await summary.locator('summary').click();assert.equal(await summary.locator('.tm-hero').isVisible(),true);
    await summary.locator('summary').click();assert.equal(await summary.locator('.tm-hero').isVisible(),false);
    await f.getByRole('button',{name:'포지션',exact:true}).click();
  }
  await f.locator('#pwTeam .pw-depth-name').first().waitFor({timeout:8000}).catch(async e=>{console.log('INITIAL',await f.evaluate(()=>({width:innerWidth,portrait:matchMedia('(orientation:portrait)').matches,button:[...document.querySelectorAll('#pwTeam [data-pw-view]')].map(e=>[e.textContent,e.getAttribute('aria-pressed')]),text:document.querySelector('#pwTeam').innerText.slice(0,400)})));await page.screenshot({path:path.join(OUT,'initial-failure-'+width+'.png')});throw e;});
  await f.waitForFunction(()=>document.querySelector('#pwTeam .pw-depth-panel h3').innerText.indexOf('미배치')<0);
  await f.locator('#pwTeam [data-pw-position="__unplaced"]').click();
  assert.match(await f.locator('#pwTeam .pw-depth-panel .pw-empty strong').innerText(),/미배치 선수가 없어요/);
  await f.getByRole('button',{name:'명단',exact:true}).click();
  await f.getByRole('searchbox',{name:'선수 검색'}).fill('가상 선수 18');
  assert.equal(await f.locator('#pwTeam tbody tr').count(),1);await f.getByRole('searchbox',{name:'선수 검색'}).fill('');
  const tools=f.locator('#pwTeam [data-pw-action="tools"]');if(await tools.isVisible())await tools.click();
  await f.locator('#pwTeam [data-pw-action="bulk"]').click();
  const name='프로세스FC 점검'+width;
  await f.locator('.pw-bulk-row [data-f=name]').first().fill(name);
  await f.locator('.pw-bulk-row [data-f=posId]').first().selectOption('pos_CM');
  const prior=await f.evaluate(()=>data.players.length);
  const add=f.locator('.pw-bulk-foot [data-ok]');
  const box=await add.boundingBox();
  await f.evaluate(()=>{window.touchTrace=[];document.addEventListener('pointerdown',e=>touchTrace.push({type:e.pointerType,tag:e.target.tagName,text:e.target.textContent.slice(0,45)}),true);});
  const probe={box,child:await add.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),zoom:getComputedStyle(document.body).zoom})),parent:await page.evaluate(b=>document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML.slice(0,200),box)};
  if(size==='desktop')await add.click();else if(engine==='chromium')await add.tap();else{
    // iPad deliberately uses a 1100 CSS-pixel layout. Touchscreen coordinates
    // are visual viewport pixels; locator.tap does not scale these in WebKit.
    const visual=await page.evaluate(()=>({scale:visualViewport.scale,x:visualViewport.offsetLeft,y:visualViewport.offsetTop}));
    await page.touchscreen.tap((box.x+box.width/2-visual.x)*visual.scale,(box.y+box.height/2-visual.y)*visual.scale);
  }
  probe.trace=await f.evaluate(()=>touchTrace);fs.writeFileSync(path.join(OUT,'hit-'+width+'.json'),JSON.stringify(probe,null,2));
  await f.locator('.pw-bulk-overlay').waitFor({state:'hidden',timeout:5000}).catch(async e=>{await page.screenshot({path:path.join(OUT,'failure-'+width+'.png')});throw e;});
  await f.waitForFunction(n=>data.players.some(p=>p.name===n),name);
  // Focus management must not make pointerdown itself submit or produce two players.
  assert.equal(await f.evaluate(n=>data.players.filter(p=>p.name===n).length,name),1);
  assert.equal(await f.evaluate(()=>data.players.length),prior+1);
  await f.evaluate(()=>psFlushPendingReady());await page.evaluate(()=>psFlushAllPendingReady());
  await page.reload();await ready(page);f=await players();
  await f.waitForFunction(n=>typeof data!=='undefined'&&data.players.some(p=>p.name===n),name);
  assert.equal(await f.evaluate(n=>data.players.filter(p=>p.name===n).length,name),1);
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  await page.screenshot({path:path.join(OUT,engine+'-'+width+'.png')});
  if(size==='phone'){
    await page.setViewportSize({width:1280,height:820});await f.locator('.pw-team-summary').waitFor({state:'detached'});
    assert.equal(await f.locator('.tm-head>.tm-hero').count(),1,'desktop restores original hero');
    await page.setViewportSize({width,height:812});await f.locator('.pw-team-summary').waitFor();
  }
  results.push({engine,size,width,firstActivation:true,exactlyOne:true,reloadPreserved:true});
  await context.close();
 }
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
