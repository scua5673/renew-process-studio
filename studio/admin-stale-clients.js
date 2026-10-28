/* 3.198 — 운영 홈 «옛 판으로 도는 기기»(ps_admin_stale_clients, migrations/20261028_admin_client_versions.sql).
   최근 48시간 안에 가장 새 판보다 20판 넘게 뒤진 판으로 이벤트를 남긴 기기를 사람 × 기기 × 판으로 보인다.
   제보 381d132d 의 아이패드가 3.131 에 일주일 머문 것을 제보 뒤에야 알았다 — 제보 전에 먼저 보려고 만들었다.
   값은 판 번호 · 기기 종류 · 횟수뿐이며, 사람 이름 · 이메일은 ps_support_reporter 가 관리자에게만 준다(여기서 이스케이프). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminStaleClients=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,VER=/^\d{1,2}\.\d{3}$/;
  var DEVICE={desktop:'컴퓨터',tablet:'태블릿',mobile:'폰',unknown:'기기 미확인'};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function count(v){return Number.isInteger(v)&&v>=0?v:0;}
  function ago(iso,now){
    var t=Date.parse(String(iso||''));if(!isFinite(t))return '시각 미확인';
    var m=Math.round((now-t)/60000);if(m<1)return '방금';if(m<60)return m+'분 전';var h=Math.round(m/60);if(h<48)return h+'시간 전';return Math.round(h/24)+'일 전';
  }
  function who(w){
    if(!w||typeof w!=='object')return '이름 없음';
    var name=typeof w.name==='string'&&w.name.trim()?w.name.trim():(typeof w.email==='string'&&w.email?w.email.split('@')[0]:'이름 없음');
    var teams=Array.isArray(w.teams)?w.teams.map(function(t){return t&&typeof t.name==='string'?t.name:'';}).filter(Boolean):[];
    return teams.length?name+' · '+teams[0]+(teams.length>1?' 외 '+(teams.length-1):''):name;
  }
  /* 서버 답이 기대한 모양이 아니면 null — 화면은 «확인 못 함»으로 남긴다(0건으로 세지 않는다) */
  function validate(r){
    if(!r||typeof r!=='object'||!Array.isArray(r.clients))return null;
    if(r.latest!=null&&!VER.test(String(r.latest)))return null;
    var ok=r.clients.every(function(c){return c&&typeof c==='object'&&UUID.test(String(c.user_id||''))&&VER.test(String(c.app_version||''))&&typeof c.device==='string'&&typeof c.last_at==='string';});
    return ok?{hours:count(r.hours)||48,behind:count(r.behind)||20,latest:r.latest==null?'':String(r.latest),clients:r.clients}:null;
  }
  function html(r,now){
    if(!r)return '<div class="empty">옛 판 기기 현황을 확인하지 못했습니다.</div>';
    var head='<div class="adm-stale-note">최근 '+r.hours+'시간 · 최신 판 '+(r.latest?esc(r.latest):'—')+' 보다 '+r.behind+'판 넘게 뒤진 기기</div>';
    if(!r.clients.length)return head+'<div class="adm-stale-empty">없음 — 모든 기기가 최신 판 근처입니다.</div>';
    function row(c){
      var dev=DEVICE[c.device]||esc(c.device),moved=c.newer_seen===true,crash=count(c.crashes),full=count(c.storage_full);
      return '<tr class="'+(moved?'adm-stale-moved':'adm-stale-old')+'">'
        +'<td><button type="button" class="adm-stale-user" data-stale-user="'+esc(c.user_id)+'">'+esc(who(c.who))+'</button></td>'
        +'<td>'+dev+'</td><td><b>'+esc(c.app_version)+'</b></td><td>'+esc(ago(c.last_at,now))+'</td><td>'+count(c.events)+'</td>'
        +'<td>'+(crash?'<b class="adm-stale-bad">'+crash+'</b>':'0')+'</td><td>'+(full?'<b class="adm-stale-bad">'+full+'</b>':'0')+'</td>'
        +'<td>'+(moved?'<span class="adm-stale-tag ok">그 뒤 새 판 확인</span>':'<span class="adm-stale-tag warn">아직 옛 판</span>')+'</td></tr>';
    }
    function table(list){return '<div class="tablewrap"><table><thead><tr><th>사람</th><th>기기</th><th>앱 판</th><th>마지막</th><th>이벤트</th><th>비정상 종료</th><th>저장공간 가득</th><th>상태</th></tr></thead><tbody>'+list.map(row).join('')+'</tbody></table></div>';}
    var still=r.clients.filter(function(c){return c.newer_seen!==true;}),moved=r.clients.filter(function(c){return c.newer_seen===true;});
    /* 아직 옛 판인 기기가 본문 — 그 뒤 새 판으로도 접속한 기기는 접어 둔다(이미 올라왔으니 연락할 일이 아니다) */
    return head+(still.length?table(still):'<div class="adm-stale-empty">아직 옛 판에 머문 기기 없음</div>')
      +(moved.length?'<details class="adm-stale-moved-box"><summary>그 뒤 새 판으로 올라온 기기 '+moved.length+'</summary>'+table(moved)+'</details>':'');
  }
  /* opts: {host, rpc(name,args)→Promise, openUser(uid), now()→ms, missing(fn)→html} */
  function create(opts){
    var host=opts.host,ticket=0;
    function load(){
      if(!host)return Promise.resolve();
      var t=++ticket;host.innerHTML='<div class="loading">불러오는 중…</div>';
      return Promise.resolve().then(function(){return opts.rpc('ps_admin_stale_clients',{p_hours:48,p_behind:20});}).then(function(r){
        if(t!==ticket)return;
        var v=validate(r);host.innerHTML=html(v,typeof opts.now==='function'?opts.now():Date.now());
        if(v&&typeof opts.openUser==='function')Array.prototype.forEach.call(host.querySelectorAll('[data-stale-user]'),function(b){b.onclick=function(){opts.openUser(b.getAttribute('data-stale-user'));};});
      }).catch(function(){if(t!==ticket)return;host.innerHTML='<div class="empty">옛 판 기기 현황을 불러오지 못했습니다.'+(typeof opts.missing==='function'?'<br>'+opts.missing('ps_admin_stale_clients'):'')+'</div>';});
    }
    return {load:load};
  }
  return {create:create,html:html,validate:validate,ago:ago,who:who};
});
