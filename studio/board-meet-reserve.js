/* Meeting reserve: a separate lineup immediately after BEST, with the same pitch and formation. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSMeetReserve=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});else api.install(root);}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function isBest(s){return !!s&&/^(BEST\s+(11|8)|선발\s*(11|8))\b/i.test(s.title||'');}
  function isReserve(s){return !!s&&(s.reserve===true||/^RESERVE$/i.test(s.title||'')||/^리저브$/.test(s.title||'')||(s.snap&&s.snap.players||[]).some(function(p){return p&&p.meetingRole==='reserve';}));}
  function spreadTargets(slides,index){return slides.map(function(s,i){return isReserve(slides[index])?(i===index?s:null):(isReserve(s)?null:s);});}
  function additions(players,count,box){
    if(!Number.isInteger(count)||count<1||count>30)return [];
    var used=Object.create(null),n=0,occupied=(players||[]).map(function(p){return {x:+p.x,y:+p.y};}),out=[];
    (players||[]).forEach(function(p){var v=String(p.num==null?'':p.num);used[v]=true;if(/^\d{1,6}$/.test(v))n=Math.max(n,+v);});
    for(var i=0;i<count;i++){
      var best=null,score=-1;
      for(var x=0;x<13;x++)for(var y=0;y<9;y++){
        var p={x:box.x+box.w*(.08+.84*x/12),y:box.y+box.h*(.08+.84*y/8)},d=Infinity;
        occupied.forEach(function(q){d=Math.min(d,(q.x-p.x)*(q.x-p.x)+(q.y-p.y)*(q.y-p.y));});
        if(d>score){best=p;score=d;}
      }
      do{n++;}while(used[String(n)]);used[String(n)]=true;
      best.num=String(n);out.push(best);occupied.push(best);
    }
    return out;
  }
  function create(best){
    var s={title:'RESERVE',reserve:true,reserveV:2,snap:clone(best.snap||{}),points:[]},sn=s.snap;
    ['pdfOrientation','pageBrand','textStyles'].forEach(function(k){if(best[k]!=null)s[k]=clone(best[k]);});
    var players=lineup(sn),nums=lineupNumbers(players);
    sn.players=players.map(function(p,i){
      // Match tactical numbers and size; reserve identity and names remain independent.
      var q={id:2001+i,team:'blue',num:nums[i],pos:p.pos||'',x:p.x,y:p.y,meetingRole:'reserve'};
      if(p.scale!=null)q.scale=p.scale;return q;
    });
    sn.equipment=[];sn.drawings=[];sn.ball=null;
    return s;
  }
  function lineup(sn){return (sn&&sn.players||[]).filter(function(p){return p&&p.team==='blue'&&!p.coach;});}
  function lineupNumbers(players){
    var nums=players.map(function(p){return String(p.num);}),n=players.length;
    return nums.every(function(v){return /^[1-9]\d*$/.test(v)&&+v<=n;})&&new Set(nums).size===n?nums:players.map(function(p,i){return String(i+1);});
  }
  // Correct the original generated reserve once, including its animation scenes.
  // Custom numbers, names, positions and additional players are retained.
  function upgrade(slides){
    var best=(slides||[]).find(isBest),base=best&&best.snap,players=lineup(base),nums=lineupNumbers(players),changed=[];
    if(!base||!players.length)return changed;
    (slides||[]).forEach(function(s){
      if(!isReserve(s)||s.reserveV>=2||!s.snap)return;
      var snaps=[s.snap],first=s.snap.pitchSpec==='u12'?9:12;
      (s.frames||[]).forEach(function(f){if(f&&f.snap&&snaps.indexOf(f.snap)<0)snaps.push(f.snap);});
      var renumber=snaps.every(function(sn){var ps=lineup(sn);return players.every(function(p,i){return ps.some(function(q){return q.id===2001+i&&String(q.num)===String(first+i);});})&&ps.every(function(q){return q.id>=2001&&q.id<2001+players.length||nums.indexOf(String(q.num))<0;});});
      snaps.forEach(function(sn){
        ['tokenScale','tokV'].forEach(function(k){if(base[k]!=null)sn[k]=base[k];else delete sn[k];});
        lineup(sn).forEach(function(p){var i=p.id-2001,q=players[i];if(!q)return;if(renumber)p.num=nums[i];if(q.scale!=null)p.scale=q.scale;else delete p.scale;});
      });
      s.reserveV=2;delete s.thumb;(s.frames||[]).forEach(function(f){if(f)delete f.thumb;});changed.push(s);
    });
    return changed;
  }
  function withReserve(list){
    if(!Array.isArray(list)||list.some(isReserve))return list;
    var i=list.findIndex(isBest);if(i<0)return list;
    var out=list.slice();out.splice(i+1,0,create(list[i]));return out;
  }
  function install(win){
    if(win.__psMeetReserve)return;win.__psMeetReserve=true;
    var doc=win.document,M=win.__meet;
    var upgradeMeeting=win.__meetUpgrade,upgradeText=win.__meetUpgradeText;
    win.__meetUpgrade=function(){var r=upgradeMeeting.apply(this,arguments)||{},changed=upgrade(M.frames());changed.forEach(thumb);if(changed.length){r.reserve=changed.length;r.changed=true;}return r;};
    win.__meetUpgradeText=function(r){var text=upgradeText.apply(this,arguments);return r&&r.reserve?((r.best||r.names||r.brand)?text+' · ':'예전에 만든 미팅을 새 규칙으로 맞췄어요 — ')+'리저브 번호·크기 '+r.reserve+'장':text;};
    function editable(){return M&&doc.body.classList.contains('meet-mode')&&!win.__vaultReadOnly&&!(win.communityBoardReadOnly&&win.communityBoardReadOnly())&&!win.__meetVideoBusy&&!win.__animExport;}
    function current(){return M&&M.frames()[M.idx()];}
    function canAddPlayers(){return editable()&&isReserve(current())&&!doc.body.classList.contains('focus-board')&&!win.__ksNav&&!win.__psThumbCapturing;}
    function addPlayers(count){
      if(!canAddPlayers())return false;
      /* state/uid are lexical board globals. Reuse its undo and save path. */
      var st=typeof state!=='undefined'?state:null;if(!st)return false;
      var a=n2u(0,0),b=n2u(1,1);
      var plan=additions(st.players,count,{x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y});if(!plan.length)return false;
      win.pushUndo();current().reserve=true;
      plan.forEach(function(p){st.players.push({id:uid++,team:'blue',num:p.num,pos:'',x:p.x,y:p.y,meetingRole:'reserve'});});
      win.renderTokens();M.saveCur();if(win.__vaultAutoSaveSchedule)win.__vaultAutoSaveSchedule();
      win.toast('리저브에 '+count+'명을 추가했어요 — 이 페이지에만 적용돼요');return true;
    }
    function askPlayers(){
      if(!canAddPlayers()||doc.getElementById('psReservePlayers'))return;
      var owner=current(),d=doc.createElement('dialog');d.id='psReservePlayers';d.setAttribute('aria-labelledby','psReservePlayersTitle');
      d.innerHTML='<form><h3 id="psReservePlayersTitle">리저브 선수 추가</h3><p>선수 추가와 수정은 이 페이지에만 적용돼요.</p><label>추가할 인원<input name="count" aria-label="추가할 인원" type="number" min="1" max="30" step="1" value="1" required></label><div class="rp-actions"><button type="button" data-cancel>취소</button><button type="submit">추가</button></div></form>';
      var st=typeof state!=='undefined'?state:null;
      d.querySelector('p').textContent='현재 '+((st&&st.players)||[]).filter(function(p){return !p.coach;}).length+'명 · 선수 추가와 수정은 이 페이지에만 적용돼요.';
      function close(){d.close();}
      function key(e){if(!d.open)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}}
      d.addEventListener('close',function(){win.removeEventListener('keydown',key,true);win.removeEventListener('keyup',key,true);d.remove();var b=doc.getElementById('psReservePlayersAdd');if(b)b.focus();});
      d.querySelector('[data-cancel]').onclick=close;
      d.querySelector('form').onsubmit=function(e){e.preventDefault();if(owner!==current()||!canAddPlayers()){close();return;}if(addPlayers(d.querySelector('input').valueAsNumber))close();};
      win.addEventListener('keydown',key,true);win.addEventListener('keyup',key,true);doc.body.appendChild(d);d.showModal();d.querySelector('input').select();
    }
    function thumb(s){s.thumb=win.__snapToThumb?win.__snapToThumb(s.snap):'';return s;}
    function templates(fn){return function(base,skipFirst){var args=Array.prototype.slice.call(arguments);args[1]=false;var out=withReserve(fn.apply(this,args));return skipFirst?out.filter(function(s){return !isBest(s);}):out;};}
    win.__meetTplSlides=templates(win.__meetTplSlides);
    if(win.PSMeet8)win.PSMeet8.slides=templates(win.PSMeet8.slides);
    var titles=win.__meetTpl;win.__meetTpl=function(){return withReserve(titles().map(function(t){return {title:t,snap:{}};})).map(function(s){return s.title;});};
    var seed=win.__meetSeed;
    win.__meetSeed=function(){var ok=seed.apply(this,arguments);if(ok){var list=M.frames(),next=withReserve(list);if(next!==list){list.splice(1,0,thumb(next[1]));if(win.__ksRender)win.__ksRender();}}return ok;};
    // Existing meetings are unchanged until the coach explicitly adds the reserve slide.
    function add(){
      if(!editable())return false;
      M.saveCur();var list=M.frames(),best=list.findIndex(isBest);
      if(best<0||list.some(isReserve))return false;
      var s=thumb(create(list[best])),source=list[best];
      M.newSlide(s.title,[]);var at=M.idx(),current=M.frames()[at];
      Object.assign(current,s);delete current.frames;win.loadSnap(current.snap);
      var target=M.frames().indexOf(source);M.move(at,target+(at<target?0:1));M.go(M.frames().indexOf(current),'first');
      if(win.__vaultAutoSaveSchedule)win.__vaultAutoSaveSchedule();return true;
    }
    var render=win.__ksRender;
    win.__ksRender=function(){
      // Keep the reserve identity when its title is changed or all players are removed; never alter read-only data.
      if(editable())M.frames().forEach(function(s){if(isReserve(s))s.reserve=true;});
      var r=render.apply(this,arguments),list=M.frames(),i=list.findIndex(isBest),strip=doc.getElementById('ksStrip');
      if(editable()&&strip&&i>=0&&!list.some(isReserve)){
        var card=strip.querySelectorAll('.ksc')[i];if(card){var b=doc.createElement('button');b.type='button';b.id='psMeetReserveAdd';b.className='ksadd';b.textContent='＋ 리저브';b.onclick=add;card.insertAdjacentElement('afterend',b);}
      }
      var bar=doc.querySelector('#ksTop .ksbar');
      if(editable()&&isReserve(current())&&bar&&!doc.body.classList.contains('focus-board')){
        var b=doc.createElement('button');b.type='button';b.id='psReservePlayersAdd';b.textContent='＋ 선수 추가';b.title='리저브 선수 추가 · 이 페이지에만 적용';b.onclick=askPlayers;
        var anchor=bar.querySelector('.ksmode');bar.insertBefore(b,anchor?anchor.nextSibling:bar.firstChild);
      }return r;
    };
    win.__meetAddReserve=add;
    win.__meetAddReservePlayers=addPlayers;
    var boardAddPlayers=win.addPlayers;
    win.addPlayers=function(team,count){return doc.body.classList.contains('meet-mode')&&isReserve(current())&&team==='blue'?addPlayers(Number(count)):boardAddPlayers.apply(this,arguments);};
    var sitNames=win.__sitApplyNames;
    if(sitNames)win.__sitApplyNames=function(){return doc.body.classList.contains('meet-mode')&&isReserve(current())?null:sitNames.apply(this,arguments);};
  }
  return {isBest:isBest,isReserve:isReserve,create:create,upgrade:upgrade,withReserve:withReserve,spreadTargets:spreadTargets,additions:additions,install:install};
});
