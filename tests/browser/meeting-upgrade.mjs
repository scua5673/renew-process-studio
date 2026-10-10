import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS,WT} from '../fixtures/team-app.mjs';
// 2.974 — 예전에 만든 미팅도 새 규칙으로: 보관함에서 고칠 수 있게 열면 한 번 — 손대지 않은 BEST 11 · 이름 · 맨 위 문구. 남의 미팅(보기 전용)은 그대로.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&typeof libGet==='function'&&window.__meetTplSlides&&window.__vaultOpenMeeting);
  // 2.960~2.969 에 만든 미팅처럼: BEST 11 은 옛 기본 자리 · 1장 7번에만 이름 · 9번은 장마다 다른 이름 · 1장에만 맨 위 문구
  const ids=await bf.evaluate(async()=>{
    const OLD=[[5,34],[19,9],[16,25],[16,43],[19,59],[28,34],[36,22],[36,46],[47,10],[49,34],[47,58]],NUM=[1,3,4,5,2,6,8,10,7,9,11];
    const mk=(libId,createdBy)=>{
      const slides=window.__meetTplSlides(captureSnap(),false,'v').map(s=>({pdfOrientation:'portrait',snap:s.snap,thumb:'',title:s.title,points:[]}));
      NUM.forEach((n,i)=>{const q=slides[0].snap.players.find(p=>p.team==='blue'&&String(p.num)===String(n));q.x=Math.round((L+OLD[i][0]*MPP)*10)/10;q.y=Math.round((T+OLD[i][1]*MPP)*10)/10;});
      const b7=k=>slides[k].snap.players.find(p=>p.team==='blue'&&String(p.num)==='7'),b9=k=>slides[k].snap.players.find(p=>p.team==='blue'&&String(p.num)==='9');
      b7(0).name='김민수';b9(1).name='박지성';b9(2).name='차범근';slides[0].pageBrand='프로세스FC 미팅';
      const it={libId,type:'meeting',name:'옛 미팅 '+libId,folder:'',thumb:'',snap:slides[0].snap,slides,tags:[],savedAt:Date.now()-86400000};
      if(createdBy)it.createdBy=createdBy;return it;
    };
    const lib=await libGet();const mine=mk('VOLDMINE'),view=mk('VOLDVIEW',psMyUid());
    lib.unshift(mine,view);await libWrite(lib);
    window.__toasts=[];const t0=window.toast;window.toast=function(m){window.__toasts.push(String(m||''));return t0.apply(this,arguments);};
    /* 진단 — 보관함(cs_drill_lib_v1)에 누가 언제 무엇을 썼나. 자동 저장이 늦으면 이 기록을 실패 메시지에 싣는다.
       it: 그 쓰기 안의 «내 미팅» — at(seed=심은 그대로 · new=다시 저장됨) · n7(2장 7번 이름) · thumb */
    const T0=Date.now(),log=window.__libLog=[];
    const peek=v=>{try{const a=typeof v==='string'?JSON.parse(v):v,it=Array.isArray(a)&&a.find(x=>x&&x.libId===mine.libId);if(!it)return 'none';
      const q=it.slides&&it.slides[1]&&it.slides[1].snap.players.find(p=>p.team==='blue'&&String(p.num)==='7');return {at:it.savedAt===mine.savedAt?'seed':'new',n7:(q&&q.name)||'-',thumb:!!it.thumb};}catch(_){return 'err';}};
    const by=()=>String(new Error().stack||'').split('\n').slice(2,7).map(x=>x.trim().replace(/\(?https?:\/\/[^\s)]*\//g,'').replace(/^at /,'')).filter(Boolean).join(' < ').slice(0,240);
    const track=(e,p)=>Promise.resolve(p).then(r=>{e.ok=r===undefined?true:r;e.ms=Date.now()-T0-e.t;return r;},err=>{e.err=String((err&&(err.name+': '+err.message))||err).slice(0,120);throw err;});
    const wrap=(w,tag)=>{const st=w.storage;if(!st||st.__libTrace)return;st.__libTrace=1;const set=st.set,cas=st.replaceIfValue;
      st.set=function(k,v){if(k!=='cs_drill_lib_v1')return set.apply(this,arguments);const e={t:Date.now()-T0,tag,op:'set',it:peek(v),by:by()};log.push(e);return track(e,set.apply(this,arguments));};
      if(cas)st.replaceIfValue=function(k,x,v){if(k!=='cs_drill_lib_v1')return cas.apply(this,arguments);const e={t:Date.now()-T0,tag,op:'cas',it:peek(v),by:by()};log.push(e);return track(e,cas.apply(this,arguments));};};
    wrap(window,'board');try{wrap(window.parent,'shell');}catch(_){}
    const lw=window.libWrite;window.libWrite=function(l){const e={t:Date.now()-T0,tag:'board',op:'libWrite',it:peek(l),by:by()};log.push(e);return track(e,lw.apply(this,arguments));};
    return [mine.libId,view.libId,mine.savedAt];
  });
  const shape=()=>bf.evaluate(()=>{const S=anim.slides,blue=S[0].snap.players.filter(p=>p.team==='blue');const xs=blue.map(p=>p.x);
    const nm=(k,n)=>(S[k].snap.players.find(p=>p.team==='blue'&&String(p.num)===n)||{}).name||'-';
    return {n:S.length,span:(Math.max(...xs)-Math.min(...xs))/MPP,red0:S[0].snap.players.filter(p=>p.team==='red').length,
      n7:S.map((_,k)=>nm(k,'7')),n9:S.map((_,k)=>nm(k,'9')),brand:S.map(s=>s.pageBrand==null?'PROCESS':s.pageBrand)};});

  /* 자동 저장이 늦을 때 실패 메시지에 싣는 값 — 가설보다 값을 먼저.
     sub: 저장 상태 줄이 지나온 글자(저장 준비 중… → 저장 중… → 이 기기에 저장됨 ✓ / 저장 실패…) · 편집 상태 깃발 ·
     item.at: 보관함 원본이 심은 그대로(seed)인지 다시 저장됐는지(new) · 셸 동기화 상태 · [PSStorage] 경고 · 보관함 쓰기 기록 */
  const autosaveDiag=async subs=>{
    const d=await bf.evaluate(async ({id,seedAt})=>{
      let it=null,libErr=null;try{it=(await libGet()).find(x=>x.libId===id)||null;}catch(e){libErr=String(e&&e.name||e);}
      let sync=null,pend=null;try{const s=window.parent.PSSync.state();sync={kind:s.kind,reason:s.reason||'',text:s.text,n:s.n};pend=JSON.stringify(window.parent.PSSync.pending()).slice(0,200);}catch(e){sync=String(e);}
      return {sub:(document.getElementById('vCreateSub')||{}).textContent||null,edit:!!window.__vaultEdit,cur:window.__curVaultId||null,hydrating:!!window.__vaultHydrating,
        pending:window.__vaultPending||null,ro:!!window.__vaultReadOnly,view:window.__csView,meet:document.body.classList.contains('meet-mode'),
        item:it?{at:it.savedAt===seedAt?'seed':'new',thumb:!!it.thumb}:'missing',libErr,sync,pend,writes:(window.__libLog||[]).slice(-14)};
    },{id:ids[0],seedAt:ids[2]}).catch(e=>({diagErr:String(e)}));
    return {...d,subs,warn:logs.filter(l=>/\[PSStorage\]/.test(l.text)).map(l=>l.text).slice(-6)};
  };

  // ① 내 미팅 — 열면 새 규칙
  await bf.evaluate(id=>window.__vaultOpenMeeting(id),ids[0]);
  await bf.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
  await page.waitForTimeout(500);
  let s=await shape();
  assert.ok(s.span>=79,'BEST 11 이 운동장 전체로 '+s.span+'m');
  assert.deepEqual(s.n7,Array(9).fill('김민수'),'7번 이름이 모든 장에 '+JSON.stringify(s.n7));
  assert.deepEqual(s.n9,['-','박지성','차범근','-','-','-','-','-','-'],'장마다 다른 9번 이름은 그대로');
  assert.deepEqual(s.brand,Array(9).fill('프로세스FC 미팅'));
  const toasts=await bf.evaluate(()=>window.__toasts.slice());
  assert.ok(toasts.some(t=>/^예전에 만든 미팅을 새 규칙으로 맞췄어요 — BEST 11 배치 · 이름 8곳 · 맨 위 문구 8장$/.test(t)),JSON.stringify(toasts));
  assert.equal(await bf.evaluate(()=>window.__meetUpgrade().changed),false,'다시 돌려도 바꿀 것이 없다');
  // 자동 저장 — 보관함 원본과 서버 행까지
  /* waitForFunction 은 비동기 조건의 Promise 를 참으로 읽는다 — 직접 되묻는다 */
  const subs=[];
  for(let k=0;;k++){
    const r=await bf.evaluate(async id=>{const sub=(document.getElementById('vCreateSub')||{}).textContent||'';const it=(await libGet()).find(x=>x.libId===id);if(!it)return {ok:false,sub};const q=it.slides[1].snap.players.find(p=>p.team==='blue'&&String(p.num)==='7');return {ok:!!(q&&q.name==='김민수'),sub};},ids[0]);
    if(subs[subs.length-1]!==r.sub)subs.push(r.sub);
    if(r.ok)break;
    if(k>=50)assert.fail('자동 저장이 15초 안에 끝나지 않았다 '+JSON.stringify(await autosaveDiag(subs)));
    await page.waitForTimeout(300);
  }
  const saved=await bf.evaluate(async id=>{const it=(await libGet()).find(x=>x.libId===id);const xs=it.slides[0].snap.players.filter(p=>p.team==='blue').map(p=>p.x);return {span:(Math.max(...xs)-Math.min(...xs))/MPP,brand:it.slides[8].pageBrand};},ids[0]);
  assert.ok(saved.span>=79,JSON.stringify(saved));assert.equal(saved.brand,'프로세스FC 미팅');
  await page.waitForTimeout(1500);
  const row=fx.lib.get(WT+'|'+ids[0]);
  if(row&&row.item){const it=typeof row.item==='string'?JSON.parse(row.item):row.item;const q=it.slides&&it.slides[3].snap.players.find(p=>p.team==='blue'&&String(p.num)==='7');assert.equal(q&&q.name,'김민수','서버 행에도');}
  await page.screenshot({path:path.join(SHOTS,'meeting-upgrade-'+size+'.png')});

  // ② 남이 만든 미팅 — 보기 전용이라 저장본 그대로 보인다(남의 항목은 서버에서만 오므로, 내 항목을 «남의 계정»으로 열어 같은 길을 탄다)
  await bf.evaluate(()=>{try{document.getElementById('vCreateCancel').click();}catch(_){}});
  await page.waitForTimeout(600);
  await bf.evaluate(()=>{window.__toasts=[];window.__myUid0=window.psMyUid;window.psMyUid=()=>'99999999-9999-4999-8999-999999999999';});
  await bf.evaluate(id=>window.__vaultOpenMeeting(id),ids[1]);
  await bf.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
  await page.waitForTimeout(500);
  s=await shape();
  assert.ok(s.span<50,'보기 전용 미팅의 BEST 11 은 옛 자리 그대로 '+s.span+'m');
  assert.deepEqual(s.n7,['김민수','-','-','-','-','-','-','-','-']);
  assert.equal(s.brand[1],'PROCESS');
  assert.ok(!(await bf.evaluate(()=>window.__toasts.some(t=>/새 규칙/.test(t)))),'보기 전용엔 알림도 없다');
  assert.equal(await bf.evaluate(()=>window.__vaultReadOnly),true);
  await page.waitForTimeout(1500);
  const kept=await bf.evaluate(async id=>{const it=(await libGet()).find(x=>x.libId===id);const xs=it.slides[0].snap.players.filter(p=>p.team==='blue').map(p=>p.x);return (Math.max(...xs)-Math.min(...xs))/MPP;},ids[1]);
  assert.ok(kept<50,'보기 전용 미팅은 저장도 안 된다 '+kept);
  await bf.evaluate(()=>{window.psMyUid=window.__myUid0;});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('meeting-upgrade ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
