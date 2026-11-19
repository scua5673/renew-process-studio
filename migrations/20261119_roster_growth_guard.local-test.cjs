/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261119_roster_growth_guard.local-test.cjs
 * 기준본(이 묶음이 이미 든 모습) → rollback 으로 «적용 전» → 적용 → 두 번 적용 → 되돌리기 → 다시 적용.
 * ① 적용 전: 옛 14명을 새 59명으로 갈아 끼운 저장이 «중복 의심»으로 막힌다(제보 d543557f)
 * ② 적용 뒤: 그 저장은 통과 · 같은 이름 + 등번호가 되풀이된 «2배»는 그대로 막힘 · 이름 없는 줄 불리기 · 깨진 본문 · 0명 · 경기 점수 규칙 · 작은 팀 · 1.6배 이하 그대로
 * ③ 예상과 다른 운영(본문이 다른 함수 · 트리거 없음)에서는 아무것도 바꾸지 않고 멈춤. */
'use strict';
const assert=require('node:assert/strict');
const H=require('./20261110_local_harness.cjs');
const NAME='20261119_roster_growth_guard';
const sql=H.read(NAME+'.sql'),verify=H.read(NAME+'.verify.sql'),rollback=H.read(NAME+'.rollback.sql'),preflight=H.read(NAME+'.preflight.sql');
const OLD='fd40ab18d81f34de23f9dd578724c7ee';
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const ok=(v,label)=>{assert.ok(v,label);passed++;};
const P=(n,from=0,f=i=>({id:'p'+i,name:'선수'+i,num:String(i)}))=>Array.from({length:n},(_,i)=>f(from+i));
const doc=players=>JSON.stringify({name:'팀',players});

(async()=>{
  const db=await H.open();
  const q=async(s,p)=>(await db.query(s,p)).rows;
  const md5=async()=>(await q("select md5(prosrc) m from pg_proc where oid='public.ps_kv_shape_guard()'::regprocedure"))[0].m;
  const owner=await H.user(db,1,'owner@real.test');
  const wid=(await H.attempt(db,'authenticated',owner,'select public.ps_create_team($1,null) id',['풋볼']))[0].id;
  let seq=0;
  /* 한 번의 저장: 옛 본문을 심고(트리거 끔 — 심기는 저장이 아니다) 주인이 새 본문으로 고친다. 돌려주는 것 = 저장 뒤 선수 수 · 거부 기록 수 */
  const save=async(k,before,after)=>{
    const key=k;seq++;
    await db.exec('alter table public.ps_kv disable trigger user');
    await db.query('delete from public.ps_kv where workspace_id=$1 and k=$2',[wid,key]);
    await db.query('insert into public.ps_kv(workspace_id,k,v,cupd) values($1,$2,$3,$4)',[wid,key,before,seq]);
    await db.exec('alter table public.ps_kv enable trigger user');
    await db.query('delete from public.ps_kv_denied where workspace_id=$1 and k=$2',[wid,key]);const d0=0;   /* 거부 기록은 (팀, 사람, 키)마다 한 줄 — 지우고 센다 */
    const r=await H.attempt(db,'authenticated',owner,'update public.ps_kv set v=$3, cupd=cupd+1 where workspace_id=$1 and k=$2',[wid,key,after]);
    assert.ok(typeof r!=='string',key+' update must not throw: '+r);
    const v=(await q('select v from public.ps_kv where workspace_id=$1 and k=$2',[wid,key]))[0].v;
    const d1=Number((await q('select count(*) n from public.ps_kv_denied where workspace_id=$1 and k=$2',[wid,key]))[0].n);
    return {kept:v===before,saved:v===after,denied:d1-d0};
  };
  const cases=async(applied)=>{
    const t=applied?'after':'before';
    /* 제보: 옛 14명(자리 표시) → 전혀 다른 59명 */
    for(const k of ['cs_squad_v1','scout_tool_v1']){
      const r=await save(k,doc(P(14)),doc(P(59,100)));
      equal(r,applied?{kept:false,saved:true,denied:0}:{kept:true,saved:false,denied:1},t+': 14 → 새 59명 '+k);
    }
    /* 옛 14명 그대로 + 새 45명 */
    equal((await save('cs_squad_v1',doc(P(14)),doc(P(14).concat(P(45,100))))).saved,applied,t+': 14 + 새 45명');
    /* 동명이인 둘(등번호 없음)이 섞인 큰 등록 */
    const twins=P(40,100).concat([{id:'a',name:'김민준'},{id:'b',name:'김민준'}]);
    equal((await save('cs_squad_v1',doc(P(14)),doc(twins))).saved,applied,t+': 동명이인이 있어도 큰 등록');
    /* «2배» — 같은 선수가 새 id 로 한 벌 더(옛 판 사고) */
    const twice=P(14).concat(P(14).map(p=>({...p,id:'x'+p.id})));
    equal(await save('scout_tool_v1',doc(P(14)),doc(twice)),{kept:true,saved:false,denied:1},t+': 2배 중복은 막는다');
    /* 세 벌 · 공백 · 대소문자만 다른 이름 */
    const thrice=P(12).concat(P(12).map(p=>({id:'y'+p.id,name:' '+p.name+' ',num:p.num})),P(12).map(p=>({id:'z'+p.id,name:p.name,num:p.num+' '})));
    equal((await save('cs_squad_v1',doc(P(12)),doc(thrice))).kept,true,t+': 3배 중복(공백 차이)은 막는다');
    /* 이름 없는 줄 불리기 · 선수 줄이 객체가 아닌 본문 */
    equal((await save('cs_squad_v1',doc(P(12)),doc(P(12).concat(P(30,50,i=>({id:'e'+i})))))).kept,true,t+': 이름 없는 줄 30개는 막는다');
    equal((await save('cs_squad_v1',doc(P(12)),doc(P(12).concat(Array(30).fill(7))))).kept,true,t+': 깨진 선수 줄은 막는다');
    /* 그대로여야 하는 것 */
    equal((await save('cs_squad_v1',doc(P(14)),doc(P(22)))).saved,true,t+': 1.6배 이하는 통과');
    equal((await save('cs_squad_v1',doc(P(9)),doc(P(9).concat(P(9).map(p=>({...p,id:'d'+p.id})))))).saved,true,t+': 10명 미만은 보지 않는다');
    equal(await save('cs_squad_v1',doc(P(14)),doc([])),{kept:true,saved:false,denied:1},t+': 0명은 막는다');
    equal((await save('cs_squad_v1',doc(P(14)),'{"players":')).saved,true,t+': 해석 못 하는 본문은 이 가드가 막지 않는다');
    const M=n=>JSON.stringify({matches:Array.from({length:6},(_,i)=>({id:i,scoreUs:i<n?'1':''}))});
    equal((await save('cs_team_matches_v1',M(6),M(2))).kept,true,t+': 경기 점수가 사라지는 저장은 막는다');
    equal((await save('cs_team_matches_v1',M(6),M(5))).saved,true,t+': 경기 점수 하나 지우기는 통과');
  };

  /* 기준본은 이미 적용된 모습 — verify 통과 */
  await db.exec(verify);passed++;
  await db.exec(rollback);equal(await md5(),OLD,'rollback → 기준본 전 본문');
  await db.exec(preflight);passed++;
  await cases(false);
  await db.exec(sql);await db.exec(verify);passed++;
  const applied=await md5();
  await cases(true);
  await db.exec(sql);equal(await md5(),applied,'두 번 적용해도 같다');await db.exec(verify);
  const acl=async()=>(await q("select proacl::text a, prosecdef d, proconfig::text c from pg_proc where oid='public.ps_kv_shape_guard()'::regprocedure"))[0];
  const a1=await acl();
  await db.exec(rollback);equal(await md5(),OLD,'되돌리기');equal(await acl(),a1,'권한 · 설정 그대로');
  await db.exec(sql);equal(await md5(),applied,'다시 적용');equal(await acl(),a1,'권한 · 설정 그대로(다시 적용)');

  /* 예상과 다른 운영 */
  await db.exec(rollback);
  await db.exec("create or replace function public.ps_kv_shape_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$ begin return new; end $$");
  const other=await md5();
  for(const [n,s] of [['sql',sql],['preflight',preflight]]){
    let msg='';try{await db.exec(s);}catch(e){msg=e.message;try{await db.exec('ROLLBACK');}catch(_){}}
    ok(/예상\(기준본\)과 다릅니다/.test(msg),n+': 본문이 다르면 멈춘다 — '+msg);
  }
  equal(await md5(),other,'아무것도 바꾸지 않았다');
  await db.exec(rollback);
  await db.exec('drop trigger ps_00b_shape_guard_t on public.ps_kv');
  {let msg='';try{await db.exec(sql);}catch(e){msg=e.message;try{await db.exec('ROLLBACK');}catch(_){}}
   ok(/트리거 ps_00b_shape_guard_t 가 예상과 다릅니다/.test(msg),'트리거가 없으면 멈춘다 — '+msg);equal(await md5(),OLD,'트리거 없음: 바꾸지 않았다');}
  console.log(NAME+' local test: '+passed+' passed');
  await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
