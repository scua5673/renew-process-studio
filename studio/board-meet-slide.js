/* PROCESS STUDIO — 미팅 슬라이드 넘김의 토큰 잇기(3.256).
   사용자 «미팅 슬라이드를 넘길 때 토큰 색이 막 바뀌고 흔적이 남으면서 이상하게 넘어간다»(2026-11-04, 맥 데스크톱 · «전환: 슬라이드»).
   원인: 슬라이드 사이도 장면 사이와 같은 보간(renderInterp)으로 넘겼고, 그 보간은 토큰을 id 로만 잇는다. 슬라이드끼리는 id 가 겹치거나 다르다
   (기본 장 1001~ · 경기에서 온 장 1001~ 순서대로 · 리저브 2001~ — 2.970) →
   · 다른 번호 · 다른 팀 토큰이 서로 날아가 도착 순간 번호 · 이름 · 색이 바뀌었다.
   · 이어지지 않는 토큰은 앞 장 것이 끝까지 제자리에 남고 다음 장 것은 첫 프레임에 한꺼번에 떴다(BEST 11→RESERVE 22개 겹침 · RESERVE→하이블록 33개).
   · 유니폼은 도착 순간에 바뀌었다 — RESERVE 는 «모든 슬라이드에» 유니폼에서 빠지는 장(3.122)이라 우리 팀 색이 다를 수 있다.
   · 잔상(2.980)은 id 로 이어 그려 앞 장의 길이 다음 장으로 이어졌다.
   이제 슬라이드 경계에서만(장면 사이 · 작전판 재생은 그대로):
   · 같은 팀 · 같은 역할(리저브 · 코치) · 같은 번호만 이어서 움직인다. 번호가 없으면 같은 팀의 같은 id. 같은 열쇠가 둘이면 나온 순서대로.
   · 이어지지 않는 토큰은 앞 절반에 사라지고(1→0) 뒤 절반에 나타난다(0→1) — 두 벌이 겹쳐 보이지 않는다.
   · 유니폼 · 토큰 크기는 한가운데(u .5)에서 한 번 — 사라지는 토큰은 앞 장 색, 나타나는 토큰은 다음 장 색으로 보인다.
   · 잔상은 경계에서 새로 시작한다. «전환: 페이드»는 잇지 않고 모두 사라지고 나타난다. 표지에서 나올 때는 표지 밑의 판을 잇지 않는다.
   판(스냅)은 보간용 사본만 만든다 — 슬라이드 원문 · 작업 보드 페이지는 건드리지 않는다(3.136).
   board.html 이 경계를 알린다: go · meetStep(PSMeetSlide.edge) · exportMeetingVideo(PSMeetSlide.edges). 이 모듈은 window.renderInterp 를 감싼다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSMeetSlide=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var KIT=['teamColors','teamColor2','teamPattern','teamStrokeC','teamTxtC','teamKit','gkColors','gkColor2','gkPattern','gkStrokeC','gkTxtC'];
  var LATE=KIT.concat(['tokenScale','tokV']);   // 한가운데에서 다음 장 값으로 바뀌는 겉모습
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
  function sid(id){return String(id);}
  /* 같은 선수의 열쇠 — 팀 · 역할 · 번호. 리저브(meetingRole)와 선발은 같은 번호여도 다른 선수다(3.2xx 리저브 — 이름도 따로) */
  function key(p){
    if(!p||p.id==null)return null;
    var role=p.coach?'c':(p.meetingRole==='reserve'?'r':''),n=p.num==null?'':String(p.num).trim();
    return String(p.team||'')+'|'+role+'|'+(n?'#'+n:'@'+sid(p.id));
  }
  function ekey(e){return e&&e.id!=null?'e|'+String(e.team||'')+'|'+sid(e.id):null;}   // 장비는 같은 종류 · 같은 id 만
  function match(listA,listB,kf,off){
    var bucket={},out=[];
    if(!off)listB.forEach(function(q,j){var k=kf(q);if(k!=null)(bucket[k]||(bucket[k]=[])).push(j);});
    listA.forEach(function(p,i){var k=off?null:kf(p),l=k!=null?bucket[k]:null;out[i]=(l&&l.length)?l.shift():-1;});
    return out;
  }
  /* a → b 경계의 보간 재료. 돌려주는 a · aLate · bEarly 는 사본, b 쪽 토큰 id 는 그대로(끝 프레임이 원문 id 와 같게).
     out / inn = 사라질 · 나타날 토큰 id(문자열) */
  function align(a,b,mode,o){
    a=a||{};b=b||{};o=o||{};
    var fade=mode==='fade',blank=!!o.blank,A=Object.assign({},a),B=Object.assign({},b);
    A.players=blank?[]:clone(a.players||[]);A.equipment=blank?[]:clone(a.equipment||[]);A.ball=blank?null:clone(a.ball||null);
    var bp=(b.players||[]).slice(),be=(b.equipment||[]).slice(),used={},taken={},map={},out={},inn={},fresh=0;
    bp.concat(be).forEach(function(q){if(q&&q.id!=null)used[sid(q.id)]=1;});
    var mp=match(A.players,bp,key,fade),me=match(A.equipment,be,ekey,fade),sets=[[A.players,mp,bp],[A.equipment,me,be]],bHit=[{},{}];
    // 1) 이어지는 토큰은 다음 장의 id 를 쓴다
    sets.forEach(function(t,s){t[0].forEach(function(p,i){var j=t[1][i];if(!p||j<0)return;var q=t[2][j];if(p.id!=null&&!(sid(p.id) in map))map[sid(p.id)]=q.id;p.id=q.id;taken[sid(q.id)]=1;bHit[s][j]=1;delete p.trail;});});
    // 2) 이어지지 않는 토큰 — 다음 장 id 와 겹치면 음수 새 id(실제 id 는 늘 양수 · 'ball')
    sets.forEach(function(t){t[0].forEach(function(p,i){if(!p||t[1][i]>=0)return;var s=sid(p.id);
      if(p.id==null||used[s]||taken[s]){var n;do{n=-(++fresh);}while(used[sid(n)]||taken[sid(n)]);if(p.id!=null&&!(s in map))map[s]=n;p.id=n;}
      taken[sid(p.id)]=1;out[sid(p.id)]=1;delete p.trail;delete p.vis;});});
    // 3) 다음 장 — 이어받지 않은 토큰은 나타난다. 잔상 · (나타나는 토큰의) 시야는 경계에서 그리지 않는다
    function bSide(list,hit){return list.map(function(q,j){if(!q)return q;if(!hit[j]&&q.id!=null)inn[sid(q.id)]=1;if(!q.trail&&(hit[j]||!q.vis))return q;var c=Object.assign({},q);delete c.trail;if(!hit[j])delete c.vis;return c;});}
    B.players=bSide(bp,bHit[0]);B.equipment=bSide(be,bHit[1]);
    if(A.ball)delete A.ball.trail;
    if(B.ball&&B.ball.trail){B.ball=Object.assign({},B.ball);delete B.ball.trail;}
    // 4) 앞 장 안의 참조(시선 · 토큰에 묶인 그림 끝)도 새 id 로
    A.players.forEach(function(p){if(p&&p.lookAt!=null&&(sid(p.lookAt) in map))p.lookAt=map[sid(p.lookAt)];});
    A.drawings=blank?[]:(a.drawings||[]).map(function(d){
      if(!d||!Array.isArray(d.tk)||!d.tk.some(function(id){return id!=null&&(sid(id) in map);}))return d;
      var c=Object.assign({},d);c.tk=d.tk.map(function(id){return id!=null&&(sid(id) in map)?map[sid(id)]:id;});return c;});
    var ballBoth=fade&&!!A.ball&&!!B.ball,late=Object.assign({},A);
    LATE.forEach(function(k){if(k in b)late[k]=b[k];else delete late[k];});
    if(ballBoth)late.ball=clone(B.ball);
    var ballOut=!!A.ball&&!B.ball,ballIn=!A.ball&&!!B.ball,anyOut=ballOut||ballBoth||Object.keys(out).length>0,anyIn=ballIn||ballBoth||Object.keys(inn).length>0;
    /* 한쪽만 바뀌고(사라지기만 · 나타나기만) 겉모습이 같으면 처음부터 끝까지 서서히 — 표지에서 나올 때 빈 판이 반 동안 보이지 않게 */
    var look=function(s){return JSON.stringify(LATE.map(function(k){return s[k]==null?null:s[k];}));},whole=!(anyOut&&anyIn)&&look(A)===look(b);
    return {a:A,aLate:late,b:B,bEarly:ballBoth?Object.assign({},B,{ball:clone(A.ball)}):B,out:out,inn:inn,
      ballOut:ballOut,ballIn:ballIn,ballBoth:ballBoth,whole:whole,mode:fade?'fade':'slide'};
  }
  function pick(al,u){var late=u>=0.5;return {a:late?al.aLate:al.a,b:late?al.b:al.bEarly};}
  function fades(al,u){
    var w=!!al.whole,o=Math.max(0,Math.min(1,w?1-u:1-2*u)),i=Math.max(0,Math.min(1,w?u:2*u-1)),m={},k;
    for(k in al.out)m[k]=o;for(k in al.inn)m[k]=i;
    if(al.ballOut)m.ball=o;if(al.ballIn)m.ball=i;if(al.ballBoth)m.ball=u<0.5?o:i;
    return m;
  }
  /* 경계 기록 — 보간에 넘기는 바로 그 두 판(객체)을 열쇠로. 장면 사이 보간은 기록이 없어 그대로 간다 */
  var EDGES=typeof WeakMap==='function'?new WeakMap():null;
  function edge(a,b,mode,o){
    if(!EDGES||!a||!b||typeof a!=='object'||typeof b!=='object'||a===b)return null;
    var m=EDGES.get(a);if(!m){m=new WeakMap();EDGES.set(a,m);}
    var r={mode:mode==='fade'?'fade':'slide',o:o||{},al:null,started:false};m.set(b,r);return r;
  }
  function find(a,b){var m=EDGES&&a&&typeof a==='object'?EDGES.get(a):null;return m&&b&&typeof b==='object'?m.get(b)||null:null;}
  /* MP4(exportMeetingVideo 의 장면 목록): 다른 슬라이드의 첫 장면으로 넘어가는 칸만. 표지 칸(cut)은 원래 끊어 넘긴다 */
  function edges(seq){
    var n=0;(seq||[]).forEach(function(f,j){var g=seq[j+1];if(f&&g&&f.snap&&g.snap&&f.capNo!==g.capNo&&!g.cut&&edge(f.snap,g.snap,'slide'))n++;});
    return n;
  }
  function paint(doc,m){
    var L=doc&&doc.getElementById('tokenLayer');if(!L)return 0;var n=0;
    Array.prototype.forEach.call(L.children,function(g){
      var id=g.getAttribute&&g.getAttribute('data-id');if(id==null||!(id in m))return;
      var base=g.hasAttribute('opacity')?(+g.getAttribute('opacity')):1;if(!(base>=0))base=1;
      var v=base*m[id];if(v>=1)return;g.setAttribute('opacity',String(Math.max(0,Math.round(v*1000)/1000)));n++;
    });
    return n;
  }
  function install(win){
    if(!win||!win.document||win.__psMeetSlide)return false;
    var orig=win.renderInterp;if(typeof orig!=='function')return false;
    win.__psMeetSlide=true;
    var g=function(a,b,u,curves){
      var r=find(a,b);if(!r)return orig.apply(this,arguments);
      if(!r.al)r.al=align(a,b,r.mode,r.o);
      if(!r.started||u===0){r.started=true;try{win.__trailLive=0;}catch(_){}try{if(typeof win.trailReset==='function')win.trailReset();}catch(_){}}
      var p=pick(r.al,u),ret=orig.call(this,p.a,p.b,u,curves);
      try{paint(win.document,fades(r.al,u));}catch(_){}
      return ret;
    };
    g.__psMeetSlide=1;win.renderInterp=g;
    return true;
  }
  /* 화면에서 넘길 때(go · meetStep). 표지에서 나오면 표지 밑에 깔린 판은 잇지 않는다 — 표지(ps-meet-cover)는 넘긴 뒤 __ksRender 가 걷는다 */
  function live(a,b,mode){
    var d=typeof document!=='undefined'?document:null,cover=!!(d&&d.body&&d.body.classList.contains('ps-meet-cover'));
    return edge(a,b,mode,{blank:cover});
  }
  return {key:key,align:align,pick:pick,fades:fades,edge:edge,edges:edges,live:live,find:find,paint:paint,install:install,KIT:KIT};
});
