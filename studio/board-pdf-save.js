/* 3.204 — PDF 저장 위치(사용자 10/28 «보관함에서 훈련 만들고 PDF 로 내보내기 했을 때 내가 원하는 폴더에 넣을 수 있게 — 원래 됐는데 다시 바뀜»).
   작전판의 PDF 둘(장면 막대 «내보내기 ▾ › PDF» _ppbSavePdf · 위쪽 막대 «내보내기 › PDF» board-quick-export.js)은 2.898 `_ppbPickSaveTarget` 로
   «다른 이름으로 저장» 창(크롬 · 엣지 데스크톱)을 먼저 연다. 그 밖에서는 말없이 다운로드 폴더로 갔다:
   ① 아이폰 · 아이패드 사파리(저장 창 없음) — 영상 · GIF 의 2.972 진행 카드처럼 다 만든 뒤 «파일에 저장»(공유 시트 › 파일에 저장 = 폴더 고르기)을 준다.
   ② 저장 창이 있는데 열지 못한 때(AbortError 아님) — 까닭을 말하고(알림) ps_events `pdf_picker_failed` 에 오류 이름만 남긴다 — 왜 «갑자기» 안 되는지 보려고.
   3.205 — 그 기록이 답했다: 맥 크롬 «File picker already active»(NotAllowedError). 저장 창이 뜨는 사이 «PDF 내려받기»를 한 번 더 누르면
   크롬이 두 번째 창을 거절하고, 그 거절을 «저장 창 없음»으로 읽어 다운로드 폴더로 보냈다 — 영상의 2.974(«맥에서 저장 창이 두 번»)와 같은 구멍.
   저장 창은 한 번에 하나(`picking`): 열려 있는 동안의 호출은 «취소»로 치고(아무것도 받지 않음), 크롬의 «이미 열림» 거절도 같이 — 알림만.
   `_ppbSavePdf` 를 감싸 저장 창이 떠 있는 동안 «PDF 내려받기» 단추를 잠근다(본문은 창이 닫힌 뒤에야 잠갔다).
   `_ppbPickSaveTarget` · `_ppbSavePdf` 는 본문의 function 선언이라 window 속성을 바꾸면 안쪽 호출도 이것을 쓴다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPdfSave=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var BUSY='저장 창이 이미 열려 있어요 — 그 창에서 폴더를 고르세요';
  function iosShare(win){try{var n=win.navigator||{};return typeof win.showSaveFilePicker!=='function'&&(n.maxTouchPoints||0)>1&&/iPhone|iPad|iPod|Macintosh/.test(n.userAgent||'')&&typeof n.share==='function';}catch(_){return false;}}
  function toast(win,m){try{if(typeof win.toast==='function')win.toast(m);}catch(_){}}
  function record(win,e){var S=null;try{S=win.PSSync||(win.parent&&win.parent.PSSync);}catch(_){}
    try{if(S&&typeof S.event==='function')S.event('pdf_picker_failed',{status:'error',feature:'board',error_code:String(e&&e.name||'Error').slice(0,40),meta:{msg:String(e&&e.message||'').slice(0,80)}});}catch(_){}}
  function alreadyOpen(e){return !!(e&&e.name==='NotAllowedError'&&/activ/i.test(String(e.message||'')));}
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
  function picking(win){return !!(win&&win.__psPdfPicking);}
  function pick(win,name){
    if(typeof win.showSaveFilePicker!=='function')return Promise.resolve(iosShare(win)?shareTarget(win,name):null);
    if(picking(win)){toast(win,BUSY);return Promise.resolve(false);}
    win.__psPdfPicking=true;
    return Promise.resolve().then(function(){return win.showSaveFilePicker({suggestedName:name,types:[{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}]});})
      .then(function(h){win.__psPdfPicking=false;return h;},function(e){win.__psPdfPicking=false;
        if(e&&e.name==='AbortError')return false;
        if(alreadyOpen(e)){toast(win,BUSY);return false;}
        record(win,e);toast(win,'저장 위치 창을 열지 못해 다운로드 폴더에 받아요'+(e&&e.name?' ('+e.name+')':''));return null;});
  }
  /* 저장 창이 떠 있는 동안 «PDF 내려받기»(#ppbSave)를 잠근다 — 본문 _ppbSavePdf 는 창이 닫힌 뒤에야 잠갔다. 끝나면(취소 포함) 본문과 같은 모양으로 되돌린다. */
  function wrapSave(win){
    var orig=win._ppbSavePdf;if(typeof orig!=='function'||orig.__psPdfSave)return;
    function wrapped(){
      var b=null;try{b=win.document.getElementById('ppbSave');}catch(_){}
      if(b&&b.disabled)return Promise.resolve();
      if(b){b.disabled=true;b.textContent='저장 위치 고르는 중…';}
      function done(){if(b){b.disabled=false;b.textContent='PDF 내려받기';}}
      var r;try{r=orig.apply(this,arguments);}catch(e){done();throw e;}
      return Promise.resolve(r).then(function(v){done();return v;},function(e){done();throw e;});
    }
    wrapped.__psPdfSave=true;win._ppbSavePdf=wrapped;
  }
  function mount(win){
    if(!win||win.__psPdfSave)return;win.__psPdfSave=true;
    win._ppbPickSaveTarget=function(name){return pick(win,name);};
    wrapSave(win);
  }
  return {iosShare:iosShare,shareTarget:shareTarget,pick:pick,mount:mount,alreadyOpen:alreadyOpen,BUSY:BUSY};
});
/* 본문 스크립트(_ppbPickSaveTarget 의 function 선언)가 이 태그 뒤에 돌며 window 속성을 다시 세운다 — DOMContentLoaded 에야 바꾼다(3.141 board-shape-menu 와 같은 함정). */
if(typeof window!=='undefined'&&window.PSPdfSave){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){window.PSPdfSave.mount(window);});else window.PSPdfSave.mount(window);}
