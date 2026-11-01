'use strict';
// 3.134 — 폰으로 보는 보관함 작전판(보기 전용, board-vault-browse.js mountPhone). 사용자 피드백 «폰에서 작전판 보기 — 운동장이 가로로
// 작게 나와 번호가 안 보임». 커뮤니티 뷰어(3.065 · 3.066 · 3.067)와 같은 규칙: 세로로 그리고(판의 얕은 사본만) · 선수 1.6배 · 재생 단추.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const V=require('../studio/board-vault-browse.js');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

function fake(width){
  const cls=new Set(),els={},timers=[],calls=[];let obs=null;
  const body={classList:{contains:c=>cls.has(c),toggle:(c,on)=>{const was=cls.has(c);if(on)cls.add(c);else cls.delete(c);if(was!==!!on&&obs)obs();},
    add:c=>{cls.add(c);obs&&obs();},remove:c=>{cls.delete(c);obs&&obs();}},appendChild(e){els.body=e;}};
  const head={appendChild(s){els.css=s;}};
  const doc={readyState:'complete',body,head,documentElement:head,
    createElement:t=>({tagName:t,id:'',textContent:'',innerHTML:'',type:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(t,f){this['on'+t]=f;}}),
    getElementById:id=>els[id]||null,addEventListener(){}};
  const W={document:doc,innerWidth:width,COMM_PHONE_TOK:1.6,setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout(){},addEventListener(t,f){if(t==='resize')W.__onResize=f;},
    MutationObserver:function(cb){this.observe=()=>{obs=cb;};},
    loadSnap(s,o){calls.push(['load',s,o]);},renderInterp(a,b,u,c){calls.push(['interp',a,b,u]);},commViewTok(){return W.__comm||0;},
    playAnim(){calls.push(['play']);},applyView(){},renderTokens(){},renderDrawings(){}};
  return {W,cls,els,calls,timers};
}
function view(f,{ro=true,book=false}={}){ f.W.__vaultViewMode=true;f.W.__vaultReadOnly=ro;f.W.__vaultBook=book;f.W.document.body.classList.add('vcreating'); }

test('세로로 그릴 판은 얕은 사본 — 저장본 · 장면 목록은 그대로, 이미 세로(세트피스)는 그 판 그대로',()=>{
  const s={orientation:'h',spFlip:true,players:[{id:1,x:10,y:20}],area:'half'};
  const u=V.upright(s);
  assert.notEqual(u,s);assert.equal(u.orientation,'v');assert.equal(u.spFlip,false);
  assert.equal(u.players,s.players,'선수 좌표는 같은 것 — 그리는 방향만');assert.equal(u.area,'half');
  assert.equal(s.orientation,'h','원본은 그대로');assert.equal(s.spFlip,true);
  const v={orientation:'v',spFlip:true,fieldMode:'setpiece'};assert.equal(V.upright(v),v,'세로 판은 손대지 않는다');
  assert.equal(V.upright(null),null);
  assert.equal(V.upright({players:[]}).orientation,'v','방향이 없는 옛 판(가로로 읽힌다)도 세운다');
});

test('폰 폭 · 보관함 보기 전용 · 미팅 · 커뮤니티 · 훈련 편집기 아님 — 그때만',()=>{
  let f=fake(375);view(f);assert.equal(V.phoneViewOn(f.W),true);
  f=fake(601);view(f);assert.equal(V.phoneViewOn(f.W),false,'폰 가로 · 아이패드 · 컴퓨터는 그대로');
  f=fake(375);view(f,{ro:false});assert.equal(V.phoneViewOn(f.W),false,'편집(자동 저장)에서는 방향을 바꾸지 않는다 — 저장본에 실린다');
  for(const c of ['meet-mode','comm-viewing','editing']){f=fake(375);view(f);f.W.document.body.classList.add(c);assert.equal(V.phoneViewOn(f.W),false,c);}
  f=fake(375);assert.equal(V.phoneViewOn(f.W),false,'작업 보드(보관함 보기 아님)');
});

test('loadSnap · renderInterp 에는 세운 사본, 선수는 커뮤니티 뷰어와 같은 1.6배 — 폰 보기에서만',()=>{
  const f=fake(375);V.mountPhone(f.W);
  const s={orientation:'h',players:[]};
  f.W.loadSnap(s,{keepLook:true});assert.equal(f.calls[0][1],s,'보기가 아니면 그대로');
  assert.equal(f.W.commViewTok(),0,'보기가 아니면 편집기 규칙(0)');
  view(f);
  f.W.loadSnap(s,{keepLook:true});
  assert.equal(f.calls[1][1].orientation,'v');assert.deepEqual(f.calls[1][2],{keepLook:true},'옵션은 그대로');assert.equal(s.orientation,'h');
  f.W.renderInterp({orientation:'h'},{orientation:'h'},0.5,null);
  assert.deepEqual([f.calls[2][1].orientation,f.calls[2][2].orientation,f.calls[2][3]],['v','v',0.5]);
  assert.equal(f.W.commViewTok(),1.6);
  f.W.psPhoneBoardReadOnly=()=>true;assert.equal(f.W.commViewTok(),1.8,'the persistent phone notice leaves enough room for readable player numbers');
  f.W.__psThumbNoEd=true;assert.equal(f.W.commViewTok(),0,'썸네일을 뜰 때는 키우지 않는다');f.W.__psThumbNoEd=false;
  f.W.__comm=1;assert.equal(f.W.commViewTok(),1,'커뮤니티 뷰어의 값은 그대로');
});

test('재생 단추 — 장면 둘 이상 · 패턴북은 띠에 제 단추가 있어 빼고, 누르면 본문 playAnim',()=>{
  const f=fake(375);const api=V.mountPhone(f.W);
  global.anim={frames:[{},{},{}]};global.animPlaying=false;
  try{
    view(f);api.sync();
    assert.equal(f.cls.has('ps-vv-phone'),true);assert.equal(f.cls.has('ps-vv-anim'),true,'장면 셋');
    const btn=f.els.body;assert.equal(btn.id,'psVvPlay');assert.match(btn.innerHTML,/재생 · 장면 3/);
    btn.onclick({stopPropagation(){}});assert.deepEqual(f.calls.at(-1),['play']);
    global.animPlaying=true;api.sync();assert.match(btn.innerHTML,/멈춤/);
    global.anim={frames:[{}]};api.sync();assert.equal(f.cls.has('ps-vv-anim'),false,'장면 하나는 숨김');
    global.anim={frames:[{},{}]};f.W.__vaultBook=true;api.sync();assert.equal(f.cls.has('ps-vv-anim'),false,'패턴북');
    f.W.__vaultBook=false;f.W.__vaultReadOnly=false;f.W.__vaultViewMode=false;f.W.document.body.classList.remove('vcreating');api.sync();
    assert.equal(f.cls.has('ps-vv-phone'),false,'닫으면 걷힌다');
  }finally{delete global.anim;delete global.animPlaying;}
});

test('폰을 돌리면 — 가로 화면은 연 때의 방향, 다시 세로면 세로',()=>{
  const f=fake(375);const api=V.mountPhone(f.W);
  global.state={orientation:'h',spFlip:false};
  try{
    view(f);f.W.loadSnap({orientation:'h',spFlip:false});   // 실제 loadSnap 은 state 를 바꾼다 — 가짜는 받은 판을 적는다
    global.state.orientation=f.calls.at(-1)[1].orientation;
    assert.equal(global.state.orientation,'v');
    f.W.innerWidth=667;api.reorient();assert.equal(global.state.orientation,'h','아이폰 SE 가로');
    f.W.innerWidth=375;api.reorient();assert.equal(global.state.orientation,'v');
  }finally{delete global.state;}
});

test('막대 한 줄 · 단추 자리 CSS · board.html 그대로(크기 예산) · 판 · 안내',()=>{
  const c=V.PHONE_CSS;
  assert.match(c,/body\.ps-vv-phone #vCreateBar\{flex-wrap:nowrap!important\}/);
  assert.match(c,/body\.ps-vv-phone #vCreateBar #vCreateTitle\{[^}]*text-overflow:ellipsis/);
  assert.match(c,/#psVvPlay\{position:absolute;left:10px;top:10px;/,'판 왼쪽 위 — 아래는 장면 자막 자리');
  assert.match(c,/body\.ps-vv-phone\.ps-vv-anim #psVvPlay\{display:inline-flex\}/);
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-vault-browse.js"></script>'));
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  // 감싸는 본문 함수 · 값이 그대로 있다(이름이 바뀌면 이 모듈이 조용히 아무 일도 안 한다)
  assert.match(b,/\nfunction loadSnap\(s,opts\)\{/);assert.match(b,/\nfunction renderInterp\(a,b,u,curves\)\{/);
  assert.match(b,/\nfunction commViewTok\(\)\{/);assert.match(b,/\nvar COMM_PHONE_TOK=1\.6;/);
  assert.match(b,/\nfunction playAnim\(\)\{/);
  assert.match(read('studio/release-notes.js'),/v3\.134 · 폰에서 보관함 작전판을 세로로 크게/);
});
