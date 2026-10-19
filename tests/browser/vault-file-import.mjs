import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,A,SHOTS} from '../fixtures/team-app.mjs';
// 3.114 — 보관함 «＋ 만들기 › 파일에서 가져오기»(studio/board-vault-import.js). 사용자 «여기에 있는 훈련들 프로세스 스튜디오로 만들고 싶어» —
// 만든 훈련 파일(드릴 팩 JSON)을 넣을 단추가 화면에 없었다(받는 importDrillPack 은 숨은 옛 라이브러리 창에만). 합성 팀 fixture 에서만 돈다.
// ① 창에 줄이 붙는다 ② 누르면 창이 닫히고 파일 창이 열린다 ③ 고른 파일의 카드가 훈련 · 장면 · 폴더째 들어오고 그 폴더가 열린다
// ④ 파일 안의 그림 · 바깥 주소 · 남의 도장은 들어오지 않는다 ⑤ 드릴 팩이 아닌 파일은 아무것도 넣지 않는다 ⑥ 보기 전용이면 줄이 없다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const snap=k=>({pitchSpec:'grid30',players:[{id:101,team:'blue',num:'6',x:400+k*30,y:300,img:'https://outside.invalid/p.png'},{id:201,team:'red',num:'',x:520,y:330}],
  equipment:[{id:900,team:'cone',x:300,y:300,src:'javascript:void(0)',scale:.5,rot:0}],drawings:[],ball:{x:410+k*30,y:310,scale:.62},orientation:'h',area:'full',pitchView:'full',pitchN:1,tokV:2});
const tr=(i,n)=>({type:'train',name:'가상 연습 '+(i+1),minutes:15,sets:1,rpe:5,focus:'poss',method:'가상 방법 '+(i+1),coaching:'1. 가상 포인트 '+(i+1),
  thumb:'<svg xmlns="http://www.w3.org/2000/svg" onload="window.__viHit=1"><text>밖에서 온 그림</text></svg>',snap:snap(0),animIdx:0,
  frames:Array.from({length:n},(_,s)=>({snap:snap(s),hold:.6,dur:1.2,hl:[101],cap:'가상 장면 '+(s+1)}))});
const card=(name,n)=>({name,type:'train',focus:'poss',folder:'가상 가져온 폴더',libId:'Lold',createdBy:'someone-else',createdByName:'남',fav:true,_teamOwner:'someone-else',
  thumb:'<svg onload="window.__viHit=1"></svg>',snap:snap(0),trainings:[tr(0,n),tr(1,n+1)],frames:[]});
const pack={type:'process-studio-drillpack',version:1,date:'2026-10-19T00:00:00.000Z',drills:[card('가상 가져오기 1',4),card('가상 가져오기 2',5)]};
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.PSVaultImport&&typeof importDrillPack==='function'&&typeof renderDrillFiles==='function'&&!!document.getElementById('dfNew'));
  await page.waitForTimeout(1200);
  const lib=()=>f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).filter(d=>d&&/^가상 가져오기/.test(d.name||'')));
  const openChooser=async()=>{ await f.evaluate(()=>document.getElementById('dfNew').click()); await f.waitForSelector('#vCreateChooser #vccImportRow'); };

  // ① 줄 — «예시 담기»와 같은 모양, 화면 안, 손가락 크기
  await openChooser();
  const row=await f.evaluate(()=>{const r=document.getElementById('vccImportRow'),b=document.getElementById('vccImport'),rb=r.getBoundingClientRect(),bb=b.getBoundingClientRect();
    return {text:r.textContent,btn:b.textContent,cls:r.className,inGrid:!!r.closest('#vccGrid'),left:Math.round(rb.left),right:Math.round(rb.right),vw:innerWidth,h:Math.round(bb.height)};});
  assert.match(row.text,/파일에서 가져오기/);
  assert.match(row.text,/내보낸 파일\(\.json\)/);
  assert.equal(row.btn,'파일 고르기');
  assert.equal(row.cls,'vcc-ex','예시 담기 줄과 같은 모양');
  assert.equal(row.inGrid,false,'만들기 종류 칸이 아니라 그 아래 줄');
  assert.ok(row.left>=0&&row.right<=row.vw,'화면 안 '+JSON.stringify(row));
  assert.ok(row.h>=34,'단추 높이 '+row.h);
  await page.screenshot({path:path.join(SHOTS,'vault-file-import-'+engine+'-chooser.png')});

  // ② 누르면 창이 닫히고 파일 창이 열린다 → ③ 고른 파일이 들어온다
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),f.click('#vccImport')]);
  assert.equal(await f.evaluate(()=>!!document.getElementById('vCreateChooser')),false,'만들기 창은 닫혔다');
  await chooser.setFiles({name:'가상-드릴팩.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});
  /* 보관함 읽기는 비동기라 waitForFunction(async …) 대신 여기서 돌려 본다(async 판정은 약속 자체가 참으로 읽혀 곧바로 지나간다) */
  let got=[];
  for(let i=0;i<80&&got.length<2;i++){ await page.waitForTimeout(250); got=await lib(); }
  assert.match(await f.evaluate(()=>(document.getElementById('hint')||{}).textContent||''),/2개 드릴 가져옴/);
  assert.deepEqual(got.map(d=>[d.name,d.folder,d.trainings.length,d.trainings.map(t=>t.frames.length).join('/')]).sort(),
    [['가상 가져오기 1','가상 가져온 폴더',2,'4/5'],['가상 가져오기 2','가상 가져온 폴더',2,'5/6']],'카드 · 폴더 · 훈련 · 장면이 그대로');
  assert.deepEqual(got[0].trainings.map(t=>[t.method,t.coaching,t.frames[1].cap]).sort(),[['가상 방법 1','1. 가상 포인트 1','가상 장면 2'],['가상 방법 2','1. 가상 포인트 2','가상 장면 2']]);
  // ④ 걸러진 것
  const json=JSON.stringify(got);
  for(const bad of ['onload','밖에서 온 그림','outside.invalid','javascript:','someone-else','_teamOwner'])assert.equal(json.includes(bad),false,'보관함에 «'+bad+'» 가 없다');
  assert.ok(got.every(d=>d.libId&&d.libId!=='Lold'&&!d.fav),'새 번호 · 표식 없음');
  assert.ok(got.every(d=>!d.createdBy||d.createdBy===A),'남의 도장이 아니다 '+JSON.stringify(got.map(d=>d.createdBy)));
  // 가져온 폴더가 열리고 카드가 보인다(그림은 보관함이 장면에서 그린다)
  await f.waitForFunction(()=>{const t=(document.getElementById('drillFiles')||{}).textContent||'';return /가상 가져오기 1/.test(t)&&/가상 가져오기 2/.test(t);});
  assert.equal(await f.evaluate(()=>libFilter.folder),'가상 가져온 폴더');
  await page.waitForTimeout(800);
  assert.equal(await f.evaluate(()=>window.__viHit),undefined,'파일 안의 그림은 한 번도 그려지지 않았다');
  await page.screenshot({path:path.join(SHOTS,'vault-file-import-'+engine+'-folder.png')});
  // 같은 파일을 다시 넣으면 중복은 건너뛴다(보관함 importDrillPack 그대로)
  await openChooser();
  const [ch2]=await Promise.all([page.waitForEvent('filechooser'),f.click('#vccImport')]);
  await ch2.setFiles({name:'가상-드릴팩.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});
  await page.waitForTimeout(1500);
  assert.equal((await lib()).length,2,'같은 카드는 두 번 들어오지 않는다');
  // 서버(보관함 표)에도 올라간다
  await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  assert.ok(got.every(c=>[...fx.lib.values()].some(r=>r.lib_id===c.libId)),'보관함 서버 표에 두 카드가 있다');

  // ⑤ 드릴 팩이 아닌 파일 — 아무것도 넣지 않고 알려 준다
  const before=(await f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).length));
  for(const [name,body] of [['깨진.json','{not json'],['다른.json',JSON.stringify({type:'something-else',drills:[{name:'가상 다른 것'}]})]]){
    await openChooser();
    const [ch]=await Promise.all([page.waitForEvent('filechooser'),f.click('#vccImport')]);
    await ch.setFiles({name,mimeType:'application/json',buffer:Buffer.from(body)});
    await f.waitForFunction(()=>/내보낸 파일\(\.json\)이 아니에요/.test((document.getElementById('hint')||{}).textContent||''),null,{timeout:8000});
  }
  assert.equal(await f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).length),before,'아무것도 들어오지 않았다');

  // ⑥ 보기 전용 — 줄이 없다
  await f.evaluate(()=>document.body.classList.add('ps-viewonly'));
  await f.evaluate(()=>document.getElementById('dfNew').click());
  await f.waitForSelector('#vCreateChooser');
  assert.equal(await f.evaluate(()=>!!document.getElementById('vccImportRow')),false,'보기 전용에서는 가져오기 줄이 없다');
  await f.evaluate(()=>{document.querySelector('#vCreateChooser .vcc-x').click();document.body.classList.remove('ps-viewonly');});

  const errs=logs.filter(l=>l.type==='pageerror');
  assert.deepEqual(errs,[],'페이지 오류 없음');
  fs.writeFileSync(path.join(SHOTS,'..','vault-file-import-'+engine+'.json'),JSON.stringify({ok:true,engine,cards:got.map(d=>d.name)},null,1));
  console.log('vault-file-import ok · '+engine);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
