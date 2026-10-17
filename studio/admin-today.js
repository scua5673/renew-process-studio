/* 3.081 — 운영 홈 맨 위 «지금 처리할 일» 한 줄.
   숫자는 각 화면이 이미 부르는 함수에서 받는다(새 서버 함수 없음): 오류 제보 답변 필요(ps_support_list counts) ·
   커뮤니티 열린 신고(ps_admin_comm_queue counts) · 24시간 실제 앱 오류(ps_admin_event_summary_v2) ·
   기한 지난 후속 확인(ps_admin_followups_list) · 마지막 데이터 사고 뒤 날수(ps_admin_incidents).
   못 받은 값은 0 으로 세지 않는다 — «확인 못 함»으로 남긴다(운영 홈의 다른 칸과 같은 원칙). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminToday=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function count(v){return Number.isInteger(v)&&v>=0?v:null;}
  /* 값 하나 = undefined(아직 안 옴) · null(못 받음) · 숫자/객체(받음) */
  function waiting(v){return v===undefined;}
  function cell(key,label,v,go,fmt){
    if(waiting(v))return {key:key,label:label,go:go,tone:'wait',value:'…',note:'불러오는 중'};
    if(v===null)return {key:key,label:label,go:go,tone:'unknown',value:'—',note:'확인 못 함'};
    return fmt(v);
  }
  /* state: {support, comm, errors, overdue, incident:{since_days,goal_days}} → 칸 다섯 */
  function tiles(state){
    state=state||{};
    var n=function(key,label,unit,go,hot){return cell(key,label,state[key],go,function(v){var c=count(v);
      if(c==null)return {key:key,label:label,go:go,tone:'unknown',value:'—',note:'확인 못 함'};
      return {key:key,label:label,go:go,tone:c?hot:'ok',value:String(c),note:c?unit:'없음'};});};
    return [
      n('support','오류 제보','답변 필요','support','warn'),
      n('comm','커뮤니티 신고','열린 신고','comm','warn'),
      n('errors','앱 오류','최근 24시간','errors','danger'),
      n('overdue','후속 확인','기한 지남','followups','warn'),
      cell('incident','무사고',state.incident,'back',function(r){
        var goal=count(r&&r.goal_days)||56,since=r?r.since_days:undefined;
        if(since==null)return {key:'incident',label:'무사고',go:'back',tone:'ok',value:'—',note:'기록된 사고 없음 · 목표 '+goal+'일'};
        since=count(since);if(since==null)return {key:'incident',label:'무사고',go:'back',tone:'unknown',value:'—',note:'확인 못 함'};
        return {key:'incident',label:'무사고',go:'back',tone:since>=goal?'ok':since<7?'warn':'plain',value:since+'일',
          note:since>=goal?'목표 '+goal+'일 통과':'목표 '+goal+'일까지 '+(goal-since)+'일'};
      })
    ];
  }
  /* 기한이 지난 열린 후속 기록 수. rows 가 배열이 아니면 null(못 받음) */
  function overdueCount(rows,now){
    if(!Array.isArray(rows))return null;
    return rows.filter(function(r){var t=Date.parse(r&&r.next_check_at||'');return r&&r.status!=='closed'&&r.status!=='verified'&&isFinite(t)&&t<now;}).length;
  }
  function create(opts){
    var host=opts.host,state={};
    if(!host)return {set:function(){},reset:function(){},render:function(){}};
    function render(){
      host.innerHTML='<div class="admin-today-head"><div><span>OPERATIONS</span><h1>오늘 확인할 일</h1><p>숫자가 있는 칸부터 누르면 그 화면으로 갑니다. «확인 못 함»은 0건이 아닙니다.</p></div>'
        +'<button type="button" class="hbtn" data-today-reload>운영 상태 새로고침</button></div>'
        +'<div class="admin-today-row" role="list">'+tiles(state).map(function(t){
          return '<button type="button" role="listitem" class="admin-today-tile '+t.tone+'" data-today-go="'+esc(t.go)+'" data-today-key="'+esc(t.key)+'">'
            +'<span class="admin-today-label">'+esc(t.label)+'</span><b>'+esc(t.value)+'</b><small>'+esc(t.note)+'</small></button>';
        }).join('')+'</div>';
      host.querySelectorAll('[data-today-go]').forEach(function(b){b.onclick=function(){opts.go(b.dataset.todayGo);};});
      var r=host.querySelector('[data-today-reload]');if(r)r.onclick=function(){opts.reload();};
    }
    function set(key,value){state[key]=value;render();}
    function reset(keys){(keys||Object.keys(state)).forEach(function(k){delete state[k];});render();}
    render();
    return {set:set,reset:reset,render:render,state:function(){return state;}};
  }
  return {create:create,tiles:tiles,overdueCount:overdueCount};
});
