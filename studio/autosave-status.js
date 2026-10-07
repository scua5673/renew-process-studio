/* Shared presentation for the sync engine's confirmed state. No storage writes. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAutosaveStatus=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* 2.941 — 운영 기준 «24시간 넘는 미해결 저장 문제 0건»(외부 검토 피드백). 기기 안 대기열의 가장 오래된 항목이 하루를 넘으면
     «저장 대기»로 조용히 두지 않고 며칠째인지 말한다. 저장 중·로그인 필요는 그대로(다음 할 일이 이미 분명하다). */
  function view(state){
    var r=baseView(state),s=state||{},n=Math.max(0,Number(s.n)||0),oldest=Number(s.oldest)||0,now=Number(s.now)||Date.now();
    var days=(n&&oldest>0&&now>oldest)?Math.floor((now-oldest)/86400000):0;
    /* 2.952 — 보관한 변경(고를 것)이 있으면 «N일째 저장 대기»로 덮지 않는다 — 기다려서 풀리는 일이 아니다(코치 점검 10/7).
       ⚠ 띠에서 문서 선택창을 열지는 않는다(조용한 저장 표시 원칙 — 아래 테스트). 고르는 곳은 앱 설정 › 데이터 › 자료 확인. */
    if(r.kind==='held'&&(Number(s.review)>0||s.kind==='ask'||s.kind==='held'))return r;
    if(days>=1&&r.kind!=='off'&&r.kind!=='busy'&&r.action!=='login')
      return {kind:'bad',text:days+'일째 저장 대기 · '+n+'건',detail:'변경사항은 이 기기에 남아 있지만 '+days+'일 넘게 서버에 올라가지 못했어요. «다시 시도»로도 안 되면 앱 설정 › 기기 › 동기화 진단에서 이유를 보거나 오류 제보로 알려 주세요.',action:r.action||'retry',attention:true,complete:false};
    return r;
  }
  function baseView(state){
    var s=state||{},kind=s.kind,n=Math.max(0,Number(s.n)||0),review=Math.max(0,Number(s.review)||0),archived=Math.max(0,Number(s.archivedCount)||0);
    function result(k,text,detail,action,attention,complete){return {kind:k,text:text,detail:detail,action:action||'',attention:!!attention,complete:!!complete};}
    if(!state||kind==='off')return result('off','로그인하면 자동으로 저장됩니다','로그인 후 저장 상태를 확인할 수 있습니다.');
    if(kind==='bad'){
      if(s.reason==='sync_offline')return result('bad','오프라인 · 저장 대기','인터넷에 연결되면 다시 저장합니다.','retry',true);
      if(s.reason==='sync_auth')return result('bad','로그인이 필요해요','다시 로그인한 뒤 저장을 이어갑니다.','login',true);
      if(s.reason==='sync_storage')return result('bad','기기 저장을 확인해 주세요','미저장 자료를 보존하고 저장소 진단을 확인한 뒤 다시 시도해 주세요.','retry',true);
      if(s.reason==='sync_local_changed'||s.reason==='sync_workspace_changed')return result('bad','변경된 작업을 다시 확인하고 있어요','계정·팀 또는 새 편집이 바뀌어 이전 작업을 멈췄습니다. 현재 화면에서 다시 확인해 주세요.','retry',true);
      if(s.reason==='sync_permission')return result('bad','저장 권한을 확인해 주세요','이 자료를 저장할 권한을 확인하지 못했습니다.','retry',true);
      if(s.reason==='sync_server_rejected')return result('bad','서버에 저장이 반영되지 않았어요','다시 시도해도 같으면 오류 제보로 알려 주세요. 저장 완료는 아직 확인되지 않았습니다.','retry',true);
      if(s.reason==='sync_conflict')return result('bad','다른 저장 내용을 확인하고 있어요','기기와 서버의 저장 내용이 달라 다시 확인해야 합니다. 같은 문제가 반복되면 오류 제보로 알려 주세요.','retry',true);
      if(s.reason==='sync_confirm_missing')return result('bad','저장 상태를 다시 확인해 주세요','저장 기록이 일치하지 않아 완료 여부를 확인하지 못했습니다. 다시 시도해 주세요.','retry',true);
      return result('bad','저장을 확인하지 못했어요','변경사항의 서버 저장 여부를 확인하지 못했습니다. 다시 시도해 주세요.','retry',true);
    }
    if(kind==='busy')return result('busy','저장 중…','변경사항의 서버 저장을 확인하고 있습니다.');
    /* 2.952 — 보관한 변경은 기다려서 풀리지 않는다 — 고르는 곳(앱 설정 › 데이터 › 자료 확인)을 말한다. 숫자·«문서 전체»는 여전히 띠에 적지 않는다. */
    if(review||kind==='ask'||kind==='held')return result('held','일부 변경 보관','자동으로 맞추지 못한 변경을 이 기기에 보관했습니다. 앱 설정 › 데이터 › 자료 확인에서 남길 쪽을 고르면 이어서 저장합니다.','retry',true);
    if(n||kind==='pending')return result('pending','저장 대기','변경사항을 서버에 저장할 차례를 기다리고 있습니다.','retry');
    if(archived)return result('held','일부 변경 별도 보관','다른 변경과 겹친 내용은 별도로 보관했습니다. 고급 복구에서 확인할 수 있습니다.','recovery',true,kind==='ok'&&Number(s.at)>0);
    if(kind==='ok'&&Number(s.at)>0)return result('ok','저장됨','서버에 저장된 내용을 확인했습니다.','',false,true);
    return result('pending','저장 확인 중…','아직 서버 저장을 확인하지 못했습니다.','retry');
  }
  return {view:view};
});
