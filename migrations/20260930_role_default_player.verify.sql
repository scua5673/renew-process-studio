-- 20260930_role_default_player 확인(읽기 전용). 결과 한 줄: role_default_player_verified
DO $verify$
DECLARE r text; v text;
BEGIN
  r := pg_get_functiondef(to_regprocedure('public.ps_team_role(uuid)'));
  v := pg_get_functiondef(to_regprocedure('public.ps_idp_can_view(uuid)'));
  IF r IS NULL OR v IS NULL THEN RAISE EXCEPTION 'verify: 함수가 없습니다'; END IF;
  IF (SELECT count(*) FROM regexp_matches(r, 'ps-20260930-role-default', 'g')) <> 2 THEN RAISE EXCEPTION 'verify: ps_team_role 표식이 둘이 아닙니다'; END IF;
  IF (SELECT count(*) FROM regexp_matches(v, 'ps-20260930-role-default', 'g')) <> 2 THEN RAISE EXCEPTION 'verify: ps_idp_can_view 표식이 둘이 아닙니다'; END IF;
  IF r ~* $re$'defaultRole'\s*,\s*'staff'$re$ OR v ~* $re$'defaultRole'\s*,\s*'staff'$re$ THEN RAISE EXCEPTION 'verify: staff 기본값이 남아 있습니다'; END IF;
  IF r ~* $re$if\s+pj\s+is\s+null\s+then\s+return\s+'admin'$re$ THEN RAISE EXCEPTION 'verify: 권한표 없음 = admin 이 남아 있습니다'; END IF;
  IF v ~* $re$if\s+pj\s+is\s+null\s+then\s+return\s+true$re$ THEN RAISE EXCEPTION 'verify: 권한표 없음 = 열람 가능이 남아 있습니다'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.ps_team_role(uuid)'))
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.ps_idp_can_view(uuid)')) THEN
    RAISE EXCEPTION 'verify: SECURITY DEFINER 가 풀렸습니다';
  END IF;
END
$verify$;
SELECT 'role_default_player_verified' AS result;
