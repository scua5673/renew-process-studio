-- 20261007_incident_ledger 확인(읽기 전용)
-- 기대: rls true · policies 0 · anon/authenticated 표 권한 없음 · 함수 5 · 관리자 RPC 3 은 SECURITY DEFINER · 심은 사고 3
select (select relrowsecurity from pg_class where oid='public.ps_incidents'::regclass) rls,
       (select count(*) from pg_policy where polrelid='public.ps_incidents'::regclass) policies,
       has_table_privilege('authenticated','public.ps_incidents','select') auth_select,
       has_table_privilege('anon','public.ps_incidents','select') anon_select,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname in ('ps_incident_counts','ps_incident_drop','ps_admin_incidents','ps_admin_incident_add','ps_admin_incident_del')) functions,
       (select bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname in ('ps_admin_incidents','ps_admin_incident_add','ps_admin_incident_del')) admin_secdef,
       (select count(*) from public.ps_incidents where seed_key is not null) seeded;
