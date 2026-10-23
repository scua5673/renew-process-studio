'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8'),mine=s=>read('20261023_support_images'+s);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),A=id(1),U=id(2),V=id(3),T=id(4),R=id(101);
const jpeg=Buffer.from([255,216,255,192,0,17,8,0,10,0,20,3,1,17,0,2,17,1,3,17,1,255,218,0,8,1,1,0,0,63,0,0,255,217]);
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
async function fail(fn,code){let error;try{await fn();}catch(e){error=e;}assert.ok(error,'expected '+code);eq(error.code,code);}
async function as(db,uid,fn,role='authenticated'){await db.exec('BEGIN');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);await db.exec('SET LOCAL ROLE '+role);const r=await fn();await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
const call=(db,uid,name,args,types)=>as(db,uid,async()=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')+') v',args)).rows[0].v);
const create=(db,uid=U,rid=R,data=jpeg.toString('base64'),title='합성 제보')=>call(db,uid,'ps_support_create_image',[rid,title,'합성 본문','{}',data],['uuid','text','text','jsonb','text']);
const get=(db,uid=U,rid=R)=>call(db,uid,'ps_support_get_with_image',[rid],['uuid']);
const image=(db,uid=U,rid=R)=>call(db,uid,'ps_support_image_get',[rid],['uuid']);
(async()=>{const db=new PGlite();try{
 await db.exec(read('20260915_support_reports.local-fixture.sql'));
 for(const uid of [A,U,V,T])await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into public.ps_admins values($1)',[A]);await db.query("insert into public.ps_members values($1,'admin')",[T]);
 await db.exec(read('20260915_support_reports.sql'));
 const before=(await db.query("select oid::regprocedure::text name,pg_get_functiondef(oid) def,proacl::text acl from pg_proc where pronamespace='public'::regnamespace order by 1")).rows;
 await db.exec(mine('.preflight.sql'));await db.exec(mine('.sql'));await db.exec(mine('.sql'));await db.exec(mine('.verify.sql'));
 const after=(await db.query("select oid::regprocedure::text name,pg_get_functiondef(oid) def,proacl::text acl from pg_proc where pronamespace='public'::regnamespace order by 1")).rows;
 eq(after.filter(x=>before.some(y=>y.name===x.name)),before,'existing RPCs/helpers unchanged');
 for(const role of ['anon','authenticated'])for(const sql of ['select * from public.ps_support_images','delete from public.ps_support_images','insert into public.ps_support_images default values'])await fail(()=>as(db,role==='anon'?null:A,()=>db.query(sql),role),'42501');
 for(const expr of ["ps_support_create_image(null,null,null,null,null)","ps_support_get_with_image(null)","ps_support_image_get(null)"]){await fail(()=>as(db,null,()=>db.query('select public.'+expr),'anon'),'42501');await fail(()=>as(db,null,()=>db.query('select public.'+expr)),'42501');}
 await fail(()=>as(db,U,()=>db.query('select public.ps_support_image_info(null)')),'42501');
 const first=await create(db);eq(first.id,R);eq(first.image.width,20);eq(first.image.height,10);eq(first.image.hash,require('node:crypto').createHash('sha256').update(jpeg).digest('hex'));
 eq(await create(db),first,'uncertain retry is idempotent');eq((await image(db)).data,jpeg.toString('base64'));eq((await image(db,A)).data,jpeg.toString('base64'));eq((await get(db)).image.hash,first.image.hash);eq((await get(db)).report.title,'합성 제보');
 for(const uid of [V,T]){await fail(()=>image(db,uid),'PT404');await fail(()=>get(db,uid),'PT404');}
 await fail(()=>image(db,U,id(999)),'PT404');await fail(()=>create(db,V),'PT409');await fail(()=>create(db,U,R,jpeg.toString('base64'),'다른 내용'),'PT409');
 const changed=Buffer.from(jpeg);changed[30]=1;await fail(()=>create(db,U,R,changed.toString('base64')),'PT409');
 const old=await call(db,U,'ps_support_create',[id(102),'글만','그대로','{}'],['uuid','text','text','jsonb']);eq((await get(db,U,old.id)).image,null);await fail(()=>create(db,U,old.id),'PT409');
 for(const data of ['',null,'<svg onload=alert(1)>','data:image/jpeg;base64,'+jpeg.toString('base64'),'A'.repeat(699056),Buffer.alloc(34).toString('base64')])await fail(()=>create(db,U,id(103),data),'22023');
 const large=Buffer.from(jpeg);large[9]=32;large[10]=0;await fail(()=>create(db,U,id(103),large.toString('base64')),'22023');
 eq((await db.query('select count(*)::int n from public.ps_support_reports where id=$1',[id(103)])).rows[0].n,0,'invalid image never creates text-only report');
 for(let i=0;i<19;i++)await create(db,U,id(200+i));await fail(()=>create(db,U,id(300)),'PT429');eq((await create(db)).id,R,'exact retry remains allowed at quota');
 eq((await db.query('select count(*)::int n from public.ps_support_images')).rows[0].n,20);
 await create(db,V,id(400));await db.query('delete from public.ps_support_reports where id=$1',[id(400)]);eq((await db.query('select count(*)::int n from public.ps_support_images where report_id=$1',[id(400)])).rows[0].n,0,'deleting a report removes its image');
 await db.exec(mine('.rollback.sql'));eq((await db.query('select count(*)::int n from public.ps_support_images')).rows[0].n,20,'rollback preserves attachments');await db.exec(mine('.sql'));eq((await image(db)).data,jpeg.toString('base64'));
 await db.exec("comment on table public.ps_support_images is 'foreign owner'");await fail(async()=>{try{await db.exec(mine('.sql'));}catch(e){await db.exec('rollback');throw e;}},'P0001');
 console.log(JSON.stringify({passed:true,checks,private:true,atomic:true,idempotent:true,limited:true,method:'isolated PGlite, no network or production writes'}));
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
