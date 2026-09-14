/* Pure three-way JSON merge. No storage, network, clock, or application state.
 * Inputs are exact JSON strings; null/undefined base means no trusted baseline.
 * Persist local verbatim before applying any plan with needsArchive. When a
 * conflict has archiveRemote:true, preserve remote verbatim as well: deletion
 * won over an edit. This planner cannot authorize a first insert or restoration.
 */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAutosaveMerge=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var ABSENT={},own=Function.call.bind(Object.prototype.hasOwnProperty);
  var MAX_DEPTH=80,MAX_NODES=100000,MAX_ORDER_PAIRS=1000000;
  function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&v!==ABSENT;}
  function equal(a,b){
    if(a===b)return true;
    if(a===ABSENT||b===ABSENT||a===null||b===null||typeof a!==typeof b)return false;
    if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(function(v,i){return equal(v,b[i]);});
    if(!object(a)||!object(b))return false;
    var keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(function(k){return own(b,k)&&equal(a[k],b[k]);});
  }
  function parse(raw){
    if(raw==null)return {ok:false,reason:'missing'};
    if(typeof raw!=='string')return {ok:false,reason:'invalid-json'};
    var value;try{value=JSON.parse(raw);}catch(_){return {ok:false,reason:'invalid-json'};}
    var count=0,problem='';
    function visit(v,depth){
      if(++count>MAX_NODES||depth>MAX_DEPTH){problem='document-limit';return false;}
      if(typeof v==='number'&&!Number.isFinite(v)){problem='invalid-json';return false;}
      if(v===null||typeof v!=='object')return true;
      return Object.keys(v).every(function(k){
        if(k==='__proto__'||k==='constructor'||k==='prototype'){problem='unsafe-key';return false;}
        return visit(v[k],depth+1);
      });
    }
    return visit(value,0)?{ok:true,value:value}:{ok:false,reason:problem};
  }
  function pointer(path,part){return path+'/'+String(part).replace(/~/g,'~0').replace(/\//g,'~1');}
  function tomb(v){return object(v)&&own(v,'_del')&&!!v._del;}
  function idKey(item){
    if(!object(item)||!own(item,'id'))return null;
    var id=item.id;
    return typeof id==='string'&&id.length?'string:'+id:typeof id==='number'&&Number.isFinite(id)?'number:'+id:null;
  }
  function indexArray(items){
    var ids=[],map=new Map(),hasId=false,bad=false;
    items.forEach(function(item){var id=idKey(item);if(id===null){if(object(item)&&own(item,'id'))hasId=true;bad=true;return;}hasId=true;if(map.has(id))bad=true;map.set(id,item);ids.push(id);});
    return {ids:ids,map:map,kind:bad?(hasId?'ambiguous':'atomic'):'ids'};
  }
  function fallbackOrder(remote,local,ids){
    var alive=new Set(ids),out=remote.filter(function(id){return alive.has(id);}),placed=new Set(out);
    local.forEach(function(id,i){
      if(!alive.has(id)||placed.has(id))return;
      var next=null;for(var j=i+1;j<local.length;j++){if(placed.has(local[j])){next=local[j];break;}}
      if(next===null)out.push(id);else out.splice(out.indexOf(next),0,id);placed.add(id);
    });
    ids.forEach(function(id){if(!placed.has(id)){out.push(id);placed.add(id);}});return out;
  }
  function plan(input){
    var o=input||{},conflicts=[];
    function result(raw,reason){return {raw:raw,needsArchive:conflicts.length>0,reason:reason,conflicts:conflicts};}
    function conflict(path,reason,winner,archiveRemote){var c={path:path,reason:reason,winner:winner||'remote'};if(archiveRemote)c.archiveRemote=true;conflicts.push(c);}
    function fail(reason){conflict('',reason);return result(o.remote,reason);}
    if(o.local===o.remote)return result(o.remote,'unchanged');
    var l=parse(o.local),r=parse(o.remote),b=parse(o.base);
    if(!l.ok)return fail('local-'+l.reason);
    if(!r.ok)return fail('remote-'+r.reason);
    if(equal(l.value,r.value))return result(o.remote,'unchanged');
    if(!b.ok)return fail('base-'+b.reason);
    if(equal(l.value,b.value))return result(o.remote,'unchanged');

    function order(base,local,remote,ids,path){
      var alive=new Set(ids),bs=base.filter(function(id){return alive.has(id);}),ls=local.filter(function(id){return alive.has(id);}),rs=remote.filter(function(id){return alive.has(id);});
      if(equal(ls,rs))return rs;
      if(ids.length*(ids.length-1)/2>MAX_ORDER_PAIRS){conflict(path,'order-limit');return fallbackOrder(rs,ls,ids);}
      var bp=new Map(bs.map(function(id,i){return [id,i];})),lp=new Map(ls.map(function(id,i){return [id,i];})),rp=new Map(rs.map(function(id,i){return [id,i];}));
      var edges=new Map(ids.map(function(id){return [id,[]];})),degree=new Map(ids.map(function(id){return [id,0];})),disagreed=false;
      function relation(map,a,z){return map.has(a)&&map.has(z)?(map.get(a)<map.get(z)?-1:1):0;}
      for(var i=0;i<ids.length;i++)for(var j=i+1;j<ids.length;j++){
        var a=ids[i],z=ids[j],bv=relation(bp,a,z),lv=relation(lp,a,z),rv=relation(rp,a,z),v;
        if(lv===rv)v=lv;else if(lv===bv)v=rv;else if(rv===bv)v=lv;
        else {v=rv||lv;if(rv&&lv)disagreed=true;}
        if(v){var from=v<0?a:z,to=v<0?z:a;edges.get(from).push(to);degree.set(to,degree.get(to)+1);}
      }
      var ranked=fallbackOrder(rs,ls,ids),rank=new Map(ranked.map(function(id,i){return [id,i];}));
      var ready=ids.filter(function(id){return degree.get(id)===0;}),out=[];
      while(ready.length){ready.sort(function(a,z){return rank.get(a)-rank.get(z);});var next=ready.shift();out.push(next);edges.get(next).forEach(function(id){degree.set(id,degree.get(id)-1);if(degree.get(id)===0)ready.push(id);});}
      if(out.length!==ids.length){conflict(path,'order-conflict');return ranked;}
      if(disagreed)conflict(path,'order-conflict');return out;
    }
    function merge(bv,lv,rv,path,membership){
      if(equal(lv,rv))return rv;
      if(equal(lv,bv))return rv;
      // Explicit tombstones and removals dominate edits. In particular a
      // device whose base already contains a server tombstone cannot revive it.
      if(tomb(rv)){conflict(path,'deleted-on-remote');return rv;}
      if(tomb(lv)){if(!equal(rv,bv))conflict(path,'delete-edit','local-deletion',true);return lv;}
      if(tomb(bv)){conflict(path,'deleted-baseline');return rv;}
      if(bv!==ABSENT&&rv===ABSENT){conflict(path,'deleted-on-remote');return ABSENT;}
      if(bv!==ABSENT&&lv===ABSENT){
        if(equal(rv,bv))return ABSENT;
        if(membership){conflict(path,'delete-edit','local-deletion',true);return ABSENT;}
        conflict(path,'same-field');return rv;
      }
      if(lv===ABSENT)return rv;
      if(rv===ABSENT)return lv;
      if(object(lv)&&object(rv)&&(object(bv)||bv===ABSENT)){
        var out=Object.create(null),keys=Array.from(new Set(Object.keys(rv).concat(Object.keys(lv),bv===ABSENT?[]:Object.keys(bv))));
        keys.forEach(function(k){var value=merge(bv!==ABSENT&&own(bv,k)?bv[k]:ABSENT,own(lv,k)?lv[k]:ABSENT,own(rv,k)?rv[k]:ABSENT,pointer(path,k));if(value!==ABSENT)out[k]=value;});return out;
      }
      if(Array.isArray(lv)&&Array.isArray(rv)&&(Array.isArray(bv)||bv===ABSENT)){
        var bi=indexArray(bv===ABSENT?[]:bv),li=indexArray(lv),ri=indexArray(rv),indexes=[bi,li,ri];
        if(indexes.some(function(x){return x.kind==='ambiguous';})){conflict(path,'ambiguous-array-ids');return rv;}
        if(indexes.every(function(x){return x.kind==='ids';})){
          var all=Array.from(new Set(ri.ids.concat(li.ids,bi.ids))),values=new Map();
          all.forEach(function(id){var value=merge(bi.map.has(id)?bi.map.get(id):ABSENT,li.map.has(id)?li.map.get(id):ABSENT,ri.map.has(id)?ri.map.get(id):ABSENT,pointer(path,'@id='+id),true);if(value!==ABSENT)values.set(id,value);});
          return order(bi.ids,li.ids,ri.ids,Array.from(values.keys()),path).map(function(id){return values.get(id);});
        }
      }
      if(equal(rv,bv))return lv;
      conflict(path,'same-field');return rv;
    }
    var value=merge(b.value,l.value,r.value,''),raw=equal(value,r.value)?o.remote:equal(value,l.value)?o.local:JSON.stringify(value);
    return result(raw,conflicts.length?'conflict':raw===o.remote?'unchanged':'merged');
  }
  return {plan:plan};
});
