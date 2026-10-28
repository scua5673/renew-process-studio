-- 3.198 — 관리자 화면 «제보자 기기 현황» · «옛 판으로 도는 기기».
-- 추가 전용 · 멱등. ps_events 의 판 번호 · 기기 종류 · 이벤트 이름 · 횟수만 읽는다(meta 본문 · 팀 자료 · 글은 읽지 않는다).
-- 배경: 10/27 제보 381d132d — 제보자의 아이패드가 3.131 에 일주일 머물며 꺼지고 있었는데, 답변마다 «새 판에서 고쳤다»고만 안내했다.
--       제보를 열 때 그 사람의 기기마다 앱 판이 바로 보이면 그런 일이 없다.
begin;

-- ① 제보자의 최근 기기 현황(관리자만). 기기 종류 × 앱 판별로 마지막 접속 · 이벤트 수 · 비정상 종료 · 저장공간 가득 · 동기화 실패 횟수.
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
revoke all on function public.ps_support_reporter_devices(uuid,integer) from public,anon,authenticated;
grant execute on function public.ps_support_reporter_devices(uuid,integer) to authenticated;

-- ② 최근 p_hours 시간 안에 «가장 새 판보다 p_behind 판 이상 뒤진 판»으로 이벤트를 남긴 기기(사용자 × 기기 × 판).
--    기본 20판 — 지금은 하루 8판쯤 나오므로 10판은 «어제 안 연 폰»까지 잡았다(10/28 확인: 60줄 중 대부분이 3.18x 폰). 이벤트 많은 줄이 먼저.
--    newer_seen 은 같은 사람 · 같은 기기 종류가 그 뒤 새 판으로도 접속했는가(그 줄은 «이미 올라옴»으로 보인다).
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
revoke all on function public.ps_admin_stale_clients(integer,integer) from public,anon,authenticated;
grant execute on function public.ps_admin_stale_clients(integer,integer) to authenticated;

commit;
