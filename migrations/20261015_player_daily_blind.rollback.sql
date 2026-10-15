-- 20261015_player_daily_blind 되돌리기 — 표식이 붙은 두 키만 차단목록에서 뺀다(함수의 나머지는 그대로).
-- 표식이 없으면(적용 전이거나 이미 되돌림) 건너뛴다. 바꿀 자리가 정확히 한 번이 아니면 멈춘다.
BEGIN;
DO $rollback$
DECLARE
  d text; nd text; n int;
  r constant text := $re$\s*,\s*'cs_idp_daily_v1'\s*,\s*'cs_idp_pub_v1'\s*/\* ps-20261015-player-daily-blind \*/$re$;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_read_key(uuid,text)'));
  IF d IS NULL OR position('ps-20261015-player-daily-blind' in d) = 0 THEN
    RAISE NOTICE '20261015 rollback: ps_can_read_key 에 적용 표식 없음 — 건너뜀'; RETURN;
  END IF;
  SELECT count(*) INTO n FROM regexp_matches(d, r, 'g');
  IF n <> 1 THEN
    RAISE EXCEPTION '20261015 rollback: ps_can_read_key 정의가 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', n;
  END IF;
  nd := regexp_replace(d, r, '');
  EXECUTE nd;
  RAISE NOTICE '20261015 rollback: ps_can_read_key 되돌림';
END
$rollback$;
COMMIT;
