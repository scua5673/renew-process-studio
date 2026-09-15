-- Additive privacy boundary for live boards. No data is copied or deleted.
-- Only a personal workspace's owner, who is still its member, may use either key.
-- Fresh installation only; review preflight output before an operational apply.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('public.ps_kv') IS NULL OR to_regclass('public.ps_workspaces') IS NULL
 OR to_regclass('public.ps_members') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
   RAISE EXCEPTION 'Required workspace schema is missing' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='public.ps_kv'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_workspaces'::regclass AND attname='id' AND atttypid='uuid'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_workspaces'::regclass AND attname='kind' AND atttypid='text'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_workspaces'::regclass AND attname='owner_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_members'::regclass AND attname='workspace_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_members'::regclass AND attname='user_id' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN
   RAISE EXCEPTION 'Required owner columns or RLS differ from reviewed schema' USING ERRCODE='55000'; END IF;
 -- These two SECURITY DEFINER history readers bypass ps_kv RLS. Only the exact
 -- catalog-reviewed bodies may receive the narrow key predicate below.
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('public.ps_kv_history_get(uuid,bigint)') AND md5(prosrc)='bc15db7508fd9065c0739031bb3a068b')
 OR NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure('public.ps_kv_history_list(uuid,text,integer)') AND md5(prosrc)='0dfcc022d34f4016d9845afc29a5cc03') THEN
   RAISE EXCEPTION 'History RPC source differs from reviewed catalog' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT FROM pg_policy WHERE polrelid='public.ps_kv'::regclass AND polname IN ('ps_private_board_owner_v1','ps_private_board_role_v1'))
 OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ps_private_board_owner_v1') THEN
   RAISE EXCEPTION 'Private board objects already exist; inspect before proceeding' USING ERRCODE='55000'; END IF;
END $$;

CREATE FUNCTION public.ps_private_board_owner_v1(p_wid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.ps_workspaces w JOIN public.ps_members m
   ON m.workspace_id=w.id AND m.user_id=auth.uid()
   WHERE w.id=p_wid AND w.kind='personal' AND w.owner_id=auth.uid()
 )
$$;
REVOKE ALL ON FUNCTION public.ps_private_board_owner_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_private_board_owner_v1(uuid) TO authenticated;

-- RESTRICTIVE adds an AND to existing permissive policies. The role gate uses
-- the real DB role, not a caller-controlled setting or claimed JWT role. Separate
-- policies let anonymous queries keep their old unrelated-key behavior without
-- granting anon EXECUTE on a SECURITY DEFINER helper (permissions are checked
-- even for an unexecuted CASE branch).
CREATE POLICY ps_private_board_role_v1 ON public.ps_kv AS RESTRICTIVE FOR ALL TO PUBLIC
USING (k NOT IN ('cs_private_board_v1','cs_board_live_v1') OR pg_has_role(current_user,'authenticated','USAGE'))
WITH CHECK (k NOT IN ('cs_private_board_v1','cs_board_live_v1') OR pg_has_role(current_user,'authenticated','USAGE'));
CREATE POLICY ps_private_board_owner_v1 ON public.ps_kv AS RESTRICTIVE FOR ALL TO authenticated
USING (k NOT IN ('cs_private_board_v1','cs_board_live_v1') OR public.ps_private_board_owner_v1(workspace_id))
WITH CHECK (k NOT IN ('cs_private_board_v1','cs_board_live_v1') OR public.ps_private_board_owner_v1(workspace_id));
COMMENT ON POLICY ps_private_board_role_v1 ON public.ps_kv IS
 'Live boards require the real authenticated DB role; unrelated key policies are unchanged. 20260915_private_board';
COMMENT ON POLICY ps_private_board_owner_v1 ON public.ps_kv IS
 'Live boards are personal-owner-only; existing team originals are retained without client access. 20260915_private_board';
COMMENT ON FUNCTION public.ps_private_board_owner_v1(uuid) IS
 'Read-only personal workspace owner and membership check for restrictive live-board RLS. 20260915_private_board';

DO $$
DECLARE r record; updated_source text; updated_definition text; anchor text:='  where h.workspace_id = p_wid::text';
BEGIN
 FOR r IN SELECT p.*,pg_get_functiondef(p.oid) AS definition FROM pg_proc p
 WHERE p.oid IN ('public.ps_kv_history_get(uuid,bigint)'::regprocedure,'public.ps_kv_history_list(uuid,text,integer)'::regprocedure) LOOP
   IF (length(r.prosrc)-length(replace(r.prosrc,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'History predicate anchor differs' USING ERRCODE='55000'; END IF;
   updated_source:=replace(r.prosrc,anchor,anchor||E'\n    and (h.k not in (''cs_private_board_v1'',''cs_board_live_v1'') or public.ps_private_board_owner_v1(p_wid))');
   updated_definition:=replace(r.definition,r.prosrc,updated_source);
   EXECUTE updated_definition;
   IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=r.oid AND p.prosrc=updated_source
     AND p.proacl IS NOT DISTINCT FROM r.proacl AND p.proowner=r.proowner
     AND p.prosecdef=r.prosecdef AND p.proconfig IS NOT DISTINCT FROM r.proconfig
     AND p.proargtypes=r.proargtypes AND p.proallargtypes IS NOT DISTINCT FROM r.proallargtypes
     AND p.prorettype=r.prorettype AND p.proretset=r.proretset) THEN
     RAISE EXCEPTION 'History function identity or grants changed' USING ERRCODE='55000'; END IF;
 END LOOP;
END $$;
COMMIT;
