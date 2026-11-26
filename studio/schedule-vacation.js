/* 3.380 — 일정 종류 «휴가»(제보 9f762d66 «훈련, 친선경기, 대회 이런 식으로 있는데 휴가도» · 사용자 11/26 «휴가도 따로 만들자» → 목업 `UI-일정-휴가-목업-2026-11-26.html` A안).
   **저장은 OFF + 표식**이다 — 쉬는 날을 읽는 곳(요약 · 팀 «오늘» · 출석 · IDP · 연간 · 옛 판 앱)이 `day.off` · `board.sched==='OFF'` · `groupKinds[조]==='OFF'` 수십 곳이라
   종류 값을 새로 만들지 않는다. 하루 전체 = `day.vac:true`, 조별 = `day.vacGrp:{조:1}`. OFF 가 아닌 날의 표식은 뜻이 없고 저장 때마다 걷는다(`tidy`).
   process.html 은 크기 예산에 닿아 있어 짧은 이름으로 부른다:
     K 종류 칩(훈련 · OFF · 휴가) · u(day,조들,cur) 채우기 창의 지금 종류 · n(day) 지금 보기(조)로 본 이름 «휴가»/«OFF» · c(day) ' is-vac' · g(day,조) 조 줄의 이름 ·
     v(day) 요약에 셀 수 · s(c) 요약 «휴식» 칸의 작은 글.
   고르는 길: 채우기 창의 «휴가» 칩 → `wksFillKind('휴가')` 를 감싸 OFF 로 넘기고, 그 안에서 불리는 `setSched` · `wksSetGroupKind` 가 표식을 단다(다른 종류를 고르면 뗀다). */
(function(root,factory){var api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.PSSchedVac=api;root.PSVac=api;}
})(typeof window!=='undefined'?window:null,function(W){
  'use strict';
  var VAC='휴가',OFF='OFF';
  var K=[['훈련','#C24A46'],[OFF,'#8A9099'],[VAC,'#64748B']];
  function own(o,k){ return !!(o&&typeof o==='object'&&Object.prototype.hasOwnProperty.call(o,k)); }
  function isOff(day){ return !!(day&&(day.off||(day.board&&day.board.sched===OFF))); }
  function whole(day){ return !!(day&&day.vac===true&&isOff(day)); }
  function kindOf(day,g){ var k=day&&day.groupKinds; return own(k,g)?k[g]:''; }
  function grp(day,g){ return !!(g&&kindOf(day,g)===OFF&&own(day.vacGrp,g)); }
  /* 조별 지정만으로 쉬는 날(하루 OFF 는 아님) — 쉬는 조가 모두 휴가면 휴가 */
  function allGrp(day){
    var k=day&&day.groupKinds; if(!k||typeof k!=='object')return false;
    var offs=Object.keys(k).filter(function(g){ return k[g]===OFF; });
    return offs.length>0&&offs.every(function(g){ return own(day.vacGrp,g); });
  }
  /* view = 지금 보는 조('' = 전체) */
  function is(day,view){
    if(!day||typeof day!=='object')return false;
    if(view)return grp(day,view)||(!kindOf(day,view)&&whole(day));
    return whole(day)||allGrp(day);
  }
  function viewNow(){ try{ return (typeof __schedGrp==='string'&&__schedGrp)?__schedGrp:''; }catch(_){ return ''; } }
  function n(day){ return is(day,viewNow())?VAC:OFF; }
  function c(day){ return is(day,viewNow())?' is-vac':''; }
  function g(day,group){ return grp(day,group)?VAC:OFF; }
  function v(day){ return is(day,viewNow())?1:0; }
  function s(count){ var k=count&&(count.vac|0); return k>0?(VAC+' '+k):''; }
  function u(day,groups,cur){
    if(cur!==OFF)return cur;
    groups=Array.isArray(groups)?groups:[];
    if(groups.length)return groups.every(function(x){ return grp(day,x)||(!kindOf(day,x)&&whole(day)); })?VAC:OFF;
    return whole(day)?VAC:OFF;
  }
  /* 표식 달기 · 떼기 — 순수(시험용) */
  function setWhole(day,on){ if(!day)return; if(on)day.vac=true; else delete day.vac; }
  function setGrp(day,group,on){
    if(!day||!group)return;
    if(on){ if(!day.vacGrp||typeof day.vacGrp!=='object')day.vacGrp={}; Object.defineProperty(day.vacGrp,group,{value:1,enumerable:true,writable:true,configurable:true}); }
    else if(day.vacGrp){ if(own(day.vacGrp,group))delete day.vacGrp[group]; if(!Object.keys(day.vacGrp).length)delete day.vacGrp; }
  }
  /* OFF 가 아닌 날 · 조에 남은 표식을 걷는다. 바꾼 날 수 */
  function tidy(days){
    var nfix=0;
    (Array.isArray(days)?days:[]).forEach(function(day){
      if(!day||typeof day!=='object')return;
      var hit=false;
      if(day.vac!==undefined&&!(day.vac===true&&isOff(day))){ delete day.vac; hit=true; }
      if(day.vacGrp!==undefined){
        if(!day.vacGrp||typeof day.vacGrp!=='object'||Array.isArray(day.vacGrp)){ delete day.vacGrp; hit=true; }
        else{ Object.keys(day.vacGrp).forEach(function(x){ if(kindOf(day,x)!==OFF){ delete day.vacGrp[x]; hit=true; } }); if(!Object.keys(day.vacGrp).length)delete day.vacGrp; }
      }
      if(hit)nfix++;
    });
    return nfix;
  }
  function tidyAll(map){ var t=0; try{ Object.keys(map||{}).forEach(function(r){ t+=tidy(map[r]); }); }catch(_){ t=-1; } return t; }

  var HATCH='repeating-linear-gradient(135deg,transparent 0 7px,rgba(100,116,139,.2) 7px 14px)';
  var CSS='.wks-day.is-off.is-vac:not(#_){background-image:'+HATCH+'}'
    +'.wks-day.is-vac .wks-kind .wks-kbtn:not(#_){background:#64748B;border-color:#64748B;color:#fff}'
    +'.mcell.off.is-vac:not(#_){background-image:'+HATCH+'}'
    +'.mcell.is-vac .mkind.k-off:not(#_){background:#64748B;color:#fff}';
  var pending=false;
  function mount(win){
    if(!win||!win.document||win.__psVacMounted)return false;
    win.__psVacMounted=true;
    try{ if(win.document.head&&!win.document.getElementById('ps-vac-css')){ var st=win.document.createElement('style'); st.id='ps-vac-css'; st.textContent=CSS; win.document.head.appendChild(st); } }catch(e){ api.err=String(e&&e.message||e); }
    var fillKind=win.wksFillKind;
    if(typeof fillKind==='function')win.wksFillKind=function(kind){
      /* 하루 전체가 이미 쉬는 날이면 OFF ↔ 휴가는 이름만 바꾼다 — 창이 조를 고른 채 열려도 조별 OFF 를 더 만들지 않는다(하루 전체 표식이 안 풀리던 길) */
      if(kind===VAC||kind===OFF){
        var d0=null; try{ d0=(typeof week!=='undefined'&&week&&typeof __fillDi!=='undefined')?week[__fillDi]:null; }catch(e){ d0=null; }
        if(d0&&isOff(d0)){
          if(typeof win.schedEditBlocked==='function'&&win.schedEditBlocked()){ if(typeof win.schedBlockNotice==='function')win.schedBlockNotice(); return; }
          setWhole(d0,kind===VAC);
          win.save(); if(typeof win.syncViews==='function')win.syncViews(); if(typeof win.closeSheet==='function')win.closeSheet();
          return;
        }
      }
      if(kind!==VAC)return fillKind.apply(this,arguments);
      pending=true;
      try{ return fillKind.call(this,OFF); }finally{ pending=false; }
    };
    var setSched=win.setSched;
    if(typeof setSched==='function')win.setSched=function(r,col,val){
      var on=pending&&val===OFF,day=null;
      try{ day=(typeof weeksMap!=='undefined'&&weeksMap[r])?weeksMap[r][col]:null; }catch(e){ day=null; }
      if(day)setWhole(day,on);
      var out=setSched.apply(this,arguments);
      if(!day&&on){ try{ day=weeksMap[r][col]; setWhole(day,true); win.save(); if(typeof win.syncViews==='function')win.syncViews(); }catch(e){ api.err=String(e&&e.message||e); } }
      return out;
    };
    var setGK=win.wksSetGroupKind;
    if(typeof setGK==='function')win.wksSetGroupKind=function(di,group,kind){
      try{ var day=(typeof week!=='undefined'&&week)?week[di]:null; if(day&&group&&['','훈련',OFF].indexOf(kind)>=0)setGrp(day,group,pending&&kind===OFF); }catch(e){ api.err=String(e&&e.message||e); }
      return setGK.apply(this,arguments);
    };
    var save=win.save;
    if(typeof save==='function')win.save=function(){
      try{ if(typeof weeksMap!=='undefined')tidyAll(weeksMap); }catch(e){ api.err=String(e&&e.message||e); }
      return save.apply(this,arguments);
    };
    return true;
  }
  var api={K:K,u:u,n:n,c:c,g:g,v:v,s:s,is:is,whole:whole,grp:grp,setWhole:setWhole,setGrp:setGrp,tidy:tidy,tidyAll:tidyAll,mount:mount,CSS:CSS,err:''};
  if(W&&W.document){
    if(W.document.readyState==='loading')W.document.addEventListener('DOMContentLoaded',function(){ mount(W); });
    else mount(W);
  }
  return api;
});
