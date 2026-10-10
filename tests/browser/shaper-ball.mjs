import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.986 — 사용자 «보드의 토큰 쉐이퍼 표시를 더 명확하게 · 쉐이퍼는 자동으로 모두 볼을 보게».
// 쉐이퍼는 볼 쪽을 본다(그릴 때 계산 — 저장값은 건드리지 않는다). 손으로 돌리면 그 방향으로 고정, «볼 보기»로 되돌린다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof _dirOf==='function'&&typeof toggleBallLook==='function');
  await page.waitForTimeout(800);
  const near=(a,b,tol=1.2)=>{ const d=Math.abs(((a-b)%360+540)%360-180); return d<=tol; };
  const degs=()=>f.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#visionLayer path.ps-shaper')].map(p=>[p.getAttribute('data-pid'),+p.getAttribute('data-deg')])));
  const toBall=(p,b)=>((Math.atan2(b.y-p.y,b.x-p.x)*180/Math.PI)%360+360)%360;
  const P=[{id:1,team:'blue',num:1,pos:'GK',x:90,y:370},{id:2,team:'blue',num:4,x:300,y:200},{id:3,team:'blue',num:5,x:300,y:540,name:'지호'},{id:4,team:'blue',num:8,x:520,y:420},
    {id:11,team:'red',num:3,x:820,y:200},{id:12,team:'red',num:6,x:820,y:540},{id:13,team:'red',num:10,x:640,y:480},{id:20,team:'blue',coach:true,x:60,y:60}];
  const set=(players,ball,equipment)=>f.evaluate(([pl,b,eq])=>{ try{ if(window.__animReset)window.__animReset(); }catch(_){} sel=null;multiSel=[];state.drawings=[];state.equipment=eq||[];state.players=JSON.parse(JSON.stringify(pl));state.ball=b;renderTokens();renderDrawings();updateDelUI(); },[players,ball,equipment||null]);

  // ── 1. 원형(기본)에서는 부리가 없다 → 쉐이퍼를 켜면 코치를 뺀 모두가 볼을 본다 ──
  await set(P,{x:560,y:300});
  await f.evaluate(()=>{ setTokShape('circle'); renderTokens(); });
  assert.deepEqual(await degs(),{},'no beak in the circle shape');
  await f.evaluate(()=>{ setTokShape('shaper'); renderTokens(); });
  let d=await degs(); const ball={x:560,y:300};
  assert.deepEqual(Object.keys(d).sort((a,b)=>a-b),['1','2','3','4','11','12','13'],'every player but the coach');
  for(const p of P.filter(p=>!p.coach))assert.ok(near(d[p.id],toBall(p,ball)),`player ${p.id} faces the ball: ${d[p.id]} vs ${toBall(p,ball)}`);
  // 그리기만 한다 — 저장값(dir)은 건드리지 않는다(열기만 해도 «변경 있음»이 뜨지 않게, 옛 판이 손으로 돌린 값으로 읽지 않게)
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>[typeof p.dir,p.dirFix||0,p.dirBall||0])),P.map(()=>['undefined',0,0]),'nothing is written into the tokens');
  // 부리는 토큰에 붙어 있고(밑변이 원 위), 원 밖으로 반지름만큼은 나온다 · 운동장과 반대되는 색
  const beak=await f.evaluate(()=>{ const p=state.players[1],s=_tokScaleOf(p),q=_shaperGeom(p.x,p.y,_dirOf(p),s),e=document.querySelector('#visionLayer path.ps-shaper[data-pid="2"]'),r=e.getBoundingClientRect();
    const dist=a=>Math.hypot(a[0]-p.x,a[1]-p.y); return {R:q.R,tip:dist(q.pts[0]),b1:dist(q.pts[1]),b2:dist(q.pts[2]),fill:e.getAttribute('fill'),px:Math.round(Math.max(r.width,r.height)),below:!!(e.closest('#visionLayer').compareDocumentPosition(document.getElementById('tokenLayer'))&4)}; });
  assert.ok(Math.abs(beak.b1-beak.R)<.01&&Math.abs(beak.b2-beak.R)<.01,'the base sits on the token circle'); assert.ok(beak.tip-beak.R>=Math.max(beak.R,10)-.01,'the tip clears the token by at least its radius: '+JSON.stringify(beak));
  assert.equal(beak.fill,'#ffffff','white on a dark pitch'); assert.ok(beak.px>=7,'readable at the default token size: '+beak.px+'px'); assert.equal(beak.below,true,'drawn under the tokens');
  await page.screenshot({path:path.join(SHOTS,`shaper-ball-${engine}-${size}-1.png`)});

  // ── 2. 볼을 끌면 따라 돈다(놓기 전에도) ──
  const bpos=await f.evaluate(()=>{ const g=document.querySelector('#tokenLayer [data-kind="ball"]'),r=g.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  const fb=await (await page.$('#fBoard')).boundingBox();
  await page.mouse.move(fb.x+bpos.x,fb.y+bpos.y); await page.mouse.down(); await page.mouse.move(fb.x+bpos.x+40,fb.y+bpos.y+90,{steps:6}); await page.mouse.move(fb.x+bpos.x+120,fb.y+bpos.y+170,{steps:8});
  await page.waitForTimeout(200);
  const mid=await f.evaluate(()=>({b:{x:state.ball.x,y:state.ball.y},d:Object.fromEntries([...document.querySelectorAll('#visionLayer path.ps-shaper')].map(p=>[p.getAttribute('data-pid'),+p.getAttribute('data-deg')])),ps:state.players.filter(p=>!p.coach).map(p=>({id:p.id,x:p.x,y:p.y}))}));
  assert.ok(Math.hypot(mid.b.x-560,mid.b.y-300)>60,'the ball moved: '+JSON.stringify(mid.b));
  for(const p of mid.ps)assert.ok(near(mid.d[p.id],toBall(p,mid.b),2),`while dragging, player ${p.id} follows: ${mid.d[p.id]} vs ${toBall(p,mid.b)}`);
  await page.mouse.up(); await page.waitForTimeout(300);

  // ── 3. 손으로 돌리면 고정 — 볼이 움직여도 그대로. «볼 보기»로 되돌린다 ──
  await set(P,{x:560,y:300});
  await f.evaluate(()=>{ selectItem('player',state.players[1]); selPanelOpen=true; updateDelUI(); });
  const btn0=await f.evaluate(()=>{ const b=document.getElementById('ballLookBtn'),r=document.getElementById('rotCtl'); return {show:getComputedStyle(b).display!=='none',on:b.classList.contains('on'),rot:r.style.display!=='none'}; });
  assert.deepEqual(btn0,{show:true,on:true,rot:true},'«볼 보기» is lit, the rotate buttons are there');
  await f.evaluate(()=>renderTokens()); await page.waitForTimeout(200);
  assert.equal(await f.evaluate(()=>!!document.querySelector('#rotHandle circle[r="7"]')),true,'the rotate handle is back (2.982 shadowed its target function)');
  await page.screenshot({path:path.join(SHOTS,`shaper-ball-${engine}-${size}-2.png`)});
  const before=(await degs())['2'];
  await f.evaluate(()=>rotateSel(45));
  let t=await f.evaluate(()=>({dir:state.players[1].dir,fix:state.players[1].dirFix,on:document.getElementById('ballLookBtn').classList.contains('on')}));
  assert.ok(near(t.dir,before+45,1),'↻ turns from where it was looking: '+t.dir+' vs '+(before+45)); assert.equal(t.fix,1); assert.equal(t.on,false,'the button goes dark');
  await f.evaluate(()=>{ state.ball.x=200;state.ball.y=600;renderTokens(); });
  d=await degs(); assert.ok(near(d['2'],t.dir,.6),'fixed: '+d['2']); assert.ok(near(d['4'],toBall(P[3],{x:200,y:600})),'the others still follow');
  // 핸들을 끌어도 고정된다
  await f.evaluate(()=>{ selectItem('player',state.players[3]); renderTokens(); });
  const knob=await f.evaluate(()=>{ const k=document.querySelector('#rotHandle circle[r="7"]'),r=k.getBoundingClientRect(),g=document.querySelector('#tokenLayer [data-id="4"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,cx:g.left+g.width/2,cy:g.top+g.height/2}; });
  await page.mouse.move(fb.x+knob.x,fb.y+knob.y); await page.mouse.down(); await page.mouse.move(fb.x+knob.cx,fb.y+knob.cy-70,{steps:6}); await page.mouse.up(); await page.waitForTimeout(250);
  t=await f.evaluate(()=>({dir:state.players[3].dir,fix:state.players[3].dirFix}));
  assert.equal(t.fix,1,'the handle fixes the direction'); assert.equal(typeof t.dir,'number');
  // «볼 보기» — 다시 볼을 본다
  await f.evaluate(()=>{ sel=null;multiSel=[state.players[1],state.players[3]];selPanelOpen=true;updateDelUI(); });
  assert.equal(await f.evaluate(()=>document.getElementById('ballLookBtn').classList.contains('on')),false);
  await f.evaluate(()=>document.getElementById('ballLookBtn').click());
  t=await f.evaluate(()=>({a:[state.players[1].dirFix||0,state.players[1].dirBall||0],b:[state.players[3].dirFix||0,state.players[3].dirBall||0],on:document.getElementById('ballLookBtn').classList.contains('on')}));
  assert.deepEqual(t,{a:[0,1],b:[0,1],on:true});
  d=await degs(); assert.ok(near(d['2'],toBall(P[1],{x:200,y:600}))&&near(d['4'],toBall(P[3],{x:200,y:600})),'both face the ball again');
  // 다시 누르면 지금 방향으로 고정
  await f.evaluate(()=>document.getElementById('ballLookBtn').click());
  t=await f.evaluate(()=>({fix:state.players[1].dirFix,dir:state.players[1].dir})); assert.equal(t.fix,1); assert.ok(near(t.dir,toBall(P[1],{x:200,y:600}),1));
  await f.evaluate(()=>{ undoLast(); undoLast(); });

  // ── 4. 옛 보드 · 시선 · 장비 공 ──
  await set([{id:1,team:'blue',num:4,x:300,y:300,dir:90},{id:2,team:'blue',num:5,x:300,y:500,dir:0},{id:3,team:'red',num:6,x:800,y:300,dir:180},{id:4,team:'red',num:7,x:800,y:500,lookAt:1,vis:true,dir:0},{id:5,team:'blue',num:9,x:500,y:600,dir:200,dirBall:1}],{x:560,y:400});
  d=await degs();
  assert.ok(near(d['1'],90,.1),'a direction turned by hand before 2.986 stays: '+d['1']);
  assert.ok(near(d['2'],toBall({x:300,y:500},{x:560,y:400})),'an untouched one (default 0) follows'); assert.ok(near(d['3'],toBall({x:800,y:300},{x:560,y:400})),'the right-side default (180) follows too');
  assert.ok(near(d['4'],toBall({x:800,y:500},{x:300,y:300}),1),'«시선» to another player wins: '+d['4']);
  assert.ok(near(d['5'],toBall({x:500,y:600},{x:560,y:400})),'«볼 보기» wins over a stored direction');
  // 판의 공이 없으면 가장 가까운 장비 공, 그것도 없으면 제 방향
  await set([{id:1,team:'blue',num:4,x:300,y:300},{id:2,team:'red',num:5,x:800,y:300}],null,[{id:901,team:'ball',x:300,y:600},{id:902,team:'ball',x:900,y:300},{id:903,team:'cone',x:500,y:300}]);
  d=await degs(); assert.ok(near(d['1'],90)&&near(d['2'],0),'nearest equipment ball: '+JSON.stringify(d));
  await set([{id:1,team:'blue',num:4,x:300,y:300},{id:2,team:'red',num:5,x:800,y:300}],null);
  d=await degs(); assert.ok(near(d['1'],0)&&near(d['2'],180),'no ball — the team default: '+JSON.stringify(d));

  // ── 5. 재생 — 장면 사이에서도 볼을 따라 돈다 · 장면 자료는 그대로 ──
  await set([{id:1,team:'blue',num:4,x:300,y:300},{id:2,team:'red',num:5,x:800,y:500}],{x:400,y:300});
  await f.evaluate(()=>document.getElementById('animAdd').click()); await page.waitForTimeout(300);
  await f.evaluate(()=>{ state.ball.x=400;state.ball.y=640;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click(); }); await page.waitForTimeout(300);
  const fr=await f.evaluate(()=>{ const n=anim.frames.length,a=anim.frames[0].snap,b=anim.frames[n-1].snap,out=[];   /* 첫 «장면 추가»는 장면 둘을 만든다 — 처음과 끝을 잇는다 */ const keep=captureSnap();
    [0,.5,1].forEach(u=>{ renderInterp(a,b,u,null); out.push({u,ball:{x:state.ball.x,y:state.ball.y},p:{x:state.players[0].x,y:state.players[0].y},deg:+document.querySelector('#visionLayer path.ps-shaper[data-pid="1"]').getAttribute('data-deg')}); });
    loadSnap(keep); renderTokens(); return {out,n,dirs:anim.frames.map(f=>f.snap.players.map(p=>typeof p.dir))}; });
  for(const o of fr.out)assert.ok(near(o.deg,toBall(o.p,o.ball),1.5),'u='+o.u+': '+o.deg+' vs '+toBall(o.p,o.ball));
  assert.ok(!near(fr.out[0].deg,fr.out[2].deg,20),'the direction really changed along the way');
  assert.ok(fr.dirs.flat().every(x=>x==='undefined'),'scene data carries no computed direction: '+JSON.stringify(fr.dirs));
  await f.evaluate(()=>{ try{ window.__animReset&&window.__animReset(); }catch(_){} });

  // ── 6. 180° 돌려도 볼을 본다 · 이름표는 부리 아래로 · 화이트 피치는 짙은 부리 ──
  await set([{id:1,team:'blue',num:4,x:300,y:300,dir:0,name:'지호'},{id:2,team:'red',num:5,x:800,y:500,dir:45}],{x:560,y:400});
  const mir=await f.evaluate(()=>{ _mir180Of(state); renderTokens(); return {p:state.players.map(p=>({x:p.x,y:p.y,dir:p.dir,ball:p.dirBall||0})),b:{x:state.ball.x,y:state.ball.y}}; });
  d=await degs(); assert.equal(mir.p[0].ball,1); assert.ok(near(d['1'],toBall(mir.p[0],mir.b)),'still on the ball after the half turn'); assert.ok(near(d['2'],225,.1),'a hand-turned one turns with the pitch');
  const lab=await f.evaluate(()=>{ const g=document.querySelector('#tokenLayer [data-id="1"]'),r=[...g.querySelectorAll('rect')].find(x=>x.getAttribute('rx')==='9'); return +r.getAttribute('y'); });
  assert.equal(lab,60-13.5,'the name sits below the beak');
  const dark=await f.evaluate(()=>{ const b=[...document.querySelectorAll('#pitchSeg button')].find(x=>x.dataset.p==='white'); window.__psUserClick=1; b.click(); window.__psUserClick=0; renderTokens(); const e=document.querySelector('#visionLayer path.ps-shaper'); const fill=e.getAttribute('fill');
    const n=[...document.querySelectorAll('#pitchSeg button')].find(x=>x.dataset.p==='navy'); n.click(); renderTokens(); return fill; });
  assert.equal(dark,'#1b2434','a dark beak on the white pitch');
  await f.evaluate(()=>{ setTokShape('circle'); state.players=[];state.equipment=[];renderTokens();updateDelUI(); });
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('shaper-ball ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
