/* Export filenames use the device's local calendar date at export time. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSExportName=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function stamp(now){var d=now||new Date();return String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');}
  function base(value,now){var s=String(value||'문서').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,90)||'문서',p=stamp(now)+'_';return s.indexOf(p)===0?s:p+s;}
  function name(value,ext,now){return base(value,now)+'.'+String(ext||'').replace(/[^a-z0-9]/gi,'').toLowerCase();}
  return {stamp:stamp,base:base,name:name};
});
