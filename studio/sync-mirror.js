/* Exact screen-copy commit for roster pulls. Never roll back another edit or owner. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSMirrorSync=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function failure(stage){
    var e=new Error('선수 자료의 기기 저장을 확인할 수 없습니다');
    e.psCode='sync_storage';e.psStage=stage;return e;
  }
  function write(o){
    var error;
    try{
      if(!o.current())throw failure('mirror_owner_changed');
      o.mirror.setItem(o.key,o.value);
      if(o.mirror.getItem(o.key)!==o.value)throw failure('mirror_readback');
      if(typeof o.recover==='function')return Promise.resolve(o.recover(o.key,o.value,function(){return o.current()&&o.mirror.getItem(o.key)===o.value;})).then(function(){return {stale:false};});
      return Promise.resolve({stale:false});
    }catch(e){error=failure('scout_mirror_write');error.cause=e;}
    // The IDB candidate is already committed. Restore only its exact previous
    // value, and only while the unchanged screen copy still belongs to this owner.
    function current(){
      if(!o.current()||o.mirror.getItem(o.key)!==o.mirrorBefore)throw failure('mirror_rollback_changed');
    }
    return Promise.resolve().then(function(){
      current();
      if(o.before===o.value)return;
      if(!o.storage.replaceIfValue)throw failure('mirror_rollback_unavailable');
      return o.storage.replaceIfValue(o.key,o.value,o.before,current);
    }).catch(function(){
      // A newer edit/owner or a failed rollback must stay intact and unconfirmed.
    }).then(function(){throw error;});
  }
  return {write:write};
});
