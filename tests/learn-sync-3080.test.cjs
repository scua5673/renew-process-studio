'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const code=section('function kvPushRows(', '/* ── 1.568 안전장치')+'\n'+section("var BOARD_LIVE_KEY='cs_private_board_v1';",'\nwindow.PSSync=');
/* 3.080 — 학습 기록은 내 개인 공간의 한 키(cs_learn_sync_v1)에 판본 확인으로 저장한다(sync.js learnGet/learnSave · learning.html mergeLearn). */
const KEY='cs_learn_sync_v1';
const raw=(n)=>JSON.stringify({v:1,at:1,s:{done:{[n]:{hits:3}},cards:{},ask:{},mc:{},mix:{},cur:{done:{},quiz:{}},role:'coach'}});
const copy=x=>JSON.parse(JSON.stringify(x));
function harness(options={}){
  const server=options.server||new Map(),requests=[],metaWrites=[];
  let uid='coach-a',wid='private-a',active='team-shared',seal='seal-a',epoch=0,switchEpoch='',switchSeal='',unlocked=true;
  const state={role:'owner',owner_id:'coach-a',kind:'personal'};
  const put=(w,k,v,cupd=1)=>server.set(w+'|'+k,{workspace_id:w,k,v,cupd});
  const ctx=vm.createContext({Promise,Number,Map,JSON,Object,String,Array,Date,encodeURIComponent,
    BASE:'https://server.invalid',PERSONAL_MAXLEN:12000000,KV_PUSH_BYTES:1500000,KV_PUSH_ROWS:15,_itemConflicts:[],
    personalContext:()=>unlocked?{uid,wid,active,seal,epoch,switchEpoch,switchSeal}:null,
    getSess:()=>({uid}),cacheOwner:()=>({uid,wid:active}),workspaceSwitchGuardRead:()=>switchSeal||null,
    wsList:()=>[{id:wid,...state}],hj:()=>({}),prefBuild:x=>x,blobPrepRows:async()=>{},
    syncIssue:(code,stage,message)=>Object.assign(new Error(message),{psCode:code,psStage:stage}),
    syncHttpError:(stage,status)=>Object.assign(new Error('HTTP '+status),{psStage:stage}),
    ensureToken:async()=>{if(options.onToken)await options.onToken(h);return 'synthetic';},
    kvInFilter:ks=>'k=in.('+ks.join(',')+')',holdClear(){},importApprovalClear(){},
    meta:()=>{throw new Error('Board must not touch team sync metadata');},setMetaExact:m=>metaWrites.push(m),
    async syncFetch(stage,url,init){
      const u=new URL(url),method=init.method||'GET';requests.push({stage,method,url});
      if(options.beforeRequest)await options.beforeRequest({h,stage,method});
      if(options.offline)throw new Error('offline');
      if(options.status)return {ok:false,status:options.status};
      let rows=[];
      if(method==='GET'){
        const w=u.searchParams.get('workspace_id').slice(3),filter=u.searchParams.get('k');
        const keys=filter.startsWith('eq.')?[filter.slice(3)]:filter.slice(4,-1).split(',');
        rows=keys.flatMap(k=>server.has(w+'|'+k)?[copy(server.get(w+'|'+k))]:[]);
      }else{
        const d=JSON.parse(init.body),w=method==='PATCH'?u.searchParams.get('workspace_id').slice(3):d.workspace_id,k=method==='PATCH'?u.searchParams.get('k').slice(3):d.k;
        const current=server.get(w+'|'+k),expected=method==='PATCH'?Number(u.searchParams.get('cupd').slice(3)):null;
        if((method==='PATCH'&&current?.cupd===expected)||(method==='POST'&&!current)){
          const saved={workspace_id:w,k,v:d.v,cupd:d.cupd};
          if(options.transform)options.transform(saved);server.set(w+'|'+k,saved);rows=[copy(saved)];
        }
        if(options.afterWrite)await options.afterWrite({h,w,k,rows});
      }
      if(options.alterResponse)rows=options.alterResponse(rows,{stage,method});
      if(options.afterResponse)await options.afterResponse({h,stage,method});
      return {ok:true,status:200,json:async()=>copy(rows),text:async()=>JSON.stringify(rows)};
    }
  });
  vm.runInContext(code,ctx);
  const h={ctx,state,server,requests,metaWrites,put,get:()=>ctx.learnGet(),save:(v,base)=>ctx.learnSave(v,{uid:base.uid,wid:base.wid,expected_raw:base.raw,expected_cupd:base.cupd}),
    move(changes){({uid,wid,active,seal,epoch,switchEpoch,switchSeal,unlocked}={uid,wid,active,seal,epoch,switchEpoch,switchSeal,unlocked,...changes});},owner:()=>copy(ctx.boardLiveContext())};
  return h;
}

test('learning records go to my personal workspace, even while a team is open',async()=>{
  const h=harness();
  const base=await h.get();assert.equal(base.raw,null);assert.equal(base.wid,'private-a');
  const ack=await h.save(raw('SG1'),base);assert.equal(ack.raw,raw('SG1'));
  assert.equal(h.server.get('private-a|'+KEY).v,raw('SG1'));
  assert.ok(!h.server.has('team-shared|'+KEY),'팀 공간에는 쓰지 않는다');
  h.move({uid:'coach-b',wid:'private-b',seal:'seal-b'});h.state.owner_id='coach-b';
  const b=await h.get();assert.equal(b.raw,null,'다른 사람의 기록은 보이지 않는다');
});
test('a save from a stale base is refused as a conflict, so the page re-reads and merges',async()=>{
  const h=harness();const base=await h.get();await h.save(raw('A1'),base);
  await assert.rejects(h.save(raw('B1'),base),e=>e.psCode==='sync_conflict');
  const fresh=await h.get();const ack=await h.save(raw('B1'),fresh);assert.equal(ack.raw,raw('B1'));
});
test('only the learning shape is accepted',async()=>{
  const h=harness();const base=await h.get();
  for(const bad of ['', '{}', '[]', JSON.stringify({v:2,s:{}}), JSON.stringify({v:1,s:[]}), 'x'.repeat(1500001)])
    await assert.rejects(h.save(bad,base),e=>e.psCode==='sync_storage');
});

/* learning.html 의 합치기 — 더 나아간 쪽을 남긴다 */
const page=fs.readFileSync(require('node:path').join(__dirname,'../studio/learning.html'),'utf8');
const mcode=page.slice(page.indexOf('function lmPick('),page.indexOf('function learnSame('));
const mctx=vm.createContext({Object,JSON});vm.runInContext(mcode,mctx);
test('merging keeps whichever side went further, and loses neither device',()=>{
  const a={done:{SG1:{hits:3},SG2:{hits:1}},cards:{c1:{stage:1,due:5}},ask:{'SG1:pre':'내 답',x:''},mc:{},mix:{},cur:{done:{l1:1},quiz:{}},role:'coach',now:'SG2',track:'coach',dayOff:2};
  const b={done:{SG2:{hits:3},ST1:{hits:2}},cards:{c1:{stage:2,due:9},c2:{stage:0,due:1}},ask:{'SG1:pre':'다른 기기 답',x:'채움'},mc:{},mix:{},cur:{done:{l2:1},quiz:{q:1}},role:'player',now:null,track:'coach',dayOff:0};
  const m=JSON.parse(JSON.stringify(mctx.mergeLearn(a,b)));
  assert.deepEqual(m.done,{SG1:{hits:3},SG2:{hits:3},ST1:{hits:2}});
  assert.deepEqual(m.cards,{c1:{stage:2,due:9},c2:{stage:0,due:1}});
  assert.equal(m.ask['SG1:pre'],'내 답','이 기기 답이 먼저');assert.equal(m.ask.x,'채움','비어 있으면 다른 기기 것');
  assert.deepEqual(m.cur,{done:{l2:1,l1:1},quiz:{q:1}});
  assert.equal(m.role,'coach');assert.equal(m.now,'SG2');assert.equal(m.dayOff,2,'날짜 당기기는 기기에만');
  assert.deepEqual(JSON.parse(JSON.stringify(mctx.mergeLearn({},b))).done,b.done,'빈 기기는 계정 기록을 그대로 받는다');
});
test('the page saves to the account a moment after each change and re-reads when shown',()=>{
  assert.match(page,/function save\(\)\{localStorage\.setItem\(KEY,JSON\.stringify\(S\)\);learnSchedulePush\(\);\}/);
  assert.match(page,/if\(e&&e\.psCode==='sync_conflict'&&!retried\)/,'충돌이면 한 번 다시 읽어 합친다');
  assert.match(page,/document\.addEventListener\('visibilitychange'/);
  assert.match(page,/if\(d\.type==='learnHome'\)\{[^\n]*learnPull\(\);/);
});

/* 3.080 — 개인 게임모델도 같은 통로(키만 다름, 형식 {v:1, at, m:{moments:[]}}) */
test('the personal game model goes to my personal workspace under its own key',async()=>{
  const h=harness();
  const gm=n=>JSON.stringify({v:1,at:n,m:{moments:[{key:'do',phases:[]}],identity:''}});
  const base=await h.ctx.gmPersonalGet();assert.equal(base.raw,null);assert.equal(base.wid,'private-a');
  const ack=await h.ctx.gmPersonalSave(gm(1),{uid:base.uid,wid:base.wid,expected_raw:null,expected_cupd:null});
  assert.equal(h.server.get('private-a|cs_gamemodel_personal_v1').v,gm(1));
  assert.ok(!h.server.has('team-shared|cs_gamemodel_personal_v1'));
  await assert.rejects(h.ctx.gmPersonalSave(gm(2),{uid:base.uid,wid:base.wid,expected_raw:null,expected_cupd:null}),e=>e.psCode==='sync_conflict');
  for(const bad of [JSON.stringify({v:1,m:{moments:[]}}),JSON.stringify({v:1,at:1,m:{}}),JSON.stringify({v:1,at:1})])
    await assert.rejects(h.ctx.gmPersonalSave(bad,{uid:base.uid,wid:base.wid,expected_raw:ack.raw,expected_cupd:ack.cupd}),e=>e.psCode==='sync_storage');
});
const gmPage=fs.readFileSync(require('node:path').join(__dirname,'../studio/gamemodel.html'),'utf8');
test('the game model page only syncs the personal board, never pushes an empty board over the account, and pulls before adding',()=>{
  assert.match(gmPage,/if\(GM_PERSONAL\)model\._at=Date\.now\(\);/);
  assert.match(gmPage,/if\(gmIsEmpty\(model\)&&gmPd\.raw\)return;/,'빈 판으로 계정의 게임모델을 덮지 않는다');
  assert.match(gmPage,/if\(!gmPd\.pulled\)\{ gmPdPull\(function\(ok\)\{ if\(ok\)gmPdPush\(retried\); \}\); return; \}/,'받기 전에는 올리지 않는다');
  assert.match(gmPage,/\(_boot\|\|gmIsEmpty\(model\)\|\|\(doc\.at\|\|0\)>\(model\._at\|\|0\)\)/,'새 기기의 빈 판은 계정의 것을 받는다');
  assert.match(gmPage,/if\(gmPdApi\(\)&&!gmPd\.pulled\)\{ gmPdPull\(function\(\)\{ gmAddApply\(d\); \}\); return; \}/);
});
