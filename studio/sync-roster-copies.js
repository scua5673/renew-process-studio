/* 3.201 — 선수 명단(scout_tool_v1)의 두 기기 사본이 어긋났을 때의 판정(sync.js 회차가 부른다).
   사본 둘: IDB 정본(회차가 읽는 값) · localStorage 거울(선수단 화면이 동기로 읽고 먼저 쓰는 값).
   화면 저장(psSaveShared)은 거울을 먼저 쓰고 IDB 를 뒤따라 쓰므로, iOS 종료·저장공간 가득·늦은 IDB 로 둘이 갈라진다.
   3.144 는 갈라진 두 사본 가운데 «옛 거울 ← 서버 원문» 한 경우만 고치고 나머지는 회차 전체를 실패시켰다(roster_copies_differ).
   그 실패는 다음 회차에도 그대로라 끝나지 않았다 — 10/25~10/28 16명 · 800번 넘게, 그 기기는 다른 자료도 받지 못했다(제보 419fead1).
   이제: «옛 쪽»(마지막 확정본·기준본과 같거나 없는 쪽)이 분명하면 새 쪽을 남기고 옛 쪽을 맞춘다.
   둘 다 새것이면 화면이 보이던 거울을 남긴다 — 그 뒤는 보통 길(dirty · 서버 변경 · «자료 확인»)이 맡는다.
   거울이 새것인 경우는 화면 저장(거울 먼저)의 IDB 쓰기가 실패한 흔적이다. pull 의 거울 쓰기 실패는 IDB 를 되돌리므로
   «옛 거울 + 확정본 IDB» 모양을 만들지 않는다 — 거울을 새것으로 보아도 옛 자료를 올리지 않는다.
   회차 끝의 확인 목록 정리는 IDB 값으로 판단하므로 여기서 확인 목록을 만들면 바로 지워진다 — 만들지 않는다.
   값 비교만 한다 — 저장·전송은 sync.js 가 한다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSRosterCopies=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* o: {idb, mirror, server, confirmed(마지막 확정 hash), base(마지막 기준 원문), hash(fn)}
     답: {action:'none'}   같거나 IDB 없음
         {action:'repair'} 한쪽이 서버 원문이고 다른 쪽은 옛것 — 두 사본을 서버 원문으로
         {action:'idb'}    IDB 가 새것(편집 또는 새 pull), 거울은 옛것 — 거울을 IDB 로 맞춘 뒤 다음 회차에 보통 길
         {action:'mirror'} 거울이 새것이거나 둘 다 바뀜 — IDB 를 거울로 맞춘 뒤 다음 회차에 보통 길 */
  function stale(raw,o){
    if(raw===null||raw===undefined)return true;
    if(typeof o.hash==='function'&&o.hash(raw)===(o.confirmed||''))return true;
    return o.base!=null&&raw===o.base;
  }
  function plan(o){
    if(!o||typeof o.idb!=='string'||o.mirror===o.idb)return {action:'none'};
    var server=typeof o.server==='string'?o.server:null,mirrorOld=stale(o.mirror,o),idbOld=stale(o.idb,o);
    if(server!==null&&o.idb===server&&mirrorOld)return {action:'repair'};
    if(mirrorOld)return {action:'idb'};
    if(server!==null&&o.mirror===server&&idbOld)return {action:'repair'};
    return {action:'mirror'};
  }
  return {plan:plan,stale:stale};
});
