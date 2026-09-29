/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20260930_staff_view_only.local-test.cjs
 * 20260930_staff_view_only(서버도 «코칭스태프 보기 전용») 를 운영 원문 픽스처 위에서 시험한다.
 * 운영과 같은 순서로 앞의 두 변경(역할 기본값·코치 피드백 쓰기)을 먼저 얹고 시작한다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,'20260930_'+name),'utf8');
const fixture=read('role_alignment.local-fixture.sql');
const roleSql=read('role_default_player.sql'),pubSql=read('idp_pub_write.sql');
const sql=read('staff_view_only.sql'),verify=read('staff_view_only.verify.sql'),rollback=read('staff_view_only.rollback.sql');
const W1='00000000-0000-4000-8000-000000000201';   // 편집 닫힘(기본) 팀
const W2='00000000-0000-4000-8000-000000000202';   // staffEdit=edit 팀
const W3='00000000-0000-4000-8000-000000000203';   // schedEdit=staff 팀
const U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const who={owner:U(21),exec:U(22),staff:U(23),staffScoped:U(24),player:U(25),owner2:U(26),staff2:U(27),owner3:U(28),staff3:U(29),staff3s:U(30)};
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const KEYS=['scout_tool_v1','cs_scout_targets_v1','process_coach_v1','cs_gamemodel_v1','cs_perms_v1','cs_idp_pub_v1_'+U(25)];
async function seed(db){
  for(const [id,owner] of [[W1,who.owner],[W2,who.owner2],[W3,who.owner3]])await db.query("INSERT INTO public.ps_workspaces(id,name,owner_id,kind) VALUES($1,'Synthetic',$2,'team')",[id,owner]);
  const mem=[[W1,who.owner,'owner'],[W1,who.exec],[W1,who.staff],[W1,who.staffScoped],[W1,who.player],[W2,who.owner2,'owner'],[W2,who.staff2],[W3,who.owner3,'owner'],[W3,who.staff3],[W3,who.staff3s]];
  for(const [w,u,r] of mem)await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[w,u,r||'member']);
  const perms={
    [W1]:{v:1,members:{[who.exec]:{role:'executive'},[who.staff]:{role:'staff'},[who.staffScoped]:{role:'staff',scopes:['team']},[who.player]:{role:'player'}}},
    [W2]:{v:1,staffEdit:'edit',members:{[who.staff2]:{role:'staff'}}},
    [W3]:{v:1,schedEdit:'staff',members:{[who.staff3]:{role:'staff'},[who.staff3s]:{role:'staff',scopes:['team']}}}};
  for(const w of [W1,W2,W3]){
    await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_perms_v1',$2)",[w,JSON.stringify(perms[w])]);
    for(const k of KEYS.filter(k=>k!=='cs_perms_v1'))await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[w,k,'{"n":0}']);
  }
}
async function as(db,uid,fn){
  await db.exec('BEGIN');
  try{
    const claims=JSON.stringify({sub:uid,role:'authenticated'});
    for(const [k,v] of Object.entries({'request.jwt.claims':claims,'request.jwt.claim':claims,'request.jwt.claim.sub':uid,'request.jwt.claim.role':'authenticated'}))await db.query('SELECT set_config($1,$2,true)',[k,v]);
    await db.exec('SET LOCAL ROLE authenticated');
    return await fn();
  }finally{await db.exec('ROLLBACK');}
}
const can=(db,uid,w,k)=>as(db,uid,async()=>(await db.query('SELECT public.ps_can_write_key($1,$2) AS r',[w,k])).rows[0].r);
// 실제 저장이 바뀌었나(RLS·가드 둘 다 지나야 한다 — 성공 응답만 보지 않는다)
async function writes(db,uid,w,k){
  return as(db,uid,async()=>{
    try{ await db.query("UPDATE public.ps_kv SET v='{\"n\":1}' WHERE workspace_id=$1 AND k=$2",[w,k]); }catch(e){ return false; }
    await db.exec('RESET ROLE');
    return (await db.query('SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[w,k])).rows[0].v==='{"n":1}';
  });
}
const table=async(db,list)=>{const o={};for(const [name,uid,w] of list){o[name]={};for(const k of KEYS)o[name][k.replace(/_[0-9a-f-]{36}$/,'_<uid>')]=await can(db,uid,w,k);}return o;};
const defs=async db=>(await db.query("SELECT p.proname, pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1")).rows;
const acl=async db=>(await db.query("SELECT p.proname, p.proacl::text a, p.prosecdef s FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1")).rows;
const people=[['owner',who.owner,W1],['exec',who.exec,W1],['staff',who.staff,W1],['staffScoped',who.staffScoped,W1],['player',who.player,W1],['staff2',who.staff2,W2],['staff3',who.staff3,W3],['staff3s',who.staff3s,W3]];

async function run(){
  const db=new PGlite();
  try{
    await db.exec(fixture);await seed(db);
    await db.exec(roleSql);await db.exec(pubSql);   // 운영의 현재 상태
    const beforeDefs=await defs(db),beforeAcl=await acl(db),before=await table(db,people);
    // 적용 전: 편집 닫힘 팀의 스태프가 팀 자료를 쓴다(앱에서만 막는다)
    equal(before.staff.scout_tool_v1,true,'before: view-only staff writes roster on the server');
    equal(before.staff.cs_scout_targets_v1,true,'before: view-only staff writes scout targets on the server');

    await db.exec(sql);await db.exec(sql);   // 두 번 실행해도 안전
    await db.exec(verify);
    const after=await table(db,people);
    const P='cs_idp_pub_v1_<uid>';
    // 보기 전용 스태프: 팀 자료·스카우트·일정·게임모델 모두 못 쓴다 · 코치 피드백은 쓴다(IDP 열람 규칙)
    equal(after.staff,{scout_tool_v1:false,cs_scout_targets_v1:false,process_coach_v1:false,cs_gamemodel_v1:false,cs_perms_v1:false,[P]:true},'view-only staff');
    // 편집 열림 스태프: 스카우트만 빼고 쓴다(앱 perms.js staffIds·sync.js canW 와 같다)
    equal(after.staff2,{scout_tool_v1:true,cs_scout_targets_v1:false,process_coach_v1:true,cs_gamemodel_v1:true,cs_perms_v1:false,[P]:true},'edit-open staff');
    // «스태프도 일정 편집» 팀: 편집이 닫혀 있어도 일정은 쓴다 — 구역을 지정받은 스태프도
    equal(after.staff3.process_coach_v1,true,'schedEdit=staff lets view-only staff write the schedule');
    equal(after.staff3.scout_tool_v1,false,'schedEdit=staff does not open other team data');
    equal(after.staff3s.process_coach_v1,true,'schedEdit=staff also for scoped staff (app rule comes before scopes)');
    equal(after.staff3s.scout_tool_v1,true,'scoped staff keeps its team scope');
    // 그대로여야 하는 것
    for(const n of ['owner','exec','staffScoped','player'])equal(after[n],before[n],'unchanged: '+n);
    // 실제 저장(RLS)도 같은 판정
    equal(await writes(db,who.staff,W1,'scout_tool_v1'),false,'RLS: view-only staff roster save does not land');
    equal(await writes(db,who.staff,W1,'cs_idp_pub_v1_'+who.player),true,'RLS: view-only staff coach feedback lands');
    equal(await writes(db,who.staff2,W2,'scout_tool_v1'),true,'RLS: edit-open staff roster save lands');
    equal(await writes(db,who.staff3,W3,'process_coach_v1'),true,'RLS: schedEdit=staff schedule save lands');
    equal(await writes(db,who.exec,W1,'scout_tool_v1'),true,'RLS: executive still saves');
    // 깨진 권한 문서(JSON 아님): 스태프 역할도 못 얻지만, 쓰기도 닫힌 쪽
    await db.query("UPDATE public.ps_kv SET v='undefined' WHERE workspace_id=$1 AND k='cs_perms_v1'",[W2]);
    equal(await can(db,who.staff2,W2,'scout_tool_v1'),false,'broken perms doc: closed');
    await db.query("UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k='cs_perms_v1'",[JSON.stringify({v:1,staffEdit:'edit',members:{[who.staff2]:{role:'staff'}}}),W2]);
    // ps_can_write_key 하나만 바뀌고 권한·SECURITY DEFINER 는 그대로
    equal((await defs(db)).filter(x=>x.proname!=='ps_can_write_key'),beforeDefs.filter(x=>x.proname!=='ps_can_write_key'),'only ps_can_write_key changes');
    equal(await acl(db),beforeAcl,'grants and SECURITY DEFINER unchanged');

    // 되돌리기 — 글자까지 원래대로
    await db.exec(rollback);await db.exec(rollback);
    equal(await defs(db),beforeDefs,'rollback restores the exact definition');
    equal(await table(db,people),before,'rollback restores every decision');

    // 예상과 다른 정의면 아무것도 안 바꾸고 멈춘다
    const d=(await db.query("SELECT pg_get_functiondef(to_regprocedure('public.ps_can_write_key(uuid,text)')) d")).rows[0].d;
    await db.exec(d.replace("if r = 'staff' then return true; end if;","if r = 'staff' then return true; end if; if r = 'staff' then return true; end if;"));
    const beforeFail=await defs(db);
    let err;try{await db.exec(sql);}catch(e){err=e;try{await db.exec('ROLLBACK');}catch(_){}}
    assert.ok(err&&/정의가 예상과 다릅니다/.test(err.message),'unexpected definition aborts');passed++;
    equal(await defs(db),beforeFail,'aborted migration changes nothing');

    console.log(JSON.stringify({ok:true,assertions:passed,method:'isolated in-memory PostgreSQL; authenticated role + JWT per action; no network'},null,2));
  }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
