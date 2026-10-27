select to_regprocedure('auth.uid()') is not null as auth_ready,
  exists(select 1 from pg_roles where rolname='anon') as anon_ready,
  exists(select 1 from pg_roles where rolname='authenticated') as authenticated_ready,
  to_regclass('public.ps_letter_issues') as existing_issues,
  to_regclass('public.ps_letter_readers') as existing_readers;
