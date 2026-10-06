-- 20261006_scout_record_guard 확인(읽기 전용) — 기대: guard_t O · enabled O · secdef true · 앞뒤 가드 순서 00a·00b·00c
select string_agg(t.tgname::text||':'||t.tgenabled::text, ' · ' order by t.tgname) triggers,
       (select p.prosecdef from pg_proc p join pg_namespace s on s.oid=p.pronamespace
         where s.nspname='public' and p.proname='ps_kv_scout_record_guard') secdef,
       (select count(*) from pg_proc p join pg_namespace s on s.oid=p.pronamespace
         where s.nspname='public' and p.proname='ps_kv_note_denied') note_fn
  from pg_trigger t
 where t.tgrelid='public.ps_kv'::regclass and not t.tgisinternal and t.tgname like 'ps_00%';
