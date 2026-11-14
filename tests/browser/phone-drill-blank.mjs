import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,WT} from '../fixtures/team-app.mjs';
// 폰(≤600)에서 «장면이 있는 가로 작전판»이 빈 화면으로 열리던 것(사용 점검: 팀 «오늘» → 세션에 붙인 훈련 · 보관함 «보기» · «전체화면»).
// 원인: 저장본에 장면이 있으면 장면 줄(#animBar)이 «on» 인데 폰 보기 전용은 그 줄을 CSS 로 숨긴다. `_animBarPad()` 가 숨은 줄(사각형 0)을
//   재서 «판 영역 높이 + 위쪽 거리»(626)를 예약으로 돌려줬고, applyView 가 판에 height:calc(100% - 626px) → 0 을 적었다.
// 폭 360 · 390 · 430, 실제 손가락 탭. 돌리기(600 넘는 폭) · 컴퓨터는 그대로.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const NAME='가로 전체 운동장';
const fx=await startFixture(),browsers={};
for(const w of [360,390,430])SIZES['phone'+w]={engine:engine==='chromium'?'chromium':SIZES.phone.engine,ctx:{...SIZES.phone.ctx,viewport:{width:w,height:844},deviceScaleFactor:1}};

// 오늘 세션에 그 보관함 자료를 붙여 둔다(일정 «세션 채우기 › 보관함에서 가져오기»가 적는 모양 그대로)
{
  const row=fx.db.get(WT+'|process_coach_v1'),doc=JSON.parse(row.v);
  const di=(new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'})).getDay()+6)%7,day=doc.weeks[0][di];
  /* 합성 팀(team-app.mjs)의 토요일은 경기 날이라 «오늘 훈련»을 넣지 않는다 — 토요일(KST) CI 에서 slot 을 못 읽고 앱을 열기도 전에 떨어졌다(11/14).
     오늘에 훈련 세션이 없으면 fixture 와 같은 모양으로 하나 둔다 */
  if(!(day.trainings||[]).length){day.rest=false;day.board={sched:'훈련',theme:''};day.trainings=[{slot:'S'+Math.random().toString(36).slice(2,8),time:'18:00',grp:['A팀'],note:'가상 오늘 훈련',blocks:[]}];}
  const slot=day.trainings[0].slot;
  day.board=Object.assign(day.board||{},{sched:'훈련',trains:[NAME],trainThemes:[''],trainData:[{minutes:0,thumb:'',snap:null,focus:'',gmPhases:[],gmPhaseNames:[],fromLib:'USELAND',libIdx:0}],trainSlot:[slot],
    libs:[NAME],libData:[{libId:'USELAND',minutes:0,thumb:'',focus:''}],libSlot:[slot]});
  row.v=JSON.stringify(doc);
}
const boardFrame=async page=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&window.__psVaultPhoneApi&&window.__psVaultPhoneApi.hooked(),null,{timeout:30000});return f;};
async function seed(page,f){
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:15000});
  await f.evaluate(async name=>{
    /* 3.283 — 폰 부팅 기본은 세로(board.html innerWidth≤520)이고 자동 방향(__autoOrient)은 판이 보일 때만 재는데 보관함 보기에선 판이 0×0 이라
       «기본 판이 가로 전체» 단정은 부팅 경합(팀 «오늘»로 넘어가기 전 판이 잠깐 보였는가)에 따라 흔들렸다(11/12 웹킷 · 로컬 양쪽). 이 시험은 «가로 작전판»이
       폰에서 보이는가를 보므로 기대하지 않고 가로 전체로 맞춘다 */
    const base=captureSnap();base.orientation='h';base.spFlip=false;base.pitchView='full';
    const mk=dx=>{const c=JSON.parse(JSON.stringify(base));c.players=[{id:1,team:'blue',num:8,x:300+dx,y:300},{id:2,team:'red',num:4,x:520+dx,y:420},{id:3,team:'blue',num:10,x:700+dx,y:200}];
      c.drawings=[{type:'arrow',color:'#ffffff',pts:[{x:320+dx,y:320},{x:480+dx,y:400}]}];return c;},fr=dx=>({snap:mk(dx),dur:1});
    const lib=(await libGet()).filter(x=>x.libId!=='USELAND');
    lib.unshift({libId:'USELAND',type:'board',name,folder:'',thumb:'',tags:[],savedAt:Date.now(),snap:mk(0),frames:[fr(0),fr(80),fr(160)],
      pages:[{name:'페이지 1',snap:mk(0),thumb:'',anim:{frames:[fr(0),fr(80),fr(160)],active:0,hold:.6,title:'',titleColor:''}}]});
    await libWrite(lib);try{libTouch();}catch(_){}try{renderDrillFiles();}catch(_){}
  },NAME);
  await f.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),NAME,{timeout:15000});
}
// 판이 보이는가: 판 높이 · 운동장 선 · 선수 셋 · 화살표가 판 영역(#boardStage) 안에 그려져 있다
const look=f=>f.evaluate(()=>{
  const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};};
  const svg=document.getElementById('board'),st=R(document.getElementById('boardStage')),b=R(svg);
  const inside=r=>r.w>0&&r.h>0&&r.l>=st.l-1&&r.r<=st.r+1&&r.t>=st.t-1&&r.b<=st.b+1;
  const toks=[...document.querySelectorAll('#tokenLayer [data-id]')].map(g=>R(g.querySelector('.tok-c')||g));
  const draws=[...document.querySelectorAll('#drawLayer > *')].map(R).filter(r=>r.w>2||r.h>2);
  const lines=document.getElementById('lineLayer')||document.querySelector('#world [id*=line i]');
  const pitch=window.__pvBox?(()=>{const m=svg.getScreenCTM(),p=(x,y)=>{const q=svg.createSVGPoint();q.x=x;q.y=y;const o=q.matrixTransform(m);return [o.x,o.y];},a=p(__pvBox[0],__pvBox[1]),c=p(__pvBox[0]+__pvBox[2],__pvBox[1]+__pvBox[3]);
    return {l:Math.min(a[0],c[0]),t:Math.min(a[1],c[1]),r:Math.max(a[0],c[0]),b:Math.max(a[1],c[1]),w:Math.abs(c[0]-a[0]),h:Math.abs(c[1]-a[1])};})():null;
  return {board:b,stage:st,style:svg.getAttribute('style')||'',vb:svg.getAttribute('viewBox'),o:state.orientation,toks:toks.length,toksIn:toks.filter(inside).length,draws:draws.length,drawsIn:draws.filter(inside).length,
    lines:lines?R(lines):null,pitch,pitchIn:!!pitch&&inside(pitch),bar:getComputedStyle(document.getElementById('animBar')).display,barOn:document.getElementById('animBar').classList.contains('on')};});
function seen(v,label){
  assert.ok(v.board.h>=140,label+' — 판 높이 '+JSON.stringify({board:v.board,style:v.style,vb:v.vb}));
  assert.ok(v.pitchIn,label+' — 운동장 전체가 판 영역 안 '+JSON.stringify({pitch:v.pitch,stage:v.stage}));
  assert.equal(v.toks,3,label+' — 선수 셋');assert.equal(v.toksIn,3,label+' — 선수가 화면에 '+JSON.stringify(v));
  assert.ok(v.draws>=1&&v.drawsIn===v.draws,label+' — 화살표가 화면에 '+JSON.stringify({draws:v.draws,drawsIn:v.drawsIn}));
  assert.doesNotMatch(v.style,/height:\s*calc\(100% - [3-9]\d\dpx\)/,label+' — 숨은 장면 줄 몫을 판에서 빼지 않는다');
}
const out=[];
try{
  for(const w of [360,390,430]){
    const {page,logs}=await openApp(fx,'phone'+w,{browsers});
    const f=await boardFrame(page);
    await seed(page,f);
    const shot=n=>page.screenshot({path:path.join(SHOTS,`phone-drill-blank-${engine}-${w}-${n}.png`)});
    // ① 보관함 «보기» — 실제 탭
    // 보관함 목록은 받은 자료 · 썸네일로 다시 그려진다 — 카드가 갈아 끼워지면 다시 찾는다(웹킷 CI «not attached»)
    for(let i=0;;i++){
      try{
        const card=f.locator('#drillFiles .vcard',{hasText:NAME}).first();
        await card.scrollIntoViewIfNeeded({timeout:5000});
        await card.locator('button',{hasText:/^보기$/}).first().tap({timeout:5000});
        break;
      }catch(e){ if(i>=3) throw e; await page.waitForTimeout(400); }
    }
    await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&window.__vaultReadOnly===true&&anim.frames.length===3,null,{timeout:15000});
    await f.waitForFunction(()=>document.body.classList.contains('ps-vv-phone')&&state.orientation==='v',null,{timeout:5000});
    await page.waitForTimeout(700);
    const view=await look(f);await shot('1-view');
    assert.equal(view.barOn,true,'장면이 있는 저장본은 장면 줄이 켜진다(이 시험의 전제)');assert.equal(view.bar,'none','폰 보기 전용은 장면 줄을 숨긴다(전제)');
    seen(view,w+' 보관함 보기');assert.ok(view.board.h>view.board.w*.9,'세로로 세운 판 '+JSON.stringify(view.board));
    // 재생해도 보인다
    await f.locator('#psVvPlay').tap();await f.waitForFunction(()=>animPlaying===true,null,{timeout:5000});await page.waitForTimeout(500);
    seen(await look(f),w+' 재생 중');
    await f.waitForFunction(()=>animPlaying===false,null,{timeout:20000});
    // ② 폭이 바뀌어도(폰 안에서) · 600 을 넘겨 돌려도(연 때의 방향) 판이 있다
    if(w===390){
      await page.setViewportSize({width:560,height:844});await page.waitForTimeout(700);seen(await look(f),'폭 560');
      await page.setViewportSize({width:700,height:390});await page.waitForTimeout(900);
      const land=await look(f);assert.ok(land.board.h>=80&&land.toksIn===3,'가로로 돌린 판 '+JSON.stringify(land.board));
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(900);seen(await look(f),'다시 세로');
    }
    // ③ 전체화면 → 닫기
    await f.locator('#vCreateFull').tap();await f.waitForFunction(()=>document.body.classList.contains('vault-full'),null,{timeout:5000});await page.waitForTimeout(900);
    const full=await look(f);await shot('2-full');seen(full,w+' 전체화면');
    await f.locator('#vvClose').tap();
    await f.waitForFunction(()=>!document.body.classList.contains('vcreating'),null,{timeout:10000});
    // ④ 팀 «오늘» → 세션에 붙인 훈련(«훈련 보기» — 훈련 편집기 보기 전용)
    await page.locator('button:visible',{hasText:/^팀 운영$/}).first().tap();
    const s=await (await page.waitForSelector('#fScout',{state:'attached'})).contentFrame();
    const row=s.locator('button,[role=button],a,[onclick]',{hasText:NAME}).first();
    await row.waitFor({state:'visible',timeout:30000});await row.scrollIntoViewIfNeeded();await row.tap();
    await f.waitForFunction(()=>document.body.classList.contains('editing')&&document.getElementById('editorModal').classList.contains('on'),null,{timeout:20000});
    await page.waitForTimeout(1500);
    const train=await look(f);await shot('3-training');
    assert.match(await f.evaluate(()=>document.getElementById('editorModal').innerText),/작은 휴대폰 화면에서는 보기만 가능해요/);
    seen(train,w+' 훈련 보기');
    const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    assert.deepEqual(errs,[],'페이지 오류 없음 '+JSON.stringify(errs));
    out.push({w,view:view.board,full:full.board,train:train.board});
    await page.context().close();
  }
  // ⑤ 컴퓨터 — 장면 줄이 보이는 화면은 예전 그대로(저장된 방향 · 판이 영역을 채운다)
  if(engine==='chromium'){
    const {page}=await openApp(fx,'desktop',{browsers});
    const f=await boardFrame(page);await seed(page,f);
    await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));([...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='보기')||c).click();},NAME);
    await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&window.__vaultReadOnly===true&&anim.frames.length===3,null,{timeout:15000});
    await page.waitForTimeout(900);
    const d=await look(f);await page.screenshot({path:path.join(SHOTS,`phone-drill-blank-${engine}-desktop.png`)});
    assert.equal(d.o,'h');assert.notEqual(d.bar,'none','컴퓨터는 장면 줄이 보인다');assert.ok(d.board.h>=300&&d.toksIn===3&&d.pitchIn,'컴퓨터 판 '+JSON.stringify(d.board));
    const pad=await f.evaluate(()=>({pad:_animBarPad(),bar:document.getElementById('animBar').getBoundingClientRect().height}));
    assert.ok(pad.bar>0,'보이는 장면 줄은 예전처럼 잰다 '+JSON.stringify(pad));
    out.push({desktop:d.board,pad});
    await page.context().close();
  }
  console.log(JSON.stringify({engine,passed:true,out}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
