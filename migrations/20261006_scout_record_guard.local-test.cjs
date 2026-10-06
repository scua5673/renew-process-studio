/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261006_scout_record_guard.local-test.cjs
 * 20261006_scout_record_guard(선수단 기록 가드)를 합성 ps_kv 위에서 시험한다.
 * 운영 ps_kv 의 앞 가드(ps_00a 판·ps_00b 모양)와 ps_kv_note_denied 는 여기서 최소 모양으로 흉내 낸다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,'20261006_scout_record_guard'+name),'utf8');
const sql=read('.sql'),verify=read('.verify.sql'),rollback=read('.rollback.sql');
const W='00000000-0000-4000-8000-000000000601',U='00000000-0000-4000-8000-000000000021';
let passed=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const CARDS=['pos_GK','pos_RW','pos_LCB'];
const good=(over)=>Object.assign({attrs:[{id:'a1'}],positions:[{id:'pos_GK'},{id:'pos_RW'}],players:[{id:'p1'}],
  meta:{evalMode:'fifa',tbCards:CARDS,tbXY:{pos_RW:{x:77,y:81}},statusRuns:{p1:[{s:'rehab',from:'2026-10-06',to:'2026-10-06'}]},participationDays:{'2026-10-06':{p1:{s:'rest'}}}}},over||{});
const FIXTURE=`
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.ps_kv(workspace_id uuid not null, k text not null, v text, cupd bigint, updated_at timestamptz default now(), primary key(workspace_id,k));
create table public.ps_kv_denied(workspace_id uuid, user_id uuid, k text, reason text, at timestamptz default now(), primary key(workspace_id,user_id,k));
create or replace function public.ps_kv_note_denied(p_wid uuid, p_uid uuid, p_k text, p_reason text) returns void language sql as $$
  insert into public.ps_kv_denied(workspace_id,user_id,k,reason) values(p_wid,coalesce(p_uid,'00000000-0000-0000-0000-000000000000'::uuid),p_k,p_reason)
  on conflict(workspace_id,user_id,k) do update set reason=excluded.reason, at=now() $$;
-- 앞 가드 흉내: 판 가드는 통과, 모양 가드(선수 1.6배)는 운영과 같은 거부 모양
create or replace function public.ps_kv_shape_guard() returns trigger language plpgsql as $$
declare o int; n int;
begin
  if new.k<>'scout_tool_v1' then return new; end if;
  begin o:=jsonb_array_length(old.v::jsonb->'players'); n:=jsonb_array_length(new.v::jsonb->'players'); exception when others then return new; end;
  if o>=10 and n>o*1.6 then return old; end if;
  return new; end $$;
create trigger ps_00b_shape_guard_t before update on public.ps_kv for each row execute function public.ps_kv_shape_guard();`;
/* 준비 단계는 가드를 지나지 않게 지웠다 다시 넣는다(UPDATE 만 가드가 본다) */
async function put(db,k,doc){await db.query('delete from public.ps_kv where workspace_id=$1 and k=$2',[W,k]);await db.query('insert into public.ps_kv(workspace_id,k,v,cupd) values($1,$2,$3,1)',[W,k,typeof doc==='string'?doc:JSON.stringify(doc)]);}
async function save(db,k,doc){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[U]);
  await db.query('update public.ps_kv set v=$3, cupd=cupd+1 where workspace_id=$1 and k=$2',[W,k,typeof doc==='string'?doc:JSON.stringify(doc)]);
  const r=(await db.query('select v,cupd from public.ps_kv where workspace_id=$1 and k=$2',[W,k])).rows[0];
  return {accepted:r.cupd>1,v:r.v};
}
const denied=async db=>(await db.query('select k,reason from public.ps_kv_denied')).rows;
async function fresh(){const db=new PGlite();await db.exec(FIXTURE);await db.exec(sql);return db;}
async function run(){
  let db=await fresh();
  // 1) 정상 저장(카드·기록 고침)은 지난다
  await put(db,'scout_tool_v1',good());
  let r=await save(db,'scout_tool_v1',good({meta:Object.assign(good().meta,{tbCards:['pos_GK','pos_LCB','pos_RW']})}));
  equal(r.accepted,true,'normal edit accepted');
  equal(JSON.parse(r.v).meta.tbCards[1],'pos_LCB','normal edit stored');
  equal(await denied(db),[],'nothing denied for normal edit');
  // 2) 오늘 사고 모양: 기록 칸이 통째로 빠지고 카드가 기본으로 — 거부, 서버 판 그대로, 사유 남음
  await put(db,'scout_tool_v1',good());
  const wiped=good();wiped.meta={evalMode:'fifa',tbCards:['pos_GK','pos_CB','pos_LCB'],tbXY:{}};
  r=await save(db,'scout_tool_v1',wiped);
  equal(r.accepted,false,'wipe rejected');
  equal(JSON.parse(r.v).meta.tbCards[1],'pos_RW','RW card kept on server');
  equal(Object.keys(JSON.parse(r.v).meta.statusRuns),['p1'],'records kept on server');
  let d=await denied(db);equal(d.length,1,'one denial noted');equal(d[0].k,'scout_tool_v1','denial key');
  assert.match(d[0].reason,/statusRuns/);passed++;
  // 3) 출석 정정만 빠져도(10/3·9/21 모양) 거부
  await db.exec('delete from public.ps_kv_denied');await put(db,'scout_tool_v1',good());
  const noDays=good();delete noDays.meta.participationDays;
  equal((await save(db,'scout_tool_v1',noDays)).accepted,false,'participationDays drop rejected');
  // 4) 9/15 모양: 평가표·포지션이 빈 뼈대 — 거부(기록 칸이 없던 팀도)
  await put(db,'scout_tool_v1',good({meta:{evalMode:'fifa'}}));
  equal((await save(db,'scout_tool_v1',{attrs:[],positions:[],players:[{id:'p1'}],meta:{emblem:'x'}})).accepted,false,'raw skeleton rejected');
  equal((await save(db,'scout_tool_v1',{attrs:[{id:'a1'}],players:[],meta:{}})).accepted,false,'missing positions rejected');
  equal((await save(db,'scout_tool_v1',{attrs:{a:1},positions:'x',players:[],meta:{}})).accepted,false,'non-array attrs/positions rejected without error');
  await put(db,'scout_tool_v1',{attrs:{a:1},positions:[{id:'p'}],players:[],meta:{}});
  equal((await save(db,'scout_tool_v1',{attrs:[],positions:[],players:[],meta:{}})).accepted,true,'odd old shape is not ours to guard');
  // 5) 기록 칸이 원래 없던 팀·비어 있던 칸은 막지 않는다(새 팀의 첫 저장)
  await put(db,'scout_tool_v1',good({meta:{evalMode:'fifa',statusRuns:{}}}));
  equal((await save(db,'scout_tool_v1',good({meta:{evalMode:'fifa'}}))).accepted,true,'empty statusRuns may drop');
  await put(db,'scout_tool_v1',good({meta:{evalMode:'fifa'}}));
  equal((await save(db,'scout_tool_v1',good())).accepted,true,'records may appear');
  // 6) 기록 칸이 남아 있으면 비어도 지난다(선수 삭제로 기록이 줄어드는 경우)
  await put(db,'scout_tool_v1',good());
  equal((await save(db,'scout_tool_v1',good({meta:Object.assign(good().meta,{statusRuns:{},participationDays:{}})}))).accepted,true,'emptied-but-present accepted');
  // 7) 다른 키·깨진 JSON·객체 아닌 값은 손대지 않는다
  await put(db,'cs_squad_v1',good());
  equal((await save(db,'cs_squad_v1',{players:[]})).accepted,true,'other keys untouched');
  await put(db,'scout_tool_v1','not json');
  equal((await save(db,'scout_tool_v1',good())).accepted,true,'broken old json passes');
  await put(db,'scout_tool_v1',good());
  equal((await save(db,'scout_tool_v1','[1,2]')).accepted,true,'non-object passes (other guards own shape)');
  // 8) 복구 SQL 모양(편집기·auth.uid 없음)으로 기록을 되살리는 저장은 지난다
  await put(db,'scout_tool_v1',wiped);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.query("update public.ps_kv set v=jsonb_set(v::jsonb,'{meta,statusRuns}',$2::jsonb)::text, cupd=cupd+1 where workspace_id=$1 and k='scout_tool_v1'",[W,JSON.stringify(good().meta.statusRuns)]);
  equal((await db.query("select cupd from public.ps_kv where k='scout_tool_v1'")).rows[0].cupd>1,true,'restore SQL passes');
  // 9) 앞 가드가 이미 거부(return old)했으면 그대로 둔다
  await put(db,'scout_tool_v1',good({players:Array.from({length:10},(_,i)=>({id:'p'+i}))}));
  equal((await save(db,'scout_tool_v1',good({players:Array.from({length:20},(_,i)=>({id:'q'+i}))}))).accepted,false,'shape guard still rejects');
  // 10) 확인 질의 · 재실행 안전 · 되돌리기
  let v=(await db.query(verify)).rows[0];
  equal(v.triggers,'ps_00b_shape_guard_t:O · ps_00c_scout_record_guard_t:O','trigger order');equal(v.secdef,true,'security definer');
  await db.exec(sql);v=(await db.query(verify)).rows[0];equal(v.triggers,'ps_00b_shape_guard_t:O · ps_00c_scout_record_guard_t:O','rerun safe');
  await db.exec(rollback);v=(await db.query(verify)).rows[0];equal(v.triggers,'ps_00b_shape_guard_t:O','rollback removes trigger');equal(v.secdef,null,'rollback removes function');
  await put(db,'scout_tool_v1',good());
  equal((await save(db,'scout_tool_v1',wiped)).accepted,true,'after rollback: old behaviour');
  console.log('20261006_scout_record_guard local test: '+passed+' passed');
}
run().catch(e=>{console.error(e);process.exit(1);});
