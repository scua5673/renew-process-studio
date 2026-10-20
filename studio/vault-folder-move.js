(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSVaultFolderMove=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  function parentOf(path){var i=String(path||'').lastIndexOf('/');return i<0?'':path.slice(0,i);}
  function leafOf(path){var i=String(path||'').lastIndexOf('/');return i<0?path:path.slice(i+1);}
  function destinations(src,folders){
    src=String(src||'');
    return [''].concat((folders||[]).filter(function(path){return path&&path!==src&&path.indexOf(src+'/')!==0;}).slice().sort());
  }
  function svg(folder){
    return folder?'<svg width="19" height="19" viewBox="0 0 24 24" fill="rgba(232,184,74,.18)" stroke="var(--c-warn,#e8b84a)" stroke-width="1.7" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>':'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  }
  function open(options){
    var o=options||{},doc=o.document||(typeof document!=='undefined'?document:null),win=o.window||(typeof window!=='undefined'?window:null),src=String(o.src||'');
    if(!doc||!win||!src||typeof o.onMove!=='function')return null;
    var old=doc.getElementById('psFolderMoveOv');if(old)old.remove();
    var wide=win.innerWidth>=640,current=parentOf(src),ov=doc.createElement('div'),card=doc.createElement('div');
    ov.id='psFolderMoveOv';ov.style.cssText='position:fixed;inset:0;z-index:760;background:rgba(8,12,18,.52);display:flex;justify-content:center;align-items:'+(wide?'center':'flex-end')+';padding:'+(wide?'18px':'0')+';';
    card.style.cssText='width:100%;max-width:'+(wide?'400px':'560px')+';background:var(--panel,var(--c-surface));border-radius:'+(wide?'var(--r-card)':'18px 18px 0 0')+';box-shadow:0 -8px 44px rgba(0,0,0,.4);padding:16px 15px calc(15px + env(safe-area-inset-bottom));font-family:inherit;color:var(--txt,var(--c-ink));box-sizing:border-box;max-height:82vh;display:flex;flex-direction:column;';
    var title=doc.createElement('div');title.style.cssText='font-size:var(--t-6);font-weight:800;';title.textContent='폴더 이동';card.appendChild(title);
    var sub=doc.createElement('div');sub.style.cssText='font-size:var(--t-3);color:var(--txt-dim,var(--c-muted));margin:3px 0 13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';sub.textContent='‘'+(o.leaf?o.leaf(src):leafOf(src))+'’ 폴더를 넣을 위치를 고르세요';card.appendChild(sub);
    function close(){try{ov.remove();}catch(_){}}
    var list=doc.createElement('div');list.style.cssText='overflow-y:auto;display:flex;flex-direction:column;gap:5px;flex:1;-webkit-overflow-scrolling:touch;';
    destinations(src,o.folders).forEach(function(path){
      var same=path===current,b=doc.createElement('button'),depth=path?path.split('/').length-1:0,label=path?(o.leaf?o.leaf(path):leafOf(path)):'보관함 최상위';b.type='button';
      b.style.cssText='display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1.5px solid '+(same?'var(--blue,var(--c-act))':'var(--line,var(--c-line))')+';background:'+(same?'color-mix(in srgb,var(--c-act) 10%,transparent)':'var(--panel2,var(--c-surface-2))')+';color:inherit;font-family:inherit;font-size:var(--t-5);font-weight:600;padding:13px;padding-left:'+(13+depth*17)+'px;border-radius:var(--r-card);cursor:'+(same?'default':'pointer')+';';
      b.innerHTML=svg(!!path)+'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>'+(same?'<small style="font-size:var(--t-2);color:var(--txt-dim,var(--c-muted))">현재 위치</small>':'');b.querySelector('span').textContent=label;
      b.onclick=function(e){e.stopPropagation();if(same)return;close();o.onMove(path);};list.appendChild(b);
    });
    card.appendChild(list);
    var cancel=doc.createElement('button');cancel.type='button';cancel.style.cssText='margin-top:12px;border:0;background:var(--panel2,var(--c-surface-2));color:var(--txt-dim,var(--c-muted));font-family:inherit;font-weight:800;font-size:var(--t-5);padding:12px;border-radius:var(--r-card);cursor:pointer;flex:0 0 auto;';cancel.textContent='취소';cancel.onclick=close;card.appendChild(cancel);
    ov.appendChild(card);doc.body.appendChild(ov);ov.addEventListener('click',function(e){if(e.target===ov)close();});return ov;
  }
  function styles(doc){
    if(doc.getElementById('psVaultFolderUi'))return;var s=doc.createElement('style');s.id='psVaultFolderUi';s.textContent='.vx-folder-card{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr) 30px;align-items:center;gap:8px;min-height:50px;padding:7px 7px 7px 10px;border:1px solid var(--line,#E3E6EA);border-radius:7px;background:var(--panel,#fff);color:var(--txt,#14161A);cursor:pointer}.vx-folder-card:hover{background:var(--panel2,#F1F2F4);border-color:color-mix(in srgb,var(--blue,#14213D) 25%,var(--line,#E3E6EA))}.vx-folder-card:focus-visible{outline:2px solid var(--blue,#14213D);outline-offset:2px}.vx-folder-card .vfc-icon{width:32px;height:27px}.vx-folder-card .vfc-copy{min-width:0}.vx-folder-card .vf-nm{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:800}.vx-folder-card .vf-ct{display:block;margin-top:2px;color:var(--txt-dim,#646A73);font-size:10px;font-weight:500}.vx-folder-card .vc-more{position:static!important;width:30px!important;height:30px!important;opacity:1!important;background:transparent!important;color:var(--txt-dim,#646A73)!important}.vx-items.vx-list .vx-folder-card{min-height:46px;border-color:transparent;border-bottom-color:var(--line,#E3E6EA);border-radius:0;background:transparent}.vx-items.vx-grid .vx-folder-card{min-height:76px;grid-template-columns:40px minmax(0,1fr) 30px}.vx-items.vx-grid .vx-folder-card .vfc-icon{width:40px;height:33px}@media(max-width:700px){.vx-folder-card{grid-template-columns:32px minmax(0,1fr) 30px;min-height:48px;padding:7px}.vx-folder-card .vfc-icon{width:30px;height:25px}}';doc.head.appendChild(s);
  }
  function appendFolders(o){
    if(!o||!o.host||!Array.isArray(o.kids))return;var doc=o.host.ownerDocument;styles(doc);o.kids.forEach(function(name){var parent=o.parent||'',path=parent?parent+'/'+name:name,count=(o.lib||[]).filter(function(d){var f=String(d&&d.folder||'');return f===path||f.indexOf(path+'/')===0;}).length,row=doc.createElement('div');row.className='vfcard vx-folder-card';row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('data-vault-folder',path);row.setAttribute('aria-label',name+' 폴더 열기');row.innerHTML='<svg class="vfc-icon" viewBox="0 0 24 20" fill="rgba(232,184,74,.14)" stroke="var(--c-warn,#d4a629)" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2 5a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg><span class="vfc-copy"><span class="vf-nm"></span><small class="vf-ct">'+(count?count+'개 자료':'빈 폴더')+'</small></span><button type="button" class="vc-more" title="폴더 메뉴" aria-label="'+name+' 폴더 메뉴">⋯</button>';row.querySelector('.vf-nm').textContent=name;function enter(){o.open&&o.open(path);}row.onclick=function(){enter();};row.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();enter();}};row.querySelector('.vc-more').onclick=function(e){e.stopPropagation();o.menu&&o.menu(e,path,parent);};if(o.drop)try{o.drop(row,path);}catch(_){}o.host.appendChild(row);});
  }
  return{destinations:destinations,open:open,appendFolders:appendFolders};
});
