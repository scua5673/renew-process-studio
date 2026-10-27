/* Read-only diagnosis. Capabilities supplied by sync.js never include a writer. */
(function(root,factory){
  'use strict';var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSSyncDiagnosis=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var KEY='scout_tool_v1',COPY_STAGES=['roster_copies_differ','schedule_copies_differ'];
  function changed(){return new Error('계정·팀 또는 자료가 바뀌었습니다. 창을 닫고 다시 확인해 주세요.');}
  function guard(d,ctx){if(!ctx||!d.current(ctx))throw changed();}
  function row(it,held,label,text){
    var push=it.lastError?{code:it.lastError,stage:it.lastStage||'',count:+it.attempts||0}:null;
    var round=it.roundError?{code:it.roundError,stage:it.roundStage||'',count:+it.roundFails||0}:null;
    return {key:it.key,label:label(it.key),review:!!held,push:push,round:round,
      kind:held?'review':push?'send':'waiting',
      text:held?'기기와 팀 자료의 내용 확인이 필요해요':push?'이전 전송에서 오류가 기록됐어요':round?'동기화가 중단되어 전송을 기다리고 있어요':'아직 전송을 기다리고 있어요',
      detail:push?text(push.code):'',at:+it.updatedAt||+it.at||0};
  }
  function collect(d){
    var ctx=d.context();
    return Promise.resolve().then(function(){guard(d,ctx);return d.outbox();}).then(function(q){
      guard(d,ctx);var held=Object.create(null);
      d.held().forEach(function(x){if(x&&x.kind==='conflict'&&!x.choice&&x.uid===ctx.uid&&x.wid===ctx.wid)held[x.k]=true;});
      var rows=(q||[]).filter(function(x){return x&&String(x.uid)===ctx.uid&&String(x.wid)===ctx.wid;}).map(function(x){return row(x,held[x.key],d.label,d.text);});
      var blockers=[],seen=Object.create(null);
      rows.forEach(function(r){var e=r.round;if(!e)return;var id=e.code+'|'+e.stage;if(seen[id])return;seen[id]=true;blockers.push({code:e.code,stage:e.stage,text:d.text(e.code),copy:COPY_STAGES.indexOf(e.stage)>=0});});
      var info=d.info();guard(d,ctx);
      info.pending=rows;info.blockers=blockers;info.reviewCount=rows.filter(function(r){return r.review;}).length;
      info.current=function(){return d.current(ctx);};return info;
    });
  }
  function canonical(v){
    if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
    if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';
    return JSON.stringify(v);
  }
  function object(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
  function parse(source){
    if(source.status!=='read')return {status:source.status};
    if(source.raw===null)return {status:'absent'};
    try{
      var doc=JSON.parse(source.raw),ids=new Set();
      if(!object(doc)||!Array.isArray(doc.players)||!Array.isArray(doc.attrs)||!Array.isArray(doc.positions))throw Error();
      doc.players.forEach(function(p){if(!object(p)||typeof p.id!=='string'||!p.id.trim()||p.id!==p.id.trim()||ids.has(p.id))throw Error();ids.add(p.id);});
      return {status:'valid',doc:doc,players:doc.players.length,roster:doc.players.filter(function(p){return p.type!=='target'&&!p._del;}).length};
    }catch(_){return {status:'invalid'};}
  }
  function fields(values){
    var keys=new Set();values.forEach(function(v){Object.keys(v||{}).forEach(function(k){keys.add(k);});});
    return Array.from(keys).sort().filter(function(k){return !values.every(function(v){return canonical(v&&v[k])===canonical(values[0]&&values[0][k]);});}).map(function(k){return {key:k,values:values.map(function(v){return v&&Object.prototype.hasOwnProperty.call(v,k)?{present:true,value:v[k]}:{present:false};})};});
  }
  function compare(sources){
    var parsed=sources.map(parse),valid=parsed.every(function(p){return p.status==='valid';});
    var result={sources:parsed.map(function(p){return {status:p.status,players:p.players,roster:p.roster};}),complete:valid,players:[],document:[]};
    if(!valid)return result; // Unknown, absent, or malformed never means an empty roster.
    var docs=parsed.map(function(p){return p.doc;}),maps=docs.map(function(d){return new Map(d.players.map(function(p){return [p.id,p];}));}),ids=new Set();
    maps.forEach(function(m){m.forEach(function(_,id){ids.add(id);});});
    ids.forEach(function(id){var values=maps.map(function(m){return m.get(id);}),diff=fields(values);if(!diff.length)return;
      result.players.push({id:id,name:String((values.find(function(v){return v&&v.name;})||{}).name||id),presence:values.map(Boolean),fields:diff});});
    result.document=fields(docs.map(function(d){var v=Object.create(null);Object.keys(d).forEach(function(k){if(k!=='players')v[k]=d[k];});v['players (순서)']=d.players.map(function(p){return p.id;});return v;}));
    result.rawEqual=sources.every(function(s){return s.raw===sources[0].raw;});
    result.contentEqual=result.players.length===0&&result.document.length===0;
    return result;
  }
  function stored(r){if(r==null)return null;if(typeof r.value!=='string')throw new Error('기기 보관본을 읽지 못했습니다. 원본은 그대로 보존됩니다.');return r.value;}
  function inspect(d){
    var ctx=d.context(),mirror,idb,server,at;
    function current(){return !!ctx&&d.current(ctx)&&d.mirror()===mirror;}
    function requireCurrent(){if(!current())throw changed();}
    function check(){return Promise.resolve().then(function(){requireCurrent();return d.stored();}).then(function(r){requireCurrent();if(stored(r)!==idb)throw changed();return true;});}
    return Promise.resolve().then(function(){guard(d,ctx);mirror=d.mirror();if(mirror!==null&&typeof mirror!=='string')throw changed();return d.stored();})
      .then(function(r){requireCurrent();idb=stored(r);return d.server(ctx);})
      .then(function(rows){requireCurrent();if(!Array.isArray(rows)||rows.length>1||(rows.length===1&&(!rows[0]||rows[0].k!==KEY||typeof rows[0].v!=='string'||rows[0].cupd==null)))throw new Error('서버 응답을 확인하지 못했습니다.');
        server={status:'read',raw:rows.length?rows[0].v:null,version:rows.length?rows[0].cupd:null};at=Date.now();return check();})
      .then(function(){var sources=[{id:'screen',label:'화면용 기기 사본',status:'read',raw:mirror},{id:'device',label:'기기 보관본',status:'read',raw:idb},{id:'server',label:'팀 서버본',status:'read',raw:server.raw,version:server.version}];
        return {current:current,check:check,snapshot:{type:'process-studio-roster-copies',schema:1,workspaceId:ctx.wid,capturedAt:at,key:KEY,sources:sources,comparison:compare(sources)}};});
  }
  return {collect:collect,row:row,compare:compare,inspect:inspect};
});
