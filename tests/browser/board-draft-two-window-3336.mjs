/* 3.336 — 같은 계정의 창 둘(A · B)이 작업 보드 초안 칸 하나를 같이 쓴다. B 가 부팅 때 본 뒤에 A 가 칸을 고치면, 예전엔 B 의 초안 쓰기가
   idb-cas(또는 A 가 손댄 직후 닫혀 작은 저장소 사본만 남으면 local-foreign)로 실패하고, B 가 살아 있는 동안 편집마다 «저장되지 않았습니다» ·
   새 판 적용 장벽(psFlushAllPendingReady)이 영영 막혔다 — A 를 닫아도, «보드 저장» 뒤에도. 새로고침해야 풀렸다(운영 기록 update_deferred
   flush_fail:fBoard:board_draft_storage:idb-cas 최장 26시간 · local-foreign 13시간). 이제 A 의 초안을 보관 키(…:kept:unsaved-split-<지문>)에
   글자 그대로 옮긴 뒤 B 가 이어 쓴다. 합성 팀 fixture 에서만 돈다(두 창 — fixture 는 한 기기 한 창을 끈 채 연다). */
import assert from 'node:assert/strict';
import {startFixture,openApp,A,WT} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};let stage='boot';const pages=[];
const readyWs=p=>p.waitForFunction(({wid,A})=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&PSSync.activeWs()===wid&&PSSync.session()?.uid===A&&!document.body.classList.contains('ps-booting')&&w&&w.__boardRestoreDone===true&&w._boardPrivateLoaded===true;},{wid:WT,A},{timeout:60000});
const frameOf=async p=>(await p.waitForSelector('#fBoard')).contentFrame();
const board=async p=>{await readyWs(p);await p.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());const f=await frameOf(p);await f.waitForFunction(()=>(window.__csView||'board')==='board'&&window._boardPrivateLoaded===true,null,{timeout:30000});await f.waitForTimeout(400);return f;};
const edit=(f,n)=>f.evaluate(n=>{pushUndo();const u=n2u(.2+.04*n,.4);state.players.push({id:uid++,team:'blue',num:n,pos:'',x:u.x,y:u.y});renderTokens();},n);
const settled=f=>f.waitForFunction(()=>{const s=PSSaveState.get('board-draft');return _boardDraftT===null&&(s==='saved'||s==='failed');},null,{timeout:20000});
const snap=async(p,f)=>{
  const s=await f.evaluate(async()=>{const o=_boardPrivateOwner,k=boardDraftKey(o),v=await window.storage.get(k),keys=await window.storage.keys(boardPrivateKey(o)+':kept:unsaved-split-');const kept=[];for(const x of keys){const r=await window.storage.get(x);kept.push(r&&r.value);}
    let raw=null;try{raw=JSON.parse(JSON.parse(v.value).raw);}catch(_){}
    return {draft:PSSaveState.get('board-draft'),pill:!!document.getElementById('psSaveFailed'),ls:localStorage.getItem(k),idb:(v&&v.value)||null,kept,
      idbPlayers:raw&&raw.snap&&raw.snap.players?raw.snap.players.length:-1,players:state.players.length,pending:psHasPending()};});
  s.shell=await p.evaluate(()=>psFlushAllPendingReady({}).then(()=>'ok',e=>'flush_fail:'+((e&&e.psFrame)||'?')+':'+((e&&(e.psCode||e.name))||'?')+(e&&e.psWhy?':'+e.psWhy:'')));
  return s;};
const events=p=>p.evaluate(()=>(window.__fixtureEvents||[]));
async function scenario(mode){
  const one=await openApp(fx,size,{browsers});const pa=one.page,ctx=one.context;pages.push(one);
  stage=mode+':A-first';const fa=await board(pa);await edit(fa,1);await settled(fa);
  let s=await snap(pa,fa);assert.equal(s.draft,'saved');assert.equal(s.shell,'ok');
  stage=mode+':B-open';const pb=await ctx.newPage();pb.setDefaultTimeout(45000);await pb.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});let fb=await board(pb);
  const fromA=await fa.evaluate(()=>{const o=_boardPrivateOwner,k=boardDraftKey(o);return k;});
  stage=mode+':A-writes-after-B-booted';let aCopy;
  if(mode==='ls'){   /* A 가 손댄 직후(700ms 안) 닫혀 수명 주기 사본(작은 저장소)만 남은 모양 */
    await pa.bringToFront();await edit(fa,2);await pa.close({runBeforeUnload:true});await pb.waitForTimeout(800);
    aCopy=await fb.evaluate(k=>localStorage.getItem(k),fromA);assert.ok(aCopy,'A 의 수명 주기 사본이 작은 저장소에 남았다');
  }else{
    await edit(fa,2);await settled(fa);aCopy=(await snap(pa,fa)).idb;
  }
  await pb.bringToFront();
  stage=mode+':B-edits';await edit(fb,3);await settled(fb);s=await snap(pb,fb);
  assert.equal(s.draft,'saved','B 의 편집이 초안으로 저장된다(고치기 전: failed · '+(mode==='ls'?'local-foreign':'idb-cas')+')');
  assert.equal(s.pill,false,'«저장되지 않았습니다» 알약 없음');assert.equal(s.shell,'ok','새 판 적용 · 화면 떠나기 장벽이 막히지 않는다');
  assert.ok(s.kept.includes(aCopy),'A 의 초안은 보관 키에 글자 그대로');assert.equal(s.idbPlayers,s.players,'IDB 초안 = B 가 보는 판');assert.equal(s.ls,null);
  stage=mode+':B-again';await edit(fb,4);await settled(fb);s=await snap(pb,fb);assert.equal(s.draft,'saved');assert.equal(s.shell,'ok');assert.equal(s.kept.length,1,'그 뒤 편집은 평소 길');
  if(mode!=='ls'){
    stage=mode+':A-writes-back';await pa.bringToFront();await edit(fa,5);await settled(fa);s=await snap(pa,fa);
    assert.equal(s.draft,'saved','먼저 연 A 도 같은 처방으로 이어 쓴다');assert.equal(s.shell,'ok');assert.equal(s.kept.length,2);await pa.close({runBeforeUnload:true});await pb.bringToFront();
  }
  stage=mode+':B-save-then-edit';assert.equal(await fb.evaluate(()=>Promise.resolve(__boardSaveExplicit()).then(v=>v===true)),true,'«보드 저장»');
  await edit(fb,6);await settled(fb);s=await snap(pb,fb);assert.equal(s.draft,'saved','«보드 저장» 뒤 편집도 저장된다');assert.equal(s.shell,'ok');
  stage=mode+':B-reload';await pb.reload();fb=await board(pb);await fb.waitForSelector('#boardDraftBar',{timeout:20000});
  const restored=await fb.evaluate(()=>{const d=window.__boardDraftPending;try{return JSON.parse(d.raw).snap.players.length;}catch(_){return -1;}});
  assert.equal(restored,s.players,'다시 열면 띠가 묻는 초안 = B 가 마지막으로 본 판');
  /* 운영 기록 한 줄(board_draft_adopted · 까닭 · 숫자만) — 동기화 대기열이 보낼 때까지 */
  const adopted=()=>fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='board_draft_adopted');
  for(let i=0;i<60&&!adopted().some(r=>r.error_code===(mode==='ls'?'local-foreign':'idb-cas'));i++)await pb.waitForTimeout(500);
  const ev=adopted().map(r=>r.error_code);assert.ok(ev.includes(mode==='ls'?'local-foreign':'idb-cas'),'운영 기록 board_draft_adopted '+JSON.stringify(ev));
  assert.deepEqual(Object.keys(adopted()[0].meta||{}).sort(),['idb','kb','kept','ls','n'],'까닭 · 숫자만');
  const errs=one.logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],'작전판 오류 없음 '+JSON.stringify(errs));
  await pb.close();await ctx.close();
  return {mode,kept:s.kept.length,adoptedEvents:ev};
}
try{
  const out=[];for(const m of (process.env.PS_DRAFT_MODES||'idb,ls').split(','))out.push(await scenario(m));
  console.log(JSON.stringify({passed:true,engine,size,out}));
}catch(e){console.error('board-draft-two-window-3336 실패 단계: '+stage);console.error(e);process.exitCode=1;}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}
