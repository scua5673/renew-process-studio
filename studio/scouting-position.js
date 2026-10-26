/* Position matching is a view choice. Never rewrite a candidate or a question set. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PSScoutPosition=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function norm(value){var p=String(value||'').trim().toUpperCase();return ({LCB:'CB',RCB:'CB',LWB:'WB',RWB:'WB',CF:'ST',CDM:'DM',CAM:'AM',골키퍼:'GK'})[p]||p;}
  function pick(sets,positions){
    var wanted=(Array.isArray(positions)?positions:[positions]).map(norm).filter(Boolean);
    for(var w=0;w<wanted.length;w++){
      var index=(sets||[]).findIndex(function(s){return (s.positions||[]).some(function(p){return norm(p)===wanted[w];});});
      if(index>=0)return index;
    }
    return -1;
  }
  return {norm:norm,pick:pick};
});
