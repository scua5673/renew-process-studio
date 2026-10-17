// 3.087 — 커뮤니티 글 보기(사용자 «커뮤니티에 있는 것들 볼 때 도크가 필요 없는데 떠 있고 · 원하는 형태로 볼 수 있게 ·
// 3d나 평면이나 사람모향이나 원형이나 이런 것들 선택할수 있게»). 화면에서 고르는 것은 tests/browser/community-view-look.mjs 가 본다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const CL=require('../studio/board-comm-look.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const board=read('studio/board.html');
const mem=init=>{const m=new Map(Object.entries(init||{}));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),m};};
const DESK={phone:false,touch:false},IPAD={phone:false,touch:true},PHONE={phone:true,touch:true};

test('기기에 남긴 보기 — 모르는 값은 «올린 그대로» · «정하지 않음»',()=>{
  assert.deepEqual(CL.read(mem()),{shape:'',tilt:''});
  assert.deepEqual(CL.read(mem({ps_comm_look_v1:'{bad'})),{shape:'',tilt:''});
  assert.deepEqual(CL.read(mem({ps_comm_look_v1:JSON.stringify({shape:'star',tilt:'4d'})})),{shape:'',tilt:''});
  const ls=mem();CL.write(ls,{shape:'person',tilt:'3d'});
  assert.deepEqual(CL.read(ls),{shape:'person',tilt:'3d'});
  assert.equal(CL.KEY,'ps_comm_look_v1');
  assert.match(read('studio/storage-keys.js'),/\['ps_comm_look_v1','device','ls','pref','board-comm-look\.js'\]/,'키 표에 있다');
});

test('기기 — 폰은 3D · «사람»이 없고, 터치 기기는 3D 를 남기지 않는다',()=>{
  const win=(dev,extra={})=>({top:{document:{documentElement:{getAttribute:()=>dev}}},navigator:{maxTouchPoints:0},...extra});
  assert.deepEqual(CL.device(win('phone')),PHONE);
  assert.deepEqual(CL.device(win('ipad')),IPAD);
  assert.deepEqual(CL.device(win('desktop')),DESK);
  assert.deepEqual(CL.device(win(null,{navigator:{maxTouchPoints:5}})),IPAD,'셸 표시가 없으면 터치로 짐작');
  assert.deepEqual(CL.device(win('desktop',{psBoardDevice:()=>'phone'})),{phone:true,touch:true},'좁은 판(보드가 폰이라고 본다)은 폰처럼');
  const tilt={__setTilt(){},PSBoardDepth:{}};
  assert.equal(CL.can3d(PHONE,tilt),false);assert.equal(CL.can3d(DESK,tilt),true);assert.equal(CL.can3d(DESK,{}),false,'3D 를 그릴 수 없는 판');
  assert.deepEqual(CL.shapesFor(DESK),['circle','shirt','person','shaper']);
  assert.deepEqual(CL.shapesFor(PHONE),['circle','shirt','shaper'],'폰은 평면뿐 — 사람은 유니폼과 같은 그림');
  assert.equal(CL.shown('person',PHONE),'shirt');assert.equal(CL.shown('person',DESK),'person');assert.equal(CL.shown('',DESK),'');
});

test('고르기 — 화면 · 모양 · 기기에 남길 것',()=>{
  const flat={is3d:false,pref:{shape:'',tilt:''}};
  assert.deepEqual(CL.choose(flat,{tilt:'3d'},DESK,true),{on:true,shape:null,pref:{shape:'',tilt:'3d'}});
  assert.deepEqual(CL.choose(flat,{tilt:'3d'},IPAD,true),{on:true,shape:null,pref:{shape:'',tilt:''}},'아이패드 3D 는 이 글에서만');
  assert.deepEqual(CL.choose(flat,{tilt:'3d'},PHONE,false),{on:null,shape:null,pref:{shape:'',tilt:''}},'폰은 3D 없음');
  assert.deepEqual(CL.choose({is3d:true,pref:{shape:'shirt',tilt:'3d'}},{tilt:'flat'},DESK,true),{on:false,shape:null,pref:{shape:'shirt',tilt:'flat'}});
  // 사람은 3D 에서 선다 — 평면에서 고르면 3D 도
  assert.deepEqual(CL.choose(flat,{shape:'person'},DESK,true),{on:true,shape:'person',pref:{shape:'person',tilt:'3d'}});
  assert.deepEqual(CL.choose(flat,{shape:'person'},IPAD,true),{on:true,shape:'person',pref:{shape:'person',tilt:''}});
  assert.deepEqual(CL.choose({is3d:true,pref:{shape:'',tilt:'3d'}},{shape:'person'},DESK,true),{on:null,shape:'person',pref:{shape:'person',tilt:'3d'}},'이미 3D');
  assert.deepEqual(CL.choose(flat,{shape:'circle'},DESK,true),{on:null,shape:'circle',pref:{shape:'circle',tilt:''}});
  assert.deepEqual(CL.choose({is3d:false,pref:{shape:'circle',tilt:''}},{shape:''},DESK,true),{on:null,shape:'',pref:{shape:'',tilt:''}},'올린 그대로');
  assert.deepEqual(CL.choose(flat,{shape:'star'},DESK,true).shape,'','모르는 모양은 올린 그대로');
});

test('단추 글 · 안내',()=>{
  assert.equal(CL.summary(DESK,true,true,'person'),'3D · 사람');
  assert.equal(CL.summary(DESK,true,false,''),'평면 · 올린 그대로');
  assert.equal(CL.summary(PHONE,false,false,'person'),'유니폼','폰은 모양만');
  assert.match(CL.hint(DESK,false,'person'),/^사람은 3D 에서 서 있는 선수로 보여요/);
  assert.doesNotMatch(CL.hint(DESK,true,'person'),/평면에서는 유니폼/);
  assert.match(CL.hint(DESK,true,'circle'),/다음 글에도 그대로 열려요\. 글은 바뀌지 않아요\.$/);
  assert.match(CL.hint(IPAD,false,'circle'),/3D 는 글마다 켜요/);
  assert.doesNotMatch(CL.hint(PHONE,false,'circle'),/3D/);
});

test('글을 싣기 전 — 고른 모양을 loadSnap 이 장면마다 지킨다',()=>{
  const win=(dev,v)=>({top:{document:{documentElement:{getAttribute:()=>dev}}},navigator:{},localStorage:mem(v?{ps_comm_look_v1:JSON.stringify(v)}:{})});
  let w=win('desktop',{shape:'shaper',tilt:''});w.__commPostShape='shirt';CL.prime(w);assert.equal(w.__commWantShape,'shaper');
  assert.equal(w.__commPostShape,null,'올린 사람의 모양은 이 글의 첫 스냅이 다시 적는다(앞 글 · 되살린 화면 것이 아니다)');
  w=win('desktop');CL.prime(w);assert.equal(w.__commWantShape,null,'고른 적 없으면 올린 그대로');
  w=win('phone',{shape:'person',tilt:'3d'});CL.prime(w);assert.equal(w.__commWantShape,'shirt','폰의 사람은 유니폼');
  // 보드: 스냅마다(재생은 장면마다 loadSnap) 올린 사람의 모양을 적어 두고, 고른 모양으로 바꾼다
  assert.match(board,/lookApply\(opts\.keepLook\?lookNow\(\):lookOf\(s\)\);\}catch\(_\)\{\}[^\n]*\n  try\{if\(document\.body\.classList\.contains\("comm-viewing"\)\)\{if\(!opts\.keepLook&&window\.__commPostShape==null\)window\.__commPostShape=tokShape;if\(window\.__commWantShape\)tokShape=window\.__commWantShape;\}\}catch\(_\)\{\}/);
  const v=board.indexOf('window.__commView=function('),prime=board.indexOf('try{PSCommLook.prime(window);}catch(_){}',v),load=board.indexOf('loadEditorTrainings(d);',v),mount=board.indexOf('try{PSCommLook.mount(window);}catch(_){}',v);
  assert.ok(v>0&&prime>v&&prime<load&&mount>load,'prime → 글 싣기 → mount');
});

test('닫으면 걷는다 — 되살리는 보드에 뷰어의 모양이 묻지 않는다',()=>{
  assert.match(board,/function __commTiltOff\(\)\{ try\{ window\.__commWantOrient=null; window\.__commWantShape=null; var b=document\.getElementById\("commLook"\); if\(b\)b\.remove\(\);/);
  assert.match(board,/window\.__commWantShape=null;if\(editorStash\)loadSnap\(editorStash\);/,'편집기를 닫으며 되살리는 loadSnap 보다 먼저(그때는 아직 comm-viewing)');
  assert.doesNotMatch(board,/commTiltBtn/,'옛 3D 단추는 없다');
  assert.match(board,/<script src="board-tweaks\.js"><\/script><script src="board-comm-look\.js"><\/script>/);
  assert.match(read('sw.js'),/'\/studio\/board-comm-look\.js'/,'오프라인');
});

test('커뮤니티 보기에서는 떠 있는 도크 · 칸 · 훈련 탭을 감춘다',()=>{
  const df=read('studio/board-dock-float.js');
  // 도크 규칙(P: id 열셋)보다 센 감춤 — :not(#dfc0)…(#dfc19) 스물
  const m=df.match(/B = 'html body\.ps-dock-float\.comm-viewing ';\s*return \[B \+ '#ps-command-dock' \+ X, B \+ '#ps-df-tray' \+ X, B \+ '#ps-df-opts' \+ X\]\.join\(','\) \+ '\{display:none!important\}'/);
  assert.ok(m,'comm-viewing 감춤');
  assert.match(df,/\[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19\]\.map\(function \(i\) \{ return ':not\(#dfc' \+ i \+ '\)'; \}\)/);
  const cf=require('../studio/board-create-frame.js').css();
  assert.ok(cf.includes('html.ps-page-board body.editing.comm-viewing'+':not(#cf0)'),'훈련 탭 감춤');
  assert.match(cf,/body\.editing\.comm-viewing(?::not\(#cf\d+\)){40} #editorModal #trainingStrip\{display:none!important\}/,'만들기 틀의 훈련 탭(id 스물)보다 세다');
});
