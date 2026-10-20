import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.122 — 오류 제보 b4578ca1 «보관함에 있는 다른 걸 눌렀는데 기존 내 애니메이션에 덮혀서 … 결국 페이지를 삭제».
//  예전: 페이지 줄 «보드 가져오기»에서 작전판을 고르면 그 첫 페이지 판과 장면이 **지금 페이지**를 덮었다(되돌리기 한 칸).
//  이제: 지금 페이지에 내용(선수 · 장비 · 그림 · 장면 2개 이상)이 있으면 바로 뒤 새 페이지로 가져온다 — 원래 페이지 · 장면은 그대로.
//        빈 페이지면 그 자리에. 새 페이지를 못 만들면 덮기 전에 묻는다. 맥이 아니면 안내가 «Ctrl+Z».
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&typeof _boardPrivateLoaded!=='undefined'&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psImportSafe&&openBoardImport.__psSafe,null,{timeout:30000});
  const shot=n=>page.screenshot({path:path.join(SHOTS,`board-import-safe-${engine}-${size}-${n}.png`)});
  // 보관함에 «가져올 판»(선수 1명 x=900 · 장면 둘) 하나
  await bf.evaluate(async()=>{ const lib=await libGet(),sn=x=>({players:[{id:1,team:'red',num:9,x,y:200}],equipment:[],drawings:[],ball:null,pitchN:1});
    lib.unshift({libId:'VIMPSAFE',type:'board',name:'가져올 판',folder:'',thumb:'',tags:[],savedAt:Date.now(),snap:sn(900),frames:[{snap:sn(900),dur:1},{snap:sn(700),dur:1}]});
    await libWrite(lib); try{libTouch();}catch(_){} });
  // 지금 페이지: 내 장면 셋(우리 선수 x 200 → 400 → 600)
  await bf.evaluate(()=>{ const sn=x=>({players:[{id:1,team:'blue',num:8,x,y:300}],equipment:[],drawings:[],ball:null,pitchN:1});
    loadSnap(sn(200)); __animLoad([{snap:sn(200),dur:1},{snap:sn(400),dur:1},{snap:sn(600),dur:1}]); renderTokens(); });
  const info=()=>bf.evaluate(()=>{ const pi=window.__psPages.pageInfo(),ex=window.__psPages.exportList();
    return {idx:pi?pi.idx:0,count:pi?pi.count:1,cur:state.players.map(p=>p.team+':'+p.x),frames:(anim.frames||[]).length,
      pages:ex?ex.map(p=>p.frames.map(f=>f.snap.players.map(q=>q.team+':'+q.x).join('|')).join(' > ')):null}; });
  const before=await info();
  assert.deepEqual([before.count,before.frames,before.cur],[1,3,['blue:200']],JSON.stringify(before));
  const openImport=async()=>{ await bf.evaluate(()=>{ window.__t=[];const t0=window.toast;window.toast=function(m){window.__t.push(String(m));return t0.apply(this,arguments);};document.getElementById('bpImportBoard').click(); });
    await bf.waitForFunction(()=>{const o=document.getElementById('bdImportOverlay');return o&&[...o.querySelectorAll('button')].some(b=>b.textContent.includes('가져올 판')&&b.onclick&&b.onclick.__psSafe);},null,{timeout:12000}); };
  const pick=()=>bf.evaluate(()=>[...document.getElementById('bdImportOverlay').querySelectorAll('button')].find(b=>b.textContent.includes('가져올 판')).click());

  // 1) 내용 있는 페이지에서 가져오기 → 새 페이지(2번째)로, 1페이지 장면 셋 그대로
  await openImport();
  const desc=await bf.evaluate(()=>document.getElementById('bdImportOverlay').textContent);
  assert.match(desc,/내용이 있으면 새 페이지로 가져와요/,desc);
  if(!/Mac/.test(await bf.evaluate(()=>navigator.platform)))assert.match(desc,/Ctrl\+Z/,'맥이 아니면 Ctrl+Z');
  await shot('1-sheet');
  await pick();await page.waitForTimeout(500);
  let now=await info();
  assert.deepEqual([now.count,now.idx,now.cur],[2,1,['red:900']],JSON.stringify(now));
  assert.equal(now.pages[0],'blue:200 > blue:400 > blue:600','원래 페이지 장면 셋 그대로');
  assert.equal(now.pages[1],'red:900 > red:700','가져온 판은 새 페이지에');
  assert.ok((await bf.evaluate(()=>window.__t)).some(m=>/새 페이지\(2번째\)로 가져왔어요 · 원래 페이지는 그대로/.test(m)));
  await shot('2-new-page');

  // 2) 빈 페이지에서는 예전처럼 그 자리에
  await bf.evaluate(()=>[...document.getElementById('boardPageStrip').querySelectorAll('button.bp-add')].find(b=>/^＋/.test(b.textContent.trim())).click());
  await page.waitForTimeout(300);
  now=await info();assert.deepEqual([now.count,now.idx,now.cur.length],[3,2,0],'＋ 페이지 = 빈 페이지 '+JSON.stringify(now));
  await openImport();await pick();await page.waitForTimeout(400);
  now=await info();assert.deepEqual([now.count,now.idx,now.cur],[3,2,['red:900']],'빈 페이지에는 그 자리에 '+JSON.stringify(now));
  if(!/Mac/.test(await bf.evaluate(()=>navigator.platform)))assert.ok((await bf.evaluate(()=>window.__t)).some(m=>/가져옴.*Ctrl\+Z 되돌리기/.test(m)&&!/⌘Z/.test(m)),'알림도 Ctrl+Z');

  // 3) 새 페이지를 못 만들면(＋ 페이지 단추가 없음) 묻고, 취소하면 그대로
  await bf.evaluate(()=>window.__psPages.pageNav(-2));await page.waitForTimeout(300);
  now=await info();assert.deepEqual([now.idx,now.cur],[0,['blue:200']]);
  await openImport();
  await bf.evaluate(()=>{ const a=[...document.getElementById('boardPageStrip').querySelectorAll('button.bp-add')].find(b=>/^＋/.test(b.textContent.trim())); a.textContent='(시험) 없음'; });
  await pick();await page.waitForTimeout(300);
  const asked=await bf.evaluate(()=>[...document.body.querySelectorAll('div')].some(d=>/새 페이지를 더 만들 수 없어/.test(d.textContent)&&d.offsetParent));
  assert.equal(asked,true,'덮기 전에 묻는다');
  await shot('3-ask');
  await bf.evaluate(()=>{ const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/^취소$/.test(b.textContent.trim())).pop(); b.click(); });
  await page.waitForTimeout(300);
  now=await info();assert.deepEqual([now.count,now.idx,now.cur,now.pages[0]],[3,0,['blue:200'],'blue:200 > blue:400 > blue:600'],'취소하면 그대로 '+JSON.stringify(now));
  console.log(JSON.stringify({ok:true,engine,size}));
}finally{ for(const b of Object.values(browsers))await b.close().catch(()=>{}); await fx.close?.(); }
