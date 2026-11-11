/* 3.278 — 작업 보드 «구조 사본»(제보 0976735a · 사용자 «다시는 반복되지 않게»).
   운영에서 본 모양을 만든다: 기기 초안 쓰기(board-draft.js)가 늘 실패하는 창에서 장면을 만들고 새로고침한다.
   고치기 전: 초안이 한 번도 적히지 않아 새로고침 뒤 아무것도 남지 않는다(띠 없음 · 장면 0).
   고친 뒤: 구조 사본이 남고, 다시 열면 «저장하지 않은 작업이 있어요 — 되살리기»로 장면이 돌아온다.
   합성 팀만 쓴다. */
import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},fx=await startFixture();
SIZES.br={engine,ctx:{viewport:{width:1280,height:860},deviceScaleFactor:1}};
/* 모든 프레임에서 앱보다 먼저: 초안 쓰기가 늘 실패하는 기기(운영 기록의 board_draft_storage) */
const breakDraft=()=>{try{
  const stop=()=>{try{if(typeof window.boardDraftWriteNow==='function'&&!window.boardDraftWriteNow.__qa){const f=function(){window.__qaDraftCalls=(window.__qaDraftCalls||0)+1;return false;};f.__qa=1;window.boardDraftWriteNow=f;}}catch(_){}};
  document.addEventListener('DOMContentLoaded',()=>{stop();setInterval(stop,50);});
}catch(_){}};
try{
  const {page,logs}=await openApp(fx,'br',{browsers,init:{fn:breakDraft}});
  const board=async()=>{
    await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!!w.__psBoardRescue;},null,{timeout:60000});
    return (await page.$('#fBoard')).contentFrame();
  };
  let f=await board();
  await page.waitForTimeout(800);
  /* 사람처럼: 선수 하나를 놓고 옮길 때마다 «＋ 장면» */
  await f.evaluate(()=>{pushUndo();state.players=[{id:901,team:'blue',num:7,x:300,y:370}];renderTokens();});
  for(const x of [340,420,500]){await f.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();},x);await page.waitForTimeout(220);}
  const made=await f.evaluate(()=>anim.frames.length);assert.ok(made>=3,'장면을 만들었다 '+made);
  const slots=fr=>fr.evaluate(async()=>{const o=boardPrivateOwner(),out=[];for(let i=0;i<PSBoardRescue.SLOTS;i++){const k=PSBoardRescue.key(o,i);let idb=null;try{idb=(await storage.peek(k))?.value??null;}catch(_){}
    const r=PSBoardRescue.parse(idb,o)||PSBoardRescue.parse(localStorage.getItem(k),o);out.push(r?{at:r.at,load:r.load,frames:(JSON.parse(r.raw).animFrames||[]).length,idb:idb!==null}:null);}return out;});
  let got=null;for(let i=0;i<60;i++){const s=await slots(f);got=s.find(r=>r&&r.frames===made&&r.idb);if(got)break;await page.waitForTimeout(250);}
  assert.ok(got,'구조 사본이 IndexedDB 에 적혔다 '+JSON.stringify(await slots(f)));
  assert.ok(await f.evaluate(()=>window.__qaDraftCalls>0),'기기 초안 쓰기는 이 창에서 막혀 있었다(시험 조건)');
  assert.equal(await f.evaluate(async()=>{const o=_boardPrivateOwner,k=boardDraftKey(o);let v=null;try{v=(await storage.peek(k))?.value??null;}catch(_){}return v===null&&localStorage.getItem(k)===null;}),true,'기기 초안은 비어 있다');
  /* 새로고침 — 저장하지 않았다 */
  await page.reload();f=await board();
  await f.waitForSelector('#boardDraftBar',{timeout:20000});
  assert.match(await f.locator('#boardDraftBar .bd-tx').innerText(),/저장하지 않은 작업이 있어요/);
  assert.equal(await f.evaluate(()=>anim.frames.length),0,'되살리기 전엔 저장본(빈 판)');
  await f.locator('#boardDraftBar .bd-keep').click();
  await f.waitForFunction(n=>anim.frames.length===n,made,{timeout:10000});
  assert.deepEqual(await f.evaluate(()=>state.players.map(p=>p.id)),[901],'선수도 돌아왔다');
  assert.equal(await f.locator('#boardDraftBar').count(),0);
  /* 되살린 뒤 앞 사본 자리는 비고, 이번 문서의 사본이 새로 적힌다 */
  let after=null;for(let i=0;i<60;i++){after=await slots(f);if(after.filter(Boolean).length===1&&after.find(r=>r&&r.load!==got.load&&r.frames===made))break;await page.waitForTimeout(250);}
  assert.equal(after.filter(Boolean).length,1,JSON.stringify(after));assert.notEqual(after.find(Boolean).load,got.load);
  /* «버리기»: 다시 새로고침 → 띠 → 버리기 → 사본 없음 · 다음에 열어도 묻지 않는다 */
  await page.reload();f=await board();await f.waitForSelector('#boardDraftBar',{timeout:20000});
  await f.locator('#boardDraftBar .bd-drop').click();
  for(let i=0;i<40;i++){after=await slots(f);if(!after.some(Boolean))break;await page.waitForTimeout(250);}
  assert.equal(after.some(Boolean),false,'버린 사본은 남지 않는다 '+JSON.stringify(after));
  await page.reload();f=await board();await page.waitForTimeout(3500);
  assert.equal(await f.locator('#boardDraftBar').count(),0,'버린 뒤엔 다시 묻지 않는다');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],'no page errors');
  console.log(JSON.stringify({passed:true,engine,frames:made}));
}catch(e){console.error(e);process.exitCode=1;}finally{process.exit(process.exitCode||0);}
