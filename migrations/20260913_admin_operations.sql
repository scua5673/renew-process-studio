-- New operational metadata only. No changes to existing application tables,
-- policies, triggers, records or grants. Run preflight/verify and the runbook.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091301);
DO $preflight$
DECLARE x record; marker constant text:='process-studio/admin-operations/20260913/v1';
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'admin operations: database administrator required for installation'; END IF;
  IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.ps_is_admin()') IS NULL
    OR to_regprocedure('public.ps_is_member(uuid)') IS NULL OR to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('auth.uid()') AND prorettype='uuid'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_admin()') AND prorettype='boolean'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_member(uuid)') AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'admin operations: catalog-confirmed auth/admin/member helpers required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('auth.users') AND attname='id' AND NOT attisdropped AND atttypid='uuid'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.ps_workspaces') AND attname='id' AND NOT attisdropped AND atttypid='uuid'::regtype) THEN
    RAISE EXCEPTION 'admin operations: catalog-confirmed subject tables required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
    RAISE EXCEPTION 'admin operations: expected client roles required';
  END IF;
  FOR x IN SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('ps_admin_followups','ps_admin_followup_changes','ps_sync_reports') LOOP
    IF pg_catalog.obj_description(x.oid,'pg_class') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'admin operations: table name belongs to another migration';
    END IF;
  END LOOP;
  FOR x IN SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (left(p.proname,13)='ps_admin_ops_' OR p.proname IN
      ('ps_admin_followups_list','ps_admin_followup_save','ps_admin_sync_reports_list','ps_sync_report_put')) LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'admin operations: function name belongs to another migration';
    END IF;
  END LOOP;
END $preflight$;

CREATE TABLE IF NOT EXISTS public.ps_admin_followups(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid, workspace_id uuid,
  kind text NOT NULL CHECK(kind IN ('support','usage','paid')),
  note text NOT NULL DEFAULT '' CHECK(char_length(note)<=2000),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','deployed','verified','closed')),
  assignee_label text NOT NULL DEFAULT '' CHECK(char_length(assignee_label)<=80),
  next_check_at timestamptz, release_version text NOT NULL DEFAULT '' CHECK(char_length(release_version)<=40),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_by uuid NOT NULL,
  CHECK(subject_user_id IS NOT NULL OR workspace_id IS NOT NULL)
);
-- Only changed field names are copied to audit; note text is never duplicated.
CREATE TABLE IF NOT EXISTS public.ps_admin_followup_changes(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  followup_id uuid NOT NULL REFERENCES public.ps_admin_followups(id),
  actor_id uuid NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp(),
  from_version integer NOT NULL, to_version integer NOT NULL,
  changed_fields text[] NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ps_sync_reports(
  user_id uuid NOT NULL, device_id uuid NOT NULL, workspace_id uuid NOT NULL,
  report_seq bigint NOT NULL CHECK(report_seq>0),
  pending_team integer CHECK(pending_team BETWEEN 0 AND 100000),
  pending_personal integer CHECK(pending_personal BETWEEN 0 AND 100000),
  held integer CHECK(held BETWEEN 0 AND 100000), skipped integer CHECK(skipped BETWEEN 0 AND 100000),
  deferred integer CHECK(deferred BETWEEN 0 AND 100000), conflicts integer CHECK(conflicts BETWEEN 0 AND 100000),
  oldest_pending_at timestamptz, last_round_ack_at timestamptz,
  error_code text CHECK(error_code IN ('sync_offline','sync_auth','sync_permission','sync_storage','sync_network','sync_timeout','sync_server','sync_rate_limit','sync_conflict','sync_server_rejected','sync_confirm_missing','sync_unexpected')),
  device_class text NOT NULL CHECK(device_class IN ('desktop','tablet','mobile','unknown')),
  app_version text NOT NULL CHECK(char_length(app_version)<=32),
  online boolean NOT NULL, busy boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,device_id,workspace_id)
);
CREATE INDEX IF NOT EXISTS ps_admin_followups_user_idx ON public.ps_admin_followups(subject_user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS ps_admin_followups_workspace_idx ON public.ps_admin_followups(workspace_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS ps_sync_reports_received_idx ON public.ps_sync_reports(received_at);
ALTER TABLE public.ps_admin_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_admin_followup_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_sync_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_admin_followups,public.ps_admin_followup_changes,public.ps_sync_reports FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.ps_admin_followup_changes_id_seq FROM PUBLIC,anon,authenticated;

-- Catalog-confirmed existing predicates. Team roles do not grant service administration.
CREATE OR REPLACE FUNCTION public.ps_admin_ops_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT auth.uid() IS NOT NULL AND public.ps_is_admin() IS TRUE $$;
CREATE OR REPLACE FUNCTION public.ps_admin_ops_can_report(p_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT auth.uid() IS NOT NULL AND public.ps_is_member(p_workspace_id) IS TRUE $$;

CREATE OR REPLACE FUNCTION public.ps_admin_ops_require_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR public.ps_admin_ops_is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='admin_required';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_ops_validate(p_fields jsonb,p_allowed text[]) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
  IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fields_must_be_object';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE NOT(k=ANY(p_allowed))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='unknown_field';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_ops_text(p_fields jsonb,p_key text,p_max integer,p_default text DEFAULT '') RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE v jsonb:=p_fields->p_key; t text;
BEGIN
  IF v IS NULL OR v='null'::jsonb THEN RETURN p_default; END IF;
  IF jsonb_typeof(v)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key; END IF;
  t:=p_fields->>p_key;
  IF char_length(t)>p_max THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='too_long_'||p_key; END IF;
  RETURN t;
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_ops_time(p_fields jsonb,p_key text) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE t text; v timestamptz;
BEGIN
  t:=public.ps_admin_ops_text(p_fields,p_key,40,NULL);
  IF t IS NULL THEN RETURN NULL; END IF;
  IF t !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key;
  END IF;
  BEGIN v:=t::timestamptz; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key; END;
  IF NOT isfinite(v) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key; END IF;
  RETURN v;
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_ops_uuid(p_fields jsonb,p_key text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE t text;
BEGIN
  t:=public.ps_admin_ops_text(p_fields,p_key,36,NULL);
  IF t IS NULL THEN RETURN NULL; END IF;
  BEGIN RETURN t::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key; END;
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_ops_count(p_fields jsonb,p_key text) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE v jsonb:=p_fields->p_key; n numeric;
BEGIN
  IF v IS NULL OR v='null'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key; END IF;
  n:=(p_fields->>p_key)::numeric;
  IF n<>trunc(n) OR n<0 OR n>100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_'||p_key; END IF;
  RETURN n::integer;
END $$;

CREATE OR REPLACE FUNCTION public.ps_admin_followups_list(p_user_id uuid DEFAULT NULL,p_workspace_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.ps_admin_ops_require_admin();
  SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.updated_at DESC,f.id),'[]'::jsonb) INTO result
    FROM public.ps_admin_followups f WHERE (p_user_id IS NULL OR f.subject_user_id=p_user_id)
      AND(p_workspace_id IS NULL OR f.workspace_id=p_workspace_id);
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_followup_save(p_id uuid,p_expected_version integer,p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE oldrow public.ps_admin_followups%ROWTYPE; r public.ps_admin_followups%ROWTYPE;
  actor uuid; fields text[]:=ARRAY['subject_user_id','workspace_id','kind','note','status','assignee_label','next_check_at','release_version']; changed text[];
BEGIN
  PERFORM public.ps_admin_ops_require_admin(); actor:=auth.uid();
  PERFORM public.ps_admin_ops_validate(p_fields,fields);
  IF p_expected_version IS NULL OR p_expected_version<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='expected_version_required'; END IF;
  IF p_id IS NULL THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='version_conflict'; END IF;
    r.id:=gen_random_uuid(); r.created_by:=actor; r.created_at:=clock_timestamp(); r.version:=1;
  ELSE
    SELECT * INTO oldrow FROM public.ps_admin_followups WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='followup_not_found'; END IF;
    IF oldrow.version<>p_expected_version OR oldrow.version=2147483647 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='version_conflict'; END IF;
    r:=oldrow; r.version:=oldrow.version+1;
  END IF;
  r.subject_user_id:=public.ps_admin_ops_uuid(p_fields,'subject_user_id');
  r.workspace_id:=public.ps_admin_ops_uuid(p_fields,'workspace_id');
  IF r.subject_user_id IS NULL AND r.workspace_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='subject_required'; END IF;
  -- Validate new references without adding FK cascades/blockers to existing
  -- user/team deletion. Retained notes for deleted targets can still be closed.
  IF r.subject_user_id IS NOT NULL AND (p_id IS NULL OR r.subject_user_id IS DISTINCT FROM oldrow.subject_user_id)
    AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=r.subject_user_id) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='subject_user_not_found';
  END IF;
  IF r.workspace_id IS NOT NULL AND (p_id IS NULL OR r.workspace_id IS DISTINCT FROM oldrow.workspace_id)
    AND NOT EXISTS(SELECT 1 FROM public.ps_workspaces WHERE id=r.workspace_id) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='workspace_not_found';
  END IF;
  r.kind:=public.ps_admin_ops_text(p_fields,'kind',16);
  r.note:=public.ps_admin_ops_text(p_fields,'note',2000);
  r.status:=public.ps_admin_ops_text(p_fields,'status',16,'open');
  r.assignee_label:=public.ps_admin_ops_text(p_fields,'assignee_label',80);
  r.next_check_at:=public.ps_admin_ops_time(p_fields,'next_check_at');
  r.release_version:=public.ps_admin_ops_text(p_fields,'release_version',40);
  IF r.kind NOT IN ('support','usage','paid') OR r.status NOT IN ('open','in_progress','deployed','verified','closed') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_kind_or_status';
  END IF;
  r.updated_by:=actor; r.updated_at:=clock_timestamp();
  SELECT coalesce(array_agg(k ORDER BY k),'{}'::text[]) INTO changed FROM unnest(fields) k
    WHERE p_id IS NULL OR (to_jsonb(oldrow)->k) IS DISTINCT FROM (to_jsonb(r)->k);
  IF p_id IS NULL THEN INSERT INTO public.ps_admin_followups SELECT r.*;
  ELSE UPDATE public.ps_admin_followups SET subject_user_id=r.subject_user_id,workspace_id=r.workspace_id,
    kind=r.kind,note=r.note,status=r.status,assignee_label=r.assignee_label,next_check_at=r.next_check_at,
    release_version=r.release_version,version=r.version,updated_by=r.updated_by,updated_at=r.updated_at WHERE id=r.id;
  END IF;
  INSERT INTO public.ps_admin_followup_changes(followup_id,actor_id,from_version,to_version,changed_fields)
    VALUES(r.id,actor,coalesce(oldrow.version,0),r.version,changed);
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.ps_sync_report_put(p_device_id uuid,p_workspace_id uuid,p_report_seq bigint,p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.ps_sync_reports%ROWTYPE; actor uuid:=auth.uid(); code text;
BEGIN
  IF actor IS NULL OR public.ps_admin_ops_can_report(p_workspace_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='own_workspace_report_required';
  END IF;
  IF p_device_id IS NULL OR p_workspace_id IS NULL OR p_report_seq IS NULL OR p_report_seq<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_report_identity';
  END IF;
  PERFORM public.ps_admin_ops_validate(p_fields,ARRAY['pending_team','pending_personal','held','skipped','deferred','conflicts',
    'oldest_pending_at','last_round_ack_at','error_code','device_class','app_version','online','busy']);
  r.user_id:=actor; r.device_id:=p_device_id; r.workspace_id:=p_workspace_id; r.report_seq:=p_report_seq;
  r.pending_team:=public.ps_admin_ops_count(p_fields,'pending_team'); r.pending_personal:=public.ps_admin_ops_count(p_fields,'pending_personal');
  r.held:=public.ps_admin_ops_count(p_fields,'held'); r.skipped:=public.ps_admin_ops_count(p_fields,'skipped');
  r.deferred:=public.ps_admin_ops_count(p_fields,'deferred'); r.conflicts:=public.ps_admin_ops_count(p_fields,'conflicts');
  r.oldest_pending_at:=public.ps_admin_ops_time(p_fields,'oldest_pending_at');
  r.last_round_ack_at:=public.ps_admin_ops_time(p_fields,'last_round_ack_at');
  r.error_code:=public.ps_admin_ops_text(p_fields,'error_code',80,NULL);
  IF r.error_code IS NOT NULL AND r.error_code NOT IN ('sync_offline','sync_auth','sync_permission','sync_storage','sync_network','sync_timeout','sync_server','sync_rate_limit','sync_conflict','sync_server_rejected','sync_confirm_missing','sync_unexpected') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_error_code'; END IF;
  r.device_class:=public.ps_admin_ops_text(p_fields,'device_class',8,'unknown');
  r.app_version:=public.ps_admin_ops_text(p_fields,'app_version',32);
  IF r.device_class NOT IN ('desktop','tablet','mobile','unknown') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_device_class'; END IF;
  IF jsonb_typeof(p_fields->'online') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_fields->'busy') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='online_and_busy_required';
  END IF;
  r.online:=(p_fields->>'online')::boolean; r.busy:=(p_fields->>'busy')::boolean; r.received_at:=clock_timestamp();
  INSERT INTO public.ps_sync_reports AS target SELECT r.*
    ON CONFLICT(user_id,device_id,workspace_id) DO UPDATE SET report_seq=excluded.report_seq,
      pending_team=excluded.pending_team,pending_personal=excluded.pending_personal,held=excluded.held,
      skipped=excluded.skipped,deferred=excluded.deferred,conflicts=excluded.conflicts,
      oldest_pending_at=excluded.oldest_pending_at,last_round_ack_at=excluded.last_round_ack_at,
      error_code=excluded.error_code,device_class=excluded.device_class,app_version=excluded.app_version,
      online=excluded.online,busy=excluded.busy,received_at=excluded.received_at
    WHERE target.report_seq<excluded.report_seq;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='report_sequence_conflict'; END IF;
  -- Bounded removal of this account's stale device reports. Global cleanup is
  -- a separately scheduled administrative task documented in the runbook.
  DELETE FROM public.ps_sync_reports t USING (SELECT user_id,device_id,workspace_id FROM public.ps_sync_reports
    WHERE user_id=actor AND received_at<clock_timestamp()-interval '30 days' ORDER BY received_at LIMIT 100) expired
    WHERE t.user_id=expired.user_id AND t.device_id=expired.device_id AND t.workspace_id=expired.workspace_id
      AND t.received_at<clock_timestamp()-interval '30 days';
  RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.ps_admin_sync_reports_list(p_user_id uuid DEFAULT NULL,p_workspace_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.ps_admin_ops_require_admin();
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.received_at DESC,r.user_id,r.device_id,r.workspace_id),'[]'::jsonb) INTO result
    FROM public.ps_sync_reports r WHERE (p_user_id IS NULL OR r.user_id=p_user_id)
      AND(p_workspace_id IS NULL OR r.workspace_id=p_workspace_id);
  RETURN result;
END $$;

DO $secure$
DECLARE x record; marker constant text:='process-studio/admin-operations/20260913/v1';
BEGIN
  FOR x IN SELECT c.oid::regclass AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ps_admin_followups','ps_admin_followup_changes','ps_sync_reports') LOOP
    EXECUTE format('COMMENT ON TABLE %s IS %L',x.name,marker);
  END LOOP;
  FOR x IN SELECT p.oid::regprocedure AS name FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (left(p.proname,13)='ps_admin_ops_' OR p.proname IN
      ('ps_admin_followups_list','ps_admin_followup_save','ps_admin_sync_reports_list','ps_sync_report_put')) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',x.name,marker);
  END LOOP;
END $secure$;
GRANT EXECUTE ON FUNCTION public.ps_admin_followups_list(uuid,uuid),public.ps_admin_followup_save(uuid,integer,jsonb),
  public.ps_admin_sync_reports_list(uuid,uuid),public.ps_sync_report_put(uuid,uuid,bigint,jsonb) TO authenticated;
COMMIT;
