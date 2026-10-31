import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';

const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
try{for(const size of (process.env.PS_SIZES||'desktop,ipad,phone').split(',')){
 const fx=await startFixture();let context;
 try{
  const record=fx.db.get(WT+'|scout_tool_v1'),seed=JSON.parse(record.v);
  seed.players.forEach((p,i)=>{if(i<6){p.posId='pos_CM';p.grp=i%2?'B팀':'A팀';}else if(p.posId==='pos_CM')p.posId='pos_AM';fx.db.get(WT+'|sq:'+p.id).v=JSON.stringify(p);});record.v=JSON.stringify(seed);
  const app=await openApp(fx,size,{browsers});context=app.context;const {page}=app;
  async function open(){await page.locator('#appSeg [data-team-hub]').click();await page.evaluate(()=>document.querySelector('#teamNav [data-team-key="players"]').click());const f=await(await page.waitForSelector('#fScout')).contentFrame();await f.locator('#pwTeam [data-pw-slot="pos_CM"]').waitFor();await f.waitForFunction(()=>!scoutReadOnlyLoad&&teEditable());await page.waitForTimeout(800);return f;}
  let f=await open();
  const order=()=>f.evaluate(()=>data.players.filter(p=>p.type!=='target'&&p.posId==='pos_CM').map(p=>p.id));
  const slot=()=>f.locator('#pwTeam [data-pw-slot="pos_CM"]');
  async function drag(from,to,refreshDuringHold=false){
   // Saving schedules another render; measure the current rows after scrolling.
   await f.evaluate(()=>document.querySelector('#pwTeam [data-pw-slot="pos_CM"]').scrollIntoView({block:'center'}));await page.waitForTimeout(250);
   const a=await from.boundingBox(),b=await to.boundingBox();assert.ok(a&&b);
   const start={x:a.x+a.width/2,y:a.y+a.height/2},end={x:b.x+b.width/2,y:b.y+3};
   if(size==='desktop'){
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+10,start.y,{steps:3});if(refreshDuringHold)await f.evaluate(()=>renderTeam());await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
   }else if(engine==='chromium'){
    const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
    await page.waitForTimeout(100);if(refreshDuringHold)await f.evaluate(()=>renderTeam());await page.waitForTimeout(250);
    const ghost=await f.locator('.pw-depth-ghost').boundingBox();assert.ok(ghost&&ghost.width>=a.width*.9,'a refresh during the touch hold keeps the source row attached');
    for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }else{
    // WebKit has no public native touch-drag API. Exercise the same touch handler,
    // including the delayed hold and an intervening refresh, with pointer events.
    const handle=await from.elementHandle();const fb=await page.locator('#fScout').boundingBox();
    const point=p=>({x:p.x-fb.x,y:p.y-fb.y});const first=point(start),last=point(end);
    await handle.evaluate((el,p)=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:71,pointerType:'touch',clientX:p.x,clientY:p.y})),first);
    await page.waitForTimeout(100);if(refreshDuringHold)await f.evaluate(()=>renderTeam());await page.waitForTimeout(250);
    assert.equal(await handle.evaluate(el=>el.isConnected),true,'touch target survives a refresh while holding');
    await f.evaluate(p=>{document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:71,pointerType:'touch',clientX:p.x,clientY:p.y}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:71,pointerType:'touch',clientX:p.x,clientY:p.y}));},last);
   }
   await f.locator('.pw-depth-ghost').waitFor({state:'detached'});assert.equal(await f.locator('#pwDrawer[open]').count(),0,'dropping does not open player details');
  }
  const before=await order();
  await drag(slot().locator('.pw-depth-name').last(),slot().locator('.pw-depth-name').first(),true);
  assert.deepEqual(await order(),[before.at(-1),...before.slice(0,-1)],'dragging changes the depth order');
  await f.locator('.pw-undo button').click();assert.deepEqual(await order(),before,'undo restores the original depth');
  await f.evaluate(()=>{tmGrpFilter='A팀';renderTeam();});await page.waitForTimeout(600);
  // A / B groups are interleaved. A visible index is not the underlying roster index.
  await drag(slot().locator('.pw-depth-name').first(),slot().locator('.pw-depth-name').nth(2));
  assert.deepEqual(await f.evaluate(()=>data.players.filter(p=>p.posId==='pos_CM'&&p.grp==='A팀').map(p=>p.id)),['vp03','vp01','vp05'],'filtered drag follows the visible insertion marker');
  const reordered=await order(),target=f.locator('#pwTeam [data-pw-slot="pos_AM"] .pw-depth-name').first();
  await drag(slot().locator('[data-pw-open="vp05"]'),target);
  assert.equal(await f.evaluate(()=>data.players.find(p=>p.id==='vp05').posId),'pos_AM','dropping on another card changes position');
  assert.equal(await f.locator('#pwTeam [data-pw-slot="pos_AM"] .pw-depth-name').first().getAttribute('data-pw-open'),'vp05');
  await f.locator('.pw-undo button').click();assert.deepEqual(await order(),reordered,'undo restores both the position and its depth');
  const saved=await order();await f.evaluate(async()=>{if(window.psFlushPending)await psFlushPending();await scoutStore.ready(true);});await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(SHOTS,'squad-depth-drag-'+engine+'-'+size+'.png')});
  await page.reload();f=await open();assert.deepEqual(await order(),saved,'depth order survives a reload');
  await slot().scrollIntoViewIfNeeded();
  await f.evaluate(()=>document.addEventListener('pointerdown',()=>renderTeam(),{once:true}));
  const name=slot().locator('.pw-depth-name').first();
  if(size==='desktop')await name.click();else await name.tap();
  await f.locator('#pwDrawer[open]').waitFor();
  await f.getByRole('button',{name:'선수 상세 닫기'}).click();
  assert.equal(await f.locator('.pw-depth-ghost').count(),0,'a plain tap still opens details and leaves no drag behind');
  for(const width of size==='phone'?[375,393]:size==='ipad'?[768]:[1280]){
   await page.setViewportSize({width,height:size==='desktop'?900:1024});
   await f.waitForFunction(w=>innerWidth<=w+1,width);
   const layout=await f.locator('#pwTeam').evaluate(host=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,board:host.querySelector('.pw-depth-board').getBoundingClientRect().width}));
   assert.ok(layout.scroll<=layout.viewport+1,JSON.stringify({engine,size,width,layout}));
   await f.evaluate(()=>document.querySelector('#pwTeam').scrollIntoView({block:'start'}));
   await page.screenshot({path:path.join(SHOTS,'squad-depth-layout-'+engine+'-'+width+'.png')});
   console.log(JSON.stringify({engine,size,width,layout}));
  }
  console.log(JSON.stringify({engine,size,passed:true}));
 }finally{if(context)await context.close();await fx.close();}
}}finally{for(const b of Object.values(browsers))await b.close();}
