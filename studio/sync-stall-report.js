/* 3.259 — 막힌 기기 미리 알아채기. 이 기기에 올라갈 팀 변경이 있는데 몇 시간째 동기화 회차가 한 번도 끝나지 않으면
   ps_events sync_stalled 한 줄을 남긴다 — 대기 수 · 시간 · 상태 · 최근 진단 단계(stage:code) · 저장소 크기 · 동기화 잠금 수만(내용 없음).
   제보 e6fc5d26 의 맥은 5일 동안 아무것도 못 올렸는데 서버엔 흔적이 거의 없었다: 가득 찬 작은 저장소가 기기 보고(ps_sync_reports)까지 막았고,
   원인은 사람이 오류 제보를 다시 보내야만 볼 수 있었다. 이 기록은 이벤트 대기열이 가득 차도 메모리로 한 번은 나간다(sync.js eventTrack).
   맨 위 창(app.html)에서만 돈다. 판정은 순수 함수 assess · meta 로 나눠 시험이 그대로 부른다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSSyncStall=api;
  try{if(root&&root.top===root&&root.document)api.mount(root);}catch(_){}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var H=3600000,STALL_MS=2*H,GRACE_MS=5*60000,EVERY_MS=5*60000,REPEAT_MS=6*H,KEY='ps_sync_stall_at';
  function num(v){v=+v;return Number.isFinite(v)?v:0;}
  function hours(ms){return Math.round(Math.max(0,ms)/H*10)/10;}
  /* 막힘: 로그인 · 자료 열림 · 온라인 · 보이는 화면 · 부팅 뒤 5분이 지났고, 대기 변경이 2시간 넘게 남았는데 마지막으로 끝난 회차도 2시간 넘게 전.
     같은 기기에서는 6시간에 한 번. 오프라인 · 숨은 화면은 «막힘»이 아니다(회차가 원래 안 돈다). */
  function assess(s){
    s=s||{};var now=num(s.now),p=s.pending||{},n=num(p.count),oldest=num(p.oldest),last=num(s.lastPull),grace=s.graceMs==null?GRACE_MS:num(s.graceMs);
    if(!s.signedIn||!s.unlocked)return {stalled:false,why:'locked'};
    if(s.online===false)return {stalled:false,why:'offline'};
    if(s.visible===false)return {stalled:false,why:'hidden'};
    if(now-num(s.bootAt)<grace)return {stalled:false,why:'boot'};
    if(n<=0)return {stalled:false,why:'empty'};
    if(!oldest||now-oldest<STALL_MS)return {stalled:false,why:'fresh'};
    if(last&&now-last<STALL_MS)return {stalled:false,why:'recent'};
    if(num(s.sentAt)&&now-num(s.sentAt)<REPEAT_MS)return {stalled:false,why:'sent'};
    return {stalled:true,why:'stalled'};
  }
  function step(d){return d?String(d.stage||'?').slice(0,24)+(d.code?':'+String(d.code).slice(0,24):''):'';}
  /* meta 는 sync.js safeEventMeta 가 받는 모양만: 12칸, 숫자 · 참거짓, 문자열은 stage · msg · reason 만. 사용자 글 · 키 값은 넣지 않는다. */
  function meta(s){
    s=s||{};var now=num(s.now),p=s.pending||{},last=num(s.lastPull),log=Array.isArray(s.diag)?s.diag:[];
    var m={n:num(p.count),oh:hours(now-num(p.oldest)),ph:last?hours(now-last):-1,ls:Math.round(num(s.localBytes)/1024),
      stage:step(log[log.length-1]).slice(0,80),msg:log.slice(-6).map(step).join(',').slice(0,120),
      reason:String(s.state&&(s.state.reason||s.state.kind)||'').slice(0,40),sa:!!s.standalone};
    if(s.locks){m.lh=num(s.locks.held);m.lq=num(s.locks.pending);}
    if(s.quota){m.useMb=num(s.quota.useMb);m.quotaMb=num(s.quota.quotaMb);}
    return m;
  }
  var api={assess:assess,meta:meta,KEY:KEY,STALL_MS:STALL_MS,REPEAT_MS:REPEAT_MS,check:function(){return Promise.resolve(null);}};
  api.mount=function(win){
    if(!win||win.__psSyncStallMounted)return;win.__psSyncStallMounted=true;
    var bootAt=Date.now(),sentMem=0,busy=false,nav=win.navigator||{};
    function read(k){try{return win.localStorage.getItem(k);}catch(_){return null;}}
    function locks(){var L=nav.locks;if(!L||typeof L.query!=='function')return Promise.resolve(null);
      return L.query().then(function(q){function c(a){return (a||[]).filter(function(x){return /^process-studio-sync-/.test(String(x&&x.name||''));}).length;}return {held:c(q&&q.held),pending:c(q&&q.pending)};},function(){return null;});}
    function quota(){var S=nav.storage;if(!S||typeof S.estimate!=='function')return Promise.resolve(null);
      return S.estimate().then(function(e){return {useMb:Math.round(num(e&&e.usage)/1048576),quotaMb:Math.round(num(e&&e.quota)/1048576)};},function(){return null;});}
    function check(){
      var S=win.PSSync;if(busy||!S||typeof S.event!=='function')return Promise.resolve(null);
      var s;try{s={now:Date.now(),bootAt:bootAt,graceMs:win.__psSyncStallGraceMs,signedIn:!!(S.session&&S.session()),unlocked:!!(S.dataUnlocked&&S.dataUnlocked()),
        online:nav.onLine!==false,visible:!win.document||win.document.visibilityState!=='hidden',pending:S.pending?S.pending():null,
        lastPull:read('ps_last_pull_at'),sentAt:Math.max(num(read(KEY)),sentMem)};}catch(_){return Promise.resolve(null);}
      var a=assess(s);if(!a.stalled)return Promise.resolve(a);
      busy=true;
      return Promise.all([locks(),quota()]).then(function(r){
        s.locks=r[0];s.quota=r[1];s.now=Date.now();
        try{s.state=S.state?S.state():null;}catch(_){}
        try{s.diag=S.diagLog?S.diagLog():[];}catch(_){}
        try{s.localBytes=win.PSStorage&&win.PSStorage.localBytes?win.PSStorage.localBytes():0;}catch(_){}
        try{s.standalone=!!(win.matchMedia&&win.matchMedia('(display-mode: standalone)').matches)||nav.standalone===true;}catch(_){}
        var m=meta(s);
        sentMem=s.now;try{win.localStorage.setItem(KEY,String(s.now));}catch(_){}
        S.event('sync_stalled',{status:'error',feature:'sync',error_code:m.reason||'none',meta:m});
        busy=false;return {stalled:true,why:'stalled',meta:m};
      },function(){busy=false;return null;});
    }
    api.check=check;
    try{win.setInterval(check,EVERY_MS);win.setTimeout(check,GRACE_MS+5000);
      if(win.document)win.document.addEventListener('visibilitychange',function(){if(win.document.visibilityState==='visible')check();});}catch(_){}
  };
  return api;
});
