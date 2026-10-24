import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.132 — 사용자 «미팅자료 만들때 처음에 운동장을 고르게 하자 피치와 전술구역 운동장 가로 세로 · 미팅 자료 토큰은 지금보다 1단계 크게».
// 새 미팅 창(board-meet-form.js) 맨 위의 «운동장»(피치 · 구역 · 방향)이 모든 장에 들어가고, 토큰은 작전판보다 «＋» 한 칸 크다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
let cur='';
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSMeetForm&&window.__meetSeed&&window.__meetSeed.__psForm&&window.__meetingFromMatch&&window.__meetingFromMatch.__psForm,null,{timeout:30000});
  await f.evaluate(()=>{try{localStorage.removeItem('ps_meet_form_v1');localStorage.removeItem('ps_meet_orient_v2');}catch(_){}});
  // 작업 보드 토큰 크기 — 새 미팅은 이보다 «＋» 한 칸
  const want=await f.evaluate(()=>{const v=Math.max(+state.tokenScale||0,Math.min(.4,defaultTokenScale()));return {board:+state.tokenScale,big:PSMeetForm.bumpTok(tokScaleLevels(),v)};});
  assert.ok(want.big>want.board,'한 칸 크다 '+JSON.stringify(want));
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'),null,{timeout:30000});
  const newMeeting=async()=>{
    await f.evaluate(()=>document.getElementById('dfNew').click());
    await f.waitForSelector('.vcc-item');
    await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
    await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
    await f.waitForFunction(()=>{const o=document.getElementById('psMeetForm');return o&&o.classList.contains('on')&&o.getBoundingClientRect().width>0;},null,{timeout:10000});
    await f.click('#psMeetForm [data-start=filled]'); // 기존 포메이션 검사는 기본 자료 포함으로 시작

  };
  const look=()=>f.evaluate(()=>({o:window.__psMeetFormLook(),on:[...document.querySelectorAll('#psMeetForm .mf-lc>.on')].map(b=>b.closest('[data-look]').getAttribute('data-look')+':'+b.getAttribute('data-v')),
    rows:[...document.querySelectorAll('#psMeetForm .mf-lc')].map(r=>r.getAttribute('data-look')+'='+[...r.children].map(b=>b.textContent).join('/')),
    title:document.querySelector('#psMeetForm .mf-hd b').textContent,vpv:!!document.querySelector('#psMeetForm .mf-pv.v')}));
  const slides=()=>f.evaluate(()=>anim.slides.map(s=>[(s.snap.pitchTheme||'')+(s.snap.pitchImg?'+'+s.snap.pitchImg:''),s.snap.gridType,s.snap.orientation,s.pdfOrientation,s.snap.tokenScale,s.snap.tokV,/<svg/.test(s.thumb||'')].join('|')));

  cur='vault-default';
  await newMeeting();
  let st=await look();
  assert.equal(st.title,'미팅 자료 만들기');
  assert.deepEqual(st.rows,['pitch=네이비/잔디/딥그린/화이트/훈련/직접','grid=없음/채널/격자/1/3/존/15존','oh=가로/세로']);
  assert.deepEqual(st.o,{pitch:'navy',custom:null,grid:'grid15',oh:'v',lookOnly:false},'처음엔 네이비 · 15존 · 미팅 방향(세로형)');
  assert.deepEqual(st.on,['pitch:navy','grid:grid15','oh:v']);assert.equal(st.vpv,true,'미리보기도 세로');
  // 창을 닫아도 토큰은 한 칸 크게 채워져 있다
  assert.deepEqual([...new Set(await slides())],['|grid15|v|portrait|'+want.big+'|2|true']);
  // 고르면 미리보기가 바뀐다
  await f.click('#psMeetForm [data-look="pitch"] [data-v="white"]');await f.click('#psMeetForm [data-look="grid"] [data-v="grid"]');await f.click('#psMeetForm [data-look="oh"] [data-v="h"]');
  await f.click('#psMeetForm [data-team="us"] [data-k="4231"]');
  st=await look();assert.deepEqual(st.o,{pitch:'white',custom:null,grid:'grid',oh:'h',lookOnly:false});assert.equal(st.vpv,false);
  assert.ok(await f.evaluate(()=>/fill="#ffffff"/.test(document.querySelector('#psMeetForm .mf-pic').innerHTML)),'미리보기 흰 운동장');
  await page.screenshot({path:path.join(SHOTS,`meeting-pitch-pick-${engine}-${size}-dialog.png`)});
  await f.click('#psMeetForm .mf-go');
  await f.waitForFunction(()=>!document.querySelector('#psMeetForm.on'));
  await f.waitForFunction(()=>anim.slides.every(s=>s.snap.pitchTheme==='white'),null,{timeout:10000});
  assert.deepEqual([...new Set(await slides())],['white|grid|h|landscape|'+want.big+'|2|true'],'9장 모두 화이트 · 격자 · 가로');
  st=await f.evaluate(()=>({pitch:document.documentElement.dataset.pitch,grid:state.gridType,o:state.orientation,tok:state.tokenScale,pref:localStorage.getItem('ps_meet_orient_v2'),
    blue:anim.slides[2].snap.players.filter(p=>p.team==='blue').map(p=>p.pos).sort().join(','),mem:JSON.parse(localStorage.getItem('ps_meet_form_v1')).look}));
  assert.deepEqual(st,{pitch:'white',grid:'grid',o:'h',tok:want.big,pref:'landscape',blue:'AM,GK,LB,LCB,LDM,LM,RB,RCB,RDM,RM,ST',mem:{pitch:'white',grid:'grid',custom:null}},JSON.stringify(st));
  await page.screenshot({path:path.join(SHOTS,`meeting-pitch-pick-${engine}-${size}-meeting.png`)});

  cur='vault-remembered';
  await f.evaluate(()=>{window.__bmExitMeeting();});
  await f.waitForFunction(()=>!document.body.classList.contains('meet-mode'));
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'),null,{timeout:30000});
  await newMeeting();
  assert.deepEqual((await look()).o,{pitch:'white',custom:null,grid:'grid',oh:'h',lookOnly:false},'이 기기에서 마지막으로 고른 운동장 · 방향');
  await f.click('#psMeetForm [data-look="pitch"] [data-v="real"]');await f.click('#psMeetForm [data-look="grid"] [data-v="grid15"]');
  await f.click('#psMeetForm .mf-go');
  await f.waitForFunction(()=>anim.slides.every(s=>s.snap.pitchTheme==='grass'),null,{timeout:10000});
  assert.deepEqual([...new Set(await slides())],['grass+@real|grid15|h|landscape|'+want.big+'|2|true'],'잔디(실사 타일)');
  assert.equal(await f.evaluate(()=>document.documentElement.dataset.pitch+'|'+state.pitchImg),'grass|@real');

  cur='match';
  const lib=name=>f.evaluate(async n=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.name===n);
    return d&&d.slides.map(s=>[(s.snap.pitchTheme||'')+(s.snap.pitchImg?'+'+s.snap.pitchImg:''),s.snap.gridType,s.snap.orientation,s.pdfOrientation,s.snap.tokenScale,s.snap.tokV].join('|'));},name);
  const sp=[{title:'상대 분석',us:[{x:30,y:50,num:'9',pos:'ST'}],opp:[{x:60,y:40,num:'4',pos:'CB'}],points:[]}];
  await f.evaluate(sp=>{window.__mfr=window.__meetingFromMatch({template:true,name:'가상 상대전 미팅',slides:sp});},sp);
  await f.waitForFunction(()=>document.querySelector('#psMeetForm.on'));
  assert.deepEqual((await look()).o,{pitch:'real',custom:null,grid:'grid15',oh:'h',lookOnly:false});
  // «직접» — 원하는 색(사용자 «피치 원하는 색상도 선택 가능하게»). 칩 위의 색 고르개에 색을 넣는다
  assert.equal(await f.evaluate(()=>{const r=document.querySelector('#psMeetForm [data-v="custom"] input[type=color]').getBoundingClientRect(),c=document.querySelector('#psMeetForm [data-v="custom"]').getBoundingClientRect();return Math.abs(r.width-c.width)<=2.5&&Math.abs(r.height-c.height)<=2.5?true:JSON.stringify([r.width,r.height,c.width,c.height]);}),true,'고르개가 칩 안쪽 전체를 덮는다(누르면 바로 열린다 — 테두리 1px 안쪽)');
  await f.evaluate(()=>{const i=document.querySelector('#psMeetForm [data-v="custom"] input');i.value='#c2410c';i.dispatchEvent(new Event('input',{bubbles:true}));});
  st=await look();assert.deepEqual(st.o,{pitch:'custom',custom:'#c2410c',grid:'grid15',oh:'h',lookOnly:false});assert.ok(st.on.includes('pitch:custom'));
  assert.ok(await f.evaluate(()=>/fill="#c2410c"/.test(document.querySelector('#psMeetForm .mf-pic').innerHTML)&&document.querySelector('#psMeetForm [data-v="custom"] i').style.background!==''),'미리보기 · 칩 색');
  await f.click('#psMeetForm [data-look="grid"] [data-v="off"]');await f.click('#psMeetForm [data-look="oh"] [data-v="v"]');
  await f.click('#psMeetForm .mf-go');
  await f.waitForFunction(()=>window.__mfr instanceof Promise||window.__mfr===true);
  assert.equal(await f.evaluate(async()=>await window.__mfr),true);
  let made=await lib('가상 상대전 미팅');
  assert.equal(made.length,10,'경기 장면 1 + 기본 9장');
  assert.equal(new Set(made.map(r=>r.split('|').slice(0,4).join('|'))).size,1,JSON.stringify(made));
  assert.equal(made[0].split('|').slice(0,4).join('|'),'custom|off|v|portrait','경기 장면까지 직접 색 · 구역 없음 · 세로');
  assert.deepEqual(await f.evaluate(async()=>[...new Set(((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.name==='가상 상대전 미팅').slides.map(s=>s.snap.pitchCustom))]),['#c2410c']);
  await f.waitForFunction(()=>document.documentElement.dataset.pitch==='custom'&&document.documentElement.style.getPropertyValue('--pitchbg').trim()==='#c2410c',null,{timeout:10000});
  assert.ok(made.every(r=>+r.split('|')[4]>0&&r.split('|')[5]==='2'),'토큰 크기 · tokV');
  assert.equal(await f.evaluate(()=>window.__meetLook),null,'바탕 덮개는 만든 뒤 걷는다');
  // «기본 그대로»는 기본으로 만든다(닫기와 다르다)
  cur='match-skip';
  await f.evaluate(sp=>{window.__mfr=window.__meetingFromMatch({template:true,name:'가상 상대전 미팅 2',slides:sp});},sp);
  await f.waitForFunction(()=>document.querySelector('#psMeetForm.on'));
  await f.click('#psMeetForm .mf-skip');
  assert.equal(await f.evaluate(async()=>await window.__mfr),true,'기본 그대로 = 만든다');
  made=await lib('가상 상대전 미팅 2');
  assert.equal(made.length,10);assert.equal(made[0].split('|').slice(0,4).join('|'),'|grid15|v|portrait','네이비 · 15존 · 지금 미팅 방향');
  // 기본 9장 없이(경기 장면만) — 운동장만 고르는 창
  cur='match-look-only';
  await f.evaluate(sp=>{window.__mfr=window.__meetingFromMatch({template:false,name:'가상 상대전 미팅 3',slides:sp});},sp);
  await f.waitForFunction(()=>document.querySelector('#psMeetForm.on'));
  st=await look();assert.equal(st.title,'운동장 고르기');assert.equal(st.o.lookOnly,true);
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#psMeetForm [data-team]').length+document.querySelectorAll('#psMeetForm .mf-pv').length),0,'포메이션 · 미리보기 없음');
  assert.deepEqual(st.o,{pitch:'custom',custom:'#c2410c',grid:'off',oh:'v',lookOnly:true},'마지막 고른 직접 색을 기억');
  await f.click('#psMeetForm [data-look="pitch"] [data-v="train"]');await f.click('#psMeetForm .mf-go');
  assert.equal(await f.evaluate(async()=>await window.__mfr),true);
  made=await lib('가상 상대전 미팅 3');
  assert.equal(made.length,1);assert.equal(made[0].split('|').slice(0,3).join('|'),'train|off|v');
  const mem=await f.evaluate(()=>JSON.parse(localStorage.getItem('ps_meet_form_v1')));
  assert.equal(mem['11'].us,'4231','운동장만 고른 창은 포메이션 기억을 지우지 않는다');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,test:'meeting-pitch-pick',passed:true,tok:want}));
}catch(e){console.error('[meeting-pitch-pick] step='+cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
