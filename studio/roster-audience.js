/* Display names never become foreign keys; schoolYear is unrelated to evaluation grade. */
var tmSchoolYearFilter='';
function tmGrpLabel(g){return PSTeamAudience.label(g,data&&data.meta);}
function tmAudienceEditable(){return !(document.body.classList.contains('ps-roster-locked')||(typeof teEditable==='function'&&!teEditable()));}
function tmRenameGroups(){
  if(!tmAudienceEditable()){toast('운영진만 바꿀 수 있어요');return;}
  var previous=document.getElementById('tmGroupNames');if(previous)previous.remove();
  var dialog=document.createElement('dialog');dialog.id='tmGroupNames';dialog.style.cssText='width:min(420px,90vw);max-height:80vh;overflow:auto;border:1px solid #ddd;border-radius:16px;padding:24px;color:var(--txt);background:var(--panel,#fff)';
  var title=document.createElement('h3');title.textContent='조 이름 바꾸기';dialog.appendChild(title);
  var note=document.createElement('p');note.textContent='이름만 바뀝니다. 선수 배정과 기존 일정·훈련은 그대로 유지됩니다.';dialog.appendChild(note);
  var keys=PSTeamAudience.keys(data),owner=teamSaveOwner(),original=data,values=Object.create(null);
  keys.forEach(function(key,i){var row=document.createElement('label');row.style.cssText='display:grid;gap:6px;margin:14px 0';row.textContent=tmGrpLabel(key);var input=document.createElement('input');input.value=tmGrpLabel(key);input.maxLength=40;input.required=true;input.setAttribute('aria-label',tmGrpLabel(key)+' 새 이름');row.appendChild(input);dialog.appendChild(row);values[key]=input;});
  var error=document.createElement('p');error.setAttribute('role','alert');dialog.appendChild(error);
  var cancel=document.createElement('button');cancel.className='btn';cancel.textContent='취소';cancel.onclick=function(){dialog.close();dialog.remove();};
  var submit=document.createElement('button');submit.className='btn primary';submit.textContent='이름 저장';submit.style.marginLeft='8px';
  var originalNames=JSON.stringify(keys.map(function(k){return tmGrpLabel(k);}));
  submit.onclick=function(){
    if(!tmAudienceEditable()||owner!==teamSaveOwner()||data!==original){error.textContent='팀 또는 편집 권한이 바뀌었습니다. 창을 다시 열어 주세요.';return;}
    if(JSON.stringify(PSTeamAudience.keys(data))!==JSON.stringify(keys)||JSON.stringify(keys.map(tmGrpLabel))!==originalNames){error.textContent='조 목록이 변경되었습니다. 창을 다시 열어 주세요.';return;}
    var changes=Object.create(null);keys.forEach(function(k){changes[k]=values[k].value;});
    try{data.meta=PSTeamAudience.rename(data.meta||{},changes,keys);}catch(e){error.textContent=e.message;return;}
    if(save()===false){originalNames=JSON.stringify(keys.map(tmGrpLabel));error.textContent='저장을 확인하지 못했습니다. 입력은 남아 있습니다. 다시 저장해 주세요.';return;}
    dialog.close();dialog.remove();renderTeam();try{renderScoutBoard();}catch(_){}toast('조 이름 저장됨');
  };
  dialog.append(cancel,submit);document.body.appendChild(dialog);dialog.addEventListener('close',function(){dialog.remove();});dialog.showModal();
}
function tmSchoolYearButton(p){
  var b=document.createElement('button');b.type='button';b.className='btn sm t-school-year';b.textContent=p.schoolYear?p.schoolYear+'학년':'학년';b.setAttribute('aria-label',(p.name||'선수')+' 학년 '+(p.schoolYear||'미지정'));
  b.onclick=function(e){e.stopPropagation();if(!tmAudienceEditable()){toast('선수단 편집 권한이 없어요');return;}var owner=teamSaveOwner();psPickOpen(b,[{v:'',lb:'미지정'},{v:'1',lb:'1학년'},{v:'2',lb:'2학년'},{v:'3',lb:'3학년'}],String(p.schoolYear||''),function(y){if(owner!==teamSaveOwner()||!tmAudienceEditable()||data.players.indexOf(p)<0)return;if(y)p.schoolYear=y;else delete p.schoolYear;save();renderTeam();},'학년 고르기');};return b;
}
function tmSchoolYearBar(){
  var anchor=document.getElementById('grpChips');if(!anchor)return;
  var bar=document.getElementById('tmSchoolYears');if(!bar){bar=document.createElement('div');bar.id='tmSchoolYears';anchor.after(bar);}bar.replaceChildren();
  var b=document.createElement('button');b.type='button';b.className='btn sm'+(tmSchoolYearFilter?' primary':'');b.textContent=(tmSchoolYearFilter?tmSchoolYearFilter+'학년':'전체 학년')+' ▾';b.setAttribute('aria-label','학년 보기');
  b.onclick=function(){psPickOpen(b,['','1','2','3'].map(function(y){return {v:y,lb:y?y+'학년':'전체 학년'};}),tmSchoolYearFilter,function(y){tmSchoolYearFilter=y;renderTeam();},'학년 보기');};bar.appendChild(b);
}

/* ══ 3.283 · 가용인원 조별 보기 안에서 «학년 나누기»(사용자 11/11 «조별에서 학년별로 나눌 수 있게») ══
   켜면 조마다 1·2·3학년 줄로 갈라진다 — 학년을 적은 선수가 그 조에 하나라도 있을 때만. 켜고 끈 값은 이 기기에만(cs_av_year_v1), 조별 보기에서만 쓴다.
   쉼 상자처럼 학년 줄 아래가 아닌 자리의 선수는 자리 옆에 학년을 적는다. 선수별 누적 표도 같은 단추를 따른다. 새 저장 칸은 없다 — 선수의 schoolYear 그대로. */
var avYearSplit=false;try{avYearSplit=localStorage.getItem('cs_av_year_v1')==='1';}catch(e){avYearSplit=false;}
function avYearOn(){return typeof availView!=='undefined'&&availView==='grp'&&avYearSplit;}
function avYearKey(p){var y=String(p&&p.schoolYear||'');return /^[1-3]$/.test(y)?y:'';}
function avYearLabel(y){return y?y+'학년':'학년 미지정';}
/* 조 안 차례: 학년(1 · 2 · 3 · 미지정) → 원래 차례(쉼이 아닌 선수 → 자리 → 이름). 학년을 적은 선수가 없는 조는 그대로 */
function avYearOrder(players){
  if(!avYearOn()||!players.some(avYearKey))return players;
  var out=[];['1','2','3',''].forEach(function(y){players.forEach(function(p){if(avYearKey(p)===y)out.push(p);});});return out;
}
/* 학년 줄 — 그 학년의 첫 선수 앞에 한 번. 날짜별 명단은 «가능 n / m명»(조 머리와 같은 셈 — 데스크톱은 참여로 기록한 선수, 폰 «운동»은 쉼이 아닌 선수), 누적 표(cols)는 «m명» */
function avYearLead(group,p,cols){
  if(!avYearOn()||!group||!group.players.some(avYearKey))return '';
  var y=avYearKey(p);if(group.avYearDone===y)return '';group.avYearDone=y;
  var same=group.players.filter(function(q){return avYearKey(q)===y;}),text;
  if(cols)text=same.length+'명';
  else{
    var day=(typeof availDay!=='undefined'&&availDay)||stYmd(),phone=typeof tmPhoneRows==='function'&&tmPhoneRows();
    var ok=same.filter(function(q){var s=avResolve(q,day).s;return phone?!(s&&s!=='ok'):s==='ok';}).length;
    text='가능 '+ok+' / '+same.length+'명';
  }
  var body=avYearLabel(y)+' <span class="n">'+text+'</span>';
  return cols?'<tr class="av-table-year"><th colspan="'+cols+'" scope="rowgroup">'+body+'</th></tr>':'<div class="av-ysub">'+body+'</div>';
}
/* 학년 줄 아래가 아닌 자리(쉼 상자 · 폰 «참여 못 함»)의 선수 — 자리 옆 학년. 학년 줄 아래 행은 CSS 가 숨긴다 */
function avYearTag(p){var y=avYearOn()?avYearKey(p):'';return y?'<small class="av-yr">'+y+'학년</small>':'';}
function avYearToggleHTML(){
  if(typeof availView==='undefined'||availView!=='grp')return '';
  return '<button type="button" class="av-ysplit" data-av-ysplit aria-pressed="'+(avYearSplit?'true':'false')+'">학년 나누기</button>';
}
function avYearToggle(){
  avYearSplit=!avYearSplit;
  try{localStorage.setItem('cs_av_year_v1',avYearSplit?'1':'0');}catch(e){console.warn('[roster-audience] year split memo',e);}   /* 기기 기억만 — 못 적어도 이번 화면은 바뀐다 */
  if(typeof avClosePicker==='function')avClosePicker();
  if(typeof renderAvail==='function')renderAvail();
}
if(typeof document!=='undefined'&&document.head){
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-av-ysplit]');if(b){e.preventDefault();avYearToggle();}});
  var avYearCss=document.createElement('style');avYearCss.id='ps-av-year-css';avYearCss.textContent=
    'html.ps-page-scout #availView .av-ysplit{height:28px;padding:0 10px;margin-left:6px;border:1px solid var(--line,#E3E6EA);border-radius:999px;background:var(--panel2,#F1F3F5);color:var(--gray,#646A73);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}'
    +'html.ps-page-scout #availView .av-ysplit[aria-pressed=true]{background:var(--ink,#14161A);color:#fff;border-color:transparent}'
    +'html.ps-page-scout body.fmdark #availView .av-ysplit[aria-pressed=true]{color:#14161A}'
    +'html.ps-page-scout #availView .av-grp .rows .av-ysub{grid-column:1/-1;display:flex;align-items:baseline;gap:6px;margin:8px 0 0;padding:0 4px;font-size:12px;font-weight:800;color:var(--gray,#646A73)}'
    +'html.ps-page-scout #availView .av-grp .rows .av-ysub .n{font-weight:600;font-variant-numeric:tabular-nums}'
    +'html.ps-page-scout #availView .av-pl .nm .av-yr{color:var(--gray,#646A73);margin-left:6px}'
    +'html.ps-page-scout #availView .av-ysub~.av-pl .av-yr{display:none}'
    +'html.ps-page-scout #availView .av-table-year th{font-size:12px;font-weight:800;color:var(--gray,#646A73);padding:8px 10px 2px;background:transparent}'
    +'html.ps-page-scout #availView .av-table-year .n{font-weight:600;font-variant-numeric:tabular-nums}'
    +'@media (max-width:560px){html.ps-page-scout #availView .av-dnav .av-ysplit{flex:1 1 100%;margin:6px 0 0}}';
  document.head.appendChild(avYearCss);
}

/* ══ 3.283 · 선수 추가 시트 · 선수 편집 창의 조 · 학년(사용자 11/11 «선수 추가하거나 프로필 수정에 조와 학년 선택할 수 있게») ══
   선수단 표의 조 꼬리표 · 학년 단추와 같은 값(grp · schoolYear)을 같은 저장 길(save)로 쓴다. 조 목록은 PSTeamAudience.keys — 이름은 tmGrpLabel 로 보인다. */
var TM_YEAR_OPTS=[['','미지정'],['1','1학년'],['2','2학년'],['3','3학년']];
function tmAudienceFields(){
  var keys=PSTeamAudience.keys(data);
  return [{key:'grp',label:'조',type:'select',value:'',options:[{value:'',label:'없음'}].concat(keys.map(function(k){return {value:k,label:tmGrpLabel(k)};}))},
    {key:'schoolYear',label:'학년',type:'seg',value:'',options:TM_YEAR_OPTS.map(function(o){return {value:o[0],label:o[1]};})}];
}
function tmAudienceApply(p,v){var g=String(v&&v.grp||'').trim(),y=String(v&&v.schoolYear||'');if(g)p.grp=g;if(/^[1-3]$/.test(y))p.schoolYear=y;return p;}
function tmAudienceEditChips(pl){
  var typeBox=document.getElementById('plTypeChips'),typeField=typeBox&&typeBox.closest('.field');if(!typeField)return;
  function field(id,label,after){var box=document.getElementById(id);if(box)return box;var f=document.createElement('div');f.className='field';var l=document.createElement('label');l.textContent=label;box=document.createElement('div');box.className='pl-chips';box.id=id;f.append(l,box);after.after(f);return box;}
  var gb=field('plGrpChips','조',typeField),yb=field('plYearChips','학년',gb.closest('.field'));
  function chip(box,label,on,pick){
    var b=document.createElement('button');b.type='button';b.textContent=label;b.className=on?'on':'';
    b.onclick=function(){
      if(!tmAudienceEditable()){toast('선수단 편집 권한이 없어요');return;}
      if(data.players.indexOf(pl)<0)return;   /* 동기화가 명단을 바꿔 끼운 뒤면 옛 선수 객체 — 쓰지 않는다 */
      pick();save();paint();
      try{renderPlayers();}catch(e){console.warn('[roster-audience] renderPlayers',e);}
      try{renderTeam();}catch(e){console.warn('[roster-audience] renderTeam',e);}
    };
    box.appendChild(b);
  }
  function paint(){
    var cur=String(pl.grp||'').trim(),y0=String(pl.schoolYear||'');
    gb.replaceChildren();[''].concat(PSTeamAudience.keys(data)).forEach(function(k){chip(gb,k?tmGrpLabel(k):'없음',cur===k,function(){if(k)pl.grp=k;else delete pl.grp;});});
    yb.replaceChildren();TM_YEAR_OPTS.forEach(function(o){chip(yb,o[1],y0===o[0],function(){if(o[0])pl.schoolYear=o[0];else delete pl.schoolYear;});});
  }
  paint();
}
