-- 20261012_perms_write_audit — 권한 문서(cs_perms_v1)를 권한 없는 사람이 쓴 판 찾기. 읽기 전용.
--
-- 왜: 2026-09-30 기록(20260930_role_alignment.applied.md)에 쓰기 가드 ps_kv_team_guard 가 관찰 모드(enforce=false)였고,
--     2026-10-07 에야 막기 시작했다(20261007_incident_ledger.applied.md). 그 사이 선수·역할 없는 구성원이 권한 문서를 썼다.
--     서버는 이 문서로 역할을 판단하므로(ps_team_role), 자기를 임원으로 올린 판이 있으면 그 사람은 지금도 임원일 수 있다.
-- 무엇을: 판 역사(ps_kv_history)에서 cs_perms_v1 의 모든 판을 팀별 시간순으로 늘어놓고, 각 판을 «바로 앞 판»과 비교한다.
--     쓴 사람이 팀 소유자도 아니고, 앞 판에서 임원(executive·admin)도 아니었으면 «권한 없는 쓰기».
--     그 판에서 누군가가 임원으로 올라갔으면 «승격», 그 사람이 지금 문서에서도 임원이면 «아직 유효».
-- 주의: 판 역사는 30일이 지나면 내용(v)을 비운다 — 내용이 빈 판은 판정할 수 없어 «내용 없음»으로 따로 센다.
--     오늘 돌리지 않으면 이른 판부터 매일 판정할 수 없게 된다.
-- 기록: 사용자 이름·이메일·본문은 내지 않는다. uuid·시각·역할 이름만.
-- 실행: Supabase SQL 편집기(운영 프로젝트)에서 세 문을 차례로. 결과를 20261012_perms_write_audit.applied.md 에 적는다.

-- ① 요약 — 팀별 권한 없는 쓰기·승격·아직 유효한 승격·판정 불가
with h as (
  select h.id, h.workspace_id, h.changed_by, h.changed_at,
         case when h.v is not null and pg_input_is_valid(h.v,'jsonb') and left(ltrim(h.v),1)='{' then h.v::jsonb end as j
  from public.ps_kv_history h
  where h.k = 'cs_perms_v1'
), seq as (
  select h.*, lag(h.j) over (partition by h.workspace_id order by h.changed_at, h.id) as prev_j,
         lag(h.id) over (partition by h.workspace_id order by h.changed_at, h.id) as prev_id
  from h
), judged as (
  select s.*, w.owner_id,
         coalesce(s.prev_j #>> array['members', s.changed_by::text, 'role'], s.prev_j ->> 'defaultRole') as writer_role_before,
         (s.changed_by is not null and s.changed_by is distinct from w.owner_id
          and s.prev_j is not null
          and coalesce(s.prev_j #>> array['members', s.changed_by::text, 'role'], s.prev_j ->> 'defaultRole', '') not in ('executive','admin','owner')) as unauthorized
  from seq s join public.ps_workspaces w on w.id::text = s.workspace_id
), raised as (
  select j.id, j.workspace_id, m.key::uuid as member_id
  from judged j, jsonb_each(coalesce(j.j -> 'members','{}'::jsonb)) m
  where j.unauthorized and j.j is not null
    and (m.value ->> 'role') in ('executive','admin','owner')
    and coalesce(j.prev_j #>> array['members', m.key, 'role'], j.prev_j ->> 'defaultRole', '') not in ('executive','admin','owner')
    and m.key ~ '^[0-9a-f-]{36}$'
), cur as (
  select k.workspace_id::text as workspace_id,
         case when pg_input_is_valid(k.v,'jsonb') and left(ltrim(k.v),1)='{' then k.v::jsonb end as j
  from public.ps_kv k where k.k = 'cs_perms_v1'
)
select j.workspace_id,
       count(*) filter (where j.unauthorized)                                         as unauthorized_writes,
       count(distinct j.changed_by) filter (where j.unauthorized)                     as unauthorized_writers,
       count(distinct r.member_id)                                                    as raised_to_executive,
       count(distinct r.member_id) filter (where (c.j #>> array['members', r.member_id::text, 'role']) in ('executive','admin','owner')) as still_executive_now,
       count(*) filter (where j.j is null)                                            as versions_without_content,
       min(j.changed_at) filter (where j.unauthorized)                                as first_unauthorized,
       max(j.changed_at) filter (where j.unauthorized)                                as last_unauthorized
from judged j
left join raised r on r.id = j.id
left join cur c on c.workspace_id = j.workspace_id
group by j.workspace_id
having count(*) filter (where j.unauthorized) > 0 or count(distinct r.member_id) > 0
order by raised_to_executive desc, unauthorized_writes desc;

-- ② 상세 — 승격이 든 판(누가 언제 누구를 올렸고, 지금도 임원인가). 이 표가 비면 승격은 없었다.
with h as (
  select h.id, h.workspace_id, h.changed_by, h.changed_at,
         case when h.v is not null and pg_input_is_valid(h.v,'jsonb') and left(ltrim(h.v),1)='{' then h.v::jsonb end as j
  from public.ps_kv_history h
  where h.k = 'cs_perms_v1'
), seq as (
  select h.*, lag(h.j) over (partition by h.workspace_id order by h.changed_at, h.id) as prev_j
  from h
), judged as (
  select s.*, w.owner_id,
         coalesce(s.prev_j #>> array['members', s.changed_by::text, 'role'], s.prev_j ->> 'defaultRole') as writer_role_before,
         (s.changed_by is not null and s.changed_by is distinct from w.owner_id
          and s.prev_j is not null
          and coalesce(s.prev_j #>> array['members', s.changed_by::text, 'role'], s.prev_j ->> 'defaultRole', '') not in ('executive','admin','owner')) as unauthorized
  from seq s join public.ps_workspaces w on w.id::text = s.workspace_id
), cur as (
  select k.workspace_id::text as workspace_id,
         case when pg_input_is_valid(k.v,'jsonb') and left(ltrim(k.v),1)='{' then k.v::jsonb end as j
  from public.ps_kv k where k.k = 'cs_perms_v1'
)
select j.workspace_id, j.id as history_id, j.changed_at, j.changed_by,
       coalesce(j.writer_role_before,'(없음)') as writer_role_before,
       m.key as raised_member, (m.key = j.changed_by::text) as raised_self,
       coalesce(j.prev_j #>> array['members', m.key, 'role'], j.prev_j ->> 'defaultRole', '(없음)') as role_before,
       m.value ->> 'role' as role_after,
       coalesce(c.j #>> array['members', m.key, 'role'], '(없음)') as role_now
from judged j
cross join lateral jsonb_each(coalesce(j.j -> 'members','{}'::jsonb)) m
left join cur c on c.workspace_id = j.workspace_id
where j.unauthorized and j.j is not null
  and (m.value ->> 'role') in ('executive','admin','owner')
  and coalesce(j.prev_j #>> array['members', m.key, 'role'], j.prev_j ->> 'defaultRole', '') not in ('executive','admin','owner')
order by j.changed_at;

-- ③ 판정 범위 — 판 역사가 어디까지 내용을 갖고 있나(이보다 이른 쓰기는 판정할 수 없다)
select min(changed_at) filter (where v is not null) as earliest_with_content,
       min(changed_at)                              as earliest_row,
       count(*) filter (where v is null)            as rows_without_content,
       count(*)                                     as rows_total
from public.ps_kv_history
where k = 'cs_perms_v1';
