-- 20261008_scout_record_merge 확인(읽기 전용)
-- 기대: merge_trigger O · 앞 가드(ps_00c_scout_record_guard_t) 다음 순서 · secdef true · 순수 함수 6
--       그리고 아래 합성 견줌(실제 행은 안 읽는다): runs_lost 2 · days_lost 1 · inj_lost 1 · keep_null true
select (select tgenabled::text from pg_trigger where tgrelid='public.ps_kv'::regclass and tgname='ps_00d_scout_record_merge_t') merge_trigger,
       (select string_agg(tgname::text, ' < ' order by tgname) from pg_trigger
         where tgrelid='public.ps_kv'::regclass and not tgisinternal and tgname like 'ps_00%') order_00,
       (select prosecdef from pg_proc where proname='ps_kv_scout_record_merge' and pronamespace='public'::regnamespace) secdef,
       (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'ps_srm_%') pure_fns,
       (public.ps_srm_merge_runs('{"p1":[{"s":"ok","from":"2026-10-01","to":"2026-10-03"}]}',
                                 '{"p1":[{"s":"rest","from":"2026-10-03","to":"2026-10-03"}]}')->>'lost') runs_lost,
       (public.ps_srm_merge_days('{"2026-10-01":{"p1":{"s":"ok","at":5}}}','{"2026-10-01":{"p1":{"s":"rest","at":3}}}')->>'lost') days_lost,
       (public.ps_srm_merge_injury('{"p1":{"2026-10-01":{"part":"발목","at":5}}}','{}')->>'lost') inj_lost,
       (public.ps_srm_merge_runs('{"p1":[{"s":"ok","from":"2026-10-01","to":"2026-10-01"}]}',
                                 '{"p1":[{"s":"ok","from":"2026-10-01","to":"2026-10-02"}]}') is null) keep_null;
