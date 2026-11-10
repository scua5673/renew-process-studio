-- 20261110_privacy_limits 확인(읽기 전용). 결과 한 줄: privacy_limits_verified
DO $verify$
DECLARE f text; o regprocedure; pol text; bad text; t text;
BEGIN
  FOREACH f IN ARRAY array['ps_members_of(uuid)','ps_members_of_v2(uuid)','ps_delete_my_data()','ps_support_reporter_devices(uuid,integer)','ps_admin_stale_clients(integer,integer)','ps_perms_authorised_doc(uuid,uuid,jsonb)','ps_rate_bump(text)','ps_err_guard()','ps_comm_report_guard()','ps_blob_guard()','ps_workspace_fixed_guard()','ps_latest_app_version(timestamp with time zone)'] LOOP
    o := to_regprocedure('public.'||f);
    IF o IS NULL THEN RAISE EXCEPTION 'verify: public.% 이 없습니다', f; END IF;
    IF NOT (SELECT p.prosrc LIKE '%ps-20261110-privacy%' FROM pg_proc p WHERE p.oid = o) THEN RAISE EXCEPTION 'verify: public.% 이 새 본문이 아닙니다', f; END IF;
  END LOOP;
  FOREACH f IN ARRAY array['ps_rate_bump(text)','ps_latest_app_version(timestamp with time zone)','ps_perms_authorised_doc(uuid,uuid,jsonb)'] LOOP
    IF has_function_privilege('anon', 'public.'||f, 'EXECUTE') OR has_function_privilege('authenticated', 'public.'||f, 'EXECUTE') THEN
      RAISE EXCEPTION 'verify: 안쪽 함수 public.% 을 클라이언트 역할이 실행할 수 있습니다', f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY array['ps_members_of(uuid)','ps_members_of_v2(uuid)','ps_delete_my_data()','ps_support_reporter_devices(uuid,integer)','ps_admin_stale_clients(integer,integer)'] LOOP
    IF NOT has_function_privilege('authenticated', 'public.'||f, 'EXECUTE') THEN RAISE EXCEPTION 'verify: authenticated 가 public.% 을 실행하지 못합니다(앱이 멈춘다)', f; END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.ps_support_reporter_devices(uuid,integer)', 'EXECUTE') OR has_function_privilege('anon', 'public.ps_admin_stale_clients(integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify: 관리자 함수를 anon 이 실행할 수 있습니다';
  END IF;
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO pol FROM pg_policy p WHERE p.polrelid = 'public.ps_members'::regclass AND p.polname = 'mem_sel';
  IF pol IS NULL OR pol NOT LIKE '%ps_team_role(workspace_id)%' OR pol NOT LIKE '%user_id = auth.uid()%' THEN RAISE EXCEPTION 'verify: mem_sel 이 새 정책이 아닙니다(%)', pol; END IF;
  FOR t, f IN SELECT * FROM (VALUES ('ps_err','ps_err_guard_t'),('ps_comm_reports','ps_comm_report_guard_t'),('ps_blob','ps_blob_guard_t'),('ps_workspaces','ps_workspace_fixed_guard_t')) x LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = ('public.'||t)::regclass AND g.tgname = f AND g.tgenabled <> 'D') THEN RAISE EXCEPTION 'verify: 트리거 %.% 가 없거나 꺼져 있습니다', t, f; END IF;
  END LOOP;
  FOR t, f IN SELECT * FROM (VALUES ('ps_err','ps_err_len_chk'),('ps_comm_reports','ps_comm_reports_len_chk'),('ps_events','ps_events_meta_size_chk'),('ps_events','ps_events_app_version_chk'),('ps_events','ps_events_workspace_id_chk')) x LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = ('public.'||t)::regclass AND k.conname = f) THEN RAISE EXCEPTION 'verify: 검사 %.% 가 없습니다', t, f; END IF;
  END LOOP;
  FOREACH t IN ARRAY array['ps_rate_counters','ps_account_deletions'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'verify: public.% 가 없습니다', t; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.'||t)::regclass) THEN RAISE EXCEPTION 'verify: public.% 에 행 단위 보안이 꺼져 있습니다', t; END IF;
    IF has_table_privilege('anon', 'public.'||t, 'SELECT') OR has_table_privilege('authenticated', 'public.'||t, 'SELECT') OR has_table_privilege('authenticated', 'public.'||t, 'INSERT') THEN
      RAISE EXCEPTION 'verify: 클라이언트 역할이 public.% 에 닿습니다', t;
    END IF;
  END LOOP;
  -- 권한: 거둔 것은 없고, 로그인 없는 흐름 · 로그인한 앱이 쓰는 것은 그대로
  SELECT string_agg(g.grantee || ':' || g.table_name || ':' || g.privilege_type, ', ') INTO bad FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public' AND g.grantee IN ('anon','authenticated') AND g.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'verify: 거두지 못한 권한 — %', left(bad, 400); END IF;
  SELECT string_agg(g.table_name || ':' || g.privilege_type, ', ') INTO bad FROM information_schema.role_table_grants g
   WHERE g.table_schema = 'public' AND g.grantee = 'anon' AND g.privilege_type IN ('INSERT','UPDATE','DELETE')
     AND NOT (g.privilege_type = 'INSERT' AND g.table_name IN ('ps_err','ps_comm_reports'));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'verify: anon 에게 남은 쓰기 권한 — %', left(bad, 400); END IF;
  IF NOT (has_table_privilege('anon','public.ps_err','INSERT') AND has_table_privilege('anon','public.ps_comm_reports','INSERT')
          AND has_table_privilege('anon','public.ps_community','SELECT') AND has_table_privilege('anon','public.ps_comm_likes','SELECT') AND has_table_privilege('anon','public.ps_handles','SELECT')) THEN
    RAISE EXCEPTION 'verify: 로그인 없는 흐름이 쓰는 권한이 사라졌습니다';
  END IF;
  -- 로그인한 앱이 쓰는 권한(기준본의 SELECT · INSERT · UPDATE · DELETE)은 하나도 줄지 않았다
  SELECT string_agg(x.t || ':' || x.p, ', ') INTO bad FROM (VALUES
    ('ps_admin_actions','DELETE'),
    ('ps_admin_actions','INSERT'),
    ('ps_admin_actions','SELECT'),
    ('ps_admin_actions','UPDATE'),
    ('ps_admins','DELETE'),
    ('ps_admins','INSERT'),
    ('ps_admins','SELECT'),
    ('ps_admins','UPDATE'),
    ('ps_app_policy','DELETE'),
    ('ps_app_policy','INSERT'),
    ('ps_app_policy','SELECT'),
    ('ps_app_policy','UPDATE'),
    ('ps_audit','DELETE'),
    ('ps_audit','INSERT'),
    ('ps_audit','SELECT'),
    ('ps_audit','UPDATE'),
    ('ps_blob','DELETE'),
    ('ps_blob','INSERT'),
    ('ps_blob','SELECT'),
    ('ps_blob','UPDATE'),
    ('ps_comm_likes','DELETE'),
    ('ps_comm_likes','INSERT'),
    ('ps_comm_likes','SELECT'),
    ('ps_comm_likes','UPDATE'),
    ('ps_comm_reports','DELETE'),
    ('ps_comm_reports','INSERT'),
    ('ps_comm_reports','SELECT'),
    ('ps_comm_reports','UPDATE'),
    ('ps_community','DELETE'),
    ('ps_community','INSERT'),
    ('ps_community','SELECT'),
    ('ps_community','UPDATE'),
    ('ps_err','DELETE'),
    ('ps_err','INSERT'),
    ('ps_err','SELECT'),
    ('ps_err','UPDATE'),
    ('ps_events','DELETE'),
    ('ps_events','INSERT'),
    ('ps_events','SELECT'),
    ('ps_events','UPDATE'),
    ('ps_guard_mode','DELETE'),
    ('ps_guard_mode','INSERT'),
    ('ps_guard_mode','SELECT'),
    ('ps_guard_mode','UPDATE'),
    ('ps_handles','DELETE'),
    ('ps_handles','INSERT'),
    ('ps_handles','SELECT'),
    ('ps_handles','UPDATE'),
    ('ps_invites','DELETE'),
    ('ps_invites','INSERT'),
    ('ps_invites','SELECT'),
    ('ps_invites','UPDATE'),
    ('ps_kv','DELETE'),
    ('ps_kv','INSERT'),
    ('ps_kv','SELECT'),
    ('ps_kv','UPDATE'),
    ('ps_kv_denied','DELETE'),
    ('ps_kv_denied','INSERT'),
    ('ps_kv_denied','SELECT'),
    ('ps_kv_denied','UPDATE'),
    ('ps_kv_ping','DELETE'),
    ('ps_kv_ping','INSERT'),
    ('ps_kv_ping','SELECT'),
    ('ps_kv_ping','UPDATE'),
    ('ps_library','DELETE'),
    ('ps_library','INSERT'),
    ('ps_library','SELECT'),
    ('ps_library','UPDATE'),
    ('ps_members','DELETE'),
    ('ps_members','INSERT'),
    ('ps_members','SELECT'),
    ('ps_members','UPDATE'),
    ('ps_share','DELETE'),
    ('ps_share','INSERT'),
    ('ps_share','UPDATE'),
    ('ps_usage','DELETE'),
    ('ps_usage','INSERT'),
    ('ps_usage','SELECT'),
    ('ps_usage','UPDATE'),
    ('ps_workspaces','DELETE'),
    ('ps_workspaces','INSERT'),
    ('ps_workspaces','SELECT'),
    ('ps_workspaces','UPDATE')
  ) AS x(t, p) WHERE to_regclass('public.'||x.t) IS NOT NULL AND NOT has_table_privilege('authenticated', 'public.'||x.t, x.p);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'verify: authenticated 의 권한이 줄었습니다(앱이 멈춘다) — %', left(bad, 400); END IF;
END
$verify$;
SELECT 'privacy_limits_verified' AS result;
