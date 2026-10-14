import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.031 — 오류 제보 81e77b91 «경기 준비에서 새 미팅은 슬라이드쇼가 되는데, 보관함에서 가져온 자료는 슬라이드쇼가 없다».
// 가져온 것은 작전판(페이지 10)이었고, 경기 보드는 작전판에 «▶ 슬라이드쇼»를 그리지 않았다.
// 이제 작전판도: 페이지 = 장(제목 = 페이지 이름 · 장면 그대로)인 보기 전용 미팅으로 띄우고, «나가기»로 경기 준비의 같은 자리로 돌아온다.
// 보관함에는 아무것도 쓰지 않는다(작전판 그대로 · 미팅이 생기지 않는다) · 작업 보드로 돌아온다.
// 합성 팀 fixture 에서만 돈다. WebKit 은 아이패드 폭, Chromium 은 데스크톱 폭.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  const board=async()=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await f.waitForFunction(()=>typeof window.__meetingSetMatch==='function'&&typeof window.__snapToThumb==='function'&&typeof store==='object'&&typeof window.__meetSlidesFromBoard==='function');return f;};
  let bf=await board();
  // 작전판 셋 페이지 — 1: 그림 한 장 · 2: 장면 둘 · 3: 세로
  await bf.evaluate(async()=>{
    const snap=(n,x,o)=>({players:Array.from({length:n},(_,i)=>({id:i+1,team:i%2?'red':'blue',num:String(i+1),x:x+i*38,y:250+(i%3)*90})),equipment:[],drawings:[],ball:{x:555,y:370},orientation:o||'h'});
    const p1=snap(4,240),p2=snap(6,300),p3=snap(3,200,'v'),p2b=JSON.parse(JSON.stringify(p2));p2b.players[0].x+=200;
    const pages=[{snap:p1,name:'가상 빌드업',thumb:window.__snapToThumb(p1),anim:{frames:[],hold:.6,active:-1,title:'',titleColor:'#e23b3b'}},
      {snap:p2b,name:'가상 압박',thumb:window.__snapToThumb(p2),anim:{frames:[{snap:p2,dur:1},{snap:p2b}],hold:.9,active:1,title:'',titleColor:'#e23b3b'}},
      {snap:p3,name:'가상 세로',thumb:window.__snapToThumb(p3),anim:{frames:[],hold:.6,active:-1}}];
    const lib=(await store.get('cs_drill_lib_v1'))||[];
    lib.unshift({libId:'Vqa_board',type:'board',name:'가상 작전판',folder:'',thumb:pages[0].thumb,snap:p1,pages,tags:[],savedAt:Date.now()-1000,createdBy:'11111111-1111-4111-8111-111111111111'});
    await store.set('cs_drill_lib_v1',lib);try{localStorage.setItem('cs_lib_rev',String(Date.now()));}catch(_){}
  });
  /* 작업 보드에 선수 둘 — 쇼(보기 전용 미팅)는 작업 보드를 빌렸다가 그대로 돌려준다 */
  const work0=await bf.evaluate(()=>{ if((window.__csView||'board')!=='board')return null; pushUndo(); state.players=[{id:'w1',team:'blue',num:'8',x:350,y:300},{id:'w2',team:'red',num:'3',x:520,y:330}]; renderTokens(); try{boardSaveLive();}catch(_){} return state.players.map(p=>p.id).join(','); });
  assert.equal(work0,'w1,w2','작업 보드에서 시작');
  const item=id=>bf.evaluate(async id=>JSON.stringify(((await store.get('cs_drill_lib_v1'))||[]).find(x=>x.libId===id)||null),id);
  const meetings=()=>bf.evaluate(async()=>((await store.get('cs_drill_lib_v1'))||[]).filter(x=>x.type==='meeting').map(x=>x.libId));
  // 팀 › 경기 › 가상 상대 FC › 경기 준비 — 작전판을 가져온다
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchLoad==='function'&&(matchLoad().matches||[]).some(m=>/가상 상대 FC/.test(m.opponent||'')),null,{timeout:30000});
  const mid=await sf.evaluate(()=>{const m=matchLoad().matches.find(x=>/가상 상대 FC/.test(x.opponent||''));setView('match');matchOpen(m.id);matchTab='prep';matchStage='prep';renderMatch();return m.id;});
  await sf.waitForSelector('#matchMeetCard:not([hidden]) .mmv-empty',{timeout:15000});
  await sf.click('#matchMeetCard .mmv-empty [data-mm-link]');
  await sf.waitForSelector('#mmSheetOv .mm-pick[data-mm-lib="Vqa_board"]');await sf.click('#mmSheetOv .mm-pick[data-mm-lib="Vqa_board"]');
  await sf.waitForFunction(()=>document.querySelector('#matchMeetCard .mmv[data-mmv="Vqa_board"] .mmv-svg svg'),null,{timeout:15000});
  bf=await board();
  await bf.waitForFunction(async()=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(x=>x.libId==='Vqa_board');return !!(d&&d.matchRef);},null,{timeout:15000});
  const linked=await item('Vqa_board'),meet0=await meetings();
  // 1) 작전판에도 «▶ 슬라이드쇼»
  assert.equal(await sf.evaluate(()=>{const b=document.querySelector('#matchMeetCard .mmv-acts [data-mm-show]');return b&&b.textContent.trim();}),'▶ 슬라이드쇼','작전판도 슬라이드쇼 버튼');
  await sf.click('#matchMeetCard .mmv-nav.next');
  assert.equal(await sf.evaluate(()=>document.querySelector('#matchMeetCard .mmv-scn').textContent),'장면 2 · 슬라이드쇼에서 재생');
  const scrollY0=await sf.evaluate(()=>{const c=document.getElementById('matchMeetCard');c.scrollIntoView({block:'center'});return Math.round(window.scrollY||document.scrollingElement.scrollTop||0);});
  // 2) 누르면 보기 전용 쇼 — 페이지 = 장, 제목 = 페이지 이름, 장면은 → 로
  /* 리뷰 — 앞서 보관함에서 작전판을 «보기»로 열었다 닫으면 __vvItem 이 남는다(showViewBar 만 바꾼다). 그 옛 항목이 «지금 연 것»으로 잡혀
     경기 준비 안 띠가 서지 않고, 쇼가 끝나도 경기 준비로 돌아가지 못했다. 그 상태를 만들고 시작한다 */
  await bf.evaluate(()=>{window.__vvItem={libId:'Vqa_stale',type:'board',name:'가상 앞서 본 작전판'};const e=document.getElementById('vCreateEdit');if(e)e.style.display='';});
  await sf.click('#matchMeetCard .mmv-acts [data-mm-show]');
  await page.waitForFunction(()=>document.body.classList.contains('ps-match-edit'),null,{timeout:15000});
  bf=await board();
  await bf.waitForFunction(()=>document.body.classList.contains('focus-board')&&!!(window.__meet&&window.__meet.idx()>=0),null,{timeout:15000});
  await page.waitForTimeout(600);
  const st=()=>bf.evaluate(()=>({idx:window.__meet.idx(),titles:window.__meet.frames().map(s=>s.title),players:state.players.length,ro:!!window.__vaultReadOnly,cur:window.__curVaultId,
    scenes:anim.frames.length,active:animActive,orient:state.orientation,vc:document.body.classList.contains('vc-match'),head:(document.querySelector('#ksHead input')||{}).value||'',bar:(document.getElementById('vCreateSub')||{}).textContent}));
  let s=await st();
  assert.deepEqual(s.titles,['가상 빌드업','가상 압박','가상 세로'],'페이지마다 한 장 '+JSON.stringify(s));
  assert.equal(s.idx,0);assert.equal(s.players,4);assert.equal(s.ro,true,'보기 전용');assert.equal(s.cur,null,'보관함 항목으로 열지 않는다');
  assert.equal(s.vc,true,'경기 준비 안 쇼로 알아본다');assert.match(s.bar,/보기 전용/);
  await page.screenshot({path:path.join(SHOTS,'match-board-show-'+size+'.png')});
  await bf.evaluate(()=>window.__meetStep(1));await page.waitForTimeout(800);
  s=await st();assert.equal(s.idx,1);assert.equal(s.scenes,2,'장면 둘');assert.equal(s.active,0);assert.equal(s.players,6);
  await bf.evaluate(()=>window.__meetStep(1));await bf.waitForFunction(()=>animActive===1,null,{timeout:5000});await page.waitForTimeout(1300);
  s=await st();assert.equal(s.idx,1,'→ 는 장면부터');assert.equal(await bf.evaluate(()=>Math.round(state.players[0].x)),await bf.evaluate(()=>Math.round(window.__meet.frames()[1].frames[1].snap.players[0].x)),'장면 2 의 자리');
  await bf.evaluate(()=>window.__meetStep(1));await page.waitForTimeout(800);
  s=await st();assert.equal(s.idx,2);assert.equal(s.orient,'v','세로 페이지는 세로로');
  // 3) «나가기» → 경기 준비의 같은 자리 · 보관함은 그대로 · 작업 보드로 돌아온다
  await bf.click('#meetNav .mn-exit');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='scout'&&!document.body.classList.contains('ps-match-edit'),null,{timeout:15000});
  assert.equal(await sf.evaluate(()=>matchCurrent),mid,'같은 경기');
  const scrollY1=await sf.evaluate(()=>Math.round(window.scrollY||document.scrollingElement.scrollTop||0));
  assert.ok(Math.abs(scrollY1-scrollY0)<=4,'보던 자리 그대로 '+scrollY0+'→'+scrollY1);
  await bf.waitForFunction(()=>!document.body.classList.contains('meet-mode')&&!document.body.classList.contains('vcreating')&&!window.__vaultReadOnly&&!window.__vaultEdit,null,{timeout:15000});
  await page.waitForTimeout(800);
  assert.equal(await item('Vqa_board'),linked,'작전판은 그대로');
  assert.deepEqual(await meetings(),meet0,'미팅이 새로 생기지 않는다');
  assert.equal(await bf.evaluate(()=>window.__csView+'|'+state.players.map(p=>p.id).join(',')),'board|w1,w2','작업 보드는 그대로');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
