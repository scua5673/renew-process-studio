/* 일정(process.html)이 들고 있는 보관함 사본에서 장면 본문을 내려놓는다(제보 de2e508c 조사).
   일정은 보관함 목록을 통째로 읽어 __psLibCache 에 계속 들고 있다 — 고르기 창 · 칩 · PDF 가 쓰는 것은 이름 · 폴더 · 태그 · 분 · thumb · snap ·
   drills · trainings(장면 수) · frames(장면 수) · pages[].name/thumb/snap 뿐이고, 페이지마다의 장면 목록(pages[].anim — 장면마다 판 + 썸네일 약 70KB)은 읽지 않는다.
   실측(합성 82개 20MB): 숨은 일정 틀이 앱이 떠 있는 내내 JS 힙 40MB 를 쥐고 있었다(부팅 뒤 56MB → 16MB).
   읽은 사본에서만 뗀다 — 보관함 원문(IndexedDB) · 작전판이 읽는 사본은 그대로다. 일정이 자료를 열 때는 libId 만 작전판에 넘긴다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.psLibSlim=api.slim;root.PSScheduleLib=api;}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function slim(list){
    try{
      if(!Array.isArray(list))return list;
      for(var i=0;i<list.length;i++){var d=list[i],pg=d&&d.pages;if(!Array.isArray(pg))continue;
        for(var j=0;j<pg.length;j++){var p=pg[j];if(p&&typeof p==='object'&&p.anim!==undefined)delete p.anim;}}
    }catch(_){}
    return list;
  }
  /* 숨은 일정은 보관함이 바뀔 때마다 통째로 다시 읽지 않는다. 작전판에서 자료를 저장하면(cs_lib_rev) 숨은 일정 틀도 20MB 를 읽고 해석했다 —
     저장 한 번의 통째 읽기 여섯 중 하나, 작전판의 다시 그리기 읽기와 겹쳐 렌더러 메모리 최고치를 만든다. 틀이 화면에 상자를 갖지 않으면(display:none)
     «바뀜»만 적어 두고, 보이는 순간 원래 psLibraryRefresh 를 한 번 부른다(고르는 창은 __psLibPending 으로 그 읽기를 기다린다 — 2.934 그대로).
     옛 목록은 그동안 그대로 둔다. 부팅 때 읽기(psLibraryReload) · 보이는 일정은 그대로다. */
  function deferHidden(win){
    var fe=null,pdoc=null,pwin=null;
    try{fe=win.frameElement;pdoc=fe&&fe.ownerDocument;pwin=pdoc&&pdoc.defaultView;}catch(_){fe=null;}
    var orig=win&&win.psLibraryRefresh;
    if(!fe||!pdoc||!pwin||typeof orig!=='function'||orig.__psDefer)return null;
    var pending=false,timer=0,mo=null;
    function hidden(){try{return typeof fe.getClientRects==='function'&&fe.getClientRects().length===0;}catch(_){return false;}}
    function stop(){if(timer){win.clearInterval(timer);timer=0;}if(mo){try{mo.disconnect();}catch(_){}mo=null;}}
    function flush(){if(!pending||hidden())return;pending=false;stop();try{orig.call(win);}catch(_){}}
    function watch(){
      if(!mo){try{mo=new pwin.MutationObserver(function(){win.setTimeout(flush,0);});
        mo.observe(fe,{attributes:true,attributeFilter:['style','class','hidden']});
        if(pdoc.body)mo.observe(pdoc.body,{attributes:true,attributeFilter:['data-ps-app','class']});}catch(_){mo=null;}}
      if(!timer)timer=win.setInterval(flush,600);
    }
    var wrapped=function(){
      if(hidden()){pending=true;watch();return Promise.resolve(false);}
      pending=false;stop();return orig.apply(this,arguments);
    };
    wrapped.__psDefer=1;win.psLibraryRefresh=wrapped;
    try{win.addEventListener('pagehide',stop);}catch(_){}
    return {flush:flush,pending:function(){return pending;}};
  }
  if(typeof window!=='undefined'&&window.document&&/\/studio\/process\.html/.test(String(window.location&&window.location.pathname))){
    /* 이 파일은 일정 본문보다 먼저 읽힌다 — psLibraryRefresh 가 생긴 뒤에 감싼다 */
    try{window.addEventListener('DOMContentLoaded',function(){try{window.__psLibDefer=deferHidden(window);}catch(_){}});}catch(_){}
  }
  return {slim:slim,deferHidden:deferHidden};
});
