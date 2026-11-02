(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSAdminHub=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function issues(s,now){
    var list=[];
    Object.keys(s.sources||{}).forEach(function(k){var x=s.sources[k];if(x&&x.ok===false)list.push({id:'source:'+k,rank:2,title:x.label+' 조회 확인',detail:'조회 실패 · 0건으로 집계하지 않습니다.',next:'해당 자료를 다시 조회하고 연결·권한·응답 상태를 확인하세요.',tab:x.tab||'home'});});
    (s.reports||[]).forEach(function(r){var age=now-Date.parse(r.received_at),counts=['pending_team','pending_personal','held','skipped','deferred','conflicts'];
      if(!Number.isFinite(age)||age<0||age>600000)return;
      var pending=counts.some(function(k){return typeof r[k]==='number'&&r[k]>0;});
      if(!pending&&!r.error_code)return;
      list.push({id:'report:'+r.user_id+':'+r.device_id+':'+r.workspace_id,rank:r.conflicts>0?3:2,title:r.conflicts>0?'저장 충돌 확인':'최근 저장 보고 확인',detail:'기기 보고 '+new Date(r.received_at).toLocaleString('ko-KR')+' · '+(r.app_version||'판 미확인'),next:'미저장 자료를 보존하고 사용자 상세에서 기기 대기·보류와 마지막 확인을 살펴보세요.',user:r.user_id,wid:r.workspace_id,tab:'users'});
    });
    (s.followups||[]).filter(function(r){return r.status!=='verified'&&r.status!=='closed';}).forEach(function(r){var overdue=r.next_check_at&&Date.parse(r.next_check_at)<now;
      list.push({id:'followup:'+r.id,rank:overdue?3:1,title:r.status==='deployed'?'배포 후 해결 확인':overdue?'기한 지난 후속 확인':'열린 후속 확인',detail:r.note||'관리 기록',next:(r.assignee_label||'담당자 미지정')+' · '+(r.next_check_at?new Date(r.next_check_at).toLocaleString('ko-KR'):'다음 확인일 미정'),user:r.subject_user_id,wid:r.workspace_id,tab:'users'});
    });
    return list.sort(function(a,b){return b.rank-a.rank||a.id.localeCompare(b.id);});
  }
  function create(o){
    var selected=null,state={},host=o.host;
    function render(next){state=next||state;var rows=issues(state,Date.now()),item=rows.find(function(r){return r.id===selected;})||rows[0];selected=item?item.id:null;
      host.innerHTML='<div class="ah-heading"><div><h2>운영 이슈</h2><p>최근 보고 · 조회 상태 · 열린 후속 기록</p></div><button class="hbtn" type="button" data-hub-reload>이슈 다시 확인</button></div>'
        +'<div class="ah-grid"><div class="ah-list">'+(rows.length?rows.map(function(r){return '<button type="button" class="ah-item" data-hub-issue="'+esc(r.id)+'" aria-pressed="'+(selected===r.id)+'"><b>'+esc(r.title)+'</b><span>'+esc(r.user&&o.userName(r.user)||r.detail)+'</span></button>';}).join(''):'<div class="ah-empty">조회된 자료에서 조치할 이슈가 확인되지 않았습니다.<br>기기 보고가 없거나 오래된 대상의 현재 상태는 미확인입니다.</div>')+'</div>'
        +'<div class="ah-detail" aria-live="polite">'+(item?'<h3>'+esc(item.title)+'</h3><p>'+esc(item.detail)+'</p>'+(item.wid?'<p>'+esc(o.workspaceName(item.wid))+'</p>':'')+'<h3>다음 확인</h3><p>'+esc(item.next)+'</p><button class="hbtn" type="button" data-hub-open>'+(item.user?'사용자·후속 관리 열기':'관련 화면 열기')+'</button>':'<h3>진행 흐름</h3><p>발견 → 영향 확인 → 담당·기한 지정 → 수정 배포 → 실제 해결 검증</p>')+'</div></div>'
        +'<p class="ah-note">이슈 수는 관측된 항목 수이며 사용자 수·자료 유실 건수가 아닙니다. 배포 완료와 사용자 적용·해결 확인은 구분합니다.</p>';
      host.querySelector('[data-hub-reload]').onclick=o.reload;
      host.querySelectorAll('[data-hub-issue]').forEach(function(b){b.onclick=function(){selected=b.getAttribute('data-hub-issue');render();};});
      var open=host.querySelector('[data-hub-open]');if(open)open.onclick=function(){if(item.user)o.openUser(item.user,item.wid);else o.go(item.tab);};
    }
    return {render:render};
  }
  return {issues:issues,create:create};
});
