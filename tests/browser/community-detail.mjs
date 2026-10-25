import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,root} from '../fixtures/team-app.mjs';
const out=process.env.PS_COMMUNITY_OUTPUT||path.join(root,'test-results/community-detail');fs.mkdirSync(out,{recursive:true});
const fx=await startFixture(),browsers={},report=[];
const modes=[{size:'desktop',width:1280,height:900,dark:true},{size:'ipad',width:1100,height:820,dark:false},{size:'phone',width:375,height:812,dark:true},{size:'phone',width:393,height:852,dark:false}];
try{
 for(const mode of process.env.PS_COMM_DETAIL_MODE?modes.filter(m=>m.size===process.env.PS_COMM_DETAIL_MODE):modes){
  const {page,context,logs}=await openApp(fx,mode.size,{browsers,dark:mode.dark});await page.setViewportSize({width:mode.width,height:mode.height});
  await page.evaluate(()=>window.__psShowApp('community'));
  const c=await(await page.waitForSelector('#fComm',{state:'attached'})).contentFrame();await c.waitForSelector('.pr-card');
  await page.screenshot({path:path.join(out,mode.size+'-'+mode.width+'-library.png')});
  const card=c.locator('.pr-card').first();await card.click();await c.waitForSelector('#cvMask.on #cdCopy');
  const v=await(await c.waitForSelector('#cvFrame',{state:'attached'})).contentFrame();
  await v.waitForFunction(()=>document.body.classList.contains('comm-viewing')&&!document.documentElement.classList.contains('comm-boot'));
  const geometry=await c.evaluate(()=>{const r=document.querySelector('.cv-shell').getBoundingClientRect();return {width:innerWidth,doc:document.documentElement.scrollWidth,dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},vh:innerHeight,comments:document.querySelectorAll('textarea,[class*="comment"]').length,title:document.querySelector('#cvTitle').textContent,desc:document.querySelector('#cd-panel-description').textContent};});
  assert.equal(geometry.width,geometry.doc,'library has no horizontal overflow');
  assert.ok(geometry.dialog.left>=0&&geometry.dialog.right<=geometry.width+1&&geometry.dialog.top>=0&&geometry.dialog.bottom<=geometry.vh+1,'dialog fits viewport');assert.equal(geometry.comments,0,'no comment area or input');assert.ok(geometry.desc.length>50,'registered source description is present');
  const player=await v.evaluate(()=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();return {w:innerWidth,doc:document.documentElement.scrollWidth,width:r.width,height:r.height,panel:getComputedStyle(document.getElementById('editorPanel')).display,readonly:editorReadOnly,play:getComputedStyle(document.getElementById('commPlayControls')).display};});
  assert.equal(player.panel,'none','old text editor column is hidden');assert.equal(player.readonly,true);assert.ok(player.width>250&&player.height>200,'native pitch fills player');assert.equal(player.w,player.doc,'native player fits');assert.notEqual(player.play,'none','playback remains available');
  await page.screenshot({path:path.join(out,mode.size+'-'+mode.width+'-detail.png')});
  await c.locator('#cd-tab-coaching').click();assert.equal(await c.locator('#cd-tab-coaching').getAttribute('aria-selected'),'true');assert.ok((await c.locator('#cd-panel-coaching').innerText()).length>30);
  await c.locator('#cd-tab-progressions').click();assert.equal(await c.locator('#cd-panel-description').isVisible(),false);assert.ok((await c.locator('#cd-panel-progressions').innerText()).length>8);
  await c.locator('#prCvTabs button').nth(1).click();await c.waitForFunction(t=>document.querySelector('#cvTitle').textContent!==t,geometry.title);
  const v2=await(await c.waitForSelector('#cvFrame',{state:'attached'})).contentFrame();await v2.waitForFunction(()=>document.body.classList.contains('comm-viewing')&&!document.documentElement.classList.contains('comm-boot'));
  assert.equal(await c.locator('#cd-tab-description').getAttribute('aria-selected'),'true','new training starts at description');
  await c.locator('#cdCopy').click();const b=await(await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await b.waitForSelector('#lpOv');await b.locator('#lpCancel').click();
  await page.evaluate(()=>window.__psShowApp('community'));await card.click();await c.waitForSelector('#cvMask.on');
  await c.locator('#cvClose').click();assert.equal(await c.locator('#cvMask').getAttribute('aria-hidden'),'true');assert.equal(await c.locator('#wrap').getAttribute('inert'),null,'library controls restored');
  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[],'no runtime errors');report.push({...mode,geometry,player});await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,modes:report.map(r=>r.size+' '+r.width)}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
