const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.114 — 보관함 «＋ 만들기 › 파일에서 가져오기»(studio/board-vault-import.js).
   내보낸 드릴 팩 파일을 다시 넣는 길. 파일은 누구나 고쳐 보낼 수 있으니 넣기 전에 거른다:
   그림(thumb)은 어디서든 버리고(보관함이 장면에서 다시 그린다) · 사진은 data:image 만 · 남의 도장 · 표식 · 번호는 지운다.
   창에 줄이 붙고 파일을 고르면 보관함에 들어가는 것은 tests/browser/vault-file-import.mjs. */
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const VI=require('../studio/board-vault-import.js');

const PNG='data:image/png;base64,iVBORw0KGgo=';
const snap=()=>({pitchSpec:'grid30',players:[{id:101,team:'blue',num:'6',x:300,y:300,img:'https://outside.invalid/p.png',imgBg:PNG},{id:102,team:'red',num:'',x:400,y:300,img:PNG}],
  equipment:[{id:900,team:'cone',x:200,y:200,src:'javascript:alert(1)'},{id:901,team:'cone',x:210,y:200,src:PNG}],drawings:[],ball:{x:310,y:300},pitchImg:'https://outside.invalid/pitch.jpg'});
const pack=()=>({type:'process-studio-drillpack',version:1,date:'2026-10-19T00:00:00.000Z',drills:[
  {name:'가상 세션',type:'train',folder:'가상 폴더',libId:'Lold',id:7,tpl:1,fav:true,pin:true,ex:'train',savedAt:1,editedAt:2,createdBy:'someone-else',createdByEmail:'x@invalid',createdByName:'남',matchRef:{mid:'m1'},
    _teamOwner:'someone-else',_teamSource:'team',thumb:'<svg onload="alert(1)"></svg>',snap:snap(),frames:[{snap:snap(),thumb:'<svg/>',cap:'자막'}],
    trainings:[{type:'train',name:'훈련 1',method:'방법',coaching:'코칭',thumb:'<svg onload=1>',snap:snap(),frames:[{snap:snap(),hold:.6,dur:1.2,cap:'하나'},{snap:snap(),cap:'둘',_teamX:1}]}]},
  {name:'두 번째',type:'board',folder:'가상 폴더',pages:[{snap:snap(),thumb:'<svg onload=2>'}]},
  null,'문자열',[1,2]
]});

test('cleanPack keeps the work (names, folders, trainings, scenes, captions) and makes it a new item of the person importing',()=>{
  const c=VI.cleanPack(pack());
  assert.equal(c.type,'process-studio-drillpack');
  assert.deepEqual(c.drills.map(d=>[d.name,d.type,d.folder]),[['가상 세션','train','가상 폴더'],['두 번째','board','가상 폴더']],'카드가 아닌 것(null · 글 · 배열)은 빠진다');
  const d=c.drills[0];
  assert.deepEqual([d.trainings.length,d.trainings[0].frames.length,d.trainings[0].frames[1].cap,d.trainings[0].method,d.trainings[0].coaching],[1,2,'둘','방법','코칭']);
  for(const k of ['libId','id','tpl','fav','pin','ex','savedAt','editedAt','createdBy','createdByEmail','createdByName','matchRef','_teamOwner','_teamSource'])assert.equal(k in d,false,'«'+k+'» 는 지운다');
  assert.equal(d.snap.players[0].id,101,'선수 번호(id)는 장면 안이라 그대로');
});

test('cleanPack drops every picture string and outside address — the vault draws card pictures from the scenes itself',()=>{
  const c=VI.cleanPack(pack()),json=JSON.stringify(c);
  for(const bad of ['"thumb"','onload','outside.invalid','javascript:','_teamX','someone-else'])assert.equal(json.includes(bad),false,'«'+bad+'» 가 남지 않는다');
  const p=c.drills[0].trainings[0].frames[0].snap;
  assert.equal('img' in p.players[0],false,'바깥 사진 주소는 지운다');
  assert.equal(p.players[0].imgBg,PNG,'data:image 사진은 그대로');
  assert.equal(p.players[1].img,PNG);
  assert.deepEqual(p.equipment.map(q=>q.src),[null,PNG]);
  assert.equal(p.pitchImg,null);
  const svg=VI.cleanPack({type:'process-studio-drillpack',drills:[{name:'a',snap:{players:[{id:1,x:1,y:1,img:'data:image/svg+xml;base64,PHN2Zz4='}]}}]});
  assert.equal('img' in svg.drills[0].snap.players[0],false,'SVG data 주소는 그림이 아니라 문서라 받지 않는다');
});

test('cleanPack refuses things that are not a drill pack, and quick-view keys never become folders',()=>{
  for(const bad of [null,'x',{},{type:'other',drills:[]},{type:'process-studio-drillpack'},{type:'process-studio-drillpack',drills:[]},{type:'process-studio-drillpack',drills:[null,1]}])
    assert.equal(VI.cleanPack(bad),null,JSON.stringify(bad));
  const c=VI.cleanPack({type:'process-studio-drillpack',drills:[{name:'a',folder:'__mine'},{name:'b',folder:5},{name:'c'}]});
  assert.deepEqual(c.drills.map(d=>d.folder),['','','']);
  assert.deepEqual(VI.foldersOf(VI.cleanPack(pack())),['가상 폴더']);
  assert.deepEqual(VI.foldersOf(c),['']);
  const orig=pack();VI.cleanPack(orig);assert.equal(orig.drills[0].thumb,'<svg onload="alert(1)"></svg>','받은 파일 객체는 고치지 않는다(사본을 거른다)');
});

test('the board loads the module (one script line — board.html budget), the app caches it, and it watches only the chooser being added',()=>{
  const board=read('studio/board.html'),sw=read('sw.js'),src=read('studio/board-vault-import.js');
  assert.equal(board.split('<script src="board-vault-import.js"></script>').length,2,'board.html 에 한 번');
  assert.match(sw,/'\/studio\/board-vault-import\.js'/,'sw.js CORE');
  assert.match(src,/mo\.observe\(doc\.body, \{childList: true\}\)/,'body 의 자식만 본다(subtree 없이 — 줄을 붙여도 감시가 다시 돌지 않는다)');
  assert.match(src,/ps-viewonly/,'보기 전용이면 줄을 두지 않는다');
  assert.match(src,/importDrillPack/,'넣기는 보관함의 함수(중복 건너뛰기 · 장면 검사 · libTurn)를 그대로 쓴다');
});
