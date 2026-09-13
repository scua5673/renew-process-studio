/* Synthetic PostgreSQL tests; no network or real accounts/database are used.
 * Run with bundled Node after installing @electric-sql/pglite outside the repo:
 *   PGLITE_MODULE=/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite node migrations/20260913_scout_registry_guard.local-test.cjs
 * Or supply the equivalent absolute installed module path. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const S = require('../studio/scouting-store.js');
const migration = fs.readFileSync(path.join(__dirname, '20260913_scout_registry_guard.sql'), 'utf8');
const verification = fs.readFileSync(path.join(__dirname, '20260913_scout_registry_guard.verify.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, '20260913_scout_registry_guard.rollback.sql'), 'utf8');
const KEY = S.KEY;
let passed = 0, sequence = 100;
const stamp = () => ({at: ++sequence, id: 'synthetic-' + sequence});
const copy = S.copy;
function fixture() {
  let doc = S.reconcile(null, {v:1, players:[{
    id:'fixture-placement', dbId:'fixture-source', type:'target', name:'Synthetic',
    posId:'fixture-position', sbSeat:0, memo:'Original observation', levels:{tech:2},
    profile:{photo:'data:image/png;base64,SYNTHETIC', nat:'KR'}
  }]});
  S.importLegacy(doc, {players:[{
    id:'fixture-source', nameKr:'Synthetic', club:'Fixture club', nat:'KR',
    photo:'data:image/png;base64,SYNTHETIC', oneliner:'Original source',
    obs:[{text:'first'}, {text:'second'}], contacts:[{name:'Synthetic contact'}],
    points:{question:3}, ratings:{technical:2}
  }], meta:{pointSets:[{id:'fixture-set', name:'Synthetic questions', sections:[{name:'Section',qs:['Question']}]}]}}, ['fixture-source'], true);
  doc = S.reconcile(null, doc);
  assert.equal(S.valid(doc), true);
  return doc;
}
const CID = 'db:fixture-source';
function change(base, edit) {
  const next = copy(base); edit(next);
  const merged = S.reconcile(base, copy(next));
  assert.equal(S.valid(merged), true);
  return merged;
}
async function run() {
  for (const column of ['text', 'jsonb']) {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE public.ps_kv (workspace_id text, k text PRIMARY KEY, v ${column}, cupd bigint);
        ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
        CREATE ROLE fixture_writer;
        GRANT USAGE ON SCHEMA public TO fixture_writer;
        GRANT SELECT, INSERT, UPDATE ON public.ps_kv TO fixture_writer;
        ALTER TABLE public.ps_kv ENABLE ROW LEVEL SECURITY;
        CREATE POLICY fixture_scope ON public.ps_kv TO fixture_writer
          USING (workspace_id = 'synthetic-team') WITH CHECK (workspace_id = 'synthetic-team');
        CREATE FUNCTION public.fixture_before() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN NEW.cupd := coalesce(NEW.cupd, 0) + 1; RETURN NEW; END $$;
        CREATE TRIGGER a_fixture_before BEFORE UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.fixture_before();`);
      const catalog = async () => (await db.query(`SELECT relrowsecurity, relforcerowsecurity, relacl::text,
        (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='ps_kv') AS policies
        FROM pg_class WHERE oid='public.ps_kv'::regclass`)).rows[0];
      const beforePolicy = await catalog();
      await db.exec(migration);
      await db.exec(migration); // Same marked revision is repeatable.
      assert.deepEqual(await catalog(), beforePolicy, 'RLS and table grants remain exact'); passed++;
      await db.exec(verification); passed++;
      const base = fixture();
      async function decision(oldDoc, newDoc) {
        return (await db.query('SELECT public.ps_scout_registry_guard_v1_reason($1::jsonb,$2::jsonb) AS reason',
          [JSON.stringify(oldDoc),JSON.stringify(newDoc)])).rows[0].reason;
      }
      async function allowed(name, next, prior=base) {
        assert.equal(await decision(prior,next), null, column + ': ' + name); passed++;
      }
      async function rejected(name, next, prior=base) {
        assert.notEqual(await decision(prior,next), null, column + ': ' + name); passed++;
      }
      await allowed('unchanged actual helper output', base);
      await allowed('first profile field', change(base,d=>S.edit(d,CID,'profile.height','178',stamp())));
      await allowed('canonical photo deletion with exact prior photo variant', change(base,d=>S.edit(d,CID,'profile.photo',undefined,stamp())));
      await allowed('canonical photo replacement', change(base,d=>S.edit(d,CID,'profile.photo','synthetic-new-photo',stamp())));
      await allowed('basic canonical edit', change(base,d=>S.edit(d,CID,'club','New club',stamp())));
      await allowed('point score edit', change(base,d=>S.score(d,CID,'question',5,stamp())));
      await allowed('score zero', change(base,d=>S.score(d,CID,'question',0,stamp())));
      await allowed('rating edit via real reconcile', change(base,d=>{
        const c=d.scoutRegistry.candidates[CID]; c.ratings.technical=4; c.edits['ratings.technical']=stamp();
      }));
      await allowed('source edit and canonical photo deduplication', change(base,d=>{
        const c=d.scoutRegistry.candidates[CID]; c.source.oneliner='Changed';
        for(const key of ['photo','points','ratings','nameKr','club','nat']) delete c.source[key];
        c.sourceEdit=stamp();
      }));
      let boardOnly=S.reconcile(null,{v:1,players:[{id:'board-only',type:'target',name:'Synthetic new candidate'}]});
      await allowed('first source on board-only candidate',change(boardOnly,d=>{
        d.scoutRegistry.candidates['target:board-only'].source={obs:[{text:'First'}]};
        d.scoutRegistry.candidates['target:board-only'].sourceEdit=stamp();
      }),boardOnly);
      const emptyLegacy=S.reconcile(null,{v:1,players:[]});
      S.importLegacy(emptyLegacy,{players:[{id:'empty-source',nameKr:'Synthetic',club:''}]},['empty-source'],false);
      const filledLegacy=copy(emptyLegacy);
      S.importLegacy(filledLegacy,{players:[{id:'empty-source',nameKr:'Synthetic',club:'New club'}]},['empty-source'],false);
      await allowed('same-ID legacy import fills unedited empty canonical value',S.reconcile(emptyLegacy,filledLegacy),emptyLegacy);
      for(const optional of [null,false,0,'']){
        const optionalMeta=copy(base);optionalMeta.scoutRegistry.meta.pointSets=optional;
        assert.equal(S.valid(optionalMeta),true);
        await allowed('helper-supported empty pointSets '+JSON.stringify(optional),S.reconcile(optionalMeta,optionalMeta),optionalMeta);
      }
      const nullVersion=copy(base);nullVersion.v=null;
      await allowed('helper-supported null document version',S.reconcile(nullVersion,nullVersion),nullVersion);
      await allowed('question set replacement', change(base,d=>{
        d.scoutRegistry.meta.pointSets=[{id:'new-set',sections:[{qs:['New question']}]}]; d.scoutRegistry.metaEdit=stamp();
      }));
      await allowed('question set removal with old metadata retained', change(base,d=>{
        d.scoutRegistry.meta.pointSets=[]; d.scoutRegistry.metaEdit=stamp();
      }));
      await allowed('placement observation edit', change(base,d=>{d.players[0].memo='Changed observation';d.players[0].levels.tech=4;}));
      await allowed('unplace', change(base,d=>{d.players[0].posId='';d.players[0].sbSeat=null;d.players[0]._scoutMove=stamp();}));
      const archived=change(base,d=>S.archive(d,CID,123,stamp()));
      await allowed('archive', archived);
      await allowed('restore', change(archived,d=>S.archive(d,CID,0,stamp())),archived);
      const incoming={v:1,players:copy(base.players)};incoming.players[0].memo='Old client changed observation';
      await allowed('new sync reconciles old-client document',S.reconcile(base,incoming));
      await allowed('new sync preserves old-client removed placement',S.reconcile(base,{v:1,players:[]}));
      const branchA=change(base,d=>d.players.push({id:'branch-a',type:'target',name:'Synthetic A',posId:'fixture-position'}));
      const branchB=change(base,d=>d.players.push({id:'branch-b',type:'target',name:'Synthetic B',posId:'fixture-position'}));
      const joinedBranches=S.reconcile(branchA,branchB);
      assert.equal(joinedBranches.players.find(p=>p.id==='branch-a')._scoutHidden,undefined);
      assert.equal(joinedBranches.players.find(p=>p.id==='branch-b')._scoutHidden,undefined);
      await allowed('simultaneous new-registry placement union from A',joinedBranches,branchA);
      await allowed('simultaneous new-registry placement union from B',joinedBranches,branchB);
      await allowed('simultaneous source edits preserve both originals',S.reconcile(
        change(base,d=>{d.scoutRegistry.candidates[CID].source.obs=[{text:'A'}];d.scoutRegistry.candidates[CID].sourceEdit=stamp();}),
        change(base,d=>{d.scoutRegistry.candidates[CID].source.obs=[{text:'B'}];d.scoutRegistry.candidates[CID].sourceEdit=stamp();})
      ));
      await rejected('players-only direct old-client overwrite', {v:1,players:copy(base.players)});
      const mutants={
        'registry null':d=>{d.scoutRegistry=null;},
        'candidate dropped':d=>{delete d.scoutRegistry.candidates[CID];},
        'candidate info dropped':d=>{delete d.scoutRegistry.candidates[CID].info;},
        'photo silently lost':d=>{delete d.scoutRegistry.candidates[CID].info.profile.photo;},
        'source silently lost':d=>{delete d.scoutRegistry.candidates[CID].source;},
        'source reordered inside history':d=>{const c=d.scoutRegistry.candidates[CID];c.sourceHistory=[copy(c.source)];c.sourceHistory[0].obs.reverse();c.source={};},
        'score silently lost':d=>{delete d.scoutRegistry.candidates[CID].points.question;},
        'question set silently lost':d=>{d.scoutRegistry.meta.pointSets=[];d.scoutRegistry.metaHistory=[];},
        'metadata history lost':d=>{d.scoutRegistry.metaHistory=[];},
        'placement observation lost':d=>{delete d.players[0].memo;},
        'placement row lost':d=>{d.players=[];}
      };
      for(const [name, edit] of Object.entries(mutants)){const next=copy(base);edit(next);await rejected(name,next);}
      const histories=change(base,d=>{S.edit(d,CID,'club','Another club',stamp());S.score(d,CID,'question',1,stamp());
        d.players[0].memo='Another observation';d.scoutRegistry.candidates[CID].source={oneliner:'Another source'};d.scoutRegistry.candidates[CID].sourceEdit=stamp();});
      for(const family of ['variants','sourceHistory','scoreHistory']){
        const next=copy(histories);next.scoutRegistry.candidates[CID][family]=[];await rejected(family+' removed',next,histories);
      }
      const missingPlacementHistory=copy(histories);missingPlacementHistory.scoutRegistry.placementHistory={};
      await rejected('placement history removed',missingPlacementHistory,histories);

      // Exercise the real row trigger under an existing RLS writer, including
      // old upsert (INSERT ON CONFLICT UPDATE) and preservation after failure.
      await db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES ($1,$2,$3,1)', ['synthetic-team',KEY,JSON.stringify(base)]);
      await db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES ($1,$2,$3,1)', ['other-team','other-team-key','{}']);
      await db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES ($1,$2,$3,1)', ['synthetic-team','unrelated-diary','{}']);
      await db.exec('SET ROLE fixture_writer');
      const lose=JSON.stringify({v:1,players:[]});
      await assert.rejects(db.query('UPDATE public.ps_kv SET v=$1 WHERE k=$2',[lose,KEY]),e=>e.code==='23514');passed++;
      await assert.rejects(db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES ($1,$2,$3,2) ON CONFLICT(k) DO UPDATE SET v=excluded.v',
        ['synthetic-team',KEY,lose]),e=>e.code==='23514');passed++;
      await assert.rejects(db.query(`INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES ($1,$2,$3,2),($1,$4,$5,2)
        ON CONFLICT(k) DO UPDATE SET v=excluded.v`,['synthetic-team','unrelated-diary','{"updated":true}',KEY,lose]),e=>e.code==='23514');passed++;
      // Mixed statements roll back atomically, including unrelated rows. A
      // separate other-key write still succeeds without changing its policies.
      const diaryBefore=(await db.query("SELECT v FROM public.ps_kv WHERE k='unrelated-diary'")).rows[0].v;
      assert.deepEqual(typeof diaryBefore==='string'?JSON.parse(diaryBefore):diaryBefore,{});passed++;
      await db.query("UPDATE public.ps_kv SET v=$1 WHERE k='unrelated-diary'",['{"updated":true}']);passed++;
      const stored=(await db.query('SELECT v FROM public.ps_kv WHERE k=$1',[KEY])).rows[0].v;
      assert.deepEqual(typeof stored==='string'?JSON.parse(stored):stored,base);passed++;
      await db.query('UPDATE public.ps_kv SET v=$1 WHERE k=$2',[JSON.stringify(change(base,d=>S.score(d,CID,'question',4,stamp()))),KEY]);passed++;
      assert.equal((await db.query("UPDATE public.ps_kv SET v='{}' WHERE k='other-team-key' RETURNING k")).rows.length,0);passed++;
      await db.exec('RESET ROLE');
      assert.deepEqual(await catalog(),beforePolicy);passed++;
      // Unknown later triggers are never silently reordered or replaced.
      await db.exec('CREATE TRIGGER zzzzz_fixture_later BEFORE UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.fixture_before()');
      await assert.rejects(db.exec(verification),e=>String(e.message).includes('later BEFORE UPDATE trigger'));passed++;
      await db.exec('ROLLBACK');
      await assert.rejects(db.exec(migration),e=>String(e.message).includes('later BEFORE UPDATE trigger'));passed++;
      await db.exec('ROLLBACK');
      await db.exec('DROP TRIGGER zzzzz_fixture_later ON public.ps_kv');
      await db.exec(verification);
      await db.exec(rollback);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='public.ps_kv'::regclass AND tgname='zzzz_ps_scout_registry_guard_v1'")).rows[0].n,0);passed++;
      assert.deepEqual(await catalog(),beforePolicy);passed++;
      await db.query('UPDATE public.ps_kv SET v=$1 WHERE k=$2',[lose,KEY]);passed++;
      await db.exec(rollback); // Marked migration rollback is repeatable.
      console.log(column+': real helper outputs, downgrade rejection, RLS invariance, upsert, verify and rollback passed');
    } finally { await db.close(); }
  }
  for(const failure of ['unsupported-schema','reserved-trigger']){
    const db=new PGlite();
    try{
      await db.exec('CREATE TABLE public.ps_kv(k text PRIMARY KEY,v '+(failure==='unsupported-schema'?'integer':'text')+')');
      if(failure==='reserved-trigger')await db.exec(`CREATE FUNCTION public.fixture_other() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
        CREATE TRIGGER zzzz_ps_scout_registry_guard_v1 BEFORE INSERT ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.fixture_other()`);
      await assert.rejects(db.exec(migration),e=>String(e.message).includes(failure==='unsupported-schema'?'expected k text/varchar':'reserved trigger name'));passed++;
      await db.exec('ROLLBACK');
      assert.equal((await db.query("SELECT to_regprocedure('public.ps_scout_registry_guard_v1()') AS f")).rows[0].f,null);passed++;
      if(failure==='reserved-trigger'){
        assert.equal((await db.query("SELECT tgfoid::regprocedure::text AS f FROM pg_trigger WHERE tgname='zzzz_ps_scout_registry_guard_v1'")).rows[0].f,'fixture_other()');passed++;
      }
    }finally{await db.close();}
  }
  console.log('PASS '+passed+' assertions; synthetic in-memory PostgreSQL only');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
