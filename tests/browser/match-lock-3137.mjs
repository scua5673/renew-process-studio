import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SHOTS,OUT} from '../fixtures/team-app.mjs';
// 3.137 — 오류 제보 0ce6d0cc «경기준비 글씨 넣는 상자에 글씨가 안 넣어집니다». 경기 화면이 잠기면(.match-shell.readonly — 서버 확인 대기 ·
// 선수 · 다른 코치 담당) 칸은 pointer-events:none 이라 눌러도 말이 없었고, 칸을 감싼 label 을 누르면 커서가 들어가 글이 써졌지만 저장되지 않고 사라졌다.
// 이제(studio/match-lock.js): 잠긴 칸을 누르면 커서를 넣지 않고 까닭을 알리며, 서버 확인 대기면 바로 다시 맞춘다(PSSync.syncNow). 풀리면 그대로 쓴다.
// 화면만 잠긴 채 남은 경우(입력 중이라 다시 그리기를 미뤘다)는 누르는 순간 다시 그려 그 칸에 들어간다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchLoad==='function'&&window.__psMatchLockApi&&(matchLoad().matches||[]).some(m=>/가상 상대 FC/.test(m.opponent||'')),null,{timeout:30000});
  await sf.evaluate(()=>{const m=matchLoad().matches.find(x=>/가상 상대 FC/.test(x.opponent||''));setView('match');matchOpen(m.id);matchTab='prep';matchStage='prep';renderMatch();});
  await sf.waitForFunction(()=>!document.querySelector('.match-shell').classList.contains('readonly'),null,{timeout:30000});
  const TA='[data-match-field="attack"]';
  // 알림 · 다시 맞추기 부름을 적는다(그대로 부른다)
  await sf.evaluate(()=>{window.__qaToast=[];const t0=window.toast;window.toast=function(m){window.__qaToast.push(String(m));return t0.apply(this,arguments);};
    const S=parent.PSSync;window.__qaActualSyncNow=S.syncNow.bind(S);window.__qaSync=[];S.syncNow=function(r){window.__qaSync.push(String(r||''));return Promise.resolve({});};   /* Guard calls are observed; preparation may separately use the real engine. */
    const p0=window.matchDocPending;window.__qaPend=false;window.matchDocPending=function(){return window.__qaPend||p0.apply(this,arguments);};
    const c0=window.matchCanEdit;window.__qaPerm=false;window.matchCanEdit=function(){return window.__qaPerm?false:c0.apply(this,arguments);};});
  // 처음 연 뒤 도는 회차(match-open · match-open-dependency)가 끝난 뒤에 — 그 끝이 matchState=null · renderMatch() 로 끼어든다(WebKit 은 10초 넘게 걸렸다)
  await sf.waitForFunction(()=>(typeof matchSyncing==='undefined'||!matchSyncing)&&!matchDocPending(),null,{timeout:30000});
  const st=()=>sf.evaluate(TA=>{const t=document.querySelector(TA);return {ro:document.querySelector('.match-shell').classList.contains('readonly'),val:t.value,active:document.activeElement===t,toast:window.__qaToast.slice(),sync:window.__qaSync.slice()};},TA);
  // 칸 가운데를 누른다 — 잠긴 칸은 pointer-events:none 이라 실제로는 칸을 감싼 label 이 눌린다(사용자와 같은 길)
  const clickField=async()=>{await sf.evaluate(TA=>document.querySelector(TA).scrollIntoView({block:'center'}),TA);
    const r=await sf.evaluate(TA=>{const b=document.querySelector(TA).getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};},TA);
    const f=await page.evaluate(()=>{const b=document.getElementById('fScout').getBoundingClientRect();return {x:b.x,y:b.y};});
    await page.mouse.click(f.x+r.x,f.y+r.y);};

  // 1) 서버 확인 대기 — 칸에 들어가지 않고, 까닭을 알리고, 바로 다시 맞춘다
  await sf.evaluate(()=>{window.__qaPend=true;renderMatch();});
  let s=await st();assert.equal(s.ro,true,'서버 확인 대기면 잠긴다');
  await clickField();await page.keyboard.type('abc');await page.waitForTimeout(250);
  s=await st();
  assert.equal(s.active,false,'잠긴 칸에 커서가 들어가지 않는다 '+JSON.stringify(s));
  assert.equal(s.val,'','글이 써지지 않는다(예전엔 써졌다가 저장 없이 사라졌다)');
  assert.ok(s.toast.includes('팀 경기 자료를 서버와 맞추는 중이에요 — 끝나면 바로 쓸 수 있어요'),'까닭을 알린다 '+JSON.stringify(s.toast));
  assert.ok(s.sync.includes('match-locked'),'바로 다시 맞춘다 '+JSON.stringify(s.sync));
  await page.screenshot({path:path.join(SHOTS,'match-lock-3137-'+engine+'-'+size+'.png')});
  // 잠금 기록(내용 없음 — 준비표 · 거울 유무만)
  const ev=await sf.evaluate(()=>{const S=parent.PSSync;try{S.flushEvents&&S.flushEvents();}catch(_){}return window.__psMatchLockApi.readyInfo();});
  assert.equal(typeof ev.mirror,'number','준비 모양을 숫자로 '+JSON.stringify(ev));

  // 2) 풀리면 그대로 쓴다 — 회차가 아직 도는 중이어도(CI WebKit 에서 그랬다) 친 글은 회차가 끝난 뒤 들어간다
  await sf.evaluate(()=>{window.__qaPend=false;renderMatch();});
  await sf.waitForFunction(()=>!document.querySelector('.match-shell').classList.contains('readonly'));
  await clickField();await page.keyboard.type('abc');
  await sf.waitForFunction(()=>matchGet().attack==='abc',null,{timeout:8000});
  s=await st();assert.equal(s.val,'abc','풀리면 쓴다 '+JSON.stringify(s));
  // 2b) 화면은 안 잠겼는데 회차가 도는 중(matchDocPending 참) — 본문은 글을 버리고, 회차 끝의 syncMatchFromCloud 가 matchState=null · renderMatch() 로 칸까지 지웠다
  await sf.evaluate(()=>{window.__qaPend=true;});
  await page.keyboard.type('de');await page.waitForTimeout(400);
  s=await st();assert.equal(s.val,'abcde');assert.equal(await sf.evaluate(()=>matchGet().attack),'abc','회차 중엔 본문이 버린다(예전 그대로)');
  assert.equal(await sf.locator('#matchSavedState').textContent(),'저장 대기 중…','the local status must not claim this input is saved');
  assert.equal(await sf.evaluate(()=>psHasPending()),true,'the memory-only input must block leaving the screen');
  const barrier=await sf.evaluate(async()=>{try{await psFlushPendingReady();return {ok:true};}catch(e){return {ok:false,code:e.psCode};}});
  assert.deepEqual(barrier,{ok:false,code:'match_input_pending'},'pending input must not be reported as safely flushed');
  await sf.evaluate(()=>{window.__qaPend=false;matchState=null;renderMatch();});   // 회차가 끝나 다시 그린다(syncMatchFromCloud 의 길) — 쓰는 중인 칸은 그대로(지워졌어도 300ms 안에 돌려놓는다)
  await sf.waitForFunction(TA=>document.querySelector(TA).value==='abcde',TA,{timeout:3000}).catch(()=>{});
  s=await st();assert.equal(s.val,'abcde','쓰는 중인 칸은 지우지 않는다 '+JSON.stringify(s));
  if(!s.active)console.log('match-lock-3137: 다시 그린 뒤 커서가 칸에 없다(헤드리스 focus) '+JSON.stringify(s));
  await sf.waitForFunction(()=>matchGet().attack==='abcde',null,{timeout:8000});   // 회차가 끝났으니 모델에 들어가고 저장을 건다
  await sf.waitForFunction(()=>window.__psMatchLockApi.typed().length===0,null,{timeout:8000});
  await sf.evaluate(()=>psFlushPendingReady());
  const durable=await sf.evaluate(async()=>{
    const row=await storage.peek('cs_team_matches_v1'),id=matchGet().id;
    return {local:JSON.parse(localStorage.getItem('cs_team_matches_v1')).matches.find(m=>m.id===id).attack,
      idb:JSON.parse(row.value).matches.find(m=>m.id===id).attack,pending:psHasPending()};
  });
  assert.deepEqual(durable,{local:'abcde',idb:'abcde',pending:false},'ready recovery must reach both actual local stores');
  await sf.evaluate(()=>document.activeElement.blur());await page.waitForTimeout(400);
  await sf.evaluate(()=>{matchState=null;renderMatch();});
  s=await st();assert.equal(s.val,'abcde','저장된 글로 다시 그린다 '+JSON.stringify(s));
  // 2c) 회차가 아닌 때 친 글(본문이 받아 320ms 지연 저장만 남은 글) — 그 사이 처음 연 회차가 끝나 syncMatchFromCloud 가 matchState=null · renderMatch() 로 모델을 저장본으로 되돌린다.
  //     글자를 둘 이상 친 칸은 기준이 앞 글자로 옮겨 가 있어 «남의 값»으로 보고 영영 대기했다(CI WebKit match-meet-parts «match-new-opp» — 저장본에 끝내 안 들어감).
  //     쓰는 중인 칸(attack) · 다른 칸으로 옮겨 간 뒤의 칸(defense) 둘 다. 한 evaluate 안에서 차례를 못박는다(지연 저장이 끼어들 틈 없음).
  const lost=await sf.evaluate(TA=>{
    const type=(el,list)=>{el.focus();for(const v of list){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}};
    const d=document.querySelector('[data-match-field="defense"]'),a=document.querySelector(TA);
    type(d,['x','xy']);type(a,['abcdef','abcdefg']);
    const before={timer:!!matchSaveTimer,attack:matchGet().attack,defense:matchGet().defense};
    matchState=null;renderMatch();
    return {before,after:{attack:matchGet().attack,defense:matchGet().defense,dom:a.value}};
  },TA);
  assert.deepEqual(lost.before,{timer:true,attack:'abcdefg',defense:'xy'},'본문이 받았고 지연 저장이 남았다 '+JSON.stringify(lost));
  assert.deepEqual(lost.after,{attack:'abcde',defense:'',dom:'abcdefg'},'회차 끝이 모델을 저장본으로 되돌린다(쓰는 칸의 글은 그대로) '+JSON.stringify(lost));
  const kept=async()=>sf.evaluate(()=>{const id=matchGet().id,row=(JSON.parse(localStorage.getItem('cs_team_matches_v1')||'{}').matches||[]).find(m=>m.id===id)||{};
    return {attack:row.attack,defense:row.defense,dom:document.querySelector('[data-match-field="defense"]').value,typed:window.__psMatchLockApi.typed(),timer:!!matchSaveTimer,store:scoutStore.hasPending(),pending:psHasPending(),state:document.getElementById('matchSavedState').textContent};});
  await sf.waitForFunction(()=>{const id=matchGet().id,row=(JSON.parse(localStorage.getItem('cs_team_matches_v1')||'{}').matches||[]).find(m=>m.id===id)||{};
    return row.attack==='abcdefg'&&row.defense==='xy'&&!window.__psMatchLockApi.typed().length&&!psHasPending();},null,{timeout:8000}).catch(()=>{});
  s=await kept();
  assert.deepEqual({attack:s.attack,defense:s.defense,dom:s.dom,typed:s.typed,pending:s.pending},{attack:'abcdefg',defense:'xy',dom:'xy',typed:[],pending:false},'되돌려진 글은 다시 모델에 들어가 저장된다 '+JSON.stringify(s));
  await sf.evaluate(()=>{const a=document.querySelector('[data-match-field="attack"]');a.focus();a.value='abcde';a.dispatchEvent(new Event('input',{bubbles:true}));const d=document.querySelector('[data-match-field="defense"]');d.focus();d.value='';d.dispatchEvent(new Event('input',{bubbles:true}));d.blur();});
  await sf.waitForFunction(()=>!psHasPending()&&!window.__psMatchLockApi.typed().length&&matchGet().attack==='abcde'&&!matchGet().defense,null,{timeout:8000});
  await page.waitForTimeout(400);

  // 3) 팀 편집 권한 없음 — 그렇다고 알린다(다시 맞추지 않는다)
  await sf.evaluate(()=>{document.activeElement&&document.activeElement.blur();window.__permissionPrepScope=teamSaveOwner();window.__permissionPrepId=matchGet().id;renderMatch();});
  await page.waitForTimeout(1700);
  const permissionPrep={attempts:[],serverRounds:[]},permissionDeadline=Date.now()+8000;
  async function permissionBound(run){
    const remaining=permissionDeadline-Date.now();if(remaining<=0)throw Error('permission premise exceeded 8000ms');
    let timer;try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('permission premise exceeded 8000ms')),remaining);})]);}finally{clearTimeout(timer);}
  }
  let permissionReady=false,preparedWithServer=false;
  try{
    while(Date.now()<permissionDeadline){
      let barrier={ok:true};try{await permissionBound(()=>sf.evaluate(()=>psFlushPendingReady()));}catch(e){barrier={ok:false,error:e.name};}
      const observed=await permissionBound(()=>sf.evaluate(async()=>{
        function current(){if(teamSaveOwner()!==window.__permissionPrepScope||matchGet().id!==window.__permissionPrepId||localStorage.getItem('ps_ws_switch_guard_v1'))throw Error('permission preparation owner changed');}
        current();const raw=localStorage.getItem(MATCH_KEY),row=(await storage.peek(MATCH_KEY))?.value??null;current();
        let localExact=false,idbExact=false;try{localExact=JSON.parse(raw).matches.find(m=>m.id===window.__permissionPrepId).attack==='abcde';idbExact=JSON.parse(row).matches.find(m=>m.id===window.__permissionPrepId).attack==='abcde';}catch(_){}
        return {keyReady:parent.PSSync.keyReady(MATCH_KEY,localStorage.getItem('ps_active_ws')),matchPending:matchDocPending(),syncing:typeof matchSyncing!=='undefined'&&matchSyncing,typed:window.__psMatchLockApi.typed().length,pending:psHasPending(),localIdbExact:raw===row,localExact,idbExact};
      }));
      permissionPrep.attempts.push({barrier,...observed});
      if(barrier.ok&&observed.keyReady&&!observed.matchPending&&!observed.syncing&&observed.typed===0&&!observed.pending&&observed.localIdbExact&&observed.localExact&&observed.idbExact){permissionReady=true;break;}
      if(!preparedWithServer){
        preparedWithServer=true;
        const result=await permissionBound(()=>sf.evaluate(()=>window.__qaActualSyncNow('fixture-permission-ready')));
        permissionPrep.serverRounds.push({error:!!result?.error,skip:!!result?.skip,pending:result?.pending??null,scheduleDeferred:!!result?.scheduleDeferred});
      }
      await page.waitForTimeout(Math.min(100,Math.max(1,permissionDeadline-Date.now())));
    }
    assert.equal(permissionReady,true,'permission scenario requires real MATCH readiness and exact durable input');
    await permissionBound(()=>sf.evaluate(()=>{
      window.__permissionReadyBefore={keyReady:parent.PSSync.keyReady(MATCH_KEY,localStorage.getItem('ps_active_ws')),matchPending:matchDocPending(),syncing:typeof matchSyncing!=='undefined'&&matchSyncing,typed:window.__psMatchLockApi.typed().length,pending:psHasPending()};
      const p=window.__permissionReadyBefore;
      if(teamSaveOwner()!==window.__permissionPrepScope||matchGet().id!==window.__permissionPrepId||localStorage.getItem('ps_ws_switch_guard_v1')||!p.keyReady||p.matchPending||p.syncing||p.typed||p.pending)throw Error('permission premise changed before input');
      window.__qaToast.length=0;window.__qaSync.length=0;window.__qaPerm=true;renderMatch();
    }));
  }catch(error){
    permissionPrep.error={name:error.name,message:error.message};
    permissionPrep.current=await sf.evaluate(()=>({keyReady:parent.PSSync.keyReady(MATCH_KEY,localStorage.getItem('ps_active_ws')),matchPending:matchDocPending(),syncing:typeof matchSyncing!=='undefined'&&matchSyncing,typed:window.__psMatchLockApi.typed().length,pending:psHasPending(),reason:window.__psMatchLockApi.reason(),ready:window.__psMatchLockApi.readyInfo()})).catch(e=>({observationError:e.name}));
    fs.writeFileSync(path.join(OUT,'match-permission-preparation.json'),JSON.stringify(permissionPrep,null,2));throw error;
  }
  fs.writeFileSync(path.join(OUT,'match-permission-preparation.json'),JSON.stringify(permissionPrep,null,2));
  await clickField();await page.waitForTimeout(200);
  s=await st();
  if(!s.toast.includes('팀 자료를 고칠 권한이 없어요')){
    const observed=await sf.evaluate(async()=>{const raw=localStorage.getItem(MATCH_KEY),row=(await storage.peek(MATCH_KEY))?.value??null;let localAttackExact=false;try{localAttackExact=JSON.parse(raw).matches.find(m=>m.id===matchGet().id).attack==='abcde';}catch(_){}return {before:window.__permissionReadyBefore,keyReady:parent.PSSync.keyReady(MATCH_KEY,localStorage.getItem('ps_active_ws')),matchPending:matchDocPending(),syncing:typeof matchSyncing!=='undefined'&&matchSyncing,typed:window.__psMatchLockApi.typed().length,pending:psHasPending(),reason:window.__psMatchLockApi.reason(),ready:window.__psMatchLockApi.readyInfo(),localIdbExact:raw===row,localAttackExact};}).catch(e=>({observationError:e.name}));
    fs.writeFileSync(path.join(OUT,'match-permission-failure.json'),JSON.stringify({engine,size,observed},null,2));
  }
  assert.ok(s.toast.includes('팀 자료를 고칠 권한이 없어요'),JSON.stringify(s));
  assert.equal(s.active,false);assert.ok(!s.sync.includes('match-locked'),'권한 잠금은 다시 맞추지 않는다');

  // 4) 화면만 잠긴 채 남았다(고칠 수 있는데 readonly 표시) — 누르면 다시 그려 그 칸으로 들어간다
  await sf.evaluate(()=>{window.__qaPerm=false;renderMatch();document.querySelector('.match-shell').classList.add('readonly');window.__qaToast.length=0;});
  await page.waitForTimeout(1700);
  await clickField();
  await sf.waitForFunction(TA=>!document.querySelector('.match-shell').classList.contains('readonly')&&document.activeElement===document.querySelector(TA),TA,{timeout:5000});
  s=await st();assert.deepEqual(s.toast,[],'고칠 수 있으면 알리지 않는다');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('match-lock-3137 ok',engine,size);
}finally{
  for(const b of Object.values(browsers))try{await b.close();}catch(_){}
  try{await fx.close();}catch(_){}
}
