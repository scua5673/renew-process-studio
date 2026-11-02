/* Planned RPE labels. This does not change a saved score or a player's effort report. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSIntensity=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function value(n){n=Number(n);return Number.isFinite(n)&&n>=1&&n<=10?n:0;}
  function word(n){n=value(n);return !n?'':n<=3?'회복':n<=5?'저강도':n<=7?'중강도':n<=9?'고강도':'최대';}
  function band(n){n=value(n);return !n?'':n<=5?'저':n<=7?'중':'고';}
  function text(n){n=value(n);return n?'RPE '+n+' · '+word(n):'';}
  return {value:value,word:word,band:band,text:text};
});
