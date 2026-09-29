-- 20260930_role_default_player 되돌리기 — 표식이 붙은 두 줄씩만 원래 값으로('staff' / 'admin' / true).
-- 표식이 없으면(적용 전이거나 이미 되돌림) 건너뛴다. 바꿀 줄이 정확히 한 번씩이 아니면 멈춘다.
BEGIN;
DO $rollback$
DECLARE
  fn text; d text; nd text; n1 int; n2 int;
  r_default constant text := $re$(->>\s*'defaultRole'\s*,\s*)'player' /\* ps-20260930-role-default \*/$re$;
  r_role    constant text := $re$(if\s+pj\s+is\s+null\s+then\s+return\s+)'player' /\* ps-20260930-role-default \*/$re$;
  r_view    constant text := $re$(if\s+pj\s+is\s+null\s+then\s+return\s+)false /\* ps-20260930-role-default \*/$re$;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.ps_team_role(uuid)','public.ps_idp_can_view(uuid)'] LOOP
    d := pg_get_functiondef(to_regprocedure(fn));
    IF d IS NULL OR position('ps-20260930-role-default' in d) = 0 THEN
      RAISE NOTICE '20260930 rollback: % 에 적용 표식 없음 — 건너뜀', fn; CONTINUE;
    END IF;
    SELECT count(*) INTO n1 FROM regexp_matches(d, r_default, 'gi');
    IF fn = 'public.ps_team_role(uuid)' THEN SELECT count(*) INTO n2 FROM regexp_matches(d, r_role, 'gi');
    ELSE SELECT count(*) INTO n2 FROM regexp_matches(d, r_view, 'gi'); END IF;
    IF n1 <> 1 OR n2 <> 1 THEN
      RAISE EXCEPTION '20260930 rollback: % 정의가 예상과 다릅니다(%/%) — 아무것도 바꾸지 않았습니다', fn, n1, n2;
    END IF;
    nd := regexp_replace(d, r_default, '\1''staff''', 'i');
    IF fn = 'public.ps_team_role(uuid)' THEN nd := regexp_replace(nd, r_role, '\1''admin''', 'i');
    ELSE nd := regexp_replace(nd, r_view, '\1true', 'i'); END IF;
    EXECUTE nd;
    RAISE NOTICE '20260930 rollback: % 되돌림', fn;
  END LOOP;
END
$rollback$;
COMMIT;
