'use strict';
// Synthetic database archive only. This runner has no connection-string argument.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',PA='10000000-0000-4000-8000-000000000010',PB='10000000-0000-4000-8000-000000000011';
const data=db=>db.query('SELECT workspace_id::text,k,v,cupd FROM ps_kv ORDER BY workspace_id,k').then(r=>r.rows);
const security=db=>db.query("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies ORDER BY schemaname,tablename,policyname").then(r=>r.rows);
async function asUser(db,uid,sql,params=[]){await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);await db.exec('SET LOCAL ROLE authenticated');const r=await db.query(sql,params);await db.exec('COMMIT');return r.rows;}catch(e){await db.exec('ROLLBACK');throw e;}}
(async()=>{let db=new PGlite(),restored;
 try{
  await db.exec(read('20260913_scout_write_scope.local-fixture.sql'));
  await db.exec('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;');
  await db.exec(read('20260915_private_board.local-fixture.sql'));
  await db.exec(read('20260915_private_board.sql'));
  for(const [uid,wid] of [[A,PA],[B,PB]]){
   await db.query("INSERT INTO ps_workspaces(id,name,kind,owner_id) VALUES($1,'Synthetic restore fixture','personal',$2)",[wid,uid]);
   for(const member of [A,B])await db.query("INSERT INTO ps_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[wid,member]);
   await db.query("INSERT INTO ps_kv(workspace_id,k,v,cupd) VALUES($1,'cs_private_board_v1',$2,123)",[wid,JSON.stringify({snap:{players:[{id:uid,name:'가상 선수',x:123,y:456}]},pages:[{name:'복원 장면'}]})]);
  }
  const before=await data(db),policies=await security(db);
  const archive=await db.dumpDataDir('gzip'),bytes=Buffer.from(await archive.arrayBuffer());
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');assert.ok(bytes.length>0);
  await db.close();db=null;
  restored=new PGlite({loadDataDir:new Blob([bytes])});
  assert.deepEqual(await data(restored),before,'all document bytes and revision values survive a fresh database restore');
  assert.deepEqual(await security(restored),policies,'row-level policies survive restore');
  await restored.exec(read('20260915_private_board.verify.sql'));
  for(const [uid,wid,other] of [[A,PA,PB],[B,PB,PA]]){
   assert.deepEqual((await asUser(restored,uid,"SELECT workspace_id::text FROM ps_kv WHERE k='cs_private_board_v1'")).map(r=>r.workspace_id),[wid]);
   assert.deepEqual(await asUser(restored,uid,"UPDATE ps_kv SET v='{}' WHERE workspace_id=$1 RETURNING k",[other]),[],'cross-owner writes remain denied after restore');
  }
  assert.deepEqual(await data(restored),before,'denied writes never modify restored documents');
  console.log(JSON.stringify({passed:true,scope:'synthetic PGlite archive; not a production backup restore',archiveBytes:bytes.length,sha256:digest,cases:['fresh-instance-restore','exact-records-and-revisions','policy-catalog','migration-verifier','owner-read','cross-owner-write-denial']}));
 }finally{if(db)await db.close();if(restored)await restored.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
