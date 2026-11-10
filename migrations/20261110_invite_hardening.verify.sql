-- 20261110_invite_hardening 확인(읽기 전용). 결과 한 줄: invite_hardening_verified
DO $verify$
DECLARE f text; o regprocedure; pol text; c text;
BEGIN
  FOREACH f IN ARRAY array['ps_join(text,text)','ps_kv_team_guard()','ps_create_invite(uuid)','ps_get_or_create_invite(uuid)','ps_get_or_create_role_invite(uuid,text)','ps_regenerate_invite(uuid)','ps_regenerate_role_invite(uuid,text)','ps_bootstrap(text)','ps_create_team(text,text)','ps_invite_code()','ps_invite_entry(text)','ps_perms_authorised_doc(uuid,uuid,jsonb)'] LOOP
    o := to_regprocedure('public.'||f);
    IF o IS NULL THEN RAISE EXCEPTION 'verify: public.% 이 없습니다', f; END IF;
    IF NOT (SELECT p.prosrc LIKE '%ps-20261110-invite%' FROM pg_proc p WHERE p.oid = o) THEN RAISE EXCEPTION 'verify: public.% 이 새 본문이 아닙니다', f; END IF;
  END LOOP;
  FOREACH f IN ARRAY array['ps_invite_code()','ps_invite_entry(text)','ps_perms_authorised_doc(uuid,uuid,jsonb)'] LOOP
    IF has_function_privilege('anon', 'public.'||f, 'EXECUTE') OR has_function_privilege('authenticated', 'public.'||f, 'EXECUTE')
       OR has_function_privilege('public', 'public.'||f, 'EXECUTE') THEN
      RAISE EXCEPTION 'verify: 안쪽 함수 public.% 을 클라이언트 역할이 실행할 수 있습니다', f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY array['ps_join(text,text)','ps_get_or_create_role_invite(uuid,text)','ps_regenerate_role_invite(uuid,text)','ps_bootstrap(text)','ps_create_team(text,text)'] LOOP
    IF NOT has_function_privilege('authenticated', 'public.'||f, 'EXECUTE') THEN RAISE EXCEPTION 'verify: authenticated 가 public.% 을 실행하지 못합니다(앱이 멈춘다)', f; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%gen_random_uuid()::text,''-'',''''),1,8)%') > 0 THEN
    RAISE EXCEPTION 'verify: 8자 코드를 만드는 함수가 남아 있습니다';
  END IF;
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO pol FROM pg_policy p WHERE p.polrelid = 'public.ps_invites'::regclass AND p.polname = 'inv_sel';
  IF pol IS DISTINCT FROM 'ps_is_owner(workspace_id)' THEN RAISE EXCEPTION 'verify: inv_sel 이 소유자 전용이 아닙니다(%)', pol; END IF;
  IF to_regclass('public.ps_join_attempts') IS NULL THEN RAISE EXCEPTION 'verify: ps_join_attempts 가 없습니다'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ps_join_attempts'::regclass) THEN RAISE EXCEPTION 'verify: ps_join_attempts 에 행 단위 보안이 꺼져 있습니다'; END IF;
  IF has_table_privilege('anon', 'public.ps_join_attempts', 'SELECT') OR has_table_privilege('authenticated', 'public.ps_join_attempts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ps_join_attempts', 'INSERT') THEN
    RAISE EXCEPTION 'verify: 클라이언트 역할이 ps_join_attempts 에 닿습니다';
  END IF;
  c := public.ps_invite_code();
  IF c !~ '^[0-9A-HJKMNP-TV-Z]{12}$' THEN RAISE EXCEPTION 'verify: 새 코드 모양이 다릅니다(%)', c; END IF;
  IF public.ps_invite_entry('staff')->>'role' <> 'staff' OR public.ps_invite_entry('x')->>'role' <> 'player' THEN RAISE EXCEPTION 'verify: ps_invite_entry 판정이 다릅니다'; END IF;
  IF EXISTS (SELECT 1 FROM public.ps_invites WHERE expires_at IS NULL) THEN RAISE EXCEPTION 'verify: 만료일 없는 코드가 남아 있습니다'; END IF;
END
$verify$;
SELECT 'invite_hardening_verified' AS result;
