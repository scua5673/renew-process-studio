/* Local, opt-in support material. No console/network interception or persistence.
   Free-form error text is classified and discarded, never redacted heuristically. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSupportDiagnostics=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var NAMES=('Error TypeError ReferenceError SyntaxError RangeError URIError EvalError AggregateError DOMException UnhandledRejection SyncError StorageError QuotaExceededError SecurityError NetworkError AbortError UnknownError StorageConflictError StorageOwnerChangedError StorageVerificationError PSDataLockedError').split(' ');
  var CODES=('sync_offline sync_auth sync_permission sync_storage sync_network sync_timeout sync_server sync_rate_limit sync_conflict sync_server_rejected sync_confirm_missing sync_unexpected match_not_ready match_ready_commit match_ready_invalidate match_workspace_changed 400 401 403 404 408 409 413 429 500 502 503 504 22P02 23505 42501 40001 42883 PGRST202').split(' ');
  var STAGES=('auth-recheck auth-storage blob-off bulk-pull bulk-pull-base bulk-push cache-owner-write cache-wait-ui cache-wiped conflict-restore-verify conflict-restore-write copies-purged data-lock-ui edit-idb-mirror edit-idb-mirror-drop kv-write-source-mismatch hist-restore hist-restore-deleted-skip hist-restore-verify idbk-missing idbk-scan idp-confirm-workspace idp-local-confirm-stale idp-local-rollback idp-private-base-different idp-private-base-missing idp-private-base-untrusted idp-private-import-server-shape idp-private-import-shape idp-private-local-shape idp-private-merge-missing idp-private-merge-shape idp-private-other-missing idp-private-other-shape idp-private-project idp-private-pull-missing idp-private-pull-shape idp-private-pull-stale idp-private-scrub-stale idp-private-shape idp-public-base-untrusted idp-public-import-server-shape idp-public-import-shape idp-public-local-shape idp-public-merge-missing idp-public-merge-shape idp-public-merge-stale idp-public-player-local-shape idp-public-player-pull-shape idp-public-pull-missing idp-public-pull-shape idp-public-shape import-rebase import-rebase-pending import-verify-local import-verify-server item-keys-scan items-audit items-conflict items-delete items-delete-cancel items-legacy-export items-read items-server-check items-server-old items-write kv-who-off link-identity match-mirror-write match-ready-fail-close member-remove oauth-callback-storage oauth-previous-account oauth-user-lookup orphan-owner-stash outbox-boot-read outbox-edit-mark outbox-edit-tail-recover outbox-failure-mark outbox-lock-recover perms-missing personal-channel postswitch-match-not-ready prelogout push-403-key rescue-restore-verify rescue-restore-write rt-join schedule-anchor-invalid schedule-commit-encode schedule-full-missing schedule-import-token schedule-structure-repair session-recover shared-write-barrier stash-expired switch-keys-scan switch-wipe-mirror-drop sync-base-prime-old-workspace sync-base-write undo-restore-verify undo-restore-write undo-stash usage-ping usage-token usage-user-lookup workspace-hold-prepare workspace-hold-review workspace-id-write workspace-preswitch-library-retry workspace-preswitch-pending workspace-preswitch-rejected workspace-preswitch-result workspace-stash-local-read workspace-stash-read workspace-stash-write workspace-switch-shared-ready workspace-switch-wipe match-cas-write schedule-cas-write sync storage').split(' ');
  var STORAGE_STAGES=('aux-migration aux-read-conflict idb-set migration stash-migration stash-migration-all stash-migration-conflict').split(' ');
  STORAGE_STAGES=STORAGE_STAGES.concat('schedule match roster library idp base outbox journal other'.split(' ').map(function(k){return 'idb-set-'+k;}));
  STAGES=STAGES.concat(['idp-base-history-recovered','idp-base-history-read']);
  // Fixed request phases distinguish stale-write checks from failed reads without
  // retaining workspace IDs, document keys or any caller-supplied stage suffix.
  STAGES=STAGES.concat(('kv_meta kv_pull kv_push kv_push_verify kv_push_cas kv_push_cas_verify personal_meta personal_pull personal_push personal_push_verify personal_push_cas personal_push_cas_verify library_probe library_pull library_push library_insert library_body').split(' '));
  var FILES=('daily-effort.js learn-book-coach.js learn-mikl.js learn-book-at.js roster-recovery.js idp.html shared-view-observation.js idp-evidence.js community.html balls.js index.html rpt-i18n.js learn-book-physical.js learn-book-player.js process.html req-baseline.js perms.js analysis.html learn-concepts.js football-language.js scout.html learning.html first-work.js learn-books.js terms.html sync.js playbook.html review-training-schedule.js archetypes.js team-files.js profile-sheet.js admin-user-detail.js learn-principles.js eval-standard.js learn-model.js note.html admin-operations.js scouting.html learn-toc.js board.html sync-observability.js scouting-store.js learn-futsal.js review-training.js app.html idp-recovery.js learn-curriculum-pro.js board2474.html gamemodel.html learn-book-analysis.js pitches.js learn-curriculum.js session-focus.js eval-anchors.js storage.js learn-gamemodel.js support-diagnostics.js').split(' ');
  FILES=FILES.concat(['support.js','release-notes.js','support.css','autosave-journal.js','autosave-merge.js','autosave-runtime.js','autosave-status.js','autosave-recovery.js','participation.js']);
  var CATEGORIES=('javascript network storage permission authentication conflict timeout unknown').split(' ');
  var OS=('Windows macOS iOS Android Linux ChromeOS unknown').split(' ');
  var KINDS=('error unhandledrejection sync storage').split(' ');
  var MODES=('browser standalone fullscreen minimal-ui unknown').split(' ');
  var controllers=typeof WeakMap==='function'?new WeakMap():null,defaultController=null;
  function own(v,k){try{return v&&v[k];}catch(_){return undefined;}}
  function text(v){return typeof v==='string'?v:'';}
  function pick(v,values,fallback){return values.indexOf(v)>=0?v:fallback;}
  function number(v,max){return typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.min(Math.floor(v),max):0;}
  function iso(v){var n=typeof v==='number'?v:typeof v==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v)?Date.parse(v):NaN;return Number.isFinite(n)&&n>=0&&n<=8640000000000000?new Date(n).toISOString():'';}
  function knownPath(v){return v==='/sw.js'||(v.indexOf('/studio/')===0&&FILES.indexOf(v.slice(8))>=0)?v:'';}
  function sourcePath(v,w){
    if(typeof v!=='string'||v.length>4096)return '';
    try{var location=own(w,'location'),u=new URL(v,location&&location.href||'https://diagnostics.invalid/studio/app.html');
      if(location&&u.origin!==location.origin)return '';
      if(!location&&v.charAt(0)!=='/')return '';
      return knownPath(u.pathname);
    }catch(_){return '';}
  }
  function frames(stack,w){
    // Only known static source locations survive; error text/function names do not.
    var out=[],s=text(stack).slice(0,8192),re=/(https?:\/\/[^\s)]+):(\d+):(\d+)/g,m;
    while(out.length<5&&(m=re.exec(s))){var source=sourcePath(m[1],w);if(source)out.push({source:source,line:number(+m[2],10000000),column:number(+m[3],10000000)});}
    return out;
  }
  function category(name,code,message){
    if(name==='QuotaExceededError'||name.indexOf('Storage')===0||code==='sync_storage')return 'storage';
    if(name==='SecurityError'||code==='sync_permission'||code==='403'||code==='42501')return 'permission';
    if(name==='PSDataLockedError'||code==='sync_auth'||code==='401')return 'authentication';
    if(code==='sync_conflict'||code==='409')return 'conflict';
    if(code==='sync_timeout'||code==='408'||/\b(?:timed out|timeout)\b/i.test(message))return 'timeout';
    if(name==='NetworkError'||code==='sync_network'||code==='sync_offline'||/failed to fetch|network ?error|load failed/i.test(message))return 'network';
    if(['TypeError','ReferenceError','SyntaxError','RangeError','URIError','EvalError'].indexOf(name)>=0)return 'javascript';
    return 'unknown';
  }
  function sanitizeLog(kind,input,w,at){
    var value=input||{},error=own(value,'error')||own(value,'reason')||value;
    var name=pick(own(error,'name'),NAMES,kind==='unhandledrejection'?'UnhandledRejection':'Error');
    var rawCode=own(error,'psCode')||own(error,'code'),code=pick(typeof rawCode==='number'?String(rawCode):rawCode,CODES,'');
    var stage=pick(own(value,'stage'),STAGES,'');
    if(kind==='storage'&&!stage){var prefix=text(own(value,'stage')).split(':')[0];stage=pick(prefix,STORAGE_STAGES,'');}
    var resource=own(value,'target'),locations=frames(own(error,'stack'),w),source=sourcePath(own(value,'filename')||own(value,'source')||own(resource,'src')||own(resource,'href'),w);
    var line=number(own(value,'lineno')||own(value,'line'),10000000),column=number(own(value,'colno')||own(value,'column'),10000000);
    if(!source&&locations.length){source=locations[0].source;line=locations[0].line;column=locations[0].column;}
    if(!source){line=0;column=0;}
    return {at:iso(at),kind:pick(kind,KINDS,'error'),name:name,code:code,stage:stage,category:category(name,code,text(own(error,'message')||own(value,'message')).slice(0,2048)),source:source,line:line,column:column,frames:locations};
  }
  function language(v){return /^(?:[a-z]{2})(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-\d{3})?$/.test(text(v))?v:'';}
  function zone(v){try{if(typeof v!=='string'||v.length>64)return '';return new Intl.DateTimeFormat('en',{timeZone:v}).resolvedOptions().timeZone;}catch(_){return '';}}
  function browser(ua){
    var names=[['Edge',/Edg(?:A|iOS)?\/([\d.]+)/],['Opera',/(?:OPR|OPiOS)\/([\d.]+)/],['SamsungInternet',/SamsungBrowser\/([\d.]+)/],['Firefox',/(?:Firefox|FxiOS)\/([\d.]+)/],['Chrome',/(?:Chrome|CriOS)\/([\d.]+)/],['Safari',/Version\/([\d.]+).*Safari/]];
    for(var i=0;i<names.length;i++){var match=ua.match(names[i][1]);if(match)return names[i][0]+' '+match[1].split('.').slice(0,2).join('.').slice(0,12);}
    return 'unknown';
  }
  function environment(w){
    var nav=own(w,'navigator')||{},ua=text(own(nav,'userAgent')),screen=own(w,'screen')||{},os='unknown',displayMode='browser',timeZone='';
    if(/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&own(nav,'maxTouchPoints')>1))os='iOS';
    else if(/Android/.test(ua))os='Android';else if(/CrOS/.test(ua))os='ChromeOS';else if(/Windows/.test(ua))os='Windows';else if(/Macintosh|Mac OS/.test(ua))os='macOS';else if(/Linux/.test(ua))os='Linux';
    try{timeZone=zone(w.Intl.DateTimeFormat().resolvedOptions().timeZone);}catch(_){}
    try{if(nav.standalone===true)displayMode='standalone';else ['fullscreen','standalone','minimal-ui'].some(function(mode){if(w.matchMedia('(display-mode: '+mode+')').matches){displayMode=mode;return true;}return false;});}catch(_){}
    var version=text(own(w,'PS_BUILD'));
    return {appVersion:/^\d+(?:\.\d+){1,3}$/.test(version)&&version.length<=24?version:'',browser:browser(ua),os:os,viewport:{width:number(own(w,'innerWidth'),20000),height:number(own(w,'innerHeight'),20000)},screen:{width:number(own(screen,'width'),20000),height:number(own(screen,'height'),20000)},language:language(own(nav,'language')),timeZone:timeZone,online:own(nav,'onLine')!==false,displayMode:displayMode,path:sourcePath(own(own(w,'location'),'pathname'),w)};
  }
  function safeSnapshot(value){
    // format() also treats its argument as untrusted: never JSON.stringify it.
    var v=value||{},e=own(v,'environment')||{},logs=own(v,'logs'),b=text(own(e,'browser'));
    var env={appVersion:/^\d+(?:\.\d+){1,3}$/.test(text(e.appVersion))&&e.appVersion.length<=24?e.appVersion:'',browser:/^(?:Chrome|Edge|Firefox|Safari|SamsungInternet|Opera|WebView) \d{1,6}(?:\.\d{1,6})?$/.test(b)?b:'unknown',os:pick(e.os,OS,'unknown'),viewport:{width:number(own(e.viewport,'width'),20000),height:number(own(e.viewport,'height'),20000)},screen:{width:number(own(e.screen,'width'),20000),height:number(own(e.screen,'height'),20000)},language:language(e.language),timeZone:zone(e.timeZone),online:e.online===true,displayMode:pick(e.displayMode,MODES,'unknown'),path:knownPath(text(e.path))};
    return {capturedAt:iso(v.capturedAt),environment:env,logs:Array.isArray(logs)?logs.slice(-40).map(function(log){
      var r=sanitizeLog(own(log,'kind'),log,null,own(log,'at'));r.category=pick(own(log,'category'),CATEGORIES,'unknown');
      r.frames=Array.isArray(own(log,'frames'))?log.frames.slice(0,5).map(function(f){var source=knownPath(text(own(f,'source')));return source?{source:source,line:number(own(f,'line'),10000000),column:number(own(f,'column'),10000000)}:null;}).filter(Boolean):[];
      return r;
    }):[]};
  }
  function format(value){
    var s=safeSnapshot(value),e=s.environment,labels={javascript:'자바스크립트 오류',network:'네트워크 오류',storage:'기기 저장 오류',permission:'권한 오류',authentication:'로그인 확인 오류',conflict:'동기화 충돌',timeout:'응답 시간 초과',unknown:'분류되지 않은 오류'};
    var lines=['PROCESS STUDIO 오류 진단','수집 시각: '+s.capturedAt,'버전: '+(e.appVersion||'알 수 없음'),'브라우저 / OS: '+e.browser+' / '+e.os,'화면: '+e.viewport.width+'×'+e.viewport.height+' (기기 '+e.screen.width+'×'+e.screen.height+')','언어 / 시간대: '+e.language+' / '+e.timeZone,'연결 / 실행: '+(e.online?'온라인':'오프라인')+' / '+e.displayMode,'경로: '+e.path,'','최근 오류 ('+s.logs.length+'개):'];
    s.logs.forEach(function(log){lines.push(log.at+' ['+log.kind+'] '+labels[log.category]+' · '+log.name+(log.code?' · '+log.code:'')+(log.stage?' · '+log.stage:''));if(log.source)lines.push('  '+log.source+':'+log.line+':'+log.column);log.frames.forEach(function(f){lines.push('  ↳ '+f.source+':'+f.line+':'+f.column);});});
    if(!s.logs.length)lines.push('기록된 오류 없음');
    lines.push('','개인정보 보호를 위해 원문 오류 메시지·계정·자료·URL 쿼리 및 해시는 포함하지 않습니다.');return lines.join('\n');
  }
  function createCollector(options){
    var opts=options||{},w=opts.window,now=opts.now||Date.now,logs=[],bindings=[],active=false,owner=null,generation=0;
    function identity(){
      try{var storage=w.localStorage,seal=storage.getItem('ps_cache_owner_v1')||'',cached=JSON.parse(seal||'null'),sync=w.PSSync,uid=sync&&typeof sync.session==='function'?String((sync.session()||{}).uid||''):String(cached&&cached.uid||'');
        // Read identity markers only. Never read the persisted token/session document.
        return JSON.stringify([uid,storage.getItem('ps_active_ws')||'',seal,storage.getItem('ps_ws_switch_epoch_v1')||'',storage.getItem('ps_ws_switch_guard_v1')||'']);
      }catch(_){return null;}
    }
    function check(){var next=identity();if(next!==owner){owner=next;logs=[];generation++;}return next!==null;}
    function current(binding){
      if(!active)return false;var readable=check();
      try{if(binding.window.document!==binding.document)return false;if(binding.window===w)return true;
        var parentBinding=bindings.find(function(b){return b.window===binding.parent&&b.document===binding.parent.document;});
        return readable&&binding.generation===generation&&binding.frame.isConnected&&binding.frame.contentWindow===binding.window&&binding.frame.ownerDocument===binding.parent.document&&parentBinding&&current(parentBinding);
      }catch(_){return false;}
    }
    function record(kind,value,binding){
      if(!current(binding))return false;
      // sync.js emits this uncoded Error only after old copies were cleaned up.
      // It is successful maintenance; coded failures remain support errors.
      if(kind==='sync'&&own(value,'stage')==='copies-purged'&&own(value,'name')==='Error'&&!own(value,'code')&&!own(value,'psCode')&&!own(value,'error')&&!own(value,'reason'))return false;
      logs.push(sanitizeLog(kind,value,binding.window,now()));if(logs.length>40)logs.shift();return true;
    }
    function remove(binding){binding.listeners.forEach(function(x){try{x[0].removeEventListener(x[1],x[2],x[3]);}catch(_){}});if(binding.observer)binding.observer.disconnect();}
    function prune(){bindings=bindings.filter(function(b){try{if(b.window===w||(b.frame.isConnected&&b.window.document===b.document))return true;}catch(_){}remove(b);return false;});}
    function attach(win,frame,parent){
      try{
        if(!active||win.location.origin!==w.location.origin)return null;
        if(frame&&(!frame.isConnected||frame.contentWindow!==win||frame.ownerDocument!==parent.document))return null;
        var doc=win.document,existing=bindings.find(function(b){return b.document===doc;});if(existing)return existing;
        check();var binding={window:win,document:doc,frame:frame,parent:parent,generation:generation,listeners:[],observer:null};bindings.push(binding);
        function on(target,event,fn,capture){target.addEventListener(event,fn,!!capture);binding.listeners.push([target,event,fn,!!capture]);}
        on(win,'error',function(event){record('error',event,binding);},true);
        on(win,'unhandledrejection',function(event){record('unhandledrejection',event,binding);});
        on(win,'ps-sync-diagnostic',function(event){record('sync',own(event,'detail'),binding);});
        on(win,'ps-storage-diagnostic',function(event){record('storage',own(event,'detail'),binding);});
        function scan(){if(!active)return;prune();Array.prototype.forEach.call(doc.querySelectorAll('iframe'),function(f){try{attach(f.contentWindow,f,win);}catch(_){}});}
        // The child may call parent.PSSupportDiagnostics.attachFrame(window)
        // before its first script. The load fallback deduplicates that document.
        on(doc,'load',scan,true);on(doc,'DOMContentLoaded',scan);
        if(win===w){['ps-auth-state','ps-sync-state','storage','pageshow','focus'].forEach(function(event){on(win,event,check);});}
        if(win.MutationObserver){binding.observer=new win.MutationObserver(function(records){if(records.some(function(r){return r.addedNodes.length||r.removedNodes.length;}))scan();});binding.observer.observe(doc,{childList:true,subtree:true});}
        scan();return binding;
      }catch(_){return null;}
    }
    function attachFrame(child){
      if(!active||!child||child===w||!check())return false;
      try{
        var chain=[],cur=child;
        while(cur!==w&&chain.length<12){
          var parent=cur.parent,frame=cur.frameElement;
          if(cur.location.origin!==w.location.origin||!frame||parent===cur||!frame.isConnected||frame.contentWindow!==cur||frame.ownerDocument!==parent.document)return false;
          chain.push({window:cur,frame:frame,parent:parent});cur=parent;
        }
        if(cur!==w)return false;prune();
        for(var i=chain.length-1;i>=0;i--){var part=chain[i],bound=attach(part.window,part.frame,part.parent);if(!bound||!current(bound))return false;}
        return true;
      }catch(_){return false;}
    }
    var api={start:function(){if(active||!w)return api;active=true;owner=identity();attach(w,null,null);return api;},stop:function(){active=false;bindings.forEach(remove);bindings=[];logs=[];generation++;},clear:function(){logs=[];},attachFrame:attachFrame,snapshot:function(){check();return {capturedAt:iso(now()),environment:environment(w),logs:logs.map(function(log){return JSON.parse(JSON.stringify(log));})};},format:format};
    return api;
  }
  function install(w){
    if(!w&&typeof window!=='undefined')w=window;if(!w)return null;
    var existing=controllers&&controllers.get(w);if(existing){existing.start();defaultController=existing;return existing;}
    var controller=createCollector({window:w});controller.start();if(controllers)controllers.set(w,controller);defaultController=controller;return controller;
  }
  function snapshot(options){var controller=options&&options.window?install(options.window):defaultController;return controller?controller.snapshot():{capturedAt:iso(Date.now()),environment:environment(null),logs:[]};}
  function attachFrame(child,options){var controller=options&&options.window?install(options.window):defaultController;return !!controller&&controller.attachFrame(child);}
  return {install:install,attachFrame:attachFrame,snapshot:snapshot,format:format,createCollector:createCollector,sanitizeLog:sanitizeLog,environment:environment};
});
