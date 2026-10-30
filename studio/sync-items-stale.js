/* A stale player job is a durable device review, never a new roster batch.
   The existing journal owns immutable bodies and exact readback. Nothing here
   chooses a winner, advances a server baseline, or deletes a review. */
(function(root,factory){
  'use strict';var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSItemsStale=api;
})(typeof window==='undefined'?null:window,function(root){
  'use strict';
  var REASON='items-stale-device',CARRIERS=['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1'];
  function issue(stage){var e=new Error('선수 입력 원문을 보관했습니다. 저장 진단에서 확인해 주세요.');e.psCode=stage==='items_stale_review'||stage==='items_stale_changed'?'sync_local_changed':stage==='items_stale_owner'?'sync_workspace_changed':'sync_storage';e.psStage=stage;return e;}
  function same(a,b){return !!a&&!!b&&a.uid===b.uid&&a.wid===b.wid&&a.seal===b.seal&&a.epoch===b.epoch;}
  function text(x){return typeof x==='string'&&x.length>0;}
  function id(x){return text(x)&&x.trim()===x&&['__proto__','prototype','constructor'].indexOf(x)<0;}
  function raw(x){return x===null||typeof x==='string';}
  var projectionWatches=new WeakMap();
  // A completed round may confirm an unchanged row after the iframe's one-shot
  // boot read. Notify its existing guarded renderer; never apply or write here.
  function watchProjection(w,scope,notify){
    if(!w||typeof scope!=='function'||typeof notify!=='function')throw issue('items_stale_shape');
    if(projectionWatches.has(w))return projectionWatches.get(w);
    var parent=w.parent,timer=null,closed=false,suspended=false,last=null;
    function current(){
      try{var api=parent&&parent.PSSync,state=api&&api.state(),owner=scope();
        return !closed&&!suspended&&api&&api.dataUnlocked()===true&&state&&state.kind==='ok'&&text(owner)?{owner:owner,at:state.at}:null;
      }catch(_){return null;}
    }
    function pulse(){
      var c=current();if(!c||timer!==null||JSON.stringify([c.owner,c.at])===last)return;
      timer=w.setTimeout(function(){
        timer=null;var now=current();if(!now||now.owner!==c.owner)return;
        var token=JSON.stringify([now.owner,now.at]);if(token===last)return;last=token;
        try{notify();}catch(_){last=null;}
      },0);
    }
    function hide(e){
      if(e&&e.persisted){suspended=true;if(timer!==null)w.clearTimeout(timer);timer=null;}else stop();
    }
    function show(){suspended=false;pulse();}
    function stop(){
      if(closed)return;closed=true;if(timer!==null)w.clearTimeout(timer);timer=null;
      parent.removeEventListener('ps-sync-state',pulse);w.removeEventListener('pagehide',hide);w.removeEventListener('pageshow',show);w.removeEventListener('unload',stop);projectionWatches.delete(w);
    }
    if(!parent||parent===w||typeof parent.addEventListener!=='function')return function(){};
    projectionWatches.set(w,stop);parent.addEventListener('ps-sync-state',pulse);w.addEventListener('pagehide',hide);w.addEventListener('pageshow',show);w.addEventListener('unload',stop);pulse();return stop;
  }
  function create(d){
    var loaded=null,records=[],resolved=new Set(),certificates=new WeakMap(),prepared=new WeakMap(),tail=Promise.resolve(),loadTicket=0,latestLoad=null,captures=new Map(),notice=null,noticeContext=null;
    function readyNotice(c){
      if(typeof d.notify!=='function')return;noticeContext=c;if(notice!==null)return;
      notice=setTimeout(function(){notice=null;if(same(noticeContext,context())&&ready()&&!capturing())try{d.notify(noticeContext);}catch(_){}},0);
    }
    function context(){var c=d.context();return c&&text(c.uid)&&text(c.wid)&&text(c.seal)?c:null;}
    function outboxFor(){return d.outbox?d.outbox():root&&root.PSRosterOutbox&&root.PSRosterOutbox.create({storage:root.localStorage,owner:function(){var c=context();return c?{uid:c.uid,wid:c.wid}:null;}});}
    function guard(c){if(!same(c,context()))throw issue('items_stale_owner');}
    function ready(){var c=context();return !!c&&same(c,loaded);}
    function active(){return records.filter(function(r){return !resolved.has(r.id);});}
    function capturing(){var c=context();return c?(captures.get(JSON.stringify(c))||0):0;}
    function count(){return context()?Math.max(capturing(),ready()?active().length:1):0;}
    function fenced(k){
      if(!count())return false;
      if(CARRIERS.indexOf(k)>=0)return true;
      return typeof k==='string'&&k.indexOf('sq:')===0&&(capturing()>0||!ready()||active().some(function(r){return r.payload.ids.indexOf(k.slice(3))>=0;}));
    }
    function checkJob(job){
      if(!job||!d.current(job.owner)||d.permission()==null||(job.patch&&d.permission()!==job.permission))throw issue('items_stale_owner');
    }
    function payload(job){
      checkJob(job);var ids=Object.keys(job.expected||{}).sort(),authored=Object.create(null);
      if(!ids.length||!Array.isArray(job.players)||!Number.isSafeInteger(job.sequence)||job.sequence<1||!Number.isFinite(job.at))throw issue('items_stale_shape');
      ids.forEach(function(k){
        if(!id(k)||!raw(job.expected[k]))throw issue('items_stale_shape');
        var player=job.players.find(function(p){return p&&String(p.id)===k;});
        authored[k]=player?JSON.stringify(player):JSON.stringify({_del:job.at});
      });
      return {v:1,kind:REASON,owner:{uid:job.owner.uid,wid:job.owner.wid,seal:job.owner.seal,epoch:job.owner.epoch,signout:job.owner.signout},sequence:job.sequence,at:job.at,patch:!!job.patch,permissionHash:d.hash(job.permission||''),ids:ids,expected:JSON.parse(JSON.stringify(job.expected)),authored:authored,written:JSON.parse(JSON.stringify(job.written||[])),intent:job.pendingIntent?JSON.parse(JSON.stringify(job.pendingIntent)):null};
    }
    function decode(value,c){
      var p,b;try{p=JSON.parse(value.localRaw);b=JSON.parse(value.remoteRaw);}catch(_){throw issue('items_stale_archive');}
      if(!p||p.v!==1||p.kind!==REASON||!p.owner||p.owner.uid!==c.uid||p.owner.wid!==c.wid||!text(p.owner.seal)||!Number.isSafeInteger(p.sequence)||p.sequence<1||!Number.isFinite(p.at)||!Array.isArray(p.ids)||!p.ids.length||new Set(p.ids).size!==p.ids.length||!p.expected||!p.authored||!Array.isArray(p.written)||!b||b.v!==1||b.kind!=='items-stale-device-comparison'||b.provenance!=='device-idb'||!b.values)throw issue('items_stale_archive');
      if(Object.keys(p.expected).length!==p.ids.length||Object.keys(p.authored).length!==p.ids.length||Object.keys(b.values).length!==p.ids.length)throw issue('items_stale_archive');
      p.ids.forEach(function(k){if(!id(k)||!Object.prototype.hasOwnProperty.call(p.expected,k)||!Object.prototype.hasOwnProperty.call(p.authored,k)||!Object.prototype.hasOwnProperty.call(b.values,k)||!raw(p.expected[k])||typeof p.authored[k]!=='string'||!raw(b.values[k]))throw issue('items_stale_archive');});
      return p;
    }
    function load(){
      var c=context(),ticket=++loadTicket;
      var work=(async function(){
      if(!c)throw issue('items_stale_owner');loaded=null;
      var journal=d.journal(c.wid),list=await journal.list(c);guard(c);
      var next=[],choices=[];
      for(var row of list){
        if(row.reason!==REASON&&row.reason!=='items-stale-resolved')continue;
        if(row.k!=='scout_tool_v1')throw issue('items_stale_archive');
        var value=await journal.read(c,row.id);guard(c);
        if(!value||value.metadata.id!==row.id||value.metadata.reason!==row.reason)throw issue('items_stale_archive');
        if(row.reason==='items-stale-resolved'){
          var choice;try{choice=JSON.parse(value.localRaw);}catch(_){throw issue('items_stale_archive');}
          if(!choice||choice.v!==1||choice.kind!=='items-stale-resolution'||choice.choice!=='keep-current-device'||choice.uid!==c.uid||choice.wid!==c.wid||!text(choice.archiveId)||typeof choice.originalLocalRaw!=='string'||typeof choice.originalRemoteRaw!=='string'||choice.currentRaw!==value.remoteRaw)throw issue('items_stale_archive');
          choices.push(choice);continue;
        }
        next.push({id:row.id,payload:decode(value,c),localRaw:value.localRaw,remoteRaw:value.remoteRaw});
      }
      var retired=new Set();choices.forEach(function(choice){
        var r=next.find(function(r){return r.id===choice.archiveId;});
        if(!r||r.localRaw!==choice.originalLocalRaw||r.remoteRaw!==choice.originalRemoteRaw)throw issue('items_stale_archive');
        if(r.payload.intent){var outbox=outboxFor();if(!outbox||!outbox.settled||outbox.settled(choice.settlement,function(){guard(c);return true;})!==true)throw issue('items_stale_archive');}
        retired.add(r.id);
      });
      guard(c);
      if(ticket!==loadTicket){
        var joined;do{joined=latestLoad;await joined;guard(c);}while(joined!==latestLoad);
        if(!ready())throw issue('items_stale_changed');return active().length;
      }
      records=next;resolved=retired;loaded=c;readyNotice(c);return active().length;
      })();latestLoad=work;return work;
    }
    function signature(job){return JSON.stringify(payload(job));}
    function skip(job){
      try{var proof=certificates.get(job);if(!proof||!ready())return false;checkJob(job);return proof===signature(job)&&records.some(function(r){return r.localRaw===proof;});}catch(_){return false;}
    }
    function retired(job){
      try{
        if(!ready())return false;
        var body=signature(job),p=JSON.parse(body);
        return records.some(function(r){return resolved.has(r.id)&&(r.localRaw===body||p.intent&&JSON.stringify(p.intent)===JSON.stringify(r.payload.intent)&&p.ids.every(function(k){return r.payload.ids.indexOf(k)>=0&&p.authored[k]===r.payload.authored[k];}));});
      }catch(_){return false;}
    }
    async function readRows(ids,c,current){
      var out=Object.create(null);
      for(var k of ids){current();var v=await d.storage.get('sq:'+k);guard(c);current();v=v&&v.value!=null?v.value:null;if(!raw(v))throw issue('items_stale_shape');out[k]=v;}
      return out;
    }
    function capture(job,error){
      var captureContext=context(),scope=captureContext&&JSON.stringify(captureContext);
      if(scope)captures.set(scope,(captures.get(scope)||0)+1);
      var run=tail.catch(function(){}).then(async function(){
        if(!error||error.psItemsJob!==job||!['items_write_stale_job','items_stale_review'].includes(error.psStage))throw error||issue('items_stale_shape');
        var c=context();if(!c)throw issue('items_stale_owner');
        var localRaw=signature(job),p=JSON.parse(localRaw),journal=d.journal(c.wid);
        function current(){guard(c);checkJob(job);if(signature(job)!==localRaw)throw issue('items_stale_changed');}
        current();
        await load();current();
        var existing=records.find(function(r){return r.localRaw===localRaw;});
        if(existing){certificates.set(job,localRaw);return {id:existing.id,reason:REASON};}
        var values=await readRows(p.ids,c,current),remoteRaw=JSON.stringify({v:1,kind:'items-stale-device-comparison',provenance:'device-idb',values:values});
        var archived=await journal.archive(c,'scout_tool_v1',localRaw,remoteRaw,0,REASON);current();
        var value=await journal.read(c,archived.id);current();
        if(!value||value.localRaw!==localRaw||value.remoteRaw!==remoteRaw||value.metadata.reason!==REASON)throw issue('items_stale_archive');
        decode(value,c);
        if(JSON.stringify(await readRows(p.ids,c,current))!==JSON.stringify(values))throw issue('items_stale_changed');
        await load();current();
        if(!records.some(function(r){return r.id===archived.id&&r.localRaw===localRaw&&r.remoteRaw===remoteRaw;}))throw issue('items_stale_archive');
        certificates.set(job,localRaw);return archived;
      });
      var final=run.then(function(v){if(scope)captures.set(scope,captures.get(scope)-1);return v;},function(e){if(scope)captures.set(scope,captures.get(scope)-1);if(same(captureContext,context()))loaded=null;throw e;});
      tail=final;return final;
    }
    async function before(job){
      checkJob(job);await load();checkJob(job);if(retired(job))return true;
      if(Object.keys(job.expected||{}).some(function(k){return fenced('sq:'+k);})){var e=issue('items_stale_review');e.psItemsJob=job;throw e;}
    }
    async function background(flush){
      await load();
      try{return await flush();}
      catch(e){
        if(!e||!e.psItemsJob||!['items_write_stale_job','items_stale_review'].includes(e.psStage))throw e;
        await capture(e.psItemsJob,e);return {held:true,quarantined:true};
      }
    }
    function keys(){
      if(!count())return [];
      var out=CARRIERS.slice();active().forEach(function(r){r.payload.ids.forEach(function(k){if(out.indexOf('sq:'+k)<0)out.push('sq:'+k);});});return out;
    }
    function hold(k,list){if(!fenced(k))return false;if(list.indexOf(k)<0)list.push(k);return true;}
    async function foreground(flush){await load();if(count())throw issue('items_stale_review');return flush();}
    function state(s){
      var n=count();if(!n||!s||s.kind==='off')return s;
      var out=Object.assign({},s,{n:Math.max(+s.n||0,n),review:(+s.review||0)+(ready()?n:0)});
      if(s.kind==='bad')return out;
      if(capturing()){out.kind='busy';out.text='선수 입력 원문 보관 중';return out;}
      out.kind=ready()?'ask':'wait';out.reason='items_stale_review';out.text=ready()?'선수 입력 확인이 필요해요 · '+n+'건':'보관된 선수 입력 확인 중';return out;
    }
    function selection(current){if(typeof current!=='function'||current()!==true)throw issue('items_stale_changed');}
    function chosen(row,value){
      var r=records.find(function(r){return row&&r.id===row.id;});
      if(!r||row.reason!==REASON||row.k!=='scout_tool_v1'||row.wid&&row.wid!==context().wid||!value||value.metadata.id!==r.id||value.metadata.reason!==REASON||value.metadata.k!==row.k||value.localRaw!==r.localRaw||value.remoteRaw!==r.remoteRaw)throw issue('items_stale_changed');return r;
    }
    async function prepare(row,value,currentSelection){
      selection(currentSelection);var c=context(),permission=d.permission();if(!c||permission==null)throw issue('items_stale_owner');
      await load();guard(c);selection(currentSelection);if(d.permission()!==permission)throw issue('items_stale_owner');
      var r=chosen(row,value);if(resolved.has(r.id))return {resolved:true};
      function current(){guard(c);selection(currentSelection);if(d.permission()!==permission)throw issue('items_stale_owner');}
      var values=await readRows(r.payload.ids,c,current),J=d.createJournal||root&&root.PSAutoSaveJournal&&root.PSAutoSaveJournal.create;
      var prefix=d.journalPrefix||root&&root.PSAutoSaveJournal&&root.PSAutoSaveJournal.PREFIX;
      if(typeof J!=='function'||!text(prefix))throw issue('items_stale_module');
      var sourceKey=prefix+encodeURIComponent(c.uid)+':'+encodeURIComponent(c.wid)+':archive:'+r.id;
      var source=await d.storage.get(sourceKey);current();if(!source||typeof source.value!=='string')throw issue('items_stale_archive');
      var parsed;try{parsed=JSON.parse(source.value);}catch(_){throw issue('items_stale_archive');}
      if(parsed.localRaw!==r.localRaw||parsed.remoteRaw!==r.remoteRaw||parsed.id!==r.id)throw issue('items_stale_archive');
      var currentRaw=JSON.stringify({provenance:'device-idb',values:values}),view={token:r.id,currentRaw:currentRaw};
      prepared.set(view,{ctx:c,permission:permission,id:r.id,localRaw:r.localRaw,remoteRaw:r.remoteRaw,currentRaw:currentRaw,values:values,sourceKey:sourceKey,sourceRaw:source.value,createJournal:J,used:false});return view;
    }
    async function resolve(row,value,view,currentSelection){
      var p=prepared.get(view);if(!p||p.used)throw issue('items_stale_changed');p.used=true;
      function current(){guard(p.ctx);selection(currentSelection);if(d.permission()!==p.permission||view.currentRaw!==p.currentRaw)throw issue('items_stale_changed');}
      current();await load();current();var r=chosen(row,value);
      if(r.id!==p.id||r.localRaw!==p.localRaw||r.remoteRaw!==p.remoteRaw||resolved.has(p.id))throw issue('items_stale_changed');
      if(JSON.stringify(await readRows(r.payload.ids,p.ctx,current))!==JSON.stringify(p.values))throw issue('items_stale_changed');
      if(typeof d.storage.setIfValues!=='function')throw issue('items_stale_module');
      var checks=Object.create(null);r.payload.ids.forEach(function(k){checks['sq:'+k]=p.values[k];});checks[p.sourceKey]=p.sourceRaw;
      var settlement=null,outbox=null;
      if(r.payload.intent){
        outbox=outboxFor();
        if(!outbox||!outbox.settle||!outbox.settled)throw issue('items_stale_module');
        settlement=outbox.settle(r.payload.intent,current);
        if(outbox.settled(settlement,current)!==true)throw issue('items_stale_changed');
      }
      var adapter={get:function(k){return d.storage.get(k);},keys:function(k){return d.storage.keys(k);},set:function(k,raw,journalCurrent){
        return d.storage.setIfValues(k,null,raw,checks,function(){current();journalCurrent();if(settlement&&outbox.settled(settlement,current)!==true)throw issue('items_stale_changed');return true;});
      }};
      var journal=p.createJournal({storage:adapter,context:context,hash:d.hash});
      var localRaw=JSON.stringify({v:1,kind:'items-stale-resolution',choice:'keep-current-device',uid:p.ctx.uid,wid:p.ctx.wid,archiveId:p.id,originalLocalRaw:p.localRaw,originalRemoteRaw:p.remoteRaw,currentRaw:p.currentRaw,settlement:settlement});
      var receipt=await journal.archive(p.ctx,'scout_tool_v1',localRaw,p.currentRaw,0,'items-stale-resolved');
      var verified=await journal.read(p.ctx,receipt.id);current();
      if(!verified||verified.localRaw!==localRaw||verified.remoteRaw!==p.currentRaw)throw issue('items_stale_archive');
      await load();current();if(!resolved.has(p.id))throw issue('items_stale_archive');
      return {resolved:true};
    }
    return {load:load,capture:capture,background:background,foreground:foreground,before:before,skip:skip,retired:retired,count:count,fenced:fenced,hold:hold,keys:keys,state:state,prepare:prepare,resolve:resolve};
  }
  return {create:create,REASON:REASON,CARRIERS:CARRIERS,watchProjection:watchProjection};
});
