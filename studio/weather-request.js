/* Failed weather requests wait before the next render may retry. No background timer. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSWeatherRequest=api.create();
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function create(now){
    now=now||Date.now;var rows=Object.create(null);
    function run(key,request){
      var row=rows[key]||(rows[key]={failures:0,next:0,pending:null});
      if(row.pending)return row.pending;
      if(now()<row.next)return Promise.reject(row.error);
      row.pending=Promise.resolve().then(request).then(function(result){
        row.failures=0;row.next=0;row.error=null;return result;
      },function(error){
        row.error=error;row.failures++;row.next=now()+Math.min(300000,30000*Math.pow(2,row.failures-1));throw error;
      }).finally(function(){row.pending=null;});
      return row.pending;
    }
    return {run:run};
  }
  return {create:create};
});
