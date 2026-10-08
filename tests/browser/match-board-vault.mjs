import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.965 — 사용자 «경기 준비에 보드가 따로 있는 게 아니고 보관함에 있는 거 가져와서 바로 보일 수 있게».
// 합성 팀(셸 전체)에서: 경기 준비의 «경기 보드»가 보관함 미팅·작전판을 가져와 그 자리에서 띄우고(넘기기·크게 보기),
// «편집 ›»은 보관함으로, 보관함의 «‹ 경기 준비로»는 그 경기로 돌아오며, «＋ 새 미팅»은 기본 9장을 붙여 경기에 이은 채 만든다.
// 옛 경기 준비 보드(운동장)는 접혀 있고 명단(선발·리저브)은 남는다. 실제 서버는 건드리지 않는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'phone':'desktop');   // PS_SIZE=ipad 로 아이패드 폭도
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
  // 6) 2.966 — «편집 ›»은 경기 준비 안에서: 팀 머리·경기 탭은 그대로, 그 아래 보관함 편집기. «완료»는 경기 준비의 같은 자리로
  const inMatchEdit=()=>page.evaluate(()=>({app:document.body.getAttribute('data-ps-app'),me:document.body.classList.contains('ps-match-edit'),team:document.body.classList.contains('ps-team-open'),
    tab:(document.querySelector('#teamNav [data-team-key="match"]')||{classList:{contains:()=>false}}).classList.contains('on'),wait:document.body.classList.contains('ps-me-wait'),
    bottom:(()=>{const b=document.getElementById('teamBottom');return !!b&&getComputedStyle(b).display!=='none';})()}));
  const scrollY0=await sf.evaluate(()=>{const c=document.getElementById('matchMeetCard');c.scrollIntoView({block:'center'});return Math.round(window.scrollY||document.scrollingElement.scrollTop||0);});
  await sf.click('#matchMeetCard .mmv-acts [data-mm-open]');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='design'&&!document.body.classList.contains('ps-me-wait'),null,{timeout:15000});
  let me=await inMatchEdit();
  assert.ok(me.me&&me.team&&me.tab,'경기 준비 안 편집 — 팀 화면·경기 탭 그대로 '+JSON.stringify(me));
  if(size==='phone')assert.equal(me.bottom,false,'폰은 팀 하단 탭을 접는다(편집기 아래 줄 자리)');
  bf=await board();
  await bf.waitForFunction(()=>document.body.classList.contains('vc-match')&&document.getElementById('vCreateBar').classList.contains('on'),null,{timeout:15000});
  const bar=await bf.evaluate(()=>({back:document.getElementById('vCreateBackMatch').textContent,title:document.getElementById('vCreateTitle').textContent,done:document.getElementById('vCreateCancel').textContent,
    parts:getComputedStyle(document.getElementById('vCreateParts')).display!=='none',flow:getComputedStyle(document.getElementById('vCreateFlow')).display,view:window.__csView,top:Math.round(document.getElementById('vCreateBar').getBoundingClientRect().top),barH:Math.round(document.getElementById('vCreateBar').getBoundingClientRect().height),
    ksTop:(()=>{const k=document.getElementById('ksTop');return k?Math.round(k.getBoundingClientRect().top):null;})(),kssave:(()=>{const k=document.querySelector('#ksTop .kssave');return !!k&&getComputedStyle(k).display!=='none';})()}));
  assert.equal(bar.back,size==='phone'?'‹ 경기 준비':'‹ 가상 상대 FC전 경기 준비');assert.equal(bar.kssave,false,'편집기 위 «보관함 저장»은 숨긴다(자동 저장 · «완료»)');
  assert.ok(bar.barH<=60,'띠는 한 줄 '+JSON.stringify(bar));if(bar.ksTop!=null)assert.ok(bar.ksTop>=bar.top+bar.barH-1,'띠가 편집기 도구줄을 덮지 않는다 '+JSON.stringify(bar));assert.equal(bar.title,'가상 미팅','띠 = 자료 이름');assert.equal(bar.done,'완료');
  assert.ok(bar.parts,'«경기 자료 넣기»');assert.equal(bar.flow,'none','만들기 단계 줄은 없다');assert.equal(bar.view,'meeting');
  const frameTop=await page.evaluate(()=>Math.round(document.getElementById('fBoard').getBoundingClientRect().top));
  assert.ok(frameTop>=40,'편집기가 팀 머리 아래에 선다 '+frameTop);
  await page.screenshot({path:path.join(SHOTS,'match-meeting-inplace-open-'+size+'.png')});
  await bf.click('#vCreateCancel');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='scout'&&!document.body.classList.contains('ps-match-edit'),null,{timeout:15000});
  assert.equal(await sf.evaluate(()=>matchCurrent),mid,'같은 경기');
  const scrollY1=await sf.evaluate(()=>Math.round(window.scrollY||document.scrollingElement.scrollTop||0));
  assert.ok(Math.abs(scrollY1-scrollY0)<=4,'보던 자리 그대로 '+scrollY0+'→'+scrollY1);
  assert.equal(await bf.evaluate(()=>document.body.classList.contains('vc-match')||document.getElementById('vCreateBar').classList.contains('on')),false,'편집기는 닫혔다');
  // 작전판도 같은 자리에서 — 저장은 «저장하고 나가기»가 따로, «‹ 경기 준비»로 돌아온다
  await sf.waitForSelector('#matchMeetCard .mmv-tabs [data-mmv-lib="Vqa_board"]');await sf.click('#matchMeetCard .mmv-tabs [data-mmv-lib="Vqa_board"]');
  await sf.waitForSelector('#matchMeetCard .mmv[data-mmv="Vqa_board"]');
  assert.equal(await sf.evaluate(()=>!!document.querySelector('#matchMeetCard .mmv-acts [data-mm-show]')),false,'작전판은 슬라이드쇼 버튼이 없다');
  await sf.click('#matchMeetCard .mmv-acts [data-mm-open]');
  await page.waitForFunction(()=>document.body.classList.contains('ps-match-edit'),null,{timeout:15000});
  bf=await board();await bf.waitForFunction(()=>document.body.classList.contains('vc-match'),null,{timeout:15000});
  assert.equal(await bf.evaluate(()=>getComputedStyle(document.getElementById('vCreateParts')).display),'none','작전판엔 «경기 자료 넣기»가 없다');
  await bf.click('#vCreateBackMatch');await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='scout',null,{timeout:15000});
  // 다른 탭으로 가면 경기 준비 안 편집을 내려놓는다
  await sf.waitForSelector('#matchMeetCard .mmv-tabs [data-mmv-lib="Vqa_meet"]');await sf.click('#matchMeetCard .mmv-tabs [data-mmv-lib="Vqa_meet"]');
  await sf.click('#matchMeetCard .mmv-acts [data-mm-open]');
  await page.waitForFunction(()=>document.body.classList.contains('ps-match-edit'),null,{timeout:15000});
  await page.evaluate(()=>{const b=document.querySelector('#teamNav [data-team-key="today"]')||document.querySelector('#teamBottom [data-tb="today"]');if(b)b.click();});
  await page.waitForFunction(()=>!document.body.classList.contains('ps-match-edit')&&document.body.getAttribute('data-ps-app')==='scout',null,{timeout:15000});
  bf=await board();await bf.waitForFunction(()=>!document.body.classList.contains('vc-match'),null,{timeout:15000});
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  await sf.evaluate(id=>{setView('match');matchOpen(id);matchTab='prep';matchStage='prep';renderMatch();},mid);
  // 7) «＋ 새 미팅» — 시트 없이 바로 만들고 그 자리에서 연다(기본 9장 + 선발 11)
  await sf.waitForSelector('#matchMeetActs [data-mm-new]');await sf.click('#matchMeetActs [data-mm-new]');
  assert.equal(await sf.evaluate(()=>!!document.getElementById('mmSheetOv')),false,'시트를 거치지 않는다');
  await page.waitForFunction(()=>document.body.classList.contains('ps-match-edit')&&document.body.getAttribute('data-ps-app')==='design',null,{timeout:15000});
  bf=await board();
  let newId=null;
  for(let t=0;t<60;t++){ newId=await bf.evaluate(async id=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(d=>d.type==='meeting'&&d.libId!=='Vqa_meet'&&d.matchRef&&d.matchRef.mid===id);return d?d.libId:null;},mid); if(newId)break; await page.waitForTimeout(250); }
  assert.ok(newId,'보관함에 저장됐다');
  const lib=()=>bf.evaluate(async id=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(x=>x.libId===id);return {name:d.name,folder:d.folder,n:d.slides.length,titles:d.slides.map(s=>s.title),thumbs:d.slides.filter(s=>/<svg/.test(s.thumb||'')).length};},newId);
  const made=await lib();
  assert.equal(made.name,'가상 상대 FC전 미팅');assert.ok(made.n===9,'기본 9장(선발 11 이 있으면 그것이 BEST 11 자리) '+JSON.stringify(made));
  assert.ok(made.titles.includes('하이블록')&&made.titles.includes('코너킥 공격'),JSON.stringify(made.titles));assert.equal(made.thumbs,made.n,'장마다 그림');
  await bf.waitForFunction(id=>window.__curVaultId===id&&document.body.classList.contains('vc-match')&&window.__csView==='meeting',newId,{timeout:15000});
  // «경기 자료 넣기» — 표지를 골라 뒤에 붙인다 → 보관함에 자동 저장
  await bf.click('#vCreateParts');await bf.waitForSelector('#mpPartsOv input[data-k]');
  const rows=await bf.evaluate(()=>[...document.querySelectorAll('#mpPartsOv label')].map(l=>({b:l.querySelector('b').textContent,dis:l.querySelector('input').disabled})));
  assert.ok(rows.some(r=>r.b==='표지'&&!r.dis),JSON.stringify(rows));
  await bf.evaluate(()=>{const l=[...document.querySelectorAll('#mpPartsOv label')].find(l=>l.querySelector('b').textContent==='표지');l.querySelector('input').click();});
  assert.match(await bf.evaluate(()=>document.querySelector('#mpPartsOv [data-mp-go]').textContent),/슬라이드 1장 넣기/);
  await bf.click('#mpPartsOv [data-mp-go]');
  let after=made;for(let t=0;t<40;t++){ after=await lib(); if(after.n===made.n+1)break; await page.waitForTimeout(250); }
  assert.equal(after.n,made.n+1,'넣은 장이 보관함에 저장됐다');assert.match(after.titles[after.n-1],/^vs 가상 상대 FC/);
  // 이름 — 띠의 이름을 눌러 바꾼다(한글 조합 Enter 가 끝 글자를 자르지 않게 확인 버튼으로)
  await bf.click('#vCreateTitle');await bf.waitForFunction(()=>{const i=[...document.querySelectorAll('input[type=text]')].pop();return !!i&&i.offsetParent!==null&&i.value==='가상 상대 FC전 미팅';},null,{timeout:15000});
  await bf.evaluate(()=>{const i=[...document.querySelectorAll('input[type=text]')].pop();i.value='송도전 미팅 최종';});
  await bf.evaluate(()=>{[...document.querySelectorAll('button')].filter(b=>b.textContent==='확인').pop().click();});
  for(let t=0;t<40;t++){ after=await lib(); if(after.name==='송도전 미팅 최종')break; await page.waitForTimeout(150); }
  assert.equal(after.name,'송도전 미팅 최종');assert.equal(await bf.evaluate(()=>document.getElementById('vCreateTitle').textContent),'송도전 미팅 최종');
  await page.screenshot({path:path.join(SHOTS,'match-meeting-inplace-new-'+size+'.png')});
  // «완료» → 경기 준비, 방금 만든 미팅이 경기 보드에
  await bf.click('#vCreateCancel');
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='scout',null,{timeout:15000});
  await sf.waitForFunction(id=>!!document.querySelector('#matchMeetCard .mmv[data-mmv="'+id+'"]'),newId,{timeout:15000});
  assert.match(await sf.evaluate(()=>document.querySelector('#matchMeetCard .mmv-meta').textContent),/송도전 미팅 최종/);
  assert.equal(await sf.evaluate(()=>document.querySelector('#matchMeetCard .mmv-count').textContent),'1 / '+(made.n+1));
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,made:made.n}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
