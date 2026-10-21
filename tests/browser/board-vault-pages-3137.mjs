import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.137 — 오류 제보 0917a39f 조사에서 나온 고장: 여러 페이지 작전판을 보관함에 저장하면 항목의 대표 판(snap)은 1페이지인데 대표 장면(frames)은
// «저장할 때 보던 페이지»의 장면이었다. «보드 가져오기»가 1페이지 판에 다른 페이지 장면을 붙였고, 그 페이지에서 «저장»하면(보관함 연결 되쓰기)
// 보관함 그 자료의 1페이지 장면이 덮였다 — 장면 [6,16,14,29] 가 [29,16,14,29] 로. 이제 저장은 1페이지 장면을 대표로, 가져오기는 1페이지 장면을 쓴다
// (이미 저장된 자료도). 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__vaultSave&&window.__psSaveAskApi&&window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:45000});
  await page.waitForTimeout(1000);
  const lib=()=>f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).filter(d=>/^가상 여러 페이지/.test(d.name||'')).map(d=>({id:d.libId,frames:(d.frames||[]).length,pageFrames:(d.pages||[]).map(p=>p.anim&&p.anim.frames?p.anim.frames.length:0)})));
  // 네 페이지(장면 6 · 16 · 14 · 29) — 4페이지를 보는 중
  await f.evaluate(()=>{
    const base=captureSnap();
    const mk=(n,seed,k)=>{const s=JSON.parse(JSON.stringify(base));s.players=[];for(let i=0;i<n;i++)s.players.push({id:seed*100+i,team:i%2?'blue':'red',num:String(i+1),pos:'',x:200+i*35+k*6,y:250+((i*53+seed*17)%300),color:null});s.drawings=[];s.equipment=[];return s;};
    const pg=(name,n,fr,seed)=>{const frames=[];for(let k=0;k<fr;k++)frames.push({snap:mk(n,seed,k),dur:1,curves:{}});return {name,snap:frames[0].snap,thumb:'',anim:{frames,active:0,title:'',hold:.6,titleColor:'#e23b3b'}};};
    const pages=[pg('가 페이지',9,6,1),pg('나 페이지',14,16,2),pg('다 페이지',16,14,3),pg('라 페이지',9,29,4)];
    boardLiveApply({snap:pages[3].snap,view:'board',matchActive:false,meetSlides:[],animFrames:pages[3].anim.frames,animActive:0,boardPages:{idx:3,pages},boardLink:null});
  });
  await f.waitForFunction(()=>window.__psPages.pageInfo().idx===3&&anim.frames.length===29,null,{timeout:8000});
  // 4페이지에서 «저장» → 보관함에 담기
  await f.evaluate(()=>{pushUndo();state.players[0].x+=10;renderTokens();});
  await f.click('#boardManualSave');await f.waitForSelector('#psSaveOv',{timeout:8000});
  await f.evaluate(()=>{document.getElementById('pssName').value='가상 여러 페이지';});await f.click('#pssOk');
  await f.waitForFunction(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).some(d=>d.name==='가상 여러 페이지'),null,{polling:150,timeout:8000});
  let it=(await lib())[0];
  assert.deepEqual(it.pageFrames,[6,16,14,29],'페이지마다 장면 '+JSON.stringify(it));
  assert.equal(it.frames,6,'대표 장면은 1페이지 것(대표 판과 같은 페이지) — 예전엔 보던 4페이지의 29 '+JSON.stringify(it));

  // 이미 저장된 옛 자료(대표 장면이 4페이지 것)도 가져오면 1페이지 장면 — 가져온 페이지에서 «저장»해도 보관함 1페이지 장면은 그대로
  await f.evaluate(async id=>{const l=(await boardStore.get('cs_drill_lib_v1'))||[];const d=l.find(x=>x.libId===id);d.frames=JSON.parse(JSON.stringify(d.pages[3].anim.frames));await libWrite(l);try{libTouch();}catch(_){}},it.id);
  assert.equal((await lib())[0].frames,29,'옛 저장본 모양');
  await f.evaluate(()=>document.getElementById('bpImportBoard').click());
  await f.waitForFunction(()=>{const o=document.getElementById('bdImportOverlay');return o&&[...o.querySelectorAll('button')].some(b=>/가상 여러 페이지/.test(b.textContent)&&b.onclick&&b.onclick.__psSafe);},null,{timeout:12000});
  assert.match(await f.evaluate(()=>document.getElementById('bdImportOverlay').textContent),/장면 6/,'목록도 1페이지 장면 수');
  await f.evaluate(()=>[...document.querySelectorAll('#bdImportOverlay button')].find(b=>/가상 여러 페이지/.test(b.textContent)).click());
  await f.waitForFunction(()=>window.__psPages.pageInfo().count===5&&!!document.getElementById('bpLinkChip'),null,{timeout:8000});
  assert.equal(await f.evaluate(()=>anim.frames.length),6,'가져온 페이지 = 1페이지 판 + 1페이지 장면');
  assert.equal(await f.evaluate(()=>libGet.name),'libGet','목록 읽기는 원래 함수로 돌아왔다');
  await f.evaluate(()=>{pushUndo();state.players[0].x+=10;renderTokens();});
  await f.click('#boardManualSave');
  await f.waitForFunction(async()=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.name==='가상 여러 페이지');return d&&d.pages[0].snap.players[0].x!==d.pages[1].snap.players[0].x&&d.savedAt>Date.now()-6000;},null,{polling:150,timeout:8000}).catch(()=>{});
  await page.waitForTimeout(800);
  it=(await lib())[0];
  assert.deepEqual(it.pageFrames,[6,16,14,29],'연결 되쓰기 뒤에도 1페이지 장면 6개 — 예전엔 [29,16,14,29] '+JSON.stringify(it));
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('board-vault-pages-3137 ok',engine,size);
}finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} try{await fx.close();}catch(_){}}
