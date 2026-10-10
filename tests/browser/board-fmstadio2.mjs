import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.980 — FMStadio 새 기능 대조: 잔상이 영상(GIF 엔진)·모든 장면에, 공이 섞인 다중 선택, 열린 화살·양쪽,
// 다각형 도구(실제 포인터 경로), «맨 앞»이 모든 장면에. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderDrawings==='function'&&typeof zOrderItems==='function'&&typeof polyTap==='function');
  await page.waitForTimeout(1500);

  // 장면 셋: 선수 둘·장비 하나·공. 잔상·시선은 «마지막 장면»에서 켠다 — 앞 장면에도 실려야 한다.
  await f.evaluate(()=>{ try{ if(window.__animReset)window.__animReset(); }catch(_){}
    state.drawings=[];state.equipment=[{id:9101,team:'cone',x:520,y:380}];sel=null;multiSel=[];
    state.players=[{id:9001,team:'blue',num:7,x:300,y:300},{id:9002,team:'red',num:4,x:400,y:500},{id:9003,team:'blue',num:9,x:600,y:400}];
    state.ball={x:330,y:320};renderTokens();renderDrawings();document.getElementById('animAdd').click(); });
  await page.waitForTimeout(300);
  await f.evaluate(()=>{ state.players[0].x+=200;state.players[1].x+=200;state.ball.x+=250;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click(); });
  await page.waitForTimeout(300);
  await f.evaluate(()=>{ state.players[0].x+=100;state.ball.y+=200;renderTokens();autoSaveAnimFrame(); });
  await page.waitForTimeout(200);

  const marks=await f.evaluate(()=>{
    const fr=()=>anim.frames.map(x=>[x.snap.players[0].trail||0,x.snap.players[1].trail||0,x.snap.players[2].trail||0,(x.snap.ball&&x.snap.ball.trail)||0].join('')+'/'+(x.snap.players[0].lookAt||'-')+(x.snap.players[0].vis?'v':''));
    const r={frames:anim.frames.length,active:animActive,before:fr()};
    sel=null;multiSel=[state.players[0],state.players[1],state.ball];selPanelOpen=true;updateDelUI();
    r.btns=[document.getElementById('trailBtn').style.display,document.getElementById('lookBtn').style.display,document.getElementById('frontSelBtn').style.display];
    document.getElementById('trailBtn').click();document.getElementById('trailBtn').click();
    r.trail=fr();r.label=document.getElementById('trailBtn').textContent;
    document.getElementById('lookBtn').click();
    r.look=fr();r.pending=!!_lookPick;r.dir=state.players[0].dir;
    undoLast();r.undo=fr();r.liveLook=state.players[0].lookAt||'-';
    sel=null;multiSel=[state.players[0],state.players[1],state.ball];updateDelUI();document.getElementById('lookBtn').click();
    sel=null;multiSel=[];updateDelUI();
    return r;});
  assert.equal(marks.frames,3);assert.equal(marks.active,2,'marks are switched on in the last scene');
  assert.deepEqual(marks.btns,['inline-flex','inline-flex','inline-flex'],'trail·look·front are offered for a mixed selection');
  assert.deepEqual(marks.before,['0000/-','0000/-','0000/-']);
  assert.deepEqual(marks.trail,['2202/-','2202/-','2202/-'],'two picked players and the ball get the trail in every scene; the third player does not');
  assert.equal(marks.label,'잔상 2');
  assert.deepEqual(marks.look,['2202/ballv','2202/ballv','2202/ballv'],'look-at goes straight to the ball, in every scene');
  assert.equal(marks.pending,false,'no second tap is asked for');
  assert.deepEqual(marks.undo,['2202/-','2202/-','2202/-'],'undo takes the look-at back out of every scene');assert.equal(marks.liveLook,'-');

  // 내보내기 프레임에 잔상이 실린다(GIF 엔진은 두 브라우저에 다 있다) · 끝나면 지워진다
  const exp=await f.evaluate(async()=>{
    const bix=window.boardImageXML;let total=0,withTrail=0,max=0,missing=0;const segs={};
    window.boardImageXML=function(){const o=bix.apply(this,arguments);try{total++;const tl=new DOMParser().parseFromString(o.xml,"image/svg+xml").getElementById("trailLayer");const n=tl?tl.querySelectorAll("path").length:-1;if(n<0)missing++;if(n){withTrail++;segs[window.__animSeg]=1;}if(n>max)max=n;}catch(_){}return o;};
    let bytes=0,err='';
    try{const r=await _animExportGuard(()=>_gifEncode(anim.frames,{fps:8,width:240,hold:.2}));bytes=r&&r.bytes?r.bytes.length:0;}catch(e){err=String(e&&e.message||e);}
    window.boardImageXML=bix;
    return {bytes,err,total,withTrail,max,missing,segs:Object.keys(segs).sort().join(','),after:window.__trailLayer.childNodes.length,flag:window.__animExport,board:state.players.map(p=>Math.round(p.x)).join(',')};});
  assert.equal(exp.err,'');assert.ok(exp.bytes>1000,'a GIF was made');
  assert.equal(exp.missing,0,'the trail layer is part of every exported picture');assert.ok(exp.withTrail<exp.total,'the first still frames have no trail yet');
  assert.ok(exp.withTrail>=6,'exported frames carry the trail: '+JSON.stringify(exp));
  assert.equal(exp.max,6,'three marked tokens × (glow + line)');
  assert.equal(exp.segs,'0,1','both moves leave a trail — not only the scene where it was switched on');
  assert.equal(exp.after,0,'the trail layer is cleared after the export');assert.equal(exp.flag,0);
  assert.equal(exp.board,'600,600,600','the board is put back as it was');

  // 맨 앞으로: 버튼 → 모든 장면 같은 순서 · ⌘Z · ⌘[ · «겹친 항목» 창의 맨 앞
  const z=await f.evaluate(()=>{
    const key=sn=>{const all=[];(sn.players||[]).forEach(o=>all.push(o));(sn.equipment||[]).forEach(o=>all.push(o));if(sn.ball)all.push(Object.assign({id:'ball'},sn.ball));
      return all.map((o,i)=>({o,i,z:Number.isFinite(+o.z)?+o.z:1e9})).sort((a,b)=>(a.z-b.z)||(a.i-b.i)).map(q=>q.o.id).join('>');};
    const ord=()=>anim.frames.map(x=>key(x.snap)).concat([key(state),[...tokenLayer.querySelectorAll('[data-id]')].map(g=>g.getAttribute('data-id')).join('>')]);
    const r={o0:ord()};
    selectItem('player',state.players[0]);selPanelOpen=true;updateDelUI();
    document.getElementById('frontSelBtn').click();r.front=ord();r.hint=document.getElementById('hint').textContent;
    undoLast();r.undo=ord();
    sel=null;multiSel=[state.players[2],state.equipment[0]];updateDelUI();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'[',metaKey:true,bubbles:true,cancelable:true}));r.back=ord();
    moveTokenLayer(state.players[1],'front');r.picker=ord();
    sel=null;multiSel=[];updateDelUI();
    return r;});
  const same=(arr,want,msg)=>assert.deepEqual(arr,Array(arr.length).fill(want),msg);
  same(z.o0,'9001>9002>9003>9101>ball','start: every scene, the board and the DOM agree');
  same(z.front,'9002>9003>9101>ball>9001','the panel button lifts the player above everything — in all scenes');
  assert.equal(z.hint,'맨 앞으로');
  same(z.undo,'9001>9002>9003>9101>ball','undo puts every scene back');
  same(z.back,'9003>9101>9001>9002>ball','⌘[ sends a mixed selection to the back, keeping their order');
  same(z.picker,'9003>9101>9001>ball>9002','the overlap picker uses the same function');

  // 끝 모양: 열린 화살 + 양쪽 · 막기 + 양쪽
  const head=await f.evaluate(()=>{
    const d={type:'pass',color:'#ffffff',lw:1,op:1,pts:[{x:250,y:560},{x:560,y:600}]};
    state.drawings.push(d);selectItem('drawing',d);
    document.getElementById('lineStyleBtn').click();
    const r={btns:[...document.querySelectorAll('#lsHead button')].map(b=>b.dataset.v)};
    document.querySelector('#lsHead [data-v="open"]').click();document.querySelector('#lsHead2 [data-v="both"]').click();
    r.head=d.head;r.head2=d.head2;r.open=document.querySelectorAll('#drawLayer .head-open').length;
    r.on=[...document.querySelectorAll('#lsHead button.on,#lsHead2 button.on')].map(b=>b.dataset.v);
    r.overflow=[...document.querySelectorAll('#lsPop .ls-seg')].filter(s=>s.scrollWidth>s.clientWidth+1).map(s=>s.id);
    document.querySelector('#lsHead2 [data-v="one"]').click();r.one=d.head2===undefined&&document.querySelectorAll('#drawLayer .head-open').length===1;
    document.querySelector('#lsHead2 [data-v="both"]').click();
    document.getElementById('lineStyleBtn').click();
    state.drawings=state.drawings.filter(x=>x!==d);sel=null;renderDrawings();
    return r;});
  assert.deepEqual(head.btns,['arrow','open','bar','dot','none']);
  assert.equal(head.head,'open');assert.equal(head.head2,true);assert.equal(head.open,2,'a V at both ends');
  assert.deepEqual(head.on,['open','both']);assert.deepEqual(head.overflow,[],'the rows fit the popover');assert.ok(head.one,'«한쪽» takes the start head away again');

  // 다각형: 도구를 고르고 운동장을 실제로 누른다(맨 위 요소가 그리기 층이어야 한다) → 처음 점을 다시 눌러 닫는다
  await f.evaluate(()=>{ state.players=[];state.equipment=[];state.ball=null;state.drawings=[];sel=null;multiSel=[];renderTokens();renderDrawings();
    try{ if(window.__animReset)window.__animReset(); }catch(_){}
    document.querySelector('#toolSeg [data-tool="poly"]').click(); });
  await page.waitForTimeout(500);
  const tapAt=async(fx2,fy2)=>{ const r=await f.evaluate(([a,b])=>{ const sv=document.getElementById('board').getBoundingClientRect(),x=sv.left+sv.width*a,y=sv.top+sv.height*b,t=document.elementFromPoint(x,y);
      t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,pointerType:'touch',pointerId:7}));
      t.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y,button:0,pointerType:'touch',pointerId:7}));
      return t.id||t.tagName; },[fx2,fy2]); await page.waitForTimeout(120); return r; };
  const tops=[await tapAt(.35,.4),await tapAt(.6,.4),await tapAt(.62,.6),await tapAt(.38,.62)];
  const mid=await f.evaluate(()=>({tool:state.tool,drawmode:document.body.classList.contains('drawmode'),building:_poly?_poly.pts.length:-1,ring:!!document.querySelector('#drawLayer .poly-close'),n:state.drawings.length}));
  await tapAt(.35,.4);
  const poly=await f.evaluate(()=>{ const d=state.drawings[0]||{};
    const r={n:state.drawings.length,type:d.type,closed:d.closed,pts:(d.pts||[]).length,tool:state.tool,selected:!!(sel&&sel.ref===d),handles:document.querySelectorAll('#drawLayer .poly-vx').length,fill:document.querySelectorAll('#drawLayer .poly-fill').length};
    /* 꼭짓점을 끌어 모양을 고친다 */
    const h=document.querySelector('#drawLayer .poly-vx'),hr=h.getBoundingClientRect(),x=hr.left+hr.width/2,y=hr.top+hr.height/2,b4=JSON.stringify(d.pts[0]);
    h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,pointerId:8}));
    window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x-30,clientY:y-24,pointerId:8}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x-30,clientY:y-24,pointerId:8}));
    r.dragged=b4!==JSON.stringify(d.pts[0])&&d.pts.length===4;
    /* 이름 · 빗금 */
    document.getElementById('lineStyleBtn').click();
    const zi=document.getElementById('lsZoneName');r.nameRow=!!zi;if(zi){zi.value='하프스페이스';zi.dispatchEvent(new Event('input'));}
    r.headRow=!!document.getElementById('lsHead');
    document.querySelector('#lsFill [data-v="hatch"]').click();document.getElementById('lineStyleBtn').click();
    r.label=d.label;r.labels=[...document.querySelectorAll('.zone-label text')].map(t=>t.textContent);r.fillStyle=d.fillStyle;
    /* 썸네일·내보내기 그림에도 그려진다 */
    r.thumb=/poly-fill/.test(String(boardThumbSVG()||''));
    return r;});
  assert.deepEqual(tops,['drawCatch','drawCatch','drawCatch','drawCatch'],'taps land on the drawing layer');
  assert.deepEqual(mid,{tool:'poly',drawmode:true,building:4,ring:true,n:0},'four corners placed, the first one is marked for closing');
  assert.equal(poly.n,1);assert.equal(poly.type,'poly');assert.equal(poly.closed,true);assert.equal(poly.pts,4);
  assert.equal(poly.tool,'move');assert.ok(poly.selected,'the finished polygon is selected');assert.equal(poly.handles,4);assert.equal(poly.fill,1);
  assert.ok(poly.dragged,'a corner can be dragged');
  assert.ok(poly.nameRow,'a closed polygon can be named like a zone');assert.equal(poly.headRow,false,'arrow ends do not apply to a polygon');
  assert.equal(poly.label,'하프스페이스');assert.deepEqual(poly.labels,['하프스페이스']);assert.equal(poly.fillStyle,'hatch');
  assert.ok(poly.thumb,'the polygon is part of thumbnails');

  // Esc 는 그리던 것만 버리고 도구는 그대로 · 도구를 바꾸면 그리던 것을 다각형으로 마무리한다
  await f.evaluate(()=>{ sel=null;renderDrawings();document.querySelector('#toolSeg [data-tool="poly"]').click(); });
  await page.waitForTimeout(500);
  await tapAt(.2,.3);await tapAt(.28,.3);
  const esc=await f.evaluate(()=>{ window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    return {tool:state.tool,building:!!_poly,n:state.drawings.length,tmp:!!document.querySelector('#drawLayer .poly-close')}; });
  assert.deepEqual(esc,{tool:'poly',building:false,n:1,tmp:false},'Esc drops the unfinished shape and keeps the tool');
  await tapAt(.2,.3);await tapAt(.28,.3);await tapAt(.24,.42);
  const sw=await f.evaluate(()=>{ document.querySelector('#toolSeg [data-tool="pass"]').click(); const d=state.drawings[state.drawings.length-1];
    const r={n:state.drawings.length,closed:d.closed,pts:d.pts.length,tool:state.tool,on:[...document.querySelectorAll('#toolSeg button.on')].map(b=>b.dataset.tool),building:!!_poly};
    document.querySelector('#toolSeg [data-tool="move"]').click(); return r; });
  assert.deepEqual(sw,{n:2,closed:true,pts:3,tool:'pass',on:['pass'],building:false},'switching tools finishes the polygon and lands on the new tool');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,passed:true,marks:{trail:marks.trail[0],look:marks.look[0]},exp:{total:exp.total,withTrail:exp.withTrail},z:z.front[0],head:head.on,poly:{pts:poly.pts,handles:poly.handles}}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
