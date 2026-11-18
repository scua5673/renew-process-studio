'use strict';
/* 저장 계층 정리 — 작업 보드 «보관 사본»(ps_private_board_draft_v1:<uid>:kept:…) 정리(studio/storage-kept.js · storage.js keptPrune).
   3.302 settle · keepHead · archiveHeads · recover 가 옮겨 둔 사본을 예전엔 아무도 지우지 않았다(11/18 storage_usage 작은 저장소 2위 — 7기기 · 최대 5.7MB,
   큰 기기 넷은 작은 저장소의 거의 전부). 규칙: 작은 저장소 사본은 IndexedDB 로 옮겨 되읽은 뒤에만 지운다 · 주인(uid · wid)마다 최신 8 · 14일 · 한 시간 안은
   개수로 안 지움 · 지금 보드와 같은 지문은 안 지움 · 지우기 전 ps_events storage_kept_pruned 한 줄(키 표 이름 · 개수 · KB 만). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../studio/storage-kept.js'),K=require('../studio/storage-keys.js');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const NOW=Math.floor(Date.now()/1000)*1000,H=3600000,DAY=86400000,UID='u-77',BASE='ps_private_board_draft_v1:'+encodeURIComponent(UID),P=BASE+':kept:';
const body=x=>JSON.stringify({snap:{players:[{id:'synthetic',x}]},pad:'X'.repeat(3000)});
const rec=(x,at,wid)=>JSON.stringify({v:1,uid:UID,wid:wid||'w-1',raw:body(x),at});
const head=(x,seq)=>JSON.stringify({v:1,uid:UID,wid:'w-1',raw:body(x),base:null,pending:false,attempt:null,token:'t-'+x,seq});
const b36=t=>t.toString(36);

test('보관 시각 — 레코드의 at · seq, 없으면 키의 토큰(10진 · base36), 그것도 없으면 0',()=>{
  assert.equal(M.timeOf(P+'unsaved-split-abc',M.record(rec(1,NOW-5*H)),NOW),NOW-5*H,'초안 레코드의 at');
  assert.equal(M.timeOf(P+'source-'+b36(NOW-9*H)+'-r4nd0m-3',M.record(head(1,NOW-2*H)),NOW),NOW-2*H,'머리 레코드의 seq 가 키의 토큰보다 먼저');
  assert.equal(M.timeOf(P+'unsaved-'+(NOW-3*H)+'-r4nd0m',null,NOW),NOW-3*H,'recover 키의 10진 at');
  assert.equal(M.timeOf(P+'source-'+b36(NOW-9*H)+'-r4nd0m-3',null,NOW),NOW-9*H,'archiveHeads 키의 base36 토큰');
  assert.equal(M.timeOf(P+b36(NOW-4*H)+'-r4nd0m-12',null,NOW),NOW-4*H,'keepHead 키의 base36 토큰');
  assert.equal(M.timeOf(P+b36(NOW-4*H)+'-r4nd0m-12:ls-abc-1x',null,NOW),NOW-4*H,'옮겨 둔 :ls- 자리도 원래 토큰');
  assert.equal(M.timeOf(P+'unsaved-split-abc-1x',null,NOW),0,'split 자리는 지문뿐');
  assert.equal(M.timeOf(P+'unsaved-'+(NOW+2*DAY)+'-x',null,NOW),0,'앞날 · 터무니없는 값은 모른다');
  assert.equal(M.record('not json'),null);assert.equal(M.record(JSON.stringify({v:2,raw:'x'})),null);
  assert.equal(M.mark('abc'),M.mark('abc'));assert.notEqual(M.mark('abc'),M.mark('abd'));
});

test('셈 — 14일 지난 것 · 주인마다 최신 8 밖의 것은 지우고, 한 시간 안의 것은 개수로 지우지 않는다',()=>{
  const entries=[];
  for(let i=0;i<10;i++)entries.push({store:'idb',key:P+'unsaved-'+(NOW-(3+i)*H)+'-r'+i,value:rec(10+i,NOW-(3+i)*H)});   /* 3시간 ~ 12시간 전 */
  entries.push({store:'idb',key:P+'unsaved-split-old',value:rec(1,NOW-20*DAY)});
  entries.push({store:'idb',key:P+'unsaved-split-edge',value:rec(2,NOW-13*DAY)});
  const p=M.plan(entries,{now:NOW});
  const dropped=p.drop.map(r=>r.key).sort();
  assert.deepEqual(dropped,[P+'unsaved-'+(NOW-11*H)+'-r8',P+'unsaved-'+(NOW-12*H)+'-r9',P+'unsaved-split-old',P+'unsaved-split-edge'].sort(),'열둘 중 최신 여덟만(2~10시간 전 여덟) — 13일 것도 아홉째 밖이면 개수로 지운다');
  const pair=M.plan(entries.slice(-2),{now:NOW});
  assert.deepEqual(pair.drop.map(r=>r.key),[P+'unsaved-split-old'],'둘뿐이면 14일 넘은 것만');
  const fresh=[];for(let i=0;i<12;i++)fresh.push({store:'idb',key:P+'unsaved-'+(NOW-i*60000-1)+'-f'+i,value:rec(i,NOW-i*60000-1)});
  assert.equal(M.plan(fresh,{now:NOW}).drop.length,0,'한 시간 안의 열둘은 하나도 안 지운다');
  assert.equal(M.plan(fresh,{now:NOW+2*H}).drop.length,4,'두 시간 뒤엔 최신 여덟만');
});

test('셈 — 시각을 모르는 사본은 가장 오래된 것으로 세어 개수 규칙만 받고, 주인(wid)은 따로 센다',()=>{
  const entries=[];
  for(let i=0;i<8;i++)entries.push({store:'idb',key:P+'unsaved-'+(NOW-(2+i)*H)+'-a'+i,value:rec(i,NOW-(2+i)*H,'w-A')});
  entries.push({store:'idb',key:P+'unsaved-split-unknown-A',value:'malformed original A'});
  entries.push({store:'idb',key:P+'unsaved-split-unknown-B',value:'malformed original B'});
  for(let i=0;i<3;i++)entries.push({store:'idb',key:P+'unsaved-'+(NOW-(2+i)*H)+'-b'+i,value:rec(i,NOW-(2+i)*H,'w-B')});
  const p=M.plan(entries,{now:NOW});
  assert.deepEqual(p.drop.map(r=>r.key).sort(),[],'모르는 둘은 주인 «»(wid 없음)에 둘뿐 · w-A 여덟 · w-B 셋 — 지울 것 없음');
  const many=entries.concat(Array.from({length:9},(_,i)=>({store:'idb',key:P+'unsaved-split-u'+i,value:'malformed '+i})));
  const q=M.plan(many,{now:NOW});
  assert.equal(q.drop.length,3,'주인 «» 열하나 중 여덟만');
  assert.ok(q.drop.every(r=>!r.t),'지운 것은 전부 시각을 모르는 것');
  assert.equal(M.plan([{store:'idb',key:P+'unsaved-split-u',value:'x'}],{now:NOW+400*DAY}).drop.length,0,'모르는 것은 날짜로 안 지운다(개수로만)');
});

test('셈 — 지금 보드와 같은 지문(:unsaved 초안 · 머리 레코드와 같은 글 · 같은 원문)은 오래됐어도 지우지 않는다',()=>{
  const draft=rec(7,NOW-1000),h=head(9,NOW-500);
  const entries=[
    {store:'idb',key:P+'unsaved-split-same-draft',value:JSON.stringify({v:1,uid:UID,wid:'w-1',raw:JSON.parse(draft).raw,at:NOW-30*DAY})},
    {store:'idb',key:P+'unsaved-split-exact',value:draft},
    {store:'idb',key:P+'source-'+b36(NOW-30*DAY)+'-x-1',value:JSON.stringify({v:1,uid:UID,wid:'w-1',raw:JSON.parse(h).raw,seq:NOW-30*DAY})},
    {store:'idb',key:P+'unsaved-split-other',value:rec(8,NOW-30*DAY)}
  ];
  const p=M.plan(entries,{now:NOW,protect:{values:[draft,h],raws:[JSON.parse(draft).raw,JSON.parse(h).raw]}});
  assert.deepEqual(p.drop.map(r=>r.key),[P+'unsaved-split-other']);
});

test('셈 — 작은 저장소 사본은 «옮길 것»(IndexedDB 에 같은 글이 있으면 «그냥 지울 것»)으로 나오고 지울 것과 겹치지 않는다',()=>{
  const same=rec(1,NOW-2*H),diff=rec(2,NOW-2*H);
  const p=M.plan([
    {store:'idb',key:P+'a-x-1',value:same},{store:'ls',key:P+'a-x-1',value:same},
    {store:'idb',key:P+'b-x-2',value:rec(3,NOW-2*H)},{store:'ls',key:P+'b-x-2',value:diff},
    {store:'ls',key:P+'c-x-3',value:rec(4,NOW-2*H)},
    {store:'ls',key:P+'d-x-4',value:rec(5,NOW-40*DAY)},
    {store:'idb',key:P+'e-x-5',value:12345}
  ],{now:NOW});
  assert.deepEqual(p.dup.map(r=>r.key),[P+'a-x-1']);
  assert.deepEqual(p.move.map(r=>r.key).sort(),[P+'b-x-2',P+'c-x-3']);
  assert.deepEqual(p.drop.map(r=>r.key),[P+'d-x-4']);
  assert.ok(!p.keep.concat(p.drop).some(r=>r.key===P+'e-x-5'),'글이 아닌 값은 손대지 않는다');
});

function fakeIO({ls=[],idb=[],uid=UID,hooks={}}={}){
  const L=new Map(ls),I=new Map(idb),log=[],events=[];let owner=true;
  const io={uid,current(){if(!owner){const e=new Error('synthetic owner change');e.name='StorageOwnerChangedError';throw e;}},
    localKeys:p=>[...L.keys()].filter(k=>k.startsWith(p)),localGet:k=>L.has(k)?L.get(k):null,localRemove(k){log.push(['lsdel',k]);L.delete(k);},
    async idbKeys(p){if(hooks.keys)await hooks.keys();return [...I.keys()].filter(k=>k.startsWith(p));},
    async idbGet(k){if(hooks.get)await hooks.get(k);return I.has(k)?I.get(k):null;},
    async idbReplaceIfValue(k,e,v){if((I.has(k)?I.get(k):null)!==e)return false;log.push(['idbput',k]);I.set(k,hooks.corrupt?v+'!':v);return true;},
    async idbDelIfValue(k,v){if(I.get(k)!==v)return false;log.push(['idbdel',k]);I.delete(k);return true;},
    event(meta){log.push(['event']);events.push(JSON.parse(JSON.stringify(meta)));}};
  return {io,L,I,log,events,lock(){owner=false;}};
}

test('run — 경계 밖은 두 저장소에서 지우고, 작은 저장소 사본은 IndexedDB 로 옮긴 뒤에만 지우며, 기록은 지우기 전에 이름 · 개수 · KB 만',async()=>{
  const oldSplit=rec(1,NOW-20*DAY),recent=rec(2,NOW-2*H),lsOld=rec(100,NOW-30*DAY),lsTwin=rec(101,NOW-2*H),lsTwinIdb=rec(102,NOW-2*H),lsFree=rec(103,NOW-2*H),lsDup=rec(104,NOW-2*H);
  const h=fakeIO({
    idb:[[P+'unsaved-split-old',oldSplit],[P+'unsaved-split-new',recent],[P+'twin-x-2',lsTwinIdb],[P+'dup-x-9',lsDup],['sq:pl-1','{"id":"pl-1"}'],['ps_private_board_draft_v1:u-other:kept:unsaved-split-z',rec(5,NOW-40*DAY)]],
    ls:[[P+'old-x-1',lsOld],[P+'twin-x-2',lsTwin],[P+'free-x-3',lsFree],[P+'dup-x-9',lsDup],['cs_theme','dark']]
  });
  const r=await M.run(h.io,{now:NOW});
  assert.equal(r.event,true);assert.equal(h.events.length,1);
  const meta=h.events[0];
  assert.deepEqual(meta,{stage:'ps_private_board_draft_v1:kept',n:2,kb:meta.kb,ls:1,idb:1,mv:3,mvKb:meta.mvKb,left:5,leftKb:meta.leftKb});
  assert.ok(meta.kb>=6&&meta.mvKb>=9&&meta.leftKb>=12,'KB 는 (키 + 값) × 2');
  for(const [k,v] of Object.entries(meta))assert.ok(k==='stage'?typeof v==='string':typeof v==='number',k);
  const flat=JSON.stringify(meta);
  for(const bad of [UID,'u-77','synthetic','XXXX','old-x-1','twin'])assert.ok(!flat.includes(bad),'보내지 않는다: '+bad);
  assert.equal(h.log.findIndex(x=>x[0]==='event'),0,'기록이 맨 먼저');
  assert.deepEqual(r.dropped.sort(),[P+'old-x-1',P+'unsaved-split-old'].sort());
  assert.deepEqual(r.moved.sort(),[P+'dup-x-9',P+'free-x-3',P+'twin-x-2'].sort());
  assert.deepEqual([...h.L.keys()],['cs_theme'],'작은 저장소의 보관 사본은 전부 걷혔다');
  assert.equal(h.I.get(P+'free-x-3'),lsFree,'비어 있던 자리로 옮겼다');
  assert.equal(h.I.get(P+'twin-x-2'),lsTwinIdb,'다른 값이 있던 자리는 그대로');
  assert.equal(h.I.get(P+'twin-x-2:ls-'+M.mark(lsTwin)),lsTwin,'그 사본은 :ls-<지문> 자리로');
  assert.equal(h.I.get(P+'dup-x-9'),lsDup);
  assert.equal(h.I.has(P+'unsaved-split-old'),false);assert.equal(h.I.get(P+'unsaved-split-new'),recent);
  assert.equal(h.I.has('ps_private_board_draft_v1:u-other:kept:unsaved-split-z'),true,'다른 계정의 사본은 보지 않는다');
  assert.equal(h.I.has('sq:pl-1'),true);
  const again=await M.run(h.io,{now:NOW});
  assert.equal(again.event,false);assert.equal(h.events.length,1,'두 번째는 할 일이 없어 기록도 없다');
  assert.deepEqual(again.dropped,[]);assert.deepEqual(again.moved,[]);
});

test('run — 지금 보드(:unsaved 초안 · 머리 레코드)와 같은 원문은 두 저장소 어디서 읽혔든 지우지 않는다',async()=>{
  const draft=rec(7,NOW-1000),h0=head(9,NOW-500);
  for(const where of ['ls','idb']){
    const h=fakeIO({
      [where]:[[BASE+':unsaved',draft],[BASE,h0]],
      idb:[[P+'unsaved-split-draft',JSON.stringify({v:1,uid:UID,wid:'w-1',raw:JSON.parse(draft).raw,at:NOW-30*DAY})],[P+'source-'+b36(NOW-30*DAY)+'-x-1',JSON.stringify({v:1,uid:UID,wid:'w-1',raw:JSON.parse(h0).raw,seq:NOW-30*DAY})],[P+'unsaved-split-other',rec(8,NOW-30*DAY)]].concat(where==='idb'?[[BASE+':unsaved',draft],[BASE,h0]]:[])
    });
    const r=await M.run(h.io,{now:NOW});
    assert.deepEqual(r.dropped,[P+'unsaved-split-other'],where);
    assert.equal(h.I.has(P+'unsaved-split-draft'),true,where);assert.equal(h.I.has(P+'source-'+b36(NOW-30*DAY)+'-x-1'),true,where);
    assert.equal(h.I.get(BASE+':unsaved')??h.L.get(BASE+':unsaved'),draft,'지금 초안은 그대로');
  }
});

test('run — 읽은 뒤 바뀐 값은 지우지 않고(CAS), 되읽기가 다르면 작은 저장소 사본을 남기며, 계정이 바뀌면 거기서 멈춘다',async()=>{
  const old=rec(1,NOW-20*DAY),lsOld=rec(2,NOW-20*DAY),lsNew=rec(3,NOW-2*H);
  const changed=fakeIO({idb:[[P+'a-x-1',old]],ls:[[P+'b-x-2',lsOld],[P+'c-x-3',lsNew]],hooks:{get:async k=>{if(k===P+'a-x-1'&&!changed.swapped){changed.swapped=true;}}}});
  changed.hooks=null;
  /* 셈이 끝난 뒤 저장소가 바뀐 상황 — 지우기 직전 값 대조에서 걸린다 */
  const orig=changed.io.idbDelIfValue;changed.io.idbDelIfValue=async(k,v)=>{changed.I.set(k,rec(99,NOW));return orig(k,v);};
  const origRemove=changed.io.localRemove;changed.io.localRemove=k=>{if(k===P+'b-x-2')throw new Error('synthetic removeItem failure');return origRemove(k);};
  const r=await M.run(changed.io,{now:NOW});
  assert.deepEqual(r.dropped,[],'IndexedDB 값이 바뀌었고 작은 저장소 지우기가 실패했다 — 지운 것 없음');
  assert.equal(changed.I.get(P+'a-x-1'),rec(99,NOW));assert.equal(changed.L.get(P+'b-x-2'),lsOld);
  assert.deepEqual(r.moved,[P+'c-x-3']);
  const corrupt=fakeIO({ls:[[P+'c-x-3',lsNew]],hooks:{corrupt:true}});
  const c=await M.run(corrupt.io,{now:NOW});
  assert.deepEqual(c.moved,[]);assert.equal(corrupt.L.get(P+'c-x-3'),lsNew,'되읽은 글이 다르면 작은 저장소 사본은 남긴다');
  const locked=fakeIO({idb:[[P+'a-x-1',old]],ls:[[P+'b-x-2',lsOld]],hooks:{keys:async()=>locked.lock()}});
  await assert.rejects(M.run(locked.io,{now:NOW}),e=>e.name==='StorageOwnerChangedError');
  assert.equal(locked.I.get(P+'a-x-1'),old);assert.equal(locked.L.get(P+'b-x-2'),lsOld);assert.equal(locked.events.length,0,'계정이 바뀌면 기록도 지우기도 없다');
  assert.equal(await M.run({uid:''}),null,'로그인하지 않은 기기는 아무것도 안 한다');
});

test('run — 기록(ps_events)을 못 남겨도 정리는 하고, 글이 아닌 IndexedDB 값은 손대지 않는다',async()=>{
  const h=fakeIO({idb:[[P+'a-x-1',rec(1,NOW-20*DAY)],[P+'obj-x-2',{v:1,raw:'x'}]]});
  h.io.event=()=>{throw new Error('synthetic event failure');};
  const r=await M.run(h.io,{now:NOW});
  assert.equal(r.event,false);assert.deepEqual(r.dropped,[P+'a-x-1']);assert.deepEqual(h.I.get(P+'obj-x-2'),{v:1,raw:'x'});
});

/* ── storage.js 연결 · 키 표 · 셸 ── */
const storage=R('studio/storage.js');
function section(a,b){const s=storage.indexOf(a),e=storage.indexOf(b,s);assert.ok(s>=0&&e>s,a);return storage.slice(s,e);}

test('storage.js — optimize 가 정리 뒤 · requestPersist 앞에 keptPrune 를 부르고, 기록 이름은 storage_kept_pruned(status ok · feature storage)',()=>{
  const opt=section('    optimize:function(){','    /* ── 저장 위험 안내');
  const cleanup=opt.indexOf('return Promise.all(cleanupKeys.map('),prune=opt.indexOf('keptPrune(owner,current)'),persist=opt.indexOf('return requestPersist()');
  assert.ok(cleanup>0&&prune>cleanup&&persist>prune,'차례: 옛 사본 정리 → 보관 사본 정리 → persist');
  assert.match(opt,/keptPruned:keptPruned/,'결과에 실린다');
  const fn=section('  function keptPrune(owner,current){','  /* v369 — 팀 전환');
  assert.match(fn,/S\.event\('storage_kept_pruned',\{status:'ok',feature:'storage',meta:meta\}\)/);
  assert.match(fn,/idbDelIfValue\(k,value,current\)/,'지우기는 값 대조(CAS)');
  assert.match(fn,/idbReplaceIfValue\(k,expected,value,current\)/);
  assert.match(fn,/e\.name==='StorageOwnerChangedError'\)throw e/,'계정이 바뀐 오류는 optimize 로 올린다');
  assert.doesNotMatch(fn,/localStorage\.setItem/,'작은 저장소에는 쓰지 않는다');
  const app=R('studio/app.html'),at=app.indexOf('<script src="storage-kept.js"></script>');
  assert.ok(at>app.indexOf('<script src="storage.js"></script>')&&at<app.indexOf('<title>'),'셸 머리가 storage.js 뒤에 싣는다(키 표 → 저장소 → learning-off · i18n 차례를 박은 시험 둘은 그대로)');
  assert.match(R('sw.js'),/'\/studio\/storage-kept\.js'/,'sw CORE');
});

test('storage.js keptPrune — 모듈과 저장소를 잇는다(가짜 저장소): 이름 · 개수 · KB 만 보내고, 모듈이 없는 창은 건너뛴다',async()=>{
  const old=rec(1,NOW-20*DAY),lsNew=rec(3,NOW-2*H);
  const local=new Map([[P+'c-x-3',lsNew]]),disk=new Map([[P+'a-x-1',old]]),events=[];
  const c=vm.createContext({Promise,JSON,String,Object,Array,Date,Math,encodeURIComponent,console:{warn(){}},
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,removeItem:k=>local.delete(k)},
    localKeys:p=>[...local.keys()].filter(k=>k.startsWith(p)),idbKeys:async p=>[...disk.keys()].filter(k=>k.startsWith(p)),
    idbGet:async k=>disk.get(k),idbReplaceIfValue:async(k,e,v,cur)=>{cur();if((disk.has(k)?disk.get(k):null)!==e)return false;disk.set(k,v);return true;},
    idbDelIfValue:async(k,v,cur)=>{cur();if(disk.get(k)!==v)return false;disk.delete(k);return true;},
    PSStorageKept:M,PSSync:{event:(name,opts)=>events.push({name,opts})}});
  c.window=c;c.top=c;
  vm.runInContext(section('  function keptPrune(owner,current){','  /* v369 — 팀 전환')+';this.keptPrune=keptPrune;',c);
  let calls=0;const current=()=>{calls++;};
  const r=await c.keptPrune(JSON.stringify([UID,'w-1','seal','','']),current);
  assert.equal(r.stat.n,1);assert.equal(r.stat.mv,1);assert.ok(calls>3,'current 를 자주 본다');
  assert.deepEqual(events.map(e=>e.name),['storage_kept_pruned']);
  assert.equal(events[0].opts.status,'ok');assert.equal(events[0].opts.feature,'storage');assert.equal(events[0].opts.meta.stage,'ps_private_board_draft_v1:kept');
  assert.equal(disk.has(P+'a-x-1'),false);assert.equal(disk.get(P+'c-x-3'),lsNew);assert.equal(local.size,0);
  assert.equal(await c.keptPrune(JSON.stringify(['','','','','']),current),null,'계정 없음');
  c.PSStorageKept=null;c.top={};
  assert.equal(await c.keptPrune(JSON.stringify([UID,'w-1','seal','','']),current),null,'모듈 없는 창');
  c.PSStorageKept=M;
  const stale=()=>{const e=new Error('owner');e.name='StorageOwnerChangedError';throw e;};
  await assert.rejects(c.keptPrune(JSON.stringify([UID,'w-1','seal','','']),stale),e=>e.name==='StorageOwnerChangedError');
});

test('키 표 — :kept: 줄은 복구 사본(recovery · IndexedDB · 지키는 키는 작업 보드 기록)이고, 보고 이름은 예전 그대로 ps_private_board_draft_v1:kept',()=>{
  const kept=K.info(P+'unsaved-split-abc'),base=K.info(BASE),unsaved=K.info(BASE+':unsaved');
  assert.equal(kept.key,M.TABLE_ROW);assert.equal(kept.role,'recovery');assert.equal(kept.home,'idb');assert.equal(kept.sync,'device');assert.equal(kept.of,'ps_private_board_draft_v1:');
  assert.equal(K.label(P+'x'),'복구 사본 · 이 기기만');
  assert.equal(base.key,'ps_private_board_draft_v1:');assert.equal(base.role,'draft');assert.equal(base.home,'idb','IndexedDB 먼저(3.190)');
  assert.equal(unsaved.key,'ps_private_board_draft_v1:');
  assert.equal(K.info('ps_private_board_draft_v1:u-1:rescue:w:0').key,'ps_private_board_draft_v1:');
  assert.equal(K.info('kept:ps_private_board_draft_v1:'),null,'와일드카드는 접두사 뒤에서만');
  const c=vm.createContext({PSStorageKeys:K,String,Object,JSON});c.window=c;c.top=c;
  vm.runInContext(section('  function fullName(k){','  /* 작은 저장소를 키 표 이름')+';this.fullName=fullName;',c);
  assert.equal(c.fullName(P+'unsaved-split-abc'),'ps_private_board_draft_v1:kept');
  assert.equal(c.fullName(P+'x-y-1:ls-abc-1x'),'ps_private_board_draft_v1:kept','옮겨 둔 자리도 같은 이름');
  assert.equal(c.fullName(BASE+':unsaved'),'ps_private_board_draft_v1:unsaved');assert.equal(c.fullName(BASE),'ps_private_board_draft_v1:head');
  assert.equal(M.STAGE,'ps_private_board_draft_v1:kept');
});
