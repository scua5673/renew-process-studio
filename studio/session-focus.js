/* PROCESS STUDIO 2.749 — 훈련 날짜·저장된 조에 맞는 IDP 참고 자료. 순수 읽기 전용.
   호출자가 계정/팀/자료 준비를 확인한다. docsByUid/pubsByUid의 own key=null은 확인된 부재,
   key 없음은 아직 읽지 못한 자료다. tr.players는 인원수이며 참가자 ID로 해석하지 않는다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSessionFocus=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var own=Object.prototype.hasOwnProperty;
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function text(v){return typeof v==='string'?v.trim():'';}
  function id(v){return (typeof v==='string'||typeof v==='number')?String(v).trim():'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function validDate(s){
    if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.slice(0,4)==='0000')return false;
    var d=new Date(s+'T00:00:00Z');
    return !isNaN(d)&&d.toISOString().slice(0,10)===s;
  }
  function monday(date){
    if(!validDate(date))return '';
    var d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
    return d.toISOString().slice(0,10);
  }
  function localDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function reviewDate(at){
    if(validDate(at))return at;
    if(typeof at==='number'){
      if(!Number.isFinite(at)||at<=0)return '';
      var n=new Date(at),nd=isNaN(n)?'':localDate(n);return validDate(nd)?nd:'';
    }
    /* 모호한 9/12/26, 정규화되는 2월 30일, timezone 없는 시각은 날짜 근거로 쓰지 않는다. */
    if(typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(at)||!validDate(at.slice(0,10)))return '';
    var d=new Date(at),date=isNaN(d)?'':localDate(d);return validDate(date)?date:'';
  }
  function groups(value){
    if(value==null||value==='')return [];
    var a=Array.isArray(value)?value:(typeof value==='string'?[value]:null);if(!a)return null;
    var out=[];
    for(var i=0;i<a.length;i++){
      if(typeof a[i]!=='string')return null;
      var s=a[i].trim();if(s&&out.indexOf(s)<0)out.push(s);
    }
    return out;
  }
  function scope(session,day){
    var s=object(session)?session:{},d=object(day)?day:{},g=groups(s.grp),source='session';
    if(g&&g.length===0){g=groups(d.grp);source='day';}
    if(g===null)return {kind:'unknown',groups:[],source:source,label:'조 정보 확인 필요'};
    if(!g.length)return {kind:'team',groups:[],source:'team',label:'팀 공통'};
    return {kind:'groups',groups:g,source:source,label:g.join(' · ')};
  }
  function weekly(doc,date){
    var wk=monday(date);if(!wk||!object(doc))return null;
    var map=object(doc.focusByWk)?doc.focusByWk:null;
    if(map&&own.call(map,wk)){
      var f=map[wk];
      /* 날짜 키가 있는 새 기록이 비었거나 모순이면 옛 focus를 부활시키지 않는다. */
      if(!object(f)||!text(f.text)||(f.wk!=null&&f.wk!==wk))return null;
      return {week:wk,text:text(f.text),source:'focusByWk'};
    }
    var legacy=doc.focus;
    return object(legacy)&&legacy.wk===wk&&text(legacy.text)?{week:wk,text:text(legacy.text),source:'focus'}:null;
  }
  function review(pub,date){
    if(!validDate(date)||!object(pub)||!Array.isArray(pub.reviews))return null;
    var latest=null,latestDate='';
    pub.reviews.forEach(function(r){
      if(!object(r))return;var at=reviewDate(r.at);
      /* 배열은 리뷰를 추가한 순서. 같은 날에는 마지막 기록을 고르며 원본 정렬은 하지 않는다. */
      if(at&&at<=date&&at>=latestDate){latest=r;latestDate=at;}
    });
    if(!latest)return null;
    var goals=(Array.isArray(latest.goals)?latest.goals:[]).filter(object).map(function(g){
      return {text:text(g.t),cat:text(g.cat),decision:text(g.dec)};
    }).filter(function(g){return g.text||g.cat||g.decision;});
    /* 최신 날짜에 목표가 없으면 오래된 목표를 현재 참고처럼 되살리지 않는다. */
    return goals.length?{date:latestDate,goals:goals}:null;
  }
  function build(input){
    input=object(input)?input:{};
    var date=validDate(input.date)?input.date:'',sc=scope(input.session,input.day);
    var out={status:'empty',date:date,week:monday(date),scope:sc,rows:[],warnings:[]};
    function warn(code,message){if(!out.warnings.some(function(w){return w.code===code;}))out.warnings.push({code:code,message:message});}
    if(input.canRead!==true){out.status='forbidden';return out;}
    if(!date){out.status='invalid-date';return out;}
    if(input.ready!==true||!object(input.roster)||!Array.isArray(input.roster.players)||!object(input.permissions)||!object(input.permissions.members)){out.status='unavailable';return out;}
    if(sc.kind==='unknown'){out.status='unknown-scope';return out;}
    var docs=object(input.docsByUid)?input.docsByUid:{},pubs=object(input.pubsByUid)?input.pubsByUid:{};
    var members=input.permissions.members,byPid=Object.create(null),seenPid=Object.create(null),positions=Object.create(null);
    Object.keys(members).forEach(function(uid){
      var m=members[uid],pid=object(m)?id(m.playerId):'';if(!pid||!uid)return;
      if(!byPid[pid])byPid[pid]=[];byPid[pid].push(uid);
    });
    (Array.isArray(input.roster.positions)?input.roster.positions:[]).forEach(function(p){if(object(p)&&id(p.id))positions[id(p.id)]=text(p.name);});
    input.roster.players.forEach(function(p){if(object(p)&&p.type!=='target'&&id(p.id))seenPid[id(p.id)]=(seenPid[id(p.id)]||0)+1;});
    var tombs=object(input.deletedPlayers)?input.deletedPlayers:{};
    if(sc.kind==='team')warn('attendance-unknown','팀 공통 범위입니다. 인원수만으로 실제 참가 선수를 확인할 수 없습니다.');
    input.roster.players.forEach(function(p){
      if(!object(p)||p.type==='target')return;
      var pid=id(p.id);if(pid&&own.call(tombs,pid)&&tombs[pid])return;
      var pg=text(p.grp);
      if(sc.kind==='groups'){
        if(!pg){warn('player-group-unknown','조가 확인되지 않은 선수는 이 조의 참고 목록에서 제외했습니다.');return;}
        if(sc.groups.indexOf(pg)<0)return;
      }
      if(!pid||!text(p.name)){warn('player-identity-unknown','선수 ID나 이름을 확인할 수 없는 항목은 제외했습니다.');return;}
      if(seenPid[pid]!==1){warn('player-identity-ambiguous','선수 ID가 중복된 항목은 연결을 확인한 뒤 볼 수 있습니다.');return;}
      var links=byPid[pid]||[];
      if(links.length!==1){warn(links.length?'account-ambiguous':'account-unlinked',links.length?'한 선수에 여러 계정이 연결되어 해당 선수의 초점을 읽지 않았습니다.':'계정이 연결되지 않은 선수의 초점은 확인할 수 없습니다.');return;}
      var uid=links[0],haveDoc=own.call(docs,uid)&&(docs[uid]===null||object(docs[uid])),havePub=own.call(pubs,uid)&&(pubs[uid]===null||object(pubs[uid]));
      if(!haveDoc||!havePub)warn('documents-unavailable','아직 읽지 못한 선수 자료가 있습니다. 자료가 준비되면 다시 확인해 주세요.');
      var f=haveDoc?weekly(docs[uid],date):null,r=havePub?review(pubs[uid],date):null;
      if(f||r)out.rows.push({playerId:pid,uid:uid,name:text(p.name),num:id(p.num),pos:positions[id(p.posId)]||'',group:pg,weekly:f,weeklyState:haveDoc?'known':'unavailable',coach:r});
    });
    if(out.rows.length)out.status='ready';
    else if(out.warnings.some(function(w){return w.code!=='attendance-unknown';}))out.status='unavailable';
    return out;
  }
  function render(result,categoryLabels){
    if(!object(result)||result.status==='forbidden')return '';
    var labels=object(categoryLabels)?categoryLabels:{},rows=Array.isArray(result.rows)?result.rows:[];
    var messages={'invalid-date':'훈련 날짜를 확인할 수 없어 개인 초점을 읽지 않았습니다.',unavailable:'선수 자료를 아직 확인하지 못했습니다. 자료가 준비되면 다시 확인해 주세요.','unknown-scope':'저장된 조 정보를 확인할 수 없어 개인 초점을 읽지 않았습니다.',empty:'이 날짜의 주간 초점이나 날짜가 확인되는 코치 리뷰 참고가 없습니다.'};
    var h='<div class="sfocus"><div class="sfh"><b>훈련 날짜의 개인 초점</b><span>'+esc(result.date||'날짜 확인 필요')+'</span><span class="ro">읽기 전용</span></div>';
    if(result.date&&result.scope)h+='<p class="sfn">현재 선수단의 '+esc(result.scope.label)+' 기준 · 실제 출석 명단은 별도입니다.</p>';
    if(!rows.length)h+='<p class="sfn">'+esc(messages[result.status]||messages.empty)+'</p>';
    rows.forEach(function(r){
      h+='<div class="fr"><span class="who">'+(r.num?'<span class="no">'+esc(r.num)+'</span>':'')+'<i>'+esc(r.name)+'</i>'+(r.pos?'<em>'+esc(r.pos)+'</em>':'')+'</span><span class="bd">';
      if(r.weekly)h+='<span class="wk">'+esc(result.week)+' 주간 초점 · <b>'+esc(r.weekly.text)+'</b></span>';
      else h+='<span class="l">'+(r.weeklyState==='unavailable'?'주간 초점을 아직 확인하지 못했습니다.':'해당 주에 저장된 초점 없음')+'</span>';
      if(r.coach){
        h+='<span class="l">코치 리뷰 참고 · '+esc(r.coach.date)+'</span>';
        r.coach.goals.forEach(function(g){
          if(g.cat)h+='<span class="l"><span class="mk">ⓐ</span>'+esc(own.call(labels,g.cat)?labels[g.cat]:g.cat)+'</span>';
          if(g.text)h+='<span class="l"><span class="mk b">ⓑ</span>'+esc(g.text)+'</span>';
          if(g.decision)h+='<span class="l"><span class="mk c">ⓒ</span>'+esc(g.decision)+'</span>';
        });
      }
      h+='</span></div>';
    });
    if(rows.some(function(r){return !!r.coach;}))h+='<p class="sfn">코치 리뷰는 참고 기록이며, 이 훈련에 적용됐는지는 확인되지 않습니다.</p>';
    (result.warnings||[]).forEach(function(w){h+='<p class="sfn">'+esc(w.message)+'</p>';});
    return h+'</div>';
  }
  return {validDate:validDate,monday:monday,reviewDate:reviewDate,scope:scope,weekly:weekly,review:review,build:build,render:render,esc:esc};
});
