/* Public letter reactions. Only aggregate counts and this visitor's reaction leave the server. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSLetterSocial=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var KEY='ps_letter_visitor_v1';
  var CONFIG={url:'https://jvtajoeptzfsdwizxejg.supabase.co',anonKey:'sb_publishable_-Es-apybpr1zPTLzLE2sUw_kV-5ap-k'};
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var COUNT_NOTE='집계 시작 이후의 기록입니다. 로그인한 사람은 계정, 비로그인 방문자는 브라우저 기준으로 중복을 제외합니다.';
  function issue(n){return Number.isInteger(n)&&n>0&&n<=999;}
  function url(n,origin){if(!issue(n))throw Error('Invalid letter');return new URL('/studio/letter/'+String(n).padStart(2,'0')+'/',origin).href;}
  function visitor(win){
    try{
      var s=win.localStorage,v=s.getItem(KEY);if(UUID.test(v||''))return v;
      v=win.crypto.randomUUID();s.setItem(KEY,v);return s.getItem(KEY)===v?v:null;
    }catch(_){return null;}
  }
  function parse(rows){
    if(!Array.isArray(rows))throw Error('Invalid letter counts');
    var out={};rows.forEach(function(r){
      if(!r||!issue(r.issue)||!Number.isSafeInteger(r.readers)||r.readers<0||!Number.isSafeInteger(r.likes)||r.likes<0||typeof r.liked!=='boolean')throw Error('Invalid letter count');
      out[r.issue]={readers:r.readers,likes:r.likes,liked:r.liked};
    });return out;
  }
  function panel(n){
    return '<div class="pl-social" data-letter-social="'+n+'"><span class="pl-readers" title="'+COUNT_NOTE+'">읽은 사람 <b data-letter-readers="'+n+'">—</b></span>'
      +'<button type="button" class="pl-like" data-letter-like="'+n+'" aria-pressed="false" disabled><span data-letter-heart="'+n+'" aria-hidden="true">♡</span> 좋았어요 <b data-letter-likes="'+n+'">—</b></button>'
      +'<button type="button" class="pl-share" data-letter-share="'+n+'">↗ 공유하기</button>'
      +'<span class="pl-social-status" role="status" aria-live="polite"></span></div>';
  }
  function create(options){
    var win=options.window,doc=win.document,id=visitor(win),rows={},host=null,detail=null,watch=null,watchN=null,elapsed=0,busy={},generation=0,revision=0,loading=null,error=false;
    var fetcher=options.fetch||win.fetch.bind(win),now=options.now||Date.now;
    function session(){try{return options.session&&options.session()||null;}catch(_){return null;}}
    function identity(){var s=session();return s&&s.uid&&s.at?'u:'+s.uid:'v:'+(id||'');}
    var who=identity();
    function usable(){return !!id||identity().indexOf('u:')===0;}
    function message(text){if(host)host.querySelectorAll('.pl-social-status').forEach(function(e){e.textContent=text;});}
    function reset(){
      var next=identity();if(next===who)return false;
      who=next;generation++;rows={};busy={};error=false;loading=null;stop();draw();return true;
    }
    function rpc(name,body){
      var c=options.config&&options.config()||CONFIG,s=session(),headers={'Content-Type':'application/json',apikey:c.anonKey};
      // Publishable keys are not JWTs. Anonymous requests need only the apikey header.
      if(s&&s.uid&&s.at)headers.Authorization='Bearer '+s.at;
      var ctl=new win.AbortController(),timer=win.setTimeout(function(){ctl.abort();},12000);
      return fetcher(c.url.replace(/\/+$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:headers,body:JSON.stringify(body),credentials:'omit',signal:ctl.signal})
        .then(function(r){if(!r.ok)throw Error('Letter request '+r.status);return r.json();}).then(parse)
        .finally(function(){win.clearTimeout(timer);});
    }
    function draw(){
      if(!host)return;
      host.querySelectorAll('[data-letter-readers],[data-letter-likes]').forEach(function(e){
        var n=+(e.dataset.letterReaders||e.dataset.letterLikes),r=rows[n];
        e.textContent=r?String(e.hasAttribute('data-letter-readers')?r.readers:r.likes):'—';
      });
      host.querySelectorAll('[data-letter-like]').forEach(function(e){
        var n=+e.dataset.letterLike,r=rows[n];e.disabled=!r||!usable()||!!busy[n];e.setAttribute('aria-pressed',r&&r.liked?'true':'false');
        e.setAttribute('aria-busy',busy[n]?'true':'false');
      });
      host.querySelectorAll('[data-letter-heart]').forEach(function(e){var r=rows[+e.dataset.letterHeart];e.textContent=r&&r.liked?'♥':'♡';});
    }
    function refresh(){
      reset();if(loading)return loading;
      var ticket=generation,version=revision;
      loading=rpc('ps_letter_stats',{p_visitor:id}).then(function(data){
        if(ticket!==generation||identity()!==who||version!==revision)return;
        rows=data;error=false;draw();message(usable()?'':'이 브라우저에서는 반응을 저장할 수 없어요. 공유는 가능합니다.');
        if(options.onUpdate)options.onUpdate();
      }).catch(function(){if(ticket===generation){error=true;message('반응을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');}})
        .finally(function(){if(ticket===generation)loading=null;});
      return loading;
    }
    function act(n,action,liked){
      reset();if(!usable()||busy[n])return Promise.resolve(false);
      var ticket=generation;revision++;busy[n]=true;draw();
      return rpc('ps_letter_engage',{p_issue:n,p_visitor:id,p_action:action,p_liked:liked==null?null:liked}).then(function(data){
        if(ticket!==generation||identity()!==who)return false;
        if(!data[n])throw Error('Missing letter count');
        revision++;rows[n]=data[n];message(action==='like'?(data[n].liked?'좋았어요를 남겼어요.':'좋았어요를 취소했어요.'):'');return true;
      }).catch(function(){if(ticket===generation)message('반응을 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.');return false;})
        .finally(function(){if(ticket===generation){delete busy[n];draw();}});
    }
    function stop(){if(watch)win.clearInterval(watch);watch=null;watchN=null;elapsed=0;}
    function visible(){
      if(doc.hidden||options.active&& !options.active())return false;
      try{if(win.frameElement&&!win.frameElement.getClientRects().length)return false;}catch(_){}
      return true;
    }
    function track(n){
      if(watchN===n)return;stop();if(!usable())return;watchN=n;
      var previous=now(),pending=false;
      watch=win.setInterval(function(){
        var t=now(),delta=Math.min(1100,t-previous);previous=t;
        if(reset()){if(detail)track(detail.number);return;}
        if(!visible()||!host.querySelector('[data-letter-reader="'+n+'"]'))return;
        elapsed+=delta;
        if(elapsed>=5000&&!pending){pending=true;act(n,'read').then(function(ok){if(watchN!==n)return;if(ok)stop();else{elapsed=-25000;pending=false;}});}
      },1000);
    }
    function manualLink(link){
      var old=doc.getElementById('plShareDialog');if(old)old.remove();
      var dialog=doc.createElement('dialog');dialog.id='plShareDialog';dialog.className='pl-share-dialog';
      dialog.innerHTML='<form method="dialog"><h2>레터 링크 공유</h2><p>아래 링크를 복사해서 보내 주세요.</p><input aria-label="공유할 레터 주소" readonly><button type="submit">닫기</button></form>';
      dialog.querySelector('input').value=link;doc.body.appendChild(dialog);dialog.addEventListener('close',function(){dialog.remove();});
      dialog.showModal();dialog.querySelector('input').select();
    }
    function copy(link){
      if(!win.navigator.clipboard||!win.navigator.clipboard.writeText){manualLink(link);return Promise.resolve();}
      return win.navigator.clipboard.writeText(link).then(function(){message('레터 링크를 복사했어요.');},function(){manualLink(link);});
    }
    function share(n){
      var link=url(n,win.location.origin),data={title:'프로세스 레터 '+String(n).padStart(2,'0')+'호'+(detail?' · '+detail.title:''),url:link};
      if(win.navigator.share)return win.navigator.share(data).then(function(){},function(e){if(!e||e.name!=='AbortError')return copy(link);});
      return copy(link);
    }
    function click(e){
      var b=e.target.closest('[data-letter-like],[data-letter-share]');if(!b||!host.contains(b))return;
      if(b.hasAttribute('data-letter-share')){share(+b.dataset.letterShare);return;}
      var n=+b.dataset.letterLike,r=rows[n];if(r&&!b.disabled)act(n,'like',!r.liked);
    }
    function mount(target,d){
      if(host!==target){if(host)host.removeEventListener('click',click);host=target;host.addEventListener('click',click);}
      detail=d||null;var changed=reset();draw();if(changed)refresh();if(detail)track(detail.number);else stop();
      if(error)message('반응을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    win.addEventListener('focus',function(){refresh();if(detail)track(detail.number);});
    win.addEventListener('storage',function(e){if(e.key==='ps_sync_session'||e.key===null){reset();refresh();if(detail)track(detail.number);}});
    return {mount:mount,refresh:refresh,stop:stop,stats:function(){reset();return rows;},act:act,share:share};
  }
  return {create:create,panel:panel,parse:parse,url:url,visitor:visitor,config:CONFIG,countNote:COUNT_NOTE};
});
