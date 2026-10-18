import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT} from '../fixtures/team-app.mjs';
// 3.093 — 폰 설치 앱이 켜진 지 5초에 꺼졌다(사용자 «핸드폰으로 웹앱으로 설치하면 자꾸 안돼», 10/16~18 boot_after_crash 가 모두 아이폰 설치 앱).
// 폰은 팀운영 › 오늘로 열리고 작전판은 숨은 채 부팅하는데, 숨은 보관함이 로그인 · 동기화 알림마다 다시 그리며 보관함 통째를 10초에 24번 읽었다
// (그 팀 21MB → 크로미움 실측 0.9GB). 앱을 다시 열 때(보관함이 이미 기기에 있을 때) 작전판이 보관함을 몇 번 읽는지 센다.
// 폰(WebKit 잡): 숨은 작전판은 읽지 않는다(부팅 데우기 한 번) — 보관함을 열면 그때 그린다. 데스크톱(Chromium 잡): 보이는 작전판은 같은 때의 그리기를 한 번에.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'phone':'desktop');
const N=6,LIB='cs_drill_lib_v1';
const fx=await startFixture(),browsers={};
for(let i=0;i<N;i++){
  const it={libId:'PV'+i,type:i%2?'board':'train',name:'가상 보관 자료 '+(i+1),folder:'',tags:[],savedAt:Date.now()-i*1000,createdBy:A,snap:{players:[]}};
  fx.lib.set(WT+'|'+it.libId,{workspace_id:WT,lib_id:it.libId,type:it.type,name:it.name,folder:'',tags:[],pin:false,item:it,saved_at:it.savedAt,deleted_at:null,owner_id:A,private:false});
}
try{
  const {page,context,logs}=await openApp(fx,size,{browsers,phoneStart:true});
  // 다시 여는 부팅을 센다 — 프레임마다 window.storage.get(보관함) 횟수
  await context.addInitScript(key=>{
    const who=()=>{ try{ return (window.frameElement&&window.frameElement.id)||'shell'; }catch(_){ return '?'; } };
    const hook=()=>{ const s=window.storage; if(!s||s.__pvCount)return !!s; s.__pvCount=1; const g=s.get.bind(s);
      s.get=function(k){ if(k===key){ try{ const t=window.top; t.__pvReads=t.__pvReads||{}; t.__pvReads[who()]=(t.__pvReads[who()]||0)+1; }catch(_){} } return g.apply(this,arguments); }; return true; };
    if(!hook()){ const iv=setInterval(()=>{ if(hook())clearInterval(iv); },2); setTimeout(()=>clearInterval(iv),20000); }
  },LIB);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked&&PSSync.dataUnlocked(),null,{timeout:45000});
  await page.waitForTimeout(8000);   // 부팅 · 동기화 회차 · 로그인 알림이 지나가도록
  const reads=await page.evaluate(()=>window.__pvReads||{});
  const app=await page.evaluate(()=>document.body.dataset.psApp);
  const boardReads=reads.fBoard||0;
  const board=await (await page.$('#fBoard')).contentFrame();
  const count=()=>board.evaluate(()=>((document.getElementById('dfCount')||{}).textContent||'').trim());
  if(size==='phone'){
    assert.notEqual(app,'board','폰 · 팀 공간은 팀운영으로 연다 — 작전판은 숨은 채 부팅');
    assert.ok(boardReads<=1,'숨은 작전판은 보관함을 읽지 않는다(부팅 데우기 한 번까지): '+JSON.stringify(reads));
    assert.equal(await count(),'','숨은 동안은 보관함을 그리지 않는다');
    // 보관함을 열면 그때 그린다
    await page.locator('#teamBottom [data-tb="more"]').click();await page.locator('#teamMoreSheet [data-tb-app="board"]').click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='board');
    await page.locator('#psMoreBtn').click();await page.locator('#appMoreSheet .tms-g button',{hasText:'보관함'}).click();
    await page.waitForFunction(()=>document.body.dataset.psApp==='design');
  }else{
    assert.ok(boardReads<=10,'보이는 작전판도 같은 때의 그리기는 읽기 하나로(고친 뒤 6번 · 고치기 전 26번): '+JSON.stringify(reads));
  }
  await board.waitForFunction(n=>((document.getElementById('dfCount')||{}).textContent||'').trim()===n+'개',N,{timeout:15000});
  const names=await board.evaluate(()=>document.getElementById('drillFiles').textContent);
  for(let i=1;i<=N;i++)assert.ok(names.includes('가상 보관 자료 '+i),'보관함에 자료 '+i);
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'page errors');
  console.log(JSON.stringify({engine,size,passed:true,app,reads}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
