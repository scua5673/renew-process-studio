/* The Process training collection is independent from coach submissions. */
(function(root,factory){
  var catalog=typeof module==='object'&&module.exports?require('./community-training-catalog.js'):root.PSCommunityTrainingCatalog;
  var api=factory(catalog);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSCommunityTraining=api;
})(typeof window!=='undefined'?window:null,function(C){
  'use strict';
  var INDEX={},PURPOSES={},KINDS={rondo:'론도',posgame:'포지셔널 게임',game:'조건부 경기',ssg:'소규모 경기',pass:'패스 패턴',poss:'점유 게임'};
  C.posts.forEach(function(p){INDEX[p.id]=p;});C.purposes.forEach(function(b){PURPOSES[b.id]=b;});
  function known(p){return !!(p&&Object.prototype.hasOwnProperty.call(INDEX,p.id));}
  function trusted(p){return known(p)&&p.owner===C.owner&&p.deleted!==true;}
  function read(rows){var seen={};return (Array.isArray(rows)?rows:[]).filter(function(p){if(!trusted(p)||seen[p.id])return false;seen[p.id]=true;return true;}).map(function(p){return Object.assign({},p,{owner_name:'프로세스'});});}
  function ids(){return C.posts.map(function(p){return p.id;}).join(',');}
  function exclude(){return '&id=not.in.('+ids()+')';}
  function path(cols){return '/rest/v1/ps_community?select='+cols+'&owner=eq.'+C.owner+'&id=in.('+ids()+')&deleted=eq.false&order=id.asc&limit=200';}
  function tax(p,TX){var v=TX.fromCoach(p,function(s){return String(s||'').split(',').filter(Boolean);}),m=INDEX[p.id];if(m){v.min=m.min;v.max=m.max;}return v;}
  function choose(rows,o){o=o||{};var q=String(o.q||'').trim().toLowerCase();return rows.filter(function(p){var m=INDEX[p.id];return m&&(!o.purpose||m.purpose===o.purpose)&&(!o.kind||m.kinds.indexOf(o.kind)>=0)&&(!q||[p.title,p.summary,PURPOSES[m.purpose].name,PURPOSES[m.purpose].description].join(' ').toLowerCase().indexOf(q)>=0)&&(!o.ok||o.ok(p));});}
  function total(rows){return rows.reduce(function(n,p){return n+INDEX[p.id].n;},0);}
  function create(o){
    var doc=o.doc,grid=doc.getElementById('grid'),count=doc.getElementById('commCount'),purpose='',kind='',rows=[],ready=false,loading=false,err='',loadSeq=0;
    var controls=doc.createElement('section');controls.id='processTrainingFilters';controls.className='pt-controls';controls.setAttribute('aria-label','프로세스 트레이닝 분류');controls.hidden=true;
    var bar=doc.querySelector('.comm-list .bar');bar.parentNode.insertBefore(controls,bar.nextSibling);
    function el(tag,cl,txt){var e=doc.createElement(tag);if(cl)e.className=cl;if(txt!=null)e.textContent=txt;return e;}
    function button(txt,fn,cl){var b=el('button',cl||'ps-btn-secondary',txt);b.type='button';b.onclick=fn;return b;}
    function changed(){if(o.active())o.render();}
    function fetchRows(){
      if(loading)return;var base=o.base();if(!base){err='커뮤니티에 연결할 수 없어요.';return;}
      loading=true;err='';var seq=++loadSeq,controller=typeof AbortController==='function'?new AbortController():null;
      var timer=controller?setTimeout(function(){controller.abort();},15000):null;
      o.fetch(base+path(o.columns),{headers:o.headers(),signal:controller?controller.signal:undefined}).then(function(r){if(!r.ok)throw Error('network');return r.json();}).then(function(j){if(seq!==loadSeq)return;rows=read(j);ready=true;loading=false;if(o.onCount)o.onCount();changed();},function(){if(seq!==loadSeq)return;loading=false;err='훈련 목록을 불러오지 못했어요.';changed();}).finally(function(){if(timer)clearTimeout(timer);});
    }
    function drawControls(){
      controls.textContent='';var head=el('div','pt-intro');
      head.appendChild(el('p','','프로세스 트레이닝 · 훈련 목적과 형태로 찾아보세요.'));controls.appendChild(head);
      var fields=el('div','pt-fields'),lb=el('label','','훈련 목적'),sel=el('select');sel.setAttribute('aria-label','훈련 목적 선택');var all=el('option','','전체 목적');all.value='';sel.appendChild(all);
      C.purposes.forEach(function(b){var op=el('option','',b.name+' · '+b.n+'개');op.value=b.id;sel.appendChild(op);});sel.value=purpose;sel.onchange=function(){purpose=sel.value;changed();};lb.appendChild(sel);fields.appendChild(lb);
      var kl=el('label','','훈련 형태'),ks=el('select');ks.setAttribute('aria-label','훈련 형태');var ka=el('option','','전체 형태');ka.value='';ks.appendChild(ka);Object.keys(KINDS).forEach(function(k){var op=el('option','',KINDS[k]);op.value=k;ks.appendChild(op);});ks.value=kind;ks.onchange=function(){kind=ks.value;changed();};kl.appendChild(ks);fields.appendChild(kl);
      if(purpose||kind)fields.appendChild(button('목적·형태 초기화',function(){purpose='';kind='';changed();},'ps-btn-text'));controls.appendChild(fields);
    }
    function render(q){
      controls.hidden=false;drawControls();grid.textContent='';grid.classList.add('pt-grid');var shelf=el('div','pt-shelf');grid.appendChild(shelf);
      var baseRows=choose(rows,{purpose:purpose,kind:kind});o.drawTax(baseRows.map(function(p){return tax(p,o.TX);}));
      if(!ready&&!loading&&!err)fetchRows();
      if(!ready){count.textContent='';var empty=el('div','pt-empty');empty.appendChild(el('p','',err||'프로세스 트레이닝을 불러오는 중…'));if(err)empty.appendChild(button('다시 시도',function(){err='';fetchRows();changed();}));shelf.appendChild(empty);return;}
      var matches=choose(rows,{purpose:purpose,kind:kind,q:q,ok:function(p){return o.TX.ok(tax(p,o.TX));}}),catalogView=!purpose&&!kind&&!String(q||'').trim();
      count.textContent=(catalogView?'주제 '+C.purposes.filter(function(b){return matches.some(function(p){return INDEX[p.id].purpose===b.id;});}).length+'개 · ':'')+total(matches)+'개 훈련 · '+matches.length+'개 묶음';
      if(err){var note=el('div','pt-note',err+' 마지막으로 받은 목록을 보여 드립니다.');note.appendChild(button('다시 시도',function(){err='';fetchRows();changed();}));shelf.appendChild(note);}
      if(!matches.length){shelf.appendChild(el('div','pt-empty','선택한 조건에 맞는 훈련이 없어요. 목적·국면·검색어를 바꿔 보세요.'));return;}
      if(catalogView){C.purposes.forEach(function(b,i){var group=matches.filter(function(p){return INDEX[p.id].purpose===b.id;});if(!group.length)return;var card=button('',function(){purpose=b.id;changed();},'pt-purpose');card.setAttribute('aria-label',b.name+' · '+total(group)+'개 훈련');card.appendChild(el('span','pt-purpose-number',String(i+1).padStart(2,'0')));card.appendChild(el('strong','',b.name));card.appendChild(el('span','pt-context',b.stage+' · '+b.description));card.appendChild(el('span','pt-purpose-foot',total(group)+'개 훈련 · '+group.length+'개 묶음 →'));shelf.appendChild(card);});return;}
      matches.forEach(function(p){var m=INDEX[p.id],card=button('',function(){o.open(p);},'pt-training');card.setAttribute('aria-label',p.title+' 열기');var picture=el('div','pt-picture');picture.innerHTML=o.thumb(p.thumb);card.appendChild(picture);var text=el('div','pt-training-copy');text.appendChild(el('span','pt-context',PURPOSES[m.purpose].name));text.appendChild(el('strong','',p.title));if(p.summary)text.appendChild(el('span','pt-summary',p.summary));text.appendChild(el('span','pt-types',m.kinds.map(function(k){return KINDS[k]||k;}).join(' · ')));card.appendChild(text);o.TX.badge(text,tax(p,o.TX));var foot=el('span','pt-training-foot');foot.appendChild(el('span','',m.n+'개 훈련 · '+m.min+(m.max!==m.min?'–'+m.max:'')+'명'));foot.appendChild(el('span','pt-action','훈련 보기 →'));card.appendChild(foot);shelf.appendChild(card);});
    }
    return {render:render,hide:function(){controls.hidden=true;grid.classList.remove('pt-grid');},count:function(){return ready?total(rows):null;},find:function(id){return rows.find(function(p){return p.id===id;})||null;},fetch:fetchRows};
  }
  return {known:known,trusted:trusted,read:read,path:path,exclude:exclude,choose:choose,tax:tax,total:total,create:create,catalog:C};
});
