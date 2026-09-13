-- Removes only this migration's marked guard objects; no data/RLS changes.
-- Removing the guard immediately permits an old client to overwrite a registry.
-- Disable registry-writing UI or resolve the compatibility issue before rollback.
-- Deliberately no CASCADE: unexpected dependants make rollback fail atomically.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE
  item record;
  marker constant text := 'process-studio/scout-registry-guard/20260913/v1';
BEGIN
  LOCK TABLE public.ps_kv IN SHARE ROW EXCLUSIVE MODE;
  FOR item IN SELECT p.oid FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'ps_scout_registry_guard_v1_array_kept', 'ps_scout_registry_guard_v1_reason', 'ps_scout_registry_guard_v1')
  LOOP
    IF pg_catalog.obj_description(item.oid, 'pg_proc') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'scout guard rollback: reserved function ownership marker differs';
    END IF;
  END LOOP;
  FOR item IN SELECT t.oid FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = to_regclass('public.ps_kv') AND t.tgname = 'zzzz_ps_scout_registry_guard_v1'
  LOOP
    IF pg_catalog.obj_description(item.oid, 'pg_trigger') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'scout guard rollback: trigger ownership marker differs';
    END IF;
  END LOOP;
END
$preflight$;
DROP TRIGGER IF EXISTS zzzz_ps_scout_registry_guard_v1 ON public.ps_kv;
DROP FUNCTION IF EXISTS public.ps_scout_registry_guard_v1();
DROP FUNCTION IF EXISTS public.ps_scout_registry_guard_v1_reason(jsonb,jsonb);
DROP FUNCTION IF EXISTS public.ps_scout_registry_guard_v1_array_kept(jsonb,jsonb);
COMMIT;
