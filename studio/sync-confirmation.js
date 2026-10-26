/* Memory-only exact schedule confirmation. The sync adapter supplies only
   existing owner/state/meta reads and already-validated protocol responses. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSyncConfirmation=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function create(d){
/* Exact UI confirmation is deliberately narrower than sync's fingerprint
   protocol. One schedule body read from the server or accepted under the
   schedule's atomic version guard is retained in memory only. A 32-bit hash,
   unconditional ACK, local base or successful other key cannot create it.
   The caller must also verify its own current local
   durable snapshot/revision. Reading this API performs no I/O or migration. */
var syncValueReceipt=null,syncValueDeferred=null,syncValueActive=null,syncValueEditSeq=0;
function syncValueContext(){try{return d.context();}catch(_){return null;}}
function syncValueSame(c){
  var n=syncValueContext();return !!c&&!!n&&JSON.stringify(c)===JSON.stringify(n);
}
function syncValueEdited(k){
  if(k!==d.key)return;
  syncValueEditSeq++;syncValueReceipt=null;syncValueDeferred=null;
}
function syncValueBegin(){
  var owner=syncValueContext();
  var prior=syncValueDeferred;
  syncValueDeferred=null;
  syncValueActive=owner?{owner:owner,seq:syncValueEditSeq,candidate:prior&&prior.seq===syncValueEditSeq&&syncValueSame(prior.owner)?prior:null,invalid:false}:null;
  return syncValueActive;
}
function syncValueObserve(round,wid,rows,keys,mode){
  if(!round||round!==syncValueActive||!syncValueSame(round.owner)||round.seq!==syncValueEditSeq||
     String(wid)!==round.owner.wid||!Array.isArray(keys)||keys.indexOf(d.key)<0)return;
  if(!Array.isArray(rows)){round.invalid=true;return;}
  var found=rows.filter(function(r){return r&&r.k===d.key;});
  /* A version-only response is not a server-body observation. The separate
     schedule CAS proof below may confirm a strictly guarded submitted body. */
  if(mode==='ack'&&(!found.length||(found.length===1&&found[0].v===undefined)))return;
  if(found.length!==1){round.invalid=true;return;}
  var r=found[0],version=Number(r.cupd);
  if(typeof r.v!=='string'||r.__fromBase||
     (r.workspace_id!==undefined&&String(r.workspace_id)!==round.owner.wid)||
     (typeof r.cupd!=='number'&&typeof r.cupd!=='string')||!Number.isSafeInteger(version)||version<=0){round.invalid=true;return;}
  var previous=round.candidate;
  if(previous&&previous.version>version)return;
  if(previous&&previous.version===version&&previous.raw!==r.v){round.invalid=true;return;}
  round.candidate={owner:round.owner,seq:round.seq,raw:r.v,version:version};
}
function syncValueObserveAccepted(round,requests,rows){
  if(!round||round!==syncValueActive||!Array.isArray(requests)||!Array.isArray(rows))return;
  var reqs=requests.filter(function(r){return r&&r.k===d.key;});
  if(reqs.length!==1)return;
  var req=reqs[0],found=rows.filter(function(r){return r&&r.k===d.key;}),version=Number(req.cupd);
  if(found.length!==1||typeof req.v!=='string'||String(req.workspace_id)!==round.owner.wid||
     (typeof req.cupd!=='number'&&typeof req.cupd!=='string')||!Number.isSafeInteger(version)||version<=0)return;
  var r=found[0],previous=Number(req._casCupd),missing=req._casMissing===true;
  if(String(r.workspace_id)!==round.owner.wid||
     (typeof r.cupd!=='number'&&typeof r.cupd!=='string')||Number(r.cupd)!==version)return;
  if(missing?req._casCupd!=null:(req._casCupd==null||
     (typeof req._casCupd!=='number'&&typeof req._casCupd!=='string')||
     !Number.isSafeInteger(previous)||previous<0||version<=previous))return;
  if(r.v!==undefined&&r.v!==req.v){round.invalid=true;return;}
  /* Only schedule CAS/insert is covered: the lineage/team guards either keep
     NEW.v verbatim, return no row, or retain OLD.cupd. A unique response with
     our strictly newer version therefore proves the submitted bytes accepted.
     No-op/lost-response retries use the existing full-row read instead. Blob
     preparation may change req.v; never relabel its original inline body. */
  syncValueObserve(round,req.workspace_id,[{k:req.k,workspace_id:r.workspace_id,v:req.v,cupd:r.cupd}],[req.k],'accepted-cas');
}
function syncValueAck(round,requests,responses){
  if(!Array.isArray(requests)||!requests.length||!Array.isArray(responses))return;
  responses.forEach(function(rows){syncValueObserve(round,requests[0].workspace_id,rows,requests.map(function(r){return r.k;}),'ack');});
  syncValueObserveAccepted(round,requests,responses[0]);
}
function syncValueFinish(round,result){
  if(!round||round!==syncValueActive)return;
  syncValueActive=null;
  if(!syncValueSame(round.owner)||round.seq!==syncValueEditSeq||round.invalid||!result||result.error||
     result.personalError||result.scheduleDeferred||result.pending!==0||
     !Array.isArray(result.skipped)||result.skipped.length||!Array.isArray(result.held)||result.held.length||
     !Array.isArray(result.deferred)||result.deferred.indexOf(d.key)>=0){syncValueReceipt=null;syncValueDeferred=null;return;}
  // Schedule ACKs normally defer the dependent match key to a second round.
  // Retain their exact bytes privately, never as a visible receipt, until a
  // same-owner/revision round has no deferred work. No extra read is needed.
  if(result.deferred.length){syncValueDeferred=round.candidate||syncValueReceipt;syncValueReceipt=null;return;}
  syncValueDeferred=null;
  if(round.candidate)syncValueReceipt=round.candidate;
  else if(syncValueReceipt&&(!syncValueSame(syncValueReceipt.owner)||syncValueReceipt.seq!==syncValueEditSeq))syncValueReceipt=null;
}
function syncConfirmedValue(k,raw){
  try{
    var r=syncValueReceipt;
    if(k!==d.key||typeof raw!=='string'||!r||raw!==r.raw||syncValueActive||d.busy()||
       r.seq!==syncValueEditSeq||!syncValueSame(r.owner))return false;
    var state=d.state(),m=d.meta();
    if(!state||state.kind!=='ok'||state.n!==0||state.review!==0)return false;
    /* These are invalidation fences only. Exactness comes from r.raw, never
       from the weak fingerprint or a general last-sync timestamp. */
    return !!m.h&&!!m.c&&m.h[k]===d.hash(raw)&&Number(m.c[k])===r.version&&syncValueSame(r.owner);
  }catch(_){return false;}
}


    return {begin:syncValueBegin,observe:syncValueObserve,observeAccepted:syncValueObserveAccepted,ack:syncValueAck,
      finish:syncValueFinish,edited:syncValueEdited,confirmedValue:syncConfirmedValue};
  }
  return {create:create};
});
