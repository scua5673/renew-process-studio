/* Read-only daily self-reported intensity. No planned minutes or load calculation. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PSDailyEffort=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function identity(v){return (typeof v==='string'||typeof v==='number')?String(v).trim():'';}
  function validDate(s){
    if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    var p=s.split('-').map(Number);if(p[0]<1||p[1]<1||p[1]>12||p[2]<1)return false;
    var days=[31,(p[0]%4===0&&(p[0]%100!==0||p[0]%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
    return p[2]<=days[p[1]-1];
  }
  function rpe(v){
    if(typeof v==='string'){v=v.trim();if(!/^(?:[1-9]|10)$/.test(v))return null;v=Number(v);}
    return typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=10?v:null;
  }
  function cohort(players,members,group,tombstones){
    group=typeof group==='string'?group.trim():'';
    tombstones=object(tombstones)?tombstones:{};
    var byPlayer=Object.create(null),rows=Object.create(null);
    (Array.isArray(players)?players:[]).forEach(function(p){
      if(!object(p)||p.type==='target'||!identity(p.name))return;
      var id=identity(p.id);if(!id||tombstones[id])return;
      if(!rows[id])rows[id]={count:0,inGroup:false};
      rows[id].count++;if(!group||identity(p.grp)===group)rows[id].inGroup=true;
    });
    Object.keys(rows).forEach(function(id){if(rows[id].inGroup)byPlayer[id]=[];});
    if(object(members))Object.keys(members).forEach(function(uid){
      var member=members[uid],id=object(member)?identity(member.playerId):'';
      if(uid&&id&&byPlayer[id])byPlayer[id].push(uid);
    });
    return Object.keys(byPlayer).filter(function(id){return byPlayer[id].length;}).map(function(id){
      return {playerId:id,uid:byPlayer[id].length===1&&rows[id].count===1?byPlayer[id][0]:null};
    });
  }
  function groups(players,tombstones){
    tombstones=object(tombstones)?tombstones:{};
    var out=[];
    (Array.isArray(players)?players:[]).forEach(function(p){
      if(!object(p)||p.type==='target'||!identity(p.id)||!identity(p.name)||tombstones[identity(p.id)])return;
      var g=identity(p.grp);if(g&&out.indexOf(g)<0)out.push(g);
    });
    return out;
  }
  function summarize(options){
    options=options||{};var group=typeof options.group==='string'?options.group.trim():'';
    var people=cohort(options.players,options.members,group,options.tombstones),docs=object(options.documents)?options.documents:{};
    var seen=Object.create(null),days=[];
    (Array.isArray(options.dates)?options.dates:[]).forEach(function(date){
      if(!validDate(date)||seen[date])return;seen[date]=true;
      var day={date:date,linked:people.length,n:0,mean:null,missing:0,unavailable:0,invalid:0,off:0,ambiguous:0,team:0,other:0,unknown:0},sum=0;
      people.forEach(function(person){
        if(!person.uid){day.ambiguous++;return;}
        var doc=docs[person.uid];
        /* Missing/invalid documents may not have arrived on this device. They are
           not evidence that the player did not submit a diary. */
        if(!object(doc)||doc.v!==1||!object(doc.log)){day.unavailable++;return;}
        if(!Object.prototype.hasOwnProperty.call(doc.log,date)){day.missing++;return;}
        var log=doc.log[date];if(!object(log)){day.unavailable++;return;}
        /* The shipped diary marks rest/injury as off and clears RPE on that choice.
           Old contradictory records must not become a zero or a valid training response. */
        if(log.t==='rest'||log.t==='injury'){day.off++;return;}
        var value=rpe(log.rpe);
        if(value===null){
          if(log.rpe==null||(typeof log.rpe==='string'&&!log.rpe.trim()))day.missing++;
          else day.invalid++;
          return;
        }
        day.n++;sum+=value;
        if(log.t==='team'||log.t==='match')day.team++;
        else if(log.t==='rehab'||log.solo===true)day.other++;
        else day.unknown++;
      });
      if(day.n)day.mean=Math.round(sum/day.n*10)/10;
      days.push(day);
    });
    return {group:group,groups:groups(options.players,options.tombstones),linked:people.length,days:days};
  }
  function access(win){
    try{
      var shell=win.parent&&win.parent!==win?win.parent:win,api=shell.PSSync,perms=shell.PSPerms||win.PSPerms;
      var s=api&&api.session&&api.session(),w=api&&api.activeWsObj&&api.activeWsObj(),active=api&&api.activeWs&&api.activeWs();
      var role=perms&&perms.role&&perms.role();
      if(!s||typeof s.uid!=='string'||!s.uid||typeof s.at!=='string'||!s.at||typeof s.rt!=='string'||!s.rt||!w||w.kind!=='team'||!w.id||String(active)!==String(w.id)||!api.dataUnlocked||api.dataUnlocked()!==true)return null;
      if(['admin','executive','staff'].indexOf(role)<0)return null;
      return {uid:String(s.uid),wid:String(w.id),role:role};
    }catch(_){return null;}
  }
  function read(win,dates,group){
    var owner=access(win);if(!owner)return null;
    try{
      function parse(key){try{return JSON.parse(win.localStorage.getItem(key)||'null');}catch(_){return null;}}
      var team=parse('scout_tool_v1'),perms=parse('cs_perms_v1'),tombstones=parse('cs_player_del_v1');
      if(!object(team)||!Array.isArray(team.players)||!object(perms)||!object(perms.members))return null;
      var people=cohort(team.players,perms.members,group,tombstones),docs=Object.create(null);
      people.forEach(function(p){if(p.uid)docs[p.uid]=parse('cs_idp_v1_'+p.uid);});
      var current=access(win);
      if(!current||current.uid!==owner.uid||current.wid!==owner.wid||current.role!==owner.role)return null;
      return summarize({players:team.players,members:perms.members,tombstones:tombstones,documents:docs,dates:dates,group:group});
    }catch(_){return null;}
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function render(summary,labels){
    if(!summary)return '';
    var choices=(summary.groups||[]).slice();if(summary.group&&choices.indexOf(summary.group)<0)choices.push(summary.group);
    var h='<div class="daily-effort-head"><div class="lbl">선수 자기보고 강도 <span class="sublbl">RPE 1~10</span></div>'
      +'<label class="daily-effort-filter">선수 조 <select data-effort-group aria-label="자기보고 강도 선수 조"><option value="">전체 조</option>'
      +choices.map(function(g){return '<option value="'+esc(g)+'"'+(g===summary.group?' selected':'')+'>'+esc(g)+'</option>';}).join('')+'</select></label></div>';
    h+='<p class="daily-effort-note">이 기기에서 확인한 날짜별 일지 응답 평균 · 계획 부하와 별도 집계</p>';
    var criteria='<details class="daily-effort-criteria"><summary>집계 기준</summary>'
      +'<p class="daily-effort-note">응답하지 않은 선수는 평균에 넣지 않습니다. 참여 범위·실제 운동 시간은 확인되지 않아 계획 부하와 합산하거나 비교하지 않습니다.</p>'
      +'<p class="daily-effort-note">팀훈련·경기 응답도 전체 세션 참여나 개인운동 제외를 뜻하지 않습니다.</p></details>';
    if(!summary.linked)return h+'<p class="daily-effort-note">이 범위에 계정이 연결된 선수가 없습니다.</p>'+criteria;
    h+='<div class="daily-effort-list">';
    summary.days.forEach(function(d,i){
      var detail=[];
      if(d.team)detail.push('팀훈련·경기 '+d.team+'명');
      if(d.other)detail.push('재활·개인운동 '+d.other+'명');
      if(d.unknown)detail.push('참여 유형 미확인 '+d.unknown+'명');
      if(d.off)detail.push('휴식·부상중 '+d.off+'명 제외');
      if(d.invalid)detail.push('범위 밖·잘못된 값 '+d.invalid+'명 제외');
      if(d.unavailable)detail.push('일지 자료 미확인 '+d.unavailable+'명');
      if(d.ambiguous)detail.push('명단·계정 연결 확인 필요 '+d.ambiguous+'명');
      h+='<div class="daily-effort-day"><div class="daily-effort-main"><span>'+esc((labels&&labels[i]?labels[i]+' · ':'')+d.date.slice(5).replace('-','/'))+'</span>'
        +'<b'+(d.n?'':' aria-label="확인된 강도 없음"')+'>'+(d.n?esc(Number(d.mean).toFixed(1))+' <small>/ 10</small>':'—')+'</b><span>응답 '+d.n+' / 연결 '+d.linked+'명</span></div>'
        +(detail.length?'<div class="daily-effort-detail">'+esc(detail.join(' · '))+'</div>':'')+'</div>';
    });
    return h+'</div>'+criteria;
  }
  return {rpe:rpe,validDate:validDate,cohort:cohort,groups:groups,summarize:summarize,access:access,read:read,render:render};
});
