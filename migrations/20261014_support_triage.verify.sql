-- 20261014_support_triage 확인(읽기 전용)
-- 기대: cols 2 · chk true · list_new true · list_old false · set_status true · stage true
--       auth_list true · auth_set true · auth_stage false · anon_list false · anon_set false · secdef true · marker 4
select (select count(*) from information_schema.columns where table_schema='public' and table_name='ps_support_reports' and column_name in ('fixed_in','closed_at')) cols,
       exists(select 1 from pg_constraint where conrelid='public.ps_support_reports'::regclass and conname='ps_support_reports_fixed_in_chk') chk,
       to_regprocedure('public.ps_support_list(integer,jsonb,text)') is not null list_new,
       to_regprocedure('public.ps_support_list(integer,jsonb)') is not null list_old,
       to_regprocedure('public.ps_support_set_status(uuid,text,text)') is not null set_status,
       to_regprocedure('public.ps_support_stage(uuid,text)') is not null stage,
       has_function_privilege('authenticated','public.ps_support_list(integer,jsonb,text)','execute') auth_list,
       has_function_privilege('authenticated','public.ps_support_set_status(uuid,text,text)','execute') auth_set,
       has_function_privilege('authenticated','public.ps_support_stage(uuid,text)','execute') auth_stage,
       has_function_privilege('anon','public.ps_support_list(integer,jsonb,text)','execute') anon_list,
       has_function_privilege('anon','public.ps_support_set_status(uuid,text,text)','execute') anon_set,
       (select bool_and(prosecdef) from pg_proc where oid in ('public.ps_support_list(integer,jsonb,text)'::regprocedure,'public.ps_support_set_status(uuid,text,text)'::regprocedure,'public.ps_support_reply(uuid,uuid,text)'::regprocedure)) secdef,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and obj_description(p.oid,'pg_proc')='process-studio/support-triage/20261014/v1') marker;
