import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS} from '../fixtures/team-app.mjs';
// 3.014 — 오류 제보 88a82188 «첫 화면 보드 초기화 하는 게 있으면 좋을 것 같습니다 · 전 작업이 계속 남아 있네요».
// 위 띠의 «새 보드»: 확인 → 페이지 하나·장면 없음·빈 판 → 바로 «보드 저장»(새로고침해도 새 보드). 1분 동안 «↶ 이전 보드»로 그대로 되살린다.
// 합성 팀 fixture 에서만 돈다. 폰은 위 띠가 없어(여러 페이지일 때만) 데스크톱 폭으로 본다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.waitForTimeout(2500);
  const openBoard=async()=>{
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__psPages&&typeof window.__psPages.newBoard==='function'&&window.__boardReady!==false&&!!document.getElementById('bpNewBoard'),null,{timeout:30000});
    await page.waitForTimeout(800);return f;};
  let f=await openBoard();
  const st=()=>f.evaluate(()=>({tabs:[...document.querySelectorAll('#boardPageStrip .bp-tab')].map(b=>b.textContent.trim()),players:state.players.length,drawings:state.drawings.length,
    frames:(window.__animGet&&window.__animGet()||{frames:[]}).frames.length,undo:!!document.getElementById('bpNewBoardUndo'),ready:window.__psPages.newBoardUndoReady(),
    save:(document.getElementById('boardManualSave')||{}).textContent}));
  /* 보드의 psConfirm 창 — 클래스가 없어 «확인»·«취소» 단추로 찾는다 */
  const dlgOpen=()=>f.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.hasAttribute('data-ps-ok')&&b.offsetParent!==null));
  const dlgText=()=>f.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.hasAttribute('data-ps-ok')&&b.offsetParent!==null);return b?b.parentElement.parentElement.textContent:'';});
  const dlgPress=async(label)=>{await f.evaluate(l=>{[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()===l&&b.offsetParent!==null).pop().click();},label);await f.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.hasAttribute('data-ps-ok')&&b.offsetParent!==null));};
  /* 3.078 — 떠 있는 도크의 위쪽 막대: «새 보드» · «이전 보드»는 «보드 ▾» 메뉴 안에 있다(board-topbar.js) */
  const menuClick=async sel=>{ if(await f.locator('#tbBrand').isVisible().catch(()=>false)&&!(await f.locator(sel).isVisible().catch(()=>false)))await f.click('#tbBrand'); await f.click(sel); };
  const confirm=async(re)=>{ await f.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.hasAttribute('data-ps-ok')&&b.offsetParent!==null));const t=await dlgText();if(re)assert.match(t,re,t);await f.evaluate(()=>{[...document.querySelectorAll('button[data-ps-ok]')].filter(b=>b.offsetParent!==null).pop().click();});await f.waitForFunction(()=>![...document.querySelectorAll('button[data-ps-ok]')].some(b=>b.offsetParent!==null));};
  // 1) 이전 작업 — 두 페이지, 선수·그림, 장면 둘
  await f.evaluate(()=>{pushUndo();state.players.push({id:'nb1',team:'blue',num:'9',name:'가상 공격수',x:400,y:300},{id:'nb2',team:'red',num:'4',x:600,y:330});
    state.drawings.push({type:'line',pts:[{x:300,y:200},{x:500,y:260}],color:'#fff'});renderTokens();renderDrawings();});
  await f.evaluate(()=>{ensureAnimMode(true);document.getElementById('animAdd').click();state.players[0].x+=80;renderTokens();document.getElementById('animAdd').click();});
  await f.click('#boardPageStrip .bp-add:not(#bpImportBoard):not(#bpNewBoard)');   /* ＋ 페이지 */
  await f.evaluate(()=>{pushUndo();state.players.push({id:'nb3',team:'blue',num:'7',x:500,y:400});renderTokens();});
  await f.evaluate(()=>window.__boardSaveExplicit());
  let s=await st();
  assert.equal(s.tabs.length,2,'두 페이지 '+JSON.stringify(s));assert.equal(s.undo,false,'처음엔 «이전 보드» 없음');
  // 2) «새 보드» — 무엇이 지워지는지 말하고, 비운 뒤 바로 저장한다
  await menuClick('#bpNewBoard');
  await confirm(/페이지 2개[\s\S]*장면 \d+개[\s\S]*보관함에 저장한 자료는 그대로/);
  await f.waitForFunction(()=>!!document.getElementById('bpNewBoardUndo'));
  await page.waitForTimeout(600);
  s=await st();
  assert.equal(s.tabs.length,1,'페이지 하나 '+JSON.stringify(s));assert.equal(s.players,0,'선수 없음');assert.equal(s.drawings,0,'그림 없음');assert.equal(s.frames,0,'장면 없음');
  assert.ok(s.undo&&s.ready,'«↶ 이전 보드» '+JSON.stringify(s));assert.equal(s.save,'저장','새 보드는 바로 저장됐다(변경 점 없음) '+JSON.stringify(s));
  await page.screenshot({path:path.join(SHOTS,'board-new-board-'+engine+'.png')});
  // 3) «↶ 이전 보드» — 손대지 않았으면 묻지 않고 그대로 되살린다(페이지·선수·장면)
  await menuClick('#bpNewBoardUndo');
  await f.waitForFunction(()=>!document.getElementById('bpNewBoardUndo')&&document.querySelectorAll('#boardPageStrip .bp-tab').length===2);
  await page.waitForTimeout(500);
  s=await st();
  assert.equal(s.tabs.length,2);assert.equal(s.players,1,'지금 페이지(2쪽)의 선수 '+JSON.stringify(s));
  await f.evaluate(()=>window.__psPages&&document.querySelectorAll('#boardPageStrip .bp-tab')[0].click());await page.waitForTimeout(300);
  s=await st();assert.equal(s.players,2,'1쪽 선수 둘');assert.equal(s.drawings,1,'1쪽 그림');assert.ok(s.frames>=2,'1쪽 장면 '+JSON.stringify(s));
  // 4) 다시 «새 보드» → 새로 그린 뒤 «이전 보드»는 한 번 더 묻는다(취소) → 새로고침해도 새 보드
  await menuClick('#bpNewBoard');await confirm();
  await f.waitForFunction(()=>!!document.getElementById('bpNewBoardUndo'));
  await f.evaluate(()=>{pushUndo();state.players.push({id:'nb9',team:'blue',num:'1',x:200,y:300});renderTokens();});
  await menuClick('#bpNewBoardUndo');await f.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='취소'&&b.offsetParent!==null));
  assert.match(await dlgText(),/새 보드에 그린 것은 사라져요/);
  await dlgPress('취소');
  await f.evaluate(()=>{pushUndo();state.players=[];renderTokens();});await f.evaluate(()=>window.__boardSaveExplicit());
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.waitForTimeout(1500);
  f=await openBoard();await page.waitForTimeout(1200);
  s=await st();
  assert.equal(s.tabs.length,1,'새로고침해도 페이지 하나 '+JSON.stringify(s));assert.equal(s.players,0,'옛 작업이 돌아오지 않는다');assert.equal(s.drawings,0);assert.equal(s.frames,0);
  assert.equal(s.undo,false,'새로고침 뒤에는 «이전 보드»가 없다');
  // 5) 이미 빈 한 장이면 묻지 않는다
  await menuClick('#bpNewBoard');await page.waitForTimeout(400);
  assert.equal(await dlgOpen(),false,'빈 보드는 확인 창 없이');
  /* 6) 3.031 — 오류 제보 88a82188 후속 «시간이 좀 지나고 누르니 초기화가 안 되고 선수는 그대로». 보드 설정 › 배치 › 기본 세팅에 선수가 있으면
     «새 보드»가 그 선수들로 시작했다(확인 창은 «모두 지워요»). 이제 묻는다: 빈 보드로 / 기본 세팅으로(선수 N명) / 취소 */
  const choice=()=>f.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&/^(빈 보드로 시작|기본 세팅으로 시작|취소)/.test(b.textContent.trim())).map(b=>b.textContent.trim()));
  const pick=async(label)=>{await f.evaluate(l=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&b.textContent.trim().startsWith(l)).pop().click(),label);await page.waitForTimeout(700);};
  await f.evaluate(()=>{pushUndo();state.players.push({id:'d1',team:'blue',num:'5',x:300,y:300},{id:'d2',team:'blue',num:'6',x:420,y:330},{id:'d3',team:'red',num:'9',x:640,y:300});renderTokens();});
  await f.click('#bpBoardSettings');await f.waitForSelector('#cmd-board-default-save',{state:'attached'});
  assert.equal(await f.evaluate(()=>document.getElementById('cmd-board-default-save').textContent.trim()),'새 보드로 정하기','«보드 저장»과 헷갈리지 않는 이름');
  await f.evaluate(()=>document.getElementById('cmd-board-default-save').click());
  await f.click('#bpBoardSettings');await page.waitForTimeout(300);
  await f.evaluate(()=>{pushUndo();state.drawings.push({type:'line',pts:[{x:300,y:200},{x:500,y:260}],color:'#fff'});renderTokens();renderDrawings();});
  await menuClick('#bpNewBoard');await f.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.offsetParent!==null&&b.textContent.trim()==='빈 보드로 시작'));
  assert.deepEqual(await choice(),['빈 보드로 시작','기본 세팅으로 시작 (선수 3명)','취소']);
  await pick('취소');s=await st();assert.equal(s.players,3,'취소는 그대로');assert.equal(s.drawings,1);
  await menuClick('#bpNewBoard');await f.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.offsetParent!==null&&b.textContent.trim()==='빈 보드로 시작'));
  await pick('빈 보드로 시작');s=await st();
  assert.equal(s.players,0,'빈 보드 — 기본 세팅의 선수도 없다 '+JSON.stringify(s));assert.equal(s.drawings,0);assert.equal(s.tabs.length,1);
  await menuClick('#bpNewBoard');await f.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.offsetParent!==null&&b.textContent.trim()==='빈 보드로 시작'));
  await pick('기본 세팅으로 시작');s=await st();
  assert.equal(s.players,3,'기본 세팅으로 — 그 선수 셋 '+JSON.stringify(s));assert.equal(s.drawings,0,'그림은 기본 세팅에 없다');
  /* 빈 보드 → 바로 기본 세팅으로 바꿔 골라도 «↶ 이전 보드»는 처음 보드(선수 셋 + 그림)를 되살린다 */
  assert.ok(s.undo&&s.ready,'«↶ 이전 보드»가 남아 있다 '+JSON.stringify(s));
  await menuClick('#bpNewBoardUndo');await f.waitForFunction(()=>!document.getElementById('bpNewBoardUndo'));await page.waitForTimeout(500);
  s=await st();assert.equal(s.players,3);assert.equal(s.drawings,1,'처음 보드의 그림까지 '+JSON.stringify(s));
  await f.evaluate(()=>window.__psClearBoardDefault());
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
