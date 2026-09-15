-- PREPARED / NOT APPLIED. No workspace is activated by installation.
-- Requires the catalog-reviewed ps_kv/member/workspace schema and helpers.
-- Existing RLS, grants, helper functions, audit/history and guards are retained.
-- Canonical mode is deliberately opt-in, with a full raw snapshot precondition.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Fresh installation only: never adopt or replace an unmanaged object merely
-- because its name happens to match this prepared migration.
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_namespace WHERE nspname='ps_roster_private')
 OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('ps_roster_canonical_status','ps_roster_canonical_read','ps_roster_canonical_activate','ps_roster_canonical_mutate'))
 OR EXISTS(SELECT FROM pg_trigger WHERE tgrelid='public.ps_kv'::regclass
   AND tgname IN ('ps_000_roster_canonical_gate_v1','zzzzz_roster_canonical_consume_v1')) THEN
   RAISE EXCEPTION 'Canonical objects already exist; inspect installation before proceeding' USING ERRCODE='55000';
 END IF;
END $$;
CREATE SCHEMA ps_roster_private;
REVOKE ALL ON SCHEMA ps_roster_private FROM PUBLIC, authenticated, anon;
CREATE TABLE ps_roster_private.control (
  workspace_id uuid PRIMARY KEY REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  player_order jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(player_order)='array'),
  activated_at timestamptz, activated_by uuid
);
CREATE TABLE ps_roster_private.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,
  request_id uuid NOT NULL, actor uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  rows jsonb NOT NULL CHECK (jsonb_typeof(rows)='array'),
  UNIQUE(workspace_id,request_id)
);
CREATE TABLE ps_roster_private.requests (
  workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,
  request_id uuid NOT NULL, actor uuid NOT NULL, operation text NOT NULL,
  payload jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,request_id)
);
-- Neither a request header nor a SET-able GUC is authority. Only the private
-- writer can insert a permit, bound to this backend+transaction and exact OLD/NEW.
CREATE TABLE ps_roster_private.write_permits (
  tx bigint NOT NULL, backend integer NOT NULL, workspace_id uuid NOT NULL, k text NOT NULL,
  op text NOT NULL CHECK(op IN ('INSERT','UPDATE')), old_v text, old_c bigint,
  new_v text NOT NULL, new_c bigint NOT NULL, PRIMARY KEY(tx,backend,workspace_id,k)
);
ALTER TABLE ps_roster_private.control ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_roster_private.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_roster_private.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_roster_private.write_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ps_roster_private FROM PUBLIC, authenticated, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ps_roster_private FROM PUBLIC, authenticated, anon;

CREATE FUNCTION ps_roster_private.protected(p_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT p_key IN ('scout_tool_v1','cs_squad_v1','cs_team_attrs_v1','cs_player_del_v1') OR p_key LIKE 'sq:%'
$$;
CREATE FUNCTION ps_roster_private.valid_id(p_id text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT p_id IS NOT NULL AND p_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'
   AND p_id NOT IN ('__proto__','prototype','constructor')
$$;
CREATE FUNCTION ps_roster_private.object(p_raw text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE j jsonb;
BEGIN
 BEGIN j:=p_raw::jsonb; EXCEPTION WHEN invalid_text_representation THEN
   RAISE EXCEPTION 'Invalid roster JSON; original was not changed' USING ERRCODE='22023'; END;
 IF j IS NULL OR jsonb_typeof(j)<>'object' THEN
   RAISE EXCEPTION 'Roster object required' USING ERRCODE='22023'; END IF;
 RETURN j;
END $$;

CREATE FUNCTION ps_roster_private.access(p_wid uuid,p_mode text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); member_role text; kind text; pj jsonb; raw text;
BEGIN
 IF actor IS NULL OR p_wid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 -- Locks keep a mutation's membership, team kind and permission document stable.
 SELECT w.kind,m.role INTO kind,member_role FROM public.ps_workspaces w
 JOIN public.ps_members m ON m.workspace_id=w.id AND m.user_id=actor
 WHERE w.id=p_wid FOR SHARE OF w,m;
 IF NOT FOUND OR kind<>'team' THEN RAISE EXCEPTION 'Team membership required' USING ERRCODE='42501'; END IF;
 IF p_mode='status' THEN RETURN actor; END IF;
 IF p_mode='activate' THEN
   IF member_role<>'owner' THEN RAISE EXCEPTION 'Team owner required' USING ERRCODE='42501'; END IF;
   RETURN actor;
 END IF;
 SELECT v INTO raw FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_perms_v1' FOR SHARE;
 IF member_role<>'owner' THEN
   BEGIN pj:=raw::jsonb; EXCEPTION WHEN invalid_text_representation THEN pj:=NULL; END;
   IF pj IS NULL OR jsonb_typeof(pj)<>'object' THEN
     RAISE EXCEPTION 'Verified team permissions required' USING ERRCODE='42501'; END IF;
 END IF;
 IF NOT coalesce(public.ps_can_read_key(p_wid,'scout_tool_v1'),false)
    OR (p_mode='write' AND NOT coalesce(public.ps_can_write_key(p_wid,'scout_tool_v1'),false)) THEN
   RAISE EXCEPTION 'Roster permission required' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;

CREATE FUNCTION ps_roster_private.snapshot(p_wid uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('k',k,'v',v,'cupd',cupd) ORDER BY k),'[]'::jsonb)
 FROM public.ps_kv WHERE workspace_id=p_wid AND ps_roster_private.protected(k)
$$;

CREATE FUNCTION ps_roster_private.validate(p_wid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE main jsonb; pd jsonb:='{}'; j jsonb; p jsonb; r record; ids jsonb:='{}'; live jsonb:='{}'; ord jsonb:='[]'; t numeric;
BEGIN
 SELECT ps_roster_private.object(v) INTO main FROM public.ps_kv WHERE workspace_id=p_wid AND k='scout_tool_v1';
 IF main IS NULL OR jsonb_typeof(main->'players') IS DISTINCT FROM 'array'
 OR jsonb_array_length(main->'players')>10000 THEN RAISE EXCEPTION 'Valid main players required' USING ERRCODE='22023'; END IF;
 IF (main ? 'meta' AND jsonb_typeof(main->'meta')<>'object')
 OR (main ? 'positions' AND jsonb_typeof(main->'positions')<>'array')
 OR (main ? 'attrs' AND jsonb_typeof(main->'attrs')<>'array') THEN
   RAISE EXCEPTION 'Invalid main metadata shape' USING ERRCODE='22023'; END IF;
 FOR r IN SELECT k,v FROM public.ps_kv WHERE workspace_id=p_wid AND ps_roster_private.protected(k) LOOP
   j:=ps_roster_private.object(r.v);
   IF r.k='cs_player_del_v1' THEN pd:=j; END IF;
   IF r.k LIKE 'sq:%' THEN
     IF NOT ps_roster_private.valid_id(substr(r.k,4)) THEN RAISE EXCEPTION 'Invalid row ID' USING ERRCODE='22023'; END IF;
     IF j ? '_del' THEN
       IF jsonb_typeof(j->'_del')<>'number' THEN RAISE EXCEPTION 'Invalid tombstone' USING ERRCODE='22023'; END IF;
       t:=(j->>'_del')::numeric;
       IF t<=0 OR t>9007199254740991 OR t<>trunc(t) THEN RAISE EXCEPTION 'Invalid tombstone' USING ERRCODE='22023'; END IF;
     ELSE
       IF jsonb_typeof(j->'id') IS DISTINCT FROM 'string' OR j->>'id'<>substr(r.k,4)
       OR jsonb_typeof(j->'name') IS DISTINCT FROM 'string' OR btrim(j->>'name')=''
       OR j->>'type'='target' THEN RAISE EXCEPTION 'Invalid live roster row' USING ERRCODE='22023'; END IF;
       live:=live||jsonb_build_object(j->>'id',j);
     END IF;
   END IF;
 END LOOP;
 FOR r IN SELECT key,value FROM jsonb_each(pd) LOOP
   IF NOT ps_roster_private.valid_id(r.key) OR jsonb_typeof(r.value)<>'number' THEN RAISE EXCEPTION 'Invalid deletion map' USING ERRCODE='22023'; END IF;
   t:=(r.value#>>'{}')::numeric;
   IF t<=0 OR t>9007199254740991 OR t<>trunc(t) THEN RAISE EXCEPTION 'Invalid deletion map' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR p IN SELECT value FROM jsonb_array_elements(main->'players') LOOP
   IF jsonb_typeof(p)<>'object' OR jsonb_typeof(p->'id') IS DISTINCT FROM 'string'
   OR NOT ps_roster_private.valid_id(p->>'id') OR ids ? (p->>'id') THEN
     RAISE EXCEPTION 'Invalid or duplicate main player ID' USING ERRCODE='22023'; END IF;
   IF NOT live ? (p->>'id') OR live->(p->>'id') IS DISTINCT FROM p OR pd ? (p->>'id') THEN
     RAISE EXCEPTION 'Main, live row and deletion map disagree' USING ERRCODE='PT409'; END IF;
   ids:=ids||jsonb_build_object(p->>'id',true); ord:=ord||jsonb_build_array(p->>'id');
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(live))<>(SELECT count(*) FROM jsonb_object_keys(ids)) THEN
   RAISE EXCEPTION 'Unlisted live roster rows' USING ERRCODE='PT409'; END IF;
 RETURN ord;
END $$;

CREATE FUNCTION ps_roster_private.guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE wid uuid; ky text; enabled boolean; permit boolean; ov text; oc bigint; nv text; nc bigint;
BEGIN
 IF TG_OP='DELETE' THEN wid:=OLD.workspace_id; ky:=OLD.k; ELSE wid:=NEW.workspace_id; ky:=NEW.k; END IF;
 IF TG_OP='UPDATE' AND (NEW.workspace_id,NEW.k) IS DISTINCT FROM (OLD.workspace_id,OLD.k) THEN
   IF (ps_roster_private.protected(OLD.k) AND EXISTS(SELECT FROM ps_roster_private.control WHERE workspace_id=OLD.workspace_id AND control.enabled))
   OR (ps_roster_private.protected(NEW.k) AND EXISTS(SELECT FROM ps_roster_private.control WHERE workspace_id=NEW.workspace_id AND control.enabled)) THEN
     RAISE EXCEPTION 'Canonical roster key is immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF NOT ps_roster_private.protected(ky) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 -- Parent deletion cascades must retain their existing semantics.
 IF NOT EXISTS(SELECT FROM public.ps_workspaces WHERE id=wid) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 SELECT c.enabled INTO enabled FROM ps_roster_private.control c WHERE workspace_id=wid FOR SHARE;
 IF NOT coalesce(enabled,false) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Use canonical roster RPC' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN ov:=OLD.v; oc:=OLD.cupd; END IF;
 nv:=NEW.v; nc:=NEW.cupd;
 IF TG_ARGV[0]='consume' THEN
   DELETE FROM ps_roster_private.write_permits p WHERE p.tx=txid_current() AND p.backend=pg_backend_pid()
   AND p.workspace_id=wid AND p.k=ky AND p.op=TG_OP AND p.old_v IS NOT DISTINCT FROM ov
   AND p.old_c IS NOT DISTINCT FROM oc AND p.new_v=nv AND p.new_c=nc RETURNING true INTO permit;
 ELSE
   SELECT true INTO permit FROM ps_roster_private.write_permits p WHERE p.tx=txid_current() AND p.backend=pg_backend_pid()
   AND p.workspace_id=wid AND p.k=ky AND p.op=TG_OP AND p.old_v IS NOT DISTINCT FROM ov
   AND p.old_c IS NOT DISTINCT FROM oc AND p.new_v=nv AND p.new_c=nc;
 END IF;
 IF NOT coalesce(permit,false) THEN RAISE EXCEPTION 'Use canonical roster RPC; exact private permit required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ps_000_roster_canonical_gate_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.ps_kv
FOR EACH ROW EXECUTE FUNCTION ps_roster_private.guard('check');
CREATE TRIGGER zzzzz_roster_canonical_consume_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.ps_kv
FOR EACH ROW EXECUTE FUNCTION ps_roster_private.guard('consume');

CREATE FUNCTION ps_roster_private.put(p_wid uuid,p_key text,p_raw text,p_cupd bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old public.ps_kv%ROWTYPE; actual public.ps_kv%ROWTYPE; present boolean;
BEGIN
 SELECT * INTO old FROM public.ps_kv WHERE workspace_id=p_wid AND k=p_key FOR UPDATE; present:=FOUND;
 IF present AND old.v=p_raw THEN RETURN; END IF;
 INSERT INTO ps_roster_private.write_permits(tx,backend,workspace_id,k,op,old_v,old_c,new_v,new_c)
 VALUES(txid_current(),pg_backend_pid(),p_wid,p_key,CASE WHEN present THEN 'UPDATE' ELSE 'INSERT' END,old.v,old.cupd,p_raw,p_cupd);
 IF present THEN UPDATE public.ps_kv SET v=p_raw,cupd=p_cupd WHERE workspace_id=p_wid AND k=p_key;
 ELSE INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES(p_wid,p_key,p_raw,p_cupd); END IF;
 SELECT * INTO actual FROM public.ps_kv WHERE workspace_id=p_wid AND k=p_key;
 IF NOT FOUND OR actual.v IS DISTINCT FROM p_raw OR actual.cupd IS DISTINCT FROM p_cupd
 OR EXISTS(SELECT FROM ps_roster_private.write_permits WHERE tx=txid_current() AND backend=pg_backend_pid() AND workspace_id=p_wid AND k=p_key) THEN
   RAISE EXCEPTION 'Roster write was not stored exactly' USING ERRCODE='PT409'; END IF;
END $$;

CREATE FUNCTION ps_roster_private.pos_abbr(p_name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE s text:=lower(coalesce(p_name,'')); k text:=upper(btrim(coalesce(p_name,''))); l boolean; r boolean;
BEGIN
 IF k=ANY(ARRAY['GK','LB','LCB','RCB','RB','DM','LDM','RDM','CM','LCM','RCM','AM','LW','RW','CF','LWB','RWB','LM','RM']) THEN RETURN k; END IF;
 l:=s~'좌|왼|left|\mlb\M|\mlw\M'; r:=s~'우|오른|right|\mrb\M|\mrw\M';
 IF s~'gk|골키퍼|키퍼|골리' THEN RETURN 'GK'; END IF;
 IF s~'cb|센터백|중앙\s*수비|스토퍼|중앙백' THEN RETURN CASE WHEN l THEN 'LCB' WHEN r THEN 'RCB' ELSE 'CB' END; END IF;
 IF s~'풀백|윙백|fb|wb|측면\s*수비' THEN RETURN CASE WHEN l THEN 'LB' WHEN r THEN 'RB' ELSE 'FB' END; END IF;
 IF s~'수비형|dm|홀딩|앵커|6번' THEN RETURN 'DM'; END IF;
 IF s~'공격형|am|10번|플레이메이커' THEN RETURN 'AM'; END IF;
 IF s~'윙|wing|wg' THEN RETURN CASE WHEN l THEN 'LW' WHEN r THEN 'RW' ELSE 'W' END; END IF;
 IF s~'스트라이커|공격수|fw|\mst\M|\mcf\M|9번|타겟맨|타겟' THEN RETURN 'ST'; END IF;
 IF s~'중앙|미드|미들|cm|mf|8번' THEN RETURN 'CM'; END IF;
 s:=regexp_replace(coalesce(p_name,''),'\s','','g'); RETURN CASE WHEN s~'[a-zA-Z]' THEN upper(left(s,3)) ELSE left(s,2) END;
END $$;

CREATE FUNCTION ps_roster_private.project(p_wid uuid,p_order jsonb,p_main jsonb,p_stamp bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE players jsonb:='[]'; public_players jsonb:='[]'; grp jsonb:='{}'; p jsonb; pid text; pos text; st text; squad jsonb; attrs jsonb; arr jsonb; item jsonb; pub jsonb; prior_main jsonb;
BEGIN
 SELECT ps_roster_private.object(v) INTO prior_main FROM public.ps_kv WHERE workspace_id=p_wid AND k='scout_tool_v1';
 FOR pid IN SELECT value FROM jsonb_array_elements_text(p_order) LOOP
   SELECT ps_roster_private.object(v) INTO p FROM public.ps_kv WHERE workspace_id=p_wid AND k='sq:'||pid;
   IF p IS NULL OR p ? '_del' THEN RAISE EXCEPTION 'Invalid projection source' USING ERRCODE='PT409'; END IF;
   players:=players||jsonb_build_array(p);
   SELECT ps_roster_private.pos_abbr(x->>'name') INTO pos FROM jsonb_array_elements(coalesce(p_main->'positions','[]')) x WHERE x->>'id'=p->>'posId' LIMIT 1;
   st:=CASE WHEN p->>'status'=ANY(ARRAY['ok','rest','rehab','injury','out']) THEN p->>'status' ELSE 'ok' END;
   public_players:=public_players||jsonb_build_array(jsonb_build_object('id',pid,'name',p->>'name','num',coalesce(p->'num','""'::jsonb),
     'pos',coalesce(pos,''),'foot',coalesce(p->'foot','""'::jsonb),'bench',coalesce(p->'bench'='true'::jsonb,false),'status',st,'grp',btrim(coalesce(p->>'grp',''))));
   IF btrim(coalesce(p->>'grp',''))<>'' THEN grp:=grp||jsonb_build_object(pid,btrim(p->>'grp')); END IF;
 END LOOP;
 p_main:=jsonb_set(p_main,'{players}',players);
 -- All metadata and unknown fields survive. Only players and this projection
 -- count are maintained here; no evaluation/status/participation normalization.
 IF jsonb_typeof(p_main->'_items')='object' THEN p_main:=jsonb_set(p_main,'{_items,n}',to_jsonb(jsonb_array_length(players))); END IF;
 SELECT ps_roster_private.object(v) INTO squad FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_squad_v1';
 SELECT ps_roster_private.object(v) INTO attrs FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_team_attrs_v1';
 squad:=coalesce(squad,'{}')||jsonb_build_object('name',coalesce(p_main->'meta'->>'teamName',''),'players',public_players);
 attrs:=coalesce(attrs,'{}')||jsonb_build_object('grpBy',grp);
 -- Match the client's existing public metadata allowlist; never publish a full
 -- player or arbitrary main.meta object. Missing legacy source fields retain the
 -- existing public value until that field is explicitly written in main.
 IF p_main ? 'attrs' OR prior_main ? 'attrs' THEN
   arr:='[]'; FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_main->'attrs','[]')) LOOP
     IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'Invalid attribute definition' USING ERRCODE='22023'; END IF;
     pub:=jsonb_build_object('id',item->'id','cat',item->'cat','name',item->'name','source',coalesce(item->'source','""'));
     IF btrim(coalesce(item->>'q',''))<>'' THEN pub:=pub||jsonb_build_object('q',btrim(item->>'q')); END IF;
     IF btrim(coalesce(item->>'w',''))<>'' THEN pub:=pub||jsonb_build_object('w',btrim(item->>'w')); END IF;
     arr:=arr||jsonb_build_array(pub);
   END LOOP; attrs:=attrs||jsonb_build_object('attrs',arr);
 END IF;
 IF p_main ? 'positions' OR prior_main ? 'positions' THEN
   arr:='[]'; FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_main->'positions','[]')) LOOP
     IF jsonb_typeof(item)<>'object' THEN RAISE EXCEPTION 'Invalid position definition' USING ERRCODE='22023'; END IF;
     arr:=arr||jsonb_build_array(jsonb_build_object('id',item->'id','name',item->'name','req',coalesce(item->'req','{}'),
       'wantArch',coalesce(item->'wantArch','""'),'ideal',coalesce(item->'ideal','{}')));
   END LOOP; attrs:=attrs||jsonb_build_object('positions',arr);
 END IF;
 IF p_main->'meta' ? 'prompts' OR prior_main->'meta' ? 'prompts' THEN
   IF jsonb_typeof(p_main->'meta'->'prompts')<>'array' THEN RAISE EXCEPTION 'Invalid prompts' USING ERRCODE='22023'; END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',x->'id','q',x->'q','at',x->'at','by',x->'by','open',CASE WHEN x->'open' IN ('true','1') THEN 1 ELSE 0 END) ORDER BY n),'[]')
     INTO arr FROM jsonb_array_elements(coalesce(p_main->'meta'->'prompts','[]')) WITH ORDINALITY e(x,n) WHERE n<=30;
   attrs:=attrs||jsonb_build_object('prompts',arr);
 END IF;
 IF p_main ? 'exLinks' OR prior_main ? 'exLinks' THEN attrs:=attrs||jsonb_build_object('ex',coalesce(p_main->'exLinks','{}')); END IF;
 IF p_main->'meta' ? 'cats' OR prior_main->'meta' ? 'cats' THEN
   IF jsonb_typeof(p_main->'meta'->'cats')<>'array' THEN RAISE EXCEPTION 'Invalid categories' USING ERRCODE='22023'; END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',x->'id','name',x->'name') ORDER BY n),'[]') INTO arr
     FROM jsonb_array_elements(coalesce(p_main->'meta'->'cats','[]')) WITH ORDINALITY e(x,n);
   attrs:=attrs||jsonb_build_object('cats',arr);
 END IF;
 IF p_main->'meta' ? 'grpBase' OR prior_main->'meta' ? 'grpBase' THEN attrs:=attrs||jsonb_build_object('grpBase',coalesce(p_main->'meta'->'grpBase','[]')); END IF;
 IF p_main->'meta' ? 'evalMode' OR prior_main->'meta' ? 'evalMode' THEN attrs:=attrs||jsonb_build_object('evalMode',coalesce(p_main->'meta'->'evalMode','null')); END IF;
 IF p_main->'meta' ? 'activeEvalSetId' OR prior_main->'meta' ? 'activeEvalSetId' THEN attrs:=attrs||jsonb_build_object('setId',coalesce(p_main->'meta'->'activeEvalSetId','null')); END IF;
 PERFORM ps_roster_private.put(p_wid,'scout_tool_v1',p_main::text,p_stamp);
 PERFORM ps_roster_private.put(p_wid,'cs_squad_v1',squad::text,p_stamp);
 PERFORM ps_roster_private.put(p_wid,'cs_team_attrs_v1',attrs::text,p_stamp);
 IF (SELECT v FROM public.ps_kv WHERE workspace_id=p_wid AND k='scout_tool_v1') IS DISTINCT FROM p_main::text
 OR (SELECT v FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_squad_v1') IS DISTINCT FROM squad::text
 OR (SELECT v FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_team_attrs_v1') IS DISTINCT FROM attrs::text THEN
   RAISE EXCEPTION 'Projection changed during storage' USING ERRCODE='PT409'; END IF;
END $$;

CREATE FUNCTION public.ps_roster_canonical_status(p_wid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ps_roster_private.control%ROWTYPE;
BEGIN
 PERFORM ps_roster_private.access(p_wid,'status');
 SELECT * INTO c FROM ps_roster_private.control WHERE workspace_id=p_wid;
 RETURN jsonb_build_object('protocol',1,'enabled',coalesce(c.enabled,false),'revision',coalesce(c.revision,0));
END $$;
CREATE FUNCTION public.ps_roster_canonical_read(p_wid uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ps_roster_private.control%ROWTYPE; rows jsonb;
BEGIN
 PERFORM ps_roster_private.access(p_wid,'read');
 SELECT * INTO c FROM ps_roster_private.control WHERE workspace_id=p_wid FOR SHARE;
 rows:=ps_roster_private.snapshot(p_wid);
 RETURN jsonb_build_object('protocol',1,'enabled',coalesce(c.enabled,false),'revision',coalesce(c.revision,0),'order',coalesce(c.player_order,'[]'),'rows',rows);
END $$;

CREATE FUNCTION public.ps_roster_canonical_activate(p_wid uuid,p_request_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='5s' SET statement_timeout='30s' AS $$
DECLARE actor uuid; actual jsonb; expected jsonb; ord jsonb; result jsonb; old ps_roster_private.requests%ROWTYPE; c ps_roster_private.control%ROWTYPE; stamp bigint;
BEGIN
 IF p_request_id IS NULL OR jsonb_typeof(p_expected) IS DISTINCT FROM 'array' OR jsonb_array_length(p_expected)>10004 THEN RAISE EXCEPTION 'Exact snapshot required' USING ERRCODE='22023'; END IF;
 actor:=ps_roster_private.access(p_wid,'activate');
 INSERT INTO ps_roster_private.control(workspace_id) VALUES(p_wid) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM ps_roster_private.control WHERE workspace_id=p_wid FOR UPDATE;
 SELECT * INTO old FROM ps_roster_private.requests WHERE workspace_id=p_wid AND request_id=p_request_id;
 IF FOUND THEN
   IF old.actor<>actor OR old.operation<>'activate' OR old.payload IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Request ID already used' USING ERRCODE='PT409'; END IF;
   RETURN old.result;
 END IF;
 IF c.enabled THEN RAISE EXCEPTION 'Team is already canonical' USING ERRCODE='PT409'; END IF;
 -- This short administrative opt-in excludes pre-existing legacy INSERT/UPDATE
 -- transactions. Acquire the team lock first, matching ordinary mutation order.
 LOCK TABLE public.ps_kv IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT FROM jsonb_array_elements(p_expected) e WHERE jsonb_typeof(e)<>'object'
   OR (SELECT count(*) FROM jsonb_object_keys(e))<>3 OR jsonb_typeof(e->'k') IS DISTINCT FROM 'string'
   OR jsonb_typeof(e->'v') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'cupd') IS DISTINCT FROM 'number'
   OR NOT ps_roster_private.protected(e->>'k'))
 OR (SELECT count(*) FROM jsonb_array_elements(p_expected))<>(SELECT count(DISTINCT e->>'k') FROM jsonb_array_elements(p_expected) e) THEN
   RAISE EXCEPTION 'Invalid exact snapshot' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'k'),'[]') INTO expected FROM jsonb_array_elements(p_expected) e;
 actual:=ps_roster_private.snapshot(p_wid);
 IF expected IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Activation snapshot changed' USING ERRCODE='PT409'; END IF;
 ord:=ps_roster_private.validate(p_wid);
 INSERT INTO ps_roster_private.backups(workspace_id,request_id,actor,rows) VALUES(p_wid,p_request_id,actor,actual);
 IF NOT EXISTS(SELECT FROM ps_roster_private.backups WHERE workspace_id=p_wid AND request_id=p_request_id AND rows=actual) THEN RAISE EXCEPTION 'Backup verification failed' USING ERRCODE='PT409'; END IF;
 SELECT greatest(floor(extract(epoch FROM clock_timestamp())*1000)::bigint,coalesce(max(cupd),0)+1) INTO stamp FROM public.ps_kv WHERE workspace_id=p_wid AND ps_roster_private.protected(k);
 UPDATE ps_roster_private.control SET enabled=true,revision=stamp,player_order=ord,activated_at=now(),activated_by=actor WHERE workspace_id=p_wid;
 result:=public.ps_roster_canonical_read(p_wid);
 INSERT INTO ps_roster_private.requests VALUES(p_wid,p_request_id,actor,'activate',p_expected,result,now());
 RETURN result;
END $$;

CREATE FUNCTION public.ps_roster_canonical_mutate(p_wid uuid,p_request_id uuid,p_changes jsonb,p_meta jsonb DEFAULT NULL,p_order jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='5s' SET statement_timeout='30s' AS $$
DECLARE actor uuid; c ps_roster_private.control%ROWTYPE; old ps_roster_private.requests%ROWTYPE; payload jsonb; result jsonb;
 main_row public.ps_kv%ROWTYPE; row_now public.ps_kv%ROWTYPE; main jsonb; pd jsonb:='{}'; ch jsonb; p jsonb; pid text; ky text; ord jsonb; seen jsonb:='{}'; live jsonb:='{}'; new_order jsonb:='[]'; stamp bigint; found_row boolean; before_rows jsonb; untouched_before jsonb; untouched_after jsonb;
BEGIN
 IF p_request_id IS NULL OR jsonb_typeof(p_changes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_changes)>10000 THEN RAISE EXCEPTION 'Changes array required' USING ERRCODE='22023'; END IF;
 actor:=ps_roster_private.access(p_wid,'write');
 SELECT * INTO c FROM ps_roster_private.control WHERE workspace_id=p_wid FOR UPDATE;
 IF NOT coalesce(c.enabled,false) THEN RAISE EXCEPTION 'Canonical mode is not enabled' USING ERRCODE='PT409'; END IF;
 payload:=jsonb_build_object('changes',p_changes,'meta',p_meta,'order',p_order);
 SELECT * INTO old FROM ps_roster_private.requests WHERE workspace_id=p_wid AND request_id=p_request_id;
 IF FOUND THEN
   IF old.actor<>actor OR old.operation<>'mutate' OR old.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request ID already used' USING ERRCODE='PT409'; END IF;
   RETURN old.result;
 END IF;
 ord:=ps_roster_private.validate(p_wid);
 before_rows:=ps_roster_private.snapshot(p_wid);
 IF ord IS DISTINCT FROM c.player_order THEN RAISE EXCEPTION 'Canonical order mismatch' USING ERRCODE='PT409'; END IF;
 SELECT * INTO main_row FROM public.ps_kv WHERE workspace_id=p_wid AND k='scout_tool_v1' FOR UPDATE;
 main:=ps_roster_private.object(main_row.v);
 SELECT ps_roster_private.object(v) INTO pd FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_player_del_v1'; pd:=coalesce(pd,'{}');
 IF p_meta IS NOT NULL THEN
   IF jsonb_typeof(p_meta)<>'object' OR jsonb_typeof(p_meta->'values') IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_meta->'removeKeys') IS DISTINCT FROM 'array'
   OR EXISTS(SELECT FROM jsonb_object_keys(p_meta) k WHERE k NOT IN ('expected_raw','expected_cupd','values','removeKeys'))
   OR (p_meta->'values') ?| ARRAY['players','_items']
   OR EXISTS(SELECT FROM jsonb_array_elements(p_meta->'removeKeys') e WHERE jsonb_typeof(e)<>'string' OR e#>>'{}' IN ('players','_items')) THEN RAISE EXCEPTION 'Invalid metadata patch' USING ERRCODE='22023'; END IF;
   IF p_meta->>'expected_raw' IS DISTINCT FROM main_row.v OR p_meta->'expected_cupd' IS DISTINCT FROM to_jsonb(main_row.cupd) THEN RAISE EXCEPTION 'Metadata changed' USING ERRCODE='PT409'; END IF;
   main:=main||(p_meta->'values'); FOR ky IN SELECT value FROM jsonb_array_elements_text(p_meta->'removeKeys') LOOP main:=main-ky; END LOOP;
 END IF;
 IF p_order IS NOT NULL AND (jsonb_typeof(p_order)<>'object' OR jsonb_typeof(p_order->'ids') IS DISTINCT FROM 'array'
 OR EXISTS(SELECT FROM jsonb_object_keys(p_order) k WHERE k NOT IN ('expected_cupd','ids'))) THEN RAISE EXCEPTION 'Invalid order patch' USING ERRCODE='22023'; END IF;
 IF p_order IS NOT NULL AND p_order->'expected_cupd' IS DISTINCT FROM to_jsonb(main_row.cupd) THEN RAISE EXCEPTION 'Order changed' USING ERRCODE='PT409'; END IF;
 SELECT greatest(c.revision+1,floor(extract(epoch FROM clock_timestamp())*1000)::bigint,coalesce(max(cupd),0)+1) INTO stamp FROM public.ps_kv WHERE workspace_id=p_wid AND ps_roster_private.protected(k);
 IF stamp>9007199254740991 THEN RAISE EXCEPTION 'Revision overflow' USING ERRCODE='22023'; END IF;
 FOR ch IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
   pid:=ch->>'id';
   IF jsonb_typeof(ch)<>'object' OR NOT ps_roster_private.valid_id(pid) OR seen ? pid
   OR NOT ch ?& ARRAY['id','expected_raw','expected_cupd']
   OR (ch ? 'player')=(ch ? 'delete')
   OR EXISTS(SELECT FROM jsonb_object_keys(ch) k WHERE k NOT IN ('id','expected_raw','expected_cupd','player','delete'))
   OR (ch ? 'delete' AND ch->'delete'<>'true'::jsonb) THEN RAISE EXCEPTION 'Invalid unique player change' USING ERRCODE='22023'; END IF;
   seen:=seen||jsonb_build_object(pid,true);
   SELECT * INTO row_now FROM public.ps_kv WHERE workspace_id=p_wid AND k='sq:'||pid FOR UPDATE; found_row:=FOUND;
   IF (found_row AND (ch->>'expected_raw' IS DISTINCT FROM row_now.v OR ch->'expected_cupd' IS DISTINCT FROM to_jsonb(row_now.cupd)))
   OR (NOT found_row AND (ch->'expected_raw'<>'null'::jsonb OR ch->'expected_cupd'<>'null'::jsonb)) THEN RAISE EXCEPTION 'Player preimage changed' USING ERRCODE='PT409'; END IF;
   IF ch ? 'player' THEN
     p:=ch->'player';
     IF jsonb_typeof(p)<>'object' OR p->>'id' IS DISTINCT FROM pid OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string'
     OR btrim(p->>'name')='' OR p ? '_del' OR p->>'type'='target' THEN RAISE EXCEPTION 'Invalid full player object' USING ERRCODE='22023'; END IF;
     IF pd ? pid OR (found_row AND ps_roster_private.object(row_now.v) ? '_del') THEN RAISE EXCEPTION 'Deleted player requires explicit recovery' USING ERRCODE='PT409'; END IF;
     IF NOT found_row THEN ord:=ord||jsonb_build_array(pid); END IF;
   ELSE
     IF NOT found_row THEN RAISE EXCEPTION 'Missing player cannot be deleted' USING ERRCODE='PT409'; END IF;
     IF ps_roster_private.object(row_now.v) ? '_del' THEN RAISE EXCEPTION 'Player is already deleted' USING ERRCODE='PT409'; END IF;
     p:=jsonb_build_object('_del',stamp); pd:=pd||jsonb_build_object(pid,stamp);
     SELECT coalesce(jsonb_agg(v),'[]') INTO ord FROM jsonb_array_elements(ord) v WHERE v#>>'{}'<>pid;
   END IF;
   PERFORM ps_roster_private.put(p_wid,'sq:'||pid,p::text,stamp);
 END LOOP;
 IF p_order IS NOT NULL THEN
   FOR pid IN SELECT value FROM jsonb_array_elements_text(ord) LOOP live:=live||jsonb_build_object(pid,true); END LOOP;
   seen:='{}';
   FOR p IN SELECT value FROM jsonb_array_elements(p_order->'ids') LOOP
     pid:=p#>>'{}';
     IF jsonb_typeof(p)<>'string' OR NOT live ? pid OR seen ? pid THEN RAISE EXCEPTION 'Order must contain the exact live IDs' USING ERRCODE='22023'; END IF;
     seen:=seen||jsonb_build_object(pid,true); new_order:=new_order||jsonb_build_array(pid);
   END LOOP;
   IF jsonb_array_length(new_order)<>jsonb_array_length(ord) THEN RAISE EXCEPTION 'Incomplete player order' USING ERRCODE='22023'; END IF;
   ord:=new_order;
 END IF;
 -- Even if the deletion map was absent, do not introduce it for a metadata edit.
 IF EXISTS(SELECT FROM jsonb_array_elements(p_changes) e WHERE e ? 'delete') THEN PERFORM ps_roster_private.put(p_wid,'cs_player_del_v1',pd::text,stamp); END IF;
 PERFORM ps_roster_private.project(p_wid,ord,main,stamp);
 IF ps_roster_private.validate(p_wid) IS DISTINCT FROM ord THEN RAISE EXCEPTION 'Final roster verification failed' USING ERRCODE='PT409'; END IF;
 -- A derived trigger cannot quietly alter another player while this request
 -- edits one row. Nonselected SQ rows retain their exact bytes and timestamps.
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'k'),'[]') INTO untouched_before FROM jsonb_array_elements(before_rows) e
 WHERE e->>'k' LIKE 'sq:%' AND NOT EXISTS(SELECT FROM jsonb_array_elements(p_changes) candidate WHERE 'sq:'||(candidate->>'id')=e->>'k');
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'k'),'[]') INTO untouched_after FROM jsonb_array_elements(ps_roster_private.snapshot(p_wid)) e
 WHERE e->>'k' LIKE 'sq:%' AND NOT EXISTS(SELECT FROM jsonb_array_elements(p_changes) candidate WHERE 'sq:'||(candidate->>'id')=e->>'k');
 IF untouched_before IS DISTINCT FROM untouched_after THEN RAISE EXCEPTION 'Unselected player changed' USING ERRCODE='PT409'; END IF;
 FOR ch IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
   p:=CASE WHEN ch ? 'player' THEN ch->'player' ELSE jsonb_build_object('_del',stamp) END;
   IF (SELECT v FROM public.ps_kv WHERE workspace_id=p_wid AND k='sq:'||(ch->>'id')) IS DISTINCT FROM p::text THEN
     RAISE EXCEPTION 'Selected player changed during projection' USING ERRCODE='PT409'; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM jsonb_array_elements(p_changes) e WHERE e ? 'delete') THEN
   IF (SELECT v FROM public.ps_kv WHERE workspace_id=p_wid AND k='cs_player_del_v1') IS DISTINCT FROM pd::text THEN RAISE EXCEPTION 'Deletion map changed during projection' USING ERRCODE='PT409'; END IF;
 ELSIF (SELECT e FROM jsonb_array_elements(before_rows) e WHERE e->>'k'='cs_player_del_v1') IS DISTINCT FROM
       (SELECT e FROM jsonb_array_elements(ps_roster_private.snapshot(p_wid)) e WHERE e->>'k'='cs_player_del_v1') THEN
   RAISE EXCEPTION 'Unchanged deletion map was modified' USING ERRCODE='PT409'; END IF;
 UPDATE ps_roster_private.control SET revision=stamp,player_order=ord WHERE workspace_id=p_wid;
 result:=public.ps_roster_canonical_read(p_wid);
 INSERT INTO ps_roster_private.requests VALUES(p_wid,p_request_id,actor,'mutate',payload,result,now());
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ps_roster_private FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.ps_roster_canonical_status(uuid),public.ps_roster_canonical_read(uuid),
 public.ps_roster_canonical_activate(uuid,uuid,jsonb),public.ps_roster_canonical_mutate(uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_roster_canonical_status(uuid),public.ps_roster_canonical_read(uuid),
 public.ps_roster_canonical_activate(uuid,uuid,jsonb),public.ps_roster_canonical_mutate(uuid,uuid,jsonb,jsonb,jsonb) TO authenticated;
COMMIT;
