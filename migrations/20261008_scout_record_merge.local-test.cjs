/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261008_scout_record_merge.local-test.cjs
 * 20261008_scout_record_merge(선수단 기록 서버 합치기)를 운영과 같은 순서의 가드 위에서 시험한다:
 *   ps_00c_noop_guard_t → ps_00c_scout_record_guard_t(20261006, 실제 파일) → ps_00d_scout_record_merge_t(이 파일)
 *   그리고 데이터 사고 기록장(20261007_incident_ledger, 실제 파일)에 near_miss 가 남는지.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const sql=read('20261008_scout_record_merge.sql'),verify=read('20261008_scout_record_merge.verify.sql'),rollback=read('20261008_scout_record_merge.rollback.sql');
const guard=read('20261006_scout_record_guard.sql'),ledger=read('20261007_incident_ledger.sql');
const W='00000000-0000-4000-8000-000000000801',W2='00000000-0000-4000-8000-000000000802',U='00000000-0000-4000-8000-000000000031';
let passed=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const FIXTURE=`
create role anon nologin; create role authenticated nologin;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.ps_admins(user_id uuid primary key);
create function public.ps_is_admin() returns boolean language sql stable as $$ select false $$;
create table public.ps_workspaces(id uuid primary key, name text, kind text default 'team', owner_id uuid);
create table public.ps_kv(workspace_id uuid not null, k text not null, v text, cupd bigint, updated_at timestamptz default now(), primary key(workspace_id,k));
create table public.ps_kv_history(id bigserial primary key, workspace_id text not null, k text not null, v text, cupd bigint, operation text not null default 'update', changed_by uuid, changed_at timestamptz not null default now());
create table public.ps_kv_denied(workspace_id uuid, user_id uuid, k text, reason text, at timestamptz default now(), primary key(workspace_id,user_id,k));
create or replace function public.ps_kv_note_denied(p_wid uuid, p_uid uuid, p_k text, p_reason text) returns void language sql as $$
  insert into public.ps_kv_denied(workspace_id,user_id,k,reason) values(p_wid,coalesce(p_uid,'00000000-0000-0000-0000-000000000000'::uuid),p_k,p_reason)
  on conflict(workspace_id,user_id,k) do update set reason=excluded.reason, at=now() $$;
create or replace function public.ps_kv_noop_guard() returns trigger language plpgsql as $$
begin if tg_op='UPDATE' and new.v is not distinct from old.v then new.cupd:=old.cupd; end if; return new; end $$;
create trigger ps_00c_noop_guard_t before update on public.ps_kv for each row execute function public.ps_kv_noop_guard();
`;
const runs=(o)=>o;
const doc=(meta,extra)=>JSON.stringify(Object.assign({attrs:[{id:'a1'}],positions:[{id:'pos_GK'}],players:[{id:'p1',name:'가'},{id:'p2',name:'나'}],
  meta:Object.assign({evalMode:'fifa',tbCards:['pos_GK']},meta)},extra||{}));
async function fresh({withLedger=true}={}){
  const db=new PGlite();await db.exec(FIXTURE);
  await db.query("insert into public.ps_workspaces values($1,'프로세스FC','team',null),($2,'둘째팀','team',null)",[W,W2]);
  await db.exec(guard);
  if(withLedger)await db.exec(ledger);
  await db.exec(sql);
  return db;
}
async function put(db,w,v){await db.query('delete from public.ps_kv where workspace_id=$1 and k=$2',[w,'scout_tool_v1']);await db.query('insert into public.ps_kv(workspace_id,k,v,cupd) values($1,$2,$3,1)',[w,'scout_tool_v1',v]);}
async function save(db,w,v,cupd=2){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[U]);
  await db.query('update public.ps_kv set v=$3, cupd=$4 where workspace_id=$1 and k=$2',[w,'scout_tool_v1',v,cupd]);
  return (await db.query('select v,cupd from public.ps_kv where workspace_id=$1 and k=$2',[w,'scout_tool_v1'])).rows[0];
}
const near=async db=>(await db.query("select workspace_id::text w, detail from public.ps_incidents where kind='near_miss' order by id")).rows;
async function run(){
  let db=await fresh();
  await db.exec(sql);                                               // 재실행 안전
  const v=(await db.query(verify)).rows[0];
  equal([v.merge_trigger,v.secdef,Number(v.pure_fns),v.runs_lost,v.days_lost,v.inj_lost,v.keep_null],['O',true,6,'2','1','1',true],'verify: trigger on, secdef, 6 pure functions, synthetic merge results');
  equal(v.order_00,'ps_00c_noop_guard_t < ps_00c_scout_record_guard_t < ps_00d_scout_record_merge_t','merge runs after the noop and record guards');

  const SERVER={statusRuns:{p1:[{s:'ok',from:'2026-09-01',to:'2026-09-20'},{s:'injury',from:'2026-09-21',to:'2026-10-06',n:'발목'}],
                            p2:[{s:'ok',from:'2026-09-01',to:'2026-10-06'}]},
                participationDays:{'2026-10-05':{p1:{s:'out',kind:'train',at:500},p2:{s:'ok',kind:'train',at:400}},
                                   '2026-10-06':{p1:{s:'rest',kind:'train',at:600}}},
                injuryInfo:{p1:{'2026-09-21':{part:'발목',at:700}}}};

  // 1) 정상 저장(오늘 하루 더함) — 새 판 바이트 그대로, cupd 새 값, 기록장 조용
  await put(db,W,doc(SERVER));
  const normal=JSON.parse(JSON.stringify(SERVER));
  normal.statusRuns.p2[0].to='2026-10-07';
  normal.participationDays['2026-10-07']={p2:{s:'ok',kind:'train',at:800}};
  let r=await save(db,W,doc(normal));
  equal(r.v,doc(normal),'normal save stored byte-for-byte');
  equal(Number(r.cupd),2,'normal save keeps its cupd');
  equal(await near(db),[],'nothing logged for a normal save');

  // 2) 낡은 사본(9/30 까지만 아는 기기)이 오늘 하루를 덧붙여 저장 — 10/1~10/6 이 서버에서 돌아온다
  await put(db,W,doc(SERVER));
  const stale={statusRuns:{p1:[{s:'ok',from:'2026-09-01',to:'2026-09-20'},{s:'injury',from:'2026-09-21',to:'2026-09-30',n:'발목'},{s:'rehab',from:'2026-10-07',to:'2026-10-07'}],
                           p2:[{s:'ok',from:'2026-09-01',to:'2026-09-30'}]},
               participationDays:{'2026-10-05':{p1:{s:'ok',kind:'train',at:100}}},          // 서버 칸(at 500)보다 이르다
               injuryInfo:{}};
  r=await save(db,W,doc(stale,{players:[{id:'p1',name:'가'},{id:'p2',name:'나'},{id:'p3',name:'새 선수'}]}));
  const m=JSON.parse(r.v);
  equal(m.meta.statusRuns.p1,[{s:'ok',from:'2026-09-01',to:'2026-09-20'},{s:'injury',from:'2026-09-21',to:'2026-10-06',n:'발목'},{s:'rehab',from:'2026-10-07',to:'2026-10-07'}],'lost injury days restored, the new day kept, notes kept');
  equal(m.meta.statusRuns.p2,[{s:'ok',from:'2026-09-01',to:'2026-10-06'}],'second player restored and re-compressed');
  equal(m.meta.participationDays['2026-10-05'].p1,{s:'out',kind:'train',at:500},'later server cell wins over the stale cell');
  equal(m.meta.participationDays['2026-10-05'].p2,{s:'ok',kind:'train',at:400},'missing cell restored');
  equal(m.meta.participationDays['2026-10-06'],{p1:{s:'rest',kind:'train',at:600}},'missing day restored');
  equal(m.meta.injuryInfo,{p1:{'2026-09-21':{part:'발목',at:700}}},'injury record restored');
  equal(m.players.length,3,'the rest of the save (new player) is accepted');
  equal(m.meta.tbCards,['pos_GK'],'other meta untouched');
  equal(Number(r.cupd),2,'cupd from the save — the saving device sees it confirmed');
  let n=await near(db);equal(n.length,1,'one near-miss logged');
  equal(n[0].w,W,'logged against the team');
  assert.match(n[0].detail,/상태 기록 12일\(선수 2\) · 출석 칸 3 · 부상 기록 1/);passed++;

  // 3) 새 판이 같은 날을 바꾸면 새 판이 이긴다(과거 날 정정) — 기록장에 둘째 줄을 같은 날 안 쓴다
  await put(db,W,doc(SERVER));
  const corrected=JSON.parse(JSON.stringify(SERVER));
  corrected.statusRuns.p1=[{s:'ok',from:'2026-09-01',to:'2026-09-20'},{s:'injury',from:'2026-09-21',to:'2026-10-02',n:'발목'},{s:'ok',from:'2026-10-03',to:'2026-10-06'}];
  corrected.participationDays['2026-10-05'].p1={s:'ok',kind:'train',at:900,n:'정정'};
  r=await save(db,W,doc(corrected));
  equal(r.v,doc(corrected),'a correction that loses no day is stored as sent');
  // 같은 날 두 번째 합침 — 기록장은 한 줄 그대로
  await put(db,W,doc(SERVER));
  await save(db,W,doc(stale));
  equal((await near(db)).length,1,'near-miss deduplicated per team per day');

  // 4) 칸이 통째로 빠지면 20261006 가드가 거부(서버 판 그대로) — 합치기는 끼어들지 않는다
  await put(db,W,doc(SERVER));
  const noRuns=JSON.parse(JSON.stringify(SERVER));delete noRuns.statusRuns;
  r=await save(db,W,doc(noRuns));
  equal(JSON.parse(r.v).meta.statusRuns,SERVER.statusRuns,'absent field still rejected by the record guard');
  equal(Number(r.cupd),1,'rejected save keeps the server cupd');

  // 5) 깨진 날짜(2026-02-30)가 있어도 저장은 막히지 않는다(열린 실패)
  await put(db,W,doc({statusRuns:{p1:[{s:'ok',from:'2026-02-30',to:'2026-03-01'}]}}));
  const broken=doc({statusRuns:{p1:[]},extra:1});
  r=await save(db,W,broken);
  equal(r.v,broken,'merge errors fail open — the save goes through as sent');

  // 6) 큰 팀(60명 × 300일) 합치기도 빠르다
  const big={statusRuns:{}};for(let i=0;i<60;i++)big.statusRuns['p'+i]=[{s:'ok',from:'2025-12-01',to:'2026-09-26'}];
  const bigStale={statusRuns:{}};for(let i=0;i<60;i++)bigStale.statusRuns['p'+i]=[{s:'ok',from:'2025-12-01',to:'2026-01-01'}];
  await put(db,W2,doc(big));
  const t0=Date.now();r=await save(db,W2,doc(bigStale));const ms=Date.now()-t0;
  equal(JSON.parse(r.v).meta.statusRuns.p59,[{s:'ok',from:'2025-12-01',to:'2026-09-26'}],'big merge restores every player');
  assert.ok(ms<5000,'big merge took '+ms+'ms');passed++;

  // 7) 기록장이 없는 DB 에서도 합치기는 된다
  const db2=await fresh({withLedger:false});
  await put(db2,W,doc(SERVER));
  r=await save(db2,W,doc(stale));
  equal(JSON.parse(r.v).meta.statusRuns.p2,[{s:'ok',from:'2026-09-01',to:'2026-10-06'}],'merge works without the ledger table');

  // 8) 다른 키는 건드리지 않는다
  await db.query("insert into public.ps_kv(workspace_id,k,v,cupd) values($1,'cs_squad_v1','{\"meta\":{\"statusRuns\":{\"p1\":[{\"s\":\"ok\",\"from\":\"2026-10-01\",\"to\":\"2026-10-05\"}]}}}',1)",[W]);
  await db.query("update public.ps_kv set v='{\"meta\":{\"statusRuns\":{}}}', cupd=2 where workspace_id=$1 and k='cs_squad_v1'",[W]);
  equal((await db.query("select v from public.ps_kv where workspace_id=$1 and k='cs_squad_v1'",[W])).rows[0].v,'{"meta":{"statusRuns":{}}}','other keys pass untouched');

  await db.exec(rollback);
  equal((await db.query("select count(*) n from pg_trigger where tgname='ps_00d_scout_record_merge_t'")).rows[0].n,0,'rollback removes the trigger');
  equal((await db.query("select count(*) n from pg_proc where proname like 'ps_srm_%'")).rows[0].n,0,'rollback removes the functions');
  await put(db,W,doc(SERVER));r=await save(db,W,doc(stale));
  equal(JSON.parse(r.v).meta.statusRuns.p2,[{s:'ok',from:'2026-09-01',to:'2026-09-30'}],'after rollback a stale save overwrites again (old behaviour)');
  console.log('20261008_scout_record_merge local test: '+passed+' checks passed ('+ms+'ms big merge)');
}
run().catch(e=>{console.error(e);process.exit(1);});
