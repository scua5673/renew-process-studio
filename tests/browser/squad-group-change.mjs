import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
try{for(const size of (process.env.PS_SIZES||'desktop,phone').split(',')){
 const fx=await startFixture();let context;
 try{
  const record=fx.db.get(WT+'|scout_tool_v1'),seed=JSON.parse(record.v);seed.meta.grpBase=['A팀','B팀','C팀'];seed.meta.grpLabels={'육성':'육성반'};seed.players[1].grp='육성';
  for(const p of seed.players)fx.db.get(WT+'|sq:'+p.id).v=JSON.stringify(p);record.v=JSON.stringify(seed);
  const app=await openApp(fx,size,{browsers,dark:engine==='webkit'});context=app.context;const {page,logs}=app;
  async function open(){await page.locator('#appSeg [data-team-hub]').click();await page.evaluate(()=>document.querySelector('#teamNav [data-team-key="players"]').click());const frame=await(await page.waitForSelector('#fScout')).contentFrame();await frame.locator('#pwTeam [data-pw-action="group"]').waitFor();await frame.waitForFunction(()=>!scoutReadOnlyLoad&&teEditable());return frame;}
  let f=await open();const toggle=()=>f.locator('#pwTeam [data-pw-action="group"]');const name=()=>f.locator('#pwTeam .pw-depth-name[data-pw-open="vp01"]');
  const snapshot=()=>f.evaluate(()=>JSON.stringify(data.players));
  const initial=JSON.parse(await snapshot());
  async function pick(){if(size==='phone')await name().tap();else await name().click();await f.locator('.pw-group-picker').waitFor();}
  await toggle().click();assert.equal(await toggle().getAttribute('aria-pressed'),'true');await page.screenshot({path:path.join(SHOTS,'squad-group-mode-'+engine+'-'+size+'.png')});await pick();
  assert.equal(await f.locator('#pwDrawer[open]').count(),0);assert.ok(await f.getByRole('menuitemradio',{name:'육성반',exact:true}).count());
  await f.getByRole('menuitemradio',{name:'C팀',exact:true}).click();
  const changed=JSON.parse(await snapshot());assert.equal(changed[0].grp,'C팀');changed[0].grp=initial[0].grp;assert.deepEqual(changed,initial,'only group changes: position, order and other player fields remain');
  await pick();await f.getByRole('menuitemradio',{name:'없음',exact:true}).click();assert.equal(await f.evaluate(()=>data.players[0].grp),'');
  await pick();await f.getByRole('menuitemradio',{name:'육성반',exact:true}).click();assert.equal(await f.evaluate(()=>data.players[0].grp),'육성');
  await pick();await f.getByRole('menuitemradio',{name:'A팀',exact:true}).click();
  await f.evaluate(()=>{tmGrpFilter='A팀';renderTeam();});await pick();
  await page.screenshot({path:path.join(SHOTS,'squad-group-picker-'+engine+'-'+size+'.png')});
  await f.getByRole('menuitemradio',{name:'B팀',exact:true}).click();assert.equal(await name().count(),0,'changing group removes player from the active group filter');assert.match(await f.locator('.pw-undo').textContent(),/현재 조 목록에서/);
  await f.evaluate(()=>{tmGrpFilter='';renderTeam();});await pick();await f.locator('#psPickPop button').first().press('Escape');assert.equal(await f.locator('#psPickPop').count(),0);assert.equal(await name().evaluate(el=>document.activeElement===el),true);
  // A changed source while the picker is open must not overwrite the incoming value.
  await pick();await f.evaluate(()=>{data.players.find(p=>p.id==='vp01').grp='C팀';});await f.getByRole('menuitemradio',{name:'A팀',exact:true}).click();assert.equal(await f.evaluate(()=>data.players[0].grp),'C팀');
  // Losing roster authority after opening cannot write.
  await pick();await f.evaluate(()=>document.body.classList.add('ps-roster-locked'));const denied=await snapshot();await f.getByRole('menuitemradio',{name:'A팀',exact:true}).click();assert.equal(await snapshot(),denied);await f.evaluate(()=>{document.body.classList.remove('ps-roster-locked');renderTeam();});
  await pick();await f.getByRole('menuitemradio',{name:'B팀',exact:true}).click();
  await f.evaluate(async()=>{if(window.psFlushPending)await psFlushPending();await scoutStore.ready(true);});await page.waitForTimeout(1500);
  await toggle().click();await name().click();await f.locator('#pwDrawer[open]').waitFor();await f.getByRole('button',{name:'선수 상세 닫기'}).click();
  await page.reload();f=await open();assert.equal(await f.evaluate(()=>data.players.find(p=>p.id==='vp01').grp),'B팀','group survives reload');assert.equal(await toggle().getAttribute('aria-pressed'),'false','mode is transient');
  await toggle().click();await pick();
  const bounds=await f.locator('.pw-group-picker').boundingBox(),frameBox=await page.locator('#fScout').boundingBox();assert.ok(bounds.x>=frameBox.x&&bounds.x+bounds.width<=frameBox.x+frameBox.width+1,'picker fits viewport');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,size,passed:true}));
 }finally{if(context)await context.close();await fx.close();}
}}finally{for(const b of Object.values(browsers))await b.close();}
