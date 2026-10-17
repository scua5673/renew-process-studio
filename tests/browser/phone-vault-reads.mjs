import assert from 'node:assert/strict';
import {startFixture,openApp,ready,SIZES,A,WT} from '../fixtures/team-app.mjs';
// 3.090 — 아이폰 «문제가 반복적으로 발생»(2026-10-18 · 팀 보관함 149개 36MB): 폰으로 앱을 켜면 숨은 작전판이 보관함 전체를 부팅 중에
// 수십 번 다시 읽어(셸의 «로그인 상태» 알림마다 세 번) 메모리가 넘쳤다. 이제 숨은 작전판은 보관함을 그리지 않고, 열 때 한 번 그린다.
// 보관함이 한 번 내려온 폰에서 다른 기기가 고친 자료 둘을 받으며 다시 켠다 — 작전판의 보관함 읽기를 센다. 합성 팀 fixture.
// 폰 화면은 WebKit 잡(fixture SIZES.phone), Chromium 잡은 같은 아이폰 UA · 터치로 띄운다(앱이 폰으로 판단한다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.phoneChromium={engine:'chromium',ctx:{...SIZES.phone.ctx}};
const size=engine==='webkit'?'phone':'phoneChromium';
const fx=await startFixture(),browsers={};
const N=40;
function thumb(i){let s='<svg class="board" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 680">';for(let k=0;s.length<20000;k++)s+=`<g transform="translate(${(k*37+i)%1000},${(k*53)%660})"><circle r="14"/><text y="28">가상 선수 ${k%22}</text></g>`;return s+'</svg>';}
const t0=Date.now()-86400000;
for(let i=0;i<N;i++){
  const id='LV'+String(i).padStart(3,'0');
  const it={libId:id,name:'가상 보관 자료 '+i,type:'session',savedAt:t0+i*1000,folder:'',tags:[],createdBy:A,snap:{tokens:[]},trainings:[{type:'훈련',thumb:thumb(i),snap:{tokens:[]}}]};
  fx.lib.set(WT+'|'+id,{workspace_id:WT,lib_id:id,type:'session',name:it.name,folder:'',tags:[],pin:false,item:it,saved_at:it.savedAt,deleted_at:null,private:true,owner_id:A});
}
const vaultNames=page=>page.evaluate(()=>window.storage.get('cs_drill_lib_v1').then(r=>{const v=r&&r.value,l=typeof v==='string'?JSON.parse(v):v;return Array.isArray(l)?l.map(d=>d&&d.name):[];}));
try{
  const {context,page,logs}=await openApp(fx,size,{browsers,phoneStart:true});
  // 첫 부팅 — 보관함이 이 기기에 다 내려올 때까지(폰은 회차마다 나눠 받는다)
  for(let k=0;k<20&&(await vaultNames(page)).length<N;k++){await page.evaluate(()=>PSSync.syncNow&&PSSync.syncNow('test')).catch(()=>{});await page.waitForTimeout(1500);}
  assert.equal((await vaultNames(page)).length,N,'vault on the device');
  // 다른 기기가 자료 둘을 고쳤다
  let bumped=0;for(const row of fx.lib.values())if(row.workspace_id===WT&&bumped<2){row.saved_at=Date.now();row.item={...row.item,savedAt:row.saved_at,name:row.item.name+' 고침'};bumped++;}
  // 작전판(board.html)이 보관함 전체를 IndexedDB 에서 읽는 횟수를 센다
  await context.addInitScript(()=>{
    if(!/\/studio\/board\.html$/.test(location.pathname))return;
    const g=IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get=function(k){if(k==='cs_drill_lib_v1'){try{window.top.__boardVaultReads=(window.top.__boardVaultReads||0)+1;}catch(_){}}return g.apply(this,arguments);};
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await ready(page);
  await page.waitForFunction(()=>window.storage.get('cs_drill_lib_v1').then(r=>{const v=r&&r.value;return typeof v==='string'&&(v.match(/ 고침"/g)||[]).length>=2;}),null,{timeout:30000,polling:500});
  await page.waitForTimeout(3000);
  const boot=await page.evaluate(()=>({app:document.body.dataset.psApp,reads:window.__boardVaultReads||0,boardShown:(()=>{const f=document.getElementById('fBoard');return !!f&&f.style.display!=='none';})()}));
  assert.equal(boot.app,'scout','phone opens on team › today');
  assert.equal(boot.boardShown,false,'the board frame is hidden');
  assert.ok(boot.reads<=2,'hidden board read the whole vault '+boot.reads+' times while the phone booted (was dozens before 3.090)');
  // 보관함을 열면(작전판이 보이면) 그때 그린다 — 고친 이름까지
  await page.locator('#teamBottom [data-tb="more"]').click();
  await page.locator('#teamMoreSheet [data-tb-app="design"]').click();
  const board=page.frameLocator('#fBoard');
  await board.locator('#drillFiles').getByText('가상 보관 자료 0 고침').first().waitFor({timeout:20000});
  const opened=await page.evaluate(()=>window.__boardVaultReads||0);
  assert.ok(opened-boot.reads<=2,'opening the vault draws it with one read (shared by the list and the dock), got '+(opened-boot.reads));
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'page errors');
  console.log(JSON.stringify({engine,size,passed:true,boot,opened}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
