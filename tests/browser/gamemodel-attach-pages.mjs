import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.007 — 오류 제보 0f52fe75 «보관함 게임모델 — 전방압박에 첨부해 놓고 미들블록 작전판을 들어가면 전방압박에 해놓은 게 그대로 보임 · 따로따로 분리가 안 돼 있습니다».
// 첨부(캡처) 동안 작전판은 한 장짜리 판이다: 작업 보드의 페이지 묶음·되돌리기 기록은 맡겨 두었다가 그대로 돌려받고, 국면마다 빈 판에서 시작한다.
// 완료·취소 없이 돌아갔다 다시 열어도 작업 보드는 그대로이고, «▶ 보기»는 어느 국면에도 적지 않는다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const model={identity:'가상 팀',open:{do:true},moments:[{key:'do',cat:'do',name:'수비 조직',tag:'OUT OF POSSESSION',phases:[{id:'ph1',name:'전방 압박',principles:['가상 원칙 1'],snap:null},{id:'ph2',name:'미드 블록',principles:['가상 원칙 2'],snap:null}]}]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const boardFrame=async page=>(await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
const gmFrame=async page=>(await page.waitForSelector('#fGameModel',{state:'attached'})).contentFrame();
const nums=a=>(a||[]).map(p=>p.num).join('');
// 판·페이지 띠·맡겨 둔 묶음을 한 번에 읽는다(읽기만 — captureContext 는 사본을 돌려준다)
const look=f=>f.evaluate(()=>{const c=window.__psPages.captureContext(captureSnap(),null);return {cap:document.body.classList.contains('ps-capturing'),lent:window.__psPages.lent(),canvas:state.players.map(p=>p.num).join(''),
  tabs:[...document.querySelectorAll('#boardPageStrip .bp-tab')].map(b=>b.querySelector('span').textContent.trim()+(b.classList.contains('on')?'*':'')),
  adds:[...document.querySelectorAll('#boardPageStrip .bp-add')].map(b=>b.textContent.trim()),
  pages:c.pages?c.pages.map(p=>(p.snap.players||[]).map(q=>q.num).join('')):null,idx:c.idx,undo:undoStack.length,
  bar:[...document.querySelectorAll('body > div > button')].filter(b=>/첨부 완료|취소|닫기/.test(b.textContent)).map(b=>b.textContent.trim())};});
const stored=page=>page.evaluate(()=>{const m=JSON.parse(localStorage.getItem('cs_gamemodel_personal_v1')||'null');return m.moments[0].phases.map(ph=>ph.snap&&ph.snap.snap?ph.snap.snap.players.map(p=>p.num).join(''):null);});
const put=(f,num)=>f.evaluate(n=>{pushUndo();state.players=[{id:'t'+n,team:'blue',num:n,x:300,y:300}];renderTokens();},num);
const barClick=(f,label)=>f.evaluate(l=>[...document.querySelectorAll('body > div > button')].find(b=>b.textContent.trim().replace('✓ ','')===l).click(),label);
const attach=async(page,phaseIdx,label)=>{const gm=await gmFrame(page);await gm.waitForSelector('.snapwrap .attachbtn',{timeout:20000});
  await gm.evaluate(([i,l])=>[...document.querySelectorAll('.snapwrap')][i].querySelectorAll('.attachbtn').forEach(b=>{if(b.textContent.includes(l))b.click();}),[phaseIdx,label]);await wait(2500);return boardFrame(page);};
const backToGameModel=async page=>{await page.evaluate(()=>window.__psShowApp('gamemodel'));await wait(1200);};   // 완료·취소 없이 게임모델로 돌아간다
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await wait(3000);
  await page.evaluate(m=>localStorage.setItem('cs_gamemodel_personal_v1',JSON.stringify(m)),model);
  // 작업 보드: 두 페이지(W · X), 둘째 페이지를 보고 있다
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]:not([data-train])').click());await wait(2000);
  let f=await boardFrame(page);
  await put(f,'W');
  await f.evaluate(()=>[...document.querySelectorAll('#boardPageStrip .bp-add')].find(b=>/페이지$/.test(b.textContent.trim())).click());await wait(500);
  await put(f,'X');await f.evaluate(()=>boardSaveLive());await wait(900);
  const work=await look(f);
  assert.deepEqual(work.pages,['W','X'],'작업 보드 두 페이지');assert.equal(work.idx,1);assert.equal(work.undo>0,true,'작업 보드의 되돌리기 기록');
  // 보관함 › 게임모델
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());await wait(2500);
  f=await boardFrame(page);await f.evaluate(()=>document.getElementById('vaultGameModelTab').click());await wait(4000);
  // ① 전방 압박에 첨부 — 빈 한 장짜리 판, 페이지 띠에는 «보드 가져오기»만
  f=await attach(page,0,'작전판 첨부');
  let s=await look(f);
  assert.equal(s.cap,true,'첨부 모드');assert.equal(s.lent,true,'작업 보드의 페이지를 맡겨 둔다');
  assert.equal(s.canvas,'','빈 판에서 시작');assert.equal(s.pages,null,'첨부 중에는 한 장짜리 판');
  assert.deepEqual(s.tabs,[],'첨부 중에는 페이지 탭이 없다');assert.deepEqual(s.adds,['보드 가져오기'],'«＋ 페이지»·«미팅 세트» 없이 «보드 가져오기»만');
  assert.equal(s.undo,0,'첨부는 빈 되돌리기 기록에서 시작');assert.deepEqual(s.bar,['✓ 첨부 완료','취소']);
  await put(f,'A');await barClick(f,'첨부 완료');await wait(2500);
  assert.deepEqual(await stored(page),['A',null],'전방 압박에만 붙는다');
  f=await boardFrame(page);s=await look(f);
  assert.equal(s.cap,false);assert.equal(s.lent,false);
  assert.deepEqual(s.pages,work.pages,'작업 보드의 페이지가 그대로 돌아온다');assert.equal(s.idx,work.idx);assert.equal(s.canvas,'X','보던 페이지 그대로');
  assert.deepEqual(s.tabs,work.tabs);assert.equal(s.undo,work.undo,'되돌리기 기록도 첨부 전 그대로');
  // ② 미드 블록 — 전방 압박의 그림이 어디에도 없다
  f=await attach(page,1,'작전판 첨부');
  s=await look(f);
  assert.equal(s.canvas,'','미드 블록은 빈 판');assert.equal(s.pages,null);assert.deepEqual(s.tabs,[]);
  // ③ 완료·취소 없이 돌아갔다가 같은 국면에서 다시 연다 → 취소 — 작업 보드는 그대로
  await put(f,'B');
  await backToGameModel(page);
  f=await attach(page,1,'작전판 첨부');
  s=await look(f);assert.equal(s.cap,true);assert.equal(s.lent,true);assert.equal(s.canvas,'','다시 열면 빈 판');
  await barClick(f,'취소');await wait(1500);
  f=await boardFrame(page);s=await look(f);
  assert.deepEqual(s.pages,work.pages,'두 번 들어갔다 나와도 작업 보드 그대로');assert.equal(s.canvas,'X');assert.equal(s.idx,work.idx);assert.equal(s.undo,work.undo);
  assert.deepEqual(await stored(page),['A',null]);
  // ④ 미드 블록 첨부를 열어 둔 채 돌아가 전방 압박을 «▶ 보기» — 보기는 닫기뿐이고 어느 국면에도 적지 않는다
  f=await attach(page,1,'작전판 첨부');
  await backToGameModel(page);
  f=await attach(page,0,'보기');
  s=await look(f);
  assert.equal(s.canvas,'A','보기는 그 국면의 판');assert.deepEqual(s.bar,['닫기'],'보기에는 «첨부 완료»가 없다');assert.deepEqual(s.tabs,[]);
  await barClick(f,'닫기');await wait(1500);
  assert.deepEqual(await stored(page),['A',null],'보기는 다른 국면에 붙지 않는다');
  f=await boardFrame(page);s=await look(f);
  assert.deepEqual(s.pages,work.pages);assert.equal(s.canvas,'X');assert.equal(s.cap,false);assert.equal(s.lent,false);
  // 돌아온 작업 보드에서는 페이지를 다시 만들 수 있다
  assert.deepEqual(s.adds.slice(0,2),['＋ 페이지','미팅 세트']);
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,work:work.pages,stored:await stored(page)}));
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
