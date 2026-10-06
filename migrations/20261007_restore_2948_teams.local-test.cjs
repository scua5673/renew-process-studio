/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261007_restore_2948_teams.local-test.cjs
 * 20261007 복구(2.948 피해 팀 가용인원 기록)를 합성 자료로 시험한다 — 미리보기는 아무것도 안 바꾸고,
 * 실행판은 지운 날 이전 기록을 되살리되 지금 적은 것·지금 있는 칸을 덮지 않으며, 백업을 남기고, 다시 돌려도 같다.
 * 운영 선수단 기록 가드(20261006)를 같이 걸어 복구 저장이 가드를 지나는지도 본다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const dry=read('20261007_restore_2948_teams.dryrun.sql'),apply=read('20261007_restore_2948_teams.sql'),guard=read('20261006_scout_record_guard.sql');
let passed=0;const equal=(a,b,l)=>{assert.deepEqual(a,b,l);passed++;};
const A='00000000-0000-4000-8000-00000000a001',B='00000000-0000-4000-8000-00000000b001',C='00000000-0000-4000-8000-00000000c001';
const FIX=`
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create role anon; create role authenticated;
create table public.ps_workspaces(id uuid primary key, name text);
create table public.ps_kv(workspace_id uuid not null, k text not null, v text, cupd bigint, updated_at timestamptz default now(), primary key(workspace_id,k));
create table public.ps_kv_history(id bigint primary key, workspace_id text not null, k text not null, v text, cupd bigint, operation text not null default 'update', changed_by uuid, changed_at timestamptz not null default now());
create table public.ps_kv_history_hold_2948 (like public.ps_kv_history including defaults);
alter table public.ps_kv_history_hold_2948 add column held_at timestamptz not null default now();
create table public.ps_kv_denied(workspace_id uuid, user_id uuid, k text, reason text, at timestamptz default now(), primary key(workspace_id,user_id,k));
create or replace function public.ps_kv_note_denied(p_wid uuid, p_uid uuid, p_k text, p_reason text) returns void language sql as $$
  insert into public.ps_kv_denied(workspace_id,user_id,k,reason) values(p_wid,coalesce(p_uid,'00000000-0000-0000-0000-000000000000'::uuid),p_k,p_reason)
  on conflict(workspace_id,user_id,k) do update set reason=excluded.reason, at=now() $$;`;
const R=(s,f,t)=>({s,from:f,to:t});
const base=(meta,players)=>({attrs:[{id:'a1'}],positions:[{id:'pos_GK'}],players:(players||['p1','p2']).map(id=>({id})),meta});
const h1=base({seeded:1,emblem:'E1',grpBase:['A','B'],formPos:{x:1},statusRuns:{p1:[R('injury','2026-08-01','2026-08-10'),R('ok','2026-08-11','2026-08-20')]},
  participationDays:{'2026-08-05':{p1:{s:'rest',kind:'train',at:100}}},injuryInfo:{p1:{'2026-08-01':{part:'ankle'}}}});
const h2=base({emblem:'E1',grpBase:['A','B'],formPos:{x:1},statusRuns:{p1:[R('injury','2026-08-01','2026-08-10'),R('ok','2026-08-11','2026-09-06')],p2:[R('ok','2026-09-01','2026-09-06')]},
  participationDays:{'2026-08-05':{p1:{s:'rest',kind:'train',at:100}},'2026-09-03':{p2:{s:'out',kind:'train',at:200}}},injuryInfo:{p1:{'2026-08-01':{part:'ankle'}}}});
const h3=base({evalStdForcedAt:1,tbCards:['pos_GK']});                 // 빈 뼈대로 지워진 판
const h4=base({evalStdForcedAt:1,tbCards:['pos_GK'],statusRuns:{p1:[R('ok','2026-09-07','2026-09-15')]}});   // 보관 뒤에 생긴 판(보관 표에 없음)
const curA=base({evalStdForcedAt:1,tbCards:['pos_GK'],grpBase:['1군'],
  statusRuns:{p1:[R('ok','2026-09-07','2026-09-09'),R('rest','2026-09-10','2026-09-10'),R('ok','2026-09-11','2026-10-06')],p2:[R('rest','2026-09-07','2026-10-06')]},
  participationDays:{'2026-09-03':{p2:{s:'ok',kind:'train',at:300}}}},['p1','p2','p3']);
const curC=base({emblem:'EC',statusRuns:{p9:[R('ok','2026-09-01','2026-10-06')]}},['p9']);
const hC=base({emblem:'EC',statusRuns:{p9:[R('ok','2026-09-01','2026-09-20')]}},['p9']);
async function setup(){
  const db=new PGlite();await db.exec(FIX);await db.exec(guard);
  await db.query("insert into public.ps_workspaces values($1,'가 팀'),($2,'나 팀'),($3,'다 팀')",[A,B,C]);
  const hist=[[1,A,h1,'2026-08-20'],[2,A,h2,'2026-09-07 05:00'],[3,A,h3,'2026-09-08'],[4,A,h4,'2026-09-15'],[5,C,hC,'2026-09-20']];
  for(const [id,ws,doc,at] of hist)await db.query("insert into public.ps_kv_history(id,workspace_id,k,v,changed_at) values($1,$2,'scout_tool_v1',$3,$4::timestamptz)",[id,ws,JSON.stringify(doc),at]);
  await db.query("insert into public.ps_kv_history_hold_2948(id,workspace_id,k,v,cupd,operation,changed_by,changed_at) select id,workspace_id,k,v,cupd,operation,changed_by,changed_at from public.ps_kv_history where id in (1,2,3,5)");
  for(const [ws,doc] of [[A,curA],[B,base({statusRuns:{}})],[C,curC]])
    await db.query("insert into public.ps_kv(workspace_id,k,v,cupd) values($1,'scout_tool_v1',$2,1)",[ws,JSON.stringify(doc)]);
  return db;
}
const doc=async(db,ws)=>{const r=(await db.query("select v,cupd from public.ps_kv where workspace_id=$1 and k='scout_tool_v1'",[ws])).rows[0];return {j:JSON.parse(r.v),cupd:Number(r.cupd),raw:r.v};};
const last=rs=>rs[rs.length-1].rows;
async function run(){
  let db=await setup();
  const before={A:(await doc(db,A)).raw,B:(await doc(db,B)).raw,C:(await doc(db,C)).raw};
  // 1) 미리보기 — 아무것도 바뀌지 않고 팀마다 한 줄
  const rep=last(await db.exec(dry));
  equal((await doc(db,A)).raw,before.A,'dry run leaves A untouched');
  equal((await db.query("select to_regclass('public.ps_kv_restore_backup_2948') t")).rows[0].t,null,'dry run creates no backup table');
  equal(rep.map(r=>r.team),['가 팀','다 팀'],'only held teams are planned');
  const ra=rep.find(r=>r.team==='가 팀');
  equal([ra.run_players,ra.record_days,ra.injury_players,ra.restored_keys,ra.changes,ra.players_same],['2>2','1>2','0>1','emblem,formPos',true,true],'A preview numbers');
  equal(rep.find(r=>r.team==='다 팀').changes,false,'C already complete — no change');
  // 2) 실행
  const out=last(await db.exec(apply));
  const A1=await doc(db,A);
  equal(out.find(r=>r.team==='가 팀').written,true,'A written');
  equal(out.find(r=>r.team==='다 팀').written,false,'C not written');
  equal(A1.j.meta.statusRuns.p1,[R('injury','2026-08-01','2026-08-10'),R('ok','2026-08-11','2026-09-09'),R('rest','2026-09-10','2026-09-10'),R('ok','2026-09-11','2026-10-06')],
    'p1: August history back, contiguous ok joined across the wipe, today\'s correction (09-10 rest) kept over an older version');
  equal(A1.j.meta.statusRuns.p2,[R('ok','2026-09-01','2026-09-06'),R('rest','2026-09-07','2026-10-06')],'p2 merged');
  equal(A1.j.meta.participationDays,{'2026-08-05':{p1:{s:'rest',kind:'train',at:100}},'2026-09-03':{p2:{s:'ok',kind:'train',at:300}}},'later record (at) wins');
  equal(A1.j.meta.injuryInfo,{p1:{'2026-08-01':{part:'ankle'}}},'injury info back');
  equal([A1.j.meta.emblem,A1.j.meta.formPos,A1.j.meta.grpBase],['E1',{x:1},['1군']],'missing keys restored, existing grpBase not overwritten');
  equal([A1.j.players.length,A1.j.attrs.length,A1.j.meta.tbCards],[3,1,['pos_GK']],'players/attrs/cards untouched');
  equal('seeded' in A1.j.meta,false,'seeded is never restored (1 would re-run the unnamed-player cleanup)');
  assert.ok(A1.cupd>1e12,'cupd bumped to now (ms)');passed++;
  equal((await doc(db,B)).raw,before.B,'B (not held) untouched');
  equal((await doc(db,C)).raw,before.C,'C untouched');
  const bk=(await db.query("select workspace_id,v from public.ps_kv_restore_backup_2948")).rows;
  equal([bk.length,bk[0].workspace_id,bk[0].v],[1,A,before.A],'backup holds A\'s previous document only');
  equal((await db.query("select relrowsecurity r from pg_class where oid='public.ps_kv_restore_backup_2948'::regclass")).rows[0].r,true,'backup table RLS on');
  equal((await db.query("select count(*)::int n from public.ps_kv_denied")).rows[0].n,0,'record guard let the restore through');
  // 3) 다시 실행해도 같다
  const out2=last(await db.exec(apply));
  equal(out2.filter(r=>r.written).length,0,'second run writes nothing');
  equal((await doc(db,A)).raw,A1.raw,'A unchanged on rerun');
  equal((await db.query("select count(*)::int n from public.ps_kv_restore_backup_2948")).rows[0].n,1,'no extra backup on rerun');
  // 4) 계산 블록은 두 파일이 같다
  const blk=s=>s.slice(s.indexOf('-- ── 함수'),s.indexOf('-- ── ',s.indexOf('-- 계획')));
  equal(blk(apply),blk(dry),'apply and dry run share the same computation block');
  console.log(`20261007_restore_2948_teams local test: ${passed} passed`);
}
run().catch(e=>{console.error(e);process.exit(1);});
