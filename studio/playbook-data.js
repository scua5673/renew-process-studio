/* Team criteria edits keep the existing document shape, IDs and unknown fields. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSPlaybookData=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var detailKeys=['why','how','trig','trigger','cue','when','detail','note'];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function text(p){return typeof p==='string'?p:((p&&(p.t||p.text||p.title))||'');}
  function detailKey(p){return detailKeys.find(function(k){return p&&typeof p==='object'&&String(p[k]||'').trim();})||'detail';}
  function detail(p){return p&&typeof p==='object'?String(p[detailKey(p)]||''):'';}
  function conflict(){throw new Error('다른 곳에서 내용이 바뀌었습니다. 닫고 최신 내용을 확인한 뒤 다시 수정해 주세요.');}
  function same(a,b){if(JSON.stringify(a)!==JSON.stringify(b))conflict();}
  function phase(doc,id){for(var m of doc.moments||[])for(var p of m.phases||[])if(p.id===id)return {m:m,p:p};throw new Error('국면을 찾을 수 없습니다. 최신 내용을 확인해 주세요.');}
  function required(s){s=String(s||'').trim();if(!s)throw new Error('이름이나 내용을 입력해 주세요.');return s;}
  function move(list,item,dir){var i=list.indexOf(item),j=i+dir;if(j>=0&&j<list.length){list.splice(i,1);list.splice(j,0,item);}}
  function apply(source,op){
    if(source!==null&&(!source||!Array.isArray(source.moments)))throw new Error('게임모델 형식을 확인할 수 없어 저장하지 않았습니다.');
    var doc=clone(source||{identity:'',open:{},moments:[]}),hit,m,p;
    if(op.type==='identity'){same(doc.identity||'',op.before);doc.identity=String(op.value||'').trim();return doc;}
    if(op.type==='moment.add'){
      if(doc.moments.some(function(x){return x.key===op.id;}))conflict();
      doc.moments.push({key:required(op.id),name:required(op.name),cat:op.cat||'ao',tag:'',phases:[]});return doc;
    }
    if(op.type.indexOf('moment.')===0||op.type==='phase.add'){
      m=doc.moments.find(function(x){return x.key===op.moment;});if(!m)conflict();
      if(op.type==='moment.rename'){same(m.name,op.before);m.name=required(op.name);}
      if(op.type==='moment.move')move(doc.moments,m,op.dir);
      if(op.type==='phase.add'){
        if(doc.moments.some(function(x){return (x.phases||[]).some(function(y){return y.id===op.id;});}))conflict();
        m.phases=m.phases||[];m.phases.push({id:required(op.id),name:required(op.name),principles:[],snap:null});
      }
      return doc;
    }
    hit=phase(doc,op.phase);p=hit.p;
    if(op.type==='phase.rename'){same(p.name,op.before);p.name=required(op.name);}
    else if(op.type==='phase.move')move(hit.m.phases,p,op.dir);
    else if(op.type==='principle.add'){p.principles=p.principles||[];p.principles.push({t:required(op.title),detail:String(op.detail||'').trim()});}
    else if(op.type==='principle.edit'||op.type==='principle.delete'){
      var old=(p.principles||[])[op.index];same(old,op.before);
      if(op.type==='principle.delete')p.principles.splice(op.index,1);
      else if(typeof old==='string')p.principles[op.index]=op.detail?{t:required(op.title),detail:String(op.detail).trim()}:required(op.title);
      else{var key=['t','text','title'].find(function(k){return old[k];})||'t';old[key]=required(op.title);old[detailKey(old)]=String(op.detail||'').trim();}
    }else throw new Error('지원하지 않는 편집입니다.');
    return doc;
  }
  function term(source,op){
    if(source!==null&&(!source||!Array.isArray(source.items)))throw new Error('용어 형식을 확인할 수 없어 저장하지 않았습니다.');
    var doc=clone(source||{v:1,items:[]});
    if(op.type==='add'){if(doc.items.some(function(t){return t.id===op.id;}))conflict();doc.items.push({id:op.id,l:'signal',g:op.group||'상황',ko:required(op.meaning||op.word),en:required(op.word),d:op.detail||'',ph:op.phase?[op.phase]:[]});return doc;}
    var t=doc.items.find(function(x){return x.id===op.id;});if(!t)conflict();
    if(op.type==='edit'){same({en:t.en,ko:t.ko,d:t.d},op.before);t.en=required(op.word);t.ko=required(op.meaning||op.word);t.d=String(op.detail||'');return doc;}
    t.ph=Array.isArray(t.ph)?t.ph:[];
    if(op.type==='link'&&!t.ph.includes(op.phase))t.ph.push(op.phase);
    if(op.type==='unlink')t.ph=t.ph.filter(function(id){return id!==op.phase;});
    return doc;
  }
  function linkDrill(lib,op){
    if(!Array.isArray(lib))throw new Error('보관함 형식을 확인할 수 없습니다.');
    var it=lib.find(function(x){return (x.libId||x.id)===op.libId;});if(!it)throw new Error('훈련을 찾을 수 없습니다.');
    var d=it.drill&&(Array.isArray(it.drill.gmPhases)||!Array.isArray(it.gmPhases))?it.drill:it,gp=Array.isArray(d.gmPhases)?d.gmPhases.slice():[],gn=Array.isArray(d.gmPhaseNames)?d.gmPhaseNames.slice():[],i=gp.indexOf(op.phase);
    if(op.remove){if(i>=0){gp.splice(i,1);if(i<gn.length)gn.splice(i,1);}}
    else if(i<0){while(gn.length<gp.length)gn.push('');gp.push(op.phase);gn.push(op.name||'');}
    if(gp.length){d.gmPhases=gp;d.gmPhaseNames=gn;}else if(d!==it&&Array.isArray(it.gmPhases)){d.gmPhases=[];d.gmPhaseNames=[];}else{delete d.gmPhases;delete d.gmPhaseNames;}
    return it;
  }
  return {apply:apply,term:term,phase:phase,text:text,detail:detail,linkDrill:linkDrill};
});
