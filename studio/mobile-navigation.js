/* Keep the existing navigation buttons and their save/permission-aware handlers.
   Only the phone presentation changes; the dedicated player IDP shell stays intact. */
(function(){
  'use strict';
  function mount(){
    var seg=document.getElementById('appSeg'),team=document.getElementById('teamBottom'),sheet=document.getElementById('teamMoreSheet');
    if(!seg||!team||seg.dataset.mobileNavigation)return;
    var original=Array.from(seg.children),phone=window.matchMedia('(max-width:767px)'),active=null;
    var selectors=['button[data-app="board"]:not([data-train])','#psTrainBtn','button[data-app="community"]','button[data-team-hub]','button[data-app="learning"]','#psMoreBtn'];
    /* «학습» 끄기(learning-off.js) — 꺼져 있으면 다섯 칸 */
    if(window.PS_LEARNING_ENABLED===false)selectors.splice(4,1);
    /* 3.280 — «프로필»은 커뮤니티 바로 다음 칸(사용자 «메뉴의 커뮤니티 밑으로»). «학습»이 켜진 판은 여섯 칸이 차 있어 «더보기» 안에만 둔다 */
    var profileSlot=window.PS_LEARNING_ENABLED===false&&!!seg.querySelector('button[data-app="profile"]');
    if(profileSlot)selectors.splice(3,0,'button[data-app="profile"]');
    var primary=selectors.map(function(s){return seg.querySelector(s);});
    if(primary.some(function(b){return !b;}))return;
    var order=primary.concat(original.filter(function(b){return primary.indexOf(b)<0;})),label=team.getAttribute('aria-label');
    seg.dataset.mobileNavigation='ready';
    function sync(){
      var next=phone.matches&&!document.body.classList.contains('ps-player-idp-only');
      if(next===active)return;
      active=next;
      var focused=document.activeElement,restore=focused&&seg.contains(focused);
      (active?order:original).forEach(function(b){seg.appendChild(b);});
      document.body.classList.toggle('ps-mobile-six',active);document.body.classList.toggle('ps-mnav-profile',active&&profileSlot);
      seg.style.setProperty('--ps-mnav-n',String(primary.length));
      team.setAttribute('aria-label',active?'팀 운영 메뉴':label||'팀 하단 탭');
      if(restore&&focused.offsetHeight>0)focused.focus({preventScroll:true});
    }
    seg.addEventListener('click',function(e){if(active&&e.target.closest('button')&&sheet)sheet.hidden=true;});
    team.addEventListener('click',function(){if(active&&window.__psAppMoreClose)window.__psAppMoreClose();});
    phone.addEventListener('change',sync);
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
