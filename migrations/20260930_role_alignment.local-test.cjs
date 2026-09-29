/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20260930_role_alignment.local-test.cjs
 * 20260930_role_default_player(역할 기본값 = player) · 20260930_idp_pub_write(코치 피드백 쓰기 = IDP 열람 규칙)를
 * 격리된 메모리 DB 에서 실제 authenticated 역할·JWT 문맥으로 시험한다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,'20260930_'+name),'utf8');
const fixture=read('role_alignment.local-fixture.sql');
const roleSql=read('role_default_player.sql'),roleVerify=read('role_default_player.verify.sql'),roleRollback=read('role_default_player.rollback.sql');
const pubSql=read('idp_pub_write.sql'),pubVerify=read('idp_pub_write.verify.sql'),pubRollback=read('idp_pub_write.rollback.sql');
const W1='00000000-0000-4000-8000-000000000101';   // 권한표가 있는 팀
const W2='00000000-0000-4000-8000-000000000102';   // 권한표가 없는 팀
const W3='00000000-0000-4000-8000-000000000103';   // 개인 공간
const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const who={owner:U(1),exec:U(2),staffView:U(3),staffTeam:U(4),player:U(5),roleless:U(6),defaultStaff:U(7),owner2:U(8),member2:U(9),solo:U(10)};
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
async function seed(db){
  const ws=[[W1,'Synthetic team',who.owner,'team'],[W2,'Synthetic team without perms',who.owner2,'team'],[W3,'Synthetic personal',who.solo,'personal']];
  for(const [id,name,owner,kind] of ws)await db.query('INSERT INTO public.ps_workspaces(id,name,owner_id,kind) VALUES($1,$2,$3,$4)',[id,name,owner,kind]);
  const mem=[[W1,who.owner,'owner'],[W1,who.exec],[W1,who.staffView],[W1,who.staffTeam],[W1,who.player],[W1,who.roleless],[W2,who.owner2,'owner'],[W2,who.member2],[W3,who.solo,'owner']];
  for(const [w,u,r] of mem)await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[w,u,r||'member']);
  // 권한표 — roleless 는 항목이 없고, defaultRole 도 없다(앱: 선수 · 서버: 스태프였다)
  const perms={v:1,members:{[who.exec]:{role:'executive'},[who.staffView]:{role:'staff'},[who.staffTeam]:{role:'staff',scopes:['team']},[who.player]:{role:'player'}}};
  const kv=[[W1,'cs_perms_v1',JSON.stringify(perms)],[W1,'scout_tool_v1','{"players":1}'],[W1,'cs_idp_v1_'+who.player,'{"private":1}'],
    [W1,'cs_idp_pub_v1_'+who.player,'{"feedback":0}'],[W1,'cs_idp_v1_'+who.roleless,'{"mine":1}'],[W2,'scout_tool_v1','{"players":2}'],[W3,'scout_tool_v1','{"players":3}']];
  for(const [w,k,v] of kv)await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[w,k,v]);
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
const role=(db,uid,w)=>as(db,uid,async()=>(await db.query('SELECT public.ps_team_role($1) AS r',[w])).rows[0].r);
const canView=(db,uid,w)=>as(db,uid,async()=>(await db.query('SELECT public.ps_idp_can_view($1) AS r',[w])).rows[0].r);
const sees=(db,uid,w,k)=>as(db,uid,async()=>(await db.query('SELECT count(*)::int n FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[w,k])).rows[0].n===1);
// 코치 피드백 저장 시도 → 실제로 바뀌었나(가드는 UPDATE 를 조용히 되돌린다 — 성공 응답만 보지 않는다)
async function writesPub(db,uid){
  const k='cs_idp_pub_v1_'+who.player;
  const r=await as(db,uid,async()=>{
    try{ await db.query("UPDATE public.ps_kv SET v='{\"feedback\":1}' WHERE workspace_id=$1 AND k=$2",[W1,k]); }catch(e){ return 'error:'+e.code; }
    await db.exec('RESET ROLE');
    return (await db.query('SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[W1,k])).rows[0].v;
  });
  return r==='{"feedback":1}';
}
const defs=async db=>(await db.query("SELECT p.proname, pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1")).rows;
const acl=async db=>(await db.query("SELECT p.proname, p.proacl::text a, p.prosecdef s, p.proowner o FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1")).rows;

async function run(){
  const db=new PGlite();
  try{
    await db.exec(fixture);await seed(db);
    const origDefs=await defs(db),origAcl=await acl(db);

    // ── 적용 전: 문제가 실제로 있다 ─────────────────────────────
    equal(await role(db,who.roleless,W1),'staff','before: roleless member is staff on the server');
    equal(await sees(db,who.roleless,W1,'scout_tool_v1'),true,'before: roleless reads roster/scout document');
    equal(await sees(db,who.roleless,W1,'cs_idp_v1_'+who.player),true,'before: roleless reads another player private IDP');
    equal(await sees(db,who.roleless,W1,'cs_idp_pub_v1_'+who.player),true,'before: roleless reads another player coach feedback');
    equal(await role(db,who.member2,W2),'admin','before: non-owner in a team without perms doc is admin');
    equal(await canView(db,who.member2,W2),true,'before: and can view every IDP');
    equal(await writesPub(db,who.staffView),false,'before: view-only coaching staff cannot save coach feedback (guard reverts)');
    equal(await writesPub(db,who.staffTeam),false,'before: staff with team scope also blocked (server says board)');

    // ── 1) 역할 기본값 ─────────────────────────────────────────
    await db.exec(roleSql);await db.exec(roleSql);   // 두 번 실행해도 안전
    await db.exec(roleVerify);
    equal(await role(db,who.roleless,W1),'player','after: roleless member is a player (same as the app)');
    equal(await sees(db,who.roleless,W1,'scout_tool_v1'),false,'after: roleless cannot read the roster/scout document');
    equal(await sees(db,who.roleless,W1,'cs_idp_v1_'+who.player),false,'after: roleless cannot read another private IDP');
    equal(await sees(db,who.roleless,W1,'cs_idp_pub_v1_'+who.player),false,'after: roleless cannot read another coach feedback');
    equal(await sees(db,who.roleless,W1,'cs_idp_v1_'+who.roleless),true,'after: roleless still reads own IDP');
    equal(await role(db,who.member2,W2),'player','after: non-owner in a team without perms doc is a player');
    equal(await canView(db,who.member2,W2),false,'after: and cannot view other IDPs');
    equal(await sees(db,who.member2,W2,'scout_tool_v1'),false,'after: and cannot read the team roster');
    // 그대로여야 하는 것
    for(const [u,w,r] of [[who.owner,W1,'admin'],[who.exec,W1,'executive'],[who.staffView,W1,'staff'],[who.staffTeam,W1,'staff'],[who.player,W1,'player'],[who.owner2,W2,'admin'],[who.solo,W3,'admin']])
      equal(await role(db,u,w),r,'unchanged role '+r);
    equal(await canView(db,who.staffView,W1),true,'staff still views IDPs');
    equal(await canView(db,who.player,W1),false,'player still cannot view others');
    equal(await canView(db,who.owner2,W2),true,'owner of a team without perms doc still views');
    equal(await sees(db,who.staffView,W1,'scout_tool_v1'),true,'staff still reads roster');
    equal(await sees(db,who.solo,W3,'scout_tool_v1'),true,'personal space unchanged');
    await db.query("UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k='cs_perms_v1'",[JSON.stringify({v:1,defaultRole:'staff',members:{}}),W1]);
    equal(await role(db,who.roleless,W1),'staff','explicit defaultRole staff is still honoured');
    await db.query("UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k='cs_perms_v1'",[JSON.stringify({v:1,members:{[who.exec]:{role:'executive'},[who.staffView]:{role:'staff'},[who.staffTeam]:{role:'staff',scopes:['team']},[who.player]:{role:'player'}}}),W1]);
    const afterRole=await defs(db);
    equal(afterRole.filter(x=>!['ps_team_role','ps_idp_can_view'].includes(x.proname)),origDefs.filter(x=>!['ps_team_role','ps_idp_can_view'].includes(x.proname)),'no other function changed');
    equal(await acl(db),origAcl,'grants, SECURITY DEFINER and owners unchanged');

    // ── 2) 코치 피드백 쓰기 ───────────────────────────────────
    await db.exec(pubSql);await db.exec(pubSql);
    await db.exec(pubVerify);
    equal(await writesPub(db,who.staffView),true,'after: view-only coaching staff saves coach feedback');
    equal(await writesPub(db,who.staffTeam),true,'after: staff with team scope saves coach feedback');
    equal(await writesPub(db,who.exec),true,'executive saves coach feedback');
    equal(await writesPub(db,who.player),false,'player still cannot write coach feedback');
    equal(await writesPub(db,who.roleless),false,'roleless (now player) cannot write coach feedback');
    // 다른 키의 쓰기 판정은 그대로(보기 전용 스태프는 팀 자료를 못 쓴다)
    const writesRoster=uid=>as(db,uid,async()=>{ await db.query("UPDATE public.ps_kv SET v='{\"players\":9}' WHERE workspace_id=$1 AND k='scout_tool_v1'",[W1]); await db.exec('RESET ROLE'); return (await db.query("SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k='scout_tool_v1'",[W1])).rows[0].v==='{"players":9}'; });
    equal(await writesRoster(who.staffView),false,'view-only staff still cannot write team data');
    equal(await writesRoster(who.staffTeam),true,'team-scoped staff still writes team data');
    equal((await defs(db)).filter(x=>x.proname!=='ps_can_write_key'),afterRole.filter(x=>x.proname!=='ps_can_write_key'),'idp_pub_write changes only ps_can_write_key');
    equal(await acl(db),origAcl,'grants unchanged after idp_pub_write');

    // ── 되돌리기 ──────────────────────────────────────────────
    await db.exec(pubRollback);await db.exec(pubRollback);
    await db.exec(roleRollback);await db.exec(roleRollback);
    equal(await defs(db),origDefs,'rollbacks restore the exact original function definitions');
    equal(await acl(db),origAcl,'rollbacks keep grants');
    equal(await role(db,who.roleless,W1),'staff','rollback restores the old server default');

    // ── 예상과 다른 정의면 아무것도 안 바꾸고 멈춘다 ───────────────
    await db.exec(`CREATE OR REPLACE FUNCTION public.ps_idp_can_view(wid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$ SELECT true $$`);
    const beforeFail=await defs(db);
    let err;try{await db.exec(roleSql);}catch(e){err=e;try{await db.exec('ROLLBACK');}catch(_){}}
    assert.ok(err&&/정의가 예상과 다릅니다/.test(err.message),'unexpected definition aborts');passed++;
    equal(await defs(db),beforeFail,'aborted migration changes nothing (ps_team_role untouched too)');

    console.log(JSON.stringify({ok:true,assertions:passed,method:'isolated in-memory PostgreSQL; authenticated role + JWT per action; no network'},null,2));
  }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
