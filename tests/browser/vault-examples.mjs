import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 2.999 — 보관함 «프로세스» 폴더(사용자 «보관함에 예시로 전부 하나씩 — 훈련도 미팅도 세트피스도 · 처음 들어온 사람들이 잘 볼 수 있게 · 제대로 만들어줘 조사해서»
// · «프로세스 폴더를 따로 만들어서 거기에 다 넣어줘 기본으로 있는것 처럼» · «모든 사용자에게 한 번씩»).
// 보관함을 열면 «프로세스» 폴더에 종류별 예시 다섯이 한 번 들어온다 — 이미 자료가 있는 사람도. 내 자료가 앞에 서고, 보던 화면은 그대로.
// 담긴 예시는 그 종류의 편집 화면에서 제대로 열린다 — 패턴북(국면 지도 · 시퀀스 · 단계) · 훈련(탭 셋 · 탭마다 장면) · 세트피스(세트피스 판) · 작전판(페이지 둘) · 미팅(슬라이드 다섯).
// 지운 예시는 다시 생기지 않는다(이 기기 표식 · 지운 기록) · ＋ 만들기 창의 «예시 담기»로 다시 담는다.
// 크롬 = 데스크톱, 웹킷 = 아이패드(손가락). 합성 팀 fixture(팀 공간 · 임원)에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof renderTokens==='function');
  const shot=n=>page.screenshot({path:path.join(SHOTS,`vault-examples-${engine}-${size}-${n}.png`)});
  const noErrors=()=>{ const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],JSON.stringify(errs)); };
  const lib=()=>bf.evaluate(async()=>((await libGet())||[]).map(d=>({ex:d.ex||'',type:d.type,book:d.book||0,name:d.name,folder:d.folder,by:!!d.createdBy,libId:d.libId,savedAt:d.savedAt,thumb:!!d.thumb})));
  const waitLib=async n=>{ for(let t=0;t<80&&(await lib()).length!==n;t++)await page.waitForTimeout(250); return lib(); };
  const openVault=async()=>{ await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click()); await bf.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:12000}); };
  /* 나가기 — 시퀀스·페이지를 넘겨 보면 «버리고 나갈까요?»가 뜬다(모든 작전판의 옛 동작) — 뜨면 «확인» */
  const exitBoard=async()=>{ await bf.evaluate(()=>document.getElementById('vCreateCancel').click()); await page.waitForTimeout(500);
    await bf.evaluate(()=>{ const ok=[...document.querySelectorAll('button')].filter(b=>b.textContent==='확인'&&b.offsetParent).pop(); if(ok)ok.click(); });
    await bf.waitForFunction(()=>window.__csView==='session'&&!document.body.classList.contains('book-mode'),null,{timeout:12000}); await page.waitForTimeout(400); };
  const dirty=()=>bf.evaluate(()=>({manual:!!window.__vaultManualDirty,sub:(document.getElementById('vCreateSub')||{}).textContent||''}));
  const openCard=async name=>{ await bf.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),name,{timeout:12000});
    await bf.evaluate(n=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n)); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click(); },name); };

  // ── 1. 이미 자료가 있는 코치 — 보관함을 열면 «프로세스» 폴더에 예시 다섯이 한 번 들어온다. 내 자료가 앞에, 보던 화면 그대로 ──
  await bf.waitForFunction(()=>{ try{ return psVaultUnlocked()&&!!psMyUid(); }catch(_){ return false; } },null,{timeout:15000});
  const uid=await bf.evaluate(()=>psMyUid());
  const pxId=k=>'Vpx'+uid.replace(/[^a-z0-9]/gi,'').slice(0,12)+'-'+k;
  await bf.evaluate(async()=>{ const lib=await libGet(); lib.unshift({libId:'VMINE',type:'board',name:'내 작전판',folder:'',thumb:'',tags:[],savedAt:Date.now(),
    snap:{players:[{id:1,team:'blue',num:'9',pos:'',x:500,y:300}],equipment:[],drawings:[],ball:null,pitchN:1}}); stampCreator(lib[0]); await libWrite(lib); libTouch(); });
  await openVault();
  let L=await waitLib(6);
  console.log('seeded',JSON.stringify(L.map(x=>[x.ex,x.libId,x.folder,new Date(x.savedAt).toISOString().slice(0,10)])));
  assert.equal(L.length,6,'five examples joined my board');
  const exs=L.filter(x=>x.ex);
  assert.deepEqual(exs.map(x=>x.ex),['book','train','setpiece','board','meeting'],'in the order a newcomer should meet them');
  assert.deepEqual(exs.map(x=>x.libId),['book','train','setpiece','board','meeting'].map(pxId),'a fixed number per user — two devices meet on one row');
  assert.ok(exs.every(x=>x.folder==='프로세스'&&x.by&&x.savedAt<Date.UTC(2026,0,2)),'«프로세스», stamped, an old date');
  assert.ok(exs.every(x=>x.thumb),'card pictures are drawn on the way in');
  await bf.waitForFunction(()=>document.querySelectorAll('#drillFiles .vcard').length===6,null,{timeout:12000}); await page.waitForTimeout(400);
  const view=await bf.evaluate(()=>({folder:libFilter.folder,first:(document.querySelector('#drillFiles .vcard')||{}).textContent||'',seeded:Object.keys(JSON.parse(localStorage.getItem('ps_vault_px_v1')||'{}')).length,
    side:[...document.querySelectorAll('button,a,div,span')].some(e=>e.childElementCount===0&&(e.textContent||'').trim()==='프로세스')}));
  console.log('view',JSON.stringify({...view,first:view.first.slice(0,40)}));
  assert.equal(view.folder,'__mine','an existing coach keeps the view they had'); assert.match(view.first,/내 작전판/,'my own work stays on top');
  assert.equal(view.seeded,1,'marked once for this user and workspace'); assert.equal(view.side,true,'the «프로세스» folder is listed');
  // 미리보기 — 패턴북을 고르면 첫 시퀀스 그림. 그림 안의 공(안쪽 svg)이 칸을 덮지 않는다
  await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('우리 팀 패턴북')); (c.querySelector('.vc-name,.vc-nm,b')||c).click(); });
  await bf.waitForFunction(()=>!!document.querySelector('.vx-preview-thumb svg'),null,{timeout:12000}); await page.waitForTimeout(500);
  assert.equal(await bf.evaluate(()=>[...document.querySelectorAll('.vx-preview-thumb svg svg')].filter(e=>e.getBoundingClientRect().width>40).length),0,'no giant ball over the preview');
  await shot('1-seeded');
  // 다시 그려도 두 벌이 되지 않는다
  await bf.evaluate(()=>renderDrillFiles()); await page.waitForTimeout(1200); assert.equal((await lib()).length,6);

  // ── 2. 패턴북 — 국면 지도로 열리고, 열기만 해서는 «변경 있음»이 아니다 ──
  await openCard('우리 팀 패턴북 — 4-3-3');
  await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultBook&&window.__psPages.book.count()===6&&window.__bkMap&&window.__bkMap.on(),null,{timeout:15000});
  await page.waitForTimeout(900);
  const map=await bf.evaluate(()=>({cols:[...document.querySelectorAll('#bkMap .bkm-c h3')].map(h=>h.textContent),
    cells:[...document.querySelectorAll('#bkMap .bkm-cell')].filter(c=>c.querySelector('.bkm-s')).map(c=>(c.getAttribute('data-ph')||'')+':'+c.querySelectorAll('.bkm-s').length)}));
  console.log('map',JSON.stringify(map)); await shot('2-book-map');
  assert.deepEqual(map.cols,['공격 조직2','수비 조직1','공격 → 수비 전환1','수비 → 공격 전환1','경합 · 세컨드 볼0','세트피스1']);
  assert.deepEqual(map.cells,['std_ao_1:1','std_ao_3:1','std_do_1:1','std_dt_1:1','std_at_1:1','std_set_2:1'],'every sequence sits in its sub-phase cell');
  await page.waitForTimeout(1500);
  assert.deepEqual(await dirty(),{manual:false,sub:'· 저장 버튼을 눌러야 저장됩니다'},'opening is not editing');
  await bf.evaluate(()=>document.querySelector('#bkMap .bkm-s[data-i="2"]').click()); await page.waitForTimeout(900);
  const sq=await bf.evaluate(()=>({idx:window.__psPages.book.idx(),name:document.getElementById('bkName')&&document.getElementById('bkName').value,frames:anim.frames.length,
    stages:[...document.querySelectorAll('#bkStg .bk-st')].map(s=>((s.querySelector('.bk-sn')||{}).value??(s.querySelector('.bk-sv')||{}).textContent)),theme:document.documentElement.dataset.pitch}));
  console.log('seq',JSON.stringify(sq)); await shot('3-book-seq');
  assert.deepEqual([sq.idx,sq.name,sq.frames],[2,'풀백 패스가 신호 — 측면에 가두기',3]); assert.deepEqual(sq.stages,['신호','가두기','탈취']); assert.equal(sq.theme,'grass');
  await exitBoard();

  // ── 3. 훈련 — 탭 셋, 탭마다 제 판 · 제 장면 · 방법 · 코칭 포인트 ──
  await bf.evaluate(i=>openLibDrawEditor(i,false),pxId('train'));
  await bf.waitForFunction(()=>document.getElementById('editorModal').classList.contains('on')&&document.querySelectorAll('#trainingStrip .tr-tab').length===3,null,{timeout:12000});
  const tabs=[];
  for(const i of [0,1,2]){ if(i)await bf.evaluate(k=>switchTraining(k),i); await page.waitForTimeout(800);
    tabs.push(await bf.evaluate(()=>({spec:state.pitchSpec,players:state.players.length,scenes:document.querySelectorAll('#animFrames .anim-frame').length,fields:[...document.querySelectorAll('#epFields textarea')].map(t=>t.value.split('\n')[0])})));
    await shot('4-train-'+i); }
  console.log('train',JSON.stringify(tabs.map(t=>[t.spec,t.players,t.scenes])));
  assert.deepEqual(tabs.map(t=>[t.spec,t.players,t.scenes]),[['grid20',6,4],['grid30',11,4],['fifa',14,4]]);
  assert.ok(tabs.every(t=>t.fields.length>=2&&t.fields.every(Boolean)),'method and coaching points are filled');
  await bf.evaluate(()=>{window.__closingEditor=1;try{closeEditor(false);}finally{window.__closingEditor=0;}});
  await bf.waitForFunction(()=>!document.getElementById('editorModal').classList.contains('on'));

  // ── 4. 세트피스 — 세트피스 판(세로 · 골이 위) · 장면 넷 — 앞서 다른 판을 열었어도 자동 방향이 가로로 돌리지 않는다 ──
  await bf.evaluate(i=>openLibDrawEditor(i,false),pxId('setpiece'));
  await bf.waitForFunction(()=>document.getElementById('editorModal').classList.contains('on'),null,{timeout:12000}); await page.waitForTimeout(900);
  const spx=await bf.evaluate(()=>({mode:state.fieldMode,o:state.orientation,flip:state.spFlip,scenes:document.querySelectorAll('#animFrames .anim-frame').length}));
  console.log('setpiece',JSON.stringify(spx)); await shot('5-setpiece');
  assert.deepEqual([spx.mode,spx.o,spx.flip,spx.scenes],['setpiece','v',true,4]);
  await bf.evaluate(()=>{ window.__hi=[]; const h=window.highlightFrame; window.highlightFrame=function(i){ window.__hi.push(i); return h.apply(this,arguments); }; playAnim(); });
  await bf.waitForFunction(()=>animPlaying===false&&window.__hi.length>0,null,{timeout:30000});
  assert.ok((await bf.evaluate(()=>[...new Set(window.__hi)])).includes(3),'the set piece plays to the last scene');
  await bf.evaluate(()=>{window.__closingEditor=1;try{closeEditor(false);}finally{window.__closingEditor=0;}});
  await bf.waitForFunction(()=>!document.getElementById('editorModal').classList.contains('on'));

  // ── 5. 작전판 — 페이지 둘, 첫 페이지는 장면 셋 ──
  await openCard('4-3-3 — 공격 형태와 수비 블록');
  await bf.waitForFunction(()=>window.__csView==='board'&&window.__psPages&&window.__psPages.pageInfo()&&window.__psPages.pageInfo().count===2,null,{timeout:12000}); await page.waitForTimeout(900);
  const bd=await bf.evaluate(()=>({pages:window.__psPages.pageInfo(),frames:anim.frames.length,players:state.players.length}));
  console.log('board',JSON.stringify(bd)); await shot('6-board');
  assert.deepEqual([bd.pages.count,bd.frames,bd.players],[2,3,11]);
  assert.equal((await dirty()).manual,false,'opening is not editing');
  await exitBoard();

  // ── 6. 미팅 — 슬라이드 다섯, 둘째 · 셋째는 장면이 있다. 슬라이드 줄 그림 안의 공이 칸을 덮지 않는다 ──
  await openCard('경기 전 미팅 — 상대 4-4-2');
  await bf.waitForFunction(()=>document.body.classList.contains('meet-mode')&&Array.isArray(anim.slides)&&anim.slides.length===5,null,{timeout:12000}); await page.waitForTimeout(1200);
  const mt=await bf.evaluate(()=>({titles:anim.slides.map(s=>s.title),frames:anim.slides.map(s=>(s.frames||[]).length),points:anim.slides.map(s=>s.points.length),thumbs:anim.slides.filter(s=>s.thumb).length,distinct:new Set(anim.slides.map(s=>s.thumb)).size}));
  console.log('meeting',JSON.stringify(mt)); await shot('7-meeting');
  assert.deepEqual(mt.titles,['상대 — 4-4-2 · 높은 압박','우리 공 — 6번을 거쳐 전진','상대 공 — 풀백 패스가 신호','세트피스 — 니어 포스트 플릭','오늘 꼭 지킬 세 가지']);
  assert.deepEqual(mt.frames,[0,3,2,0,0]); assert.ok(mt.points.every(n=>n===2)); assert.equal(mt.thumbs,5,'slide thumbnails are drawn on the way in'); assert.equal(mt.distinct,5,'each slide has its own picture');
  assert.equal(await bf.evaluate(()=>[...document.querySelectorAll('#ksStrip .ktb svg svg')].filter(e=>e.getBoundingClientRect().width>24).length),0,'no giant ball in the slide strip');
  await exitBoard();

  // ── 7. 지운 예시는 다시 생기지 않는다 — 다시 그려도, 이 기기 표식을 지워도(새 기기처럼) ──
  await bf.evaluate(i=>delFromLib(i),pxId('meeting')); await page.waitForTimeout(500);
  await bf.evaluate(()=>renderDrillFiles()); await page.waitForTimeout(1500);
  assert.equal((await lib()).length,5,'not back after a re-render');
  await bf.evaluate(()=>{ localStorage.removeItem('ps_vault_px_v1'); renderDrillFiles(); }); await page.waitForTimeout(2500);
  L=await lib(); assert.deepEqual([L.length,L.some(x=>x.ex==='meeting')],[5,false],'not back on a «new device» either — the delete record wins');
  assert.equal(Object.keys(await bf.evaluate(()=>JSON.parse(localStorage.getItem('ps_vault_px_v1')||'{}'))).length,1,'marked again, nothing added');

  // ── 8. ＋ 만들기 창의 «예시 담기» — 지운 것만 새 번호로 다시 담는다 ──
  await bf.evaluate(()=>document.getElementById('dfNew').click()); await bf.waitForSelector('#vCreateChooser .vcc-ex');
  assert.match(await bf.evaluate(()=>document.querySelector('#vCreateChooser .vcc-ex').textContent),/«프로세스» 폴더/); await shot('8-chooser');
  await bf.evaluate(()=>document.getElementById('vccEx').click());
  L=await waitLib(6);
  const again=L.find(x=>x.ex==='meeting');
  assert.ok(again&&again.folder==='프로세스'&&again.libId!==pxId('meeting')&&again.savedAt>Date.now()-60000,'the meeting is back with a new number and today\'s date: '+JSON.stringify(again));
  assert.equal(L.filter(x=>x.ex).length,5,'no doubles');
  await bf.waitForFunction(()=>libFilter.folder==='프로세스'&&document.querySelectorAll('#drillFiles .vcard').length===5,null,{timeout:12000});
  await shot('9-folder');

  // ── 9. 보관함을 통째로 비우면 — 첫 화면에 예시 카드(자동으로 다시 넣지는 않는다). 카드를 누르면 그것 하나를 담아 연다 ──
  await bf.evaluate(async()=>{ for(const d of ((await libGet())||[]))await delFromLib(d.libId); libFilter.folder='__mine'; renderDrillFiles(); });
  await bf.waitForSelector('.vault-start .vs-ex',{timeout:12000});
  const st=await bf.evaluate(()=>({head:document.querySelector('.vault-start .vs-head').textContent,cards:[...document.querySelectorAll('.vault-start [data-vx]')].map(b=>b.querySelector('.vs-nm').textContent),all:document.querySelector('.vault-start [data-vxall]').textContent}));
  console.log('starter',JSON.stringify(st)); await shot('10-starter');
  assert.deepEqual(st,{head:'보관함이 비어 있어요',cards:['패턴북','훈련 세션','세트피스','작전판','미팅 자료'],all:'예시 5개 모두 담기'});
  await page.waitForTimeout(1200); assert.equal((await lib()).length,0,'an emptied vault is not refilled on its own');
  await bf.evaluate(()=>document.querySelector('.vault-start [data-vx="train"]').click());
  await bf.waitForFunction(()=>document.getElementById('editorModal').classList.contains('on')&&document.querySelectorAll('#trainingStrip .tr-tab').length===3,null,{timeout:15000});
  L=await lib(); assert.deepEqual(L.map(x=>[x.ex,x.folder]),[['train','프로세스']]);
  await bf.evaluate(()=>{window.__closingEditor=1;try{closeEditor(false);}finally{window.__closingEditor=0;}});

  noErrors();
  console.log('vault-examples ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
