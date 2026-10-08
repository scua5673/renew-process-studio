import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.970 — 미팅: 한 장의 토큰 이름 → 모든 장 · 세로형 먼저 · BEST 11 운동장 전체 · 슬라이드 MP4(장면 슬라이드는 장면대로)
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&document.getElementById('dfNew'));
  await bf.evaluate(()=>{try{localStorage.removeItem('ps_meet_orient_v2');}catch(_){}document.getElementById('dfNew').click();});
  await bf.waitForSelector('.vcc-item');
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await bf.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
  await page.waitForTimeout(400);

  // 1) 세로형 먼저 — 고르개 순서와 새 미팅 기본
  const seg=await bf.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/^(세로형|가로형)$/.test(b.textContent)&&b.offsetParent).map(b=>b.textContent+':'+b.getAttribute('aria-pressed')));
  assert.deepEqual(seg,['세로형:true','가로형:false'],JSON.stringify(seg));
  assert.equal(await bf.evaluate(()=>meetingPdfOrientation(anim.slides)),'portrait');

  // 2) BEST 11 은 운동장 전체에 고르게(골키퍼 ~ 공격 줄이 80m 이상 펼쳐짐)
  const best=await bf.evaluate(()=>{const ps=anim.slides[0].snap.players.filter(p=>p.team==='blue');const xs=ps.map(p=>p.x);return {n:ps.length,span:(Math.max(...xs)-Math.min(...xs))/MPP,red:anim.slides[0].snap.players.filter(p=>p.team==='red').length};});
  assert.equal(best.n,11);assert.equal(best.red,0);assert.ok(best.span>=79,'BEST 11 span '+best.span+'m');

  // 3) 1페이지 7번에 이름 → 다른 페이지 7번(파랑) 전부 · 빨강 7번은 그대로
  await bf.evaluate(()=>{const p=state.players.find(q=>q.team==='blue'&&String(q.num)==='7');p.name='김민수';syncNameToScenes(p);renderTokens();});
  const nm=await bf.evaluate(()=>anim.slides.map(sl=>{const b=sl.snap.players.find(q=>q.team==='blue'&&String(q.num)==='7'),r=sl.snap.players.find(q=>q.team==='red'&&String(q.num)==='7');return (b&&b.name||'-')+'/'+(r?(r.name||'-'):'x');}));
  assert.deepEqual(nm.slice(1),Array(8).fill('김민수/-'),JSON.stringify(nm));
  // 이름 지우기도 함께
  await bf.evaluate(()=>{const p=state.players.find(q=>q.team==='blue'&&String(q.num)==='7');p.name=null;syncNameToScenes(p);});
  assert.ok(await bf.evaluate(()=>anim.slides.every(sl=>!(sl.snap.players.find(q=>q.team==='blue'&&String(q.num)==='7')||{}).name)));

  // 4) 슬라이드 MP4 — 내보내기 메뉴에 있고, 페이지에 넣은 장면 애니메이션까지 재생된다
  assert.ok(await bf.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/내보내기/.test(x.textContent)&&x.offsetParent);if(!b)return false;b.click();return [...document.querySelectorAll('button,div')].some(x=>x.textContent==='MP4 영상으로 내보내기');}),'MP4 메뉴');
  await bf.evaluate(()=>{try{document.body.click();}catch(_){}});
  if(engine==='chromium'){
    // 2장(하이블록)에 장면 2개 — 11번이 오른쪽으로 120 움직인다
    const mv=await bf.evaluate(()=>{const sl=anim.slides[1],a=JSON.parse(JSON.stringify(sl.snap)),b=JSON.parse(JSON.stringify(sl.snap));const q=b.players.find(p=>p.team==='blue'&&String(p.num)==='11');const x0=q.x;q.x=x0+120;sl.frames=[{snap:a,dur:1},{snap:b,dur:1}];return {id:q.id,x0:x0};});
    await bf.evaluate(mv=>{window.__seen=[];const orig=window.renderInterp;window.renderInterp=function(a,b,u,c){try{const pa=(a.players||[]).find(p=>p.id===mv.id),pb=(b.players||[]).find(p=>p.id===mv.id);if(pa&&pb&&pa.x===mv.x0&&pb.x===mv.x0+120&&u>0&&u<1)window.__seen.push(u);}catch(_){}return orig.apply(this,arguments);};
      window.__closed=0;window.showSaveFilePicker=async o=>{window.__pick=o;return {name:'상대전 미팅.mp4',createWritable:async()=>({write:async b=>{window.__wrote=b.size;},close:async()=>{window.__closed=1;}})};};},mv);
    await bf.evaluate(()=>exportVideoSheet('meeting'));
    await bf.waitForSelector('#evSheet #evGo');
    const sheet=await bf.evaluate(()=>document.getElementById('evSheet').textContent);
    assert.match(sheet,/슬라이드 영상 내보내기/);assert.match(sheet,/한 장/);
    await bf.evaluate(()=>{const pick=t=>[...document.querySelectorAll('#evSheet .ev-b')].find(b=>b.textContent===t).click();pick('720p');pick('15fps');pick('2초');document.querySelector('#evSheet #evGo').click();});
    await bf.waitForFunction(()=>window.__closed===1,null,{timeout:120000});
    const r=await bf.evaluate(()=>({n:window.__pick.suggestedName,wrote:window.__wrote,seen:window.__seen.length,frames:anim.frames.length,meet:document.body.classList.contains('meet-mode'),slides:anim.slides.length}));
    assert.match(r.n,/^미팅_슬라이드\.(mp4|webm)$/);assert.ok(r.wrote>1000,JSON.stringify(r));
    assert.ok(r.seen>3,'2장의 장면 애니메이션이 영상에 들어갔다 '+JSON.stringify(r));
    assert.equal(r.slides,9);assert.ok(r.meet);
    await page.waitForTimeout(1200);   /* 끝난 뒤 미팅 저장 타이머가 돌아도 */
    const sl=await bf.evaluate(()=>anim.slides.map(x=>Array.isArray(x.frames)?x.frames.length:0));
    assert.deepEqual(sl,[0,2,0,0,0,0,0,0,0],'영상용 장면 목록이 슬라이드에 적히지 않는다 '+JSON.stringify(sl));
  }
  await page.screenshot({path:path.join(SHOTS,'meeting-names-video-'+size+'.png')});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('meeting-names-video ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
