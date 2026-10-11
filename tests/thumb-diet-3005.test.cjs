const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.005 — 옛 자료의 장면별 썸네일 정리.
   작전판은 2.559 부터 저장할 때 장면 0 의 썸네일만 남긴다. 그 전에 저장되고 다시 저장되지 않은 자료에는 장면마다 썸네일이 그대로 있어,
   보관함 전체(실측 428.5MB)의 44%(189.6MB · 304개 자료)를 차지했다 — 보관함은 목록 한 덩어리라 저장 한 번에 이 글자들을 전부 읽고 다시 쓴다.
   동기화가 이 기기의 사본에서만 같은 규칙으로 뗀다. 서버로 올리지 않고(고친 적 없는 자료는 기준 지문만 옮긴다) 수정 시각도 그대로다. */
const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut(sync,'/* ── 3.005 · 썸네일 정리 순수 구간 시작','/* ── 3.005 · 썸네일 정리 순수 구간 끝 ── */');
const HASH=cut(sync,'function hash(s){','\n')+'\n'+cut(sync,'function libShareCopy(it){','\nfunction libHash(it)')+'\nfunction libHash(it){return hash(JSON.stringify(libShareCopy(it)));}';
function pure(){ const c=vm.createContext({}); vm.runInContext(HASH+'\n'+PURE+';this.api={LIB_DIET,libDietHas,libDietItem,libHash};',c); return c.api; }
const snap=k=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',x:400+k,y:300}],equipment:[],drawings:[]});
const frames=n=>Array.from({length:n},(_,k)=>({snap:snap(k),hold:.6,dur:1,cap:'장면 '+k,thumb:'<svg data-k="'+k+'"></svg>'}));

test('only the scene pictures after the first are dropped — the same rule the board applies when it saves',()=>{
  const g=pure();
  const it={libId:'L1',type:'board',name:'옛 자료',savedAt:1000,editedAt:2000,thumb:'<svg data-k="card"></svg>',snap:snap(0),frames:frames(4),
    pages:[{snap:snap(0),thumb:'<svg data-k="page"></svg>'}],trainings:[{name:'훈련',snap:snap(0),thumb:'<svg data-k="tr"></svg>',frames:frames(3)}]};
  const before=plain(it);
  assert.equal(g.libDietHas(it),true);
  assert.equal(g.libDietItem(it),3,'장면 1·2·3');
  const want=plain(before); want.frames.forEach((f,k)=>{ if(k)delete f.thumb; });
  assert.deepEqual(plain(it),want,'장면 0 · 카드 · 페이지 · 훈련의 그림과 판 · 시각은 그대로');
  assert.equal(g.libDietHas(it),false);
  assert.equal(g.libDietItem(it),0,'두 번째는 할 일이 없다');
  assert.match(board,/for\(var _k=1;_k<arr\.length;_k\+\+\)\{ if\(arr\[_k\]\)delete arr\[_k\]\.thumb; \}/,'작전판이 저장할 때 하는 일과 같은 규칙');
});

test('items that are already light, and odd shapes, are left exactly as they are',()=>{
  const g=pure();
  const light={libId:'L2',frames:[{snap:snap(0),thumb:'<svg/>'},{snap:snap(1)},{snap:snap(2),thumb:''}]};
  for(const it of [light,{libId:'L3'},{libId:'L4',frames:[]},{libId:'L5',frames:[{thumb:'<svg/>'}]},{libId:'L6',frames:'x'},{libId:'L7',frames:{1:{thumb:'<svg/>'}}},
    {libId:'L8',frames:[null,null,'x',7,[{thumb:'<svg/>'}],{thumb:7},{thumb:null},{thumb:{a:1}}]},null,undefined,'x',7]){
    const before=it&&typeof it==='object'?plain(it):it;
    assert.equal(g.libDietHas(it),false,JSON.stringify(before));
    assert.equal(g.libDietItem(it),0);
    if(it&&typeof it==='object')assert.deepEqual(plain(it),before);
  }
});

test('the scene pictures are part of what sync compares — so the baseline has to move with them, or every old item would be re-sent as an edit',()=>{
  const g=pure();
  const it={libId:'L1',type:'board',name:'옛 자료',savedAt:1000,thumb:'<svg data-k="card"></svg>',snap:snap(0),frames:frames(3)};
  const fat=g.libHash(it); g.libDietItem(it); const slim=g.libHash(it);
  assert.notEqual(fat,slim,'장면별 썸네일은 지문에 들어 있다');
  const card=plain(it); card.thumb='<svg data-k="other"></svg>';
  assert.equal(g.libHash(card),slim,'카드 그림은 지문 밖(v271) — 그래서 손대지 않는다');
});

test('sync slims this device only: before judging, on what it pulls, and once per space even when nothing else changed',()=>{
  const fn=cut(sync,'function _syncLibrary(at,m,now,wid,lib,ownerGuard,libExpectedRaw,libExpectedRev){','\nfunction ');
  const pre=cut(fn,'/* 3.005 — 옛 자료의 장면별 썸네일 정리','function queueLibPush(row,isInsert){');
  assert.match(pre,/var it=locMap\[id\]; if\(!libDietHas\(it\)\)return;\n      var rec0=m\.li\[id\], h0=rec0\?libHash\(it\):null;\n      if\(!libDietItem\(it\)\)return;\n      mutated=true;\n      if\(rec0&&rec0\.h===h0\)rec0\.h=libHash\(it\);/,
    '고친 적 없는 자료는 기준 지문만 옮긴다 — 고친 자료(지문이 이미 다름)는 그대로 두어 예전처럼 올라간다');
  assert.equal(/editedAt|savedAt|queueLibPush\(/.test(pre),false,'정리는 시각을 건드리지 않고 올리지도 않는다');
  assert.ok(fn.indexOf('/* 3.005 — 옛 자료의 장면별 썸네일 정리')<fn.indexOf('/* 로컬 항목 판정 */'),'판정보다 먼저');
  assert.match(fn,/libDietItem\(it\);[^\n]*\n            if\(!locMap\[r0\.lib_id\]\)order\.push\(r0\.lib_id\);\n            locMap\[r0\.lib_id\]=it;\n            m\.li\[r0\.lib_id\]=\{h:libHash\(it\),s:r0\.saved_at\|\|0\};/,'받은 자료는 적용 전에 — 지문은 정리한 모습으로');
  assert.match(fn,/if\(applied>0\|\|mutated\)\{\n        var out=/,'바뀐 것이 있을 때만, 비교 저장(libSave)으로 쓴다');
  const stage=cut(sync,'function syncLibrary(at,m,now,wid,ownerGuard){','\nfunction _syncLibrary(');
  assert.match(stage,/ls\.sig===sig&&ls\.rev===rev&&ls\.tomb===tombN&&m\.ld===LIB_DIET\) return \{applied:0,pushed:0,ackHash:hash\(revRaw\),libSkipped:true\};/,'정리를 아직 안 한 공간은 한 번 다 본다');
  assert.match(stage,/m\.ld=LIB_DIET;/);
  assert.equal(pure().LIB_DIET,1);
});
