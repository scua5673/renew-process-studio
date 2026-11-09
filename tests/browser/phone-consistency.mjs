import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS,SIZES} from '../fixtures/team-app.mjs';
// Real phone controls on isolated synthetic data. Includes the settings stacking
// regression: it used to be covered by the team navigation despite a high z-index.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';SIZES.phone.engine=engine;
const fx=await startFixture(),browsers={};
const width=Number(process.env.PS_DESIGN_WIDTH||375);
try{for(const dark of [false,true]){
 const {page,context}=await openApp(fx,'phone',{browsers,dark});
 if(width!==375)await page.setViewportSize({width,height:812});
 await ready(page);
 const fits=async frame=>assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 const targets=async(frame,selector)=>{
  const boxes=await frame.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,w:r.width,h:r.height};}).filter(r=>r.w&&r.h));
  assert.ok(boxes.length,'controls exist: '+selector);
  for(const b of boxes)assert.ok(b.w>=43.5&&b.h>=43.5,'phone target '+JSON.stringify(b));
 };
 await page.locator('#appSeg [data-team-hub]').click();
 await page.locator('#psMoreBtn').click();await page.locator('#appMoreSheet [data-am=settings]').click();
 await page.locator('#gearPop.on').waitFor();
 assert.equal(await page.locator('#gearClose').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}),true,'settings close is above team navigation');
 await targets(page,'#gearClose,#gearPop .gp-tabs button');
 await page.locator('#gearPop .gp-tabs button').nth(1).click();
 assert.equal(await page.locator('#gearPop .gp-tabs button').nth(1).getAttribute('class'),'on');
 await fits(page);await page.screenshot({path:path.join(SHOTS,`phone-design-${width}-${dark?'dark':'light'}-settings.png`)});
 await page.locator('#gearClose').click();await page.locator('#gearPop.on').waitFor({state:'hidden'});
 await page.locator('#teamBottom [data-tb=training]').click();
 const pf=await(await page.locator('#fProcess').elementHandle()).contentFrame();
 await pf.locator('#psPhGrp').waitFor();await targets(pf,'#psPhGrp');await fits(pf);
 await page.locator('#psTrainBtn').click();
 const board=await (await page.locator('#fBoard').elementHandle()).contentFrame();
 await board.locator('#drillFiles').waitFor();
 await targets(board,'#drillFiles .vx-nav button,#drillFiles .vsort');await fits(board);
 await page.evaluate(()=>window.__psShowApp('note'));
 const note=await (await page.locator('#fNote').elementHandle()).contentFrame();
 await note.locator('#noteToolsToggle').waitFor();await targets(note,'#noteToolsToggle,#nTitle,#nDock #cols button,#nDock #tools button,#nDock #penOnly');
 await fits(note);await page.screenshot({path:path.join(SHOTS,`phone-design-${width}-${dark?'dark':'light'}-note.png`)});
 await context.close();console.log(JSON.stringify({engine:process.env.PS_BROWSER_ENGINE||'chromium',width,dark,passed:true}));
}}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
