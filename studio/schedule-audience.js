/* Helpers called by the schedule's existing render/save path. Filters are device-memory only. */
var __schedYears=[];
function schedAudienceDoc(){try{return JSON.parse(localStorage.getItem('scout_tool_v1')||'null')||{};}catch(_){return {};}}
function schedGroupLabel(g){return PSTeamAudience.label(g,schedAudienceDoc().meta);}
function schedTeamOptions(){var meta=schedAudienceDoc().meta;return schedGroups().filter(function(g){return !PSTeamAudience.legacy(g,meta);});}
function schedYearButtons(selected,action){
  var ys=PSTeamAudience.years(selected),h='<button type="button" class="fp'+(!ys.length?' on':'')+'" aria-pressed="'+(!ys.length)+'" onclick="'+action+'(\'\')">전체 학년</button>';
  ['1','2','3'].forEach(function(y){var on=ys.indexOf(y)>=0;h+='<button type="button" class="fp'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="'+action+'(\''+y+'\')">'+y+'학년</button>';});return h;
}
function schedToggleYears(current,y){var a=PSTeamAudience.years(current);if(!y)return [];var i=a.indexOf(y);if(i<0)a.push(y);else a.splice(i,1);return PSTeamAudience.years(a);}
function schedRenderYears(){
  var anchor=document.getElementById('schedGrp');if(!anchor)return;
  var box=document.getElementById('schedYears');if(!box){box=document.createElement('div');box.id='schedYears';box.className='sched-years';box.setAttribute('aria-label','학년 보기');anchor.after(box);}
  box.innerHTML='<span>학년</span>'+schedYearButtons(__schedYears,'schedSetYear');
}
function schedSetYear(y){__schedYears=schedToggleYears(__schedYears,y);schedRenderYears();syncViews(false);}
function schedPickYears(){return '<div class="wf-sec"><div class="pksub sm">참여 학년</div><div class="fmtpick">'+schedYearButtons(__sessionTeamPick.schoolYears,'wksSessionYearToggle')+'</div><p>선택한 팀 안에서 참여할 학년입니다. 전체 학년을 고르면 학년 제한이 없습니다.</p></div>';}
function wksSessionYearToggle(y){if(!__sessionTeamPick)return;__sessionTeamPick.schoolYears=schedToggleYears(__sessionTeamPick.schoolYears,y);wksSessionTeamRender();}
function schedFillYears(tr){return '<div class="wf-sec" id="wfSec-years"><div class="pksub sm">참여 학년</div><div class="fmtpick">'+schedYearButtons(tr&&tr.schoolYears,'wksFillYear')+'</div><small>선택한 팀의 해당 학년이 참여합니다.</small></div>';}
function wksFillYear(y){
  if(schedEditBlocked()){schedBlockNotice();return;}
  if(__fillNoSes){toast('먼저 세션을 추가해 주세요.');return;}
  wksFillFlushText();var tr=ensureSlotSession(__fillDi,__fillSlot);if(!tr)return;
  var next=schedToggleYears(tr.schoolYears,y);if(next.length)tr.schoolYears=next;else delete tr.schoolYears;_fillSave();
}
/* Another frame may rename a team while this schedule remains mounted. Never save a view refresh. */
if(typeof window!=='undefined'&&window.addEventListener){
  var __audienceLabels='';
  window.addEventListener('storage',function(e){
    if(!e||e.key!=='scout_tool_v1')return;
    var d=schedAudienceDoc(),signature=JSON.stringify([d.meta&&d.meta.grpBase,d.meta&&d.meta.grpLabels]);
    if(signature===__audienceLabels)return;__audienceLabels=signature;
    if(typeof renderSchedGrp!=='function')return;renderSchedGrp();
    var scrim=document.getElementById('scrim');if(scrim&&scrim.classList.contains('show'))return;
    if(typeof syncViews==='function')syncViews(false);
  });
}
