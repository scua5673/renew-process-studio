/* Read-only roster projections. All edits go through the existing guarded editors. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PSPlayerWorkspace=api;api.mount(root);}})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function family(pos){var p=String(pos||'').toUpperCase();if(p==='GK')return 'GK';if(/^(L?CB|RCB|LB|RB|FB|WB|LWB|RWB)$/.test(p))return 'DF';if(/^(DM|CM|AM|LM|RM|CDM|CAM|LCM|RCM|LDM|RDM|LAM|RAM)$/.test(p))return 'MF';if(/^(LW|RW|FW|CF|LCF|RCF|ST|SS)$/.test(p))return 'FW';return '미지정';}
  function scored(levels){return Object.keys(levels||{}).filter(function(k){return Number.isFinite(+levels[k])&&+levels[k]>0;});}
  function evaluated(p){var keys=scored(p.levels);return keys.length>0&&(!!p.evalAt||keys.some(function(k){return +p.levels[k]>1;}));}
  function filter(rows,state){var words=String(state.q||'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return rows.filter(function(r){return words.every(function(w){return [r.name,r.num,r.pos,(r.positions||[]).join(' '),r.club,r.group].join(' ').toLocaleLowerCase().indexOf(w)>=0;})&&(!state.pos||(r.positions&&r.positions.length?r.positions:[r.pos]).some(function(p){return family(p)===state.pos;}))&&(!state.status||r.statusKey===state.status)&&(!state.unevaluated||!r.evaluated);});}
  function select(selected,id){var next=selected.slice(),at=next.indexOf(id);if(at>=0)next.splice(at,1);else if(next.length<3)next.push(id);return next;}
  /* 3.339 — 선수단 명단은 몇 명이든 고른다(비교 · 조 바꾸기 · 명단에서 빼기). 스카우팅은 예전처럼 비교 3명 */
  var FRESH_LABEL='방금 추가';
  function toggle(selected,id){var next=selected.slice(),at=next.indexOf(id);if(at>=0)next.splice(at,1);else next.push(id);return next;}
  function norm(v){return String(v==null?'':v).replace(/\s+/g,'').toLocaleLowerCase();}
  /* 스카우팅 후보가 이미 명단에 있나 — 불러온 표식(joinedFrom.cid)이면 «있음», 같은 이름(번호가 둘 다 있으면 번호도)이면 «같은 이름» */
  function rosterMatch(roster,c){var cp=c.profile||{},hit='';
    roster.forEach(function(p){if(hit==='dup')return;if(p.joinedFrom&&p.joinedFrom.cid&&p.joinedFrom.cid===c.cid){hit='dup';return;}
      if(!norm(p.name)||norm(p.name)!==norm(c.name))return;var pd=String(p.profile&&p.profile.dob||''),cd=String(cp.dob||''),pn=String(p.num==null?'':p.num),cn=String(c.num==null?'':c.num);
      if(pd&&cd){hit=pd===cd?'dup':hit;return;}   /* 생년월일이 둘 다 있으면 그것으로 가른다 */
      if(pn&&cn){hit=pn===cn?'dup':hit;return;}
      hit='same';});   /* 이름만 같고 가를 값이 없다 — 흐리게 두지 않고 «같은 이름»만 알린다 */
    return hit;}
  function reconcile(selected,rows){return selected.filter(function(id){return rows.some(function(r){return r.id===id;});});}
  function candidates(placements,registry,visible){
    return (visible||[]).map(function(v){var c=registry&&registry[v.id],ps=placements.filter(function(p){return p.cid===v.id;});return {id:'candidate:'+v.id,cid:v.id,player:ps[0]||null,placements:ps,candidate:c||null,source:v};});
  }
  /* A projection only: position IDs (not abbreviations) keep custom positions distinct.
     A candidate belongs to every actual placement, once per position. Preferred
     positions on an unplaced candidate are never turned into saved placements. */
  function depthBoard(rows,positions,cardIds,state){
    var by=new Map(),used=new Set(),unplaced=[],s=state||{};
    (positions||[]).forEach(function(p){by.set(p.id,{id:p.id,name:p.name,abbr:p.abbr||p.name,family:family(p.abbr||p.name),all:[],rows:[]});});
    (cardIds||[]).forEach(function(id){if(by.has(id))used.add(id);});
    rows.forEach(function(r,index){
      var placements=Array.isArray(r.placements)?r.placements:[{posId:r.posId,pid:r.pid,statusKey:r.statusKey,status:r.status,order:index}],groups=new Map();
      placements.forEach(function(p){if(!by.has(p.posId))return;var group=groups.get(p.posId)||[];group.push(p);groups.set(p.posId,group);});
      if(!groups.size){unplaced.push(Object.assign({},r,{rank:unplaced.length+1}));return;}
      groups.forEach(function(ps,posId){var card=by.get(posId),first=ps[0],mixed=ps.some(function(p){return p.statusKey!==first.statusKey;});used.add(posId);
        card.all.push(Object.assign({},r,{pid:first.pid||r.pid,posId:posId,pos:card.abbr,positions:[card.abbr],statusKey:mixed?'mixed':first.statusKey,status:mixed?'배치별 상이':first.status,_order:Number.isFinite(first.order)?first.order:index}));
      });
    });
    // Before a team's card configuration exists, show its defined positions without writing defaults.
    if(!used.size)(positions||[]).forEach(function(p){used.add(p.id);});
    var order={LW:0,LCF:1,CF:1,ST:1,RCF:2,SS:2,RW:3,LM:0,LAM:1,LCM:2,LDM:3,AM:4,CM:5,DM:6,RDM:7,RCM:8,RAM:9,RM:10,LB:0,LWB:1,LCB:2,CB:3,RCB:4,RWB:5,RB:6};
    var cards=Array.from(used).map(function(id){var c=by.get(id);c.all.sort(function(a,b){return a._order-b._order;});c.all=c.all.map(function(r,i){return Object.assign({},r,{rank:i+1});});c.rows=filter(c.all,s);return c;});
    cards.sort(function(a,b){var groups=['FW','MF','DF','GK','미지정'],delta=groups.indexOf(a.family)-groups.indexOf(b.family);return delta||((order[a.abbr]??50)-(order[b.abbr]??50));});
    var loose={id:'__unplaced',name:'미배치',abbr:'미배치',family:'미지정',all:unplaced,rows:filter(unplaced,s)},shown=new Set();
    cards.concat([loose]).forEach(function(c){c.rows.forEach(function(r){shown.add(r.id);});});
    return {cards:cards,unplaced:loose,total:rows.length,shown:shown.size,max:Math.max(1,...cards.map(function(c){return c.all.length;}))};
  }
  /* 3.203 — 판 줄 배치(사용자 «포지션 카드도 이동가능하고 한 행에 4개까지»). 저장 모양은 meta.depthRows=[[posId,…],…](같은 팀 자료 — 새 저장 키 없음).
     저장이 없으면 역할군(FW·MF·DF·GK·미지정)별로 넷씩 끊어 만든다. 저장에 없는 카드(새 포지션 · 팀 기준에서 더한 것)는 뒤 줄에 덧붙여 숨기지 않는다. */
  var FAMILIES=['FW','MF','DF','GK','미지정'],ROW_MAX=4;
  function layoutRows(cards,saved,max){
    max=max||ROW_MAX;var by={},rows=[],keepers=[],seen={};
    (cards||[]).forEach(function(c){by[c.id]=c;});
    (Array.isArray(saved)?saved:[]).forEach(function(ids){var row=[];(Array.isArray(ids)?ids:[]).forEach(function(id){if(!by[id]||seen[id])return;if(by[id].family==='GK'){seen[id]=1;keepers.push([by[id]]);}else if(row.length<max){seen[id]=1;row.push(by[id]);}});if(row.length)rows.push(row);});
    FAMILIES.forEach(function(g){var rest=(cards||[]).filter(function(c){return c.family===g&&!seen[c.id];});while(rest.length){if(g==='GK')keepers.push(rest.splice(0,1));else rows.push(rest.splice(0,max));}});
    return rows.concat(keepers);
  }
  function moveCard(rows,id,toRow,toIndex,max){
    max=max||ROW_MAX;var next=rows.map(function(r){return r.slice();}),card=null;
    next.forEach(function(r){var k=r.findIndex(function(c){return c.id===id;});if(k>=0)card=r.splice(k,1)[0];});
    if(!card)return null;
    if(toRow>=next.length)next.push([card]);
    else{var row=next[toRow];if(row.length>=max||(row.length&&(card.family==='GK'||row.some(function(c){return c.family==='GK';}))))return null;row.splice(Math.max(0,Math.min(toIndex|0,row.length)),0,card);}
    return next.filter(function(r){return r.length;});
  }
  function rowsIds(rows){return rows.map(function(r){return r.map(function(c){return c.id;});});}
  function rowLabel(row){var n={};row.forEach(function(c){n[c.family]=(n[c.family]||0)+1;});return FAMILIES.filter(function(g){return n[g];}).join(' · ');}
  function depthSelection(board,state){
    var cards=board.cards.concat([board.unplaced]),selected=cards.find(function(c){return c.id===state.depthPosition;});
    if(!selected||(!state.depthPositionChosen&&!selected.rows.length))selected=cards.find(function(c){return c.rows.length;})||selected||cards[0];
    return selected;
  }
  function mount(win){
    var doc=win.document;if(!doc||doc.getElementById('pwTeam'))return;
    var phoneView=win.matchMedia('(max-width:767px) and (orientation:portrait)');
    function newState(kind){return {q:'',pos:'',status:'',unevaluated:false,view:'depth',viewInitialized:false,selected:[],depthPosition:null,depthPositionChosen:false,depthStage:'',depthLimit:6,depthEdit:false,groupEdit:false,tools:false,filters:false,scope:'cur'};}
    var states={team:newState('team'),scout:newState('scout')},depths={};
    var models={team:[],scout:[]},dialog=null,detail=null,lastFocus=null,scope=null;
    function el(id){return doc.getElementById(id);}
    function source(){return typeof data!=='undefined'?data:{players:[],positions:[],meta:{}};}
    function position(p){var po=source().positions.find(function(q){return q.id===p.posId;});return po?posAbbr(po.name):'';}
    function group(p){return typeof tmGrpLabel==='function'?tmGrpLabel(p.grp):p.grp||'';}
    function row(p){var pf=p.profile||{},status=plStatusOf(p),lv=p.levels||{},link=null;try{link=matchAccountForPlayer(p.id);}catch(_){}
      return {id:p.id,pid:p.id,p:p,posId:p.posId,name:p.name||'이름 없음',num:p.num||'',pos:position(p),club:pf.team||p.club||'',group:group(p),year:p.schoolYear||'',statusKey:p.grad?'grad':status,status:p.grad?'졸업':TM_ST_LB[status]||'정상',grad:p.grad?String(p.grad.season||''):'',evaluated:evaluated(p),levels:lv,linked:!!link,link:link,profile:pf,foot:p.foot||'',grade:p.grade||'',notes:[p.memo].filter(Boolean)};
    }
    function scoutRows(){var placements=source().players.filter(function(p){return p.type==='target'&&!p._scoutHidden;}).map(function(p){return {cid:PSScoutStore.idOf(p),p:p};});var registry={};try{scStore().check();registry=scStore().read().scoutRegistry.candidates;}catch(_){return [];}
      return candidates(placements,registry,scRegistryRows()).map(function(item){var c=item.candidate||{},p=item.player&&item.player.p,pf=c.info&&c.info.profile||{},s=item.source,r=p?row(p):{levels:{},notes:[],profile:pf,foot:s.foot||'',linked:false};
        var st=scStOf(p&&p.scoutSt),positions=item.placements.map(function(x){return position(x.p);}).filter(function(v,i,a){return v&&a.indexOf(v)===i;}),stageKeys=item.placements.map(function(x){return scStOf(x.p.scoutSt)[0];});if(stageKeys.some(function(k){return k!==st[0];}))st=['mixed','배치별 상이'];
        return Object.assign(r,{id:item.id,cid:item.cid,pid:p&&p.id,p:p,name:s.nameKr||'이름 없음',num:s.num==null?'':s.num,club:s.club||'',grade:s.grade||'',group:'',pos:positions[0]||(s.pos||[])[0]||'',positions:positions,placements:item.placements.map(function(x){var status=scStOf(x.p.scoutSt);return {pid:x.p.id,posId:x.p.posId,statusKey:status[0],status:status[1],order:source().players.indexOf(x.p)};}),statusKey:st[0],status:st[1],profile:pf,points:c.points||{},evaluated:scored(c.points).length>0,notes:item.placements.reduce(function(a,x){return a.concat(scMemos(x.p));},[]).filter(Boolean),candidate:c,placementLabels:item.placements.map(function(x){return (position(x.p)||'미배치')+' · '+scStOf(x.p.scoutSt)[1];})});
      });
    }
    function resetScope(){var next='';try{next=win.PSSync.activeWs();}catch(_){}if(scope!==null&&scope!==next){close();closeGroupPicker();Object.keys(states).forEach(function(k){states[k]=newState(k);});depths={};}scope=next;}
    var dragLock='',pendingRefresh={};
    /* 누른 순간부터 다시 그리기를 놓은 뒤로 미룬다. 터치의 길게 누르기 대기 중에도 대상 DOM 이 바뀌면 포인터가 끊긴다. */
    function refresh(kind){if(dragLock===kind){pendingRefresh[kind]=true;return;}resetScope();var host=el(kind==='team'?'pwTeam':'pwScout');if(!host)return;
      // Hidden iframes may initially report a phone-sized viewport on a desktop.
      // Choose the default once the frame has its actual visible dimensions.
      if(kind==='team'&&!states.team.viewInitialized&&(!win.frameElement||win.frameElement.getBoundingClientRect().width>0)){
        states.team.view=phoneView.matches?'list':'depth';states.team.viewInitialized=true;
      }
      models[kind]=kind==='team'?teamModel():scoutRows();
      states[kind].selected=reconcile(states[kind].selected,models[kind]);paint(kind);if(kind==='team')phoneSummary();
      if(kind==='team'&&el('tmStatNeed'))el('tmStatNeed').textContent=activeRows.filter(function(r){return tmGrpFlt(r.p)&&!r.evaluated;}).length;
      if(dialog&&dialog.open&&detail&&detail.kind===kind){var r=models[kind].find(function(r){return r.id===detail.id;});if(!r){var confirmed=true;if(kind==='scout')try{scStore().check();}catch(_){confirmed=false;}if(confirmed)close();}}
    }
    function visible(kind){var rows=models[kind];if(kind==='team')rows=rows.filter(function(r){return tmGrpFlt(r.p)&&(!tmUnlinkedOnly||!r.linked);});return filter(rows,states[kind]);}
    function button(label,attrs,cls){return '<button type="button" '+(attrs||'')+' class="pw-button '+(cls||'')+'">'+label+'</button>';}
    function phoneSummary(){
      var team=el('teamView'),head=team&&team.querySelector('.tm-head');if(!head)return;
      var hero=head.querySelector('.tm-hero'),share=el('tmShareLine'),box=head.querySelector('.pw-team-summary');if(!hero)return;
      if(!phoneView.matches){if(box){head.insertBefore(hero,box);if(share)head.insertBefore(share,box);box.remove();}return;}
      if(!box){box=doc.createElement('details');box.className='pw-team-summary';var summary=doc.createElement('summary');box.appendChild(summary);head.insertBefore(box,hero);}
      if(hero.parentNode!==box)box.appendChild(hero);if(share&&share.parentNode!==box)box.appendChild(share);
      var count=hero.querySelector('.tm-hero-big'),unlinked=hero.querySelector('.tm-unlinked');
      var text=[count&&count.textContent,unlinked&&unlinked.textContent].filter(Boolean).map(function(x){return x.replace(/\s+/g,' ').trim();}).join(' · ')+' · 자세히';
      if(box.firstElementChild.textContent!==text)box.firstElementChild.textContent=text;
    }
    phoneView.addEventListener('change',phoneSummary);
    function opts(values,current){return values.map(function(x){return '<option value="'+esc(x[0])+'"'+(x[0]===current?' selected':'')+'>'+esc(x[1])+'</option>';}).join('');}
    function create(kind,parent,before){var host=doc.createElement('section');host.id=kind==='team'?'pwTeam':'pwScout';host.className='pw-workspace';host.setAttribute('aria-label',kind==='team'?'선수단 작업 공간':'스카우팅 작업 공간');parent.insertBefore(host,before||null);
      host.innerHTML='<div class="pw-top"></div><div class="pw-toolbar"></div><div class="pw-result" aria-live="polite"></div>'+(kind==='team'?'<div class="pw-quickadd" hidden></div>':'')+'<div class="pw-content"></div><div class="pw-comparebar" hidden></div>';
      if(kind==='team'){host.addEventListener('submit',function(e){var f=e.target.closest('[data-pw-qa]');if(!f)return;e.preventDefault();quickAdd(f);});
        host.addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.isComposing||e.keyCode===229)&&e.target.closest&&e.target.closest('[data-pw-qa]'))e.preventDefault();});}   /* 한글 조합을 끝내는 Enter 는 넣기가 아니다 */
      host.addEventListener('input',function(e){if(e.target.dataset.pwSearch!==undefined){states[kind].q=e.target.value;states[kind].depthLimit=6;paintContent(kind);}});
      host.addEventListener('change',function(e){var k=e.target.dataset.pwFilter;if(k){states[kind][k]=e.target.value;states[kind].depthLimit=6;states[kind].depthStage='';paintContent(kind);}if(e.target.dataset.pwSelectall!==undefined){states[kind].selected=e.target.checked?visible(kind).map(function(r){return r.id;}):[];paintContent(kind);var all=host.querySelector('[data-pw-selectall]');if(all)all.focus({preventScroll:true});}
        if(e.target.dataset.pwSelect!==undefined){var id=e.target.dataset.pwSelect,prior=states[kind].selected;states[kind].selected=kind==='team'?toggle(prior,id):select(prior,id);if(kind!=='team'&&prior.length===3&&prior.indexOf(id)<0)toast('최대 3명까지 비교할 수 있어요.');paintContent(kind);var choice=Array.from(host.querySelectorAll('[data-pw-select]')).find(function(x){return x.dataset.pwSelect===id;});if(choice)choice.focus({preventScroll:true});}});
      installDrag(host,kind);
      host.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
        if(d.pwAction==='filters'){states[kind].filters=!states[kind].filters;host.classList.toggle('pw-filters-open',states[kind].filters);b.setAttribute('aria-expanded',String(states[kind].filters));return;}
        if(d.pwAction==='tools'){states[kind].tools=!states[kind].tools;host.classList.toggle('pw-tools-open',states[kind].tools);b.setAttribute('aria-expanded',String(states[kind].tools));return;}
        if(d.pwView){states[kind].viewInitialized=true;closeGroupPicker();states[kind].groupEdit=false;states[kind].view=d.pwView;refresh(kind);var active=host.querySelector('[data-pw-view="'+d.pwView+'"]');if(active)active.focus();return;}
        if(d.pwPosition){states[kind].depthPosition=d.pwPosition;states[kind].depthPositionChosen=true;states[kind].depthStage='';states[kind].depthLimit=6;paintContent(kind);var panel=host.querySelector('.pw-depth-panel');if(panel){panel.querySelector('h3').focus({preventScroll:true});if(win.matchMedia('(max-width:900px)').matches)panel.scrollIntoView({block:'start',behavior:'smooth'});}return;}
        if(d.pwStage!==undefined){states[kind].depthStage=d.pwStage;states[kind].depthLimit=6;paintContent(kind);var stage=Array.from(host.querySelectorAll('[data-pw-stage]')).find(function(x){return x.dataset.pwStage===d.pwStage;});if(stage)stage.focus({preventScroll:true});return;}
        if(d.pwAction==='more'){states[kind].depthLimit+=6;paintContent(kind);var more=host.querySelector('[data-pw-action="more"]');if(more)more.focus({preventScroll:true});return;}
        if(d.pwAction==='board'){var pitch=host.querySelector('.pw-depth-pitch');if(pitch){pitch.scrollIntoView({block:'start',behavior:'smooth'});var pick=pitch.querySelector('[aria-pressed="true"]');if(pick)pick.focus({preventScroll:true});}return;}
        if(d.pwAction==='bulk'){if(win.PSPlayerBulk&&win.PSPlayerBulk.open)win.PSPlayerBulk.open(kind);return;}
        if(d.pwAction==='group'&&kind==='team'){if(!states.team.groupEdit&&!groupAllowed())return;closeGroupPicker();states.team.groupEdit=!states.team.groupEdit;states.team.depthEdit=false;paint(kind);host.querySelector('[data-pw-action="group"]').focus({preventScroll:true});return;}
        if(d.pwAction==='layout'){if(!states[kind].depthEdit&&!layoutAllowed())return;closeGroupPicker();states[kind].groupEdit=false;states[kind].depthEdit=!states[kind].depthEdit;paint(kind);var lb=host.querySelector('[data-pw-action="layout"]');if(lb)lb.focus({preventScroll:true});return;}
        if(d.pwAddpos!==undefined){addPosition(kind,+d.pwAddpos);return;}
        if(d.pwPosmenu){renamePosition(kind,d.pwPosmenu);return;}
        if(d.pwDetail){if(dragged&&Date.now()-dragged<400)return;open(kind,d.pwDetail,'summary',d.pwAtpos);return;}   /* 3.273 — 요약 · 평가 · 관찰 기록 · IDP 는 이 단추로(이름은 프로필을 바로 연다) */
        if(d.pwOpen){if(dragged&&Date.now()-dragged<400)return;if(kind==='team'&&states.team.view==='depth'&&states.team.groupEdit)pickGroup(b,d.pwOpen);else{e.stopPropagation();openProfile(kind,d.pwOpen,d.pwAtpos);}return;}   /* 같은 클릭이 방금 연 프로필의 «바깥 누르면 닫기»에 닿지 않게(예전 «프로필 수정»과 같다) */
        if(kind==='team'&&d.pwAction==='season'){seasonMenu(b);return;}
        if(kind==='team'&&d.pwAction==='seasonNow'){setScope('cur');return;}
        if(kind==='team'&&d.pwAction==='graduate'){graduateSelected();return;}
        if(kind==='team'&&d.pwAction==='ungrad'){restoreSelected();return;}
        if(kind==='team'&&d.pwPast){e.stopPropagation();pastOpen(d.pwPast);return;}
        if(d.pwAction==='clear'){states[kind].selected=[];paintContent(kind);}
        if(d.pwAction==='compare')compare(kind);
        if(kind==='team'&&d.pwAction==='regroup'){regroup(b);return;}
        if(kind==='team'&&d.pwAction==='remove'){removeSelected();return;}
        if(kind==='team'&&d.pwAction==='scoutImport'){importScout();return;}
        if(d.pwAction==='points'){modal();detail=null;dialog.classList.remove('pw-comparison');dialog.innerHTML='<header class="pw-dialoghead"><h2 id="pwDetailTitle">스카우팅 질문 기준</h2>'+button('닫기','data-pw-close')+'</header><div class="pw-detailbody"><iframe title="스카우팅 질문 기준" src="scouting.html?view=points"></iframe></div>';show();}
        if(d.pwAction==='reset'){Object.assign(states[kind],{q:'',pos:'',status:'',unevaluated:false});if(kind==='team'){tmGrpFilter='';tmSchoolYearFilter='';tmUnlinkedOnly=false;renderTeam();}else paint(kind);}
        if(d.pwAction==='unevaluated'){states[kind].unevaluated=!states[kind].unevaluated;paint(kind);}
        if(d.pwAction==='add'){if(kind==='team')el('tmAdd').click();else scOpenQuick();}
      });
    }
    function paint(kind){var host=el(kind==='team'?'pwTeam':'pwScout'),s=states[kind],rows=models[kind];if(!host)return;
      if(kind==='scout'){
        var top=host.querySelector('.pw-top');
        /* 이동한 포인트 버튼과 직접 연결된 클릭 처리를 다시 그리기에도 유지한다. */
        if(!top.querySelector('.pw-scouthead'))top.innerHTML='<div class="pw-scouthead"><h2>스카우팅</h2><div class="pw-scoutactions">'+button('질문 기준','data-pw-action="points"')+'</div></div><div class="pw-stats"></div>';
        top.querySelector('.pw-stats').innerHTML='<div><span>전체 후보</span><b>'+rows.length+'</b></div>'+['rep','go','done'].map(function(k){return '<div><span>'+esc(scStOf(k)[1])+'</span><b>'+rows.filter(function(r){return r.statusKey===k;}).length+'</b></div>';}).join('');
        if(typeof win.sbPtsPlace==='function')win.sbPtsPlace();
      }
      if(kind==='team')paintSeason(host);
      var statuses=kind==='team'?[['','모든 상태'],['ok','정상'],['rest','휴식'],['rehab','재활'],['injury','부상'],['out','불참']]:[['','모든 단계'],['rep','추천'],['go','영입대상'],['done','확정'],['mixed','배치별 상이']];
      host.querySelector('.pw-toolbar').innerHTML='<label class="pw-search"><span aria-hidden="true">⌕</span><input data-pw-search type="search" aria-label="'+(kind==='team'?'선수':'후보')+' 검색" placeholder="이름·번호·포지션" value="'+esc(s.q)+'"></label>'+button('필터','data-pw-action="filters" aria-controls="pw-'+kind+'-filters" aria-expanded="'+s.filters+'"','pw-filter-toggle')+'<div class="pw-filter-fields" id="pw-'+kind+'-filters"><select data-pw-filter="pos" aria-label="포지션 필터">'+opts([['','모든 포지션'],['GK','골키퍼'],['DF','수비수'],['MF','미드필더'],['FW','공격수'],['미지정','미지정']],s.pos)+'</select><select data-pw-filter="status" aria-label="'+(kind==='team'?'상태':'영입 단계')+' 필터">'+opts(statuses,s.status)+'</select>'+button('미평가','data-pw-action="unevaluated" aria-pressed="'+s.unevaluated+'"',s.unevaluated?'is-on':'')+'</div><span class="pw-view" role="group" aria-label="보기 선택">'+[['list','명단'],['depth','포지션']].map(function(x){return button(x[1],'data-pw-view="'+x[0]+'" aria-pressed="'+(s.view===x[0])+'"',s.view===x[0]?'is-on':'');}).join('')+'</span>'+button('편집 도구','data-pw-action="tools" aria-controls="pw-'+kind+'-tools" aria-expanded="'+s.tools+'"','pw-tools-toggle')+'<div class="pw-edit-tools" id="pw-'+kind+'-tools">'+button(s.view==='edit'?'편집 닫기':'배치·명단 편집','data-pw-view="'+(s.view==='edit'?'depth':'edit')+'"')+(s.view==='depth'?button(s.depthEdit?'판 편집 끝':'판 편집','data-pw-action="layout" aria-pressed="'+!!s.depthEdit+'"',s.depthEdit?'is-on':''):'')+(kind==='scout'?button('＋ 후보 등록','data-pw-action="add"','pw-primary')+button('＋ 여러 명','data-pw-action="bulk"'):button('＋ 여러 명 추가','data-pw-action="bulk"','pw-primary')+(scoutVisible()&&groupAllowed(true)?button('⇣ 스카우팅에서 불러오기','data-pw-action="scoutImport"','pw-rq-edit'):''))+'</div>';
      host.classList.toggle('pw-tools-open',s.tools);host.classList.toggle('pw-filters-open',s.filters);
      var view=kind==='team'?el('teamView'):el('sbPaneCands');view.classList.toggle('pw-edit',s.view==='edit');
      paintContent(kind);
    }
    function avatar(r){return '<span class="pw-avatar" aria-hidden="true">'+esc(r.num||r.name.slice(0,1))+'</span>';}
    function score(r,kind){return kind==='scout'?(r.evaluated?'포인트 '+scored(r.points).length+'개 기록':'포인트 미평가'):(r.evaluated?'평가 '+scored(r.levels).length+'개 기록':'아직 평가 전');}
    function scoutMeta(r){return [r.club||'소속 미입력',r.num!==''&&r.num!=null?'#'+r.num:'번호 미입력'].join(' · ');}
    function nameCell(r,kind){return '<span class="pw-person">'+avatar(r)+'<span><strong>'+esc(r.name)+'</strong><small>'+esc(kind==='scout'?scoutMeta(r):[(r.positions&&r.positions.length?r.positions.join(' / '):r.pos)||'포지션 미지정',r.club].filter(Boolean).join(' · '))+'</small></span></span>';}
    function scoutReady(){try{scStore().check();return true;}catch(_){return false;}}
    function abbrOf(p){var o=(source().meta||{}).posAbbr;return (o&&o[p.id])||posAbbr(p.name);}
    function cardIdsAll(){var m=source().meta||{},ids=(m.tbCards||[]).slice();(Array.isArray(m.depthRows)?m.depthRows:[]).forEach(function(r){(r||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});});source().players.forEach(function(p){if(p.posId&&ids.indexOf(p.posId)<0)ids.push(p.posId);});return ids;}
    function layoutAllowed(){if(typeof win.teEditable==='function'&&!win.teEditable()){toast('운영진만 바꿀 수 있어요');return false;}if(win.scoutReadOnlyLoad){toast('보기 전용 상태예요');return false;}return true;}
    var groupPicker=null,groupPickTurn=0;
    function closeGroupPicker(){groupPickTurn++;if(groupPicker&&groupPicker===el('psPickPop'))win.psPickClose();groupPicker=null;}
    function groupAllowed(quiet){
      try{
        if(!win.teEditable()||doc.body.classList.contains('ps-roster-locked'))throw Error('선수단 편집 권한이 없어요');
        if(win.scoutReadOnlyLoad||win.scoutBootPending)throw Error('명단을 확인한 뒤 다시 시도해 주세요');
        win.rosterRecoveryContext(true);return true;
      }catch(e){if(!quiet)toast(e.message||'선수단 편집 권한을 확인해 주세요');return false;}
    }
    function groupFocus(id){var host=el('pwTeam'),next=Array.from(host.querySelectorAll('[data-pw-open]')).find(function(b){return b.dataset.pwOpen===id;})||host.querySelector('[data-pw-action="group"]');if(next)next.focus({preventScroll:true});}
    function pickGroup(anchor,id){
      if(!groupAllowed())return;var original=source(),pl=original.players.find(function(p){return p.id===id&&p.type!=='target';});if(!pl)return;
      closeGroupPicker();var turn=groupPickTurn,owner=win.teamSaveOwner(),from=String(pl.grp||'').trim();
      win.grpPickOpen(anchor,from,function(value){
        if(turn!==groupPickTurn||!states.team.groupEdit||states.team.view!=='depth'||!groupAllowed())return;
        // A picker is a short-lived edit: never apply it to a replaced roster or owner.
        if(owner!==win.teamSaveOwner()||original!==source()||source().players.find(function(p){return p.id===id;})!==pl||String(pl.grp||'').trim()!==from){toast('명단이 바뀌었어요. 선수를 다시 선택해 주세요');refresh('team');groupFocus(id);return;}
        var to=String(value||'').trim();if(win.tmGrpCycle().indexOf(to)<0){toast('조가 바뀌었어요. 다시 선택해 주세요');return;}
        if(from===to){groupFocus(id);return;}
        pl.grp=to;var ok=win.save({skipTargets:true});win.renderTeam();groupFocus(id);
        if(ok===false){toast('조를 바꿨지만 저장 확인이 필요해요');return;}
        showUndo('<b>'+esc(pl.name||'선수')+'</b> → '+esc(group(pl)||'조 없음')+(!win.tmGrpFlt(pl)?' · 현재 조 목록에서 숨겨졌어요':' · 조를 바꿨어요'));
      });
      groupPicker=el('psPickPop');if(!groupPicker)return;
      groupPicker.classList.add('pw-group-picker');groupPicker.setAttribute('aria-label',(pl.name||'선수')+' 조 고르기');
      var title=doc.createElement('strong');title.className='pw-group-picker-title';title.textContent=(pl.name||'선수')+' · 조 변경';groupPicker.prepend(title);
      groupPicker.querySelectorAll('button').forEach(function(b){b.style.height='44px';if(b.getAttribute('aria-checked')==='true'){b.style.background='var(--c-ink)';b.style.color='var(--c-surface)';}});
      var rect=anchor.getBoundingClientRect(),height=groupPicker.offsetHeight;groupPicker.style.top=Math.round(rect.bottom+6+height<=win.innerHeight?rect.bottom+6:Math.max(8,rect.top-6-height))+'px';
      (groupPicker.querySelector('[aria-checked="true"]')||groupPicker.querySelector('button')).focus({preventScroll:true});
      groupPicker.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();closeGroupPicker();groupFocus(id);}});
    }
    function rerenderAll(){try{win.renderTeam();}catch(_){}try{win.renderScoutBoard();}catch(_){}refresh('scout');}
    function currentRows(kind){return rowsIds(layoutRows(depthModel(kind).cards,(source().meta||{}).depthRows,ROW_MAX));}
    function saveRows(kind,rows){var d=source();d.meta=d.meta||{};d.meta.depthRows=rows;var ok=win.save();rerenderAll();return ok;}
    function askPosition(title,cur,done){
      if(typeof win.psForm!=='function'){var nm=win.prompt(title,cur.name||'');if(nm==null)return;done({name:String(nm).trim(),abbr:''});return;}
      win.psForm({title:title,sub:'우리 팀만의 포지션을 씁니다. 선수 배치 · 평가 기준 · 작전판 카드에 같이 생겨요.',ok:cur.name?'바꾸기':'추가',
        fields:[{key:'name',label:'이름',type:'text',placeholder:'예: 좌측 풀백',required:true,maxlength:20,value:cur.name||''},{key:'abbr',label:'줄임말(카드에 보임 · 비우면 자동)',type:'text',placeholder:'예: LFB',maxlength:4,value:cur.abbr||''}],onOk:done});
    }
    function addPosition(kind,rowIdx){
      if(!layoutAllowed())return;
      askPosition('포지션 추가',{},function(v){var name=String(v.name||'').trim();if(!name)return;var d=source();d.positions=d.positions||[];
        if(d.positions.some(function(p){return String(p.name||'').trim()===name;})){toast('이미 있는 포지션이에요 — '+name);return;}
        var rows=currentRows(kind),id=(typeof uid==='function'?uid('p'):'p_'+Date.now().toString(36));d.positions.push({id:id,name:name,targets:{}});d.meta=d.meta||{};
        var ab=String(v.abbr||'').trim().toUpperCase();if(ab){d.meta.posAbbr=Object.assign({},d.meta.posAbbr||{});d.meta.posAbbr[id]=ab;}
        if(rowIdx<rows.length&&rows[rowIdx].length<ROW_MAX)rows[rowIdx].push(id);else rows.push([id]);
        saveRows(kind,rows);toast(name+' 포지션 추가됨');});
    }
    function renamePosition(kind,id){
      if(!layoutAllowed())return;var d=source(),po=(d.positions||[]).find(function(p){return p.id===id;});if(!po)return;
      askPosition('포지션 이름 바꾸기',{name:po.name,abbr:((d.meta||{}).posAbbr||{})[id]||''},function(v){var name=String(v.name||'').trim();if(!name)return;po.name=name;d.meta=d.meta||{};var ab=String(v.abbr||'').trim().toUpperCase();
        var map=Object.assign({},d.meta.posAbbr||{});if(ab)map[id]=ab;else delete map[id];d.meta.posAbbr=map;win.save();rerenderAll();toast(name+' 으로 바꿨어요');});
    }
    function indexAmong(kind,pl){var same=source().players.filter(function(p){return (kind==='team'?p.type!=='target':p.type==='target')&&(p.posId||'')===(pl.posId||'');});return same.indexOf(pl);}
    function moveTarget(t,posId,idx){var ps=source().players;ps.splice(ps.indexOf(t),1);if((t.posId||'')!==(posId||''))delete t.sbSeat;t.posId=posId||'';var grp=ps.filter(function(p){return p.type==='target'&&p.posId===posId;}),anchor=(posId&&typeof idx==='number'&&idx<grp.length)?grp[idx]:null;
      if(anchor)ps.splice(ps.indexOf(anchor),0,t);else if(posId&&grp.length)ps.splice(ps.indexOf(grp[grp.length-1])+1,0,t);else ps.push(t);win.save();try{win.renderScoutCands();}catch(_){}try{win.renderScoutBoard();}catch(_){}}
    /* 선수 옮기기는 기존 길: 선수단은 본문 tbMovePlayer(저장 · renderTeam), 스카우팅 배치는 attach() 와 같은 posId 바꾸기 + save(). 되돌리기용 이전 자리를 돌려준다. */
    function movePlayer(kind,id,fromPos,toPos,index,anchors){
      var r=models[kind].find(function(x){return x.id===id;});if(!r)return null;
      if(kind==='team'){if(!layoutAllowed())return null;var pl=source().players.find(function(p){return p.id===r.pid;});if(!pl||typeof win.tbMovePlayer!=='function')return null;
        var prevPos=pl.posId||'',prevIdx=indexAmong('team',pl);
        // Group/search filters hide roster rows: insert beside the visible player,
        // rather than treating the visible index as an index into the full roster.
        if(anchors&&toPos){var group=source().players.filter(function(p){return p.type!=='target'&&p.id!==pl.id&&p.posId===toPos;}),before=group.findIndex(function(p){return p.id===anchors.before;}),after=group.findIndex(function(p){return p.id===anchors.after;});index=before>=0?before:(after>=0?after+1:group.length);}
        win.tbMovePlayer(r.pid,toPos,index);return {undo:function(){win.tbMovePlayer(r.pid,prevPos,prevIdx);}};}
      try{win.scStore().check();}catch(e){try{win.scWarn(e);}catch(_){}return null;}
      var card=(depths.scout||{cards:[]}).cards.find(function(c){return c.id===fromPos;}),placed=card&&card.all.find(function(x){return x.id===id;}),pid=placed&&placed.pid;
      var t=pid&&source().players.find(function(p){return p.id===pid&&p.type==='target';});if(!t)return null;
      var prev=t.posId||'',prevI=indexAmong('scout',t);moveTarget(t,toPos,index);return {undo:function(){var again=source().players.find(function(p){return p.id===pid;});if(again)moveTarget(again,prev,prevI);}};
    }
    var undoBox=null,undoTimer=0;
    function showUndo(msg,fn,ms){if(undoBox)undoBox.remove();undoBox=doc.createElement('div');undoBox.className='pw-undo';undoBox.setAttribute('role','status');undoBox.innerHTML='<span>'+msg+'</span>'+(fn?'<button type="button">되돌리기</button>':'');doc.body.appendChild(undoBox);
      var box=undoBox;if(fn)box.querySelector('button').addEventListener('click',function(){box.remove();if(undoBox===box)undoBox=null;fn();});clearTimeout(undoTimer);undoTimer=setTimeout(function(){box.remove();if(undoBox===box)undoBox=null;},ms||6000);}
    var dragged=0;
    /* 끌기: 마우스는 6px 움직이면, 손가락 · 펜은 280ms 길게 누르면 시작(그 전에 움직이면 그냥 스크롤). 끄는 동안은 비수동 touchmove 로 스크롤을 막는다. */
    function installDrag(host,kind){
      var st=null;
      function slotOf(el){return el&&el.closest?el.closest('.pw-depth-slot'):null;}
      function clearMarks(){host.querySelectorAll('.pw-depth-drop,.pw-depth-placeholder').forEach(function(n){n.remove();});host.querySelectorAll('.is-dropping,.is-full').forEach(function(n){n.classList.remove('is-dropping');n.classList.remove('is-full');});}
      function stop(){if(!st)return;if(st.on)dragged=Date.now();if(st.hold)clearTimeout(st.hold);if(st.ghost)st.ghost.remove();if(st.src)st.src.classList.remove('is-dragging');clearMarks();doc.removeEventListener('touchmove',block,{passive:false});st=null;if(dragLock===kind){dragLock='';if(pendingRefresh[kind]){pendingRefresh[kind]=false;win.setTimeout(function(){refresh(kind);},0);}}} // Let a plain tap deliver its click before replacing the button.
      function block(e){if(st&&st.on)e.preventDefault();}
      function begin(e){if(!st||st.on)return;st.on=true;dragLock=kind;dragged=Date.now();var r=st.src.getBoundingClientRect();st.dx=e.clientX-r.left;st.dy=e.clientY-r.top;st.w=r.width;
        var g=st.src.cloneNode(true);g.className+=' pw-depth-ghost';g.style.width=r.width+'px';g.setAttribute('aria-hidden','true');doc.body.appendChild(g);st.ghost=g;st.src.classList.add('is-dragging');place(e);}
      /* 놓을 자리는 hit-test(elementFromPoint) 대신 칸 · 줄의 사각형으로 찾는다 — 떠 있는 ghost · 앞 move 의 표식 · 알림이 포인터 밑에 있어도 흔들리지 않는다. */
      function hit(list,x,y){for(var i=0;i<list.length;i++){var b=list[i].getBoundingClientRect();if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)return list[i];}return null;}
      function place(e){if(!st||!st.ghost)return;st.ghost.style.transform='translate('+(e.clientX-st.dx)+'px,'+(e.clientY-st.dy)+'px)';
        clearMarks();st.target=null;var x=e.clientX,y=e.clientY;
        if(st.kind==='player'){var pane=hit(host.querySelectorAll('.pw-depth-candidates'),x,y),ppos=states[kind].depthPosition;
          if(pane&&ppos&&ppos!=='__unplaced'){var its=Array.prototype.filter.call(pane.querySelectorAll('.pw-depth-candidate'),function(n){return n!==st.src;}),pi=its.filter(function(n){var b=n.getBoundingClientRect();return y>b.top+b.height/2;}).length;
            var pl=doc.createElement('div');pl.className='pw-depth-drop';if(its[pi])pane.insertBefore(pl,its[pi]);else pane.appendChild(pl);
            var idOf=function(n){var b=n&&n.querySelector('[data-pw-open]');return b?b.dataset.pwOpen:'';},bf=idOf(its[pi]),af=idOf(its[pi-1]);
            var pc=(depths[kind]||{cards:[]}).cards.find(function(c){return c.id===ppos;}),full=pc?pc.rows.map(function(r){return r.id;}).filter(function(v){return v!==st.id;}):[],fi=bf&&full.indexOf(bf)>=0?full.indexOf(bf):(af&&full.indexOf(af)>=0?full.indexOf(af)+1:full.length);
            st.target={pos:ppos,index:fi,before:bf,after:af,panel:true,vis:pi};return;}
          var unp=hit(host.querySelectorAll('[data-pw-position="__unplaced"]'),x,y);if(unp){unp.classList.add('is-dropping');st.target={pos:'',index:0};return;}
          var slot=hit(host.querySelectorAll('.pw-depth-slot:not(.pw-depth-placeholder)'),x,y);if(!slot)return;var names=Array.prototype.filter.call(slot.querySelectorAll('.pw-depth-name'),function(n){return n!==st.src;}),idx=names.filter(function(n){var b=n.getBoundingClientRect();return y>b.top+b.height/2;}).length;
          slot.classList.add('is-dropping');var line=doc.createElement('div');line.className='pw-depth-drop';var box=slot.querySelector('.pw-depth-names');if(names[idx])box.insertBefore(line,names[idx]);else box.appendChild(line);st.target={pos:slot.dataset.pwSlot,index:idx,before:names[idx]&&names[idx].dataset.pwOpen,after:names[idx-1]&&names[idx-1].dataset.pwOpen};return;}
        var lineEl=hit(host.querySelectorAll('.pw-depth-line'),x,y);if(!lineEl)return;var row=+lineEl.dataset.pwRow,slots=Array.prototype.filter.call(lineEl.querySelectorAll('.pw-depth-slot'),function(n){return n!==st.src&&!n.classList.contains('pw-depth-placeholder');});
        if(slots.length>=ROW_MAX||(slots.length&&(lineEl.classList.contains('pw-depth-keeper')||st.src.closest('.pw-depth-keeper')))){lineEl.classList.add('is-full');return;}
        var at=slots.filter(function(n){var b=n.getBoundingClientRect();return x>b.left+b.width/2;}).length,ph=doc.createElement('div');ph.className='pw-depth-slot pw-depth-placeholder';ph.style.minHeight=st.src.getBoundingClientRect().height+'px';
        var wrap=lineEl.querySelector('.pw-depth-slots');if(slots[at])wrap.insertBefore(ph,slots[at]);else{var add=wrap.querySelector('.pw-depth-addpos');if(add)wrap.insertBefore(ph,add);else wrap.appendChild(ph);}lineEl.classList.add('is-dropping');st.target={row:row,index:at};}
      function finish(e){if(!st)return;var s=st,on=s.on,target=s.target;stop();if(!on||!target)return;
        if(s.kind==='player'){var from=slotOf(s.src),fromPos=from?from.dataset.pwSlot:(s.fromPos||''),name=(s.src.querySelector('strong')||{}).textContent||'';
          if(target.panel&&s.panel&&target.pos===fromPos&&target.vis===s.was)return;if(!target.panel&&from&&target.pos===fromPos){var names=Array.prototype.filter.call(from.querySelectorAll('.pw-depth-name'),function(n){return n!==s.src;}),was=Array.prototype.indexOf.call(from.querySelectorAll('.pw-depth-name'),s.src);if(target.index===was)return;}
          var done=movePlayer(kind,s.id,fromPos,target.pos,target.index,target);if(!done)return;
          var card=(depths[kind]||{cards:[]}).cards.find(function(c){return c.id===target.pos;});showUndo('<b>'+esc(name)+'</b> → '+(card?esc(card.abbr)+' '+(target.index+1)+'번째':'미배치')+'로 옮겼어요',done.undo);return;}
        if(!layoutAllowed())return;var rows=currentRows(kind),cards=(depths[kind]||{cards:[]}).cards,next=moveCard(rows.map(function(r){return r.map(function(id){return cards.find(function(c){return c.id===id;})||{id:id};});}),s.id,target.row,target.index,ROW_MAX);
        if(!next){toast('한 줄에는 포지션 카드를 '+ROW_MAX+'장까지 둘 수 있어요');return;}var ids=rowsIds(next);if(JSON.stringify(ids)===JSON.stringify(rows))return;
        var before=rows;saveRows(kind,ids);showUndo('포지션 카드를 옮겼어요',function(){saveRows(kind,before);});}
      host.addEventListener('pointerdown',function(e){if(st||states[kind].groupEdit||e.button!==0&&e.pointerType==='mouse')return;var edit=!!states[kind].depthEdit,src,id,kindD;
        if(edit){var head=e.target.closest('.pw-depth-slothead,.pw-depth-grip');var slot=slotOf(head);if(!slot||e.target.closest('.pw-depth-posmenu'))return;src=slot;id=slot.dataset.pwSlot;kindD='card';}
        else{var n=e.target.closest('.pw-depth-name'),cand=!n&&!e.target.closest('.pw-depth-check')&&e.target.closest('.pw-depth-candidate'),panelPos=states[kind].depthPosition;
          if(n&&slotOf(n)){src=n;id=n.dataset.pwOpen;kindD='player';}
          else if(cand&&panelPos&&panelPos!=='__unplaced'&&cand.querySelector('[data-pw-open]')){src=cand;id=cand.querySelector('[data-pw-open]').dataset.pwOpen;kindD='player';}   /* 3.273 — «선택한 포지션» 목록에서도 끌어 순서를 바꾼다 */
          else return;}
        st={src:src,id:id,kind:kindD,x:e.clientX,y:e.clientY,on:false,hold:0,target:null,panel:!!(src.classList&&src.classList.contains('pw-depth-candidate')),fromPos:states[kind].depthPosition||''};
        if(st.panel)st.was=Array.prototype.indexOf.call(src.parentNode.querySelectorAll('.pw-depth-candidate'),src);dragLock=kind;doc.addEventListener('touchmove',block,{passive:false});
        if(e.pointerType!=='mouse')st.hold=setTimeout(function(){if(st&&!st.on){begin(e);try{src.setPointerCapture(e.pointerId);}catch(_){}}},280);});
      doc.addEventListener('pointermove',function(e){if(!st)return;if(!st.on){if(e.pointerType==='mouse'){if(Math.hypot(e.clientX-st.x,e.clientY-st.y)>6)begin(e);}else if(Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)stop();return;}e.preventDefault();place(e);});
      doc.addEventListener('pointerup',finish);doc.addEventListener('pointercancel',stop);doc.addEventListener('keydown',function(e){if(e.key==='Escape')stop();});
    }
    function depthModel(kind){var rows=models[kind];if(kind==='team')rows=rows.filter(function(r){return tmGrpFlt(r.p)&&(!tmUnlinkedOnly||!r.linked);});return depthBoard(rows,source().positions.map(function(p){return {id:p.id,name:p.name,abbr:abbrOf(p)};}),cardIdsAll(),states[kind]);}
    function depthHTML(kind,board){
      var s=states[kind],selected=depthSelection(board,s);
      s.depthPosition=selected.id;var edit=!!s.depthEdit,canGroup=kind==='team'&&groupAllowed(true);if(!canGroup&&s.groupEdit){s.groupEdit=false;closeGroupPicker();}var groupEdit=kind==='team'&&s.groupEdit,rowsL=layoutRows(board.cards,(source().meta||{}).depthRows,ROW_MAX);
      function count(c){return c.rows.length===c.all.length?c.all.length+'명':c.rows.length+' / '+c.all.length+'명';}
      function stages(c){return ['rep','go','done','mixed'].map(function(k){var n=c.all.filter(function(r){return r.statusKey===k;}).length;return n?'<i class="pw-stage-'+k+'" style="width:'+(n/board.max*100)+'%"></i>':'';}).join('');}
      function depthName(r){return kind==='scout'?'<span class="pw-depth-person"><strong>'+esc(r.name)+'</strong><small class="pw-depth-meta" title="'+esc(scoutMeta(r))+'"><span class="pw-depth-club">'+esc(r.club||'소속 미입력')+'</span><span class="pw-depth-number"> · '+esc(r.num!==''&&r.num!=null?'#'+r.num:'번호 미입력')+'</span></small></span>':groupEdit?'<span class="pw-depth-person"><strong>'+esc(r.name)+'</strong><small>'+esc(r.group||'조 없음')+' ▾</small></span>':'<strong>'+esc(r.name)+'</strong>';}
      function nameAttrs(r,posId){return 'data-pw-open="'+esc(r.id)+'" data-pw-atpos="'+esc(posId)+'"'+(groupEdit?' aria-haspopup="menu" aria-label="'+esc(r.name+' 조 변경 · '+(r.group||'조 없음'))+'"':'');}
      function slot(c){var preview=c.rows;   /* 3.273 — 스카우팅도 선수단처럼 전원(사용자 «선수목록이 전부 보이게 · 같은 레이아웃으로») */return '<article class="pw-depth-slot'+(c.id===selected.id?' is-active':'')+(edit?' is-editing':'')+'" data-pw-slot="'+esc(c.id)+'">'+(edit?'<span class="pw-depth-grip" aria-hidden="true">⠿</span>':'')+button('<b>'+esc(c.abbr)+'</b><span>'+count(c)+'</span>','data-pw-position="'+esc(c.id)+'" aria-label="'+esc(c.name)+' '+count(c)+' 전체 보기" aria-pressed="'+(c.id===selected.id)+'"','pw-depth-slothead')+(edit?button('⋯','data-pw-posmenu="'+esc(c.id)+'" aria-label="'+esc(c.name)+' 포지션 이름 바꾸기"','pw-depth-posmenu'):'')+(kind==='scout'?'<div class="pw-depth-meter" aria-hidden="true">'+stages(c)+'</div>':'')+'<div class="pw-depth-names">'+(preview.length?preview.map(function(r){return button('<span class="pw-depth-rank">'+r.rank+'</span>'+depthName(r)+(kind==='team'?'<i class="pw-depth-dot pw-status-'+esc(r.statusKey)+'" title="'+esc(r.status)+'"><span class="pw-sr">'+esc(r.status)+'</span></i>':'<span class="pw-depth-dot pw-stage-'+esc(r.statusKey)+'"><span class="pw-sr">'+esc(r.status)+'</span></span>'),nameAttrs(r,c.id)+' title="'+esc(r.name+(kind==='scout'?' · '+scoutMeta(r):''))+'"','pw-depth-name');}).join(''):'<span class="pw-depth-vacant">'+(c.all.length?'검색 결과 없음':'배치 없음')+'</span>')+'</div>'+'</article>';}   /* 3.277 — 카드가 전원을 보여 «전체 보기 →» 줄을 걷었다(패널은 카드 머리로 연다) */
      var panelRows=selected.rows.filter(function(r){return !s.depthStage||r.statusKey===s.depthStage;}),shown=panelRows;
      return '<div class="pw-depth-layout'+(groupEdit?' is-group-edit':'')+'"><div class="pw-depth-board"><header class="pw-depth-heading"><div><h3>포지션별 '+(kind==='team'?'선수 뎁스':'후보 뎁스')+'</h3><p>'+(groupEdit?'선수 이름을 누르고 바꿀 조를 선택하세요':'이름을 끌어 순서 변경 · 휴대폰은 길게 누른 뒤 끌기')+'</p></div><div class="pw-depth-actions">'+(canGroup?button(groupEdit?'조 변경 끝':'조 변경','data-pw-action="group" aria-pressed="'+groupEdit+'"',groupEdit?'is-on':''):'')+'<span>공격 방향 ↑</span></div></header>'+(kind==='scout'?'<div class="pw-depth-legend"><span><i class="pw-stage-rep"></i>추천</span><span><i class="pw-stage-go"></i>영입대상</span><span><i class="pw-stage-done"></i>확정</span></div>':'')+'<div class="pw-depth-pitch" aria-label="포지션별 작전판"><div class="pw-depth-markings" aria-hidden="true"><i></i></div>'+rowsL.map(function(row,ri){var g=rowLabel(row),cols=Math.min(row.length+(edit&&g!=='GK'&&row.length<ROW_MAX?1:0),ROW_MAX);return '<section class="pw-depth-line'+(g==='GK'?' pw-depth-keeper':'')+'" data-pw-row="'+ri+'" aria-label="'+esc(g||'포지션')+' 줄"><div class="pw-depth-slots" style="--pw-cols:'+cols+';--pw-phone-cols:'+cols+'">'+row.map(slot).join('')+(edit&&g!=='GK'&&row.length<ROW_MAX?button('＋ 포지션','data-pw-addpos="'+ri+'"','pw-depth-addpos'):'')+'</div></section>';}).join('')+(edit?'<section class="pw-depth-line pw-depth-newrow" data-pw-row="'+rowsL.length+'" aria-label="새 줄"><div class="pw-depth-slots" style="--pw-cols:1;--pw-phone-cols:1">'+button('＋ 새 줄에 포지션','data-pw-addpos="'+rowsL.length+'"','pw-depth-addpos')+'</div></section>':'')+'</div>'+button('<b>미배치 '+count(board.unplaced)+'</b><span>포지션을 정하지 않은 '+(kind==='team'?'선수':'후보')+' 보기 →</span>','data-pw-position="__unplaced" aria-pressed="'+(selected.id==='__unplaced')+'"','pw-depth-unplaced')+'<p class="pw-footnote">'+(kind==='scout'?'같은 후보가 여러 포지션에 있으면 각 자리에 표시합니다. 전체 인원은 중복을 제외합니다. ':'')+''+(groupEdit?'조 변경 중 · 선수 이름 아래에 현재 조가 표시돼요. 마치면 ‘조 변경 끝’을 눌러 주세요.':edit?'판 편집 중 — 포지션 카드를 끌어 줄과 순서를 바꿉니다(한 줄 최대 '+ROW_MAX+'장). ＋ 포지션으로 우리 팀 포지션을 더하고, ⋯ 으로 이름을 바꿔요.':'이름을 끌어 다른 포지션 칸에 놓으면 포지션이 바뀌고, 같은 칸 안에서 끌면 순서가 바뀝니다. 폰에서는 길게 눌러 끌어요.')+'</p></div><aside class="pw-depth-panel" aria-label="포지션 '+(kind==='team'?'선수':'후보')+' 패널"><header><div><span class="pw-depth-eyebrow">선택한 포지션</span><h3 tabindex="-1">'+esc(selected.abbr)+' <span>'+selected.all.length+'명</span></h3><p>'+esc(selected.name===selected.abbr?(kind==='team'?'선수단':'스카우팅 후보'):selected.name)+'</p></div>'+button('↑ 작전판','data-pw-action="board"','pw-depth-back')+'</header>'+(kind==='scout'?'<div class="pw-depth-stages" role="group" aria-label="선택한 포지션 영입 단계">'+[['','전체'],['rep','추천'],['go','영입대상'],['done','확정']].concat(selected.rows.some(function(r){return r.statusKey==='mixed';})?[['mixed','배치별 상이']]:[]).map(function(x){var n=x[0]?selected.rows.filter(function(r){return r.statusKey===x[0];}).length:selected.rows.length;return button(esc(x[1])+' <b>'+n+'</b>','data-pw-stage="'+x[0]+'" aria-pressed="'+(s.depthStage===x[0])+'"',s.depthStage===x[0]?'is-on':'');}).join('')+'</div>':'')+'<div class="pw-depth-panelresult" aria-live="polite">'+shown.length+' / '+panelRows.length+'명 표시 · '+(groupEdit?'이름을 눌러 조 변경':'이름을 눌러 상세 보기')+'</div><div class="pw-depth-candidates">'+(shown.length?shown.map(function(r){return '<article class="pw-depth-candidate"><span class="pw-depth-rank">'+r.rank+'</span>'+button('<strong>'+esc(r.name)+'</strong><small>'+esc([kind==='team'?r.group:r.club,r.num&&'#'+r.num,r.grade&&'등급 '+r.grade].filter(Boolean).join(' · ')||'소속 미등록')+'</small><span class="pw-status pw-status-'+esc(r.statusKey)+'">'+esc(r.status)+'</span><small>'+score(r,kind)+'</small>',nameAttrs(r,selected.id),'pw-depth-candidate-name')+button('평가 · 기록','data-pw-detail="'+esc(r.id)+'" data-pw-atpos="'+esc(selected.id)+'" aria-label="'+esc(detailLabel(r))+'"','pw-depth-detail')+'<label class="pw-depth-check"><input type="checkbox" data-pw-select="'+esc(r.id)+'" aria-label="'+esc(r.name)+' 비교 선택"'+(s.selected.indexOf(r.id)>=0?' checked':'')+'><span>비교</span></label></article>';}).join(''):'<div class="pw-empty"><strong>'+(selected.all.length?'조건에 맞는 선수가 없어요':(selected.id==='__unplaced'?'미배치 '+(kind==='team'?'선수':'후보')+'가 없어요':'이 포지션에 배치된 '+(kind==='team'?'선수':'후보')+'가 없어요'))+'</strong><p>'+(selected.all.length?'단계나 검색 조건을 바꿔 보세요.':(selected.id==='__unplaced'?'포지션 카드를 누르면 배치된 명단을 볼 수 있어요.':'배치·명단 편집에서 포지션을 지정할 수 있어요.'))+'</p></div>')+'</div>'+(shown.length<panelRows.length?button('6명 더 보기 · '+(panelRows.length-shown.length)+'명 남음','data-pw-action="more"','pw-depth-more'):'')+'</aside></div>';
    }
    function paintContent(kind){var host=el(kind==='team'?'pwTeam':'pwScout'),s=states[kind],rows=visible(kind),content=host.querySelector('.pw-content');
      if(kind==='team'&&pastScope()){paintPast(host,content,s);return;}
      var active=doc.activeElement,focusedPlayer=active&&content.contains(active)&&active.dataset.pwOpen?{id:active.dataset.pwOpen,pos:active.dataset.pwAtpos,cls:active.className}:null;
      var filterButton=host.querySelector('[data-pw-action="filters"]'),filterCount=Number(!!s.pos)+Number(!!s.status)+Number(!!s.unevaluated);
      if(filterButton){filterButton.textContent='필터'+(filterCount?' '+filterCount:'');filterButton.classList.toggle('is-filtered',filterCount>0);}
      host.querySelector('.pw-result').innerHTML='<span><b>'+rows.length+'</b>명 표시 <span class="pw-muted">/ 전체 '+models[kind].length+'명</span></span>'+((s.q||s.pos||s.status||s.unevaluated||(kind==='team'&&(tmGrpFilter||tmSchoolYearFilter||tmUnlinkedOnly)))?button('필터 초기화','data-pw-action="reset"'):'')+'<small>'+(s.groupEdit?'선수 이름을 누르면 조 변경':'선수 이름을 누르면 상세')+(kind==='team'?' · 체크해서 비교 · 조 바꾸기 · 빼기':' · 최대 3명 비교')+'</small>';
      if(s.view==='edit'){content.innerHTML='<p class="pw-empty">아래에서 기존 배치·명단 편집 도구를 사용할 수 있어요.</p>';}
      else if((kind==='team'&&el('teamView').classList.contains('tm-waiting'))||(kind==='scout'&&!scoutReady())){content.innerHTML='<div class="pw-empty"><strong>명단을 불러오는 중이에요</strong><p>자료를 확인하면 여기에 표시합니다.</p></div>';}
      else if(s.view==='depth'&&!(kind==='team'&&el('teamView').classList.contains('tm-waiting'))&&(kind!=='scout'||scoutReady())){depths[kind]=depthModel(kind);var depthMarkup=depthHTML(kind,depths[kind]);
        // Sync acknowledgements can redraw an unchanged roster while a user is
        // scrolling or returning from a picker. Keep those interactive rows.
        if(content._pwDepthMarkup!==depthMarkup||content._pwDepthRoot!==content.firstElementChild){content.innerHTML=depthMarkup;content._pwDepthMarkup=depthMarkup;content._pwDepthRoot=content.firstElementChild;}
        host.querySelector('.pw-result b').textContent=depths[kind].shown;}
      else if(!rows.length){var waiting=kind==='team'&&el('teamView').classList.contains('tm-waiting');try{if(kind==='scout')scStore().check();}catch(_){waiting=true;}
        content.innerHTML='<div class="pw-empty"><strong>'+(waiting?'명단을 불러오는 중이에요':models[kind].length?'조건에 맞는 선수가 없어요':'아직 등록된 '+(kind==='team'?'선수':'후보')+'가 없어요')+'</strong><p>'+(waiting?'자료를 확인하면 여기에 표시합니다.':models[kind].length?'검색어나 필터를 바꿔 보세요.':'이름과 포지션부터 등록해 보세요.')+'</p>'+(!waiting?button(models[kind].length?'필터 초기화':'＋ '+(kind==='team'?'선수':'후보')+' 등록','data-pw-action="'+(models[kind].length?'reset':'add')+'"'):'')+'</div>';
      }else{
        var fresh=kind==='team'&&s.fresh||[];if(fresh.length)rows=rows.filter(function(r){return fresh.indexOf(r.id)>=0;}).sort(function(a,b){return fresh.indexOf(a.id)-fresh.indexOf(b.id);}).concat(rows.filter(function(r){return fresh.indexOf(r.id)<0;}));
        var allOn=kind==='team'&&rows.length>0&&rows.every(function(r){return s.selected.indexOf(r.id)>=0;});
        content.innerHTML='<div class="pw-table-wrap"><table class="pw-table"><thead><tr><th>'+(kind==='team'?'<label class="pw-select-hit"><input type="checkbox" data-pw-selectall aria-label="보이는 선수 모두 선택"'+(allOn?' checked':'')+'></label>':'<span class="pw-sr">비교 선택</span>')+'</th><th>선수</th><th>'+(kind==='team'?'팀 · 학년':'소속')+'</th><th>'+(kind==='team'?'상태':'영입 단계')+'</th><th>'+(kind==='team'?'평가':'등급 · 평가 기록')+'</th><th>'+(kind==='team'?'IDP':'관찰 메모')+'</th></tr></thead><tbody>'+rows.map(function(r){var cls=[s.selected.indexOf(r.id)>=0?'is-selected':'',fresh.indexOf(r.id)>=0?'is-fresh':''].filter(Boolean).join(' ');return '<tr'+(cls?' class="'+cls+'"':'')+'><td><label class="pw-select-hit"><input type="checkbox" data-pw-select="'+esc(r.id)+'" aria-label="'+esc(r.name)+(kind==='team'?' 선택':' 비교 선택')+'"'+(s.selected.indexOf(r.id)>=0?' checked':'')+'></label></td><td>'+button(nameCell(r,kind),'data-pw-open="'+esc(r.id)+'"','pw-name')+(r.grad?'<span class="pw-grad-tag">'+esc(r.grad)+' 졸업</span>':'')+(fresh.indexOf(r.id)>=0?'<span class="pw-fresh-tag">'+FRESH_LABEL+'</span>'+(r.p&&r.p.joinedFrom&&r.p.joinedFrom.cid?'<span class="pw-fresh-tag pw-from-scout">스카우팅에서</span>':''):'')+'</td><td>'+esc(kind==='team'?r.group||'미배정':r.club||'—')+(kind==='team'&&r.year?'<small>'+esc(r.year)+'학년</small>':'')+'</td><td><span class="pw-status '+(r.statusKey==='injury'?'pw-bad':r.statusKey==='rehab'||r.statusKey==='go'?'pw-warn':r.statusKey==='ok'?'pw-ok':'')+'">'+esc(r.status)+'</span></td><td>'+(kind==='scout'?'<span class="pw-grade">'+esc(r.grade?'등급 '+r.grade:'등급 미정')+'</span>':'')+'<small class="'+(r.evaluated?'':'pw-muted')+'">'+score(r,kind)+'</small></td><td><small>'+esc(kind==='team'?(r.linked?'연결됨':'미연결'):(r.notes.length?r.notes.length+'개':'기록 없음'))+'</small></td></tr>';}).join('')+'</tbody></table></div>';
      }
      var bar=host.querySelector('.pw-comparebar');bar.hidden=!s.selected.length;
      if(kind==='team')bar.innerHTML=selectionBar(s);
      else bar.innerHTML='<span><b>'+s.selected.length+'명 선택</b> · '+s.selected.map(function(id){var r=models[kind].find(function(r){return r.id===id;});return esc(r.name);}).join(', ')+'</span>'+button('선택 해제','data-pw-action="clear"')+button('선수 비교','data-pw-action="compare"'+(s.selected.length<2?' disabled':''),'pw-primary');
      if(kind==='team')paintQuick();
      if(focusedPlayer&&doc.activeElement!==active){var next=Array.from(content.querySelectorAll('[data-pw-open]')).find(function(b){return b.dataset.pwOpen===focusedPlayer.id&&b.dataset.pwAtpos===focusedPlayer.pos&&b.className===focusedPlayer.cls;});if(next)next.focus({preventScroll:true});}
    }
    function modal(){if(dialog)return dialog;dialog=doc.createElement('dialog');dialog.id='pwDrawer';dialog.className='pw-dialog';dialog.setAttribute('aria-labelledby','pwDetailTitle');doc.body.appendChild(dialog);dialog.addEventListener('close',function(){detail=null;dialog.innerHTML='';if(lastFocus&&lastFocus.isConnected)lastFocus.focus();});dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}var b=e.target.closest('button');if(!b)return;var d=b.dataset;if(d.pwClose!==undefined)close();if(d.pwTab&&detail){detail.tab=d.pwTab;drawDetail();dialog.querySelector('[data-pw-tab="'+d.pwTab+'"]').focus();}if(d.pwEdit&&detail){e.stopPropagation();editDetail(d.pwEdit);}});dialog.addEventListener('keydown',function(e){if(!detail||!e.target.dataset.pwTab)return;var tabs=['summary','evaluation','notes','idp'],i=tabs.indexOf(detail.tab);if(e.key==='ArrowRight')i=(i+1)%tabs.length;else if(e.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=3;else return;e.preventDefault();detail.tab=tabs[i];drawDetail();dialog.querySelector('[data-pw-tab="'+detail.tab+'"]').focus();});return dialog;}
    function close(){if(dialog&&dialog.open)dialog.close();}
    function show(){lastFocus=doc.activeElement;modal().showModal();dialog.querySelector('[data-pw-close]').focus();}
    function detailRow(){var r=models[detail.kind].find(function(x){return x.id===detail.id;});if(!r||!detail.positionId)return r;var board=depthModel(detail.kind),card=board.cards.concat([board.unplaced]).find(function(c){return c.id===detail.positionId;});var placed=card&&card.all.find(function(x){return x.id===detail.id;});return placed?Object.assign({},placed,{positions:r.positions}):r;}
    function open(kind,id,tab,positionId){var r=models[kind].find(function(x){return x.id===id;});if(!r)return;detail={kind:kind,id:id,tab:tab,positionId:positionId};var placed=detailRow();detail.position=positionId?placed.pos:(r.positions||[]).find(function(p){return family(p)===states[kind].pos;})||r.pos;modal();drawDetail();show();}
    function facts(r,kind){return [['포지션',(r.positions&&r.positions.length?r.positions.join(' / '):r.pos)||'미지정'],[kind==='team'?'소속 팀':'출신 팀',kind==='team'?r.group:r.club],['주발',({L:'왼발',R:'오른발',B:'양발'})[r.foot]||r.foot],['신체',[r.profile.height&&r.profile.height+'cm',r.profile.weight&&r.profile.weight+'kg'].filter(Boolean).join(' · ')],['생년월일',r.profile.dob],['학년',r.year&&r.year+'학년']];}
    function infoCard(title,text){return '<section class="pw-info"><h3>'+esc(title)+'</h3><p>'+esc(text||'아직 기록이 없어요.')+'</p></section>';}
    function drawDetail(){var r=detailRow();if(!r){close();return;}var kind=detail.kind,tab=detail.tab;
      dialog.classList.remove('pw-comparison');dialog.innerHTML='<header class="pw-dialoghead"><span>'+esc(kind==='team'?'선수 상세':'후보 상세')+'</span>'+button('닫기','data-pw-close aria-label="선수 상세 닫기"')+'</header><div class="pw-profilehead">'+avatar(r)+'<div><h2 id="pwDetailTitle">'+esc(r.name)+'</h2><p>'+esc([r.pos||'포지션 미지정',kind==='team'?r.group:r.club,r.num&&'#'+r.num].filter(Boolean).join(' · '))+'</p></div>'+button('프로필 수정','data-pw-edit="profile"')+'</div><nav class="pw-tabs" role="tablist" aria-label="선수 상세 항목">'+[['summary','요약'],['evaluation','평가'],['notes','관찰 기록'],['idp','IDP']].map(function(x){return '<button type="button" role="tab" id="pwTab-'+x[0]+'" aria-selected="'+(x[0]===tab)+'" tabindex="'+(x[0]===tab?'0':'-1')+'" aria-controls="pwDetailBody" data-pw-tab="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</nav><div class="pw-detailbody" id="pwDetailBody" role="tabpanel" aria-labelledby="pwTab-'+tab+'"></div>';
      var body=el('pwDetailBody');
      if(tab==='summary')body.innerHTML='<div class="pw-detailstatus"><span class="pw-status">'+esc(r.status)+'</span><span>'+esc(kind==='scout'?(r.grade?'등급 '+r.grade:'등급 미정'):(r.linked?'IDP 연결됨':'IDP 미연결'))+'</span></div><dl class="pw-facts">'+facts(r,kind).map(function(f){return '<div><dt>'+esc(f[0])+'</dt><dd>'+esc(f[1]||'—')+'</dd></div>';}).join('')+'</dl>'+infoCard('강점',r.profile.strengths)+infoCard('성장 과제',r.profile.develop)+infoCard('코치 메모',r.notes.join('\n'))+(r.placementLabels&&r.placementLabels.length>1?infoCard('포지션별 배치 기록',r.placementLabels.join('\n')):'');
      if(tab==='evaluation'){
        body.innerHTML=infoCard(kind==='scout'?'영입 판단과 평가 기록': '팀 평가',kind==='scout'?'등급은 영입 판단, 포인트는 질문별 관찰 기록입니다. 각각 따로 기록합니다.':score(r,kind))+button('팀 평가표 열기','data-pw-edit="evaluation"','pw-primary');
        if(kind==='scout'){body.innerHTML+='<h3>스카우팅 포인트 · '+esc(detail.position||'포지션 선택 필요')+'</h3>'+((r.positions||[]).length>1?'<label>평가 포지션 <select class="pw-evalpos" aria-label="평가 포지션">'+opts(r.positions.map(function(p){return [p,p];}),detail.position)+'</select></label>':'')+'<iframe title="후보 스카우팅 포인트 평가" src="scouting.html?view=evaluate&amp;candidate='+encodeURIComponent(r.cid)+'&amp;position='+encodeURIComponent(detail.position)+'"></iframe>';var pick=body.querySelector('.pw-evalpos');if(pick)pick.onchange=function(){detail.position=pick.value;drawDetail();};}
        else if(r.evaluated){body.innerHTML+='<dl class="pw-scores">'+scored(r.levels).map(function(k){var a=source().attrs.find(function(a){return a.id===k;});return '<div><dt>'+esc(a?a.name:k)+'</dt><dd>'+esc(r.levels[k])+' / 5</dd></div>';}).join('')+'</dl>';}
      }
      if(tab==='notes')body.innerHTML=infoCard('코치 관찰 메모',r.notes.join('\n'))+((r.candidate&&r.candidate.source&&Array.isArray(r.candidate.source.obs)&&r.candidate.source.obs.length)?infoCard('이전 관찰 기록',r.candidate.source.obs.map(function(o){return [o.d,o.t].filter(Boolean).join(' · ');}).join('\n\n')):'')+button('메모 편집','data-pw-edit="notes"','pw-primary')+(kind==='team'?infoCard('선수가 공유한 기록','일지·회고·경기 리뷰를 한눈에 확인합니다.')+button('선수 기록 한눈에','data-pw-edit="records"'):'');
      if(tab==='idp')body.innerHTML=infoCard(kind==='team'?'개인 성장 계획':'선수단 합류 후 연결',kind==='scout'?'후보의 관찰과 평가는 스카우팅에 기록합니다. 선수단 합류 후 선수 계정과 IDP를 연결할 수 있어요.':r.linked?'선수가 공유한 프로필과 자기평가, 성장 목표를 확인합니다.':'아직 선수 계정과 연결되지 않았어요. 계정을 연결하면 성장 기록을 함께 볼 수 있어요.')+(kind==='team'?button(r.linked?'IDP 열기':'계정 연결','data-pw-edit="idp"','pw-primary'):'');
    }
    /* 3.273 — 이름을 누르면 «선수 상세» 요약을 거치지 않고 프로필을 바로 연다(사용자 «누르면 프로필이 바로 보이게 · 선수단도 마찬가지»).
       여는 길은 예전 «프로필 수정»과 같다(openPlayer · scOpenCandidate). 못 열면 예전 상세로 */
    function detailLabel(r){return r.name+' 평가 · 기록 보기';}
    function openProfile(kind,id,positionId){var r=models[kind].find(function(x){return x.id===id;});if(!r)return;
      try{if(kind==='scout'&&!r.pid&&typeof scOpenCandidate==='function'){scOpenCandidate(r.cid);return;}if(r.pid&&typeof openPlayer==='function'){openPlayer(r.pid);return;}}catch(_){}
      open(kind,id,'summary',positionId);}
    function editDetail(action){var r=detailRow();if(!r)return;var kind=detail.kind;close();
      if(action==='records'){plSheetOpen(r.pid);return;}
      if(action==='idp'){if(r.link)win.parent.postMessage({source:'scout',type:'goApp',app:'idp',idpKey:'cs_idp_v1_'+r.link.uid,idpName:r.name},'*');else if(ilCan())ilPickAccount(r.p);else toast('임원이 선수 계정을 연결할 수 있어요.');return;}
      if(kind==='scout'&&action==='notes'&&r.pid){states.scout.view='edit';renderScoutCands();var notes=Array.from(doc.querySelectorAll('[data-scnotes]')).find(function(n){return n.dataset.scnotes===r.pid;});if(notes){notes.open=true;notes.scrollIntoView({block:'center'});var input=notes.querySelector('input,button');if(input)input.focus();return;}}
      if(kind==='scout'&&!r.pid)scOpenCandidate(r.cid);else openPlayer(r.pid);
      if(action==='evaluation'||action==='notes'){var target=el(action==='evaluation'?'plLevels':'plMemo');if(target){target.scrollIntoView({block:'start'});if(action==='notes')target.focus();}}
    }
    /* ══ 3.339 · 명단 표에서 바로(사용자 11/20 «명단 선수추가 · 선수 삭제 쉽게 · 스카우팅에 있는 선수단 불러오기» → 목업 A안) ══
       ① 표 위 «＋ 번호 · 이름 · 포지션 · 조» 한 줄 — Enter 로 넣고 이름 칸에 남아 다음 선수 ② 체크 칸은 몇 명이든 · 아래 띠 «비교(2~3명) · 조 바꾸기 · 명단에서 빼기»
       ③ «스카우팅에서 불러오기» 창 — 후보를 골라 새 선수로(후보 · 평가 기록은 스카우팅에 그대로, joinedFrom.cid 로 다시 불러오기를 막는다).
       저장 길은 원래 것: 넣기 = data.players.push → save({skipTargets}) — 후보 문서는 손대지 않으니 쓰지도 않는다 · 빼기 = 선수 삭제(#plDelete)와 같은 plTombAdd → splice → save({deletedIds,skipTargets}) · 조 = pickGroup 과 같은 grpPickOpen → save({skipTargets}).
       권한은 groupAllowed(운영진 · 선수단 잠금 · 보기 전용 · 복구 확인)와 teamSaveOwner(창을 연 뒤 팀이 바뀌면 멈춘다). */
    function scoutVisible(){try{return typeof win.canSeeTargets!=='function'||!!win.canSeeTargets();}catch(e){return false;}}
    function teamGroups(){var list=[''];try{list=win.tmGrpCycle();}catch(e){list=[''];}return list.map(function(g){g=String(g||'').trim();return {v:g,lb:g?(group({grp:g})||g):'조 없음'};});}
    function quickGroup(){var g='';try{g=String(typeof tmGrpFilter!=='undefined'&&tmGrpFilter||'').trim();}catch(e){g='';}return teamGroups().some(function(x){return x.v===g;})?g:'';}
    function paintQuick(){var host=el('pwTeam'),box=host&&host.querySelector('.pw-quickadd');if(!box)return;var s=states.team;
      var on=s.scope==='cur'&&s.view==='list'&&!el('teamView').classList.contains('tm-waiting')&&groupAllowed(true);box.hidden=!on;if(!on)return;
      var f=box.querySelector('form'),groups=teamGroups(),sig=JSON.stringify([source().positions.map(function(p){return [p.id,p.name];}),groups]);
      if(f&&(f._sig===sig||f.contains(doc.activeElement)||f.elements.name.value))return;   /* 치는 중 · 친 글이 있으면 다시 그리지 않는다(한글 조합) */
      var keep=f?{pos:f.elements.pos.value,grp:f.elements.grp.value}:{pos:'',grp:quickGroup()};
      box.innerHTML='<form class="pw-qa" data-pw-qa autocomplete="off" aria-label="새 선수 바로 넣기"><span class="pw-qa-plus" aria-hidden="true">＋</span><input name="num" inputmode="numeric" maxlength="3" placeholder="번호" aria-label="새 선수 등번호"><input name="name" maxlength="20" placeholder="이름 치고 Enter" aria-label="새 선수 이름"><select name="pos" aria-label="새 선수 포지션"><option value="">포지션</option>'+source().positions.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>';}).join('')+'</select><select name="grp" aria-label="새 선수 조">'+groups.map(function(g){return '<option value="'+esc(g.v)+'">'+esc(g.lb)+'</option>';}).join('')+'</select>'+'<button type="submit" class="pw-button pw-primary">넣기</button></form>';
      f=box.querySelector('form');f._sig=sig;f.elements.pos.value=keep.pos;f.elements.grp.value=groups.some(function(g){return g.v===keep.grp;})?keep.grp:'';
    }
    function markFresh(ids){states.team.fresh=ids.concat((states.team.fresh||[]).filter(function(id){return ids.indexOf(id)<0;})).slice(0,12);}
    function quickAdd(f){if(!groupAllowed())return;var name=String(f.elements.name.value||'').trim().slice(0,20),num=String(f.elements.num.value||'').replace(/\D/g,'').slice(0,3);
      if(!name){f.elements.name.focus();return;}
      var d=source(),grp=String(f.elements.grp.value||'').trim();
      if(d.players.some(function(p){return p.type!=='target'&&norm(p.name)===norm(name)&&String(p.num||'')===num;})){toast(name+(num?' '+num+'번':'')+'은 이미 명단에 있어요');f.elements.name.select();return;}
      var p={id:uid('pl'),name:name,num:num,foot:'',type:'ours',posId:f.elements.pos.value||'',levels:{},memo:'',manual:true};if(grp)p.grp=grp;
      d.players.push(p);var ok=win.save({skipTargets:true});markFresh([p.id]);f.elements.name.value='';f.elements.num.value='';
      win.renderTeam();var again=el('pwTeam').querySelector('[data-pw-qa] [name="name"]');if(again)again.focus({preventScroll:true});
      toast(ok===false?win.TM_ADD_FAIL:name+' 추가됨');
    }
    function selectedPlayers(){var d=source();return states.team.selected.map(function(id){return d.players.find(function(p){return p.id===id&&p.type!=='target';});}).filter(Boolean);}
    function selectionBar(s){var n=s.selected.length,names=s.selected.map(function(id){var r=models.team.find(function(x){return x.id===id;});return r?r.name:'';}).filter(Boolean),edit=groupAllowed(true);
      var head='<span><b>'+n+'명 선택</b> · '+esc(names.slice(0,3).join(', '))+(names.length>3?' 외 '+(names.length-3)+'명':'')+'</span>'+button('선택 해제','data-pw-action="clear"');
      if(s.scope==='grad')return head+(edit?button('현재 명단으로','data-pw-action="ungrad"','pw-primary')+button('명단에서 빼기','data-pw-action="remove"','pw-danger'):'');
      return head+button(n>3?'비교는 3명까지':'선수 비교','data-pw-action="compare"'+(n<2||n>3?' disabled':''),edit?'':'pw-primary')
        +(edit?button('조 바꾸기','data-pw-action="regroup"')+(SEASON?button('졸업 처리','data-pw-action="graduate"'):'')+button('명단에서 빼기','data-pw-action="remove"','pw-danger'):'');}
    /* 동기화가 끝나면 선수단 화면은 data 를 새 객체로 바꿔 끼운다 — 같은 객체인지가 아니라 같은 선수(id) · 같은 값인지로 다시 본다 */
    function sameNow(sig,key){var cur=source(),now=Object.keys(sig).map(function(id){return cur.players.find(function(p){return String(p.id)===id&&p.type!=='target';});});
      return now.every(function(p){return p&&key(p)===sig[String(p.id)];})?now:null;}
    function regroup(anchor){if(!groupAllowed())return;var list=selectedPlayers(),owner=win.teamSaveOwner(),sig={},key=function(p){return String(p.grp||'').trim();};if(!list.length)return;
      list.forEach(function(p){sig[String(p.id)]=key(p);});
      closeGroupPicker();var groups=teamGroups();win.psPickOpen(anchor,groups.map(function(g){return {v:g.v,lb:g.lb,col:null};}),'',function(value){
        var now=groupAllowed()&&owner===win.teamSaveOwner()&&sameNow(sig,key);if(!now){toast('명단이 바뀌었어요. 선수를 다시 골라 주세요');refresh('team');return;}
        var to=String(value||'').trim();if(teamGroups().every(function(g){return g.v!==to;})){toast('조가 바뀌었어요. 다시 골라 주세요');return;}
        now.forEach(function(p){p.grp=to;});var ok=win.save({skipTargets:true});win.renderTeam();
        toast(ok===false?'조를 바꿨지만 저장 확인이 필요해요':now.length+'명 → '+(to?group({grp:to})||to:'조 없음'));
      },'조 고르기',{title:list.length+'명 · 조 바꾸기'});
    }
    function removeSelected(){if(!groupAllowed())return;var list=selectedPlayers(),owner=win.teamSaveOwner(),sig={},key=function(p){return [p.name||'',p.num||''].join('|');};if(!list.length)return;
      list.forEach(function(p){sig[String(p.id)]=key(p);});
      var names=list.map(function(p){return (p.name||'이름 없음')+(p.num?' '+p.num+'번':'');}),who=names.slice(0,8).join(' · ')+(names.length>8?' 외 '+(names.length-8)+'명':'');
      win.psConfirm(list.length+'명을 명단에서 삭제할까요?\n'+who+'\n평가 기록도 함께 지워져요.',function(){
        var now=groupAllowed()&&owner===win.teamSaveOwner()&&sameNow(sig,key);if(!now){toast('명단이 바뀌었어요. 선수를 다시 골라 주세요');refresh('team');return;}
        var d=source(),gone=[];for(var i=0;i<now.length;i++){var p=now[i],at=d.players.indexOf(p);if(at<0)continue;
          if(!win.plTombAdd(p.id)){toast(gone.length?gone.length+'명을 지웠어요 · 나머지는 삭제 기록을 남기지 못해 그대로 두었어요':'삭제 기록을 남기지 못해 명단을 그대로 두었어요 · 자료 확인에서 확인해 주세요');break;}
          d.players.splice(at,1);gone.push(String(p.id));}
        if(!gone.length)return;
        states.team.selected=[];states.team.fresh=(states.team.fresh||[]).filter(function(id){return gone.indexOf(String(id))<0;});
        var ok=win.save({deletedIds:gone,skipTargets:true});
        ['renderTeam','renderScoutCands','renderScoutBoard','redrawTeamPitch'].forEach(function(k){try{if(typeof win[k]==='function')win[k]();}catch(e){win.console.warn('[roster-remove] '+k,e);}});
        toast(ok?gone.length+'명을 명단에서 지웠어요 · 팀 반영은 동기화 상태에서 확인할 수 있어요':'삭제 저장 확인이 필요합니다 · 자료 확인에서 확인하세요');
      });
    }
    /* ══ 시즌별 선수단(사용자 11/21 «3학년들 졸업으로 체크해서 남기게» → «시즌별로 선수구성» → 목업 C안) ══
       셈은 roster-season.js(PSRosterSeason). 졸업 = 선수의 grad 표시 하나 — 명단에서 지우지도 옮기지도 않는다(삭제 기록 · 선수별 행 그대로).
       ① 표 위 시즌 칩(지금 시즌 · 지난 시즌 · 졸업생 전체 · «새 시즌 시작…») ② «새 시즌 시작» 창: 3학년 → 졸업 · 2 · 1학년 → 한 학년 위, 이름을 끄면 그대로
       ③ 지난 시즌은 그날의 줄(meta.season.past)을 보기 전용으로 ④ 선택 띠 «졸업 처리»(시즌 중 한 명) · 졸업생 보기의 «현재 명단으로».
       저장은 원래 길 save({skipTargets}) — 바뀐 선수만 선수별 행으로 나간다. 되돌리기는 선수 id 로(동기화가 data 를 바꿔 끼워도 된다). */
    var SEASON=win.PSRosterSeason||null,activeRows=[],seasonDlg=null;
    function seasonScopes(){var d=source();return SEASON?SEASON.scopes(d.players,d.meta):[{id:'cur',season:'',label:'',n:0,now:true}];}
    function pastScope(){return String(states.team.scope).indexOf('past:')===0;}
    function teamModel(){var s=states.team,all=source().players.filter(function(p){return p.type!=='target'&&(p.manual||String(p.name||'').trim());});
      if(!seasonScopes().some(function(x){return x.id===s.scope;}))s.scope='cur';
      activeRows=all.filter(function(p){return !p.grad;}).map(row);
      return s.scope==='grad'?all.filter(function(p){return !!p.grad;}).map(row):activeRows;}
    function rerenderTeam(){['renderTeam','redrawTeamPitch'].forEach(function(k){try{if(typeof win[k]==='function')win[k]();}catch(e){win.console.warn('[roster-season] '+k,e);}});}
    function paintSeason(host){var top=host.querySelector('.pw-top'),s=states.team;host.classList.toggle('pw-scope-past',pastScope());if(!SEASON){top.innerHTML='';return;}
      var sc=seasonScopes(),cur=sc.filter(function(x){return x.id===s.scope;})[0]||sc[0],can=groupAllowed(true);
      if(sc.length<2&&!can){top.innerHTML='';return;}
      top.innerHTML='<div class="pw-season">'+button(esc(cur.label)+' <span aria-hidden="true">▾</span>','data-pw-action="season" aria-haspopup="listbox" aria-label="시즌 고르기"','pw-season-chip')+'<span class="pw-season-n">'+cur.n+'명</span>'
        +(s.scope!=='cur'?'<span class="pw-season-note">'+(s.scope==='grad'?'졸업생 명단':'지난 시즌 명단 · 보기 전용')+'</span>'+button('지금 시즌으로','data-pw-action="seasonNow"'):'')+'</div>';}
    function setScope(v){var s=states.team;s.scope=v||'cur';s.selected=[];if(s.scope!=='cur'){s.view='list';s.viewInitialized=true;}refresh('team');var chip=el('pwTeam').querySelector('[data-pw-action="season"]');if(chip)chip.focus({preventScroll:true});}
    function seasonMenu(anchor){var sc=seasonScopes(),items=sc.map(function(x){return {v:x.id,lb:x.label+(x.now?' · 지금':'')+' · '+x.n+'명',col:null};});
      if(SEASON&&groupAllowed(true))items.push({v:'__start',lb:'↗ '+SEASON.next(sc[0].season)+' 시즌 시작…',col:null});
      closeGroupPicker();win.psPickOpen(anchor,items,states.team.scope,function(v){if(v==='__start'){seasonStart();return;}setScope(v);},'시즌 고르기',{title:'시즌'});}
    function pastOpen(id){var has=source().players.some(function(p){return String(p.id)===String(id)&&p.type!=='target';});if(has&&typeof win.openPlayer==='function')win.openPlayer(id);else toast('명단에서 뺀 선수예요');}
    function paintPast(host,content,s){var snap=SEASON&&SEASON.pastOf(source().meta,String(s.scope).slice(5)),all=snap?snap.rows:[],words=String(s.q||'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean),here={};
      var rows=all.filter(function(r){return words.every(function(w){return [r.name,r.num,r.pos,r.grp].join(' ').toLocaleLowerCase().indexOf(w)>=0;})&&(!s.pos||family(r.pos)===s.pos);});
      source().players.forEach(function(p){if(p.type!=='target')here[String(p.id)]=p;});
      host.querySelector('.pw-result').innerHTML='<span><b>'+rows.length+'</b>명 표시 <span class="pw-muted">/ 전체 '+all.length+'명</span></span><small>그날의 번호 · 조 · 학년 그대로 · 이름을 누르면 프로필</small>';
      content._pwDepthMarkup=null;
      content.innerHTML=rows.length?'<div class="pw-table-wrap"><table class="pw-table pw-past"><thead><tr><th>선수</th><th>팀 · 학년</th><th>다음 시즌</th></tr></thead><tbody>'+rows.map(function(r){var p=here[r.id],who='<span class="pw-person"><span class="pw-avatar" aria-hidden="true">'+esc(r.num||String(r.name).slice(0,1))+'</span><span><strong>'+esc(r.name||'이름 없음')+'</strong><small>'+esc(r.pos||'포지션 미지정')+'</small></span></span>';
        return '<tr'+(r.grad?' class="is-grad"':'')+'><td>'+(p?button(who,'data-pw-past="'+esc(r.id)+'"','pw-name'):who)+(r.grad?'<span class="pw-grad-tag">졸업</span>':'')+'</td><td>'+esc(r.grp?group({grp:r.grp})||r.grp:'미배정')+(r.year?'<small>'+esc(r.year)+'학년</small>':'')+'</td><td><small>'+(r.grad?'졸업':p?(p.grad?'졸업':'이어짐'):'명단에서 뺌')+'</small></td></tr>';}).join('')+'</tbody></table></div>'
        :'<div class="pw-empty"><strong>'+(all.length?'조건에 맞는 선수가 없어요':'이 시즌에 적힌 선수가 없어요')+'</strong></div>';
      host.querySelector('.pw-comparebar').hidden=true;var q=host.querySelector('.pw-quickadd');if(q)q.hidden=true;}
    function graduateSelected(){if(!SEASON||!groupAllowed())return;var list=selectedPlayers().filter(function(p){return !p.grad;}),owner=win.teamSaveOwner(),sig={},key=function(p){return [p.name||'',p.num||'',p.grad?1:0].join('|');};if(!list.length)return;
      list.forEach(function(p){sig[String(p.id)]=key(p);});
      var names=list.map(function(p){return p.name||'이름 없음';}),who=names.slice(0,8).join(' · ')+(names.length>8?' 외 '+(names.length-8)+'명':'');
      win.psConfirm(list.length+'명을 졸업 처리할까요?\n'+who+'\n프로필 · 평가 · 기록은 그대로 남아요. 가용인원 · 작전판 불러오기는 현재 선수만 보여요.',function(){
        var now=groupAllowed()&&owner===win.teamSaveOwner()&&sameNow(sig,key);if(!now){toast('명단이 바뀌었어요. 선수를 다시 골라 주세요');refresh('team');return;}
        var ids=SEASON.graduate(source(),now.map(function(p){return p.id;}));if(!ids.length)return;states.team.selected=[];
        var ok=win.save({skipTargets:true});rerenderTeam();
        showUndo('<b>'+ids.length+'명</b> 졸업 처리 · 시즌 칩의 «졸업생 전체»에서 봐요'+(ok===false?' · 저장 확인이 필요해요':''),function(){if(!groupAllowed()||owner!==win.teamSaveOwner())return;SEASON.restore(source(),ids);win.save({skipTargets:true});rerenderTeam();},12000);
      });
    }
    function restoreSelected(){if(!SEASON||!groupAllowed())return;var ids=SEASON.restore(source(),selectedPlayers().map(function(p){return p.id;}));if(!ids.length)return;states.team.selected=[];
      var ok=win.save({skipTargets:true});rerenderTeam();toast(ok===false?'현재 명단으로 돌렸지만 저장 확인이 필요해요':ids.length+'명을 현재 명단으로 돌렸어요');}
    function seasonStart(){if(!SEASON||!groupAllowed())return;var owner=win.teamSaveOwner(),st={keep:{},years:{}};
      if(seasonDlg)seasonDlg.remove();var dlg=seasonDlg=doc.createElement('dialog');dlg.id='pwSeason';dlg.className='pw-dialog pw-import';dlg.setAttribute('aria-labelledby','pwSeasonTitle');doc.body.appendChild(dlg);
      function calc(){var d=source();return SEASON.plan(d.players,d.meta,{keep:Object.keys(st.keep).filter(function(k){return st.keep[k];}),years:st.years});}
      function line(pl,y){var L=pl.by[y];if(!L.length)return '';var on=st.years[y]!==false,stay=L.filter(function(p){return st.keep[String(p.id)];}).length;
        return '<section class="pws-row'+(on?'':' is-off')+'"><label class="pws-head"><input type="checkbox" data-pws-year="'+y+'"'+(on?' checked':'')+' aria-label="'+y+'학년 넘기기"><span class="pws-who"><strong>'+y+'학년 '+L.length+'명</strong><small>'+(!on?'그대로 둬요':stay?stay+'명은 '+y+'학년 그대로':y==='3'?'기록과 함께 졸업생으로 남아요':'한 학년 위로')+'</small></span><span class="pws-to'+(on&&y==='3'?' is-grad':'')+'">'+(!on?'그대로':y==='3'?'→ 졸업':'→ '+(+y+1)+'학년')+'</span></label>'
          +(on?'<div class="pws-names" role="group" aria-label="'+y+'학년 선수">'+L.map(function(p){var k=!!st.keep[String(p.id)];return button(esc(p.name||'이름 없음'),'data-pws-keep="'+esc(p.id)+'" aria-pressed="'+!k+'"',k?'':'is-on');}).join('')+'</div>':'')+'</section>';}
      function draw(){var pl=calc(),none=pl.by[''].length,body=dlg.querySelector('.pw-detailbody'),top=body?body.scrollTop:0;
        dlg.innerHTML='<header class="pw-dialoghead"><h2 id="pwSeasonTitle">'+pl.next+' 시즌 시작</h2>'+button('닫기','data-pws-close')+'</header><div class="pw-detailbody"><p class="pw-muted pwi-lead">'+pl.cur+' 시즌 '+pl.total+'명에서 이어 가요. 이름을 눌러 끄면 그 선수는 지금 학년에 남아요.</p>'
          +(pl.by['3'].length+pl.by['2'].length+pl.by['1'].length?['3','2','1'].map(function(y){return line(pl,y);}).join(''):'<p class="pw-muted pwi-empty">학년을 적은 선수가 아직 없어요. 선수 프로필에 학년을 적으면 졸업과 진급을 한 번에 넘겨요.</p>')
          +(none?'<p class="pw-muted pws-none">학년 없음 '+none+'명은 그대로 둬요.</p>':'')+'</div>'
          +'<footer class="pwi-foot"><span data-pws-sum><b>'+pl.next+' 시즌 '+pl.after+'명</b> <span>· 졸업 '+pl.grad.length+'명 · '+pl.cur+' 시즌 명단은 그대로 남아요</span></span><p class="pwi-err" role="alert" data-pws-err></p>'+button('취소','data-pws-close')+button(pl.next+' 시즌 시작','data-pws-ok','pw-primary')+'</footer>';
        body=dlg.querySelector('.pw-detailbody');if(body)body.scrollTop=top;}
      function commit(){var err=dlg.querySelector('[data-pws-err]');
        if(!groupAllowed(true)||owner!==win.teamSaveOwner()){err.textContent='팀 또는 편집 권한이 바뀌었어요. 창을 다시 열어 주세요.';return;}
        var pl=calc(),undo=SEASON.apply(source(),pl,{posOf:position});if(!undo){err.textContent='명단이 그사이 바뀌었어요. 창을 다시 열어 주세요.';return;}
        var ok=win.save({skipTargets:true});dlg.close();states.team.selected=[];states.team.scope='cur';rerenderTeam();
        showUndo('<b>'+pl.next+' 시즌</b> 시작 · 졸업 '+pl.grad.length+'명 · 진급 '+pl.up.length+'명'+(ok===false?' · 저장 확인이 필요해요':''),function(){
          if(!groupAllowed()||owner!==win.teamSaveOwner())return;SEASON.revert(source(),undo);win.save({skipTargets:true});rerenderTeam();toast(pl.cur+' 시즌 명단으로 돌렸어요');},20000);
      }
      dlg.addEventListener('click',function(e){if(e.target===dlg){var b0=dlg.getBoundingClientRect();if(e.clientX<b0.left||e.clientX>b0.right||e.clientY<b0.top||e.clientY>b0.bottom)dlg.close();return;}
        var b=e.target.closest('button');if(!b)return;var x=b.dataset;
        if(x.pwsClose!==undefined){dlg.close();return;}
        if(x.pwsKeep!==undefined){var id=x.pwsKeep;st.keep[id]=!st.keep[id];draw();var again=Array.from(dlg.querySelectorAll('[data-pws-keep]')).find(function(n){return n.dataset.pwsKeep===id;});if(again)again.focus({preventScroll:true});return;}
        if(x.pwsOk!==undefined)commit();
      });
      dlg.addEventListener('change',function(e){var y=e.target.dataset&&e.target.dataset.pwsYear;if(y===undefined)return;st.years[y]=e.target.checked;draw();var again=dlg.querySelector('[data-pws-year="'+y+'"]');if(again)again.focus({preventScroll:true});});
      dlg.addEventListener('close',function(){var last=el('pwTeam')&&el('pwTeam').querySelector('[data-pw-action="season"]');dlg.remove();if(seasonDlg===dlg)seasonDlg=null;if(last)last.focus({preventScroll:true});});
      draw();dlg.showModal();var first=dlg.querySelector('[data-pws-ok]');if(first)first.focus({preventScroll:true});
    }
    var importDlg=null;
    function importScout(){if(!groupAllowed())return;if(!scoutVisible()){toast('스카우팅은 운영진만 볼 수 있어요');return;}
      var rows;try{scStore().check();rows=scoutRows();}catch(e){toast('스카우팅 자료를 확인하는 중이에요 · 잠시 뒤 다시 열어 주세요');return;}
      var owner=win.teamSaveOwner(),roster=source().players.filter(function(p){return p.type!=='target';});
      var items=rows.map(function(r){var k=r.statusKey;if(['done','go','rep'].indexOf(k)<0)k=['done','go','rep'].filter(function(x){return (r.placements||[]).some(function(pl){return pl.statusKey===x;});})[0]||'';return {r:r,key:k,hit:rosterMatch(roster,r)};}),groups=teamGroups();
      var st={stage:items.some(function(it){return it.key==='done';})?'done':'',q:'',pos:'',grp:quickGroup(),picked:{}},posList=[];
      items.forEach(function(it){(it.r.positions&&it.r.positions.length?it.r.positions:[it.r.pos]).forEach(function(v){if(v&&posList.indexOf(v)<0)posList.push(v);});});
      items.forEach(function(it){if(it.key==='done'&&!it.hit)st.picked[it.r.id]=true;});
      if(importDlg)importDlg.remove();var dlg=importDlg=doc.createElement('dialog');dlg.id='pwImport';dlg.className='pw-dialog pw-import';dlg.setAttribute('aria-labelledby','pwImportTitle');doc.body.appendChild(dlg);
      function shown(){var w=norm(st.q);return items.filter(function(it){return (!st.stage||it.key===st.stage)&&(!st.pos||(it.r.positions&&it.r.positions.length?it.r.positions:[it.r.pos]).indexOf(st.pos)>=0)&&(!w||norm([it.r.name,it.r.club,(it.r.positions||[]).join(' '),it.r.pos,it.r.num].join(' ')).indexOf(w)>=0);});}
      function picked(){return items.filter(function(it){return st.picked[it.r.id]&&it.hit!=='dup';});}
      function count(k){return items.filter(function(it){return !k||it.key===k;}).length;}
      function chips(){return [['done','확정'],['go','영입대상'],['rep','추천'],['','전체']].map(function(c){var n=count(c[0]);return (c[0]&&!n)?'':button(c[1]+' '+n,'data-pwi-stage="'+c[0]+'" aria-pressed="'+(st.stage===c[0])+'"',st.stage===c[0]?'is-on':'');}).join('');}
      function list(){var L=shown();return L.length?L.map(function(it){var r=it.r,dup=it.hit==='dup',meta=[(r.positions&&r.positions.length?r.positions.join(' / '):r.pos)||'포지션 미정',r.club||'소속 미입력',r.num!==''&&r.num!=null?'#'+r.num:''].filter(Boolean).join(' · ');
          return '<label class="pwi-row'+(dup?' is-dup':'')+'"><input type="checkbox" data-pwi-pick="'+esc(r.id)+'"'+(st.picked[r.id]&&!dup?' checked':'')+(dup?' disabled':'')+' aria-label="'+esc(r.name)+' 명단에 넣기"><span class="pwi-who"><strong>'+esc(r.name)+'</strong><small>'+esc(meta)+(dup?' · 이미 명단에 있어요':it.hit==='same'?' · 같은 이름이 명단에 있어요':'')+'</small></span><span class="pw-status pw-status-'+esc(it.key)+'">'+esc(r.status||'')+'</span></label>';}).join(''):'<p class="pw-muted pwi-empty">'+(items.length?'조건에 맞는 후보가 없어요':'스카우팅에 등록한 후보가 없어요')+'</p>';}
      function foot(){var n=picked().length,skip=items.filter(function(it){return st.picked[it.r.id]&&it.hit==='dup';}).length;
        dlg.querySelector('[data-pwi-sum]').innerHTML='<b>'+n+'명 선택</b>'+(skip?' <span>· '+skip+'명은 이미 명단에 있어 건너뜀</span>':'');var ok=dlg.querySelector('[data-pwi-ok]');ok.textContent=n?n+'명 명단에 넣기':'명단에 넣기';ok.disabled=!n;}
      function paintList(){dlg.querySelector('.pwi-list').innerHTML=list();foot();}
      function draw(){dlg.innerHTML='<header class="pw-dialoghead"><h2 id="pwImportTitle">스카우팅에서 불러오기</h2>'+button('닫기','data-pwi-close')+'</header><div class="pw-detailbody"><p class="pw-muted pwi-lead">고른 후보를 우리 팀 명단에 새 선수로 넣어요. 이름 · 포지션 · 등번호 · 주발 · 소속팀 · 프로필을 옮기고, 후보와 그 평가 기록은 스카우팅에 그대로 남아요.</p>'
          +'<div class="pwi-chips" role="group" aria-label="영입 단계">'+chips()+'</div><div class="pwi-find">'+(posList.length>1?'<select data-pwi-pos aria-label="포지션"><option value="">모든 포지션</option>'+posList.map(function(v){return '<option'+(st.pos===v?' selected':'')+'>'+esc(v)+'</option>';}).join('')+'</select>':'')+'<label class="pw-search pwi-search"><span aria-hidden="true">⌕</span><input data-pwi-q type="search" aria-label="후보 검색" placeholder="이름 · 소속 · 포지션" value="'+esc(st.q)+'"></label></div>'
          +'<div class="pwi-bulk">'+button('모두','data-pwi-all="1"')+button('없음','data-pwi-all="0"')+'</div><div class="pwi-list">'+list()+'</div>'
          +'<div class="pwi-grp" role="group" aria-label="넣을 조"><span>넣을 조</span>'+groups.map(function(g){return button(g.lb,'data-pwi-grp="'+esc(g.v)+'" aria-pressed="'+(st.grp===g.v)+'"',st.grp===g.v?'is-on':'');}).join('')+'</div></div>'
          +'<footer class="pwi-foot"><span data-pwi-sum></span><p class="pwi-err" role="alert" data-pwi-err></p>'+button('취소','data-pwi-close')+button('명단에 넣기','data-pwi-ok','pw-primary')+'</footer>';foot();}
      function commit(){var err=dlg.querySelector('[data-pwi-err]');
        if(!groupAllowed(true)||owner!==win.teamSaveOwner()){err.textContent='팀 또는 편집 권한이 바뀌었어요. 창을 다시 열어 주세요.';return;}
        var d=source(),rosterNow=d.players.filter(function(p){return p.type!=='target';}),add=picked().filter(function(it){return rosterMatch(rosterNow,it.r)!=='dup';});if(!add.length){err.textContent='고른 후보가 그사이 명단에 들어왔어요. 창을 다시 열어 주세요.';return;}var now=Date.now(),made=[];
        add.forEach(function(it){var r=it.r,pl=(r.placements||[]).filter(function(x){return x.posId;}).sort(function(a,b){return ['done','go','rep'].indexOf(a.statusKey)-['done','go','rep'].indexOf(b.statusKey);})[0],pf={};
          try{pf=JSON.parse(JSON.stringify(r.profile||{}));}catch(e){pf={};}if(r.club&&!pf.team)pf.team=r.club;
          var p={id:uid('pl'),name:String(r.name||'').trim(),num:r.num==null?'':String(r.num),foot:r.foot||'',type:'ours',posId:pl&&pl.posId||'',levels:{},memo:'',manual:true,status:'ok',profile:pf,joinedFrom:{at:now,cid:r.cid,scoutSt:it.key||'',grade:r.grade||''}};
          if(st.grp)p.grp=st.grp;d.players.push(p);made.push(p.id);});
        var ok=win.save({skipTargets:true});dlg.close();markFresh(made);if(states.team.view!=='list'){states.team.view='list';states.team.viewInitialized=true;}
        win.renderTeam();toast(ok===false?win.TM_ADD_FAIL:made.length+'명을 명단에 넣었어요');
      }
      dlg.addEventListener('click',function(e){if(e.target===dlg){var b0=dlg.getBoundingClientRect();if(e.clientX<b0.left||e.clientX>b0.right||e.clientY<b0.top||e.clientY>b0.bottom)dlg.close();return;}
        var b=e.target.closest('button');if(!b)return;var x=b.dataset;
        if(x.pwiClose!==undefined){dlg.close();return;}
        if(x.pwiStage!==undefined){st.stage=x.pwiStage;dlg.querySelector('.pwi-chips').innerHTML=chips();paintList();return;}
        if(x.pwiAll!==undefined){shown().forEach(function(it){if(it.hit!=='dup')st.picked[it.r.id]=x.pwiAll==='1';});paintList();return;}
        if(x.pwiGrp!==undefined){st.grp=x.pwiGrp;dlg.querySelectorAll('[data-pwi-grp]').forEach(function(g){var on=g.dataset.pwiGrp===st.grp;g.classList.toggle('is-on',on);g.setAttribute('aria-pressed',String(on));});return;}
        if(x.pwiOk!==undefined)commit();
      });
      dlg.addEventListener('change',function(e){if(e.target.dataset&&e.target.dataset.pwiPos!==undefined){st.pos=e.target.value;paintList();return;}var id=e.target.dataset&&e.target.dataset.pwiPick;if(id===undefined)return;st.picked[id]=e.target.checked;foot();});
      dlg.addEventListener('input',function(e){if(e.target.dataset&&e.target.dataset.pwiQ!==undefined){st.q=e.target.value;paintList();}});
      dlg.addEventListener('close',function(){var last=el('pwTeam')&&el('pwTeam').querySelector('[data-pw-action="scoutImport"]');dlg.remove();if(importDlg===dlg)importDlg=null;if(last)last.focus({preventScroll:true});});
      draw();dlg.showModal();var first=dlg.querySelector('[data-pwi-q]');if(first)first.focus({preventScroll:true});
    }
    function compare(kind){var rows=states[kind].selected.map(function(id){return models[kind].find(function(r){return r.id===id;});}).filter(Boolean);if(rows.length<2)return;
      modal();detail=null;dialog.classList.add('pw-comparison');var fields=[['선수',function(r){return r.name;}],['포지션',function(r){return r.pos||'미지정';}],['팀',function(r){return kind==='team'?r.group:r.club;}],['상태',function(r){return r.status;}],['주발',function(r){return ({L:'왼발',R:'오른발',B:'양발'})[r.foot]||r.foot;}],['평가 기록',function(r){return score(r,kind);}]];
      if(kind==='scout')fields.push(['영입 등급',function(r){return r.grade||'미정';}]);fields.push(['강점',function(r){return r.profile.strengths;}],['성장 과제',function(r){return r.profile.develop;}]);
      dialog.innerHTML='<header class="pw-dialoghead"><h2 id="pwDetailTitle">선수 비교 · '+rows.length+'명</h2>'+button('닫기','data-pw-close')+'</header><div class="pw-detailbody"><p class="pw-muted">기록된 항목을 나란히 봅니다. 비어 있는 항목은 —로 표시합니다.</p><div class="pw-table-wrap"><table class="pw-table pw-compare"><thead><tr><th>비교 항목</th>'+rows.map(function(r){return '<th>'+esc(r.name)+'</th>';}).join('')+'</tr></thead><tbody>'+fields.slice(1).map(function(f){return '<tr><th>'+f[0]+'</th>'+rows.map(function(r){return '<td>'+esc(f[1](r)||'—')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>';show();
    }
    function wrap(name,kind){var original=win[name];if(typeof original!=='function')return;win[name]=function(){var result=original.apply(this,arguments);refresh(kind);return result;};}
    function boot(){var team=el('teamView'),scout=el('sbPaneCands');if(!team||!scout)return;team.classList.add('pw-enabled');scout.classList.add('pw-enabled');var legacy=team.querySelector('.tm-head-set');if(legacy){var holder=doc.createElement('div');holder.className='pw-legacytools';legacy.parentNode.insertBefore(holder,legacy);holder.appendChild(legacy);}create('team',team.querySelector('.card'),team.querySelector('.tb-board'));create('scout',scout,el('sbBoardCard'));
      wrap('renderTeam','team');wrap('renderScoutCands','scout');var oldClose=win.closePlayer;if(oldClose)win.closePlayer=function(){var r=oldClose.apply(this,arguments);refresh('team');refresh('scout');return r;};
      var oldSet=win.setView;if(oldSet)win.setView=function(){close();closeGroupPicker();states.team.groupEdit=false;return oldSet.apply(this,arguments);};
      refresh('team');refresh('scout');
      win.addEventListener('message',function(e){if(e.source===win.parent&&e.data&&e.data.type==='closeTransientUI'){close();closeGroupPicker();states.team.groupEdit=false;}});
    }
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
  }
  return {escape:esc,family:family,scored:scored,evaluated:evaluated,filter:filter,select:select,toggle:toggle,rosterMatch:rosterMatch,reconcile:reconcile,candidates:candidates,depthBoard:depthBoard,depthSelection:depthSelection,layoutRows:layoutRows,moveCard:moveCard,rowsIds:rowsIds,rowLabel:rowLabel,ROW_MAX:ROW_MAX,mount:mount};
});
