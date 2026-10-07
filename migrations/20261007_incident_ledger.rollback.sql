-- 20261007_incident_ledger 되돌리기 — 함수 다섯과 기록장 표를 지운다.
-- ⚠ 기록장(ps_incidents)에 사람이 적은 사고 기록도 함께 지워진다. 남기려면 먼저:
--   select * from public.ps_incidents order by at;   (결과를 저장해 둘 것)
BEGIN;
DROP FUNCTION IF EXISTS public.ps_admin_incident_del(bigint);
DROP FUNCTION IF EXISTS public.ps_admin_incident_add(text,text,text,uuid,timestamptz);
DROP FUNCTION IF EXISTS public.ps_admin_incidents(int);
DROP FUNCTION IF EXISTS public.ps_incident_drop(text,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.ps_incident_counts(text,text);
DROP TABLE IF EXISTS public.ps_incidents;
NOTIFY pgrst, 'reload schema';
COMMIT;
