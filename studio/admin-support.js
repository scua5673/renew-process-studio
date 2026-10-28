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
    unavailable:'오류 제보 기능을 불러오지 못했습니다. 서버에 지원 기능이 설치되어 있는지 확인해 주세요.',
    missing:'이 제보를 열 수 없습니다. 목록을 새로고침해 주세요.',
    conflict:'답변 등록 결과가 기존 내용과 다릅니다. 제보를 다시 열어 확인해 주세요. 작성한 답변은 보관했습니다.',
    invalid:'답변을 저장하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.',
    network:'요청 결과를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'
  }[kind]||'요청을 완료하지 못했습니다.';}
  /* 20261014 — 처리 상태. 서버(ps_support_list)가 줄마다 stage 를 준다: needs(답변 필요) · answered(답변함) · closed(닫힘).
     옛 서버(stage 없음)는 예전처럼 «대화 n개 / 새 제보»만 보인다. */
  var STAGES=['needs','answered','closed'],FIXED=/^\d{1,2}\.\d{3}$/,VERSION=FIXED,DEVICE={desktop:'컴퓨터',tablet:'태블릿',mobile:'폰',unknown:'기기 미확인'};
  function ago(iso,now){var t=Date.parse(String(iso||''));if(!isFinite(t))return '시각 미확인';var m=Math.round((now-t)/60000);if(m<1)return '방금';if(m<60)return m+'분 전';var h=Math.round(m/60);if(h<48)return h+'시간 전';return Math.round(h/24)+'일 전';}
  function stageLabel(r){
    if(!r||STAGES.indexOf(r.stage)<0)return r&&r.reply_count>0?'대화 '+r.reply_count+'개':'새 제보';
    if(r.stage==='closed')return r.fixed_in?'고침 '+r.fixed_in+' · 닫힘':'닫힘';
    if(r.stage==='answered')return r.fixed_in?'고침 '+r.fixed_in+' · 답변함':'답변함';
    return r.has_admin_reply?'재문의':'새 제보';
  }
  /* 20261017 — 보낸 사람(관리자에게만 · 서버 ps_support_reporter). 없거나 모양이 이상하면 null — 화면은 예전처럼 «사용자 제보» */
  function reporterOf(v){
    if(!v||typeof v!=='object'||Array.isArray(v))return null;
    var s=function(x,n){return typeof x==='string'&&x.trim()?x.trim().slice(0,n):'';};
    var teams=Array.isArray(v.teams)?v.teams.map(function(t){return t&&typeof t==='object'?s(t.name,60):'';}).filter(Boolean).slice(0,6):[];
    var r={id:UUID.test(v.user_id||'')?String(v.user_id).toLowerCase():'',name:s(v.name,60),email:s(v.email,120),teams:teams};
    return r.id||r.name||r.email?r:null;
  }
  /* 목록 줄은 짧게(이름 · 첫 팀 외 n), 제보 머리는 다(이름 · 이메일 · 팀 모두) */
  function reporterLine(r,full){
    if(!r)return '';
    var who=r.name||(!full&&r.email?r.email.split('@')[0]:'')||(r.id?'이름 없음 · '+r.id.slice(0,8):'이름 없음'),parts=[who];
    if(full&&r.email)parts.push(r.email);
    if(r.teams.length)parts.push(full?r.teams.join(', '):r.teams[0]+(r.teams.length>1?' 외 '+(r.teams.length-1):''));
    return parts.join(' · ');
  }
  function validCounts(c){return !!c&&typeof c==='object'&&['needs','answered','closed','total'].every(function(k){return Number.isInteger(c[k])&&c[k]>=0;});}
  function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(v))return '시각 미확인';var d=new Date(v);return isFinite(d.getTime())?d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시각 미확인';}
  function create(options){
    var o=options||{},w=o.window||(typeof window!=='undefined'?window:null),host=o.host,d=w&&w.document;
    if(!w||!d||!host||typeof o.rpc!=='function'||typeof o.context!=='function')throw new Error('admin_support_configuration_required');
    var root=d.createElement('section');root.className='admSupport';root.setAttribute('aria-label','오류 제보 관리');host.appendChild(root);
    var active=false,destroyed=false,owner=null,generation=0,listTicket=0,detailTicket=0,sendTicket=0;
    var rows=[],cursor=null,adminConfirmed=false,listLoading=false,detailLoading=false,busy=false,selected='',detail=null,currentDraft=null;
    var listError='',detailError='',notice='',drafts=new Map(),watch=null,renderedSelected='';
    var filter='',counts=null,triage=false,fixedDraft='',statusTicket=0;
    /* 3.198 — 제보자 기기 현황(ps_support_reporter_devices): undefined 아직 · null 못 받음 · {latest,devices} */
    var devices,devicesTicket=0;
    function readOwner(){try{var c=o.context()||{};return {uid:String(c.uid||''),epoch:String(c.epoch==null?'':c.epoch),ready:c.ready===true};}catch(_){return {uid:'',epoch:'',ready:false};}}
    function equalOwner(a,b){return !!a&&!!b&&a.uid===b.uid&&a.epoch===b.epoch&&a.ready===b.ready;}
    function stamp(){return {uid:owner.uid,epoch:owner.epoch,ready:owner.ready,generation:generation};}
    function valid(s){return !destroyed&&active&&!!s&&s.generation===generation&&s.ready&&!!s.uid&&equalOwner(s,readOwner());}
    function clearView(){rows=[];cursor=null;adminConfirmed=false;listLoading=false;detailLoading=false;busy=false;selected='';detail=null;currentDraft=null;listError='';detailError='';notice='';fixedDraft='';statusTicket++;filter='';counts=null;triage=false;devices=undefined;devicesTicket++;}
    function rowOf(id){return rows.find(function(r){return r.id===id;})||null;}
    function shareCounts(){if(triage&&validCounts(counts)&&typeof o.onCounts==='function'){try{o.onCounts(Object.assign({},counts));}catch(_){}}}
    function moveCount(from,to){if(!triage||!validCounts(counts)||from===to)return;if(STAGES.indexOf(from)>=0&&counts[from]>0)counts[from]--;if(STAGES.indexOf(to)>=0)counts[to]++;shareCounts();}
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
      if(can&&triage&&validCounts(counts))h+='<div class="admSupportFilters" role="group" aria-label="처리 상태로 거르기">'+[['needs','답변 필요'],['answered','답변함'],['closed','닫힘'],['','전체']].map(function(f){
        var n=f[0]?counts[f[0]]:counts.total,on=filter===f[0];
        return '<button type="button" class="admSupportFilter'+(on?' is-on':'')+(f[0]==='needs'&&n>0?' is-alert':'')+'" data-adm-filter="'+(f[0]||'all')+'" aria-pressed="'+on+'"'+(listLoading||busy?' disabled':'')+'>'+f[1]+' <b>'+n+'</b></button>';}).join('')+'</div>';
      if(listError)h+='<p class="admSupportError" role="alert">'+esc(listError)+'</p>';
      if(listLoading&&!rows.length)h+='<p class="admSupportEmpty" role="status">접수된 제보를 불러오는 중…</p>';
      else if(can&&!rows.length&&!listError)h+='<p class="admSupportEmpty">'+(filter?'이 상태의 제보가 없습니다.':'아직 접수된 제보가 없습니다.')+'</p>';
      h+='<div class="admSupportList">'+(can?rows.map(function(r){return '<button type="button" class="admSupportRow'+(selected===r.id?' is-selected':'')+'" data-adm-report="'+esc(r.id)+'" aria-pressed="'+(selected===r.id)+'"'+(busy?' disabled':'')+'><span><strong>'+esc(r.title)+'</strong><small>'+esc(date(r.created_at))+' · '+(r.is_own?'내 제보':r.reporter?esc(reporterLine(r.reporter)):'사용자 제보')+'</small></span><span class="admSupportCount'+(r.stage?' is-'+r.stage:'')+'">'+esc(stageLabel(r))+'</span></button>';}).join(''):'')+'</div>';
      if(can&&cursor)h+='<button type="button" class="admSupportMore" data-adm-support="more"'+(listLoading||busy?' disabled':'')+'>'+(listLoading?'불러오는 중…':'이전 제보 더 보기')+'</button>';
      h+='</section><section class="admSupportDetail" aria-label="제보 내용과 답변">';
      if(can&&selected)h+='<button type="button" class="admSupportBack" data-adm-support="back"'+(busy?' disabled':'')+'>목록으로</button>';
      if(detailError)h+='<p class="admSupportError" role="alert">'+esc(detailError)+'</p>';
      if(notice)h+='<p class="admSupportNotice" role="status">'+esc(notice)+'</p>';
      if(detailLoading)h+='<p class="admSupportEmpty" role="status">제보와 답변을 불러오는 중…</p>';
      else if(can&&detail){
        var r=detail.report,entry=currentDraft,count=r.diagnostics&&Array.isArray(r.diagnostics.logs)?r.diagnostics.logs.length:0,who=detailReporter();
        h+='<article class="admSupportReport"><h2>'+esc(r.title)+'</h2><small>'+esc(date(r.created_at))+'</small>'
          +(who?'<p class="admSupportWho">보낸 사람 <b>'+esc(reporterLine(who,true))+'</b></p>':'')+devicesHtml()+'<p>'+esc(r.body)+'</p>'
          +(detail.image?'<div class="support-image-view" data-adm-support-image></div>':'')+'<details class="admSupportLogs"><summary>제보 당시 사용 환경 · 오류 로그 '+count+'건</summary><pre>'+esc(diagnosticText(r.diagnostics))+'</pre></details>'
          +'<button type="button" data-adm-support="copy">제보·대화·사용 환경·로그 전체 복사</button></article>'
          +statusHtml()
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
      if(w.PSSupportImage&&can&&detail&&detail.image){var imageId=detail.report.id,imageStamp=stamp();w.PSSupportImage.viewer(w,root.querySelector('[data-adm-support-image]'),function(){return call(imageStamp,'ps_support_image_get',{p_report_id:imageId}).then(function(value){if(!safe(imageStamp))throw fault('support_owner_changed');return value;});});}
      root.querySelector('.admSupportInbox').scrollTop=inboxScroll;root.querySelector('.admSupportDetail').scrollTop=detailScroll;
    }
    function detailReporter(){ if(!detail||!detail.report||detail.report.is_own)return null; return reporterOf(detail.report.reporter)||(rowOf(selected)||{}).reporter||null; }
    /* 3.198 — 제보자의 최근 7일 기기 × 앱 판. 제보 본문을 읽기 전에 «이 사람의 아이패드가 옛 판에 머물러 있나»를 본다.
       함수가 없거나(옛 서버) 실패하면 조용히 숨긴다 — 제보 열기 · 답변은 그대로. */
    function versionNo(v){return VERSION.test(String(v||''))?Math.round(parseFloat(v)*1000):null;}
    function loadDevices(s,id){
      var ticket=++devicesTicket;
      call(s,'ps_support_reporter_devices',{p_report_id:id}).then(function(r){
        if(!safe(s)||ticket!==devicesTicket||selected!==id)return;
        var ok=r&&typeof r==='object'&&Array.isArray(r.devices)&&r.devices.every(function(d){return d&&typeof d==='object'&&typeof d.device==='string'&&typeof d.app_version==='string'&&typeof d.last_at==='string';});
        devices=ok?{latest:VERSION.test(String(r.latest||''))?String(r.latest):'',days:Number.isInteger(r.days)?r.days:7,devices:r.devices.slice(0,12)}:null;render();
      }).catch(function(){if(!safe(s)||ticket!==devicesTicket)return;devices=null;render();});
    }
    function devicesHtml(){
      if(!devices||!detail||detail.report.is_own)return '';
      var latest=versionNo(devices.latest),now=Date.now();
      if(!devices.devices.length)return '<ul class="admSupportDevices"><li class="admSupportDevicesHead">최근 '+devices.days+'일 기기 기록 없음</li></ul>';
      return '<ul class="admSupportDevices"><li class="admSupportDevicesHead">제보자 기기 · 최근 '+devices.days+'일'+(devices.latest?' · 최신 판 '+esc(devices.latest):'')+'</li>'+devices.devices.map(function(d){
        var v=versionNo(d.app_version),old=latest!=null&&v!=null&&latest-v>=10,crash=Number.isInteger(d.crashes)&&d.crashes>0?d.crashes:0,full=Number.isInteger(d.storage_full)&&d.storage_full>0?d.storage_full:0;
        return '<li class="'+(old?'is-old':'')+'"><span>'+esc(DEVICE[d.device]||d.device)+(d.standalone===true?' · 설치 앱':'')+'</span><b>'+esc(d.app_version)+'</b>'
          +(old?'<span class="adm-stale-tag warn">옛 판</span>':'')+'<small>'+esc(ago(d.last_at,now))+'</small>'
          +(crash?'<small class="adm-stale-bad">비정상 종료 '+crash+'</small>':'')+(full?'<small class="adm-stale-bad">저장공간 가득 '+full+'</small>':'')+'</li>';
      }).join('')+'</ul>';
    }
    function statusHtml(){
      var row=rowOf(selected);if(!triage||!row||STAGES.indexOf(row.stage)<0)return '';
      var closed=row.status==='closed';
      return '<section class="admSupportStatus" aria-label="처리 상태"><div class="admSupportStatusHead"><b>처리 상태</b><span class="admSupportCount is-'+row.stage+'">'+esc(stageLabel(row))+'</span></div>'
        +'<div class="admSupportStatusRow"><label>고친 판<input name="fixed" inputmode="decimal" maxlength="6" placeholder="예: 3.029" value="'+esc(fixedDraft)+'"'+(busy?' disabled':'')+'></label>'
        +'<button type="button" data-adm-status="'+(closed?'open':'closed')+'"'+(busy?' disabled':'')+'>'+(closed?'다시 열기':'닫기')+'</button>'
        +'<button type="button" data-adm-status="keep"'+(busy||fixedDraft.trim()===(row.fixed_in||'')?' disabled':'')+'>고친 판만 저장</button></div>'
        +'<p class="admSupportHint">닫으면 «닫힘»으로 옮겨집니다. 제보자가 다시 글을 쓰면 저절로 다시 열립니다. 고친 판은 비워 두어도 됩니다.</p></section>';
    }
    function call(s,name,args){return Promise.resolve().then(function(){if(!safe(s))throw fault('support_owner_changed');return o.rpc(name,args);});}
    function loadList(more){
      if(!reconcile())return Promise.resolve();
      var s=stamp(),ticket=++listTicket;listLoading=true;listError='';
      if(!more){rows=[];cursor=null;adminConfirmed=false;detailTicket++;detailLoading=false;selected='';detail=null;currentDraft=null;detailError='';notice='';}
      render();
      /* 거를 때만 ps_support_inbox(20261014 — 앱이 부르는 ps_support_list 는 이름 · 인자 그대로 두었다) */
      var args={p_limit:20,p_before:more?cursor:null},fn='ps_support_list';if(triage&&filter){args.p_filter=filter;fn='ps_support_inbox';}
      return call(s,fn,args).then(function(result){
        if(!safe(s)||ticket!==listTicket)return;
        if(!result||result.is_admin!==true){denied();return;}
        if(!Array.isArray(result.reports)||result.reports.some(function(r){return !r||!UUID.test(r.id||'')||typeof r.title!=='string'||typeof r.is_own!=='boolean'||!Number.isInteger(r.reply_count)||r.reply_count<0
          ||(r.stage!=null&&STAGES.indexOf(r.stage)<0)||(r.fixed_in!=null&&!FIXED.test(String(r.fixed_in)));}))throw fault('support_failed');
        if(result.next_cursor!=null&&(typeof result.next_cursor!=='object'||typeof result.next_cursor.created_at!=='string'||!UUID.test(result.next_cursor.id||'')))throw fault('support_failed');
        var seen=new Set(rows.map(function(r){return r.id;}));
        result.reports.forEach(function(r){if(seen.has(r.id))return;
          rows.push({id:r.id,title:r.title,created_at:r.created_at,is_own:r.is_own,reply_count:r.reply_count,
            stage:STAGES.indexOf(r.stage)>=0?r.stage:'',status:r.status==='closed'?'closed':'open',has_admin_reply:r.has_admin_reply===true,fixed_in:r.fixed_in||'',
            reporter:r.is_own?null:reporterOf(r.reporter)});seen.add(r.id);});
        cursor=result.next_cursor||null;adminConfirmed=true;
        if(validCounts(result.counts)){triage=true;counts=Object.assign({},result.counts);shareCounts();}else if(!more){triage=false;counts=null;filter='';}
      }).catch(function(e){if(!safe(s)||ticket!==listTicket)return;var kind=errorKind(e);if(kind==='denied'){denied();return;}listError=errorText(kind);})
        .finally(function(){if(safe(s)&&ticket===listTicket){listLoading=false;render();}});
    }
    function openReport(id){
      if(!reconcile()||!adminConfirmed||busy||!UUID.test(id||'')||!rows.some(function(r){return r.id===id;}))return Promise.resolve();
      var s=stamp(),ticket=++detailTicket;selected=id;detail=null;currentDraft=draftFor(id);detailLoading=true;detailError='';notice='';fixedDraft=(rowOf(id)||{}).fixed_in||'';statusTicket++;devices=undefined;devicesTicket++;render();
      try{if(w.matchMedia('(max-width:700px)').matches)root.scrollIntoView({block:'start'});}catch(_){}
      return call(s,w.PSSupportImage?'ps_support_get_with_image':'ps_support_get',{p_report_id:id}).catch(function(e){if(w.PSSupportImage&&errorKind(e)==='unavailable')return call(s,'ps_support_get',{p_report_id:id});throw e;}).then(function(result){
        if(!safe(s)||ticket!==detailTicket)return;
        if(!result||!result.report||result.report.id!==id||typeof result.report.title!=='string'||typeof result.report.body!=='string'||!Array.isArray(result.replies))throw fault('support_failed');
        if(result.replies.some(function(q){return !q||!UUID.test(q.id||'')||q.report_id!==id||typeof q.body!=='string'||['admin','reporter'].indexOf(q.author_role)<0;}))throw fault('support_failed');
        detail=result;loadDevices(s,id);
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
        var row=rowOf(id);if(row){row.reply_count=detail.replies.length;
          if(triage&&row.stage&&row.status!=='closed'){var was=row.stage;row.stage='answered';row.has_admin_reply=true;moveCount(was,'answered');}}
        notice='운영자 답변을 저장했습니다.';
      }).catch(function(e){
        if(!safe(s)||ticket!==sendTicket)return;
        var kind=errorKind(e);if(kind==='denied'){denied();return;}if(kind==='missing'){lockView(errorText('missing'));return;}
        if(kind==='invalid'||kind==='unavailable'){entry.attempt=null;persist(entry);}
        detailError=kind==='network'?'답변 저장 결과를 확인하지 못했습니다. 같은 답변으로 다시 확인해 주세요.':errorText(kind);
      }).finally(function(){if(safe(s)&&ticket===sendTicket){busy=false;render();}});
    }
    function changeStatus(kind){
      var row=rowOf(selected);
      if(!reconcile()||!adminConfirmed||!detail||!triage||!row||busy)return Promise.resolve();
      var fixed=fixedDraft.trim();
      if(fixed&&!FIXED.test(fixed)){detailError='고친 판은 3.029처럼 숫자로 적어 주세요.';render();return Promise.resolve();}
      var status=kind==='keep'?row.status:kind;if(['open','closed'].indexOf(status)<0)return Promise.resolve();
      var s=stamp(),ticket=++statusTicket,id=selected;busy=true;detailError='';notice='';render();
      return call(s,'ps_support_set_status',{p_report_id:id,p_status:status,p_fixed_in:fixed||null}).then(function(result){
        if(!safe(s)||ticket!==statusTicket||selected!==id)return;
        if(!result||result.id!==id||['open','closed'].indexOf(result.status)<0||STAGES.indexOf(result.stage)<0||(result.fixed_in!=null&&!FIXED.test(String(result.fixed_in))))throw fault('support_failed');
        var was=row.stage;row.status=result.status;row.stage=result.stage;row.fixed_in=result.fixed_in||'';row.has_admin_reply=result.has_admin_reply===true;fixedDraft=row.fixed_in;
        moveCount(was,row.stage);
        notice=kind==='keep'?'고친 판을 저장했습니다.':result.status==='closed'?'제보를 닫았습니다.':'제보를 다시 열었습니다.';
      }).catch(function(e){
        if(!safe(s)||ticket!==statusTicket)return;
        var kind2=errorKind(e);if(kind2==='denied'){denied();return;}if(kind2==='missing'){lockView(errorText('missing'));return;}
        detailError=kind2==='unavailable'?'처리 상태 기능이 서버에 아직 없습니다(20261014_support_triage).':kind2==='invalid'?'상태를 바꾸지 못했습니다. 고친 판을 확인해 주세요.':'상태 변경 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요.';
      }).finally(function(){if(safe(s)&&ticket===statusTicket){busy=false;render();}});
    }
    function copy(){
      if(!reconcile()||!adminConfirmed||!detail)return;
      var s=stamp(),id=selected,ticket=detailTicket,text;
      try{
        if(typeof o.copyText!=='function')throw fault('support_unavailable');
        text=String(o.copyText(Object.assign({},detail.report,{replies:detail.replies,draftReply:currentDraft?currentDraft.body:''}),detail.report.diagnostics,o.format));
        var who=detailReporter();if(who)text='보낸 사람: '+reporterLine(who,true)+'\n'+text;
      }catch(_){detailError='전체 복사를 준비하지 못했습니다. 다시 시도해 주세요.';render();return;}
      function current(){return safe(s)&&selected===id&&ticket===detailTicket;}
      function showStatus(value){if(!current())return;notice=value;var el=root.querySelector('.admSupportNotice');if(!el){el=d.createElement('p');el.className='admSupportNotice';el.setAttribute('role','status');root.querySelector('.admSupportDetail').appendChild(el);}el.textContent=value;}
      function fallback(){if(!current())return;var old=root.querySelector('.admSupportCopy');if(old)old.remove();var area=d.createElement('textarea');area.className='admSupportCopy';area.readOnly=true;area.setAttribute('aria-label','전체 복사할 제보와 답변');area.value=text;root.querySelector('.admSupportDetail').appendChild(area);area.focus();area.select();var ok=false;try{if(current())ok=!!d.execCommand('copy');}catch(_){}showStatus(ok?'전체 내용을 복사했습니다.':'아래 내용을 선택해 복사해 주세요.');}
      if(!current())return;
      if(!w.navigator.clipboard||typeof w.navigator.clipboard.writeText!=='function'){fallback();return;}
      try{Promise.resolve(w.navigator.clipboard.writeText(text)).then(function(){showStatus('전체 내용을 복사했습니다.');},fallback);}catch(_){fallback();}
    }
    function onInput(e){
      if(!reconcile()||!adminConfirmed||busy||!detail)return;
      if(e.target&&e.target.name==='fixed'){fixedDraft=String(e.target.value||'').slice(0,6);var keep=root.querySelector('[data-adm-status="keep"]'),row=rowOf(selected);if(keep&&row)keep.disabled=fixedDraft.trim()===(row.fixed_in||'');return;}
      if(!currentDraft||currentDraft.attempt)return;
      if(e.target&&e.target.name==='reply'){currentDraft.body=String(e.target.value||'').slice(0,4000);persist(currentDraft);}
    }
    function onSubmit(e){if(e.target&&e.target.matches&&e.target.matches('[data-adm-support-form="reply"]')){e.preventDefault();submit();}}
    function onClick(e){
      var b=e.target&&e.target.closest&&e.target.closest('button');if(!b||!root.contains(b)||b.disabled||!reconcile())return;
      if(b.dataset.admReport){openReport(b.dataset.admReport);return;}
      if(b.dataset.admFilter){if(busy||listLoading)return;var next=b.dataset.admFilter==='all'?'':b.dataset.admFilter;if(STAGES.indexOf(next)<0&&next!=='')return;filter=next;loadList(false);return;}
      if(b.dataset.admStatus){changeStatus(b.dataset.admStatus);return;}
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
