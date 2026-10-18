// 운동장 사진(제보 553c06ac «운동장 화면을 사진 이미지로 첨부» — TacticalPad 의 배경 그림). 셈은 studio/board-pitch-photo.js 를 require 로 본다.
// 판에는 '@photo:<16자>-<가로>x<세로>' 참조만, 사진은 이 기기(IndexedDB ps_pitch_photo:<id>)에 한 벌. 화면 흐름(고르기 · 화살표 · PNG · 장면 · 페이지 · 빼기 · 다시 열기)은
// tests/browser/board-pitch-photo.mjs(board2) 가 본다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const P=require('../studio/board-pitch-photo.js');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('참조 — @photo:<16자 hex>-<가로>x<세로>, 같은 사진은 같은 참조(한 벌), 다른 사진은 다른 참조',()=>{
  const a='data:image/jpeg;base64,'+'A'.repeat(300000),b=a.slice(0,-1)+'B';
  const ra=P.refOf(a,1600,900),rb=P.refOf(b,1600,900);
  assert.match(ra,/^@photo:[0-9a-f]{16}-1600x900$/);assert.ok(ra.length<=36,'판 한 칸에 '+ra.length+'자');
  assert.equal(P.refOf(a,1600,900),ra,'같은 사진은 같은 참조');assert.notEqual(ra,rb,'한 글자만 달라도 다른 참조');
  assert.equal(P.isRef(ra),true);assert.equal(P.idOf(ra),ra.slice(7,23));assert.equal(P.idOf(rb).length,16);
  assert.deepEqual(P.dimsOf(ra),{w:1600,h:900});
  assert.equal(P.isRef(P.refOf(a)),true,'크기 없는 참조도 읽는다');assert.equal(P.dimsOf(P.refOf(a)),null);
  for(const v of ['@real',null,'',a,'@photo:xyz','@photo:'+'0'.repeat(15),'x@photo:'+'0'.repeat(16),'@photo:'+'0'.repeat(16)+'-1600x','@photo:'+'0'.repeat(16)+'-0x0x']){assert.equal(P.isRef(v),false,String(v).slice(0,30));assert.equal(P.idOf(v),'');}
  assert.equal(P.REF.charAt(0),'@','옛 판(3.099 이하)은 «@» 프리셋 길에서 모르는 키라 고른 피치를 그린다');
});

test('고른 파일 — PNG · JPEG · WebP, 10MB 이하만',()=>{
  const f=(type,size,name)=>({type,size,name:name||'a'});
  assert.equal(P.check(f('image/png',1000)),'');assert.equal(P.check(f('image/jpeg',P.MAX_BYTES)),'');assert.equal(P.check(f('image/webp',5)),'');
  assert.equal(P.check(f('',5,'캡처.JPG')),'','종류가 비어도 이름이 사진이면');
  assert.equal(P.check(f('image/jpeg',P.MAX_BYTES+1)),P.T.big);
  assert.equal(P.check(f('image/gif',10)),P.T.type);assert.equal(P.check(f('application/pdf',10,'a.png')),P.T.type);assert.equal(P.check(f('',5,'a.heic')),P.T.type);
  assert.equal(P.check(null),P.T.read);
  assert.equal(P.MAX_BYTES,10*1024*1024);
});

test('줄이기 — 긴 변 1600 이하 · 비율 그대로 · 키우지 않는다',()=>{
  assert.deepEqual(P.fit(3840,2160),{w:1600,h:900});
  assert.deepEqual(P.fit(1170,2532),{w:739,h:1600});
  assert.deepEqual(P.fit(800,450),{w:800,h:450},'작은 사진은 그대로');
  assert.equal(P.EDGE,1600);assert.ok(P.QUALITY>0.7&&P.QUALITY<0.9,'JPEG 품질');
});

test('방향 — 가로 사진은 가로 판, 세로 사진은 세로 판 · 세로 판에는 돌려 담아 바로 서 보이게',()=>{
  assert.equal(P.want(1920,1080),'h');assert.equal(P.want(1080,1920),'v');assert.equal(P.want(1000,1000),'h');
  assert.equal(P.turn({orientation:'h'}),0);assert.equal(P.turn({orientation:'h',spFlip:true}),0);
  /* #world 는 세로 판에서 matrix(0 -1 1 0 0 W) — 판의 오른쪽이 화면 위다. 사진을 시계 방향 90° 돌려 담아야 화면에서 바로 선다(spFlip 은 반대) */
  assert.equal(P.turn({orientation:'v'}),90);assert.equal(P.turn({orientation:'v',spFlip:true}),-90);
});

test('운동장 틀 — 판 좌표(규격 경계 + 런오프). 11인제는 판 전체, 작은 규격은 제 틀',()=>{
  assert.deepEqual(P.frame({L:30,T:30,PW:1050,PH:680},30),[0,0,1110,740]);
  assert.deepEqual(P.frame({L:355,T:205,PW:400,PH:200},30),[325,175,460,260],'풋살');
});

test('사진 자리 — 틀을 다 덮고 제 비율 그대로 가운데(16:9 캡처는 양옆으로 조금 넘친다 · 16:9 영상에 사진 전체)',()=>{
  const f=[0,0,1110,740];
  assert.deepEqual(P.place(f,1600,900),[-102.78,0,1315.56,740],'16:9 — 높이를 맞추고 양옆으로');
  assert.deepEqual(P.place(f,1600,1200),[0,-46.25,1110,832.5],'4:3 — 폭을 맞추고 위아래로');
  assert.deepEqual(P.place(f,1500,1000),f,'틀과 같은 비율이면 틀 그대로');
  assert.deepEqual(P.place(f),f,'크기를 모르면 틀(잘라 채운다)');
  const p=P.place([325,175,460,260],900,1600);assert.ok(Math.abs(p[0]+p[2]/2-555)<0.01&&Math.abs(p[1]+p[3]/2-305)<0.01&&p[2]>=460&&p[3]>=260,'가운데 · 다 덮는다 '+p);
});

test('설정 안내 — 이 기기에만 · 다른 기기에서 넣은 사진 · 3D',()=>{
  assert.match(P.note('none'),/이 기기에만 저장돼요/);
  assert.match(P.note('here'),/이 기기에만 저장돼요.*운동장으로 보여요/);
  assert.match(P.note('missing'),/이 기기에는 없어요/);
  assert.match(P.note('here',true),/3D 보기에서는 보이지 않아요/);assert.doesNotMatch(P.note('none',true),/3D/);
  assert.match(P.T.ok,/이 기기에만/);
});

test('장면 · 페이지 · 되돌리기에 사진 원본이 실리지 않는다 — 참조만, 사진이 하나면 참조도 하나',()=>{
  const ref=P.refOf('data:image/jpeg;base64,'+'Q'.repeat(250000),1600,900);
  const snap=()=>({pitchSpec:'fifa',pitchImg:ref,players:[{id:1,x:1,y:2}],drawings:[]});
  const frames=Array.from({length:12},()=>({snap:snap(),dur:1}));
  const work={snap:snap(),animFrames:frames,boardPages:{pages:[{snap:snap(),anim:{frames}},{snap:Object.assign(snap(),{pitchImg:null})}],idx:0},undo:[{board:snap()}]};
  const raw=JSON.stringify(work);
  assert.equal(/data:image/.test(raw),false,'사진 원본 없음');
  assert.ok(raw.length<6000,'장면 12개 × 페이지 2개 + 되돌리기 — 사진이 있어도 '+raw.length+'자');
  assert.deepEqual(P.refsIn(work),[ref],'참조는 하나(이 기기에 사진 한 벌)');
});

test('render — 사진 참조가 아니면 원래 길로(false), 참조면 여기서 맡는다(이 기기에 없으면 그림 없이 운동장)',()=>{
  const removed=[];const node=id=>({id,remove(){removed.push(id);},parentNode:null});
  const world={querySelector:q=>q==='#ps-pitchtile'?node('tile'):null};
  const svg={ownerDocument:{body:{classList:{remove(){}}}},querySelector:()=>null};
  assert.equal(P.render(null,svg,world,{L:30,T:30,PW:1050,PH:680},30),false);
  assert.equal(P.render('@real',svg,world,{L:30,T:30,PW:1050,PH:680},30),false);
  assert.equal(removed.length,0,'원래 길의 것은 건드리지 않는다');
  assert.equal(P.render(P.refOf('x',1600,900),svg,world,{L:30,T:30,PW:1050,PH:680},30),true);
  assert.deepEqual(removed,['tile'],'실사 잔디 타일은 걷는다 · 이 기기에 사진이 없으면 그림을 넣지 않는다');
});

test('커뮤니티에 올릴 때 운동장 사진 참조도 뺀다(올린 기기에만 있는 사진)',()=>{
  const comm=R('studio/community.html'),a=comm.indexOf('var __pubNames=[];'),b=comm.indexOf('function openUpload(){',a);
  assert.ok(a>=0&&b>a);
  const c=vm.createContext({Blob});vm.runInContext(comm.slice(a,b)+';this.api={stripSnap};',c);
  const out=JSON.parse(JSON.stringify(c.api.stripSnap({pitchTheme:'white',pitchImg:P.refOf('x'),players:[],drawings:[]})));
  assert.equal('pitchImg' in out,false);assert.equal(out.pitchTheme,'white','고른 피치 색은 그대로');
  const keep=JSON.parse(JSON.stringify(c.api.stripSnap({pitchImg:'@real',players:[]})));
  assert.equal(keep.pitchImg,'@real','실사 잔디 프리셋은 그대로');
});

test('작전판이 모듈을 싣고 · 오프라인 필수 파일 · 저장 키 표에 있다',()=>{
  const board=R('studio/board.html');
  assert.match(board,/<script src="board-pitch-photo\.js"><\/script>/);
  assert.ok(board.indexOf('board-pitch-photo.js')<board.indexOf('function renderPitchImg('),'운동장 그리기보다 먼저 싣는다(설정 줄이 피치 줄 바로 뒤에 선다)');
  assert.match(board,/PSPitchPhoto\.render\(state\.pitchImg,/);
  assert.match(board,/"pitchSeg","grassToneBSeg","grassTonePSeg","trainGridSeg","pitchPhotoRow","pitchPhotoHint"/,'보드 설정 › 운동장 › 바탕 묶음');
  assert.match(R('sw.js'),/'\/studio\/board-pitch-photo\.js'/);
  const K=require('../studio/storage-keys.js'),row=K.info(P.PREFIX+'0123456789abcdef');
  assert.ok(row&&row.sync==='device'&&row.home==='idb','이 기기 IndexedDB 에만 — 동기화 키가 아니다');
});
