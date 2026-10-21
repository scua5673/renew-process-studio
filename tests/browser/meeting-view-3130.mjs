import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.130 — 보관함 미팅 «큰 화면으로 보기»(보기 전용)와 발표 화면(board-meet-look.js installView · board-topbar.js).
// 예전: 보기 전용인데 제목 · 메모를 고칠 수 있었고 닫으면 말없이 사라졌다 · 발표에서 위쪽 막대가 슬라이드 제목 · 메모를 덮었다 ·
// «나가기»와 흰 운동장의 메모가 흰 판 위에서 거의 안 보였다. 합성 팀 fixture 의 예시 미팅(«경기 전 미팅 — 상대 4-4-2»)으로 본다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const NAME='경기 전 미팅 — 상대 4-4-2';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers,examples:true});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__psMeetViewApi&&window.__boardReady,null,{timeout:30000});
  // 예시 다섯이 담기고 «프로세스» 폴더가 열린다 — 그 미팅 줄을 누르면 오른쪽 미리보기
  await f.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),NAME,{timeout:30000});
  await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));(c.querySelector('.vc-nm')||c).click();},NAME);
  await f.waitForFunction(n=>{const p=document.querySelector('#drillFiles .vx-preview');return p&&p.textContent.includes(n)&&p.querySelector('[data-vx-view]')&&p.querySelector('[data-vx-edit]');},NAME,{timeout:10000});
  const libId=await f.evaluate(()=>window.__vaultPreviewId);

  // 1) «큰 화면으로 보기» — 보기 전용: 칸이 잠기고 막대 이름은 «미팅 보기», «편집»이 선다
  await f.click('#drillFiles .vx-preview [data-vx-view]');
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&document.body.classList.contains('vcreating')&&window.__vaultReadOnly===true,null,{timeout:15000});
  await f.waitForFunction(()=>document.getElementById('vCreateTitle').textContent==='미팅 보기',null,{timeout:5000});
  const ro=await f.evaluate(()=>({title:document.getElementById('vCreateTitle').textContent,sub:document.getElementById('vCreateSub').textContent,
    edit:getComputedStyle(document.getElementById('vCreateEdit')).display,locked:['ksTitle','ksPoints','ksBrand','ksHeadIn'].map(id=>!!document.getElementById(id)&&document.getElementById(id).readOnly),
    title0:anim.slides[0].title}));
  assert.match(ro.sub,/보기 전용/);
  assert.notEqual(ro.edit,'none','«편집» 단추');
  assert.deepEqual(ro.locked,[true,true,true,true],'제목 · 메모 · 맨 위 문구 · 제목 띠 잠금');
  // 써 보면 바뀌지 않고, 안내가 뜬다
  await f.waitForFunction(()=>{const e=document.getElementById('ksTitle');const r=e.getBoundingClientRect();return r.width>0&&r.height>0;},null,{timeout:5000});
  await f.click('#ksTitle');await page.keyboard.press('End');await page.keyboard.type(' 고침');
  await page.waitForTimeout(300);
  const typed=await f.evaluate(()=>({v:document.getElementById('ksTitle').value,t:anim.slides[0].title,hint:(document.getElementById('hint')||{}).textContent||''}));
  assert.equal(typed.v,ro.title0,'칸이 그대로');assert.equal(typed.t,ro.title0,'슬라이드도 그대로');
  assert.match(typed.hint,/보기 전용이에요 — 위쪽 «편집»/);
  await page.screenshot({path:path.join(SHOTS,`meeting-view-3130-${engine}-${size}-1-view.png`)});

  // 2) «편집» — 닫고 같은 미팅을 편집으로 연다(보관함 «편집»과 같은 길) · 고치면 슬라이드에 들어간다
  await f.click('#vCreateEdit');
  await f.waitForFunction(id=>document.body.classList.contains('meet-mode')&&document.body.classList.contains('vcreating')&&window.__vaultReadOnly===false&&window.__curVaultId===id,libId,{timeout:15000});
  await page.waitForTimeout(600);
  const ed=await f.evaluate(()=>({title:document.getElementById('vCreateTitle').textContent,sub:document.getElementById('vCreateSub').textContent,locked:['ksTitle','ksPoints','ksBrand','ksHeadIn'].map(id=>document.getElementById(id).readOnly)}));
  assert.equal(ed.title,'미팅 수정');assert.doesNotMatch(ed.sub,/보기 전용/);
  assert.deepEqual(ed.locked,[false,false,false,false],'편집에서는 풀린다');
  await f.waitForFunction(()=>{const e=document.getElementById('ksTitle');const r=e.getBoundingClientRect();return r.width>0&&r.height>0;},null,{timeout:5000});
  await f.click('#ksTitle');await page.keyboard.press('End');await page.keyboard.type(' 고침');
  await f.waitForFunction(t=>anim.slides[0].title===t+' 고침',ro.title0,{timeout:5000});

  // 3) 발표 — 위쪽 막대 두 줄을 걷고, 제목 띠 · 메모가 보이고, «나가기»가 읽힌다
  await f.evaluate(()=>window.__meet.show(true));
  await f.waitForFunction(()=>document.body.classList.contains('focus-board')&&window.__meet.idx()>=0,null,{timeout:15000});
  await page.waitForTimeout(900);
  const sh=await f.evaluate(()=>{
    const d=id=>{const e=document.getElementById(id);return e?getComputedStyle(e).display:'';};
    const owner=(x,y)=>{const e=document.elementFromPoint(x,y);const c=e&&e.closest('[id]');return c?c.id:'';};
    const h=document.getElementById('ksHead'),hr=h.getBoundingClientRect(),ex=document.querySelector('#meetNav .mn-exit');
    const li=document.querySelector('#ksOv li');
    return {strip:d('boardPageStrip'),bar:d('vCreateBar'),pad:getComputedStyle(document.getElementById('boardView')).paddingTop,
      head:hr.width>0?owner(hr.left+hr.width/2,hr.top+hr.height/2):'(none)',exit:getComputedStyle(ex).color,exitBg:getComputedStyle(ex).backgroundColor,
      pitch:document.documentElement.dataset.pitch||'',li:li?getComputedStyle(li).color:null,liOwner:li?(()=>{const r=li.getBoundingClientRect();return owner(r.left+24,r.top+r.height/2);})():null};});
  await page.screenshot({path:path.join(SHOTS,`meeting-view-3130-${engine}-${size}-2-show.png`)});
  assert.equal(sh.strip,'none','페이지 띠(«보드 ▾» · 평면/3D)를 걷는다');
  assert.equal(sh.bar,'none','«미팅 수정 · 닫기» 막대를 걷는다');
  assert.equal(sh.pad,'0px','막대 자리를 운동장에');
  assert.ok(sh.head==='ksHead'||sh.head==='ksHeadIn','제목 띠 위에 아무것도 없다 '+JSON.stringify(sh));
  assert.equal(sh.exit,'rgb(196, 43, 28)','«나가기» 빨간 글자');
  if(sh.pitch==='white'||sh.pitch==='train'){
    assert.equal(sh.li,'rgb(20, 22, 26)','흰 운동장의 메모는 어두운 글자');
    assert.ok(!/boardPageStrip|tb/.test(sh.liOwner||''),'메모 첫 줄을 덮지 않는다 '+sh.liOwner);
  }
  // 나가면 막대가 돌아온다
  await f.click('#meetNav .mn-exit');
  await f.waitForFunction(()=>!document.body.classList.contains('focus-board'),null,{timeout:10000});
  await f.waitForFunction(()=>getComputedStyle(document.getElementById('vCreateBar')).display!=='none',null,{timeout:5000});

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
  console.log(JSON.stringify({ok:true,engine,size,ro,ed,sh}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
