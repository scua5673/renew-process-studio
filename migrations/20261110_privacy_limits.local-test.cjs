/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261110_privacy_limits.local-test.cjs
 * 기준본(운영에서 받은 실제 구조) + 20261028_admin_client_versions + 20261110_invite_hardening 위에서
 * ① 적용 전: 선수가 팀원 이메일을 본다 · 그림을 통째로 훑고 올린 사람을 꾸민다 · 로그인 없이 긴 글 · 꾸민 신고 · '99.999' 한 줄로 «가장 새 판»이 바뀐다 ·
 *    계정 삭제 뒤에도 IDP · 권한 항목 · 이벤트 · 제보 · 공유 · 보관함이 남고 소유자가 나가면 팀이 주인 없이 남는다 · anon 이 TRUNCATE 한다 · 소유자가 kind 를 바꾼다
 * ② 적용 뒤: 막혔고, 선수 화면이 읽는 것(이름 · 내 줄 · 팀 문서 · 해시로 그림) · 코치 올리기 · 비로그인 오류 기록/신고 · 관리자 화면은 그대로
 * ③ 두 번 적용 · 되돌리기(함수 md5 · 정책 · 권한 · 트리거 · 검사까지 같게) · 다시 적용 · 예상과 다른 운영에서는 아무것도 바꾸지 않고 멈춤. */
'use strict';
const assert=require('node:assert/strict');
const H=require('./20261110_local_harness.cjs');
const NAME='20261110_privacy_limits';
const sql=H.read(NAME+'.sql'),verify=H.read(NAME+'.verify.sql'),rollback=H.read(NAME+'.rollback.sql'),preflight=H.read(NAME+'.preflight.sql');
const INVITE=H.read('20261110_invite_hardening.sql'),INVITE_RB=H.read('20261110_invite_hardening.rollback.sql'),VERSIONS=H.read('20261028_admin_client_versions.sql');
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const ok=(v,label)=>{assert.ok(v,label);passed++;};
const hex=n=>n.toString(16).padStart(32,'0');
const last=r=>r[r.length-1].rows;

async function world(db){
  const u={};let n=0;
  for(const k of ['owner','exec','staff','player','p2','gone','solo','boss','mate','admin','a','b','c','spoof','quota'])u[k]=await H.user(db,++n,k+'@real.test');
  const q=async(s,p)=>(await db.query(s,p)).rows;
  const val=async(uid,s,p)=>{const r=await H.attempt(db,uid?'authenticated':'anon',uid,s,p);return typeof r==='string'?r:Object.values(r[0]||{})[0];};
  const rows=(uid,s,p)=>H.attempt(db,uid?'authenticated':'anon',uid,s,p);
  const run=async(uid,s,p)=>{const r=await H.attempt(db,uid?'authenticated':'anon',uid,s,p);return typeof r==='string'?r:'ok';};
  const dry=(uid,s,p)=>H.attempt(db,uid?'authenticated':'anon',uid,s,p,{commit:false});
  const perms=async wid=>JSON.parse((await q("select v from public.ps_kv where workspace_id=$1 and k='cs_perms_v1'",[wid]))[0].v);
  const team=async(owner,name)=>val(owner,'select public.ps_create_team($1,null)',[name]);
  const join=async(wid,owner,uid,role)=>{const c=await val(owner,'select public.ps_get_or_create_role_invite($1,$2)',[wid,role]);equal(await val(uid,'select public.ps_join($1,null)',[c]),wid,'setup: join '+role);};
  await db.query('insert into public.ps_admins(user_id) values($1)',[u.admin]);
  return {u,q,val,rows,dry,run,perms,team,join};
}
/* 지울 사람(uid)의 자취를 표마다 하나씩 */
async function footprint(db,w,wid,uid,tag){
  const {q}=w;
  await q("insert into public.ps_kv(workspace_id,k,v,cupd) values($1,$2,'{\"log\":{}}',1),($1,$3,'{\"reacts\":{}}',1)",[wid,'cs_idp_v1_'+uid,'cs_idp_pub_v1_'+uid]);
  await q("update public.ps_kv set v='{\"log\":{\"d\":1}}',cupd=2 where workspace_id=$1 and k=$2",[wid,'cs_idp_v1_'+uid]);   // 판 역사 한 줄
  await q("insert into public.ps_events(user_id,event_name,app_version) values($1,'boot','3.271')",[uid]);
  await q("insert into public.ps_usage(day,user_id,feature) values(current_date,$1,'app')",[uid]);
  await q("insert into public.ps_support_reports(id,reporter_id,title,body) values($1,$2,'제목','본문')",[H.uuid(900000+tag),uid]);
  await q("insert into public.ps_support_replies(id,report_id,actor_id,author_role,body) values($1,$2,$3,'reporter','답')",[H.uuid(910000+tag),H.uuid(900000+tag),uid]);
  await q("insert into public.ps_share(id,v,created_by,workspace_id) values($1,'{}',$2,$3)",['share'+tag,uid,wid]);
  await q("insert into public.ps_library(workspace_id,lib_id,name,item,owner_id,private) values($1,$2,'나만','{}',$3,true),($1,$4,'팀과','{}',$3,false)",[wid,'priv'+tag,uid,'team'+tag]);
  await q("insert into public.ps_blob(workspace_id,h,v,created_by) values($1,$2,'data',$3)",[wid,hex(700000+tag),uid]);
  await q("insert into public.ps_sync_reports(user_id,device_id,workspace_id,report_seq,device_class,app_version,online,busy) values($1,$2,$3,1,'desktop','3.271',true,false)",[uid,H.uuid(920000+tag),wid]);
  await q("insert into public.ps_handles(uid,handle) values($1,$2)",[uid,'handle'+tag]);
  await q("insert into public.ps_comm_reports(pub_id,reporter,reason) values('post1',$1,'')",[uid]);
  await q("insert into public.ps_kv_denied(workspace_id,user_id,k,reason) values($1,$2,'x','r')",[wid,uid]);
  await q("insert into public.ps_join_attempts(user_id,fails) values($1,1)",[uid]);
}
const leftovers=async(w,wid,uid)=>{const {q}=w,n=async(s,p)=>Number((await q(s,p))[0].n);return {
  idp:await n("select count(*) n from public.ps_kv where k like '%'||$1",[uid]),
  idp_history:await n("select count(*) n from public.ps_kv_history where k like '%'||$1",[uid]),
  perms_entry:await n("select count(*) n from public.ps_kv where k='cs_perms_v1' and v like '%'||$1||'%'",[uid]),
  perms_history:await n("select count(*) n from public.ps_kv_history where k='cs_perms_v1' and v like '%'||$1||'%'",[uid]),
  members:await n('select count(*) n from public.ps_members where user_id=$1',[uid]),
  events:await n('select count(*) n from public.ps_events where user_id=$1',[uid]),
  usage:await n('select count(*) n from public.ps_usage where user_id=$1',[uid]),
  support:await n('select count(*) n from public.ps_support_reports where reporter_id=$1',[uid]),
  replies:await n('select count(*) n from public.ps_support_replies where actor_id=$1',[uid]),
  share:await n('select count(*) n from public.ps_share where created_by=$1',[uid]),
  library_owned:await n('select count(*) n from public.ps_library where owner_id=$1',[uid]),
  blob_by:await n('select count(*) n from public.ps_blob where created_by=$1',[uid]),
  sync_reports:await n('select count(*) n from public.ps_sync_reports where user_id=$1',[uid]),
  handles:await n('select count(*) n from public.ps_handles where uid=$1',[uid]),
  reports_by:await n('select count(*) n from public.ps_comm_reports where reporter=$1',[uid]),
  denied:await n('select count(*) n from public.ps_kv_denied where user_id=$1',[uid]),
  attempts:await n('select count(*) n from public.ps_join_attempts where user_id=$1',[uid]),
  audit:await n("select count(*) n from public.ps_audit where user_id=$1 or k like '%'||$1",[uid]),
  history_by:await n('select count(*) n from public.ps_kv_history where changed_by=$1',[uid]),
};};
const CLEAN={idp:0,idp_history:0,perms_entry:0,perms_history:0,members:0,events:0,usage:0,support:0,replies:0,share:0,library_owned:0,blob_by:0,sync_reports:0,handles:0,reports_by:0,denied:0,attempts:0,audit:0,history_by:0};
const FNS=['ps_members_of','ps_members_of_v2','ps_delete_my_data','ps_support_reporter_devices','ps_admin_stale_clients','ps_perms_authorised_doc'];
const snapshot=async db=>{const q=async s=>(await db.query(s)).rows;return {
  fns:await q(`select proname,md5(prosrc) m from pg_proc where pronamespace='public'::regnamespace and proname in (${FNS.map(f=>`'${f}'`).join(',')}) order by 1`),
  new_fns:await q("select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('ps_rate_bump','ps_err_guard','ps_comm_report_guard','ps_blob_guard','ps_workspace_fixed_guard','ps_latest_app_version') order by 1"),
  policy:await q("select polname,pg_get_expr(polqual,polrelid) q from pg_policy where polrelid='public.ps_members'::regclass order by 1"),
  grants:await q("select grantee,table_name,string_agg(privilege_type,',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by 1,2 order by 1,2"),
  triggers:await q("select tgrelid::regclass::text t,tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text in ('ps_err','ps_comm_reports','ps_blob','ps_workspaces') order by 1,2"),
  checks:await q("select conrelid::regclass::text t,conname from pg_constraint where contype='c' and conrelid::regclass::text in ('ps_err','ps_comm_reports','ps_events') order by 1,2"),
  tables:await q("select to_regclass('public.ps_rate_counters')::text a,to_regclass('public.ps_account_deletions')::text b,to_regclass('public.ps_blob_created_by_at_idx')::text c"),
};};

async function main(){
  const db=await H.open();
  try{
    await db.exec(VERSIONS);await db.exec(INVITE);
    const w=await world(db),{u,q,val,rows,dry,run}=w;
    const wid=await w.team(u.owner,'합성 팀');
    await w.join(wid,u.owner,u.exec,'executive');await w.join(wid,u.owner,u.staff,'staff');
    for(const k of ['player','p2','gone'])await w.join(wid,u.owner,u[k],'player');
    await w.join(wid,u.owner,u.spoof,'player');await w.join(wid,u.owner,u.quota,'player');
    await q("update public.ps_members set name=case user_id when $2 then '김코치' when $3 then '박선수' end where workspace_id=$1 and user_id in ($2,$3)",[wid,u.staff,u.player]);
    await q("insert into public.ps_kv(workspace_id,k,v,cupd) values($1,'cs_team_notice_v1','{\"n\":1}',1),($1,$2,'{\"log\":{}}',1)",[wid,'cs_idp_v1_'+u.player]);
    await q("insert into public.ps_blob(workspace_id,h,v,created_by) values($1,$2,'schedule-image',$4),($1,$3,'private-library-photo',$4)",[wid,hex(1),hex(2),u.staff]);
    const wBoss=await w.team(u.boss,'보스 팀');await w.join(wBoss,u.boss,u.mate,'player');
    const wSolo=await w.team(u.solo,'혼자 팀');
    await val(u.solo,'select count(*) from public.ps_bootstrap(null)');
    const soloPersonal=(await q("select w.id from public.ps_workspaces w where w.owner_id=$1 and w.kind='personal'",[u.solo]))[0].id;
    await q("insert into public.ps_kv(workspace_id,k,v,cupd) values($1,'cs_drill_lib_v1','{}',1)",[soloPersonal]);
    await q("update public.ps_kv set v='{\"a\":1}',cupd=2 where workspace_id=$1",[soloPersonal]);
    for(const k of ['a','b','c'])await q("insert into public.ps_events(user_id,event_name,app_version,device) values($1,'boot','3.271','desktop'),($1,'boot','3.240','mobile')",[u[k]]);
    await q("insert into public.ps_support_reports(id,reporter_id,title,body) values($1,$2,'제목','본문')",[H.uuid(990001),u.a]);
    const members=async uid=>rows(uid,'select user_id,name,email from public.ps_members_of_v2($1)',[wid]);
    const mail=(list,uid)=>list.find(r=>r.user_id===uid).email;

    // ══ 적용 전 ══
    equal(mail(await members(u.player),u.staff),'staff@real.test','before 4: a player is given a coach’s e-mail by ps_members_of_v2');
    equal((await rows(u.player,'select email from public.ps_members where workspace_id=$1 and user_id=$2',[wid,u.owner])),[{email:'owner@real.test'}],'before 4: …and reads any member’s e-mail straight from the table');
    equal((await rows(u.player,'select h from public.ps_blob where workspace_id=$1 order by h',[wid])).length,2,'before 5: a player lists every blob of the team without knowing a hash');
    equal(await dry(u.player,'insert into public.ps_blob(workspace_id,h,v,created_by) values($1,$2,$3,null) returning created_by',[wid,hex(50),'x'.repeat(1000)]),[{created_by:null}],'before 5: …and uploads with the uploader column blanked (no attribution, no quota)');
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_err(kind,msg,t) values('x',repeat('A',1000000),'2099-01-01')"));
    equal(await q("select char_length(msg) n,t>now() future from public.ps_err"),[{n:1000000,future:true}],'before 6: anon stores a 1 MB error line dated 2099');
    await q('delete from public.ps_err');
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_comm_reports(pub_id,reporter,reason) values('post9',$1,repeat('R',200000))",[u.owner]));
    equal(await q("select reporter,char_length(reason) n from public.ps_comm_reports where pub_id='post9'"),[{reporter:u.owner,n:200000}],'before 6: anon files a 200 KB report in the owner’s name');
    await q("delete from public.ps_comm_reports where pub_id='post9'");
    equal(await run(u.spoof,"insert into public.ps_events(event_name,app_version,meta) values('boot','99.999',jsonb_build_object('pad',repeat('M',500000)))"),'ok','before 6: a user stores app_version 99.999 with a 500 KB meta');
    equal((await val(u.admin,'select public.ps_admin_stale_clients(48,20)')).latest,'#.###','before 6: …and that one row becomes the «latest version» (shown as #.### — the format overflows) — every real device looks stale');
    equal((await val(u.admin,'select public.ps_admin_stale_clients(48,20)')).clients.length,6,'before 6: all six real devices are listed as stale');
    equal((await val(u.admin,'select public.ps_support_reporter_devices($1,7)',[H.uuid(990001)])).latest,'#.###','before 6: same in the reporter-device view');
    await q('delete from public.ps_events where user_id=$1',[u.spoof]);
    equal(await dry(null,'truncate public.ps_err'),[],'before 8: anon can TRUNCATE a table (row security does not apply to TRUNCATE)');
    equal(await dry(u.owner,"update public.ps_workspaces set kind='personal' where id=$1 returning kind",[wid]),[{kind:'personal'}],'before 8: an owner can flip a team to «personal» (ps_team_role then calls every caller admin)');
    const before=await snapshot(db);

    // 계정 삭제(적용 전) — 별도 DB 를 쓰지 않으려 SAVEPOINT 안에서 보고 되돌린다
    await footprint(db,w,wid,u.gone,1);
    await w.join(wid,u.owner,u.c,'player');                           // 권한 문서가 한 번 더 바뀌어 gone 의 항목이 판 역사에도 있다
    await db.exec('BEGIN');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[u.gone]);await db.exec('SET LOCAL ROLE authenticated');
    await db.query('select public.ps_delete_my_data()');await db.exec('RESET ROLE');
    const left=await leftovers(w,wid,u.gone);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[u.boss]);await db.exec('SET LOCAL ROLE authenticated');
    await db.query('select public.ps_delete_my_data()');await db.exec('RESET ROLE');
    const orphan=(await db.query("select (select count(*)::int from public.ps_members m where m.workspace_id=$1) members,(select count(*)::int from public.ps_members m where m.workspace_id=$1 and m.role='owner') owners",[wBoss])).rows[0];
    await db.exec('ROLLBACK');
    if(process.env.PS_DEBUG)console.log(left);
    ok(left.idp===2&&left.idp_history>=1&&left.perms_entry===1&&left.events===1&&left.support===1&&left.share===1&&left.library_owned===2&&left.sync_reports===1,'before 7: after «delete my data» the IDP docs, their history, the permission entry, events, support report, share link, library rows and device reports are all still there');
    equal([left.members,left.handles,left.usage],[0,0,0],'before 7: (only membership, handle and usage pings were removed)');
    equal(orphan,{members:1,owners:0},'before 7: an owner deleting their data leaves the team ownerless with a member inside');

    // ══ 적용(두 번) + 확인 ══
    const pf=await db.exec(preflight);
    equal(pf[1].rows[0].applied_functions,0,'preflight: nothing applied yet');
    equal(Number(pf[1].rows[0].teams_whose_owner_cannot_self_delete),2,'preflight: counts the teams whose owner will be blocked from self-deletion');
    ok(pf[2].rows.find(r=>r.table_name==='ps_err').used_without_login.startsWith('INSERT')&&pf[2].rows.find(r=>r.table_name==='ps_kv').used_without_login.startsWith('없음'),'preflight: lists what anon holds next to what the logged-out flows use');
    await q('delete from public.ps_members where workspace_id=$1 and user_id=$2',[wSolo,u.solo]);
    equal(last(await db.exec(preflight)).map(r=>r.name),['혼자 팀'],'preflight: lists ownerless teams for the owner to decide on');
    await q("insert into public.ps_members(workspace_id,user_id,role) values($1,$2,'owner')",[wSolo,u.solo]);
    await db.exec(sql);await db.exec(sql);
    equal(last(await db.exec(verify))[0].result,'privacy_limits_verified','verify passes after applying twice');
    equal((await db.exec(preflight))[1].rows[0].applied_functions,12,'preflight after: six replaced + six new functions carry the marker');
    await assert.rejects(()=>db.exec(INVITE),/privacy_limits 가 이미 적용돼/,'bundle 1 refuses to run again');await db.exec('ROLLBACK');passed++;
    await assert.rejects(()=>db.exec(INVITE_RB),/rollback.sql 을 먼저/,'bundle 1 rollback refuses');await db.exec('ROLLBACK');passed++;

    // ── 4 · 이메일 ──
    const asPlayer=await members(u.player);
    equal(asPlayer.map(r=>r.email).filter(Boolean),['player@real.test'],'after 4: a player gets only their own e-mail from ps_members_of_v2');
    equal([asPlayer.length,asPlayer.find(r=>r.user_id===u.staff).name],[9,'김코치'],'after 4: …still gets every member and their names');
    equal((await members(u.staff)).map(r=>r.email).filter(Boolean),['staff@real.test'],'after 4: staff likewise');
    equal((await members(u.owner)).filter(r=>r.email).length,9,'after 4: the owner still sees every e-mail');
    equal((await members(u.exec)).filter(r=>r.email).length,9,'after 4: an executive still sees every e-mail');
    const v1=await rows(u.player,'select user_id,email from public.ps_members_of($1)',[wid]);
    equal([v1.find(r=>r.user_id===u.staff).email,v1.find(r=>r.user_id===u.owner).email,v1.find(r=>r.user_id===u.player).email],['김코치',null,'player@real.test'],'after 4: the old ps_members_of gives a name (or nothing) for others, the e-mail only for oneself');
    equal(mail(await rows(u.owner,'select user_id,email from public.ps_members_of($1)',[wid]),u.staff),'staff@real.test','after 4: …and unchanged for the owner');
    equal(await rows(u.player,'select user_id from public.ps_members where workspace_id=$1',[wid]),[{user_id:u.player}],'after 4: reading the table directly, a player sees only their own row');
    equal((await rows(u.exec,'select user_id from public.ps_members where workspace_id=$1',[wid])).length,9,'after 4: an executive reads the member table');
    ok(/not a member/.test(await val(u.a,'select count(*) from public.ps_members_of_v2($1)',[wid])),'after 4: a non-member is still refused');
    equal(await rows(u.a,'select user_id from public.ps_members where workspace_id=$1',[soloPersonal]),[],'after 4: a stranger reads nothing of someone’s personal workspace (ps_team_role says «admin» for any personal space — membership is checked first)');
    equal(await dry(u.owner,'delete from public.ps_members where workspace_id=$1 and user_id=$2 returning user_id',[wid,u.p2]),[{user_id:u.p2}],'after 4: the owner still removes a member (the app asks for the deleted row back)');
    // 선수 화면이 읽는 것
    equal((await rows(u.player,'select id,name,kind from public.ps_workspaces where id=$1',[wid])).length,1,'after: a player still reads the team workspace');
    equal(await rows(u.player,"select k from public.ps_kv where workspace_id=$1 and k in ('cs_team_notice_v1',$2) order by k",[wid,'cs_idp_v1_'+u.player]),[{k:'cs_idp_v1_'+u.player},{k:'cs_team_notice_v1'}],'after: a player still reads the team notice and their own IDP');
    equal((await rows(u.player,'select count(*)::int n from public.ps_bootstrap(null)'))[0].n,2,'after: ps_bootstrap still lists the player’s workspaces (personal + team)');

    // ── 5 · 그림 ──
    equal(await rows(u.player,`select h,v from public.ps_blob where workspace_id=$1 and h=any($2)`,[wid,[hex(1)]]),[{h:hex(1),v:'schedule-image'}],'after 5: a player still pulls a schedule image by hash (sync.js blob_pull)');
    equal(await rows(u.player,'insert into public.ps_blob(workspace_id,h,v,created_by) values($1,$2,$3,null) returning created_by',[wid,hex(60),'own-photo']),[{created_by:u.player}],'after 5: the server writes the uploader — it cannot be blanked or forged');
    equal(await rows(u.staff,'insert into public.ps_blob(workspace_id,h,v) values($1,$2,$3),($1,$4,$3) on conflict (workspace_id,h) do nothing returning h',[wid,hex(1),'dup',hex(61)]),[{h:hex(61)}],'after 5: a coach upload with ignore-duplicates works as before');
    await q("insert into public.ps_blob(workspace_id,h,v,created_by,created_at) select $1,lpad(to_hex(g+1000),32,'0'),'x',$2,now()-interval '1 hour' from generate_series(1,1499) g",[wid,u.quota]);
    equal((await rows(u.quota,'insert into public.ps_blob(workspace_id,h,v) values($1,$2,$3) returning h',[wid,hex(70),'x'])).length,1,'after 5: upload number 1,500 in 24 hours goes through');
    ok(/blob daily quota/.test(await val(u.quota,'insert into public.ps_blob(workspace_id,h,v) values($1,$2,$3) returning h',[wid,hex(71),'x'])),'after 5: number 1,501 is refused (42501 → 403: the app falls back to inline pictures for the session)');
    equal((await rows(u.staff,'insert into public.ps_blob(workspace_id,h,v) values($1,$2,$3) returning h',[wid,hex(72),'x'])).length,1,'after 5: the quota is per person');
    await q("update public.ps_blob set created_at=now()-interval '25 hours' where created_by=$1 and h<>$2",[u.quota,hex(70)]);
    equal((await rows(u.quota,'insert into public.ps_blob(workspace_id,h,v) values($1,$2,$3) returning h',[wid,hex(71),'x'])).length,1,'after 5: …and rolls off after 24 hours');

    // ── 6 · 로그인 없는 쓰기 ──
    const batch=Array.from({length:30},(_,i)=>({t:new Date(Date.now()-i*1000).toISOString(),kind:'error',msg:'TypeError: x is undefined '+'가'.repeat(270),src:'board.html',line:16826,page:'board.html',ua:'Mozilla/5.0 '.repeat(10)}));
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_err(t,kind,msg,src,line,page,ua) select x.t,x.kind,x.msg,x.src,x.line,x.page,x.ua from jsonb_to_recordset($1::jsonb) as x(t timestamptz,kind text,msg text,src text,line int,page text,ua text)",[JSON.stringify(batch)]));
    equal(Number((await q('select count(*) n from public.ps_err'))[0].n),30,'after 6: the app’s error batch (30 lines, 300-char messages, anon key) is stored as before');
    ok(/ps_err_len_chk/.test(await val(null,"insert into public.ps_err(kind,msg) values('x',repeat('A',2001))")),'after 6: an over-long error line is refused');
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_err(kind,msg,t) values('x','future','2099-01-01'),('x','ancient','2001-01-01')"));
    equal(Number((await q("select count(*) n from public.ps_err where msg in ('future','ancient') and t between now()-interval '1 minute' and now()+interval '1 minute'"))[0].n),2,'after 6: a timestamp far in the future or past is replaced by the server time');
    await q("update public.ps_rate_counters set n=4999 where bucket='err'");
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_err(kind,msg) values('x','cap1'),('x','cap2'),('x','cap3')"));
    equal((await q("select msg from public.ps_err where msg like 'cap%'")),[{msg:'cap1'}],'after 6: past 5,000 lines a day further lines are dropped without an error (the app would otherwise resend the batch forever)');
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_comm_reports(pub_id,reporter,reason) values('post9',$1,'')",[u.owner]));
    equal(await q("select reporter from public.ps_comm_reports where pub_id='post9'"),[{reporter:null}],'after 6: a logged-out report is stored with no reporter even when one is sent');
    await H.as(db,'authenticated',u.player,d=>d.query("insert into public.ps_comm_reports(pub_id,reporter,reason,resolved_at) values('post10',$1,'',now())",[u.owner]));
    equal(await q("select reporter,resolved_at from public.ps_comm_reports where pub_id='post10'"),[{reporter:u.player,resolved_at:null}],'after 6: a signed-in report carries the caller’s own id — it cannot be filed in someone else’s name or pre-resolved');
    ok(/ps_comm_reports_len_chk/.test(await val(u.player,"insert into public.ps_comm_reports(pub_id,reason) values('post10',repeat('R',501))")),'after 6: an over-long reason is refused');
    for(let i=0;i<32;i++)await H.as(db,'authenticated',u.p2,d=>d.query("insert into public.ps_comm_reports(pub_id,reason) values($1,'')",['flood'+i]));
    equal(Number((await q('select count(*) n from public.ps_comm_reports where reporter=$1',[u.p2]))[0].n),30,'after 6: one account files at most 30 reports a day (the rest are dropped quietly)');
    await q("update public.ps_rate_counters set n=300 where bucket='rep:anon'");
    await H.as(db,'anon',null,d=>d.query("insert into public.ps_comm_reports(pub_id,reason) values('post11','')"));
    equal(await q("select 1 from public.ps_comm_reports where pub_id='post11'"),[],'after 6: logged-out reports share a cap of 300 a day');
    await q("insert into public.ps_rate_counters(bucket,day,n) values('old',current_date-30,5)");
    await H.as(db,'authenticated',u.staff,d=>d.query("insert into public.ps_comm_reports(pub_id,reason) values('post12','')"));
    equal(await q("select 1 from public.ps_rate_counters where bucket='old'"),[],'after 6: counters older than a week are swept when a new bucket starts (retention without cron)');
    equal(await rows(u.player,'select * from public.ps_rate_counters'),'ERR: permission denied for table ps_rate_counters','after 6: clients cannot read or reset the counters');
    // 이벤트
    const meta={stage:'sync:pull',msg:'가'.repeat(120),reason:'r'.repeat(80),code:'c'.repeat(80),mode:'m'.repeat(80),format:'f'.repeat(80),source:'s'.repeat(80),name:'n'.repeat(80),ua:'u'.repeat(140),n:1,kb:2,maxKb:3};
    equal(await run(u.player,"insert into public.ps_events(event_name,app_version,meta) values('sync_stalled','3.271',$1)",[JSON.stringify(meta)]),'ok','after 6: the largest meta the app can build (12 fields, safeEventMeta) is stored');
    for(const v of ['unknown','3.271','2026.07.26-v229'])equal(await run(u.player,"insert into public.ps_events(event_name,app_version) values('boot',$1)",[v]),'ok',`after 6: app_version «${v}» is accepted`);
    ok(/ps_events_meta_size_chk/.test(await val(u.spoof,"insert into public.ps_events(event_name,meta) values('boot',jsonb_build_object('pad',repeat('M',9000)))")),'after 6: a meta over 8 KB is refused');
    ok(/ps_events_app_version_chk/.test(await val(u.spoof,"insert into public.ps_events(event_name,app_version) values('boot','<script>')")),'after 6: an app_version that is not a version string is refused');
    equal(await run(u.spoof,"insert into public.ps_events(event_name,app_version) values('boot','99.999')"),'ok','after 6: 99.999 has a valid shape and is stored …');
    const stale=await val(u.admin,'select public.ps_admin_stale_clients(48,20)');
    equal([stale.latest,stale.clients.length,stale.clients.every(c=>c.app_version==='3.240')],['3.271',3,true],'after 6: … but «latest» is the newest version at least three people run — only the three really old devices are listed');
    equal((await val(u.admin,'select public.ps_support_reporter_devices($1,7)',[H.uuid(990001)])).latest,'3.271','after 6: same in the reporter-device view');
    ok(/admin_required/.test(await val(u.player,'select public.ps_admin_stale_clients(48,20)')),'after 6: the admin check is unchanged');
    await q("delete from public.ps_events where app_version in ('3.271','3.240') and user_id in ($1,$2)",[u.b,u.c]);
    equal((await val(u.admin,'select public.ps_admin_stale_clients(48,20)')).latest,'3.271','after 6: with too few users for a quorum (two people on 3.271, one on 3.240, one on 99.999) the most-used version wins — never the lone 99.999');

    // ── 8 · 권한 · 워크스페이스 ──
    ok(/permission denied/.test(await dry(null,'truncate public.ps_err')),'after 8: anon cannot TRUNCATE');
    ok(/permission denied/.test(await dry(u.player,'truncate public.ps_kv')),'after 8: nor can a signed-in user');
    ok(/permission denied/.test(await dry(null,"insert into public.ps_kv(workspace_id,k,v) values($1,'x','y')",[wid])),'after 8: anon has no write privilege left on team documents');
    equal((await rows(null,'select id from public.ps_community limit 1')).length,0,'after 8: anon still reads the community table');
    equal(await rows(u.owner,"update public.ps_workspaces set name='새 이름' where id=$1 returning name",[wid]),[{name:'새 이름'}],'after 8: the owner still renames the team');
    ok(/kind and owner cannot be changed/.test(await val(u.owner,"update public.ps_workspaces set kind='personal' where id=$1 returning kind",[wid])),'after 8: …but cannot change its kind');
    ok(/kind and owner cannot be changed/.test(await val(u.owner,'update public.ps_workspaces set owner_id=$2 where id=$1 returning id',[wid,u.player])),'after 8: …nor hand it to someone else through the table');
    equal((await q('update public.ps_workspaces set owner_id=owner_id where id=$1 returning id',[wid])).length,1,'after 8: SQL editor / service role is not affected');

    // ── 7 · 계정 삭제 ──
    const blocked=await val(u.boss,'select public.ps_delete_my_data()');
    ok(/ps_delete_owner_blocked/.test(blocked),'after 7: the owner of a team that still has members is stopped (409 ps_delete_owner_blocked)');
    equal(Number((await q('select count(*) n from public.ps_members where user_id=$1',[u.boss]))[0].n),1,'after 7: …and nothing of theirs was removed');
    ok(/ps_delete_admin_blocked/.test(await val(u.admin,'select public.ps_delete_my_data()')),'after 7: a service admin account is stopped');
    ok(/not authenticated/.test(await val(null,'select public.ps_delete_my_data()')),'after 7: anon is refused');
    // 가드: 팀에 남은 채 표식만 꾸며 제 항목을 지울 수는 없다
    const forged=await H.as(db,'postgres',u.player,async d=>{await d.query("select set_config('ps.self_delete',$1,true)",[u.player]);
      const doc=await w.perms(wid);delete doc.members[u.player];
      await d.query("update public.ps_kv set v=$2 where workspace_id=$1 and k='cs_perms_v1'",[wid,JSON.stringify(doc)]);
      return (await d.query("select v from public.ps_kv where workspace_id=$1 and k='cs_perms_v1'",[wid])).rows[0].v;});
    ok(JSON.parse(forged).members[u.player],'after 7: the guard ignores a forged ps.self_delete marker from someone who is still a member');
    // 선수 gone (강제 모드) — 표마다
    const otherIdp='cs_idp_v1_'+u.player;
    equal(await val(u.gone,'select public.ps_delete_my_data()'),'','after 7: a player deletes their account data (guard enforce=true)');
    equal(await leftovers(w,wid,u.gone),CLEAN,'after 7: nothing keyed by that user is left — IDP docs and their history, permission entry (and its history), events, support, share, device reports, handle, reporter id, denied rows, audit');
    equal(await q("select lib_id,owner_id,private from public.ps_library where workspace_id=$1 order by lib_id",[wid]),[{lib_id:'team1',owner_id:null,private:false}],'after 7: the private library item is gone; the one shared with the team stays, without an owner');
    equal(await q('select created_by from public.ps_blob where h=$1',[hex(700001)]),[{created_by:null}],'after 7: the picture stays for the team (content-addressed), uploader cleared');
    equal(await q("select reporter from public.ps_comm_reports where pub_id='post1'"),[{reporter:null}],'after 7: their community report stays for moderation, anonymised');
    equal(Object.keys((await w.perms(wid)).members).length,7,'after 7: the other seven permission entries are untouched');
    equal((await q('select 1 from public.ps_kv where workspace_id=$1 and k=$2',[wid,otherIdp])).length,1,'after 7: another player’s IDP is untouched');
    equal(await q('select user_id,done_at from public.ps_account_deletions'),[{user_id:u.gone,done_at:null}],'after 7: the account is queued for the admin to delete from auth.users');
    equal(await rows(u.gone,'select * from public.ps_account_deletions'),'ERR: permission denied for table ps_account_deletions','after 7: clients cannot read the queue');
    // 혼자인 소유자: 팀 · 개인 공간 통째로, 판 역사까지
    equal(await val(u.solo,'select public.ps_delete_my_data()'),'','after 7: an owner who is alone in their team deletes their account');
    equal(await q('select id from public.ps_workspaces where id in ($1,$2)',[wSolo,soloPersonal]),[],'after 7: …their team and personal workspace are gone');
    equal(Number((await q('select count(*) n from public.ps_kv_history where workspace_id in ($1,$2)',[wSolo,soloPersonal]))[0].n),0,'after 7: …including the version history of their documents (it used to stay for 90 days)');
    // 막힌 소유자: 팀원을 내보낸 뒤에는 된다
    await rows(u.boss,'delete from public.ps_members where workspace_id=$1 and user_id=$2',[wBoss,u.mate]);
    equal(await val(u.boss,'select public.ps_delete_my_data()'),'','after 7: once the other member is removed the owner can delete');
    equal(Number((await q('select count(*) n from public.ps_account_deletions'))[0].n),3,'after 7: three accounts queued');

    // ══ 되돌리기 → 적용 전과 같다 → 다시 적용 ══
    await assert.rejects(()=>db.exec(rollback),/처리하지 않은 계정 삭제 요청 3건/,'rollback refuses while deletion requests are pending');await db.exec('ROLLBACK');passed++;
    await q("update public.ps_account_deletions set done_at=now(),done_by='test'");
    await db.exec(rollback);await db.exec(rollback);
    equal(await snapshot(db),before,'rollback restores function bodies (md5), the policy, table privileges, triggers, checks and drops the new objects');
    await assert.rejects(()=>db.exec(sql),/상한 1,500 의 절반 이상/,'a first application re-checks the usage assumptions');await db.exec('ROLLBACK');passed++;
    await q('delete from public.ps_blob where created_by=$1',[u.quota]);await q("delete from public.ps_comm_reports where pub_id like 'flood%'");
    await db.exec(sql);
    await q("insert into public.ps_blob(workspace_id,h,v,created_by) select $1,lpad(to_hex(g+5000),32,'0'),'x',$2 from generate_series(1,900) g",[wid,u.quota]);
    await db.exec(sql);   // 적용 뒤에는 상한 안의 많은 사용이 다시 돌리기를 막지 않는다
    equal(last(await db.exec(verify))[0].result,'privacy_limits_verified','re-applying after a rollback works, and again with heavy-but-allowed usage');
  }finally{await db.close();}
}

async function refuses(){
  const db=await H.open();
  try{
    await db.exec(VERSIONS);
    await assert.rejects(()=>db.exec(sql),/20261110_invite_hardening 이 먼저/,'needs bundle 1');await db.exec('ROLLBACK');passed++;
    await assert.rejects(()=>db.exec(preflight),/20261110_invite_hardening 이 먼저/,'preflight needs bundle 1');passed++;
    await db.exec(INVITE);
    const O=await H.user(db,1),P=await H.user(db,2);
    await db.query("insert into public.ps_workspaces(id,name,kind,owner_id) values($1,'t','team',$2)",[H.uuid(500),O]);
    const s0=await snapshot(db);
    for(const [label,tweak,undo,msg] of [
      ['an unknown trigger on ps_blob',"create function public.x_t() returns trigger language plpgsql as $f$ begin return new; end $f$; create trigger x_t before insert on public.ps_blob for each row execute function public.x_t()",'drop trigger x_t on public.ps_blob; drop function public.x_t()',/예상 밖 트리거/],
      ['a different mem_sel policy','drop policy mem_sel on public.ps_members; create policy mem_sel on public.ps_members for select to public using (true)','drop policy mem_sel on public.ps_members; create policy mem_sel on public.ps_members as permissive for select to public using (ps_is_member(workspace_id))',/mem_sel 이 예상과 다릅니다/],
      ['someone already uploading 800 blobs a day',`insert into public.ps_blob(workspace_id,h,v,created_by) select '${H.uuid(500)}',lpad(to_hex(g),32,'0'),'x','${P}' from generate_series(1,800) g`,'delete from public.ps_blob',/상한 1,500 의 절반 이상/],
      ['a running app that sends a longer app_version',`insert into public.ps_events(user_id,event_name,app_version) values('${P}','boot','a version string that is far too long')`,'delete from public.ps_events',/새 검사\(meta 8KB/],
      ['a ps_delete_my_data someone edited',"create or replace function public.ps_delete_my_data() returns void language sql security definer set search_path to 'public' as $f$ select $f$",null,/ps_delete_my_data\(\) 본문이 예상/],
    ]){
      if(undo===null){
        await db.exec('BEGIN');await db.exec(tweak);
        await assert.rejects(()=>db.exec(sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')),msg,'migration: '+label);await db.exec('ROLLBACK');
        await db.exec('BEGIN');await db.exec(tweak);await assert.rejects(()=>db.exec(preflight),msg,'preflight: '+label);await db.exec('ROLLBACK');
      }else{
        await db.exec(tweak);
        await assert.rejects(()=>db.exec(preflight),msg,'preflight: '+label);
        await assert.rejects(()=>db.exec(sql),msg,'migration: '+label);await db.exec('ROLLBACK');
        await db.exec(undo);
      }
      equal(await snapshot(db),s0,`stops on ${label} and changes nothing`);
    }
    // 어기는 옛 줄이 있으면 검사를 NOT VALID 로 두고 적용은 끝낸다
    await db.query("insert into public.ps_err(kind,msg,t) values('x',repeat('A',5000),now()-interval '200 days')");
    await db.exec(sql);
    equal((await db.query("select conname,convalidated from pg_constraint where conname in ('ps_err_len_chk','ps_comm_reports_len_chk') order by 1")).rows,[{conname:'ps_comm_reports_len_chk',convalidated:true},{conname:'ps_err_len_chk',convalidated:false}],'an old over-long row leaves that check NOT VALID (new rows are still checked); clean tables are validated');
  }finally{await db.close();}
}
(async()=>{await main();await refuses();console.log(`${NAME} local test: ${passed} checks passed`);})().catch(e=>{console.error(e);process.exit(1);});
