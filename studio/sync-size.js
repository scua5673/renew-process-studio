/* A hydrated screen copy is not the document sent to ps_kv. Estimate only the
   existing thumb/emblem extraction; the final prepared rows still need the
   ordinary wire limit. This module never edits, uploads or acknowledges data. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSKvSize=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function fits(raw,limit,images){
    if(typeof raw!=='string'||raw.length<=limit)return true;
    // Match the existing maximum for large private documents. Do not turn the
    // image exception into an unbounded local parsing allowance.
    if(!images||raw.length>12000000)return false;
    var re=/"(thumb|emblem)":(\s*)"((?:[^"\\]|\\.){512,})"/g,m,n=raw.length;
    while((m=re.exec(raw))){
      if(m[3].length>2000000)return false; // ps_blob's per-image limit
      n-=m[3].length;
      n+=m[1].length+33; // ,"<key>Ref":"<24 hex characters>"
    }
    return n<=limit;
  }
  function check(rows,imageKeys,limit){
    (rows||[]).forEach(function(row){
      if(!row||!imageKeys[row.k]||typeof row.v!=='string'||row.v.length<=limit(row.k))return;
      var e=new Error('그림 분리 저장을 마치지 못해 전송 한도를 넘었습니다 — 기기 원문은 그대로 있어요');
      e.psCode='sync_storage';e.psStage='kv_wire_size';throw e;
    });
  }
  return {fits:fits,check:check};
});
