/* Reconcile the running document, active worker and published release. Never
   reload here: the shell owns the exact local-save/workspace barrier. */
(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSUpdateClient=api.create(root);root.addEventListener('load',function(){root.PSUpdateClient.start();});}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function version(s){var m=/^(?:process-)?(\d+\.\d+(?:\.\d+)?)$/.exec(String(s||''));return m?m[1]:'';}
  function newer(a,b){a=version(a);b=version(b);if(!a||!b)return false;var x=a.split('.'),y=b.split('.');for(var i=0;i<Math.max(x.length,y.length);i++){var d=(+x[i]||0)-(+y[i]||0);if(d)return d>0;}return false;}
  var frames={fBoard:'작전판',fProc:'일정',fScout:'팀 운영·경기',fNote:'노트',fIdp:'선수 성장 기록',support:'오류 제보',shell:'앱'};
  function reason(code){
    code=String(code||'');var part=code.split(':'),label=frames[part[1]]||'열린 화면';
    if(/^(ws_busy|tx_busy)/.test(code))return '팀·계정 전환을 마친 뒤 자동으로 다시 확인해요.';
    if(/^unsafe:/.test(code))return '입력이나 편집창을 마치면 저장을 확인한 뒤 바꿔요.';
    if(/^flush_timeout:/.test(code))return label+'의 저장 확인이 지연되고 있어요. 해당 화면의 저장 상태를 확인해 주세요.';
    if(/^flush_fail:/.test(code))return label+'의 기기 저장을 확인하지 못해 업데이트를 보류했어요. 해당 화면에서 저장을 확인한 뒤 다시 시도해 주세요.';
    return '연결을 확인한 뒤 자동으로 다시 시도해요. 작성 중인 내용은 유지해요.';
  }
  function create(w){
    var sw=w.navigator&&w.navigator.serviceWorker,reg=null,flight=null,last=0,started=false,seenWorkers=new WeakSet(),logs={},pending=[],target='',activeTarget='',seenAt={};
    var id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),owner=null;
    function current(){return version(w.PS_BUILD);}
    function session(){try{var s=w.PSSync&&w.PSSync.session&&w.PSSync.session();return s&&s.uid?String(s.uid):'';}catch(_){return '';}}
    function drain(){
      var uid=session();if(!uid||!w.PSSync||!w.PSSync.event)return;
      if(owner&&owner!==uid){pending=[];id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);logs={};}owner=uid;
      pending.splice(0).forEach(function(x){w.PSSync.event(x.name,x.opts);});
    }
    function record(stage,code,extra){
      if(!/^(available|downloaded|saving|deferred|check_failed|install_failed|applied)$/.test(stage))return;
      var uid=session();if(!uid)return; // Do not attribute guest observations to a later login.
      drain();code=String(code||stage).replace(/[^a-zA-Z0-9_.:+-]/g,'').slice(0,80);
      var to=extra&&version(extra.to)||(/^(saving|deferred|downloaded)$/.test(stage)?activeTarget||target:target);
      var key=stage+':'+to+':'+code,t=Date.now();if(logs[key]&&t-logs[key]<300000)return;logs[key]=t;
      var meta={stage:stage,reason:code,from:current(),to:to,update_id:id,mins:seenAt[to]?Math.floor((t-seenAt[to])/60000):0,hidden:!!w.document.hidden};
      if(extra){if(version(extra.from))meta.from=version(extra.from);if(version(extra.to))meta.to=version(extra.to);if(/^[a-z0-9-]{1,60}$/.test(extra.update_id||''))meta.update_id=extra.update_id;}
      pending.push({name:'update_'+stage,opts:{status:/failed|deferred/.test(stage)?'error':'ok',feature:'app',error_code:code,meta:meta}});pending=pending.slice(-16);drain();
    }
    function targetVersion(v){target=v;if(!seenAt[v])seenAt[v]=Date.now();}
    function ready(release){
      var v=version(release);if(!newer(v,current()))return false;
      activeTarget=v;if(!seenAt[v])seenAt[v]=Date.now();if(!target||newer(v,target))targetVersion(v);
      record('downloaded');
      if(w.PSUpdProg)w.PSUpdProg.ready(v);
      if(typeof w.psAutoReloadWhenSafe==='function')w.psAutoReloadWhenSafe();
      return true;
    }
    function activeVersion(){
      var worker=sw&&sw.controller;if(!worker||!w.MessageChannel)return Promise.resolve('');
      return new Promise(function(resolve){
        var c=new w.MessageChannel(),done=false,t=w.setTimeout(function(){finish('');},2500);
        function finish(v){if(done)return;done=true;w.clearTimeout(t);c.port1.close();c.port2.close();resolve(v);}
        c.port1.onmessage=function(e){finish(e.data&&version(e.data.release));};
        try{worker.postMessage({type:'ps-release-query'},[c.port2]);}catch(_){finish('');}
      });
    }
    function watch(worker){
      if(!worker||seenWorkers.has(worker))return;seenWorkers.add(worker);
      function state(){if(worker.state==='redundant')record('install_failed','sw_redundant');if(worker.state==='activated')reconcile();}
      worker.addEventListener('statechange',state);state();
    }
    function reconcile(){return activeVersion().then(ready);}
    function registration(){
      if(reg)return Promise.resolve(reg);
      return sw.register('/sw.js',{updateViaCache:'none'}).then(function(r){
        reg=r;r.addEventListener('updatefound',function(){watch(r.installing);});watch(r.installing);watch(r.waiting);return r;
      }).catch(function(){record('check_failed','worker_registration');return null;});
    }
    function check(force){
      if(flight)return flight;
      var t=Date.now();if(!force&&t-last<60000)return Promise.resolve(false);last=t;
      if(w.navigator.onLine===false)return Promise.resolve(false);
      flight=Promise.resolve().then(registration).then(function(r){return r?r.update():null;}).catch(function(){record('check_failed','worker_check');}).then(reconcile).then(function(){
        var abort=new w.AbortController(),timer=w.setTimeout(function(){abort.abort();},8000);
        return w.fetch('/sw-manifest.json',{cache:'no-store',signal:abort.signal}).then(function(r){if(!r.ok)throw Error('manifest');return r.json();}).then(function(m){
          var v=version(m&&m.release);if(!v)throw Error('manifest');
          if(newer(v,current())){if(!target||newer(v,target))targetVersion(v);record('available');}
        }).catch(function(){record('check_failed','manifest_check');}).finally(function(){w.clearTimeout(timer);});
      }).finally(function(){flight=null;});return flight;
    }
    function start(){
      if(started||!sw)return;started=true;
      // Listen before registering/checking; a fast install can otherwise be missed.
      sw.addEventListener('controllerchange',function(){reconcile();});
      sw.addEventListener('message',function(e){
        if(e.source!==sw.controller||!e.data||e.data.type!=='ps-update-available')return;
        reconcile();
      });
      function resume(){if(!w.document.hidden){reconcile();check();}}
      w.document.addEventListener('visibilitychange',resume);w.addEventListener('focus',resume);w.addEventListener('pageshow',resume);
      w.addEventListener('online',function(){check(true);});w.setInterval(function(){check();},1800000);
      return check(true);
    }
    return {start:start,check:check,record:record,reason:reason,ready:ready,reconcile:reconcile,context:function(){return {to:activeTarget||target,update_id:id};}};
  }
  return {create:create,newer:newer,version:version,reason:reason};
});
