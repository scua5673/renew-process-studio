/* 3.294 — 팀을 넷보다 많이(제보 29c97fc5 «팀 5, 팀 6 등 제한 없이» · 사용자 11/15 «팀 많이 추가할수 있게 해줘»).
   팀 목록 한 곳: 키 · 번호 · 기본 색 · 골키퍼 색 · 글자 색. 작전판 본문(색 표 · 팀 알약 · 불러오기) · 유니폼 창(board-kit.js) · 떠 있는 도크(board-dock-float.js)가 여기서 읽는다.
   · 앞의 넷(blue · red · yellow · green)은 예전 값 그대로 — 저장본의 팀 키도 색도 바뀌지 않는다. `pink` 은 색 표에만 남아 있던 옛 다섯째 팀이라 그대로 팀 5.
   · 화면: 팀 알약은 쓰는 만큼만 — 넷 + 판(장면 · 다른 페이지 포함)에 놓인 가장 큰 번호까지 + 이번에 «＋»로 꺼낸 팀. 저장하는 것 없음(새 키 · 새 칸 없음).
     안 쓰는 알약은 숨기지 않고 떼어 둔다 — 떠 있는 도크의 `#benchCat .tpill{display:flex!important}` 가 hidden 을 이긴다. 본문은 알약 열을 한 번만 잡으므로(pills)
     추가 알약은 본문보다 먼저(이 스크립트가 읽힐 때) 만들어 두고, DOMContentLoaded 에 안 쓰는 것을 뗀다.
   · 오른쪽 팀(기본 방향 · 불러오기 구석)은 짝수 번호 — 팀 2 · 4 가 원래 그랬다. */
/* global state, anim */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSTeams=api;try{api.install(root);}catch(_){}}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* [키, 기본 색, 골키퍼 색, 번호 글자 색] */
  var LIST=[['blue','#1a2f5c','#3aa6dc','#ffffff'],['red','#d12f38','#d4a017','#ffffff'],['yellow','#eeff00','#10b981','#1c1300'],['green','#34a56f','#d4a017','#ffffff'],
    ['pink','#e0569f','#8e2a55','#ffffff'],['orange','#f26b1d','#14213d','#ffffff'],['purple','#7c3aed','#d4a017','#ffffff'],['sky','#6cc4ee','#1a2f5c','#14161a'],
    ['white','#ffffff','#d4a017','#14161a'],['black','#1a1a1a','#d4a017','#ffffff']];
  var BASE=4,MAX=LIST.length,KEYS=[],NO={},COL={},GK={},TXT={};
  LIST.forEach(function(t,i){KEYS.push(t[0]);NO[t[0]]=i+1;COL[t[0]]=t[1];GK[t[0]]=t[2];TXT[t[0]]=t[3];});
  function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function has(k){return typeof k==='string'&&own(NO,k);}
  function no(k){return has(k)?NO[k]:0;}
  function name(k){var n=no(k);return n?'팀 '+n:'';}
  function right(k){var n=no(k);return n>0&&n%2===0;}
  /* 색 표에 없는 팀만 채운다 — 본문의 값(앞의 넷 · pink)은 건드리지 않는다 */
  function fill(col,gk,txt){[[col,COL],[gk,GK],[txt,TXT]].forEach(function(p){var to=p[0];if(to&&typeof to==='object')KEYS.forEach(function(k){if(to[k]==null)to[k]=p[1][k];});});return col;}
  /* 저장 팀 불러오기의 대기 줄 첫 칸: 팀 1 · 2 는 첫 줄, 3 · 4 는 둘째 줄, 5 · 6 은 셋째 줄 … (짝수 팀은 반대쪽 구석이라 한 줄을 둘이 쓴다) */
  function benchFrom(k){var n=no(k);return n>2?16*Math.ceil((n-2)/2):0;}
  function scan(players,m){if(Array.isArray(players))for(var i=0;i<players.length;i++){var p=players[i],n=p&&has(p.team)?NO[p.team]:0;if(n>m)m=n;}return m;}
  /* 판에서 쓰는 가장 큰 팀 번호 — 지금 장면 · 이 페이지의 다른 장면 · 다른 페이지의 대표 판 */
  function used(st,an,pages){
    var m=scan(st&&st.players,0);
    if(an&&Array.isArray(an.frames))an.frames.forEach(function(f){m=scan(f&&f.snap&&f.snap.players,m);});
    if(Array.isArray(pages))pages.forEach(function(p){m=scan(p&&p.snap&&p.snap.players,m);});
    return m;
  }
  function countOf(usedMax,revealed,selected){return Math.min(MAX,Math.max(BASE,usedMax|0,revealed|0,no(selected)));}

  /* ── 작전판 ── */
  var W=null,doc=null,pills={},addBtn=null,revealed=0;
  function boardState(){try{return typeof state!=='undefined'?state:null;}catch(_){return null;}}
  function boardAnim(){try{return typeof anim!=='undefined'?anim:null;}catch(_){return null;}}
  function selected(){try{return W&&W.__getBenchCat2?W.__getBenchCat2():'';}catch(_){return '';}}
  function count(){
    if(!W)return BASE;var pages=null;try{pages=W.__psPages&&W.__psPages.pg?W.__psPages.pg():null;}catch(_){}
    return countOf(used(boardState(),boardAnim(),pages),revealed,selected());
  }
  function shown(){return KEYS.slice(0,count());}
  function pill(k){
    var b=doc.createElement('button');b.className='catpill tpill';b.setAttribute('data-cat',k);b.style.background=COL[k];b.style.color=TXT[k];
    b.title=name(k)+' 선수 팔레트';b.setAttribute('aria-label',name(k)+' 선택');b.setAttribute('aria-pressed','false');b.textContent=String(NO[k]);return b;
  }
  /* 본문보다 먼저: 추가 알약을 팀 4 알약 뒤에 만들어 둔다(본문의 한 번뿐인 querySelectorAll('.tpill') 에 잡히게) */
  function addPills(){
    var bc=doc.getElementById('benchCat');if(!bc)return false;
    var last=null;[].forEach.call(bc.querySelectorAll('.tpill'),function(p){var k=p.getAttribute('data-cat');if(has(k)){pills[k]=p;last=p;}});
    if(!last)return false;
    KEYS.slice(BASE).forEach(function(k){if(pills[k])return;var b=pill(k);bc.insertBefore(b,last.nextSibling);pills[k]=b;last=b;});
    return true;
  }
  function label(){
    KEYS.forEach(function(k){var p=pills[k];if(p){p.setAttribute('data-df-label',name(k));p.setAttribute('data-df-n',String(NO[k]));}});
    try{if(W.__psDfLabelChips)W.__psDfLabelChips();}catch(_){}
    try{if(W.__psKitDecorate)W.__psKitDecorate();}catch(_){}
  }
  function refresh(){
    var bc=doc&&doc.getElementById('benchCat');if(!bc)return BASE;
    var n=count(),changed=false,ref=addBtn&&addBtn.parentNode===bc?addBtn:null;
    if(!ref){var lastBase=pills[KEYS[BASE-1]];ref=lastBase&&lastBase.parentNode===bc?lastBase.nextSibling:null;
      while(ref&&ref.classList&&ref.classList.contains('tpill'))ref=ref.nextSibling;}
    KEYS.slice(BASE).forEach(function(k,i){var p=pills[k];if(!p)return;
      if(BASE+i<n){if(p.parentNode!==bc){bc.insertBefore(p,ref);changed=true;}}
      else if(p.parentNode){p.parentNode.removeChild(p);changed=true;}});
    if(addBtn){
      if(n<MAX){if(addBtn.parentNode!==bc){bc.insertBefore(addBtn,ref&&ref!==addBtn?ref:null);changed=true;}
        var nx=name(KEYS[n]);if(addBtn.getAttribute('data-next')!==nx){addBtn.setAttribute('data-next',nx);addBtn.title=nx+' 추가';addBtn.setAttribute('aria-label',nx+' 추가');}}
      else if(addBtn.parentNode){addBtn.parentNode.removeChild(addBtn);changed=true;}
    }
    if(changed)label();
    return n;
  }
  function reveal(){
    var n=count();if(n>=MAX)return '';
    revealed=n+1;var k=KEYS[n];refresh();
    try{if(W.__setBenchCat)W.__setBenchCat(k);}catch(_){}
    return k;
  }
  function mount(win){
    if(!win||!win.document)return false;W=win;doc=win.document;
    var bc=doc.getElementById('benchCat'),orig=win.syncTeamDots;
    if(!bc||typeof orig!=='function'||orig.__psTeams)return false;
    addPills();
    addBtn=doc.createElement('button');addBtn.type='button';addBtn.className='catpill tpill ps-team-add';addBtn.textContent='＋';
    addBtn.setAttribute('data-df-n','＋');addBtn.setAttribute('data-df-label','팀 추가');
    addBtn.style.cssText='background:transparent;color:inherit;box-shadow:inset 0 0 0 1.5px currentColor;opacity:.72';
    addBtn.style.setProperty('--df-kit','rgba(127,127,127,.16)');addBtn.style.setProperty('--df-kit-ink','currentColor');
    addBtn.addEventListener('click',function(e){e.stopPropagation();reveal();});
    var wrapped=function(){var r=orig.apply(this,arguments);try{refresh();}catch(_){}return r;};wrapped.__psTeams=true;win.syncTeamDots=wrapped;
    refresh();label();
    return true;
  }
  function install(win){
    if(!win||!win.document)return;W=win;doc=win.document;
    addPills();
    doc.addEventListener('DOMContentLoaded',function(){try{mount(win);}catch(_){}});
  }
  return {BASE:BASE,MAX:MAX,KEYS:KEYS,NO:NO,COL:COL,GK:GK,TXT:TXT,has:has,no:no,name:name,right:right,fill:fill,benchFrom:benchFrom,used:used,countOf:countOf,
    count:count,shown:shown,refresh:refresh,reveal:reveal,mount:mount,install:install};
});
