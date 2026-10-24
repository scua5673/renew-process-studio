import assert from 'node:assert/strict';import path from 'node:path';
import {startFixture,openApp,ready,SIZES,SHOTS} from '../fixtures/team-app.mjs';
const fx=await startFixture(),browsers={},engine=process.env.PS_BROWSER_ENGINE||'chromium';for(const s of Object.values(SIZES))s.engine=engine;
let step='',lastPage,lastWidth;
try{for(const width of (process.env.PS_WIDTHS||'375,393,768,1280').split(',').map(Number)){
 const size=width<700?'phone':width<1000?'ipad':'desktop';SIZES[size].ctx.viewport={width,height:900};SIZES[size].ctx.screen={width,height:900};
 const {page,context,logs}=await openApp(fx,size,{browsers,tilt3d:false});
 lastPage=page;lastWidth=width;
 async function board(){await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());const f=await(await page.waitForSelector('#fBoard')).contentFrame();await f.waitForFunction(()=>window.__boardReady&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&!!(_boardPrivateRecord?_boardPrivateRecord.base:_boardPrivateBase)&&window.__psShapeMenu&&window.PSMeetForm);return f;}
 let f=await board();
 step='text-position';
 await f.evaluate(()=>{
  __setTilt(false);boardShowDefault();state.tool='move';const base=captureSnap();base.ball=null;base.players=[{id:101,team:'blue',num:'1',x:250,y:250}];
  const t=(id,text,x,color)=>({type:'text',_sceneId:id,text,color,size:26,pts:[{x,y:160}],bg:'#fff'}),d=t('main','공격',420,'#000');
  anim.frames=[{snap:{...structuredClone(base),drawings:[t('main','전반',100,'#123456')]}},{snap:{...structuredClone(base),drawings:[d]}},{snap:{...structuredClone(base),drawings:[]}},{snap:{...structuredClone(base),drawings:[t('legacy','공격',600,'#ffa500')]}},{snap:{...structuredClone(base),drawings:[t('a','공격',100,'#000'),t('b','공격',200,'#000')]}}];
  animActive=-1;selectAnimFrame(1);selectItem('drawing',state.drawings[0]);__selPanelOpen(true);updateDelUI();
 });
 await f.locator('#textPositionAllBtn').click();
 if(width===375||width===1280)await page.screenshot({path:path.join(SHOTS,`feedback-${engine}-${width}-text.png`)});
 let pos=await f.evaluate(()=>anim.frames.map(fr=>fr.snap.drawings.map(d=>({id:d._sceneId,text:d.text,x:d.pts[0].x,color:d.color}))));
 assert.deepEqual(pos[0],[{id:'main',text:'전반',x:420,color:'#123456'}]);assert.deepEqual(pos[2],[]);assert.equal(pos[3][0].x,420);assert.equal(pos[3][0].color,'#ffa500');assert.deepEqual(pos[4].map(d=>d.x),[100,200]);
 await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>anim.frames[0].snap.drawings[0].pts[0].x),100);await f.evaluate(()=>redoLast());
 assert.equal(await f.evaluate(()=>__boardSaveExplicit()),true);await page.reload();await ready(page);f=await board();await f.waitForFunction(()=>anim.frames.length===5&&anim.frames[0].snap.drawings[0].pts[0].x===420);
 step='reset-key';
 const legacyKeys=await f.evaluate(()=>{localStorage.setItem('cs_tool_shortcuts_tab_v1','board');__psToggleBoardSettings('open');const pop=document.getElementById('cmd-board-settings-pop');if(pop){pop.__psSelectTab('keys');return false;}__openToolShortcutSettings();return true;});
 if(!legacyKeys)await f.locator('#cmd-board-settings-keyspane [data-keytab=board]').click();const key=f.locator((legacyKeys?'#psToolKeyOv':'#cmd-board-settings-keyspane')+' [data-tool=resetLaterSelection]');assert.equal(await key.getAttribute('data-key'),'');await key.click();await key.focus();await page.keyboard.press('Shift+KeyR');assert.equal(await key.getAttribute('data-key'),'shift+r');if(legacyKeys)await f.locator('#dkSave').click();else await f.evaluate(()=>__psToggleBoardSettings('close'));
 await f.evaluate(()=>{
  const base=captureSnap(),snap=(x)=>({...structuredClone(base),players:[{id:101,team:'blue',num:'1',x,y:250},{id:102,team:'blue',num:'2',x:800,y:350}],drawings:[{type:'rect',_sceneId:'shape',color:'#fff',pts:[{x,y:100},{x:x+40,y:140}]}]});
  anim.frames=[{snap:snap(100)},{snap:snap(300)},{snap:snap(600)}];animActive=-1;selectAnimFrame(1);multiSel=[state.players[0],state.drawings[0]];sel=null;renderDrawings();updateDelUI();document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();
 });
 await f.evaluate(()=>{anim.frames[0].thumb=__snapToThumb(anim.frames[0].snap);});assert.equal(await f.evaluate(()=>multiSel.length===2&&state.players.includes(multiSel[0])&&state.drawings.includes(multiSel[1])),true,'thumbnail preserves mixed selection and live references');
 const first=await f.evaluate(()=>JSON.stringify(anim.frames[0])),undos=await f.evaluate(()=>undoStack.length);await page.keyboard.press('Shift+KeyR');
 assert.deepEqual(await f.evaluate(()=>[anim.frames[2].snap.players[0].x,anim.frames[2].snap.drawings[0].pts[0].x,anim.frames[2].snap.players[1].x]),[300,300,800]);assert.equal(await f.evaluate(()=>JSON.stringify(anim.frames[0])),first);assert.equal(await f.evaluate(()=>undoStack.length),undos+1,'mixed reset is one undo');
 await f.evaluate(()=>undoLast());assert.deepEqual(await f.evaluate(()=>[anim.frames[2].snap.players[0].x,anim.frames[2].snap.drawings[0].pts[0].x]),[600,600]);
 await f.evaluate(()=>{const i=document.createElement('textarea');i.id='feedbackTyping';document.body.appendChild(i);i.focus();});await page.keyboard.press('Shift+KeyR');assert.equal(await f.locator('#feedbackTyping').inputValue(),'R');assert.equal(await f.evaluate(()=>anim.frames[2].snap.players[0].x),600);await f.evaluate(()=>document.getElementById('feedbackTyping').remove());
 await f.evaluate(()=>{window.__vaultReadOnly=true;document.body.focus();});await page.keyboard.press('Shift+KeyR');assert.equal(await f.evaluate(()=>anim.frames[2].snap.players[0].x),600);await f.evaluate(()=>window.__vaultReadOnly=false);
 step='meeting-start';
 await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());await f.waitForFunction(()=>document.getElementById('dfNew'));
 await f.evaluate(()=>document.getElementById('dfNew').click());await f.waitForSelector('.vcc-item');await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());await f.waitForSelector('#psMeetForm.on');
 assert.equal(await f.locator('#psMeetForm [data-start=categories]').getAttribute('aria-pressed'),'true');assert.equal(await f.locator('#psMeetForm [data-team=us]').isVisible(),false);assert.equal(await f.locator('#psMeetForm .mf-categories input').count(),9);
 const bounds=await f.evaluate(()=>{const b=document.querySelector('#psMeetForm .mf-box'),r=b.getBoundingClientRect();return {left:r.left,right:r.right,w:innerWidth,overflow:b.scrollWidth-b.clientWidth};});assert.ok(bounds.left>=0&&bounds.right<=bounds.w+1&&bounds.overflow<=1,JSON.stringify({width,bounds}));
 if(width===375||width===1280)await page.screenshot({path:path.join(SHOTS,`feedback-${engine}-${width}-start.png`)});
 const choices=f.locator('#psMeetForm .mf-categories input');for(let i=0;i<9;i++)await choices.nth(i).uncheck();assert.equal(await f.locator('#psMeetForm .mf-go').isEnabled(),false);await choices.nth(0).check();await choices.nth(4).check();await f.locator('#psMeetForm .mf-go').click();
 await f.waitForFunction(()=>!document.querySelector('#psMeetForm.on')&&anim.slides.length===2);assert.equal(await f.evaluate(()=>anim.slides.every(s=>!s.snap.players.length&&!s.snap.drawings.length&&!s.snap.equipment.length&&s.snap.ball===null&&!s.points.length)),true);
 step='library-copy';
 const originals=await f.evaluate(async()=>{
  const sn=captureSnap();sn.players=[{id:700,team:'red',num:'7',x:500,y:300}];sn.drawings=[];
  const b={libId:'Vfeedback-board',type:'board',name:'합성 가져올 작전판',createdBy:psMyUid(),pages:[{name:'훈련 원본',snap:structuredClone(sn),anim:{frames:[{snap:structuredClone(sn),dur:1},{snap:{...structuredClone(sn),players:[{...sn.players[0],x:700}]},dur:2}]}}]},m={libId:'Vfeedback-meeting',type:'meeting',name:'합성 가져올 미팅',createdBy:psMyUid(),slides:[{title:'원본 제목',points:['원본 메모'],snap:structuredClone(sn),pdfOrientation:'landscape'}]};
  await boardStore.set('cs_drill_lib_v1',[b,m]);return JSON.stringify([b,m]);
 });
 async function openImport(){if(await f.locator('#ksImportLibrary').isVisible())await f.locator('#ksImportLibrary').click();else{await f.locator('#ksBot .kb-more').tap();await f.locator('#ksPop').getByRole('button',{name:'보관함에서 가져오기',exact:true}).tap();}await f.locator('#psMeetImport').waitFor({state:'visible'});}
 async function importItem(name){step='library-copy '+name;await openImport();await f.getByRole('button',{name,exact:true}).click();await f.locator('#psMeetImport .mi-go').click();await f.waitForFunction(()=>!document.getElementById('psMeetImport'));}
 await importItem('합성 가져올 작전판 · 작전판');assert.equal(await f.evaluate(()=>anim.slides.length),3);assert.deepEqual(await f.evaluate(()=>anim.slides[2].frames.map(fr=>fr.snap.players[0].x)),[500,700]);assert.equal(await f.locator('#animBar').isVisible(),false,'page preview leaves meeting tools available');
 await importItem('합성 가져올 미팅 · 미팅');assert.equal(await f.evaluate(()=>anim.slides.length),4);assert.deepEqual(await f.evaluate(()=>anim.slides[3].points),['원본 메모']);
 await f.evaluate(()=>{anim.slides[3].points.push('사본에서 추가');anim.slides[3].title='사본 제목';window.__ksRender();});
 assert.equal(await f.evaluate(async()=>JSON.stringify((await libGet()).filter(d=>/^Vfeedback-/.test(d.libId)))),originals,'copy/import/edit keeps both original items unchanged');
 if(width===375||width===1280)await page.screenshot({path:path.join(SHOTS,`feedback-${engine}-${width}-imported.png`)});
 step='save-reopen';
 await f.evaluate(()=>document.getElementById('vCreateSave').click());await f.locator('#pssName').fill('합성 미팅 '+width);await f.locator('#pssOk').click();
 await f.waitForFunction(()=>!window.__vaultPending&&window.__csView==='session',null,{timeout:15000});
 const saved=await f.evaluate(async width=>{const d=(await libGet()).find(d=>d.name==='합성 미팅 '+width);return d&&{id:d.libId,n:d.slides.length,t:d.slides[3].title,p:d.slides[3].points};},width);assert.equal(saved.n,4);assert.equal(saved.t,'사본 제목');assert.deepEqual(saved.p,['원본 메모','사본에서 추가']);
 await page.reload();await ready(page);f=await board();assert.equal(await f.evaluate(()=>__psToolKeys().resetLaterSelection),'shift+r');await f.evaluate(id=>__vaultOpenMeeting(id),saved.id);await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides.length===4);assert.deepEqual(await f.evaluate(()=>anim.slides[3].points),saved.p);
 if(width===1280){
  await f.evaluate(()=>{window.psConfirm=(m,ok)=>ok();document.getElementById('dfNew').click();});await f.waitForSelector('.vcc-item');await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());await f.waitForSelector('#psMeetForm.on');
  await f.locator('#psMeetForm [data-start=empty]').click();assert.equal(await f.locator('#psMeetForm .mf-categories').isVisible(),false);await f.locator('#psMeetForm .mf-go').click();assert.equal(await f.evaluate(()=>anim.slides.length===1&&!anim.slides[0].title&&!anim.slides[0].snap.players.length&&!anim.slides[0].snap.drawings.length),true);
  await openImport();const source=f.getByRole('button',{name:'합성 가져올 작전판 · 작전판',exact:true});await source.waitFor({state:'visible'});
  await f.evaluate(()=>window.__curVaultId='different-fixture-meeting');await source.click();await f.waitForFunction(()=>!document.getElementById('psMeetImport'));assert.equal(await f.evaluate(()=>anim.slides.length),1,'stale meeting cannot receive imported data');
 }
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log(JSON.stringify({engine,width,textPosition:true,unchangedContent:true,missingAndAmbiguousPreserved:true,undo:true,resetKey:true,typingAndReadonly:true,categories:true,libraryCopy:true,sceneAnimationPreserved:true,saveAndReopen:true}));await context.close();
}}catch(e){
 console.error('board-feedback-3163 width='+lastWidth+' step='+step);
 if(lastPage){
  await lastPage.screenshot({path:path.join(SHOTS,`feedback-${engine}-${lastWidth}-failure.png`)}).catch(()=>{});
  const fr=await(await lastPage.$('#fBoard'))?.contentFrame();
  if(fr)console.error(JSON.stringify(await fr.evaluate(()=>({importer:document.getElementById('psMeetImport')?.innerText,popup:document.getElementById('ksPop')?.innerText,view:window.__csView,id:window.__curVaultId,classes:document.body.className}))));
 }
 throw e;
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
