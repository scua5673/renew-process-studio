/* Private support conversations. Team/player storage and sync queues are never used. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSupport=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function issue(code){var e=new Error(code);e.code=code;return e;}
  function tokenExpired(token,w){
    if(typeof token!=='string')return true;
    var parts=token.split('.');if(parts.length!==3)return false;
    try{var raw=parts[1].replace(/-/g,'+').replace(/_/g,'/');while(raw.length%4)raw+='=';var payload=JSON.parse(w.atob(raw));return !Number.isFinite(payload.exp)||payload.exp*1000<=Date.now();}catch(_){return true;}
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function readContext(w){
    try{
      var api=w.PSSync,s=api&&api.session&&api.session();
      var uid=s&&s.uid?String(s.uid):'',ready=!!(uid&&s.at&&!tokenExpired(s.at,w)&&api.dataUnlocked&&api.dataUnlocked());
      var markers=[];try{var ls=w.localStorage;markers=['ps_cache_owner_v1','ps_active_ws','ps_ws_switch_guard_v1','ps_ws_switch_epoch_v1'].map(function(k){return ls.getItem(k);});}catch(_){markers=['storage-unavailable'];}
      return {uid:uid,token:ready?s.at:'',ready:ready,fence:JSON.stringify([uid,ready].concat(markers))};
    }catch(_){return {uid:'',token:'',ready:false,fence:'unavailable'};}
  }
  function createClient(options){
    var o=options||{},w=o.window,context=o.context||function(){return readContext(w);},generation=0,controllers=new Set();
    function invalidate(){generation++;controllers.forEach(function(c){c.abort();});controllers.clear();}
    function request(name,body){
      var c=context(),g=generation,cfg=o.config?o.config():w.PS_SYNC;
      if(!c||!c.uid||!c.ready||!c.token)return Promise.reject(issue('support_auth'));
      if(!cfg||!/^https:\/\//.test(cfg.url||'')||!cfg.anonKey)return Promise.reject(issue('support_unavailable'));
      var controller=w.AbortController?new w.AbortController():null,timer;
      if(controller)controllers.add(controller);
      function current(){var n=context();if(g!==generation||!n||!n.ready||n.uid!==c.uid||n.fence!==c.fence)throw issue('support_owner_changed');}
      var fetcher=o.fetch||w.fetch.bind(w);
      return Promise.resolve().then(function(){
        current();if(controller)timer=w.setTimeout(function(){controller.abort();},15000);
        return fetcher(String(cfg.url).replace(/\/+$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.anonKey,Authorization:'Bearer '+c.token},body:JSON.stringify(body),signal:controller?controller.signal:undefined});
      }).then(function(response){
        current();
        if(!response.ok)return response.json().catch(function(){return {};}).then(function(e){
          current();
          if(e.code==='PGRST202'||e.code==='42883')throw issue('support_unavailable');
          if(response.status===401||response.status===403)throw issue('support_auth');
          if(response.status===404)throw issue('support_missing');
          if(response.status===409)throw issue('support_conflict');
          if(response.status===400||response.status===422)throw issue('support_invalid');
          throw issue('support_failed');
        });
        return response.json();
      }).then(function(result){current();return result;}).catch(function(e){
        current();if(e&&/^support_/.test(e.code||''))throw e;
        throw issue('support_network');
      }).finally(function(){if(timer)w.clearTimeout(timer);if(controller)controllers.delete(controller);});
    }
    return {
      invalidate:invalidate,
      list:function(before){return request('ps_support_list',{p_limit:20,p_before:before||null});},
      get:function(id){if(!UUID.test(id||''))return Promise.reject(issue('support_invalid'));return request('ps_support_get',{p_report_id:id});},
      create:function(attempt){return request('ps_support_create',attempt);},
      reply:function(attempt){return request('ps_support_reply',attempt);}
    };
  }
  function copyText(report,diagnostics,format){
    var parts=['PROCESS STUDIO 오류 제보','제목: '+String(report.title||''),'','[제보 내용]',String(report.body||'')];
    if(Array.isArray(report.replies)&&report.replies.length){
      parts.push('','[답변]');report.replies.forEach(function(r){parts.push((r.author_role==='admin'?'운영자':'제보자')+' · '+String(r.created_at||''),String(r.body||''),'');});
    }
    if(typeof report.draftReply==='string'&&report.draftReply)parts.push('','[작성 중인 답변 · 아직 저장되지 않음]',report.draftReply);
    parts.push('',format?format(diagnostics):'사용 환경·오류 로그를 불러오지 못했습니다.');return parts.join('\n');
  }
  function message(e){return {
    support_auth:'로그인 상태를 확인해 주세요. 작성한 내용은 전체 복사할 수 있습니다.',
    support_unavailable:'오류 제보 접수를 아직 사용할 수 없습니다. 작성한 내용과 로그를 전체 복사해 주세요.',
    support_missing:'이 제보를 열 수 없습니다. 목록을 다시 확인해 주세요.',
    support_conflict:'등록 결과가 기존 내용과 다릅니다. 목록에서 접수 여부를 먼저 확인해 주세요.',
    support_invalid:'접수할 내용을 확인하지 못했습니다. 내용을 확인하고 다시 시도해 주세요.',
    support_network:'접수 결과를 확인하지 못했습니다. 다시 시도하면 같은 요청으로 확인합니다.',
    support_owner_changed:'계정 또는 팀이 바뀌었습니다. 오류 제보를 다시 열어 주세요.'
  }[e&&e.code]||'요청을 완료하지 못했습니다. 작성한 내용은 유지됩니다. 다시 시도해 주세요.';}
  function mount(options){
    var o=options||{},w=o.window||window,d=w.document,diag=w.PSSupportDiagnostics;
    if(w.__psSupportController)return w.__psSupportController;
    var client=o.client||createClient({window:w}),dialog=d.createElement('dialog');
    dialog.id='psSupportDialog';dialog.setAttribute('aria-labelledby','psSupportTitle');d.body.appendChild(dialog);
    var active=false,screen='compose',rows=[],cursor=null,isAdmin=false,detail=null,busy=false,loading=false,notice='',error='',turn=0;
    var draft={title:'',body:'',attempt:null},snapshot=null,replyDraft='',replyAttempt=null,replyId='',replyMemory={},replyDurable=true,context=readContext(w),bodyAlreadyLocked=false,returnFocus=null,draftDurable=true;
    function draftKey(){return context.ready&&context.uid?'ps_support_draft_v1:'+context.uid:null;}
    function restoreDraft(preserveMemory){
      if(preserveMemory&&(!draftKey()||!draftDurable))return;
      draft={title:'',body:'',attempt:null};
      try{var key=draftKey(),raw=key&&w.localStorage.getItem(key),v=raw&&JSON.parse(raw);if(!v)return;
        if(typeof v.title==='string'&&v.title.length<=120&&typeof v.body==='string'&&v.body.length<=8000){draft.title=v.title;draft.body=v.body;}
        if(v.attempt&&UUID.test(v.attempt.p_id||'')&&v.attempt.p_title===draft.title&&v.attempt.p_body===draft.body)draft.attempt=v.attempt;
      }catch(_){draftDurable=false;}
    }
    function persistDraft(){
      try{var key=draftKey();if(!key){draftDurable=false;return;}
        if(!draft.title&&!draft.body&&!draft.attempt){w.localStorage.removeItem(key);draftDurable=w.localStorage.getItem(key)===null;return;}
        var raw=JSON.stringify(draft);w.localStorage.setItem(key,raw);draftDurable=w.localStorage.getItem(key)===raw;
      }catch(_){draftDurable=false;}
    }
    function persistReply(){
      if(!replyId||!context.uid)return;
      var value={body:replyDraft,attempt:replyAttempt};replyMemory[replyId]=value;
      try{var key='ps_support_reply_v1:'+context.uid+':'+replyId;
        if(!replyDraft&&!replyAttempt){w.localStorage.removeItem(key);delete replyMemory[replyId];replyDurable=w.localStorage.getItem(key)===null;return;}
        var raw=JSON.stringify(value);w.localStorage.setItem(key,raw);replyDurable=w.localStorage.getItem(key)===raw;
      }catch(_){replyDurable=false;}
      if(replyMemory[replyId])replyMemory[replyId].durable=replyDurable;
    }
    function restoreReply(id){
      replyId=id;replyDraft='';replyAttempt=null;replyDurable=true;
      try{var value=replyMemory[id],raw;if(value)replyDurable=value.durable!==false;if(!value){raw=w.localStorage.getItem('ps_support_reply_v1:'+context.uid+':'+id);value=raw&&JSON.parse(raw);}
        if(value&&typeof value.body==='string'&&value.body.length<=4000){replyDraft=value.body;if(value.attempt&&UUID.test(value.attempt.p_id||'')&&value.attempt.p_report_id===id&&value.attempt.p_body===replyDraft)replyAttempt=value.attempt;}
      }catch(_){replyDurable=false;}
    }
    function capture(){try{return diag&&diag.snapshot({window:w});}catch(_){return null;}}
    function format(value){try{return diag&&diag.format?diag.format(value):'사용 환경·오류 로그를 불러오지 못했습니다.';}catch(_){return '사용 환경·오류 로그를 불러오지 못했습니다.';}}
    function uuid(){if(w.crypto&&w.crypto.randomUUID)return w.crypto.randomUUID();if(w.crypto&&w.crypto.getRandomValues){var a=w.crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;var h=Array.from(a,function(n){return n.toString(16).padStart(2,'0');}).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}throw issue('support_failed');}
    function nowLabel(v){var at=new Date(v);return isFinite(at.getTime())?at.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
    function statusHtml(){return '<p class="support-status'+(error?' is-error':'')+'" role="'+(error?'alert':'status')+'">'+esc(error||notice)+'</p>';}
    function logsHtml(value){var count=value&&Array.isArray(value.logs)?value.logs.length:0;return '<details class="support-logs"><summary>사용 환경 · 오류 로그 '+count+'건</summary><pre>'+esc(format(value))+'</pre></details>';}
    function render(){
      if(!active)return;
      var h='<header class="support-head"><div><h2 id="psSupportTitle">오류 제보</h2><p>제보자와 운영자만 내용과 답변을 볼 수 있습니다.</p></div><button type="button" class="support-close" data-support="close" aria-label="오류 제보 닫기">×</button></header>'
        +'<nav class="support-tabs" aria-label="오류 제보 메뉴"><button type="button" data-support="compose" aria-pressed="'+(screen==='compose')+'">제보 작성</button><button type="button" data-support="list" aria-pressed="'+(screen!=='compose')+'">'+(isAdmin?'접수된 제보':'내 제보와 답변')+'</button></nav><div class="support-content">';
      if(screen==='compose'){
        h+='<form id="supportCompose"><label>제목<input name="title" maxlength="120" required value="'+esc(draft.title)+'" placeholder="어떤 문제가 생겼나요?"'+(busy||draft.attempt?' disabled':'')+'></label>'
          +'<label>오류 내용<textarea name="body" maxlength="8000" rows="6" required placeholder="어떤 화면에서 무엇을 눌렀는지, 예상한 결과와 실제 결과를 적어 주세요."'+(busy||draft.attempt?' disabled':'')+'>'+esc(draft.body)+'</textarea></label>'
          +logsHtml(draft.attempt?draft.attempt.p_diagnostics:snapshot)
          +'<div class="support-log-actions"><span>오류 코드와 발생 위치를 포함합니다. 로그인 정보와 선수 자료는 포함하지 않습니다.</span><button type="button" data-support="capture"'+(busy||draft.attempt?' disabled':'')+'>현재 로그로 갱신</button></div>'
          +(!context.ready?'<p class="support-hint">로그인과 계정 확인이 끝나면 제보를 등록할 수 있습니다. 문제가 계속되면 먼저 전체 복사해 주세요.</p>':'')
          +(draft.attempt?'<p class="support-hint">접수 결과 확인 전에는 내용을 유지합니다. 다시 등록해도 같은 제보로 처리됩니다.</p>':'')
          +statusHtml()+'<div class="support-actions"><button type="button" data-support="copy">제보·사용 환경·로그 전체 복사</button><button class="support-primary" type="submit"'+(busy||!context.ready?' disabled':'')+'>'+(busy?'접수 확인 중…':draft.attempt?'접수 다시 확인':'제보 등록')+'</button></div></form>';
      }else if(screen==='list'){
        h+='<div class="support-list-head"><h3>'+(isAdmin?'접수된 제보':'내 제보와 답변')+'</h3><button type="button" data-support="refresh"'+(loading?' disabled':'')+'>새로고침</button></div>'+statusHtml();
        if(!context.ready)h+='<p class="support-empty">로그인하면 제보한 내용과 답변을 확인할 수 있습니다.</p>';
        else if(loading&&!rows.length)h+='<p class="support-empty" role="status">제보를 불러오는 중…</p>';
        else if(!rows.length&&!error)h+='<p class="support-empty">아직 등록한 제보가 없습니다.</p>';
        h+='<div class="support-list">'+rows.map(function(r){return '<button type="button" class="support-row" data-report="'+esc(r.id)+'"><span><strong>'+esc(r.title)+'</strong><small>'+esc(nowLabel(r.created_at))+(isAdmin?(r.is_own?' · 내 제보':' · 사용자 제보'):'')+'</small></span><span class="support-answer">'+(+r.reply_count>0?'답변 '+Number(r.reply_count)+'개':'접수됨')+' ›</span></button>';}).join('')+'</div>';
        if(cursor)h+='<button type="button" class="support-more" data-support="more"'+(loading?' disabled':'')+'>'+(loading?'불러오는 중…':'이전 제보 더 보기')+'</button>';
      }else{
        h+='<button type="button" class="support-back" data-support="list">‹ 목록으로</button>'+statusHtml();
        if(loading)h+='<p class="support-empty" role="status">제보와 답변을 불러오는 중…</p>';
        else if(detail){var r=detail.report;h+='<article class="support-report"><h3>'+esc(r.title)+'</h3><small>'+esc(nowLabel(r.created_at))+'</small><p>'+esc(r.body)+'</p>'+logsHtml(r.diagnostics)+'<button type="button" data-support="copy">제보·답변·사용 환경·로그 전체 복사</button></article>'
          +'<section class="support-replies" aria-label="답변"><h3>답변 '+detail.replies.length+'개</h3>'+detail.replies.map(function(a){return '<article><div><b>'+esc(a.author_role==='admin'?'운영자':a.is_own?'나':'제보자')+'</b><time>'+esc(nowLabel(a.created_at))+'</time></div><p>'+esc(a.body)+'</p></article>';}).join('')+(!detail.replies.length?'<p class="support-hint">아직 답변이 없습니다.</p>':'')+'</section>'
          +'<form id="supportReply"><label>답변 남기기<textarea name="reply" maxlength="4000" rows="3" required placeholder="답변이나 추가로 확인한 내용을 적어 주세요."'+(busy||replyAttempt?' disabled':'')+'>'+esc(replyDraft)+'</textarea></label><div class="support-actions"><button class="support-primary" type="submit"'+(busy||!context.ready?' disabled':'')+'>'+(busy?'저장 확인 중…':replyAttempt?'답변 저장 다시 확인':'답변 등록')+'</button></div></form>';}
      }
      dialog.innerHTML=h+'</div>';
    }
    function resetContext(){
      var n=readContext(w);if(n.fence===context.fence)return false;
      client.invalidate();turn++;context=n;busy=false;loading=false;rows=[];cursor=null;detail=null;replyDraft='';replyAttempt=null;replyId='';replyMemory={};isAdmin=false;snapshot=null;notice='';error='';screen='compose';
      restoreDraft();snapshot=draft.attempt?draft.attempt.p_diagnostics:capture();render();return true;
    }
    function ownerEvent(e){
      if(e&&e.type==='ps-auth-state'&&e.detail&&e.detail.unlocked===false){client.invalidate();turn++;context={uid:'',token:'',ready:false,fence:'locked'};draft={title:'',body:'',attempt:null};rows=[];detail=null;replyDraft='';replyAttempt=null;replyId='';replyMemory={};isAdmin=false;snapshot=null;busy=false;loading=false;screen='compose';error='';notice='';render();return;}
      resetContext();
    }
    function list(more){
      if(resetContext())return;screen='list';detail=null;notice='';error='';if(!context.ready){render();return;}
      var ticket=++turn;loading=true;if(!more){rows=[];cursor=null;}render();
      client.list(more?cursor:null).then(function(result){if(ticket!==turn||!active)return;
        if(!result||!Array.isArray(result.reports))throw issue('support_failed');
        var seen=new Set(rows.map(function(r){return r.id;}));rows=rows.concat(result.reports.filter(function(r){return UUID.test(r.id||'')&&!seen.has(r.id);}));cursor=result.next_cursor||null;isAdmin=result.is_admin===true;
      }).catch(function(e){if(ticket===turn&&active)error=message(e);}).finally(function(){if(ticket===turn&&active){loading=false;render();}});
    }
    function openReport(id){
      if(resetContext())return;screen='detail';detail=null;restoreReply(id);notice='';error='';loading=true;var ticket=++turn;render();
      client.get(id).then(function(result){if(ticket!==turn||!active)return;if(!result||!result.report||result.report.id!==id||!Array.isArray(result.replies))throw issue('support_failed');detail=result;}).catch(function(e){if(ticket===turn&&active)error=message(e);}).finally(function(){if(ticket===turn&&active){loading=false;render();}});
    }
    function submitReport(){
      if(resetContext())return;if(busy||!context.ready)return;if(!draft.title.trim()||!draft.body.trim()){error='제목과 오류 내용을 입력해 주세요.';render();return;}
      try{if(!draft.attempt)draft.attempt={p_id:uuid(),p_title:draft.title,p_body:draft.body,p_diagnostics:snapshot||{}};}catch(e){error=message(e);render();return;}
      persistDraft();busy=true;error='';notice='';var ticket=++turn,attempt=draft.attempt;render();
      client.create(attempt).then(function(result){if(ticket!==turn||!active)return;if(!result||result.id!==attempt.p_id)throw issue('support_failed');draft={title:'',body:'',attempt:null};persistDraft();busy=false;openReport(result.id);}).catch(function(e){if(ticket!==turn||!active)return;busy=false;if(['support_unavailable','support_auth','support_invalid'].indexOf(e.code)>=0){draft.attempt=null;persistDraft();}error=message(e);render();});
    }
    function submitReply(){
      if(resetContext())return;if(busy||!context.ready||!detail||!replyDraft.trim())return;
      try{if(!replyAttempt)replyAttempt={p_id:uuid(),p_report_id:detail.report.id,p_body:replyDraft};}catch(e){error=message(e);render();return;}
      persistReply();busy=true;error='';notice='';var ticket=++turn,attempt=replyAttempt;render();
      client.reply(attempt).then(function(result){if(ticket!==turn||!active)return;if(!result||result.id!==attempt.p_id||result.report_id!==attempt.p_report_id)throw issue('support_failed');if(!detail.replies.some(function(r){return r.id===result.id;}))detail.replies.push(result);replyDraft='';replyAttempt=null;persistReply();busy=false;notice='답변을 저장했습니다.';render();}).catch(function(e){if(ticket!==turn||!active)return;busy=false;if(['support_unavailable','support_auth','support_invalid'].indexOf(e.code)>=0){replyAttempt=null;persistReply();}error=message(e);render();});
    }
    function copy(){
      if(resetContext())return;
      var report=screen==='detail'&&detail?Object.assign({},detail.report,{replies:detail.replies,draftReply:replyDraft}):draft;
      var value=screen==='detail'&&detail?detail.report.diagnostics:draft.attempt?draft.attempt.p_diagnostics:snapshot;
      var text=copyText(report,value,format),ticket=turn;
      function manual(){if(ticket!==turn||!active)return;var box=d.createElement('textarea');box.className='support-copy-fallback';box.readOnly=true;box.setAttribute('aria-label','전체 복사할 제보 내용');box.value=text;dialog.querySelector('.support-content').appendChild(box);box.focus();box.select();var ok=false;try{ok=!!d.execCommand('copy');}catch(_){}
        notice=ok?'전체 내용을 복사했습니다.':'아래 내용을 길게 눌러 복사해 주세요.';var status=dialog.querySelector('.support-status');if(status)status.textContent=notice;
      }
      if(!w.navigator.clipboard||!w.navigator.clipboard.writeText){manual();return;}
      w.navigator.clipboard.writeText(text).then(function(){if(ticket!==turn||!active)return;notice='전체 내용을 복사했습니다.';error='';var status=dialog.querySelector('.support-status');if(status){status.classList.remove('is-error');status.textContent=notice;}}).catch(manual);
    }
    function open(){
      if(active){dialog.querySelector('.support-close').focus();return;}
      var previous=context.fence;context=readContext(w);restoreDraft(previous===context.fence);snapshot=draft.attempt?draft.attempt.p_diagnostics:capture();screen='compose';notice='';error='';active=true;returnFocus=d.activeElement;
      bodyAlreadyLocked=d.body.classList.contains('ps-modal-open');d.body.classList.add('ps-modal-open');
      try{if(w.__psCloseAppSettings)w.__psCloseAppSettings();if(w.__psCloseAcctPop)w.__psCloseAcctPop();}catch(_){}
      render();dialog.showModal();dialog.querySelector('.support-close').focus();
    }
    function close(){
      resetContext();
      /* Keep an in-flight request visible; otherwise retain drafts without forcing a post. */
      if(busy){notice='접수 결과를 확인하고 있습니다. 잠시만 기다려 주세요.';var s=dialog.querySelector('.support-status');if(s)s.textContent=notice;return;}
      persistReply();persistDraft();active=false;turn++;client.invalidate();dialog.close();dialog.innerHTML='';if(!bodyAlreadyLocked)d.body.classList.remove('ps-modal-open');if(returnFocus&&returnFocus.isConnected)returnFocus.focus();
    }
    dialog.addEventListener('cancel',function(e){e.preventDefault();close();});
    dialog.addEventListener('input',function(e){
      if(resetContext())return;
      if(e.target.name==='title'||e.target.name==='body'){draft[e.target.name]=e.target.value;persistDraft();}
      if(e.target.name==='reply'){replyDraft=e.target.value;persistReply();}
    });
    dialog.addEventListener('submit',function(e){e.preventDefault();if(e.target.id==='supportCompose')submitReport();else if(e.target.id==='supportReply')submitReply();});
    dialog.addEventListener('click',function(e){
      if(resetContext())return;
      var b=e.target.closest('button');if(!b||b.disabled)return;
      if(b.dataset.report){if(!busy)openReport(b.dataset.report);return;}
      var a=b.dataset.support;
      if(a==='close'){close();return;}
      if(a==='copy'){copy();return;}
      if(busy)return;
      if(a==='compose'||a==='list')persistReply();
      if(a==='compose'){turn++;screen='compose';error='';notice='';render();}
      if(a==='list'||a==='refresh')list(false);
      if(a==='more')list(true);
      if(a==='capture'){snapshot=capture();notice='현재 사용 환경과 오류 로그를 가져왔습니다.';error='';render();}
    });
    ['ps-auth-state','ps-sync-state','storage'].forEach(function(name){w.addEventListener(name,ownerEvent);});
    w.addEventListener('beforeunload',function(e){if(pendingUnsafe()){e.preventDefault();e.returnValue='';}});
    ['psSupportOpen','psSupportSettingsOpen'].forEach(function(id){var button=d.getElementById(id);if(button)button.addEventListener('click',open);});
    function pendingUnsafe(){return busy||!!((draft.title||draft.body)&&!draftDurable)||!!((replyDraft||replyAttempt)&&!replyDurable)||Object.keys(replyMemory).some(function(id){var r=replyMemory[id];return r.durable===false&&!!(r.body||r.attempt);});}
    var controller={open:open,close:close,pendingUnsafe:pendingUnsafe,flushReady:function(){persistDraft();persistReply();return pendingUnsafe()?Promise.reject(issue('support_draft_unsaved')):Promise.resolve(true);}};w.__psSupportController=controller;return controller;
  }
  return {mount:mount,createClient:createClient,readContext:readContext,copyText:copyText,message:message};
});
