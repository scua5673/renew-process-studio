-- READ ONLY installation checks. This never opts a team in or reads player data.
DO $$
DECLARE r record;
BEGIN
 IF has_schema_privilege('authenticated','ps_roster_private','USAGE')
 OR has_schema_privilege('anon','ps_roster_private','USAGE') THEN RAISE EXCEPTION 'Private schema is exposed'; END IF;
 FOR r IN SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='ps_roster_private' AND c.relkind='r' LOOP
   IF NOT r.relrowsecurity OR has_table_privilege('authenticated',r.oid,'SELECT,INSERT,UPDATE,DELETE')
   OR has_table_privilege('anon',r.oid,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Private table is exposed: %',r.relname; END IF;
 END LOOP;
 FOR r IN SELECT p.oid,p.proname,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='ps_roster_private' LOOP
   IF has_function_privilege('authenticated',r.oid,'EXECUTE') OR has_function_privilege('anon',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'Private function is exposed: %',r.proname; END IF;
 END LOOP;
 FOR r IN SELECT p.oid,p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('ps_roster_canonical_status','ps_roster_canonical_read','ps_roster_canonical_activate','ps_roster_canonical_mutate') LOOP
   IF NOT r.prosecdef OR NOT (coalesce(r.proconfig,'{}') @> ARRAY['search_path=pg_catalog']::text[])
   OR NOT has_function_privilege('authenticated',r.oid,'EXECUTE') OR has_function_privilege('anon',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'RPC security mismatch: %',r.proname; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.ps_kv'::regclass AND NOT tgisinternal
   AND tgname IN ('ps_000_roster_canonical_gate_v1','zzzzz_roster_canonical_consume_v1') AND tgenabled='O')<>2 THEN
   RAISE EXCEPTION 'Canonical guards missing or disabled'; END IF;
END $$;
SELECT 'prepared_not_activated_by_installation' AS migration_state,
 (SELECT count(*) FROM ps_roster_private.control WHERE enabled) AS explicitly_activated_workspaces;
