import assert from 'node:assert/strict';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.120 — 유니폼 토큰(board-jersey.js): «원형» · «유니폼» 선수 토큰에 유니폼 앞모습. 사용자 «토큰 유니폼도 이렇게»(FmStadio) ·
// «원형과 유니폼 전부» · «유니폼을 완전 디테일하게». 판 · 입체 칩 · 내보내기 · 3D 칩 윗면 · 끌기를 본다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  // 3.101 — 판에 손대는 시험은 내 작업판을 다 불러온 뒤에
  await f.waitForFunction(()=>window.__psJersey&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});

  const put=shape=>f.evaluate(shape=>{
    state.teamColors={red:'#e85a9b',blue:'#ffffff'};state.teamColor2={red:'#14213d',blue:'#6cc4ee'};state.teamPattern={red:'v',blue:'solid'};
    state.gkColors={red:'#ffd400'};state.gkColor2={red:'#1e5bc6'};
    state.players=[{id:'j1',team:'red',num:'9',name:'가상 선수',x:420,y:330},{id:'j2',team:'blue',num:'4',x:620,y:330},{id:'j3',team:'red',num:'1',x:250,y:330},
      {id:'j4',team:'red',coach:true,x:820,y:330},{id:'j5',team:'blue',num:'7',color:'#2f6df0',x:520,y:200}];
    setTokShape(shape);window.__setChip3d(false);renderTokens();
    const q=id=>document.querySelector('#tokenLayer [data-id="'+id+'"]');
    const kids=id=>[...q(id).children].map(c=>c.getAttribute('class')||c.tagName);
    const sleeve=id=>{const j=q(id).querySelector('.ps-jersey');return j&&j.querySelector('path[d="'+PSJersey.GEO[shape==='shirt'?'s':'c'].sleeve+'"]').getAttribute('fill');};
    return {jerseys:document.querySelectorAll('#tokenLayer .ps-jersey').length,coach:!!q('j4').querySelector('.ps-jersey'),
      kids:kids('j1'),label:q('j1').querySelector(':scope > text').getAttribute('y'),
      sleeves:['j1','j2','j3','j5'].map(sleeve),oldAcc:[...q('j1').children].some(c=>c.tagName==='path'&&!c.getAttribute('class')&&c.getAttribute('fill')==='none')};
  },shape);

  const circle=await put('circle');
  assert.equal(circle.jerseys,4,'선수 넷(코치 빼고)에 유니폼');assert.equal(circle.coach,false,'코치는 그대로');
  assert.deepEqual(circle.kids.slice(circle.kids.indexOf('tok-c'),circle.kids.indexOf('tok-c')+2),['tok-c','ps-jersey'],'얼굴 바로 위');
  assert.equal(circle.label,'1','번호를 가슴으로');
  assert.deepEqual(circle.sleeves,['#e85a9b','#ffffff','#ffd400','#2f6df0'],'팀 주색 · GK · 토큰 하나 색');
  await page.screenshot({path:SHOTS+'/board-jersey-circle.png'});

  const shirt=await put('shirt');
  assert.equal(shirt.jerseys,4);assert.equal(shirt.label,'2.5');assert.equal(shirt.oldAcc,false,'옛 목깃 선은 새 그림이 대신');

  // 입체 칩: 광택은 유니폼 위
  const c3=await f.evaluate(()=>{ setTokShape('circle');window.__setChip3d(true);renderTokens();
    const g=document.querySelector('#tokenLayer [data-id="j1"]'),k=[...g.children].map(c=>(c.tagName==='circle'&&c.getAttribute('class')==='ps-c3')?'gloss':(c.getAttribute('class')||c.tagName));
    const r={order:k.indexOf('gloss')>k.indexOf('ps-jersey')&&k.indexOf('ps-jersey')>k.indexOf('tok-c'),c3:document.querySelectorAll('#tokenLayer circle.ps-c3').length};
    window.__setChip3d(false);renderTokens();return r;});
  assert.ok(c3.order,'광택이 유니폼을 덮는다');assert.equal(c3.c3,5,'칩마다 광택');

  // 내보내기(그림 · 영상 · 썸네일이 같은 글을 쓴다)
  const xml=await f.evaluate(()=>{const s=boardImageXML().xml;return {n:(s.match(/class="ps-jersey"/g)||[]).length,clip:/clip-path/.test(s.split('ps-jersey')[1]||'')};});
  assert.equal(xml.n,4,'내보내기에도 유니폼');assert.equal(xml.clip,false);

  // 끌기: 유니폼 그림이 누르기를 가로채지 않는다
  const box=await (await f.$('#tokenLayer [data-id="j2"] .ps-jersey')).boundingBox();
  const before=await f.evaluate(()=>state.players.find(p=>p.id==='j2').x);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+10,{steps:6});await page.mouse.up();
  await f.waitForFunction(b=>state.players.find(p=>p.id==='j2').x>b+20,before,{timeout:5000});
  const after=await f.evaluate(()=>({x:state.players.find(p=>p.id==='j2').x,j:!!document.querySelector('#tokenLayer [data-id="j2"] .ps-jersey')}));
  assert.ok(after.j,'옮긴 뒤에도 유니폼');

  // 3D: 칩 윗면에 같은 유니폼
  await f.evaluate(()=>window.__setTilt(true));
  await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
  const d3=await f.evaluate(()=>{renderTokens();return {chips:document.querySelectorAll('#tokenLayer [data-depth-chip]').length,lids:document.querySelectorAll('#tokenLayer .ps-chip .ps-jersey').length};});
  assert.ok(d3.chips>=4,'3D 칩 '+d3.chips);assert.equal(d3.lids,4,'칩 윗면에 유니폼');
  await page.screenshot({path:SHOTS+'/board-jersey-3d.png'});
  await f.evaluate(()=>window.__setTilt(false));

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,passed:true,circle:circle.jerseys,shirt:shirt.jerseys,c3,xml,drag:[before,after.x],d3}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
