-- 20261110_invite_hardening 사전 점검(읽기 전용 — select 와 예외뿐). 적용 전에 SQL 편집기에서 돌린다.
-- 운영이 이 묶음의 가정과 다르면 예외로 멈춘다(그러면 .sql 도 같은 이유로 멈춘다). 통과하면 숫자 한 줄을 돌려준다 — runbook 의 기대값과 견준다.
DO $pre$
DECLARE f text; want text; got text; done boolean; o regprocedure; n_done integer := 0; n_old integer := 0; pol text;
BEGIN
  FOR f, want IN SELECT * FROM (VALUES
    ('ps_join(text,text)','38673f83cec7589422be907f33fee3ef'),
    ('ps_kv_team_guard()','72cee1272442a9eeb47a83f72049bce3'),
    ('ps_create_invite(uuid)','45a6621a322caf9a44884ffd6c11eecc'),
    ('ps_get_or_create_invite(uuid)','72c3dca3f32294417189ff3061f9e519'),
    ('ps_get_or_create_role_invite(uuid,text)','0559d53318b05ad0126bc9f2840f9297'),
    ('ps_regenerate_invite(uuid)','00aeb6ec9c627ad282bc90b53238e50f'),
    ('ps_regenerate_role_invite(uuid,text)','4cf27e9a62a9b7dbbadba9ff6a08a543'),
    ('ps_bootstrap(text)','24b4f8c755d70092eba39d41463ae5a6'),
    ('ps_create_team(text,text)','b7814c6697f8c1d9c499036259cb0266')
  ) AS t(sig, md) LOOP
    o := to_regprocedure('public.'||f);
    IF o IS NULL THEN RAISE EXCEPTION '20261110_invite preflight: public.% 이 없습니다 — 아무것도 바꾸지 않았습니다', f; END IF;
    SELECT md5(p.prosrc), p.prosrc LIKE '%ps-20261110-invite%' INTO got, done FROM pg_proc p WHERE p.oid = o;
    IF done THEN n_done := n_done + 1;
    ELSIF got = want THEN n_old := n_old + 1;
    ELSE RAISE EXCEPTION '20261110_invite preflight: public.% 본문이 2026-10-27 기준본과 다릅니다(md5 % ≠ %) — 누가 고쳤는지 먼저 봅니다. 아무것도 바꾸지 않았습니다', f, got, want; END IF;
  END LOOP;
  IF n_done > 0 AND n_old > 0 THEN RAISE EXCEPTION '20261110_invite preflight: 일부만 적용된 상태입니다(적용 % · 옛것 %) — rollback.sql 뒤 다시 적용합니다', n_done, n_old; END IF;
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO pol FROM pg_policy p WHERE p.polrelid = 'public.ps_invites'::regclass AND p.polname = 'inv_sel' AND p.polcmd = 'r';
  IF pol IS NULL OR pol NOT IN ('ps_is_member(workspace_id)', 'ps_is_owner(workspace_id)') THEN
    RAISE EXCEPTION '20261110_invite preflight: ps_invites 정책 inv_sel 이 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', coalesce(pol, '없음');
  END IF;
  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION '20261110_invite preflight: extensions.gen_random_bytes 가 없습니다(pgcrypto 위치가 다름) — 아무것도 바꾸지 않았습니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.ps_kv'::regclass AND t.tgname = 'ps_kv_team_guard_t' AND t.tgenabled <> 'D')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.ps_kv'::regclass AND t.tgname = 'ps_kv_team_guard_insert_t' AND t.tgenabled <> 'D') THEN
    RAISE EXCEPTION '20261110_invite preflight: ps_kv 의 가드 트리거(ps_kv_team_guard_t · _insert_t)가 없거나 꺼져 있습니다 — 아무것도 바꾸지 않았습니다';
  END IF;
  IF (SELECT a.atttypid FROM pg_attribute a WHERE a.attrelid = 'public.ps_members'::regclass AND a.attname = 'joined_at') IS DISTINCT FROM 'timestamptz'::regtype THEN
    RAISE EXCEPTION '20261110_invite preflight: ps_members.joined_at 이 timestamptz 가 아닙니다 — 아무것도 바꾸지 않았습니다';
  END IF;
  RAISE NOTICE '20261110_invite preflight: 가정과 같습니다(이미 적용된 함수 % · 옛 함수 %)', n_done, n_old;
END
$pre$;
SELECT
  (SELECT enforce FROM public.ps_guard_mode WHERE id = 1)                                                             AS guard_enforce,
  (SELECT pg_get_expr(p.polqual, p.polrelid) FROM pg_policy p WHERE p.polrelid = 'public.ps_invites'::regclass AND p.polname = 'inv_sel') AS inv_sel,
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%ps-20261110-invite%') AS applied_functions,
  (SELECT count(*) FROM public.ps_invites WHERE expires_at IS NULL OR expires_at > now())                             AS live_codes,
  (SELECT count(*) FROM public.ps_invites WHERE member_role IN ('staff','executive') AND (expires_at IS NULL OR expires_at > now())) AS live_staff_exec_codes,
  (SELECT count(*) FROM public.ps_invites WHERE expires_at IS NULL)                                                   AS codes_without_expiry,
  (SELECT count(*) FROM public.ps_invites WHERE char_length(code) < 12 AND (expires_at IS NULL OR expires_at > now())) AS live_short_codes,
  (SELECT count(*) FROM public.ps_invites i WHERE i.code <> translate(upper(btrim(i.code)), 'OIL', '011') AND (i.expires_at IS NULL OR i.expires_at > now())) AS live_codes_new_join_cannot_match,
  (SELECT count(*) FROM public.ps_workspaces w WHERE w.kind = 'team'
      AND NOT EXISTS (SELECT 1 FROM public.ps_kv k WHERE k.workspace_id = w.id AND k.k = 'cs_perms_v1'))              AS teams_without_perms_doc,
  (SELECT count(*) FROM public.ps_kv k WHERE k.k = 'cs_perms_v1'
      AND coalesce(public.ps_try_jsonb(k.v)->>'defaultRole', 'player') <> 'player')                                   AS teams_default_role_not_player,
  (SELECT count(*) FROM public.ps_members m JOIN auth.users u ON u.id = m.user_id
    WHERE m.email LIKE '%@%' AND lower(m.email) IS DISTINCT FROM lower(u.email::text))                                AS member_email_differs_from_auth,
  (SELECT count(*) FROM public.ps_members m WHERE m.email IS NOT NULL AND m.email NOT LIKE '%@%')                     AS member_email_is_a_name,
  (SELECT count(*) FROM public.ps_kv_denied d WHERE d.k = 'cs_perms_v1' AND d.reason LIKE '권한은 운영진만%' AND d.at > now() - interval '30 days') AS perms_denials_30d;
