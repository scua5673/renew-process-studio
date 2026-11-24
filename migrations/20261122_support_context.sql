-- 관리자 «오류 제보» 옆 칸 — 제보 한 건의 사정(ps_support_context) · 목록 꼬리표(ps_support_list_flags).
-- 추가 전용 · 멱등 · 읽기 전용. ps_events 의 시각 · 이벤트 이름 · 화면 · 기기 종류 · 판 번호 · 오류 이름 · 상태와
-- ps_sync_reports 의 대기 수만 읽는다(meta 본문 · 팀 자료 · IDP · 일지 · 보관함 · 다른 사람의 신원은 읽지 않는다).
-- 배경: 제보자를 찾으려고 관리자 탭 콘솔에서 ps_events 를 손으로 조회했다(판-기록 2.9xx). 제보를 열면 그 앞뒤가 같은 화면에 보이게 한다.
begin;

-- ① 제보 하나의 사정(관리자만).
--    events : 제보 시각 앞뒤 p_minutes 분의 제보자 이벤트(가까운 것부터 120줄까지 · 시간순으로 돌려준다)
--    sync   : 제보자의 가장 최근 기기 보고(저장 대기 수)
--    errors : 제보 직전(앞 p_minutes 분 ~ 뒤 5분) 제보자에게 난 오류 이름 셋까지 — 제보 앞 7일 ~ 뒤 1일 동안 그 오류를 겪은 사람 수 · 건수 · 판 범위
--    fixed  : «고친 판»이 적혀 있으면 기기마다 그 판을 처음 받은 때 · 그 뒤 같은 오류 수
create or replace function public.ps_support_context(p_report_id uuid, p_minutes integer default 30)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare who uuid; at0 timestamptz; fixed text; fixv numeric; mins integer:=least(greatest(coalesce(p_minutes,30),5),180);
  ev jsonb; sy jsonb; er jsonb; fx jsonb; devs jsonb; aft jsonb; codes text[];
begin
  if auth.uid() is null or public.ps_is_admin() is not true then raise exception using errcode='42501', message='support_not_admin'; end if;
  select r.reporter_id, r.created_at, r.fixed_in into who, at0, fixed from public.ps_support_reports r where r.id=p_report_id;
  if who is null then raise exception using errcode='PT404', message='report_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('at',s.created_at,'event_name',s.event_name,'feature',s.feature,
      'device',coalesce(nullif(s.device,''),'unknown'),'app_version',s.app_version,'error_code',s.error_code,'status',s.status)
      order by s.created_at, s.id),'[]'::jsonb) into ev
  from (
    select e.id, e.created_at, e.event_name, e.feature, e.device, e.app_version, e.error_code, e.status
    from public.ps_events e
    where e.user_id=who and e.created_at >= at0-make_interval(mins=>mins) and e.created_at <= at0+make_interval(mins=>mins)
    order by abs(extract(epoch from (e.created_at-at0))), e.id
    limit 120
  ) s;

  select jsonb_build_object('received_at',s.received_at,'device',s.device_class,'app_version',s.app_version,
      'pending_team',s.pending_team,'pending_personal',s.pending_personal,'held',s.held,'conflicts',s.conflicts,'oldest_pending_at',s.oldest_pending_at)
    into sy
  from public.ps_sync_reports s where s.user_id=who order by s.received_at desc limit 1;

  select array_agg(c.error_code order by c.n desc, c.error_code) into codes from (
    select e.error_code, count(*) as n from public.ps_events e
    where e.user_id=who and e.status='error' and coalesce(e.error_code,'')<>''
      and e.created_at >= at0-make_interval(mins=>mins) and e.created_at <= at0+interval '5 minutes'
    group by 1 order by count(*) desc, 1 limit 3
  ) c;

  if codes is null then er:='[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('code',g.error_code,'mine',g.mine,'users',g.users,'count',g.n,
        'min_version',to_char(g.vmin,'FM99.000'),'max_version',to_char(g.vmax,'FM99.000')) order by g.mine desc, g.error_code),'[]'::jsonb) into er
    from (
      select e.error_code, count(*) as n, count(distinct e.user_id) as users,
        count(*) filter (where e.user_id=who and e.created_at >= at0-make_interval(mins=>mins) and e.created_at <= at0+interval '5 minutes') as mine,
        min(case when e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$' then e.app_version::numeric end) as vmin,
        max(case when e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$' then e.app_version::numeric end) as vmax
      from public.ps_events e
      where e.status='error' and e.error_code = any(codes)
        and e.created_at > at0-interval '7 days' and e.created_at < at0+interval '1 day'
      group by 1
    ) g;
  end if;

  if fixed is not null and fixed ~ '^[0-9]{1,2}\.[0-9]{3}$' then
    fixv:=fixed::numeric;
    select coalesce(jsonb_agg(jsonb_build_object('device',d.device,'received_at',d.got,'latest_version',to_char(d.top,'FM99.000'),'last_at',d.last_at)
        order by d.last_at desc),'[]'::jsonb) into devs
    from (
      select v.device, min(v.created_at) filter (where v.ver >= fixv) as got, max(v.ver) as top, max(v.created_at) as last_at
      from (
        select coalesce(nullif(e.device,''),'unknown') as device, e.created_at,
          case when e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$' then e.app_version::numeric end as ver
        from public.ps_events e where e.user_id=who and e.created_at > at0-interval '1 day'
      ) v where v.ver is not null
      group by 1 order by max(v.created_at) desc limit 8
    ) d;
    if codes is null then aft:=null;
    else
      select jsonb_build_object('mine',count(*) filter (where v.user_id=who),'users',count(distinct v.user_id),'count',count(*)) into aft
      from (
        select e.user_id, case when e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$' then e.app_version::numeric end as ver
        from public.ps_events e
        where e.status='error' and e.error_code = any(codes) and e.created_at > at0
      ) v where v.ver >= fixv;
    end if;
    fx:=jsonb_build_object('version',fixed,'devices',devs,'after',aft);
  end if;

  return jsonb_build_object('report_at',at0,'minutes',mins,'events',ev,'sync',sy,'errors',er,'fixed',fx);
end $$;
revoke all on function public.ps_support_context(uuid,integer) from public,anon,authenticated;
grant execute on function public.ps_support_context(uuid,integer) to authenticated;

-- ② 목록 꼬리표(관리자만) — 제보 id 마흔 개까지. 제보마다
--    version      : 제보 무렵(제보 10분 뒤까지) 제보자가 마지막으로 쓴 판
--    fixed_seen   : «고친 판»이 적혀 있을 때 제보 뒤 그 판 이상으로 접속했는가(제보 뒤 기록이 없으면 null — «확인 못 함»)
--    seen_version : 제보 뒤 제보자가 쓴 가장 새 판
create or replace function public.ps_support_list_flags(p_ids uuid[])
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare found jsonb;
begin
  if auth.uid() is null or public.ps_is_admin() is not true then raise exception using errcode='42501', message='support_not_admin'; end if;
  if p_ids is null or coalesce(array_length(p_ids,1),0)=0 then return '{}'::jsonb; end if;
  if array_length(p_ids,1) > 40 then raise exception using errcode='22023', message='support_invalid'; end if;
  select coalesce(jsonb_object_agg(r.id::text, jsonb_build_object(
      'version',to_char(b.ver,'FM99.000'),
      'seen_version',to_char(a.top,'FM99.000'),
      'fixed_seen',case when r.fixed_in is null or r.fixed_in !~ '^[0-9]{1,2}\.[0-9]{3}$' or a.top is null then null else a.top >= r.fixed_in::numeric end)),'{}'::jsonb)
    into found
  from public.ps_support_reports r
  left join lateral (
    select e.app_version::numeric as ver from public.ps_events e
    where e.user_id=r.reporter_id and e.created_at <= r.created_at+interval '10 minutes' and e.created_at > r.created_at-interval '7 days'
      and e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$'
    order by e.created_at desc limit 1
  ) b on true
  left join lateral (
    select max(e.app_version::numeric) as top from public.ps_events e
    where e.user_id=r.reporter_id and e.created_at > r.created_at and e.app_version ~ '^[0-9]{1,2}\.[0-9]{3}$'
  ) a on true
  where r.id = any(p_ids);
  return found;
end $$;
revoke all on function public.ps_support_list_flags(uuid[]) from public,anon,authenticated;
grant execute on function public.ps_support_list_flags(uuid[]) to authenticated;

commit;
