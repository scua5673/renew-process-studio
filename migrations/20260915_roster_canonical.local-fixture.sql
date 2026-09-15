-- LOCAL PGLITE LAYER ONLY. Never execute against an existing database.
-- The runner first loads 20260913_scout_write_scope.local-fixture.sql, whose
-- membership, JWT, table, grant and non-IDP policy definitions are reused.
-- That older fixture deliberately omits these roster key-scope branches.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,auth TO anon;
CREATE OR REPLACE FUNCTION public.ps_key_scope(key text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN key='cs_scout_targets_v1' THEN 'scout'
    WHEN key LIKE 'sq:%' OR key IN (
      'scout_tool_v1','cs_squad_v1','cs_team_attrs_v1','cs_player_del_v1',
      'cs_team_notice_v1') THEN 'team'
    ELSE NULL END
$$;
-- Installation must deliberately grant client RPC access and must not inherit
-- accidental privileges on its private activation/idempotency/permit tables.
ALTER DEFAULT PRIVILEGES GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated,anon;
ALTER DEFAULT PRIVILEGES GRANT USAGE,SELECT ON SEQUENCES TO authenticated,anon;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
