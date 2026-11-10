/* 세션 × — 지운 직후 «되돌리기»를 보여 준다 + 좁은 칸에서 × · 시각이 잘리지 않게(코치로 일정을 돌려 보다 찾음).
   ① 빈 세션은 × 한 번에 바로 지워진다(2.134 «빠르게 지운다»). 되돌리는 길은 화면 맨 아래 ⋯ › 되돌리기뿐이라 잘못 누르면 그대로 잃었다.
      `wksDelSlot` 을 감싸 실제로 지워졌을 때(바로 · 확인 창 «확인» 뒤) 월간 팝업과 같은 알림(`_mpUndoToast`, 7초)을 띄운다.
      되돌리기는 **원래 기록**(`doUndo` — 주간 액션바와 같은 60개 기록)을 쓴다. 두 번째 기록을 만들지 않는다 — 그 사이 다른 편집이 있었으면
      (기록의 맨 위가 지운 직후 판이 아니면) 엉뚱한 것을 되돌리지 않고 ⋯ › 되돌리기를 안내한다.
   ② 주간 칸(약 140px)에 «조 · 시간대 · 시각 · ×» 넷이 한 줄에 안 들어가 시각 끝과 × 가 칸 밖(overflow:hidden)으로 잘렸다 —
      «A팀 · B팀» 날은 × 가 아예 안 보였다. × 는 머리줄 오른쪽 위에 고정하고 나머지는 넘치면 다음 줄로.
      손가락(pointer:coarse)에서는 × 의 누르는 자리만 44px(모양 · 글자는 그대로, 그 자리는 머리줄의 오른쪽 여백으로 비워 둔다). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSSchedDelUndo=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var S='html body .wks .wks-sh';
  var CSS=[
    S+':not(#_){flex-wrap:wrap;row-gap:2px;position:relative;padding-right:22px}',
    S+'>.wks-x:not(#_){position:absolute;top:0;right:-3px;margin-left:0}',
    '@media (pointer:coarse){',
    S+':not(#_){padding-right:40px}',
    S+'>.wks-x:not(#_)::after{content:"";position:absolute;top:50%;right:-4px;width:44px;height:44px;transform:translateY(-50%)}',
    '#mpUndo button{min-height:44px!important;padding:2px 10px!important}',
    '}'
  ].join('\n');
  /* 그 시간대에 붙은 것(세션 + 그 슬롯의 칩) 수 — 지워졌는지 가르는 데 쓴다 */
  function count(day,slot){
    if(!day)return 0;
    var sl=String(slot||''),b=day.board||{},n=0;
    (day.trainings||[]).forEach(function(t){if(String((t&&t.slot)||'')===sl)n++;});
    [['trains','trainSlot'],['meets','meetSlot'],['warms','warmSlot'],['libs','libSlot']].forEach(function(k){
      (b[k[0]]||[]).forEach(function(_v,i){if(String(((b[k[1]]||[])[i])||'')===sl)n++;});
    });
    return n;
  }
  /* 되돌려도 되는가 — 기록의 맨 위가 지운 직후 판 그대로일 때만 */
  function canUndo(hist,mark){return !!(hist&&hist.length>=2&&typeof mark==='string'&&hist[hist.length-1]===mark);}
  function mount(W){
    var doc=W.document;
    try{if(doc&&!doc.getElementById('ps-sched-del-undo-css')){var st=doc.createElement('style');st.id='ps-sched-del-undo-css';st.textContent=CSS;(doc.head||doc.documentElement).appendChild(st);}}catch(_){}
    var orig=W.wksDelSlot;
    if(typeof orig!=='function'||orig.__psDelUndo)return false;
    function hist(){try{return __hist;}catch(_){return null;}}   // eslint-disable-line no-undef
    function dayOf(di){try{return week[di];}catch(_){return null;}}   // eslint-disable-line no-undef
    function say(m){try{W.toast(m);}catch(_){}}
    function offer(){
      /* save() 는 이 일의 끝(마이크로태스크)에 기록을 남긴다 — 그 뒤에 맨 위 판을 적어 둔다 */
      W.setTimeout(function(){
        var h=hist(),mark=h&&h.length?h[h.length-1]:null;
        if(!canUndo(h,mark)||typeof W._mpUndoToast!=='function'||typeof W.doUndo!=='function')return;
        W._mpUndoToast('세션을 지웠어요',function(){
          if(canUndo(hist(),mark))W.doUndo();
          else say('그 뒤에 다른 편집이 있어요 — 아래 ⋯ › 되돌리기로 하나씩 되돌릴 수 있어요');
        });
      },0);
    }
    var wrapped=function(di,slot){
      var before=count(dayOf(di),slot),done=false,pc=W.psConfirm,swapped=false;
      function after(){if(done||!before||count(dayOf(di),slot))return;done=true;offer();}
      /* 지우기 직전 판을 원래 기록에 적어 둔다(pushHist — 맨 위와 같으면 아무 일도 없다). 기록은 저장할 때만 쌓여서, 앱을 열고 처음 한 편집은
         돌아갈 판이 없었고(«되돌릴 게 없어요») 다른 기기에서 받은 변경도 기록에 없었다 — 되돌리기는 늘 «지우기 바로 앞»으로 간다. */
      if(before){try{if(typeof W.pushHist==='function')W.pushHist();}catch(_){}}
      /* 내용이 있는 세션은 확인 창을 거친다 — «확인»을 누른 뒤에야 지워진다 */
      if(before&&typeof pc==='function'){
        swapped=true;
        W.psConfirm=function(msg,ok,cancel){W.psConfirm=pc;swapped=false;return pc.call(this,msg,function(){if(ok)ok();after();},cancel);};
      }
      try{return orig.apply(this,arguments);}
      finally{if(swapped)W.psConfirm=pc;after();}
    };
    wrapped.__psDelUndo=true;W.wksDelSlot=wrapped;
    return true;
  }
  return {CSS:CSS,count:count,canUndo:canUndo,mount:mount};
});
