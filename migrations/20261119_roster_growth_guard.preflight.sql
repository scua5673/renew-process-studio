-- 20261119_roster_growth_guard 사전 점검(읽기 전용 — select 와 예외뿐). 적용 전에 돌린다.
-- 운영이 이 묶음의 가정과 다르면 예외로 멈춘다. 통과하면 결과 표 하나 — runbook 의 기대값과 견준다.
DO $pre$
DECLARE got text; done boolean; trg text;
BEGIN
  IF to_regprocedure('public.ps_kv_shape_guard()') IS NULL THEN RAISE EXCEPTION '20261119_roster_growth_guard preflight: public.ps_kv_shape_guard() 이 없습니다 — 아무것도 바꾸지 않았습니다'; END IF;
  SELECT md5(p.prosrc), p.prosrc LIKE '%ps-20261119-roster-growth%' INTO got, done FROM pg_proc p WHERE p.oid = 'public.ps_kv_shape_guard()'::regprocedure;
  IF NOT done AND got <> 'fd40ab18d81f34de23f9dd578724c7ee' THEN
    RAISE EXCEPTION '20261119_roster_growth_guard preflight: ps_kv_shape_guard 본문이 예상(기준본)과 다릅니다(md5 %) — 아무것도 바꾸지 않았습니다', got;
  END IF;
  SELECT pg_get_triggerdef(t.oid) INTO trg FROM pg_trigger t WHERE t.tgrelid = 'public.ps_kv'::regclass AND t.tgname = 'ps_00b_shape_guard_t' AND NOT t.tgisinternal;
  IF trg IS NULL OR trg NOT LIKE '%BEFORE UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION ps_kv_shape_guard()%' THEN
    RAISE EXCEPTION '20261119_roster_growth_guard preflight: 트리거 ps_00b_shape_guard_t 가 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', coalesce(trg, '없음');
  END IF;
END $pre$;

SELECT (SELECT p.prosrc LIKE '%ps-20261119-roster-growth%' FROM pg_proc p WHERE p.oid='public.ps_kv_shape_guard()'::regprocedure) AS already_applied,
       (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid='public.ps_kv_shape_guard()'::regprocedure) AS body_md5,
       (SELECT enforce FROM public.ps_guard_mode WHERE id=1) AS guard_enforce,
       (SELECT count(*) FROM public.ps_kv_denied WHERE reason LIKE '%불어나는%' AND at > now() - interval '30 days') AS growth_denials_30d,
       (SELECT count(DISTINCT workspace_id) FROM public.ps_kv_denied WHERE reason LIKE '%불어나는%' AND at > now() - interval '30 days') AS growth_denied_teams_30d;
