/* 3.281 — «선수 입력 보류» 알림 띠(사용자 11/11 «데스크톱에서 가용인원 체크가 제대로 안 돼»).
   운영 기록(풋볼A 주인 데스크톱): `sync_stalled items_stale_review` 가 11/5 부터 — 올라가지 못한 팀 변경 711 → 819건 · 가장 오랜 대기 201시간.
   선수 입력이 기기 사본과 어긋나면 원문을 보관하고 그 선수의 변경을 «사람이 확인할 때까지» 붙잡는다(3.217 — 덮지 않으려는 옳은 규칙).
   그런데 알리는 곳이 화면 아래 저장 상태 줄의 작은 글 «일부 변경 별도 보관 · 보관 내용»뿐이라 8일 동안 아무도 풀지 않았고,
   그 사이 가용인원 체크는 그 기기에만 남거나 다른 기기 값으로 되돌아갔다.
   이 띠는 그 상태를 숨지 않게 한다: 셸 맨 위 창에서 동기화 상태가 `items_stale_review`(확인 대기)이면 위쪽 가운데에 한 줄 —
   «선수 입력 N건이 확인을 기다려요 — 가용인원 · 선수 변경이 팀에 올라가지 않아요  [지금 정리]». 단추는 원래 «보관 내용 보기»(#psAutosaveRecoveryOpen)를 연다
   (거기 3.281 «모두 해제» 단추가 있다). 스스로 풀지 않는다 — 고르는 것은 사람이다. «나중에»는 이 창에서 30분 접는다.
   10분 넘게 떠 있으면 ps_events `items_stale_nudge`(meta n · mins)를 한 번 남긴다 — 띠를 보고도 안 푸는 기기를 알아채려고. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSItemsStaleNudge=api;var go=function(){api.mount(root);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',go);else go();}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var SNOOZE=30*60000,REPORT_AFTER=10*60000;
  /* 띠를 보일 상태인가 → 건수(0 이면 숨김) */
  function need(state){
    if(!state||state.reason!=='items_stale_review'||state.kind!=='ask')return 0;
    var n=Math.max(+state.review||0,0);return n>0?n:1;
  }
  function text(n){return '선수 입력 '+n+'건이 확인을 기다려요 — 가용인원 · 선수 변경이 팀에 올라가지 않아요';}
  var CSS='#psStaleNudge{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:8px;max-width:min(94vw,720px);padding:8px 8px 8px 14px;border-radius:14px;background:rgba(18,22,30,.96);color:#fff;font:600 13px/1.35 Pretendard,system-ui,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.35);border:1px solid rgba(255,210,74,.6)}'
    +'#psStaleNudge[hidden]{display:none}#psStaleNudge .sn-t{flex:1 1 auto;min-width:0}#psStaleNudge button{flex:0 0 auto;min-height:38px;padding:0 12px;border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}'
    +'#psStaleNudge button.sn-go{background:#ffd24a;color:#14213D}#psStaleNudge button:focus-visible{outline:2px solid #9AA8C4;outline-offset:2px}';
  function mount(w){
    var d=w&&w.document;if(!d||w.__psStaleNudge)return null;
    try{if(w.top!==w)return null;}catch(_){return null;}
    if(!d.getElementById('psAutosaveRecoveryOpen'))return null;   /* 셸에서만 */
    var bar=null,until=0,since=0,reported=false;
    function state(){try{return w.PSSync&&typeof w.PSSync.state==='function'?w.PSSync.state():null;}catch(_){return null;}}
    function build(){
      var st=d.createElement('style');st.id='psStaleNudgeCss';st.textContent=CSS;(d.head||d.documentElement).appendChild(st);
      bar=d.createElement('div');bar.id='psStaleNudge';bar.setAttribute('role','status');bar.hidden=true;
      var t=d.createElement('span');t.className='sn-t';var go=d.createElement('button');go.type='button';go.className='sn-go';go.textContent='지금 정리';
      var later=d.createElement('button');later.type='button';later.className='sn-later';later.textContent='나중에';
      bar.appendChild(t);bar.appendChild(go);bar.appendChild(later);d.body.appendChild(bar);
      go.addEventListener('click',function(){var b=d.getElementById('psAutosaveRecoveryOpen');if(b)b.click();});
      later.addEventListener('click',function(){until=Date.now()+SNOOZE;draw();});
    }
    function draw(){
      var n=need(state()),now=Date.now(),show=n>0&&now>=until;
      if(!bar){if(!show)return;build();}
      if(show){if(!since)since=now;bar.querySelector('.sn-t').textContent=text(n);
        if(!reported&&now-since>=REPORT_AFTER){reported=true;try{w.PSSync.event('items_stale_nudge',{status:'ok',feature:'sync',error_code:'shown',meta:{n:n,mins:Math.round((now-since)/60000)}});}catch(_){}}
      }else if(!n)since=0;
      if(bar.hidden===show)bar.hidden=!show;
    }
    w.addEventListener('ps-sync-state',draw);w.addEventListener('focus',draw);
    var timer=w.setInterval(draw,5000);draw();
    var api={draw:draw,stop:function(){w.clearInterval(timer);}};w.__psStaleNudge=api;return api;
  }
  return {mount:mount,need:need,text:text,SNOOZE:SNOOZE};
});
