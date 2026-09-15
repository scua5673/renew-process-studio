/* Shared presentation for the sync engine's confirmed state. No storage writes. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAutosaveStatus=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function view(state){
    var s=state||{},kind=s.kind,n=Math.max(0,Number(s.n)||0),review=Math.max(0,Number(s.review)||0),archived=Math.max(0,Number(s.archivedCount)||0);
    function result(k,text,detail,action,attention,complete){return {kind:k,text:text,detail:detail,action:action||'',attention:!!attention,complete:!!complete};}
    if(!state||kind==='off')return result('off','로그인하면 자동으로 저장됩니다','로그인 후 저장 상태를 확인할 수 있습니다.');
    if(kind==='bad'){
      if(s.reason==='sync_offline')return result('bad','오프라인 · 저장 대기','인터넷에 연결되면 다시 저장합니다.','retry',true);
      if(s.reason==='sync_auth')return result('bad','로그인이 필요해요','다시 로그인한 뒤 저장을 이어갑니다.','login',true);
      if(s.reason==='sync_storage')return result('bad','기기 저장을 확인해 주세요','저장 공간을 확인한 뒤 다시 시도해 주세요.','retry',true);
      if(s.reason==='sync_permission')return result('bad','저장 권한을 확인해 주세요','이 자료를 저장할 권한을 확인하지 못했습니다.','retry',true);
      if(s.reason==='sync_confirm_missing')return result('bad','저장 상태를 다시 확인해 주세요','저장 기록이 일치하지 않아 완료 여부를 확인하지 못했습니다. 다시 시도해 주세요.','retry',true);
      return result('bad','저장을 확인하지 못했어요','변경사항의 서버 저장 여부를 확인하지 못했습니다. 다시 시도해 주세요.','retry',true);
    }
    if(kind==='busy')return result('busy','저장 중…','변경사항의 서버 저장을 확인하고 있습니다.');
    if(review||kind==='ask'||kind==='held')return result('held','일부 변경 보관','자동으로 맞추지 못한 변경을 이 기기에 보관했습니다.','retry',true);
    if(n||kind==='pending')return result('pending','저장 대기','변경사항을 서버에 저장할 차례를 기다리고 있습니다.','retry');
    if(archived)return result('held','일부 변경 별도 보관','다른 변경과 겹친 내용은 별도로 보관했습니다. 고급 복구에서 확인할 수 있습니다.','recovery',true,kind==='ok'&&Number(s.at)>0);
    if(kind==='ok'&&Number(s.at)>0)return result('ok','저장됨','서버에 저장된 내용을 확인했습니다.','',false,true);
    return result('pending','저장 확인 중…','아직 서버 저장을 확인하지 못했습니다.','retry');
  }
  return {view:view};
});
