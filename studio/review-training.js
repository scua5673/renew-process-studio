/* PROCESS STUDIO 2.746 — 경기 리뷰에서 날짜별 훈련 과제로 이어지는 순수 자료 규칙.
   저장·권한 판정은 호출자가 맡는다. 원본 리뷰와 일정은 여기서 변경하지 않는다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSReviewTraining=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var DAY=86400000, own=Object.prototype.hasOwnProperty;
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function safeText(v,max){
    var s=typeof v==='string'?v.trim():'';
    return typeof max==='number'&&max>=0?s.slice(0,max):s;
  }
  function esc(v){return safeText(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function bounded(v,max,required){return typeof v==='string'&&v.length<=max&&(!required||!!v.trim());}
  function safeId(v){return bounded(v,160,true)&&v===v.trim()&&v!=='__proto__'&&v!=='constructor'&&v!=='prototype';}
  function validDate(s){
    if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    var y=+s.slice(0,4),m=+s.slice(5,7),d=+s.slice(8,10);
    if(y<1||m<1||m>12||d<1||d>31)return false;
    var t=new Date(0);t.setUTCFullYear(y,m-1,d);t.setUTCHours(0,0,0,0);
    return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;
  }
  function dateTime(s){
    var t=new Date(0);t.setUTCFullYear(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10));t.setUTCHours(0,0,0,0);return t.getTime();
  }
  function groups(v){
    if(v==null)return [];
    if(!Array.isArray(v)||v.length>30)return null;
    var out=[];
    for(var i=0;i<v.length;i++){
      if(!bounded(v[i],80,false))return null;
      var s=v[i].trim();if(s&&out.indexOf(s)<0)out.push(s);
    }
    return out.sort();
  }
  function textKey(s){return safeText(s).replace(/\s+/g,' ');}
  function sources(m){
    if(!object(m))return [];
    var out=[],seen=Object.create(null);
    function add(key,label,text){
      var s=safeText(text),identity=textKey(s);if(!s||seen[identity])return;
      seen[identity]=true;out.push({key:key,label:label,text:s});
    }
    add('reviewImprove','전체 개선할 점',m.reviewImprove);
    if(object(m.phaseReview))Object.keys(m.phaseReview).forEach(function(k){
      if(k==='__proto__'||k==='constructor'||k==='prototype'||!bounded(k,140,true))return;
      var row=m.phaseReview[k];if(object(row))add('phaseReview:'+k,k,row.improve);
    });
    add('trainingAction','기존 훈련 과제',m.trainingAction);
    return out;
  }
  function validTask(task){
    if(!object(task)||!safeId(task.id)||!bounded(task.matchId,160,true)||!validDate(task.matchDate))return false;
    if(!bounded(task.sourceKey,160,true)||!bounded(task.action,2000,true)||!bounded(task.opponent,160,false))return false;
    if(task.status!=='planned'&&task.status!=='done'&&task.status!=='skipped')return false;
    if(task.observation!=null&&typeof task.observation!=='string')return false;
    if(groups(task.grp)===null)return false;
    return Number.isFinite(task.createdAt)&&task.createdAt>0&&Number.isFinite(task.updatedAt)&&task.updatedAt>0;
  }
  function newTask(input){
    if(!object(input))return null;
    var grp=groups(input.grp);
    if(!safeId(input.id)||!bounded(input.matchId,160,true)||!validDate(input.matchDate)||
       !bounded(input.sourceKey,160,true)||!bounded(input.action,2000,true)||
       (input.opponent!=null&&!bounded(input.opponent,160,false))||grp===null||!Number.isFinite(input.now)||input.now<=0)return null;
    return {id:input.id.trim(),matchId:input.matchId.trim(),matchDate:input.matchDate,
      opponent:safeText(input.opponent),sourceKey:input.sourceKey.trim(),action:input.action.trim(),grp:grp,
      status:'planned',observation:'',createdAt:input.now,updatedAt:input.now};
  }
  function list(doc){
    if(!object(doc)||!validDate(doc.anchorMonday)||!object(doc.weeks))return [];
    var anchor=dateTime(doc.anchorMonday);if(new Date(anchor).getUTCDay()!==1)return [];
    var rows=[],byId=Object.create(null);
    Object.keys(doc.weeks).filter(function(k){return /^-?(?:0|[1-9]\d{0,5})$/.test(k)&&k!=='-0';})
      .sort(function(a,b){return (+a)-(+b);}).forEach(function(k){
        var week=doc.weeks[k];if(!Array.isArray(week)||week.length!==7)return;
        week.forEach(function(day,di){
          if(!object(day)||!Array.isArray(day.reviewActions))return;
          var date=new Date(anchor+((+k)*7+di)*DAY).toISOString().slice(0,10);if(!validDate(date))return;
          day.reviewActions.forEach(function(task){
            if(!validTask(task))return;
            var row={task:task,date:date,weekKey:k,dayIndex:di};
            if(!own.call(byId,task.id)){byId[task.id]=rows.length;rows.push(row);}
            else if(task.updatedAt>rows[byId[task.id]].task.updatedAt)rows[byId[task.id]]=row;
          });
        });
      });
    return rows.sort(function(a,b){return a.date.localeCompare(b.date)||a.task.createdAt-b.task.createdAt||a.task.id.localeCompare(b.task.id);});
  }
  function forMatch(doc,mid){
    var id=safeText(mid);return id?list(doc).filter(function(row){return row.task.matchId===id;}):[];
  }
  function statusLabel(task){
    if(!object(task))return '';
    if(task.status==='planned')return '훈련 예정';
    if(task.status==='skipped')return '진행하지 않음';
    if(task.status==='done')return safeText(task.observation)?'결과 남김':'진행함 · 결과 대기';
    return '';
  }
  function duplicate(day,task){
    if(!object(day)||!Array.isArray(day.reviewActions)||!object(task))return null;
    var mid=safeText(task.matchId),action=textKey(task.action),grp=groups(task.grp);
    if(!mid||!action||grp===null)return null;
    for(var i=0;i<day.reviewActions.length;i++){
      var other=day.reviewActions[i];if(!validTask(other))continue;
      if(other.matchId===mid&&textKey(other.action)===action&&JSON.stringify(groups(other.grp))===JSON.stringify(grp))return other;
    }
    return null;
  }
  return {validDate:validDate,sources:sources,list:list,forMatch:forMatch,statusLabel:statusLabel,
    newTask:newTask,duplicate:duplicate,safeText:safeText,esc:esc};
});
