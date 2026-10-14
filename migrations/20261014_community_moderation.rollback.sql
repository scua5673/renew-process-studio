-- 20261014_community_moderation 되돌리기 — 읽기 정책을 예전(NOT deleted)으로, 트리거 · 관리자 함수는 지운다.
-- ⚠ 정책이 예전으로 돌아가면 숨겼던 글이 다시 모두에게 보인다.
-- 칸(hidden_* · resolved_*)과 값은 남긴다. 칸까지 지우려면 맨 아래 주석을 풀 것.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER POLICY comm_sel ON public.ps_community USING (NOT deleted);
DROP TRIGGER IF EXISTS ps_comm_moderation_guard_t ON public.ps_community;
DROP FUNCTION IF EXISTS public.ps_comm_moderation_guard();
DROP FUNCTION IF EXISTS public.ps_admin_comm_queue(integer);
DROP FUNCTION IF EXISTS public.ps_admin_comm_hide(text,boolean,text);
DROP FUNCTION IF EXISTS public.ps_admin_comm_resolve(text);
-- ALTER TABLE public.ps_community DROP CONSTRAINT IF EXISTS ps_community_hidden_reason_chk, DROP COLUMN IF EXISTS hidden_at, DROP COLUMN IF EXISTS hidden_by, DROP COLUMN IF EXISTS hidden_reason;
-- ALTER TABLE public.ps_comm_reports DROP COLUMN IF EXISTS resolved_at, DROP COLUMN IF EXISTS resolved_by;
NOTIFY pgrst,'reload schema';
COMMIT;
