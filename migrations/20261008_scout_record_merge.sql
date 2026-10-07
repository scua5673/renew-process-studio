-- ════════════════════════════════════════════════════════════════════════
-- 20261008 · 선수단 기록 서버 합치기(ps_kv_scout_record_merge) — 유료 전환 문턱 4번 «항목 단위로»의 1단계
-- 왜: 가용인원 기록(meta.statusRuns·participationDays·injuryInfo)은 선수단 문서(scout_tool_v1) 한 통에 들어 있어,
--     낡은 사본을 든 기기가 저장하면 그 사이 쌓인 날들이 통째로 사라졌다(2.948 — 9/6~10/6 15팀 34건, 10/7 복구).
--     20261006 가드는 «칸이 통째로 빠진» 저장만 막는다. 칸은 있는데 날이 모자란 저장(옛 meta 로 저장 · {} 로 시작한
--     옛 판)은 그대로 지나간다.
-- 왜 키를 쪼개지 않고 서버에서 합치나: 기록을 sr:<선수> 같은 새 키로 옮기면 옛 판이 meta 칸을 다시 만들어 덮고
--     (판 하한을 새 판까지 올려야 막힌다 — 2026-10-07 실측으로 사용자 42% 가 막힌다), 선수에게 부상 기록을 숨기는
--     읽기 규칙도 새로 걸어야 한다. 이 트리거는 문서 모양을 그대로 두고 모든 판에 바로 듣는다.
-- 규칙(scout_tool_v1 의 UPDATE, 새 판의 meta 에 그 칸이 «있을 때만» — 칸이 통째로 없으면 20261006 가드가 이미 판정했다):
--   statusRuns        서버 판에 있는 (선수·날)이 새 판에 없으면 그 날을 되살린다. 새 판에 있는 날은 새 판이 이긴다.
--                     되살린 선수만 날 단위로 다시 구간으로 묶는다 — 손대지 않은 선수의 배열은 바이트 그대로.
--   participationDays (날·선수) 칸이 새 판에 없거나 서버 칸의 at 이 더 늦으면 서버 칸. 같으면 새 판.
--   injuryInfo        (선수·첫날)이 새 판에 없거나 서버 쪽 at 이 더 늦으면 서버 것.
--   잃은 것이 없으면 새 판을 그대로 둔다(바이트 그대로). 앱에는 기록을 지우는 길이 없다 — 사라지는 날은 늘 사고다.
-- 실패하면 열린다: 합치다 오류가 나면(깨진 날짜 등) 새 판을 그대로 받는다 — 이 트리거 때문에 저장이 막히는 일은 없다.
-- cupd 는 새 판 것 그대로 — 올린 기기는 «확인됨»으로 보고, 다른 기기는 실시간 핑으로 합친 판을 받는다.
-- 기록: 되살린 날이 있으면 데이터 사고 기록장(20261007_incident_ledger, 있으면)에 near_miss 를 팀·날마다 한 줄.
-- 트리거 순서: ps_00c_scout_record_guard_t(칸 통째 빠짐 거부) 다음, 팀 쓰기 가드(ps_kv_team_guard_t) 앞.
-- 재실행 안전. 되돌리기: 20261008_scout_record_merge.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $preflight$
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
  IF to_regclass('public.ps_kv') IS NULL THEN RAISE EXCEPTION 'public.ps_kv missing'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.ps_srm_obj(j jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $f$
  SELECT CASE WHEN jsonb_typeof(j)='object' THEN j ELSE '{}'::jsonb END $f$;

CREATE OR REPLACE FUNCTION public.ps_srm_at(c jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $f$
  SELECT CASE WHEN jsonb_typeof(c->'at')='number' THEN (c->>'at')::numeric ELSE 0 END $f$;

/* 한 선수의 구간 배열 → (날, 상태, 메모). 한 배열 안에서 겹치면 뒤 구간이 이긴다(앱이 덧붙이는 순서). */
CREATE OR REPLACE FUNCTION public.ps_srm_days(arr jsonb) RETURNS TABLE(dy date, s text, nn jsonb)
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $f$
  SELECT DISTINCT ON (x.dy) x.dy, x.s, x.nn FROM (
    SELECT dd::date dy, e.value->>'s' s,
           CASE WHEN jsonb_typeof(e.value->'n')='string' THEN e.value->'n' END nn, e.ord
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(arr)='array' THEN arr ELSE '[]'::jsonb END) WITH ORDINALITY e(value, ord),
           generate_series((e.value->>'from')::date, (e.value->>'to')::date, interval '1 day') dd
     WHERE jsonb_typeof(e.value)='object' AND jsonb_typeof(e.value->'s')='string'
       AND coalesce(e.value->>'from','') ~ '^\d{4}-\d{2}-\d{2}$' AND coalesce(e.value->>'to','') ~ '^\d{4}-\d{2}-\d{2}$'
       AND (e.value->>'from') <= (e.value->>'to')
       AND (e.value->>'to')::date - (e.value->>'from')::date <= 400) x
  ORDER BY x.dy, x.ord DESC $f$;

/* statusRuns 합치기. 잃은 날이 없으면 null. 있으면 {runs, lost(날 수), players(선수 수)}. */
CREATE OR REPLACE FUNCTION public.ps_srm_merge_runs(o jsonb, n jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public, pg_catalog AS $f$
  WITH od AS (SELECT p.key pid, x.dy, x.s, x.nn FROM jsonb_each(public.ps_srm_obj(o)) p, public.ps_srm_days(p.value) x),
  nd AS (SELECT p.key pid, x.dy, x.s, x.nn FROM jsonb_each(public.ps_srm_obj(n)) p, public.ps_srm_days(p.value) x),
  lost AS (SELECT od.* FROM od WHERE NOT EXISTS (SELECT 1 FROM nd WHERE nd.pid=od.pid AND nd.dy=od.dy)),
  aff AS (SELECT DISTINCT pid FROM lost),
  merged AS (SELECT pid, dy, s, nn FROM nd WHERE pid IN (SELECT pid FROM aff)
             UNION ALL SELECT pid, dy, s, nn FROM lost),
  g AS (SELECT pid, dy, s, nn, dy - (row_number() OVER (PARTITION BY pid, s, coalesce(nn::text,'') ORDER BY dy))::int grp FROM merged),
  runs AS (SELECT pid, s, nn, min(dy) f, max(dy) t FROM g GROUP BY pid, s, nn, grp),
  arrs AS (SELECT pid, jsonb_agg(jsonb_strip_nulls(jsonb_build_object('s', s, 'from', to_char(f,'YYYY-MM-DD'),
                    'to', to_char(t,'YYYY-MM-DD'), 'n', nn)) ORDER BY f) arr FROM runs GROUP BY pid)
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM lost) THEN NULL ELSE jsonb_build_object(
    'runs', public.ps_srm_obj(n) || (SELECT jsonb_object_agg(pid, arr) FROM arrs),
    'lost', (SELECT count(*) FROM lost), 'players', (SELECT count(*) FROM aff)) END $f$;

/* participationDays 합치기. 잃은(또는 서버가 더 늦은) 칸이 없으면 null. */
CREATE OR REPLACE FUNCTION public.ps_srm_merge_days(o jsonb, n jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public, pg_catalog AS $f$
  WITH oc AS (SELECT d.key dy, p.key pid, p.value cell FROM jsonb_each(public.ps_srm_obj(o)) d, jsonb_each(public.ps_srm_obj(d.value)) p
               WHERE jsonb_typeof(p.value)='object'),
  nc AS (SELECT d.key dy, p.key pid, p.value cell FROM jsonb_each(public.ps_srm_obj(n)) d, jsonb_each(public.ps_srm_obj(d.value)) p
               WHERE jsonb_typeof(p.value)='object'),
  win AS (SELECT oc.dy, oc.pid, oc.cell FROM oc LEFT JOIN nc ON nc.dy=oc.dy AND nc.pid=oc.pid
           WHERE nc.cell IS NULL OR public.ps_srm_at(oc.cell) > public.ps_srm_at(nc.cell)),
  touched AS (SELECT DISTINCT dy FROM win),
  rebuilt AS (SELECT dy, jsonb_object_agg(pid, cell) cells FROM (
                SELECT nc.dy, nc.pid, nc.cell FROM nc WHERE nc.dy IN (SELECT dy FROM touched)
                   AND NOT EXISTS (SELECT 1 FROM win w WHERE w.dy=nc.dy AND w.pid=nc.pid)
                UNION ALL SELECT dy, pid, cell FROM win) u GROUP BY dy)
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM win) THEN NULL ELSE jsonb_build_object(
    'days', public.ps_srm_obj(n) || (SELECT jsonb_object_agg(dy, public.ps_srm_obj(public.ps_srm_obj(n)->dy) || cells) FROM rebuilt),
    'lost', (SELECT count(*) FROM win)) END $f$;

/* injuryInfo 합치기 — 모양은 participationDays 와 같다({선수: {첫날: 내용}}). */
CREATE OR REPLACE FUNCTION public.ps_srm_merge_injury(o jsonb, n jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public, pg_catalog AS $f$
  SELECT CASE WHEN r IS NULL THEN NULL ELSE jsonb_build_object('info', r->'days', 'lost', r->'lost') END
    FROM (SELECT public.ps_srm_merge_days(o, n) r) z $f$;

CREATE OR REPLACE FUNCTION public.ps_kv_scout_record_merge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_catalog AS $fn$
DECLARE
  o jsonb; n jsonb; om jsonb; nm jsonb; r jsonb;
  runs_lost int := 0; run_players int := 0; days_lost int := 0; inj_lost int := 0;
  note text;
BEGIN
  IF new.k IS DISTINCT FROM 'scout_tool_v1' OR new.v IS NOT DISTINCT FROM old.v THEN RETURN new; END IF;
  BEGIN
    o := old.v::jsonb; n := new.v::jsonb;
    IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR jsonb_typeof(n) IS DISTINCT FROM 'object'
       OR jsonb_typeof(n->'meta') IS DISTINCT FROM 'object' THEN RETURN new; END IF;
    om := public.ps_srm_obj(o->'meta'); nm := n->'meta';

    IF jsonb_typeof(om->'statusRuns')='object' AND jsonb_typeof(nm->'statusRuns')='object' THEN
      r := public.ps_srm_merge_runs(om->'statusRuns', nm->'statusRuns');
      IF r IS NOT NULL THEN
        nm := jsonb_set(nm, '{statusRuns}', r->'runs');
        runs_lost := (r->>'lost')::int; run_players := (r->>'players')::int;
      END IF;
    END IF;
    IF jsonb_typeof(om->'participationDays')='object' AND jsonb_typeof(nm->'participationDays')='object' THEN
      r := public.ps_srm_merge_days(om->'participationDays', nm->'participationDays');
      IF r IS NOT NULL THEN nm := jsonb_set(nm, '{participationDays}', r->'days'); days_lost := (r->>'lost')::int; END IF;
    END IF;
    IF jsonb_typeof(om->'injuryInfo')='object' AND jsonb_typeof(nm->'injuryInfo')='object' THEN
      r := public.ps_srm_merge_injury(om->'injuryInfo', nm->'injuryInfo');
      IF r IS NOT NULL THEN nm := jsonb_set(nm, '{injuryInfo}', r->'info'); inj_lost := (r->>'lost')::int; END IF;
    END IF;

    IF runs_lost + days_lost + inj_lost = 0 THEN RETURN new; END IF;
    new.v := jsonb_set(n, '{meta}', nm)::text;
  EXCEPTION WHEN others THEN
    RETURN new;                      -- 열린 실패: 합치기 오류로 저장을 막지 않는다
  END;

  /* 기록장이 있으면 팀·날마다 한 줄. 기록장 쪽 오류는 저장에 영향을 주지 않는다. */
  BEGIN
    IF to_regclass('public.ps_incidents') IS NOT NULL THEN
      note := '상태 기록 '||runs_lost||'일(선수 '||run_players||') · 출석 칸 '||days_lost||' · 부상 기록 '||inj_lost
              ||' — 저장자 '||coalesce(left(auth.uid()::text, 8), '서버');
      INSERT INTO public.ps_incidents(kind, workspace_id, title, detail)
      SELECT 'near_miss', new.workspace_id, '낡은 사본 저장이 빠뜨린 가용인원 기록을 서버가 합쳐 지킴', note
       WHERE NOT EXISTS (SELECT 1 FROM public.ps_incidents i
                          WHERE i.kind='near_miss' AND i.workspace_id IS NOT DISTINCT FROM new.workspace_id
                            AND i.title='낡은 사본 저장이 빠뜨린 가용인원 기록을 서버가 합쳐 지킴'
                            AND i.at > now() - interval '1 day');
    END IF;
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN new;
END $fn$;
COMMENT ON FUNCTION public.ps_kv_scout_record_merge() IS 'process-studio/scout-record-merge/20261008/v1';
REVOKE ALL ON FUNCTION public.ps_kv_scout_record_merge() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ps_00d_scout_record_merge_t ON public.ps_kv;
CREATE TRIGGER ps_00d_scout_record_merge_t BEFORE UPDATE ON public.ps_kv
  FOR EACH ROW WHEN (new.k = 'scout_tool_v1') EXECUTE FUNCTION public.ps_kv_scout_record_merge();
COMMIT;
