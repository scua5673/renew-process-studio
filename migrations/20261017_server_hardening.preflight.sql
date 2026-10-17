-- 20261017_server_hardening 사전 점검(읽기 전용). 적용 전에 SQL 편집기에서 돌려 기대값과 견준다.
-- 기대(2026-10-17 조회): search_path_open 6 · note_denied_client_exec true · note_callers_not_definer 0 ·
--                       admin_anon_exec 30 · admin_auth_exec 30 · dup_index_same_as_pkey true
SELECT
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proconfig IS NULL
     AND p.oid::regprocedure::text IN ('ps_build_lt(text,text)','ps_key_scope(text)','ps_kv_noop_guard()','ps_request_build()','ps_touch()','ps_try_jsonb(text)'))
    AS search_path_open,
  has_function_privilege('anon', 'public.ps_kv_note_denied(uuid,uuid,text,text)', 'EXECUTE') AS note_denied_client_exec,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname<>'ps_kv_note_denied'
     AND p.prosrc LIKE '%ps_kv_note_denied%' AND NOT p.prosecdef) AS note_callers_not_definer,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
     AND (p.proname LIKE 'ps\_admin\_%' OR p.proname='ps_audit_log') AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS admin_anon_exec,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
     AND (p.proname LIKE 'ps\_admin\_%' OR p.proname='ps_audit_log') AND has_function_privilege('anon', p.oid, 'EXECUTE')
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS admin_auth_exec,
  (SELECT a.indkey::text = b.indkey::text FROM pg_index a, pg_index b
    WHERE a.indexrelid = to_regclass('public.ps_usage_pkey') AND b.indexrelid = to_regclass('public.ps_usage_day_user_feature_uidx')) AS dup_index_same_as_pkey;
