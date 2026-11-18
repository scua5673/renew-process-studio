// 3.300 휴대폰 빠른 보드: 안내 띠 «＋ 빠른 보드» → 포메이션 · 선수단 순서로 채우기 → 자리 시트로 이름 넣기 · 순서 바꾸기 · 붙여넣기 → 저장
// → 보관함에 작전판 하나(quick · 토큰 depth) → 보기 화면에 뒤 순번 이름표 → «고치기»로 같은 항목만 고침 → 쓰던 보드 이어서.
// 토큰 고치기(사용자 «토큰누르면 이름 포지션 번호 수정가능하게»): 자리 시트에서 이름을 줄에서 바로 · 포지션 · 번호 · «토큰 표시», 번호는 주전을 따라간다, 보기 화면의 토큰을 누르면 그 시트.
// 자리 옮기기(사용자 «선수단 토큰이 움직이게 · 슬롯처럼 이동»): 빨간 토큰은 바로 · 이름표는 길게 눌러 끈다 → 빈 곳이면 자리 이동, 다른 토큰 위면 이름 맞바꾸기,
// «되돌리기» · «포메이션 자리로», 저장하면 옮긴 토큰만 새 좌표 · 다시 열면 그 자리에 보인다.
// 아이패드는 같은 항목을 열어 같은 뒤 순번 이름표를 그리고, 안내 띠 · 빠른 보드 단추가 없다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SIZES,OUT,SHOTS,ready} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
const shot=(page,name)=>page.screenshot({path:path.join(SHOTS,'board-quick-depth-'+engine+'-'+name+'.png')});
async function boardFrame(page){
  await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
  const f=await(await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&!window.__boardRestoring&&window.PSQuickDepth&&window.__psQuickTokWrap);
  return f;
}
// 3.320 — 새로 만들기는 «폰보드» 탭 안으로: 폰보드 › «＋ 뎁스 차트»
async function openDepth(page,f){
  await page.locator('#psPhoneBoardBtn').tap();
  await f.locator('#psPhoneBoard').waitFor({state:'visible'});
  await f.locator('#psPhoneBoard [data-phb="new-depth"]').tap();
  await f.locator('#pqForm').waitFor({state:'visible'});
}
const quickItems=()=>[...fx.lib.values()].map(r=>r&&r.item||r).filter(d=>d&&d.quick);
// 기기 보관함 → 서버는 동기화 회차 뒤에 온다 — 서버 사본이 조건을 만족할 때까지(20초)
async function serverItems(ok){for(let i=0;i<80;i++){const l=quickItems();if(ok(l))return l;await new Promise(r=>setTimeout(r,250));}return quickItems();}
const slots=f=>f.evaluate(()=>JSON.parse(JSON.stringify(window.__psQuickDepth.ui().state().slots)));
const st=f=>f.evaluate(()=>{const m=window.__psQuickDepth.ui().state();return JSON.parse(JSON.stringify({pos:m.pos,moved:m.moved,slots:m.slots,posBy:m.posBy,numBy:m.numBy,label:m.label}));});
const bdg=(f,i)=>f.locator('#pqStage .pq-slot[data-i="'+i+'"] .pq-bdg').innerText().then(t=>t.trim());
const qToast=f=>f.evaluate(()=>{const t=document.querySelector('#psQuick .pq-toast');return t.hidden?'':t.querySelector('span').textContent;});
// 끌기 — 합성 포인터(두 엔진 공통 · touch). part 를 잡아 토큰 가운데가 무대의 to(왼쪽 % · 위 %)에 오게 옮긴다. hold = 누른 채 기다리는 ms
const dragSlot=(f,i,to,opt={})=>f.evaluate(async({i,to,part,hold})=>{
  document.getElementById('pqBody').scrollTop=0;   /* 가장자리 가까이 끌면 창이 저절로 밀린다 — 맨 위에서 재면 위쪽 끌기는 밀리지 않는다 */
  const stage=document.getElementById('pqStage'),b=stage.querySelector('.pq-slot[data-i="'+i+'"]'),h=b.querySelector(part),r=h.getBoundingClientRect(),br=b.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+r.height/2,sr=stage.getBoundingClientRect();
  const x1=sr.left+to[0]/100*sr.width+(x0-(br.left+br.width/2)),y1=sr.top+to[1]/100*sr.height+(y0-(br.top+15));
  const ev=(type,x,y,el)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,composed:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));
  ev('pointerdown',x0,y0,h);
  if(hold)await new Promise(r=>setTimeout(r,hold));
  for(let k=1;k<=8;k++){ev('pointermove',x0+(x1-x0)*k/8,y0+(y1-y0)*k/8,b);await new Promise(r=>requestAnimationFrame(r));}
  ev('pointerup',x1,y1,b);
},{i,to,part:opt.part||'.pq-bdg',hold:opt.hold||0});
const near=(a,b,d,label)=>assert.ok(a&&Math.abs(a[0]-b[0])<=d&&Math.abs(a[1]-b[1])<=d,label+' '+JSON.stringify(a)+' ≈ '+JSON.stringify(b));
const depthText=f=>f.evaluate(()=>[...document.querySelectorAll('#tokenLayer .ps-depth')].map(g=>[...g.querySelectorAll('text')].map(t=>t.textContent)));
try{
 /* ── 폰 ── */
 {const {page,context,logs}=await openApp(fx,'phone',{browsers,examples:false,tilt3d:false});
  await ready(page);
  const f=await boardFrame(page);
  await f.locator('#psPhoneBoardNotice').waitFor({state:'visible'});
  assert.equal(await f.locator('#psPhoneBoardNotice [data-quick]').isVisible(),false,'3.320 — the board tab no longer carries «＋ 빠른 보드»');
  const libBefore=quickItems().length;
  await openDepth(page,f);
  await f.waitForFunction(()=>window.__psQuickDepth.ui().state().rosterState==='ok',null,{timeout:20000});
  assert.match(await f.locator('#pqForm').innerText(),/선수단 18명/,'squad count from the roster (read-only)');
  await shot(page,'1-form');
  await f.locator('#pqForm [data-pq="form-go"]').tap();
  await f.waitForFunction(()=>document.getElementById('pqForm').hidden);
  let s=await slots(f);
  assert.deepEqual(s[0],['가상 선수 1','가상 선수 2'],'GK in squad depth order');
  assert.deepEqual(s[2],['가상 선수 3','가상 선수 5'],'two centre backs share the CB depth');
  assert.equal(s.flat().length,18,'every squad player with a position is placed once');
  /* 자리 시트 — 이름 넣기(띄어 쓴 이름 그대로) · 한 칸 위로 · 다른 자리 선수 옮기기 */
  await f.locator('#pqStage .pq-slot[data-i="7"]').tap();
  await f.locator('#pqPos').waitFor({state:'visible'});
  assert.equal((await f.locator('#pqPosName').innerText()).trim(),'왼쪽 윙');
  await f.locator('#pqInput').fill('김 새로');await f.locator('#pqInput').press('Enter');
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','가상 선수 15','김 새로']);
  assert.equal(await f.evaluate(()=>document.activeElement&&document.activeElement.id),'pqInput','input keeps focus for the next name');
  await f.locator('#pqList li').nth(2).locator('[data-up]').tap();
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','김 새로','가상 선수 15']);
  await f.locator('#pqChips [data-name="가상 선수 14"]').tap();
  s=await slots(f);assert.deepEqual(s[9],[],'moved from RW');assert.equal(s[7].at(-1),'가상 선수 14');
  /* 토큰 고치기 — 이름은 줄에서 바로(칸을 떠날 때 적는다) · 포지션 · 번호 · 토큰 표시 */
  await f.locator('#pqList li').nth(1).locator('input.pq-n').fill('김 새롬');
  s=await slots(f);assert.equal(s[7][1],'김 새로','typing does not rename until the field is left');
  await f.locator('#pqList li').nth(1).locator('input.pq-n').press('Enter');
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','김 새롬','가상 선수 15','가상 선수 14'],'renamed in place');
  await f.locator('#pqList li').nth(1).locator('input.pq-n').fill('김 새로');await f.locator('#pqList li').nth(1).locator('input.pq-n').press('Enter');
  s=await slots(f);assert.equal(s[7][1],'김 새로');
  assert.equal(await f.inputValue('#pqPosCode'),'LW');assert.equal(await f.inputValue('#pqNum'),'13','the squad number of the starter');
  await f.locator('#pqPosCode').fill('lm');
  assert.equal(await bdg(f,7),'LM','the token shows the typed position at once');
  await f.locator('#pqNum').fill('77번');assert.equal(await f.inputValue('#pqNum'),'77','digits only');
  assert.equal(await bdg(f,7),'LM','still the position while the board shows positions');
  await f.locator('#pqPos [data-pq="show-num"]').tap();
  assert.equal(await bdg(f,7),'77');assert.equal(await bdg(f,0),'1','other tokens show their squad number');assert.equal(await bdg(f,9),'10','an empty slot shows its place in the line-up');
  let tk=await st(f);assert.equal(tk.label,'num');assert.equal(tk.posBy[7],'LM');assert.equal(tk.numBy['가상 선수 13'],'77');
  await f.locator('#pqList li').nth(1).locator('[data-up]').tap();
  assert.equal(await bdg(f,7),await f.inputValue('#pqNum'),'sheet and token agree');
  assert.notEqual(await f.inputValue('#pqNum'),'77','a new starter brings their own number');
  await f.locator('#pqList li').nth(1).locator('[data-up]').tap();
  assert.equal(await f.inputValue('#pqNum'),'77','and the number comes back with the player');
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','김 새로','가상 선수 15','가상 선수 14']);
  await shot(page,'2-sheet');
  await f.locator('#pqPos [data-pq="next"]').tap();
  assert.equal((await f.locator('#pqPosName').innerText()).trim(),'공격형 미드필더','next slot without closing');
  await f.locator('#pqPos [data-pq="pos-close"]').tap();
  /* 붙여넣기 */
  await f.locator('#psQuick [data-pq="paste"]').tap();
  await f.locator('#pqPasteText').fill('RW 길태양, 탁서윤\nST: 가상 선수 16 / 황보건');
  await f.locator('#psQuick [data-pq="paste-go"]').tap();
  s=await slots(f);assert.deepEqual(s[9],['길태양','탁서윤']);assert.deepEqual(s[10],['가상 선수 16','황보건']);
  await shot(page,'3-edit');
  /* 자리 옮기기 — ① 빨간 토큰은 바로 끌린다 → 되돌리기 ② «포메이션 자리로» ③ 이름표는 길게 눌러야(바로 움직이면 그대로) ④ 다른 토큰 위에 놓으면 이름 맞바꾸기 */
  let m=await st(f);assert.ok(m.pos.every(p=>p===null)&&m.moved.every(v=>v===false),'formation places to begin with');
  assert.equal(await f.locator('#pqPosReset').isVisible(),false,'no reset pill until something moved');
  await dragSlot(f,8,[70,40]);
  m=await st(f);near(m.pos[8],[70,40],0.5,'AM follows the finger');assert.equal(m.moved[8],true);assert.equal(m.moved.filter(Boolean).length,1);
  assert.equal(await qToast(f),'AM 자리를 옮겼어요');
  assert.ok(Math.abs(parseFloat(await f.locator('#pqStage .pq-slot[data-i="8"]').evaluate(b=>b.style.left))-70)<0.6,'drawn at the new place');
  assert.equal(await f.locator('#pqPos').isVisible(),false,'a drag is not a tap — no sheet');
  await f.locator('#psQuick [data-pq="undo"]').tap();
  m=await st(f);assert.equal(m.pos[8],null,'undo puts it back');assert.equal(m.moved[8],false);
  await dragSlot(f,3,[60,80]);
  await f.locator('#pqPosReset').waitFor({state:'visible'});
  await f.locator('#pqPosReset').tap();
  m=await st(f);assert.ok(m.pos.every(p=>p===null),'back on the formation');assert.equal(await f.locator('#pqPosReset').isVisible(),false);
  await dragSlot(f,6,[60,56],{part:'.pq-nm'});
  m=await st(f);assert.equal(m.pos[6],null,'a name label moved without a long press is a scroll, not a drag');
  await dragSlot(f,5,[30,55],{part:'.pq-nm',hold:340});
  m=await st(f);near(m.pos[5],[30,55],0.5,'long press on the name label, then drag');
  const lwNames=m.slots[7].slice(),rwNames=m.slots[9].slice();
  await dragSlot(f,7,[86,27]);
  m=await st(f);assert.deepEqual([m.slots[7],m.slots[9]],[rwNames,lwNames],'dropped on RW: the two name lists swap');assert.equal(m.pos[7],null,'the places stay');
  assert.equal(await qToast(f),'LW ↔ RW 이름을 맞바꿨어요'.replace('LW','LM'));
  assert.equal(await bdg(f,9),'77','the number goes with the player');assert.notEqual(await bdg(f,7),'77');
  await f.locator('#psQuick [data-pq="undo"]').tap();
  m=await st(f);assert.deepEqual([m.slots[7],m.slots[9]],[lwNames,rwNames]);
  await dragSlot(f,8,[70,40]);
  await page.waitForTimeout(600);
  await f.locator('#pqStage .pq-slot[data-i="8"] .pq-nm').first().tap();
  await f.locator('#pqPos').waitFor({state:'visible'});
  assert.equal((await f.locator('#pqPosName').innerText()).trim(),'공격형 미드필더','a tap still opens the sheet after dragging');
  await f.locator('#pqPos [data-pq="pos-close"]').tap();
  await shot(page,'3b-moved');
  /* 저장 → 보관함 · 보기 화면 */
  await f.locator('#pqTitle').fill('U-15 뎁스');
  await f.locator('#psQuick [data-pq="save"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  /* 3.320 — 저장하면 폰보드 목록으로 돌아온다(«폰보드» 칩 · «뎁스 차트»). 아래 보기 화면 검사는 그 항목을 보관함 보기로 열어 잇는다 */
  await f.locator('#phbHome').waitFor({state:'visible'});
  await f.waitForFunction(()=>[...document.querySelectorAll('#phbList .phb-row')].some(r=>/U-15 뎁스/.test(r.textContent)&&/뎁스 차트/.test(r.textContent)));
  await shot(page,'3b-phoneboard-list');
  await f.evaluate(()=>{window.__psPhoneBoard.close();return libGet().then(l=>window.__vaultOpenView(l.find(d=>d&&d.quick&&d.name==='U-15 뎁스')));});
  await f.waitForFunction(()=>window.__vaultReadOnly===true&&document.body.classList.contains('vcreating')&&window.__vvItem&&window.__vvItem.quick,null,{timeout:20000});
  const items=await serverItems(l=>l.length===libBefore+1);assert.equal(items.length,libBefore+1,'one new library item');
  const it=items.find(d=>d.name==='U-15 뎁스');assert.ok(it,'saved with the typed name');
  assert.equal(it.type,'board');assert.deepEqual(it.tags,['폰보드']);assert.equal(it.quick.form,'4-2-3-1');assert.ok(await f.evaluate(id=>libGet().then(l=>{const d=l.find(x=>x.libId===id);return !!d&&String(d.thumb||'').length>100;}),it.libId),'card thumbnail on the device copy');
  assert.equal(it.snap.orientation,'v');assert.equal(it.snap.label,'num','the board shows numbers, as chosen');assert.equal(it.snap.players.length,11);
  const lw=it.snap.players.find(p=>p.id===8);assert.equal(lw.pos,'LM','typed position');assert.equal(lw.num,'77','typed number');assert.equal(lw.name,'가상 선수 13');
  assert.deepEqual(it.snap.players.filter(p=>[1,3,10].includes(p.id)).map(p=>[p.pos,p.num]),[['GK','1'],['CB','3'],['RW','10']],'untouched tokens: formation position · squad number (or place)');assert.deepEqual(lw.depth,['김 새로','가상 선수 15','가상 선수 14']);
  assert.equal(it.snap.players.find(p=>p.id===4).depth,undefined,'no empty depth list');
  assert.ok(it.editedAt&&it.editedAt===it.savedAt);
  const am=it.snap.players.find(p=>p.id===9),ldm=it.snap.players.find(p=>p.id===6);
  near([am.x,am.y],[660,506],6,'AM saved where it was dropped');near([ldm.x,ldm.y],[503,234],6,'LDM saved where it was dropped');
  assert.deepEqual([lw.x,lw.y],[797,125],'tokens that were not moved sit on the formation');
  await f.waitForFunction(()=>document.querySelectorAll('#tokenLayer .ps-depth').length>=8);
  assert.ok((await depthText(f)).some(t=>t.join('|')==='김 새로|가상 선수 15|가상 선수 14'),'backup names drawn under the starter');
  await f.waitForFunction(()=>{const b=document.querySelector('#psPhoneBoardNotice [data-quick]');return b&&!b.hidden&&b.textContent==='고치기';});
  await page.waitForTimeout(800);
  await shot(page,'4-view');
  /* 보기 화면에서 판을 누르면 «아이패드에서» 대신 고치는 단추를 알린다 */
  await f.locator('#boardStage').tap({position:{x:40,y:260}});
  await f.waitForFunction(()=>/토큰을 누르거나 위의 «고치기»에서 바꿔요/.test((document.getElementById('cs-ftoast')||{}).textContent||''),null,{timeout:5000});
  /* 보기 화면의 토큰을 누르면 그 자리 시트가 바로 열린다 — 그냥 닫으면 아무것도 안 바뀐다 */
  await f.locator('#tokenLayer [data-id="8"] .tok-c').tap();
  await f.locator('#pqPos').waitFor({state:'visible'});
  assert.equal((await f.locator('#pqPosName').innerText()).trim(),'왼쪽 윙');
  assert.equal(await f.inputValue('#pqPosCode'),'LM');assert.equal(await f.inputValue('#pqNum'),'77');
  assert.equal(await f.locator('#pqPos [data-pq="show-num"]').getAttribute('aria-pressed'),'true','opens with what the board shows');
  await f.locator('#pqPos [data-pq="pos-close"]').tap();
  await f.locator('#psQuick [data-pq="back"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  /* 고치기 — 같은 항목만 */
  const savedAt=it.savedAt;
  await f.locator('#psPhoneBoardNotice [data-quick]').tap();
  await f.locator('#psQuick').waitFor({state:'visible'});
  assert.equal(await f.locator('#pqForm').isVisible(),false,'edit opens straight on the pitch');
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','김 새로','가상 선수 15','가상 선수 14'],'slots read back from the item');
  assert.equal(await f.inputValue('#pqTitle'),'U-15 뎁스');
  m=await st(f);near(m.pos[8],[70,40],0.6,'opens with the tokens where they stand');assert.ok(m.moved.every(v=>v===false));
  await f.locator('#pqPosReset').waitFor({state:'visible'});
  await dragSlot(f,10,[50,15]);
  m=await st(f);assert.deepEqual(m.pos[10],[50,15],'snaps to the centre line');
  await page.waitForTimeout(600);
  await f.locator('#pqStage .pq-slot[data-i="7"]').tap();
  await f.locator('#pqList li').nth(3).locator('[data-rm]').tap();
  await f.locator('#pqPos [data-pq="show-pos"]').tap();
  assert.equal(await bdg(f,7),'LM');
  await f.locator('#pqPos [data-pq="pos-close"]').tap();
  await page.waitForTimeout(5);
  await f.locator('#psQuick [data-pq="save"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  await f.waitForFunction(()=>window.__vvItem&&window.__vvItem.quick&&(window.__vvItem.snap.players.find(p=>p.id===8).depth||[]).length===2,null,{timeout:20000});
  const after=await serverItems(l=>l.some(d=>d.libId===it.libId&&(d.snap.players.find(p=>p.id===8).depth||[]).length===2));assert.equal(after.length,libBefore+1,'edit replaces, does not add');
  const ed=after.find(d=>d.libId===it.libId);assert.deepEqual(ed.snap.players.find(p=>p.id===8).depth,['김 새로','가상 선수 15']);
  assert.ok(ed.editedAt>savedAt&&ed.editedAt===ed.savedAt,'editedAt and savedAt move together (3.291)');
  assert.equal(ed.snap.players.find(p=>p.id===8).x,lw.x,'same formation keeps token places');
  const st2=ed.snap.players.find(p=>p.id===11),am2=ed.snap.players.find(p=>p.id===9);
  assert.deepEqual([st2.x,st2.y],[923,370],'only the dragged token gets a new place');
  assert.deepEqual([am2.x,am2.y],[am.x,am.y],'the earlier move is kept to the unit');
  assert.equal(ed.snap.label,'pos','the board is back to showing positions');
  assert.deepEqual(ed.snap.players.map(p=>[p.pos,p.num]),it.snap.players.map(p=>[p.pos,p.num]),'token positions and numbers are untouched by a name edit');
  /* 쓰던 보드 이어서 — 작업 보드로 돌아가 새로 시작했다 닫으면 남는다 */
  await f.locator('#vCreateCancel').click();
  await f.waitForFunction(()=>!document.body.classList.contains('vcreating'));
  await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
  await openDepth(page,f);
  await f.locator('#pqFill-blank').check();
  await f.locator('#pqForm [data-form="3-3-1"]').tap();
  await f.locator('#pqForm [data-pq="form-go"]').tap();
  s=await slots(f);assert.equal(s.length,8,'8-a-side has eight slots');assert.equal(s.flat().length,0);
  await f.locator('#pqStage .pq-slot[data-i="0"]').tap();
  await f.locator('#pqInput').fill('골키퍼 하나, 골키퍼 둘');await f.locator('#pqInput').press('Enter');
  await f.locator('#psQuick [data-pq="back"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  assert.match(await f.locator('#phbToast').innerText(),/쓰던 뎁스 차트는 남겨 뒀어요/,'the draft notice shows on the phone board');
  await f.locator('#psPhoneBoard [data-phb="new-depth"]').tap();
  await f.locator('#pqForm [data-pq="draft"]').waitFor({state:'visible'});
  await f.locator('#pqForm [data-pq="draft"]').tap();
  s=await slots(f);assert.deepEqual(s[0],['골키퍼 하나','골키퍼 둘']);
  assert.equal(await f.evaluate(()=>window.__psQuickDepth.ui().state().form),'3-3-1');
  await f.locator('#psQuick [data-pq="back"]').tap();
  assert.equal(quickItems().length,libBefore+1,'closing without saving writes nothing');
  const errors=logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,size:'phone',passed:true}));
  await context.close();}
 /* ── 아이패드 — 같은 항목을 같은 뒤 순번으로 그린다 · 빠른 보드 단추 없음 ── */
 {const {page,context,logs}=await openApp(fx,'ipad',{browsers,examples:false,tilt3d:false});
  await ready(page);
  const f=await boardFrame(page);
  assert.equal(await f.locator('#psPhoneBoardNotice').isVisible(),false);
  assert.equal(await f.evaluate(()=>window.PSQuickDepth.entry(window)),null,'no quick entry outside the phone viewer');
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());
  await f.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),'U-15 뎁스',{timeout:30000});
  await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click();},'U-15 뎁스');
  await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&document.querySelectorAll('#tokenLayer .ps-depth').length>=8,null,{timeout:20000});
  assert.ok((await depthText(f)).some(t=>t.join('|')==='김 새로|가상 선수 15'));
  await page.waitForTimeout(800);
  await shot(page,'5-ipad');
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text)),[]);
  console.log(JSON.stringify({engine,size:'ipad',passed:true}));
  await context.close();}
}catch(e){console.error(e);fs.writeFileSync(path.join(OUT,'board-quick-depth-failure.txt'),String(e&&e.stack||e));process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
