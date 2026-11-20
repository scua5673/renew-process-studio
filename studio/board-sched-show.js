/* 3.329 — 일정 줄의 ▶ 가 작전판(보관함 type:"board")이면 보기 전용 슬라이드쇼로 연다(제보 5d215b74 · 10/20 bf084b34 에 한 약속).
   일정(process.html)은 훈련 ▶ 와 같은 문(openDrillEditor · readonly · play · reason 'anim')을 두드리고, 셸은 그대로 `__openScheduleDrillView` 를 부른다.
   그 첫 줄이 여기(route)를 묻는다 — 보관함에서 자료를 찾아 작전판이면 맡고, 훈련 · 세트피스 · 못 찾음은 예전 길(openLibDrawEditor)로 돌려보낸다.
   여는 길은 3.031 경기 준비 «▶ 슬라이드쇼»와 같다: 페이지를 장으로(장면 그대로 — `__meetSlidesFromBoard`) 한 **보기 전용 미팅**.
     · 보관함에 아무것도 쓰지 않는다(보기 전용이라 __curVaultId 없음 · 자동 저장 멈춤).
     · 작업 보드를 빌리지 않는다(미팅은 vaultBoardBegin 을 거치지 않고, 작업 보드 라이브 저장은 미팅 화면을 «빌린 보기»로 건너뛴다 — board-draft.js borrowedView).
   고른 줄의 페이지(idx)부터 보이고, 쇼(전체 화면 focus-board)가 끝나면 보기를 닫고 일정으로 돌아간다(captureCancel — 훈련 ▶ 를 닫을 때와 같은 문). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSSchedBoardShow=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var diag=[];
  function note(e){ diag.push(String((e&&e.message)||e).slice(0,160)); if(diag.length>20)diag.shift(); }
  function find(lib,id){ lib=Array.isArray(lib)?lib:[]; for(var i=0;i<lib.length;i++){ var d=lib[i]; if(d&&d.libId===id)return d; } return null; }
  function say(w,msg){ try{ if(typeof w.toast==='function')w.toast(msg); }catch(e){ note(e); } }
  function back(w,close){
    if(close){ try{ var c=w.document.getElementById('vCreateCancel'); if(c&&w.__vaultViewMode)c.click(); }catch(e){ note(e); } }
    try{ w.parent.postMessage({source:'board',type:'captureCancel'},'*'); }catch(e){ note(e); }
  }
  /* 쇼가 시작(focus-board 켜짐)된 뒤 끝나면(꺼짐) 한 번만 돌아간다. 6초 안에 쇼가 안 서면 지켜보기만 그만둔다(보기는 그대로 — 닫으면 보관함). */
  function watch(w,onShown){
    var body=w.document.body,seen=false,done=false,mo=null;
    function stop(){ done=true; w.__psSchedShowOn=false; if(mo){ mo.disconnect(); mo=null; } }
    try{
      mo=new w.MutationObserver(function(){
        if(done)return;
        if(body.classList.contains('focus-board')){ seen=true; if(onShown){ var f=onShown; onShown=null; w.setTimeout(f,700); } return; }
        if(!seen)return;
        stop(); back(w,true);
      });
      mo.observe(body,{attributes:true,attributeFilter:['class']});
    }catch(e){ note(e); }
    w.__psSchedShowOn=true;
    w.setTimeout(function(){ if(!seen&&!done)stop(); },6000);
  }
  function show(w,d,idx){
    var slides=[];
    try{ slides=(typeof w.__meetSlidesFromBoard==='function')?(w.__meetSlidesFromBoard(d)||[]):[]; }catch(e){ note(e); }
    if(!slides.length||typeof w.__psVaultOpenItem!=='function'){ say(w,'이 자료를 보관함에서 찾지 못했습니다 — 지워졌거나 아직 이 기기에 오지 않았습니다'); back(w,false); return false; }
    if(!(idx>=0&&idx<slides.length))idx=0;
    try{ w.__psVaultOpenItem({type:'meeting',name:d.name||'작전판',slides:slides,__showOf:d.libId},true); }catch(e){ note(e); }
    if(!(w.__vaultViewMode&&w.__vvMeetLib===d.libId)){ back(w,false); return false; }   // 열리지 않았다(로그인 · 보관함 잠김) — 일정 그대로
    say(w,'애니메이션 보기 — 고치려면 보관함에서');
    /* ▶ 로 왔으니 그 페이지의 장면을 바로 재생한다 — 쇼의 «↻ 다시»(#meetReplay — 장면 1 부터 끝까지 스스로 넘김, 키를 누르면 멈춤)를 한 번.
       쇼가 선 순간(focus-board)에서 장 넘김(450ms)이 끝나 그 장의 장면이 묶인 뒤에 — 고정 시간으로 누르면 늦게 서는 쇼(느린 기기)보다 먼저 와 헛누름이 된다.
       장면이 하나뿐인 장은 그 단추가 아무것도 안 한다. */
    watch(w,function(){
      try{ var r=w.document.getElementById('meetReplay'); if(r&&w.__vvMeetLib===d.libId&&w.document.body.classList.contains('focus-board'))r.click(); }catch(e){ note(e); }
    });
    w.setTimeout(function(){
      try{ var m=w.__meet; if(!m||w.__vvMeetLib!==d.libId)return; if(idx>0){ m.go(idx,'first'); m.show(false); } else m.show(true); }catch(e){ note(e); }
    },320);
    return true;
  }
  /* `__openScheduleDrillView(p)` 첫 줄 — 맡으면 true(그 함수는 바로 돌아간다). 작전판이 아니면 p.__psTyped 를 달아 같은 함수를 다시 부른다. */
  function route(w,p){
    if(!w||!p||p.__psTyped||p.reason!=='anim'||!p.libId||typeof w.libGet!=='function')return false;
    function again(){ p.__psTyped=1; try{ w.__openScheduleDrillView(p); }catch(e){ note(e); } }
    Promise.resolve().then(function(){ return w.libGet(); }).then(function(lib){
      var d=find(lib,p.libId);
      if(!d||(d.type||'train')!=='board'){ again(); return; }
      show(w,d,parseInt(p.libIdx,10)||0);
    },function(e){ note(e); again(); });
    return true;
  }
  return {route:route,show:show,find:find,diag:function(){ return diag.slice(); }};
});
