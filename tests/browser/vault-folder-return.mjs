import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS,A,WP} from '../fixtures/team-app.mjs';
// 오류 제보 2d392249 «저장하고 나가기 이후 화면» — 보관함 «4. 경기 분석» 폴더 안 작전판을 편집하다 «저장하고 나가기»를 누르면
// 전체 자료(팀 공간은 내 자료)로 넘어갔다. 기대: 열었던 그 폴더로 돌아온다(«나가기» · 보기→편집 · 검색해서 연 것도).
// 그 사이 폴더가 지워졌으면 전체 자료. 보관함 탭으로 새로 들어오면 예전처럼 처음 자리. 팀 공간과 개인 공간 둘 다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
const F='4. 경기 분석',G='지울 폴더';
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const board=async()=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await f.waitForFunction(()=>typeof boardStore==='object'&&typeof renderDrillFiles==='function');return f;};
  let bf=await board();
  const snap={players:[{id:'p1',team:'red',num:'9',x:400,y:300}],equipment:[],drawings:[],pitchN:1};
  /* 폴더 목록을 먼저 다 읽게 한 뒤 자료를 심는다(vault-folder-delete 와 같은 순서) */
  const seed=async(folders,items)=>{
    await bf.evaluate(async folders=>{await boardStore.set('cs_vault_folders_v1',folders);localStorage.setItem('cs_lib_rev',String(Date.now()));window.dispatchEvent(new StorageEvent('storage',{key:'cs_vault_folders_v1'}));},folders);
    await page.waitForTimeout(1500);
    await bf.evaluate(async({items,A,snap})=>{const now=Date.now(),lib=(await boardStore.get('cs_drill_lib_v1'))||[];
      items.forEach((d,i)=>lib.unshift({type:'board',tags:[],savedAt:now-i,createdBy:A,snap,...d}));
      await boardStore.set('cs_drill_lib_v1',lib);localStorage.setItem('cs_lib_rev',String(now));},{items,A,snap});
  };
  const goVault=async()=>{await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());bf=await board();};
  const where=()=>bf.evaluate(()=>({f:libFilter.folder,q:libFilter.q||'',crumb:((document.querySelector('#drillFiles .vx-crumb')||{}).textContent||''),sel:window.__vaultPreviewId,view:window.__csView,
    cards:[...document.querySelectorAll('#drillFiles .vcard .vc-nm')].map(e=>e.textContent)}));
  const openFolder=async name=>{
    await bf.waitForFunction(n=>[...document.querySelectorAll('.vx-folder-name')].some(e=>e.textContent===n),name,{timeout:20000});
    await bf.evaluate(n=>{[...document.querySelectorAll('.vx-folder')].find(r=>(r.querySelector('.vx-folder-name')||{}).textContent===n).click();},name);
    await bf.waitForFunction(n=>libFilter.folder===n&&((document.querySelector('#drillFiles .vx-crumb')||{}).textContent||'').indexOf(n)===0,name,{timeout:10000});
  };
  /* 넓은 화면은 고른 줄에만 «보기·편집»이 보인다 — 손이 하듯 먼저 그 줄을 고른다(vault-board-isolation 과 같은 손놀림) */
  const openCard=async(name,edit)=>{
    const card=bf.locator('#drillFiles .vcard').filter({hasText:name}),btn=card.locator(edit?'.vc-act.edit':'.vc-act.view');
    if(!(await btn.isVisible()))await card.click({position:{x:60,y:12}});
    await btn.click();
    await bf.locator('#vCreateBar.on').waitFor({state:'visible'});
    await bf.waitForFunction(()=>window.__csView!=='session'&&!window.__vaultHydrating);
    await page.waitForTimeout(500);
  };
  const nudge=async()=>{await bf.evaluate(()=>{state.players[0].x+=60;renderTokens();window.__vaultAutoSaveSchedule();});await bf.waitForFunction(()=>window.__vaultManualDirty===true);};
  /* 나간 뒤 보관함이 다 그려지고, 셸의 보관함 열기가 한 번 더 와도 그 자리가 남는지 잠깐 더 본다 */
  const back=async()=>{await bf.waitForFunction(()=>window.__csView==='session'&&!document.body.classList.contains('vcreating'),null,{timeout:15000});await page.waitForTimeout(900);return where();};
  const storedX=id=>bf.evaluate(async id=>(((await boardStore.get('cs_drill_lib_v1'))||[]).find(d=>d.libId===id)||{}).snap?.players?.[0]?.x,id);

  // ── 팀 공간 ──
  await seed([F,G,'기타'],[{libId:'Vqa_r1',name:'가상 경기 분석 보드',folder:F},{libId:'Vqa_m1',type:'meeting',name:'가상 경기 분석 미팅',folder:F,slides:[{pdfOrientation:'landscape',snap,thumb:'',title:'1장',points:[]}]},{libId:'Vqa_r2',name:'가상 지울 폴더 보드',folder:G},{libId:'Vqa_r3',name:'가상 미분류 보드',folder:''},{libId:'Vqa_r4',name:'가상 기타 보드',folder:'기타'}]);
  await goVault();
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vc-nm')].some(e=>e.textContent==='가상 미분류 보드'),null,{timeout:20000});
  assert.equal((await where()).f,'__mine','팀 공간 보관함의 처음 자리는 내 자료(그대로)');
  // 1) 폴더에서 연 작전판 — 편집 › 저장하고 나가기 › 그 폴더
  await openFolder(F);
  await openCard('가상 경기 분석 보드',true);
  await nudge();
  await bf.locator('#vCreateSave').click();
  let w=await back();
  assert.equal(w.f,F,'저장하고 나가기 뒤 열었던 폴더 '+JSON.stringify(w));
  assert.ok(w.crumb.indexOf(F)===0&&w.cards.includes('가상 경기 분석 보드')&&!w.cards.includes('가상 기타 보드'),'폴더 화면이 그려진다 '+JSON.stringify(w));
  assert.equal(w.sel,'Vqa_r1','방금 고친 자료가 골라져 있다');
  assert.equal(await storedX('Vqa_r1'),460,'고친 것은 저장됐다');
  // 2) 바꾸지 않고 «나가기»
  await openCard('가상 경기 분석 보드',true);
  await bf.locator('#vCreateCancel').click();
  w=await back();
  assert.equal(w.f,F,'나가기도 열었던 폴더 '+JSON.stringify(w));
  // 2-1) 미팅 자료 — 작전판과 닫는 길이 다르다(작업 보드로 한 번 갔다가 보관함으로). «닫기»도 열었던 폴더
  await openCard('가상 경기 분석 미팅',true);
  assert.equal(await bf.evaluate(()=>window.__csView),'meeting');
  await bf.locator('#vCreateCancel').click();
  w=await back();
  assert.equal(w.f,F,'미팅을 닫아도 열었던 폴더 '+JSON.stringify(w));
  // 3) 보기 › 편집 › 저장하고 나가기 — 보기에서 편집으로 다시 열어도 처음 연 폴더를 잊지 않는다
  await openCard('가상 경기 분석 보드',false);
  await bf.locator('#vCreateEdit').click();
  await bf.waitForFunction(()=>window.__csView==='board'&&!window.__vaultReadOnly&&window.__curVaultId==='Vqa_r1'&&getComputedStyle(document.getElementById('vCreateSave')).display!=='none',null,{timeout:10000});
  await page.waitForTimeout(500);
  await nudge();
  await bf.locator('#vCreateSave').click();
  w=await back();
  assert.equal(w.f,F,'보기→편집→저장하고 나가기도 열었던 폴더 '+JSON.stringify(w));
  assert.equal(await storedX('Vqa_r1'),520);
  // 4) 검색해서 연 자료 — 폴더와 검색어가 그대로(검색은 폴더 밖까지 찾는다)
  await bf.fill('#dfSearch','미분류');
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vc-nm')].map(e=>e.textContent).join()==='가상 미분류 보드');
  await openCard('가상 미분류 보드',true);
  await bf.locator('#vCreateCancel').click();
  w=await back();
  assert.deepEqual([w.f,w.q,w.cards],[F,'미분류',['가상 미분류 보드']],'검색 결과 화면 그대로 '+JSON.stringify(w));
  await bf.fill('#dfSearch','');
  await bf.waitForFunction(()=>!libFilter.q);
  // 5) 다른 곳에 갔다가 보관함 탭으로 새로 들어오면 예전처럼 처음 자리(내 자료) — 돌아갈 자리는 한 번만 쓴다
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  await bf.waitForFunction(()=>window.__csView==='board');
  await page.waitForTimeout(400);
  await goVault();
  await bf.waitForFunction(()=>window.__csView==='session');
  await page.waitForTimeout(600);
  assert.equal((await where()).f,'__mine','보관함 탭으로 들어오면 처음 자리');
  // 6) 편집하는 사이 그 폴더가 지워졌다(다른 기기) — 자료는 폴더 밖으로 옮겨졌고, 나가면 전체 자료
  await openFolder(G);
  await openCard('가상 지울 폴더 보드',true);
  await nudge();
  await bf.evaluate(async({F})=>{const lib=(await boardStore.get('cs_drill_lib_v1'))||[],now=Date.now();
    lib.forEach(d=>{if(d.libId==='Vqa_r2'){d.folder='';d.editedAt=now;}});
    await boardStore.set('cs_vault_folders_v1',[F,'기타']);await boardStore.set('cs_drill_lib_v1',lib);
    localStorage.setItem('cs_lib_rev',String(now));
    window.dispatchEvent(new StorageEvent('storage',{key:'cs_vault_folders_v1'}));window.dispatchEvent(new StorageEvent('storage',{key:'cs_lib_rev'}));},{F});
  await bf.waitForFunction(g=>{const n=[...document.querySelectorAll('.vx-folder-name')].map(e=>e.textContent);return n.includes('기타')&&!n.includes(g);},G,{timeout:15000});
  await bf.locator('#vCreateSave').click();
  w=await back();
  assert.equal(w.f,'__all','지워진 폴더 대신 전체 자료 '+JSON.stringify(w));
  assert.ok(w.crumb.indexOf('전체 자료')===0&&w.cards.includes('가상 지울 폴더 보드'),'전체 자료에 그 자료가 보인다 '+JSON.stringify(w));
  assert.equal(await storedX('Vqa_r2'),460,'고친 것은 저장됐다');
  await page.screenshot({path:path.join(SHOTS,'vault-folder-return-team-'+size+'.png')});

  // ── 개인 공간 ──
  await page.evaluate(k=>{const o=JSON.parse(localStorage.getItem('ps_vault_px_v1')||'{}');o[k]=1;localStorage.setItem('ps_vault_px_v1',JSON.stringify(o));},A+'|'+WP);   // 보관함 예시(3.001)를 이미 받은 사용자로
  await page.evaluate(w=>{PSSync.switchWorkspace(w).catch(()=>{});},WP).catch(()=>{});
  await page.waitForFunction(w=>{try{return PSSync.activeWs()===w&&!document.body.classList.contains('ps-booting')&&PSSync.dataUnlocked()===true;}catch(_){return false;}},WP,{timeout:60000});
  await page.waitForTimeout(1500);
  bf=await board();
  const P='개인 경기 분석';
  await seed([P,'개인 기타'],[{libId:'Vqa_p1',name:'가상 개인 보드',folder:P},{libId:'Vqa_p2',name:'가상 개인 기타 보드',folder:'개인 기타'}]);
  await goVault();
  await bf.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vc-nm')].some(e=>e.textContent==='가상 개인 기타 보드'),null,{timeout:20000});
  assert.equal((await where()).f,'__all','개인 공간 보관함의 처음 자리는 전체 자료(그대로)');
  await openFolder(P);
  await openCard('가상 개인 보드',true);
  await nudge();
  await bf.locator('#vCreateSave').click();
  w=await back();
  assert.equal(w.f,P,'개인 공간도 열었던 폴더 '+JSON.stringify(w));
  assert.ok(w.cards.includes('가상 개인 보드')&&!w.cards.includes('가상 개인 기타 보드'),JSON.stringify(w));
  assert.equal(await storedX('Vqa_p1'),460);
  await page.screenshot({path:path.join(SHOTS,'vault-folder-return-personal-'+size+'.png')});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('vault-folder-return ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close?.();
}
