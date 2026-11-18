import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS,WT,A} from '../fixtures/team-app.mjs';

/* 3.327(처음 3.321) — 같은 회차 안의 쓰기 차례: 일정 다이어트 쓰기(옛 8MB 사본 → 참조만 남긴 서버 원문, 3.315)가 작은 저장소에 내려앉은 **뒤에** 선수단 거울(scout_tool_v1)을 쓴다.
   PR #888(roster-mirror-after-diet-3315)의 첫 판이 CI 크롬 storage(run 44249806681)에서 잡은 것: 작은 저장소가 가득 차고 선수단 거울이 없는 기기로 부팅하면
   부팅 회차 안에서 두 쓰기가 각각 비동기 사슬(IDB 읽기 → 비교 저장 → 거울 쓰기)이라 차례가 없었다 — 8MB 를 읽고 견주는 일정 쪽이 느린 실행기에서 늦고,
   선수단 거울(140KB)이 먼저 60KB 남은 자리에 쓰이다 `sync_failed sync_storage scout_mirror_write`(reason boot) + `storage_full` 한 번 → 다음 회차에 성공(자기 치유).
   고침: sync.js kvWrite 의 거울 쓰기 길(IDB 비교 저장 앞)이 같은 회차의 일정 다이어트 쓰기(`scheduleDietWrite`)를 기다린다.
   여기서는 그 경합을 탐침으로 **결정적으로** 만든다: 맨 위 창의 `storage.get('process_coach_v1')` 만 DELAY ms 늦춰(느린 기계의 8MB 읽기) 선수단 사슬이 늘 먼저 끝나게 한다 —
   고치기 전 코드는 부팅 회차에 `scout_mirror_write` 실패 한 건을 남기고(거울 쓰기 차례: 선수단 → 일정), 고친 코드는 0건(차례: 일정 → 선수단).
   시나리오(합성 팀 fixture 만 · 실계정 · 운영 DB 없음) — roster-mirror-after-diet-3315 와 같은 심기:
   ① 서버: 일정에 512자 넘는 훈련 그림 60장(참조 · 그림은 ps_blob) + 선수단 51명 ② 한 번 열어 가라앉힌 뒤 옛 판 기기처럼 심는다: 그림을 되돌린 수화본(크롬 ≈8MB · 웹킷 ≈4.4MB)을
   두 사본에 · 확정 hash 도 수화본 · 채움 키로 남는 자리를 선수단 거울보다 작게 · **선수단 거울은 지운다**(IDB 는 그대로 — 한 번도 못 쓴 아이패드 · 맥 5eddb429 의 13:53 전)
   ③ 새로고침 — 부팅 회차 하나가 다이어트와 선수단 거울 쓰기를 같이 한다(둘 다 서버 원문이 될 때까지 기다리고, 안 되면 syncNow 로 되풀이 — 차례는 쓰기 기록으로 본다)
   단언: (a) 거울 쓰기 기록(Storage.prototype.setItem 탐침)에서 일정 다이어트 쓰기(서버 원문 길이)가 선수단 거울 첫 쓰기보다 앞 · 일정 거울 = 서버 원문 · 올리지 않음
         (b) ps_events sync_failed 중 stage scout_mirror_write 0건 · sync_storage 0건 · storage_full 0건 · 되풀이 회차에 error 없음 · 거울 scout_tool_v1 = 서버 원문(51명)
         (c) 선수단 화면(scout.html 팀 보기)이 51명을 그린다 (d) pageerror 0 */
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop',browsers={};
const KEY='process_coach_v1',ROSTER='scout_tool_v1',MKEY='ps_sync_meta',FILLER='ps_fixture_other_keys_3321';
/* 작은 저장소 한도(실측 2026-11-18): 크로미움 10MB(5,238,281자 × 2바이트) · 웹킷 5MB(라틴 글자 1바이트 · 한글 문서는 UTF-16 2바이트) — roster-mirror-after-diet-3315 와 같다 */
const WEBKIT=engine==='webkit',LIMIT_BYTES=(WEBKIT?5:10)*1024*1024,RECTS=WEBKIT?1150:2150;
const PICTURES=60,HEADROOM_CHARS=30000;   /* 남길 자리 60KB(웹킷 ASCII 채움은 30KB) — 선수단 거울(≥ 70K자 = 140KB)보다 작다 */
const DELAY=Number(process.env.PS_SCHED_READ_DELAY_MS||700);   /* 맨 위 창의 storage.get(process_coach_v1) 만 늦춘다 — 느린 기계의 8MB 읽기 */
const sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24),segment=s=>JSON.stringify(s).slice(1,-1);
const djb=s=>{let h=5381,i=s.length;while(i)h=(h*33)^s.charCodeAt(--i);return String(h>>>0)+':'+s.length;};
const svg=i=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50"><!--'+i+'-->'+'<rect width="9" height="9"/>'.repeat(RECTS)+'<circle r="3"/></svg>';
const fx=await startFixture();
/* ① 선수단 51명 — 거울이 실제 팀처럼 100KB 급이 되도록 프로필 메모를 넣는다 */
const POS=['GK','CB','LCB','RCB','LB','RB','DM','CM','AM','LW','RW','CF'];
const players=Array.from({length:51},(_,i)=>({id:'vp'+String(i+1).padStart(2,'0'),name:'가상 선수 '+(i+1),num:String(i+1),grp:i%2?'B팀':'A팀',type:'ours',posId:'pos_'+POS[i%POS.length],levels:{},
  profile:{team:'프로세스FC',dob:'2010-0'+(1+i%9)+'-1'+(i%10),note:'가상 프로필 메모 — 훈련 태도 · 특징 · 장점을 적는 자리 '.repeat(36)},memo:'가상 코치 메모 '+(i+1)}));
{ const row=fx.db.get(WT+'|'+ROSTER),doc=JSON.parse(row.v);doc.players=players;row.v=JSON.stringify(doc);
  for(const k of [...fx.db.keys()])if(k.startsWith(WT+'|sq:'))fx.db.delete(k);
  for(const p of players)fx.db.set(WT+'|sq:'+p.id,{workspace_id:WT,k:'sq:'+p.id,v:JSON.stringify(p),cupd:1000,updated_by:A}); }
assert.ok(fx.db.get(WT+'|'+ROSTER).v.length>=70000,'선수단 문서는 70K자(140KB) 이상 '+fx.db.get(WT+'|'+ROSTER).v.length);
/* ① 일정 — 훈련 날의 trainData 에 그림 60장(서버엔 참조 · 그림은 ps_blob). 경기 날엔 경기 번호를 미리(첫 열기의 일정 되쓰기를 피한다) */
const refs=Array.from({length:PICTURES},(_,i)=>{const seg=segment(svg(i)),h=sha(seg);fx.blobs.set(WT+'|'+h,{workspace_id:WT,h,v:seg});return {h,seg};});
{ const row=fx.db.get(WT+'|'+KEY),doc=JSON.parse(row.v),days=Object.values(doc.weeks).flat().filter(d=>d.trainings&&d.trainings.length);
  assert.ok(days.length>=4,'훈련 날 넷 이상');
  for(const [w,ds] of Object.entries(doc.weeks))ds.forEach((d,i)=>{if(d.board&&d.board.sched==='경기')d.mid='fixture-match-'+w+'-'+i;});
  days.forEach((day,di)=>{const mine=refs.filter((_,i)=>i%days.length===di);
    day.board=Object.assign(day.board||{},{sched:'훈련',trains:mine.map((_,j)=>'가상 훈련 '+di+'-'+j),trainThemes:mine.map(()=>''),trainSlot:mine.map(()=>day.trainings[0].slot),
      trainData:mine.map(r=>({minutes:20,thumb:'',thumbRef:r.h,snap:null,focus:''}))});});
  row.v=JSON.stringify(doc); }
assert.equal((fx.db.get(WT+'|'+KEY).v.match(/"thumbRef":"/g)||[]).length,PICTURES,'서버 문서는 참조 60개');
const proof={engine,delayMs:DELAY,sizes:{},stages:[],passed:false};
const write=()=>fs.writeFileSync(path.join(OUT,'roster-mirror-write-order-'+engine+'.json'),JSON.stringify(proof,null,2)+'\n');
const device=(page,key)=>page.evaluate(async key=>({ls:localStorage.getItem(key),idb:(await storage.get(key))?.value??null}),key);
const usage=page=>page.evaluate(()=>{let tot=0,n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);tot+=(k.length+(localStorage.getItem(k)||'').length)*2;n++;}return {bytes:tot,n};});
const events=()=>fx.calls.filter(c=>c.p==='/rest/v1/ps_events'&&Array.isArray(c.body)).flatMap(c=>c.body);
const schedWrites=()=>fx.writes.filter(w=>w.k===KEY&&/^(POST|PATCH)$/.test(w.m)).length;
const ours=raw=>{try{return JSON.parse(raw).players.filter(p=>p&&p.type!=='target').length;}catch(_){return -1;}};
const serverNow=()=>({sched:fx.db.get(WT+'|'+KEY).v,roster:fx.db.get(WT+'|'+ROSTER).v});
/* 탐침(맨 위 창만 — sync.js 는 app.html 에서 돈다): ① 두 키의 실제 거울 쓰기 차례를 적는다(storage.js 의 setItem 감싸개 · scheduleMirrorTry 의 native 폴백 모두 Storage.prototype 을 지난다)
   ② window.storage 가 대입되는 순간 get 을 감싸 일정 키만 DELAY ms 늦춘다(replaceIfValue · 선수단 읽기는 그대로 — 일정 사슬만 늦는 느린 기계) */
const probe={fn:({KEY,ROSTER,DELAY})=>{
  if(window.top!==window)return;
  const log=window.__psWriteLog=[],o=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===KEY||k===ROSTER)log.push({k,len:String(v).length,t:Math.round(performance.now())});return o.apply(this,arguments);};
  let cur;Object.defineProperty(window,'storage',{configurable:true,get(){return cur;},set(v){cur=v;
    if(v&&typeof v.get==='function'&&!v.__psSlow){const g=v.get;v.__psSlow=1;v.get=function(k){const p=g.apply(this,arguments);return k===KEY?p.then(r=>new Promise(res=>setTimeout(()=>res(r),DELAY))):p;};}}});
},arg:{KEY,ROSTER,DELAY}};
let page=null,server='',rosterServer='';
const diag=async()=>{try{return await page.evaluate(async ({KEY,ROSTER,server,roster})=>{
  const diff=(a,b)=>{if(a==null||b==null)return null;let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return {at:i,ls:a.slice(Math.max(0,i-60),i+60),server:b.slice(Math.max(0,i-60),i+60)};};
  const ls=localStorage.getItem(KEY),rs=localStorage.getItem(ROSTER),idb=(await storage.get(KEY))?.value??null,ridb=(await storage.get(ROSTER))?.value??null;
  return {sched:{ls:ls&&ls.length,idb:idb&&idb.length,server:server.length,ready:PSSync.keyReady(KEY),diff:diff(ls,server)},roster:{ls:rs&&rs.length,idb:ridb&&ridb.length,server:roster.length,ready:PSSync.rosterReady(PSSync.activeWs()),diff:diff(rs,roster)},
    writeLog:window.__psWriteLog,slow:storage&&storage.__psSlow,state:PSSync.state(),pending:PSSync.pending(),meta:(localStorage.getItem('ps_sync_meta')||'').slice(0,400)};},{KEY,ROSTER,server:serverNow().sched,roster:serverNow().roster});}catch(e){return {diagError:String(e)};}};
try{
  const opened=await openApp(fx,size,{browsers,init:probe});page=opened.page;const {context,logs}=opened;
  /* ② 한 번 받는다 — 첫 열기의 정리가 서버에 올라가 두 사본 = 서버 원문으로 가라앉을 때까지 */
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
  let hydrated=server;for(const r of refs)hydrated=hydrated.split('"thumb":"","thumbRef":"'+r.h+'"').join('"thumb":"'+r.seg+'"');
  assert.ok(!hydrated.includes('thumbRef')&&hydrated.length*2>=(WEBKIT?4.2:7.5)*1024*1024,'수화본은 '+(WEBKIT?'4.4MB':'8MB')+' 급 '+hydrated.length*2);
  proof.sizes={serverChars:server.length,hydratedChars:hydrated.length,hydratedKB:Math.round(hydrated.length*2/1024),rosterChars:rosterServer.length};
  const hashCheck=await page.evaluate(s=>typeof hash==='function'?hash(s):null,server.slice(0,5000));
  if(hashCheck!=null)assert.equal(hashCheck,djb(server.slice(0,5000)),'시험의 hash 식은 sync.js hash() 와 같다');
  const writesBefore=schedWrites();
  proof.stages.push({stage:'fresh-pull',usage:await usage(page),schedWrites:writesBefore});
  /* ② 옛 판 기기처럼 심는다 — 심는 쓰기는 storage.js 의 setItem 감싸개(storage_full 보고)를 지나지 않는다 · 선수단 거울은 지운다(IDB 그대로) */
  const planted=await page.evaluate(async ({KEY,ROSTER,MKEY,FILLER,hydrated,hashed,HEADROOM_CHARS})=>{
    const put=(k,v)=>Storage.prototype.setItem.call(localStorage,k,v);
    put(KEY,hydrated);await storage.set(KEY,hydrated);
    const m=JSON.parse(localStorage.getItem(MKEY));m.h[KEY]=hashed;if(m.r&&m.r[KEY])m.r[KEY].h=hashed;localStorage.setItem(MKEY,JSON.stringify(m));
    localStorage.removeItem(ROSTER);
    let lo=0,hi=6000000;while(hi-lo>2048){const mid=(lo+hi)>>1;try{put(FILLER,'o'.repeat(mid));lo=mid;}catch(_){hi=mid;}}
    const filler=Math.max(0,lo-HEADROOM_CHARS);put(FILLER,'o'.repeat(filler));
    let tot=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);tot+=(k.length+(localStorage.getItem(k)||'').length)*2;}
    return {maxFiller:lo,filler,bytes:tot,mirror:localStorage.getItem(KEY)===hydrated,idb:(await storage.get(KEY))?.value===hydrated,roster:localStorage.getItem(ROSTER),rosterIdb:((await storage.get(ROSTER))?.value??null)!==null,slow:storage.__psSlow};
  },{KEY,ROSTER,MKEY,FILLER,hydrated,hashed:djb(hydrated),HEADROOM_CHARS});
  assert.ok(planted.mirror&&planted.idb&&planted.roster===null&&planted.rosterIdb,'심은 상태(선수단 거울 없음 · IDB 있음) '+JSON.stringify(planted).slice(0,300));
  assert.equal(planted.slow,1,'탐침이 window.storage.get 을 감쌌다');
  assert.ok(planted.filler>0&&planted.bytes>LIMIT_BYTES*0.9,'저장소는 한도의 90% 넘게 찼다 '+JSON.stringify(planted));
  assert.ok(HEADROOM_CHARS<rosterServer.length,'남은 자리는 선수단 거울보다 작다');
  proof.stages.push({stage:'planted',...planted});
  /* ③ 새로고침 — 부팅 회차가 다이어트 + 선수단 거울 쓰기를 같이 한다. 둘 다 서버 원문이 될 때까지 기다리고, 안 되면 syncNow 로 되풀이(회차 결과를 적는다) */
  /* 심는 동안에도 옛 앱(아직 떠 있는 창)은 돈다 — 가득 찬 저장소에서 선수단 화면이 ps_sync_meta 바뀜(storage 이벤트)에 기기 보관 사본(ps_roster_keep_v2:)을 다시 쓰다
     storage_full 한 줄을 남긴다(PR #894 CI 크롬 storage · 심기의 차례에 따라 가끔). 시험의 대상은 새로고침 뒤의 앱이라 실패 기록은 그 뒤에 만든 것(created_at)만 본다 */
  const reloadAt=await page.evaluate(()=>Date.now());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!(window.PSSync&&PSSync.dataUnlocked()&&document.body&&!document.body.classList.contains('ps-booting')),null,{timeout:45000});
  /* 선수단은 늘 «그 순간의 서버 원문»과 견준다 — 느린 기계에선 앱의 배경 작업(평가 항목 채움 · _items.n)이 가라앉은 뒤에도 선수단 문서를 한 번 더 올린다(PR #888 CI 둘째 판, d1e37f63) */
  const both=async()=>{const s=await device(page,KEY),r=await device(page,ROSTER),rs=serverNow().roster;return s.ls===server&&s.idb===server&&r.ls===rs&&r.idb===rs;};
  await page.waitForFunction(()=>PSSync.state().kind!=='busy',null,{timeout:30000}).catch(()=>{});
  let bootDone=false;for(let i=0;i<40&&!bootDone;i++){bootDone=await both();if(!bootDone)await page.waitForTimeout(500);}
  const rounds=[];
  for(let i=0;i<8&&!(await both());i++){rounds.push(await page.evaluate(()=>PSSync.syncNow('fixture-roster-mirror-write-order')));await page.waitForTimeout(500);}
  await page.waitForFunction(()=>PSSync.state().kind==='ok'&&!PSSync.pending().count,null,{timeout:30000}).catch(()=>{});
  await page.waitForTimeout(1500);   /* 회차 실패 기록(ps_events)이 떠나는 시간 */
  const sched=await device(page,KEY),roster=await device(page,ROSTER),after=await usage(page);
  const state=await page.evaluate(({WT,FILLER})=>({state:PSSync.state(),pending:PSSync.pending().count,scheduleReady:PSSync.keyReady('process_coach_v1'),rosterReady:PSSync.rosterReady(WT),filler:(localStorage.getItem(FILLER)||'').length,writeLog:window.__psWriteLog,slow:storage.__psSlow}),{WT,FILLER});
  const allRows=events(),rows=allRows.filter(r=>!r.created_at||Date.parse(r.created_at)>=reloadAt),failed=rows.filter(r=>r.event_name==='sync_failed');   /* 새로고침 뒤 기록만(위) */
  proof.preReload=allRows.filter(r=>rows.indexOf(r)<0).map(r=>({name:r.event_name,code:r.error_code,stage:r.meta&&r.meta.stage}));   /* 뺀 기록도 증거 파일에 남긴다 */
  const log=state.writeLog||[],dietAt=log.findIndex(e=>e.k===KEY&&e.len===server.length),rosterAt=log.findIndex(e=>e.k===ROSTER);
  proof.stages.push({stage:'after-boot',bootDone,manualRounds:rounds.length,roundResults:rounds.map(r=>({error:r&&r.error,code:r&&r.code,pushed:r&&r.pushed,applied:r&&r.applied})),usage:after,
    state:{...state,writeLog:undefined},writeLog:log,order:{dietAt,rosterAt},schedWrites:schedWrites()-writesBefore,events:rows.map(r=>({name:r.event_name,code:r.error_code,stage:r.meta&&r.meta.stage,reason:r.meta&&r.meta.reason}))});
  write();
  /* (a) 차례: 일정 다이어트 쓰기(서버 원문 길이)가 선수단 거울 첫 쓰기보다 앞 · 일정 거울 = 서버 원문 · 올리지 않음 */
  assert.equal(state.slow,1,'탐침은 새로고침 뒤에도 감싸져 있다');
  assert.ok(dietAt>=0,'일정 다이어트 거울 쓰기가 기록에 있다 '+JSON.stringify(log).slice(0,600));
  assert.ok(rosterAt>=0,'선수단 거울 쓰기가 기록에 있다 '+JSON.stringify(log).slice(0,600));
  assert.ok(dietAt<rosterAt,'일정 다이어트 쓰기가 선수단 거울 쓰기보다 먼저다 '+JSON.stringify({dietAt,rosterAt,log:log.slice(0,8)}));
  assert.equal(sched.ls,server,'일정 거울은 서버 원문 그대로(참조만)');assert.equal(sched.idb,server,'IDB 사본도 서버 원문');
  assert.equal(fx.db.get(WT+'|'+KEY).v,server,'서버 문서는 그대로');assert.equal(schedWrites()-writesBefore,0,'일정을 올리지 않았다(판본 그대로)');
  assert.equal(state.filler,planted.filler,'다른 키 몫은 그대로 — 자리는 다이어트가 만들었다');
  assert.ok(after.bytes<LIMIT_BYTES/2,'작은 저장소 총량은 한도의 절반 아래 '+JSON.stringify(after));
  /* (b) 선수단 거울 쓰기 실패 0 · 되풀이 회차 error 없음 · 거울 51명 */
  assert.deepEqual(failed.filter(r=>r.meta&&r.meta.stage==='scout_mirror_write').map(r=>({code:r.error_code,reason:r.meta.reason})),[],'scout_mirror_write 실패 0건');
  assert.deepEqual(failed.filter(r=>r.error_code==='sync_storage').map(r=>r.meta),[],'sync_storage 실패 0건');
  assert.deepEqual(rows.filter(r=>r.event_name==='storage_full').map(r=>r.meta),[],'storage_full 0건');
  assert.ok(rounds.every(r=>r&&!r.error),'되풀이 회차에 실패 없음 '+JSON.stringify(rounds.map(r=>r&&(r.error||'ok'))));
  const rosterSrv=serverNow().roster;   /* 그 순간의 서버 원문(위 both 와 같은 까닭) */
  assert.equal(roster.ls,rosterSrv,'선수단 거울 = 서버 원문');assert.equal(roster.idb,rosterSrv,'선수단 IDB = 서버 원문');
  assert.equal(ours(roster.ls),51,'거울에 51명');assert.equal(ours(rosterSrv),51,'서버에 51명');
  assert.equal(state.state.kind,'ok',JSON.stringify(state.state));assert.equal(state.scheduleReady,true);assert.equal(state.rosterReady,true,'선수단 준비표');
  /* (c) 선수단 화면이 51명을 그린다 */
  await page.locator('[data-team-hub="1"]:visible').click();
  await page.locator('[data-team-key="players"][data-tn-grp="squad"]:visible').click();
  const team=await (await page.waitForSelector('#fScout')).contentFrame();
  await team.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof renderTeam==='function',null,{timeout:45000});
  await team.waitForFunction(()=>document.querySelectorAll('#tbPitch .tb-pill,#tbOff .tb-pill,#tbTray .tb-pill').length>=51,null,{timeout:30000}).catch(()=>{});
  const view=await team.evaluate(()=>{const pills=[...document.querySelectorAll('#tbPitch .tb-pill,#tbOff .tb-pill,#tbTray .tb-pill')];
    return {pitch:document.querySelectorAll('#tbPitch .tb-pill').length,off:document.querySelectorAll('#tbOff .tb-pill').length,tray:document.querySelectorAll('#tbTray .tb-pill').length,
      count:(document.getElementById('teamCount')||{}).textContent||'',memory:typeof data==='object'&&data.players?data.players.filter(p=>p.type!=='target').length:-1};});
  proof.stages.push({stage:'squad-screen',view});write();
  await page.screenshot({path:path.join(SHOTS,'roster-mirror-write-order-'+engine+'.png')});
  assert.equal(view.memory,51,'화면 메모리의 선수단 51명');
  assert.equal(view.pitch+view.off+view.tray,51,'알약 51개 '+JSON.stringify(view));
  assert.match(view.count,/^51명/,'머리 «51명»: '+view.count);
  /* (d) */
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  proof.passed=true;write();
  console.log('roster-mirror-write-order OK',engine,JSON.stringify({bootDone,manualRounds:rounds.length,order:{dietAt,rosterAt},writes:log.length,hydratedKB:proof.sizes.hydratedKB,afterKB:Math.round(after.bytes/1024),view}));
  await context.close();
}catch(error){proof.error={name:error.name,message:error.message,stack:error.stack};if(page)proof.diag=await diag();proof.events=events().map(r=>({name:r.event_name,code:r.error_code,meta:r.meta}));write();console.error(error);console.error('DIAG',JSON.stringify(proof.diag).slice(0,3000));process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
