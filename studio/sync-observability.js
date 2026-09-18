/* Recent device reports only. This module never reads or writes application content. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSyncObservability=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var ERRORS=['sync_offline','sync_auth','sync_permission','sync_storage','sync_network','sync_timeout','sync_server','sync_rate_limit','sync_conflict','sync_server_rejected','sync_confirm_missing','sync_unexpected'];
  function count(v){return Number.isSafeInteger(v)&&v>=0&&v<=100000?v:null;}
  function iso(v){
    if(v==null||v==='')return null;
    var n=typeof v==='number'?v:Date.parse(v);
    return Number.isFinite(n)&&n>0&&n<=8640000000000000?new Date(n).toISOString():null;
  }
  function fields(v){
    if(!v||typeof v!=='object'||typeof v.online!=='boolean'||typeof v.busy!=='boolean')return null;
    var out={};
    ['pending_team','pending_personal','held','skipped','deferred','conflicts'].forEach(function(k){out[k]=count(v[k]);});
    out.oldest_pending_at=iso(v.oldest_pending_at);out.last_round_ack_at=iso(v.last_round_ack_at);
    out.error_code=v.error_code==null?null:(ERRORS.indexOf(v.error_code)>=0?v.error_code:'sync_unexpected');
    out.device_class=['desktop','tablet','mobile','unknown'].indexOf(v.device_class)>=0?v.device_class:'unknown';
    out.app_version=typeof v.app_version==='string'&&/^[a-zA-Z0-9_.+-]{1,24}$/.test(v.app_version)?v.app_version:'unknown';
    out.online=v.online;out.busy=v.busy;return out;
  }
  function identity(c){
    if(!c||!UUID.test(c.uid)||!UUID.test(c.wid)||typeof c.seal!=='string'||!c.seal)return null;
    return JSON.stringify([c.uid,c.wid,c.seal,c.epoch,c.switchSeal,c.switchEpoch]);
  }
  function missingRpc(e){return !!(e&&(e.missingRpc===true||e.code==='PGRST202'||e.code==='42883'));}
  function createClient(options){
    var o=options||{},w=o.window||(typeof window!=='undefined'?window:null),doc=o.document||(w&&w.document);
    var storage=o.storage||(w&&w.localStorage),crypto=o.crypto||(w&&w.crypto),now=o.now||Date.now;
    var later=o.setTimeout||setTimeout,cancel=o.clearTimeout||clearTimeout;
    var active=false,disabled=false,inFlight=false,dirty=false,timer=null,heartbeat=null,suspended=false;
    function visible(){return !suspended&&(!doc||doc.visibilityState==='visible');}
    function pageHide(){suspended=true;if(timer!=null)cancel(timer);timer=null;}
    function pageShow(){suspended=false;poke();}
    function context(){try{var c=o.context();return identity(c)?{uid:c.uid,wid:c.wid,seal:c.seal,epoch:c.epoch,switchSeal:c.switchSeal,switchEpoch:c.switchEpoch}:null;}catch(_){return null;}}
    function same(c){return identity(c)===identity(context());}
    function randomUuid(){
      if(crypto&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
      if(!crypto||typeof crypto.getRandomValues!=='function')return null;
      var a=new Uint8Array(16);crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
      var h=Array.from(a,function(n){return n.toString(16).padStart(2,'0');}).join('');
      return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    }
    function envelope(c,f){
      /* Identity and sequence must be durable. No in-memory fallback can identify
         reports reliably across reloads or distinguish a new signed-in account. */
      try{
        if(!storage)return null;
        var key='ps_sync_report_device_v1:'+c.uid,device=storage.getItem(key);
        if(device!=null&&!UUID.test(device))return null;
        if(!device){device=randomUuid();if(!UUID.test(device||''))return null;storage.setItem(key,device);}
        if(storage.getItem(key)!==device)return null;
        var sk='ps_sync_report_seq_v1:'+c.uid+':'+device+':'+c.wid,raw=storage.getItem(sk),previous=raw==null?0:Number(raw);
        if((raw!=null&&!/^\d+$/.test(raw))||!Number.isSafeInteger(previous)||previous<0)return null;
        var seq=Math.max(Math.floor(now())*1000,previous+1);
        if(!Number.isSafeInteger(seq)||seq<=0)return null;
        storage.setItem(sk,String(seq));if(storage.getItem(sk)!==String(seq))return null;
        return {p_device_id:device,p_workspace_id:c.wid,p_report_seq:seq,p_fields:f};
      }catch(_){return null;}
    }
    function schedule(delay){
      if(!active||disabled||timer!=null)return;
      timer=later(function(){timer=null;flush();},delay);
    }
    function poke(){dirty=true;schedule(1200);}
    function storageChanged(e){
      /* Report sequence writes must not make two tabs trigger each other. */
      if(!e||['ps_sync_pending_summary_v1','ps_cache_owner_v1','ps_active_ws','ps_hold_list_v1','ps_personal_review_v1','ps_sync_session'].indexOf(e.key)<0)return;
      poke();
    }
    function flush(){
      if(timer!=null){cancel(timer);timer=null;}
      if(!active||disabled||!visible())return Promise.resolve(false);
      if(inFlight){dirty=true;return Promise.resolve(false);}
      var c=context();if(!c)return Promise.resolve(false);
      inFlight=true;dirty=false;var retry=false;
      return Promise.resolve().then(function(){return o.snapshot(c);}).then(function(value){
        if(!active||disabled||!visible()||!same(c))return false;
        var f=fields(value);if(!f||!f.online)return false;
        var body=envelope(c,f);if(!body||!same(c))return false;
        return Promise.resolve(o.send(c,body)).then(function(){return active&&!disabled&&same(c);});
      }).catch(function(e){
        if(missingRpc(e))disabled=true;
        else retry=true;
        return false;
      }).then(function(ok){
        inFlight=false;
        /* Retry samples current state; it never replays a stale snapshot/body. */
        if(active&&!disabled){if(dirty||!same(c))schedule(1200);else if(retry)schedule(30000);}
        return ok;
      });
    }
    function beat(){
      if(!active||disabled)return;
      if(visible())poke();
      heartbeat=later(beat,120000);
    }
    function start(){
      if(active||disabled)return;
      active=true;
      if(w&&w.addEventListener){w.addEventListener('ps-sync-state',poke);w.addEventListener('online',poke);w.addEventListener('storage',storageChanged);w.addEventListener('pagehide',pageHide);w.addEventListener('pageshow',pageShow);}
      if(doc&&doc.addEventListener)doc.addEventListener('visibilitychange',poke);
      heartbeat=later(beat,120000);poke();
    }
    function stop(){
      active=false;dirty=false;if(timer!=null)cancel(timer);if(heartbeat!=null)cancel(heartbeat);timer=null;heartbeat=null;
      if(w&&w.removeEventListener){w.removeEventListener('ps-sync-state',poke);w.removeEventListener('online',poke);w.removeEventListener('storage',storageChanged);w.removeEventListener('pagehide',pageHide);w.removeEventListener('pageshow',pageShow);}
      if(doc&&doc.removeEventListener)doc.removeEventListener('visibilitychange',poke);
    }
    return {start:start,stop:stop,poke:poke,flush:flush,disabled:function(){return disabled;}};
  }
  return {createClient:createClient,fields:fields,identity:identity,missingRpc:missingRpc};
});
