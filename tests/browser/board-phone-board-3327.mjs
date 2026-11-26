// 3.327 폰보드: 폰 아래 메뉴 «폰보드» 탭(보드 다음 칸) → 덮개 목록 → «＋ 새 폰보드»(인원 · 시작 배치 · 상대도) → 끌어 옮기기 · 선수 번호/이름 · 콘 · 화살 · 지우기 · 되돌리기
// → «저장» = 보관함 작전판 하나(phone 표시 · 세로) → 보관함 목록에 «폰보드» 칩 → 다시 열어 고치면 같은 항목 → 다른 탭으로 가면 덮개가 닫히고 쓰던 판은 남는다.
// 큰 화면에서 손본 판은 폰에서 보기만. 아이패드에는 탭이 없고 보관함 칩은 보인다.
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS,ready} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
const shot=(page,name)=>page.screenshot({path:path.join(SHOTS,'board-phone-board-'+engine+'-'+name+'.png')});
const phoneItems=()=>[...fx.lib.values()].map(r=>r&&r.item||r).filter(d=>d&&d.phone);
async function serverItems(ok){for(let i=0;i<80;i++){const l=phoneItems();if(ok(l))return l;await new Promise(r=>setTimeout(r,250));}return phoneItems();}
async function frameOf(page){
  const f=await(await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&!window.__boardRestoring&&window.PSPhoneBoard&&window.__psPhoneBoard);
  return f;
}
const model=f=>f.evaluate(()=>{const m=window.__psPhoneBoard.ui().model();return JSON.parse(JSON.stringify({scr:m.scr,doc:m.doc,editing:m.editing,dirty:m.dirty,hist:m.hist.length,list:(m.list||[]).map(d=>d.libId)}));});
// 운동장 위 합성 포인터(두 엔진 공통 · touch) — 미터 좌표로
const ptr=(f,steps)=>f.evaluate(async steps=>{
  const svg=document.getElementById('phbPitch'),m=svg.getScreenCTM();
  const sp3=window.PSPhoneBoard.SPECS[window.__psPhoneBoard.ui().model().doc.n];
  const at=(x,y)=>{const v=window.PSPhoneBoard.proj(sp3,x,y),p=svg.createSVGPoint();p.x=v.x;p.y=v.y;const q=p.matrixTransform(m);return [q.x,q.y];};   /* 3.333 — 3D: 미터 → 원근 → 화면 */
  const ev=(type,x,y)=>svg.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,composed:true,pointerId:5,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));
  const [a,b]=steps,[x0,y0]=at(a[0],a[1]),[x1,y1]=b?at(b[0],b[1]):[x0,y0];
  ev('pointerdown',x0,y0);
  if(b)for(let k=1;k<=6;k++){ev('pointermove',x0+(x1-x0)*k/6,y0+(y1-y0)*k/6);await new Promise(r=>requestAnimationFrame(r));}
  ev('pointerup',x1,y1);
},steps);
const toastText=f=>f.evaluate(()=>{const t=document.getElementById('phbToast');return t.hidden?'':t.textContent;});
let savedId='';
try{
 /* ── 폰 ── */
 {const {page,logs}=await openApp(fx,'phone',{browsers,examples:false,tilt3d:false});
  await ready(page);
  const f=await frameOf(page);
  const tab=page.locator('#psPhoneBoardBtn');
  await tab.waitFor({state:'visible'});
  const menu=await page.evaluate(()=>[...document.querySelectorAll('#appSeg>button')].filter(b=>b.offsetHeight>0).map(b=>b.textContent.trim()));
  assert.deepEqual(menu.slice(0,3),['보드','폰보드','보관함'],'the tab sits right after «보드»');
  assert.equal(menu.length,6,'six slots: '+menu.join(' · '));assert.equal(menu.at(-1),'더보기');
  const box=await tab.boundingBox();assert.ok(box.height>=44&&box.width>=44,'finger-sized tab');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'menu does not overflow');
  /* 열기 → 목록(비어 있음) */
  await tab.tap();
  await f.locator('#psPhoneBoard').waitFor({state:'visible'});
  assert.equal(await tab.getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#appSeg [data-app="board"]:not([data-train])').getAttribute('aria-current'),null,'«보드» is not the current tab');
  await f.waitForFunction(()=>window.__psPhoneBoard.ui().model().listState==='ok');
  assert.match(await f.locator('#phbList').innerText(),/아직 없습니다/);
  await shot(page,'1-home');
  /* 새 폰보드 — 8인제로 바꿨다가 11인제 4-4-2 · 상대도 */
  assert.deepEqual((await f.locator('#phbHome .phb-two button').allInnerTexts()).map(t=>t.trim()),['＋ 작전판','＋ 뎁스 차트'],'two separate ways to start');
  for(const b2 of await f.locator('#phbHome .phb-two button').all()){const r=await b2.boundingBox();assert.ok(r.height>=44&&r.width>=120,'start buttons are finger-sized');}
  await f.locator('[data-phb="new"]').tap();
  await f.locator('#phbNew').waitFor({state:'visible'});
  await f.locator('#phbSpec [data-v="8"]').tap();
  assert.deepEqual(await f.locator('#phbForm .phb-opt').allInnerTexts(),['3-3-1','2-4-1','빈 판']);
  await f.locator('#phbSpec [data-v="11"]').tap();await f.locator('#phbForm [data-v="4-4-2"]').tap();
  assert.deepEqual(await f.locator('#phbOppForm .phb-opt').allInnerTexts(),['없음','4-3-3','4-4-2','3-5-2'],'opponent formation choices');
  await f.locator('#phbOppForm [data-v="3-5-2"]').tap();
  /* 3.379 — 유니폼 색(우리 · 상대). 같은 색을 고르면 두 팀이 맞바꾼다 */
  assert.equal(await f.locator('#phbKitUs .phb-kit').count(),10);assert.equal(await f.locator('#phbKitOpBox').isVisible(),true,'the opponent colours show with an opponent');
  for(const k of await f.locator('#phbKitUs .phb-kit').all()){const r=await k.boundingBox();assert.ok(r.width>=40&&r.height>=40,'colour swatches are finger-sized');}
  await f.locator('#phbKitOp [data-v="#f4f5f7"]').tap();await f.locator('#phbKitUs [data-v="#f4f5f7"]').tap();
  assert.equal(await f.locator('#phbKitUs [aria-pressed="true"]').getAttribute('data-v'),'#f4f5f7');
  assert.equal(await f.locator('#phbKitOp [aria-pressed="true"]').getAttribute('data-v'),'#1a2f5c','picking the other side colour swaps them');
  await f.locator('#phbKitOp [data-v="#f2c230"]').tap();
  await shot(page,'2-new');
  await f.locator('[data-phb="new-go"]').tap();
  await f.locator('#phbEdit').waitFor({state:'visible'});
  let m=await model(f);
  assert.equal(m.doc.players.length,22);assert.equal(m.doc.n,'11');
  assert.deepEqual(m.doc.kit,{us:'#f4f5f7',op:'#f2c230'},'the chosen kits');
  const fills=await f.evaluate(()=>[...document.querySelectorAll('#phbFg .phb-tok')].map(g=>({id:g.getAttribute('data-id'),f:g.querySelector('circle[r="21"]').getAttribute('fill'),light:g.classList.contains('phb-light')})));
  const fillOf=id=>fills.find(x=>x.id===String(id));
  const usField=m.doc.players.find(p=>p.team==='us'&&p.num!=='1'),opField=m.doc.players.find(p=>p.team==='op'&&p.num!=='1'),opGk=m.doc.players.find(p=>p.team==='op'&&p.num==='1');
  assert.equal(fillOf(usField.id).f,'#f4f5f7');assert.equal(fillOf(usField.id).light,true,'a white kit gets dark numbers');
  assert.equal(fillOf(opField.id).f,'#f2c230');assert.notEqual(fillOf(opGk.id).f,'#d4a017','a yellow side does not keep a gold goalkeeper');
  assert.equal(m.doc.players.filter(p=>p.team==='op'&&p.y<20&&p.y>12).length,3,'the opponent back line is a back three (3-5-2)');
  const pitch=await f.locator('#phbPitch').boundingBox();
  assert.ok(pitch.height>pitch.width*1.2,'the pitch is portrait '+JSON.stringify(pitch));assert.ok(pitch.height>380,'and big enough to work on');
  for(const sel of ['#phbTools .phb-tool','[data-phb="save"]','[data-phb="back"]','[data-phb="undo"]','.phb-play','.phb-sc','.phb-add']){for(const b of await f.locator(sel).all()){const r=await b.boundingBox();assert.ok(r.height>=44&&r.width>=44,sel+' is finger-sized');}}
  /* 끌어 옮기기 → 되돌리기 */
  const gk=m.doc.players[0];
  await ptr(f,[[gk.x,gk.y],[gk.x+10,gk.y-8]]);
  m=await model(f);assert.ok(Math.abs(m.doc.players[0].x-(gk.x+10))<1.2&&Math.abs(m.doc.players[0].y-(gk.y-8))<1.2,'dragged '+JSON.stringify(m.doc.players[0]));
  await f.locator('[data-phb="undo"]').tap();
  m=await model(f);assert.deepEqual([m.doc.players[0].x,m.doc.players[0].y],[gk.x,gk.y],'undo puts it back');
  /* 선수 한 번 누르기 → 번호 · 이름 */
  await ptr(f,[[gk.x,gk.y]]);
  await f.locator('#phbTok').waitFor({state:'visible'});
  await f.locator('#phbNum').fill('21');await f.locator('#phbNm').fill('김 민수');
  await f.locator('[data-phb="tok-ok"]').tap();
  m=await model(f);assert.deepEqual([m.doc.players[0].num,m.doc.players[0].name],['21','김 민수']);
  /* 놓기 — 콘 · 우리 선수, 화살 — 패스 · 드리블, 지우기 */
  await f.locator('#phbTools [data-v="put"]').tap();await f.locator('#phbSub [data-v="cone"]').tap();
  await ptr(f,[[6,50]]);await ptr(f,[[62,50]]);
  await f.locator('#phbSub [data-v="us"]').tap();await ptr(f,[[34,70]]);
  await f.locator('#phbTools [data-v="line"]').tap();await f.locator('#phbSub [data-v="pass"]').tap();
  await ptr(f,[[20,88],[8,70]]);
  await f.locator('#phbSub [data-v="dribble"]').tap();await ptr(f,[[50,60],[58,42]]);
  await ptr(f,[[30,30],[30.5,30.5]]);
  m=await model(f);
  assert.equal(m.doc.cones.length,2);assert.equal(m.doc.players.length,23);assert.equal(m.doc.players.at(-1).num,'12','the new player takes the smallest free number (1 stays the goalkeeper)');
  assert.deepEqual(m.doc.lines.map(l=>l.kind),['pass','dribble'],'a too-short stroke is not an arrow');
  await f.locator('#phbTools [data-v="erase"]').tap();await ptr(f,[[62,50]]);
  m=await model(f);assert.equal(m.doc.cones.length,1);
  await f.locator('#phbTools [data-v="move"]').tap();
  await shot(page,'3-editor');
  /* 3.359 — 큰 작전판과 같은 모습: 잔디 색 · 유니폼 칩 · 큰 작전판의 공 */
  const look=await f.evaluate(()=>{const g=document.getElementById('phbFg'),b=document.getElementById('phbBg');return {bg:b.querySelector('rect').getAttribute('fill'),jersey:g.querySelectorAll('.phb-tok .phb-jersey').length,toks:g.querySelectorAll('.phb-tok').length,
    ball:!!g.querySelector('.phb-ball image, .phb-ball svg'),boardBall:/^<svg/.test(String(ballSVG())),run:[...g.querySelectorAll('.phb-line path')].map(e=>e.getAttribute('stroke-dasharray')||'')};});
  assert.equal(look.bg,'#1b8044','the board grass');assert.equal(look.jersey,look.toks,'every chip wears the board jersey');assert.equal(look.toks,23);
  assert.equal(look.ball,look.boardBall,'the ball is the big board ball');assert.deepEqual(look.run,['',''],'pass and dribble are solid strokes');
  /* 3.333 → 3.359 — 토큰 크기는 선수 창의 − / ＋ (다섯 단계 · 모든 선수 · 되돌리기 한 번에 한 칸) */
  const chipR=()=>f.evaluate(()=>+document.querySelector('#phbFg .phb-tok').getAttribute('transform').match(/scale\(([0-9.]+)\)/)[1]);
  const r3=await chipR();
  await ptr(f,[[gk.x,gk.y]]);await f.locator('#phbTok').waitFor({state:'visible'});
  await f.locator('#phbTok [data-phb="tok"][data-v="1"]').click();await f.locator('#phbTok [data-phb="tok"][data-v="1"]').click();
  assert.equal((await model(f)).doc.tok,5);assert.equal(await f.locator('#phbTokN').textContent(),'5');
  assert.equal(await f.locator('#phbTok [data-phb="tok"][data-v="1"]').isDisabled(),true,'the biggest step stops');
  const r5=await chipR();assert.ok(r5>r3*1.2,'the chips grew: '+r3+' → '+r5);
  await f.locator('[data-phb="tok-ok"]').tap();
  await shot(page,'3b-editor-big');
  await f.locator('[data-phb="undo"]').click();assert.equal((await model(f)).doc.tok,4,'undo steps the size back');
  await ptr(f,[[gk.x,gk.y]]);await f.locator('#phbTok').waitFor({state:'visible'});
  await f.locator('#phbTok [data-phb="tok"][data-v="-1"]').click();assert.equal((await model(f)).doc.tok,3);
  await f.locator('[data-phb="tok-ok"]').tap();
  assert.ok(Math.abs(await chipR()-r3)<0.001,'back to the first size');
  /* 3.379 — 토큰 크기는 운동장 오른쪽 위 구석에서 바로(선수를 누르지 않고 · 어느 도구에서나) */
  /* 3.381 — 크기 − / ＋ · 되돌리기는 아래 도구 줄 안(운동장 위에 아무것도 없다) */
  const sub=f.locator('#phbTools #phbSize');assert.equal(await sub.isVisible(),true,'the size control sits in the tool row');
  assert.equal(await f.locator('.phb-pw #phbSize, .phb-pw [data-phb="tok"]').count(),0,'nothing floats on the pitch');
  assert.equal(await f.locator('#phbTools [data-phb="undo"]').count(),1,'undo is in the tool row');
  assert.equal(await sub.locator('[data-phb-tokn]').textContent(),'3');
  await sub.locator('[data-phb="tok"][data-v="-1"]').tap();await sub.locator('[data-phb="tok"][data-v="-1"]').tap();
  assert.equal((await model(f)).doc.tok,1);assert.equal(await sub.locator('[data-phb-tokn]').textContent(),'1');
  assert.equal(await sub.locator('[data-phb="tok"][data-v="-1"]').isDisabled(),true,'the smallest step stops');
  assert.ok(await chipR()<r3*0.8,'the chips shrank');
  const subBox=await sub.boundingBox(),btnBox=await sub.locator('[data-phb="tok"][data-v="1"]').boundingBox();
  assert.ok(btnBox.width>=40&&btnBox.height>=40,'the buttons are big enough to tap');
  await shot(page,'3c-editor-size');
  await sub.locator('[data-phb="tok"][data-v="1"]').tap();await sub.locator('[data-phb="tok"][data-v="1"]').tap();
  assert.equal((await model(f)).doc.tok,3);
  const tl=await f.locator('#phbTools').boundingBox(),tb=await f.locator('#phbTools [data-v="move"]').boundingBox();
  assert.ok(subBox.y>=tl.y-1&&subBox.y+subBox.height<=tl.y+tl.height+1&&Math.abs(subBox.y-tb.y)<6,'in the same row as the tools');
  assert.ok(tl.x+tl.width>=subBox.x+subBox.width-1&&subBox.x>=tl.x,'inside the tool row, no overflow');
  assert.ok(tb.height<=48,'tools are compact '+tb.height);
  await f.locator('#phbTools [data-v="put"]').tap();assert.equal(await sub.isVisible(),true,'still there with the put tool');
  await f.locator('#phbTools [data-v="move"]').tap();
  /* 3.359 — 장면(애니메이션): ＋ 장면 → 화살대로 옮긴 다음 장면 → 옮기기 → 장면 오가기 → 시간 → 재생 */
  await f.locator('[data-phb="play"]').tap();assert.match(await toastText(f),/2개 이상/,'one scene does not play');
  const s1=(await model(f)).doc;
  /* 이동 화살 하나 — 4번 선수가 화살 끝으로 간다 */
  const run=s1.players[4];
  await f.locator('#phbTools [data-v="line"]').tap();await f.locator('#phbSub [data-v="run"]').tap();
  await ptr(f,[[run.x,run.y],[run.x+4,run.y-14]]);
  assert.equal(await f.evaluate(()=>!!document.querySelector('#phbFg .phb-line path[stroke-dasharray]')),true,'a run is dashed like the big board');
  await f.locator('[data-phb="scene-add"]').tap();
  m=await model(f);
  assert.equal(m.doc.scenes.length,2);assert.equal(m.doc.at,1);assert.equal(m.doc.lines.length,0,'arrows stay in their scene');assert.equal(m.doc.scenes[0].lines.length,3);
  assert.ok(Math.abs(m.doc.players[4].x-(run.x+4))<1.2&&Math.abs(m.doc.players[4].y-(run.y-14))<1.2,'the runner already stands at the arrow end '+JSON.stringify(m.doc.players[4]));
  assert.deepEqual(await f.locator('.phb-sc').allInnerTexts().then(a=>a.map(t=>t.replace(/\s+/g,''))),['1','2⋯']);
  assert.equal(await f.locator('#phbFg .phb-ghost').count(),1,'the way from the last scene is drawn');
  /* 장면 2 에서 옮기기 — 장면 1 은 그대로 */
  await f.locator('#phbTools [data-v="move"]').tap();
  const mv=m.doc.players[6];await ptr(f,[[mv.x,mv.y],[mv.x-8,mv.y-10]]);
  /* 놓기는 모든 장면에 */
  await f.locator('#phbTools [data-v="put"]').tap();await f.locator('#phbSub [data-v="op"]').tap();await ptr(f,[[60,8]]);
  m=await model(f);assert.equal(m.doc.players.length,24);assert.equal(m.doc.scenes[0].players.length,24,'a new player joins every scene');
  await f.locator('#phbTools [data-v="erase"]').tap();await ptr(f,[[60,8]]);
  m=await model(f);assert.equal(m.doc.players.length,23);assert.equal(m.doc.scenes[0].players.length,23,'and leaves every scene');
  await f.locator('#phbTools [data-v="move"]').tap();
  await shot(page,'3c-scene2');
  await f.locator('.phb-sc').first().tap();
  m=await model(f);assert.equal(m.doc.at,0);assert.deepEqual([m.doc.players[6].x,m.doc.players[6].y],[mv.x,mv.y],'scene 1 keeps its places');assert.equal(m.doc.lines.length,3);
  assert.equal(await f.locator('#phbFg .phb-ghost').count(),0);
  await shot(page,'3d-scene1');
  await f.locator('.phb-sc').nth(1).tap();
  m=await model(f);assert.equal(m.doc.at,1);assert.ok(Math.abs(m.doc.players[6].x-(mv.x-8))<1.2,'scene 2 keeps the move');
  /* 지금 장면을 다시 누르면 시간 · 지우기 */
  await f.locator('.phb-sc').nth(1).tap();await f.locator('#phbScene').waitFor({state:'visible'});
  await f.locator('[data-phb="scene-dur"][data-v="1.6"]').tap();
  assert.equal((await model(f)).doc.scenes[0].dur,1.6);
  await f.locator('[data-phb="scene-ok"]').tap();
  /* 재생 — 첫 장면부터 끝까지, 그동안 판은 못 고친다. 끝나면 고치던 장면으로 */
  const where=()=>f.evaluate(id=>[...document.querySelectorAll('#phbFg .phb-tok')].find(e=>e.getAttribute('data-id')===String(id)).getAttribute('transform'),mv.id);
  const end=await where();
  await f.locator('[data-phb="play"]').tap();
  assert.equal(await f.evaluate(()=>!!window.__psPhoneBoard.ui().model().play&&document.getElementById('psPhoneBoard').classList.contains('phb-playing')),true);
  const start=await where();assert.notEqual(start,end,'playback starts from scene 1');
  await ptr(f,[[mv.x,mv.y],[mv.x+9,mv.y+9]]);
  await page.waitForTimeout(1500);const mid=await where();assert.ok(mid!==start&&mid!==end,'the chip is on its way: '+mid);
  await f.waitForFunction(()=>!window.__psPhoneBoard.ui().model().play,null,{timeout:8000});
  assert.equal(await where(),end,'back on the scene being edited');
  m=await model(f);assert.equal(m.doc.at,1);assert.deepEqual([m.doc.scenes[0].players[6].x,m.doc.scenes[0].players[6].y],[mv.x,mv.y],'nothing moved while playing');
  await f.locator('[data-phb="play"]').tap();await page.waitForTimeout(900);await shot(page,'3e-playing');await f.locator('[data-phb="play"]').tap();
  assert.equal(await f.evaluate(()=>!!window.__psPhoneBoard.ui().model().play),false,'the same button stops');
  /* 장면 지우기 → 되돌리기 */
  await f.locator('.phb-sc').nth(1).tap();await f.locator('#phbScene').waitFor({state:'visible'});await f.locator('[data-phb="scene-del"]').tap();
  m=await model(f);assert.equal(m.doc.scenes,undefined,'one scene left is a plain board');
  await f.locator('[data-phb="undo"]').tap();
  m=await model(f);assert.equal(m.doc.scenes.length,2);assert.equal(await f.locator('.phb-sc').count(),2);
  await f.locator('.phb-sc').first().tap();
  /* 다른 탭에 갔다 와도 쓰던 판은 그대로 */
  await page.locator('#psTrainBtn').tap();
  await f.waitForFunction(()=>document.getElementById('psPhoneBoard').hidden);
  assert.equal(await tab.getAttribute('aria-current'),null);
  await tab.tap();
  await f.locator('#phbEdit').waitFor({state:'visible'});
  m=await model(f);assert.equal(m.doc.players.length,23,'the unsaved board is still there');
  /* 저장 → 보관함 작전판 하나 */
  await f.locator('#phbName').fill('토요일 4-4-2');
  await f.locator('[data-phb="save"]').tap();
  await f.locator('#phbHome').waitFor({state:'visible'});
  assert.match(await toastText(f),/보관함에 저장했습니다/);
  await f.waitForFunction(()=>(window.__psPhoneBoard.ui().model().list||[]).length===1);
  const local=await f.evaluate(()=>libGet().then(l=>JSON.parse(JSON.stringify(l.filter(d=>d&&d.phone)))));
  assert.deepEqual(local[0].snap.teamColors,{blue:'#f4f5f7',red:'#f2c230'},'the big board reads the same kits');
  assert.equal(local.length,1);
  const it=local[0];savedId=it.libId;
  assert.equal(it.type,'board');assert.equal(it.name,'토요일 4-4-2');assert.deepEqual(it.tags,['폰보드']);assert.deepEqual(it.phone,{v:1,n:'11'});
  assert.equal(it.snap.orientation,'v');assert.equal(it.snap.players.length,23);assert.equal(it.snap.equipment.length,1);assert.equal(it.snap.drawings.length,3);
  assert.equal(it.frames.length,2,'scenes are saved as big-board frames');assert.deepEqual(it.frames.map(x=>x.dur),[1.6,1]);assert.equal(it.frames[1].snap.drawings.length,0);
  assert.equal(it.snap.players[0].name,'김 민수');assert.equal(it.snap.players[0].num,'21');
  assert.ok(it.createdBy,'creator stamp');assert.equal(it.editedAt,it.savedAt);assert.ok(/^<svg/.test(it.thumb||''),'thumbnail drawn by the real board');
  const srv=await serverItems(l=>l.length===1);
  assert.equal(srv.length,1,'the phone board reaches the server');assert.equal(srv[0].libId,savedId);
  assert.match(await f.locator('#phbList').innerText(),/토요일 4-4-2/);
  await shot(page,'4-saved');
  /* 보관함 목록의 «폰보드» 칩 */
  await page.locator('#psTrainBtn').tap();
  await f.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('토요일 4-4-2')),null,{timeout:30000});
  const chip=await f.evaluate(()=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes('토요일 4-4-2')),e=c.querySelector('.vc-phone');return e?{t:e.textContent,w:e.getBoundingClientRect().width,r:getComputedStyle(e).borderRadius}:null;});
  assert.ok(chip&&chip.t==='폰보드'&&chip.w>20,'vault row shows the chip '+JSON.stringify(chip));
  await shot(page,'5-vault');
  /* 다시 열어 고치기 — 같은 항목 */
  await tab.tap();
  await f.locator('#phbHome').waitFor({state:'visible'});
  await f.waitForFunction(()=>(window.__psPhoneBoard.ui().model().list||[]).length===1);
  await f.locator('#phbList .phb-row').first().tap();
  await f.locator('#phbEdit').waitFor({state:'visible'});
  m=await model(f);assert.equal(m.editing,savedId);assert.equal(m.doc.players.length,23);assert.equal(m.dirty,false);assert.equal(m.doc.scenes.length,2,'the scenes come back');assert.equal(await f.locator('.phb-sc').count(),2);
  assert.equal(await f.locator('#phbName').inputValue(),'토요일 4-4-2');
  const p5=m.doc.players[5];
  await ptr(f,[[p5.x,p5.y],[p5.x+6,p5.y-6]]);
  await f.locator('[data-phb="save"]').tap();
  await f.locator('#phbHome').waitFor({state:'visible'});
  assert.match(await toastText(f),/폰보드를 고쳤습니다/);
  const again=await f.evaluate(()=>libGet().then(l=>JSON.parse(JSON.stringify(l.filter(d=>d&&d.phone)))));
  assert.equal(again.length,1,'still one item');assert.equal(again[0].frames.length,2);assert.equal(again[0].libId,savedId);assert.ok(again[0].editedAt>=it.editedAt);
  assert.notEqual(again[0].snap.players[5].x,it.snap.players[5].x,'the moved player has a new place');
  assert.equal(JSON.stringify(again[0].snap.players[7]),JSON.stringify(it.snap.players[7]),'an untouched player is unchanged');
  /* 나가기 — 저장 안 한 판은 묻는다 */
  await f.locator('[data-phb="new"]').tap();await f.locator('[data-phb="new-go"]').tap();
  await f.locator('#phbEdit').waitFor({state:'visible'});
  await f.locator('[data-phb="back"]').tap();
  await f.locator('#phbAsk').waitFor({state:'visible'});
  await f.locator('[data-phb="ask-keep"]').tap();
  assert.equal(await f.locator('#phbEdit').isVisible(),true);
  await f.locator('[data-phb="back"]').tap();await f.locator('[data-phb="ask-drop"]').tap();
  await f.locator('#phbHome').waitFor({state:'visible'});
  /* 큰 화면에서 손본 판(글이 든 판)은 폰에서 보기만 */
  await f.evaluate(id=>libTurn(()=>libGet().then(l=>{const d=l.find(x=>x.libId===id);d.snap.drawings.push({type:'text',pts:[{x:555,y:370}],text:'메모',color:'#ffffff',size:30});d.editedAt=d.savedAt=Date.now();return libWrite(l).then(libTouch);})),savedId);
  await f.locator('[data-phb="reload"],[data-phb="new"]').first().waitFor();
  await f.evaluate(()=>window.__psPhoneBoard.close());await tab.tap();
  await f.waitForFunction(()=>(window.__psPhoneBoard.ui().model().list||[]).length===1&&window.__psPhoneBoard.ui().model().listState==='ok');
  await f.locator('#phbList .phb-row').first().tap();
  await f.waitForFunction(()=>document.getElementById('psPhoneBoard').hidden&&document.body.classList.contains('vcreating')&&window.__vaultReadOnly,null,{timeout:20000});
  assert.equal(await tab.getAttribute('aria-current'),null,'the tab lets go when the board view takes over');
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text)),[],'no page errors');
 }
 /* ── 아이패드 — 탭 없음 · 보관함 칩은 보임 ── */
 {const {page}=await openApp(fx,'ipad',{browsers,examples:false,tilt3d:false});
  await ready(page);
  const f=await frameOf(page);
  assert.equal(await page.locator('#psPhoneBoardBtn').count(),0,'no phone-board tab on the iPad');
  assert.equal(await f.evaluate(()=>window.__psPhoneBoard.open()),false,'and the overlay refuses to open');
  await page.locator('#psTrainBtn').click();
  await f.waitForFunction(()=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes('토요일 4-4-2')&&c.querySelector('.vc-phone')),null,{timeout:40000});
  await shot(page,'6-ipad-vault');
  /* 3.359 — 폰에서 만든 장면은 큰 작전판의 장면 그대로 — 열면 재생할 수 있다 */
  const big=await f.evaluate(async id=>{const l=await libGet(),d=l.find(x=>x.libId===id);window.__vaultOpenView(d);for(let i=0;i<40&&anim.frames.length<2;i++)await new Promise(r=>setTimeout(r,150));return {n:anim.frames.length,ids:anim.frames.map(x=>x.snap.players.length)};},savedId);
  assert.deepEqual(big,{n:2,ids:[23,23]},'the big board loads the phone scenes');
  await page.waitForTimeout(600);await shot(page,'7-ipad-open');
 }
 console.log(JSON.stringify({test:'board-phone-board-3327',engine,passed:true}));
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
