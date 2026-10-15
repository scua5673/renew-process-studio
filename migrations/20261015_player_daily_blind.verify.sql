-- 20261015_player_daily_blind 확인(읽기 전용). 결과 한 줄: player_daily_blind_verified
DO $verify$
DECLARE d text; cfg text;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_read_key(uuid,text)'));
  IF d IS NULL THEN RAISE EXCEPTION 'verify: public.ps_can_read_key(uuid,text) 가 없습니다'; END IF;
  IF (SELECT count(*) FROM regexp_matches(d, 'ps-20261015-player-daily-blind', 'g')) <> 1 THEN RAISE EXCEPTION 'verify: 적용 표식이 하나가 아닙니다'; END IF;
  IF d !~ $re$'cs_match_roster_v1'\s*,\s*'cs_idp_daily_v1'\s*,\s*'cs_idp_pub_v1'$re$ THEN RAISE EXCEPTION 'verify: 차단목록에 cs_idp_daily_v1·cs_idp_pub_v1 이 없습니다'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.ps_can_read_key(uuid,text)')) THEN RAISE EXCEPTION 'verify: SECURITY DEFINER 가 풀렸습니다'; END IF;
  SELECT array_to_string(proconfig, ',') INTO cfg FROM pg_proc WHERE oid=to_regprocedure('public.ps_can_read_key(uuid,text)');
  IF cfg IS NULL OR cfg NOT LIKE '%search_path%' THEN RAISE EXCEPTION 'verify: search_path 고정이 풀렸습니다'; END IF;
END
$verify$;
SELECT 'player_daily_blind_verified' AS result;
