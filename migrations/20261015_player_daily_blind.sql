-- 20261015_player_daily_blind — 선수 계정에 팀원의 일일 몸 상태(cs_idp_daily_v1)와 옛 공개 IDP 키(cs_idp_pub_v1)를 내려 주지 않는다
-- ---------------------------------------------------------------------------
-- 문제: ps_can_read_key 는 «선수가 못 보는 키»를 차단목록으로 든다
--         ('scout_tool_v1','cs_squad_v1','cs_meet_sit_v1','cs_match_v1','cs_match_roster_v1').
--       cs_idp_daily_v1(코치가 적는 선수별 부상·재활·불참 — 미성년 선수의 건강 정보)은 목록에 없어, 선수 계정이 평소 동기화만으로
--       팀원 전체의 상태를 받았다. 접미사 없는 옛 cs_idp_pub_v1 도 같은 이유로 열려 있었다.
--       security.html 의 «선수끼리는 서로 볼 수 없음»과 어긋난다(2026-10-14 보안 점검 SEC-3).
--
-- 고침: 라이브 정의를 그 자리에서 읽어(pg_get_functiondef) 차단목록 한 줄만 늘려 다시 만든다.
--   NOT IN ('scout_tool_v1', … ,'cs_match_roster_v1') → NOT IN (… ,'cs_match_roster_v1','cs_idp_daily_v1','cs_idp_pub_v1' /* 표식 */)
--   다른 줄·함수 이름·인자·SECURITY DEFINER·search_path·권한(GRANT)·소유자는 CREATE OR REPLACE 라 그대로 남는다.
--   정책·테이블·데이터는 건드리지 않는다. 앱의 같은 목록(studio/sync.js PLAYER_BLIND)은 3.034 에서 cs_idp_daily_v1 을 더했다.
--   선수가 자기 상태를 봐야 하면 본인 uid 행만 돌려주는 RPC 를 따로 둔다(지금 앱은 선수 화면에서 이 키를 읽지 않는다 — idp.html saveDaily 는 isCoach 전용).
--
-- 안전장치: 바꿀 목록이 **정확히 한 번** 있어야 한다. 아니면 아무것도 바꾸지 않고 멈춘다(EXCEPTION).
--           이미 적용된 함수(표식 ps-20261015-player-daily-blind)는 건너뛴다 — 다시 실행해도 안전하다.
-- 확인: 20261015_player_daily_blind.verify.sql · 되돌리기: 20261015_player_daily_blind.rollback.sql
-- ---------------------------------------------------------------------------
BEGIN;

DO $migration$
DECLARE
  d    text;
  nd   text;
  n    int;
  mark constant text := 'ps-20261015-player-daily-blind';
  p_list constant text := $re$('scout_tool_v1'\s*,\s*'cs_squad_v1'\s*,\s*'cs_meet_sit_v1'\s*,\s*'cs_match_v1'\s*,\s*'cs_match_roster_v1')\)$re$;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_read_key(uuid,text)'));
  IF d IS NULL THEN
    RAISE EXCEPTION '20261015: public.ps_can_read_key(uuid,text) 함수가 없습니다 — 아무것도 바꾸지 않았습니다';
  END IF;
  IF position(mark in d) > 0 THEN
    RAISE NOTICE '20261015: ps_can_read_key 는 이미 적용됨 — 건너뜀';
    RETURN;
  END IF;

  SELECT count(*) INTO n FROM regexp_matches(d, p_list, 'g');
  IF n <> 1 THEN
    RAISE EXCEPTION '20261015: ps_can_read_key 의 차단목록이 예상과 다릅니다(%개) — 아무것도 바꾸지 않았습니다', n;
  END IF;

  nd := regexp_replace(d, p_list, '\1,''cs_idp_daily_v1'',''cs_idp_pub_v1'' /* ' || mark || ' */)');
  EXECUTE nd;
  RAISE NOTICE '20261015: ps_can_read_key 적용';
END
$migration$;

COMMIT;
