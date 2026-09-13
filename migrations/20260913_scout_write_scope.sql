-- ADDITIONAL SECURITY FIX; independent of the registry-content UPDATE guard.
-- Prepared only. No operational execution is implied by this file.
-- Restricts authenticated writes to TKEY to its existing read authorization
-- (membership + executive/admin). Other keys evaluate true in these policies.
-- Existing functions, permissive policies, grants and row data are untouched.
-- Includes plain INSERT and DELETE, which must be tested without RETURNING.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE
  target oid := to_regclass('public.ps_kv');
  actor oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated');
  marker constant text := 'process-studio/scout-write-scope/20260913/v1';
  item record;
BEGIN
  IF target IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
      WHERE oid=target AND relkind='r' AND relrowsecurity) THEN
    RAISE EXCEPTION 'scout write scope: public.ps_kv ordinary table with RLS required';
  END IF;
  LOCK TABLE public.ps_kv IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=target AND relkind='r' AND relrowsecurity) THEN
    RAISE EXCEPTION 'scout write scope: RLS/table state changed during preflight';
  END IF;
  IF actor IS NULL OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles
      WHERE oid=actor AND (rolsuper OR rolbypassrls))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=target AND relowner=actor) THEN
    RAISE EXCEPTION 'scout write scope: authenticated must be subject to RLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=target
      AND attname='workspace_id' AND NOT attisdropped AND atttypid='uuid'::regtype)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=target
      AND attname='k' AND NOT attisdropped AND atttypid='text'::regtype)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc
      WHERE oid=to_regprocedure('public.ps_can_read_key(uuid,text)') AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'scout write scope: expected columns or existing read helper unavailable';
  END IF;
  FOR item IN SELECT oid FROM pg_catalog.pg_policy WHERE polrelid=target
      AND polname IN ('ps_scout_insert_scope_v1','ps_scout_update_scope_v1','ps_scout_delete_scope_v1') LOOP
    IF pg_catalog.obj_description(item.oid,'pg_policy') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'scout write scope: policy name is owned by another migration';
    END IF;
  END LOOP;
END
$preflight$;

DROP POLICY IF EXISTS ps_scout_insert_scope_v1 ON public.ps_kv;
CREATE POLICY ps_scout_insert_scope_v1 ON public.ps_kv
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (k IS DISTINCT FROM 'cs_scout_targets_v1' OR public.ps_can_read_key(workspace_id,k));
DROP POLICY IF EXISTS ps_scout_update_scope_v1 ON public.ps_kv;
CREATE POLICY ps_scout_update_scope_v1 ON public.ps_kv
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (k IS DISTINCT FROM 'cs_scout_targets_v1' OR public.ps_can_read_key(workspace_id,k))
  WITH CHECK (k IS DISTINCT FROM 'cs_scout_targets_v1' OR public.ps_can_read_key(workspace_id,k));
DROP POLICY IF EXISTS ps_scout_delete_scope_v1 ON public.ps_kv;
CREATE POLICY ps_scout_delete_scope_v1 ON public.ps_kv
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (k IS DISTINCT FROM 'cs_scout_targets_v1' OR public.ps_can_read_key(workspace_id,k));

COMMENT ON POLICY ps_scout_insert_scope_v1 ON public.ps_kv
  IS 'process-studio/scout-write-scope/20260913/v1';
COMMENT ON POLICY ps_scout_update_scope_v1 ON public.ps_kv
  IS 'process-studio/scout-write-scope/20260913/v1';
COMMENT ON POLICY ps_scout_delete_scope_v1 ON public.ps_kv
  IS 'process-studio/scout-write-scope/20260913/v1';
COMMIT;
