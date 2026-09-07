/* PROCESS STUDIO — 팀 권한 (UI 제한 · 소프트)
   저장: cs_perms_v1 (동기화 대상). 관리자만 수정, 전원이 읽어 편집 가능 범위를 판정.
   판정은 전부 localStorage에서 파생 → 셸·각 탭(iframe) 어디서나 동일하게 동작.
   ※ 신뢰 기반: 개발자도구 우회는 막지 못함(진짜 차단은 서버 RLS 단계에서). */
(function(){
  var LS='cs_perms_v1', SKEY='ps_sync_session', WL='ps_ws_list', WA='ps_active_ws';
  var SECTIONS=[
    {id:'board',    label:'작전판·보관함'},
    {id:'schedule', label:'일정'},
    {id:'team',     label:'팀'},
    {id:'scout',    label:'스카우트'},
    {id:'gamemodel',label:'게임모델'},
    {id:'terms',    label:'공용어'}
    /* 1.547 — '노트'를 뺐다. 노트(cs_notes_v1·cs_note_papers_v1)는 sync.js 의 PERSONAL 키라
       팀에 올라가지 않는다 — 각자 개인 공간에만 백업되고 다른 팀원은 볼 수도, 받을 수도 없다.
       그래서 이 체크는 '남이 자기 개인 수첩에 글을 쓸 수 있는가'를 정하는 셈이라
       팀 권한이라는 개념에 맞지 않았다. note.html 의 gate('note') 도 함께 제거했다. */
  ];
  var ROLES=[
    {id:'executive', label:'임원'},
    {id:'staff', label:'코칭스태프'},
    {id:'player',label:'선수'}
  ];
  function j(k,fb){ try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?fb:v; }catch(_){ return fb; } }
  function sess(){ return j(SKEY,null); }
  function activeWs(){ try{ return localStorage.getItem(WA)||''; }catch(_){ return ''; } }
  function myWs(){ var id=activeWs(); return (j(WL,[])||[]).filter(function(w){ return w.id===id; })[0]||null; }
  function perms(){ return j(LS,null); }
  function allIds(){ return SECTIONS.map(function(x){ return x.id; }); }
  function staffIds(){ return allIds().filter(function(id){ return id!=='scout'; }); }
  function isExecutive(role){ return role==='executive'||role==='admin'; }

  /* 내 유효 역할 — 무세션은 항상 편집 불가. 로그인한 개인 공간만 제한 없이 편집한다. */
  /* 1.831 — 게스트 개방(사용자 확정): 로그인 흔적(ps_cache_owner_v1)이 없는 기기의 비로그인 사용자는
     개인 공간을 로컬로 자유롭게 쓴다(admin). 다른 계정 잔재가 있는 기기(로그아웃 상태)는 지금처럼 잠근다.
     잠금의 목적은 '이전 계정 자료 격리'였지 '로그인 강제'가 아니었다(sync.js 338행). 되돌리기: 아래 두 줄 삭제. */
  function guestOpen(){ try{ if(localStorage.getItem('ps_cache_owner_v1')) return false; if(activeWs()) return false; return true; }catch(_){ return false; } }
  function myRole(){
    var s=sess(); if(!s||!s.uid) return guestOpen()?'admin':'player';
    var w=myWs(); if(!w||w.kind==='personal') return 'admin';
    if(w.role==='owner') return 'executive';
    /* 1.619 — 팀 공간인데 권한표를 못 읽으면 예전엔 'admin'(제한 없음)이었다.
       그래서 권한 문서가 아직 안 온 기기가 팀 자료를 마음대로 고칠 수 있었고,
       실제로 선수 2명이 권한 문서 자체를 덮었다(2026-08-05).
       개인 공간은 위에서 이미 'admin' 으로 빠져나가므로, 혼자 쓰는 사람은 영향이 없다. */
    var p=perms(); if(!p) return 'player';
    var me=p.members&&p.members[s.uid];
    return (me&&me.role)||p.defaultRole||'player';
  }
  /* ══ 1.634 · 팀 자료는 임원만 편집한다 (사용자 확정) ═══════════════════════
     쓰려는 모양: **임원이 전부 입력하고, 코칭스태프는 본다.** 다른 게 보이면 말이나
     메신저로 임원에게 말하고 임원이 고친다 — 수정 요청을 앱 안에서 주고받지 않는다.
     그래서 '제안·댓글·승인' 같은 건 만들지 않는다(사용자 확정).

     기본값을 닫힌 쪽으로 둔다: staffEdit 이 'edit' 일 때만 코칭스태프가 편집한다.
     일정(process_coach_v1)이 1.500 에서 같은 길을 갔고 그게 옳았다.

     ⚠ 개별 지정(me.scopes)은 이 잠금보다 **앞선다.** 임원이 "이 코치에게는 선수단만"
       하고 직접 체크한 것이라, 팀 전체 스위치가 그걸 덮으면 열어 준 사람이 왜 안 되는지
       못 찾는다. 잠금은 '기본값'이지 '천장'이 아니다. */
  function staffEditOpen(p){ return !!(p&&p.staffEdit==='edit'); }
  /* 내가 편집 가능한 구역 id 목록 */
  function myScopes(){
    var role=myRole();
    if(isExecutive(role)) return allIds();
    var s=sess(), p=perms()||{};
    var me=(s&&p.members&&p.members[s.uid])||null;
    if(me&&me.scopes) return me.scopes.slice();   /* 개별 지정이 먼저 */
    if(role==='staff') return staffEditOpen(p)?staffIds():[];
    return [];                            /* 선수 기본: 없음 */
  }
  function canEdit(section){
    if(isExecutive(myRole())) return true;
    return myScopes().indexOf(section)>=0;
  }
  /* 특정 멤버(uid)의 유효 역할·범위 — 관리 UI에서 사용 */
  function memberRole(uid){ var p=perms()||{}; var me=p.members&&p.members[uid]; return (me&&me.role)||p.defaultRole||'player'; }
  function memberScopes(uid){
    var p=perms()||{}, me=p.members&&p.members[uid];
    var role=(me&&me.role)||p.defaultRole||'player';
    if(isExecutive(role)) return allIds();
    if(me&&me.scopes) return me.scopes.slice();
    if(role==='staff') return staffEditOpen(p)?staffIds():[];   /* 1.634 — myScopes 와 같은 규칙 */
    return [];
  }

  function label(id){ for(var i=0;i<SECTIONS.length;i++)if(SECTIONS[i].id===id)return SECTIONS[i].label; return id; }

  /* 동기화되는 공유 콘텐츠 키(=팀에 전파되는 데이터). sync.js의 KEYS와 동일 + 보관함·무덤돌.
     읽기전용 탭에서는 이 키들에 대한 쓰기를 차단 → 편집해도 저장·동기화되지 않음(기기별 view 프리셋은 허용). */
  var SYNCED=['cs_vault_folders_v1','cs_vault_folder_tags_v1','cs_vault_folder_meta_v1',
    'process_coach_v1','cs_themes_v1','cs_team_v1','cs_squad_v1','scout_tool_v1','cs_gamemodel_v1',
    'training_sessions_v1','training_session_cur_v1','cs_psched_v1','cs_pmeet_v1','cs_pwarm_v1','cs_ptrain_v1',
    'cs_match_v1','cs_match_roster_v1','cs_meet_sit_v1','cs_team_matches_v1','cs_notes_v1','cs_note_papers_v1',
    'cs_terms_v1','cs_perms_v1','cs_idp_pub_v1','cs_team_attrs_v1','cs_idp_daily_v1','cs_drill_lib_v1',
    'cs_team_notice_v1',   /* 2.537 — 팀 공지 */
    'ps_tomb_v1'];
  function syncedKey(k){return SYNCED.indexOf(k)>=0||String(k||'').indexOf('cs_idp_pub_v1_')===0;}

  var _toastT=0;
  function toast(msg){
    try{
      var t=Date.now(); if(t-_toastT<1500)return; _toastT=t;
      var el=document.createElement('div');
      el.textContent=msg;
      var dark=document.body&&document.body.classList.contains('fmdark');
      el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;'
        +'background:'+(dark?'#E7EBF1':'#16181c')+';color:'+(dark?'#16181c':'#fff')+';'
        +'font:700 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:11px 16px;border-radius:20px;'
        +'box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transition:opacity .2s;pointer-events:none';
      document.body.appendChild(el);
      requestAnimationFrame(function(){ el.style.opacity='1'; });
      setTimeout(function(){ el.style.opacity='0'; setTimeout(function(){ try{el.remove();}catch(_){} },250); },1700);
    }catch(_){}
  }
  function banner(text){
    try{
      if(document.getElementById('psRoBanner'))return;
      var dark=document.body.classList.contains('fmdark');
      var b=document.createElement('div'); b.id='psRoBanner';
      b.style.cssText='flex:0 0 auto;order:-9999;position:relative;z-index:50;padding:9px 14px;'
        +'font:700 13px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;'
        +'background:'+(dark?'#2a2410':'#FFF6E5')+';color:'+(dark?'#E9C46A':'#8a6d1a')+';'
        +'border-bottom:1px solid '+(dark?'#4a3f18':'#F0DFB0')+';text-align:center';
      b.textContent='🔒 '+text;
      document.body.insertBefore(b,document.body.firstChild);
    }catch(_){}
  }
  /* 편집 컨트롤 숨김 — CSS 한 장이면 동적으로 생기는 버튼까지 자동 적용(옵저버 불필요) */
  function hideControls(sel){
    if(!sel) return;
    try{
      if(document.getElementById('psRoHide'))return;
      var st=document.createElement('style'); st.id='psRoHide';
      st.textContent=sel+'{display:none !important}';
      (document.head||document.documentElement).appendChild(st);
    }catch(_){}
  }
  /* 읽기전용 게이트 — 탭이 부팅 후 1회 호출. 권한 있으면 아무것도 안 함. */
  function gate(section, opts){
    opts=opts||{};
    if(canEdit(section)) return false;
    /* 1.671 — 원인별 문구 분기. 예전엔 로그아웃·세션 만료·권한표 미수신까지 전부
       '관리자에게 요청하세요'로 뭉개서, 만료된 코치가 존재하지 않는 관리자를 찾았다.
       해결책이 '다시 로그인'인 상태에 관리자를 안내하면 오진이다. */
    var _s=sess(), _lb=(opts.label||label(section)), _msg;
    if(!_s||!_s.uid){
      /* 1.695 — 가입 없이 작전판·커뮤니티를 열어 준다. 로그아웃 게스트에겐 '보기 전용' 경고 대신
         초대형 문구 — 지금 써볼 수 있고, 로그인하면 저장·팀 공유가 된다. */
      _msg='지금은 자유롭게 써볼 수 있어요 — 로그인하면 저장하고 팀과 공유할 수 있어요.';
    }else if(!perms()){
      _msg='팀 권한을 아직 확인하지 못해 보기 전용입니다 — 변경은 저장되지 않아요. 잠시 후 다시 열어 주세요.';
    }else{
      _msg=_lb+' 편집 권한이 없어 보기 전용입니다 — 변경은 저장되지 않아요. 관리자에게 요청하세요.';
    }
    banner(_msg);
    hideControls(opts.hide);
    /* 차단은 항상. 단 토스트는 '사용자 조작 직후'의 쓰기에만 —
       부팅 시딩·자동저장 타이머까지 알리면 가만히 있어도 토스트가 계속 뜬다. */
    var lastInput=0;
    ['pointerdown','keydown'].forEach(function(ev){
      /* isTrusted: 실제 사용자 입력만. 앱이 부팅 중 쏘는 합성 이벤트는 제외 */
      document.addEventListener(ev,function(e){ if(e&&e.isTrusted) lastInput=Date.now(); },true);
    });
    function notice(){ if(Date.now()-lastInput < 1200) toast('보기 전용 — 변경이 저장되지 않았어요'); }
    try{
      var ls=window.localStorage, _si=ls.setItem.bind(ls);
      ls.setItem=function(k,v){
        if(syncedKey(k)){ notice(); return; }
        return _si(k,v);
      };
    }catch(_){}
    /* IndexedDB 어댑터(window.storage)도 막는다 — 보관함·선수단·훈련세션이 IDB로 옮겨간 뒤
       localStorage 게이트만으로는 뚫려 있었다(보기 전용인데 팀 데이터 수정 가능).
       차단 시 resolve를 돌려주는 이유: 호출부가 전부 .then 체인이라 reject하면 곳곳에서 unhandled rejection이 난다. */
    function wrapIDB(){
      try{
        var st=window.storage; if(!st) return false; if(st.__psGated) return true;
        var _set=st.set.bind(st), _del=st.del?st.del.bind(st):null;
        st.set=function(k,v){ if(syncedKey(k)){ notice(); return Promise.resolve(); } return _set(k,v); };
        if(_del) st.del=function(k){ if(syncedKey(k)){ notice(); return Promise.resolve(); } return _del(k); };
        st.__psGated=true; return true;
      }catch(_){ return false; }
    }
    /* storage.js가 head에서 먼저 로드되므로 보통 즉시 성공 — 혹시 늦으면 잠깐 재시도 */
    if(!wrapIDB()){ var _n=0,_t=setInterval(function(){ if(wrapIDB()||++_n>50) clearInterval(_t); },100); }
    try{ document.body.classList.add('ps-viewonly'); }catch(_){}
    /* 1.845 — 부팅 1회 판정이라 로그인(ps_sync_session 저장)·권한표 도착 뒤에도 배너·setItem 차단이
       그대로 남았다(로그인했는데 '보기 전용'). 셸이 세션을 쓰면 iframe 에 storage 이벤트가 오므로
       거기서 다시 판정하고, 편집 가능해졌으면 이 탭을 새로 부팅한다(래퍼·배너·클래스를 하나씩 되돌리는 것보다 안전).
       같은 창에서 쓴 경우 storage 이벤트가 안 오니 2초 폴링을 보조로 둔다. */
    function regate(){ try{ if(canEdit(section)){ window.__psRegating=true; location.reload(); } }catch(_){} }
    try{ window.addEventListener('storage',function(e){ if(!e||!e.key||[SKEY,LS,WL,WA].indexOf(e.key)>=0) regate(); }); }catch(_){}
    try{ var _rg=setInterval(function(){ if(canEdit(section)){ clearInterval(_rg); regate(); } },2000); }catch(_){}
    return true;
  }

  window.PSPerms={
    SECTIONS:SECTIONS, ROLES:ROLES,
    role:myRole, scopes:myScopes, canEdit:canEdit, gate:gate,
    memberRole:memberRole, memberScopes:memberScopes,
    /* 1.634 — 권한 화면의 스위치가 읽고 쓴다. 판정 자체는 위 세 함수가 한다. */
    staffEditOpen:function(){ return staffEditOpen(perms()); },
    label:label,
    roleLabel:function(id){ for(var i=0;i<ROLES.length;i++)if(ROLES[i].id===id)return ROLES[i].label; return id; },
    get:perms,
    /* 1.619 — 권한 문서는 동기화가 IndexedDB 쪽을 읽어 올린다. localStorage 에만 쓰면
       바꾼 권한이 팀에 전달되지 않는다(1.589~1.617 이 그랬다). 두 곳에 같이 쓴다. */
    set:function(p){ try{
      var raw=JSON.stringify(p);
      if(window.psSaveShared)window.psSaveShared(LS,raw); else localStorage.setItem(LS,raw);
    }catch(_){} }
  };
})();
