-- SYNTHETIC IN-MEMORY DATABASE ONLY. Apply after admin_operations.local-fixture.sql.
-- This layer supplies the catalog-confirmed role source without changing the shared admin fixture.
ALTER TABLE public.ps_workspaces ADD COLUMN kind text NOT NULL DEFAULT 'team';
ALTER TABLE public.ps_kv DROP CONSTRAINT ps_kv_pkey;
ALTER TABLE public.ps_kv ADD COLUMN workspace_id uuid NOT NULL;
ALTER TABLE public.ps_kv ADD PRIMARY KEY(workspace_id,k);
CREATE FUNCTION public.ps_is_owner(wid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_members m WHERE m.workspace_id=wid AND m.user_id=auth.uid() AND m.role='owner')
$$;
CREATE FUNCTION public.ps_team_role(wid uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE pj jsonb; knd text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'none'; END IF;
  SELECT kind INTO knd FROM public.ps_workspaces WHERE id=wid;
  IF knd IS NULL OR knd='personal' THEN RETURN 'admin'; END IF;
  IF public.ps_is_owner(wid) THEN RETURN 'admin'; END IF;
  BEGIN SELECT v::jsonb INTO pj FROM public.ps_kv WHERE workspace_id=wid AND k='cs_perms_v1' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN pj:=null; END;
  IF pj IS NULL THEN RETURN 'admin'; END IF;
  RETURN coalesce(pj->'members'->(auth.uid()::text)->>'role',pj->>'defaultRole','staff');
END $$;
