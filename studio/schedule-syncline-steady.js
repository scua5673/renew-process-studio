/* 일정 위의 «서버 일정» 줄이 편집할 때마다 판을 밀지 않게(코치로 일정을 돌려 보다 찾음).
   고칠 때마다 올라가기 전 몇 초 동안 «이 기기에 서버로 안 올라간 변경 있음 · 지금 주고받기»가 제 줄(.att, 2.979)을 차지했다가 사라져
   주간 판이 약 56px 내려갔다 올라왔다 — 그 사이 누른 손가락이 다른 칸(× · 다른 날)에 떨어졌다.
   이 모듈은 process.html 본문 뒤에 읽혀 그 줄(#schedSync)의 내용이 바뀔 때마다 «까닭이 안 올라간 변경뿐인가»를 보고 `ps-ss-steady` 를 단다:
   · 그럴 때는 제 줄을 차지하지 않고 평소 자리(첫 줄 오른쪽 끝)에서 경고와 단추만 보인다(팀 이름 · 받은 시각은 그동안 걷는다).
   · 넓은 화면(≥901)에서 그 자리는 평소에도 같은 폭(320px)을 차지한다 — 글 길이(«방금» ↔ «12분 전» ↔ 경고)에 따라 옆의 조 고르개가 밀리지 않게.
   · 손쓸 일이 따로 있는 줄(서버 판을 못 받음 · 개인 공간 · 저장 공간 부족 · 단추를 누른 뒤의 결과 문구)은 예전처럼 제 줄 — 편집마다 뜨는 것이 아니다.
   글 · 단추 · 처리기는 본문 그대로(읽기만 한다). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){root.PSSchedSyncSteady=api;api.mount(root);}
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UP=/안 올라간 변경 있음/,VIEW=/조 일정만 보는 중/,GOT=/서버 일정 · .*받음/;
  /* s = {att, text, warns:[경고 글…]} → 제 줄 없이 둬도 되는가 */
  function steady(s){
    if(!s||!s.att||!GOT.test(String(s.text||'')))return false;
    var w=(s.warns||[]).map(String);
    return w.some(function(x){return UP.test(x);})&&w.every(function(x){return UP.test(x)||VIEW.test(x);});
  }
  var B='html body #schedule.active:not(#_):not(#__)>#schedSync';
  var CSS=[
    'html body #schedSync.att.ps-ss-steady:not(#_):not(#__){flex-wrap:nowrap}',
    'html body #schedSync.att.ps-ss-steady:not(#_)>span{flex:0 1 auto;min-width:0;display:flex;justify-content:flex-end;overflow:hidden;white-space:nowrap}',
    /* 평소 자리에서는 경고만 — 팀 이름 · 받은 시각(가운데가 잘린 «…금 판 받음»)은 걷는다. 받은 시각은 경고가 걷히면 다시 보인다 */
    'html body #schedSync.att.ps-ss-steady:not(#_)>span{font-size:0}',
    'html body #schedSync.att.ps-ss-steady:not(#_)>span>b:not(.ss-warn){display:none}',
    'html body #schedSync.att.ps-ss-steady:not(#_)>span>.ss-warn{flex:0 0 auto;font-size:12px;margin-left:8px}',
    'html body #schedSync.att.ps-ss-steady #schedSyncNow:not(#_):not(#__):not(#___){flex:0 0 auto;width:auto;height:40px;min-height:40px;padding:0 12px;font-size:12px;font-weight:600;line-height:1;white-space:nowrap}',
    '@media (min-width:901px){',
    B+':not(.att),'+B+'.att.ps-ss-steady{flex:0 0 320px;order:-1;margin:0 14px 12px 0;gap:6px;flex-wrap:nowrap;justify-content:flex-end;font-size:12px;font-weight:500;white-space:nowrap}',
    B+':not(.att)>span{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis}',
    '}'
  ].join('\n');
  function read(box){
    return {att:box.classList.contains('att'),text:box.textContent||'',warns:[].map.call(box.querySelectorAll('.ss-warn'),function(b){return b.textContent||'';})};
  }
  function mount(W){
    var doc=W.document,box=doc&&doc.getElementById('schedSync');
    if(!box||box.__psSteady)return false;
    box.__psSteady=true;
    try{var st=doc.createElement('style');st.id='ps-sched-syncline-steady-css';st.textContent=CSS;(doc.head||doc.documentElement).appendChild(st);}catch(_){}
    function sync(){
      var on=false;try{on=steady(read(box));}catch(_){}
      if(box.classList.contains('ps-ss-steady')!==on)box.classList.toggle('ps-ss-steady',on);   /* 다를 때만 — 감시는 내용(childList)만 본다 */
    }
    try{if(W.MutationObserver)new W.MutationObserver(sync).observe(box,{childList:true});}catch(_){}
    sync();
    return true;
  }
  return {CSS:CSS,steady:steady,mount:mount};
});
