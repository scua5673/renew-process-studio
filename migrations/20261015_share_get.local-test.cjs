/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261015_share_get.local-test.cjs
 * 20261015_share_get: 익명은 공유본을 통째로 나열하지 못하고, 아는 id 한 건만 RPC 로 받는다. 올리기(INSERT)는 그대로.
 * 픽스처는 «익명 SELECT 가 열린» 지금 운영 모양을 흉내 낸다(정확한 운영 정책은 저장소에 없다 — 런북에서 확인).
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const sql=read('20261015_share_get.sql'),verify=read('20261015_share_get.verify.sql'),rollback=read('20261015_share_get.rollback.sql');
const FIXTURE=`
create role anon nologin; create role authenticated nologin;
create table public.ps_share(id text primary key, v text not null, kind text, created_at timestamptz default now());
alter table public.ps_share enable row level security;
create policy share_read on public.ps_share for select to anon, authenticated using (true);
create policy share_write on public.ps_share for insert to anon, authenticated with check (true);
grant select, insert on public.ps_share to anon, authenticated;
grant usage on schema public to anon, authenticated;
`;
let passed=0;const equal=(a,b,l)=>{assert.deepEqual(a,b,l);passed++;};
async function as(db,role,fn){await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE '+role);return await fn();}finally{await db.exec('ROLLBACK');}}
const list=(db,role)=>as(db,role,async()=>{try{return (await db.query('SELECT id FROM public.ps_share ORDER BY id')).rows.map(r=>r.id);}catch(e){return 'denied:'+e.code;}});
const get=(db,role,id)=>as(db,role,async()=>(await db.query('SELECT public.ps_share_get($1) AS v',[id])).rows[0].v);
const insertThenGet=(db,role,id)=>as(db,role,async()=>{await db.query("INSERT INTO public.ps_share(id,v,kind) VALUES($1,'z','board')",[id]);return (await db.query('SELECT public.ps_share_get($1) AS v',[id])).rows[0].v;});
async function run(){
  const db=new PGlite();
  try{
    await db.exec(FIXTURE);
    await db.query("INSERT INTO public.ps_share(id,v,kind) VALUES('abc12345','payload-a','board'),('teamroster','payload-team','team'),('zz999999','payload-z','drill')");
    equal(await list(db,'anon'),['abc12345','teamroster','zz999999'],'before: anon lists every shared item');
    await db.exec(sql);await db.exec(sql);   // 두 번 실행해도 안전
    const vr=await db.exec(verify);equal(vr[vr.length-1].rows[0].result,'share_get_verified','verify passes');
    equal(await list(db,'anon'),'denied:42501','after: anon cannot list the table');
    equal(await list(db,'authenticated'),'denied:42501','after: signed-in users cannot list it either');
    equal(await get(db,'anon','abc12345'),'payload-a','a known id still opens');
    equal(await get(db,'authenticated','zz999999'),'payload-z','signed-in users open links too');
    equal(await get(db,'anon','nope0000'),null,'unknown id → null');
    for(const bad of ["abc' or '1'='1",'ABC12345','a','%','abc12345;drop',null])equal(await get(db,'anon',bad),null,'malformed id rejected: '+bad);
    equal(await insertThenGet(db,'anon','new00001'),'z','uploading a share still works without SELECT, and the new link opens');
    await db.exec(rollback);await db.exec(rollback);
    equal((await db.query("SELECT to_regprocedure('public.ps_share_get(text)') IS NULL AS gone")).rows[0].gone,true,'rollback drops the function');
    equal((await list(db,'anon')).length,3,'rollback gives anon SELECT back');
  }finally{await db.close();}
  console.log('20261015_share_get local test: '+passed+' checks passed');
}
run().catch(e=>{console.error(e);process.exit(1);});
