-- Verification: metadata plus synthetic TEMP rows only. No production ps_kv
-- contents are read. No retained writes: the entire check is rolled back.
-- Run after 20260913_scout_registry_guard.sql using the same migration role.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $installation$
DECLARE
  target oid := to_regclass('public.ps_kv');
  marker constant text := 'process-studio/scout-registry-guard/20260913/v1';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = target AND tgname = 'zzzz_ps_scout_registry_guard_v1'
      AND tgenabled = 'O' AND tgtype::integer = 19
      AND tgfoid = 'public.ps_scout_registry_guard_v1()'::regprocedure
      AND pg_catalog.obj_description(oid, 'pg_trigger') = marker
  ) THEN RAISE EXCEPTION 'scout guard verification: trigger missing, changed or disabled'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = target AND NOT tgisinternal
      AND (tgtype::integer & 19) = 19
      AND tgname COLLATE "C" > 'zzzz_ps_scout_registry_guard_v1' COLLATE "C"
  ) THEN RAISE EXCEPTION 'scout guard verification: later BEFORE UPDATE trigger requires review'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid IN ('public.ps_scout_registry_guard_v1_array_kept(jsonb,jsonb)'::regprocedure,
                  'public.ps_scout_registry_guard_v1_reason(jsonb,jsonb)'::regprocedure,
                  'public.ps_scout_registry_guard_v1()'::regprocedure)
      AND (prosecdef OR pg_catalog.obj_description(oid, 'pg_proc') IS DISTINCT FROM marker)
  ) THEN RAISE EXCEPTION 'scout guard verification: unexpected function owner mode or marker'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid IN ('public.ps_scout_registry_guard_v1_array_kept(jsonb,jsonb)'::regprocedure,
                    'public.ps_scout_registry_guard_v1_reason(jsonb,jsonb)'::regprocedure)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
  ) THEN RAISE EXCEPTION 'scout guard verification: writer access to pure checkers is missing'; END IF;
END
$installation$;

CREATE TEMP TABLE ps_scout_guard_verify_text (k text PRIMARY KEY, v text);
CREATE TRIGGER zzzz_ps_scout_registry_guard_v1
  BEFORE UPDATE ON ps_scout_guard_verify_text FOR EACH ROW
  EXECUTE FUNCTION public.ps_scout_registry_guard_v1();
CREATE TEMP TABLE ps_scout_guard_verify_jsonb (k text PRIMARY KEY, v jsonb);
CREATE TRIGGER zzzz_ps_scout_registry_guard_v1
  BEFORE UPDATE ON ps_scout_guard_verify_jsonb FOR EACH ROW
  EXECUTE FUNCTION public.ps_scout_registry_guard_v1();

DO $synthetic_checks$
DECLARE
  original jsonb := '{"v":1,"players":[],"scoutRegistry":{"v":1,"candidates":{"db:fixture":{"id":"db:fixture","info":{"name":"Synthetic candidate","profile":{}},"source":{"obs":["one","two"]},"points":{"q":3},"ratings":{},"variants":[],"scoreHistory":[],"sourceHistory":[]}},"meta":{"pointSets":[{"id":"fixture-set","sections":[{"name":"Section","qs":["Question"]}]}]},"metaHistory":[],"placementHistory":{}}}'::jsonb;
  next_document jsonb;
  reason text;
  candidate jsonb;
BEGIN
  IF public.ps_scout_registry_guard_v1_reason(original, original) IS NOT NULL THEN
    RAISE EXCEPTION 'identical document rejected';
  END IF;
  IF public.ps_scout_registry_guard_v1_reason('{"v":1,"players":[]}', '{"v":1,"players":[]}') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy-only update rejected';
  END IF;
  next_document := original - 'scoutRegistry';
  IF public.ps_scout_registry_guard_v1_reason(original, next_document) IS NULL THEN
    RAISE EXCEPTION 'players-only downgrade accepted';
  END IF;
  IF public.ps_scout_registry_guard_v1_reason(original,
      jsonb_set(original, '{scoutRegistry,candidates}', '{}')) IS NULL THEN
    RAISE EXCEPTION 'candidate deletion accepted';
  END IF;
  next_document := jsonb_set(original, '{scoutRegistry,meta}', '{}');
  IF public.ps_scout_registry_guard_v1_reason(original, next_document) IS NULL THEN
    RAISE EXCEPTION 'question-set deletion without history accepted';
  END IF;
  next_document := jsonb_set(next_document, '{scoutRegistry,metaHistory}',
    jsonb_build_array(original #> '{scoutRegistry,meta}'));
  IF public.ps_scout_registry_guard_v1_reason(original, next_document) IS NOT NULL THEN
    RAISE EXCEPTION 'question-set change with exact prior metadata rejected';
  END IF;
  -- Changed source and point value with exact previous histories remain valid.
  candidate := original #> '{scoutRegistry,candidates,db:fixture}';
  next_document := jsonb_set(original, '{scoutRegistry,candidates,db:fixture}',
    candidate || jsonb_build_object('source', jsonb_build_object('obs', jsonb_build_array('three')),
      'sourceHistory', jsonb_build_array(candidate -> 'source'),
      'points', jsonb_build_object('q', 5),
      'scoreHistory', jsonb_build_array(jsonb_build_object('kind','points','key','q','value',3))));
  reason := public.ps_scout_registry_guard_v1_reason(original, next_document);
  IF reason IS NOT NULL THEN RAISE EXCEPTION 'normal edit rejected: %', reason; END IF;
  IF public.ps_scout_registry_guard_v1_array_kept(
      '[{"obs":["one","two"]}]', '[{"obs":["two","one"]}]') THEN
    RAISE EXCEPTION 'nested original source array order was ignored';
  END IF;

  INSERT INTO ps_scout_guard_verify_text VALUES ('cs_scout_targets_v1', original::text), ('other_key', 'old');
  INSERT INTO ps_scout_guard_verify_jsonb VALUES ('cs_scout_targets_v1', original), ('other_key', '{}');
  BEGIN
    UPDATE ps_scout_guard_verify_text SET v = '{"v":1,"players":[]}' WHERE k = 'cs_scout_targets_v1';
    RAISE EXCEPTION 'text downgrade unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'ps_scout_registry_guard_v1:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE ps_scout_guard_verify_jsonb SET v = '{"v":1,"players":[]}' WHERE k = 'cs_scout_targets_v1';
    RAISE EXCEPTION 'jsonb downgrade unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'ps_scout_registry_guard_v1:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE ps_scout_guard_verify_text SET v = 'invalid-json' WHERE k = 'cs_scout_targets_v1';
    RAISE EXCEPTION 'invalid text JSON unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'ps_scout_registry_guard_v1:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE ps_scout_guard_verify_text SET k = 'renamed' WHERE k = 'cs_scout_targets_v1';
    RAISE EXCEPTION 'protected key rename unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'ps_scout_registry_guard_v1:%' THEN RAISE; END IF;
  END;
  IF (SELECT v::jsonb FROM ps_scout_guard_verify_text WHERE k = 'cs_scout_targets_v1') IS DISTINCT FROM original
     OR (SELECT v FROM ps_scout_guard_verify_jsonb WHERE k = 'cs_scout_targets_v1') IS DISTINCT FROM original THEN
    RAISE EXCEPTION 'rejected write altered stored original';
  END IF;
  UPDATE ps_scout_guard_verify_text SET v = next_document::text WHERE k = 'cs_scout_targets_v1';
  UPDATE ps_scout_guard_verify_jsonb SET v = next_document WHERE k = 'cs_scout_targets_v1';
  UPDATE ps_scout_guard_verify_text SET v = 'non-json is still allowed on other keys' WHERE k = 'other_key';
  UPDATE ps_scout_guard_verify_jsonb SET v = '{"unrelated":true}' WHERE k = 'other_key';
  -- DELETE is deliberately outside this UPDATE-only guard. Existing real-table
  -- RLS and grants decide deletion; this TEMP assertion is not a permission test.
  DELETE FROM ps_scout_guard_verify_text WHERE k = 'cs_scout_targets_v1';
  IF EXISTS (SELECT 1 FROM ps_scout_guard_verify_text WHERE k = 'cs_scout_targets_v1') THEN
    RAISE EXCEPTION 'unexpected DELETE restriction';
  END IF;
  RAISE NOTICE 'scout registry guard synthetic SQL checks passed (text + jsonb); all temporary changes will roll back';
END
$synthetic_checks$;
ROLLBACK;
