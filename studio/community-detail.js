/* Community drill detail: source text below the existing read-only board player. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSCommunityDetail=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function text(v){return typeof v==='string'?v.trim():typeof v==='number'?String(v):'';}
  function first(){for(var i=0;i<arguments.length;i++){var s=text(arguments[i]);if(s)return s;}return '';}
  function model(post,fallback){
    post=post||{};fallback=fallback||{};
    var it=post.item||{},tr=Array.isArray(it.trainings)&&it.trainings[0]||{},d=Object.assign({},it,tr);
    var method=first(d.method,d.spDesc),progress='',split=method.match(/\n\s*(난이도 조절|응용·발전|응용 및 발전|발전)\s*\n/);
    if(split){progress=method.slice(split.index+split[0].length).trim();method=method.slice(0,split.index).trim();}
    var panels={description:[],coaching:[],progressions:[]};
    function add(tab,label,value){value=text(value);if(value&&!panels[tab].some(function(row){return row.text===value;}))panels[tab].push({label:label,text:value});}
    add('description','소개',post.summary);
    [['overview','훈련 목표'],['setup','공간과 배치'],['func','진행 방법']].forEach(function(p){add('description',p[1],d[p[0]]);});
    add('description','훈련 방법',method);
    [['memo','훈련 메모'],['memoQuick','메모'],['playerTask','선수 과제'],['sessionCheck','훈련 점검'],['playerReflection','선수 돌아보기'],['evidence','관찰 기록'],['summaryLine','핵심 정리'],['coachReflection','코치 돌아보기'],['fourDs','훈련 설계']].forEach(function(p){add('description',p[1],d[p[0]]);});
    add('coaching','코칭 포인트',d.coaching);add('coaching','성공 기준',d.success);
    add('progressions','응용·발전',d.prog);add('progressions','난이도 조절',progress);add('progressions','다음 훈련',d.nextSession);
    var ages=Array.isArray(d.ages)?d.ages.map(text).filter(Boolean).join(' · '):first(d.ages,post.age,fallback.age);
    var authored=[text(d.setup),text(d.method),text(d.spDesc)].join('\n'),space=first(d.space,d.areaSize,d.dimensions),size=authored.match(/(?:크기|공간|규격)\s*[:：]?\s*(\d+(?:\.\d+)?\s*[×xX]\s*\d+(?:\.\d+)?)\s*m\b/);
    if(!space&&size)space=size[1].replace(/\s*[×xX]\s*/,' × ')+' m';
    var people=first(d.players,post.players,fallback.players),count=authored.match(/한 조\s*(\d+)\s*명|인원\s*[:：]?\s*(\d+)\s*명/);
    if(!people&&count)people=count[1]||count[2];
    if(/^\d+$/.test(people))people+='명';
    var facts=[];if(ages)facts.push({label:'권장 연령',value:ages.replace(/,/g,' · ')});if(people)facts.push({label:'훈련 인원',value:people});if(+d.minutes>0)facts.push({label:'훈련 시간',value:d.minutes+'분'});if(space)facts.push({label:'훈련 공간',value:space});
    if(d.gk!=null&&text(d.gk)!=='')facts.push({label:'골키퍼',value:text(d.gk)+' GK'});
    return {title:first(tr.name,it.name,post.title,'훈련 상세'),sessionTitle:text(post.title),author:first(post.owner_name,fallback.owner_name,'코치'),source:post.proc?'프로세스 훈련 세션':post.fifa?'FIFA 훈련 애니메이션':'커뮤니티 공유 자료',panels:panels,facts:facts};
  }
  function escape(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var lastFocus=null;
  function mount(doc,post,fallback,actions){
    var host=doc.getElementById('cdBody');if(!host)return;
    var m=model(post,fallback),mask=doc.getElementById('cvMask'),title=mask.querySelector('.cv-head b');
    if(!lastFocus||!mask.contains(doc.activeElement))lastFocus=doc.activeElement;
    title.textContent=m.title;
    host.innerHTML='<div class="cd-facts" aria-label="훈련 정보">'+m.facts.map(function(f){return '<span><small>'+escape(f.label)+'</small><b>'+escape(f.value)+'</b></span>';}).join('')+'</div>'
      +'<div class="cd-content"><div class="cd-author"><span class="cd-avatar" aria-hidden="true">'+escape(m.author.slice(0,1))+'</span><div><b>'+escape(m.author)+'</b><small>'+escape(m.source)+'</small></div><button type="button" class="cd-copy" id="cdCopy">내 보관함에 담기</button></div>'
      +(m.sessionTitle!==m.title?'<p class="cd-session">'+escape(m.sessionTitle)+'</p>':'')
      +'<div class="cd-tabs" role="tablist" aria-label="훈련 설명 탭">'+[['description','훈련 설명'],['coaching','코칭 포인트'],['progressions','응용·발전']].map(function(t,i){return '<button type="button" id="cd-tab-'+t[0]+'" role="tab" data-cd-tab="'+t[0]+'" aria-selected="'+!i+'" aria-controls="cd-panel-'+t[0]+'" tabindex="'+(i?-1:0)+'">'+t[1]+'</button>';}).join('')+'</div>'
      +Object.keys(m.panels).map(function(tab,i){return '<section class="cd-panel" id="cd-panel-'+tab+'" role="tabpanel" aria-labelledby="cd-tab-'+tab+'"'+(i?' hidden':'')+'>'+(m.panels[tab].length?m.panels[tab].map(function(row){return '<div class="cd-section"><h3>'+escape(row.label)+'</h3><p>'+escape(row.text)+'</p></div>';}).join(''):'<p class="cd-empty">아직 등록된 '+({description:'훈련 설명',coaching:'코칭 포인트',progressions:'응용·발전 내용'})[tab]+'이 없습니다.</p>')+'</section>';}).join('')
      +((post.proc||post.fifa)?'':'<div class="cd-actions"><button type="button" id="cdReport">자료 신고</button>'+(post.mine?'<button type="button" id="cdDelete">내 자료 삭제</button>':'')+'</div>')+'</div>';
    host.querySelector('#cdCopy').onclick=function(){actions.copy(this);};
    var report=host.querySelector('#cdReport');if(report)report.onclick=function(){actions.report();report.disabled=true;report.textContent='신고 접수됨';};
    var del=host.querySelector('#cdDelete');if(del)del.onclick=function(){actions.remove();};
    function choose(tab,focus){
      [].forEach.call(host.querySelectorAll('[data-cd-tab]'),function(b){var on=b.dataset.cdTab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();});
      Object.keys(m.panels).forEach(function(k){host.querySelector('#cd-panel-'+k).hidden=k!==tab;});
    }
    host.querySelector('.cd-tabs').onclick=function(e){var b=e.target.closest('[data-cd-tab]');if(b)choose(b.dataset.cdTab,false);};
    host.querySelector('.cd-tabs').onkeydown=function(e){var keys=['description','coaching','progressions'],i=keys.indexOf(e.target.dataset.cdTab),next;if(i<0)return;
      if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();choose(keys[next],true);};
    doc.getElementById('wrap').inert=true;
    doc.getElementById('cvClose').focus({preventScroll:true});
    mask.querySelector('.cv-shell').scrollTop=0;
    if(!mask.__cdKeys){mask.__cdKeys=true;mask.addEventListener('keydown',function(e){
      if(e.key!=='Tab')return;var nodes=[].filter.call(mask.querySelectorAll('button,a[href],iframe,input,select'),function(n){return !n.disabled&&n.tabIndex>=0&&n.getClientRects().length;});
      var first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus();}
    });}
  }
  function close(doc){var wrap=doc.getElementById('wrap');if(wrap)wrap.inert=false;var host=doc.getElementById('cdBody');if(host)host.innerHTML='';if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;}
  function player(win){
    var doc=win.document;doc.documentElement.classList.add('cd-player');
    if(!doc.getElementById('cdPlayerStyle')){var link=doc.createElement('link');link.id='cdPlayerStyle';link.rel='stylesheet';link.href='community-detail.css?v=3.169';link.onload=function(){win.dispatchEvent(new win.Event('resize'));};doc.head.appendChild(link);}
    doc.addEventListener('keydown',function(e){if(e.key==='Escape')win.parent.postMessage({source:'board',type:'commClosed'},win.location.origin);});
  }
  return {model:model,mount:mount,close:close,player:player};
});
