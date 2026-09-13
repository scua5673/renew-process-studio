-- PROCESS STUDIO: candidate-registry downgrade protection, revision 1.
-- REVIEWED SQL ONLY: run explicitly with a database migration role.
-- No team rows are read/updated here. RLS, grants on ps_kv, INSERT and DELETE
-- policies are unchanged. Run the companion verify.sql after installation.
--
-- Scope: UPDATE of an existing cs_scout_targets_v1 row whose OLD document has
-- scoutRegistry.v = 1. Legacy-only rows and every other key keep their behavior.
-- Rejects lossy writes; never silently merges, rewrites, or returns OLD as ACK.
-- PostgreSQL statements are atomic: a mixed-key bulk UPSERT containing a rejected
-- TKEY write rolls back that whole statement. Independent other-key writes stay
-- allowed. Old clients may need updating before a rejected mixed batch can sync.
-- DELETE/TRUNCATE remain governed by existing policies/privileges. In particular,
-- this does not block a team-deletion cascade or guarantee recovery after DELETE.
--
-- Compatibility: public.ps_kv must be an ordinary table, k text/varchar and
-- v text/jsonb (not a domain). JSON is parsed in this script's own functions;
-- no previously deployed JSON helper or build-version guard is assumed.
-- Existing row BEFORE UPDATE triggers run first. Installation fails if any
-- trigger would sort after this guard; verify again when adding future triggers.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  table_oid oid := to_regclass('public.ps_kv');
  marker constant text := 'process-studio/scout-registry-guard/20260913/v1';
  guard_name constant text := 'zzzz_ps_scout_registry_guard_v1';
  item record;
BEGIN
  IF table_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class WHERE oid = table_oid AND relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'scout guard preflight: public.ps_kv must be an ordinary table';
  END IF;
  -- Hold the same short DDL/write lock through inspection and trigger creation.
  -- This prevents another DDL session changing trigger order after inspection.
  LOCK TABLE public.ps_kv IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid = table_oid AND attname = 'k' AND NOT attisdropped
        AND atttypid IN ('text'::regtype, 'varchar'::regtype))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid = table_oid AND attname = 'v' AND NOT attisdropped
        AND atttypid IN ('text'::regtype, 'jsonb'::regtype)) THEN
    RAISE EXCEPTION 'scout guard preflight: expected k text/varchar and v text/jsonb';
  END IF;
  -- Do not replace unrelated objects that happen to use these reserved names.
  FOR item IN SELECT p.oid FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
        'ps_scout_registry_guard_v1_array_kept',
        'ps_scout_registry_guard_v1_reason', 'ps_scout_registry_guard_v1')
  LOOP
    IF pg_catalog.obj_description(item.oid, 'pg_proc') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'scout guard preflight: reserved function name already exists';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = table_oid AND t.tgname = guard_name
        AND pg_catalog.obj_description(t.oid, 'pg_trigger') IS DISTINCT FROM marker) THEN
    RAISE EXCEPTION 'scout guard preflight: reserved trigger name already exists';
  END IF;
  FOR item IN SELECT t.oid, t.tgname FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = table_oid AND NOT t.tgisinternal
        AND (t.tgtype::integer & 1) = 1   -- ROW
        AND (t.tgtype::integer & 2) = 2   -- BEFORE
        AND (t.tgtype::integer & 16) = 16 -- UPDATE
  LOOP
    IF item.tgname = guard_name THEN
      IF pg_catalog.obj_description(item.oid, 'pg_trigger') IS DISTINCT FROM marker THEN
        RAISE EXCEPTION 'scout guard preflight: reserved trigger name already exists';
      END IF;
    ELSIF item.tgname COLLATE "C" > guard_name COLLATE "C" THEN
      RAISE EXCEPTION 'scout guard preflight: a later BEFORE UPDATE trigger requires review';
    END IF;
  END LOOP;
END
$preflight$;

-- Exact array-element equality: JSONB containment (@>) would ignore order and
-- repeated values inside an original source document's nested arrays.
CREATE OR REPLACE FUNCTION public.ps_scout_registry_guard_v1_array_kept(
  previous_values jsonb, next_values jsonb
) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(previous_values) IS DISTINCT FROM 'array'
      OR jsonb_typeof(next_values) IS DISTINCT FROM 'array' THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(previous_values) AS previous(value)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(next_values) AS next(value)
        WHERE next.value = previous.value
      )
    )
  END
$function$;

-- Pure checker, also exercised by the synthetic/local verification scripts.
-- NULL means accepted; stable reason codes never include private row content.
CREATE OR REPLACE FUNCTION public.ps_scout_registry_guard_v1_reason(
  old_document jsonb, new_document jsonb
) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  old_registry jsonb := old_document -> 'scoutRegistry';
  new_registry jsonb := new_document -> 'scoutRegistry';
  previous_candidate jsonb;
  next_candidate jsonb;
  candidate_id text;
  field_name text;
  family text;
  previous_value jsonb;
  next_value jsonb;
  previous_array jsonb;
  next_array jsonb;
  observation jsonb;
  next_observation jsonb;
  placement_id text;
  entry record;
BEGIN
  IF jsonb_typeof(old_registry) IS DISTINCT FROM 'object'
     OR old_registry -> 'v' IS DISTINCT FROM '1'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(old_registry -> 'candidates') IS DISTINCT FROM 'object'
     OR jsonb_typeof(old_registry -> 'meta') IS DISTINCT FROM 'object'
     OR jsonb_typeof(old_document -> 'players') IS DISTINCT FROM 'array' THEN
    RETURN 'old_registry_invalid';
  END IF;
  IF jsonb_typeof(new_document) IS DISTINCT FROM 'object'
     OR jsonb_typeof(new_document -> 'players') IS DISTINCT FROM 'array'
     OR (new_document ? 'v' AND new_document -> 'v' <> 'null'::jsonb
         AND new_document -> 'v' IS DISTINCT FROM '1'::jsonb)
     OR jsonb_typeof(new_registry) IS DISTINCT FROM 'object'
     OR new_registry -> 'v' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(new_registry -> 'candidates') IS DISTINCT FROM 'object'
     OR jsonb_typeof(new_registry -> 'meta') IS DISTINCT FROM 'object'
     OR (new_registry -> 'meta' ? 'pointSets'
         AND new_registry #> '{meta,pointSets}' NOT IN ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '""'::jsonb)
         AND jsonb_typeof(new_registry #> '{meta,pointSets}') IS DISTINCT FROM 'array') THEN
    RETURN 'registry_missing_or_invalid';
  END IF;

  FOR entry IN SELECT key, value FROM jsonb_each(old_registry -> 'candidates') LOOP
    candidate_id := entry.key;
    previous_candidate := entry.value;
    next_candidate := new_registry -> 'candidates' -> candidate_id;
    IF jsonb_typeof(previous_candidate) IS DISTINCT FROM 'object'
       OR jsonb_typeof(previous_candidate -> 'info') IS DISTINCT FROM 'object' THEN
      RETURN 'old_candidate_invalid';
    END IF;
    IF jsonb_typeof(next_candidate) IS DISTINCT FROM 'object'
       OR next_candidate ->> 'id' IS DISTINCT FROM candidate_id
       OR jsonb_typeof(next_candidate -> 'info') IS DISTINCT FROM 'object' THEN
      RETURN 'candidate_missing_or_invalid';
    END IF;
    FOREACH family IN ARRAY ARRAY['variants', 'sourceHistory', 'scoreHistory'] LOOP
      previous_array := coalesce(nullif(previous_candidate -> family, 'null'::jsonb), '[]'::jsonb);
      next_array := coalesce(nullif(next_candidate -> family, 'null'::jsonb), '[]'::jsonb);
      IF NOT public.ps_scout_registry_guard_v1_array_kept(previous_array, next_array) THEN
        RETURN 'candidate_history_removed';
      END IF;
    END LOOP;

    -- Source edits may replace the current projection, including normalizing
    -- duplicate photo/point fields, but must retain the previous entire source.
    previous_value := previous_candidate -> 'source';
    IF previous_value IS NOT NULL AND previous_value <> 'null'::jsonb
       AND previous_value IS DISTINCT FROM next_candidate -> 'source'
       AND NOT public.ps_scout_registry_guard_v1_array_kept(
         jsonb_build_array(previous_value),
         coalesce(nullif(next_candidate -> 'sourceHistory', 'null'::jsonb), '[]'::jsonb)
       ) THEN RETURN 'candidate_source_removed'; END IF;

    -- Canonical edits are allowed; an old value must remain in variants.
    -- Absent fields have no old value, so a first input needs no history.
    IF jsonb_typeof(coalesce(nullif(previous_candidate #> '{info,profile}', 'null'::jsonb), '{}'::jsonb)) <> 'object'
       OR jsonb_typeof(coalesce(nullif(next_candidate #> '{info,profile}', 'null'::jsonb), '{}'::jsonb)) <> 'object' THEN
      RETURN 'candidate_profile_invalid';
    END IF;
    FOR field_name, previous_value IN
      SELECT key, value FROM jsonb_each((previous_candidate -> 'info') - 'profile')
      UNION ALL
      SELECT 'profile.' || key, value FROM jsonb_each(
        coalesce(nullif(previous_candidate #> '{info,profile}', 'null'::jsonb), '{}'::jsonb))
    LOOP
      IF left(field_name, 8) = 'profile.' THEN
        next_value := next_candidate #> ARRAY['info', 'profile', substr(field_name, 9)];
      ELSE next_value := next_candidate #> ARRAY['info', field_name]; END IF;
      -- mergeCandidate fills an unedited empty legacy value without a variant.
      -- There is no prior information to lose; explicit prior edit stamps still
      -- require the usual exact variant when that value changes.
      IF previous_value IS DISTINCT FROM next_value
         AND NOT (previous_value IN ('null'::jsonb, '""'::jsonb)
           AND coalesce(previous_candidate #> ARRAY['edits', field_name], 'null'::jsonb) = 'null'::jsonb)
         AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(nullif(next_candidate -> 'variants', 'null'::jsonb), '[]'::jsonb)) AS variant(value)
        WHERE variant.value ->> 'field' = field_name AND variant.value -> 'value' = previous_value
      ) THEN RETURN 'candidate_info_removed'; END IF;
    END LOOP;
    FOREACH family IN ARRAY ARRAY['points', 'ratings'] LOOP
      IF jsonb_typeof(coalesce(nullif(previous_candidate -> family, 'null'::jsonb), '{}'::jsonb)) <> 'object'
         OR jsonb_typeof(coalesce(nullif(next_candidate -> family, 'null'::jsonb), '{}'::jsonb)) <> 'object' THEN
        RETURN 'candidate_scores_invalid';
      END IF;
      FOR field_name, previous_value IN SELECT key, value FROM jsonb_each(
        coalesce(nullif(previous_candidate -> family, 'null'::jsonb), '{}'::jsonb)) LOOP
        IF previous_value IS DISTINCT FROM next_candidate #> ARRAY[family, field_name]
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(coalesce(nullif(next_candidate -> 'scoreHistory', 'null'::jsonb), '[]'::jsonb)) AS history(value)
             WHERE history.value ->> 'kind' = family AND history.value ->> 'key' = field_name
               AND history.value -> 'value' = previous_value
           ) THEN RETURN 'candidate_score_removed'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- A question-set replacement/deletion remains possible through the current UI:
  -- the old complete metadata object must remain in metaHistory.
  previous_array := coalesce(nullif(old_registry -> 'metaHistory', 'null'::jsonb), '[]'::jsonb);
  next_array := coalesce(nullif(new_registry -> 'metaHistory', 'null'::jsonb), '[]'::jsonb);
  IF NOT public.ps_scout_registry_guard_v1_array_kept(previous_array, next_array) THEN
    RETURN 'metadata_history_removed';
  END IF;
  IF old_registry -> 'meta' IS DISTINCT FROM new_registry -> 'meta'
     AND NOT public.ps_scout_registry_guard_v1_array_kept(
       jsonb_build_array(old_registry -> 'meta'), next_array) THEN
    RETURN 'metadata_source_removed';
  END IF;

  IF jsonb_typeof(coalesce(nullif(old_registry -> 'placementHistory', 'null'::jsonb), '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(coalesce(nullif(new_registry -> 'placementHistory', 'null'::jsonb), '{}'::jsonb)) <> 'object' THEN
    RETURN 'placement_history_invalid';
  END IF;
  FOR entry IN SELECT key, value FROM jsonb_each(
    coalesce(nullif(old_registry -> 'placementHistory', 'null'::jsonb), '{}'::jsonb)) LOOP
    IF NOT public.ps_scout_registry_guard_v1_array_kept(entry.value,
      coalesce(nullif(new_registry #> ARRAY['placementHistory', entry.key], 'null'::jsonb), '[]'::jsonb)) THEN
      RETURN 'placement_history_removed';
    END IF;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(old_document -> 'players') LOOP
    placement_id := entry.value ->> 'id';
    IF placement_id IS NULL THEN RETURN 'old_placement_invalid'; END IF;
    observation := entry.value - ARRAY['name','num','foot','club','grade','id','type','profile','_scoutRef'];
    SELECT p.value - ARRAY['name','num','foot','club','grade','id','type','profile','_scoutRef']
      INTO next_observation FROM jsonb_array_elements(new_document -> 'players') AS p(value)
      WHERE p.value ->> 'id' = placement_id LIMIT 1;
    IF observation IS DISTINCT FROM next_observation
       AND NOT public.ps_scout_registry_guard_v1_array_kept(jsonb_build_array(observation),
         coalesce(nullif(new_registry #> ARRAY['placementHistory', placement_id], 'null'::jsonb), '[]'::jsonb)) THEN
      RETURN 'placement_observation_removed';
    END IF;
  END LOOP;
  RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.ps_scout_registry_guard_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  previous_document jsonb;
  next_document jsonb;
  reason text;
BEGIN
  IF OLD.k IS DISTINCT FROM 'cs_scout_targets_v1' THEN RETURN NEW; END IF;
  BEGIN
    previous_document := OLD.v::text::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Existing non-JSON legacy text has no confirmed v1 registry. Its existing
    -- repair/write path stays available; never invent a registry from it.
    RETURN NEW;
  END;
  IF jsonb_typeof(previous_document -> 'scoutRegistry') IS DISTINCT FROM 'object'
     OR previous_document #> '{scoutRegistry,v}' IS DISTINCT FROM '1'::jsonb THEN
    RETURN NEW;
  END IF;
  IF NEW.k IS DISTINCT FROM OLD.k THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ps_scout_registry_guard_v1: key_change',
      HINT = 'Keep this candidate document under its existing key.';
  END IF;
  BEGIN
    next_document := NEW.v::text::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ps_scout_registry_guard_v1: invalid_json',
      HINT = 'Update PROCESS STUDIO, reload the latest candidate document, and retry.';
  END;
  reason := public.ps_scout_registry_guard_v1_reason(previous_document, next_document);
  IF reason IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'ps_scout_registry_guard_v1: ' || reason,
      HINT = 'Update PROCESS STUDIO, reload the latest candidate document, and retry. The server document was not replaced.';
  END IF;
  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION public.ps_scout_registry_guard_v1_array_kept(jsonb,jsonb)
  IS 'process-studio/scout-registry-guard/20260913/v1';
COMMENT ON FUNCTION public.ps_scout_registry_guard_v1_reason(jsonb,jsonb)
  IS 'process-studio/scout-registry-guard/20260913/v1';
COMMENT ON FUNCTION public.ps_scout_registry_guard_v1()
  IS 'process-studio/scout-registry-guard/20260913/v1';

DROP TRIGGER IF EXISTS zzzz_ps_scout_registry_guard_v1 ON public.ps_kv;
-- All UPDATEs, not just UPDATE OF v: also prevents renaming a protected key.
CREATE TRIGGER zzzz_ps_scout_registry_guard_v1
  BEFORE UPDATE ON public.ps_kv FOR EACH ROW
  EXECUTE FUNCTION public.ps_scout_registry_guard_v1();
COMMENT ON TRIGGER zzzz_ps_scout_registry_guard_v1 ON public.ps_kv
  IS 'process-studio/scout-registry-guard/20260913/v1';

-- Trigger executes as the writer, so its pure nested checkers need EXECUTE.
-- They accept only caller-supplied JSON and never access stored team data.
-- Set this explicitly: hardened database DEFAULT PRIVILEGES may omit PUBLIC.
-- The trigger-returning wrapper cannot be called as a normal SQL/RPC function.
GRANT EXECUTE ON FUNCTION public.ps_scout_registry_guard_v1_array_kept(jsonb,jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_scout_registry_guard_v1_reason(jsonb,jsonb) TO PUBLIC;
REVOKE ALL ON FUNCTION public.ps_scout_registry_guard_v1() FROM PUBLIC;

COMMIT;
