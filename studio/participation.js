/* Pure date-specific participation model. No clock, storage, or status mutation.
 * A direct day record is an observation; a status run is an inferred state.
 * Current availability is authoritative for an explicitly supplied today only.
 * Callers supply the player's schedule kind and local calendar date explicitly.
 */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSParticipation=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var own=Function.call.bind(Object.prototype.hasOwnProperty),DAY=86400000;
  function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
  function has(o,k){return object(o)&&own(o,k);}
  function state(v){return v==='ok'||v==='rest'||v==='rehab'||v==='injury'||v==='out';}
  function kind(v){return v==='train'||v==='match'||v==='off'||v==='none';}
  function player(v){return typeof v==='string'&&v.trim().length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v)&&v!=='__proto__'&&v!=='constructor'&&v!=='prototype';}
  function dateNumber(v){
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
    var y=+v.slice(0,4),m=+v.slice(5,7),d=+v.slice(8,10);
    if(y<1||m<1||m>12||d<1||d>31)return null;
    var at=new Date(0);at.setUTCFullYear(y,m-1,d);at.setUTCHours(0,0,0,0);
    return at.getUTCFullYear()===y&&at.getUTCMonth()===m-1&&at.getUTCDate()===d?at.getTime()/DAY:null;
  }
  function dateString(n){return new Date(n*DAY).toISOString().slice(0,10);}
  function copy(o){
    var out={};Object.keys(o).forEach(function(k){Object.defineProperty(out,k,{value:o[k],enumerable:true,writable:true,configurable:true});});return out;
  }
  function note(o){return object(o)&&typeof o.n==='string'?o.n:'';}
  function none(k){return {s:'',kind:kind(k)?k:'none',source:'none',note:''};}
  function validRecord(v){return object(v)&&state(v.s)&&kind(v.kind)&&typeof v.at==='number'&&Number.isFinite(v.at)&&v.at>=0;}
  function record(meta,pid,day,s,k,at,today,n){
    if(!player(pid))throw new TypeError('Invalid participation player ID');
    if(dateNumber(day)===null||dateNumber(today)===null||day>today)throw new RangeError('Invalid participation date');
    if(!state(s)||!kind(k))throw new TypeError('Invalid participation state or kind');
    if(typeof at!=='number'||!Number.isFinite(at)||at<0)throw new TypeError('Invalid participation timestamp');
    if(n!==undefined&&typeof n!=='string')throw new TypeError('Invalid participation note');
    if(meta==null)meta={};
    if(!object(meta))throw new TypeError('Invalid participation metadata');
    if(has(meta,'participationDays')&&!object(meta.participationDays))throw new TypeError('Invalid participation days');
    var days=has(meta,'participationDays')?meta.participationDays:{};
    if(has(days,day)&&!object(days[day]))throw new TypeError('Invalid participation day');
    var entries=has(days,day)?days[day]:{};
    if(has(entries,pid)&&!object(entries[pid]))throw new TypeError('Invalid participation record');
    var cell=has(entries,pid)?copy(entries[pid]):{};
    cell.s=s;cell.kind=s==='ok'&&(k==='off'||k==='none')?'train':k;cell.at=at;
    if(n!==undefined)cell.n=n;
    var nextMeta=copy(meta),nextDays=copy(days),nextEntries=copy(entries);
    nextEntries[pid]=cell;nextDays[day]=nextEntries;nextMeta.participationDays=nextDays;
    return nextMeta;
  }
  function model(meta,pid,currentStatus,today,assumeTraining){
    var runsRoot=has(meta,'statusRuns')?meta.statusRuns:null;
    var arr=has(runsRoot,pid)&&Array.isArray(runsRoot[pid])?runsRoot[pid]:[];
    function validRun(r){return object(r)&&state(r.s)&&dateNumber(r.from)!==null&&dateNumber(r.to)!==null&&r.from<=r.to;}
    var runs=arr.filter(validRun),last=arr.length&&validRun(arr[arr.length-1])?arr[arr.length-1]:null;
    var days=has(meta,'participationDays')?meta.participationDays:null;
    // A newly written run may cover only one player. Retain exact legacy days
    // for everyone else, without inferring state between legacy observations.
    var legacy=has(meta,'statusLog')?meta.statusLog:null;
    return function(day,k){
      if(dateNumber(day)===null||(today!==undefined&&(dateNumber(today)===null||day>today)))return none(k);
      var current=dateNumber(today)!==null&&day===today&&state(currentStatus)?{s:currentStatus,kind:kind(k)?k:'none',source:'current',note:''}:null;
      // Availability owns today's state. Keep matching observations and their
      // notes; a stale, conflicting state must not override current availability.
      function preferCurrent(result){return current&&current.s!==result.s?current:result;}
      var entries=has(days,day)?days[day]:null;
      if(has(entries,pid)){
        var cell=entries[pid];
        // A malformed explicit observation must not appear as a valid inference.
        return validRecord(cell)?preferCurrent({s:cell.s,kind:cell.kind,source:'record',note:note(cell)}):none(k);
      }
      for(var i=runs.length-1;i>=0;i--){
        var r=runs[i];if(r.from<=day&&day<=r.to)return preferCurrent({s:r.s,kind:kind(k)?k:'none',source:'status',note:note(r)});
      }
      // Extend only the last known matching state, never backfill earlier gaps.
      if(last&&state(currentStatus)&&last.s===currentStatus&&dateNumber(today)!==null&&last.to<day&&day<=today){
        return {s:last.s,kind:kind(k)?k:'none',source:'status',note:note(last)};
      }
      var old=has(legacy,day)?legacy[day]:null;
      if(has(old,pid)&&state(old[pid]))return preferCurrent({s:old[pid],kind:kind(k)?k:'none',source:'status',note:''});
      // Today's availability is useful without creating a historical observation.
      // Opt-in availability defaults fill unmarked past dates as participation,
      // without writing observations or replacing invalid records/future dates.
      return current||(assumeTraining===true&&state(currentStatus)&&dateNumber(today)!==null?{s:'ok',kind:kind(k)?k:'none',source:'default',note:''}:none(k));
    };
  }
  function resolve(meta,pid,day,k,currentStatus,today,assumeTraining){
    if(!player(pid))return none(k);
    return model(meta,pid,currentStatus,today,assumeTraining)(day,k);
  }
  function totals(meta,pid,from,to,kindOf,currentStatus,today,assumeTraining){
    var out={training:0,match:0,exercise:0,rest:0,injury:0,rehab:0,out:0,unknown:0,recorded:0,statusDays:0,currentDays:0,days:0,first:null,last:null};
    var start=dateNumber(from),end=dateNumber(to),limit=today===undefined?null:dateNumber(today);
    if(!player(pid)||start===null||end===null||(today!==undefined&&limit===null))return out;
    if(limit!==null)end=Math.min(end,limit);
    var read=model(meta,pid,currentStatus,today,assumeTraining);
    for(var d=start;d<=end;d++){
      var day=dateString(d),k=typeof kindOf==='function'?kindOf(day,pid):kindOf,result=read(day,k);
      var scheduled=result.kind==='train'||result.kind==='match';out.days++;
      if(result.source==='none'){if(scheduled)out.unknown++;continue;}
      if(out.first===null)out.first=day;out.last=day;
      if(result.source==='record')out.recorded++;
      else if(result.source==='status')out.statusDays++;
      else if(result.source==='current')out.currentDays++;
      if(result.s==='ok'){
        if(result.kind==='train')out.training++;
        else if(result.kind==='match')out.match++;
      }else{
        if(scheduled)out.rest++;
        if(result.s==='injury')out.injury++;
        else if(result.s==='rehab')out.rehab++;
        else if(result.s==='out')out.out++;
      }
    }
    out.exercise=out.training+out.match;return out;
  }
  return {record:record,resolve:resolve,totals:totals};
});
