-- 20261017_server_hardening 확인(읽기 전용). 결과 한 줄: server_hardening_verified
DO $verify$
DECLARE
  fixed_path constant text[] := array[
    'ps_build_lt(text,text)','ps_key_scope(text)','ps_kv_noop_guard()','ps_request_build()','ps_touch()','ps_try_jsonb(text)'];
  admin_rpc constant text[] := array[
    'ps_admin_activity_keys(integer)','ps_admin_activity_users()','ps_admin_activity_ws()','ps_admin_delete_workspace(uuid)',
    'ps_admin_event_breakdown(integer)','ps_admin_event_summary()','ps_admin_event_summary_v2()','ps_admin_health()',
    'ps_admin_idp_funnel()','ps_admin_idp_get(uuid)','ps_admin_idp_users()','ps_admin_kv_history(text,text,integer)',
    'ps_admin_library(uuid,boolean)','ps_admin_library_item(uuid,text)','ps_admin_log(text,uuid,text,jsonb)','ps_admin_members(uuid)',
    'ps_admin_reach()','ps_admin_recent_activity(integer,integer,uuid,uuid)','ps_admin_remove_member(uuid,uuid)',
    'ps_admin_restore_lib(uuid,text)','ps_admin_soft_delete_lib(uuid,text)','ps_admin_sync_stuck(integer)','ps_admin_team_idp(uuid)',
    'ps_admin_usage_daily(integer)','ps_admin_usage_features(integer)','ps_admin_usage_summary()','ps_admin_users()',
    'ps_admin_versions(integer)','ps_admin_workspaces()'];   -- ps_audit_log() 는 트리거 함수라 실행 권한을 보지 않는다
  note constant regprocedure := to_regprocedure('public.ps_kv_note_denied(uuid,uuid,text,text)');
  f text; bad text;
BEGIN
  FOREACH f IN ARRAY fixed_path LOOP
    IF (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('public.'||f)) IS DISTINCT FROM array['search_path=public'] THEN
      RAISE EXCEPTION 'verify: public.% 의 search_path 가 고정되지 않았습니다', f;
    END IF;
  END LOOP;

  IF note IS NULL THEN RAISE EXCEPTION 'verify: ps_kv_note_denied 가 없습니다'; END IF;
  IF has_function_privilege('anon', note, 'EXECUTE') OR has_function_privilege('authenticated', note, 'EXECUTE')
     OR has_function_privilege('public', note, 'EXECUTE') THEN
    RAISE EXCEPTION 'verify: ps_kv_note_denied 를 아직 클라이언트 역할이 실행할 수 있습니다';
  END IF;
  IF NOT has_function_privilege('service_role', note, 'EXECUTE') THEN RAISE EXCEPTION 'verify: service_role 이 ps_kv_note_denied 를 실행하지 못합니다'; END IF;

  SELECT string_agg(f2, ', ') INTO bad FROM unnest(admin_rpc || 'ps_audit_log()'::text) f2
   WHERE to_regprocedure('public.'||f2) IS NOT NULL AND has_function_privilege('anon', to_regprocedure('public.'||f2), 'EXECUTE');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'verify: anon 이 아직 실행할 수 있는 관리자 함수 — %', bad; END IF;
  FOREACH f IN ARRAY admin_rpc LOOP
    CONTINUE WHEN to_regprocedure('public.'||f) IS NULL;
    IF NOT has_function_privilege('authenticated', to_regprocedure('public.'||f), 'EXECUTE') THEN
      RAISE EXCEPTION 'verify: authenticated 가 public.% 을 실행하지 못하게 됐습니다(관리자 화면이 멈춘다)', f;
    END IF;
  END LOOP;

  IF to_regclass('public.ps_usage_day_user_feature_uidx') IS NOT NULL THEN RAISE EXCEPTION 'verify: 중복 색인이 남아 있습니다'; END IF;
  IF to_regclass('public.ps_usage_pkey') IS NULL THEN RAISE EXCEPTION 'verify: ps_usage_pkey 가 없습니다'; END IF;
END
$verify$;
SELECT 'server_hardening_verified' AS result;
