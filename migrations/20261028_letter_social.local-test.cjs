const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const stem=path.join(__dirname,'20261028_letter_social');
const fixture=`create schema auth;
create role anon;create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`;
async function setup(){const db=new PGlite();await db.exec(fixture);await db.exec(fs.readFileSync(stem+'.sql','utf8'));return db;}
async function call(db,uid,name,args){
  return db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid||'']);
    await tx.exec('set local role '+(uid?'authenticated':'anon'));
    return (await tx.query('select * from public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+')',args)).rows.map(r=>({...r,readers:Number(r.readers),likes:Number(r.likes)}));
  });
}
async function test(){
  const db=await setup(),v='11111111-1111-4111-8111-111111111111',v2='22222222-2222-4222-8222-222222222222',u='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',u2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try{
    let rows=await call(db,null,'ps_letter_stats',[v]);assert.equal(rows.length,46);assert.ok(rows.every(r=>!r.readers&&!r.likes&&!r.liked));
    const act=(uid,visitor,action,liked=null,n=3)=>call(db,uid,'ps_letter_engage',[n,visitor,action,liked]).then(r=>r[0]);
    assert.deepEqual(await act(null,v,'read'),{issue:3,readers:1,likes:0,liked:false});
    assert.equal((await act(null,v,'read')).readers,1,'reload is deduplicated');
    assert.deepEqual(await act(null,v,'like',true),{issue:3,readers:1,likes:1,liked:true});
    assert.equal((await act(null,v,'like',true)).likes,1,'retries set a desired state, not increment');
    assert.equal((await act(null,v2,'read')).readers,2);
    assert.equal((await call(db,null,'ps_letter_stats',[v2])).find(r=>r.issue===3).liked,false);
    assert.deepEqual(await act(u,v,'read'),{issue:3,readers:2,likes:1,liked:true},'guest read and reaction follow login');
    assert.equal((await act(u,v2,'read')).readers,1,'another browser of the same account merges its guest record');
    assert.equal((await act(u,null,'read')).readers,1,'signed-in storage-blocked reader is still deduplicated');
    assert.deepEqual(await act(u,null,'like',false),{issue:3,readers:1,likes:0,liked:false});
    assert.equal((await act(u2,v,'read')).readers,2,'different account stays separate');
    assert.equal((await act(u2,v,'like',true)).likes,1);
    assert.equal((await call(db,u,'ps_letter_stats',[v])).find(r=>r.issue===3).liked,false,'another account cannot inherit a reaction');
    assert.equal((await act(null,v,'like',true,4)).readers,0,'liking does not fabricate a read');
    for(const args of [[99,v,'read',null],[3,null,'read',null],[3,v,'bad',null],[3,v,'like',null]])await assert.rejects(call(db,null,'ps_letter_engage',args));
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select * from public.ps_letter_readers');}),/permission denied/);
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("delete from public.ps_letter_readers");}),/permission denied/);
    await db.exec(fs.readFileSync(stem+'.sql','utf8'));assert.equal((await call(db,null,'ps_letter_stats',[v])).find(r=>r.issue===3).readers,2,'reapply preserves counts');
    await db.exec(fs.readFileSync(stem+'.verify.sql','utf8'));
    await db.exec(fs.readFileSync(stem+'.rollback.sql','utf8'));await assert.rejects(call(db,null,'ps_letter_stats',[v]),/permission denied/);
    await db.exec(fs.readFileSync(stem+'.sql','utf8'));assert.equal((await call(db,null,'ps_letter_stats',[v])).length,46);
    console.log('Letter SQL: anonymous/account counts, merging, reactions, access control, reapply and rollback passed.');
  }finally{await db.close();}
}
module.exports={setup,call};
if(require.main===module)test().catch(e=>{console.error(e);process.exitCode=1;});
