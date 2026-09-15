/* Exact, device-local autosave originals. Never add this namespace to sync keys.
   Call remember only for a server-confirmed body. context() must return null
   while locked or no longer entitled to the current account/workspace. */
(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSAutoSaveJournal=api;
})(typeof window!=='undefined'?window:null,function(root){
  'use strict';
  var PREFIX='ps_autosave_journal_v1:';
  function hash(raw){var h=5381,i=raw.length;while(i)h=(h*33)^raw.charCodeAt(--i);return String(h>>>0)+':'+raw.length;}
  function fail(name){var e=new Error(name);e.name=name;throw e;}
  function text(v){return typeof v==='string'&&v.length>0;}
  function validContext(c){return !!c&&text(c.uid)&&text(c.wid)&&text(c.seal)&&
    (typeof c.epoch==='string'||typeof c.epoch==='number'&&Number.isFinite(c.epoch));}
  function copyContext(c){if(!validContext(c))fail('AutosaveJournalOwnerError');return {uid:c.uid,wid:c.wid,seal:c.seal,epoch:c.epoch};}
  function sameContext(a,b){return validContext(b)&&a.uid===b.uid&&a.wid===b.wid&&a.seal===b.seal&&a.epoch===b.epoch;}
  function scope(c){return PREFIX+encodeURIComponent(c.uid)+':'+encodeURIComponent(c.wid)+':';}
  function key(k){if(!text(k))fail('AutosaveJournalInputError');return encodeURIComponent(k);}
  function version(c){if(typeof c!=='number'||!Number.isFinite(c)||c<0)fail('AutosaveJournalInputError');return c;}
  function uuid(){
    var crypto=(root&&root.crypto)||(typeof globalThis!=='undefined'&&globalThis.crypto);
    if(crypto&&crypto.randomUUID)return crypto.randomUUID();
    if(!crypto||!crypto.getRandomValues)fail('AutosaveJournalRandomError');
    var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
    var h=Array.prototype.map.call(b,function(n){return n.toString(16).padStart(2,'0');}).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  function validId(id){return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);}
  function create(options){
    options=options||{};var storage=options.storage,context=options.context,hashRaw=options.hash||hash,randomUUID=options.randomUUID||uuid,now=options.now||Date.now,tails=Object.create(null);
    if(!storage||typeof storage.get!=='function'||typeof storage.set!=='function'||typeof context!=='function'||typeof hashRaw!=='function')fail('AutosaveJournalInputError');
    function guard(ctx){var captured=copyContext(ctx);return function(){if(!sameContext(captured,context()))fail('AutosaveJournalOwnerError');return captured;};}
    function run(ctx,fn){var current,c;try{current=guard(ctx);c=current();}catch(e){return Promise.reject(e);}return Promise.resolve().then(function(){current();return fn(c,current);});}
    function digest(raw){if(typeof raw!=='string')fail('AutosaveJournalInputError');var h=hashRaw(raw);if(!text(h))fail('AutosaveJournalInputError');return h;}
    function get(k,current){current();return Promise.resolve(storage.get(k)).then(function(r){current();if(r==null||r.value==null)return null;if(typeof r.value!=='string')fail('AutosaveJournalCorruptError');return r.value;});}
    function write(k,raw,current){current();return Promise.resolve(storage.set(k,raw,current)).then(function(ok){current();if(ok===false)fail('AutosaveJournalVerificationError');return get(k,current);}).then(function(check){current();if(check!==raw)fail('AutosaveJournalVerificationError');return true;});}
    function decode(raw){try{var r=JSON.parse(raw);if(r&&typeof r==='object'&&!Array.isArray(r))return r;}catch(_){}fail('AutosaveJournalCorruptError');}
    function entry(e){return !!e&&typeof e.raw==='string'&&text(e.h)&&typeof e.c==='number'&&Number.isFinite(e.c)&&e.c>=0&&digest(e.raw)===e.h;}
    function baseline(raw,ctx,k){
      if(raw===null)return null;var r=decode(raw);
      if(r.v!==1||r.kind!=='base'||r.uid!==ctx.uid||r.wid!==ctx.wid||r.k!==k||!entry(r.current)||(r.previous!==null&&!entry(r.previous)))fail('AutosaveJournalCorruptError');return r;
    }
    function capturedKey(c,k,h,cupd){return scope(c)+'captured:'+key(k)+':'+key(h)+':'+version(cupd);}
    function captured(raw,c,k,h,cupd){
      if(raw===null)return null;var r=decode(raw);
      if(r.v!==1||r.kind!=='captured'||r.uid!==c.uid||r.wid!==c.wid||r.k!==k||!entry(r.entry)||r.entry.h!==h||r.entry.c!==cupd)fail('AutosaveJournalCorruptError');
      return r.entry.raw;
    }
    function keepCaptured(c,k,raw,h,cupd,current){
      var id=capturedKey(c,k,h,cupd),value=JSON.stringify({v:1,kind:'captured',uid:c.uid,wid:c.wid,k:k,entry:{raw:raw,h:h,c:cupd}});
      return serial(id,function(){return get(scope(c)+'base:'+key(k),current).then(function(primary){
        var old=baseline(primary,c,k);
        if(old&&[old.current,old.previous].some(function(e){return e&&e.h===h&&e.c===cupd&&e.raw!==raw;}))fail('AutosaveJournalCollisionError');
        return get(id,current);
      }).then(function(existing){
        if(existing!==null){if(captured(existing,c,k,h,cupd)!==raw)fail('AutosaveJournalCollisionError');if(existing!==value)fail('AutosaveJournalVerificationError');return true;}
        // This is an immutable extra ancestor, never a replacement for the
        // current server baseline. A second tab may have filled it meanwhile.
        if(typeof storage.replaceIfValue!=='function')fail('AutosaveJournalVerificationError');
        current();return Promise.resolve(storage.replaceIfValue(id,null,value,current)).then(function(){
          return get(id,current);
        }).then(function(check){
          if(check===null)fail('AutosaveJournalVerificationError');
          if(captured(check,c,k,h,cupd)!==raw)fail('AutosaveJournalCollisionError');
          if(check!==value)fail('AutosaveJournalVerificationError');
          return true;
        });
      });});
    }
    function metadata(r){return {id:r.id,k:r.k,at:r.at,cupd:r.cupd,reason:r.reason,localHash:r.localHash,remoteHash:r.remoteHash};}
    function archived(raw,ctx,id){
      var r=decode(raw);
      if(r.v!==1||r.kind!=='archive'||r.uid!==ctx.uid||r.wid!==ctx.wid||r.id!==id||!validId(r.id)||!text(r.k)||
        typeof r.at!=='number'||!Number.isFinite(r.at)||r.at<0||typeof r.cupd!=='number'||!Number.isFinite(r.cupd)||r.cupd<0||
        typeof r.reason!=='string'||!/^[A-Za-z0-9_.:-]{1,64}$/.test(r.reason)||
        typeof r.localRaw!=='string'||typeof r.remoteRaw!=='string'||digest(r.localRaw)!==r.localHash||digest(r.remoteRaw)!==r.remoteHash)fail('AutosaveJournalCorruptError');
      return r;
    }
    function serial(k,fn){var before=tails[k]||Promise.resolve(),run=before.catch(function(){}).then(fn);tails[k]=run;return run.then(function(v){if(tails[k]===run)delete tails[k];return v;},function(e){if(tails[k]===run)delete tails[k];throw e;});}
    var api={
      base:function(ctx,k,metaH,metaC){return run(ctx,function(c,current){
        var id=scope(c)+'base:'+key(k);
        if(metaH!=null&&typeof metaH!=='string')fail('AutosaveJournalInputError');
        if(metaC!=null)version(metaC);
        return get(id,current).then(function(raw){var r=baseline(raw,c,k);
          if(!metaH)return r?r.current.raw:null;
          var found=r?[r.current,r.previous].filter(function(e){return e&&e.h===metaH&&(metaC==null||e.c===metaC);}):[];
          if(found.length)return found[0].raw;
          // Extra ancestors are selectable only by both persisted meta fields.
          if(metaC==null)return null;
          return get(capturedKey(c,k,metaH,metaC),current).then(function(saved){return captured(saved,c,k,metaH,metaC);});
        });
      });},
      remember:function(ctx,k,raw,h,cupd){return run(ctx,function(c,current){
        var id=scope(c)+'base:'+key(k);version(cupd);if(digest(raw)!==h)fail('AutosaveJournalInputError');
        return serial(id,function(){current();return get(id,current).then(function(before){
          var old=baseline(before,c,k),next={raw:raw,h:h,c:cupd};
          /* A newer remote baseline may have landed just before local CAS was
             cancelled by a fresh edit. Persisted meta still selects previous;
             confirming that exact ancestor must not rewind current or block
             the next sync before it can read the server again. */
          if(old&&old.previous&&old.previous.raw===raw&&old.previous.h===h&&old.previous.c===cupd)return true;
          if(old&&(old.current.c>cupd||old.current.c===cupd&&old.current.raw!==raw))fail('AutosaveJournalVersionError');
          if(old&&old.current.raw===raw&&old.current.h===h&&old.current.c===cupd)return true;
          return write(id,JSON.stringify({v:1,kind:'base',uid:c.uid,wid:c.wid,k:k,current:next,previous:old?old.current:null}),current);
        });});
      });},
      capture:function(ctx,k,raw,h,cupd){return run(ctx,function(c,current){
        // Only capture may retain an older confirmed local ancestor. Remote
        // reconcile still uses remember(), whose version fence is unchanged.
        return api.remember(c,k,raw,h,cupd).catch(function(error){
          current();if(!error||error.name!=='AutosaveJournalVersionError')throw error;
          return keepCaptured(c,k,raw,h,cupd,current);
        });
      });},
      archive:function(ctx,k,localRaw,remoteRaw,cupd,reason){return run(ctx,function(c,current){
        key(k);version(cupd);
        if(typeof reason!=='string'||!/^[A-Za-z0-9_.:-]{1,64}$/.test(reason))fail('AutosaveJournalInputError');
        var id=randomUUID(),at=now();if(!validId(id)||typeof at!=='number'||!Number.isFinite(at)||at<0)fail('AutosaveJournalInputError');
        var r={v:1,kind:'archive',uid:c.uid,wid:c.wid,id:id,k:k,at:at,cupd:cupd,reason:reason,localHash:digest(localRaw),remoteHash:digest(remoteRaw),localRaw:localRaw,remoteRaw:remoteRaw},sk=scope(c)+'archive:'+id;
        return serial(sk,function(){return get(sk,current).then(function(existing){if(existing!==null)fail('AutosaveJournalCollisionError');return write(sk,JSON.stringify(r),current);}).then(function(){current();return metadata(r);});});
      });},
      list:function(ctx){return run(ctx,function(c,current){
        var prefix=scope(c)+'archive:';
        if(typeof storage.keys!=='function')fail('AutosaveJournalInputError');
        return Promise.resolve(storage.keys(prefix)).then(function(keys){current();if(!Array.isArray(keys))fail('AutosaveJournalCorruptError');
          var mine=keys.filter(function(k){return typeof k==='string'&&k.indexOf(prefix)===0;});
          return Promise.all(mine.map(function(k){var id=k.slice(prefix.length);if(!validId(id))fail('AutosaveJournalCorruptError');return get(k,current).then(function(raw){if(raw===null)fail('AutosaveJournalCorruptError');return metadata(archived(raw,c,id));});}));
        }).then(function(rows){current();return rows.sort(function(a,b){return b.at-a.at||a.id.localeCompare(b.id);});});
      });},
      read:function(ctx,id){return run(ctx,function(c,current){
        if(!validId(id))fail('AutosaveJournalInputError');
        return get(scope(c)+'archive:'+id,current).then(function(raw){if(raw===null)return null;var r=archived(raw,c,id);return {metadata:metadata(r),localRaw:r.localRaw,remoteRaw:r.remoteRaw};});
      });}
    };return api;
  }
  return {create:create,hash:hash,PREFIX:PREFIX};
});
