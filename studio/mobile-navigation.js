/* Keep the existing navigation buttons and their save/permission-aware handlers.
   Only the phone presentation changes; the dedicated player IDP shell stays intact. */
(function(){
  'use strict';
  function mount(){
    var seg=document.getElementById('appSeg'),team=document.getElementById('teamBottom'),sheet=document.getElementById('teamMoreSheet');
    if(!seg||!team||seg.dataset.mobileNavigation)return;
    var original=Array.from(seg.children),phone=window.matchMedia('(max-width:767px)'),active=null;
    var selectors=['button[data-app="board"]:not([data-train])','#psTrainBtn','button[data-app="community"]','button[data-team-hub]','button[data-app="learning"]','#psMoreBtn'];
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
      document.body.classList.toggle('ps-mobile-six',active);
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
