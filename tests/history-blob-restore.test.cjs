'use strict';
/* 2.904 — 서버 이력 원문은 그림(emblem·thumb)이 *Ref 로 빠진 전송 모양이다.
   «지난 판본으로 되돌리기»(histRestore)·«팀 기록 → 이 판으로 되돌리기»(historyApply)가 그림을 되돌린 뒤 로컬에 쓰는지 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const applySrc='var historyApply='+section('historyApply:function(k,v,opts){','  histLabel:keyLabel,').slice('historyApply:'.length).replace(/,\s*$/,';');
const H='0123456789abcdef01234567',G='fedcba9876543210fedcba98',segment=s=>JSON.stringify(s).slice(1,-1);
const LOGO='data:image/png;base64,'+'Q'.repeat(3000),THUMB='<svg viewBox="0 0 10 10">'+'<circle r="1"/>'.repeat(80)+'</svg>';

function harness({cache=[],server=[],serverFails=false,token='token',onFetch}={}){
  const blobs=new Map(cache.map(([h,v])=>['ps_blob:'+h,v])),srv=new Map(server),ls=new Map([['ps_cache_owner_v1','owner-1'],['ps_active_ws','team-a']]);
  const calls=[],reads=[],written=[],diagnostics=[],base=[];let ws='team-a';
  const c={console,Promise,JSON,Uint8Array,TextEncoder,crypto:crypto.webcrypto,BASE:'https://synthetic.invalid',OWNERKEY:'ps_cache_owner_v1',MATCH_KEY:'cs_team_matches_v1',
    storage:{async get(k){reads.push(k);return blobs.has(k)?{value:blobs.get(k)}:null;},async set(k,v){blobs.set(k,v);return {value:v};}},
    localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>{ls.set(k,String(v));},removeItem:k=>{ls.delete(k);}},
    hj:()=>({}),syncHttpError:(stage,status)=>Error(stage+' '+status),syncDiagnostic:(stage,e)=>{diagnostics.push(stage);},
    async syncFetch(stage,url){calls.push({stage,url});assert.equal(stage,'blob_pull');if(onFetch)onFetch(c);
      if(serverFails)throw Object.assign(Error('offline'),{code:'sync_offline'});
      const filter=decodeURIComponent(url);return {ok:true,status:200,json:async()=>[...srv].filter(([h])=>filter.includes(h)).map(([h,v])=>({h,v}))};},
    ensureToken:()=>token instanceof Error?Promise.reject(token):Promise.resolve(token),
    activeWs:()=>ws,dataUnlocked:()=>true,workspaceSwitchGuardRead:()=>null,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>'',
    kvWrite(k,v,writes){written.push({k,v});ls.set(k,v);return true;},
    currentValueForKey:k=>Promise.resolve(ls.has(k)?ls.get(k):null),idbBacked:()=>false,
    meta:()=>({h:{},c:{},n:{}}),setMeta(){},setMetaExact(){},hash:v=>'h'+String(v).length+':'+String(v).slice(-12),
    syncBaseSet(k,v){base.push({k,v});},syncNow(){},
    historyMatchApplyExact:()=>Promise.resolve(true),
    setWs(x){ws=x;}};
  c.window=c;vm.createContext(c);
  vm.runInContext(section('var BLOB_MIN=','/* ══ 2.727')+'\n'+section('function histRestore(k,v){','function dataReviewOpen(){')+'\n'+applySrc,c);
  return {c,ls,blobs,calls,reads,written,diagnostics,base};
}
/* 서버 이력 원문(분리 모양): 로고는 meta.emblem, 작전판 썸네일은 일정 칸의 thumb */
const scoutRaw=JSON.stringify({meta:{teamName:'Synthetic FC',emblem:'',emblemRef:H,color:'#123456'},players:[{id:'p1',name:'가상 선수'}]});
const schedRaw=JSON.stringify({anchorMonday:'2026-09-28',weeks:{'0':{'1':[{id:'s1',thumb:'',thumbRef:G,title:'훈련'}]}}});
const RESTORES={
  histRestore:(h,k,v)=>h.c.histRestore(k,v),
  historyApply:(h,k,v)=>h.c.historyApply(k,v,{expectedWid:'team-a'})
};

for(const [name,run] of Object.entries(RESTORES)){
  test(name+' restores the original logo into the local value from a stripped history body',async()=>{
    const h=harness({server:[[H,segment(LOGO)]]});
    assert.equal(await run(h,'scout_tool_v1',scoutRaw),true);
    const local=h.ls.get('scout_tool_v1'),doc=JSON.parse(local);
    assert.equal(doc.meta.emblem,LOGO,'로고가 원본으로 돌아온다');assert.equal(doc.meta.emblemRef,undefined,'옛 Ref 는 기기 문서에 남지 않는다');
    assert.equal(doc.meta.color,'#123456');assert.deepEqual(doc.players,[{id:'p1',name:'가상 선수'}]);
    assert.equal(h.written.length,1);assert.equal(h.written[0].v,local);
    assert.equal(h.calls.length,1);assert.match(h.calls[0].url,/workspace_id=eq.team-a/);
    assert.equal(h.blobs.get('ps_blob:'+H),segment(LOGO),'받은 그림은 캐시에 남는다');
    if(name==='histRestore'){assert.equal(h.ls.get('ps_push_ok_scout_tool_v1'),h.c.hash(local),'승인 도장은 실제로 쓴 값 기준');assert.deepEqual(h.base,[{k:'scout_tool_v1',v:local}]);}
  });
  test(name+' restores a schedule thumbnail from this device cache without the network',async()=>{
    const h=harness({cache:[[G,segment(THUMB)]]});
    assert.equal(await run(h,'process_coach_v1',schedRaw),true);
    const cell=JSON.parse(h.ls.get('process_coach_v1')).weeks['0']['1'][0];
    assert.equal(cell.thumb,THUMB);assert.equal(cell.thumbRef,undefined);assert.equal(cell.title,'훈련');assert.equal(h.calls.length,0);
  });
  test(name+' writes the stripped body unchanged, without error, when the image cannot be found',async()=>{
    for(const opts of [{},{serverFails:true},{token:null},{token:new Error('auth down')}]){
      const h=harness(opts);
      assert.equal(await run(h,'scout_tool_v1',scoutRaw),true,JSON.stringify(opts));
      assert.equal(h.ls.get('scout_tool_v1'),scoutRaw,'원문 그대로 — 예전 동작');assert.equal(h.written.length,1);
    }
  });
  test(name+' keeps cached images when the server fetch fails and leaves only the missing reference',async()=>{
    const raw=JSON.stringify({meta:{emblem:'',emblemRef:H},weeks:{'0':{'2':[{thumb:'',thumbRef:G}]}}});
    const h=harness({cache:[[G,segment(THUMB)]],serverFails:true});
    assert.equal(await run(h,'process_coach_v1',raw),true);
    const doc=JSON.parse(h.ls.get('process_coach_v1'));
    assert.equal(doc.weeks['0']['2'][0].thumb,THUMB);assert.equal(doc.meta.emblem,'');assert.equal(doc.meta.emblemRef,H);
    assert.ok(h.diagnostics.includes('hist-hydrate'));
  });
  test(name+' leaves keys outside BLOB_KEYS byte-identical and never looks up images',async()=>{
    const h=harness({cache:[[H,segment(LOGO)]],server:[[H,segment(LOGO)]]});
    const raw='{ "players" : [ { "id":"p1", "emblem":"", "emblemRef":"'+H+'", "n":1.00 } ] }';
    assert.equal(await run(h,'cs_squad_v1',raw),true);
    assert.equal(h.ls.get('cs_squad_v1'),raw);assert.equal(h.calls.length,0);assert.equal(h.reads.length,0);
  });
  test(name+' leaves a BLOB_KEYS body without references byte-identical',async()=>{
    const h=harness(),raw='{ "meta" : { "teamName":"S", "emblem":"tiny" }, "players":[], "x":1.50 }';
    assert.equal(await run(h,'scout_tool_v1',raw),true);assert.equal(h.ls.get('scout_tool_v1'),raw);assert.equal(h.calls.length+h.reads.length,0);
  });
}

test('histRestore does not write when the team changes while the image is being fetched',async()=>{
  const h=harness({server:[[H,segment(LOGO)]],onFetch:c=>c.setWs('team-b')}),before=h.ls.get('scout_tool_v1');
  assert.equal(await h.c.histRestore('scout_tool_v1',scoutRaw),false);
  assert.equal(h.written.length,0);assert.equal(h.ls.get('scout_tool_v1'),before);assert.equal(h.ls.get('ps_push_ok_scout_tool_v1'),undefined);
});
test('historyApply stops with a workspace-changed error when the team changes while the image is being fetched',async()=>{
  const h=harness({server:[[H,segment(LOGO)]],onFetch:c=>c.setWs('team-b')});
  await assert.rejects(h.c.historyApply('scout_tool_v1',scoutRaw,{expectedWid:'team-a'}),e=>e&&e.psWorkspaceChanged===true);
  assert.equal(h.written.length,0);
});
test('historyApply verifies the hydrated value it wrote, not the stripped history body',async()=>{
  const h=harness({server:[[H,segment(LOGO)]]});
  h.c.kvWrite=function(k,v){h.written.push({k,v});h.ls.set(k,scoutRaw);return true;};   /* 착지한 값이 원문(분리 모양)이면 실패로 본다 */
  assert.equal(await h.c.historyApply('scout_tool_v1',scoutRaw,{expectedWid:'team-a'}),false);
  assert.ok(h.diagnostics.includes('hist-restore-verify'));
});
