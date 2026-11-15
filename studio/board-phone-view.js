/* Small phone surfaces are viewers. A phone with an expanded physical display
   can use the existing editor; rotating an ordinary phone cannot unlock it. */
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
  function expandedInfo(info){
    return info.phone===true&&Math.min(+info.screenWidth||0,+info.screenHeight||0)>=600&&(+info.windowWidth||0)>=600;
  }
  function expanded(win){
    var host=win;try{if(win.top.document)host=win.top;}catch(_){}
    var s=host.screen||win.screen||{};
    return expandedInfo({phone:phone(win),screenWidth:s.width,screenHeight:s.height,windowWidth:host.innerWidth});
  }
  function readOnly(win){return phone(win)&&!expanded(win);}
  var EDITORS=['#hint','#boardToolbar','#bench','#drawPanel','.sel-ctl','.draw-ctl','#ps-dock','#ps-command-dock','#floatBar','#toolSeg','#cmd-board-settings-pop','#boardManualSave','#vaultSave','#psSaveBar','#emptyHint','#ehDoor','#vCreateSave','#vCreateSaveOnly','#vCreateEdit','#vvEdit','#editorDone','#editorCopy','#bpBoardSettings','#boardPageStrip .bp-head','#boardPageStrip .bpx','#boardPageStrip .bp-add','#bpLinkChip','#animAdd','#animDel','#animDup','#psPhoneHint','#psEditTools','#psEditToolsToggle','#animBar','#ps-tb-menu','#boardPageStrip .tb-mid','#boardPageStrip .tb-right','#boardPageStrip .tb-head'];
  var EDIT_TARGET=EDITORS.concat(['#boardPageStrip input','#ksEd input','#ksEd textarea','#editorPanel input','#editorPanel textarea','#editorPanel select','#epNameTop']).join(',');
  function install(win){
    if(win.__psPhoneBoardView)return win.__psPhoneBoardView;
    var doc=win.document,note=null,queued=false,lastTip=0,down=null;
    win.psPhoneBoardReadOnly=function(){return readOnly(win);};
    win.psPhoneBoardNotice=function(){try{if(win.toast)win.toast(MESSAGE);}catch(_){}return false;};
    /* 3.300 — 띠에는 «보기 전용»만. 설명은 판 · 편집 단추를 누를 때 알림으로(6초에 한 번) */
    function tip(){
      /* 커뮤니티 글은 어느 기기에서나 보기 전용 — «아이패드에서 고친다»는 말이 맞지 않는다 */
      try{if(doc.body.classList.contains('comm-viewing')||/[?&]community_view=1(&|$)/.test(win.location.search))return;}catch(_){}
      var n=Date.now();if(n-lastTip<6000)return;lastTip=n;
      /* 내 빠른 보드를 보는 중이면 고칠 길이 띠에 있다 — «아이패드에서» 대신 그 단추를 알린다 */
      var qe=null;try{qe=win.PSQuickDepth&&win.PSQuickDepth.entry(win);}catch(_){}
      if(qe&&qe.mode==='edit'){try{if(win.toast)win.toast('이름 · 자리는 위의 «'+qe.label+'»에서 바꿔요');}catch(_){}return;}
      win.psPhoneBoardNotice();
    }
    function closest(t,s){return t&&t.closest&&t.closest(s);}
    function stop(e,scroll){if(!scroll)e.preventDefault();e.stopImmediatePropagation();}
    function guard(e){
      if(!readOnly(win))return;
      var t=e.target;
      if(closest(t,'#psPhoneBoardNotice,#psVvPlay,#psEyeDialog,#psQuick'))return;
      var canvas=closest(t,'#boardStage'),edit=closest(t,EDIT_TARGET);
      // Blocking the canvas default also prevents iframe focus/parent blur.
      if(canvas&&['pointerdown','touchstart','mousedown'].indexOf(e.type)>=0){try{if(win.parent.__psAppMoreClose)win.parent.__psAppMoreClose();}catch(_){}}
      if(closest(t,'#boardPageStrip .bp-tab')&&['dragstart','drop','dblclick'].indexOf(e.type)>=0){stop(e);return;}
      if(e.type==='keydown'){
        var k=String(e.key||'').toLowerCase();
        if(k==='tab'||k==='escape'||((e.ctrlKey||e.metaKey)&&['c','a','f','r','l','+','-','=','0'].indexOf(k)>=0))return;
        if(!edit&&!canvas&&closest(t,'input,textarea,select,[contenteditable="true"]'))return;
        if(!edit&&!canvas&&closest(t,'button,a,summary')&&(k==='enter'||k===' '))return;
        // Board shortcuts run on the document even when no token has focus.
        if(edit||canvas||win.__csView!=='session'||doc.body.classList.contains('editing')){stop(e);return;}
      }
      if(edit||canvas){
        var touch=canvas&&(e.type==='touchstart'||e.type==='touchmove'||((e.type==='pointerdown'||e.type==='pointermove')&&e.pointerType==='touch'));
        /* 손가락으로 누른 판은 click 이 오지 않는다(아래에서 touchend · pointerup 을 막는다) — 누름(pointerdown → 제자리 pointerup)으로 알린다 */
        if(e.type==='pointerdown')down={id:e.pointerId,x:e.clientX,y:e.clientY,t:Date.now()};
        var tap=e.type==='pointerup'&&down&&down.id===e.pointerId&&Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y)<12&&Date.now()-down.t<700;
        if(e.type==='pointerup')down=null;
        stop(e,touch);
        if(e.type==='click'||tap)tip();
      }
    }
    ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','touchstart','touchmove','touchend','click','dblclick','contextmenu','keydown','beforeinput','paste','cut','drop','dragstart'].forEach(function(type){win.addEventListener(type,guard,{capture:true,passive:false});});
    function playback(){try{return {count:anim.frames.length,playing:!!animPlaying};}catch(_){return {count:0,playing:false};}}
    function sync(){
      queued=false;if(!doc.body)return;
      var on=readOnly(win);
      if(doc.body.classList.contains('ps-phone-board-readonly')!==on)doc.body.classList.toggle('ps-phone-board-readonly',on);
      var wide=expanded(win);if(doc.body.classList.contains('ps-fold-expanded')!==wide)doc.body.classList.toggle('ps-fold-expanded',wide);
      var stage=doc.getElementById('boardStage');
      if(!on||!stage){if(note)note.hidden=true;return;}
      if(!note){
        note=doc.createElement('aside');note.id='psPhoneBoardNotice';note.setAttribute('role','note');
        note.setAttribute('aria-label','보기 전용 · '+MESSAGE);
        note.innerHTML='<span class="ps-pv-ro">보기 전용</span><span class="ps-pv-fill"></span><button type="button" class="ps-btn-secondary" data-play hidden>재생</button><button type="button" class="ps-btn-primary" data-quick hidden>＋ 빠른 보드</button>';
        /* 3.300 — 빠른 보드(board-quick-depth.js): 작업 보드는 «＋ 빠른 보드», 보관함에서 연 내 빠른 보드는 «이름 · 자리 고치기» */
        note.querySelector('[data-quick]').onclick=function(){try{if(win.PSQuickDepth)win.PSQuickDepth.open(win);}catch(_){}};
        note.querySelector('[data-play]').onclick=function(){try{if(playback().playing)win.stopAnim();else win.playAnim();}catch(_){}sync();};
      }
      if(note.parentNode!==stage.parentNode)stage.parentNode.insertBefore(note,stage);
      note.hidden=doc.body.classList.contains('comm-viewing')||(win.__csView==='session'&&!doc.body.classList.contains('editing'));
      var qb=note.querySelector('[data-quick]'),qe=null;try{qe=win.PSQuickDepth&&win.PSQuickDepth.entry(win);}catch(_){}
      qb.hidden=!qe;if(qe&&qb.textContent!==qe.label)qb.textContent=qe.label;
      var p=playback(),b=note.querySelector('[data-play]');b.hidden=p.count<2||doc.body.classList.contains('ps-vv-phone');b.textContent=p.playing?'정지':'재생';b.setAttribute('aria-label',p.playing?'애니메이션 정지':'애니메이션 재생');
    }
    function schedule(){if(!queued){queued=true;win.requestAnimationFrame(sync);}}
    function boot(){
      /* 3.264 — DOMContentLoaded 뒤에도 body 가 없는 문서(교체 중인 iframe)에서 observe 가 던졌다(아이폰 ps_err) */
      if(!doc.body||!doc.head){if(!boot.retried){boot.retried=1;win.setTimeout(boot,120);}return;}
      var style=doc.createElement('style');style.id='psPhoneBoardStyle';
      var priority=Array(25).join(':not(#psPhoneReadOnly)');
      style.textContent=EDITORS.concat(['#ps-df-tray','#ps-df-opts']).map(function(s){return 'html.ps-page-board body.ps-phone-board-readonly'+priority+' '+s;}).join(',')+'{display:none!important}'+
        'html.ps-page-board body.ps-phone-board-readonly .vc-act.edit{display:none!important}'+
        '#psPhoneBoardNotice{box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);padding:6px var(--sp-3);background:var(--c-surface);color:var(--c-ink);border-bottom:1px solid var(--c-line);font:inherit;z-index:150;position:relative;text-align:left;word-break:keep-all}'+
        '#psPhoneBoardNotice[hidden],#psPhoneBoardNotice button[hidden],body.ps-vv-phone #psPhoneBoardNotice [data-play]{display:none!important}'+
        '#psPhoneBoardNotice .ps-pv-ro{flex:none;font-size:14px;font-weight:600;line-height:1.4;color:var(--c-muted)}#psPhoneBoardNotice .ps-pv-fill{flex:1;min-width:0}'+
        'html.ps-page-board body.ps-phone-board-readonly #boardPageStrip.on.bp-multi:not(#_){position:relative!important;z-index:6!important}'+
        'html.ps-page-board body.ps-phone-board-readonly #boardPageStrip.on:not(.bp-multi) .bp-tab{pointer-events:none!important}'+
        '#psPhoneBoardNotice button{flex:none;min-height:40px;padding:0 var(--sp-3);font-size:14px}';
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
  return {isPhone:isPhone,phone:phone,expandedInfo:expandedInfo,expanded:expanded,readOnly:readOnly,install:install,message:MESSAGE};
});
