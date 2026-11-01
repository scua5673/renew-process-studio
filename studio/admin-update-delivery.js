/* Read existing administrator-only events. Count update attempts, not physical
   devices: a browser may have several tabs and a user may have several phones. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSAdminUpdateDelivery=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var stages={available:'새 버전 발견',downloaded:'다운로드 완료',saving:'저장 확인 중',deferred:'적용 대기',check_failed:'새 버전 확인 실패',install_failed:'다운로드·설치 실패',applied:'적용 완료'};
  function group(rows,now){
    var map={},applied=[];rows.forEach(function(r){
      var m=r.meta;if(!m||typeof m!=='object'||!stages[m.stage]||!/^[a-z0-9-]{1,60}$/.test(m.update_id||'')||!r.user_id)return;
      var at=Date.parse(r.created_at);if(!Number.isFinite(at)||at>now)return;
      if(m.stage==='applied')applied.push({user:r.user_id,id:m.update_id,to:m.to,at:at});
      var key=[r.user_id,m.update_id,m.to||'check'].join('|'),g=map[key];
      if(!g)g=map[key]={user:r.user_id,id:m.update_id,device:r.device,from:m.from,to:m.to,first:at,last:at,stage:m.stage,reason:m.reason,applied:false};
      g.first=Math.min(g.first,at-Math.min(43200,Math.max(0,+m.mins||0))*60000);
      if(at>=g.last){g.last=at;g.stage=m.stage;g.reason=m.reason;}
      if(m.stage==='applied')g.applied=true;
    });
    function reached(a,b){if(!/^\d+\.\d+$/.test(a||'')||!/^\d+\.\d+$/.test(b||''))return a===b;var x=a.split('.').map(Number),y=b.split('.').map(Number);return x[0]>y[0]||x[0]===y[0]&&x[1]>=y[1];}
    return Object.values(map).filter(function(g){return !g.applied&&!applied.some(function(a){return a.user===g.user&&a.id===g.id&&a.at>=g.last&&reached(a.to,g.to);})&&now-g.last<=2*3600000&&(g.last-g.first>=10*60000||/failed/.test(g.stage));}).sort(function(a,b){return (b.last-b.first)-(a.last-a.first);});
  }
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function html(rows,now,capped){
    var list=group(rows,now),note='<p class="adm-stale-note">최근 2시간에 신호가 있고 10분 이상 적용이 지연되거나 확인·설치에 실패한 세션입니다. 기기 대수나 현재 온라인 여부를 뜻하지 않습니다. 새 진단이 있는 버전부터 집계해요.</p>';
    if(capped)note+='<p class="adm-stale-note">조회 상한에 도달해 일부 기록만 표시합니다.</p>';
    if(!list.length)return note+'<div class="empty">조회한 기록에서 장기 대기 세션이 확인되지 않았습니다.</div>';
    return note+'<div class="tablewrap"><table><thead><tr><th>사용자</th><th>기기</th><th>앱 판 → 목표</th><th>관찰된 지연</th><th>단계·원인</th></tr></thead><tbody>'+list.map(function(g){return '<tr><td><button class="adm-stale-user" data-update-user="'+esc(g.user)+'">사용자 보기</button></td><td>'+esc({mobile:'폰',tablet:'태블릿',desktop:'컴퓨터'}[g.device]||'미확인')+'</td><td>'+esc(g.from)+' → '+esc(g.to||'확인 중')+'</td><td>'+Math.floor((g.last-g.first)/60000)+'분</td><td>'+esc(stages[g.stage])+'<div class="muted">'+esc(g.reason)+'</div></td></tr>';}).join('')+'</tbody></table></div>';
  }
  function create(o){
    var ticket=0;
    async function load(current){
      var turn=++ticket,now=Date.now(),until=new Date(now).toISOString(),since=new Date(now-48*3600000).toISOString(),rows=[],cursor=null,capped=false;
      function valid(){return turn===ticket&&(!current||current());}
      o.host.innerHTML='<div class="loading">업데이트 적용 현황 확인 중…</div>';
      try{
        for(;;){
          if(!valid())return;
          var q='ps_events?select=id,event_name,device,app_version,error_code,created_at,user_id,meta&event_name=in.(update_available,update_downloaded,update_saving,update_deferred,update_check_failed,update_install_failed,update_applied)&created_at=gte.'+encodeURIComponent(since)+'&created_at=lte.'+encodeURIComponent(until)+'&order=created_at.desc,id.desc&limit=500';
          if(cursor)q+='&or='+encodeURIComponent('(created_at.lt.'+cursor.created_at+',and(created_at.eq.'+cursor.created_at+',id.lt.'+cursor.id+'))');
          var batch=await o.request(q);if(!valid())return;
          if(!Array.isArray(batch))throw Error('invalid response');if(!batch.length)break;
          var last=batch[batch.length-1];if(!/^\d+$/.test(String(last.id))||!/^\d{4}-\d\d-\d\dT[\d:.+Z-]+$/.test(last.created_at))throw Error('invalid cursor');
          if(cursor&&(last.created_at>cursor.created_at||last.created_at===cursor.created_at&&Number(last.id)>=Number(cursor.id)))throw Error('cursor did not advance');
          rows=rows.concat(batch);cursor=last;if(rows.length>=4000){capped=true;break;}
        }
        if(!valid())return;o.host.innerHTML=html(rows,now,capped);
        o.host.querySelectorAll('[data-update-user]').forEach(function(b){b.onclick=function(){o.openUser(b.getAttribute('data-update-user'));};});
      }catch(_){if(valid())o.host.innerHTML='<div class="empty">업데이트 적용 현황을 확인하지 못했습니다. 다시 조회해 주세요.</div>';}
    }
    return {load:load};
  }
  return {group:group,html:html,create:create};
});
