/* Read-only content explorer. Bodies are fetched only after an explicit selection. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAdminContent=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function key(r){return JSON.stringify([r.workspace_id,r.lib_id]);}
  function authorKey(r){return r.owner_id?'id:'+r.owner_id:r.owner_email?'email:'+r.owner_email:r.owner_name?'name:'+r.owner_name:'unknown';}
  function joinOwners(rows,owners){
    var by=new Map();(Array.isArray(owners)?owners:[]).forEach(function(r){if(r&&r.workspace_id&&r.lib_id)by.set(key(r),r);});
    return (rows||[]).map(function(r){var a=by.get(key(r))||{};
      // Legacy ps_admin_library.owner_email belongs to the workspace owner. Never retain it.
      return Object.assign({},r,{owner_id:a.owner_id||'',owner_name:a.owner_name||'',owner_email:a.owner_email||''});});
  }
  function filtered(rows,f,owner,workspace){
    f=f||{};var q=String(f.search||'').trim().toLowerCase(),start=f.from?new Date(f.from+'T00:00:00').getTime():null,
      end=f.to?new Date(f.to+'T00:00:00'):null;if(end)end.setDate(end.getDate()+1);
    return (rows||[]).filter(function(r){var ws=workspace(r.workspace_id)||{},d=new Date(r.made_at||r.updated_at||0).getTime();
      return (f.deleted||!r.deleted_at)&&(!f.type||(r.type||'train')===f.type)&&(!f.workspace||r.workspace_id===f.workspace)
        &&(!f.author||authorKey(r)===f.author)&&(!f.folder||(f.folder==='__none__'?!r.folder:r.folder===f.folder))
        &&(start===null||d>=start)&&(!end||d<end.getTime())
        &&(!q||[r.name,r.ws_name,r.workspace_name,ws.name,r.folder,owner(r,ws).search].join(' ').toLowerCase().indexOf(q)>=0);
    }).sort(function(a,b){var n=f.sort==='name'?String(a.name||'').localeCompare(String(b.name||''),'ko'):f.sort==='ws'?String(a.ws_name||a.workspace_name||'').localeCompare(String(b.ws_name||b.workspace_name||''),'ko'):0;
      return n||(f.sort==='name'?0:(new Date(b.made_at||b.updated_at||0)-new Date(a.made_at||a.updated_at||0)))||key(a).localeCompare(key(b));});
  }
  function imageSource(value){
    if(typeof value!=='string')return '';
    if(/^\s*<svg\b/i.test(value)){var svg=value.trim();if(svg.indexOf('xlink:')>=0&&svg.indexOf('xmlns:xlink')<0)svg=svg.replace(/<svg\b/i,'<svg xmlns:xlink="http://www.w3.org/1999/xlink"');try{return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}catch(_){return '';}}
    if(/^data:image\/svg\+xml(?:;charset=(?:utf-8|us-ascii))?(?:;base64)?,/i.test(value))return value;
    return /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)?value:'';
  }
  function create(o){
    var w=o.window||window,d=w.document,host=o.host,controls=o.controls||{},model=o.model||w.PSAdminContentData;
    var rows=[],list=[],source=null,selected='',detail=null,page=0,loading=false,error='',limit=40,focused=false,destroyed=false,ticket=0,ownerStamp='',active=true;
    function context(){var c=o.context();return c&&c.ready?String(c.uid)+':'+String(c.epoch):'';}
    function valid(stamp,t){return !destroyed&&active&&!!stamp&&stamp===context()&&stamp===ownerStamp&&(t==null||t===ticket);}
    function guard(){var s=context();if(!s||s!==ownerStamp){ticket++;selected='';detail=null;rows=[];list=[];source=null;host.innerHTML='';ownerStamp=s;return false;}return !destroyed&&active;}
    function val(name){return controls[name]?controls[name].value:'';}
    function filterValues(){return {search:val('search'),type:val('type'),sort:val('sort'),workspace:val('workspace'),author:val('author'),folder:val('folder'),from:val('from'),to:val('to'),deleted:!!(controls.deleted&&controls.deleted.checked)};}
    function options(el,pairs,title){if(!el)return;var prev=el.value;el.innerHTML='<option value="">'+esc(title)+'</option>'+pairs.map(function(p){return '<option value="'+esc(p[0])+'">'+esc(p[1])+'</option>';}).join('');el.value=pairs.some(function(p){return p[0]===prev;})?prev:'';}
    function populate(){
      var workspaces=new Map(),authors=new Map(),folders=new Set();rows.forEach(function(r){var ws=o.workspace(r.workspace_id)||{},own=o.owner(r,ws);workspaces.set(r.workspace_id,r.ws_name||r.workspace_name||ws.name||'이름 없는 공간');authors.set(authorKey(r),own.label);folders.add(r.folder||'__none__');});
      function sorted(m){return Array.from(m).sort(function(a,b){return a[1].localeCompare(b[1],'ko');});}
      options(controls.workspace,sorted(workspaces),'팀·공간 전체');options(controls.author,sorted(authors),'작성자 전체');
      options(controls.folder,Array.from(folders).sort().map(function(f){return [f,f==='__none__'?'폴더 없음':f];}),'폴더 전체');
    }
    function update(next,ownerReady){
      if(destroyed)return;var s=context();if(!s){guard();return;}
      if(ownerStamp!==s){ticket++;selected='';detail=null;source=null;ownerStamp=s;}
      active=true;
      if(source!==next){source=next;rows=next||[];populate();ticket++;selected='';detail=null;loading=false;error='';focused=false;}
      var previous=selected;list=filtered(rows,filterValues(),o.owner,o.workspace);
      if(selected&&!list.some(function(r){return key(r)===selected;})){ticket++;selected='';detail=null;loading=false;error='';focused=false;}
      limit=Math.max(40,Math.ceil((list.findIndex(function(r){return key(r)===selected;})+1)/40)*40);
      if(controls.count)controls.count.textContent='표시 '+list.length+'개 · 전체 '+rows.filter(function(r){return !r.deleted_at;}).length+'개';
      if(controls.ownerNotice){controls.ownerNotice.hidden=ownerReady!==false;controls.ownerNotice.textContent='작성자 정보를 불러오지 못했습니다. 새로고침하면 다시 확인합니다.';}
      render(previous===selected);
    }
    function button(action,text,disabled,extra){return '<button type="button" data-ac-action="'+action+'"'+(disabled?' disabled':'')+(extra||'')+'>'+text+'</button>';}
    function current(){return list.find(function(r){return key(r)===selected;});}
    function render(keepScroll){
      if(!valid(ownerStamp))return;
      var oldList=host.querySelector('.ac-list'),oldDetail=host.querySelector('.ac-detail'),ls=oldList?oldList.scrollTop:0,ds=keepScroll&&oldDetail?oldDetail.scrollTop:0;
      var idx=list.findIndex(function(r){return key(r)===selected;}),meta=current(),pages=detail?detail.pages:[],p=pages[page],ws=meta?o.workspace(meta.workspace_id)||{}:{},own=meta?o.owner(meta,ws):{};
      var h='<div class="ac-grid'+(focused?' ac-focused':'')+'" data-selected="'+(selected?'true':'false')+'"><section class="ac-list" aria-label="콘텐츠 목록"><div class="ac-list-head">콘텐츠 <span>'+list.length+'개</span></div>';
      if(!list.length)h+='<p class="ac-empty">조건에 맞는 항목이 없습니다.</p>';
      h+=list.slice(0,limit).map(function(r,i){var a=o.owner(r,o.workspace(r.workspace_id));return '<button type="button" class="ac-row'+(key(r)===selected?' is-selected':'')+'" data-ac-index="'+i+'" aria-pressed="'+(key(r)===selected)+'"><span class="ac-row-title">'+(r.pin?'★ ':'')+esc(r.name||'(제목없음)')+'</span><span class="ac-row-meta">'+esc(o.typeName(r.type))+' · '+esc(r.ws_name||r.workspace_name||(o.workspace(r.workspace_id)||{}).name||'이름 없는 공간')+'</span><span class="ac-row-meta">'+esc(a.label)+'</span><span class="ac-row-foot">'+esc(o.date(r.made_at||r.updated_at))+(r.deleted_at?' · 삭제됨':'')+(r.folder?' · '+esc(r.folder):'')+'</span></button>';}).join('');
      if(limit<list.length)h+=button('more','40개 더 보기 ('+Math.min(limit,list.length)+' / '+list.length+')',false,' class="ac-more"');
      h+='</section><section class="ac-detail" aria-label="콘텐츠 상세보기">';
      if(!meta)h+='<div class="ac-welcome"><span aria-hidden="true">▧</span><h2>콘텐츠를 골라 살펴보세요</h2><p>그림과 설명을 함께 보고,<br>저장된 페이지와 장면을 차례로 확인할 수 있습니다.</p></div>';
      else{
        h+='<div class="ac-nav">'+button('back','← 목록',false,' class="ac-back"')+'<div>'+button('previous','← 이전 콘텐츠',idx<=0)+'<span>'+ (idx+1)+' / '+list.length+'</span>'+button('next','다음 콘텐츠 →',idx<0||idx>=list.length-1)+'</div>'+button('focus',focused?'목록 함께 보기':'넓게 보기',false,' class="ac-focus"')+'</div>'
          +'<header class="ac-title"><div class="ac-eyebrow">'+esc(o.typeName(meta.type))+(meta.deleted_at?' · 삭제됨':'')+'</div><h2 tabindex="-1">'+esc(meta.name||'(제목없음)')+'</h2><p>'+esc(meta.ws_name||meta.workspace_name||ws.name||'이름 없는 공간')+' · '+esc(meta.folder||'폴더 없음')+'</p></header>'
          +'<dl class="ac-info"><div><dt>작성자</dt><dd>'+esc(own.name||own.label)+(own.name&&own.email?'<small>'+esc(own.email)+'</small>':'')+'</dd></div><div><dt>저장 시각</dt><dd>'+esc(o.date(meta.made_at||meta.updated_at))+'</dd></div></dl>';
        if(loading)h+='<p class="ac-empty" role="status">콘텐츠를 불러오는 중…</p>';
        else if(error)h+='<div class="ac-empty" role="alert">'+esc(error)+'<br>'+button('retry','다시 불러오기',false)+'</div>';
        else if(detail){
          h+='<div class="ac-page-nav"><label for="acPage">페이지 <b>'+(page+1)+' / '+pages.length+'</b></label><div>'+button('page-prev','‹',page<=0,' aria-label="이전 페이지"')+'<select id="acPage" aria-label="페이지 선택">'+pages.map(function(pg,i){return '<option value="'+i+'"'+(page===i?' selected':'')+'>'+esc(pg.label||('페이지 '+(i+1)))+'</option>';}).join('')+'</select>'+button('page-next','›',page>=pages.length-1,' aria-label="다음 페이지"')+'</div></div>';
          if(detail.summary.truncated)h+='<p class="ac-notice">페이지가 많아 앞부분만 표시했습니다.</p>';
          if(p){var src=imageSource(p.thumb);if(!src&&p.snap&&o.snapPreview){try{src=imageSource(o.snapPreview(p.snap));}catch(_){src='';}}
            h+='<article class="ac-page"><h3>'+esc(p.label||'페이지')+'</h3><div class="ac-visual">'+(src?'<figure class="ac-figure"><img src="'+esc(src)+'" alt="'+esc(p.label||'저장된 장면')+'" referrerpolicy="no-referrer"><figcaption hidden>저장된 그림을 표시하지 못했습니다.</figcaption></figure>':'<div class="ac-no-image">'+(p.snap?'이 페이지에는 배치 데이터가 있지만 표시할 수 있는 그림이 없습니다.':'이 페이지에는 저장된 그림이 없습니다.')+'</div>');
            var desc=p.descriptionRows||[],m=p.meta||{},chips=[];if(m.minutes!=null&&m.minutes!=='')chips.push(m.minutes+'분');if(m.sets!=null&&m.sets!=='')chips.push(m.sets+'세트');if(m.rpe!=null&&m.rpe!=='')chips.push('RPE '+m.rpe);
            if(chips.length)h+='<div class="ac-load">'+esc(chips.join(' · '))+'</div>';
            h+='</div><div class="ac-description"><h3>설명·코칭·메모</h3>'+(desc.length?'<dl>'+desc.map(function(r){return '<div><dt>'+esc(r.label)+'</dt><dd>'+esc(r.value)+'</dd></div>';}).join('')+'</dl>':'<p class="ac-muted">저장된 설명이 없습니다.</p>')+'</div></article>';
          }
          h+='<details class="ac-technical"><summary>항목 정보</summary><dl><dt>콘텐츠 ID</dt><dd>'+esc(meta.lib_id)+'</dd><dt>워크스페이스 ID</dt><dd>'+esc(meta.workspace_id)+'</dd><dt>저장된 구성</dt><dd>'+esc('훈련 '+detail.summary.trainings+' · 페이지 '+detail.summary.pages+' · 장면 '+detail.summary.scenes+' · 애니메이션 프레임 '+detail.summary.frames+' · 슬라이드 '+detail.summary.slides)+'</dd></dl></details>';
        }
        h+='<footer class="ac-actions">'+(meta.deleted_at?button('restore','휴지통에서 복구',false):button('delete','휴지통으로 이동',false,' class="danger"'))+'</footer>';
      }
      h+='</section></div>';host.innerHTML=h;
      var newList=host.querySelector('.ac-list'),newDetail=host.querySelector('.ac-detail');if(newList)newList.scrollTop=ls;if(newDetail)newDetail.scrollTop=ds;
      var image=host.querySelector('.ac-figure img');if(image)image.addEventListener('error',function(){image.hidden=true;image.nextElementSibling.hidden=false;},{once:true});
    }
    function select(k,focusTitle){
      if(!guard())return Promise.resolve();var meta=list.find(function(r){return key(r)===k;});if(!meta)return Promise.resolve();
      var stamp=ownerStamp,t=++ticket;selected=k;page=0;detail=null;loading=true;error='';limit=Math.max(limit,Math.ceil((list.indexOf(meta)+1)/40)*40);render(false);
      if(focusTitle){var title=host.querySelector('.ac-title h2');if(title)title.focus({preventScroll:true});}
      return Promise.resolve().then(function(){if(!valid(stamp,t))return;return o.rpc('ps_admin_library_item',{p_wid:meta.workspace_id,p_lib_id:meta.lib_id});}).then(function(raw){
        if(!valid(stamp,t)||selected!==k)return;var parsed=model.normalizePayload(raw);
        if(!raw||!parsed.body||typeof parsed.body!=='object'||!Object.keys(parsed.body).length)throw new Error('content_missing');
        if(parsed.row.workspace_id&&parsed.row.workspace_id!==meta.workspace_id||parsed.row.lib_id&&parsed.row.lib_id!==meta.lib_id)throw new Error('content_mismatch');
        detail=model.model(parsed.body);if(!detail.pages.length)throw new Error('content_empty');
      }).catch(function(e){if(!valid(stamp,t)||selected!==k)return;error=e&&e.message==='content_missing'?'이 항목을 찾을 수 없습니다. 목록을 새로고침해 주세요.':'콘텐츠를 불러오지 못했습니다. 다시 시도해 주세요.';})
        .finally(function(){if(valid(stamp,t)&&selected===k){loading=false;render(false);}});
    }
    function click(e){
      if(!guard())return;var row=e.target.closest('[data-ac-index]');if(row&&host.contains(row)){var r=list[Number(row.dataset.acIndex)];if(r)select(key(r),true);return;}
      var b=e.target.closest('[data-ac-action]');if(!b||!host.contains(b)||b.disabled)return;var action=b.dataset.acAction,idx=list.findIndex(function(r){return key(r)===selected;}),meta=current();
      if(action==='more'){limit+=40;render(true);}
      else if(action==='previous'||action==='next'){var next=list[idx+(action==='next'?1:-1)];if(next)select(key(next),true);}
      else if(action==='retry'&&meta)select(selected,false);
      else if(action==='page-prev'||action==='page-next'){if(detail){page=Math.max(0,Math.min(detail.pages.length-1,page+(action==='page-next'?1:-1)));render(false);}}
      else if(action==='back'){ticket++;selected='';detail=null;loading=false;focused=false;render(false);}
      else if(action==='focus'){focused=!focused;render(true);}
      else if(action==='delete'&&meta&&o.onDelete)o.onDelete(meta);
      else if(action==='restore'&&meta&&o.onRestore)o.onRestore(meta);
    }
    function change(e){if(e.target.id==='acPage'&&guard()&&detail){var n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<detail.pages.length){page=n;render(false);}}}
    host.addEventListener('click',click);host.addEventListener('change',change);
    return {update:update,open:function(wid,lid){return select(key({workspace_id:wid,lib_id:lid}),true);},
      deactivate:function(){active=false;ticket++;selected='';detail=null;loading=false;error='';focused=false;host.innerHTML='';},
      destroy:function(){destroyed=true;active=false;ticket++;rows=[];list=[];source=null;detail=null;host.removeEventListener('click',click);host.removeEventListener('change',change);host.innerHTML='';}};
  }
  return {create:create,filtered:filtered,joinOwners:joinOwners,key:key,authorKey:authorKey,imageSource:imageSource};
});
