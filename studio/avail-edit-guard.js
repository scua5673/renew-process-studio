/* PROCESS STUDIO — 가용인원 «조회만 가능» 풀기 (3.140)
   사용자 10/19 «가용인원 수정이 안돼»(풋볼A 주인 · 맥 설치 앱): 화면이 «조회만 가능한 상태입니다»로 굳었다.
   주인이라 권한은 맞다. 가용인원 편집 확인(scout.html avOwnerContext)은 권한 말고도 «팀 자료 확인 중» 상태
   (부팅 · 옛 후보 정리 · 팀 전환 · 계정 확인)에서 잠시 닫히는데, 화면은 그린 순간의 답을 그대로 들고 있었다 —
   확인이 끝나도 다시 그리지 않았다. 옛 후보 정리(scMainMigrationPending)는 후보 자료 확인이 한 번 실패하면
   정리할 후보가 없어도 켜진 채 남았다(그동안 선수단 저장 save() 도 멈춘다).
   → 이 모듈이 ① 막힌 까닭을 문구로 말하고 ② 기다리는 까닭이면 풀릴 때까지 보다가 바로 다시 그리고
     ③ 정리할 후보가 없는 정리 표시는 내리고(있으면 다시 시도) ④ 10초 넘게 안 풀리면 까닭을 ps_events 에 한 줄 남긴다.
   판정 자체는 그대로 avCanEdit() 이 한다 — 여기의 reason() 은 문구와 기록용이다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAvailGuard=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var NO_PERM={perm:1,role:1,viewonly:1};
  var MSG_PERM='가용인원은 «팀» 편집 권한이 있는 코치만 고칠 수 있어요. 지금은 보기만 됩니다.';
  var MSG_WAIT='팀 자료를 확인하는 중이라 잠시 보기만 됩니다. 확인이 끝나면 바로 고칠 수 있어요.';
  var MSG_LONG='팀 자료 확인이 끝나지 않아 보기만 됩니다. 앱을 닫았다 다시 열어 주세요.';
  function j(ls,k){try{return JSON.parse(ls.getItem(k)||'null');}catch(_){return null;}}
  function sync(w){try{return (w.parent&&w.parent.PSSync)||w.PSSync||null;}catch(_){return w.PSSync||null;}}
  /* avOwnerContext 와 같은 순서로 처음 막힌 곳 하나 */
  function reason(w){
    try{
      var ls=w.localStorage,pm=w.PSPerms||(w.parent&&w.parent.PSPerms),role=pm&&pm.role&&pm.role();
      if(!pm||!pm.canEdit||pm.canEdit('team')!==true)return 'perm';
      if(['admin','executive','staff'].indexOf(role)<0)return 'role';
      if(typeof w.scoutAutomaticWriteAllowed==='function'&&!w.scoutAutomaticWriteAllowed())return 'viewonly';
      if(w.scoutBootPending)return 'boot';
      if(w.scMainMigrationPending)return 'migrate';
      if(ls.getItem('ps_ws_switch_guard_v1'))return 'switch';
      var ss=j(ls,'ps_sync_session'),wid=ls.getItem('ps_active_ws')||'',seal=ls.getItem('ps_cache_owner_v1')||'';
      if(ss||wid||seal){
        var own=j(ls,'ps_cache_owner_v1'),api=sync(w);
        if(!ss||!ss.uid||!wid||!own)return 'session';
        if(own.uid!==ss.uid||own.wid!==wid)return 'seal';
        if(!api||!api.dataUnlocked||!api.dataUnlocked())return 'locked';
      }
      return 'other';
    }catch(_){return 'other';}
  }
  function message(code,long){return NO_PERM[code]?MSG_PERM:(long?MSG_LONG:MSG_WAIT);}
  /* 저장된 선수단 본문에 옛 후보(type:'target')가 남았나 — scMigrateMainTargets 가 처음에 보는 것과 같다 */
  function mainHasTargets(raw){
    try{var d=raw&&JSON.parse(raw);return !!(d&&Array.isArray(d.players)&&d.players.some(function(p){return p&&p.type==='target';}));}
    catch(_){return true;}   /* 읽지 못하면 정리 표시를 내리지 않는다 */
  }
  /* 켜진 채 남은 «옛 후보 정리» — 정리할 것이 없으면 내리고, 있으면 다시 시도한다(정리 중이면 기다린다) */
  function unstick(w,state){
    if(!w.scMainMigrationPending||w.scPreparing)return false;
    var raw;try{raw=w.localStorage.getItem('scout_tool_v1');}catch(_){return false;}
    if(!mainHasTargets(raw)){w.scMainMigrationPending=false;return true;}
    var now=Date.now();if(now-(state.prepAt||0)<5000)return false;state.prepAt=now;
    try{if(typeof w.scPrepare==='function')w.scPrepare();}catch(_){}
    return false;
  }
  function ownerOf(w){
    try{var ls=w.localStorage,wid=ls.getItem('ps_active_ws'),l=j(ls,'ps_ws_list')||[];
      for(var i=0;i<l.length;i++)if(l[i]&&l[i].id===wid)return l[i].role==='owner';}catch(_){}
    return false;
  }
  function report(w,code,age){
    try{
      var S=sync(w),pm=w.PSPerms||(w.parent&&w.parent.PSPerms);if(!S||!S.event)return;
      S.event('avail_readonly',{status:'error',feature:'team',error_code:code,meta:{stage:code,reason:String(pm&&pm.role&&pm.role()||''),age:age,
        boot:!!w.scoutBootPending,mig:!!w.scMainMigrationPending,prep:!!w.scPreparing,owner:ownerOf(w)}});
    }catch(_){}
  }
  function mount(w){
    if(!w||w.__psAvailGuard||typeof w.renderAvail!=='function')return false;
    w.__psAvailGuard=true;
    var doc=w.document,orig=w.renderAvail,state={timer:null,since:0,reported:{},prepAt:0};
    function visible(){var v=doc.getElementById('availView');return !!(v&&v.classList.contains('on'));}
    function stop(){if(state.timer){w.clearInterval(state.timer);state.timer=null;}state.since=0;}
    function note(){var r=doc.getElementById('availRoot');return r&&r.querySelector('.av-readonly');}
    function tell(el,code){var long=state.since&&Date.now()-state.since>20000;var t=message(code,long);if(el.textContent!==t)el.textContent=t;el.setAttribute('data-why',code);}
    function tick(){
      if(doc.hidden)return;
      if(!visible()||!note()){stop();return;}
      unstick(w,state);
      var ok=false;try{ok=!!w.avCanEdit();}catch(_){}
      if(ok){stop();if(!w.avPickerState)try{w.renderAvail();}catch(_){}return;}
      var code=reason(w),age=Math.round((Date.now()-state.since)/1000);
      tell(note(),code);
      if(age>=10&&!state.reported[code]){state.reported[code]=1;report(w,code,age);}
      if(age>600)stop();
    }
    function after(){
      var el=note();if(!el){stop();return;}
      var code=reason(w);
      if(NO_PERM[code]){
        tell(el,code);stop();
        /* 주인인데 권한이 없다고 나오면 고장이다 — 그때만 남긴다 */
        if(ownerOf(w)&&!state.reported[code]){state.reported[code]=1;report(w,code,0);}
        return;
      }
      if(!state.since)state.since=Date.now();
      tell(el,code);
      unstick(w,state);
      if(!state.timer)state.timer=w.setInterval(tick,1500);
    }
    w.renderAvail=function(){var r=orig.apply(this,arguments);try{after();}catch(_){}return r;};
    return true;
  }
  var api={reason:reason,message:message,mainHasTargets:mainHasTargets,unstick:unstick,mount:mount};
  /* scout.html 은 본문 스크립트 뒤에서 이 파일을 읽는다 — 그때 renderAvail 이 있으면 바로 감싼다 */
  try{if(typeof window!=='undefined'&&typeof window.renderAvail==='function')mount(window);}catch(_){}
  return api;
});
