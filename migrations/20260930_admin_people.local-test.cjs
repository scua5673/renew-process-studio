'use strict';
// LOCAL SYNTHETIC POSTGRESQL ONLY. All records and JWT subjects are synthetic. No network.
//   node migrations/20260930_admin_people.local-test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=s=>fs.readFileSync(path.join(__dirname,'20260930_admin_people.'+s),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ADMIN=id(1),KAKAO=id(2),GOOGLE=id(3),COACH=id(4),BARE=id(5),PLAYER2=id(6);
const TEAM=id(100),PERSONAL=id(101),BROKEN=id(102),TEAM2=id(103);
let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
async function denied(fn,code,label){let e;try{await fn();}catch(error){e=error;}assert.ok(e,label);equal(e.code,code,label);}
async function as(db,uid,fn,role='authenticated'){
  await db.exec('BEGIN');
  try{
    await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);
    await db.exec('SET LOCAL ROLE '+role);
    const result=await fn();await db.exec('COMMIT');return result;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function setup(){
  const db=new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email varchar,raw_user_meta_data jsonb,raw_app_meta_data jsonb,created_at timestamptz,last_sign_in_at timestamptz);
    CREATE TABLE public.ps_admins(user_id uuid PRIMARY KEY);
    CREATE FUNCTION public.ps_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT FROM public.ps_admins WHERE user_id=auth.uid()) $$;
    CREATE TABLE public.ps_workspaces(id uuid PRIMARY KEY,name text,kind text NOT NULL DEFAULT 'team',owner_id uuid);
    CREATE TABLE public.ps_members(workspace_id uuid,user_id uuid,role text NOT NULL DEFAULT 'member',name text,PRIMARY KEY(workspace_id,user_id));
    CREATE TABLE public.ps_kv(workspace_id uuid,k text,v text NOT NULL,PRIMARY KEY(workspace_id,k));
    CREATE TABLE public.ps_library(workspace_id uuid,lib_id text,owner_id uuid,deleted_at bigint,item jsonb,PRIMARY KEY(workspace_id,lib_id));
    ALTER TABLE public.ps_kv ENABLE ROW LEVEL SECURITY; CREATE POLICY existing_policy ON public.ps_kv USING(false);
    REVOKE ALL ON public.ps_kv,public.ps_members,public.ps_workspaces,public.ps_admins,public.ps_library FROM PUBLIC,anon,authenticated;
    REVOKE ALL ON auth.users FROM PUBLIC,anon,authenticated;
  `);
  const users=[
    [ADMIN,'admin@example.invalid',{},{provider:'email'},'2026-08-01'],
    [KAKAO,null,{nickname:'카카오닉'},{provider:'kakao',providers:['kakao']},'2026-09-01'],
    [GOOGLE,' coach@example.invalid ',{full_name:'Google Name'},{provider:'google',providers:['google','kakao']},'2026-09-02'],
    [COACH,'c2@example.invalid',{name:{nested:'bad'}},{provider:'kakao'},'2026-09-03'],
    [BARE,null,{},{},'2026-09-04'],
    [PLAYER2,null,{},{provider:'kakao'},'2026-09-05'],
  ];
  for(const [uid,email,meta,app,at] of users)
    await db.query('INSERT INTO auth.users VALUES($1,$2,$3,$4,$5,$6)',[uid,email,JSON.stringify(meta),JSON.stringify(app),at+'T00:00:00Z',at+'T12:00:00Z']);
  await db.query('INSERT INTO public.ps_admins VALUES($1)',[ADMIN]);
  await db.query("INSERT INTO public.ps_workspaces VALUES($1,'프로세스FC','team',$2),($3,'내 워크스페이스','personal',$4),($5,'깨진팀','team',$2),($6,'둘째팀','team',$2)",[TEAM,GOOGLE,PERSONAL,KAKAO,BROKEN,TEAM2]);
  for(const [w,u,role,name] of [[TEAM,GOOGLE,'owner','  김코치  '],[TEAM,KAKAO,'member',null],[TEAM,COACH,'member',''],[TEAM,BARE,'member',null],
    [PERSONAL,KAKAO,'owner',null],[BROKEN,KAKAO,'member',null],[TEAM2,PLAYER2,'member',null]])
    await db.query('INSERT INTO public.ps_members VALUES($1,$2,$3,$4)',[w,u,role,name]);
  const perms={v:1,members:{[KAKAO]:{role:'player',playerId:'pl_a'},[COACH]:{role:'executive'},[BARE]:{role:'staff',playerId:'pl_ghost'}}};
  await db.query("INSERT INTO public.ps_kv VALUES($1,'cs_perms_v1',$2)",[TEAM,JSON.stringify(perms)]);
  await db.query("INSERT INTO public.ps_kv VALUES($1,'sq:pl_a',$2)",[TEAM,JSON.stringify({id:'pl_a',name:' 이선수 ',num:7,posId:'pos_CB',memo:'SECRET-MEMO-A',levels:{x:5}})]);
  await db.query("INSERT INTO public.ps_kv VALUES($1,'cs_perms_v1','undefined')",[BROKEN]);
  await db.query("INSERT INTO public.ps_kv VALUES($1,'cs_perms_v1',$2)",[TEAM2,JSON.stringify({v:1,members:{[PLAYER2]:{role:'player',playerId:'pl_b'}}})]);
  await db.query("INSERT INTO public.ps_kv VALUES($1,'sq:pl_b','{not json')",[TEAM2]);
  await db.query("INSERT INTO public.ps_kv VALUES($1,'scout_tool_v1',$2)",[TEAM2,JSON.stringify({players:[{id:'pl_b',name:'박선수',num:'10',posId:'ST',memo:'SECRET-MEMO-B'},{id:'pl_c',name:'다른선수'},'garbage',{id:5}],meta:{emblem:'data:image/png;base64,SECRET'}})]);
  for(const [wid,lid,owner,deleted] of [[TEAM,'a',GOOGLE,null],[TEAM,'b',GOOGLE,null],[TEAM,'c',GOOGLE,10],[TEAM,'d',COACH,null]])
    await db.query('INSERT INTO public.ps_library VALUES($1,$2,$3,$4,$5)',[wid,lid,owner,deleted,JSON.stringify({secret:'SECRET-LIB'})]);
  return db;
}
async function baseline(db){return (await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(k) ORDER BY workspace_id,k) FROM public.ps_kv k) kv,
  (SELECT jsonb_agg(to_jsonb(m) ORDER BY workspace_id,user_id) FROM public.ps_members m) members,
  (SELECT jsonb_agg(jsonb_build_object('oid',oid,'acl',relacl::text,'rls',relrowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN('public.ps_kv'::regclass,'public.ps_members'::regclass,'public.ps_workspaces'::regclass,'public.ps_library'::regclass)) rels,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid='public.ps_kv'::regclass) policies`)).rows[0];}
async function run(){
  const db=await setup();
  try{
    const original=await baseline(db);
    await db.exec(read('sql'));
    await db.exec(read('sql'));
    equal(await baseline(db),original,'repeat installation changes no content, grants, RLS');
    await db.exec(read('verify.sql'));
    const call=(uid=ADMIN)=>as(db,uid,async()=>(await db.query('SELECT public.ps_admin_people() people')).rows[0].people);
    await denied(()=>as(db,null,()=>db.query('SELECT public.ps_admin_people()'),'anon'),'42501','anonymous RPC rejected');
    await denied(()=>call(null),'42501','missing subject rejected');
    await denied(()=>call(GOOGLE),'42501','team owner is not service admin');
    const people=await call();
    equal(people.length,6,'every account is listed');
    const by=Object.fromEntries(people.map(p=>[p.user_id,p]));
    equal(people.map(p=>p.user_id),[PLAYER2,BARE,COACH,GOOGLE,KAKAO,ADMIN],'newest first');
    // 카카오 가입자: 이메일 없음 → 계정 닉네임·로그인 방식·팀 역할·연결 선수로 알아본다
    const k=by[KAKAO];
    equal([k.email,k.account_name,k.provider,k.member_name],[null,'카카오닉','kakao',null],'kakao identity without email');
    const kTeam=k.teams.find(t=>t.workspace_id===TEAM);
    equal([kTeam.name,kTeam.kind,kTeam.role,kTeam.member_role,kTeam.owner],['프로세스FC','team','player','member',false],'team role from permissions document');
    equal(kTeam.player,{name:'이선수',num:'7',pos:'CB'},'linked player from roster item key');
    equal(k.teams.map(t=>t.kind),['team','team','personal'],'team spaces listed before the personal space');
    // 구글: 이메일 다듬기·계정 이름·팀에 적은 이름·소유자·만든 수(지운 것 제외)
    const g=by[GOOGLE];
    equal([g.email,g.account_name,g.member_name,g.made_count,g.provider,g.providers],['coach@example.invalid','Google Name','김코치',2,'google',['google','kakao']],'google identity');
    equal(g.teams.find(t=>t.workspace_id===TEAM).owner,true,'workspace owner flag');
    // 이름 필드가 문자열이 아니면 버린다
    equal(by[COACH].account_name,null,'non-string metadata name ignored');
    equal(by[COACH].teams.find(t=>t.workspace_id===TEAM).role,'executive','executive role');
    equal(by[COACH].made_count,1,'own library items only');
    // 명단에 없는 선수 id 는 비워 둔다
    equal(by[BARE].teams.find(t=>t.workspace_id===TEAM).player,null,'unknown linked player id stays empty');
    equal(by[BARE].account_name,null,'no metadata name');
    // 항목 키가 깨졌으면 선수단 문서에서 찾는다
    equal(by[PLAYER2].teams[0].player,{name:'박선수',num:'10',pos:'ST'},'fallback to roster document when item key is malformed');
    // 깨진 권한 문서는 그 팀 역할만 비우고 목록 전체를 살린다
    equal(by[KAKAO].teams.find(t=>t.workspace_id===BROKEN).role,null,'broken permissions document is skipped');
    // 문서 내용은 절대 나오지 않는다
    const text=JSON.stringify(people);
    for(const secret of ['SECRET-MEMO-A','SECRET-MEMO-B','SECRET-LIB','base64','levels','다른선수'])equal(text.includes(secret),false,'never returns content: '+secret);
    // 되돌리기
    await db.exec(read('rollback.sql'));
    equal((await db.query("SELECT to_regprocedure('public.ps_admin_people()') f")).rows[0].f,null,'rollback removes the function');
    equal(await baseline(db),original,'rollback leaves data and grants unchanged');
    await db.exec(read('sql'));
    console.log(JSON.stringify({ok:true,checks,method:'isolated in-memory PostgreSQL; authenticated role + JWT per action; no network'},null,2));
  }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exit(1);});
