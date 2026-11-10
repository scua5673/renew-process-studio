-- 20261110_invite_hardening 되돌리기 — 함수 아홉 · 정책 하나를 2026-10-27 기준본 글자 그대로 되살리고, 새 함수 셋과 표 ps_join_attempts 를 지운다.
-- 여러 번 실행해도 같다. 되돌리지 않는 것(자료): 적용 때 만료시킨 스태프 · 임원 코드(모든 팀원에게 보였던 코드라 되살리지 않는다 — 소유자가 새로 만든다),
-- 만료일을 붙인 옛 코드, 그 사이 만들어진 12자 코드(옛 ps_join 도 그대로 받는다), auth.users 에서 적은 멤버 이메일.
-- ⚠ 20261110_privacy_limits 를 적용했다면 그 묶음을 먼저 되돌린다(ps_delete_my_data 가 ps_perms_authorised_doc 을 쓴다).
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%ps-20261110-privacy%') THEN
    RAISE EXCEPTION '20261110_invite rollback: 20261110_privacy_limits 가 적용돼 있습니다 — 그 묶음의 rollback.sql 을 먼저 실행합니다';
  END IF;
END
$pre$;
CREATE OR REPLACE FUNCTION public.ps_join(p_code text, p_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  wid uuid; exp timestamptz; r text; pj jsonb; uid text; scopes jsonb;
begin
  select workspace_id, expires_at, member_role into wid, exp, r
    from public.ps_invites where code = upper(trim(p_code));
  if wid is null then raise exception 'invalid code'; end if;
  if exp is not null and exp < now() then raise exception 'expired'; end if;
  r := case when r in ('staff','executive') then r else 'player' end;

  insert into public.ps_members(workspace_id, user_id, email, role)
    values (wid, auth.uid(), p_email, 'member')
    on conflict (workspace_id, user_id)
    do update set email = coalesce(excluded.email, ps_members.email);

  begin
    select v::jsonb into pj from public.ps_kv
      where workspace_id = wid and k = 'cs_perms_v1' limit 1;
  exception when others then pj := null; end;

  pj := coalesce(pj, '{"defaultRole":"player","members":{}}'::jsonb);
  if jsonb_typeof(pj->'members') is distinct from 'object' then
    pj := jsonb_set(pj,'{members}','{}'::jsonb,true);
  end if;
  if not (pj ? 'defaultRole') then
    pj := jsonb_set(pj,'{defaultRole}','"player"'::jsonb,true);
  end if;

  uid := auth.uid()::text;
  scopes := case
    when r = 'executive' then '["board","schedule","team","scout","gamemodel","terms","note"]'::jsonb
    when r = 'staff' then '["board","schedule","team","gamemodel","terms","note"]'::jsonb
    else '[]'::jsonb end;
  pj := jsonb_set(pj, array['members',uid],
    jsonb_build_object('role',r,'scopes',scopes), true);

  insert into public.ps_kv(workspace_id,k,v,cupd)
    values (wid,'cs_perms_v1',pj::text,(extract(epoch from clock_timestamp())*1000)::bigint)
  on conflict (workspace_id,k) do update
    set v=excluded.v,cupd=excluded.cupd,updated_at=now();

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

CREATE OR REPLACE FUNCTION public.ps_create_invite(p_wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if not public.ps_is_owner(p_wid) then raise exception 'owner only'; end if;
  c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
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
  c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.ps_invites(code, workspace_id, created_by, expires_at) values (c, p_wid, auth.uid(), now() + interval '30 days');
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
  if not public.ps_is_owner(p_wid) then raise exception 'owner only'; end if;
  r := lower(trim(coalesce(p_role,'')));
  if r not in ('player','staff','executive') then raise exception 'invalid role'; end if;
  select code into c from public.ps_invites
    where workspace_id = p_wid and member_role = r
      and (expires_at is null or expires_at > now())
    order by created_at desc limit 1;
  if c is not null then return c; end if;
  c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.ps_invites(code, workspace_id, created_by, expires_at, member_role)
    values (c, p_wid, auth.uid(), now() + interval '30 days', r);
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
  c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
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
  c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.ps_invites(code, workspace_id, created_by, expires_at, member_role)
    values (c, p_wid, auth.uid(), now() + interval '30 days', r);
  return c;
end $function$;

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
    insert into public.ps_members(workspace_id, user_id, email, role) values (pid, auth.uid(), p_email, 'owner');
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
  insert into public.ps_members(workspace_id, user_id, email, role) values (wid, auth.uid(), p_email, 'owner');
  return wid;
end $function$;

DROP POLICY IF EXISTS inv_sel ON public.ps_invites;
CREATE POLICY inv_sel ON public.ps_invites AS PERMISSIVE FOR SELECT TO public USING (ps_is_member(workspace_id));

DROP FUNCTION IF EXISTS public.ps_perms_authorised_doc(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.ps_invite_entry(text);
DROP FUNCTION IF EXISTS public.ps_invite_code();
DROP TABLE IF EXISTS public.ps_join_attempts;
DO $done$ BEGIN RAISE NOTICE '20261110_invite rollback: 함수 · 정책 되돌림'; END $done$;
COMMIT;
