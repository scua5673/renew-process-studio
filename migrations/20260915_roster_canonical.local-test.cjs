'use strict';
// Pure in-memory PostgreSQL, synthetic JWT identities and fixture records only.
// No application configuration, credentials, network or production connection.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=s=>fs.readFileSync(path.join(__dirname,'20260915_roster_canonical.'+s),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const OWNER=id(1),COACH=id(2),STAFF=id(3),PLAYER=id(4),OUTSIDER=id(5),W=id(100),X=id(101);
const MAIN='scout_tool_v1',SQUAD='cs_squad_v1',ATTRS='cs_team_attrs_v1',PD='cs_player_del_v1',OTHER='cs_team_notice_v1';
const clone=v=>JSON.parse(JSON.stringify(v)),json=JSON.stringify;
let assertions=0,request=1000;const cases=[];
const rid=()=>id(++request);
function equal(a,b,label){assert.deepEqual(a,b,label);assertions++;}
function ok(v,label){assert.ok(v,label);assertions++;}
async function rejects(fn,codes,label){let error;try{await fn();}catch(e){error=e;}ok(error,label+' must fail');ok([].concat(codes).includes(error.code),label+' SQLSTATE '+error.code);return error;}
async function actor(db,uid,fn,role='authenticated'){
  await db.exec('BEGIN');try{
    const claims=JSON.stringify(uid?{sub:uid,role}:{role});
    for(const [k,v] of Object.entries({'request.jwt.claims':claims,'request.jwt.claim':claims,'request.jwt.claim.sub':uid||'','request.jwt.claim.role':role}))await db.query('SELECT set_config($1,$2,true)',[k,v]);
    await db.exec('SET LOCAL ROLE '+role);
    equal((await db.query("SELECT current_user actor,auth.uid()::text uid,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) bypass,(SELECT relowner=current_user::regrole FROM pg_class WHERE oid='public.ps_kv'::regclass) owns_table")).rows[0],{actor:role,uid:uid||null,bypass:false,owns_table:false},'unprivileged JWT actor actually used');
    const result=await fn();await db.exec('COMMIT');return result;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
const rpc=(db,uid,name,args,types)=>actor(db,uid,async()=>(await db.query('SELECT public.ps_roster_canonical_'+name+'('+args.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')+') AS result',args)).rows[0].result);
const status=(db,uid=OWNER,wid=W)=>rpc(db,uid,'status',[wid],['uuid']);
const snapshot=(db,uid=OWNER,wid=W)=>rpc(db,uid,'read',[wid],['uuid']);
const activate=(db,expected,uid=OWNER,wid=W,requestId=rid())=>rpc(db,uid,'activate',[wid,requestId,json(expected)],['uuid','uuid','jsonb']);
const mutate=(db,changes=[],meta=null,order=null,{uid=OWNER,wid=W,requestId=rid()}={})=>rpc(db,uid,'mutate',[wid,requestId,json(changes),meta===null?null:json(meta),order===null?null:json(order)],['uuid','uuid','jsonb','jsonb','jsonb']);
const records=(db,wid=W)=>db.query('SELECT k,v,cupd FROM public.ps_kv WHERE workspace_id=$1 ORDER BY k',[wid]).then(r=>r.rows);
const protectedRows=rows=>rows.filter(r=>[MAIN,SQUAD,ATTRS,PD].includes(r.k)||r.k.startsWith('sq:'));
const getRow=(rows,k)=>{const row=rows.find(r=>r.k===k);assert.ok(row,'expected row '+k);return row;};
const change=(rows,p)=>({id:p.id,expected_raw:getRow(rows,'sq:'+p.id).v,expected_cupd:getRow(rows,'sq:'+p.id).cupd,player:p});
const metaChange=(rows,values,removeKeys=[])=>({expected_raw:getRow(rows,MAIN).v,expected_cupd:getRow(rows,MAIN).cupd,values,removeKeys});
const orderChange=(rows,ids)=>({expected_cupd:getRow(rows,MAIN).cupd,ids});
function mainDoc(n=44){return {attrs:[{id:'passing',name:'Passing',cat:'tech',q:'Synthetic team question'}],positions:[{id:'cb',name:'CB',req:{passing:3}}],players:Array.from({length:n},(_,i)=>({id:'p'+i,name:i<2?'Same name':'Synthetic '+i,num:String(i+1),posId:'cb',grp:i<26?'A':'B',status:'ok',levels:{passing:i===0?0:3},memo:'original '+i})),meta:{teamName:'Synthetic team',evalMode:'fifa',activeEvalSetId:'synthetic-set',statusRuns:{p0:[{s:'injury',from:'2026-09-10',to:'2026-09-12'}]},participationDays:{'2026-09-11':{p0:{s:'ok',kind:'train',at:1,n:'keep exact record'}}}},_items:{build:'2.825',n},custom:{preserve:['exact',0,false]}};}
async function seed(db,wid=W,n=44){
  await db.query('INSERT INTO public.ps_workspaces(id,name,owner_id) VALUES($1,$2,$3)',[wid,'Synthetic roster '+wid,OWNER]);
  for(const [uid,role] of [[OWNER,'owner'],[COACH,'member'],[STAFF,'member'],[PLAYER,'member']])await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[wid,uid,role]);
  const perms={defaultRole:'player',members:{[OWNER]:{role:'admin'},[COACH]:{role:'executive'},[STAFF]:{role:'staff'},[PLAYER]:{role:'player'}}};
  const main=mainDoc(n),squad={name:main.meta.teamName,players:main.players.map(p=>({id:p.id,name:p.name,num:p.num,pos:'CB',foot:'',bench:false,status:p.status,grp:p.grp}))};
  const entries=[[MAIN,json(main)],[SQUAD,json(squad)],[ATTRS,json({attrs:main.attrs,positions:main.positions})],[PD,json({'retired-player':42})],['sq:retired-player',json({_del:42})],['cs_perms_v1',json(perms)],[OTHER,json({sentinel:'unrelated exact original'})],['cs_scout_targets_v1',json({v:1,players:[{id:'private-candidate',type:'target',name:'Private synthetic candidate',memo:'never publish'}]})],...main.players.map(p=>['sq:'+p.id,json(p)])];
  for(const [i,[k,v]] of entries.entries())await db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,$3,$4)',[wid,k,v,100+i]);
  return main;
}
async function catalog(db){return (await db.query(`SELECT
 (SELECT jsonb_build_object('acl',relacl::text,'rls',relrowsecurity,'force',relforcerowsecurity,'owner',relowner) FROM pg_class WHERE oid='public.ps_kv'::regclass) table_security,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY polname) FROM pg_policy p WHERE polrelid='public.ps_kv'::regclass) policies,
 (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) ORDER BY proname) FROM pg_proc WHERE oid IN ('public.ps_is_member(uuid)'::regprocedure,'public.ps_is_owner(uuid)'::regprocedure,'public.ps_team_role(uuid)'::regprocedure,'public.ps_key_scope(text)'::regprocedure,'public.ps_can_read_key(uuid,text)'::regprocedure,'public.ps_can_write_key(uuid,text)'::regprocedure)) helpers`)).rows[0];}
async function run(){const db=new PGlite();try{
  await db.exec(fs.readFileSync(path.join(__dirname,'20260913_scout_write_scope.local-fixture.sql'),'utf8'));await db.exec(read('local-fixture.sql'));
  const baseline=await catalog(db),main=await seed(db);await seed(db,X,3);
  await db.exec(read('sql'));const installedRows=await records(db);
  await rejects(async()=>{try{await db.exec(read('sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'55000','fresh-install migration refuses overwriting existing objects');
  equal(await catalog(db),baseline,'installation and refused reinstallation preserve original grants/RLS/policies/helpers');equal(await records(db),installedRows,'refused reinstallation preserves all data');
  if(fs.existsSync(path.join(__dirname,'20260915_roster_canonical.verify.sql')))await db.exec(read('verify.sql'));
  async function check(name,fn){try{await fn();cases.push(name);}catch(e){e.testCase=name;throw e;}}

  await check('inactive capabilities disclose no document and require membership',async()=>{
    const s=await status(db);equal(s.protocol,1,'server protocol');equal(s.enabled,false,'installation alone does not activate team');
    equal(Object.hasOwn(s,'rows'),false,'status contains no player payload');await rejects(()=>status(db,OUTSIDER),'42501','nonmember status');
    await rejects(()=>status(db,null),'42501','missing JWT');await rejects(()=>actor(db,null,()=>db.query('SELECT public.ps_roster_canonical_status($1)',[W]),'anon'),'42501','anonymous RPC');
  });
  await check('activation requires exact complete preimage and team owner',async()=>{
    const before=await records(db),expected=protectedRows(before);
    await rejects(()=>activate(db,expected,COACH),'42501','executive cannot activate');
    for(const variant of [expected.slice(1),expected.map((r,i)=>i? r:{...r,cupd:Number(r.cupd)+1}),expected.map((r,i)=>i? r:{...r,v:r.v+' '})]){
      await rejects(()=>activate(db,variant),'PT409','mismatched activation snapshot');equal(await records(db),before,'failed activation changes no values/cupd');equal((await status(db)).enabled,false,'mismatch never opts in');
    }
  });
  await check('divergent main row and tombstone live conflicts prevent activation',async()=>{
    const old=getRow(await records(db),'sq:p0');await db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',[json({...main.players[0],grp:'STALE'}),W,old.k]);
    const before=await records(db);await rejects(()=>activate(db,protectedRows(before)),['PT409','22023'],'row/main mismatch');equal(await records(db),before,'mismatch preserved exactly');await db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',[old.v,W,old.k]);
    const pd=getRow(await records(db),PD);await db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',[json({p0:99,'retired-player':42}),W,PD]);
    const tombBefore=await records(db);await rejects(()=>activate(db,protectedRows(tombBefore)),['PT409','22023'],'live player in tomb map');equal(await records(db),tombBefore,'tomb conflict never repaired by implicit resurrection');await db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',[pd.v,W,PD]);
  });
  await check('44 main players and 27 extra legacy rows never activate as a 71-player union',async()=>{
    for(let i=0;i<27;i++)await db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,$3,777)',[W,'sq:legacy-'+i,json({...main.players[i],id:'legacy-'+i,grp:''})]);
    const before=await records(db);await rejects(()=>activate(db,protectedRows(before)),['PT409','22023'],'extra ungrouped old rows');equal(await records(db),before,'refusal preserves every original for explicit recovery');equal((await status(db)).enabled,false,'no activation or implicit 71-player union');
    await db.query("DELETE FROM public.ps_kv WHERE workspace_id=$1 AND k LIKE 'sq:legacy-%'",[W]);
  });
  await check('successful activation and exact retry preserve roster identity/order and originals',async()=>{
    const before=await records(db),requestId=rid(),expected=protectedRows(before),first=await activate(db,expected,OWNER,W,requestId);
    equal((await status(db)).enabled,true,'explicit compatible activation');equal(await activate(db,expected,OWNER,W,requestId),first,'same activation request returns exact ACK');
    const result=await snapshot(db);equal(result.enabled,true,'read enabled');equal(result.order,main.players.map(p=>p.id),'initial complete stable order');equal(JSON.parse(getRow(result.rows,MAIN).v).players,main.players,'44 confirmed players stay exact, same-name IDs remain separate');
    equal(getRow(await records(db),'sq:retired-player').v,getRow(before,'sq:retired-player').v,'original tomb retained');equal(getRow(await records(db),'cs_scout_targets_v1'),getRow(before,'cs_scout_targets_v1'),'private candidates unchanged');
  });
  await check('activated protected keys reject legacy UPDATE and UPSERT atomically',async()=>{
    for(const key of [MAIN,SQUAD,ATTRS,PD,'sq:p0'])for(const operation of ['update','upsert']){
      const before=await records(db);await rejects(()=>actor(db,OWNER,()=>operation==='update'?db.query('UPDATE public.ps_kv SET v=$1,cupd=cupd+1 WHERE workspace_id=$2 AND k=$3',['{}',W,key]):db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,$3,99999) ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd',[W,key,'{}'])),'23514','legacy '+key+' '+operation);equal(await records(db),before,'legacy rejection exact rollback');
    }
    const before=await records(db);await rejects(()=>actor(db,OWNER,()=>db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,'{}',99999),($1,$3,'{}',99999) ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd",[W,OTHER,MAIN])),'23514','mixed obsolete UPSERT');equal(await records(db),before,'unrelated write in rejected statement also rolled back');
    await actor(db,OWNER,()=>db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',[json({sentinel:'separate request succeeds'}),W,OTHER]));equal(JSON.parse(getRow(await records(db),OTHER).v).sentinel,'separate request succeeds','separate unrelated update succeeds');
  });
  await check('legacy INSERT and DELETE cannot create or remove canonical players',async()=>{
    const before=await records(db);await rejects(()=>actor(db,OWNER,()=>db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'sq:legacy-extra',$2)",[W,json({id:'legacy-extra',name:'Old device'})])),'23514','legacy player insertion');
    await rejects(()=>actor(db,OWNER,()=>db.query("DELETE FROM public.ps_kv WHERE workspace_id=$1 AND k='sq:p0'",[W])),'23514','legacy player deletion');equal(await records(db),before,'legacy insert/delete kept all records');
  });
  await check('client roles cannot read private originals or forge exact internal write permits',async()=>{
    for(const role of ['authenticated','anon'])for(const table of ['control','backups','requests','write_permits'])for(const action of ['SELECT * FROM ','DELETE FROM ','INSERT INTO '])await rejects(()=>actor(db,role==='authenticated'?OWNER:null,()=>db.query(action+'ps_roster_private.'+table+(action==='INSERT INTO '?' DEFAULT VALUES':'')),role),'42501','private '+table+' '+action.trim()+' denied to '+role);
    await rejects(()=>actor(db,OWNER,()=>db.query("SELECT ps_roster_private.put($1,$2,'{}',42)",[W,MAIN])),'42501','private writer cannot be called directly');
    const before=await records(db);await rejects(()=>actor(db,OWNER,async()=>{for(const key of ['ps.roster_canonical','ps.roster_internal'])await db.query('SELECT set_config($1,$2,true)',[key,'1']);await db.query("SELECT set_config('request.headers',$1,true)",[json({'x-ps-roster-internal':'1'})]);return db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',['{}',W,MAIN]);}),'23514','client-set settings/headers do not authorize legacy writes');equal(await records(db),before,'forged authority changes no originals');
  });
  await check('row CAS atomically updates main and public squad while preserving metadata and other players',async()=>{
    const before=await snapshot(db),original=JSON.parse(getRow(before.rows,MAIN).v),next={...original.players[0],grp:'C',memo:'new private note',levels:{passing:0}};
    const requestId=rid(),changes=[change(before.rows,next)],result=await mutate(db,changes,null,null,{requestId});
    const after=await snapshot(db),saved=JSON.parse(getRow(after.rows,MAIN).v),squad=JSON.parse(getRow(after.rows,SQUAD).v);
    equal(saved.players.find(p=>p.id==='p0'),next,'main rebuild retains full row');equal(saved.meta,original.meta,'all unrelated metadata exact');equal(saved.custom,original.custom,'unknown root metadata retained');equal(saved.players.filter(p=>p.id!=='p0'),original.players.filter(p=>p.id!=='p0'),'unrelated 43 players unchanged');
    equal(squad.players.find(p=>p.id==='p0').grp,'C','public group updates atomically');equal(Object.hasOwn(squad.players.find(p=>p.id==='p0'),'memo'),false,'private note excluded from public mirror');equal(Object.hasOwn(squad.players.find(p=>p.id==='p0'),'levels'),false,'private evaluation excluded from mirror');equal(after.order,before.order,'edit never reorders roster');
    equal(await mutate(db,changes,null,null,{requestId}),result,'exact mutate retry returns original ACK');equal(await snapshot(db),after,'retry never changes revision or cupd');
    await rejects(()=>mutate(db,[{...changes[0],player:{...next,memo:'different payload'}}],null,null,{requestId}),'PT409','request ID cannot accept a different payload');
    await rejects(()=>mutate(db,changes,null,null,{uid:COACH,requestId}),'PT409','another actor cannot claim request ID');
    await rejects(()=>mutate(db,[{...changes[0],player:{...next,memo:'stale edit'}}]),'PT409','stale row CAS');equal(await snapshot(db),after,'stale writes preserve canonical result');
  });
  await check('metadata patch preserves current players and ordering is explicit complete CAS',async()=>{
    let before=await snapshot(db);const mainBefore=JSON.parse(getRow(before.rows,MAIN).v),meta={...mainBefore.meta,teamName:'Renamed on server'};
    await mutate(db,[],metaChange(before.rows,{meta}),null);let after=await snapshot(db);equal(JSON.parse(getRow(after.rows,MAIN).v).players,mainBefore.players,'metadata cannot rewrite players');equal(JSON.parse(getRow(after.rows,SQUAD).v).name,'Renamed on server','derived team name follows metadata');
    const player={...mainBefore.players[1],memo:'independent row edit after metadata'};await mutate(db,[change(before.rows,player)]);after=await snapshot(db);equal(JSON.parse(getRow(after.rows,MAIN).v).meta,meta,'row edit retains independently updated metadata');
    await rejects(()=>mutate(db,[],metaChange(before.rows,{custom:{stale:true}})),'PT409','stale metadata preimage');
    before=await snapshot(db);const reverse=before.order.slice().reverse();await mutate(db,[],null,orderChange(before.rows,reverse));after=await snapshot(db);equal(after.order,reverse,'explicit complete order applies');equal(JSON.parse(getRow(after.rows,MAIN).v).players.map(p=>p.id),reverse,'main follows canonical order');equal(JSON.parse(getRow(after.rows,SQUAD).v).players.map(p=>p.id),reverse,'squad follows canonical order');
    await rejects(()=>mutate(db,[],null,orderChange(before.rows,before.order)),'PT409','stale order cannot overwrite');
    for(const ids of [reverse.slice(1),reverse.concat(reverse[0])])await rejects(()=>mutate(db,[],null,orderChange(after.rows,ids)),['22023','PT409'],'order must contain exactly every live ID');
    for(const values of [{players:[]},{_items:{}}])await rejects(()=>mutate(db,[],metaChange(after.rows,values)),'22023','metadata cannot replace roster internals');
  });
  await check('public criteria mirror follows metadata through an explicit safe field list',async()=>{
    const before=await snapshot(db),doc=JSON.parse(getRow(before.rows,MAIN).v);
    const attrs=[{id:'passing',name:'Passing revised',cat:'tech',q:'Changed public question',w:'Public guidance',privateDraft:'not for public mirror'}];
    const positions=[{id:'cb',name:'좌 센터백',req:{passing:4},wantArch:'Public archetype',ideal:{passing:'Public ideal'},privateDraft:'private position draft'}];
    const meta={...doc.meta,cats:[{id:'tech',name:'Technique',privateDraft:'private category draft'}],grpBase:['A','B','C'],prompts:[{id:'prompt',q:'Public prompt',at:1,by:'coach',open:true,answer:'private answer'}],evalMode:'team',activeEvalSetId:'new-public-set'};
    await mutate(db,[],metaChange(before.rows,{attrs,positions,meta,exLinks:{passing:'https://example.invalid/synthetic'}}));const after=await snapshot(db),pub=JSON.parse(getRow(after.rows,ATTRS).v),squad=JSON.parse(getRow(after.rows,SQUAD).v);
    equal(pub.attrs,[{id:'passing',name:'Passing revised',cat:'tech',source:'',q:'Changed public question',w:'Public guidance'}],'public attrs refresh using safe fields');equal(pub.positions,[{id:'cb',name:'좌 센터백',req:{passing:4},wantArch:'Public archetype',ideal:{passing:'Public ideal'}}],'public positions refresh without drafts');equal(pub.cats,[{id:'tech',name:'Technique'}],'public categories omit private fields');equal(pub.prompts,[{id:'prompt',q:'Public prompt',at:1,by:'coach',open:1}],'public prompt does not expose answer');equal(pub.ex,{passing:'https://example.invalid/synthetic'},'public examples refresh');equal(pub.grpBase,['A','B','C'],'public group options refresh');equal(pub.evalMode,'team','evaluation mode refresh');equal(pub.setId,'new-public-set','evaluation set refresh');equal(squad.players.find(p=>p.id==='p0').bench,false,'absent bench has false compatibility value');equal(squad.players.find(p=>p.id==='p0').pos,'LCB','public position label follows revised positions');equal(JSON.parse(getRow(after.rows,MAIN).v).meta.participationDays,doc.meta.participationDays,'full participation record remains private and unchanged');
  });
  await check('explicit deletion keeps tombstones and blocks automatic recreation',async()=>{
    const before=await snapshot(db),row=getRow(before.rows,'sq:p2'),removed=JSON.parse(row.v);
    await mutate(db,[{id:'p2',expected_raw:row.v,expected_cupd:row.cupd,delete:true}]);const after=await snapshot(db),tomb=JSON.parse(getRow(after.rows,'sq:p2').v);
    ok(tomb._del,'durable SQ tomb');equal(after.order.includes('p2'),false,'deleted ID leaves canonical order');equal(JSON.parse(getRow(after.rows,MAIN).v).players.some(p=>p.id==='p2'),false,'main no deleted player');equal(JSON.parse(getRow(after.rows,SQUAD).v).players.some(p=>p.id==='p2'),false,'public mirror no deleted player');ok(JSON.parse(getRow(after.rows,PD).v).p2,'legacy deletion map follows canonical deletion');
    for(const expected of [{expected_raw:null,expected_cupd:null},{expected_raw:row.v,expected_cupd:row.cupd},{expected_raw:getRow(after.rows,'sq:p2').v,expected_cupd:getRow(after.rows,'sq:p2').cupd}])await rejects(()=>mutate(db,[{id:'p2',...expected,player:removed}]),['PT409','22023'],'ordinary mutation cannot resurrect tomb');equal(await snapshot(db),after,'resurrection attempts leave exact deletion');
    await rejects(()=>mutate(db,[{id:'p2',expected_raw:getRow(after.rows,'sq:p2').v,expected_cupd:getRow(after.rows,'sq:p2').cupd,delete:true}]),'PT409','repeat deletion cannot rewrite tombstone time');equal(await snapshot(db),after,'repeat delete leaves both tombstones exact');
  });
  await check('only an absent stable ID creates a new row and malformed mixed changes roll back',async()=>{
    let before=await snapshot(db);const player={id:'new-player',name:'Same name',num:'45',posId:'cb',grp:'B',status:'ok',levels:{passing:0},memo:'New complete original'};
    const add={id:player.id,expected_raw:null,expected_cupd:null,player};await mutate(db,[add]);let after=await snapshot(db);equal(after.order, before.order.concat(player.id),'new stable identity appends explicitly');equal(JSON.parse(getRow(after.rows,MAIN).v).players.find(p=>p.id===player.id),player,'new player exact in compatibility main');equal(JSON.parse(getRow(after.rows,SQUAD).v).players.some(p=>p.id===player.id),true,'new player appears in public projection');
    await rejects(()=>mutate(db,[add]),'PT409','stale absence cannot recreate existing player');equal(await snapshot(db),after,'stale absence no change');
    before=after;const valid={...player,memo:'must roll back'},validChange=change(before.rows,valid),other=JSON.parse(getRow(before.rows,'sq:p6').v),otherChange=change(before.rows,other);
    for(const bad of [{...validChange,id:'missing-id',expected_raw:null,expected_cupd:null,player:{...player,id:'mismatched-id'}},{...otherChange,extra:true},{...otherChange,player:{...other,type:'target'}},validChange]){
      await rejects(()=>mutate(db,[validChange,bad]),'22023','mixed malformed/duplicate/candidate change');equal(await snapshot(db),before,'all preceding valid row writes also roll back');
    }
  });
  await check('derived mirror failure rolls back rows, metadata, order and request receipt',async()=>{
    const before=await snapshot(db),next={...JSON.parse(getRow(before.rows,'sq:p3').v),grp:'FAIL'},requestId=rid(),changes=[change(before.rows,next)];
    await db.exec("CREATE FUNCTION public.fixture_roster_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.k='cs_squad_v1' THEN RAISE EXCEPTION 'synthetic derived failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$;CREATE TRIGGER zzz_fixture_roster_fail AFTER INSERT OR UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.fixture_roster_fail();");
    await rejects(()=>mutate(db,changes,null,null,{requestId}),'P0001','derived write failure');equal(await snapshot(db),before,'entire operation rolled back');await db.exec('DROP TRIGGER zzz_fixture_roster_fail ON public.ps_kv;DROP FUNCTION public.fixture_roster_fail();');
    await mutate(db,changes,null,null,{requestId});equal(JSON.parse(getRow((await snapshot(db)).rows,'sq:p3').v).grp,'FAIL','same ID retries after transaction rollback, no false receipt');
  });
  await check('a rewriting trigger cannot silently change the exact RPC output',async()=>{
    for(const [triggerName,code] of [['zzzy_fixture_roster_rewrite','23514'],['zzzzzz_fixture_roster_rewrite','PT409']]){
      const before=await snapshot(db),next={...JSON.parse(getRow(before.rows,'sq:p5').v),memo:'exact requested note '+triggerName},requestId=rid(),changes=[change(before.rows,next)];
      await db.exec("CREATE FUNCTION public.fixture_roster_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.k='scout_tool_v1' THEN NEW.v:=jsonb_set(NEW.v::jsonb,'{meta,teamName}','\"unexpected trigger rewrite\"')::text; END IF; RETURN NEW; END $$;CREATE TRIGGER "+triggerName+" BEFORE INSERT OR UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.fixture_roster_rewrite();");
      await rejects(()=>mutate(db,changes,null,null,{requestId}),code,'unexpected trigger rewrite '+triggerName);equal(await snapshot(db),before,'unexpected value and all earlier row writes rolled back');await db.exec('DROP TRIGGER '+triggerName+' ON public.ps_kv;DROP FUNCTION public.fixture_roster_rewrite();');
      await mutate(db,changes,null,null,{requestId});equal(JSON.parse(getRow((await snapshot(db)).rows,'sq:p5').v).memo,next.memo,'request may retry after exact output can be stored');
    }
  });
  await check('other teams, players and revoked members cannot mutate private roster',async()=>{
    let before=await snapshot(db);const permitted={...JSON.parse(getRow(before.rows,'sq:p4').v),memo:'executive authorized edit'};
    await mutate(db,[change(before.rows,permitted)],null,null,{uid:COACH});before=await snapshot(db);equal(JSON.parse(getRow(before.rows,'sq:p4').v).memo,permitted.memo,'existing executive permission permits normal edit');
    const next={...permitted,memo:'forbidden'};
    for(const uid of [OUTSIDER,PLAYER])await rejects(()=>mutate(db,[change(before.rows,next)],null,null,{uid}),'42501','nonwriter mutation');
    await rejects(()=>snapshot(db,PLAYER),'42501','player cannot read full protected snapshot');await rejects(()=>snapshot(db,OUTSIDER),'42501','nonmember read');
    await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,COACH]);await rejects(()=>mutate(db,[change(before.rows,next)],null,null,{uid:COACH}),'42501','revoked executive blocked');
    equal(await snapshot(db),before,'denied writes unchanged');equal((await status(db,OWNER,X)).enabled,false,'other team not implicitly activated');
  });
  await check('missing or malformed permissions cannot inherit the legacy admin fallback',async()=>{
    const before=await snapshot(db),perms=getRow(await records(db),'cs_perms_v1'),next={...JSON.parse(getRow(before.rows,'sq:p4').v),memo:'unverified permission'};
    for(const raw of [null,'{broken','[1]']){
      if(raw===null)await db.query("DELETE FROM public.ps_kv WHERE workspace_id=$1 AND k='cs_perms_v1'",[W]);else await db.query("UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k='cs_perms_v1'",[raw,W]);
      await rejects(()=>snapshot(db,STAFF),'42501','unverified permission document read');await rejects(()=>mutate(db,[change(before.rows,next)],null,null,{uid:STAFF}),'42501','unverified permission document write');
      await db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,'cs_perms_v1',$2,$3) ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd",[W,perms.v,perms.cupd]);equal(await snapshot(db),before,'permission failure does not mutate protected data');
    }
  });
  await check('inactive other teams keep their legacy writes and personal workspaces cannot activate',async()=>{
    const original=await snapshot(db);await actor(db,OWNER,()=>db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,'sq:legacy-new',$2,42)",[X,json({id:'legacy-new',name:'Separate team legacy row'})]));
    await actor(db,OWNER,()=>db.query("DELETE FROM public.ps_kv WHERE workspace_id=$1 AND k='sq:legacy-new'",[X]));equal(await snapshot(db),original,'inactive workspace legacy writes never affect canonical team');
    await db.query("UPDATE public.ps_workspaces SET kind='personal' WHERE id=$1",[X]);await rejects(async()=>activate(db,protectedRows(await records(db,X)),OWNER,X),['42501','22023'],'personal workspace activation');await db.query("UPDATE public.ps_workspaces SET kind='team' WHERE id=$1",[X]);
  });
  await check('explicit metadata deletions clear public copies while unrelated records survive',async()=>{
    let before=await snapshot(db);const original=JSON.parse(getRow(before.rows,MAIN).v),partial=clone(original.meta);
    for(const key of ['prompts','cats','evalMode','activeEvalSetId'])delete partial[key];
    await mutate(db,[],metaChange(before.rows,{meta:partial}));let after=await snapshot(db),pub=JSON.parse(getRow(after.rows,ATTRS).v),saved=JSON.parse(getRow(after.rows,MAIN).v);
    equal(pub.prompts,[],'removing meta.prompts clears public prompts');equal(pub.cats,[],'removing meta.cats clears public categories');equal(pub.evalMode,null,'removing evaluation mode clears public mode');equal(pub.setId,null,'removing active evaluation set clears public set');equal(saved.meta.participationDays,original.meta.participationDays,'partial metadata deletion preserves participation');equal(saved.meta.statusRuns,original.meta.statusRuns,'partial metadata deletion preserves status history');equal(saved.custom,original.custom,'unrelated unknown root data preserved');equal(saved.players,original.players,'metadata deletion never edits roster');
    before=after;await mutate(db,[],metaChange(before.rows,{},['attrs','positions','exLinks']));after=await snapshot(db);pub=JSON.parse(getRow(after.rows,ATTRS).v);saved=JSON.parse(getRow(after.rows,MAIN).v);
    equal(pub.attrs,[],'explicit root attrs deletion clears public attributes');equal(pub.positions,[],'explicit root positions deletion clears public positions');equal(pub.ex,{},'explicit root example links deletion clears public examples');for(const key of ['attrs','positions','exLinks'])equal(Object.hasOwn(saved,key),false,'requested root removal remains removed '+key);equal(saved.meta,partial,'root criteria removal preserves all unrelated metadata');
    // Re-populate the public metadata sources before deleting the whole meta
    // object, so this separately proves that root deletion cannot leave them.
    await mutate(db,[],metaChange(after.rows,{meta:original.meta}));before=await snapshot(db);await mutate(db,[],metaChange(before.rows,{},['meta']));after=await snapshot(db);pub=JSON.parse(getRow(after.rows,ATTRS).v);saved=JSON.parse(getRow(after.rows,MAIN).v);
    equal(Object.hasOwn(saved,'meta'),false,'explicit whole metadata removal is retained');equal(pub.prompts,[],'whole metadata removal clears prompts');equal(pub.cats,[],'whole metadata removal clears categories');equal(pub.grpBase,[],'whole metadata removal clears group options');equal(pub.evalMode,null,'whole metadata removal clears evaluation mode');equal(pub.setId,null,'whole metadata removal clears evaluation set');equal(JSON.parse(getRow(after.rows,SQUAD).v).name,'','whole metadata removal clears derived team name');equal(saved.custom,original.custom,'whole metadata removal preserves unrelated root custom fields');equal(saved.players,original.players,'whole metadata removal preserves players');
  });
  if(fs.existsSync(path.join(__dirname,'20260915_roster_canonical.verify.sql')))await db.exec(read('verify.sql'));
  console.log(JSON.stringify({ok:true,assertions,cases,method:'isolated PGlite with synthetic authenticated JWT/RLS; no production/network',concurrentServerSessionsTested:false},null,2));
 }finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
