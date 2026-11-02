/* Read-only match presentation for the coach's selected day. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSMatchHome=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function resolve(matches,target){
    var rows=(matches||[]).filter(function(m){return m&&m.date===target.date;});
    if(target.id)rows=rows.filter(function(m){return m.id===target.id;});
    else if(target.sourceId)rows=rows.filter(function(m){return m.sourceId===target.sourceId;});
    else return null;
    return rows.length===1?rows[0]:null;
  }
  function describe(m,status){
    m=m||{};
    var us=m.scoreUs==null?'':String(m.scoreUs).trim(),them=m.scoreThem==null?'':String(m.scoreThem).trim();
    var score=us||them?(us||'—')+' : '+(them||'—'):'';
    var labels={played:'결과 입력됨',reviewing:'리뷰 작성 중',review:'리뷰 기록됨',unrecorded:'지난 경기 · 결과 미입력'};
    var review=Object.prototype.hasOwnProperty.call(labels,status);
    return {sub:review?[score,labels[status]].filter(Boolean).join(' · '):'경기 계획과 출전 인원을 최종 확인',
      stage:review?'review':'prep',label:status==='unrecorded'?'결과·리뷰 입력':review?'경기 리뷰 열기':'경기 준비 열기'};
  }
  return {resolve:resolve,describe:describe};
});
