import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.311 — 작전판 그리기 도구 제보 묶음(합성 팀 fixture 에서만 · 실계정 · 서버 없음).
//  ① dd59a8b4: 토큰에 묶였거나 토큰 안의 끝은 화살 머리를 토큰 가장자리에 — 자료 · 핸들은 그대로, 머리 없는 선 · 빈 곳의 끝은 그대로.
//  ② b2007df6: «선 스타일 › 끝»은 화살표 집안과 선 집안을 따로 기억한다 — 새로 그리는 선 · 화살표가 제 집안의 끝 모양.
//  ③ f2b9c41a: 오른쪽 클릭 › «점선 · 선 스타일…»로 연 창은 고른 그림에만, 도구 막대의 «선 스타일»은 예전처럼 기본값도.
//  ④ 43d6b2af: 채움 «없음» — 원형 구역 · 구역은 실선 테두리만, 닫힌 다각형은 채움 없음.
//  ⑤ 5588062b · a2f004f9 · e4b723a1: 단축키 여섯 — 설정 표에 있고, 키를 지정하면 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-reports-3311 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:false});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSShapeMenu&&window.PSBoardShortcuts&&window.__psShapeMenu&&document.getElementById('cmd-board-settings-pop'),null,{timeout:30000});
  await page.waitForTimeout(800);
  const reset=()=>f.evaluate(()=>{try{stopAnim();}catch(_){}try{document.getElementById('lsPop')&&document.getElementById('lineStyleBtn').click();}catch(_){}try{__psShapeMenu.close();}catch(_){}state.tool='move';state.players=[];state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];
    delete state.drawHead;delete state.drawHeadLine;delete state.drawHead2;delete state.drawLob;state.drawLineStyle='solid';state.drawFillStyle='solid';state.drawLw=1;state.drawOp=1;renderTokens();renderDrawings();renderAnimFrames();updateDelUI();});
  const focus=()=>f.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();});
  const press=async k=>{await focus();await page.keyboard.press(k);await page.waitForTimeout(160);};
  // 그림 요소 읽기 — 본선(path · 테두리 없음 · 표시 색) · 머리(채운 path) · 끝 핸들(r=10 원)
  const readLines=()=>f.evaluate(()=>{
    const L=document.getElementById('drawLayer'),num=s=>s.trim().split(/[\s,]+/).map(Number);
    const endOf=d=>{const n=num(d.replace(/[A-Za-z]/g,' '));return {x:n[n.length-2],y:n[n.length-1]};};
    const startOf=d=>{const n=num(d.replace(/[A-Za-z]/g,' '));return {x:n[0],y:n[1]};};
    return state.drawings.map(d=>{
      const g=[...L.children].find(g=>g.__psD===d)||L.children[state.drawings.indexOf(d)];
      const main=[...g.querySelectorAll('path')].find(p=>p.getAttribute('fill')==='none'&&!p.getAttribute('class')&&p.getAttribute('stroke')!=='#000'&&p.getAttribute('stroke')!=='#ffd60a');
      const head=[...g.querySelectorAll('path')].find(p=>p.getAttribute('fill')&&p.getAttribute('fill')!=='none'&&!p.getAttribute('class')&&p.getAttribute('opacity')!=='0');
      const handles=[...g.querySelectorAll('circle[r="10"]')].map(c=>({x:+c.getAttribute('cx'),y:+c.getAttribute('cy')}));
      return {end:main?endOf(main.getAttribute('d')):null,start:main?startOf(main.getAttribute('d')):null,tip:head?startOf(head.getAttribute('d')):null,handles,pts:d.pts.map(p=>({x:p.x,y:p.y}))};
    });
  });
  const close=(a,b,eps=0.05)=>Math.abs(a-b)<eps;

  // ① 화살 머리는 토큰 가장자리에
  step('head-trim');
  await reset();
  const R=await f.evaluate(()=>{
    state.players=[{id:1,team:'blue',num:'7',x:300,y:300},{id:2,team:'blue',num:'8',x:600,y:300},{id:3,team:'red',num:'4',x:600,y:600}];
    state.drawings=[
      {type:'pass',color:'#ffffff',pts:[{x:300,y:300},{x:600,y:300}],tk:[1,2]},            // 토큰에 묶인 패스
      {type:'run',color:'#ffffff',pts:[{x:300,y:450},{x:598,y:302}]},                       // 안 묶였지만 끝이 토큰 안
      {type:'pass',color:'#ffffff',pts:[{x:300,y:600},{x:450,y:600}]},                      // 빈 곳
      {type:'line',color:'#ffffff',pts:[{x:100,y:300},{x:600,y:300}],tk:[null,2]},          // 머리 없는 직선 — 그대로
      {type:'pass',color:'#ffffff',pts:[{x:600,y:600},{x:300,y:300}],tk:[3,1],head2:true},  // 양쪽 머리 — 시작도 물린다
      {type:'pass',color:'#ffffff',pts:[{x:300,y:300},{x:600,y:300},{x:450,y:150}],tk:[1,2]}];   // 곡선 — 제어점 쪽에서 들어온다
    renderTokens();renderDrawings();
    return {r2:21*_tokScaleOf(state.players[1])+3,r1:21*_tokScaleOf(state.players[0])+3,r3:21*_tokScaleOf(state.players[2])+3};
  });
  let L=await readLines();
  assert.ok(R.r2>5&&R.r2<40,'토큰 반지름 '+R.r2);
  assert.ok(close(L[0].end.x,600-R.r2)&&close(L[0].end.y,300),'묶인 패스의 본선은 토큰 가장자리에서 끝난다: '+JSON.stringify(L[0].end));
  assert.ok(close(L[0].tip.x,600-R.r2)&&close(L[0].tip.y,300),'머리 끝도 가장자리: '+JSON.stringify(L[0].tip));
  assert.deepEqual(L[0].pts,[{x:300,y:300},{x:600,y:300}],'자료(d.pts)는 그대로');
  assert.ok(close(Math.hypot(L[1].end.x-600,L[1].end.y-300),R.r2),'안 묶였어도 토큰 안의 끝은 가장자리: '+JSON.stringify(L[1].end));
  assert.ok(close(L[2].end.x,450)&&close(L[2].end.y,600),'빈 곳의 끝은 그대로');
  assert.ok(close(L[3].end.x,600)&&close(L[3].end.y,300)&&!L[3].tip,'머리 없는 직선은 토큰 가운데까지 그대로');
  assert.ok(close(Math.hypot(L[4].start.x-600,L[4].start.y-600),R.r3)&&close(Math.hypot(L[4].end.x-300,L[4].end.y-300),R.r1),'양쪽 머리는 시작 · 끝 다 물린다: '+JSON.stringify([L[4].start,L[4].end]));
  assert.ok(close(Math.hypot(L[5].end.x-600,L[5].end.y-300),R.r2)&&L[5].end.y<300,'곡선은 제어점 쪽(위)에서 들어온 자리: '+JSON.stringify(L[5].end));
  await f.evaluate(()=>{selectItem('drawing',state.drawings[0]);});
  L=await readLines();
  assert.deepEqual(L[0].handles,[{x:300,y:300},{x:600,y:300}],'끝점 핸들은 토큰 가운데(자료 그대로)');
  const xml=await f.evaluate(()=>{sel=null;multiSel=[];renderDrawings();return boardImageXML(__exportVB()).xml;});
  assert.ok(xml.includes('L '+(600-R.r2).toString().slice(0,8))||xml.includes((600-R.r2).toFixed(1).replace(/\.0$/,'')),'내보내는 그림도 같은 끝');

  // ② 끝 모양은 집안마다
  step('head-family');
  await reset();
  const fam=await f.evaluate(()=>{
    const out={};const open=()=>document.getElementById('lineStyleBtn').click();const on=()=>[...document.querySelectorAll('#lsHead button.on')].map(b=>b.dataset.v);
    state.tool='pass';open();out.passShown=on();document.querySelector('#lsHead [data-v="bar"]').click();out.afterBar=[state.drawHead,state.drawHeadLine];open();
    state.tool='line';open();out.lineShown=on();document.querySelector('#lsHead [data-v="dot"]').click();out.afterDot=[state.drawHead,state.drawHeadLine];open();
    state.tool='pass';open();out.passAgain=on();open();
    state.tool='line';beginDraw({x:100,y:100});moveDraw({x:400,y:120});endDraw();
    state.tool='dashline';beginDraw({x:100,y:160});moveDraw({x:400,y:180});endDraw();
    state.tool='pass';beginDraw({x:100,y:220});moveDraw({x:400,y:240});endDraw();
    state.tool='run';beginDraw({x:100,y:280});moveDraw({x:400,y:300});endDraw();
    out.heads=state.drawings.map(d=>[d.type,d.head]);state.tool='move';return out;});
  assert.deepEqual(fam.passShown,['arrow'],'화살표 집안의 기본은 화살');
  assert.deepEqual(fam.afterBar,['bar',undefined],'화살표에서 고른 끝은 선 집안에 안 간다');
  assert.deepEqual(fam.lineShown,['none'],'선 집안의 기본은 없음(b2007df6)');
  assert.deepEqual(fam.afterDot,['bar','dot']);
  assert.deepEqual(fam.passAgain,['bar']);
  assert.deepEqual(fam.heads,[['line','dot'],['dashline','dot'],['pass','bar'],['run','bar']],'새로 그린 것은 제 집안의 끝 모양');

  // ③ 오른쪽 클릭 길은 고른 그림에만
  step('menu-sel-only');
  await reset();
  const so=await f.evaluate(()=>{
    const d={type:'line',color:'#ffffff',pts:[{x:150,y:600},{x:450,y:600}]};state.drawings=[d];renderDrawings();
    const out={};
    __psShapeMenu.open(d,200,200);
    const more=document.querySelector('#psShapeMenu [data-act="more"]');out.hasMore=!!more;
    if(more)more.click(); else { window.__psLsSelOnly=1; try{ document.getElementById('lineStyleBtn').click(); } finally { window.__psLsSelOnly=0; } }
    out.popOpen=!!document.getElementById('lsPop');
    const w=document.getElementById('lsW');w.value='2';w.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#lsShape [data-v="dash"]').click();document.querySelector('#lsHead [data-v="dot"]').click();document.querySelector('#lsHead2 [data-v="both"]').click();document.querySelector('#lsFill [data-v="hatch"]').click();
    out.shape={lw:d.lw,dash:d.dash,head:d.head,head2:d.head2,fill:d.fillStyle};
    out.defaults={lw:state.drawLw,op:state.drawOp,ls:state.drawLineStyle,fs:state.drawFillStyle,head:state.drawHead,headLine:state.drawHeadLine,head2:state.drawHead2};
    document.getElementById('lineStyleBtn').click();   // 닫기
    // 도구 막대의 «선 스타일»은 예전처럼 — 고른 그림 + 기본값
    selectItem('drawing',d);document.getElementById('lineStyleBtn').click();
    const w2=document.getElementById('lsW');w2.value='2.5';w2.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#lsShape [data-v="dot"]').click();
    out.toolbar={lw:d.lw,dot:d.dot,defLw:state.drawLw,defLs:state.drawLineStyle};
    document.getElementById('lineStyleBtn').click();sel=null;multiSel=[];renderDrawings();return out;});
  assert.equal(so.popOpen,true,'메뉴 › «점선 · 선 스타일…»(없으면 같은 표식)로 창이 열린다 · hasMore='+so.hasMore);
  assert.deepEqual(so.shape,{lw:2,dash:true,head:'dot',head2:true,fill:'hatch'},'고른 그림은 바뀐다');
  assert.deepEqual(so.defaults,{lw:1,op:1,ls:'solid',fs:'solid',head:undefined,headLine:undefined,head2:undefined},'새로 그릴 기본값은 그대로(f2b9c41a)');
  assert.deepEqual(so.toolbar,{lw:2.5,dot:true,defLw:2.5,defLs:'dot'},'도구 막대 길은 예전처럼 기본값도');

  // ④ 채움 «없음»
  step('fill-none');
  await reset();
  const fn=await f.evaluate(()=>{
    const out={};document.getElementById('lineStyleBtn').click();
    out.btn=!!document.querySelector('#lsFill [data-v="none"]');document.querySelector('#lsFill [data-v="none"]').click();out.def=state.drawFillStyle;document.getElementById('lineStyleBtn').click();
    state.tool='ellipse';beginDraw({x:100,y:450});moveDraw({x:300,y:620});endDraw();
    state.tool='rect';beginDraw({x:400,y:450});moveDraw({x:600,y:620});endDraw();
    state.drawings.push({type:'poly',closed:true,fillStyle:'none',color:'#ffffff',pts:[{x:700,y:450},{x:900,y:470},{x:860,y:640}]});
    state.drawings.push({type:'ellipse',color:'#ffffff',pts:[{x:100,y:100},{x:300,y:250}]});   // 채움 있는 원(예전 그대로)
    sel=null;multiSel=[];state.tool='move';renderDrawings();
    const L=document.getElementById('drawLayer'),gOf=d=>[...L.children].find(g=>g.__psD===d)||L.children[state.drawings.indexOf(d)];
    const z=(d,tag)=>{const g=gOf(d);return {fills:[...g.querySelectorAll(tag)].filter(e=>e.getAttribute('pointer-events')==='none'&&!e.getAttribute('class')).map(e=>e.getAttribute('fill')),edge:[...g.querySelectorAll(tag+'.zone-edge')].map(e=>[e.getAttribute('fill'),!!e.getAttribute('stroke-dasharray')])};};
    out.ellipse=Object.assign({fs:state.drawings[0].fillStyle},z(state.drawings[0],'ellipse'));
    out.rect=Object.assign({fs:state.drawings[1].fillStyle},z(state.drawings[1],'rect'));
    out.poly=gOf(state.drawings[2]).querySelector('path.poly-fill')?.getAttribute('fill');
    out.filled=z(state.drawings[3],'ellipse');
    state.drawFillStyle='solid';return out;});
  assert.equal(fn.btn,true,'«채움 › 없음» 단추');assert.equal(fn.def,'none');
  assert.deepEqual(fn.ellipse,{fs:'none',fills:['none'],edge:[['none',false]]},'원형 구역: 채움 없음 + 실선 테두리');
  assert.deepEqual(fn.rect,{fs:'none',fills:['none'],edge:[['none',false]]},'구역도');
  assert.equal(fn.poly,'none','닫힌 다각형은 채움 없음');
  assert.ok(fn.filled.fills.length===1&&fn.filled.fills[0]!=='none'&&fn.filled.edge.length===0,'채움 있는 원은 예전 그대로: '+JSON.stringify(fn.filled));

  // ⑤ 단축키 여섯
  step('shortcuts');
  await reset();
  await f.evaluate(()=>{localStorage.setItem('cs_tool_shortcuts_tab_v1','board');__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('keys');});
  await f.locator('#cmd-board-settings-keyspane [data-keytab="board"]').click();
  for(const id of ['lineStyleOpen','lineDashToggle','passLobToggle','playersOpen','teamLoadOpen','drawingsClear']){
    assert.equal(await f.locator('#cmd-board-settings-keyspane [data-tool="'+id+'"]').getAttribute('data-key'),'','설정 표에 있고 기본 키는 비어 있다: '+id);
  }
  await f.evaluate(()=>__psToggleBoardSettings('close'));
  await f.evaluate(()=>{localStorage.setItem('cs_tool_shortcuts_v1',JSON.stringify({lineDashToggle:'shift+d',passLobToggle:'shift+l',drawingsClear:'shift+k',lineStyleOpen:'shift+s',playersOpen:'shift+p',teamLoadOpen:'shift+t'}));
    state.players=[{id:1,team:'blue',num:'7',x:300,y:300}];state.drawings=[{type:'pass',color:'#ffffff',pts:[{x:100,y:100},{x:400,y:120}]},{type:'line',color:'#ffffff',pts:[{x:100,y:200},{x:400,y:220}]}];renderTokens();renderDrawings();});
  await press('Shift+KeyD');assert.equal(await f.evaluate(()=>state.drawLineStyle),'dash','⇧D 점선');
  await press('Shift+KeyD');assert.equal(await f.evaluate(()=>state.drawLineStyle),'solid','⇧D 다시 실선');
  await f.evaluate(()=>{selectItem('drawing',state.drawings[0]);});
  await press('Shift+KeyL');assert.deepEqual(await f.evaluate(()=>[state.drawLob,state.drawings[0].lob]),[true,true],'⇧L 로빙 — 고른 패스도');
  await press('Shift+KeyL');assert.deepEqual(await f.evaluate(()=>[state.drawLob,state.drawings[0].lob]),[false,undefined]);
  await f.evaluate(()=>{sel=null;multiSel=[];renderDrawings();});
  await press('Shift+KeyS');assert.equal(await f.evaluate(()=>!!document.getElementById('lsPop')),true,'⇧S 선 스타일 창');
  await press('Shift+KeyS');assert.equal(await f.evaluate(()=>!!document.getElementById('lsPop')),false,'⇧S 다시 닫힘');
  const hasFloat=await f.evaluate(()=>!!document.getElementById('ps-df-team'));
  await press('Shift+KeyP');
  if(hasFloat){assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-df-team')),true,'⇧P 선수 놓기 칸');await press('Shift+KeyP');assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-df-team')),false);}
  else await press('Shift+KeyP');
  await press('Shift+KeyT');
  await f.waitForSelector('#alCancel',{timeout:8000});
  assert.equal(await f.evaluate(()=>!!document.querySelector('[role="dialog"][aria-label="저장 팀 불러오기"]')),true,'⇧T 저장 팀 불러오기 창');
  await f.evaluate(()=>document.getElementById('alCancel').click());await page.waitForTimeout(300);
  await press('Shift+KeyK');
  assert.deepEqual(await f.evaluate(()=>[state.drawings.length,state.players.length]),[0,1],'⇧K 이 장면 그림만 지우고 선수는 그대로');
  assert.equal(await f.evaluate(()=>document.getElementById('clearDrawBtn').textContent.trim()),'그림 모두 지우기','보드 설정 › 지우기의 이름');
  await f.evaluate(()=>{localStorage.removeItem('cs_tool_shortcuts_v1');localStorage.removeItem('cs_tool_shortcuts_tab_v1');});

  // 입력 중에는 안 돈다
  step('typing-guard');
  await f.evaluate(()=>{localStorage.setItem('cs_tool_shortcuts_v1',JSON.stringify({lineDashToggle:'d'}));state.drawLineStyle='solid';const i=document.createElement('input');i.id='__t3311';document.body.appendChild(i);i.focus();});
  await page.keyboard.press('KeyD');await page.waitForTimeout(150);
  assert.equal(await f.evaluate(()=>state.drawLineStyle),'solid','입력 칸에 d 를 치는 동안은 단축키가 아니다');
  await f.evaluate(()=>{document.getElementById('__t3311').remove();localStorage.removeItem('cs_tool_shortcuts_v1');});

  // 그림 — 화살 머리 · 속 빈 원 · 단축키 표
  step('shot');
  await reset();
  await f.evaluate(()=>{state.players=[{id:1,team:'blue',num:'7',x:300,y:300},{id:2,team:'blue',num:'8',x:600,y:300},{id:3,team:'red',num:'4',x:600,y:600}];
    state.drawings=[{type:'pass',color:'#ffffff',pts:[{x:300,y:300},{x:600,y:300}],tk:[1,2]},{type:'run',color:'#ffd60a',pts:[{x:600,y:600},{x:300,y:300}],tk:[3,1]},{type:'ellipse',color:'#ffffff',fillStyle:'none',pts:[{x:750,y:150},{x:1000,y:350}]}];renderTokens();renderDrawings();});
  await page.waitForTimeout(400);
  if(SHOTS)await page.screenshot({path:path.join(SHOTS,'board-reports-3311-'+size+'-'+engine+'.png')});
  await reset();
  console.log(JSON.stringify({test:'board-reports-3311',engine,size,passed:true}));
}catch(e){console.error('[board-reports-3311] failed at '+cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers)){try{await b.close();}catch(_){}}try{await fx.close();}catch(_){}}
