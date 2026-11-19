-- 20261119_roster_growth_guard 적용 확인(읽기 전용). 어긋나면 예외.
DO $v$
DECLARE got text; acl text;
BEGIN
  SELECT md5(p.prosrc) INTO got FROM pg_proc p WHERE p.oid='public.ps_kv_shape_guard()'::regprocedure;
  IF got IS DISTINCT FROM 'f22408fca66fdc49063a4cb09c2655e4' THEN RAISE EXCEPTION '20261119_roster_growth_guard verify: 본문 md5 % ≠ f22408fca66fdc49063a4cb09c2655e4', got; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid='public.ps_kv_shape_guard()'::regprocedure AND p.prosecdef AND p.proconfig = ARRAY['search_path=public']) THEN
    RAISE EXCEPTION '20261119_roster_growth_guard verify: SECURITY DEFINER · search_path 가 바뀌었습니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.ps_kv'::regclass AND t.tgname='ps_00b_shape_guard_t' AND t.tgenabled='O') THEN
    RAISE EXCEPTION '20261119_roster_growth_guard verify: 트리거 ps_00b_shape_guard_t 가 없거나 꺼져 있습니다';
  END IF;
END $v$;
SELECT 'ok' AS verify, md5(p.prosrc) AS body_md5 FROM pg_proc p WHERE p.oid='public.ps_kv_shape_guard()'::regprocedure;
