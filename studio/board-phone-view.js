/* Phone boards are viewers. Device identity comes from the shell, not the
   current viewport: rotating a phone must not unlock editing, and a narrow
   desktop window or iPad split view must stay editable. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSPhoneBoardView=api;api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var MESSAGE='보드 수정은 아이패드나 컴퓨터에서 가능합니다.';
  function isPhone(info){
    if(info.kind)return info.kind==='phone';
    var ua=info.ua||'',touch=info.touch>0,short=Math.min(info.width||Infinity,info.height||Infinity);
    if(/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua))return true;
    if(touch&&short<700)return true;
    if(/iPad/i.test(ua)||(touch&&/Macintosh|Android/i.test(ua)))return false;
    return touch&&info.narrow===true;
  }
  function phone(win){
    var kind='';
    try{kind=win.top.document.documentElement.getAttribute('data-ps-device')||'';}catch(_){}
    var n=win.navigator||{},s=win.screen||{};
    return isPhone({kind:kind,ua:n.userAgent,touch:n.maxTouchPoints,width:s.width,height:s.height,narrow:!!(win.matchMedia&&win.matchMedia('(max-width:767px)').matches)});
  }
  var EDITORS=['.sel-ctl','.draw-ctl','#ps-dock','#ps-command-dock','#floatBar','#toolSeg','#cmd-board-settings-pop','#boardManualSave','#vaultSave','#psSaveBar','#emptyHint','#ehDoor','#vCreateSave','#vCreateSaveOnly','#vCreateEdit','#vvEdit','#editorDone','#editorCopy','#bpBoardSettings','#boardPageStrip .bp-head','#boardPageStrip .bpx','#boardPageStrip .bp-add','#bpLinkChip','#animAdd','#animDel','#animDup','#psPhoneHint','#psEditTools','#psEditToolsToggle','#animBar','#ps-tb-menu','#boardPageStrip .tb-mid','#boardPageStrip .tb-right','#boardPageStrip .tb-head'];
  var EDIT_TARGET=EDITORS.concat(['#boardPageStrip input','#ksEd input','#ksEd textarea','#editorPanel input','#editorPanel textarea','#editorPanel select','#epNameTop']).join(',');
  function install(win){
    if(win.__psPhoneBoardView)return win.__psPhoneBoardView;
    var doc=win.document,note=null,queued=false;
    win.psPhoneBoardReadOnly=function(){return phone(win);};
    win.psPhoneBoardNotice=function(){try{if(win.toast)win.toast(MESSAGE);}catch(_){}return false;};
    function closest(t,s){return t&&t.closest&&t.closest(s);}
    function stop(e,scroll){if(!scroll)e.preventDefault();e.stopImmediatePropagation();}
    function guard(e){
      if(!phone(win))return;
      var t=e.target;
      if(closest(t,'#psPhoneBoardNotice,#psVvPlay,#psEyeDialog'))return;
      var canvas=closest(t,'#boardStage'),edit=closest(t,EDIT_TARGET);
      if(closest(t,'#boardPageStrip .bp-tab')&&['dragstart','drop','dblclick'].indexOf(e.type)>=0){stop(e);return;}
      if(e.type==='keydown'){
        var k=String(e.key||'').toLowerCase();
        if(k==='tab'||k==='escape'||((e.ctrlKey||e.metaKey)&&['c','a','f','r','l','+','-','=','0'].indexOf(k)>=0))return;
        if(!edit&&!canvas&&closest(t,'input,textarea,select,[contenteditable="true"]'))return;
        if(!edit&&!canvas&&closest(t,'button,a,summary')&&(k==='enter'||k===' '))return;
        // Board shortcuts run on the document even when no token has focus.
        if(edit||canvas||win.__csView!=='session'){stop(e);return;}
      }
      if(edit||canvas){
        var touch=canvas&&(e.type==='touchstart'||e.type==='touchmove'||((e.type==='pointerdown'||e.type==='pointermove')&&e.pointerType==='touch'));
        stop(e,touch);
        if(e.type==='click'&&edit)win.psPhoneBoardNotice();
      }
    }
    ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','touchstart','touchmove','touchend','click','dblclick','contextmenu','keydown','beforeinput','paste','cut','drop','dragstart'].forEach(function(type){win.addEventListener(type,guard,{capture:true,passive:false});});
    function playback(){try{return {count:anim.frames.length,playing:!!animPlaying};}catch(_){return {count:0,playing:false};}}
    function sync(){
      queued=false;if(!doc.body)return;
      var on=phone(win);doc.body.classList.toggle('ps-phone-board-readonly',on);
      var stage=doc.getElementById('boardStage');
      if(!on||!stage){if(note)note.hidden=true;return;}
      if(!note){
        note=doc.createElement('aside');note.id='psPhoneBoardNotice';note.setAttribute('role','note');
        note.innerHTML='<div><strong>휴대폰에서는 보기만 가능해요</strong><span>'+MESSAGE+'</span></div><button type="button" class="ps-btn-secondary" hidden>재생</button>';
        note.querySelector('button').onclick=function(){try{if(playback().playing)win.stopAnim();else win.playAnim();}catch(_){}sync();};
      }
      if(note.parentNode!==stage.parentNode)stage.parentNode.insertBefore(note,stage);
      note.hidden=win.__csView==='session'&&!doc.body.classList.contains('editing');
      var p=playback(),b=note.querySelector('button');b.hidden=p.count<2||doc.body.classList.contains('ps-vv-phone');b.textContent=p.playing?'정지':'재생';b.setAttribute('aria-label',p.playing?'애니메이션 정지':'애니메이션 재생');
    }
    function schedule(){if(!queued){queued=true;win.requestAnimationFrame(sync);}}
    function boot(){
      var style=doc.createElement('style');style.id='psPhoneBoardStyle';
      style.textContent=EDITORS.map(function(s){return 'html.ps-page-board body.ps-phone-board-readonly '+s;}).join(',')+'{display:none!important}'+
        'html.ps-page-board body.ps-phone-board-readonly .vc-act.edit{display:none!important}'+
        '#psPhoneBoardNotice{box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--c-surface);color:var(--c-ink);border-bottom:1px solid var(--c-line);font:inherit;z-index:150;position:relative;text-align:left;word-break:keep-all}'+
        '#psPhoneBoardNotice[hidden],#psPhoneBoardNotice button[hidden],body.ps-vv-phone #psPhoneBoardNotice button{display:none!important}'+
        '#psPhoneBoardNotice strong{display:block;font-size:var(--t-5);font-weight:var(--fw-head);line-height:1.5}'+
        '#psPhoneBoardNotice span{display:block;font-size:var(--t-3);line-height:1.5;color:var(--c-muted)}'+
        'html.ps-page-board body.ps-phone-board-readonly #boardPageStrip.on.bp-multi:not(#_){position:relative!important;z-index:6!important}'+
        '#psPhoneBoardNotice button{flex:none;min-height:44px;padding:0 var(--sp-4);font-size:var(--t-5)}';
      doc.head.appendChild(style);sync();
      new win.MutationObserver(schedule).observe(doc.body,{attributes:true,attributeFilter:['class']});
      new win.MutationObserver(schedule).observe(doc.documentElement,{attributes:true,attributeFilter:['data-csview']});
      win.addEventListener('resize',schedule);win.addEventListener('orientationchange',schedule);
      // Playback and page navigation update their DOM asynchronously.
      doc.addEventListener('click',schedule);win.setInterval(function(){if(phone(win))sync();},1000);
    }
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
    return win.__psPhoneBoardView={sync:sync,readOnly:win.psPhoneBoardReadOnly};
  }
  return {isPhone:isPhone,phone:phone,install:install,message:MESSAGE};
});
