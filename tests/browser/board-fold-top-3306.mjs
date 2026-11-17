import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.306 — 사용자 «하단도구 접기 누르면 상단에 있는 것도 같이 접히는걸로 해줘»(합성 팀 fixture 에서만).
//  ① 작업 보드: 아래 도크의 «도구 접기» → 위쪽 띠(보드 ▾ · 페이지 탭 · 평면/3D · 내보내기 · 저장)도 같이 걷힌다 · 판은 제자리(띠는 떠 있는 겹)
//     · «도구 펼치기» 알약으로 위 · 아래가 같이 돌아온다 · ⌘/Ctrl + . 도 같다 · 열려 있던 «보드 ▾» 메뉴는 남지 않는다
//     (고치기 전 코드는 접어도 띠가 그대로 보인다 — `fold` 단계에서 떨어진다)
//  ② 보관함 작전판 편집: 띠는 같이 걷히고, 편집기 맨 위 줄(이름 · 전체화면 · 나가기 · 저장)은 남는다(접힘은 새로고침 뒤에도 이어지므로 저장 · 나가기는 늘 보이게)
//  ③ 새로고침 뒤에도 접힌 채면 띠도 접힌 채(도크 접힘 기억 ps_dock_folded_v1 하나가 둘 다 정한다)
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-fold-top-3306 '+s);};
const READY=()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring;};
const look=f=>f.evaluate(()=>{
  const box=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0?{l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}:false;};
  return {folded:document.body.classList.contains('cmd-dock-folded'),strip:box('boardPageStrip'),menu:box('ps-tb-menu'),vbar:box('vCreateBar'),handle:box('cmd-dock-handle'),tools:box('cmd-tool-row'),board:box('board'),
    tabs:[...document.querySelectorAll('#boardPageStrip .bp-tab')].filter(e=>e.getClientRects().length).length,save:!!(document.getElementById('boardManualSave')&&document.getElementById('boardManualSave').getClientRects().length)};});
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForFunction(READY,null,{timeout:60000});
  let f=await (await page.$('#fBoard')).contentFrame();
  assert.equal(await f.evaluate(()=>document.body.classList.contains('ps-dock-float')),true,'이 시험은 떠 있는 도크 화면(데스크톱 · 아이패드)을 본다');
  await f.waitForFunction(()=>{const s=document.getElementById('boardPageStrip'),b=document.getElementById('ps-df-fold');return s&&s.classList.contains('ps-tb')&&s.getClientRects().length&&b&&b.offsetWidth>0;},null,{timeout:20000});

  step('open');
  const open0=await look(f);
  assert.equal(open0.folded,false);assert.ok(open0.strip&&open0.strip.t<=8,'위쪽 띠가 보인다 '+JSON.stringify(open0.strip));assert.ok(open0.tabs>=1&&open0.save,'페이지 탭 · «저장»이 보인다');assert.ok(open0.tools,'도구 줄이 보인다');

  step('fold');
  /* «보드 ▾» 메뉴를 연 채로 접어도 메뉴가 남지 않는다 */
  await f.evaluate(()=>document.getElementById('tbBrand').click());
  assert.ok((await look(f)).menu,'«보드 ▾» 메뉴가 열렸다');
  /* 메뉴가 열린 채 단축키로 접는다(단추를 누르면 바깥 누름으로 메뉴가 먼저 닫힌다 — 단축키 길이 메뉴를 남길 수 있는 길) */
  await f.evaluate(()=>window.__psDockFold('close'));
  await f.waitForFunction(()=>document.body.classList.contains('cmd-dock-folded'),null,{timeout:5000});await page.waitForTimeout(400);
  const fold=await look(f);
  assert.equal(fold.strip,false,'«도구 접기» → 위쪽 띠도 같이 접힌다 '+JSON.stringify(fold.strip));
  assert.equal(fold.tabs,0);assert.equal(fold.save,false,'띠의 단추(페이지 탭 · «저장»)도 안 보인다');assert.equal(fold.menu,false,'열려 있던 «보드 ▾» 메뉴도 남지 않는다');
  assert.equal(await f.evaluate(()=>document.getElementById('ps-tb-menu').classList.contains('on')),false,'메뉴는 닫힌 것이다(펼쳤을 때 다시 뜨지 않는다)');
  assert.equal(fold.tools,false,'아래 도구 줄은 원래대로 접힌다');assert.ok(fold.handle,'«도구 펼치기» 알약은 보인다');
  /* 3.309 — 띠는 무대 위 제 줄(헤더)이라 걷히면 그 줄이 사라져 운동장이 위로 커진다(예전 «판은 제자리»는 떠 있는 겹일 때의 기대) */
  assert.ok(fold.board&&fold.board.t<open0.board.t&&fold.board.l===open0.board.l&&fold.board.w>=open0.board.w,'접으면 판이 띠 자리까지 올라온다 '+JSON.stringify([open0.board,fold.board]));
  assert.ok(fold.board.h>open0.board.h,'판이 커진다');

  step('button');
  /* 단추(«도구 접기»)로도 같다 */
  await f.evaluate(()=>window.__psDockFold('open'));await page.waitForTimeout(300);
  await f.evaluate(()=>document.getElementById('ps-df-fold').click());
  await f.waitForFunction(()=>document.body.classList.contains('cmd-dock-folded'),null,{timeout:5000});await page.waitForTimeout(300);
  const fold2=await look(f);assert.equal(fold2.strip,false,'«도구 접기» 단추 → 띠도 같이');assert.ok(fold2.handle);

  step('unfold');
  await f.evaluate(()=>document.querySelector('#cmd-dock-handle .open').click());
  await f.waitForFunction(()=>!document.body.classList.contains('cmd-dock-folded'),null,{timeout:5000});await page.waitForTimeout(400);
  const open1=await look(f);
  assert.ok(open1.strip&&open1.tabs===open0.tabs&&open1.save,'«도구 펼치기» → 띠가 같이 돌아온다 '+JSON.stringify(open1));assert.ok(open1.tools);
  assert.deepEqual(open1.board,open0.board,'판은 처음 자리 그대로');

  step('shortcut');
  const key=async()=>{await f.evaluate(()=>{const mac=typeof _PTR_MAC!=='undefined'&&_PTR_MAC;document.dispatchEvent(new KeyboardEvent('keydown',{key:'.',metaKey:!!mac,ctrlKey:!mac,bubbles:true,cancelable:true}));});await page.waitForTimeout(300);};
  await key();let k=await look(f);assert.equal(k.folded,true);assert.equal(k.strip,false,'⌘/Ctrl + . 도 위 · 아래를 같이 접는다');
  await key();k=await look(f);assert.equal(k.folded,false);assert.ok(k.strip&&k.tools,'한 번 더 누르면 같이 편다');

  step('reload-folded');
  await f.evaluate(()=>window.__psDockFold('close'));await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>localStorage.getItem('ps_dock_folded_v1')),'1');
  await page.reload();await page.waitForFunction(READY,null,{timeout:60000});
  f=await (await page.$('#fBoard')).contentFrame();
  await f.waitForFunction(()=>document.body.classList.contains('cmd-dock-folded')&&document.getElementById('cmd-dock-handle')&&document.getElementById('cmd-dock-handle').getClientRects().length>0,null,{timeout:25000});
  await f.waitForFunction(()=>{const s=document.getElementById('boardPageStrip');return s&&s.classList.contains('ps-tb');},null,{timeout:20000});
  const re=await look(f);
  assert.equal(re.strip,false,'새로고침 뒤 접힌 채면 띠도 접힌 채 '+JSON.stringify(re.strip));assert.ok(re.handle,'알약으로 펼 수 있다');
  await f.evaluate(()=>document.querySelector('#cmd-dock-handle .open').click());await page.waitForTimeout(400);
  const re2=await look(f);assert.ok(re2.strip&&re2.tools&&re2.save,'펼치면 위 · 아래가 돌아온다');
  assert.equal(await f.evaluate(()=>localStorage.getItem('ps_dock_folded_v1')),'0');

  step('vault-edit');
  await f.evaluate(async()=>{
    const base=captureSnap(),p=PR();
    const snap=Object.assign({},base,{players:[0,1,2,3].map(i=>({id:'b'+i,name:'',num:i+1,team:'blue',x:p.L+(p.R-p.L)*(.2+i*.15),y:p.T+(p.B-p.T)*(.3+i*.1)})),equipment:[],drawings:[],tokV:2,label:'num',gridType:'off'});
    const it={libId:'Lfoldtop3306',type:'board',name:'가상 접기 판',folder:'',tags:['작전판'],hold:.6,coaching:'',desc:'',focus:'',method:'',overview:'',rpe:5,sets:1,snap,frames:[],savedAt:Date.now(),editedAt:Date.now()};
    try{stampCreator(it);}catch(_){}
    await libTurn(()=>libGet().then(lib=>{lib.unshift(it);return libWrite(lib).then(()=>{libTouch();});}));
  });
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});
  await f.waitForSelector('.vc-act.edit',{timeout:15000});
  for(let i=0;;i++){await f.evaluate(()=>{const b=document.querySelector('.vc-act.edit');if(b)b.click();});if(await f.waitForFunction(()=>window.__vaultEdit&&window.__curVaultId&&window.__csView==='board'&&!window.__vaultHydrating,null,{timeout:6000}).then(()=>true,()=>false))break;if(i>=3)throw new Error('보관함 작전판 편집이 열리지 않았다');}
  await f.waitForFunction(()=>{const s=document.getElementById('boardPageStrip'),v=document.getElementById('vCreateBar');return s&&s.getClientRects().length&&v&&v.getClientRects().length;},null,{timeout:15000});
  const v0=await look(f);assert.ok(v0.strip&&v0.vbar,'편집기: 맨 위 줄과 띠가 보인다 '+JSON.stringify(v0));
  await f.evaluate(()=>document.getElementById('ps-df-fold').click());
  await f.waitForFunction(()=>document.body.classList.contains('cmd-dock-folded'),null,{timeout:5000});await page.waitForTimeout(400);
  const v1=await look(f);
  assert.equal(v1.strip,false,'편집기에서도 띠가 같이 접힌다');assert.ok(v1.vbar,'맨 위 줄(이름 · 전체화면 · 나가기 · 저장)은 남는다 — 저장 · 나가기는 늘 보인다');
  assert.equal(v1.vbar.h,v0.vbar.h);assert.ok(v1.board.t<v0.board.t,'3.309 — 띠 줄이 사라져 판이 올라온다(맨 위 줄 바로 아래) '+JSON.stringify([v0.board,v1.board]));
  await f.evaluate(()=>document.querySelector('#cmd-dock-handle .open').click());await page.waitForTimeout(400);
  const v2=await look(f);assert.ok(v2.strip&&v2.tools&&v2.vbar,'펼치면 돌아온다');

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'board-fold-top-3306',engine,size,passed:true,strip:open0.strip,folded:{strip:fold.strip,handle:!!fold.handle}}));
}catch(e){console.error('board-fold-top-3306 실패 단계: '+cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
