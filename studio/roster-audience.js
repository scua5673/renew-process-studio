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
