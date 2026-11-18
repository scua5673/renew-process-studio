/* PROCESS STUDIO — 3.325 폰 아래 메뉴의 «폰보드» 탭(셸 쪽). 편집기는 작전판 틀 안의 덮개(board-phone-board.js)다.
   · 단추는 폰(html[data-ps-device=phone])에서만 만든다 — 아이패드 · 컴퓨터의 메뉴(DOM)는 그대로. mobile-navigation.js 가 `button(seg)` 로 받아 «보드» 다음 칸에 세운다.
   · 누르면 원래 «보드» 단추를 대신 눌러(저장 장벽 · 권한은 그 처리기 그대로) 작전판 틀을 띄운 뒤 `phoneBoard open` 신호를 보낸다.
   · 다른 화면으로 가면(showApp 이 body[data-ps-app] 을 다시 적는다) 덮개를 닫는다. 켜짐은 `__psPhoneBoardWant` — 작전판 틀이 다시 읽혀도 이어 연다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSPhoneBoardNav=api;api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M6.5 12h11"/><circle cx="12" cy="12" r="1.9"/></svg>';
  var diag=[];
  function note(e){diag.push(String(e&&e.message||e));if(diag.length>20)diag.shift();return null;}
  function isPhone(win){try{return win.document.documentElement.getAttribute('data-ps-device')==='phone';}catch(e){return !!note(e);}}
  function install(win){
    if(!win||!win.document||win.__psPhoneBoardNav)return win&&win.__psPhoneBoardNav;
    var doc=win.document,btn=null,on=false,opening=false,watch=null;
    function frame(){var f=doc.getElementById('fBoard');return f&&f.contentWindow||null;}
    function send(cmd){var w=frame();if(!w)return;try{w.postMessage({source:'app',type:'phoneBoard',cmd:cmd},win.location.origin);}catch(e){note(e);}}
    function mark(){
      if(!btn)return;
      btn.classList.toggle('on',on);
      if(on)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
      var seg=btn.parentNode,b=seg&&seg.querySelector('button[data-app="board"]:not([data-train])');
      if(on&&b){b.classList.remove('on');b.removeAttribute('aria-current');}
      else if(!on&&b&&doc.body.dataset.psApp==='board'&&!doc.body.classList.contains('ps-team-open')){b.classList.add('on');b.setAttribute('aria-current','page');}
    }
    function set(v){on=!!v;win.__psPhoneBoardWant=on;mark();}
    function go(e){
      if(e){e.preventDefault();e.stopPropagation();}
      try{if(win.__psAppMoreClose)win.__psAppMoreClose();}catch(err){note(err);}
      var seg=btn.parentNode,b=seg&&seg.querySelector('button[data-app="board"]:not([data-train])');
      if(!b)return;
      opening=true;
      try{b.click();}catch(err){note(err);}
      opening=false;
      /* «보드»가 열리지 않았으면(저장 확인이 막았다) 켜지 않는다 */
      if(doc.body.dataset.psApp!=='board'||doc.body.classList.contains('ps-team-open'))return;
      /* 방금 «보드»를 열며 적힌 기록은 내 것이다 — 감시자가 뒤늦게 받아 닫지 않게 비운다 */
      if(watch)watch.takeRecords();
      set(true);send('open');
    }
    function button(seg){
      if(!isPhone(win)||!seg)return null;
      if(btn)return btn;
      btn=doc.createElement('button');btn.type='button';btn.id='psPhoneBoardBtn';btn.setAttribute('data-scope','personal');btn.setAttribute('data-phoneboard','1');
      btn.innerHTML=ICON+'<span>폰보드</span>';
      btn.addEventListener('click',go);
      /* 다른 화면으로 가면 닫는다 — showApp 은 같은 값이어도 body[data-ps-app] 을 다시 적는다 */
      watch=new win.MutationObserver(function(){if(opening||!on)return;set(false);send('close');});
      watch.observe(doc.body,{attributes:true,attributeFilter:['data-ps-app']});
      win.addEventListener('message',function(e){
        var d=e.data;
        if(!d||d.source!=='board'||d.type!=='phoneBoard'||e.origin!==win.location.origin||e.source!==frame())return;
        if(!!d.on!==on)set(!!d.on);
      });
      return btn;
    }
    win.__psPhoneBoardNav={button:button,isOn:function(){return on;},diag:function(){return diag.slice();}};
    return win.__psPhoneBoardNav;
  }
  return {install:install,isPhone:isPhone,button:function(seg){var w=typeof window!=='undefined'?window:null,n=w&&(w.__psPhoneBoardNav||install(w));return n?n.button(seg):null;}};
});
