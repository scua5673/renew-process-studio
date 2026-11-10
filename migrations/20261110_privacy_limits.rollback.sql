-- 20261110_privacy_limits 되돌리기 — 함수 여섯 · 정책 하나 · 표 권한을 적용 전(기준본 · 20261028 · 20261110_invite_hardening) 그대로, 새 트리거 · 함수 · 검사 · 색인 · 표를 지운다.
-- 여러 번 실행해도 같다. 되돌리지 않는 것(자료): 이미 처리된 계정 삭제, 서버가 고쳐 적은 신고자 · 시각, 버려진 상한 초과 줄.
-- ⚠ ps_account_deletions 에 아직 처리하지 않은 줄(done_at IS NULL)이 있으면 멈춘다 — 먼저 처리하거나 줄을 다른 곳에 옮긴다.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$
DECLARE n bigint := 0;
BEGIN
  IF to_regclass('public.ps_account_deletions') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.ps_account_deletions WHERE done_at IS NULL' INTO n;
    IF n > 0 THEN RAISE EXCEPTION '20261110_privacy rollback: 처리하지 않은 계정 삭제 요청 %건이 있습니다 — 먼저 처리합니다(runbook «계정 삭제 처리»)', n; END IF;
  END IF;
END
$pre$;
DROP TRIGGER IF EXISTS ps_err_guard_t ON public.ps_err;
DROP TRIGGER IF EXISTS ps_comm_report_guard_t ON public.ps_comm_reports;
DROP TRIGGER IF EXISTS ps_blob_guard_t ON public.ps_blob;
DROP TRIGGER IF EXISTS ps_workspace_fixed_guard_t ON public.ps_workspaces;
ALTER TABLE public.ps_err DROP CONSTRAINT IF EXISTS ps_err_len_chk;
ALTER TABLE public.ps_comm_reports DROP CONSTRAINT IF EXISTS ps_comm_reports_len_chk;
ALTER TABLE public.ps_events DROP CONSTRAINT IF EXISTS ps_events_meta_size_chk;
ALTER TABLE public.ps_events DROP CONSTRAINT IF EXISTS ps_events_app_version_chk;
ALTER TABLE public.ps_events DROP CONSTRAINT IF EXISTS ps_events_workspace_id_chk;
DROP INDEX IF EXISTS public.ps_blob_created_by_at_idx;

CREATE OR REPLACE FUNCTION public.ps_members_of(p_wid uuid)
 RETURNS TABLE(user_id uuid, email text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.ps_is_member(p_wid) then raise exception 'not a member'; end if;
  return query select m.user_id, m.email, m.role from public.ps_members m where m.workspace_id = p_wid order by (m.role='owner') desc, m.joined_at;
end $function$;

CREATE OR REPLACE FUNCTION public.ps_members_of_v2(p_wid uuid)
 RETURNS TABLE(user_id uuid, name text, email text, role text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.ps_members m where m.workspace_id = p_wid and m.user_id = auth.uid()) then
    raise exception 'not a member';
  end if;
  return query
  select m.user_id,
         coalesce(
           m.name,
           case when m.email like '%@%' then null else m.email end,
           u.raw_user_meta_data->>'name',
           u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'preferred_username'
         ) as name,
         coalesce(
           case when m.email like '%@%' then m.email else null end,
           u.email::text,
           u.raw_user_meta_data->>'email'
         ) as email,
         m.role::text, m.joined_at
  from public.ps_members m
  left join auth.users u on u.id = m.user_id
  where m.workspace_id = p_wid
  order by (m.role = 'owner') desc, m.joined_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ps_delete_my_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  delete from public.ps_comm_likes where uid = me;
  delete from public.ps_community  where owner = me;
  delete from public.ps_handles    where uid = me;
  begin
    delete from public.ps_usage where user_id = me;
  exception when undefined_table then null;
  end;
  delete from public.ps_members m
   using public.ps_workspaces w
   where m.workspace_id = w.id
     and m.user_id = me
     and not (w.owner_id = me and w.kind = 'personal');
  delete from public.ps_workspaces w
   where w.owner_id = me and w.kind = 'personal';
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
  select max(e.app_version::numeric) into latest from public.ps_events e
    where e.created_at > now()-interval '48 hours' and e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$';
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
  select max(e.app_version::numeric) into latest from public.ps_events e
    where e.created_at > now()-make_interval(hours=>hours) and e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$';
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

DROP POLICY IF EXISTS mem_sel ON public.ps_members;
CREATE POLICY mem_sel ON public.ps_members AS PERMISSIVE FOR SELECT TO public USING (ps_is_member(workspace_id));

DROP FUNCTION IF EXISTS public.ps_err_guard();
DROP FUNCTION IF EXISTS public.ps_comm_report_guard();
DROP FUNCTION IF EXISTS public.ps_blob_guard();
DROP FUNCTION IF EXISTS public.ps_workspace_fixed_guard();
DROP FUNCTION IF EXISTS public.ps_rate_bump(text);
DROP FUNCTION IF EXISTS public.ps_latest_app_version(timestamptz);
DROP TABLE IF EXISTS public.ps_rate_counters;
DROP TABLE IF EXISTS public.ps_account_deletions;

DO $grants$
DECLARE pg17 boolean := current_setting('server_version_num')::integer >= 170000;
BEGIN
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_admin_actions TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_admin_actions TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_admin_actions TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_admin_actions TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_admins TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_admins TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_admins TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_admins TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_app_policy TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_app_policy TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_app_policy TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_app_policy TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_audit TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_audit TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_audit TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_audit TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_blob TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_blob TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_blob TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_blob TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_comm_likes TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_comm_likes TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_comm_likes TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_comm_likes TO authenticated; END IF;
  GRANT DELETE, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_comm_reports TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_comm_reports TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_comm_reports TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_comm_reports TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_community TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_community TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_community TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_community TO authenticated; END IF;
  GRANT DELETE, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_err TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_err TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_err TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_err TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_events TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_events TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_events TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_events TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_guard_mode TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_guard_mode TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_guard_mode TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_guard_mode TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_handles TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_handles TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_handles TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_handles TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_invites TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_invites TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_invites TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_invites TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_kv TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_kv TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_kv TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_kv TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_kv_denied TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_kv_denied TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_kv_denied TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_kv_denied TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_kv_ping TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_kv_ping TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_kv_ping TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_kv_ping TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_library TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_library TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_library TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_library TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_members TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_members TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_members TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_members TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_share TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_share TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_share TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_share TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_usage TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_usage TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_usage TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_usage TO authenticated; END IF;
  GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ps_workspaces TO anon;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_workspaces TO anon; END IF;
  GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.ps_workspaces TO authenticated;
  IF pg17 THEN GRANT MAINTAIN ON TABLE public.ps_workspaces TO authenticated; END IF;
  RAISE NOTICE '20261110_privacy rollback: 함수 · 정책 · 권한 되돌림';
END
$grants$;
COMMIT;
