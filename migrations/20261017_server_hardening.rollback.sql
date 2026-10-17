-- 20261017_server_hardening 되돌리기 — 적용 전 권한·설정·색인으로(2026-10-17 운영 조회 그대로). 데이터는 건드리지 않는다.
-- 여러 번 실행해도 같다.
BEGIN;
DO $rollback$
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
    'ps_admin_versions(integer)','ps_admin_workspaces()','ps_audit_log()'];
  -- 적용 전 PUBLIC 에도 열려 있던 일곱(나머지 스물셋은 anon 에게만 명시 GRANT 였다)
  had_public constant text[] := array[
    'ps_admin_event_summary_v2()','ps_admin_health()','ps_admin_kv_history(text,text,integer)','ps_admin_sync_stuck(integer)',
    'ps_audit_log()','ps_admin_versions(integer)','ps_admin_recent_activity(integer,integer,uuid,uuid)'];
  note constant text := 'ps_kv_note_denied(uuid,uuid,text,text)';
  f text;
BEGIN
  FOREACH f IN ARRAY fixed_path LOOP
    IF (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('public.'||f)) = array['search_path=public'] THEN
      EXECUTE format('ALTER FUNCTION public.%s RESET search_path', f);
    END IF;
  END LOOP;
  IF to_regprocedure('public.'||note) IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO PUBLIC, anon, authenticated, service_role', note);
  END IF;
  FOREACH f IN ARRAY admin_rpc LOOP
    CONTINUE WHEN to_regprocedure('public.'||f) IS NULL;
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon', f);
    IF f = ANY(had_public) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO PUBLIC', f); END IF;
  END LOOP;
  RAISE NOTICE '20261017 rollback: 권한·search_path 되돌림';
END
$rollback$;
CREATE UNIQUE INDEX IF NOT EXISTS ps_usage_day_user_feature_uidx ON public.ps_usage USING btree (day, user_id, feature);
COMMIT;
