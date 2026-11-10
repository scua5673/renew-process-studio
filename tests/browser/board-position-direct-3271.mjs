import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SIZES,SHOTS} from '../fixtures/team-app.mjs';
// 3.271 — 제보 0033117a «토큰을 우클릭할 시, 이름과 번호처럼 포지션은 한번 더 클릭하지 않아도 바로 나와야»(합성 팀 fixture 에서만).
//  선수 토큰을 오른쪽 클릭하면 뜨는 창에서 포지션 고르개가 이름 · 번호 옆에 바로 보이고(접힌 칸을 펼치지 않고), 고르면 원래 길로 저장 · 되돌리기.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
SIZES.compactDesktop={engine,ctx:{viewport:{width:393,height:900},screen:{width:393,height:900},deviceScaleFactor:1,hasTouch:false}};   // 좁은 창 = 아래 시트(ps-sm-mobile)
const step=s=>{try{fx.setStep(s);}catch(_){}console.log('board-position-direct-3271 '+s);};
try{for(const size of ['desktop','compactDesktop','ipad','phone']){
  step(size);
  const {page,context,logs}=await openApp(fx,size,{browsers,tilt3d:false});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psSelectionMenu,null,{timeout:30000});
  if(size==='phone'){   // 폰은 보기 전용 — 창이 뜨지 않는다(예전 그대로)
    assert.equal(await f.evaluate(()=>psPhoneBoardReadOnly()),true);assert.equal(await f.locator('.sel-ctl').isVisible(),false);await context.close();continue;}
  await f.evaluate(()=>{boardShowDefault();state.players=[{id:9101,team:'blue',num:'8',name:'가상',x:420,y:330},{id:9102,team:'blue',num:'9',pos:'ST',x:560,y:420},{id:9103,team:'blue',coach:true,num:'C',x:300,y:520}];state.equipment=[];state.drawings=[];sel=null;multiSel=[];renderTokens();updateDelUI();clearBoardHistory();});
  // 실제 오른쪽 클릭(맥 ⌃클릭 · 2.975 와 같은 판정)
  const rightClick=async id=>{const box=await f.locator(`#tokenLayer .token[data-id="${id}"]`).boundingBox();
    if(size==='ipad')await f.evaluate(id=>{selectItem('player',state.players.find(p=>p.id===id));__selPanelOpen(true);updateDelUI();},id);   // 터치 기기는 토큰을 눌러 고른다(오른쪽 클릭 없음) — 같은 창
    else await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});
    await f.waitForFunction(()=>document.querySelector('.sel-ctl').dataset.open==='true');await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  await rightClick(9101);
  const view=()=>f.evaluate(()=>{const ctl=document.querySelector('.sel-ctl'),ps=document.getElementById('posSel'),more=document.querySelector('.ps-sm-more'),R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height};},c=R(ctl),body=R(document.querySelector('.ps-sm-body'));
    const seen=e=>{const r=R(e);if(!(r.w>0&&r.h>0))return false;const x=r.l+r.w/2,y=r.t+r.h/2;return e.contains(document.elementFromPoint(x,y))||document.elementFromPoint(x,y)===e;};
    return {sel:sel&&sel.ref&&sel.ref.id,moreOpen:more.open,inMore:more.contains(ps),inIdentity:!!ps.closest('.ps-sm-identity'),posSeen:seen(ps),nameSeen:seen(document.getElementById('nameInput')),numSeen:seen(document.getElementById('numInput')),
      pos:R(document.getElementById('posCtl')),name:R(document.getElementById('nameCtl')),num:R(document.getElementById('numCtl')),ctl:c,body,mobile:ctl.classList.contains('ps-sm-mobile'),value:ps.value,labels:[...document.querySelectorAll('.ps-sm-identity>.ps-sm-label')].filter(n=>!n.hidden).map(n=>n.textContent),summary:more.querySelector('summary').textContent,count:document.querySelectorAll('#posSel').length,scrollTop:document.querySelector('.ps-sm-body').scrollTop};});
  const v=await view();
  assert.equal(v.sel,9101,'오른쪽 클릭한 선수가 골라졌다');
  assert.equal(v.moreOpen,false,'접힌 칸은 접힌 그대로');
  assert.equal(v.inMore,false,'포지션은 접힌 칸 밖');assert.equal(v.inIdentity,true,'이름 · 번호와 같은 묶음');
  assert.equal(v.posSeen,true,'포지션 고르개가 펼치지 않아도 보이고 눌린다('+size+')');assert.equal(v.nameSeen,true);assert.equal(v.numSeen,true);
  assert.deepEqual(v.labels,['이름','번호','포지션']);assert.equal(v.summary,'주발 · 장면');assert.equal(v.count,1,'고르개는 하나(원래 요소)');
  assert.equal(v.mobile,size==='compactDesktop','좁은 창은 아래 시트');
  assert.ok(Math.abs(v.pos.t-v.name.t)<1.5&&Math.abs(v.num.t-v.name.t)<1.5,'세 칸이 한 줄');
  assert.ok(v.name.r<=v.num.l+1&&v.num.r<=v.pos.l+1,'이름 → 번호 → 포지션 차례');
  assert.ok(v.pos.r<=v.ctl.r+1&&v.pos.l>=v.ctl.l-1&&v.pos.t>=v.body.t-1&&v.pos.b<=v.body.b+1,'창 안에 다 들어온다');
  assert.ok(v.name.w>=90,'이름 칸이 너무 좁아지지 않는다: '+v.name.w);assert.ok(v.pos.w>=60,'포지션 칸 폭: '+v.pos.w);
  assert.equal(v.value,'','포지션 없는 선수');
  // 고르면 원래 처리기가 저장한다 — 되돌리기 기록 하나 · 토큰에 포지션 표시 · ⌘Z
  const u0=await f.evaluate(()=>undoStack.length);
  await f.locator('#posSel').selectOption('CM');
  assert.deepEqual(await f.evaluate(()=>({pos:state.players[0].pos,undo:undoStack.length,label:state.label})),{pos:'CM',undo:u0+1,label:'pos'});
  await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:path.join(SHOTS,`board-position-direct-${engine}-${size}.png`)});
  const v2=await view();assert.equal(v2.value,'CM');assert.equal(v2.posSeen,true,'고른 뒤에도 그 자리');assert.equal(v2.moreOpen,false);
  assert.match(await f.locator('.sel-ctl .ps-in-sub').textContent(),/^CM · /,'창 머리에도 바로');
  assert.equal(await f.evaluate(()=>{autoSaveAnimFrame();return captureSnap().players[0].pos;}),'CM','저장본에 들어간다');
  await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>state.players[0].pos||''),'','되돌리기 한 번');
  await f.evaluate(()=>redoLast());assert.equal(await f.evaluate(()=>state.players[0].pos),'CM');
  // 다른 선수를 오른쪽 클릭하면 그 선수의 포지션
  await rightClick(9102);assert.equal((await view()).value,'ST');
  // 코치 토큰은 포지션이 없다 — 칸 · 이름표를 숨기고 이름 · 번호 두 칸
  await rightClick(9103);
  const vc=await view();assert.deepEqual(vc.labels,['이름','번호']);assert.equal(vc.posSeen,false);assert.equal(vc.nameSeen,true);assert.ok(vc.num.r<=vc.ctl.r+1);
  // 여럿을 고르면 예전처럼(이름 · 번호는 펼친 칸, 포지션 칸은 없음)
  await f.evaluate(()=>{sel=null;multiSel=[state.players[0],state.players[1]];renderTokens();__selPanelOpen(true);updateDelUI();positionSelCtl();});
  await f.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const vm=await view();assert.equal(vm.inIdentity,false);assert.equal(vm.posSeen,false,'여럿 선택은 예전 그대로');
  assert.equal(await f.evaluate(()=>document.querySelector('.ps-sm-more').contains(document.getElementById('nameCtl'))),true);
  // 다시 한 명 — 칸 차례가 이름 · 번호 · 포지션으로 돌아온다
  await f.evaluate(()=>{sel=null;multiSel=[];renderTokens();updateDelUI();});   // 묶음 안 토큰의 오른쪽 클릭은 묶음을 지킨다 — 먼저 푼다
  await rightClick(9102);
  const v3=await view();assert.equal(v3.inIdentity,true);assert.equal(v3.posSeen,true);assert.ok(v3.name.r<=v3.num.l+1&&v3.num.r<=v3.pos.l+1,'여럿 → 한 명 뒤에도 차례 그대로');
  // 보기 전용이면 창이 뜨지 않는다(고칠 길이 없다)
  const before=await f.evaluate(()=>JSON.stringify(captureSnap().players));
  await f.evaluate(()=>{window.__vaultReadOnly=true;updateDelUI();});
  assert.equal(await f.locator('.sel-ctl').isVisible(),false,'보기 전용');
  await f.evaluate(()=>{window.__vaultReadOnly=false;updateDelUI();});
  assert.equal(await f.evaluate(()=>JSON.stringify(captureSnap().players)),before);
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);await context.close();
}
console.log(JSON.stringify({engine,ok:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
