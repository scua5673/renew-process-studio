-- 20261122_support_context 검증(읽기 전용). SQL 편집기에서 한 번에 실행한다.
-- ① 존재 · 보안 속성 · 권한
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.provolatile as volatility,
       array_to_string(p.proconfig,',') as config,
       (select string_agg(grantee||':'||privilege_type, ',' order by grantee) from information_schema.routine_privileges r
         where r.specific_schema='public' and r.routine_name=p.proname) as grants
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('ps_support_context','ps_support_list_flags')
order by 1;
-- 기대: 두 줄 · security_definer true · volatility 's' · config search_path=pg_catalog · grants 에 anon/PUBLIC 없음(authenticated · service_role · postgres).

-- ② 관리자로 호출(운영자 계정 uuid · 제보 id 를 넣는다) — 모양만 본다.
-- with s as (select set_config('request.jwt.claims','{"sub":"<관리자 uuid>","role":"authenticated"}',true) c)
-- select jsonb_object_keys((select public.ps_support_context('<제보 id>'::uuid,30) from s));
-- 기대: report_at · minutes · events · sync · errors · fixed

-- ③ 관리자가 아닌 sub 는 거부되어야 한다(42501 support_not_admin).
-- with s as (select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated"}',true) c)
-- select (select public.ps_support_list_flags(array['<제보 id>'::uuid]) from s);
