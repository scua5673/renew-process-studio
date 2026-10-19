'use strict';
/* 3.112 — 로그인하지 않은 기기의 작전판은 이 기기에 저장한다(3.008 f196326 을 옮김 · studio/board-guest.js).
   2.827 부터 작전판의 저장 자리가 계정에 묶여 로그인하지 않은 «저장»은 알림만 내고, 새로고침하면 그림이 사라졌다.
   여기서는 모듈의 판단(게스트인가 · 빈 계정에 열어도 되나)과 감싼 함수가 계정일 때 원래 함수를 그대로 지나는지를 본다.
   브라우저 흐름(저장 · 새로고침 · 로그인해서 열기 · 저장하면 기기 칸 비우기)은 tests/browser/board-guest-save.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const G=require('../studio/board-guest.js');
const board=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const keys=require('../studio/storage-keys.js');
const tick=()=>new Promise(r=>setTimeout(r,0));

test('isGuest: 주인 · 세션 · 계정 흔적이 하나도 없을 때만',()=>{
  assert.equal(G.isGuest({}),true,'처음 쓰는 기기');
  assert.equal(G.isGuest({owner:{uid:'a',wid:'w'}}),false,'계정 보드 주인이 있다');
  assert.equal(G.isGuest({deviceUid:'a'}),false,'셸이 늦게 떠도 기기 세션이 있으면 로그인한 기기');
  assert.equal(G.isGuest({shellUid:'a'}),false,'팀 전환 잠금처럼 잠깐 주인이 없는 것은 게스트가 아니다');
  assert.equal(G.isGuest({deviceOwner:true}),false,'다른 계정 흔적이 남은 로그아웃 기기 — perms.js 가 보기 전용으로 잠근다');
  assert.equal(G.isGuest({deviceWs:true}),false);
  assert.equal(G.isGuest({community:true}),false,'커뮤니티 보기는 남의 글');
});

test('기기 칸 원문: 계정 보드와 같은 live 본문 · 모양이 틀리면 없는 것',()=>{
  const live={snap:{players:[{num:'9'}],equipment:[],drawings:[]},view:'board'};
  const rec=G.encode(JSON.stringify(live),5);
  const d=G.decode(rec);
  assert.deepEqual(d.live,live);assert.equal(d.at,5);assert.equal(d.value,rec);
  for(const bad of [null,'','{',JSON.stringify({v:2,raw:'{}'}),JSON.stringify({v:1,raw:'[]'}),JSON.stringify({v:1,raw:'x'}),JSON.stringify({v:1,raw:5})])assert.equal(G.decode(bad),null,String(bad));
});

test('hasContent: 지금 판 · 다른 페이지 · 장면 중 하나라도 무엇이 있으면',()=>{
  const E={players:[],equipment:[],drawings:[]},F={players:[{num:'1'}],equipment:[],drawings:[]};
  assert.equal(G.hasContent({snap:E}),false);
  assert.equal(G.hasContent(null),false);
  assert.equal(G.hasContent({snap:F}),true);
  assert.equal(G.hasContent({snap:E,boardPages:{pages:[{snap:E},{snap:{players:[],equipment:[{}],drawings:[]}}]}}),true,'두 번째 페이지에 장비');
  assert.equal(G.hasContent({snap:E,animFrames:[{snap:E},{snap:{players:[],equipment:[],drawings:[{}]}}]}),true,'장면에 그림');
});

test('canAdopt: 서버가 «없음»이라 답했고 이 기기에도 그 계정 사본 · 초안이 없고 아무도 손대지 않았을 때만',()=>{
  const ok={loaded:true,record:null,base:{raw:null,cupd:null},head:null,idbHead:null,draft:false,dirty:false,edited:false,busy:false};
  assert.equal(G.canAdopt(ok),true);
  const no=(patch,why)=>assert.equal(G.canAdopt({...ok,...patch}),false,why);
  no({loaded:false},'아직 불러오는 중');
  no({record:{raw:'{}'}},'계정 보드가 있다');
  no({base:null},'서버를 못 읽었다 — 빈 것이 아니다');
  no({base:{raw:'{}',cupd:3}},'서버에 보드가 있다');
  no({head:'{}'},'이 기기 localStorage 에 그 계정 사본');
  no({idbHead:'{}'},'이 기기 IndexedDB 에 그 계정 사본');
  no({draft:true},'저장 안 한 계정 초안(3.038)이 먼저');
  no({dirty:true},'그새 바뀌었다');no({edited:true},'그새 손댔다');no({busy:true},'보관함 · 편집기 · 미팅이 판을 빌려 쓴다');
});

/* ── 감싸기: 가짜 작전판 창 ── */
function fakeBoard({ls={},owner=null,slot=null}={}){
  const calls=[],store=new Map(),toasts=[];
  if(slot)store.set(G.KEY,slot);
  const classes=new Set();
  const win={
    calls,store,toasts,
    location:{search:''},parent:null,
    localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(ls,k)?ls[k]:null},
    document:{body:{classList:{contains:c=>classes.has(c)}}},
    _boardPrivateOwner:null,_boardPrivateLoaded:false,_boardPrivateRecord:null,_boardPrivateBase:null,_boardPrivateHead:null,_boardPrivateIdbHead:null,
    _boardPrivateGeneration:0,_boardPrivateEditSeq:0,_boardManualDirty:false,_boardUserTouched:false,
    canvas:null,
    storage:{
      get:async k=>store.has(k)?{value:store.get(k)}:null,
      set:async(k,v)=>{calls.push(['storage.set',k]);store.set(k,v);return true;},
      delIfValue:async(k,v)=>{calls.push(['storage.delIfValue',k]);if(store.get(k)===v){store.delete(k);return true;}return false;}
    },
    toast:m=>toasts.push(m),
    boardManualStatus(){calls.push(['status']);},
    boardPrivateOwner:()=>owner?{...owner}:null,
    boardLiveCapture:()=>({raw:JSON.stringify({snap:win.canvas,view:'board'})}),
    boardLiveApply(live){calls.push(['apply']);win.canvas=live.snap;},
    boardDraftRead:async()=>null,
    boardDraftWriteNow(){calls.push(['draftWrite']);return true;},
    boardSaveExplicit(o){calls.push(['orig.save',o]);return win.__saveResult||(win.__saveResult=Promise.resolve(true));},
    boardSaveOne(){calls.push(['orig.one']);return Promise.resolve('one');},
    boardSaveLive(){calls.push(['orig.live']);return 'live';},
    restoreLiveBoard(){calls.push(['orig.restore']);return Promise.resolve(win.__restoreResult===undefined?true:win.__restoreResult);},
    boardPrivateAuthChanged(){calls.push(['orig.auth']);}
  };
  win.__boardSaveExplicit=win.boardSaveExplicit;win.__boardSaveOne=win.boardSaveOne;
  win.setOwner=o=>{owner=o;};
  win.classes=classes;
  return win;
}
const lex=()=>({applying:false,playing:false});
const ACC={uid:'u1',wid:'p1'};
const LOGGED={ps_sync_session:JSON.stringify({uid:'u1',at:'a',rt:'r'}),ps_cache_owner_v1:'{"uid":"u1"}',ps_active_ws:'t1'};

test('로그인한 기기: 감싼 함수는 같은 인자로 원래 함수를 부르고 결과를 그대로 돌려준다(계정 저장 길은 그대로)',async()=>{
  const w=fakeBoard({ls:LOGGED,owner:ACC});
  const orig={save:w.boardSaveExplicit,live:w.boardSaveLive};
  G.mount(w,{lex});
  assert.notEqual(w.boardSaveExplicit,orig.save,'감쌌다');
  assert.equal(w.__boardSaveExplicit,w.boardSaveExplicit,'창에 건 이름도 감싼 것');
  const arg={quiet:true};
  const p=w.boardSaveExplicit(arg);
  assert.equal(p,w.__saveResult,'빈 계정에 연 보드가 없으면 원래 약속 그대로');
  assert.deepEqual(w.calls.at(-1),['orig.save',arg]);
  assert.equal(await w.boardSaveOne(),'one');
  assert.equal(w.boardSaveLive(),'live');
  assert.equal(w._boardManualDirty,false,'계정 편집의 «변경됨»은 원래 함수가 정한다');
  w.boardPrivateAuthChanged();
  assert.ok(w.calls.some(c=>c[0]==='orig.auth'));
  w.__restoreResult=false;
  assert.equal(await w.restoreLiveBoard(),false);
  assert.equal(w.calls.filter(c=>c[0]==='storage.set'||c[0]==='storage.delIfValue'||c[0]==='apply').length,0,'기기 칸과 판은 건드리지 않는다');
  assert.equal(w.__psBoardGuest.active(),false);
});

test('셸이 아직 주인을 주지 않아도 기기 세션이 있으면 게스트가 아니다 · 계정 흔적이 남은 로그아웃 기기도',async()=>{
  for(const ls of [{ps_sync_session:LOGGED.ps_sync_session},{ps_cache_owner_v1:'{"uid":"u1"}'},{ps_active_ws:'t1'}]){
    const w=fakeBoard({ls,owner:null});G.mount(w,{lex});
    assert.equal(w.__psBoardGuest.active(),false,JSON.stringify(ls));
    await w.boardSaveExplicit();
    assert.equal(w.calls.filter(c=>c[0]==='orig.save').length,1,'원래 «저장»(로그인 안내)');
    assert.equal(w.store.size,0,'기기 칸에 쓰지 않는다');
  }
});

test('게스트: 연다 → 손대면 «변경됨» → «저장»은 기기 칸에(다시 읽어 확인) · 서버 길(원래 함수)은 부르지 않는다',async()=>{
  const slot=G.encode(JSON.stringify({snap:{players:[{num:'7'}],equipment:[],drawings:[]},view:'board'}),1);
  const w=fakeBoard({slot});G.mount(w,{lex});
  assert.equal(w.__psBoardGuest.active(),true);
  assert.equal(await w.restoreLiveBoard(),true,'부팅 복원이 기기 칸을 연다');
  assert.equal(w.__psBoardGuest.loaded(),true);
  assert.deepEqual(w.canvas.players.map(p=>p.num),['7']);
  assert.equal(w._boardManualDirty,false,'불러온 판은 «변경»이 아니다');
  w.boardSaveLive();
  assert.equal(w._boardManualDirty,true,'게스트 편집도 «변경됨»(닫기 경고)');
  w.canvas={players:[{num:'7'},{num:'8'}],equipment:[],drawings:[]};
  assert.equal(await w.boardSaveExplicit(),true);
  assert.equal(w._boardManualDirty,false);
  assert.deepEqual(JSON.parse(G.decode(w.store.get(G.KEY)).raw).snap.players.map(p=>p.num),['7','8']);
  assert.match(w.toasts.at(-1),/이 기기에 저장됨/);
  assert.equal(await w.boardSaveOne(),true,'저장 단추 하나(3.077)도 기기 칸 — 보관함은 묻지 않는다');
  assert.equal(w.calls.filter(c=>/^orig\.(save|one|restore)$/.test(c[0])).length,0,'계정 저장 · 불러오기는 부르지 않는다');
});

test('게스트: 저장하는 사이 또 손대면 «변경됨»이 남는다 · 기기에 못 쓰면 실패를 알린다',async()=>{
  const w=fakeBoard();G.mount(w,{lex});await w.restoreLiveBoard();
  w.canvas={players:[{num:'1'}],equipment:[],drawings:[]};
  w.boardSaveLive();
  const p=w.boardSaveExplicit();w.boardSaveLive();
  assert.equal(await p,true);assert.equal(w._boardManualDirty,true,'저장 뒤에 그린 것은 저장 전');
  w.storage.set=async()=>{throw new Error('QuotaExceededError');};
  assert.equal(await w.boardSaveExplicit(),false);assert.match(w.toasts.at(-1),/저장하지 못했어요/);
  w.storage.set=async()=>true;   /* 쓴다고 했지만 다시 읽으면 다르다(앞 저장의 원문이 남아 있다) */
  w.canvas={players:[{num:'2'}],equipment:[],drawings:[]};
  assert.equal(await w.boardSaveExplicit(),false,'다시 읽어 확인한다');
});

test('게스트: 다 열기 전 «저장»은 기다리라고 하고, 여는 사이 손댄 판은 기기 칸으로 덮지 않는다',async()=>{
  const slot=G.encode(JSON.stringify({snap:{players:[{num:'7'}],equipment:[],drawings:[]}}),1);
  const w=fakeBoard({slot});G.mount(w,{lex});
  let release;w.storage.get=k=>new Promise(r=>{release=()=>r({value:slot});});
  const p=w.restoreLiveBoard();
  assert.equal(await w.boardSaveExplicit(),false);assert.match(w.toasts.at(-1),/여는 중/);
  w._boardUserTouched=true;w.canvas={players:[{num:'99'}],equipment:[],drawings:[]};   /* 사람이 그렸다(pushUndo) */
  release();await p;
  assert.deepEqual(w.canvas.players.map(p=>p.num),['99'],'그린 판 그대로');
  assert.equal(w._boardManualDirty,true,'그린 것은 저장 전');
});

test('게스트가 그대로 게스트인 인증 신호는 판을 비우지 않는다(원래 함수가 판을 비웠다)',async()=>{
  const w=fakeBoard();G.mount(w,{lex});await w.restoreLiveBoard();
  w._boardManualDirty=true;
  w.boardPrivateAuthChanged();
  assert.equal(w.calls.filter(c=>c[0]==='orig.auth').length,0);
  assert.equal(w._boardManualDirty,true);
});

test('로그인했는데 계정 보드가 비어 있으면 기기 칸의 보드를 «변경됨»으로 연다 → «저장»이 계정에 들어가면 연 그 원문일 때만 기기 칸을 비운다',async()=>{
  const slot=G.encode(JSON.stringify({snap:{players:[{num:'4'}],equipment:[],drawings:[]}}),1);
  const w=fakeBoard({ls:LOGGED,owner:ACC,slot});G.mount(w,{lex});
  Object.assign(w,{_boardPrivateOwner:{...ACC},_boardPrivateLoaded:true,_boardPrivateBase:{raw:null,cupd:null}});
  assert.equal(await w.restoreLiveBoard(),true,'원래 결과 그대로');
  assert.equal(w.__psBoardGuest.adopted(),true);
  assert.deepEqual(w.canvas.players.map(p=>p.num),['4']);
  assert.equal(w._boardManualDirty&&w._boardUserTouched,true,'«저장 ●»');
  assert.equal(w.calls.filter(c=>c[0]==='orig.save').length,0,'서버로 바로 보내지 않는다');
  assert.equal(w.boardDraftWriteNow(),false,'손대지 않은 연 보드는 계정 초안으로 적지 않는다(첫 부팅 새로 열기 뒤에 다시 연다)');
  w._boardPrivateEditSeq++;
  assert.equal(w.boardDraftWriteNow(),true,'손대면 예전처럼 초안');
  w.__saveResult=Promise.resolve(false);
  assert.equal(await w.boardSaveExplicit(),false,'원래 결과 그대로');await tick();
  assert.equal(w.store.has(G.KEY),true,'서버 저장이 확인되지 않으면 기기 칸을 남긴다');
  assert.equal(w.__psBoardGuest.adopted(),true);
  w.__saveResult=Promise.resolve(true);
  assert.equal(await w.boardSaveExplicit(),true);await tick();
  assert.equal(w.store.has(G.KEY),false,'계정에 들어갔으니 비운다');
  assert.equal(w.__psBoardGuest.adopted(),false);
});

test('연 보드 대신 «새 보드»를 저장하면 기기 칸은 지우지 않고 남긴다 · 다른 창이 기기 칸을 새로 저장했으면 남긴다',async()=>{
  const slot=G.encode(JSON.stringify({snap:{players:[{num:'4'}],equipment:[],drawings:[]}}),1);
  const open=async()=>{const w=fakeBoard({ls:LOGGED,owner:ACC,slot});G.mount(w,{lex});
    Object.assign(w,{_boardPrivateOwner:{...ACC},_boardPrivateLoaded:true,_boardPrivateBase:{raw:null,cupd:null}});await w.restoreLiveBoard();assert.equal(w.__psBoardGuest.adopted(),true);return w;};
  const a=await open();
  await a.boardSaveExplicit({noLink:true,quiet:true});await tick();
  assert.equal(a.__psBoardGuest.adopted(),false);
  await a.boardSaveExplicit();await tick();
  assert.equal(a.store.get(G.KEY),slot,'«새 보드» 뒤의 저장도 기기 칸을 지우지 않는다');
  const b=await open();
  b.store.set(G.KEY,G.encode(JSON.stringify({snap:{players:[{num:'5'}],equipment:[],drawings:[]}}),2));   /* 다른 창의 게스트가 그 사이 저장 */
  await b.boardSaveExplicit();await tick();
  assert.equal(b.store.has(G.KEY),true,'연 그 원문일 때만 지운다');
});

test('계정 보드 · 이 기기 사본 · 저장 안 한 초안 · 손댄 판이 있으면 열지 않는다',async()=>{
  const slot=G.encode(JSON.stringify({snap:{players:[{num:'4'}],equipment:[],drawings:[]}}),1);
  const cases=[
    ['서버에 보드',{_boardPrivateBase:{raw:'{"snap":{}}',cupd:3},_boardPrivateRecord:{raw:'{"snap":{}}'}}],
    ['기기 사본',{_boardPrivateHead:'{}'}],
    ['서버를 못 읽음',{_boardPrivateBase:null}],
    ['손댐',{_boardManualDirty:true}],
    ['초안',{boardDraftRead:async()=>({at:1})}],
    ['초안 확인 실패',{boardDraftRead:async()=>{throw new Error('x');}}]
  ];
  for(const [why,patch] of cases){
    const w=fakeBoard({ls:LOGGED,owner:ACC,slot});G.mount(w,{lex});
    Object.assign(w,{_boardPrivateOwner:{...ACC},_boardPrivateLoaded:true,_boardPrivateBase:{raw:null,cupd:null}},patch);
    await w.restoreLiveBoard();
    assert.equal(w.__psBoardGuest.adopted(),false,why);
    assert.equal(w.calls.filter(c=>c[0]==='apply').length,0,why);
    assert.equal(w.store.get(G.KEY),slot,why+' — 기기 칸은 그대로');
  }
  const w=fakeBoard({ls:LOGGED,owner:ACC,slot:G.encode(JSON.stringify({snap:{players:[],equipment:[],drawings:[]}}),1)});G.mount(w,{lex});
  Object.assign(w,{_boardPrivateOwner:{...ACC},_boardPrivateLoaded:true,_boardPrivateBase:{raw:null,cupd:null}});
  await w.restoreLiveBoard();
  assert.equal(w.__psBoardGuest.adopted(),false,'빈 게스트 보드는 열지 않는다');
});

test('여는 사이 계정이 바뀌면(다른 계정 · 새 불러오기) 열지 않는다',async()=>{
  const slot=G.encode(JSON.stringify({snap:{players:[{num:'4'}],equipment:[],drawings:[]}}),1);
  const w=fakeBoard({ls:LOGGED,owner:ACC,slot});G.mount(w,{lex});
  Object.assign(w,{_boardPrivateOwner:{...ACC},_boardPrivateLoaded:true,_boardPrivateBase:{raw:null,cupd:null}});
  let release;const get=w.storage.get;w.storage.get=k=>new Promise(r=>{release=()=>r(get(k));});
  const p=w.restoreLiveBoard();await tick();
  w._boardPrivateOwner={uid:'u2',wid:'p2'};w.setOwner({uid:'u2',wid:'p2'});
  release();await p;
  assert.equal(w.__psBoardGuest.adopted(),false);
  assert.equal(w.calls.filter(c=>c[0]==='apply').length,0);
});

test('작전판이 모양을 바꿔 감쌀 함수가 없으면 감싸지 않는다 · 커뮤니티 곁 보드는 감싸지 않는다',()=>{
  const w=fakeBoard();delete w.boardLiveCapture;
  assert.equal(G.mount(w,{lex}),null);
  const c=fakeBoard();c.location.search='?community_view=1';
  const before=c.boardSaveExplicit;
  assert.equal(G.mount(c,{lex}),null);assert.equal(c.boardSaveExplicit,before);
});

test('연결: board.html 이 본문 앞에서 모듈을 읽고, 부팅 복원 바로 앞에서 감싼다 · sw CORE · 키 표',()=>{
  const tag=board.indexOf('<script src="board-guest.js"></script>'),body=board.indexOf('function restoreLiveBoard(');
  assert.ok(tag>0&&tag<body,'모듈은 본문 스크립트보다 먼저');
  const mount=board.indexOf('try{PSBoardGuest.mount(window)}catch(_){}'),boot=board.indexOf('Promise.resolve(restoreLiveBoard())');
  assert.ok(mount>body&&boot>mount&&boot-mount<60,'부팅 복원 바로 앞');
  assert.match(sw,/'\/studio\/board-guest\.js'/);
  const row=keys.info(G.KEY);
  assert.ok(row,'키 표에 있다');
  assert.equal(row.sync,'device','서버로 가지 않는 기기 전용 칸');
});
