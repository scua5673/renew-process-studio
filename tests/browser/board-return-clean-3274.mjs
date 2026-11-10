/* 3.274 — 다른 앱에 갔다 작전판으로 돌아오기만 해서는 «고친 판»이 되지 않는다(편집 seq · 저장 안 한 변경 · 나가기 확인). 합성 팀만. */
import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={};
const fx=await startFixture();
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  const board=()=>page.frames().find(f=>/\/studio\/board\.html/.test(f.url()));
  await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return w&&w.__boardReady&&w.__boardRestoreDone;},null,{timeout:45000});
  const f=board();
  await f.waitForFunction(()=>_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.waitForTimeout(1500);
  const st=()=>f.evaluate(()=>({seq:_boardPrivateEditSeq,dirty:!!_boardManualDirty,changed:typeof boardManualChanged==='function'&&!!boardManualChanged(),quiet:!!window.boardShowDefault.__psQuiet}));
  const before=await st();assert.equal(before.quiet,true,'boardShowDefault 를 감쌌다');
  for(let i=0;i<2;i++){
    await page.locator('#psTrainBtn').click();   // 보관함await page.waitForTimeout(900);
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());await page.waitForTimeout(1500);
  }
  const after=await st();
  assert.deepEqual({seq:after.seq,dirty:after.dirty,changed:after.changed},{seq:before.seq,dirty:before.dirty,changed:before.changed},'보관함 ↔ 작전판 왕복은 편집이 아니다');
  // 진짜 편집은 그대로 센다
  await f.evaluate(()=>{pushUndo();state.players[0]&&(state.players[0].x+=1);renderTokens();});
  const edited=await st();assert.ok(edited.seq>after.seq,'실제 편집은 seq 를 올린다');assert.equal(edited.dirty,true);
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({passed:true,engine,before,after,edited}));
}catch(e){console.error(e);process.exitCode=1;}finally{process.exit(process.exitCode||0);}
