import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.989 — 사용자 «훈련 편집기에서 론도 그리드도 · 운동장 말고 라인 없이 보드에 · 보드 안에서 수정 · 사각형뿐 아니라 다양하게(팔각형도)».
// 편집기 패널의 «바탕»(운동장 | 그리드) → 라인 없는 빈 판 + 10×10 그리드. 그리드는 보드 위의 그림이라 끌어 옮기고 모서리로 크기를 바꾼다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
let cur='boot';
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof openEditor==='function'&&typeof window.__setBoardSurface==='function'&&typeof gridShapePath==='function');
  await page.waitForTimeout(800);
  const shot=n=>page.screenshot({path:path.join(SHOTS,`rondo-grid-${engine}-${size}-${n}.png`)});
  const st=()=>f.evaluate(()=>{ const h=document.getElementById('epSurface'),t=window.__gridOps.target(),b=t?{x:Math.min(t.pts[0].x,t.pts[1].x),y:Math.min(t.pts[0].y,t.pts[1].y),w:Math.abs(t.pts[1].x-t.pts[0].x),h:Math.abs(t.pts[1].y-t.pts[0].y)}:null;
    return {spec:state.pitchSpec,mpp:mppNow(),lines:!!document.querySelector('#lineLayer'),n:window.__gridOps.list().length,box:b,shape:t?(t.shape||'rect'):null,split:t?(t.split||'1'):null,
      sel:!!(sel&&sel.ref&&sel.ref.grid),tok:state.tokenScale,host:!!h&&getComputedStyle(h).display!=='none',
      on:h?[...h.querySelectorAll('button.on')].map(x=>x.textContent):[],vals:h?[...h.querySelectorAll('.sf-v')].map(x=>x.textContent):[],cnt:h&&h.querySelector('.sf-cnt')?h.querySelector('.sf-cnt').textContent:'',
      over:h?h.scrollWidth-h.clientWidth:0,cell:window.__trainGridSpec?window.__trainGridSpec.sx:null,pitch:document.documentElement.dataset.pitch}; });
  const tap=sel=>f.evaluate(s=>{ const b=document.querySelector(s); if(!b)throw Error('no button: '+s); b.click(); },sel);

  // ── 1. 새 훈련: 바탕 줄은 «운동장»으로 선다 ──
  cur='open editor';
  await f.evaluate(()=>{try{window.__psToggleBoardSettings('force-close');}catch(_){}try{setView('session');}catch(_){}openEditor(null,'train');});
  await f.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(600);
  let s=await st();
  assert.equal(s.host,true,'the 바탕 row stands in the training editor');assert.deepEqual(s.on,['운동장']);assert.equal(s.spec,'fifa');assert.equal(s.lines,true);assert.equal(s.mpp,10);
  const tok0=s.tok;
  // 운동장에 선수 둘을 먼저 놓는다 — 바탕을 바꿔도 제자리여야 한다
  await f.evaluate(()=>{ state.players=[{id:901,team:'blue',num:7,x:400,y:300},{id:902,team:'red',num:4,x:700,y:420}]; renderTokens(); });
  await shot(1);

  // ── 2. 그리드: 라인이 사라지고 10×10 그리드가 판 가운데에 선다 ──
  cur='to grid';
  await tap('#epSurface [data-sf="grid"]');await page.waitForTimeout(500);
  s=await st();
  assert.equal(s.spec,'grid30');assert.equal(s.lines,false,'no pitch lines on the grid board');assert.equal(s.mpp,35,'30 m across the pitch length');
  assert.equal(s.n,1,'one grid to start with');assert.deepEqual(s.box,{x:380,y:205,w:350,h:350},'10 × 10 m in the middle, on the 1 m lattice');assert.equal(s.sel,true,'and it is selected');
  assert.deepEqual(s.vals,['10','10']);assert.equal(s.cnt,'그리드 1 / 1');assert.ok(s.on.includes('그리드')&&s.on.includes('사각형')&&s.on.includes('30m'));
  assert.equal(s.cell,35,'the squared paper is 1 m');assert.ok(s.tok>tok0,'tokens grow for the grid board');assert.equal(s.over,0,'the panel block fits its column');
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>[p.x,p.y])),[[400,300],[700,420]],'the players stay where they were');
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#drawLayer .grid-cap').length),0,'the selected grid shows the dark size pill instead of the caption');
  await shot(2);

  // ── 3. 모양: 팔각형 → 칸 나누기는 사각형에만 ──
  cur='shapes';
  await tap('#epSurface [data-gshape="octa"]');await page.waitForTimeout(200);
  s=await st();assert.equal(s.shape,'octa');assert.ok(s.on.includes('팔각형'));
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#epSurface [data-gsplit]').length),0,'no split row for an octagon');
  const oct=await f.evaluate(()=>{ const p=document.querySelector('#drawLayer path.grid-shape'); return {d:p.getAttribute('d'),n:(p.getAttribute('d').match(/L/g)||[]).length+1,bb:(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)])(p.getBBox())}; });
  assert.equal(oct.n,8,'eight corners');assert.deepEqual(oct.bb,[380,205,350,350],'the octagon fills the same box');
  await shot(3);
  for(const k of ['circle','tri','diamond','penta','hexa']){ await tap(`#epSurface [data-gshape="${k}"]`);await page.waitForTimeout(80);
    const bb=await f.evaluate(()=>{ const b=document.querySelector('#drawLayer path.grid-shape').getBBox(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]; });
    assert.deepEqual(bb,[380,205,350,350],k+' fills the box'); }
  await tap('#epSurface [data-gshape="rect"]');await page.waitForTimeout(150);
  await tap('#epSurface [data-gsplit="2x2"]');await page.waitForTimeout(150);
  s=await st();assert.equal(s.shape,'rect');assert.equal(s.split,'2x2');
  assert.equal(await f.evaluate(()=>document.querySelector('#drawLayer path.grid-split').getAttribute('d')),'M 555 205 V 555 M 380 380 H 730','a cross through the middle');

  // ── 4. 크기: 패널의 ± 는 1m, 가운데는 그대로 ──
  cur='steppers';
  await tap('#epSurface [data-gstep="w+"]');await tap('#epSurface [data-gstep="w+"]');await tap('#epSurface [data-gstep="h-"]');await page.waitForTimeout(200);
  s=await st();assert.deepEqual(s.vals,['12','9']);assert.deepEqual(s.box,{x:345,y:222.5,w:420,h:315},'12 × 9 m about the same centre');

  // ── 5. 보드에서: 모서리 손잡이로 크기(1m 단위), 테두리를 끌어 옮기기 ──
  cur='drag on the board';
  const fb=await (await page.$('#fBoard')).boundingBox();
  const scr=async(x,y)=>{ const p=await f.evaluate(([x,y])=>{ const m=document.getElementById('world').getScreenCTM(),q=document.getElementById('board').createSVGPoint(); q.x=x;q.y=y; const o=q.matrixTransform(m); return {x:o.x,y:o.y}; },[x,y]); return {x:fb.x+p.x,y:fb.y+p.y}; };
  let a=await scr(765,537.5),b=await scr(765+78,537.5+40);   // 오른쪽 아래 모서리를 +2.2m · +1.1m 만큼
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();await page.waitForTimeout(300);
  s=await st();assert.deepEqual(s.box,{x:345,y:222.5,w:490,h:350},'the corner snaps to whole metres: 14 × 10 m');assert.deepEqual(s.vals,['14','10'],'the panel follows the handle');
  a=await scr(345,400);b=await scr(345-70,400-70);   // 왼쪽 변을 잡고 왼쪽 위로(가운데 자석 13 단위 밖으로)
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();await page.waitForTimeout(300);
  s=await st();assert.ok(Math.abs(s.box.x-275)<=3&&Math.abs(s.box.y-152.5)<=3,'the grid moves with the pointer: '+JSON.stringify(s.box));assert.equal(s.box.w,490);assert.equal(s.box.h,350);
  await shot(4);

  // ── 6. 판 넓이 45m: 내용이 판 가운데 기준으로 함께 줄어든다(그리드는 14 × 10 m 그대로) ──
  cur='area';
  const before=await f.evaluate(()=>({g:window.__gridOps.target().pts.map(p=>[p.x,p.y]),p:state.players.map(p=>[p.x,p.y])}));
  await tap('#epSurface [data-garea="45"]');await page.waitForTimeout(400);
  s=await st();assert.equal(s.spec,'grid45');assert.ok(Math.abs(s.mpp-1050/45)<1e-9);assert.deepEqual(s.vals,['14','10'],'still 14 × 10 m');assert.ok(s.on.includes('45m'));
  const after=await f.evaluate(()=>({g:window.__gridOps.target().pts.map(p=>[p.x,p.y]),p:state.players.map(p=>[p.x,p.y])}));
  const sc=([x,y])=>[Math.round((555+(x-555)*2/3)*10)/10,Math.round((370+(y-370)*2/3)*10)/10];
  assert.deepEqual(after.g,before.g.map(sc),'the grid shrinks about the centre of the board');assert.deepEqual(after.p,before.p.map(sc),'and the players with it');
  assert.ok(Math.abs(s.cell-1050/45)<1e-9,'the squared paper follows');

  // ── 7. 그리드 추가: 같은 모양·크기로 옆에, 삭제 ──
  cur='add / remove';
  await tap('#epSurface [data-gadd]');await page.waitForTimeout(400);
  s=await st();assert.equal(s.n,2);assert.equal(s.cnt,'그리드 2 / 2');assert.deepEqual(s.vals,['14','10'],'the new grid copies the size');
  const two=await f.evaluate(()=>window.__gridOps.list().map(g=>({x0:Math.min(g.pts[0].x,g.pts[1].x),x1:Math.max(g.pts[0].x,g.pts[1].x)})));
  assert.ok(two[1].x0>=two[0].x1||two[1].x1<=two[0].x0,'side by side, not on top: '+JSON.stringify(two));
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#drawLayer .grid-cap').length),1,'the grid that is not selected carries its size');
  await shot(5);
  await tap('#epSurface [data-gdel]');await page.waitForTimeout(300);
  s=await st();assert.equal(s.n,1);assert.equal(s.cnt,'그리드 1 / 1');

  // ── 8. ⌘Z: 삭제 → 추가 → 판 넓이까지 한 걸음씩 ──
  cur='undo';
  await f.evaluate(()=>{ undoLast(); });await page.waitForTimeout(250);s=await st();assert.equal(s.n,2,'the removed grid comes back');
  await f.evaluate(()=>{ undoLast(); });await page.waitForTimeout(250);s=await st();assert.equal(s.n,1);assert.equal(s.spec,'grid45');
  await f.evaluate(()=>{ undoLast(); });await page.waitForTimeout(300);s=await st();assert.equal(s.spec,'grid30','the area change is one step');assert.ok(s.on.includes('30m'));
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>[p.x,p.y])),before.p,'the players are back where they were at 30 m');

  // ── 9. 운동장으로: 라인이 돌아오고 선수·그리드는 제자리, 토큰 크기도 원래대로 ──
  cur='back to pitch';
  await tap('#epSurface [data-sf="pitch"]');await page.waitForTimeout(400);
  s=await st();assert.equal(s.spec,'fifa');assert.equal(s.lines,true);assert.equal(s.mpp,10);assert.equal(s.n,1,'the grid stays as a drawing');assert.deepEqual(s.on,['운동장']);
  assert.equal(s.tok,tok0,'tokens return to the size they had on the pitch');
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>[p.x,p.y])),before.p);
  // 다시 그리드로 가도 그리드를 하나 더 세우지 않는다
  await tap('#epSurface [data-sf="grid"]');await page.waitForTimeout(400);s=await st();assert.equal(s.n,1,'no second grid when one is already there');

  // ── 10. 썸네일·저장 모양 ──
  cur='thumb';
  const out=await f.evaluate(()=>{ const sn=captureSnap(),g=sn.drawings.find(d=>d.grid),th=boardThumbSVG(); return {spec:sn.pitchSpec,type:g.type,grid:g.grid,keys:Object.keys(g).sort(),thumbHasGrid:/grid-cap|rect/.test(th),thumbLines:/id="lineLayer"/.test(th)}; });
  assert.equal(out.spec,'grid30');assert.equal(out.type,'rectline','an older build reads it as a plain outline zone');assert.equal(out.grid,1);assert.equal(out.thumbLines,false,'the thumbnail has no pitch lines either');

  // ── 11. 나가면 작업 보드는 그대로 ──
  cur='close';
  await f.evaluate(()=>{try{closeEditor(false);}catch(_){}});await page.waitForTimeout(600);
  const wb=await f.evaluate(()=>({spec:state.pitchSpec,lines:!!document.querySelector('#lineLayer'),grids:state.drawings.filter(d=>d.grid).length,host:(h=>!!h&&getComputedStyle(h).display!=='none'&&!!h.offsetParent)(document.getElementById('epSurface'))}));
  assert.deepEqual(wb,{spec:'fifa',lines:true,grids:0,host:false},'the work board is untouched');

  // ── 12. 보드 설정 › 규격의 «그리드»: 작업 보드에서도 빈 판 ──
  cur='spec seg';
  await f.evaluate(()=>{ window.__setPitchSpec('grid30'); });await page.waitForTimeout(300);
  const seg=await f.evaluate(()=>({on:[...document.querySelectorAll('#pitchSpecSeg button.on')].map(b=>b.textContent),lines:!!document.querySelector('#lineLayer'),n:state.drawings.filter(d=>d.grid).length}));
  assert.deepEqual(seg,{on:['그리드'],lines:false,n:0},'the spec segment shows 그리드 and adds nothing by itself');
  await f.evaluate(()=>{ window.__setPitchN(2); });await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>state.pitchSpec),'fifa','several pitches means the pitch again');
  await f.evaluate(()=>{ window.__setPitchN(1); });await page.waitForTimeout(200);

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true}));
}catch(e){console.error('step:',cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
