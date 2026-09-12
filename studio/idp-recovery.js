/* Device-only IDP editing recovery. These keys are outside sync.js KEYS,
   cs_idp_v1_ / cs_idp_pub_v1_ and sq: discovery. No network or shared mirror. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSIDPRecovery=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var PREFIX='ps_idp_edit_recovery_v1:',MAX=3000000;
  var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
  function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function copy(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function validDoc(d){return object(d)&&d.v===1;}
  function bad(k){return k==='__proto__'||k==='prototype'||k==='constructor';}
  function validPath(p){return Array.isArray(p)&&p.length>0&&p.length<16&&p.every(function(k){return typeof k==='string'&&k.length<180&&!bad(k);})&&p[0]!=='v';}
  function at(d,p){var v=d;for(var i=0;i<p.length;i++){if(!object(v)||!own(v,p[i]))return {has:false};v=v[p[i]];}return {has:true,value:copy(v)};}
  function put(d,p,v){var o=d;for(var i=0;i<p.length-1;i++){if(!object(o[p[i]]))o[p[i]]={};o=o[p[i]];}if(v.has)o[p[p.length-1]]=copy(v.value);else delete o[p[p.length-1]];}
  function diff(base,draft){
    if(!validDoc(base)||!validDoc(draft))throw new Error('invalid-document');var out=[];
    function walk(a,b,p){
      if(equal(a,b))return;
      if(p.length&&p[0]!=='vision'&&a.has&&b.has&&object(a.value)&&object(b.value)){
        Array.from(new Set(Object.keys(a.value).concat(Object.keys(b.value)))).sort().forEach(function(k){if(bad(k))throw new Error('invalid-path');walk(own(a.value,k)?{has:true,value:a.value[k]}:{has:false},own(b.value,k)?{has:true,value:b.value[k]}:{has:false},p.concat(k));});return;
      }
      if(!validPath(p))throw new Error('invalid-path');out.push({path:p,before:copy(a),after:copy(b)});
    }
    Array.from(new Set(Object.keys(base).concat(Object.keys(draft)))).sort().forEach(function(k){if(k==='v')return;walk(at(base,[k]),at(draft,[k]),[k]);});
    if(out.length>300)throw new Error('too-many-changes');return out;
  }
  function validOps(ops){return Array.isArray(ops)&&ops.length<=300&&ops.every(function(o){return object(o)&&validPath(o.path)&&object(o.before)&&typeof o.before.has==='boolean'&&object(o.after)&&typeof o.after.has==='boolean';});}
  function plan(ops,latest){
    if(!validOps(ops)||!validDoc(latest))throw new Error('invalid-document');
    return ops.map(function(o){var current=at(latest,o.path),structural=null;for(var i=1;i<o.path.length;i++){var p=o.path.slice(0,i),s=at(latest,p);if(!s.has||!object(s.value)){structural={path:p,value:s};break;}}return {path:copy(o.path),before:copy(o.before),after:copy(o.after),current:current,structural:structural,status:structural?'conflict':equal(current,o.after)?'applied':equal(current,o.before)?'safe':'conflict'};});
  }
  function resolve(ops,latest,choices,transform){
    var rows=plan(ops,latest),result=copy(latest);
    rows.forEach(function(r,i){var choice=choices[i];if(r.status==='applied')return;if(choice!=='mine'&&choice!=='latest')throw new Error('choose-conflicts');if(choice==='mine'){if(r.structural)throw new Error('structural-change');var next=copy(r.after);if(transform)next=transform(r.path,next,at(latest,r.path));put(result,r.path,next);}});
    return result;
  }
  var names={profile:'프로필',name:'이름',selfEval:'셀프 평가',levels:'평가 점수',strengths:'강점',improve:'개선할 점',seasonGoal:'시즌 목표',log:'일지',memo:'한 줄 기록',t:'참여 유형',rpe:'자기보고 강도',body:'몸 상태',sleepq:'수면 상태',mood:'기분',pain:'통증',try:'행동 시도',vision:'내 방향',statement:'되고 싶은 선수',visionEvidence:'그날의 행동 근거',weekly:'주간 회고',good:'잘된 점',better:'다음에 바꿀 점',next:'다음 행동',focus:'주간 초점',focusByWk:'주간 초점',text:'내용',qgoal:'12주 목표',goals:'목표',trainings:'개인 훈련',done:'완료 기록',imgNotes:'이미지 노트',learning:'학습 기록',feedbackReply:'코치에게 남긴 답',rvReplies:'리뷰 답글',reason:'이유',behaviors:'행동',hours:'운동 시간',plan:'계획',solo:'개인 운동',planNote:'계획 메모',role:'팀에서 내 역할'};
  function label(path){return path.map(function(k,i){if(/^\d{4}-\d{2}-\d{2}$/.test(k))return k.replace(/-/g,'.');return names[k]||(i===0?'성장 기록':'세부 항목');}).filter(function(x,i,a){return i===0||x!==a[i-1];}).join(' · ');}
  function display(state){
    if(!state||!state.has)return '내용 없음';var v=state.value;if(v===null||v==='')return '비어 있음';
    if(typeof v==='string')return /^data:|^psimg:/.test(v)?'사진·이미지 자료':v;
    if(typeof v==='number'||typeof v==='boolean')return String(v);
    if(Array.isArray(v))return v.length?v.map(function(x,i){return (i+1)+'. '+display({has:true,value:x});}).join('\n'):'항목 없음';
    if(object(v))return Object.keys(v).filter(function(k){return !/^(id|revision|updatedAt|at|history|focusId|setId|setSnapshot|stdMigrated)$/.test(k);}).map(function(k){return (names[k]||(/^\d{4}-/.test(k)?k:'기록'))+': '+display({has:true,value:v[k]});}).join('\n')||'저장된 항목';return '내용 확인 필요';
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function create(options){
    var win=options.window,ls=win.localStorage,token='',durableTab=true;
    try{token=win.sessionStorage.getItem('ps_idp_recovery_tab_v1')||'';if(!/^[a-z0-9_-]{8,80}$/i.test(token)){token='tab'+Date.now().toString(36)+Math.random().toString(36).slice(2);win.sessionStorage.setItem('ps_idp_recovery_tab_v1',token);if(win.sessionStorage.getItem('ps_idp_recovery_tab_v1')!==token)throw new Error('verify');}}catch(_){durableTab=false;token='tab'+Date.now().toString(36)+Math.random().toString(36).slice(2);}
    var record=null,key='',owner=null,error='',invalidStored=false,open=false,attention=false,resuming=false,reviewRaw=null,choices={},busy=false,host=null,revision='',memory=Object.create(null);
    function context(){var o=options.owner();return o&&typeof o.uid==='string'&&typeof o.wid==='string'&&o.key==='cs_idp_v1_'+(o.uid||'local')?{uid:o.uid,wid:o.wid,key:o.key}:null;}
    function same(a,b){return !!(a&&b&&a.uid===b.uid&&a.wid===b.wid&&a.key===b.key);}
    function storageKey(o){return PREFIX+encodeURIComponent(o.uid||'local')+':'+encodeURIComponent(o.wid||'local')+':'+token;}
    function validRecord(r,o){return object(r)&&r.v===1&&r.uid===o.uid&&r.wid===o.wid&&r.key===o.key&&(!r.pending||(object(r.pending)&&validOps(r.pending.ops)&&/^(normal|vision)$/.test(r.pending.mode)));}
    function write(next){
      if(!same(owner,context())||invalidStored)return false;
      try{var raw=JSON.stringify(next);if(raw.length>MAX)throw new Error('large');if(ls.getItem(key)!==revision)throw new Error('changed');ls.setItem(key,raw);if(!same(owner,context())||ls.getItem(key)!==raw)throw new Error('verify');revision=raw;record=next;delete memory[key];error='';return true;}
      catch(e){error=e.message==='changed'?'다른 탭의 복구 기록이 바뀌어 덮어쓰지 않았어요. 이 화면의 입력을 유지한 채 다시 확인해 주세요.':'복구용 초안을 이 기기에 저장하지 못했어요. 이 화면을 닫기 전에 다시 시도해 주세요.';return false;}
    }
    function refresh(){
      var current=context();if(!current){owner=null;record=null;key='';open=false;error='';paint();return;}
      if(same(owner,current))return;
      if(!same(owner,current)){owner=current;key=storageKey(owner);record=null;open=false;attention=false;resuming=false;error='';invalidStored=false;choices={};try{revision=ls.getItem(key);if(revision){var parsed=JSON.parse(revision);if(!validRecord(parsed,owner))throw new Error('invalid');record=parsed;attention=!!record.pending;}}catch(_){invalidStored=true;error='복구 기록의 형식을 확인하지 못했어요. 원본 IDP는 바꾸지 않았습니다.';}}
      if(memory[key]){record=copy(memory[key]);attention=!!record.pending;error='초안이 아직 이 화면에만 남아 있어요. 저장을 다시 확인하기 전에는 화면을 닫지 마세요.';}
      paint();
    }
    function latest(){var raw=ls.getItem(owner.key),doc=raw===null?options.blank():JSON.parse(raw);if(!validDoc(doc))throw new Error('invalid-document');return {raw:raw,doc:doc};}
    function capture(base,draft,mode){
      refresh();if(!owner)return false;var ops;try{ops=diff(base,draft);}catch(_){error='변경 내용을 복구용으로 보관하지 못했어요. 이 화면을 닫기 전에 다시 확인해 주세요.';paint();return false;}
      if(!ops.length){if(record&&record.pending){var cleared=copy(record);delete cleared.pending;var clearedOk=write(cleared);if(clearedOk){open=false;attention=false;}paint();return clearedOk;}return true;}
      var next=record?copy(record):{v:1,uid:owner.uid,wid:owner.wid,key:owner.key};
      next.pending={mode:mode||'normal',ops:ops,at:Date.now()};
      var ok=write(next);if(!ok){record=next;memory[key]=copy(next);}if(!durableTab){error='이 브라우저에서는 새로고침 뒤 초안을 다시 찾을 수 없어요. 화면을 닫기 전에 IDP 저장을 마쳐 주세요.';ok=false;}paint();return ok;
    }
    function saved(){
      if(!same(owner,context())||!record||!record.pending)return;
      try{var l=latest();if(!plan(record.pending.ops,l.doc).every(function(r){return r.status==='applied';}))return;
        var next=copy(record);delete next.pending;if(next.resolved)write(next);else{if(ls.getItem(key)!==revision)return;ls.removeItem(key);if(ls.getItem(key)!==null)throw new Error('remove');revision=null;record=null;error='';}open=false;
      }catch(_){error='저장은 완료됐지만 복구 안내를 정리하지 못했어요.';}paint();
    }
    function confirmed(raw){
      if(!same(owner,context())||!record||!record.pending||ls.getItem(owner.key)!==raw)return false;
      var next=copy(record);delete next.pending;var ok=write(next);if(ok){open=false;attention=false;resuming=false;}paint();return ok;
    }
    function discard(){
      if(!same(owner,context())||!record||!record.pending)return false;
      var next=copy(record);next.resolved={at:Date.now(),ops:copy(next.pending.ops),cancelled:true};delete next.pending;
      var ok=write(next);if(ok){open=false;attention=false;resuming=false;}paint();return ok;
    }
    function show(){refresh();if(!record||!record.pending)return false;attention=true;open=true;choices={};reviewRaw=null;paint();return true;}
    function apply(){
      if(busy||!same(owner,context())||!record||!record.pending)return false;busy=true;
      try{
        var l=latest();if(l.raw!==reviewRaw){error='그 사이 최신 내용이 다시 바뀌었어요. 새 내용을 비교하고 선택해 주세요.';choices={};reviewRaw=null;paint();return false;}
        var result=resolve(record.pending.ops,l.doc,choices,options.transform),raw=JSON.stringify(result);if(raw.length>1500000)throw new Error('large');
        var next=copy(record);next.resolved={at:Date.now(),ops:copy(record.pending.ops),previous:plan(record.pending.ops,l.doc).map(function(r){return r.structural||{path:r.path,value:r.current};}),choices:copy(choices)};
        if(!write(next)){paint();return false;}
        if(!same(owner,context())||ls.getItem(owner.key)!==l.raw){error='최신 내용이 바뀌어 적용하지 않았어요. 다시 비교해 주세요.';choices={};reviewRaw=null;paint();return false;}
        ls.setItem(owner.key,raw);
        if(!same(owner,context())||ls.getItem(owner.key)!==raw)throw new Error('verify');
        delete next.pending;write(next);open=false;attention=false;resuming=false;error='';options.applied(result,raw);paint();return true;
      }catch(e){error=e.message==='choose-conflicts'?'겹친 항목마다 사용할 내용을 골라 주세요.':e.message==='vision-incomplete'?'내 방향의 문장과 행동을 마저 작성한 뒤 적용해 주세요.':e.message==='structural-change'?'항목 구성이 바뀌어 내 입력을 자동으로 넣을 수 없어요. 최신 내용을 유지한 뒤 해당 화면에서 다시 작성해 주세요.':'저장 완료를 확인하지 못했어요. 비교 중인 두 내용은 복구 기록에 남아 있습니다.';paint();return false;}
      finally{busy=false;}
    }
    function paint(){
      if(!win.document)return;if(!host){host=win.document.getElementById('idpRecovery');if(!host)return;}
      if(options.lock)options.lock(!!(owner&&same(owner,context())&&attention&&record&&record.pending&&!resuming));
      if(!owner||!same(owner,context())){host.innerHTML='';host.hidden=true;return;}
      if(!error&&(!attention||!(record&&record.pending))){
        if(record&&record.resolved&&validOps(record.resolved.ops)){
          var resolved=record.resolved,history='<details class="idr-history"><summary>이 기기의 마지막 복구 기록</summary><p>복구 당시 두 내용을 보관한 기록입니다. 현재 IDP를 바꾸지 않습니다.</p>';
          resolved.ops.forEach(function(op){var previous=(resolved.previous||[]).filter(function(p){return Array.isArray(p.path)&&p.path.length<=op.path.length&&p.path.every(function(k,i){return k===op.path[i];});}).sort(function(a,b){return b.path.length-a.path.length;})[0];history+='<article class="idr-row"><h3>'+esc(label(op.path))+'</h3><div class="idr-values"><div><b>복구 전 최신 내용</b><pre>'+esc(display(previous?previous.value:op.before))+'</pre></div><div><b>내 입력</b><pre>'+esc(display(op.after))+'</pre></div></div></article>';});host.innerHTML=history+'</details>';host.hidden=false;
        }else{host.innerHTML='';host.hidden=true;}return;
      }
      host.hidden=false;var pending=record&&record.pending;
      var h='<div class="idr-notice" role="status"><div><b>아직 저장하지 못한 입력이 있어요</b><p>'+esc(error||'초안을 이 기기에 보관했어요. 최신 내용과 비교해서 이어갈 수 있습니다.')+'</p></div>'+(pending?'<button type="button" data-idr-open>비교하고 복구</button>':'')+'</div>';
      if(open&&pending){
        h+='<section class="idr-panel" aria-label="IDP 입력 복구"><div class="idr-head"><h2>최신 내용과 내 입력 비교</h2><button type="button" data-idr-close aria-label="비교 닫기">×</button></div><p>선택한 항목만 최신 IDP에 적용합니다. 두 내용은 이 기기의 마지막 복구 기록에 남습니다.</p>';
        var rows=null;try{var l=latest();rows=plan(pending.ops,l.doc);if(reviewRaw!==l.raw){reviewRaw=l.raw;choices={};rows.forEach(function(r,i){if(r.status!=='conflict')choices[i]='mine';});}}catch(_){h+='<p class="idr-error">최신 IDP의 형식을 확인하지 못해 적용할 수 없어요. 아래 내 입력은 보관되어 있습니다.</p>';}
        (rows||pending.ops).forEach(function(r,i){var current=rows?(r.structural?r.structural.value:r.current):null;
          h+='<article class="idr-row"><h3>'+esc(label(r.path))+'</h3><div class="idr-values"><div><b>최신 내용</b><pre>'+esc(rows?display(current):'확인할 수 없음')+'</pre></div><div><b>내 입력</b><pre>'+esc(display(r.after))+'</pre></div></div>';
          if(rows&&r.status!=='applied')h+='<fieldset><legend>'+(r.structural?'항목 구성이 바뀌어 최신 내용만 유지할 수 있어요. 내 입력은 복구 기록에 남습니다.':r.status==='conflict'?'같은 항목이 바뀌었어요. 사용할 내용을 골라 주세요.':'이 항목의 최신 내용은 편집 전과 같아요.')+'</legend><label><input type="radio" name="idr-'+i+'" data-idr-choice="'+i+'" value="latest"'+(choices[i]==='latest'?' checked':'')+'> 최신 내용 유지</label>'+(!r.structural?'<label><input type="radio" name="idr-'+i+'" data-idr-choice="'+i+'" value="mine"'+(choices[i]==='mine'?' checked':'')+'> 내 입력 적용</label>':'')+'</fieldset>';
          else if(rows)h+='<p>이미 같은 내용이 저장되어 있어요.</p>';h+='</article>';
        });
        h+='<div class="idr-actions">'+(pending.mode==='vision'?'<button type="button" data-idr-resume>내 방향 이어서 작성</button>':'')+'<button type="button" data-idr-apply'+(!rows?' disabled':'')+'>선택한 내용 적용</button></div></section>';
      }
      host.innerHTML=h;
      var b=host.querySelector('[data-idr-open]');if(b)b.onclick=show;
      b=host.querySelector('[data-idr-close]');if(b)b.onclick=function(){open=false;paint();};
      b=host.querySelector('[data-idr-apply]');if(b)b.onclick=apply;
      b=host.querySelector('[data-idr-resume]');if(b)b.onclick=function(){if(!same(owner,context()))return;resuming=true;options.resume(copy(record.pending));open=false;paint();};
      Array.prototype.forEach.call(host.querySelectorAll('[data-idr-choice]'),function(input){input.onchange=function(){choices[input.dataset.idrChoice]=input.value;};});
    }
    return {capture:capture,saved:saved,confirmed:confirmed,discard:discard,show:show,refresh:refresh,apply:apply,blocked:function(){return !!(same(owner,context())&&record&&record.pending&&attention&&!resuming);},record:function(){return same(owner,context())?copy(record):null;},key:function(){return key;},hide:function(){owner=null;record=null;open=false;paint();}};
  }
  return {prefix:PREFIX,validDoc:validDoc,diff:diff,plan:plan,resolve:resolve,label:label,display:display,create:create};
});
