/* 일정 «일정 ＋» 시트에서 고른 «팀 공통»이 «훈련»을 누르면 첫 조(A팀)로 바뀌던 것(코치로 일정을 돌려 보다 찾음).
   `wksFillKind('훈련')` 은 고른 조가 없으면 `wksAddSession(di)` 를 조 없이 불렀고, `sesDefaults`(2.483 «새 세션 기본은 첫 조»)가 `grp` 가 비었다고 첫 조를 찍었다 —
   사람이 «팀 공통»을 **고른 것**과 «아직 안 고른 것»이 같은 빈 값이었다. 조를 골랐을 때는 `wksAddSession(di,groups)` 길이라 살아남았다.
   이 모듈은 process.html 본문 뒤에 읽혀 `wksFillKind` 를 감싼다: 세션 없이 연 시트(`__fillNoSes`)에서 조를 다 끈 채(= 팀 공통) 훈련을 고르면 방금 생긴 세션의 `grp` 를 지운다.
   다른 길(세션 카드 «＋ 세션 추가»의 팀 고르개 · 조 필터 · 위저드)의 기본 조는 그대로. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSSchedFillTeam=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* 시트가 고른 대상 → 새 세션의 grp. null = 지운다(팀 공통) · undefined = 손대지 않는다 */
  function chosen(noSes,kind,groups){
    if(!noSes||kind!=='훈련')return undefined;
    var g=(Array.isArray(groups)?groups:[]).filter(function(x){return x!=null&&String(x).trim();});
    return g.length?g.slice():null;
  }
  function mount(W){
    var orig=W.wksFillKind;
    if(typeof orig!=='function'||orig.__psFillTeam)return false;
    var wrapped=function(kind){
      var want,di=-1,before=0,day=null;
      try{want=chosen(__fillNoSes,kind,__fillGroups);di=__fillDi;day=week[di];before=((day&&day.trainings)||[]).length;}catch(_){want=undefined;}   // eslint-disable-line no-undef
      var r=orig.apply(this,arguments);
      if(want===null){
        try{
          var added=day&&(day.trainings||[])[before];
          if(added&&added.grp!=null&&week[di]===day&&day.trainings.length===before+1){   // eslint-disable-line no-undef
            delete added.grp;
            try{save();}catch(_){}   // eslint-disable-line no-undef
            try{syncViews();}catch(_){}   // eslint-disable-line no-undef
            try{wksFillRender(true);}catch(_){}   // eslint-disable-line no-undef
          }
        }catch(_){}
      }
      return r;
    };
    wrapped.__psFillTeam=true;
    W.wksFillKind=wrapped;
    return true;
  }
  return {chosen:chosen,mount:mount};
});
