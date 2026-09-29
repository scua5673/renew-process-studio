-- 20260930_idp_pub_write 되돌리기 — 끼운 한 줄만 뺀다. 없으면 건너뛴다.
BEGIN;
DO $rollback$
DECLARE d text; line constant text := E'\n  if left(key,14) = ''cs_idp_pub_v1_'' then return public.ps_idp_can_view(wid); end if;  /* ps-20260930-idp-pub-write */';
BEGIN
  d := pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)'));
  IF d IS NULL OR position('ps-20260930-idp-pub-write' in d) = 0 THEN RAISE NOTICE '20260930 idp_pub rollback: 표식 없음 — 건너뜀'; RETURN; END IF;
  IF position(line in d) = 0 THEN RAISE EXCEPTION '20260930 idp_pub rollback: 끼운 줄 모양이 다릅니다 — 아무것도 바꾸지 않았습니다'; END IF;
  EXECUTE replace(d, line, '');
  RAISE NOTICE '20260930 idp_pub rollback: 되돌림';
END
$rollback$;
COMMIT;
