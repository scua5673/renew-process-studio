/* Shared presentation for the sync engine's confirmed state. No storage writes. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAutosaveStatus=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* 3.039 — 안내 문구가 가리키는 메뉴는 이 두 상수 한 곳(피드백 CP-11 — «기기 › 동기화 진단» · «자료 확인» · «고급 복구»는 없는 메뉴였다).
     앱 설정 탭 이름이 바뀌면 여기와 tests/settings-paths-3039 를 같이 고친다. */
  var PATH_DIAG='앱 설정 › 데이터 › «진단 보기»', PATH_HELD='앱 설정 › 데이터 › 보관된 변경 › «보관 내용 보기»';
  /* 2.941 — 운영 기준 «24시간 넘는 미해결 저장 문제 0건»(외부 검토 피드백). 기기 안 대기열의 가장 오래된 항목이 하루를 넘으면
     «저장 대기»로 조용히 두지 않고 며칠째인지 말한다. 저장 중·로그인 필요는 그대로(다음 할 일이 이미 분명하다). */
  function view(state){
    var r=baseView(state),s=state||{},n=Math.max(0,Number(s.n)||0),oldest=Number(s.oldest)||0,now=Number(s.now)||Date.now();
    var days=(n&&oldest>0&&now>oldest)?Math.floor((now-oldest)/86400000):0;
    /* 2.952 — 보관한 변경(고를 것)이 있으면 «N일째 저장 대기»로 덮지 않는다 — 기다려서 풀리는 일이 아니다(코치 점검 10/7).
       ⚠ 띠에서 문서 선택창을 열지는 않는다(조용한 저장 표시 원칙 — 아래 테스트). 고르는 곳은 앱 설정 › 데이터 › 보관된 변경(PATH_HELD). */
    if(r.kind==='held'&&(Number(s.review)>0||s.kind==='ask'||s.kind==='held'))return r;
    if(days>=1&&r.kind!=='off'&&r.kind!=='busy'&&r.action!=='login')
      return {kind:'bad',text:days+'일째 저장 대기 · '+n+'건',detail:'변경사항은 이 기기에 남아 있지만 '+days+'일 넘게 서버에 올라가지 못했어요. «다시 시도»로도 안 되면 '+PATH_DIAG+'에서 이유를 보거나 «오류 제보»로 알려 주세요.',action:r.action||'retry',attention:true,complete:false};
    return r;
  }
  function baseView(state){
    var s=state||{},kind=s.kind,n=Math.max(0,Number(s.n)||0),review=Math.max(0,Number(s.review)||0),archived=Math.max(0,Number(s.archivedCount)||0);
    function result(k,text,detail,action,attention,complete){return {kind:k,text:text,detail:detail,action:action||'',attention:!!attention,complete:!!complete};}
    if(!state||kind==='off')return result('off','로그인하면 자동으로 저장됩니다','로그인 후 저장 상태를 확인할 수 있습니다.');
    if(kind==='bad'){
      if(s.reason==='sync_offline')return result('bad','오프라인 · 저장 대기','인터넷에 연결되면 다시 저장합니다.','retry',true);
      if(s.reason==='sync_auth')return result('bad','로그인이 필요해요','다시 로그인한 뒤 저장을 이어갑니다.','login',true);
      if(s.reason==='sync_storage')return result('bad','기기 저장을 확인해 주세요','미저장 자료를 보존하고 저장소 진단을 확인한 뒤 다시 시도해 주세요.','retry',true);
      if(s.reason==='sync_local_changed'||s.reason==='sync_workspace_changed')return result('bad','변경된 작업을 다시 확인하고 있어요','계정·팀 또는 새 편집이 바뀌어 이전 작업을 멈췄습니다. 현재 화면에서 다시 확인해 주세요.','retry',true);
      if(s.reason==='sync_permission')return result('bad','저장 권한을 확인해 주세요','이 자료를 저장할 권한을 확인하지 못했습니다.','retry',true);
      if(s.reason==='sync_server_rejected')return result('bad','서버에 저장이 반영되지 않았어요','다시 시도해도 같으면 오류 제보로 알려 주세요. 저장 완료는 아직 확인되지 않았습니다.','retry',true);
      if(s.reason==='sync_conflict')return result('bad','다른 저장 내용을 확인하고 있어요','기기와 서버의 저장 내용이 달라 다시 확인해야 합니다. 같은 문제가 반복되면 오류 제보로 알려 주세요.','retry',true);
      if(s.reason==='sync_confirm_missing')return result('bad','저장 상태를 다시 확인해 주세요','저장 기록이 일치하지 않아 완료 여부를 확인하지 못했습니다. 다시 시도해 주세요.','retry',true);
      return result('bad','저장을 확인하지 못했어요','변경사항의 서버 저장 여부를 확인하지 못했습니다. 다시 시도해 주세요.','retry',true);
    }
    if(kind==='busy')return result('busy','저장 중…','변경사항의 서버 저장을 확인하고 있습니다.');
    /* 2.952 — 보관한 변경은 기다려서 풀리지 않는다 — 고르는 곳(PATH_HELD)을 말한다. 숫자·«문서 전체»는 여전히 띠에 적지 않는다. */
    if(review||kind==='ask'||kind==='held')return result('held','일부 변경 보관','자동으로 맞추지 못한 변경을 이 기기에 보관했습니다. '+PATH_HELD+'에서 남길 쪽을 고르면 이어서 저장합니다.','retry',true);
    if(n||kind==='pending')return result('pending','저장 대기','변경사항을 서버에 저장할 차례를 기다리고 있습니다.','retry');
    /* 3.104 — 이 기기가 이 공간의 자료를 아직 받지 못했다(팀 전환 안의 받기 실패 · 닫기 정리 뒤 첫 받기 전). «저장됨»이 아니다 */
    if(kind==='wait')return s.reason?result('bad','자료를 아직 받지 못했어요','이 기기에 최신 자료를 받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.','retry',true)
      :result('pending','자료 받는 중…','이 기기에 최신 자료를 받고 있습니다.','retry');
    if(archived)return result('held','일부 변경 별도 보관','다른 변경과 겹친 내용은 별도로 보관했습니다. '+PATH_HELD+'에서 확인할 수 있습니다.','recovery',true,kind==='ok'&&Number(s.at)>0);
    if(kind==='ok'&&Number(s.at)>0)return result('ok','저장됨','서버에 저장된 내용을 확인했습니다.','',false,true);
    return result('pending','저장 확인 중…','아직 서버 저장을 확인하지 못했습니다.','retry');
  }
  /* The sync engine cannot see a child editor's rejected/pending local write.
     Keep the local barrier separate; a successful local write is never an ACK. */
  function combine(shown,local){
    var r=shown||view(null),l=local;
    function out(kind,text,detail,action,attention){return {kind:kind,text:text,detail:detail,action:action||'',attention:!!attention,complete:false};}
    if(!l)return r.kind==='bad'?r:out('pending','기기 저장 확인 중…','현재 화면의 기기 저장 상태를 아직 확인하지 못했습니다.','retry');
    if(l.failed)return out('bad','기기에 저장하지 못했어요','방금 편집의 기기 저장을 확인하지 못했습니다. 화면을 닫기 전에 내용을 따로 복사하고 저장을 다시 시도해 주세요.','retry',true);
    if(l.unknown)return r.kind==='bad'?r:out('pending','기기 저장 확인 중…','현재 화면의 기기 저장 상태를 아직 확인하지 못했습니다.','retry');
    if(l.saving)return out('busy','기기에 저장 중…','화면의 변경사항을 기기에 저장하고 있습니다. 아직 저장 완료가 아닙니다.');
    if(r.kind==='bad'){
      if(l.saved&&r.action!=='login'&&r.text.indexOf('오프라인')>=0)return out('pending','기기에 저장됨 · 오프라인','기기 저장은 확인했습니다. 인터넷에 연결된 뒤 서버 저장 여부를 다시 확인합니다.','retry');
      return r;
    }
    if(l.boardDraft)return out('pending','보드 초안 · 기기에 저장됨','작전판의 미저장 변경을 이 기기에 초안으로 보관했습니다. 서버 저장을 확인한 것은 아닙니다. «보드 저장»으로 마무리해 주세요.','',true);
    if(r.kind==='held'){
      if(l.localOnly||l.unconfirmed){var held={};Object.keys(r).forEach(function(k){held[k]=r[k];});held.complete=false;return held;}
      return r;
    }
    if(l.saved&&r.kind==='off')return out('pending','기기에 저장됨','기기 전용 자료나 초안의 저장을 확인했습니다. 이 표시만으로 서버 저장 완료를 뜻하지는 않습니다.');
    if(l.unconfirmed)return out(r.kind==='busy'?'busy':'pending','기기에 저장됨 · 서버 확인 대기','기기 저장은 확인했지만 현재 원문의 서버 저장 완료는 아직 확인하지 못했습니다.','retry');
    if(l.saved&&l.localOnly)return out('pending','기기에 저장됨','기기 전용 자료나 초안의 저장을 확인했습니다. 이 표시만으로 서버 저장 완료를 뜻하지는 않습니다.');
    if(r.complete){var confirmed={};Object.keys(r).forEach(function(k){confirmed[k]=r[k];});confirmed.text='서버 저장 확인';return confirmed;}
    return r;
  }

  /* Same-origin direct listeners, rather than trusting postMessage payloads.
     Each callback is bound to the actual Document and account/team epoch.
     Removed/reloaded frames are dropped; an old live frame is unknown until it
     loads or publishes a current-owner save state. No polling or storage writes. */
  function observe(w,options){
    var o=options||{},rows=[],closed=false,queued=false,serial=0;
    function owner(){try{return o.owner();}catch(_){return null;}}
    function notify(){if(closed||queued)return;queued=true;Promise.resolve().then(function(){queued=false;if(!closed&&o.change)o.change();});}
    function alive(row){try{return row.w.document===row.doc&&(!row.frame||row.frame.isConnected!==false);}catch(_){return false;}}
    function forget(row){row.handlers.forEach(function(h){try{row.w.removeEventListener(h[0],h[1],true);}catch(_){}});try{if(row.observer)row.observer.disconnect();}catch(_){}}
    function invalidate(row){row.receipts=Object.create(null);row.serial=++serial;}
    function attach(win,doc,frame){
      var row=rows.filter(function(r){return r.doc===doc&&r.frame===frame;})[0];if(row)return row;
      row={w:win,doc:doc,frame:frame,owner:owner(),serial:++serial,receipts:Object.create(null),handlers:[]};rows.push(row);
      function on(name,fn){try{win.addEventListener(name,fn,true);row.handlers.push([name,fn]);}catch(_){}}
      on('ps-save-state',function(e){
        if(!alive(row))return;var current=owner(),d=e&&e.detail;
        if(!d||d.owner!==current||current===null)return;
        row.owner=current;invalidate(row);notify();
      });
      function changed(){if(alive(row)){invalidate(row);notify();}}
      on('input',changed);on('change',changed);on('storage',changed);
      on('ps-storage-recovered',changed);on('load',function(e){if(!e||e.target===doc||String(e.target&&e.target.tagName).toUpperCase()==='IFRAME')notify();});
      try{if(win.MutationObserver&&doc.documentElement){row.observer=new win.MutationObserver(function(changes){
        function frameNode(n){return n&&n.nodeType===1&&(String(n.tagName).toUpperCase()==='IFRAME'||(n.querySelector&&n.querySelector('iframe')));}
        if(changes.some(function(c){return Array.prototype.some.call(c.addedNodes||[],frameNode)||Array.prototype.some.call(c.removedNodes||[],frameNode);}))notify();
      });row.observer.observe(doc.documentElement,{childList:true,subtree:true});}}catch(_){}
      return row;
    }
    function scan(){
      var live=[],loading=false;
      function visit(win,frame){
        var doc;try{doc=win.document;if(!doc)return;if(frame&&String(win.location.href)==='about:blank'){if(frame.getAttribute('src')&&frame.getAttribute('src')!=='about:blank')loading=true;return;}if(frame&&doc.readyState&&doc.readyState!=='complete')loading=true;}catch(_){return;}
        var row=attach(win,doc,frame);live.push(row);
        var frames=[];try{frames=doc.querySelectorAll('iframe');}catch(_){}
        for(var i=0;i<frames.length;i++)try{if(frames[i].contentWindow)visit(frames[i].contentWindow,frames[i]);}catch(_){}
      }
      visit(w,null);rows=rows.filter(function(row){if(live.indexOf(row)>=0&&alive(row))return true;forget(row);return false;});
      return loading;
    }
    function receipt(row,scope){
      if(!o.confirm)return null;
      var old=row.receipts[scope];if(old)return old;
      var version=row.serial,current=owner(),work;
      try{work=o.confirm(row.w,scope);}catch(_){work=Promise.resolve(false);}
      if(work===null||work===undefined){old={localOnly:true};row.receipts[scope]=old;return old;}
      old={pending:true,confirmed:false};row.receipts[scope]=old;
      Promise.resolve(work).then(function(result){
        if(!closed&&alive(row)&&row.serial===version&&row.owner===current&&owner()===current&&row.receipts[scope]===old){old.pending=false;old.confirmed=result===true||!!(result&&result.confirmed===true);notify();}
      },function(){if(!closed&&alive(row)&&row.serial===version&&row.receipts[scope]===old){old.pending=false;old.confirmed=false;notify();}});
      return old;
    }
    function read(){
      var current=owner(),result={failed:false,saving:false,unknown:false,saved:false,localOnly:false,unconfirmed:false,boardDraft:false};
      result.unknown=scan()||current===null;
      rows.forEach(function(row){
        var api,snap;try{api=row.w.PSSaveState;snap=api&&api.snapshot&&api.snapshot();}catch(_){result.unknown=true;return;}
        if(!snap||snap.owner!==current||current===null){result.unknown=true;return;}
        if(!row.frame)row.owner=current;
        if(row.owner!==current){result.unknown=true;return;}
        var draft,b;try{draft=row.w.__psBoardDraft;b=draft&&draft.snapshot&&draft.snapshot();}catch(_){result.unknown=true;}
        Object.keys(snap.scopes||{}).forEach(function(scope){
          if(scope==='board-draft'&&b&&!b.unknown&&!b.needed)return;
          var state=snap.scopes[scope];if(state==='failed')result.failed=true;
          else if(state==='saving')result.saving=true;
          else if(state==='saved'&&scope!=='storage'){
            result.saved=true;var r=receipt(row,scope);
            if(!r||r.localOnly)result.localOnly=true;else if(!r.confirmed)result.unconfirmed=true;
          }
        });
        try{if(row.w.psHasPending&&row.w.psHasPending())result.saving=true;}catch(_){result.unknown=true;}
        try{
          if(b){
            if(b.unknown)result.unknown=true;
            if(b.failed)result.failed=true;
            if(b.needed&&(b.blocked||b.pending||!b.localDurable))result.saving=true;
            else if(b.needed&&b.unsaved&&b.localDurable){result.boardDraft=true;result.saved=true;result.localOnly=true;}
            if(b.serverPending){result.unconfirmed=true;result.saved=!!b.privateLocalDurable||result.saved;}
          }
        }catch(_){result.unknown=true;}
      });
      return result;
    }
    return {read:read,refresh:function(){rows.forEach(invalidate);notify();},dispose:function(){closed=true;rows.forEach(forget);rows=[];}};
  }
  function observeShell(w,onChange){
    return observe(w,{
      owner:function(){return w.PSSaveState.owner();},change:onChange,
      confirm:function(child,scope){
        /* A tracker may cover several keys. Only a scope with fully known
           coverage may turn local durability into an exact server claim. */
        if(scope==='board-private'){
          var board=child.__psBoardDraft,b=board&&board.snapshot&&board.snapshot();
          return !!(b&&!b.unknown&&!b.serverPending&&b.privateServerConfirmed&&!(child.psHasPending&&child.psHasPending()));
        }
        if(scope!=='schedule')return null;
        var S=w.PSSync;if(!S||typeof S.confirmedValue!=='function')return Promise.resolve(false);
        var expected=w.PSSaveState.owner(),doc=child.document,key='process_coach_v1',raw=child.localStorage.getItem(key);
        function current(){return expected!==null&&w.PSSaveState.owner()===expected&&child.document===doc&&child.localStorage.getItem(key)===raw&&!(child.psHasPending&&child.psHasPending());}
        var read=raw!==null?Promise.resolve(raw):(child.storage&&child.storage.peek?child.storage.peek(key).then(function(r){return r?r.value:null;}):Promise.resolve(null));
        return read.then(function(value){if(!current()||typeof value!=='string')return false;return Promise.resolve(S.confirmedValue(key,value)).then(function(r){
          if(!current()||!(r===true||r&&r.confirmed===true))return false;
          if(raw!==null)return true;
          return child.storage.peek(key).then(function(latest){return current()&&!!latest&&latest.value===value;});
        });});
      }
    });
  }
  return {view:view,combine:combine,observe:observe,observeShell:observeShell};
});
