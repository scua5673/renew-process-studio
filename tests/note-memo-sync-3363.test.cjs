'use strict';
/* 3.363 — 개인 노트 «메모»를 내 계정에(studio/note-memo-sync.js): 합치기 규칙과 가짜 창에서의 받기 · 올리기 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../studio/note-memo-sync.js');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const memo=(id,text,at,more)=>Object.assign({id,text,html:'',folder:'',pinned:false,createdAt:at,updatedAt:at},more||{});
const NOW=Date.now(),T=n=>NOW-100000+n;

test('두 기기에서 따로 적은 메모는 둘 다 남는다',()=>{
  const out=M.merge({m:[memo('Ma','폰에서',10)],f:[],d:{}},{m:[memo('Mb','맥에서',20)],f:[],d:{}},NOW);
  assert.deepEqual(out.m.map(x=>x.id),['Ma','Mb']);
});

test('같은 메모는 나중에 고친 쪽이 남고, 같은 시각이면 이 기기 것이 남는다',()=>{
  let out=M.merge({m:[memo('M1','옛 글',10)]},{m:[memo('M1','새 글',20)]},NOW);
  assert.equal(out.m[0].text,'새 글');
  out=M.merge({m:[memo('M1','이 기기',20)]},{m:[memo('M1','서버',20)]},NOW);
  assert.equal(out.m[0].text,'이 기기');
});

test('지운 기록이 마지막 수정보다 새면 지우고, 지운 뒤 다시 고친 메모는 살린다',()=>{
  let out=M.merge({m:[memo('M1','글',T(10))]},{m:[],d:{M1:T(15)}},NOW);
  assert.equal(out.m.length,0);assert.equal(out.d.M1,T(15));
  out=M.merge({m:[memo('M1','다시 고침',T(30))]},{m:[],d:{M1:T(15)}},NOW);
  assert.equal(out.m.length,1);
});

test('폴더 이름은 나중에 바꾼 쪽, 지운 폴더의 메모는 «모든 메모»로',()=>{
  let out=M.merge({f:[{id:'F1',name:'훈련',at:10}]},{f:[{id:'F1',name:'훈련 아이디어',at:20}]},NOW);
  assert.equal(out.f[0].name,'훈련 아이디어');
  out=M.merge({m:[memo('M1','글',T(10),{folder:'F1'})],f:[{id:'F1',name:'훈련',at:T(5)}]},{m:[],f:[],d:{F1:T(50)}},NOW);
  assert.equal(out.f.length,0);assert.equal(out.m[0].folder,'');assert.equal(out.m[0].updatedAt,T(10));
});

test('빈 메모는 올리지 않고, 올릴 글은 기기 차례와 상관없이 같다',()=>{
  const a={m:[memo('Mb','둘',20),memo('Ma','하나',10),memo('Mz','',30)],f:[],d:{}};
  const b={m:[memo('Ma','하나',10),memo('Mb','둘',20)],f:[],d:{}};
  assert.equal(M.body(a).m.length,2);
  assert.ok(M.same(a,b));
  const doc=JSON.parse(M.raw(a,123));
  assert.equal(doc.v,1);assert.equal(doc.at,123);assert.deepEqual(doc.m.map(x=>x.id),['Ma','Mb']);assert.ok(Array.isArray(doc.f));
  assert.ok(M.blank({text:'  ',html:'<div><br></div>'}));assert.ok(!M.blank({text:'',html:'<div>글</div>'}));
});

test('사라진 id 는 지운 기록으로, 오래된 지운 기록은 걷는다',()=>{
  const t=M.gone({Ma:1,Mb:1,F1:1},{Ma:1},{},500);
  assert.deepEqual(t,{Mb:500,F1:500});
  const old=NOW-200*86400000;
  assert.deepEqual(M.merge({d:{Mx:old}},{d:{My:NOW-1000}},NOW).d,{My:NOW-1000});
});

test('모양이 다른 서버 값은 버린다',()=>{
  const out=M.merge({m:[memo('M1','글',10)]},{m:[{id:5,text:'x'},null,{id:'M2',text:7,updatedAt:'30'}],f:'x',d:[1]},NOW);
  assert.deepEqual(out.m.map(x=>x.id),['M1','M2']);assert.equal(out.m[1].text,'');assert.equal(out.m[1].updatedAt,30);
});

/* ── 가짜 창 — 받기 · 올리기 · 충돌 · 계정 바뀜 ── */
function fakeWindow(opts){
  const ls=new Map(Object.entries(opts.ls||{})),timers=[],listeners={};
  let memos=opts.memos||[],folders=opts.folders||[];
  const server={raw:opts.remote||null,cupd:opts.remote?1:null,saves:[],conflictOnce:!!opts.conflictOnce,other:opts.other||null};
  const w={
    localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>{ls.set(k,String(v));}},
    psSaveShared:(k,v)=>{ls.set(k,String(v));return true;},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].fn=null;},
    addEventListener:(n,fn)=>{listeners[n]=fn;},
    document:{visibilityState:'visible',addEventListener:(n,fn)=>{listeners['doc:'+n]=fn;}},
    __memoSync:{get:()=>({memos,folders}),idle:()=>opts.idle!==false,set:(m,f)=>{memos=m;folders=f;w.sets=(w.sets||0)+1;return true;}},
    PSSync:{memo:{owner:()=>(opts.uid===null?null:{uid:opts.uid||'u1',wid:'w1'}),
      get:async()=>({ok:true,uid:opts.uid||'u1',wid:'w1',raw:server.raw,cupd:server.cupd}),
      save:async(raw,o)=>{
        if(server.conflictOnce){server.conflictOnce=false;server.raw=server.other;server.cupd=(server.cupd||0)+1;const e=new Error('c');e.psCode='sync_conflict';throw e;}
        if(o.expected_raw!==server.raw||o.expected_cupd!==server.cupd){const e=new Error('c');e.psCode='sync_conflict';throw e;}
        server.raw=raw;server.cupd=(server.cupd||0)+1;server.saves.push(raw);return {ok:true,raw,cupd:server.cupd};}}}
  };
  w.parent=w;
  const run=async()=>{for(let i=0;i<40;i++){const t=timers.filter(x=>x.fn).sort((a,b)=>a.ms-b.ms)[0];if(!t){await new Promise(r=>setImmediate(r));if(!timers.find(x=>x.fn))break;continue;}const fn=t.fn;t.fn=null;fn();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));}};
  return {w,ls,server,run,get memos(){return memos;},get folders(){return folders;},setMemos:m=>{memos=m;}};
}
const fresh=()=>{delete require.cache[require.resolve('../studio/note-memo-sync.js')];return require('../studio/note-memo-sync.js');};

test('처음 맞출 때: 서버 메모를 받고 이 기기 메모를 올린다',async()=>{
  const S=fresh(),remote=S.raw({m:[memo('Mr','서버 메모',50)],f:[{id:'Fr',name:'경기',at:40}],d:{}},1);
  const F=fakeWindow({memos:[memo('Ml','기기 메모',60),memo('Mblank','',70)],remote});
  S.mount(F.w);await F.run();
  assert.deepEqual(F.memos.map(x=>x.id).sort(),['Mblank','Ml','Mr']);
  assert.equal(F.folders[0].id,'Fr');
  assert.equal(F.server.saves.length,1);
  assert.deepEqual(JSON.parse(F.server.raw).m.map(x=>x.id),['Ml','Mr']);
  assert.equal(F.ls.get(S.OWNER_KEY),'u1');
  assert.equal(S.state(),'synced');
});

test('메모를 지우면 지운 기록이 올라가고 서버에서도 빠진다',async()=>{
  const S=fresh(),remote=S.raw({m:[memo('Ma','하나',10),memo('Mb','둘',20)],f:[],d:{}},1);
  const F=fakeWindow({memos:[memo('Ma','하나',10),memo('Mb','둘',20)],remote,ls:{[S.OWNER_KEY]:'u1'}});
  S.mount(F.w);await F.run();
  assert.equal(F.server.saves.length,0,'같으면 올리지 않는다');
  F.setMemos([memo('Ma','하나',10)]);S.touched();await F.run();
  const doc=JSON.parse(F.server.raw);
  assert.deepEqual(doc.m.map(x=>x.id),['Ma']);assert.ok(doc.d.Mb>0);
});

test('다른 기기가 먼저 썼으면 다시 받아 합친 뒤 한 번 더 올린다',async()=>{
  const S=fresh(),base=S.raw({m:[memo('Ma','하나',10)],f:[],d:{}},1),other=S.raw({m:[memo('Ma','하나',10),memo('Mo','다른 기기',90)],f:[],d:{}},2);
  const F=fakeWindow({memos:[memo('Ma','하나',10)],remote:base,ls:{[S.OWNER_KEY]:'u1'},conflictOnce:true,other});
  S.mount(F.w);await F.run();
  F.setMemos([memo('Ma','하나',10),memo('Mn','새 메모',95)]);S.touched();await F.run();
  assert.deepEqual(JSON.parse(F.server.raw).m.map(x=>x.id),['Ma','Mn','Mo']);
  assert.deepEqual(F.memos.map(x=>x.id).sort(),['Ma','Mn','Mo']);
});

test('치는 중에는 화면에 넣지 않지만, 올릴 때는 서버 메모를 품는다',async()=>{
  const S=fresh(),remote=S.raw({m:[memo('Mr','서버 메모',50)],f:[],d:{}},1);
  const F=fakeWindow({memos:[memo('Ml','치는 중',60)],remote,idle:false,ls:{[S.OWNER_KEY]:'u1'}});
  S.mount(F.w);
  for(let i=0;i<6;i++){await new Promise(r=>setImmediate(r));}
  /* 받기 한 번 + 올리기 한 번만 돌린다(다시 받기 타이머는 계속 걸린다) */
  await F.run();
  assert.equal(F.w.sets||0,0,'화면은 그대로');
  assert.ok(F.server.saves.length>=1);
  assert.deepEqual(JSON.parse(F.server.raw).m.map(x=>x.id),['Ml','Mr'],'서버의 메모를 지우지 않는다');
});

test('다른 계정으로 맞춰진 기기에서는 올리지도 받지도 않는다',async()=>{
  const S=fresh(),remote=S.raw({m:[memo('Mr','내 계정 메모',50)],f:[],d:{}},1);
  const F=fakeWindow({memos:[memo('Ml','앞 사람 메모',60)],remote,ls:{[S.OWNER_KEY]:'someone-else'}});
  S.mount(F.w);await F.run();S.touched();await F.run();
  assert.equal(F.server.saves.length,0);assert.deepEqual(F.memos.map(x=>x.id),['Ml']);assert.equal(S.state()==='synced',false);
});

test('로그인 전에는 아무 일도 하지 않는다',async()=>{
  const S=fresh(),F=fakeWindow({memos:[memo('Ml','글',60)],uid:null});
  S.mount(F.w);await F.run();S.touched();await F.run();
  assert.equal(F.server.saves.length,0);assert.equal(F.ls.has(S.OWNER_KEY),false);
});

test('배선 — 노트 화면 · 동기화 통로 · 서비스워커 · 저장 키 표',()=>{
  const note=read('studio/note.html'),sync=read('studio/sync.js'),sw=read('sw.js'),keys=require('../studio/storage-keys.js');
  assert.ok(note.includes('<script src="note-picture.js"></script><script src="note-memo-sync.js"></script>'));
  assert.match(note,/function persist\(quiet\)\{[^\n]*if\(!quiet&&window\.PSNoteMemoSync\)window\.PSNoteMemoSync\.touched\(\);return true;\}/);
  assert.match(note,/window\.__memoSync=\{/);assert.match(note,/if\(!persist\(true\)\)\{ memos=keepM; folders=keepF; return false; \}/);
  assert.match(note,/folders\.push\(\{id:mkId\('F'\),name:v\.slice\(0,24\),at:Date\.now\(\)\}\)/);
  assert.match(sync,/var MEMO_CFG=\{key:'cs_notes_memo_sync_v1'/);
  assert.match(sync,/memo:\{version:1,key:MEMO_CFG\.key,owner:boardLiveContext,get:function\(\)\{ return pdGet\(MEMO_CFG\); \},save:function\(r,o\)\{ return pdSave\(MEMO_CFG,r,o\); \}\}/);
  /* 동기화 키 목록(KEYS · PERSONAL)에는 넣지 않는다 — 키 통째 덮어쓰기 길이라 한쪽 기기의 메모가 사라진다 */
  const keysBlock=sync.slice(sync.indexOf('var KEYS=['),sync.indexOf('var PLAYER_BLIND='));
  assert.ok(!keysBlock.includes('cs_notes_memo'));
  assert.match(sw,/'\/studio\/note-memo-sync\.js'/);
  const text=read('studio/storage-keys.js');
  for(const k of ['cs_notes_memo_sync_v1','cs_notes_memo_v1','cs_notes_folders_v1'])assert.match(text,new RegExp("\\['"+k+"','pdoc'"));
  for(const k of [M.TOMB_KEY,M.OWNER_KEY])assert.match(text,new RegExp("\\['"+k+"','device'"));
  assert.ok(keys);
});
