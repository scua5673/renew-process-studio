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
  function status(w,scope,next,error){try{var api=w.PSSaveState;if(api)api[next](scope,error);}catch(_){} }
  function conflict(){var e=new Error('다른 창의 개인 보드를 보존합니다');e.psCode='board_private_conflict';return e;}
  function headGuard(w,o,r){
    var generation=w._boardPrivateGeneration,seq=w._boardPrivateEditSeq;
    return function(){if(!w.boardPrivateCurrent(o)||w._boardPrivateRecord!==r||generation!==w._boardPrivateGeneration||seq!==w._boardPrivateEditSeq)throw conflict();return true;};
  }
  function exactIDB(w,key,raw,current){
    return w.storage.get(key).then(function(v){current();if(!v||v.value!==raw)throw conflict();
      if(!w.PSStorage||!w.PSStorage.sharedVerified)throw new Error('기기 저장 확인 기능을 새로 불러와 주세요');
      return w.PSStorage.sharedVerified(key,raw).catch(function(){throw conflict();});
    }).then(function(){current();return true;});
  }
  function recoveredLocal(w,key,raw,current){
    current();if(w.localStorage.getItem(key)!==raw)throw conflict();
    return Promise.resolve(w.PSStorage&&w.PSStorage.localRecovered?w.PSStorage.localRecovered(key,raw,current):false).then(function(){current();if(w.localStorage.getItem(key)!==raw)throw conflict();return true;});
  }
  function keepHead(w,o,r){
    if(!w._boardPrivateKept||!w.boardPrivateSameAccount(w._boardPrivateKept,o))w._boardPrivateKept={uid:o.uid,wid:o.wid,key:w.boardPrivateKey(o)+':kept:'+w.boardPrivateToken(),local:null,idb:null,queue:Promise.resolve()};
    var branch=w._boardPrivateKept,raw=JSON.stringify(r),current=headGuard(w,o,r);
    function local(){current();if(w.localStorage.getItem(branch.key)!==branch.local)throw conflict();w.localStorage.setItem(branch.key,raw);if(w.localStorage.getItem(branch.key)!==raw)throw conflict();branch.local=raw;return true;}
    var work=branch.queue.catch(function(){}).then(async function(){
      current();if(!w.storage||!w.storage.replaceIfValue)throw new Error('복구 저장소를 확인하지 못했습니다');
      var value=await w.storage.get(branch.key);current();var prior=value&&value.value;prior=prior==null?null:prior;
      if(prior!==raw){if(prior!==branch.idb&&prior!==branch.local)throw conflict();if(!await w.storage.replaceIfValue(branch.key,prior,raw,current))throw conflict();}
      await exactIDB(w,branch.key,raw,current);branch.idb=raw;
      if(w.localStorage.getItem(branch.key)===branch.local&&branch.local!==null){current();w.localStorage.removeItem(branch.key);if(w.localStorage.getItem(branch.key)===null)branch.local=null;}
      return true;
    }).catch(function(e){current();if(e&&e.psCode==='board_private_conflict')throw e;return local();});
    branch.queue=work;return work;
  }
  async function archiveHeads(w,o,local,idb,current){
    if(local===null||idb===null||w.boardPrivateDecode(local,o).raw===w.boardPrivateDecode(idb,o).raw)return;
    var previous=w.__psBoardOriginals,owner=JSON.stringify(o);
    if(!previous||previous.owner!==owner||previous.local!==local||previous.idb!==idb)previous=w.__psBoardOriginals={owner:owner,local:local,idb:idb,keys:[w.boardPrivateKey(o)+':kept:source-'+w.boardPrivateToken(),w.boardPrivateKey(o)+':kept:source-'+w.boardPrivateToken()]};
    for(var i=0;i<2;i++){
      current();var raw=i?idb:local,key=previous.keys[i],v=await w.storage.get(key);current();var before=v&&v.value;before=before==null?null:before;
      if(before!==raw&&(before!==null||!await w.storage.replaceIfValue(key,null,raw,current)))throw conflict();
      await exactIDB(w,key,raw,current);
    }
  }
  function persistHead(w,o,r){
    if(!w.boardPrivateCurrent(o))return Promise.reject(conflict());
    var key=w.boardPrivateKey(o),raw=JSON.stringify(r),mirror=w._boardPrivateHead,generation=w._boardPrivateGeneration;
    w._boardPrivateRecord=r;var guard=headGuard(w,o,r);
    function current(){guard();if(w.localStorage.getItem(key)!==mirror)throw conflict();return true;}
    function mark(next,e){guard();w.__psBoardPrivatePersistence={owner:JSON.stringify(o),generation:w._boardPrivateGeneration,seq:w._boardPrivateEditSeq,token:r.token,pending:next==='begin',failed:next==='fail'};status(w,'board-private',next,e);}
    function preserve(){return keepHead(w,o,r).then(function(){throw conflict();}).catch(function(e){try{mark('fail',e);}catch(_){}throw e;});}
    if(w.localStorage.getItem(key)!==mirror)return preserve();
    mark('begin');
    var work=w._boardPrivateLocal.catch(function(){}).then(async function(){
      current();var idb=w._boardPrivateIdbHead;
      if(!w.storage||!w.storage.get||!w.storage.replaceIfValue)throw new Error('기기 저장소를 확인하지 못했습니다');
      var value=await w.storage.get(key);current();var prior=value&&value.value;prior=prior==null?null:prior;w.boardPrivateDecode(prior,o);
      if(prior!==raw){
        if(prior!==idb)throw conflict();try{await archiveHeads(w,o,mirror,idb,current);}catch(_){throw conflict();}
        if(!await w.storage.replaceIfValue(key,prior,raw,current))throw conflict();
        // A committed own CAS remains a known preimage even when a later edit
        // invalidates this job's UI/durability receipt during exact readback.
        if(w.boardPrivateCurrent(o)&&generation===w._boardPrivateGeneration&&w._boardPrivateIdbHead===prior)w._boardPrivateIdbHead=raw;
      }
      await exactIDB(w,key,raw,current);current();w._boardPrivateIdbHead=raw;
      // Only the captured, unchanged mirror may be removed after complete IDB readback.
      if(mirror!==null){w.localStorage.removeItem(key);if(w.localStorage.getItem(key)!==null)throw conflict();mirror=null;w._boardPrivateHead=null;}
      current();w._boardPrivateDurableToken=r.token;mark('ok');return true;
    }).catch(async function(e){
      guard();
      if(e&&e.psCode==='board_private_conflict'){await keepHead(w,o,r);e.psKept=true;throw e;}
      current();w.localStorage.setItem(key,raw);if(w.localStorage.getItem(key)!==raw)throw conflict();mirror=raw;w._boardPrivateHead=raw;
      await recoveredLocal(w,key,raw,current);current();w._boardPrivateDurableToken=r.token;mark('ok');return true;
    }).catch(async function(e){try{guard();if(e&&e.psCode==='board_private_conflict'&&!e.psKept)try{await keepHead(w,o,r);}catch(_){}mark('fail',e);}catch(_){}throw e;});
    w._boardPrivateLocal=work;return work;
  }
  function create(d){
    var job=null,known=null,recovery=null,tail=Promise.resolve(),cancelEpoch=0;
    function error(){var e=new Error('작전판 초안을 기기에 보관하지 못했습니다. 다시 시도해 주세요');e.psCode='board_draft_storage';return e;}
    function changed(){var e=error();e.psConflict=true;return e;}
    function same(j){var c=d.context();return j===job&&j.epoch===cancelEpoch&&!!c&&c.needed&&c.seq===j.seq&&c.generation===j.generation&&JSON.stringify(c.owner)===j.ownerRaw;}
    function body(j){var c=d.capture();return !!c&&sameBody(c.raw,j.raw);}
    function source(j){var raw=d.local.getItem(j.key);return raw===j.localBefore||raw===j.record;}
    function current(j,full){var c=d.context();if(!same(j)||c.blocked||!c.current||!source(j)||(full&&!body(j)))throw error();return true;}
    function recoveryFor(j){if(!recovery||recovery.owner!==j.ownerRaw)recovery={owner:j.ownerRaw,key:(d.recoveryKey?d.recoveryKey(j.owner):j.key+':kept:')+j.at+'-'+Math.random().toString(36).slice(2),local:null,idb:null};return recovery;}
    function localRecovery(j){
      var c=d.context(),branch=recoveryFor(j);if(!same(j)||c.blocked||!c.current||!body(j)||d.local.getItem(branch.key)!==branch.local)throw error();
      d.local.setItem(branch.key,j.record);if(d.local.getItem(branch.key)!==j.record)throw error();branch.local=j.record;return true;
    }
    function recover(j){
      function guard(){var c=d.context();if(!same(j)||c.blocked||!c.current||!body(j))throw error();return true;}
      var branch=recoveryFor(j);
      return Promise.resolve().then(async function(){
        guard();if(!d.storage||!d.storage.replaceIfValue||!d.verifyIDB)throw error();
        var v=await d.storage.get(branch.key);guard();var old=v&&v.value;old=old==null?null:old;
        if(old!==branch.idb&&old!==branch.local&&old!==j.record)throw error();
        if(old!==j.record&&!await d.storage.replaceIfValue(branch.key,old,j.record,guard))throw error();
        await d.verifyIDB(branch.key,j.record);guard();branch.idb=j.record;
        if(branch.local!==null&&d.local.getItem(branch.key)===branch.local){d.local.removeItem(branch.key);branch.local=null;}
        return true;
      }).catch(function(){guard();return localRecovery(j);});
    }
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
        j.checkedIDB=iv==null?null:iv;
        var selected=a&&b?(b.at>a.at?iv:lv):(a?lv:(b?iv:null));
        if(selected!==j.record)throw error();
        if(j.store==='idb'){
          if(iv!==j.record||!d.verifyIDB)throw error();
          return d.verifyIDB(j.key,j.record).then(function(){if(writing)current(j);if(!same(j)||d.context().blocked||!source(j)||!body(j))throw error();return true;});
        }
        return true;
      });
    }
    function local(j){
      current(j,true);if(!j.localOwned)throw error();
      if(d.local.getItem(j.key)!==j.record)d.local.setItem(j.key,j.record);
      if(d.local.getItem(j.key)!==j.record)throw error();current(j,true);
      // Ownership of a complete synchronous fallback is separate from an IDB
      // or completed receipt. A later edit may safely replace this exact copy.
      var before=known&&known.owner===j.ownerRaw?known:null;
      known={owner:j.ownerRaw,local:j.record,idb:before?before.idb:(j.idbSeen?j.idbBefore:null),own:true};
      j.store='local';return true;
    }
    function persist(j){
      var work=Promise.resolve().then(function(){
        current(j);if(!j.localOwned)throw changed();
        if(!d.storage||!d.storage.get||!d.storage.replaceIfValue)throw error();
        return d.storage.get(j.key).then(function(v){
          current(j);var before=v&&v.value;before=before==null?null:before;
          if(!j.idbSeen){j.idbSeen=true;j.idbBefore=known&&known.owner===j.ownerRaw?known.idb:j.localBefore;}
          if(known&&known.owner===j.ownerRaw&&!known.own&&known.local!==null&&known.idb!==null&&known.local!==known.idb){var a=parse(known.local,j),b=parse(known.idb,j);if(!a||!b||a.raw!==b.raw)throw changed();}
          if(before!==j.idbBefore&&before!==j.record)throw changed();
          var previous=parse(before,j);
          // Never overwrite a concurrent/future draft first seen after capture.
          if(before!==j.record&&previous&&previous.at>=j.at)throw changed();
          if(before===j.record)return true;
          return d.storage.replaceIfValue(j.key,j.idbBefore,j.record,function(){return current(j,true);}).then(function(ok){
            if(!ok)throw changed();var c=d.context();
            if(j.epoch===cancelEpoch&&c&&c.current&&c.needed&&c.generation===j.generation&&JSON.stringify(c.owner)===j.ownerRaw&&(!known||known.owner===j.ownerRaw&&known.idb===j.idbBefore))known={owner:j.ownerRaw,local:known?known.local:j.localBefore,idb:j.record,own:true};
            current(j);return true;
          });
        }).then(function(){j.store='idb';return check(j,true);}).then(function(){
          current(j,true);var old=d.local.getItem(j.key);
          if(old!==null){if(!j.localOwned||old!==j.localBefore&&old!==j.record)throw error();d.local.removeItem(j.key);if(d.local.getItem(j.key)!==null)throw error();j.localBefore=null;}
          known={owner:j.ownerRaw,local:null,idb:j.record};return true;
        });
      });
      return work.catch(function(e){
        if(e&&e.psConflict)return recover(j).then(function(){
          // A lifecycle fallback belongs to this job, not to the conflicting
          // source. Move it to recovery before dropping only that exact copy.
          current(j,true);if(d.local.getItem(j.key)===j.record){d.local.removeItem(j.key);j.localBefore=null;}
          throw e;
        });
        // Operational IDB failure may use a complete LS receipt; conflicting
        // IDB contents still fail the ordinary reload-selection check below.
        try{local(j);}catch(_){return recover(j).then(function(){throw e;});}
        return check(j,true).then(function(){return d.recoverLocal?d.recoverLocal(j.key,j.record,function(){return current(j,true);}):true;}).then(function(){known={owner:j.ownerRaw,local:j.record,idb:j.checkedIDB,own:true};return true;});
      }).then(function(){current(j,true);j.ok=true;if(d.state)d.state('ok');return true;});
    }
    function write(options){
      var c=d.context();
      if(!c||!c.needed||c.blocked||!c.current)return Promise.resolve(false);
      if(!job||!same(job)||!body(job)){
        try{
          var cap=d.capture();if(!cap||typeof cap.raw!=='string')return Promise.reject(error());
          var ownerRaw=JSON.stringify(c.owner);
          var key=d.key(c.owner),before=d.local.getItem(key),at=d.now(),old;
          [before,known&&known.owner===ownerRaw?known.idb:null].forEach(function(raw){try{old=JSON.parse(raw||'null');if(old&&old.at>=at)at=+old.at+1;}catch(_){} });
          job={owner:c.owner,ownerRaw:ownerRaw,seq:c.seq,generation:c.generation,epoch:cancelEpoch,key:key,localBefore:before,localOwned:before===null||!!(known&&known.owner===ownerRaw&&known.local===before),raw:cap.raw,at:at,
            record:JSON.stringify({v:1,uid:c.owner.uid,wid:c.owner.wid,raw:cap.raw,at:at}),ok:false,work:null,store:null,idbSeen:false};
        }catch(_){return Promise.reject(error());}
      }
      var j=job;
      // The browser may terminate before IDB finishes. Only this last-chance
      // lifecycle path writes LS synchronously; ordinary committed edits do not.
      if(options&&options.lifecycle&&!j.ok)try{local(j);}catch(_){try{localRecovery(j);}catch(__){} }
      if(j.work)return j.work;
      if(j.ok)return check(j,true);
      if(d.state)d.state('begin');
      var work=tail.catch(function(){}).then(function(){return persist(j);});tail=work;
      j.work=work.then(function(v){j.work=null;return v;},function(e){j.work=null;j.ok=false;if(d.state&&same(j))d.state('fail',e);throw e;});
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
    function observe(owner,local,idb){var c=d.context();if(c&&c.current&&JSON.stringify(owner)===JSON.stringify(c.owner)&&(!job||!same(job)))known={owner:JSON.stringify(owner),local:local,idb:idb};}
    function clear(owner){
      var c=d.context(),ownerRaw=JSON.stringify(owner),seq=c&&c.seq,generation=c&&c.generation;
      if(!c||!c.current||JSON.stringify(c.owner)!==ownerRaw)return Promise.resolve(false);
      var k=d.key(owner),own=job&&job.ownerRaw===ownerRaw?job.record:null,previous=known&&known.owner===ownerRaw?known:null,lv=[own,previous&&previous.local],iv=[own,previous&&previous.idb],epoch=++cancelEpoch;
      job=null;known=null;
      function guard(){var now=d.context();if(cancelEpoch!==epoch||job!==null||!now||!now.current||now.seq!==seq||now.generation!==generation||JSON.stringify(now.owner)!==ownerRaw)throw error();return true;}
      guard();var local=d.local.getItem(k);if(local!==null&&lv.indexOf(local)>=0)d.local.removeItem(k);
      return iv.filter(function(v,i){return v!==null&&v!==undefined&&iv.indexOf(v)===i;}).reduce(function(p,v){return p.then(function(){guard();return d.storage&&d.storage.delIfValue?d.storage.delIfValue(k,v,guard):false;});},Promise.resolve(true));
    }
    return {write:write,ready:ready,pending:pending,observe:observe,clear:clear,snapshot:function(){var c=d.context();return {owner:c&&JSON.stringify(c.owner),seq:c&&c.seq,generation:c&&c.generation,needed:!!(c&&c.needed),blocked:!!(c&&c.blocked),pending:pending(),localDurable:!!(job&&job.ok&&same(job)),store:job&&job.store,failed:!!(job&&same(job)&&!job.ok&&!job.work),unsaved:!!(c&&c.needed),serverConfirmed:false};}};
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
        return {owner:o,seq:seq,generation:w._boardPrivateGeneration,needed:needed,blocked:blocked,current:current};
      },
      prepare:function(){
        w.restoreAnimBeforeCapture();
        // Restoring playback can schedule a fresh preview after the flush's
        // initial cancellation. Freeze that derived work before the receipt.
        try{w.clearTimeout(w._boardPreviewTimer);w._boardPreviewTimer=null;}catch(_){}
      },
      capture:function(){return w.boardLiveCapture(w.__csView||'board');},
      key:w.boardDraftKey,local:w.localStorage,storage:w.storage,now:Date.now,
      recoveryKey:function(o){return w.boardPrivateKey(o)+':kept:unsaved-';},
      verifyIDB:function(k,raw){return w.PSStorage.sharedVerified(k,raw);},
      recoverLocal:function(k,raw,current){return w.PSStorage&&w.PSStorage.localRecovered?w.PSStorage.localRecovered(k,raw,current):false;},
      state:function(next,e){status(w,'board-draft',next,e);}
    });
    var old=w.boardDraftWriteNow,flush=w.psFlushPendingReady,has=w.psHasPending;
    w.boardDraftWriteNow=function(options){
      if(!w._boardPrivateOwner)return old.apply(this,arguments);
      return api.write(options).catch(function(){return false;});
    };
    w.psFlushPendingReady=function(){
      try{w.clearTimeout(w._boardDraftT);w._boardDraftT=null;}catch(_){}
      // A deferred thumbnail redraw must not change the exact captured source
      // after its receipt. restoreAnimBeforeCapture preserves the edit itself.
      try{w.clearTimeout(w._boardPreviewTimer);w._boardPreviewTimer=null;}catch(_){}
      return Promise.resolve().then(function(){return flush?flush():true;}).then(api.ready).then(function(){return w.PSStorage&&w.PSStorage.sharedReady?w.PSStorage.sharedReady():true;});
    };
    w.psHasPending=function(){return !!((has&&has())||api.pending());};
    var snap=api.snapshot;api.snapshot=function(){
      var value=snap(),r=w._boardPrivateRecord,o=w._boardPrivateOwner||w.boardPrivateOwner&&w.boardPrivateOwner(),owner=JSON.stringify(o),p=w.__psBoardPrivatePersistence,receipt=w.__psBoardPrivateReceipt;
      value.unknown=!!(o&&(!w._boardPrivateLoaded||!w.boardPrivateCurrent(o)||w.__boardRestoring));value.serverPending=!!(r&&r.pending);
      value.privateLocalDurable=!!(!value.unknown&&r&&r.token===w._boardPrivateDurableToken);
      value.privateServerConfirmed=!!(!value.needed&&value.privateLocalDurable&&!r.pending&&receipt&&receipt.owner===owner&&receipt.generation===w._boardPrivateGeneration&&receipt.raw===r.raw&&r.base&&r.base.raw===receipt.raw&&r.base.cupd===receipt.cupd);
      if(p&&p.owner===owner&&p.generation===value.generation&&p.seq===value.seq&&r&&p.token===r.token){value.failed=value.failed||p.failed;value.pending=value.pending||p.pending;}
      if(value.unknown){value.blocked=true;value.localDurable=false;}return value;
    };
    w.__psBoardDraft=api;
    return api;
  }
  return {create:create,install:install,persistHead:persistHead,keepHead:keepHead};
});
