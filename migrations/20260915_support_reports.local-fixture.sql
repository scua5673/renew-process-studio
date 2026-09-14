-- SYNTHETIC IN-MEMORY DATABASE ONLY. Never run against an existing database.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE TABLE public.ps_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE public.ps_members(user_id uuid PRIMARY KEY,role text NOT NULL);
CREATE FUNCTION public.ps_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.ps_admins WHERE user_id=auth.uid())
$$;
CREATE TABLE public.ps_kv(k text PRIMARY KEY,v text);
ALTER TABLE public.ps_kv ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_kv ON public.ps_kv TO authenticated USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_kv TO authenticated;
-- Hostile inherited defaults prove installation revokes all direct access.
ALTER DEFAULT PRIVILEGES GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated,anon;
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO authenticated,anon;
