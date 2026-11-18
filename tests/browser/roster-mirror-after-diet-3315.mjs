import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS,WT,A} from '../fixtures/team-app.mjs';

/* 3.315 회귀 — 그림을 품은 옛 일정 사본(8MB 급)으로 가득 찬 작은 저장소에서 선수단 거울 쓰기가 성공한다.
   실측(2026-11-17 풋볼A 주인 맥, 3.306~3.313): 서버 일정 문서는 참조(thumbRef)만인데 기기 거울 process_coach_v1 은 그림을 되돌린 8,172KB 라
   localStorage(10MB) 가 10,237KB 로 가득 → 선수단 거울(scout_tool_v1 · 111KB) 쓰기가 5분마다 실패(sync_failed sync_storage · stage scout_mirror_write 37건)
   → 선수단 화면이 비어 «선수단이 지워졌어». 3.315(sync-sched-blob.js · schedule-thumb-ref.js · BLOB_KEYS 일정 2)는 회차가 옛 사본을 서버 원문(참조만)으로 바꾼다.
   기존 schedule-thumb-ref-3315(참조 · 캐시 · 다이어트) · match-large-schedule(기기 사본 < 3.5MB)은 기기 사본 크기까지만 본다 — 여기서는 그 뒤의 선수단 거울 쓰기를 직접 단언한다.
   시나리오(합성 팀 fixture 만 · 실계정 · 운영 DB 없음):
   ① 서버: 일정에 512자 넘는 훈련 그림 60장(각 ≈69K자 SVG 조각 — 웹킷은 ≈37K자 · 서버 문서엔 thumbRef 참조 · 그림은 ps_blob) + 선수단 51명(scout_tool_v1 + sq:<id> 행)
   ② 앱을 한 번 열어 받는다(첫 열기의 정리 — 평가 항목 채움 · 경기 번호 — 가 서버에 올라가 가라앉은 뒤의 서버 원문이 기준) → 옛 판 기기처럼 심는다:
      그림을 되돌린 수화본(≈8MB UTF-16)을 localStorage · IndexedDB 두 사본에, 확정 hash · 준비표도 그 수화본으로(옛 판은 받을 때 그림을 되돌려 저장했다) ·
      선수단 거울은 있음(3.315 를 받은 맥 5eddb429 와 같다) · 나머지 키 몫(≈1.9MB)을 채워 남는 자리를 선수단 거울보다 작게 둔다 — 다이어트 없이는 거울을 다시 못 쓰는 저장소.
   ③ 앱을 다시 띄워 회차를 돌린다 — 두 단계로: ⓐ 회차가 일정 사본을 서버 원문으로 바꾼다(다이어트) ⓑ 선수단 거울을 지운 뒤(한 번도 못 쓴 아이패드 · 맥 5eddb429 의 13:53 전 상태)
      회차가 거울을 다시 쓴다. ⚠ 둘을 한 회차에 두면(거울 없음 + 가득 참 상태로 부팅) 같은 회차 안에서 거울 쓰기가 다이어트 쓰기보다 먼저 돌 수 있다 —
      PR #888 CI(느린 실행기)가 그 길을 잡았다: 부팅 회차 `sync_failed sync_storage scout_mirror_write` 한 건 뒤 다음 회차가 성공(끝 상태는 맞음). 앱의 순서 보장은 없으니
      시험은 단계마다 앱이 보장하는 것만 단언하고, 같은 회차 경합은 후속(sync.js 쓰기 순서)으로 남긴다.
   단언: (a) 거울 process_coach_v1 = 서버 원문(글자 수 같음 · 참조만) · IDB 도 같음 · 서버 문서는 그대로(올리지 않았다) · 작은 저장소 총량 < 한도 10MB 의 절반
         (b) ps_events sync_failed 중 stage scout_mirror_write 0건 · sync_storage 0건 · storage_full 0건 · 거울 scout_tool_v1 에 51명(IDB · 서버와 같음)
         (c) 선수단 화면(scout.html 팀 보기)이 51명을 그린다(운동장 카드 + 운동장 밖 + 미배치 알약 · «51명»)
         (d) pageerror 0 */
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop',browsers={};
const KEY='process_coach_v1',ROSTER='scout_tool_v1',MKEY='ps_sync_meta',FILLER='ps_fixture_other_keys_3315';
/* 작은 저장소 한도(실측 2026-11-18, 빈 출처에 ASCII 한 값): 크로미움 10MB(5,238,281자 × 2바이트) · 웹킷 5MB(라틴 글자는 1바이트, 한글이 든 문서는 UTF-16 으로 2바이트).
   그래서 아이패드(웹킷)에는 8MB 수화본이 아예 들어가지 않는다(실측 태블릿 `storage_full ls_quota was:-1`) — 웹킷에선 들어가는 가장 큰 수화본(≈4.4MB)으로 같은 시나리오를 돈다 */
const WEBKIT=engine==='webkit',LIMIT_BYTES=(WEBKIT?5:10)*1024*1024,RECTS=WEBKIT?1150:2150;
const PICTURES=60,HEADROOM_CHARS=30000;   /* 남길 자리 60KB(웹킷 ASCII 채움은 30KB) — 선수단 거울(아래 ≥ 70K자 = 140KB)보다 작다 */
const sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24),segment=s=>JSON.stringify(s).slice(1,-1);
/* sync.js hash() 와 같은 식(확정 hash · 준비표) — 아래에서 창의 hash() 와 한 번 맞춰 본다 */
const djb=s=>{let h=5381,i=s.length;while(i)h=(h*33)^s.charCodeAt(--i);return String(h>>>0)+':'+s.length;};
const svg=i=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50"><!--'+i+'-->'+'<rect width="9" height="9"/>'.repeat(RECTS)+'<circle r="3"/></svg>';
const fx=await startFixture();
/* ① 선수단 51명 — 이름 · 번호 · 자리 · 프로필 메모(거울이 실제 팀처럼 100KB 급이 되도록) */
const POS=['GK','CB','LCB','RCB','LB','RB','DM','CM','AM','LW','RW','CF'];
const players=Array.from({length:51},(_,i)=>({id:'vp'+String(i+1).padStart(2,'0'),name:'가상 선수 '+(i+1),num:String(i+1),grp:i%2?'B팀':'A팀',type:'ours',posId:'pos_'+POS[i%POS.length],levels:{},
  profile:{team:'프로세스FC',dob:'2010-0'+(1+i%9)+'-1'+(i%10),note:'가상 프로필 메모 — 훈련 태도 · 특징 · 장점을 적는 자리 '.repeat(36)},memo:'가상 코치 메모 '+(i+1)}));
{ const row=fx.db.get(WT+'|'+ROSTER),doc=JSON.parse(row.v);doc.players=players;row.v=JSON.stringify(doc);
  for(const k of [...fx.db.keys()])if(k.startsWith(WT+'|sq:'))fx.db.delete(k);
  for(const p of players)fx.db.set(WT+'|sq:'+p.id,{workspace_id:WT,k:'sq:'+p.id,v:JSON.stringify(p),cupd:1000,updated_by:A}); }
assert.ok(fx.db.get(WT+'|'+ROSTER).v.length>=70000,'선수단 문서는 70K자(140KB) 이상 '+fx.db.get(WT+'|'+ROSTER).v.length);
/* ① 일정 — 훈련이 있는 날의 trainData 에 그림 60장(서버엔 참조 · 그림은 ps_blob). 경기 날엔 경기 번호를 미리 — 첫 열기의 번호 매기기(일정 되쓰기)를 피한다 */
const refs=Array.from({length:PICTURES},(_,i)=>{const seg=segment(svg(i)),h=sha(seg);fx.blobs.set(WT+'|'+h,{workspace_id:WT,h,v:seg});return {h,seg};});
{ const row=fx.db.get(WT+'|'+KEY),doc=JSON.parse(row.v),days=Object.values(doc.weeks).flat().filter(d=>d.trainings&&d.trainings.length);
  assert.ok(days.length>=4,'훈련 날 넷 이상');
  for(const [w,ds] of Object.entries(doc.weeks))ds.forEach((d,i)=>{if(d.board&&d.board.sched==='경기')d.mid='fixture-match-'+w+'-'+i;});
  days.forEach((day,di)=>{const mine=refs.filter((_,i)=>i%days.length===di);
    day.board=Object.assign(day.board||{},{sched:'훈련',trains:mine.map((_,j)=>'가상 훈련 '+di+'-'+j),trainThemes:mine.map(()=>''),trainSlot:mine.map(()=>day.trainings[0].slot),
      trainData:mine.map(r=>({minutes:20,thumb:'',thumbRef:r.h,snap:null,focus:''}))});});
  row.v=JSON.stringify(doc); }
assert.equal((fx.db.get(WT+'|'+KEY).v.match(/"thumbRef":"/g)||[]).length,PICTURES,'서버 문서는 참조 60개');
const proof={engine,sizes:{},stages:[],passed:false};
const write=()=>fs.writeFileSync(path.join(OUT,'roster-mirror-after-diet-3315-'+engine+'.json'),JSON.stringify(proof,null,2)+'\n');
const device=(page,key)=>page.evaluate(async key=>({ls:localStorage.getItem(key),idb:(await storage.get(key))?.value??null}),key);
/* storage.js localSummary 와 같은 셈 — (키 + 값 글자 수) × 2 바이트 */
const usage=page=>page.evaluate(()=>{let tot=0,n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);tot+=(k.length+(localStorage.getItem(k)||'').length)*2;n++;}return {bytes:tot,n};});
const events=()=>fx.calls.filter(c=>c.p==='/rest/v1/ps_events'&&Array.isArray(c.body)).flatMap(c=>c.body);
const schedWrites=()=>fx.writes.filter(w=>w.k===KEY&&/^(POST|PATCH)$/.test(w.m)).length;
const ours=raw=>{try{return JSON.parse(raw).players.filter(p=>p&&p.type!=='target').length;}catch(_){return -1;}};
const serverNow=()=>({sched:fx.db.get(WT+'|'+KEY).v,roster:fx.db.get(WT+'|'+ROSTER).v});
let page=null,server='',rosterServer='';
/* 실패 때 상태 덤프 — 두 키의 사본 길이 · 첫 다른 자리 · 준비표 · 동기화 상태 */
const diag=async()=>{try{return await page.evaluate(async ({KEY,ROSTER,server,roster})=>{
  const diff=(a,b)=>{if(a==null||b==null)return null;let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return {at:i,ls:a.slice(Math.max(0,i-60),i+60),server:b.slice(Math.max(0,i-60),i+60)};};
  const ls=localStorage.getItem(KEY),rs=localStorage.getItem(ROSTER),idb=(await storage.get(KEY))?.value??null,ridb=(await storage.get(ROSTER))?.value??null;
  return {sched:{ls:ls&&ls.length,idb:idb&&idb.length,server:server.length,ready:PSSync.keyReady(KEY),diff:diff(ls,server)},roster:{ls:rs&&rs.length,idb:ridb&&ridb.length,server:roster.length,ready:PSSync.rosterReady(PSSync.activeWs()),diff:diff(rs,roster)},
    state:PSSync.state(),pending:PSSync.pending(),meta:(localStorage.getItem('ps_sync_meta')||'').slice(0,400)};},{KEY,ROSTER,server:serverNow().sched,roster:serverNow().roster});}catch(e){return {diagError:String(e)};}};
try{
  const opened=await openApp(fx,size,{browsers});page=opened.page;const {context,logs}=opened;
  /* ② 한 번 받는다 — 첫 열기의 정리(평가 항목 · 경기 번호)가 서버에 올라가 두 사본 = 서버 원문으로 가라앉을 때까지. 3.315 기기 사본은 참조만 */
  let settled=false;
  for(let i=0;i<90&&!settled;i++){
    const now=serverNow(),st=await page.evaluate(async ({KEY,ROSTER,sched,roster})=>({ok:PSSync.state().kind==='ok'&&!PSSync.pending().count&&PSSync.keyReady(KEY),
      sched:localStorage.getItem(KEY)===sched&&(await storage.get(KEY))?.value===sched,roster:localStorage.getItem(ROSTER)===roster&&(await storage.get(ROSTER))?.value===roster}),{KEY,ROSTER,sched:now.sched,roster:now.roster});
    settled=st.ok&&st.sched&&st.roster;if(!settled)await page.waitForTimeout(500);
  }
  assert.ok(settled,'첫 열기가 가라앉는다(두 사본 = 서버) '+JSON.stringify(await diag()).slice(0,1200));
  ({sched:server,roster:rosterServer}=serverNow());
  assert.equal((server.match(/"thumbRef":"/g)||[]).length,PICTURES,'가라앉은 서버 문서도 참조 60개');assert.ok(!server.includes('<rect'));
  assert.equal(ours(rosterServer),51);assert.ok(rosterServer.length>=70000);
  /* 옛 판 기기 사본 모양 — 참조 자리에 그림을 되돌린 것(sync.js schedStrip 이 다시 떼면 서버 원문과 글자 하나까지 같다) */
  let hydrated=server;for(const r of refs)hydrated=hydrated.split('"thumb":"","thumbRef":"'+r.h+'"').join('"thumb":"'+r.seg+'"');
  assert.ok(!hydrated.includes('thumbRef')&&hydrated.length*2>=(WEBKIT?4.2:7.5)*1024*1024,'수화본은 '+(WEBKIT?'4.4MB(웹킷 한도 안의 최대)':'8MB')+' 급 '+hydrated.length*2);
  proof.sizes={serverChars:server.length,hydratedChars:hydrated.length,hydratedKB:Math.round(hydrated.length*2/1024),rosterChars:rosterServer.length};
  const hashCheck=await page.evaluate(s=>typeof hash==='function'?hash(s):null,server.slice(0,5000));
  if(hashCheck!=null)assert.equal(hashCheck,djb(server.slice(0,5000)),'시험의 hash 식은 sync.js hash() 와 같다');
  const writesBefore=schedWrites();
  proof.stages.push({stage:'fresh-pull',usage:await usage(page),schedWrites:writesBefore});
  /* ② 옛 판 기기처럼 심는다 */
  /* 심는 쓰기는 storage.js 가 감싼 setItem 을 지나지 않는다(한도에 닿은 쓰기를 앱의 storage_full 보고로 세지 않게 — 그 보고는 ③ 에서 앱이 내는 것만 본다) */
  const planted=await page.evaluate(async ({KEY,ROSTER,MKEY,FILLER,hydrated,hashed,HEADROOM_CHARS})=>{
    const put=(k,v)=>Storage.prototype.setItem.call(localStorage,k,v);
    put(KEY,hydrated);await storage.set(KEY,hydrated);
    const m=JSON.parse(localStorage.getItem(MKEY));m.h[KEY]=hashed;if(m.r&&m.r[KEY])m.r[KEY].h=hashed;localStorage.setItem(MKEY,JSON.stringify(m));
    /* 나머지 키 몫 — 들어가는 최대치를 찾아 남는 자리를 HEADROOM_CHARS 로 */
    let lo=0,hi=6000000;while(hi-lo>2048){const mid=(lo+hi)>>1;try{put(FILLER,'o'.repeat(mid));lo=mid;}catch(_){hi=mid;}}
    const filler=Math.max(0,lo-HEADROOM_CHARS);put(FILLER,'o'.repeat(filler));
    let tot=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);tot+=(k.length+(localStorage.getItem(k)||'').length)*2;}
    return {maxFiller:lo,filler,bytes:tot,mirror:localStorage.getItem(KEY)===hydrated,idb:(await storage.get(KEY))?.value===hydrated,roster:localStorage.getItem(ROSTER)};
  },{KEY,ROSTER,MKEY,FILLER,hydrated,hashed:djb(hydrated),HEADROOM_CHARS});
  assert.ok(planted.mirror&&planted.idb&&planted.roster===rosterServer,'심은 상태(선수단 거울은 그대로) '+JSON.stringify({...planted,roster:planted.roster&&planted.roster.length}).slice(0,300));
  assert.ok(planted.filler>0&&planted.bytes>LIMIT_BYTES*0.9,'저장소는 한도의 90% 넘게 찼다 '+JSON.stringify(planted));
  assert.ok(HEADROOM_CHARS<rosterServer.length,'남은 자리는 선수단 거울보다 작다');
  proof.stages.push({stage:'planted',...planted});
  /* ③ⓐ 앱을 다시 띄워 회차를 돌린다 — 부팅 회차가 다이어트를 못 끝냈으면 syncNow 로 되풀이 */
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!(window.PSSync&&PSSync.dataUnlocked()&&document.body&&!document.body.classList.contains('ps-booting')),null,{timeout:45000});
  const rounds=[];
  for(let i=0;i<12;i++){
    const dev=await device(page,KEY);
    if(dev.ls===server&&dev.idb===server)break;
    rounds.push(await page.evaluate(()=>PSSync.syncNow('fixture-roster-mirror-after-diet')));await page.waitForTimeout(500);
  }
  await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  const sched=await device(page,KEY),after=await usage(page);
  proof.stages.push({stage:'after-diet',rounds:rounds.length,roundResults:rounds.slice(-3),usage:after,schedWrites:schedWrites()-writesBefore,lsLength:sched.ls&&sched.ls.length});
  write();
  /* ③ⓑ 선수단 거울이 없는 기기 — 회차가 거울을 다시 쓴다(자리는 다이어트가 만들었다). 회차 결과(error 없음)로 본다 — 같은 code 의 ps_events 는 5분 동안 한 줄만 남으니 기록만으로는 못 가린다 */
  await page.evaluate(ROSTER=>localStorage.removeItem(ROSTER),ROSTER);
  const rewrite=[];
  for(let i=0;i<6;i++){
    rewrite.push(await page.evaluate(()=>PSSync.syncNow('fixture-roster-mirror-rewrite')));
    if((await device(page,ROSTER)).ls===rosterServer)break;
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  await page.waitForTimeout(1500);   /* 회차 실패 기록(ps_events)이 떠나는 시간 */
  const roster=await device(page,ROSTER),afterRewrite=await usage(page);
  const state=await page.evaluate(({WT,FILLER})=>({state:PSSync.state(),pending:PSSync.pending().count,scheduleReady:PSSync.keyReady('process_coach_v1'),rosterReady:PSSync.rosterReady(WT),filler:(localStorage.getItem(FILLER)||'').length}),{WT,FILLER});
  const rows=events(),failed=rows.filter(r=>r.event_name==='sync_failed');
  proof.stages.push({stage:'after-rewrite',rounds:rewrite.length,roundResults:rewrite.map(r=>({error:r&&r.error,code:r&&r.code,pushed:r&&r.pushed,applied:r&&r.applied})),usage:afterRewrite,state,events:rows.map(r=>({name:r.event_name,code:r.error_code,stage:r.meta&&r.meta.stage,reason:r.meta&&r.meta.reason}))});
  write();
  /* (a) 거울 = 서버 원문 · 두 사본 같음 · 서버는 그대로 · 총량은 한도의 절반 아래 */
  assert.equal(sched.ls&&sched.ls.length,server.length,'거울 글자 수 = 서버 원문 '+JSON.stringify({ls:sched.ls&&sched.ls.length,server:server.length,rounds:rounds.length}));
  assert.equal(sched.ls,server,'거울은 서버 원문 그대로(참조만)');assert.equal(sched.idb,server,'IDB 사본도 서버 원문');
  assert.ok(!sched.ls.includes('<rect'),'거울에 그림이 없다');
  assert.equal(fx.db.get(WT+'|'+KEY).v,server,'서버 문서는 그대로');assert.equal(schedWrites()-writesBefore,0,'일정을 올리지 않았다(판본 그대로)');
  assert.equal(state.filler,planted.filler,'다른 키 몫은 그대로 — 자리는 다이어트가 만들었다');
  assert.ok(after.bytes<LIMIT_BYTES/2,'작은 저장소 총량은 한도의 절반 아래 '+JSON.stringify(after));
  /* (b) 선수단 거울 쓰기 성공 — 다시 쓰기 회차에 error 없음 · 실패 기록 0 · 거울에 51명 */
  assert.ok(rewrite.length>0&&rewrite.every(r=>r&&!r.error),'거울 다시 쓰기 회차는 실패 없이 끝난다 '+JSON.stringify(rewrite.map(r=>r&&(r.error||'ok'))));
  assert.deepEqual(failed.filter(r=>r.meta&&r.meta.stage==='scout_mirror_write'),[],'scout_mirror_write 실패 0건');
  assert.deepEqual(failed.filter(r=>r.error_code==='sync_storage').map(r=>r.meta),[],'sync_storage 실패 0건');
  assert.deepEqual(rows.filter(r=>r.event_name==='storage_full').map(r=>r.meta),[],'storage_full 0건');
  assert.equal(roster.ls,rosterServer,'선수단 거울 = 서버 원문');assert.equal(roster.idb,rosterServer,'선수단 IDB = 서버 원문');
  assert.equal(ours(roster.ls),51,'거울에 51명');
  assert.equal(state.state.kind,'ok',JSON.stringify(state.state));assert.equal(state.scheduleReady,true);assert.equal(state.rosterReady,true,'선수단 준비표');
  /* (c) 선수단 화면이 51명을 그린다 */
  await page.locator('[data-team-hub="1"]:visible').click();
  await page.locator('[data-team-key="players"][data-tn-grp="squad"]:visible').click();
  const team=await (await page.waitForSelector('#fScout')).contentFrame();
  await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof renderTeam==='function',null,{timeout:45000});
  await team.waitForFunction(()=>document.querySelectorAll('#tbPitch .tb-pill,#tbOff .tb-pill,#tbTray .tb-pill').length>=51,null,{timeout:30000}).catch(()=>{});
  const view=await team.evaluate(()=>{const pills=[...document.querySelectorAll('#tbPitch .tb-pill,#tbOff .tb-pill,#tbTray .tb-pill')];
    return {pitch:document.querySelectorAll('#tbPitch .tb-pill').length,off:document.querySelectorAll('#tbOff .tb-pill').length,tray:document.querySelectorAll('#tbTray .tb-pill').length,
      count:(document.getElementById('teamCount')||{}).textContent||'',names:pills.map(p=>p.textContent.replace(/\s+/g,' ').trim()).slice(0,6),
      memory:typeof data==='object'&&data.players?data.players.filter(p=>p.type!=='target').length:-1};});
  proof.stages.push({stage:'squad-screen',view});write();
  await page.screenshot({path:path.join(SHOTS,'roster-mirror-after-diet-3315-'+engine+'.png')});
  assert.equal(view.memory,51,'화면 메모리의 선수단 51명');
  assert.equal(view.pitch+view.off+view.tray,51,'알약 51개 '+JSON.stringify(view));
  assert.match(view.count,/^51명/,'머리 «51명»: '+view.count);
  /* (d) */
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  proof.passed=true;write();
  console.log('roster-mirror-after-diet-3315 OK',engine,JSON.stringify({rounds:rounds.length,hydratedKB:proof.sizes.hydratedKB,plantedKB:Math.round(planted.bytes/1024),afterKB:Math.round(after.bytes/1024),view}));
  await context.close();
}catch(error){proof.error={name:error.name,message:error.message,stack:error.stack};if(page)proof.diag=await diag();proof.events=events().map(r=>({name:r.event_name,code:r.error_code,meta:r.meta}));write();console.error(error);console.error('DIAG',JSON.stringify(proof.diag).slice(0,3000));process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
