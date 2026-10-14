import assert from 'node:assert/strict';
import {startFixture,openApp,ready} from '../fixtures/team-app.mjs';
// 3.017 — 사용자 «토큰의 크기가 다른 작업물들 불러올 때 막 변경이 되는데 변경되지 않게 · 작업물마다 보드 설정 했던 것들 전부 각각 저장되게».
// ① 한 작업물의 페이지끼리는 설정이 하나(넘겨도 크기 그대로) ② «보드 가져오기»는 내용만 — 지금 보드 크기 그대로
// ③ «보드 저장»이 연결된 보관함 자료에 되쓸 때 그 자료의 크기는 그 자료 것 ④ 보관함에서 열면 그 자료의 크기, 나오면 보드 크기 ⑤ 새로고침해도 그대로.
// 합성 팀 fixture 에서만 돈다. WebKit 은 아이패드 폭, Chromium 은 데스크톱 폭.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  const toBoard=async()=>{await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__psPages&&!!document.getElementById('vaultSave')&&!!document.getElementById('bpNewBoard'),null,{timeout:30000});
    await page.waitForTimeout(900);return f;};
  let f=await toBoard();
  const ts=()=>f.evaluate(()=>state.tokenScale);
  const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<0.006,msg+' '+a+' vs '+b);   /* 사다리 값은 두 자리로 적힌다(기본 0.355 → «－» 뒤 0.36) */
  const tabs=()=>f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab').length);
  const put=(id,x)=>f.evaluate(([id,x])=>{pushUndo();state.players=[{id,team:'red',num:'7',x,y:320},{id:id+'b',team:'blue',num:'5',x:x+120,y:340}];renderTokens();},[id,x]);
  const grow=n=>f.evaluate(n=>{for(let i=0;i<n;i++)scaleAll(1.25);},n);
  const shrinkAll=()=>f.evaluate(()=>{for(let i=0;i<8;i++)scaleAll(0.8);});
  const confirmIf=async()=>{await page.waitForTimeout(300);await f.evaluate(()=>{const ok=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='확인'&&b.offsetParent).pop();if(ok)ok.click();});await page.waitForTimeout(400);};
  const vaultItem=name=>f.evaluate(async n=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(x=>x.name===n);return d?{ts:d.snap.tokenScale,x:d.snap.players&&d.snap.players[0]&&d.snap.players[0].x}:null;},name);
  const saveVault=async name=>{await f.evaluate(()=>document.getElementById('vaultSave').click());await f.waitForSelector('#psSaveOv');
    await f.evaluate(v=>{document.getElementById('pssName').value=v;},name);await f.click('#pssOk');
    await f.waitForFunction(async n=>((await store.get('cs_drill_lib_v1'))||[]).some(d=>d.name===n),name);await page.waitForTimeout(400);};
  // 작업물 A — 크기 +3 으로 보관함에
  await put('a1',400);await grow(3);const big=await ts();
  await saveVault('가상 크기 A');
  assert.equal((await vaultItem('가상 크기 A')).ts,big,'A 는 제 크기로 저장');
  // 작업 보드는 «새 보드»로 새로 — 가장 작은 크기
  await f.evaluate(()=>window.__psPages.newBoard());await confirmIf();await put('b1',300);await shrinkAll();
  const small=await ts();assert.ok(small<big,'small '+small+' < big '+big);
  // ① 페이지: 2쪽에서 키우면 1쪽도 같은 크기 — 넘겨도 바뀌지 않는다
  await f.click('#boardPageStrip .bp-add:not(#bpImportBoard):not(#bpNewBoard)');await page.waitForTimeout(500);
  assert.equal(await tabs(),2);assert.equal(await ts(),small,'새 페이지는 지금 크기');
  await grow(2);const mid=await ts();assert.ok(mid>small);
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[0].click());await page.waitForTimeout(500);
  assert.equal(await ts(),mid,'1쪽으로 넘겨도 크기 그대로');
  await f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab')[1].click());await page.waitForTimeout(500);
  assert.equal(await ts(),mid,'2쪽으로 돌아와도 그대로');
  await shrinkAll();near(await ts(),small,'다시 가장 작게');
  // ② «보드 가져오기»(2쪽에 A) — 내용은 A, 크기는 지금 보드
  await f.evaluate(()=>openBoardImport());await f.waitForSelector('#bdImportOverlay');
  await f.evaluate(()=>[...document.querySelectorAll('#bdImportOverlay button')].find(b=>b.textContent.includes('가상 크기 A')).click());await page.waitForTimeout(800);
  assert.equal(await f.evaluate(()=>state.players[0].id),'a1','A 의 내용');
  near(await ts(),small,'가져와도 지금 보드 크기 그대로');
  // ③ 움직이고 «보드 저장» → A 에도 저장되지만 A 의 크기는 A 것
  await f.evaluate(()=>{pushUndo();state.players[0].x=480;renderTokens();});
  await f.evaluate(()=>window.__boardSaveExplicit());
  await f.waitForFunction(async()=>{const d=((await store.get('cs_drill_lib_v1'))||[]).find(x=>x.name==='가상 크기 A');return d&&d.snap.players[0].x===480;},null,{timeout:15000});
  assert.deepEqual(await vaultItem('가상 크기 A'),{ts:big,x:480},'내용은 보드에서, 크기는 A 의 것');
  // ④ 보관함에서 A 를 열면 A 의 크기, 나오면 보드 크기
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});await page.waitForTimeout(700);
  await f.evaluate(()=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('가상 크기 A'));[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click();});
  await f.waitForFunction(()=>!!window.__vaultEdit);await page.waitForTimeout(1200);
  assert.equal(await ts(),big,'보관함에서 연 A 는 제 크기');
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());await confirmIf();await page.waitForTimeout(600);
  f=await toBoard();
  near(await ts(),small,'작업 보드는 제 크기');
  // ⑤ 새로고침해도 — 두 페이지 모두 같은 크기
  await f.evaluate(()=>window.__boardSaveExplicit());await page.waitForTimeout(600);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.waitForTimeout(1500);
  f=await toBoard();await page.waitForTimeout(1200);
  assert.equal(await tabs(),2);near(await ts(),small,'새로고침 뒤에도');
  await f.evaluate(()=>{const t=document.querySelectorAll('#boardPageStrip .bp-tab');t[t[0].classList.contains('on')?1:0].click();});await page.waitForTimeout(500);
  near(await ts(),small,'다른 페이지도 같은 크기');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true,small,mid,big}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
