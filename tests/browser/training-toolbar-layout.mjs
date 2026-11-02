import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',output=process.env.PS_TEST_OUTPUT||'test-results/training-toolbar-layout';
fs.mkdirSync(output,{recursive:true});
for(const size of Object.values(SIZES))size.engine=engine;
const fx=await startFixture(),browsers={},results=[];
try{
 const {page,logs}=await openApp(fx,'desktop',{browsers});
 await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]').click());
 const f=await (await page.waitForSelector('#fBoard')).contentFrame();
 await f.locator('#dfNew').click();
 await f.locator('#vCreateChooser .vcc-item').filter({hasText:'훈련 설계'}).click();
 await f.locator('body.editing #editorModal.on').waitFor();
 await f.evaluate(()=>{state.players=[{id:'toolbar-test-player',team:'A',num:7,name:'프로세스FC 선수',x:600,y:350}];renderTokens();});
 // The page strip can rerender after the editor moved the board. This is the
 // reported path: both training tabs and all three toolbar groups then show.
 async function refresh(){await f.evaluate(()=>{__psPages.refresh();applyView();});await f.waitForFunction(()=>document.querySelector('#editorBoardWrap>#boardPageStrip .tb-r'));}
 async function geometry(){return f.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {id:e.id||e.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const stage=document.getElementById('boardStage'),wrap=document.getElementById('editorBoardWrap');
  const groups=[document.getElementById('trainingStrip'),...document.querySelectorAll('#boardPageStrip>.tb-g')].filter(e=>e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0);
  const boxes=groups.map(rect),collisions=[];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5)collisions.push([a.id,b.id]);
  }
  const hits=groups.filter(e=>e.id!=='trainingStrip'&&!e.classList.contains('tb-l')).flatMap(e=>[...e.querySelectorAll('button')]).filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.id||e.getAttribute('title'),ok:!!hit&&(hit===e||e.contains(hit))};});
  return {width:innerWidth,body:document.body.className,stage:rect(stage),board:rect(document.getElementById('board')),wrap:rect(wrap),boxes,collisions,hits};
 });}
 async function check(label){
  await refresh();
  await f.waitForFunction(()=>{const stage=document.getElementById('boardStage').getBoundingClientRect();return [...document.querySelectorAll('#trainingStrip,#boardPageStrip>.tb-g')].every(e=>{const r=e.getBoundingClientRect();return !r.width||r.bottom<=stage.top+.5;});});
  const g=await geometry();assert.ok(g.boxes.length>=3,label+' keeps the toolbar');
  assert.deepEqual(g.collisions,[],label+' controls have separate space');
  for(const b of g.boxes){assert.ok(b.x>=g.wrap.x-1&&b.right<=g.wrap.right+1,JSON.stringify({label,b,wrap:g.wrap}));assert.ok(b.bottom<=g.stage.y+.5,JSON.stringify({label,b,stage:g.stage}));}
  assert.deepEqual(g.hits.filter(h=>!h.ok),[],label+' real hit targets remain reachable');
  assert.ok(g.board.width>100&&g.board.height>100,label+' usable pitch');
  results.push({label,...g});await page.screenshot({path:output+'/'+label+'.png'});
 }
 for(const width of [1280,1440,1024,768,393,375]){await page.setViewportSize({width,height:900});await check('width-'+width);}
 await page.setViewportSize({width:1280,height:900});
 await f.locator('.cf-panel-btn').click();await check('panel-closed');
 await f.locator('.cf-panel-btn').click();
 await f.evaluate(()=>{state.orientation='v';applyView();});await check('vertical');
 await f.evaluate(()=>{state.orientation='h';applyView();document.body.classList.add('fmdark');});await check('dark');
 await f.locator('#boardPageStrip [data-v="3d"]').click();await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));await check('3d');
 await f.locator('#boardPageStrip [data-v="flat"]').click();await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'));
 await f.evaluate(()=>document.body.classList.remove('fmdark'));
 await f.locator('#psEditToolsToggle').click();assert.ok(await f.locator('#psEditTools').isVisible());await f.getByRole('button',{name:'배치 도구 닫기',exact:true}).click();
 await f.locator('#epNameTop').fill('프로세스FC 훈련 도구 검증');
 const snap=await f.evaluate(()=>JSON.parse(JSON.stringify({players:state.players,equipment:state.equipment,drawings:state.drawings})));
 await f.locator('#editorDone').click();
 await f.waitForFunction(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).some(d=>d.name==='프로세스FC 훈련 도구 검증'));
 await f.evaluate(async()=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(d=>d.name==='프로세스FC 훈련 도구 검증');await openLibDrawEditor(d.libId,false);});
 await f.locator('body.editing #editorModal.on').waitFor();await check('reopened');
 assert.deepEqual(await f.evaluate(()=>JSON.parse(JSON.stringify({players:state.players,equipment:state.equipment,drawings:state.drawings}))),snap,'layout preserves the saved pitch content');
 await page.evaluate(()=>{window.__toolbarExit=0;addEventListener('message',e=>{if(e.data?.type==='editorState'&&!e.data.open)window.__toolbarExit++;});});
 await f.locator('#editorCancel').click();await page.waitForFunction(()=>window.__toolbarExit>0);
 await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
 await f.waitForFunction(()=>!document.body.classList.contains('editing')&&document.getElementById('boardPageStrip').getBoundingClientRect().width>0);
 assert.equal(await f.locator('#boardPageStrip').evaluate(e=>getComputedStyle(e).position),'absolute','normal board keeps its floating toolbar');
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);
 console.log(JSON.stringify({engine,passed:results.map(r=>r.label)}));
}finally{fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));for(const b of Object.values(browsers))await b.close();await fx.close();}
