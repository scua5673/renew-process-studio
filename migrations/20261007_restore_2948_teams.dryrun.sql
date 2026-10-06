-- ════════════════════════════════════════════════════════════════════════
-- 20261007 · 2.948 피해 팀 가용인원 기록 복구 — 미리보기(읽기 전용, 아무것도 바꾸지 않는다)
-- 대상: public.ps_kv_history_hold_2948 에 보관한 팀(2026-10-06, 15팀·1,007판)의 선수단 본문(scout_tool_v1).
-- 무엇을 계산하나(실행판 20261007_restore_2948_teams.sql 과 같은 함수):
--   · statusRuns — 모든 이전 판 + 지금 문서를 날짜 단위로 펼쳐 같은 날은 더 나중 판이 이긴다(지금 문서가 가장 우선) → 다시 구간으로
--   · participationDays — 같은 날·같은 선수는 기록 시각(at)이 늦은 쪽(같으면 나중 판)
--   · injuryInfo — 같은 선수·같은 첫날은 나중 판
--   · 로고·색·조 이름(grpBase)·formPos 등 — 지금 문서에 그 칸이 **없을 때만** 그 칸을 가진 가장 나중 판에서
--   · 선수·평가표·포지션·카드 배치(tbCards)는 건드리지 않는다
--   · seeded 는 되살리지 않는다 — 1 로 돌아오면 앱이 열 때 «이름 없는 선수» 정리(옛 자동 생성 11명)를 다시 돌려 선수 목록을 건드린다
-- 결과: 팀마다 한 줄(바뀌는 것만 숫자로). 내용(이름·부상 메모)은 내보내지 않는다.
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
-- ── 미리보기 보고(팀마다 한 줄) ──
select coalesce(wk.name,'?') team, left(p.ws,8) ws,
       pg_temp.r2948_cnt(p.old_j->'meta'->'statusRuns')||'>'||pg_temp.r2948_cnt(p.runs) run_players,
       pg_temp.r2948_rundays(p.old_j->'meta'->'statusRuns')||'>'||pg_temp.r2948_rundays(p.runs) run_days,
       pg_temp.r2948_cnt(p.old_j->'meta'->'participationDays')||'>'||pg_temp.r2948_cnt(p.days) record_days,
       pg_temp.r2948_cnt(p.old_j->'meta'->'injuryInfo')||'>'||pg_temp.r2948_cnt(p.inj) injury_players,
       coalesce((select string_agg(k,',' order by k) from jsonb_object_keys(p.restore) k),'') restored_keys,
       p.old_len||'>'||length(p.new_j::text) len,
       (p.new_j<>p.old_j) changes,
       jsonb_array_length(coalesce(p.new_j->'players','[]'::jsonb))=jsonb_array_length(coalesce(p.old_j->'players','[]'::jsonb)) players_same
  from pg_temp.r2948_plan p left join public.ps_workspaces wk on wk.id::text=p.ws
 order by wk.name;
