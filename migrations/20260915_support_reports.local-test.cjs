'use strict';
// Pure in-memory PostgreSQL/WASM. No credentials, network or production rows.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=s=>fs.readFileSync(path.join(__dirname,'20260915_support_reports.'+s),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),U=id(2),V=id(3),TEAM_ADMIN=id(4),R=id(101),OTHER=id(102),REPLY=id(201);
let assertions=0;
function equal(a,b,label){assert.deepEqual(a,b,label);assertions++;}
async function fail(fn,code,label){let e;try{await fn();}catch(error){e=error;}assert.ok(e,label+' must fail');equal(e.code,code,label);}
async function as(db,uid,fn,role='authenticated'){
  await db.exec('BEGIN');
  try{
    await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);
    await db.exec('SET LOCAL ROLE '+role);
    equal((await db.query('SELECT current_user actor,auth.uid()::text uid,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) bypass')).rows[0],{actor:role,uid:uid||null,bypass:false},'test calls truly use unprivileged JWT role');
    const out=await fn();await db.exec('COMMIT');return out;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
const call=(db,uid,name,args,types)=>as(db,uid,async()=>(await db.query('SELECT public.'+name+'('+args.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')+') AS value',args)).rows[0].value);
const create=(db,uid=U,rid=R,title='로그인 오류',body='합성 오류 설명',diagnostics={})=>call(db,uid,'ps_support_create',[rid,title,body,JSON.stringify(diagnostics)],['uuid','text','text','jsonb']);
const list=(db,uid=U,limit=20,before=null)=>call(db,uid,'ps_support_list',[limit,before==null?null:JSON.stringify(before)],['integer','jsonb']);
const get=(db,uid=U,rid=R)=>call(db,uid,'ps_support_get',[rid],['uuid']);
const reply=(db,uid=U,rid=R,qid=REPLY,body='합성 추가 설명')=>call(db,uid,'ps_support_reply',[qid,rid,body],['uuid','uuid','text']);
const diagnostic={capturedAt:'2026-09-15T01:02:03.456Z',environment:{appVersion:'2.813',browser:'Safari 18.0',os:'iOS',viewport:{width:393,height:852},screen:{width:393,height:852},language:'ko-KR',timeZone:'Asia/Seoul',online:true,displayMode:'standalone',path:'/studio/app.html'},logs:[{at:'2026-09-15T01:02:00.000Z',kind:'storage',name:'StorageConflictError',code:'sync_conflict',stage:'items-save',category:'conflict',source:'/studio/storage.js',line:450,column:12,frames:[{source:'/studio/sync.js',line:300,column:8}]}]};
const clone=v=>JSON.parse(JSON.stringify(v));
async function baseline(db){return (await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY k) FROM public.ps_kv t) rows,
  (SELECT jsonb_build_object('acl',relacl::text,'rls',relrowsecurity) FROM pg_class WHERE oid='public.ps_kv'::regclass) security,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY polname) FROM pg_policy p WHERE polrelid='public.ps_kv'::regclass) policies,
  (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) ORDER BY proname) FROM pg_proc WHERE oid IN ('public.ps_is_admin()'::regprocedure,'auth.uid()'::regprocedure)) helpers`)).rows[0];}
async function run(){
 const db=new PGlite();
 try{
  await db.exec(read('local-fixture.sql'));
  for(const uid of [A,U,V,TEAM_ADMIN])await db.query('INSERT INTO auth.users VALUES($1)',[uid]);
  await db.query('INSERT INTO public.ps_admins VALUES($1)',[A]);
  await db.query("INSERT INTO public.ps_members VALUES($1,'admin')",[TEAM_ADMIN]);
  await db.query("INSERT INTO public.ps_kv VALUES('sentinel','unrelated synthetic app value')");
  const original=await baseline(db);
  await db.exec(read('preflight.sql'));await db.exec(read('sql'));await db.exec(read('sql'));await db.exec(read('verify.sql'));
  equal(await baseline(db),original,'repeat installation preserves existing app rows/helpers/policies/grants');
  for(const signature of ['public.ps_support_get(uuid)','public.ps_support_text(jsonb,text,integer)']){
    await db.exec('ALTER FUNCTION '+signature+' RESET search_path');
    equal((await db.query('SELECT proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0].proconfig,null,'fixture really removes all function-local settings');
    await fail(async()=>{try{await db.exec(read('verify.sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','verification rejects NULL search_path for '+signature);
    await db.exec('ALTER FUNCTION '+signature+' SET search_path=public');
    await fail(async()=>{try{await db.exec(read('verify.sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','verification rejects unsafe search_path for '+signature);
    await db.exec('ALTER FUNCTION '+signature+' SET search_path=pg_catalog');
    await db.exec(read('verify.sql'));
  }
  for(const table of ['ps_support_reports','ps_support_replies'])for(const role of ['anon','authenticated'])for(const statement of ['SELECT * FROM ','DELETE FROM ','INSERT INTO ']){
    await fail(()=>as(db,role==='authenticated'?A:null,()=>db.query(statement+'public.'+table+(statement==='INSERT INTO '?' DEFAULT VALUES':'')),role),'42501','direct '+statement.trim()+' denied '+role+' '+table);
  }
  for(const rpc of ['ps_support_list(20,null)','ps_support_get(null)','ps_support_create(null,null,null,null)','ps_support_reply(null,null,null)']){
    await fail(()=>as(db,null,()=>db.query('SELECT public.'+rpc),'anon'),'42501','anonymous RPC denied '+rpc);
    await fail(()=>as(db,null,()=>db.query('SELECT public.'+rpc)),'42501','missing JWT subject rejected '+rpc);
  }
  await fail(()=>as(db,U,()=>db.query("SELECT public.ps_support_validate_diagnostics('{}')")),'42501','internal validation helper not exposed');
  const first=await create(db,U,R,'로그인 오류','합성 오류 설명',diagnostic);
  equal(first.is_own,true,'server marks reporter ownership');equal(Object.hasOwn(first,'reporter_id'),false,'report metadata omits account ID');
  equal(await create(db,U,R,'로그인 오류','합성 오류 설명',diagnostic),first,'exact retry idempotent');
  equal((await db.query('SELECT count(*)::int n FROM public.ps_support_reports')).rows[0].n,1,'idempotent retry does not duplicate report');
  for(const [who,title,body,d] of [[V,'로그인 오류','합성 오류 설명',diagnostic],[U,'다른 제목','합성 오류 설명',diagnostic],[U,'로그인 오류','수정한 설명',diagnostic],[U,'로그인 오류','합성 오류 설명',{}]])
    await fail(()=>create(db,who,R,title,body,d),'PT409','same UUID cannot overwrite prior report');
  await create(db,V,OTHER,'다른 사용자','비공개 합성 본문');
  for(const uid of [V,TEAM_ADMIN]){
    await fail(()=>get(db,uid),'PT404','other user/team admin cannot inspect private report');
    await fail(()=>reply(db,uid),'PT404','other user/team admin cannot reply on private report');
  }
  await fail(()=>get(db,U,id(999)),'PT404','missing report matches unauthorized report response');
  equal((await list(db,U)).reports.map(r=>r.id),[R],'reporter list excludes other accounts');
  equal((await list(db,TEAM_ADMIN)).reports,[],'team administrator sees no private support reports');
  const all=await list(db,A);equal(all.reports.length,2,'platform administrator sees reports');equal(all.is_admin,true,'admin context is server derived');
  for(const row of all.reports){equal(Object.hasOwn(row,'body'),false,'list omits body');equal(Object.hasOwn(row,'diagnostics'),false,'list omits diagnostic logs');equal(Object.hasOwn(row,'reporter_id'),false,'list omits account ID');}
  equal((await get(db,A)).report.diagnostics,diagnostic,'platform admin may inspect consenting diagnostics');
  const collector=require('../studio/support-diagnostics.js'),collected=collector.snapshot();
  collected.logs=[collector.sanitizeLog('storage',{name:'StorageOwnerChangedError',code:'sync_storage',stage:'migration:PRIVATE_ID'},null,Date.now())];
  await create(db,U,id(103),'수집기 계약','실제 수집기 출력 검증',collected);
  equal((await get(db,U,id(103))).report.diagnostics,collected,'actual collector output satisfies SQL diagnostics contract');
  const cssDiagnostic=clone(diagnostic);cssDiagnostic.logs[0].source='/studio/support.css';
  await create(db,U,id(104),'정적 자원','CSS 로드 오류 위치',cssDiagnostic);
  equal((await get(db,U,id(104))).report.diagnostics,cssDiagnostic,'static CSS error locations satisfy diagnostics contract');
  const q=await reply(db);equal(q.author_role,'reporter','reporter role assigned server-side');equal(Object.hasOwn(q,'actor_id'),false,'reply omits account ID');
  const beforeRetry=(await get(db)).report.updated_at;
  equal(await reply(db),q,'exact reply retry idempotent');equal((await get(db)).report.updated_at,beforeRetry,'reply retry does not move update time');
  await fail(()=>reply(db,U,R,REPLY,'다른 내용'),'PT409','same reply UUID cannot overwrite body');
  await fail(()=>reply(db,V,OTHER,REPLY,'합성 추가 설명'),'PT409','foreign UUID collision cannot transplant reply');
  const adminReply=await reply(db,A,R,id(202),'운영자 합성 답변');equal(adminReply.author_role,'admin','service administrator badge assigned by server');
  const detail=await get(db);equal(detail.replies.length,2,'reporter sees own and admin replies');equal(detail.replies[1].is_own,false,'admin reply is not attributed to reporter');
  equal((await list(db)).reports.find(r=>r.id===R).reply_count,2,'list reports accurate reply count');equal((await list(db)).reports.find(r=>r.id===R).last_reply_at,adminReply.created_at,'list exposes server reply timestamp');
  await db.query('DELETE FROM public.ps_admins WHERE user_id=$1',[A]);
  await fail(()=>get(db,A),'PT404','revoked platform admin loses detail immediately');
  await fail(()=>reply(db,A,R,id(203)),'PT404','revoked platform admin cannot send replies');
  equal((await list(db,A)).is_admin,false,'revoked role not cached');await db.query('INSERT INTO public.ps_admins VALUES($1)',[A]);
  await db.query('DELETE FROM public.ps_members WHERE user_id=$1',[TEAM_ADMIN]);
  equal((await get(db)).report.id,R,'report access depends on account, not team membership');
  for(const [title,body] of [['','x'],['   ','x'],['\t\n','x'],['\u000b','x'],['x',''],['x','   '],['x','\n\r'],['x','\u000b'],['x'.repeat(121),'x'],['x','x'.repeat(8001)],[null,'x'],['x',null]])await fail(()=>create(db,U,id(301),title,body),'22023','invalid title/body rejected');
  for(const body of ['',null,'   ','\r\n\t','\u000b','x'.repeat(4001)])await fail(()=>reply(db,U,R,id(302),body),'22023','invalid reply rejected');
  const vReport=await create(db,U,id(305),'v','v');
  equal(vReport.title,'v','a literal v title is preserved, not treated as whitespace');
  equal((await get(db,U,id(305))).report.body,'v','a literal v report body is preserved');
  equal((await reply(db,U,id(305),id(306),'v')).body,'v','a literal v reply body is preserved');
  await create(db,U,id(307),'\u000bview v\u000b','\u000breview v\u000b');
  const verticalTrim=await get(db,U,id(307));
  equal(verticalTrim.report.title,'view v','vertical tabs trim without removing leading/trailing v');
  equal(verticalTrim.report.body,'review v','report trim retains final literal v');
  equal((await reply(db,U,id(307),id(308),'\u000breview v\u000b')).body,'review v','reply trim removes vertical tabs only');
  await create(db,U,id(303),'한'.repeat(120),'글'.repeat(8000),{});await reply(db,U,R,id(304),'글'.repeat(4000));
  equal((await get(db,U,id(303))).report.body.length,8000,'Unicode character limits accept boundary');
  await fail(()=>create(db,U,null),'22023','client report UUID required');await fail(()=>reply(db,U,R,null),'22023','client reply UUID required');
  const invalid=[];
  invalid.push(null,[],{raw:'secret'},'x'.repeat(50000));
  function bad(change){const v=clone(diagnostic);change(v);invalid.push(v);}
  bad(v=>v.token='secret');bad(v=>v.environment.userAgent='raw agent');bad(v=>v.environment.online='true');bad(v=>v.environment.path='/studio/app.html?access_token=secret');
  bad(v=>v.environment.path='/studio/../private.html');bad(v=>v.environment.os='arbitrary raw user agent');bad(v=>v.environment.browser='unrecognized raw user agent');
  bad(v=>v.environment.viewport.width=-1);bad(v=>v.environment.screen.height=20001);bad(v=>v.environment.viewport.height=1.5);bad(v=>v.environment.language=null);
  bad(v=>delete v.environment.displayMode);bad(v=>v.environment.displayMode='installed');bad(v=>v.capturedAt='tomorrow');bad(v=>v.capturedAt='2026-99-99T00:00:00Z');
  bad(v=>v.logs=Array(41).fill(v.logs[0]));bad(v=>v.logs[0].message='raw error message');bad(v=>v.logs[0].frames=Array(6).fill(v.logs[0].frames[0]));
  bad(v=>v.logs[0].source='https://private.example/path');bad(v=>v.logs[0].line=10000001);bad(v=>v.logs[0].column='1');bad(v=>v.logs[0].name='raw error text');
  bad(v=>v.logs[0].code='access_token=secret');bad(v=>v.logs[0].stage='raw message with spaces');bad(v=>v.logs[0].category='private');bad(v=>v.logs[0].kind='console');
  bad(v=>v.logs[0].frames[0].functionName='private name');bad(v=>v.environment.timeZone='x'.repeat(65));bad(v=>v.logs[0].frames=null);bad(v=>v.logs[0].at=null);
  for(const [i,payload] of invalid.entries())await fail(()=>create(db,U,id(400+i),'합성','검증',payload),'22023','diagnostic allowlist/size case '+i);
  const countBefore=(await db.query('SELECT count(*)::int n FROM public.ps_support_reports')).rows[0].n;
  await fail(()=>create(db,U,id(501),'a','b',{capturedAt:'x'.repeat(50000)}),'22023','oversized diagnostic payload rejected');
  equal((await db.query('SELECT count(*)::int n FROM public.ps_support_reports')).rows[0].n,countBefore,'invalid diagnostics never insert reports');
  for(let i=0;i<7;i++)await create(db,U,id(600+i),'페이지 '+i,'합성 목록');
  await db.query("UPDATE public.ps_support_reports SET created_at='2026-09-15T01:00:00Z' WHERE reporter_id=$1",[U]);
  const seen=[];let cursor=null;
  do{const page=await list(db,U,3,cursor);seen.push(...page.reports.map(x=>x.id));cursor=page.next_cursor;}while(cursor);
  equal(new Set(seen).size,seen.length,'cursor tie-break never duplicates report');
  equal(seen.length,(await db.query('SELECT count(*)::int n FROM public.ps_support_reports WHERE reporter_id=$1',[U])).rows[0].n,'cursor tie-break never skips reports');
  for(const limit of [null,0,51,-1])await fail(()=>list(db,U,limit),'22023','invalid list limit rejected');
  for(const cursor of [{},[],{created_at:'today',id:R},{created_at:'2026-09-15T00:00:00Z',id:'bad'},{created_at:'2026-09-15T00:00:00Z',id:R,reporter_id:V}])await fail(()=>list(db,U,20,cursor),'22023','invalid cursor rejected');
  const counts=(await db.query('SELECT (SELECT count(*)::int FROM public.ps_support_reports) reports,(SELECT count(*)::int FROM public.ps_support_replies) replies')).rows[0];
  await db.exec(read('verify.sql'));await db.exec(read('rollback.sql'));await db.exec(read('rollback.sql'));
  equal((await db.query('SELECT (SELECT count(*)::int FROM public.ps_support_reports) reports,(SELECT count(*)::int FROM public.ps_support_replies) replies')).rows[0],counts,'rollback preserves all reports/replies');
  await fail(()=>get(db,U),'42501','rollback disables feature RPCs');equal(await baseline(db),original,'rollback leaves unrelated app security unchanged');
  await db.exec(read('sql'));equal((await get(db)).replies.length,3,'reinstall restores preserved reports and replies');
  await db.exec("COMMENT ON TABLE public.ps_support_reports IS 'foreign owner'");
  for(const file of ['sql','rollback.sql'])await fail(async()=>{try{await db.exec(read(file));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','foreign ownership marker blocks '+file);
  console.log(JSON.stringify({ok:true,assertions,method:'PGlite synthetic JWT/RLS; no network or production records',privateReports:true,serverAuthorRoles:true,idempotentCreateAndReply:true,diagnosticAllowlist:true,cursorTies:true,rollbackPreservesData:true},null,2));
 }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
