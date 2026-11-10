/* PROCESS STUDIO — 로그인 콜백 문지기(3.272, 보안 점검 «login CSRF»)
   로그인은 implicit flow 다: 인증 서버가 `#access_token=…&refresh_token=…` 를 주소에 붙여 돌려보내고 sync.js consumeHash · admin.html 이 그대로 저장했다.
   그래서 남이 만든 링크(`…/studio/app.html#access_token=공격자&refresh_token=공격자`)를 누르기만 해도 그 사람 계정으로 로그인되고,
   그 뒤 적는 명단 · 평가가 그 사람 공간으로 올라갔다.
   이제 이 브라우저가 스스로 로그인을 시작했을 때만 받는다:
     · begin(provider)  로그인 단추(signIn · linkIdentity · admin signIn)가 떠나기 직전에 «시작함» 표식을 적는다
                        (sessionStorage + localStorage — 설치 앱은 돌아오는 창이 달라 sessionStorage 가 비어 있을 수 있다)
     · take(p)          콜백이 토큰을 저장하기 직전에 표식을 한 번만 쓴다. 없거나 10분이 지났거나, 시작할 때와 다른 계정이 그 사이 로그인해 있거나,
                        «로그인 방법 연결»로 떠났는데 다른 계정의 토큰이 왔으면
                        받지 않는다 — 주소의 토큰을 지우고, 지금 로그인한 계정은 그대로 두고, 까닭을 화면에 말한다.
   표식에는 비밀이 없다(시각 · 그때 로그인해 있던 uid). 응답과 묶인 값이 아니므로 «내가 로그인을 누른 뒤 10분 안»의 틈은 남는다 — 막으려면 PKCE(code flow)로 옮겨야 한다.
   이 파일이 없으면 sync.js 는 예전처럼 받는다(로그인이 막히지 않게). 시험 tests/oauth-gate-3272 · 브라우저 oauth-callback-gate. */
(function(root,factory){
  'use strict';
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document)root.PSOAuthGate=api.mount(root);
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var KEY='ps_oauth_pending_v1',TTL=10*60*1000,SKEY='ps_sync_session';
  function mount(win){
    var last=null;
    function store(name,w){try{return (w||win)[name]||null;}catch(_){return null;}}
    function read(s){
      try{var o=JSON.parse((s&&s.getItem(KEY))||'null');return o&&typeof o==='object'&&typeof o.t==='number'?o:null;}catch(_){return null;}
    }
    function drop(){
      [store('sessionStorage'),store('localStorage')].forEach(function(s){try{if(s)s.removeItem(KEY);}catch(_){}});
    }
    function uid(){
      try{var s=JSON.parse(store('localStorage').getItem(SKEY)||'null');return s&&s.uid?String(s.uid):'';}catch(_){return '';}
    }
    /* 로그인으로 떠나기 직전. w = 실제로 떠나는 창(iframe 에서 누르면 맨 위 창) */
    function begin(provider,w){
      /* provider 없이 부르면 «로그인 방법 연결»(linkIdentity) — 돌아오는 토큰은 지금 계정의 것이어야 한다 */
      var mark=JSON.stringify({t:Date.now(),from:uid(),link:provider?0:1}),ok=false;
      [store('sessionStorage',w),store('localStorage',w)].forEach(function(s){try{if(s){s.setItem(KEY,mark);ok=true;}}catch(_){}});
      try{if(provider)store('sessionStorage',w).setItem('ps_oauth_provider',provider);}catch(_){}
      return ok;
    }
    /* 토큰(JWT)의 주인 uid. 읽지 못하면 '' — 그때는 막지 않는다(판정은 서버가 한다) */
    function subject(token){
      try{
        var part=String(token||'').split('.')[1]; if(!part)return '';
        part=part.replace(/-/g,'+').replace(/_/g,'/'); while(part.length%4)part+='=';
        var o=JSON.parse(win.atob?win.atob(part):atob(part));
        return o&&typeof o.sub==='string'?o.sub:'';
      }catch(_){ return ''; }
    }
    function verdict(mark,now,current,sub){
      if(!mark)return 'none';
      var age=now-mark.t;
      if(!(age>=0&&age<=TTL))return 'stale';
      if(current&&String(mark.from||'')!==current)return 'other-user';   /* 시작한 뒤 다른 계정이 로그인해 있다 — 말없이 바꾸지 않는다 */
      if(mark.link&&current&&sub&&sub!==current)return 'other-user';      /* 연결하러 갔는데 다른 계정의 토큰이 왔다 */
      return '';
    }
    function clearUrl(){
      try{win.history.replaceState(null,'',win.location.pathname+win.location.search);}catch(_){}
      try{if(/(?:^#|&)(?:access_token|refresh_token)=/.test(win.location.hash||''))win.location.hash='';}catch(_){}
    }
    function notice(why){
      var doc=win.document;if(!doc)return;
      function show(){
        try{
          if(!doc.body||doc.getElementById('psOAuthRefused'))return;
          var box=doc.createElement('div'),text=doc.createElement('span'),close=doc.createElement('button');
          box.id='psOAuthRefused';box.setAttribute('role','alert');box.dataset.why=why;
          box.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;max-width:min(560px,calc(100vw - 24px));display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:#14161A;color:#fff;font:600 13px/1.5 Pretendard,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)';
          text.textContent=why==='stale'
            ?'로그인 응답이 너무 늦게 도착해 받지 않았어요. 다시 로그인해 주세요.'
            :(why==='other-user'
              ?'다른 계정이 이미 로그인해 있어 새 로그인 응답을 받지 않았어요. 계정을 바꾸려면 먼저 로그아웃한 뒤 로그인해 주세요.'
              :'이 브라우저에서 시작하지 않은 로그인 응답이라 받지 않았어요. 받은 링크로 들어왔다면 그 링크를 쓰지 말고, 로그인 단추로 다시 로그인해 주세요.');
          close.type='button';close.textContent='닫기';close.setAttribute('aria-label','알림 닫기');
          close.style.cssText='flex:none;border:0;border-radius:8px;padding:4px 10px;background:rgba(255,255,255,.16);color:#fff;font:inherit;cursor:pointer';
          close.onclick=function(){try{box.remove();}catch(_){}};
          box.appendChild(text);box.appendChild(close);doc.body.appendChild(box);
        }catch(_){}
      }
      if(doc.body)show();else try{doc.addEventListener('DOMContentLoaded',show);}catch(_){}
      /* 왜 받지 않았는지 한 줄(내용 없음 — 까닭 코드만). 잘못 막는 일이 생기면 이 줄로 본다 */
      try{win.setTimeout(function(){try{var S=win.PSSync;if(S&&typeof S.event==='function')S.event('oauth_callback_refused',{status:'blocked',feature:'auth',error_code:why});}catch(_){}} ,4000);}catch(_){}
    }
    /* 콜백이 토큰을 저장하기 직전: 받을 수 있으면 true(표식은 지운다 — 한 번만) */
    function take(params){
      var mark=read(store('sessionStorage'))||read(store('localStorage'));
      drop();
      var why=verdict(mark,Date.now(),uid(),subject(params&&params.access_token));
      last=why||'ok';
      if(!why)return true;
      clearUrl();notice(why);
      return false;
    }
    return {begin:begin,take:take,last:function(){return last;},KEY:KEY,TTL:TTL,_verdict:verdict};
  }
  return {mount:mount,KEY:KEY,TTL:TTL};
});
