/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261007_incident_ledger.local-test.cjs
 * 20261007_incident_ledger(데이터 사고 기록장 + 관리자 점검)를 합성 표 위에서 시험한다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,'20261007_incident_ledger'+name),'utf8');
const sql=read('.sql'),verify=read('.verify.sql'),rollback=read('.rollback.sql');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ADMIN=id(1),COACH=id(2),WIPER=id(3),W=id(100),W2=id(101);
let passed=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
async function denied(fn,code,label){let e;try{await fn();}catch(err){e=err;}assert.ok(e,label+' (no error)');equal(e.code,code,label);}
async function as(db,uid,fn,role='authenticated'){
  await db.exec('BEGIN');
  try{
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);
    await db.exec('SET LOCAL ROLE '+role);
    const r=await fn();await db.exec('COMMIT');return r;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
const SECRET='SECRET-MEMO-DO-NOT-LEAK';
const scout=(players,records,days)=>JSON.stringify({attrs:[{id:'a'}],positions:[{id:'p'}],
  players:Array.from({length:players},(_,i)=>({id:'pl'+i,name:'선수'+i,memo:SECRET})),
  meta:{statusRuns:Object.fromEntries(Array.from({length:records},(_,i)=>['pl'+i,[{s:'rest',from:'2026-10-01',to:'2026-10-01'}]])),
        participationDays:Object.fromEntries(Array.from({length:days},(_,i)=>['2026-10-0'+(i+1),{pl0:{s:'ok'}}]))}});
const matches=(n,scored)=>JSON.stringify({version:1,matches:Array.from({length:n},(_,i)=>({id:'m'+i,opp:'상대'+i,scoreUs:i<scored?'1':'',memo:SECRET}))});
const FIXTURE=`
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create table public.ps_admins(user_id uuid primary key);
create function public.ps_is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select from public.ps_admins where user_id=auth.uid()) $$;
grant execute on function public.ps_is_admin() to authenticated;
create table public.ps_workspaces(id uuid primary key, name text, kind text not null default 'team', owner_id uuid);
create table public.ps_kv(workspace_id uuid not null, k text not null, v text, cupd bigint, primary key(workspace_id,k));
create table public.ps_kv_history(id bigint primary key, workspace_id text not null, k text not null, v text, cupd bigint, operation text not null default 'update', changed_by uuid, changed_at timestamptz not null default now());
create table public.ps_kv_denied(workspace_id uuid, user_id uuid, k text, reason text, at timestamptz default now(), primary key(workspace_id,user_id,k));
grant usage on schema public to authenticated, anon;
`;
async function setup(){
  const db=new PGlite();await db.exec(FIXTURE);
  await db.query('insert into public.ps_admins values($1)',[ADMIN]);
  await db.query("insert into public.ps_workspaces values($1,'프로세스FC','team',$2),($3,'둘째팀','team',$2)",[W,COACH,W2]);
  const H=async(hid,wid,k,v,by,daysAgo)=>db.query("insert into public.ps_kv_history(id,workspace_id,k,v,changed_by,changed_at) values($1,$2,$3,$4,$5,now()-make_interval(hours=>$6))",[hid,wid,k,v,by,Math.round(daysAgo*24)]);
  /* 선수단: 정상 고침 두 번 → 옛 판 부팅이 기록 칸을 지움(지금 판) */
  await H(1,W,'scout_tool_v1',scout(10,6,5),COACH,3);
  await H(2,W,'scout_tool_v1',scout(11,6,5),COACH,2);
  await H(3,W,'scout_tool_v1',scout(11,7,5),WIPER,1);
  await db.query("insert into public.ps_kv values($1,'scout_tool_v1',$2,1)",[W,scout(11,0,0)]);
  /* 아주 오래된 사고(20일 전)는 자동 감지 범위(14일) 밖 */
  await H(4,W2,'scout_tool_v1',scout(20,10,10),WIPER,20);
  await H(5,W2,'scout_tool_v1',scout(20,10,10),COACH,19);
  await db.query("insert into public.ps_kv values($1,'scout_tool_v1',$2,1)",[W2,scout(20,10,10)]);
  /* 경기: 점수 적힌 경기 8 → 2 */
  await H(6,W,'cs_team_matches_v1',matches(12,8),WIPER,1);
  await db.query("insert into public.ps_kv values($1,'cs_team_matches_v1',$2,1)",[W,matches(12,2)]);
  /* 일정: 큰 문서 절반 아래로 / 작은 문서는 보지 않음 */
  await H(7,W,'process_coach_v1','x'.repeat(50000),COACH,1);
  await db.query("insert into public.ps_kv values($1,'process_coach_v1',$2,1)",[W,'y'.repeat(10000)]);
  await H(8,W2,'process_coach_v1','x'.repeat(10000),COACH,1);
  await db.query("insert into public.ps_kv values($1,'process_coach_v1',$2,1)",[W2,'y'.repeat(1000)]);
  /* 깨진 JSON 은 점검을 죽이지 않는다 */
  await H(9,W2,'cs_team_matches_v1','{not json',COACH,1);
  await db.query("insert into public.ps_kv values($1,'cs_team_matches_v1',$2,1)",[W2,matches(3,0)]);
  /* 가드 기록 */
  for(const [u,k,reason,daysAgo] of [
    [id(10),'scout_tool_v1','앱을 완전히 닫았다가 다시 열면 새 판에서 저장돼요 (판 2.841 < 2.880)',1],
    [id(11),'scout_tool_v1','선수단 기록(statusRuns)이 빠진 저장을 막았어요',1],
    [id(12),'cs_squad_v1','선수 11명이 전부 사라지는 저장을 막았어요',2],
    [id(13),'process_coach_v1','오래된 일정 판본이 최신 일정을 덮으려 했습니다',2],
    [id(14),'cs_perms_v1','권한은 운영진만 바꿀 수 있습니다 — 본인 등록만 반영했어요',3],
    [id(15),'cs_idp_v1_'+id(99),'다른 선수의 IDP 는 편집할 수 없습니다',3],
    [id(16),'cs_vault_folders_v1','알 수 없는 사유',3],
    [id(17),'cs_perms_v1','권한은 운영진만 바꿀 수 있습니다',80]])
    await db.query("insert into public.ps_kv_denied values($1,$2,$3,$4,now()-make_interval(days=>$5))",[W,u,k,reason,daysAgo]);
  return db;
}
const call=(db,uid=ADMIN,days=56)=>as(db,uid,async()=>(await db.query('select public.ps_admin_incidents($1) r',[days])).rows[0].r);
async function run(){
  const db=await setup();
  await db.exec(sql);
  await db.exec(sql);                                            // 재실행 안전
  const v=(await db.query(verify)).rows[0];
  equal([v.rls,Number(v.policies),v.auth_select,v.anon_select,Number(v.functions),v.admin_secdef,Number(v.seeded)],[true,0,false,false,5,true,3],'verify: RLS on, no policies, no direct grants, 5 functions, secdef, 3 seeds once');

  await denied(()=>as(db,null,()=>db.query('select public.ps_admin_incidents(56)'),'anon'),'42501','anon cannot call');
  await denied(()=>call(db,COACH),'42501','non-admin cannot read incidents');
  await denied(()=>as(db,COACH,()=>db.query('select * from public.ps_incidents')),'42501','authenticated cannot read table directly');
  await denied(()=>as(db,ADMIN,()=>db.query("insert into public.ps_incidents(kind,title) values('loss','x')")),'42501','even admin cannot insert directly');

  let r=await call(db);
  equal(r.goal_days,56,'goal is eight weeks');
  equal(r.log.length,3,'three seeded incidents in window');
  equal(new Date(r.last_loss_at).toISOString(),new Date('2026-10-07T00:07:00+09:00').toISOString(),'last loss = latest seeded restore');
  assert.ok(r.since_days>=0);passed++;
  equal(r.log.every(x=>x.ws===null),true,'seed team column empty when production team id is absent');

  const drops=Object.fromEntries(r.drops.map(x=>[x.k+'@'+x.ws,x]));
  equal(Object.keys(drops).sort(),['cs_team_matches_v1@프로세스FC','process_coach_v1@프로세스FC','scout_tool_v1@프로세스FC'],'three drops in the scanned 2 weeks, none in the old/small/broken cases');
  equal(drops['scout_tool_v1@프로세스FC'].dropped.sort(),['days 5→0','records 7→0'],'wipe of record fields detected');
  equal(drops['scout_tool_v1@프로세스FC'].by,WIPER,'the writer of the wiping save is named');
  equal(drops['scout_tool_v1@프로세스FC'].history_id,3,'points at the history row of that save');
  equal(drops['cs_team_matches_v1@프로세스FC'].dropped,['scored 8→2'],'lost scores detected');
  equal(drops['process_coach_v1@프로세스FC'].dropped,['len 50000→10000'],'big schedule halving detected');
  const out=JSON.stringify(r);
  equal(out.includes(SECRET)||out.includes('선수1'),false,'no document content leaves the function');

  equal(r.guards,{build:1,record:1,shape:1,lineage:1,permission:2,other:1},'guards grouped; 80-day-old row outside window');
  equal(r.denied.some(x=>x.cat==='build'),false,'old-build rows are counted but not listed');
  equal(r.denied.find(x=>x.cat==='permission'&&x.k.startsWith('cs_idp')).k,'cs_idp_v1_*','IDP key masked');

  const short=await call(db,ADMIN,3);
  equal(short.scan_days,3,'scan follows a shorter window');
  equal(Object.keys(short.guards).includes('permission'),false,'3-day window excludes the 3-day-old permission rows');

  /* 사람이 적는 기록 */
  const addAs=(uid,args)=>as(db,uid,async()=>(await db.query('select public.ps_admin_incident_add($1,$2,$3,$4,$5) id',args)).rows[0].id);
  await denied(()=>addAs(COACH,['loss','x',null,null,null]),'42501','non-admin cannot add');
  await denied(()=>addAs(ADMIN,['oops','x',null,null,null]),'23514','unknown kind rejected');
  await denied(()=>addAs(ADMIN,['loss','   ',null,null,null]),'23514','blank title rejected');
  await denied(()=>addAs(ADMIN,['loss','미래',null,null,new Date(Date.now()+86400000*2).toISOString()]),'22023','future time rejected');
  const nid=await addAs(ADMIN,['loss','  테스트 사고  ','  ',W,null]);
  r=await call(db);
  equal(r.since_days,0,'a new loss resets the counter');
  const mine=r.log.find(x=>x.id===Number(nid)||x.id===nid);
  equal([mine.title,mine.detail,mine.ws],['테스트 사고',null,'프로세스FC'],'title trimmed, blank detail stored as null, team name shown');
  await addAs(ADMIN,['near_miss','가드가 막음',null,null,null]);
  r=await call(db);equal(r.since_days,0,'near misses do not move the counter');
  const delAs=(uid,x)=>as(db,uid,async()=>(await db.query('select public.ps_admin_incident_del($1) ok',[x])).rows[0].ok);
  await denied(()=>delAs(COACH,nid),'42501','non-admin cannot delete');
  const seedId=(await db.query("select id from public.ps_incidents where seed_key is not null limit 1")).rows[0].id;
  equal(await delAs(ADMIN,seedId),false,'seeded incidents cannot be deleted');
  equal(await delAs(ADMIN,nid),true,'own mistaken entry deleted');

  await db.exec(rollback);
  equal((await db.query("select to_regclass('public.ps_incidents') t, to_regprocedure('public.ps_admin_incidents(int)') f")).rows[0],{t:null,f:null},'rollback removes table and functions');
  equal(Number((await db.query("select count(*) n from public.ps_kv")).rows[0].n),6,'rollback leaves team data untouched');
  console.log('20261007_incident_ledger local test: '+passed+' checks passed');
}
run().catch(e=>{console.error(e);process.exit(1);});
