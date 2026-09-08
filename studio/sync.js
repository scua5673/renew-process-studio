/* PROCESS STUDIO — 계정·클라우드 동기화
   Supabase(GoTrue/PostgREST) REST 직결 — 외부 SDK 없음(오프라인 PWA 원칙 유지).
   PS_SYNC 설정이 비어 있으면 완전 비활성: UI도, 네트워크 요청도 전혀 없음.
   구조: 로컬(localStorage)이 항상 원본. 로그인 시 화이트리스트 키를 서버 ps_kv 테이블과 양방향 동기화(키 단위 LWW).
   2.674 부터: 팀 자료의 기기 사본은 캐시 — 서버 값이 오면 덮고, 구조선·충돌 사본은 만들지 않는다(COPIES_OFF). */
(function(){
"use strict";
var CFG=null;
try{ if(window.PS_SYNC&&window.PS_SYNC.url&&window.PS_SYNC.anonKey) CFG=window.PS_SYNC; }catch(_){}
try{ if(!CFG){ var _raw=localStorage.getItem('ps_sync_cfg'); if(_raw){ var _o=JSON.parse(_raw); if(_o&&_o.url&&_o.anonKey) CFG=_o; } } }catch(_){}
/* cfg를 저장해 둔다 — 커뮤니티 등을 단독 URL로 열어도(셸 부모 없이) 서버 설정을 찾을 수 있게 (publishable key라 공개 무해) */
try{ if(CFG&&CFG.url&&CFG.anonKey) localStorage.setItem('ps_sync_cfg', JSON.stringify({url:CFG.url,anonKey:CFG.anonKey})); }catch(_){}
if(!CFG) return;
var BASE=String(CFG.url).replace(/\/+$/,'');
function syncDiagnostic(stage,error){
  var info={stage:String(stage||'sync').slice(0,48)};
  if(error){
    info.name=String(error.name||'Error').slice(0,48);
    info.code=String(error.psCode||error.code||'').slice(0,80);
  }
  /* 1.650 — 브라우저 로그 수집기가 객체 인수를 전부 "Object"로 접어 원인(stage/code)을
     지웠다. 내용·토큰은 넣지 않고 분류값만 문자열로 남겨 실기기 실패를 구별한다. */
  try{ console.warn('[PSSync] '+JSON.stringify(info)); }catch(_){}
  try{ window.dispatchEvent(new CustomEvent('ps-sync-diagnostic',{detail:info})); }catch(_){}
}

var SKEY='ps_sync_session', MKEY='ps_sync_meta', RLKEY='ps_sync_rl', SKIPKEY='ps_sync_skipped';
var OWNERKEY='ps_cache_owner_v1';
var dataReady=false,authPreparePromise=null;
var syncErr=false;   /* 마지막 동기화 실패 여부 — 상단 배지에 반영 */
var lastIssue=null;  /* 2.625 — 마지막 회차 실패 {code,stage,at}. 성공하면 비운다. 상태 한 줄(syncState)이 읽는다 */
var refreshPromise=null, refreshRetryTimer=null, refreshRetryDelay=15000;
/* 용량 초과로 동기화에서 빠진 키를 사용자에게 이름으로 알리기 위한 표 */
var KEY_LABEL={
  'cs_notes_v1':'노트','cs_note_papers_v1':'노트 용지','cs_gamemodel_v1':'게임모델','cs_terms_v1':'공용어',
  'cs_squad_v1':'선수단','scout_tool_v1':'스카우트','cs_team_v1':'팀','cs_perms_v1':'권한',
  'cs_team_matches_v1':'경기 준비·리뷰','cs_team_match_private_v1':'코치 경기 개인 메모','cs_team_notice_v1':'팀 공지',
  'cs_idp_daily_v1':'IDP 일일 상태',
  'training_sessions_v1':'훈련 세션','cs_match_v1':'경기','cs_match_roster_v1':'경기 명단','cs_meet_sit_v1':'미팅',
  'cs_psched_v1':'일정','cs_pmeet_v1':'미팅 계획','cs_pwarm_v1':'웜업','cs_ptrain_v1':'훈련',
  'process_coach_v1':'일정·주간 훈련','cs_themes_v1':'테마',
  'cs_analysis_workspaces_v1':'매치데스크','cs_analysis_team_library_v1':'매치데스크 팀 자료',
  /* 1.526 — 이름이 없어 화면에 날것 키(cs_vault_folders_v1 …)가 그대로 찍히던 것들 */
  'cs_vault_folders_v1':'보관함 폴더','cs_vault_folder_tags_v1':'보관함 폴더 태그','cs_vault_folder_meta_v1':'보관함 폴더 정보',
  'cs_coach_img_v1':'지도자 이미지노트','cs_team_attrs_v1':'평가 항목','cs_drill_lib_v1':'보관함',
  'cs_analysis_role_v1':'매치데스크 역할','cs_analysis_depth_v1':'매치데스크 관찰 깊이',
  'cs_match_del_v1':'삭제한 경기','cs_player_del_v1':'삭제한 선수','ps_tomb_v1':'삭제 기록',
  /* 1.573 — 1.540에서 후보를 별도 키로 가르면서 이름을 안 넣어, 하필 8월 5일에 날아간 바로 그 자료가
     되돌리기 창에 'cs_scout_targets_v1' 이라는 날것 키로 찍히고 있었다. */
  'cs_scout_targets_v1':'스카우팅 후보',
  'cs_assign_v1':'경기 담당'
};
function keyLabel(k){
  if(k&&k.indexOf('cs_idp_pub_v1_')===0)return '코치 피드백';
  if(k&&k.indexOf('cs_idp_v1_')===0)return 'IDP';
  /* 1.631 — 항목 키(sq:<선수id>)를 날것으로 보여주면 사용자는 그게 자기 자료인 줄 모른다.
     1.573 에서 cs_scout_targets_v1 이 라벨 없이 되돌리기 창에 찍혔던 것과 같은 실수를 막는다. */
  if(k&&k.indexOf('sq:')===0)return '선수 한 명';
  return KEY_LABEL[k]||k;
}
function skippedList(){ try{ return JSON.parse(localStorage.getItem(SKIPKEY)||'[]')||[]; }catch(_){ return []; } }
/* ── 동기화 충돌 ──
   양쪽이 같은 자료를 고치면 내 것을 밀어 넣고 서버 것을 ps_sync_conflict_<키>에 남긴다.
   그동안 그 사본을 읽는 코드가 없어서, 다른 코치의 작업이 조용히 사라졌다.
   이제 무엇이 밀렸는지 기록하고 사용자가 되돌릴 수 있게 한다. */
var CONFKEY='ps_sync_conflicts_v1';
/* 2.674 — «기기는 캐시일 뿐»(사용자 "기기 것을 최대한 저장 안 하기" 1단계). 서버 값을 받으면 그냥 덮고, 구조선(ps_rescue_*)·충돌 사본(ps_sync_conflict_*)을
   더는 만들지 않는다. 실측: 사용자 맥북에 충돌 사본 44개·구조선 39개(약 1MB)가 쌓였고, 정상 갱신(45→53명)까지 «확인할 것»으로 묻고 있었다.
   남기는 것: 지금 값 한 벌 + 못 올린 편집 + 급감 24h 되돌리기(undoStash, 2.626) + 일정·선수단 3-way 병합의 기준본(syncBase). 켜고 끄기는 이 스위치 하나. */
var COPIES_OFF=true;
/* 2.675 — 2단계 «열 때 서버부터, 닫으면 지우기»(사용자 "2단계도 이어서 가자").
   닫을 때(pagehide, bfcache 진입은 제외): 팀 자료 키 중 서버와 같은 것(dirty 아님)만 기기에서 지운다. 못 올린 편집이 하나라도 있으면(outbox) 통째로 건너뛴다.
   보드·보관함 키(BOARD_KEEP)와 개인 키(PERSONAL)는 건드리지 않는다. 지웠으면 표시(ps_cache_wiped_v1)를 남기고,
   다음 부팅에서 그 표시가 있으면 «팀에서 받는 중…» 덮개를 띄워 첫 회차가 끝날 때까지 기기 사본 대신 서버를 기다린다(최대 12초, 오프라인이면 안내+다시 시도).
   받고 나면 한 번 새로고침한다 — 셸(app.html)은 같은 창이라 storage 이벤트를 못 받기 때문. */
/* 2.676 — 실측(9/7 14:23~14:29, 코치 아이패드 2.675): 팀 전환 → 리로드 → 부팅 리로드(1.981) → 그때마다 pagehide 지우기 → «받는 중» 덮개 → 성공 시 또 리로드.
   리로드가 겹치며 진행 중 fetch 가 끊겨 sync_network(kv_meta) 2건, 스플래시가 몇 분 이어졌다(«자기 팀으로 이동이 안 된다»).
   고침: ① 우리가 스스로 하는 리로드(ps_self_reload 표시)·부팅 중(ps-booting)·연 지 15초 안에는 지우지 않는다 ② 받은 뒤 리로드하지 않는다(화면은 storage 이벤트로 갱신)
   ③ 기본은 꺼 둔다 — 실기기 로그인 검증 뒤 켠다(`localStorage.ps_cache_wipe='1'` 로 기기별 켜기). */
var CACHE_WIPE=(function(){ try{ return localStorage.getItem('ps_cache_wipe')==='1'; }catch(_){ return false; } })();
var CACHE_WAIT_MS=12000, CACHE_FLAG='ps_cache_wiped_v1', SELF_RELOAD='ps_self_reload', BOOT_AT=Date.now(), cacheWaitTimer=null;
function markSelfReload(){ try{ sessionStorage.setItem(SELF_RELOAD,'1'); }catch(_){} }
function wipeAllowedNow(){
  try{ if(sessionStorage.getItem(SELF_RELOAD))return false; }catch(_){}
  try{ if(document.body&&document.body.classList.contains('ps-booting'))return false; }catch(_){}
  return (Date.now()-BOOT_AT)>15000;
}
var BOARD_KEEP={'cs_vault_folders_v1':1,'cs_vault_folder_tags_v1':1,'cs_vault_folder_meta_v1':1,'cs_themes_v1':1};
function teamCacheKeys(){
  var out=KEYS.filter(function(k){ return !PERSONAL[k]&&!BOARD_KEEP[k]; });
  try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&(k.indexOf('cs_idp_v1_')===0||k.indexOf('cs_idp_pub_v1_')===0)&&k!=='cs_idp_v1_local')out.push(k); } }catch(_){}
  return out;
}
function wipeTeamCacheSoft(){
  if(!CACHE_WIPE||!dataUnlocked()||!getSess()||!wipeAllowedNow())return 0;
  var wid=activeWs(); if(!wid)return 0;
  try{ if(pendingInfo(wid).count>0)return 0; }catch(_){ return 0; }
  var m=meta(), n=0;
  teamCacheKeys().forEach(function(k){
    var loc=null; try{ loc=localStorage.getItem(k); }catch(_){}
    if(loc==null)return;
    if(hash(loc)!==(m.h[k]||''))return;                       /* 아직 안 올린 편집 — 남긴다 */
    try{ localStorage.removeItem(k); n++; }catch(_){ return; }
    try{ if(idbBacked(k)&&window.storage&&window.storage.del)window.storage.del(k); }catch(_){}
    try{ syncBaseSet(k,null); }catch(_){}
  });
  if(n){ try{ localStorage.setItem(CACHE_FLAG,String(Date.now())); }catch(_){} }
  return n;
}
function cacheWipedFlag(){ try{ return !!localStorage.getItem(CACHE_FLAG); }catch(_){ return false; } }
function renderCacheWait(mode){
  try{
    var host=document.querySelector('.frames'), ov=document.getElementById('psCacheWait');
    if(!mode){ if(ov)ov.remove(); return; }
    if(!host)return;
    if(!ov){ ov=document.createElement('div'); ov.id='psCacheWait'; ov.setAttribute('aria-live','polite');
      ov.style.cssText='position:absolute;inset:0;z-index:99996;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg,#f5f6f8);color:var(--txt,#16181c);font-family:inherit';
      host.appendChild(ov); }
    var box='width:min(360px,100%);text-align:center;background:var(--bar,#fff);border:1px solid var(--line,#e2e4e8);border-radius:16px;padding:24px 20px;font-size:14px;line-height:1.6';
    if(mode==='offline'){
      ov.innerHTML='<div style="'+box+'"><b>오프라인이에요</b><br><span style="color:var(--gray,#646a73)">팀 자료는 인터넷이 연결되면 나타나요</span><br><button data-ps-cw-retry style="margin-top:12px;padding:8px 16px;border-radius:999px;border:1px solid var(--line,#e2e4e8);background:var(--bar,#fff);color:inherit;font:inherit">다시 시도</button></div>';
      var rb=ov.querySelector('[data-ps-cw-retry]'); if(rb)rb.onclick=function(){ rb.disabled=true; rb.textContent='받는 중…'; renderCacheWait('wait'); syncNow('cache-retry').then(function(r){ if(r&&(r.offline||r.error||r.noauth))cacheWaitEnd(false); }).catch(function(){ cacheWaitEnd(false); }); };
    } else {
      ov.innerHTML='<div style="'+box+'"><b>팀에서 받는 중…</b><br><span style="color:var(--gray,#646a73)">이 기기에는 팀 자료를 남기지 않아요</span></div>';
    }
  }catch(e){ syncDiagnostic('cache-wait-ui',e); }
}
function cacheWaitStart(){
  if(!CACHE_WIPE||!cacheWipedFlag()||!getSess())return;
  renderCacheWait(navigator.onLine===false?'offline':'wait');
  try{ setStatus('팀에서 받는 중…'); }catch(_){}
  clearTimeout(cacheWaitTimer);
  cacheWaitTimer=setTimeout(function(){ cacheWaitEnd(false); },CACHE_WAIT_MS);
}
function cacheWaitEnd(ok){
  if(!cacheWipedFlag())return;
  clearTimeout(cacheWaitTimer);
  if(ok){
    try{ localStorage.removeItem(CACHE_FLAG); }catch(_){}
    renderCacheWait(null);   /* 2.676 — 리로드하지 않는다. 화면(iframe)은 storage 이벤트로 이미 갱신된다 */
    try{ renderUI(); }catch(_){}
    return;
  }
  renderCacheWait(navigator.onLine===false?'offline':null);
}
function purgeCopies(){ var n=0; try{ for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(!k)continue;
  if(k.indexOf('ps_rescue_')===0||k.indexOf('ps_sync_conflict_')===0||k===CONFKEY||k==='ps_sync_conf_seen'){ localStorage.removeItem(k); n++; } } }catch(_){}
  return n; }
function conflictList(){ if(!dataUnlocked())return [];try{ return JSON.parse(localStorage.getItem(CONFKEY)||'[]')||[]; }catch(_){ return []; } }
function conflictNote(k){
  if(COPIES_OFF)return;
  try{
    var a=conflictList().filter(function(x){ return x.k!==k; });
    a.push({k:k,at:Date.now()});
    localStorage.setItem(CONFKEY,JSON.stringify(a.slice(-20)));
  }catch(_){}
}
function conflictClear(k){
  try{
    localStorage.setItem(CONFKEY,JSON.stringify(conflictList().filter(function(x){ return x.k!==k; })));
    localStorage.removeItem('ps_sync_conflict_'+k);
  }catch(_){}
}
/* 서버에 있던 쪽(=밀려난 다른 기기의 작업)으로 되돌린다.
   1.591 — **Promise 를 돌려준다.** 예전에는 동기 함수라 kvWrite 가 IndexedDB 에 거는 쓰기를
   기다리지 않고 true 를 반환했다. localStorage 키만 있을 땐 티가 안 났는데,
   1.590 에서 IDBK 에 네 개(일정·경기·권한·후보)를 넣자 그 키들이 전부 이 경로를 타게 됐다 —
   쓰기가 끝나기 전에 '됐다'고 답하고 목록에서 지워, 실패해도 아무도 모른다.
   rescueRestore(1.589)와 같은 병이므로 같은 처방을 쓴다: **되읽어 확인한 뒤에만** 정리한다. */
function conflictRestore(k){
  if(!dataUnlocked())return Promise.resolve(false);
  var v=null; try{ v=localStorage.getItem('ps_sync_conflict_'+k); }catch(_){}
  if(v==null) return Promise.resolve(false);
  var writes=[], ok=kvWrite(k,v,writes);
  if(!ok) return Promise.resolve(false);
  return Promise.all(writes).catch(function(){}).then(function(){
    var verify = idbBacked(k)
      ? window.storage.get(k).then(function(r){ return r?r.value:null; }).catch(function(){ return null; })
      : Promise.resolve((function(){ try{ return localStorage.getItem(k); }catch(_){ return null; } })());
    return verify.then(function(cur){
      if(cur!==v){
        syncDiagnostic('conflict-restore-verify',new Error('restore did not land: '+k));
        return false;                                  /* 목록도 백업도 건드리지 않는다 */
      }
      try{ var m=meta(); m.h[k]=hash(v); setMeta(m); }catch(_){}
      conflictClear(k);
      return true;
    });
  });
}
/* 1.526 — 알림을 끄는 길이 없었다. 지금까지는 '다른 쪽 가져오기'(=내 작업을 남의 것으로 덮기)를
   한 줄씩 누르는 것만 가능해서, 20개가 한꺼번에 뜨면 사실상 빠져나갈 방법이 없었다.
   대부분은 같은 사람이 두 기기를 쓴 경우라 '이 기기 것으로 유지'가 정답이다 — 그 길을 연다. */
function conflictKeepAll(){ conflictList().forEach(function(x){ conflictClear(x.k); }); try{ renderUI(); }catch(_){} }
function conflictOpen(){
  if(!dataUnlocked()){renderDataLock(false);return;}
  var list=conflictList();
  if(!list.length){ try{ psModal({title:'되돌릴 변경이 없습니다',hideCancel:true,ok:'확인'}); }catch(_){} return; }
  var body='<div style="margin-bottom:10px">다른 기기에서도 같은 자료가 바뀌어 <b>이 기기의 것으로 저장</b>했습니다.'
    +' 지금 화면이 맞으면 그대로 두시면 됩니다 — 아래 <b>전부 이 기기 것으로 유지</b>를 누르면 알림이 사라집니다.'
    +' 다른 기기에서 한 작업을 가져오려면 그 줄의 <b>다른 쪽 가져오기</b>를 누르세요.</div>'
    +'<div style="margin-bottom:12px"><button type="button" data-confkeepall style="width:100%;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-weight:800;font-size:13px;padding:10px;border-radius:10px;cursor:pointer">전부 이 기기 것으로 유지 ('+list.length+'개)</button></div>';
  body+=list.map(function(x){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid rgba(128,128,128,.22)">'
      +'<div style="flex:1;min-width:0"><b>'+esc(keyLabel(x.k))+'</b>'
      +'<div style="font-size:11px;opacity:.7">'+new Date(x.at).toLocaleString()+'</div></div>'
      +'<button type="button" data-confkeep="'+esc(x.k)+'" style="border:0;background:transparent;color:inherit;opacity:.65;font:inherit;font-size:12px;padding:6px 8px;border-radius:8px;cursor:pointer">유지</button>'
      +'<button type="button" data-confr="'+esc(x.k)+'" style="border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer">다른 쪽 가져오기</button>'
      +'</div>';
  }).join('');
  var mo=null;
  try{ mo=psModal({title:'다른 기기의 변경이 밀렸습니다',body:body,hideCancel:true,ok:'닫기'}); }catch(_){}
  /* psModal 은 동기적으로 DOM 을 붙인다 — 타이머로 미루면 그 사이 클릭이 먹지 않는다. */
  var _all=document.querySelector('[data-confkeepall]');
  if(_all)_all.addEventListener('click',function(){
    conflictKeepAll();
    try{ if(mo&&mo.close)mo.close(true); }catch(_){}
    try{ psModal({title:'이 기기 것으로 유지했습니다',body:'알림을 지웠습니다. 자료는 지금 화면 그대로입니다.',hideCancel:true,ok:'확인'}); }catch(_){}
  });
  document.querySelectorAll('[data-confkeep]').forEach(function(b){
    b.addEventListener('click',function(){
      conflictClear(this.dataset.confkeep);
      try{ if(mo&&mo.close)mo.close(true); }catch(_){}
      try{ renderUI(); }catch(_){}
      conflictOpen();
    });
  });
  document.querySelectorAll('[data-confr]').forEach(function(b){
    b.addEventListener('click',function(){
      var k=this.dataset.confr;
      /* 1.591 — conflictRestore 가 Promise 를 준다. 기다렸다가 결과를 말한다
         (예전에는 쓰기가 끝나기도 전에 '되돌렸습니다'를 띄웠다). */
      Promise.resolve(conflictRestore(k)).then(function(ok){
        try{ if(mo&&mo.close)mo.close(true); }catch(_){}
        try{ renderUI(); }catch(_){}
        try{ psModal(ok
          ?{title:keyLabel(k)+' — 다른 쪽 내용으로 되돌렸습니다',body:'화면을 새로고침하면 반영됩니다.',hideCancel:true,ok:'확인'}
          :{title:'되돌리지 못했습니다',body:'자료는 그대로 두었습니다. 다시 시도해 주세요.',hideCancel:true,ok:'확인'}); }catch(_){}
      });
    });
  });
}
try{ window.PSSyncConflicts={list:conflictList,open:conflictOpen,restore:conflictRestore,clear:conflictClear}; }catch(_){}

/* 2.255 — 전환 실패 기록: 지금까지 실패는 작은 상태줄·콘솔에만 남아 "그냥 내 작업으로 돌아왔다"로 보였다(실제 제보).
   기록해 두고 다음 표시 기회(부팅 칩)에 원인 문장을 보여 준다. */
function recSwitchFail(msg,code){ try{ localStorage.setItem('ps_last_switch_err',JSON.stringify({m:String(msg||'').slice(0,180),c:String(code||'').slice(0,60),at:Date.now()})); }catch(_){} }
/* 공간 전환 직후 한 번 알린다 — 자료가 사라진 게 아니라 다른 공간을 보고 있다는 것. */
function wsSwitchNotice(){
  /* 2.255 — 전환 실패가 있었으면 먼저 알린다(3분 안의 것만) */
  try{ var fr=JSON.parse(localStorage.getItem('ps_last_switch_err')||'null');
    if(fr&&fr.m&&Date.now()-(fr.at||0)<180000){ localStorage.removeItem('ps_last_switch_err');
      chip('워크스페이스 전환이 안 됐어요 — '+fr.m+(fr.c?' ['+fr.c+']':'')); return; }
    else if(fr)localStorage.removeItem('ps_last_switch_err');
  }catch(_){}
  var raw=null; try{ raw=localStorage.getItem('ps_ws_switched_v1'); }catch(_){}
  if(!raw) return;
  try{ localStorage.removeItem('ps_ws_switched_v1'); }catch(_){}
  var d=null; try{ d=JSON.parse(raw); }catch(_){}
  if(!d||!d.to) return;
  if(Date.now()-(d.at||0)>120000) return;      /* 오래된 기록은 알리지 않는다 */
  try{
    chip('‘'+d.to+'’ 자료를 보고 있어요'+(d.from?(' · ‘'+d.from+'’ 자료는 그대로 있습니다'):''));
  }catch(_){}
}
try{ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(wsSwitchNotice,900); });
     else setTimeout(wsSwitchNotice,900); }catch(_){}
var MAXLEN=1500000, SCHEDULE_MAXLEN=3500000;
/* 키 하나 최대 크기(문자). 일반 자료의 1.5M 방어선은 유지한다.
   일정은 8주치 훈련·드릴을 한 문서에 담아 정상 사용만으로 약 1.5M자를 넘을 수 있으므로
   1.651부터 일정 한 키만 3.5M까지 허용한다. PostgREST에는 큰 행 하나만 별도 chunk로 전송된다. */
function syncMaxLen(k){return k==='process_coach_v1'?SCHEDULE_MAXLEN:MAXLEN;}
/* 동기화 대상 = 사용자 콘텐츠. 기기별 선호(토큰 크기·힌트·라이브 작업본)는 제외.
   보관함(cs_drill_lib_v1)은 여기 없음 — ps_library 테이블에 항목 단위로 동기화(아래 syncLibrary) */
/* training_session_cur_v1(편집 중 초안)은 여기서 뺐다 — 작업 버퍼라 팀에 전파하면 서로 튕긴다.
   (작전판 작업본 cs_board_live_v1이 원래 빠져 있던 것과 같은 이유) */
var KEYS=[
  'cs_vault_folders_v1','cs_vault_folder_tags_v1','cs_vault_folder_meta_v1',
  'process_coach_v1','cs_themes_v1','cs_team_v1',
  'cs_squad_v1','scout_tool_v1','cs_gamemodel_v1',
  'training_sessions_v1',
  'cs_psched_v1','cs_pmeet_v1','cs_pwarm_v1','cs_ptrain_v1',
  'cs_match_v1','cs_match_roster_v1','cs_meet_sit_v1','cs_team_matches_v1','cs_team_match_private_v1','cs_match_del_v1','cs_player_del_v1',
  /* 1.621 — 경기 담당 배정. 운영진만 쓴다(아래 canW). IDBK 에는 넣지 않는다 — localStorage 하나만
     쓰면 1.618 의 '저장소 짝 안 맞음'이 아예 생길 수 없다. */
  'cs_assign_v1',
  'cs_notes_v1','cs_note_papers_v1','cs_coach_img_v1',
  'cs_terms_v1','cs_perms_v1','cs_team_attrs_v1','cs_idp_daily_v1',
  /* 2.537 — 팀 공지(사용자 "공지사항도 넣어서 선수들이 확인할 수 있게").
     팀 공용 키 하나면 된다 — 선수도 팀 키를 받는다(idp.html 이 cs_team_matches_v1 을 읽는 것과 같은 길).
     개인별 공개본(cs_idp_pub_v1_*)이 아닌 이유: 공지는 **모두에게 같은 글**이라 사람 수만큼 복사할 이유가 없다. */
  'cs_team_notice_v1',
  /* 1.540 — 스카우팅 후보. 선수 명단(scout_tool_v1)과 갈라 두어야 서버에서 임원 전용으로 막을 수 있다 */
  'cs_scout_targets_v1',
  /* 1.501 — 매치데스크(분석)가 통째로 빠져 있었다: 기기에만 남아 다른 기기에서 안 보이고
     캐시가 지워지면 사라진다("매치데스크 만든 게 저장이 안 돼"). 전부 PERSONAL — 아래 참조. */
  'cs_analysis_workspaces_v1','cs_analysis_team_library_v1','cs_analysis_role_v1','cs_analysis_depth_v1'
];
/* 개인 필기장 — 키 통째 LWW라 팀에서 동시에 쓰면 한쪽이 통째로 사라진다.
   팀 워크스페이스에선 동기화하지 않고, 개인 워크스페이스에서만 기기 간 동기화한다.
   cs_coach_img_v1(지도자 이미지노트)도 같은 성격 — 화면은 팀 탭에 있지만 내용은 '내 경기 전 준비'라
   스태프끼리 섞이면 안 된다(특히 '칭찬 및 각오'). 개인 워크스페이스에선 PC↔폰 동기화가 필요하므로 KEYS 에는 넣는다. */
/* 매치데스크(analysis)는 개인 작업실 — 팀에 섞이면 안 되고(사용자 확정), 통째 LWW라 팀 동시 사용 시 한쪽이 사라진다.
   개인 워크스페이스에서만 기기 간 동기화하고, 팀 워크스페이스에선 올리지 않는다. 공개는 커뮤니티 발행으로 한다. */
var PERSONAL={'cs_notes_v1':1,'cs_note_papers_v1':1,'cs_coach_img_v1':1,'cs_team_match_private_v1':1,
  'cs_analysis_workspaces_v1':1,'cs_analysis_team_library_v1':1,'cs_analysis_role_v1':1,'cs_analysis_depth_v1':1};
/* 선수 역할에게는 서버가 아예 내려 주지 않는 키 — supabase-security-v2.sql 의 ps_can_read_key 와
   **같은 목록이어야 한다.** 1.633 까지 이 목록은 두 곳(선수 역할 정리 코드 · 화면 안내문)에 따로
   적힐 뻔했다. 표가 갈라지면 화면이 "선수도 봅니다"라고 거짓말을 하게 된다 — 아무 말도 안 하느니 못하다. */
var PLAYER_BLIND=['scout_tool_v1','cs_squad_v1','cs_meet_sit_v1','cs_match_v1','cs_match_roster_v1'];
/* 동기화는 안 하지만 워크스페이스 전환 시엔 비워야 하는 작업 버퍼 */
var DRAFT_KEYS=['training_session_cur_v1'];
/* 2.464 — QA #18 "다른 워크스페이스의 데이터가 보인다": 작전판 라이브 문서(배치·그림·애니메이션
   장면·경기 상태)가 전환 와이프 목록 어디에도 없어 팀을 바꿔도 이전 팀 작전판이 그대로 복원됐다.
   IDB 정본(IDB_CONTENT)과 localStorage 거울(CONTENT) **양쪽에** 넣는다 — 거울만 남아도
   storage.get 의 IDB 미스 폴백(1.589 ③)이 이전 팀 판을 IDB 에 되심는다. */
var BOARD_LOCAL=['cs_board_live_v1','cs_snap_board_v1','cs_snap_match_v2',
  /* 복구 사본도 함께 — 전환 체인이 프레임을 내릴 때의 pagehide 가 이전 팀 라이브 전체를
     이 키에 동기 기록한다(board.html _boardLiveWriteNow(recovery)). 안 지우면 새 팀 부팅의
     restoreLiveBoard 가 이 사본을 채택해 IDB 정본으로 되심는다 — 아래 sleep(350) 뒤
     비우기가 정확히 이런 unload 계열 기록을 지우라고 있는 자리다. */
  'cs_board_recovery_v1'];
var LIBKEY='cs_drill_lib_v1', TOMBKEY='ps_tomb_v1';
/* 워크스페이스 전환 시 비우는 로컬 콘텐츠 — 개인 노트는 워크스페이스에 속하지 않으므로 제외(따라다닌다) */
var CONTENT=KEYS.filter(function(k){ return !PERSONAL[k]; }).concat([LIBKEY,TOMBKEY,'ps_items_idx_v1','ps_items_hold_v1']).concat(DRAFT_KEYS).concat(BOARD_LOCAL);
function isTeamWs(){ try{ var w=activeWsObj(); return !!(w&&w.kind==='team'); }catch(_){ return false; } }
var WSKEY='ps_active_ws', WLKEY='ps_ws_list';

/* ── 세션 ── */
function getSess(){ try{ var s=JSON.parse(localStorage.getItem(SKEY)||'null'); return (s&&s.at&&s.rt)?s:null; }catch(_){ return null; } }
function setSess(s){ try{ if(s)localStorage.setItem(SKEY,JSON.stringify(s)); else localStorage.removeItem(SKEY); }catch(_){}
  /* 로그인이 살아나면 '만료로 백업 멈춤' 배너 근거를 지운다 (앱 셸 expBanner) */
  if(s){ try{ localStorage.removeItem('ps_login_expired'); }catch(_){}}
  else setDataReady(false);
  renderUI(); }
function hj(at){ var h={'apikey':CFG.anonKey,'Content-Type':'application/json'}; if(at)h['Authorization']='Bearer '+at; return h; }
/* 2.627 — 쓰기 요청에 앱 판을 실어 보낸다(Prefer 의 모르는 토큰은 PostgREST 가 무시한다 — 실계정 탭에서 GET 200 확인). 서버 ps_kv_build_guard 가
   ps_app_policy.min_build 보다 낮은 판의 ps_kv 쓰기를 거부할 수 있다(지금은 min_build 2.000 = 아무도 안 막음, 운영자가 올릴 때 켠다). */
function psBuild(){ try{ return String(window.PS_BUILD||''); }catch(_){ return ''; } }
function prefBuild(base){ var b=psBuild(); return b?(base+',ps-build='+b):base; }
/* ── 사용 핑: 기능별 하루 1회 (day, uid, feature) — DAU/기능 사용 통계용. 콘텐츠 없음, 실패해도 무해.
   feature = 셸 탭 이름(board/design/process/idp/…) 또는 'app'(로그인 동기화 = 접속).
   보낸 기록은 ps_usage_pings에 {feature:'YYYY-MM-DD'}로 — 날짜가 바뀌면 자연히 다시 보낸다 ── */
var PINGKEY='ps_usage_pings';
function pingMap(){ try{ return JSON.parse(localStorage.getItem(PINGKEY)||'{}')||{}; }catch(_){ return {}; } }
function usagePing(at,feature){
  try{
    var f=String(feature||'app').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,24); if(!f) return;
    var s=getSess(); if(!s) return;
    var d=new Date();
    var ymd=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(pingMap()[f]===ymd) return;
    var send=function(tok){ if(!tok) return;
      var post=function(uid){
      if(!uid)return;
      var h=hj(tok); h['Prefer']='resolution=ignore-duplicates,return=minimal';
      fetch(BASE+'/rest/v1/ps_usage?on_conflict=day,user_id,feature',{method:'POST',headers:h,
        body:JSON.stringify([{day:ymd,user_id:uid,feature:f,workspace_id:activeWs()||null}])})
        .then(function(r){ if(r.ok||r.status===409){ try{
          var m=pingMap(); m[f]=ymd;
          Object.keys(m).forEach(function(k){ if(m[k]!==ymd) delete m[k]; });   /* 지난 날짜 정리 */
          localStorage.setItem(PINGKEY,JSON.stringify(m));
        }catch(_){} } })
        .catch(function(e){syncDiagnostic('usage-ping',e);});
      };
      var cur=getSess();
      if(cur&&cur.uid){post(cur.uid);return;}
      /* OAuth 직후에는 토큰이 먼저 저장되고 uid가 조금 늦게 채워질 수 있다.
         이때 핑을 버리지 않고 인증 서버에서 본인 uid를 확인한 뒤 한 번만 전송한다. */
      fetch(BASE+'/auth/v1/user',{headers:hj(tok)}).then(function(r){return r.ok?r.json():null;}).then(function(u){
        if(!u||!u.id)return;
        var latest=getSess();
        if(latest){latest.uid=u.id;latest.email=u.email||latest.email||'';setSess(latest);}
        post(u.id);
      }).catch(function(e){syncDiagnostic('usage-user-lookup',e);});
    };
    if(at) send(at); else ensureToken().then(send).catch(function(e){syncDiagnostic('usage-token',e);});
  }catch(_){}
}

/* ── 제품 이벤트·안정성 로그
   텍스트 메모·평가 내용·작전판 데이터는 절대 보내지 않는다.
   이벤트 이름, 성공/실패, 기능, 기기, 오류 코드와 숫자/불리언 메타만 저장한다. */
var EVENT_QUEUE='ps_event_queue_v1', EVENT_SEEN='ps_event_seen_v1';
function eventDevice(){
  try{
    var ua=navigator.userAgent||'';
    if(/iPhone|Android.*Mobile|Windows Phone/i.test(ua))return 'mobile';
    if(/iPad/i.test(ua)||(navigator.maxTouchPoints>1&&/Macintosh/.test(ua)))return 'tablet';
  }catch(_){}
  return 'desktop';
}
function safeEventMeta(meta){
  var out={}; if(!meta||typeof meta!=='object')return out;
  Object.keys(meta).slice(0,12).forEach(function(k){
    var v=meta[k];
    if(typeof v==='number'||typeof v==='boolean')out[String(k).slice(0,32)]=v;
    else if(typeof v==='string'&&/^(code|reason|mode|format|source|stage)$/i.test(k))out[String(k).slice(0,32)]=v.slice(0,80);
  });
  return out;
}
/* 2.516 — 앱 버전을 **실제 빌드**로. 하드코딩된 '2026.07.26-v229' 는 모든 이벤트에 같은
   버전을 찍고 있었다 → 관리자 화면의 '버전' 칸이 통째로 거짓이었고, 어느 판에서 난 오류인지
   알 수 없었다. 셸(app.html)이 window.PS_BUILD 를 이미 들고 있다. */
function appVer(){ try{
  var v=window.PS_BUILD||(window.parent&&window.parent!==window&&window.parent.PS_BUILD)||'';
  v=String(v||'').trim(); return v?v.slice(0,24):'unknown';
}catch(_){ return 'unknown'; } }
/* ══ 2.516 · 핵심 행동 기록 — "무엇을" 에서 "어떻게" 로 ══════════════════════════
   지금까지 핵심 행동(a_diary·a_qgoal…)은 usagePing 으로 (날짜·유저·기능) **하루 한 줄**만
   남겼다. 그래서 관리자는 "그날 일지를 썼다"까지만 알고 **몇 번·언제·어떤 기기로**는
   원리적으로 알 수 없었다. ps_events 는 그 셋을 이미 담을 수 있는데(created_at·device·
   app_version) 핵심 행동만 보내지 않고 있었다 — 여기서 같이 보낸다.
   ⚠ 담는 것은 지금과 똑같다: 행동 이름·기능·기기·앱 버전·시각. **내용은 안 담는다.**
   ① 같은 행동 20초 안 연타·자동 저장은 한 번으로 ② 한 사람 하루 300건 상한. */
var ACT_SEEN='ps_act_seen', ACT_CAP='ps_act_cap';
/* 자동 저장으로 도는 행동(경기 준비·리뷰)은 20초로 묶으면 한 시간 편집에 180건이 된다.
   '몇 번 했나'의 뜻이 흐려지고 하루 상한만 먹는다 — 이 둘만 5분으로 묶는다. */
var ACT_GAP={a_match:300000,a_review:300000};
function actAllowed(name){
  try{
    var now=Date.now(), day=new Date().toISOString().slice(0,10), seen={};
    try{ seen=JSON.parse(localStorage.getItem(ACT_SEEN)||'{}')||{}; }catch(_){}
    if(seen[name]&&now-seen[name]<(ACT_GAP[name]||20000)) return false;
    seen[name]=now;
    Object.keys(seen).forEach(function(k){ if(now-seen[k]>86400000) delete seen[k]; });
    try{ localStorage.setItem(ACT_SEEN,JSON.stringify(seen)); }catch(_){}
    var cap={}; try{ cap=JSON.parse(localStorage.getItem(ACT_CAP)||'{}')||{}; }catch(_){}
    if(cap.d!==day) cap={d:day,n:0};
    if(cap.n>=300) return false;
    cap.n++; try{ localStorage.setItem(ACT_CAP,JSON.stringify(cap)); }catch(_){}
    return true;
  }catch(_){ return true; }
}
function actTrack(name,feature){
  try{
    var f=String(name||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,32); if(!f)return;
    usagePing(null,f);                 /* 하루 한 줄 — 그대로 둔다(관리자 홈의 '핵심 행동'이 이걸 읽는다) */
    if(!actAllowed(f))return;
    eventTrack(f,{feature:String(feature||'app'),status:'ok'});
  }catch(_){}
}
function eventQueue(){try{return JSON.parse(localStorage.getItem(EVENT_QUEUE)||'[]')||[];}catch(_){return [];}}
function setEventQueue(q){try{localStorage.setItem(EVENT_QUEUE,JSON.stringify((q||[]).slice(-50)));}catch(_){}}
function eventTrack(name,opts){
  try{
    opts=opts||{};
    var ev=String(name||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,48); if(!ev)return;
    var s=getSess(); if(!s||!s.uid)return;
    var status=String(opts.status||'ok').toLowerCase().replace(/[^a-z]/g,'').slice(0,12)||'ok';
    var code=String(opts.error_code||'').replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,80);
    /* 같은 오류가 반복 폭주해도 5분에 한 번만 기록 */
    if(status==='error'){
      var sk=ev+'|'+code, seen={};try{seen=JSON.parse(localStorage.getItem(EVENT_SEEN)||'{}')||{};}catch(_){}
      if(seen[sk]&&Date.now()-seen[sk]<300000)return;
      seen[sk]=Date.now();Object.keys(seen).forEach(function(k){if(Date.now()-seen[k]>86400000)delete seen[k];});
      try{localStorage.setItem(EVENT_SEEN,JSON.stringify(seen));}catch(_){}
    }
    /* 2.599 — 저장 이벤트(content_saved 등)는 저장마다 한 줄이었다(실측 ps_events 4,195,993행 중 content_saved 4,042,966 = 96%, 1.6GB).
       사용 흔적은 «이름별 10분에 한 번» 이면 충분하다 — 오류 이벤트의 5분 억제와 같은 표. */
    if(status==='ok'&&/_saved$/.test(ev)){
      var sk2='ok|'+ev, seen2={};try{seen2=JSON.parse(localStorage.getItem(EVENT_SEEN)||'{}')||{};}catch(_){}
      if(seen2[sk2]&&Date.now()-seen2[sk2]<600000)return;
      seen2[sk2]=Date.now();try{localStorage.setItem(EVENT_SEEN,JSON.stringify(seen2));}catch(_){}
    }
    var w=activeWsObj()||{};
    var row={event_name:ev,status:status,feature:String(opts.feature||'app').slice(0,32),
      workspace_id:w.id||null,device:eventDevice(),app_version:appVer(),
      error_code:code||null,meta:safeEventMeta(opts.meta),created_at:new Date().toISOString()};
    var q=eventQueue();q.push(row);setEventQueue(q);flushEvents();
  }catch(_){}
}
var eventFlushing=false;
function flushEvents(){
  if(eventFlushing||!navigator.onLine)return;
  var q=eventQueue();if(!q.length)return;
  eventFlushing=true;
  ensureToken().then(function(at){
    if(!at)throw new Error('no token');
    return fetch(BASE+'/rest/v1/ps_events',{method:'POST',headers:hj(at),body:JSON.stringify(q.slice(0,20))})
      .then(function(r){if(!r.ok)throw new Error('event '+r.status);var left=eventQueue();left.splice(0,Math.min(20,left.length));setEventQueue(left);});
  }).then(function(){eventFlushing=false;if(eventQueue().length)setTimeout(flushEvents,250);})
    .catch(function(){eventFlushing=false;});
}

/* ── 워크스페이스 상태 ── */
function wsList(){ try{ return JSON.parse(localStorage.getItem(WLKEY)||'[]')||[]; }catch(_){ return []; } }
function setWsList(l){ try{ localStorage.setItem(WLKEY,JSON.stringify(l||[])); }catch(_){} }
function activeWs(){ try{ return localStorage.getItem(WSKEY)||''; }catch(_){ return ''; } }
function setActiveWs(id){
  try{
    if(id)localStorage.setItem(WSKEY,id);else localStorage.removeItem(WSKEY);
    return (localStorage.getItem(WSKEY)||'')===(id||'');
  }catch(e){syncDiagnostic('workspace-id-write',e);return false;}
}
function activeWsObj(){ var id=activeWs(); return wsList().filter(function(w){return w.id===id;})[0]||null; }

/* ── 로컬 자료 잠금 ──
   로그아웃은 서버 삭제가 아니다. 그러나 남아 있는 IndexedDB를 다음 사람이 보거나
   자기 공간으로 올리는 것도 안 된다. uid+workspace 소유자가 확인된 뒤에만 연다. */
function cacheOwner(){
  try{ var o=JSON.parse(localStorage.getItem(OWNERKEY)||'null'); return o&&o.uid&&o.wid?o:null; }catch(_){ return null; }
}
function setCacheOwner(uid,wid){
  if(!uid||!wid)return false;
  try{
    var raw=JSON.stringify({v:1,uid:String(uid),wid:String(wid),at:Date.now()});
    localStorage.setItem(OWNERKEY,raw);
    var o=cacheOwner();return !!(o&&o.uid===String(uid)&&o.wid===String(wid));
  }catch(e){syncDiagnostic('cache-owner-write',e);return false;}
}
function renderDataLock(unlocked){
  try{
    if(!document.body)return;
    document.body.classList.toggle('ps-data-locked',!unlocked);
    var teamNav=document.getElementById('teamNav');
    if(teamNav){teamNav.style.visibility=unlocked?'':'hidden';teamNav.setAttribute('aria-hidden',unlocked?'false':'true');}
    var host=document.querySelector('.frames'),ov=document.getElementById('psDataLock');
    if(unlocked){if(ov)ov.remove();return;}
    if(!host||ov)return;
    ov=document.createElement('div');ov.id='psDataLock';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
    ov.style.cssText='position:absolute;inset:0;z-index:99997;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg,#f5f6f8);color:var(--txt,#16181c);font-family:inherit;';
    /* 2.254 — 세션이 있는데 잠겨 있으면(자료 준비 실패) '로그인이 필요합니다'는 거짓말이었다(실제 제보: 카카오 로그인 뒤에도 이 화면).
       실패 원인 한 줄(ps_last_unlock_err) + 다시 시도를 보여 준다. */
    var _sInfo=getSess(), _lastErr=''; try{ _lastErr=localStorage.getItem('ps_last_unlock_err')||''; }catch(_){}
    if(_sInfo){
      ov.innerHTML='<div style="width:min(420px,100%);text-align:center;background:var(--bar,#fff);border:1px solid var(--line,#e2e4e8);border-radius:18px;padding:28px 22px;box-shadow:0 18px 48px rgba(20,24,32,.12)"><div style="font-size:20px;font-weight:850;margin-bottom:8px">자료를 불러오지 못했어요</div><div style="font-size:13px;line-height:1.6;color:var(--dim,#6f7580);margin-bottom:8px">'+(_sInfo.email?('<b>'+String(_sInfo.email).replace(/[<>&]/g,'')+'</b> 로 로그인은 됐어요.<br>'):'')+'서버에서 워크스페이스를 불러오는 중 문제가 있었습니다.</div>'+(_lastErr?'<div style="font-size:11px;line-height:1.5;color:#a05b57;background:#fdf3f3;border-radius:8px;padding:7px 10px;margin-bottom:14px;word-break:break-all">'+String(_lastErr).replace(/[<>&]/g,'')+'</div>':'<div style="margin-bottom:10px"></div>')+'<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap"><button type="button" data-ps-retry style="border:0;background:var(--blue,#3a6df0);color:#fff;border-radius:10px;padding:10px 18px;font:800 13px inherit;cursor:pointer">다시 시도</button><button type="button" data-ps-relogout style="border:1px solid var(--line,#d8dbe1);background:#fff;color:#202124;border-radius:10px;padding:10px 15px;font:800 13px inherit;cursor:pointer">로그아웃</button></div></div>';
      var rb=ov.querySelector('[data-ps-retry]'); if(rb)rb.onclick=function(){ rb.disabled=true; rb.textContent='불러오는 중…'; setDataReady(false);
        loadWorkspaces().then(function(){ return syncNow('unlock-retry'); }).catch(function(e){ try{ localStorage.setItem('ps_last_unlock_err',String(e&&e.message||e).slice(0,200)); }catch(_){} try{ var o2=document.getElementById('psDataLock'); if(o2)o2.remove(); }catch(_){} renderDataLock(dataUnlocked()); }); };
      var lb=ov.querySelector('[data-ps-relogout]'); if(lb)lb.onclick=function(){ signOut(); try{ var o3=document.getElementById('psDataLock'); if(o3)o3.remove(); }catch(_){} renderDataLock(dataUnlocked()); };
    } else {
      ov.innerHTML='<div style="width:min(420px,100%);text-align:center;background:var(--bar,#fff);border:1px solid var(--line,#e2e4e8);border-radius:18px;padding:28px 22px;box-shadow:0 18px 48px rgba(20,24,32,.12)"><div style="font-size:20px;font-weight:850;margin-bottom:8px">로그인이 필요합니다</div><div style="font-size:13px;line-height:1.6;color:var(--dim,#6f7580);margin-bottom:18px">로그아웃한 기기에서는 자료를 표시하지 않습니다.<br>같은 계정으로 로그인하면 기존 자료가 다시 열립니다.</div>'+(_lastErr?'<div style="font-size:11px;line-height:1.5;color:#a05b57;background:#fdf3f3;border-radius:8px;padding:7px 10px;margin-bottom:14px;word-break:break-all">'+String(_lastErr).replace(/[<>&]/g,'')+'</div>':'')+'<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap"><button type="button" data-ps-login="kakao" style="border:1px solid #e2c532;background:#fee500;color:#191919;border-radius:10px;padding:10px 15px;font:800 13px inherit;cursor:pointer">카카오로 계속</button><button type="button" data-ps-login="google" style="border:1px solid var(--line,#d8dbe1);background:#fff;color:#202124;border-radius:10px;padding:10px 15px;font:800 13px inherit;cursor:pointer">Google로 계속</button></div></div>';
      ov.querySelectorAll('[data-ps-login]').forEach(function(b){b.onclick=function(){signIn(b.getAttribute('data-ps-login'));};});
    }
    host.appendChild(ov);
  }catch(e){syncDiagnostic('data-lock-ui',e);}
}
function broadcastAuthState(unlocked){
  var detail={unlocked:!!unlocked};
  try{window.dispatchEvent(new CustomEvent('ps-auth-state',{detail:detail}));}catch(_){}
  try{document.querySelectorAll('iframe').forEach(function(f){try{if(f.contentWindow)f.contentWindow.postMessage({source:'process-studio',type:'ps-auth-state',unlocked:!!unlocked},'*');}catch(_){}});}catch(_){}
}
function dataUnlocked(){
  var s=getSess(),o=cacheOwner(),wid=activeWs();
  /* ══ 2.418 · 세션이 없으면 **잠근다**(사용자 "로그아웃하면 그냥 안보이게 해줘 로그인 유도해줘") ══
     ⚠ 1.831 의 '게스트 개방'(세션도·이전 계정 흔적도·워크스페이스도 없는 새 기기는 안 잠근다)을 걷어냈다.
        그 길로 들어오면 **앱 전체가 빈 채로 멀쩡히 열려** — 이름 없음 · 아직 비어 있어요 · 0/24항목 —
        처음 온 사람은 그것을 **고장으로 읽고**, 정작 로그인 안내(`#psDataLock`)는 영영 보지 못했다.
     ⚠ 잠금 화면은 이미 있다: 세션이 없으면 '로그인이 필요합니다' + 카카오·Google 버튼.
        만들 것이 없었고 **닿지 못하게 막고 있던 예외를 닫은 것**이다.
     ⚠ 세션이 **있는데** 잠긴 경우(자료 준비 실패)는 2.254 가 만든 그대로 — '불러오지 못했어요' + 다시 시도. */
  if(!s) return false;
  return !!(dataReady&&s.uid&&o&&o.uid===String(s.uid)&&o.wid===String(wid));
}
function setDataReady(on,uid,wid){
  if(on){
    var s=getSess();uid=String(uid||(s&&s.uid)||'');wid=String(wid||activeWs()||'');
    if(!s||!uid||String(s.uid)!==uid||!wid||!setCacheOwner(uid,wid))on=false;
  }
  if(on){ try{ localStorage.removeItem('ps_last_unlock_err'); }catch(_){} }   /* 2.254 — 풀리면 실패 기록 정리 */
  dataReady=!!on;
  renderDataLock(dataUnlocked());
  broadcastAuthState(dataUnlocked());
  return dataUnlocked();
}
function dataLockError(){var e=new Error('로그인한 계정의 자료가 확인되지 않았습니다');e.name='PSDataLockedError';e.psDataLocked=true;return e;}
function ensureSessionIdentity(){
  var s=getSess();if(!s)return Promise.reject(dataLockError());
  if(s.uid)return Promise.resolve(s);
  return ensureToken().then(function(at){
    if(!at)throw dataLockError();
    return fetch(BASE+'/auth/v1/user',{headers:hj(at)}).then(function(r){if(!r.ok)throw new Error('user '+r.status);return r.json();});
  }).then(function(u){
    if(!u||!u.id)throw dataLockError();
    var latest=getSess();if(!latest)throw dataLockError();
    latest.uid=u.id;latest.email=u.email||latest.email||'';setSess(latest);return latest;
  });
}
function sensitiveLocalKey(k){
  if(!k)return false;
  if(k.indexOf('cs_')===0||k.indexOf('scout_')===0||k.indexOf('training_')===0||k.indexOf('process_')===0||k.indexOf('sq:')===0)return true;
  return k===WSKEY||k===WLKEY||k===MKEY||k===OWNERKEY||k==='ps_sync_outbox_v1'||k==='ps_sync_pending_summary_v1'||k==='ps_sync_skipped'
    ||k==='ps_sync_conflicts_v1'||k==='ps_sync_conf_seen'||k==='ps_hold_list_v1'||k==='ps_rescue_list_v1'||k==='ps_tomb_v1'
    ||k==='ps_roster_keep_v1'
    ||k==='ps_display_name'||k==='ps_kv_who_v1'||k==='ps_member_names_v1'||k==='ps_perms_missing'
    ||/^(?:ps_(?:auto_snap_|rescue_|ws_stash_|sync_conflict_|sync_base_|push_ok_|section_preimport_|section_import_ok_|schedule_recovery_|items_))/.test(k);
}
function accountContentProbe(k){
  return KEYS.indexOf(k)>=0||CONTENT.indexOf(k)>=0||k===LIBKEY||k===TOMBKEY||k.indexOf('sq:')===0
    ||k==='ps_roster_keep_v1'
    ||k.indexOf('cs_idp_v1_')===0||k.indexOf('cs_idp_pub_v1_')===0
    ||/^(?:cs_(?:board|snap|editor|vault_edit|drill_form|note_forms|note_myforms|matchnotes)|ps_(?:auto_snap_|rescue_|ws_stash_))/.test(k);
}
function removeLocalVerified(keys){
  keys.forEach(function(k){localStorage.removeItem(k);if(localStorage.getItem(k)!=null)throw new Error(k+' local wipe verify failed');});
}
function idbSensitiveKeys(workspaceOnly){
  if(!window.storage||!window.storage.keys)return Promise.resolve([]);
  return Promise.resolve(window.storage.keys()).then(function(keys){
    if(!Array.isArray(keys))throw new Error('IndexedDB 키 목록을 확인할 수 없습니다');
    return keys.filter(function(k){
      if(workspaceOnly)return IDB_CONTENT.indexOf(k)>=0||k.indexOf('sq:')===0;
      return sensitiveLocalKey(k)||IDB_CONTENT.indexOf(k)>=0||Object.prototype.hasOwnProperty.call(IDBK,k);
    });
  });
}
function wipeWorkspaceCache(uid){
  setDataReady(false);
  try{syncBaseCacheClear();}catch(_){}
  var local=[];try{CONTENT.concat([MKEY,'ps_sync_outbox_v1','ps_sync_pending_summary_v1']).forEach(function(k){if(local.indexOf(k)<0)local.push(k);});
    for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(k&&k.indexOf('cs_idp_v1_')===0&&k!=='cs_idp_v1_'+uid&&k!=='cs_idp_v1_local')local.push(k);}
    removeLocalVerified(local);
  }catch(e){return Promise.reject(e);}
  return idbSensitiveKeys(true).then(function(keys){return Promise.all(keys.map(function(k){return window.storage.del(k);}));});
}
function wipeAccountCache(){
  setDataReady(false);
  try{syncBaseCacheClear();}catch(_){}
  try{var keys=[];for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(sensitiveLocalKey(k))keys.push(k);}removeLocalVerified(keys);}catch(e){return Promise.reject(e);}
  return idbSensitiveKeys(false).then(function(keys){return Promise.all(keys.map(function(k){return window.storage.del(k);}));});
}
function legacyCacheInfo(){
  var info={has:false,uid:'',teamish:false},uids={};
  try{
    for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(accountContentProbe(k)){var v=localStorage.getItem(k);if(v!=null&&v!==''&&v!=='[]'&&v!=='{}'&&v!=='null')info.has=true;}}
    var fm=JSON.parse(localStorage.getItem('cs_vault_folder_meta_v1')||'{}')||{};Object.keys(fm).forEach(function(k){if(fm[k]&&fm[k].shared)info.teamish=true;});
  }catch(_){}
  var p=Promise.resolve(null);
  if(window.storage&&window.storage.keys){
    p=Promise.resolve(window.storage.keys()).then(function(keys){
      var hit=(keys||[]).filter(accountContentProbe);if(hit.length)info.has=true;
      return window.storage.get(LIBKEY).then(function(r){return r?r.value:null;});
    });
  }else{try{p=Promise.resolve(localStorage.getItem(LIBKEY));}catch(_){}}
  return p.catch(function(){return null;}).then(function(raw){
    try{var lib=JSON.parse(raw||'[]');if(Array.isArray(lib))lib.forEach(function(it){
      if(!it)return;if(it._teamOwner||it._teamSource==='team'||it._teamSharedAt)info.teamish=true;
      if(it.createdBy&&!it._teamOwner&&it._teamSource!=='team')uids[String(it.createdBy)]=1;
    });}catch(_){}
    var a=Object.keys(uids);if(a.length===1)info.uid=a[0];return info;
  });
}
function defaultWorkspace(rows){return (rows.filter(function(w){return w.kind==='personal';})[0]||rows[0]||{}).id||'';}
/* 1.847 — 네이티브 confirm/prompt 는 설치형 PWA 에서 막힌다. 앱 셸의 psConfirm/psPrompt(app.html) 가 있으면 그걸 쓰고,
   없으면(단독 로드) 네이티브로 — 둘 다 Promise 로 감싸 호출부 흐름을 하나로 둔다. */
function askConfirm(msg){return new Promise(function(res){try{if(window.psConfirm){window.psConfirm(msg,function(){res(true);},function(){res(false);});return;}}catch(_){}var r=false;try{r=window.confirm(msg);}catch(_){}res(r);});}
function askPrompt(msg,def){return new Promise(function(res){try{if(window.psPrompt){window.psPrompt(msg,def,function(v){res(v);},function(){res(null);});return;}}catch(_){}var r=null;try{r=window.prompt(msg,def);}catch(_){}res(r);});}
function legacyWorkspace(rows,info){   /* → Promise<workspaceId> */
  var personal=defaultWorkspace(rows),teams=rows.filter(function(w){return w.kind==='team';});
  if(!teams.length)return Promise.resolve(personal);
  if(info&&info.teamish&&teams.length===1)return Promise.resolve(teams[0].id);
  try{
    if(teams.length===1)return askConfirm('이 기기에 남은 기존 자료를 ‘'+(teams[0].name||'팀')+'’ 팀에 연결할까요?\n\n취소하면 ‘내 작업’에서 시작합니다.').then(function(ok){return ok?teams[0].id:personal;});
    var msg='이 기기에 남은 기존 자료를 연결할 팀 번호를 입력하세요.\n'
      +teams.map(function(w,i){return (i+1)+') '+(w.name||'팀');}).join('\n')+'\n\n취소하면 ‘내 작업’에서 시작합니다.';
    return askPrompt(msg,'1').then(function(v){var n=parseInt(v,10);return n>0&&n<=teams.length?teams[n-1].id:personal;});
  }catch(_){return Promise.resolve(personal);}
}
function prepareCacheForSession(s,rows){
  rows=Array.isArray(rows)?rows:[];if(!s||!s.uid||!rows.length)throw dataLockError();
  var uid=String(s.uid),own=cacheOwner(),cur=activeWs();setDataReady(false);
  function valid(wid){return !!wid&&rows.some(function(w){return String(w.id)===String(wid);});}
  function finish(wid){
    wid=String(wid||defaultWorkspace(rows));if(!valid(wid))throw dataLockError();
    setWsList(rows);if(!setActiveWs(wid)||!setCacheOwner(uid,wid))throw dataLockError();
    if(!setDataReady(true,uid,wid))throw dataLockError();renderUI();return rows;
  }
  if(own&&String(own.uid)===uid&&valid(own.wid))return Promise.resolve(finish(own.wid));
  if(own&&String(own.uid)===uid){
    /* 2.255 — 방금 전환했던 공간이 서버 목록에 없으면 조용히 개인으로 돌아가던 것("팀 전환이 안 돼요"의 무음 경로): 원인 기록 */
    recSwitchFail('이 계정의 서버 목록에 그 워크스페이스가 없어요 — 다른 로그인으로 만든 팀이면: 계정 팝업의 \'로그인 방법 연결\'로 합치거나, 그 계정으로 초대 코드를 만들어 합류하세요','ws-not-in-bootstrap');
    var old=own.wid||cur,save=old?stashSnapshot(old).catch(function(e){syncDiagnostic('orphan-owner-stash',e);}):Promise.resolve();
    return save.then(function(){return wipeWorkspaceCache(uid);}).then(function(){return finish(defaultWorkspace(rows));});
  }
  if(own&&String(own.uid)!==uid)return wipeAccountCache().then(function(){return finish(defaultWorkspace(rows));});
  if(valid(cur))return Promise.resolve(finish(cur)); /* 이미 로그인한 구버전을 올린 1회성 마이그레이션 */
  return legacyCacheInfo().then(function(info){
    if(!info.has)return finish(defaultWorkspace(rows));
    if(info.uid&&info.uid!==uid)return wipeAccountCache().then(function(){return finish(defaultWorkspace(rows));});
    if(!info.uid){
      return askConfirm('로그아웃 전에 이 기기에 저장된 자료가 있습니다.\n현재 로그인한 계정의 자료가 맞습니까?\n\n확인: 현재 계정에 연결\n취소: 이전 자료를 제거하고 서버 자료만 불러오기').then(function(mine){
        if(!mine)return wipeAccountCache().then(function(){return finish(defaultWorkspace(rows));});
        return legacyWorkspace(rows,info).then(finish);
      });
    }
    return legacyWorkspace(rows,info).then(finish);
  });
}
/* RPC 호출(PostgREST) */
function rpc(name,body){
  /* 이 창에서 시작한 공유 IDB 저장(기준선 정렬·복구 등)이 끝난 뒤 읽는다. */
  var storageReady=(window.PSStorage&&PSStorage.sharedReady)?PSStorage.sharedReady():Promise.resolve(true);
  return Promise.resolve(storageReady).catch(function(e){syncDiagnostic('shared-write-barrier',e);throw e;}).then(ensureToken).then(function(at){
    if(!at) throw new Error('no token');
    return fetch(BASE+'/rest/v1/rpc/'+name,{method:'POST',headers:hj(at),body:JSON.stringify(body||{})})
      .then(function(r){ return r.text().then(function(t){ if(!r.ok)throw new Error('rpc '+name+' '+r.status+' '+t); return t?JSON.parse(t):null; }); });
  });
}
/* 부팅: 개인 워크스페이스 보장 + 목록 로드 + 활성 워크스페이스 확정 */
function loadWorkspaces(){
  if(authPreparePromise)return authPreparePromise;
  if(!getSess()){setDataReady(false);return Promise.resolve([]);}
  var verified=null;
  var run=ensureSessionIdentity().then(function(s){
    verified=s;
    /* 이미 같은 uid로 봉인된 기기는 오프라인이어도 보여 준다.
       단, 다른 uid나 소유자 미상 캐시는 서버 확인 전에 열지 않는다. */
    var own=cacheOwner(),cur=activeWs();
    if(own&&String(own.uid)===String(s.uid)&&String(own.wid)===String(cur)&&wsList().some(function(w){return String(w.id)===String(cur);}))setDataReady(true,s.uid,cur);
    return rpc('ps_bootstrap',{p_email:s.email||null});
  }).then(function(rows){return prepareCacheForSession(verified,rows||[]);});
  authPreparePromise=run.then(function(v){authPreparePromise=null;try{expireStashes(7);}catch(_){}return v;},function(e){authPreparePromise=null;throw e;});   /* 2.669 — 부팅 때 7일 지난 전환 백업 정리 */
  return authPreparePromise;
}

function signIn(provider){
  /* 2.254 — 잠금 오버레이는 iframe 페이지(sync.js 로드되는 board·scout 등)에도 뜬다. 거기서 누르면 iframe 이
     카카오로 가고 콜백 토큰이 iframe 주소로 떨어진다 — 같은 origin 이면 top 창으로 올려서 연다. */
  var w=window; try{ if(window.top&&window.top!==window&&window.top.location.origin===location.origin)w=window.top; }catch(_){}
  var back=w.location.origin+w.location.pathname;
  w.location.href=BASE+'/auth/v1/authorize?provider='+encodeURIComponent(provider)+'&redirect_to='+encodeURIComponent(back);
}
/* 2.256 — 로그인 방법 연결(사용자 "뭘로 만들어도 들어갈 수 있게"): 지금 로그인한 계정에 카카오·Google
   아이덴티티를 둘 다 연결한다(Supabase manual identity linking). 연결되면 어느 쪽으로 로그인해도 같은 사용자
   = 같은 워크스페이스·팀. ⚠ 서버 준비물: Supabase 대시보드 → Authentication → 설정에서 Manual Linking ON.
   이미 다른 계정에 붙은 아이덴티티는 연결이 거부된다(그 계정의 팀은 초대 코드로 합류가 길). */
function linkIdentity(provider){
  var w=window; try{ if(window.top&&window.top!==window&&window.top.location.origin===location.origin)w=window.top; }catch(_){}
  var back=w.location.origin+w.location.pathname;
  ensureToken().then(function(at){
    if(!at)throw new Error('로그인이 필요합니다');
    return fetch(BASE+'/auth/v1/user/identities/authorize?provider='+encodeURIComponent(provider)+'&redirect_to='+encodeURIComponent(back)+'&skip_http_redirect=true',{headers:hj(at)});
  }).then(function(r){ return r.text().then(function(t){ var j=null; try{ j=JSON.parse(t); }catch(_){}
    if(r.ok&&j&&j.url){ w.location.href=j.url; return; }
    var raw=String((j&&(j.error_description||j.msg||j.message||j.error))||('연결 실패 '+r.status));
    var msg=raw;
    if(/already|exist/i.test(raw)) msg='이 '+(provider==='kakao'?'카카오':'Google')+' 로그인은 이미 다른 계정에 연결돼 있어요 — 그 계정의 팀에는 초대 코드로 합류하세요';
    else if(/disable|not.*enabl|manual/i.test(raw)) msg='서버에서 계정 연결이 꺼져 있어요 — Supabase 대시보드 › Authentication 에서 Manual Linking 을 켜 주세요';
    chip('연결 안 됨 — '+msg); setStatus(msg); syncDiagnostic('link-identity',new Error(raw.slice(0,80)));
  }); }).catch(function(e){ var m='연결 실패 — '+String(e&&e.message||e).slice(0,100); chip(m); setStatus(m); });
}
function signOut(){
  var s=getSess();
  if(s){ try{ fetch(BASE+'/auth/v1/logout',{method:'POST',headers:hj(s.at)}); }catch(_){} }
  /* 자료와 소유자 표식은 남긴다. 표시만 즉시 잠그며, 같은 uid로 다시 로그인해야 열린다.
     WSKEY를 지우면 다음 계정의 개인 공간에 이전 팀 캐시가 붙는 사고가 생긴다. */
  setSess(null); setStatus('로그아웃됨');
}
/* OAuth 콜백: 토큰이 URL 해시로 돌아옴 → 저장 후 해시 제거 */
function consumeHash(){
  try{
    /* 2.254 — 인증 실패 콜백(#error=...)은 지금까지 무음 폐기됐다("로그인이 안 돼요"의 원인 규명 불가).
       원인 한 줄을 남기고 잠금 오버레이가 보여 준다. */
    if(location.hash.indexOf('access_token=')<0&&/[#&]error(_description)?=/.test(location.hash)){
      var pe={}; location.hash.replace(/^#/,'').split('&').forEach(function(kv){ var i=kv.indexOf('='); if(i>0)pe[kv.slice(0,i)]=decodeURIComponent((kv.slice(i+1)||'').replace(/\+/g,' ')); });
      var msg='로그인 실패 — '+(pe.error_description||pe.error||'인증 서버 오류');
      try{ localStorage.setItem('ps_last_unlock_err',msg.slice(0,200)); }catch(_){}
      try{ history.replaceState(null,'',location.pathname+location.search); }catch(_){}
      setStatus(msg); try{ renderDataLock(dataUnlocked()); }catch(_){}
      return false;
    }
    if(location.hash.indexOf('access_token=')<0) return false;
    var p={}; location.hash.replace(/^#/,'').split('&').forEach(function(kv){ var i=kv.indexOf('='); if(i>0)p[kv.slice(0,i)]=decodeURIComponent(kv.slice(i+1)); });
    if(!p.access_token||!p.refresh_token) return false;
    var exp=Date.now()+(( +p.expires_in||3600)*1000);
    setSess({at:p.access_token,rt:p.refresh_token,exp:exp,email:'',uid:''});
    try{ history.replaceState(null,'',location.pathname+location.search); }catch(_){}
    fetch(BASE+'/auth/v1/user',{headers:hj(p.access_token)}).then(function(r){return r.ok?r.json():null;}).then(function(u){
      if(u&&u.id){ var s=getSess(); if(s){ s.uid=u.id; s.email=u.email||((u.user_metadata&&(u.user_metadata.email||u.user_metadata.name))||''); setSess(s); } }
    }).catch(function(e){syncDiagnostic('oauth-user-lookup',e);});
    return true;
  }catch(_){ return false; }
}
function ensureToken(){
  var s=getSess();
  if(!s) return Promise.resolve(null);
  if(Date.now()<s.exp-60000) return Promise.resolve(s.at);
  /* 여러 동기화 요청이 한꺼번에 들어와도 회전형 refresh token은 한 번만 사용한다. */
  if(refreshPromise) return refreshPromise;
  refreshPromise=fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:hj(),body:JSON.stringify({refresh_token:s.rt})})
    .then(function(r){
      if(r.ok) return r.json();
      return r.text().then(function(t){
        var e=new Error('token refresh '+r.status); e.status=r.status; e.body=t||''; throw e;
      });
    })
    .then(function(j){
      var ns={at:j.access_token,rt:j.refresh_token||s.rt,exp:Date.now()+((+j.expires_in||3600)*1000),email:s.email,uid:s.uid};
      if(j.user&&j.user.id){ ns.uid=j.user.id; ns.email=j.user.email||ns.email; }
      setSess(ns); syncErr=false; refreshRetryDelay=15000;
      if(refreshRetryTimer){ clearTimeout(refreshRetryTimer); refreshRetryTimer=null; }
      return ns.at;
    })
    .catch(function(e){
      /* 인증 서버가 토큰 자체를 거부한 경우에만 로그아웃한다.
         오프라인·타임아웃·5xx는 세션을 보존해 앱 재실행/온라인 복귀 때 다시 시도한다. */
      var rejected=!!(e&&(e.status===400||e.status===401||e.status===403));
      if(rejected){
        if(refreshRetryTimer){ clearTimeout(refreshRetryTimer); refreshRetryTimer=null; }
        /* 만료로 백업이 멈추는 순간 — 조용히 로그아웃하지 말고 셸 배너(expBanner)가 뜨도록 흔적을 남긴다.
           (실제 제보: 로그인했던 사용자의 자료가 서버에 없음 — 세션 만료 후 침묵이 원인) */
        try{ localStorage.setItem('ps_login_expired',String(Date.now())); }catch(_){}
        setSess(null); setStatus('로그인이 만료되었습니다');
        return null;
      }
      syncErr=true;
      setStatus(navigator.onLine===false?'오프라인 · 로그인 유지 중':'연결 복구 중…');
      try{renderUI();}catch(_){}
      if(!refreshRetryTimer){
        var wait=refreshRetryDelay; refreshRetryDelay=Math.min(refreshRetryDelay*2,120000);
        refreshRetryTimer=setTimeout(function(){
          refreshRetryTimer=null;
          if(getSess()&&navigator.onLine!==false) ensureToken().then(function(at){ if(at)syncNow('session-recover'); }).catch(function(e){syncDiagnostic('session-recover',e);});
        },wait);
      }
      throw e;
    })
    .then(function(v){ refreshPromise=null; return v; },function(e){ refreshPromise=null; throw e; });
  return refreshPromise;
}

/* ── 동기화 ── */
/* n = 키별 '지난번에 알던 항목 수' — 1.573 출고 검사의 기준(아래 pushHold). 옛 메타에는 없으므로 채워 준다. */
function meta(){ try{ var m=JSON.parse(localStorage.getItem(MKEY)||'null')||{h:{},c:{},last:0}; if(!m.n)m.n={}; return m; }catch(_){ return {h:{},c:{},last:0,n:{}}; } }
function setMeta(m){ try{ localStorage.setItem(MKEY,JSON.stringify(m)); }catch(_){} }
/* 이 키가 지금 몇 항목인지 기억해 둔다 — 다음 회차 출고 검사의 '전(前)' 값. 못 세는 값은 기억하지 않는다. */
function nSet(m,k,v){ try{ var n=psCount(v); if(n==null)delete m.n[k]; else m.n[k]=n; }catch(_){} }
function hash(s){ if(s==null)return ''; var h=5381,i=s.length; while(i)h=(h*33)^s.charCodeAt(--i); return String(h>>>0)+':'+s.length; }
/* ── 주간 일정 날짜 단위 병합 ──
   process_coach_v1 은 일정 전체가 키 하나라, 코치 둘이 서로 다른 요일을 고쳐도 문서 전체가 충돌했다.
   마지막 동기화본(base)을 이 기기에 남겨 두고, 충돌 시 날짜(칸) 단위 3-way 병합:
   한쪽만 바뀐 날은 그쪽을, 양쪽 다 바뀐 같은 날만 로컬(손에 든 기기) 승. */
/* 1.619 — 선수단·경기도 항목 단위로 병합한다.
   그전까지 이 둘은 **문서 통째 마지막 저장 승**이었다. 스태프 두 명이 같은 시간에 선수단을
   고치면 늦게 저장한 쪽이 이기고 먼저 저장한 쪽 작업은 통째로 사라졌다 — 경고도 없이.
   병합 대상 목록과 항목 id 는 아래 MERGE_LIST 에 적는다. */
/* ══ 1.628 · 항목 병합을 끈다 (사고 후 되돌림) ═══════════════════════════════
   2026-08-07 새벽, 이 병합이 **팀 선수단을 44명에서 76명으로 불렸다**(중복 29명).
   두 사본이 같은 선수를 **다른 id** 로 갖고 있으면 병합은 서로 다른 사람으로 보고 둘 다 남긴다.
   id 가 기기마다 새로 생기는 지금 구조(1.626 이 포지션에서 겪은 것과 같은 병)에서는
   '항목 단위 병합'이 안전하지 않다. 이름+등번호 같은 자연 열쇠로 겹침을 걸러야 하는데,
   그건 자료를 임의로 합치는 판단이라 급하게 넣을 일이 아니다.
   그래서 **일정만 남기고 되돌린다** — 일정은 날짜(칸) 라는 안정된 열쇠로 병합해 이 문제가 없다.
   선수단·명단·경기는 예전 규칙(충돌 시 이 기기 승, 서버본은 되돌리기용으로 보관)으로 돌아간다. */
var MERGE_KEYS={'process_coach_v1':1};
/* 2.340 — **전환 때 메타를 지우면 안 되는 키**. 이 둘은 pull 에 '병합 가드'가 있어서
   메타(마지막 확정 hash)가 없으면 병합 대신 **server-wins** 로 빠진다 — 아래 3.2 참조. */
var SWITCH_META_KEEP={'process_coach_v1':1,'cs_team_matches_v1':1};
var MERGE_LIST={};
var SCHEDULE_KEY='process_coach_v1';

/* base(마지막으로 동기화된 본) · 내 것 · 서버 것 셋을 항목 id 로 맞대어 병합한다.
   판단 규칙은 일정 병합과 같다:
     · 한쪽만 고친 항목  → 고친 쪽
     · 양쪽 다 고친 항목  → 손에 든 기기(로컬) 승
     · 한쪽에서 지운 항목 → 반대쪽이 그대로면 삭제를 존중, 반대쪽이 고쳤으면 살린다
   base 가 없으면(처음 만나는 키) 삭제를 판정할 수 없다 — 그때는 아무것도 지우지 않는다. */
function mergeByIdDoc(baseStr,locStr,srvStr,listKey,idKey){
  try{
    var b=baseStr?JSON.parse(baseStr):null, l=JSON.parse(locStr), s=JSON.parse(srvStr);
    if(!l||!s||!Array.isArray(l[listKey])||!Array.isArray(s[listKey])) return null;
    var hasBase=!!(b&&Array.isArray(b[listKey]));
    function idx(arr){ var o={}; (arr||[]).forEach(function(x){ var id=x&&x[idKey]; if(id!=null)o[String(id)]=JSON.stringify(x); }); return o; }
    var bi=hasBase?idx(b[listKey]):{}, li=idx(l[listKey]), si=idx(s[listKey]);
    /* 순서는 내 화면 기준으로 두고, 서버에만 있는 항목을 뒤에 붙인다 —
       명단 순서는 코치가 직접 맞춰 둔 것이라 함부로 흔들면 안 된다. */
    var order=[], seen={};
    (l[listKey]||[]).forEach(function(x){ var id=x&&x[idKey]; if(id!=null&&!seen[id]){seen[id]=1;order.push(String(id));} });
    (s[listKey]||[]).forEach(function(x){ var id=x&&x[idKey]; if(id!=null&&!seen[id]){seen[id]=1;order.push(String(id));} });
    var out=[];
    order.forEach(function(id){
      var L=li[id], S=si[id], B=bi[id];
      if(L&&!S){ if(hasBase&&B&&B===L) return;            /* 서버가 지웠고 나는 그대로 → 삭제 수용 */
                 out.push(JSON.parse(L)); return; }
      if(!L&&S){ if(hasBase&&B&&B===S) return;            /* 내가 지웠고 서버는 그대로 → 삭제 유지 */
                 out.push(JSON.parse(S)); return; }
      if(!L&&!S) return;
      if(L===S){ out.push(JSON.parse(S)); return; }
      if(B&&B===S){ out.push(JSON.parse(L)); return; }    /* 나만 고침 */
      if(B&&B===L){ out.push(JSON.parse(S)); return; }    /* 서버만 고침 */
      out.push(JSON.parse(L));                            /* 양쪽 다 고침 → 로컬 승 */
    });
    var doc=JSON.parse(srvStr);                           /* 목록 밖 값은 서버본 바탕 */
    Object.keys(l).forEach(function(kk){                  /* 단, 나만 바꾼 윗단 값은 내 것 */
      if(kk===listKey) return;
      var lv=JSON.stringify(l[kk]), sv=JSON.stringify(s[kk]), bv=b?JSON.stringify(b[kk]):undefined;
      if(lv!==sv && bv!==undefined && bv===sv) doc[kk]=l[kk];
    });
    doc[listKey]=out;
    return JSON.stringify(doc);
  }catch(_){ return null; }
}
/* 1.658 — 병합 base는 워크스페이스별 자료이면서 일정 원문 전체와 거의 같은 크기다.
   localStorage에 일정+base 두 벌을 두면 iPad의 약 5MB 한도가 곧 찬다. 화면은 base를
   직접 읽지 않으므로 IDB에 두고, 동기 호출부에는 미리 채운 메모리 값을 돌려준다. */
var syncBaseMem={};
function syncBaseKey(k){var wid='';try{wid=localStorage.getItem('ps_active_ws')||'';}catch(_){}return 'ps_sync_base_'+(wid?(wid+'_'):'')+k;}
function syncBaseOldKey(k){return 'ps_sync_base_'+k;}
function syncBaseCacheClear(){syncBaseMem={};}
function syncBaseGet(k){
  if(!MERGE_KEYS[k])return null;
  var key=syncBaseKey(k);
  if(Object.prototype.hasOwnProperty.call(syncBaseMem,key))return syncBaseMem[key];
  /* IDB가 없는 구형 브라우저만 동기 localStorage 폴백을 계속 쓴다. */
  try{return localStorage.getItem(key);}catch(_){return null;}
}
function syncBaseSet(k,v){
  if(!MERGE_KEYS[k])return Promise.resolve(true);
  var key=syncBaseKey(k),raw=v==null?null:String(v);syncBaseMem[key]=raw;
  try{localStorage.removeItem(syncBaseOldKey(k));}catch(_){}
  if(window.PSStorage&&PSStorage.auxSet){
    var p=PSStorage.auxSet(key,raw);
    /* IDB 실패 때 현재 탭의 기준본을 잃지는 않는다. 다만 PSStorage의 공유 장벽은
       실패를 그대로 기억해 다음 동기화·팀 전환이 안전 확인 없이 진행되지 않게 한다. */
    if(p&&p.catch)p.catch(function(e){
      try{if(raw==null)localStorage.removeItem(key);else localStorage.setItem(key,raw);}catch(_){}
      syncDiagnostic('sync-base-write',e);
    });
    return p;
  }
  try{if(raw==null)localStorage.removeItem(key);else localStorage.setItem(key,raw);return Promise.resolve(true);}
  catch(e){return Promise.reject(e);}
}
function syncBasePrimeAll(){
  var active=syncBaseKey(SCHEDULE_KEY),old=syncBaseOldKey(SCHEDULE_KEY),keys=[active];
  try{
    localStorage.removeItem(old);                 /* 출처를 모르는 1.641 이전 전역 기준본은 사용 금지 */
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);if(key&&key.indexOf('ps_sync_base_')===0&&key!==old&&keys.indexOf(key)<0)keys.push(key);
    }
  }catch(_){}
  if(!(window.PSStorage&&PSStorage.auxGet)){
    keys.forEach(function(k){try{syncBaseMem[k]=localStorage.getItem(k);}catch(_){syncBaseMem[k]=null;}});
    return Promise.resolve(true);
  }
  /* 현재 팀은 병합 전에 반드시 준비한다. 예전에 열었던 다른 팀 base도 함께 옮겨
     localStorage에 팀 수만큼 큰 문자열이 누적되지 않게 하되, 그 팀의 충돌은 현재 sync를 막지 않는다. */
  return Promise.all(keys.map(function(key){
    return PSStorage.auxGet(key).then(function(v){syncBaseMem[key]=v==null?null:String(v);return true;}).catch(function(e){
      var legacy=null;try{legacy=localStorage.getItem(key);}catch(_){}
      if(key!==active){syncDiagnostic('sync-base-prime-old-workspace',e);return false;}
      if(legacy!=null&&e&&e.name!=='StorageConflictError'){syncBaseMem[key]=legacy;return true;}
      throw e;
    });
  })).then(function(){return true;});
}
function syncBaseReady(){
  return (window.PSStorage&&PSStorage.auxReady)?PSStorage.auxReady():Promise.resolve(true);
}
function normalizeCoachDocument(raw){
  try{
    var doc=JSON.parse(raw);if(!doc||typeof doc.weeks!=='object')return null;
    var td=null;try{td=window.PSSchedule&&window.PSSchedule.mondayOf?window.PSSchedule.mondayOf():null;}catch(_){}
    if(!td){td=new Date();td.setHours(0,0,0,0);td.setDate(td.getDate()-((td.getDay()+6)%7));}
    var tam=td.getFullYear()+'-'+String(td.getMonth()+1).padStart(2,'0')+'-'+String(td.getDate()).padStart(2,'0');
    if(doc.anchorMonday===tam)return raw;
    var had=null,m=String(doc.anchorMonday||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m){had=new Date(+m[1],+m[2]-1,+m[3]);had.setHours(0,0,0,0);if(had.getDay()!==1)return null;}
    if(had){
      var delta=Math.round((td-had)/604800000),moved={};
      Object.keys(doc.weeks).forEach(function(k){var n=parseInt(k,10);moved[isNaN(n)?k:String(n-delta)]=doc.weeks[k];});
      doc.weeks=moved;
    }
    doc.anchorMonday=tam;
    return JSON.stringify(doc);
  }catch(_){return null;}
}
function scheduleRevOf(raw){
  try{var n=+(JSON.parse(raw||'null')||{}).scheduleRev;return Number.isFinite(n)&&n>=0?Math.floor(n):0;}catch(_){return 0;}
}
function scheduleWriteAllowed(){
  try{
    if(!isTeamWs())return true;
    var s=getSess(),w=activeWsObj();if(!s||!s.uid)return false;
    if(w&&w.role==='owner')return true;
    var p=JSON.parse(permsRaw()||'null');if(!p)return false;
    var me=p.members&&p.members[s.uid],role=(me&&me.role)||p.defaultRole||'player';
    return role==='admin'||role==='executive'||(role==='staff'&&p.schedEdit==='staff');
  }catch(_){return false;}
}
function scheduleTokenNew(){
  try{
    if(window.crypto&&crypto.getRandomValues){
      var a=new Uint8Array(16);crypto.getRandomValues(a);
      return Array.prototype.map.call(a,function(x){return x.toString(16).padStart(2,'0');}).join('');
    }
  }catch(_){}
  /* 토큰은 비밀이 아니라 판본의 고유 표식이다. 오래된 WebView의 최후 폴백도
     서버가 요구하는 16자 이상을 만족하고, 같은 밀리초의 두 저장을 구분한다. */
  return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
}
function scheduleTokenValid(v){return typeof v==='string'&&v.length>=16&&v.length<=128;}
/* scheduleRev는 로컬 저장 횟수가 아니라 서버 커밋 번호다. 마지막으로 확인한
   서버/base의 정확히 +1만 새 커밋으로 보내 SQL 트리거가 원자 CAS를 할 수 있게 한다. */
/* 2.587 — 서버 구조 검사(ps_1644_schedule_structure_ok)와 같은 규칙으로 **올리기 전에 수선**한다.
   실측(ps_kv_denied·ps_kv 2026-09-03): 두 워크스페이스의 일정 문서가 경기일 mid 가 **중복**돼(주 복제·달 복제·내 구성이 mid 까지 복사)
   구조 검사에서 떨어지고, 그때부터 그 팀의 모든 일정 저장이 «오래된 일정 판본…» 으로 거부됐다(한 곳은 오늘까지 반복).
   규칙: 경기일(match 가 참값·board.sched='경기' 등)은 비어 있지 않은 문자열 mid 가 있어야 하고, 문서 안 모든 mid 는 유일해야 한다.
   첫 것은 두고 뒤의 중복·빈 값만 새 id — 경기 연결(sched:<mid>)은 첫 날이 그대로 지킨다. */
var __schedMidSeq=0;
function scheduleNewMid(){ __schedMidSeq++; return 'm'+Date.now().toString(36)+__schedMidSeq.toString(36)+Math.random().toString(36).slice(2,7); }
function scheduleStructureRepair(doc){
  try{
    if(!doc||typeof doc.weeks!=='object'||!doc.weeks)return 0;
    var truthy=function(v){ if(v==null)return false; if(typeof v==='boolean')return v; if(typeof v==='number')return v!==0; if(typeof v==='string')return v!==''; return true; };
    var isMatch=function(d){ var b=(d&&d.board)||{}; return !!(d&&(truthy(d.match)||b.sched==='경기'||b.type==='경기'||b.kind==='match')); };
    var seen={},fixed=0;
    Object.keys(doc.weeks).sort(function(x,y){return (+x)-(+y);}).forEach(function(wk){
      var arr=doc.weeks[wk]; if(!Array.isArray(arr))return;
      arr.forEach(function(d){
        if(!d||typeof d!=='object')return;
        var mid=d.mid, ok=(typeof mid==='string'&&mid.trim()!=='');
        if('mid' in d&&mid!=null&&!ok){ delete d.mid; fixed++; ok=false; }
        if(ok&&seen[mid]){ if(isMatch(d)){ d.mid=scheduleNewMid(); seen[d.mid]=1; } else delete d.mid; fixed++; return; }
        if(ok){ seen[mid]=1; return; }
        if(isMatch(d)){ d.mid=scheduleNewMid(); seen[d.mid]=1; fixed++; }
      });
    });
    if(fixed){ try{ syncDiagnostic('schedule-structure-repair',{psCode:'fixed_'+fixed}); }catch(_){} }
    return fixed;
  }catch(_){ return 0; }
}
function scheduleCommitRaw(raw,confirmedRaw){
  try{
    var doc=JSON.parse(raw);if(!doc||typeof doc.weeks!=='object')return null;
    scheduleStructureRepair(doc);   /* 2.587 */
    var confirmed=null;try{confirmed=JSON.parse(confirmedRaw||'null');}catch(_){}
    var baseRev=scheduleRevOf(confirmedRaw);
    var baseToken=(confirmed&&scheduleTokenValid(confirmed.scheduleToken))?confirmed.scheduleToken:'';
    /* 응답만 잃은 동일 커밋은 같은 토큰·원문으로 다시 보내야 한다. 매 재시도마다
       토큰을 바꾸면 서버는 이미 받은 저장을 새 저장으로 오해한다. */
    var retry=doc.scheduleRev===baseRev+1&&doc.scheduleBaseRev===baseRev
      &&String(doc.scheduleBaseToken||'')===baseToken&&scheduleTokenValid(doc.scheduleToken)
      &&doc.scheduleToken!==baseToken;
    doc.scheduleRev=baseRev+1;
    /* 1.644 — rev+1만으로는 '서버를 방금 받고도 base 없이 낡은 기기를 승리'시키는
       오류를 서버가 구분하지 못한다. 이 커밋이 어느 확정 판본 위에서 나왔는지도 함께 보내고,
       서버 트리거가 OLD.rev와 다시 맞대어 구 앱의 덮어쓰기를 막는다. */
    doc.scheduleBaseRev=baseRev;
    doc.scheduleBaseToken=baseToken;
    doc.scheduleToken=retry?doc.scheduleToken:scheduleTokenNew();
    delete doc.wk;delete doc.dayIdx;
    return JSON.stringify(doc);
  }catch(_){return null;}
}
/* ══ 2.629 · 같은 날짜도 묻지 않고 합친다 ═══════════════════════════════════════
   사용자 "자꾸 묻는 게 별로 — 더 좋은 방법". 날짜 단위 3-way 에서 «둘 다 변경 → 로컬 승»이던 칸을 항목 단위로 내려가 합친다:
   한쪽만 고친 항목은 그대로 합쳐지고(예: 아이패드는 토요일 경기 시간, 데스크톱은 토요일 훈련 메모), 정말 같은 항목을 둘이 다르게
   고쳤을 때만 **나중에 저장한 쪽(editedAt)** 이 이긴다. 진 쪽 기기에는 «아이패드가 토요일 경기를 먼저 바꿨어요 · 내 것으로 되돌리기» 한 줄(24시간).
   묻는 화면은 없다. 배열은 id 가 있으면 id 로, 없고 길이가 같으면 자리로, 아니면 이긴 쪽 통째. */
function deepMerge3(b,l,s,preferLocal,path,conf){
  var lj=JSON.stringify(l===undefined?null:l), sj=JSON.stringify(s===undefined?null:s), bj=(b===undefined)?null:JSON.stringify(b===undefined?null:b);
  if(lj===sj)return l;
  if(bj!=null&&sj===bj)return l;          /* 로컬만 변경 */
  if(bj!=null&&lj===bj)return s;          /* 서버만 변경 */
  var lo=l&&typeof l==='object', so=s&&typeof s==='object';
  if(lo&&so&&Array.isArray(l)===Array.isArray(s)){
    if(Array.isArray(l)){
      var hasId=l.length&&s.length&&l.every(function(x){return x&&typeof x==='object'&&x.id!=null;})&&s.every(function(x){return x&&typeof x==='object'&&x.id!=null;});
      if(hasId){
        var bi={}; (Array.isArray(b)?b:[]).forEach(function(x){ if(x&&x.id!=null)bi[x.id]=x; });
        var li={}, si={}; l.forEach(function(x){li[x.id]=x;}); s.forEach(function(x){si[x.id]=x;});
        var order=(preferLocal?l:s).map(function(x){return x.id;}); (preferLocal?s:l).forEach(function(x){ if(order.indexOf(x.id)<0)order.push(x.id); });
        var out=[]; order.forEach(function(id){
          var inL=Object.prototype.hasOwnProperty.call(li,id), inS=Object.prototype.hasOwnProperty.call(si,id), inB=Object.prototype.hasOwnProperty.call(bi,id);
          if(inL&&inS)out.push(deepMerge3(bi[id],li[id],si[id],preferLocal,path+'['+id+']',conf));
          else if(inL&&!inS){ if(inB&&JSON.stringify(li[id])===JSON.stringify(bi[id]))return; out.push(li[id]); }   /* 서버가 지웠고 나는 안 고침 → 지움 */
          else if(!inL&&inS){ if(inB&&JSON.stringify(si[id])===JSON.stringify(bi[id]))return; out.push(si[id]); }   /* 내가 지웠고 서버는 안 고침 → 지움 */
        });
        return out;
      }
      if(l.length===s.length){ var arr=[]; for(var i=0;i<l.length;i++)arr.push(deepMerge3(Array.isArray(b)?b[i]:undefined,l[i],s[i],preferLocal,path+'['+i+']',conf)); return arr; }
      if(conf)conf.push({path:path,mine:l,theirs:s,winner:preferLocal?'l':'s'});
      return preferLocal?l:s;
    }
    var keys={}; Object.keys(l).forEach(function(k){keys[k]=1;}); Object.keys(s).forEach(function(k){keys[k]=1;});
    var o={}; Object.keys(keys).forEach(function(k){
      var v=deepMerge3(b&&typeof b==='object'&&!Array.isArray(b)?b[k]:undefined,l[k],s[k],preferLocal,path+'.'+k,conf);
      if(v!==undefined)o[k]=v;
    });
    return o;
  }
  if(conf)conf.push({path:path,mine:l,theirs:s,winner:preferLocal?'l':'s'});
  return preferLocal?l:s;                  /* 같은 잎을 둘이 다르게 → 나중에 저장한 쪽 */
}
var MERGE_NOTE='ps_merge_note_v1', MERGE_NOTE_TTL=24*3600*1000;
function mergeNoteList(){ try{ return (JSON.parse(localStorage.getItem(MERGE_NOTE)||'[]')||[]).filter(function(x){ return x&&(Date.now()-(+x.at||0))<MERGE_NOTE_TTL; }); }catch(_){ return []; } }
function mergeNoteSet(a){ try{ localStorage.setItem(MERGE_NOTE,JSON.stringify(a.slice(-8))); }catch(_){} }
function mergeNoteDismiss(id){ mergeNoteSet(mergeNoteList().filter(function(x){ return x.id!==id; })); try{ window.dispatchEvent(new CustomEvent('ps-sync-state')); }catch(_){} }
/* 진 항목(내 것이 밀린 것)만 기억한다 — 되돌리기용 «내 값» 포함(잎이라 작다) */
function mergeNoteAdd(k,ymd,conf,by){
  var lost=(conf||[]).filter(function(c){ return c.winner==='s'; }); if(!lost.length)return;
  var a=mergeNoteList();
  lost.slice(0,4).forEach(function(c){
    var mine=JSON.stringify(c.mine===undefined?null:c.mine); if(mine.length>60000)mine=null;
    a.push({id:'mn'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),k:k,ymd:ymd,path:c.path,mine:mine,at:Date.now(),by:by||''});
  });
  mergeNoteSet(a);
  try{ window.dispatchEvent(new CustomEvent('ps-sync-state')); }catch(_){}
}
function pathSet(root,path,val){   /* 'w-3.5.match.opp' 또는 '…trainings[abc].name' 형태의 경로에 값을 놓는다(첫 조각 wK.D 는 weeks[K][D]) */
  var segs=[]; String(path).replace(/\[([^\]]+)\]|\.?([^.\[\]]+)/g,function(_,id,key){ segs.push(id!=null?{id:id}:key); return ''; });
  var first=segs.shift(); if(typeof first!=='string'||first.charAt(0)!=='w')return false;
  var wk=first.slice(1), di=segs.shift(); if(!root.weeks||!root.weeks[wk]||!root.weeks[wk][di])return false;
  var cur=root.weeks[wk][di];
  for(var i=0;i<segs.length-1;i++){ var sg=segs[i]; if(typeof sg==='string'){ if(cur[sg]==null||typeof cur[sg]!=='object')cur[sg]={}; cur=cur[sg]; } else { var idx=-1; (Array.isArray(cur)?cur:[]).some(function(x,j){ if(x&&String(x.id)===String(sg.id)){idx=j;return true;} }); if(idx<0)return false; cur=cur[idx]; } }
  var last=segs[segs.length-1]; if(last===undefined)return false;
  if(typeof last==='string'){ if(val===undefined)delete cur[last]; else cur[last]=val; return true; }
  var j2=-1; (Array.isArray(cur)?cur:[]).some(function(x,j){ if(x&&String(x.id)===String(last.id)){j2=j;return true;} }); if(j2<0){ if(val!==undefined&&Array.isArray(cur))cur.push(val); return val!==undefined; } if(val===undefined)cur.splice(j2,1); else cur[j2]=val; return true;
}
/* «내 것으로» — 그 잎을 내 값으로 되돌려 다시 올린다(묻지 않는다) */
function mergeNoteRevert(id){
  if(!dataUnlocked())return Promise.resolve(false);
  var n=mergeNoteList().filter(function(x){return x.id===id;})[0]; if(!n||n.mine==null)return Promise.resolve(false);
  return holdLocal(n.k).then(function(raw){
    if(raw==null)return false;
    var doc=null; try{ doc=JSON.parse(raw); }catch(_){ return false; }
    /* 주 키는 병합 시점의 앵커 기준이라 지금 문서의 앵커와 다를 수 있다 → ymd 로 다시 찾는다 */
    var m=String(doc.anchorMonday||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m)return false;
    var am=new Date(+m[1],+m[2]-1,+m[3]), d=String(n.ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!d)return false;
    var dd=new Date(+d[1],+d[2]-1,+d[3]), off=Math.round((dd-am)/864e5), wk=Math.floor(off/7), di=((off%7)+7)%7;
    var rest=String(n.path).replace(/^w-?\d+\.\d+/,''); var path='w'+wk+'.'+di+rest;
    if(!pathSet(doc,path,JSON.parse(n.mine)))return false;
    doc.editedAt=Date.now();
    var v=JSON.stringify(doc), writes=[]; try{ var mt=meta(); delete mt.h[n.k]; setMeta(mt); }catch(_){}
    var ok=kvWrite(n.k,v,writes);
    return Promise.all(writes).catch(function(){}).then(function(){ if(!ok)return false; mergeNoteDismiss(id); try{ syncNow('merge-revert'); }catch(_){} return true; });
  });
}
function mergeCoachWeeks(baseStr,locStr,srvStr){
  try{
    var b=baseStr?JSON.parse(baseStr):null,l=JSON.parse(locStr),s=JSON.parse(srvStr);
    if(!l||!s||typeof l.weeks!=='object'||typeof s.weeks!=='object')return null;
    /* 1.499 — 앵커(기준 월요일)가 다른 두 본을 주차 숫자 그대로 섞으면 일정이 통째로 밀린다(2주 밀림 사고).
       병합 전에 세 본을 가장 늦은 앵커 기준으로 주차 키를 평행이동해 정규화한다. */
    (function(){
      function pAM(x){var m=x&&String(x.anchorMonday||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;var d=new Date(+m[1],+m[2]-1,+m[3]);return d.getDay()===1?d.getTime():null;}
      function shiftWeeks(x,dw){if(!dw||!x||typeof x.weeks!=='object')return;var mv={};Object.keys(x.weeks).forEach(function(k){var n=parseInt(k,10);if(isNaN(n))mv[k]=x.weeks[k];else mv[String(n-dw)]=x.weeks[k];});x.weeks=mv;}
      var WEEK=6048e5;
      var la=pAM(l),sa=pAM(s),ba=pAM(b);
      /* 세 판본 중 '가장 느린 anchor'를 쓰면 미래/오염 anchor 하나가 전체 일정을
         끌고 간다. 기준은 오늘이 속한 실제 월요일 하나다. */
      var td=null;try{td=window.PSSchedule&&window.PSSchedule.mondayOf?window.PSSchedule.mondayOf():null;}catch(_){}
      if(!td){td=new Date();td.setHours(0,0,0,0);td.setDate(td.getDate()-((td.getDay()+6)%7));}
      var target=td.getTime();var tam=td.getFullYear()+"-"+String(td.getMonth()+1).padStart(2,"0")+"-"+String(td.getDate()).padStart(2,"0");
      if(la&&la!==target){shiftWeeks(l,Math.round((target-la)/WEEK));} l.anchorMonday=tam;
      if(sa&&sa!==target){shiftWeeks(s,Math.round((target-sa)/WEEK));} s.anchorMonday=tam;
      if(b&&ba&&ba!==target){shiftWeeks(b,Math.round((target-ba)/WEEK));}
      /* 정규화 후 srvStr 재직렬화 — out이 서버본 바탕이므로 */
      srvStr=JSON.stringify(s);
    })();
    var bw=(b&&b.weeks)||{};
    var out=JSON.parse(srvStr);   /* 서버본 바탕 */
    var preferLocal=(+l.editedAt||0)>=(+s.editedAt||0), conf=[], _am=String(l.anchorMonday||'').match(/^(\d{4})-(\d{2})-(\d{2})$/), tamD=_am?new Date(+_am[1],+_am[2]-1,+_am[3]):new Date();   /* 2.629 — 정규화된 기준 월요일 */
    var wks={};Object.keys(l.weeks).forEach(function(k){wks[k]=1});Object.keys(s.weeks).forEach(function(k){wks[k]=1});
    Object.keys(wks).forEach(function(k){
      var lw=l.weeks[k],sw=s.weeks[k],bwk=bw[k];
      if(!lw)return;                              /* 로컬에 없는 주 → 서버 유지 */
      if(!sw){out.weeks[k]=lw;return}             /* 서버에 없는 주 → 로컬 채택 */
      for(var di=0;di<7;di++){
        var ld=JSON.stringify(lw[di]===undefined?null:lw[di]),
            sd=JSON.stringify(sw[di]===undefined?null:sw[di]),
            bd=bwk?JSON.stringify(bwk[di]===undefined?null:bwk[di]):null;
        if(ld===sd)continue;
        if(bd!=null&&sd===bd){out.weeks[k][di]=lw[di];continue}  /* 로컬만 변경 */
        if(bd!=null&&ld===bd)continue;                            /* 서버만 변경 */
        /* 2.629 — 둘 다 변경: 항목 단위로 내려가 합친다. 같은 잎만 나중 저장이 이긴다 */
        var dconf=[]; out.weeks[k][di]=deepMerge3(bwk?bwk[di]:undefined,lw[di],sw[di],preferLocal,'w'+k+'.'+di,dconf);
        if(dconf.length){ var dt=new Date(tamD); dt.setDate(dt.getDate()+(+k)*7+di); var ymd=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); dconf.forEach(function(c){ c.ymd=ymd; }); conf=conf.concat(dconf); }
      }
    });
    /* weeks 밖 최상위 필드도 같은 규칙 */
    Object.keys(l).forEach(function(f){
      if(f==='weeks'||f==='wk'||f==='dayIdx'||f==='scheduleRev'||f==='scheduleBaseRev'||f==='scheduleToken'||f==='scheduleBaseToken')return; /* 보기 커서·서버 계보는 병합 내용이 아님 */
      var lv=JSON.stringify(l[f]===undefined?null:l[f]),
          sv=JSON.stringify(s[f]===undefined?null:s[f]),
          bv=b?JSON.stringify(b[f]===undefined?null:b[f]):null;
      if(lv===sv)return;
      if(bv!=null&&lv===bv)return;
      out[f]=l[f];
    });
    /* 병합본의 수정 시각은 두 판본 중 느린 쪽이어야 수신 화면이 '내 저장보다
       오래된 판'으로 오해하지 않는다. */
    var lat=+l.editedAt||0,sat=+s.editedAt||0;
    if(lat||sat){out.editedAt=Math.max(lat,sat);out.editedBy=(sat>lat?s.editedBy:l.editedBy)||out.editedBy||'';}
    try{ if(conf.length){ var byY={}; conf.forEach(function(c){ (byY[c.ymd]=byY[c.ymd]||[]).push(c); }); Object.keys(byY).forEach(function(y){ mergeNoteAdd(SCHEDULE_KEY,y,byY[y],s.editedBy||''); }); } }catch(_){}
    delete out.wk;delete out.dayIdx;
    /* rev·token은 scheduleCommitRaw가 방금 확인한 서버 원문 위에서 한 번만 붙인다. */
    delete out.scheduleRev;delete out.scheduleBaseRev;delete out.scheduleToken;delete out.scheduleBaseToken;
    return JSON.stringify(out);
  }catch(_){return null}
}
function pJSON(s,fb){ try{ var v=JSON.parse(s); return v==null?fb:v; }catch(_){ return fb; } }

/* ══ 영구 동기화 대기함 ═══════════════════════════════════════════════════════
   콘텐츠 본문은 기존 로컬 저장소에 그대로 두고, "어느 워크스페이스의 어떤 키가 아직
   서버 확인을 못 받았는지"만 IndexedDB에 보존한다. 브라우저가 닫히거나 네트워크가
   오래 끊겨도 성공 확인 전에는 항목을 지우지 않는다. */
var OUTBOXKEY='ps_sync_outbox_v1', OUTBOXSUM='ps_sync_pending_summary_v1';
var outboxLock=Promise.resolve(), pendingSummary=(function(){
  try{ return JSON.parse(localStorage.getItem(OUTBOXSUM)||'null')||{total:0,by:{}}; }catch(_){ return {total:0,by:{}}; }
})();
function outboxOwner(){ var s=getSess(); return (s&&s.uid)||'@'; }
function outboxScope(uid,wid){ return String(uid||'@')+'|'+String(wid||''); }
function outboxNormalizePersonal(q){
  var uid=outboxOwner(),pwid=personalWid();
  if(!pwid)return q||[];
  var by={};
  (q||[]).forEach(function(src){
    if(!src||!src.id)return;
    var it=src;
    if(String(it.uid)===String(uid)&&PERSONAL[it.key]&&String(it.wid)!==String(pwid)){
      it=Object.assign({},it,{wid:pwid,id:outboxScope(uid,pwid)+'|'+it.key});
    }
    if(!by[it.id]||(+it.updatedAt||+it.at||0)>(+by[it.id].updatedAt||+by[it.id].at||0))by[it.id]=it;
  });
  return Object.keys(by).map(function(k){return by[k];});
}
function outboxRead(){
  var local=[];
  try{local=pJSON(localStorage.getItem(OUTBOXKEY),[]);if(!Array.isArray(local))local=[];}catch(_){local=[];}
  if(!window.storage)return Promise.resolve(outboxNormalizePersonal(local));
  return window.storage.get(OUTBOXKEY).then(function(r){
    var idb=pJSON(r&&r.value,[]);if(!Array.isArray(idb))idb=[];
    /* 어느 한 저장소만 최신이어도 잃지 않도록 id 기준으로 합치고, 수정 시각이 큰 쪽을 택한다. */
    var by={};
    idb.concat(local).forEach(function(it){
      if(!it||!it.id)return;
      if(!by[it.id]||(+it.updatedAt||+it.at||0)>(+by[it.id].updatedAt||+by[it.id].at||0))by[it.id]=it;
    });
    return outboxNormalizePersonal(Object.keys(by).map(function(k){return by[k];}));
  }).catch(function(){return outboxNormalizePersonal(local);});
}
function outboxUpdateSummary(q){
  var by={},cut=Date.now()-30*86400000;
  (q||[]).forEach(function(it){
    if(!it||!it.wid||(+it.updatedAt||+it.at||0)<cut)return;
    var sc=outboxScope(it.uid,it.wid),b=by[sc]||(by[sc]={count:0,oldest:0});
    b.count++;var a=+it.at||+it.updatedAt||Date.now();if(!b.oldest||a<b.oldest)b.oldest=a;
  });
  pendingSummary={total:(q||[]).length,by:by,updatedAt:Date.now()};
  try{localStorage.setItem(OUTBOXSUM,JSON.stringify(pendingSummary));}catch(_){}
  try{renderUI();}catch(_){}
}
function outboxWrite(q){
  var cut=Date.now()-30*86400000;
  q=(q||[]).filter(function(it){return it&&it.wid&&(+it.updatedAt||+it.at||0)>=cut;}).slice(-500);
  var raw=JSON.stringify(q),localOk=false;
  try{localStorage.setItem(OUTBOXKEY,raw);localOk=localStorage.getItem(OUTBOXKEY)===raw;}catch(_){}
  var idb=window.storage
    ?window.storage.set(OUTBOXKEY,raw).then(function(){return true;}).catch(function(){return false;})
    :Promise.resolve(false);
  return idb.then(function(idbOk){
    if(!localOk&&!idbOk)throw syncIssue('sync_storage','outbox','pending queue write failed');
    outboxUpdateSummary(q);return q;
  });
}
function outboxTxn(fn){
  outboxLock=outboxLock.catch(function(e){syncDiagnostic('outbox-lock-recover',e);}).then(outboxRead).then(function(q){
    return Promise.resolve(fn(q||[])).then(outboxWrite);
  });
  return outboxLock;
}
function pendingInfo(wid){
  var sc=outboxScope(outboxOwner(),wid),b=(pendingSummary.by||{})[sc]||{};
  return {count:+b.count||0,oldest:+b.oldest||0};
}
function outboxMark(wid,key,h,source){
  if(!wid||!key)return Promise.resolve();
  var uid=outboxOwner(),id=outboxScope(uid,wid)+'|'+key,now=Date.now();
  return outboxTxn(function(q){
    var it=null;
    q.forEach(function(x){if(x&&x.id===id)it=x;});
    if(!it){it={id:id,uid:uid,wid:wid,key:key,at:now,attempts:0};q.push(it);}
    it.hash=h||'';it.updatedAt=now;it.source=String(source||'edit').slice(0,24);
    return q;
  });
}
function currentValueForKey(k){
  if(k==='@library'){
    var rv=null;try{rv=localStorage.getItem('cs_lib_rev');}catch(_){}
    return Promise.resolve(rv);
  }
  /* 일정 화면은 localStorage 거울을 먼저 바꾼다. IDB commit 직전의 짧은 틈에
     outbox가 옛 IDB를 집지 않게 거울의 최신 raw를 쓴다. */
  if(k===SCHEDULE_KEY){var sv=null;try{sv=localStorage.getItem(k);}catch(_){}if(sv!=null)return Promise.resolve(sv);}
  if(idbBacked(k)) return window.storage.get(k).then(function(r){return r?r.value:null;});
  var v=null;try{v=localStorage.getItem(k);}catch(_){}
  return Promise.resolve(v);
}
function outboxMarkCurrent(wid,key,source){
  return currentValueForKey(key).then(function(v){return outboxMark(wid,key,hash(v),source);});
}
function outboxMarkRows(wid,rows,m){
  if(!rows||!rows.length)return Promise.resolve();
  return Promise.all(rows.map(function(r){return outboxMark(wid,r.k,(m.h&&m.h[r.k])||hash(r.v),'sync');}));
}
/* ══ 2.445 · **회차 실패는 항목 실패가 아니다** ══════════════════════════════
   실제 제보(2026-08-28): 대기 6건이 전부 `kv_meta:sync_network ×5` 로 찍히고 전환이 막혔다.
   ⚠⚠ `kv_meta` 는 회차의 **첫 pull**(3210)이라 여기서 죽으면 **push 는 단 한 번도 실행되지 않는다.**
      그런데 예전 이 함수는 그 실패를 범위 안 **모든** 대기 항목에 attempts+1·lastError 로 찍었다.
      그래서 화면이 "이 항목에 오류가 5번 반복됐다"고 **거짓말**했고, 사용자는 고칠 항목을 찾았지만
      고칠 항목이 애초에 없었다 — 끊긴 것은 네트워크였다.
   → push 단계에서 난 실패만 항목의 실패(attempts·lastError)로 적는다.
     그 밖(첫 pull·인증·권한)에서 죽은 회차는 **회차 실패**(roundFails·roundError)로 따로 적는다.
   ⚠ attempts 는 **표시 전용**이다(4137·5097·5098 뿐 — 재시도 간격에 안 쓰인다).
      그래서 의미를 바로잡아도 재시도 동작은 그대로다. */
/* ⚠ 목록이 아니라 **접두사**로 본다 — push 는 파생 단계를 만든다:
   `kvPushRows` 의 CAS 경로가 `label+'_cas'`(1670·1671·1672)로 던지므로
   `kv_push_cas`·`personal_push_cas` 같은 단계가 실제로 나온다.
   목록으로 두면 그것들이 '회차 실패'로 잘못 분류돼, 진짜 항목 충돌이 출구를 열어 버린다. */
var PUSH_STAGE_RE=/^(?:kv_push|personal_push|library_push|library_insert)(?:_|$)/;
function outboxFail(wid,info){
  var uid=outboxOwner(),sc=outboxScope(uid,wid),now=Date.now();
  var pushed=PUSH_STAGE_RE.test(String((info&&info.stage)||''));
  return outboxTxn(function(q){q.forEach(function(it){
    if(!it||outboxScope(it.uid,it.wid)!==sc)return;
    it.lastAttempt=now;
    if(pushed){ it.attempts=(+it.attempts||0)+1; it.lastError=info.code; it.lastStage=info.stage; }
    else { it.roundFails=(+it.roundFails||0)+1; it.roundError=info.code; it.roundStage=info.stage; }
  });return q;}).catch(function(e){syncDiagnostic('outbox-failure-mark',e);});
}
/* 이 대기가 **서버에 닿지 못해서** 남아 있는가(항목 자체의 문제가 아니라).
   전환 차단 문구와 탈출구 판정에 쓴다 — 항목을 고쳐서 풀 수 있는 문제와 구분해야 한다. */
var UNREACHABLE={sync_network:1,sync_offline:1,sync_timeout:1,sync_server:1,sync_rate_limit:1};
function outboxUnreachableOnly(it){
  if(!it)return false;
  if(+it.attempts>0)return !!UNREACHABLE[String(it.lastError||'')];   /* push 를 해 봤다면 그 결과로 판정 */
  return !!it.roundError&&!!UNREACHABLE[String(it.roundError||'')];   /* 아예 못 올라간 경우 */
}
function outboxAckSynced(wid,m,skipped,libraryAckHash){
  var uid=outboxOwner(),sc=outboxScope(uid,wid),skip={};
  (skipped||[]).forEach(function(k){skip[k]=1;});
  return outboxTxn(function(q){
    return Promise.all(q.map(function(it){
      if(!it||outboxScope(it.uid,it.wid)!==sc||skip[it.key])return Promise.resolve(true);
      return currentValueForKey(it.key).then(function(v){
        if(it.key==='@library'){
          /* 보관함 pull/충돌 정리가 libSave를 호출하면 cs_lib_rev는 이 회차 안에서 바뀐다.
             예전 outbox hash와만 비교하면 성공한 정리가 영원히 '1건 대기'로 남는다.
             syncLibrary가 돌려 준 정확한 post-save hash를 확인값으로 쓰되, 그 뒤 사용자가
             다시 편집해 revision이 달라졌다면 그대로 대기시킨다. */
          var confirmed=libraryAckHash==null?it.hash:libraryAckHash;
          return hash(v)!==confirmed;
        }
        return !m.h||hash(v)!==m.h[it.key];              /* 현재 로컬과 확인된 해시가 다르면 유지 */
      }).catch(function(){return true;});
    })).then(function(keep){return q.filter(function(_,i){return keep[i];});});
  });
}
/* 개인 자료는 팀 화면에서도 개인 워크스페이스로 동기화된다. 예전에는 storage
   이벤트가 이 변경을 현재 팀 wid의 대기함에 넣어, syncPersonal이 성공해도 m.h가
   아니라 m.p.h에만 확정값이 남으므로 대기 숫자가 영원히 사라지지 않았다.
   새 개인 scope와 이미 잘못 들어간 현재 팀 scope를 모두 같은 확정 hash로 정리한다. */
function outboxAckPersonal(pwid,m){
  var uid=outboxOwner(),teamWid=isTeamWs()?activeWs():'',confirmed=(m&&m.p&&m.p.h)||{};
  if(!pwid)return Promise.resolve();
  return outboxTxn(function(q){
    return Promise.all(q.map(function(it){
      if(!it||String(it.uid)!==String(uid)||!PERSONAL[it.key])return Promise.resolve(true);
      if(String(it.wid)!==String(pwid)&&(!teamWid||String(it.wid)!==String(teamWid)))return Promise.resolve(true);
      return currentValueForKey(it.key).then(function(v){return hash(v)!==confirmed[it.key];}).catch(function(){return true;});
    })).then(function(keep){return q.filter(function(_,i){return keep[i];});});
  });
}
/* 워크스페이스를 바꿀 때 실제로 지워질 자료만 센다. PERSONAL 키는 어느 공간을
   보든 같은 기기에 그대로 남고 개인 채널로 전송되므로, 그 대기만으로 팀 전환을
   막는 것은 데이터 보호가 아니라 영구 잠금이었다. 보관함·일정·팀 자료는 그대로 센다. */
function workspaceBlockingPendingKeys(wid){
  var uid=outboxOwner(),sc=outboxScope(uid,wid);
  /* ══ 2.434 · **이 계정이 영원히 확정을 만들 수 없는 대기**는 전환을 막지 않는다 ══════
     실제 제보: 전환이 '평가 항목·IDP×3·선수단·경기 준비·리뷰 — 아직 시도 전' 으로 영구히 막혔다.
     attempts=0 이 영원히 남는 길은 둘뿐이고, 둘 다 **이 기기가 절대 push 할 수 없는** 키다:
       ① 남의 선수 IDP(cs_idp_v1_<남uid>) — 정책상 pull 전용(3426 '내 것만 push')이고,
          전환하면 어차피 로컬에서 정리되는 키다(4137). 지킬 대상 자체가 없다.
       ② 권한으로 거부된 키 — canW(3623)가 push 에서 조용히 걸러(1.634 스태프 기본 보기 전용),
          실패도 확정도 안 나 attempts=0 대기가 영원히 남는다(ps_sync_denied_map_v1 에 기록됨).
     둘을 막는 것은 PERSONAL 때와 똑같이 "데이터 보호가 아니라 영구 잠금"이다(위 1.649 주석).
     ⚠ 로컬 값은 지우지 않으며 전환 전 stash 백업(preswitch)이 그대로 담는다.
     ⚠ 권한 맵은 permsMissing 회차에는 기록되지 않으므로, 일시적 권한 읽기 실패로
        문이 열리는 일은 없다 — 그때는 맵이 비어 예전처럼 fail-closed 다. */
  var deniedMap={}; try{ deniedMap=JSON.parse(localStorage.getItem('ps_sync_denied_map_v1')||'{}')||{}; }catch(_){}
  var myIdp='cs_idp_v1_'+uid;
  return outboxRead().then(function(q){
    var seen={},keys=[];
    (q||[]).forEach(function(it){
      if(!it||outboxScope(it.uid,it.wid)!==sc||PERSONAL[it.key]||seen[it.key])return;
      /* ① — 내 IDP 만 막는다. 남의 것(pull 전용, 3426)도, local(동기화 자체 제외, 3427)도
         이 기기가 확정을 만들 수 없는 키라 세면 영구 잠금이다. */
      if(it.key&&it.key.indexOf('cs_idp_v1_')===0&&it.key!==myIdp)return;
      if(deniedMap[it.key])return;                                                                       /* ② */
      seen[it.key]=1;keys.push(it.key);
    });
    return keys;
  });
}
function workspaceBlockingPending(wid){
  return workspaceBlockingPendingKeys(wid).then(function(keys){return keys.length;});
}

/* 실제 동기화 요청은 20초 안에 끝나지 않으면 중단한다. 브라우저의 "온라인" 표시는
   인터넷 도달 가능성을 보장하지 않으므로 오류 원인은 별도로 분류한다. */
function syncIssue(code,stage,msg,status){
  var e=new Error(msg||code);e.psCode=code;e.psStage=stage||'sync';e.psStatus=status||0;return e;
}
function syncFetch(stage,url,opts){
  if(navigator.onLine===false)return Promise.reject(syncIssue('sync_offline',stage,'offline'));
  var ctl=null,to=null,o=opts||{};
  /* 2.600 — 본문을 나르는 단계(kv_pull·kv_push·personal_pull·library_body)는 45초, 메타·프로브는 20초. 실측 30일 sync_timeout 752건·72명 — 일정 문서 1~3MB 를 20초 안에 못 받는 기기가 있다 */
  var _ms=/^(kv_pull|kv_push|personal_push|personal_pull|library_body|library_push|bulk)/.test(String(stage||''))?45000:20000;
  try{if(typeof AbortController!=='undefined'){ctl=new AbortController();o=Object.assign({},o,{signal:ctl.signal});to=setTimeout(function(){ctl.abort();},_ms);}}catch(_){}
  return fetch(url,o).then(function(r){if(to)clearTimeout(to);return r;},function(e){
    if(to)clearTimeout(to);
    if(e&&e.name==='AbortError')throw syncIssue('sync_timeout',stage,'timeout');
    try{e.psStage=stage;}catch(_){}
    throw e;
  });
}
function syncHttpError(stage,status){
  var code=status===401?'sync_auth':status===403?'sync_permission':status===429?'sync_rate_limit':
    status>=500?'sync_server':'sync_http_'+status;
  return syncIssue(code,stage,'http '+status,status);
}
/* 2.445 — 오류 코드를 사람이 읽을 말로. 화면에 코드를 그대로 흘리면 사용자는 무엇을 확인할지 모른다. */
function syncCodeText(code){   /* 2.625 — 사람 쪽 말로. 첫 줄은 상태, 둘째는 이유, 버튼은 다음 할 일(목업 «말 바꾸기» 표) */
  return code==='sync_network'?'인터넷을 확인해 주세요'
    :code==='sync_offline'?'오프라인이에요'
    :code==='sync_timeout'?'서버가 느려요 · 잠시 뒤 다시'
    :code==='sync_server'?'서버 오류예요 · 잠시 뒤 다시'
    :code==='sync_auth'?'다시 로그인해 주세요'
    :code==='sync_permission'?'이 자료를 고칠 권한이 없어요'
    :code==='sync_rate_limit'?'요청이 많아요 · 잠시 뒤 다시'
    :code==='sync_storage'?'이 기기 저장소를 읽지 못했어요'
    :String(code||'원인을 확인해 주세요');
}
/* 2.625 — 이유는 넷뿐: 인터넷 · 로그인 · 권한 · 저장소. 상태 한 줄 셋째 줄에 쓴다 */
function syncReasonText(code){
  return code==='sync_server_rejected'||code==='sync_conflict'?'팀 것이 더 새로워요 · 다시 맞추는 중'   /* 2.630 — 거부는 인터넷 탓이 아니다 */
    :code==='sync_auth'?'다시 로그인해 주세요'
    :code==='sync_permission'?'이 자료를 고칠 권한이 없어요'
    :code==='sync_storage'?'이 기기 저장소를 읽지 못했어요'
    :code==='sync_offline'?'오프라인이에요'
    :'인터넷을 확인해 주세요';
}
/* ══ 2.625 · 상태 한 줄 ════════════════════════════════════════════════════════
   목업(2026-09-06 «코치는 동기화를 이해할 필요가 없어야 한다»)의 첫 판. 팀 화면 머리줄 아래 늘 보이는 한 줄이 읽는 값.
   상태는 셋 + 과도기 하나: ok(팀과 같아요) · busy(올리는 중 · n) · bad(못 올렸어요 · 이유) · ask(확인할 것 n — 2단계 «되돌리기»가 보류·덮임·충돌을 대체할 때까지).
   판정 로직은 건드리지 않는다 — 기존 값(세션·온라인·busy·outbox 대기·lastIssue·자료 확인 목록·마지막 성공 시각)을 읽어 문장 하나로 만든다. */
function syncState(){
  var s=getSess(); if(!s)return {kind:'off',text:'로그인하면 팀과 함께 써요'};
  var wid=activeWs(), n=0; try{ n=pendingInfo(wid).count||0; }catch(_){}
  var m={}; try{ m=meta(); }catch(_){}
  /* «확인할 것»은 올리기를 막는 보류만 센다. 덮임·충돌·구조선은 설정 «자료 확인»에 남는다 — 실측(2026-09-06 풋볼A): 옛 충돌 18·구조선 8이 늘 떠 있어 띠가 영구 주황이 됐다 */
  var rc=0; try{ rc=holdList().length; }catch(_){}
  if(navigator.onLine===false)return {kind:'bad',reason:'sync_offline',text:'오프라인이에요'+(n?(' · 이 기기에 '+n+'건 안전하게 있어요'):''),n:n,review:rc};
  var fresh=lastIssue&&(Date.now()-lastIssue.at<10*60*1000);
  if(fresh&&(n||lastIssue.code==='sync_auth'||lastIssue.code==='sync_permission'))return {kind:'bad',reason:lastIssue.code,text:'못 올렸어요 · '+syncReasonText(lastIssue.code),n:n,review:rc,at:lastIssue.at};
  if(rc)return {kind:'ask',text:'올리기 전 확인할 것 '+rc,n:n,review:rc};
  if(busy||n)return {kind:'busy',text:'올리는 중'+(n?(' · '+n):''),n:n,review:rc};
  var at=0; try{ at=+localStorage.getItem('ps_last_pull_at')||0; }catch(_){} at=Math.max(at,+m.last||0);
  return {kind:'ok',text:'팀과 같아요',at:at,ago:at?agoText(at):'',n:0,review:0,rt:rtConnected(),rtAt:rtLast,rtHits:rtHits};
}
function classifySyncError(e){
  var msg=String((e&&e.message)||e||'').toLowerCase(),status=+(e&&e.psStatus)||0;
  if(navigator.onLine===false||(e&&e.psCode==='sync_offline'))return {code:'sync_offline',stage:(e&&e.psStage)||'sync'};
  if(e&&e.psCode)return {code:e.psCode,stage:e.psStage||'sync',status:status};
  if(status===401||/\b401\b|no token/.test(msg))return {code:'sync_auth',stage:(e&&e.psStage)||'auth',status:401};
  if(status===403||/\b403\b/.test(msg))return {code:'sync_permission',stage:(e&&e.psStage)||'sync',status:403};
  if(status===429||/\b429\b/.test(msg))return {code:'sync_rate_limit',stage:(e&&e.psStage)||'sync',status:429};
  if(status>=500||/\b5\\d\\d\b/.test(msg))return {code:'sync_server',stage:(e&&e.psStage)||'sync',status:status};
  if(/quota|indexeddb|idb|storage|transaction|aborterror/.test(msg))return {code:'sync_storage',stage:(e&&e.psStage)||'storage'};
  if(/timeout|timed out/.test(msg))return {code:'sync_timeout',stage:(e&&e.psStage)||'sync'};
  if(/fetch|network|load failed|internet/.test(msg))return {code:'sync_network',stage:(e&&e.psStage)||'sync'};
  return {code:'sync_unexpected',stage:(e&&e.psStage)||'sync'};
}

/* ══ 보관함 항목 단위 동기화 (ps_library) ══
   훈련·작전판·미팅·세트피스를 개별 행으로 유저와 연동.
   판정: 편집 시각(editedAt|savedAt) + 내용 해시. 시각이 안 바뀐 편집(제목 변경 등)은 해시로 잡아 시각을 갱신해 push.
   삭제: deleted_at 무덤돌 행 — 기기 간 삭제 전파, 부활 없음. */
function libTs(it){ return +(it&&(it.editedAt||it.savedAt))||0; }
function libShareCopy(it){
  var out;try{out=JSON.parse(JSON.stringify(it));}catch(_){out={};}
  delete out.thumb;delete out._teamSharePending;delete out._teamSharedAt;delete out._teamSource;
  /* 팀 공유본에는 사진·영상 원본을 넣지 않는다. 좌표·선·텍스트·장면 JSON은 유지한다. */
  function walk(v,k){
    if(!v||typeof v!=='object')return;
    Object.keys(v).forEach(function(key){
      var x=v[key];
      if(typeof x==='string'&&/^data:(?:image|video)\//i.test(x)){delete v[key];return;}
      if((/^(?:photo|image|video|logo|avatar|dataUrl)$/i.test(key))&&typeof x==='string'){delete v[key];return;}
      if(x&&typeof x==='object')walk(x,key);
    });
  }
  walk(out,'');return out;
}
function libHash(it){return hash(JSON.stringify(libShareCopy(it)));}
/* ── 비공개 백업(1.523) ───────────────────────────────────────────────
   팀 공간에서 저장한 자료는 '팀에 공유' 전까지 서버에 올라가지 않았다 → 기기를 잃으면 사라졌다.
   이제 ps_library에 private/owner_id를 두고, 팀 공간에서도 내 자료를 **비공개 행**으로 올린다.
   비공개 행은 RLS상 올린 사람만 읽는다(supabase-설치/supabase-library-private.sql).
   서버 마이그레이션 전이면 첫 pull이 400을 내므로 libPriv를 끄고 예전 동작(공유본만 올림)으로 돌아간다. */
var libPriv=true;
function libUid(){ try{ return (getSess()||{}).uid||null; }catch(_){ return null; } }
function srvPrivate(s){ return !!(libPriv&&s&&s.private===true); }   /* RLS상 보이는 비공개 행 = 내 것 */
function libSelCols(base){ return base+(libPriv?',private,owner_id':''); }
function libStamp(o,priv){ if(libPriv){ o.owner_id=libUid(); o.private=!!priv; } return o; }
/* 1.532 — 공유는 폴더가 정한다. 보관함 화면이 cs_vault_folder_meta_v1 에 폴더별 메타를 쓰고,
   그 안의 shared 가 켜진 폴더에 든 자료만 팀 공개본이 된다(자료마다 누르던 '팀에 공유'는 없어졌다).
   하위 폴더는 상위 폴더의 공유를 물려받는다 — '세트피스'를 켜면 '세트피스/코너'도 함께 공유된다. */
function libFolderMeta(){ try{ return JSON.parse(localStorage.getItem('cs_vault_folder_meta_v1')||'{}')||{}; }catch(_){ return {}; } }
function libFolderShared(folder){
  var f=String(folder==null?'':folder).trim(); if(!f) return false;   /* 폴더 밖 자료는 늘 비공개 */
  var meta=libFolderMeta(), cur=f;
  for(;;){
    if(meta[cur]&&meta[cur].shared) return true;
    var i=cur.lastIndexOf('/'); if(i<0) break; cur=cur.slice(0,i);
  }
  return false;
}
function libRow(it,t,wid,priv){ var clean=libShareCopy(it); return libStamp({workspace_id:wid,lib_id:it.libId,type:it.type||'train',name:it.name||'',folder:it.folder||'',tags:(it.tags||[]),pin:!!it.pin,item:clean,saved_at:t,deleted_at:null},priv); }
/* 보관함 본문은 IndexedDB(window.storage)에 있다 — iOS localStorage 5MB 캡을 피하기 위해.
   어댑터가 없으면(구버전/IDB 불가) 예전처럼 localStorage에서 읽는다. */
/* board.html이 store(=IndexedDB)로 저장하는 동기화 대상 키들.
   localStorage에서 읽으면 값이 없거나 낡아서 팀에 전파되지 않는다 → 반드시 어댑터로 읽고 쓴다. */
var IDBK={'training_sessions_v1':1,'cs_squad_v1':1,'cs_vault_folders_v1':1,'cs_meet_sit_v1':1,
  /* 1.501 — 매치데스크(analysis.html)는 v309부터 IndexedDB에 저장한다.
     KEYS에만 넣고 여기 빠뜨리면 localStorage에서 빈 값으로 읽혀 서버에 안 올라간다("저장이 안 돼"). */
  'cs_analysis_workspaces_v1':1,'cs_analysis_team_library_v1':1,
  /* 1.504 — 노트도 IndexedDB로 이사(localStorage 5MB 한도 탈출). 여기 빠뜨리면 빈 값으로 읽혀 백업이 멈춘다 */
  'cs_notes_v1':1,'cs_note_papers_v1':1,
  /* 1.531 — 경기(cs_match_v1)는 board.html이 IndexedDB에 쓰는데(store.set) 여기 빠져 있어서
     동기화는 localStorage를 읽고 있었다. 보드가 쓴 값이 서버로 안 가고, 서버에서 받은 값도 보드가 못 봤다. */
  'cs_match_v1':1,
  /* 1.589 — 네 개가 더 빠져 있었다. 실제 기기의 IndexedDB 키 목록과 KEYS 를 맞춰 보고 찾았다.
     증상: 2026-08-05 스카우팅 후보 34명 → 1명. 이 목록에 없으면 kvWrite 가 **localStorage 쪽으로** 쓰는데
     앱은 IndexedDB 를 읽으므로, ① 서버에서 받은 값이 화면에 반영되지 않고
     ② 되돌리기(rescueRestore)도 localStorage 에만 써서 **복구가 조용히 실패**한다
     (게다가 성공으로 판단해 ps_rescue_ 백업 원본까지 지운다 — 아래 rescueRestore 수정 참고)
     ③ storage.get 은 IDB 가 비면 localStorage 값을 끌어와 IDB 에 심으므로 잘못된 값이 앱까지 번진다.
     cs_perms_v1(권한)·cs_team_matches_v1(경기)·process_coach_v1(주간 일정)도 같은 위험에 있었다. */
  'cs_scout_targets_v1':1,'cs_team_matches_v1':1,'cs_perms_v1':1,'process_coach_v1':1};
/* 워크스페이스 전환 시 비워야 하는데 IndexedDB에 사는 키들 — localStorage.removeItem으론 안 지워진다 */
/* 매치데스크(cs_analysis_*)는 여기 넣으면 안 된다 — 이 목록은 워크스페이스를 바꿀 때 지우는 대상이다.
   매치데스크는 공간이 아니라 사람에 붙는 개인 작업실이라 전환해도 남아야 한다(PERSONAL과 같은 이유). */
var IDB_CONTENT=['cs_drill_lib_v1','training_sessions_v1','training_session_cur_v1','cs_squad_v1','cs_vault_folders_v1','cs_meet_sit_v1',
  /* 1.531 — "다른 워크스페이스의 데이터가 현재 워크스페이스에 보인다"(QA)의 원인.
     board.html 이 IndexedDB(store.set)에 쓰는 공간 데이터인데 이 목록에 없어서, 팀을 바꿔도
     이전 팀 것이 그대로 남아 화면에 나왔다. localStorage 쪽(CONTENT)만 지워지고 있었다. */
  'cs_match_v1',        /* 경기 시계·기록 */
  'cs_board_stash_v1',  /* 작전판 스태시(미팅 세트 등) */
  'cs_snap_match_v1',   /* 경기 스냅샷(폐기 키 — 옛 기기 청소용으로 유지. 실제 키는 아래 v2) */
  /* 2.464 — QA #18: 1.531 수리 때 폐기 키(v1)만 적혀 있어 실제 경기 스냅샷(v2)·라이브
     작전판·뷰 스냅샷이 전환에서 살아남았다. BOARD_LOCAL(위 CONTENT 정의 참조)과 같은 세 키. */
  'cs_snap_match_v2','cs_board_live_v1','cs_snap_board_v1',
  'cs_editor_work_v1',  /* 편집 중이던 작업 */
  /* 1.642 — 1.589에서 IDB 정본이 됐지만 공간 전환 삭제 목록에 빠졌던 키.
     빠지면 A팀 일정·경기·권한·후보가 B팀에서 최초 판본으로 올라갈 수 있다. */
  'process_coach_v1','cs_team_matches_v1','cs_perms_v1','cs_scout_targets_v1'];
/* ── 1.631 · 공간을 바꿀 때 항목도 함께 비운다 ────────────────────────────────
   IDB_CONTENT 는 **이름을 적어 둔 고정 목록**이다. 항목 키(sq:<선수id>)는 이름을 미리 알 수 없다.
   여기 빠지면 A팀 선수 44명이 B팀으로 따라 들어가고, 다음 동기화에서 **B팀 서버로 올라간다.**
   1.531 이 정확히 이 모양이었다("다른 워크스페이스의 데이터가 현재 워크스페이스에 보인다") —
   그때는 board 가 IDB 에 쓰는 키가 목록에 없어서였다. 이번엔 목록에 적을 수가 없으니 훑는다.
   실패하면 전환 자체를 중단한다 — 확인 못 한 A팀 항목을 B팀으로 가져가는 것보다 안전하다. */
function idbItemKeys(){
  if(!window.storage||!window.storage.keys) return Promise.reject(new Error('선수 항목 목록을 확인할 수 없습니다'));
  return Promise.resolve(window.storage.keys())
    .then(function(ks){if(!Array.isArray(ks))throw new Error('선수 항목 목록 형식이 올바르지 않습니다');return ks.filter(isItemKey);})
    .catch(function(e){ syncDiagnostic('item-keys-scan',e); throw e; });
}
/* ── 2.244 · 전환 때 IDB에서 백업·비울 키 = 손 목록 + 실측 ──────────────────
   IDB_CONTENT 는 손으로 적는 목록인데, IDB 거주는 자동으로 늘어난다 — storage.get 이
   IDB 미스 때 localStorage 값을 IDB 에 심는 성질(1.589 ③) 탓에 어느 팀 키든 IDB 로
   들어올 수 있고(scout_tool_v1 이 실제 사례), 목록에 없으면 전환에서 살아남아
   **다음 팀 서버로 올라간다**("선수단·일정이 겹쳐", 2026-08-24 사용자).
   1.590 의 교훈(손 목록은 미끄러진다 → 실제 IDB 키를 읽는다)을 비우기에도 적용:
   실제 IDB 키 중 팀 콘텐츠(CONTENT — PERSONAL 제외라 노트·매치데스크는 남는다)와
   항목(sq:*)을 손 목록에 합친다. 실패하면 전환 중단(확인 못 한 자료를 가져가지 않는다). */
function idbSwitchKeys(){
  if(!window.storage||!window.storage.keys) return Promise.reject(new Error('전환 대상 키 목록을 확인할 수 없습니다'));
  return Promise.resolve(window.storage.keys())
    .then(function(ks){
      if(!Array.isArray(ks))throw new Error('전환 대상 키 목록 형식이 올바르지 않습니다');
      var set={}; IDB_CONTENT.forEach(function(k){set[k]=1;});
      ks.forEach(function(k){ if(isItemKey(k)||CONTENT.indexOf(k)>=0)set[k]=1; });
      return Object.keys(set);
    })
    .catch(function(e){ syncDiagnostic('switch-keys-scan',e); throw e; });
}
try{ window.__psIdbSwitchKeys=idbSwitchKeys; }catch(_){}
/* ── 1.590 · IDB 키 목록을 손으로 유지하지 않는다 ────────────────────────────
   IDBK 는 "이 키는 IndexedDB 에 산다"를 **사람이 적어 둔** 목록이었다. 그런데 앱이 새 키를
   IDB 로 옮길 때마다 여기 적는 걸 잊으면, 동기화는 엉뚱하게 localStorage 를 읽고 쓴다 —
   그러면 받은 값이 화면에 안 나오고, 되돌리기도 조용히 실패한다(1.589 의 34명 사고).
   실제로 네 개가 빠져 있었고, 그전에도 cs_match_v1(1.531) · 노트(1.504) · 매치데스크(1.501)가
   같은 이유로 한 번씩 사고를 냈다. **목록을 고치는 것으로는 다음 번을 못 막는다.**

   그래서 실제 IndexedDB 에 있는 키를 매 동기화 회차에 읽어 IDBK 와 합친다.
   IDBK 는 이제 '아직 IDB 에 만들어지지 않았지만 IDB 로 갈 키'를 위한 바닥 값으로만 남는다.
   목록에 없던 키가 발견되면 조용히 넘어가지 않고 진단에 남긴다 — 정본 목록도 같이 고치려고. */
/* ── 1.590 · 올린 기록 ────────────────────────────────────────────────────────
   2026-08-05 스카우팅 후보 34명 → 1명 사고에서, 복구는 했지만 **언제 어느 기기에서
   1명짜리가 올라갔는지 끝내 추적하지 못했다.** 서버에는 마지막 값만 남고 누가 썼는지는 안 남는다.
   그래서 올릴 때마다 '무엇을 몇 개로 올렸는지'를 이 기기에 남긴다.
   값은 담지 않는다(용량·개인정보) — 키·개수·시각·기기만. 다음에 숫자가 튀면 어느 기기인지 바로 안다. */
var PUSHLOG='ps_push_log_v1', PUSHLOG_MAX=60;
function deviceTag(){
  try{ var d=localStorage.getItem('ps_device_tag');
    if(!d){ d=(navigator.platform||'기기').slice(0,10)+'-'+Math.random().toString(36).slice(2,6); localStorage.setItem('ps_device_tag',d); }
    return d; }catch(_){ return '기기'; }
}
function pushLogList(){ try{ return JSON.parse(localStorage.getItem(PUSHLOG)||'[]')||[]; }catch(_){ return []; } }
function pushLog(wid,rows){
  try{
    if(!rows||!rows.length)return;
    var items=rows.map(function(r){ return {k:r.k,n:psCount(r.v)}; })
                  .filter(function(x){ return x.n!=null; });      /* 셀 수 있는 것만 — 나머지는 소음 */
    if(!items.length)return;
    var a=pushLogList();
    a.push({at:Date.now(),wid:String(wid||'').slice(0,8),dev:deviceTag(),
            by:(function(){ try{ return getDisplayName()||''; }catch(_){ return ''; } })(),
            items:items});
    localStorage.setItem(PUSHLOG,JSON.stringify(a.slice(-PUSHLOG_MAX)));
  }catch(_){}
}
try{ window.PSSyncPushLog=pushLogList; }catch(_){}
var IDB_LIVE={}, _idbLiveAt=0;
/* ── 1.630 · 항목 단위 저장의 열쇠는 **접두사**다 ────────────────────────────
   앞으로 선수 한 명이 키 하나가 된다(sq:<선수id>). 그 키들을 IDBK 처럼 **손으로 적은
   목록**으로 관리하는 길은 1.590 에서 이미 실패했다 — 적는 걸 잊으면 동기화가 엉뚱한
   저장소를 읽고, 받은 값이 화면에 안 나오고, 되돌리기도 조용히 실패한다.
   그래서 항목 키는 이름 규칙 하나로 판정한다. 목록에 적을 것이 없으니 잊을 것도 없다.

   왜 IndexedDB 인가 — 선수 사진이 이 자료에 들어 있다. localStorage 5MB 한도는
   이미 한 번 밟았고(1.504 에서 노트를 IDB 로 옮긴 이유), 이사 중에는 통짜와 항목을
   둘 다 들고 있으므로 사진이 두 벌이 된다. localStorage 에 두면 그 순간 터진다.

   ⚠ 접두사에 '_' 를 쓰지 않는다. SQL 의 like 에서 '_' 는 한 글자 와일드카드라
   cs\_idp\_v1\_% 처럼 매번 이스케이프해야 한다(실제로 그렇게 쓰고 있다). ':' 는 그냥 쓴다. */
var ITEMP='sq:';
function isItemKey(k){ return !!(k&&k.indexOf(ITEMP)===0); }
function idbBacked(k){ return !!(window.storage && (IDBK[k]||IDB_LIVE[k]||isItemKey(k))); }

/* ── 권한 문서 읽기 (1.619) ──
   푸시 권한 판정은 동기(sync)로 일어나는데 cs_perms_v1 은 IndexedDB 에 산다.
   그래서 ①localStorage 거울을 먼저 보고 ②없으면 미리 받아 둔 IDB 사본을 쓴다.
   이 값을 못 읽으면 role 이 'player' 로 닫히므로(fail-closed), 읽기 경로를 확실히 해 둬야
   정당한 스태프가 억울하게 막히지 않는다. */
var __permsRaw=null;
function permsRaw(){
  try{ var v=localStorage.getItem('cs_perms_v1'); if(v!=null){ __permsRaw=v; return v; } }catch(_){}
  return __permsRaw;
}
function permsPrime(){
  if(!window.storage||!window.storage.get) return Promise.resolve();
  return Promise.resolve(window.storage.get('cs_perms_v1')).then(function(r){
    if(r&&r.value!=null){
      __permsRaw=r.value;
      /* 거울이 없으면 만들어 둔다 — 3KB 남짓이라 한도 걱정이 없고,
         이게 있어야 다음 회차 권한 판정이 IDB 를 기다리지 않는다. */
      try{ if(localStorage.getItem('cs_perms_v1')===null) localStorage.setItem('cs_perms_v1',r.value); }catch(_){}
    }
  }).catch(function(){});
}
function idbRefreshLive(){
  if(!window.storage||!window.storage.keys) return Promise.resolve();
  if(Date.now()-_idbLiveAt<60000) return Promise.resolve();      /* 1분 캐시 — 매 회차 전수 조회는 낭비 */
  return Promise.resolve(window.storage.keys()).then(function(ks){
    var live={},unknown=[];
    (ks||[]).forEach(function(k){
      live[k]=1;
      /* 동기화 대상(KEYS)인데 정본 목록에 없다 = 예전 사고와 같은 조건 */
      if(!IDBK[k] && KEYS.indexOf(k)>=0) unknown.push(k);
    });
    IDB_LIVE=live; _idbLiveAt=Date.now();
    if(unknown.length) syncDiagnostic('idbk-missing',new Error('IDBK 누락: '+unknown.join(',')));
    return unknown;
  }).catch(function(e){ syncDiagnostic('idbk-scan',e); });
}
try{ window.PSSyncIDBCheck=idbRefreshLive; }catch(_){}
function kvPreload(){
  if(!window.storage) return Promise.resolve({});
  return idbRefreshLive().then(function(){
    /* 정본 목록 + 실제 IDB 에 있는 동기화 대상 키를 모두 읽는다 */
    var set={};
    Object.keys(IDBK).forEach(function(k){ set[k]=1; });
    /* 1.630 — 항목 키(sq:*)는 KEYS 에 없다(고정 배열이라 있을 수가 없다). 접두사로 받는다. */
    Object.keys(IDB_LIVE).forEach(function(k){ if(KEYS.indexOf(k)>=0||(ITEMS_ACTIVE&&isItemKey(k))) set[k]=1; });
    var ks=Object.keys(set), vals={};
    return Promise.all(ks.map(function(k){
      /* 읽기 실패를 빈 값으로 취급하면 서버본으로 잘못 덮을 수 있으므로 전체 동기화를 중단한다. */
      return window.storage.get(k).then(function(r){ vals[k]=r?r.value:null; });
    })).then(function(){ return vals; });
  });
}
/* ══ 1.630 · kv 전송을 **나눠 보낸다** ═══════════════════════════════════════
   지금까지 kv 는 "키가 몇십 개"라는 가정 위에 서 있었다 — pull 은 키 전부를 URL 하나에
   넣고, push 는 바뀐 행 전부를 POST 하나로 보낸다. 선수 한 명이 키 하나가 되면 그 가정이
   바로 무너진다: 새 기기 첫 동기화가 URL 길이를 넘고, 첫 이사는 사진 든 44명을 한 번에 보낸다.
   둘 다 **전부 실패**한다 — 한 명이 아니라 그 회차 전체가.

   보관함(syncLibrary)은 같은 문제를 이미 겪고 청크 분할로 풀어 뒀다(pull 20개 · push 700KB/15행).
   같은 잣대를 kv 로 옮겨 온다. 지금 규모에서는 청크가 하나뿐이라 **동작이 달라지지 않는다** —
   이건 항목 이사를 받기 위한 바닥 공사다. */
var KV_PULL_CHUNK=20, KV_PUSH_BYTES=700000, KV_PUSH_ROWS=15;
/* PostgREST in.(…) — 값을 따옴표로 감싼다. 지금 키는 전부 [a-z0-9_] 라 없어도 되지만
   항목 키(sq:<id>)는 id 에 무엇이 들어올지 이 파일이 정하지 않는다. 보관함과 같은 방식. */
function kvInFilter(keys){ return 'k=in.('+encodeURIComponent('"'+keys.join('","')+'"')+')'; }

/* ══ 2.352 · 팀 자료 통째로 가져오기 / 올리기 ═══════════════════════════════════
   사용자: "앱 설정 데이터에서 팀것 데이터 전부 한번에 가져오기랑 한번에 올리기".
   평소 동기화는 **양방향 병합**이라 "지금 팀 것으로 통일" · "지금 내 것으로 통일" 을 못 한다.
   기기를 바꿨거나, 한쪽이 확실히 맞을 때 쓰는 **한 방향 도구**다.
   ⚠ 되돌릴 수 없는 쪽이라 화면에서 **두 번 묻는다**(app.html) — 여기서는 실행만 한다.
   ⚠ 개인 키(PERSONAL — 내 노트·분석)는 **건드리지 않는다.** 워크스페이스에 속하지 않고 나를 따라다닌다.
   ⚠ 가져오기는 `kvWrite` 로 쓴다 — 덮기 전 값을 rescue 에 남기는 기존 안전망을 그대로 탄다.
      메타(hash·cupd)도 함께 맞춰야 다음 회차가 "내가 고쳤다"고 오해해 되돌리지 않는다.
   ⚠ 올리기는 서버 응답 원문을 대조하는 `kvPushRows` 를 그대로 쓴다(거짓 성공 금지). */
function bulkKeys(){
  var out=[];
  KEYS.forEach(function(k){ if(!PERSONAL[k])out.push(k); });
  /* 2.603 — 보관함(LIBKEY)은 ps_library 행으로 따로 동기화된다(library_pull/push). 여기서 ps_kv 에 통째로 올리면 8MB 한 줄이 생기고
     다른 기기가 회차마다 그걸 받는다(위 2.603 주석). 더는 싣지 않는다 — 통째 가져오기(bulkPull)는 옛 줄이 있으면 그대로 읽는다. */
  return out;
}
function bulkGuard(){
  if(!dataUnlocked())return '로그인한 계정의 자료를 확인한 뒤 쓸 수 있어요';
  if(!activeWs())return '워크스페이스를 확인하지 못했어요';
  if(scheduleHeld())return '일정 편집을 끝내고 저장이 끝난 뒤 다시 시도해 주세요';
  if(navigator.onLine===false)return '오프라인이에요 — 연결된 뒤 다시 시도해 주세요';
  return '';
}
/* 팀 → 이 기기. 서버에 있는 키만 덮는다(서버에 없는 키는 그대로 둔다 — 지우는 도구가 아니다) */
function bulkPull(){
  var g=bulkGuard(); if(g)return Promise.resolve({error:g});
  if(busy)return Promise.resolve({error:'동기화가 도는 중이에요 — 잠시 뒤 다시 시도해 주세요'});
  var wid=activeWs(), keys=bulkKeys();
  return ensureToken().then(function(at){
    if(!at)return {error:'로그인 확인이 필요해요'};
    return kvPullValues(at,wid,keys).then(function(rows){
      var m=meta(), writes=[], n=0, skipped=[];
      (rows||[]).forEach(function(r){
        if(r==null||r.v==null)return;
        if(scheduleHeld()&&r.k===SCHEDULE_KEY){ skipped.push(r.k); return; }
        var loc=null; try{ loc=localStorage.getItem(r.k); }catch(_){}
        if(kvWrite(r.k,r.v,writes,loc)){
          n++; m.h[r.k]=hash(r.v); m.c[r.k]=r.cupd; nSet(m,r.k,r.v);
          try{ syncBaseSet(r.k,r.v); holdClear(r.k); importApprovalClear(r.k); }catch(_){}
        } else skipped.push(r.k);
      });
      return Promise.all(writes).then(function(){
        setMeta(m);
        return {ok:1,n:n,skipped:skipped,total:(rows||[]).length};
      });
    });
  }).catch(function(e){ syncDiagnostic('bulk-pull',e); return {error:String(e&&e.message||e).slice(0,120)}; });
}
/* 이 기기 → 팀. 값이 있는 키만 올린다(빈 키로 서버를 지우지 않는다) */
function bulkPush(){
  var g=bulkGuard(); if(g)return Promise.resolve({error:g});
  if(busy)return Promise.resolve({error:'동기화가 도는 중이에요 — 잠시 뒤 다시 시도해 주세요'});
  var wid=activeWs(), keys=bulkKeys();
  return ensureToken().then(function(at){
    if(!at)return {error:'로그인 확인이 필요해요'};
    return Promise.all(keys.map(function(k){
      return currentValueForKey(k).then(function(v){ return {k:k,v:v}; }).catch(function(){ return {k:k,v:null}; });
    })).then(function(vals){
      var now=Date.now(), rows=[], m=meta();
      vals.forEach(function(x){
        if(x.v==null||x.v==='')return;                      /* 빈 것으로 팀 자료를 지우지 않는다 */
        rows.push({workspace_id:wid,k:x.k,v:x.v,cupd:now});
      });
      if(!rows.length)return {ok:1,n:0,total:0};
      return kvPushRows(at,rows,function(ch){
        ch.forEach(function(r){ m.h[r.k]=hash(r.v); m.c[r.k]=r.cupd; nSet(m,r.k,r.v);
          try{ syncBaseSet(r.k,r.v); }catch(_){} });
        setMeta(m);
      },'bulk_push').then(function(){
        return {ok:1,n:rows.length,total:rows.length};
      });
    });
  }).catch(function(e){ syncDiagnostic('bulk-push',e); return {error:String(e&&e.message||e).slice(0,120)}; });
}

/* ══ 2.622 · 일정 그림(thumb) 분리 전송 ═══════════════════════════════════════════
   실측(2026-09-06 대시보드, 일정 문서 상위 8팀): thumb(작전판 SVG 문자열)가 문서의 80~95% —
   29276f9c 2.92MB 중 1.14MB(31장·장당 37KB) · 6d6d17f5 1.34MB 중 1.12MB(21장) · 765c3c39 448KB 중 417KB(10장).
   그림을 빼면 주 42개 일정(풋볼A)이 약 125KB. 2단계 «행 분리»의 진짜 무게는 주가 아니라 그림이었다.
   설계 — **전송 경계에서만** 바꾼다. 기기 안(localStorage 거울·IDB·base·날짜 병합·해시)은 그림이 든 원래 모양 그대로.
     보낼 때: "thumb":"<svg…>" → "thumb":"","thumbRef":"<해시>" 로 바꾸고 그림은 ps_blob(workspace_id,h,v) 행으로 한 번만 올린다(내용 주소).
     받을 때: thumbRef 를 IDB 캐시(ps_blob:<h>)에서, 없으면 ps_blob 에서 묶어 받아 되돌린다.
   ⚠ 바이트 정확 — 잘라낸 조각은 JSON 이스케이프된 문자열 그대로 저장·복원한다. 되돌린 문서가 원문과 같아야 base·해시·날짜 병합이 흔들리지 않는다.
   ⚠ 옛 앱판은 그림 없는 문서를 받아 썸네일만 안 보이고, 저장하면 thumbRef 를 그대로 다시 올린다(손실 없음). 서버 검사(1644)는 잎 문자열을 안 본다.
   ⚠ 서버에 ps_blob 이 없거나(404) 권한이 없으면(403·401) 이 세션에서 끄고 예전처럼 통째로 보낸다 — SQL·배포 순서에 안전. */
var BLOB_MIN=512, BLOB_PREFIX='ps_blob:', BLOB_IN=40, BLOB_UP_BYTES=900000, blobOff=false;
/* 2.623 — 콜론 뒤 공백(\s*)을 잡아 그대로 보존한다: 서버 SQL 복구(jsonb::text)로 쓴 문서는 `"thumb": "<svg…>"` 꼴이라(풋볼A rev 341 실측) 공백 없는 정규식이 0장을 잡았다 */
/* 2.630 — 키를 넓힌다: thumb(작전판 SVG) + emblem(팀 엠블럼 data:). 실측(2026-09-06): scout_tool_v1 두 팀에 옛 엠블럼 원본 1,249,656·433,928자가
   그대로(2.605 다이어트는 그 팀이 새 판으로 열어야 걸린다). 참조 키 이름은 «키+Ref»(thumbRef·emblemRef). 대상 키는 BLOB_KEYS. */
var BLOB_KEYS={process_coach_v1:1,scout_tool_v1:1};
var BLOB_RE_STRIP=/"(thumb|emblem)":(\s*)"((?:[^"\\]|\\.){512,})"/g;    /* JSON 문자열 내용(이스케이프 포함), 512자 이상만 */
var BLOB_RE_REF=/"(thumb|emblem)":(\s*)"","(?:thumb|emblem)Ref":"([0-9a-f]{16,64})"/g;
function blobHash(s){
  try{ if(window.crypto&&crypto.subtle&&window.TextEncoder){ return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){ var a=new Uint8Array(b),h=''; for(var i=0;i<12;i++)h+=('0'+a[i].toString(16)).slice(-2); return h; }); } }catch(_){}
  return Promise.resolve((function(){ var h1=5381,h2=52711,i=s.length; while(i){var c=s.charCodeAt(--i); h1=(h1*33)^c; h2=(h2*33)^c;} return ('00000000'+(h1>>>0).toString(16)).slice(-8)+('00000000'+(h2>>>0).toString(16)).slice(-8)+('00000000'+(s.length>>>0).toString(16)).slice(-8); })());
}
function blobCacheGet(h){ if(!window.storage)return Promise.resolve(null); return window.storage.get(BLOB_PREFIX+h).then(function(r){return r&&typeof r.value==='string'?r.value:null;}).catch(function(){return null;}); }
function blobCacheSet(h,v){ if(!window.storage)return Promise.resolve(); return window.storage.set(BLOB_PREFIX+h,v).catch(function(){}); }
/* 문서에서 그림을 떼어 낸다 → {v:떼어 낸 문서, blobs:[{h,v}]}. 떼어 낼 게 없으면 원문 그대로. 두 번 적용해도 같다(멱등). */
function schedStrip(raw){
  var segs={}; String(raw).replace(BLOB_RE_STRIP,function(all,key,ws,seg){ segs[seg]=1; return all; });
  var keys=Object.keys(segs); if(!keys.length)return Promise.resolve({v:raw,blobs:[]});
  return Promise.all(keys.map(blobHash)).then(function(hs){
    var map={}; keys.forEach(function(s,i){map[s]=hs[i];});
    var v=String(raw).replace(BLOB_RE_STRIP,function(all,key,ws,seg){ return '"'+key+'":'+ws+'"","'+key+'Ref":"'+map[seg]+'"'; });
    return {v:v,blobs:keys.map(function(s){return {h:map[s],v:s};})};
  });
}
function schedRefs(raw){ var m={},x; BLOB_RE_REF.lastIndex=0; while((x=BLOB_RE_REF.exec(String(raw))))m[x[3]]=1; BLOB_RE_REF.lastIndex=0; return Object.keys(m); }
function blobInFilter(hs){ return 'h=in.('+hs.map(function(h){return '"'+h+'"';}).join(',')+')'; }
function blobDisable(stage,status){ blobOff=true; try{ syncDiagnostic('blob-off',new Error(stage+' '+status)); }catch(_){} }
/* 서버에 없는 그림만 올린다. 404/403/401 이면 기능을 끄고 false 를 돌려 통째 전송으로 물러선다. */
function blobEnsure(at,wid,blobs){
  if(blobOff||!blobs||!blobs.length)return Promise.resolve(!blobOff);
  var have={}, chunks=[]; for(var i=0;i<blobs.length;i+=BLOB_IN)chunks.push(blobs.slice(i,i+BLOB_IN));
  return chunks.reduce(function(p,ch){ return p.then(function(ok){ if(!ok)return false;
    return syncFetch('blob_have',BASE+'/rest/v1/ps_blob?workspace_id=eq.'+encodeURIComponent(wid)+'&'+blobInFilter(ch.map(function(b){return b.h;}))+'&select=h',{headers:hj(at)})
      .then(function(r){ if(r.status===404||r.status===403||r.status===401){blobDisable('blob_have',r.status);return false;} if(!r.ok)throw syncHttpError('blob_have',r.status); return r.json().then(function(rows){ (rows||[]).forEach(function(x){have[x.h]=1;}); return true; }); });
  }); },Promise.resolve(true)).then(function(ok){
    if(!ok)return false;
    var miss=blobs.filter(function(b){return !have[b.h];}); if(!miss.length)return true;
    var ups=[],cur=[],sz=0; miss.forEach(function(b){ if(cur.length&&sz+b.v.length>BLOB_UP_BYTES){ups.push(cur);cur=[];sz=0;} cur.push({workspace_id:wid,h:b.h,v:b.v}); sz+=b.v.length; }); if(cur.length)ups.push(cur);
    return ups.reduce(function(p,ch){ return p.then(function(ok2){ if(!ok2)return false;
      var h=hj(at); h['Prefer']='resolution=ignore-duplicates,return=minimal';
      return syncFetch('blob_push',BASE+'/rest/v1/ps_blob?on_conflict=workspace_id,h',{method:'POST',headers:h,body:JSON.stringify(ch)})
        .then(function(r){ if(r.status===404||r.status===403||r.status===401){blobDisable('blob_push',r.status);return false;} if(!r.ok)throw syncHttpError('blob_push',r.status); return true; });
    }); },Promise.resolve(true));
  });
}
/* 올리기 직전: 일정 행의 그림을 떼어 ps_blob 에 올리고 행에는 참조만 남긴다. 그림은 이 기기 캐시에도 둔다. */
function blobPrepRows(at,rows){
  var todo=(rows||[]).filter(function(r){return r&&BLOB_KEYS[r.k]&&typeof r.v==='string'&&!blobOff;});
  return todo.reduce(function(p,r){ return p.then(function(){
    return schedStrip(r.v).then(function(res){
      if(!res.blobs.length)return;
      return Promise.all(res.blobs.map(function(b){return blobCacheSet(b.h,b.v);})).then(function(){
        return blobEnsure(at,r.workspace_id,res.blobs).then(function(ok){ if(ok)r.v=res.v; });
      });
    });
  }); },Promise.resolve());
}
/* 받은 직후: thumbRef 를 그림으로 되돌린다. 못 받은 참조는 그대로 둔다(썸네일만 비고, 다음에 다시 받는다). */
function schedHydrate(at,wid,raw){
  var refs=schedRefs(raw); if(!refs.length)return Promise.resolve(raw);
  var map={};
  return Promise.all(refs.map(function(h){ return blobCacheGet(h).then(function(v){ if(v!=null)map[h]=v; }); })).then(function(){
    var miss=refs.filter(function(h){return map[h]==null;}); if(!miss.length||!at)return;
    var chunks=[]; for(var i=0;i<miss.length;i+=BLOB_IN)chunks.push(miss.slice(i,i+BLOB_IN));
    return chunks.reduce(function(p,ch){ return p.then(function(){
      return syncFetch('blob_pull',BASE+'/rest/v1/ps_blob?workspace_id=eq.'+encodeURIComponent(wid)+'&'+blobInFilter(ch)+'&select=h,v',{headers:hj(at)})
        .then(function(r){ if(r.status===404){blobDisable('blob_pull',404);return [];} if(!r.ok)throw syncHttpError('blob_pull',r.status); return r.json(); })
        .then(function(rows){ return Promise.all((rows||[]).map(function(x){ if(x&&typeof x.v==='string'){ map[x.h]=x.v; return blobCacheSet(x.h,x.v); } })); });
    }); },Promise.resolve());
  }).then(function(){
    return String(raw).replace(BLOB_RE_REF,function(all,key,ws,h){ return map[h]!=null?('"'+key+'":'+ws+'"'+map[h]+'"'):all; });
  });
}
/* ══ 2.628 · 즉시 밀어주기(Realtime) ══════════════════════════════════════════════
   사용자 "노션처럼 바로바로 적용되게" → 세 걸음 중 1번. 45초 폴링은 그대로 두고(안전망), 서버의 작은 핑 표(ps_kv_ping: workspace_id·k·cupd)를
   WebSocket 으로 구독해 «바뀌었으니 지금 받아» 신호로 쓴다. 문서 행 자체를 구독하면 변경마다 문서 전문이 모든 기기로 밀려 이그레스가 다시 는다.
   supabase-js 없이 Phoenix 채널 프로토콜 최소 구현: phx_join(postgres_changes 필터 + access_token) · heartbeat 30초 · postgres_changes 수신.
   내가 방금 올린 키(m.c[k]===cupd)는 무시. 핑은 1.2초 묶어 syncNow('realtime'). 끊기면 지수 백오프(최대 60초)로 다시 붙는다.
   실패해도 아무것도 나빠지지 않는다 — 폴링이 그대로 돈다. */
var rtWs=null, rtRef=0, rtTopicWid='', rtHb=null, rtRetry=0, rtTimer=null, rtJoined=false, rtLast=0, rtHits=0;
function rtUrl(){ return BASE.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(CFG.anonKey)+'&vsn=1.0.0'; }
function rtSend(o){ try{ if(rtWs&&rtWs.readyState===1)rtWs.send(JSON.stringify(o)); }catch(_){} }
function rtConnected(){ return !!(rtWs&&rtWs.readyState===1&&rtJoined&&rtTopicWid===activeWs()); }
function rtClose(){ try{ if(rtHb)clearInterval(rtHb); }catch(_){} rtHb=null; try{ if(rtWs){ rtWs.onclose=null; rtWs.onmessage=null; rtWs.close(); } }catch(_){} rtWs=null; rtJoined=false; }
function rtScheduleReconnect(){ rtClose(); var d=Math.min(60000,1000*Math.pow(2,Math.min(rtRetry++,6))); setTimeout(rtConnect,d); }
function rtConnect(){
  try{
    if(!('WebSocket' in window))return;
    var s=getSess(); if(!s||!dataUnlocked()||navigator.onLine===false)return;
    var wid=activeWs(); if(!wid)return;
    if(rtWs&&rtWs.readyState<=1&&rtTopicWid===wid)return;   /* 이미 이 워크스페이스에 붙어 있거나 붙는 중 */
    rtClose();
    ensureToken().then(function(at){
      if(!at)return;
      var ws; try{ ws=new WebSocket(rtUrl()); }catch(_){ return; }
      rtWs=ws; rtTopicWid=wid; rtJoined=false;
      ws.onopen=function(){
        rtRef++; rtSend({topic:'realtime:ps_kv_ping:'+wid,event:'phx_join',ref:String(rtRef),
          payload:{config:{postgres_changes:[{event:'INSERT',schema:'public',table:'ps_kv_ping',filter:'workspace_id=eq.'+wid}]},access_token:at}});
        rtHb=setInterval(function(){ rtRef++; rtSend({topic:'phoenix',event:'heartbeat',payload:{},ref:String(rtRef)}); },30000);
      };
      ws.onmessage=function(ev){
        var m=null; try{ m=JSON.parse(ev.data); }catch(_){ return; } if(!m)return;
        if(m.event==='phx_reply'&&m.payload&&m.payload.status==='ok'&&!rtJoined&&m.topic!=='phoenix'){ rtJoined=true; rtRetry=0; try{ window.dispatchEvent(new CustomEvent('ps-sync-state')); }catch(_){} }
        else if(m.event==='phx_reply'&&m.payload&&m.payload.status==='error'&&m.topic!=='phoenix'){ syncDiagnostic('rt-join',new Error(JSON.stringify(m.payload).slice(0,160))); rtScheduleReconnect(); }
        else if(m.event==='postgres_changes'){ var rec=m.payload&&m.payload.data&&m.payload.data.record; if(rec)rtPing(rec); }
        else if(m.event==='phx_error'||m.event==='phx_close'){ rtScheduleReconnect(); }
      };
      ws.onclose=function(){ rtScheduleReconnect(); };
      ws.onerror=function(){};
    }).catch(function(){});
  }catch(_){}
}
function rtPing(rec){
  var k=rec&&rec.k, c=+(rec&&rec.cupd)||0; if(!k)return;
  rtLast=Date.now(); rtHits++;
  try{ var m=meta(); if(m.c&&m.c[k]===c)return; }catch(_){}   /* 내가 올린 것 */
  clearTimeout(rtTimer); rtTimer=setTimeout(function(){ if(!dataUnlocked()||navigator.onLine===false)return; syncNow('realtime'); },1200);
}
try{ window.addEventListener('online',function(){ setTimeout(rtConnect,500); }); }catch(_){}
try{ setInterval(rtConnect,60000); }catch(_){}
try{ setTimeout(rtConnect,6000); setTimeout(rtConnect,20000); }catch(_){}   /* 부팅 회차가 보류로 끝나도 붙는다(실측: 첫 회차 뒤 rt false) */
try{ document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible')setTimeout(rtConnect,300); }); }catch(_){}
function kvPullValues(at,wid,keys){
  if(!keys||!keys.length) return Promise.resolve([]);
  var chunks=[]; for(var i=0;i<keys.length;i+=KV_PULL_CHUNK) chunks.push(keys.slice(i,i+KV_PULL_CHUNK));
  var out=[];
  return chunks.reduce(function(p,ch){ return p.then(function(){
    return syncFetch('kv_pull',BASE+'/rest/v1/ps_kv?workspace_id=eq.'+wid+'&'+kvInFilter(ch)+'&select=k,v,cupd',{headers:hj(at)})
      .then(function(r){ if(!r.ok) throw syncHttpError('kv_pull',r.status); return r.json(); })
      .then(function(rows){ return Promise.all((rows||[]).map(function(r0){
        /* 2.622 — 일정 행은 그림 참조를 되돌린 뒤에 엔진에 준다(엔진 안은 늘 그림이 든 모양) */
        if(r0&&BLOB_KEYS[r0.k]&&typeof r0.v==='string'&&(r0.v.indexOf('"thumbRef":"')>=0||r0.v.indexOf('"emblemRef":"')>=0)){ return schedHydrate(at,wid,r0.v).then(function(v){ r0.v=v; out.push(r0); }); }
        out.push(r0);
      })); });
  }); },Promise.resolve()).then(function(){ return out; });
}
/* 청크 하나가 올라갈 때마다 onOk(그 청크)를 부른다 — 중간에 실패하면 **올라간 것만** 기록한다.
   전부 성공한 뒤에 한꺼번에 적으면, 실패한 회차가 "올렸다"고 거짓으로 남는다(추적이 안 된다). */
/* ══ 1.633 · 누가 마지막으로 고쳤나 ══════════════════════════════════════════
   서버 ps_kv.updated_by(supabase-updated-by.sql)를 함께 받아 화면에 "○○ 코치 · 2분 전"
   을 보여준다. 시각은 따로 안 받는다 — cupd 가 이미 그 값이고 이미 받고 있다.

   ⚠ 컬럼이 없는 서버(=SQL 미설치)에서 select 에 updated_by 를 넣으면 **400 이 나고
     동기화 전체가 멈춘다.** 그건 '이름이 안 보인다'가 아니라 '팀 백업이 멈춘다'다.
     그래서 한 번 실패하면 끄고 예전 질의로 되돌아간다 — 보관함이 private 컬럼에
     쓰는 방법과 같다(libPullList). 다시 켜는 건 새로고침 때. */
var kvWho=true;
function kvMetaFetch(at,wid){
  var cols=kvWho?'k,cupd,updated_by':'k,cupd';
  return syncFetch('kv_meta',BASE+'/rest/v1/ps_kv?workspace_id=eq.'+wid+'&select='+cols,{headers:hj(at)})
    .then(function(r){
      if(!r.ok&&kvWho&&(r.status===400||r.status===404)){
        kvWho=false;                                   /* 옛 서버 — 이름 없이 계속 간다 */
        syncDiagnostic('kv-who-off',new Error('ps_kv.updated_by 없음 — supabase-updated-by.sql 미설치'));
        return kvMetaFetch(at,wid);
      }
      return r;
    });
}
/* 키별 마지막 수정자 — 이 회차에 받은 것만 담는다(기기 사본이 아니라 서버가 말한 것) */
var WHO_KEY='ps_kv_who_v1', WHO_NAMES='ps_member_names_v1', _namesAt=0;
function whoMap(){ try{ return JSON.parse(localStorage.getItem(WHO_KEY)||'{}')||{}; }catch(_){ return {}; } }
function whoRemember(rows,wid){
  if(!kvWho||!rows||!rows.length) return;
  try{
    var m={}, any=false;
    rows.forEach(function(r0){ if(r0&&r0.updated_by){ m[r0.k]={u:r0.updated_by,at:r0.cupd||0}; any=true; } });
    if(!any) return;
    m.__wid=String(wid||'').slice(0,8);
    localStorage.setItem(WHO_KEY,JSON.stringify(m));
  }catch(_){}
}
function nameMap(){ try{ return JSON.parse(localStorage.getItem(WHO_NAMES)||'{}')||{}; }catch(_){ return {}; } }
/* 이름은 자주 안 바뀐다 — 10분에 한 번만 받는다 */
function namesRefresh(wid){
  if(Date.now()-_namesAt<6e5) return Promise.resolve();
  _namesAt=Date.now();
  return membersOf(wid).then(function(rows){
    var m={};
    (rows||[]).forEach(function(x){
      if(!x||!x.user_id) return;
      var n=String(x.name||'').trim();
      if(!n){ var e=String(x.email||''); n=e.indexOf('@')>0?e.slice(0,e.indexOf('@')):''; }
      if(n) m[x.user_id]=n.slice(0,20);
    });
    try{ localStorage.setItem(WHO_NAMES,JSON.stringify(m)); }catch(_){}
  }).catch(function(){});
}
function agoText(ms){
  if(!ms) return '';
  var d=Date.now()-ms;
  if(d<0) return '방금';
  if(d<6e4) return '방금';
  if(d<36e5) return Math.floor(d/6e4)+'분 전';
  if(d<864e5) return Math.floor(d/36e5)+'시간 전';
  var n=Math.floor(d/864e5);
  return n<7?(n+'일 전'):new Date(ms).toLocaleDateString();
}
/* 화면이 부르는 것 — "○○ 코치 · 2분 전" 한 줄. 모르면 빈 문자열(아무 말도 안 한다). */
function editLine(k){
  try{
    var w=whoMap()[k]; if(!w||!w.u) return '';
    var s=getSess(), mine=(s&&s.uid===w.u);
    var nm=mine?'나':(nameMap()[w.u]||'다른 팀원');
    var ago=agoText(w.at);
    return nm+(ago?(' · '+ago):'');
  }catch(_){ return ''; }
}
/* 2.353 — 기록으로 남기려면 **정확한 날짜·시각**이 있어야 한다(사용자 "마지막 날짜와 시간 그리고 편집자 이름 · 로그처럼").
   `agoText`('2시간 전')는 지금을 읽기엔 좋지만 기록이 아니다 — 둘 다 준다. */
function editStamp(k){
  try{
    var w=whoMap()[k]; if(!w||!w.u||!w.at) return null;
    var s=getSess(), mine=!!(s&&s.uid===w.u);
    var d=new Date(w.at); if(isNaN(d)) return null;
    var now=new Date(), sameYear=(d.getFullYear()===now.getFullYear());
    var when=(sameYear?'':(d.getFullYear()+'.'))
      +(d.getMonth()+1)+'/'+d.getDate()+' '
      +String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    return {name:(mine?'나':(nameMap()[w.u]||'다른 팀원')), mine:mine, at:w.at, when:when, ago:agoText(w.at)};
  }catch(_){ return null; }
}
function editInfo(k){
  try{
    var w=whoMap()[k]; if(!w||!w.u) return null;
    var s=getSess();
    return {uid:w.u,at:w.at,mine:!!(s&&s.uid===w.u),name:(s&&s.uid===w.u)?'나':(nameMap()[w.u]||'')};
  }catch(_){ return null; }
}
/* ══ 1.634 · 소유자에게 한 번 알린다 ═════════════════════════════════════════
   이 판부터 팀 자료는 **임원만 편집**이 기본이다. 이미 쓰고 있던 팀에서는 어제까지 고치던
   코칭스태프가 오늘 못 고치게 된다 — 그걸 조용히 바꾸면 그 팀은 "저장이 안 된다"만 겪는다.
   그건 이 프로젝트가 반복해서 데인 자리다(1.514·1.619).
   그래서 아직 정하지 않은 팀(staffEdit 이 문서에 없는 팀)의 **소유자에게만** 한 번 알린다.
   코칭스태프에게는 알리지 않는다 — 그들에게는 gate() 배너가 이미 이유를 말해 준다. */
function staffEditNotice(){
  try{
    if(!isTeamWs()) return;
    var w=activeWsObj(); if(!w||w.role!=='owner') return;      /* 정할 수 있는 사람에게만 */
    var p=null; try{ p=JSON.parse(permsRaw()||'null'); }catch(_){}
    if(!p) return;                                             /* 권한 문서가 아직 없는 팀은 대상이 아니다 */
    if(p.staffEdit) return;                                    /* 이미 정했다 */
    var seen=null; try{ seen=localStorage.getItem('ps_staffedit_notice'); }catch(_){}
    if(seen) return;
    try{ localStorage.setItem('ps_staffedit_notice',String(Date.now())); }catch(_){}
    chip('🔒 이제 팀 자료는 임원만 편집합니다 — 눌러서 확인', function(){
      psModal({title:'팀 자료는 임원만 편집합니다',
        body:'<div style="line-height:1.6">이 판부터 <b>임원이 입력하고 코칭스태프는 봅니다.</b> '
          +'코칭스태프 화면에는 편집 버튼이 사라지고, 고칠 곳이 있으면 임원에게 말하게 됩니다.'
          +'<br><br>예전처럼 코칭스태프도 편집하게 하려면 <b>계정 → 권한 관리</b>에서 '
          +'‘코칭스태프도 팀 자료를 편집’을 켜세요. 특정 코치에게만 열어 줄 수도 있습니다.</div>',
        hideCancel:true,ok:'알겠습니다'});
    });
  }catch(_){}
}
/* ── 이 자료가 어떻게 공유되는지 한 줄 ────────────────────────────────────────
   IDP 화면에 이미 이런 줄이 있다("코치만 볼 수 있어요 · 이미지노트는 나만 봅니다").
   그 한 곳에만 있어서, 나머지 화면에서는 사용자가 **자기가 쓴 게 어디까지 보이는지 모른다.**
   같은 말을 어디서나 할 수 있게 옮긴다.

   ⚠ 여기 적는 말은 **거짓이면 아무 말도 안 하느니만 못하다.** 그래서 문장을 키마다 손으로
     쓰지 않고, 실제 판정에 쓰는 것과 같은 목록에서 만든다(PLAYER_BLIND · PERSONAL · isItemKey). */
function shareNote(k){
  try{
    if(!isTeamWs()) return '이 기기와 내 다른 기기에만 저장됩니다';
    if(PERSONAL[k]) return '나만 봅니다 · 팀에 올라가지 않습니다';
    if(k==='cs_scout_targets_v1') return '임원만 봅니다 · 코칭스태프에게도 안 보입니다';
    var edit=(k==='process_coach_v1'||k==='cs_perms_v1'||k==='cs_assign_v1')
      ? '운영진만 편집' : '코칭스태프가 함께 편집';
    var see=(PLAYER_BLIND.indexOf(k)>=0||isItemKey(k))
      ? '선수에게는 안 보입니다' : '팀 전원이 봅니다';
    return edit+' · '+see;
  }catch(_){ return ''; }
}
function kvPushRows(at,rows,onOk,label){
  if(!rows||!rows.length) return Promise.resolve();
  /* 2.622 — 일정 행의 그림을 ps_blob 으로 먼저 보내고 행에는 참조만 남긴다(실패·미설치면 통째 전송으로 물러선다) */
  return blobPrepRows(at,rows).then(function(){ return kvPushRowsInner(at,rows,onOk,label); });
}
function kvPushRowsInner(at,rows,onOk,label){
  label=label||'kv_push';
  if(!rows||!rows.length) return Promise.resolve();
  var plain=rows.filter(function(r){return r._casCupd==null&&!r._casMissing;}),cas=rows.filter(function(r){return r._casCupd!=null||r._casMissing;});
  var chunks=[],cur=[],sz=0;
  plain.forEach(function(r0){
    var l=JSON.stringify(r0).length;
    if(cur.length&&(sz+l>KV_PUSH_BYTES||cur.length>=KV_PUSH_ROWS)){ chunks.push(cur); cur=[]; sz=0; }
    cur.push(r0); sz+=l;
  });
  if(cur.length)chunks.push(cur);
  /* 2.599 — 확인 응답에서 v 를 돌려받지 않는다(올린 만큼 다시 내려받아 이그레스가 2배였다 — 실측 30일 일정 503MB·스카우트 415MB).
     select=workspace_id,k,cupd 만 받고 cupd 로 대조한다: 가드가 거부하면 old.v 와 함께 old.cupd 를 돌리므로 cupd 가 다르다.
     단 «같은 원문 재전송»(응답 유실 뒤 재시도)도 가드가 old.cupd 를 유지하므로, cupd 가 다른 키만 v 를 다시 읽어 진짜 거부인지 가른다(드문 경로). */
  function confirmed(ch,got){
    if(!Array.isArray(got))throw syncIssue('sync_confirm_missing',label,'server confirmation missing');
    function finish(bad){
      if(bad.length){var e=syncIssue('sync_server_rejected',label,'server rejected');e.psRejectedKeys=bad.map(function(x){return x.k;});throw e;}
      ch.forEach(function(req){try{holdClear(req.k);importApprovalClear(req.k);}catch(_){}});
      if(onOk)onOk(ch);return got;
    }
    var doubt=ch.filter(function(req){return !got.some(function(row){
      return String(row.workspace_id||'')===String(req.workspace_id||'')&&row.k===req.k&&Number(row.cupd)===Number(req.cupd);
    });});
    if(!doubt.length)return Promise.resolve().then(function(){return finish([]);});
    var byWs={}; doubt.forEach(function(req){ (byWs[req.workspace_id]=byWs[req.workspace_id]||[]).push(req); });
    return Promise.all(Object.keys(byWs).map(function(w0){
      var reqs=byWs[w0];
      return syncFetch(label+'_verify',BASE+'/rest/v1/ps_kv?workspace_id=eq.'+encodeURIComponent(w0)+'&'+kvInFilter(reqs.map(function(x){return x.k;}))+'&select=k,v',{headers:hj(at)})
        .then(function(r){ if(!r.ok)throw syncHttpError(label+'_verify',r.status); return r.json(); })
        .then(function(rows){ var sv={}; (rows||[]).forEach(function(x){sv[x.k]=x.v;}); return reqs.filter(function(req){ return sv[req.k]!==req.v; }); });
    })).then(function(parts){ return finish([].concat.apply([],parts)); });
  }
  /* 2.604 — 청크(최대 15행)가 403 이면 어느 키가 막혔는지 모른 채 회차 전체가 실패하고 다음 회차에 그대로 반복됐다.
     403 이면 행을 하나씩 다시 보내 막힌 키만 가려낸다: 막힌 키는 ps_sync_403_v1(6시간)·ps_sync_denied(칩) 에 적고 버리고, 나머지는 확정한다. */
  function note403(k){ try{ var m3=JSON.parse(localStorage.getItem('ps_sync_403_v1')||'{}')||{}; m3[k]=Date.now(); localStorage.setItem('ps_sync_403_v1',JSON.stringify(m3));
      var dl=JSON.parse(localStorage.getItem('ps_sync_denied')||'[]')||[]; if(dl.indexOf(k)<0)dl.push(k); localStorage.setItem('ps_sync_denied',JSON.stringify(dl.slice(0,6))); }catch(_){}
    try{ syncDiagnostic('push-403-key',new Error(String(k))); }catch(_){} }
  function postChunk(ch){
    return syncFetch(label,BASE+'/rest/v1/ps_kv?select=workspace_id,k,cupd',{method:'POST',
        headers:(function(){var h=hj(at);h['Prefer']=prefBuild('resolution=merge-duplicates,return=representation');return h;})(),
        body:JSON.stringify(ch)});
  }
  function isolate403(ch){
    return ch.reduce(function(p,row){ return p.then(function(acc){
      return postChunk([row]).then(function(r){
        if(r.status===403){ note403(row.k); return acc; }
        if(!r.ok)throw syncHttpError(label,r.status);
        return r.text().then(function(t){ var got=null;try{got=t?JSON.parse(t):null;}catch(_){} return Promise.resolve(confirmed([row],got)).then(function(g){ return acc.concat(Array.isArray(g)?g:[]); }); });
      });
    }); },Promise.resolve([]));
  }
  var run=chunks.reduce(function(p,ch){ return p.then(function(){
    return postChunk(ch)
      .then(function(r){
        if(r.status===403)return isolate403(ch);
        if(!r.ok)throw syncHttpError(label,r.status);
        return r.text().then(function(t){
          var got=null;try{got=t?JSON.parse(t):null;}catch(_){}
          return confirmed(ch,got);
        });
      });
  }); },Promise.resolve());
  var _legacyRun=function(){ return chunks.reduce(function(p,ch){ return p.then(function(){
    return syncFetch(label,BASE+'/rest/v1/ps_kv?select=workspace_id,k,cupd',{method:'POST',
        /* BEFORE trigger가 OLD를 돌려 거부해도 HTTP는 2xx다. 실제 저장된 행의 k·cupd 를
           받아 요청과 대조해야 '클라우드 저장됨'으로 잘못 확정하지 않는다(2.599: v 는 안 받는다). */
        headers:(function(){var h=hj(at);h['Prefer']=prefBuild('resolution=merge-duplicates,return=representation');return h;})(),
        body:JSON.stringify(ch)})
      .then(function(r){
        if(!r.ok)throw syncHttpError(label,r.status);
        return r.text().then(function(t){
          var got=null;try{got=t?JSON.parse(t):null;}catch(_){}
          return confirmed(ch,got);
        });
      });
  }); },Promise.resolve()); };   /* 2.604 — 옛 경로(참고용, 안 부름) */
  /* 검증된 파일 가져오기는 읽은 서버 cupd가 아직 같을 때만 PATCH한다.
     읽기와 쓰기 사이에 다른 기기가 저장했다면 0행이 돌아오고, 그 서버본을
     덮지 않은 채 다음 회차에 다시 투영·병합한다. */
  return cas.reduce(function(p,req){return p.then(function(){
    var missing=!!req._casMissing,url=BASE+'/rest/v1/ps_kv?select=workspace_id,k,cupd',method='POST',body={workspace_id:req.workspace_id,k:req.k,v:req.v,cupd:req.cupd};
    if(!missing){method='PATCH';url=BASE+'/rest/v1/ps_kv?workspace_id=eq.'+encodeURIComponent(req.workspace_id)+'&k=eq.'+encodeURIComponent(req.k)+'&cupd=eq.'+encodeURIComponent(req._casCupd)+'&select=workspace_id,k,cupd';body={v:req.v,cupd:req.cupd};}
    var h=hj(at);h['Prefer']=prefBuild((missing?'resolution=ignore-duplicates,':'')+'return=representation');
    return syncFetch(label+'_cas',url,{method:method,headers:h,body:JSON.stringify(body)}).then(function(r){
      if(!r.ok)throw syncHttpError(label+'_cas',r.status);
      return r.text().then(function(t){var got=null;try{got=t?JSON.parse(t):null;}catch(_){};if(!Array.isArray(got)||!got.length){throw syncIssue('sync_conflict',label+'_cas','server changed during import');}return confirmed([req],got);});
    });
  });},run);
}
/* ── 1.568 안전장치 — 덮어쓰기 전 무조건 남긴다 ──────────────────────────
   2026-08-05 사고: 한 기기에서 스카우팅 후보가 잘못 지워졌고, 그 빈 값이 서버로 올라가
   다른 기기의 34명을 덮었다. '충돌'이 아니라 정상 동기화로 판정돼 백업조차 남지 않았다.
   이제 **받은 값으로 로컬을 덮을 때는 언제나** 이전 값을 구조선(rescue)에 남긴다.
   충돌 여부와 무관하다 — 조용히 사라지는 경로를 없애는 게 목적이다. */
var RESCUE_LIST='ps_rescue_list_v1', RESCUE_MAX=8, RESCUE_MAXLEN=400000;
function rescueList(){ if(!dataUnlocked())return [];try{ return JSON.parse(localStorage.getItem(RESCUE_LIST)||'[]')||[]; }catch(_){ return []; } }
function rescueSetList(a){ try{ localStorage.setItem(RESCUE_LIST,JSON.stringify(a.slice(-RESCUE_MAX))); }catch(_){} }
/* 목록형 값에서 항목 수를 센다 — 못 세면 null(경고하지 않는다) */
function rescueCount(str){
  try{
    var v=JSON.parse(str);
    for(var i=0;i<3;i++){ if(typeof v==='string')v=JSON.parse(v); else if(v&&typeof v==='object'&&'value' in v)v=v.value; else break; }
    if(Array.isArray(v))return v.length;
    if(v&&typeof v==='object'){
      if(Array.isArray(v.players))return v.players.length;
      if(Array.isArray(v.items))return v.items.length;
    }
  }catch(_){}
  return null;
}
function rescueStash(k,oldVal,newVal){
  if(COPIES_OFF)return;
  try{
    if(oldVal==null||oldVal===newVal)return;
    if(String(oldVal).length>RESCUE_MAXLEN)return;      /* 너무 큰 값은 저장 공간을 잡아먹는다 */
    var before=rescueCount(oldVal), after=rescueCount(newVal);
    localStorage.setItem('ps_rescue_'+k,String(oldVal));
    var a=rescueList().filter(function(x){ return x.k!==k; });
    a.push({k:k,at:Date.now(),before:before,after:after});
    rescueSetList(a);
    /* 항목이 많이 줄었으면 조용히 넘어가지 않는다 */
    var lost=(before!=null&&after!=null)?(before-after):0;
    if(lost>=5||(before>=4&&after<=before/2)){
      try{ chip('⚠ '+keyLabel(k)+' 가 '+before+' → '+after+' 로 줄었어요 — 눌러서 되돌리기', rescueOpen); }catch(_){}
    }
  }catch(_){}
}
/* 1.647 — 서버본으로 되돌리기 전에 구조선이 실제로 남았는지 확인한다.
   rescueStash는 용량 제한·브라우저 quota 때문에 저장하지 못해도 예외를 밖으로
   내보내지 않는다. 그 상태에서 서버본을 적용하면 "되돌리기 가능"이라는 약속과 달리
   이 기기 원문을 잃는다. 원문과 목록 둘 다 되읽힌 때만 덮어쓰기를 허용한다. */
function rescuePrepared(k,oldVal,newVal){
  if(COPIES_OFF)return true;   /* 2.674 — 사본 없이 서버본을 그대로 받는다 */
  if(oldVal==null||oldVal===newVal)return true;
  try{
    rescueStash(k,oldVal,newVal);
    if(localStorage.getItem('ps_rescue_'+k)!==String(oldVal))return false;
    return rescueList().some(function(x){return x&&x.k===k;});
  }catch(_){return false;}
}
/* 되돌리기 창 — 무엇이 언제 몇 개에서 몇 개로 줄었는지 보이고, 한 줄씩 되돌린다 */
function rescueOpen(){
  if(!dataUnlocked()){renderDataLock(false);return;}
  var list=rescueList().slice().reverse();
  if(!list.length){ try{ psModal({title:'되돌릴 자료가 없습니다',hideCancel:true,ok:'확인'}); }catch(_){} return; }
  var body='<div style="margin-bottom:10px">동기화로 <b>이 기기의 값이 덮인</b> 자료입니다. '
    +'되돌리면 이 기기 것으로 돌아가고, 다음 동기화 때 팀에도 그대로 올라갑니다.</div>';
  body+=list.map(function(x){
    var cnt=(x.before!=null&&x.after!=null)?(x.before+' → '+x.after):'';
    var warn=(x.before!=null&&x.after!=null&&x.before-x.after>=5);
    return '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid rgba(128,128,128,.22)">'
      +'<div style="flex:1;min-width:0"><b>'+esc(keyLabel(x.k))+'</b>'
      +(cnt?('<span style="margin-left:7px;font-size:11px;font-weight:800;color:'+(warn?'#c24a46':'#8a8f98')+'">'+esc(cnt)+'</span>'):'')
      +'<div style="font-size:11px;opacity:.7">'+new Date(x.at).toLocaleString()+'</div></div>'
      +'<button type="button" data-resv="'+esc(x.k)+'" style="border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer">되돌리기</button>'
      +'</div>';
  }).join('');
  var mo=null;
  try{ mo=psModal({title:'덮인 자료 되돌리기',body:body,hideCancel:true,ok:'닫기'}); }catch(_){}
  document.querySelectorAll('[data-resv]').forEach(function(b){
    b.addEventListener('click',function(){
      var k=b.getAttribute('data-resv');
      rescueRestore(k).then(function(ok){
        try{ if(mo&&mo.close)mo.close(true); }catch(_){}
        try{ psModal({title:ok?'되돌렸습니다':'되돌리지 못했습니다',
          body:ok?('<b>'+esc(keyLabel(k))+'</b> 를 이 기기의 이전 값으로 되돌렸습니다. 화면을 새로고침하면 보입니다.')
                 :'저장된 이전 값을 찾지 못했습니다.',hideCancel:true,ok:'확인'}); }catch(_){}
      });
    });
  });
}
/* 1.589 — **되돌린 값을 다시 읽어 확인한 뒤에만** 백업을 지운다.
   그전에는 kvWrite 가 true 만 주면 성공으로 보고 ps_rescue_ 원본을 지웠는데,
   IDBK 에 빠진 키(스카우팅 후보 등)는 kvWrite 가 localStorage 쪽에 써서
   **앱이 읽는 IndexedDB 는 그대로**였다 — 복구는 안 되고 백업만 사라졌다(2026-08-05 실제 사고).
   IDBK 는 위에서 채웠지만, 목록이 또 어긋날 수 있으므로 이 함수 자체가 결과를 확인하게 한다.
   확인에 실패하면 백업을 남기고 false 를 돌려준다 — 되돌릴 기회를 잃지 않는 쪽이 항상 낫다. */
function rescueRestore(k){
  if(!dataUnlocked())return Promise.resolve(false);
  var v=null; try{ v=localStorage.getItem('ps_rescue_'+k); }catch(_){}
  if(v==null) return Promise.resolve(false);
  var writes=[];
  /* 되돌린 값이 '내가 방금 고친 것'으로 잡혀야 다음 동기화에서 서버로 올라간다(로컬 승) */
  try{ var m=meta(); delete m.h[k]; setMeta(m); }catch(_){}
  var ok=kvWrite(k,v,writes);
  return Promise.all(writes).catch(function(){}).then(function(){
    if(!ok) return false;
    /* 앱이 실제로 읽는 자리에서 되읽어 본다 */
    var verify = idbBacked(k)
      ? window.storage.get(k).then(function(r){ return r?r.value:null; }).catch(function(){ return null; })
      : Promise.resolve((function(){ try{ return localStorage.getItem(k); }catch(_){ return null; } })());
    return verify.then(function(cur){
      if(cur!==v){
        /* 백업을 '남기는' 것만으로는 부족하다 — kvWrite 안의 rescueStash 가 방금
           **되돌리려던 그 백업을 지금 값(망가진 값)으로 덮어썼기 때문이다.**
           실패했을 때 정작 되돌릴 값이 사라지므로, 원본 v 를 다시 써 넣는다. */
        try{ localStorage.setItem('ps_rescue_'+k,v); }catch(_){}
        syncDiagnostic('rescue-restore-verify',new Error('restore did not land: '+k));
        try{ chip('되돌리기가 저장되지 않았습니다 — 백업은 그대로 두었습니다. 다시 시도해 주세요.'); }catch(_){}
        return false;
      }
      try{ localStorage.removeItem('ps_rescue_'+k);
        rescueSetList(rescueList().filter(function(x){ return x.k!==k; })); }catch(_){}
      return true;
    });
  });
}
/* ── 1.573 출고 검사 — 빈 값이 팀으로 올라가는 것을 막는다 ─────────────────────
   1.568 구조선은 **받는 쪽**만 지킨다(kvWrite). 빈 값이 **올라가는 것**은 아무도 막지 않아서,
   사고가 나면 원인 기기는 조용히 올리고 다른 기기들이 저마다 되돌리기를 눌러야 했다 —
   그 사이 새로 로그인한 기기는 그냥 빈 것을 받는다. 되돌린 기기와 안 돌린 기기가 다시 싸운다.
   이제 **올리기 직전에도 같은 잣대로 센다.** 크게 줄었으면 올리지 않고 멈춘다(보류).
   보류하는 동안 서버도 이 기기도 그대로다 — 지운 것이 되살아나지 않고, 다음 회차에 다시 시도한다.
   사용자가 [팀에 올리기]를 누르면 그 값에 한해 통과시킨다. */
var HOLD_LIST='ps_hold_list_v1', HOLD_MAX=12;
/* ══ 2.626 · 막지 않고 되돌리기 ══════════════════════════════════════════════════
   목업 둘째 판. 급감 보류는 «사람 승인» 에 기댔고, 승인 화면은 설정 안에 있어 아무도 안 봤다 — 2026-09-06 실측: 풋볼A 저장이
   보류에 걸려 승인 전엔 조용히 안 올라갔다(코치 기기 미동기화의 원인). 새 규칙: **줄어든 값은 올린다. 대신 직전 팀 판본을 이 기기에
   남기고 «n개가 빠진 채 올라갔어요 [되돌리기]» 를 그 자리에 띄운다.** 서버 ps_kv_history 가 90일 남아 있으니 막을 이유가 없다.
   ⚠ 예외 하나 — **0 으로 비는 것**(before≥4 → after 0)은 그대로 보류한다. 2026-08-05 스카우팅 34→1, 2026-09-04 빈 일정 덮어쓰기가
      전부 «기기가 비어서» 였다. 코치가 목록 전체를 지우는 일은 드물고, 빈 값이 팀에 퍼지면 되돌리기 전에 다른 기기가 받는다. */
var UNDO_LIST='ps_undo_list_v1', UNDO_TTL=24*3600*1000;
function undoKey(k){ return 'ps_undo_'+k; }
function undoList(){ try{ return (JSON.parse(localStorage.getItem(UNDO_LIST)||'[]')||[]).filter(function(x){ return x&&x.k&&(Date.now()-(+x.at||0))<UNDO_TTL; }); }catch(_){ return []; } }
function undoSetList(a){ try{ localStorage.setItem(UNDO_LIST,JSON.stringify(a.slice(-6))); }catch(_){} }
function undoStash(k,beforeRaw,afterRaw,beforeN,afterN){
  var raw=String(beforeRaw);
  var p=window.storage?window.storage.set(undoKey(k),raw):Promise.resolve().then(function(){ localStorage.setItem(undoKey(k),raw); });
  return p.then(function(){
    var a=undoList().filter(function(x){ return x.k!==k; });
    a.push({k:k,at:Date.now(),before:beforeN,after:afterN,h:hash(afterRaw)}); undoSetList(a);
    try{ window.dispatchEvent(new CustomEvent('ps-sync-state')); }catch(_){}
    return true;
  }).catch(function(e){ syncDiagnostic('undo-stash',e); return false; });
}
function undoGet(k){
  if(window.storage)return window.storage.get(undoKey(k)).then(function(r){ return r?r.value:null; }).catch(function(){ return null; });
  var v=null; try{ v=localStorage.getItem(undoKey(k)); }catch(_){} return Promise.resolve(v);
}
function undoDismiss(k){
  undoSetList(undoList().filter(function(x){ return x.k!==k; }));
  try{ if(window.storage)window.storage.del(undoKey(k)); else localStorage.removeItem(undoKey(k)); }catch(_){}
  try{ window.dispatchEvent(new CustomEvent('ps-sync-state')); }catch(_){}
}
/* 직전 팀 판본을 이 기기에 다시 쓰고(로컬 승으로 잡혀 다음 회차에 올라간다) 바로 한 회차 돈다 */
function undoRestore(k){
  if(!dataUnlocked())return Promise.resolve(false);
  return undoGet(k).then(function(v){
    if(v==null)return false;
    var writes=[]; try{ var m=meta(); delete m.h[k]; setMeta(m); }catch(_){}
    var ok=kvWrite(k,v,writes);
    return Promise.all(writes).catch(function(){}).then(function(){
      if(!ok)return false;
      try{ localStorage.setItem('ps_push_ok_'+k,hash(v)); }catch(_){}   /* 되돌린 값은 묻지 않고 올린다 */
      undoDismiss(k);
      try{ syncNow('undo'); }catch(_){}
      return true;
    });
  });
}
/* 값에 담긴 항목 수. rescueCount(목록·players·items)로 못 세면 —
   ① 안에 배열 칸이 있으면 그 길이의 합(IDP 문서·보관함 폴더처럼 여러 목록을 담은 문서)
   ② 배열이 하나도 없으면 칸 수.
   rescueCount 자체는 건드리지 않는다 — 1.568 받는 쪽 경고의 잣대를 바꾸지 않기 위해. */
/* 1.593 — **중첩된 내용까지 센다.**
   예전에는 최상위 배열만 봤다. 그런데 주간 일정(process_coach_v1)은 이렇게 생겼다:
     { weeks:{ 0:[7일], 1:[7일], … }, templates:[], wk, dayIdx, … }
   최상위 배열이 비어 있는 templates 하나뿐이라 **127KB·8주치 일정이 0개로 세어졌다.**
   psCount 는 pushHold 가 쓰는 잣대다 → 일정은 통째로 비어도 bigDrop(0,0) 이라 **보호가 애초에 안 걸렸다.**
   (2026-08-06 올린 기록에 `process_coach_v1(0)` 이 찍혀서 발견 — 화면엔 8주치가 멀쩡히 있었다)
   깊이 3까지 내려가며 배열 길이를 더한다. 하나도 없으면 예전처럼 칸 수로 돌아간다. */
/* 2.624 — `grpWeeks`(2.214 조별 사본, 2.380 부터 안 씀)는 세지 않는다. 2.600 이 저장 때 그걸 빼면서 psCount 가
   630→294 로 반토막 나 **가짜 «급감 보류»** 가 걸렸다(2026-09-06 실계정 실측 — 풋볼A 문서를 저장하자 보류, 승인해야 올라감).
   서버 문서에 옛 사본이 남은 팀은 전부 같은 보류를 만나고, 승인 없이는 조용히 안 올라간다 — 풋볼A 코치 기기가 9/4 이후
   못 올리던 것의 가장 유력한 원인. 내용(weeks)만 세면 전후가 같다. */
function psCountDeep(v,depth){
  if(v==null||depth>3) return 0;
  if(Array.isArray(v)) return v.length;
  if(typeof v!=='object') return 0;
  var s=0;
  for(var k in v){ if(k==='grpWeeks')continue; if(Object.prototype.hasOwnProperty.call(v,k)) s+=psCountDeep(v[k],depth+1); }
  return s;
}
/* 2.626 — 중첩 배열 항목 수만(칸 수 폴백 없이). 0 이면 «비움» */
function psDeepOf(str){
  try{ var v=JSON.parse(str); for(var i=0;i<3;i++){ if(typeof v==='string')v=JSON.parse(v); else if(v&&typeof v==='object'&&'value' in v)v=v.value; else break; }
    return (v&&typeof v==='object')?psCountDeep(v,0):0; }catch(_){ return 0; }
}
/* 2.715 — 선수단·스카우트는 «선수 수»로만 비움을 판정한다. psDeepOf 는 attrs(24)·positions(12+) 배열까지 세어
   선수 0명짜리 첫 실행 문서(2,653바이트)를 «비움 아님»으로 보고 올렸다(9/8 14:07 풋볼A — 그 다음 저장이
   0→89 라 서버 모양 가드(2.681, 1.6배 규칙)까지 지나갔다). */
function psDeepOfKey(k,str){
  if(k==='cs_squad_v1'||k==='scout_tool_v1'){
    try{ var v=JSON.parse(str); for(var i=0;i<3;i++){ if(typeof v==='string')v=JSON.parse(v); else if(v&&typeof v==='object'&&'value' in v)v=v.value; else break; }
      return (v&&Array.isArray(v.players))?v.players.length:0; }catch(_){ return 0; }
  }
  return psDeepOf(str);
}
function psCount(str){
  var n=rescueCount(str); if(n!=null)return n;
  try{
    var v=JSON.parse(str);
    for(var i=0;i<3;i++){ if(typeof v==='string')v=JSON.parse(v); else if(v&&typeof v==='object'&&'value' in v)v=v.value; else break; }
    if(v&&typeof v==='object'&&!Array.isArray(v)){
      var deep=psCountDeep(v,0);
      if(deep>0) return deep;                       /* 중첩 포함 실제 항목 수 */
      return Object.keys(v).length;                 /* 배열이 아예 없는 문서는 칸 수 */
    }
  }catch(_){}
  return null;
}
/* 1.568 과 같은 잣대: 5개 이상 줄었거나, 4개 이상이던 것이 절반 이하로 줄었다 */
function bigDrop(before,after){
  if(before==null||after==null)return false;
  return (before-after>=5)||(before>=4&&after<=before/2);
}
function holdList(){ if(!dataUnlocked())return [];try{ return JSON.parse(localStorage.getItem(HOLD_LIST)||'[]')||[]; }catch(_){ return []; } }
function holdSetList(a){ try{ localStorage.setItem(HOLD_LIST,JSON.stringify(a.slice(-HOLD_MAX))); }catch(_){} }
function holdUnlist(k){ try{ holdSetList(holdList().filter(function(x){ return x.k!==k; })); }catch(_){} }
function holdClear(k){ try{ holdUnlist(k); localStorage.removeItem('ps_push_ok_'+k); }catch(_){} }
/* 올리기 직전 검사. true 를 주면 이번 회차에는 올리지 않는다
   (m.h/m.c 를 갱신하지 않으므로 로컬은 계속 dirty → 확인 뒤 다음 회차에 올라간다). */
function pushHold(k,loc,srvVal,memN){
  try{
    var after=psCount(loc);
    if(after==null)return false;                        /* 셀 수 없는 값은 판단하지 않는다 */
    var before=(srvVal!=null)?psCount(srvVal):null;     /* 서버 값이 있으면 그게 가장 정확한 기준 */
    if(before==null)before=(memN==null?null:memN);
    if(!bigDrop(before,after))return false;
    var h=hash(loc), ok=null;
    try{ ok=localStorage.getItem('ps_push_ok_'+k); }catch(_){}
    /* 승인 토큰은 서버가 같은 원문을 확인할 때까지 남긴다. 네트워크가 한 번 끊겨도
       다음 자동 재시도가 다시 사람에게 같은 질문을 하지 않게 한다. */
    if(ok&&ok===h){ holdUnlist(k); return false; }      /* 사용자가 이 값을 승인했다 */
    /* 2.626 — 0 으로 비는 게 아니면 막지 않는다: 직전 팀 판본을 남기고 올린다(되돌리기는 위 undoRestore) */
    if(psDeepOfKey(k,loc)>0){   /* 배열 항목이 하나도 없으면(빈 목록·빈 일정) «비움» — psCount 의 칸 수 폴백(1~5)에 속지 않는다. 2.715: 선수단·스카우트는 선수 수 */
      var prevRaw=(srvVal!=null)?srvVal:syncBaseGet(k);
      if(prevRaw!=null&&prevRaw!==loc){ undoStash(k,prevRaw,loc,before,after); holdUnlist(k); return false; }
    }
    var a=holdList(), prev=null;
    a=a.filter(function(x){ if(x.k===k){ prev=x; return false; } return true; });
    /* 같은 값이면 이미 적어 둔 그대로 둔다 — 3분마다 다시 쓰지도, 다시 띄우지도 않는다.
       시각(at)은 '언제 줄었나'라서 회차마다 새로 찍으면 늘 방금 일처럼 보인다. */
    if(prev&&prev.h===h){ a.push(prev); holdSetList(a); return true; }
    a.push({k:k,at:Date.now(),before:before,after:after,h:h});
    holdSetList(a);
    try{ chip('⏸ '+keyLabel(k)+' 가 '+before+' → '+after+' 로 줄어 팀에 올리지 않았습니다 — 눌러서 확인', holdOpen); }catch(_){}
    return true;
  }catch(_){ return false; }
}
function holdLocal(k){
  if(idbBacked(k)) return window.storage.get(k).then(function(r){ return r?r.value:null; }).catch(function(){ return null; });
  var v=null; try{ v=localStorage.getItem(k); }catch(_){}
  return Promise.resolve(v);
}
/* 맞게 지운 것이다 — 지금 이 기기의 값을 팀에 올린다(그 값에 한해서만 통과) */
function holdApprove(k){
  if(!dataUnlocked())return false;
  return holdLocal(k).then(function(loc){
    if(loc==null){ holdClear(k); return false; }
    try{ localStorage.setItem('ps_push_ok_'+k,hash(loc)); }catch(_){}
    holdUnlist(k);
    return true;
  });
}
/* 검증된 복구처럼 호출자가 승인할 원문을 이미 정확히 알고 있는 경로. 읽는 사이 다른 탭이
   값을 바꾸면 승인하지 않는다 — 일반 holdApprove의 사용자 선택 동작은 그대로 둔다. */
function holdApproveExact(k,expectedRaw){
  if(!dataUnlocked())return Promise.resolve(false);
  return holdLocal(k).then(function(loc){
    if(loc==null||loc!==expectedRaw)return false;
    try{ localStorage.setItem('ps_push_ok_'+k,hash(loc)); }catch(_){}
    holdUnlist(k);return true;
  });
}
/* 잘못 지워진 것이다 — 팀에 있는 값을 받아 이 기기를 되돌린다.
   해시를 지금 값으로 맞춰 '내가 고친 적 없음'(dirty=false)으로, cupd 를 0으로 돌려
   '서버가 바뀜'(srvChanged=true)으로 만들면 다음 회차에 서버 값이 내려와 덮는다. */
function holdTakeServer(k){
  return holdLocal(k).then(function(loc){
    var m=meta(); m.h[k]=hash(loc); m.c[k]=0; delete m.n[k]; setMeta(m);
    holdClear(k);
    return true;
  });
}
/* 1.644 · 사용자가 해시를 검증한 '팀 파일 가져오기'는 일반
   자동 병합과 다른 의도적 교체다. 그래도 임의 로컬승리를 열지 않고,
   확인 직전과 글자 하나까지 같은 원문에만 전용 토큰을 난다.
   서버 원문 확인을 받으면 즉시 지운다. */
var IMPORT_OK_PREFIX='ps_section_import_ok_';
function importApprovalKey(k){return IMPORT_OK_PREFIX+String(activeWs()||'')+'_'+k;}
function importApprovalGet(k,raw){
  try{var o=JSON.parse(localStorage.getItem(importApprovalKey(k))||'null');
    /* 오프라인 가져오기는 하루 넘게 연결을 못 할 수도 있다. 팀·키·원문 해시가
       모두 같은 동안만 유효하고, 서버 확인·롤백에서 명시적으로 지운다. */
    return (o&&o.h===hash(raw))?o:null;}catch(_){return null;}
}
function importApproved(k,raw){
  return !!importApprovalGet(k,raw);
}
function importApprovalClear(k){try{localStorage.removeItem(importApprovalKey(k));}catch(_){} }
function importSpec(spec){
  spec=spec&&typeof spec==='object'?spec:{};var s=String(spec.section||''),out={};
  if(s==='players'||s==='scouting'||s==='gamemodel'||s==='match')out.section=s;
  if(s==='match'){
    var seen={};out.matchIds=(Array.isArray(spec.matchIds)?spec.matchIds:[]).map(function(id){return String(id||'');})
      .filter(function(id){if(!id||seen[id])return false;seen[id]=1;return true;});
    var incomingSeen={};out.incomingMatchIds=(Array.isArray(spec.incomingMatchIds)?spec.incomingMatchIds:[]).map(function(id){return String(id||'');})
      .filter(function(id){if(!id||incomingSeen[id])return false;incomingSeen[id]=1;return true;});
    var removedSeen={};out.removedMatchIds=(Array.isArray(spec.removedMatchIds)?spec.removedMatchIds:[]).map(function(id){return String(id||'');})
      .filter(function(id){if(!id||removedSeen[id]||incomingSeen[id])return false;removedSeen[id]=1;return true;});
    var fileDelSeen={};out.fileTombstoneIds=(Array.isArray(spec.fileTombstoneIds)?spec.fileTombstoneIds:[]).map(function(id){return String(id||'');})
      .filter(function(id){if(!id||fileDelSeen[id])return false;fileDelSeen[id]=1;return true;});
  }
  if(s==='gamemodel'){
    var posSeen={};out.positionTargets=(Array.isArray(spec.positionTargets)?spec.positionTargets:[]).map(function(x){return {id:String(x&&x.id||''),name:String(x&&x.name||'')};})
      .filter(function(x){var key=x.id+'\n'+importNormName(x.name);if((!x.id&&!x.name)||posSeen[key])return false;posSeen[key]=1;return true;});
  }
  return out;
}
function importApprovalPut(k,raw,spec){
  try{localStorage.setItem(importApprovalKey(k),JSON.stringify({at:Date.now(),h:hash(raw),s:importSpec(spec)}));return true;}catch(_){return false;}
}
function importApproveExact(k,expectedRaw,spec){
  return holdLocal(k).then(function(loc){
    if(loc==null||loc!==expectedRaw)return false;
    try{
      if(!importApprovalPut(k,loc,spec))return false;
      localStorage.setItem('ps_push_ok_'+k,hash(loc));
    }catch(_){return false;}
    holdUnlist(k);return true;
  });
}
var IMPORT_SCOUT_META=['scoutForm','scoutName','scoutRank','sbPitch','sbPitchCol'];
var IMPORT_NONPLAYER_META=IMPORT_SCOUT_META.concat(['staffReady']);
function importClone(v){return JSON.parse(JSON.stringify(v));}
function importOwn(o,k){return !!(o&&Object.prototype.hasOwnProperty.call(o,k));}
function importPlain(o){return !!(o&&typeof o==='object'&&!Array.isArray(o));}
function importRequire(ok,label){if(!ok)throw new Error(label||'가져오기 병합 형식 오류');}
function importNormName(v){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ko');}
function importFindPosition(list,target){
  list=Array.isArray(list)?list:[];var id=String(target&&target.id||''),name=importNormName(target&&target.name),byId=id?list.filter(function(x){return String(x&&x.id||'')===id;}):[];
  if(byId.length===1)return byId[0];if(!name)return null;var byName=list.filter(function(x){return importNormName(x&&x.name)===name;});return byName.length===1?byName[0]:null;
}
function importCanon(v){
  if(Array.isArray(v))return v.map(importCanon);
  if(v&&typeof v==='object'){var o={};Object.keys(v).sort().forEach(function(k){o[k]=importCanon(v[k]);});return o;}
  return v;
}
function importProjection(k,raw,spec){
  spec=importSpec(spec);if(!spec.section)return null;
  try{
    var d=JSON.parse(raw);
    if(spec.section==='match'&&k==='cs_match_del_v1'){
      if(!Array.isArray(d)||d.some(function(id){return typeof id!=='string'||!id;}))return null;
      var deleted={};d.forEach(function(id){deleted[id]=1;});
      return JSON.stringify(importCanon({
        incoming:(spec.incomingMatchIds||[]).map(function(id){return {id:id,deleted:!!deleted[id]};}),
        removed:(spec.removedMatchIds||[]).map(function(id){return {id:id,deleted:!!deleted[id]};})
      }));
    }
    if(k==='scout_tool_v1'){
      if(spec.section==='players'){
        if(!importPlain(d)||!Array.isArray(d.attrs)||!Array.isArray(d.positions)||!Array.isArray(d.players)||!importPlain(d.meta))return null;
        var meta=importClone(d.meta||{}),pos=importClone(d.positions||[]);
        IMPORT_NONPLAYER_META.forEach(function(x){delete meta[x];});
        pos.forEach(function(x){if(x&&typeof x==='object')delete x.ideal;});
        return JSON.stringify(importCanon({attrs:d.attrs||[],positions:pos,players:(d.players||[]).filter(function(x){return x&&x.type!=='target';}),meta:meta}));
      }
      if(spec.section==='scouting'){
        if(!importPlain(d)||!importPlain(d.meta))return null;
        var sm={};IMPORT_SCOUT_META.forEach(function(x){if(importOwn(d.meta,x))sm[x]=d.meta[x];});
        return JSON.stringify(importCanon(sm));
      }
      if(spec.section==='gamemodel'){
        if(!importPlain(d)||!Array.isArray(d.positions))return null;
        return JSON.stringify(importCanon((spec.positionTargets||[]).map(function(t){var x=importFindPosition(d.positions,t);return {id:t.id,name:t.name,present:!!x,ideal:importClone(x&&x.ideal!=null?x.ideal:{})};})));
      }
      if(spec.section==='match'){
        if(!importPlain(d)||!importPlain(d.meta)||!importPlain(d.meta.staffReady))return null;
        var ready=d&&d.meta&&d.meta.staffReady||{};
        return JSON.stringify(importCanon((spec.matchIds||[]).map(function(id){return {id:id,present:importOwn(ready,id),value:importOwn(ready,id)?ready[id]:null};})));
      }
    }
    if(spec.section==='match'&&(k==='cs_team_match_private_v1'||k.indexOf('cs_idp_pub_v1_')===0)){
      if(!importPlain(d))return null;
      if(k.indexOf('cs_idp_pub_v1_')===0&&(!importOwn(d,'matchMessages')||!importPlain(d.matchMessages)))return null;
      var src=k==='cs_team_match_private_v1'?d:((d&&d.matchMessages)||{});
      return JSON.stringify(importCanon((spec.matchIds||[]).map(function(id){return {id:id,present:importOwn(src,id),value:importOwn(src,id)?src[id]:null};})));
    }
  }catch(_){}
  return null;
}
function importProjectionKey(k,spec){
  spec=importSpec(spec);if(!spec.section)return false;
  if(k==='scout_tool_v1')return spec.section==='players'||spec.section==='scouting'||spec.section==='gamemodel'||spec.section==='match';
  return spec.section==='match'&&(k==='cs_match_del_v1'||k==='cs_team_match_private_v1'||k.indexOf('cs_idp_pub_v1_')===0);
}
function importRebaseRaw(k,localRaw,serverRaw,spec){
  spec=importSpec(spec);if(!spec.section)return localRaw;
  var recognized=k==='scout_tool_v1'||(spec.section==='match'&&(k==='cs_match_del_v1'||k==='cs_team_match_private_v1'||k.indexOf('cs_idp_pub_v1_')===0));
  try{
    var l=JSON.parse(localRaw),s=JSON.parse(serverRaw),out;
    if(spec.section==='match'&&k==='cs_match_del_v1'){
      importRequire(Array.isArray(l)&&Array.isArray(s),'경기 삭제 기록 병합 형식 오류');
      importRequire(!l.concat(s).some(function(id){return typeof id!=='string'||!id;}),'경기 삭제 기록 ID 오류');
      var incoming={},stale={},required={},requiredList=[];(spec.incomingMatchIds||[]).forEach(function(id){incoming[id]=1;});(spec.fileTombstoneIds||[]).forEach(function(id){stale[id]=1;});(spec.removedMatchIds||[]).forEach(function(id){if(!incoming[id]&&!required[id]){required[id]=1;requiredList.push(id);}});
      importRequire(requiredList.length<=60,'필수 경기 삭제 기록 범위 초과');
      var low=[],current=[];l.forEach(function(id){if(required[id])return;(stale[id]?low:current).push(id);});
      /* 오래된 파일 기록 < 이 기기의 현재 기록 < 방금 읽은 서버 기록 순으로 둔다.
         이번 파일로 실제 빠진 경기는 맨 뒤에 두어 60개 제한에서도 반드시 남긴다. */
      var merged=low.concat(current).concat(s).concat(requiredList),seen={},rev=[];
      for(var di=merged.length-1;di>=0&&rev.length<60;di--){var did=merged[di];if(incoming[did]||seen[did])continue;seen[did]=1;rev.push(did);}
      return JSON.stringify(rev.reverse());
    }
    if(k==='scout_tool_v1'){
      importRequire(importPlain(l)&&importPlain(s),'선수단 병합 문서 오류');
      out=importClone(s);
      if(spec.section==='players'){
        importRequire(Array.isArray(l.attrs)&&Array.isArray(l.positions)&&Array.isArray(l.players)&&importPlain(l.meta),'가져온 선수단 형식 오류');
        importRequire(Array.isArray(s.attrs)&&Array.isArray(s.positions)&&Array.isArray(s.players)&&(!importOwn(s,'meta')||importPlain(s.meta)),'서버 선수단 형식 오류');
        var ideals={},idealNames={};(s.positions||[]).forEach(function(x){if(!x||x.ideal==null)return;ideals[String(x.id||'')]=x.ideal;(idealNames[importNormName(x.name)]||(idealNames[importNormName(x.name)]=[])).push(x.ideal);});
        var positions=importClone(l.positions||[]);positions.forEach(function(x){if(!x||typeof x!=='object')return;var id=String(x.id||''),a=idealNames[importNormName(x.name)]||[];delete x.ideal;if(importOwn(ideals,id))x.ideal=importClone(ideals[id]);else if(a.length===1)x.ideal=importClone(a[0]);});
        var meta=importClone(l.meta||{}),serverMeta=s.meta||{};IMPORT_NONPLAYER_META.forEach(function(x){delete meta[x];if(importOwn(serverMeta,x))meta[x]=importClone(serverMeta[x]);});
        out.attrs=importClone(l.attrs||[]);out.positions=positions;
        out.players=importClone((l.players||[]).filter(function(x){return x&&x.type!=='target';}).concat((s.players||[]).filter(function(x){return x&&x.type==='target';})));
        out.meta=meta;if(importOwn(l,'_items'))out._items=importClone(l._items);else delete out._items;
        return JSON.stringify(out);
      }
      if(spec.section==='scouting'){
        importRequire(importPlain(l.meta)&&(!importOwn(s,'meta')||importPlain(s.meta)),'스카우팅 설정 병합 형식 오류');
        out.meta=importClone(s.meta||{});IMPORT_SCOUT_META.forEach(function(x){delete out.meta[x];if(importOwn(l.meta,x))out.meta[x]=importClone(l.meta[x]);});
        return JSON.stringify(out);
      }
      if(spec.section==='gamemodel'){
        importRequire(Array.isArray(l.positions)&&Array.isArray(s.positions),'게임모델 포지션 병합 형식 오류');
        (spec.positionTargets||[]).forEach(function(t){var from=importFindPosition(l.positions,t),to=importFindPosition(out.positions,t);if(from&&to)to.ideal=importClone(from.ideal==null?{}:from.ideal);});
        return JSON.stringify(out);
      }
      if(spec.section==='match'){
        importRequire((!importOwn(l,'meta')||importPlain(l.meta))&&(!importOwn(s,'meta')||importPlain(s.meta)),'경기 준비 자료 병합 형식 오류');
        importRequire(!(l.meta&&importOwn(l.meta,'staffReady'))||importPlain(l.meta.staffReady),'가져온 경기 준비 자료 오류');
        importRequire(!(s.meta&&importOwn(s.meta,'staffReady'))||importPlain(s.meta.staffReady),'서버 경기 준비 자료 오류');
        out.meta=out.meta&&typeof out.meta==='object'&&!Array.isArray(out.meta)?out.meta:{};var fromReady=l&&l.meta&&l.meta.staffReady||{},toReady=out.meta.staffReady&&typeof out.meta.staffReady==='object'&&!Array.isArray(out.meta.staffReady)?out.meta.staffReady:{};
        (spec.matchIds||[]).forEach(function(id){delete toReady[id];if(importOwn(fromReady,id))toReady[id]=importClone(fromReady[id]);});out.meta.staffReady=toReady;return JSON.stringify(out);
      }
    }
    if(spec.section==='match'&&(k==='cs_team_match_private_v1'||k.indexOf('cs_idp_pub_v1_')===0)){
      importRequire(importPlain(l)&&importPlain(s),'경기 메모 병합 문서 오류');
      if(k.indexOf('cs_idp_pub_v1_')===0)importRequire((!importOwn(l,'matchMessages')||importPlain(l.matchMessages))&&(!importOwn(s,'matchMessages')||importPlain(s.matchMessages)),'경기 메시지 병합 형식 오류');
      out=importClone(s);var from=k==='cs_team_match_private_v1'?l:((l&&l.matchMessages)||{}),to;
      if(k==='cs_team_match_private_v1')to=out;
      else{if(!out||typeof out!=='object'||Array.isArray(out))out={};to=out.matchMessages&&typeof out.matchMessages==='object'&&!Array.isArray(out.matchMessages)?out.matchMessages:{};out.matchMessages=to;}
      (spec.matchIds||[]).forEach(function(id){delete to[id];if(importOwn(from,id))to[id]=importClone(from[id]);});
      return JSON.stringify(out);
    }
  }catch(e){syncDiagnostic('import-rebase',e);return recognized?null:localRaw;}
  return recognized?null:localRaw;
}
function importApprovedRebase(k,localRaw,serverRaw){
  var rec=importApprovalGet(k,localRaw);if(!rec)return null;
  var raw=importRebaseRaw(k,localRaw,serverRaw,rec.s||{});
  if(typeof raw!=='string')return null;
  if(raw!==localRaw&&!importApprovalPut(k,raw,rec.s||{}))return null;
  return {raw:raw,spec:rec.s||{}};
}
function importScheduleIntent(raw){
  try{var o=JSON.parse(raw);['scheduleRev','scheduleBaseRev','scheduleToken','scheduleBaseToken','wk','dayIdx'].forEach(function(k){delete o[k];});return JSON.stringify(o);}catch(_){return null;}
}
function importServerRaw(k,raw){
  if(isTeamWs()&&k.indexOf('cs_idp_v1_')===0){
    try{var o=JSON.parse(raw);if(o&&Array.isArray(o.imgNotes)&&o.imgNotes.length)o.imgNotes=[];return JSON.stringify(o);}catch(_){}
  }
  return raw;
}
/* 파일 적용 성공은 push 개수가 아니라 서버에서 같은 원문을 다시 읽었을 때만 확정한다.
   팀에서 개인 채널로 보내는 경기 개인 메모와, 팀 IDP에서 서버에 싣지 않는 이미지 정책도
   실제 동기화 경로와 똑같이 투영해 비교한다. */
function importVerifyExact(written,expectedWid,spec){
  var wid=String(expectedWid||''),keys=Object.keys(written||{}),s=getSess();
  if(!wid||wid!==activeWs()||!s)return Promise.resolve({ok:false,localOk:false,serverOk:false});
  return Promise.all(keys.map(function(k){return holdLocal(k);})).then(function(local){
    if(wid!==activeWs())return {ok:false,localOk:false,serverOk:false};
    var groups={},expected={};
    for(var i=0;i<keys.length;i++){
      var k=keys[i],cur=local[i],want=written[k],projected=importProjectionKey(k,spec),cp=importProjection(k,cur,spec),wp=importProjection(k,want,spec);if(cur==null)return {ok:false,localOk:false,serverOk:false};
      if(projected){if(cp==null||wp==null||cp!==wp)return {ok:false,localOk:false,serverOk:false};}
      else if(cp!=null||wp!=null){if(cp==null||wp==null||cp!==wp)return {ok:false,localOk:false,serverOk:false};}
      else if(k===SCHEDULE_KEY){if(importScheduleIntent(cur)!==importScheduleIntent(want))return {ok:false,localOk:false,serverOk:false};}
      else if(cur!==want)return {ok:false,localOk:false,serverOk:false};
      var dest=(PERSONAL[k]&&isTeamWs())?personalWid():wid;if(!dest)return {ok:false,localOk:false,serverOk:false};
      (groups[dest]||(groups[dest]=[])).push(k);expected[dest+'\n'+k]={raw:importServerRaw(k,cur),want:want};
    }
    return ensureToken().then(function(at){
      if(!at||wid!==activeWs())return {ok:false,localOk:true,serverOk:false};
      return Promise.all(Object.keys(groups).map(function(dest){
        return kvPullValues(at,dest,groups[dest]).then(function(rows){
          var by={};(rows||[]).forEach(function(row){by[row.k]=row.v;});
          return groups[dest].every(function(k){
            var got=by[k],e=expected[dest+'\n'+k],projected=importProjectionKey(k,spec),gp=importProjection(k,got,spec),wp=importProjection(k,e.want,spec);
            if(projected)return gp!=null&&wp!=null&&gp===wp;
            return gp!=null||wp!=null?(gp!=null&&wp!=null&&gp===wp):got===e.raw;
          });
        });
      })).then(function(ok){var serverOk=wid===activeWs()&&ok.every(Boolean);return {ok:serverOk,localOk:true,serverOk:serverOk};});
    }).catch(function(e){syncDiagnostic('import-verify-server',e);return {ok:false,localOk:true,serverOk:false};});
  }).catch(function(e){syncDiagnostic('import-verify-local',e);return {ok:false,localOk:false,serverOk:false};});
}
/* 1.648 · 워크스페이스 전환을 막은 급감 보류를 그 자리에서 해결한다.
   전환 도중 MKEY를 비운 상태로 선택을 받으면 다른 키의 동기화 기준까지 잃을 수 있다.
   따라서 기존 전환은 먼저 완전히 중단·복원하고, 아래의 짧은 메모리 intent로만
   «정확히 그때 막은 키 + 정확히 그때의 원문»을 확인한다. 모두 서버에서 확인된 뒤에는
   중간 단계를 이어 가지 않고 switchWorkspace를 처음부터 새로 호출한다. */
var WS_HOLD_REVIEW_SEQ=0;
function workspaceHoldReviewValid(intent){
  var s=getSess(),wl=wsList();
  if(!intent||intent.seq!==WS_HOLD_REVIEW_SEQ||!s||s.uid!==intent.uid)return false;
  if(activeWs()!==intent.from||!dataUnlocked()||scheduleHeld())return false;
  if(!wl.some(function(w){return w.id===intent.resumeWid;}))return false;
  if(window.PSTeamFiles&&PSTeamFiles.importing&&PSTeamFiles.importing())return false;
  return true;
}
function workspaceHoldReviewPrepare(keys,from,resumeWid,seq){
  var s=getSess(),seen={},holds=holdList(),by={};
  holds.forEach(function(x){if(x&&x.k)by[x.k]=x;});
  keys=(Array.isArray(keys)?keys:[]).filter(function(k){
    if(!k||seen[k]||PERSONAL[k]||!by[k])return false;seen[k]=1;return true;
  }).slice(0,HOLD_MAX);
  if(!s||!s.uid||!from||!resumeWid||!keys.length)return Promise.resolve(null);
  return Promise.all(keys.map(function(k){return holdLocal(k);})).then(function(raws){
    if(seq!==WS_HOLD_REVIEW_SEQ||activeWs()!==from)return null;
    var rows=[];
    keys.forEach(function(k,i){
      var h=by[k],raw=raws[i];
      if(raw!=null&&h&&h.h&&hash(raw)===h.h)rows.push({k:k,raw:raw,h:h.h,before:h.before,after:h.after,at:h.at});
    });
    return rows.length?{seq:seq,uid:s.uid,from:from,resumeWid:resumeWid,rows:rows}:null;
  });
}
function workspaceHoldReviewExact(intent,row){
  if(!workspaceHoldReviewValid(intent)||!row)return Promise.resolve(false);
  return holdLocal(row.k).then(function(raw){
    if(!workspaceHoldReviewValid(intent)||raw==null||raw!==row.raw||hash(raw)!==row.h)return false;
    return holdList().some(function(x){return x&&x.k===row.k&&x.h===row.h;});
  });
}
function holdTakeServerExact(k,expectedRaw,expectedHash){
  return holdLocal(k).then(function(loc){
    var rec=holdList().filter(function(x){return x&&x.k===k;})[0];
    if(loc==null||loc!==expectedRaw||hash(loc)!==expectedHash||!rec||rec.h!==expectedHash)return false;
    var m=meta();m.h[k]=hash(loc);m.c[k]=0;delete m.n[k];setMeta(m);holdClear(k);return true;
  });
}
function workspaceHoldKeyPending(wid,k){
  var s=getSess();if(!s||!s.uid)return Promise.resolve(true);
  return outboxRead().then(function(q){return q.some(function(x){
    return x&&x.uid===s.uid&&x.wid===wid&&x.key===k&&!PERSONAL[k];
  });}).catch(function(){return true;});
}
function workspaceHoldReviewStop(intent,msg){
  if(intent&&intent.seq===WS_HOLD_REVIEW_SEQ)WS_HOLD_REVIEW_SEQ++;
  setStatus(msg||'전환을 멈췄습니다 — 자료는 이 기기에 그대로 있습니다');
}
function workspaceHoldReviewOpen(opts){
  opts=opts||{};var intent=opts.reviewIntent;
  if(!workspaceHoldReviewValid(intent)){
    workspaceHoldReviewStop(intent,'전환을 멈췄습니다 — 다시 눌러 주세요');return;
  }
  var listed=holdList(),left=intent.rows.filter(function(row){
    return listed.some(function(x){return x&&x.k===row.k&&x.h===row.h;});
  });
  intent.rows=left;
  if(!left.length){
    workspaceBlockingPending(intent.from).then(function(blocking){
      if(blocking||!workspaceHoldReviewValid(intent)){
        workspaceHoldReviewStop(intent,'전환을 멈췄습니다 — 저장 상태를 다시 확인해 주세요');return;
      }
      var target=intent.resumeWid;WS_HOLD_REVIEW_SEQ++;
      setStatus('확인 완료 · 워크스페이스 전환 중…');
      setTimeout(function(){switchWorkspace(target);},80);
    });
    return;
  }
  var target=(wsList().filter(function(w){return w.id===intent.resumeWid;})[0]||{}).name||'선택한 워크스페이스';
  var remote=isTeamWs()?'팀':'클라우드';
  var bcss='border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:12px;padding:7px 10px;border-radius:8px;cursor:pointer';
  var body='<div style="margin-bottom:10px">이 기기에서 항목 수가 크게 줄어 안전하게 멈춰 두었습니다. '
    +'아래에서 남길 쪽을 고르면 <b>'+esc(target)+'</b>(으)로 이어서 이동합니다.</div>';
  body+=left.map(function(x){return '<div style="padding:10px 0;border-top:1px solid rgba(128,128,128,.22)">'
    +'<div><b>'+esc(keyLabel(x.k))+'</b><span style="margin-left:7px;font-size:11px;font-weight:800;color:#c24a46">'+esc(x.before+' → '+x.after)+'</span></div>'
    +'<div style="font-size:11px;opacity:.7;margin-top:2px">'+new Date(x.at).toLocaleString()+'</div>'
    +'<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'
    +'<button type="button" data-holdup="'+esc(x.k)+'" style="'+bcss+'">이 기기 것 남기기</button>'
    +'<button type="button" data-holddn="'+esc(x.k)+'" style="'+bcss+'">'+esc(remote)+' 것 받기</button>'
    +'</div></div>';}).join('');
  var cancelled=false,mo=psModal({title:'전환 전에 '+left.length+'개만 확인해 주세요',body:body,hideCancel:true,ok:'나중에',
    onOk:function(){cancelled=true;workspaceHoldReviewStop(intent,'전환 보류 · 확인할 변경이 남아 있습니다');},
    onCancel:function(){cancelled=true;workspaceHoldReviewStop(intent,'전환 보류 · 확인할 변경이 남아 있습니다');}});
  var choosing=false;
  function choose(k,keepMine){
    if(choosing||cancelled||!workspaceHoldReviewValid(intent))return;
    var row=intent.rows.filter(function(x){return x.k===k;})[0];if(!row)return;
    choosing=true;
    try{document.querySelectorAll('[data-holdup],[data-holddn]').forEach(function(b){b.disabled=true;});}catch(_){}
    workspaceHoldReviewExact(intent,row).then(function(exact){
      if(!exact)return false;
      return keepMine?holdApproveExact(row.k,row.raw):holdTakeServerExact(row.k,row.raw,row.h);
    }).then(function(ok){
      if(!ok)throw new Error('hold changed');
      try{mo&&mo.close&&mo.close(true);}catch(_){}
      return forceSync('hold-switch').then(function(r){
        r=r||{};
        if(r.__timeout||r.error||r.offline||r.noauth||r.nows||r.itemPending)throw new Error('hold sync failed');
        var planned={};intent.rows.forEach(function(x){planned[x.k]=1;});
        var unknown=(Array.isArray(r.skipped)?r.skipped:[]).filter(function(x){return !PERSONAL[x]&&!planned[x];});
        if(unknown.length)throw new Error('new hold');
        return workspaceHoldKeyPending(intent.from,row.k).then(function(pending){if(pending)throw new Error('hold pending');return r;});
      });
    }).then(function(){
      if(!workspaceHoldReviewValid(intent))return;
      intent.rows=intent.rows.filter(function(x){return x.k!==row.k;});
      setTimeout(function(){holdOpen({resumeWid:intent.resumeWid,resumeFrom:intent.from,reviewIntent:intent});},80);
    }).catch(function(e){
      syncDiagnostic('workspace-hold-review',e);
      workspaceHoldReviewStop(intent,'전환을 멈췄습니다 — 자료는 이 기기에 그대로 있습니다');
      try{psModal({title:'아직 전환하지 않았습니다',body:'자료가 다시 바뀌었거나 클라우드 확인이 끝나지 않았습니다. 자료는 이 기기에 그대로 있습니다.<br><br>잠시 후 워크스페이스를 다시 눌러 주세요.',hideCancel:true,ok:'확인'});}catch(_){}
    });
  }
  document.querySelectorAll('[data-holdup]').forEach(function(b){b.addEventListener('click',function(){choose(b.getAttribute('data-holdup'),true);});});
  document.querySelectorAll('[data-holddn]').forEach(function(b){b.addEventListener('click',function(){choose(b.getAttribute('data-holddn'),false);});});
}
function holdOpen(opts){
  if(opts&&opts.reviewIntent)return workspaceHoldReviewOpen(opts);
  if(!dataUnlocked()){renderDataLock(false);return;}
  var list=holdList().slice().reverse();
  if(!list.length){ try{ psModal({title:'보류된 변경이 없습니다',hideCancel:true,ok:'확인'}); }catch(_){} return; }
  var remote=isTeamWs()?'팀':'클라우드';
  var body='<div style="margin-bottom:10px">항목이 크게 줄어 <b>'+esc(remote)+'에 저장하지 않고 멈춰 둔</b> 자료입니다. '
    +esc(remote)+'에 있는 값은 아직 그대로입니다. 아래에서 남길 쪽을 고르세요.</div>';
  var bcss='border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer';
  body+=list.map(function(x){
    return '<div style="padding:9px 0;border-top:1px solid rgba(128,128,128,.22)">'
      +'<div><b>'+esc(keyLabel(x.k))+'</b>'
      +'<span style="margin-left:7px;font-size:11px;font-weight:800;color:#c24a46">'+esc(x.before+' → '+x.after)+'</span></div>'
      +'<div style="font-size:11px;opacity:.7;margin-top:2px">'+new Date(x.at).toLocaleString()+'</div>'
      +'<div style="display:flex;gap:6px;margin-top:8px">'
      +'<button type="button" data-holdup="'+esc(x.k)+'" style="'+bcss+'">이 기기 것 남기기</button>'
      +'<button type="button" data-holddn="'+esc(x.k)+'" style="'+bcss+'">'+esc(remote)+' 것 받기</button>'
      +'</div></div>';
  }).join('');
  var mo=null;
  try{ mo=psModal({title:remote+'에 저장하지 않고 멈춘 변경',body:body,hideCancel:true,ok:'닫기'}); }catch(_){}
  function done(title,msg){
    try{ if(mo&&mo.close)mo.close(true); }catch(_){}
    try{ psModal({title:title,body:msg,hideCancel:true,ok:'확인'}); }catch(_){}
    try{ syncNow('hold'); }catch(_){}
  }
  document.querySelectorAll('[data-holdup]').forEach(function(b){
    b.addEventListener('click',function(){
      var k=b.getAttribute('data-holdup');
      holdApprove(k).then(function(){ done('이 기기 것을 남깁니다','<b>'+esc(keyLabel(k))+'</b> 를 이 기기의 값으로 '+esc(remote)+'에 저장합니다.'); });
    });
  });
  document.querySelectorAll('[data-holddn]').forEach(function(b){
    b.addEventListener('click',function(){
      var k=b.getAttribute('data-holddn');
      holdTakeServer(k).then(function(){ done(remote+' 값을 받습니다','<b>'+esc(keyLabel(k))+'</b> 를 '+esc(remote)+'에 있는 값으로 되돌립니다. 화면을 새로고침하면 보입니다.'); });
    });
  });
}
/* ══ 1.591 · 자료 확인 — 세 갈래를 한 화면으로 ═══════════════════════════════
   지금까지 사용자는 네 가지 말을 구별해야 했다: '동기화 대기' '팀에 올리지 않고 멈춘 변경'
   '동기화로 덮인 자료' '충돌'. 이건 **앱의 내부 사정이지 사용자의 질문이 아니다.**
   사용자에게는 어느 경우든 질문이 하나뿐이다 — "이 자료가 여기랑 팀에서 다른데, 어느 쪽을 남길까?"
   (사용자 지적: "다른 기기와 부딪힌 자료 이런 것들이 헷갈려 어떻게 해야 할지 모르겠어")

   갈래마다 '이 기기 것'의 뜻이 실제로 다르다 — 그래서 헷갈리는 게 당연했다. 여기서 흡수한다:
     보류 : 아직 안 올라감    → 이 기기 것 = 올리기(holdApprove) / 팀 것 = 받기(holdTakeServer)
     덮임 : 이미 덮인 뒤      → 이 기기 것 = 되돌리기(rescueRestore) / 팀 것 = 그대로 두기
     충돌 : 이미 이 기기가 이김 → 이 기기 것 = 그대로 두기 / 팀 것 = 가져오기(conflictRestore)
   '대기'는 선택지가 아니라 진행 상태라 이 목록에 넣지 않는다(설정의 동기화 줄이 보여 준다). */
function rescueDismiss(k){
  try{ localStorage.removeItem('ps_rescue_'+k);
    rescueSetList(rescueList().filter(function(x){ return x.k!==k; })); }catch(_){}
  return true;
}
function dataReviewList(){
  if(!dataUnlocked())return [];
  var out=[];
  try{ holdList().forEach(function(x){
    out.push({src:'hold',k:x.k,at:x.at,mine:x.after,theirs:x.before,
      why:'이 기기에서 크게 줄어 아직 안 올렸습니다'}); }); }catch(_){}
  try{ if(!COPIES_OFF)rescueList().forEach(function(x){
    /* 값이 남아 있을 때만 되돌릴 수 있다 */
    var has=false; try{ has=localStorage.getItem('ps_rescue_'+x.k)!=null; }catch(_){}
    if(!has)return;
    out.push({src:'rescue',k:x.k,at:x.at,mine:x.before,theirs:x.after,
      why:'팀에서 받은 값이 이 기기 것을 덮었습니다'}); }); }catch(_){}
  try{ if(!COPIES_OFF)conflictList().forEach(function(x){
    out.push({src:'conflict',k:x.k,at:x.at,mine:null,theirs:null,
      why:'양쪽이 같이 바뀌어 지금은 이 기기 것이 쓰이고 있습니다'}); }); }catch(_){}
  /* 같은 키가 두 갈래에 걸리면 더 급한 쪽(보류 > 덮임 > 충돌) 하나만 */
  var rank={hold:0,rescue:1,conflict:2}, seen={}, uniq=[];
  out.sort(function(a,b){ return (rank[a.src]-rank[b.src])||(b.at-a.at); });
  out.forEach(function(x){ if(!seen[x.k]){ seen[x.k]=1; uniq.push(x); } });
  return uniq;
}
function dataReviewApply(src,k,keepMine){
  var run;
  if(src==='hold')          run=keepMine?holdApprove(k):holdTakeServer(k);
  else if(src==='rescue')   run=keepMine?rescueRestore(k):Promise.resolve(rescueDismiss(k));
  else if(src==='conflict') run=Promise.resolve(keepMine?conflictClear(k):conflictRestore(k));
  else return Promise.resolve(false);
  return Promise.resolve(run).then(function(ok){
    /* 1.591 — **같은 질문이 다시 나오지 않게 한다.**
       '팀 것'을 고르면 로컬을 덮게 되는데, 그 덮어쓰기를 안전망(rescueStash)이 성실하게
       "당신 것이 덮였습니다"로 기록해 버린다. 그러면 방금 답한 항목이 '덮인 자료'라는 다른 이름으로
       목록에 되살아난다 — 사용자 입장에선 답을 했는데 같은 걸 또 묻는 셈이다(실측으로 확인).
       사용자가 **의도해서 고른** 덮어쓰기이므로 그 흔적은 남기지 않는다.
       (사고로 덮인 경우의 안전망은 그대로다 — 여기는 사용자가 직접 고른 경로만 지난다) */
    if(ok!==false){ try{ rescueDismiss(k); }catch(_){} }
    return ok;
  });
}
/* ══ 1.620 · 지난 판본으로 되돌리기 ══════════════════════════════════════════
   서버 ps_kv_history 에 90일치 판본이 쌓여 있는데, 앱에서 꺼내는 길이 **일정에만** 있었다.
   선수단이 이상해진 걸 사흘 뒤에 알아채면 방법이 없었다 — 사고 직후에 뜨는 칩(보류·되돌리기)은
   그 순간 놓치면 끝이기 때문이다. 그래서 코치들에게 "일단 건들지 마세요"라고 해야 했다.
   **새 버튼을 만들지 않는다.** 진입점이 이미 너무 많아 헷갈린다는 지적을 받았으므로(1.620),
   '자료 확인' 한 화면 안에 넣는다. */
var HIST_KEYS=['scout_tool_v1','cs_squad_v1','cs_team_matches_v1','process_coach_v1',
  'cs_team_attrs_v1','cs_drill_lib_v1','cs_vault_folders_v1','cs_scout_targets_v1',
  'cs_gamemodel_v1','cs_terms_v1','training_sessions_v1','cs_perms_v1'];
function histLoad(k){
  var wid=activeWs(); if(!wid) return Promise.resolve([]);
  return rpc('ps_admin_kv_history',{p_wid:wid,p_key:k,p_limit:30})
    .then(function(rows){ return Array.isArray(rows)?rows:[]; })
    .catch(function(){ return null; });          /* null = 못 불러옴(권한·서버) */
}
function histRestore(k,v){
  var writes=[];
  var ok=kvWrite(k,v,writes);
  return Promise.all(writes).then(function(){
    var m=meta();
    /* 되돌린 값이 지금보다 훨씬 작으면 출고 검사(pushHold)가 막는다 — 사고를 막는 장치라 옳지만,
       이건 사용자가 **직접 고른** 복구다. 승인 도장을 미리 찍어 한 번에 올라가게 한다. */
    try{ localStorage.setItem('ps_push_ok_'+k, hash(v)); }catch(_){}
    try{ delete m.h[k]; setMeta(m); }catch(_){}   /* dirty 로 만들어 팀에도 올린다 */
    try{ syncBaseSet(k,v); }catch(_){}
    return ok!==false;
  });
}
function dataReviewOpen(){
  if(!dataUnlocked()){renderDataLock(false);return;}
  var list=dataReviewList();
  var bcss='border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font-family:inherit;font-size:12px;font-weight:700;padding:7px 11px;border-radius:8px;cursor:pointer';
  var body=list.length
    ? ('<div style="margin-bottom:12px">이 기기와 팀에서 <b>다르게 저장된 자료</b>입니다.<br>'
       +'어느 쪽을 남길지 고르세요. 고르지 않은 쪽은 사라지지 않고 되돌릴 수 있습니다.</div>')
    : '<div style="margin-bottom:4px">이 기기와 팀의 자료가 같습니다 — 지금 고를 것은 없습니다.</div>';
  body+=list.map(function(x,i){
    var num=(x.mine!=null&&x.theirs!=null)
      ? '<div style="font-size:12px;margin-top:3px">이 기기 <b>'+x.mine+'개</b> · 팀 <b>'+x.theirs+'개</b></div>' : '';
    return '<div style="padding:11px 0;border-top:1px solid rgba(128,128,128,.22)">'
      +'<div style="font-size:14px;font-weight:800">'+esc(keyLabel(x.k))+'</div>'
      +num
      +'<div style="font-size:11px;opacity:.72;margin-top:3px">'+esc(x.why)+'</div>'
      +'<div style="font-size:11px;opacity:.55;margin-top:2px">'+new Date(x.at).toLocaleString()+'</div>'
      +'<div style="display:flex;gap:6px;margin-top:9px">'
      +'<button type="button" data-dr="'+i+'" data-keep="1" style="'+bcss+'">이 기기 것</button>'
      +'<button type="button" data-dr="'+i+'" data-keep="0" style="'+bcss+'">팀 것</button>'
      +'</div></div>';
  }).join('');
  /* ── 지난 판본으로 되돌리기 (1.620) ── */
  var isTeam=false; try{ isTeam=isTeamWs(); }catch(_){}
  if(isTeam){
    var opts=HIST_KEYS.map(function(k){ return '<option value="'+k+'">'+esc(keyLabel(k))+'</option>'; }).join('');
    body+='<div style="margin-top:16px;padding-top:14px;border-top:2px solid rgba(128,128,128,.3)">'
      +'<div style="font-size:14px;font-weight:800">지난 판본으로 되돌리기</div>'
      +'<div style="font-size:11px;opacity:.72;margin:3px 0 9px">팀 서버에 최근 90일치가 남아 있습니다. '
      +'며칠 지나 알아챈 일도 여기서 되돌릴 수 있습니다.</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
      +'<select id="drHistKey" style="font-family:inherit;font-size:13px;padding:7px 9px;border-radius:8px;'
      +'border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit">'+opts+'</select>'
      +'<button type="button" id="drHistLoad" style="'+bcss+'">판본 보기</button></div>'
      +'<div id="drHistOut" style="margin-top:10px"></div></div>';
    if(ITEMS_ACTIVE){
    /* ── 항목 저장 점검 (1.630) ──
       **새 버튼을 만들지 않는다**(1.620 에서 진입점이 너무 많다는 지적을 받았다).
       서버를 직접 읽어 통짜와 항목이 맞는지 보는 자리 — 되돌리기 바로 아래가 맞다. */
    body+='<div style="margin-top:16px;padding-top:14px;border-top:2px solid rgba(128,128,128,.3)">'
      +'<div style="font-size:14px;font-weight:800">항목 저장 점검</div>'
      +'<div style="font-size:11px;opacity:.72;margin:3px 0 9px">이 기기가 아니라 <b>팀 서버를 직접 읽어</b> '
      +'선수단이 통짜와 항목 양쪽에서 같은지 봅니다.</div>'
      +'<button type="button" id="drItemsRun" style="'+bcss+'">서버 확인</button>'
      +'<div id="drItemsOut" style="margin-top:10px;font-size:13px"></div>';
    /* 보류된 삭제는 칩으로만 알리면 그 순간을 놓쳤을 때 영영 못 본다(1.620 에서 지적된 것).
       여기 남겨 두면 나중에라도 찾아온다. */
    var _ih=itemsHoldList();
    if(_ih&&_ih.ids&&_ih.ids.length)
      body+='<div style="margin-top:10px;padding:9px 11px;border-radius:9px;'
        +'border:1px solid rgba(194,74,70,.45);font-size:13px">'
        +'<b>빠진 선수 '+_ih.ids.length+'명이 팀에 남아 있습니다</b>'
        +'<div style="opacity:.75;margin:2px 0 8px">'+esc(_ih.before+'명 → '+_ih.after+'명으로 줄어 지우지 않고 멈춰 뒀습니다.')+'</div>'
        +'<button type="button" id="drItemsHold" style="'+bcss+'">확인하기</button></div>';
    body+='</div>';}
  }
  var mo=null;
  try{ mo=psModal({title:'자료 확인'+(list.length?(' '+list.length+'건'):''),body:body,hideCancel:true,ok:'닫기'}); }catch(_){}
  (function(){
    var hb=document.getElementById('drItemsHold');
    if(hb)hb.addEventListener('click',function(){ try{ if(mo&&mo.close)mo.close(true); }catch(_){} itemsHoldOpen(); });
    var rb=document.getElementById('drItemsRun'), ro=document.getElementById('drItemsOut');
    if(!rb||!ro) return;
    rb.addEventListener('click',function(){
      rb.disabled=true; rb.textContent='확인 중…'; ro.innerHTML='';
      itemsAudit().then(function(o){
        rb.disabled=false; rb.textContent='서버 확인';
        if(!o||o.err){ ro.innerHTML='<span style="color:#c24a46">'+esc((o&&o.err)||'확인하지 못했습니다')+'</span>'; return; }
        var warn=/⚠/.test(o.verdict||'');
        var h='<div style="font-weight:800;color:'+(warn?'#c24a46':'inherit')+'">'+esc(o.verdict||'')+'</div>';
        h+='<div style="opacity:.75;margin-top:4px">통짜 '
          +esc(o.doc?o.doc:(o.docN+'명'))+(o.docAt?(' · '+esc(o.docAt)):'')+'</div>';
        h+='<div style="opacity:.75">항목 '+esc(o.itemN==null?'못 읽음':(o.itemN+'행'))
          +(o.tombN?(' (지운 표식 '+o.tombN+')'):'')+'</div>';
        if(o.denied&&o.denied.length)
          h+='<div style="margin-top:5px;color:#c24a46">서버가 거부한 항목 '+o.denied.length+'건 — '
            +esc(o.denied[0].reason||'')+'</div>';
        ro.innerHTML=h;
      });
    });
  })();
  (function(){
    var lb=document.getElementById('drHistLoad'), sel=document.getElementById('drHistKey'),
        out=document.getElementById('drHistOut');
    if(!lb||!sel||!out) return;
    lb.addEventListener('click',function(){
      var k=sel.value;
      lb.disabled=true; lb.textContent='불러오는 중…'; out.innerHTML='';
      histLoad(k).then(function(rows){
        lb.disabled=false; lb.textContent='판본 보기';
        if(rows===null){ out.innerHTML='<div style="font-size:12px;opacity:.7">판본을 불러오지 못했습니다 — 팀 소유자만 볼 수 있습니다.</div>'; return; }
        if(!rows.length){ out.innerHTML='<div style="font-size:12px;opacity:.7">이 자료의 지난 판본이 아직 없습니다.</div>'; return; }
        out.innerHTML=rows.map(function(r,i){
          var t=new Date(r.at||r.changed_at||r.ts||0);
          var n=null; try{ n=psCount(r.v); }catch(_){}
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;'
            +'padding:9px 0;border-top:1px solid rgba(128,128,128,.2)">'
            +'<div><div style="font-size:13px;font-weight:700">'+esc(t.toLocaleString())+'</div>'
            +'<div style="font-size:11px;opacity:.62">'+(n!=null?(n+'개 항목'):(String(r.v||'').length+'자'))+'</div></div>'
            +'<button type="button" data-hist="'+i+'" style="'+bcss+'">되돌리기</button></div>';
        }).join('');
        out.querySelectorAll('[data-hist]').forEach(function(hb){
          hb.addEventListener('click',function(){
            var r=rows[+hb.getAttribute('data-hist')];
            var n=null; try{ n=psCount(r.v); }catch(_){}
            var when=new Date(r.at||r.changed_at||r.ts||0).toLocaleString();
            if(!confirm(keyLabel(k)+' 을(를) '+when+' 판본으로 되돌립니다.'
              +(n!=null?('\n그때는 '+n+'개였습니다.'):'')
              +'\n\n지금 값은 되돌리기 목록에 남아 다시 복구할 수 있습니다.\n계속할까요?')) return;
            hb.disabled=true; hb.textContent='되돌리는 중…';
            histRestore(k,r.v).then(function(ok){
              try{ if(mo&&mo.close)mo.close(true); }catch(_){}
              if(!ok){ try{ psModal({title:'되돌리지 못했습니다',
                body:'자료는 그대로 두었습니다. 다시 시도해 주세요.',hideCancel:true,ok:'확인'}); }catch(_){} return; }
              try{ syncNow('hist-restore'); }catch(_){}
              try{ psModal({title:'되돌렸습니다',
                body:'<b>'+esc(keyLabel(k))+'</b> 을(를) '+esc(when)+' 판본으로 되돌리고 팀에도 올렸습니다.<br>'
                  +'화면을 새로고침하면 보입니다.',hideCancel:true,ok:'확인'}); }catch(_){}
            });
          });
        });
      });
    });
  })();
  document.querySelectorAll('[data-dr]').forEach(function(b){
    b.addEventListener('click',function(){
      var x=list[+b.getAttribute('data-dr')], keep=b.getAttribute('data-keep')==='1';
      b.disabled=true; b.textContent='…';
      Promise.resolve(dataReviewApply(x.src,x.k,keep)).then(function(ok){
        try{ if(mo&&mo.close)mo.close(true); }catch(_){}
        if(ok===false){
          try{ psModal({title:'적용하지 못했습니다',
            body:'<b>'+esc(keyLabel(x.k))+'</b> 를 바꾸지 못했습니다. 자료는 그대로 두었습니다. 다시 시도해 주세요.',
            hideCancel:true,ok:'확인'}); }catch(_){}
          return;
        }
        try{ syncNow('data-review'); }catch(_){}
        try{ renderUI(); }catch(_){}
        /* 남은 게 있으면 이어서 묻는다 — 한 건씩 끝내는 편이 덜 헷갈린다 */
        if(dataReviewList().length) setTimeout(dataReviewOpen,250);
        else try{ psModal({title:'정리했습니다',
          body:(keep?'이 기기 것으로 두었습니다.':'팀 것으로 바꿨습니다.')+' 화면을 새로고침하면 보입니다.',
          hideCancel:true,ok:'확인'}); }catch(_){}
      });
    });
  });
}
try{ window.PSDataReview={list:dataReviewList,open:dataReviewOpen}; }catch(_){}

/* ══ 1.592 · 자동 스냅샷 — 파일 없이도 며칠 전으로 ═══════════════════════════
   지금 있는 백업은 **사람이 눌러야** 만들어진다(설정 → 내보내기). 7일 지나면 '백업 권장' 칩이
   뜨지만, 그걸 누르지 않은 상태에서 사고가 나면 돌아갈 자리가 없다 — 08-05 가 그랬다.
   되돌리기(ps_rescue_*)는 '직전 한 판'만 잡아 두므로, 며칠 전으로는 못 간다.

   그래서 하루 한 번 자동으로 기기 안에 한 판을 통째로 떠 둔다. 최근 3개를 굴린다.
   **파일 백업을 대신하지 않는다** — 브라우저 저장소가 통째로 비워지면 이것도 같이 사라진다.
   그건 파일 내보내기만 막을 수 있고, 그래서 '백업 권장' 칩은 그대로 둔다.
   이건 훨씬 흔한 쪽(동기화가 덮음 · 실수로 지움 · 잘못 눌러 날아감)을 위한 바닥이다. */
var SNAPIDX='ps_auto_snap_idx_v1', SNAP_KEEP=3, SNAP_EVERY=864e5;   /* 24시간 */
function snapList(){ if(!dataUnlocked())return [];try{ return JSON.parse(localStorage.getItem(SNAPIDX)||'[]')||[]; }catch(_){ return []; } }
function snapSetList(a){ try{ localStorage.setItem(SNAPIDX,JSON.stringify(a.slice(-SNAP_KEEP))); }catch(_){} }
function autoSnapshot(force){
  if(!dataUnlocked())return Promise.resolve(null);
  try{
    var idx=snapList(), last=idx.length?idx[idx.length-1].at:0;
    if(!force && Date.now()-last<SNAP_EVERY) return Promise.resolve(null);
    if(!window.storage) return Promise.resolve(null);
    var snap={}, n=0;
    try{ CONTENT.forEach(function(k){ var v=null; try{ v=localStorage.getItem(k); }catch(_){}
      if(v!=null&&v.length<=syncMaxLen(k)){ snap[k]=v; n++; } }); }catch(_){}
    return idbItemKeys().then(function(items){
      return Promise.all(IDB_CONTENT.concat(Object.keys(IDBK)).concat(items).map(function(k){
        return window.storage.get(k).then(function(r){
          if(r&&r.value!=null&&String(r.value).length<=syncMaxLen(k)){ snap[k]=r.value; n++; }
        }).catch(function(){});
      }));
    }).then(function(){
      if(!n) return null;
      var at=Date.now(), key='ps_auto_snap_'+at;
      return window.storage.set(key,JSON.stringify({at:at,wid:activeWs()||'',data:snap})).then(function(){
        var a=snapList(); a.push({at:at,key:key,keys:n,wid:activeWs()||''});
        /* 오래된 것은 인덱스에서 빼고 실제 값도 지운다 — 안 지우면 저장 공간을 계속 먹는다 */
        var drop=a.slice(0,Math.max(0,a.length-SNAP_KEEP));
        snapSetList(a);
        drop.forEach(function(x){ try{ window.storage.del&&window.storage.del(x.key); }catch(_){} });
        return {at:at,keys:n};
      });
    });
  }catch(_){ return Promise.resolve(null); }
}
/* 스냅샷 한 판을 통째로 되돌린다. 되돌리기 전에 **지금 상태로 한 판 더 떠 둔다** —
   되돌린 게 마음에 안 들 때 돌아올 자리가 없으면 그건 복구가 아니라 또 다른 사고다. */
function snapRestore(at){
  if(!dataUnlocked())return Promise.resolve(false);
  var e=snapList().filter(function(x){ return x.at===at; })[0];
  if(!e) return Promise.resolve(false);
  return autoSnapshot(true).then(function(){ return window.storage.get(e.key); }).then(function(r){
    if(!r||!r.value) return false;
    var o=null; try{ o=JSON.parse(r.value); }catch(_){}
    if(!o||!o.data) return false;
    var writes=[], m=meta();
    Object.keys(o.data).forEach(function(k){
      kvWrite(k,o.data[k],writes);
      try{ delete m.h[k]; }catch(_){}      /* 되돌린 값이 '내가 고친 것'이 되어 팀에도 올라가게 */
    });
    try{ setMeta(m); }catch(_){}
    return Promise.all(writes).then(function(){ return true; }).catch(function(){ return false; });
  }).catch(function(){ return false; });
}
try{ window.PSSnapshots={list:snapList,make:autoSnapshot,restore:snapRestore}; }catch(_){}

/* ══ 1.630 · 항목 이사 점검 — **서버를 직접 읽는다** ═════════════════════════
   2026-08-07 에 세 번 데인 것 중 하나가 이것이다: 기기에 남은 사본으로 상태를 판단했고,
   그 사본이 뒤처져 있어서 **틀린 복구**를 했다. 그래서 이 함수는 localStorage 도
   IndexedDB 도 보지 않는다. 오직 서버만 본다.

   보는 것 세 가지 —
     ① 통짜 문서(scout_tool_v1)에 선수가 몇 명인가
     ② 항목(sq:*)이 몇 행인가 · 그중 무덤돌은 몇 개인가
     ③ 내 쓰기가 서버에서 거부된 게 있는가(ps_kv_denied)
   ①과 ②가 다르면 **어느 쪽이 정본인지 판단하기 전에는 아무것도 덮지 않는다.**

   0단계에서는 항목이 아직 하나도 없다(n=0 이 정상이다). 이사 뒤 관찰 기간에 매일 본다. */
function itemsCountDoc(v){
  try{
    var d=JSON.parse(v); if(!d||!Array.isArray(d.players)) return null;
    return d.players.filter(function(p){
      return p&&p.type!=='target'&&String(p.name||'').trim();
    }).length;
  }catch(_){ return null; }
}
function itemsAudit(){
  var wid=activeWs();
  if(!wid) return Promise.resolve({err:'열려 있는 공간이 없습니다'});
  return ensureToken().then(function(at){
    if(!at) return {err:'로그인이 필요합니다'};
    var o={ws:String(wid).slice(0,8),team:false};
    try{ o.team=isTeamWs(); }catch(_){}
    function get(q){ return fetch(BASE+'/rest/v1/'+q,{headers:hj(at)})
      .then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
    return Promise.all([
      /* ① 통짜 — 값까지 받아야 인원을 셀 수 있다. 한 행뿐이라 부담이 없다 */
      get('ps_kv?workspace_id=eq.'+wid+'&k=eq.scout_tool_v1&select=k,cupd,v'),
      /* ② 항목 — 키만 받는다(값을 받으면 사진까지 딸려 와 몇 MB가 된다) */
      get('ps_kv?workspace_id=eq.'+wid+'&k=like.'+encodeURIComponent(ITEMP)+'*&select=k'),
      /* ②-2 그중 무덤돌 — 지운 선수는 행을 지우지 않고 표식을 남긴다(1.631~) */
      get('ps_kv?workspace_id=eq.'+wid+'&k=like.'+encodeURIComponent(ITEMP)+'*&v=like.*_del*&select=k'),
      /* ③ 내 쓰기가 거부됐는가 — 옛 서버면 404 라 null 이다(무해) */
      get('ps_kv_denied?workspace_id=eq.'+wid+'&select=k,reason,at')
    ]).then(function(r){
      var doc=r[0], items=r[1], tombs=r[2], denied=r[3];
      if(doc==null) o.doc='못 읽음 — 권한이 없거나 서버가 응답하지 않았습니다';
      else if(!doc.length) o.doc='서버에 없음';
      else { o.docN=itemsCountDoc(doc[0].v); o.docAt=new Date(doc[0].cupd||0).toLocaleString();
             if(o.docN==null) o.doc='셀 수 없는 형태'; }
      o.itemN=(items==null)?null:items.length;
      o.tombN=(tombs==null)?null:tombs.length;
      o.liveN=(o.itemN==null||o.tombN==null)?null:(o.itemN-o.tombN);
      o.denied=(denied||[]).filter(function(x){ return x&&isItemKey(x.k); });
      /* 판정 — 0단계(항목 0)는 '아직 이사 전'이지 어긋남이 아니다 */
      if(o.itemN===0) o.verdict='이사 전 — 항목이 아직 없습니다(정상)';
      else if(o.docN==null||o.liveN==null) o.verdict='판단 불가 — 위 항목을 확인하세요';
      else if(o.docN===o.liveN) o.verdict='맞습니다 — 통짜 '+o.docN+'명 = 항목 '+o.liveN+'명';
      else o.verdict='⚠ 어긋남 — 통짜 '+o.docN+'명 ≠ 항목 '+o.liveN+'명 (덮기 전에 원인부터)';
      try{ console.log('[항목 점검]',o.verdict,o); }catch(_){}
      return o;
    });
  }).catch(function(e){ syncDiagnostic('items-audit',e); return {err:String(e&&e.message||e)}; });
}
/* ══ 1.631 · 항목 쓰기 ═══════════════════════════════════════════════════════
   선수 한 명을 키 하나(sq:<선수id>)로 IndexedDB 에 남긴다. 동기화가 그걸 서버로 나른다.
   **읽기는 아직 통짜다** — 이 코드가 만드는 자료는 아직 아무도 읽지 않는다.

   ── 서버가 준비됐는지 앱이 직접 확인한다 ───────────────────────────────────
   supabase-item-keys.sql 을 안 깔고 이 판을 올리면 sq:* 가 권한 표 밖으로 떨어져
   **선수 전원이 남의 평가를 읽는다.** "SQL 을 먼저 실행하세요"라고 적어 두는 것으로는
   다음 번을 못 막는다(1.590 에서 배운 그대로 — 사람이 지켜야 하는 규칙은 미끄러진다).
   그래서 올리기 전에 서버에 물어본다: ps_key_scope('sq:…') 가 'team' 을 주는가.
   못 물어봤거나 답이 다르면 **올리지 않는다**(fail-closed). 자료는 기기에 그대로 쌓이고,
   SQL 을 깐 다음 회차에 한꺼번에 올라간다 — 잃는 것은 없다. */
var ITEMS_IDX='ps_items_idx_v1', ITEMS_SRV='ps_items_srv_v1', ITEMS_HOLD='ps_items_hold_v1';
/* 1.644 — sq:*는 아직 화면에서 읽지 않는 이행용 그림자다. 워크스페이스별 색인·전환을
   원자적으로 만들기 전에는 팀 사이에 섞일 수 있으므로 쓰기·전송을 잠시 닫는다.
   정본 scout_tool_v1/cs_squad_v1은 그대로 저장·동기화된다. */
var ITEMS_ACTIVE=false;
var ITEMS_SRV_TTL=864e5;                    /* 하루에 한 번만 물어본다 */
function itemsSrvState(){ try{ return JSON.parse(localStorage.getItem(ITEMS_SRV)||'null')||null; }catch(_){ return null; } }
/* 동기(sync)로 읽는 판정 — 푸시 직전에 불린다 */
function itemsPushAllowed(){
  if(!ITEMS_ACTIVE)return false;
  if(localStorage.getItem('ps_items_write')==='0') return false;   /* 되돌리기 스위치 */
  var s=itemsSrvState(); return !!(s&&s.ok);
}
function itemsServerCheck(){
  var s=itemsSrvState();
  if(s&&(Date.now()-(s.at||0)<ITEMS_SRV_TTL)) return Promise.resolve(!!s.ok);
  return rpc('ps_key_scope',{key:ITEMP+'__probe'}).then(function(v){
    var ok=(String(v||'')==='team');
    try{ localStorage.setItem(ITEMS_SRV,JSON.stringify({ok:ok?1:0,at:Date.now(),saw:String(v||'')})); }catch(_){}
    if(!ok) syncDiagnostic('items-server-old',new Error('ps_key_scope='+v+' — supabase-item-keys.sql 미설치'));
    return ok;
  }).catch(function(e){
    /* 못 물어봤다 = 모른다 = 올리지 않는다. 6시간 뒤에 다시 물어본다(하루를 통째로 버리지 않게) */
    try{ localStorage.setItem(ITEMS_SRV,JSON.stringify({ok:0,at:Date.now()-ITEMS_SRV_TTL+216e5,err:1})); }catch(_){}
    syncDiagnostic('items-server-check',e); return false;
  });
}
function itemsIdx(){ try{ return JSON.parse(localStorage.getItem(ITEMS_IDX)||'{}')||{}; }catch(_){ return {}; } }
function itemsHoldList(){ try{ return JSON.parse(localStorage.getItem(ITEMS_HOLD)||'[]')||[]; }catch(_){ return []; } }
/* 선수 한 명이 지금 어떤 모습인지 — 이 값이 그대로 서버 행이 된다 */
function itemVal(p){ try{ return JSON.stringify(p); }catch(_){ return null; } }
var _itemsT=null, _itemsPending=null;
/* scout.html save() 가 부른다. **본 저장을 절대 막지 않는다** — 실패해도 조용히 넘어간다.
   save() 는 글자 하나 고칠 때마다 불리므로 모아서 한 번에 쓴다(IDB 를 44번씩 두들기지 않게). */
function itemsWrite(players){
  if(!ITEMS_ACTIVE)return Promise.resolve({skipped:'disabled'});
  _itemsPending=players;
  if(_itemsT) return Promise.resolve(null);
  return new Promise(function(res){
    _itemsT=setTimeout(function(){
      _itemsT=null; var ps=_itemsPending; _itemsPending=null;
      itemsWriteNow(ps).then(res,function(){ res(null); });
    },1200);
  });
}
function itemsWriteNow(players){
  if(!ITEMS_ACTIVE)return Promise.resolve({skipped:'disabled'});
  if(!window.storage||!window.storage.set) return Promise.resolve(null);
  if(!Array.isArray(players)) return Promise.resolve(null);
  if(localStorage.getItem('ps_items_write')==='0') return Promise.resolve(null);
  return itemsServerCheck().then(function(ready){
    /* 서버가 아직이면 **기기에도 안 쓴다.** 반쯤 만들어 두면 SQL 을 깐 순간
       한 번도 검사받지 않은 자료가 통째로 올라간다 — 이사 도중이 가장 위험하다. */
    if(!ready) return {skipped:'server'};
    var idx=itemsIdx(), now=Date.now(), jobs=[], wrote=0, seen={}, next={};
    players.forEach(function(p){
      if(!p||!p.id||!String(p.name||'').trim())return;
      if(p.type==='target')return;              /* 후보는 권한 등급이 다르다 — 절대 섞지 않는다 */
      var k=ITEMP+p.id, v=itemVal(p); if(v==null)return;
      seen[p.id]=1; var h=hash(v); next[p.id]=h;
      if(idx[p.id]===h)return;                  /* 안 바뀐 사람은 건드리지 않는다 */
      wrote++; jobs.push(window.storage.set(k,v).catch(function(e){ syncDiagnostic('item-write',e); }));
    });
    /* ── 사라진 사람 — 여기가 항목 세계의 안전장치다 ──────────────────────────
       통짜에서는 pushHold 가 "5개 이상 줄면 멈춘다"를 해 줬다. 항목은 키 하나당 개수가
       늘 1이라 그 잣대가 영원히 안 걸린다. 그래서 같은 잣대를 **여기**서 다시 세운다. */
    var gone=Object.keys(idx).filter(function(id){ return !seen[id]; });
    var held=false;
    if(gone.length&&bigDrop(Object.keys(idx).length,Object.keys(seen).length)){
      held=true;
      try{
        localStorage.setItem(ITEMS_HOLD,JSON.stringify({at:now,ids:gone.slice(0,80),
          before:Object.keys(idx).length,after:Object.keys(seen).length}));
      }catch(_){}
      try{ chip('⏸ 선수 '+gone.length+'명이 명단에서 빠졌어요 — 팀에서는 아직 지우지 않았습니다', itemsHoldOpen); }catch(_){}
      /* 무덤돌을 안 쓴다 = 서버의 그 선수들은 살아 있다. 색인에도 남겨 둔다(다음에 또 묻지 않게
         지금 상태를 그대로 유지). 사용자가 확인하면 itemsApproveDel 이 마저 지운다. */
      gone.forEach(function(id){ next[id]=idx[id]; });
    } else {
      gone.forEach(function(id){
        jobs.push(window.storage.set(ITEMP+id,JSON.stringify({_del:now})).catch(function(e){ syncDiagnostic('item-tomb',e); }));
      });
    }
    return Promise.all(jobs).then(function(){
      try{ localStorage.setItem(ITEMS_IDX,JSON.stringify(next)); }catch(_){}
      return {wrote:wrote,gone:gone.length,held:held,n:Object.keys(seen).length};
    });
  }).catch(function(e){ syncDiagnostic('items-write',e); return null; });
}
/* "정말 지운 게 맞습니다" — 보류해 둔 삭제를 실행한다 */
function itemsApproveDel(){
  var h=itemsHoldList(); var ids=(h&&h.ids)||[];
  if(!ids.length){ try{ localStorage.removeItem(ITEMS_HOLD); }catch(_){} return Promise.resolve(0); }
  var now=Date.now(), idx=itemsIdx();
  return Promise.all(ids.map(function(id){
    delete idx[id];
    return window.storage.set(ITEMP+id,JSON.stringify({_del:now})).catch(function(){});
  })).then(function(){
    try{ localStorage.setItem(ITEMS_IDX,JSON.stringify(idx)); }catch(_){}
    try{ localStorage.removeItem(ITEMS_HOLD); }catch(_){}
    try{ syncNow('items-del'); }catch(_){}
    return ids.length;
  });
}
function itemsHoldOpen(){
  var h=itemsHoldList();
  if(!h||!h.ids||!h.ids.length){ try{ psModal({title:'보류된 삭제가 없습니다',hideCancel:true,ok:'확인'}); }catch(_){} return; }
  var bcss='border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font:inherit;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer';
  var body='<div style="margin-bottom:10px">명단이 <b>'+h.before+'명 → '+h.after+'명</b>으로 줄었습니다. '
    +'빠진 '+h.ids.length+'명은 <b>팀에서 아직 지우지 않았습니다.</b><br>'
    +'맞게 정리한 것이면 아래에서 확인해 주세요. 잘못된 것이면 그대로 두시면 됩니다 — '
    +'그 선수들은 팀 서버에 그대로 있습니다.</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
    +'<button type="button" id="itDelOk" style="'+bcss+'">맞게 지웠습니다</button>'
    +'<button type="button" id="itDelNo" style="'+bcss+'">그대로 두기</button></div>';
  var mo=null; try{ mo=psModal({title:'빠진 선수 '+h.ids.length+'명',body:body,hideCancel:true,ok:'닫기'}); }catch(_){}
  var ok=document.getElementById('itDelOk'), no=document.getElementById('itDelNo');
  if(ok)ok.addEventListener('click',function(){ itemsApproveDel().then(function(n){
    try{ if(mo&&mo.close)mo.close(true); }catch(_){}
    try{ psModal({title:'정리했습니다',body:n+'명을 팀에서도 지웠습니다.',hideCancel:true,ok:'확인'}); }catch(_){}
  }); });
  if(no)no.addEventListener('click',function(){
    try{ localStorage.removeItem(ITEMS_HOLD); }catch(_){}
    try{ if(mo&&mo.close)mo.close(true); }catch(_){}
    try{ psModal({title:'그대로 두었습니다',body:'그 선수들은 팀 서버에 남아 있습니다. 명단에 다시 넣으려면 '
      +'<b>자료 확인 › 지난 판본으로 되돌리기</b>에서 선수단을 되돌리세요.',hideCancel:true,ok:'확인'}); }catch(_){}
  });
}
try{ window.PSItems={audit:itemsAudit,write:itemsWrite,prefix:ITEMP,
  ready:itemsPushAllowed,check:itemsServerCheck,holdOpen:itemsHoldOpen}; }catch(_){}

function kvWrite(k,v,writes,expectedLoc,writeGuard){
  /* 덮기 전에 지금 값을 읽어 남긴다. IDB 키(스카우팅 후보·보관함 등)가 오히려 중요하다 —
     2026-08-05 에 날아간 cs_scout_targets_v1 이 바로 이쪽이었다. */
  if(idbBacked(k)){
    /* 1.644 — 일정 화면은 거울을 먼저 바꾸고 IDB를 뒤따라 저장한다.
       iOS가 그 사이 앱을 종료하면 거울은 새 값, IDB는 예전 값으로 남는다.
       이 불일치를 '방금 편집'으로 보고 영구 거부하던 1.642 CAS를 고친다.
       회차가 선택한 화면 값(expectedLoc)이 쓰기 직전까지 거울(없으면 IDB)에
       그대로인지만 확인한다. IDB의 느린 예전 본은 rescue로 덮지 않고,
       사용자가 실제로 보던 expectedLoc을 복구 사본으로 남긴다. */
    if((k===SCHEDULE_KEY||k==='cs_team_matches_v1')&&writeGuard){
      var scheduleGuarded=(k===SCHEDULE_KEY);
      var mirror0=null;try{mirror0=localStorage.getItem(k);}catch(_){}
      if((scheduleGuarded&&scheduleHeld())||(mirror0!=null&&mirror0!==expectedLoc)){writeGuard.stale=true;return false;}
      writes.push(window.storage.get(k).then(function(r){
        var before=r?r.value:null,mirror=null;try{mirror=localStorage.getItem(k);}catch(_){}
        var current=(mirror!=null?mirror:before);
        if((scheduleGuarded&&scheduleHeld())||current!==expectedLoc){writeGuard.stale=true;return {stale:true};}
        try{rescueStash(k,expectedLoc,v);}catch(_){}
        return window.storage.set(k,v).then(function(){
          var afterMirror=null;try{afterMirror=localStorage.getItem(k);}catch(_){}
          if((scheduleGuarded&&scheduleHeld())||(afterMirror!=null&&afterMirror!==expectedLoc&&afterMirror!==v)){
            writeGuard.stale=true;
            /* 검사 뒤 새 편집이 들어왔다면 방금 쓴 IDB도 새 거울로 돌려놓는다. */
            if(afterMirror!=null&&afterMirror!==v)return window.storage.set(k,afterMirror).then(function(){return {stale:true};});
            return {stale:true};
          }
          try{localStorage.setItem(k,v);}catch(_){}
          return {stale:false};
        });
      }).catch(function(e){writeGuard.stale=true;syncDiagnostic('schedule-cas-write',e);return {stale:true};}));
      return true;
    }
    writes.push(
      window.storage.get(k)
        .then(function(r){ try{ rescueStash(k, r&&r.value, v); }catch(_){} })
        .catch(function(){})
        .then(function(){ return window.storage.set(k,v); })
        .then(function(){
          /* 1.618 — IDB 키인데 localStorage 거울을 함께 보는 화면이 있다. 작전판 squadLoad() 는
             localStorage 를 먼저 읽고 값이 있으면 IDB 를 아예 안 본다. 여기서 거울을 안 고치면
             팀에서 새 선수단을 받아도 화면엔 옛 명단이 그대로 남는다.
             이미 거울이 있는 키만 갱신한다 — 없던 키까지 새로 만들면 노트·매치데스크 같은 큰 값이
             localStorage 5MB 한도를 다시 넘는다(1.504 에서 IDB 로 옮긴 이유). */
          /* 1.619 — 권한 문서만은 거울을 **없어도 만든다**. 푸시 권한 판정이 동기라
             localStorage 를 먼저 보는데, 새 기기에는 거울이 없어 방금 받은 권한을 못 읽고
             fail-closed 에 걸린다. 3KB 남짓이라 한도 부담도 없다. */
          try{ if(k==='cs_perms_v1'||localStorage.getItem(k)!==null) localStorage.setItem(k,v); }catch(_){}
          if(k==='cs_perms_v1') __permsRaw=v;
        })
    );
    return true;
  }
  try{ rescueStash(k,localStorage.getItem(k),v); }catch(_){}
  try{ localStorage.setItem(k,v); var __ok=localStorage.getItem(k)===v;
    /* 2.463 — 방금 받은 남의 IDP 문서라면 사진 바이트를 큰 저장소로 옮긴다(pull 전용이라
       서버·다른 기기 영향 없음, storage.js stripIdp 참조). 비동기 뒷처리 — 회차 판정과 무관. */
    if(__ok)try{ if(window.PSImg&&PSImg.stripIdp)PSImg.stripIdp(k); }catch(_){}
    return __ok; }catch(_){ return false; }
}
function libLoad(){
  if(window.storage) return window.storage.get(LIBKEY)
    .then(function(r){ if(!r)return []; try{ var v=JSON.parse(r.value); return Array.isArray(v)?v:[]; }catch(_){ return []; } });
  var v=pJSON(localStorage.getItem(LIBKEY),[]);
  return Promise.resolve(Array.isArray(v)?v:[]);
}
function libSave(out){
  /* 저장을 시작하기 전에 이번 쓰기의 정확한 revision을 만든다. 완료 뒤 localStorage를
     다시 읽으면 그 짧은 사이의 사용자 편집 revision까지 우리 저장으로 오인할 수 있다. */
  var rev=String(Date.now());
  try{ var prev=+localStorage.getItem('cs_lib_rev')||0;if(prev>=+rev)rev=String(prev+1); }catch(_){}
  if(window.storage) return window.storage.set(LIBKEY,JSON.stringify(out))
    .then(function(){ try{ localStorage.setItem('cs_lib_rev',rev); }catch(_){} return rev; });
  try{ localStorage.setItem(LIBKEY,JSON.stringify(out));localStorage.setItem('cs_lib_rev',rev);return Promise.resolve(rev); }
  catch(e){ return Promise.reject(e); }
}
function syncLibrary(at,m,now,wid){
  /* 2.599 — 보관함 목록(행마다 ~120B × 드릴 수)을 회차마다 받지 않는다. 서버 서명 = 행 수 · 최근 saved_at · 최근 deleted_at
     (1행짜리 요청 둘, count=exact) 이 지난 회차와 같고 로컬 rev·묘비도 같으면 보관함 단계를 통째로 건너뛴다.
     내가 올린 게 있으면 서명이 바뀌어 다음 회차에 한 번 더 전체 대조한다. */
  var revRaw=null; try{ revRaw=localStorage.getItem('cs_lib_rev'); }catch(_){}
  var rev=String(revRaw||'');   /* 비교용 문자열 · ackHash 는 _syncLibrary 와 같은 raw(null 이면 '') 로 */
  var tombN=0; try{ var tb=pJSON(localStorage.getItem(TOMBKEY),[]); tombN=Array.isArray(tb)?tb.length:0; }catch(_){}
  var base=BASE+'/rest/v1/ps_library?workspace_id=eq.'+wid;
  function probe(){
    var h1=hj(at); h1['Prefer']='count=exact';
    return Promise.all([
      syncFetch('library_probe',base+'&select=saved_at&order=saved_at.desc.nullslast&limit=1',{headers:h1}).then(function(r){
        if(!r.ok)throw syncHttpError('library_probe',r.status);
        var cr=''; try{ cr=r.headers.get('content-range')||''; }catch(_){}
        return r.json().then(function(rows){ return (cr.split('/')[1]||'?')+'|'+((rows&&rows[0]&&rows[0].saved_at)||0); });
      }),
      syncFetch('library_probe',base+'&deleted_at=not.is.null&select=deleted_at&order=deleted_at.desc&limit=1',{headers:hj(at)}).then(function(r){
        if(!r.ok)throw syncHttpError('library_probe',r.status);
        return r.json().then(function(rows){ return String((rows&&rows[0]&&rows[0].deleted_at)||0); });
      })
    ]).then(function(a){ return a.join('|'); });
  }
  return probe().catch(function(){ return null; }).then(function(sig){
    var ls=m.ls||{};
    if(sig&&ls.sig===sig&&ls.rev===rev&&ls.tomb===tombN) return {applied:0,pushed:0,ackHash:hash(revRaw),libSkipped:true};
    return libLoad().then(function(lib){ return _syncLibrary(at,m,now,wid,lib); }).then(function(res){
      var rev2=rev; try{ rev2=String(localStorage.getItem('cs_lib_rev')||''); }catch(_){}
      if(sig&&res&&!res.pushed&&!res.applied) m.ls={sig:sig,rev:rev2,tomb:tombN}; else m.ls=null;
      return res;
    });
  });
}
function _syncLibrary(at,m,now,wid,lib){
  if(!Array.isArray(lib))lib=[];
  /* 이 회차가 실제로 확인한 revision. 서버 반영 때문에 libSave가 새 revision을 만들면
     그 토큰으로 바꾸고, 사용자가 회차 중 다시 편집하면 이후 ack 비교에서 대기를 남긴다. */
  var libAckRev=null;try{libAckRev=localStorage.getItem('cs_lib_rev');}catch(_){}
  var teamOnly=isTeamWs();
  var tombs=pJSON(localStorage.getItem(TOMBKEY),[]); if(!Array.isArray(tombs))tombs=[];
  m.li=m.li||{};
  function libPullList(){
    return syncFetch('library_pull',BASE+'/rest/v1/ps_library?workspace_id=eq.'+wid+'&select='+libSelCols('lib_id,saved_at,deleted_at'),{headers:hj(at)})
      .then(function(r){
        /* 서버에 private/owner_id가 아직 없으면 400이 온다 — 한 번만 끄고 예전 방식으로 다시 부른다 */
        if(!r.ok){ if(libPriv&&(r.status===400||r.status===404)){ libPriv=false; return libPullList(); } throw syncHttpError('library_pull',r.status); }
        /* 보관함 화면이 '백업됨'을 말할 근거 — 서버가 비공개 백업을 받는 상태인가 */
        try{ localStorage.setItem('ps_lib_priv',libPriv?'1':'0'); }catch(_){}
        return r.json();
      });
  }
  return libPullList()
  .then(function(rows){
    var priv=teamOnly&&libPriv;   /* 팀 공간 + 서버 준비됨 = 비공개 백업 가능 */
    var srv={}; (rows||[]).forEach(function(r0){ srv[r0.lib_id]=r0; });
    var locMap={}, order=[];
    lib.forEach(function(it){ if(it&&it.libId&&!locMap[it.libId]){ locMap[it.libId]=it; order.push(it.libId); } });
    var tombMap={}; tombs.forEach(function(t){ if(t&&t.id){ var a=+t.at||0; if(!tombMap[t.id]||a>tombMap[t.id])tombMap[t.id]=a; } });
    var push=[], insertOnly={}, pushedOk=0, pullIds=[], delLocal=[], unTomb=[], applied=0, mutated=false;
    function queueLibPush(row,isInsert){
      push.push(row);if(isInsert)insertOnly[row.lib_id]=1;
    }
    function srvStamp(s){ return Math.max(s.saved_at||0, s.deleted_at||0); }
    /* 로컬 항목 판정 */
    order.forEach(function(id){
      var it=locMap[id], rec=m.li[id], s=srv[id];
      var h=libHash(it), t=libTs(it);
      /* ── 1.532 폴더가 공유를 정한다 ───────────────────────────────────
         공유 폴더 안에 있으면 팀 공개본(private=false), 아니면 내 비공개 백업(private=true).
         자료마다 '팀에 공유'를 누르던 방식은 없어졌다 — 폴더 스위치 하나로 켜고 끈다. */
      /* 서버가 공개였을 때 받아 둔 자료가 나중에 원본 주인에 의해 비공개로
         바뀌면 RLS 때문에 목록에서는 s가 사라진다. 예전 코드는 그것을 새 내
         자료로 오인해 같은 lib_id로 upsert했고, 숨은 비공개 원본과 충돌한 403이
         워크스페이스 전환 전체를 막았다.

         서버 owner_id가 없는 구자료도 item.createdBy가 남아 있으면 원본 주인을
         알 수 있다. 둘 중 하나라도 다른 사용자를 가리키면 절대 내 자료로
         소유권을 바꾸거나 밀어 올리지 않는다. */
      var myUid=libUid();
      var localOwner=(it&&(it._teamOwner||it.createdBy))||null;
      var localForeign=!!(teamOnly&&myUid&&localOwner&&localOwner!==myUid);
      var sOther=!!(s&&myUid&&(
        (s.owner_id&&s.owner_id!==myUid)
        ||(!s.owner_id&&localForeign)
      ));   /* 남이 올린 공유본 또는 작성자가 확인되는 구자료 */
      var wantShare=teamOnly&&libFolderShared(it.folder);
      /* 남의 공유본: 서버가 항상 진실 — 밀어 올리지도, 지우지도 않는다(③ 원본 주인만 수정) */
      if(sOther){
        var foreignSharedAt=s.saved_at||now,foreignOwner=s.owner_id||null;
        /* 이미 같은 서버 표식을 가진 자료까지 매 회차 저장하면 libSave가 cs_lib_rev를
           계속 바꿔, 아무 편집이 없어도 보관함 변경처럼 보인다. 실제 차이만 저장한다. */
        if(it._teamSharedAt!==foreignSharedAt||it._teamSource!=='team'
          ||String(it._teamOwner||'')!==String(foreignOwner||'')){
          it._teamSharedAt=foreignSharedAt;it._teamSource='team';
          if(foreignOwner)it._teamOwner=foreignOwner;else delete it._teamOwner;
          mutated=true;
        }
        if(srvStamp(s)>(rec?rec.s:0)){
          if(s.deleted_at&&s.deleted_at>=(s.saved_at||0))delLocal.push(id); else pullIds.push(id);
        }
        return;
      }
      /* 공유가 해제됐다(주인이 폴더 스위치를 끔) → 내 기기에서도 정리(② 조용히 정리) */
      /* 아주 오래된 공개본에는 _teamSource/_teamSharedAt가 없고 createdBy만 남아
         있다. '복사'는 작성자를 현재 사용자로 새로 찍으므로, 서버에 보이지 않는
         foreign createdBy 항목은 내 새 자료가 아니라 공유가 끝난 캐시로 확정할 수 있다. */
      if(teamOnly&&!s&&localForeign){
        delLocal.push(id); return;
      }
      /* 내 자료의 공유 표시는 폴더가 정한다 */
      var wasShared=!!it._teamSharedAt;
      if(teamOnly&&wantShare!==wasShared){
        if(wantShare){ it._teamSharedAt=now; it._teamSource='mine'; }
        else { delete it._teamSharedAt; delete it._teamSource; }
        mutated=true;
      }
      /* v271부터 썸네일·미디어를 해시에서 제외한다. 편집 시각이 그대로면
         과거 해시 차이는 실제 수정이 아니라 계산 방식 변경이므로 기준만 갱신한다. */
      if(teamOnly&&s&&rec&&rec.h!==h&&t<=rec.s)rec.h=h;
      var mineBackup=priv?!wantShare:false;      /* push 할 때의 private 값 */
      if(!s){
        if(teamOnly&&!priv)return;               /* 서버 마이그레이션 전이면 예전대로 기기에만 */
        var ut=t||now; queueLibPush(libRow(it,ut,wid,mineBackup),true); m.li[id]={h:h,s:ut}; return;
      }
      var dirty=(!rec||rec.h!==h);
      var sNew=srvStamp(s)>(rec?rec.s:0);
      /* 공개/비공개가 바뀌었으면 내용이 그대로여도 다시 올려야 한다(공유 켜기·끄기) */
      var flip=teamOnly&&priv&&(!!s.private===!!wantShare);
      if(flip){ var ft=t||now; queueLibPush(libRow(it,ft,wid,mineBackup),false); m.li[id]={h:h,s:ft}; return; }
      if(dirty&&sNew){ /* 양쪽 변경 — 더 최신 시각이 승 */
        var lt=t||now;
        if(srvStamp(s)>=lt){ if(s.deleted_at&&s.deleted_at>=(s.saved_at||0))delLocal.push(id); else pullIds.push(id); return; }
        queueLibPush(libRow(it,lt,wid,mineBackup),false); m.li[id]={h:h,s:lt}; return;
      }
      if(dirty){ /* 로컬만 변경 → push (시각 안 바뀐 편집이면 지금 시각 부여) */
        if(rec&&t<=rec.s){ t=now; it.editedAt=now; mutated=true; h=libHash(it); }
        if(!t)t=now;
        queueLibPush(libRow(it,t,wid,mineBackup),false); m.li[id]={h:h,s:t}; return;
      }
      if(sNew){ if(s.deleted_at&&s.deleted_at>=(s.saved_at||0))delLocal.push(id); else pullIds.push(id); }
    });
    /* 로컬 무덤돌 → 서버 (서버가 더 최신 항목이면 부활 = pull) */
    Object.keys(tombMap).forEach(function(id){
      if(locMap[id])return;
      var a=tombMap[id], s=srv[id];
      /* 팀 공개본은 내 기기에서 지웠다고 팀에서 지우지 않는다. 내 비공개 백업만 삭제를 따라간다. */
      if(teamOnly&&!srvPrivate(s))return;
      if(s&&!s.deleted_at&&srvStamp(s)>=a){ pullIds.push(id); unTomb.push(id); return; }
      if((s&&!s.deleted_at)||(!s&&m.li[id])){
        queueLibPush(libStamp({workspace_id:wid,lib_id:id,type:'board',name:'',folder:'',tags:[],pin:false,item:null,saved_at:a,deleted_at:a},teamOnly),!s);
      }
      delete m.li[id];
    });
    /* 서버에만 있는 항목 → pull (무덤돌 없을 때만) */
    Object.keys(srv).forEach(function(id){
      if(locMap[id]||tombMap[id])return;
      var s=srv[id];
      if(s.deleted_at&&s.deleted_at>=(s.saved_at||0))return;
      pullIds.push(id);
    });
    /* 실행: push(용량 청크) → pull 본문(20개 청크) → 적용 */
    function pushAll(){
      if(!push.length)return Promise.resolve();
      function chunksOf(rows0){
        var chunks=[],cur=[],sz=0;
        rows0.forEach(function(r0){ var l=JSON.stringify(r0).length; if(cur.length&&(sz+l>700000||cur.length>=15)){chunks.push(cur);cur=[];sz=0;} cur.push(r0);sz+=l; });
        if(cur.length)chunks.push(cur);return chunks;
      }
      var updates=push.filter(function(r0){return !insertOnly[r0.lib_id];});
      var inserts=push.filter(function(r0){return !!insertOnly[r0.lib_id];});
      var rev=null;try{rev=localStorage.getItem('cs_lib_rev');}catch(_){}
      return outboxMark(wid,'@library',hash(rev),'library').then(function(){
        var updateRun=chunksOf(updates).reduce(function(p,ch){ return p.then(function(){
          return syncFetch('library_push',BASE+'/rest/v1/ps_library',{method:'POST',headers:(function(){var h2=hj(at);h2['Prefer']='resolution=merge-duplicates';return h2;})(),body:JSON.stringify(ch)})
            .then(function(r){ if(!r.ok)throw syncHttpError('library_push',r.status); pushedOk+=ch.length; });
        }); },Promise.resolve());
        /* 서버 목록에 없던 행은 blind upsert하지 않는다. 다른 사용자가 비공개로
           돌린 같은 lib_id는 RLS 때문에 pull에는 안 보이지만 실제 행은 남아 있다.
           ignore-duplicates INSERT는 그 원본을 UPDATE하지 않고 0행을 돌려 주므로,
           그때만 이 기기의 옛 공유 캐시를 정리한다. */
        return chunksOf(inserts).reduce(function(p,ch){return p.then(function(){
          var h3=hj(at);h3['Prefer']='resolution=ignore-duplicates,return=representation';
          return syncFetch('library_insert',BASE+'/rest/v1/ps_library',{method:'POST',headers:h3,body:JSON.stringify(ch)})
            .then(function(r){if(!r.ok)throw syncHttpError('library_insert',r.status);return r.text();})
            .then(function(t0){
              var got=[];try{got=t0?JSON.parse(t0):[];}catch(_){got=null;}
              if(!Array.isArray(got))throw syncIssue('sync_confirm_missing','library_insert','server confirmation missing');
              var seen={};got.forEach(function(x){if(x&&x.lib_id)seen[x.lib_id]=1;});
              ch.forEach(function(x){
                if(seen[x.lib_id]){pushedOk++;return;}
                if(!teamOnly)throw syncIssue('sync_conflict','library_insert','library id conflict');
                if(delLocal.indexOf(x.lib_id)<0)delLocal.push(x.lib_id);
                delete m.li[x.lib_id];
              });
            });
        });},updateRun);
      });
    }
    function pullAll(){
      if(!pullIds.length)return Promise.resolve();
      var chunks=[]; for(var i=0;i<pullIds.length;i+=20)chunks.push(pullIds.slice(i,i+20));
      return chunks.reduce(function(p,ch){ return p.then(function(){
        var q='lib_id=in.('+encodeURIComponent('"'+ch.join('","')+'"')+')';
        return syncFetch('library_body',BASE+'/rest/v1/ps_library?workspace_id=eq.'+wid+'&select='+libSelCols('lib_id,item,saved_at')+'&'+q,{headers:hj(at)})
          .then(function(r){ if(!r.ok)throw syncHttpError('library_body',r.status); return r.json(); })
          .then(function(rows2){ (rows2||[]).forEach(function(r0){
            if(!r0||!r0.item)return;
            var it=r0.item; it.libId=r0.lib_id;delete it._teamSharePending;
            /* 내 비공개 백업은 '팀 공유본'이 아니다 — 다른 기기에서 받아도 내 자료로 복원된다.
               공개본이면 주인을 남겨 둔다(_teamOwner) — 나중에 공유가 해제되면 이 표시로 내 기기에서 정리한다. */
            var _own=(libPriv&&r0.owner_id)||null;
            if(srvPrivate(r0)){ delete it._teamSharedAt;delete it._teamSource;delete it._teamOwner; }
            else {
              it._teamSharedAt=r0.saved_at||Date.now();
              if(_own&&libUid()&&_own!==libUid()){ it._teamSource='team'; it._teamOwner=_own; }
              else { it._teamSource='mine'; delete it._teamOwner; }
            }
            if(!locMap[r0.lib_id])order.push(r0.lib_id);
            locMap[r0.lib_id]=it;
            m.li[r0.lib_id]={h:libHash(it),s:r0.saved_at||0};
            applied++;
          }); });
      }); },Promise.resolve());
    }
    return pushAll().then(pullAll).then(function(){
      /* 1.532 — '_teamSharePending' 뒷정리는 사라졌다. 공유 표시는 폴더가 정하므로
         push 성공 여부와 무관하게 위 판정에서 이미 맞춰져 있다. */
      delLocal.forEach(function(id){ var s=srv[id]; delete locMap[id]; order=order.filter(function(x){return x!==id;}); tombMap[id]=(s&&s.deleted_at)||now; delete m.li[id]; applied++; });
      unTomb.forEach(function(id){ delete tombMap[id]; });
      var _saved=Promise.resolve(libAckRev);
      if(applied>0||mutated){
        var out=order.map(function(id){return locMap[id];}).filter(Boolean);
        out.sort(function(a,b){ return (b.savedAt||0)-(a.savedAt||0); });
        _saved=libSave(out).then(function(rev){if(rev!=null)libAckRev=String(rev);return libAckRev;});
      }
      var cut=now-7776e6;
      var tl=Object.keys(tombMap).map(function(id){return {id:id,at:tombMap[id]};}).filter(function(t){return t.at>cut;});
      try{ localStorage.setItem(TOMBKEY,JSON.stringify(tl)); }catch(_){}
      return _saved.then(function(){ return {applied:applied,pushed:pushedOk,ackHash:hash(libAckRev)}; });
    });
  });
}

/* 1.532 — 자료 하나씩 공유하던 방식은 폐지됐다(공유는 폴더 스위치로).
   남아 있는 호출부가 조용히 아무 일도 안 하는 것보다, 무엇을 해야 하는지 말하고 실패하는 편이 낫다. */
function shareLibraryItem(){
  return Promise.reject(new Error('이제 공유는 폴더 단위입니다 — 자료를 공유 폴더로 옮기거나, 폴더 메뉴에서 「팀과 공유」를 켜 주세요.'));
}

var busy=false, busyDog=null, syncRetryTimer=null, syncRetryStep=0;
var importSyncLock=false,importSyncWid='',importSyncRelease=null;
function syncImportBegin(wid){
  wid=String(wid||'');if(!wid||wid!==activeWs()||importSyncLock)return Promise.resolve(false);
  function waitBusy(n){if(wid!==activeWs())return Promise.resolve(false);if(!busy){importSyncLock=true;importSyncWid=wid;return Promise.resolve(true);}if(n>300)return Promise.resolve(false);return new Promise(function(ok){setTimeout(ok,100);}).then(function(){return waitBusy(n+1);});}
  if(!navigator.locks||!navigator.locks.request)return waitBusy(0);
  return new Promise(function(resolve){
    navigator.locks.request('process-studio-sync-'+wid,{mode:'exclusive'},function(){
      if(wid!==activeWs()){resolve(false);return;}
      importSyncLock=true;importSyncWid=wid;resolve(true);
      return new Promise(function(done){importSyncRelease=done;});
    }).catch(function(){resolve(false);});
  });
}
function syncImportEnd(wid){
  if(wid&&String(wid)!==importSyncWid)return false;
  var done=importSyncRelease;importSyncRelease=null;importSyncLock=false;importSyncWid='';
  try{if(done)done();}catch(_){}return true;
}
/* 1.642 — 일정 편집 중에는 다른 키는 계속 동기화하되 process_coach_v1만 손대지 않는다. */
var scheduleEditActive=false,scheduleEditUntil=0,scheduleEditTimer=null;
function scheduleHeld(){return scheduleEditActive||Date.now()<scheduleEditUntil;}
function scheduleResumeSoon(){
  clearTimeout(scheduleEditTimer);
  var wait=Math.max(250,scheduleEditUntil-Date.now()+80);
  scheduleEditTimer=setTimeout(function(){if(!scheduleHeld()&&getSess())syncNow('schedule-edit-finished');},wait);
}
function scheduleEditSet(active){
  scheduleEditActive=!!active;
  if(!scheduleEditActive){scheduleEditUntil=Math.max(scheduleEditUntil,Date.now()+900);scheduleResumeSoon();}
  return scheduleEditActive;
}
function scheduleEditTouch(ms){scheduleEditUntil=Math.max(scheduleEditUntil,Date.now()+Math.max(500,+ms||3500));scheduleResumeSoon();return scheduleEditUntil;}
function clearSyncRetry(){if(syncRetryTimer){clearTimeout(syncRetryTimer);syncRetryTimer=null;}syncRetryStep=0;}
function scheduleSyncRetry(){
  if(syncRetryTimer||navigator.onLine===false||!getSess())return;
  var delays=[5000,15000,30000,60000,120000,300000],wait=delays[Math.min(syncRetryStep,delays.length-1)];
  syncRetryStep=Math.min(syncRetryStep+1,delays.length-1);
  var pi=pendingInfo(activeWs());
  if(pi.count)setStatus('이 기기에 '+pi.count+'건 저장됨 · '+Math.round(wait/1000)+'초 후 재시도');
  syncRetryTimer=setTimeout(function(){syncRetryTimer=null;syncNow('retry');},wait);
}
/* ── 개인 채널(1.502) ────────────────────────────────────────────────
   매치데스크·노트 같은 PERSONAL 키는 팀 공간에선 올리지 않는다(팀에 섞이면 안 되니까).
   그런데 코치는 대부분 팀 공간에서 일하므로, 그 규칙만 두면 개인 자료가 이 기기에만 남아
   기기를 바꾸거나 잃으면 그대로 사라진다("매치데스크가 저장이 안 돼").
   그래서 활성 공간과 무관하게 **내 개인 공간 행**에 대고 따로 주고받는다.
   - 대상은 PERSONAL 키뿐이고, 서버에서 지우는 일은 절대 하지 않는다.
   - 개인 공간을 못 찾으면 조용히 건너뛴다(있던 동작 그대로).
   - 개인 공간에 있을 땐 본 동기화가 이미 처리하므로 돌지 않는다. */
function personalWid(){
  try{
    var l=wsList(),me=(getSess()||{}).uid;
    var p=l.filter(function(w){ return w&&w.kind==='personal'; });
    if(!p.length)return '';
    var mine=p.filter(function(w){ return !me||!w.owner_id||w.owner_id===me; });
    return (mine[0]||p[0]).id||'';
  }catch(_){ return ''; }
}
function syncPersonal(at){
  if(!isTeamWs()) return Promise.resolve(0);           /* 개인 공간이면 본 동기화가 처리 */
  var pwid=personalWid(); if(!pwid) return Promise.resolve(0);
  var keys=KEYS.filter(function(k){ return PERSONAL[k]; });
  if(!keys.length) return Promise.resolve(0);
  var idbKeys=keys.filter(function(k){ return idbBacked(k); });
  var readIdb=idbKeys.length&&window.storage
    ? Promise.all(idbKeys.map(function(k){ return window.storage.get(k).then(function(r){ return [k,r?r.value:null]; }); }))
    : Promise.resolve([]);
  return readIdb.then(function(pairs){
    var vals={}; pairs.forEach(function(p){ vals[p[0]]=p[1]; });
    /* 2.599 — 두 단계: 메타(k,cupd)만 받고, 서버가 바뀐 키·로컬이 빈 키·검증 가져오기 키만 v 를 받는다.
       예전엔 회차(45초)마다 개인 키 여덟(노트 최대 927KB·IDP 수십 KB)의 v 를 통째로 받았다 — 이그레스의 가장 큰 상수항. */
    var base0=BASE+'/rest/v1/ps_kv?workspace_id=eq.'+encodeURIComponent(pwid);
    var mp=meta(); mp.p=mp.p||{}; mp.p.c=mp.p.c||{};
    function locOf(k){ if(idbBacked(k)) return (vals[k]===undefined?null:vals[k]); try{ return localStorage.getItem(k); }catch(_){ return null; } }
    return syncFetch('personal_meta',base0+'&k=in.('+keys.map(encodeURIComponent).join(',')+')&select=k,cupd',{headers:hj(at)}).then(function(r){
      if(!r.ok)throw syncHttpError('personal_meta',r.status);
      return r.json();
    }).then(function(metaRows){
      var need=[]; (metaRows||[]).forEach(function(r0){ var loc=locOf(r0.k); if(loc==null||r0.cupd!==(mp.p.c[r0.k]||0)||importApproved(r0.k,loc))need.push(r0.k); });
      if(!need.length) return metaRows||[];
      return syncFetch('personal_pull',base0+'&k=in.('+need.map(encodeURIComponent).join(',')+')&select=k,v,cupd',{headers:hj(at)}).then(function(r){
        if(!r.ok)throw syncHttpError('personal_pull',r.status);
        return r.json();
      }).then(function(vrows){ var vm={}; (vrows||[]).forEach(function(x){vm[x.k]=x;}); return (metaRows||[]).map(function(r0){ return vm[r0.k]||r0; }); });
    }).then(function(rows){
      var srv={}; (rows||[]).forEach(function(r0){ srv[r0.k]=r0; });
      var m=meta(), now=Date.now(), pushRows=[], writes=[], applied=0;
      m.p=m.p||{};                                     /* 개인 채널 전용 상태 — 본 동기화 메타(h/c)와 섞지 않는다 */
      m.p.h=m.p.h||{}; m.p.c=m.p.c||{};
      keys.forEach(function(k){
        var loc=null;
        if(idbBacked(k)) loc=(vals[k]===undefined?null:vals[k]);
        else { try{ loc=localStorage.getItem(k); }catch(_){} }
        if(loc!=null&&loc.length>MAXLEN) return;        /* 너무 크면 건너뛴다(본 동기화와 같은 기준) */
        var row=srv[k], lh=hash(loc);
        var dirty=(lh!==(m.p.h[k]||'')), srvChanged=row?(row.cupd!==(m.p.c[k]||0)):false;
        if(loc==null&&!row) return;
        if(row&&typeof row.v!=='string'&&(loc==null||srvChanged)) return;   /* 2.599 — v 가 안 온 행(두 단계 경합)은 다음 회차에 */
        if(loc==null&&row){ if(kvWrite(k,row.v,writes)){ applied++; m.p.h[k]=hash(row.v); m.p.c[k]=row.cupd; } return; }
        /* 1.644 — 경기 파일의 개인 메모도 검증된 가져오기 원문이 우선이다.
           단, 서버의 다른 경기 메모는 importRebaseRaw가 그대로 보존한다. */
        if(row&&row.v!==loc&&importApproved(k,loc)){
          var approvedPersonal=importApprovedRebase(k,loc,row.v),personalRaw=approvedPersonal&&approvedPersonal.raw;
          if(personalRaw==null){syncDiagnostic('import-rebase-pending',new Error('개인 경기 메모 병합 대기'));return;}
          if(personalRaw!==loc){if(!kvWrite(k,personalRaw,writes,loc)){importApprovalClear(k);return;}applied++;loc=personalRaw;lh=hash(loc);}
          pushRows.push({workspace_id:pwid,k:k,v:loc,cupd:now,_casCupd:row.cupd});m.p.h[k]=lh;m.p.c[k]=now;return;
        }
        if(loc!=null&&!row){ var personalNew={workspace_id:pwid,k:k,v:loc,cupd:now};if(importApproved(k,loc))personalNew._casMissing=true;pushRows.push(personalNew); m.p.h[k]=lh; m.p.c[k]=now; return; }
        if(dirty){                                     /* 내가 고쳤으면 내 것을 올린다(개인 자료라 경쟁자가 없다) */
          pushRows.push({workspace_id:pwid,k:k,v:loc,cupd:now}); m.p.h[k]=lh; m.p.c[k]=now; return;
        }
        if(srvChanged){ if(kvWrite(k,row.v,writes)){ applied++; m.p.h[k]=hash(row.v); m.p.c[k]=row.cupd; } }
      });
      /* 1.630 — 개인 채널도 같은 통로다. 매치데스크·노트는 키 하나가 MAXLEN(1.5M)까지 갈 수 있어
         네 키가 함께 움직이면 한 요청이 몇 MB가 된다 — 팀 쪽과 똑같이 나눠 보낸다. */
      return kvPushRows(at,pushRows,null,'personal_push').then(function(){ return Promise.all(writes); })
        .then(function(){ setMeta(m); return outboxAckPersonal(pwid,m); })
        .then(function(){ return applied; });
    });
  }).catch(function(e){ syncDiagnostic('personal-channel',e); return 0; });   /* 개인 채널 실패가 본 동기화를 막지 않는다 */
}
/* 1.504 — 충돌 사본 청소: 밀려난 서버본은 ps_sync_conflict_<키>에 남겨 두는데, 알림 목록에서 빠진 뒤에도
   영영 남아 localStorage를 잠식한다(실측 15개·548KB — 노트 사본만 509KB).
   알림 목록에 없고 14일이 지난 사본은 지운다. 목록에 살아 있는 것은 건드리지 않는다. */
function pruneConflictCopies(){
  try{
    var live={}; (conflictList()||[]).forEach(function(c){ if(c&&c.k)live[c.k]=1; });
    var stamps={}; try{ stamps=JSON.parse(localStorage.getItem('ps_sync_conf_seen')||'{}')||{}; }catch(_){ stamps={}; }
    var now=Date.now(), TTL=12096e5, keep={}, removed=0;
    for(var i=localStorage.length-1;i>=0;i--){
      var k=localStorage.key(i); if(!k||k.indexOf('ps_sync_conflict_')!==0)continue;
      var key=k.slice('ps_sync_conflict_'.length);
      if(live[key]){ keep[key]=stamps[key]||now; continue; }      /* 아직 알림에 살아 있음 */
      var seen=stamps[key]||now;
      if(now-seen>TTL){ try{ localStorage.removeItem(k); removed++; }catch(_){} }
      else keep[key]=seen;
    }
    try{ localStorage.setItem('ps_sync_conf_seen',JSON.stringify(keep)); }catch(_){}
    return removed;
  }catch(_){ return 0; }
}
/* 서버가 경기 연결 필드 한 행만 거부했을 때 다음 **새 회차**가 그 서버 raw를
   반드시 받게 한다. 실패 회차의 m은 부분 성공을 포함한 임시본이라 절대 저장하지 않는다. */
function rejectedMatchRetry(e,wid){
  var keys=(e&&Array.isArray(e.psRejectedKeys))?e.psRejectedKeys.filter(function(k,i,a){return a.indexOf(k)===i;}):[];
  /* 2.587 — **일정(process_coach_v1)도 같은 길로**(사용자 "워크스페이스 전환이 안된다" — 서버 기록으로 확인한 원인).
     서버 계보 가드(1.644)는 낡은 base 위의 일정 커밋을 **옛 값·옛 cupd 그대로** 돌려보낸다. 기기는 «서버가 더 새롭다» 는
     신호(cupd)를 못 받아 같은 base 로 또 올리고 또 거부된다 — ps_kv_denied 실측 2026-08-08~09-03: 45건·43명, 최근 7일 6기기.
     경기와 똑같이 그 키의 c 를 0 으로 내려 다음 회차가 서버 원문을 **반드시** 받아 병합(MERGE_KEYS, h 는 남겨 병합 가드 통과)한 뒤
     새 base 위에서 다시 올리게 한다. forceSync(preswitch) 는 두 번까지 재시도하므로 전환도 이 길로 풀린다. */
  /* 2.715 — 선수단·스카우트도 같은 길. 서버 모양 가드(2.681)가 거부하면 기기는 «못 올렸어요 · 팀 것이 더 새로워요»만 띄운 채
     같은 값을 영원히 다시 올렸다(9/8 풋볼A 18:44·18:45·18:50 세 번 거부, 기기 화면은 계속 90명). c 를 0 으로 내리면 다음 회차가
     서버 원문을 받아 COPIES_OFF «팀 것이 정본»(2.678)으로 이 기기를 맞춘다. */
  var RETRY={cs_team_matches_v1:1,process_coach_v1:1,cs_squad_v1:1,scout_tool_v1:1};
  if(!keys.length||keys.some(function(k){return !RETRY[k];}))return null;
  var latest=meta();latest.c=latest.c||{};keys.forEach(function(k){latest.c[k]=0;});setMeta(latest);
  return {serverRejected:keys,pending:pendingInfo(wid).count};
}
function syncNow(reason){
  var lockWid=activeWs();
  if(importSyncLock){
    if((reason==='team-section-import'||reason==='team-section-preflight')&&lockWid===importSyncWid)return syncNowCore(reason);
    return Promise.resolve({skip:1,importLocked:1});
  }
  if(lockWid&&navigator.locks&&navigator.locks.request){
    return navigator.locks.request('process-studio-sync-'+lockWid,{mode:'exclusive'},function(){return syncNowCore(reason);});
  }
  return syncNowCore(reason);
}
function syncNowCore(reason){
  if(busy) return Promise.resolve({skip:1});
  var s=getSess(); if(!s) return Promise.resolve({noauth:1});
  /* uid+워크스페이스 소유권 확인 전에는 pull도 push도 하지 않는다.
     특히 다른 계정의 로컬 캐시를 새 개인 공간으로 push하는 경로를 여기서 끝낸다. */
  if(!dataUnlocked()) return Promise.resolve({locked:1,noauth:1});
  var wid=activeWs(); if(!wid){ return loadWorkspaces().then(function(){ var w2=activeWs(); return w2?syncNow(reason):{nows:1}; }); }
  if(navigator.onLine===false){
    var po=pendingInfo(wid);
    setStatus(po.count?('오프라인이에요 · 이 기기에 '+po.count+'건 안전하게 있어요'):'오프라인이에요 · 이 기기에 저장돼요');
    try{renderUI();}catch(_){}
    return Promise.resolve({offline:1,pending:po.count});
  }
  busy=true; setStatus('올리는 중…');
  try{ clearTimeout(busyDog); }catch(_){} busyDog=setTimeout(function(){ busy=false; }, 25000);   /* 워치독: fetch가 응답 없이 멈춰도 25초 뒤 busy 해제(전체 동기화 영구 정지 방지) */
  /* iframe storage 이벤트를 받아 parent IDB에 미러링하던 쓰기가 끝난 뒤 preload한다. */
  var sharedReady=(window.PSStorage&&PSStorage.sharedReady)?PSStorage.sharedReady():Promise.resolve(true);
  return Promise.resolve(sharedReady).then(function(){return syncBasePrimeAll();}).then(function(){return ensureToken();}).then(function(at){
    if(!at){ busy=false; try{ clearTimeout(busyDog); }catch(_){} return {noauth:1}; }
    try{ usagePing(at); }catch(_){}
    /* 1.631 — 서버 권한 규칙이 항목 키를 아는지 하루 한 번 확인해 둔다(캐시).
       아래 항목 블록의 푸시 판정은 동기라, 여기서 미리 채워 두지 않으면 늘 '모름=안 올림'이 된다. */
    if(ITEMS_ACTIVE)try{ itemsServerCheck(); }catch(_){}
    /* 2단계 풀 — 평상시엔 메타(k,cupd)만 받고, 서버가 바뀐 키·로컬이 빈 키만 값(v)을 받는다.
       매번 값 전체를 내려받으면 (사용자 수 × 3분 주기)만큼 전송량이 쌓여 동시 사용 확장이 막힌다.
       값 없이 온 행은 아래 분기들이 row.v를 읽지 않는 조합(서버 변경 없음 + 로컬 존재)뿐이라 안전하다. */
    return kvMetaFetch(at,wid).then(function(r){
      if(!r.ok) throw syncHttpError('kv_meta',r.status);
      return r.json();
    /* 1.619 — 권한 문서를 IndexedDB 에서 먼저 확보한다. 아래 푸시 판정이 동기라
       여기서 못 채우면 새 기기가 fail-closed 에 걸려 정당한 스태프가 못 올린다. */
    }).then(function(metaRows){
      /* 1.633 — 누가 마지막으로 고쳤는지는 **서버가 말한 것만** 담는다(기기 사본은 뒤처져 있다) */
      try{ whoRemember(metaRows,wid); namesRefresh(wid); }catch(_){}
      return permsPrime().then(kvPreload).then(function(idbVals){ return [metaRows||[],idbVals]; }); })
      .then(function(pre){
      var metaRows=pre[0], idbVals=pre[1];
      var m0=meta(), needV=[];
      metaRows.forEach(function(r0){
        var k=r0.k;
        if(!ITEMS_ACTIVE&&isItemKey(k))return;
        /* 2.603 — 화면이 안 쓰는 키(KEYS·IDP 접두사 밖)는 값을 받지 않는다. 실측: 풋볼A 의 ps_kv 에 «팀 자료 통째로 올리기»(bulkPush)가 남긴
           cs_drill_lib_v1 한 줄(8,036KB, 9/1·9/2·9/4 세 번)을 그 팀의 다른 기기 전부가 회차(45초)마다 통째로 받고 있었다 —
           적용 루프(KEYS.forEach)는 무시하니 m.c[k] 가 영영 안 올라가 매번 «바뀐 키»로 보였다. 이그레스 250GB 의 가장 큰 후보. */
        if(KEYS.indexOf(k)<0&&k.indexOf('cs_idp_v1_')!==0&&k.indexOf('cs_idp_pub_v1_')!==0)return;
        if(k===SCHEDULE_KEY){
          /* 1.644 — 일정은 화면이 localStorage 거울을, 동기화가 IDB를 함께 쓴다.
             iPad에서 둘이 다르거나 로컬 hash가 확정 hash와 다르면 cupd가 같아도
             서버 원문을 받아야 rev/base를 판단할 수 있다. 메타만 받고 밀어올리면
             서버 rev를 0으로 오해해 영구 재시도가 된다. */
          var idbLoc=(idbVals[k]===undefined?null:idbVals[k]),mirrorLoc=null;
          try{mirrorLoc=localStorage.getItem(k);}catch(_){}
          var effectiveLoc=(mirrorLoc!=null?mirrorLoc:idbLoc);
          var split=(mirrorLoc!=null&&idbLoc!=null&&mirrorLoc!==idbLoc);
          var sameSrv=(r0.cupd===(m0.c[k]||0));
          if(!sameSrv||effectiveLoc==null||split){ needV.push(k); return; }
          if(hash(effectiveLoc)!==(m0.h[k]||'')){
            /* 2.607 — 편집 중(로컬 dirty)에 서버 cupd 가 지난 확정과 같으면 서버 원문 = 마지막 확정 base(1.658, IDB). 그 base 의 hash 가
               확정 hash(m.h) 와 같을 때만 base 를 서버 원문으로 쓰고 다시 받지 않는다(가드는 수락 시 v 를 고쳐 쓰지 않는다 — lineage-guard 확인).
               base 가 없거나 hash 가 다르면(실패한 push 가 base 를 덮어쓴 경우 등) 예전대로 받는다. 편집 한 번에 회차마다 최대 2MB 를 다시 받던 길. */
            var sb=null; try{ sb=syncBaseGet(k); }catch(_){ sb=null; }
            if(sb!=null&&hash(sb)===(m0.h[k]||'')){ r0.v=sb; r0.__fromBase=1; }
            else needV.push(k);
          }
          return;
        }
        if(r0.cupd!==(m0.c[k]||0)){ needV.push(k); return; }
        var loc=null;
        if(idbBacked(k)) loc=(idbVals[k]===undefined?null:idbVals[k]);
        else { try{ loc=localStorage.getItem(k); }catch(_){} }
        if(loc==null) needV.push(k);   /* 로컬이 비었으면 서버본으로 복원해야 하니 값이 필요하다 */
        /* 1.573 — 로컬이 '빈 목록'이면 서버 값을 받아 대조한다(기억한 숫자보다 정확하다).
           빈 값 업로드는 바로 이 경우라, 이때만 값을 더 받는 비용은 싸다. */
        else if(psCount(loc)===0) needV.push(k);
        /* 메뉴 파일 승인 원문은 서버 최신 raw 위에 해당 projection만 다시 얹는다.
           cupd가 같아도 v를 생략하면 CAS rebase를 시작할 수 없어 영구 대기가 된다. */
        else if(importApproved(k,loc)) needV.push(k);
      });
      return kvPullValues(at,wid,needV).then(function(full){
        var fv={}; (full||[]).forEach(function(r0){ fv[r0.k]=r0; });
        return [metaRows.map(function(r0){ return fv[r0.k]||r0; }),idbVals];
      });
    }).then(function(pair){
      var rows=pair[0], idbVals=pair[1];
      var srv={}; (rows||[]).forEach(function(r0){ srv[r0.k]=r0; });
      var m=meta(), pushRows=[], applied=0, skippedBig=0, skippedKeys=[], heldKeys=[], dependencyDeferredKeys=[], now=Date.now(), writes=[];
      var scheduleGuard={stale:false},schedulePushExpected=null,scheduleMetaBefore=null,scheduleAppliedPlanned=0,scheduleDeferred=false,scheduleMetaRestored=false,schedulePushHeld=false,scheduleDependencyBlocked=false,scheduleDependencyRetry=false;
      function deferScheduleMatch(){
        if(dependencyDeferredKeys.indexOf('cs_team_matches_v1')<0)dependencyDeferredKeys.push('cs_team_matches_v1');
        /* 일정을 이번 회차에 올리거나 서버본으로 바꾼으면, 그 쓰기가
           확정된 다음 새 회차에서 경기를 보낸다. 편집 hold는 scheduleResumeSoon이,
           급감 hold는 사용자 확인이 다음 회차를 열므로 여기서는 자동 재시도하지 않는다. */
        if(!scheduleHeld()&&!schedulePushHeld&&!scheduleDependencyBlocked&&
           (schedulePushExpected!=null||scheduleAppliedPlanned>0))scheduleDependencyRetry=true;
      }
      function pushHoldTracked(k,loc,srvVal,memN){
        var held=pushHold(k,loc,srvVal,memN);
        if(held){
          if(heldKeys.indexOf(k)<0)heldKeys.push(k);
          if(k===SCHEDULE_KEY)schedulePushHeld=true;
        }
        return held;
      }
      function queuePush(k,raw,confirmedRaw,expectedLoc,casCupd,casMissing){
        var send=raw,scheduleImportRec=null,scheduleImportMoved=false;
        if(k===SCHEDULE_KEY){
          scheduleImportRec=importApprovalGet(k,raw);
          if(confirmedRaw==null&&scheduleMetaBefore)confirmedRaw=scheduleMetaBefore.base;
          send=scheduleCommitRaw(raw,confirmedRaw);
          if(!send){scheduleDeferred=true;syncDiagnostic('schedule-commit-encode',new Error('일정 커밋 판본 생성 실패'));return null;}
          if(scheduleImportRec&&send!==raw){
            if(!importApprovalPut(k,send,scheduleImportRec.s||{})){scheduleDeferred=true;syncDiagnostic('schedule-import-token',new Error('일정 가져오기 승인 갱신 실패'));return null;}
            scheduleImportMoved=true;
          }
          if(send!==expectedLoc){
            if(!kvWrite(k,send,writes,expectedLoc,scheduleGuard)){
              if(scheduleImportMoved)importApprovalPut(k,raw,scheduleImportRec.s||{});
              scheduleDeferred=true;return null;
            }
            applied++;scheduleAppliedPlanned++;
          }
          schedulePushExpected=send;
        }
        var pushRow={workspace_id:wid,k:k,v:send,cupd:now};if(casCupd!=null)pushRow._casCupd=casCupd;if(casMissing)pushRow._casMissing=true;pushRows.push(pushRow);
        m.h[k]=hash(send);m.c[k]=now;nSet(m,k,send);syncBaseSet(k,send);
        return send;
      }
      var teamWs=isTeamWs();
      KEYS.forEach(function(k){
        /* 개인 노트는 팀 워크스페이스에서 주고받지 않는다(통째 덮어쓰기 방지) */
        if(PERSONAL[k] && teamWs) return;
        /* 1.659 — 일정과 연결 경기는 항상 2회차로 나눈다.
           편집 5초 hold 중 4초 자동 동기화가 먼저 시작하면 예전엔 경기만
           옛 서버 일정 앞으로 가 lineage guard에 거부됐다. 편집·급감·CAS 보류는
           물론, 일정을 방금 받았거나 올리는 회차에도 경기 원문을 읽거나 보내지 않는다. */
        if(k==='cs_team_matches_v1'&&
           (schedulePushHeld||scheduleDeferred||scheduleHeld()||scheduleDependencyBlocked||
            schedulePushExpected!=null||scheduleAppliedPlanned>0)){
          deferScheduleMatch();
          return;
        }
        if(k===SCHEDULE_KEY&&scheduleHeld()){scheduleDeferred=true;return;}
        /* board가 IndexedDB에 저장하는 키는 localStorage가 아니라 어댑터에서 읽어야 한다 */
        var loc=null;
        if(idbBacked(k)) loc=(idbVals[k]===undefined?null:idbVals[k]);
        else { try{ loc=localStorage.getItem(k); }catch(_){} }
        /* 화면 저장은 거울을 먼저 바꾼다. 일정만은 회차 시작 때 읽은 옛 IDB보다
           이 순간의 localStorage 거울을 우선한다. */
        if(k===SCHEDULE_KEY){
          try{var scheduleMirror=localStorage.getItem(k);if(scheduleMirror!=null)loc=scheduleMirror;}catch(_){}
          scheduleMetaBefore={h:m.h[k],c:m.c[k],n:m.n[k],base:syncBaseGet(k)};
        }
        var lh=hash(loc);
        var dirty=(lh!==(m.h[k]||''));
        var row=srv[k],scheduleServerOriginal=null,scheduleServerNormalized=false;
        if(k===SCHEDULE_KEY&&row&&row.v!=null){
          scheduleServerOriginal=row.v;
          var safeSchedule=normalizeCoachDocument(row.v);
          if(!safeSchedule){scheduleDeferred=true;syncDiagnostic('schedule-anchor-invalid',new Error('일정 기준일 검증 실패'));return;}
          if(safeSchedule!==row.v){scheduleServerNormalized=true;row={k:row.k,v:safeSchedule,cupd:row.cupd};}
        }
        var srvChanged=row?(row.cupd!==(m.c[k]||0)):false;
        if(loc!=null&&loc.length>syncMaxLen(k)){
          skippedBig++; skippedKeys.push(k);
          if(k===SCHEDULE_KEY)scheduleDependencyBlocked=true;
          return;
        }
        if(loc==null&&!row) return;
        /* 1.644 — 읽기 전용 기기는 dirty 판정보다 서버 일정이 먼저다.
           예전에는 로컬 승리 본을 먼저 만든 뒤 권한 필터에서 push만 제거해,
           스태프 iPad는 새 서버 일정을 영원히 받지 못했다. 로컬 차이는
           kvWrite의 rescue에 남기고 표시는 서버와 맞춘다. */
        if(k===SCHEDULE_KEY&&row&&row.v!=null&&!scheduleWriteAllowed()){
          if(loc===row.v){m.h[k]=hash(row.v);m.c[k]=row.cupd;nSet(m,k,row.v);syncBaseSet(k,row.v);holdClear(k);importApprovalClear(k);return;}
          if(kvWrite(k,row.v,writes,loc,scheduleGuard)){
            applied++;scheduleAppliedPlanned++;m.h[k]=hash(row.v);m.c[k]=row.cupd;nSet(m,k,row.v);syncBaseSet(k,row.v);
          }
          importApprovalClear(k);
          return;
        }
        if(loc==null&&row){ if(kvWrite(k,row.v,writes,loc,k===SCHEDULE_KEY?scheduleGuard:null)){ applied++;if(k===SCHEDULE_KEY)scheduleAppliedPlanned++; m.h[k]=hash(row.v); m.c[k]=row.cupd; nSet(m,k,row.v); syncBaseSet(k,row.v); } return; }
        /* 서버와 이 기기가 이미 글자 하나까지 같으면 과거 보류 표시는 끝난 상태다. */
        if(row&&row.v===loc){holdClear(k);importApprovalClear(k);}
        /* 1.644 — 검증된 메뉴 파일은 dirty/base/병합보다 먼저 '그 원문 그대로 교체'한다.
           파일 값이 우연히 마지막 로컬 hash와 같아도 서버가 더 새로우면 dirty=false가 되므로,
           이 우선 분기가 없으면 가져온 파일을 조용히 버리고도 성공으로 보이게 된다. */
        if(row&&row.v!==loc&&importApproved(k,loc)){
          var approvedImport=importApprovedRebase(k,loc,k===SCHEDULE_KEY?(scheduleServerOriginal||row.v):row.v),approvedRaw=approvedImport&&approvedImport.raw;
          if(approvedRaw==null){syncDiagnostic('import-rebase-pending',new Error('팀 메뉴 병합 대기: '+k));return;}
          if(approvedRaw!==loc){
            if(!kvWrite(k,approvedRaw,writes,loc,k===SCHEDULE_KEY?scheduleGuard:null)){importApprovalClear(k);return;}
            applied++;if(k===SCHEDULE_KEY)scheduleAppliedPlanned++;
          }
          queuePush(k,approvedRaw,k===SCHEDULE_KEY?(scheduleServerOriginal||row.v):row.v,approvedRaw,row.cupd,false);return;
        }
        /* 응답만 잃은 재시도: 로컬 후보와 서버 확정 raw가 같으면 새 rev를 만들지 않고 확정한다. */
        if(k===SCHEDULE_KEY&&row&&row.v!=null&&loc===row.v&&!scheduleServerNormalized){m.h[k]=lh;m.c[k]=row.cupd;nSet(m,k,loc);syncBaseSet(k,loc);return;}
        /* 서버의 옛 anchor를 절대 날짜 보존 정규화한 결과가 이미 로컬과 같으면,
           원본 서버 rev 위의 다음 커밋으로 서버도 교정한다. */
        if(k===SCHEDULE_KEY&&scheduleServerNormalized&&loc===row.v){queuePush(k,loc,scheduleServerOriginal,loc);return;}
        /* 1.590 — **여기가 1.573 보호가 뚫려 있던 자리다.**
           "서버에 이 키의 행이 없다"는 이유로 로컬을 조건 없이 올렸다. 그런데 행이 없는 건
           처음 올리는 경우만이 아니다 — 조회가 그 회차에 이 키를 못 받아 왔을 수도 있고,
           공간을 막 바꾼 직후일 수도 있다. 그 순간 로컬이 반쯤 비어 있으면 **그 빈 값이 서버의 정본이 되고**,
           다음 회차에 모든 기기로 내려가 멀쩡한 자료를 덮는다.
           2026-08-05 스카우팅 후보 34명 → 1명이 정확히 이 모양이었다(어느 기기에서 1명이 올라갔는지는
           기록이 없어 끝내 특정하지 못했다 — 그래서 이번에 pushLog 도 함께 넣었다).
           서버 값이 없으니 기억해 둔 개수(m.n[k])와 견준다. 처음 올리는 키는 m.n 이 없어 그대로 통과한다. */
        if(loc!=null&&!row){
          if(pushHoldTracked(k,loc,null,m.n[k])) return;
          queuePush(k,loc,null,loc,null,importApproved(k,loc));return; }
        if(dirty&&!srvChanged){
          /* 1.573 — 크게 줄어든 값은 올리지 않고 멈춘다. m.h/m.c 를 그대로 두므로
             로컬은 계속 dirty 로 남고, 사용자가 확인하면 다음 회차에 올라간다. */
          if(pushHoldTracked(k,loc,row?row.v:null,m.n[k])) return;
          queuePush(k,loc,row&&row.v!=null?row.v:null,loc);return; }
        if(!dirty&&srvChanged){ if(kvWrite(k,row.v,writes,loc,k===SCHEDULE_KEY?scheduleGuard:null)){ applied++;if(k===SCHEDULE_KEY)scheduleAppliedPlanned++; m.h[k]=hash(row.v); m.c[k]=row.cupd; nSet(m,k,row.v); syncBaseSet(k,row.v); } return; }
        if(dirty&&srvChanged){
          /* 진짜 3-way 병합은 base가 '마지막 확정 hash'와 정확히 같을 때만 가능하다.
             1.642 이전 iPad에는 워크스페이스별 base가 없다. 그 상태에서 병합하면
             모든 다른 날짜가 로컬 승이 되어 8/8 복구본이 다시 8/5로 돌아간다. */
          if(k===SCHEDULE_KEY){
            var trustedBase=syncBaseGet(k);
            if(!trustedBase||hash(trustedBase)!==(m.h[k]||'')){
              /* 파일 해시·팀·권한을 확인하고 방금 가져온 원문만 예외.
                 현재 서버 raw를 confirmed base로 넣어 lineage 트리거는 그대로 지킨다. */
              if(importApproved(k,loc)){queuePush(k,loc,scheduleServerOriginal||row.v,loc);return;}
              if(kvWrite(k,row.v,writes,loc,scheduleGuard)){
                applied++;scheduleAppliedPlanned++;m.h[k]=hash(row.v);m.c[k]=row.cupd;nSet(m,k,row.v);syncBaseSet(k,row.v);
              }
              importApprovalClear(k);
              return;
            }
          }
          /* 경기 문서는 일정에서 만든 sourceId 연결을 포함한다. 둘 다 바뀐
             최초 만남에서 구 iPad 통째 문서가 이기면 서버 연결 날짜가 다시 옮겨진다.
             서버본을 적용하되 기존 로컬본은 rescue에 남겨 손실하지 않는다. */
          if(k==='cs_team_matches_v1'){
            if(importApproved(k,loc)){queuePush(k,loc,row.v,loc);return;}
            /* 1.647 — 서버 거부 뒤 강제 재확인도 이 분기로 온다. 구조선이 실제로
               남지 않았다면 서버본으로 덮지 않고 outbox를 그대로 둔다. */
            if(!rescuePrepared(k,loc,row.v)){syncDiagnostic('match-server-rescue',new Error('경기 복구본을 확인하지 못했습니다'));return;}
            var matchWriteGuard={stale:false};
            if(kvWrite(k,row.v,writes,loc,matchWriteGuard)){applied++;m.h[k]=hash(row.v);m.c[k]=row.cupd;nSet(m,k,row.v);}
            importApprovalClear(k);
            return;
          }
          /* 주간 일정은 날짜 단위, 선수단·경기는 항목 단위 병합 —
             둘이 서로 다른 곳을 고치면 둘 다 살린다 */
          if(MERGE_KEYS[k]){
            /* 2.678 — 기준본이 없으면 병합하지 않는다. 기준본 없는 3-way 는 양쪽을 «추가»로 보고 합쳐 버린다
               (실측 9/7 21:36 풋볼A: 2.675 지우기가 기준본을 비운 기기가 선수단 44→92·스카우트 44→104 중복을 올림).
               팀 것(서버)을 받고, 이 기기 편집은 다음 편집 때 다시 올라간다. */
            if(COPIES_OFF&&!syncBaseGet(k)){
              if(kvWrite(k,row.v,writes,loc,k===SCHEDULE_KEY?scheduleGuard:null)){ applied++;if(k===SCHEDULE_KEY)scheduleAppliedPlanned++; m.h[k]=hash(row.v); m.c[k]=row.cupd; nSet(m,k,row.v); syncBaseSet(k,row.v); }
              return;
            }
            var mg=MERGE_LIST[k]
              ? mergeByIdDoc(syncBaseGet(k),loc,row.v,MERGE_LIST[k].list,MERGE_LIST[k].id)
              : mergeCoachWeeks(syncBaseGet(k),loc,row.v);
            if(mg){
              queuePush(k,mg,k===SCHEDULE_KEY?(scheduleServerOriginal||row.v):row.v,loc);
              return;
            }
          }
          /* 충돌: 손에 든 기기 우선(로컬 승) — 서버본은 로컬 백업으로 보존.
             단, 서버본이 내 것과 글자 하나까지 같으면 실제로 밀린 게 없다 → 알리지 않는다(1.526).
             이 헛알림 때문에 스무 개가 한꺼번에 뜨는 일이 있었다. */
          if(row.v===loc){ m.h[k]=lh; m.c[k]=row.cupd; nSet(m,k,loc); return; }
          /* 2.678 — 사본 없는 모드에선 «팀 것이 정본»: 양쪽이 같이 바뀌면 서버를 받는다(사용자 "데이터베이스 기반").
             로컬 승은 낡은 기기·중복 목록이 팀 자료를 덮는 길이었다(9/7 경기 점수 47개·선수단 중복). 급감 보류(2.626)는 이 앞의
             dirty&&!srvChanged 길에서 그대로 산다. */
          if(COPIES_OFF){
            if(kvWrite(k,row.v,writes,loc,k===SCHEDULE_KEY?scheduleGuard:null)){ applied++;if(k===SCHEDULE_KEY)scheduleAppliedPlanned++; m.h[k]=hash(row.v); m.c[k]=row.cupd; nSet(m,k,row.v); syncBaseSet(k,row.v); }
            return;
          }
          try{ (COPIES_OFF||localStorage.setItem('ps_sync_conflict_'+k,row.v)); }catch(_){}
          conflictNote(k);
          /* 1.573 — 충돌에서 로컬이 이기더라도 크게 줄어든 값이면 멈춘다.
             여기선 서버 값(row.v)이 손에 있으므로 기억한 숫자가 아니라 실제 서버 것과 견준다. */
          if(pushHoldTracked(k,loc,row.v,m.n[k])) return;
          queuePush(k,loc,k===SCHEDULE_KEY?(scheduleServerOriginal||row.v):row.v,loc);return;
        }
        /* 양쪽 다 그대로 — 병합 키는 base가 없으면 지금 상태를 base로 */
        if(MERGE_KEYS[k]&&loc!=null&&!syncBaseGet(k))syncBaseSet(k,loc);
      });
      /* ── IDP 접두사 키(cs_idp_v1_<uid>) — 내 것만 push, 남의 것은 pull 전용 (IDP-설계.md v1.1)
            각 선수가 자기 키에만 쓰므로 키 단위 LWW로 충돌 없음. cs_idp_v1_local(비로그인)은 동기화 제외.
            공유 규칙(2026-07-19): ① 남의 IDP는 코치·스태프만 — 선수 역할이면 pull 안 하고 남아있던 것도 지운다.
            ② 이미지노트(imgNotes)는 심리 기록 — 팀 워크스페이스엔 올리지 않는다(개인 워크스페이스 기기 동기화엔 포함).
               팀 서버본을 받아 내 로컬을 갱신할 때도 로컬 imgNotes 는 보존한다. */
      (function(){
        var IDPP='cs_idp_v1_';
        var myIdp=(s&&s.uid)?(IDPP+s.uid):null;
        var teamW=isTeamWs();
        /* 1.619 — 여기도 기본값이 'admin' 이었다. 이 역할은 **남의 IDP 를 받아올지**를 정한다.
           권한 문서를 못 읽은 기기가 팀원 전원의 개인 성장 계획을 통째로 받아 오던 셈이다.
           팀 공간이 아니면(개인 사용) 예전처럼 'admin' 이라 혼자 쓰는 사람은 영향이 없다. */
        var role=teamW?'player':'admin';
        try{
          if(teamW&&s&&s.uid){
            var _w=activeWsObj(); var _p=null; try{ _p=JSON.parse(permsRaw()||'null'); }catch(_){}
            if(_w&&_w.role==='owner') role='admin';
            else if(_p){ var _me=_p.members&&_p.members[s.uid]; role=(_me&&_me.role)||_p.defaultRole||'player'; }
          }
        }catch(_){ role=teamW?'player':'admin'; }
        function stripImg(str){ try{ var o=JSON.parse(str); if(o&&Array.isArray(o.imgNotes)&&o.imgNotes.length)o.imgNotes=[]; return JSON.stringify(o); }catch(_){ return str; } }
        function keepMyImg(srvStr,locStr){ if(!teamW) return srvStr;
          try{ var so=JSON.parse(srvStr), lo=locStr?JSON.parse(locStr):null;
            if(so&&lo&&Array.isArray(lo.imgNotes)&&lo.imgNotes.length&&(!so.imgNotes||!so.imgNotes.length)) so.imgNotes=lo.imgNotes;
            return JSON.stringify(so); }catch(_){ return srvStr; } }
        function pushVal(v){ return teamW?stripImg(v):v; }
        var set={}; if(myIdp)set[myIdp]=1;
        Object.keys(srv).forEach(function(k){ if(k.indexOf(IDPP)===0)set[k]=1; });
        try{ for(var li=0;li<localStorage.length;li++){ var lk2=localStorage.key(li); if(lk2&&lk2.indexOf(IDPP)===0)set[lk2]=1; } }catch(_){}
        Object.keys(set).forEach(function(k){
          if(k===IDPP+'local')return;
          var mine=(k===myIdp);
          if(!mine&&role==='player'){ /* 선수끼리는 서로의 IDP가 안 보인다 — 이미 받아둔 것도 정리 */
            try{ localStorage.removeItem(k); }catch(_){} delete m.h[k]; delete m.c[k]; return; }
          var loc=null; try{ loc=localStorage.getItem(k); }catch(_){}
          var lh=hash(loc), dirty=(lh!==(m.h[k]||'')), row=srv[k], srvChanged=row?(row.cupd!==(m.c[k]||0)):false;
          if(loc!=null&&loc.length>MAXLEN){ skippedBig++; skippedKeys.push(k); return; }
          if(mine){
            /* 1.573 출고 검사 — 여기선 서버 값을 기준으로 삼지 않는다.
               팀 워크스페이스에서는 pushVal 이 imgNotes 를 떼고 올리므로 서버본이 늘 로컬보다 적어,
               그대로 견주면 '줄었다'를 못 읽는다. 항상 이 기기가 기억한 숫자(m.n)로만 견준다. */
            if(row&&row.v!==pushVal(loc)&&importApproved(k,loc)){
              var approvedMine=importApprovedRebase(k,loc,row.v),mineRaw=approvedMine&&approvedMine.raw;
              if(mineRaw==null){syncDiagnostic('import-rebase-pending',new Error('내 IDP 병합 대기'));return;}
              if(mineRaw!==loc){if(!kvWrite(k,mineRaw,writes,loc)){importApprovalClear(k);return;}applied++;loc=mineRaw;lh=hash(loc);}
              pushRows.push({workspace_id:wid,k:k,v:pushVal(loc),cupd:now,_casCupd:row.cupd});m.h[k]=lh;m.c[k]=now;nSet(m,k,loc);return;
            }
            if(loc==null&&!row)return;
            if(loc==null&&row){ if(kvWrite(k,row.v,writes)){ applied++; m.h[k]=hash(row.v); m.c[k]=row.cupd; nSet(m,k,row.v); } return; }
            if(loc!=null&&!row){ var mineNew={workspace_id:wid,k:k,v:pushVal(loc),cupd:now};if(importApproved(k,loc))mineNew._casMissing=true;pushRows.push(mineNew); m.h[k]=lh; m.c[k]=now; nSet(m,k,loc); return; }
            if(dirty&&!srvChanged){ if(pushHold(k,loc,null,m.n[k]))return;
              pushRows.push({workspace_id:wid,k:k,v:pushVal(loc),cupd:now}); m.h[k]=lh; m.c[k]=now; nSet(m,k,loc); return; }
            if(!dirty&&srvChanged){ var mv=keepMyImg(row.v,loc); if(kvWrite(k,mv,writes)){ applied++; m.h[k]=hash(mv); m.c[k]=row.cupd; nSet(m,k,mv); } return; }
            if(dirty&&srvChanged){ try{ (COPIES_OFF||localStorage.setItem('ps_sync_conflict_'+k,row.v)); }catch(_){}
            conflictNote(k);
              if(pushHold(k,loc,null,m.n[k]))return;
              pushRows.push({workspace_id:wid,k:k,v:pushVal(loc),cupd:now}); m.h[k]=lh; m.c[k]=now; nSet(m,k,loc); }
          } else {
            /* 남의 IDP — 이 기기에서 편집할 UI가 없으므로 서버가 항상 진실 */
            if(row&&(loc==null||row.cupd!==(m.c[k]||0))){ if(kvWrite(k,row.v,writes)){ applied++; m.h[k]=hash(row.v); m.c[k]=row.cupd; } }
          }
        });
      })();
      /* ── 코치 공개 피드백(cs_idp_pub_v1_<uid>)
         코칭스태프는 선수별 키를 작성·열람하고, 선수는 자기 키만 pull한다.
         선수 답변은 본인 소유 IDP 문서(feedbackReply)에 기록하므로 이 키는 선수에게 읽기 전용이다. */
      (function(){
        var PUBP='cs_idp_pub_v1_';
        var myPub=(s&&s.uid)?(PUBP+s.uid):null;
        var teamW=isTeamWs(),role='admin';
        try{
          if(teamW&&s&&s.uid){
            var _w2=activeWsObj(),_p2=null;try{_p2=JSON.parse(localStorage.getItem('cs_perms_v1')||'null');}catch(_){}
            if(_w2&&_w2.role==='owner')role='admin';
            else if(_p2){var _me2=_p2.members&&_p2.members[s.uid];role=(_me2&&_me2.role)||_p2.defaultRole||'player';}
          }
        }catch(_){role='admin';}
        var set2={};if(myPub)set2[myPub]=1;
        Object.keys(srv).forEach(function(k){if(k.indexOf(PUBP)===0)set2[k]=1;});
        try{for(var pi=0;pi<localStorage.length;pi++){var pk=localStorage.key(pi);if(pk&&pk.indexOf(PUBP)===0)set2[pk]=1;}}catch(_){}
        Object.keys(set2).forEach(function(k){
          if(k===PUBP+'local')return;
          var mine=(k===myPub),row=srv[k],loc=null;try{loc=localStorage.getItem(k);}catch(_){}
          if(role==='player'&&!mine){
            try{localStorage.removeItem(k);}catch(_){}delete m.h[k];delete m.c[k];return;
          }
          if(role==='player'){
            if(row&&(loc==null||row.cupd!==(m.c[k]||0))){
              if(kvWrite(k,row.v,writes)){applied++;m.h[k]=hash(row.v);m.c[k]=row.cupd;}
            }
            return;
          }
          var lh=hash(loc),dirty=(lh!==(m.h[k]||'')),srvChanged=row?(row.cupd!==(m.c[k]||0)):false;
          if(loc!=null&&loc.length>MAXLEN){skippedBig++;skippedKeys.push(k);return;}
          if(row&&row.v!==loc&&importApproved(k,loc)){
            var approvedPub=importApprovedRebase(k,loc,row.v),pubRaw=approvedPub&&approvedPub.raw;
            if(pubRaw==null){syncDiagnostic('import-rebase-pending',new Error('경기 메시지 병합 대기'));return;}
            if(pubRaw!==loc){if(!kvWrite(k,pubRaw,writes,loc)){importApprovalClear(k);return;}applied++;loc=pubRaw;lh=hash(loc);}
            pushRows.push({workspace_id:wid,k:k,v:loc,cupd:now,_casCupd:row.cupd});m.h[k]=lh;m.c[k]=now;return;
          }
          if(loc==null&&!row)return;
          if(loc==null&&row){if(kvWrite(k,row.v,writes)){applied++;m.h[k]=hash(row.v);m.c[k]=row.cupd;}return;}
          if(loc!=null&&!row){var pubNew={workspace_id:wid,k:k,v:loc,cupd:now};if(importApproved(k,loc))pubNew._casMissing=true;pushRows.push(pubNew);m.h[k]=lh;m.c[k]=now;return;}
          if(dirty&&!srvChanged){pushRows.push({workspace_id:wid,k:k,v:loc,cupd:now});m.h[k]=lh;m.c[k]=now;return;}
          if(!dirty&&srvChanged){if(kvWrite(k,row.v,writes)){applied++;m.h[k]=hash(row.v);m.c[k]=row.cupd;}return;}
          if(dirty&&srvChanged){
            try{(COPIES_OFF||localStorage.setItem('ps_sync_conflict_'+k,row.v));}catch(_){}
            conflictNote(k);
            pushRows.push({workspace_id:wid,k:k,v:loc,cupd:now});m.h[k]=lh;m.c[k]=now;
          }
        });
      })();
      /* ── 1.631 · 선수 항목(sq:<선수id>) — 한 명이 한 행 ────────────────────────
         통짜와 정확히 같은 LWW 규칙을 **키 하나당** 적용한다. 그래서 A 코치가 3번 선수를,
         B 코치가 7번 선수를 고치면 둘 다 산다(통짜였으면 나중 사람이 이겼다).
         읽는 쪽은 아직 통짜다 — 이 블록은 자료를 나르기만 하고 화면을 바꾸지 않는다.

         ⚠ 여기서는 pushHold(급감 보호)를 부르지 않는다. 항목 하나의 개수는 늘 1이라
            bigDrop 이 영원히 안 걸린다. 항목 세계의 보호는 **쓰기 지점**(PSItems.write)의
            '사라진 항목 수' 검사다 — 1.568 에서 배운 것과 같다(감지는 쓰기 지점에 붙인다). */
      (function(){
        if(!ITEMS_ACTIVE)return;
        var set={};
        Object.keys(idbVals||{}).forEach(function(k){ if(isItemKey(k)&&idbVals[k]!=null)set[k]=1; });
        Object.keys(srv).forEach(function(k){ if(isItemKey(k))set[k]=1; });
        var keys=Object.keys(set);
        if(!keys.length) return;
        var pushable=itemsPushAllowed();   /* 서버 규칙이 아직이면 받기만 한다(올리지 않는다) */
        keys.forEach(function(k){
          var loc=(idbVals[k]===undefined?null:idbVals[k]);
          var row=srv[k], lh=hash(loc);
          var dirty=(lh!==(m.h[k]||'')), srvChanged=row?(row.cupd!==(m.c[k]||0)):false;
          if(loc!=null&&loc.length>MAXLEN){ skippedBig++; skippedKeys.push(k); return; }
          if(loc==null&&!row) return;
          if(loc==null&&row){ if(kvWrite(k,row.v,writes)){ applied++; m.h[k]=hash(row.v); m.c[k]=row.cupd; } return; }
          if(!pushable){ /* 올릴 수는 없어도 받는 것은 막지 않는다 */
            if(!dirty&&srvChanged&&row){ if(kvWrite(k,row.v,writes)){ applied++; m.h[k]=hash(row.v); m.c[k]=row.cupd; } }
            return; }
          if(loc!=null&&!row){ pushRows.push({workspace_id:wid,k:k,v:loc,cupd:now}); m.h[k]=lh; m.c[k]=now; return; }
          if(dirty&&!srvChanged){ pushRows.push({workspace_id:wid,k:k,v:loc,cupd:now}); m.h[k]=lh; m.c[k]=now; return; }
          if(!dirty&&srvChanged){ if(kvWrite(k,row.v,writes)){ applied++; m.h[k]=hash(row.v); m.c[k]=row.cupd; } return; }
          if(dirty&&srvChanged){
            /* 같은 선수를 두 기기에서 고쳤다 — 손에 든 기기가 이긴다(통짜와 같은 규칙).
               서버본은 남겨 두되 알림은 띄우지 않는다: 선수 44명이 한꺼번에 걸리면
               알림이 44개가 된다(1.526 에서 스무 개로 이미 겪었다). 조용히 사본만 남긴다. */
            if(row.v===loc){ m.h[k]=lh; m.c[k]=row.cupd; return; }
            try{ (COPIES_OFF||localStorage.setItem('ps_sync_conflict_'+k,row.v)); }catch(_){}
            pushRows.push({workspace_id:wid,k:k,v:loc,cupd:now}); m.h[k]=lh; m.c[k]=now;
          }
        });
      })();
      /* ── 보안 v2 (서버 RLS와 동일 규칙, 2026-07-19) ──
         ① push 사전 필터: 내 권한 밖 키는 서버가 거부(403)하고, 한 행 거부가 배치 전체를 실패시키므로 미리 걸러낸다.
            걸러진 로컬 수정본은 다음 pull에서 서버본으로 되돌아온다(서버가 진실).
         ② 선수 역할: 민감 키(스카우트 평가·명단·게임플랜 상황·경기 기록)는 서버가 안 주므로 남은 로컬 사본도 정리. */
      (function(){
        if(!isTeamWs()||!s||!s.uid) return;
        /* 1.619 — 기본값을 '닫힘'으로 바꿨다. 예전엔 role 이 'admin' 으로 시작해서,
           권한 문서(cs_perms_v1)를 못 읽으면 **그 사람이 모든 팀 자료를 올릴 수 있었다.**
           못 읽는 상황은 드물지 않다: 새 기기 첫 부팅, 저장 공간 부족, 그리고 1.589~1.617 처럼
           권한 문서가 아예 전달되지 않던 기간. 잠금장치의 열쇠를 문 바깥에 둔 셈이었다.
           이제 문서를 못 읽으면 'player' 로 남아 아무것도 못 올린다.
           올리지 못한 자료는 m.h 를 갱신하지 않으므로 로컬에 그대로 남고, 권한 문서가
           도착한 다음 회차에 올라간다(잃지 않는다). 못 올린 키는 ps_sync_denied 로 알린다. */
        var role='player', scopes=null, permsMissing=false;
        try{
          var w=activeWsObj();
          if(w&&w.role==='owner'){ role='admin'; }
          else{
            var p=JSON.parse(permsRaw()||'null');
            if(p){ var me=p.members&&p.members[s.uid];
              role=(me&&me.role)||p.defaultRole||'player';
              if(me&&Object.prototype.toString.call(me.scopes)==='[object Array]')scopes=me.scopes.slice(); }
            else permsMissing=true;
          }
        }catch(_){ role='player'; permsMissing=true; }
        /* 권한 문서가 없어서 닫힌 것과, 진짜 선수라 닫힌 것은 완전히 다른 상황이다.
           구분해 두지 않으면 "왜 안 올라가지"를 또 못 찾는다(오늘 하루를 그렇게 썼다). */
        try{ if(permsMissing){ localStorage.setItem('ps_perms_missing','1'); syncDiagnostic('perms-missing',new Error('권한 문서를 못 읽어 쓰기를 닫았다')); }
             else localStorage.removeItem('ps_perms_missing'); }catch(_){}
        function keyScope(k){
          /* 1.631 — 선수 항목은 통짜 명단과 같은 구역이다. 여기 빠지면 else 로 떨어져 'board' 가 되는데,
             서버(supabase-item-keys.sql)는 'team' 으로 판정한다. **앱이 더 느슨하면 잠금이 아니고,
             앱이 더 엄격하면 "저장했는데 안 올라감"이 된다** — 두 표는 반드시 같아야 한다. */
          if(isItemKey(k))return 'team';
          /* 현재 팀 구성과 스카우트 대상은 scout_tool_v1 한 문서에 함께 있다.
             코칭스태프에게 팀 구성을 계속 제공하기 위해 동기화 범위는 team으로 유지하고,
             스카우트 화면은 역할 UI 게이트에서 차단한다. */
          if(k==='cs_player_del_v1')return 'team';   /* 2.612 — 선수 삭제 묘비(서버 ps_key_scope 도 team) */
          if(k==='cs_team_v1'||k==='cs_squad_v1'||k==='scout_tool_v1'||k==='cs_match_v1'||k==='cs_match_roster_v1'||k==='cs_team_matches_v1'||k==='cs_team_attrs_v1'||k==='cs_idp_daily_v1'||k==='cs_team_notice_v1')return 'team';
          /* 2.537 — 공지는 'team'(팀 운영 편집권). 안 적으면 else 로 떨어져 'board'(보관함 편집권)가 된다 —
             드릴 공유하라고 보관함 권한을 준 선수가 팀 공지까지 고칠 수 있게 된다. */
          if(k==='training_sessions_v1'||k==='cs_psched_v1'||k==='cs_pmeet_v1'||k==='cs_pwarm_v1'||k==='cs_ptrain_v1')return 'schedule';
          if(k==='cs_gamemodel_v1')return 'gamemodel';
          if(k==='cs_terms_v1')return 'terms';
          if(k===TOMBKEY)return null;
          if(k==='cs_perms_v1')return 'perms';
          /* 2.604 — 서버 ps_key_scope 와 같게: 후보 명단은 'scout'(1.540), 옛 공개 IDP 키는 'team'. 여기 빠져 else 'board' 가 되면
             board 권한만 있는 구성원의 클라이언트가 통과시키고 서버 RLS 가 403 — 회차마다 반복(실측 14일 sync_permission kv_push 1,962건·39명,
             최다 971건 사용자의 scopes = board·schedule·team·gamemodel·terms, scout 없음). */
          if(k==='cs_scout_targets_v1')return 'scout';
          if(k==='cs_idp_pub_v1')return 'team';
          return 'board';
        }
        function canW(k){
          if(k.indexOf('cs_idp_v1_')===0)return true;   /* IDP는 자체 규칙(위 블록에서 이미 내 것만) */
          if(k==='process_coach_v1'){                    /* 1.500 — 일정은 운영진만 푸시(서버 가드와 동일 규칙).
                                                            화면 잠금(1.482)은 동기화 푸시를 못 막아 2026-08-03 밀림 사고의 통로가 됐다 */
            if(role==='admin'||role==='executive')return true;
            try{ var sp=JSON.parse(localStorage.getItem('cs_perms_v1')||'null'); if(sp&&sp.schedEdit==='staff')return role==='staff'; }catch(_){}
            return false;
          }
          if(role==='admin'||role==='executive')return true;
          if(k==='cs_perms_v1')return false;
          /* 1.621 — 담당 배정도 운영진만. 담당자가 스스로를 다른 경기에 배정할 수 있으면
             '자료마다 주인 한 명'이 무너진다 — 그래서 경기 문서와 갈라 놓은 것이다. */
          if(k==='cs_assign_v1')return false;
          var sc=keyScope(k); if(!sc)return true;
          if(scopes)return scopes.indexOf(sc)>=0;   /* 개별 지정이 먼저 — 잠금보다 앞선다 */
          /* 1.634 — 코칭스태프 기본은 **보기 전용**이다(사용자 확정: 임원이 전부 입력하고
             나머지는 본다). staffEdit='edit' 일 때만 예전처럼 편집한다.
             perms.js myScopes() · SQL ps_can_write_key 와 **같은 규칙이어야 한다** —
             앱이 느슨하면 잠금이 아니고, 엄격하면 "저장했는데 안 올라감"이 된다. */
          if(role==='staff'){
            try{ var sp2=JSON.parse(permsRaw()||'null'); return !!(sp2&&sp2.staffEdit==='edit'); }catch(_){ return false; }
          }
          return false;
        }
        var deniedKeys=[];
        var scheduleQueuedBefore=pushRows.some(function(r){return r.k===SCHEDULE_KEY;});
        var pushCandidates=pushRows.map(function(r){return r.k;});   /* 2.434 — 거르기 전 후보(아래 맵 갱신용) */
        /* 2.604 — 서버가 403 으로 거부한 키(ps_sync_403_v1, 6시간)는 그 사이 다시 밀지 않는다 — 표가 어긋나 있어도 회차마다 403 을 반복하지 않게 */
        var _s403={}; try{ _s403=JSON.parse(localStorage.getItem('ps_sync_403_v1')||'{}')||{}; }catch(_){ _s403={}; }
        pushRows=pushRows.filter(function(r){ if(_s403[r.k]&&Date.now()-(+_s403[r.k]||0)<6*3600000){ deniedKeys.push(r.k); return false; } if(canW(r.k))return true; deniedKeys.push(r.k); return false; });
        /* ══ 2.434 · 권한 거부 키의 **지속 기록**(ps_sync_denied_map_v1) ═══════════════
           기존 ps_sync_denied(배열)는 칩이 읽고 바로 지운다(3739) — 전환 차단 판정에는 못 쓴다.
           이 맵은 { 키: 마지막 거부 시각 } 으로 남고, 같은 키가 **허용으로 판정되는 회차에 지워진다.**
           ⚠ 권한 문서를 못 읽은 회차(permsMissing)에는 기록하지 않는다 — 그건 일시 상태다(3604). */
        try{ if(!permsMissing){
          var _dm={}; try{ _dm=JSON.parse(localStorage.getItem('ps_sync_denied_map_v1')||'{}')||{}; }catch(_){ _dm={}; }
          var _now=Date.now(), _ch=false;
          deniedKeys.forEach(function(k){ _dm[k]=_now; _ch=true; });
          pushCandidates.forEach(function(k){ if(deniedKeys.indexOf(k)<0&&_dm[k]){ delete _dm[k]; _ch=true; } });
          Object.keys(_dm).forEach(function(k){ if(_now-(+_dm[k]||0)>30*86400000){ delete _dm[k]; _ch=true; } });
          if(_ch)localStorage.setItem('ps_sync_denied_map_v1',JSON.stringify(_dm));
        } }catch(_){}
        if(scheduleQueuedBefore&&!pushRows.some(function(r){return r.k===SCHEDULE_KEY;}))restoreScheduleMeta();
        /* 1.514 — 권한이 없어 못 올린 키를 기록한다. 조용히 버리면 그 사람은
           "넣었는데 새로고침하면 사라진다"만 겪는다(김포 AT코치 제보의 실제 경로). */
        try{ if(deniedKeys.length)localStorage.setItem('ps_sync_denied',JSON.stringify(deniedKeys.slice(0,6)));
             else localStorage.removeItem('ps_sync_denied'); }catch(_){}
        if(role==='player'){
          PLAYER_BLIND.forEach(function(k){
            if(canW(k))return;                          /* 그 구역 편집권을 받은 선수는 유지 */
            try{ localStorage.removeItem(k); }catch(_){}
            try{ if(window.storage&&window.storage.del)window.storage.del(k); }catch(_){}
            delete m.h[k]; delete m.c[k];
          });
          /* 1.631 — 항목도 같이 정리한다. 서버는 안 주지만(supabase-item-keys.sql),
             이사 전에 받아 뒀거나 역할이 나중에 내려간 기기에는 사본이 남는다. */
          if(!canW('sq:'))(function(){
            try{ idbItemKeys().then(function(ks){ ks.forEach(function(k){
              try{ window.storage.del(k); }catch(_){}
              delete m.h[k]; delete m.c[k];
            }); }); }catch(_){}
          })();
        }
      })();
      function restoreScheduleMeta(){
        if(!scheduleMetaBefore||scheduleMetaRestored)return;scheduleMetaRestored=true;
        if(scheduleMetaBefore.h===undefined)delete m.h[SCHEDULE_KEY];else m.h[SCHEDULE_KEY]=scheduleMetaBefore.h;
        if(scheduleMetaBefore.c===undefined)delete m.c[SCHEDULE_KEY];else m.c[SCHEDULE_KEY]=scheduleMetaBefore.c;
        m.n=m.n||{};if(scheduleMetaBefore.n===undefined)delete m.n[SCHEDULE_KEY];else m.n[SCHEDULE_KEY]=scheduleMetaBefore.n;
        syncBaseSet(SCHEDULE_KEY,scheduleMetaBefore.base);
        applied=Math.max(0,applied-scheduleAppliedPlanned);scheduleDeferred=true;
      }
      function schedulePushCurrent(){
        if(schedulePushExpected==null)return true;
        var cur=null;try{cur=localStorage.getItem(SCHEDULE_KEY);}catch(_){}
        return !scheduleGuard.stale&&!scheduleHeld()&&cur===schedulePushExpected;
      }
      /* 로컬 IDB 쓰기와 CAS 검사를 서버 push보다 먼저 끝낸다. 사용자가 회차 중
         다시 저장했다면 일정 행만 이 회차에서 빼고 다음 회차에 최신본을 읽는다. */
      return Promise.all(writes).then(function(){return syncBaseReady();}).then(function(){
        if(scheduleGuard.stale)restoreScheduleMeta();
        if(!schedulePushCurrent()){
          var hadMatch=pushRows.some(function(r){return r.k==='cs_team_matches_v1';});
          pushRows=pushRows.filter(function(r){return r.k!==SCHEDULE_KEY&&r.k!=='cs_team_matches_v1';});
          if(hadMatch)deferScheduleMatch();
          if(!scheduleGuard.stale)restoreScheduleMeta();
        }
        return outboxMarkRows(wid,pushRows,m).then(function(){
          if(!schedulePushCurrent()){
            var hadMatch=pushRows.some(function(r){return r.k==='cs_team_matches_v1';});
            pushRows=pushRows.filter(function(r){return r.k!==SCHEDULE_KEY&&r.k!=='cs_team_matches_v1';});
            if(hadMatch)deferScheduleMatch();
            restoreScheduleMeta();
          }
          return kvPushRows(at,pushRows,function(ch){ pushLog(wid,ch); });
        });
      }).then(function(){ return syncLibrary(at,m,now,wid); }).then(function(lr){
        applied+=(lr&&lr.applied)||0;
        m.last=Date.now(); setMeta(m); lastIssue=null;   /* 2.625 */
        try{ rtConnect(); }catch(_){}   /* 2.628 — 회차가 성공하면 실시간 채널도 맞춰 둔다(워크스페이스가 바뀌었으면 다시 붙는다) */
        /* 개인 자료(매치데스크·노트)는 팀 공간에서 일하는 중에도 내 개인 공간에 백업한다 —
           setMeta 뒤에 두어, 개인 채널이 쓴 m.p 상태를 본 동기화 메타가 덮지 않게 한다 */
        var doPersonal=syncPersonal(at).then(function(n){ applied+=n||0; });
        try{ pruneConflictCopies(); }catch(_){}
        try{ staffEditNotice(); }catch(_){}
        syncErr=false;
        /* 용량 초과로 빠진 항목: 조용히 넘어가면 "저장됐다"고 오해한다 → 목록을 남기고 경고 칩으로 알린다 */
        var prev=skippedList().join(','), curKeys=skippedKeys.slice();
        try{ if(curKeys.length)localStorage.setItem(SKIPKEY,JSON.stringify(curKeys)); else localStorage.removeItem(SKIPKEY); }catch(_){}
        /* 편집·CAS 때문에 이번 회차에서 일정만 미룬 경우, 다른 키가 성공했다고
           일정 outbox까지 지우면 설정에는 '최신'이라 뜨면서 실제 일정은 대기한다. */
        /* 급감 hold와 그 의존성 보류는 아직 서버 확인을 받은 것이 아니다.
           예전 meta hash가 우연히 현재 raw와 같아도 outbox를 지우지 않는다. */
        var ackSkipped=curKeys.concat(heldKeys,dependencyDeferredKeys);
        if(scheduleDeferred||scheduleHeld())ackSkipped.push(SCHEDULE_KEY);
        return doPersonal.then(function(){ return outboxAckSynced(wid,m,ackSkipped,lr&&lr.ackHash); }).then(function(){
        busy=false; try{ clearTimeout(busyDog); }catch(_){}
        clearSyncRetry();
        var remain=pendingInfo(wid);
        var msg=remain.count?('올리는 중 · '+remain.count):'팀과 같아요 · '+new Date(m.last).toLocaleTimeString();   /* 2.625 말 바꾸기 */
        if(skippedBig)msg+=' (용량 초과 '+skippedBig+'개 제외)';
        setStatus(msg);
        try{ cacheWaitEnd(true); }catch(_){}   /* 2.675 — 지운 뒤 첫 회차가 끝났다 */
        if(curKeys.length && curKeys.join(',')!==prev){
          chip('⚠ '+curKeys.map(keyLabel).join('·')+' — 용량이 커서 동기화되지 않았어요 (이 기기에만 있음)');
        }
        /* 권한이 없어 **앱이** 못 올린 것 — 사라지기 전에 알린다 */
        try{
          var dk=JSON.parse(localStorage.getItem('ps_sync_denied')||'[]');
          if(dk&&dk.length){
            var why=(function(){ try{ return localStorage.getItem('ps_perms_missing')==='1'
              ? ' · 권한 정보를 아직 못 받았어요, 잠시 뒤 다시 시도됩니다'
              : ' · 운영진에게 요청하세요'; }catch(_){ return ' · 운영진에게 요청하세요'; } })();
            chip('⚠ '+dk.map(keyLabel).join('·')+' — 편집 권한이 없어 저장되지 않았어요'+why);
            localStorage.removeItem('ps_sync_denied');
          }
        }catch(_){}
        /* 실제 서버 거부는 kvPushRows의 return=representation 원문 대조가 즉시
           fail-closed로 처리한다. 성공 뒤 ps_kv_denied를 다시 읽으면 다른 회차의
           옛 거부 행을 이번 저장 실패로 오인해 헛경고를 띄울 수 있어 조회하지 않는다. */
        /* 1.545 — 충돌 경고 칩 제거(사용자 지시).
           여러 기기를 오가며 쓰면 이 경고가 계속 쌓여서, 지워도 다음 동기화에 또 떴다.
           작업 중 화면을 덮는 데다 매번 같은 말이라 결국 읽히지 않는 알림이 됐다.
           **밀려난 변경 자체는 그대로 보관한다** — 계정 팝업의 조용한 줄에서 언제든 되돌릴 수 있다.
           (지우는 게 아니라 알리는 방식만 바꾼 것) */
        try{ renderUI(); }catch(_){}
        if(applied>0) onApplied(reason,applied);
        /* 1.611 — 마지막으로 서버와 맞춘 시각. 설정의 '팀에서 받기' 줄이 이 값으로
           "3분 전에 받았습니다"를 말한다. 수동으로 누른 때만이 아니라 자동 회차도 남겨야
           숫자가 진실이 된다(자동으로 이미 받아 놓고 "아직 받은 적 없음"이라 하면 거짓말이다). */
        try{ localStorage.setItem('ps_last_pull_at', String(Date.now())); }catch(_){}
        try{ if(window.parent&&window.parent.__psRefreshPullState) window.parent.__psRefreshPullState(); }catch(_){}
        if(scheduleDeferred&&!scheduleHeld())setTimeout(function(){syncNow('schedule-stale-retry');},1100);
        else if(scheduleDependencyRetry&&!scheduleHeld())setTimeout(function(){syncNow('schedule-dependency-retry');},350);
        var result={pushed:pushRows.length+((lr&&lr.pushed)||0),applied:applied,skipped:curKeys,
          held:heldKeys.slice(),deferred:dependencyDeferredKeys.slice(),pending:remain.count,scheduleDeferred:scheduleDeferred};
        /* 선수 파일을 오프라인에서 가져왔어도 예전 sq:*는 block 때문에 이 회차에 올라가지 않는다.
           통짜 선수단 회차가 성공한 바로 여기에서만 exact 항목을 만들고, 두 번째 회차로 전송한다.
           exact/목록 검사가 실패하면 block을 남겨 부분 항목이 다음 자동 동기화에 섞이지 않게 한다. */
        return result;
        });
      }).catch(function(e){restoreScheduleMeta();throw e;});
    });
  }).catch(function(e){
    busy=false; try{ clearTimeout(busyDog); }catch(_){}
    /* 1.647 — 경기 연결 가드는 잘못된 날짜·상대·시간을 예외 대신 기존 서버본으로
       지킨다. kvPushRows가 그 2xx 거부를 발견하면 예전에는 여기서 일반 실패로 끝나,
       같은 로컬본을 매번 다시 보내고 워크스페이스 전환도 영구히 막혔다.

       실패 회차의 m은 일부 행을 "올림"으로 미리 바꾼 임시 상태라 저장하면 안 된다.
       fresh meta의 경기 cupd만 0으로 만들어 다음 새 회차가 서버 raw를 반드시 받고,
       위의 경기 전용 server-wins + rescue 경로로 안전하게 맞추게 한다. 다른 키가
       함께 거부됐거나 서버 행이 없는 경우에는 이 예외를 삼키지 않는다. */
    var rejectedRetry=rejectedMatchRetry(e,wid);
    if(rejectedRetry){
      syncErr=false;
      setStatus('팀 것이 더 새로워요 · 다시 맞추는 중');   /* 2.715 — 경기 전용 문구였다 */
      try{renderUI();}catch(_){}
      return rejectedRetry;
    }
    var info=classifySyncError(e),pi=pendingInfo(wid);
    syncErr=info.code!=='sync_offline';
    lastIssue={code:info.code,stage:info.stage,at:Date.now()};   /* 2.625 */
    setStatus((info.code==='sync_offline'?'오프라인이에요':'못 올렸어요 · '+syncReasonText(info.code))
      +(pi.count?(' · 이 기기에 '+pi.count+'건 안전하게 있어요'):'')+(info.code==='sync_offline'?'':' · 곧 다시 시도해요'));   /* 2.625 말 바꾸기 */
    /* 2.631 — 원인 문장을 남긴다(내용·토큰 없음, 120자). 실측: sync_unexpected 11건·sync_storage 8건이 meta {stage,code} 뿐이라 서버에서 무엇인지 알 수 없었다 */
    try{eventTrack('sync_failed',{status:'error',feature:'sync',error_code:info.code,meta:{stage:info.stage,code:info.code,name:String(e&&e.name||'').slice(0,40),msg:String(e&&e.message||e||'').replace(/eyJ[A-Za-z0-9._-]{20,}/g,'<tok>').slice(0,120)}});}catch(_){}
    try{ renderUI(); }catch(_){}
    try{console.warn('[PSSync]',info,e);}catch(_){}
    return outboxFail(wid,info).then(function(){if(info.code!=='sync_offline')scheduleSyncRetry();return {error:String(e),code:info.code,pending:pi.count,rejectedKeys:(e&&Array.isArray(e.psRejectedKeys))?e.psRejectedKeys.slice(0,20):null};});   /* 2.586 — 거부된 키를 전환 출구가 쓴다 */
  });
}
/* 서버 변경을 로컬에 반영한 뒤: 부팅 직후면 1회 새로고침으로 각 탭에 반영, 사용 중이면 안내 칩 */
function onApplied(reason,n){
  if(reason==='boot'){
    /* 1.981 — 부팅 새로고침은 스플래시가 아직 떠 있을 때만(사용자 "새로고침하니까 이상하게 계속 뜨다가 돼" = 화면이 뜬 뒤 통째로 다시 로드돼 두 번 뜨던 것).
       화면이 이미 보인 뒤라면 새로고침하지 않는다 — 1.513 메모대로 각 화면은 storage 이벤트로 갱신된다 */
    var _stillSplash=false; try{ _stillSplash=!!(document.body&&document.body.classList.contains('ps-booting')); }catch(_){}
    try{
      if(_stillSplash&&!sessionStorage.getItem(RLKEY)){ sessionStorage.setItem(RLKEY,'1'); markSelfReload(); location.reload(); return; }
    }catch(_){}
  }
  try{ sessionStorage.removeItem(RLKEY); }catch(_){}
  /* 1.513 — '다른 기기의 변경 N건 반영됨' 칩 제거(사용자 지시).
     정상 동작을 매번 알리는 알림이라 작업 중 시야만 가렸다. 화면은 이미 storage 이벤트로 갱신되고,
     밀려서 잃은 변경이 있을 때만 뜨는 경고 칩(위 conflict 칩)은 그대로 남는다. */
}
function chip(msg,onClick){
  try{
    var c=document.getElementById('psSyncChip');
    if(!c){ c=document.createElement('button'); c.id='psSyncChip';
      /* 데이터 충돌·유실 경고다 — 검정 과묵 톤 대신 호박색 경고 톤, 하단 CTA와 안 겹치게 위로 */
      c.style.cssText='position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:99999;max-width:min(92vw,560px);border:1px solid #E2C66B;border-radius:12px;padding:11px 16px;background:#FFF8E6;color:#7A5B12;font:700 13px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.22);cursor:pointer;text-align:left;';
      document.body.appendChild(c); }
    c.textContent=msg; c.style.display='block';
    c.onclick=function(){ c.style.display='none'; if(onClick)onClick(); };
    clearTimeout(c.__t); c.__t=setTimeout(function(){ c.style.display='none'; },12000);
  }catch(_){}
}

/* ── 워크스페이스 전환/생성/초대/합류 ── */
var switching=false, switchingAt=0;   /* 2.258 — 언제부터 전환 중인지 */
var switchGen=0;   /* 2.338 — 전환 세대. 새 시도·타임아웃이 올리면 옛 체인은 다음 문턱(staleStop)에서 스스로 멈춘다 */
/* 2.340 — **비우는 중**(프레임 내리기~리로드). 이 창에 늦게 도착한 iframe 저장 신호를 부모 미러가 받아 쓰면
   방금 비운 **이전 팀 값이 되살아나** 새 팀 서버로 올라간다(2.244 가 프레임 내리기+350ms 로 줄였지만 남아 있던 경로).
   350ms 기다리기는 휴리스틱이라 순서를 보장하지 못한다 — 플래그로 **명시적으로** 막는다. */
var switchWiping=false;
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
/* 하드 백스톱 — 어떤 이유로든 p가 ms 안에 끝나지 않으면 {__timeout:1}로 해소(오버레이 영구 정지 방지) */
function withTimeout(p,ms){
  return new Promise(function(resolve){
    var done=false, to=setTimeout(function(){ if(!done){ done=true; resolve({__timeout:1}); } },ms);
    p.then(function(v){ if(!done){ done=true; clearTimeout(to); resolve(v); } },
           function(){ if(!done){ done=true; clearTimeout(to); resolve({__timeout:1,err:1}); } });
  });
}
/* busy면 스킵되므로 실제 동기화가 될 때까지 재시도(상한 있음 — 무한 루프 방지) */
function forceSync(reason,tries){
  tries=tries||0;
  return syncNow(reason).then(function(r){
    if(r&&r.skip){ if(tries>=30) return {skip:1}; return sleep(250).then(function(){ return forceSync(reason,tries+1); }); }
    /* 경기 서버 거부는 fresh meta로 새 회차를 열어야만 서버 raw를 받는다.
       두 번까지만 재시도하고, 서버 행이 없거나 계속 거부되면 error로 닫아
       로컬·outbox를 보존한 채 전환을 중단한다. */
    if(r&&r.serverRejected){
      if(tries>=2)return {error:'server rejected',code:'sync_server_rejected',serverRejected:r.serverRejected,pending:r.pending||0};
      return sleep(180).then(function(){return forceSync(reason,tries+1);});
    }
    return r;
  });
}
/* 1.642 — 팀 전환은 현재 팀의 콘텐츠를 로컬·IDB에서 지운 다음 새 팀을 받는 작업이다.
   일정 편집이 열려 있거나 shared write가 끝나지 않았다면 preswitch sync가
   `scheduleDeferred`로 정상 종료해도 저장 성공이 아니다. 스냅샷을 읽기 전과
   지우기 직전 두 번 확인해, 현재 팀 일정이 완전히 저장된 때만 전환한다. */
function workspaceSwitchWriteBarrier(){
  if(scheduleHeld())return Promise.resolve({held:1});
  var p=(window.PSStorage&&PSStorage.sharedReady)?PSStorage.sharedReady():Promise.resolve(true);
  return withTimeout(Promise.resolve(p).then(function(){
    return typeof syncBaseReady==='function'?syncBaseReady():Promise.resolve(true);
  }).then(function(){return {ready:1};},function(e){
    syncDiagnostic('workspace-switch-shared-ready',e);return {error:1};
  }),8000).then(function(r){
    if(scheduleHeld())return {held:1};
    return r||{error:1};
  });
}
/* 지우기 전 현재 콘텐츠를 IDB에 백업(서버 저장 실패 대비 복구망).
   IDB에 사는 키까지 담아야 한다 — 안 그러면 보관함·선수단이 복구망에서 빠진다.
   v369: 스냅샷 자체도 IDB에 두어 localStorage 5MB 한도 때문에 팀 전환이 막히지 않게 한다. */
function stashSnapshot(wid){
  if(!wid)return Promise.resolve();
  var snap={};
  try{ CONTENT.forEach(function(k){ var v=localStorage.getItem(k); if(v!=null)snap[k]=v; }); }catch(_){}
  /* 1.631 — 비우기 전 백업에 항목도 담는다. 비우는 목록과 담는 목록이 어긋나면
     '지웠는데 백업엔 없는' 자료가 생긴다 — 그게 복구 불가의 정의다. */
  /* 2.244 — 담는 목록 = 비우는 목록(idbSwitchKeys) — 어긋나면 '지웠는데 백업엔 없는' 자료가 생긴다 */
  var idb = (window.storage)
    ? idbSwitchKeys().then(function(keys){
        return Promise.all(keys.map(function(k){
          return window.storage.get(k).then(function(r){ if(r&&r.value!=null)snap[k]=r.value; }).catch(function(e){syncDiagnostic('workspace-stash-read',e);throw e;});
        }));
      })
    : Promise.resolve();
  return idb.then(function(){
    var key='ps_ws_stash_'+wid, raw=JSON.stringify({at:Date.now(),data:snap});
    if(window.storage)return window.storage.set(key,raw);
    try{localStorage.setItem(key,raw);return Promise.resolve();}catch(e){return Promise.reject(e);}
  }).catch(function(e){syncDiagnostic('workspace-stash-write',e);throw e;});
}
/* 전환 중 전체화면 오버레이 — 로컬을 비운 뒤 데이터를 받는 과도기(보드·도크가 반쯤 빈 상태)를 가림 */
function showSwitchOverlay(name){
  try{
    var ov=document.getElementById('psSwitchOv');
    if(!ov){ ov=document.createElement('div'); ov.id='psSwitchOv';
      var dark=document.body.classList.contains('fmdark');
      ov.style.cssText='position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:'+(dark?'#0F141B':'#ffffff')+';color:'+(dark?'#E7EBF1':'#16181c')+';font-family:inherit;';
      ov.innerHTML='<div class="pss-spin" style="width:34px;height:34px;border-radius:50%;border:3px solid '+(dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)')+';border-top-color:'+(dark?'#E7EBF1':'#16181c')+';animation:pss-rot .8s linear infinite"></div><div id="psSwitchTxt" style="font-size:14px;font-weight:700"></div>';
      if(!document.getElementById('pss-spin-css')){ var st=document.createElement('style'); st.id='pss-spin-css'; st.textContent='@keyframes pss-rot{to{transform:rotate(360deg)}}'; (document.head||document.documentElement).appendChild(st); }
      document.body.appendChild(ov);
    }
    ov.style.display='flex';
    var t=ov.querySelector('#psSwitchTxt'); if(t)t.textContent=name?('‘'+name+'’(으)로 전환 중…'):'워크스페이스 전환 중…';
  }catch(_){}
}
function hideSwitchOverlay(){ try{ var ov=document.getElementById('psSwitchOv'); if(ov)ov.style.display='none'; }catch(_){} }
function switchWorkspace(wid, skipSave){
  /* 2.258 — 무음 리턴 금지(실제 제보 "아무것도 안 뜨고 이동도 안 돼"): 이전 시도가 어중간하게 끝나
     switching 이 박혀 있으면 이후 클릭이 전부 무반응이었다. 25초 지났으면 스스로 풀고, 아니면 말해 준다. */
  if(switching){
    /* 2.338 — 옛 25초 자가 해제는 overlayGuard(20초)가 늘 먼저 풀어 죽은 코드였고, 그 '먼저 풀기'가
       진행 중 체인과 새 체인의 동시 실행(2.244류 섞임)의 입구였다. 이제 60초 가드가 세대로 끝내므로
       여기는 가드가 아예 안 걸린 동기 예외의 안전망만 남긴다. */
    if(Date.now()-switchingAt>65000){ switching=false; }
    else { try{chip('이미 전환을 진행 중이에요 — 잠시 뒤 다시 눌러 주세요');}catch(_){} return Promise.resolve({cancelled:1,busy:1}); }
  }
  if(!wid) return Promise.resolve();
  if(wid===activeWs()){ try{chip('이미 그 워크스페이스가 활성이에요 — 화면이 다르게 보이면 새로고침해 주세요');}catch(_){} return Promise.resolve({cancelled:1,same:1}); }
  if(!dataUnlocked()){
    setStatus('로그인한 계정의 자료를 확인한 뒤 팀을 바꿀 수 있어요');
    try{chip('로그인한 계정의 자료를 확인한 뒤 팀을 바꿀 수 있어요');}catch(_){}   /* 2.338 — 유일하게 무음이던 가드 */
    return Promise.resolve({cancelled:1,locked:1});
  }
  if(window.PSTeamFiles&&PSTeamFiles.importing&&PSTeamFiles.importing()){
    setStatus('전환 취소 — 파일 가져오기가 끝난 뒤 다시 시도하세요');
    try{chip('팀 파일을 가져오는 중에는 팀을 바꿀 수 없어요');}catch(_){}
    return Promise.resolve({cancelled:1,importing:1});
  }
  /* 편집 세션을 열어 둔 채 전환하면 syncNow는 일정만 보류하고 나머지를
     성공으로 돌려준다. 그 결과를 성공으로 오해해 현재 팀 일정을 지우지 않게
     아예 전환을 시작하지 않는다. */
  if(scheduleHeld()){
    /* 2.338 — 두 경우를 가른다("이동이 원활하지 않다"의 큰 축):
       ① 일정 탭에 편집 창(훈련 세션 시트 등)이 열려 잠긴 것 — 코치가 닫아야 풀린다. 지금까지는 다른 탭에
          가 있어도(iframe 은 display 로만 숨는다) 이유 없이 '일정 편집…'만 떠서 막다른 길이었다 → 원인을 이름으로.
       ② 마지막 입력 뒤 5초 보호창(입력·저장마다 __schedTouch(5000)) — 날짜 칩 하나만 탭해도 5초간
          전환이 거부됐고 재시도는 수동이었다 → 거부하지 말고 풀릴 때까지 기다렸다 이어 간다. */
    if(scheduleEditActive){
      setStatus('전환 취소 — 일정 탭의 편집 창을 닫은 뒤 다시 시도하세요');
      try{chip('일정 탭에 편집 창이 열려 있어요 — 닫으면 바로 전환할 수 있어요');}catch(_){}
      return Promise.resolve({cancelled:1,scheduleHeld:1});
    }
    setStatus('일정 저장 마무리 대기 중…');
    try{chip('일정 저장을 마무리하고 전환합니다…');}catch(_){}
    return (function waitHold(t0){
      return sleep(300).then(function(){
        if(!scheduleHeld()) return switchWorkspace(wid, skipSave);   /* 처음부터 다시 — 가드 전부 재통과 */
        if(scheduleEditActive || Date.now()-t0>8000){
          setStatus('전환 취소 — 일정 편집을 끝내고 저장 완료 후 다시 시도하세요');
          try{chip('일정 편집이 계속되고 있어요 — 끝난 뒤 다시 눌러 주세요');}catch(_){}
          recSwitchFail('일정 편집·저장 대기 8초 초과','preswitch schedule held wait');
          return {cancelled:1,scheduleHeld:1};
        }
        return waitHold(t0);
      });
    })(Date.now());
  }
  /* 열린 전환 확인창이 있는 동안 다른 워크스페이스를 눌렀다면 마지막 선택만 유효하다. */
  var switchAttemptSeq=++WS_HOLD_REVIEW_SEQ;
  /* 2.338 — 이 체인의 세대. staleStop 은 와이프 전 각 문턱에서 부른다 — 와이프가 시작되면(wipeStarted)
     끝(리로드/롤백)까지 간다. 중간에 멈추면 반쯤 지운 상태가 남기 때문이다. */
  var myGen=++switchGen, wipeStarted=false;
  function staleStop(){
    if(myGen===switchGen) return;
    restorePreMeta();
    var e=new Error('superseded'); e.psStale=true; throw e;
  }
  switching=true; switchingAt=Date.now(); setStatus('워크스페이스 전환 중…');
  var from=activeWs();
  var target=wsList().filter(function(w){return w.id===wid;})[0];
  var preMetaRaw=null,preMetaCaptured=false,switchItemKeys=[];
  function restorePreMeta(){
    if(!preMetaCaptured)return;
    try{if(preMetaRaw==null)localStorage.removeItem(MKEY);else localStorage.setItem(MKEY,preMetaRaw);}catch(_){}
  }
  function stopPreswitch(msg,code){
    restorePreMeta();
    recSwitchFail(msg,code);
    /* ⚠ 2.255 의 toast(msg) 는 셸(app.html)에 toast 가 없어 ReferenceError 로 **늘 무음**이었다(2.338 감사 확정 —
       "아무것도 안 뜨고 이동도 안 돼"의 정체). chip 은 이 파일 것이라 확실히 뜬다. 늦은 체인이면 새 체인의 UI 를 건드리지 않는다. */
    if(myGen===switchGen){ switching=false;hideSwitchOverlay();setStatus(msg);try{chip(msg);}catch(_){} }
    var e=new Error(code||'preswitch failed');e.psPreswitch=true;throw e;
  }
  function stopPreswitchReview(keys){
    staleStop();   /* 2.338 — 늦은 체인이 새 체인 위에 확인 모달을 얹지 않는다 */
    restorePreMeta();
    switching=false;clearTimeout(overlayGuard);clearTimeout(overlaySlow);hideSwitchOverlay();
    var n=keys.length;
    setStatus('전환 전에 확인할 변경 '+n+'건이 있습니다');
    workspaceHoldReviewPrepare(keys,from,wid,switchAttemptSeq).then(function(intent){
      if(!intent){
        if(switchAttemptSeq===WS_HOLD_REVIEW_SEQ)setStatus('전환을 멈췄습니다 — 자료가 다시 바뀌어 다시 확인해 주세요');
        return;
      }
      holdOpen({resumeWid:wid,resumeFrom:from,reviewIntent:intent});
    }).catch(function(e){syncDiagnostic('workspace-hold-prepare',e);});
    var e=new Error('preswitch holds');e.psPreswitch=true;throw e;
  }
  /* ══ 2.445 · **서버에 닿지 못해 막힌 전환에는 출구가 있어야 한다** ═══════════════
     실제 제보(두 번째): 대기가 전부 `kv_meta:sync_network` 였다 — 회차의 첫 pull 이 죽어
     push 가 한 번도 못 돈 것이라 **고칠 항목이 없다.** 그런데 예전에는 여기서 그냥 막혀,
     네트워크가 돌아올 때까지(=서버가 죽었으면 영원히) 워크스페이스를 못 바꿨다.
     ⚠ 그냥 열어 주지 않는다. 무엇이 남고 어떻게 되돌리는지 말하고 **사용자가 고른다.**
     ⚠ 안전 근거: 전환 전 백업(stashSnapshot, 4055)은 이 검사보다 **먼저** 끝나 있고
        skipSave 경로도 그 백업을 건너뛰지 않는다. 막히는 키(평가 항목·선수단·경기 준비·리뷰)는
        백업에 담기고, 내 IDP 는 애초에 전환에서 **지우지 않는다**(아래 와이프의 예외).
     ⚠ skipSave 는 '팀 나가기'가 쓰는 기존 경로다 — 일정 편집 잠금(writeBarrier)은 그대로 걸린다. */
  function stopPreswitchUnreachable(labels,code){
    staleStop();
    restorePreMeta();
    switching=false;clearTimeout(overlayGuard);clearTimeout(overlaySlow);hideSwitchOverlay();
    var head='서버에 닿지 못해 '+labels.join('·')+' 를 아직 올리지 못했습니다';
    setStatus(head);
    var tgt=wid;
    try{
      psModal({title:'서버에 닿지 못했습니다',
        body:'<div style="margin-bottom:8px">'+esc(head)+'.</div>'
          +'<div style="margin-bottom:8px"><b>항목이 잘못된 것이 아닙니다</b> — 연결이 끊겨 올리기가 시작조차 못 했습니다'+(code?(' ('+esc(code)+')'):'')+'.</div>'
          +'<div style="margin-bottom:8px">먼저 인터넷 연결과 서버 상태를 확인해 주세요. 연결이 돌아오면 저절로 올라갑니다.</div>'
          +'<div style="padding:9px 11px;border-radius:9px;background:rgba(128,128,128,.12)">그래도 지금 전환해야 한다면, 이 기기의 팀 자료는 <b>전환 직전 백업</b>에 담겨 있습니다.<br>되돌리려면 <b>설정 → 전환 백업 복구</b>를 쓰세요.</div>',
        ok:'그래도 전환',danger:true,cancel:'여기 머무르기',
        onOk:function(){ try{chip('백업을 남기고 전환합니다 — 설정 → 전환 백업 복구로 되돌릴 수 있어요');}catch(_){}
          setTimeout(function(){ try{switchWorkspace(tgt,true);}catch(_){} },60); }});
    }catch(_){ try{chip(head);}catch(_){} }
    var e=new Error(code||'preswitch unreachable');e.psPreswitch=true;throw e;
  }
  /* ══ 2.586 · 서버가 저장을 **거부**했을 때의 출구(사용자 "워크스페이스 전환이 안된다고 요청이 많이 온다") ═══════════
     가드(ps_kv_team_guard)는 거부한 행을 조용히 버리고 ps_kv_denied 에 이유를 남긴다. 앱은 «server rejected» 로 판정해 전환을 막았고,
     거부된 사본은 이 기기에 «올릴 것» 으로 남아 누를 때마다 다시 거부됐다 — 한 번 걸리면 영원히 전환이 안 되는 고리.
     네트워크 오류의 «그래도 전환»(2.445)과 같은 모양으로 출구를 준다: 이유를 서버 표에서 읽어 보여 주고, skipSave 전환(전환 직전 백업은 그대로). */
  function stopPreswitchRejected(keys,code){
    staleStop();
    restorePreMeta();
    switching=false;clearTimeout(overlayGuard);clearTimeout(overlaySlow);hideSwitchOverlay();
    keys=(Array.isArray(keys)?keys:[]).filter(function(k,i,a){return k&&a.indexOf(k)===i;});
    var labels=keys.length?keys.map(keyLabel):['팀 자료'];
    var head='서버가 '+labels.join('·')+' 저장을 거부했습니다';
    setStatus(head); recSwitchFail(head,code||'sync_server_rejected');
    try{var dg=new Error('preswitch rejected');dg.psCode='sync_server_rejected';syncDiagnostic('workspace-preswitch-rejected',dg);}catch(_){}
    var tgt=wid, fromWid=from;
    var reasons=ensureToken().then(function(at){ if(!at)return null;
      return fetch(BASE+'/rest/v1/ps_kv_denied?workspace_id=eq.'+encodeURIComponent(fromWid)+'&select=k,reason,at&order=at.desc&limit=20',{headers:hj(at)})
        .then(function(r){ return r.ok?r.json():null; }); }).catch(function(){ return null; });
    withTimeout(reasons,4000).then(function(rows){
      var list=Array.isArray(rows)?rows:[];
      var why={}; list.forEach(function(x){ if(x&&x.k&&!why[x.k])why[x.k]=String(x.reason||''); });
      var show=keys.length?keys:Object.keys(why);
      var items=show.map(function(k){ return '<li><b>'+esc(keyLabel(k))+'</b>'+(why[k]?(' — '+esc(why[k])):' — 서버에 이유가 기록되지 않았습니다')+'</li>'; }).join('');
      try{
        psModal({title:'서버가 저장을 거부했습니다',
          body:'<div style="margin-bottom:8px">'+esc(head)+'. 이 기기의 사본이 서버 규칙에 맞지 않아 올라가지 않습니다.</div>'
            +(items?('<ul style="margin:0 0 10px 18px;padding:0;line-height:1.55">'+items+'</ul>'):'')
            +'<div style="margin-bottom:8px">흔한 원인: 낡은 앱이 지난 주 일정을 올리려 함 · 편집 권한이 없는 자료 · 경기 자료 판본 충돌. 이 자료는 <b>서버본이 정본</b>입니다.</div>'
            +'<div style="padding:9px 11px;border-radius:9px;background:rgba(128,128,128,.12)">«서버본으로 두고 전환»을 누르면 거부된 사본은 올리지 않고 넘어갑니다. 이 기기의 팀 자료는 <b>전환 직전 백업</b>에 담기며, 되돌리려면 <b>설정 → 전환 백업 복구</b>를 쓰세요.</div>',
          ok:'서버본으로 두고 전환',danger:true,cancel:'여기 머무르기',
          onOk:function(){ try{chip('거부된 사본은 두고 전환합니다 — 설정 → 전환 백업 복구로 되돌릴 수 있어요');}catch(_){}
            setTimeout(function(){ try{switchWorkspace(tgt,true);}catch(_){} },60); }});
      }catch(_){ try{chip(head+' — 앱을 새로고침한 뒤 다시 시도해 주세요');}catch(_){} }
    });
    var e=new Error(code||'preswitch rejected');e.psPreswitch=true;throw e;
  }
  showSwitchOverlay(target?target.name:'');   /* 과도기 화면 가림 */
  /* 2.338 — 옛 가드(20초)는 단계 예산 합(최악 46초+)보다 짧아 **정상 진행 중인 전환**을 풀어 버렸다:
     오버레이가 걷힌 뒤 갑자기 리로드되거나, 코치가 다시 눌러 체인 두 개가 동시에 돌았다(감사 확정 — 2.244류 섞임의 재입구).
     이제 20초엔 말만 바꾸고(오버레이 유지), 60초에야 세대를 올려 체인을 문턱에서 멈춘다.
     와이프가 시작됐으면 붙잡지 않는다 — 남은 단계는 전부 상한이 있어 리로드/롤백으로 끝난다. */
  var overlaySlow=setTimeout(function(){
    if(switching&&myGen===switchGen){ setStatus('전환이 오래 걸리고 있어요 — 네트워크가 느립니다');
      try{var _t=document.getElementById('psSwitchTxt'); if(_t)_t.textContent='전환이 오래 걸리고 있어요 — 잠시만요';}catch(_){} }
  },20000);
  var overlayGuard=setTimeout(function(){
    if(!switching||myGen!==switchGen||wipeStarted)return;
    switchGen++;   /* 체인은 다음 staleStop 문턱에서 스스로 멈춘다(preMeta 도 거기서 복원) */
    switching=false;hideSwitchOverlay();
    setStatus('전환을 멈췄습니다 — 네트워크 확인 후 다시 시도해 주세요');
    recSwitchFail('전환 60초 초과로 중단','switch-timeout');
    try{chip('전환을 멈췄어요 — 네트워크를 확인하고 다시 시도해 주세요');}catch(_){}
  },60000);
  /* 0) 이 창에서 시작한 공유 저장을 먼저 완료한 뒤 IDB 스냅샷을 읽는다. */
  return workspaceSwitchWriteBarrier().then(function(gate){
    staleStop();
    if(!gate||gate.held)return stopPreswitch('전환 취소 — 일정 편집을 끝내고 저장 완료 후 다시 시도하세요','preswitch schedule held');
    if(gate.__timeout||gate.error)return stopPreswitch('전환 취소 — 현재 일정 저장을 완료하지 못했습니다','preswitch shared write failed');
    /* 2.338 — 상한이 없어 IDB 가 멈추면 체인이 영원히 매달렸다(감사 확정). 아직 지우기 전이라 중단이 안전하다. */
    return withTimeout(stashSnapshot(from),10000);
  }).then(function(st){
  staleStop();
  if(st&&(st.__timeout||st.err))return stopPreswitch('전환 취소 — 전환 전 백업을 만들지 못했습니다','preswitch stash failed');
  if(scheduleHeld())return stopPreswitch('전환 취소 — 일정 편집을 끝내고 저장 완료 후 다시 시도하세요','preswitch schedule held');
  /* 1) 현재 공간 데이터를 서버로 강제 저장 — 메타를 비워 전부 dirty로 취급해 확실히 push.
        15초 하드 백스톱: 저장이 안 끝나면 지우지 않고 중단(오버레이가 영구히 멈추지 않도록).
        skipSave: 팀 나가기처럼 더 이상 현재 공간에 쓸 수 없을 때 저장을 건너뛰고 바로 전환 */
  /* ══ 2.340 · 메타를 통째로 비우면 일정·경기는 정반대로 작동한다 ══════════════════
     의도는 '전부 dirty 로 취급해 확실히 push' 였다. 그런데 일정(`SCHEDULE_KEY`)·경기(`cs_team_matches_v1`)는
     pull 쪽에 **병합 가드**가 있다: `if(!trustedBase||hash(trustedBase)!==(m.h[k]||''))`.
     메타를 비우면 `m.h[k]` 가 늘 `''` 이라 이 조건이 **항상 참** → 3-way 병합(mergeCoachWeeks)에 닿지 못하고
     `kvWrite(k,row.v)` 로 **서버 옛 판이 로컬 편집을 덮는다**. 코치가 일정을 고치고 (5초 보호창이 지난)
     6초 뒤 팀을 바꾸면 그 편집이 조용히 사라졌다 — 감사에서 반박 검증까지 통과한 실제 유실 경로.
     ⚠ 그래서 **이 두 키의 메타만 남기고** 나머지를 비운다. 나머지 키의 '전부 push' 동작은 그대로다.
     ⚠ 남긴 키는 평소 회차와 **똑같은 길**(dirty 판정 → 병합 → push)을 탄다 — 새 규칙이 아니라 원래 길이다.
     ⚠ 실패 시 `restorePreMeta()` 가 원본(preMetaRaw)을 통째로 되돌린다 — 그건 그대로 둔다. */
  try{
    preMetaRaw=localStorage.getItem(MKEY);preMetaCaptured=true;
    var _keep={h:{},c:{},n:{},last:0};
    try{
      var _pm=JSON.parse(preMetaRaw||'null')||{};
      Object.keys(SWITCH_META_KEEP).forEach(function(k){
        if(_pm.h&&_pm.h[k]!=null)_keep.h[k]=_pm.h[k];
        if(_pm.c&&_pm.c[k]!=null)_keep.c[k]=_pm.c[k];
        if(_pm.n&&_pm.n[k]!=null)_keep.n[k]=_pm.n[k];
      });
    }catch(_){}
    localStorage.setItem(MKEY,JSON.stringify(_keep));
  }catch(_){}
  var _pre = skipSave ? Promise.resolve({__skip:1}) : withTimeout(forceSync('preswitch'),15000);
  return _pre.then(function(r){
    staleStop();
    /* forceSync가 일정을 보류해도 다른 키는 정상 동기화되므로 전체 Promise는
       성공으로 끝난다. 전환에서는 그것을 저장 성공으로 보면 안 된다. */
    if(!skipSave&&(r&&r.scheduleDeferred||scheduleHeld())){
      return stopPreswitch('전환 취소 — 일정 편집·저장을 먼저 끝내 주세요','preswitch schedule deferred');
    }
    /* 2) 저장 실패(skip·타임아웃 포함)면 절대 지우지 않고 중단 — 데이터 유실 방지(단 skipSave면 통과) */
    var unsafeSkipped=Array.isArray(r&&r.skipped)?r.skipped.filter(function(k){return !PERSONAL[k];}):[];
    var held={};holdList().forEach(function(x){if(x&&x.k)held[x.k]=1;});
    var reviewKeys=unsafeSkipped.filter(function(k){return held[k];});
    if(!skipSave&&reviewKeys.length)return stopPreswitchReview(reviewKeys);
    /* ══ 2.445 · **서버에 못 닿은 것만으로 여기서 끝내지 않는다** ═══════════════════
       예전에는 preswitch 동기화가 네트워크 오류면 여기서 바로 '전환 취소 — 동기화 오류(sync_network)'
       로 끝났다. 그래서 ① 올릴 것이 하나도 없어도 못 넘어갔고, ② 아래의 '무엇이 막는지' 판정과
       출구(stopPreswitchUnreachable)까지 아예 도달하지 못했다.
       이제 **도달 실패 계열만** 그대로 통과시켜 아래 대기 검사가 판단하게 한다 —
       막을 것이 없으면 전환되고, 있으면 무엇이 남는지 말하고 사용자가 고른다.
       ⚠ 인증·권한·용량·저장소 오류는 예전처럼 여기서 멈춘다(고칠 수 있는 문제이고, 고쳐야 한다). */
    var _unreachRound = !!(r && r.error && UNREACHABLE[String(r.code||'')]);
    if(!skipSave && !_unreachRound && (!r || r.__timeout || r.error || r.offline || r.noauth || r.nows || r.skip || r.itemPending || unsafeSkipped.length)){
      if(r&&r.error&&String(r.code||'')==='sync_server_rejected')return stopPreswitchRejected(r.rejectedKeys||r.serverRejected||[],r.code);   /* 2.586 */
      var failMsg=r&&r.__timeout?'전환 취소 — 네트워크가 느립니다. 잠시 후 다시 시도하세요'
        :r&&r.error?'전환 취소 — 동기화 오류 ('+String(r.code||'확인 필요')+')'
        :r&&r.offline?'전환 취소 — 오프라인 상태입니다'
        :r&&r.noauth?'전환 취소 — 로그인 확인이 필요합니다'
        :r&&r.nows?'전환 취소 — 워크스페이스를 확인하지 못했습니다'
        :r&&r.itemPending?'전환 취소 — 선수 자료 저장 확인이 남아 있습니다'
        :unsafeSkipped.length?'전환 취소 — '+unsafeSkipped.map(keyLabel).join('·')+' 용량을 확인해 주세요'
        :'전환 취소 — 현재 데이터를 저장하지 못했습니다';
      try{var failDiag=new Error('preswitch result');failDiag.psCode=String((r&&r.code)||((r&&r.skip)?'skip':'preswitch_failed'));syncDiagnostic('workspace-preswitch-result',failDiag);}catch(_){}
      return stopPreswitch(failMsg,'preswitch failed');
    }
    return (skipSave?Promise.resolve([]):withTimeout(workspaceBlockingPendingKeys(from),8000)).then(function(blockingKeys){
      staleStop();
      if(blockingKeys&&blockingKeys.__timeout)return stopPreswitch('전환 취소 — 저장 확인을 읽지 못했습니다','preswitch outbox read timeout');
      /* 1.649 — 급감 보류는 skipped(용량 초과 목록)가 아니라 outbox에만 남는다.
         1.648은 skipped와 hold를 교차해 실제 기기에서는 이 분기에 도달하지 못했다.
         현재 공간의 **모든** blocking outbox 키가 hold로 설명될 때만 선택창을 연다.
         권한·저장소 오류 같은 다른 pending이 하나라도 섞였으면 선택으로 해결할 수 없으므로
         예전처럼 자료를 지우지 않고 일반 중단한다. 원문 hash는 prepare가 다시 검증한다. */
      if(!skipSave&&blockingKeys.length){
        var pendingHeld={};holdList().forEach(function(x){if(x&&x.k&&x.h)pendingHeld[x.k]=1;});
        var pendingDeferred={};(Array.isArray(r&&r.deferred)?r.deferred:[]).forEach(function(k){pendingDeferred[k]=1;});
        var pendingReview=blockingKeys.filter(function(k){return pendingHeld[k];});
        /* 일정 hold 때문에 경기만 의존성 보류된 경우에는 두 outbox를 한꺼번에 오류로 보지 않는다.
           사용자가 실제로 선택해야 하는 일정 hold만 먼저 보여 주고, 선택 뒤 forceSync가
           일정→경기 순서로 확정한다. 다른 pending이 하나라도 섞이면 기존처럼 fail-closed. */
        var allExplained=blockingKeys.every(function(k){return !!pendingHeld[k]||!!pendingDeferred[k];});
        if(pendingReview.length&&allExplained)return stopPreswitchReview(pendingReview);
        /* 2.434 — 같은 라벨이 'IDP·IDP·IDP' 로 찍혔다(키는 셋, 라벨은 하나). 묶어서 센다 */
        var _lc={},_lo=[];
        blockingKeys.forEach(function(k){ var l=(k==='@library')?'보관함':keyLabel(k);
          if(!(l in _lc)){ _lc[l]=0; _lo.push(l); } _lc[l]++; });
        var pendingLabels=_lo.map(function(l){ return _lc[l]>1?(l+' '+_lc[l]+'건'):l; });
        try{var pendingDiag=new Error('blocking pending');pendingDiag.psCode=blockingKeys.join(',');syncDiagnostic('workspace-preswitch-pending',pendingDiag);}catch(_){}
        /* 2.257 — 왜 확인이 안 끝나는지(항목별 마지막 오류)를 문장에 붙인다 — 실제 제보에서 원인 확정용 */
        return outboxRead().then(function(q){
          var uid=outboxOwner(),sc=outboxScope(uid,from),errs={},mine=[];
          (q||[]).forEach(function(it){ if(!it||outboxScope(it.uid,it.wid)!==sc||blockingKeys.indexOf(it.key)<0)return;
            mine.push(it);
            var t=[it.lastStage,it.lastError].filter(Boolean).join(':');
            if(t)errs[t]=1;
            else if(it.roundError)errs['서버에 닿지 못함('+(it.roundStage||'')+')']=1;   /* 2.445 — 항목이 아니라 회차가 죽었다 */
            else if(!(+it.attempts))errs['아직 시도 전']=1; });
          var extra=Object.keys(errs).slice(0,3).join(' · ');
          /* 2.445 — 막는 것이 **전부** 서버 도달 실패면 사용자가 고칠 항목이 없다. 출구를 준다. */
          if(mine.length&&mine.every(outboxUnreachableOnly)){
            var c0=mine[0]; return stopPreswitchUnreachable(pendingLabels,String(c0.lastError||c0.roundError||''));
          }
          return stopPreswitch('전환 취소 — '+pendingLabels.join('·')+' 저장 확인이 끝나지 않았습니다'+(extra?' — '+extra:''),'preswitch pending');
        });
      }
      /* preswitch가 끝난 뒤 뒤따라오던 shared write까지 다시 확인한다. */
      return workspaceSwitchWriteBarrier().then(function(gate2){
        staleStop();
        if(!gate2||gate2.held)return stopPreswitch('전환 취소 — 일정 편집을 끝내고 저장 완료 후 다시 시도하세요','preswitch schedule held');
        if(gate2.__timeout||gate2.error)return stopPreswitch('전환 취소 — 현재 일정 저장을 완료하지 못했습니다','preswitch shared write failed');
        return r;
      });
    });
  }).then(function(){
    staleStop();
    if(!window.storage){switchItemKeys=[];return;}
    /* 2.244 — 항목만이 아니라 실제 IDB의 팀 콘텐츠 전부(손 목록 IDB_CONTENT 포함) */
    return withTimeout(idbSwitchKeys(),8000).then(function(keys){
      if(keys&&keys.__timeout)return stopPreswitch('전환 취소 — 저장소를 읽지 못했습니다','preswitch idb keys timeout');
      switchItemKeys=keys;});
  }).then(function(){
    /* 2.244 — 전환 창(비우기~reload) 동안 살아 있는 앱 iframe(일정·팀 등)의 자동저장이
       방금 비운 자료를 이전 팀 값으로 되살려 새 팀 서버로 올리는 경합 —
       어차피 끝에 reload 하므로 프레임을 먼저 내린다. unload 계열 저장이 남긴 값은
       뒤이은 비우기가 지우도록 잠깐 기다린 뒤 진행한다. */
    staleStop();   /* 2.338 — 마지막 문턱. 이 아래(프레임 내리기~리로드)는 끝까지 간다 */
    wipeStarted=true; switchWiping=true; clearTimeout(overlayGuard);
    try{ [].forEach.call(document.querySelectorAll('.frames iframe'),function(f){ try{ f.src='about:blank'; }catch(_){} }); }catch(_){}
    return sleep(350);
  }).then(function(){
    /* 3) 안전 — 아직 예전 팀이 활성인 상태에서 예전 팀 거울을 먼저 비운다.
       활성 ID를 먼저 바꾸면 중간 실패 시 '새 팀 + 예전 팀 일부'가 섞인다. */
    function removeLocal(k){try{localStorage.removeItem(k);if(localStorage.getItem(k)!=null)throw new Error(k+' local wipe verify failed');}catch(e){e.psSwitchWipe=true;throw e;}}
    CONTENT.forEach(removeLocal);
    /* 남의 IDP는 팀 콘텐츠라 정리 — 내 키(cs_idp_v1_<내uid>)와 local은 나를 따라다닌다(설계 v1.1) */
    try{ var _mk='cs_idp_v1_'+((getSess()||{}).uid||'@');
      for(var _i=localStorage.length-1;_i>=0;_i--){ var _k=localStorage.key(_i);
        if(_k&&_k.indexOf('cs_idp_v1_')===0&&_k!==_mk&&_k!=='cs_idp_v1_local')removeLocal(_k); } }catch(e){e.psSwitchWipe=true;throw e;}
    removeLocal(MKEY);
    /* 보관함·선수단·훈련세션 등은 IndexedDB에 산다 — 함께 비우지 않으면 이전 팀 데이터가 새 워크스페이스에 남는다.
       비우기가 끝난 뒤에 pull해야 새 데이터와 섞이지 않는다. */
    /* 1.631 — 항목(sq:*)을 여기 안 넣으면 A팀 선수단이 B팀으로 따라가고 B팀 서버로 올라간다 */
    /* 2.244 — switchItemKeys 가 이미 IDB_CONTENT + 항목 + 실측 팀 키 전부(idbSwitchKeys) */
    var wiped = withTimeout((window.storage)
      ? Promise.all(switchItemKeys.map(function(k){return window.storage.del(k).catch(function(e){syncDiagnostic('workspace-switch-wipe',e);e.psSwitchWipe=true;throw e;});}))
      : Promise.resolve(),12000).then(function(r){
      /* 2.338 — 와이프가 멈추면 localStorage 만 지워진 반쪽 상태로 방치됐다 → 상한 걸고 롤백 경로로 */
      if(r&&(r.__timeout||r.err)){var e=new Error(r.err?'idb wipe failed':'idb wipe timeout');e.psSwitchWipe=true;throw e;}
    });
    /* IDB까지 모두 빈 뒤에만 활성 팀을 바꾼다. */
    return wiped.then(function(){
      if(!setActiveWs(wid)){
        var e=new Error('workspace id write failed');e.psSwitchWipe=true;throw e;
      }
      var _ss=getSess();
      if(!_ss||!_ss.uid||!setDataReady(true,_ss.uid,wid)){
        var e2=dataLockError();e2.psSwitchWipe=true;throw e2;
      }
      /* postswitch도 백스톱 — 데이터는 이미 서버 저장됨. 늦어도 reload로 재동기화되므로 무조건 진행 */
      return withTimeout(forceSync('postswitch'),15000);
    });
  }).then(function(){
    switching=false;
    clearTimeout(overlayGuard);clearTimeout(overlaySlow);
    try{ sessionStorage.removeItem(RLKEY); }catch(_){}
    /* 공간을 바꾸면 화면의 자료가 통째로 교체된다. 사용자에게는 "보관함이 날아갔다"로 보인다.
       무엇에서 무엇으로 옮겼는지 남겨, reload 뒤에 설명한다. */
    try{
      var _to=(wsList().filter(function(w){return w.id===wid;})[0]||{}).name||'';
      var _fr=(wsList().filter(function(w){return w.id===from;})[0]||{}).name||'';
      localStorage.setItem('ps_ws_switched_v1',JSON.stringify({from:_fr,to:_to,at:Date.now()}));
    }catch(_){}
    markSelfReload();
    location.reload();   /* 오버레이는 reload로 사라짐 */
  });
  }).catch(function(e){
    clearTimeout(overlayGuard);clearTimeout(overlaySlow);
    switchWiping=false;   /* 2.340 — 되돌아왔으면 미러를 다시 연다 */
    if(e&&e.psStale)return {cancelled:1,stale:1};   /* 2.338 — 밀려난 체인의 조용한 끝(UI 는 새 체인 소유) */
    if(myGen===switchGen){switching=false;hideSwitchOverlay();}
    if(e&&e.psSwitchWipe&&from){recSwitchFail('전환 도중 문제가 생겨 이전 공간으로 돌아왔어요 — '+String(e&&e.message||e).slice(0,120),'wipe-rollback');try{setActiveWs(from);var _rs=getSess();if(_rs&&_rs.uid)setDataReady(true,_rs.uid,from);}catch(_){}try{location.reload();}catch(_){}}
    if(!(e&&e.psPreswitch)){setStatus('전환 실패 — 네트워크 확인');try{chip('전환하지 못했어요 — 네트워크를 확인해 주세요');}catch(_){}recSwitchFail(String(e&&e.message||e).slice(0,150),'switch-error');}   /* 2.255·2.338 */
    return {cancelled:1,reason:(e&&e.message)||'workspace switch failed'};
  });
}
function createTeam(name){
  var s=getSess(); if(!s) return Promise.reject();
  return rpc('ps_create_team',{p_name:name,p_email:s.email||null}).then(function(wid){
    /* 새 팀도 합류와 똑같이 생성자의 이름을 그 팀 멤버 행에 먼저 기록한다(1.657). */
    return pushMyName(wid).then(function(){
      return loadWorkspaces().then(function(){ return switchWorkspace(wid); });
    });
  });
}
function joinTeam(code){
  var s=getSess(); if(!s) return Promise.reject();
  return rpc('ps_join',{p_code:code,p_email:s.email||null}).then(function(wid){
    /* 합류 직후 이름을 서버에 올린다 — 이게 없으면 팀원 목록에 uid 앞자리로만 보인다(1.533) */
    return pushMyName(wid).then(function(){
      return loadWorkspaces().then(function(){ return switchWorkspace(wid); }).then(function(){ return wid; });
    });
  });
}
function createInvite(wid){ return rpc('ps_get_or_create_invite',{p_wid:wid}).catch(function(){ return rpc('ps_create_invite',{p_wid:wid}); }); }
function createRoleInvite(wid,role){ return rpc('ps_get_or_create_role_invite',{p_wid:wid,p_role:role}); }
function regenRoleInvite(wid,role){ return rpc('ps_regenerate_role_invite',{p_wid:wid,p_role:role}); }
function membersOf(wid){
  /* 1.516 — 이름·이메일을 나눠 주는 v2를 먼저 쓰고, 서버에 아직 없으면 예전 함수로 돌아간다.
     (SQL 적용 전에 앱만 올라가도 화면이 깨지지 않게) */
  return rpc('ps_members_of_v2',{p_wid:wid}).catch(function(){ return rpc('ps_members_of',{p_wid:wid}); });
}
function leaveTeam(wid){ return rpc('ps_leave',{p_wid:wid}); }
/* 1.538 — 팀 이름 바꾸기. 서버 RLS(ws_upd)가 이미 '소유자만'으로 열려 있어 RPC 없이 바로 쓴다.
   목록(ps_ws_list)도 함께 고쳐야 화면이 즉시 바뀐다 — 다음 부팅 때 서버 목록으로 다시 맞춰진다. */
function renameWorkspace(wid,name){
  name=String(name||'').trim();
  if(!wid)return Promise.reject(new Error('워크스페이스를 찾지 못했습니다'));
  if(name.length<1)return Promise.reject(new Error('이름을 입력해 주세요'));
  if(name.length>40)name=name.slice(0,40);
  return ensureToken().then(function(at){
    if(!at)throw new Error('로그인이 필요합니다');
    /* RLS는 권한이 없으면 오류가 아니라 '0건 수정'으로 조용히 지나간다.
       return=representation 으로 실제 바뀐 행을 돌려받아 확인한다(1.538). */
    var h=hj(at); h['Prefer']='return=representation';
    return fetch(BASE+'/rest/v1/ps_workspaces?id=eq.'+encodeURIComponent(wid)+'&select=id,name',
      {method:'PATCH',headers:h,body:JSON.stringify({name:name})})
      .then(function(r){
        if(r.status===403||r.status===401)throw new Error('팀 이름은 팀을 만든 사람만 바꿀 수 있어요');
        if(!r.ok)throw new Error('이름을 바꾸지 못했어요');
        return r.json().catch(function(){ return []; });
      })
      .then(function(rows){
        if(!rows||!rows.length)throw new Error('팀 이름은 팀을 만든 사람만 바꿀 수 있어요');
        try{ var l=wsList().map(function(w){ if(w.id===wid)w.name=name; return w; }); setWsList(l); }catch(_){}
        try{ renderUI(); }catch(_){}
        return name;
      });
  });
}
function uiRenameWs(wa){
  psModal({title:'팀 이름 바꾸기',
    body:'팀원 모두에게 이 이름으로 보입니다. 자료·일정·권한은 그대로예요.',
    input:(wa&&wa.name)||'',placeholder:'예: 풋볼A U15',maxlength:40,ok:'저장',
    onOk:function(v){
      renameWorkspace(wa.id,v).then(function(nm){
        try{ toast&&toast('팀 이름을 「'+nm+'」로 바꿨어요'); }catch(_){}
      }).catch(function(e){
        psModal({title:'바꾸지 못했어요',body:esc((e&&e.message)||'잠시 후 다시 시도해 주세요.'),hideCancel:true,ok:'확인'});
      });
    }});
}

/* ── 설정 팝업 UI ── */
var stEl=null;
function setStatus(t){ try{ if(stEl)stEl.textContent=t; }catch(_){} try{ window.dispatchEvent(new CustomEvent('ps-sync-state')); }catch(_){} }
function ensureCSS(){
  if(document.getElementById('ps-acct-css'))return;
  var st=document.createElement('style'); st.id='ps-acct-css';
  st.textContent=
   ".acct-wrap{margin-left:6px;}"
  +".acct-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid var(--line);background:var(--bar2);color:var(--dim);border-radius:10px;cursor:pointer;font-family:inherit;font-weight:700;font-size:13px;transition:.15s;white-space:nowrap;flex:0 0 auto;}"
  +".acct-btn:hover{color:var(--txt);background:#fff;}"
  +".acct-btn.in{background:var(--txt,#0d0e10);color:#fff;border-color:var(--txt,#0d0e10);}"
  +".acct-btn .ava{width:20px;height:20px;border-radius:50%;background:#8b95a4;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:0 0 auto;overflow:hidden;}"
  +".acct-btn .ava img{width:100%;height:100%;object-fit:cover;}"
  +".acct-btn .lbl{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}"
  /* 1.563 — 항목이 늘어 아이패드에서 아래쪽(팀 자료 새로고침·로그아웃)이 화면 밖으로 잘렸다.
     화면 높이에 맞춰 상한을 두고, 넘치면 팝업 안에서 스크롤한다. 44px = 팝업이 시작하는 위치. */
  +".acct-pop{position:absolute;right:0;top:44px;z-index:200;min-width:230px;background:var(--panel,#fff);border:1px solid var(--line);border-radius:13px;box-shadow:0 16px 44px rgba(16,24,40,.18);padding:12px;display:none;flex-direction:column;gap:8px;max-height:calc(100dvh - 60px);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;max-width:min(92vw,340px);box-sizing:border-box;}"
  +"@supports not (height:100dvh){.acct-pop{max-height:calc(100vh - 60px);}}"
  /* 1.570 — 1.563에서 세로 스크롤 때문에 .ap-b 에 flex:0 0 auto 를 걸었는데,
     '＋ 팀 만들기 / 코드로 합류' 는 **가로 flex 줄(.ap-mini)** 안에 있다.
     각 버튼이 width:100% 라 줄지 못하고 넘쳐서 '코드로 합류' 가 잘려 보이지 않았다.
     세로 방향으로만 안 줄어들게 바꾼다. */
  +".acct-pop>.ap-b{flex:0 0 auto;}"
  +".acct-pop .ap-mini .ap-b{flex:1 1 0;min-width:0;}"
  +".acct-pop.on{display:flex;}"
  /* 1.806 — 설정 3종 일관화: 섹션 타이틀·보더 버튼을 작전판 설정 문법으로 */
  +".acct-pop .ap-hd{font-size:10px;font-weight:800;color:#8a94a4;letter-spacing:.07em;}"
  +".acct-pop .ap-who{font-size:13px;font-weight:700;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}"
  +".acct-pop .ap-st{font-size:11px;color:var(--dim,#6a7078);line-height:1.5;}"
  +".acct-pop .ap-b{width:100%;justify-content:center;border:1px solid var(--line,#e1e5eb);border-radius:8px;padding:7px 0;font-weight:650;font-size:12px;cursor:pointer;font-family:inherit;background:var(--panel,#fff);color:var(--txt,#344054);}"
  +".acct-pop .ap-b:hover{background:var(--bar2,#f5f6f8);}"
  +".acct-pop .ap-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}"
  +".acct-pop .ap-grid .ap-b{min-width:0;}"
  +".acct-pop .ap-b.danger{border-color:#ecc9c6;background:#fffafa;color:#a84440;}"
  +".acct-pop .ap-b.danger:hover{background:#fdf1f0;}"
  +".acct-pop .ap-b.solid{background:var(--txt,#0d0e10);color:#fff;border-color:var(--txt,#0d0e10);}"
  +".acct-pop .ap-b.kakao{background:#FEE500;color:#181600;border-color:#FEE500;}"
  +".acct-pop .ap-div{height:1px;background:var(--line);margin:3px 0;}"
  +".acct-pop .ap-wslist{display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto;}"
  +".acct-pop .ap-ws{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:8px 9px;border:0;background:transparent;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;color:var(--txt);}"
  +".acct-pop .ap-ws:hover{background:var(--bar2,#f1f3f5);}"
  +".acct-pop .ap-ws.on{background:var(--bar2,#eef1f5);font-weight:700;}"
  +".acct-pop .ap-ws .wi{width:22px;height:22px;border-radius:6px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;}"
  +".acct-pop .ap-ws .wn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}"
  +".acct-pop .ap-ws .wc{font-size:10px;color:var(--dim,#8a8f98);flex:0 0 auto;}"
  +".acct-pop .ap-ws .wk{font-size:12px;color:var(--blue,#3a6df0);flex:0 0 auto;}"
  +".acct-pop .ap-mini{display:flex;gap:6px;}"
  +".acct-pop .ap-mini .ap-b{padding:8px 0;font-size:12px;}"
  +".acct-pop .ap-code{font:800 20px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-align:center;padding:12px;border:1px dashed var(--line);border-radius:9px;color:var(--txt);user-select:all;}"
  +"body.fmdark .acct-pop .ap-ws{color:#E7EBF1;}"
  +"body.fmdark .acct-pop .ap-ws:hover,body.fmdark .acct-pop .ap-ws.on{background:#222c39;}"
  +"body.fmdark .acct-pop .ap-div{background:#2C3744;}"
  +"body.fmdark .acct-btn{background:rgba(0,0,0,.28)!important;border:1px solid rgba(255,255,255,.07)!important;color:#8C95A4!important;}"
  +"body.fmdark .acct-btn:hover{background:rgba(255,255,255,.10)!important;color:#fff!important;}"
  +"body.fmdark .acct-btn.in{background:#E7EBF1!important;color:#16181C!important;border-color:#E7EBF1!important;}"
  +"body.fmdark .acct-pop{background:#1A212B!important;border-color:#2C3744!important;}"
  +"body.fmdark .acct-pop .ap-who{color:#E7EBF1;}"
  +"body.fmdark .acct-pop .ap-hd{color:#8b93a0;}"
  +"body.fmdark .acct-pop .ap-b{background:#222c39;color:#E7EBF1;border-color:#2C3744;}"
  +"body.fmdark .acct-pop .ap-b.danger{background:#31272c;color:#f2aaa6;border-color:#70484a;}"
  +"body.fmdark .acct-pop .ap-b.solid{background:#E7EBF1;color:#16181C;border-color:#E7EBF1;}"
  +"body.fmdark .acct-pop .ap-b.kakao{background:#FEE500;color:#181600;border-color:#FEE500;}";
  (document.head||document.documentElement).appendChild(st);
}
function esc(s){ return window.PSSafe&&window.PSSafe.html?window.PSSafe.html(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
/* 표시 이름 — 작전판·보관함에서 '만든 사람'으로 표시(이메일 대신). 기기 로컬 저장, 항목에 baked되어 팀원에게 보임 */
var DNKEY='ps_display_name';
function getDisplayName(){ try{ return (localStorage.getItem(DNKEY)||'').trim(); }catch(_){ return ''; } }
function writeDisplayNameLocal(v){
  var ok=false;
  try{
    v=(''+(v||'')).trim();
    if(v){ localStorage.setItem(DNKEY,v); ok=(getDisplayName()===v); }
    else { localStorage.removeItem(DNKEY); ok=true; }
  }catch(_){ ok=false; }
  return ok;
}
/* 1.583 — 저장 성공 여부를 **돌려준다.** 예전에는 setItem 실패를 catch(_){} 로 삼켜서,
   저장 공간이 꽉 찬 기기에서는 이름이 안 써졌는데도 '이름 저장됨 ✓' 토스트가 떴다.
   그러면 getDisplayName() 은 여전히 빈 값이고, renderUI() 가 돌 때마다(=수시로)
   ensureDisplayName 이 30초 가드만 지나면 같은 모달을 다시 띄웠다 —
   사용자는 이름을 넣었는데도 창이 끝없이 다시 뜬다(역할과 무관하므로 관리자도 똑같이 겪는다).
   쓴 뒤 **다시 읽어** 확인하고, 실패는 실패라고 말한다. */
function setDisplayName(v){
  var ok=writeDisplayNameLocal(v);
  if(ok)pushMyName();
  return ok;
}
/* 1.533 — 지금까지 이름은 그 사람 기기에만 남았다(ps_join 은 이메일만 보낸다).
   그래서 권한 관리에 501명 중 46명만 이름이 있고, 336명은 이름도 이메일도 없이 uid 앞자리로 보였다.
   이름을 정하거나 팀에 합류할 때마다 서버(ps_members.name)에도 올린다. 남의 이름은 못 바꾼다(서버가 auth.uid()로 제한). */
function pushMyName(wid){
  try{
    var nm=getDisplayName(); if(!nm)return Promise.resolve();
    if(!getSess())return Promise.resolve();
    var w=wid||activeWs(); if(!w)return Promise.resolve();
    var wo=wsList().filter(function(x){return x.id===w;})[0];
    if(wid==null&&(!wo||wo.kind!=='team'))return Promise.resolve();   /* 팀 공간에서만 의미가 있다 */
    return rpc('ps_set_my_name',{p_wid:w,p_name:nm}).catch(function(){});   /* 서버에 함수가 없으면 조용히 넘어간다 */
  }catch(_){ return Promise.resolve(); }
}
function uiSetName(){
  psModal({title:'표시 이름', body:'작전판·보관함에서 <b>만든 사람</b>으로 표시될 이름입니다. (이메일 대신)', input:getDisplayName(), placeholder:'예: 김철수 코치', maxlength:20, ok:'저장', onOk:function(v){ setDisplayName(v); try{renderUI();}catch(_){} }});
}
/* 관리 페이지 링크 노출용 이메일 화이트리스트(표시 전용 — 접근 권한은 서버 ps_is_admin이 판정) */
var ADMIN_EMAILS=['scua5673@gmail.com'];
function isAdminEmail(e){ try{ return !!e && ADMIN_EMAILS.indexOf(String(e).toLowerCase())>=0; }catch(_){ return false; } }
function div(pop){ var d=document.createElement('div'); d.className='ap-div'; pop.appendChild(d); }
function wsColor(id){ var h=0,i=id.length; while(i)h=(h*31+id.charCodeAt(--i))>>>0; var cs=['#3a6df0','#e0569f','#34a56f','#BA7517','#7F77DD','#d12f38','#2f9e8f']; return cs[h%cs.length]; }

/* 공용 모달(prompt/알림) — PWA에서 window.prompt 차단 대비 */
function psModal(opts){
  try{ var ex=document.getElementById('psWsModal'); if(ex)ex.remove(); }catch(_){}
  var ov=document.createElement('div'); ov.id='psWsModal';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(8,12,18,.55);display:flex;align-items:center;justify-content:center;padding:18px;';
  var dark=document.body.classList.contains('fmdark');
  var card=document.createElement('div');
  card.style.cssText='width:100%;max-width:340px;background:'+(dark?'#1A212B':'#fff')+';color:'+(dark?'#E7EBF1':'#16181c')+';border-radius:16px;box-shadow:0 22px 64px rgba(0,0,0,.42);padding:18px;max-height:84vh;display:flex;flex-direction:column;font-family:inherit;box-sizing:border-box;';
  var h='<div style="font-size:15px;font-weight:800;margin-bottom:10px;flex:0 0 auto">'+esc(opts.title||'')+'</div>';
  /* 1.548 — 내용이 길면(충돌 목록 19건 등) 카드가 화면 밖으로 자라 아무것도 못 눌렀다.
     제목·버튼은 고정하고 본문만 스크롤시킨다(노션 QA '동기화 경고 스크롤 안 됨'). */
  if(opts.body)h+='<div id="psWsBody" style="font-size:13px;line-height:1.55;color:'+(dark?'#9AA4B3':'#5c6068')+';margin-bottom:12px;overflow:auto;min-height:0;flex:1 1 auto;-webkit-overflow-scrolling:touch">'+opts.body+'</div>';
  if(opts.input!=null)h+='<input id="psWsIn" type="text" '+(opts.maxlength?('maxlength="'+opts.maxlength+'"'):'')+' placeholder="'+esc(opts.placeholder||'')+'" style="width:100%;box-sizing:border-box;font-size:15px;font-weight:600;padding:11px 13px;border:1.5px solid '+(dark?'#2C3744':'#d2d6dd')+';border-radius:10px;outline:none;background:'+(dark?'#222c39':'#f7f8fa')+';color:inherit;text-transform:'+(opts.upper?'uppercase':'none')+'">';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex:0 0 auto">';
  if(!opts.hideCancel)h+='<button id="psWsX" style="padding:10px 16px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;border:1px solid '+(dark?'#2C3744':'#d2d6dd')+';background:'+(dark?'#222c39':'#f1f3f5')+';color:inherit">'+esc(opts.cancel||'취소')+'</button>';
  h+='<button id="psWsOk" style="padding:10px 20px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;border:0;background:'+(opts.danger?'#d12f38':'var(--blue,#3a6df0)')+';color:#fff">'+esc(opts.ok||'확인')+'</button></div>';
  card.innerHTML=h; ov.appendChild(card); document.body.appendChild(ov);
  function close(silent){ try{ov.remove();}catch(_){} if(!silent && opts.onCancel){ var f=opts.onCancel; opts.onCancel=null; f(); } }
  var inp=card.querySelector('#psWsIn');
  if(inp&&opts.input)inp.value=String(opts.input);
  function ok(){ var v=inp?(inp.value||'').trim():true; close(true); if(opts.onOk)opts.onOk(v); }
  var okb=card.querySelector('#psWsOk'); if(okb)okb.onclick=ok;
  var xb=card.querySelector('#psWsX'); if(xb)xb.onclick=function(){close();};
  ov.addEventListener('click',function(e){ if(e.target===ov)close(); });
  if(inp){ inp.addEventListener('keydown',function(e){ if(e.key==='Enter')ok(); if(e.key==='Escape')close(); }); setTimeout(function(){try{inp.focus();}catch(_){}},40); }
  return {close:close};
}
function uiCreateTeam(){
  psModal({title:'새 팀 워크스페이스', body:'팀 이름을 정하면 그 팀 전용 보관함·일정·팀명단이 만들어집니다.', input:'', placeholder:'예: FC 프로세스 U12', maxlength:30, ok:'다음', onOk:function(v){
    if(!v)return;
    var go=function(){ var mm=psModal({title:'만드는 중…',body:'잠시만요',hideCancel:true,ok:' '});
      createTeam(v).then(function(){}).catch(function(){ mm.close(); psModal({title:'실패',body:'팀 생성에 실패했어요. 네트워크를 확인해주세요.',hideCancel:true,ok:'확인'}); }); };
    if(getDisplayName()){ go(); }
    else{ psModal({title:'표시 이름', body:'팀에서 <b>만든 사람</b>으로 표시될 이름을 입력하세요.', input:'', placeholder:'예: 김철수 코치', maxlength:20, ok:'팀 만들기', onOk:function(nm){ if(nm)setDisplayName(nm); go(); }}); }
  }});
}
/* 1.533 — 팀에서는 이름이 필수다. 이메일이 없는 팀원이 많아(501명 중 336명) 이름이 없으면
   서로 누가 누군지 알 수 없다. 팀 공간에 있는데 이름이 비어 있으면 채울 때까지 묻는다. */
/* 1.533 — 권한 관리·팀원 목록에서 이름과 이메일을 함께 보여준다.
   이름을 주인공으로(굵게), 이메일은 아래 줄에 옅게. 이름이 없으면 그 사실을 표시해
   관리자가 "이 사람 이름 좀 넣어 달라"고 말할 수 있게 한다. */
function memberLabel(r,dark){
  var nm=String((r&&r.name)||'').trim(), em=String((r&&r.email)||'').trim();
  var uid=String((r&&r.user_id)||'');
  var dim=dark?'#9AA4B3':'#8a8f98';
  var main=nm||em||(uid.slice(0,8)+'…');
  var sub =nm?em:'';
  return '<span style="flex:1;min-width:0">'
    +'<span style="display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(main)+'</span>'
    +(sub?('<span style="display:block;font-size:11px;color:'+dim+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(sub)+'</span>')
         :(nm?'':'<span style="display:block;font-size:11px;font-weight:700;color:#c9772b">⚠ 이름 없음 — 본인이 앱에서 이름을 입력하면 표시됩니다</span>'))
    +'</span>';
}
var _dnAsking=false,_dnAskAt=0,_dnDone=false;
var _dnHydratePromise=null,_dnHydrateKey='',_dnHydrateRetryKey='',_dnHydrateRetryAt=0;
/* 1.657 — 이름은 기기(DNKEY)와 서버(ps_members.name)에 함께 저장된다. 계정 보호를 위해
   다른 계정이 이 기기를 열면 DNKEY를 지우는 것이 맞지만, 예전에는 로그인 뒤 서버 이름을
   다시 채우지 않아 iPad·새 브라우저마다 이미 정한 이름을 또 물었다.
   현재 uid의 행만 읽고, 요청 도중 계정/워크스페이스가 바뀌지 않았는지 다시 확인한 뒤 복원한다. */
function restoreDisplayNameFromServer(){
  var local=getDisplayName();
  if(local)return Promise.resolve({name:local,known:true,stored:true});
  var s=getSess(),wid=activeWs();
  if(!s||!s.uid||!wid||!isTeamWs()||!dataUnlocked())return Promise.resolve({name:'',known:false,stale:true});
  var uid=String(s.uid),key=uid+'|'+String(wid);
  if(_dnHydratePromise&&_dnHydrateKey===key)return _dnHydratePromise;
  var read=membersOf(wid).then(function(rows){
    var now=getSess();
    if(!now||String(now.uid)!==uid||String(activeWs())!==String(wid)||!isTeamWs()||!dataUnlocked()){
      return {name:'',known:false,stale:true};
    }
    var mine=null;
    (rows||[]).some(function(r){
      if(r&&String(r.user_id)===uid){ mine=r; return true; }
      return false;
    });
    var nm=String((mine&&mine.name)||'').trim().slice(0,20);
    if(!nm)return {name:'',known:true,stored:false};
    return {name:nm,known:true,stored:writeDisplayNameLocal(nm)};
  });
  var done=read.then(function(result){
    if(_dnHydratePromise===done)_dnHydratePromise=null;
    return result;
  },function(){
    if(_dnHydratePromise===done)_dnHydratePromise=null;
    return {name:'',known:false,error:true};
  });
  _dnHydrateKey=key;_dnHydratePromise=done;
  return done;
}
/* 1.583 — '이 세션에서는 더 묻지 않는다' 플래그(_dnDone).
   renderUI() 는 수시로 불리고 그때마다 이 검사를 예약한다. 예전에는 종료 조건이
   "이름이 저장됐다" 하나뿐이라, 저장이 실패하거나 사용자가 배경을 눌러 닫으면
   30초 뒤 같은 모달이 또 떴다 — 작업 중에 계속 앞을 가로막았다.
   이제 ① 저장 성공 ② 사용자가 '나중에' 로 미룸 — 둘 다 이 세션의 종료 조건이다. */
function ensureDisplayName(){
  try{
    if(_dnDone)return;
    var s=getSess(),wid=activeWs();
    if(!s||!s.uid||!isTeamWs()||!dataUnlocked())return;
    if(getDisplayName())return;
    if(_dnAsking&&Date.now()-_dnAskAt<30000)return;
    var key=String(s.uid)+'|'+String(wid);
    if(_dnHydratePromise&&_dnHydrateKey===key)return;
    if(_dnHydrateRetryKey===key&&Date.now()<_dnHydrateRetryAt)return;
    restoreDisplayNameFromServer().then(function(restored){
      if(getDisplayName()){
        _dnDone=true;
        try{ renderUI(); }catch(_){}
        return;
      }
      /* 서버에 이름이 있는 것은 확인됐지만 이 기기 저장소만 쓸 수 없는 경우에도
         같은 이름 입력창을 다시 띄우지 않는다. 다음 부팅 때 서버에서 다시 복원한다. */
      if(restored&&restored.name){ _dnDone=true; return; }
      if(!restored||!restored.known){
        _dnHydrateRetryKey=key;_dnHydrateRetryAt=Date.now()+30000;
        return;                         /* 네트워크 실패를 '이름 없음'으로 오판하지 않는다 */
      }
      var now=getSess();
      if(!now||String(now.uid)!==String(s.uid)||String(activeWs())!==String(wid)||!isTeamWs()||!dataUnlocked())return;
      _dnAsking=true;_dnAskAt=Date.now();
      (function ask(msg){
      psModal({title:'팀에서 쓸 이름',
        body:(msg?'<div style="margin-bottom:8px;color:#d12f38;font-weight:800">'+esc(msg)+'</div>':'')
          +'팀원 목록·작전판·보관함에 <b>이 이름</b>으로 표시됩니다.<br>이메일이 없는 팀원도 서로 알아볼 수 있게 이름은 꼭 필요합니다.',
        input:getDisplayName(),placeholder:'예: 김민준 또는 minjun10',maxlength:20,
        cancel:'나중에',ok:'저장',
        /* 닫기를 막지 않는다(hideCancel 제거) — 이름이 없어도 앱은 돌아가고,
           못 닫는 창은 저장이 실패할 때 그대로 덫이 된다. */
        onCancel:function(){ _dnAsking=false; _dnDone=true; },
        onOk:function(nm){
          nm=String(nm||'').trim();
          if(nm.length<2){ ask('이름 또는 아이디를 2자 이상 입력해 주세요.'); return; }
          if(!setDisplayName(nm)){
            /* 저장 자체가 실패했다. 같은 질문을 또 하면 사용자는 무한히 같은 걸 입력하게 된다 —
               왜 안 되는지와 무엇을 해야 하는지를 말하고 멈춘다. */
            _dnAsking=false; _dnDone=true;
            psModal({title:'이름을 저장하지 못했어요',
              body:'브라우저 저장 공간이 가득 차서 이 기기에 이름을 쓸 수 없습니다.<br><br>'
                +'설정 → <b>저장 공간</b>의 <b>안전 정리</b>를 눌러 공간을 확보한 뒤 다시 시도해 주세요.'
                +'<br>(정리해도 안 되면 설정에서 <b>내보내기</b>로 백업 후 브라우저 저장소를 비워 주세요.)',
              hideCancel:true,ok:'확인'});
            return;
          }
          _dnAsking=false; _dnDone=true;
          try{ toast&&toast('이름 저장됨 ✓'); }catch(_){}
          try{ renderUI(); }catch(_){}
        }});
      })('');
    }).catch(function(){ _dnAsking=false; });
  }catch(_){ _dnAsking=false; }
}
function uiJoin(){
  function askName(message,value){
    var body=(message?'<div style="margin-bottom:8px;color:#d12f38;font-weight:800">'+esc(message)+'</div>':'')
      +'팀에서 구분할 수 있는 <b>이름 또는 아이디</b>를 입력하세요. 합류하면 기본적으로 <b>선수</b> 역할이 적용됩니다.';
    psModal({title:'팀 합류 — 이름 또는 아이디',body:body,input:value||getDisplayName(),placeholder:'예: 김민준 또는 minjun10',maxlength:20,ok:'다음',onOk:function(nm){
      nm=String(nm||'').trim();
      if(nm.length<2){ askName('이름 또는 아이디를 2자 이상 입력해 주세요.',nm); return; }
      setDisplayName(nm);
      askCode();
    }});
  }
  function askCode(message){
    var body=(message?'<div style="margin-bottom:8px;color:#d12f38;font-weight:800">'+esc(message)+'</div>':'')
      +'팀 관리자에게 받은 8자리 코드를 입력하세요. 역할 변경이 필요하면 합류 후 관리자가 설정합니다.';
    psModal({title:'초대 코드로 합류',body:body,input:'',placeholder:'예: A1B2C3D4',maxlength:12,upper:true,ok:'선수로 합류',onOk:function(v){
      v=String(v||'').trim().toUpperCase();
      if(!v){ askCode('초대 코드를 입력해 주세요.'); return; }
      var mm=psModal({title:'합류 중…',body:'잠시만요',hideCancel:true,ok:' '});
      joinTeam(v).catch(function(e){ mm.close(); psModal({title:'합류 실패',body:'코드가 올바르지 않거나 만료됐어요.',hideCancel:true,ok:'확인'}); });
    }});
  }
  askName('',getDisplayName());
}
/* 변경 기록(감사 로그) — 소유자만. 서버 ps_audit(메타만: 누가·어떤 키·언제·무슨 동작) 최근 200건 */
function uiAudit(wa){
  var s=getSess(); if(!s)return;
  var mm=psModal({title:'변경 기록 불러오는 중…',body:'잠시만요',hideCancel:true,ok:' '});
  Promise.all([
    fetch(BASE+'/rest/v1/ps_audit?workspace_id=eq.'+encodeURIComponent(wa.id)+'&order=at.desc&limit=200&select=at,user_id,k,action',{headers:hj(s.at)})
      .then(function(r){ return r.ok?r.json():Promise.reject(r.status); }),
    membersOf(wa.id).catch(function(){ return []; })
  ]).then(function(res){
    mm.close();
    var rows=res[0]||[], em={}; (res[1]||[]).forEach(function(m2){ em[m2.user_id]=(m2.email||'').split('@')[0]||String(m2.user_id).slice(0,6); });
    if(!rows.length){ psModal({title:'변경 기록',body:'아직 기록이 없어요 — 이제부터의 변경이 기록됩니다.',hideCancel:true,ok:'확인'}); return; }
    var AC={insert:'생성',update:'수정','delete':'삭제'};
    var h='<div style="max-height:340px;overflow:auto;font-size:12px;line-height:1.5">';
    rows.forEach(function(r2){
      var d=new Date(r2.at);
      h+='<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line,#e3e5e9)">'
        +'<span style="flex:0 0 78px;color:var(--dim,#8a8f98)">'+(d.getMonth()+1)+'/'+d.getDate()+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+'</span>'
        +'<b style="flex:0 0 auto;max-width:90px;overflow:hidden;text-overflow:ellipsis">'+esc(em[r2.user_id]||'?')+'</b>'
        +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc(keyLabel(r2.k))+'</span>'
        +'<span style="flex:0 0 auto;color:var(--dim,#8a8f98)">'+(AC[r2.action]||r2.action)+'</span></div>';
    });
    h+='</div><div style="margin-top:8px;font-size:11px;color:var(--dim,#8a8f98)">내용(v)은 기록하지 않습니다 — 누가·무엇을·언제만 90일 보관</div>';
    psModal({title:'변경 기록 · 최근 '+rows.length+'건',body:h,hideCancel:true,ok:'닫기'});
  }).catch(function(){ mm.close(); psModal({title:'변경 기록',body:'기록을 불러오지 못했어요 — 서버에 감사 로그가 아직 설치되지 않았을 수 있어요.',hideCancel:true,ok:'확인'}); });
}
function uiInvite(wid){
  var mm=psModal({title:'선수 초대 코드 불러오는 중…',body:'합류한 팀원은 기본적으로 선수로 시작합니다.',hideCancel:true,ok:' '});
  createRoleInvite(wid,'player').then(function(code){
    mm.close();
    showInvite(wid,code,'player');
  }).catch(function(){
    mm.close();
    psModal({title:'선수 초대 설정 필요',body:'배포 파일의 <b>supabase-player-invites.sql</b>을 Supabase SQL Editor에서 한 번 실행해주세요.',hideCancel:true,ok:'확인'});
  });
}
/* 1.528 — 코드만 복사하면 받는 사람이 "이걸 어디에 넣지?"에서 막힌다.
   그래서 카톡에 그대로 붙여넣을 수 있는 안내 문구를 함께 만든다.
   ① 초대 메시지 복사(설명+주소+코드) ② 코드만 복사 ③ 공유하기(폰·아이패드) 세 갈래. */
function psCopy(text){
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text); return true; } }catch(_){}
  try{
    var ta=document.createElement('textarea'); ta.value=text;
    ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    var ok=document.execCommand('copy'); ta.remove(); return !!ok;
  }catch(_){ return false; }
}
function psCopied(what){
  try{ if(window.toast){ toast(what+' 복사됨 ✓'); return; } }catch(_){}
  try{ psModal({title:what+'를 복사했습니다',body:'카카오톡에 붙여넣기 하세요.',hideCancel:true,ok:'확인'}); }catch(_){}
}
/* 받침에 따라 '로/으로' — '선수으로'처럼 어색하게 나가지 않도록 */
function josaRo(w){
  w=String(w||''); if(!w) return '로';
  var c=w.charCodeAt(w.length-1);
  if(c<0xAC00||c>0xD7A3) return '로';
  var jong=(c-0xAC00)%28;
  return (jong===0||jong===8)?'로':'으로';
}
function inviteMessage(wid,code,roleName){
  var w=null; try{ w=wsList().filter(function(x){return x.id===wid;})[0]||null; }catch(_){}
  var team=(w&&w.name)?w.name:'우리 팀';
  var url=''; try{ url=location.origin; }catch(_){}
  if(!/^https?:/.test(url)) url='https://processstudio.netlify.app';
  return team+' · PROCESS STUDIO 초대\n'
    +'\n'
    +'아래 순서로 합류해 주세요.\n'
    +'\n'
    +'1. 앱 열기 → '+url+'\n'
    +'2. 카카오로 로그인\n'
    +'3. 팀에서 보일 이름을 먼저 입력\n'
    +'4. 오른쪽 위 계정 → "코드로 합류"\n'
    +'5. 초대 코드 입력 → '+code+'\n'
    +'\n'
    +'초대 코드: '+code+'\n'
    +'(코드는 30일간 사용할 수 있어요. '+roleName+josaRo(roleName)+' 합류합니다.)';
}
function showInvite(wid,code,role){
  role=role==='executive'?'executive':(role==='staff'?'staff':'player');
  var roleName=role==='player'?'선수':(role==='executive'?'임원':'코칭스태프');
  var msg=inviteMessage(wid,code,roleName);
  var canShare=false; try{ canShare=!!(navigator.share); }catch(_){}
  var body='<b>'+roleName+' 합류 코드</b>입니다. 30일간 유지되며, 이 코드로 들어온 팀원은 모두 <b>선수</b>로 시작합니다. 코칭스태프·임원 변경은 합류 후 <b>권한 관리</b>에서 할 수 있습니다.'
    +'<div class="ap-code" style="margin-top:10px">'+esc(code)+'</div>'
    +'<div style="margin-top:12px;font-size:11px;font-weight:800;color:var(--dim,#8a8f98)">카카오톡에 보낼 문구</div>'
    +'<div style="margin-top:5px;max-height:132px;overflow:auto;padding:9px 11px;border:1px solid var(--line,#d2d6dd);border-radius:10px;'
    +'font-size:11px;line-height:1.6;white-space:pre-wrap;color:var(--dim,#8a8f98)">'+esc(msg)+'</div>'
    +'<div style="display:flex;gap:6px;margin-top:9px">'
    +'<button id="psInvCode" style="flex:1;padding:9px 0;border:1px solid var(--line,#d2d6dd);background:transparent;color:inherit;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">코드만 복사</button>'
    +(canShare?'<button id="psInvShare" style="flex:1;padding:9px 0;border:1px solid var(--line,#d2d6dd);background:transparent;color:inherit;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">공유하기</button>':'')
    +'</div>'
    +'<button id="psInvRegen" style="margin-top:6px;width:100%;padding:9px 0;border:1px solid var(--line,#d2d6dd);background:transparent;color:var(--dim,#8a8f98);border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">🔄 코드 바꾸기 (기존 코드 무효화)</button>';
  psModal({title:roleName+' 초대 코드', body:body, ok:'초대 메시지 복사', cancel:'닫기',
    onOk:function(){ if(psCopy(msg))psCopied('초대 메시지'); } });
  setTimeout(function(){
    var cb=document.getElementById('psInvCode');
    if(cb)cb.onclick=function(){ if(psCopy(code))psCopied('초대 코드'); };
    var sb=document.getElementById('psInvShare');
    if(sb)sb.onclick=function(){ try{ navigator.share({title:'PROCESS STUDIO 초대',text:msg}); }catch(_){} };
  },0);
  setTimeout(function(){
    var btn=document.getElementById('psInvRegen'); if(!btn)return;
    btn.onclick=function(){
      psModal({title:roleName+' 코드를 바꿀까요?', body:'기존 '+roleName+' 코드는 즉시 <b>무효화</b>됩니다.', ok:'새 코드 생성', cancel:'취소', danger:true,
        onOk:function(){
          var mm=psModal({title:'새 코드 생성 중…',body:'잠시만요',hideCancel:true,ok:' '});
          regenRoleInvite(wid,role).then(function(nc){ mm.close(); showInvite(wid,nc,role); })
          .catch(function(){ mm.close(); psModal({title:'실패',body:'코드 변경에 실패했어요.',hideCancel:true,ok:'확인'}); });
        },
        onCancel:function(){ showInvite(wid,code,role); }
      });
    };
  },50);
}
function removeMember(wid,uid){
  /* 2.669 — RLS(mem_del: 본인 또는 ps_is_owner)는 권한이 없으면 오류가 아니라 «0건 삭제»로 조용히 지나간다. 지운 행을 돌려받아 확인한다(실측 정책: mem_del · DELETE · user_id=auth.uid() OR ps_is_owner) */
  return ensureToken().then(function(at){
    var h=hj(at); h['Prefer']='return=representation';
    return syncFetch('member_remove',BASE+'/rest/v1/ps_members?workspace_id=eq.'+encodeURIComponent(wid)+'&user_id=eq.'+encodeURIComponent(uid)+'&select=user_id',
      {method:'DELETE',headers:h}).then(function(r){ if(!r.ok)throw new Error('remove '+r.status); return r.json().catch(function(){ return []; }); })
      .then(function(rows){ if(!rows||!rows.length)throw new Error('팀원 내보내기는 팀을 만든 사람만 할 수 있어요'); return true; });
  });
}
/* 2.669 — 전환 백업(ps_ws_stash_*)은 7일 지나면 지운다. 퇴단한 사람 기기에 팀 자료 사본이 무기한 남던 것(유소년 개인정보 실측 ②). */
function expireStashes(days){
  var lim=Date.now()-(days||7)*864e5, n=0;
  function old(raw){ try{ var v=JSON.parse(raw||'null'); return !!(v&&v.at&&+v.at<lim); }catch(_){ return false; } }
  try{ for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(k&&k.indexOf('ps_ws_stash_')===0&&old(localStorage.getItem(k))){ localStorage.removeItem(k); n++; } } }catch(_){}
  var idb=(window.storage&&window.storage.keys)?window.storage.keys('ps_ws_stash_').then(function(keys){
    return Promise.all(keys.map(function(k){ return window.storage.get(k).then(function(r){ if(r&&old(r.value)){ n++; return window.storage.del?window.storage.del(k):(window.storage.remove?window.storage.remove(k):null); } }).catch(function(){}); }));
  }).catch(function(){}):Promise.resolve();
  return idb.then(function(){ if(n){ try{ syncDiagnostic('stash-expired',new Error(String(n))); }catch(_){} } return n; });
}
/* ── 팀원 관리(1.513) — 코드로 합류한 사람을 여기서 다 본다: 이름·이메일, 역할, 내보내기.
   역할은 cs_perms_v1(동기화 키)에, 팀 소속 자체는 서버 ps_members에 있다. 둘을 한 화면에서 다룬다. */
function uiMembers(wa){
  var mm=psModal({title:'팀원 불러오는 중…',body:'잠시만요',hideCancel:true,ok:' '});
  membersOf(wa.id).then(function(rows){ mm.close();
    rows=rows||[];
    var P=window.PSPerms;
    var cur=(P&&P.get&&P.get())||{v:1,defaultRole:'player',members:{}};
    if(!cur.members)cur.members={};
    var ROLES=(P&&P.ROLES)||[{id:'executive',label:'임원'},{id:'staff',label:'코칭스태프'},{id:'player',label:'선수'}];
    var me=(getSess()||{}).uid||'';
    var iAmOwner=false; try{ iAmOwner=!!(activeWsObj()&&activeWsObj().role==='owner'); }catch(_){}
    var dark=document.body.classList.contains('fmdark');
    try{ var ex=document.getElementById('psMemOv'); if(ex)ex.remove(); }catch(_){}
    var ov=document.createElement('div'); ov.id='psMemOv';
    ov.style.cssText='position:fixed;inset:0;z-index:9200;background:rgba(8,12,18,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';
    var card=document.createElement('div');
    card.style.cssText='width:100%;max-width:560px;max-height:86dvh;overflow-y:auto;background:'+(dark?'#1A212B':'#fff')+';color:'+(dark?'#E7EBF1':'#16181c')+';border-radius:16px;box-shadow:0 22px 64px rgba(0,0,0,.42);padding:18px;box-sizing:border-box;';
    var line=dark?'#2C3744':'#E3E5E9', dim=dark?'#9AA4B3':'#5c6068';
    card.innerHTML='<div style="font-size:16px;font-weight:800">'+esc(wa.name||'팀')+' 팀원 '+rows.length+'명</div>'
      +'<div style="font-size:12px;line-height:1.55;color:'+dim+';margin:4px 0 14px">코드로 합류한 사람들입니다. 역할은 팀 설정 › 권한에서 바꾸고, 여기서는 보기만 합니다.</div>';   /* 1.987 — 팀원 보기에서 권한 변경 제거(사용자) */
    var isMail=function(v){ return /@/.test(String(v||'')); };
    var changed={};
    /* 1.558 — 역할별로 묶어서 보여준다(사용자 지시). 32명이 한 덩어리로 늘어서면
       누가 코칭스태프인지 한 줄씩 읽어야 했다. 순서: 관리자 → 임원 → 코칭스태프 → 선수. */
    var roleOf=function(r){
      if(r.role==='owner') return 'owner';
      var m=cur.members[r.user_id];
      return (m&&m.role)||cur.defaultRole||'player';
    };
    var ORDER=[['owner','관리자'],['executive','임원'],['staff','코칭스태프'],['player','선수']];
    var ORD={}; ORDER.forEach(function(x,i){ ORD[x[0]]=i; });
    rows=rows.slice().sort(function(a,b){
      var d=(ORD[roleOf(a)]==null?9:ORD[roleOf(a)])-(ORD[roleOf(b)]==null?9:ORD[roleOf(b)]);
      if(d)return d;
      return String(a.name||a.email||'').localeCompare(String(b.name||b.email||''),'ko');
    });
    var lastGrp=null;
    rows.forEach(function(r){
      /* 역할이 바뀌는 지점에 머리글 한 줄 */
      var _rk=roleOf(r);
      if(_rk!==lastGrp){
        lastGrp=_rk;
        var _lbl=(ORDER.filter(function(x){return x[0]===_rk;})[0]||[null,_rk])[1];
        var _n=rows.filter(function(q){ return roleOf(q)===_rk; }).length;
        var h=document.createElement('div');
        h.style.cssText='display:flex;align-items:center;gap:7px;margin:14px 2px 7px;font-size:11px;font-weight:800;color:'+dim;
        h.innerHTML='<span style="color:'+(dark?'#E7EBF1':'#16181c')+'">'+esc(_lbl)+'</span><span style="opacity:.75">'+_n+'명</span>'
          +'<span style="flex:1;height:1px;background:'+line+'"></span>';
        card.appendChild(h);
      }
      var uid=r.user_id, owner=(r.role==='owner');
      var nm,mail;
      if(r.name!==undefined||r.email!==undefined&&r.name!==undefined){ nm=String(r.name||''); mail=String(r.email||''); }
      var label=String(r.email||'');
      if(nm===undefined){ nm=isMail(label)?'':label; mail=isMail(label)?label:''; }
      if(!nm&&!isMail(label))nm=label;
      if(!mail&&isMail(label))mail=label;
      var role=owner?'owner':((cur.members[uid]&&cur.members[uid].role)||cur.defaultRole||'player');
      var d=document.createElement('div');
      d.style.cssText='display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid '+line+';border-radius:12px;margin-bottom:8px;'+(owner?('background:'+(dark?'#222c39':'#F7F8FA')+';'):'');
      var who=document.createElement('div'); who.style.cssText='flex:1;min-width:0';
      who.innerHTML='<div style="font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(nm||mail||uid.slice(0,8))+'</div>'
        +'<div style="font-size:11px;color:'+dim+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(nm?(mail||'이메일 미확인'):(mail?'':'이름 미입력'))+(r.joined_at?' · '+String(r.joined_at).slice(0,10)+' 합류':'')+'</div>';
      d.appendChild(who);
      if(owner){
        var ob=document.createElement('span'); ob.style.cssText='font-size:11px;font-weight:800;color:var(--blue,#3a6df0);flex:0 0 auto'; ob.textContent='관리자';
        d.appendChild(ob);
      } else {
        /* 1.987 — 역할은 읽기 전용 라벨(사용자 "팀원 보기인데 권한 바꿀 수 없게"). 변경은 팀 설정 › 권한에서 */
        var sel=document.createElement('span');
        sel.style.cssText='height:28px;display:inline-flex;align-items:center;flex:0 0 auto;padding:0 10px;border-radius:999px;background:'+(dark?'#222c39':'#f1f2f4')+';color:'+(dark?'#E7EBF1':'#16181c')+';font-family:inherit;font-weight:800;font-size:12px;';
        sel.textContent=(ROLES.filter(function(ro){return ro.id===role;})[0]||{label:role}).label;
        d.appendChild(sel);
        if(iAmOwner&&uid!==me){
          var rm=document.createElement('button'); rm.type='button'; rm.textContent='내보내기';
          rm.style.cssText='height:32px;flex:0 0 auto;border:1px solid rgba(194,74,70,.38);background:rgba(194,74,70,.08);color:#C24A46;border-radius:8px;font-family:inherit;font-weight:700;font-size:12px;padding:0 10px;cursor:pointer;';
          rm.onclick=function(){
            var who2=nm||mail||uid.slice(0,8);
            /* 2.612 — 네이티브 confirm 은 설치형 PWA 에서 막혀 false 만 돌려줬다(1.847 과 같은 함정) → 버튼이 아무 말 없이 죽어 있었다(사용자 "내보내기 하면 내보내게 해줘"). askConfirm(psConfirm) 으로. */
            askConfirm(who2+' 님을 팀에서 내보낼까요?\n\n· 그 사람 기기에서 팀 자료가 정리됩니다\n· 팀이 만든 자료는 서버에 그대로 남습니다\n· 다시 부르려면 초대 코드를 새로 주면 됩니다').then(function(ok){
              if(!ok)return;
              rm.disabled=true; rm.textContent='내보내는 중…';
              removeMember(wa.id,uid).then(function(){
                try{ if(cur.members[uid]){ delete cur.members[uid]; P&&P.set&&P.set(cur); syncNow('member-remove'); } }catch(_){}
                d.remove();
                try{ chip(who2+' 님을 내보냈어요'); }catch(_){}
              }).catch(function(e){ rm.disabled=false; rm.textContent='내보내기'; try{ syncDiagnostic('member-remove',e); }catch(_){} try{ chip('내보내지 못했어요 — 잠시 후 다시 시도해 주세요'); }catch(_){ alert('내보내지 못했어요 — 잠시 후 다시 시도해 주세요'); } });
            });
          };
          d.appendChild(rm);
        }
      }
      card.appendChild(d);
    });
    var foot=document.createElement('div'); foot.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:14px;';
    var close=document.createElement('button'); close.type='button'; close.textContent='닫기';
    close.style.cssText='height:38px;padding:0 14px;border:1px solid '+line+';background:transparent;color:inherit;border-radius:10px;font-family:inherit;font-weight:700;cursor:pointer;';
    close.onclick=function(){ ov.remove(); };
    foot.appendChild(close);
    if(false&&iAmOwner){   /* 1.987 — 역할 저장 버튼 제거(읽기 전용) */
      var save=document.createElement('button'); save.type='button'; save.textContent='역할 저장';
      save.style.cssText='height:38px;padding:0 16px;border:0;background:var(--blue,#3a6df0);color:#fff;border-radius:10px;font-family:inherit;font-weight:800;cursor:pointer;';
      save.onclick=function(){
        Object.keys(changed).forEach(function(uid){
          cur.members[uid]=cur.members[uid]||{}; cur.members[uid].role=changed[uid];
        });
        try{ P&&P.set&&P.set(cur); }catch(_){}
        syncNow('member-roles');
        save.textContent='저장됨 ✓'; setTimeout(function(){ ov.remove(); },600);
      };
      foot.appendChild(save);
    }
    card.appendChild(foot);
    ov.appendChild(card); document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov)ov.remove(); });
  }).catch(function(){ mm.close(); });
}
/* ── 권한 관리(관리자 전용) — 멤버별 역할·구역 편집 → cs_perms_v1 저장 ── */
var permsOnlyUnlinked=false;   /* 1.534 — '연결 안 된 사람만 보기' 토글 상태 */
function uiPerms(wa){
  var P=window.PSPerms;
  if(!P){ psModal({title:'권한 관리',body:'권한 모듈을 불러오지 못했어요. 새로고침 후 다시 시도하세요.',hideCancel:true,ok:'확인'}); return; }
  var mm=psModal({title:'팀원 불러오는 중…',body:'잠시만요',hideCancel:true,ok:' '});
  membersOf(wa.id).then(function(rows){ mm.close();
    rows=rows||[];
    var cur=P.get()||{v:1,defaultRole:'player',members:{}};
    if(!cur.members)cur.members={};
    var dark=document.body.classList.contains('fmdark');
    try{ var ex=document.getElementById('psPermsOv'); if(ex)ex.remove(); }catch(_){}
    var ov=document.createElement('div'); ov.id='psPermsOv';
    ov.style.cssText='position:fixed;inset:0;z-index:9200;background:rgba(8,12,18,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';
    var card=document.createElement('div');
    card.style.cssText='width:100%;max-width:520px;max-height:86dvh;overflow-y:auto;background:'+(dark?'#1A212B':'#fff')+';color:'+(dark?'#E7EBF1':'#16181c')+';border-radius:16px;box-shadow:0 22px 64px rgba(0,0,0,.42);padding:18px;box-sizing:border-box;';
    var secs=P.SECTIONS, roles=P.ROLES;
    var head='<div style="font-size:16px;font-weight:800;margin-bottom:4px">권한 관리</div>'
      +'<div style="font-size:12px;line-height:1.55;color:'+(dark?'#9AA4B3':'#5c6068')+';margin-bottom:14px">멤버별로 <b>역할</b>과 <b>편집 가능한 구역</b>을 정하세요. 임원=전체 · 코칭스태프=스카우트 제외 · 선수=본인 IDP와 팀 일정 열람.</div>';
    card.innerHTML=head;
    /* 새로 합류하는 팀원의 기본 역할은 선수로 고정 — 관리자는 합류 후 개별 역할만 변경 */
    var defWrap=document.createElement('div');
    defWrap.style.cssText='display:flex;align-items:center;gap:9px;padding:11px 12px;margin-bottom:12px;border:1px dashed '+(dark?'#2C3744':'#d2d6dd')+';border-radius:11px;';
    defWrap.innerHTML='<span style="flex:1;font-size:13px;font-weight:700">새로 합류하는 팀원</span>'
      +'<span style="height:30px;padding:0 10px;display:inline-flex;align-items:center;border-radius:8px;background:'+(dark?'#222c39':'#eef3ff')+';color:'+(dark?'#9fbbff':'#2757d9')+';font-size:12px;font-weight:800">선수로 합류</span>';
    card.appendChild(defWrap);
    /* ── 1.634 · 코칭스태프 편집 스위치 ────────────────────────────────────────
       기본은 **보기 전용**이다(임원이 전부 입력하고 나머지는 본다).
       아래 사람별 체크는 이 스위치보다 앞선다 — 특정 코치에게만 열어 줄 수 있다. */
    var seWrap=document.createElement('div');
    seWrap.style.cssText='display:flex;align-items:center;gap:10px;padding:11px 12px;margin-bottom:12px;border:1px solid '+(dark?'#2C3744':'#E3E5E9')+';border-radius:11px;background:'+(dark?'#222c39':'#F7F8FA')+';';
    var seOn=false; try{ seOn=!!(P.staffEditOpen&&P.staffEditOpen()); }catch(_){}
    var seTxt=document.createElement('div'); seTxt.style.cssText='flex:1;min-width:0';
    var seBtn=document.createElement('button'); seBtn.type='button';
    function sePaint(){
      seTxt.innerHTML='<div style="font-size:13px;font-weight:700">코칭스태프도 팀 자료를 편집</div>'
        +'<div style="font-size:11px;line-height:1.5;margin-top:2px;color:'+(dark?'#9AA4B3':'#8a8f98')+'">'
        +(seOn?'켜짐 — 코칭스태프가 선수·경기·게임모델 등을 고칠 수 있습니다.'
              :'꺼짐 — <b>임원만 편집</b>합니다. 코칭스태프는 보기 전용이고, 고칠 곳이 있으면 임원에게 말합니다.')
        +'</div>';
      seBtn.textContent=seOn?'끄기':'켜기';
      seBtn.style.cssText='flex:0 0 auto;height:32px;padding:0 14px;border-radius:9px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;border:1px solid '+(dark?'#2C3744':'#d2d6dd')+';background:'+(seOn?(dark?'#222c39':'#fff'):'var(--blue,#3a6df0)')+';color:'+(seOn?'inherit':'#fff')+';';
    }
    sePaint();
    seBtn.onclick=function(){ seOn=!seOn; sePaint(); };
    seWrap.appendChild(seTxt); seWrap.appendChild(seBtn); card.appendChild(seWrap);
    var editable=rows.filter(function(r){ return r.role!=='owner'; });
    var owners=rows.filter(function(r){ return r.role==='owner'; });
    /* 관리자(owner) — 고정 표기 */
    owners.forEach(function(r){
      var d=document.createElement('div');
      d.style.cssText='padding:10px 12px;border:1px solid '+(dark?'#2C3744':'#E3E5E9')+';border-radius:11px;margin-bottom:8px;display:flex;align-items:center;gap:8px;background:'+(dark?'#222c39':'#F7F8FA')+';';
      d.innerHTML=memberLabel(r,dark)+'<span style="font-size:11px;font-weight:800;color:var(--blue,#3a6df0);flex:0 0 auto">관리자 (전체)</span>';
      card.appendChild(d);
    });
    if(!editable.length){
      var none=document.createElement('div'); none.style.cssText='font-size:13px;color:'+(dark?'#9AA4B3':'#8a8f98')+';padding:8px 2px 4px';
      none.textContent='아직 합류한 팀원이 없어요. 초대 코드로 팀원을 먼저 초대하세요.'; card.appendChild(none);
    }
    var state={};   /* uid -> {role, scopes:{id:bool}} */
    /* 1.534 — 새로 들어온 팀원을 코치가 명단과 이어 주는 자리다.
       연결이 안 된 사람이 목록에 섞여 있으면 못 찾으므로 ①숫자로 알리고 ②맨 위로 올리고 ③거를 수 있게 한다. */
    (function(){
      var notLinked=editable.filter(function(r){ return !((cur.members[r.user_id]||{}).playerId); });
      var sum=document.createElement('div');
      sum.style.cssText='display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:10px 12px;margin-bottom:10px;border-radius:11px;'
        +'background:'+(notLinked.length?(dark?'rgba(201,119,43,.16)':'#FDF6E3'):(dark?'#222c39':'#F1F5FF'))+';'
        +'color:'+(notLinked.length?(dark?'#E5B96A':'#8A6A1F'):(dark?'#9fbbff':'#2757d9'))+';font-size:13px;font-weight:700;';
      sum.innerHTML='<span style="flex:1">합류 '+editable.length+'명 · 선수 연결됨 '+(editable.length-notLinked.length)+' · '
        +(notLinked.length?('<b>연결 안 됨 '+notLinked.length+'</b>'):'모두 연결됨 ✓')+'</span>';
      if(notLinked.length){
        var tg=document.createElement('button'); tg.type='button';
        tg.textContent=permsOnlyUnlinked?'전체 보기':'연결 안 된 사람만';
        tg.style.cssText='flex:0 0 auto;height:28px;padding:0 11px;border:1px solid currentColor;background:transparent;color:inherit;border-radius:8px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;';
        tg.onclick=function(){ permsOnlyUnlinked=!permsOnlyUnlinked; uiPerms(wa); };
        sum.appendChild(tg);
      }
      card.appendChild(sum);
    })();
    /* 1.558 — 역할별로 묶는다: 임원 → 코칭스태프 → 선수(사용자 지시).
       같은 역할 안에서는 예전처럼 '선수 연결 안 된 사람'을 위로 둔다(코치가 할 일이 먼저 보이게). */
    var pRole=function(r){ return (cur.members[r.user_id]&&cur.members[r.user_id].role)||cur.defaultRole||'player'; };
    var PORDER=[['executive','임원'],['staff','코칭스태프'],['player','선수']];
    var PORD={}; PORDER.forEach(function(x,i){ PORD[x[0]]=i; });
    editable.sort(function(a,b){
      var d=(PORD[pRole(a)]==null?9:PORD[pRole(a)])-(PORD[pRole(b)]==null?9:PORD[pRole(b)]);
      if(d)return d;
      var la=((cur.members[a.user_id]||{}).playerId)?1:0, lb=((cur.members[b.user_id]||{}).playerId)?1:0;
      return la-lb;
    });
    if(permsOnlyUnlinked) editable=editable.filter(function(r){ return !((cur.members[r.user_id]||{}).playerId); });
    var pLastGrp=null;
    editable.forEach(function(r){
      var _pk=pRole(r);
      if(_pk!==pLastGrp){
        pLastGrp=_pk;
        var _pl=(PORDER.filter(function(x){return x[0]===_pk;})[0]||[null,_pk])[1];
        var _pn=editable.filter(function(q){ return pRole(q)===_pk; }).length;
        var ph=document.createElement('div');
        /* 이 함수엔 dim 변수가 없다 — 다른 줄과 같은 회색을 직접 쓴다 */
        ph.style.cssText='display:flex;align-items:center;gap:7px;margin:14px 2px 8px;font-size:11px;font-weight:800;color:'+(dark?'#9AA4B3':'#8a8f98');
        ph.innerHTML='<span style="color:'+(dark?'#E7EBF1':'#16181c')+'">'+esc(_pl)+'</span><span style="opacity:.75">'+_pn+'명</span>'
          +'<span style="flex:1;height:1px;background:'+(dark?'#2C3744':'#E3E5E9')+'"></span>';
        card.appendChild(ph);
      }
      var uid=r.user_id;
      var role=(cur.members[uid]&&cur.members[uid].role)||cur.defaultRole||'player';
      var scopes={}; var eff=P.memberScopes(uid);
      secs.forEach(function(s){ scopes[s.id]=eff.indexOf(s.id)>=0; });
      state[uid]={role:role,scopes:scopes,playerId:(cur.members[uid]&&cur.members[uid].playerId)||''};
      var d=document.createElement('div');
      d.style.cssText='padding:12px;border:1px solid '+(dark?'#2C3744':'#E3E5E9')+';border-radius:12px;margin-bottom:9px;';
      var top=document.createElement('div'); top.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:9px;';
      top.innerHTML=memberLabel(r,dark);
      var sel=document.createElement('select');
      sel.style.cssText='height:32px;border:1px solid '+(dark?'#2C3744':'#d2d6dd')+';background:'+(dark?'#222c39':'#f7f8fa')+';color:inherit;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;padding:0 8px;';
      roles.forEach(function(ro){ var o=document.createElement('option'); o.value=ro.id; o.textContent=ro.label; if(ro.id===role)o.selected=true; sel.appendChild(o); });
      top.appendChild(sel); d.appendChild(top);
      /* 선수 연결 — IDP의 '셀프 vs 코치 평가' 비교에 사용 (scout_tool_v1 선수 id) */
      (function(){
        var sp=[]; try{ var sd=JSON.parse(localStorage.getItem('scout_tool_v1')||'null');
          sp=((sd&&sd.players)||[]).filter(function(p){ return p&&p.type!=='target'; }); }catch(_){}
        var lrow=document.createElement('div');
        lrow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:9px;';
        var lb=document.createElement('span'); lb.textContent='선수 연결';
        lb.style.cssText='flex:0 0 auto;font-size:11px;font-weight:700;color:'+(dark?'#9AA4B3':'#8a8f98')+';';
        lrow.appendChild(lb);
        if(!sp.length){
          var hint=document.createElement('span'); hint.textContent='팀 탭에 선수를 등록하면 연결할 수 있어요';
          hint.style.cssText='font-size:11px;color:'+(dark?'#7C8696':'#a5aab3')+';';
          lrow.appendChild(hint);
        }else{
          var lsel=document.createElement('select');
          lsel.style.cssText='flex:1;height:30px;border:1px solid '+(dark?'#2C3744':'#d2d6dd')+';background:'+(dark?'#222c39':'#f7f8fa')+';color:inherit;border-radius:8px;font-family:inherit;font-weight:600;font-size:12px;padding:0 8px;min-width:0;';
          var oh='<option value="">연결 안 함</option>';
          /* 1.534 — 다른 멤버가 이미 가져간 선수는 표시해 둔다. 같은 선수에 두 계정이 붙으면
             IDP 평가가 어느 쪽 것인지 알 수 없어진다. */
          var usedBy={}; Object.keys(state).forEach(function(u2){ var pid=state[u2].playerId; if(pid&&u2!==uid)usedBy[pid]=1; });
          sp.forEach(function(p){
            var dup=!!usedBy[p.id];
            oh+='<option value="'+esc(p.id)+'"'+(state[uid].playerId===p.id?' selected':'')+(dup?' disabled':'')+'>'
              +esc((p.num?p.num+' · ':'')+(p.name||'이름 없음')+(dup?' (다른 계정에 연결됨)':''))+'</option>';
          });
          lsel.innerHTML=oh;
          lsel.onchange=function(){ state[uid].playerId=lsel.value; };
          lrow.appendChild(lsel);
        }
        d.appendChild(lrow);
      })();
      var grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:5px 10px;';
      var boxes={};
      secs.forEach(function(s){
        var lab=document.createElement('label'); lab.style.cssText='display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;';
        var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!state[uid].scopes[s.id]; cb.style.accentColor='#3a6df0';
        cb.onchange=function(){ state[uid].scopes[s.id]=cb.checked; };
        boxes[s.id]=cb;
        lab.appendChild(cb); lab.appendChild(document.createTextNode(s.label)); grid.appendChild(lab);
      });
      d.appendChild(grid);
      /* 관리자는 전 구역 고정(체크 잠금) */
      function lockUI(){
        var all=(state[uid].role==='admin'||state[uid].role==='executive');
        secs.forEach(function(s){ boxes[s.id].disabled=all; });
        grid.style.opacity=all?'.55':'1';
      }
      /* 역할을 '바꿀 때만' 기본 범위로 초기화 — 관리자·스태프=전체, 선수=없음 */
      sel.onchange=function(){
        state[uid].role=sel.value;
        var v=(sel.value==='admin'||sel.value==='executive'||sel.value==='staff');
        secs.forEach(function(s){ var on=v&&!(sel.value==='staff'&&s.id==='scout'); boxes[s.id].checked=on; state[uid].scopes[s.id]=on; });
        lockUI();
      };
      /* 초기 표시는 저장된 범위 그대로 (관리자만 전체 강제) — 열었다 저장해도 권한이 바뀌지 않게 */
      if(role==='admin'||role==='executive') secs.forEach(function(s){ boxes[s.id].checked=true; state[uid].scopes[s.id]=true; });
      lockUI();
      card.appendChild(d);
    });
    var btns=document.createElement('div'); btns.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:8px;position:sticky;bottom:0;padding-top:10px;background:'+(dark?'#1A212B':'#fff')+';';
    var cancel=document.createElement('button'); cancel.textContent='취소';
    cancel.style.cssText='padding:10px 16px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;border:1px solid '+(dark?'#2C3744':'#d2d6dd')+';background:'+(dark?'#222c39':'#f1f3f5')+';color:inherit';
    var save=document.createElement('button'); save.textContent='저장';
    save.style.cssText='padding:10px 20px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;border:0;background:var(--blue,#3a6df0);color:#fff';
    cancel.onclick=function(){ ov.remove(); };
    save.onclick=function(){
      /* 1.619 — 예전에는 여기서 문서를 **통째로 새로 만들었다.**
         그래서 ①이 창의 팀원 목록에 안 뜬 사람(불러오기 실패·탈퇴 처리 지연 등)은 저장할 때마다
         권한이 사라졌고 ②일정·선수단 잠금 토글(schedEdit·rosterEdit)도 매번 초기화됐다.
         이제 지금 문서를 바탕으로 놓고, 이 창에서 다룬 사람만 덮어쓴다. */
      var base={};
      try{ var cur=P.get&&P.get(); if(cur&&typeof cur==='object') base=JSON.parse(JSON.stringify(cur)); }catch(_){ base={}; }
      var out={v:1,defaultRole:base.defaultRole||'player',members:{}};
      Object.keys(base).forEach(function(kk){                 /* schedEdit·rosterEdit 등 보존 */
        if(kk!=='members'&&kk!=='v'&&kk!=='defaultRole') out[kk]=base[kk];
      });
      Object.keys(base.members||{}).forEach(function(u){ out.members[u]=base.members[u]; });
      /* 1.634 — 스위치 상태를 명시적으로 적는다. 끈 상태도 'view' 로 적어 둬야
         "아직 못 정한 팀"과 "임원이 직접 끈 팀"을 구분할 수 있다(아래 소유자 알림이 이걸 본다). */
      out.staffEdit=seOn?'edit':'view';
      Object.keys(state).forEach(function(uid){
        var st=state[uid], sc=[];
        secs.forEach(function(s){ if(st.role==='admin'||st.role==='executive'||st.scopes[s.id])sc.push(s.id); });
        out.members[uid]={role:st.role,scopes:sc};
        if(st.playerId) out.members[uid].playerId=st.playerId;
      });
      P.set(out);
      ov.remove();
      setStatus('권한 저장됨 · 동기화 중…');
      try{ forceSync('perms'); }catch(_){}
    };
    btns.appendChild(cancel); btns.appendChild(save); card.appendChild(btns);
    ov.appendChild(card); document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov)ov.remove(); });
  }).catch(function(){ mm.close(); psModal({title:'실패',body:'팀원을 불러오지 못했어요.',hideCancel:true,ok:'확인'}); });
}
function uiLeave(wa){
  psModal({title:'팀 나가기', body:'<b>'+esc(wa.name)+'</b> 워크스페이스에서 나갑니다. 이 팀의 공유 데이터는 더 이상 보이지 않아요.', ok:'나가기', danger:true, onOk:function(){
    var leaving=(activeWs()===wa.id);   /* 지금 이 팀에 들어와 있으면 나간 뒤 개인 공간으로 전환 필요 */
    setStatus('팀에서 나가는 중…');
    /* 나가기 전, 이 팀에 대한 내 최근 변경을 최대한 서버로 밀어올림(멤버일 때만 쓸 수 있음) — 실패해도 진행 */
    var pre = leaving ? withTimeout(forceSync('preleave'),8000) : Promise.resolve();
    pre.then(function(){ return leaveTeam(wa.id); }).then(function(){
      var wl=wsList().filter(function(w){return w.id!==wa.id;}); setWsList(wl);
      var personal=wl.filter(function(w){return w.kind==='personal';})[0];
      var target=(personal||wl[0]||{}).id;
      if(leaving && target){
        /* 개인(내) 워크스페이스로 전환 — 이미 나간 팀엔 저장 불가하므로 저장 스킵 */
        switchWorkspace(target, true);
      }else{
        try{ renderUI(); }catch(_){}
        setStatus('팀에서 나갔습니다');
      }
    }).catch(function(){ setStatus('나가기 실패 — 네트워크 확인'); });
  }});
}

var _popOpen=false;
function renderUI(){
  try{
    ensureCSS();
    try{ setTimeout(ensureDisplayName,600); }catch(_){}   /* 팀 공간인데 이름이 없으면 물어본다(1.533) */
    var wrap=document.getElementById('psAcctWrap'); if(!wrap) return;
    wrap.style.display='';
    var s=getSess();
    wrap.innerHTML='';
    /* 버튼 */
    var btn=document.createElement('button'); btn.type='button'; btn.className='acct-btn'+(s?' in':'');
    if(s){
      var wa=activeWsObj();
      var wlabel=wa?(wa.kind==='personal'?'내 작업':wa.name):(s.email||'로그인됨');
      var initial=((wlabel||'?').trim().charAt(0)||'?').toUpperCase();
      btn.innerHTML='<span class="ava">'+esc(initial)+'</span><span class="lbl">'+esc(wlabel)+'</span>';
      btn.title='워크스페이스 · 계정';
    }else{
      btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg><span>로그인</span>';
      btn.title='로그인 · 클라우드 동기화';
    }
    wrap.appendChild(btn);
    /* 드롭다운 */
    var pop=document.createElement('div'); pop.className='acct-pop'+(_popOpen?' on':'');
    var hd=document.createElement('div'); hd.className='ap-hd'; hd.textContent='계정'; pop.appendChild(hd);
    /* 1.850 — 팝업 안 버튼을 누르면(권한 관리·팀원·초대 등 모달이 뜨는 것들) 계정 팝업은 먼저 닫는다 — 모달 위에 팝업이 3층으로 남지 않게 */
    function closePop(){ _popOpen=false; try{ pop.classList.remove('on'); }catch(_){} }
    function pb(label,cls,fn,parent){ var b=document.createElement('button'); b.type='button'; b.className='ap-b'+(cls?' '+cls:''); b.textContent=label; b.onclick=function(e){e.stopPropagation();closePop();fn();}; (parent||pop).appendChild(b); return b; }
    if(!s){
      var sub=document.createElement('div'); sub.className='ap-sub';
      sub.style.cssText='font-size:11px;font-weight:600;line-height:1.45;color:#767B85;margin:-2px 2px 8px;';
      sub.textContent='작업은 먼저 내 기기에 저장됩니다. 팀 스페이스에는 공유를 선택한 항목만 올라갑니다.';
      pop.appendChild(sub);
      pb('카카오로 계속','kakao',function(){ signIn('kakao'); });
      pb('Google로 계속','solid',function(){ signIn('google'); });
    }else{
      var dn=getDisplayName();
      var who=document.createElement('div'); who.className='ap-who'; who.textContent=dn||s.email||'로그인됨'; pop.appendChild(who);
      stEl=document.createElement('div'); stEl.className='ap-st';
      var m=meta(),pi2=pendingInfo(activeWs());
      stEl.textContent=(wa&&wa.kind==='team')
        ?'새 작업은 내 기기에 저장 · 공유할 때만 팀에 올라감'
        :navigator.onLine===false
        ?(pi2.count?('오프라인이에요 · 이 기기에 '+pi2.count+'건 안전하게 있어요'):'오프라인이에요 · 이 기기에 저장돼요')
        :(pi2.count?('올리는 중 · '+pi2.count+' — 눌러서 자세히')
          :(m.last?('팀과 같아요 · '+new Date(m.last).toLocaleTimeString()):'아직 맞추기 전'));
      /* 2.257 — 대기가 왜 안 빠지는지 볼 문이 없었다(전환을 영영 막는 원인): 누르면 항목·마지막 오류 + 다시 보내기 */
      if(pi2.count){ stEl.style.cursor='pointer'; stEl.onclick=function(e){ e.stopPropagation(); closePop();
        var wid0=activeWs(),uid0=outboxOwner(),sc0=outboxScope(uid0,wid0);
        outboxRead().then(function(q){
          var rows=(q||[]).filter(function(it){return it&&outboxScope(it.uid,it.wid)===sc0;});
          var body=rows.slice(0,12).map(function(it){
            var lbl=it.key==='@library'?'보관함':keyLabel(it.key);
            /* 2.445 — push 를 해 본 것과 회차가 죽어 못 올라간 것을 구분해 적는다.
               예전엔 둘 다 'kv_meta:sync_network ×5' 로 보여 항목 탓처럼 읽혔다. */
            var er=[it.lastStage,it.lastError].filter(Boolean).join(':')
              ||(it.roundError?('서버에 닿지 못함 · '+[it.roundStage,it.roundError].filter(Boolean).join(':'))
                :((+it.attempts)?'오류 기록 없음':'아직 시도 전'));
            var cnt=(+it.attempts)?(' ×'+it.attempts):((+it.roundFails)?(' · 회차 '+it.roundFails+'회'):'');
            return '<div style="display:flex;gap:8px;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.15);font-size:12px"><b>'+String(lbl).replace(/[<>&]/g,'')+'</b><span style="color:#a05b57">'+String(er).replace(/[<>&]/g,'')+cnt+'</span></div>';
          }).join('')||'<div style="font-size:12px">대기 항목이 없습니다</div>';
          /* 2.445 — 설명문이 원인을 보고 갈린다. 전부 '서버에 닿지 못함'이면 **항목 문제가 아니다** —
             예전 문구("오류가 반복되는 항목이…")는 고칠 항목이 있는 것처럼 읽혀 사용자를 헤매게 했다. */
          var unreach=rows.length&&rows.every(outboxUnreachableOnly);
          var note=unreach
            ?'서버에 닿지 못해 아직 올리지 못했습니다 — <b>항목 문제가 아니라 연결 문제</b>입니다. 자료는 이 기기에 그대로 있습니다.<br>인터넷 연결과 서버 상태를 확인한 뒤 다시 보내 주세요.'
            :'오류가 반복되는 항목이 워크스페이스 전환을 막습니다. [지금 다시 보내기]로 재시도해 보세요.';
          psModal({title:'클라우드 확인 대기 '+rows.length+'건',body:'<div style="max-height:300px;overflow:auto">'+body+'</div><div style="font-size:11px;color:#8a9099;margin-top:8px">'+note+'</div>',ok:'지금 다시 보내기',onOk:function(){ setStatus('다시 보내는 중…');
            forceSync('manual-drain').then(function(r){
              var pi3=pendingInfo(activeWs());
              /* 2.445 — 왜 실패했는지 말한다. 예전엔 '네트워크·오류를 확인하세요'로 뭉뚱그려
                 사용자가 무엇을 확인해야 하는지 알 수 없었다. */
              setStatus(!pi3.count?'전부 확인됐어요'
                :(r&&r.code)?('아직 '+pi3.count+'건 대기 — '+syncCodeText(r.code))
                :('아직 '+pi3.count+'건 대기 — 네트워크·오류를 확인하세요'));
              try{renderUI();}catch(_){}
            }).catch(function(e){ var ci=classifySyncError(e); setStatus('다시 보내기 실패 — '+syncCodeText(ci.code)); }); }});
        }).catch(function(e2){ chip('대기 목록을 읽지 못했어요 — '+String(e2&&e2.message||e2).slice(0,80)); });
      }; }
      pop.appendChild(stEl);
      var nameBtn=document.createElement('button'); nameBtn.type='button'; nameBtn.className='ap-b'; nameBtn.style.marginTop='6px';
      nameBtn.textContent=dn?('표시 이름: '+dn+' (변경)'):'표시 이름 설정'; nameBtn.onclick=function(e){e.stopPropagation();closePop();uiSetName();}; pop.appendChild(nameBtn);
      /* 2.256 — 로그인 방법 연결: 어느 쪽으로 로그인해도 이 계정으로 들어오게 */
      (function(){ var cap=document.createElement('div'); cap.className='ap-hd'; cap.textContent='로그인 방법 연결 — 어느 쪽으로도 이 계정에'; pop.appendChild(cap);
        var mini=document.createElement('div'); mini.className='ap-mini';
        [['kakao','카카오 연결'],['google','Google 연결']].forEach(function(pv){
          var b=document.createElement('button'); b.type='button'; b.className='ap-b'+(pv[0]==='kakao'?' kakao':''); b.textContent=pv[1];
          b.onclick=function(e){ e.stopPropagation(); closePop(); linkIdentity(pv[0]); }; mini.appendChild(b); });
        pop.appendChild(mini); })();
      div(pop);
      /* 워크스페이스 목록 */
      var lab=document.createElement('div'); lab.className='ap-hd'; lab.textContent='워크스페이스'; pop.appendChild(lab);
      var list=document.createElement('div'); list.className='ap-wslist';
      var cur=activeWs(), wl=wsList();
      wl.forEach(function(w){
        var b=document.createElement('button'); b.type='button'; b.className='ap-ws'+(w.id===cur?' on':'');
        var col=w.kind==='personal'?'#6a7078':wsColor(w.id);
        b.innerHTML='<span class="wi" style="background:'+col+'">'+esc((w.name||'?').charAt(0).toUpperCase())+'</span>'
          +'<span class="wn">'+esc(w.kind==='personal'?'내 작업':w.name)+'</span>'
          +(w.members>1?'<span class="wc">'+w.members+'명</span>':'')
          +(w.id===cur?'<span class="wk">✓</span>':'');
        b.onclick=function(e){ e.stopPropagation(); if(w.id!==cur){ closePop(); switchWorkspace(w.id); } };   /* 2.338 — _popOpen 만 끄면 'on' 클래스가 남아 바깥을 눌러도 안 닫히는 유령 팝오버가 됐다 */
        list.appendChild(b);
      });
      pop.appendChild(list);
      var mini=document.createElement('div'); mini.className='ap-mini';
      var nb=document.createElement('button'); nb.type='button'; nb.className='ap-b'; nb.textContent='＋ 팀 만들기'; nb.onclick=function(e){e.stopPropagation();closePop();uiCreateTeam();}; mini.appendChild(nb);
      var jb=document.createElement('button'); jb.type='button'; jb.className='ap-b'; jb.textContent='코드로 합류'; jb.onclick=function(e){e.stopPropagation();closePop();uiJoin();}; mini.appendChild(jb);
      pop.appendChild(mini);
      /* 팀 owner면 초대 코드 + 멤버 — 1.806: '팀 관리' 섹션 + 2열 그리드로 압축(팝업 길이 절반) */
      if(wa&&wa.kind==='team'){
        var tmh=document.createElement('div'); tmh.className='ap-hd'; tmh.textContent='팀 관리'; pop.appendChild(tmh);
        var tg=document.createElement('div'); tg.className='ap-grid'; pop.appendChild(tg);
        if(wa.role==='owner') pb('팀 이름 바꾸기','',function(){ uiRenameWs(wa); },tg);   /* 1.538 */
        if(wa.role==='owner') pb('초대 코드 만들기','',function(){ uiInvite(wa.id); },tg);
        if(wa.role==='owner') pb('권한 관리','',function(){ uiPerms(wa); },tg);
        if(wa.role==='owner') pb('변경 기록','',function(){ uiAudit(wa); },tg);
        pb('팀원 보기','',function(){ uiMembers(wa); },tg);
        pb('이 팀 나가기','',function(){ uiLeave(wa); },tg);
      }
      div(pop);
      /* 관리자에게만 관리 페이지 링크(실제 데이터 접근은 서버 RPC가 재검증) */
      if(isAdminEmail(s.email)) pb('🛠 관리자 페이지','',function(){ try{ window.open('/admin.html','_blank'); }catch(_){ location.href='/admin.html'; } });
      pb('로그아웃','',function(){ _popOpen=false; signOut(); });
      /* 1.850 — '내 계정·데이터 삭제'는 로그아웃 아래 작은 글자 링크로 (일상 동선에서 붉은 버튼이 눈에 먼저 들어오지 않게) */
      var er=pb('내 계정·데이터 삭제…','',function(){var b=document.getElementById('bkErase');if(b)b.click();});
      er.style.cssText='border:0;background:transparent;font-size:11px;font-weight:600;color:#a84440;opacity:.8;padding:4px 0 0;';
    }
    wrap.appendChild(pop);
    btn.onclick=function(e){ e.stopPropagation(); _popOpen=!_popOpen; pop.classList.toggle('on',_popOpen);
      if(_popOpen){ try{ if(window.__psCloseAppSettings)window.__psCloseAppSettings(); }catch(_){} try{ if(window.__psCloseBoardSettings)window.__psCloseBoardSettings(); }catch(_){} } };   /* 1.850 — 계정 열면 앱 설정·작전판 설정 닫기 */
    window.__psCloseAcctPop=closePop;
    if(!wrap.__docClose){ wrap.__docClose=1; document.addEventListener('click',function(e){ if(_popOpen&&!wrap.contains(e.target)){ _popOpen=false; var p=wrap.querySelector('.acct-pop'); if(p)p.classList.remove('on'); } }); }
  }catch(_){}
}

/* ── 부팅 ── */
function boot(){
  consumeHash();
  try{ if(COPIES_OFF){ var _pc=purgeCopies(); if(_pc)syncDiagnostic('copies-purged',new Error('기기 사본 '+_pc+'개 정리')); } }catch(_){}   /* 2.674 — 쌓여 있던 구조선·충돌 사본 한 번에 정리 */
  /* 2.675 — 닫을 때 팀 자료 지우기 · 지운 뒤 첫 부팅은 서버를 기다린다 */
  try{ window.addEventListener('pagehide',function(e){ if(e&&e.persisted)return; try{ var _n=wipeTeamCacheSoft(); if(_n)syncDiagnostic('cache-wiped',new Error('닫으며 팀 자료 '+_n+'키 지움')); }catch(_){} }); }catch(_){}
  try{ cacheWaitStart(); }catch(_){}
  try{ sessionStorage.removeItem(SELF_RELOAD); }catch(_){}   /* 2.676 — 우리 리로드 표시는 새 부팅에서 지운다 */
  setDataReady(false);
  renderUI();
  var s=getSess();
  /* 실패해도 조용히 상태만 표시 — catch가 없으면 unhandled rejection이 '처리되지 않은 작업 오류'로 노출됨 */
  if(s){ loadWorkspaces().then(function(){
             if(!dataUnlocked())throw dataLockError();
             /* 소유자가 확인된 뒤에만 IndexedDB 대기함을 읽는다. */
             return outboxTxn(function(q){return q;}).catch(function(e){syncDiagnostic('outbox-boot-read',e);});
           }).then(function(){ return syncNow('boot'); })
           .catch(function(e){ syncErr=true; setStatus('워크스페이스 불러오기 실패 — 네트워크 확인'); try{renderUI();}catch(_){} try{console.warn('[PSSync]',e);}catch(_){} try{ cacheWaitEnd(false); }catch(_){}
             /* 2.254 — 실패가 침묵하면 '카카오 로그인이 안 돼요'로 보인다: 원인 기록 → 잠금 오버레이가 보여 줌 + 1회 자동 재시도 */
             try{ if(!(e&&e.psDataLocked&&dataUnlocked()))localStorage.setItem('ps_last_unlock_err',String(e&&e.message||e).slice(0,200)); }catch(_){}
             try{ var _o=document.getElementById('psDataLock'); if(_o)_o.remove(); renderDataLock(dataUnlocked()); }catch(_){}
             setTimeout(function(){ if(dataUnlocked()||!getSess())return;
               loadWorkspaces().then(function(){ return syncNow('boot-retry'); }).catch(function(e2){ try{ localStorage.setItem('ps_last_unlock_err',String(e2&&e2.message||e2).slice(0,200)); }catch(_){} try{ var _o2=document.getElementById('psDataLock'); if(_o2)_o2.remove(); renderDataLock(dataUnlocked()); }catch(_){} }); },5000); }); }
  else { try{ sessionStorage.removeItem(RLKEY); }catch(_){} }
  /* 1.611 — 보고 있을 때는 자주, 아닐 때는 드물게.
     전에는 늘 3분이라 팀원이 올린 걸 최대 3분 뒤에야 봤다. 화면을 보고 있는 동안에는
     45초마다 맞추고, 탭이 숨겨져 있으면 3분 그대로 둔다(배터리·요청 수).
     숨은 동안 쌓인 것은 어차피 돌아오는 순간 visibilitychange('show')가 즉시 당겨온다. */
  setInterval(function(){
    if(!dataUnlocked()||navigator.onLine===false) return;
    if(document.visibilityState==='visible') syncNow('interval');
  },45000);
  setInterval(function(){
    if(!dataUnlocked()||navigator.onLine===false) return;
    if(document.visibilityState!=='visible') syncNow('interval-bg');
  },180000);
  /* 1.592 — 자동 스냅샷. 로그인과 무관하게(로컬만 쓰는 사람도 사고는 난다) 하루 한 번.
     앱을 여는 순간 몰아치면 첫 화면이 느려지므로 8초 뒤에 조용히 뜬다. */
  setTimeout(function(){ try{ if(dataUnlocked())autoSnapshot(); }catch(_){} }, 8000);
  /* 1.593 — psCount 의 잣대가 바뀌었다(중첩 포함). m.n 에 기억된 '전 회차 개수'는 옛 잣대로 적힌 값이라
     그대로 두면 예: 옛 9(칸 수) → 새 3(배열 합) 을 급감으로 오해해 **가짜 보류**가 뜬다.
     한 번만 비워서 다음 회차에 새 잣대로 다시 기억하게 한다. 값 자체는 건드리지 않는다. */
  try{
    if(localStorage.getItem('ps_count_scale')!=='v3'){   /* 2.624 — grpWeeks 제외 잣대로 한 번 더 비운다 */
      var _m=meta(); _m.n={}; setMeta(_m);
      localStorage.setItem('ps_count_scale','v3');
    }
  }catch(_){}
  document.addEventListener('visibilitychange',function(){
    if(!dataUnlocked()) return;
    if(document.visibilityState==='hidden') syncNow('hide');           /* 나가기 전 밀어올리기 */
    else if(document.visibilityState==='visible') syncNow('show');     /* 폰에서 앱 다시 열 때 즉시 당겨오기 */
  });
  /* 오프라인/온라인 전환을 배지에 즉시 반영 (팝업을 열지 않아도 보이게) */
  window.addEventListener('online',function(){ syncErr=false; clearSyncRetry(); try{renderUI();}catch(_){} eventTrack('network_restored',{status:'ok',feature:'sync'});flushEvents(); if(dataUnlocked())syncNow('online');else if(getSess())loadWorkspaces().then(function(){return syncNow('online-unlock');}).catch(function(){}); });
  window.addEventListener('offline',function(){
    var pi=pendingInfo(activeWs());setStatus(pi.count?('오프라인이에요 · 이 기기에 '+pi.count+'건 안전하게 있어요'):'오프라인이에요 · 이 기기에 저장돼요');
    try{renderUI();}catch(_){}
    /* 오프라인 전환은 제품의 정상 환경 신호이므로 빨간 오류가 아닌 연결 정보로 기록한다. */
    eventTrack('network_offline',{feature:'sync',status:'ok'});
  });
  /* 편집 즉시 반영: 데이터 쓰기는 전부 탭 iframe에서 일어나므로 셸은 storage 이벤트로 감지(자기 쓰기는 미발화 → 루프 없음) */
  var edT=null,edSeq=0,edCommit=Promise.resolve();
  window.addEventListener('storage',function(e){
    if(!e||!e.key) return;
    if(e.key===SKEY){
      if(!getSess()){setDataReady(false);renderUI();}
      else if(!dataUnlocked()){setDataReady(false);loadWorkspaces().then(function(){return syncNow('auth-storage');}).catch(function(err){syncDiagnostic('auth-storage',err);});}
      return;
    }
    /* 보관함 본문은 IDB에 있어 storage 이벤트가 안 뜬다 → board가 남기는 'cs_lib_rev' 신호로 감지.
       IDP(cs_idp_v1_*)는 iframe이 localStorage에 직접 쓰므로 접두사로 감지. */
    if(KEYS.indexOf(e.key)<0&&e.key!==LIBKEY&&e.key!==TOMBKEY&&e.key!=='cs_lib_rev'
      &&e.key.indexOf('cs_idp_v1_')!==0&&e.key.indexOf('cs_idp_pub_v1_')!==0) return;
    if(!dataUnlocked()) return;
    try{
      var en=e.key==='cs_lib_rev'||e.key===LIBKEY?'library_saved'
        :e.key.indexOf('cs_idp_pub_v1_')===0?'idp_feedback_saved'
        :e.key.indexOf('cs_idp_v1_')===0?'idp_saved'
        :e.key==='cs_psched_v1'?'schedule_saved'
        :(e.key==='cs_notes_v1'||e.key==='cs_note_papers_v1')?'note_saved':'content_saved';
      eventTrack(en,{feature:en.replace('_saved','')});
    }catch(_){}
    var seq=++edSeq,key=e.key,newValue=e.newValue;
    /* 2.340 — 비우는 중에 도착한 **팀 콘텐츠** 저장 신호는 버린다(이전 팀 값의 부활 = 새 팀 오염).
       개인 키(내 IDP 등)는 나를 따라다니므로 그대로 통과시킨다. 이 창은 1~2초이고 끝은 리로드라,
       버려도 서버에서 다시 받는다 — 반대로 쓰면 되돌릴 수 없다. */
    if(switchWiping&&!PERSONAL[key]){ try{syncDiagnostic('switch-wipe-mirror-drop',new Error(String(key)));}catch(_){} return; }
    /* iframe의 localStorage 신호를 받으면 IDB 정본에 먼저 같은 raw를 확정한 뒤
       outbox를 표시한다. 예전에는 이 순서가 반대라 옛 IDB 해시가 대기함에 들어갔다. */
    edCommit=edCommit.catch(function(){}).then(function(){
      if(key!=='cs_lib_rev'&&key!==LIBKEY&&key!==TOMBKEY&&idbBacked(key)&&newValue!=null&&window.storage){
        return window.psSaveSharedAsync?window.psSaveSharedAsync(key,newValue):window.storage.set(key,newValue);
      }
    }).catch(function(err){syncDiagnostic('edit-idb-mirror',err);});
    edCommit.then(function(){
      try{
        var qk=(key==='cs_lib_rev'||key===LIBKEY||key===TOMBKEY)?'@library':key;
        var qwid=(PERSONAL[key]&&isTeamWs())?personalWid():activeWs();
        return qwid?outboxMarkCurrent(qwid,qk,'edit'):null;
      }catch(_){return null;}
    }).catch(function(err){syncDiagnostic('outbox-edit-mark',err);}).then(function(){
      if(seq!==edSeq)return;
      clearTimeout(edT);edT=setTimeout(function(){syncNow('edit');},4000);
    });
  });
  function recheckAuth(){
    if(!getSess()){setDataReady(false);return;}
    if(!dataUnlocked())loadWorkspaces().then(function(){return syncNow('auth-recheck');}).catch(function(e){syncDiagnostic('auth-recheck',e);});
    else broadcastAuthState(true);
  }
  window.addEventListener('pageshow',recheckAuth);
  window.addEventListener('focus',recheckAuth);
  document.addEventListener('load',function(e){if(e&&e.target&&e.target.tagName==='IFRAME')broadcastAuthState(dataUnlocked());},true);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();

window.PSSync={signIn:signIn,signOut:signOut,syncNow:syncNow,session:getSess,dataUnlocked:dataUnlocked,keys:KEYS,state:syncState,   /* 2.625 상태 한 줄 */
  scheduleEdit:{set:scheduleEditSet,touch:scheduleEditTouch,active:scheduleHeld},
  ping:function(f){ usagePing(null,f); },
  act:function(f,feat){ actTrack(f,feat); },   /* 2.516 — 하루 한 줄 핑 + 횟수·시각·기기 이벤트 */
  event:eventTrack,flushEvents:flushEvents,
  pending:function(){return pendingInfo(activeWs());},
  /* ══ 2.462 · 동기화 진단(사용자 "기기마다 엉켜 제대로 안 보여") ═══════════════════
     이 기기가 **왜** 못 올리는지/언제 받았는지를 한 장으로. 2.445 가 대기 항목에 적어 두는
     이유(lastError·roundError)를 처음으로 사람 앞에 꺼낸다 — 추측 대신 증거. */
  diag:function(){
    var wid=activeWs();
    return outboxRead().then(function(q){
      var sc=outboxScope(outboxOwner(),wid);
      var rows=(q||[]).filter(function(it){return it&&outboxScope(it.uid,it.wid)===sc;})
        .map(function(it){
          var code=it.lastError||it.roundError||'';
          return {key:it.key,label:keyLabel(it.key),code:code,text:code?syncCodeText(code):'아직 보낼 차례를 기다리는 중',
            stage:it.lastStage||it.roundStage||'',attempts:+it.attempts||0,rounds:+it.roundFails||0,
            at:+it.updatedAt||+it.at||0};
        });
      var lastPull=0; try{ lastPull=+localStorage.getItem('ps_last_pull_at')||0; }catch(_){}
      var bytes=0,largest=[]; try{ if(window.PSStorage){ bytes=PSStorage.localBytes?PSStorage.localBytes():0; largest=PSStorage.largestLocal?PSStorage.largestLocal(3):[]; } }catch(_){}
      return { ws:(activeWsObj()||{}).name||'', online:navigator.onLine!==false, session:!!getSess(),
        lastPull:lastPull, pending:rows, localBytes:bytes, largest:largest.map(function(r){return {key:r.key,label:keyLabel(r.key),bytes:r.bytes};}) };
    });
  },
  /* ══ 2.465 · 팀 기록(판 역사) — 사용자 "로그를 남겨서 그쪽으로 가거나 되돌리거나" ═══════
     재료는 서버에 이미 있었다: ps_kv_history(90일, supabase-sync-safety.sql) +
     updated_by(supabase-updated-by.sql). 읽는 통로만 일정 한 키(ps_sched_history)라
     supabase-history-log.sql 이 전 키 통로(ps_kv_history_list/get, 운영진 전용)를 연다.
     행의 의미: "changed_at 에 changed_by 가 k 를 고쳤고, v 는 그 직전 판". */
  history:function(key,limit){
    var wid=activeWs();
    if(!getSess()) return Promise.resolve({installed:false,reason:'login'});
    if(!isTeamWs()||!wid) return Promise.resolve({installed:false,reason:'team-only'});
    return namesRefresh(wid).catch(function(){}).then(function(){
      return rpc('ps_kv_history_list',{p_wid:wid,p_key:key||null,p_limit:limit||60});
    }).then(function(rows){
      return {installed:true, ws:(activeWsObj()||{}).name||'', rows:rows||[], names:nameMap()};
    }).catch(function(e){
      var t=String(e&&e.message||'');
      if(t.indexOf(' 404 ')>=0||t.indexOf('PGRST202')>=0||t.indexOf('does not exist')>=0||t.indexOf('42883')>=0)
        return {installed:false,reason:'sql'};
      if(t.indexOf('executives only')>=0) return {installed:true,denied:true,rows:[],names:{}};
      throw e;
    });
  },
  historyGet:function(id){
    return rpc('ps_kv_history_get',{p_wid:activeWs(),p_id:id}).then(function(rows){ return (rows&&rows[0])||null; });
  },
  /* 그 판을 현재 판으로. rescueRestore(1.647)와 같은 길 — 메타 해시를 지워 '내가 방금
     고친 것'으로 만들고(다음 회차에 서버로 올라감), kvWrite 로 두 저장소에 쓰고,
     앱이 실제로 읽는 자리에서 되읽어 검증한다. rescueRestore 는 구조선 파일 전용이라
     건드리지 않고 같은 뼈대를 여기 둔다. */
  historyApply:function(k,v){
    if(!dataUnlocked()||v==null) return Promise.resolve(false);
    var writes=[];
    try{ var m=meta(); delete m.h[k]; setMeta(m); }catch(_){}
    var ok=kvWrite(k,v,writes);
    return Promise.all(writes).catch(function(){}).then(function(){
      if(!ok) return false;
      var verify = idbBacked(k)
        ? window.storage.get(k).then(function(r){ return r?r.value:null; }).catch(function(){ return null; })
        : Promise.resolve((function(){ try{ return localStorage.getItem(k); }catch(_){ return null; } })());
      return verify.then(function(cur){
        if(cur!==v){ syncDiagnostic('hist-restore-verify',new Error('restore did not land: '+k)); return false; }
        try{ syncNow('hist-restore'); }catch(_){}
        return true;
      });
    });
  },
  histLabel:keyLabel,
  histCount:function(v){ try{ return rescueCount(v); }catch(_){ return null; } },
  workspaces:wsList,activeWs:activeWs,activeWsObj:activeWsObj,switchWorkspace:switchWorkspace,
  createTeam:createTeam,joinTeam:joinTeam,createInvite:createInvite,membersOf:membersOf,leaveTeam:leaveTeam,loadWorkspaces:loadWorkspaces,
  displayName:getDisplayName,setDisplayName:setDisplayName,shareLibraryItem:shareLibraryItem,
  /* 1.633 — 화면이 "○○ 코치 · 2분 전"과 "이 자료는 이렇게 공유됩니다"를 그릴 때 쓴다.
     모르면 빈 문자열을 준다 — 화면은 빈 줄이면 아예 안 그리면 된다(모르면서 아는 척하지 않는다). */
  editLine:editLine,editInfo:editInfo,editStamp:editStamp,shareNote:shareNote,ago:agoText,
  rescue:{list:rescueList,open:rescueOpen,restore:rescueRestore},
  cache:{keys:teamCacheKeys,wipe:wipeTeamCacheSoft,wait:renderCacheWait,flag:cacheWipedFlag},   /* 2.675 — 진단·검증용 */
  beginImport:syncImportBegin,endImport:syncImportEnd,
  approveImport:importApproveExact,verifyImport:importVerifyExact,clearImport:function(k){importApprovalClear(k);try{localStorage.removeItem('ps_push_ok_'+k);}catch(_){}return true;},
  hold:{list:holdList,open:holdOpen,approve:holdApprove,approveExact:holdApproveExact,takeServer:holdTakeServer,count:psCount},
  undo:{list:undoList,restore:undoRestore,dismiss:undoDismiss},label:keyLabel,   /* 2.626 막지 않고 되돌리기 */
  rt:{connected:rtConnected,connect:rtConnect,last:function(){return rtLast;},hits:function(){return rtHits;}},   /* 2.628 실시간 */
  merge:{notes:mergeNoteList,revert:mergeNoteRevert,dismiss:mergeNoteDismiss},   /* 2.629 항목 단위 병합 알림 */
  bulk:{pull:bulkPull,push:bulkPush,keys:bulkKeys,guard:bulkGuard},   /* 2.352 — 팀 자료 통째로 가져오기/올리기 */
  /* 2.622 — 서버에서 받은 일정 원문(시점 복구 등)의 그림 참조를 되돌린다. 못 되돌리면 원문 그대로 */
  blob:{hydrate:function(raw){ return ensureToken().then(function(at){ return schedHydrate(at,activeWs(),String(raw||'')); }).catch(function(){ return raw; }); }, strip:schedStrip, refs:schedRefs, off:function(){return blobOff;}}};
})();
