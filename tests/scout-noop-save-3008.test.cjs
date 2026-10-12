'use strict';
/* 3.008 — 운영(10/8~10/12): 새 판 적용이 «flush_fail:fScout:store_ready.store_ready.…» 로 미뤄졌다(데스크톱 넷 · 한 기기 19시간 11번).
   ① 선수단 저장이 후보를 건드리지 않아도 후보 문서를 함께 보냈고, 후보가 확인 중이면 거절된 실패가 재시도 없이 남았다
   ② 같은 오류 객체를 받을 때마다 코드를 앞에 붙여 기록(80자)에서 원인이 잘렸다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../studio/scouting-store.js');
const source=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function slice(begin,end){const a=source.indexOf(begin),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,begin);return source.slice(a,b);}
const persistence=slice('function scProject(p){','async function scMigrateMainTargets(){');
const flush=slice('window.psFlushPendingReady=function(){','function scChildWindows(){');
const clone=x=>JSON.parse(JSON.stringify(x));
const base=()=>S.reconcile(null,{v:1,players:[
  {id:'c1',type:'target',dbId:'one',name:'가상 후보',club:'팀 A',posId:'ST',memo:'관찰'},
  {id:'c2',type:'target',name:'다른 후보',club:'팀 B',posId:''}]});

function fixture(){
  const values=new Map([['ps_sync_session',JSON.stringify({uid:'u'})],['ps_active_ws','w'],['ps_cache_owner_v1',JSON.stringify({uid:'u',wid:'w',nonce:'n'})],
    ['ps_ws_list',JSON.stringify([{id:'w',kind:'team'}])],[S.KEY,JSON.stringify(base())]]);
  const st={durable:values.get(S.KEY),writes:0,ready:true,role:'executive',reject:false};
  const win={localStorage:{getItem:k=>values.get(k)??null},PSSync:{dataUnlocked:()=>true,keyReady:()=>st.ready},PSPerms:{role:()=>st.role,canEdit:()=>true},
    PSStorage:{sharedReady:()=>Promise.resolve(),sharedVerified:(k,raw)=>raw===st.durable?Promise.resolve():Promise.reject(new Error('disk'))},
    storage:{get:()=>Promise.resolve({value:st.durable})},
    psSaveShared:(k,raw)=>{if(st.reject)return false;st.writes++;values.set(k,raw);st.durable=raw;return true;}};
  win.parent=win;
  return {values,st,win,client:S.createClient(win)};
}

test('a candidate document with nothing changed is recognised before verification, regardless of key order',async()=>{
  const f=fixture();f.client.read();assert.equal(f.client.state.verified,false);
  const same=S.copy(f.client.state.doc);assert.equal(f.client.unchanged(same),true,'re-saving the stored document');
  const flip=x=>Array.isArray(x)?x.map(flip):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).reverse().map(k=>[k,flip(x[k])])):x;
  const reordered=flip(same);assert.notEqual(JSON.stringify(reordered),JSON.stringify(same));assert.equal(f.client.unchanged(reordered),true,'key order does not count');
  const moved=S.copy(same);moved.players[0].posId='LW';moved.players[0]._scoutMove={at:5,id:'m'};assert.equal(f.client.unchanged(moved),false,'a placement change');
  const edited=S.copy(same);S.edit(edited,'db:one','club','팀 C',{at:6,id:'e'});assert.equal(f.client.unchanged(edited),false,'an identity edit');
  assert.equal(S.sameRaw({a:1,b:[1,{c:2,d:3}]},'{"b":[1,{"d":3,"c":2}],"a":1}'),true);
  assert.equal(S.sameRaw({a:1},'{"a":2}'),false);assert.equal(S.sameRaw({a:1},null),false);
  assert.equal(f.st.writes,0);
});

test('every refusal carries a classification code and keeps its message',async()=>{
  const codeOf=fn=>{try{fn();}catch(e){return [e.psCode,e.message];}return null;};
  const f=fixture();
  assert.deepEqual(codeOf(()=>f.client.check()),['scout_unread','후보 자료가 갱신되었습니다. 다시 열어 주세요.']);
  f.client.read();assert.equal(codeOf(()=>f.client.check())[0],'scout_unverified');
  await f.client.prepare();assert.equal(codeOf(()=>f.client.check()),null);
  f.st.ready=false;assert.deepEqual(codeOf(()=>f.client.check()),['scout_not_ready','팀의 후보 자료와 권한을 확인 중입니다.']);
  f.st.ready=true;f.st.role='staff';assert.equal(codeOf(()=>f.client.check())[0],'scout_role');
  f.st.role='executive';f.values.set('ps_active_ws','x');assert.equal(codeOf(()=>f.client.check())[0],'scout_session');
  f.values.set('ps_active_ws','w');f.values.set(S.KEY,JSON.stringify({v:1,players:[]}));assert.equal(codeOf(()=>f.client.check())[0],'scout_raw_changed');
  const g=fixture();await g.client.prepare();g.st.reject=true;const d=S.copy(g.client.state.doc);d.players[0].memo='새 관찰';
  assert.equal(codeOf(()=>g.client.save(d))[0],'scout_write_failed');
});

function harness(){
  const f=fixture(),rows=new Map(),warnings=[];let prepares=0;
  const teamSaves={track(k,p,retry){const row={p,retry,error:null};rows.set(k,row);p.then(()=>{if(rows.get(k)===row)rows.delete(k);},e=>{row.error=e;});p.catch(()=>{});},
    hasFailed:k=>!!(rows.get(k)&&rows.get(k).error)};
  const data={players:[]};
  const c=vm.createContext({window:f.win,localStorage:f.win.localStorage,PSScoutStore:S,TKEY:S.KEY,mem:{},data,teamSaves,
    scStore:()=>f.client,scWarn:e=>{warnings.push(e.psCode||e.message);return false;},
    scPrepare:()=>{prepares++;return f.client.prepare().then(()=>{data.players=f.client.state.doc.players.map(clone);}).catch(()=>{});}});
  vm.runInContext(persistence,c,{filename:'scout-noop-save.js'});
  const settle=()=>new Promise(r=>setImmediate(r));
  return {...f,c,rows,warnings,data,settle,prepares:()=>prepares};
}
const roster=h=>({v:1,players:S.copy(h.client.state.doc.players)});

test('a roster save during candidate verification writes nothing and leaves no failure behind',async()=>{
  const h=harness();h.client.read();
  assert.equal(h.c.scSaveTargetDoc(roster(h)),true);await h.settle();
  assert.equal(h.rows.size,0,'nothing tracked');assert.equal(h.st.writes,0);assert.deepEqual(h.warnings,[]);
  await h.client.prepare();assert.equal(h.c.scSaveTargetDoc(roster(h)),true);await h.settle();
  assert.equal(h.rows.size,0);assert.equal(h.st.writes,0,'verified and unchanged also writes nothing');
});

test('a real candidate change during verification is still refused without a retry',async()=>{
  const h=harness();h.client.read();const v=roster(h);v.players[0].posId='CB';
  assert.equal(h.c.scSaveTargetDoc(v),false);await h.settle();
  const row=h.rows.get(S.KEY);assert.ok(row&&row.error);assert.equal(row.retry,undefined);assert.equal(row.error.psCode,'scout_unverified');
  assert.deepEqual(h.warnings,['scout_unverified']);assert.equal(h.st.writes,0);
});

test('a left-over failure is healed: refused no-op saves retry by re-verifying, accepted ones write once',async()=>{
  const h=harness();h.client.read();const v=roster(h);v.players[0].posId='CB';h.c.scSaveTargetDoc(v);await h.settle();
  assert.ok(h.c.teamSaves.hasFailed(S.KEY));
  assert.equal(h.c.scSaveTargetDoc(roster(h)),false,'still unverified');await h.settle();
  const row=h.rows.get(S.KEY);assert.ok(row.error);assert.equal(typeof row.retry,'function','a no-op refusal can be retried');
  assert.equal(await row.retry(),true);assert.equal(h.prepares(),1);assert.equal(h.client.state.verified,true);assert.equal(h.st.writes,0,'retry writes nothing');
  assert.equal(h.data.players.length,2,'the screen adopted the verified candidates');
  const k=harness();k.client.read();k.c.teamSaves.track(S.KEY,Promise.reject(new Error('earlier')));await k.settle();k.c.scSaveTargetDoc(roster(k));await k.settle();
  k.st.ready=false;await assert.rejects(k.rows.get(S.KEY).retry(),e=>e.psCode==='scout_unverified','a retry that cannot verify keeps the failure');
  const g=harness();await g.client.prepare();g.c.teamSaves.track(S.KEY,Promise.reject(new Error('earlier')));await g.settle();
  assert.equal(g.c.scSaveTargetDoc(roster(g)),true);await g.settle();
  assert.equal(g.st.writes,1,'with a failure on record an unchanged save still writes, so success clears it');assert.equal(g.rows.size,0);
});

test('the update flush tags a repeated failure once, so the cause and key survive the 80-character record',async()=>{
  const e=new Error('후보 자료가 갱신되었습니다. 다시 열어 주세요.');e.psCode='scout_unverified';e.psKey=S.KEY;
  const c=vm.createContext({window:{},Promise,Error,String,
    matchFlushNow:()=>({had:false,ok:true}),matchIndividualPublicPendingAny:()=>false,scChildWindows:()=>[],
    store:{ready:()=>Promise.reject(e)}});
  c.window=c;vm.runInContext(flush,c);
  const codes=[];for(let i=0;i<4;i++)await c.psFlushPendingReady().catch(x=>codes.push(x.psCode));
  assert.deepEqual(codes,Array(4).fill('store_ready.scout_unverified:'+S.KEY));
  assert.ok(('flush_fail:fScout:'+codes[0]).length<=80);
});
