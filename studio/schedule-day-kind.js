/* 일정 화면이 하루의 종류를 `PSSchedule.dayKind`(storage.js) 한 규칙으로 읽게 한다.
   한 팀을 OFF 로 돌린 날(day.groupKinds)에 열리는 세션 · «훈련»으로 정한 조 · 주인 있는 보드 칩이 하나도 없으면 그 날은 OFF 다 — 예전엔 종류 칩 «훈련 ▾» ·
   요약 «계획만 1일» · 주간 PDF «훈련 · 세부 미정»이 `board.sched`(지운 세션이 남긴 «훈련»)만 보고 말했다.
   process.html 본문 뒤에 읽혀 두 함수를 감싼다(저장본 · `week` 원본은 읽기만):
   · `schedViewDay` — 요약 · 월간 · 연간 · 일간 · 인쇄(`week.map(schedViewDay)`)가 읽는 «지금 보기로 본 하루»에 `PSSchedule.effectiveDay` 를 한 번 더.
   · `wksGroupKind(day, 조)` — 그 조의 지정이 없을 때 하루가 OFF 로 읽히면 'OFF'(주간 카드의 종류 칩 · 채우기 시트의 «종류»). 조에 지정이 있으면 그 값 그대로.
   팀 «오늘» · 출석 · IDP · 플레이북은 `PSSchedule.view('')` 가 같은 규칙의 사본을 준다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSSchedDayKind=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function ps(W){return W&&W.PSSchedule&&typeof W.PSSchedule.dayKind==='function'&&typeof W.PSSchedule.effectiveDay==='function'?W.PSSchedule:null;}
  /* 하루 OFF 가 «읽어서» 나온 것인가 — 저장본이 이미 OFF 면 거짓(예전 길 그대로) */
  function derivedOff(PS,day){
    if(!PS||!day||!day.groupKinds)return false;
    var b=day.board||{};
    return !(day.off||b.sched==='OFF')&&PS.dayKind(day)==='OFF';
  }
  function mount(W){
    var done=false;
    var view=W.schedViewDay;
    if(typeof view==='function'&&!view.__psDayKind){
      var wv=function(day){
        var v=view.apply(this,arguments),PS=ps(W);
        try{return PS?PS.effectiveDay(v):v;}catch(_){return v;}
      };
      wv.__psDayKind=true;W.schedViewDay=wv;done=true;
    }
    var kind=W.wksGroupKind;
    if(typeof kind==='function'&&!kind.__psDayKind){
      var wk=function(day,g){
        var k=kind.apply(this,arguments);
        if(k)return k;
        try{return derivedOff(ps(W),day)?'OFF':k;}catch(_){return k;}
      };
      wk.__psDayKind=true;W.wksGroupKind=wk;done=true;
    }
    return done;
  }
  return {derivedOff:derivedOff,mount:mount};
});
