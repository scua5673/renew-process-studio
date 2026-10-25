/* Public backend configuration. Hosted builds replace only the embedded payload.
   Source/fixture defaults are synthetic and cannot reach a Supabase project. */
(function(root,factory){
  'use strict';
  var embedded={environment:'synthetic',url:'https://synthetic-backend.invalid',anonKey:'synthetic-public-key',project:'synthetic'}; // PS_BACKEND_EMBED
  var api=factory(embedded);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&!root.PSBackendConfig){root.PSBackendConfig=api;api.install(root);}
})(typeof window==='undefined'?null:window,function(embedded){
  'use strict';
  function origin(value){try{return new URL(value).origin;}catch(_){return '';}}
  function issue(){var e=new Error('backend_environment_mismatch');e.name='BackendEnvironmentError';return e;}
  function config(){return {url:embedded.url,anonKey:embedded.anonKey};}
  function install(w){
    var expected=origin(embedded.url),priorOrigin='',blocked=false;
    function tokenMatches(token){
      if(embedded.environment==='synthetic'||token===embedded.anonKey)return true;
      try{
        var parts=String(token||'').split('.');if(parts.length!==3)return false;
        var encoded=parts[1].replace(/-/g,'+').replace(/_/g,'/');while(encoded.length%4)encoded+='=';
        var claims=JSON.parse(w.atob(encoded)),issuer=new URL(claims.iss);
        return issuer.origin===expected&&/^\/auth\/v1\/?$/.test(issuer.pathname)&&(!claims.ref||claims.ref===embedded.project);
      }catch(_){return false;}
    }
    function session(){try{var raw=w.localStorage.getItem('ps_sync_session');return raw?JSON.parse(raw):null;}catch(_){blocked=true;return null;}}
    function checkSession(){var s=session();if(s&&(s.at||s.rt)&&!tokenMatches(s.at))blocked=true;return !blocked;}
    try{var raw=w.localStorage.getItem('ps_sync_cfg');if(raw){var prior=JSON.parse(raw);priorOrigin=origin(prior&&prior.url);blocked=priorOrigin!==expected;}}catch(_){blocked=true;}
    checkSession();
    try{var callback=new URL(w.location.href).hash.slice(1),params=new URLSearchParams(callback);if((params.has('access_token')||params.has('refresh_token'))&&!tokenMatches(params.get('access_token')))blocked=true;}catch(_){blocked=true;}
    function current(){checkSession();return blocked?{url:'',anonKey:''}:config();}
    function bearer(headers){
      if(!headers)return '';if(typeof headers.get==='function')return String(headers.get('authorization')||'');
      if(Array.isArray(headers)){for(var i=0;i<headers.length;i++)if(String(headers[i][0]).toLowerCase()==='authorization')return String(headers[i][1]);}
      else for(var k in headers)if(k.toLowerCase()==='authorization')return String(headers[k]);return '';
    }
    function allowed(input,init){
      var u;try{u=new URL(typeof input==='string'?input:(input&&input.url)||String(input),w.location.href);}catch(_){return true;}
      var isBackend=/\.(?:supabase\.co|supabase\.in)$/.test(u.hostname)||u.origin===expected||u.origin===priorOrigin||/^\/(?:auth|rest|realtime|storage|functions)\/v1(?:\/|$)/.test(u.pathname);
      if(!isBackend)return true;
      if(!checkSession()||u.origin!==expected)return false;
      if(embedded.environment==='synthetic')return true;
      var auth=bearer(init&&init.headers||input&&input.headers),match=/^Bearer\s+(.+)$/i.exec(auth);
      if(match&&!tokenMatches(match[1]))return false;
      if(u.pathname==='/auth/v1/token'&&u.searchParams.get('grant_type')==='refresh_token'){
        var s=session(),body;try{body=JSON.parse(init&&init.body);}catch(_){return false;}
        if(!s||!tokenMatches(s.at)||!s.rt||body.refresh_token!==s.rt)return false;
      }
      return true;
    }
    if(typeof w.fetch==='function'){
      var fetch=w.fetch;w.fetch=function(input,init){return allowed(input,init)?fetch.apply(this,arguments):Promise.reject(issue());};
    }
    if(typeof w.WebSocket==='function'){
      var Socket=w.WebSocket,Guarded=function(url,protocols){
        var endpoint=String(url).replace(/^ws:/,'http:').replace(/^wss:/,'https:');if(!allowed(endpoint))throw issue();
        var socket=arguments.length<2?new Socket(url):new Socket(url,protocols),send=socket.send;
        if(typeof send==='function')socket.send=function(data){
          if(!allowed(endpoint))throw issue();
          if(embedded.environment!=='synthetic'&&typeof data==='string'){
            var value;try{value=JSON.parse(data);}catch(_){}
            function valid(v){if(!v||typeof v!=='object')return true;return Object.keys(v).every(function(k){return k==='access_token'?tokenMatches(v[k]):valid(v[k]);});}
            if(!valid(value))throw issue();
          }
          return send.apply(this,arguments);
        };
        return socket;
      };
      Guarded.prototype=Socket.prototype;Object.setPrototypeOf(Guarded,Socket);w.WebSocket=Guarded;
    }
    api.current=current;api.blocked=function(){return blocked;};w.PS_SYNC=current();
    if(blocked&&w.document){
      var show=function(){if(w.document.getElementById('psBackendMismatch'))return;var box=w.document.createElement('div');box.id='psBackendMismatch';box.setAttribute('role','alert');box.textContent='이 환경에는 기존 기기 자료를 연결하지 않았습니다. 별도 브라우저 프로필에서 열어 주세요. 기존 자료는 그대로 보존했습니다.';box.style.cssText='position:fixed;inset:16px 16px auto;z-index:2147483647;padding:16px;background:var(--bar,#fff);color:var(--txt,#14213d);border:1px solid var(--line,#d1d5db);border-radius:12px;font:inherit;font-weight:500;line-height:1.6';w.document.body.appendChild(box);};
      if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',show,{once:true});else show();
    }
    return current();
  }
  var api={environment:embedded.environment,project:embedded.project,config:config,current:config,install:install};return api;
});
