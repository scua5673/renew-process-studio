-- 20260930_staff_view_only 확인(읽기 전용). 결과 한 줄: staff_view_only_verified
DO $verify$
DECLARE d text;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'));
  IF d IS NULL OR (SELECT count(*) FROM regexp_matches(d, 'ps-20260930-staff-view', 'g')) <> 2 THEN RAISE EXCEPTION 'verify: 표식이 둘이 아닙니다'; END IF;
  IF d ~* $re$if\s+r\s*=\s*'staff'\s+then\s+return\s+true\s*;$re$ THEN RAISE EXCEPTION 'verify: 스태프 무조건 허용이 남아 있습니다'; END IF;
  IF position('schedEdit' in d) > position('scl :=' in d) THEN RAISE EXCEPTION 'verify: 일정 줄이 구역 확인보다 뒤에 있습니다'; END IF;
  IF position('ps-20260930-idp-pub-write' in d) = 0 THEN RAISE EXCEPTION 'verify: 코치 피드백 줄(20260930_idp_pub_write)이 사라졌습니다'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.ps_can_write_key(uuid,text)')) THEN RAISE EXCEPTION 'verify: SECURITY DEFINER 가 풀렸습니다'; END IF;
END
$verify$;
SELECT 'staff_view_only_verified' AS result;
