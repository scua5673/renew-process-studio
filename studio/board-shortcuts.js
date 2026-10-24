/* 3.143 — 보드 단축키 표에 등록한다. 저장·키 충돌·입력 중 보호는 기존 편집기가 맡는다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSBoardShortcuts=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var actions={pitchPhoto:'운동장 사진 고르기',pageAdd:'새 페이지 추가',pagePrev:'이전 페이지',pageNext:'다음 페이지'};
  function run(w,id){
    if(!Object.prototype.hasOwnProperty.call(actions,id))return false;
    var d=w.document,b=d.body,p=w.__psPages,view=w.__csView||'board';
    if(!b||w.__animExport||w.__psThumbCapturing||w.__vaultReadOnly||b.classList.contains('comm-viewing')||b.classList.contains('ps-capturing'))return true;
    if(id==='pitchPhoto'){
      if((view==='board'||view==='session')&&w.PSPitchPhoto)w.PSPitchPhoto.pick();
      return true;
    }
    // 미팅·훈련 편집·패턴북은 각자 페이지를 소유한다. 작업 보드 묶음에 닿지 않는다.
    if(view!=='board'||b.classList.contains('meet-mode')||b.classList.contains('editing')||w.__vaultBook||!p||(p.lent&&p.lent()))return true;
    if(id==='pageAdd'){
      var add=d.getElementById('bpAddPage');
      if(add&&!add.disabled&&add.getClientRects().length)add.click();
    }else if(p.pageNav)p.pageNav(id==='pagePrev'?-1:1);
    return true;
  }
  var animActions={animFirst:'맨 처음 장면',animLast:'맨 마지막 장면'};
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',function(){
    var previous=runAnimAct;runAnimAct=function(id){
      if(id!=='animFirst'&&id!=='animLast')return previous.apply(this,arguments);
      if(!anim.frames.length)return; if(animPlaying)stopAnim();
      selectAnimFrame(id==='animFirst'?0:anim.frames.length-1,true);
    };
  });
  return {actions:actions,animActions:animActions,defaults:{animFirst:'home',animLast:'end'},run:run};
});
