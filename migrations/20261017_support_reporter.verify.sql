-- 20261017_support_reporter 확인(읽기 전용)
-- 기대: reporter true · wired_inbox true · wired_get true · auth_reporter false · anon_reporter false
--       auth_inbox true · auth_get true · anon_inbox false · secdef true · marker 1 · triage_marker 5
select to_regprocedure('public.ps_support_reporter(uuid)') is not null reporter,
       pg_get_functiondef('public.ps_support_inbox(integer,jsonb,text)'::regprocedure) like '%ps_support_reporter(r.reporter_id)%' wired_inbox,
       pg_get_functiondef('public.ps_support_get(uuid)'::regprocedure) like '%ps_support_reporter(r.reporter_id)%' wired_get,
       has_function_privilege('authenticated','public.ps_support_reporter(uuid)','execute') auth_reporter,
       has_function_privilege('anon','public.ps_support_reporter(uuid)','execute') anon_reporter,
       has_function_privilege('authenticated','public.ps_support_inbox(integer,jsonb,text)','execute') auth_inbox,
       has_function_privilege('authenticated','public.ps_support_get(uuid)','execute') auth_get,
       has_function_privilege('anon','public.ps_support_inbox(integer,jsonb,text)','execute') anon_inbox,
       (select bool_and(prosecdef) from pg_proc where oid in ('public.ps_support_reporter(uuid)'::regprocedure,'public.ps_support_inbox(integer,jsonb,text)'::regprocedure,'public.ps_support_get(uuid)'::regprocedure)) secdef,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and obj_description(p.oid,'pg_proc')='process-studio/support-reporter/20261017/v1') marker,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and obj_description(p.oid,'pg_proc')='process-studio/support-triage/20261014/v1') triage_marker;
