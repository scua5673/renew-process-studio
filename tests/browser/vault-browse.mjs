import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 보관함에서 연 작전판 · 패턴북 — 둘러보기만 하고 나가면 «버리고 나갈까요?»를 묻지 않는다(studio/board-vault-browse.js · 처음 고침 3.001 840dfa9).
//  예전: 페이지 띠 · 장면 · 재생 단추를 누르기만 해도 «변경 사항 있음»이 켜져, 아무것도 안 고치고 «나가기»를 누르면 물었다.
//  ⚠ 안전이 먼저다 — 정말 고친 것은 어느 페이지에서 고쳤든, 그 뒤에 페이지를 옮겼든 나갈 때 꼭 묻는다.
//  차례: (b) 2쪽에서 선수를 끌고 다른 페이지로 → 나가기는 묻는다(예전에도 · 지금도) · (a) 페이지 셋 넘기기 · 장면 고르기 · 재생 → 묻지 않는다
//        · (c) 패턴북 — 국면 지도 · 시퀀스 · 장면 · 재생 → 묻지 않는다, 2번 시퀀스에서 끌면 묻는다
//        · (d) 지문의 안전 장치 — 사건 없이 바뀐 판도 나가기 직전에 견준다 · «저장» 뒤 둘러보기 · «저장» 뒤 장면 강조 · 열리는 동안 손대면 예전처럼 묻는다.
//  누르기 · 끌기는 진짜 마우스로(pointerup 도 «변경 있음»을 묻는 길이다).
// 크롬 = 데스크톱, 웹킷 = 아이패드. PS_SIZE 로 하나만 고를 수 있다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',sizes=process.env.PS_SIZE?[process.env.PS_SIZE]:(engine==='webkit'?['ipad']:['desktop']);
for(const size of sizes)await run(size);
async function run(size){
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof renderTokens==='function');
  await bf.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:20000});
  const shot=n=>page.screenshot({path:path.join(SHOTS,`vault-browse-${engine}-${size}-${n}.png`)});
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await bf.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:12000});
  // 작전판(페이지 셋): A 장면 셋(200 → 500 → 800) · B 장면 둘(600 → 900) · C 장면 없음(300). 패턴북(시퀀스 셋)
  await bf.evaluate(async()=>{ const lib=await libGet(),sn=x=>({players:[{id:1,team:'blue',num:8,x:x,y:300},{id:2,team:'red',num:4,x:x+120,y:420}],equipment:[],drawings:[],ball:null,pitchN:1}),fr=(x,o)=>Object.assign({snap:sn(x),dur:1},o||{});
    lib.unshift({libId:'VBROWSE',type:'board',name:'둘러보기 작전판',folder:'',thumb:'',tags:[],savedAt:Date.now()-60000,snap:sn(200),pages:[
      {name:'A',snap:sn(200),thumb:'',anim:{frames:[fr(200),fr(500,{cap:'전진'}),fr(800)],active:0,hold:.6,title:'',titleColor:''}},
      {name:'B',snap:sn(600),thumb:'',anim:{frames:[fr(600),fr(900)],active:0,hold:.6,title:'',titleColor:''}},
      {name:'C',snap:sn(300),thumb:''}]});
    lib.unshift({libId:'VBROWSEBOOK',type:'board',book:1,name:'둘러보기 패턴북',folder:'',thumb:'',tags:[],savedAt:Date.now()-60000,snap:sn(200),frames:[fr(200),fr(500)],pages:[
      {name:'빌드업 A',grp:'공격 조직',snap:sn(200),thumb:'',anim:{frames:[fr(200,{sg:'빌드업'}),fr(500),fr(800,{sg:'전진',cap:'라인 사이로'})],active:0,hold:.6,title:'',titleColor:''}},
      {name:'코너킥 니어',grp:'세트피스',snap:sn(600),thumb:'',anim:{frames:[fr(600),fr(900)],active:0,hold:.6,title:'',titleColor:''}},
      {name:'전환 압박',grp:'공격 → 수비 전환',snap:sn(400),thumb:''}]});
    await libWrite(lib); try{libTouch();}catch(_){} try{renderDrillFiles();}catch(_){} });
  const card=name=>bf.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),name,{timeout:12000});
  const edit=name=>bf.evaluate(n=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n)); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click(); },name);
  const openBoard=async()=>{ await card('둘러보기 작전판'); await edit('둘러보기 작전판');
    await bf.waitForFunction(()=>window.__csView==='board'&&window.__vaultEdit&&!window.__vaultHydrating&&document.querySelectorAll('#boardPageStrip .bp-tab').length===3,null,{timeout:12000}); await page.waitForTimeout(800); };
  const openBook=async()=>{ await card('둘러보기 패턴북'); await edit('둘러보기 패턴북');
    await bf.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultBook&&window.__vaultEdit&&!window.__vaultHydrating&&document.querySelectorAll('#bkList .bk-row').length===3,null,{timeout:12000}); await page.waitForTimeout(800); };
  const dirty=()=>bf.evaluate(()=>window.__vaultManualDirty===true);
  const now=()=>bf.evaluate(()=>({dirty:window.__vaultManualDirty===true,idx:window.__psPages.book.idx(),scene:animActive}));
  const tab=async n=>{ await bf.click(`#boardPageStrip .bp-tab >> nth=${n}`); await page.waitForTimeout(450); };
  const scene=async n=>{ await bf.click(`#animFrames .anim-frame >> nth=${n}`); await page.waitForTimeout(400); };
  const row=async n=>{ const h=await bf.evaluateHandle(n=>[...document.querySelectorAll('#bkList .bk-row')].find(r=>r.querySelector('.no').textContent===String(n)),n); await h.asElement().click(); await page.waitForTimeout(500); };
  const play=async sel=>{ await bf.click(sel); await bf.waitForFunction(()=>animPlaying===true,null,{timeout:5000}); await bf.waitForFunction(()=>animPlaying===false,null,{timeout:20000}); await page.waitForTimeout(300); };
  /* 선수 하나를 진짜 마우스로 끈다 — 고친 것 */
  const drag=async(id,dx)=>{ const b=await bf.locator(`#tokenLayer .token[data-id="${id}"]`).first().boundingBox(); assert.ok(b,'token '+id+' on the board');
    const x=b.x+b.width/2,y=b.y+b.height/2; await page.mouse.move(x,y); await page.mouse.down(); for(let i=1;i<=8;i++)await page.mouse.move(x+dx*i/8,y); await page.mouse.up(); await page.waitForTimeout(400); };
  const asking=()=>bf.evaluate(()=>{ const o=[...document.body.children].find(e=>e.tagName==='DIV'&&/버리고 나갈까요/.test(e.textContent)); return o?o.textContent.replace(/취소|확인/g,'').trim():null; });
  const answer=label=>bf.evaluate(l=>[...[...document.body.children].find(e=>e.tagName==='DIV'&&/버리고 나갈까요/.test(e.textContent)).querySelectorAll('button')].find(b=>b.textContent===l).click(),label);
  const leave=async()=>{ await bf.click('#vCreateCancel'); await page.waitForTimeout(350); return asking(); };
  const left=()=>bf.waitForFunction(()=>window.__csView==='session'&&!window.__vaultEdit&&!document.body.classList.contains('book-mode'),null,{timeout:12000});
  const stored=id=>bf.evaluate(async id=>{ const d=(await libGet()).find(x=>x.libId===id); return {at:d.savedAt,pages:d.pages.map(p=>[p.name,p.snap.players.map(q=>q.x),((p.anim&&p.anim.frames)||[]).map(f=>f.snap.players[0].x)])}; },id);
  const ASK='저장하지 않은 변경 사항을 버리고 나갈까요?';
  const keptBoard=await stored('VBROWSE'),keptBook=await stored('VBROWSEBOOK');

  // ── (b) 2쪽에서 선수를 끌고 → 1쪽으로 옮겨도 «변경 있음» → 나가기는 묻는다. «취소»는 남고, «확인»은 버린다 ──
  await openBoard();
  assert.deepEqual(await now(),{dirty:false,idx:0,scene:0},'opened, nothing changed yet');
  await tab(1); assert.equal((await now()).idx,1,'page B');
  await drag(1,140);
  assert.equal(await dirty(),true,'a real edit on page 2');
  await tab(0); assert.deepEqual(await now(),{dirty:true,idx:0,scene:0},'moving to another page keeps the edit unsaved');
  assert.equal(await leave(),ASK,'leaving after an edit on another page asks');
  await answer('취소'); await page.waitForTimeout(250);
  assert.equal(await bf.evaluate(()=>window.__csView==='board'&&window.__vaultEdit&&window.__vaultManualDirty===true),true,'cancel stays on the board, still unsaved');
  await tab(2); assert.equal(await leave(),ASK,'still asks after more browsing');
  await answer('확인'); await left();
  assert.deepEqual(await stored('VBROWSE'),keptBoard,'discarded — the library keeps the old item');
  await shot('b-edit-asks');

  // ── (a) 페이지 셋을 넘기고 · 장면을 고르고 · 재생해 보고 → 나가기는 묻지 않는다 ──
  await openBoard();
  await tab(1); await tab(2); await tab(0);
  assert.deepEqual(await now(),{dirty:false,idx:0,scene:0},'pages B · C · back to A');
  await scene(1); assert.deepEqual(await now(),{dirty:false,idx:0,scene:1},'another scene of page A');
  await scene(2); await scene(0);
  await play('#animPlay'); assert.equal(await dirty(),false,'playing page A');
  await tab(1); await scene(1); await play('#animPlay'); await tab(2); await tab(0);
  /* 굴리기(장면 띠 · 판 위) */
  { const fb=await bf.locator('#animFrames').boundingBox(); if(fb){ await page.mouse.move(fb.x+fb.width/2,fb.y+fb.height/2); await page.mouse.wheel(0,240); }
    const sb=await bf.locator('#boardStage').boundingBox(); await page.mouse.move(sb.x+sb.width/2,sb.y+sb.height/2); await page.mouse.wheel(0,240); await page.waitForTimeout(300); }
  await page.waitForTimeout(1200);   // 늦게 도는 그리기(장면 썸네일 채우기 · 운동장 개수 80ms)도 고친 것이 아니다
  const st=await now(); assert.equal(st.dirty,false,'still clean after browsing: '+JSON.stringify(st));
  assert.equal(await leave(),null,'leaving after browsing asks nothing'); await left();
  assert.deepEqual(await stored('VBROWSE'),keptBoard,'browsing wrote nothing');
  await shot('a-browse-quiet');

  // ── (c) 패턴북 — 국면 지도로 고르고 · 장면 · 재생 · 기둥 · 다시 지도 → 묻지 않는다. 2번 시퀀스에서 끌면 묻는다 ──
  await openBook();
  assert.deepEqual(await bf.evaluate(()=>({dirty:window.__vaultManualDirty===true,map:window.__bkMap.on()})),{dirty:false,map:true},'the book opens on its phase map');
  await bf.click('#bkMap .bkm-s[data-i="1"]'); await page.waitForTimeout(500);
  assert.deepEqual(await now(),{dirty:false,idx:1,scene:0},'a sequence chosen on the map');
  await scene(1); await play('#bkPlaySeq');
  await row(3); await row(1); assert.deepEqual(await now(),{dirty:false,idx:0,scene:0},'sequences from the rail');
  await scene(2); await bf.click('#bkMapBtn'); await page.waitForTimeout(400);
  await bf.click('#bkMap .bkm-s[data-i="2"]'); await page.waitForTimeout(500);
  await page.waitForTimeout(1200);
  assert.equal(await dirty(),false,'the book is still clean');
  assert.equal(await leave(),null,'leaving the book after browsing asks nothing'); await left();
  assert.deepEqual(await stored('VBROWSEBOOK'),keptBook,'browsing the book wrote nothing');
  await openBook(); await bf.click('#bkMap .bkm-s[data-i="1"]'); await page.waitForTimeout(500);
  await drag(1,-120); assert.equal(await dirty(),true,'a real edit in sequence 2');
  await row(1); assert.equal(await dirty(),true,'still unsaved in another sequence');
  assert.equal(await leave(),ASK,'leaving the book after an edit asks'); await answer('확인'); await left();
  assert.deepEqual(await stored('VBROWSEBOOK'),keptBook);
  // 시퀀스 이름만 바꿔도(기둥의 입력칸) 묻는다
  await openBook(); await bf.click('#bkMap .bkm-s[data-i="0"]'); await page.waitForTimeout(500);
  await bf.fill('#bkName','빌드업 B'); await row(2);
  assert.equal(await dirty(),true,'a sequence name is an edit');
  assert.equal(await leave(),ASK); await answer('확인'); await left();
  assert.deepEqual(await stored('VBROWSEBOOK'),keptBook);
  await shot('c-book');

  // ── (d) 안전 장치 ──
  // d1 — 사건 없이 바뀐 판(누르기 · 저장 신호 없이 코드가 바꾼 것)도 나가기 직전에 견준다
  await openBoard(); await tab(1);
  await bf.evaluate(()=>{ state.players[1].x+=77; });   /* 다시 그리지도 않는다 — 아무 길도 «변경 있음»을 묻지 않았다 */
  assert.equal(await dirty(),false,'nothing has asked yet');
  assert.equal(await leave(),ASK,'the exit compares the whole item'); await answer('확인'); await left();
  // d2 — 사건 없이 바꾼 뒤 페이지를 코드로 옮겨도(옮기기 바로 앞에서 견준다) «변경 있음»
  await openBoard(); await tab(2);
  await bf.evaluate(()=>{ state.players[0].x+=55; window.__psPages.book.go(0); });
  assert.equal(await dirty(),true,'a page move right after an unnoticed change keeps it');
  assert.equal(await leave(),ASK); await answer('확인'); await left();
  // d3 — 장면 칸(자막)만 바꿔도 «변경 있음», 다른 장면으로 옮겨도 그대로
  await openBoard();
  await bf.evaluate(()=>{ anim.frames[2].cap='새 자막'; });
  await scene(1); assert.equal(await dirty(),true,'a scene caption is an edit');
  assert.equal(await leave(),ASK); await answer('확인'); await left();
  // d4 — «저장»한 뒤 둘러보기는 다시 깨끗하다 · 고친 것은 보관함에 있다
  await openBoard(); await tab(1); await drag(2,90);
  const x2=await bf.evaluate(()=>state.players.find(p=>p.id===2).x);
  await bf.click('#vCreateSaveOnly');
  await bf.waitForFunction(()=>!window.__vaultManualDirty&&!document.getElementById('vCreateSaveOnly').disabled&&/저장됨/.test(document.getElementById('vCreateSub').textContent||''),null,{timeout:8000});
  const saved=await stored('VBROWSE'); assert.ok(saved.pages[1][1].includes(x2),'the page-2 edit is in the library: '+JSON.stringify([x2,saved.pages[1]]));
  await tab(0); await tab(2); await tab(1); await scene(1);
  assert.equal(await dirty(),false,'after «저장», browsing is clean again');
  assert.equal(await leave(),null,'nothing to ask after saving'); await left();
  // d6 — «저장» 뒤에 지금 장면의 칸(계속 강조)만 바꿔도 묻는다(예전 «저장» 뒤 지문은 지금 장면의 강조 · 자막 · 시간 · 곡선을 보지 않아 묻지 않고 나갔다)
  await openBoard(); await bf.click('#vCreateSaveOnly');
  await bf.waitForFunction(()=>!window.__vaultManualDirty&&/저장됨/.test(document.getElementById('vCreateSub').textContent||''),null,{timeout:8000});
  { const b=await bf.locator('#tokenLayer .token[data-id="1"]').first().boundingBox(); await page.mouse.click(b.x+b.width/2,b.y+b.height/2); await page.waitForTimeout(300); }
  await bf.click('#animHlBtn'); await page.waitForTimeout(300);
  assert.deepEqual(await bf.evaluate(()=>anim.frames[animActive].hl),[1],'scene 1 keeps player 8 highlighted');
  assert.equal(await leave(),ASK,'a highlight set after «저장» is asked about'); await answer('확인'); await left();
  assert.equal(await bf.evaluate(async()=>!!(await libGet()).find(x=>x.libId==='VBROWSE').pages[0].anim.frames[0].hl),false,'discarded');
  // d5 — 열리는 동안(420ms) 사람이 손대면 그 모습을 지문으로 삼지 않는다 — 예전처럼 누르기마다 «변경 있음»
  await card('둘러보기 작전판');
  await bf.evaluate(()=>{ const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('둘러보기 작전판')); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click();
    if(window.__vaultHydrating)document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); });
  await bf.waitForFunction(()=>window.__csView==='board'&&window.__vaultEdit&&!window.__vaultHydrating&&document.querySelectorAll('#boardPageStrip .bp-tab').length===3,null,{timeout:12000}); await page.waitForTimeout(600);
  assert.deepEqual(await bf.evaluate(()=>window.__psVaultBrowse.state().baseline),false,'touched while opening — no fingerprint');
  await tab(1); assert.equal(await dirty(),true,'the old behaviour: a press is «변경 있음»');
  assert.equal(await leave(),ASK); await answer('확인'); await left();

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)); assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('vault-browse ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
}
