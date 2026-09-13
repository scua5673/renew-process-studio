/* A visible player-match screen is a device observation, not a read receipt. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSSharedViewObservation=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,TTL=300000,KEY='ps_shared_view_seen_v1';
  function identity(c){
    if(!c||c.state!=='ready'||c.kind!=='player_matches'||!UUID.test(c.uid)||!UUID.test(c.wid)||!UUID.test(c.subject)||c.uid===c.subject||!c.seal||!c.element)return null;
    return JSON.stringify([c.uid,c.wid,c.subject,c.kind,c.seal,c.role]);
  }
  function boxVisible(node,w){
    if(!node||!node.isConnected||node.ownerDocument!==w.document)return false;
    var r=node.getBoundingClientRect(),clip={left:0,top:0,right:w.innerWidth,bottom:w.innerHeight};
    if(!(r.width>0&&r.height>0&&clip.right>0&&clip.bottom>0))return false;
    for(var p=node;p;p=p.parentElement){
      var s=w.getComputedStyle(p);
      if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;
      if(p!==node){var b=p.getBoundingClientRect();
        if(/hidden|clip|scroll|auto/.test(s.overflowX)){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}
        if(/hidden|clip|scroll|auto/.test(s.overflowY)){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}
      }
    }
    return Math.min(r.right,clip.right)>Math.max(r.left,clip.left)&&Math.min(r.bottom,clip.bottom)>Math.max(r.top,clip.top);
  }
  function visible(c,w){
    try{
      if(!identity(c)||!w||w.document.visibilityState!=='visible'||!boxVisible(c.element,w))return false;
      var records=c.element.querySelectorAll('.sqm-record');
      if(!Array.prototype.some.call(records,function(el){return boxVisible(el,w);}))return false;
      for(var cur=w;cur.parent!==cur;cur=cur.parent){
        var frame=cur.frameElement,parent=cur.parent;
        if(!frame||parent.document.visibilityState!=='visible'||!boxVisible(frame,parent))return false;
      }
      return true;
    }catch(_){return false;}
  }
  function createClient(options){
    var o=options||{},w=o.window||(typeof window!=='undefined'?window:null),now=o.now||Date.now;
    var raf=o.requestAnimationFrame||(w&&w.requestAnimationFrame.bind(w)),caf=o.cancelAnimationFrame||(w&&w.cancelAnimationFrame.bind(w));
    var storage=o.storage,seen={},pending=null,disabled=false,started=false,observers=[];
    try{if(!storage&&w)storage=w.sessionStorage;var old=JSON.parse(storage&&storage.getItem(KEY)||'{}');if(old&&typeof old==='object'&&!Array.isArray(old))seen=old;}catch(_){}
    function context(){try{var c=o.context();return identity(c)?Object.assign({},c):null;}catch(_){return null;}}
    function current(c){var n=context();return !!c&&!!n&&identity(c)===identity(n)&&c.element===n.element&&visible(c,w);}
    function report(c){
      if(disabled||!current(c))return Promise.resolve(false);
      var id=JSON.stringify([c.uid,c.wid,c.subject,c.kind]),at=now(),before=seen[id];
      if(Number.isFinite(before)&&at>=before&&at-before<TTL)return Promise.resolve(false);
      /* Throttle attempts too: unavailable reporting must not produce a request
         on every autosave/rerender. This is not an acknowledged-read ledger. */
      seen[id]=at;var next={};Object.keys(seen).filter(function(k){return Number.isFinite(seen[k])&&at-seen[k]>=0&&at-seen[k]<TTL;}).slice(-100).forEach(function(k){next[k]=seen[k];});seen=next;
      try{if(storage)storage.setItem(KEY,JSON.stringify(seen));}catch(_){}
      var body={p_workspace_id:c.wid,p_subject_user_id:c.subject,p_view_kind:'player_matches'};
      return Promise.resolve().then(function(){if(!current(c))return false;return o.send(body,function(){return current(c);});})
        .then(function(ok){return ok===true&&current(c);}).catch(function(e){if(e&&(e.code==='PGRST202'||e.code==='42883'))disabled=true;return false;});
    }
    function check(){return report(context());}
    function watch(){
      if(disabled||!raf)return;
      if(pending!=null&&caf)caf(pending);
      var c=context();pending=raf(function(){pending=null;report(c);});
    }
    function start(){
      if(started||!w)return;started=true;
      w.document.addEventListener('visibilitychange',watch);w.addEventListener('resize',watch);w.addEventListener('scroll',watch,true);
      /* Shell tabs hide an iframe without changing its document.visibilityState. */
      try{if(w.MutationObserver){var observer=new w.MutationObserver(watch),nodes=[w.document.documentElement];
        for(var cur=w;cur.parent!==cur;cur=cur.parent){for(var p=cur.frameElement;p;p=p.parentElement)nodes.push(p);}
        nodes.forEach(function(node){if(node)observer.observe(node,{attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-boot']});});observers.push(observer);
      }}catch(_){}
      watch();
    }
    function stop(){
      if(pending!=null&&caf)caf(pending);pending=null;
      if(started){w.document.removeEventListener('visibilitychange',watch);w.removeEventListener('resize',watch);w.removeEventListener('scroll',watch,true);}
      observers.forEach(function(x){x.disconnect();});observers=[];started=false;
    }
    return {start:start,stop:stop,watch:watch,check:check};
  }
  return {identity:identity,visible:visible,createClient:createClient};
});
