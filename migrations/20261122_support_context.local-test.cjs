/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261122_support_context.local-test.cjs
 * 기준본(운영에서 받은 실제 구조) 위에서 ps_support_context · ps_support_list_flags 의
 * 권한 · 돌려주는 모양 · 시간 창 경계 · «같은 오류» 집계 · «고친 판» 판정 · 두 번 적용 · 되돌리기를 본다. */
'use strict';
const assert=require('node:assert/strict');
const H=require('./20261110_local_harness.cjs');
const NAME='20261122_support_context';
const sql=H.read(NAME+'.sql'),rollback=H.read(NAME+'.rollback.sql');
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};
const ok=(v,label)=>{assert.ok(v,label);passed++;};
const AT='2026-11-19T12:14:00Z';
const at=min=>new Date(Date.parse(AT)+min*60000).toISOString();

(async()=>{
  const db=await H.open();
  const admin=await H.user(db,1),reporter=await H.user(db,2),other=await H.user(db,3),third=await H.user(db,4),quiet=await H.user(db,5);
  await db.query('insert into public.ps_admins(user_id) values($1)',[admin]);
  const R=H.uuid(9001),R2=H.uuid(9002),R3=H.uuid(9003);
  await db.query("insert into public.ps_support_reports(id,reporter_id,title,body,created_at) values($1,$2,'제목','본문',$3),($4,$5,'둘','본문',$3),($6,$7,'셋','본문',$3)",[R,reporter,AT,R2,quiet,R3,other]);
  const ev=(uid,min,name,o={})=>db.query('insert into public.ps_events(user_id,event_name,status,feature,device,app_version,error_code,meta,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [uid,name,o.status||'ok',o.feature||'board',o.device||'tablet',o.v===undefined?'3.330':o.v,o.code||null,JSON.stringify(o.meta||{}),at(min)]);
  await ev(reporter,-45,'feature_opened');                                   // 창 밖(앞)
  await ev(reporter,-22,'feature_opened');
  await ev(reporter,-5,'app_error',{status:'error',code:'anim_pause_state',meta:{msg:'비밀 글'}});
  await ev(reporter,-5,'app_error',{status:'error',code:'anim_pause_state'});
  await ev(reporter,-3,'sync_failed',{status:'error',code:'sync_storage',feature:'sync'});
  await ev(reporter,1,'content_saved');
  await ev(reporter,40,'feature_opened');                                    // 창 밖(뒤)
  await ev(reporter,-2,'feature_opened',{device:'desktop',v:'3.334'});
  await ev(other,-600,'app_error',{status:'error',code:'anim_pause_state',v:'3.326',device:'desktop'});
  await ev(third,-3000,'app_error',{status:'error',code:'anim_pause_state',v:'3.334'});
  await ev(third,-60*24*9,'app_error',{status:'error',code:'anim_pause_state',v:'3.300'});   // 7일 밖
  await ev(other,-10,'app_error',{status:'error',code:'something_else'});
  await ev(other,5,'feature_opened',{v:'unknown'});                          // 판 모양이 아닌 값은 숫자로 바꾸지 않는다
  await db.query("insert into public.ps_sync_reports(user_id,device_id,workspace_id,report_seq,pending_team,pending_personal,held,skipped,deferred,conflicts,device_class,app_version,online,busy,received_at) values($1,$2,$3,1,0,2,0,0,0,0,'tablet','3.330',true,false,$4)",
    [reporter,H.uuid(7001),H.uuid(7002),at(1)]);
  const call=(uid,q,p)=>H.attempt(db,uid?'authenticated':'anon',uid,q,p);
  const ctx=async(id,min)=>{const r=await call(admin,'select public.ps_support_context($1,$2) as v',[id,min===undefined?30:min]);return typeof r==='string'?r:r[0].v;};

  await db.exec(sql);await db.exec(sql);   // 멱등

  // 권한
  ok(/support_not_admin/.test(await call(reporter,'select public.ps_support_context($1,30)',[R])),'the reporter cannot read the context');
  ok(/ERR/.test(await call(null,'select public.ps_support_context($1,30)',[R])),'anon cannot call the context');
  ok(/support_not_admin/.test(await call(other,'select public.ps_support_list_flags($1)',[[R]])),'a member cannot read the flags');
  ok(/report_not_found/.test(await ctx(H.uuid(9999))),'an unknown report is a 404');

  // 모양 · 창
  let c=await ctx(R);
  equal(Object.keys(c).sort(),['errors','events','fixed','minutes','report_at','sync'],'top-level keys');
  equal(c.minutes,30,'minutes echo');
  equal(c.events.length,6,'only the events inside ±30 minutes');
  equal(c.events.map(e=>e.event_name),['feature_opened','app_error','app_error','sync_failed','feature_opened','content_saved'],'events come back oldest first');
  equal(Object.keys(c.events[0]).sort(),['app_version','at','device','error_code','event_name','feature','status'],'no meta and no ids leave the server');
  ok(!JSON.stringify(c).includes('비밀'),'meta text never appears');
  equal(c.sync.pending_personal,2,'the latest device report');
  equal(c.fixed,null,'no fixed version yet');
  equal((await ctx(R,1)).minutes,5,'the window is clamped to at least five minutes');
  equal((await ctx(R,5)).events.length,5,'a five-minute window includes its edges');

  // 같은 오류
  equal(c.errors.map(e=>e.code),['anim_pause_state','sync_storage'],'the reporter\'s own error codes, most frequent first');
  equal([c.errors[0].mine,c.errors[0].users,c.errors[0].count],[2,3,4],'same error across people within the week; older rows are left out');
  equal([c.errors[0].min_version,c.errors[0].max_version],['3.326','3.334'],'version range');
  equal((await ctx(R2)).errors,[],'a reporter without events has no errors');
  equal((await ctx(R2)).events,[],'…and no events');
  equal((await ctx(R2)).sync,null,'…and no device report');

  // 고친 판
  await db.query("update public.ps_support_reports set fixed_in='3.335' where id=$1",[R]);
  c=await ctx(R);
  equal(c.fixed.version,'3.335','fixed version echo');
  equal(c.fixed.devices.map(d=>[d.device,d.received_at,d.latest_version]).sort(),[['desktop',null,'3.334'],['tablet',null,'3.330']],'nobody has the fixed version yet');
  equal(c.fixed.after,{mine:0,users:0,count:0},'no same error on the fixed version');
  await ev(reporter,600,'feature_opened',{v:'3.335'});
  await ev(reporter,640,'feature_opened',{v:'3.336'});
  await ev(reporter,650,'app_error',{status:'error',code:'anim_pause_state',v:'3.336'});
  await ev(other,660,'app_error',{status:'error',code:'anim_pause_state',v:'3.330'});   // 옛 판의 같은 오류는 «고친 뒤»에 세지 않는다
  c=await ctx(R);
  const tab=c.fixed.devices.find(d=>d.device==='tablet');
  equal([new Date(tab.received_at).toISOString(),tab.latest_version],[at(600),'3.336'],'the first time the device ran the fixed version');
  equal(c.fixed.after,{mine:1,users:1,count:1},'the same error after the fix, on fixed versions only');

  // 목록 꼬리표
  const flags=async ids=>{const r=await call(admin,'select public.ps_support_list_flags($1) as v',[ids]);return typeof r==='string'?r:r[0].v;};
  let f=await flags([R,R2,R3]);
  equal(Object.keys(f).sort(),[R,R2,R3].sort(),'one entry per report');
  equal(f[R],{version:'3.330',seen_version:'3.336',fixed_seen:true},'the reporter received the fix');
  equal(f[R2],{version:null,seen_version:null,fixed_seen:null},'no events: nothing is claimed');
  equal(f[R3].fixed_seen,null,'no fixed version: nothing is claimed');
  await db.query("update public.ps_support_reports set fixed_in='3.340' where id=$1",[R]);
  equal((await flags([R]))[R].fixed_seen,false,'a newer fix has not arrived');
  await db.query("update public.ps_support_reports set fixed_in='3.335' where id=$1",[R2]);
  equal((await flags([R2]))[R2].fixed_seen,null,'fixed version but no events after the report: unknown, not «not received»');
  equal(await flags([]),{},'an empty list');
  ok(/support_invalid/.test(await flags(Array.from({length:41},(_,i)=>H.uuid(5000+i)))),'more than forty ids is refused');

  // 권한 표 · 되돌리기
  const grants=(await db.query("select routine_name||':'||grantee as g from information_schema.routine_privileges where specific_schema='public' and routine_name in ('ps_support_context','ps_support_list_flags') and grantee in ('anon','PUBLIC') order by 1")).rows;
  equal(grants,[],'no anon or PUBLIC grants');
  await db.exec(rollback);await db.exec(rollback);
  equal((await db.query("select count(*)::int as n from pg_proc where proname in ('ps_support_context','ps_support_list_flags')")).rows[0].n,0,'rollback removes both functions');
  await db.exec(sql);
  ok(typeof (await ctx(R))==='object','re-apply after rollback');
  await db.close();
  console.log(NAME+': '+passed+' checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
