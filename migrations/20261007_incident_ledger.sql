-- ════════════════════════════════════════════════════════════════════════
-- 20261007 · 데이터 사고 기록장(ps_incidents) + 관리자 점검(ps_admin_incidents)
-- 왜: 유료 전환 문턱 1번 = «8주 연속 데이터 사고 0건». 지금은 사고를 세는 곳이 없다 —
--     복구는 SQL 편집기에서 손으로 했고, 기록은 AGENTS.md 문장에만 남았다.
--     세지 않는 것은 문턱이 될 수 없다. 그래서 세 가지를 한 곳에 모은다.
--   ① 기록장(ps_incidents) — 사람이 확인한 사고. 종류: loss(자료가 사라지거나 덮였다) ·
--      restore(복구 작업을 했다) · near_miss(가드가 막았지만 알아 둘 것).
--      «마지막 사고»는 loss·restore 만 센다.
--   ② 자동 감지(drops) — 최근 판 이력(ps_kv_history)에서 팀 문서가 한 번에 크게 줄어든 저장.
--      사고 «후보»일 뿐이다(정상 정리도 걸린다). 사람이 보고 기록장에 옮긴다.
--      · 선수단(scout_tool_v1): 선수 수 · 상태 기록(statusRuns) 선수 수 · 출석 기록 날 수가 30% 넘게 줄면
--      · 경기(cs_team_matches_v1): 경기 수 · 점수 적힌 경기 수가 30% 넘게 줄면
--      · 일정(process_coach_v1): 길이가 절반 아래로 줄면(2MB 문서라 해석하지 않고 길이만)
--   ③ 가드가 막은 것(guards) — ps_kv_denied 를 종류별로. ⚠ 그 표는 (팀·사람·키)마다 마지막 1건만 남긴다 —
--      건수가 아니라 «걸린 사람·키 수»다.
-- 문서 내용은 돌려주지 않는다(개수·길이·이름표만). 관리자만(ps_is_admin). 쓰기는 기록장 한 표뿐.
-- 재실행 안전. 되돌리기: 20261007_incident_ledger.rollback.sql
-- ════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $preflight$
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
  IF to_regprocedure('public.ps_is_admin()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'existing admin helpers required';
  END IF;
  IF to_regclass('public.ps_kv_history') IS NULL OR to_regclass('public.ps_kv_denied') IS NULL
     OR to_regclass('public.ps_kv') IS NULL OR to_regclass('public.ps_workspaces') IS NULL THEN
    RAISE EXCEPTION 'expected tables missing';
  END IF;
END $preflight$;

CREATE TABLE IF NOT EXISTS public.ps_incidents(
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  kind        text NOT NULL CHECK (kind IN ('loss','restore','near_miss')),
  workspace_id uuid,
  title       text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  detail      text CHECK (detail IS NULL OR length(detail) <= 2000),
  recorded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  seed_key    text UNIQUE            -- 이 파일이 심는 지난 사고 — 다시 실행해도 두 번 들어가지 않게
);
ALTER TABLE public.ps_incidents ENABLE ROW LEVEL SECURITY;   -- 정책 없음 = 앱 계정은 직접 못 읽고 못 쓴다(아래 RPC 로만)
REVOKE ALL ON public.ps_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ps_incidents_id_seq FROM PUBLIC, anon, authenticated;

/* 한 판의 «셀 수 있는 것». 깨진 JSON·모르는 키는 null — 한 행 때문에 점검 전체가 죽지 않게. */
CREATE OR REPLACE FUNCTION public.ps_incident_counts(p_k text, p_v text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $fn$
DECLARE j jsonb;
BEGIN
  IF p_v IS NULL THEN RETURN NULL; END IF;
  IF p_k = 'process_coach_v1' THEN RETURN jsonb_build_object('len', length(p_v)); END IF;
  IF p_k NOT IN ('scout_tool_v1','cs_team_matches_v1') THEN RETURN NULL; END IF;
  BEGIN j := p_v::jsonb; EXCEPTION WHEN others THEN RETURN NULL; END;
  IF jsonb_typeof(j) IS DISTINCT FROM 'object' THEN RETURN NULL; END IF;
  IF p_k = 'scout_tool_v1' THEN
    RETURN jsonb_build_object(
      'players', CASE WHEN jsonb_typeof(j->'players')='array' THEN jsonb_array_length(j->'players') ELSE 0 END,
      'records', CASE WHEN jsonb_typeof(j->'meta'->'statusRuns')='object'
                      THEN (SELECT count(*) FROM jsonb_object_keys(j->'meta'->'statusRuns')) ELSE 0 END,
      'days',    CASE WHEN jsonb_typeof(j->'meta'->'participationDays')='object'
                      THEN (SELECT count(*) FROM jsonb_object_keys(j->'meta'->'participationDays')) ELSE 0 END);
  END IF;
  RETURN jsonb_build_object(
    'matches', CASE WHEN jsonb_typeof(j->'matches')='array' THEN jsonb_array_length(j->'matches') ELSE 0 END,
    'scored',  CASE WHEN jsonb_typeof(j->'matches')='array'
                    THEN (SELECT count(*) FROM jsonb_array_elements(j->'matches') m
                           WHERE jsonb_typeof(m)='object' AND coalesce(m->>'scoreUs','') <> '') ELSE 0 END);
END $fn$;
REVOKE ALL ON FUNCTION public.ps_incident_counts(text,text) FROM PUBLIC, anon, authenticated;

/* 두 판을 견줘 «크게 줄었나». 줄어든 항목 이름 배열(없으면 빈 배열). 기준이 작으면 보지 않는다(5명 → 3명은 정상 정리일 때가 많다). */
CREATE OR REPLACE FUNCTION public.ps_incident_drop(p_k text, o jsonb, n jsonb)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $fn$
DECLARE r text[] := '{}'; f text; ov numeric; nv numeric; lim numeric; ratio numeric;
BEGIN
  IF o IS NULL OR n IS NULL THEN RETURN r; END IF;
  FOR f IN SELECT jsonb_object_keys(o) LOOP
    ov := (o->>f)::numeric; nv := coalesce((n->>f)::numeric, 0);
    lim := CASE f WHEN 'len' THEN 20000 WHEN 'players' THEN 5 WHEN 'matches' THEN 5 ELSE 3 END;
    ratio := CASE f WHEN 'len' THEN 0.5 ELSE 0.7 END;
    IF ov >= lim AND nv < ov * ratio THEN r := r || (f||' '||ov::bigint||'→'||nv::bigint); END IF;
  END LOOP;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.ps_incident_drop(text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_admin_incidents(p_days int DEFAULT 56)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public, pg_catalog AS $fn$
DECLARE
  d int := greatest(1, least(coalesce(p_days, 56), 90));
  scan int := least(greatest(1, least(coalesce(p_days, 56), 90)), 14);   -- 자동 감지는 2주까지만(문서 해석 비용)
  last_at timestamptz;
  out jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='admin_required';
  END IF;
  SELECT max(i.at) INTO last_at FROM public.ps_incidents i WHERE i.kind IN ('loss','restore');

  WITH hist AS (
    SELECT h.id, h.workspace_id, h.k, h.v, h.changed_at, h.changed_by,
           lead(h.v) OVER w AS next_v
      FROM public.ps_kv_history h
     WHERE h.k IN ('scout_tool_v1','cs_team_matches_v1','process_coach_v1')
       AND h.changed_at > now() - make_interval(days => scan)
       AND h.v IS NOT NULL
    WINDOW w AS (PARTITION BY h.workspace_id, h.k ORDER BY h.changed_at, h.id)
  ), pairs AS (
    /* 이력 한 줄 = «바꾸기 직전 판» + 바꾼 사람. 바꾼 뒤 판은 다음 이력 줄, 없으면 지금 판이다. */
    SELECT x.*, public.ps_incident_drop(x.k, public.ps_incident_counts(x.k, x.v),
             public.ps_incident_counts(x.k, coalesce(x.next_v, kv.v))) AS dropped
      FROM hist x
      LEFT JOIN public.ps_kv kv ON kv.workspace_id::text = x.workspace_id::text AND kv.k = x.k
  ), drops AS (
    SELECT p.id, p.changed_at, p.changed_by, p.k, p.workspace_id, p.dropped
      FROM pairs p WHERE cardinality(p.dropped) > 0
     ORDER BY p.changed_at DESC LIMIT 40
  ), guards AS (
    SELECT CASE
             WHEN dn.reason LIKE '앱을 완전히 닫았다가%' THEN 'build'
             WHEN dn.reason LIKE '선수단 기록(%' OR dn.reason LIKE '평가표·포지션이 빈%' THEN 'record'
             WHEN dn.reason LIKE '%전부 사라지는%' OR dn.reason LIKE '%점수%' THEN 'shape'
             WHEN dn.reason LIKE '오래된 일정 판본%' OR dn.reason LIKE '낡은 앱이 지난 주%'
               OR dn.reason LIKE '경기 날짜·상대·시간%' OR dn.reason LIKE '1.642%' OR dn.reason LIKE '일정 서버 판본%' THEN 'lineage'
             WHEN dn.reason LIKE '권한은 운영진만%' OR dn.reason LIKE '일정은 운영진만%' OR dn.reason LIKE '경기 담당은%'
               OR dn.reason LIKE '다른 선수의 IDP%' OR dn.reason LIKE '이 자료를 편집할 권한%' THEN 'permission'
             ELSE 'other' END AS cat,
           dn.*
      FROM public.ps_kv_denied dn
     WHERE dn.at > now() - make_interval(days => d)
  )
  SELECT jsonb_build_object(
    'at', now(), 'days', d, 'scan_days', scan,
    'last_loss_at', last_at,
    'since_days', CASE WHEN last_at IS NULL THEN NULL ELSE floor(extract(epoch FROM now() - last_at) / 86400)::int END,
    'goal_days', 56,
    'log', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'at', i.at, 'kind', i.kind, 'title', i.title,
                       'detail', i.detail, 'ws', w.name, 'workspace_id', i.workspace_id) ORDER BY i.at DESC)
                       FROM public.ps_incidents i LEFT JOIN public.ps_workspaces w ON w.id = i.workspace_id
                      WHERE i.at > now() - make_interval(days => d)), '[]'::jsonb),
    'guards', coalesce((SELECT jsonb_object_agg(cat, n) FROM (SELECT cat, count(*) n FROM guards GROUP BY cat) z), '{}'::jsonb),
    'denied', coalesce((SELECT jsonb_agg(jsonb_build_object('cat', g.cat, 'k',
                         CASE WHEN g.k LIKE 'cs_idp_v1_%' THEN 'cs_idp_v1_*' ELSE g.k END,
                         'reason', left(g.reason, 80), 'at', g.at, 'ws', w.name, 'user_id', g.user_id) ORDER BY g.at DESC)
                         FROM (SELECT * FROM guards WHERE cat <> 'build' ORDER BY at DESC LIMIT 40) g
                         LEFT JOIN public.ps_workspaces w ON w.id::text = g.workspace_id::text), '[]'::jsonb),
    'drops', coalesce((SELECT jsonb_agg(jsonb_build_object('history_id', x.id, 'at', x.changed_at, 'by', x.changed_by,
                        'k', x.k, 'ws', w.name, 'workspace_id', x.workspace_id, 'dropped', to_jsonb(x.dropped)) ORDER BY x.changed_at DESC)
                        FROM drops x LEFT JOIN public.ps_workspaces w ON w.id::text = x.workspace_id::text), '[]'::jsonb)
  ) INTO out;
  RETURN out;
END $fn$;
COMMENT ON FUNCTION public.ps_admin_incidents(int) IS 'process-studio/incident-ledger/20261007/v1';
REVOKE ALL ON FUNCTION public.ps_admin_incidents(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_incidents(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ps_admin_incident_add(p_kind text, p_title text, p_detail text DEFAULT NULL,
                                                        p_workspace uuid DEFAULT NULL, p_at timestamptz DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public, pg_catalog AS $fn$
DECLARE new_id bigint;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='admin_required';
  END IF;
  IF p_at IS NOT NULL AND (p_at > now() + interval '1 hour' OR p_at < now() - interval '365 days') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='incident_time_out_of_range';
  END IF;
  INSERT INTO public.ps_incidents(at, kind, workspace_id, title, detail, recorded_by)
  VALUES (coalesce(p_at, now()), p_kind, p_workspace, btrim(p_title), nullif(btrim(coalesce(p_detail,'')), ''), auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END $fn$;
COMMENT ON FUNCTION public.ps_admin_incident_add(text,text,text,uuid,timestamptz) IS 'process-studio/incident-ledger/20261007/v1';
REVOKE ALL ON FUNCTION public.ps_admin_incident_add(text,text,text,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_incident_add(text,text,text,uuid,timestamptz) TO authenticated;

/* 잘못 적은 줄만 지운다. 심어 둔 지난 사고(seed_key)는 지우지 않는다 — 문턱의 출발점이 흔들리지 않게. */
CREATE OR REPLACE FUNCTION public.ps_admin_incident_del(p_id bigint)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public, pg_catalog AS $fn$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL OR public.ps_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='admin_required';
  END IF;
  DELETE FROM public.ps_incidents WHERE id = p_id AND seed_key IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $fn$;
COMMENT ON FUNCTION public.ps_admin_incident_del(bigint) IS 'process-studio/incident-ledger/20261007/v1';
REVOKE ALL ON FUNCTION public.ps_admin_incident_del(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_incident_del(bigint) TO authenticated;

/* 출발점 — 이 문서를 만들 때까지 확인된 최근 사고(AGENTS.md 기록). 팀이 없는 DB(로컬 시험)에서는 팀 칸이 비어 들어간다. */
INSERT INTO public.ps_incidents(at, kind, workspace_id, title, detail, seed_key) VALUES
  ('2026-10-05 21:51+09', 'loss',
   (SELECT id FROM public.ps_workspaces WHERE id::text LIKE 'a24e6afa-%' LIMIT 1),
   '선수 기기의 낡은 권한 문서가 자기 선수 연결을 지움',
   '10/5 20:57 선수 계정(판 2.940)이 cs_perms_v1 을 올려 자기 playerId 연결이 빠졌다. 쓰기 가드가 관찰 모드라 통과. 21:51 소유자가 다시 이음.',
   'perms-unlink-20261005'),
  ('2026-10-06 13:38+09', 'restore',
   (SELECT id FROM public.ps_workspaces WHERE id::text LIKE 'a24e6afa-%' LIMIT 1),
   '옛 판 부팅이 가용인원 기록·카드 배치를 지움 → 복구(2.948 보완판)',
   '9/15~10/6 일곱 번 statusRuns·participationDays·tbCards 소실. 서버 이전 판을 모아 SQL 로 복구. 같은 날 서버 가드(scout_record_guard) 적용.',
   'scout-wipe-footballA-20261006'),
  ('2026-10-07 00:07+09', 'restore', NULL,
   '같은 원인으로 다른 14팀 선수단 기록 소실 → 15팀 복구',
   'migrations/20261007_restore_2948_teams — 34건·15팀. 복구 전 문서는 ps_kv_restore_backup_2948.',
   'scout-wipe-15teams-20261007')
ON CONFLICT (seed_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
