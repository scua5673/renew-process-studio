/* PROCESS STUDIO — 한 기기 한 창 (3.261)
   사용자 «가용인원 체크가 잘 안 돼 · 바꿨는데 되돌아가»(11/4, 풋볼A 주인 · 맥).
   운영 실측(ps_events): 같은 맥에 3.233 창이 11/2부터 숨은 채 살아 있었다(새 판 적용을 2,374번 미룸 · flush_timeout:fScout).
   11/3 에는 3.241 창 두 개가 함께 떠 있었다. 창들은 기기 저장소를 같이 쓴다. 한 창이 선수 행(sq:)을 쓰는 사이 다른 창이 같은 선수를 바꾸면
   그 저장은 «입력 뒤 선수 정보가 바뀌었습니다»(items_write_stale_job)로 멈춘다. 멈춘 저장이 남은 창에서는 다음 가용인원 체크도
   저장 확인(scoutStore.ready)에서 막혔고, 옛 창은 옛 값으로 같은 저장을 계속 다시 시도했다.
   → 앱 셸은 브라우저의 창 잠금(Web Locks) 하나를 쥔다.
     · 보이는 채 열린 창은 잠금을 가져간다(steal). 먼저 있던 창은 팀·계정 전환이 끝나기를 기다리고 저장 확인을 잠깐(8초) 기다린 뒤
       안내 화면(elsewhere.html)으로 물러난다. 사용자가 그 창을 닫은 것과 같다. 다만 «우리가 하는 새로고침» 표시를 달아
       닫을 때의 팀 사본 정리(sync.js wipeTeamCacheSoft)가 저장소를 같이 쓰는 새 창의 사본을 지우지 않게 한다.
     · 숨은 채 열린 창(옛 창이 스스로 새 판으로 다시 열릴 때 등)은 잠금을 뺏지 않는다. 다른 창이 쥐고 있으면 스스로 물러난다.
     · 잠금 API 가 없는 브라우저 · iframe 안 · localStorage ps_one_window='0'(되돌리기)이면 예전 그대로.
     · 같은 탭의 새로고침도 새 문서가 잠금을 가져간다. 이때 «뺏겼다»를 받는 것은 떠나는 옛 문서인데, 옛 문서의 window 는 이미
       새 문서를 가리킨다(WindowProxy — WebKit 은 옛 문서의 남은 일을 잠깐 더 돌린다). 그래서 처음 붙잡은 document·location 이
       지금 탭의 것일 때만 움직인다(gone). 안 그러면 옛 문서가 새 문서에 덮개를 씌우고 안내 화면으로 보낸다(3.261 CI).
   저장 엔진의 «덮지 않는다» 원칙은 그대로다. 같은 기기에서 동시에 쓰는 창을 없앨 뿐이다. 실제 두 창은 tests/browser/one-window-3261.mjs. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSOneWindow=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var LOCK='ps-app-window-v1',PAGE='elsewhere.html',BACK='ps_elsewhere_back',SCREEN='ps_elsewhere_screen',OFF='ps_one_window';
  var FLUSH_MS=8000,BUSY_MS=20000,STEP=250;
  function wait(w,ms){return new Promise(function(r){w.setTimeout(r,ms);});}
  function call(w,name){try{var f=w[name];return typeof f==='function'?f():undefined;}catch(_){return undefined;}}
  /* 팀·계정 전환 한가운데서 떠나지 않는다(최대 20초) */
  function idle(w,limit){
    var t0=Date.now();
    return (function loop(){if(call(w,'psReloadWorkspaceBusy')!==true||Date.now()-t0>=limit)return Promise.resolve();return wait(w,STEP).then(loop);})();
  }
  /* 새 판 적용과 같은 저장 확인(app.html psFlushAllPendingReady). 실패해도 떠난다 — 기기에 이미 쓴 것은 남고, 새 창이 이어서 올린다 */
  function flush(w,limit){
    var f=w.psFlushAllPendingReady;if(typeof f!=='function')return Promise.resolve('none');
    var done=Promise.resolve().then(function(){return f();}).then(function(){return 'ok';},function(e){
      return 'fail:'+String((e&&e.psFrame)||'?')+':'+String((e&&(e.psCode||e.name))||'?');
    });
    return Promise.race([done,wait(w,limit).then(function(){return 'timeout';})]);
  }
  /* 기록(sync.js 대기열 ps_event_queue_v2)이 나갈 때까지 잠깐 — 바로 떠나면 WebKit 은 보내던 요청을 끊는다(남은 줄은 다음 창이 보낸다) */
  function sent(w,limit){
    var t0=Date.now();
    function left(){try{return (JSON.parse(w.localStorage.getItem('ps_event_queue_v2')||'[]')||[]).some(function(x){return x&&x.row&&x.row.event_name==='window_elsewhere';});}catch(_){return false;}}
    return (function loop(){if(!left()||Date.now()-t0>=limit)return Promise.resolve();return wait(w,100).then(loop);})();
  }
  /* 떠나는 동안 이 창에서 더 고치지 않게 덮는다 */
  function cover(d){
    function put(){
      if(!d.body||d.getElementById('psElsewhereCover'))return;
      var el=d.createElement('div');el.id='psElsewhereCover';el.setAttribute('role','status');
      el.style.cssText='position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;'+
        'background:rgba(12,13,16,.78);color:#fff;text-align:center;font:600 15px/1.55 "Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo",sans-serif';
      el.textContent='다른 창에서 이어서 쓰고 있어요. 이 창의 저장을 마무리하는 중이에요.';
      d.body.appendChild(el);
    }
    if(d.body)put();else d.addEventListener('DOMContentLoaded',put);
  }
  /* 안내 화면으로. 돌아올 주소(해시는 빼고 — 로그인 토큰이 실릴 수 있다)와 보던 화면을 이 탭에 적어 둔다 */
  function go(w,d,loc){
    d=d||w.document;loc=loc||w.location;
    var ss=null;try{ss=w.sessionStorage;}catch(_){}
    if(ss){
      try{ss.setItem('ps_self_reload','1');}catch(_){}   /* sync.js wipeAllowedNow — 닫기가 아니라 우리가 옮기는 것 */
      try{ss.setItem(BACK,'app.html'+String(loc.search||''));}catch(_){}
      try{var b=d.body;ss.setItem(SCREEN,JSON.stringify({app:(b&&b.getAttribute('data-ps-app'))||'',team:w.__psTeamSection?String(w.__psTeamSection()||''):''}));}catch(_){}
    }
    call(w,'__psBootMarkDone');   /* 멈춘 부팅으로 세지 않는다(WebKit 은 load 전엔 pagehide 를 안 보낸다) */
    loc.replace(PAGE);
  }
  function start(w,o){
    o=o||{};
    var st={mode:'off',reason:'',left:false,flush:''};
    var locks=null;try{locks=w.navigator&&w.navigator.locks;}catch(_){}
    if(!locks||typeof locks.request!=='function')return st;
    try{if(w.top!==w)return st;}catch(_){return st;}
    try{if(w.localStorage.getItem(OFF)==='0')return st;}catch(_){}
    var doc0=w.document,loc0=w.location;
    function gone(){try{return w.document!==doc0;}catch(_){return true;}}   /* 이 창(탭)이 이미 다른 문서로 넘어갔다 */
    var hidden=!!(doc0&&doc0.hidden);
    st.mode=hidden?'ask':'take';
    function leave(reason){
      if(st.left)return Promise.resolve(st);
      st.left=true;st.reason=reason;var t0=Date.now();
      function stop(){st.mode='gone';return st;}
      if(gone())return Promise.resolve(stop());
      if(reason==='stolen')cover(doc0);
      st.done=idle(w,o.busyMs||BUSY_MS).then(function(){if(gone())return 'gone';return reason==='stolen'?flush(w,o.flushMs||FLUSH_MS):'skip';}).then(function(f){
        st.flush=f;var queued=false;if(gone())return null;
        try{var S=w.PSSync;if(S&&typeof S.event==='function'){
          S.event('window_elsewhere',{status:'ok',feature:'app',error_code:reason,meta:{stage:f,ms:Date.now()-t0,hidden:!!doc0.hidden}});   /* 글 값은 sync.js safeEventMeta 가 아는 이름(stage)만 남긴다 */
          queued=true;
        }}catch(_){}
        return queued?sent(w,o.sendMs||2000):null;
      }).then(function(){
        if(gone())return stop();
        if(typeof o.go==='function')o.go(st);else go(w,doc0,loc0);
        return st;
      });
      return st.done;
    }
    st.leave=leave;
    Promise.resolve().then(function(){
      return locks.request(LOCK,hidden?{mode:'exclusive',ifAvailable:true}:{mode:'exclusive',steal:true},function(lock){
        if(gone())return;
        if(!lock){st.mode='busy';leave('hidden_busy');return;}
        st.mode='held';
        return new Promise(function(){});   /* 이 창이 살아 있는 동안 쥔다(창이 닫히면 브라우저가 놓는다) */
      });
    }).catch(function(e){
      if(st.left||gone())return;
      if(e&&e.name==='AbortError'){st.mode='stolen';leave('stolen');}
      else st.mode='error';
    });
    return st;
  }
  return {start:start,LOCK:LOCK,PAGE:PAGE,BACK:BACK,SCREEN:SCREEN,OFF:OFF,_flush:flush,_idle:idle,_go:go};
});
