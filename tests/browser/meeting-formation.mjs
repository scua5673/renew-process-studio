import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.122 — 새 미팅 «포메이션 고르기»(board-meet-form.js) · 미팅 유니폼은 모든 슬라이드에(board-tweaks.js).
// 사용자 «시작할때 모달이 떠서 우리팀 포메이션, 상대 팀 포메이션 적용해서 페이지 마다 제대로 적용시켜줘» ·
// «미팅에서 우리팀 상대 팀 유니폼 바꾸면 모든 페이지에 적용되게». 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
const M=(x,y)=>({x:(x-30)/10,y:(y-30)/10});   // 11인제 판 단위 → m (MPP 10 · 판 왼쪽 위 30,30)
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  // 작업 보드에 페이지 셋 — 미팅에서 고친 유니폼이 여기로 새지 않는지 본다(②)
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__psPages&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await f.evaluate(()=>{const add=document.querySelector('#boardPageStrip .tb-add,#boardPageStrip .bp-add');add.click();add.click();});
  await f.waitForFunction(()=>(window.__psPages.pg()||[]).length===3);
  const pagesKit=()=>f.evaluate(()=>(window.__psPages.pg()||[]).map(p=>JSON.stringify(((p.snap||{}).teamColors||{}).blue||null)));
  const pages0=await pagesKit();
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>typeof anim==='object'&&document.getElementById('dfNew')&&window.PSMeetForm&&window.__meetSeed&&window.__meetSeed.__psForm&&window.__meetingFromMatch.__psForm&&window.kitPropagateIfChanged.__psKitAll&&window.psEachSnapAll.__psMeetOnly,null,{timeout:30000});
  await f.evaluate(()=>{try{localStorage.removeItem('ps_meet_form_v1');}catch(_){}});
  const newMeeting=async()=>{
    await f.evaluate(()=>document.getElementById('dfNew').click());
    await f.waitForSelector('.vcc-item');
    await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
    await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===10,null,{timeout:15000});
    await f.waitForFunction(()=>{const o=document.getElementById('psMeetForm');return o&&o.classList.contains('on')&&o.getBoundingClientRect().width>0;},null,{timeout:10000});
    await f.click('#psMeetForm [data-start=filled]'); // 기존 포메이션 검사는 기본 자료 포함으로 시작
    await f.click('#psMeetForm .mf-pvn button[aria-label="다음 장"]');
    await f.click('#psMeetForm .mf-pvn button[aria-label="다음 장"]');
    await f.click('#psMeetForm .mf-pvn button[aria-label="다음 장"]'); // 미드블록(4/10) 검사의 시작 위치

  };
  const slides=()=>f.evaluate(()=>anim.slides.filter(s=>!PSMeetReserve.isReserve(s)).map(s=>({t:s.title,spec:s.snap.pitchSpec,th:/<svg/.test(s.thumb||''),
    p:s.snap.players.map(p=>({team:p.team,num:String(p.num),pos:p.pos||'',x:p.x,y:p.y,id:p.id})),ball:s.snap.ball})));

  // ① 보관함 «미팅 만들기» — 10장이 채워진 뒤 창이 뜬다. 처음엔 기본(4-3-3 · 4-4-2)이 골라져 있다
  await newMeeting();
  const before=await slides();
  let st=await f.evaluate(()=>({o:window.__psMeetFormOpen(),fmt:[...document.querySelectorAll('#psMeetForm .mf-fmt button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')),
    us:[...document.querySelectorAll('#psMeetForm [data-team="us"] button')].map(b=>b.textContent),on:[...document.querySelectorAll('#psMeetForm .mf-chips button.on')].map(b=>b.getAttribute('data-k')),
    cap:document.querySelector('#psMeetForm .mf-pvn span').textContent,dots:document.querySelectorAll('#psMeetForm .mf-pic circle').length}));
  assert.deepEqual(st.o,{path:'vault',fmt:'11',us:'433',op:'442'},JSON.stringify(st));
  assert.deepEqual(st.fmt,['11 대 11*','8 대 8']);
  assert.equal(st.us.length,10);assert.ok(st.us.includes('4-2-3-1')&&st.us.includes('3-5-2'));
  assert.deepEqual(st.on,['433','442']);assert.match(st.cap,/미드블록\s+4 \/ 10/);assert.ok(st.dots>=23,'미리보기에 22명 + 공 '+st.dots);
  await page.screenshot({path:path.join(SHOTS,'meeting-formation-picker-'+size+'.png')});

  // 고르면 미리보기가 따라 바뀐다 · 장을 넘겨 본다
  const pv0=await f.evaluate(()=>document.querySelector('#psMeetForm .mf-pic').innerHTML);
  await f.click('#psMeetForm [data-team="us"] [data-k="4231"]');await f.click('#psMeetForm [data-team="op"] [data-k="352"]');
  assert.notEqual(await f.evaluate(()=>document.querySelector('#psMeetForm .mf-pic').innerHTML),pv0,'미리보기가 바뀐다');
  await f.click('#psMeetForm .mf-pvn button[aria-label="다음 장"]');
  assert.match(await f.evaluate(()=>document.querySelector('#psMeetForm .mf-pvn span').textContent),/로우블록\s+5 \/ 10/);
  await page.screenshot({path:path.join(SHOTS,'meeting-formation-picked-'+size+'.png')});
  await f.click('#psMeetForm .mf-go');
  await f.waitForFunction(()=>!document.querySelector('#psMeetForm.on'));
  const after=await slides();
  assert.deepEqual(after.map(s=>s.t),before.map(s=>s.t),'기존 9개 전술 페이지 제목 보존');
  // 4-2-3-1 · 3-5-2 번호와 포지션 — 장마다 같은 선수(번호)
  const lab=(s,tm)=>s.p.filter(p=>p.team===tm).map(p=>p.num+p.pos).sort().join(',');
  assert.equal(lab(after[0],'blue'),'10AM,11RM,1GK,2RB,3LB,4LCB,5RCB,6LDM,7LM,8RDM,9ST','BEST 11 = 4-2-3-1');
  assert.equal(after[0].p.filter(p=>p.team==='red').length,0,'BEST 11 은 우리 팀만');
  for(let i=1;i<9;i++){
    assert.equal(lab(after[i],'blue'),lab(after[0],'blue'),'장 '+(i+1)+' 우리 4-2-3-1');
    assert.equal(lab(after[i],'red'),'10CM,11ST,1GK,2RWB,3LWB,4LCB,5CB,6RCB,7RCM,8LCM,9ST','장 '+(i+1)+' 상대 3-5-2');
    assert.deepEqual(after[i].p.map(p=>p.id),before[i].p.map(p=>p.id),'토큰 id 그대로');
    assert.deepEqual(after[i].ball,before[i].ball,'공 자리 그대로');
    const gk=tm=>s=>s.p.find(p=>p.team===tm&&p.num==='1');
    assert.deepEqual([gk('blue')(after[i]).x,gk('red')(after[i]).x],[gk('blue')(before[i]).x,gk('red')(before[i]).x],'골키퍼는 그 자리');
  }
  // 장마다 그 장의 자리: 하이블록 우리 수비는 하프라인 근처 · 로우블록은 우리 진영 깊이 · 코너킥은 정해진 자리 그대로
  const avgX=(s,tm,fn)=>{const a=s.p.filter(p=>p.team===tm&&fn(p));return a.reduce((t,p)=>t+M(p.x,p.y).x,0)/a.length;};
  const back=p=>/CB$/.test(p.pos);
  assert.ok(avgX(after[1],'blue',back)>45,'하이블록 센터백 '+avgX(after[1],'blue',back));
  assert.ok(avgX(after[3],'blue',back)<16,'로우블록 센터백 '+avgX(after[3],'blue',back));
  assert.ok(avgX(after[3],'red',p=>p.pos==='ST')<25,'로우블록 상대 공격수는 우리 진영');
  for(const i of [7,8]){const k=s=>s.p.map(p=>p.team+':'+p.x+','+p.y).sort().join(' ');assert.equal(k(after[i]),k(before[i]),'코너킥 '+(i+1)+' — 자리는 그대로, 번호만');}
  // 겹치지 않고 운동장 안(코너킥 빼고)
  for(let i=0;i<7;i++){const pts=after[i].p.map(p=>({...M(p.x,p.y),team:p.team}));
    for(let a=0;a<pts.length;a++){assert.ok(pts[a].x>=1.9&&pts[a].x<=103.1&&pts[a].y>=2.9&&pts[a].y<=65.1,'장 '+(i+1)+' 운동장 안 '+JSON.stringify(pts[a]));
      for(let b=a+1;b<pts.length;b++)assert.ok(Math.hypot(pts[a].x-pts[b].x,pts[a].y-pts[b].y)>=(pts[a].team===pts[b].team?4.9:3.1),'장 '+(i+1)+' 겹침');}}
  assert.ok(after.every((s,i)=>s.th&&s.th!==before[i].th||s.th),'그림(썸네일)');
  assert.ok(await f.evaluate(()=>anim.slides.every((s,i)=>i===0||s.thumb)),'썸네일');
  const cur=await f.evaluate(()=>({idx:window.__meet.idx(),board:state.players.map(p=>String(p.num)+p.pos).sort().join(','),
    mem:JSON.parse(localStorage.getItem('ps_meet_form_v1')||'null'),toast:(document.getElementById('cs-ftoast')||{}).textContent||''}));
  assert.equal(cur.board,after[cur.idx].p.map(p=>p.num+p.pos).sort().join(','),'지금 판 = 지금 장');
  assert.deepEqual(cur.mem&&cur.mem['11'],{us:'4231',op:'352'},'고른 값 기억');
  assert.match(cur.toast,/10장을 채웠어요 — 우리 4-2-3-1 · 상대 3-5-2/);
  await page.waitForTimeout(700);
  await page.screenshot({path:path.join(SHOTS,'meeting-formation-applied-'+size+'.png')});

  // ② 미팅 유니폼 — 한 장에서 바꾸면 모든 슬라이드(와 장면)에, «이 슬라이드만»은 다른 장을 되돌린다
  await f.evaluate(()=>{ if(window.__meetingPageActive)window.__meetingPageEdit(); });
  await f.waitForFunction(()=>!window.__meetingPageActive);
  await f.evaluate(()=>window.__meet.go(2));
  await f.waitForFunction(()=>window.__meet.idx()===2&&!window.__ksNav,null,{timeout:5000});
  const kit0=await f.evaluate(()=>anim.slides.map(s=>JSON.stringify((s.snap.teamColors||{}).blue||null)));
  await f.evaluate(()=>{window.__ftSeen=null;const old=document.querySelector('#cs-ftoast .ftoast-act');
    window.__ftMo=new MutationObserver(()=>{const b=document.querySelector('#cs-ftoast .ftoast-act');if(b&&b!==old&&!window.__ftSeen)window.__ftSeen={btn:b,label:b.textContent,text:document.getElementById('cs-ftoast').textContent};});
    window.__ftMo.observe(document.body,{childList:true,subtree:true});
    window.__psKitOpen({team:'blue',gk:false});});
  await f.waitForFunction(()=>document.getElementById('psKitEd')&&document.getElementById('psKitEd').classList.contains('on'));
  await f.evaluate(()=>document.querySelector('#psKitEd .ke-sw [data-c="#e85a9b"]').click());
  await f.waitForFunction(()=>window.__ftSeen,null,{timeout:10000});
  let k=await f.evaluate(()=>({blue:anim.slides.map(s=>(s.snap.teamColors||{}).blue),label:window.__ftSeen.label,text:window.__ftSeen.text}));
  assert.equal(k.blue[1]??null,JSON.parse(kit0[1]),'리저브 유니폼은 다른 페이지와 별도');
  assert.ok(k.blue.every((c,i)=>i===2||i===1||c==='#e85a9b'),'다른 모든 슬라이드 '+JSON.stringify(k));
  assert.equal(k.label,'이 슬라이드만');assert.match(k.text,/유니폼을 모든 슬라이드에 적용했어요 \(다른 슬라이드 8장\)/);
  assert.deepEqual(await pagesKit(),pages0,'작업 보드의 페이지는 그대로(미팅의 «모든 장»은 슬라이드)');
  await f.evaluate(()=>{const e=document.getElementById('psKitEd');if(e)e.classList.remove('on');});
  await f.waitForFunction(()=>window.__psPitchThumbsLeft()===0,null,{timeout:30000});
  assert.ok(await f.evaluate(()=>anim.slides.every((s,i)=>i===2||i===1||/e85a9b/i.test(s.thumb||''))),'다른 슬라이드 그림도 새 색');
  await page.screenshot({path:path.join(SHOTS,'meeting-kit-all-slides-'+size+'.png')});
  await f.evaluate(()=>window.__ftSeen.btn.click());
  k=await f.evaluate(()=>({blue:anim.slides.map(s=>JSON.stringify((s.snap.teamColors||{}).blue||null)),board:state.teamColors.blue}));
  assert.deepEqual(k.blue.filter((c,i)=>i!==2),kit0.filter((c,i)=>i!==2),'다른 슬라이드는 되돌림');assert.equal(k.board,'#e85a9b','이 슬라이드는 새 색');
  // 넘겨도(불러오기) 퍼뜨리지 않는다
  await f.evaluate(()=>window.__meet.go(3));
  await f.waitForFunction(()=>window.__meet.idx()===3&&!window.__ksNav,null,{timeout:5000});await page.waitForTimeout(600);
  assert.deepEqual(await f.evaluate(()=>anim.slides.map(s=>JSON.stringify((s.snap.teamColors||{}).blue||null)).filter((c,i)=>i!==2)),kit0.filter((c,i)=>i!==2),'넘기기는 유니폼 변경이 아니다');

  // ③ 8 대 8 — 보관함에서 만들 때 고른다. 기억한 값(4-2-3-1 · 3-5-2)이 먼저 골라져 있다
  await f.evaluate(()=>{window.__meetBlank=false;});
  await newMeeting();
  st=await f.evaluate(()=>window.__psMeetFormOpen());
  assert.deepEqual(st,{path:'vault',fmt:'11',us:'4231',op:'352'},'기억한 포메이션');
  await f.click('#psMeetForm .mf-fmt [data-fmt="8"]');
  st=await f.evaluate(()=>({o:window.__psMeetFormOpen(),k:[...document.querySelectorAll('#psMeetForm [data-team="op"] button')].map(b=>b.getAttribute('data-k'))}));
  assert.deepEqual(st.o,{path:'vault',fmt:'8',us:'232',op:'331'});assert.deepEqual(st.k,['232','331','322','241']);
  await f.click('#psMeetForm [data-team="us"] [data-k="241"]');await f.click('#psMeetForm [data-team="op"] [data-k="322"]');
  await page.screenshot({path:path.join(SHOTS,'meeting-formation-8v8-'+size+'.png')});
  await f.click('#psMeetForm .mf-go');
  await f.waitForFunction(()=>!document.querySelector('#psMeetForm.on'));
  const e8=await slides();
  assert.deepEqual(e8.map(s=>s.t),['BEST 8','하이블록','미드블록','로우블록','빌드업','전진·전개','침투·마무리','코너킥 수비','코너킥 공격']);
  assert.ok(e8.every(s=>s.spec==='u12'&&s.th),'8인제 운동장 · 그림');
  assert.deepEqual(await f.evaluate(()=>{const b=anim.slides[0],r=anim.slides[1];return {title:r.title,n:r.snap.players.length,same:JSON.stringify(r.snap.players.map(p=>[p.pos,p.x,p.y]))===JSON.stringify(b.snap.players.map(p=>[p.pos,p.x,p.y]))};}),{title:'RESERVE',n:8,same:true});
  assert.equal(lab(e8[2],'blue'),'1GK,2LCB,3RCB,4LM,5LCM,6RCM,7RM,8ST');assert.equal(lab(e8[2],'red'),'1GK,2LCB,3CB,4RCB,5LCM,6RCM,7ST,8ST');
  assert.equal(await f.evaluate(()=>state.pitchSpec),'u12','지금 판도 8인제');

  // ④ 경기 «＋ 새 미팅» — 만들기 전에 창(인원은 경기 것 · 고르개 없음). 닫으면 만들지 않는다
  const libN=()=>f.evaluate(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).filter(x=>x.type==='meeting').length);
  const n0=await libN();
  await f.evaluate(()=>{window.__mfr=window.__meetingFromMatch({template:true,name:'가상 상대전 미팅',fmt:'8'});});
  await f.waitForFunction(()=>document.querySelector('#psMeetForm.on'));
  st=await f.evaluate(()=>({o:window.__psMeetFormOpen(),seg:!!document.querySelector('#psMeetForm .mf-fmt'),go:document.querySelector('#psMeetForm .mf-go').textContent}));
  assert.deepEqual(st,{o:{path:'match',fmt:'8',us:'241',op:'322'},seg:false,go:'이대로 만들기'});
  await f.click('#psMeetForm .mf-x');
  assert.equal(await f.evaluate(()=>window.__mfr),false);assert.equal(await libN(),n0,'닫으면 만들지 않는다');
  await f.evaluate(()=>{window.__mfr=window.__meetingFromMatch({template:true,name:'가상 상대전 미팅 2'});});
  await f.waitForFunction(()=>document.querySelector('#psMeetForm.on'));
  assert.deepEqual(await f.evaluate(()=>window.__psMeetFormOpen()),{path:'match',fmt:'11',us:'4231',op:'352'});
  await f.click('#psMeetForm [data-team="op"] [data-k="433"]');
  await f.click('#psMeetForm .mf-go');
  assert.equal(await f.evaluate(()=>window.__mfr),true);
  const made=await f.evaluate(async()=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.name==='가상 상대전 미팅 2');
    return d&&{n:d.slides.length,blue:d.slides[2].snap.players.filter(p=>p.team==='blue').map(p=>p.pos).sort().join(','),red:d.slides[2].snap.players.filter(p=>p.team==='red').map(p=>p.pos).sort().join(','),th:d.slides.every(s=>/<svg/.test(s.thumb||''))};});
  assert.deepEqual(made,{n:10,blue:'AM,GK,LB,LCB,LDM,LM,RB,RCB,RDM,RM,ST',red:'DM,GK,LB,LCB,LCM,LW,RB,RCB,RCM,RW,ST',th:true},JSON.stringify(made));
  // 창 밖에서 부른 기본 10장(예전 미팅 고치기 등)은 그대로
  assert.equal(await f.evaluate(()=>window.__meetTplSlides({},false,'h')[2].snap.players.filter(p=>p.team==='blue').map(p=>p.pos).sort().join(',')),'DM,GK,LB,LCB,LCM,LW,RB,RCB,RCM,RW,ST');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,test:'meeting-formation',passed:true}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
