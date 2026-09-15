/* Durable, owner-scoped roster edits. Immutable batches prevent a late ACK in
 * another tab from replacing a newer draft. This module never sends data. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSRosterOutbox=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var PREFIX='ps_roster_pending_v1:',own=Function.call.bind(Object.prototype.hasOwnProperty);
  function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
  function fail(message){throw new Error(message);}
  function id(v){return typeof v==='string'&&v.length>0&&v.length<=512&&!/[\u0000-\u001f\u007f]/.test(v);}
  function copy(v){
    var raw=JSON.stringify(v,function(k,x){if(typeof x==='undefined'||typeof x==='function'||typeof x==='symbol'||typeof x==='bigint'||typeof x==='number'&&!Number.isFinite(x))fail('선수 기록을 JSON으로 보관할 수 없습니다');return x;});
    if(typeof raw!=='string')fail('선수 기록 원문이 없습니다');return JSON.parse(raw);
  }
  function player(v,pid){return object(v)&&id(v.id)&&v.id===pid&&v.type!=='target'&&!v._del;}
  function roster(players){
    if(!Array.isArray(players))fail('선수 명단 형식을 확인할 수 없습니다');
    var map=Object.create(null);players.forEach(function(p){if(!object(p)||!id(p.id)||own(map,p.id))fail('선수 식별자가 없거나 중복되었습니다');if(p.type==='target')return;var clean=copy(p);if(!player(clean,clean.id))fail('보관할 선수 원문이 올바르지 않습니다');map[clean.id]=clean;});return map;
  }
  function history(rows){var seen=Object.create(null),out=[];(rows||[]).forEach(function(p){var raw=JSON.stringify(p);if(!seen[raw]){seen[raw]=1;out.push(copy(p));}});return out;}
  function token(){
    var random='';if(typeof crypto!=='undefined'&&crypto.getRandomValues){var a=new Uint32Array(4);crypto.getRandomValues(a);random=Array.from(a,function(x){return x.toString(36);}).join('-');}
    else random=Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
    return Date.now().toString(36)+'-'+random;
  }
  function create(options){
    options=options||{};var storage=options.storage,ownerOf=options.owner;
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'||typeof storage.key!=='function'||typeof ownerOf!=='function')fail('선수 변경 보관함을 준비하지 못했습니다');
    function context(){var o=ownerOf();if(o==null)return null;if(!object(o)||!id(o.uid)||!id(o.wid))fail('선수 변경의 계정과 팀을 확인할 수 없습니다');return {uid:o.uid,wid:o.wid,prefix:PREFIX+encodeURIComponent(o.uid)+':'+encodeURIComponent(o.wid)+':'};}
    function guard(c){var now=context();if(!c||!now||now.prefix!==c.prefix)fail('계정이나 팀이 바뀌어 선수 변경 보관을 중단했습니다');}
    function empty(c){return {owner:c?{uid:c.uid,wid:c.wid}:null,key:c?c.prefix:null,keys:[],rows:[]};}
    function names(c){var out=[];for(var i=0;i<storage.length;i++){var k=storage.key(i);if(typeof k==='string'&&k.indexOf(c.prefix)===0)out.push(k);}guard(c);return out.sort();}
    function validKey(c,k,kind){return typeof k==='string'&&k.indexOf(c.prefix+kind+':')===0&&/^[a-z0-9-]+$/.test(k.slice((c.prefix+kind+':').length));}
    function parse(c,key,raw){
      var d;try{d=JSON.parse(raw);}catch(_){fail('보관된 선수 변경 원문을 읽을 수 없습니다');}
      if(!object(d)||d.v!==1||d.uid!==c.uid||d.wid!==c.wid||(d.kind!=='batch'&&d.kind!=='ack')||!validKey(c,key,d.kind==='batch'?'b':'a')||key!==c.prefix+(d.kind==='batch'?'b:':'a:')+d.token)fail('보관된 선수 변경의 소유자 또는 형식이 다릅니다');
      if(d.kind==='batch'){
        if(!Number.isSafeInteger(d.seq)||d.seq<1||!Array.isArray(d.rows)||!d.rows.length)fail('보관된 선수 변경 묶음이 올바르지 않습니다');
        var seen=Object.create(null);d.rows.forEach(function(r,i){if(!object(r)||!id(r.id)||own(seen,r.id)||r.token!==d.token+':'+i||typeof r.deleted!=='boolean'||(r.base!==null&&!player(r.base,r.id))||(r.deleted?r.player!==null:!player(r.player,r.id))||(r.history!==undefined&&(!Array.isArray(r.history)||r.history.some(function(p){return !player(p,r.id);}))))fail('보관된 선수 변경 행이 올바르지 않습니다');seen[r.id]=1;});
      }else{
        if(!Array.isArray(d.sources)||!d.sources.length)fail('선수 변경 확인 기록이 올바르지 않습니다');
        d.sources.forEach(function(s){if(!object(s)||!validKey(c,s.key,'b')||!id(s.id)||typeof s.token!=='string'||!s.token)fail('선수 변경 확인 대상이 올바르지 않습니다');});
      }
      return d;
    }
    function scan(c){
      // A second exact read prevents a concurrent tab's ACK/cleanup from making
      // a half-read snapshot look like an older pending draft.
      for(var attempt=0;attempt<4;attempt++){
        var keys=names(c),raws=keys.map(function(k){return storage.getItem(k);});guard(c);
        var later=names(c);if(JSON.stringify(keys)!==JSON.stringify(later))continue;
        if(keys.some(function(k,i){return storage.getItem(k)!==raws[i];}))continue;
        guard(c);var docs=[];keys.forEach(function(k,i){if(raws[i]!==null)docs.push({key:k,raw:raws[i],doc:parse(c,k,raws[i])});});return docs;
      }
      fail('다른 창에서 선수 변경을 보관 중입니다. 다시 시도해 주세요');
    }
    function mark(source){return JSON.stringify([source.key,source.id,source.token]);}
    function state(c){
      var docs=scan(c),acked=Object.create(null),maxSeq=0,by=Object.create(null),order=[];
      docs.forEach(function(x){if(x.doc.kind==='ack')x.doc.sources.forEach(function(s){acked[mark(s)]=1;});else maxSeq=Math.max(maxSeq,x.doc.seq);});
      docs.filter(function(x){return x.doc.kind==='batch';}).sort(function(a,b){return a.doc.seq-b.doc.seq||(a.doc.token<b.doc.token?-1:a.doc.token>b.doc.token?1:0);}).forEach(function(x){x.doc.rows.forEach(function(r){
        var source={key:x.key,id:r.id,token:r.token,raw:JSON.stringify(r)};if(acked[mark(source)])return;
        var previous=by[r.id];if(!previous){previous={id:r.id,base:copy(r.base),player:null,deleted:false,token:r.token,history:[],sources:[]};by[r.id]=previous;order.push(r.id);}
        previous.history=history(previous.history.concat(previous.player?[previous.player]:[],r.history||[]));
        previous.player=copy(r.player);previous.deleted=r.deleted;previous.token=r.token;previous.sources.push(source);
      });});
      guard(c);return {docs:docs,acked:acked,maxSeq:maxSeq,rows:order.map(function(pid){return by[pid];})};
    }
    function receipt(c,rows){var out=empty(c),seen=Object.create(null);out.rows=copy(rows);rows.forEach(function(r){r.sources.forEach(function(s){if(!seen[s.key]){seen[s.key]=1;out.keys.push(s.key);}});});return out;}
    function write(c,kind,make){
      guard(c);var t,k;for(var i=0;i<8;i++){t=token();k=c.prefix+kind+':'+t;if(storage.getItem(k)===null)break;}if(storage.getItem(k)!==null)fail('선수 변경 보관 키를 만들지 못했습니다');
      var doc=make(t),raw=JSON.stringify(doc);guard(c);storage.setItem(k,raw);guard(c);if(storage.getItem(k)!==raw)fail('선수 변경이 기기에 보관되었는지 확인하지 못했습니다');return {key:k,doc:doc};
    }
    function read(){var c=context();return c?receipt(c,state(c).rows):empty(null);}
    function stage(input){
      var c=context();if(!c)fail('선수 변경을 보관할 계정과 팀이 없습니다');
      input=input||{};var players=roster(input.players),base=roster(input.basePlayers),changed=input.changedIds,deleted=input.deletedIds;
      if(!Array.isArray(changed)||!Array.isArray(deleted))fail('변경한 선수 목록을 확인할 수 없습니다');
      var wanted=Object.create(null),ids=[];changed.forEach(function(pid){if(!id(pid)||own(wanted,pid)||!own(players,pid))fail('변경한 선수와 보관 원문이 다릅니다');wanted[pid]=false;ids.push(pid);});
      deleted.forEach(function(pid){if(!id(pid)||own(wanted,pid)||own(players,pid))fail('삭제할 선수와 남길 명단이 다릅니다');wanted[pid]=true;ids.push(pid);});
      if(!ids.length)return empty(c);
      var current=state(c),pending=Object.create(null);current.rows.forEach(function(r){pending[r.id]=r;});
      if(current.maxSeq>=Number.MAX_SAFE_INTEGER)fail('선수 변경 보관 순서를 확인할 수 없습니다');
      var batch=write(c,'b',function(t){return {v:1,kind:'batch',uid:c.uid,wid:c.wid,token:t,seq:current.maxSeq+1,rows:ids.map(function(pid,i){return {id:pid,base:pending[pid]?copy(pending[pid].base):(own(base,pid)?copy(base[pid]):null),player:wanted[pid]?null:copy(players[pid]),deleted:wanted[pid],token:t+':'+i,history:pending[pid]?history(pending[pid].history.concat(pending[pid].player?[pending[pid].player]:[])):[]};})};});
      return receipt(c,batch.doc.rows.map(function(r){var sources=pending[r.id]?copy(pending[r.id].sources):[];sources.push({key:batch.key,id:r.id,token:r.token,raw:JSON.stringify(r)});return {id:r.id,base:copy(r.base),player:copy(r.player),deleted:r.deleted,token:r.token,history:copy(r.history),sources:sources};}));
    }
    function cleanup(c){
      var current=state(c);
      current.docs.forEach(function(x){if(x.doc.kind==='batch'&&x.doc.rows.every(function(r){return current.acked[mark({key:x.key,id:r.id,token:r.token})];})){guard(c);if(storage.getItem(x.key)===x.raw)storage.removeItem(x.key);}});
      current.docs.forEach(function(x){if(x.doc.kind==='ack'&&x.doc.sources.every(function(s){return storage.getItem(s.key)===null;})){guard(c);if(storage.getItem(x.key)===x.raw)storage.removeItem(x.key);}});
    }
    function ack(captured){
      var c=context();if(!c||!object(captured)||!object(captured.owner)||captured.owner.uid!==c.uid||captured.owner.wid!==c.wid||captured.key!==c.prefix||!Array.isArray(captured.rows))fail('다른 계정이나 팀의 선수 변경은 확인 처리하지 않습니다');
      var current=state(c),sources=[],seen=Object.create(null),ids=Object.create(null),docs=Object.create(null);current.docs.forEach(function(x){docs[x.key]=x;});
      captured.rows.forEach(function(r){if(!object(r)||!id(r.id)||!Array.isArray(r.sources))fail('확인할 선수 변경 원문이 없습니다');r.sources.forEach(function(s){
        if(!object(s)||s.id!==r.id||!validKey(c,s.key,'b')||typeof s.token!=='string'||typeof s.raw!=='string')fail('확인할 선수 변경 대상이 다릅니다');
        var x=docs[s.key],row=x&&x.doc.kind==='batch'&&x.doc.rows.find(function(v){return v.id===s.id&&v.token===s.token;});
        var identity=mark(s);if(!row||JSON.stringify(row)!==s.raw||seen[identity]||current.acked[identity])return;
        seen[identity]=1;ids[r.id]=1;sources.push({key:s.key,id:s.id,token:s.token});
      });});
      if(!sources.length)return 0;
      write(c,'a',function(t){return {v:1,kind:'ack',uid:c.uid,wid:c.wid,token:t,sources:sources};});
      // ACK markers are durable before any payload is removed. Cleanup is only
      // space reclamation; its failure cannot turn a completed row into a draft.
      try{cleanup(c);}catch(_){}guard(c);return Object.keys(ids).length;
    }
    function overlay(players){
      var copied=copy(players),map=roster(copied),c=context();if(!c)return copied;
      var pending=state(c).rows,changes=Object.create(null),used=Object.create(null),out=[];pending.forEach(function(r){changes[r.id]=r;});
      copied.forEach(function(p){if(p.type==='target'){out.push(p);return;}var r=changes[p.id];used[p.id]=1;if(!r)out.push(p);else if(!r.deleted)out.push(copy(r.player));});
      pending.forEach(function(r){if(!used[r.id]&&!r.deleted)out.push(copy(r.player));});guard(c);return out;
    }
    return {stage:stage,read:read,ack:ack,overlay:overlay,pending:function(){return read().rows.length>0;}};
  }
  return {create:create,prefix:PREFIX};
});
