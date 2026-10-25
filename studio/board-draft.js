/* Preserve the working board before a team switch invalidates its owner.
   Only an exact, reload-selectable local draft is a completed barrier. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSBoardDraft=api;root.document.addEventListener('DOMContentLoaded',function(){api.install(root);});}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function sameBody(a,b){
    if(a===b)return true;
    var n=a.lastIndexOf(',"_savedAt":'),m=b.lastIndexOf(',"_savedAt":');
    if(n<0||m!==n||!/^\d+}$/.test(a.slice(n+12))||!/^\d+}$/.test(b.slice(m+12)))return false;
    for(var i=0;i<n;i++)if(a.charCodeAt(i)!==b.charCodeAt(i))return false;
    return true;
  }
  function create(d){
    var job=null;
    function error(){var e=new Error('작전판 초안을 기기에 보관하지 못했습니다. 다시 시도해 주세요');e.psCode='board_draft_storage';return e;}
    function same(j){var c=d.context();return !!c&&c.needed&&c.seq===j.seq&&JSON.stringify(c.owner)===j.ownerRaw;}
    function body(j){var c=d.capture();return !!c&&sameBody(c.raw,j.raw);}
    function source(j){var raw=d.local.getItem(j.key);return raw===j.localBefore||raw===j.record;}
    function current(j,full){var c=d.context();if(!same(j)||c.blocked||!c.current||!source(j)||(full&&!body(j)))throw error();return true;}
    function parse(raw,j){
      if(raw===j.record)return {at:j.at};
      try{var r=JSON.parse(raw);if(r&&r.v===1&&r.uid===j.owner.uid&&r.wid===j.owner.wid&&typeof r.raw==='string'&&r.at>0){JSON.parse(r.raw);return r;}}catch(_){}
      return null;
    }
    function check(j,writing){
      if(!same(j)||d.context().blocked||!source(j)||!body(j))return Promise.reject(error());
      return Promise.resolve(d.storage.get(j.key)).then(function(v){
        if(writing)current(j);
        if(!same(j)||d.context().blocked||!source(j)||!body(j))throw error();
        var lv=d.local.getItem(j.key),iv=v&&v.value,a=parse(lv,j),b=parse(iv,j);
        var selected=a&&b?(b.at>a.at?iv:lv):(a?lv:(b?iv:null));
        if(selected!==j.record)throw error();
        if(j.store==='idb'){
          if(iv!==j.record||!d.verifyIDB)throw error();
          return d.verifyIDB(j.key,j.record).then(function(){if(writing)current(j);if(!same(j)||d.context().blocked||!source(j)||!body(j))throw error();return true;});
        }
        return true;
      });
    }
    function persist(j){
      // Lifecycle callers need the complete small-store copy synchronously.
      try{
        current(j);
        if(!source(j))throw error();
        try{d.local.setItem(j.key,j.record);}catch(_){}
        if(d.local.getItem(j.key)===j.record)j.store='local';
      }catch(e){return Promise.reject(e);}
      var work;
      if(j.store==='local')work=check(j,true);
      else work=Promise.resolve().then(function(){
        current(j);
        if(!d.storage||!d.storage.get||!d.storage.replaceIfValue)throw error();
        return d.storage.get(j.key).then(function(v){
          current(j);var before=v&&v.value;before=before==null?null:before;
          if(!j.idbSeen){j.idbSeen=true;j.idbBefore=before;}
          if(before!==j.idbBefore&&before!==j.record)throw error();
          var previous=parse(before,j);
          // Never overwrite a concurrent/future draft first seen after capture.
          if(before!==j.record&&previous&&previous.at>=j.at)throw error();
          if(before===j.record)return true;
          return d.storage.replaceIfValue(j.key,j.idbBefore,j.record,function(){return current(j,true);}).then(function(ok){current(j);if(!ok)throw error();return true;});
        }).then(function(){j.store='idb';return check(j,true);});
      });
      return work.then(function(){current(j,true);j.ok=true;return true;});
    }
    function write(){
      var c=d.context();
      if(!c||!c.needed||c.blocked||!c.current)return Promise.resolve(false);
      if(!job||!same(job)||!body(job)){
        try{
          var cap=d.capture();if(!cap||typeof cap.raw!=='string')return Promise.reject(error());
          var key=d.key(c.owner),before=d.local.getItem(key),at=d.now(),old;
          try{old=JSON.parse(before||'null');if(old&&old.at>=at)at=+old.at+1;}catch(_){}
          job={owner:c.owner,ownerRaw:JSON.stringify(c.owner),seq:c.seq,key:key,localBefore:before,raw:cap.raw,at:at,
            record:JSON.stringify({v:1,uid:c.owner.uid,wid:c.owner.wid,raw:cap.raw,at:at}),ok:false,work:null,store:null,idbSeen:false};
        }catch(_){return Promise.reject(error());}
      }
      var j=job;
      if(j.work)return j.work;
      if(j.ok)return check(j,true);
      j.work=persist(j).then(function(v){j.work=null;return v;},function(e){j.work=null;j.ok=false;throw e;});
      return j.work;
    }
    function ready(){
      var c=d.context();if(!c||!c.needed)return Promise.resolve(true);
      if(c.current&&d.prepare){d.prepare();c=d.context();}
      if(c.blocked)return Promise.reject(error());
      if(c.current)return write().then(function(){return check(job,true);});
      // The guard permits read-only verification of an unchanged receipt.
      if(!job||!job.ok||!same(job))return Promise.reject(error());
      return check(job,false);
    }
    function pending(){var c=d.context();return !!(c&&c.needed&&(c.blocked||!job||!job.ok||!same(job)));}
    return {write:write,ready:ready,pending:pending};
  }
  function install(w){
    if(w.__psBoardDraft||typeof w.boardDraftWriteNow!=='function')return;
    var guestSource=null;
    var api=create({
      context:function(){
        var o=w._boardPrivateOwner,seq=w._boardPrivateEditSeq,current=!!(o&&w._boardPrivateLoaded&&w.boardPrivateCurrent(o)),g=w.__psBoardGuest;
        var ownerRaw=JSON.stringify(o);
        if(current&&g&&g.draftSuppressed&&g.draftSuppressed())guestSource={owner:ownerRaw,seq:seq};
        else if(current||!guestSource||guestSource.owner!==ownerRaw||guestSource.seq!==seq)guestSource=null;
        // The unchanged adopted board remains in the guest slot. Preserve that
        // existing suppression across the guard's temporary owner suspension;
        // a later edit or different owner must use the ordinary durable draft.
        var needed=!!(o&&w.boardManualChanged()&&!guestSource),b=w.document.body;
        var blocked=!!(w._vaultBoardContext||w._vaultBoardRestoring||w.__vaultEdit||w.__animExport||w.__capLock||w.__psThumbCapturing||b.classList.contains('editing')||b.classList.contains('comm-viewing'));
        if(typeof animPlaying!=='undefined'&&animPlaying)blocked=true;
        if(typeof _bliveApplying!=='undefined'&&_bliveApplying)blocked=true;
        return {owner:o,seq:seq,needed:needed,blocked:blocked,current:current};
      },
      prepare:function(){w.restoreAnimBeforeCapture();},
      capture:function(){return w.boardLiveCapture(w.__csView||'board');},
      key:w.boardDraftKey,local:w.localStorage,storage:w.storage,now:Date.now,
      verifyIDB:function(k,raw){return w.PSStorage.sharedVerified(k,raw);}
    });
    var old=w.boardDraftWriteNow,flush=w.psFlushPendingReady,has=w.psHasPending;
    w.boardDraftWriteNow=function(){
      if(!w._boardPrivateOwner)return old.apply(this,arguments);
      return api.write().catch(function(){return false;});
    };
    w.psFlushPendingReady=function(){
      try{w.clearTimeout(w._boardDraftT);w._boardDraftT=null;}catch(_){}
      // A deferred thumbnail redraw must not change the exact captured source
      // after its receipt. restoreAnimBeforeCapture preserves the edit itself.
      try{w.clearTimeout(w._boardPreviewTimer);w._boardPreviewTimer=null;}catch(_){}
      return Promise.resolve().then(function(){return flush?flush():true;}).then(api.ready).then(function(){return w.PSStorage&&w.PSStorage.sharedReady?w.PSStorage.sharedReady():true;});
    };
    w.psHasPending=function(){return !!((has&&has())||api.pending());};
    w.__psBoardDraft=api;
    return api;
  }
  return {create:create,install:install};
});
