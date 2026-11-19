-- 20261119_roster_growth_guard — 선수 명단이 «갑자기 불어나는» 저장 거부를 실제 중복일 때만(제보 d543557f).
-- ps_kv_shape_guard 는 cs_squad_v1 · scout_tool_v1 의 선수 수가 10명 이상에서 1.6배 넘게 늘면 옛 값으로 되돌렸다(옛 판의 «2배» 사고 막이).
-- 명단을 갈아 끼우거나 한 번에 많이 등록하는 정상 저장도 같이 막혔다(최근 30일 15번 · 10팀 — 거부되면 기기 변경이 올라가지 못한 채 남는다).
-- 바꾸는 것: 그 가지에 조건 하나 — 새 명단에서 같은 (이름, 등번호)가 되풀이된 수가 늘어난 수의 절반 이상일 때만 막는다. 나머지(경기 점수 · 0명 · 거부 기록 · 문구)는 글자 그대로.
-- 멱등 · 한 트랜잭션. 운영이 예상과 다르면 예외로 멈추고 아무것도 바꾸지 않는다. 순서 · 기대 결과는 20261119_roster_growth_guard.runbook.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$
DECLARE got text; done boolean; trg text;
BEGIN
  IF to_regprocedure('public.ps_kv_shape_guard()') IS NULL THEN RAISE EXCEPTION '20261119_roster_growth_guard: public.ps_kv_shape_guard() 이 없습니다 — 아무것도 바꾸지 않았습니다'; END IF;
  SELECT md5(p.prosrc), p.prosrc LIKE '%ps-20261119-roster-growth%' INTO got, done FROM pg_proc p WHERE p.oid = 'public.ps_kv_shape_guard()'::regprocedure;
  IF NOT done AND got <> 'fd40ab18d81f34de23f9dd578724c7ee' THEN
    RAISE EXCEPTION '20261119_roster_growth_guard: ps_kv_shape_guard 본문이 예상(기준본)과 다릅니다(md5 %) — 아무것도 바꾸지 않았습니다', got;
  END IF;
  SELECT pg_get_triggerdef(t.oid) INTO trg FROM pg_trigger t WHERE t.tgrelid = 'public.ps_kv'::regclass AND t.tgname = 'ps_00b_shape_guard_t' AND NOT t.tgisinternal;
  IF trg IS NULL OR trg NOT LIKE '%BEFORE UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION ps_kv_shape_guard()%' THEN
    RAISE EXCEPTION '20261119_roster_growth_guard: 트리거 ps_00b_shape_guard_t 가 예상과 다릅니다(%) — 아무것도 바꾸지 않았습니다', coalesce(trg, '없음');
  END IF;
END $pre$;

CREATE OR REPLACE FUNCTION public.ps_kv_shape_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o int; n int; d int; why text;   -- ps-20261119-roster-growth
begin
  if new.k='cs_team_matches_v1' then
    begin
      select count(*) into o from jsonb_array_elements(old.v::jsonb->'matches') m where coalesce(m->>'scoreUs','')<>'' or coalesce(m->>'scoreThem','')<>'';
      select count(*) into n from jsonb_array_elements(new.v::jsonb->'matches') m where coalesce(m->>'scoreUs','')<>'' or coalesce(m->>'scoreThem','')<>'';
    exception when others then return new; end;
    if o>=5 and n<=o/2 then why:='경기 점수 '||o||'개 중 '||(o-n)||'개가 사라지는 저장을 막았어요 — 앱을 새로고침하면 팀 것으로 맞춰져요'; end if;
  elsif new.k in ('cs_squad_v1','scout_tool_v1') then
    begin o:=jsonb_array_length(old.v::jsonb->'players'); n:=jsonb_array_length(new.v::jsonb->'players'); exception when others then return new; end;
    if o>=10 and n>o*1.6 then
      /* 20261119 — 늘어난 수만으로 막지 않는다(제보 d543557f: 옛 14명을 지우고 새 59명을 넣은 저장을 «중복»으로 막았다).
         새 명단에서 같은 (이름, 등번호)가 되풀이된 수 d 가 늘어난 수의 절반 이상일 때만 중복으로 본다. 이름 없는 줄은 서로 같은 것으로 센다. 못 세면 예전처럼 막는다. */
      begin
        select n - count(distinct lower(btrim(coalesce(p->>'name','')))||chr(31)||btrim(coalesce(p->>'num',''))) into d
          from jsonb_array_elements(new.v::jsonb->'players') p;
      exception when others then d:=n; end;
      if d is null or d*2>=n-o then why:='선수가 '||o||'명에서 '||n||'명으로 갑자기 불어나는 저장을 막았어요(중복 의심) — 앱을 새로고침하면 팀 것으로 맞춰져요'; end if;
    elsif o>=10 and n=0 then why:='선수 '||o||'명이 전부 사라지는 저장을 막았어요 — 앱을 새로고침하면 팀 것으로 맞춰져요'; end if;
  end if;
  if why is null then return new; end if;
  begin perform public.ps_kv_note_denied(new.workspace_id, auth.uid(), new.k, why); exception when others then null; end;
  return old;
end $function$;
COMMIT;
