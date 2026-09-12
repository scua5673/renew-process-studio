/* 2.746 — 경기에서 고른 행동을 날짜·조별 훈련 과제로 연결한다.
   경기 원문은 읽기만 한다. 쓰기는 일정의 기존 저장·권한·편집 보호 경로 한 곳을 쓴다. */
(function(){
  'use strict';
  var draft=null, seen=Object.create(null), KEY='process_coach_v1';
  function api(){try{return parent!==window?parent.PSSync:window.PSSync;}catch(_){return null;}}
  function owner(){
    try{var s=api(),u=s&&s.session&&s.session(),w=localStorage.getItem('ps_active_ws')||'';
      return u&&u.uid&&w&&s.dataUnlocked&&s.dataUnlocked()===true&&typeof s.keyReady==='function'&&s.keyReady(KEY,w)?
        {uid:String(u.uid),wid:w,seal:String(localStorage.getItem('ps_cache_owner_v1')||'')}:null;
    }catch(_){return null;}
  }
  function sameOwner(o){var n=owner();return !!(o&&n&&o.uid===n.uid&&o.wid===n.wid&&(!Object.prototype.hasOwnProperty.call(o,'seal')||o.seal===n.seal));}
  function canWrite(){try{return !!owner()&&typeof schedEditBlocked==='function'&&!schedEditBlocked()&&PSPerms.role()!=='player';}catch(_){return false;}}
  function canUseMatch(m){
    try{if(!canWrite()||!m||!PSPerms.canEdit('team'))return false;
      if(api().keyReady&&!api().keyReady('cs_team_matches_v1',owner().wid))return false;
      var role=PSPerms.role();if(role==='admin'||role==='executive')return true;
      var a=JSON.parse(localStorage.getItem('cs_assign_v1')||'{}'),assigned=a&&a.match&&a.match[m.id];
      return !assigned||assigned===owner().uid;
    }catch(_){return false;}
  }
  function model(){return {anchorMonday:ymd(__ANCHOR),weeks:weeksMap};}
  function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function match(id){try{var m=JSON.parse(localStorage.getItem('cs_team_matches_v1')||'null');return (m&&m.matches||[]).find(function(x){return x&&x.id===id;})||null;}catch(_){return null;}}
  function esc(v){return PSReviewTraining.esc(v);}
  function tell(t){try{toast(t);}catch(_){}}
  function row(id){var all=PSReviewTraining.list(model());return all.find(function(x){return x.task.id===id;})||null;}
  function cell(date){
    if(!PSReviewTraining.validDate(date))return null;
    var n=offsetOfDate(new Date(date+'T00:00:00')),w=Math.floor(n/7),di=((n%7)+7)%7;
    return {w:w,di:di,day:weeksMap[w]&&weeksMap[w][di]};
  }
  function sourceStamp(m){return JSON.stringify({id:m.id,date:m.date,opponent:m.opponent,sources:PSReviewTraining.sources(m)});}
  function sourceLabel(s){
    if(s.key.indexOf('phaseReview:')!==0)return s.label;
    try{var gm=JSON.parse(localStorage.getItem('cs_gamemodel_v1')||'null'),key=s.key.slice(12),mo=(gm&&gm.moments||[]).find(function(m){return m&&m.key===key;});
      if(mo&&mo.name)return mo.name+' · 개선할 점';
    }catch(_){}
    return '국면 개선할 점';
  }
  function markEditing(){try{__schedUpdateSignal();}catch(_){}}
  function close(force){
    if(draft&&draft.busy&&!force){showError('저장을 확인하는 중입니다. 잠시 기다려 주세요.');return;}
    draft=null;var sc=document.getElementById('scrim');if(sc)sc.classList.remove('show');
    var sh=document.getElementById('sheet');if(sh)delete sh.dataset.reviewTraining;
    markEditing();try{__schedDrainIncoming();}catch(_){}
  }
  function showError(t){var n=document.getElementById('rtError');if(n)n.textContent=t;}
  function lockInputs(locked){
    ['rtSource','rtCopy','rtAction','rtGroup','rtStatus','rtObservation'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.disabled=locked;
    });
  }
  function groupOptions(value){
    var groups=[];try{groups=schedGroups().slice();}catch(_){}
    if(value&&groups.indexOf(value)<0)groups.push(value);
    return '<option value="">팀 공통</option>'+groups.map(function(g){return '<option value="'+esc(g)+'"'+(g===value?' selected':'')+'>'+esc(g)+'</option>';}).join('');
  }
  function paint(){
    var d=draft,editing=!!d.taskId,t=editing?row(d.taskId):null,readonly=editing&&!canWrite();
    var sources=editing?[]:PSReviewTraining.sources(d.match),task=t&&t.task;
    var groups=task&&task.grp||[], group=groups.length===1?groups[0]:'';
    if(!editing)try{group=String(__schedGrp||schedDefGrp()||'');}catch(_){}
    // Existing tasks can target several groups. Keep them unless a new group is explicitly selected.
    var multiple=groups.length>1?'<option value="__keep_groups__" selected>'+esc(groups.join(' · '))+'</option>':'';
    var date=t?t.date:d.date;
    var h='<button type="button" class="closex" data-rt-close aria-label="닫기">×</button>'
      +'<h3 id="rtTitle">'+(editing?'훈련 과제 · 결과':'다음 훈련으로')+'</h3>'
      +'<p class="rt-origin">'+esc(d.matchDate)+' · '+esc(d.opponent||'상대 미정')+' 경기에서</p>';
    if(!editing)h+='<div class="rt-source"><label>리뷰에서 고르기<select id="rtSource"><option value="custom">직접 작성</option>'
      +sources.map(function(s){return '<option value="'+esc(s.key)+'">'+esc(sourceLabel(s))+'</option>';}).join('')+'</select></label>'
      +'<button type="button" id="rtCopy">개선점 가져오기</button></div>';
    h+='<label class="rt-label">훈련에서 해볼 행동<textarea id="rtAction" maxlength="2000" placeholder="예: 측면으로 공이 이동하면 가까운 수비수가 커버 위치를 먼저 잡는다"'+(readonly?' disabled':'')+'>'+esc(task?task.action:'')+'</textarea></label>'
      +'<div class="rt-fields"><label>훈련 날짜<input id="rtDate" type="date" value="'+esc(date)+'"'+(editing?' disabled':'')+'></label>'
      +'<label>대상 조<select id="rtGroup"'+(readonly?' disabled':'')+'>'+multiple+groupOptions(group)+'</select></label></div>';
    if(editing)h+='<label class="rt-label">실행 여부<select id="rtStatus"'+(readonly?' disabled':'')+'>'
      +[['planned','훈련 예정'],['done','진행함'],['skipped','진행하지 않음']].map(function(s){return '<option value="'+s[0]+'"'+(task.status===s[0]?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select></label>'
      +'<label class="rt-label">관찰한 변화 · 다음에 확인할 것<textarea id="rtObservation" maxlength="2000" placeholder="실제로 보인 장면을 한 줄로 남기세요"'+(readonly?' disabled':'')+'>'+esc(task.observation||'')+'</textarea></label>';
    h+='<p class="rt-scope">행동과 결과는 선수도 읽을 수 있는 팀 일정에 저장됩니다. 경기 리뷰 원문은 함께 복사하지 않습니다.</p>'
      +'<p id="rtError" role="status" aria-live="polite"></p><div class="rt-actions">'
      +(editing?'<button type="button" id="rtBack">경기 리뷰로</button>':'')
      +(readonly?'<span>일정 보기 전용입니다</span>':'<button type="button" class="solid" id="rtSave">'+(editing?'결과 저장':'훈련 과제 추가')+'</button>')+'</div>';
    var sheet=document.getElementById('sheet');sheet.dataset.reviewTraining='1';sheet.innerHTML=h;
    sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','rtTitle');
    document.getElementById('scrim').classList.add('show');sheet.scrollTop=0;markEditing();
    var title=document.getElementById('rtTitle');title.tabIndex=-1;title.focus();
    sheet.querySelector('[data-rt-close]').onclick=function(){close();};
    if(!editing){
      document.getElementById('rtCopy').onclick=function(){
        var key=document.getElementById('rtSource').value,s=sources.find(function(x){return x.key===key;});
        if(!s){showError('가져올 개선점을 먼저 골라 주세요. 직접 작성해도 됩니다.');return;}
        var input=document.getElementById('rtAction');
        if(input.value.trim()&&input.value!==d.copied){showError('작성한 행동이 있습니다. 내용을 비운 뒤 가져오세요.');return;}
        input.value=s.text;d.copied=s.text;d.sourceKey=key;showError('훈련에서 해볼 행동으로 다듬어 주세요.');input.focus();
      };
    }
    var saveButton=document.getElementById('rtSave');if(saveButton)saveButton.onclick=commit;
    var back=document.getElementById('rtBack');if(back)back.onclick=function(){
      if(d.busy){showError('저장을 확인하는 중입니다. 잠시 기다려 주세요.');return;}
      // Inputs are explicit-save: keep the sheet if they differ from the stored task.
      if(!readonly&&changed()){showError('수정한 내용을 먼저 저장해 주세요.');return;}
      var o=d.owner,id=d.matchId;close();
      if(sameOwner(o)&&parent!==window)parent.postMessage({source:'process',type:'reviewTrainingBack',uid:o.uid,wid:o.wid,matchId:id},location.origin);
    };
  }
  function inputs(){
    var get=function(id){var el=document.getElementById(id);return el?el.value:'';},g=get('rtGroup');
    return {action:get('rtAction').trim(),date:get('rtDate'),grp:g==='__keep_groups__'?draft.groups.slice():(g?[g]:[]),
      status:get('rtStatus')||'planned',observation:get('rtObservation').trim()};
  }
  function changed(){
    if(!draft||!draft.taskId)return false;var t=row(draft.taskId),v=inputs();
    return !t||v.action!==t.task.action||JSON.stringify(v.grp)!==JSON.stringify(t.task.grp||[])||v.status!==t.task.status||v.observation!==(t.task.observation||'');
  }
  function open(request){
    var o=owner();if(!o){tell('로그인하고 자료 준비가 끝난 뒤 열어 주세요.');return false;}
    if(request.uid&&(!sameOwner(request)||request.uid!==o.uid)){tell('계정이나 팀이 바뀌었습니다. 다시 열어 주세요.');return false;}
    if(curSession||document.getElementById('scrim').classList.contains('show')){tell('열려 있는 편집을 마친 뒤 다시 열어 주세요.');return false;}
    /* 2.750 — 서버/IDB/거울 준비가 먼저 끝나도 프레임의 weeksMap 적용은 늦을 수 있다.
       화면의 편집본을 교체하지 않고 기존 수신 처리 완료 후 다시 열도록 한다. */
    if(typeof __schedSavedRaw==='string'&&String(localStorage.getItem(KEY)||'')!==__schedSavedRaw){
      tell('팀 일정을 화면에 반영하는 중입니다. 잠시 뒤 다시 열어 주세요.');return false;
    }
    var found=request.taskId?row(String(request.taskId)):null,m=match(String(request.matchId||found&&found.task.matchId||''));
    if(request.taskId&&(!found||request.matchId&&found.task.matchId!==request.matchId)){tell('연결된 훈련 과제를 찾지 못했습니다.');return false;}
    if(!found&&!canUseMatch(m)){tell('이 경기와 팀 일정을 편집할 권한이 있어야 과제를 추가할 수 있습니다.');return false;}
    var task=found&&found.task,dt=new Date();dt.setHours(0,0,0,0);
    if(m&&PSReviewTraining.validDate(m.date)){var after=new Date(m.date+'T00:00:00');after.setDate(after.getDate()+1);if(after>dt)dt=after;}
    draft={owner:o,match:m,matchId:task?task.matchId:m.id,matchDate:task?task.matchDate:m.date,opponent:task?task.opponent:m.opponent,
      date:ymd(dt),taskId:task?task.id:'',sourceKey:'custom',groups:task&&task.grp||[],baseline:task?JSON.stringify(task):'',
      stamp:m?sourceStamp(m):'',id:'rt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)};
    paint();return true;
  }
  function commit(){
    var d=draft;if(!d||d.busy)return;
    if(!sameOwner(d.owner)||!canWrite()){showError('계정·팀 또는 편집 권한이 바뀌었습니다. 다시 열어 주세요.');return;}
    var v=inputs(),current=d.taskId?row(d.taskId):null,m=match(d.matchId);
    if(!v.action||v.action.length>2000||v.observation.length>2000){showError('행동을 적어 주세요. 행동과 결과는 각각 2,000자까지 저장할 수 있습니다.');return;}
    if(['planned','done','skipped'].indexOf(v.status)<0||v.grp.some(function(g){return typeof g!=='string'||g.length>80;})){showError('실행 여부와 대상 조를 확인해 주세요.');return;}
    if(!PSReviewTraining.validDate(v.date)||(!current&&v.date<=d.matchDate)){showError('경기 다음 날 이후의 훈련 날짜를 골라 주세요.');return;}
    if(d.taskId&&(!current||JSON.stringify(current.task)!==d.baseline)){showError('이 과제가 다른 곳에서 바뀌었습니다. 내용을 따로 보관하고 다시 열어 주세요.');return;}
    if(!current&&(!canUseMatch(m)||sourceStamp(m)!==d.stamp)){showError('경기 리뷰나 담당이 바뀌었습니다. 내용을 따로 보관하고 다시 열어 주세요.');return;}
    var c=cell(v.date);if(!c){showError('훈련 날짜를 확인해 주세요.');return;}
    if(!current&&c.day&&(c.day.off||c.day.match||(window.PSSchedule&&PSSchedule.hasMatch&&PSSchedule.hasMatch(c.day))||c.day.board&&(c.day.board.sched==='OFF'||c.day.board.sched==='경기'))){showError('휴식일·경기일에는 과제를 추가할 수 없습니다. 다른 훈련 날짜를 골라 주세요.');return;}
    var task=current?current.task:PSReviewTraining.newTask({id:d.id,matchId:d.matchId,matchDate:d.matchDate,opponent:d.opponent,sourceKey:d.sourceKey,action:v.action,grp:v.grp,now:Date.now()});
    if(!task){showError('경기·행동·대상 조를 확인해 주세요.');return;}
    if(!current&&c.day){var duplicate=PSReviewTraining.duplicate(c.day,task);if(duplicate){close();focus(v.date,duplicate.grp);open({taskId:duplicate.id,matchId:d.matchId});return;}}
    if(!weeksMap[c.w])weeksMap[c.w]=blankWeek();c.day=weeksMap[c.w][c.di];
    if(!current){
      if(c.day.reviewActions!=null&&!Array.isArray(c.day.reviewActions)){showError('이 날짜의 과제 형식을 확인하지 못했습니다. 기존 자료는 바꾸지 않았습니다.');return;}
      c.day.reviewActions=c.day.reviewActions||[];c.day.reviewActions.push(task);
    }else {task.action=v.action;task.grp=v.grp;task.status=v.status;task.observation=v.observation;task.updatedAt=Date.now();}
    d.taskId=task.id;d.groups=task.grp.slice();d.baseline=JSON.stringify(task);d.busy=true;
    lockInputs(true);
    document.getElementById('rtDate').disabled=true;
    var button=document.getElementById('rtSave');button.disabled=true;button.textContent='저장 중…';showError('');
    var accepted=false;try{accepted=save()===true;}catch(_){}
    var ready=accepted&&window.PSStorage&&PSStorage.sharedReady?PSStorage.sharedReady(KEY):Promise.reject(new Error('save rejected'));
    Promise.resolve(ready).then(function(){
      if(!sameOwner(d.owner))throw new Error('owner changed');
      var raw=localStorage.getItem(KEY);
      if(!raw)throw new Error('missing saved data');
      return PSStorage.sharedVerified(KEY,raw).then(function(){
        var saved=PSReviewTraining.forMatch(JSON.parse(raw),d.matchId).find(function(x){return x.task.id===d.taskId;});
        if(!saved||JSON.stringify(saved.task)!==d.baseline)throw new Error('task verification failed');
      });
    }).then(function(){
      if(draft!==d||!sameOwner(d.owner))return;
      close(true);focus(v.date,task.grp);tell('훈련 과제를 이 기기에 저장했습니다. 팀 반영은 동기화 상태에서 확인하세요.');
      if(parent!==window)parent.postMessage({source:'process',type:'reviewTrainingSaved',uid:d.owner.uid,wid:d.owner.wid,matchId:d.matchId,taskId:d.taskId},location.origin);
    }).catch(function(){
      if(draft!==d)return;showError('저장을 확인하지 못했습니다. 입력 내용은 열어 두었습니다. 다시 저장해 주세요.');
    }).then(function(){d.busy=false;if(draft===d){lockInputs(!canWrite());button.disabled=!canWrite();button.textContent='다시 저장';}});
  }
  function focus(date,groups){var c=cell(date);if(!c)return;
    try{if(groups)schedSetGrp(groups.length===1?groups[0]:'');
      go('schedule');focusScheduleDate(c.w,c.di);var w=document.querySelector('#vtoggle div[data-v="week"]');if(w&&!w.classList.contains('on')&&w.onclick){w.onclick();focusScheduleDate(c.w,c.di);}renderWeek();renderDay();}catch(_){}
  }
  function dayHTML(day,di){
    if(!window.PSReviewTraining||!day)return '';
    var date=ymd(dateOf(wk*7+di)),filter='';try{filter=String(__schedGrp||'');}catch(_){}
    var rows=PSReviewTraining.list({anchorMonday:ymd(__ANCHOR),weeks:weeksMap}).filter(function(x){
      return x.date===date&&(!filter||(x.task.grp||[]).indexOf(filter)>=0||(!(x.task.grp||[]).length&&schedGrpWithCommon()));
    });
    if(!rows.length)return '';
    return '<div class="rt-day"><b>경기에서 이어온 과제</b>'+rows.map(function(x){var t=x.task;return '<button type="button" class="rt-task" data-rt-task="'+esc(t.id)+'">'
      +'<span>'+esc(t.action)+'</span><small>'+esc((t.grp||[]).join(' · ')||'팀 공통')+' · '+esc(PSReviewTraining.statusLabel(t))+'</small>'
      +(t.observation?'<em>'+esc(t.observation)+'</em>':'')+'</button>';}).join('')+'</div>';
  }
  window.PSReviewSchedule={open:open,commit:commit,close:close,dayHTML:dayHTML,canWrite:canWrite};
  window.addEventListener('message',function(e){
    var d=e.data||{};if(d.type!=='reviewTrainingOpen')return;
    if(e.origin!==location.origin||e.source!==parent||parent===window||d.source!=='app'||!sameOwner(d))return;
    var id=String(d.requestId||'');if(!id||seen[id])return;
    if(open(d)){seen[id]=true;var keys=Object.keys(seen);if(keys.length>80)delete seen[keys[0]];}
  });
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-rt-task]');if(b)open({taskId:b.dataset.rtTask});});
  window.addEventListener('storage',function(e){if(draft&&['ps_active_ws','ps_sync_session'].indexOf(e.key)>=0&&!sameOwner(draft.owner))close(true);});
  document.addEventListener('DOMContentLoaded',function(){try{renderWeek();renderDay();}catch(_){}});
})();
