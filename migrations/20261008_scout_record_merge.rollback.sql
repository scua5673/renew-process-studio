-- 20261008_scout_record_merge 되돌리기 — 트리거와 함수만 지운다(데이터·다른 가드는 그대로).
-- 지운 뒤에는 낡은 사본 저장이 빠뜨린 기록 날이 다시 그대로 사라진다(20261006 가드는 칸이 통째로 빠질 때만 막는다).
BEGIN;
DROP TRIGGER IF EXISTS ps_00d_scout_record_merge_t ON public.ps_kv;
DROP FUNCTION IF EXISTS public.ps_kv_scout_record_merge();
DROP FUNCTION IF EXISTS public.ps_srm_merge_injury(jsonb,jsonb);
DROP FUNCTION IF EXISTS public.ps_srm_merge_days(jsonb,jsonb);
DROP FUNCTION IF EXISTS public.ps_srm_merge_runs(jsonb,jsonb);
DROP FUNCTION IF EXISTS public.ps_srm_days(jsonb);
DROP FUNCTION IF EXISTS public.ps_srm_at(jsonb);
DROP FUNCTION IF EXISTS public.ps_srm_obj(jsonb);
COMMIT;
