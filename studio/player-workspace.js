/* Read-only roster projections. All edits go through the existing guarded editors. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PSPlayerWorkspace=api;api.mount(root);}})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function family(pos){var p=String(pos||'').toUpperCase();if(p==='GK')return 'GK';if(/^(L?CB|RCB|LB|RB|FB|WB|LWB|RWB)$/.test(p))return 'DF';if(/^(DM|CM|AM|LM|RM|CDM|CAM|LCM|RCM|LDM|RDM|LAM|RAM)$/.test(p))return 'MF';if(/^(LW|RW|FW|CF|ST|SS)$/.test(p))return 'FW';return '미지정';}
  function scored(levels){return Object.keys(levels||{}).filter(function(k){return Number.isFinite(+levels[k])&&+levels[k]>0;});}
  function evaluated(p){var keys=scored(p.levels);return keys.length>0&&(!!p.evalAt||keys.some(function(k){return +p.levels[k]>1;}));}
  function filter(rows,state){var words=String(state.q||'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return rows.filter(function(r){return words.every(function(w){return [r.name,r.num,r.pos,(r.positions||[]).join(' '),r.club,r.group].join(' ').toLocaleLowerCase().indexOf(w)>=0;})&&(!state.pos||(r.positions&&r.positions.length?r.positions:[r.pos]).some(function(p){return family(p)===state.pos;}))&&(!state.status||r.statusKey===state.status)&&(!state.unevaluated||!r.evaluated);});}
  function select(selected,id){var next=selected.slice(),at=next.indexOf(id);if(at>=0)next.splice(at,1);else if(next.length<3)next.push(id);return next;}
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
    var order={LW:0,CF:1,ST:1,SS:2,RW:3,LM:0,LAM:1,LCM:2,LDM:3,AM:4,CM:5,DM:6,RDM:7,RCM:8,RAM:9,RM:10,LB:0,LWB:1,LCB:2,CB:3,RCB:4,RWB:5,RB:6};
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
    max=max||ROW_MAX;var by={},rows=[],seen={};
    (cards||[]).forEach(function(c){by[c.id]=c;});
    (Array.isArray(saved)?saved:[]).forEach(function(ids){var row=[];(Array.isArray(ids)?ids:[]).forEach(function(id){if(by[id]&&!seen[id]&&row.length<max){seen[id]=1;row.push(by[id]);}});if(row.length)rows.push(row);});
    FAMILIES.forEach(function(g){var rest=(cards||[]).filter(function(c){return c.family===g&&!seen[c.id];});while(rest.length)rows.push(rest.splice(0,max));});
    return rows;
  }
  function moveCard(rows,id,toRow,toIndex,max){
    max=max||ROW_MAX;var next=rows.map(function(r){return r.slice();}),card=null;
    next.forEach(function(r){var k=r.findIndex(function(c){return c.id===id;});if(k>=0)card=r.splice(k,1)[0];});
    if(!card)return null;
    if(toRow>=next.length)next.push([card]);
    else{var row=next[toRow];if(row.length>=max)return null;row.splice(Math.max(0,Math.min(toIndex|0,row.length)),0,card);}
    return next.filter(function(r){return r.length;});
  }
  function rowsIds(rows){return rows.map(function(r){return r.map(function(c){return c.id;});});}
  function rowLabel(row){var n={};row.forEach(function(c){n[c.family]=(n[c.family]||0)+1;});return FAMILIES.filter(function(g){return n[g];}).sort(function(a,b){return n[b]-n[a];})[0]||'';}
  function mount(win){
    var doc=win.document;if(!doc||doc.getElementById('pwTeam'))return;
    function newState(){return {q:'',pos:'',status:'',unevaluated:false,view:'depth',selected:[],depthPosition:null,depthStage:'',depthLimit:6,depthEdit:false,tools:false};}
    var states={team:newState(),scout:newState()},depths={};
    var models={team:[],scout:[]},dialog=null,detail=null,lastFocus=null,scope=null;
    function el(id){return doc.getElementById(id);}
    function source(){return typeof data!=='undefined'?data:{players:[],positions:[],meta:{}};}
    function position(p){var po=source().positions.find(function(q){return q.id===p.posId;});return po?posAbbr(po.name):'';}
    function group(p){return typeof tmGrpLabel==='function'?tmGrpLabel(p.grp):p.grp||'';}
    function row(p){var pf=p.profile||{},status=plStatusOf(p),lv=p.levels||{},link=null;try{link=matchAccountForPlayer(p.id);}catch(_){}
      return {id:p.id,pid:p.id,p:p,posId:p.posId,name:p.name||'이름 없음',num:p.num||'',pos:position(p),club:pf.team||p.club||'',group:group(p),year:p.schoolYear||'',statusKey:status,status:TM_ST_LB[status]||'정상',evaluated:evaluated(p),levels:lv,linked:!!link,link:link,profile:pf,foot:p.foot||'',grade:p.grade||'',notes:[p.memo].filter(Boolean)};
    }
    function scoutRows(){var placements=source().players.filter(function(p){return p.type==='target'&&!p._scoutHidden;}).map(function(p){return {cid:PSScoutStore.idOf(p),p:p};});var registry={};try{scStore().check();registry=scStore().read().scoutRegistry.candidates;}catch(_){return [];}
      return candidates(placements,registry,scRegistryRows()).map(function(item){var c=item.candidate||{},p=item.player&&item.player.p,pf=c.info&&c.info.profile||{},s=item.source,r=p?row(p):{levels:{},notes:[],profile:pf,foot:s.foot||'',linked:false};
        var st=scStOf(p&&p.scoutSt),positions=item.placements.map(function(x){return position(x.p);}).filter(function(v,i,a){return v&&a.indexOf(v)===i;}),stageKeys=item.placements.map(function(x){return scStOf(x.p.scoutSt)[0];});if(stageKeys.some(function(k){return k!==st[0];}))st=['mixed','배치별 상이'];
        return Object.assign(r,{id:item.id,cid:item.cid,pid:p&&p.id,p:p,name:s.nameKr||'이름 없음',num:s.num||'',club:s.club||'',grade:s.grade||'',group:'',pos:positions[0]||(s.pos||[])[0]||'',positions:positions,placements:item.placements.map(function(x){var status=scStOf(x.p.scoutSt);return {pid:x.p.id,posId:x.p.posId,statusKey:status[0],status:status[1],order:source().players.indexOf(x.p)};}),statusKey:st[0],status:st[1],profile:pf,points:c.points||{},evaluated:scored(c.points).length>0,notes:item.placements.reduce(function(a,x){return a.concat(scMemos(x.p));},[]).filter(Boolean),candidate:c,placementLabels:item.placements.map(function(x){return (position(x.p)||'미배치')+' · '+scStOf(x.p.scoutSt)[1];})});
      });
    }
    function resetScope(){var next='';try{next=win.PSSync.activeWs();}catch(_){}if(scope!==null&&scope!==next){close();Object.keys(states).forEach(function(k){states[k]=newState();});depths={};}scope=next;}
    var dragLock='',pendingRefresh={};
    /* 끄는 동안 들어온 다시 그리기(동기화 회차 · 다른 창의 저장)는 놓은 뒤로 미룬다 — 중간에 DOM 이 바뀌면 끌던 요소와 표식이 사라진다. */
    function refresh(kind){if(dragLock===kind){pendingRefresh[kind]=true;return;}resetScope();var host=el(kind==='team'?'pwTeam':'pwScout');if(!host)return;
      models[kind]=kind==='team'?source().players.filter(function(p){return p.type!=='target'&&(p.manual||String(p.name||'').trim());}).map(row):scoutRows();
      states[kind].selected=reconcile(states[kind].selected,models[kind]);paint(kind);
      if(kind==='team'&&el('tmStatNeed'))el('tmStatNeed').textContent=models.team.filter(function(r){return tmGrpFlt(r.p)&&!r.evaluated;}).length;
      if(dialog&&dialog.open&&detail&&detail.kind===kind){var r=models[kind].find(function(r){return r.id===detail.id;});if(!r){var confirmed=true;if(kind==='scout')try{scStore().check();}catch(_){confirmed=false;}if(confirmed)close();}}
    }
    function visible(kind){var rows=models[kind];if(kind==='team')rows=rows.filter(function(r){return tmGrpFlt(r.p)&&(!tmUnlinkedOnly||!r.linked);});return filter(rows,states[kind]);}
    function button(label,attrs,cls){return '<button type="button" '+(attrs||'')+' class="pw-button '+(cls||'')+'">'+label+'</button>';}
    function opts(values,current){return values.map(function(x){return '<option value="'+esc(x[0])+'"'+(x[0]===current?' selected':'')+'>'+esc(x[1])+'</option>';}).join('');}
    function create(kind,parent,before){var host=doc.createElement('section');host.id=kind==='team'?'pwTeam':'pwScout';host.className='pw-workspace';host.setAttribute('aria-label',kind==='team'?'선수단 작업 공간':'스카우팅 작업 공간');parent.insertBefore(host,before||null);
      host.innerHTML='<div class="pw-top"></div><div class="pw-toolbar"></div><div class="pw-result" aria-live="polite"></div><div class="pw-content"></div><div class="pw-comparebar" hidden></div>';
      host.addEventListener('input',function(e){if(e.target.dataset.pwSearch!==undefined){states[kind].q=e.target.value;states[kind].depthLimit=6;paintContent(kind);}});
      host.addEventListener('change',function(e){var k=e.target.dataset.pwFilter;if(k){states[kind][k]=e.target.value;states[kind].depthLimit=6;states[kind].depthStage='';paintContent(kind);}if(e.target.dataset.pwSelect!==undefined){var id=e.target.dataset.pwSelect,prior=states[kind].selected;states[kind].selected=select(prior,id);if(prior.length===3&&prior.indexOf(id)<0)toast('최대 3명까지 비교할 수 있어요.');paintContent(kind);var choice=Array.from(host.querySelectorAll('[data-pw-select]')).find(function(x){return x.dataset.pwSelect===id;});if(choice)choice.focus({preventScroll:true});}});
      installDrag(host,kind);
      host.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var d=b.dataset;
        if(d.pwAction==='tools'){states[kind].tools=!states[kind].tools;host.classList.toggle('pw-tools-open',states[kind].tools);b.setAttribute('aria-expanded',String(states[kind].tools));return;}
        if(d.pwView){states[kind].view=d.pwView;refresh(kind);var active=host.querySelector('[data-pw-view="'+d.pwView+'"]');if(active)active.focus();return;}
        if(d.pwPosition){states[kind].depthPosition=d.pwPosition;states[kind].depthStage='';states[kind].depthLimit=6;paintContent(kind);var panel=host.querySelector('.pw-depth-panel');if(panel){panel.querySelector('h3').focus({preventScroll:true});if(win.matchMedia('(max-width:900px)').matches)panel.scrollIntoView({block:'start',behavior:'smooth'});}return;}
        if(d.pwStage!==undefined){states[kind].depthStage=d.pwStage;states[kind].depthLimit=6;paintContent(kind);var stage=Array.from(host.querySelectorAll('[data-pw-stage]')).find(function(x){return x.dataset.pwStage===d.pwStage;});if(stage)stage.focus({preventScroll:true});return;}
        if(d.pwAction==='more'){states[kind].depthLimit+=6;paintContent(kind);var more=host.querySelector('[data-pw-action="more"]');if(more)more.focus({preventScroll:true});return;}
        if(d.pwAction==='board'){var pitch=host.querySelector('.pw-depth-pitch');if(pitch){pitch.scrollIntoView({block:'start',behavior:'smooth'});var pick=pitch.querySelector('[aria-pressed="true"]');if(pick)pick.focus({preventScroll:true});}return;}
        if(d.pwAction==='bulk'){if(win.PSPlayerBulk&&win.PSPlayerBulk.open)win.PSPlayerBulk.open(kind);return;}
        if(d.pwAction==='layout'){if(!states[kind].depthEdit&&!layoutAllowed())return;states[kind].depthEdit=!states[kind].depthEdit;paint(kind);var lb=host.querySelector('[data-pw-action="layout"]');if(lb)lb.focus({preventScroll:true});return;}
        if(d.pwAddpos!==undefined){addPosition(kind,+d.pwAddpos);return;}
        if(d.pwPosmenu){renamePosition(kind,d.pwPosmenu);return;}
        if(d.pwOpen){if(dragged&&Date.now()-dragged<400)return;open(kind,d.pwOpen,'summary',d.pwAtpos);return;}
        if(d.pwAction==='clear'){states[kind].selected=[];paintContent(kind);}
        if(d.pwAction==='compare')compare(kind);
        if(d.pwAction==='points'){modal();detail=null;dialog.classList.remove('pw-comparison');dialog.innerHTML='<header class="pw-dialoghead"><h2 id="pwDetailTitle">스카우팅 질문 기준</h2>'+button('닫기','data-pw-close')+'</header><div class="pw-detailbody"><iframe title="스카우팅 질문 기준" src="scouting.html?view=points"></iframe></div>';show();}
        if(d.pwAction==='reset'){Object.assign(states[kind],{q:'',pos:'',status:'',unevaluated:false});if(kind==='team'){tmGrpFilter='';tmSchoolYearFilter='';tmUnlinkedOnly=false;renderTeam();}else paint(kind);}
        if(d.pwAction==='unevaluated'){states[kind].unevaluated=!states[kind].unevaluated;paint(kind);}
        if(d.pwAction==='add'){if(kind==='team')el('tmAdd').click();else scOpenQuick();}
      });
    }
    function paint(kind){var host=el(kind==='team'?'pwTeam':'pwScout'),s=states[kind],rows=models[kind];if(!host)return;
      host.querySelector('.pw-top').innerHTML=kind==='scout'?'<div class="pw-scouthead"><h2>스카우팅</h2>'+button('질문 기준','data-pw-action="points"')+'</div><div class="pw-stats"><div><span>전체 후보</span><b>'+rows.length+'</b></div>'+['rep','go','done'].map(function(k){return '<div><span>'+esc(scStOf(k)[1])+'</span><b>'+rows.filter(function(r){return r.statusKey===k;}).length+'</b></div>';}).join('')+'</div>':'';
      var statuses=kind==='team'?[['','모든 상태'],['ok','정상'],['rest','휴식'],['rehab','재활'],['injury','부상'],['out','불참']]:[['','모든 단계'],['rep','추천'],['go','영입대상'],['done','확정'],['mixed','배치별 상이']];
      host.querySelector('.pw-toolbar').innerHTML='<label class="pw-search"><span aria-hidden="true">⌕</span><input data-pw-search type="search" aria-label="'+(kind==='team'?'선수':'후보')+' 검색" placeholder="이름, 번호, 포지션 검색" value="'+esc(s.q)+'"></label><select data-pw-filter="pos" aria-label="포지션 필터">'+opts([['','모든 포지션'],['GK','골키퍼'],['DF','수비수'],['MF','미드필더'],['FW','공격수'],['미지정','미지정']],s.pos)+'</select><select data-pw-filter="status" aria-label="'+(kind==='team'?'상태':'영입 단계')+' 필터">'+opts(statuses,s.status)+'</select>'+button('미평가','data-pw-action="unevaluated" aria-pressed="'+s.unevaluated+'"',s.unevaluated?'is-on':'')+'<span class="pw-view" role="group" aria-label="보기 선택">'+[['list','명단'],['depth','작전판']].map(function(x){return button(x[1],'data-pw-view="'+x[0]+'" aria-pressed="'+(s.view===x[0])+'"',s.view===x[0]?'is-on':'');}).join('')+'</span>'+button('편집 도구','data-pw-action="tools" aria-controls="pw-'+kind+'-tools" aria-expanded="'+s.tools+'"','pw-tools-toggle')+'<div class="pw-edit-tools" id="pw-'+kind+'-tools">'+button(s.view==='edit'?'편집 닫기':'배치·명단 편집','data-pw-view="'+(s.view==='edit'?'depth':'edit')+'"')+(s.view==='depth'?button(s.depthEdit?'판 편집 끝':'판 편집','data-pw-action="layout" aria-pressed="'+!!s.depthEdit+'"',s.depthEdit?'is-on':''):'')+(kind==='scout'?button('＋ 후보 등록','data-pw-action="add"','pw-primary')+button('＋ 여러 명','data-pw-action="bulk"'):button('＋ 여러 명 추가','data-pw-action="bulk"','pw-primary'))+'</div>';
      host.classList.toggle('pw-tools-open',s.tools);
      var view=kind==='team'?el('teamView'):el('sbPaneCands');view.classList.toggle('pw-edit',s.view==='edit');
      paintContent(kind);
    }
    function avatar(r){return '<span class="pw-avatar" aria-hidden="true">'+esc(r.num||r.name.slice(0,1))+'</span>';}
    function score(r,kind){return kind==='scout'?(r.evaluated?'포인트 '+scored(r.points).length+'개 기록':'포인트 미평가'):(r.evaluated?'평가 '+scored(r.levels).length+'개 기록':'아직 평가 전');}
    function nameCell(r){return '<span class="pw-person">'+avatar(r)+'<span><strong>'+esc(r.name)+'</strong><small>'+esc([(r.positions&&r.positions.length?r.positions.join(' / '):r.pos)||'포지션 미지정',r.club].filter(Boolean).join(' · '))+'</small></span></span>';}
    function scoutReady(){try{scStore().check();return true;}catch(_){return false;}}
    function abbrOf(p){var o=(source().meta||{}).posAbbr;return (o&&o[p.id])||posAbbr(p.name);}
    function cardIdsAll(){var m=source().meta||{},ids=(m.tbCards||[]).slice();(Array.isArray(m.depthRows)?m.depthRows:[]).forEach(function(r){(r||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});});return ids;}
    function layoutAllowed(){if(typeof win.teEditable==='function'&&!win.teEditable()){toast('운영진만 바꿀 수 있어요');return false;}if(win.scoutReadOnlyLoad){toast('보기 전용 상태예요');return false;}return true;}
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
    function moveTarget(t,posId,idx){var ps=source().players;ps.splice(ps.indexOf(t),1);t.posId=posId||'';delete t.sbSeat;var grp=ps.filter(function(p){return p.type==='target'&&p.posId===posId;}),anchor=(posId&&typeof idx==='number'&&idx<grp.length)?grp[idx]:null;
      if(anchor)ps.splice(ps.indexOf(anchor),0,t);else if(posId&&grp.length)ps.splice(ps.indexOf(grp[grp.length-1])+1,0,t);else ps.push(t);win.save();try{win.renderScoutCands();}catch(_){}try{win.renderScoutBoard();}catch(_){}}
    /* 선수 옮기기는 기존 길: 선수단은 본문 tbMovePlayer(저장 · renderTeam), 스카우팅 배치는 attach() 와 같은 posId 바꾸기 + save(). 되돌리기용 이전 자리를 돌려준다. */
    function movePlayer(kind,id,fromPos,toPos,index){
      var r=models[kind].find(function(x){return x.id===id;});if(!r)return null;
      if(kind==='team'){if(!layoutAllowed())return null;var pl=source().players.find(function(p){return p.id===r.pid;});if(!pl||typeof win.tbMovePlayer!=='function')return null;
        var prevPos=pl.posId||'',prevIdx=indexAmong('team',pl);win.tbMovePlayer(r.pid,toPos,index);return {undo:function(){win.tbMovePlayer(r.pid,prevPos,prevIdx);}};}
      try{win.scStore().check();}catch(e){try{win.scWarn(e);}catch(_){}return null;}
      var card=(depths.scout||{cards:[]}).cards.find(function(c){return c.id===fromPos;}),placed=card&&card.all.find(function(x){return x.id===id;}),pid=placed&&placed.pid;
      var t=pid&&source().players.find(function(p){return p.id===pid&&p.type==='target';});if(!t)return null;
      var prev=t.posId||'',prevI=indexAmong('scout',t);moveTarget(t,toPos,index);return {undo:function(){var again=source().players.find(function(p){return p.id===pid;});if(again)moveTarget(again,prev,prevI);}};
    }
    var undoBox=null,undoTimer=0;
    function showUndo(msg,fn){if(undoBox)undoBox.remove();undoBox=doc.createElement('div');undoBox.className='pw-undo';undoBox.setAttribute('role','status');undoBox.innerHTML='<span>'+msg+'</span>'+(fn?'<button type="button">되돌리기</button>':'');doc.body.appendChild(undoBox);
      var box=undoBox;if(fn)box.querySelector('button').addEventListener('click',function(){box.remove();if(undoBox===box)undoBox=null;fn();});clearTimeout(undoTimer);undoTimer=setTimeout(function(){box.remove();if(undoBox===box)undoBox=null;},6000);}
    var dragged=0;
    /* 끌기: 마우스는 6px 움직이면, 손가락 · 펜은 280ms 길게 누르면 시작(그 전에 움직이면 그냥 스크롤). 끄는 동안은 비수동 touchmove 로 스크롤을 막는다. */
    function installDrag(host,kind){
      var st=null;
      function slotOf(el){return el&&el.closest?el.closest('.pw-depth-slot'):null;}
      function clearMarks(){host.querySelectorAll('.pw-depth-drop,.pw-depth-placeholder').forEach(function(n){n.remove();});host.querySelectorAll('.is-dropping,.is-full').forEach(function(n){n.classList.remove('is-dropping');n.classList.remove('is-full');});}
      function stop(){if(!st)return;if(st.hold)clearTimeout(st.hold);if(st.ghost)st.ghost.remove();if(st.src)st.src.classList.remove('is-dragging');clearMarks();doc.removeEventListener('touchmove',block,{passive:false});st=null;if(dragLock===kind){dragLock='';if(pendingRefresh[kind]){pendingRefresh[kind]=false;refresh(kind);}}}
      function block(e){if(st&&st.on)e.preventDefault();}
      function begin(e){if(!st||st.on)return;st.on=true;dragLock=kind;dragged=Date.now();var r=st.src.getBoundingClientRect();st.dx=e.clientX-r.left;st.dy=e.clientY-r.top;st.w=r.width;
        var g=st.src.cloneNode(true);g.className+=' pw-depth-ghost';g.style.width=r.width+'px';g.setAttribute('aria-hidden','true');doc.body.appendChild(g);st.ghost=g;st.src.classList.add('is-dragging');place(e);}
      /* 놓을 자리는 hit-test(elementFromPoint) 대신 칸 · 줄의 사각형으로 찾는다 — 떠 있는 ghost · 앞 move 의 표식 · 알림이 포인터 밑에 있어도 흔들리지 않는다. */
      function hit(list,x,y){for(var i=0;i<list.length;i++){var b=list[i].getBoundingClientRect();if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)return list[i];}return null;}
      function place(e){if(!st||!st.ghost)return;st.ghost.style.transform='translate('+(e.clientX-st.dx)+'px,'+(e.clientY-st.dy)+'px)';
        clearMarks();st.target=null;var x=e.clientX,y=e.clientY;
        if(st.kind==='player'){var unp=hit(host.querySelectorAll('[data-pw-position="__unplaced"]'),x,y);if(unp){unp.classList.add('is-dropping');st.target={pos:'',index:0};return;}
          var slot=hit(host.querySelectorAll('.pw-depth-slot:not(.pw-depth-placeholder)'),x,y);if(!slot)return;var names=Array.prototype.filter.call(slot.querySelectorAll('.pw-depth-name'),function(n){return n!==st.src;}),idx=names.filter(function(n){var b=n.getBoundingClientRect();return y>b.top+b.height/2;}).length;
          slot.classList.add('is-dropping');var line=doc.createElement('div');line.className='pw-depth-drop';var box=slot.querySelector('.pw-depth-names');if(names[idx])box.insertBefore(line,names[idx]);else box.appendChild(line);st.target={pos:slot.dataset.pwSlot,index:idx};return;}
        var lineEl=hit(host.querySelectorAll('.pw-depth-line'),x,y);if(!lineEl)return;var row=+lineEl.dataset.pwRow,slots=Array.prototype.filter.call(lineEl.querySelectorAll('.pw-depth-slot'),function(n){return n!==st.src&&!n.classList.contains('pw-depth-placeholder');});
        if(slots.length>=ROW_MAX){lineEl.classList.add('is-full');return;}
        var at=slots.filter(function(n){var b=n.getBoundingClientRect();return x>b.left+b.width/2;}).length,ph=doc.createElement('div');ph.className='pw-depth-slot pw-depth-placeholder';ph.style.minHeight=st.src.getBoundingClientRect().height+'px';
        var wrap=lineEl.querySelector('.pw-depth-slots');if(slots[at])wrap.insertBefore(ph,slots[at]);else{var add=wrap.querySelector('.pw-depth-addpos');if(add)wrap.insertBefore(ph,add);else wrap.appendChild(ph);}lineEl.classList.add('is-dropping');st.target={row:row,index:at};}
      function finish(e){if(!st)return;var s=st,on=s.on,target=s.target;stop();if(!on||!target)return;
        if(s.kind==='player'){var from=slotOf(s.src),fromPos=from?from.dataset.pwSlot:'',name=(s.src.querySelector('strong')||{}).textContent||'';
          if(target.pos===fromPos){var names=Array.prototype.filter.call(from.querySelectorAll('.pw-depth-name'),function(n){return n!==s.src;}),was=Array.prototype.indexOf.call(from.querySelectorAll('.pw-depth-name'),s.src);if(target.index===was)return;}
          var done=movePlayer(kind,s.id,fromPos,target.pos,target.index);if(!done)return;
          var card=(depths[kind]||{cards:[]}).cards.find(function(c){return c.id===target.pos;});showUndo('<b>'+esc(name)+'</b> → '+(card?esc(card.abbr)+' '+(target.index+1)+'번째':'미배치')+'로 옮겼어요',done.undo);return;}
        if(!layoutAllowed())return;var rows=currentRows(kind),next=moveCard(rows.map(function(r){return r.map(function(id){return {id:id};});}),s.id,target.row,target.index,ROW_MAX);
        if(!next){toast('한 줄에는 포지션 카드를 '+ROW_MAX+'장까지 둘 수 있어요');return;}var ids=rowsIds(next);if(JSON.stringify(ids)===JSON.stringify(rows))return;
        var before=rows;saveRows(kind,ids);showUndo('포지션 카드를 옮겼어요',function(){saveRows(kind,before);});}
      host.addEventListener('pointerdown',function(e){if(st||e.button!==0&&e.pointerType==='mouse')return;var edit=!!states[kind].depthEdit,src,id,kindD;
        if(edit){var head=e.target.closest('.pw-depth-slothead,.pw-depth-grip');var slot=slotOf(head);if(!slot||e.target.closest('.pw-depth-posmenu'))return;src=slot;id=slot.dataset.pwSlot;kindD='card';}
        else{var n=e.target.closest('.pw-depth-name');if(!n||!slotOf(n))return;src=n;id=n.dataset.pwOpen;kindD='player';}
        st={src:src,id:id,kind:kindD,x:e.clientX,y:e.clientY,on:false,hold:0,target:null};doc.addEventListener('touchmove',block,{passive:false});
        if(e.pointerType!=='mouse')st.hold=setTimeout(function(){if(st&&!st.on){begin(e);try{src.setPointerCapture(e.pointerId);}catch(_){}}},280);});
      doc.addEventListener('pointermove',function(e){if(!st)return;if(!st.on){if(e.pointerType==='mouse'){if(Math.hypot(e.clientX-st.x,e.clientY-st.y)>6)begin(e);}else if(Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)stop();return;}e.preventDefault();place(e);});
      doc.addEventListener('pointerup',finish);doc.addEventListener('pointercancel',stop);doc.addEventListener('keydown',function(e){if(e.key==='Escape')stop();});
    }
    function depthModel(kind){var rows=models[kind];if(kind==='team')rows=rows.filter(function(r){return tmGrpFlt(r.p)&&(!tmUnlinkedOnly||!r.linked);});return depthBoard(rows,source().positions.map(function(p){return {id:p.id,name:p.name,abbr:abbrOf(p)};}),cardIdsAll(),states[kind]);}
    function depthHTML(kind,board){
      var s=states[kind],cards=board.cards.concat([board.unplaced]),selected=cards.find(function(c){return c.id===s.depthPosition;});
      if(!selected)selected=cards.find(function(c){return c.rows.length;})||cards[0];
      s.depthPosition=selected.id;var edit=!!s.depthEdit,rowsL=layoutRows(board.cards,(source().meta||{}).depthRows,ROW_MAX);
      function count(c){return c.rows.length===c.all.length?c.all.length+'명':c.rows.length+' / '+c.all.length+'명';}
      function stages(c){return ['rep','go','done','mixed'].map(function(k){var n=c.all.filter(function(r){return r.statusKey===k;}).length;return n?'<i class="pw-stage-'+k+'" style="width:'+(n/board.max*100)+'%"></i>':'';}).join('');}
      function slot(c){var preview=kind==='team'?c.rows:c.rows.slice(0,3);return '<article class="pw-depth-slot'+(c.id===selected.id?' is-active':'')+(edit?' is-editing':'')+'" data-pw-slot="'+esc(c.id)+'">'+(edit?'<span class="pw-depth-grip" aria-hidden="true">⠿</span>':'')+button('<b>'+esc(c.abbr)+'</b><span>'+count(c)+'</span>','data-pw-position="'+esc(c.id)+'" aria-label="'+esc(c.name)+' '+count(c)+' 전체 보기" aria-pressed="'+(c.id===selected.id)+'"','pw-depth-slothead')+(edit?button('⋯','data-pw-posmenu="'+esc(c.id)+'" aria-label="'+esc(c.name)+' 포지션 이름 바꾸기"','pw-depth-posmenu'):'')+(kind==='scout'?'<div class="pw-depth-meter" aria-hidden="true">'+stages(c)+'</div>':'')+'<div class="pw-depth-names">'+(preview.length?preview.map(function(r){return button('<span class="pw-depth-rank">'+r.rank+'</span><strong>'+esc(r.name)+'</strong>'+(kind==='team'?'<i class="pw-depth-dot pw-status-'+esc(r.statusKey)+'" title="'+esc(r.status)+'"><span class="pw-sr">'+esc(r.status)+'</span></i>':'<span class="pw-depth-dot pw-stage-'+esc(r.statusKey)+'"><span class="pw-sr">'+esc(r.status)+'</span></span>'),'data-pw-open="'+esc(r.id)+'" data-pw-atpos="'+esc(c.id)+'"','pw-depth-name');}).join(''):'<span class="pw-depth-vacant">'+(c.all.length?'검색 결과 없음':'배치 없음')+'</span>')+'</div>'+button(c.rows.length>preview.length?'후보 '+(c.rows.length-preview.length)+'명 더 보기':'전체 보기 →','data-pw-position="'+esc(c.id)+'"','pw-depth-slotfoot')+'</article>';}
      var panelRows=selected.rows.filter(function(r){return !s.depthStage||r.statusKey===s.depthStage;}),shown=kind==='scout'?panelRows.slice(0,s.depthLimit):panelRows;
      return '<div class="pw-depth-layout"><div class="pw-depth-board"><header class="pw-depth-heading"><div><h3>포지션별 '+(kind==='team'?'선수 뎁스':'후보 뎁스')+'</h3><p>'+(kind==='team'?'각 포지션의 전체 선수와 상태를 확인하세요.':'포지션에는 앞의 3명, 후보 패널에는 전체 명단을 표시합니다.')+'</p></div><span>공격 방향 ↑</span></header>'+(kind==='scout'?'<div class="pw-depth-legend"><span><i class="pw-stage-rep"></i>추천</span><span><i class="pw-stage-go"></i>영입대상</span><span><i class="pw-stage-done"></i>확정</span></div>':'')+'<div class="pw-depth-pitch" aria-label="포지션별 작전판"><div class="pw-depth-markings" aria-hidden="true"><i></i></div>'+rowsL.map(function(row,ri){var g=rowLabel(row),cols=Math.min(row.length+(edit&&row.length<ROW_MAX?1:0),ROW_MAX);return '<section class="pw-depth-line" data-pw-row="'+ri+'" aria-label="'+esc(g||'포지션')+' 줄"><span class="pw-depth-line-label">'+esc(g)+'</span><div class="pw-depth-slots" style="--pw-cols:'+cols+';--pw-phone-cols:'+Math.min(cols,3)+'">'+row.map(slot).join('')+(edit&&row.length<ROW_MAX?button('＋ 포지션','data-pw-addpos="'+ri+'"','pw-depth-addpos'):'')+'</div></section>';}).join('')+(edit?'<section class="pw-depth-line pw-depth-newrow" data-pw-row="'+rowsL.length+'" aria-label="새 줄"><div class="pw-depth-slots" style="--pw-cols:1;--pw-phone-cols:1">'+button('＋ 새 줄에 포지션','data-pw-addpos="'+rowsL.length+'"','pw-depth-addpos')+'</div></section>':'')+'</div>'+button('<b>미배치 '+count(board.unplaced)+'</b><span>포지션을 정하지 않은 '+(kind==='team'?'선수':'후보')+' 보기 →</span>','data-pw-position="__unplaced" aria-pressed="'+(selected.id==='__unplaced')+'"','pw-depth-unplaced')+'<p class="pw-footnote">'+(kind==='scout'?'같은 후보가 여러 포지션에 있으면 각 자리에 표시합니다. 전체 인원은 중복을 제외합니다. ':'')+''+(edit?'판 편집 중 — 포지션 카드를 끌어 줄과 순서를 바꿉니다(한 줄 최대 '+ROW_MAX+'장). ＋ 포지션으로 우리 팀 포지션을 더하고, ⋯ 으로 이름을 바꿔요.':'이름을 끌어 다른 포지션 칸에 놓으면 포지션이 바뀌고, 같은 칸 안에서 끌면 순서가 바뀝니다. 폰에서는 길게 눌러 끌어요.')+'</p></div><aside class="pw-depth-panel" aria-label="포지션 '+(kind==='team'?'선수':'후보')+' 패널"><header><div><span class="pw-depth-eyebrow">선택한 포지션</span><h3 tabindex="-1">'+esc(selected.abbr)+' <span>'+selected.all.length+'명</span></h3><p>'+esc(selected.name===selected.abbr?(kind==='team'?'선수단':'스카우팅 후보'):selected.name)+'</p></div>'+button('↑ 작전판','data-pw-action="board"','pw-depth-back')+'</header>'+(kind==='scout'?'<div class="pw-depth-stages" role="group" aria-label="선택한 포지션 영입 단계">'+[['','전체'],['rep','추천'],['go','영입대상'],['done','확정']].concat(selected.rows.some(function(r){return r.statusKey==='mixed';})?[['mixed','배치별 상이']]:[]).map(function(x){var n=x[0]?selected.rows.filter(function(r){return r.statusKey===x[0];}).length:selected.rows.length;return button(esc(x[1])+' <b>'+n+'</b>','data-pw-stage="'+x[0]+'" aria-pressed="'+(s.depthStage===x[0])+'"',s.depthStage===x[0]?'is-on':'');}).join('')+'</div>':'')+'<div class="pw-depth-panelresult" aria-live="polite">'+shown.length+' / '+panelRows.length+'명 표시 · 이름을 눌러 상세 보기</div><div class="pw-depth-candidates">'+(shown.length?shown.map(function(r){return '<article class="pw-depth-candidate"><span class="pw-depth-rank">'+r.rank+'</span>'+button('<strong>'+esc(r.name)+'</strong><small>'+esc([kind==='team'?r.group:r.club,r.num&&'#'+r.num,r.grade&&'등급 '+r.grade].filter(Boolean).join(' · ')||'소속 미등록')+'</small><span class="pw-status pw-status-'+esc(r.statusKey)+'">'+esc(r.status)+'</span><small>'+score(r,kind)+'</small>','data-pw-open="'+esc(r.id)+'" data-pw-atpos="'+esc(selected.id)+'"','pw-depth-candidate-name')+'<label class="pw-depth-check"><input type="checkbox" data-pw-select="'+esc(r.id)+'" aria-label="'+esc(r.name)+' 비교 선택"'+(s.selected.indexOf(r.id)>=0?' checked':'')+'><span>비교</span></label></article>';}).join(''):'<div class="pw-empty"><strong>'+(selected.all.length?'조건에 맞는 선수가 없어요':'아직 배치된 '+(kind==='team'?'선수':'후보')+'가 없어요')+'</strong><p>'+(selected.all.length?'단계나 검색 조건을 바꿔 보세요.':'배치·명단 편집에서 포지션을 지정할 수 있어요.')+'</p></div>')+'</div>'+(shown.length<panelRows.length?button('6명 더 보기 · '+(panelRows.length-shown.length)+'명 남음','data-pw-action="more"','pw-depth-more'):'')+'</aside></div>';
    }
    function paintContent(kind){var host=el(kind==='team'?'pwTeam':'pwScout'),s=states[kind],rows=visible(kind),content=host.querySelector('.pw-content');
      host.querySelector('.pw-result').innerHTML='<span><b>'+rows.length+'</b>명 표시 <span class="pw-muted">/ 전체 '+models[kind].length+'명</span></span>'+((s.q||s.pos||s.status||s.unevaluated||(kind==='team'&&(tmGrpFilter||tmSchoolYearFilter||tmUnlinkedOnly)))?button('필터 초기화','data-pw-action="reset"'):'')+'<small>선수 이름을 누르면 상세 · 최대 3명 비교</small>';
      if(s.view==='edit'){content.innerHTML='<p class="pw-empty">아래에서 기존 배치·명단 편집 도구를 사용할 수 있어요.</p>';}
      else if((kind==='team'&&el('teamView').classList.contains('tm-waiting'))||(kind==='scout'&&!scoutReady())){content.innerHTML='<div class="pw-empty"><strong>명단을 불러오는 중이에요</strong><p>자료를 확인하면 여기에 표시합니다.</p></div>';}
      else if(s.view==='depth'&&!(kind==='team'&&el('teamView').classList.contains('tm-waiting'))&&(kind!=='scout'||scoutReady())){depths[kind]=depthModel(kind);content.innerHTML=depthHTML(kind,depths[kind]);host.querySelector('.pw-result b').textContent=depths[kind].shown;}
      else if(!rows.length){var waiting=kind==='team'&&el('teamView').classList.contains('tm-waiting');try{if(kind==='scout')scStore().check();}catch(_){waiting=true;}
        content.innerHTML='<div class="pw-empty"><strong>'+(waiting?'명단을 불러오는 중이에요':models[kind].length?'조건에 맞는 선수가 없어요':'아직 등록된 '+(kind==='team'?'선수':'후보')+'가 없어요')+'</strong><p>'+(waiting?'자료를 확인하면 여기에 표시합니다.':models[kind].length?'검색어나 필터를 바꿔 보세요.':'이름과 포지션부터 등록해 보세요.')+'</p>'+(!waiting?button(models[kind].length?'필터 초기화':'＋ '+(kind==='team'?'선수':'후보')+' 등록','data-pw-action="'+(models[kind].length?'reset':'add')+'"'):'')+'</div>';
      }else{
        content.innerHTML='<div class="pw-table-wrap"><table class="pw-table"><thead><tr><th><span class="pw-sr">비교 선택</span></th><th>선수</th><th>'+(kind==='team'?'팀 · 학년':'소속')+'</th><th>'+(kind==='team'?'상태':'영입 단계')+'</th><th>'+(kind==='team'?'평가':'등급 · 평가 기록')+'</th><th>'+(kind==='team'?'IDP':'관찰 메모')+'</th></tr></thead><tbody>'+rows.map(function(r){return '<tr'+(s.selected.indexOf(r.id)>=0?' class="is-selected"':'')+'><td><label class="pw-select-hit"><input type="checkbox" data-pw-select="'+esc(r.id)+'" aria-label="'+esc(r.name)+' 비교 선택"'+(s.selected.indexOf(r.id)>=0?' checked':'')+'></label></td><td>'+button(nameCell(r),'data-pw-open="'+esc(r.id)+'"','pw-name')+'</td><td>'+esc(kind==='team'?r.group||'미배정':r.club||'—')+(kind==='team'&&r.year?'<small>'+esc(r.year)+'학년</small>':'')+'</td><td><span class="pw-status '+(r.statusKey==='injury'?'pw-bad':r.statusKey==='rehab'||r.statusKey==='go'?'pw-warn':r.statusKey==='ok'?'pw-ok':'')+'">'+esc(r.status)+'</span></td><td>'+(kind==='scout'?'<span class="pw-grade">'+esc(r.grade?'등급 '+r.grade:'등급 미정')+'</span>':'')+'<small class="'+(r.evaluated?'':'pw-muted')+'">'+score(r,kind)+'</small></td><td><small>'+esc(kind==='team'?(r.linked?'연결됨':'미연결'):(r.notes.length?r.notes.length+'개':'기록 없음'))+'</small></td></tr>';}).join('')+'</tbody></table></div>';
      }
      var bar=host.querySelector('.pw-comparebar');bar.hidden=!s.selected.length;bar.innerHTML='<span><b>'+s.selected.length+'명 선택</b> · '+s.selected.map(function(id){var r=models[kind].find(function(r){return r.id===id;});return esc(r.name);}).join(', ')+'</span>'+button('선택 해제','data-pw-action="clear"')+button('선수 비교','data-pw-action="compare"'+(s.selected.length<2?' disabled':''),'pw-primary');
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
    function editDetail(action){var r=detailRow();if(!r)return;var kind=detail.kind;close();
      if(action==='records'){plSheetOpen(r.pid);return;}
      if(action==='idp'){if(r.link)win.parent.postMessage({source:'scout',type:'goApp',app:'idp',idpKey:'cs_idp_v1_'+r.link.uid,idpName:r.name},'*');else if(ilCan())ilPickAccount(r.p);else toast('임원이 선수 계정을 연결할 수 있어요.');return;}
      if(kind==='scout'&&action==='notes'&&r.pid){states.scout.view='edit';renderScoutCands();var notes=Array.from(doc.querySelectorAll('[data-scnotes]')).find(function(n){return n.dataset.scnotes===r.pid;});if(notes){notes.open=true;notes.scrollIntoView({block:'center'});var input=notes.querySelector('input,button');if(input)input.focus();return;}}
      if(kind==='scout'&&!r.pid)scOpenCandidate(r.cid);else openPlayer(r.pid);
      if(action==='evaluation'||action==='notes'){var target=el(action==='evaluation'?'plLevels':'plMemo');if(target){target.scrollIntoView({block:'start'});if(action==='notes')target.focus();}}
    }
    function compare(kind){var rows=states[kind].selected.map(function(id){return models[kind].find(function(r){return r.id===id;});}).filter(Boolean);if(rows.length<2)return;
      modal();detail=null;dialog.classList.add('pw-comparison');var fields=[['선수',function(r){return r.name;}],['포지션',function(r){return r.pos||'미지정';}],['팀',function(r){return kind==='team'?r.group:r.club;}],['상태',function(r){return r.status;}],['주발',function(r){return ({L:'왼발',R:'오른발',B:'양발'})[r.foot]||r.foot;}],['평가 기록',function(r){return score(r,kind);}]];
      if(kind==='scout')fields.push(['영입 등급',function(r){return r.grade||'미정';}]);fields.push(['강점',function(r){return r.profile.strengths;}],['성장 과제',function(r){return r.profile.develop;}]);
      dialog.innerHTML='<header class="pw-dialoghead"><h2 id="pwDetailTitle">선수 비교 · '+rows.length+'명</h2>'+button('닫기','data-pw-close')+'</header><div class="pw-detailbody"><p class="pw-muted">기록된 항목을 나란히 봅니다. 비어 있는 항목은 —로 표시합니다.</p><div class="pw-table-wrap"><table class="pw-table pw-compare"><thead><tr><th>비교 항목</th>'+rows.map(function(r){return '<th>'+esc(r.name)+'</th>';}).join('')+'</tr></thead><tbody>'+fields.slice(1).map(function(f){return '<tr><th>'+f[0]+'</th>'+rows.map(function(r){return '<td>'+esc(f[1](r)||'—')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>';show();
    }
    function wrap(name,kind){var original=win[name];if(typeof original!=='function')return;win[name]=function(){var result=original.apply(this,arguments);refresh(kind);return result;};}
    function boot(){var team=el('teamView'),scout=el('sbPaneCands');if(!team||!scout)return;team.classList.add('pw-enabled');scout.classList.add('pw-enabled');var legacy=team.querySelector('.tm-head-set');if(legacy){var holder=doc.createElement('div');holder.className='pw-legacytools';legacy.parentNode.insertBefore(holder,legacy);holder.appendChild(legacy);}create('team',team.querySelector('.card'),team.querySelector('.tb-board'));create('scout',scout,el('sbBoardCard'));
      wrap('renderTeam','team');wrap('renderScoutCands','scout');var oldClose=win.closePlayer;if(oldClose)win.closePlayer=function(){var r=oldClose.apply(this,arguments);refresh('team');refresh('scout');return r;};
      var oldSet=win.setView;if(oldSet)win.setView=function(){close();return oldSet.apply(this,arguments);};
      refresh('team');refresh('scout');
      win.addEventListener('message',function(e){if(e.source===win.parent&&e.data&&e.data.type==='closeTransientUI')close();});
    }
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
  }
  return {escape:esc,family:family,scored:scored,evaluated:evaluated,filter:filter,select:select,reconcile:reconcile,candidates:candidates,depthBoard:depthBoard,layoutRows:layoutRows,moveCard:moveCard,rowsIds:rowsIds,rowLabel:rowLabel,ROW_MAX:ROW_MAX,mount:mount};
});
