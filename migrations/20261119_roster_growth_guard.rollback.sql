-- 20261119_roster_growth_guard 되돌리기 — ps_kv_shape_guard 를 기준본 본문(md5 fd40ab18d81f34de23f9dd578724c7ee)으로. 멱등 · 한 트랜잭션.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.ps_kv_shape_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o int; n int; why text;
begin
  if new.k='cs_team_matches_v1' then
    begin
      select count(*) into o from jsonb_array_elements(old.v::jsonb->'matches') m where coalesce(m->>'scoreUs','')<>'' or coalesce(m->>'scoreThem','')<>'';
      select count(*) into n from jsonb_array_elements(new.v::jsonb->'matches') m where coalesce(m->>'scoreUs','')<>'' or coalesce(m->>'scoreThem','')<>'';
    exception when others then return new; end;
    if o>=5 and n<=o/2 then why:='경기 점수 '||o||'개 중 '||(o-n)||'개가 사라지는 저장을 막았어요 — 앱을 새로고침하면 팀 것으로 맞춰져요'; end if;
  elsif new.k in ('cs_squad_v1','scout_tool_v1') then
    begin o:=jsonb_array_length(old.v::jsonb->'players'); n:=jsonb_array_length(new.v::jsonb->'players'); exception when others then return new; end;
    if o>=10 and n>o*1.6 then why:='선수가 '||o||'명에서 '||n||'명으로 갑자기 불어나는 저장을 막았어요(중복 의심) — 앱을 새로고침하면 팀 것으로 맞춰져요';
    elsif o>=10 and n=0 then why:='선수 '||o||'명이 전부 사라지는 저장을 막았어요 — 앱을 새로고침하면 팀 것으로 맞춰져요'; end if;
  end if;
  if why is null then return new; end if;
  begin perform public.ps_kv_note_denied(new.workspace_id, auth.uid(), new.k, why); exception when others then null; end;
  return old;
end $function$;
DO $post$
BEGIN
  IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid='public.ps_kv_shape_guard()'::regprocedure) <> 'fd40ab18d81f34de23f9dd578724c7ee' THEN
    RAISE EXCEPTION '20261119_roster_growth_guard rollback: 되돌린 본문이 기준본과 다릅니다';
  END IF;
END $post$;
COMMIT;
