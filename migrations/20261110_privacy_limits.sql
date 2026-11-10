-- 20261110_privacy_limits — 멤버 이메일 · 그림 · 로그인 없는 쓰기 · 계정 삭제 · 권한 정리(보안 점검 2026-11-10 의 4~8번).
-- ⚠ 20261110_invite_hardening 뒤에 적용한다(ps_join_attempts · ps_perms_authorised_doc 을 쓴다). 되돌릴 때는 이 묶음 먼저.
--   ④ 멤버 이메일: ps_members_of · ps_members_of_v2 는 소유자 · 임원과 본인 줄에만 이메일을 준다(이름은 그대로). 표를 직접 읽는 길(mem_sel)도 본인 줄 · 운영진만.
--   ⑤ ps_blob: 올린 사람은 서버가 적고, 한 사람 24시간 1,500개. (목록 읽기 제한은 앱 변경이 먼저 — runbook «제안»)
--   ⑥ ps_err · ps_comm_reports · ps_events: 길이 검사(NOT VALID → 어기는 옛 줄이 없으면 VALIDATE) · 신고자는 서버가 적는다 · 하루 상한 · «가장 새 판»은 3명 이상이 보낸 판.
--   ⑦ ps_delete_my_data: uid 가 든 행을 표마다 지우거나 비운다 · 다른 팀원이 남은 팀의 소유자는 멈춘다(409 ps_delete_owner_blocked) · auth.users 는 대기열(ps_account_deletions).
--   ⑧ anon · authenticated 의 TRUNCATE · REFERENCES · TRIGGER(· MAINTAIN), anon 의 쓰지 않는 INSERT · UPDATE · DELETE 회수. ps_workspaces 의 kind · owner_id 는 못 바꾼다.
-- 멱등 · 한 트랜잭션. 운영이 예상과 다르면 예외로 멈추고 아무것도 바꾸지 않는다. 근거 · 순서 · 기대 결과는 20261110_privacy_limits.runbook.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$
DECLARE f text; want text; got text; done boolean; o regprocedure; n_done integer := 0; n_old integer := 0; pol text; bad text; top bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.ps_join(text,text)') AND p.prosrc LIKE '%ps-20261110-invite%')
     OR to_regclass('public.ps_join_attempts') IS NULL THEN
    RAISE EXCEPTION '20261110_privacy: 20261110_invite_hardening 이 먼저 적용돼 있어야 합니다 — 아무것도 바꾸지 않았습니다';
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
    IF o IS NULL THEN RAISE EXCEPTION '20261110_privacy: public.% 이 없습니다 — 아무것도 바꾸지 않았습니다', f; END IF;
    SELECT md5(p.prosrc), p.prosrc LIKE '%ps-20261110-privacy%' INTO got, done FROM pg_proc p WHERE p.oid = o;
    IF done THEN n_done := n_done + 1;
    ELSIF got = want THEN n_old := n_old + 1;
    ELSE RAISE EXCEPTION '20261110_privacy: public.% 본문이 예상(기준본 · 20261028 · 20261110_invite)과 다릅니다(md5 % ≠ %) — 아무것도 바꾸지 않았습니다', f, got, want; END IF;
  END LOOP;
  IF n_done > 0 AND n_old > 0 THEN RAISE EXCEPTION '20261110_privacy: 일부만 적용된 상태입니다(적용 % · 옛것 %) — rollback.sql 뒤 다시 적용합니다', n_done, n_old; END IF;
  SELECT pg_get_expr(p.polqual, p.polrelid) INTO pol FROM pg_policy p WHERE p.polrelid = 'public.ps_members'::regclass AND p.polname = 'mem_sel' AND p.polcmd = 'r';
  IF pol IS NULL OR pol NOT IN ('ps_is_member(workspace_id)', $q$(ps_is_member(workspace_id) AND ((user_id = auth.uid()) OR (ps_team_role(workspace_id) = ANY (ARRAY['admin'::text, 'executive'::text]))))$q$) THEN
    RAISE EXCEPTION '20261110_privacy: ps_members 정책 mem_sel 이 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', coalesce(pol, '없음');
  END IF;
  -- 같은 표에 이 묶음이 모르는 트리거가 있으면(누가 먼저 다른 가드를 달았다) 멈춘다
  SELECT string_agg(t.tgrelid::regclass::text || '.' || t.tgname, ', ') INTO bad FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.ps_err'::regclass, 'public.ps_comm_reports'::regclass, 'public.ps_blob'::regclass, 'public.ps_workspaces'::regclass)
     AND t.tgname NOT IN ('ps_err_guard_t', 'ps_comm_report_guard_t', 'ps_blob_guard_t', 'ps_workspace_fixed_guard_t');
  IF bad IS NOT NULL THEN RAISE EXCEPTION '20261110_privacy: 예상 밖 트리거가 있습니다(%) — 아무것도 바꾸지 않았습니다', bad; END IF;
  -- 아래는 처음 적용할 때만 본다(적용 뒤에는 상한 안에서 많이 쓴 날이 있어도 다시 돌릴 수 있어야 한다)
  IF n_done = 0 THEN
  -- 상한이 정상 사용을 막지 않는다는 가정: 최근 30일 가장 많이 쓴 날이 상한의 절반 아래
  SELECT max(c) INTO top FROM (SELECT count(*) c FROM public.ps_blob b WHERE b.created_at > now() - interval '30 days' AND b.created_by IS NOT NULL GROUP BY b.created_by, date_trunc('day', b.created_at)) s;
  IF coalesce(top, 0) >= 750 THEN RAISE EXCEPTION '20261110_privacy: 한 사람이 하루에 그림 %개를 올린 날이 있습니다(상한 1,500 의 절반 이상) — 상한을 다시 정합니다. 아무것도 바꾸지 않았습니다', top; END IF;
  SELECT max(c) INTO top FROM (SELECT count(*) c FROM public.ps_err e WHERE e.t > now() - interval '30 days' GROUP BY date_trunc('day', e.t)) s;
  IF coalesce(top, 0) >= 2500 THEN RAISE EXCEPTION '20261110_privacy: 오류 기록이 하루 %줄인 날이 있습니다(상한 5,000 의 절반 이상) — 상한을 다시 정합니다. 아무것도 바꾸지 않았습니다', top; END IF;
  SELECT max(c) INTO top FROM (SELECT count(*) c FROM public.ps_comm_reports r WHERE r.at > now() - interval '30 days' GROUP BY coalesce(r.reporter::text, 'anon'), date_trunc('day', r.at)) s;
  IF coalesce(top, 0) >= 15 THEN RAISE EXCEPTION '20261110_privacy: 한 사람(또는 비로그인 합계)이 하루 %건 신고한 날이 있습니다(상한 30 의 절반 이상) — 상한을 다시 정합니다. 아무것도 바꾸지 않았습니다', top; END IF;
  -- 최근 7일의 이벤트가 새 검사를 어기면(= 지금 도는 앱이 그런 값을 보낸다) 멈춘다
  SELECT count(*) INTO top FROM public.ps_events e WHERE e.created_at > now() - interval '7 days'
     AND (octet_length(e.meta::text) > 8192 OR (e.app_version IS NOT NULL AND e.app_version !~ '^[A-Za-z0-9_.+-]{1,24}$') OR char_length(e.workspace_id) > 64);
  IF top > 0 THEN RAISE EXCEPTION '20261110_privacy: 최근 7일 ps_events %줄이 새 검사(meta 8KB · app_version 모양 · workspace_id 64자)를 어깁니다 — 아무것도 바꾸지 않았습니다', top; END IF;
  SELECT count(*) INTO top FROM public.ps_err e WHERE e.t > now() - interval '30 days'
     AND (char_length(e.kind) > 40 OR char_length(e.msg) > 2000 OR char_length(e.src) > 300 OR char_length(e.page) > 300 OR char_length(e.ua) > 400);
  IF top > 0 THEN RAISE EXCEPTION '20261110_privacy: 최근 30일 ps_err %줄이 새 길이 검사를 어깁니다 — 아무것도 바꾸지 않았습니다', top; END IF;
  END IF;
END
$pre$;

-- 하루 단위 셈(버킷 · 날짜). 클라이언트는 닿지 못한다 — 아래 가드 트리거(SECURITY DEFINER)만 쓴다.
create table if not exists public.ps_rate_counters (
  bucket text not null check (char_length(bucket) <= 80),
  day    date not null,
  n      integer not null default 0,
  primary key (bucket, day)
);
alter table public.ps_rate_counters enable row level security;
revoke all on table public.ps_rate_counters from public, anon, authenticated;
grant select, insert, update, delete on table public.ps_rate_counters to service_role;
comment on table public.ps_rate_counters is '20261110 — ps_err · ps_comm_reports 하루 상한 셈. 8일 지난 줄은 ps_rate_bump 가 걷는다.';

-- 계정 삭제 대기열: ps_delete_my_data 가 줄을 남기고, 관리자가 대시보드에서 auth.users 를 지운 뒤 done_at 을 적는다.
create table if not exists public.ps_account_deletions (
  user_id      uuid primary key,
  requested_at timestamptz not null default now(),
  done_at      timestamptz,
  done_by      text check (done_by is null or char_length(done_by) <= 80)
);
alter table public.ps_account_deletions enable row level security;
revoke all on table public.ps_account_deletions from public, anon, authenticated;
grant select, insert, update, delete on table public.ps_account_deletions to service_role;
comment on table public.ps_account_deletions is '20261110 — 계정 삭제 요청. auth.users 삭제는 service_role 이 필요해 관리자가 한다(runbook «계정 삭제 처리»). 이메일 등은 담지 않는다.';

create or replace function public.ps_rate_bump(p_bucket text) returns integer
language plpgsql security definer set search_path to 'public' as $function$
/* ps-20261110-privacy */
declare c integer; d date := (now() at time zone 'utc')::date;
begin
  insert into public.ps_rate_counters as r (bucket, day, n) values (left(p_bucket, 80), d, 1)
  on conflict (bucket, day) do update set n = r.n + 1
  returning r.n into c;
  if c = 1 then delete from public.ps_rate_counters r where r.day < d - 7; end if;   -- 보관 기한(8일) — cron 없이 여기서
  return c;
end $function$;
revoke all on function public.ps_rate_bump(text) from public, anon, authenticated;
grant execute on function public.ps_rate_bump(text) to service_role;

-- ps_err(로그인 없이 쓰는 오류 기록): 시각은 서버 기준 ±(10분 · 30일) 밖이면 지금으로, 하루 5,000줄을 넘으면 조용히 버린다
-- (예외를 던지면 앱이 같은 묶음을 계속 다시 보낸다 — storage.js 는 성공해야 비운다).
create or replace function public.ps_err_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
/* ps-20261110-privacy */
begin
  if new.t is null or new.t > now() + interval '10 minutes' or new.t < now() - interval '30 days' then new.t := now(); end if;
  if public.ps_rate_bump('err') > 5000 then return null; end if;
  return new;
end $function$;
revoke all on function public.ps_err_guard() from public, anon, authenticated;

-- ps_comm_reports(신고): 신고자는 서버가 적는다(꾸밀 수 없다) · 로그인한 사람은 하루 30건, 비로그인은 모두 합쳐 하루 300건 — 넘으면 조용히 버린다.
create or replace function public.ps_comm_report_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
/* ps-20261110-privacy */
declare uid uuid := auth.uid();
begin
  new.reporter := uid; new.at := now(); new.resolved_at := null; new.resolved_by := null;
  if uid is null then
    if public.ps_rate_bump('rep:anon') > 300 then return null; end if;
  elsif public.ps_rate_bump('rep:u:' || uid::text) > 30 then return null;
  end if;
  return new;
end $function$;
revoke all on function public.ps_comm_report_guard() from public, anon, authenticated;

-- ps_blob: 올린 사람 · 시각은 서버가 적고, 한 사람이 24시간에 1,500개를 넘기면 거절한다(42501 → 403: 앱은 그 세션에서 그림을 문서에 담아 보내는 옛 길로 물러선다).
create or replace function public.ps_blob_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
/* ps-20261110-privacy */
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then return new; end if;
  new.created_by := uid; new.created_at := now();
  select count(*) into n from public.ps_blob b where b.created_by = uid and b.created_at > now() - interval '24 hours';
  if n >= 1500 then raise exception 'blob daily quota' using errcode = '42501', detail = '1500 per 24 hours'; end if;
  return new;
end $function$;
revoke all on function public.ps_blob_guard() from public, anon, authenticated;

-- ps_workspaces: 소유자라도 종류(kind) · 소유자(owner_id) · id · 만든 시각은 못 바꾼다(이름만). 넘기기는 관리자(SQL · service_role)가 한다.
create or replace function public.ps_workspace_fixed_guard() returns trigger
language plpgsql set search_path to 'public' as $function$
/* ps-20261110-privacy */
begin
  if auth.uid() is null then return new; end if;
  if new.id is distinct from old.id or new.kind is distinct from old.kind
     or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'workspace kind and owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end $function$;

-- «가장 새 앱 판»: 서로 다른 3명 이상이 보낸 판 가운데 가장 큰 것. 그런 판이 없으면(사람이 적은 시간대) 가장 많은 사람이 보낸 판.
create or replace function public.ps_latest_app_version(p_since timestamptz) returns numeric
language sql stable set search_path to 'public' as $function$
  /* ps-20261110-privacy */
  with v as (
    select e.app_version::numeric as ver, count(distinct e.user_id) as users
      from public.ps_events e
     where e.created_at > p_since and e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$'
     group by 1)
  select coalesce((select max(v.ver) from v where v.users >= 3),
                  (select v.ver from v order by v.users desc, v.ver asc limit 1));
$function$;
revoke all on function public.ps_latest_app_version(timestamptz) from public, anon, authenticated;
grant execute on function public.ps_latest_app_version(timestamptz) to service_role;

create or replace function public.ps_perms_authorised_doc(p_wid uuid, p_uid uuid, p_old jsonb) returns jsonb
language plpgsql stable set search_path to 'public' as $function$
/* ps-20261110-invite */ /* ps-20261110-privacy */
-- 운영진이 아닌 사람(p_uid)이 권한 문서를 «이 판으로» 바꿔도 되는 서버 인정 경로. 없으면 null. 가드(ps_kv_team_guard)가 글자 그대로 견준다.
--   ① 초대 합류(20261110_invite_hardening 그대로): 표식 ps.invite_join 의 코드가 이 팀의 유효한 초대 행이고 멤버 행이 바로 이 트랜잭션에서 생겼을 때
--      → 옛 문서 + (본인 항목 = 그 초대의 역할).
--   ② 계정 삭제(ps_delete_my_data): 표식 ps.self_delete 가 본인 uid 이고 **이미 이 팀의 멤버가 아닐 때** → 옛 문서 − 본인 항목.
--      멤버가 아니어야 하므로, 표식을 꾸며도 팀에 남은 채 제 항목을 지워 «팀 기본 역할»로 올라갈 수는 없다.
declare inv_code text := nullif(current_setting('ps.invite_join', true), ''); r text; doc jsonb;
begin
  if p_wid is null or p_uid is null or p_old is null or jsonb_typeof(p_old) is distinct from 'object' then return null; end if;
  if nullif(current_setting('ps.self_delete', true), '') = p_uid::text then
    if exists (select 1 from public.ps_members m where m.workspace_id = p_wid and m.user_id = p_uid)
       or exists (select 1 from public.ps_workspaces w where w.id = p_wid and w.owner_id = p_uid) then
      return null;
    end if;
    return p_old #- array['members', p_uid::text];
  end if;
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

CREATE OR REPLACE FUNCTION public.ps_members_of(p_wid uuid)
 RETURNS TABLE(user_id uuid, email text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* ps-20261110-privacy */
-- 옛 앱이 v2 가 없을 때만 부르는 함수. «email» 칸은 그때부터 이름표로도 쓰였다(주소 모양이 아니면 이름).
-- 소유자 · 임원 · 본인 줄에는 그대로, 그 밖에는 이름(없으면 null)만 준다 — 남의 이메일 주소는 주지 않는다.
declare priv boolean;
begin
  if not public.ps_is_member(p_wid) then raise exception 'not a member'; end if;
  priv := public.ps_team_role(p_wid) in ('admin','executive');
  return query select m.user_id,
      case when priv or m.user_id = auth.uid() then m.email
           else coalesce(nullif(btrim(m.name), ''), case when m.email like '%@%' then null else m.email end) end,
      m.role
    from public.ps_members m where m.workspace_id = p_wid order by (m.role='owner') desc, m.joined_at;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_members_of_v2(p_wid uuid)
 RETURNS TABLE(user_id uuid, name text, email text, role text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* ps-20261110-privacy */
-- 이메일은 소유자 · 임원과 본인 줄에만. 이름은 그대로 모두에게(이름이 없는 사람은 앱이 «이름 없는 계정»으로 그린다 — 이메일 앞부분을 이름으로 내주지 않는다).
declare priv boolean;
begin
  if not exists (select 1 from public.ps_members m where m.workspace_id = p_wid and m.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;
  priv := public.ps_team_role(p_wid) in ('admin','executive');
  return query
  select m.user_id,
         coalesce(
           m.name,
           case when m.email like '%@%' then null else m.email end,
           u.raw_user_meta_data->>'name',
           u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'preferred_username'
         ) as name,
         case when priv or m.user_id = auth.uid() then
         coalesce(
           case when m.email like '%@%' then m.email else null end,
           u.email::text,
           u.raw_user_meta_data->>'email'
         )
         end as email,
         m.role::text, m.joined_at
  from public.ps_members m
  left join auth.users u on u.id = m.user_id
  where m.workspace_id = p_wid
  order by (m.role = 'owner') desc, m.joined_at;
end;
$function$;

create or replace function public.ps_support_reporter_devices(p_report_id uuid, p_days integer default 7)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare who uuid; days integer:=least(greatest(coalesce(p_days,7),1),30); found jsonb; latest numeric;
begin
  if auth.uid() is null or public.ps_is_admin() is not true then raise exception using errcode='42501', message='support_not_admin'; end if;
  select reporter_id into who from public.ps_support_reports where id=p_report_id;
  if who is null then raise exception using errcode='PT404', message='report_not_found'; end if;
  -- 최근 48시간 전체에서 본 가장 새 판 — 화면이 «옛 판» 표시의 기준으로 쓴다(관리자 화면엔 앱 판 번호가 없다)
  latest := public.ps_latest_app_version(now()-interval '48 hours');   -- ps-20261110-privacy: 한 사람이 보낸 99.999 가 기준이 되지 않게
  select coalesce(jsonb_agg(jsonb_build_object(
      'device',d.device,'app_version',d.app_version,'last_at',d.last_at,'first_at',d.first_at,'events',d.n,
      'crashes',d.crashes,'storage_full',d.storage_full,'sync_failed',d.sync_failed,'standalone',d.standalone) order by d.last_at desc),'[]'::jsonb)
    into found
  from (
    select coalesce(nullif(e.device,''),'unknown') as device, coalesce(nullif(e.app_version,''),'unknown') as app_version,
      max(e.created_at) as last_at, min(e.created_at) as first_at, count(*) as n,
      count(*) filter (where e.event_name='boot_after_crash') as crashes,
      count(*) filter (where e.event_name='storage_full') as storage_full,
      count(*) filter (where e.event_name='sync_failed') as sync_failed,
      bool_or(e.meta->>'standalone'='true') as standalone
    from public.ps_events e
    where e.user_id=who and e.created_at > now()-make_interval(days=>days)
    group by 1,2
    order by max(e.created_at) desc
    limit 20
  ) d;
  return jsonb_build_object('days',days,'latest',case when latest is null then null else to_char(latest,'FM9.000') end,'devices',found);
end $$;

create or replace function public.ps_admin_stale_clients(p_hours integer default 48, p_behind integer default 20)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare hours integer:=least(greatest(coalesce(p_hours,48),1),720); behind integer:=least(greatest(coalesce(p_behind,20),1),500);
  latest numeric; cutoff numeric; found jsonb;
begin
  if auth.uid() is null or public.ps_is_admin() is not true then raise exception using errcode='42501', message='admin_required'; end if;
  latest := public.ps_latest_app_version(now()-make_interval(hours=>hours));   -- ps-20261110-privacy: 한 사람이 보낸 99.999 가 기준이 되지 않게
  if latest is null then return jsonb_build_object('hours',hours,'behind',behind,'latest',null,'clients','[]'::jsonb); end if;
  cutoff := latest - behind/1000.0;
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',d.user_id,'who',public.ps_support_reporter(d.user_id),
      'device',d.device,'app_version',d.app_version,'last_at',d.last_at,'events',d.n,
      'crashes',d.crashes,'storage_full',d.storage_full,'newer_seen',d.newer_seen) order by d.newer_seen, d.n desc, d.last_at desc),'[]'::jsonb)
    into found
  from (
    with win as (
      select e.user_id, coalesce(nullif(e.device,''),'unknown') as device, e.app_version, e.event_name, e.created_at
      from public.ps_events e
      where e.created_at > now()-make_interval(hours=>hours) and e.user_id is not null and e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$'),
    best as (select w.user_id, w.device, max(w.app_version::numeric) as top from win w group by 1,2),
    g as (
      select w.user_id, w.device, w.app_version, max(w.created_at) as last_at, count(*) as n,
        count(*) filter (where w.event_name='boot_after_crash') as crashes,
        count(*) filter (where w.event_name='storage_full') as storage_full
      from win w where w.app_version::numeric < cutoff
      group by 1,2,3)
    select g.user_id, g.device, g.app_version, g.last_at, g.n, g.crashes, g.storage_full, (b.top >= cutoff) as newer_seen
    from g join best b on b.user_id=g.user_id and b.device=g.device
    order by (b.top >= cutoff), g.n desc, g.last_at desc
    limit 60
  ) d;
  return jsonb_build_object('hours',hours,'behind',behind,'latest',to_char(latest,'FM9.000'),'clients',found);
end $$;

CREATE OR REPLACE FUNCTION public.ps_delete_my_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
/* ps-20261110-privacy */
-- 계정 삭제(개인정보처리방침 4절 «지체 없이 파기»). 표마다 지우거나 주인 칸을 비운다 — 근거는 20261110_privacy_limits.runbook.md 의 표.
-- 멈추는 경우(아무것도 지우지 않는다 · HTTP 409):
--   ps_delete_owner_blocked — 다른 팀원이 남아 있는 팀의 소유자다(팀이 주인 없이 남는다). detail = 팀 이름.
--   ps_delete_admin_blocked — 서비스 관리자 계정이다(관리 기록이 이 계정을 가리킨다 — 먼저 관리자에서 뺀다).
-- auth.users 행은 여기서 못 지운다(service_role 필요) — ps_account_deletions 에 줄을 남기고 관리자가 지운다.
declare
  me      uuid := auth.uid();
  mykey   text;
  blocked text;
  mine    uuid[];
  gone    uuid[];
  scope   text[];
  r       record;
  doc     jsonb;
begin
  if me is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  mykey := me::text;
  if exists (select 1 from public.ps_admins a where a.user_id = me) then
    raise exception 'ps_delete_admin_blocked' using errcode = 'PT409', detail = 'service admin account';
  end if;

  -- ① 다른 사람이 남아 있는 팀의 소유자면 멈춘다
  select string_agg(w.name, ', ' order by w.created_at) into blocked
    from public.ps_workspaces w
   where w.kind <> 'personal'
     and (w.owner_id = me or exists (select 1 from public.ps_members m where m.workspace_id = w.id and m.user_id = me and m.role = 'owner'))
     and exists (select 1 from public.ps_members o where o.workspace_id = w.id and o.user_id <> me);
  if blocked is not null then
    raise exception 'ps_delete_owner_blocked' using errcode = 'PT409', detail = left(blocked, 200),
      hint = '팀을 다른 사람에게 넘기거나 팀을 지운 뒤 다시 시도';
  end if;

  select coalesce(array_agg(m.workspace_id), '{}') into mine from public.ps_members m where m.user_id = me;
  -- ② 내가 주인이고 나만 있는 공간(개인 공간 · 혼자 쓰던 팀)은 통째로 — 문서 · 보관함 · 그림 · 초대 · 멤버 행은 외래키로 같이 지워진다
  select coalesce(array_agg(w.id), '{}') into gone
    from public.ps_workspaces w
   where (w.owner_id = me or exists (select 1 from public.ps_members m where m.workspace_id = w.id and m.user_id = me and m.role = 'owner'))
     and not exists (select 1 from public.ps_members o where o.workspace_id = w.id and o.user_id <> me);
  delete from public.ps_workspaces w where w.id = any(gone);
  select coalesce(array_agg(distinct x::text), '{}') into scope from unnest(mine || gone) x;

  -- ③ 남의 팀에서 나간다
  delete from public.ps_members m where m.user_id = me;

  -- ④ 그 팀들에 남은 «내 uid 가 이름에 든 문서»(cs_idp_v1_<uid> · cs_idp_pub_v1_<uid> …)
  delete from public.ps_kv k where k.workspace_id = any(mine) and k.k like '%\_' || mykey;

  -- ⑤ 권한 문서의 내 항목(역할 · 선수 연결 playerId). 가드는 «이미 멤버가 아닌 본인의 항목 삭제»만 인정한다(ps_perms_authorised_doc ②)
  perform set_config('ps.self_delete', mykey, true);
  for r in select k.workspace_id, k.v from public.ps_kv k
            where k.workspace_id = any(mine) and k.k = 'cs_perms_v1' and k.v like '%' || mykey || '%' for update loop
    begin doc := r.v::jsonb; exception when others then doc := null; end;
    continue when doc is null or jsonb_typeof(doc) is distinct from 'object' or jsonb_typeof(doc->'members') is distinct from 'object' or not (doc->'members' ? mykey);
    update public.ps_kv k
       set v = (doc #- array['members', mykey])::text,
           cupd = greatest(k.cupd + 1, (extract(epoch from clock_timestamp())*1000)::bigint), updated_at = now()
     where k.workspace_id = r.workspace_id and k.k = 'cs_perms_v1';
  end loop;
  perform set_config('ps.self_delete', '', true);
  if exists (select 1 from public.ps_kv k where k.workspace_id = any(mine) and k.k = 'cs_perms_v1'
              and k.v like '%' || mykey || '%' and (public.ps_try_jsonb(k.v)->'members') ? mykey) then
    -- 쓰기 가드(앱 판 하한 등)가 되돌렸다 — «지웠다»고 답하지 않고 통째로 물린다
    raise exception 'ps_delete_incomplete' using errcode = 'P0001', detail = 'permission entry was not removed';
  end if;

  -- ⑥ 위 삭제 · 수정이 남긴 판 역사와, 지운 공간의 판 역사 · 기록
  delete from public.ps_kv_history h where h.workspace_id = any(scope) and (h.k like '%\_' || mykey or h.workspace_id = any(array(select x::text from unnest(gone) x)));
  update public.ps_kv_history h set v = (h.v::jsonb #- array['members', mykey])::text
   where h.workspace_id = any(scope) and h.k = 'cs_perms_v1' and h.v like '%' || mykey || '%' and (public.ps_try_jsonb(h.v)->'members') ? mykey;
  update public.ps_kv_history h set changed_by = null where h.workspace_id = any(scope) and h.changed_by = me;
  if to_regclass('public.ps_kv_history_hold_2948') is not null then
    execute 'delete from public.ps_kv_history_hold_2948 h where h.workspace_id = any($1) and (h.k like $2 or h.workspace_id = any($3))'
      using scope, '%\_' || mykey, array(select x::text from unnest(gone) x);
  end if;
  if to_regclass('public.ps_kv_restore_backup_2948') is not null then
    execute 'delete from public.ps_kv_restore_backup_2948 h where h.workspace_id = any($1) and (h.k like $2 or h.workspace_id = any($3))'
      using scope, '%\_' || mykey, array(select x::text from unnest(gone) x);
  end if;
  delete from public.ps_audit a where a.workspace_id = any(mine || gone) and (a.k like '%\_' || mykey or a.workspace_id = any(gone));
  update public.ps_audit a set user_id = null where a.workspace_id = any(mine || gone) and a.user_id = me;
  delete from public.ps_kv_denied d where d.user_id = me or d.workspace_id = any(gone);
  delete from public.ps_kv_ping p where p.by = me or p.workspace_id = any(gone);

  -- ⑦ 팀에 남는 보관함: 나만 보던 항목은 지우고, 팀과 나눈 항목은 팀 자료로 남기되 주인 칸을 비운다. 그림(내용 주소 · 팀 문서가 같이 쓴다)은 올린 사람 칸만 비운다
  delete from public.ps_library l where l.workspace_id = any(mine) and l.owner_id = me and l.private;
  update public.ps_library l set owner_id = null where l.workspace_id = any(mine) and l.owner_id = me;
  update public.ps_blob b set created_by = null where b.created_by = me;

  -- ⑧ 그 밖의 내 행
  delete from public.ps_support_replies s where s.report_id in (select p.id from public.ps_support_reports p where p.reporter_id = me);
  delete from public.ps_support_reports p where p.reporter_id = me;     -- 첨부 그림은 외래키로 같이
  delete from public.ps_share s where s.created_by = me;
  delete from public.ps_sync_reports s where s.user_id = me;
  delete from public.ps_shared_views s where s.user_id = me or s.subject_user_id = me;
  delete from public.ps_events e where e.user_id = me;
  delete from public.ps_usage u where u.user_id = me;
  delete from public.ps_invites i where i.created_by = me;
  delete from public.ps_join_attempts j where j.user_id = me;
  delete from public.ps_letter_readers l where l.reader_key = 'u:' || mykey;
  update public.ps_comm_reports c set reporter = null where c.reporter = me;   -- 신고는 운영에 남기고 누가 했는지만 지운다
  delete from public.ps_comm_likes c where c.uid = me;
  delete from public.ps_community c where c.owner = me;
  delete from public.ps_handles h where h.uid = me;

  -- ⑨ 로그인 계정(auth.users)은 관리자가 지운다 — 대기열
  insert into public.ps_account_deletions as q (user_id, requested_at) values (me, now())
  on conflict (user_id) do update set requested_at = excluded.requested_at, done_at = null, done_by = null;
end;
$function$;

DROP POLICY IF EXISTS mem_sel ON public.ps_members;
CREATE POLICY mem_sel ON public.ps_members AS PERMISSIVE FOR SELECT TO public
  USING (ps_is_member(workspace_id) AND (user_id = auth.uid() OR ps_team_role(workspace_id) IN ('admin','executive')));

CREATE INDEX IF NOT EXISTS ps_blob_created_by_at_idx ON public.ps_blob USING btree (created_by, created_at);

DROP TRIGGER IF EXISTS ps_err_guard_t ON public.ps_err;
CREATE TRIGGER ps_err_guard_t BEFORE INSERT ON public.ps_err FOR EACH ROW EXECUTE FUNCTION public.ps_err_guard();
DROP TRIGGER IF EXISTS ps_comm_report_guard_t ON public.ps_comm_reports;
CREATE TRIGGER ps_comm_report_guard_t BEFORE INSERT ON public.ps_comm_reports FOR EACH ROW EXECUTE FUNCTION public.ps_comm_report_guard();
DROP TRIGGER IF EXISTS ps_blob_guard_t ON public.ps_blob;
CREATE TRIGGER ps_blob_guard_t BEFORE INSERT ON public.ps_blob FOR EACH ROW EXECUTE FUNCTION public.ps_blob_guard();
DROP TRIGGER IF EXISTS ps_workspace_fixed_guard_t ON public.ps_workspaces;
CREATE TRIGGER ps_workspace_fixed_guard_t BEFORE UPDATE ON public.ps_workspaces FOR EACH ROW EXECUTE FUNCTION public.ps_workspace_fixed_guard();

DO $chk$
DECLARE c record; n bigint; pg17 boolean := current_setting('server_version_num')::integer >= 170000; t text;
BEGIN
  -- 길이 검사: 새 줄부터 지킨다(NOT VALID). 어기는 옛 줄이 하나도 없으면 바로 VALIDATE 한다.
  FOR c IN SELECT * FROM (VALUES
    ('ps_err',          'ps_err_len_chk',            $c$coalesce(char_length(kind),0) <= 40 AND coalesce(char_length(msg),0) <= 2000 AND coalesce(char_length(src),0) <= 300 AND coalesce(char_length(page),0) <= 300 AND coalesce(char_length(ua),0) <= 400$c$),
    ('ps_comm_reports', 'ps_comm_reports_len_chk',   $c$char_length(pub_id) <= 120 AND char_length(reason) <= 500$c$),
    ('ps_events',       'ps_events_meta_size_chk',   $c$octet_length(meta::text) <= 8192$c$),
    ('ps_events',       'ps_events_app_version_chk', $c$app_version IS NULL OR app_version ~ '^[A-Za-z0-9_.+-]{1,24}$'$c$),
    ('ps_events',       'ps_events_workspace_id_chk',$c$workspace_id IS NULL OR char_length(workspace_id) <= 64$c$)
  ) AS x(tbl, con, expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = ('public.'||c.tbl)::regclass AND k.conname = c.con) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.tbl, c.con, c.expr);
    END IF;
    IF NOT (SELECT k.convalidated FROM pg_constraint k WHERE k.conrelid = ('public.'||c.tbl)::regclass AND k.conname = c.con) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE NOT (%s)', c.tbl, c.expr) INTO n;
      IF n = 0 THEN EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', c.tbl, c.con);
      ELSE RAISE NOTICE '20261110_privacy: %.% 는 옛 줄 %개가 어겨 NOT VALID 로 둡니다(새 줄은 지킨다)', c.tbl, c.con, n; END IF;
    END IF;
  END LOOP;
  -- 표 권한: PostgREST 가 쓸 일이 없는 것과, 로그인 없는 흐름이 쓰지 않는 쓰기 권한
  FOREACH t IN ARRAY array['ps_admin_actions','ps_admins','ps_app_policy','ps_audit','ps_blob','ps_comm_likes','ps_comm_reports','ps_community','ps_err','ps_events','ps_guard_mode','ps_handles','ps_invites','ps_kv','ps_kv_denied','ps_kv_ping','ps_library','ps_members','ps_share','ps_usage','ps_workspaces'] LOOP
    CONTINUE WHEN to_regclass('public.'||t) IS NULL;
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated', t);
    IF pg17 THEN EXECUTE format('REVOKE MAINTAIN ON TABLE public.%I FROM anon, authenticated', t); END IF;
    EXECUTE format('REVOKE UPDATE, DELETE ON TABLE public.%I FROM anon', t);
    IF t NOT IN ('ps_comm_reports','ps_err') THEN EXECUTE format('REVOKE INSERT ON TABLE public.%I FROM anon', t); END IF;
  END LOOP;
  RAISE NOTICE '20261110_privacy: 적용';
END
$chk$;
COMMIT;
