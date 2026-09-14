-- Private support reports and replies only. Existing app data/security helpers
-- are never modified. Apply only after the catalog preflight and local tests.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_catalog.pg_advisory_xact_lock(7214091501);
DO $preflight$
DECLARE x record; marker constant text:='process-studio/support-reports/20260915/v1';
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'support reports: database administrator required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('auth.uid()') AND prorettype='uuid'::regtype)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.ps_is_admin()') AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'support reports: catalog-confirmed auth/admin helpers required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon' AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'support reports: expected client roles required';
  END IF;
  FOR x IN SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ps_support_reports','ps_support_replies') LOOP
    IF pg_catalog.obj_description(x.oid,'pg_class') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'support reports: table belongs to another migration'; END IF;
  END LOOP;
  FOR x IN SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,11)='ps_support_' LOOP
    IF pg_catalog.obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'support reports: function belongs to another migration'; END IF;
  END LOOP;
END $preflight$;

CREATE TABLE IF NOT EXISTS public.ps_support_reports(
  id uuid PRIMARY KEY,
  reporter_id uuid NOT NULL,
  title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120 AND title=btrim(title)),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 8000 AND body=btrim(body)),
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(diagnostics)='object' AND octet_length(diagnostics::text)<=49152),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.ps_support_replies(
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.ps_support_reports(id),
  actor_id uuid NOT NULL,
  author_role text NOT NULL CHECK(author_role IN ('reporter','admin')),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000 AND body=btrim(body)),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS ps_support_reports_owner_created_idx ON public.ps_support_reports(reporter_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS ps_support_reports_created_idx ON public.ps_support_reports(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS ps_support_replies_report_idx ON public.ps_support_replies(report_id,created_at,id);
ALTER TABLE public.ps_support_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_support_replies ENABLE ROW LEVEL SECURITY;
-- No direct client policies or grants: only the checked RPCs may read/write.
REVOKE ALL ON public.ps_support_reports,public.ps_support_replies FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ps_support_fields(p_value jsonb,p_allowed text[],p_required boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_value) k WHERE NOT(k=ANY(p_allowed)))
    OR (p_required AND EXISTS(SELECT 1 FROM unnest(p_allowed) k WHERE NOT(p_value?k))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_fields';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_text(p_value jsonb,p_key text,p_max integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE t text;
BEGIN
  IF jsonb_typeof(p_value->p_key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_'||p_key; END IF;
  t:=p_value->>p_key;
  IF char_length(t)>p_max THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='diagnostic_too_long_'||p_key; END IF;
  RETURN t;
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_integer(p_value jsonb,p_key text,p_max integer) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE n numeric;
BEGIN
  IF jsonb_typeof(p_value->p_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_'||p_key; END IF;
  n:=(p_value->>p_key)::numeric;
  IF n<>trunc(n) OR n<0 OR n>p_max THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_'||p_key; END IF;
  RETURN n::integer;
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_time(p_value jsonb,p_key text) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE t text; v timestamptz;
BEGIN
  t:=public.ps_support_text(p_value,p_key,40);
  IF t !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_'||p_key; END IF;
  BEGIN v:=t::timestamptz; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_'||p_key; END;
  IF NOT isfinite(v) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_'||p_key; END IF;
  RETURN v;
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_path(p_value jsonb,p_key text) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE t text:=public.ps_support_text(p_value,p_key,180);
BEGIN
  IF t<>'' AND t !~ '^/(studio/[A-Za-z0-9_-]+\.(html|js|mjs|css)|sw\.js)$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_path';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_validate_diagnostics(p_value jsonb) RETURNS void
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE env jsonb; entry jsonb; frame jsonb; shape jsonb; k text; t text;
BEGIN
  IF p_value IS NULL OR octet_length(p_value::text)>49152 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_size'; END IF;
  IF p_value='{}'::jsonb THEN RETURN; END IF;
  PERFORM public.ps_support_fields(p_value,ARRAY['capturedAt','environment','logs'],true);
  PERFORM public.ps_support_time(p_value,'capturedAt');
  env:=p_value->'environment';
  PERFORM public.ps_support_fields(env,ARRAY['appVersion','browser','os','viewport','screen','language','timeZone','online','displayMode','path'],true);
  t:=public.ps_support_text(env,'appVersion',24);
  IF t !~ '^([0-9]+(\.[0-9]+)*)?$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_appVersion'; END IF;
  t:=public.ps_support_text(env,'browser',40);
  IF t !~ '^(Chrome|Edge|Firefox|Safari|SamsungInternet|Opera|WebView|unknown)( [0-9]{1,4}(\.[0-9]{1,4})?)?$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_browser'; END IF;
  t:=public.ps_support_text(env,'os',24);
  IF t NOT IN ('Windows','macOS','iOS','Android','Linux','ChromeOS','unknown') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_os'; END IF;
  PERFORM public.ps_support_text(env,'language',35);
  PERFORM public.ps_support_text(env,'timeZone',64);
  IF jsonb_typeof(env->'online') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_online'; END IF;
  t:=public.ps_support_text(env,'displayMode',16);
  IF t NOT IN ('browser','standalone','fullscreen','minimal-ui','unknown') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_displayMode'; END IF;
  PERFORM public.ps_support_path(env,'path');
  FOREACH k IN ARRAY ARRAY['viewport','screen'] LOOP
    shape:=env->k;PERFORM public.ps_support_fields(shape,ARRAY['width','height'],true);
    PERFORM public.ps_support_integer(shape,'width',20000);PERFORM public.ps_support_integer(shape,'height',20000);
  END LOOP;
  IF jsonb_typeof(p_value->'logs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_logs'; END IF;
  IF jsonb_array_length(p_value->'logs')>40 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='too_many_diagnostic_logs'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_value->'logs') LOOP
    PERFORM public.ps_support_fields(entry,ARRAY['at','kind','name','code','stage','category','source','line','column','frames'],true);
    PERFORM public.ps_support_time(entry,'at');
    t:=public.ps_support_text(entry,'kind',24);
    IF t NOT IN ('error','unhandledrejection','sync','storage') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_kind'; END IF;
    t:=public.ps_support_text(entry,'name',40);
    IF t NOT IN ('','Error','TypeError','ReferenceError','SyntaxError','RangeError','URIError','EvalError','AggregateError','DOMException','UnhandledRejection','SyncError','StorageError','QuotaExceededError','SecurityError','NetworkError','AbortError','UnknownError','StorageConflictError','StorageOwnerChangedError','StorageVerificationError','PSDataLockedError') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_name'; END IF;
    FOREACH k IN ARRAY ARRAY['code','stage'] LOOP
      t:=public.ps_support_text(entry,k,48);
      IF t !~ '^[A-Za-z0-9_.:-]{0,48}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_token'; END IF;
    END LOOP;
    t:=public.ps_support_text(entry,'category',16);
    IF t NOT IN ('javascript','network','storage','permission','authentication','conflict','timeout','unknown') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_category'; END IF;
    PERFORM public.ps_support_path(entry,'source');
    PERFORM public.ps_support_integer(entry,'line',10000000);PERFORM public.ps_support_integer(entry,'column',10000000);
    IF jsonb_typeof(entry->'frames') IS DISTINCT FROM 'array' OR jsonb_array_length(entry->'frames')>5 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_diagnostic_frames'; END IF;
    FOR frame IN SELECT value FROM jsonb_array_elements(entry->'frames') LOOP
      PERFORM public.ps_support_fields(frame,ARRAY['source','line','column'],true);
      PERFORM public.ps_support_path(frame,'source');
      PERFORM public.ps_support_integer(frame,'line',10000000);PERFORM public.ps_support_integer(frame,'column',10000000);
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ps_support_list(p_limit integer DEFAULT 20,p_before jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; n integer; before_at timestamptz; before_id uuid;
  rows jsonb; cursor_value jsonb:=NULL; entry jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  admin:=public.ps_is_admin() IS TRUE;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>50 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_limit'; END IF;
  IF p_before IS NOT NULL THEN
    PERFORM public.ps_support_fields(p_before,ARRAY['created_at','id'],true);
    before_at:=public.ps_support_time(p_before,'created_at');
    BEGIN before_id:=public.ps_support_text(p_before,'id',36)::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_cursor'; END;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
    'is_own',r.reporter_id=actor,'reply_count',(SELECT count(*) FROM public.ps_support_replies q WHERE q.report_id=r.id),
    'last_reply_at',(SELECT max(q.created_at) FROM public.ps_support_replies q WHERE q.report_id=r.id)) ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb)
    INTO rows FROM (SELECT * FROM public.ps_support_reports WHERE (reporter_id=actor OR admin)
      AND (p_before IS NULL OR (created_at,id)<(before_at,before_id)) ORDER BY created_at DESC,id DESC LIMIT p_limit+1) r;
  n:=jsonb_array_length(rows);
  IF n>p_limit THEN
    rows:=rows-(n-1);entry:=rows->(p_limit-1);cursor_value:=jsonb_build_object('created_at',entry->'created_at','id',entry->'id');
  END IF;
  RETURN jsonb_build_object('reports',rows,'next_cursor',cursor_value,'is_admin',admin);
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_get(p_report_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); r public.ps_support_reports%ROWTYPE; replies jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  SELECT * INTO r FROM public.ps_support_reports WHERE id=p_report_id AND (reporter_id=actor OR public.ps_is_admin() IS TRUE);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'report_id',q.report_id,'body',q.body,'author_role',q.author_role,
    'is_own',q.actor_id=actor,'created_at',q.created_at) ORDER BY q.created_at,q.id),'[]'::jsonb) INTO replies
    FROM public.ps_support_replies q WHERE q.report_id=r.id;
  RETURN jsonb_build_object('report',(to_jsonb(r)-'reporter_id')||jsonb_build_object('is_own',r.reporter_id=actor),'replies',replies);
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_create(p_id uuid,p_title text,p_body text,p_diagnostics jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); r public.ps_support_reports%ROWTYPE; title_value text:=btrim(p_title,E' \t\n\r\f\013'); body_value text:=btrim(p_body,E' \t\n\r\f\013');
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  IF p_id IS NULL OR title_value IS NULL OR body_value IS NULL OR char_length(title_value) NOT BETWEEN 1 AND 120
    OR char_length(body_value) NOT BETWEEN 1 AND 8000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_report'; END IF;
  PERFORM public.ps_support_validate_diagnostics(p_diagnostics);
  INSERT INTO public.ps_support_reports(id,reporter_id,title,body,diagnostics) VALUES(p_id,actor,title_value,body_value,p_diagnostics) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO r FROM public.ps_support_reports WHERE id=p_id;
  IF r.reporter_id IS DISTINCT FROM actor OR r.title IS DISTINCT FROM title_value OR r.body IS DISTINCT FROM body_value
    OR r.diagnostics IS DISTINCT FROM p_diagnostics THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='report_id_conflict'; END IF;
  RETURN jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,'is_own',true);
END $$;
CREATE OR REPLACE FUNCTION public.ps_support_reply(p_id uuid,p_report_id uuid,p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; report public.ps_support_reports%ROWTYPE; r public.ps_support_replies%ROWTYPE;
  body_value text:=btrim(p_body,E' \t\n\r\f\013'); inserted boolean;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  IF p_id IS NULL OR p_report_id IS NULL OR body_value IS NULL OR char_length(body_value) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_reply'; END IF;
  admin:=public.ps_is_admin() IS TRUE;
  SELECT * INTO report FROM public.ps_support_reports WHERE id=p_report_id AND (reporter_id=actor OR admin) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  INSERT INTO public.ps_support_replies(id,report_id,actor_id,author_role,body)
    VALUES(p_id,p_report_id,actor,CASE WHEN admin THEN 'admin' ELSE 'reporter' END,body_value) ON CONFLICT(id) DO NOTHING;
  inserted:=FOUND;
  SELECT * INTO r FROM public.ps_support_replies WHERE id=p_id;
  IF r.actor_id IS DISTINCT FROM actor OR r.report_id IS DISTINCT FROM p_report_id OR r.body IS DISTINCT FROM body_value THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='reply_id_conflict';
  END IF;
  IF inserted THEN UPDATE public.ps_support_reports SET updated_at=clock_timestamp() WHERE id=p_report_id; END IF;
  RETURN (to_jsonb(r)-'actor_id')||jsonb_build_object('is_own',true);
END $$;

DO $secure$
DECLARE x record; marker constant text:='process-studio/support-reports/20260915/v1';
BEGIN
  FOR x IN SELECT c.oid::regclass AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('ps_support_reports','ps_support_replies') LOOP
    EXECUTE format('COMMENT ON TABLE %s IS %L',x.name,marker);
  END LOOP;
  FOR x IN SELECT p.oid::regprocedure AS name FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,11)='ps_support_' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.name);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',x.name,marker);
  END LOOP;
END $secure$;
GRANT EXECUTE ON FUNCTION public.ps_support_list(integer,jsonb),public.ps_support_get(uuid),public.ps_support_create(uuid,text,text,jsonb),public.ps_support_reply(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
