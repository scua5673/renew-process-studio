'use strict';
// SQL contracts run only in test:sql, after npm ci. Unit tests require no packages.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const KEY='process_coach_v1',W='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222';
test('actual schedule SQL guards preserve exact accepted CAS bytes; rejected/noop versions cannot impersonate acceptance',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),sql=fs.readFileSync(path.join(__dirname,'../../migrations/00000000_baseline.sql'),'utf8'),db=new PGlite();
 const fn=name=>{const a=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'('),b=sql.indexOf('$function$;',a);assert.ok(a>0&&b>a,name);return sql.slice(a,b+'$function$;'.length);};
 try{
  await db.exec(`set check_function_bodies=off;create schema auth;create function auth.uid() returns uuid language sql as $$select '${A}'::uuid$$;create function auth.role() returns text language sql as $$select 'authenticated'::text$$;
   create table ps_workspaces(id uuid primary key,owner_id uuid);create table ps_guard_mode(id int,enforce boolean);insert into ps_guard_mode values(1,true);
   create table ps_app_policy(id int,min_build text,note text,block_unversioned boolean);create table ps_kv(workspace_id uuid,k text,v text,cupd bigint,updated_at timestamptz,updated_by uuid,primary key(workspace_id,k));
   create function public.ps_kv_note_denied(uuid,uuid,text,text) returns void language sql as $$select$$;insert into ps_workspaces values('${W}','${A}');`);
  for(const name of ['ps_1644_json_truthy','ps_1644_schedule_structure_ok','ps_1644_lineage_guard','ps_kv_build_guard','ps_kv_shape_guard','ps_kv_noop_guard','ps_kv_team_guard','ps_touch','ps_kv_stamp_who'])await db.exec(fn(name));
  for(const name of ['ps_00_lineage_guard_1644_t','ps_00a_build_guard_t','ps_00b_shape_guard_t','ps_00c_noop_guard_t','ps_kv_team_guard_insert_t','ps_kv_team_guard_t','ps_kv_touch','ps_kv_who_t']){const line=sql.split('\n').find(l=>l.startsWith('CREATE TRIGGER '+name+' '));assert.ok(line,name);await db.exec(line);}
  const doc=(rev,extra={})=>({anchorMonday:'2026-10-26',weeks:{0:Array.from({length:7},()=>({}))},scheduleRev:rev,scheduleBaseRev:rev-1,scheduleToken:'synthetic-schedule-token-'+rev,scheduleBaseToken:rev===1?'':'synthetic-schedule-token-'+(rev-1),editedAt:100+rev,note:'exact bytes — spaces preserved',...extra});
  const first=JSON.stringify(doc(1)),next=JSON.stringify(doc(2),null,1);
  await db.query('insert into ps_kv(workspace_id,k,v,cupd) values($1,$2,$3,7)',[W,KEY,first]);
  const accepted=await db.query('update ps_kv set v=$1,cupd=8 where workspace_id=$2 and k=$3 and cupd=7 returning workspace_id,k,cupd',[next,W,KEY]);assert.equal(accepted.rows.length,1);assert.equal(Number(accepted.rows[0].cupd),8);assert.equal((await db.query('select v from ps_kv')).rows[0].v,next,'accepted text is byte-exact, not normalized JSON');
  const stale=await db.query('update ps_kv set v=$1,cupd=9 where workspace_id=$2 and k=$3 and cupd=7 returning cupd',[JSON.stringify(doc(3)),W,KEY]);assert.equal(stale.rows.length,0);
  const denied=await db.query('update ps_kv set v=$1,cupd=9 where workspace_id=$2 and k=$3 and cupd=8 returning cupd',[first,W,KEY]);assert.equal(denied.rows.length,0,'invalid lineage cannot return the requested newer version');
  const noop=await db.query('update ps_kv set v=$1,cupd=9 where workspace_id=$2 and k=$3 and cupd=8 returning cupd',[next,W,KEY]);assert.equal(Number(noop.rows[0].cupd),8,'no-op keeps the older version');
  const stored=(await db.query('select v,cupd from ps_kv')).rows[0];assert.equal(stored.v,next);assert.equal(Number(stored.cupd),8);
 }finally{await db.close();}
});
