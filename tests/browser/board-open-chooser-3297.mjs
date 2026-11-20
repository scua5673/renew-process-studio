import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS} from '../fixtures/team-app.mjs';
// 3.297 — 앱을 열면 «불러오기» 창(studio/board-open-chooser.js). 사용자 «처음 열었을 때 보드가 나오는데 불러오기 형태로 불러올 수 있게» → 목업 B-1.
// ① 보관함에 작전판이 없으면 뜨지 않는다 ② 작전판이 있으면 셸을 열 때 한 번: 이어서 · (새 보드) · 목록(이름 · 날짜 · 페이지 · 장면 · 폴더) · 폴더 칩 · 이름 찾기
// ③ Esc = 이어서, 다른 앱에 갔다 돌아와도 다시 안 뜬다 ④ 새로고침은 새로 연 것 — 다시 뜬다 ⑤ «열기»는 보관함 편집 길(__curVaultId) · 폰은 «보기»(읽기 전용)
// ⑥ 보드 설정 › 내 화면 › «앱을 열 때» 줄 — «바로 보드»면 뜨지 않고(pref-off) «불러오기 창»이면 다시 뜬다 · 창 바닥 체크도 같은 값.
// 합성 팀 fixture 에서만 돈다(openChooser:true — 다른 시험은 기본으로 꺼져 있다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop',phone=size==='phone';
const snap=k=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',x:400+k*20,y:300},{id:201,team:'red',num:'9',x:520,y:330}],equipment:[],drawings:[],ball:{x:410,y:310,scale:.62},orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2});
const THUMB='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#4c7136"/></svg>';
const items=[
  {libId:'OC1',type:'board',name:'가상 빌드업 기본형',folder:'가상 미팅 자료',savedAt:Date.now()-3600e3,snap:snap(0),thumb:THUMB,pages:[{snap:snap(0),anim:{frames:[{snap:snap(0)},{snap:snap(1)},{snap:snap(2)}]}},{snap:snap(1),anim:{frames:[]}}]},
  {libId:'OC2',type:'board',name:'가상 수비 전환',folder:'가상 세트피스',savedAt:Date.now()-86400e3*2,snap:snap(1),thumb:THUMB},
  {libId:'OC3',type:'train',name:'가상 훈련 카드',savedAt:Date.now(),snap:snap(2),thumb:THUMB,trainings:[]}
];
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers,openChooser:true});
  await ready(page);
  const frame=async()=>(await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  let f=await frame();
  const showBoard=async()=>{ if(phone){ await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-app="board"]:not([data-train])');if(b)b.click();}); await page.waitForTimeout(500); } };
  const waitWhy=why=>f.waitForFunction(w=>window.__psOpenChooserResult&&window.__psOpenChooserResult.why===w,why,{timeout:45000});
  const reopen=async()=>{ await page.reload(); await ready(page); f=await frame(); await showBoard(); };
  const chooser=()=>f.waitForSelector('#psOpenChooser .oc',{timeout:45000});
  const state=()=>f.evaluate(()=>{const r=document.getElementById('psOpenChooser'),d=r&&r.querySelector('.oc'),rb=d&&d.getBoundingClientRect();
    return r?{phone:r.classList.contains('phone'),title:d.querySelector('h2').textContent,sub:d.querySelector('.oc-h p').textContent,
      tiles:[...d.querySelectorAll('.oc-tile')].map(t=>({id:t.id,lbl:(t.querySelector('.oc-lbl')||{}).textContent||'',nm:t.querySelector('.oc-nm').textContent,mt:t.querySelector('.oc-mt').textContent})),
      rows:[...d.querySelectorAll('.oc-row')].map(x=>({lib:x.dataset.libId,nm:x.querySelector('.oc-nm').textContent,mt:x.querySelector('.oc-mt').textContent,go:x.querySelector('.oc-go').textContent,thumb:!!x.querySelector('.oc-th svg')})),
      chips:[...d.querySelectorAll('.oc-f')].map(c=>c.textContent+(c.classList.contains('on')?'*':'')),count:d.querySelector('.oc-sec span').textContent,
      box:{l:Math.round(rb.left),t:Math.round(rb.top),r:Math.round(rb.right),b:Math.round(rb.bottom),vw:innerWidth,vh:innerHeight},focus:document.activeElement===d,
      pref:localStorage.getItem('ps_open_chooser_v1'),shown:!!(parent&&parent.__psOpenChooserShown)}:null;});

  // ① 보관함이 비어 있으면 뜨지 않는다
  await showBoard();
  await waitWhy('no-boards');
  assert.equal(await f.evaluate(()=>!!document.getElementById('psOpenChooser')),false,'작전판이 없으면 창 없음');

  // ② 작전판 둘(+ 훈련 하나)을 보관함에 넣고 새로 열면 뜬다
  await f.evaluate(async its=>{ await libWrite(its); libTouch(); },items);
  await reopen(); await chooser();
  let s=await state();
  assert.equal(s.title,'불러오기'); assert.equal(s.phone,phone);
  assert.equal(s.sub,phone?'폰에서는 보기로 엽니다':'어느 작전판으로 시작할까요?');
  assert.ok(s.tiles.length>=1&&s.tiles[0].id==='psOpenChooserContinue'&&s.tiles[0].lbl==='이어서','이어서 타일 '+JSON.stringify(s.tiles));
  if(phone)assert.equal(s.tiles.length,1,'폰은 보기 전용 — 새 보드 없음');
  assert.deepEqual(s.rows.map(r=>[r.lib,r.nm,r.thumb]),[['OC1','가상 빌드업 기본형',true],['OC2','가상 수비 전환',true]],'작전판만 · 최근 저장 순 · 그림');
  assert.match(s.rows[0].mt,/페이지 2 · 장면 3 · 가상 미팅 자료$/,s.rows[0].mt);
  assert.match(s.rows[1].mt,/^\d+\/\d+ · 가상 세트피스$/,s.rows[1].mt);
  assert.equal(s.rows[0].go,(phone?'보기':'열기')+' ›');
  assert.deepEqual(s.chips,['전체 2*','가상 미팅 자료 1','가상 세트피스 1']);
  assert.equal(s.count,'2개 · 최근 저장 순');
  assert.ok(s.box.l>=0&&s.box.t>=0&&s.box.r<=s.box.vw&&s.box.b<=s.box.vh,'창은 화면 안 '+JSON.stringify(s.box));
  assert.equal(s.shown,true,'셸 창에 «뜬 적 있음» 표식'); assert.equal(s.focus,true,'창에 초점');
  await page.screenshot({path:path.join(SHOTS,'board-open-chooser-'+engine+'-open.png')});
  // 폴더 칩 · 이름 찾기
  await f.evaluate(()=>[...document.querySelectorAll('#psOpenChooser .oc-f')].find(c=>c.textContent.startsWith('가상 세트피스')).click());
  assert.deepEqual((await state()).rows.map(r=>r.lib),['OC2'],'폴더 칩');
  await f.evaluate(()=>[...document.querySelectorAll('#psOpenChooser .oc-f')][0].click());
  if(!phone){ await f.type('#psOpenChooser .oc-q','수비'); assert.deepEqual((await state()).rows.map(r=>r.lib),['OC2'],'이름 찾기'); await f.fill('#psOpenChooser .oc-q',''); }
  assert.equal((await state()).rows.length,2);

  // ③ Esc = 이어서 · 다른 앱에 갔다 돌아와도 다시 안 뜬다
  const before=await f.evaluate(()=>JSON.stringify(captureSnap().players.map(p=>[p.id,p.x,p.y])));
  await f.press('#psOpenChooser .oc','Escape');
  await f.waitForFunction(()=>!document.getElementById('psOpenChooser'));
  assert.equal(await f.evaluate(()=>JSON.stringify(captureSnap().players.map(p=>[p.id,p.x,p.y]))),before,'이어서 — 작업 보드 그대로');
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click()); await page.waitForTimeout(700);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click()); await page.waitForTimeout(900);
  assert.equal(await f.evaluate(()=>!!document.getElementById('psOpenChooser')),false,'탭을 오가도 다시 뜨지 않는다');

  // ④ 새로고침은 새로 연 것 → 다시 뜬다 ⑤ «열기» = 보관함 편집 길(폰은 보기)
  await reopen(); await chooser();
  await f.evaluate(()=>document.querySelector('#psOpenChooser .oc-row[data-lib-id="OC1"]').click());
  await f.waitForFunction(()=>!document.getElementById('psOpenChooser')&&window.__vaultViewMode===true,null,{timeout:20000});
  const opened=await f.evaluate(()=>({cur:window.__curVaultId||null,ro:!!window.__vaultReadOnly,edit:!!window.__vaultEdit,view:window.__csView||'board',title:(document.getElementById('vCreateTitle')||{}).textContent||'',players:captureSnap().players.length}));
  assert.equal(opened.title,'가상 빌드업 기본형','보관함 자료의 이름이 막대에');
  assert.equal(opened.view,'board'); assert.equal(opened.edit,true); assert.equal(opened.players,2,'그 자료의 판');
  if(phone)assert.equal(opened.ro,true,'폰은 보기 전용'); else {assert.equal(opened.ro,false);assert.equal(opened.cur,'OC1','편집 — 저장은 그 자료로');}
  await page.screenshot({path:path.join(SHOTS,'board-open-chooser-'+engine+'-opened.png')});

  // ⑥ 보드 설정 › 내 화면 › «앱을 열 때» · 바닥 체크(데스크톱 — 폰 보드는 보기 전용이라 설정 창이 없다)
  if(!phone){
    await reopen(); await chooser();
    await f.evaluate(()=>document.getElementById('psOpenChooserContinue').click());
    await f.waitForFunction(()=>!document.getElementById('psOpenChooser'));
    await f.waitForFunction(()=>typeof window.__psToggleBoardSettings==='function'&&!!document.getElementById('cmd-board-settings-pop'),null,{timeout:30000});
    await f.click('#bpBoardSettings'); await page.waitForTimeout(300);
    await f.evaluate(()=>document.getElementById('cmd-board-settings-pop').__psSelectTab('view')); await page.waitForTimeout(200);
    const row=await f.evaluate(()=>{const r=document.getElementById('psOpenChooserRow'),rb=r.getBoundingClientRect();return {tab:r.getAttribute('data-bs-tab'),vis:rb.width>0&&rb.height>0,lbl:r.querySelector('.menulbl').textContent,on:[...r.querySelectorAll('button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')),last:r===r.parentElement.lastElementChild};});
    assert.deepEqual(row,{tab:'view',vis:true,lbl:'앱을 열 때',on:['불러오기 창*','바로 보드'],last:true},JSON.stringify(row));
    await page.screenshot({path:path.join(SHOTS,'board-open-chooser-'+engine+'-settings.png')});
    await f.click('#psOpenChooserSeg button[data-v="0"]');
    assert.equal(await f.evaluate(()=>localStorage.getItem('ps_open_chooser_v1')),'0');
    await reopen(); await waitWhy('pref-off');
    assert.equal(await f.evaluate(()=>!!document.getElementById('psOpenChooser')),false,'«바로 보드»면 창 없음');
    await f.waitForFunction(()=>!!document.getElementById('cmd-board-settings-pop'),null,{timeout:30000});
    await f.click('#bpBoardSettings'); await page.waitForTimeout(300);
    await f.evaluate(()=>document.getElementById('cmd-board-settings-pop').__psSelectTab('view'));
    await f.click('#psOpenChooserSeg button[data-v="1"]');
    assert.equal(await f.evaluate(()=>localStorage.getItem('ps_open_chooser_v1')),null,'«불러오기 창» = 기본값(키 없음)');
    await reopen(); await chooser();
    await f.evaluate(()=>{const c=document.getElementById('psOpenChooserPref');c.click();});
    assert.equal(await f.evaluate(()=>localStorage.getItem('ps_open_chooser_v1')),'0','창 바닥 체크를 끄면 같은 값');
    await f.evaluate(()=>{const c=document.getElementById('psOpenChooserPref');c.click();});
    assert.equal(await f.evaluate(()=>localStorage.getItem('ps_open_chooser_v1')),null);
    await f.press('#psOpenChooser .oc','Escape');
  }

  const errs=logs.filter(l=>l.type==='pageerror');
  assert.deepEqual(errs,[],'페이지 오류 없음');
  fs.writeFileSync(path.join(SHOTS,'..','board-open-chooser-3297-'+engine+'.json'),JSON.stringify({passed:true,engine,size,rows:s.rows.map(r=>r.nm)},null,1));
  console.log('board-open-chooser-3297 ok · '+engine+' · '+size);
}catch(e){ console.error(e); process.exitCode=1; }
finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
