-- 20261110_invite_hardening — 초대 코드 · 합류 · 멤버 이메일(보안 점검 2026-11-10 의 1 · 2 · 3번).
--   ① 초대 코드를 팀원 누구나 읽던 것(inv_sel = ps_is_member) → 소유자만. 앱은 표를 직접 읽지 않고 RPC 만 쓴다.
--      지금까지 모든 팀원에게 보였던 «스태프 · 임원» 코드는 이 적용에서 만료시킨다(선수 코드는 그대로 — 이미 팀원인 사람에게만 보였다).
--   ② ps_join: 이미 팀원이면 어떤 코드로 다시 들어와도 역할을 바꾸지 않는다(가드 스위치가 꺼져 있어도) · 멤버 행 없는 소유자는 소유자로 ·
--      새 사람의 역할은 초대 행의 역할 그대로 — 가드(ps_kv_team_guard)가 «이 트랜잭션에서 합류한 본인 항목 = 유효한 초대의 역할»을 직접 확인하고 통과시킨다.
--      (지금은 강제 모드에서 스태프 · 임원 코드로 들어와도 팀 기본 역할로 떨어진다 — runbook «지금 무엇이 깨져 있나».)
--   ③ 새 코드는 12자(Crockford 32글자 · gen_random_bytes · 60비트). 옛 8자 코드는 만료일까지 그대로 통한다. 만료일 없는 옛 코드는 30일 뒤로 둔다.
--      임원은 «선수» 코드만 받을 수 있다(ps_get_or_create_role_invite — 3.052 선수별 초대 링크). 나머지는 소유자만.
--   ④ 틀린 코드 · 만료 코드는 같은 답(null · HTTP 400), 15분에 10번 틀리면 15분 잠금(PT429) — 표 ps_join_attempts.
--   ⑤ ps_join · ps_bootstrap · ps_create_team 은 보낸 이메일(p_email)을 쓰지 않고 auth.users 의 이메일을 적는다(인자는 옛 앱 때문에 남긴다).
-- 멱등 · 한 트랜잭션. 운영 함수 본문이 2026-10-27 기준본(00000000_baseline.sql)과 다르면 예외로 멈추고 아무것도 바꾸지 않는다.
-- 근거 · 순서 · 기대 결과는 20261110_invite_hardening.runbook.md. 다음 묶음 20261110_privacy_limits 는 이 묶음 뒤에 적용한다.
BEGIN;
SET LOCAL lock_timeout = '5s';
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
    IF o IS NULL THEN RAISE EXCEPTION '20261110_invite: public.% 이 없습니다 — 아무것도 바꾸지 않았습니다', f; END IF;
    SELECT md5(p.prosrc), p.prosrc LIKE '%ps-20261110-invite%' INTO got, done FROM pg_proc p WHERE p.oid = o;
    IF done THEN n_done := n_done + 1;
    ELSIF got = want THEN n_old := n_old + 1;
    ELSE RAISE EXCEPTION '20261110_invite: public.% 본문이 2026-10-27 기준본과 다릅니다(md5 % ≠ %) — 누가 고쳤는지 먼저 봅니다. 아무것도 바꾸지 않았습니다', f, got, want; END IF;
  END LOOP;
  IF n_done > 0 AND n_old > 0 THEN RAISE EXCEPTION '20261110_invite: 일부만 적용된 상태입니다(적용 % · 옛것 %) — rollback.sql 뒤 다시 적용합니다', n_done, n_old; END IF;
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO pol FROM pg_policy p WHERE p.polrelid = 'public.ps_invites'::regclass AND p.polname = 'inv_sel' AND p.polcmd = 'r';
  IF pol IS NULL OR pol NOT IN ('ps_is_member(workspace_id)', 'ps_is_owner(workspace_id)') THEN
    RAISE EXCEPTION '20261110_invite: ps_invites 정책 inv_sel 이 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', coalesce(pol, '없음');
  END IF;
  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION '20261110_invite: extensions.gen_random_bytes 가 없습니다(pgcrypto 위치가 다름) — 아무것도 바꾸지 않았습니다';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.ps_kv'::regclass AND t.tgname = 'ps_kv_team_guard_t' AND t.tgenabled <> 'D')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.ps_kv'::regclass AND t.tgname = 'ps_kv_team_guard_insert_t' AND t.tgenabled <> 'D') THEN
    RAISE EXCEPTION '20261110_invite: ps_kv 의 가드 트리거(ps_kv_team_guard_t · _insert_t)가 없거나 꺼져 있습니다 — 아무것도 바꾸지 않았습니다';
  END IF;
  IF (SELECT a.atttypid FROM pg_attribute a WHERE a.attrelid = 'public.ps_members'::regclass AND a.attname = 'joined_at') IS DISTINCT FROM 'timestamptz'::regtype THEN
    RAISE EXCEPTION '20261110_invite: ps_members.joined_at 이 timestamptz 가 아닙니다 — 아무것도 바꾸지 않았습니다';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%ps-20261110-privacy%') THEN
    RAISE EXCEPTION '20261110_invite: 20261110_privacy_limits 가 이미 적용돼 있습니다 — 이 묶음을 다시 돌리면 그 묶음의 ps_perms_authorised_doc 을 덮습니다. 다시 돌릴 일이 있으면 privacy_limits 를 먼저 되돌립니다';
  END IF;
  -- 처음 적용인지(되돌릴 수 없는 «스태프 · 임원 코드 만료»는 처음 한 번만 한다)
  PERFORM set_config('ps.m20261110_invite_first', CASE WHEN n_done = 0 THEN '1' ELSE '0' END, true);
END
$pre$;

-- 실패한 합류 시도(사람마다 한 줄). 클라이언트는 읽지도 쓰지도 못한다 — ps_join(SECURITY DEFINER)만 쓴다.
create table if not exists public.ps_join_attempts (
  user_id      uuid primary key,
  fails        integer not null default 0 check (fails >= 0),
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.ps_join_attempts enable row level security;
revoke all on table public.ps_join_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.ps_join_attempts to service_role;
comment on table public.ps_join_attempts is '20261110 — 초대 코드 실패 횟수(15분 창 · 10번이면 15분 잠금). ps_join 만 쓴다. 하루 지난 줄은 ps_join 이 걷는다.';

-- 새 초대 코드: 12자 · Crockford 32글자(0-9 A-Z 에서 I L O U 뺌) · gen_random_bytes → 60비트. 256 = 8×32 라 치우침이 없다.
create or replace function public.ps_invite_code() returns text
language plpgsql volatile set search_path to 'public' as $function$
/* ps-20261110-invite */
declare alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; b bytea := extensions.gen_random_bytes(12); c text := '';
begin
  for i in 0..11 loop c := c || substr(alphabet, (get_byte(b, i) & 31) + 1, 1); end loop;
  return c;
end $function$;
revoke all on function public.ps_invite_code() from public, anon, authenticated;
grant execute on function public.ps_invite_code() to service_role;

-- 초대의 역할이 주는 본인 항목(예전 ps_join 과 같은 범위표).
create or replace function public.ps_invite_entry(p_role text) returns jsonb
language sql immutable set search_path to 'public' as $function$
  select jsonb_build_object(
    'role', case when p_role in ('staff','executive') then p_role else 'player' end,
    'scopes', case
      when p_role = 'executive' then '["board","schedule","team","scout","gamemodel","terms","note"]'::jsonb
      when p_role = 'staff'     then '["board","schedule","team","gamemodel","terms","note"]'::jsonb
      else '[]'::jsonb end);   /* ps-20261110-invite */
$function$;
revoke all on function public.ps_invite_entry(text) from public, anon, authenticated;
grant execute on function public.ps_invite_entry(text) to service_role;

-- 운영진이 아닌 사람(p_uid)이 권한 문서를 «이 판으로» 바꿔도 되는 서버 인정 경로. 없으면 null.
--   초대 합류: 트랜잭션 표식 ps.invite_join 의 코드가 이 팀의 유효한(만료 전) 초대 행이고, p_uid 의 멤버 행이 **바로 이 트랜잭션에서** 생겼을 때만
--             → 옛 문서 + (본인 항목 = 그 초대의 역할). 표식은 코드를 가리킬 뿐이라, 표식을 꾸며도 유효한 코드 없이는 아무것도 얻지 못하고
--             이미 팀원인 사람은(멤버 행이 이 트랜잭션에서 생긴 것이 아니므로) 유효한 코드를 알아도 역할을 못 바꾼다.
create or replace function public.ps_perms_authorised_doc(p_wid uuid, p_uid uuid, p_old jsonb) returns jsonb
language plpgsql stable set search_path to 'public' as $function$
/* ps-20261110-invite */
declare inv_code text := nullif(current_setting('ps.invite_join', true), ''); r text; doc jsonb;
begin
  if p_wid is null or p_uid is null or p_old is null or jsonb_typeof(p_old) is distinct from 'object' then return null; end if;
  if inv_code is null then return null; end if;
  select i.member_role into r from public.ps_invites i
   where i.code = inv_code and i.workspace_id = p_wid and (i.expires_at is null or i.expires_at > now());
  if r is null then return null; end if;
  if not exists (select 1 from public.ps_members m
                  where m.workspace_id = p_wid and m.user_id = p_uid and m.role <> 'owner' and m.joined_at = now()) then
    return null;
  end if;
  doc := p_old;
  if jsonb_typeof(doc->'members') is distinct from 'object' then doc := jsonb_set(doc, '{members}', '{}'::jsonb, true); end if;
  if not (doc ? 'defaultRole') then doc := jsonb_set(doc, '{defaultRole}', '"player"'::jsonb, true); end if;
  return jsonb_set(doc, array['members', p_uid::text], public.ps_invite_entry(r), true);
end $function$;
revoke all on function public.ps_perms_authorised_doc(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ps_perms_authorised_doc(uuid, uuid, jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.ps_create_invite(p_wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if not public.ps_is_owner(p_wid) then raise exception 'owner only'; end if;
  c := public.ps_invite_code();   /* ps-20261110-invite */
  insert into public.ps_invites(code, workspace_id, created_by, expires_at) values (c, p_wid, auth.uid(), now() + interval '30 days');
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_get_or_create_invite(p_wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if not public.ps_is_owner(p_wid) then raise exception 'owner only'; end if;
  select code into c from public.ps_invites
    where workspace_id = p_wid and (expires_at is null or expires_at > now())
    order by created_at desc limit 1;
  if c is not null then return c; end if;
  c := public.ps_invite_code();   /* ps-20261110-invite */
  insert into public.ps_invites(code, workspace_id, created_by, expires_at) values (c, p_wid, auth.uid(), now() + interval '30 days');
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_regenerate_invite(p_wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if not public.ps_is_owner(p_wid) then raise exception 'owner only'; end if;
  delete from public.ps_invites where workspace_id = p_wid;
  c := public.ps_invite_code();   /* ps-20261110-invite */
  insert into public.ps_invites(code, workspace_id, created_by, expires_at) values (c, p_wid, auth.uid(), now() + interval '30 days');
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_regenerate_role_invite(p_wid uuid, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text; r text;
begin
  if not public.ps_is_owner(p_wid) then raise exception 'owner only'; end if;
  r := lower(trim(coalesce(p_role,'')));
  if r not in ('player','staff','executive') then raise exception 'invalid role'; end if;
  delete from public.ps_invites where workspace_id = p_wid and member_role = r;
  c := public.ps_invite_code();   /* ps-20261110-invite */
  insert into public.ps_invites(code, workspace_id, created_by, expires_at, member_role)
    values (c, p_wid, auth.uid(), now() + interval '30 days', r);
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_get_or_create_role_invite(p_wid uuid, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text; r text;
begin
  r := lower(trim(coalesce(p_role,'')));
  if r not in ('player','staff','executive') then raise exception 'invalid role'; end if;
  -- 소유자는 세 역할 모두. 임원은 «선수» 코드만 받는다(3.052 선수별 초대 링크 — 명단에서 임원이 만든다). 스태프 · 임원 코드와 코드 바꾸기는 소유자만.
  if not (public.ps_is_owner(p_wid)
          or (r = 'player' and public.ps_is_member(p_wid) and public.ps_team_role(p_wid) = 'executive')) then
    raise exception 'owner only';
  end if;
  select code into c from public.ps_invites
    where workspace_id = p_wid and member_role = r
      and (expires_at is null or expires_at > now())
    order by created_at desc limit 1;
  if c is not null then return c; end if;
  c := public.ps_invite_code();   /* ps-20261110-invite */
  insert into public.ps_invites(code, workspace_id, created_by, expires_at, member_role)
    values (c, p_wid, auth.uid(), now() + interval '30 days', r);
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_join(p_code text, p_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* ps-20261110-invite */
-- p_email 은 옛 앱 때문에 받기만 한다 — 이메일은 auth.users 에서 읽는다.
-- 틀린 · 만료된 코드는 예외가 아니라 «null + HTTP 400»(response.status)으로 답한다: 예외는 트랜잭션을 되돌려 실패 횟수를 못 남긴다.
-- 15분 안에 10번 틀리면 15분 잠근다(PT429). 이미 팀원이면 어떤 코드로 다시 들어와도 역할은 그대로다.
declare
  me    uuid := auth.uid();
  c     text := translate(upper(btrim(coalesce(p_code,''))), 'OIL', '011');   -- 손으로 칠 때 헷갈리는 글자(O→0 · I,L→1)
  lim   constant integer  := 10;
  win   constant interval := interval '15 minutes';
  att   public.ps_join_attempts%rowtype;
  had   boolean;
  n     integer;
  ws    timestamptz;
  wid   uuid;
  r     text;
  owner uuid;
  mail  text;
  old_v text;
  pj    jsonb;
  doc   jsonb;
begin
  if me is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select * into att from public.ps_join_attempts a where a.user_id = me for update;
  had := found;
  if had and att.locked_until is not null and att.locked_until > now() then
    raise exception 'join_locked' using errcode = 'PT429', detail = 'too many failed invite codes', hint = 'retry in 15 minutes';
  end if;

  select i.workspace_id, i.member_role into wid, r
    from public.ps_invites i
   where i.code = c and (i.expires_at is null or i.expires_at > now());

  if wid is null then
    if had and att.window_start > now() - win then n := att.fails + 1; ws := att.window_start;
    else n := 1; ws := now(); end if;
    insert into public.ps_join_attempts as a (user_id, fails, window_start, locked_until, updated_at)
      values (me, n, ws, case when n >= lim then now() + win end, now())
    on conflict (user_id) do update
      set fails = excluded.fails, window_start = excluded.window_start, locked_until = excluded.locked_until, updated_at = excluded.updated_at;
    delete from public.ps_join_attempts a where a.updated_at < now() - interval '1 day';   -- 보관 기한(하루) — cron 없이 여기서 걷는다
    perform set_config('response.status', '400', true);
    return null;
  end if;

  delete from public.ps_join_attempts a where a.user_id = me;
  select w.owner_id into owner from public.ps_workspaces w where w.id = wid;
  select u.email::text into mail from auth.users u where u.id = me;

  -- 이미 팀원: 역할(권한 문서)은 건드리지 않는다. 비어 있던 이메일만 채운다.
  if exists (select 1 from public.ps_members m where m.workspace_id = wid and m.user_id = me) then
    update public.ps_members m set email = mail
     where m.workspace_id = wid and m.user_id = me and m.email is null and mail is not null;
    return wid;
  end if;

  -- 멤버 행이 사라진 소유자: 소유자로 되돌린다(선수로 내리지 않는다).
  if owner is not distinct from me then
    insert into public.ps_members(workspace_id, user_id, email, role, joined_at) values (wid, me, mail, 'owner', now());
    return wid;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ps_perms:' || wid::text, 0));   -- 같은 팀에 동시에 합류해도 서로의 항목을 덮지 않게
  insert into public.ps_members(workspace_id, user_id, email, role, joined_at) values (wid, me, mail, 'member', now());

  -- 가드(ps_kv_team_guard)는 아래 표식이 가리키는 초대 행을 스스로 다시 읽어 역할을 확인한다 — 표식만으로는 아무것도 열리지 않는다.
  perform set_config('ps.invite_join', c, true);
  select k.v into old_v from public.ps_kv k where k.workspace_id = wid and k.k = 'cs_perms_v1' for update;
  if found then
    begin pj := old_v::jsonb; exception when others then pj := null; end;
  end if;
  if pj is null or jsonb_typeof(pj) is distinct from 'object' then pj := '{"defaultRole":"player","members":{}}'::jsonb; end if;
  doc := public.ps_perms_authorised_doc(wid, me, pj);
  if doc is null then raise exception 'join failed' using errcode = 'P0001'; end if;
  insert into public.ps_kv(workspace_id, k, v, cupd)
    values (wid, 'cs_perms_v1', doc::text, (extract(epoch from clock_timestamp())*1000)::bigint)
  on conflict (workspace_id, k) do update
    set v = excluded.v, cupd = excluded.cupd, updated_at = now();
  perform set_config('ps.invite_join', '', true);

  return wid;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_kv_team_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid        uuid := auth.uid();
  enforcing  boolean;
  is_owner   boolean;
  perms      jsonb;
  my_role    text;
  allowed    boolean := false;
  reason     text := '';
  old_doc    jsonb;
  new_doc    jsonb;
  entry      jsonb;
  merged_j   jsonb;
  old_anchor date;
  new_anchor date;
  old_edited bigint;
  new_edited bigint;
  old_rev    bigint;
  new_rev    bigint;
begin
  if uid is null then
    return new;                      -- 서비스 키·백엔드 작업은 건드리지 않는다
  end if;

  select g.enforce into enforcing from public.ps_guard_mode g where g.id = 1;
  enforcing := coalesce(enforcing, false);

  if new.k = 'process_coach_v1' and tg_op = 'INSERT' then
    begin new_rev := nullif((new.v::jsonb ->> 'scheduleRev'), '')::bigint;
    exception when others then new_rev := null; end;
    if new_rev is distinct from 1 then
      perform public.ps_kv_note_denied(new.workspace_id, uid, new.k,
        '1.642 일정 판본 확인이 필요합니다 — 앱을 새로고침하세요');
      return null;
    end if;
  end if;

  -- ── 앵커 롤백 금지는 **소유자에게도** 적용한다 ────────────────────────────
  -- 2026-08-03 일정 밀림의 범인은 남이 아니라 소유자 본인 계정의, 잊고 켜 둔 컴퓨터였다.
  if new.k = 'process_coach_v1' and tg_op = 'UPDATE' then
    begin
      new_anchor := substring(new.v from '"anchorMonday":"(\d{4}-\d{2}-\d{2})"')::date;
      old_anchor := substring(old.v from '"anchorMonday":"(\d{4}-\d{2}-\d{2})"')::date;
      new_doc := new.v::jsonb; old_doc := old.v::jsonb;
      new_edited := nullif((new_doc ->> 'editedAt'), '')::bigint;
      old_edited := nullif((old_doc ->> 'editedAt'), '')::bigint;
      new_rev := nullif((new_doc ->> 'scheduleRev'), '')::bigint;
      old_rev := nullif((old_doc ->> 'scheduleRev'), '')::bigint;
    exception when others then
      new_anchor := null; old_anchor := null; new_edited := null; old_edited := null;
      new_rev := null; old_rev := null; new_doc := null; old_doc := null;
    end;
    if old_anchor is not null and new_anchor is not null and new_anchor < old_anchor
       and not (new_rev is not null and (old_rev is null or new_rev = old_rev + 1)
                and new_anchor = date_trunc('week', now() at time zone 'Asia/Seoul')::date) then
      perform public.ps_kv_note_denied(new.workspace_id, uid, new.k,
        '낡은 앱이 지난 주 일정을 밀어올렸습니다 — 그 기기를 새로고침하세요');
      -- 일정 기준일 후퇴는 권한 관찰 대상이 아니라 데이터 손상이다.
      -- 일반 쓰기 가드가 관찰 모드여도 이 한 가지는 항상 기존 정상본을 지킨다.
      new.v := old.v; new.cupd := old.cupd;
      return new;
    end if;
    -- 같은 anchor의 오래된 통째 문서도 정상 일정을 덮을 수 있다.
    -- editedAt이 후퇴하거나 사라진 쓰기는 권한 관찰 모드와 무관하게 막는다.
    if old_rev is not null and
       (new_rev is null or
        not (new_rev = old_rev + 1 or (new_rev = old_rev and new_doc is not distinct from old_doc))) then
      perform public.ps_kv_note_denied(new.workspace_id, uid, new.k,
        '오래된 일정 판본이 최신 편집을 덮으려 했습니다 — 1.642로 새로고침하세요');
      new.v := old.v; new.cupd := old.cupd;
      return new;
    end if;
    if old_rev is null and new_rev is not null and new_rev <> 1 then
      perform public.ps_kv_note_denied(new.workspace_id, uid, new.k,
        '일정 서버 판본을 확인하지 못해 저장을 보류했습니다 — 다시 동기화하세요');
      new.v := old.v; new.cupd := old.cupd;
      return new;
    end if;
    if old_rev is null and new_rev is null and old_edited is not null
       and (new_edited is null or new_edited < old_edited) then
      perform public.ps_kv_note_denied(new.workspace_id, uid, new.k,
        '오래된 일정 판본이 최신 편집을 덮으려 했습니다 — 그 기기를 새로고침하세요');
      new.v := old.v; new.cupd := old.cupd;
      return new;
    end if;
  end if;

  -- 이 공간을 서버가 모르면 팀이 아니다 — 판단 근거가 없으므로 통과시킨다.
  select (w.owner_id = uid) into is_owner
    from public.ps_workspaces w where w.id = new.workspace_id;
  if not found then
    return new;
  end if;

  -- 소유자는 항상 허용 (부트스트랩: 권한 문서가 아직 없어도 팀을 세울 수 있어야 한다)
  if coalesce(is_owner, false) then
    return new;
  end if;

  begin
    select k2.v::jsonb into perms
      from public.ps_kv k2
     where k2.workspace_id = new.workspace_id and k2.k = 'cs_perms_v1';
  exception when others then
    perms := null;
  end;
  my_role := coalesce(
    perms->'members'->(uid::text)->>'role',
    perms->>'defaultRole',
    'player');

  -- ── ① 권한 문서 — 운영진만. 그 외에는 '자기 항목 등록'만 ──────────────────
  if new.k = 'cs_perms_v1' then
    if my_role in ('admin','executive') then
      return new;
    end if;
    if tg_op = 'INSERT' or old.v is null then
      return new;                    -- 최초 생성만은 허용 (팀 만들기 직후)
    end if;
    begin
      old_doc := old.v::jsonb;
    exception when others then
      old_doc := null;
    end;
    if old_doc is null then
      return new;
    end if;
    entry := old_doc->'members'->(uid::text);
    if entry is null then
      entry := jsonb_build_object('role', coalesce(old_doc->>'defaultRole','player'));
    end if;
    if old_doc->'members' is null or jsonb_typeof(old_doc->'members') <> 'object' then
      merged_j := jsonb_set(old_doc, array['members'],
                    jsonb_build_object(uid::text, entry), true);
    else
      merged_j := jsonb_set(old_doc, array['members', uid::text], entry, true);
    end if;
    begin
      new_doc := new.v::jsonb;
    exception when others then
      new_doc := null;
    end;
    -- 20261110 — 서버가 인정한 길(초대 코드 합류 등)이 만든 판과 글자 그대로 같으면 통과. /* ps-20261110-invite */
    --   판정은 ps_perms_authorised_doc 한 곳: 이 트랜잭션에서 합류한 본인 항목 = 유효한 초대 행의 역할, 그 밖의 칸은 옛 문서 그대로.
    if new_doc is not null and new_doc = public.ps_perms_authorised_doc(new.workspace_id, uid, old_doc) then
      return new;
    end if;
    if new_doc is not null and merged_j = new_doc then
      return new;                    -- 바뀐 게 없다 — 조용히 통과
    end if;
    perform public.ps_kv_note_denied(new.workspace_id, uid, new.k,
      '권한은 운영진만 바꿀 수 있습니다 — 본인 등록만 반영했어요');
    if enforcing then
      new.v := merged_j::text;
    end if;
    return new;

  -- ── ①-2 경기 담당 배정 (1.621) — 운영진만 ────────────────────────────────
  elsif new.k = 'cs_assign_v1' then
    allowed := my_role in ('admin','executive');
    if not allowed then reason := '경기 담당은 운영진만 정할 수 있습니다'; end if;

  -- ── ② 일정 — 운영진만 (앱의 '모든 스태프' 토글이 켜져 있으면 스태프도) ────
  elsif new.k = 'process_coach_v1' then
    if my_role in ('admin','executive') then
      allowed := true;
    elsif my_role = 'staff' and coalesce(perms->>'schedEdit','') = 'staff' then
      allowed := true;
    else
      allowed := false; reason := '일정은 운영진만 편집할 수 있습니다';
    end if;

  -- ── ③ 개인 IDP — 자기 것만 ────────────────────────────────────────────────
  elsif new.k like 'cs\_idp\_v1\_%' then
    allowed := (new.k = 'cs_idp_v1_' || uid::text);
    if not allowed then reason := '다른 선수의 IDP 는 편집할 수 없습니다'; end if;

  -- ── ④ 나머지 팀 자료 — 1.634부터 ps_can_write_key 하나로 판정한다 ─────────
  --   예전에는 여기서 my_role in ('admin','executive','staff') 로 **따로** 판정했다.
  --   그래서 (a)임원이 특정 코치에게 구역을 열어 줘도 이 트리거는 scopes 를 안 봐서 막을 수 있었고
  --        (b)코칭스태프 잠금을 ps_can_write_key 에만 넣으면 이쪽이 통과시켜 잠금이 헐거워진다.
  --   표는 하나여야 한다.
  else
    allowed := public.ps_can_write_key(new.workspace_id, new.k);
    if not allowed then reason := '이 자료는 임원만 편집할 수 있습니다 — 수정할 곳이 있으면 임원에게 말씀해 주세요'; end if;
  end if;

  if allowed then
    delete from public.ps_kv_denied d                    -- 권한을 새로 받았으면 옛 기록 정리
     where d.workspace_id = new.workspace_id and d.user_id = uid and d.k = new.k;
    return new;
  end if;

  -- ── 거부 ─────────────────────────────────────────────────────────────────
  perform public.ps_kv_note_denied(new.workspace_id, uid, new.k, reason);
  if not enforcing then
    return new;                      -- 관찰 모드: 기록만 남기고 통과시킨다
  end if;
  if tg_op = 'UPDATE' then
    new.v := old.v;                  -- 서버 값을 지킨다
    new.cupd := old.cupd;
    return new;
  end if;
  return null;                       -- INSERT 는 통째로 무시
end;
$function$;

CREATE OR REPLACE FUNCTION public.ps_bootstrap(p_email text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, kind text, role text, members integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pid uuid;
begin
  select w.id into pid from public.ps_workspaces w
    join public.ps_members m on m.workspace_id = w.id
    where m.user_id = auth.uid() and w.kind = 'personal' limit 1;
  if pid is null then
    insert into public.ps_workspaces(name, kind, owner_id) values ('내 워크스페이스','personal', auth.uid()) returning ps_workspaces.id into pid;
    insert into public.ps_members(workspace_id, user_id, email, role) values (pid, auth.uid(), (select u.email::text from auth.users u where u.id = auth.uid()), 'owner');   -- ps-20261110-invite: p_email 은 받기만 하고 쓰지 않는다
  end if;
  return query
    select w.id, w.name, w.kind, m.role,
      (select count(*)::int from public.ps_members mm where mm.workspace_id = w.id) as members
    from public.ps_workspaces w
    join public.ps_members m on m.workspace_id = w.id and m.user_id = auth.uid()
    order by (w.kind='personal') desc, w.created_at;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_create_team(p_name text, p_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare wid uuid;
begin
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  insert into public.ps_workspaces(name, kind, owner_id) values (trim(p_name),'team', auth.uid()) returning id into wid;
  insert into public.ps_members(workspace_id, user_id, email, role) values (wid, auth.uid(), (select u.email::text from auth.users u where u.id = auth.uid()), 'owner');   -- ps-20261110-invite: p_email 은 받기만 하고 쓰지 않는다
  return wid;
end $function$;

DROP POLICY IF EXISTS inv_sel ON public.ps_invites;
CREATE POLICY inv_sel ON public.ps_invites AS PERMISSIVE FOR SELECT TO public USING (ps_is_owner(workspace_id));

DO $data$
DECLARE n_role integer := 0; n_open integer := 0;
BEGIN
  IF current_setting('ps.m20261110_invite_first', true) = '1' THEN
    UPDATE public.ps_invites SET expires_at = now()
     WHERE member_role IN ('staff','executive') AND (expires_at IS NULL OR expires_at > now());
    GET DIAGNOSTICS n_role = ROW_COUNT;
    UPDATE public.ps_invites SET expires_at = now() + interval '30 days' WHERE expires_at IS NULL;
    GET DIAGNOSTICS n_open = ROW_COUNT;
  END IF;
  RAISE NOTICE '20261110_invite: 적용 — 만료시킨 스태프 · 임원 코드 % · 만료일을 붙인 옛 코드 %', n_role, n_open;
END
$data$;
COMMIT;
