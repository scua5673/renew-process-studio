/* 3.287 — 경기 종류 한 곳(제보 39338d23 «일정 추가에 경기 - 대회» · 7f00f3c9 «토너먼트 대회» — 두 팀, 사용자 11/14 «대회는 정식»).
   종류는 넷: 리그 official · 컵 cup · 대회 tour · 친선 friendly. 차례도 이대로(정식 셋 → 친선).
   · 전적: 친선이 아닌 것은 모두 정식(공식전)이다 — scout.html `matchKindOf` 가 친선만 가른다(컵 · 대회는 그대로 공식전).
   · 옛 저장본(구분 없음) · 모르는 값은 리그로 읽는다(2.316 컵을 더할 때와 같은 규칙). 저장 칸은 그대로 `kind` — 새 저장 키 없음.
   · 색: 리그 --match · 컵 --warm · 친선 --fri(process.html) · 대회 --tour(여기). 월간 칸 · 고르개의 대회 규칙도 여기서 붙인다
     (process.html 크기 예산 — tests/code-budget-3043).
   일정(process.html) · 경기(scout.html)가 머리에서 읽는다 — 본문 스크립트가 부팅 때 바로 부른다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSMatchKind=api;try{api.style(root.document);}catch(_){}}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* [값, 이름, 색] — 색은 일정 시트의 점(cdot)과 같은 값 */
  var LIST=[['official','리그','#C24A46'],['cup','컵','#B5762B'],['tour','대회','#0E7490'],['friendly','친선','#7C5CC4']];
  var LB={};LIST.forEach(function(o){LB[o[0]]=o[1];});Object.freeze(LB);
  function has(k){return typeof k==='string'&&Object.prototype.hasOwnProperty.call(LB,k);}
  function norm(k){return has(k)?k:'official';}
  /* 이름 — 모르는 값은 리그(fb 를 주면 그것) */
  function label(k,fb){return has(k)?LB[k]:(fb===undefined?LB.official:fb);}
  function official(k){return norm(k)!=='friendly';}
  /* 일정 시트 단추 표 [이름, 색, 값](process.html 의 옛 SCHED_FIX 모양) */
  function fix(){return LIST.map(function(o){return [o[1],o[2],o[0]];});}
  /* 고르개 seg 의 options */
  function options(){return LIST.map(function(o){return {value:o[0],label:o[1]};});}
  /* 월간 칸의 종류 class — 리그는 없음 */
  function cls(k){k=norm(k);return k==='official'?'':' '+k;}
  var CSS=':root{--tour:#0E7490;--tour-soft:rgba(14,116,144,.09);--tour-line:rgba(14,116,144,.32)}'
    +'body.fmdark{--tour:#21A3C9;--tour-soft:rgba(33,163,201,.16);--tour-line:rgba(33,163,201,.42)}'
    +'.mcell .mkind.k-tour{background:var(--tour)}'
    +'.mcell.m.tour{border-color:var(--tour-line);background:var(--tour-soft);border-top-color:var(--tour)}'
    +'.mpop .mp-kind button[data-mk="tour"] .kd{background:var(--tour)}'
    +'.mpop .mp-kind button.on[data-mk="tour"]{border-color:var(--tour);background:var(--tour-soft);color:var(--tour)}';
  function style(doc){
    if(!doc||!doc.createElement||doc.getElementById('ps-match-kind'))return;
    var s=doc.createElement('style');s.id='ps-match-kind';s.textContent=CSS;
    (doc.head||doc.documentElement).appendChild(s);
  }
  return {LIST:LIST,LB:LB,has:has,norm:norm,label:label,official:official,fix:fix,options:options,cls:cls,CSS:CSS,style:style};
});
