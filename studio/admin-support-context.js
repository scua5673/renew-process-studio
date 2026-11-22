/* 관리자 «오류 제보» 옆 칸 — 제보 한 건의 사정(ps_support_context) · 목록 꼬리표(ps_support_list_flags).
   목업: 문서 저장소 UI-관리자-제보-한건에서-끝까지-목업-2026-11-22.html A안 «옆 칸».
   이 모듈은 받은 값을 확인하고 글자로 바꾸기만 한다(요청 · 상태는 admin-support.js). 받는 값은 시각 · 이벤트 이름 · 화면 · 기기 종류 ·
   판 번호 · 오류 이름 · 횟수뿐이다. 모양이 다른 값은 버리고, 못 받은 값은 0 으로 세지 않는다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminSupportContext=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var VERSION=/^\d{1,2}\.\d{3}$/,ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var DEVICE={desktop:'컴퓨터',tablet:'태블릿',mobile:'폰',unknown:'기기 미확인'};
  var FEATURE={app:'앱',board:'작전판',team:'팀',scout:'팀 운영',schedule:'일정',process:'일정',idp:'IDP',note:'노트',learn:'학습',learning:'학습',community:'커뮤니티',auth:'로그인',sync:'동기화',design:'보관함',profile:'프로필'};
  var EVENT={feature_opened:'화면 열기',content_saved:'저장',board_saved:'보드 저장',idp_saved:'IDP 저장',network_offline:'오프라인 전환',network_restored:'연결 복구',
    sync_failed:'동기화 실패',sync_stalled:'동기화 멈춤',storage_full:'저장공간 가득',boot_after_crash:'비정상 종료 뒤 다시 열림',app_error:'앱 오류',
    update_deferred:'새 판 적용 미룸',update_forced:'새 판 적용',update_sw_failed:'새 판 받기 실패',update_install_failed:'새 판 설치 실패',update_applied:'새 판 적용 완료',
    window_elsewhere:'다른 창에서 이어 씀',workspace_switch_failed:'팀 전환 실패',login:'로그인',logout:'로그아웃'};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function str(v,n){return typeof v==='string'?v.slice(0,n):'';}
  function iso(v){return typeof v==='string'&&ISO.test(v)&&isFinite(Date.parse(v))?v:'';}
  function count(v){return Number.isInteger(v)&&v>=0?v:null;}
  function ver(v){return typeof v==='string'&&VERSION.test(v)?v:'';}
  function two(n){return (n<10?'0':'')+n;}
  function clock(v){var d=new Date(v);return two(d.getHours())+':'+two(d.getMinutes());}
  function day(v){var d=new Date(v);return (d.getMonth()+1)+'/'+d.getDate();}
  function sameDay(a,b){var x=new Date(a),y=new Date(b);return x.getFullYear()===y.getFullYear()&&x.getMonth()===y.getMonth()&&x.getDate()===y.getDate();}
  function when(v,ref){return (ref&&sameDay(v,ref)?'':day(v)+' ')+clock(v);}

  /* 서버 답을 화면이 쓰는 모양으로. 뼈대(report_at · events 배열)가 아니면 null — 옆 칸은 «확인하지 못했습니다». */
  function clean(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||!iso(raw.report_at)||!Array.isArray(raw.events))return null;
    var out={at:raw.report_at,minutes:Number.isInteger(raw.minutes)&&raw.minutes>0?raw.minutes:30,events:[],errors:[],sync:null,fixed:null};
    raw.events.slice(0,120).forEach(function(e){
      if(!e||typeof e!=='object'||!iso(e.at)||typeof e.event_name!=='string'||!e.event_name)return;
      out.events.push({at:e.at,name:str(e.event_name,60),feature:str(e.feature,40),device:str(e.device,20)||'unknown',version:str(e.app_version,24),code:str(e.error_code,160),error:e.status==='error'});
    });
    out.events.sort(function(a,b){return Date.parse(a.at)-Date.parse(b.at);});
    (Array.isArray(raw.errors)?raw.errors:[]).slice(0,3).forEach(function(e){
      if(!e||typeof e!=='object'||typeof e.code!=='string'||!e.code||count(e.users)==null||count(e.count)==null)return;
      out.errors.push({code:str(e.code,160),mine:count(e.mine)||0,users:e.users,count:e.count,min:ver(e.min_version),max:ver(e.max_version)});
    });
    var s=raw.sync;
    if(s&&typeof s==='object'&&iso(s.received_at))out.sync={at:s.received_at,device:str(s.device,20)||'unknown',version:str(s.app_version,24),
      team:count(s.pending_team),personal:count(s.pending_personal),held:count(s.held),conflicts:count(s.conflicts),oldest:iso(s.oldest_pending_at)};
    var f=raw.fixed;
    if(f&&typeof f==='object'&&ver(f.version)){
      out.fixed={version:f.version,devices:[],after:null};
      (Array.isArray(f.devices)?f.devices:[]).slice(0,8).forEach(function(d){
        if(!d||typeof d!=='object'||typeof d.device!=='string')return;
        out.fixed.devices.push({device:str(d.device,20)||'unknown',got:iso(d.received_at),top:ver(d.latest_version),last:iso(d.last_at)});
      });
      var a=f.after;
      if(a&&typeof a==='object'&&count(a.mine)!=null&&count(a.users)!=null&&count(a.count)!=null)out.fixed.after={mine:a.mine,users:a.users,count:a.count};
    }
    return out;
  }

  function eventText(e){
    var f=FEATURE[e.feature]||e.feature||'';
    if(e.error)return {label:e.code||EVENT[e.name]||e.name,sub:[EVENT[e.name]||e.name,f].filter(Boolean).join(' · ')};
    if(e.name==='feature_opened')return {label:(f||'화면')+' 열기',sub:''};
    if(e.name==='content_saved')return {label:(f?f+' ':'')+'저장',sub:''};
    return {label:EVENT[e.name]||e.name,sub:f};
  }
  /* 시간순 줄. 바로 이어진 같은 이벤트는 한 줄(×n), 제보 시각 자리에 «제보 접수» 한 줄. 기기 · 판은 바뀔 때만 적는다. */
  function timeline(ctx){
    var rows=[],at=Date.parse(ctx.at),placed=false,last=null,seen='';
    function report(){rows.push({kind:'rep',at:ctx.at,label:'제보 접수',sub:'',n:1});placed=true;last=null;}
    ctx.events.forEach(function(e){
      if(!placed&&Date.parse(e.at)>at)report();
      var t=eventText(e),key=[e.name,e.feature,e.code,e.device,e.version].join('|');
      if(last&&last.key===key){last.n++;last.until=e.at;return;}
      var on=(DEVICE[e.device]||e.device)+(e.version?' · '+e.version:''),sub=t.sub;
      if(on!==seen){sub=[sub,on].filter(Boolean).join(' · ');seen=on;}
      last={kind:e.error?'err':e.name==='content_saved'||e.name==='update_applied'||e.name==='network_restored'?'ok':'ev',at:e.at,label:t.label,sub:sub,n:1,key:key};rows.push(last);
    });
    if(!placed)report();
    return rows;
  }
  function timelineHtml(ctx){
    var rows=timeline(ctx);
    if(rows.length===1)return '<p class="admCtxNone">앞뒤 '+ctx.minutes+'분 동안 남은 기록이 없습니다.</p>';
    return '<ol class="admCtxTl">'+rows.map(function(r){
      return '<li class="is-'+r.kind+'"><time>'+esc(when(r.at,ctx.at))+'</time><i aria-hidden="true"></i><span><b>'+esc(r.label)+(r.n>1?' ×'+r.n:'')+'</b>'+(r.sub?'<small>'+esc(r.sub)+'</small>':'')+'</span></li>';
    }).join('')+'</ol>';
  }
  function syncHtml(s,ref){
    if(!s)return '<p class="admCtxLine"><span>저장</span><em>기기 보고 없음</em></p>';
    if(s.team==null||s.personal==null)return '<p class="admCtxLine"><span>저장</span><em>대기 수 확인 못 함 · 보고 '+esc(when(s.at,ref))+'</em></p>';
    var pending=s.team+s.personal,extra=[];
    if(s.held)extra.push('보류 '+s.held);if(s.conflicts)extra.push('충돌 '+s.conflicts);
    return '<p class="admCtxLine"><span>저장</span><b class="'+(pending||extra.length?'is-warn':'is-good')+'">대기 '+pending+(extra.length?' · '+esc(extra.join(' · ')):'')+'</b><em>보고 '+esc(when(s.at,ref))+' · '+esc(DEVICE[s.device]||s.device)+(s.version?' '+esc(s.version):'')+'</em></p>';
  }
  function errorsHtml(ctx){
    if(!ctx.errors.length)return '<p class="admCtxNone">제보 직전 오류 기록이 없습니다.</p>';
    return ctx.errors.map(function(e){
      var range=e.min&&e.max?(e.min===e.max?'판 '+e.min:'판 '+e.min+' ~ '+e.max):'';
      return '<div class="admCtxErr"><code>'+esc(e.code)+'</code><p>이 제보 직전 <b>'+e.mine+'건</b> · 전체 <b>'+e.users+'명 '+e.count+'건</b>'+(range?' · '+esc(range):'')+'</p></div>';
    }).join('');
  }
  function fixedHtml(ctx){
    var f=ctx.fixed,h='';
    if(!f.devices.length)h+='<p class="admCtxNone">제보 뒤 기기 기록이 없어 받았는지 확인하지 못했습니다.</p>';
    h+=f.devices.map(function(d){
      return '<p class="admCtxLine"><span>'+esc(DEVICE[d.device]||d.device)+'</span>'+(d.got?'<b class="is-good">받음 · '+esc(when(d.got))+'</b>':'<b class="is-warn">아직 '+esc(d.top||'판 미확인')+'</b>')
        +(d.got&&d.top&&d.top!==f.version?'<em>지금 '+esc(d.top)+'</em>':'')+'</p>';
    }).join('');
    if(!ctx.errors.length)h+='<p class="admCtxNone">제보 직전 오류가 없어 견줄 오류가 없습니다.</p>';
    else if(!f.after)h+='<p class="admCtxNone">고친 뒤 같은 오류 수를 확인하지 못했습니다.</p>';
    else h+='<p class="admCtxLine"><span>같은 오류</span><b class="'+(f.after.mine?'is-warn':'is-good')+'">이 사람 '+f.after.mine+'건</b><em>'+esc(f.version)+' 이상 전체 '+f.after.users+'명 '+f.after.count+'건</em></p>';
    return h;
  }
  /* 옆 칸 전체. ctx: undefined 아직 · null 함수 없음(숨김) · 'error' 못 받음 · 객체. */
  function rail(p){
    var h='<aside class="admSupportRail" aria-label="이 제보의 사정">';
    if(p.who)h+='<section class="admCtxBox"><h3>보낸 사람'+(p.canUser?'<button type="button" data-adm-support="user"'+(p.busy?' disabled':'')+'>사용자 상세</button>':'')+'</h3><p class="admCtxWho">'+esc(p.who)+'</p></section>';
    var ctx=p.ctx,ok=ctx&&typeof ctx==='object';
    if(p.devices||ok)h+='<section class="admCtxBox"><h3>기기 · 판</h3>'+(p.devices||'')+(ok?syncHtml(ctx.sync,ctx.at):'')+'</section>';
    if(ctx===undefined)h+='<section class="admCtxBox"><h3>제보 앞뒤 기록</h3><p class="admCtxNone" role="status">불러오는 중…</p></section>';
    else if(ctx==='error')h+='<section class="admCtxBox"><h3>제보 앞뒤 기록</h3><p class="admCtxNone" role="status">앞뒤 기록을 확인하지 못했습니다.</p><button type="button" data-adm-support="context"'+(p.busy?' disabled':'')+'>다시 불러오기</button></section>';
    else if(ok){
      h+='<section class="admCtxBox"><h3>제보 앞뒤 '+ctx.minutes+'분</h3>'+timelineHtml(ctx)+'</section>';
      if(ctx.fixed)h+='<section class="admCtxBox"><h3>고친 판 '+esc(ctx.fixed.version)+'</h3>'+fixedHtml(ctx)+'</section>';
      h+='<section class="admCtxBox"><h3>같은 오류 · 제보 앞 7일</h3>'+errorsHtml(ctx)+'</section>';
    }
    return h+'</aside>';
  }

  /* 목록 꼬리표: 서버 답 {id:{version,seen_version,fixed_seen}} → Map 에 넣을 값. */
  function flags(raw){
    var out={};
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
    Object.keys(raw).slice(0,40).forEach(function(id){
      var f=raw[id];if(!UUID.test(id)||!f||typeof f!=='object')return;
      out[id.toLowerCase()]={version:ver(f.version),seen:ver(f.seen_version),fixed:f.fixed_seen===true?true:f.fixed_seen===false?false:null};
    });
    return out;
  }
  function tags(row,flag){
    if(!row||!flag)return '';
    var list=[];
    if(row.fixed_in&&flag.fixed===true)list.push(['is-good','고친 판 받음']);
    else if(row.fixed_in&&flag.fixed===false)list.push(['is-wait','아직 '+(flag.seen||'옛 판')]);
    else if(row.stage==='needs'&&flag.version)list.push(['','제보 때 '+flag.version]);
    return list.length?'<small class="admCtxTags">'+list.map(function(t){return '<i class="'+t[0]+'">'+esc(t[1])+'</i>';}).join('')+'</small>':'';
  }
  return {clean:clean,timeline:timeline,rail:rail,flags:flags,tags:tags};
});
