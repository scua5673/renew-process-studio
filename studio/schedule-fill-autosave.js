/* 세션 채우기 시트의 «메모» · «장소»는 칸을 벗어날 때(change)만 저장됐다(2.908) — 적고 나서 «완료»를 누르지 않고 새로고침 · 앱 전환을 하면
   글이 기기에도 서버에도 남지 않았다(코치로 일정을 돌려 보다 찾음 — 아이패드 사파리는 beforeunload 도 자주 건너뛴다).
   이 모듈은 process.html 본문 뒤에 읽혀, 치는 동안 짧게(0.6초) 미뤘다가 **원래 저장 길**(`wksFillFlushText` → `wksFillNote` · `wksFillPlace` → `save()`)로 담고,
   미룬 저장의 세 길(2.395 · 2.398)을 잇는다: 셸의 `psFlushPending` · `psFlushPendingReady` 앞 · `pagehide` · `visibilitychange`(숨을 때).
   칸은 다시 그리지 않는다 — 값만 읽는다. 한글 조합 중에도 읽기만 하므로 조합이 끊기지 않고(마지막 글자는 다음 입력 전까지 늘 조합 중이라
   조합이 끝나길 기다리면 그 글자는 영영 저장되지 않는다), 뒤의 주간 판은 `syncViews` 가 조합 중 · 시트가 덮은 동안 그리지 않는다(2.933). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSSchedFillAutosave=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var DELAY=600,FIELDS={wfNote:1,wfPlace:1};
  function watched(t){return !!(t&&t.id&&FIELDS[t.id]===1);}
  function mount(W,opts){
    if(!W||!W.document||W.__psFillAutosave)return null;
    var doc=W.document,delay=(opts&&opts.delay)||DELAY,timer=0,commits=0;
    function commit(){
      if(timer){W.clearTimeout(timer);timer=0;}
      try{if(typeof W.wksFillFlushText==='function'){W.wksFillFlushText();commits++;}}catch(_){}
    }
    function arm(){if(timer)W.clearTimeout(timer);timer=W.setTimeout(function(){timer=0;commit();},delay);}
    /* 화면이 사라지는 길 — 칸의 글을 담고, 미뤄 둔 저장(save 는 마이크로태스크)을 그 자리에서 쓴다 */
    function leave(){commit();try{if(typeof W.saveFlush==='function')W.saveFlush();}catch(_){}}
    function onType(e){if(watched(e&&e.target))arm();}
    doc.addEventListener('input',onType,true);
    doc.addEventListener('compositionend',onType,true);
    W.addEventListener('pagehide',leave);
    doc.addEventListener('visibilitychange',function(){if(doc.visibilityState==='hidden')leave();});
    ['psFlushPending','psFlushPendingReady'].forEach(function(name){
      var orig=W[name];if(typeof orig!=='function')return;
      W[name]=function(){commit();return orig.apply(this,arguments);};
    });
    var orig=W.psHasPending;
    if(typeof orig==='function')W.psHasPending=function(){return !!timer||orig.apply(this,arguments);};
    W.__psFillAutosave={commit:commit,pending:function(){return !!timer;},commits:function(){return commits;},delay:delay};
    return W.__psFillAutosave;
  }
  return {DELAY:DELAY,FIELDS:FIELDS,watched:watched,mount:mount};
});
