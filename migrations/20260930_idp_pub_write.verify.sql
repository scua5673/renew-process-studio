-- 20260930_idp_pub_write 확인(읽기 전용). 결과 한 줄: idp_pub_write_verified
DO $verify$
DECLARE d text;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'));
  IF d IS NULL OR (SELECT count(*) FROM regexp_matches(d, 'ps-20260930-idp-pub-write', 'g')) <> 1 THEN RAISE EXCEPTION 'verify: 표식이 하나가 아닙니다'; END IF;
  IF position('ps_idp_can_view(wid)' in d) = 0 THEN RAISE EXCEPTION 'verify: IDP 열람 판정 줄이 없습니다'; END IF;
  IF position('ps_idp_can_view(wid)' in d) < position('ps_is_member' in d) THEN RAISE EXCEPTION 'verify: 구성원 확인보다 앞에 있습니다'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.ps_can_write_key(uuid,text)')) THEN RAISE EXCEPTION 'verify: SECURITY DEFINER 가 풀렸습니다'; END IF;
END
$verify$;
SELECT 'idp_pub_write_verified' AS result;
