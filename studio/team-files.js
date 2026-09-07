/* PROCESS STUDIO · 팀 메뉴별 포터블 파일
   전체 localStorage를 썩아 옮기지 않고, 현재 팀의 일정·경기·선수·스카우팅·
   IDP·게임모델만 각각 정확히 저장/교체한다. 세션·권한·ps_sync_*는 절대 넣지 않는다. */
(function(){
  'use strict';

  /* sync.js의 MAXLEN과 같아야 한다. 이보다 큰 원문을 로컬에 적용하면 서버가
     영원히 건너뛰므로 파일 검증 단계에서 먼저 멈춘다. */
  var TYPE='process-studio-section',SCHEMA=2,MAX_FILE=120*1024*1024,MAX_RAW=1500000,MAX_MATCH_IDS=1000,MAX_POSITION_TARGETS=200;
  var LABEL={schedule:'일정',match:'경기',players:'선수',scouting:'스카우팅',idp:'IDP',gamemodel:'게임모델'};
  var NAV={today:'schedule',training:'schedule',match:'match',players:'players',scouting:'scouting',idp:'idp',settings:'gamemodel'};
  var IDB_MIRROR={process_coach_v1:1,cs_team_matches_v1:1,cs_scout_targets_v1:1,cs_squad_v1:1};
  var SCHEDULE_KEYS=['process_coach_v1','cs_themes_v1','cs_psched_v1','cs_pmeet_v1','cs_pwarm_v1','cs_ptrain_v1','cs_team_v1'];
  var MATCH_KEYS=['cs_team_matches_v1','cs_assign_v1','cs_match_del_v1'];
  var EMPTY_RAW={
    cs_themes_v1:'[]',cs_psched_v1:'[]',cs_pmeet_v1:'[]',cs_pwarm_v1:'[]',cs_ptrain_v1:'[]',cs_team_v1:'{}',
    cs_assign_v1:'{"v":1,"match":{}}',cs_match_del_v1:'[]'
  };
  var SCOUT_META=['scoutForm','scoutName','scoutRank','sbPitch','sbPitchCol'];
  var NONPLAYER_META=SCOUT_META.concat(['staffReady']);
  var UID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var IMPORTING=false,IMPORT_TARGET='';

  function fail(msg){var e=new Error(msg||'파일 검증에 실패했습니다');e.name='PSTeamFileError';throw e;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function parse(raw,label){try{var v=JSON.parse(raw);noDanger(v,0);return v;}catch(e){if(e&&e.name==='PSTeamFileError')throw e;fail((label||'자료')+' 형식이 올바르지 않습니다');}}
  function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function plain(o){return !!(o&&typeof o==='object'&&!Array.isArray(o));}
  function scoutDoc(doc,label){
    if(!plain(doc)||!Array.isArray(doc.attrs)||!Array.isArray(doc.positions)||!Array.isArray(doc.players)||(own(doc,'meta')&&!plain(doc.meta)))fail((label||'선수단')+' 형식이 올바르지 않습니다');
    if(!own(doc,'meta'))doc.meta={};return doc;
  }
  function exactKeys(o,allowed,label){
    if(!o||typeof o!=='object'||Array.isArray(o))fail((label||'파일')+' 형식이 올바르지 않습니다');
    Object.keys(o).forEach(function(k){if(allowed.indexOf(k)<0)fail((label||'파일')+'에 허용되지 않은 항목이 있습니다: '+k);});
  }
  function noDanger(v,depth){
    if(depth>40)fail('파일 구조가 너무 깊습니다');
    if(!v||typeof v!=='object')return;
    Object.keys(v).forEach(function(k){if(k==='__proto__'||k==='prototype'||k==='constructor')fail('파일에 안전하지 않은 항목이 있습니다');noDanger(v[k],depth+1);});
  }
  function unique(arr,key,label){
    var seen={};(arr||[]).forEach(function(x){var id=String(x&&x[key]||'');if(!id)return;if(seen[id])fail((label||'항목')+'에 같은 ID가 두 개 있습니다');seen[id]=1;});
  }
  function idpUidKey(prefix,k){return typeof k==='string'&&k.indexOf(prefix)===0&&UID_RE.test(k.slice(prefix.length));}
  function workspace(){try{return window.PSSync&&PSSync.activeWsObj&&PSSync.activeWsObj();}catch(_){return null;}}
  function session(){try{return window.PSSync&&PSSync.session&&PSSync.session();}catch(_){return null;}}
  function loginGuide(){
    try{window.alert('파일 기능은 로그인한 뒤 팀 데이터가 안전하게 준비되면 사용할 수 있습니다.\n\n오른쪽 위 계정에서 로그인한 뒤 다시 시도해 주세요.');}catch(_){}
    try{var b=document.querySelector('#psAcctWrap .acct-btn');if(b)setTimeout(function(){try{b.click();}catch(_){}},0);}catch(_){}
  }
  function requireDataUnlocked(){
    var api=window.PSSync,s=null,ok=false;
    try{s=api&&api.session&&api.session();ok=!!(s&&s.uid&&api.dataUnlocked&&api.dataUnlocked()===true);}catch(_){ok=false;}
    if(ok)return true;
    loginGuide();var e=new Error('로그인과 팀 데이터 준비가 끝난 뒤 파일 기능을 사용할 수 있습니다');e.name='PSDataLockedError';e.psLoginRequired=true;throw e;
  }
  function current(){var k='';try{k=window.__psTeamSection&&window.__psTeamSection()||'';}catch(_){}return NAV[k]||'';}
  function active(){var w=workspace();return !!(w&&w.kind==='team'&&current());}
  function ensureTarget(id){var w=workspace();if(!w||w.kind!=='team'||w.id!==id){var e=new Error('파일을 가져오는 동안 선택한 팀이 바뀌었습니다');e.name='PSTeamFileWorkspaceError';e.psWorkspaceChanged=true;throw e;}return w;}
  function canImport(section,pkg){
    var P=window.PSPerms;if(!P||!P.canEdit||!P.role)return false;
    if(section==='idp'){
      var s=session(),scope=pkg&&pkg.payload&&pkg.payload.scope;
      return !!(s&&UID_RE.test(String(s.uid||''))&&scope&&scope.mode==='self'&&scope.uid===s.uid);
    }
    /* 메뉴 파일 가져오기는 한 화면만 바꾸는 일반 편집과 달리 연결 문서와
       서버 삭제 기록까지 한 번에 교체한다. 일부 scope만 가진 계정에서 몇 키만
       올라가 버리는 상태를 만들지 않도록 운영진에게만 연다. */
    var role=String(P.role()||'');
    if(role!=='admin'&&role!=='executive')return false;
    if(section==='schedule')return !!P.canEdit('schedule');
    if(section==='match'||section==='players')return !!P.canEdit('team');
    if(section==='scouting')return !!(P.canEdit('scout')&&P.canEdit('team'));
    if(section==='gamemodel')return !!(P.canEdit('gamemodel')&&P.canEdit('team'));
    return false;
  }
  function pause(ms){return new Promise(function(ok){setTimeout(ok,ms);});}
  function blurEditors(){
    try{var a=document.activeElement;if(a&&a.blur)a.blur();}catch(_){}
    ['fProcess','fScout','fIdp','fGameModel'].forEach(function(id){try{var f=document.getElementById(id),a=f&&f.contentDocument&&f.contentDocument.activeElement;if(a&&a.blur)a.blur();}catch(_){}});
  }
  function ready(){
    blurEditors();
    return pause(480).then(function(){return window.PSStorage&&PSStorage.sharedReady?PSStorage.sharedReady():true;});
  }
  function getRaw(k){
    if(IDB_MIRROR[k]&&window.storage){return window.storage.get(k).then(function(r){if(r&&r.value!=null)return r.value;try{return localStorage.getItem(k);}catch(_){return null;}});}
    try{return Promise.resolve(localStorage.getItem(k));}catch(_){return Promise.resolve(null);}
  }
  function setRaw(k,raw){
    if(typeof raw!=='string'||raw.length>MAX_RAW)return Promise.reject(new Error(k+' 자료 크기가 허용 범위를 넘었습니다'));
    var p;
    if(IDB_MIRROR[k]&&window.storage){p=window.psSaveSharedAsync?window.psSaveSharedAsync(k,raw):(function(){localStorage.setItem(k,raw);return window.storage.set(k,raw);})();}
    else{try{localStorage.setItem(k,raw);p=Promise.resolve(true);}catch(e){p=Promise.reject(e);}}
    return Promise.resolve(p).then(function(){return getRaw(k);}).then(function(v){if(v!==raw)fail(k+' 저장을 다시 읽어 확인하지 못했습니다');return raw;});
  }
  function sha(raw){
    if(!window.crypto||!crypto.subtle||!window.TextEncoder)return Promise.reject(new Error('이 브라우저는 파일 위변조 검증을 지원하지 않습니다'));
    return crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(raw))).then(function(buf){return Array.prototype.map.call(new Uint8Array(buf),function(x){return x.toString(16).padStart(2,'0');}).join('');});
  }
  function isoDay(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function firstText(a){for(var i=0;i<a.length;i++){var s=String(a[i]==null?'':a[i]).replace(/\s+/g,' ').trim();if(s&&s!=='상대 미정'&&s!=='새 경기')return s;}return '';}
  function matchDay(day){var b=day&&day.board||{};return !!(day&&(day.match||b.sched==='경기'||b.type==='경기'||b.kind==='match'));}
  function opponent(day){
    day=day||{};var m=day.match||{},b=day.board||{},md=m.data||m.details||{},bd=b.data||b.details||{};
    return firstText([m.opp,m.opponent,m.opponentName,m.vs,m.matchOpp,m.matchOpponent,m.team,m.awayTeam,m.homeTeam,m.name,m.title,m.label,m.summary,
      md.opp,md.opponent,md.opponentName,md.vs,md.team,md.name,md.title,
      b.opp,b.opponent,b.opponentName,b.vs,b.matchOpp,b.matchOpponent,b.team,b.awayTeam,b.homeTeam,b.title,b.label,
      bd.opp,bd.opponent,bd.opponentName,bd.vs,bd.team,bd.name,bd.title,
      day.opp,day.opponent,day.opponentName,day.vs,day.matchOpp,day.matchOpponent,day.awayTeam,day.homeTeam,day.title]);
  }
  function scheduleMap(raw){
    var doc=parse(raw,'일정'),m=String(doc.anchorMonday||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m||!doc.weeks||typeof doc.weeks!=='object'||Array.isArray(doc.weeks))fail('일정 기준일이 올바르지 않습니다');
    var anchor=new Date(+m[1],+m[2]-1,+m[3]);anchor.setHours(0,0,0,0);if(anchor.getDay()!==1)fail('일정 기준일은 월요일이어야 합니다');
    var out=[],seen={},allMid={};
    Object.keys(doc.weeks).forEach(function(wk){if(!/^-?\d+$/.test(wk))fail('주차 키가 숫자가 아닙니다');var arr=doc.weeks[wk];if(!Array.isArray(arr)||arr.length!==7)fail('모든 주간 일정은 7일이어야 합니다');arr.forEach(function(day,di){
      if(!day||typeof day!=='object'||Array.isArray(day))fail('일정의 하루 형식이 올바르지 않습니다');var anyMid=String(day.mid||'');if(anyMid){if(allMid[anyMid])fail('같은 일정 ID가 두 번 있습니다');allMid[anyMid]=1;}
      if(!matchDay(day))return;var mid=anyMid;if(!mid)fail('연결 경기 ID가 없는 일정이 있습니다');if(seen[mid])fail('같은 경기 ID가 두 번 있습니다');seen[mid]=1;
      var d=new Date(anchor);d.setDate(d.getDate()+(+wk)*7+di);var mt=day.match||{},b=day.board||{};
      out.push({mid:mid,sourceId:'sched:'+mid,date:isoDay(d),opponent:opponent(day),time:String(mt.time||mt.kickoff||b.time||b.kickoff||day.time||'').trim()});
    });});
    out.sort(function(a,b){return a.sourceId.localeCompare(b.sourceId);});return {anchorMonday:doc.anchorMonday,matches:out};
  }
  function scoutDependency(doc){
    var o={attrs:(doc.attrs||[]).map(function(a){return {id:String(a&&a.id||''),cat:String(a&&a.cat||''),name:String(a&&a.name||''),source:String(a&&a.source||'')};}),
      positions:(doc.positions||[]).map(function(p){return {id:String(p&&p.id||''),name:String(p&&p.name||'')};})};
    o.attrs.sort(function(a,b){return a.id.localeCompare(b.id);});o.positions.sort(function(a,b){return a.id.localeCompare(b.id);});return o;
  }
  function localPrefix(prefix){var out=[];try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(prefix)===0)out.push(k);}}catch(_){}return out.sort();}
  function readKeys(keys){var out={};return Promise.all(keys.map(function(k){return getRaw(k).then(function(v){if(v!=null)out[k]=v;});})).then(function(){return out;});}
  function matchIds(raw){var d=parse(raw,'경기');if(!d||!Array.isArray(d.matches))fail('경기 목록 형식이 올바르지 않습니다');unique(d.matches,'id','경기');return d.matches.map(function(m){return String(m&&m.id||'');}).filter(Boolean);}
  function mergeMatchDeletes(currentRaw,fileRaw,oldIds,incomingIds){
    var current=parse(currentRaw||'[]','현재 경기 삭제 기록'),file=parse(fileRaw||'[]','파일 경기 삭제 기록');
    if(!Array.isArray(current)||!Array.isArray(file))fail('경기 삭제 기록 형식이 올바르지 않습니다');
    var incoming={};(incomingIds||[]).forEach(function(id){id=String(id||'');if(id)incoming[id]=1;});
    /* 파일 기록은 과거 시점일 수 있으므로 먼저, 이 기기의 현재 기록과 이번에 빠진
       경기는 뒤에 둔다. 오른쪽부터 중복을 걷어 최대 60개를 남기면 최신 현황이 우선된다. */
    var merged=file.concat(current).concat((oldIds||[]).filter(function(id){return !incoming[String(id||'')];})),seen={},rev=[];
    for(var i=merged.length-1;i>=0&&rev.length<60;i--){var id=String(merged[i]||'');if(!id||incoming[id]||seen[id])continue;seen[id]=1;rev.push(id);}
    return rev.reverse();
  }
  function matchLinksOk(raw,scheduleMatches){
    var d=parse(raw,'경기'),refs=scheduleMatches&&scheduleMatches.matches;
    if(!d||!Array.isArray(d.matches)||!Array.isArray(refs))fail('경기·일정 연결표 형식이 올바르지 않습니다');
    var by={},seen={};refs.forEach(function(r){
      var sid=String(r&&r.sourceId||'');
      if(!sid||by[sid])fail('일정 연결표에 같은 경기 ID가 있습니다');
      by[sid]=r;
    });
    d.matches.forEach(function(m){
      if(!m||typeof m!=='object'||Array.isArray(m))fail('경기 목록 형식이 올바르지 않습니다');
      var sid=String(m.sourceId||'').trim();if(!sid)return;
      if(seen[sid])fail('같은 일정 연결 경기가 두 번 있습니다');seen[sid]=1;
      var r=by[sid];if(!r)fail('현재 일정에 없는 연결 경기가 있습니다');
      var date=String(m.date||''),time=String(m.time||'').trim(),opp=firstText([m.opponent]);
      if(date!==String(r.date||'')||time!==String(r.time||'').trim()||(r.opponent&&opp!==r.opponent))fail('경기 날짜·상대·시간이 일정과 다릅니다');
    });
    return true;
  }
  function capture(section){
    requireDataUnlocked();
    var payload={keys:{}},refs={};
    if(section==='schedule')return readKeys(SCHEDULE_KEYS).then(function(keys){if(!keys.process_coach_v1)fail('저장할 일정이 없습니다');SCHEDULE_KEYS.forEach(function(k){if(!own(keys,k)&&own(EMPTY_RAW,k))keys[k]=EMPTY_RAW[k];});payload.keys=keys;refs.scheduleMatches=scheduleMap(keys.process_coach_v1);return Promise.all([sha(JSON.stringify(refs.scheduleMatches)),collectImages(payload)]).then(function(v){refs.scheduleMatchSha256=v[0];return {payload:payload,refs:refs,images:v[1]};});});
    if(section==='match')return Promise.all([readKeys(MATCH_KEYS),getRaw('process_coach_v1'),getRaw('scout_tool_v1')]).then(function(v){
      payload.keys=v[0];if(!payload.keys.cs_team_matches_v1)fail('저장할 경기 자료가 없습니다');if(!v[1])fail('경기와 연결된 일정을 읽을 수 없습니다');MATCH_KEYS.forEach(function(k){if(!own(payload.keys,k)&&own(EMPTY_RAW,k))payload.keys[k]=EMPTY_RAW[k];});
      var ids=matchIds(payload.keys.cs_team_matches_v1),idset={};ids.forEach(function(id){idset[id]=1;});payload.matchIds=ids;
      var asg=parse(payload.keys.cs_assign_v1,'경기 담당'),cleanAsg={v:1,match:{}};if(!asg||typeof asg!=='object'||Array.isArray(asg)||!asg.match||typeof asg.match!=='object'||Array.isArray(asg.match))fail('경기 담당 형식이 올바르지 않습니다');Object.keys(asg.match).forEach(function(id){if(idset[id]&&typeof asg.match[id]==='string')cleanAsg.match[id]=asg.match[id];});payload.keys.cs_assign_v1=JSON.stringify(cleanAsg);
      var del=parse(payload.keys.cs_match_del_v1,'경기 삭제 기록'),cleanDel=[],delSeen={};if(!Array.isArray(del))fail('경기 삭제 기록 형식이 올바르지 않습니다');del.forEach(function(id){id=String(id||'');if(!id||delSeen[id])return;if(idset[id])fail('현재 경기와 삭제 기록이 서로 충돌합니다');delSeen[id]=1;cleanDel.push(id);});payload.keys.cs_match_del_v1=JSON.stringify(cleanDel.slice(-60));
      payload.matchMessages={};localPrefix('cs_idp_pub_v1_').filter(function(k){return idpUidKey('cs_idp_pub_v1_',k);}).forEach(function(k){var root=parse(localStorage.getItem(k)||'{}','경기 메시지'),src=root.matchMessages||{},pick={};Object.keys(src).forEach(function(id){if(idset[id])pick[id]=src[id];});if(Object.keys(pick).length)payload.matchMessages[k]=pick;});
      var tool=v[2]?scoutDoc(parse(v[2],'선수단'),'선수단'):null,sr=tool&&tool.meta&&tool.meta.staffReady||{};if(!plain(sr))fail('경기 준비 자료 형식이 올바르지 않습니다');payload.staffReady={};Object.keys(sr).forEach(function(id){if(idset[id])payload.staffReady[id]=clone(sr[id]);});
      refs.scheduleMatches=scheduleMap(v[1]);matchLinksOk(payload.keys.cs_team_matches_v1,refs.scheduleMatches);return Promise.all([sha(JSON.stringify(refs.scheduleMatches)),collectImages(payload)]).then(function(x){refs.scheduleMatchSha256=x[0];return {payload:payload,refs:refs,images:x[1]};});
    });
    if(section==='players')return getRaw('scout_tool_v1').then(function(raw){if(!raw)fail('저장할 선수 자료가 없습니다');var d=scoutDoc(parse(raw,'선수'),'선수'),meta=clone(d.meta||{}),positions=clone(d.positions||[]);
      NONPLAYER_META.forEach(function(k){delete meta[k];});positions.forEach(function(p){if(p&&typeof p==='object')delete p.ideal;});
      payload.playersDoc={attrs:clone(d.attrs||[]),positions:positions,players:clone((d.players||[]).filter(function(p){return p&&p.type!=='target';})),meta:meta};
      return Promise.all([sha(JSON.stringify(scoutDependency(payload.playersDoc))),collectImages(payload)]).then(function(v){refs.playerSchemaSha256=v[0];return {payload:payload,refs:refs,images:v[1]};});});
    if(section==='scouting')return Promise.all([getRaw('cs_scout_targets_v1'),getRaw('scout_tool_v1')]).then(function(v){var tool=scoutDoc(parse(v[1]||'','선수단'),'선수단');payload.keys.cs_scout_targets_v1=v[0]||JSON.stringify({v:1,players:[]});payload.scoutMeta={};SCOUT_META.forEach(function(k){if(own(tool.meta||{},k))payload.scoutMeta[k]=clone(tool.meta[k]);});
      return Promise.all([sha(JSON.stringify(scoutDependency(tool))),collectImages(payload)]).then(function(x){refs.playerSchemaSha256=x[0];return {payload:payload,refs:refs,images:x[1]};});});
    if(section==='idp')return Promise.resolve().then(function(){var s=session();if(!s||!UID_RE.test(String(s.uid||'')))fail('로그인한 내 IDP를 확인할 수 없습니다');payload.scope={mode:'self',uid:s.uid};
      var key='cs_idp_v1_'+s.uid;return readKeys([key]).then(function(rows){if(!own(rows,key))fail('저장할 내 IDP 자료가 없습니다');payload.keys=rows;return collectImages(payload).then(function(img){return {payload:payload,refs:refs,images:img};});});});
    if(section==='gamemodel')return Promise.all([getRaw('cs_gamemodel_v1'),getRaw('scout_tool_v1')]).then(function(v){if(!v[0])fail('저장할 게임모델이 없습니다');var tool=scoutDoc(parse(v[1]||'','선수단'),'선수단');payload.keys.cs_gamemodel_v1=v[0];payload.positionIdeals=(tool.positions||[]).map(function(p){return {id:String(p.id||''),name:String(p.name||''),ideal:clone(p.ideal==null?{}:p.ideal)};});return collectImages(payload).then(function(img){return {payload:payload,refs:refs,images:img};});});
    return Promise.reject(new Error('저장할 팀 메뉴를 확인해 주세요'));
  }
  function collectImages(payload){
    var text=JSON.stringify(payload),seen={},m,re=/psimg:(psimg_[A-Za-z0-9_-]+)/g;while((m=re.exec(text)))seen[m[1]]=1;
    var out={};if(!window.storage&&Object.keys(seen).length)return Promise.reject(new Error('사진 저장소를 열 수 없습니다'));
    return Promise.all(Object.keys(seen).sort().map(function(k){return window.storage.get(k).then(function(r){if(!r||!r.value)fail('사진 원본이 빠져 있어 파일 저장을 중단했습니다');out[k]=r.value;});})).then(function(){return out;});
  }
  function makePackage(section){
    requireDataUnlocked();
    var live=workspace();if(!live||live.kind!=='team')return Promise.reject(new Error('팀을 먼저 선택해 주세요'));var w={id:String(live.id||''),name:String(live.name||'팀'),kind:'team'};
    return ready().then(function(){ensureTarget(w.id);if(current()!==section)fail('파일을 저장하는 동안 팀 메뉴가 바뀌었습니다');return capture(section);}).then(function(cap){ensureTarget(w.id);if(current()!==section)fail('파일을 저장하는 동안 팀 메뉴가 바뀌었습니다');var payloadRaw=JSON.stringify(cap.payload),refsRaw=JSON.stringify(cap.refs),images=cap.images||{},imageHashes={};
      return Promise.all([sha(payloadRaw),sha(refsRaw)].concat(Object.keys(images).map(function(k){return sha(images[k]).then(function(h){imageHashes[k]=h;});}))).then(function(h){ensureTarget(w.id);if(current()!==section)fail('파일을 저장하는 동안 팀 메뉴가 바뀌었습니다');return {type:TYPE,schema:SCHEMA,section:section,workspace:{id:w.id,name:w.name||'팀',kind:'team'},exportedAt:new Date().toISOString(),build:String(window.PS_BUILD||''),payload:cap.payload,refs:cap.refs,images:images,hashes:{payload:h[0],refs:h[1],images:imageHashes}};});
    });
  }
  function fileName(w,section){var d=new Date(),p=function(n){return String(n).padStart(2,'0');},name=String(w.name||'팀').replace(/[\\/:*?"<>|\s]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'팀';return name+'-'+LABEL[section]+'-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.psstudio.json';}
  function saveFile(pkg){
    requireDataUnlocked();
    var json=JSON.stringify(pkg),name=fileName(pkg.workspace,pkg.section),touch=/iPad|iPhone|iPod|Android/.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.userAgent));
    if(touch&&navigator.share&&window.File){try{var f=new File([json],name,{type:'application/json'});if(!navigator.canShare||navigator.canShare({files:[f]}))return navigator.share({files:[f],title:'PROCESS STUDIO '+LABEL[pkg.section]});}catch(_){}}
    var blob=new Blob([json],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},2000);return Promise.resolve(true);
  }
  function exportCurrent(){requireDataUnlocked();var section=current();if(!section)return Promise.reject(new Error('팀 메뉴(일정·경기·선수·스카우팅·IDP·게임모델)를 먼저 열어 주세요'));return makePackage(section).then(function(pkg){return Promise.resolve(saveFile(pkg)).then(function(){try{localStorage.setItem('cs_lastbk',String(Date.now()));}catch(_){}return pkg;});});}

  function allowedRawKeys(section,k){
    if(section==='schedule')return SCHEDULE_KEYS.indexOf(k)>=0;
    if(section==='match')return MATCH_KEYS.indexOf(k)>=0;
    if(section==='scouting')return k==='cs_scout_targets_v1';
    if(section==='idp')return k==='cs_idp_daily_v1'||idpUidKey('cs_idp_v1_',k)||idpUidKey('cs_idp_pub_v1_',k);
    if(section==='gamemodel')return k==='cs_gamemodel_v1';
    return false;
  }
  function validateSection(pkg){
    var s=pkg.section,p=pkg.payload,r=pkg.refs||{},keys=p.keys||{};Object.keys(keys).forEach(function(k){if(!allowedRawKeys(s,k))fail('이 '+LABEL[s]+' 파일에 들어갈 수 없는 항목이 있습니다: '+k);if(typeof keys[k]!=='string'||keys[k].length>MAX_RAW)fail(k+' 자료 크기가 올바르지 않습니다');});
    if(s==='schedule'){exactKeys(p,['keys'],'일정');exactKeys(keys,SCHEDULE_KEYS,'일정 원문');SCHEDULE_KEYS.forEach(function(k){if(!own(keys,k))fail('일정 파일에 필요한 원문이 빠졌습니다: '+k);});var sm=scheduleMap(keys.process_coach_v1);if(JSON.stringify(sm)!==JSON.stringify(r.scheduleMatches||null))fail('일정의 경기 연결표가 파일과 다릅니다');}
    if(s==='match'){exactKeys(p,['keys','matchIds','matchMessages','staffReady'],'경기');if(!own(p,'staffReady')||!p.staffReady||typeof p.staffReady!=='object'||Array.isArray(p.staffReady))fail('경기 파일에 스태프 준비 자료가 빠졌습니다');exactKeys(keys,MATCH_KEYS,'경기 원문');MATCH_KEYS.forEach(function(k){if(!own(keys,k))fail('경기 파일에 필요한 원문이 빠졌니다: '+k);});var asg=parse(keys.cs_assign_v1,'경기 담당'),del=parse(keys.cs_match_del_v1,'경기 삭제 기록');if(!asg||typeof asg!=='object'||Array.isArray(asg)||!asg.match||typeof asg.match!=='object'||Array.isArray(asg.match)||!Array.isArray(del))fail('경기 담당·삭제 기록 형식이 올바르지 않습니다');exactKeys(asg,['v','match'],'경기 담당');if(+asg.v!==1)fail('경기 담당 판이 올바르지 않습니다');matchLinksOk(keys.cs_team_matches_v1,r.scheduleMatches);var ids=matchIds(keys.cs_team_matches_v1);if(ids.length>MAX_MATCH_IDS)fail('경기 파일은 '+MAX_MATCH_IDS+'개를 넘을 수 없습니다');if(JSON.stringify(ids)!==JSON.stringify(p.matchIds||[]))fail('경기 ID 검증표가 다릅니다');var set={},ds={};ids.forEach(function(id){set[id]=1;});Object.keys(asg.match).forEach(function(id){if(!set[id]||typeof asg.match[id]!=='string')fail('경기 담당의 경기 ID가 다릅니다');});del.forEach(function(id){if(typeof id!=='string'||!id||ds[id]||set[id])fail('경기 삭제 기록이 현재 경기와 충돌합니다');ds[id]=1;});Object.keys(p.staffReady).forEach(function(id){if(!set[id])fail('스태프 준비 표시의 경기 ID가 다릅니다');});Object.keys(p.matchMessages||{}).forEach(function(k){if(!idpUidKey('cs_idp_pub_v1_',k))fail('경기 메시지 키가 올바르지 않습니다');Object.keys(p.matchMessages[k]||{}).forEach(function(id){if(!set[id])fail('경기 메시지 ID가 다릅니다');});});}
    if(s==='players'){exactKeys(p,['keys','playersDoc'],'선수');if(Object.keys(keys).length)fail('선수 파일에 알 수 없는 원문이 있습니다');var d=p.playersDoc;if(!d||!Array.isArray(d.attrs)||!Array.isArray(d.positions)||!Array.isArray(d.players)||!d.meta||typeof d.meta!=='object'||Array.isArray(d.meta))fail('선수 파일 형식이 올바르지 않습니다');exactKeys(d,['attrs','positions','players','meta'],'선수 본문');if(d.players.some(function(x){return x&&x.type==='target';}))fail('선수 파일에 스카우팅 후보가 섞여 있습니다');if(d.positions.some(function(x){return x&&own(x,'ideal');}))fail('선수 파일에 게임모델 포지션 기준이 섞여 있습니다');NONPLAYER_META.forEach(function(k){if(own(d.meta,k))fail('선수 파일에 다른 팀 메뉴 설정이 섞여 있습니다');});unique(d.players,'id','선수');unique(d.attrs,'id','평가항목');unique(d.positions,'id','포지션');}
    if(s==='scouting'){exactKeys(p,['keys','scoutMeta'],'스카우팅');var td=parse(keys.cs_scout_targets_v1||'','스카우팅');if(!Array.isArray(td.players))fail('스카우팅 후보 목록이 없습니다');if(td.players.some(function(x){return !x||x.type!=='target';}))fail('스카우팅 후보 형식이 올바르지 않습니다');unique(td.players,'id','스카우팅 후보');Object.keys(p.scoutMeta||{}).forEach(function(k){if(SCOUT_META.indexOf(k)<0)fail('스카우팅 설정 항목이 올바르지 않습니다');});}
    if(s==='idp'){exactKeys(p,['keys','scope'],'IDP');if(!p.scope||typeof p.scope!=='object'||Array.isArray(p.scope))fail('IDP 범위가 올바르지 않습니다');exactKeys(p.scope,['mode','uid'],'IDP 범위');if(p.scope.mode!=='self'||!UID_RE.test(String(p.scope.uid||'')))fail('내 IDP 범위가 올바르지 않습니다');var ss=session();if(!ss||p.scope.uid!==ss.uid)fail('다른 사용자의 IDP 파일은 가져올 수 없습니다');var only='cs_idp_v1_'+p.scope.uid;exactKeys(keys,[only],'내 IDP 원문');if(!own(keys,only))fail('내 IDP 본문이 없습니다');parse(keys[only],only);}
    if(s==='gamemodel'){exactKeys(p,['keys','positionIdeals'],'게임모델');if(!keys.cs_gamemodel_v1)fail('게임모델 본문이 없습니다');parse(keys.cs_gamemodel_v1,'게임모델');if(!Array.isArray(p.positionIdeals))fail('포지션 기준이 없습니다');if(p.positionIdeals.length>MAX_POSITION_TARGETS)fail('게임모델 포지션은 '+MAX_POSITION_TARGETS+'개를 넘을 수 없습니다');p.positionIdeals.forEach(function(x){exactKeys(x,['id','name','ideal'],'게임모델 포지션');});unique(p.positionIdeals,'id','포지션 기준');}
    return true;
  }
  function validate(pkg){
    requireDataUnlocked();
    if(JSON.stringify(pkg).length>MAX_FILE)fail('파일이 너무 큽니다');noDanger(pkg,0);
    exactKeys(pkg,['type','schema','section','workspace','exportedAt','build','payload','refs','images','hashes'],'파일');
    if(pkg.type!==TYPE||pkg.schema!==SCHEMA||!LABEL[pkg.section])fail('PROCESS STUDIO 팀 메뉴 파일이 아닙니다');
    if(current()!==pkg.section)fail(LABEL[pkg.section]+' 메뉴를 먼저 열고 파일을 가져와 주세요');
    var w=workspace();if(!w||w.kind!=='team')fail('팀을 먼저 선택해 주세요');if(!pkg.workspace||typeof pkg.workspace!=='object'||Array.isArray(pkg.workspace))fail('팀 파일 형식이 올바르지 않습니다');exactKeys(pkg.workspace,['id','name','kind'],'팀');if(pkg.workspace.kind!=='team'||pkg.workspace.id!==w.id)fail('현재 선택한 팀과 다른 팀의 파일입니다');
    if(!canImport(pkg.section,pkg))fail(LABEL[pkg.section]+' 파일을 가져올 편집 권한이 없습니다');
    var payloadRaw=JSON.stringify(pkg.payload),refsRaw=JSON.stringify(pkg.refs||{}),images=pkg.images||{},hashes=pkg.hashes||{},ih=hashes.images||{};
    var checks=[sha(payloadRaw),sha(refsRaw)].concat(Object.keys(images).map(function(k){if(!/^psimg_[A-Za-z0-9_-]+$/.test(k)||typeof images[k]!=='string'||images[k].indexOf('data:image')!==0)fail('사진 형식이 올바르지 않습니다');return sha(images[k]).then(function(h){if(h!==ih[k])fail('사진 해시가 다릅니다');});}));
    if(pkg.section==='schedule'||pkg.section==='match')checks.push(sha(JSON.stringify((pkg.refs||{}).scheduleMatches||null)).then(function(h){if(h!==pkg.refs.scheduleMatchSha256)fail('일정·경기 연결표 해시가 다릅니다');}));
    return Promise.all(checks).then(function(h){if(h[0]!==hashes.payload||h[1]!==hashes.refs)fail('파일이 변경되었거나 손상됐습니다');if(Object.keys(ih).some(function(k){return !own(images,k);}))fail('사진 검증표가 다릅니다');validateSection(pkg);return pkg;});
  }

  function touchedKeys(pkg){var s=pkg.section,p=pkg.payload,keys=[];
    if(s==='schedule')keys=SCHEDULE_KEYS.slice();
    else if(s==='match')keys=MATCH_KEYS.concat(['scout_tool_v1']).concat(localPrefix('cs_idp_pub_v1_').filter(function(k){return idpUidKey('cs_idp_pub_v1_',k);})).concat(Object.keys(p.matchMessages||{}));
    else if(s==='players')keys=['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1'];
    else if(s==='scouting')keys=['cs_scout_targets_v1','scout_tool_v1'];
    else if(s==='idp')keys=Object.keys(p.keys||{});
    else if(s==='gamemodel')keys=['cs_gamemodel_v1','scout_tool_v1'];
    return Array.from(new Set(keys));
  }
  function snapshot(pkg){var keys=touchedKeys(pkg),raw={};return Promise.all(keys.map(function(k){return getRaw(k).then(function(v){raw[k]=v;});})).then(function(){var w=workspace(),key='ps_section_preimport_'+w.id+'_'+pkg.section,body=JSON.stringify({type:'process-studio-section-preimport',schema:1,at:Date.now(),workspaceId:w.id,section:pkg.section,raw:raw});if(!window.storage)fail('가져오기 전 안전 백업을 저장할 수 없습니다');return window.storage.set(key,body).then(function(){return window.storage.get(key);}).then(function(r){if(!r||r.value!==body)fail('가져오기 전 안전 백업을 확인하지 못했습니다');return {key:key,raw:raw};});});}
  function restoreSnapshot(snap,progress){
    var conflicts=[];
    return Object.keys(progress||{}).reduce(function(ch,k){return ch.then(function(){
      return getRaw(k).then(function(current){
        var step=progress[k]||{},applied=step.applied,before=step.before;
        /* 가져온 값을 쓴 뒤 다른 탭이 다시 고쳤다면 그 최신 편집을 덮지 않는다. */
        if(current!==applied&&current!==before){conflicts.push(k);return;}
        if(before==null){
          try{localStorage.removeItem(k);}catch(e){return Promise.reject(e);}
          var clearing=Promise.resolve();
          if(IDB_MIRROR[k]&&window.storage){if(!window.storage.del)fail(k+' 원래 빈 상태를 복구할 수 없습니다');clearing=Promise.resolve(window.storage.del(k));}
          return clearing.then(function(){return getRaw(k);}).then(function(v){if(v!=null)fail(k+' 원래 빈 상태의 복구를 다시 읽어 확인하지 못했습니다');});
        }
        return setRaw(k,before);
      });
    });},Promise.resolve()).then(function(){
      if(conflicts.length){var e=new Error('가져오기 중 다른 창에서 바뀐 자료를 보존했습니다: '+conflicts.join(', '));e.name='PSTeamFileRollbackConflict';e.psRollbackConflict=true;throw e;}
      return true;
    });
  }
  function installImages(pkg,added){added=added||[];if(Object.keys(pkg.images||{}).length&&!window.storage)return Promise.reject(new Error('사진 저장소를 열 수 없습니다'));return Object.keys(pkg.images||{}).reduce(function(ch,k){return ch.then(function(){return window.storage.get(k).then(function(r){if(r&&r.value!=null){if(r.value!==pkg.images[k])fail('기기의 다른 사진과 ID가 겹쳐 가져오기를 중단했습니다');return;}return window.storage.set(k,pkg.images[k]).then(function(){added.push(k);});});});},Promise.resolve()).then(function(){return added;});}
  function normName(v){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ko');}
  function posAbbr(name){var K=String(name||'').trim().toUpperCase();if(/^(GK|LB|LCB|RCB|RB|DM|CM|AM|LW|RW|CF|LWB|RWB|LM|RM)$/.test(K))return K;var s=String(name||'').toLowerCase(),L=/좌|왼|left|\blb\b|\blw\b/.test(s),R=/우|오른|right|\brb\b|\brw\b/.test(s);if(/gk|골키퍼|키퍼|골리/.test(s))return'GK';if(/cb|센터백|중앙\s*수비|스토퍼|중앙백/.test(s))return L?'LCB':(R?'RCB':'CB');if(/풀백|윙백|fb|wb|측면\s*수비/.test(s))return L?'LB':(R?'RB':'FB');if(/수비형|dm|홀딩|앵커|6번/.test(s))return'DM';if(/공격형|am|10번|플레이메이커/.test(s))return'AM';if(/윙|wing|wg/.test(s))return L?'LW':(R?'RW':'W');if(/스트라이커|공격수|fw|\bst\b|\bcf\b|9번/.test(s))return'ST';if(/중앙|미드|미들|cm|mf|8번/.test(s))return'CM';return String(name||'').replace(/\s+/g,'').slice(0,3).toUpperCase();}
  function evalSetId(doc){if(doc.meta&&doc.meta.evalMode==='fifa')return'process-fifa-v1';var sig=0,ids=(doc.attrs||[]).map(function(a){return a.id+'='+a.name;}).sort().join('|');for(var i=0;i<ids.length;i++)sig=((sig*31)+ids.charCodeAt(i))>>>0;return'team:'+sig.toString(36);}
  function rebuildMirrors(doc,put){var attrs={attrs:(doc.attrs||[]).map(function(a){return {id:a.id,cat:a.cat,name:a.name,source:a.source||''};}),cats:((doc.meta&&doc.meta.cats)||[]).map(function(c){return {id:c.id,name:c.name};}),evalMode:(doc.meta&&doc.meta.evalMode)==='fifa'?'fifa':'team',setId:evalSetId(doc)},ours=(doc.players||[]).filter(function(p){return p&&p.type!=='target'&&String(p.name||'').trim();}),by={};(doc.positions||[]).forEach(function(p){by[p.id]=p;});var squad={name:(doc.meta&&doc.meta.teamName)||'',players:ours.map(function(p){return {id:p.id,num:p.num||'',name:p.name||'',pos:posAbbr(by[p.posId]&&by[p.posId].name||''),foot:p.foot||'',bench:p.bench===true,status:p.status||'ok',grp:String(p.grp||'').trim()};})};return put('cs_team_attrs_v1',JSON.stringify(attrs)).then(function(){return put('cs_squad_v1',JSON.stringify(squad));});}
  function applyPackage(pkg,targetId,progress,baseline){
    requireDataUnlocked();
    var p=pkg.payload,s=pkg.section,written={},replaceMatchIds=[];
    progress=progress||{};
    function put(k,v){requireDataUnlocked();ensureTarget(targetId);return getRaw(k).then(function(before){requireDataUnlocked();ensureTarget(targetId);if(!own(progress,k))progress[k]={before:before,applied:v};else progress[k].applied=v;return setRaw(k,v);}).then(function(){ensureTarget(targetId);written[k]=v;});}
    if(s==='schedule')return SCHEDULE_KEYS.reduce(function(ch,k){return ch.then(function(){return put(k,p.keys[k]);});},Promise.resolve()).then(function(){return written;});
    if(s==='match')return Promise.all([getRaw('process_coach_v1'),getRaw('cs_team_matches_v1'),getRaw('cs_match_del_v1')]).then(function(v){
      if(!v[0])fail('경기와 맞는 일정이 없습니다');
      if(baseline&&own(baseline,'matchRaw')&&v[1]!==baseline.matchRaw)fail('가져오기 준비 중 경기 자료가 다른 창에서 바뀌었습니다. 파일을 다시 선택해 주세요');
      var sm=scheduleMap(v[0]),seen={};
      var oldIds=v[1]?matchIds(v[1]):[];oldIds.concat(p.matchIds).forEach(function(id){if(!seen[id]){seen[id]=1;replaceMatchIds.push(id);}});
      var safeDel=mergeMatchDeletes(v[2]||'[]',p.keys.cs_match_del_v1,oldIds,p.matchIds);
      return sha(JSON.stringify(sm)).then(function(h){
        if(h!==pkg.refs.scheduleMatchSha256)fail('이 경기 파일과 맞는 일정 파일을 먼저 가져오세요');
        matchLinksOk(p.keys.cs_team_matches_v1,sm);
        return MATCH_KEYS.reduce(function(ch,k){return ch.then(function(){return put(k,k==='cs_match_del_v1'?JSON.stringify(safeDel):p.keys[k]);});},Promise.resolve());
      });
    }).then(function(){
      var docs=Array.from(new Set(localPrefix('cs_idp_pub_v1_').filter(function(k){return idpUidKey('cs_idp_pub_v1_',k);}).concat(Object.keys(p.matchMessages||{}))));
      return docs.reduce(function(ch,k){return ch.then(function(){return getRaw(k).then(function(raw){
        var root=parse(raw||'{}','경기 메시지');if(!plain(root)||(own(root,'matchMessages')&&!plain(root.matchMessages)))fail('경기 메시지 형식이 올바르지 않습니다');var mm=root.matchMessages||{};
        replaceMatchIds.forEach(function(id){delete mm[id];});
        Object.keys((p.matchMessages||{})[k]||{}).forEach(function(id){mm[id]=p.matchMessages[k][id];});
        root.matchMessages=mm;return put(k,JSON.stringify(root));
      });});},Promise.resolve());
    }).then(function(){return getRaw('scout_tool_v1');}).then(function(raw){var tool=raw?scoutDoc(parse(raw,'현재 선수단'),'현재 선수단'):{attrs:[],positions:[],players:[],meta:{}};var sr=tool.meta.staffReady;if(sr!=null&&!plain(sr))fail('현재 경기 준비 자료 형식이 올바르지 않습니다');sr=sr||{};replaceMatchIds.forEach(function(id){delete sr[id];});Object.keys(p.staffReady||{}).forEach(function(id){sr[id]=clone(p.staffReady[id]);});tool.meta.staffReady=sr;return put('scout_tool_v1',JSON.stringify(tool));}).then(function(){return written;});
    if(s==='players')return getRaw('scout_tool_v1').then(function(raw){var cur=raw?scoutDoc(parse(raw,'현재 선수단'),'현재 선수단'):{attrs:[],players:[],meta:{},positions:[]},d=clone(p.playersDoc),targets=(cur.players||[]).filter(function(x){return x&&x.type==='target';}),otherMeta={};NONPLAYER_META.forEach(function(k){if(own(cur.meta||{},k))otherMeta[k]=cur.meta[k];});d.meta=d.meta||{};NONPLAYER_META.forEach(function(k){if(own(otherMeta,k))d.meta[k]=otherMeta[k];else delete d.meta[k];});var ideals={},idealNames={};(cur.positions||[]).forEach(function(x){if(!x||x.ideal==null)return;ideals[String(x.id||'')]=x.ideal;(idealNames[normName(x.name)]||(idealNames[normName(x.name)]=[])).push(x.ideal);});(d.positions||[]).forEach(function(x){var id=String(x.id||''),a=idealNames[normName(x.name)]||[];if(own(ideals,id))x.ideal=ideals[id];else if(a.length===1)x.ideal=a[0];});d.players=(d.players||[]).concat(targets);d._items={build:String(window.PS_BUILD||''),n:(p.playersDoc.players||[]).filter(function(x){return x&&String(x.name||'').trim();}).length};var out=JSON.stringify(d);return put('scout_tool_v1',out).then(function(){return rebuildMirrors(d,put);});}).then(function(){return written;});
    if(s==='scouting')return getRaw('scout_tool_v1').then(function(raw){var tool=scoutDoc(parse(raw||'','현재 선수단'),'현재 선수단');return sha(JSON.stringify(scoutDependency(tool))).then(function(h){if(h!==pkg.refs.playerSchemaSha256)fail('스카우팅 기준이 다릅니다. 같은 묶음의 선수 파일을 먼저 가져오세요');SCOUT_META.forEach(function(k){if(own(p.scoutMeta,k))tool.meta[k]=p.scoutMeta[k];else delete tool.meta[k];});var tr=JSON.stringify(tool);return put('scout_tool_v1',tr).then(function(){return put('cs_scout_targets_v1',p.keys.cs_scout_targets_v1);});});}).then(function(){return written;});
    if(s==='idp')return Object.keys(p.keys).reduce(function(ch,k){return ch.then(function(){if(k.indexOf('cs_idp_pub_v1_')===0){var cur=parse(localStorage.getItem(k)||'{}',k),inc=parse(p.keys[k],k),mm=cur.matchMessages;inc.matchMessages=mm;return put(k,JSON.stringify(inc));}return put(k,p.keys[k]);});},Promise.resolve()).then(function(){return written;});
    if(s==='gamemodel')return put('cs_gamemodel_v1',p.keys.cs_gamemodel_v1).then(function(){return getRaw('scout_tool_v1');}).then(function(raw){var tool=scoutDoc(parse(raw||'','현재 선수단'),'현재 선수단'),list=p.positionIdeals||[],by={},names={},used={},matched=0;list.forEach(function(x){by[String(x.id||'')]=x;(names[normName(x.name)]||(names[normName(x.name)]=[])).push(x);});(tool.positions||[]).forEach(function(pos){var x=by[String(pos.id||'')],a=names[normName(pos.name)]||[];if(!x&&a.length===1)x=a[0];if(x&&!used[String(x.id||'')]){used[String(x.id||'')]=1;matched++;pos.ideal=clone(x.ideal);}});if(matched!==list.length)fail('포지션 기준이 다릅니다. 같은 묶음의 선수 파일을 먼저 가져오세요');var out=JSON.stringify(tool);return put('scout_tool_v1',out);}).then(function(){return written;});
    return Promise.reject(new Error('알 수 없는 팀 메뉴입니다'));
  }
  function importSpecFor(pkg,snap){var spec={section:pkg.section};
    if(pkg.section==='match'){
      var incoming=((pkg.payload&&pkg.payload.matchIds)||[]).map(String),ids=incoming.slice(),raw=snap&&snap.raw&&snap.raw.cs_team_matches_v1,oldIds=raw?matchIds(raw):[];
      ids=ids.concat(oldIds);spec.matchIds=Array.from(new Set(ids));if(spec.matchIds.length>MAX_MATCH_IDS)fail('교체할 경기 범위가 '+MAX_MATCH_IDS+'개를 넘습니다');
      spec.incomingMatchIds=Array.from(new Set(incoming));
      var incomingSet={};spec.incomingMatchIds.forEach(function(id){incomingSet[id]=1;});spec.removedMatchIds=oldIds.filter(function(id){return !incomingSet[id];});
      if(spec.removedMatchIds.length>60)fail('한 번에 교체할 기존 경기는 60개를 넘을 수 없습니다');
      spec.fileTombstoneIds=parse(pkg.payload.keys.cs_match_del_v1,'파일 경기 삭제 기록').map(String);
    }
    if(pkg.section==='gamemodel')spec.positionTargets=(pkg.payload.positionIdeals||[]).map(function(x){return {id:String(x&&x.id||''),name:String(x&&x.name||'')};});
    return spec;
  }
  function approveWritten(written,spec){var api=window.PSSync;if(!api||!api.approveImport)return Promise.reject(new Error('파일 가져오기 안전장치를 열 수 없습니다'));return Object.keys(written).reduce(function(ch,k){return ch.then(function(){return api.approveImport(k,written[k],spec).then(function(ok){if(!ok)fail(k+' 자료가 확인 중 바뀌어 가져오기를 중단했습니다');});});},Promise.resolve());}
  function syncState(r){
    r=r||{};var code=String(r.code||''),transient=r.offline||r.skip||r.scheduleDeferred||r.noauth||r.nows||r.error||(+r.pending>0)||(+r.itemPending>0)||(Array.isArray(r.skipped)&&r.skipped.length)||(+r.skipped>0)||code==='sync_offline'||code==='sync_network'||code==='sync_timeout'||code==='sync_server'||code==='sync_rate_limit';
    return {localOnly:!!transient,syncResult:r};
  }
  function confirmApply(pkg){return new Promise(function(resolve){var msg='\''+(pkg.workspace.name||'팀')+'\' '+LABEL[pkg.section]+' 자료만 가져옵니다.\n\n· 다른 팀 메뉴는 바꾸지 않음\n· 현재 '+LABEL[pkg.section]+'은 자동 보관\n· 파일의 '+LABEL[pkg.section]+'으로 정확히 교체\n\n계속할까요?';if(window.psConfirm)psConfirm(msg,function(){resolve(true);},function(){resolve(false);});else resolve(window.confirm(msg));});}
  function importPackage(pkg){
    requireDataUnlocked();
    var target=workspace(),targetId=target&&target.id,snap=null,added=[],writtenKeys=[],writtenMap={},progress={},sectionSpec=null,syncLocked=false,preflight={};
    function clearApprovals(){var api=window.PSSync;if(!api||!api.clearImport)return;writtenKeys.forEach(function(k){try{api.clearImport(k);}catch(_){}});}
    function cleanupImages(){if(!added.length||!window.storage)return Promise.resolve();return Promise.all(added.map(function(k){return Promise.resolve().then(function(){return window.storage.del(k);}).catch(function(){});}));}
    function out(syncResult,localOnly){return {ok:true,label:LABEL[pkg.section],snapshot:snap&&snap.key,localOnly:!!localOnly,serverPending:!!localOnly,preflight:preflight,syncResult:syncResult||{}};}
    function localMismatch(v){return {ok:false,label:LABEL[pkg.section],snapshot:snap&&snap.key,localOnly:true,serverPending:true,localMismatch:true,verify:v||{},preflight:preflight};}
    function release(){var api=window.PSSync;if(syncLocked&&api&&api.endImport){try{api.endImport(targetId);}catch(_){}}syncLocked=false;IMPORTING=false;IMPORT_TARGET='';}
    var work=validate(pkg).then(function(){return confirmApply(pkg);}).then(function(ok){
      if(!ok)return {cancelled:true};
      IMPORTING=true;IMPORT_TARGET=targetId;ensureTarget(targetId);
      if(!window.PSSync||!PSSync.beginImport||!PSSync.endImport||!PSSync.syncNow)fail('팀 파일 동기화 잠금을 열 수 없습니다');
      return Promise.resolve(PSSync.beginImport(targetId)).then(function(locked){if(!locked)fail('다른 저장이 진행 중이어서 파일 가져오기를 시작하지 못했습니다');syncLocked=true;ensureTarget(targetId);return Promise.resolve(PSSync.syncNow('team-section-preflight')).catch(function(e){return {error:String(e&&e.message||e),code:'sync_unexpected'};});}).then(function(r){preflight=r||{};ensureTarget(targetId);if(pkg.section==='match'&&syncState(preflight).localOnly)fail('경기 파일은 기존 경기 메모를 정확히 정리해야 하므로 온라인 팀 확인이 필요합니다. 인터넷에 연결한 뒤 다시 가져오세요');return ready();}).then(function(){ensureTarget(targetId);return snapshot(pkg);}).then(function(s){snap=s;sectionSpec=importSpecFor(pkg,snap);ensureTarget(targetId);return installImages(pkg,added);}).then(function(){ensureTarget(targetId);return applyPackage(pkg,targetId,progress,{matchRaw:snap&&snap.raw&&snap.raw.cs_team_matches_v1});}).then(function(written){
        writtenMap=written;writtenKeys=Object.keys(written);ensureTarget(targetId);
        return approveWritten(written,sectionSpec).then(function(){ensureTarget(targetId);return Promise.resolve(PSSync.syncNow('team-section-import')).catch(function(e){return {error:String(e&&e.message||e),code:'sync_unexpected'};});});
      }).then(function(syncResult){
        ensureTarget(targetId);
        if(!PSSync.verifyImport)return out({error:'server verification unavailable'},true);
        return PSSync.verifyImport(writtenMap,targetId,sectionSpec||importSpecFor(pkg,snap)).then(function(v){
          var ok=v===true||!!(v&&v.ok),localOk=v===true||!!(v&&v.localOk);if(!localOk){clearApprovals();return localMismatch(v);}
          if(!ok)return out({error:'server verification pending',verify:v,prior:syncResult},true);
          clearApprovals();return out(syncResult,false);
        },function(){return out({error:'server verification pending',prior:syncResult},true);});
      });
    }).catch(function(original){
      if(!snap)throw original;
      if(original&&original.psWorkspaceChanged)throw original;
      clearApprovals();
      return restoreSnapshot(snap,progress).then(function(){return cleanupImages().then(function(){throw original;});},function(restoreError){
        return cleanupImages().then(function(){
          var fatal=new Error('파일 가져오기를 중단했지만 원래 자료의 자동 복구도 확인하지 못했습니다');
          fatal.name='PSTeamFileRestoreError';fatal.psRestoreFailed=true;fatal.originalError=String(original&&original.message||original||'가져오기 실패');fatal.restoreError=String(restoreError&&restoreError.message||restoreError||'복구 실패');throw fatal;
        });
      });
    });
    return work.then(function(v){release();return v;},function(e){release();throw e;});
  }
  function updateUI(){var section=current(),lab=document.getElementById('bkLabel'),down=document.getElementById('bkDown'),up=document.getElementById('bkUp');if(section&&workspace()&&workspace().kind==='team'){if(lab)lab.textContent=LABEL[section]+' 파일';if(down)down.title=LABEL[section]+' 파일 저장';if(up)up.title='팀 메뉴 파일 가져오기';}else if(lab)lab.textContent='전체 백업';}
  try{var gear=document.getElementById('gearBtn');if(gear)gear.addEventListener('click',function(){setTimeout(updateUI,0);});}catch(_){}
  window.PSTeamFiles={active:active,current:current,importing:function(){return IMPORTING;},importTarget:function(){return IMPORT_TARGET;},isPackage:function(p){return !!(p&&p.type===TYPE);},exportCurrent:exportCurrent,importPackage:importPackage,validate:validate,updateUI:updateUI,_test:{scheduleMap:scheduleMap,scoutDependency:scoutDependency,matchLinksOk:matchLinksOk,validateSection:validateSection,syncState:syncState}};
})();
