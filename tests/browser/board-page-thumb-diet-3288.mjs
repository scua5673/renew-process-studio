/* 3.288 — 장면별 썸네일 저장 다이어트(제보 de2e508c, studio/lib-diet.js).
   여러 페이지 작전판의 페이지 장면 썸네일(pages[].anim.frames[1…].thumb)은 저장으로 나가는 사본에서만 뗀다:
   작업 보드 기록(boardLiveCapture → liveVal) · 보관함(forSave). 화면의 페이지는 그대로이고, 저장 → 새로고침 뒤에는
   장면 줄이 보이는 칸의 그림을 다시 그린다(__afWindow). 합성 팀만 쓴다. */
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},fx=await startFixture();
SIZES.pd={engine,ctx:{viewport:{width:1280,height:860},deviceScaleFactor:1}};
try{
  const {page,logs}=await openApp(fx,'pd',{browsers});
  const board=async()=>{
    await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!!w.PSLibDiet&&w.__psPages&&w.__psPages.__psDiet===true;},null,{timeout:60000});
    return (await page.$('#fBoard')).contentFrame();
  };
  let f=await board();
  await page.waitForTimeout(800);
  /* 두 페이지 · 페이지마다 장면 여섯 · 다섯 — 장면마다 진짜 썸네일(옛 판이 저장하던 모양) */
  const seeded=await f.evaluate(()=>{
    window.__vaultBook=false;window.__vaultEdit=false;window.__vaultReadOnly=false;window.__curVaultId=null;try{stopAnim();}catch(_){}
    boardShowDefault();const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap();
    const snap=(id,x)=>({...copy(base),players:[{id,team:'blue',num:8,name:'',x,y:350},{id:id+50,team:'red',num:4,name:'',x:x+120,y:420}],equipment:[],drawings:[{type:'arrow',color:'#ffffff',pts:[{x:x,y:350},{x:x+90,y:300}]}],ball:null});
    const fr=(id,n)=>Array.from({length:n},(_,k)=>{const s=snap(id,260+k*70);return {snap:s,dur:1,cap:'장면 '+(k+1),thumb:__snapToThumb(s)};});
    const pg=(name,id,n)=>{const frames=fr(id,n);return {name,snap:copy(frames[0].snap),thumb:frames[0].thumb,anim:{frames,active:0,hold:.6,title:'',titleColor:'#e23b3b'}};};
    const pages=[pg('A',1,6),pg('B',2,5)];
    window.__pendingBoardPages={pages:copy(pages),idx:0};__psPagesConsume();
    return {thumb:pages[0].anim.frames[1].thumb.length,fat:JSON.stringify(pages).length,
      mem:(__psPages.pg()||[]).map(p=>(p.anim&&p.anim.frames||[]).map(x=>!!x.thumb)),idx:__psPages.book.idx(),frames:anim.frames.length};
  });
  assert.ok(seeded.thumb>2000,'장면 썸네일은 판 전체 SVG 다 '+seeded.thumb);
  assert.deepEqual([seeded.idx,seeded.frames],[0,6],'페이지 A 가 올라왔다 '+JSON.stringify(seeded));
  assert.deepEqual(seeded.mem[1],[true,true,true,true,true],'화면의 다른 페이지는 그림을 그대로 갖고 있다');

  /* ① 저장으로 나가는 사본 — 작업 보드 기록 · 보관함: 장면 0 과 페이지 그림만 */
  const out=await f.evaluate(()=>{
    const shape=pages=>pages.map(p=>[!!p.thumb].concat((p.anim&&p.anim.frames||[]).map(x=>!!x.thumb)));
    const xs=pages=>pages.map(p=>(p.anim&&p.anim.frames||[]).map(x=>x.snap.players[0].x));
    const c=boardLiveCapture('board'),live=JSON.parse(c.raw).boardPages,save=__psPages.forSave();
    return {live:shape(live.pages),liveX:xs(live.pages),liveLen:JSON.stringify(live.pages).length,save:shape(save),saveX:xs(save),
      mem:shape(__psPages.pg()),again:(()=>{const strip=r=>r.replace(/,"_savedAt":\d+}$/,'');return strip(boardLiveCapture('board').raw)===strip(boardLiveCapture('board').raw);})()};
  });
  const SLIM=[[true,true,false,false,false,false,false],[true,true,false,false,false,false]];
  assert.deepEqual(out.live,SLIM,'작업 보드 기록');assert.deepEqual(out.save,SLIM,'보관함 저장본');
  const X=[[260,330,400,470,540,610],[260,330,400,470,540]];
  assert.deepEqual(out.liveX,X,'판은 그대로');assert.deepEqual(out.saveX,X);
  assert.deepEqual(out.mem[1],[true,true,true,true,true,true],'화면의 페이지(메모리)는 안 바뀐다');
  assert.ok(out.liveLen<seeded.fat*0.45,'저장본이 준다 '+seeded.fat+' → '+out.liveLen);
  assert.equal(out.again,true,'같은 화면을 이어서 담으면 같은 글자 — 초안 · 구조 사본의 비교가 흔들리지 않는다');

  /* ② 저장 → 새로고침: 페이지 · 장면이 그대로 돌아오고, 보이는 칸의 그림은 다시 그려진다 */
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true,'보드 저장');
  const rec=await f.evaluate(()=>{const d=JSON.parse(_boardPrivateRecord.raw);return d.boardPages.pages.map(p=>p.anim.frames.map(x=>!!x.thumb));});
  assert.deepEqual(rec,[[true,false,false,false,false,false],[true,false,false,false,false]],'저장된 기록도 가볍다');
  await page.reload({waitUntil:'domcontentloaded'});f=await board();
  await f.waitForFunction(()=>(__psPages.pg()||[]).length===2&&anim.frames.length===6,null,{timeout:30000});
  await page.waitForTimeout(3500);
  assert.equal(await f.locator('#boardDraftBar').count(),0,'저장했으니 «저장하지 않은 작업» 띠는 없다');
  const back=await f.evaluate(()=>({x:anim.frames.map(x=>x.snap.players[0].x),caps:anim.frames.map(x=>x.cap||''),bar:document.getElementById('animBar').classList.contains('on')}));
  assert.deepEqual(back.x,X[0]);assert.deepEqual(back.caps,['장면 1','장면 2','장면 3','장면 4','장면 5','장면 6']);
  /* 장면 줄이 켜져 있어야 그림을 그린다 — 꺼져 있으면 사람처럼 켠다 */
  if(!back.bar){await f.evaluate(()=>{const b=document.getElementById('animToggle')||document.querySelector('[data-cmd="anim"],#animBtn');if(b)b.click();});await page.waitForTimeout(600);}
  const strip=()=>f.evaluate(()=>{try{__afWindow(true);}catch(_){}const k=[...document.querySelectorAll('#animFrames .anim-frame')];return {n:k.length,noThumb:k.filter(d=>d.classList.contains('no-thumb')).length,th:anim.frames.filter(x=>x.thumb).length,on:document.getElementById('animBar').classList.contains('on')};});
  /* 그림은 장면 줄 모양(필름 도크는 <img>, 옛 줄은 inline svg)과 상관없이 장면 자료의 thumb 로 본다 */
  let st=null;for(let i=0;i<40;i++){st=await strip();if(st.n===6&&st.noThumb===0&&st.th===6)break;await page.waitForTimeout(250);}
  if(st.on){assert.deepEqual([st.n,st.noThumb,st.th],[6,0,6],'장면 줄의 그림이 다시 그려졌다 '+JSON.stringify(st));}
  else assert.equal(st.n===0||st.th>=1,true,'장면 줄이 닫힌 화면 — 장면 0 의 그림은 있다 '+JSON.stringify(st));
  /* 다른 페이지로 — 그 페이지 장면도 그대로 */
  await f.locator('#boardPageStrip .bp-tab').nth(1).click();
  await f.waitForFunction(()=>__psPages.book.idx()===1&&anim.frames.length===5,null,{timeout:15000});
  assert.deepEqual(await f.evaluate(()=>anim.frames.map(x=>x.snap.players[0].x)),X[1]);
  if(st.on){for(let i=0;i<40;i++){st=await strip();if(st.n===5&&st.noThumb===0&&st.th===5)break;await page.waitForTimeout(250);}
    assert.deepEqual([st.n,st.noThumb,st.th],[5,0,5],'둘째 페이지의 장면 그림도 '+JSON.stringify(st));}
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],'no page errors '+JSON.stringify(errs));
  console.log(JSON.stringify({passed:true,engine,fat:seeded.fat,slim:out.liveLen,strip:st}));
}catch(e){console.error(e);process.exitCode=1;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}
