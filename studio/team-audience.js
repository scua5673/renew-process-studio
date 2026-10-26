/* Stable team keys and independent school years. No data is rewritten on read. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSTeamAudience=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var own=function(o,k){return Object.prototype.hasOwnProperty.call(o||{},k);};
  function list(a){return (Array.isArray(a)?a:[]).map(function(x){return String(x==null?'':x).trim();}).filter(function(x,i,all){return x&&all.indexOf(x)===i;});}
  function years(a){return list(a).filter(function(x){return /^[1-3]$/.test(x);}).sort();}
  function label(key,meta){var names=meta&&meta.grpLabels;return own(names,key)&&typeof names[key]==='string'?names[key]:String(key||'');}
  function keys(doc){var m=doc&&doc.meta||{},base=Array.isArray(m.grpBase)&&m.grpBase.length?m.grpBase:['A팀','B팀','C팀'];return list(base.concat((doc&&doc.players||[]).filter(function(p){return p&&p.type!=='target';}).map(function(p){return String(p.grp||'').trim();})));}
  function legacy(key){return /^[1-6]학년$/.test(String(key||''));}
  function rename(meta,changes,allKeys){
    var result=Object.assign({},meta),names=Object.assign({},meta&&meta.grpLabels),seen=new Set();
    list(allKeys).forEach(function(key){
      var next=String(own(changes,key)?changes[key]:label(key,meta)).trim();
      if(!next||next.length>40)throw new Error('조 이름은 1~40자로 적어 주세요.');
      if(seen.has(next))throw new Error('같은 조 이름을 두 번 사용할 수 없어요.');
      seen.add(next);Object.defineProperty(names,key,{value:next,enumerable:true,writable:true,configurable:true});
    });
    result.grpLabels=names;return result;
  }
  function yearMatch(item,selected){var wanted=years(selected),scope=years(item&&item.schoolYears);return !wanted.length||!scope.length||scope.some(function(y){return wanted.indexOf(y)>=0;});}
  function playerMatch(player,item,day){
    var raw=item&&item.grp,groups=list(Array.isArray(raw)?raw:raw?[raw]:[]);if(!groups.length)groups=list(day&&day.grp?[day.grp]:[]);
    return (!groups.length||groups.indexOf(String(player&&player.grp||'').trim())>=0)&&(!years(item&&item.schoolYears).length||years(item.schoolYears).indexOf(String(player&&player.schoolYear||''))>=0);
  }
  function yearDay(day,selected){
    if(!day||!years(selected).length)return day;
    var out=JSON.parse(JSON.stringify(day)),removed=[];
    if(Array.isArray(out.trainings))out.trainings=out.trainings.filter(function(t){var keep=yearMatch(t,selected);if(!keep)removed.push(String(t.slot||''));return keep;});
    var b=out.board;
    if(b) [['trains','trainSlot','trainData'],['warms','warmSlot','warmsData'],['meets','meetSlot','meetsData'],['libs','libSlot','libData']].forEach(function(keys){
      var indices=(b[keys[0]]||[]).map(function(_,i){return i;}).filter(function(i){return removed.indexOf(String((b[keys[1]]||[])[i]||''))<0;});
      keys.forEach(function(k){if(Array.isArray(b[k]))b[k]=indices.map(function(i){return b[k][i];});});
    });
    if(day.trainings&&day.trainings.length&&!out.trainings.length&&b&&b.sched==='훈련'){b.sched='';b.theme='';}
    return out;
  }
  function yearText(item){var a=years(item&&item.schoolYears);return a.length?a.map(function(y){return y+'학년';}).join(' · '):'전체 학년';}
  return {keys:keys,label:label,legacy:legacy,rename:rename,years:years,yearMatch:yearMatch,playerMatch:playerMatch,yearDay:yearDay,yearText:yearText};
});
