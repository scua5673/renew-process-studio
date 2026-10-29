/* Weekly IDP is a view of the existing diary and scene reactions. No separate document. */
(function(root,factory){
  'use strict';var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSIDPWeeklyGrowth=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function date(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function add(s,n){var d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return date(d);}
  function monday(s){var d=new Date(s+'T12:00:00');return add(s,-((d.getDay()+6)%7));}
  function short(s){return String(s).slice(5).replace('-','.');}
  function publicDoc(raw){
    try{var d=raw==null?{}:JSON.parse(raw);return object(d)&&(!Object.prototype.hasOwnProperty.call(d,'v')||d.v===1)&&(d.reacts==null||object(d.reacts))?d:null;}catch(_){return null;}
  }
  function weekData(d,pub,today){
    var start=monday(today),end=add(start,6),logs=object(d.log)?d.log:{},reacts=pub&&object(pub.reacts)?pub.reacts:{};
    var scenes=Object.keys(logs).filter(function(k){return /^\d{4}-\d{2}-\d{2}$/.test(k)&&k>=start&&k<=today&&object(logs[k])&&typeof logs[k].memo==='string'&&logs[k].memo.trim();}).sort().reverse().map(function(k){return {day:k,log:logs[k],reaction:object(reacts['day:'+k])?reacts['day:'+k]:{}};});
    var questions=scenes.filter(function(s){return typeof s.reaction.t==='string'&&s.reaction.t.trim();}).sort(function(a,b){return (+b.reaction.tAt||+b.reaction.at||0)-(+a.reaction.tAt||+a.reaction.at||0);});
    return {start:start,end:end,scenes:scenes,question:questions[0]||null,today:object(logs[today])?logs[today]:{}};
  }
  function attemptPatch(log,value,action){
    if(!action||!action.text||['0','1','none'].indexOf(value)<0)return null;
    var patch={try:value==='none'?null:Number(value),tryOpportunity:value==='none'?false:null};
    if(value==='1'&&action.behavior&&!log.visionEvidence&&!log.visionBehaviorId)patch.visionEvidence={id:action.behavior.id,text:action.behavior.text,revision:action.revision||''};
    return patch;
  }
  function state(log){return log.tryOpportunity===false?'none':log.try>0?'1':log.try===0?'0':'';}
  function stateLabel(log){return log.tryOpportunity===false?'기회가 없었어':log.try===2?'계속 해봤어':log.try===1?'해봤어':log.try===0?'아직 못 해봤어':'시도 미기록';}
  function button(label,attrs,primary){return '<button type="button" class="'+(primary?'ps-btn-primary':'ps-btn-secondary')+'" '+(attrs||'')+'>'+label+'</button>';}
  function link(label,to){return '<button type="button" class="ps-btn-text" data-wg-go="'+to+'">'+label+' <span aria-hidden="true">↗</span></button>';}
  function empty(s){return '<p class="wg-empty">'+esc(s)+'</p>';}
  function focus(m){return '<div class="wg-focus"><span class="wg-eyebrow">이번 주 집중할 한 가지</span><h2>'+esc(m.action.text||'훈련에서 해볼 행동 하나를 정해요.')+'</h2>'+(m.statement?'<p>내 방향 · '+esc(m.statement)+'</p>':'')+'</div>';}
  function schedule(m){return '<div class="wg-schedule"><span class="wg-eyebrow">이번 주 팀 훈련·경기</span>'+(m.sessions.length?'<ul>'+m.sessions.map(function(s){return '<li><time>'+short(s.day)+'</time><span>'+esc(s.text)+'</span></li>';}).join('')+'</ul><p class="wg-hint">이 일정에서 집중할 행동을 떠올려 보세요.</p>':empty('연결된 팀 일정이 아직 없어요.'))+'</div>';}
  function personal(m,coach){return '<details class="wg-personal"><summary>개인 훈련 · 선택</summary>'+(m.personal.length?m.personal.map(function(t){return '<p><b>'+esc(t.title)+'</b><small>'+esc(t.when)+'</small></p>';}).join(''):empty('등록한 개인 훈련이 아직 없어요.'))+(coach?'':link('개인 훈련·루틴 열기','routine'))+'</details>';}
  function scene(s,latest){return '<article class="wg-scene'+(latest?' wg-scene-featured':'')+'"><div class="wg-meta"><time>'+short(s.day)+'</time><span>'+stateLabel(s.log)+'</span></div><p>'+esc(s.log.memo)+'</p>'+(s.log.visionEvidence&&s.log.visionEvidence.text?'<small>연결한 행동 · '+esc(s.log.visionEvidence.text)+'</small>':'')+(s.log.next?'<div class="wg-next-read"><b>다음 시도</b> '+esc(s.log.next)+'</div>':'')+'</article>';}
  function scenes(w){return w.scenes.length?w.scenes.map(function(s,i){return scene(s,i===0);}).join(''):empty('아직 남긴 장면이 없어요. 잘된 순간도, 어려웠던 순간도 괜찮아요.');}
  function question(w){var s=w.question;return '<section class="wg-panel wg-question"><span class="wg-eyebrow">코치가 함께 생각할 질문</span>'+(s?'<blockquote>'+esc(s.reaction.t)+'</blockquote><p class="wg-hint">'+esc(s.reaction.tBy||s.reaction.by||'코치')+' · '+short(s.day)+' 장면에 남긴 질문'+(s.reaction.nextAt?' · 다음 확인 '+esc(short(s.reaction.nextAt)):'')+'</p>':empty('코치가 질문을 남기면 여기에 보여요.'))+'</section>';}
  function create(api){
    var selected='',selectionOwner='',model=null,coachView=false,drafts=Object.create(null),notice='';
    function draftKey(m){return m.owner+'|'+m.key+'|'+m.week.scenes[0].day;}
    function draft(m,reset){
      var s=m.week.scenes[0],k=draftKey(m),d=drafts[k];
      if(!d||reset)d=drafts[k]={t:s.reaction.t||'',nextAt:s.reaction.nextAt||'',sceneRaw:JSON.stringify(s.log),reactionRaw:JSON.stringify(s.reaction),dirty:false};
      return d;
    }
    function renderPlayer(){
      coachView=false;model=api.player();var m=model,w=m.week,lg=w.today,disabled=m.writable?'':' disabled';
      return '<div class="wg-root" data-wg-root><header class="wg-heading"><div><span class="wg-eyebrow">MY DEVELOPMENT · '+short(w.start)+' — '+short(w.end)+'</span><h1>이번 주, 한 걸음.</h1><p>한 가지를 해보고, 내 장면에서 다음 시도를 찾아요.</p></div>'+link('일지 전체 보기','cal')+'</header>'
        +'<div class="wg-player-grid"><section class="wg-panel wg-main">'+focus(m)+link(m.action.text?'목표·내 방향 보기':'행동 하나 정하기','goal')+schedule(m)+personal(m,false)
        +'<div class="wg-section"><div class="wg-section-title"><h3>오늘의 시도</h3><time>'+short(m.today)+'</time></div><div class="wg-attempts" role="group" aria-label="오늘의 시도">'
        +[['0','아직 못 해봤어'],['1',lg.try===2?'계속 해봤어':'해봤어'],['none','기회가 없었어']].map(function(x){return '<button type="button" data-wg-attempt="'+x[0]+'" aria-pressed="'+(state(lg)===x[0])+'"'+(!m.action.text||m.rest? ' disabled':disabled)+'>'+x[1]+'</button>';}).join('')+'</div>'
        +(m.rest?'<p class="wg-hint">쉬는 날에는 시도를 기록하지 않아요.</p>':'')
        +'<label class="wg-label" for="wg-scene">어떤 장면이 기억나?</label><textarea id="wg-scene" rows="4" maxlength="3000" placeholder="언제, 무엇을 해봤고, 어떤 일이 있었는지 적어봐요."'+disabled+'>'+esc(lg.memo||'')+'</textarea><div class="wg-actions"><span class="wg-hint">일지와 함께 자동 저장돼요.</span>'+button('장면 남기기','data-wg-save="memo"'+disabled,true)+'</div></div>'
        +'<div class="wg-section"><label class="wg-label" for="wg-next">다음에는 무엇을 해볼까?</label><textarea id="wg-next" rows="2" maxlength="500" placeholder="다음 훈련에서 해볼 행동 하나"'+disabled+'>'+esc(lg.next||'')+'</textarea><div class="wg-actions">'+button('내 다음 시도로 정하기','data-wg-save="next"'+disabled)+'</div></div><p class="wg-status" role="status" aria-live="polite">'+esc(notice)+'</p></section>'
        +'<aside class="wg-aside"><section class="wg-panel"><div class="wg-section-title"><h3>이번 주 남긴 장면</h3><span>'+w.scenes.length+'개</span></div>'+scenes(w)+'</section>'+question(w)
        +'<section class="wg-panel"><span class="wg-eyebrow">성장 리뷰 · 6주</span><h3>'+(m.reviewNext?'다음 리뷰 · '+esc(m.reviewNext):'작은 장면을 모아 돌아봐요.')+'</h3><p class="wg-hint">평가·성장 리뷰와 코치와의 대화에서 변화를 확인해요.</p><div class="wg-actions">'+link('평가·성장 리뷰','profile')+link('이야기','story')+'</div></section></aside></div></div>';
    }
    function renderCoach(){
      coachView=true;var data=api.coach(selected);if(data.owner!==selectionOwner){selected='';selectionOwner=data.owner;data=api.coach(selected);}model=data.model;
      if(model)selected=model.id;
      var h='<div class="wg-root" data-wg-root><header class="wg-heading"><div><span class="wg-eyebrow">WEEKLY DEVELOPMENT</span><h1>오늘 한 장, 다음 한 걸음.</h1><p>선수의 장면을 읽고, 다음 시도로 이어질 질문 하나를 남겨요.</p></div></header><div class="wg-coach-grid"><aside class="wg-panel wg-roster"><h3>선수의 이번 주</h3><p class="wg-hint">'+(data.waiting?'자료 받는 중':data.rows.length+'명 · 선수를 골라 장면 읽기')+'</p><div class="wg-roster-list">';
      h+=data.rows.map(function(r){return '<button type="button" data-wg-player="'+esc(r.id)+'" aria-pressed="'+(r.id===selected)+'"><span class="wg-avatar">'+esc(r.num||'—')+'</span><span><b>'+esc(r.name)+'</b><small>'+esc(r.position||'')+' · '+(r.state==='ready'?(r.count?'장면 '+r.count+'개':'이번 주 장면 없음'):esc(r.message))+'</small></span><span class="wg-arrow" aria-hidden="true">›</span></button>';}).join('');
      h+='</div></aside><div class="wg-coach-detail">';
      if(!model)h+=data.waiting?'<section class="wg-panel" role="status"><h2>팀 자료를 받는 중이에요</h2><p class="wg-hint">받는 대로 선수 명단과 피드백이 나타나요.</p></section>':'<section class="wg-panel">'+empty('선수 명단이 준비되면 성장 카드를 볼 수 있어요.')+'</section>';
      else if(model.state!=='ready')h+='<section class="wg-panel"><h2>'+esc(model.name)+'</h2>'+empty(model.message)+'</section>';
      else{
        var m=model,w=m.week,s=w.scenes[0];
        h+='<section class="wg-panel"><div class="wg-section-title"><h3>'+esc(m.name)+'의 성장 카드</h3><span>'+short(w.start)+' — '+short(w.end)+'</span></div>'+focus(m)+schedule(m)+personal(m,true)+(m.reviewNext?'<p class="wg-hint">다음 성장 리뷰 · '+esc(m.reviewNext)+'</p>':'')+'</section><section class="wg-panel"><h3>최근 장면</h3>'+(s?scene(s,true):empty('선수가 장면을 남기면 여기에 보여요.'));
        if(w.scenes.length>1)h+='<details class="wg-previous"><summary>이번 주 이전 장면 '+(w.scenes.length-1)+'개</summary>'+w.scenes.slice(1).map(function(x){return scene(x,false);}).join('')+'</details>';
        h+='</section>';
        if(s){var d=draft(m),stale=d.sceneRaw!==JSON.stringify(s.log)||d.reactionRaw!==JSON.stringify(s.reaction);
          h+='<section class="wg-panel wg-question"><div class="wg-section-title"><h3>함께 생각할 질문</h3><span>'+short(s.day)+' 장면에 연결</span></div><p class="wg-hint">답을 알려주기 전에, 선수가 본 것을 물어봐요. 기존 답글이 있으면 수정합니다.</p><div class="wg-prompts">'
            +['그때 무엇이 보였어?','다시 한다면 무엇을 바꿔볼까?'].map(function(t){return '<button type="button" data-wg-prompt="'+esc(t)+'">'+esc(t)+'</button>';}).join('')+'</div><label class="wg-label" for="wg-question">코치 질문</label><textarea id="wg-question" rows="3" maxlength="300" placeholder="장면을 읽고 질문 하나를 남겨주세요.">'+esc(d.t)+'</textarea><div class="wg-followup"><label for="wg-check">다음 확인일 <span class="wg-hint">선택</span></label><input id="wg-check" type="date" value="'+esc(d.nextAt)+'"></div>'
            +(stale?'<p class="wg-stale">장면이나 코치 답글이 바뀌었어요. 내 입력을 확인한 뒤 최신 내용으로 다시 시작해 주세요.</p>'+button('내 입력을 지우고 최신 질문 불러오기','data-wg-reload'):'')
            +'<div class="wg-actions"><span class="wg-hint">선수의 이번 주·일지·이야기에 보여요.</span>'+button('질문 저장하기','data-wg-send'+(stale?' disabled':''),true)+'</div><p class="wg-status" role="status" aria-live="polite">'+esc(notice)+'</p></section>';
        }
      }
      return h+'</div></div></div>';
    }
    function bind(root){
      var host=root.querySelector('[data-wg-root]');if(!host)return;
      var m=model,isCoachView=coachView;
      function status(s){notice=s;var el=host.querySelector('.wg-status');if(el)el.textContent=s;}
      function all(sel,fn){Array.prototype.forEach.call(host.querySelectorAll(sel),fn);}
      all('[data-wg-go]',function(b){b.onclick=function(){notice='';api.go(b.dataset.wgGo);};});
      all('[data-wg-player]',function(b){b.onclick=function(){selected=b.dataset.wgPlayer;notice='';api.render();};});
      if(!m)return;
      if(!isCoachView){
        all('[data-wg-attempt]',function(b){b.onclick=function(){var patch=attemptPatch(m.week.today,b.dataset.wgAttempt,m.action);if(!patch||!api.writePlayer(m,patch,true)){status('저장하지 못했어요. 화면의 저장 안내를 확인해 주세요.');return;}notice='오늘의 시도를 이 기기에 저장했어요.';api.render();};});
        ['scene','next'].forEach(function(id){var el=host.querySelector('#wg-'+id);if(!el)return;el.oninput=function(){var patch={};patch[id==='scene'?'memo':'next']=el.value;if(!api.writePlayer(m,patch,false))status('입력을 저장하지 못했어요. 내용을 복사한 뒤 저장 안내를 확인해 주세요.');};});
        all('[data-wg-save]',function(b){b.onclick=function(){var id=b.dataset.wgSave,el=host.querySelector(id==='memo'?'#wg-scene':'#wg-next');if(!el.value.trim()){status(id==='memo'?'기억나는 장면을 먼저 적어 주세요.':'다음에 해볼 행동을 먼저 적어 주세요.');el.focus();return;}var patch={};patch[id]=el.value;if(!api.writePlayer(m,patch,true)){status('저장을 확인하지 못했어요. 입력은 화면에 남아 있어요.');return;}notice=(id==='memo'?'장면':'다음 시도')+'을 이 기기에 저장했어요.';api.render();};});
      }else if(m.state==='ready'&&m.week.scenes.length){
        var d=draft(m),questionEl=host.querySelector('#wg-question'),check=host.querySelector('#wg-check');
        function capture(){d.t=questionEl.value;d.nextAt=check.value;d.dirty=true;status('작성 중 · 질문 저장하기를 눌러 마무리해 주세요.');}
        questionEl.oninput=capture;check.onchange=capture;
        all('[data-wg-prompt]',function(b){b.onclick=function(){questionEl.value=(questionEl.value.trim()?questionEl.value.trim()+'\n':'')+b.dataset.wgPrompt;questionEl.value=questionEl.value.slice(0,300);capture();questionEl.focus();};});
        all('[data-wg-reload]',function(b){b.onclick=function(){draft(m,true);notice='';api.render();};});
        all('[data-wg-send]',function(b){b.onclick=function(){if(!d.t.trim()){status('질문을 먼저 적어 주세요.');questionEl.focus();return;}if(!api.writeCoach(m,d)){status('저장을 확인하지 못했어요. 입력을 유지했어요. 최신 장면과 권한을 확인해 주세요.');return;}d.dirty=false;delete drafts[draftKey(m)];notice='질문을 이 기기에 저장했어요. 동기화 후 선수에게 보여요.';api.render();};});
      }
    }
    return {renderPlayer:renderPlayer,renderCoach:renderCoach,bind:bind,hasDraft:function(){return Object.keys(drafts).some(function(k){return drafts[k].dirty;});}};
  }
  return {create:create,weekData:weekData,attemptPatch:attemptPatch,state:state,publicDoc:publicDoc};
});
