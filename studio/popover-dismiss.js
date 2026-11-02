/* A click inside a same-origin iframe does not bubble into the shell document. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPopoverDismiss=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function watch(doc,close){
    var frames=new WeakSet(),documents=new WeakSet();
    function attach(child){
      if(!child)return;if(documents.has(child)){scan(child);return;}documents.add(child);
      if(child!==doc)child.addEventListener('pointerdown',close,true);
      child.addEventListener('keydown',function(e){if(e.key==='Escape')close();},true);
      scan(child);
    }
    function scan(parent){
      Array.prototype.forEach.call(parent.querySelectorAll('iframe'),function(frame){
        function loaded(){try{attach(frame.contentDocument);}catch(_){}}
        if(!frames.has(frame)){frames.add(frame);frame.addEventListener('load',loaded);}
        loaded();
      });
    }
    attach(doc);
    return function(){scan(doc);};
  }
  return {watch:watch};
});
