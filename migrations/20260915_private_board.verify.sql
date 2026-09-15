-- READ ONLY security verification. Does not read or mutate live board data.
DO $$
DECLARE p record; f record;
BEGIN
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.ps_kv') AND relrowsecurity) THEN RAISE EXCEPTION 'ps_kv RLS is disabled'; END IF;
 SELECT * INTO p FROM pg_policy WHERE polrelid='public.ps_kv'::regclass AND polname='ps_private_board_owner_v1';
 IF NOT FOUND OR p.polpermissive OR p.polcmd<>'*' OR p.polroles IS DISTINCT FROM ARRAY['authenticated'::regrole::oid]
 OR p.polqual IS NULL OR p.polwithcheck IS NULL
 OR position('cs_private_board_v1' IN pg_get_expr(p.polqual,p.polrelid))=0
 OR position('cs_board_live_v1' IN pg_get_expr(p.polqual,p.polrelid))=0
 OR pg_get_expr(p.polqual,p.polrelid) IS DISTINCT FROM pg_get_expr(p.polwithcheck,p.polrelid) THEN
   RAISE EXCEPTION 'Private board restrictive policy differs'; END IF;
 SELECT * INTO p FROM pg_policy WHERE polrelid='public.ps_kv'::regclass AND polname='ps_private_board_role_v1';
 IF NOT FOUND OR p.polpermissive OR p.polcmd<>'*' OR p.polroles IS DISTINCT FROM ARRAY[0]::oid[]
 OR position('pg_has_role' IN pg_get_expr(p.polqual,p.polrelid))=0
 OR position('USAGE' IN pg_get_expr(p.polqual,p.polrelid))=0
 OR position('cs_private_board_v1' IN pg_get_expr(p.polqual,p.polrelid))=0
 OR position('cs_board_live_v1' IN pg_get_expr(p.polqual,p.polrelid))=0
 OR pg_get_expr(p.polqual,p.polrelid) IS DISTINCT FROM pg_get_expr(p.polwithcheck,p.polrelid) THEN
   RAISE EXCEPTION 'Private board DB-role gate differs'; END IF;
 SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.ps_private_board_owner_v1(uuid)');
 IF NOT FOUND OR NOT f.prosecdef OR f.provolatile<>'s' OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR has_function_privilege('anon',f.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Private board helper grants differ'; END IF;
 FOR f IN SELECT proc.oid,proc.proname,proc.prosrc,expected.original_md5 FROM
   (VALUES ('public.ps_kv_history_get(uuid,bigint)','bc15db7508fd9065c0739031bb3a068b'),
           ('public.ps_kv_history_list(uuid,text,integer)','0dfcc022d34f4016d9845afc29a5cc03')) expected(signature,original_md5)
   LEFT JOIN pg_proc proc ON proc.oid=to_regprocedure(expected.signature) LOOP
   IF f.oid IS NULL OR position(E'\n    and (h.k not in (''cs_private_board_v1'',''cs_board_live_v1'') or public.ps_private_board_owner_v1(p_wid))' IN f.prosrc)=0
   OR md5(replace(f.prosrc,E'\n    and (h.k not in (''cs_private_board_v1'',''cs_board_live_v1'') or public.ps_private_board_owner_v1(p_wid))',''))<>f.original_md5 THEN
     RAISE EXCEPTION 'History privacy patch differs: %',f.proname; END IF;
 END LOOP;
END $$;
SELECT p.polname,p.polpermissive,pg_get_expr(p.polqual,p.polrelid) AS using_expression,
 pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
FROM pg_policy p WHERE p.polrelid='public.ps_kv'::regclass AND p.polname IN ('ps_private_board_owner_v1','ps_private_board_role_v1');
