-- READ-ONLY catalog verification. Does not exercise real team rows or prove
-- REST/RLS behavior by itself; use the separately approved synthetic transaction.
BEGIN;
DO $verify$
DECLARE
  actor oid := (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated');
  target oid := to_regclass('public.ps_kv');
  item record;
  found_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=target AND relrowsecurity)
     OR actor IS NULL OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE oid=actor AND (rolsuper OR rolbypassrls))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=target AND relowner=actor) THEN
    RAISE EXCEPTION 'scout write scope: authenticated RLS enforcement unavailable';
  END IF;
  FOR item IN SELECT p.*, pg_catalog.obj_description(p.oid,'pg_policy') AS marker
      FROM pg_catalog.pg_policy p WHERE p.polrelid=target
        AND p.polname IN ('ps_scout_insert_scope_v1','ps_scout_update_scope_v1','ps_scout_delete_scope_v1') LOOP
    found_count:=found_count+1;
    IF item.polpermissive OR item.polroles IS DISTINCT FROM ARRAY[actor]
       OR item.marker IS DISTINCT FROM 'process-studio/scout-write-scope/20260913/v1'
       OR (item.polname='ps_scout_insert_scope_v1' AND (item.polcmd<>'a' OR item.polwithcheck IS NULL))
       OR (item.polname='ps_scout_update_scope_v1' AND (item.polcmd<>'w' OR item.polqual IS NULL OR item.polwithcheck IS NULL))
       OR (item.polname='ps_scout_delete_scope_v1' AND (item.polcmd<>'d' OR item.polqual IS NULL)) THEN
      RAISE EXCEPTION 'scout write scope: installed policy shape differs';
    END IF;
  END LOOP;
  IF found_count<>3 THEN RAISE EXCEPTION 'scout write scope: expected three policies'; END IF;
END
$verify$;
SELECT polname, polcmd, polpermissive, polroles,
       pg_catalog.pg_get_expr(polqual,polrelid) AS using_expression,
       pg_catalog.pg_get_expr(polwithcheck,polrelid) AS check_expression
FROM pg_catalog.pg_policy
WHERE polrelid='public.ps_kv'::regclass
  AND polname IN ('ps_scout_insert_scope_v1','ps_scout_update_scope_v1','ps_scout_delete_scope_v1')
ORDER BY polname;
ROLLBACK;
