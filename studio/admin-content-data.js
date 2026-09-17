/* Read-only adapters for the persisted library formats in board.html. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PSAdminContentData=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var LIMITS={depth:12,nodes:6000,entries:2000,array:2000,json:16*1024*1024};
  var WRAPPERS=['value','result','data','json','ps_admin_library_item'];
  var FIELDS=[
    ['method','훈련 방법'],['spDesc','세트피스 설명'],['overview','목적'],
    ['func','기능'],['description','설명'],['desc','추가 설명'],['setup','구성'],
    ['coaching','코칭 포인트'],['coachingPoint','추가 코칭'],['prog','진행'],
    ['progression','발전'],['note','노트'],['memo','메모'],['memoQuick','빠른 메모'],
    ['spCall','세트피스 콜'],['success','성공 기준'],['fourDs','4D'],['playerTask','선수 과제'],
    ['sessionCheck','세션 점검'],['playerReflection','선수 돌아보기'],['evidence','관찰 근거'],
    ['summaryLine','요약'],['coachReflection','코치 돌아보기'],['nextSession','다음 세션'],
    ['matchNote','경기 메모'],['points','핵심 내용']
  ];
  function own(o,k){return !!o&&Object.prototype.hasOwnProperty.call(o,k);}
  function obj(o){return !!o&&typeof o==='object'&&!Array.isArray(o);}
  function read(o,k){if(!obj(o)||!own(o,k))return undefined;var d=Object.getOwnPropertyDescriptor(o,k);return d&&own(d,'value')?d.value:undefined;}
  function text(v){return typeof v==='string'?v.trim():(typeof v==='number'&&isFinite(v)?String(v):'');}
  function parse(v){if(typeof v!=='string')return v;if(v.length>LIMITS.json)return null;try{return JSON.parse(v);}catch(_){return null;}}
  function unwrap(v){
    var seen=new Set();
    for(var i=0;i<16;i++){
      v=parse(v);if(Array.isArray(v)){v=v.length?v[0]:null;continue;}
      if(!obj(v)||seen.has(v))return null;seen.add(v);
      var keys=Object.keys(v),next;
      if(own(v,'ps_admin_library_item'))next=read(v,'ps_admin_library_item');
      else if(keys.length===1&&WRAPPERS.indexOf(keys[0])>=0)next=read(v,keys[0]);
      else return v;
      v=next;
    }
    return null;
  }
  function normalizePayload(raw){var row=unwrap(raw)||{},body=own(row,'item')?unwrap(read(row,'item')):row;return {row:row,body:body||{}};}
  function thumbOf(o){
    var s=typeof o==='string'?o:read(o,'thumb');if(typeof s!=='string')return '';
    s=s.trim();
    /* Return image data only. The UI must render this through <img>, never innerHTML. */
    if(/^<svg\b/i.test(s))return s;
    if(/^data:image\/(?:svg\+xml|png|jpeg|jpg|webp|gif)(?:;[a-z0-9=+-]+)*,/i.test(s))return s;
    return '';
  }
  function snapOf(o){
    var snap=parse(read(o,'snap'));if(obj(snap))return snap;
    snap=parse(read(o,'snapshot'));if(obj(snap))return snap;
    /* A bare snapshot is supported only at a known content position. */
    if(obj(o)&&(['players','equipment','drawings'].some(function(k){return Array.isArray(read(o,k));})||obj(read(o,'ball'))))return o;
    return null;
  }
  function valueText(v){
    if(Array.isArray(v))return v.slice(0,LIMITS.array).map(text).filter(Boolean).join('\n');
    return text(v);
  }
  function descriptions(o,scope){
    if(!obj(o))return [];var rows=[];
    FIELDS.forEach(function(pair){var value=valueText(read(o,pair[0]));if(value)rows.push({key:pair[0],label:pair[1],value:value,scope:scope||''});});
    /* board.html creates optional form fields as f + base36 timestamp + section index.
       Their labels live in the coach's separate form settings, not in the library item. */
    Object.keys(o).slice(0,1000).forEach(function(k){if(!/^f[a-z0-9]{8,14}[0-9]{1,3}$/.test(k))return;var value=valueText(read(o,k));if(value)rows.push({key:k,label:'추가 항목',value:value,scope:scope||''});});
    return rows;
  }
  function addDescriptions(parent,node,scope){
    var rows=parent.slice();descriptions(node,scope).forEach(function(row){
      if(!rows.some(function(prior){return prior.key===row.key&&prior.value===row.value;}))rows.push(row);
    });
    var snap=snapOf(node),note=snap&&text(read(snap,'matchNote'));
    if(note&&!rows.some(function(r){return r.key==='matchNote'&&r.value===note;}))rows.push({key:'matchNote',label:'경기 메모',value:note,scope:scope||''});
    return rows;
  }
  function childLabel(parent,saved,fallback){
    var label=saved||fallback;
    return label===parent||label.indexOf(parent+' · ')===0?label:parent+' · '+label;
  }
  function metadata(node,prior){
    var out=Object.assign({},prior||{});
    ['minutes','sets','rpe','focus','dur'].forEach(function(k){var value=read(node,k);if(typeof value==='string'||(typeof value==='number'&&isFinite(value)))out[k==='dur'?'duration':k]=value;});
    return out;
  }
  function model(input){
    var item=obj(input)?input:{},out=[],active=new Set(),nodes=0,truncated=false;
    var stats={trainings:0,scenes:0,pages:0,frames:0,slides:0,total:0,truncated:false};
    var signatures=new WeakMap(),compareBudget=120000,descendantNodes=0;
    /* Stable comparison is used only for representative snapshots/animation arrays.
       Explicit pages or scenes are never globally de-duplicated. */
    function signature(value){
      if(!value||typeof value!=='object')return null;
      if(signatures.has(value))return signatures.get(value);
      var seen=new Set(),budget=8000,chars=0;
      function encode(v,depth){
        if(--budget<0||--compareBudget<0||depth>24)throw 0;
        if(v===null)return 'null';var type=typeof v;
        if(type==='string'){chars+=v.length;if(chars>2*1024*1024)throw 0;return JSON.stringify(v);}
        if(type==='number'||type==='boolean')return JSON.stringify(v);
        if(type!=='object')return 'null';if(seen.has(v))throw 0;seen.add(v);
        var result;
        if(Array.isArray(v)){if(v.length>LIMITS.array)throw 0;result='['+v.map(function(x){return encode(x,depth+1);}).join(',')+']';}
        else{var keys=Object.keys(v).sort();if(keys.length>1000)throw 0;result='{'+keys.map(function(k){var d=Object.getOwnPropertyDescriptor(v,k);if(!d||!own(d,'value'))throw 0;return JSON.stringify(k)+':'+encode(d.value,depth+1);}).join(',')+'}';}
        seen.delete(v);return result;
      }
      var result=null;try{result=encode(value,0);}catch(_){}signatures.set(value,result);return result;
    }
    function equal(a,b){if(a===b)return true;if(!a||!b)return false;var sa=signature(a);return sa!==null&&sa===signature(b);}
    function mediaSame(a,b){
      var sa=snapOf(a),sb=snapOf(b);if(sa&&sb)return equal(sa,sb);
      var ta=thumbOf(a),tb=thumbOf(b);return !!ta&&ta===tb;
    }
    function list(node,key){var v=read(node,key);if(!Array.isArray(v))return [];if(v.length>LIMITS.array)truncated=true;return v.slice(0,LIMITS.array).map(function(value,index){return {value:value,index:index};}).filter(function(e){return obj(e.value)||typeof e.value==='string'&&!!thumbOf(e.value);});}
    function frameGroups(node){var groups=[],frames=list(node,'frames'),anim=read(node,'anim');if(frames.length)groups.push({key:'frames',entries:frames});var nested=list(anim,'frames');if(nested.length&&!equal(frames.map(function(x){return x.value;}),nested.map(function(x){return x.value;})))groups.push({key:'anim.frames',entries:nested});return groups;}
    function sameFrameGroups(left,right){
      return left.length===right.length&&left.length>0&&left.every(function(entry,i){
        /* Frame duration/title/notes matter even if the drawing is identical. */
        return equal(entry.value,right[i].value);
      });
    }
    function knownDescendantFrameGroups(node,depth,seen){
      if(!obj(node)||seen.has(node))return [];if(depth>LIMITS.depth||descendantNodes++>=LIMITS.nodes){truncated=true;return [];}seen.add(node);var groups=[];
      ['trainings','pages','slides','scenes'].forEach(function(key){list(node,key).forEach(function(entry){var child=entry.value;if(!obj(child))return;frameGroups(child).forEach(function(g){groups.push(g.entries);});groups=groups.concat(knownDescendantFrameGroups(child,depth+1,seen));});});
      seen.delete(node);return groups;
    }
    function emit(node,path,label,rows,meta){
      if(out.length>=LIMITS.entries){truncated=true;return;}
      var snap=snapOf(node),thumb=thumbOf(node),entry={id:path,label:label,thumb:thumb,snap:snap,descriptionRows:rows.slice(),meta:Object.assign({},meta)};
      out.push(entry);if(thumb||snap)stats.scenes++;if(meta.kind==='frame')stats.frames++;if(meta.kind==='slide')stats.slides++;
    }
    function visit(node,path,label,rows,meta,depth,extraGroups){
      if(out.length>=LIMITS.entries||nodes++>=LIMITS.nodes||depth>LIMITS.depth){truncated=true;return;}
      if(typeof node==='string'){emit(node,path,label,rows,meta);return;}
      if(!obj(node)||active.has(node)){if(active.has(node))truncated=true;return;}
      active.add(node);
      var ownRows=addDescriptions(rows,node,label),ownMeta=metadata(node,meta);
      var trainings=list(node,'trainings'),pages=list(node,'pages'),slides=list(node,'slides'),scenes=list(node,'scenes'),groups=frameGroups(node).concat(extraGroups||[]),represented=false;
      var collections=[{key:'trainings',entries:trainings},{key:'pages',entries:pages},{key:'slides',entries:slides}];
      var canonicalLength=trainings.length+pages.length+slides.length;
      var descFrames=canonicalLength?knownDescendantFrameGroups(node,0,new Set()):[];
      if(canonicalLength){
        var legacyGroups=[];
        /* Older multi-training cards put animation only on the card. The editor
           adopts it into the first training if none of the trainings has animation. */
        if(trainings.length&&groups.length&&!descFrames.length){legacyGroups=groups.map(function(g){return {key:'card.'+g.key,entries:g.entries};});groups=[];}
        collections.forEach(function(collection){collection.entries.forEach(function(entry){
          var canonicalKey=collection.key,child=entry.value,i=entry.index,kind=canonicalKey==='trainings'?'training':canonicalKey==='pages'?'page':'slide';
          var childLabel=text(read(child,'name'))||text(read(child,'title'))||(kind==='training'?'훈련 ':kind==='page'?'페이지 ':'슬라이드 ')+(i+1);
          var next=Object.assign({},ownMeta,{kind:kind});
          if(kind==='training'){stats.trainings++;next.trainingIndex=i;next.trainingName=childLabel;}
          if(kind==='page'){stats.pages++;next.pageIndex=i;next.pageName=childLabel;}
          if(kind==='slide')next.slideIndex=i;
          visit(child,path+'.'+canonicalKey+'['+i+']',childLabel,ownRows,next,depth+1,kind==='training'&&i===trainings[0].index?legacyGroups:null);
        });});
        /* Only the first training's scenes are copied to the card for compatibility.
           A pages/slides container may still retain separately saved static scenes. */
        if(trainings.length&&equal(read(node,'scenes'),read(trainings[0].value,'scenes')))scenes=[];
        groups=groups.filter(function(group){return !descFrames.some(function(other){return sameFrameGroups(group.entries,other);});});
      }else{
        var baseHasMedia=!!(snapOf(node)||thumbOf(node)),frameEntries=[];
        groups.forEach(function(g){frameEntries=frameEntries.concat(g.entries);});
        represented=baseHasMedia&&frameEntries.some(function(entry){return mediaSame(node,entry.value);});
        if(!represented&&(baseHasMedia||!frameEntries.length&&!scenes.length||ownRows.length&&!frameEntries.length))emit(node,path,label,ownRows,ownMeta);
      }
      function emitScenes(){scenes.forEach(function(entry){var i=entry.index,child=entry.value;visit(child,path+'.scenes['+i+']',childLabel(label,text(read(child,'name'))||text(read(child,'title')),'장면 '+(i+2)),ownRows,Object.assign({},ownMeta,{kind:'scene',sceneIndex:i+1}),depth+1);});}
      function emitFrames(){groups.forEach(function(group){group.entries.forEach(function(entry){var i=entry.index,child=entry.value;visit(child,path+'.'+group.key+'['+i+']',childLabel(label,text(read(child,'title'))||text(read(child,'name')),'애니메이션 '+(i+1)),ownRows,Object.assign({},ownMeta,{kind:'frame',frameIndex:i}),depth+1);});});}
      /* When a frame already represents the default board, start with that
         sequence rather than opening on the second static scene. */
      if(represented){emitFrames();emitScenes();}else{emitScenes();emitFrames();}
      active.delete(node);
    }
    if(Object.keys(item).length){
      if(!list(item,'trainings').length&&['train','setpiece'].indexOf(text(read(item,'type')))>=0)stats.trainings=1;
      visit(item,'item',text(read(item,'name'))||text(read(item,'title'))||'저장된 내용',[],{kind:'item'},0);
    }
    stats.total=out.length;stats.truncated=truncated;out.truncated=truncated;
    return {pages:out,summary:stats};
  }
  function pages(item){return model(item).pages;}
  function summarize(item){return model(item).summary;}
  return {normalizePayload:normalizePayload,pages:pages,summarize:summarize,model:model,descriptions:descriptions};
});
