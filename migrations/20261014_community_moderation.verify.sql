-- 20261014_community_moderation 확인(읽기 전용)
-- 기대: cols 5 · trig true · sel_hides true · funcs 3 · secdef true · auth_exec true · anon_exec false · guard_exec false
select (select count(*) from information_schema.columns where table_schema='public'
          and ((table_name='ps_community' and column_name in ('hidden_at','hidden_by','hidden_reason')) or (table_name='ps_comm_reports' and column_name in ('resolved_at','resolved_by')))) cols,
       exists(select 1 from pg_trigger where tgrelid='public.ps_community'::regclass and tgname='ps_comm_moderation_guard_t' and tgenabled<>'D') trig,
       (select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.ps_community'::regclass and polname='comm_sel') like '%hidden_at IS NULL%' sel_hides,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ps_admin_comm_queue','ps_admin_comm_hide','ps_admin_comm_resolve')) funcs,
       (select bool_and(prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ps_admin_comm_queue','ps_admin_comm_hide','ps_admin_comm_resolve')) secdef,
       has_function_privilege('authenticated','public.ps_admin_comm_hide(text,boolean,text)','execute') auth_exec,
       has_function_privilege('anon','public.ps_admin_comm_hide(text,boolean,text)','execute') anon_exec,
       has_function_privilege('authenticated','public.ps_comm_moderation_guard()','execute') guard_exec;
