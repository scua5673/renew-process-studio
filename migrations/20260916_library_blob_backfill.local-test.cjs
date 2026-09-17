const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-sql-runtime/node_modules/@electric-sql/pglite');

const dir=__dirname;
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const preflight=read('20260916_library_blob_backfill.preflight.sql');
const migration=read('20260916_library_blob_backfill.sql');

function uuid(n){return `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;}
function media(seed,n=900){return `<svg viewBox="0 0 10 10"><image href="data:image/png;base64,${seed.repeat(n)}"/></svg>`;}

async function setup(){
  const db=new PGlite();
  await db.exec(`
    CREATE FUNCTION public.digest(p_value bytea,p_algo text) RETURNS bytea
    LANGUAGE sql IMMUTABLE AS $$
      SELECT decode(md5(p_value::text)||md5(p_value::text),'hex')
    $$;
    CREATE TABLE public.ps_library(
      workspace_id uuid NOT NULL,
      lib_id text NOT NULL,
      type text,
      name text,
      folder text,
      tags jsonb,
      pin boolean,
      item jsonb,
      saved_at bigint,
      deleted_at bigint,
      owner_id uuid,
      private boolean,
      PRIMARY KEY(workspace_id,lib_id)
    );
    CREATE TABLE public.ps_blob(
      workspace_id uuid NOT NULL,
      h text NOT NULL,
      v text NOT NULL,
      PRIMARY KEY(workspace_id,h)
    );
  `);
  const item={
    libId:'fixture-card',
    type:'board',
    name:'Fixture',
    board:{thumb:media('A'),frames:[{svg:media('B')},{note:'small'}]},
    direct:'data:image/png;base64,'+'C'.repeat(700),
    keep:'plain text'
  };
  await db.query(
    'INSERT INTO public.ps_library(workspace_id,lib_id,type,name,item,saved_at,deleted_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)',
    [uuid(1),'fixture-card','board','Fixture',JSON.stringify(item),1,0]
  );
  await db.query(
    'INSERT INTO public.ps_library(workspace_id,lib_id,type,name,item,saved_at,deleted_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)',
    [uuid(1),'small-card','board','Small',JSON.stringify({name:'Small',thumb:'data:image/png;base64,short'}),2,0]
  );
  return db;
}

(async()=>{
  const forbidden=/\b(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i;
  const body=preflight.replace(/--.*$/mg,'');
  assert.equal(forbidden.test(body),false,'preflight must remain read-only DDL/DML-free');

  const db=await setup();
  const pre=await db.exec(preflight);
  const estimate=pre.find(r=>r&&r.rows&&r.rows[0]&&r.rows[0].estimate)?.rows[0].estimate;
  assert.ok(estimate,'preflight returns estimate');
  assert.equal(estimate.candidate_rows,2);
  assert.equal(estimate.matched_images,3);
  assert.ok(estimate.matched_image_chars>2500);

  const before=(await db.query('SELECT item FROM public.ps_library WHERE lib_id=$1',['fixture-card'])).rows[0].item;
  assert.match(JSON.stringify(before),/data:image/);

  const applied=await db.exec(migration);
  const result=applied.find(r=>r&&r.rows&&r.rows[0]&&r.rows[0].library_blob_backfill_result)?.rows[0].library_blob_backfill_result;
  assert.ok(result,'migration returns result');
  assert.equal(result.changed_rows,1);
  assert.equal(result.stored_blobs,3);

  const after=(await db.query('SELECT item FROM public.ps_library WHERE lib_id=$1',['fixture-card'])).rows[0].item;
  const raw=JSON.stringify(after);
  assert.doesNotMatch(raw,/data:image/);
  assert.match(raw,/psblob:/);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.ps_blob')).rows[0].n,3);

  const again=await db.exec(migration);
  const againResult=again.find(r=>r&&r.rows&&r.rows[0]&&r.rows[0].library_blob_backfill_result)?.rows[0].library_blob_backfill_result;
  assert.equal(againResult.changed_rows,0,'migration is idempotent after first run');

  console.log('library blob backfill local SQL checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
