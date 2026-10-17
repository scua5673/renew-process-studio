import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.088 — 피치를 바꾸면 모든 페이지에(오류 제보 934aaa3e «보드 설정에서 운동장 스타일을 수정하면, 해당 페이지 뿐만 아니라 모든 페이지가 적용돼야»).
// 페이지 셋인 작업 보드에서 2쪽의 피치를 바꾸면 1 · 3쪽(과 그 장면)도 · 실사 잔디도 · «내 스타일» 적용도. 규격은 페이지마다 그대로.
// 합성 팀 fixture 에서만 돈다. WebKit 은 아이패드 폭, Chromium 은 데스크톱 폭.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__psPages&&window.__psPitchAll===true&&!!document.getElementById('bpNewBoard'),null,{timeout:30000});
  await page.waitForTimeout(900);
  await f.evaluate(()=>{ window.__toasts=[]; const t=window.toast; window.toast=function(m){ window.__toasts.push(m); return t.apply(this,arguments); }; });
  const tabs=()=>f.evaluate(()=>document.querySelectorAll('#boardPageStrip .bp-tab').length);
  const go=async i=>{ await f.evaluate(i=>document.querySelectorAll('#boardPageStrip .bp-tab')[i].click(),i); await page.waitForTimeout(450); };
  const put=(id,x)=>f.evaluate(([id,x])=>{pushUndo();state.players=[{id,team:'red',num:'7',x,y:320}];renderTokens();},[id,x]);
  const saved=()=>f.evaluate(()=>(window.__psPages.forSave()||[]).map(p=>[p.snap.pitchTheme||'',p.snap.pitchImg||null,p.snap.pitchSpec||'fifa',((p.anim&&p.anim.frames)||[]).map(fr=>fr.snap.pitchTheme||'').join('|')]));
  const now=()=>f.evaluate(()=>[document.documentElement.dataset.pitch||'',state.pitchImg||null]);
  const pick=async p=>{ if(!(await f.isVisible('#pitchSeg button[data-p="'+p+'"]'))){ await f.evaluate(()=>document.getElementById('viewBtn').click()); await f.waitForSelector('#pitchSeg button[data-p="'+p+'"]',{state:'visible'}); }
    await f.click('#pitchSeg button[data-p="'+p+'"]'); await page.waitForTimeout(600); };

  // 작업 보드를 새로 — 페이지 셋(3쪽은 장면 둘 · 풋살 규격). 피치는 네이비
  await f.evaluate(()=>window.__psPages.newBoard()); await page.waitForTimeout(300);
  await f.evaluate(()=>{const ok=[...document.querySelectorAll('button')].filter(b=>(b.hasAttribute('data-ps-ok')||b.textContent.trim()==='확인'||/빈 보드로 시작/.test(b.textContent))&&b.offsetParent).pop();if(ok)ok.click();}); await page.waitForTimeout(500);
  await put('p1',300);
  for(const id of ['p2','p3']){ await f.click('#boardPageStrip .bp-add:not(#bpImportBoard):not(#bpNewBoard)'); await page.waitForTimeout(500); await put(id,400); }
  assert.equal(await tabs(),3);
  await f.evaluate(()=>{ window.__setPitchSpec&&window.__setPitchSpec('futsal'); const s=captureSnap(); window.__animLoad([{snap:s,hold:.6,dur:1},{snap:Object.assign({},s,{players:[{id:'p3',team:'red',num:'7',x:520,y:320}]}),hold:.6,dur:1}]); });
  await page.waitForTimeout(500);
  await go(1);
  let s=await saved();
  assert.deepEqual(s.map(x=>x[0]),['','',''],'처음엔 모두 네이비 '+JSON.stringify(s));

  // ① 2쪽에서 딥그린 → 1 · 3쪽(과 3쪽 장면)도
  await pick('calm');
  assert.deepEqual(await now(),['calm',null]);
  s=await saved();
  assert.deepEqual(s.map(x=>x[0]),['calm','calm','calm'],'모든 페이지 '+JSON.stringify(s));
  assert.equal(s[2][3],'calm|calm','3쪽의 장면도');
  assert.match((await f.evaluate(()=>window.__toasts.slice(-1)[0]))||'',/^피치를 페이지 3개에 모두 적용했어요$/);
  await go(0); assert.deepEqual(await now(),['calm',null],'1쪽으로 넘겨도 딥그린');
  await go(2); assert.deepEqual(await now(),['calm',null],'3쪽도');
  assert.deepEqual(s.map(x=>x[2]),['fifa','fifa','futsal'],'규격은 페이지마다 그대로(3쪽만 풋살)');
  await page.screenshot({path:path.join(SHOTS,`board-pitch-all-${engine}-${size}-1-calm.png`)});

  // ② 3쪽에서 잔디(실사 바탕) → 모두 실사
  await pick('real');
  s=await saved();
  assert.deepEqual(s.map(x=>[x[0],x[1]]),[['grass','@real'],['grass','@real'],['grass','@real']],'실사 바탕도 '+JSON.stringify(s));
  assert.match(await f.evaluate(()=>window.__toasts.slice(-1)[0]),/^피치를 페이지 3개 · 장면 2개에 모두 적용했어요$/,'장면이 있는 페이지에서는 장면도 센다');
  await go(0); assert.deepEqual(await now(),['grass','@real']);

  // ③ «내 스타일» — 화이트로 저장해 두고, 네이비로 바꾼 뒤 적용하면 모든 페이지가 화이트
  await pick('white');
  assert.equal(await f.evaluate(()=>lookPresetSave('가상 화이트')),true);
  await pick('navy');
  assert.deepEqual((await saved()).map(x=>x[0]),['','',''],'네이비로');
  assert.equal(await f.evaluate(()=>lookPresetApply('가상 화이트')),true);
  await page.waitForTimeout(400);
  s=await saved();
  assert.deepEqual(s.map(x=>[x[0],x[1]]),[['white',null],['white',null],['white',null]],'내 스타일도 모든 페이지 '+JSON.stringify(s));
  await go(1); assert.deepEqual(await now(),['white',null]);
  await page.screenshot({path:path.join(SHOTS,`board-pitch-all-${engine}-${size}-2-white.png`)});

  // ④ 한 페이지 보드 — 그대로(오류 없이 피치만)
  await f.evaluate(()=>window.__psPages.newBoard()); await page.waitForTimeout(300);
  await f.evaluate(()=>{const ok=[...document.querySelectorAll('button')].filter(b=>(b.hasAttribute('data-ps-ok')||b.textContent.trim()==='확인'||/빈 보드로 시작/.test(b.textContent))&&b.offsetParent).pop();if(ok)ok.click();}); await page.waitForTimeout(500);
  await f.evaluate(()=>{ window.__toasts=[]; });
  await pick('calm');
  assert.deepEqual([await tabs()<=1,(await now())[0]],[true,'calm']);
  assert.ok(!(await f.evaluate(()=>window.__toasts)).some(t=>/페이지/.test(t)),'페이지가 하나면 «페이지» 알림 없음');

  // ⑤ 미팅(오류 제보 83a6a38b) — 보관함의 미팅 자료를 편집해 2번 슬라이드에서 딥그린 → 슬라이드 셋(과 3번 슬라이드의 장면) 모두
  const msnap=n=>({pitchSpec:'fifa',players:[{id:'m'+n,team:'blue',num:String(n),x:300+n*40,y:300}],equipment:[],drawings:[],ball:{x:500,y:340},lines:true,gridType:'off',tokenScale:.6,label:'num',tokShape:'circle',orientation:'v',area:'full',pitchView:'full',pitchN:1,tokV:2,pitchTheme:''});
  const MEET={libId:'Vmeetpitch3088',type:'meeting',name:'가상 피치 미팅',folder:'',tags:[],savedAt:Date.now(),thumb:'',snap:msnap(1),
    slides:[1,2,3].map(n=>({title:'슬라이드 '+n,points:[],snap:msnap(n),thumb:'',...(n===3?{frames:[{snap:msnap(3),hold:.6,dur:1},{snap:msnap(4),hold:.6,dur:1}]}:{})}))};
  await f.evaluate(async d=>{ const lib=await libGet(); stampCreator(d); lib.unshift(d); await libWrite(lib); libTouch(); },MEET);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000}); await page.waitForTimeout(700);
  await f.evaluate(()=>{ try{renderDrillFiles();}catch(_){} const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('가상 피치 미팅')); [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click(); });
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&window.__meet&&anim.slides.length===3,null,{timeout:20000}); await page.waitForTimeout(1200);
  if(await f.evaluate(()=>document.body.classList.contains('meeting-page-mode'))){ await f.evaluate(()=>window.__meetingPageEdit()); await page.waitForTimeout(1000); }
  await f.evaluate(()=>{ if(window.__meet.idx()!==1)window.__meet.go(1); }); await page.waitForTimeout(700);
  await f.evaluate(()=>{ window.__toasts=[]; });
  await pick('calm'); await page.waitForTimeout(600);
  const sl=await f.evaluate(()=>anim.slides.map(x=>[x.snap.pitchTheme,(x.frames||[]).map(y=>y.snap.pitchTheme).join('|'),!!x.thumb]));
  assert.deepEqual(sl,[['calm','',true],['calm','',true],['calm','calm|calm',true]],'슬라이드 셋 모두 · 3번의 장면도 · 그림도 다시 '+JSON.stringify(sl));
  assert.ok((await f.evaluate(()=>window.__toasts)).includes('피치를 슬라이드 3장에 모두 적용했어요'));
  await f.evaluate(()=>window.__meet.go(0)); await page.waitForTimeout(600);
  assert.equal((await now())[0],'calm','1번 슬라이드로 가도 딥그린');
  await page.screenshot({path:path.join(SHOTS,`board-pitch-all-${engine}-${size}-3-meeting.png`)});

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
