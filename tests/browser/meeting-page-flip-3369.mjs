// 3.369 — 미팅 «페이지 보기»에서 슬라이드를 넘길 때 깜빡임(사용자 2026-11-23 «보관함에서 미팅 만든 거 슬라이드 넘길 때마다 이상하게 깜빡여»).
// 예전: 넘길 때마다 A4 미리보기 틀(#ksPagePreview)의 srcdoc 를 갈아 끼웠다 → 새 문서가 설 때까지 빈 책상이 비치고,
// load 전 첫 그림에 1번 슬라이드가 그림 없이 원래 크기로 한 번 보였다(그 장만 남기기 · 책상 CSS · 화면 맞춤이 load 뒤였다).
// 이제: 이미 선 문서는 그 안의 내용만 한 번에 바꾼다(같은 문서) · 처음 서는 문서는 모양을 처음부터 적어 둔다.
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const NAME='경기 전 미팅 — 상대 4-4-2';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers,examples:true});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__psMeetViewApi&&window.__boardReady,null,{timeout:30000});
  await f.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),NAME,{timeout:30000});
  await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));(c.querySelector('.vc-nm')||c).click();},NAME);
  await f.waitForSelector('#drillFiles .vx-preview [data-vx-view]');
  await f.click('#drillFiles .vx-preview [data-vx-view]');
  await f.waitForFunction(()=>document.body.classList.contains('meeting-page-mode')&&window.__vaultReadOnly===true,null,{timeout:15000});
  const paper=()=>f.evaluate(()=>{const d=document.getElementById('ksPagePreview').contentDocument,pg=[...d.querySelectorAll('.mp-page')];
    return {n:pg.length,i:pg[0]?+pg[0].dataset.slideIndex:-1,title:(d.querySelector('.mp-line.title')||{}).textContent||'',zoom:+d.body.style.zoom,pics:d.querySelectorAll('.mp-pitch svg,.mp-pitch img').length,same:d===window.__flipDoc};});
  const ready=i=>f.waitForFunction(i=>{const d=document.getElementById('ksPagePreview')&&document.getElementById('ksPagePreview').contentDocument,p=d&&d.readyState==='complete'&&d.querySelectorAll('.mp-page');
    return !!p&&p.length===1&&+p[0].dataset.slideIndex===i&&+d.body.style.zoom>0&&!window.__ksNav;},i,{timeout:10000});
  await ready(0);
  // 처음 서는 문서: 모양(그 장만 · 책상 · 화면 맞춤)이 문서에 처음부터 적혀 있다 — load 를 기다리지 않는다
  const first=await f.evaluate(()=>{const fr=document.getElementById('ksPagePreview'),s=fr.srcdoc,m=s.match(/<style id="mpFirstPaint">([^<]*)<\/style>/);return {css:m?m[1]:'',z:+fr.contentDocument.body.style.zoom};});
  assert.match(first.css,/\.mp-page:not\(\[data-slide-index="0"\]\)\{display:none!important\}/,'다른 장은 처음부터 감춘다');
  assert.match(first.css,/html\{background:#E6E9ED/,'책상 CSS 도 처음부터');
  const z0=first.css.match(/body\{zoom:([\d.]+);margin-top:/);assert.ok(z0,'화면 맞춤도 처음부터');assert.ok(Math.abs(+z0[1]-first.z)<0.02,'처음 적은 맞춤 '+z0[1]+' ≈ load 뒤 맞춤 '+first.z);
  const titles=await f.evaluate(()=>anim.slides.map(s=>s.title));
  await f.evaluate(()=>{const fr=document.getElementById('ksPagePreview');window.__flipDoc=fr.contentDocument;window.__flipLoads=0;fr.addEventListener('load',()=>window.__flipLoads++);});
  // 넘기기: 같은 문서 안에서 그 장으로 — 틀을 다시 싣지 않는다
  for(const i of [1,2,0]){
    await f.evaluate(i=>window.__meet.go(i),i);await ready(i);
    const p=await paper();
    assert.equal(p.same,true,'같은 문서 '+i);assert.equal(p.n,1);assert.equal(p.i,i);assert.equal(p.title,titles[i]);assert.ok(p.pics>=1,'그 장의 운동장 그림');assert.ok(Math.abs(p.zoom-first.z)<1e-6,'맞춤 그대로');
  }
  assert.equal(await f.evaluate(()=>window.__flipLoads),0,'넘기는 동안 틀을 다시 싣지 않았다');
  // ←→ 도 같은 길
  await f.evaluate(()=>window.__meetStep(1));await ready(1);assert.equal((await paper()).same,true);
  // 방향을 바꿔도(고칠 수 있는 미팅) 같은 문서에서 종이가 바뀐다 — 보기 전용에선 방향을 못 바꾸므로 «편집»으로
  await f.click('#vCreateEdit');await f.waitForFunction(()=>window.__vaultReadOnly!==true&&document.body.classList.contains('meeting-page-mode'),null,{timeout:15000});
  await ready(await f.evaluate(()=>window.__meet.idx()));
  const before=await f.evaluate(()=>{const fr=document.getElementById('ksPagePreview');window.__flipDoc=fr.contentDocument;return {o:meetingPdfOrientation(anim.slides),w:fr.contentDocument.querySelector('.mp-page').getBoundingClientRect().width};});
  await f.evaluate(o=>window.__meetingPageChoose(o==='portrait'?'landscape':'portrait'),before.o);
  await f.waitForFunction(o=>meetingPdfOrientation(anim.slides)!==o&&!window.__ksNav,before.o);await page.waitForTimeout(400);
  const after=await f.evaluate(()=>{const d=document.getElementById('ksPagePreview').contentDocument,r=d.querySelector('.mp-page').getBoundingClientRect();return {same:d===window.__flipDoc,land:r.width>r.height,n:d.querySelectorAll('.mp-page').length};});
  assert.equal(after.same,true,'방향을 바꿔도 같은 문서');assert.equal(after.n,1);assert.equal(after.land,before.o==='portrait','종이 방향이 바뀌었다');
  // 종이 위 고치기는 지금 장에 적힌다(누르기 처리는 문서에 한 번만 묶여 있고 지금 장을 읽는다)
  await f.evaluate(o=>window.__meetingPageChoose(o),before.o);await page.waitForTimeout(400);
  await f.evaluate(()=>window.__meet.go(2));await ready(2);
  const pv=page.frames().find(x=>x.parentFrame()===f&&x!==f&&x.url().startsWith('about:srcdoc'));
  await pv.click('.mp-line.title');await pv.waitForSelector('textarea.mp-inline-editor');await pv.fill('textarea.mp-inline-editor','고친 제목 3.369');await pv.press('textarea.mp-inline-editor','Enter');
  await f.waitForFunction(()=>anim.slides[2].title==='고친 제목 3.369');
  assert.equal(await f.evaluate(()=>anim.slides[0].title),titles[0],'다른 장은 그대로');
  const errs=logs.filter(l=>l.type==='pageerror');assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({ok:true,engine,size,zoom:first.z}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();
}
