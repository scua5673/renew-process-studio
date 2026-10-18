-- 20261014_admin_actions_view 확인(읽기 전용)
-- 기대: fn true · secdef true · auth_exec true · anon_exec false · marker true
select to_regprocedure('public.ps_admin_actions_list(integer,bigint)') is not null fn,
       (select prosecdef from pg_proc where oid='public.ps_admin_actions_list(integer,bigint)'::regprocedure) secdef,
       has_function_privilege('authenticated','public.ps_admin_actions_list(integer,bigint)','execute') auth_exec,
       has_function_privilege('anon','public.ps_admin_actions_list(integer,bigint)','execute') anon_exec,
       obj_description('public.ps_admin_actions_list(integer,bigint)'::regprocedure,'pg_proc')='process-studio/admin-actions-view/20261014/v1' marker;
