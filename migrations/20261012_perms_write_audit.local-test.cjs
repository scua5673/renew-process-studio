/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261012_perms_write_audit.local-test.cjs
 * 20261012_perms_write_audit.preflight.sql(권한 문서를 권한 없는 사람이 쓴 판 찾기)를 합성 판 역사 위에서 시험한다.
 * 운영에는 이 시험이 통과한 글자 그대로를 SQL 편집기에 붙인다 — 읽기만 한다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const audit=fs.readFileSync(path.join(__dirname,'20261012_perms_write_audit.preflight.sql'),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const OWNER=id(1),EXEC=id(2),P1=id(3),P2=id(4),P3=id(5),P4=id(6),P5=id(7);
const W1=id(101),W2=id(102),W3=id(103),W4=id(104),W5=id(105);
let passed=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const doc=(members,extra)=>JSON.stringify({members:Object.fromEntries(Object.entries(members).map(([k,r])=>[k,{role:r}])),defaultRole:'player',...(extra||{})});

(async()=>{
  const db=new PGlite();
  await db.exec(`
    create table public.ps_workspaces(id uuid primary key, name text, kind text not null default 'team', owner_id uuid);
    create table public.ps_kv(workspace_id uuid not null, k text not null, v text, cupd bigint, primary key(workspace_id,k));
    create table public.ps_kv_history(id bigint primary key, workspace_id text not null, k text not null, v text, cupd bigint, operation text not null default 'update', changed_by uuid, changed_at timestamptz);
  `);
  for(const w of [W1,W2,W3,W4,W5])await db.query('insert into ps_workspaces(id,name,owner_id) values($1,$2,$3)',[w,'합성 팀',OWNER]);
  let hid=0;
  const put=async(w,by,at,v)=>db.query('insert into ps_kv_history(id,workspace_id,k,v,changed_by,changed_at) values($1,$2,$3,$4,$5,$6)',[++hid,w,'cs_perms_v1',v,by,at]);
  const now=async(w,v)=>db.query('insert into ps_kv(workspace_id,k,v,cupd) values($1,$2,$3,1)',[w,'cs_perms_v1',v]);
  // W1 — 선수 P1 이 자기를 임원으로 올렸고, 지금도 임원
  await put(W1,OWNER,'2026-09-20T10:00Z',doc({[P1]:'player'}));
  await put(W1,P1,'2026-10-01T10:00Z',doc({[P1]:'executive'}));
  await now(W1,doc({[P1]:'executive'}));
  // W2 — 임원 EXEC 가 P2 를 올린 것은 정상. 그 뒤 P2(이제 임원)의 쓰기도 정상
  await put(W2,OWNER,'2026-09-20T10:00Z',doc({[EXEC]:'executive',[P2]:'player'}));
  await put(W2,EXEC,'2026-09-25T10:00Z',doc({[EXEC]:'executive',[P2]:'executive'}));
  await put(W2,P2,'2026-09-26T10:00Z',doc({[EXEC]:'executive',[P2]:'executive'},{note:'x'}));
  await now(W2,doc({[EXEC]:'executive',[P2]:'executive'}));
  // W3 — 선수 P3 가 권한 문서를 썼지만 누구도 올리지 않았다(옛 사본 덮기 — 10/5 사고와 같은 모양)
  await put(W3,OWNER,'2026-09-20T10:00Z',doc({[P3]:'player'}));
  await put(W3,P3,'2026-10-05T10:00Z',doc({}));
  await now(W3,doc({[P3]:'player'}));
  // W4 — 앞 판의 내용이 30일이 지나 비었다: 판정할 수 없다(승격으로 세지 않는다)
  await put(W4,OWNER,'2026-08-20T10:00Z',null);
  await put(W4,P4,'2026-10-02T10:00Z',doc({[P4]:'executive'}));
  await now(W4,doc({[P4]:'executive'}));
  // W5 — 선수 P5 가 스스로 올렸다가 소유자가 되돌렸다(지금은 선수) · 깨진 문서('undefined')도 섞인다
  await put(W5,OWNER,'2026-09-20T10:00Z','undefined');
  await put(W5,OWNER,'2026-09-21T10:00Z',doc({[P5]:'player'}));
  await put(W5,P5,'2026-09-28T10:00Z',doc({[P5]:'admin'}));
  await put(W5,OWNER,'2026-09-29T10:00Z',doc({[P5]:'player'}));
  await now(W5,'undefined');

  const before=(await db.query('select count(*)::int n from ps_kv_history')).rows[0].n;
  const results=await db.exec(audit);
  const [summary,detail,range]=results.filter(r=>r.fields&&r.fields.length);
  equal((await db.query('select count(*)::int n from ps_kv_history')).rows[0].n,before,'읽기만 한다');

  const S=Object.fromEntries(summary.rows.map(r=>[r.workspace_id,{u:Number(r.unauthorized_writes),raised:Number(r.raised_to_executive),still:Number(r.still_executive_now)}]));
  equal(S[W1],{u:1,raised:1,still:1},'W1: 스스로 올린 선수 — 지금도 임원');
  equal(S[W2],undefined,'W2: 임원이 올린 것과 그 뒤 쓰기는 정상');
  equal(S[W3],{u:1,raised:0,still:0},'W3: 권한 없는 쓰기지만 승격은 없다');
  equal(S[W4],undefined,'W4: 앞 판 내용이 없으면 판정하지 않는다');
  equal(S[W5],{u:1,raised:1,still:0},'W5: 올렸다가 되돌려졌고, 지금 문서가 깨져 있어도 «아직 유효» 로 세지 않는다');
  equal(summary.rows[0].workspace_id,W1,'아직 유효한 승격이 있는 팀이 위로');

  equal(detail.rows.map(r=>[r.workspace_id,r.changed_by,r.raised_member,r.raised_self,r.writer_role_before,r.role_before,r.role_after,r.role_now]),[
    [W5,P5,P5,true,'player','player','admin','(없음)'],
    [W1,P1,P1,true,'player','player','executive','executive'],
  ],'상세: 누가 언제 누구를 올렸고 지금 역할은 무엇인가 — 시간순');
  equal(Object.keys(detail.rows[0]).some(k=>/name|email|v$/.test(k)),false,'이름·이메일·본문은 내지 않는다');

  equal({rows:Number(range.rows[0].rows_total),empty:Number(range.rows[0].rows_without_content)},{rows:13,empty:1},'판정 범위 — 내용 없는 판을 센다');
  console.log('20261012_perms_write_audit local test: '+passed+' checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
