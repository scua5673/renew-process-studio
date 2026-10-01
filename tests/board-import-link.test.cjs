'use strict';
/* 2.927 — «보드 가져오기»로 불러온 보관함 자료와 연결 → «보드 저장» 때 그 자료도 같은 내용으로 저장
   (사용자 «보드 가져오기 했을 때 토큰들 움직이고 저장 누르면 보관함에 있는 것도 똑같이 저장되게»). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function fnAt(start){ const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1); }
const J=x=>JSON.parse(JSON.stringify(x));
function writeBack({links,lib,editable=true,live,anim}){
  const cleared=[];let writes=0,store=J(lib);
  const ctx=vm.createContext({JSON,Date,
    window:{__psPages:{linkAll:()=>links,linkClear:id=>cleared.push(id),refresh(){}},__animFrames:()=>anim?anim.frames:null,__animGet:()=>anim||null},
    libGet:async()=>J(store),libWrite:async l=>{writes++;store=J(l);},libTouch(){},renderDrillFiles(){},canEditItem:()=>editable,
    captureSnap:()=>J(live),boardThumbSVG:()=>'<svg data-live/>'});
  vm.runInContext([fnAt('function _boardSnapEmpty(sn)'),fnAt('function _animToFrames(a)'),fnAt('async function boardLinkWriteBack(onlyCurrent)'),fnAt('function boardLinkSaveText(r)')].join('\n')+';this.wb=boardLinkWriteBack;this.txt=boardLinkSaveText;',ctx);
  return {ctx,cleared,get writes(){return writes;},get store(){return store;}};
}
const snap=(x,n=1)=>({players:Array.from({length:n},(_,k)=>({id:k+1,x:x+k,y:10})),equipment:[],drawings:[]});
test('지금 페이지에 연결된 자료 — 움직인 보드가 그대로 저장된다(장면 포함)',async()=>{
  const t=writeBack({links:[{tag:{libId:'A',name:'압박'},isCurrent:true}],lib:[{libId:'A',name:'압박',snap:snap(10),thumb:'old',savedAt:1}],live:snap(99),anim:{frames:[{snap:snap(1)},{snap:snap(2)}]}});
  const r=await t.ctx.wb(false);
  assert.equal(r[0].ok,true);assert.equal(t.writes,1);
  const a=t.store[0];assert.equal(a.snap.players[0].x,99);assert.equal(a.thumb,'<svg data-live/>');assert.equal(a.frames.length,2);assert.ok(a.savedAt>1);
  assert.equal(t.ctx.txt(r),' · 보관함 ‘압박’에도 저장됨');
});
test('여러 페이지 자료는 가져온 페이지만 바꾸고 나머지는 그대로',async()=>{
  const item={libId:'B',name:'세트',snap:snap(1),thumb:'t0',frames:[{a:1},{a:2}],pages:[{snap:snap(1),name:'p1'},{snap:snap(5),name:'p2'},{snap:snap(6),name:'p3'}]};
  const t=writeBack({links:[{tag:{libId:'B',name:'세트',srcPage:0,multi:true},isCurrent:true}],lib:[item],live:snap(42),anim:null});
  await t.ctx.wb(false);
  const b=t.store[0];assert.equal(b.pages.length,3);assert.equal(b.pages[0].snap.players[0].x,42);assert.equal(b.pages[1].snap.players[0].x,5);assert.equal(b.pages[2].snap.players[0].x,6);
  assert.equal(b.snap.players[0].x,42,'대표 그림도 1페이지');assert.equal(b.frames,undefined,'장면이 없어졌으면 지운다');
});
test('보드가 비었으면 쓰지 않고 연결만 끊는다 — 비우고 새로 그린 판이 옛 전술을 덮지 않게',async()=>{
  const t=writeBack({links:[{tag:{libId:'A',name:'압박'},isCurrent:true}],lib:[{libId:'A',name:'압박',snap:snap(10)}],live:{players:[],equipment:[],drawings:[],ball:{x:1,y:1}}});
  const r=await t.ctx.wb(false);
  assert.equal(t.writes,0);assert.deepEqual(t.cleared,['A']);assert.equal(r[0].empty,true);
  assert.match(t.ctx.txt(r),/보드가 비어 있어 보관함 ‘압박’ 연결을 끊었어요\(자료는 그대로\)/);
});
test('남이 만든 자료·지워진 자료는 쓰지 않는다',async()=>{
  let t=writeBack({links:[{tag:{libId:'A',name:'남의 것'},isCurrent:true}],lib:[{libId:'A',name:'남의 것',snap:snap(1)}],editable:false,live:snap(9)});
  let r=await t.ctx.wb(false);assert.equal(t.writes,0);assert.equal(r[0].denied,true);assert.deepEqual(t.cleared,['A']);
  t=writeBack({links:[{tag:{libId:'Z',name:'지운 것'},isCurrent:true}],lib:[],live:snap(9)});
  r=await t.ctx.wb(false);assert.equal(t.writes,0);assert.equal(r[0].gone,true);
});
test('다른 페이지에 연결돼 있으면 그 페이지에 저장된 내용으로 — «보관함 저장» 덮어쓰기는 지금 페이지만',async()=>{
  const links=[{tag:{libId:'A',name:'A'},isCurrent:false,snap:snap(7),thumb:'p2',anim:{frames:[{snap:snap(1),thumb:'x'},{snap:snap(2),thumb:'y'}],title:'t',hold:.8}}];
  let t=writeBack({links,lib:[{libId:'A',name:'A',snap:snap(1)}],live:snap(99)});
  await t.ctx.wb(false);
  const a=t.store[0];assert.equal(a.snap.players[0].x,7);assert.equal(a.thumb,'p2');assert.equal(a.frames[1].thumb,undefined,'장면 0 말고는 썸네일을 싣지 않는다(2.559)');assert.equal(a.frames[0].__hold,.8);
  t=writeBack({links,lib:[{libId:'A',name:'A',snap:snap(1)}],live:snap(99)});
  const r=await t.ctx.wb(true);assert.equal(r.length,0);assert.equal(t.writes,0);
});
test('페이지 연결 — 페이지 객체에 붙고, 한 페이지 보드는 따로, 첫 페이지로 옮겨 간다',()=>{
  const decl=src.slice(src.indexOf('  var _singleLink=null;'),src.indexOf('  function _linkClear(libId){'))+fnAt('function _linkClear(libId)');
  const ctx=vm.createContext({});
  vm.runInContext('var pages=null,idx=0,_inVault=false;'+decl+';this.api={tag:_linkTag,all:_linkAll,clear:_linkClear,set p(v){pages=v;},set i(v){idx=v;},set v(x){_inVault=x;},get single(){return _singleLink;}};',ctx);
  const api=ctx.api;
  api.tag({libId:'A',name:'A'});assert.equal(api.single.libId,'A');assert.equal(api.all()[0].isCurrent,true);
  api.v=true;assert.equal(api.all().length,0,'보관함 열람 중에는 연결 없음');api.v=false;
  api.clear('A');assert.equal(api.single,null);
  const ps=[{snap:{}},{snap:{}}];api.p=ps;api.i=1;api.tag({libId:'B',name:'B'});
  assert.equal(ps[1].vlink.libId,'B');api.i=0;api.tag({libId:'B',name:'B'});assert.equal(ps[1].vlink,undefined,'같은 자료는 한 페이지에만');assert.equal(ps[0].vlink.libId,'B');
  const all=api.all();assert.equal(all.length,1);assert.equal(all[0].page,0);
  assert.match(src,/if\(_singleLink\)\{ pages\[0\]\.vlink=_singleLink; _singleLink=null; \} idx=0;/,'여러 페이지가 되면 연결은 첫 페이지로');
});
test('연결 지점 — 가져오기·⌘Z·보관함 저장 시트·새로고침·보관함 저장본',()=>{
  assert.match(src,/var _canLink=false; try\{ _canLink=!!\(d\.libId&&canEditItem\(d\)\); \}catch\(_\)\{\}/,'남이 만든 자료는 잇지 않는다');
  assert.match(src,/undoStack\[undoStack\.length-1\]\.__linkMark=d\.libId/);
  assert.match(src,/if\(_ue&&_ue\.__linkMark&&window\.__psPages&&window\.__psPages\.linkClear\)\{ window\.__psPages\.linkClear\(_ue\.__linkMark\);/,'⌘Z 로 가져오기를 되돌리면 연결도 끊긴다');
  assert.match(src,/var _wb=\[\]; try\{ _wb=await boardLinkWriteBack\(false\); \}/,'«보드 저장» 이 연결된 자료에도');
  assert.match(src,/if\(res\.overwrite\)\{ boardLinkWriteBack\(true\)/,'«보관함 저장» 덮어쓰기는 가져온 페이지만');
  assert.match(src,/try\{ window\.__psPages\.linkClear\(_lk\.tag\.libId\); \}catch\(_\)\{\}\n        window\.__vaultPending=/,'새 항목으로 저장하면 옛 연결은 끊는다');
  assert.match(src,/boardLink:\(window\.__psPages&&window\.__psPages\.singleLinkVal\?window\.__psPages\.singleLinkVal\(\):null\)/);
  assert.match(src,/window\.__psPages\.setSingleLink\(live\.boardLink\|\|null\)/);
  assert.match(src,/var _fp=_clone\(pages\); _fp\.forEach\(function\(p\)\{ if\(p\)delete p\.vlink; \}\);/,'보관함 저장본엔 연결을 싣지 않는다');
  const dup=src.slice(src.indexOf('var src=pages[i]; if(!src)return; pages.splice('),src.indexOf('var src=pages[i]; if(!src)return; pages.splice(')+260);
  assert.doesNotMatch(dup,/vlink/,'페이지 복제는 연결을 따라가지 않는다');
});
