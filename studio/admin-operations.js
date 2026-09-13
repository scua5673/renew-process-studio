(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminOperations=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function classifyReport(r,now){
    var age=now-Date.parse(r.received_at||''), fresh=isFinite(age)&&age>=0&&age<=600000;
    var names=['pending_team','pending_personal','held','skipped','deferred','conflicts'];
    var hasPending=names.some(function(k){return Number.isInteger(r[k])&&r[k]>0;});
    var unknown=names.some(function(k){return !Number.isInteger(r[k])||r[k]<0;});
    if(!fresh)return {kind:'stale',label:'오래된 보고 · 현재 미확인'};
    if(hasPending||r.error_code)return {kind:'attention',label:'최근 보고에 확인할 항목'};
    if(unknown)return {kind:'unknown',label:'일부 상태 미확인'};
    return {kind:'clear',label:'보고 시점 대기 없음'};
  }
  function reportIssue(r){
    var labels={pending_team:'팀 대기',pending_personal:'개인 대기',held:'보류',skipped:'건너뜀',deferred:'다음 회차',conflicts:'충돌'};
    var items=Object.keys(labels).filter(function(k){return Number.isInteger(r[k])&&r[k]>0;}).map(function(k){return labels[k]+' '+r[k];});
    return items.slice(0,2).join(' · ')||(r.error_code?'오류 보고':'상태 확인');
  }
  function dueFollowups(rows,now){return rows.filter(function(r){return r.status!=='closed'&&r.status!=='verified';}).sort(function(a,b){
    var aa=Date.parse(a.next_check_at||'')||Infinity,bb=Date.parse(b.next_check_at||'')||Infinity;return aa-bb||Date.parse(b.updated_at)-Date.parse(a.updated_at);
  });}
  function time(v){var d=new Date(v);return isFinite(d.getTime())?d.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시각 미확인';}
  function create(opts){
    var host=document.getElementById('viewHome'),gen=0,state={reports:null,followups:null},section;
    if(!host)return {load:function(){return Promise.resolve();}};
    section=document.createElement('section');section.className='admin-ops';section.setAttribute('aria-label','운영 확인');host.insertBefore(section,host.firstChild);
    function userName(uid){var u=(opts.users()||[]).find(function(x){return x.user_id===uid;});return u?(u.name||u.email||'사용자'):'사용자 상세';}
    function workspaceName(wid){var w=(opts.workspaces()||[]).find(function(x){return x.id===wid;});return w?(w.name||'이름 없는 공간'):'공간 확인 필요';}
    function button(uid,label){return UUID.test(uid||'')?'<button type="button" class="admin-op-link" data-op-user="'+esc(uid)+'">'+esc(label||userName(uid))+' ↗</button>':esc(label||'사용자 미확인');}
    function unavailable(result,label){return '<div class="admin-op-empty"><b>'+label+' '+(result===null?'불러오는 중…':'조회하지 못했습니다')+'</b>'+(result===null?'':'<p>권한·연결·운영 기능 설치 상태를 확인하세요. 0건으로 집계하지 않습니다.</p><button type="button" class="admin-op-link" data-op-reload>다시 확인</button>')+'</div>';}
    function render(){
      var now=Date.now(),reports=Array.isArray(state.reports)?state.reports:null,followups=Array.isArray(state.followups)?state.followups:null;
      var flagged=reports?reports.filter(function(r){return classifyReport(r,now).kind==='attention';}):[];
      var stale=reports?reports.filter(function(r){return classifyReport(r,now).kind==='stale';}):[];
      var unknown=reports?reports.filter(function(r){return classifyReport(r,now).kind==='unknown';}):[];
      var todo=followups?dueFollowups(followups,now):[];
      section.innerHTML='<div class="admin-op-heading"><div><span>OPERATIONS</span><h1>오늘 확인할 일</h1><p>사용자 상태를 확인하고, 다음 조치까지 이어갑니다.</p></div><button type="button" class="hbtn" data-op-reload>운영 상태 새로고침</button></div>'
        +'<div class="admin-op-grid"><article class="admin-op-panel"><div class="admin-op-title"><h2>저장 상태 확인</h2><span>최근 기기 보고</span></div>'
        +(!reports?unavailable(state.reports,'저장 상태'):!reports.length?'<div class="admin-op-empty"><b>아직 기기 보고가 없습니다</b><p>지원 버전으로 앱을 사용하면 수집됩니다. 모든 기기가 정상이라는 뜻은 아닙니다.</p></div>':'<div class="admin-op-count"><b>'+flagged.length+'</b><span>확인할 보고 <small>조회된 '+reports.length+'개 보고 중</small></span></div>'
          +flagged.slice(0,5).map(function(r){return '<div class="admin-op-row"><div>'+button(r.user_id)+'<small>'+esc(workspaceName(r.workspace_id))+' · '+esc(r.device_class||'기기 미확인')+'</small></div><div><span class="admin-op-state">'+esc(reportIssue(r))+'</span><small>'+time(r.received_at)+'</small></div></div>';}).join('')
          +(stale.length?'<p class="admin-op-note">'+stale.length+'개는 10분 넘게 갱신되지 않았거나 시각이 맞지 않아 현재 상태를 판단하지 않습니다.</p>':'')
          +(unknown.length?'<p class="admin-op-note">'+unknown.length+'개는 일부 상태가 미확인입니다.</p>':'')
          +'<p class="admin-op-note">보고 수는 사용자 수나 유실 건수가 아닙니다. 사용자 상세에서 대기·보류·마지막 확인 시각을 구분합니다.</p>')+'</article>'
        +'<article class="admin-op-panel"><div class="admin-op-title"><h2>후속 확인</h2><span>관리자 공용 기록</span></div>'
        +(!followups?unavailable(state.followups,'후속 관리'):!todo.length?'<div class="admin-op-empty"><b>열린 후속 기록이 없습니다</b><p>사용자 상세에서 문의·사용 확인·유료 제안을 기록하고 담당자와 다음 확인일을 정하세요.</p></div>':todo.slice(0,5).map(function(r){
          var labels={support:'문의',usage:'사용 확인',paid:'유료 검증'};var overdue=r.next_check_at&&Date.parse(r.next_check_at)<now;
          return '<div class="admin-op-row"><div><span class="admin-op-kind">'+esc(labels[r.kind]||'후속 확인')+'</span> '+button(r.subject_user_id)+'<p>'+esc(String(r.note||'').slice(0,110))+'</p><small>'+esc(r.assignee_label||'담당자 미지정')+' · '+esc(r.status==='deployed'?'배포 후 확인 대기':r.status==='in_progress'?'진행 중':'확인 예정')+'</small></div><span class="admin-op-date '+(overdue?'overdue':'')+'">'+(r.next_check_at?time(r.next_check_at):'확인일 미정')+'</span></div>';
        }).join('')+(todo.length>5?'<p class="admin-op-note">열린 기록 '+todo.length+'건 중 다음 확인일 순 5건</p>':''))+'</article></div>'
        +'<div class="admin-op-find"><div><b>사용자를 찾아 상세 확인</b><small>소속 · 사용 흔적 · 저장 상태 · 후속 관리</small></div><form id="adminOpSearchForm"><label class="admin-sr-only" for="adminOpSearch">이름 또는 이메일</label><input id="adminOpSearch" autocomplete="off" placeholder="이름·이메일 검색"><button class="hbtn" type="submit">사용자 찾기</button></form></div>'
        +'<p class="admin-op-note admin-op-caption">아래는 기간별 발생·사용 집계입니다. 실시간 접속이나 현재 미해결 건수와 구분해서 확인하세요.</p>';
      section.querySelectorAll('[data-op-user]').forEach(function(b){b.onclick=function(){opts.openUser(b.dataset.opUser);};});
      section.querySelectorAll('[data-op-reload]').forEach(function(b){b.onclick=load;});
      section.querySelector('#adminOpSearchForm').onsubmit=function(e){e.preventDefault();opts.findUser(section.querySelector('#adminOpSearch').value);};
    }
    function load(){var token=++gen;state={reports:null,followups:null};render();
      return Promise.all(['reports','followups'].map(function(k){return opts.rpc(k==='reports'?'ps_admin_sync_reports_list':'ps_admin_followups_list',{p_user_id:null,p_workspace_id:null}).then(function(rows){
        if(token!==gen)return;state[k]=Array.isArray(rows)?rows:{error:true};render();
      }).catch(function(){if(token!==gen)return;state[k]={error:true};render();});}));
    }
    render();return {load:load,render:render};
  }
  return {create:create,classifyReport:classifyReport,dueFollowups:dueFollowups};
});
