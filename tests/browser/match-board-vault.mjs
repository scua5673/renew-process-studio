import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.965 — 사용자 «경기 준비에 보드가 따로 있는 게 아니고 보관함에 있는 거 가져와서 바로 보일 수 있게».
// 합성 팀(셸 전체)에서: 경기 준비의 «경기 보드»가 보관함 미팅·작전판을 가져와 그 자리에서 띄우고(넘기기·크게 보기),
// «편집 ›»은 보관함으로, 보관함의 «‹ 경기 준비로»는 그 경기로 돌아오며, «＋ 새 미팅»은 기본 9장을 붙여 경기에 이은 채 만든다.
// 옛 경기 준비 보드(운동장)는 접혀 있고 명단(선발·리저브)은 남는다. 실제 서버는 건드리지 않는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  const board=async()=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await f.waitForFunction(()=>typeof window.__meetingSetMatch==='function'&&typeof window.__snapToThumb==='function'&&typeof store==='object');return f;};
  // 1) 보관함에 미팅(3장)·작전판(1장) — 그림은 작전판이 실제로 그린 썸네일
  let bf=await board();
  await bf.evaluate(async()=>{
    const snap=(n,x)=>({players:Array.from({length:n},(_,i)=>({id:i+1,team:i%2?'red':'blue',num:String(i+1),x:x+i*38,y:250+(i%3)*90})),equipment:[],drawings:[],ball:{x:555,y:370}});
    const sl=[['가상 1장',['첫 줄']],['가상 2장',['압박 시작','라인 높이']],['가상 3장',[]]].map((t,i)=>{const s=snap(4+i*3,240+i*60);return {pdfOrientation:'landscape',snap:s,thumb:window.__snapToThumb(s),title:t[0],points:t[1]};});
    const b=snap(6,300);
    const lib=(await store.get('cs_drill_lib_v1'))||[];
    lib.unshift({libId:'Vqa_meet',type:'meeting',name:'가상 미팅',folder:'',thumb:sl[0].thumb,snap:sl[0].snap,slides:sl,tags:[],savedAt:Date.now(),createdBy:'11111111-1111-4111-8111-111111111111'},
                {libId:'Vqa_board',type:'board',name:'가상 작전판',folder:'',thumb:window.__snapToThumb(b),snap:b,tags:[],savedAt:Date.now()-1000,createdBy:'11111111-1111-4111-8111-111111111111'});
    await store.set('cs_drill_lib_v1',lib);try{localStorage.setItem('cs_lib_rev',String(Date.now()));}catch(_){}
  });
  // 2) 팀 › 경기 › 이번 주 토요일 경기(일정에서 만들어진 것) › 경기 준비
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchLoad==='function'&&(matchLoad().matches||[]).some(m=>/가상 상대 FC/.test(m.opponent||'')),null,{timeout:30000});
  const mid=await sf.evaluate(()=>{const m=matchLoad().matches.find(x=>/가상 상대 FC/.test(x.opponent||''));setView('match');matchOpen(m.id);matchTab='prep';matchStage='prep';renderMatch();return m.id;});
  await sf.waitForSelector('#matchMeetCard:not([hidden]) .mmv-empty',{timeout:15000});
  const pitchShown=()=>sf.evaluate(()=>{const p=document.getElementById('mb2Pitch');return !!p&&getComputedStyle(p).display!=='none';});
  assert.equal(await pitchShown(),false,'옛 경기 준비 보드(운동장)는 접혀 있다');
  assert.ok(await sf.evaluate(()=>document.querySelectorAll('#mb2SquadTray .mb2-chip,#mb2Tray .mb2-chip').length>0),'명단(우리 팀 · 선발/리저브)은 남는다');
  assert.equal(await sf.evaluate(()=>document.querySelector('#matchMeetCard .match-card-head b').textContent),'경기 보드');
  // 3) 보관함에서 가져오기 — 미팅·작전판 둘 다, 작은 그림과 함께
  await sf.click('#matchMeetCard .mmv-empty [data-mm-link]');
  await sf.waitForSelector('#mmSheetOv .mm-pick');
  const sheet=await sf.evaluate(()=>({labs:[...document.querySelectorAll('#mmSheetOv .mm-lab')].map(e=>e.textContent),picks:[...document.querySelectorAll('#mmSheetOv .mm-pick b')].map(e=>e.textContent),thumbs:document.querySelectorAll('#mmSheetOv .mm-pt svg').length}));
  assert.deepEqual(sheet.labs,['미팅','작전판'],'가져오기 목록은 미팅·작전판 두 묶음');
  assert.ok(sheet.picks.includes('가상 미팅')&&sheet.picks.includes('가상 작전판'),JSON.stringify(sheet));
  assert.ok(sheet.thumbs>=2,'작은 그림으로 고른다');
  await sf.click('#mmSheetOv .mm-pick[data-mm-lib="Vqa_board"]');
  await sf.waitForFunction(()=>document.querySelector('#matchMeetCard .mmv[data-mmv="Vqa_board"] .mmv-svg svg'),null,{timeout:15000});
  bf=await board();
  assert.equal(await bf.evaluate(async id=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(x=>x.libId==='Vqa_board');return d&&d.matchRef&&d.matchRef.mid;},mid),mid,'연결은 자료 쪽(matchRef)에 — 작전판도 잇는다');
  // 미팅도 가져온다 → 탭 둘, 방금 가져온 것이 열린다
  await sf.click('#matchMeetActs [data-mm-link]');await sf.waitForSelector('#mmSheetOv .mm-pick[data-mm-lib="Vqa_meet"]');
  await sf.click('#mmSheetOv .mm-pick[data-mm-lib="Vqa_meet"]');
  await sf.waitForFunction(()=>document.querySelector('#matchMeetCard .mmv[data-mmv="Vqa_meet"]')&&document.querySelectorAll('#matchMeetCard .mmv-tabs button').length===2,null,{timeout:15000});
  // 4) 그 자리에서 넘기기
  const view=()=>sf.evaluate(()=>{const c=document.getElementById('matchMeetCard');const vb=(c.querySelector('.mmv-svg svg')||{getAttribute:()=>''}).getAttribute('viewBox');
    return {count:c.querySelector('.mmv-count').textContent,title:c.querySelector('.mmv-title').textContent,pts:[...c.querySelectorAll('.mmv-pts li')].map(e=>e.textContent),on:+(c.querySelector('.mmv-th.on')||{}).getAttribute?.('data-mmv-i'),vb,stage:Math.round(c.querySelector('.mmv-stage').getBoundingClientRect().width),card:Math.round(c.getBoundingClientRect().width)};});
  let v=await view();
  assert.equal(v.count,'1 / 3');assert.equal(v.title,'가상 1장');assert.deepEqual(v.pts,['첫 줄']);
  await sf.click('#matchMeetCard .mmv-nav.next');v=await view();
  assert.equal(v.count,'2 / 3');assert.equal(v.title,'가상 2장');assert.deepEqual(v.pts,['압박 시작','라인 높이']);assert.equal(v.on,1,'아래 줄도 같은 장');
  await sf.click('#matchMeetCard .mmv-th[data-mmv-i="2"]');v=await view();assert.equal(v.count,'3 / 3');
  assert.ok(v.stage<=v.card,'그림 칸이 카드 안 '+JSON.stringify(v));
  await page.screenshot({path:path.join(SHOTS,'match-board-vault-'+size+'.png')});
  // 5) 크게 보기 — 화면을 떠나지 않는다
  await sf.click('#matchMeetCard .mmv-big');await sf.waitForSelector('#mmBig .mb-svg svg');
  assert.equal(await sf.evaluate(()=>document.querySelector('#mmBig .mb-cnt').textContent),'3 / 3');
  await sf.click('#mmBig .mb-nav.prev');assert.equal(await sf.evaluate(()=>document.querySelector('#mmBig .mb-cnt').textContent),'2 / 3');
  await page.screenshot({path:path.join(SHOTS,'match-board-vault-big-'+size+'.png')});
  await sf.click('#mmBig .mb-x');await sf.waitForFunction(()=>!document.getElementById('mmBig'));
  assert.equal((await view()).count,'2 / 3','크게 보기에서 넘긴 자리를 이어 간다');
  // 6) «편집 ›» → 보관함 → «‹ 경기 준비로» 한 번에
  await sf.click('#matchMeetCard .mmv-acts [data-mm-open]');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='design',null,{timeout:15000});
  bf=await board();
  await bf.waitForFunction(()=>{const b=document.getElementById('vCreateBackMatch');return b&&b.style.display!=='none'&&/경기 준비로/.test(b.textContent);},null,{timeout:15000});
  assert.match(await bf.evaluate(()=>document.getElementById('vCreateBackMatch').textContent),/가상 상대 FC전 경기 준비로/);
  await bf.click('#vCreateBackMatch');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')!=='design',null,{timeout:15000});
  await sf.waitForFunction(id=>typeof matchCurrent!=='undefined'&&matchCurrent===id,mid,{timeout:15000});
  // 작전판도 같은 길 — 슬라이드쇼 없이 «편집 ›», 보관함에서 «‹ 경기 준비로»
  await sf.waitForSelector('#matchMeetCard .mmv-tabs [data-mmv-lib="Vqa_board"]');await sf.click('#matchMeetCard .mmv-tabs [data-mmv-lib="Vqa_board"]');
  await sf.waitForSelector('#matchMeetCard .mmv[data-mmv="Vqa_board"]');
  assert.equal(await sf.evaluate(()=>!!document.querySelector('#matchMeetCard .mmv-acts [data-mm-show]')),false,'작전판은 슬라이드쇼 버튼이 없다');
  assert.equal(await sf.evaluate(()=>document.querySelector('#matchMeetCard .mmv-count').textContent),'1 / 1');
  await sf.click('#matchMeetCard .mmv-acts [data-mm-open]');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='design',null,{timeout:15000});
  bf=await board();await bf.waitForFunction(()=>{const b=document.getElementById('vCreateBackMatch');return b&&b.style.display!=='none';},null,{timeout:15000});
  await bf.click('#vCreateBackMatch');await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')!=='design',null,{timeout:15000});
  // 7) «＋ 새 미팅» — 기본 9장을 붙여, 경기에 이은 채
  await sf.waitForSelector('#matchMeetActs [data-mm-new]');await sf.click('#matchMeetActs [data-mm-new]');
  await sf.waitForSelector('#mmSheetOv [data-mm-part="tpl"]');
  const mk=await sf.evaluate(()=>({tpl:document.querySelector('#mmSheetOv [data-mm-part="tpl"]').checked,go:document.querySelector('#mmSheetOv [data-mm-go]').textContent}));
  assert.ok(mk.tpl,'기본 9장은 처음부터 골라져 있다');
  const n=+(/슬라이드 (\d+)장/.exec(mk.go)||[])[1];assert.ok(n>=9,mk.go);
  await sf.click('#mmSheetOv [data-mm-go]');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='design',null,{timeout:15000});
  bf=await board();
  /* waitForFunction 은 Promise 를 참으로 본다 — 보관함 읽기는 직접 되풀이 */
  for(let t=0;t<60;t++){ if(await bf.evaluate(async id=>((await store.get('cs_drill_lib_v1'))||[]).some(d=>d.type==='meeting'&&d.libId!=='Vqa_meet'&&d.matchRef&&d.matchRef.mid===id),mid))break; await page.waitForTimeout(250); }
  const made=await bf.evaluate(async id=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(d=>d.type==='meeting'&&d.libId!=='Vqa_meet'&&d.matchRef&&d.matchRef.mid===id);return {n:d.slides.length,titles:d.slides.map(s=>s.title),thumbs:d.slides.filter(s=>/<svg/.test(s.thumb||'')).length};},mid);
  assert.equal(made.n,n,'고른 만큼 '+JSON.stringify(made));
  assert.ok(made.titles.includes('하이블록')&&made.titles.includes('코너킥 공격'),'기본 9장이 붙는다 '+JSON.stringify(made.titles));
  assert.equal(made.thumbs,made.n,'장마다 그림');
  await bf.waitForFunction(()=>{const b=document.getElementById('vCreateBackMatch');return b&&b.style.display!=='none';},null,{timeout:15000});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,made}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
