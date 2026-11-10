/* «학습» 끄기(사용자 «학습은 빼자») — 되돌리려면 아래 한 줄을 true 로.
   learning.html · learn-*.js 는 그대로 둔다. 이 모듈은 문(단추 · 링크 · 신호)만 걷는다.
   · 셸: #appSeg 의 [data-app="learning"] · 팀 더보기의 [data-tb-app="learning"] 을 DOM 에서 뗀다
     (mobile-navigation.js 는 PS_LEARNING_ENABLED 를 읽어 다섯 칸으로 그린다).
   · 게임모델의 «학습에서 보기»(셸 #psGmLearnNote · gamemodel.html .gm-toline)는 숨긴다.
   · 학습을 여는 신호(openLearnArea owner:'learn' · source:'learning')는 셸 처리기보다 먼저 삼킨다.
   · 그래도 학습 화면이 열리면(세션 복귀 · 옛 딥링크) 작전판으로 돌린다. */
var PS_LEARNING_ENABLED=false;
(function(win){
  'use strict';
  win.PS_LEARNING_ENABLED=PS_LEARNING_ENABLED;
  if(PS_LEARNING_ENABLED)return;
  var doc=win.document;
  var FRAME_CSS='.gm-toline{display:none!important}';
  var SHELL_CSS='#appSeg [data-app="learning"],[data-tb-app="learning"],[data-am-app="learning"],#psGmLearnNote,#fLearning{display:none!important}';
  function css(d,text){
    try{
      if(!d||!d.documentElement||d.getElementById('psLearningOff'))return;
      var st=d.createElement('style');st.id='psLearningOff';st.textContent=text;
      (d.head||d.documentElement).appendChild(st);
    }catch(_){}
  }
  function isLearnMessage(d){
    if(!d||typeof d!=='object')return false;
    if(d.source==='learning')return true;
    return d.type==='openLearnArea'&&d.owner==='learn';
  }
  function board(){
    try{
      if(doc.body&&doc.body.getAttribute('data-ps-app')==='learning'&&win.__psShowApp)win.__psShowApp('board');
    }catch(_){}
  }
  function frame(f){
    function go(){try{css(f.contentDocument,FRAME_CSS);}catch(_){}}
    f.addEventListener('load',go);go();
  }
  function mount(){
    [].forEach.call(doc.querySelectorAll('#appSeg [data-app="learning"],[data-tb-app="learning"],[data-am-app="learning"]'),function(b){if(b.parentNode)b.parentNode.removeChild(b);});
    var gm=doc.getElementById('fGameModel');if(gm)frame(gm);
    try{sessionStorage.getItem('ps_resume_screen')&&/"app":"learning"/.test(sessionStorage.getItem('ps_resume_screen'))&&sessionStorage.removeItem('ps_resume_screen');}catch(_){}
    if(doc.body&&win.MutationObserver){
      new win.MutationObserver(board).observe(doc.body,{attributes:true,attributeFilter:['data-ps-app']});
      board();
    }
  }
  doc.documentElement.classList.add('ps-learning-off');
  css(doc,SHELL_CSS);
  /* storage.js 의 출처 막이 다음 · 셸 처리기보다 먼저 듣는다(이 파일은 storage.js 바로 뒤에 싣는다) */
  win.addEventListener('message',function(e){
    if(e.origin!==win.location.origin||!isLearnMessage(e.data))return;
    e.stopImmediatePropagation();
  });
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
  win.PSLearningOff={isLearnMessage:isLearnMessage};
})(window);
