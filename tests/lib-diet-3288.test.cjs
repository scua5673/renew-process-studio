'use strict';
/* 3.288 — 장면별 썸네일 저장 다이어트(제보 de2e508c «오류가 점점 더 빈번 · 저장된 파일이 너무 많아서일까요?»).
   실측: 그 사용자의 보관함 135MB 중 103MB 가 pages[].anim.frames[1…].thumb. 맨 위 frames 는 2.559 · 3.005 가 이미 정리했다 —
   여러 페이지 작전판의 페이지 장면이 빠져 있었다. 규칙은 studio/lib-diet.js 한 곳: 동기화(이 기기 사본) · 작전판(저장으로 나가는 사본). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');
const D=require('../studio/lib-diet.js');
const plain=o=>JSON.parse(JSON.stringify(o));
const snap=k=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',x:400+k,y:300}],equipment:[],drawings:[]});
const frames=(n,tag)=>Array.from({length:n},(_,k)=>({snap:snap(k),hold:.6,dur:1,cap:'장면 '+k,thumb:'<svg data-k="'+(tag||'f')+k+'"></svg>'}));
const page=(name,n)=>({name,snap:snap(0),thumb:'<svg data-k="page-'+name+'"></svg>',anim:{frames:frames(n,name),active:0,hold:.6,title:'',titleColor:''}});
const board=()=>({libId:'B1',type:'board',name:'여러 페이지',savedAt:1000,editedAt:2000,thumb:'<svg data-k="card"></svg>',snap:snap(0),frames:frames(3),
  pages:[page('p1',4),page('p2',3),{name:'p3',snap:snap(0),thumb:'<svg data-k="page-p3"></svg>',anim:null}],
  trainings:[{name:'훈련',snap:snap(0),thumb:'<svg data-k="tr"></svg>',frames:frames(3,'t')}],
  slides:[{title:'슬라이드',snap:snap(0),thumb:'<svg data-k="sl"></svg>',frames:frames(2,'s')}]});

test('페이지 장면도 장면 0 의 그림만 남긴다 — 맨 위 frames 와 같은 규칙, 판 · 자막 · 페이지 · 카드 그림은 그대로',()=>{
  const it=board(),before=plain(it);
  assert.equal(D.has(it),true);
  assert.equal(D.strip(it),2+3+2,'맨 위 장면 1·2 + p1 장면 1·2·3 + p2 장면 1·2');
  const want=plain(before);
  want.frames.forEach((f,k)=>{if(k)delete f.thumb;});
  want.pages.forEach(p=>{if(p.anim)p.anim.frames.forEach((f,k)=>{if(k)delete f.thumb;});});
  assert.deepEqual(plain(it),want);
  assert.deepEqual(it.pages.map(p=>p.thumb),before.pages.map(p=>p.thumb),'페이지 그림(탭 · 목록)은 남는다');
  assert.equal(it.pages[0].anim.frames[0].thumb,before.pages[0].anim.frames[0].thumb,'장면 0 의 그림도');
  assert.deepEqual(it.pages[0].anim.frames.map(f=>f.snap),before.pages[0].anim.frames.map(f=>f.snap),'판은 한 글자도 안 바뀐다');
  assert.deepEqual(plain(it.trainings),before.trainings,'훈련은 건드리지 않는다(3.005 와 같다)');
  assert.deepEqual(plain(it.slides),before.slides,'미팅 슬라이드도');
  assert.equal(D.has(it),false);assert.equal(D.strip(it),0,'두 번째는 할 일이 없다');
});

test('이미 가벼운 자료 · 이상한 모양은 그대로 둔다',()=>{
  for(const it of [{libId:'a'},{libId:'b',pages:[]},{libId:'c',pages:'x'},{libId:'d',pages:{0:page('p',3)}},{libId:'e',pages:[null,7,'x',[page('p',3)],{anim:null},{anim:'x'},{anim:[{thumb:'<svg/>'}]},{anim:{frames:'x'}},{anim:{frames:{1:{thumb:'<svg/>'}}}},
      {anim:{frames:[{thumb:'<svg/>'}]}},{anim:{frames:[{thumb:'<svg/>'},null,'x',7,[{thumb:'<svg/>'}],{thumb:7},{thumb:null},{thumb:''},{thumb:{a:1}}]}}]},null,undefined,'x',7,[page('p',3)]]){
    const before=it&&typeof it==='object'?plain(it):it;
    assert.equal(D.has(it),false,JSON.stringify(before));assert.equal(D.strip(it),0);
    if(it&&typeof it==='object')assert.deepEqual(plain(it),before);
  }
});

test('크기 — 장면이 많을수록 저장본이 준다(실측 모양: 장면 썸네일 45KB · 판 4.6KB)',()=>{
  const th='<svg>'+'x'.repeat(45000)+'</svg>';
  const pg=n=>({name:'p',snap:snap(0),thumb:th,anim:{frames:Array.from({length:n},(_,k)=>({snap:Object.assign(snap(k),{pad:'y'.repeat(4600)}),dur:1,thumb:th}))}});
  const it={libId:'big',pages:Array.from({length:11},()=>pg(12))};
  const fatLen=JSON.stringify(it).length;D.strip(it);const slimLen=JSON.stringify(it).length;
  assert.ok(slimLen<fatLen*0.3,'11페이지 × 12장면: '+fatLen+' → '+slimLen);
});

test('동기화 — sync.js 는 이 모듈에 맡기고, 공간마다 한 번 더 본다(LIB_DIET 2). 기준 지문은 가벼운 모습으로 옮겨진다',()=>{
  const S=R('studio/sync.js');
  assert.ok(S.includes('var LIB_DIET=2;'));
  assert.ok(S.includes('function libDietHas(it){ var D=window.PSLibDiet; return !!D&&D.has(it); }'));
  assert.ok(S.includes('function libDietItem(it){ var D=window.PSLibDiet; return D?D.strip(it):0; }'));
  /* 지문(libHash)은 페이지 장면 썸네일을 본다 — 그래서 3.005 길(고친 적 없으면 기준만 옮김 · 올리지 않음)을 그대로 탄다 */
  const cut=(from,to)=>{const a=S.indexOf(from),b=S.indexOf(to,a+from.length);assert.ok(a>0&&b>a,from);return S.slice(a,b);};
  const c=vm.createContext({});
  vm.runInContext(cut('function hash(s){','\n')+'\n'+cut('function libShareCopy(it){','\nfunction libHash(it)')+'\nthis.libHash=function(it){return hash(JSON.stringify(libShareCopy(it)));};',c);
  const it=board();D.framesStrip(it.frames);
  const fat=c.libHash(plain(it));D.strip(it);const slim=c.libHash(plain(it));
  assert.notEqual(fat,slim,'페이지 장면 썸네일은 지문에 들어 있다 → 기준을 같이 옮겨야 «고친 자료»로 다시 올라가지 않는다');
  const fn=cut('function _syncLibrary(at,m,now,wid,lib,ownerGuard,libExpectedRaw,libExpectedRev){','\nfunction ');
  assert.match(fn,/var it=locMap\[id\]; if\(!libDietHas\(it\)\)return;\n      var rec0=m\.li\[id\], h0=rec0\?libHash\(it\):null;\n      if\(!libDietItem\(it\)\)return;\n      mutated=true;\n      if\(rec0&&rec0\.h===h0\)rec0\.h=libHash\(it\);/);
});

test('작전판 — 저장으로 나가는 사본만 뗀다: 보관함(forSave) · 작업 보드 기록(liveVal). 화면의 페이지는 그대로',()=>{
  const mem=[page('p1',3),page('p2',2)];
  const P={forSave(){return plain(mem);},liveVal(){return {pages:plain(mem),idx:1};},pg(){return mem;}};
  const W={__psPages:P};
  assert.equal(D.mountBoard(W),true);assert.equal(D.mountBoard(W),false,'두 번 감싸지 않는다');
  const saved=P.forSave(),live=P.liveVal();
  for(const pages of [saved,live.pages]){
    assert.deepEqual(pages.map(p=>p.anim.frames.map(f=>!!f.thumb)),[[true,false,false],[true,false]]);
    assert.deepEqual(pages.map(p=>p.thumb),mem.map(p=>p.thumb));
    assert.deepEqual(pages.map(p=>p.anim.frames.map(f=>f.snap)),mem.map(p=>p.anim.frames.map(f=>f.snap)));
  }
  assert.equal(live.idx,1);
  assert.deepEqual(mem.map(p=>p.anim.frames.map(f=>!!f.thumb)),[[true,true,true],[true,true]],'메모리의 페이지(화면)는 안 바뀐다');
  /* 한 페이지 보드 · 보관함 편집 중 — 원래 함수가 null 을 돌려준다 */
  const Q={forSave(){return null;},liveVal(){return null;}};D.mountBoard({__psPages:Q});
  assert.equal(Q.forSave(),null);assert.equal(Q.liveVal(),null);
  assert.equal(D.mountBoard({}),false);assert.equal(D.mountBoard(null),false);
});

test('싣기 — 셸은 sync.js 앞, 작전판은 본문 앞, 오프라인 묶음에도',()=>{
  const A=R('studio/app.html'),B=R('studio/board.html');
  assert.ok(A.includes('<script src="lib-diet.js"></script><script src="sync.js'),'셸: sync.js 바로 앞');
  const i=B.indexOf('<script src="lib-diet.js"></script>');assert.ok(i>0,'작전판');
  assert.ok(i<B.indexOf('window.__psPages={pg:function(){return pages;},'),'본문보다 먼저 읽히고 DOMContentLoaded 에 감싼다');
  assert.match(R('sw.js'),/'\/studio\/lib-diet\.js'/);
  assert.ok(R('studio/board-rescue.js').includes("PSLibDiet.pagesStrip(d.boardPages.pages)"),'구조 사본 비교는 페이지 장면 썸네일을 보지 않는다');
});

test('구조 사본 — 옛 무거운 사본과 새 가벼운 화면은 «같은 작업»이다',()=>{
  const src=R('studio/board-rescue.js');
  const a=src.indexOf('function body(raw){'),b=src.indexOf('\n',a);
  const c=vm.createContext({PSLibDiet:D});vm.runInContext(src.slice(a,b)+';this.body=body;',c);
  const mk=(pages,at)=>JSON.stringify({snap:snap(0),view:'board',boardPages:{pages,idx:0},_savedAt:at});
  const fatPages=[page('p1',3),page('p2',2)],slimPages=plain(fatPages);D.pagesStrip(slimPages);
  assert.equal(c.body(mk(fatPages,1)),c.body(mk(slimPages,2)));
  const other=plain(slimPages);other[1].anim.frames[1].snap.players[0].x=999;
  assert.notEqual(c.body(mk(fatPages,1)),c.body(mk(other,2)),'판이 다르면 다른 작업');
  assert.equal(c.body('not json'),'not json');
});
