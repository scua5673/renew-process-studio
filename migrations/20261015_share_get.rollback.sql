-- 20261015_share_get 되돌리기 — 테이블 SELECT 를 되돌려 주고 함수를 지운다. 3.041 앱은 함수가 없으면 옛 GET 으로 돌아가므로 링크는 계속 열린다.
BEGIN;
DO $rb$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'GRANT SELECT ON TABLE public.ps_share TO anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'GRANT SELECT ON TABLE public.ps_share TO authenticated'; END IF;
END $rb$;
DROP FUNCTION IF EXISTS public.ps_share_get(text);
COMMIT;
