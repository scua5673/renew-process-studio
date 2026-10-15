/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261015_player_daily_blind.local-test.cjs
 * 20261015_player_daily_blind(선수에게 cs_idp_daily_v1·cs_idp_pub_v1 을 내려 주지 않음)를 20260930 운영 함수 원문 픽스처 위에서
 * 실제 authenticated 역할·JWT 문맥으로 시험한다. 적용 전엔 선수가 팀원의 몸 상태를 읽고, 적용 뒤엔 못 읽으며, 코칭스태프·임원·소유자는 그대로다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const fixture=read('20260930_role_alignment.local-fixture.sql');
const sql=read('20261015_player_daily_blind.sql'),verify=read('20261015_player_daily_blind.verify.sql'),rollback=read('20261015_player_daily_blind.rollback.sql');
const W='00000000-0000-4000-8000-000000000201';
const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const who={owner:U(1),exec:U(2),staff:U(3),player:U(5),player2:U(6),outsider:U(9)};
const FN='public.ps_can_read_key(uuid,text)';
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
async function seed(db){
  await db.query('INSERT INTO public.ps_workspaces(id,name,owner_id,kind) VALUES($1,$2,$3,$4)',[W,'Synthetic team',who.owner,'team']);
  for(const [u,r] of [[who.owner,'owner'],[who.exec],[who.staff],[who.player],[who.player2]])await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[W,u,r||'member']);
  const perms={v:1,members:{[who.exec]:{role:'executive'},[who.staff]:{role:'staff'},[who.player]:{role:'player'},[who.player2]:{role:'player'}}};
  const daily={v:1,days:{'2026-10-14':{[who.player2]:{status:'injury',at:1,by:who.exec},[who.player]:{status:'rest',at:2,by:who.exec}},'2026-10-15':{[who.player2]:{status:'rehab',at:3,by:who.exec}},_bad:'x'}};
  const kv=[['cs_perms_v1',JSON.stringify(perms)],['cs_idp_daily_v1',JSON.stringify(daily)],['cs_idp_pub_v1','{"items":{}}'],
    ['cs_team_notice_v1','{"notices":[]}'],['cs_team_matches_v1','{"matches":[]}'],['scout_tool_v1','{"players":[]}']];
  for(const [k,v] of kv)await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[W,k,v]);
}
async function as(db,uid,fn){
  await db.exec('BEGIN');
  try{
    const claims=JSON.stringify({sub:uid,role:'authenticated'});
    for(const [k,v] of Object.entries({'request.jwt.claims':claims,'request.jwt.claim':claims,'request.jwt.claim.sub':uid,'request.jwt.claim.role':'authenticated'}))await db.query('SELECT set_config($1,$2,true)',[k,v]);
    await db.exec('SET LOCAL ROLE authenticated');
    const a=(await db.query("SELECT current_user AS u, auth.uid()::text AS sub, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass")).rows[0];
    assert.deepEqual(a,{u:'authenticated',sub:uid,bypass:false},'real authenticated actor');
    return await fn();
  }finally{await db.exec('ROLLBACK');}
}
const sees=(db,uid,k)=>as(db,uid,async()=>(await db.query('SELECT count(*)::int n FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[W,k])).rows[0].n===1);
const canRead=(db,uid,k)=>as(db,uid,async()=>(await db.query('SELECT public.ps_can_read_key($1,$2) AS r',[W,k])).rows[0].r);
const def=async db=>(await db.query('SELECT pg_get_functiondef(to_regprocedure($1)) d',[FN])).rows[0].d;
const meta=async db=>(await db.query("SELECT p.proacl::text a, p.prosecdef s, p.proowner o, p.proconfig::text c, p.provolatile v FROM pg_proc p WHERE p.oid=to_regprocedure($1)",[FN])).rows[0];
const mine=(db,uid)=>as(db,uid,async()=>(await db.query('SELECT public.ps_idp_daily_mine($1) AS r',[W])).rows[0].r);
const others=async db=>(await db.query("SELECT p.proname, pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname<>'ps_can_read_key' ORDER BY 1")).rows;

async function run(){
  const db=new PGlite();
  try{
    await db.exec(fixture);await seed(db);
    const origDef=await def(db),origMeta=await meta(db),origOthers=await others(db);

    // ── 적용 전: 문제가 실제로 있다 ─────────────────────────────
    equal(await sees(db,who.player,'cs_idp_daily_v1'),true,'before: a player receives every teammate\'s daily injury/rehab status');
    equal(await sees(db,who.player,'cs_idp_pub_v1'),true,'before: a player receives the legacy public IDP key');
    equal(await sees(db,who.player,'scout_tool_v1'),false,'before: the roster is already hidden from players (existing list works)');

    // ── 적용(두 번 실행해도 안전) + 확인 ─────────────────────────
    await db.exec(sql);await db.exec(sql);
    const vr=await db.exec(verify);   // DO 블록 + SELECT 두 문장 — exec 의 마지막 결과가 SELECT
    equal(vr[vr.length-1].rows[0].result,'player_daily_blind_verified','verify passes');
    equal((await def(db)).match(/ps-20261015-player-daily-blind/g).length,1,'one marker in the live definition');

    // ── 적용 뒤: 선수는 못 보고, 코칭스태프·임원·소유자는 그대로 ──
    equal(await sees(db,who.player,'cs_idp_daily_v1'),false,'after: a player no longer receives teammates\' daily status');
    equal(await canRead(db,who.player,'cs_idp_daily_v1'),false,'after: ps_can_read_key says no for the player');
    equal(await sees(db,who.player,'cs_idp_pub_v1'),false,'after: the legacy public IDP key is hidden from players');
    equal(await sees(db,who.player,'cs_team_notice_v1'),true,'after: team notices still reach players');
    equal(await sees(db,who.player,'cs_team_matches_v1'),true,'after: team matches still reach players (unchanged by design)');
    equal(await sees(db,who.staff,'cs_idp_daily_v1'),true,'after: staff still reads daily status');
    equal(await sees(db,who.exec,'cs_idp_daily_v1'),true,'after: executives still read daily status');
    equal(await sees(db,who.owner,'cs_idp_daily_v1'),true,'after: the owner still reads daily status');
    equal(await sees(db,who.outsider,'cs_idp_daily_v1'),false,'after: a non-member still sees nothing');

    // ── 선수 본인 칸만: ps_idp_daily_mine ─────────────────────────
    equal(await mine(db,who.player),{v:1,days:{'2026-10-14':{[who.player]:{status:'rest',at:2,by:who.exec}}}},'a player gets only their own coach-confirmed status');
    equal(await mine(db,who.player2),{v:1,days:{'2026-10-14':{[who.player2]:{status:'injury',at:1,by:who.exec}},'2026-10-15':{[who.player2]:{status:'rehab',at:3,by:who.exec}}}},'each player sees every day of their own');
    equal(await mine(db,who.outsider),null,'a non-member gets nothing');
    equal(await mine(db,who.staff),{v:1,days:{}},'staff have no own rows (they read the full key instead)');
    equal((await db.query("SELECT has_function_privilege('public','public.ps_idp_daily_mine(uuid)','EXECUTE') AS p")).rows[0].p,false,'PUBLIC cannot execute ps_idp_daily_mine');

    // ── 함수의 나머지와 다른 함수는 바이트 그대로 ──────────────────
    equal(await meta(db),origMeta,'ACL, SECURITY DEFINER, owner, search_path and volatility unchanged');
    equal((await others(db)).filter(r=>r.proname!=='ps_idp_daily_mine'),origOthers,'no other existing function changed');
    equal((await def(db)).replace(/,'cs_idp_daily_v1','cs_idp_pub_v1' \/\* ps-20261015-player-daily-blind \*\//,''),origDef,'only the list grew');

    // ── 되돌리기: 원문 그대로 ─────────────────────────────────────
    await db.exec(rollback);await db.exec(rollback);   // 두 번 실행해도 안전
    equal(await def(db),origDef,'rollback restores the exact original definition');
    equal((await db.query("SELECT to_regprocedure('public.ps_idp_daily_mine(uuid)') IS NULL AS gone")).rows[0].gone,true,'rollback drops ps_idp_daily_mine');
    equal(await sees(db,who.player,'cs_idp_daily_v1'),true,'rollback: player reads daily status again');
    await db.exec(sql);
    equal(await sees(db,who.player,'cs_idp_daily_v1'),false,'re-apply after rollback works');

    // ── 정의가 예상과 다르면 아무것도 바꾸지 않는다 ───────────────
    const other=new PGlite();
    try{
      await other.exec(fixture);await seed(other);
      await other.exec(`CREATE OR REPLACE FUNCTION public.ps_can_read_key(wid uuid,key text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
BEGIN RETURN public.ps_is_member(wid); END $$;`);
      const custom=await def(other);
      let failed=false;try{await other.exec(sql);}catch(e){failed=/차단목록이 예상과 다릅니다/.test(String(e.message));}
      await other.exec('ROLLBACK');   // exec 는 오류에서 멈춰 BEGIN 이 열린 채 남는다 — 운영 SQL 편집기도 같은 상태(아무것도 바뀌지 않음)
      equal(failed,true,'an unexpected definition stops the migration');
      equal(await def(other),custom,'and leaves the function untouched');
    }finally{await other.close();}
  }finally{await db.close();}
  console.log('20261015_player_daily_blind local test: '+passed+' checks passed');
}
run().catch(e=>{console.error(e);process.exit(1);});
