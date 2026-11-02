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
  // The same owner, permissions, source bytes and durable copies must still be current at import.
  async function read(win){
    var S=win.PSScoutStore,client=S.createClient(win),doc=await client.prepare(),snap={};
    for(var key of [TEAM,TOMBS]){
      var raw=win.localStorage.getItem(key);snap[key]=raw;
      if(key===TOMBS)continue; // Deletion tombstones are LS-authoritative (storage-keys.js).
      await win.PSStorage.sharedReady(key);
      if(raw!=null)await win.PSStorage.sharedVerified(key,raw);
      else {var v=await win.storage.get(key);if(v&&v.value)throw Error('명단 자료를 다시 불러와 주세요.');}
    }
    // keyReady is issued for the candidate document by createClient, not for the general roster/tombstone keys.
    function check(){client.check();Object.keys(snap).forEach(function(key){if(win.localStorage.getItem(key)!==snap[key])throw Error('명단이 바뀌었습니다. 창을 닫고 다시 열어 주세요.');});}
    check();return {check:check,doc:doc,team:JSON.parse(snap[TEAM]||'{}'),tombs:JSON.parse(snap[TOMBS]||'{}')};
  }
  function install(win){
    var document=win.document;if(document.getElementById('boardScoutRow'))return;
    function editable(){return typeof state!=='undefined'&&win.__boardReady&&win.__boardRestoreDone&&!win.__vaultReadOnly&&!(win.psPhoneBoardReadOnly&&win.psPhoneBoardReadOnly())&&!(win.communityBoardReadOnly&&win.communityBoardReadOnly())&&!win.__ksNav&&!win.__animExport&&!win.__meetVideoBusy&&!(typeof animPlaying!=='undefined'&&animPlaying);}
    function allowed(){try{win.PSScoutStore.context(win,false);return true;}catch(_){return false;}}
    function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
    var anchor=document.getElementById('squadGrpRow');if(!anchor)return;
    var row=el('div','menurow'),button=el('button','btn','불러오기');row.id='boardScoutRow';row.appendChild(el('span','menulbl','스카우팅 명단'));button.id='loadScoutRosterBtn';button.type='button';button.setAttribute('aria-label','스카우팅 명단 불러오기');row.appendChild(button);anchor.after(row);
    function refresh(){row.hidden=!allowed();row.style.setProperty('display',row.hidden?'none':'flex','important');button.disabled=!editable();}
    refresh();document.addEventListener('click',refresh,true);win.addEventListener('ps-auth-state',refresh);win.addEventListener('ps-perms-changed',refresh);win.setInterval(refresh,1500);
    var opening=false;
    button.onclick=async function(){
      if(opening||!editable()||!allowed()||document.getElementById('boardScoutDialog'))return;opening=true;button.disabled=true;
      var source;try{source=await read(win);}catch(_){win.toast('스카우팅 명단을 확인하지 못했어요. 팀 자료가 준비된 뒤 다시 열어 주세요.');}finally{opening=false;refresh();}
      if(!source||!editable()||!allowed())return;
      document.querySelectorAll('.popmenu.on').forEach(function(m){m.classList.remove('on');});
      var list=rows(source.doc,source.team,source.tombs,win.PSScoutStore,win.posCode),selected=new Set(list.filter(function(p){return p.name;}).map(function(p){return p.id;}));
      var d=el('dialog');d.id='boardScoutDialog';d.setAttribute('aria-labelledby','boardScoutTitle');
      d.innerHTML='<form><header><div><h2 id="boardScoutTitle">스카우팅 명단 불러오기</h2><p>팀 운영 › 스카우팅에 등록된 후보입니다.</p></div><button type="button" class="btn" data-close aria-label="스카우팅 명단 닫기">닫기</button></header><div class="bsi-body"><div class="bsi-controls"><label>배치할 팀<select name="side" aria-label="배치할 팀"><option value="blue">팀 1</option><option value="red">팀 2</option></select></label><label>영입 단계<select name="stage" aria-label="영입 단계"><option value="">모든 단계</option><option value="rep">추천</option><option value="go">영입대상</option><option value="done">확정</option><option value="mixed">배치별 상이</option></select></label><label>포지션<select name="position" aria-label="포지션"><option value="">모든 포지션</option></select></label></div><input class="bsi-search" name="search" type="search" placeholder="이름·소속팀·등번호 검색" aria-label="후보 검색"><div class="bsi-selection"><span data-count aria-live="polite"></span><button type="button" class="btn" data-all>표시된 후보 선택</button><button type="button" class="btn" data-none>전체 해제</button></div><div class="bsi-list"></div></div><footer><p>선택한 팀의 기존 자리에 이름·등번호를 입힙니다. 자리가 부족하면 대기 줄에 배치하며, 기존 선수 불러오기처럼 다른 장면·페이지에도 반영됩니다.</p><p data-error role="status"></p><div><button type="button" class="btn" data-cancel>취소</button><button type="submit" class="btn primary" data-load>불러오기</button></div></footer></form>';
      var form=d.querySelector('form'),search=form.elements.search,status=form.elements.stage,position=form.elements.position,box=d.querySelector('.bsi-list'),load=d.querySelector('[data-load]');
      Array.from(new Set(list.flatMap(function(p){return p.positions;}))).forEach(function(p){var o=el('option','',p);o.value=p;position.appendChild(o);});
      function visible(){return filter(list,search.value,status.value,position.value);}
      function count(){d.querySelector('[data-count]').textContent=selected.size+'명 선택 / 전체 '+list.length+'명';load.textContent=selected.size+'명 불러오기';load.disabled=!selected.size;}
      function paint(){box.textContent='';var shown=visible();
        shown.forEach(function(p){var label=el('label','bsi-candidate'),input=el('input');input.type='checkbox';input.checked=selected.has(p.id);input.disabled=!p.name;input.value=p.id;input.setAttribute('aria-label',(p.name||'이름 미등록')+' 선택');input.onchange=function(){if(input.checked)selected.add(p.id);else selected.delete(p.id);count();};
          var text=el('span','bsi-person');text.appendChild(el('strong','',p.name||'이름 미등록'));text.appendChild(el('small','',[p.club,p.no?'#'+p.no:'',p.positions.join(' / ')||'포지션 미지정'].filter(Boolean).join(' · ')));label.append(input,text,el('span','bsi-stage',STAGES[p.status]));box.appendChild(label);});
        if(!shown.length)box.appendChild(el('p','bsi-empty',list.length?'검색 조건에 맞는 후보가 없어요.':'스카우팅에 등록된 후보가 없어요.'));count();
      }
      search.oninput=paint;search.onkeydown=function(e){if(e.key==='Enter')e.preventDefault();};status.onchange=paint;position.onchange=paint;
      d.querySelector('[data-all]').onclick=function(){visible().forEach(function(p){if(p.name)selected.add(p.id);});paint();};d.querySelector('[data-none]').onclick=function(){selected.clear();paint();};
      function close(){d.close();}
      d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
      // Prevent the board shortcuts from handling typing/Enter while the native dialog holds focus.
      function key(e){if(!d.open)return;if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Enter'&&(e.isComposing||e.keyCode===229))e.preventDefault();e.stopPropagation();}
      d.addEventListener('keydown',key);d.addEventListener('keyup',key);
      var timer=win.setInterval(function(){try{source.check();if(!editable())throw Error();}catch(_){close();win.toast('팀·권한 또는 명단이 바뀌어 불러오기 창을 닫았어요. 다시 열어 주세요.');}},500);
      d.addEventListener('close',function(){win.clearInterval(timer);d.remove();if(button.isConnected)button.focus();});
      form.onsubmit=function(e){e.preventDefault();if(e.isComposing||opening)return;
        try{source.check();if(!editable())throw Error('지금은 보드를 편집할 수 없어요.');
          var chosen=list.filter(function(p){return selected.has(p.id)&&p.name;}),side=form.elements.side.value;if(!chosen.length||!['blue','red'].includes(side))return;
          apply(win,chosen,side);close();
        }catch(err){d.querySelector('[data-error]').textContent=err.message||'명단을 다시 열어 주세요.';}
      };
      paint();document.body.appendChild(d);d.showModal();search.focus();
    };
  }
  function apply(win,list,side){
    var st=state,L=win.PSTeamLoad,cur=st.players.filter(function(p){return p.team===side&&!p.coach;}),fe=win.document.getElementById(side==='red'?'formAway':'formHome'),flip=cur.length?win._sqTokFlip(cur):side==='red';
    var plan=L.plan(cur.length?win._sqTokSlots(cur,flip):(FORM[fe&&fe.value]||FORM['433']),list,{keep:cur.length>0,code:win.posCode,base:win.posBase,group:win.posGroup}),fresh=[];
    win.pushUndo();cur.forEach(function(p,i){L.dress(p,list[plan.pick[i]]);});
    plan.add.forEach(function(a){var at=n2u(flip?1-a.x:a.x,flip?1-a.y:a.y),p=L.dress({id:uid++,team:side,num:a.p.no||'',pos:a.p.pos||'',x:at.x,y:at.y},a.p);st.players.push(p);fresh.push(p);});
    L.frames(anim.frames,animActive,cur,fresh);sel=null;multiSel=[];win.renderTokens();win.renderDrawings();win.autoSaveAnimFrame();if(win.boardSaveLive)win.boardSaveLive();win.toast('스카우팅 · '+list.length+'명 불러옴'+(plan.bench?' · 대기 '+plan.bench+'명':''));
  }
  return {rows:rows,filter:filter,read:read,install:install};
});
