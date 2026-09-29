-- 20260930_staff_view_only — 서버도 «코칭스태프는 보기 전용»(1.634)을 지킨다 — 앱 sync.js canW 와 같은 규칙
-- ---------------------------------------------------------------------------
-- 문제: 운영 ps_can_write_key 는 개별 구역이 없는 스태프를 무조건 쓰기 허용했다(if r = 'staff' then return true).
--       앱은 cs_perms_v1.staffEdit = 'edit' 일 때만 쓰게 하므로, 보기 전용 규칙은 앱에서만 지켜졌다.
-- 고침(두 곳, 앱 규칙 그대로):
--   ① 스태프 기본값: staffEdit = 'edit' 일 때만, 스카우팅(scout) 구역은 제외(앱 staffIds 가 scout 을 뺀다)
--   ② 일정(process_coach_v1): 팀이 «스태프도 일정 편집»(schedEdit = 'staff')이면 스태프는 쓴다 — 개별 구역보다 먼저
--      (운영 ps_key_scope 는 이 키를 'board' 로 본다. ①만 바꾸면 그 설정을 켠 팀의 스태프 일정 저장이 막힌다)
--   임원·관리자·개별 구역 지정·선수·다른 키의 판정은 그대로다.
-- 안전장치: 바꿀 줄(스태프 = true)과 끼울 자리(scopes 읽는 줄)가 정확히 한 번씩이어야 한다. 표식이 있으면 건너뛴다.
-- 되돌리기: 20260930_staff_view_only.rollback.sql
-- ---------------------------------------------------------------------------
BEGIN;
DO $migration$
DECLARE d text; nd text; n1 int; n2 int;
  p_staff constant text := $re$if\s+r\s*=\s*'staff'\s+then\s+return\s+true\s*;\s*end\s+if\s*;$re$;
  p_scl   constant text := $re$(scl\s*:=\s*pj\s*->\s*'members'\s*->\s*\(auth\.uid\(\)::text\)\s*->\s*'scopes'\s*;)$re$;
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'));
  IF d IS NULL THEN RAISE EXCEPTION '20260930 staff_view: ps_can_write_key 가 없습니다'; END IF;
  IF position('ps-20260930-staff-view' in d) > 0 THEN RAISE NOTICE '20260930 staff_view: 이미 적용됨 — 건너뜀'; RETURN; END IF;
  SELECT count(*) INTO n1 FROM regexp_matches(d, p_staff, 'gi');
  SELECT count(*) INTO n2 FROM regexp_matches(d, p_scl, 'gi');
  IF n1 <> 1 OR n2 <> 1 THEN
    RAISE EXCEPTION '20260930 staff_view: 정의가 예상과 다릅니다(스태프 줄 %개, 구역 줄 %개) — 아무것도 바꾸지 않았습니다', n1, n2;
  END IF;
  nd := regexp_replace(d, p_scl, E'if key = ''process_coach_v1'' and r = ''staff'' and coalesce(pj->>''schedEdit'','''') = ''staff'' then return true; end if;  /* ps-20260930-staff-view sched */\n \\1', 'i');
  nd := regexp_replace(nd, p_staff, E'if r = ''staff'' then return coalesce(pj->>''staffEdit'',''view'') = ''edit'' and sc is distinct from ''scout''; end if;  /* ps-20260930-staff-view */', 'i');
  EXECUTE nd;
  RAISE NOTICE '20260930 staff_view: 적용';
END
$migration$;
COMMIT;
