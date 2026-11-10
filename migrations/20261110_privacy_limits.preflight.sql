-- 20261110_privacy_limits 사전 점검(읽기 전용 — select 와 예외뿐). 적용 전에 SQL 편집기에서 돌린다.
-- 운영이 이 묶음의 가정과 다르면 예외로 멈춘다(그러면 .sql 도 같은 이유로 멈춘다). 통과하면 결과 표 셋을 돌려준다 — runbook 의 기대값과 견준다.
DO $pre$
DECLARE f text; want text; got text; done boolean; o regprocedure; n_done integer := 0; n_old integer := 0; pol text; bad text; top bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.ps_join(text,text)') AND p.prosrc LIKE '%ps-20261110-invite%')
     OR to_regclass('public.ps_join_attempts') IS NULL THEN
    RAISE EXCEPTION '20261110_privacy preflight: 20261110_invite_hardening 이 먼저 적용돼 있어야 합니다 — 아무것도 바꾸지 않았습니다';
  END IF;
  FOR f, want IN SELECT * FROM (VALUES
    ('ps_members_of(uuid)','e82b6d80cea7ed303f6e6a4635169644'),
    ('ps_members_of_v2(uuid)','55a6d6153e8149efdb2dc3c054cd2321'),
    ('ps_delete_my_data()','3ef6dd93d0b7240592a47ffb5e88874f'),
    ('ps_support_reporter_devices(uuid,integer)','84ba8f30d501258abd33ff308c715a04'),
    ('ps_admin_stale_clients(integer,integer)','16ef34e1d66bfa8b5fa6da5f1ef6fa27'),
    ('ps_perms_authorised_doc(uuid,uuid,jsonb)','04c5563859b6d777de1f6e3b86839d56')
  ) AS t(sig, md) LOOP
    o := to_regprocedure('public.'||f);
    IF o IS NULL THEN RAISE EXCEPTION '20261110_privacy preflight: public.% 이 없습니다 — 아무것도 바꾸지 않았습니다', f; END IF;
    SELECT md5(p.prosrc), p.prosrc LIKE '%ps-20261110-privacy%' INTO got, done FROM pg_proc p WHERE p.oid = o;
    IF done THEN n_done := n_done + 1;
    ELSIF got = want THEN n_old := n_old + 1;
    ELSE RAISE EXCEPTION '20261110_privacy preflight: public.% 본문이 예상(기준본 · 20261028 · 20261110_invite)과 다릅니다(md5 % ≠ %) — 아무것도 바꾸지 않았습니다', f, got, want; END IF;
  END LOOP;
  IF n_done > 0 AND n_old > 0 THEN RAISE EXCEPTION '20261110_privacy preflight: 일부만 적용된 상태입니다(적용 % · 옛것 %) — rollback.sql 뒤 다시 적용합니다', n_done, n_old; END IF;
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO pol FROM pg_policy p WHERE p.polrelid = 'public.ps_members'::regclass AND p.polname = 'mem_sel' AND p.polcmd = 'r';
  IF pol IS NULL OR pol NOT IN ('ps_is_member(workspace_id)', $q$(ps_is_member(workspace_id) AND ((user_id = auth.uid()) OR (ps_team_role(workspace_id) = ANY (ARRAY['admin'::text, 'executive'::text]))))$q$) THEN
    RAISE EXCEPTION '20261110_privacy preflight: ps_members 정책 mem_sel 이 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', coalesce(pol, '없음');
  END IF;
  -- 같은 표에 이 묶음이 모르는 트리거가 있으면(누가 먼저 다른 가드를 달았다) 멈춘다
  SELECT string_agg(t.tgrelid::regclass::text || '.' || t.tgname, ', ') INTO bad FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.ps_err'::regclass, 'public.ps_comm_reports'::regclass, 'public.ps_blob'::regclass, 'public.ps_workspaces'::regclass)
     AND t.tgname NOT IN ('ps_err_guard_t', 'ps_comm_report_guard_t', 'ps_blob_guard_t', 'ps_workspace_fixed_guard_t');
  IF bad IS NOT NULL THEN RAISE EXCEPTION '20261110_privacy preflight: 예상 밖 트리거가 있습니다(%) — 아무것도 바꾸지 않았습니다', bad; END IF;
  -- 아래는 처음 적용할 때만 본다(적용 뒤에는 상한 안에서 많이 쓴 날이 있어도 다시 돌릴 수 있어야 한다)
  IF n_done = 0 THEN
  -- 상한이 정상 사용을 막지 않는다는 가정: 최근 30일 가장 많이 쓴 날이 상한의 절반 아래
  SELECT max(c) INTO top FROM (SELECT count(*) c FROM public.ps_blob b WHERE b.created_at > now() - interval '30 days' AND b.created_by IS NOT NULL GROUP BY b.created_by, date_trunc('day', b.created_at)) s;
  IF coalesce(top, 0) >= 750 THEN RAISE EXCEPTION '20261110_privacy preflight: 한 사람이 하루에 그림 %개를 올린 날이 있습니다(상한 1,500 의 절반 이상) — 상한을 다시 정합니다. 아무것도 바꾸지 않았습니다', top; END IF;
  SELECT max(c) INTO top FROM (SELECT count(*) c FROM public.ps_err e WHERE e.t > now() - interval '30 days' GROUP BY date_trunc('day', e.t)) s;
  IF coalesce(top, 0) >= 2500 THEN RAISE EXCEPTION '20261110_privacy preflight: 오류 기록이 하루 %줄인 날이 있습니다(상한 5,000 의 절반 이상) — 상한을 다시 정합니다. 아무것도 바꾸지 않았습니다', top; END IF;
  SELECT max(c) INTO top FROM (SELECT count(*) c FROM public.ps_comm_reports r WHERE r.at > now() - interval '30 days' GROUP BY coalesce(r.reporter::text, 'anon'), date_trunc('day', r.at)) s;
  IF coalesce(top, 0) >= 15 THEN RAISE EXCEPTION '20261110_privacy preflight: 한 사람(또는 비로그인 합계)이 하루 %건 신고한 날이 있습니다(상한 30 의 절반 이상) — 상한을 다시 정합니다. 아무것도 바꾸지 않았습니다', top; END IF;
  -- 최근 7일의 이벤트가 새 검사를 어기면(= 지금 도는 앱이 그런 값을 보낸다) 멈춘다
  SELECT count(*) INTO top FROM public.ps_events e WHERE e.created_at > now() - interval '7 days'
     AND (octet_length(e.meta::text) > 8192 OR (e.app_version IS NOT NULL AND e.app_version !~ '^[A-Za-z0-9_.+-]{1,24}$') OR char_length(e.workspace_id) > 64);
  IF top > 0 THEN RAISE EXCEPTION '20261110_privacy preflight: 최근 7일 ps_events %줄이 새 검사(meta 8KB · app_version 모양 · workspace_id 64자)를 어깁니다 — 아무것도 바꾸지 않았습니다', top; END IF;
  SELECT count(*) INTO top FROM public.ps_err e WHERE e.t > now() - interval '30 days'
     AND (char_length(e.kind) > 40 OR char_length(e.msg) > 2000 OR char_length(e.src) > 300 OR char_length(e.page) > 300 OR char_length(e.ua) > 400);
  IF top > 0 THEN RAISE EXCEPTION '20261110_privacy preflight: 최근 30일 ps_err %줄이 새 길이 검사를 어깁니다 — 아무것도 바꾸지 않았습니다', top; END IF;
  END IF;
  RAISE NOTICE '20261110_privacy preflight: 가정과 같습니다(이미 적용된 함수 % · 옛 함수 %)', n_done, n_old;
END
$pre$;

-- ① 숫자 한 줄
SELECT
  (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%ps-20261110-privacy%')   AS applied_functions,
  (SELECT block_unversioned FROM public.ps_app_policy WHERE id = 1)                                                        AS block_unversioned,
  (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron')                                                            AS pg_cron_installed,
  (SELECT count(*) FROM public.ps_members m WHERE nullif(btrim(m.name), '') IS NULL AND (m.email IS NULL OR m.email LIKE '%@%')) AS members_shown_without_name_to_players,
  (SELECT count(*) FROM public.ps_workspaces w WHERE w.kind <> 'personal'
      AND NOT EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.role = 'owner'))                  AS teams_without_owner_member,
  (SELECT count(*) FROM public.ps_workspaces w WHERE w.kind <> 'personal'
      AND NOT EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.user_id = w.owner_id))            AS teams_whose_owner_id_is_not_a_member,
  (SELECT count(*) FROM public.ps_workspaces w WHERE w.kind <> 'personal'
      AND EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.user_id <> w.owner_id)
      AND EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.user_id = w.owner_id))                AS teams_whose_owner_cannot_self_delete,
  (SELECT count(*) FROM public.ps_err)                                                                                     AS err_rows,
  (SELECT coalesce(max(c), 0) FROM (SELECT count(*) c FROM public.ps_err e WHERE e.t > now() - interval '30 days' GROUP BY date_trunc('day', e.t)) s) AS err_max_per_day_30d,
  (SELECT count(*) FROM public.ps_err e WHERE e.t < now() - interval '90 days')                                            AS err_rows_older_than_90d,
  (SELECT coalesce(max(c), 0) FROM (SELECT count(*) c FROM public.ps_blob b WHERE b.created_at > now() - interval '30 days' GROUP BY b.created_by, date_trunc('day', b.created_at)) s) AS blob_max_per_user_day_30d,
  (SELECT count(*) FROM public.ps_comm_reports r WHERE r.reporter IS NULL)                                                 AS reports_without_reporter,
  (SELECT coalesce(max(octet_length(e.meta::text)), 0) FROM public.ps_events e)                                            AS events_meta_max_bytes,
  (SELECT max(e.app_version::numeric) FROM public.ps_events e WHERE e.created_at > now() - interval '48 hours' AND e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$') AS latest_version_plain_max,
  (SELECT max(v) FROM (SELECT e.app_version::numeric v FROM public.ps_events e WHERE e.created_at > now() - interval '48 hours' AND e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$'
                        GROUP BY 1 HAVING count(DISTINCT e.user_id) >= 3) s)                                               AS latest_version_3_users;

-- ② anon 이 지금 쥔 표 권한과, 로그인 없는 흐름이 실제로 쓰는 것(«쓰는 것» 밖의 INSERT · UPDATE · DELETE 와 모든 TRUNCATE · REFERENCES · TRIGGER · MAINTAIN 을 거둔다)
SELECT g.table_name,
       string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type) AS anon_now,
       CASE g.table_name
         WHEN 'ps_err'          THEN 'INSERT — studio/storage.js 오류 기록(늘 anon 키)'
         WHEN 'ps_comm_reports' THEN 'INSERT — studio/community.html 신고(비로그인 가능)'
         WHEN 'ps_community'    THEN 'SELECT — 커뮤니티 읽기'
         WHEN 'ps_comm_likes'   THEN 'SELECT — 좋아요 표시'
         WHEN 'ps_handles'      THEN 'SELECT — 아이디 표시'
         ELSE '없음(RPC 만: ps_share_get · ps_letter_* · ps_comm_view/copied)' END AS used_without_login,
       (SELECT string_agg(p.polname, ', ') FROM pg_policy p WHERE p.polrelid = ('public.'||g.table_name)::regclass
          AND (p.polroles = '{0}' OR 'anon'::regrole = ANY (p.polroles)))                                                   AS policies_that_include_anon
  FROM information_schema.role_table_grants g
 WHERE g.table_schema = 'public' AND g.grantee = 'anon'
 GROUP BY g.table_name ORDER BY g.table_name;

-- ③ 주인 없는 팀(자동으로 지우지 않는다 — 소유자가 보고 정한다). 이름 · 인원 · 자료 양 · 마지막 쓰기만.
SELECT w.id, w.name, w.created_at, w.owner_id,
       (SELECT count(*) FROM public.ps_members m WHERE m.workspace_id = w.id)                              AS members,
       EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.role = 'owner')         AS has_owner_member,
       EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id)                                         AS owner_account_exists,
       (SELECT count(*) FROM public.ps_kv k WHERE k.workspace_id = w.id)                                   AS docs,
       (SELECT count(*) FROM public.ps_library l WHERE l.workspace_id = w.id)                              AS library_items,
       (SELECT max(k.updated_at) FROM public.ps_kv k WHERE k.workspace_id = w.id)                          AS last_write
  FROM public.ps_workspaces w
 WHERE w.kind <> 'personal'
   AND (NOT EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.role = 'owner')
        OR NOT EXISTS (SELECT 1 FROM public.ps_members m WHERE m.workspace_id = w.id AND m.user_id = w.owner_id))
 ORDER BY last_write DESC NULLS LAST;
