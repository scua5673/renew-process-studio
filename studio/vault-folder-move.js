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
  return{destinations:destinations,open:open};
});
