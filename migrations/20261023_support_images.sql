-- One private image per support report. No existing app table/function is changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
DECLARE x record; marker constant text:='process-studio/support-images/20261023/v1';
BEGIN
  IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'database administrator required'; END IF;
  IF to_regprocedure('public.ps_support_get(uuid)') IS NULL OR to_regprocedure('public.ps_support_validate_diagnostics(jsonb)') IS NULL THEN RAISE EXCEPTION 'support reports must be installed first'; END IF;
  IF to_regclass('public.ps_support_images') IS NOT NULL AND obj_description(to_regclass('public.ps_support_images'),'pg_class') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'foreign support image table'; END IF;
  FOR x IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('ps_support_image_info','ps_support_create_image','ps_support_get_with_image','ps_support_image_get') LOOP
    IF obj_description(x.oid,'pg_proc') IS DISTINCT FROM marker THEN RAISE EXCEPTION 'foreign support image function'; END IF;
  END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS public.ps_support_images(
  report_id uuid PRIMARY KEY REFERENCES public.ps_support_reports(id) ON DELETE CASCADE,
  image bytea NOT NULL CHECK(octet_length(image) BETWEEN 32 AND 524288),
  width integer NOT NULL CHECK(width BETWEEN 1 AND 2048),
  height integer NOT NULL CHECK(height BETWEEN 1 AND 2048),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
COMMENT ON TABLE public.ps_support_images IS 'process-studio/support-images/20261023/v1';
ALTER TABLE public.ps_support_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_support_images FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ps_support_image_info(p_image bytea) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer:=octet_length(p_image); pos integer:=2; marker integer; len integer; w integer; h integer; segments integer:=0;
BEGIN
  IF n IS NULL OR n NOT BETWEEN 32 AND 524288 OR substring(p_image FROM 1 FOR 3)<>decode('ffd8ff','hex') OR substring(p_image FROM n-1 FOR 2)<>decode('ffd9','hex') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_support_image'; END IF;
  WHILE pos+4<n AND segments<256 LOOP
    IF get_byte(p_image,pos)<>255 THEN EXIT; END IF;
    WHILE pos<n AND get_byte(p_image,pos)=255 LOOP pos:=pos+1; END LOOP;
    IF pos+3>=n THEN EXIT; END IF;
    marker:=get_byte(p_image,pos);pos:=pos+1;
    IF marker IN (217,218) THEN EXIT; END IF;
    len:=get_byte(p_image,pos)*256+get_byte(p_image,pos+1);
    IF len<2 OR pos+len>n THEN EXIT; END IF;
    IF marker IN (192,194) THEN
      IF len<8 THEN EXIT; END IF;
      h:=get_byte(p_image,pos+3)*256+get_byte(p_image,pos+4);w:=get_byte(p_image,pos+5)*256+get_byte(p_image,pos+6);
      IF w NOT BETWEEN 1 AND 2048 OR h NOT BETWEEN 1 AND 2048 THEN EXIT; END IF;
      RETURN jsonb_build_object('width',w,'height',h,'bytes',n,'mime','image/jpeg','hash',encode(sha256(p_image),'hex'));
    END IF;
    pos:=pos+len;segments:=segments+1;
  END LOOP;
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_support_image';
END $$;

CREATE OR REPLACE FUNCTION public.ps_support_create_image(p_id uuid,p_title text,p_body text,p_diagnostics jsonb,p_image text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); r public.ps_support_reports%ROWTYPE; data bytea; info jsonb; old_image bytea;
  title_value text:=btrim(p_title,E' \t\n\r\f\013');body_value text:=btrim(p_body,E' \t\n\r\f\013');
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  IF p_id IS NULL OR title_value IS NULL OR body_value IS NULL OR char_length(title_value) NOT BETWEEN 1 AND 120 OR char_length(body_value) NOT BETWEEN 1 AND 8000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_report'; END IF;
  PERFORM public.ps_support_validate_diagnostics(p_diagnostics);
  IF p_image IS NULL OR length(p_image) NOT BETWEEN 44 AND 699052 OR p_image !~ '^[A-Za-z0-9+/]+={0,2}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_support_image'; END IF;
  BEGIN data:=decode(p_image,'base64');EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_support_image';END;
  info:=public.ps_support_image_info(data);
  -- Serialize this reporter's requests, including the bounded daily allowance.
  PERFORM pg_advisory_xact_lock(hashtextextended('support-image:'||actor::text,0));
  SELECT * INTO r FROM public.ps_support_reports WHERE id=p_id;
  IF FOUND THEN
    SELECT image INTO old_image FROM public.ps_support_images WHERE report_id=p_id;
    IF r.reporter_id IS DISTINCT FROM actor OR r.title IS DISTINCT FROM title_value OR r.body IS DISTINCT FROM body_value OR r.diagnostics IS DISTINCT FROM p_diagnostics OR old_image IS DISTINCT FROM data THEN
      RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='report_id_conflict';
    END IF;
  ELSE
    IF (SELECT count(*) FROM public.ps_support_images i JOIN public.ps_support_reports q ON q.id=i.report_id WHERE q.reporter_id=actor AND i.created_at>clock_timestamp()-interval '24 hours')>=20 THEN RAISE EXCEPTION USING ERRCODE='PT429',MESSAGE='support_image_limit'; END IF;
    INSERT INTO public.ps_support_reports(id,reporter_id,title,body,diagnostics) VALUES(p_id,actor,title_value,body_value,p_diagnostics) ON CONFLICT(id) DO NOTHING RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='report_id_conflict'; END IF;
    INSERT INTO public.ps_support_images(report_id,image,width,height) VALUES(p_id,data,(info->>'width')::integer,(info->>'height')::integer);
  END IF;
  RETURN jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,'is_own',true,'image',info);
END $$;

CREATE OR REPLACE FUNCTION public.ps_support_get_with_image(p_report_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; info jsonb;
BEGIN
  result:=public.ps_support_get(p_report_id);
  SELECT jsonb_build_object('width',width,'height',height,'bytes',octet_length(image),'mime','image/jpeg','hash',encode(sha256(image),'hex')) INTO info FROM public.ps_support_images WHERE report_id=p_report_id;
  RETURN result||jsonb_build_object('image',info);
END $$;

CREATE OR REPLACE FUNCTION public.ps_support_image_get(p_report_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); i public.ps_support_images%ROWTYPE;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='login_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ps_support_reports WHERE id=p_report_id AND (reporter_id=actor OR public.ps_is_admin() IS TRUE)) THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  SELECT * INTO i FROM public.ps_support_images WHERE report_id=p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='report_not_found'; END IF;
  RETURN jsonb_build_object('mime','image/jpeg','width',i.width,'height',i.height,'bytes',octet_length(i.image),'data',replace(encode(i.image,'base64'),E'\n',''));
END $$;
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('ps_support_image_info','ps_support_create_image','ps_support_get_with_image','ps_support_image_get') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',x.signature);
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',x.signature,'process-studio/support-images/20261023/v1');
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.ps_support_create_image(uuid,text,text,jsonb,text),public.ps_support_get_with_image(uuid),public.ps_support_image_get(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
