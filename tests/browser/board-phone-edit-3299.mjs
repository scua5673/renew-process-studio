import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.299 — 폰 전용 세로 편집(studio/board-phone-edit.js). 사용자 «폰에서는 운동장 하나에 세로만 수정 가능하게 · 폰 전용» → 목업 B «보기 → 편집».
// ① 보기: 보기 전용 안내 대신 «세로 · 운동장 1 · 편집» 줄, 가드는 그대로(끌어도 안 움직임)
// ② «편집»: 편집 모드 — 머리줄(저장 · 완료) · 도구 띠 여덟(44px 이상) · 가드 풀림 · 세로 · 셸 머리와 메뉴 걷힘
// ③ 선수 올리기 시트(팀 칩 → 선수 +1) ④ 토큰 끌기 ⑤ 화살표 시트 → 패스 → 그리기 ⑥ 되돌리기 ⑦ 저장 ⑧ 완료 → 보기 · 가드 복귀
// ⑨ 새로고침 → 저장된 선수가 그대로 ⑩ 운동장 둘 → «편집» 대신 안내. 폰 크기(375): 웹킷은 아이폰 그대로, 크로미움도 폰 크기로.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine==='chromium')SIZES.phone.engine='chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'phone',{browsers});
  await ready(page);
  const frame=async()=>(await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  let f=await frame();
  const boot=()=>f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&typeof boardPrivateCurrent==='function'&&boardPrivateCurrent(window._boardPrivateOwner),null,{timeout:45000});
  const showBoard=async()=>{ await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-app="board"]:not([data-train])');if(b)b.click();}); await page.waitForTimeout(700); };
  const frameBox=()=>page.evaluate(()=>{const r=document.getElementById('fBoard').getBoundingClientRect();return {x:r.left,y:r.top};});
  const firstTok=()=>f.evaluate(()=>{const g=document.querySelector('#tokenLayer [data-id]');if(!g)return null;const r=g.getBoundingClientRect();const p=state.players.find(p=>String(p.id)===String(g.dataset.id));return {x:r.left+r.width/2,y:r.top+r.height/2,id:g.dataset.id,px:p&&p.x,py:p&&p.y};});
  const drag=async(x1,y1,x2,y2)=>{const fb=await frameBox();await page.mouse.move(fb.x+x1,fb.y+y1);await page.mouse.down();await page.mouse.move(fb.x+(x1+x2)/2,fb.y+(y1+y2)/2,{steps:4});await page.mouse.move(fb.x+x2,fb.y+y2,{steps:6});await page.mouse.up();await page.waitForTimeout(400);};
  const pos=id=>f.evaluate(id=>{const p=state.players.find(p=>String(p.id)===String(id));return p?[Math.round(p.x),Math.round(p.y)]:null;},id);

  await boot(); await showBoard();
  // ① 보기 — «편집» 줄, 보기 전용 안내는 숨김, 가드는 그대로
  await f.waitForFunction(()=>document.body.classList.contains('ps-phone-can-edit'),null,{timeout:20000});
  const bar=await f.evaluate(()=>{const b=document.getElementById('psPhoneEditBar'),r=b.getBoundingClientRect(),n=document.getElementById('psPhoneBoardNotice');
    return {txt:b.querySelector('.pe-txt').textContent,btn:b.querySelector('.pe-btn').textContent,vis:r.height>0&&r.width>0,btnH:Math.round(b.querySelector('.pe-btn').getBoundingClientRect().height),noticeHidden:!n||getComputedStyle(n).display==='none',ro:psPhoneBoardReadOnly(),edit:!!window.__psPhoneEditOn};});
  assert.deepEqual({txt:bar.txt,btn:bar.btn,vis:bar.vis,noticeHidden:bar.noticeHidden,ro:bar.ro,edit:bar.edit},{txt:'세로 · 운동장 1',btn:'편집',vis:true,noticeHidden:true,ro:true,edit:false},JSON.stringify(bar));
  assert.ok(bar.btnH>=36,'단추 높이 '+bar.btnH);
  await page.screenshot({path:path.join(SHOTS,'board-phone-edit-3299-'+engine+'-1-view.png')});

  // ② 편집 모드
  await f.evaluate(()=>document.querySelector('#psPhoneEditBar .pe-btn').click());
  await f.waitForFunction(()=>document.body.classList.contains('ps-phone-edit')&&window.__psPhoneEditOn===true&&psPhoneBoardReadOnly()===false,null,{timeout:10000});
  await page.waitForTimeout(600);
  const ed=await f.evaluate(()=>{const t=[...document.querySelectorAll('#psPhoneTools button')].map(b=>{const r=b.getBoundingClientRect();return {k:b.dataset.pe,h:Math.round(r.height),w:Math.round(r.width),on:b.classList.contains('on')};});
    const h=document.getElementById('psPhoneEditHead').getBoundingClientRect(),st=document.getElementById('boardStage').getBoundingClientRect(),n=document.getElementById('psPhoneBoardNotice');
    const hidden=['#ps-command-dock','#boardToolbar','#bench','#boardManualSave'].map(s=>{const e=document.querySelector(s);return !e||getComputedStyle(e).display==='none'||e.getBoundingClientRect().height===0;});
    return {tools:t,head:Math.round(h.height),orient:state.orientation,pitchN:state.pitchN||1,tool:state.tool,bar:getComputedStyle(document.getElementById('psPhoneEditBar')).display,stageH:Math.round(st.height),stageW:Math.round(st.width),vw:innerWidth,
      focus:(()=>{try{return parent.document.body.classList.contains('focus');}catch(_){return null;}})(),notice:!n||getComputedStyle(n).display==='none',hidden};});
  assert.equal(ed.tools.map(t=>t.k).join(','),'move,players,arrow,line,rect,text,eraser,undo','도구 띠 여덟');
  assert.ok(ed.tools.every(t=>t.h>=44&&t.w>=40),'손가락 크기 '+JSON.stringify(ed.tools));
  assert.equal(ed.tools[0].on,true,'이동이 켜져 시작');
  assert.equal(ed.orient,'v','세로'); assert.equal(ed.pitchN,1,'운동장 하나'); assert.equal(ed.tool,'move');
  assert.equal(ed.bar,'none','보기 줄은 숨김'); assert.equal(ed.notice,true); assert.ok(ed.head>=44,'머리줄 '+ed.head);
  assert.equal(ed.focus,true,'셸 머리 · 메뉴 걷힘(focusBoard)');
  assert.ok(ed.hidden.every(Boolean),'큰 화면 도구는 숨김 '+JSON.stringify(ed.hidden));
  assert.ok(ed.stageH>=320&&ed.stageW>=300,'판이 높이를 쓴다 '+ed.stageW+'×'+ed.stageH);
  assert.equal(await f.evaluate(()=>boardManualChanged()),false,'들어가기만으로는 «변경»이 아니다');
  await page.screenshot({path:path.join(SHOTS,'board-phone-edit-3299-'+engine+'-2-edit.png')});

  // ③ 선수 올리기 — 팀 2 · 팀 1
  const n0=await f.evaluate(()=>state.players.length);
  for(const team of ['red','blue']){
    await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="players"]').click());
    await f.waitForSelector('#psPhoneSheet .ps-chip[data-team="'+team+'"]',{timeout:5000});
    await f.evaluate(t=>document.querySelector('#psPhoneSheet .ps-chip[data-team="'+t+'"]').click(),team);
    await f.waitForFunction(()=>!document.getElementById('psPhoneSheet'),null,{timeout:5000});
  }
  assert.equal(await f.evaluate(()=>state.players.length),n0+2,'칩마다 선수 하나');
  await page.waitForTimeout(500);
  const tokW=await f.evaluate(()=>Math.min(...[...document.querySelectorAll('#tokenLayer [data-id] .tok-c')].map(c=>c.getBoundingClientRect().width)));
  assert.ok(tokW>=20,'편집 모드의 선수는 손가락 크기(2.4배) '+tokW);
  assert.equal(await f.evaluate(()=>commViewTok()),2.4,'그리는 배율만 — tokenScale 은 그대로');

  // ④ 토큰 끌기 — 편집 모드에서는 움직인다
  const t0=await firstTok(); assert.ok(t0,'토큰');
  await drag(t0.x,t0.y,t0.x+30,t0.y-70);
  const p1=await pos(t0.id);
  assert.notDeepEqual(p1,[Math.round(t0.px),Math.round(t0.py)],'편집 모드에서 토큰이 움직인다 '+JSON.stringify([t0.px,t0.py,p1]));

  // ⑤ 화살표 → 패스 → 그리기 ⑥ 되돌리기
  await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="arrow"]').click());
  await f.waitForSelector('#psPhoneSheet .ps-opt[data-tool="pass"]',{timeout:5000});
  await f.evaluate(()=>document.querySelector('#psPhoneSheet .ps-opt[data-tool="pass"]').click());
  await f.waitForFunction(()=>!document.getElementById('psPhoneSheet')&&state.tool==='pass',null,{timeout:5000});
  assert.equal(await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="arrow"]').classList.contains('on')),true,'화살표 칸이 켜진다');
  const d0=await f.evaluate(()=>state.drawings.length);
  const st=await f.evaluate(()=>{const r=document.getElementById('boardStage').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};});
  await drag(st.l+st.w*0.3,st.t+st.h*0.62,st.l+st.w*0.7,st.t+st.h*0.42);
  assert.equal(await f.evaluate(()=>state.drawings.length),d0+1,'화살표 하나');
  await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="undo"]').click());
  await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>state.drawings.length),d0,'되돌리기');
  await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="line"]').click());
  assert.equal(await f.evaluate(()=>state.tool),'line');
  await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="line"]').click());
  assert.equal(await f.evaluate(()=>state.tool),'dashline','선을 다시 누르면 점선');
  await f.evaluate(()=>document.querySelector('#psPhoneTools button[data-pe="move"]').click());

  // ⑦ 저장
  await f.waitForFunction(()=>boardManualChanged()===true,null,{timeout:10000});
  await f.evaluate(()=>document.getElementById('psPhoneEditHeadSave').click());
  await f.waitForFunction(()=>boardManualChanged()===false,null,{timeout:20000});
  const players=await f.evaluate(()=>state.players.map(p=>[String(p.id),Math.round(p.x),Math.round(p.y)]));
  await page.screenshot({path:path.join(SHOTS,'board-phone-edit-3299-'+engine+'-3-saved.png')});

  // ⑧ 완료 → 보기 · 가드 복귀
  await f.evaluate(()=>document.getElementById('psPhoneEditHeadDone').click());
  await f.waitForFunction(()=>!document.body.classList.contains('ps-phone-edit')&&window.__psPhoneEditOn===false&&psPhoneBoardReadOnly()===true,null,{timeout:10000});
  await f.waitForFunction(()=>document.body.classList.contains('ps-phone-can-edit'),null,{timeout:10000});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('focus')),false,'셸 머리 · 메뉴 복귀');
  const t2=await firstTok();
  await drag(t2.x,t2.y,t2.x+40,t2.y+40);
  assert.deepEqual(await pos(t2.id),[Math.round(t2.px),Math.round(t2.py)],'보기에서는 끌어도 그대로');

  // ⑨ 새로고침 → 저장된 선수 그대로
  await page.reload(); await ready(page); f=await frame(); await boot(); await showBoard();
  await f.waitForFunction(n=>state.players.length===n,players.length,{timeout:30000});
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>[String(p.id),Math.round(p.x),Math.round(p.y)])),players,'저장본이 돌아온다');

  // ⑩ 운동장 둘 → «편집» 대신 안내
  await f.waitForFunction(()=>document.body.classList.contains('ps-phone-can-edit'),null,{timeout:20000});
  await f.evaluate(()=>{window.__setPitchN(2);});
  await f.waitForFunction(()=>document.body.classList.contains('ps-phone-locked')&&!document.body.classList.contains('ps-phone-can-edit'),null,{timeout:10000});
  const lk=await f.evaluate(()=>{const b=document.getElementById('psPhoneEditBar');return {txt:b.querySelector('.pe-txt').textContent,btn:getComputedStyle(b.querySelector('.pe-btn')).display,can:window.__psPhoneEdit.can()};});
  assert.equal(lk.txt,'운동장이 여럿인 보드는 큰 화면에서 고쳐요'); assert.equal(lk.btn,'none'); assert.equal(lk.can.why,'multi-pitch');
  assert.equal(await f.evaluate(()=>window.__psPhoneEdit.enter()),false,'열리지 않는다');
  await page.screenshot({path:path.join(SHOTS,'board-phone-edit-3299-'+engine+'-4-locked.png')});
  await f.evaluate(()=>{window.__setPitchN(1);});
  await f.waitForFunction(()=>document.body.classList.contains('ps-phone-can-edit'),null,{timeout:10000});

  const errs=logs.filter(l=>l.type==='pageerror');
  assert.deepEqual(errs,[],'페이지 오류 없음');
  fs.writeFileSync(path.join(SHOTS,'..','board-phone-edit-3299-'+engine+'.json'),JSON.stringify({passed:true,engine,players:players.length},null,1));
  console.log('board-phone-edit-3299 ok · '+engine);
}catch(e){ console.error(e); process.exitCode=1; }
finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
