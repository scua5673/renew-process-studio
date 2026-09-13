-- Removes only the three marked restrictive policies. No data, helper, grant,
-- or pre-existing policy changes. This restores the previous candidate-write
-- exposure; do not run casually to clear an expected authorization rejection.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE item record;
BEGIN
  LOCK TABLE public.ps_kv IN SHARE ROW EXCLUSIVE MODE;
  FOR item IN SELECT oid FROM pg_catalog.pg_policy WHERE polrelid=to_regclass('public.ps_kv')
      AND polname IN ('ps_scout_insert_scope_v1','ps_scout_update_scope_v1','ps_scout_delete_scope_v1') LOOP
    IF pg_catalog.obj_description(item.oid,'pg_policy') IS DISTINCT FROM
       'process-studio/scout-write-scope/20260913/v1' THEN
      RAISE EXCEPTION 'scout write scope rollback: policy ownership marker differs';
    END IF;
  END LOOP;
END
$preflight$;
DROP POLICY IF EXISTS ps_scout_insert_scope_v1 ON public.ps_kv;
DROP POLICY IF EXISTS ps_scout_update_scope_v1 ON public.ps_kv;
DROP POLICY IF EXISTS ps_scout_delete_scope_v1 ON public.ps_kv;
COMMIT;
