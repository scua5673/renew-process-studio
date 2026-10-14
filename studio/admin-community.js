/* 20261014 — 관리자 «커뮤니티» 탭: 신고함 · 글 숨기기.
   커뮤니티의 «신고»는 ps_comm_reports 에 쌓이기만 했다. 서버(20261014_community_moderation)가 신고를 글마다 묶어 주면
   여기서 «글 숨기기»(모두에게 안 보임 · 그 글의 신고는 닫힘) · «문제 없음»(신고만 닫음) · «되살리기»를 한다.
   글 본문은 받지 않는다 — 제목 · 요약 200자 · 작성자 표시 이름 · 메일만. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminCommunity=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function when(v){var d=new Date(v);if(!v||!isFinite(d.getTime()))return '';return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  function n(v){return Number.isInteger(v)&&v>=0?v:0;}
  function validCounts(c){return !!c&&['open_reports','reported_posts','hidden_posts'].every(function(k){return Number.isInteger(c[k])&&c[k]>=0;});}
  function who(r){var name=r.owner_name||'',mail=r.owner_email||'';return name&&mail?name+' · '+mail:(name||mail||'작성자 미확인');}
  function reportLine(r){
    var parts=['신고 '+n(r.reports)+'건'],signed=n(r.reporters),anon=n(r.anonymous);
    if(signed)parts.push('로그인 '+signed+'명');if(anon)parts.push('익명 '+anon+'건');
    if(r.last_report_at)parts.push('마지막 '+when(r.last_report_at));
    return parts.join(' · ');
  }
  function reportedCard(r,state){
    var pid=String(r.pub_id||''),busy=state.busy===pid,live=r.exists===true&&!r.hidden_at&&!r.deleted;
    var h='<article class="commCard" data-comm-card="'+esc(pid)+'"><div class="commTitle"><b>'+(r.exists===true?esc(r.title||'(제목 없음)'):'이미 지워진 글')+'</b>'
      +(r.hidden_at?' <span class="tybadge">숨김</span>':'')+(r.deleted?' <span class="tybadge">삭제 표시</span>':'')+'</div>';
    if(r.exists===true)h+='<div class="muted commMeta">'+esc(who(r))+(r.created_at?' · 올린 날 '+esc(when(r.created_at)):'')+' · 조회 '+n(r.views)+' · 좋아요 '+n(r.likes)+' · 담기 '+n(r.copies)+'</div>'
      +(r.summary?'<p class="commSummary">'+esc(r.summary)+'</p>':'');
    h+='<div class="commReports">'+esc(reportLine(r))+'</div>';
    var reasons=Array.isArray(r.reasons)?r.reasons.filter(function(x){return typeof x==='string'&&x.trim();}):[];
    h+=reasons.length?'<ul class="commReasons">'+reasons.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'<div class="muted commMeta">신고 까닭은 적혀 있지 않아요(앱의 신고 단추는 까닭을 받지 않습니다).</div>';
    h+='<div class="commActions">';
    if(live)h+='<input data-comm-reason="'+esc(pid)+'" maxlength="200" placeholder="숨기는 까닭(선택 · 기록에만 남음)" value="'+esc(state.reasons[pid]||'')+'"'+(busy?' disabled':'')+'>'
      +'<button type="button" class="rowbtn danger" data-comm-hide="'+esc(pid)+'"'+(busy?' disabled':'')+'>글 숨기기</button>';
    h+='<button type="button" class="rowbtn" data-comm-resolve="'+esc(pid)+'"'+(busy?' disabled':'')+'>'+(r.exists===true?'문제 없음 · 신고 닫기':'신고 닫기')+'</button></div></article>';
    return h;
  }
  function hiddenRow(r,state){
    var pid=String(r.pub_id||''),busy=state.busy===pid;
    return '<tr><td><b>'+esc(r.title||'(제목 없음)')+'</b><div class="muted">'+esc(who(r))+'</div></td>'
      +'<td class="muted" style="white-space:nowrap">'+esc(when(r.hidden_at))+'</td><td class="muted">'+esc(r.hidden_reason||'—')+'</td><td class="muted">'+esc(r.hidden_by_email||'')+'</td>'
      +'<td style="text-align:right"><button type="button" class="rowbtn" data-comm-unhide="'+esc(pid)+'"'+(busy?' disabled':'')+'>되살리기</button></td></tr>';
  }
  function render(data,state){
    state=state||{reasons:{},busy:''};
    var c=data.counts,h='';
    if(state.notice)h+='<div class="commNotice" role="status">'+esc(state.notice)+'</div>';
    if(state.error)h+='<div class="commError" role="alert">'+esc(state.error)+'</div>';
    h+='<div class="panel"><div class="sec-t">검토할 신고 <span class="muted" style="font-size:11px;font-weight:600">· 열린 신고 '+n(c.open_reports)+'건 · 글 '+n(c.reported_posts)+'개</span></div>';
    h+=data.reported.length?data.reported.map(function(r){return reportedCard(r,state);}).join(''):'<div class="loading">검토할 신고가 없어요.</div>';
    h+='</div><div class="panel"><div class="sec-t">숨긴 글 <span class="muted" style="font-size:11px;font-weight:600">· '+n(c.hidden_posts)+'개 — 모두에게(올린 사람 포함) 안 보여요</span></div>';
    h+=data.hidden.length?'<div class="tablewrap"><table><thead><tr><th>글</th><th>숨긴 때</th><th>까닭</th><th>누가</th><th></th></tr></thead><tbody>'+data.hidden.map(function(r){return hiddenRow(r,state);}).join('')+'</tbody></table></div>'
      :'<div class="loading">숨긴 글이 없어요.</div>';
    return h+'</div>';
  }
  function valid(d){return !!d&&Array.isArray(d.reported)&&Array.isArray(d.hidden)&&validCounts(d.counts)
    &&d.reported.every(function(r){return r&&typeof r.pub_id==='string'&&r.pub_id;})&&d.hidden.every(function(r){return r&&typeof r.pub_id==='string'&&r.pub_id;});}
  function create(o){
    var host=o.host,data=null,ticket=0,state={reasons:{},busy:'',notice:'',error:''};
    function draw(msg){if(host)host.innerHTML=msg||render(data,state);}
    function share(){if(data&&typeof o.onCounts==='function'){try{o.onCounts(Object.assign({},data.counts));}catch(_){}}}
    function load(keepNotice){
      var t=++ticket;if(!keepNotice){state.notice='';state.error='';}
      if(!data)draw('<div class="loading">불러오는 중…</div>');
      return Promise.resolve().then(function(){return o.rpc('ps_admin_comm_queue',{p_limit:50});}).then(function(res){
        if(t!==ticket)return;if(!valid(res))throw new Error('community_queue_malformed');data=res;share();draw();
      }).catch(function(e){
        if(t!==ticket)return;var m=e?[e.code,e.status,e.message].join(' '):'';data=null;
        draw(/PGRST202|42883|404|ps_admin_comm_queue/.test(m)?'<div class="panel"><div class="loading">아직 서버에 설치되지 않았어요 — migrations/20261014_community_moderation.sql 을 실행하면 신고함이 여기에 뜹니다.</div></div>'
          :/42501|403|admin_required/.test(m)?'<div class="panel"><div class="loading">관리자 권한을 확인하지 못했어요.</div></div>':'<div class="panel"><div class="loading">신고함을 불러오지 못했어요. 새로고침해 주세요.</div></div>');
      });
    }
    function act(pid,name,args,ask,done){
      if(!data||state.busy||!pid)return Promise.resolve();
      if(ask&&typeof o.confirm==='function'&&!o.confirm(ask))return Promise.resolve();
      state.busy=pid;state.notice='';state.error='';draw();
      return Promise.resolve().then(function(){return o.rpc(name,args);}).then(function(res){
        if(!res||res.pub_id!==pid)throw new Error('community_action_malformed');
        delete state.reasons[pid];state.notice=done(res);state.busy='';return load(true);
      }).catch(function(e){
        state.busy='';var m=e?[e.code,e.status,e.message].join(' '):'';
        state.error=/PT404|post_not_found/.test(m)?'그 글을 찾지 못했어요. 이미 지워졌을 수 있어요 — «신고 닫기»를 쓰세요.':/42501|403/.test(m)?'관리자 권한을 확인하지 못했어요.':'처리하지 못했어요. 새로고침해 확인해 주세요.';
        draw();
      });
    }
    if(host){
      host.addEventListener('input',function(e){var pid=e.target&&e.target.getAttribute&&e.target.getAttribute('data-comm-reason');if(pid!=null)state.reasons[pid]=String(e.target.value||'').slice(0,200);});
      host.addEventListener('click',function(e){
        var b=e.target&&e.target.closest&&e.target.closest('button');if(!b||b.disabled)return;var g=function(k){return b.getAttribute(k);},pid;
        if((pid=g('data-comm-hide')))act(pid,'ps_admin_comm_hide',{p_pub_id:pid,p_hidden:true,p_reason:(state.reasons[pid]||'').trim()||null},
          '이 글을 숨길까요? 모두에게(올린 사람 포함) 안 보이고, 이 글의 신고는 닫힙니다. 나중에 «되살리기»로 되돌릴 수 있어요.',
          function(r){return '글을 숨겼어요'+(r.reports_closed?' · 신고 '+r.reports_closed+'건 닫음':'')+'.';});
        else if((pid=g('data-comm-resolve')))act(pid,'ps_admin_comm_resolve',{p_pub_id:pid},null,function(r){return '신고 '+n(r.reports_closed)+'건을 닫았어요. 글은 그대로예요.';});
        else if((pid=g('data-comm-unhide')))act(pid,'ps_admin_comm_hide',{p_pub_id:pid,p_hidden:false,p_reason:null},'이 글을 다시 보이게 할까요?',function(){return '글을 되살렸어요.';});
      });
    }
    return {load:function(){return load(false);},data:function(){return data;}};
  }
  return {create:create,render:render,reportLine:reportLine};
});
