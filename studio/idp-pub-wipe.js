/* 3.080 — 닫을 때 지운 코치 피드백(cs_idp_pub_v1_<uid>)이 «받기 전에 쓴 한 줄»에 덮이지 않게 한다.
   닫기(sync.js wipeTeamCacheSoft)는 이 기기 사본만 지우고 확정 표(meta.h · meta.c)와 기준본은 남긴다.
   다음에 열어 받기 전에 코치가 쓰면 페이지(idp.html pubPushAt · reactSetAt · cgSetAt …, scout.html 경기 전달 …)는
   빈 {} 에서 한 항목짜리 문서를 만들고, 동기화는 그것을 «내가 고쳤고 서버는 그대로»로 보아 서버본을 통째로 덮었다
   (가상 팀 재현: 9항목 → 1항목. 기준본과 3-way 로 합쳐도 «로컬에 없는 항목 = 지움»이 되어 똑같이 사라진다).
   그래서 지울 때 그 키의 확정 판(h · c)을 meta.w 에 적어 두고, 다시 받기 전에 생긴 로컬본은 «조상 없이» —
   삭제를 추측하지 않고 — 서버본과 합친다(sync.js idpMergeInitialRaw). 표는 서버본을 받거나 합친 판이 확정되면 걷힌다.
   새 저장소 키는 없다 — sync meta 안의 한 칸이다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSIdpPubWipe=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var PUB='cs_idp_pub_v1_';
  function own(o,k){return !!o&&typeof o==='object'&&Object.prototype.hasOwnProperty.call(o,k);}
  function isPub(k){return typeof k==='string'&&k.indexOf(PUB)===0&&k.length>PUB.length&&k!==PUB+'local';}
  /* 지운 순간의 확정 판을 적는다. 확정 hash 가 없는 키(서버본을 본 적 없음)는 잃을 서버본도 없다. */
  function mark(m,k){
    if(!m||!isPub(k)||!own(m.h,k)||!m.h[k])return false;
    if(!m.w||typeof m.w!=='object'||Array.isArray(m.w))m.w={};
    m.w[k]={h:String(m.h[k]),c:+((m.c&&m.c[k])||0)};
    return true;
  }
  function clear(m,k){if(own(m&&m.w,k)){delete m.w[k];return true;}return false;}
  /* '' 표 없음 · 'stale' 그 뒤 확정이 바뀌었거나 서버본이 그대로 돌아와 있다(표를 걷을 때)
     'missing' 아직 안 받았다 · 'rebuilt' 받기 전에 새로 쓴 문서 — 그대로 올리거나 기준본과 합치면 서버본을 덮는다 */
  function state(m,k,localRaw,hash){
    if(!isPub(k))return '';
    var w=own(m&&m.w,k)?m.w[k]:null;
    /* 팀 전환은 공개본과 meta 를 함께 지우고(지운 것을 확인까지 한다) 그 팀의 옛 기준본은 보조 저장소에 남긴다.
       돌아오는 팀의 받기가 전환 안에서 끝나지 못하면 meta 가 빈 채로 열린다 — 확정 판 없이 이 기기에 있는
       공개본은 받기 전에 새로 쓴 문서다. 옛 기준본과 3-way 로 합치면 «없는 항목 = 지움»이 된다(가상 팀 재현 9 → 1). */
    if(!w)return (localRaw!=null&&!(own(m&&m.h,k)&&m.h[k]))?'rebuilt':'';
    if(typeof w!=='object')return 'stale';
    var h=own(m.h,k)?String(m.h[k]||''):'',c=+((m.c&&m.c[k])||0);
    if(!h||h!==w.h||c!==+w.c)return 'stale';
    if(localRaw==null)return 'missing';
    if(typeof hash==='function'&&hash(String(localRaw))===h)return 'stale';
    return 'rebuilt';
  }
  /* 동기화 회차용 — 상태를 보고, 걷을 표는 걷는다 */
  function settle(m,k,localRaw,hash){var s=state(m,k,localRaw,hash);if(s==='stale'){clear(m,k);return '';}return s;}
  return {mark:mark,clear:clear,state:state,settle:settle,isPub:isPub};
});
