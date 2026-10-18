/* PROCESS STUDIO · IDP 선수단 명단 다시 묻기(오류 제보 8d8daa7e «IDP»)
   선수단 화면은 팀 운영(scout.html)에 명단을 한 번 묻고(teamEvalList) 그 답을 계속 쓴다.
   앱을 다시 연 직후처럼 팀 자료가 아직 안 왔을 때 물으면 «빈 명단»이 와서, 자료가 다 들어온 뒤에도
   «명단이 비어 있어요»로 남았다(코치 피드백이 «전부 없어졌다»로 보였다). 빈 답·못 받은 답이면 조용히 다시 묻는다.
   읽기만 한다 — 저장하지 않고, 선수가 든 답만 반영한다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSIdpRosterRefresh=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function players(r){return r&&Array.isArray(r.players)?r.players:[];}
  /* o.stale() — 지금 든 명단을 다시 물어야 하나(비었거나 못 받음) · o.ask() — 다시 묻기(Promise) · o.apply(r) — 받은 명단 반영 */
  function create(o){
    var later=o.setTimeout||setTimeout,timer=null,busy=false,tries=0,max=o.max||40,gap=o.delay||1500;
    function stale(){try{return !!o.stale();}catch(_){return false;}}
    function run(){
      timer=null;if(busy||!stale())return;busy=true;tries++;
      Promise.resolve().then(o.ask).then(function(r){
        busy=false;if(!stale())return;
        if(r&&r.ok&&players(r).length){tries=0;o.apply(r);return;}
        if(tries<max)poke();
      },function(){busy=false;if(stale()&&tries<max)poke();});
    }
    /* fresh — 팀 자료가 새로 들어왔다는 신호(storage 이벤트). 횟수를 처음부터 센다 */
    function poke(ms,fresh){
      if(fresh)tries=0;
      if(timer||!stale()||tries>=max)return false;
      timer=later(run,ms==null?gap:ms);return true;
    }
    return {poke:poke,waiting:function(){return !!timer||busy;}};
  }
  return {create:create,players:players};
});
