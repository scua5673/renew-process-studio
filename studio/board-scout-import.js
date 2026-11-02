/* Read the current team's scouting roster; copy only board labels through the existing team-load path. */
(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSBoardScoutImport=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var TEAM='scout_tool_v1',TOMBS='cs_player_del_v1';
  var STAGES={rep:'추천',go:'영입대상',done:'확정',mixed:'배치별 상이'};
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
    return (team.players||[]).filter(function(p){return p&&p.type!=='target'&&!tombs[p.id]&&String(p.name||'').trim();}).map(function(p){
      var def=positions.find(function(x){return x.id===p.posId;}),pos=abbr[p.posId]||code(def&&def.name||p.posName||p.pos||''),grp=String(p.grp||'').trim();
      return {id:p.id,name:String(p.name).trim(),no:p.num==null?'':String(p.num),pos:pos,positions:pos?[pos]:[],club:labels[grp]||grp||'조 없음',status:grp,availability:p.status||'ok'};
    });
  }
  function trainingCounts(list){var c={gk:0,field:0,rehab:0,out:0};list.forEach(function(p){var s=String(p.availability||'ok').toLowerCase();if(s==='rehab')c.rehab++;else if(!['ok','normal','available'].includes(s))c.out++;else if(/GK|GOALKEEPER|골키퍼|키퍼/.test(String(p.pos).toUpperCase()))c.gk++;else c.field++;});return c;}
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
    var anchor=document.getElementById('squadGrpRow');if(!anchor)return;
    var row=el('div','menurow bsi-entry'),entries=[];row.id='boardScoutRow';row.appendChild(el('span','menulbl','명단 불러오기'));anchor.after(row);
    function addButtons(host,prefix){['team','scout'].forEach(function(kind){var b=el('button',prefix==='training'?'bsi-button':'btn',kind==='team'?'선수단':'스카우팅');b.type='button';b.id=prefix+(kind==='team'?'Team':'Scout')+'RosterBtn';b.setAttribute('aria-label',(kind==='team'?'선수단':'스카우팅')+' 명단 불러오기');host.appendChild(b);entries.push({button:b,kind:kind});b.onclick=function(){open(kind,b);};});}
    addButtons(row,'load');
    var ep=document.getElementById('epSquadRow'),trainingRow;
    if(ep){trainingRow=el('div','bsi-entry');trainingRow.id='trainingRosterImport';trainingRow.appendChild(el('span','ep-roster-label','명단 불러오기'));ep.after(trainingRow);addButtons(trainingRow,'training');}
    function refresh(){entries.forEach(function(e){e.button.hidden=!allowed(e.kind);e.button.style.setProperty('display',e.button.hidden?'none':'inline-flex','important');e.button.disabled=!editable();});var hidden=entries.slice(0,2).every(function(e){return e.button.hidden;});row.hidden=hidden;row.style.setProperty('display',hidden?'none':'flex','important');if(trainingRow)trainingRow.hidden=hidden;}
    refresh();document.addEventListener('click',refresh,true);win.addEventListener('ps-auth-state',refresh);win.addEventListener('ps-perms-changed',refresh);win.setInterval(refresh,1500);
    var opening=false;
    async function open(kind,button){
      if(opening||!editable()||!allowed(kind)||document.getElementById('boardScoutDialog'))return;opening=true;button.disabled=true;
      var target=destination(),isTraining=training(),label=kind==='team'?'선수단':'스카우팅',noun=kind==='team'?'선수':'후보',source;try{source=await read(win,kind);}catch(_){win.toast(label+' 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 열어 주세요.');}finally{opening=false;refresh();}
      if(!source||!editable()||!allowed(kind)||target!==destination())return;
      document.querySelectorAll('.popmenu.on').forEach(function(m){m.classList.remove('on');});
      var list=kind==='team'?teamRows(source.team,source.tombs,win.posCode):rows(source.doc,source.team,source.tombs,win.PSScoutStore,win.posCode),selected=new Set(list.filter(function(p){return p.name;}).map(function(p){return p.id;}));
      var d=el('dialog');d.id='boardScoutDialog';d.setAttribute('aria-labelledby','boardScoutTitle');
      d.innerHTML='<form><header><div><h2 id="boardScoutTitle">'+label+' 명단 불러오기</h2><p>팀 운영 › '+label+'에 등록된 '+noun+'입니다.</p></div><button type="button" class="btn" data-close aria-label="명단 불러오기 닫기">닫기</button></header><div class="bsi-body"><div class="bsi-controls"><label>배치할 팀<select name="side" aria-label="배치할 팀"><option value="blue">팀 1</option><option value="red">팀 2</option></select></label><label>'+(kind==='team'?'조':'영입 단계')+'<select name="stage" aria-label="'+(kind==='team'?'조':'영입 단계')+'"><option value="">'+(kind==='team'?'모든 조':'모든 단계')+'</option>'+(kind==='team'?'':'<option value="rep">추천</option><option value="go">영입대상</option><option value="done">확정</option><option value="mixed">배치별 상이</option>')+'</select></label><label>포지션<select name="position" aria-label="포지션"><option value="">모든 포지션</option></select></label></div><input class="bsi-search" name="search" type="search" placeholder="이름·소속팀·등번호 검색" aria-label="'+noun+' 검색"><div class="bsi-selection"><span data-count aria-live="polite"></span><button type="button" class="btn" data-all>표시된 '+noun+' 선택</button><button type="button" class="btn" data-none>전체 해제</button></div><div class="bsi-list"></div></div><footer><p>'+(isTraining?'선택한 명단으로 훈련 인원을 채웁니다. 재활·부상·불참 선수도 보드에는 포함됩니다. ':'')+'선택한 팀의 기존 자리에 이름·등번호를 입힙니다. 자리가 부족하면 대기 줄에 배치하며, 기존 선수 불러오기처럼 다른 장면·페이지에도 반영됩니다.</p><p data-error role="status"></p><div><button type="button" class="btn" data-cancel>취소</button><button type="submit" class="btn primary" data-load>불러오기</button></div></footer></form>';
      var form=d.querySelector('form'),search=form.elements.search,status=form.elements.stage,position=form.elements.position,box=d.querySelector('.bsi-list'),load=d.querySelector('[data-load]');
      if(kind==='team')Array.from(new Set(list.map(function(p){return p.status;}))).forEach(function(g){var match=list.find(function(p){return p.status===g;}),o=el('option','',match.club);o.value=g||'__none';status.appendChild(o);});
      Array.from(new Set(list.flatMap(function(p){return p.positions;}))).forEach(function(p){var o=el('option','',p);o.value=p;position.appendChild(o);});
      function visible(){var shown=filter(list,search.value,status.value==='__none'?'':status.value,position.value);return status.value==='__none'?shown.filter(function(p){return !p.status;}):shown;}
      function count(){d.querySelector('[data-count]').textContent=selected.size+'명 선택 / 전체 '+list.length+'명';load.textContent=selected.size+'명 불러오기';load.disabled=!selected.size;}
      function paint(){box.textContent='';var shown=visible();
        shown.forEach(function(p){var label=el('label','bsi-candidate'),input=el('input');input.type='checkbox';input.checked=selected.has(p.id);input.disabled=!p.name;input.value=p.id;input.setAttribute('aria-label',(p.name||'이름 미등록')+' 선택');input.onchange=function(){if(input.checked)selected.add(p.id);else selected.delete(p.id);count();};
          var text=el('span','bsi-person');text.appendChild(el('strong','',p.name||'이름 미등록'));text.appendChild(el('small','',[p.club,p.no?'#'+p.no:'',p.positions.join(' / ')||'포지션 미지정'].filter(Boolean).join(' · ')));label.append(input,text,el('span','bsi-stage',kind==='team'?p.club:STAGES[p.status]));box.appendChild(label);});
        if(!shown.length)box.appendChild(el('p','bsi-empty',list.length?'검색 조건에 맞는 '+noun+'가 없어요.':label+'에 등록된 '+noun+'가 없어요.'));count();
      }
      search.oninput=paint;search.onkeydown=function(e){if(e.key==='Enter')e.preventDefault();};status.onchange=paint;position.onchange=paint;
      d.querySelector('[data-all]').onclick=function(){visible().forEach(function(p){if(p.name)selected.add(p.id);});paint();};d.querySelector('[data-none]').onclick=function(){selected.clear();paint();};
      function close(){d.close();}
      d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
      // Prevent the board shortcuts from handling typing/Enter while the native dialog holds focus.
      function key(e){if(!d.open)return;if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'&&(e.isComposing||e.keyCode===229))e.preventDefault();e.stopPropagation();}
      d.addEventListener('keydown',key);d.addEventListener('keyup',key);
      var timer=win.setInterval(function(){try{source.check();if(!editable()||target!==destination())throw Error();}catch(_){close();win.toast('팀·권한 또는 명단이 바뀌어 불러오기 창을 닫았어요. 다시 열어 주세요.');}},500);
      d.addEventListener('close',function(){win.clearInterval(timer);d.remove();if(button.isConnected)button.focus();});
      form.onsubmit=function(e){e.preventDefault();if(e.isComposing||opening)return;
        try{source.check();if(!editable()||target!==destination())throw Error('지금은 이 보드를 편집할 수 없어요.');
          var chosen=list.filter(function(p){return selected.has(p.id)&&p.name;}),side=form.elements.side.value;if(!chosen.length||!['blue','red'].includes(side))return;
          apply(win,chosen,side,label,isTraining);close();
        }catch(err){d.querySelector('[data-error]').textContent=err.message||'명단을 다시 열어 주세요.';}
      };
      paint();document.body.appendChild(d);d.showModal();search.focus();
    };
  }
  function apply(win,list,side,label,isTraining){
    var st=state,L=win.PSTeamLoad,cur=st.players.filter(function(p){return p.team===side&&!p.coach;}),fe=win.document.getElementById(side==='red'?'formAway':'formHome'),flip=cur.length?win._sqTokFlip(cur):side==='red';
    var plan=L.plan(cur.length?win._sqTokSlots(cur,flip):(FORM[fe&&fe.value]||FORM['433']),list,{keep:cur.length>0,code:win.posCode,base:win.posBase,group:win.posGroup}),fresh=[];
    win.pushUndo();cur.forEach(function(p,i){L.dress(p,list[plan.pick[i]]);});
    plan.add.forEach(function(a){var at=n2u(flip?1-a.x:a.x,flip?1-a.y:a.y),p=L.dress({id:uid++,team:side,num:a.p.no||'',pos:a.p.pos||'',x:at.x,y:at.y},a.p);st.players.push(p);fresh.push(p);});
    L.frames(anim.frames,animActive,cur,fresh);if(isTraining)win.syncEpRosterUI({counts:trainingCounts(list),syncInputs:true,persist:true});sel=null;multiSel=[];win.renderTokens();win.renderDrawings();win.autoSaveAnimFrame();if(win.boardSaveLive)win.boardSaveLive();win.toast(label+' · '+list.length+'명 불러옴'+(plan.bench?' · 대기 '+plan.bench+'명':''));
  }
  return {rows:rows,teamRows:teamRows,trainingCounts:trainingCounts,teamContext:teamContext,filter:filter,read:read,install:install};
});
