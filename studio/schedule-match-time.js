/* 3.265 — 경기 날의 «시간 ＋»는 경기 시각을 정한다(코치로 일정을 돌려 보다 찾음).
   빈 날 «일정 ＋» → 종류 «컵 · 리그 · 친선»을 고르면 채우기 시트는 세션 없는 경기 날인데 머리의 «시간 ＋»가 그대로 `wksPickSes(di,'','time')` 였다 —
   누르기만 해도 `ensureSlotSession` 이 경기 날에 훈련 세션(RPE 5)을 만들고 경기 시각은 그대로 비었다(선수 «오늘»에 «경기 … RPE 5»).
   이 모듈은 process.html 본문 뒤에 읽혀 `wksPickSes` · `wksFillRender` 를 감싼다: 세션 없는 경기 날의 시간 단추는 경기 시각 고르개(`PSSchedMatchTime.open`)로,
   머리 글자는 «경기 시간 ＋» / «경기 14:00». 세션이 있는 날 · 훈련 날은 예전 길 그대로. 경기 시각은 `day.match.time`(허브 «편집»의 #mTime 과 같은 칸) + 옛 보드 `b.time`. */
(function(){
  'use strict';
  function wk(){try{return week;}catch(_){return null;}}
  function dayOf(di){var w=wk();return (w&&w[di])||null;}
  function isMatch(di){var d=dayOf(di);if(!d)return false;if(d.match)return true;try{return dayBoard(d).sched==='경기';}catch(_){return false;}}
  function hasSlot(di,slot){var d=dayOf(di);return !!(d&&(d.trainings||[]).some(function(t){return String((t&&t.slot)||'')===String(slot||'');}));}
  function esc(s){try{return wkbdEsc(String(s==null?'':s));}catch(_){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}}
  function blocked(){try{if(schedEditBlocked()){schedBlockNotice();return true;}}catch(_){}return false;}
  var OPTS=['10:00','11:00','13:00','14:00','15:00'];
  function open(di){
    if(blocked())return;
    var d=dayOf(di);if(!d)return;
    var cur=(d.match&&d.match.time)||'';
    var sheet=document.getElementById('sheet'),scrim=document.getElementById('scrim');if(!sheet)return;
    sheet.innerHTML='<button class="closex" onclick="closeSheet()" aria-label="닫기">×</button><h3>'+esc(d.d)+'요일 경기 — 시간</h3>'
      +'<div class="pksub sm">자주 쓰는 시각</div><div class="fmtpick">'
      +OPTS.map(function(x){return '<button type="button" class="fp'+(cur===x?' on':'')+'" onclick="PSSchedMatchTime.set('+di+',\''+x+'\')">'+x+'</button>';}).join('')
      +(cur?'<button type="button" class="fp" onclick="PSSchedMatchTime.set('+di+',\'\')">지우기</button>':'')
      +'</div><div class="pksub sm">또는 직접 입력</div><input id="psMtFree" class="stime" type="time" value="'+esc(cur)+'" style="width:100%">'
      +'<div class="wf-sec"><button type="button" class="btn" onclick="PSSchedMatchTime.set('+di+',document.getElementById(\'psMtFree\').value)">적용</button></div>';
    if(scrim)scrim.classList.add('show');
  }
  function set(di,v){
    if(blocked())return;
    var d=dayOf(di);if(!d)return;
    v=String(v==null?'':v).trim();if(v&&!/^\d{1,2}:\d{2}$/.test(v)){try{toast('시각은 14:00 처럼');}catch(_){}return;}
    if(!d.match)d.match={time:'',opp:''};
    d.match.time=v;d.rest=false;d.off=false;
    try{var b=dayBoard(d);b.sched='경기';b.time=v;}catch(_){}
    try{psAct('a_week');}catch(_){}
    try{save();}catch(_){}
    try{closeSheet();}catch(_){}
    syncViews();
  }
  var oPick=window.wksPickSes;
  if(typeof oPick==='function')window.wksPickSes=function(di,slot,kind){
    if(kind==='time'&&String(slot||'')===''&&isMatch(di)&&!hasSlot(di,'')){open(di);return;}
    return oPick.apply(this,arguments);
  };
  var oRender=window.wksFillRender;
  if(typeof oRender==='function')window.wksFillRender=function(){
    var r=oRender.apply(this,arguments);
    try{
      var di=__fillDi;
      if(__fillNoSes&&isMatch(di)&&!hasSlot(di,'')){
        var el=document.querySelector('#sheet .wf-time');
        if(el){var t=(dayOf(di).match&&dayOf(di).match.time)||'';el.textContent=t?('경기 '+t):'경기 시간 ＋';el.setAttribute('onclick','wksPickSes('+di+',\'\',\'time\')');}
      }
    }catch(_){}
    return r;
  };
  window.PSSchedMatchTime={open:open,set:set,isMatch:isMatch,OPTS:OPTS};
})();
