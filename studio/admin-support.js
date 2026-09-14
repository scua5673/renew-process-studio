/* Private support inbox. All requests use the admin page's bound RPC client. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminSupport=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var PREFIX='ps_admin_support_reply_v1:';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fault(code){var e=new Error(code);e.code=code;return e;}
  function errorKind(e){
    var code=String(e&&e.code||''),status=+(e&&e.status)||0;
    if(code==='PGRST202'||code==='42883'||code==='support_unavailable')return 'unavailable';
    if(status===401||status===403||code==='42501'||code==='support_not_admin'||code==='support_auth')return 'denied';
    if(status===404||code==='PT404'||code==='support_missing')return 'missing';
    if(status===409||code==='PT409'||code==='support_conflict')return 'conflict';
    if(status===400||status===422||code==='22023'||code==='support_invalid')return 'invalid';
    return 'network';
  }
  function errorText(kind){return {
    denied:'관리자 권한을 확인할 수 없습니다. 다시 로그인한 뒤 확인해 주세요.',
    unavailable:'오류 제보 기능을 아직 불러올 수 없습니다. 서버에 지원 기능이 설치되어 있는지 확인해 주세요.',
    missing:'이 제보를 열 수 없습니다. 목록을 새로고침해 주세요.',
    conflict:'답변 등록 결과가 기존 내용과 다릅니다. 제보를 다시 열어 확인해 주세요. 작성한 답변은 보관했습니다.',
    invalid:'답변을 저장하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.',
    network:'요청 결과를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'
  }[kind]||'요청을 완료하지 못했습니다.';}
  function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(v))return '시각 미확인';var d=new Date(v);return isFinite(d.getTime())?d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시각 미확인';}
  function create(options){
    var o=options||{},w=o.window||(typeof window!=='undefined'?window:null),host=o.host,d=w&&w.document;
    if(!w||!d||!host||typeof o.rpc!=='function'||typeof o.context!=='function')throw new Error('admin_support_configuration_required');
    var root=d.createElement('section');root.className='admSupport';root.setAttribute('aria-label','오류 제보 관리');host.appendChild(root);
    var active=false,destroyed=false,owner=null,generation=0,listTicket=0,detailTicket=0,sendTicket=0;
    var rows=[],cursor=null,adminConfirmed=false,listLoading=false,detailLoading=false,busy=false,selected='',detail=null,currentDraft=null;
    var listError='',detailError='',notice='',drafts=new Map(),watch=null,renderedSelected='';
    function readOwner(){try{var c=o.context()||{};return {uid:String(c.uid||''),epoch:String(c.epoch==null?'':c.epoch),ready:c.ready===true};}catch(_){return {uid:'',epoch:'',ready:false};}}
    function equalOwner(a,b){return !!a&&!!b&&a.uid===b.uid&&a.epoch===b.epoch&&a.ready===b.ready;}
    function stamp(){return {uid:owner.uid,epoch:owner.epoch,ready:owner.ready,generation:generation};}
    function valid(s){return !destroyed&&active&&!!s&&s.generation===generation&&s.ready&&!!s.uid&&equalOwner(s,readOwner());}
    function clearView(){rows=[];cursor=null;adminConfirmed=false;listLoading=false;detailLoading=false;busy=false;selected='';detail=null;currentDraft=null;listError='';detailError='';notice='';}
    function reconcile(){
      if(destroyed)return false;
      var next=readOwner();
      if(!equalOwner(owner,next)){generation++;listTicket++;detailTicket++;sendTicket++;owner=next;clearView();if(active){listError=errorText('denied');render();}else root.innerHTML='';return false;}
      return active&&owner.ready&&!!owner.uid;
    }
    function safe(s){if(valid(s))return true;reconcile();return false;}
    function key(uid,id){return PREFIX+uid+':'+id;}
    function persist(entry){
      if(!entry)return;
      try{
        var storage=w.sessionStorage,k=key(entry.uid,entry.reportId);
        if(!entry.body&&!entry.attempt){storage.removeItem(k);entry.durable=storage.getItem(k)===null;return;}
        var raw=JSON.stringify({body:entry.body,attempt:entry.attempt});storage.setItem(k,raw);entry.durable=storage.getItem(k)===raw;
      }catch(_){entry.durable=false;}
    }
    function draftFor(id){
      var k=key(owner.uid,id),entry=drafts.get(k);
      if(entry)return entry;
      entry={uid:owner.uid,reportId:id,body:'',attempt:null,durable:true};drafts.set(k,entry);
      try{var raw=w.sessionStorage.getItem(k),v=raw&&JSON.parse(raw);
        if(v&&typeof v.body==='string'&&v.body.length<=4000){entry.body=v.body;
          if(v.attempt&&UUID.test(v.attempt.p_id||'')&&v.attempt.p_report_id===id&&typeof v.attempt.p_body==='string'&&v.attempt.p_body===v.body.trim())
            entry.attempt={p_id:v.attempt.p_id,p_report_id:id,p_body:v.attempt.p_body};
        }
      }catch(_){entry.durable=false;}
      return entry;
    }
    function newId(){
      if(w.crypto&&w.crypto.randomUUID)return w.crypto.randomUUID();
      if(!w.crypto||!w.crypto.getRandomValues)throw fault('support_unavailable');
      var bytes=w.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
      var h=Array.from(bytes,function(n){return n.toString(16).padStart(2,'0');}).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    }
    function diagnosticText(value){try{return typeof o.format==='function'?String(o.format(value)):'사용 환경·오류 로그를 불러오지 못했습니다.';}catch(_){return '사용 환경·오류 로그를 불러오지 못했습니다.';}}
    function matchingReply(reply,attempt){return !!reply&&!!attempt&&reply.id===attempt.p_id&&reply.report_id===attempt.p_report_id&&reply.body===attempt.p_body&&['admin','reporter'].indexOf(reply.author_role)>=0&&reply.is_own===true;}
    function acknowledge(entry,reply){if(!matchingReply(reply,entry&&entry.attempt))return false;entry.body='';entry.attempt=null;persist(entry);return true;}
    function lockView(message){generation++;listTicket++;detailTicket++;sendTicket++;clearView();listError=message;render();}
    function denied(){lockView(errorText('denied'));}
    function render(){
      if(!active||destroyed)return;
      var previousInbox=root.querySelector('.admSupportInbox'),previousDetail=root.querySelector('.admSupportDetail');
      var inboxScroll=previousInbox?previousInbox.scrollTop:0,detailScroll=previousDetail&&renderedSelected===selected?previousDetail.scrollTop:0;
      var can=!!(owner&&owner.ready&&adminConfirmed),h='<header class="admSupportHead"><div><h1>오류 제보</h1><p>앱에서 접수한 제보를 확인하고 운영자 답변을 남깁니다.</p></div><button type="button" data-adm-support="refresh"'+(listLoading||busy?' disabled':'')+'>새로고침</button></header>'
        +'<div class="admSupportGrid"><section class="admSupportInbox" aria-label="제보 목록">';
      if(listError)h+='<p class="admSupportError" role="alert">'+esc(listError)+'</p>';
      if(listLoading&&!rows.length)h+='<p class="admSupportEmpty" role="status">접수된 제보를 불러오는 중…</p>';
      else if(can&&!rows.length&&!listError)h+='<p class="admSupportEmpty">아직 접수된 제보가 없습니다.</p>';
      h+='<div class="admSupportList">'+(can?rows.map(function(r){return '<button type="button" class="admSupportRow'+(selected===r.id?' is-selected':'')+'" data-adm-report="'+esc(r.id)+'" aria-pressed="'+(selected===r.id)+'"'+(busy?' disabled':'')+'><span><strong>'+esc(r.title)+'</strong><small>'+esc(date(r.created_at))+' · '+(r.is_own?'내 제보':'사용자 제보')+'</small></span><span class="admSupportCount">'+(r.reply_count>0?'대화 '+r.reply_count+'개':'새 제보')+'</span></button>';}).join(''):'')+'</div>';
      if(can&&cursor)h+='<button type="button" class="admSupportMore" data-adm-support="more"'+(listLoading||busy?' disabled':'')+'>'+(listLoading?'불러오는 중…':'이전 제보 더 보기')+'</button>';
      h+='</section><section class="admSupportDetail" aria-label="제보 내용과 답변">';
      if(can&&selected)h+='<button type="button" class="admSupportBack" data-adm-support="back"'+(busy?' disabled':'')+'>목록으로</button>';
      if(detailError)h+='<p class="admSupportError" role="alert">'+esc(detailError)+'</p>';
      if(notice)h+='<p class="admSupportNotice" role="status">'+esc(notice)+'</p>';
      if(detailLoading)h+='<p class="admSupportEmpty" role="status">제보와 답변을 불러오는 중…</p>';
      else if(can&&detail){
        var r=detail.report,entry=currentDraft,count=r.diagnostics&&Array.isArray(r.diagnostics.logs)?r.diagnostics.logs.length:0;
        h+='<article class="admSupportReport"><h2>'+esc(r.title)+'</h2><small>'+esc(date(r.created_at))+'</small><p>'+esc(r.body)+'</p>'
          +'<details class="admSupportLogs"><summary>제보 당시 사용 환경 · 오류 로그 '+count+'건</summary><pre>'+esc(diagnosticText(r.diagnostics))+'</pre></details>'
          +'<button type="button" data-adm-support="copy">제보·대화·사용 환경·로그 전체 복사</button></article>'
          +'<section class="admSupportConversation" aria-label="제보 대화"><h3>대화 '+detail.replies.length+'개</h3>'
          +detail.replies.map(function(q){return '<article class="admSupportReply" data-adm-reply="'+esc(q.id)+'"><header><b>'+(q.author_role==='admin'?'운영자':'제보자')+(q.is_own?' · 나':'')+'</b><time>'+esc(date(q.created_at))+'</time></header><p>'+esc(q.body)+'</p></article>';}).join('')
          +(!detail.replies.length?'<p class="admSupportHint">아직 답변이 없습니다.</p>':'')+'</section>'
          +'<form data-adm-support-form="reply"><label>운영자 답변<textarea name="reply" maxlength="4000" rows="5" required placeholder="확인한 내용과 해결 방법을 알려 주세요."'+(busy||entry.attempt?' disabled':'')+'>'+esc(entry.body)+'</textarea></label>'
          +(entry.attempt?'<p class="admSupportHint">저장 결과를 확인할 때까지 같은 답변을 보관합니다. 다시 시도해도 중복 등록되지 않습니다.</p>':'')
          +(!entry.durable&&(entry.body||entry.attempt)?'<p class="admSupportHint">이 브라우저에 임시 저장하지 못했습니다. 새로고침 전에 전체 복사해 주세요.</p>':'')
          +'<div class="admSupportActions"><span>답변은 제보자의 앱에도 표시됩니다.</span><button class="admSupportPrimary" type="submit" data-adm-support="send"'+(busy?' disabled':'')+'>'+(busy?'저장 확인 중…':entry.attempt?'답변 저장 다시 확인':'답변 등록')+'</button></div></form>';
      }else if(can&&selected&&detailError)h+='<button type="button" data-adm-support="retry-detail">제보 다시 열기</button>';
      else if(can)h+='<p class="admSupportEmpty">목록에서 제보를 선택하면 내용과 답변을 확인할 수 있습니다.</p>';
      h+='</section></div>';root.dataset.detail=can&&selected?'true':'false';root.innerHTML=h;renderedSelected=selected;
      root.querySelector('.admSupportInbox').scrollTop=inboxScroll;root.querySelector('.admSupportDetail').scrollTop=detailScroll;
    }
    function call(s,name,args){return Promise.resolve().then(function(){if(!safe(s))throw fault('support_owner_changed');return o.rpc(name,args);});}
    function loadList(more){
      if(!reconcile())return Promise.resolve();
      var s=stamp(),ticket=++listTicket;listLoading=true;listError='';
      if(!more){rows=[];cursor=null;adminConfirmed=false;detailTicket++;detailLoading=false;selected='';detail=null;currentDraft=null;detailError='';notice='';}
      render();
      return call(s,'ps_support_list',{p_limit:20,p_before:more?cursor:null}).then(function(result){
        if(!safe(s)||ticket!==listTicket)return;
        if(!result||result.is_admin!==true){denied();return;}
        if(!Array.isArray(result.reports)||result.reports.some(function(r){return !r||!UUID.test(r.id||'')||typeof r.title!=='string'||typeof r.is_own!=='boolean'||!Number.isInteger(r.reply_count)||r.reply_count<0;}))throw fault('support_failed');
        if(result.next_cursor!=null&&(typeof result.next_cursor!=='object'||typeof result.next_cursor.created_at!=='string'||!UUID.test(result.next_cursor.id||'')))throw fault('support_failed');
        var seen=new Set(rows.map(function(r){return r.id;}));
        result.reports.forEach(function(r){if(seen.has(r.id))return;
          rows.push({id:r.id,title:r.title,created_at:r.created_at,is_own:r.is_own,reply_count:r.reply_count});seen.add(r.id);});
        cursor=result.next_cursor||null;adminConfirmed=true;
      }).catch(function(e){if(!safe(s)||ticket!==listTicket)return;var kind=errorKind(e);if(kind==='denied'){denied();return;}listError=errorText(kind);})
        .finally(function(){if(safe(s)&&ticket===listTicket){listLoading=false;render();}});
    }
    function openReport(id){
      if(!reconcile()||!adminConfirmed||busy||!UUID.test(id||'')||!rows.some(function(r){return r.id===id;}))return Promise.resolve();
      var s=stamp(),ticket=++detailTicket;selected=id;detail=null;currentDraft=draftFor(id);detailLoading=true;detailError='';notice='';render();
      try{if(w.matchMedia('(max-width:700px)').matches)root.scrollIntoView({block:'start'});}catch(_){}
      return call(s,'ps_support_get',{p_report_id:id}).then(function(result){
        if(!safe(s)||ticket!==detailTicket)return;
        if(!result||!result.report||result.report.id!==id||typeof result.report.title!=='string'||typeof result.report.body!=='string'||!Array.isArray(result.replies))throw fault('support_failed');
        if(result.replies.some(function(q){return !q||!UUID.test(q.id||'')||q.report_id!==id||typeof q.body!=='string'||['admin','reporter'].indexOf(q.author_role)<0;}))throw fault('support_failed');
        detail=result;
        if(currentDraft.attempt){var confirmed=detail.replies.find(function(q){return matchingReply(q,currentDraft.attempt);});if(confirmed&&acknowledge(currentDraft,confirmed))notice='답변 저장을 확인했습니다.';}
      }).catch(function(e){if(!safe(s)||ticket!==detailTicket)return;var kind=errorKind(e);if(kind==='denied'){denied();return;}if(kind==='missing'){lockView(errorText('missing'));return;}detailError=errorText(kind);})
        .finally(function(){if(safe(s)&&ticket===detailTicket){detailLoading=false;render();}});
    }
    function submit(){
      if(!reconcile()||!adminConfirmed||!detail||!currentDraft||busy)return Promise.resolve();
      var entry=currentDraft;
      if(!entry.body.trim()){detailError='답변 내용을 입력해 주세요.';render();return Promise.resolve();}
      try{if(!entry.attempt)entry.attempt={p_id:newId(),p_report_id:selected,p_body:entry.body.trim()};}catch(e){detailError=errorText(errorKind(e));render();return Promise.resolve();}
      persist(entry);var attempt=entry.attempt,s=stamp(),ticket=++sendTicket,id=selected;
      busy=true;detailError='';notice='';render();
      return call(s,'ps_support_reply',attempt).then(function(result){
        if(!safe(s)||ticket!==sendTicket||selected!==id)return;
        if(!matchingReply(result,attempt))throw fault('support_failed');
        if(result.author_role!=='admin'){denied();return;}
        acknowledge(entry,result);if(!detail.replies.some(function(q){return q.id===result.id;}))detail.replies.push(result);
        var row=rows.find(function(r){return r.id===id;});if(row)row.reply_count=detail.replies.length;
        notice='운영자 답변을 저장했습니다.';
      }).catch(function(e){
        if(!safe(s)||ticket!==sendTicket)return;
        var kind=errorKind(e);if(kind==='denied'){denied();return;}if(kind==='missing'){lockView(errorText('missing'));return;}
        if(kind==='invalid'||kind==='unavailable'){entry.attempt=null;persist(entry);}
        detailError=kind==='network'?'답변 저장 결과를 확인하지 못했습니다. 같은 답변으로 다시 확인해 주세요.':errorText(kind);
      }).finally(function(){if(safe(s)&&ticket===sendTicket){busy=false;render();}});
    }
    function copy(){
      if(!reconcile()||!adminConfirmed||!detail)return;
      var s=stamp(),id=selected,ticket=detailTicket,text;
      try{
        if(typeof o.copyText!=='function')throw fault('support_unavailable');
        text=String(o.copyText(Object.assign({},detail.report,{replies:detail.replies,draftReply:currentDraft?currentDraft.body:''}),detail.report.diagnostics,o.format));
      }catch(_){detailError='전체 복사를 준비하지 못했습니다. 다시 시도해 주세요.';render();return;}
      function current(){return safe(s)&&selected===id&&ticket===detailTicket;}
      function showStatus(value){if(!current())return;notice=value;var el=root.querySelector('.admSupportNotice');if(!el){el=d.createElement('p');el.className='admSupportNotice';el.setAttribute('role','status');root.querySelector('.admSupportDetail').appendChild(el);}el.textContent=value;}
      function fallback(){if(!current())return;var old=root.querySelector('.admSupportCopy');if(old)old.remove();var area=d.createElement('textarea');area.className='admSupportCopy';area.readOnly=true;area.setAttribute('aria-label','전체 복사할 제보와 답변');area.value=text;root.querySelector('.admSupportDetail').appendChild(area);area.focus();area.select();var ok=false;try{if(current())ok=!!d.execCommand('copy');}catch(_){}showStatus(ok?'전체 내용을 복사했습니다.':'아래 내용을 선택해 복사해 주세요.');}
      if(!current())return;
      if(!w.navigator.clipboard||typeof w.navigator.clipboard.writeText!=='function'){fallback();return;}
      try{Promise.resolve(w.navigator.clipboard.writeText(text)).then(function(){showStatus('전체 내용을 복사했습니다.');},fallback);}catch(_){fallback();}
    }
    function onInput(e){if(!reconcile()||!adminConfirmed||busy||!detail||!currentDraft||currentDraft.attempt)return;if(e.target&&e.target.name==='reply'){currentDraft.body=String(e.target.value||'').slice(0,4000);persist(currentDraft);}}
    function onSubmit(e){if(e.target&&e.target.matches&&e.target.matches('[data-adm-support-form="reply"]')){e.preventDefault();submit();}}
    function onClick(e){
      var b=e.target&&e.target.closest&&e.target.closest('button');if(!b||!root.contains(b)||b.disabled||!reconcile())return;
      if(b.dataset.admReport){openReport(b.dataset.admReport);return;}
      var action=b.dataset.admSupport;if(action==='copy'){copy();return;}if(busy)return;
      if(action==='refresh')loadList(false);else if(action==='more'&&!listLoading)loadList(true);else if(action==='retry-detail')openReport(selected);
      else if(action==='back'){detailTicket++;detailLoading=false;selected='';detail=null;currentDraft=null;detailError='';notice='';render();}
    }
    function pendingUnsafe(){if(busy)return true;var unsafe=false;drafts.forEach(function(entry){if(entry.body||entry.attempt)unsafe=true;});return unsafe;}
    function load(){
      if(destroyed)return Promise.resolve();
      generation++;listTicket++;detailTicket++;sendTicket++;clearView();owner=readOwner();active=true;
      if(!watch&&w.setInterval)watch=w.setInterval(reconcile,300);
      if(!owner.ready||!owner.uid){listError=errorText('denied');render();return Promise.resolve();}
      return loadList(false);
    }
    function deactivate(){if(destroyed)return;persist(currentDraft);active=false;generation++;listTicket++;detailTicket++;sendTicket++;clearView();root.innerHTML='';if(watch){w.clearInterval(watch);watch=null;}}
    function destroy(){if(destroyed)return;deactivate();destroyed=true;drafts.clear();root.removeEventListener('input',onInput);root.removeEventListener('submit',onSubmit);root.removeEventListener('click',onClick);events.forEach(function(name){w.removeEventListener(name,reconcile);});root.remove();}
    var events=['ps-auth-state','storage','focus','pageshow'];events.forEach(function(name){w.addEventListener(name,reconcile);});
    root.addEventListener('input',onInput);root.addEventListener('submit',onSubmit);root.addEventListener('click',onClick);
    return {load:load,deactivate:deactivate,destroy:destroy,pendingUnsafe:pendingUnsafe};
  }
  return {create:create};
});
