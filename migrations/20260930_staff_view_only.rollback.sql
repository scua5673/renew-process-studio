-- 20260930_staff_view_only 되돌리기 — 끼운 일정 줄을 빼고 스태프 줄을 원래대로(return true). 표식이 없으면 건너뛴다.
BEGIN;
DO $rollback$
DECLARE d text; nd text;
  sched_line constant text := E'if key = ''process_coach_v1'' and r = ''staff'' and coalesce(pj->>''schedEdit'','''') = ''staff'' then return true; end if;  /* ps-20260930-staff-view sched */\n ';
  staff_line constant text := E'if r = ''staff'' then return coalesce(pj->>''staffEdit'',''view'') = ''edit'' and sc is distinct from ''scout''; end if;  /* ps-20260930-staff-view */';
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'));
  IF d IS NULL OR position('ps-20260930-staff-view' in d) = 0 THEN RAISE NOTICE '20260930 staff_view rollback: 표식 없음 — 건너뜀'; RETURN; END IF;
  IF position(sched_line in d) = 0 OR position(staff_line in d) = 0 THEN RAISE EXCEPTION '20260930 staff_view rollback: 줄 모양이 다릅니다 — 아무것도 바꾸지 않았습니다'; END IF;
  nd := replace(replace(d, sched_line, ''), staff_line, 'if r = ''staff'' then return true; end if;');
  EXECUTE nd;
  RAISE NOTICE '20260930 staff_view rollback: 되돌림';
END
$rollback$;
COMMIT;
