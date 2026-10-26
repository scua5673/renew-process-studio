import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,root} from '../fixtures/team-app.mjs';
import {svgProblem} from '../../scripts/proc-snapshot.mjs';
const out=process.env.PS_QUALITY_OUTPUT||path.join(root,'test-results/community-quality');
fs.mkdirSync(out,{recursive:true});
const index=JSON.parse(fs.readFileSync(path.join(root,'studio/packs/index.json')));
const catalog=index.sessions.map(row=>({row,pack:JSON.parse(fs.readFileSync(path.join(root,'studio/packs',String(row.n).padStart(2,'0')+'.json')))}));
const fx=await startFixture(),browsers={};
try{
 const {page,context}=await openApp(fx,'desktop',{browsers});
 await page.waitForFunction(()=>typeof window.__psShowApp==='function');
 await page.evaluate(()=>window.__psShowApp('community'));
 const c=await (await page.waitForSelector('#fComm',{state:'attached'})).contentFrame();
 await c.waitForSelector('[data-letter="46"]',{timeout:45000});
 assert.equal(await c.locator('.pl-row').count(),46,'the complete letter catalog includes the first issue without training');
 await c.locator('[data-letter="46"]').click();
 await c.locator('[data-letter-play="46"][data-training="0"]').click();
 await c.waitForFunction(()=>document.getElementById('cvFrame')?.contentDocument?.getElementById('epName')?.value.includes('골문 앞 3v2'));
 let v=await (await c.waitForSelector('#cvFrame',{state:'attached'})).contentFrame();
 await v.waitForFunction(()=>window.__commView&&document.getElementById('epName')?.value.includes('골문 앞 3v2'));
 const report=[];
 for(const {row,pack} of catalog){
  for(const [i,t] of pack.drills[0].trainings.entries()){
   const id=String(row.n).padStart(2,'0')+'-'+(i+1);
   const data=await v.evaluate(({t,id})=>{
    const item={...t,type:'train',trainings:[t]};
    window.__commView({id:'proc-quality-'+id,title:t.name,owner_name:'프로세스',proc:true,item});
    loadSnap(t.snap);renderTokens();
    const docs=[...document.querySelectorAll('.ep-ro-text')].map(e=>e.textContent);
    const goals=state.equipment.filter(g=>g.anchor==='mouth').map(g=>{
     const el=document.querySelector('#tokenLayer [data-id="'+g.id+'"]'),mat=world.getCTM().inverse().multiply(el.getCTM()),mini=g.team==='minigoalV',d=mini?8:13,span=mini?26:44;
     const at=(x,y)=>new DOMPoint(x,y).matrixTransform(mat),mouth=at(-d,0),a=at(-d,-span/2),b=at(-d,span/2),net=at(d,0);
     return {dx:mouth.x-g.x,dy:mouth.y-g.y,width:Math.hypot(a.x-b.x,a.y-b.y),expected:g.mouthWidth,outside:g.rot===180?net.x<mouth.x:net.x>mouth.x};
    });
    const thumb=boardThumbSVG();
    for(let i=0;i<t.frames.length-1;i++)renderInterp(t.frames[i].snap,t.frames[i+1].snap,.5,t.frames[i].curves);
    loadSnap(t.snap);renderTokens();
    return {name:document.getElementById('epName').value,docs,goals,players:state.players.length,frames:anim.frames.length,svg:thumb,ro:editorReadOnly};
   },{t,id});
   assert.equal(data.name,t.name,id+' viewer training name');
   assert.ok(data.ro,id+' remains read only');
   assert.ok(data.docs.includes(t.method)&&data.docs.includes(t.coaching),id+' full method and coaching survive rendering');
   assert.equal(data.frames,t.frames.length,id+' native animation frames');
   assert.equal(data.players,t.snap.players.length,id+' native player count');
   for(const g of data.goals){assert.ok(Math.abs(g.dx)<.01&&Math.abs(g.dy)<.01,id+' goal mouth on line');assert.ok(Math.abs(g.width-g.expected)<.01,id+' correct posts');assert.ok(g.outside,id+' net outside field');}
   assert.equal(svgProblem(data.svg),'',id+' native thumbnail is inert');
   fs.writeFileSync(path.join(out,id+'.svg'),data.svg);
   if(process.env.PS_WRITE_QUALITY_THUMBS==='1')fs.writeFileSync(path.join(root,'studio/packs/thumbs',id+'.svg'),data.svg);
   report.push({id,name:t.name,players:data.players,goals:data.goals.length,frames:data.frames,method:t.method.length,coaching:t.coaching.length});
  }
 }
 // Actual public selectors, then «save» uses the normal confirmation route.
 await c.locator('#cvClose').click();
 await c.locator('[data-letter-back]').first().click();
 await c.locator('[data-letter="41"]').click();
 await c.locator('[data-letter-play="41"][data-training="0"]').click();
 await c.waitForFunction(()=>document.getElementById('cvFrame')?.contentDocument?.getElementById('epName')?.value.startsWith('골문 앞 3v2+GK'));
 v=await (await c.waitForSelector('#cvFrame',{state:'attached'})).contentFrame();
 await v.waitForFunction(()=>document.getElementById('epName')?.value.startsWith('골문 앞 3v2+GK'));
 await c.locator('#prCvTabs button:nth-child(2)').click();
 await c.waitForFunction(()=>document.getElementById('cvFrame')?.contentDocument?.getElementById('epName')?.value.startsWith('가운데 구역 4v4'));
 v=await (await c.waitForSelector('#cvFrame',{state:'attached'})).contentFrame();
 await v.waitForFunction(()=>document.getElementById('epName')?.value.startsWith('가운데 구역 4v4'));
 assert.ok((await v.locator('.ep-ro-text').allTextContents()).some(x=>x.includes('질문 —')),'public tab selection displays the new coaching');
 await page.screenshot({path:path.join(out,'official-viewer-desktop.png')});
 for(const [width,height,label] of [[1100,820,'tablet'],[375,812,'phone'],[1280,960,'desktop']]){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(450);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' shell fits');
  assert.ok(await c.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' community fits');
  const fits=await v.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,bad:[...document.body.querySelectorAll('*')].map(e=>{const r=e.getBoundingClientRect();return {id:e.id,cl:String(e.className).slice(0,60),l:r.left,r:r.right,w:r.width};}).filter(r=>r.w>0&&(r.l<-.5||r.r>innerWidth+.5)).slice(0,15)}));
  await page.screenshot({path:path.join(out,'official-viewer-'+label+'.png')});
  assert.ok(fits.doc<=fits.w,label+' native viewer fits '+JSON.stringify(fits));
  await page.screenshot({path:path.join(out,'official-viewer-'+label+'.png')});
 }
 await c.locator('#cdCopy').click();
 const b=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await b.waitForSelector('#lpOv',{timeout:30000});
 const dialogText=await b.locator('#lpOv').textContent();
 assert.ok(dialogText.includes('가운데 구역 4v4'),'selected real session reaches save confirmation');
 await b.locator('#lpOk').click();
 await b.waitForFunction(async()=>((await libGet())||[]).some(d=>d.letter?.issue===41),null,{timeout:30000});
 const saved=await b.evaluate(async()=>((await libGet())||[]).find(d=>d.letter?.issue===41));
 assert.equal(saved.trainings.length,3);
 for(let i=0;i<3;i++){
  const want=catalog.find(x=>x.row.n===41).pack.drills[0].trainings[i];
  assert.equal(saved.trainings[i].method,want.method,'saved method is complete');assert.equal(saved.trainings[i].coaching,want.coaching,'saved coaching is complete');
  assert.equal(saved.trainings[i].frames.length,want.frames.length,'saved animation is complete');
 }
 // Fresh phone context: the native viewer chooses its phone orientation at open time.
 const ph=await openApp(fx,'phone',{browsers});
 await ph.page.waitForFunction(()=>typeof window.__psShowApp==='function');
 await ph.page.evaluate(()=>window.__psShowApp('community'));
 const pc=await (await ph.page.waitForSelector('#fComm',{state:'attached'})).contentFrame();
 await pc.waitForSelector('[data-letter="41"]',{timeout:45000});
 await pc.locator('[data-letter="41"]').click();
 await pc.locator('[data-letter-play="41"][data-training="0"]').click();
 await pc.waitForFunction(()=>document.getElementById('cvFrame')?.contentDocument?.getElementById('epName')?.value.startsWith('골문 앞 3v2+GK'));
 await pc.locator('#prCvTabs button:nth-child(2)').click();
 await pc.waitForFunction(()=>document.getElementById('cvFrame')?.contentDocument?.getElementById('epName')?.value.startsWith('가운데 구역 4v4'));
 const pv=await (await pc.locator('#cvFrame').elementHandle()).contentFrame();
 await pv.waitForFunction(()=>!document.documentElement.classList.contains('comm-boot'));
 assert.ok(await pv.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'fresh phone viewer fits');
 assert.ok((await pv.locator('.ep-ro-text').allTextContents()).some(t=>t.includes('질문 —')),'fresh phone keeps the complete coaching');
 await ph.page.screenshot({path:path.join(out,'official-viewer-phone-initial.png')});
 await pc.locator('#cd-tab-coaching').click();
 await pc.locator('#cd-panel-coaching').evaluate(el=>el.scrollIntoView({block:'end'}));
 await ph.page.screenshot({path:path.join(out,'official-coaching-phone.png')});
 await ph.context.close();
 fs.writeFileSync(path.join(out,'native-report.json'),JSON.stringify(report,null,2));
 console.log('Official catalog: 45 sessions / '+report.length+' practices / '+report.reduce((n,r)=>n+r.frames,0)+' native frames. Viewer, anchored goals, complete text, native thumbnails, real vault import passed.');
 await context.close();
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
