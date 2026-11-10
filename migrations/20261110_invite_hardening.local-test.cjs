/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261110_invite_hardening.local-test.cjs
 * 기준본(00000000_baseline.sql — 운영에서 받은 실제 함수 · 트리거 · 정책 · 권한)을 PGlite 에 통째로 올리고
 * ① 적용 전: 문제가 실제로 있다(선수가 스태프 코드를 읽는다 · 강제 모드에서 스태프 초대 합류가 선수로 떨어진다 · 스위치를 끄면 선수가 스태프가 된다 ·
 *    이메일을 꾸밀 수 있다 · 8자 코드 · 틀림/만료가 다른 답 · 시도 제한 없음)
 * ② 적용 뒤: 막혔고, 정상 흐름(소유자가 스태프 초대 → 새 사람이 스태프로 · 선수는 선수로 · 옛 8자 코드 · 임원의 선수 초대)은 그대로
 * ③ 두 번 적용 · 되돌리기(기준본과 md5 까지 같게) · 다시 적용 · 예상과 다른 운영에서는 아무것도 바꾸지 않고 멈춤. */
'use strict';
const assert=require('node:assert/strict');
const H=require('./20261110_local_harness.cjs');
const NAME='20261110_invite_hardening';
const sql=H.read(NAME+'.sql'),verify=H.read(NAME+'.verify.sql'),rollback=H.read(NAME+'.rollback.sql'),preflight=H.read(NAME+'.preflight.sql');
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const ok=(v,label)=>{assert.ok(v,label);passed++;};
const FNS=['ps_join','ps_kv_team_guard','ps_create_invite','ps_get_or_create_invite','ps_get_or_create_role_invite','ps_regenerate_invite','ps_regenerate_role_invite','ps_bootstrap','ps_create_team'];
const STAFF=['board','schedule','team','gamemodel','terms','note'],EXEC=['board','schedule','team','scout','gamemodel','terms','note'];
const NEWCODE=/^[0-9A-HJKMNP-TV-Z]{12}$/,CLIENT=/^[A-Z0-9]{6,12}$/;   // CLIENT = studio/sync.js consumeInviteLink · 초대 코드 입력 칸(maxlength 12)

async function world(db){
  const u={};let n=0;
  for(const k of ['owner','player','staff','late','exec','p2','p3','p4','p5','p6','guess','stranger','ghost'])u[k]=await H.user(db,++n,k+'@real.test');
  const val=async(uid,q,p)=>{const r=await H.attempt(db,'authenticated',uid,q,p);return typeof r==='string'?r:Object.values(r[0]||{})[0];};
  /* ps_join 한 번 = 요청 하나. 돌려준 팀과 PostgREST 가 읽을 응답 코드(response.status)를 같이 본다. */
  const join=async(uid,code,email)=>{try{return await H.as(db,'authenticated',uid,async d=>{
      const w=(await d.query('select public.ps_join($1,$2) w',[code,email===undefined?null:email])).rows[0].w;
      const st=(await d.query("select nullif(current_setting('response.status',true),'') s")).rows[0].s;
      return st?{wid:w,status:st}:{wid:w};});}catch(e){return 'ERR: '+e.message;}};
  const perms=async wid=>{const r=(await db.query("select v from public.ps_kv where workspace_id=$1 and k='cs_perms_v1'",[wid])).rows[0];return r?JSON.parse(r.v):null;};
  const role=async(wid,uid)=>{const p=await perms(wid);return p&&p.members&&p.members[uid]?p.members[uid].role:null;};
  const member=async(wid,uid)=>(await db.query('select role,email from public.ps_members where workspace_id=$1 and user_id=$2',[wid,uid])).rows[0]||null;
  const md5s=async()=>Object.fromEntries((await db.query("select proname,md5(prosrc) m from pg_proc where pronamespace='public'::regnamespace and proname=any($1)",[FNS])).rows.map(r=>[r.proname,r.m]));
  const enforce=on=>db.query('update public.ps_guard_mode set enforce=$1 where id=1',[on]);
  return {u,val,join,perms,role,member,md5s,enforce};
}
const newTeam=async(w,name)=>w.val(w.u.owner,'select public.ps_create_team($1,$2)',[name,'o@spoof.test']);
const invite=(w,wid,r,uid)=>w.val(uid||w.u.owner,'select public.ps_get_or_create_role_invite($1,$2)',[wid,r]);

async function before(){
  const db=await H.open();
  try{
    const w=await world(db),{u}=w;
    const wid=await newTeam(w,'합성 팀');
    const staffCode=await invite(w,wid,'staff'),playerCode=await invite(w,wid,'player');
    ok(/^[0-9A-F]{8}$/.test(staffCode)&&/^[0-9A-F]{8}$/.test(playerCode),'before: codes are 8 hex characters (32 bits)');
    equal((await w.join(u.player,playerCode,'victim@spoof.test')).wid,wid,'before: a player joins with the player code');
    // 1 — 선수가 표를 직접 읽어 스태프 코드를 얻는다
    const seen=await H.attempt(db,'authenticated',u.player,'select code,member_role from public.ps_invites where workspace_id=$1 order by member_role',[wid]);
    equal(seen,[{code:playerCode,member_role:'player'},{code:staffCode,member_role:'staff'}],'before: a player reads the staff invite code straight from the table');
    // 강제 모드: 훔친 코드로 다시 합류 → 가드가 되돌린다(부수 효과) / 스위치를 끄면 스태프가 된다
    await w.join(u.player,staffCode);
    equal(await w.role(wid,u.player),'player','before: with enforce=true the guard happens to revert the escalation');
    // «정상» 스태프 초대 합류도 같은 이유로 선수가 된다 — 지금 깨져 있는 기능
    equal((await w.join(u.late,staffCode)).wid,wid,'before: a new coach joins with the staff code the owner sent');
    equal(await w.role(wid,u.late),'player','before: BUG — with enforce=true a legitimate staff-invite joiner ends up as player');
    ok((await db.query("select 1 from public.ps_kv_denied where user_id=$1 and k='cs_perms_v1'",[u.late])).rows.length===1,'before: …and the guard logs it as a denied permission write');
    await w.enforce(false);
    await w.join(u.player,staffCode);
    equal(await w.role(wid,u.player),'staff','before: VULN — with the guard switch off (documented rollback) a player becomes staff with the leaked code');
    await w.enforce(true);
    // 권한 문서가 아직 없는 팀: 가드의 «최초 생성 허용»으로 그대로 들어간다
    const wid2=await newTeam(w,'새 팀');const exec2=await invite(w,wid2,'executive');
    await w.join(u.stranger,exec2);
    equal(await w.role(wid2,u.stranger),'executive','before: on a team with no permission doc the invite role is written as is (the guard lets the first insert through)');
    // 3 — 이메일을 꾸밀 수 있다
    equal((await w.member(wid,u.player)).email,'victim@spoof.test','before: ps_join stores the caller-supplied e-mail');
    equal((await w.member(wid,u.owner)).email,'o@spoof.test','before: ps_create_team stores the caller-supplied e-mail');
    const shown=await H.attempt(db,'authenticated',u.late,'select email from public.ps_members_of_v2($1) where user_id=$2',[wid,u.player]);
    equal(shown,[{email:'victim@spoof.test'}],'before: …and every member is shown the spoofed address');
    // 2 — 틀림 · 만료가 다른 답, 시도 제한 없음
    await db.query("insert into public.ps_invites(code,workspace_id,created_by,expires_at,member_role) values('DEADBEEF',$1,$2,now()-interval '1 day','player')",[wid,u.owner]);
    ok(/invalid code/.test(await w.join(u.guess,'00000000')),'before: a wrong code answers «invalid code»');
    ok(/expired/.test(await w.join(u.guess,'DEADBEEF')),'before: an expired code answers «expired» (tells the caller the code exists)');
    for(let i=0;i<25;i++)await w.join(u.guess,'0000000'+(i%10));
    equal((await w.join(u.guess,playerCode)).wid,wid,'before: 27 wrong guesses in a row and the next try still goes through — no attempt limit');
    // 임원은 선수 초대 링크를 못 만든다(3.052 화면은 임원에게 열려 있다)
    await db.query("update public.ps_kv set v=jsonb_set(v::jsonb,array['members',$2::text],'{\"role\":\"executive\"}'::jsonb)::text where workspace_id=$1 and k='cs_perms_v1'",[wid,u.late]);
    ok(/owner only/.test(await invite(w,wid,'player',u.late)),'before: an executive cannot get the player code although the app offers «초대 링크» to executives');
  }finally{await db.close();}
}

async function after(){
  const db=await H.open();
  try{
    const w=await world(db),{u}=w;
    const base=await w.md5s();
    const wid=await newTeam(w,'합성 팀');
    const oldStaff=await invite(w,wid,'staff'),oldPlayer=await invite(w,wid,'player');
    await w.join(u.player,oldPlayer);                                  // 적용 전부터 있던 선수(권한 문서가 생긴다)
    await db.query("insert into public.ps_invites(code,workspace_id,created_by,expires_at,member_role) values('DEADBEEF',$1,$2,now()-interval '1 day','player'),('OPENCODE',$1,$2,null,'player')",[wid,u.owner]);
    const pf=await db.exec(preflight);
    equal(pf[pf.length-1].rows[0].live_staff_exec_codes,1,'preflight: counts the staff/executive codes that will be expired');
    equal(pf[pf.length-1].rows[0].applied_functions,0,'preflight: nothing applied yet');
    equal(pf[pf.length-1].rows[0].codes_without_expiry,1,'preflight: counts codes without an expiry');

    // ── 적용(두 번) + 확인 ──
    await db.exec(sql);
    const midStaff=await invite(w,wid,'staff');                         // 적용 뒤 소유자가 새로 만든 스태프 코드
    await db.exec(sql);
    const vr=await db.exec(verify);
    equal(vr[vr.length-1].rows[0].result,'invite_hardening_verified','verify passes after applying twice');
    const pf2=await db.exec(preflight);
    equal(pf2[pf2.length-1].rows[0].applied_functions,12,'preflight after: nine replaced + three new functions carry the marker');

    // 1 — 코드는 소유자만 읽는다
    equal(await H.attempt(db,'authenticated',u.player,'select code from public.ps_invites where workspace_id=$1',[wid]),[],'after: a player reads no invite codes');
    ok((await H.attempt(db,'authenticated',u.owner,'select code from public.ps_invites where workspace_id=$1',[wid])).length>=3,'after: the owner still reads the team codes');
    ok(/owner only/.test(await invite(w,wid,'player',u.player)),'after: a player cannot get a code from the RPC either');
    // 적용 전 모두에게 보였던 스태프 코드는 죽었고, 적용 뒤 만든 것은 두 번째 실행에도 살아 있다
    equal(await w.join(u.guess,oldStaff),{wid:null,status:'400'},'after: the staff code every member could read was expired by the migration');
    ok(NEWCODE.test(midStaff)&&CLIENT.test(midStaff),'after: new codes are 12 Crockford characters and pass the app’s own code pattern');
    equal(await invite(w,wid,'staff'),midStaff,'after: re-running the migration does not expire codes made after the first run');
    equal((await db.query("select count(*)::int n from public.ps_invites where expires_at is null")).rows[0].n,0,'after: no code is left without an expiry');
    for(const f of ['ps_create_invite','ps_get_or_create_invite','ps_regenerate_invite'])ok(NEWCODE.test(await w.val(u.owner,`select public.${f}($1)`,[wid])),`after: ${f} makes a 12-character code`);
    ok(NEWCODE.test(await w.val(u.owner,"select public.ps_regenerate_role_invite($1,'executive')",[wid])),'after: ps_regenerate_role_invite makes a 12-character code');
    const playerCode=await invite(w,wid,'player'),staffCode=await invite(w,wid,'staff'),execCode=await invite(w,wid,'executive');

    // ── 정상 흐름 ──
    equal(await w.join(u.staff,staffCode,'x@spoof.test'),{wid},'after: a new coach joins with the staff code');
    equal((await w.perms(wid)).members[u.staff],{role:'staff',scopes:STAFF},'after: FIXED — with enforce=true the staff-invite joiner is staff, with the staff scopes');
    equal(await w.join(u.exec,execCode),{wid},'after: executive invite');
    equal((await w.perms(wid)).members[u.exec],{role:'executive',scopes:EXEC},'after: the executive-invite joiner is executive');
    equal(await w.join(u.p2,playerCode),{wid},'after: player invite');
    equal((await w.perms(wid)).members[u.p2],{role:'player',scopes:[]},'after: the player-invite joiner is player');
    equal((await db.query("select count(*)::int n from public.ps_kv_denied where user_id=any($1)",[[u.staff,u.exec,u.p2]])).rows[0].n,0,'after: a legitimate join no longer leaves a «denied» row');
    equal((await w.member(wid,u.staff)),{role:'member',email:'staff@real.test'},'after: the member e-mail comes from auth.users, not from the caller');
    await w.val(u.ghost,"select count(*) from public.ps_bootstrap('boss@spoof.test')");
    equal((await db.query("select m.email from public.ps_members m join public.ps_workspaces w on w.id=m.workspace_id where m.user_id=$1 and w.kind='personal'",[u.ghost])).rows,[{email:'ghost@real.test'}],'after: ps_bootstrap ignores the caller-supplied e-mail');
    // 옛 8자 코드는 만료일까지 통한다(권한 문서가 없는 팀에서도)
    const widOld=await newTeam(w,'옛 코드 팀');
    await db.query("insert into public.ps_invites(code,workspace_id,created_by,expires_at,member_role) values('A1B2C3D4',$1,$2,now()+interval '9 days','player'),('0FF1CE00',$1,$2,now()+interval '9 days','staff')",[widOld,u.owner]);
    equal((await w.member(widOld,u.owner)).email,'owner@real.test','after: ps_create_team ignores the caller-supplied e-mail');
    equal(await w.join(u.p3,'a1b2c3d4 '),{wid:widOld},'after: an existing 8-character code still works (typed in lower case with a space)');
    equal(await w.role(widOld,u.p3),'player','after: …as player');
    const widNew=await newTeam(w,'권한 문서 없는 팀');
    equal(await w.join(u.p4,await invite(w,widNew,'staff')),{wid:widNew},'after: staff invite on a team without a permission doc');
    equal((await w.perms(widNew)),{defaultRole:'player',members:{[u.p4]:{role:'staff',scopes:STAFF}}},'after: …creates the doc with exactly that one entry');
    // 손으로 친 코드: O→0 · I,L→1
    await db.query("insert into public.ps_invites(code,workspace_id,created_by,expires_at,member_role) values('A0B1C2D3E4F1',$1,$2,now()+interval '9 days','player')",[widOld,u.owner]);
    equal(await w.join(u.p5,'aObIc2d3e4fL'),{wid:widOld},'after: O/I/L typed by hand are read as 0/1/1');
    // 임원은 선수 코드만
    equal(await invite(w,wid,'player',u.exec),playerCode,'after: an executive gets the player code (3.052 per-player invite link)');
    ok(/owner only/.test(await invite(w,wid,'staff',u.exec)),'after: …but not the staff code');
    ok(/owner only/.test(await invite(w,wid,'executive',u.exec)),'after: …nor the executive code');
    ok(/owner only/.test(await w.val(u.exec,"select public.ps_regenerate_role_invite($1,'player')",[wid])),'after: …and cannot rotate codes');
    ok(/owner only/.test(await invite(w,wid,'player',u.staff)),'after: staff cannot get codes');
    equal(await H.attempt(db,'authenticated',u.exec,'select code from public.ps_invites where workspace_id=$1',[wid]),[],'after: an executive reads nothing from the table (RPC only)');

    // ── 막힌 것 ──
    for(const on of [true,false]){
      await w.enforce(on);
      equal(await w.join(u.player,staffCode),{wid},`after: an existing player re-joins with a staff code (enforce=${on}) — accepted as a no-op`);
      equal(await w.role(wid,u.player),'player',`after: …and stays player (enforce=${on})`);
      equal(await w.join(u.player,execCode),{wid},`after: same with an executive code (enforce=${on})`);
      equal(await w.role(wid,u.player),'player',`after: …still player (enforce=${on})`);
      equal(await w.join(u.exec,playerCode),{wid},`after: an executive re-joining with a player code (enforce=${on})`);
      equal(await w.role(wid,u.exec),'executive',`after: …is not demoted (enforce=${on})`);
    }
    await w.enforce(true);
    equal(await w.join(u.owner,playerCode),{wid},'after: the owner entering a player code');
    equal([(await w.member(wid,u.owner)).role,await w.role(wid,u.owner)],['owner',null],'after: …stays owner and gets no player entry');
    await db.query('delete from public.ps_members where workspace_id=$1 and user_id=$2',[widNew,u.owner]);
    equal(await w.join(u.owner,await db.query("select code from public.ps_invites where workspace_id=$1 limit 1",[widNew]).then(r=>r.rows[0].code)),{wid:widNew},'after: an owner whose member row was lost re-enters by code');
    equal([(await w.member(widNew,u.owner)).role,await w.role(widNew,u.owner)],['owner',null],'after: …as owner, never as player');
    // 나갔다가(멤버 행 삭제) 옛 «임원» 항목이 남은 사람이 선수 코드로 돌아오면 선수다
    await db.query('delete from public.ps_members where workspace_id=$1 and user_id=$2',[wid,u.exec]);
    equal(await w.join(u.exec,playerCode),{wid},'after: a removed executive comes back with a player code');
    equal((await w.perms(wid)).members[u.exec],{role:'player',scopes:[]},'after: …and is a player (the stale executive entry does not come back to life)');
    // 가드 자체: 표식을 꾸며도(유효한 스태프 코드까지 알아도) 이미 팀원인 사람의 쓰기는 통과하지 못한다
    const forged=await H.as(db,'postgres',u.player,async d=>{   // RLS 를 건너뛴 채(가드만 본다) 선수 신분으로
      await d.query("select set_config('ps.invite_join',$1,true)",[staffCode]);
      const doc=await w.perms(wid);doc.members[u.player]={role:'staff',scopes:STAFF};
      await d.query("update public.ps_kv set v=$2 where workspace_id=$1 and k='cs_perms_v1'",[wid,JSON.stringify(doc)]);
      return (await d.query("select v from public.ps_kv where workspace_id=$1 and k='cs_perms_v1'",[wid])).rows[0].v;});
    equal(JSON.parse(forged).members[u.player].role,'player','after: the guard ignores a forged ps.invite_join marker from someone who did not join in this transaction');
    equal(await H.attempt(db,'authenticated',u.player,"update public.ps_kv set v='{}' where workspace_id=$1 and k='cs_perms_v1' returning k",[wid]),[],'after: row security still keeps a player away from the permission doc');
    // 운영진의 권한 편집은 그대로
    const doc=await w.perms(wid);doc.members[u.p2]={role:'staff'};
    equal((await H.attempt(db,'authenticated',u.owner,"update public.ps_kv set v=$2,cupd=cupd+1 where workspace_id=$1 and k='cs_perms_v1' returning k",[wid,JSON.stringify(doc)])).length,1,'after: the owner still edits roles');
    equal(await w.role(wid,u.p2),'staff','after: …and the edit lands');
    equal(await w.join(u.p2,playerCode),{wid},'after: a member promoted by the owner re-enters a player code');
    equal(await w.role(wid,u.p2),'staff','after: …and keeps the role the owner gave');

    // 2 — 같은 답 · 잠금
    const wrong=await w.join(u.guess,'ZZZZZZZZZZZZ'),expired=await w.join(u.guess,'DEADBEEF');
    equal([wrong,expired],[{wid:null,status:'400'},{wid:null,status:'400'}],'after: a wrong code and an expired code get the same answer (null, HTTP 400)');
    equal(await H.attempt(db,'authenticated',u.guess,'select * from public.ps_join_attempts'),'ERR: permission denied for table ps_join_attempts','after: clients cannot read the attempt table');
    equal((await db.query('select fails from public.ps_join_attempts where user_id=$1',[u.guess])).rows,[{fails:3}],'after: failures are counted even though the call did not raise (old staff code + these two)');
    for(let i=0;i<7;i++)await w.join(u.guess,'WRONG'+i);
    ok(/join_locked/.test(await w.join(u.guess,playerCode)),'after: after 10 failures even the right code is refused for 15 minutes (PT429)');
    equal(await w.member(wid,u.guess),null,'after: …and the caller did not get in');
    equal(await w.join(u.p6,playerCode),{wid},'after: the lock is per account — someone else joins normally');
    await db.query("update public.ps_join_attempts set locked_until=now()-interval '1 second',window_start=now()-interval '16 minutes' where user_id=$1",[u.guess]);
    equal(await w.join(u.guess,playerCode),{wid},'after: when the lock has run out the right code works');
    equal((await db.query('select count(*)::int n from public.ps_join_attempts where user_id=$1',[u.guess])).rows[0].n,0,'after: a success clears the counter');
    await db.query("insert into public.ps_join_attempts(user_id,fails,updated_at) values($1,3,now()-interval '2 days')",[u.ghost]);
    await w.join(u.stranger,'NOPE');
    equal((await db.query('select user_id from public.ps_join_attempts order by 1')).rows,[{user_id:u.stranger}],'after: rows older than a day are swept on the next failure (retention without cron)');
    ok(/not authenticated/.test(await H.attempt(db,'anon',null,"select public.ps_join('A1B2C3D4',null)")),'after: anon cannot join');

    // ── 되돌리기 → 기준본과 같다 → 다시 적용 ──
    await db.exec(rollback);await db.exec(rollback);
    equal(await w.md5s(),base,'rollback restores all nine function bodies byte for byte (md5 = baseline)');
    equal((await db.query("select pg_get_expr(polqual,polrelid) q from pg_policy where polname='inv_sel'")).rows,[{q:'ps_is_member(workspace_id)'}],'rollback restores the policy');
    equal((await db.query("select to_regclass('public.ps_join_attempts') t, to_regprocedure('public.ps_invite_code()') f")).rows,[{t:null,f:null}],'rollback drops the table and helpers');
    equal(await w.val(u.stranger,'select public.ps_join($1,null)',[playerCode]),wid,'after rollback the old ps_join accepts a 12-character code made meanwhile');
    await db.exec(sql);
    const vr2=await db.exec(verify);
    equal(vr2[vr2.length-1].rows[0].result,'invite_hardening_verified','re-applying after a rollback works');
  }finally{await db.close();}
}

async function refuses(){
  const db=await H.open();
  try{
    const w=await world(db);
    const snap=async()=>({md:await w.md5s(),pol:(await db.query("select pg_get_expr(polqual,polrelid) q from pg_policy where polname='inv_sel'")).rows,t:(await db.query("select to_regclass('public.ps_join_attempts') t")).rows});
    const s0=await snap();
    for(const [label,tweak,undo,msg] of [
      ['a ps_join someone edited by hand',"create or replace function public.ps_join(p_code text, p_email text default null) returns uuid language sql security definer set search_path to 'public' as $f$ select null::uuid $f$",null,/ps_join\(text,text\) 본문이 2026-10-27 기준본과 다릅니다/],
      ['a different inv_sel policy','drop policy inv_sel on public.ps_invites; create policy inv_sel on public.ps_invites for select to public using (true)','drop policy inv_sel on public.ps_invites; create policy inv_sel on public.ps_invites as permissive for select to public using (ps_is_member(workspace_id))',/inv_sel 이 예상과 다릅니다/],
      ['a disabled guard trigger','alter table public.ps_kv disable trigger ps_kv_team_guard_t','alter table public.ps_kv enable trigger ps_kv_team_guard_t',/가드 트리거/],
    ]){
      if(undo===null){   // 함수 본문은 되돌릴 원문이 필요하다 — 새 DB 대신 SAVEPOINT 로
        await db.exec('BEGIN');await db.exec(tweak);
        await assert.rejects(()=>db.exec(preflight),msg,'preflight: '+label);await db.exec('ROLLBACK');
        await db.exec('BEGIN');await db.exec(tweak);await db.exec('SAVEPOINT s');
        const inner=sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
        await assert.rejects(()=>db.exec(inner),msg,'migration: '+label);await db.exec('ROLLBACK');
      }else{
        await db.exec(tweak);
        await assert.rejects(()=>db.exec(preflight),msg,'preflight: '+label);
        await assert.rejects(()=>db.exec(sql),msg,'migration: '+label);await db.exec('ROLLBACK');
        await db.exec(undo);
      }
      equal(await snap(),s0,`stops on ${label} and changes nothing`);
    }
  }finally{await db.close();}
}
(async()=>{await before();await after();await refuses();console.log(`${NAME} local test: ${passed} checks passed`);})().catch(e=>{console.error(e);process.exit(1);});
