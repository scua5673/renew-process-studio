import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const out='/Users/scua/Documents/ChatGPT/프로세스 스튜디오/outputs/2026-10-24-football-library/10-중원-전진';
fs.mkdirSync(path.join(out,'checks'),{recursive:true});
const fx=await startFixture(),browsers={};
try{
 const {page,context,logs}=await openApp(fx,'desktop',{browsers});
 await page.goto(fx.base+'/studio/textbook/ch10/index.html');
 await page.locator('#choice').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('#choice').dataset.nativeReady==='true');
 assert.equal(await page.locator('.tactic').count(),5);
 assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(els=>els.filter(a=>!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.textContent)),[],'all chapter links have real destinations');
 for(const key of ['carry','direct','secure','choice']){
  await page.locator('[data-choice="'+key+'"]').click();
  await page.waitForFunction(key=>document.querySelector('#choice').dataset.nativeScene===key,key);
  assert.equal(await page.locator('#choice').getAttribute('data-scene'),key);
  await page.locator('#choice [data-act="next"]').click();
  await page.waitForFunction(()=>document.querySelector('#choice .counter').textContent.startsWith('2 /'));
 }
 for(const [w,h,name] of [[1280,960,'desktop'],[1100,820,'tablet'],[375,812,'phone']]){
  await page.setViewportSize({width:w,height:h});
  await page.evaluate(async()=>{document.documentElement.style.scrollBehavior='auto';await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));scrollTo({top:0,behavior:'instant'});});
  await page.waitForFunction(()=>scrollY===0);
  await page.screenshot({path:path.join(out,'checks',name+'-chapter.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' no overflow');
  for(const key of ['choice','follow','drill1','drill2','drill3']){
   await page.locator('#'+key).scrollIntoViewIfNeeded();
   const fig=page.locator('#'+key);
   await page.waitForFunction(key=>document.getElementById(key).dataset.nativeReady==='true',key);
   await fig.screenshot({path:path.join(out,'checks',name+'-'+key+'.png')});
   if(key!=='choice')for(const mode of ['_fail','_coach','']){
    await fig.locator('[data-choice="'+key+mode+'"]').click();
    await page.waitForFunction(scene=>document.getElementById(scene.split('_')[0]).dataset.nativeScene===scene,key+mode);
    assert.equal(await fig.getAttribute('data-scene'),key+mode);
    await fig.screenshot({path:path.join(out,'checks',name+'-'+key+mode+'.png')});
    while(await fig.locator('[data-act="next"]').isEnabled()){
     const before=await fig.locator('.counter').textContent();
     await fig.locator('[data-act="next"]').click();
     await page.waitForFunction(({key,before})=>document.querySelector('#'+key+' .counter').textContent!==before,{key,before});
    }
    assert.ok((await fig.locator('.caption').textContent()).length>15,'every scene has an explanation');
    await fig.screenshot({path:path.join(out,'checks',name+'-'+key+mode+'-last.png')});
   }

  }
 }
 await page.setViewportSize({width:1280,height:960});
 for(const fig of ['follow','drill1','drill2','drill3'])await page.locator('#'+fig+' [data-choice="'+fig+'"]').click();
 for(const key of ['choice','follow','drill1','drill2','drill3']){
  await page.locator('#'+key).scrollIntoViewIfNeeded();
  const nativeFrame=await (await page.locator('#'+key+' iframe').elementHandle()).contentFrame();
  const svg=await nativeFrame.locator('#board').evaluate(el=>el.outerHTML);
  fs.writeFileSync(path.join(out,'diagrams',key+'.svg'),svg);
  await page.locator('#'+key).screenshot({path:path.join(out,'diagrams',key+'.png')});
 }
 const play=page.locator('#drill1');
 await play.locator('[data-choice="drill1_fail"]').click();await play.locator('[data-act="play"]').click();
 await page.waitForFunction(()=>document.querySelector('#drill1 .counter').textContent.startsWith('3 /'),null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#drill1 [data-act="play"]').textContent==='재생',null,{timeout:10000});
 for(const q of await page.locator('.checkpoint summary').all()){await q.click();assert.equal(await q.evaluate(el=>el.parentElement.open),true);}
 await page.getByRole('link',{name:'현장 기록지 열기와 인쇄',exact:true}).click();
 await page.getByRole('textbox',{name:'막힌 관계와 근거',exact:true}).fill('가상 팀 · N1의 수신 전에 아래 지원을 준비한다.');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'작성 내용 파일로 저장',exact:true}).click()]);
 assert.match(fs.readFileSync(await download.path(),'utf8'),/N1의 수신 전에/);
 await page.setViewportSize({width:700,height:1050});await page.emulateMedia({media:'print'});
 await page.locator('main').screenshot({path:path.join(out,'checks','field-notes-print.png')});
 assert.ok(await page.locator('main').evaluate(el=>el.getBoundingClientRect().height<1040),'the print sheet fits the intended writing area');
 await page.emulateMedia({media:'screen'});await page.setViewportSize({width:1280,height:960});
 assert.equal(fx.writes.length,0,'reading and playing the chapter cannot save into a workspace');
 await page.goto(fx.base+'/studio/textbook/ch10/index.html');
 await page.getByRole('link',{name:'훈련 3개 보관함에 담기 ↗',exact:true}).click();
 let bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await bf.waitForSelector('#psTextbookDialog',{timeout:45000});
 assert.equal(await bf.locator('#psTextbookDialog li').count(),3);
 await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
 await page.screenshot({path:path.join(out,'checks','import-confirm.png')});
 await bf.locator('#psTextbookDialog').getByRole('button',{name:'보관함에 담기',exact:true}).click();
 await bf.waitForFunction(async()=>((await libGet())||[]).filter(d=>d.textbook).length===3);
 const imported=await bf.evaluate(async()=>((await libGet())||[]).filter(d=>d.textbook).map(d=>({id:d.textbook.itemId,libId:d.libId,players:d.trainings[0].snap.players.length,frames:d.trainings[0].frames.length,method:d.trainings[0].method})).sort((a,b)=>a.id.localeCompare(b.id)));
 assert.deepEqual(imported.map(d=>d.players),[5,10,14]);
 assert.deepEqual(imported.map(d=>d.frames),[4,5,7]);
 assert.ok(imported.every(d=>d.method.includes('원문')));
 assert.ok(await bf.evaluate(async()=>((await libGet())||[]).filter(d=>d.textbook).every(d=>d.textbook.revision===3&&d.coaching.includes('현장 개입:'))),'coaching and revision survive the import');
 await page.screenshot({path:path.join(out,'checks','vault-saved.png')});
 for(const [i,d] of imported.entries()){
  await bf.evaluate(id=>openLibDrawEditor(id,false),d.libId);
  await bf.waitForFunction(()=>document.getElementById('editorModal').classList.contains('on'));
  const data=await bf.evaluate(()=>({players:state.players.length,spec:state.pitchSpec,frames:anim.frames.length,method:document.body.textContent.includes('원문')}));
  assert.equal(data.players,[5,10,14][i]);
  assert.deepEqual(await bf.evaluate(()=>[document.querySelector('#epGk').value,document.querySelector('#epField').value]),[['0','5'],['0','10'],['2','12']][i]);
  assert.ok(await bf.evaluate(()=>state.tokenScale>=1.4),'player numbers remain legible in the native editor'); assert.equal(data.frames,[4,5,7][i]);assert.equal(data.spec,['grid30','grid40','grid70'][i]);
  await page.screenshot({path:path.join(out,'checks','editor-'+(i+1)+'.png')});
  await bf.evaluate(()=>{window.__closingEditor=1;try{closeEditor(false);}finally{window.__closingEditor=0;}});
  await bf.waitForFunction(()=>!document.getElementById('editorModal').classList.contains('on'));
 }
 await bf.evaluate(async()=>{await libTurn(async()=>{const lib=await libGet();lib.find(d=>d.textbook?.itemId==='ch10-t1').trainings[0].method+='\n수정본 보존 확인';await libWrite(lib);libTouch();});});
 await page.goto(fx.base+'/studio/app.html#textbook=ch10');
 bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await bf.waitForSelector('#psTextbookDialog',{timeout:45000});
 await bf.locator('#psTextbookDialog').getByRole('button',{name:'보관함에서 보기',exact:true}).click();
 assert.equal(await bf.evaluate(async()=>((await libGet())||[]).filter(d=>d.textbook).length),3);
 assert.equal(await bf.evaluate(async()=>((await libGet())||[]).find(d=>d.textbook?.itemId==='ch10-t1').trainings[0].method.endsWith('수정본 보존 확인')),true);
 await page.goto(fx.base+'/studio/app.html#textbook=ch10-t2');
 bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await bf.waitForSelector('#psTextbookDialog',{timeout:45000});
 assert.equal(await bf.locator('#psTextbookDialog li').count(),1);
 await bf.getByRole('button',{name:'새 사본으로 담기',exact:true}).click();
 await bf.waitForFunction(async()=>((await libGet())||[]).filter(d=>d.textbook).length===4);
 await page.reload();bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await bf.waitForFunction(async()=>((await libGet())||[]).filter(d=>d.textbook).length===4);
 assert.equal(await page.evaluate(()=>PSTextbookPacks.parse('#textbook=ch10-t4')),null);
 assert.equal(await page.evaluate(()=>PSTextbookPacks.packUrl('__proto__',location)),null);
 // 이미 수정한 이전 판은 보강판으로 덮어쓰지 않는다.
 await bf.evaluate(async()=>{await libTurn(async()=>{const lib=await libGet(),d=lib.find(d=>d.textbook?.itemId==='ch10-t1');d.textbook.revision=1;d.coaching='이전 판의 가상 코치 수정';await libWrite(lib);libTouch();});});
 await page.goto(fx.base+'/studio/app.html#textbook=ch10-t1');
 bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await bf.waitForSelector('#psTextbookDialog',{timeout:45000});
 assert.match(await bf.locator('#psTextbookDialog').textContent(),/이전 판/);
 await page.waitForFunction(()=>!document.body.classList.contains('ps-booting'));
 await page.screenshot({path:path.join(out,'checks','upgrade-confirm.png')});
 await bf.getByRole('button',{name:'보강판 새 사본으로 담기',exact:true}).click();
 await bf.waitForFunction(async()=>((await libGet())||[]).filter(d=>d.textbook).length===5);
 await bf.waitForFunction(()=>document.body.classList.contains('editing'));
 await bf.evaluate(()=>{window.__closingEditor=1;try{closeEditor(false);}finally{window.__closingEditor=0;}});
 const editions=await bf.evaluate(async()=>((await libGet())||[]).filter(d=>d.textbook?.itemId==='ch10-t1').map(d=>({revision:d.textbook.revision,coaching:d.coaching,method:d.trainings[0].method})));
 assert.equal(editions.find(d=>d.revision===1).coaching,'이전 판의 가상 코치 수정');
 assert.match(editions.find(d=>d.revision===1).method,/수정본 보존 확인$/);
 assert.match(editions.find(d=>d.revision===3).coaching,/현장 개입:/);
 await page.goto(fx.base+'/studio/app.html#textbook=ch10-t1');
 bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await bf.waitForSelector('#psTextbookDialog',{timeout:45000});
 assert.equal(await bf.getByRole('button',{name:'보강판 새 사본으로 담기',exact:true}).count(),0,'newest edition is selected after upgrade');
 await bf.getByRole('button',{name:'보관함에서 보기',exact:true}).click();
 await page.goto(fx.base+'/studio/textbook/ch10/index.html#drill2');
 await page.waitForFunction(()=>document.querySelector('#drill2').dataset.nativeReady==='true');
 await page.locator('#drill2 [data-choice="drill2_coach"]').click();
 await page.waitForFunction(()=>document.querySelector('#drill2').dataset.nativeScene==='drill2_coach');
 const nf=await (await page.locator('#drill2 iframe').elementHandle()).contentFrame();
 assert.equal(await nf.evaluate(()=>communityBoardReadOnly()),true);
 assert.equal(await nf.evaluate(()=>state.players.length),10);
 const beforePlayer=await nf.evaluate(()=>JSON.stringify(state.players));
 await nf.locator('#board').click({position:{x:100,y:100},force:true});
 assert.equal(await nf.evaluate(()=>JSON.stringify(state.players)),beforePlayer,'the chapter cannot edit the source');
 await page.locator('#drill2 [data-act=play]').click();
 await nf.waitForFunction(()=>animPlaying&&animPauseState&&animPauseState.phase==='move');
 assert.notEqual(await nf.evaluate(()=>JSON.stringify(state.players)),beforePlayer,'the actual Studio engine moves the players');
 await page.locator('#drill2 [data-act=play]').click();
 await nf.waitForFunction(()=>!animPlaying);
 await page.getByRole('link',{name:'이 장면 담고 스튜디오에서 편집 ↗',exact:true}).nth(1).click();
 bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await bf.waitForSelector('#psTextbookDialog',{timeout:45000});
 assert.match(await bf.locator('#psTextbookDialog li').textContent(),/코치 개입/);
 await bf.getByRole('button',{name:'보관함에 담기',exact:true}).click();
 await bf.waitForFunction(()=>document.body.classList.contains('editing'));
 assert.ok(await bf.evaluate(()=>editorFileName.endsWith('코치 개입')));
 const expected=JSON.parse(fs.readFileSync(path.join(out,'midfield-drillpack.json'))).drills[1].variants.coach;
 const actual=await bf.evaluate(()=>anim.frames.map(f=>({snap:f.snap,cap:f.cap})));
 assert.equal(actual.length,expected.length);
 assert.deepEqual(actual.map(f=>f.snap.players.map(p=>[p.id,p.x,p.y])),expected.map(f=>f.snap.players.map(p=>[p.id,p.x,p.y])),'the selected coaching scene is the editable import');
 assert.equal(await bf.evaluate(()=>animHold),2.1);
 await page.screenshot({path:path.join(out,'checks','native-studio-editor.png')});
 const errors=logs.filter(l=>l.type==='pageerror'&&/textbook|letterPack|PSTextbook/i.test(l.stack+' '+l.text));
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'checks','result.json'),JSON.stringify({passed:true,imported,checks:['responsive 375/1100/1280','4 decision branches','4 comparison sets: success/failure/intervention','all scene steps and real-time playback','3 diagnostic answers','print and download field notes','upgrade without overwriting old edits','3 original-source drills','save 3 separate cards','open all 3 editors','deduplicate and preserve edits','copy single item','reload persistence','known-ID-only URL parsing'],logs},null,2));
 console.log('대표 장 · 반응형·원문 인원·담기·편집·중복·수정본 보존·새로고침 검증 통과');
} finally {for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
