/* Meeting reserve: a separate lineup immediately after BEST, with the same pitch and formation. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSMeetReserve=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function isBest(s){return !!s&&/^(BEST\s+(11|8)|선발\s*(11|8))\b/i.test(s.title||'');}
  function isReserve(s){return !!s&&(/^RESERVE$/i.test(s.title||'')||/^리저브$/.test(s.title||'')||(s.snap&&s.snap.players||[]).some(function(p){return p.meetingRole==='reserve';}));}
  function create(best){
    var s={title:'RESERVE',snap:clone(best.snap||{}),points:[]},sn=s.snap,first=sn.pitchSpec==='u12'?9:12;
    ['pdfOrientation','pageBrand','textStyles'].forEach(function(k){if(best[k]!=null)s[k]=clone(best[k]);});
    sn.players=(sn.players||[]).filter(function(p){return p.team==='blue'&&!p.coach;}).map(function(p,i){
      // Keep positions/kit, not starter identity or individual annotations. IDs and numbers are separate too.
      return {id:2001+i,team:'blue',num:String(first+i),pos:p.pos||'',x:p.x,y:p.y,meetingRole:'reserve'};
    });
    sn.equipment=[];sn.drawings=[];sn.ball=null;
    return s;
  }
  function withReserve(list){
    if(!Array.isArray(list)||list.some(isReserve))return list;
    var i=list.findIndex(isBest);if(i<0)return list;
    var out=list.slice();out.splice(i+1,0,create(list[i]));return out;
  }
  function install(win){
    if(win.__psMeetReserve)return;win.__psMeetReserve=true;
    var doc=win.document,M=win.__meet;
    function editable(){return M&&doc.body.classList.contains('meet-mode')&&!win.__vaultReadOnly&&!(win.communityBoardReadOnly&&win.communityBoardReadOnly())&&!win.__meetVideoBusy&&!win.__animExport;}
    function thumb(s){s.thumb=win.__snapToThumb?win.__snapToThumb(s.snap):'';return s;}
    function templates(fn){return function(base,skipFirst){var args=Array.prototype.slice.call(arguments);args[1]=false;var out=withReserve(fn.apply(this,args));return skipFirst?out.filter(function(s){return !isBest(s);}):out;};}
    win.__meetTplSlides=templates(win.__meetTplSlides);
    if(win.PSMeet8)win.PSMeet8.slides=templates(win.PSMeet8.slides);
    var titles=win.__meetTpl;win.__meetTpl=function(){return withReserve(titles().map(function(t){return {title:t,snap:{}};})).map(function(s){return s.title;});};
    var seed=win.__meetSeed;
    win.__meetSeed=function(){var ok=seed.apply(this,arguments);if(ok){var list=M.frames(),next=withReserve(list);if(next!==list){list.splice(1,0,thumb(next[1]));if(win.__ksRender)win.__ksRender();}}return ok;};
    // Existing meetings are unchanged until the coach explicitly adds the reserve slide.
    function add(){
      if(!editable())return false;
      M.saveCur();var list=M.frames(),best=list.findIndex(isBest);
      if(best<0||list.some(isReserve))return false;
      var s=thumb(create(list[best])),source=list[best];
      M.newSlide(s.title,[]);var at=M.idx(),current=M.frames()[at];
      Object.assign(current,s);delete current.frames;win.loadSnap(current.snap);
      var target=M.frames().indexOf(source);M.move(at,target+(at<target?0:1));M.go(M.frames().indexOf(current),'first');
      if(win.__vaultAutoSaveSchedule)win.__vaultAutoSaveSchedule();return true;
    }
    var render=win.__ksRender;
    win.__ksRender=function(){var r=render.apply(this,arguments),list=M.frames(),i=list.findIndex(isBest),strip=doc.getElementById('ksStrip');
      if(editable()&&strip&&i>=0&&!list.some(isReserve)){
        var card=strip.querySelectorAll('.ksc')[i];if(card){var b=doc.createElement('button');b.type='button';b.id='psMeetReserveAdd';b.className='ksadd';b.textContent='＋ 리저브';b.onclick=add;card.insertAdjacentElement('afterend',b);}
      }return r;
    };
    win.__meetAddReserve=add;
  }
  return {isBest:isBest,isReserve:isReserve,create:create,withReserve:withReserve,install:install};
});
