import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.120 — 훈련 편집기의 평면 · 3D 를 훈련마다(board-edit-view.js). 사용자 «훈련 편집 들어가면 기본은 평면보드로 나오게» ·
// «보드설정에서 수정을 하면 각각 저장이 되게». ① 3D 로 쓰는 기기에서 보관함 훈련을 열어도 평면(예전엔 3.035 처리가 openEditor 에만 있어 3D 로 열렸다)
// ② 훈련 1 에서만 3D · 선수 모양을 바꾸면 훈련 2 는 그대로, 기기 설정 값은 그대로 ③ 저장하면 훈련마다 남고 다시 열면 그대로
// ④ 나가면 들어오기 전 보기로. 합성 팀 fixture 에서만 돈다. 데스크톱 폭(3D 는 데스크톱에서만 저절로 켠다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers,tilt3d:true});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  // 3.101 — 내 작업판을 다 불러온 뒤에
  await f.waitForFunction(()=>window.__psEditView&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&document.body.classList.contains('bc-tilt3d'),null,{timeout:30000});
  await page.waitForTimeout(800);
  const libId='ev3120';
  await f.evaluate(async libId=>{const lib=(await boardStore.get('cs_drill_lib_v1'))||[];
    const sn=n=>({players:[{id:'p'+n,team:'red',num:String(n),x:300+n*40,y:300}],equipment:[],drawings:[],ball:{x:500,y:300},pitchTheme:'train'});
    lib.push({libId,name:'10월 20일 훈련',type:'train',savedAt:Date.now()-5000,snap:sn(1),trainings:[{name:'3팀 론도',type:'train',snap:sn(1)},{name:'공격 패턴',type:'train',snap:sn(2)}]});
    await libWrite(lib);},libId);
  const st=()=>f.evaluate(()=>({tilt:document.body.classList.contains('bc-tilt3d'),ls:localStorage.getItem('ps_board_tilt3d'),editing:document.body.classList.contains('editing'),idx:editorTrainIdx,shape:tokShape}));
  const open=async()=>{await f.evaluate(id=>openLibDrawEditor(id,false),libId);await f.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(700);};

  // ① 보관함 훈련도 평면으로
  await open();
  let s=await st();assert.equal(s.tilt,false,'보관함 훈련은 평면으로 '+JSON.stringify(s));assert.equal(s.ls,'1','기기 설정 값은 그대로');

  // ② 훈련 1 에서만 3D · 유니폼 모양
  await f.evaluate(()=>{window.__setTilt(true);setTokShape('shirt');renderTokens();});await page.waitForTimeout(400);
  s=await st();assert.equal(s.tilt,true);assert.equal(s.ls,'1','편집기 안의 3D 는 기기 설정을 바꾸지 않는다');
  await page.screenshot({path:path.join(SHOTS,'board-edit-view-'+engine+'.png')});
  await f.evaluate(()=>switchTraining(1));await page.waitForTimeout(400);
  s=await st();assert.deepEqual([s.idx,s.tilt,s.shape],[1,false,'circle'],'훈련 2 는 그대로(평면 · 원형) '+JSON.stringify(s));
  await f.evaluate(()=>switchTraining(0));await page.waitForTimeout(400);
  s=await st();assert.deepEqual([s.idx,s.tilt,s.shape],[0,true,'shirt'],'훈련 1 로 돌아오면 다시 3D · 유니폼 '+JSON.stringify(s));
  // 임시본에도 바로 남는다(비동기 저장소라 시험 쪽에서 몇 번 읽는다 — 3.114)
  const work=await f.evaluate(async libId=>{for(let i=0;i<30;i++){const w=await boardStore.get('cs_editor_work_v1');const t=w&&w[libId]&&w[libId].trainings;const v=t&&t[0]&&t[0].scenes&&t[0].scenes[0].snap&&t[0].scenes[0].snap.edTilt;if(v===true)return v;await new Promise(r=>setTimeout(r,250));}return null;},libId);
  assert.equal(work,true,'임시본(cs_editor_work_v1)의 훈련 1 = 3D');

  // ③ 저장 → 훈련마다 남고, 다시 열면 그대로 ④ 나가면 들어오기 전 보기(3D)
  await f.evaluate(()=>document.getElementById('editorDone').click());
  await f.waitForFunction(()=>!document.body.classList.contains('editing'));await page.waitForTimeout(900);
  s=await st();assert.equal(s.tilt,true,'나가면 기기 보기(3D) '+JSON.stringify(s));
  const saved=await f.evaluate(async libId=>{for(let i=0;i<20;i++){const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.libId===libId);const t=d&&d.trainings;if(t&&t[0]&&t[0].snap&&t[0].snap.edTilt===true)return t.map(x=>[x.snap.edTilt,x.snap.tokShape]);await new Promise(r=>setTimeout(r,250));}return null;},libId);
  assert.deepEqual(saved,[[true,'shirt'],[false,'circle']],'훈련마다 저장');
  // 기기를 평면으로 바꿔도 3D 로 저장한 훈련은 3D 로 열린다
  await f.evaluate(()=>window.__setTilt(false,{quiet:true}));await page.waitForTimeout(400);
  await open();
  s=await st();assert.deepEqual([s.idx,s.tilt,s.shape,s.ls],[0,true,'shirt','0'],'저장한 3D 훈련 '+JSON.stringify(s));
  await f.evaluate(()=>switchTraining(1));await page.waitForTimeout(400);
  s=await st();assert.equal(s.tilt,false,'다른 훈련은 평면');
  await f.evaluate(()=>closeEditor(false));await f.waitForFunction(()=>!document.body.classList.contains('editing'));await page.waitForTimeout(700);
  s=await st();assert.equal(s.tilt,false,'나가면 기기 보기(평면) '+JSON.stringify(s));assert.equal(s.ls,'0');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true,saved}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
