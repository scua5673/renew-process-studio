/* 20261014 — 관리자 작업 기록(백엔드 탭). ps_admin_actions_list 를 읽기만 한다.
   팀 삭제 · 멤버 내보내기 · 콘텐츠 삭제/복구는 원래부터 서버 함수가 ps_admin_log 로 남겨 왔고,
   오류 제보 상태 · 커뮤니티 글 숨김도 같은 표에 남는다. 본문은 받지 않는다(제목 80자까지). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminActions=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var LABELS={workspace_delete:'팀 삭제',member_remove:'멤버 내보내기',library_soft_delete:'콘텐츠 삭제',library_restore:'콘텐츠 복구',
    support_status:'오류 제보 상태',community_hide:'커뮤니티 글 숨김',community_unhide:'커뮤니티 글 되살림',community_resolve:'커뮤니티 신고 닫음'};
  var DANGER={workspace_delete:1,member_remove:1,library_soft_delete:1,community_hide:1};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function when(v){var d=new Date(v);if(!isFinite(d.getTime()))return '시각 미확인';return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  function label(action){return LABELS[action]||String(action||'기타');}
  function meta(r){return r&&r.meta&&typeof r.meta==='object'?r.meta:{};}
  function detail(r){
    var m=meta(r);
    if(r.action==='support_status')return (m.status==='closed'?'닫음':m.status==='open'?'다시 엶':'')+(m.fixed_in?' · 고침 '+m.fixed_in:'');
    if(r.action==='workspace_delete'){var p=[];if(Number.isInteger(m.members))p.push('멤버 '+m.members);if(Number.isInteger(m.library))p.push('콘텐츠 '+m.library);return p.join(' · ');}
    if(r.action==='community_hide')return (m.reason?String(m.reason):'')+(Number.isInteger(m.reports_closed)&&m.reports_closed?(m.reason?' · ':'')+'신고 '+m.reports_closed+'건 닫음':'');
    if(r.action==='community_resolve'&&Number.isInteger(m.reports_closed))return '신고 '+m.reports_closed+'건';
    return '';
  }
  function target(r){
    var team=r.workspace_name?(r.workspace_name+(r.workspace_gone?' (삭제된 팀)':'')):'',name=r.target_name||'';
    if(r.action==='workspace_delete')return team||'(이름 없는 팀)';
    if(r.action==='member_remove')return (name||'(알 수 없는 사람)')+(team?' · '+team:'');
    if(r.action==='library_soft_delete'||r.action==='library_restore')return (name||'(이름 없는 콘텐츠)')+(team?' · '+team:'');
    return name||team||(r.target_id?String(r.target_id).slice(0,8):'—');
  }
  function valid(r){return !!r&&Number.isInteger(r.id)&&typeof r.action==='string'&&typeof r.at==='string';}
  function render(rows,opts){
    opts=opts||{};
    if(!rows.length)return '<div class="loading">아직 기록된 관리자 작업이 없어요. 팀 삭제 · 멤버 내보내기 · 콘텐츠 삭제/복구 · 제보 상태 · 커뮤니티 숨김을 하면 여기에 남아요.</div>';
    return '<div class="tablewrap"><table class="admActTable"><thead><tr><th>시각</th><th>누가</th><th>작업</th><th>대상</th><th>내용</th></tr></thead><tbody>'
      +rows.map(function(r){
        return '<tr><td class="muted" style="white-space:nowrap">'+esc(when(r.at))+'</td><td class="muted">'+esc(r.admin_email||'(지운 계정)')+'</td>'
          +'<td><span class="tybadge'+(DANGER[r.action]?' admActDanger':'')+'">'+esc(label(r.action))+'</span></td>'
          +'<td>'+esc(target(r))+'</td><td class="muted">'+esc(detail(r))+'</td></tr>';
      }).join('')+'</tbody></table></div>'
      +(opts.more?'<button type="button" class="rowbtn" data-adm-act-more style="margin-top:10px">이전 기록 더 보기</button>':'');
  }
  function create(o){
    var host=o.host,rows=[],next=null,ticket=0,busy=false;
    function draw(msg){if(!host)return;host.innerHTML=msg||render(rows,{more:!!next});}
    function fetch(more){
      var t=++ticket;busy=true;if(!more){rows=[];next=null;draw('<div class="loading">불러오는 중…</div>');}
      return Promise.resolve().then(function(){return o.rpc('ps_admin_actions_list',{p_limit:50,p_before_id:more?next:null});}).then(function(res){
        if(t!==ticket)return;
        if(!res||!Array.isArray(res.rows)||!res.rows.every(valid))throw new Error('admin_actions_malformed');
        var seen=new Set(rows.map(function(r){return r.id;}));res.rows.forEach(function(r){if(!seen.has(r.id))rows.push(r);});
        next=Number.isInteger(res.next_before)?res.next_before:null;draw();
      }).catch(function(e){
        if(t!==ticket)return;var m=e?[e.code,e.status,e.message].join(' '):'';
        draw(/PGRST202|42883|404|ps_admin_actions_list/.test(m)?'<div class="loading">아직 서버에 설치되지 않았어요 — migrations/20261014_admin_actions_view.sql 을 실행하면 여기에 뜹니다.</div>'
          :/42501|403|admin_required/.test(m)?'<div class="loading">관리자 권한을 확인하지 못했어요.</div>':'<div class="loading">불러오지 못했어요. 새로고침해 주세요.</div>');
      }).finally(function(){if(t===ticket)busy=false;});
    }
    if(host)host.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-adm-act-more]');if(b&&!busy&&next)fetch(true);});
    return {load:function(){return fetch(false);},more:function(){return next?fetch(true):Promise.resolve();},rows:function(){return rows.slice();}};
  }
  return {create:create,render:render,label:label,target:target,detail:detail};
});
