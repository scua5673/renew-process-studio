/* Preserve a quota-rejected immutable roster batch before any main/SQ write.
 * Rescue batches use the native outbox schema and stay pending until their
 * exact localStorage copy exists and the IndexedDB original is gone. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSRosterPending=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function error(message,name){var e=new Error(message);e.name=name||'StorageOwnerChangedError';return e;}
  function quota(e){return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014);}
  function create(options){
    options=options||{};
    var Outbox=options.outbox,local=options.local,disk=options.storage,owner=options.owner,stamp=options.stamp,editable=options.editable;
    if(!Outbox||typeof Outbox.create!=='function'||typeof Outbox.prefix!=='string'||!local||typeof owner!=='function'||typeof stamp!=='function'||typeof editable!=='function')throw error('선수 변경 보관 기능을 준비하지 못했습니다','TypeError');
    var states=new Map(),operation=null;
    function context(){
      var o=owner();if(o==null)return null;
      if(!o||typeof o.uid!=='string'||!o.uid||typeof o.wid!=='string'||!o.wid)throw error('선수 변경의 계정과 팀을 확인하지 못했습니다');
      var s=stamp();if(typeof s!=='string'||!s)throw error('선수 변경의 저장 범위를 확인하지 못했습니다');
      return {uid:o.uid,wid:o.wid,prefix:Outbox.prefix+encodeURIComponent(o.uid)+':'+encodeURIComponent(o.wid)+':',stamp:s};
    }
    function state(c){
      var s=states.get(c.prefix);
      if(!s){s={cache:new Map(),jobs:new Set(),tail:Promise.resolve(),loading:null,preparedStamp:null,hydrateError:null,promotionError:null,promoting:null,transitionEmpty:null};states.set(c.prefix,s);}
      return s;
    }
    function scope(c,write){
      var now=context();
      if(!c||!now||now.prefix!==c.prefix||now.stamp!==c.stamp||local.getItem('ps_ws_switch_guard_v1')||write&&editable()!==true)throw error('계정·권한 또는 팀 전환 상태가 바뀌어 선수 변경 보관을 중단했습니다');
      return true;
    }
    function localNames(c){
      var names=[];for(var i=0;i<local.length;i++){var k=local.key(i);if(typeof k==='string'&&k.indexOf(c.prefix)===0)names.push(k);}
      return names.sort();
    }
    function capture(c){
      scope(c,true);var entries=localNames(c).map(function(k){return [k,local.getItem(k)];});
      var cap={context:c,main:local.getItem('scout_tool_v1'),tombs:local.getItem('cs_player_del_v1'),entries:entries};
      sourceCurrent(cap);return cap;
    }
    function sourceCurrent(cap){
      scope(cap.context,true);
      if(local.getItem('scout_tool_v1')!==cap.main||local.getItem('cs_player_del_v1')!==cap.tombs||cap.entries.some(function(pair){return local.getItem(pair[0])!==pair[1];}))throw error('선수 변경의 원문이 바뀌어 보관을 중단했습니다');
      return true;
    }
    function activeCache(){var c=context();return c?state(c).cache:null;}
    function mergedKeys(){
      var out=[],seen=Object.create(null),c=context();
      for(var i=0;i<local.length;i++){var k=local.key(i);if(typeof k==='string'&&!seen[k]){seen[k]=true;out.push(k);}}
      if(c)state(c).cache.forEach(function(rec,k){if(!seen[k]){seen[k]=true;out.push(k);}});
      return out;
    }
    function mergedGet(k){
      var raw=local.getItem(k),cache=activeCache(),rec=cache&&cache.get(k);
      if(rec&&raw!==null&&raw!==rec.raw)throw error('두 저장소의 선수 변경 원문이 다릅니다','StorageConflictError');
      return rec?rec.raw:raw;
    }
    function peek(k){
      if(!disk||typeof disk.peek!=='function')return Promise.reject(error('선수 변경 원문을 되읽을 수 없습니다','StorageError'));
      return Promise.resolve(disk.peek(k)).then(function(v){return v&&v.value!=null?v.value:null;});
    }
    function persist(c,s,k,rec){
      rec.failure=null;
      var job=s.tail.catch(function(){}).then(function(){
        sourceCurrent(rec.capture);
        if(!disk||disk.conditionalGuardVersion!==1||typeof disk.setIfValues!=='function')throw error('선수 변경을 안전하게 비교 보관할 수 없습니다','StorageError');
        return disk.setIfValues(k,null,rec.raw,{},function(){return sourceCurrent(rec.capture);});
      }).then(function(){return peek(k);}).then(function(raw){
        sourceCurrent(rec.capture);
        if(raw!==rec.raw)throw error('선수 변경의 보관 원문이 다릅니다','StorageConflictError');
        rec.durable=true;return true;
      }).catch(function(e){rec.failure=e;throw e;});
      s.tail=job;s.jobs.add(job);
      job.then(function(){s.jobs.delete(job);},function(){s.jobs.delete(job);});
      return job;
    }
    var composite={
      get length(){return mergedKeys().length;},
      key:function(i){return mergedKeys()[i]||null;},
      getItem:mergedGet,
      setItem:function(k,raw){
        try{local.setItem(k,raw);return;}
        catch(e){
          var cap=operation,c=cap&&cap.context;
          if(!quota(e)||!c||k.indexOf(c.prefix+'b:')!==0)throw e;
          sourceCurrent(cap);var s=state(c),old=s.cache.get(k);
          if(old&&old.raw!==raw)throw error('보존할 선수 변경 원문이 충돌했습니다','StorageConflictError');
          if(!old){old={raw:String(raw),capture:cap,durable:false,failure:null,sourceError:e,promotionStarted:false};s.cache.set(k,old);persist(c,s,k,old);}
        }
      },
      removeItem:function(k){local.removeItem(k);}
    };
    var native=Outbox.create({storage:composite,owner:owner});
    function prepared(){try{var c=context();return !c||state(c).preparedStamp===c.stamp&&!state(c).loading&&!state(c).hydrateError;}catch(_){return false;}}
    function assertPrepared(c){scope(c,false);if(!prepared())throw error('선수 변경 보관함을 불러오는 중입니다','StorageError');}
    function hasRescue(){
      try{var c=context();if(!c)return false;var s=state(c);return !prepared()&&!transitionEmptyCurrent(c,s)||s.cache.size>0||s.jobs.size>0||!!s.loading;}
      catch(_){return true;}
    }
    function failure(){
      try{var c=context();if(!c)return null;var s=state(c),found=s.hydrateError||s.promotionError;
        s.cache.forEach(function(rec){if(!found)found=rec.failure;});
        if(!found)s.cache.forEach(function(rec){if(!found)found=rec.sourceError;});return found||null;
      }catch(e){return e;}
    }
    function snapshot(c,attempt,check){
      check=check||function(){scope(c,false);};check();
      if(!disk||typeof disk.keys!=='function'||typeof disk.peek!=='function')return Promise.reject(error('선수 변경 보관함을 불러올 수 없습니다','StorageError'));
      var keys,raws;
      function names(){return Promise.resolve(disk.keys(c.prefix)).then(function(list){check();return list.filter(function(k){return typeof k==='string'&&k.indexOf(c.prefix)===0;}).sort();});}
      return names().then(function(v){keys=v;return Promise.all(keys.map(peek));}).then(function(v){check();raws=v;return names();}).then(function(later){
        if(JSON.stringify(keys)!==JSON.stringify(later))return false;
        return Promise.all(keys.map(peek)).then(function(values){check();return values.every(function(raw,i){return raw===raws[i];});});
      }).then(function(stable){
        if(!stable){if(attempt<3)return snapshot(c,attempt+1,check);throw error('다른 창에서 선수 변경 보관함을 바꾸고 있습니다','StorageConflictError');}
        return keys.map(function(k,i){return [k,raws[i]];}).filter(function(pair){return pair[1]!==null;});
      });
    }
    function transitionProof(c,s){
      var p=typeof options.suspended==='function'?options.suspended():null;
      if(!p||p.uid!==c.uid||p.wid!==c.wid||!p.proof||p.stamp!==c.stamp||!s.preparedStamp||p.beforeStamp!==s.preparedStamp||!local.getItem('ps_ws_switch_guard_v1'))throw error('전환 전 선수 변경 보관 상태를 확인하지 못했습니다');
      if(s.cache.size||s.jobs.size||s.loading||s.promoting||s.hydrateError||s.promotionError)throw error('선수 변경 원문 보관 확인이 남아 있습니다');
      return JSON.stringify(p);
    }
    function transitionEmptyCurrent(c,s){
      var proof=s.transitionEmpty;if(!proof)return false;
      try{return proof.stamp===c.stamp&&proof.proof===transitionProof(c,s)&&proof.local===JSON.stringify(localNames(c).map(function(k){return [k,local.getItem(k)];}))&&!native.pending();}catch(_){return false;}
    }
    function emptyForTransition(){
      var c,s,proof,localRaw;
      try{c=context();if(!c)throw error('전환 전 선수 변경의 계정과 팀을 확인하지 못했습니다');s=state(c);s.transitionEmpty=null;proof=transitionProof(c,s);localRaw=JSON.stringify(localNames(c).map(function(k){return [k,local.getItem(k)];}));}
      catch(e){return Promise.reject(e);}
      function current(){
        var now=context();
        if(!now||now.prefix!==c.prefix||now.stamp!==c.stamp||proof!==transitionProof(now,s)||localRaw!==JSON.stringify(localNames(c).map(function(k){return [k,local.getItem(k)];}))||native.pending())throw error('전환 확인 중 선수 변경의 원문이나 소유자가 바뀌었습니다');
      }
      return Promise.resolve().then(function(){current();return snapshot(c,0,current);}).then(function(entries){
        current();if(entries.length)throw error('큰 저장소에 확인할 선수 변경 원문이 남아 있습니다');
        s.transitionEmpty={stamp:c.stamp,proof:proof,local:localRaw};return true;
      });
    }
    function prepare(){
      var c;try{c=context();if(!c)return Promise.resolve(true);scope(c,false);}catch(e){return Promise.reject(e);}
      var s=state(c);if(s.loading)return s.loading;
      s.hydrateError=null;s.preparedStamp=null;s.transitionEmpty=null;
      var work=snapshot(c,0).then(function(entries){
        scope(c,false);var verified=Object.create(null);
        entries.forEach(function(pair){var rec=s.cache.get(pair[0]);
          if(rec&&rec.raw!==pair[1])throw error('두 저장소의 선수 변경 원문이 다릅니다','StorageConflictError');
          verified[pair[0]]=true;
          if(!rec)s.cache.set(pair[0],{raw:pair[1],capture:null,durable:true,failure:null,sourceError:null,promotionStarted:false});
          else{rec.durable=true;rec.failure=null;}
        });
        // Use the real outbox parser/owner checks for every hydrated document.
        native.read();scope(c,false);
        s.preparedStamp=c.stamp;
        s.cache.forEach(function(rec,k){
          // An explicit prepare verified these same owner-scoped originals
          // again; a refreshed permission/epoch may authorize promotion now.
          // Read-only preparation never starts a preservation write.
          if(rec.durable&&verified[k]&&editable()===true)rec.capture=capture(c);
          if(!rec.durable&&rec.failure&&editable()===true){rec.capture=capture(c);persist(c,s,k,rec);}
        });
        return true;
      }).catch(function(e){s.hydrateError=e;s.preparedStamp=null;throw e;});
      s.loading=work;
      work.then(function(){if(s.loading===work)s.loading=null;},function(){if(s.loading===work)s.loading=null;});
      return work;
    }
    function ready(){
      var c;try{c=context();if(!c)return Promise.resolve(true);}catch(e){return Promise.reject(e);}
      var s=state(c);
      function wait(){
        scope(c,false);
        return Promise.resolve(s.loading).then(function(){return Promise.all(Array.from(s.jobs));}).then(function(){
          scope(c,false);if(s.jobs.size)return wait();
          if(s.hydrateError)throw s.hydrateError;
          var failed=null;s.cache.forEach(function(rec){if(!failed&&rec.failure)failed=rec.failure;});if(failed)throw failed;
          assertPrepared(c);return true;
        });
      }
      return Promise.resolve().then(wait);
    }
    function stage(input){
      var c=context();if(!c)return native.stage(input);assertPrepared(c);var cap=capture(c),previous=operation;
      operation=cap;try{var result=native.stage(input);scope(c,true);return result;}finally{operation=previous;}
    }
    function read(){var c=context();if(c)assertPrepared(c);return native.read();}
    function overlay(players){var c=context();if(c)assertPrepared(c);return native.overlay(players);}
    function pending(){try{return hasRescue()||native.pending();}catch(_){return true;}}
    function writable(){var c=context();assertPrepared(c);scope(c,true);if(hasRescue())throw error('보존 중인 선수 변경을 먼저 확인해 주세요','StorageError');return c;}
    function ack(receipt){var c=writable(),result=native.ack(receipt);scope(c,true);return result;}
    function settle(receipt,current){var c=writable();return native.settle(receipt,function(){scope(c,true);if(typeof current!=='function'||current()===false)return false;return scope(c,true);});}
    function settled(proof,current){try{var c=writable();return native.settled(proof,function(){scope(c,true);if(typeof current!=='function'||current()===false)return false;return scope(c,true);});}catch(_){return false;}}
    function promote(){
      var c;try{c=context();if(!c)return Promise.resolve(true);scope(c,true);}catch(e){return Promise.reject(e);}
      var s=state(c);if(s.promoting)return s.promoting;s.promotionError=null;
      function move(k,rec){
        scope(c,true);var cap=rec.capture||capture(c);rec.capture=cap;
        function current(){sourceCurrent(cap);if(local.getItem(k)!==rec.raw)throw error('선수 변경의 작은 저장소 사본이 바뀌었습니다');return true;}
        var lv=local.getItem(k);
        if(lv!==null&&lv!==rec.raw)throw error('두 저장소의 선수 변경 원문이 다릅니다','StorageConflictError');
        return peek(k).then(function(raw){
          sourceCurrent(cap);
          if(raw===null&&rec.promotionStarted&&lv===rec.raw){current();s.cache.delete(k);return true;}
          if(raw!==rec.raw)throw error('보존된 선수 변경 원문을 확인하지 못했습니다','StorageConflictError');
          // IndexedDB readback is asynchronous. Another tab may have filled
          // this previously absent LS key while it was awaited.
          var live=local.getItem(k);
          if(live!==null&&live!==rec.raw)throw error('두 저장소의 선수 변경 원문이 다릅니다','StorageConflictError');
          if(live===null)local.setItem(k,rec.raw);
          current();rec.promotionStarted=true;
          if(!disk||typeof disk.delIfValue!=='function')throw error('선수 변경 원문을 안전하게 옮길 수 없습니다','StorageError');
          return disk.delIfValue(k,rec.raw,current).then(function(changed){
            current();if(changed!==true)throw error('선수 변경 원문의 이동을 확인하지 못했습니다','StorageConflictError');
            return peek(k);
          }).then(function(after){
            current();if(after!==null)throw error('선수 변경 원문이 큰 저장소에 남아 있습니다','StorageConflictError');
            s.cache.delete(k);return true;
          });
        });
      }
      function drain(){
        return ready().then(function(){scope(c,true);var first=s.cache.entries().next();if(first.done)return true;return move(first.value[0],first.value[1]).then(drain);});
      }
      var work=Promise.resolve().then(drain).catch(function(e){s.promotionError=e;throw e;});
      s.promoting=work;work.then(function(){if(s.promoting===work)s.promoting=null;},function(){if(s.promoting===work)s.promoting=null;});return work;
    }
    return {stage:stage,read:read,overlay:overlay,pending:pending,ack:ack,settle:settle,settled:settled,prepare:prepare,prepared:prepared,ready:ready,hasRescue:hasRescue,failure:failure,promote:promote,emptyForTransition:emptyForTransition};
  }
  return {create:create};
});
