-- SYNTHETIC IN-MEMORY DATABASE ONLY. Never execute against any existing database.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE TABLE public.ps_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.ps_workspaces(id uuid PRIMARY KEY,name text NOT NULL);
CREATE TABLE public.ps_members(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),role text NOT NULL DEFAULT 'member',PRIMARY KEY(workspace_id,user_id));
-- Existing helper bodies were confirmed by root's read-only production catalog.
CREATE FUNCTION public.ps_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_admins a WHERE a.user_id=auth.uid())
$$;
CREATE FUNCTION public.ps_is_member(wid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_members m WHERE m.workspace_id=wid AND m.user_id=auth.uid())
$$;
-- Unrelated table sentinels; not replicas of production contents or policies.
CREATE TABLE public.ps_kv(k text PRIMARY KEY,v text);
CREATE TABLE public.ps_events(event_name text);
ALTER TABLE public.ps_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_kv ON public.ps_kv TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_events ON public.ps_events TO authenticated USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_kv,public.ps_events TO authenticated;
-- Test that installation removes inherited client access on NEW objects only.
ALTER DEFAULT PRIVILEGES GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated,anon;
ALTER DEFAULT PRIVILEGES GRANT USAGE,SELECT ON SEQUENCES TO authenticated,anon;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
