-- 20261014_admin_actions_view 되돌리기 — 읽기 함수 하나만 지운다(기록 표 ps_admin_actions 는 그대로).
BEGIN;
DROP FUNCTION IF EXISTS public.ps_admin_actions_list(integer,bigint);
NOTIFY pgrst,'reload schema';
COMMIT;
