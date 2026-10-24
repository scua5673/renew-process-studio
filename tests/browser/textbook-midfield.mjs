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
 await page.waitForSelector('#choice svg');
 assert.equal(await page.locator('.tactic').count(),4);
 assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(els=>els.filter(a=>!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.textContent)),[],'all chapter links have real destinations');
 for(const key of ['carry','direct','secure','choice']){
  await page.locator('[data-choice="'+key+'"]').click();
  assert.equal(await page.locator('#choice').getAttribute('data-scene'),key);
  await page.locator('#choice [data-act="next"]').click();
  assert.match(await page.locator('#choice .counter').textContent(),/^2/);
 }
 for(const [w,h,name] of [[1280,960,'desktop'],[1100,820,'tablet'],[375,812,'phone']]){
  await page.setViewportSize({width:w,height:h});
  await page.evaluate(async()=>{document.documentElement.style.scrollBehavior='auto';await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));scrollTo({top:0,behavior:'instant'});});
  await page.waitForFunction(()=>scrollY===0);
  await page.screenshot({path:path.join(out,'checks',name+'-chapter.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' no overflow');
  for(const key of ['choice','drill1','drill2','drill3']){
   await page.locator('#'+key).scrollIntoViewIfNeeded();
   await page.locator('#'+key).screenshot({path:path.join(out,'checks',name+'-'+key+'.png')});
  }
 }
 await page.setViewportSize({width:1280,height:960});
 for(const key of ['choice','drill1','drill2','drill3']){
  await page.locator('#'+key).scrollIntoViewIfNeeded();
  const svg=await page.locator('#'+key+' svg').evaluate(el=>el.outerHTML);
  fs.writeFileSync(path.join(out,'diagrams',key+'.svg'),svg);
  await page.locator('#'+key).screenshot({path:path.join(out,'diagrams',key+'.png')});
 }
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
 const errors=logs.filter(l=>l.type==='pageerror'&&/textbook|letterPack|PSTextbook/i.test(l.stack+' '+l.text));
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'checks','result.json'),JSON.stringify({passed:true,imported,checks:['responsive 375/1100/1280','4 decision branches','3 original-source drills','save 3 separate cards','open all 3 editors','deduplicate and preserve edits','copy single item','reload persistence','known-ID-only URL parsing'],logs},null,2));
 console.log('대표 장 · 반응형·원문 인원·담기·편집·중복·수정본 보존·새로고침 검증 통과');
} finally {for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
