import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.325 — 일정에 가져온 작전판(보관함 type:"board")도 ▶ (제보 5d215b74 «만들어 둔 작전판을 새 일정에» · 10/20 bf084b34 의 약속).
// 합성 팀(셸 전체)에서: 보관함에 3페이지 작전판(장면 4 · 3 · 1)을 두고 → 일정 › 세션 채우기 › «보관함에서 가져오기»를 실제로 눌러 넣고 →
// 페이지 줄 셋 · ▶ 둘(장면 둘 이상인 페이지만) → «페이지 2» ▶ → 작전판이 보기 전용 슬라이드쇼로 그 페이지부터 →
// «발표 종료» → 보기가 닫히고 셸은 일정으로. 보관함 원본 · 작업 보드는 그대로(쓰기 없음). 실제 서버는 건드리지 않는다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
if(engine==='chromium'){SIZES.ipad.engine='chromium';SIZES.phone.engine='chromium';}
const fx=await startFixture(),browsers={},LIB='Vqa_sbp',DI=1;
const out={engine,size,passed:false,steps:[]};
const step=s=>out.steps.push(s);
try{
  const {page}=await openApp(fx,size,{browsers}),phone=size==='phone',touch=size!=='desktop';
  const hit=l=>touch?l.tap():l.click();
  await page.waitForTimeout(2500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof boardStore==='object'&&typeof window.__snapToThumb==='function'&&typeof window.__meetSlidesFromBoard==='function'&&typeof window.__psVaultOpenItem==='function'&&window.PSSchedBoardShow&&window.__boardReady&&window.__boardRestoreDone,null,{timeout:45000});
  // 1) 보관함에 3페이지 작전판 — 장면 4 · 3 · 1, 둘째 페이지는 이름 없음(«페이지 2»)
  await bf.evaluate(async lid=>{
    const snap=(x)=>({players:Array.from({length:4},(_,i)=>({id:i+1,team:i%2?'red':'blue',num:String(i+1),x:x+i*40,y:260+(i%3)*80})),equipment:[],drawings:[],ball:{x:555,y:370}});
    const fr=(k,x)=>Array.from({length:k},(_,j)=>({snap:snap(x+j*30)}));
    const pages=[{name:'1단계',snap:snap(300),anim:{frames:fr(4,300)}},{name:'',snap:snap(320),anim:{frames:fr(3,320)}},{name:'마무리',snap:snap(340),anim:{frames:fr(1,340)}}];
    const lib=(await boardStore.get('cs_drill_lib_v1'))||[],t=Date.now();
    lib.unshift({libId:lid,type:'board',name:'가상 빌드업',folder:'',snap:pages[0].snap,thumb:window.__snapToThumb(pages[0].snap),pages,frames:pages[0].anim.frames,tags:[],savedAt:t,editedAt:t,createdBy:'11111111-1111-4111-8111-111111111111'});
    await boardStore.set('cs_drill_lib_v1',lib);localStorage.setItem('cs_lib_rev',String(t));
  },LIB);
  const vaultItem=()=>bf.evaluate(async lid=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x&&x.libId===lid);return d?JSON.stringify({n:d.name,s:d.savedAt,e:d.editedAt,p:(d.pages||[]).map(p=>[p.name,(p.anim&&p.anim.frames||[]).length,JSON.stringify(p.snap)])}):null;},LIB);
  /* 작업 보드에 알아볼 수 있는 판을 두고(사람의 편집처럼 pushUndo 먼저) — 끝에 «보드» 탭에서 같은 판인지 본다.
     편집 번호(_boardPrivateEditSeq)는 보드로 돌아올 때 그리기만으로도 오른다(3.274 «거짓 변경 있음» — 3.275 되돌림 뒤 열린 문제) — 기록만 하고 견주지 않는다 */
  const showBoard=async()=>{await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-app="board"]');if(b)b.click();});
    await bf.waitForFunction(()=>(window.__csView||'board')==='board'&&!window.__vaultEdit&&window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
    await page.waitForTimeout(800);};
  await showBoard();
  await bf.evaluate(()=>{pushUndo();loadSnap({players:[{id:71,team:'blue',num:'7',x:211,y:333},{id:72,team:'red',num:'9',x:777,y:444}],equipment:[],drawings:[],ball:{x:500,y:300}});renderTokens();boardSaveLive();});
  const workBoard=()=>bf.evaluate(()=>({sig:JSON.stringify((captureSnap().players||[]).map(p=>[p.id,Math.round(p.x),Math.round(p.y)])),seq:typeof _boardPrivateEditSeq!=='undefined'?_boardPrivateEditSeq:null}));
  const stripText=()=>page.evaluate(()=>{const e=document.getElementById('psSyncStrip');return e?e.textContent.replace(/\s+/g,' ').trim():'';});
  const before={item:await vaultItem(),work:await workBoard()};
  assert.equal(before.work.sig,'[[71,211,333],[72,777,444]]','작업 보드에 판을 두었다');
  assert.ok(before.item,'보관함에 심었다');
  step('seeded');
  // 2) 일정 › 그 날 세션 › «보관함에서 가져오기»
  await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-team-hub]');if(b)b.click();});
  await page.evaluate(ph=>{const b=document.querySelector(ph?'#teamBottom [data-tb="training"]':'#teamNav [data-team-key="training"]');if(b)b.click();},phone);
  const pf=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await pf.waitForFunction(()=>typeof week!=='undefined'&&week&&week.length===7&&typeof wksFill==='function'&&window.PSSchedBoardPlay&&document.querySelectorAll('.wks-day').length===7,null,{timeout:30000});
  await pf.waitForFunction(lid=>{try{if(!window.__sbpAsk&&typeof psLibraryRefresh==='function'){window.__sbpAsk=1;psLibraryRefresh();}}catch(_){}return typeof libDrills==='function'&&libDrills().some(d=>d&&d.libId===lid);},LIB,{timeout:30000});
  const slot=await pf.evaluate(di=>{const t=week[di].trainings[0];wksFill(di,t.slot);return t.slot;},DI);
  const sheet=pf.locator('#sheet');
  await sheet.locator('#wfSec-lib').waitFor();
  await hit(sheet.locator('#wfSec-lib').getByRole('button',{name:'보관함에서 가져오기',exact:true}));
  const pick=sheet.locator('.lp-item',{hasText:'가상 빌드업'});
  await pick.waitFor({timeout:15000});
  await hit(pick);
  await pf.waitForFunction(di=>{const b=dayBoard(week[di]);return (b.trains||[]).indexOf('페이지 2')>=0;},DI,{timeout:15000});
  const lines=await pf.evaluate(({di,lid})=>{const b=dayBoard(week[di]);return (b.trains||[]).map((n,i)=>({n,idx:b.trainData[i]&&b.trainData[i].libIdx,lib:b.trainData[i]&&b.trainData[i].fromLib})).filter(x=>x.lib===lid);},{di:DI,lid:LIB});
  assert.deepEqual(lines.map(x=>[x.n,x.idx]),[['1단계',0],['페이지 2',1],['마무리',2]],'페이지 줄 셋 · 페이지 번호 '+JSON.stringify(lines));
  assert.equal(slot.length>0,true);
  step('imported');
  /* 담고 나면 «세션 채우기» 창으로 저절로 돌아온다(2.339 wksFillBack) — 그 창이 다시 선 뒤 사람처럼 «완료»로 닫는다
     (먼저 closeSheet 를 부르면 뒤늦게 다시 열린 창이 ▶ 를 덮었다 — 10번 중 1~2번) */
  await sheet.locator('#wfSec-lib').waitFor();
  await hit(sheet.getByRole('button',{name:'완료',exact:true}).last());
  await pf.waitForFunction(()=>!document.getElementById('scrim').classList.contains('show'),null,{timeout:10000});
  // 3) 주간 카드: ▶ 는 장면 둘 이상인 페이지 줄에만
  const plays=await pf.evaluate(di=>{const d=document.querySelectorAll('.wks-day')[di];return [...d.querySelectorAll('.wks-li')].filter(li=>/^(1단계|페이지 2|마무리)$/.test(li.getAttribute('title')||'')).map(li=>[li.getAttribute('title'),!!li.querySelector('.wks-play'),(li.querySelector('.wks-play')||{}).title||'']);},DI);
  assert.deepEqual(plays.map(x=>x.slice(0,2)),[['1단계',true],['페이지 2',true],['마무리',false]],'▶ '+JSON.stringify(plays));
  assert.match(plays[1][2],/3장면/);
  if(SHOTS){await pf.evaluate(di=>{const d=document.querySelectorAll('.wks-day')[di];if(d)d.scrollIntoView({block:'center'});},DI);await page.waitForTimeout(400);await page.screenshot({path:path.join(SHOTS,'sched-board-play-week-'+engine+'-'+size+'.png')});}
  step('play-buttons');
  await page.waitForTimeout(3000);out.stripBefore=await stripText();
  // 4) «페이지 2» ▶ — 작전판이 보기 전용 슬라이드쇼로 그 페이지부터
  const play=pf.locator('.wks-day').nth(DI).locator('.wks-li[title="페이지 2"] .wks-play');
  if(phone)await pf.evaluate(di=>document.querySelectorAll('.wks-day')[di].querySelector('.wks-li[title="페이지 2"] .wks-play').click(),DI);
  else await hit(play);
  await bf.waitForFunction(lid=>document.body.classList.contains('focus-board')&&document.body.classList.contains('meet-mode')&&window.__vvMeetLib===lid&&window.__meet&&window.__meet.idx()===1,LIB,{timeout:20000});
  const showing=await bf.evaluate(()=>({slides:window.__meet.frames().length,ro:!!window.__vaultReadOnly,view:!!window.__vaultViewMode,cur:window.__curVaultId||null,frames:anim.frames.length}));
  assert.deepEqual({slides:showing.slides,ro:showing.ro,view:showing.view,cur:showing.cur},{slides:3,ro:true,view:true,cur:null},'보기 전용 · 보관함 연결 없음 '+JSON.stringify(showing));
  assert.equal(showing.frames,3,'둘째 페이지의 장면 셋이 실렸다');
  assert.equal(await page.evaluate(()=>document.body.getAttribute('data-ps-app')),'design','쇼는 보관함 탭에서');
  // 장면이 실제로 넘어가는가(재생) — 시간 안에 장면 번호가 0 에서 움직이거나 재생 중
  // ▶ 로 왔으니 장면이 저절로 넘어간다(쇼의 «↻ 다시») — 장면 1 → 2 → 3
  await bf.waitForFunction(()=>animActive>=2,null,{timeout:10000});
  if(SHOTS)await page.screenshot({path:path.join(SHOTS,'sched-board-play-'+engine+'-'+size+'.png')});
  step('show');
  // 5) «발표 종료» → 보기가 닫히고 셸은 일정으로
  await bf.evaluate(()=>{const x=document.querySelector('#meetNav .mn-exit');if(x)x.click();});
  await bf.waitForFunction(()=>!document.body.classList.contains('focus-board')&&!window.__vaultViewMode&&!document.body.classList.contains('meet-mode'),null,{timeout:10000});
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='process',null,{timeout:10000});
  step('back-to-schedule');
  out.stripShow=await stripText();
  // 6) 보관함 원본 · 작업 보드는 그대로
  await page.waitForTimeout(1500);
  assert.equal(await vaultItem(),before.item,'보관함 원본 그대로');
  await showBoard();
  const after=await workBoard();out.seq=[before.work.seq,after.seq];
  assert.equal(after.sig,before.work.sig,'작업 보드 그대로 '+JSON.stringify(after));
  await page.evaluate(ph=>{const b=document.querySelector('#appSeg [data-team-hub]');if(b)b.click();const t=document.querySelector(ph?'#teamBottom [data-tb="training"]':'#teamNav [data-team-key="training"]');if(t)t.click();},phone);
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='process',null,{timeout:10000});
  // 7) 다시 ▶ — 한 번 더 열고 닫아도 같다(감시가 한 번만 · 남지 않음)
  if(phone)await pf.evaluate(di=>document.querySelectorAll('.wks-day')[di].querySelector('.wks-li[title="1단계"] .wks-play').click(),DI);
  else await hit(pf.locator('.wks-day').nth(DI).locator('.wks-li[title="1단계"] .wks-play'));
  await bf.waitForFunction(lid=>document.body.classList.contains('focus-board')&&window.__vvMeetLib===lid&&window.__meet.idx()===0,LIB,{timeout:20000});
  await bf.evaluate(()=>document.querySelector('#meetNav .mn-exit').click());
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='process',null,{timeout:10000});
  assert.equal(await vaultItem(),before.item,'두 번째도 원본 그대로');
  step('again');
  /* 상태 줄은 기록만 — 닫고 돌아오면 작업 보드 초안이 보관함 화면(session)에 막혀 «확인 중»으로 남는다(기존 훈련 ▶ 도 같다 · 3.274 거짓 변경과 같은 뿌리 · 이 판은 안 고침) */
  await page.waitForTimeout(3000);out.stripEnd=await stripText();
  out.passed=true;
  console.log(JSON.stringify(out));
}catch(e){
  console.error('[sched-board-play-3325] failure',JSON.stringify(out));console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
