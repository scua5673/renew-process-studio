import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const format=process.env.PS_COVER_FORMAT||(engine==='webkit'?'portrait':'landscape');
const fx=await startFixture(),browsers={};
try{
 const {page,logs}=await openApp(fx,size,{browsers});console.log("cover: app opened");
 await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
 const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await f.waitForFunction(()=>window.__psMeetCover&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&document.getElementById('dfNew'));
 console.log('cover: board ready');await f.click('#dfNew');await f.locator('.vcc-item').filter({hasText:'미팅 자료'}).click();
 await f.waitForSelector('#psMeetForm.on');await f.click('#psMeetForm [data-start=filled]');await f.click('#psMeetForm .mf-go');
 await f.waitForFunction(()=>window.__meet.idx()===0&&anim.slides.length===10&&!window.__ksNav);
 await f.evaluate(()=>window.__meetSyncCur({thumb:true}));
 const work=await f.evaluate(()=>JSON.stringify(window.__psPages.pg(),(k,v)=>k==='thumb'?undefined:v));
 const baseline=await f.evaluate(()=>JSON.stringify(anim.slides,(k,v)=>k==='thumb'?undefined:v));
 console.log('cover: meeting ready');await f.click('#ksStrip .mc-add-cover');await f.waitForSelector('#psMeetCover:not([hidden])');
 console.log("cover: added");const first=await f.evaluate(()=>({i:window.__meet.idx(),count:anim.slides.length,cover:anim.slides[0].cover,rest:JSON.stringify(anim.slides.slice(1),(k,v)=>k==='thumb'?undefined:v)}));
 assert.equal(first.i,0);assert.equal(first.count,11);assert.equal(first.cover.v,1);assert.equal(first.rest,baseline,'inserting a cover leaves all existing slides unchanged');
 await f.selectOption('#psMeetCover [data-cover=format]',format);
 await f.fill('#psMeetCover [data-cover=background]','#234567');
 await f.fill('#psMeetCover [data-block=text]','가상 FC\n경기 준비');
 await f.fill('#psMeetCover [data-block=size]','72');await f.fill('#psMeetCover [data-block=y]','15');
 await f.selectOption('#psMeetCover [data-block=align]','center');
 const beforeDrag=await f.evaluate(()=>anim.slides[0].cover.blocks[0].x);
 const rect=await f.locator('#psMeetCover [data-cover-block="0"] rect').boundingBox();assert.ok(rect&&rect.width>80);
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+20,rect.y+rect.height/2+10,{steps:4});await page.mouse.up();
 assert.ok(await f.evaluate(x=>anim.slides[0].cover.blocks[0].x>x,beforeDrag),'drag moves selected text');
 await f.click('#psMeetCover [data-mc=undo]');assert.equal(await f.evaluate(()=>anim.slides[0].cover.blocks[0].x),beforeDrag,'undo restores text position');
 await f.click('#psMeetCover [data-mc=add]');await f.fill('#psMeetCover [data-block=text]','함께 압박하고, 함께 전진');
 await f.fill('#psMeetCover [data-block=y]','66');await f.fill('#psMeetCover [data-block=size]','28');
 await f.selectOption('#psMeetCover [data-block=align]','center');await f.locator('#psMeetCover .mc-heading strong').click();
 assert.equal(await f.evaluate(()=>anim.slides[0].cover.blocks.length),4);
 console.log("cover: edited");const savedCover=await f.evaluate(()=>JSON.stringify(anim.slides[0].cover));
 await f.evaluate(()=>new Promise((resolve,reject)=>{window.__vaultPending.name='가상 표지 미팅';window.__vaultSave({skipSheet:true,after:resolve,onerror:()=>reject(Error('save failed'))});}));
 console.log("cover: saved");const saved=await f.evaluate(async()=>{const it=(await libGet()).find(x=>x.name==='가상 표지 미팅');return it&&{id:it.libId,cover:JSON.stringify(it.slides[0].cover),slides:it.slides};});
 assert.ok(saved?.id,'the meeting was saved to the synthetic library');assert.equal(saved.cover,savedCover);
 await f.evaluate(slides=>{window.__meetLoad(slides);window.__meet.go(0,'first');},saved.slides);
 await f.waitForSelector('#psMeetCover:not([hidden])');assert.equal(await f.evaluate(()=>JSON.stringify(anim.slides[0].cover)),savedCover,'cover survives save/load');
 assert.equal(await f.evaluate(()=>JSON.stringify(window.__psPages.pg(),(k,v)=>k==='thumb'?undefined:v)),work,'editing the cover never changes work-board pages');
 const doc=await f.evaluate(()=>buildMeetingPrintDoc(meetingPdfSlides(),'미팅',{orientation:'landscape'}));assert.match(doc,/mp-cover/);assert.match(doc,/alt="표지"/);
 // Exercise the real PPT encoder and the regular second slide, while capturing the file locally.
 if(engine==='chromium'){
  await f.evaluate(()=>new Promise(resolve=>__ensurePptx(resolve)));
  await f.evaluate(()=>{window.__coverAllSlides=anim.slides;anim.slides=anim.slides.slice(0,2);window.__coverPptCtor=PptxGenJS;window.PptxGenJS=function(){const p=new window.__coverPptCtor();p.writeFile=async options=>{window.__coverPptName=options.fileName;window.__coverPptBlob=await p.write({outputType:'blob'});};return p;};exportPPTX();});
  await f.waitForFunction(()=>window.__coverPptBlob&&!window.__animExport,null,{timeout:60000});
  const ppt=await f.evaluate(async()=>({name:window.__coverPptName,data:await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(window.__coverPptBlob);})}));
  assert.match(ppt.name,/^\d{6}_PROCESS-STUDIO\.pptx$/);const bytes=Buffer.from(ppt.data,'base64');assert.equal(bytes.subarray(0,2).toString(),'PK');assert.ok(bytes.length>10000);fs.writeFileSync(path.join(SHOTS,'meeting-cover.pptx'),bytes);
  await f.evaluate(()=>{window.PptxGenJS=window.__coverPptCtor;anim.slides=window.__coverAllSlides;window.__meet.go(0);});
 }
 await f.evaluate(()=>{window.__coverNames=[];const orig=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__coverNames.push(this.download);return;}return orig.apply(this,arguments);};});
 await f.click('#psMeetCover [data-mc=download]');await f.waitForFunction(()=>window.__coverNames.length>0);
 const name=await f.evaluate(()=>window.__coverNames[0]);assert.match(name,/^\d{6}_.+_썸네일\.png$/);
 const png=await f.evaluate(async()=>{const c=await PSMeetCover.png(anim.slides[0].cover);return {w:c.width,h:c.height,data:c.toDataURL('image/png').split(',')[1]};});assert.deepEqual([png.w,png.h],format==='portrait'?[900,1600]:[1600,900]);fs.writeFileSync(path.join(SHOTS,'meeting-cover-'+size+'-thumbnail.png'),Buffer.from(png.data,'base64'));
 await page.screenshot({path:path.join(SHOTS,'meeting-cover-'+size+'-editor.png')});
 // Read-only mode must keep cover content unchanged even if called directly.
 await f.evaluate(()=>{window.__vaultReadOnly=true;PSMeetCover.render();PSMeetCover.add();});assert.ok(await f.locator('#psMeetCover [data-mc=add]').isDisabled());
 assert.equal(await f.evaluate(()=>JSON.stringify(anim.slides[0].cover)),savedCover);await f.evaluate(()=>{window.__vaultReadOnly=false;PSMeetCover.render();});
 // Slideshow renders the cover and hides controls; normal slides return to the pitch.
 await f.evaluate(()=>window.__meet.show(true));await f.waitForFunction(()=>document.body.classList.contains('focus-board')&&window.__meet.idx()===0);
 assert.equal(await f.locator('#psMeetCover .mc-panel').isVisible(),false);
 await f.evaluate(()=>window.__meet.go(1));await f.waitForFunction(()=>!document.body.classList.contains('ps-meet-cover'));
 await f.click('#meetNav .mn-exit');await f.evaluate(()=>window.__meet.go(0));await f.waitForSelector('#psMeetCover:not([hidden])');
 if(engine==='chromium'){
  await f.evaluate(()=>{const c=anim.slides[0],s=anim.slides[1],a=JSON.parse(JSON.stringify(s.snap)),b=JSON.parse(JSON.stringify(a));b.players[1].x+=120;s.frames=[{snap:a,dur:.3},{snap:b,dur:.3}];anim.slides=[c,s];window.__meet.go(0);window.__coverPaints=0;const paint=PSMeetCover.paint;PSMeetCover.paint=function(){window.__coverPaints++;return paint.apply(this,arguments);};window.__coverSequence=JSON.stringify(anim.slides,(k,v)=>k==='thumb'?undefined:v);window.__coverSaved=0;window.showSaveFilePicker=async options=>{window.__coverPick=options.suggestedName;return {name:options.suggestedName,createWritable:async()=>({write:async b=>{window.__coverVideoBlob=b;},close:async()=>{window.__coverSaved=1;}})};};});
  await f.evaluate(()=>exportVideoSheet('meeting'));await f.waitForSelector('#evGo');
  assert.match(await f.locator('#evDesc').textContent(),format==='portrait'?/세로 9:16/:/가로 16:9/);
  await f.evaluate(()=>{for(const label of ['720p','15fps','2초'])[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===label).click();document.getElementById('evGo').click();});
  await f.waitForFunction(()=>window.__coverSaved===1,null,{timeout:120000});
  const v=await f.evaluate(async()=>{const video=document.createElement('video'),url=URL.createObjectURL(window.__coverVideoBlob);video.muted=true;video.preload='auto';video.style.cssText='position:fixed;left:-9999px;width:4px;height:4px';document.body.appendChild(video);await new Promise((ok,no)=>{video.onloadeddata=ok;video.onerror=no;video.src=url;});await new Promise((ok,no)=>{video.onseeked=ok;video.onerror=no;video.currentTime=.1;});await new Promise(requestAnimationFrame);const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);const px=[...c.getContext('2d').getImageData(5,5,1,1).data];video.remove();URL.revokeObjectURL(url);return {px,width:c.width,height:c.height,name:window.__coverPick,bytes:window.__coverVideoBlob.size,paint:window.__coverPaints,same:JSON.stringify(anim.slides,(k,v)=>k==='thumb'?undefined:v)===window.__coverSequence};});
  assert.match(v.name,/^\d{6}_미팅_슬라이드\.(mp4|webm)$/);assert.ok(v.bytes>1000);assert.deepEqual([v.width,v.height],format==='portrait'?[720,1280]:[1280,720]);assert.ok(v.paint>=25);assert.ok(v.same,'MP4 encoding preserves slide data');
  assert.ok(Math.abs(v.px[0]-35)<12&&Math.abs(v.px[1]-69)<12&&Math.abs(v.px[2]-103)<12,'decoded first video frame has cover background, not pitch: '+JSON.stringify(v));
 }
 const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],JSON.stringify(errs));
 console.log(JSON.stringify({test:'meeting-cover',engine,size,format,passed:true,filename:name,saveReload:true,workBoardPreserved:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
