/* The full letter is already in HTML: reading does not depend on login, JavaScript or the API. */
(function(){
  'use strict';
  var host=document.getElementById('letterContent'),reader=host.querySelector('[data-letter-reader]');
  var social=PSLetterSocial.create({window:window,session:function(){
    try{return JSON.parse(localStorage.getItem('ps_sync_session')||'null');}catch(_){return null;}
  }});
  social.mount(host,reader?{number:+reader.dataset.letterReader,title:host.querySelector('h1').textContent}:null);
  social.refresh();
  host.addEventListener('click',function(e){
    var jump=e.target.closest('[data-letter-jump]');if(!jump)return;
    var target=document.getElementById(jump.dataset.letterJump);if(target){target.scrollIntoView();target.tabIndex=-1;target.focus({preventScroll:true});}
  });
})();
