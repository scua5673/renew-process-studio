-- ════════════════════════════════════════════════════════════════════════
-- 20261007 · 2.948 피해 팀 가용인원 기록 복구 — 실행판(운영 ps_kv 를 고친다)
-- 먼저 20261007_restore_2948_teams.dryrun.sql 로 미리 볼 것. 계산은 그 파일과 같다(아래 함수·계획 블록은 미리보기에서 생성 — 시험이 같음을 확인한다).
-- 고치는 것: 보관 팀(ps_kv_history_hold_2948)의 scout_tool_v1 meta 의 statusRuns·participationDays·injuryInfo
--   + 지금 없는 로고·색·조 이름(grpBase)·formPos 등. 선수·평가표·포지션·카드 배치는 그대로.
-- 안전: ① 고치기 전 문서를 public.ps_kv_restore_backup_2948 에 남긴다(RLS·앱 권한 없음)
--       ② 계획을 만든 뒤 문서가 바뀌었으면 그 팀은 건너뛴다(p.v::jsonb = old_j)
--       ③ 바뀌는 것이 없으면 쓰지 않는다 — 다시 실행해도 같다
--       ④ cupd 를 지금 시각으로 올려 기기들이 새 판을 받는다(선수단 기록 가드 R1·R2 를 지난다 — 칸을 더할 뿐)
-- 되돌리기: update public.ps_kv p set v=b.v, cupd=(extract(epoch from now())*1000)::bigint, updated_at=now()
--             from public.ps_kv_restore_backup_2948 b where p.workspace_id::text=b.workspace_id and p.k=b.k and b.run_at=(select max(run_at) from public.ps_kv_restore_backup_2948);
-- ════════════════════════════════════════════════════════════════════════
-- ── 함수(이 실행에서만 산다: pg_temp) ── 실행판과 같은 블록 — 고칠 땐 두 파일 다 ──
create or replace function pg_temp.r2948_obj(j jsonb) returns jsonb language sql immutable as $f$
  select case when jsonb_typeof(j)='object' then j else '{}'::jsonb end $f$;
create or replace function pg_temp.r2948_runs(vs jsonb) returns jsonb language sql immutable as $f$
  with v as (select ord, pg_temp.r2948_obj(x) o from jsonb_array_elements(vs) with ordinality t(x,ord)),
  r as (select v.ord, p.key pid, e.value run
          from v, jsonb_each(v.o) p,
               jsonb_array_elements(case when jsonb_typeof(p.value)='array' then p.value else '[]'::jsonb end) e
         where jsonb_typeof(e.value)='object' and jsonb_typeof(e.value->'s')='string'
           and coalesce(e.value->>'from','') ~ '^\d{4}-\d{2}-\d{2}$' and coalesce(e.value->>'to','') ~ '^\d{4}-\d{2}-\d{2}$'
           and (e.value->>'from')<=(e.value->>'to')
           and (e.value->>'to')::date-(e.value->>'from')::date<=400),
  d as (select pid, ord, dd::date dy, run->>'s' s, case when jsonb_typeof(run->'n')='string' then run->'n' end n
          from r, generate_series((run->>'from')::date,(run->>'to')::date,interval '1 day') dd),
  best as (select distinct on (pid,dy) pid, dy, s, n from d order by pid, dy, ord desc),
  g as (select pid, dy, s, n,
               dy - (row_number() over (partition by pid, s, coalesce(n::text,'') order by dy))::int grp from best),
  runs as (select pid, s, n, min(dy) f, max(dy) t from g group by pid, s, n, grp)
  select coalesce(jsonb_object_agg(pid, arr),'{}'::jsonb) from (
    select pid, jsonb_agg(jsonb_strip_nulls(jsonb_build_object('s',s,'from',to_char(f,'YYYY-MM-DD'),'to',to_char(t,'YYYY-MM-DD'),'n',n)) order by f) arr
      from runs group by pid) z $f$;
create or replace function pg_temp.r2948_days(vs jsonb) returns jsonb language sql immutable as $f$
  with v as (select ord, pg_temp.r2948_obj(x) o from jsonb_array_elements(vs) with ordinality t(x,ord)),
  c as (select v.ord, d.key dy, p.key pid, p.value cell
          from v, jsonb_each(v.o) d, jsonb_each(pg_temp.r2948_obj(d.value)) p
         where jsonb_typeof(p.value)='object'),
  best as (select distinct on (dy,pid) dy, pid, cell from c
            order by dy, pid, case when jsonb_typeof(cell->'at')='number' then (cell->>'at')::numeric else 0 end desc, ord desc)
  select coalesce(jsonb_object_agg(dy, cells),'{}'::jsonb) from (select dy, jsonb_object_agg(pid,cell) cells from best group by dy) z $f$;
create or replace function pg_temp.r2948_inj(vs jsonb) returns jsonb language sql immutable as $f$
  with v as (select ord, pg_temp.r2948_obj(x) o from jsonb_array_elements(vs) with ordinality t(x,ord)),
  c as (select v.ord, p.key pid, d.key dy, d.value info
          from v, jsonb_each(v.o) p, jsonb_each(pg_temp.r2948_obj(p.value)) d
         where jsonb_typeof(d.value)='object'),
  best as (select distinct on (pid,dy) pid, dy, info from c order by pid, dy, ord desc)
  select coalesce(jsonb_object_agg(pid, infos),'{}'::jsonb) from (select pid, jsonb_object_agg(dy,info) infos from best group by pid) z $f$;
create or replace function pg_temp.r2948_rundays(runs jsonb) returns bigint language sql immutable as $f$
  select coalesce(sum((e.value->>'to')::date-(e.value->>'from')::date+1),0)
    from jsonb_each(pg_temp.r2948_obj(runs)) p,
         jsonb_array_elements(case when jsonb_typeof(p.value)='array' then p.value else '[]'::jsonb end) e
   where coalesce(e.value->>'from','') ~ '^\d{4}-\d{2}-\d{2}$' and coalesce(e.value->>'to','') ~ '^\d{4}-\d{2}-\d{2}$'
     and (e.value->>'from')<=(e.value->>'to') $f$;
create or replace function pg_temp.r2948_cnt(o jsonb) returns bigint language sql immutable as $f$
  select count(*) from jsonb_object_keys(pg_temp.r2948_obj(o)) $f$;
-- 계획: 팀마다 지금 문서(old_j)와 새 문서(new_j)
drop table if exists pg_temp.r2948_plan;
create temp table r2948_plan as
with aff as (select distinct workspace_id::text ws from public.ps_kv_history_hold_2948 where k='scout_tool_v1'),
src as (
  select workspace_id::text ws, id, changed_at at, v from public.ps_kv_history_hold_2948 where k='scout_tool_v1' and v is not null
  union all
  select h.workspace_id::text, h.id, h.changed_at, h.v from public.ps_kv_history h
   where h.k='scout_tool_v1' and h.v is not null and h.workspace_id::text in (select ws from aff)
     and not exists (select 1 from public.ps_kv_history_hold_2948 x where x.id=h.id)),
vers as (select ws, row_number() over (partition by ws order by at, id) ord,
                case when v ~ '^\s*\{' then v::jsonb else '{}'::jsonb end j from src),
cur as (select workspace_id::text ws, v::jsonb j, length(v) len from public.ps_kv
         where k='scout_tool_v1' and workspace_id::text in (select ws from aff) and v ~ '^\s*\{'),
allv as (select ws, ord, j from vers union all select ws, 1000000000, j from cur),
agg as (select ws,
          jsonb_agg(pg_temp.r2948_obj(j->'meta'->'statusRuns') order by ord) runs_vs,
          jsonb_agg(pg_temp.r2948_obj(j->'meta'->'participationDays') order by ord) days_vs,
          jsonb_agg(pg_temp.r2948_obj(j->'meta'->'injuryInfo') order by ord) inj_vs
          from allv group by ws),
keys as (select z.ws, jsonb_object_agg(z.k, z.val) restore from (
           select distinct on (a.ws, kk.k) a.ws, kk.k, a.j->'meta'->kk.k val
             from vers a cross join unnest(array['emblem','emblemRef','color','kit','form','formPos','grpBase','teamName','headline','scoutForm','staffReady','evalStdMigratedAt','tbXY']) kk(k)
            where pg_temp.r2948_obj(a.j->'meta') ? kk.k and jsonb_typeof(a.j->'meta'->kk.k)<>'null'
            order by a.ws, kk.k, a.ord desc) z
          where not exists (select 1 from cur c where c.ws=z.ws and pg_temp.r2948_obj(c.j->'meta') ? z.k)
          group by z.ws),
m as (select c.ws, c.j old_j, c.len old_len, coalesce(k.restore,'{}'::jsonb) restore,
             pg_temp.r2948_runs(g.runs_vs) runs, pg_temp.r2948_days(g.days_vs) days, pg_temp.r2948_inj(g.inj_vs) inj
        from cur c join agg g on g.ws=c.ws left join keys k on k.ws=c.ws)
select ws, old_j, old_len, restore, runs, days, inj,
       jsonb_set(old_j, '{meta}',
         pg_temp.r2948_obj(old_j->'meta') || restore || jsonb_build_object('statusRuns', runs)
         || case when days<>'{}'::jsonb or pg_temp.r2948_obj(old_j->'meta') ? 'participationDays' then jsonb_build_object('participationDays', days) else '{}'::jsonb end
         || case when inj<>'{}'::jsonb or pg_temp.r2948_obj(old_j->'meta') ? 'injuryInfo' then jsonb_build_object('injuryInfo', inj) else '{}'::jsonb end,
         true) new_j
  from m;
-- ── 실행: 백업 → 고치기 → 보고 ──
create table if not exists public.ps_kv_restore_backup_2948 (workspace_id text not null, k text not null, v text, cupd bigint, run_at timestamptz not null);
alter table public.ps_kv_restore_backup_2948 enable row level security;
revoke all on public.ps_kv_restore_backup_2948 from anon, authenticated;
drop table if exists pg_temp.r2948_run;
drop table if exists pg_temp.r2948_done;
create temp table r2948_run as select now() at;
insert into public.ps_kv_restore_backup_2948 (workspace_id, k, v, cupd, run_at)
select p.workspace_id::text, p.k, p.v, p.cupd, (select at from r2948_run)
  from public.ps_kv p join pg_temp.r2948_plan x on x.ws=p.workspace_id::text
 where p.k='scout_tool_v1' and x.new_j<>x.old_j;
create temp table r2948_done (ws text, j jsonb, cupd bigint);
with u as (
  update public.ps_kv p
     set v = x.new_j::text, cupd = (extract(epoch from now())*1000)::bigint, updated_at = now()
    from pg_temp.r2948_plan x
   where p.workspace_id::text=x.ws and p.k='scout_tool_v1' and x.new_j<>x.old_j and p.v::jsonb = x.old_j
  returning p.workspace_id::text ws, p.v::jsonb j, p.cupd)
insert into r2948_done select ws, j, cupd from u;
select coalesce(wk.name,'?') team, left(x.ws,8) ws, (d.ws is not null) written,
       pg_temp.r2948_cnt(x.old_j->'meta'->'statusRuns')||'>'||pg_temp.r2948_cnt(d.j->'meta'->'statusRuns') run_players,
       pg_temp.r2948_rundays(x.old_j->'meta'->'statusRuns')||'>'||pg_temp.r2948_rundays(d.j->'meta'->'statusRuns') run_days,
       pg_temp.r2948_cnt(x.old_j->'meta'->'participationDays')||'>'||pg_temp.r2948_cnt(d.j->'meta'->'participationDays') record_days,
       coalesce((select string_agg(k,',' order by k) from jsonb_object_keys(x.restore) k),'') restored_keys,
       jsonb_array_length(coalesce(d.j->'players','[]'::jsonb)) players_now,
       (select count(*) from public.ps_kv_restore_backup_2948 b where b.workspace_id=x.ws and b.run_at=(select at from r2948_run)) backed_up
  from pg_temp.r2948_plan x left join r2948_done d on d.ws=x.ws left join public.ps_workspaces wk on wk.id::text=x.ws
 order by wk.name;
