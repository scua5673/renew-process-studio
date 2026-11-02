/* Display-only fallback from the public roster; never copy it into the player's document. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSIDPProfileName=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function resolve(profile,uid,permissions,roster){
    var own=String(profile&&profile.name||'').trim();if(own)return own;
    var members=permissions&&permissions.members,member=members&&members[uid];
    if(!uid||!member||member.playerId==null||!Array.isArray(roster))return '';
    var id=String(member.playerId),links=Object.keys(members).filter(function(k){return String((members[k]||{}).playerId)===id;});
    if(!id||links.length!==1)return '';
    var rows=roster.filter(function(p){return p&&String(p.id)===id;});
    return rows.length===1?String(rows[0].name||'').trim():'';
  }
  return {resolve:resolve};
});
