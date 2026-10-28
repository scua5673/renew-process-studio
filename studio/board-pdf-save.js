/* 3.204 — PDF 저장 위치(사용자 10/28 «보관함에서 훈련 만들고 PDF 로 내보내기 했을 때 내가 원하는 폴더에 넣을 수 있게 — 원래 됐는데 다시 바뀜»).
   작전판의 PDF 둘(장면 막대 «내보내기 ▾ › PDF» _ppbSavePdf · 위쪽 막대 «내보내기 › PDF» board-quick-export.js)은 2.898 `_ppbPickSaveTarget` 로
   «다른 이름으로 저장» 창(크롬 · 엣지 데스크톱)을 먼저 연다. 그 밖에서는 말없이 다운로드 폴더로 갔다:
   ① 아이폰 · 아이패드 사파리(저장 창 없음) — 영상 · GIF 의 2.972 진행 카드처럼 다 만든 뒤 «파일에 저장»(공유 시트 › 파일에 저장 = 폴더 고르기)을 준다.
   ② 저장 창이 있는데 열지 못한 때(AbortError 아님) — 까닭을 말하고(알림) ps_events `pdf_picker_failed` 에 오류 이름만 남긴다 — 왜 «갑자기» 안 되는지 보려고.
   `_ppbPickSaveTarget` 은 본문의 function 선언이라 window 속성을 바꾸면 안쪽 호출도 이것을 쓴다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPdfSave=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function iosShare(win){try{var n=win.navigator||{};return typeof win.showSaveFilePicker!=='function'&&(n.maxTouchPoints||0)>1&&/iPhone|iPad|iPod|Macintosh/.test(n.userAgent||'')&&typeof n.share==='function';}catch(_){return false;}}
  function toast(win,m){try{if(typeof win.toast==='function')win.toast(m);}catch(_){}}
  function record(win,e){var S=null;try{S=win.PSSync||(win.parent&&win.parent.PSSync);}catch(_){}
    try{if(S&&typeof S.event==='function')S.event('pdf_picker_failed',{status:'error',feature:'board',error_code:String(e&&e.name||'Error').slice(0,40),meta:{msg:String(e&&e.message||'').slice(0,80)}});}catch(_){}}
  /* 공유 시트용 가짜 저장 손잡이 — 쓰기(write)는 모아 두고 닫을 때(close) 진행 카드의 «파일에 저장»을 띄운다. 호출 쪽(createWritable → write → close)은 그대로. */
  function shareTarget(win,name){
    var saved=null;
    return {name:name,psShare:true,createWritable:function(){return Promise.resolve({
      write:function(b){saved=b;return Promise.resolve();},
      close:function(){var P=win.__psExpProg;
        if(saved&&P&&typeof P.offer==='function')P.offer(saved,name,'application/pdf');
        else if(saved){var a=win.document.createElement('a');a.href=win.URL.createObjectURL(saved);a.download=name;win.document.body.appendChild(a);a.click();a.remove();}
        return Promise.resolve();}});}};
  }
  function pick(win,name){
    if(typeof win.showSaveFilePicker!=='function')return Promise.resolve(iosShare(win)?shareTarget(win,name):null);
    return Promise.resolve().then(function(){return win.showSaveFilePicker({suggestedName:name,types:[{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}]});})
      .then(function(h){return h;},function(e){if(e&&e.name==='AbortError')return false;record(win,e);toast(win,'저장 위치 창을 열지 못해 다운로드 폴더에 받아요'+(e&&e.name?' ('+e.name+')':''));return null;});
  }
  function mount(win){
    if(!win||win.__psPdfSave)return;win.__psPdfSave=true;
    win._ppbPickSaveTarget=function(name){return pick(win,name);};
  }
  return {iosShare:iosShare,shareTarget:shareTarget,pick:pick,mount:mount};
});
/* 본문 스크립트(_ppbPickSaveTarget 의 function 선언)가 이 태그 뒤에 돌며 window 속성을 다시 세운다 — DOMContentLoaded 에야 바꾼다(3.141 board-shape-menu 와 같은 함정). */
if(typeof window!=='undefined'&&window.PSPdfSave){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){window.PSPdfSave.mount(window);});else window.PSPdfSave.mount(window);}
