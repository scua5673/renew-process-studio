import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {startFixture,openApp,SHOTS,OUT} from '../fixtures/team-app.mjs';
// 3.133 — 사용자 «보관함에서 미팅 자료 만들기 들어가면 상대분석과 경기준비 페이지를 따로 따로 만들어서 팀운영 경기 페이지에 붙힐수 있게».
// ① 보관함 «미팅 만들기» 창에서 «상대 분석»을 고르면 상대 분석 6장 + 태그 #상대 분석(저장 창에 미리).
// ② 팀 운영 › 경기 › 상대 분석(01)에 «상대 분석 자료» 카드 — #상대 분석 자료만, 가져오기도 #상대 분석만. 경기 준비(02)의 «경기 보드»는 나머지.
// ③ 상대 분석 칸의 «＋ 새 상대 분석» — 그 경기 상대 분석의 메모가 장마다. 합성 팀 fixture 에서만 돈다(실제 서버는 건드리지 않는다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
let cur='',failurePage=null,failureMid=null;
const OPP_T=['상대 BEST 11','상대 공격 시','상대 수비 시','상대 수비→공격','상대 공격→수비','상대 세트피스'];
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  failurePage=page;
  await page.waitForTimeout(2000);
  const board=async()=>{const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await f.waitForFunction(()=>typeof window.__meetingSetMatch==='function'&&typeof window.__snapToThumb==='function'&&typeof boardStore==='object'&&window.PSMeetForm&&window.__meetSeed&&window.__meetSeed.__psForm&&window.__meetingFromMatch&&window.__meetingFromMatch.__psForm,null,{timeout:30000});return f;};

  cur='vault-opp';
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  let bf=await board();
  await bf.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await bf.waitForFunction(()=>document.getElementById('dfNew'),null,{timeout:30000});
  await bf.evaluate(()=>document.getElementById('dfNew').click());
  await bf.waitForSelector('.vcc-item');
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await bf.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===10,null,{timeout:15000});
  await bf.waitForFunction(()=>{const o=document.getElementById('psMeetForm');return o&&o.classList.contains('on')&&o.getBoundingClientRect().width>0;},null,{timeout:10000});
  await bf.click('#psMeetForm [data-start=filled]'); // 상대 분석의 기본 배치 경로도 계속 검증

  let st=await bf.evaluate(()=>({title:document.querySelector('#psMeetForm .mf-hd b').textContent,kinds:[...document.querySelectorAll('#psMeetForm .mf-kind button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')),tags:(window.__vaultPending||{}).tags}));
  assert.deepEqual(st,{title:'미팅 자료 만들기',kinds:['경기 준비*','상대 분석'],tags:['경기 준비']},'처음은 경기 준비 — 저장 창에 #경기 준비');
  await bf.click('#psMeetForm .mf-kind [data-kind="opp"]');
  st=await bf.evaluate(()=>({cap:document.querySelector('#psMeetForm .mf-pvn span').textContent,sub:document.querySelector('#psMeetForm .mf-sub').textContent,red:[...document.querySelectorAll('#psMeetForm .mf-pic circle[fill="#d71920"], #psMeetForm .mf-pic circle')].length}));
  assert.match(st.cap,/^상대 BEST 11\s+1 \/ 6$/,'미리보기는 상대 분석 6장 '+st.cap);assert.match(st.sub,/상대 분석 6장/);
  await bf.click('#psMeetForm [data-team="op"] [data-k="433"]');
  await page.screenshot({path:path.join(SHOTS,`match-meet-parts-${engine}-${size}-dialog.png`)});
  await bf.click('#psMeetForm .mf-go');
  await bf.waitForFunction(()=>!document.querySelector('#psMeetForm.on')&&anim.slides.length===6,null,{timeout:10000});
  st=await bf.evaluate(()=>({t:anim.slides.map(s=>s.title),th:anim.slides.every(s=>/<svg/.test(s.thumb||'')),pend:{tags:window.__vaultPending.tags,name:window.__vaultPending.name},
    best:anim.slides[0].snap.players.map(p=>p.team+':'+p.pos).join(','),bestX:anim.slides[0].snap.players.filter(p=>p.pos==='GK').map(p=>p.x>CX),
    red2:anim.slides[1].snap.players.filter(p=>p.team==='red').map(p=>p.pos).sort().join(','),idx:window.__meet.idx()}));
  assert.deepEqual(st.t,OPP_T,'상대 분석 6장 — 상대 분석 화면의 국면 차례');
  assert.equal(st.th,true,'장마다 그림');
  assert.deepEqual(st.pend,{tags:['상대 분석'],name:'상대 분석'},'저장 창에 #상대 분석 · 이름');
  assert.equal(st.best.split(',').every(x=>x.startsWith('red:')),true,'상대 BEST 는 상대 팀만 '+st.best);
  assert.equal(st.best.split(',').length,11);assert.deepEqual(st.bestX,[true],'상대 골키퍼는 오른쪽(상대 골대)');
  assert.equal(st.red2,'DM,GK,LB,LCB,LCM,LW,RB,RCB,RCM,RW,ST','고른 상대 포메이션(4-3-3)이 국면 장에도');
  assert.equal(st.idx,0);
  await page.waitForTimeout(700);   // A4 페이지 미리보기는 100ms 뒤 다시 그린다
  await page.screenshot({path:path.join(SHOTS,`match-meet-parts-${engine}-${size}-vault.png`)});
  await bf.evaluate(()=>window.__bmExitMeeting());
  await bf.waitForFunction(()=>!document.body.classList.contains('meet-mode'));

  cur='lib';
  await bf.evaluate(async()=>{
    const snap=(n,x)=>({players:Array.from({length:n},(_,i)=>({id:i+1,team:i%2?'red':'blue',num:String(i+1),x:x+i*38,y:250+(i%3)*90})),equipment:[],drawings:[],ball:{x:555,y:370}});
    const mk=(id,name,tags)=>{const sl=[['가상 1장',['첫 줄']],['가상 2장',[]]].map((t,i)=>{const s=snap(4+i*3,240+i*60);return {pdfOrientation:'landscape',snap:s,thumb:window.__snapToThumb(s),title:t[0],points:t[1]};});
      return {libId:id,type:'meeting',name,folder:'',thumb:sl[0].thumb,snap:sl[0].snap,slides:sl,tags,savedAt:Date.now(),createdBy:'11111111-1111-4111-8111-111111111111'};};
    const lib=(await boardStore.get('cs_drill_lib_v1'))||[];
    lib.unshift(mk('Vqa_opp','가상 상대 분석',['상대 분석']),mk('Vqa_prep','가상 경기 준비',[]));
    await boardStore.set('cs_drill_lib_v1',lib);try{localStorage.setItem('cs_lib_rev',String(Date.now()));}catch(_){}
  });

  cur='match-prep';
  await page.evaluate(()=>{const b=document.querySelector('[data-team-key="match"]');if(b)b.click();});
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchLoad==='function'&&window.PSMatchMeetParts&&window.mmPaint&&window.mmPaint.__psParts&&(matchLoad().matches||[]).some(m=>/가상 상대 FC/.test(m.opponent||'')),null,{timeout:30000});
  const mid=await sf.evaluate(()=>{const m=matchLoad().matches.find(x=>/가상 상대 FC/.test(x.opponent||''));setView('match');matchOpen(m.id);matchTab='prep';matchStage='prep';renderMatch();return m.id;});
  failureMid=mid;
  await sf.waitForSelector('#matchMeetCard:not([hidden]) .mmv-empty',{timeout:15000});
  const cardSt=()=>sf.evaluate(()=>{const c=document.getElementById('matchMeetCard');return {panel:c.closest('.match-panel').id,head:c.querySelector('.match-card-head b').textContent,
    shown:[...c.querySelectorAll('.mmv[data-mmv]')].map(e=>e.getAttribute('data-mmv')),tabs:[...c.querySelectorAll('.mmv-tabs button[data-mmv-lib]')].map(e=>e.getAttribute('data-mmv-lib')),
    empty:(c.querySelector('.mmv-empty .t b')||{}).textContent||'',nw:[...c.querySelectorAll('[data-mm-new]')].map(b=>b.textContent)};});
  st=await cardSt();assert.equal(st.panel,'matchPrepPanel');assert.equal(st.head,'경기 보드');
  // 경기 준비에서 둘 다 잇는다(예전 시트 그대로 — 어느 칸에 보일지는 태그가 정한다)
  for(const id of ['Vqa_prep','Vqa_opp']){
    await sf.click('#matchMeetCard [data-mm-link]');await sf.waitForSelector('#mmSheetOv .mm-pick[data-mm-lib="'+id+'"]');
    await sf.click('#mmSheetOv .mm-pick[data-mm-lib="'+id+'"]');
    bf=await board();await bf.waitForFunction(async([id,mid])=>{const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.libId===id);return d&&d.matchRef&&d.matchRef.mid===mid;},[id,mid],{timeout:10000});
  }
  await sf.waitForFunction(()=>document.querySelector('#matchMeetCard .mmv[data-mmv="Vqa_prep"]'),null,{timeout:15000});
  st=await cardSt();assert.deepEqual([st.shown,st.tabs],[['Vqa_prep'],[]],'경기 보드에는 경기 준비 자료만 '+JSON.stringify(st));

  cur='match-opp';
  await sf.click('[data-match-step="opp"]');
  await sf.waitForFunction(()=>{const c=document.getElementById('matchMeetCard');return c.closest('#matchOppPanel')&&c.querySelector('.mmv[data-mmv="Vqa_opp"]');},null,{timeout:15000});
  st=await cardSt();
  assert.deepEqual({panel:st.panel,head:st.head,shown:st.shown},{panel:'matchOppPanel',head:'상대 분석 자료',shown:['Vqa_opp']},'상대 분석 칸 맨 위 — #상대 분석 자료만');
  assert.equal(await sf.evaluate(()=>document.querySelector('#matchOppPanel .match-grid').firstElementChild.id),'matchMeetCard');
  await page.screenshot({path:path.join(SHOTS,`match-meet-parts-${engine}-${size}-opp.png`)});
  // 떼면 빈 카드 — 상대 분석의 빈 말 · «＋ 새 상대 분석»
  await sf.evaluate(()=>{window.psConfirm=(m,ok)=>ok();});
  await sf.click('#matchMeetCard [data-mm-unlink="Vqa_opp"]');
  await sf.waitForSelector('#matchMeetCard .mmv-empty',{timeout:15000});
  st=await cardSt();assert.equal(st.empty,'이 경기 상대 분석 자료가 아직 없어요');assert.ok(st.nw.length&&st.nw.every(t=>t==='＋ 새 상대 분석'),JSON.stringify(st.nw));
  // 상대 분석 칸의 가져오기 — #상대 분석 미팅만
  await sf.click('#matchMeetCard .mmv-empty [data-mm-link]');await sf.waitForSelector('#mmSheetOv .mm-pick');
  const picks=await sf.evaluate(()=>({t:document.getElementById('mmSheetT').textContent,ids:[...document.querySelectorAll('#mmSheetOv .mm-pick')].map(b=>b.getAttribute('data-mm-lib'))}));
  assert.match(picks.t,/상대 분석 — 보관함에서 가져오기/);assert.deepEqual(picks.ids,['Vqa_opp'],'#상대 분석 만 '+JSON.stringify(picks));
  await sf.click('#mmSheetOv .mm-pick[data-mm-lib="Vqa_opp"]');
  await sf.waitForFunction(()=>document.querySelector('#matchMeetCard .mmv[data-mmv="Vqa_opp"]'),null,{timeout:15000});
  assert.ok(await sf.evaluate(()=>[...document.querySelectorAll('#cs-ftoast,.toast,[role=status]')].some(e=>/상대 분석에서 바로 보여요/.test(e.textContent))||/상대 분석에서 바로 보여요/.test(document.body.innerText)),'알림도 상대 분석 칸을 말한다');
  // 경기 준비로 돌아가면 카드가 제자리 · 경기 준비 자료
  await sf.click('[data-match-step="prep"]');
  await sf.waitForFunction(()=>{const c=document.getElementById('matchMeetCard');return c.closest('#matchPrepPanel')&&c.querySelector('.mmv[data-mmv="Vqa_prep"]');},null,{timeout:15000});
  st=await cardSt();assert.deepEqual([st.head,st.shown],['경기 보드',['Vqa_prep']]);

  cur='match-new-opp';
  await sf.click('[data-match-step="opp"]');
  await sf.waitForFunction(()=>document.getElementById('matchMeetCard').closest('#matchOppPanel'));
  // 실제 입력·저장 경로를 거친 메모로 검사한다. 메모리만 바꾸면 정상 새로고침에서 사라진다.
  const notes={oppAttack:'가상 공격 메모 1\n가상 공격 메모 2',oppConclusion:'가상 결론',oppSetPlay:'가상 세트피스 메모'};
  for(const [key,value] of Object.entries(notes))await sf.locator(`[data-match-field="${key}"]`).fill(value);
  // Input held while the match document is loading may outlive the ordinary save timers.
  // Wait for every entered field in the stored document; do not refresh an older document into the form.
  await sf.waitForFunction(([id,notes])=>{
    if(matchSaveTimer||scoutStore.hasPending()||_mprT)return false;
    const m=(scoutStore.get(MATCH_KEY)?.matches||[]).find(m=>m.id===id);
    return m&&Object.entries(notes).every(([k,v])=>m[k]===v);
  },[mid,notes],{timeout:15000});
  assert.deepEqual(await sf.evaluate(()=>{
    __matchRefresh();const m=matchGet();
    return {oppAttack:m.oppAttack,oppConclusion:m.oppConclusion,oppSetPlay:m.oppSetPlay};
  }),notes,'저장한 상대 분석 메모는 정상 새로고침 뒤에도 유지된다');
  await sf.click('#matchMeetActs [data-mm-new]');
  bf=await board();
  await bf.waitForFunction(()=>document.querySelector('#psMeetForm.on'),null,{timeout:15000});
  st=await bf.evaluate(()=>({title:document.querySelector('#psMeetForm .mf-hd b').textContent,kind:!!document.querySelector('#psMeetForm .mf-kind'),cap:document.querySelector('#psMeetForm .mf-pvn span').textContent}));
  assert.equal(st.title,'상대 분석 자료 만들기');assert.equal(st.kind,false,'경기에서는 칸이 정한다(고르개 없음)');assert.match(st.cap,/\/ 6$/);
  await bf.click('#psMeetForm .mf-go');
  const made=await bf.evaluate(async mid=>{for(let k=0;k<60;k++){const d=((await boardStore.get('cs_drill_lib_v1'))||[]).find(x=>x.name==='가상 상대 FC전 상대 분석');
      if(d)return {tags:d.tags,mid:d.matchRef&&d.matchRef.mid,t:d.slides.map(s=>s.title),p0:d.slides[0].points,p1:d.slides[1].points,p5:d.slides[5].points,p2:d.slides[2].points};await new Promise(r=>setTimeout(r,250));}return null;},mid);
  assert.ok(made,'만들었다');
  assert.deepEqual(made,{tags:['상대 분석'],mid,t:OPP_T,p0:['결론 — 가상 결론'],p1:['가상 공격 메모 1','가상 공격 메모 2'],p5:['가상 세트피스 메모'],p2:[]},JSON.stringify(made));
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,test:'match-meet-parts',passed:true}));
}catch(e){
  console.error('[match-meet-parts] step='+cur);
  // Failure-only reads: keep the original input, wait predicate, timeout and error.
  try{
    const sf=failurePage?.frames().find(f=>/\/studio\/scout\.html(?:[?#]|$)/.test(f.url()));
    const actual=sf?await sf.evaluate(async expectedMid=>{
      const read=fn=>{try{return fn();}catch(e){return {error:String(e.message||e),code:e.psCode||null};}};
      const keys=['oppAttack','oppConclusion','oppSetPlay'],fields=row=>Object.fromEntries(keys.map(k=>[k,row?.[k]??null]));
      const currentMid=typeof matchCurrent==='undefined'?null:matchCurrent;
      const memory=typeof matchState==='undefined'?null:matchState;
      const row=doc=>doc?.matches?.find(m=>m.id===expectedMid);
      const stores=Object.fromEntries(['cs_team_matches_v1','process_coach_v1'].map(k=>[k,{localRaw:read(()=>localStorage.getItem(k))}]));
      const parse=raw=>typeof raw==='string'?read(()=>JSON.parse(raw)):null;
      const active=document.activeElement,saved=document.getElementById('matchSavedState');
      // Copy every synchronous value before the first asynchronous IDB read.
      const snapshot=JSON.parse(JSON.stringify({
        capturedAt:{wall:Date.now(),performance:performance.now()},
        expectedMid,currentMid,sameMatch:currentMid===expectedMid,
        owner:read(()=>teamSaveOwner()),storeOwner:read(()=>scoutStore.owner()),
        activeWorkspace:read(()=>localStorage.getItem('ps_active_ws')),
        timer:read(()=>!!matchSaveTimer),mpr:read(()=>!!_mprT),revision:read(()=>matchSaveRevision),
        pending:read(()=>scoutStore.hasPending()),hasPending:read(()=>window.psHasPending()),
        failed:Object.fromEntries(['cs_team_matches_v1','process_coach_v1','scout_tool_v1','cs_squad_v1'].map(k=>[k,read(()=>scoutStore.hasFailed(k))])),
        docPending:read(()=>matchDocPending()),canEdit:read(()=>matchCanEdit()),
        canEditOne:read(()=>matchCanEditOne(expectedMid)),typed:read(()=>window.__psMatchLockApi?.typed?.()),
        lockReady:read(()=>window.__psMatchLockApi?.readyInfo?.()),scopes:read(()=>window.PSSaveState?.snapshot?.()),
        stale:{team:window.__teamStale||0,match:window.__matchStale||0},
        view:document.querySelector('.view.on')?.id,tab:read(()=>matchTab),stage:read(()=>matchStage),
        sync:read(()=>parent.PSSync?.state?.()),
        active:{tag:active?.tagName,field:active?.getAttribute?.('data-match-field'),value:active&&'value'in active?active.value:null},
        savedState:{text:saved?.textContent,color:saved?.style.color},
        fields:{memory:fields(row(memory)),local:fields(row(parse(stores.cs_team_matches_v1.localRaw))),dom:Object.fromEntries(keys.map(k=>[k,document.querySelector('[data-match-field="'+k+'"]')?.value??null]))},
        stores
      }));
      for(const [key,entry] of Object.entries(snapshot.stores)){
        try{entry.idbRaw=await Promise.race([window.storage?.peek?.(key),new Promise(resolve=>setTimeout(()=>resolve({error:'diagnostic IDB read timeout'}),2000))]);}
        catch(e){entry.idbRaw={error:String(e.message||e),code:e.psCode||null};}
        entry.idbCompletedAt={wall:Date.now(),performance:performance.now()};
      }
      snapshot.fields.idb=fields(row(parse(snapshot.stores.cs_team_matches_v1.idbRaw)));
      return snapshot;
    },failureMid):{unavailable:true};
    const hash=raw=>typeof raw==='string'?{bytes:Buffer.byteLength(raw),sha256:createHash('sha256').update(raw).digest('hex')}:raw??null;
    if(actual.stores)for(const entry of Object.values(actual.stores)){
      entry.equal=typeof entry.localRaw==='string'&&entry.localRaw===entry.idbRaw;
      entry.local=hash(entry.localRaw);entry.idb=hash(entry.idbRaw);delete entry.localRaw;delete entry.idbRaw;
    }
    const server=fx.db.get(actual.activeWorkspace+'|cs_team_matches_v1');
    const serverDoc=server&&JSON.parse(server.v),serverRow=serverDoc?.matches?.find(m=>m.id===failureMid);
    fs.writeFileSync(path.join(OUT,`match-meet-parts-${engine}-${size}-failure.json`),JSON.stringify({v:1,syntheticOnly:true,engine,size,step:cur,error:{name:e.name,message:e.message},actual,server:{capturedAt:Date.now(),body:hash(server?.v),fields:Object.fromEntries(['oppAttack','oppConclusion','oppSetPlay'].map(k=>[k,serverRow?.[k]??null]))}},null,2)+'\n',{flag:'wx',mode:0o600});
  }catch(diagnosticError){console.error('[match-meet-parts] failure diagnostic unavailable: '+String(diagnosticError.message||diagnosticError));}
  throw e;
}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
