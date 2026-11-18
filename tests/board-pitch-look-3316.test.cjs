'use strict';
/* 3.316 — 미팅 11/18 작전판 셋: ① 3D 잔디 색은 평면 피치를 따른다 ② 4K · 60fps 영상 · 4K PNG ③ 저장 사본은 장면 썸네일을 복사하지 않는다.
   순수 셈은 studio/board-pitch-look.js, board.html 은 배선만(원문으로 본다). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../studio/board-pitch-look.js');
const D=require('../studio/lib-diet.js');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const MD={ga:'#2c6a2a',gb:'#367a33'};
const env=o=>({key:o.key,css:k=>({'--grass-a':o.ga,'--grass-b':o.gb,'--pitchbg':o.bg})[k]||'',tone:o.tone||'0|0',matrix:k=>[k.length,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]});

test('① 피치 키 — 실사(@real · 옛 grass) · 프리셋 · 직접 색 · 기본은 navy',()=>{
  assert.equal(L.pitchKey('@real','grass'),'real');assert.equal(L.pitchKey(null,'grass'),'real','옛 평면 잔디도 실사 단추(2.287)');
  assert.equal(L.pitchKey(null,''),'navy');assert.equal(L.pitchKey(undefined,undefined),'navy');
  for(const k of ['calm','white','train','custom'])assert.equal(L.pitchKey(null,k),k);
});

test('① 프리셋은 평면 줄무늬와 같은 CSS 두 색 · 직접 색은 그 색과 조금 어두운 색 · 실사는 분위기의 초록 + 사진 톤 행렬',()=>{
  const navy=L.pitchLook(MD,'',env({key:'navy',ga:'#20243f',gb:'#15172b'}));
  assert.deepEqual([navy.key,navy.ga,navy.gb,navy.tone,navy.grass],['navy','#20243f','#15172b','',false]);
  const white=L.pitchLook(MD,'',env({key:'white',ga:'#ffffff',gb:'#edf0f5'}));
  assert.deepEqual([white.ga,white.gb,white.grass],['#ffffff','#edf0f5',false]);
  const calm=L.pitchLook(MD,'',env({key:'calm',ga:'#1f4d31',gb:'#173a23'}));
  assert.deepEqual([calm.ga,calm.gb,calm.grass],['#1f4d31','#173a23',true],'딥그린은 잔디(닳은 자국)');
  const custom=L.pitchLook(MD,'',env({key:'custom',bg:'#3366cc'}));
  assert.deepEqual([custom.key,custom.ga,custom.gb,custom.grass],['custom','#3366cc','#2e5cb8',false]);
  const real=L.pitchLook(MD,'data:image/avif;base64,x',env({key:'real'}));
  assert.deepEqual([real.ga,real.gb,real.tone,real.grass],['#2c6a2a','#367a33','',true],'기본 톤(0|0)이면 필터 없음');
  const toned=L.pitchLook(MD,'data:image/avif;base64,x',env({key:'real',tone:'l|p'}));
  assert.equal(toned.tone.split(' ').length,20,'feColorMatrix 값 20개');assert.equal(toned.tone.split(' ')[0],'3','톤 열쇠가 행렬에(가짜 행렬: 첫 값 = 열쇠 길이)');
  assert.equal(L.pitchLook(MD,'',env({key:'real',tone:'l|p'})).tone,'','사진을 못 그리는 기기는 두 색 줄 — 톤 필터 없음');
  assert.notEqual(navy.sig,white.sig);assert.notEqual(real.sig,toned.sig,'톤이 바뀌면 서명도');
  const bare=L.pitchLook(MD,'',env({key:'white'}));assert.deepEqual([bare.ga,bare.gb],[MD.ga,MD.gb],'CSS 값이 비면 분위기 색');
  assert.deepEqual(L.pitchLook(MD,'',null).key,'navy','env 없음');
  assert.equal(L.shade('#fff',.5),'#808080');assert.equal(L.shade('#000000',.9),'#000000');assert.equal(L.shade('red',.9),'red');
});

test('① board.html 배선 — 사진은 실사일 때만 · 두 색 줄은 pk · 톤 필터 · 닳은 자국은 잔디에만 · 서명에 피치 · 화면 열쇠에 직접 색 · 영상 선 색 그대로',()=>{
  const cut=(a,b)=>{const i=board.indexOf(a),j=board.indexOf(b,i);assert.ok(i>0&&j>i,a.slice(0,40));return board.slice(i,j);};
  const st=cut('  function tiltStadium(surface,bw,bh){','  window.tiltGoalsSync=function(){');
  assert.match(st,/const turf=\(tiltPitchKey\(\)==="real"&&window\.__ballImgOK&&window\.PITCH_IMG&&window\.PITCH_IMG\.real\)\|\|'';/);
  assert.match(st,/md=TILT_MOOD\[t3\.mood\]\|\|TILT_MOOD\.night,brand=!!t3\.brand,/,'분위기 줄은 그대로(3.029 시험)');
  assert.match(st,/const pk=tiltPitchLook\(md,turf\);/);
  assert.match(st,/:mow\.grass\(pk\.ga,pk\.gb\)\)/,'3.326 — 두 색 줄은 mowPlan 이 무늬에 맞춰(색은 그대로 pk)');
  assert.doesNotMatch(st,/fill="'\+md\.ga\+'"/,'분위기 색을 직접 칠하는 곳은 없다');
  assert.match(st,/preserveAspectRatio="none"'\+\(pk\.tone\?' filter="url\(#psStTone\)"':''\)\+'\/><\/pattern>'\+\(pk\.tone\?'<filter id="psStTone" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="'\+pk\.tone\+'"\/><\/filter>':''\)/);
  assert.match(st,/if\(!whole&&pk\.grass\)\{const wr=/);
  assert.match(st,/const gsig=ground\?sig\+'\|'\+ground\.key:sig;/,'서명(__sig)은 그대로 — 시험이 자리로 읽는다');
  assert.match(st,/if\(host\.__sig===gsig&&host\.__pk===pk\.sig\)return;/);assert.match(st,/host\.__sig=gsig;host\.__pk=pk\.sig;/,'피치 모습은 __pk 로 따로 견준다');
  assert.match(st,/tcol,bleed\?1:0\]\.join\('\|'\);/);
  assert.match(board,/function tiltPitchKey\(\)\{ return PSBoardLook\.pitchKey\(state\.pitchImg,document\.documentElement\.dataset\.pitch\); \}/);
  assert.match(board,/function tiltPitchLook\(md,turf\)\{ return PSBoardLook\.pitchLook\(md,turf,\{key:tiltPitchKey\(\),css:getCss,tone:\(typeof grassToneKey==="function"\)\?grassToneKey\(\):"0\|0",matrix:window\.__grassToneMatrix\}\); \}/);
  const gs=cut('  window.tiltGoalsSync=function(){','    const turf=surface.firstElementChild');
  assert.equal((gs.match(/gkey,getCss\('--pitchbg'\),window\.__grassTone\|\|'',window\.__grassM\]\.join\('\|'\)/g)||[]).length,2,'pre 열쇠와 signature 둘 다(3.326 — 잔디 무늬 __grassM 도)');
  assert.match(board,/css\.textContent=_t3BoardCss\(!!t3st,false\);/);assert.doesNotMatch(board,/_t3BoardCss\(!!t3st,\['white','train'\]/);
  assert.ok(board.includes('<script src="board-pitch-look.js"></script>'),'모듈을 싣는다');
  assert.ok(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8').includes("'/studio/board-pitch-look.js'"),'sw CORE');
});

test('② H.264 레벨 — 1080p30 이하는 예전 순서 · 1080p60 은 4.2 부터 · 4K30 은 5.1 부터 · 4K60 은 5.2 · 비트레이트',()=>{
  assert.deepEqual(L.codecs(1920,1080,30),['avc1.42E028','avc1.42E02A','avc1.42E01F','avc1.42001F']);
  assert.deepEqual(L.codecs(1280,720,15),['avc1.42E028','avc1.42E02A','avc1.42E01F','avc1.42001F']);
  assert.deepEqual(L.codecs(1920,1080,60),['avc1.42E02A','avc1.42E032','avc1.42E033','avc1.42E034']);
  assert.deepEqual(L.codecs(3840,2160,30),['avc1.42E033','avc1.42E034']);
  assert.deepEqual(L.codecs(3840,2160,60),['avc1.42E034']);
  assert.deepEqual(L.codecs(2160,3840,60),['avc1.42E034'],'릴스 9:16 4K');
  assert.deepEqual(L.codecs(7680,4320,60),['avc1.42E034'],'넘어도 가장 높은 레벨 하나');
  assert.deepEqual([L.bitrate(720,30),L.bitrate(1080,30),L.bitrate(1080,60),L.bitrate(2160,30),L.bitrate(2160,60)],[5000000,10000000,15000000,36000000,54000000]);
});

test('② 아이폰 · 아이패드(터치 맥 UA 포함)만 4K 를 막는다 · PNG 배율은 긴 변 3840(2 이상 4 이하 · 막힌 기기는 2)',()=>{
  const nav=(ua,t)=>({userAgent:ua,maxTouchPoints:t||0});
  assert.equal(L.blocked4k(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/157')),false);
  assert.equal(L.blocked4k(nav('Mozilla/5.0 (Windows NT 10.0) Edge/157')),false);
  assert.equal(L.blocked4k(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) Safari',5)),true);
  assert.equal(L.blocked4k(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari',5)),true,'아이패드 사파리는 맥 UA + 터치');
  assert.equal(L.blocked4k(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari',0)),false,'맥 사파리');
  assert.equal(L.blocked4k({}),false);
  assert.equal(L.pngScale(1110,740),3.46);assert.equal(Math.round(1110*L.pngScale(1110,740)),3841);
  assert.equal(L.pngScale(2500,900),2,'넓은 판은 2배가 이미 4K 를 넘는다');assert.equal(L.pngScale(600,400),4,'작은 판도 4배까지만');
  assert.equal(L.pngScale(1110,740,true),2);
});

test('② board.html 배선 — 시트(720p · 1080p · 4K / 15 · 30 · 60 · 기억 · 아이패드 4K 막음) · 인코더 레벨 · 비트레이트 · 3D 평면 그림 상한 · PNG',()=>{
  assert.match(board,/\+seg\("화질",\[\["720p",720\],\["1080p",1080\],\["4K",2160\]\],"height"\)/);
  assert.match(board,/\+seg\("초당 장면",\[\["15fps",15\],\["30fps",30\],\["60fps",60\]\],"fps"\)/);
  assert.match(board,/localStorage\.getItem\("ps_anim_export_height_v1"\)/);
  assert.match(board,/localStorage\.setItem\("ps_anim_export_height_v1",String\(opt\.height\)\); localStorage\.setItem\("ps_anim_export_fps_v1",String\(opt\.fps\)\);/);
  assert.match(board,/var _no4k=PSBoardLook\.blocked4k\(\); if\(_no4k&&opt\.height===2160\)opt\.height=1080;/);
  assert.match(board,/\.ev-seg\[data-key="height"\] \.ev-b\[data-v="2160"\]'\); if\(_b4\)\{ _b4\.disabled=true;/);
  assert.match(board,/for\(const c of PSBoardLook\.codecs\(w,h,fps\)\)\{ const cfg=\{codec:c,width:w,height:h,bitrate:br,framerate:fps,avc:\{format:"avc"\}\};/);
  assert.match(board,/const _br=PSBoardLook\.bitrate\(canvas\.height,FPS\);/);
  assert.match(board,/rho=Math\.min\(rho,4096\/src\[2\],4096\/src\[3\],Math\.sqrt\(Math\.max\(6e6,canvas\.width\*canvas\.height\*1\.1\)\/\(src\[2\]\*src\[3\]\)\)\);/);
  assert.match(board,/const s=PSBoardLook\.pngScale\(w,h,PSBoardLook\.blocked4k\(\)\),c=document\.createElement\("canvas"\);/);
  assert.match(board,/c\.width=Math\.round\(w\*s\);c\.height=Math\.round\(h\*s\);const ctx=c\.getContext\("2d"\);ctx\.fillStyle=gb;/);
});

const plain=o=>JSON.parse(JSON.stringify(o));
const snap=k=>({pitchSpec:'fifa',players:[{id:101,team:'blue',num:'6',x:400+k,y:300}],equipment:[],drawings:[]});
const frames=(n,tag)=>Array.from({length:n},(_,k)=>({snap:snap(k),hold:.6,dur:1,cap:'장면 '+k,thumb:'<svg data-k="'+tag+k+'"></svg>'}));
const page=(name,n)=>({name,snap:snap(0),thumb:'<svg data-k="page-'+name+'"></svg>',vlink:{libId:'L'+name},anim:{frames:frames(n,name),active:0,hold:.6,title:'제목',titleColor:'#e23b3b'}});
const pages=()=>[page('p1',4),page('p2',3),{name:'p3',snap:snap(0),thumb:'<svg data-k="page-p3"></svg>',anim:null},null];

test('③ 장면 1부터의 썸네일만 빠진다 — PSLibDiet.pagesStrip 뒤의 깊은 사본과 똑같다 · 원본은 그대로',()=>{
  const src=pages(),before=plain(src);
  const lean=L.cloneLean(src),want=plain(src);D.pagesStrip(want);
  assert.deepEqual(lean,want);assert.deepEqual(plain(src),before,'원본 페이지 · 장면 · 썸네일은 그대로');
  assert.equal(lean[0].anim.frames[0].thumb,'<svg data-k="p10"></svg>','장면 0 의 그림은 남는다');assert.equal(lean[0].thumb,'<svg data-k="page-p1"></svg>','페이지 그림도');
  assert.equal(D.pagesHas(lean),false,'뗄 것이 더 없다');
});

test('③ 깊은 사본이다 — 사본을 고쳐도 원본이 안 바뀐다 · 썸네일 없는 장면 · anim 없는 페이지 · 빈 칸도 그대로',()=>{
  const src=pages();src[1].anim.frames[2].thumb='';delete src[1].anim.frames[1].thumb;
  const lean=L.cloneLean(src);lean[0].anim.frames[1].snap.players[0].x=999;lean[0].snap.players.push({id:7});
  assert.equal(src[0].anim.frames[1].snap.players[0].x,401);assert.equal(src[0].snap.players.length,1);
  assert.deepEqual(lean[1].anim.frames[2],{snap:snap(2),hold:.6,dur:1,cap:'장면 2',thumb:''});
  assert.deepEqual(Object.keys(lean[1].anim.frames[1]).sort(),['cap','dur','hold','snap']);
  assert.equal(lean[2].anim,null);assert.equal(lean[3],null);assert.deepEqual(L.cloneLean(null),[]);assert.deepEqual(L.cloneLean(undefined),[]);
});

test('③ board.html 배선 — forSave · liveVal · captureContext 가 그 사본을 쓴다',()=>{
  assert.match(board,/function _cloneLean\(a\)\{ try\{ return PSBoardLook\.cloneLean\(a\); \}catch\(_\)\{ return _clone\(a\); \} \}/);
  assert.match(board,/capture\(\); var _fp=_cloneLean\(pages\); _fp\.forEach\(function\(p\)\{ if\(p\)delete p\.vlink; \}\); return _fp; \} return null; \},/);
  assert.match(board,/liveVal:function\(\)\{ if\(window\.__vaultEdit\) return null; if\(pages && pages\.length>1\)\{ capture\(true\); return \{pages:_cloneLean\(pages\), idx:idx\}; \} return null; \},/);
  assert.match(board,/var p=pages\? _cloneLean\(pages\):null;/);
  assert.ok(Buffer.byteLength(board)<=2560000,'board.html budget '+Buffer.byteLength(board));
});
