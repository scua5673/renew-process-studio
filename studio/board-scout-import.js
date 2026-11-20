/* Read the current team's roster and scouting candidates; copy only board labels through the existing team-load path.
   3.312 — one «명단 불러오기» window (사용자 11/17 «전체 · 조별 · 부상 제외 · 스카우팅만 … 선택해서 다양하게» → 목업 A «창 하나»):
   condition chips (출처 · 조 · 영입 단계 · 상태 · 포지션 · 학년) decide the default checks and single checks are the exceptions.
   The training card's two rows become one «불러오기» row: quick chips (전체 · 조 · 스카우팅 → 팀 1 at once, with the remembered
   상태 rule) + «고르기…» (this window). 상태 is the day's availability (session.date · PSParticipation — the 가용인원 rules);
   the chosen conditions are remembered on this device (ps_roster_pick_v1). Nothing new is saved into any document. */
(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSBoardScoutImport=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var TEAM='scout_tool_v1',TOMBS='cs_player_del_v1',MEM='ps_roster_pick_v1';
  var STAGES={rep:'추천',go:'영입대상',done:'확정',mixed:'배치별 상이'};
  var STATES={ok:'가능',injury:'부상',rehab:'재활',out:'불참',rest:'휴식'};   // PL_STATUS keys (scout.html) — the availability table's words
  var FIXED=['A팀','B팀','C팀'],YMD=/^\d{4}-\d{2}-\d{2}$/;
  function stage(v){return v==='signed'?'done':v==='done'||v==='go'?v:'rep';}
  function rows(doc,team,tombs,store,code){
    var registry=doc.scoutRegistry.candidates,positions=team&&team.positions||[],abbr=team&&team.meta&&team.meta.posAbbr||{};
    return Object.keys(registry).filter(function(id){var c=registry[id],all=doc.players.filter(function(p){return store.idOf(p)===id;});
      return !c.archivedAt&&(!all.length||all.some(function(p){return !p._scoutHidden&&(!tombs[p.id]||p._scoutMove&&p._scoutMove.at>tombs[p.id]);}));
    }).map(function(id){
      var c=registry[id],info=c.info||{},placements=doc.players.filter(function(p){return store.idOf(p)===id&&!p._scoutHidden&&(!tombs[p.id]||p._scoutMove&&p._scoutMove.at>tombs[p.id]);});
      var pos=placements.map(function(p){var def=positions.find(function(x){return x.id===p.posId;});return abbr[p.posId]||code(def&&def.name||p.posName||'')||def&&def.name||p.posName||'';}).filter(Boolean);
      if(!pos.length)pos=(c.source&&Array.isArray(c.source.pos)?c.source.pos:[]).map(function(p){return code(p)||String(p);});
      pos=Array.from(new Set(pos));var stages=placements.map(function(p){return stage(p.scoutSt);}),status=stages[0]||'rep';if(stages.some(function(s){return s!==status;}))status='mixed';
      return {id:id,name:String(info.name||'').trim(),no:info.num==null?'':String(info.num),pos:pos[0]||'',positions:pos,club:String(info.club||''),status:status};
    });
  }
  function filter(list,q,status,pos){var words=String(q||'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return list.filter(function(p){return (!status||p.status===status)&&(!pos||p.positions.indexOf(pos)>=0)&&words.every(function(w){return [p.name,p.no,p.club,p.positions.join(' ')].join(' ').toLocaleLowerCase().indexOf(w)>=0;});});
  }
  function teamRows(team,tombs,code){
    var positions=team.positions||[],meta=team.meta||{},abbr=meta.posAbbr||{},labels=meta.grpLabels||{};
    return (team.players||[]).filter(function(p){return p&&p.type!=='target'&&!p.grad&&!tombs[p.id]&&String(p.name||'').trim();}).map(function(p){
      var def=positions.find(function(x){return x.id===p.posId;}),pos=abbr[p.posId]||code(def&&def.name||p.posName||p.pos||''),grp=String(p.grp||'').trim();
      return {id:p.id,name:String(p.name).trim(),no:p.num==null?'':String(p.num),pos:pos,positions:pos?[pos]:[],club:labels[grp]||grp||'조 없음',status:grp,availability:p.status||'ok',until:p.statusUntil?String(p.statusUntil):'',year:p.schoolYear==null||p.schoolYear===''?'':String(p.schoolYear)};
    });
  }
  function trainingCounts(list){var c={gk:0,field:0,rehab:0,out:0};list.forEach(function(p){var s=String(p.availability||'ok').toLowerCase();if(s==='rehab')c.rehab++;else if(!['ok','normal','available'].includes(s))c.out++;else if(/GK|GOALKEEPER|골키퍼|키퍼/.test(String(p.pos).toUpperCase()))c.gk++;else c.field++;});return c;}
  function isGK(pos){return /GK|GOALKEEPER|골키퍼|키퍼/.test(String(pos||'').toUpperCase());}
  /* 지금 상태 — scout.html plStatusOf 와 같은 규칙: 모르는 값은 가능, «오늘만»(휴식 · 불참)은 statusUntil 이 지나면 가능 */
  function current(p,today){var s=String(p.availability||'ok');if(!STATES[s])s='ok';if((s==='rest'||s==='out')&&p.until&&today&&p.until<today)s='ok';return s;}
  /* 그날의 상태 — 가용인원과 같은 모델(PSParticipation.resolve): 오늘은 지금 상태가 우선, 지난날은 그날 기록 · 상태 기간,
     앞날은 적어 둔 기록 · 기간이 그날을 덮을 때만 그것이고 없으면 지금 상태. 모듈이 없으면 지금 상태. */
  function dayState(meta,p,day,today,P){
    var cur=current(p,today),r=null;
    if(P&&YMD.test(day||'')&&YMD.test(today||'')){try{r=day<=today?P.resolve(meta||{},String(p.id),day,'train',cur,today,true):P.resolve(meta||{},String(p.id),day,'train',cur,undefined,false);}catch(_){r=null;}}
    var s=r&&STATES[r.s]?r.s:cur;return {s:s,label:STATES[s],note:r&&r.note?String(r.note):''};
  }
  /* 기기 기억(ps_roster_pick_v1) — 모양이 틀리면 기본값: 선수단 · 전체 조 · 가능만 · 모든 포지션 · 모든 학년 */
  function memory(raw){var m={src:'team',grp:'',stage:'',avail:'ok',pos:'',years:[]};
    try{var o=JSON.parse(raw||'null');if(o&&typeof o==='object'){if(['team','scout','both'].indexOf(o.src)>=0)m.src=o.src;if(typeof o.grp==='string'&&o.grp.length<=64)m.grp=o.grp;if(o.avail==='all')m.avail='all';if(o.pos==='GK'||o.pos==='FIELD')m.pos=o.pos;if(Array.isArray(o.years))m.years=o.years.map(String).filter(function(y){return ['1','2','3'].indexOf(y)>=0;}).slice(0,3);}}catch(_){}
    return m;}
  function groupsOf(list){var keys=[],none=false;list.forEach(function(p){if(p.kind&&p.kind!=='team')return;var g=p.status;if(!g)none=true;else if(keys.indexOf(g)<0)keys.push(g);});
    keys.sort(function(a,b){var ia=FIXED.indexOf(a),ib=FIXED.indexOf(b);if(ia<0)ia=99;if(ib<0)ib=99;return ia===ib?a.localeCompare(b):ia-ib;});if(none)keys.push('__none');return keys;}
  function yearsOf(list){var y=[];list.forEach(function(p){if((!p.kind||p.kind==='team')&&p.year&&y.indexOf(p.year)<0)y.push(p.year);});return y.sort();}
  /* 조건 안의 선수(출처 · 조 · 영입 단계 · 포지션 · 학년) — 상태 · 검색은 여기서 안 거른다 */
  function pool(list,c){return list.filter(function(p){var k=p.kind||'team';
    if(c.src!=='both'&&k!==c.src)return false;
    if(k==='team'){if(c.grp==='__none'?!!p.status:(c.grp&&p.status!==c.grp))return false;if(c.years&&c.years.length&&c.years.indexOf(p.year)<0)return false;}
    else if(c.stage&&p.status!==c.stage)return false;
    if(c.pos==='GK'&&!isGK(p.pos))return false;if(c.pos==='FIELD'&&isGK(p.pos))return false;
    return true;});}
  /* 기본 체크 — «가능만»이면 그날 가능한 선수(후보는 늘), «전부»면 이름 있는 모두 */
  function fit(p,c){return !!p.name&&(c.avail==='all'||(p.kind||'team')!=='team'||p.availability==='ok');}
  function select(list,c){var pl=pool(list,c),on=pl.filter(function(p){return fit(p,c);}),off=pl.filter(function(p){return p.name&&!fit(p,c);}).length;return {pool:pl,on:on,off:off};}
  /* 훈련 인원 — 고른 선수는 상태대로(GK · 필드 · 재활 · 부상·불참), 조건 안에 있지만 안 고른 선수는 재활 또는 부상·불참 */
  function poolCounts(pl,sel){var c=trainingCounts(pl.filter(function(p){return sel.has(p.id)&&p.name;}));pl.forEach(function(p){if(sel.has(p.id)||!p.name)return;if(String(p.availability||'ok')==='rehab')c.rehab++;else c.out++;});return c;}
  function teamContext(win){
    var ls=win.localStorage,s=JSON.parse(ls.getItem('ps_sync_session')||'null'),wid=ls.getItem('ps_active_ws'),seal=ls.getItem('ps_cache_owner_v1'),owner=JSON.parse(seal||'null'),ws=JSON.parse(ls.getItem('ps_ws_list')||'[]').find(function(w){return w.id===wid;});
    var sync=win.PSSync||(win.parent&&win.parent.PSSync),perms=win.PSPerms,role=perms&&perms.role&&perms.role();
    if(!s||!s.uid||!wid||!owner||owner.uid!==s.uid||owner.wid!==wid||!ws||ws.kind!=='team'||!sync||!sync.dataUnlocked||!sync.dataUnlocked()||!['admin','executive','staff'].includes(role))throw Error('팀의 선수단과 권한을 확인 중입니다.');
    return JSON.stringify([wid,s.uid,seal,ls.getItem('ps_ws_switch_epoch_v1'),ls.getItem('cs_perms_v1'),role]);
  }
  // The same owner, permissions, source bytes and durable copies must still be current at import.
  async function read(win,kind){
    var S=win.PSScoutStore,client=kind==='team'?null:S.createClient(win),owner=client?null:teamContext(win),doc=client?await client.prepare():null,snap={};
    for(var key of [TEAM,TOMBS]){
      var raw=win.localStorage.getItem(key);snap[key]=raw;
      if(key===TOMBS)continue; // Deletion tombstones are LS-authoritative (storage-keys.js).
      await win.PSStorage.sharedReady(key);
      if(raw!=null)await win.PSStorage.sharedVerified(key,raw);
      else {var v=await win.storage.get(key);if(v&&v.value)throw Error('명단 자료를 다시 불러와 주세요.');}
    }
    // keyReady is issued for the candidate document by createClient, not for the general roster/tombstone keys.
    function check(){if(client)client.check();else if(owner!==teamContext(win))throw Error('계정이나 팀이 바뀌었습니다.');Object.keys(snap).forEach(function(key){if(win.localStorage.getItem(key)!==snap[key])throw Error('명단이 바뀌었습니다. 창을 닫고 다시 열어 주세요.');});}
    check();return {check:check,doc:doc,team:JSON.parse(snap[TEAM]||'{}'),tombs:JSON.parse(snap[TOMBS]||'{}')};
  }
  function install(win){
    var document=win.document;if(document.getElementById('boardScoutRow'))return;
    function training(){return document.body.classList.contains('editing');}
    function destination(){return JSON.stringify([training(),typeof editorDrillId==='undefined'?null:editorDrillId,typeof editorLibId==='undefined'?null:editorLibId,typeof editorTrainIdx==='undefined'?null:editorTrainIdx]);}
    function editable(){return typeof state!=='undefined'&&!state.boardLocked&&win.PSPerms&&win.PSPerms.canEdit('board')&&!(training()&&typeof editorReadOnly!=='undefined'&&editorReadOnly)&&win.__boardReady&&win.__boardRestoreDone&&!win.__vaultReadOnly&&!(win.psPhoneBoardReadOnly&&win.psPhoneBoardReadOnly())&&!(win.communityBoardReadOnly&&win.communityBoardReadOnly())&&!win.__ksNav&&!win.__animExport&&!win.__meetVideoBusy&&!(typeof animPlaying!=='undefined'&&animPlaying);}
    function allowed(kind){try{if(kind==='team')teamContext(win);else win.PSScoutStore.context(win,false);return true;}catch(_){return false;}}
    function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
    function today(){try{if(typeof win.todayStr==='function')return win.todayStr();}catch(_){}var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    function dayOf(isTraining){var s=typeof session!=='undefined'?session:null;return isTraining&&s&&YMD.test(String(s.date||''))?String(s.date):today();}
    function dateLabel(d){return (+d.slice(5,7))+'월 '+(+d.slice(8,10))+'일';}
    function groupLabel(key){if(key==='__none')return '조 없음';try{if(win.PSSchedule&&win.PSSchedule.groupLabel)return win.PSSchedule.groupLabel(key)||key;}catch(_){}return key;}
    function nameOf(c){return c.src==='scout'?'스카우팅':c.src==='both'?'선수단 · 스카우팅':c.grp?groupLabel(c.grp):'선수단';}
    function remember(c){try{win.localStorage.setItem(MEM,JSON.stringify({src:c.src,grp:c.grp,avail:c.avail,pos:c.pos,years:c.years}));}catch(_){}}
    var anchor=document.getElementById('squadGrpRow');if(!anchor)return;
    var row=el('div','menurow bsi-entry'),entries=[];row.id='boardScoutRow';row.appendChild(el('span','menulbl','명단 불러오기'));anchor.after(row);
    [['team','선수단','선수단 명단 불러오기','loadTeamRosterBtn'],['scout','스카우팅','스카우팅 명단 불러오기','loadScoutRosterBtn']].forEach(function(k){var b=el('button','btn',k[1]);b.type='button';b.id=k[3];b.setAttribute('aria-label',k[2]);row.appendChild(b);entries.push({button:b,kind:k[0]});b.onclick=function(){open({src:k[0]},b);};});
    /* 훈련 인원 카드의 «불러오기» 줄 — 팀 공간이면 빠른 칩 + «고르기…», 아니면 board.html 의 원래 «선수단 올리기» 줄(개인 선수단) 그대로 */
    var card={box:null,mode:'',sig:''},origRender=typeof win.renderEpSquadLoad==='function'?win.renderEpSquadLoad:null;
    function cardRows(){try{var team=JSON.parse(win.localStorage.getItem(TEAM)||'null'),tombs=JSON.parse(win.localStorage.getItem(TOMBS)||'null')||{};return team?teamRows(team,tombs,win.posCode):[];}catch(_){return [];}}
    function paintCard(){
      var box=document.getElementById('epSquadRow');if(!box)return;
      if(!allowed('team')){if(card.mode==='new'){card.mode='';if(origRender)try{origRender();}catch(_){}else box.textContent='';}return;}
      var list=cardRows(),keys=groupsOf(list).filter(function(k){return k!=='__none';}),all=FIXED.concat(keys.filter(function(k){return FIXED.indexOf(k)<0;}));
      box.textContent='';box.appendChild(el('span','ep-roster-label ep-sq-lb','불러오기'));var host=el('span','ep-sq-btns');box.appendChild(host);
      function chip(label,cls,title,has,fn){var b=el('button','ep-sq-btn'+(cls?' '+cls:''),label);b.type='button';b.title=title;b.__has=has;b.disabled=!has||!editable();b.onclick=function(){fn(b);};host.appendChild(b);}
      chip('전체','ep-sq-all','등록된 모든 선수를 팀 1 에 올리고 인원을 채웁니다 — 부상 · 재활 · 불참을 뺄지는 «고르기…»의 상태 조건을 따라요',!!list.length,function(b){quick({src:'team',grp:''},b);});
      all.forEach(function(k){var has=keys.indexOf(k)>=0,lb=groupLabel(k);chip(lb,'',has?lb+' 선수를 팀 1 에 올리고 인원을 채웁니다':lb+'에 등록된 선수가 없습니다',has,function(b){quick({src:'team',grp:k},b);});});
      if(allowed('scout'))chip('스카우팅','ep-sq-scout','스카우팅 후보를 모두 팀 1 에 올립니다',true,function(b){quick({src:'scout',grp:''},b);});
      chip('고르기…','ep-sq-pick','출처 · 조 · 상태 · 포지션 · 학년을 골라 불러옵니다',true,function(b){open(null,b);});
      card.mode='new';card.box=box;
    }
    if(origRender)win.renderEpSquadLoad=function(){var r=origRender.apply(this,arguments);card.mode='';try{paintCard();}catch(_){}return r;};
    function refresh(){
      entries.forEach(function(e){e.button.hidden=!allowed(e.kind);e.button.style.setProperty('display',e.button.hidden?'none':'inline-flex','important');e.button.disabled=!editable();});
      var hidden=entries.every(function(e){return e.button.hidden;});row.hidden=hidden;row.style.setProperty('display',hidden?'none':'flex','important');
      var sig=(allowed('team')?'t':'')+(allowed('scout')?'s':'');
      if(sig!==card.sig){card.sig=sig;try{paintCard();}catch(_){}}
      else if(card.mode==='new'&&card.box){var en=editable();[].forEach.call(card.box.querySelectorAll('.ep-sq-btn'),function(b){b.disabled=!en||!b.__has;});}
    }
    refresh();document.addEventListener('click',refresh,true);win.addEventListener('ps-auth-state',refresh);win.addEventListener('ps-perms-changed',refresh);win.setInterval(refresh,1500);
    /* 읽기 — 스카우팅까지 읽을 수 있으면 한 번에(후보 문서 + 선수단 + 삭제 기록), 아니면 선수단만. 후보 문서 확인이 막혀 있으면 선수단만 연다 */
    async function load(c){
      var src=null,err=null;
      if(allowed('scout')){try{src=await read(win,'scout');}catch(e){err=e;}}
      if(!src&&c.src!=='scout'&&allowed('team')){try{src=await read(win,'team');}catch(e){err=e;}}
      if(!src)throw err||Error('not allowed');
      return src;
    }
    function build(src,day,td){
      var P=win.PSParticipation||null,meta=src.team&&src.team.meta||{};
      var team=teamRows(src.team||{},src.tombs||{},win.posCode).map(function(p){var s=dayState(meta,p,day,td,P);p.kind='team';p.availability=s.s;p.day=s;return p;});
      var scout=src.doc?rows(src.doc,src.team,src.tombs,win.PSScoutStore,win.posCode).map(function(p){return Object.assign({},p,{kind:'scout',availability:'ok'});}):null;
      return {team:team,scout:scout,all:team.concat(scout||[])};
    }
    var opening=false;
    /* 빠른 칩 — 창 없이 같은 규칙으로 팀 1 에 바로(상태는 기억된 «가능만 / 전부») */
    async function quick(c0,button){
      if(opening||!editable()||document.getElementById('boardScoutDialog'))return;
      var m=memory(win.localStorage.getItem(MEM)),c={src:c0.src,grp:c0.grp||'',stage:'',avail:m.avail,pos:'',years:[]};
      if(!allowed(c.src))return;
      opening=true;button.disabled=true;var target=destination(),isTraining=training(),src=null;
      try{src=await load(c);}catch(_){win.toast(c.src==='scout'?'스카우팅 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 눌러 주세요.':'선수단 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 눌러 주세요.');}finally{opening=false;refresh();}
      if(!src||!editable()||target!==destination())return;
      var data=build(src,dayOf(isTraining),today());if(c.src==='scout'&&!data.scout){win.toast('스카우팅 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 눌러 주세요.');return;}
      var s=select(data.all,c);
      if(!s.pool.length){win.toast(c.src==='scout'?'스카우팅에 등록된 후보가 없어요':c.grp?groupLabel(c.grp)+' 선수가 없어요 — 팀 탭에서 조를 지정하세요':'선수단에 선수가 없어요 — 팀 탭에서 선수를 추가하세요');return;}
      if(!s.on.length){win.toast('훈련 가능한 선수가 없어요 — «고르기…»에서 상태를 «전부»로 두면 모두 올라와요');return;}
      try{src.check();if(!editable()||target!==destination())throw Error();}catch(_){win.toast('팀 · 권한 또는 명단이 바뀌어 불러오지 않았어요. 다시 눌러 주세요.');return;}
      apply(win,s.on,'blue',nameOf(c),isTraining?poolCounts(s.pool,new Set(s.on.map(function(p){return p.id;}))):null,s.pool.length-s.on.length);
    }
    async function open(c0,button){
      if(opening||!editable()||document.getElementById('boardScoutDialog'))return;
      var c=Object.assign(memory(win.localStorage.getItem(MEM)),c0||{});c.stage='';
      if(c.src!=='scout'&&!allowed('team'))c.src='scout';if(c.src!=='team'&&!allowed('scout'))c.src='team';
      if(!allowed(c.src==='both'?'team':c.src))return;
      opening=true;button.disabled=true;
      var target=destination(),isTraining=training(),src=null;
      try{src=await load(c);}catch(_){win.toast('명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 열어 주세요.');}finally{opening=false;refresh();}
      if(!src||!editable()||target!==destination())return;
      document.querySelectorAll('.popmenu.on').forEach(function(m){m.classList.remove('on');});
      var day=dayOf(isTraining),data=build(src,day,today());
      if(!data.scout&&c.src!=='team')c.src='team';
      var selected=new Set(),groups=groupsOf(data.team),years=yearsOf(data.team);
      var d=el('dialog');d.id='boardScoutDialog';d.setAttribute('aria-labelledby','boardScoutTitle');
      d.innerHTML='<form><header><div><h2 id="boardScoutTitle">명단 불러오기</h2><p class="bsi-sub"></p></div><label class="bsi-side">배치할 팀<select name="side" aria-label="배치할 팀"><option value="blue">팀 1</option><option value="red">팀 2</option></select></label><button type="button" class="btn" data-close aria-label="명단 불러오기 닫기">닫기</button></header><div class="bsi-body"><div class="bsi-conds"></div><input class="bsi-search" name="search" type="search" placeholder="이름·소속팀·등번호 검색" aria-label="명단 검색"><div class="bsi-selection"><span data-count aria-live="polite"></span><button type="button" class="btn" data-all>모두</button><button type="button" class="btn" data-none>없음</button></div><div class="bsi-list"></div></div><footer><p class="bsi-foot"></p><p data-error role="status"></p><div><button type="button" class="btn" data-cancel>취소</button><button type="submit" class="btn primary" data-load>불러오기</button></div></footer></form>';
      d.querySelector('.bsi-sub').textContent=isTraining?dateLabel(day)+' 훈련 · 상태는 그날 가용인원 기준':'작업 보드 · 상태는 오늘 가용인원 기준';
      d.querySelector('.bsi-foot').textContent=isTraining?'체크한 명단으로 훈련 인원을 채웁니다 — 조건 안에서 체크하지 않은 선수는 재활 · 부상·불참으로 셉니다. 보드의 선택한 팀 자리에 이름 · 등번호를 입히고, 자리가 부족하면 대기 줄에 둡니다.':'선택한 팀의 기존 자리에 이름 · 등번호를 입힙니다. 자리가 부족하면 대기 줄에 두고, 기존 선수 불러오기처럼 다른 장면 · 페이지에도 반영됩니다.';
      var conds=d.querySelector('.bsi-conds'),form=d.querySelector('form'),search=form.elements.search,box=d.querySelector('.bsi-list'),loadBtn=d.querySelector('[data-load]');
      function condRow(key,label,sub){var w=el('div','bsi-cond');w.setAttribute('data-cond',key);var l=el('span','bsi-lbl',label);if(sub)l.appendChild(el('small','',sub));var h=el('div','bsi-chips');h.setAttribute('role','group');h.setAttribute('aria-label',label);w.append(l,h);conds.appendChild(w);return {w:w,h:h};}
      var R={src:condRow('src','출처'),grp:condRow('grp','조'),stage:condRow('stage','영입 단계'),avail:condRow('avail','상태','그날 가용인원 기준'),pos:condRow('pos','포지션 · 학년')};
      function chip(h,label,on,soft,fn){var b=el('button','bsi-chip'+(soft?' soft':''),label);b.type='button';b.setAttribute('aria-pressed',on?'true':'false');b.onclick=function(){fn();reset();};h.appendChild(b);}
      function paintChips(){
        Object.keys(R).forEach(function(k){R[k].h.textContent='';});
        var hasScout=!!data.scout,hasTeam=allowed('team');
        R.src.w.hidden=!(hasScout&&hasTeam);
        if(hasTeam)chip(R.src.h,'선수단',c.src==='team',false,function(){c.src='team';});
        if(hasScout){chip(R.src.h,'스카우팅',c.src==='scout',false,function(){c.src='scout';});if(hasTeam)chip(R.src.h,'둘 다',c.src==='both',false,function(){c.src='both';});}
        R.grp.w.hidden=c.src==='scout'||!groups.length;
        chip(R.grp.h,'전체',!c.grp,false,function(){c.grp='';});groups.forEach(function(k){chip(R.grp.h,groupLabel(k),c.grp===k,false,function(){c.grp=k;});});
        R.stage.w.hidden=c.src==='team';
        chip(R.stage.h,'모든 단계',!c.stage,false,function(){c.stage='';});Object.keys(STAGES).forEach(function(k){chip(R.stage.h,STAGES[k],c.stage===k,false,function(){c.stage=k;});});
        R.avail.w.hidden=c.src==='scout';
        chip(R.avail.h,'가능만 — 부상 · 재활 · 불참 제외',c.avail!=='all',true,function(){c.avail='ok';});chip(R.avail.h,'전부',c.avail==='all',false,function(){c.avail='all';});
        chip(R.pos.h,'모든 포지션',!c.pos,false,function(){c.pos='';});chip(R.pos.h,'GK',c.pos==='GK',false,function(){c.pos='GK';});chip(R.pos.h,'필드',c.pos==='FIELD',false,function(){c.pos='FIELD';});
        if(c.src!=='scout'&&years.length){R.pos.h.appendChild(el('span','bsi-gap'));years.forEach(function(y){chip(R.pos.h,y+'학년',c.years.indexOf(y)>=0,false,function(){var i=c.years.indexOf(y);if(i>=0)c.years.splice(i,1);else c.years.push(y);});});}
      }
      function reset(){var s=select(data.all,c);selected=new Set(s.on.map(function(p){return p.id;}));paintChips();paint();}
      function visible(){return filter(pool(data.all,c),search.value,'','');}
      function count(){var pl=pool(data.all,c),off=pl.filter(function(p){return p.name&&!fit(p,c)&&!selected.has(p.id);}).length;
        d.querySelector('[data-count]').textContent=selected.size+'명 선택 / 전체 '+pl.length+'명'+(off?' · 조건 밖 '+off+'명은 체크 해제됨':'');loadBtn.textContent=selected.size+'명 불러오기';loadBtn.disabled=!selected.size;}
      function paint(){box.textContent='';var shown=visible();
        shown.forEach(function(p){var ok=fit(p,c),label=el('label','bsi-candidate'+(ok?'':' off')),input=el('input');input.type='checkbox';input.checked=selected.has(p.id);input.disabled=!p.name;input.value=p.id;input.setAttribute('aria-label',(p.name||'이름 미등록')+' 선택');input.onchange=function(){if(input.checked)selected.add(p.id);else selected.delete(p.id);count();};
          var text=el('span','bsi-person');text.appendChild(el('strong','',p.name||'이름 미등록'));text.appendChild(el('small','',[p.kind==='scout'?'후보':p.club,p.kind==='scout'?p.club:'',p.no?'#'+p.no:'',p.positions.join(' / ')||'포지션 미지정'].filter(Boolean).join(' · ')));
          var st=el('span','bsi-stage');if(p.kind==='scout')st.textContent=STAGES[p.status]||'';else{st.appendChild(el('span','bsi-st st-'+p.day.s,p.day.label));if(p.day.note)st.appendChild(el('small','bsi-note',p.day.note));}
          label.append(input,text,st);box.appendChild(label);});
        if(!shown.length)box.appendChild(el('p','bsi-empty',data.all.length?'조건에 맞는 선수가 없어요.':'등록된 선수가 없어요.'));count();
      }
      search.oninput=paint;search.onkeydown=function(e){if(e.key==='Enter')e.preventDefault();};
      d.querySelector('[data-all]').onclick=function(){visible().forEach(function(p){if(p.name)selected.add(p.id);});paint();};d.querySelector('[data-none]').onclick=function(){selected.clear();paint();};
      function close(){d.close();}
      d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
      // Prevent the board shortcuts from handling typing/Enter while the native dialog holds focus.
      function key(e){if(!d.open)return;if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'&&(e.isComposing||e.keyCode===229))e.preventDefault();e.stopPropagation();}
      d.addEventListener('keydown',key);d.addEventListener('keyup',key);
      var timer=win.setInterval(function(){try{src.check();if(!editable()||target!==destination())throw Error();}catch(_){close();win.toast('팀·권한 또는 명단이 바뀌어 불러오기 창을 닫았어요. 다시 열어 주세요.');}},500);
      d.addEventListener('close',function(){win.clearInterval(timer);d.remove();if(button.isConnected)button.focus();});
      form.onsubmit=function(e){e.preventDefault();if(e.isComposing||opening)return;
        try{src.check();if(!editable()||target!==destination())throw Error('지금은 이 보드를 편집할 수 없어요.');
          var pl=pool(data.all,c),chosen=pl.filter(function(p){return selected.has(p.id)&&p.name;}),side=form.elements.side.value;if(!chosen.length||!['blue','red'].includes(side))return;
          remember(c);apply(win,chosen,side,nameOf(c),isTraining?poolCounts(pl,selected):null,pl.length-chosen.length);close();
        }catch(err){d.querySelector('[data-error]').textContent=err.message||'명단을 다시 열어 주세요.';}
      };
      reset();document.body.appendChild(d);d.showModal();search.focus();
    }
  }
  function apply(win,list,side,label,counts,left){
    var st=state,L=win.PSTeamLoad,cur=st.players.filter(function(p){return p.team===side&&!p.coach;}),fe=win.document.getElementById(side==='red'?'formAway':'formHome'),flip=cur.length?win._sqTokFlip(cur):side==='red';
    var plan=L.plan(cur.length?win._sqTokSlots(cur,flip):(FORM[fe&&fe.value]||FORM['433']),list,{keep:cur.length>0,code:win.posCode,base:win.posBase,group:win.posGroup}),fresh=[];
    win.pushUndo();cur.forEach(function(p,i){L.dress(p,list[plan.pick[i]]);});
    if(!cur.length&&win.document.body.classList.contains('editing')&&typeof win._editorTokBoost==='function')win._editorTokBoost();   /* 3.320 — 훈련 편집기에서 새로 올리는 선수는 _editorTokBoost 크기(3.338 [1] — applySquadToBoard 와 같이, 판 위 자리에 입힐 땐 그대로) */
    plan.add.forEach(function(a){var at=n2u(flip?1-a.x:a.x,flip?1-a.y:a.y),p=L.dress({id:uid++,team:side,num:a.p.no||'',pos:a.p.pos||'',x:at.x,y:at.y},a.p);st.players.push(p);fresh.push(p);});
    L.frames(anim.frames,animActive,cur,fresh);if(counts)win.syncEpRosterUI({counts:counts,syncInputs:true,persist:true});sel=null;multiSel=[];win.renderTokens();win.renderDrawings();win.autoSaveAnimFrame();if(win.boardSaveLive)win.boardSaveLive();
    win.toast(label+' · '+list.length+'명 불러옴'+(plan.bench?' · 대기 '+plan.bench+'명':'')+(left?' · 제외 '+left+'명':''));
  }
  return {rows:rows,teamRows:teamRows,trainingCounts:trainingCounts,teamContext:teamContext,filter:filter,read:read,install:install,apply:apply,dayState:dayState,memory:memory,groupsOf:groupsOf,yearsOf:yearsOf,pool:pool,fit:fit,select:select,poolCounts:poolCounts,STATES:STATES,STAGES:STAGES};
});
