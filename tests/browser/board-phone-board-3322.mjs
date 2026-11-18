// 3.322 폰보드: 폰 아래 메뉴 «폰보드» 탭(보드 다음 칸) → 덮개 목록 → «＋ 새 폰보드»(인원 · 시작 배치 · 상대도) → 끌어 옮기기 · 선수 번호/이름 · 콘 · 화살 · 지우기 · 되돌리기
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
  const at=(x,y)=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(m);return [q.x,q.y];};
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
  assert.match(await f.locator('#phbList').innerText(),/아직 없어요/);
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
  await shot(page,'2-new');
  await f.locator('[data-phb="new-go"]').tap();
  await f.locator('#phbEdit').waitFor({state:'visible'});
  let m=await model(f);
  assert.equal(m.doc.players.length,22);assert.equal(m.doc.n,'11');
  assert.equal(m.doc.players.filter(p=>p.team==='op'&&p.y<20&&p.y>12).length,3,'the opponent back line is a back three (3-5-2)');
  const pitch=await f.locator('#phbPitch').boundingBox();
  assert.ok(pitch.height>pitch.width*1.2,'the pitch is portrait '+JSON.stringify(pitch));assert.ok(pitch.height>380,'and big enough to work on');
  for(const sel of ['#phbTools .phb-tool','[data-phb="save"]','[data-phb="back"]','[data-phb="undo"]']){for(const b of await f.locator(sel).all()){const r=await b.boundingBox();assert.ok(r.height>=44&&r.width>=44,sel+' is finger-sized');}}
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
  assert.equal(m.doc.cones.length,2);assert.equal(m.doc.players.length,23);assert.equal(m.doc.players.at(-1).num,'12','the new player takes the next number');
  assert.deepEqual(m.doc.lines.map(l=>l.kind),['pass','dribble'],'a too-short stroke is not an arrow');
  await f.locator('#phbTools [data-v="erase"]').tap();await ptr(f,[[62,50]]);
  m=await model(f);assert.equal(m.doc.cones.length,1);
  await f.locator('#phbTools [data-v="move"]').tap();
  await shot(page,'3-editor');
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
  assert.match(await toastText(f),/보관함에 저장했어요/);
  await f.waitForFunction(()=>(window.__psPhoneBoard.ui().model().list||[]).length===1);
  const local=await f.evaluate(()=>libGet().then(l=>JSON.parse(JSON.stringify(l.filter(d=>d&&d.phone)))));
  assert.equal(local.length,1);
  const it=local[0];savedId=it.libId;
  assert.equal(it.type,'board');assert.equal(it.name,'토요일 4-4-2');assert.deepEqual(it.tags,['폰보드']);assert.deepEqual(it.phone,{v:1,n:'11'});
  assert.equal(it.snap.orientation,'v');assert.equal(it.snap.players.length,23);assert.equal(it.snap.equipment.length,1);assert.equal(it.snap.drawings.length,2);
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
  m=await model(f);assert.equal(m.editing,savedId);assert.equal(m.doc.players.length,23);assert.equal(m.dirty,false);
  assert.equal(await f.locator('#phbName').inputValue(),'토요일 4-4-2');
  const p5=m.doc.players[5];
  await ptr(f,[[p5.x,p5.y],[p5.x+6,p5.y-6]]);
  await f.locator('[data-phb="save"]').tap();
  await f.locator('#phbHome').waitFor({state:'visible'});
  assert.match(await toastText(f),/폰보드를 고쳤어요/);
  const again=await f.evaluate(()=>libGet().then(l=>JSON.parse(JSON.stringify(l.filter(d=>d&&d.phone)))));
  assert.equal(again.length,1,'still one item');assert.equal(again[0].libId,savedId);assert.ok(again[0].editedAt>=it.editedAt);
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
 }
 console.log(JSON.stringify({test:'board-phone-board-3322',engine,passed:true}));
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
