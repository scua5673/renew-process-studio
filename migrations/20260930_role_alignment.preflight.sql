-- 20260930 role_default_player · idp_pub_write 사전 점검 — **읽기 전용**(SELECT 만). 아무것도 바꾸지 않는다.
-- 사용자 이름·이메일·본문을 출력하지 않는다(개수만).

-- ① 적용 전제: 바꿀 줄이 정확히 한 번씩 있는가, 이미 적용됐는가
WITH f AS (
  SELECT 'ps_team_role' AS fn, pg_get_functiondef(to_regprocedure('public.ps_team_role(uuid)')) AS d
  UNION ALL SELECT 'ps_idp_can_view', pg_get_functiondef(to_regprocedure('public.ps_idp_can_view(uuid)'))
  UNION ALL SELECT 'ps_can_write_key', pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'))
  UNION ALL SELECT 'ps_kv_team_guard', pg_get_functiondef(to_regprocedure('public.ps_kv_team_guard()'))
)
SELECT fn,
  (d IS NOT NULL) AS exists,
  (SELECT count(*) FROM regexp_matches(coalesce(d,''), $re$->>\s*'defaultRole'\s*,\s*'staff'$re$, 'gi')) AS staff_default_lines,
  (SELECT count(*) FROM regexp_matches(coalesce(d,''), $re$if\s+pj\s+is\s+null\s+then\s+return\s+'admin'$re$, 'gi')) AS missing_admin_lines,
  (SELECT count(*) FROM regexp_matches(coalesce(d,''), $re$if\s+pj\s+is\s+null\s+then\s+return\s+true$re$, 'gi')) AS missing_true_lines,
  (SELECT count(*) FROM regexp_matches(coalesce(d,''), $re$if\s+not\s+public\.ps_is_member\s*\(\s*wid\s*\)\s+then\s+return\s+false\s*;\s*end\s+if\s*;$re$, 'gi')) AS member_check_lines,
  position('ps-20260930-role-default' in coalesce(d,'')) > 0 AS role_default_applied,
  position('ps-20260930-idp-pub-write' in coalesce(d,'')) > 0 AS idp_pub_applied,
  -- 가드: 코치 피드백 키가 따로 분기되지 않고 «나머지» 분기(ps_can_write_key)로 가는가
  (fn = 'ps_kv_team_guard' AND position('cs\_idp\_pub' in coalesce(d,'')) = 0 AND position('ps_can_write_key(new.workspace_id, new.k)' in coalesce(d,'')) > 0) AS guard_pub_goes_to_write_key,
  length(coalesce(d,'')) AS def_len
FROM f ORDER BY fn;

-- ② 가드 모드 — true 면 거부가 실제로 막힌다
SELECT enforce AS guard_enforce FROM public.ps_guard_mode WHERE id = 1;

-- ③ 영향 인원 — 팀 공간의 비소유 구성원을 권한표 기준으로 가른다
WITH mem AS (
  SELECT m.workspace_id, m.user_id
    FROM public.ps_members m JOIN public.ps_workspaces w ON w.id = m.workspace_id
   WHERE coalesce(w.kind,'team') <> 'personal' AND m.role <> 'owner' AND m.user_id <> w.owner_id
), p AS (
  SELECT workspace_id, (v::jsonb) AS pj FROM public.ps_kv WHERE k = 'cs_perms_v1'
)
SELECT
  count(*) AS team_non_owner_members,
  count(*) FILTER (WHERE p.pj IS NULL) AS in_team_without_perms_doc,                          -- 서버 admin → player
  count(*) FILTER (WHERE p.pj IS NOT NULL AND (p.pj->'members'->(mem.user_id::text)->>'role') IS NULL
                   AND (p.pj->>'defaultRole') IS NULL) AS no_role_no_default,                  -- 서버 staff → player
  count(*) FILTER (WHERE p.pj IS NOT NULL AND (p.pj->'members'->(mem.user_id::text)->>'role') IS NULL
                   AND (p.pj->>'defaultRole') IS NOT NULL) AS by_default_role,                 -- 그대로
  count(*) FILTER (WHERE (p.pj->'members'->(mem.user_id::text)->>'role') IS NOT NULL) AS explicit_role, -- 그대로
  count(DISTINCT mem.workspace_id) FILTER (WHERE p.pj IS NULL) AS teams_without_perms_doc
FROM mem LEFT JOIN p USING (workspace_id);

-- ④ 바뀌는 사람 중 최근 30일 안에 팀 자료를 실제로 쓴 사람(서버 기록 updated_by) — 0 이면 쓰기 쪽 영향 없음
WITH mem AS (
  SELECT m.workspace_id, m.user_id
    FROM public.ps_members m JOIN public.ps_workspaces w ON w.id = m.workspace_id
   WHERE coalesce(w.kind,'team') <> 'personal' AND m.role <> 'owner' AND m.user_id <> w.owner_id
), p AS (
  SELECT workspace_id, (v::jsonb) AS pj FROM public.ps_kv WHERE k = 'cs_perms_v1'
), changed AS (
  SELECT mem.* FROM mem LEFT JOIN p USING (workspace_id)
   WHERE p.pj IS NULL OR ((p.pj->'members'->(mem.user_id::text)->>'role') IS NULL AND (p.pj->>'defaultRole') IS NULL)
)
SELECT count(DISTINCT c.user_id) AS changed_users_who_wrote_team_keys_30d,
       count(*) AS team_rows_last_written_by_them
  FROM changed c JOIN public.ps_kv k ON k.workspace_id = c.workspace_id AND k.updated_by = c.user_id
 WHERE k.updated_at > now() - interval '30 days' AND k.k NOT LIKE 'cs\_idp\_v1\_%';

-- ⑤ 2번 증상 — 코치 피드백 키 쓰기 거부 기록(가드가 남긴 것)
SELECT count(*) AS idp_pub_denied_rows, count(DISTINCT user_id) AS idp_pub_denied_users, max(at) AS last_at
  FROM public.ps_kv_denied WHERE k LIKE 'cs\_idp\_pub\_v1\_%';
