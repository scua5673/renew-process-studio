/* 계정 삭제(«내 데이터 삭제» — 서버 RPC ps_delete_my_data)가 거절됐을 때의 안내 문구.
   서버(20261110_privacy_limits)는 지워도 되는지 먼저 보고, 안 되면 아무것도 지우지 않은 채 409 와 사유를 돌려준다:
     ps_delete_owner_blocked — 다른 팀원이 남아 있는 팀의 소유자(지우면 팀이 주인 없이 남는다). details = 팀 이름
     ps_delete_admin_blocked — 서비스 관리자 계정
   그 밖의 실패(끊김 · 5xx · 옛 서버)는 예전 문구 그대로. 서버가 준 팀 이름은 글자로만 쓴다(alert 로 보인다 — HTML 아님). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSAccountDelete=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var GENERIC='서버에서 지우지 못했어요. 이 기기의 자료도 지우지 않았어요 — 인터넷 연결을 확인하고 다시 시도해 주세요.';
  function parse(text){ try{ var o=JSON.parse(String(text==null?'':text)); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }catch(_){ return {}; } }
  function clean(v){ return String(v==null?'':v).replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,120); }
  function failText(status,text){
    var o=parse(text), why=String(o.message||'');
    if(why==='ps_delete_owner_blocked'){
      var teams=clean(o.details);
      return '내가 소유한 팀'+(teams?'('+teams+')':'')+'에 다른 팀원이 남아 있어 계정을 지울 수 없어요.\n'
        +'팀을 넘기거나 삭제한 뒤 탈퇴해 주세요 — 팀원을 모두 내보내면 탈퇴할 때 팀도 함께 지워지고, 팀을 다른 사람에게 넘기려면 문의해 주세요.\n'
        +'서버와 이 기기에서 아무것도 지우지 않았어요.';
    }
    if(why==='ps_delete_admin_blocked')
      return '서비스 관리자 계정은 여기서 지울 수 없어요 — 관리자 권한을 먼저 내려 주세요.\n서버와 이 기기에서 아무것도 지우지 않았어요.';
    return GENERIC;
  }
  /* fetch 응답이 실패일 때 던질 오류 — 화면은 e.psText 를 보여 준다 */
  function fail(status,text){ var e=new Error('server '+status); e.psText=failText(status,text); return e; }
  return {GENERIC:GENERIC,failText:failText,fail:fail};
});
