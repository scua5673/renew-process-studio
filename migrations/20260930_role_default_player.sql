-- 20260930_role_default_player — 서버 역할 기본값을 앱과 같게('player')
-- ---------------------------------------------------------------------------
-- 문제: 앱(perms.js myRole·sync.js)은 권한표에 내 역할이 없고 defaultRole 도 없으면 «선수»,
--       팀 공간에 권한표(cs_perms_v1)가 아예 없으면 소유자 말고는 «선수»로 본다.
--       서버는 두 경우를 각각 «스태프» / «관리자»(ps_team_role), «열람 가능»(ps_idp_can_view)으로 봤다.
--       그래서 역할 없이 들어온 계정은 화면에서는 가려져도 네트워크로
--         · 팀 민감 문서(선수단·스카우트·경기 명단 — ps_can_read_key)
--         · 다른 선수의 개인 IDP·코치 피드백(kv_sel_idp·kv_sel_pub — ps_idp_can_view)
--         · 비공개가 아닌 보관함(ps_library — ps_idp_can_view)
--       을 받을 수 있었다. 권한표가 없는 팀의 비소유자는 서버에서 관리자라 팀 자료를 쓸 수도 있었다.
--
-- 고침: 라이브 정의를 그 자리에서 읽어(pg_get_functiondef) **기본값 두 줄만** 바꿔 다시 만든다.
--   ps_team_role    : coalesce(…,'staff') → 'player' · 권한표 없음 'admin' → 'player'
--   ps_idp_can_view : coalesce(…,'staff') → 'player' · 권한표 없음 true → false
--   소유자·개인 공간·명시한 역할·defaultRole 은 그대로다. 함수 이름·인자·SECURITY DEFINER·search_path·
--   권한(GRANT)·소유자는 CREATE OR REPLACE 라 그대로 남는다. 정책·테이블·데이터는 건드리지 않는다.
--
-- 안전장치: 바꿀 줄이 **정확히 한 번씩** 있어야 한다. 아니면 아무것도 바꾸지 않고 멈춘다(EXCEPTION).
--           이미 적용된 함수(표식 ps-20260930-role-default)는 건너뛴다 — 다시 실행해도 안전하다.
-- 되돌리기: 20260930_role_default_player.rollback.sql
-- ---------------------------------------------------------------------------
BEGIN;

DO $migration$
DECLARE
  fn   text;
  d    text;
  nd   text;
  n1   int;
  n2   int;
  mark constant text := 'ps-20260930-role-default';
  p_default constant text := $re$(->>\s*'defaultRole'\s*,\s*)'staff'$re$;
  p_missing_role constant text := $re$(if\s+pj\s+is\s+null\s+then\s+return\s+)'admin'$re$;
  p_missing_view constant text := $re$(if\s+pj\s+is\s+null\s+then\s+return\s+)true$re$;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.ps_team_role(uuid)','public.ps_idp_can_view(uuid)'] LOOP
    d := pg_get_functiondef(to_regprocedure(fn));
    IF d IS NULL THEN
      RAISE EXCEPTION '20260930: % 함수가 없습니다 — 아무것도 바꾸지 않았습니다', fn;
    END IF;
    IF position(mark in d) > 0 THEN
      RAISE NOTICE '20260930: % 는 이미 적용됨 — 건너뜀', fn;
      CONTINUE;
    END IF;

    SELECT count(*) INTO n1 FROM regexp_matches(d, p_default, 'gi');
    IF fn = 'public.ps_team_role(uuid)' THEN
      SELECT count(*) INTO n2 FROM regexp_matches(d, p_missing_role, 'gi');
    ELSE
      SELECT count(*) INTO n2 FROM regexp_matches(d, p_missing_view, 'gi');
    END IF;
    IF n1 <> 1 OR n2 <> 1 THEN
      RAISE EXCEPTION '20260930: % 의 정의가 예상과 다릅니다(기본값 줄 %개, 권한표 없음 줄 %개) — 아무것도 바꾸지 않았습니다', fn, n1, n2;
    END IF;

    nd := regexp_replace(d, p_default, '\1''player'' /* ' || mark || ' */', 'i');
    IF fn = 'public.ps_team_role(uuid)' THEN
      nd := regexp_replace(nd, p_missing_role, '\1''player'' /* ' || mark || ' */', 'i');
    ELSE
      nd := regexp_replace(nd, p_missing_view, '\1false /* ' || mark || ' */', 'i');
    END IF;
    EXECUTE nd;
    RAISE NOTICE '20260930: % 적용', fn;
  END LOOP;
END
$migration$;

COMMIT;
