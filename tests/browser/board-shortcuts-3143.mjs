import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';

// 합성 계정: 설정 저장 → 실제 키 입력 → 페이지·파일 고르개 → 새로고침.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,tilt3d:false});
  async function board(){
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&window.__psPages&&window.PSBoardShortcuts&&document.getElementById('cmd-board-settings-pop'));
    return f;
  }
  let f=await board();
  const focus=()=>f.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();});
  const press=async k=>{await focus();await page.keyboard.press(k);await page.waitForTimeout(120);};
  const info=()=>f.evaluate(()=>{const p=__psPages.pageInfo();return p?{idx:p.idx,count:p.count}:{idx:0,count:1};});
  const speeds=()=>f.evaluate(()=>anim.frames.map(fr=>animMoveSpeed(fr)));
  async function settings(){
    await f.evaluate(()=>{localStorage.setItem('cs_tool_shortcuts_tab_v1','board');__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('keys');});
    await f.locator('#cmd-board-settings-keyspane [data-keytab="board"]').click();
  }
  await f.evaluate(()=>localStorage.setItem('cs_tool_shortcuts_v1',JSON.stringify({move:'g',pen1:'shift+x'})));
  await settings();
  for(const id of ['pitchPhoto','pageAdd','pagePrev','pageNext']){
    assert.equal(await f.locator('#cmd-board-settings-keyspane [data-tool="'+id+'"]').getAttribute('data-key'),'','새 키는 기존 설정을 가로채지 않는다');
  }
  async function bind(id,key,stored){
    const b=f.locator('#cmd-board-settings-keyspane [data-tool="'+id+'"]');
    await b.click();await b.focus();await page.keyboard.press(key);
    assert.equal(await b.getAttribute('data-key'),stored);
  }
  await bind('pageAdd','Shift+KeyX','shift+x');
  assert.equal(await f.evaluate(()=>__psToolKeys().pen1),'','같은 키를 지정하면 이전 동작을 해제');
  await bind('pageAdd','Shift+KeyN','shift+n');
  await bind('pagePrev','Shift+ArrowLeft','shift+left');
  await bind('pageNext','Shift+ArrowRight','shift+right');
  await bind('pitchPhoto','Shift+KeyI','shift+i');
  assert.equal(await f.evaluate(()=>__psToolKeys().move),'g','다른 탭의 사용자 키 보존');

  for(const width of [375,768,1280]){
    await page.setViewportSize({width,height:850});
    await f.locator('#cmd-board-settings-keyspane [data-tool="pitchPhoto"]').scrollIntoViewIfNeeded();
    const rows=await f.evaluate(()=>['pitchPhoto','pageAdd','pagePrev','pageNext'].map(id=>{
      const b=document.querySelector('#cmd-board-settings-keyspane [data-tool="'+id+'"]'),r=b.parentElement,x=r.getBoundingClientRect();
      return {id,left:x.left,right:x.right,width:innerWidth,overflow:r.scrollWidth-r.clientWidth};
    }));
    assert.ok(rows.every(r=>r.left>=0&&r.right<=r.width+1&&r.overflow<=1),JSON.stringify({width,rows}));
    await page.screenshot({path:path.join(SHOTS,'board-shortcuts-'+width+'-'+engine+'.png')});
  }
  await f.evaluate(()=>__psToggleBoardSettings('close'));

  // 첫 장면은 1배속. 중간 삽입은 선택한 앞 장면의 속도만 받는다.
  await press('KeyN');assert.deepEqual(await speeds(),[1,1]);
  await f.evaluate(()=>{anim.frames[0].moveSpeed=.5;anim.frames[1].moveSpeed=1.5;selectAnimFrame(1);});
  await press('KeyN');assert.deepEqual(await speeds(),[.5,1.5,1.5]);
  assert.equal(await f.locator('#animSpeedSel').inputValue(),'1.5','새 장면 속도 표기도 이어받는다');
  await f.evaluate(()=>selectAnimFrame(0));
  await press('KeyN');assert.deepEqual(await speeds(),[.5,.5,1.5,1.5],'맨 뒤 장면이 아니라 바로 앞 장면에서 이어받는다');
  await f.evaluate(()=>undoLast());assert.deepEqual(await speeds(),[.5,1.5,1.5],'장면 추가 되돌리기');
  await f.evaluate(()=>{selectAnimFrame(1);if(document.getElementById('animSpeedAll').getAttribute('aria-pressed')==='true')document.getElementById('animSpeedAll').click();});
  await f.locator('#animSpeedSel').selectOption('2',{force:true});
  await press('KeyN');assert.deepEqual(await speeds(),[.5,2,2,1.5],'모든 장면 꺼짐: 다른 장면 속도 보존');
  await f.evaluate(()=>document.getElementById('animSpeedAll').click());
  await f.locator('#animSpeedSel').selectOption('1.5',{force:true});
  await press('KeyN');assert.deepEqual(await speeds(),[1.5,1.5,1.5,1.5,1.5],'모든 장면 켜짐: 추가 뒤에도 속도 유지');

  // 페이지 추가와 왕복·끝에서 순환. 입력 칸에서는 실행하지 않는다.
  await press('Shift+KeyN');assert.deepEqual(await info(),{idx:1,count:2});
  await press('Shift+ArrowLeft');assert.deepEqual(await info(),{idx:0,count:2});
  assert.deepEqual(await speeds(),[1.5,1.5,1.5,1.5,1.5],'페이지 왕복 뒤 장면 보존');
  await press('Shift+ArrowLeft');assert.deepEqual(await info(),{idx:1,count:2});
  await press('Shift+ArrowRight');assert.deepEqual(await info(),{idx:0,count:2});
  await f.evaluate(()=>{const i=document.createElement('input');i.id='shortcutTyping';document.body.appendChild(i);i.focus();});
  await page.keyboard.press('Shift+KeyN');assert.deepEqual(await info(),{idx:0,count:2});
  assert.equal(await f.locator('#shortcutTyping').inputValue(),'N');
  await f.evaluate(()=>document.getElementById('shortcutTyping').remove());

  // The preceding edits schedule a draft capture, which regenerates thumbnail
  // IDs. Finish that existing capture before testing that blocked keys do none.
  await f.waitForFunction(()=>!_boardDraftT);
  const original=await f.evaluate(()=>JSON.stringify(__psPages.pg()));
  for(const cls of ['meet-mode','editing','comm-viewing','ps-capturing']){
    await f.evaluate(c=>document.body.classList.add(c),cls);
    await press('Shift+KeyN');await press('Shift+ArrowRight');
    assert.deepEqual(await info(),{idx:0,count:2},cls);
    await f.evaluate(c=>document.body.classList.remove(c),cls);
  }
  for(const flag of ['__vaultReadOnly','__vaultBook','__animExport','__psThumbCapturing']){
    await f.evaluate(k=>window[k]=true,flag);
    await press('Shift+KeyN');await press('Shift+ArrowRight');
    assert.deepEqual(await info(),{idx:0,count:2},flag);
    await f.evaluate(k=>window[k]=false,flag);
  }
  assert.equal(await f.evaluate(()=>JSON.stringify(__psPages.pg())),original,'다른 화면에서 작업 페이지를 캡처하거나 고치지 않는다');

  // 실제 파일 고르개(사용자 활성화 유지)와 보기 전용 보호.
  const chooser=page.waitForEvent('filechooser');
  await press('Shift+KeyI');const chosen=await chooser;
  assert.equal(await chosen.element().getAttribute('id'),'pitchPhotoInput');await chosen.setFiles([]);
  let picks=0;const onPick=()=>picks++;page.on('filechooser',onPick);
  await f.evaluate(()=>window.__vaultReadOnly=true);await press('Shift+KeyI');
  assert.equal(picks,0,'보기 전용에서는 사진을 고르지 않는다');
  await f.evaluate(()=>window.__vaultReadOnly=false);page.off('filechooser',onPick);

  assert.notEqual(await f.evaluate(()=>__boardSaveExplicit()),false);
  await page.reload();f=await board();
  // The shell can request another private-board restore after the initial
  // readiness signal. Assert the restored data once that asynchronous read lands.
  await f.waitForFunction(()=>__psPages.pageInfo()?.count===2,null,{timeout:10000});
  assert.equal(await f.evaluate(()=>__psToolKeys().pageAdd),'shift+n','다시 열어도 키 저장');
  assert.equal(await f.evaluate(()=>__psToolKeys().move),'g');
  assert.deepEqual(await info(),{idx:0,count:2});assert.deepEqual(await speeds(),[1.5,1.5,1.5,1.5,1.5],'장면 속도 저장');
  await press('Shift+ArrowRight');assert.deepEqual(await info(),{idx:1,count:2});
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,passed:true,shortcuts:4,speedInheritance:true,reload:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
