/* 3.204 — PDF 저장 위치(사용자 10/28 «보관함에서 훈련 만들고 PDF 로 내보내기 했을 때 내가 원하는 폴더에 넣을 수 있게 — 원래 됐는데 다시 바뀜»).
   작전판의 PDF 둘(장면 막대 «내보내기 ▾ › PDF» _ppbSavePdf · 위쪽 막대 «내보내기 › PDF» board-quick-export.js)은 2.898 `_ppbPickSaveTarget` 로
   «다른 이름으로 저장» 창(크롬 · 엣지 데스크톱)을 먼저 연다. 그 밖에서는 말없이 다운로드 폴더로 갔다:
   ① 아이폰 · 아이패드 사파리(저장 창 없음) — 영상 · GIF 의 2.972 진행 카드처럼 다 만든 뒤 «파일에 저장»(공유 시트 › 파일에 저장 = 폴더 고르기)을 준다.
   ② 저장 창이 있는데 열지 못한 때(AbortError 아님) — 까닭을 말하고(알림) ps_events `pdf_picker_failed` 에 오류 이름만 남긴다 — 왜 «갑자기» 안 되는지 보려고.
   3.205 — 그 기록이 답했다: 맥 크롬 «File picker already active»(NotAllowedError). 저장 창이 뜨는 사이 «PDF 내려받기»를 한 번 더 누르면
   크롬이 두 번째 창을 거절하고, 그 거절을 «저장 창 없음»으로 읽어 다운로드 폴더로 보냈다 — 영상의 2.974(«맥에서 저장 창이 두 번»)와 같은 구멍.
   저장 창은 한 번에 하나(`picking`): 열려 있는 동안의 호출은 «취소»로 치고(아무것도 받지 않음), 크롬의 «이미 열림» 거절도 같이 — 알림만.
   `_ppbSavePdf` 를 감싸 저장 창이 떠 있는 동안 «PDF 내려받기» 단추를 잠근다(본문은 창이 닫힌 뒤에야 잠갔다).
   3.206 — 3.205 뒤 사용자 화면: 단추가 «저장 위치 고르는 중…»에서 멈추고 파인더 창은 안 뜬다(«저장 위치 고르는 중이 아니라 파인더가 나와야지»).
   크롬이 호출을 받고도 창을 안 보인 것 — 그래서 3.204 때 «이미 열림» 거절이 났다(보이지 않는 창이 걸려 있었다). 작전판은 iframe 안이라 창을
   iframe 창에 붙이다 놓친 것으로 보고 ① 같은 출처의 맨 위 창(`top.showSaveFilePicker`)에서 연다(사용자 동작은 조상 프레임에도 전해진다)
   ② 창이 떴으면 페이지가 초점을 잃는다(blur · hasFocus 거짓) — `SILENT_MS` 안에 그 신호가 없으면 «창이 안 뜸»으로 보고 다운로드 폴더로 받되
   까닭을 알리고(크롬 설정 › 다운로드 › «저장 위치 확인» 안내) `pdf_picker_failed` 에 `silent`(top · focus 여부)를 남긴다. 그 뒤 같은 창에서는
   다시 묻지 않고 바로 받는다(걸려 있는 창 때문에 «이미 열림»이 되풀이된다). 단추 잠금은 그 사이 풀린다.
   3.208 — 3.206 의 기록: 사용자 맥 설치 앱(standalone) 창에서 `silent`(top · focus 참) 둘(15:33 · 15:49 UTC). 맥의 저장 창은 창에 붙는 시트라 페이지가
   초점을 안 잃을 수 있다 — 2.5초 뒤 «안 뜸»으로 단정해 다운로드로 빠지면, 떠 있는 창에서 고른 폴더는 버려진다. 이제 감시 시간이 지나면 저절로 받지 않고
   «저장 창이 보이지 않나요?» 카드(#psPdfFallback — «다운로드 폴더로 받기» · «취소»)를 띄운 채 창을 계속 기다린다. 늦게라도 창이 답하면 그대로 쓰고
   `late` 를 기록(status ok — 맥에서 시트가 초점을 안 뺏는지 알려고), 사람이 «다운로드 폴더로 받기»를 누르면 그때 `silent` 를 기록하고 받는다. 카드가
   한 번 떴던 창(`__psPdfPickerWaited`)에서 크롬이 «이미 열림»으로 거절하면 걸린 창 때문이니 다운로드로. 시험 손잡이 `__psPdfFallback`.
   `_ppbPickSaveTarget` · `_ppbSavePdf` 는 본문의 function 선언이라 window 속성을 바꾸면 안쪽 호출도 이것을 쓴다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPdfSave=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var BUSY='저장 창이 이미 열려 있어요 — 그 창에서 폴더를 고르세요';
  var SILENT='다운로드 폴더에 받았어요 — 크롬 설정 › 다운로드 › «다운로드 전에 각 파일의 저장 위치 확인»을 켜면 폴더를 고를 수 있어요';
  var SILENT_MS=2500;
  var FB_TITLE='저장 창이 보이지 않나요?',FB_SUB='창이 떴으면 그 창에서 폴더를 고르세요. 크롬이 창을 열지 않으면 다운로드 폴더로 받을 수 있어요.',FB_DL='다운로드 폴더로 받기',FB_X='취소';
  function iosShare(win){try{var n=win.navigator||{};return typeof win.showSaveFilePicker!=='function'&&(n.maxTouchPoints||0)>1&&/iPhone|iPad|iPod|Macintosh/.test(n.userAgent||'')&&typeof n.share==='function';}catch(_){return false;}}
  function toast(win,m){try{if(typeof win.toast==='function')win.toast(m);}catch(_){}}
  function record(win,e,meta,status){var S=null;try{S=win.PSSync||(win.parent&&win.parent.PSSync);}catch(_){}
    var m={msg:String(e&&e.message||'').slice(0,80)};if(meta)for(var k in meta)m[k]=meta[k];
    try{if(S&&typeof S.event==='function')S.event('pdf_picker_failed',{status:status||'error',feature:'board',error_code:String(e&&e.name||'Error').slice(0,40),meta:m});}catch(_){}}
  /* «저장 창이 보이지 않나요?» 카드 — 창을 기다리는 동안만. DOM 이 없으면(단위 시험) 조용히 건너뛴다(손잡이 __psPdfFallback 은 그대로). */
  function prompt(win,onPick,onCancel){
    var el=null;
    try{
      var doc=win.document;el=doc.createElement('div');el.id='psPdfFallback';el.setAttribute('role','dialog');
      el.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;box-sizing:border-box;width:min(92vw,420px);padding:14px 16px;border-radius:14px;background:var(--pop-bg,#fff);color:var(--pop-fg,#17181c);border:1px solid var(--pop-line,rgba(0,0,0,.08));box-shadow:0 10px 32px rgba(0,0,0,.28);font:14px/1.45 Pretendard,system-ui,sans-serif';
      var t=doc.createElement('div');t.textContent=FB_TITLE;t.style.cssText='font-weight:700;font-size:15px;margin-bottom:4px';
      var sub=doc.createElement('div');sub.textContent=FB_SUB;sub.style.cssText='opacity:.78;font-size:13px;margin-bottom:10px';
      var row=doc.createElement('div');row.style.cssText='display:flex;gap:8px;justify-content:flex-end';
      var x=doc.createElement('button');x.type='button';x.setAttribute('data-pf','x');x.textContent=FB_X;x.style.cssText='font:inherit;padding:8px 12px;border-radius:10px;border:1px solid var(--pop-line,rgba(0,0,0,.12));background:transparent;color:inherit;cursor:pointer';
      var dl=doc.createElement('button');dl.type='button';dl.setAttribute('data-pf','dl');dl.textContent=FB_DL;dl.style.cssText='font:inherit;font-weight:700;padding:8px 12px;border-radius:10px;border:0;background:var(--pop-accent,#2563eb);color:#fff;cursor:pointer';
      x.addEventListener('click',function(ev){ev.preventDefault();onCancel();});dl.addEventListener('click',function(ev){ev.preventDefault();onPick();});
      row.appendChild(x);row.appendChild(dl);el.appendChild(t);el.appendChild(sub);el.appendChild(row);doc.body.appendChild(el);
    }catch(_){el=null;}
    return {close:function(){try{if(el&&el.remove)el.remove();}catch(_){}el=null;}};
  }
  function alreadyOpen(e){return !!(e&&e.name==='NotAllowedError'&&/activ/i.test(String(e.message||'')));}
  /* 같은 출처의 맨 위 창이 저장 창을 열 수 있으면 거기서 연다 — 작전판은 iframe 안이다 */
  function hostOf(win){try{var t=win.top;if(t&&t!==win&&typeof t.showSaveFilePicker==='function'&&t.document)return t;}catch(_){}return win;}
  function focused(w){try{return !!(w.document&&typeof w.document.hasFocus==='function'&&w.document.hasFocus());}catch(_){return true;}}
  function standalone(win){try{return !!(win.navigator&&win.navigator.standalone)||!!(win.matchMedia&&win.matchMedia('(display-mode: standalone)').matches);}catch(_){return false;}}
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
    if(win.__psPdfPickerSilent){toast(win,SILENT);return Promise.resolve(null);}
    if(picking(win)){toast(win,BUSY);return Promise.resolve(false);}
    win.__psPdfPicking=true;
    var host=hostOf(win),blurred=false,done=false,timer=null,ui=null,waited=false,t0=Date.now();
    function onBlur(){blurred=true;}
    function listen(on){try{win[on?'addEventListener':'removeEventListener']('blur',onBlur);if(host!==win)host[on?'addEventListener':'removeEventListener']('blur',onBlur);}catch(_){}}
    function finish(){done=true;win.__psPdfPicking=false;try{win.clearTimeout(timer);}catch(_){}listen(false);if(ui)ui.close();ui=null;win.__psPdfFallback=null;}
    function meta(more){var m={top:host!==win,standalone:standalone(host),ms:Date.now()-t0};if(more)for(var k in more)m[k]=more[k];return m;}
    function silent(resolve){finish();win.__psPdfPickerSilent=true;record(win,{name:'silent',message:'no dialog, user chose download'},meta({focus:true}));toast(win,SILENT);resolve(null);}
    listen(true);
    return new Promise(function(resolve){
      var p;try{p=host.showSaveFilePicker({suggestedName:name,types:[{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}]});}catch(e){p=Promise.reject(e);}
      Promise.resolve(p).then(function(h){if(done)return;var late=waited;finish();if(late)record(win,{name:'late',message:'dialog answered after prompt'},meta(),'ok');resolve(h);},function(e){if(done)return;var late=waited;finish();
        if(e&&e.name==='AbortError'){if(late)record(win,{name:'late',message:'dialog cancelled after prompt'},meta(),'ok');return resolve(false);}
        if(alreadyOpen(e)){if(win.__psPdfPickerWaited){win.__psPdfPickerSilent=true;record(win,{name:'silent',message:'picker already active after a silent one'},meta());toast(win,SILENT);return resolve(null);}toast(win,BUSY);return resolve(false);}
        record(win,e,meta());toast(win,'저장 위치 창을 열지 못해 다운로드 폴더에 받아요'+(e&&e.name?' ('+e.name+')':''));resolve(null);});
      var ms=win.__psPdfSilentMs||SILENT_MS;
      timer=win.setTimeout(function(){
        if(done)return;
        if(blurred||!focused(host))return;   /* 창이 떠서 초점을 가져갔다 — 사용자가 고를 때까지 기다린다 */
        waited=true;win.__psPdfPickerWaited=true;
        var fallback=function(){if(!done)silent(resolve);};
        var cancel=function(){if(done)return;finish();record(win,{name:'silent_cancel',message:'user cancelled while no dialog'},meta({focus:true}),'ok');resolve(false);};
        win.__psPdfFallback=fallback;
        ui=prompt(win,fallback,cancel);   /* 창은 계속 기다린다 — 늦게 답하면 그대로 쓴다 */
      },ms);
    });
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
  return {iosShare:iosShare,shareTarget:shareTarget,pick:pick,mount:mount,alreadyOpen:alreadyOpen,hostOf:hostOf,BUSY:BUSY,SILENT:SILENT,SILENT_MS:SILENT_MS,FB_DL:FB_DL};
});
/* 본문 스크립트(_ppbPickSaveTarget 의 function 선언)가 이 태그 뒤에 돌며 window 속성을 다시 세운다 — DOMContentLoaded 에야 바꾼다(3.141 board-shape-menu 와 같은 함정). */
if(typeof window!=='undefined'&&window.PSPdfSave){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){window.PSPdfSave.mount(window);});else window.PSPdfSave.mount(window);}
