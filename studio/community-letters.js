/* Process letters: a complete reading shelf, with the existing native training viewer. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSCommunityLetters=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function rich(s){return esc(s).replace(/&lt;(\/?)(b|strong|em|i)&gt;/gi,'<$1$2>').replace(/&lt;br\s*\/?&gt;/gi,'<br>');}
  function array(v){return Array.isArray(v)?v:[];}
  function nn(n){return String(n).padStart(2,'0');}
  function href(v){try{var u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch(_){return '';}}
  function link(url,label){var u=href(url);return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>':'';}
  function paras(rows){return array(rows).map(function(s){return '<p>'+rich(s)+'</p>';}).join('');}
  var READ_PREFIX='ps_comm_letters_read_v1:';
  function readHistory(options){
    var memory=Object.create(null);
    function owner(){try{return String(options.owner&&options.owner()||'guest');}catch(_){return 'guest';}}
    function valid(n){return Number.isInteger(n)&&n>0&&n<=999;}
    function list(who){
      who=who==null?owner():who;
      var stored=[];try{stored=JSON.parse(options.storage().getItem(READ_PREFIX+who)||'[]');}catch(_){}
      return memory[who]=Array.from(new Set(array(memory[who]).concat(array(stored)).filter(valid))).sort(function(a,b){return a-b;});
    }
    function mark(n,who){
      if(!valid(n)||who!==owner())return false;
      var rows=list(who);if(rows.indexOf(n)<0)rows.push(n);rows.sort(function(a,b){return a-b;});
      try{options.storage().setItem(READ_PREFIX+who,JSON.stringify(rows));}catch(_){}
      return true;
    }
    return {owner:owner,list:list,mark:mark};
  }
  function indexRead(data){
    if(!data||!Array.isArray(data.issues))throw Error('Invalid letter index');
    var seen={};
    return data.issues.filter(function(d){if(!d||!Number.isInteger(d.number)||d.number<1||d.number>999||!d.title||seen[d.number])return false;seen[d.number]=true;return true;});
  }
  function select(list,q,order){
    q=String(q||'').trim().toLowerCase();
    return list.filter(function(d){var hay=[d.number,d.number+'호',nn(d.number),d.title,d.sub].concat(array(d.pieces).map(function(p){return p.title;}),d.training?[d.training.title,d.training.theme].concat(array(d.training.exercises).map(function(e){return e.title;})):[]).join(' ').toLowerCase();return !q||hay.indexOf(q)>=0;})
      .slice().sort(function(a,b){return order==='new'?b.number-a.number:a.number-b.number;});
  }
  function facts(rows){return '<dl class="pl-facts">'+array(rows).map(function(r){return '<div><dt>'+esc(r[0])+'</dt><dd>'+rich(r[1])+(r[2]?'<small>'+rich(r[2])+'</small>':'')+'</dd></div>';}).join('')+'</dl>';}
  function pairs(rows){return '<dl class="pl-pairs">'+array(rows).map(function(r){return '<div><dt>'+rich(r[0])+'</dt><dd>'+rich(r[1])+'</dd></div>';}).join('')+'</dl>';}
  function piece(p,i){return '<section class="pl-section" id="pl-piece-'+i+'"><span class="pl-kicker">'+esc(p.pillar_ko)+'</span><h2>'+esc(p.title)+'</h2><div class="pl-source">'+esc(p.source)+(array(p.for).length?' · '+array(p.for).map(esc).join(' · '):'')+'</div><p class="pl-lead">'+rich(p.lead)+'</p>'+paras(p.points)
    +'<div class="pl-links">'+link(p.src_url,p.src_label||'원문 읽기')+link(p.hub_url,'축구 지식 허브')+(p.note?link(p.note.url,p.note.title||'관련 노트'):'')+'</div></section>';}
  function training(t,n){
    if(!t)return '<section class="pl-section" id="pl-training"><h2>관련 훈련</h2><p>이 레터에는 연결된 훈련 세션이 없습니다.</p></section>';
    var why=t.why;
    return '<section class="pl-section pl-training" id="pl-training"><span class="pl-kicker">관련 훈련 · '+esc(t.theme)+'</span><h2>'+esc(t.title)+'</h2><p class="pl-lead">'+rich(t.sub)+'</p>'+paras(t.intro)
      +(why?'<div class="pl-why"><h3>왜 이 훈련인가</h3><h4>'+esc(why.scene_label||'경기에서 이런 장면이 보이면')+'</h4><p>'+rich(why.scene)+'</p><h4>'+esc(why.reason_label||'훈련의 이유')+'</h4><p>'+rich(why.reason)+'</p>'+array(why.evidence).map(function(e){return '<p>'+rich(e.text)+'</p><div class="pl-source">'+esc(e.title)+' · '+esc(e.by)+'</div>';}).join('')+'<h4>이 세션이 끝나면</h4><p>'+rich(why.after)+'</p></div>':'')
      +(t.flow?'<p>'+rich(t.flow)+'</p>':'')+facts(t.facts)+'<h3>'+esc(t.keys_label||'코칭 포인트')+'</h3>'+pairs(t.keys)
      +array(t.exercises).map(function(e,i){return '<article class="pl-exercise" id="pl-ex-'+i+'"><div class="pl-ex-head"><span class="pl-kicker">훈련 '+(i+1)+' · '+esc(e.minutes)+'분</span><h3>'+esc(e.title)+'</h3></div><p>'+rich(e.lead)+'</p>'
        +'<button type="button" class="pl-play" data-letter-play="'+n+'" data-training="'+i+'"><img loading="lazy" decoding="async" src="packs/thumbs/'+nn(n)+'-'+(i+1)+'.svg" alt="'+esc(e.title)+' 작전판"><span>▶ 훈련 애니메이션 보기</span></button>'
        +facts(e.facts)+'<h4>진행 방법</h4><ol>'+array(e.steps).map(function(s){return '<li>'+rich(s)+'</li>';}).join('')+'</ol>'
        +'<h4>코칭 포인트</h4>'+paras(array(e.cp).map(function(p){return p[2];}))
        +(array(e.video&&e.video.moves).length?'<h4>장면별 움직임</h4><ol>'+e.video.moves.map(function(s){return '<li>'+rich(s)+'</li>';}).join('')+'</ol>':'')
        +'<h4>난이도 조절</h4>'+pairs(e.tune)+'</article>';}).join('')
      +(t.action?'<div class="pl-action"><h3>훈련장에서 확인하기</h3><p>'+rich(t.action)+'</p></div>':'')+'</section>';
  }
  function article(d){
    var q=d.quote||{};
    return '<div class="pl-reader" data-letter-reader="'+d.number+'"><div class="pl-reader-bar"><button type="button" class="pl-back" data-letter-back>← 레터 전체 목록</button><span>'+nn(d.number)+'호</span></div>'
      +'<header class="pl-title"><span class="pl-kicker">PROCESS LETTER · '+nn(d.number)+'호</span><h1 tabindex="-1">'+esc(d.title)+'</h1><p>'+rich(d.sub)+'</p></header>'
      +'<nav class="pl-toc" aria-label="레터 목차">'+array(d.pieces).map(function(p,i){return '<button type="button" data-letter-jump="pl-piece-'+i+'">'+esc(p.pillar_ko)+'</button>';}).join('')+(d.training?'<button type="button" data-letter-jump="pl-training">관련 훈련</button>':'')+'</nav>'
      +'<div class="pl-body"><section class="pl-intro">'+paras(d.intro)+'</section>'+array(d.pieces).map(piece).join('')
      +(q.ko||q.en?'<section class="pl-section pl-quote"><h2>마음에 남는 한 문장</h2><blockquote>'+paras([q.ko,q.en].filter(Boolean))+'<footer>'+esc(q.who)+'</footer></blockquote>'+link(q.src_url,[q.src_author,q.src_label].filter(Boolean).join(' · ')||'출처')+'</section>':'')
      +training(d.training,d.number)+'<section class="pl-section pl-closing">'+paras(d.closing)+'</section></div><div class="pl-bottom"><button type="button" class="pl-back" data-letter-back>← 레터 전체 목록</button></div></div>';
  }
  function create(options){
    var doc=options.doc,host=doc.getElementById('grid'),count=doc.getElementById('commCount'),win=doc.defaultView;
    var list=null,loading=null,error=false,cache={},selected=null,query='',order='old',seq=0,listY=0,lastNumber=0;
    var history=readHistory({storage:function(){return win.localStorage;},owner:options.owner}),readerOwner=history.owner(),readSnapshot='';
    function active(){return options.active();}
    function status(message,retry){host.innerHTML='<div class="pl-status" role="status"><p>'+esc(message)+'</p>'+(retry?'<button type="button" data-letter-retry>다시 시도</button>':'')+(selected?' <button type="button" data-letter-back>레터 전체 목록</button>':'')+'</div>';if(count)count.textContent='';}
    function get(file){return options.fetch('letters/'+file,{credentials:'omit',redirect:'error'}).then(function(r){if(!r.ok)throw Error('Letter request failed');return r.json();});}
    function load(){
      if(loading)return loading;
      error=false;
      loading=get('index.json').then(function(data){list=indexRead(data);if(!list.length)throw Error('Empty index');options.onCount(list.length);},function(e){throw e;})
        .catch(function(){error=true;}).then(function(){loading=null;if(active())paint(true);});
      return loading;
    }
    function paint(force){
      if(!active())return;
      var who=history.owner();
      if(who!==readerOwner){readerOwner=who;selected=null;seq++;}
      var seen=new Set(history.list(who)),snapshot=who+':'+Array.from(seen).join(',');
      force=force||snapshot!==readSnapshot;readSnapshot=snapshot;
      doc.body.classList.add('pr-letters');
      if(!list){status(error?'레터 목록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.':'레터를 불러오는 중…',error);if(!error)load();return;}
      if(selected){if(host.querySelector('[data-letter-reader="'+selected+'"]'))return;read(selected,false);return;}
      if(!force&&host.querySelector('.pl-list'))return;
      var shown=select(list,query,order);
      if(count)count.textContent='레터 '+shown.length+'개'+(query?' · 전체 '+list.length+'개':'')+' · 읽음 '+shown.filter(function(d){return seen.has(d.number);}).length+'개';
      host.innerHTML='<div class="pl-shelf"><div class="pl-shelf-head"><div><span class="pl-kicker">PROCESS LETTER</span><h2>읽고, 생각하고, 훈련으로.</h2><p>좋은 팀, 좋은 선수, 좋은 코치를 위한 글과 훈련을 모았습니다.</p></div><label class="pl-order">정렬<select id="plOrder" aria-label="레터 정렬"><option value="old"'+(order==='old'?' selected':'')+'>1호부터</option><option value="new"'+(order==='new'?' selected':'')+'>최신호부터</option></select></label></div>'
        +'<div class="pl-list">'+(shown.length?shown.map(function(d){var read=seen.has(d.number);return '<button type="button" class="pl-row'+(read?' is-read':'')+'" data-letter="'+d.number+'" aria-label="'+esc(d.number+'호 · '+d.title)+(read?' · 읽음':'')+'"><span class="pl-number"><small>LETTER</small>'+nn(d.number)+'</span><span class="pl-row-copy"><strong>'+esc(d.title)+'</strong><span>'+esc(d.sub)+'</span><small class="pl-row-meta"><span>글 '+array(d.pieces).length+'편'+(d.training?' · 관련 훈련 '+array(d.training.exercises).length+'개':'')+'</span>'+(read?'<span class="pl-read"><span aria-hidden="true">✓</span> 읽음</span>':'')+'</small></span><span class="pl-arrow" aria-hidden="true">→</span></button>';}).join(''):'<div class="pl-status"><p>검색에 맞는 레터가 없어요.</p><button type="button" data-letter-clear>검색 지우기</button></div>')+'</div></div>';
      host.querySelector('#plOrder').onchange=function(){order=this.value;paint(true);};
    }
    function read(n,focus){
      var ticket=++seq,who=history.owner();selected=n;lastNumber=n;
      if(!cache[n])status('레터 본문을 불러오는 중…');
      var pending=cache[n]?Promise.resolve(cache[n]):get(nn(n)+'.json');
      return pending.then(function(d){
        if(!d||d.number!==n||!Array.isArray(d.pieces)||!d.title)throw Error('Invalid letter');
        cache[n]=d;
        if(ticket!==seq||selected!==n||!active())return;
        if(who!==history.owner()){paint(true);return;}
        host.innerHTML=article(d);if(count)count.textContent='레터 '+n+'호 · 글 '+d.pieces.length+'편'+(d.training?' · 관련 훈련 '+d.training.exercises.length+'개':'');
        history.mark(n,who);
        if(focus){host.scrollIntoView({block:'start'});host.querySelector('.pl-title h1').focus({preventScroll:true});}
      }).catch(function(){if(ticket===seq&&active())status('레터 본문을 불러오지 못했어요. 다시 시도해 주세요.',true);});
    }
    function back(){selected=null;seq++;paint(true);var b=host.querySelector('[data-letter="'+lastNumber+'"]');if(b)b.focus({preventScroll:true});win.scrollTo(0,listY);}
    function refresh(){var who=history.owner();if(who!==readerOwner||who+':'+history.list(who).join(',')!==readSnapshot)paint(false);}
    host.addEventListener('click',function(e){
      if(!active())return;
      var b=e.target.closest('button');if(!b||!host.contains(b))return;
      if(b.hasAttribute('data-letter')){listY=win.scrollY;read(+b.dataset.letter,true);}
      else if(b.hasAttribute('data-letter-back'))back();
      else if(b.hasAttribute('data-letter-jump')){var target=doc.getElementById(b.dataset.letterJump);if(target){target.scrollIntoView({block:'start',behavior:'auto'});target.tabIndex=-1;target.focus({preventScroll:true});}}
      else if(b.hasAttribute('data-letter-retry')){if(selected)read(selected,true);else load();}
      else if(b.hasAttribute('data-letter-clear')){var q=doc.getElementById('commSearch');q.value='';q.dispatchEvent(new win.Event('input',{bubbles:true}));q.focus();}
      else if(b.hasAttribute('data-letter-play'))options.openTraining(+b.dataset.letterPlay,+b.dataset.training,b);
    });
    win.addEventListener('storage',function(e){if(e.key===null||e.key===READ_PREFIX+history.owner()||e.key==='ps_sync_session')refresh();});
    win.addEventListener('focus',refresh);
    return {render:function(q){q=String(q||'');var changed=q!==query;query=q;if(changed){selected=null;seq++;}paint(changed);},refresh:refresh,count:function(){return list?list.length:null;},isReading:function(n){return active()&&selected===n;}};
  }
  return {create:create,indexRead:indexRead,select:select,article:article,rich:rich,href:href,readHistory:readHistory};
});
