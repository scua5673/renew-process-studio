import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.136 — 미팅을 고치는 동안 뒤에 둔 작업 보드의 페이지는 그대로다(738f37d1 을 고치다 찾음).
// 작업 보드의 «모든 페이지»(window.__psPages.eachOther · applyNames)는 먼저 지금 판을 지금 페이지에 담는다(capture) — 미팅 중의 지금 판은 슬라이드라
// 선수단 불러오기 · 이름 · 토큰 크기 · 맨 앞으로 · 잔상 · 이름표 글꼴이 작업 보드의 다른 페이지를 고치고, 지금 페이지엔 슬라이드 배치를 적었다.
// ① 작업 보드에서는 같은 동작이 모든 페이지에 간다 ② 미팅 안에서는 작업 보드 페이지가 한 글자도 바뀌지 않는다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
const NUMS=[1,2,3,4,5,6,7,8,9,10,11];
const squadOf=tag=>({form:'433',players:NUMS.map((n,i)=>({id:'sq-'+tag+'-'+n,name:tag+n,num:n,pos:['GK','RB','RCB','LCB','LB','RCM','CM','LCM','RW','ST','LW'][i]}))});
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__psPages&&window.__psPages.eachOther&&window.__psPages.eachOther.__psMeetSafe&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&typeof window.__setNameFont==='function',null,{timeout:30000});

  // 작업 보드 페이지 셋 — 모두 같은 선수(같은 id · 번호), 둘째 페이지엔 장면 둘
  await f.evaluate(()=>{const add=document.querySelector('#boardPageStrip .tb-add,#boardPageStrip .bp-add');add.click();add.click();});
  await f.waitForFunction(()=>(window.__psPages.pg()||[]).length===3);
  const cur=await f.evaluate(()=>window.__psPages.book.idx());
  await f.evaluate(()=>{
    state.players=[];for(let i=0;i<11;i++){const u=n2u(0.08+(i%4)*0.1,0.12+Math.floor(i/4)*0.3);state.players.push({id:9100+i,team:'blue',num:i+1,x:u.x,y:u.y});}
    for(let i=0;i<3;i++){const u=n2u(0.7,0.2+i*0.3);state.players.push({id:9200+i,team:'red',num:i+1,x:u.x,y:u.y});}
    renderTokens();
    const P=window.__psPages.pg(),base=JSON.parse(JSON.stringify(captureSnap())),me=window.__psPages.book.idx();
    P.forEach((p,i)=>{if(i===me)return;p.snap=JSON.parse(JSON.stringify(base));p.snap.pitchTheme=i===0?'white':'';});
    const o=P.findIndex((p,i)=>i!==me);P[o].anim={frames:[{snap:JSON.parse(JSON.stringify(base))},{snap:JSON.parse(JSON.stringify(base))}],active:0,hold:.6};
  });
  const others=()=>f.evaluate(()=>{const me=window.__psPages.book.idx();return window.__psPages.pg().map((p,i)=>i===me?null:p).filter(Boolean);});
  const tokOf=(p,id)=>(p.snap.players||[]).find(t=>t.id===id);

  // ① 작업 보드 — 선수단 · 이름 · 크기 · 맨 앞으로 · 잔상 · 이름표 글꼴이 다른 페이지(와 그 장면)에도
  await f.evaluate(sq=>{squad=sq;applySquadToBoard({});},squadOf('작업'));
  await page.waitForTimeout(200);
  let O=await others();
  const dressed=await f.evaluate(()=>Object.fromEntries(state.players.filter(t=>t.team==='blue').map(t=>[t.id,t.name])));
  assert.ok(Object.values(dressed).filter(n=>/^작업\d+$/.test(String(n))).length>=6,'board: the open page has the squad '+JSON.stringify(dressed));
  const same=sn=>sn.players.filter(t=>t.team==='blue').every(t=>t.name===dressed[t.id]);
  assert.ok(O.every(p=>same(p.snap)),'board: the squad reaches every other page '+JSON.stringify(O.map(p=>p.snap.players.map(t=>t.name))));
  assert.ok(O.some(p=>p.anim&&p.anim.frames.length===2&&p.anim.frames.every(fr=>same(fr.snap))),'board: and their scenes');
  await f.evaluate(()=>{const p=state.players.find(t=>t.id===9105);p.name='이름바꿈';applyNamesAllScenes();});
  await f.evaluate(()=>{const p=state.players.find(t=>t.id===9106);p.trail=2;_tokPropAll([p],['trail']);});
  await f.evaluate(()=>zOrderItems([state.players.find(t=>t.id===9100)],true));
  await f.evaluate(()=>scaleAll(1.25));
  await f.evaluate(()=>window.__setNameFont('round'));
  await f.evaluate(()=>window.__nameFontWarm());
  await page.waitForTimeout(300);
  O=await others();
  const lookB=await f.evaluate(()=>({ts:state.tokenScale,nf:window.__nameFont}));
  assert.ok(O.every(p=>tokOf(p,9105).name==='이름바꿈'),'board: names to every page');
  assert.ok(O.every(p=>tokOf(p,9106).trail===2),'board: trail to every page');
  assert.ok(O.every(p=>{const z=p.snap.players.map(t=>+t.z);return +tokOf(p,9100).z===Math.max(...z);}),'board: «맨 앞으로» on every page '+JSON.stringify(O.map(p=>p.snap.players.map(t=>t.z))));
  assert.ok(O.every(p=>p.snap.tokenScale===lookB.ts&&p.snap.nameFont==='round'),'board: token size · name font are one setting for the work '+JSON.stringify(O.map(p=>[p.snap.tokenScale,p.snap.nameFont]))+' '+JSON.stringify(lookB));

  // ② 미팅 — 보관함 «＋ 만들기 › 미팅 자료»
  const pagesOut=await f.evaluate(()=>JSON.stringify(window.__psPages.pg()));
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'));
  await f.evaluate(()=>document.getElementById('dfNew').click());
  await f.waitForSelector('.vcc-item');
  await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length>=2,null,{timeout:15000});
  await f.waitForSelector('#psMeetForm.on');await f.evaluate(()=>document.querySelector('#psMeetForm .mf-skip').click());
  await page.waitForTimeout(400);
  await f.evaluate(()=>{ if(window.__meetingPageActive)window.__meetingPageEdit(); });
  await f.waitForFunction(()=>!window.__meetingPageActive);
  await page.waitForTimeout(400);
  const inMeet=await f.evaluate(()=>({pages:JSON.stringify(window.__psPages.pg()),idx:window.__psPages.book.idx(),slide:window.__meet.idx(),blue:state.players.filter(p=>p.team==='blue'&&!p.coach).length,vault:!!window.__vaultEdit}));
  assert.equal(inMeet.pages,pagesOut,'opening a meeting leaves the work pages as they were');
  assert.ok(inMeet.blue>0,'the meeting slide has our players');

  await f.evaluate(sq=>{squad=sq;applySquadToBoard({});},squadOf('미팅'));
  await f.evaluate(()=>{const p=state.players.find(t=>t.team==='blue'&&!t.coach);p.name='미팅이름';syncNameToScenes(p);applyNamesAllScenes();});
  await f.evaluate(()=>scaleAll(1.25));
  await f.evaluate(()=>zOrderItems([state.players.find(t=>t.team==='blue'&&!t.coach)],true));
  await f.evaluate(()=>{const p=state.players.find(t=>t.team==='blue'&&!t.coach);p.trail=3;_tokPropAll([p],['trail']);});
  await f.evaluate(()=>window.__setNameFont('hand'));
  await f.evaluate(()=>window.__nameFontWarm());
  await f.evaluate(()=>window.__psPages.thumbs());
  await page.waitForTimeout(800);   // eachOther 는 바뀐 페이지를 한 박자 뒤에 다시 그리고 저장한다 — 그것까지 기다린다
  const after=await f.evaluate(()=>({pages:JSON.stringify(window.__psPages.pg()),idx:window.__psPages.book.idx(),
    names:state.players.filter(p=>p.team==='blue'&&!p.coach).map(p=>p.name),nf:window.__nameFont,meet:document.body.classList.contains('meet-mode')}));
  assert.ok(after.meet,'still in the meeting');
  assert.ok(after.names.some(n=>/^미팅/.test(String(n))),'the actions ran on the meeting slide '+JSON.stringify(after.names));
  assert.equal(after.nf,'hand');
  assert.equal(after.idx,inMeet.idx);
  if(after.pages!==inMeet.pages){
    const a=JSON.parse(inMeet.pages),b=JSON.parse(after.pages);
    const diff=a.map((p,i)=>JSON.stringify(p)===JSON.stringify(b[i])?null:{i,names:(b[i].snap.players||[]).map(t=>t.name).slice(0,4),ts:[p.snap.tokenScale,b[i].snap.tokenScale],nf:[p.snap.nameFont,b[i].snap.nameFont]}).filter(Boolean);
    assert.fail('the work board pages changed inside the meeting '+JSON.stringify(diff));
  }
  await page.screenshot({path:path.join(SHOTS,'meeting-work-pages-'+size+'.png')});

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,test:'meeting-work-pages',passed:true,pages:3,cur,vaultEdit:inMeet.vault}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
