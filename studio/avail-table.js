/* 3.308 — 가용인원 › 날짜별 명단을 표로(사용자 11/17 노션 표 «이런식으로 보이게» → 목업 B안: 조마다 묶음 · 학년은 묶음 줄 ·
   열 번호 · 조 · 이름 · 포지션 · 상태 · 부상 · 메모) + «이름 앞에 A팀 B팀 눌러서 선택» = 조 칩 → grpPickOpen(선수단 표의 조 칩과 같은 길).
   scout.html 의 renderAvailDaily 가 머리(날짜 · 묶기) · 바닥(안내 · 일정 · 세션 만들기)을 그리고, 몸통은 avTableBody 가 돌려준다.
   셈(가능 · 쉼 · 필드 · GK · 세션 인원 rc)은 2.942 · 2.956 그대로. 폰(≤600)은 세 열 + «운동 / 참여 못 함» 두 덩어리(2.939 그대로).
   데스크톱은 쉼 선수가 제 학년 자리 아래에(avGroups 가 쉼을 뒤로 세운다) 옅은 줄로 — 2.942 의 조 끝 «쉼 상자»는 걷었다.
   데이터는 모두 있던 것(상태 · 그날 사유 · 부상 기록 · 조 · 학년 · 포지션) — 새 저장 칸 없음. 새 시험 avail-table-3308. */
'use strict';
var AV_TABLE_COLS=7,AV_TABLE_PHONE_COLS=3;
/* 조 칩 — 편집 권한이 있으면 단추(누르면 조 고르개), 없으면 글자만 */
function avGrpChip(p){
  var g=plGrpOf(p),lb=g?(tmGrpLabel(g)||g):'조 없음',can=typeof tmAudienceEditable==='function'&&tmAudienceEditable();
  if(!can)return '<span class="av-grp-chip ro">'+esc(lb)+'</span>';
  return '<button type="button" class="av-grp-chip" data-av-grp="'+esc(p.id)+'" aria-label="'+esc((p.name||'선수')+' 조 고르기 — 지금 '+lb)+'">'+esc(lb)+'<span aria-hidden="true"> ⌄</span></button>';
}
/* 3.363 포지션 칩 — 편집 권한이 있으면 단추(누르면 선수단 표와 같은 포지션 고르개), 없으면 글자만 */
function avPosChip(p){
  var pos=avPosition(p),gk=avIsGk(p),can=typeof tmAudienceEditable==='function'&&tmAudienceEditable();
  if(!can)return '<span class="av-pos'+(gk?' gk':'')+'">'+esc(pos)+'</span>';
  return '<button type="button" class="av-pos av-pos-chip'+(gk?' gk':'')+(pos?'':' none')+'" data-av-pos="'+esc(p.id)+'" aria-label="'+esc((p.name||'선수')+' 포지션 고르기 — 지금 '+(pos||'미지정'))+'">'+esc(pos||'–')+'<span aria-hidden="true"> ⌄</span></button>';
}
/* 부상 칸 — 그날 상태가 부상 · 재활일 때, 그날에 걸친 부상 기록의 부위 · 며칠째(선수 카드의 부상 기록과 같은 값). 적는 곳은 상태 칩 › 부상 시트 그대로 */
function avOutDays(p,day){
  var n=0;try{var a=(data.meta&&data.meta.statusRuns&&data.meta.statusRuns[p.id])||[];for(var i=a.length-1;i>=0;i--){var x=a[i];if(x.s==='out'&&x.from<=day&&(x.to>=day||i===a.length-1)){n=stDayDiff(x.from,day)+1;break;}}}catch(e){n=0;}
  return n;
}
function avInjCell(p,day,r){
  if(r&&r.s==='out'){var n=avOutDays(p,day);return n>1?'<span class="av-inj nopart"><small>'+n+'일째</small></span>':'';}   /* 3.372 — 이어지는 불참은 며칠째인지(되돌리기를 잊은 값이 보이게) */
  if(!r||(r.s!=='injury'&&r.s!=='rehab'))return '';
  var e=null;try{e=stEpisodes(p).filter(function(x){return x.from<=day&&(x.open||x.to>=day);}).pop()||null;}catch(_){e=null;}
  if(!e)return '';
  var days=0;try{days=stDayDiff(e.from,day)+1;}catch(_){days=0;}
  return '<span class="av-inj'+(e.part?'':' nopart')+'">'+esc(stInjLabel(e))+(days>0?'<small>'+days+'일째</small>':'')+'</span>';
}
function avTableRow(p,day,r,phone){
  var rest=!!(r.s&&r.s!=='ok'),name=avProfileLink(p)+avYearTag(p);
  if(phone)return '<tr class="av-pl'+(rest?' rest':'')+'" data-av-pid="'+esc(p.id)+'"><td class="c-nm">'+name+avGrpChip(p)+'<small class="sub">'+(p.num?esc(p.num)+' · ':'')+avPosChip(p)+'</small></td><td class="c-st">'+avEditButton(p,day,r)+'</td><td class="c-ij">'+avInjCell(p,day,r)+(r.note?'<small class="av-player-note">'+esc(r.note)+'</small>':'')+'</td></tr>';
  return '<tr class="av-pl'+(rest?' rest':'')+'" data-av-pid="'+esc(p.id)+'"><td class="c-no"><span class="no">'+esc(p.num||'–')+'</span></td><td class="c-grp">'+avGrpChip(p)+'</td><td class="c-nm">'+name+'</td><td class="c-pos">'+avPosChip(p)+'</td><td class="c-st">'+avEditButton(p,day,r)+'</td><td class="c-ij">'+avInjCell(p,day,r)+'</td><td class="c-memo">'+(r.note?'<span class="av-player-note">'+esc(r.note)+'</span>':'')+'</td></tr>';
}
function avTableHead(phone){
  return phone?'<thead><tr><th class="c-nm">이름</th><th class="c-st">상태</th><th class="c-ij">부상 · 메모</th></tr></thead>'
    :'<thead><tr><th class="c-no">번호</th><th class="c-grp">조</th><th class="c-nm">이름</th><th class="c-pos">포지션</th><th class="c-st">상태</th><th class="c-ij">부상</th><th class="c-memo">메모</th></tr></thead>';
}
/* 몸통 — {html,total,rc}. ⚠ 행(data-av-st · 이름 · 조 칩)은 한 번만 그린다(두 벌을 그려 CSS 로 고르면 같은 단추가 둘이 된다, 2.939) */
function avTableBody(ours,day){
  var total={ok:0,rest:0,scheduled:0},rc={gk:0,field:0,rehab:0,out:0};
  var split=tmPhoneRows(),cols=split?AV_TABLE_PHONE_COLS:AV_TABLE_COLS,okSec='',restSec='',okTot=0,restTot=0,rows='';
  avGroups(ours,day).forEach(function(group){
    var okRows='',restRows='',gRows='',restN=0,participating=0,okGk=0,splitGk=0;
    group.players.forEach(function(p){
      var r=avResolve(p,day),isScheduled=avScheduled(r.kind);
      var _gk=avIsGk(p); if(_gk&&r.s==='ok')okGk++; if(_gk&&!(r.s&&r.s!=='ok'))splitGk++;   /* 2.956 — 조 머리의 필드 · GK */
      if(isScheduled)total.scheduled++;
      if(r.s==='ok'){participating++;total.ok++;}else if(r.s)total.rest++;
      if(r.s==='rehab')rc.rehab++;else if(r.s&&r.s!=='ok')rc.out++;else if(r.s==='ok'){if(_gk)rc.gk++;else rc.field++;}
      var row=avTableRow(p,day,r,split);
      if(!split)gRows+=avYearLead(group,p,cols,true)+row;
      else if(r.s&&r.s!=='ok'){restRows+=row;restN++;}else okRows+=avYearLead(group,p,cols,true)+row;
    });
    if(split){
      var gname=availView==='name'?'':esc(group.name)+' ',okN=group.players.length-restN;okTot+=okN;restTot+=restN;
      if(okRows)okSec+='<div class="av-grp">'+(gname?'<div class="gh">'+gname+'<span class="n">'+okN+' / '+group.players.length+'명</span>'+avFieldGk(okN,splitGk)+'</div>':'')+'<table class="av-day-table phone">'+avTableHead(true)+'<tbody>'+okRows+'</tbody></table></div>';
      if(restRows)restSec+='<div class="av-grp">'+(gname?'<div class="gh">'+gname+'<span class="n">'+restN+'명</span></div>':'')+'<table class="av-day-table phone"><tbody>'+restRows+'</tbody></table></div>';
      return;
    }
    rows+='<tr class="av-grp-row"><th colspan="'+cols+'" scope="rowgroup">'+esc(group.name)+' <span class="n">가능 '+participating+' / '+group.players.length+'명</span>'+avFieldGk(participating,okGk)+'</th></tr>'+gRows;
  });
  var html='';
  if(split){
    if(okSec||restSec)html='<div class="av-split-ok"><div class="av-sec-h">운동 <span class="n">'+okTot+'명</span></div>'+(okSec||'<div class="av-empty">이 날 운동하는 선수가 없어요</div>')+'</div>'
      +'<div class="av-restbox av-split-rest"><div class="rh">참여 못 함 <span class="n">'+restTot+'명</span></div>'+(restSec||'<div class="av-rest-none">참여 못 하는 선수가 없어요</div>')+'</div>';
  }else if(rows)html='<div class="av-day-wrap"><table class="av-day-table">'+avTableHead(false)+'<tbody>'+rows+'</tbody></table></div>';
  return {html:html,total:total,rc:rc};
}
/* 조 칩 → 조 고르개(선수단 표 2.515 와 같은 길: grpPickOpen → p.grp → save). 동기화가 명단을 바꿔 끼운 뒤면 옛 선수 객체 — 쓰지 않고 다시 그린다 */
function avGrpPick(btn){
  if(typeof tmAudienceEditable==='function'&&!tmAudienceEditable()){try{toast('선수단 편집 권한이 없어요');}catch(_){}return;}
  var id=btn.dataset.avGrp,pl=(data.players||[]).find(function(x){return String(x.id)===String(id);});
  if(!pl)return;
  grpPickOpen(btn,pl.grp,function(g){
    g=String(g||'').trim();
    if(String(pl.grp||'').trim()===g)return;
    if(data.players.indexOf(pl)<0){try{toast('명단이 바뀌어 다시 그렸어요. 한 번 더 눌러 주세요');}catch(_){}renderAvail();return;}
    if(g)pl.grp=g;else delete pl.grp;
    save();
    if(typeof avClosePicker==='function')avClosePicker();
    renderAvail();
    try{renderPlayers();}catch(e){console.warn('[avail-table] renderPlayers',e);}
    try{renderTeam();}catch(e){console.warn('[avail-table] renderTeam',e);}
    try{toast((pl.name||'선수')+' → '+(g?(tmGrpLabel(g)||g):'조 없음'));}catch(_){}
  });
}
/* 3.363 포지션 칩 → 포지션 고르개(선수단 표 2.548 과 같은 목록: posPickOpen → p.posId → save). 자리가 바뀌면 뎁스 판의 칸 안 차례(sbSeat)는 걷는다 */
function avPosPick(btn){
  if(typeof tmAudienceEditable==='function'&&!tmAudienceEditable()){try{toast('선수단 편집 권한이 없어요');}catch(e){console.warn('[avail-table] toast',e);}return;}
  var id=btn.dataset.avPos,pl=(data.players||[]).find(function(x){return String(x.id)===String(id);});
  if(!pl)return;
  posPickOpen(btn,pl.posId||'',function(v){
    v=String(v||'');
    if(String(pl.posId||'')===v)return;
    if(data.players.indexOf(pl)<0){try{toast('명단이 바뀌어 다시 그렸어요. 한 번 더 눌러 주세요');}catch(e){console.warn('[avail-table] toast',e);}renderAvail();return;}
    var po=(data.positions||[]).find(function(x){return x.id===v;});
    pl.posId=po?po.id:'';pl.posName=po?po.name:'';delete pl.sbSeat;
    save();
    if(typeof avClosePicker==='function')avClosePicker();
    renderAvail();
    try{renderPlayers();}catch(e){console.warn('[avail-table] renderPlayers',e);}
    try{renderTeam();}catch(e){console.warn('[avail-table] renderTeam',e);}
    try{redrawTeamPitch();}catch(e){console.warn('[avail-table] redrawTeamPitch',e);}
    try{toast((pl.name||'선수')+' → '+(avPosition(pl)||'미지정'));}catch(e){console.warn('[avail-table] toast',e);}
  });
}
if(typeof document!=='undefined'&&document.head){
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-av-pos]');if(b){e.preventDefault();avPosPick(b);}});
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-av-grp]');if(b){e.preventDefault();avGrpPick(b);}});
  var avTableCss=document.createElement('style');avTableCss.id='ps-av-table-css';avTableCss.textContent=
    /* 표 — 선수별 누적 표(2.943)와 같은 문법. 옛 카드 규칙(.av-pl 이 grid)은 tr 에서 걷는다 */
    'html.ps-page-scout #availView .av-day-wrap{margin-top:6px;overflow-x:auto}'
    +'html.ps-page-scout #availView .av-day-table{width:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}'   /* 글자 크기는 옛 .av-pl 규칙(13px)을 그대로 물려받는다 — 선수별 누적 표와 같다 */
    +'html.ps-page-scout #availView .av-day-table th,html.ps-page-scout #availView .av-day-table td{height:40px;padding:0 8px;border-bottom:1px solid var(--line,#E3E6EA);text-align:left;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'html.ps-page-scout #availView .av-day-table thead th{height:30px;font-size:12px;font-weight:600;color:var(--gray,#646A73);background:var(--panel2,#F1F3F5)}'
    +'html.ps-page-scout #availView .av-day-table .c-no{width:46px;text-align:center}'
    +'html.ps-page-scout #availView .av-day-table .c-grp{width:80px}'
    +'html.ps-page-scout #availView .av-day-table .c-nm{width:20%}'
    +'html.ps-page-scout #availView .av-day-table .c-pos{width:84px}'
    +'html.ps-page-scout #availView .av-day-table .c-st{width:100px}'
    +'html.ps-page-scout #availView .av-day-table .c-ij{width:18%}'
    +'html.ps-page-scout #availView .av-day-table .c-memo{white-space:normal;line-height:1.35}'
    +'html.ps-page-scout #availView .av-day-table tr.av-pl{display:table-row;grid-template-columns:none;gap:0;padding:0;border-top:0;min-width:0}'
    +'html.ps-page-scout #availView .av-day-table tr.av-pl.rest td{background:rgba(199,125,0,.06)}'
    +'html.ps-page-scout #availView .av-day-table tr.av-pl .no{display:inline-flex;vertical-align:middle}'
    +'html.ps-page-scout #availView .av-day-table .av-player-link{min-height:32px;padding:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}'
    +'html.ps-page-scout #availView .av-day-table .av-yr{color:var(--gray,#646A73);font-size:12px;margin-left:6px}'
    +'html.ps-page-scout #availView .av-day-table tr.av-ysub~tr.av-pl .av-yr{display:none}'
    +'html.ps-page-scout #availView .av-day-table tr.av-grp-row th{height:36px;border-top:2px solid var(--line,#E3E6EA);font-size:12px;font-weight:700;color:var(--ink,#14161A);background:transparent}'
    +'html.ps-page-scout #availView .av-day-table tr.av-grp-row:first-child th{border-top:0}'
    +'html.ps-page-scout #availView .av-day-table tr.av-grp-row .n{font-weight:600;color:var(--gray,#646A73);margin-left:6px}'
    +'html.ps-page-scout #availView .av-day-table tr.av-grp-row .fgk{font-weight:600;color:var(--gray,#646A73);margin-left:8px;padding-left:8px;border-left:1px solid var(--line,#E3E6EA)}'
    +'html.ps-page-scout #availView .av-day-table tr.av-grp-row .fgk b{font-weight:700;color:var(--ink,#14161A)}'
    +'html.ps-page-scout #availView .av-day-table tr.av-ysub th{height:28px;font-size:12px;font-weight:700;color:var(--gray,#646A73);background:transparent;padding:0 8px}'
    +'html.ps-page-scout #availView .av-day-table tr.av-ysub .n{font-weight:600;margin-left:6px}'
    +'html.ps-page-scout #availView .av-pos{font-size:12px;color:var(--gray,#646A73)}'
    +'html.ps-page-scout #availView .av-pos.gk{color:var(--red,#C24A46);font-weight:700}'
    +'html.ps-page-scout #availView .av-pos-chip{display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:999px;border:1px solid var(--line,#E3E6EA);background:var(--panel2,#F1F3F5);font:inherit;font-size:12px;font-weight:600;color:var(--ink,#14161A);cursor:pointer;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}'
    +'html.ps-page-scout #availView .av-pos-chip.gk{color:var(--red,#C24A46)}'
    +'html.ps-page-scout #availView .av-pos-chip span{color:var(--gray,#646A73);font-weight:600}'
    +'html.ps-page-scout body #availView:not(#_):not(#__):not(#___):not(#____) .av-day-table.phone .av-pos-chip{height:22px!important;min-height:22px!important;min-width:0!important;padding:0 7px;vertical-align:middle}'
    +'html.ps-page-scout #availView .av-inj{font-size:12px;font-weight:600;color:var(--red,#C24A46)}'
    +'html.ps-page-scout #availView .av-inj.nopart{color:var(--gray,#646A73)}'
    +'html.ps-page-scout #availView .av-inj small{font-weight:500;color:var(--gray,#646A73);margin-left:4px}'
    +'html.ps-page-scout #availView .av-day-table .av-player-note{margin:0;font-size:12px}'
    +'html.ps-page-scout #availView .av-grp-chip{display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:999px;border:1px solid var(--line,#E3E6EA);background:var(--panel2,#F1F3F5);color:var(--ink,#14161A);font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}'
    +'html.ps-page-scout #availView .av-grp-chip.ro{cursor:default;background:transparent}'
    +'html.ps-page-scout #availView .av-grp-chip span{color:var(--gray,#646A73)}'
    /* 폰(≤600 · tmPhoneRows) — 세 열. 조 머리는 옛 .gh 그대로, 표는 머리 바로 아래 */
    +'html.ps-page-scout #availView .av-grp .av-day-table.phone{margin-top:2px}'
    +'html.ps-page-scout #availView .av-day-table.phone th,html.ps-page-scout #availView .av-day-table.phone td{height:44px;padding:0 6px}'
    +'html.ps-page-scout #availView .av-day-table.phone td{vertical-align:top;padding-top:6px;padding-bottom:6px;height:auto}'
    +'html.ps-page-scout #availView .av-day-table.phone .c-nm{width:46%}'
    +'html.ps-page-scout #availView .av-day-table.phone .c-st{width:92px}'
    +'html.ps-page-scout #availView .av-day-table.phone .c-ij{white-space:normal;line-height:1.3}'
    +'html.ps-page-scout body #availView:not(#_):not(#__):not(#___):not(#____) .av-day-table.phone .av-player-link{display:inline-block;max-width:calc(100% - 54px);min-height:30px!important;line-height:1.3;padding:2px 0;vertical-align:middle}'   /* 이름 옆에 조 칩 — team-mobile 의 44px 단추 규칙을 이기려면 id 넷 + !important */
    +'html.ps-page-scout #availView .av-day-table.phone .sub{display:block;font-size:12px;color:var(--gray,#646A73);margin:1px 0 0}'
    +'html.ps-page-scout body #availView:not(#_):not(#__):not(#___):not(#____) .av-day-table.phone .av-grp-chip{height:22px!important;min-height:22px!important;min-width:0!important;padding:0 7px;margin:0 0 0 4px;vertical-align:middle}'   /* team-mobile.css 의 «#availView 단추 44px» (id 넷 · !important) 보다 세게 — 조 칩은 이름 아래 작은 칩 */
    +'html.ps-page-scout #availView .av-day-table.phone .av-player-note{display:block;margin:2px 0 0}'
    +'html.ps-page-scout #availView .av-restbox .av-day-table.phone td{border-bottom-color:rgba(199,125,0,.22)}';
  document.head.appendChild(avTableCss);
}
