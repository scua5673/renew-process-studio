/* Local-only executable check of the prepared combined operational transaction.
 * No network/credentials. Does not recreate or claim to verify all live triggers.
 * Uses the reviewed non-IDP policy fixture, content guard and restrictive policy.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
async function main(){
  const db=new PGlite();
  try{
    await db.exec(read('20260913_scout_write_scope.local-fixture.sql'));
    await db.exec(read('20260913_scout_registry_guard.sql'));
    await db.exec(read('20260913_scout_write_scope.sql'));
    const wid=randomUUID(),uid=randomUUID();
    await db.query('INSERT INTO public.ps_workspaces(id,name,owner_id) VALUES($1,$2,$3)',[wid,'Synthetic untouched sentinel',uid]);
    await db.query("INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[wid,uid]);
    await db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,'cs_team_notice_v1',$2,17)",[wid,'{"synthetic":"untouched"}']);
    async function snapshot(){
      const out={};for(const table of ['ps_workspaces','ps_members','ps_kv']){
        out[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).rows;
      }return out;
    }
    const before=await snapshot();
    const response=await db.exec(read('20260913_scout_registry_guard.synthetic-verify.sql'));
    const results=response.flatMap(x=>x.rows||[]).map(row=>row.combined_guard_result).filter(Boolean);
    assert.equal(results.length,10,'five combined checks each for app admin and executive');
    for(const row of results){
      assert.equal(row.passed,true);assert.equal(row.candidateExact,true);assert.equal(row.otherKeyExact,true);
      if(['legacy_update','legacy_upsert','mixed_upsert'].includes(row.operation)){
        assert.equal(row.sqlstate,'23514');assert.match(row.guardReason,/^ps_scout_registry_guard_v1:/);
      }else assert.equal(row.sqlstate,null);
    }
    assert.deepEqual(await snapshot(),before,'all synthetic transaction rows rolled back; sentinel unchanged');
    console.log(JSON.stringify({ok:true,cases:results.length,roles:['admin','executive'],
      guard23514Cases:results.filter(r=>r.sqlstate==='23514').length,exactDocumentAndCupd:true,
      mixedStatementRollback:true,separateOtherKeyWrite:true,fullFixtureRollback:true,
      scope:'local in-memory PostgreSQL: policy fixture + content guard + write scope; no live-server execution'},null,2));
  }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
