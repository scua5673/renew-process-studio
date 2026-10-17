// 3.088 — 피치를 바꾸면 모든 페이지 · 미팅 슬라이드에(오류 제보 934aaa3e «운동장 스타일을 수정하면 … 모든 페이지가 적용돼야» · 83a6a38b 미팅 운동장 디자인).
// 화면에서 고르는 것은 tests/browser/board-pitch-all.mjs 가 본다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const PA=require('../studio/board-pitch-all.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const snap=(theme,extra={})=>({players:[{id:1,num:'7',x:100,y:100}],pitchTheme:theme,pitchCustom:null,pitchImg:null,pitchSpec:'fifa',orientation:'h',...extra});

test('스냅 하나 — 피치 세 칸만, 같으면 그대로',()=>{
  const cur=snap('calm');
  const a=snap('');assert.equal(PA.stamp(a,cur),true);assert.equal(a.pitchTheme,'calm');
  assert.equal(PA.stamp(a,cur),false,'이미 같으면 바꾸지 않는다');
  const b=snap('navy',{pitchSpec:'futsal',orientation:'v'});PA.stamp(b,snap(''));
  assert.equal(b.pitchTheme,'navy','네이비 = «» — 같은 피치로 본다');
  assert.equal(PA.stamp(b,snap('white')),true);
  assert.deepEqual([b.pitchSpec,b.orientation],['futsal','v'],'규격 · 방향은 페이지마다 그대로');
  const c=snap('grass');PA.stamp(c,snap('grass',{pitchImg:'@real'}));assert.equal(c.pitchImg,'@real','실사 바탕도');
  const custom={grass:'#123456',line:'#ffffff'},d=snap('');PA.stamp(d,snap('custom',{pitchCustom:custom}));
  assert.deepEqual(d.pitchCustom,custom);custom.grass='#000000';assert.equal(d.pitchCustom.grass,'#123456','사용자 색은 사본');
  const old={players:[]};assert.equal(PA.stamp(old,snap('train')),true);assert.equal(old.pitchTheme,'train','피치를 적지 않은 옛 페이지에도');
});

test('판과 장면 — 바뀐 장면은 그림을 비운다',()=>{
  const sn=snap(''),fr=[{snap:snap(''),thumb:'<svg/>'},{snap:snap('calm'),thumb:'<svg/>'},null];
  assert.equal(PA.stampWithFrames(sn,fr,snap('calm')),true);
  assert.deepEqual(fr.slice(0,2).map(f=>[f.snap.pitchTheme,'thumb' in f]),[['calm',false],['calm',true]]);
});

test('알림 글',()=>{
  assert.equal(PA.note('피치를',{pages:2,pagesTotal:3}),'피치를 페이지 3개에 모두 적용했어요');
  assert.equal(PA.note('피치 색을',{slides:4,slidesTotal:5,n:2,total:6}),'피치 색을 슬라이드 5장 · 장면 6개에 모두 적용했어요');
  assert.equal(PA.note('피치를',{pages:0,slides:0,n:0}),'');
});

// 보드 흉내 — 페이지 셋(지금 1번) · 미팅 슬라이드 셋(지금 0번)
function fakeBoard({meet=false,pages=3,cls=[],readOnly=false}={}){
  const P=Array.from({length:pages},(_,i)=>({snap:snap(''),anim:i===2?{frames:[{snap:snap('')},{snap:snap('')}]}:null}));
  const S=[0,1,2].map(i=>({snap:snap(''),thumb:'old'+i,frames:i===1?[{snap:snap('')},{snap:snap('')}]:undefined}));
  const classes=new Set(cls.concat(meet?['meet-mode']:[])),toasts=[],thumbs=[],saves=[];let cur=snap('calm');
  const win={document:{body:{classList:{contains:c=>classes.has(c)}}},__vaultReadOnly:readOnly,
    setTimeout:fn=>fn(),captureSnap:()=>JSON.parse(JSON.stringify(cur)),toast:m=>toasts.push(m),
    __snapToThumb:sn=>'new-'+sn.pitchTheme,__ksThumb:i=>thumbs.push(i),__vaultAutoSaveSchedule:()=>saves.push('vault'),boardSaveLive:()=>saves.push('live'),
    __psPages:{eachOther(fn){ if(pages<2)return 0; let ch=0; P.forEach((p,i)=>{ if(i===1)return; ch+=fn(p.snap,p.anim&&p.anim.frames)||0; }); return ch; },book:{count:()=>pages}},
    __meet:{frames:()=>S,idx:()=>0},
    _viewScenesMatch(kind){ return {n:kind==='pitch'?1:0,total:kind==='pitch'?4:0}; },
    _viewScenesToast(r,what){ if(r&&r.n)toasts.push(what+' 장면 '+r.total+'개에 모두 적용했어요'); return r; },
    lookPresetApply(name){ cur=snap('white'); return name==='있음'; }};
  return {win,P,S,toasts,thumbs,saves,setCur:s=>{cur=s;}};
}

test('작전판 — 지금 페이지 밖 모든 페이지 · 그 장면에',()=>{
  const B=fakeBoard();assert.equal(PA.install(B.win),true);assert.equal(PA.install(B.win),false,'한 번만');
  const r=B.win._viewScenesMatch('pitch');
  assert.deepEqual([r.n,r.total,r.pages,r.pagesTotal,r.slides],[1,4,2,3,0],'보드의 장면 맞추기는 그대로 + 페이지 둘');
  assert.deepEqual(B.P.map(p=>p.snap.pitchTheme),['calm','','calm'],'1번(지금 페이지)은 보드가 저장할 때 담는다');
  assert.deepEqual(B.P[2].anim.frames.map(f=>f.snap.pitchTheme),['calm','calm'],'다른 페이지의 장면도');
  B.win._viewScenesToast(r,'피치를');assert.deepEqual(B.toasts,['피치를 페이지 3개 · 장면 4개에 모두 적용했어요']);
  const n=B.win._viewScenesMatch('range');assert.equal(n.pages,undefined,'피치 말고는 넓히지 않는다(범위 · 규격 · 개수는 페이지마다)');
  B.win._viewScenesToast({n:0,total:0},'피치를');assert.equal(B.toasts.length,1,'바꾼 게 없으면 알리지 않는다');
});

test('미팅 — 지금 슬라이드 밖 모든 슬라이드 · 그 장면에, 그림 다시 그리고 저장',()=>{
  const B=fakeBoard({meet:true,pages:1});PA.install(B.win);
  const r=B.win._viewScenesMatch('pitch');
  assert.deepEqual([r.pages,r.slides,r.slidesTotal],[0,2,3]);
  assert.deepEqual(B.S.map(s=>[s.snap.pitchTheme,s.thumb]),[['','old0'],['calm','new-calm'],['calm','new-calm']]);
  assert.deepEqual(B.S[1].frames.map(f=>f.snap.pitchTheme),['calm','calm']);
  assert.deepEqual(B.thumbs,[1,2]);assert.deepEqual(B.saves,['vault','live']);
  B.win._viewScenesToast(r,'피치를');assert.equal(B.toasts.pop(),'피치를 슬라이드 3장 · 장면 4개에 모두 적용했어요');
});

test('보기 전용 · 재생 중에는 넓히지 않는다',()=>{
  for(const B of [fakeBoard({cls:['comm-viewing']}),fakeBoard({readOnly:true})]){ PA.install(B.win); const r=B.win._viewScenesMatch('pitch');
    assert.deepEqual([r.pages,r.slides],[0,0]); assert.deepEqual(B.P.map(p=>p.snap.pitchTheme),['','','']); }
  const B=fakeBoard();B.win.__animExport=true;PA.install(B.win);assert.equal(B.win._viewScenesMatch('pitch').pages,0,'내보내기 중');
});

test('«내 스타일» 적용도 피치를 모든 페이지에',()=>{
  const B=fakeBoard();PA.install(B.win);
  assert.equal(B.win.lookPresetApply('없음'),false);assert.deepEqual(B.P.map(p=>p.snap.pitchTheme),['','',''],'적용 못 했으면 그대로');
  assert.equal(B.win.lookPresetApply('있음'),true);
  assert.deepEqual(B.P.map(p=>p.snap.pitchTheme),['white','','white']);
  assert.equal(B.toasts.pop(),'설정의 피치를 페이지 3개 · 장면 4개에 모두 적용했어요');
});

test('작전판에 붙는다 — 모듈 · 오프라인 · 판 크기',()=>{
  const b=read('studio/board.html');
  assert.match(b,/<script src="board-comm-look\.js"><\/script><script src="board-pitch-all\.js"><\/script>/);
  assert.match(read('sw.js'),/'\/studio\/board-pitch-all\.js'/);
  // 감싸는 함수 셋은 본문의 맨 바깥 함수 선언이어야 한다(window 속성 — 보드 안의 호출도 감싼 것을 지난다)
  for(const fn of ['_viewScenesMatch','_viewScenesToast','lookPresetApply'])assert.match(b,new RegExp('\\nfunction '+fn+'\\('),fn);
  assert.match(b,/if\(e\.isTrusted\|\|window\.__psUserClick\)\{ try\{_viewScenesToast\(_viewScenesMatch\("pitch"\),"피치를"\);\}catch\(_\)\{\} \}/,'사람이 고른 피치만 넓힌다');
});
