import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.304 — 사용자 «애니메이션에 썸네일은 필요없고 보드를 tv로 연결했을 때 페이지나 옵션들 고르는 거 안 보이게 할 수 있게»(합성 팀 fixture 에서만).
//  ① 장면 줄(떠 있는 도크)은 번호 칩: 그림 칸은 안 보이고 비어 있다 · 그림 없는 장면의 그림을 만들지 않는다(판을 갈아 끼우지 않는다) · 누르면 그 장면
//  ② 보관함 «전체화면»: 위쪽 띠(페이지 탭 · 보기 옵션 · 오른쪽 도구)가 걷힌다 · ‹ n / m › 는 도크와 겹치지 않고 페이지를 넘긴다 · 나오면 띠가 돌아온다
//     (고치기 전 코드는 전체화면에서도 띠가 보이고 ‹ n / m › 가 도구 줄을 덮는다)
//  ③ «큰 화면으로 보기»(보기 전용)의 전체화면도 띠 없음
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-tv-clean-3304 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring;},null,{timeout:60000});
  const f=await (await page.$('#fBoard')).contentFrame();
  const floating=await f.evaluate(()=>document.body.classList.contains('ps-dock-float'));
  assert.equal(floating,true,'이 시험은 떠 있는 도크 화면(데스크톱 · 아이패드)을 본다');

  step('seed');
  await f.evaluate(async()=>{
    const base=captureSnap(),p=PR();
    const mk=k=>[0,1,2,3].map(i=>({id:'b'+i,name:'',num:i+1,team:'blue',x:p.L+(p.R-p.L)*(.2+i*.15+k*.02),y:p.T+(p.B-p.T)*(.3+i*.1)}));
    const snapOf=k=>Object.assign({},base,{players:mk(k),equipment:[],drawings:[],tokV:2,label:'num',gridType:'off'});
    const page_=name=>{const frames=[0,1,2,3,4].map(k=>({__t:'',cap:k===1?'자막':'',curves:{},dur:1,hl:[],hold:.6,moveSpeed:1,snap:snapOf(k)}));return {name,notes:'',snap:JSON.parse(JSON.stringify(frames[0].snap)),anim:{frames,active:0}};};
    const pages=['01 첫 장','02 둘째 장','03 셋째 장'].map(page_);
    const it={libId:'Ltvclean001',type:'board',name:'가상 TV 판',folder:'',tags:['작전판'],hold:.6,coaching:'',desc:'',focus:'',method:'',overview:'',rpe:5,sets:1,pages,snap:JSON.parse(JSON.stringify(pages[0].snap)),frames:JSON.parse(JSON.stringify(pages[0].anim.frames)),savedAt:Date.now(),editedAt:Date.now()};
    try{stampCreator(it);}catch(_){}
    await libTurn(()=>libGet().then(lib=>{lib.unshift(it);return libWrite(lib).then(()=>{libTouch();});}));
  });
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});await page.waitForTimeout(900);
  const card=()=>f.locator('.vcard').filter({hasText:'가상 TV 판'});
  const openCard=async edit=>{const btn=card().locator(edit?'.vc-act.edit':'.vc-act.view');if(!(await btn.isVisible()))await card().click({position:{x:60,y:12}});await btn.click();
    await f.waitForFunction(()=>window.__csView==='board'&&!window.__vaultHydrating&&document.querySelector('#vCreateBar.on'),null,{timeout:15000});await page.waitForTimeout(1500);};

  step('chips');
  await openCard(true);
  await f.waitForFunction(()=>document.querySelectorAll('#animFrames .anim-frame').length===5&&document.querySelectorAll('#animFrames .df-dur').length===5,null,{timeout:15000});
  await page.waitForTimeout(1200);   /* 예전 코드는 이 사이(120ms idle)에 그림 없는 장면의 그림을 만든다 */
  const chips=await f.evaluate(()=>{const k=[...document.querySelectorAll('#animFrames .anim-frame')],box=e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};};
    return {n:k.length,nums:k.map(d=>d.querySelector('.afi').textContent.trim()),durs:k.map(d=>/^\d+\.\d초$/.test(d.querySelector('.df-dur').textContent)),
      aftShown:k.filter(d=>{const a=d.querySelector('.aft');return a&&getComputedStyle(a).display!=='none';}).length,aftKids:k.reduce((s,d)=>s+(d.querySelector('.aft')?d.querySelector('.aft').childElementCount:0),0),
      imgs:document.querySelectorAll('#animFrames img,#animFrames svg').length,sizes:k.map(box),on:k.findIndex(d=>d.classList.contains('on')),
      thumbs:anim.frames.map(x=>!!x.thumb),menu:!!(k.find(d=>d.classList.contains('on'))||document).querySelector('.afm')&&getComputedStyle(k.find(d=>d.classList.contains('on')).querySelector('.afm')).display!=='none',cap:!!k[1].querySelector('.afc')};});
  assert.equal(chips.n,5);assert.deepEqual(chips.nums,['1','2','3','4','5'],'번호');assert.ok(chips.durs.every(Boolean),'시간 글자');
  assert.equal(chips.aftShown,0,'그림 칸은 안 보인다');assert.equal(chips.aftKids,0,'그림 칸은 비어 있다(SVG 를 넣지 않는다)');assert.equal(chips.imgs,0,'장면 줄에 그림 없음');
  assert.ok(chips.on>=0,'지금 장면 칩');
  chips.sizes.forEach((s,i)=>{assert.equal(s.h,34,'칩 높이');assert.equal(s.w,i===chips.on?58:38,'칩 폭 — 지금 장면만 넓게(⋯ 자리) '+JSON.stringify(chips.sizes));});
  assert.equal(chips.menu,true,'지금 장면의 ⋯ 메뉴는 그대로');assert.equal(chips.cap,true,'자막 표시 점');
  assert.deepEqual(chips.thumbs.slice(1).map((t,i)=>i+1===chips.on?null:t).filter(t=>t!==null),chips.thumbs.slice(1).map((t,i)=>i+1===chips.on?null:false).filter(t=>t!==null),'그림 없는 장면의 그림을 만들지 않는다 '+JSON.stringify(chips.thumbs));
  /* 번호 칩을 누르면 그 장면 */
  await f.locator('#animFrames .anim-frame').nth(3).click();
  await f.waitForFunction(()=>animActive===3&&document.querySelectorAll('#animFrames .anim-frame')[3].classList.contains('on'),null,{timeout:8000});
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#animFrames .anim-frame')].map(d=>Math.round(d.getBoundingClientRect().width))),[38,38,38,58,38],'고른 칩이 넓어진다');
  await f.locator('#animFrames .anim-frame').nth(0).click();await f.waitForFunction(()=>animActive===0,null,{timeout:8000});

  step('full-edit');
  const look=()=>f.evaluate(()=>{const vis=e=>{if(!e)return false;const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0;},box=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom};};
    const strip=document.getElementById('boardPageStrip'),pg=document.getElementById('vvPg'),dock=document.getElementById('ps-command-dock'),bar=document.getElementById('vvBar');
    const hit=(a,b)=>!(a.r<=b.l||b.r<=a.l||a.b<=b.t||b.b<=a.t);
    return {full:document.body.classList.contains('vault-full'),strip:vis(strip),tabs:[...document.querySelectorAll('#boardPageStrip .bp-tab')].filter(vis).length,view:vis(document.querySelector('#boardPageStrip [data-v="3d"]')),
      pager:vis(pg),pagerBox:pg&&vis(pg)?box(pg):null,cnt:(document.getElementById('vvCnt')||{}).textContent||'',dock:vis(dock),overlap:!!(pg&&vis(pg)&&dock&&vis(dock)&&hit(box(pg),box(dock))),barOverlap:!!(pg&&vis(pg)&&bar&&vis(bar)&&hit(box(pg),box(bar))),
      vw:innerWidth,page:__psPages.book.idx(),chips:document.querySelectorAll('#animFrames .anim-frame').length};});
  const before=await look();
  assert.equal(before.full,false);assert.equal(before.strip,true,'편집 화면에는 띠가 있다');assert.equal(before.tabs,3,'페이지 탭 셋');assert.equal(before.view,true,'보기 옵션');
  await f.locator('#vCreateFull').click();
  await f.waitForFunction(()=>document.body.classList.contains('vault-full'),null,{timeout:5000});await page.waitForTimeout(900);
  const full=await look();
  assert.equal(full.strip,false,'전체화면: 위쪽 띠(페이지 탭 · 보기 옵션 · 오른쪽 도구)가 걷힌다');assert.equal(full.tabs,0);assert.equal(full.view,false);
  assert.equal(full.dock,true,'만들기 · 편집 중 전체화면은 도크가 남는다(1.992)');assert.equal(full.chips,5,'장면 줄 그대로');
  assert.equal(full.pager,true,'페이지 넘김 ‹ n / m ›');assert.equal(full.cnt.replace(/\s/g,''),'1/3');
  assert.equal(full.overlap,false,'‹ n / m › 가 도크를 덮지 않는다 '+JSON.stringify(full.pagerBox));assert.equal(full.barOverlap,false,'닫기 묶음과도 안 겹친다');
  assert.ok(full.pagerBox.l<full.vw/3&&full.pagerBox.t<80,'왼쪽 위 '+JSON.stringify(full.pagerBox));
  await f.locator('#vvNext').click();
  await f.waitForFunction(()=>__psPages.book.idx()===1,null,{timeout:8000});
  assert.equal((await look()).cnt.replace(/\s/g,''),'2/3','페이지가 넘어간다');
  await f.locator('#vvPrev').click();await f.waitForFunction(()=>__psPages.book.idx()===0,null,{timeout:8000});
  await f.locator('#vvEdit').click();
  await f.waitForFunction(()=>!document.body.classList.contains('vault-full'),null,{timeout:5000});await page.waitForTimeout(600);
  const back=await look();assert.equal(back.strip,true,'나오면 띠가 돌아온다');assert.equal(back.tabs,3);assert.equal(back.pager,false);

  step('full-view');
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());
  await f.waitForFunction(()=>window.__csView==='session',null,{timeout:15000});await page.waitForTimeout(900);
  await openCard(false);
  await f.locator('#vCreateFull').click();
  await f.waitForFunction(()=>document.body.classList.contains('vault-full'),null,{timeout:5000});await page.waitForTimeout(900);
  const view=await look();
  assert.equal(view.strip,false,'보기 전용 전체화면도 띠 없음');assert.equal(view.pager,true);assert.equal(view.overlap,false);
  await f.locator('#vvClose').click();
  await f.waitForFunction(()=>!document.body.classList.contains('vault-full'),null,{timeout:8000});

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'board-tv-clean-3304',engine,size,passed:true,pager:full.pagerBox,thumbs:chips.thumbs}));
}catch(e){console.error('board-tv-clean-3304 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
