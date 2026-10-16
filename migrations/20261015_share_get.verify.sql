-- 20261015_share_get 확인(읽기 전용). 결과 한 줄: share_get_verified
DO $verify$
BEGIN
  IF to_regprocedure('public.ps_share_get(text)') IS NULL THEN RAISE EXCEPTION 'verify: ps_share_get(text) 가 없습니다'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.ps_share_get(text)')) THEN RAISE EXCEPTION 'verify: SECURITY DEFINER 가 아닙니다'; END IF;
  IF (SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid=to_regprocedure('public.ps_share_get(text)')) NOT LIKE '%search_path%' THEN RAISE EXCEPTION 'verify: search_path 고정이 없습니다'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') AND has_table_privilege('anon','public.ps_share','SELECT') THEN RAISE EXCEPTION 'verify: anon 이 아직 ps_share 를 SELECT 할 수 있습니다'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AND has_table_privilege('authenticated','public.ps_share','SELECT') THEN RAISE EXCEPTION 'verify: authenticated 가 아직 ps_share 를 SELECT 할 수 있습니다'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') AND NOT has_function_privilege('anon','public.ps_share_get(text)','EXECUTE') THEN RAISE EXCEPTION 'verify: anon 이 ps_share_get 을 부를 수 없습니다(링크가 안 열림)'; END IF;
END
$verify$;
SELECT 'share_get_verified' AS result;
